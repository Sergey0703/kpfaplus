// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsData.ts

import { useEffect, useCallback, useRef } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
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

  console.log('[useTimetableStaffRecordsData] Hook initialized with optimized batch loading:', {
    hasContext: !!context,
    hasStaffRecordsService: !!staffRecordsService,
    weeksCount: weeks.length,
    staffMembersCount: staffMembers.length,
    selectedDate: selectedDate.toISOString(),
    managingGroupId,
    currentUserId
  });

  const loadTimetableData = useCallback(async (overrideDate?: Date): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    
    // *** СОЗДАЕМ УНИКАЛЬНЫЙ КЛЮЧ ЗАПРОСА ДЛЯ ПРОВЕРКИ ДУБЛИКАТОВ ***
    const requestKey = `${dateToUse.toISOString()}-${managingGroupId}-${currentUserId}-${staffMembers.length}-${weeks.length}`;
    
    console.log('[useTimetableStaffRecordsData] *** OPTIMIZED loadTimetableData CALLED ***');
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
    
    console.log('[useTimetableStaffRecordsData] ✅ PROCEEDING: New unique request');
    console.log('[useTimetableStaffRecordsData] Using SINGLE BATCH REQUEST instead of individual requests');
    console.log('[useTimetableStaffRecordsData] Parameters:', {
      date: dateToUse.toISOString(),
      weeksCount: weeks.length,
      staffMembersCount: staffMembers.length,
      managingGroupId,
      currentUserId
    });

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

      // Логируем информацию о сотрудниках для отладки
      console.log('[useTimetableStaffRecordsData] Staff members to process:');
      activeStaffMembers.slice(0, 5).forEach((staff, index) => {
        console.log(`[useTimetableStaffRecordsData] Staff ${index + 1}:`, {
          name: staff.name,
          id: staff.id,
          employeeId: staff.employeeId,
          employeeIdType: typeof staff.employeeId
        });
      });

      // *** НОВЫЙ ОПТИМИЗИРОВАННЫЙ ПОДХОД: ОДИН ЗАПРОС НА ВСЮ ГРУППУ ***
      console.log(`[useTimetableStaffRecordsData] *** MAKING SINGLE BATCH REQUEST FOR ENTIRE GROUP ***`);
      console.log(`[useTimetableStaffRecordsData] Previous approach: ${activeStaffMembers.length} individual requests`);
      console.log(`[useTimetableStaffRecordsData] New approach: 1 batch request + client-side filtering`);

      // Подготавливаем один запрос для всей группы (БЕЗ employeeID фильтра)
      const batchQueryParams: IStaffRecordsQueryParams = {
        startDate: startDate,
        endDate: endDate,
        currentUserID: currentUserId,           // *** ФИЛЬТР ПО МЕНЕДЖЕРУ ***
        staffGroupID: managingGroupId,          // *** ФИЛЬТР ПО ГРУППЕ ***
        employeeID: '',                         // *** УБИРАЕМ ФИЛЬТР ПО СОТРУДНИКУ - ПУСТАЯ СТРОКА ***
        timeTableID: undefined,                 // Не фильтруем по контракту
        skip: 0,
        top: 10000 // Увеличиваем лимит для всех сотрудников группы
      };

      console.log('[useTimetableStaffRecordsData] Batch query params:', batchQueryParams);
      
      const startTime = performance.now();

      // Делаем ОДИН запрос для всей группы
      const batchResult: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(batchQueryParams);

      const loadTime = performance.now() - startTime;

      console.log('[useTimetableStaffRecordsData] *** BATCH REQUEST COMPLETED ***');
      console.log('[useTimetableStaffRecordsData] Batch result:', {
        recordsCount: batchResult.records.length,
        totalCount: batchResult.totalCount,
        loadTimeMs: Math.round(loadTime),
        hasError: !!batchResult.error,
        estimatedSpeedupVsIndividual: `${activeStaffMembers.length}x faster (${activeStaffMembers.length} requests → 1 request)`
      });

      if (batchResult.error) {
        throw new Error(`Batch request failed: ${batchResult.error}`);
      }

      // *** КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ПО СОТРУДНИКАМ ***
      console.log('[useTimetableStaffRecordsData] *** PERFORMING CLIENT-SIDE FILTERING ***');

      // Создаем Set с employeeId активных сотрудников для быстрой фильтрации
      const activeEmployeeIds = new Set(
        activeStaffMembers
          .map(staff => staff.employeeId?.toString())
          .filter(id => id && id !== '0')
      );

      console.log('[useTimetableStaffRecordsData] Active employee IDs for filtering:', Array.from(activeEmployeeIds));

      // *** ДЕТАЛЬНАЯ ДИАГНОСТИКА ВХОДЯЩИХ ДАННЫХ ***
      console.log('[useTimetableStaffRecordsData] *** DETAILED DATA ANALYSIS BEFORE FILTERING ***');
      
      // Анализируем все полученные записи
      const recordsByStaffId: Record<string, number> = {};
      const recordsByDate: Record<string, number> = {};
      const uniqueStaffIdsInRecords = new Set<string>();
      
      batchResult.records.forEach(record => {
        const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
        const dateStr = record.Date.toLocaleDateString();
        
        recordsByStaffId[staffId] = (recordsByStaffId[staffId] || 0) + 1;
        recordsByDate[dateStr] = (recordsByDate[dateStr] || 0) + 1;
        uniqueStaffIdsInRecords.add(staffId);
      });

      console.log('[useTimetableStaffRecordsData] Raw data analysis:', {
        totalRecordsFromServer: batchResult.records.length,
        uniqueStaffIdsInRecords: uniqueStaffIdsInRecords.size,
        staffIdsInRecords: Array.from(uniqueStaffIdsInRecords),
        activeStaffCount: activeStaffMembers.length,
        activeEmployeeIds: Array.from(activeEmployeeIds),
        recordsDistributionByStaff: recordsByStaffId,
        recordsDistributionByDate: Object.keys(recordsByDate).length > 10 ? 
          `${Object.keys(recordsByDate).length} unique dates` : 
          recordsByDate
      });

      // *** АНАЛИЗ СОВПАДЕНИЙ ***
      const matchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => activeEmployeeIds.has(id));
      const nonMatchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => !activeEmployeeIds.has(id));
      
      console.log('[useTimetableStaffRecordsData] Staff ID matching analysis:', {
        matchingStaffIds: matchingStaffIds,
        nonMatchingStaffIds: nonMatchingStaffIds.slice(0, 10), // Показываем только первые 10
        matchingCount: matchingStaffIds.length,
        nonMatchingCount: nonMatchingStaffIds.length,
        potentialIssue: nonMatchingStaffIds.length > matchingStaffIds.length ? 
          'More non-matching than matching IDs - check ID format consistency' : 
          'Normal'
      });

      // Фильтруем полученные записи по нашим активным сотрудникам
      const filteredRecords = batchResult.records.filter(record => {
        const recordStaffMemberId = record.StaffMemberLookupId?.toString();
        const shouldInclude = recordStaffMemberId && activeEmployeeIds.has(recordStaffMemberId);
        
        // Логи фильтрации убраны для сокращения объема
        
        return shouldInclude;
      });

      console.log('[useTimetableStaffRecordsData] *** CLIENT-SIDE FILTERING COMPLETED ***');
      console.log('[useTimetableStaffRecordsData] Filtering results:', {
        totalRecordsFromServer: batchResult.records.length,
        filteredRecordsForOurStaff: filteredRecords.length,
        filteringEfficiency: `${Math.round((filteredRecords.length / batchResult.records.length) * 100)}% records matched our staff`,
        activeStaffCount: activeStaffMembers.length
      });

      // Анализируем полученные отфильтрованные записи
      if (filteredRecords.length > 0) {
        const dateRange = {
          start: Math.min(...filteredRecords.map(r => r.Date.getTime())),
          end: Math.max(...filteredRecords.map(r => r.Date.getTime()))
        };
        
        console.log(`[useTimetableStaffRecordsData] *** FILTERED RECORDS ANALYSIS ***`);
        console.log(`[useTimetableStaffRecordsData] Filtered records date range:`, {
          firstRecordDate: new Date(dateRange.start).toLocaleDateString(),
          lastRecordDate: new Date(dateRange.end).toLocaleDateString(),
          totalRecords: filteredRecords.length,
          requestedRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        });

        // *** КРИТИЧНО: Анализируем распределение записей по неделям ***
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

        console.log('[useTimetableStaffRecordsData] *** RECORDS DISTRIBUTION BY WEEKS ***', {
          weeklyDistribution: recordsByWeek,
          totalWeeks: weeks.length,
          weeksWithData: Object.keys(recordsByWeek).length,
          avgRecordsPerWeek: Math.round(filteredRecords.length / Object.keys(recordsByWeek).length),
          potentialIssue: Object.keys(recordsByWeek).length === 1 ? 
            'WARNING: All records in single week - possible date filtering issue' : 
            'Normal distribution'
        });

        // Показываем распределение по сотрудникам и неделям (первые несколько для отладки)
        // Логи отладки убраны для сокращения объема

        // Анализируем распределение записей по сотрудникам
        const recordsByStaff: Record<string, number> = {};
        filteredRecords.forEach(record => {
          const key = record.StaffMemberLookupId?.toString() || 'Unknown';
          recordsByStaff[key] = (recordsByStaff[key] || 0) + 1;
        });
        
        console.log('[useTimetableStaffRecordsData] Records distribution by staff:', recordsByStaff);

        // Проверяем покрытие сотрудников
        const staffWithRecords = Object.keys(recordsByStaff).length;
        const staffWithoutRecords = activeStaffMembers.filter(staff => 
          !recordsByStaff[staff.employeeId?.toString() || '']
        );

        console.log('[useTimetableStaffRecordsData] Staff coverage analysis:', {
          totalActiveStaff: activeStaffMembers.length,
          staffWithRecords: staffWithRecords,
          staffWithoutRecords: staffWithoutRecords.length,
          coveragePercentage: Math.round((staffWithRecords / activeStaffMembers.length) * 100) + '%'
        });

        if (staffWithoutRecords.length > 0) {
          console.log('[useTimetableStaffRecordsData] Staff without records:', 
            staffWithoutRecords.slice(0, 3).map(s => ({ name: s.name, employeeId: s.employeeId }))
          );
        }

        // *** ДОПОЛНИТЕЛЬНАЯ ОТЛАДКА: Анализируем структуру записей ***
        console.log('[useTimetableStaffRecordsData] *** FILTERED RECORDS STRUCTURE ANALYSIS ***');
        if (filteredRecords.length > 0) {
          const sampleRecord = filteredRecords[0];
          console.log('[useTimetableStaffRecordsData] Sample filtered record structure:', {
            ID: sampleRecord.ID,
            Date: sampleRecord.Date,
            StaffMemberLookupId: sampleRecord.StaffMemberLookupId,
            WeeklyTimeTableID: sampleRecord.WeeklyTimeTableID,
            Title: sampleRecord.Title,
            ShiftDate1: sampleRecord.ShiftDate1,
            ShiftDate2: sampleRecord.ShiftDate2,
            allFields: Object.keys(sampleRecord)
          });
        }
      }

      // Сохраняем отфильтрованные записи
      console.log('[useTimetableStaffRecordsData] *** SETTING FILTERED STAFF RECORDS IN STATE ***');
      console.log('[useTimetableStaffRecordsData] Setting staff records count:', filteredRecords.length);
      setStaffRecords(filteredRecords);

      // *** ДОБАВЛЯЕМ ОТЛАДКУ ПЕРЕД ВЫЗОВОМ ПРОЦЕССОРА ***
      console.log('[useTimetableStaffRecordsData] *** CALLING TimetableDataProcessor.processDataByWeeks ***');
      console.log('[useTimetableStaffRecordsData] Passing to processor:', {
        staffRecords: filteredRecords.length,
        staffMembers: activeStaffMembers.length,
        weeks: weeks.length,
        currentUserId: currentUserId,
        managingGroupId: managingGroupId,
        optimizationNote: 'Data loaded with single batch request + client filtering',
        firstFewRecords: filteredRecords.slice(0, 2).map(r => ({
          ID: r.ID,
          Date: r.Date?.toLocaleDateString(),
          StaffMemberLookupId: r.StaffMemberLookupId,
          WeeklyTimeTableID: r.WeeklyTimeTableID
        })),
        firstFewStaffMembers: activeStaffMembers.slice(0, 2).map(s => ({
          name: s.name,
          employeeId: s.employeeId
        }))
      });

      // Обрабатываем данные в структуру групп недель
      const weeksData = TimetableDataProcessor.processDataByWeeks({
        staffRecords: filteredRecords,
        staffMembers: activeStaffMembers, // Используем только активных сотрудников
        weeks: weeks,
        // Оставляем параметры для совместимости и логирования
        currentUserId: currentUserId,
        managingGroupId: managingGroupId
      });

      console.log(`[useTimetableStaffRecordsData] *** PROCESSOR COMPLETED ***`);
      console.log(`[useTimetableStaffRecordsData] Processed ${weeksData.length} week groups`);
      
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
      
      console.log('[useTimetableStaffRecordsData] *** OPTIMIZATION PERFORMANCE SUMMARY ***');
      console.log('[useTimetableStaffRecordsData] Final processing summary:', {
        totalWeeks: weeksData.length,
        weeksWithData,
        totalStaffRows,
        averageStaffPerWeek: Math.round(totalStaffRows / (weeksData.length || 1)),
        totalRecordsProcessed: filteredRecords.length,
        
        // Показатели оптимизации
        optimizationResults: {
          oldApproach: `${activeStaffMembers.length} individual HTTP requests`,
          newApproach: '1 batch HTTP request + client filtering',
          networkRequestsReduced: `${activeStaffMembers.length}x fewer requests`,
          estimatedTimeImprovement: `${Math.round(loadTime)}ms for all data vs ~${Math.round(loadTime * activeStaffMembers.length)}ms for individual requests`,
          dataEfficiency: `${Math.round((filteredRecords.length / batchResult.records.length) * 100)}% of server data was relevant`
        }
      });

      console.log('[useTimetableStaffRecordsData] *** SETTING OPTIMIZED WEEKS DATA IN STATE ***');
      setWeeksData(weeksData);

      // Проверяем если есть проблемы с данными
      if (filteredRecords.length === 0 && activeStaffMembers.length > 0) {
        console.warn('[useTimetableStaffRecordsData] Warning: No records found for any active staff members');
        setErrorStaffRecords('No schedule records found for active staff members in selected period');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableStaffRecordsData] *** CRITICAL ERROR in optimized batch loading ***:', error);
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
    console.log('[useTimetableStaffRecordsData] Refreshing timetable data with optimized batch loading');
    await loadTimetableData();
  }, [loadTimetableData]);

  // Эффект для автоматической загрузки данных при изменении ключевых параметров
  useEffect(() => {
    console.log('[useTimetableStaffRecordsData] *** useEffect TRIGGERED FOR OPTIMIZED LOADING ***');
    console.log('[useTimetableStaffRecordsData] Dependencies:', {
      hasContext: !!context,
      hasStaffRecordsService: !!staffRecordsService,
      hasManagingGroupId: !!managingGroupId,
      hasCurrentUserId: !!currentUserId,
      weeksCount: weeks.length,
      staffMembersCount: staffMembers.length,
      selectedDate: selectedDate.toISOString(),
      optimizationNote: 'Will use single batch request instead of individual requests'
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
    console.log('[useTimetableStaffRecordsData] *** SETTING UP DEBOUNCED REQUEST ***');
    
    const timeoutId = setTimeout(() => {
      console.log('[useTimetableStaffRecordsData] *** DEBOUNCED REQUEST EXECUTING ***');
      console.log('[useTimetableStaffRecordsData] *** CALLING OPTIMIZED loadTimetableData from useEffect ***');
      
      loadTimetableData().catch(error => {
        console.error('[useTimetableStaffRecordsData] Error in useEffect optimized loadTimetableData:', error);
      });
    }, 300); // 300ms задержка для группировки быстрых изменений

    // Cleanup функция для отмены предыдущих запросов
    return () => {
      console.log('[useTimetableStaffRecordsData] *** CLEANUP: Cancelling previous debounced request ***');
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