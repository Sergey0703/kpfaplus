// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsData.ts

import { useEffect, useCallback, useRef } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { 
  IWeekInfo, 
  IWeekGroup,
  IStaffMember
} from '../interfaces/TimetableInterfaces';
import { processAndSetResults } from './useTimetableStaffRecordsDataHelpers';

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

      // Общая обработка результатов с диагностикой - ВЫНЕСЕНО В ОТДЕЛЬНЫЙ ФАЙЛ
      await processAndSetResults(
        allRecords, 
        activeStaffMembers, 
        weeks, 
        loadingStrategy,
        selectedDate,
        setStaffRecords,
        setWeeksData
      );

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
    // НЕ включаем loadTimetableData в зависимость - это может вызвать бесконечные ререндеры
  ]);

  return {
    loadTimetableData,
    refreshTimetableData
  };
};