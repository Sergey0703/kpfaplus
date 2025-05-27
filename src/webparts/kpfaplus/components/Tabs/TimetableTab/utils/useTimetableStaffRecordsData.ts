// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsData.ts

import { useEffect, useCallback, useRef } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { /* IStaffRecordsResult, */ IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
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

  console.log('[useTimetableStaffRecordsData] Hook initialized with DIAGNOSTIC SOLUTION:', {
    hasContext: !!context,
    hasStaffRecordsService: !!staffRecordsService,
    weeksCount: weeks.length,
    staffMembersCount: staffMembers.length,
    selectedDate: selectedDate.toISOString(),
    managingGroupId,
    currentUserId
  });

  // *** КОНСТАНТЫ ДЛЯ ПАГИНАЦИИ ***
  const LARGE_GROUP_THRESHOLD = 8; // Если сотрудников больше 8, используем пагинацию
  const PAGINATION_PAGE_SIZE = 5000; // Размер страницы для пагинации
  const MAX_PAGES = 25; // Максимальное количество страниц для безопасности
  const SMALL_GROUP_BATCH_SIZE = 20000; // Размер батча для маленьких групп

  /**
   * Загрузка данных с использованием одного батчевого запроса (для маленьких групп)
   */
  const loadWithBatchStrategy = async (
    startDate: Date, 
    endDate: Date, 
    currentUserId: string, 
    managingGroupId: string, 
    staffRecordsService: StaffRecordsService
  ): Promise<IStaffRecord[]> => {
    console.log('[useTimetableStaffRecordsData] *** EXECUTING BATCH STRATEGY ***');
    
    const batchQueryParams: IStaffRecordsQueryParams = {
      startDate,
      endDate,
      currentUserID: currentUserId,
      staffGroupID: managingGroupId,
      employeeID: '', // Пустая строка = без фильтра по сотруднику
      timeTableID: undefined,
      skip: 0,
      top: SMALL_GROUP_BATCH_SIZE
    };

    console.log('[useTimetableStaffRecordsData] Batch query params:', batchQueryParams);

    const startTime = performance.now();
    const batchResult = await staffRecordsService.getStaffRecordsWithOptions(batchQueryParams);
    const loadTime = performance.now() - startTime;

    console.log('[useTimetableStaffRecordsData] Batch result:', {
      recordsCount: batchResult.records.length,
      totalCount: batchResult.totalCount,
      loadTimeMs: Math.round(loadTime),
      hasError: !!batchResult.error,
      isDataComplete: batchResult.records.length >= batchResult.totalCount,
      potentialDataLoss: batchResult.totalCount > batchResult.records.length ? 
        `WARNING: ${batchResult.totalCount - batchResult.records.length} records may be missing` : 
        'All data received'
    });

    if (batchResult.error) {
      throw new Error(`Batch request failed: ${batchResult.error}`);
    }

    // *** КРИТИЧЕСКАЯ ПРОВЕРКА: Если данные неполные, переключаемся на пагинацию ***
    if (batchResult.records.length < batchResult.totalCount) {
      console.error('[useTimetableStaffRecordsData] 🚨 BATCH STRATEGY INCOMPLETE DATA DETECTED!');
      console.error('[useTimetableStaffRecordsData] Falling back to pagination strategy...');
      
      // Переключаемся на пагинированную загрузку
      return await loadWithPaginatedStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);
    }

    return batchResult.records;
  };

  /**
   * Загрузка данных с использованием пагинации (для больших групп)
   */
  const loadWithPaginatedStrategy = async (
    startDate: Date, 
    endDate: Date, 
    currentUserId: string, 
    managingGroupId: string, 
    staffRecordsService: StaffRecordsService
  ): Promise<IStaffRecord[]> => {
    console.log('[useTimetableStaffRecordsData] *** EXECUTING PAGINATED STRATEGY ***');
    
    let allRecords: IStaffRecord[] = [];
    let skip = 0;
    let hasMoreData = true;
    let pageCount = 0;
    let totalCountFromServer = 0;

    while (hasMoreData && pageCount < MAX_PAGES) {
      pageCount++;
      console.log(`[useTimetableStaffRecordsData] Loading page ${pageCount}/${MAX_PAGES}, skip: ${skip}`);

      const pageQueryParams: IStaffRecordsQueryParams = {
        startDate,
        endDate,
        currentUserID: currentUserId,
        staffGroupID: managingGroupId,
        employeeID: '', // Пустая строка = без фильтра по сотруднику
        timeTableID: undefined,
        skip: skip,
        top: PAGINATION_PAGE_SIZE
      };

      const startTime = performance.now();
      const pageResult = await staffRecordsService.getStaffRecordsWithOptions(pageQueryParams);
      const loadTime = performance.now() - startTime;

      if (pageResult.error) {
        throw new Error(`Paginated request failed on page ${pageCount}: ${pageResult.error}`);
      }

      // Сохраняем общее количество с сервера
      if (pageCount === 1) {
        totalCountFromServer = pageResult.totalCount;
      }

      console.log(`[useTimetableStaffRecordsData] Page ${pageCount} result:`, {
        recordsOnPage: pageResult.records.length,
        loadTimeMs: Math.round(loadTime),
        totalFromServer: pageResult.totalCount,
        currentTotal: allRecords.length + pageResult.records.length,
        progress: `${Math.round(((allRecords.length + pageResult.records.length) / pageResult.totalCount) * 100)}%`
      });

      // Добавляем записи со страницы
      allRecords = allRecords.concat(pageResult.records);

      // Проверяем, есть ли еще данные
      if (pageResult.records.length < PAGINATION_PAGE_SIZE || 
          allRecords.length >= pageResult.totalCount) {
        hasMoreData = false;
        console.log(`[useTimetableStaffRecordsData] Pagination complete at page ${pageCount}. Total records: ${allRecords.length}`);
      } else {
        skip += PAGINATION_PAGE_SIZE;
      }
    }

    if (pageCount >= MAX_PAGES) {
      console.warn(`[useTimetableStaffRecordsData] ⚠️ Pagination stopped at ${MAX_PAGES} pages limit`);
      console.warn(`[useTimetableStaffRecordsData] Loaded ${allRecords.length}/${totalCountFromServer} records`);
    }

    console.log('[useTimetableStaffRecordsData] *** PAGINATED STRATEGY COMPLETED ***', {
      totalPages: pageCount,
      totalRecords: allRecords.length,
      serverTotalCount: totalCountFromServer,
      averageRecordsPerPage: Math.round(allRecords.length / pageCount),
      dataCompleteness: `${Math.round((allRecords.length / totalCountFromServer) * 100)}%`,
      isComplete: allRecords.length >= totalCountFromServer
    });

    return allRecords;
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

    // *** ДЕТАЛЬНАЯ ДИАГНОСТИКА ВХОДЯЩИХ ДАННЫХ ***
    console.log('[useTimetableStaffRecordsData] *** RAW DATA ANALYSIS ***');
    
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

    console.log('[useTimetableStaffRecordsData] Raw data analysis:', {
      totalRecordsFromServer: allRecords.length,
      uniqueStaffIdsInRecords: uniqueStaffIdsInRecords.size,
      staffIdsInRecords: Array.from(uniqueStaffIdsInRecords).slice(0, 10), // Показываем первые 10
      activeStaffCount: activeStaffMembers.length,
      activeEmployeeIds: Array.from(activeEmployeeIds),
      uniqueDatesCount: Object.keys(recordsByDate).length,
      dateRange: Object.keys(recordsByDate).length > 0 ? 
        `${Math.min(...Object.keys(recordsByDate).map(d => new Date(d).getTime()))} - ${Math.max(...Object.keys(recordsByDate).map(d => new Date(d).getTime()))}` : 'No dates'
    });

    // *** КРИТИЧЕСКАЯ ДИАГНОСТИКА: Проверяем даты записей ***
    console.log('[useTimetableStaffRecordsData] *** CRITICAL DATE ANALYSIS ***');

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

    console.log('[useTimetableStaffRecordsData] Date distribution analysis:', {
      totalUniqueDates: sortedDates.length,
      dateRange: sortedDates.length > 0 ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` : 'No dates',
      monthYearDistribution: monthYearAnalysis,
      first10Dates: sortedDates.slice(0, 10).map(date => ({
        date,
        count: dateAnalysis[date].count,
        sampleRecordId: dateAnalysis[date].recordIds[0]
      })),
      last10Dates: sortedDates.slice(-10).map(date => ({
        date,
        count: dateAnalysis[date].count,
        sampleRecordId: dateAnalysis[date].recordIds[0]
      }))
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
      issue: recordsOutsideRange.length > 0 ? 'PROBLEM: Records outside requested range detected!' : 'OK: All records in range'
    });

    if (recordsOutsideRange.length > 0) {
      console.error('[useTimetableStaffRecordsData] 🚨 RECORDS OUTSIDE RANGE DETECTED:', {
        count: recordsOutsideRange.length,
        examples: recordsOutsideRange.slice(0, 5).map(record => ({
          id: record.ID,
          date: record.Date.toLocaleDateString('en-GB'),
          isoDate: record.Date.toISOString(),
          staffId: record.StaffMemberLookupId
        })),
        possibleCauses: [
          'Server filtering not working correctly',
          'Wrong date format in filter',
          'Timezone issues',
          'Server returning cached/old data'
        ]
      });
    }

    // *** ПРОВЕРЯЕМ КОНКРЕТНО ПЕРВУЮ НЕДЕЛЮ ***
    const firstWeek = weeks[0];
    if (firstWeek) {
      const firstWeekRecords = allRecords.filter(record => {
        const recordDate = new Date(record.Date);
        return recordDate >= firstWeek.weekStart && recordDate <= firstWeek.weekEnd;
      });
      
      const otherWeeksRecords = allRecords.filter(record => {
        const recordDate = new Date(record.Date);
        return weeks.slice(1).some(week => 
          recordDate >= week.weekStart && recordDate <= week.weekEnd
        );
      });
      
      console.log('[useTimetableStaffRecordsData] *** FIRST WEEK vs OTHER WEEKS ANALYSIS ***');
      console.log('[useTimetableStaffRecordsData] Week distribution:', {
        firstWeekRecords: firstWeekRecords.length,
        otherWeeksRecords: otherWeeksRecords.length,
        firstWeekPercentage: Math.round((firstWeekRecords.length / allRecords.length) * 100) + '%',
        
        firstWeekRange: `${firstWeek.weekStart.toLocaleDateString('en-GB')} - ${firstWeek.weekEnd.toLocaleDateString('en-GB')}`,
        
        // Анализируем даты в первой неделе
        firstWeekDates: Array.from(new Set(firstWeekRecords.map(r => r.Date.toLocaleDateString('en-GB')))).sort(),
        
        // Анализируем даты в других неделях
        otherWeeksDates: Array.from(new Set(otherWeeksRecords.map(r => r.Date.toLocaleDateString('en-GB')))).sort(),
        
        // Проблемные индикаторы
        issues: {
          firstWeekDominant: firstWeekRecords.length > (allRecords.length * 0.8) ? 
            '🚨 CRITICAL: >80% records in first week!' : 'Normal',
          noOtherWeeksData: otherWeeksRecords.length === 0 ? 
            '🚨 CRITICAL: No records in other weeks!' : 'Normal',
          possibleCause: firstWeekRecords.length > (allRecords.length * 0.8) ? 
            'Server likely returning only recent data or filtering incorrectly' : 'Data distribution looks normal'
        }
      });

      // *** ДЕТАЛЬНЫЙ АНАЛИЗ ДНЕЙ ПЕРВОЙ НЕДЕЛИ ***
      if (firstWeekRecords.length > 0) {
        const firstWeekDayDistribution: Record<string, number> = {};
        firstWeekRecords.forEach(record => {
          const dayStr = record.Date.toLocaleDateString('en-GB');
          firstWeekDayDistribution[dayStr] = (firstWeekDayDistribution[dayStr] || 0) + 1;
        });

        console.log('[useTimetableStaffRecordsData] First week daily distribution:', firstWeekDayDistribution);
        console.log('[useTimetableStaffRecordsData] First week staff distribution:', {
          uniqueStaffInFirstWeek: Array.from(new Set(firstWeekRecords.map(r => r.StaffMemberLookupId))).length,
          staffRecordCounts: firstWeekRecords.reduce((acc, record) => {
            const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
            acc[staffId] = (acc[staffId] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        });
      }
    }

    // *** АНАЛИЗ СОВПАДЕНИЙ ***
    const matchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => activeEmployeeIds.has(id));
    const nonMatchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => !activeEmployeeIds.has(id));
    
    console.log('[useTimetableStaffRecordsData] Staff ID matching analysis:', {
      matchingStaffIds: matchingStaffIds,
      nonMatchingStaffIds: nonMatchingStaffIds.slice(0, 5), // Показываем только первые 5
      matchingCount: matchingStaffIds.length,
      nonMatchingCount: nonMatchingStaffIds.length,
      potentialIssue: nonMatchingStaffIds.length > matchingStaffIds.length ? 
        'More non-matching than matching IDs - check ID format consistency' : 
        'Normal'
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
      activeStaffCount: activeStaffMembers.length
    });

    // *** КРИТИЧЕСКАЯ ПРОВЕРКА РАСПРЕДЕЛЕНИЯ ПО НЕДЕЛЯМ (ПОСЛЕ ФИЛЬТРАЦИИ) ***
    const recordsByWeek: Record<number, number> = {};
    const recordsByWeekAndStaff: Record<string, Record<number, number>> = {};
    
    filteredRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      
      // Находим неделю для этой записи
      const matchingWeek = weeks.find(week => 
        TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
      );
      
      if (matchingWeek) {
        recordsByWeek[matchingWeek.weekNum] = (recordsByWeek[matchingWeek.weekNum] || 0) + 1;
        
        if (!recordsByWeekAndStaff[staffId]) {
          recordsByWeekAndStaff[staffId] = {};
        }
        recordsByWeekAndStaff[staffId][matchingWeek.weekNum] = 
          (recordsByWeekAndStaff[staffId][matchingWeek.weekNum] || 0) + 1;
      } else {
        console.warn(`[useTimetableStaffRecordsData] ⚠️ Record ${record.ID} (${recordDate.toLocaleDateString()}) does not match any calculated week!`);
      }
    });

    console.log('[useTimetableStaffRecordsData] *** RECORDS DISTRIBUTION BY WEEKS (AFTER FILTERING) ***', {
      weeklyDistribution: recordsByWeek,
      totalWeeks: weeks.length,
      weeksWithData: Object.keys(recordsByWeek).length,
      avgRecordsPerWeek: Object.keys(recordsByWeek).length > 0 ? 
        Math.round(filteredRecords.length / Object.keys(recordsByWeek).length) : 0,
      dataBalance: Object.keys(recordsByWeek).length > 1 ? 
        'GOOD: Data distributed across multiple weeks' : 
        'WARNING: Data concentrated in single week',
      isFirstWeekDominant: recordsByWeek[1] && recordsByWeek[1] > (filteredRecords.length * 0.8) ? 
        'WARNING: >80% records in week 1 - may indicate pagination issue' : 
        'Normal distribution'
    });

    // *** ФИНАЛЬНАЯ ДИАГНОСТИКА: ОПРЕДЕЛЯЕМ КОРЕНЬ ПРОБЛЕМЫ ***
    if (Object.keys(recordsByWeek).length === 1 && recordsByWeek[1]) {
      console.error('[useTimetableStaffRecordsData] 🚨🚨🚨 ROOT CAUSE IDENTIFIED 🚨🚨🚨');
      console.error('[useTimetableStaffRecordsData] PROBLEM: All filtered records are in Week 1 only');
      console.error('[useTimetableStaffRecordsData] Likely causes ranked by probability:');
      console.error('[useTimetableStaffRecordsData] 1. SERVER FILTER PROBLEM: Date filter on server not working correctly');
      console.error('[useTimetableStaffRecordsData] 2. DATA PROBLEM: No actual data exists for other weeks in database');
      console.error('[useTimetableStaffRecordsData] 3. TIMEZONE PROBLEM: Server using different timezone than client');
      console.error('[useTimetableStaffRecordsData] 4. CACHE PROBLEM: Server returning cached old data');
      
      console.error('[useTimetableStaffRecordsData] RECOMMENDED ACTIONS:');
      console.error('[useTimetableStaffRecordsData] 1. Check server-side date filtering in StaffRecordsFetchService');
      console.error('[useTimetableStaffRecordsData] 2. Verify actual data exists in SharePoint for other weeks');
      console.error('[useTimetableStaffRecordsData] 3. Check timezone handling in date formatting');
      console.error('[useTimetableStaffRecordsData] 4. Clear server/SharePoint cache');
    }

    // Проверяем распределение по сотрудникам
    const staffWithRecords = Object.keys(recordsByWeekAndStaff).length;
    const staffWithoutRecords = activeStaffMembers.filter(staff => 
      !recordsByWeekAndStaff[staff.employeeId?.toString() || '']
    );

    console.log('[useTimetableStaffRecordsData] Staff coverage analysis:', {
      totalActiveStaff: activeStaffMembers.length,
      staffWithRecords: staffWithRecords,
      staffWithoutRecords: staffWithoutRecords.length,
      coveragePercentage: Math.round((staffWithRecords / activeStaffMembers.length) * 100) + '%',
      staffWithoutRecordsNames: staffWithoutRecords.slice(0, 3).map(s => s.name)
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
    
    console.log('[useTimetableStaffRecordsData] *** STRATEGY PERFORMANCE SUMMARY ***');
    console.log('[useTimetableStaffRecordsData] Final processing summary:', {
      strategy: strategy,
      totalWeeks: weeksData.length,
      weeksWithData,
      totalStaffRows,
      averageStaffPerWeek: Math.round(totalStaffRows / (weeksData.length || 1)),
      totalRecordsProcessed: filteredRecords.length,
      dataQuality: weeksWithData > 1 ? 'GOOD: Multi-week data' : 'POOR: Single week data'
    });

    setWeeksData(weeksData);

    // Проверяем если есть проблемы с данными
    if (filteredRecords.length === 0 && activeStaffMembers.length > 0) {
      console.warn('[useTimetableStaffRecordsData] Warning: No records found for any active staff members');
      setErrorStaffRecords('No schedule records found for active staff members in selected period');
    }
  };

  const loadTimetableData = useCallback(async (overrideDate?: Date): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    
    // *** СОЗДАЕМ УНИКАЛЬНЫЙ КЛЮЧ ЗАПРОСА ДЛЯ ПРОВЕРКИ ДУБЛИКАТОВ ***
    const requestKey = `${dateToUse.toISOString()}-${managingGroupId}-${currentUserId}-${staffMembers.length}-${weeks.length}`;
    
    console.log('[useTimetableStaffRecordsData] *** DIAGNOSTIC SOLUTION loadTimetableData CALLED ***');
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
    
    // Помечаем что запрос начался
    isLoadingRef.current = true;
    lastRequestParamsRef.current = requestKey;
    
    console.log('[useTimetableStaffRecordsData] ✅ PROCEEDING: New unique request with DIAGNOSTIC SOLUTION');

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

      console.log('[useTimetableStaffRecordsData] Loading data for date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
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

      // *** ВЫБОР СТРАТЕГИИ ЗАГРУЗКИ ***
      let loadingStrategy: 'batch' | 'paginated';
      
      if (activeStaffMembers.length <= LARGE_GROUP_THRESHOLD) {
        loadingStrategy = 'batch';
      } else {
        loadingStrategy = 'paginated';
      }

      console.log('[useTimetableStaffRecordsData] *** LOADING STRATEGY SELECTION ***', {
        staffCount: activeStaffMembers.length,
        threshold: LARGE_GROUP_THRESHOLD,
        selectedStrategy: loadingStrategy,
        reasoning: loadingStrategy === 'batch' ? 
          `Small group (${activeStaffMembers.length} ≤ ${LARGE_GROUP_THRESHOLD}) - using single batch request` : 
          `Large group (${activeStaffMembers.length} > ${LARGE_GROUP_THRESHOLD}) - using paginated requests`
      });

      let allRecords: IStaffRecord[] = [];

      switch (loadingStrategy) {
        case 'batch':
          allRecords = await loadWithBatchStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);
          break;
        
        case 'paginated':
          allRecords = await loadWithPaginatedStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);
          break;
      }

      // Общая обработка результатов с диагностикой
      await processAndSetResults(allRecords, activeStaffMembers, weeks, loadingStrategy);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableStaffRecordsData] *** CRITICAL ERROR in diagnostic solution ***:', error);
      setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
      setStaffRecords([]);
      setWeeksData([]);
    } finally {
      console.log('[useTimetableStaffRecordsData] *** SETTING LOADING STATE TO FALSE ***');
      setIsLoadingStaffRecords(false);
      
      // *** СБРАСЫВАЕМ ФЛАГ ЗАГРУЗКИ ***
      isLoadingRef.current = false;
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
    console.log('[useTimetableStaffRecordsData] Refreshing timetable data with diagnostic solution');
    await loadTimetableData();
  }, [loadTimetableData]);

  // Эффект для автоматической загрузки данных при изменении ключевых параметров
  useEffect(() => {
    console.log('[useTimetableStaffRecordsData] *** useEffect TRIGGERED FOR DIAGNOSTIC SOLUTION ***');
    console.log('[useTimetableStaffRecordsData] Dependencies:', {
      hasContext: !!context,
      hasStaffRecordsService: !!staffRecordsService,
      hasManagingGroupId: !!managingGroupId,
      hasCurrentUserId: !!currentUserId,
      weeksCount: weeks.length,
      staffMembersCount: staffMembers.length,
      selectedDate: selectedDate.toISOString(),
      solution: 'DIAGNOSTIC with detailed logging and root cause analysis'
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
    console.log('[useTimetableStaffRecordsData] *** SETTING UP DEBOUNCED DIAGNOSTIC REQUEST ***');
    
    const timeoutId = setTimeout(() => {
      console.log('[useTimetableStaffRecordsData] *** DEBOUNCED DIAGNOSTIC REQUEST EXECUTING ***');
      console.log('[useTimetableStaffRecordsData] *** CALLING DIAGNOSTIC loadTimetableData from useEffect ***');
      
      loadTimetableData().catch(error => {
        console.error('[useTimetableStaffRecordsData] Error in useEffect diagnostic loadTimetableData:', error);
      });
    }, 300); // 300ms задержка для группировки быстрых изменений

    // Cleanup функция для отмены предыдущих запросов
    return () => {
      console.log('[useTimetableStaffRecordsData] *** CLEANUP: Cancelling previous debounced diagnostic request ***');
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