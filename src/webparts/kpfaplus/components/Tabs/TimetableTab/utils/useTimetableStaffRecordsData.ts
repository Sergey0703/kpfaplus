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
 // *** НОВОЕ v3.7: Добавляем функцию getLeaveTypeColor ***
 getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
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
   setErrorStaffRecords,
   getLeaveTypeColor // *** НОВОЕ v3.7: Извлекаем функцию из пропсов ***
 } = props;

 // *** ЗАЩИТА ОТ ПАРАЛЛЕЛЬНЫХ ЗАПРОСОВ ***
 const isLoadingRef = useRef(false);
 const lastRequestParamsRef = useRef<string>('');

 console.log('[useTimetableStaffRecordsData] Hook initialized with UPDATED TIMETABLE STRATEGY v3.7:', {
   hasContext: !!context,
   hasStaffRecordsService: !!staffRecordsService,
   weeksCount: weeks.length,
   staffMembersCount: staffMembers.length,
   selectedDate: selectedDate.toISOString(),
   managingGroupId,
   currentUserId,
   getLeaveTypeColorExists: !!getLeaveTypeColor, // *** НОВОЕ v3.7: Логируем наличие функции ***
   updatedStrategy: 'Using getAllActiveStaffRecordsForTimetable - loads ALL active records without pagination (excludes Deleted=1) WITH COLOR FUNCTION v3.7'
 });

 /**
  * *** ОБНОВЛЕННАЯ СТРАТЕГИЯ TIMETABLE: Загрузка ВСЕХ АКТИВНЫХ данных БЕЗ пагинации ***
  * Использует новый метод getAllActiveStaffRecordsForTimetable с исключением Deleted=1
  */
 const loadWithTimetableStrategy = async (
   startDate: Date, 
   endDate: Date, 
   currentUserId: string, 
   managingGroupId: string, 
   staffRecordsService: StaffRecordsService
 ): Promise<IStaffRecord[]> => {
   console.log('[useTimetableStaffRecordsData] *** EXECUTING UPDATED TIMETABLE STRATEGY v3.7 ***');
   console.log('[useTimetableStaffRecordsData] *** LOADING ALL ACTIVE DATA WITHOUT PAGINATION (EXCLUDING DELETED=1) WITH COLOR FUNCTION ***');
   
   const queryParams = {
     startDate,
     endDate,
     currentUserID: currentUserId,
     staffGroupID: managingGroupId,
     employeeID: '', // Пустая строка = без фильтра по сотруднику
     timeTableID: undefined
     // НЕТ skip, top, nextLink - загружаем ВСЕ данные
     // НОВОЕ: Автоматически исключаем Deleted=1 на серверном уровне
   };

   console.log('[useTimetableStaffRecordsData] Timetable query params (NO PAGINATION + NO DELETED) v3.7:', queryParams);

   const startTime = performance.now();
   
   // *** ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД С ИСКЛЮЧЕНИЕМ DELETED=1 ***
   const result = await staffRecordsService.getAllActiveStaffRecordsForTimetable(queryParams);
   
   const loadTime = performance.now() - startTime;

   console.log('[useTimetableStaffRecordsData] *** UPDATED TIMETABLE STRATEGY RESULT v3.7 ***:', {
     recordsCount: result.records.length,
     totalCount: result.totalCount,
     loadTimeMs: Math.round(loadTime),
     hasError: !!result.error,
     isDataComplete: result.records.length === result.totalCount,
     strategyUsed: 'getAllActiveStaffRecordsForTimetable (NO PAGINATION + NO DELETED) v3.7',
     expectedResult: 'ALL active records for the period loaded at once (Deleted=1 excluded) WITH COLOR FUNCTION',
     improvement: 'Server-side filtering eliminates deleted records, improving performance + COLOR FUNCTION available'
   });

   if (result.error) {
     throw new Error(`Updated Timetable strategy failed: ${result.error}`);
   }

   // *** КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся что получили ВСЕ активные данные ***
   if (result.records.length !== result.totalCount) {
     console.warn('[useTimetableStaffRecordsData] ⚠️ POTENTIAL DATA LOSS:', {
       recordsReceived: result.records.length,
       totalExpected: result.totalCount,
       difference: result.totalCount - result.records.length
     });
   } else {
     console.log('[useTimetableStaffRecordsData] ✅ SUCCESS: Got ALL expected ACTIVE records (deleted records excluded at server level) v3.7');
   }

   return result.records;
 };

 const loadTimetableData = useCallback(async (overrideDate?: Date): Promise<void> => {
   const dateToUse = overrideDate || selectedDate;
   
   // *** СОЗДАЕМ УНИКАЛЬНЫЙ КЛЮЧ ЗАПРОСА ДЛЯ ПРОВЕРКИ ДУБЛИКАТОВ ***
   const requestKey = `${dateToUse.toISOString()}-${managingGroupId}-${currentUserId}-${staffMembers.length}-${weeks.length}-${!!getLeaveTypeColor}`;
   
   console.log('[useTimetableStaffRecordsData] *** UPDATED TIMETABLE STRATEGY loadTimetableData CALLED v3.7 ***');
   console.log('[useTimetableStaffRecordsData] Request key v3.7:', requestKey);
   console.log('[useTimetableStaffRecordsData] Last request key:', lastRequestParamsRef.current);
   console.log('[useTimetableStaffRecordsData] Is currently loading:', isLoadingRef.current);
   console.log('[useTimetableStaffRecordsData] *** v3.7: getLeaveTypeColor status ***', {
     getLeaveTypeColorExists: !!getLeaveTypeColor,
     functionType: typeof getLeaveTypeColor,
     note: 'This function will be passed to processAndSetResults'
   });
   
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
   
   console.log('[useTimetableStaffRecordsData] ✅ PROCEEDING: New unique request with UPDATED TIMETABLE STRATEGY v3.7');

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

     console.log('[useTimetableStaffRecordsData] Loading data for date range with UPDATED STRATEGY v3.7:', {
       startDate: startDate.toISOString(),
       endDate: endDate.toISOString(),
       totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1,
       strategy: 'UPDATED TIMETABLE STRATEGY v3.7 - loads ALL active records without pagination (excludes Deleted=1) WITH COLOR FUNCTION',
       getLeaveTypeColorAvailable: !!getLeaveTypeColor
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

     // *** ОБНОВЛЕННАЯ СТРАТЕГИЯ: Всегда используем Timetable Strategy для загрузки ВСЕХ АКТИВНЫХ данных ***
     const loadingStrategy = 'UPDATED_TIMETABLE_STRATEGY_v3.7';

     console.log('[useTimetableStaffRecordsData] *** LOADING STRATEGY SELECTION v3.7 ***', {
       staffCount: activeStaffMembers.length,
       selectedStrategy: loadingStrategy,
       reasoning: `Using UPDATED Timetable Strategy v3.7 - loads ALL active records at once without pagination and excludes Deleted=1 WITH COLOR FUNCTION`,
       expectedBenefit: `Should load all active records and distribute across all ${weeks.length} weeks, with better performance due to server-side filtering AND PROPER COLORS`,
       previousProblem: 'Old strategy concentrated data in first week only and included deleted records + NO COLORS',
       solution: 'New getAllActiveStaffRecordsForTimetable method bypasses pagination and filters deleted records on server + PASSES COLOR FUNCTION'
     });

     let allRecords: IStaffRecord[] = [];

     // Всегда используем обновленную Timetable стратегию
     allRecords = await loadWithTimetableStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);

     console.log('[useTimetableStaffRecordsData] *** UPDATED TIMETABLE STRATEGY EXECUTION COMPLETED v3.7 ***', {
       recordsLoaded: allRecords.length,
       expectedRecords: 'All active records for the period',
       loadingMethod: 'getAllActiveStaffRecordsForTimetable (bypasses pagination + excludes Deleted=1) v3.7',
       nextStep: 'Processing and distributing across weeks WITH COLOR FUNCTION',
       getLeaveTypeColorWillBePassedToProcessor: !!getLeaveTypeColor
     });

     // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.7: Передача getLeaveTypeColor в processAndSetResults ***
     console.log('[useTimetableStaffRecordsData] *** v3.7: CALLING processAndSetResults WITH getLeaveTypeColor ***');
     console.log('[useTimetableStaffRecordsData] *** v3.7: Final check before passing getLeaveTypeColor ***', {
       getLeaveTypeColorExists: !!getLeaveTypeColor,
       functionType: typeof getLeaveTypeColor,
       willBePassedToHelper: true,
       expectedOutcome: 'Colors should now appear in UI'
     });

     // Общая обработка результатов с диагностикой - ИСПРАВЛЕНО v3.7: Передаем getLeaveTypeColor
     await processAndSetResults(
       allRecords, 
       activeStaffMembers, 
       weeks, 
       loadingStrategy,
       selectedDate,
       setStaffRecords,
       setWeeksData,
       getLeaveTypeColor // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.7: Передаем функцию цветов ***
     );

   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error('[useTimetableStaffRecordsData] *** CRITICAL ERROR in UPDATED TIMETABLE STRATEGY v3.7 ***:', error);
     setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
     setStaffRecords([]);
     setWeeksData([]);
   } finally {
     console.log('[useTimetableStaffRecordsData] *** SETTING LOADING STATE TO FALSE v3.7 ***');
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
   setErrorStaffRecords,
   getLeaveTypeColor // *** НОВОЕ v3.7: Добавляем в зависимости ***
 ]);

 const refreshTimetableData = useCallback(async (): Promise<void> => {
   console.log('[useTimetableStaffRecordsData] Refreshing timetable data with UPDATED TIMETABLE STRATEGY v3.7');
   console.log('[useTimetableStaffRecordsData] *** v3.7: getLeaveTypeColor status on refresh ***', {
     getLeaveTypeColorExists: !!getLeaveTypeColor,
     note: 'Function should be available for refresh as well'
   });
   await loadTimetableData();
 }, [loadTimetableData]);

 // Эффект для автоматической загрузки данных при изменении ключевых параметров
 useEffect(() => {
   console.log('[useTimetableStaffRecordsData] *** useEffect TRIGGERED FOR UPDATED TIMETABLE STRATEGY v3.7 ***');
   console.log('[useTimetableStaffRecordsData] Dependencies v3.7:', {
     hasContext: !!context,
     hasStaffRecordsService: !!staffRecordsService,
     hasManagingGroupId: !!managingGroupId,
     hasCurrentUserId: !!currentUserId,
     weeksCount: weeks.length,
     staffMembersCount: staffMembers.length,
     selectedDate: selectedDate.toISOString(),
     getLeaveTypeColorExists: !!getLeaveTypeColor, // *** НОВОЕ v3.7 ***
     solution: 'UPDATED TIMETABLE STRATEGY v3.7 with getAllActiveStaffRecordsForTimetable + getLeaveTypeColor - should fix week distribution and exclude deleted records AND RESTORE COLORS'
   });
   
   // *** ЗАЩИТА ОТ МНОЖЕСТВЕННЫХ ЗАПРОСОВ ***
   const hasAllRequiredDeps = context && 
     staffRecordsService && 
     managingGroupId && 
     currentUserId &&
     weeks.length > 0 &&
     staffMembers.length > 0;

   if (!hasAllRequiredDeps) {
     console.log('[useTimetableStaffRecordsData] *** CLEARING DATA - missing dependencies v3.7 ***');
     console.log('[useTimetableStaffRecordsData] Missing dependencies analysis v3.7:', {
       hasContext: !!context,
       hasStaffRecordsService: !!staffRecordsService,
       hasManagingGroupId: !!managingGroupId,
       hasCurrentUserId: !!currentUserId,
       weeksCount: weeks.length,
       staffMembersCount: staffMembers.length,
       getLeaveTypeColorExists: !!getLeaveTypeColor
     });
     
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords(undefined);
     return;
   }

   // *** DEBOUNCE: Задержка перед запросом для предотвращения частых вызовов ***
   console.log('[useTimetableStaffRecordsData] *** SETTING UP DEBOUNCED UPDATED TIMETABLE STRATEGY REQUEST v3.7 ***');
   
   const timeoutId = setTimeout(() => {
     console.log('[useTimetableStaffRecordsData] *** DEBOUNCED UPDATED TIMETABLE STRATEGY REQUEST EXECUTING v3.7 ***');
     console.log('[useTimetableStaffRecordsData] *** CALLING UPDATED TIMETABLE STRATEGY loadTimetableData from useEffect v3.7 ***');
     
     loadTimetableData().catch(error => {
       console.error('[useTimetableStaffRecordsData] Error in useEffect UPDATED TIMETABLE STRATEGY loadTimetableData v3.7:', error);
     });
   }, 300); // 300ms задержка для группировки быстрых изменений

   // Cleanup функция для отмены предыдущих запросов
   return () => {
     console.log('[useTimetableStaffRecordsData] *** CLEANUP: Cancelling previous debounced UPDATED TIMETABLE STRATEGY request v3.7 ***');
     clearTimeout(timeoutId);
   };
 }, [
   selectedDate.toISOString(), // Используем строку для стабильного сравнения
   weeks.length,
   staffMembers.length,
   managingGroupId,
   currentUserId,
   getLeaveTypeColor, // *** НОВОЕ v3.7: Добавляем в зависимости useEffect ***
   // НЕ включаем loadTimetableData в зависимость - это может вызвать бесконечные ререндеры
 ]);

 return {
   loadTimetableData,
   refreshTimetableData
 };
};