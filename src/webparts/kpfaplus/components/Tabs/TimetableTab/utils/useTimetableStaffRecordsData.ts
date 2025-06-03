// ИСПРАВЛЕННЫЙ useTimetableStaffRecordsData.ts

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
   getLeaveTypeColor
 } = props;

 const isLoadingRef = useRef(false);
 const lastRequestParamsRef = useRef<string>('');
 const abortControllerRef = useRef<AbortController | null>(null);

 const loadWithTimetableStrategy = async (
   startDate: Date, 
   endDate: Date, 
   currentUserId: string, 
   managingGroupId: string, 
   staffRecordsService: StaffRecordsService
 ): Promise<IStaffRecord[]> => {
   const queryParams = {
     startDate,
     endDate,
     currentUserID: currentUserId,
     staffGroupID: managingGroupId,
     employeeID: '',
     timeTableID: undefined
   };

   const result = await staffRecordsService.getAllActiveStaffRecordsForTimetable(queryParams);
   
   if (result.error) {
     throw new Error(`Timetable strategy failed: ${result.error}`);
   }

   return result.records;
 };

 const loadTimetableData = useCallback(async (overrideDate?: Date): Promise<void> => {
   const dateToUse = overrideDate || selectedDate;
   
   // ИСПРАВЛЕНИЕ: Создаем более точный ключ запроса включая время
   const requestKey = `${dateToUse.getTime()}-${managingGroupId}-${currentUserId}-${staffMembers.length}-${weeks.length}-${JSON.stringify(weeks.map(w => w.weekStart.getTime()))}-${!!getLeaveTypeColor}`;
   
   console.log('[useTimetableStaffRecordsData] *** LOAD TIMETABLE DATA CALLED ***', {
     dateToUse: dateToUse.toISOString(),
     selectedDate: selectedDate.toISOString(),
     requestKey,
     lastRequestKey: lastRequestParamsRef.current,
     isLoading: isLoadingRef.current,
     weeksCount: weeks.length,
     staffMembersCount: staffMembers.length
   });
   
   if (isLoadingRef.current && lastRequestParamsRef.current === requestKey) {
     console.log('[useTimetableStaffRecordsData] *** SKIPPING - SAME REQUEST IN PROGRESS ***');
     return;
   }
   
   // Отменяем предыдущий запрос если он есть
   if (abortControllerRef.current) {
     console.log('[useTimetableStaffRecordsData] *** ABORTING PREVIOUS REQUEST ***');
     abortControllerRef.current.abort();
   }
   
   // Создаем новый AbortController
   abortControllerRef.current = new AbortController();
   
   isLoadingRef.current = true;
   lastRequestParamsRef.current = requestKey;

   if (!context || !staffRecordsService || !managingGroupId || !currentUserId) {
     console.log('[useTimetableStaffRecordsData] *** MISSING REQUIRED SERVICES ***');
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords('Service not available.');
     isLoadingRef.current = false;
     return;
   }

   if (weeks.length === 0 || staffMembers.length === 0) {
     console.log('[useTimetableStaffRecordsData] *** NO WEEKS OR STAFF MEMBERS ***', {
       weeksCount: weeks.length,
       staffMembersCount: staffMembers.length
     });
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     isLoadingRef.current = false;
     return;
   }

   try {
     setIsLoadingStaffRecords(true);
     setErrorStaffRecords(undefined);

     // ИСПРАВЛЕНИЕ: Используем точную дату для расчета диапазона
     const startDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1);
     const endDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth() + 1, 0);

     console.log('[useTimetableStaffRecordsData] *** LOADING DATA FOR PERIOD ***', {
       startDate: startDate.toISOString(),
       endDate: endDate.toISOString(),
       selectedMonth: dateToUse.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
     });

     const activeStaffMembers = staffMembers.filter(staffMember => {
       const isDeleted = staffMember.deleted === 1;
       const hasEmployeeId = staffMember.employeeId && staffMember.employeeId !== '0';
       return !isDeleted && hasEmployeeId;
     });

     if (activeStaffMembers.length === 0) {
       console.log('[useTimetableStaffRecordsData] *** NO ACTIVE STAFF MEMBERS ***');
       setStaffRecords([]);
       setWeeksData([]);
       setIsLoadingStaffRecords(false);
       isLoadingRef.current = false;
       return;
     }

     console.log('[useTimetableStaffRecordsData] *** LOADING RECORDS ***', {
       activeStaffCount: activeStaffMembers.length,
       strategy: 'TIMETABLE_STRATEGY_v3.7'
     });

     const allRecords = await loadWithTimetableStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);

     console.log('[useTimetableStaffRecordsData] *** RECORDS LOADED ***', {
       recordsCount: allRecords.length,
       dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
     });

     // Проверяем, не был ли запрос отменен
     if (abortControllerRef.current?.signal.aborted) {
       console.log('[useTimetableStaffRecordsData] *** REQUEST WAS ABORTED ***');
       return;
     }

     await processAndSetResults(
       allRecords, 
       activeStaffMembers, 
       weeks, 
       'UPDATED_TIMETABLE_STRATEGY_v3.7',
       dateToUse, // ИСПРАВЛЕНИЕ: Используем dateToUse вместо selectedDate
       setStaffRecords,
       setWeeksData,
       getLeaveTypeColor
     );

     console.log('[useTimetableStaffRecordsData] *** DATA PROCESSING COMPLETED ***');

   } catch (error) {
     if (error instanceof Error && error.name === 'AbortError') {
       console.log('[useTimetableStaffRecordsData] *** REQUEST ABORTED ***');
       return;
     }
     
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error('[useTimetableStaffRecordsData] *** ERROR LOADING DATA ***', errorMessage);
     setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
     setStaffRecords([]);
     setWeeksData([]);
   } finally {
     setIsLoadingStaffRecords(false);
     isLoadingRef.current = false;
     abortControllerRef.current = null;
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
   getLeaveTypeColor
 ]);

 const refreshTimetableData = useCallback(async (): Promise<void> => {
   console.log('[useTimetableStaffRecordsData] *** REFRESH TRIGGERED ***');
   // Сбрасываем кеш для принудительной перезагрузки
   lastRequestParamsRef.current = '';
   await loadTimetableData();
 }, [loadTimetableData]);

 // ИСПРАВЛЕННЫЙ useEffect с более точным отслеживанием изменений
 useEffect(() => {
   const hasAllRequiredDeps = context && 
     staffRecordsService && 
     managingGroupId && 
     currentUserId &&
     weeks.length > 0 &&
     staffMembers.length > 0;

   console.log('[useTimetableStaffRecordsData] *** EFFECT TRIGGERED ***', {
     selectedDate: selectedDate.toISOString(),
     selectedMonth: selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
     weeksCount: weeks.length,
     staffMembersCount: staffMembers.length,
     hasAllRequiredDeps,
     firstWeekStart: weeks[0]?.weekStart.toISOString(),
     firstWeekLabel: weeks[0]?.weekLabel
   });

   if (!hasAllRequiredDeps) {
     console.log('[useTimetableStaffRecordsData] *** CLEARING DATA - MISSING DEPENDENCIES ***');
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords(undefined);
     return;
   }

   const timeoutId = setTimeout(() => {
     console.log('[useTimetableStaffRecordsData] *** TIMEOUT TRIGGERED - LOADING DATA ***');
     loadTimetableData().catch(error => {
       console.error('[useTimetableStaffRecordsData] Error in useEffect:', error);
     });
   }, 300);

   return () => {
     console.log('[useTimetableStaffRecordsData] *** CLEANING UP TIMEOUT ***');
     clearTimeout(timeoutId);
   };
 }, [
   selectedDate.getTime(), // КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем время в миллисекундах для точного сравнения
   weeks.length,
   weeks[0]?.weekStart.getTime(), // Отслеживаем изменение первой недели
   staffMembers.length,
   managingGroupId,
   currentUserId,
   loadTimetableData
 ]);

 // Cleanup при размонтировании
 useEffect(() => {
   return () => {
     if (abortControllerRef.current) {
       abortControllerRef.current.abort();
     }
   };
 }, []);

 return {
   loadTimetableData,
   refreshTimetableData
 };
};