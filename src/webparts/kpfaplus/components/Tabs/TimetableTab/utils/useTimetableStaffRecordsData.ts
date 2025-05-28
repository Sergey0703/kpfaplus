// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsData.ts

import { useEffect, useCallback, useRef } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
//import { /* IStaffRecordsResult, */ IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { 
  IWeekInfo, 
  IWeekGroup,
  IStaffMember,
  ITimetableStaffRow,
  IDayInfo
} from '../interfaces/TimetableInterfaces';
import { TimetableDataProcessor } from './TimetableDataProcessor';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';

interface UseTimetableStaffRecordsDataProps {
  context?: WebPartContext;
  selectedDate: Date;
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  weeks: IWeekInfo[];
  staffMembers: IStaffMember[];
  setWeeksData: (weeksData: IWeekGroup[]) => void;
  setStaffRecords: (records: IStaffRecord[]) => void;
  setIsLoadingStaffRecords: (isLoading: boolean) => void;
  setErrorStaffRecords: (error?: string) => void;
}

interface UseTimetableStaffRecordsDataReturn {
  loadTimetableData: (overrideDate?: Date) => Promise<void>;
  refreshTimetableData: () => Promise<void>;
}

export const useTimetableStaffRecordsData = (
  props: UseTimetableStaffRecordsDataProps
): UseTimetableStaffRecordsDataReturn => {
  const {
    context,
    selectedDate,
    currentUserId,
    managingGroupId,
    staffRecordsService,
    weeks,
    staffMembers,
    setWeeksData,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  } = props;

  // *** ЗАЩИТА ОТ ПАРАЛЛЕЛЬНЫХ ЗАПРОСОВ ***
  const isLoadingRef = useRef(false);
  const lastRequestParamsRef = useRef<string>('');

  console.log('[useTimetableStaffRecordsData] Hook initialized with NEW TIMETABLE STRATEGY:', {
    hasContext: !!context,
    hasStaffRecordsService: !!staffRecordsService,
    weeksCount: weeks.length,
    staffMembersCount: staffMembers.length,
    selectedDate: selectedDate.toISOString(),
    managingGroupId,
    currentUserId,
    newStrategy: 'Using getAllStaffRecordsForTimetable - loads ALL records without pagination'
  });

  /**
   * *** НОВАЯ СТРАТЕГИЯ TIMETABLE: Загрузка ВСЕХ данных БЕЗ пагинации ***
   * Использует новый метод getAllStaffRecordsForTimetable
   */
  const loadWithTimetableStrategy = async (
    startDate: Date, 
    endDate: Date, 
    currentUserId: string, 
    managingGroupId: string, 
    staffRecordsService: StaffRecordsService
  ): Promise<IStaffRecord[]> => {
    console.log('[useTimetableStaffRecordsData] *** EXECUTING NEW TIMETABLE STRATEGY ***');
    console.log('[useTimetableStaffRecordsData] *** LOADING ALL DATA WITHOUT PAGINATION ***');
    
    const queryParams = {
      startDate,
      endDate,
      currentUserID: currentUserId,
      staffGroupID: managingGroupId,
      employeeID: '', // Пустая строка = без фильтра по сотруднику
      timeTableID: undefined
      // НЕТ skip, top, nextLink - загружаем ВСЕ данные
    };

    console.log('[useTimetableStaffRecordsData] Timetable query params (NO PAGINATION):', queryParams);

    const startTime = performance.now();
    const result = await staffRecordsService.getAllStaffRecordsForTimetable(queryParams);
    const loadTime = performance.now() - startTime;

    console.log('[useTimetableStaffRecordsData] *** TIMETABLE STRATEGY RESULT ***:', {
      recordsCount: result.records.length,
      totalCount: result.totalCount,
      loadTimeMs: Math.round(loadTime),
      hasError: !!result.error,
      isDataComplete: result.records.length === result.totalCount,
      strategyUsed: 'getAllStaffRecordsForTimetable (NO PAGINATION)',
      expectedResult: 'ALL records for the period loaded at once'
    });

    if (result.error) {
      throw new Error(`Timetable strategy failed: ${result.error}`);
    }

    // *** КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся что получили ВСЕ данные ***
    if (result.records.length !== result.totalCount) {
      console.warn('[useTimetableStaffRecordsData] ⚠️ POTENTIAL DATA LOSS:', {
        recordsReceived: result.records.length,
        totalExpected: result.totalCount,
        difference: result.totalCount - result.records.length
      });
    } else {
      console.log('[useTimetableStaffRecordsData] ✅ SUCCESS: Got ALL expected records');
    }

    return result.records;
  };

  /**
   * Обработка и установка результатов с детальной диагностикой
   */
  const processAndSetResults = async (
    allRecords: IStaffRecord[], 
    activeStaffMembers: IStaffMember[], 
    weeks: IWeekInfo[],
    strategy: string
  ): Promise<void> => {
    console.log(`[useTimetableStaffRecordsData] *** PROCESSING RESULTS FROM ${strategy.toUpperCase()} STRATEGY WITH DIAGNOSTICS ***`);
    
    // Создаем Set с employeeId активных сотрудников для быстрой фильтрации
    const activeEmployeeIds = new Set(
      activeStaffMembers
        .map(staff => staff.employeeId?.toString())
        .filter(id => id && id !== '0')
    );

    console.log('[useTimetableStaffRecordsData] Active employee IDs for filtering:', Array.from(activeEmployeeIds));

    // *** ДЕТАЛЬНАЯ ДИАГНОСТИКА ВХОДЯЩИХ ДАННЫХ (ПОСЛЕ ЗАГРУЗКИ ВСЕХ ЗАПИСЕЙ) ***
    console.log('[useTimetableStaffRecordsData] *** RAW DATA ANALYSIS (ALL RECORDS LOADED) ***');
    
    const recordsByStaffId: Record<string, number> = {};
    const recordsByDate: Record<string, number> = {};
    const uniqueStaffIdsInRecords = new Set<string>();
    
    allRecords.forEach(record => {
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      const dateStr = record.Date.toLocaleDateString();
      
      recordsByStaffId[staffId] = (recordsByStaffId[staffId] || 0) + 1;
      recordsByDate[dateStr] = (recordsByDate[dateStr] || 0) + 1;
      uniqueStaffIdsInRecords.add(staffId);
    });

    console.log('[useTimetableStaffRecordsData] Raw data analysis (ALL RECORDS):', {
      totalRecordsFromServer: allRecords.length,
      uniqueStaffIdsInRecords: uniqueStaffIdsInRecords.size,
      staffIdsInRecords: Array.from(uniqueStaffIdsInRecords).slice(0, 10), // Показываем первые 10
      activeStaffCount: activeStaffMembers.length,
      activeEmployeeIds: Array.from(activeEmployeeIds),
      uniqueDatesCount: Object.keys(recordsByDate).length,
      monthSpan: Object.keys(recordsByDate).length > 20 ? 
        'GOOD: Data spans full month' : 
        'WARNING: Limited date range'
    });

    // *** КРИТИЧЕСКАЯ ДИАГНОСТИКА: Проверяем даты записей ***
    console.log('[useTimetableStaffRecordsData] *** CRITICAL DATE ANALYSIS (ALL RECORDS) ***');

    // Анализируем даты всех записей
    const dateAnalysis: Record<string, { count: number; recordIds: string[] }> = {};
    const monthYearAnalysis: Record<string, number> = {};

    allRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      const dateStr = recordDate.toLocaleDateString('en-GB');
      const monthYear = recordDate.toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' });
      
      if (!dateAnalysis[dateStr]) {
        dateAnalysis[dateStr] = { count: 0, recordIds: [] };
      }
      dateAnalysis[dateStr].count++;
      dateAnalysis[dateStr].recordIds.push(record.ID);
      
      monthYearAnalysis[monthYear] = (monthYearAnalysis[monthYear] || 0) + 1;
    });

    // Сортируем даты для анализа
    const sortedDates = Object.keys(dateAnalysis).sort((a, b) => 
      new Date(a.split('/').reverse().join('-')).getTime() - 
      new Date(b.split('/').reverse().join('-')).getTime()
    );

    console.log('[useTimetableStaffRecordsData] Date distribution analysis (ALL RECORDS):', {
      totalUniqueDates: sortedDates.length,
      dateRange: sortedDates.length > 0 ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` : 'No dates',
      monthYearDistribution: monthYearAnalysis,
      first10Dates: sortedDates.slice(0, 10).map(date => ({
        date,
        count: dateAnalysis[date].count
      })),
      last10Dates: sortedDates.slice(-10).map(date => ({
        date,
        count: dateAnalysis[date].count
      })),
      dataQuality: sortedDates.length > 20 ? 'EXCELLENT: Full month coverage' : 'POOR: Limited coverage'
    });

    // *** ПРОВЕРЯЕМ ЗАПРОШЕННЫЙ ДИАПАЗОН VS ПОЛУЧЕННЫЕ ДАННЫЕ ***
    const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

    console.log('[useTimetableStaffRecordsData] *** REQUEST VS RECEIVED DATA ANALYSIS ***');
    console.log('[useTimetableStaffRecordsData] Request parameters:', {
      requestedMonth: selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      requestedStartDate: startDate.toLocaleDateString('en-GB'),
      requestedEndDate: endDate.toLocaleDateString('en-GB'),
      requestedRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
    });

    // Проверяем, попадают ли записи в запрошенный диапазон
    const recordsInRange = allRecords.filter(record => {
      const recordDate = new Date(record.Date);
      return recordDate >= startDate && recordDate <= endDate;
    });

    const recordsOutsideRange = allRecords.filter(record => {
      const recordDate = new Date(record.Date);
      return recordDate < startDate || recordDate > endDate;
    });

    console.log('[useTimetableStaffRecordsData] Records vs requested range:', {
      totalRecords: allRecords.length,
      recordsInRequestedRange: recordsInRange.length,
      recordsOutsideRange: recordsOutsideRange.length,
      percentageInRange: Math.round((recordsInRange.length / allRecords.length) * 100) + '%',
      result: recordsOutsideRange.length === 0 ? 'PERFECT: All records in range' : 'ISSUE: Some records outside range'
    });

    if (recordsOutsideRange.length > 0) {
      console.error('[useTimetableStaffRecordsData] 🚨 RECORDS OUTSIDE RANGE DETECTED:', {
        count: recordsOutsideRange.length,
        examples: recordsOutsideRange.slice(0, 5).map(record => ({
          id: record.ID,
          date: record.Date.toLocaleDateString('en-GB'),
          staffId: record.StaffMemberLookupId
        }))
      });
    }

    // *** ПРОВЕРЯЕМ РАСПРЕДЕЛЕНИЕ ПО НЕДЕЛЯМ (КЛЮЧЕВАЯ ДИАГНОСТИКА) ***
    const firstWeek = weeks[0];
    if (firstWeek) {
      const weekDistribution: Record<number, number> = {};
      
      allRecords.forEach(record => {
        const recordDate = new Date(record.Date);
        const matchingWeek = weeks.find(week => 
          TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
        );
        
        if (matchingWeek) {
          weekDistribution[matchingWeek.weekNum] = (weekDistribution[matchingWeek.weekNum] || 0) + 1;
        }
      });
      
      console.log('[useTimetableStaffRecordsData] *** WEEK DISTRIBUTION ANALYSIS (CRITICAL) ***');
      console.log('[useTimetableStaffRecordsData] Records distribution by weeks:', {
        weekDistribution,
        totalWeeks: weeks.length,
        weeksWithData: Object.keys(weekDistribution).length,
        isFirstWeekDominant: weekDistribution[1] && weekDistribution[1] > (allRecords.length * 0.8) ? 
          '🚨 CRITICAL: >80% records in week 1!' : 
          '✅ GOOD: Normal distribution',
        distributionBalance: Object.keys(weekDistribution).length > 1 ? 
          'EXCELLENT: Multi-week data' : 
          'CRITICAL: Single week concentration',
        
        // Детальная статистика по неделям
        weekBreakdown: weeks.map(week => ({
          weekNum: week.weekNum,
          weekRange: `${week.weekStart.toLocaleDateString('en-GB')} - ${week.weekEnd.toLocaleDateString('en-GB')}`,
          recordsCount: weekDistribution[week.weekNum] || 0,
          percentage: Math.round(((weekDistribution[week.weekNum] || 0) / allRecords.length) * 100) + '%'
        }))
      });

      // *** ФИНАЛЬНАЯ ДИАГНОСТИКА ПРОБЛЕМЫ ***
      const singleWeekConcentration = Object.keys(weekDistribution).length === 1 && weekDistribution[1];
      if (singleWeekConcentration) {
        console.error('[useTimetableStaffRecordsData] 🚨🚨🚨 PROBLEM IDENTIFIED 🚨🚨🚨');
        console.error('[useTimetableStaffRecordsData] ISSUE: All records concentrated in Week 1');
        console.error('[useTimetableStaffRecordsData] SOLUTION IMPLEMENTED: Using getAllStaffRecordsForTimetable should fix this');
        console.error('[useTimetableStaffRecordsData] If problem persists, check server-side filtering in RemoteSiteItemService.getAllFilteredItemsForTimetable');
      } else {
        console.log('[useTimetableStaffRecordsData] ✅ SUCCESS: Records properly distributed across weeks');
      }
    }

    // *** АНАЛИЗ СОВПАДЕНИЙ ПО СОТРУДНИКАМ ***
    const matchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => activeEmployeeIds.has(id));
    const nonMatchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => !activeEmployeeIds.has(id));
    
    console.log('[useTimetableStaffRecordsData] Staff ID matching analysis:', {
      matchingStaffIds: matchingStaffIds,
      nonMatchingStaffIds: nonMatchingStaffIds.slice(0, 3), // Показываем только первые 3
      matchingCount: matchingStaffIds.length,
      nonMatchingCount: nonMatchingStaffIds.length,
      coverageQuality: matchingStaffIds.length > nonMatchingStaffIds.length ? 
        'GOOD: More matching than non-matching' : 
        'ISSUE: More non-matching IDs'
    });

    // Фильтруем полученные записи по нашим активным сотрудникам
    const filteredRecords = allRecords.filter(record => {
      const recordStaffMemberId = record.StaffMemberLookupId?.toString();
      return recordStaffMemberId && activeEmployeeIds.has(recordStaffMemberId);
    });

    console.log('[useTimetableStaffRecordsData] *** CLIENT-SIDE FILTERING COMPLETED ***');
    console.log('[useTimetableStaffRecordsData] Filtering results:', {
      totalRecordsFromServer: allRecords.length,
      filteredRecordsForOurStaff: filteredRecords.length,
      filteringEfficiency: `${Math.round((filteredRecords.length / allRecords.length) * 100)}% records matched our staff`,
      activeStaffCount: activeStaffMembers.length,
      result: filteredRecords.length > 0 ? 'SUCCESS: Found matching records' : 'PROBLEM: No matching records'
    });

    // *** КРИТИЧЕСКАЯ ПРОВЕРКА РАСПРЕДЕЛЕНИЯ ПО НЕДЕЛЯМ (ПОСЛЕ ФИЛЬТРАЦИИ) ***
    const recordsByWeek: Record<number, number> = {};
    
    filteredRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      
      // Находим неделю для этой записи
      const matchingWeek = weeks.find(week => 
        TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
      );
      
      if (matchingWeek) {
        recordsByWeek[matchingWeek.weekNum] = (recordsByWeek[matchingWeek.weekNum] || 0) + 1;
      } else {
        console.warn(`[useTimetableStaffRecordsData] ⚠️ Record ${record.ID} (${recordDate.toLocaleDateString()}) does not match any calculated week!`);
      }
    });

    console.log('[useTimetableStaffRecordsData] *** FINAL RECORDS DISTRIBUTION BY WEEKS (AFTER FILTERING) ***', {
      weeklyDistribution: recordsByWeek,
      totalWeeks: weeks.length,
      weeksWithData: Object.keys(recordsByWeek).length,
      avgRecordsPerWeek: Object.keys(recordsByWeek).length > 0 ? 
        Math.round(filteredRecords.length / Object.keys(recordsByWeek).length) : 0,
      finalResult: Object.keys(recordsByWeek).length > 1 ? 
        '🎉 SUCCESS: Multi-week data distribution achieved!' : 
        '❌ STILL FAILED: Single week concentration persists',
      
      // Показываем финальное распределение
      finalWeekBreakdown: weeks.map(week => ({
        weekNum: week.weekNum,
        recordsCount: recordsByWeek[week.weekNum] || 0,
        percentage: filteredRecords.length > 0 ? 
          Math.round(((recordsByWeek[week.weekNum] || 0) / filteredRecords.length) * 100) + '%' : '0%'
      }))
    });

    // Сохраняем отфильтрованные записи
    console.log('[useTimetableStaffRecordsData] *** SETTING FILTERED STAFF RECORDS IN STATE ***');
    setStaffRecords(filteredRecords);

    // Обрабатываем данные в структуру групп недель
    console.log('[useTimetableStaffRecordsData] *** CALLING TimetableDataProcessor.processDataByWeeks ***');
    const weeksData = TimetableDataProcessor.processDataByWeeks({
      staffRecords: filteredRecords,
      staffMembers: activeStaffMembers,
      weeks: weeks,
      currentUserId: currentUserId,
      managingGroupId: managingGroupId
    });

    console.log(`[useTimetableStaffRecordsData] *** PROCESSOR COMPLETED ***`);
    console.log(`[useTimetableStaffRecordsData] Processed ${weeksData.length} week groups using ${strategy} strategy`);
    
    // Логируем статистику по неделям
    weeksData.forEach((weekGroup: IWeekGroup) => {
      const staffWithData = weekGroup.staffRows.filter((row: ITimetableStaffRow) =>
        Object.values(row.weekData.days).some((day: IDayInfo) => day.hasData)
      ).length;
      
      console.log(`[useTimetableStaffRecordsData] Week ${weekGroup.weekInfo.weekNum}: ${staffWithData}/${weekGroup.staffRows.length} staff have data`);
    });

    // Общая статистика
    const totalStaffRows = weeksData.reduce((sum, week) => sum + week.staffRows.length, 0);
    const weeksWithData = weeksData.filter(week => week.hasData).length;
    
    console.log('[useTimetableStaffRecordsData] *** NEW TIMETABLE STRATEGY PERFORMANCE SUMMARY ***');
    console.log('[useTimetableStaffRecordsData] Final processing summary:', {
      strategy: strategy,
      totalWeeks: weeksData.length,
      weeksWithData,
      totalStaffRows,
      averageStaffPerWeek: Math.round(totalStaffRows / (weeksData.length || 1)),
      totalRecordsProcessed: filteredRecords.length,
      dataQuality: weeksWithData > 1 ? 
        '🎉 EXCELLENT: Multi-week data achieved with new strategy!' : 
        '❌ STILL FAILED: Single week concentration - need to investigate server filtering',
      expectedImprovement: 'Should load all 477 records and distribute across 5 weeks'
    });

    setWeeksData(weeksData);

    // Проверяем если есть проблемы с данными
    if (filteredRecords.length === 0 && activeStaffMembers.length > 0) {
      console.warn('[useTimetableStaffRecordsData] Warning: No records found for any active staff members');
      setErrorStaffRecords('No schedule records found for active staff members in selected period');
    } else if (weeksWithData <= 1 && filteredRecords.length > 10) {
      console.warn('[useTimetableStaffRecordsData] Warning: Data concentration in single week despite using new strategy');
      setErrorStaffRecords('Data appears to be concentrated in single week. Check server-side filtering.');
    }
  };

  const loadTimetableData = useCallback(async (overrideDate?: Date): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    
    // *** СОЗДАЕМ УНИКАЛЬНЫЙ КЛЮЧ ЗАПРОСА ДЛЯ ПРОВЕРКИ ДУБЛИКАТОВ ***
    const requestKey = `${dateToUse.toISOString()}-${managingGroupId}-${currentUserId}-${staffMembers.length}-${weeks.length}`;
    
    console.log('[useTimetableStaffRecordsData] *** NEW TIMETABLE STRATEGY loadTimetableData CALLED ***');
    console.log('[useTimetableStaffRecordsData] Request key:', requestKey);
    console.log('[useTimetableStaffRecordsData] Last request key:', lastRequestParamsRef.current);
    console.log('[useTimetableStaffRecordsData] Is currently loading:', isLoadingRef.current);
    
    // *** ЗАЩИТА ОТ ДУБЛИРУЮЩИХ ЗАПРОСОВ ***
    if (isLoadingRef.current) {
      console.log('[useTimetableStaffRecordsData] 🛑 SKIPPING: Request already in progress');
      return;
    }
    
    if (lastRequestParamsRef.current === requestKey) {
      console.log('[useTimetableStaffRecordsData] 🛑 SKIPPING: Same request parameters as last time');
      return;
    }
    
    // *** ИСПРАВЛЕНИЕ RACE CONDITION: Используем функциональный подход ***
    let shouldProceed = false;
    
    // Атомарная проверка и установка состояния
    if (!isLoadingRef.current) {
      isLoadingRef.current = true;
      lastRequestParamsRef.current = requestKey;
      shouldProceed = true;
    }
    
    if (!shouldProceed) {
      console.log('[useTimetableStaffRecordsData] 🛑 SKIPPING: Already loading (atomic check)');
      return;
    }
    
    console.log('[useTimetableStaffRecordsData] ✅ PROCEEDING: New unique request with NEW TIMETABLE STRATEGY');

    if (!context || !staffRecordsService) {
      console.log('[useTimetableStaffRecordsData] Cannot load records: missing context or service');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Service not available.');
      isLoadingRef.current = false;
      return;
    }

    if (!managingGroupId || !currentUserId) {
      console.log('[useTimetableStaffRecordsData] Cannot load records: missing managingGroupId or currentUserId');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Group ID or User ID not available.');
      isLoadingRef.current = false;
      return;
    }

    if (weeks.length === 0) {
      console.log('[useTimetableStaffRecordsData] Cannot load records: no weeks calculated');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      isLoadingRef.current = false;
      return;
    }

    if (staffMembers.length === 0) {
      console.log('[useTimetableStaffRecordsData] No staff members in group');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      isLoadingRef.current = false;
      return;
    }

    try {
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);

      // Используем диапазон выбранного месяца
      const startDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1);
      const endDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth() + 1, 0);

      console.log('[useTimetableStaffRecordsData] Loading data for date range with NEW STRATEGY:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
        strategy: 'NEW TIMETABLE STRATEGY - loads ALL records without pagination'
      });

      // Фильтруем только активных сотрудников (не удаленных)
      const activeStaffMembers = staffMembers.filter(staffMember => {
        const isDeleted = staffMember.deleted === 1;
        const hasEmployeeId = staffMember.employeeId && staffMember.employeeId !== '0';
        
        if (isDeleted) {
          console.log(`[useTimetableStaffRecordsData] Excluding deleted staff: ${staffMember.name}`);
          return false;
        }
        
        if (!hasEmployeeId) {
          console.log(`[useTimetableStaffRecordsData] Excluding staff without employeeId: ${staffMember.name}`);
          return false;
        }
        
        return true;
      });

      console.log(`[useTimetableStaffRecordsData] Active staff members with employeeId: ${activeStaffMembers.length}/${staffMembers.length}`);

      if (activeStaffMembers.length === 0) {
        console.log('[useTimetableStaffRecordsData] No active staff members with employeeId found');
        setStaffRecords([]);
        setWeeksData([]);
        setIsLoadingStaffRecords(false);
        isLoadingRef.current = false;
        return;
      }

      // *** НОВАЯ СТРАТЕГИЯ: Всегда используем Timetable Strategy для загрузки ВСЕХ данных ***
      const loadingStrategy = 'NEW_TIMETABLE_STRATEGY';

      console.log('[useTimetableStaffRecordsData] *** LOADING STRATEGY SELECTION ***', {
        staffCount: activeStaffMembers.length,
        selectedStrategy: loadingStrategy,
        reasoning: `Using NEW Timetable Strategy - loads ALL records at once without pagination`,
        expectedBenefit: `Should load all records (expecting ~477) and distribute across all ${weeks.length} weeks`,
        previousProblem: 'Old strategy concentrated data in first week only',
        solution: 'New getAllStaffRecordsForTimetable method bypasses pagination completely'
      });

      let allRecords: IStaffRecord[] = [];

      // Всегда используем новую Timetable стратегию
      allRecords = await loadWithTimetableStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);

      console.log('[useTimetableStaffRecordsData] *** TIMETABLE STRATEGY EXECUTION COMPLETED ***', {
        recordsLoaded: allRecords.length,
        expectedRecords: '~477 for December',
        loadingMethod: 'getAllStaffRecordsForTimetable (bypasses pagination)',
        nextStep: 'Processing and distributing across weeks'
      });

      // Общая обработка результатов с диагностикой
      await processAndSetResults(allRecords, activeStaffMembers, weeks, loadingStrategy);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableStaffRecordsData] *** CRITICAL ERROR in NEW TIMETABLE STRATEGY ***:', error);
      setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
      setStaffRecords([]);
      setWeeksData([]);
    } finally {
      console.log('[useTimetableStaffRecordsData] *** SETTING LOADING STATE TO FALSE ***');
      setIsLoadingStaffRecords(false);
      
      // *** БЕЗОПАСНЫЙ СБРОС ФЛАГА ЗАГРУЗКИ ***
      setTimeout(() => {
        isLoadingRef.current = false;
      }, 0);
    }
  }, [
    context,
    staffRecordsService,
    selectedDate,
    currentUserId,
    managingGroupId,
    weeks,
    staffMembers,
    setStaffRecords,
    setWeeksData,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  ]);

  const refreshTimetableData = useCallback(async (): Promise<void> => {
    console.log('[useTimetableStaffRecordsData] Refreshing timetable data with NEW TIMETABLE STRATEGY');
    await loadTimetableData();
  }, [loadTimetableData]);

  // Эффект для автоматической загрузки данных при изменении ключевых параметров
  useEffect(() => {
    console.log('[useTimetableStaffRecordsData] *** useEffect TRIGGERED FOR NEW TIMETABLE STRATEGY ***');
    console.log('[useTimetableStaffRecordsData] Dependencies:', {
      hasContext: !!context,
      hasStaffRecordsService: !!staffRecordsService,
      hasManagingGroupId: !!managingGroupId,
      hasCurrentUserId: !!currentUserId,
      weeksCount: weeks.length,
      staffMembersCount: staffMembers.length,
      selectedDate: selectedDate.toISOString(),
      solution: 'NEW TIMETABLE STRATEGY with getAllStaffRecordsForTimetable - should fix week distribution'
    });
    
    // *** ЗАЩИТА ОТ МНОЖЕСТВЕННЫХ ЗАПРОСОВ ***
    const hasAllRequiredDeps = context && 
      staffRecordsService && 
      managingGroupId && 
      currentUserId &&
      weeks.length > 0 &&
      staffMembers.length > 0;

    if (!hasAllRequiredDeps) {
      console.log('[useTimetableStaffRecordsData] *** CLEARING DATA - missing dependencies ***');
      console.log('[useTimetableStaffRecordsData] Missing dependencies analysis:', {
        hasContext: !!context,
        hasStaffRecordsService: !!staffRecordsService,
        hasManagingGroupId: !!managingGroupId,
        hasCurrentUserId: !!currentUserId,
        weeksCount: weeks.length,
        staffMembersCount: staffMembers.length
      });
      
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
      return;
    }

    // *** DEBOUNCE: Задержка перед запросом для предотвращения частых вызовов ***
    console.log('[useTimetableStaffRecordsData] *** SETTING UP DEBOUNCED NEW TIMETABLE STRATEGY REQUEST ***');
    
    const timeoutId = setTimeout(() => {
      console.log('[useTimetableStaffRecordsData] *** DEBOUNCED NEW TIMETABLE STRATEGY REQUEST EXECUTING ***');
      console.log('[useTimetableStaffRecordsData] *** CALLING NEW TIMETABLE STRATEGY loadTimetableData from useEffect ***');
      
      loadTimetableData().catch(error => {
        console.error('[useTimetableStaffRecordsData] Error in useEffect NEW TIMETABLE STRATEGY loadTimetableData:', error);
      });
    }, 300); // 300ms задержка для группировки быстрых изменений

    // Cleanup функция для отмены предыдущих запросов
    return () => {
      console.log('[useTimetableStaffRecordsData] *** CLEANUP: Cancelling previous debounced NEW TIMETABLE STRATEGY request ***');
      clearTimeout(timeoutId);
    };
  }, [
    selectedDate.toISOString(), // Используем строку для стабильного сравнения
    weeks.length,
    staffMembers.length,
    managingGroupId,
    currentUserId,
    // НЕ включаем loadTimetableData в зависимости - это может вызвать бесконечные ререндеры
  ]);

  return {
    loadTimetableData,
    refreshTimetableData
  };
};