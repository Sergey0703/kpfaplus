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
   const requestKey = `${dateToUse.toISOString()}-${managingGroupId}-${currentUserId}-${staffMembers.length}-${weeks.length}-${!!getLeaveTypeColor}`;
   
   if (isLoadingRef.current || lastRequestParamsRef.current === requestKey) {
     return;
   }
   
   let shouldProceed = false;
   if (!isLoadingRef.current) {
     isLoadingRef.current = true;
     lastRequestParamsRef.current = requestKey;
     shouldProceed = true;
   }
   
   if (!shouldProceed) {
     return;
   }

   if (!context || !staffRecordsService || !managingGroupId || !currentUserId) {
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords('Service not available.');
     isLoadingRef.current = false;
     return;
   }

   if (weeks.length === 0 || staffMembers.length === 0) {
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     isLoadingRef.current = false;
     return;
   }

   try {
     setIsLoadingStaffRecords(true);
     setErrorStaffRecords(undefined);

     const startDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1);
     const endDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth() + 1, 0);

     const activeStaffMembers = staffMembers.filter(staffMember => {
       const isDeleted = staffMember.deleted === 1;
       const hasEmployeeId = staffMember.employeeId && staffMember.employeeId !== '0';
       return !isDeleted && hasEmployeeId;
     });

     if (activeStaffMembers.length === 0) {
       setStaffRecords([]);
       setWeeksData([]);
       setIsLoadingStaffRecords(false);
       isLoadingRef.current = false;
       return;
     }

     const allRecords = await loadWithTimetableStrategy(startDate, endDate, currentUserId, managingGroupId, staffRecordsService);

     await processAndSetResults(
       allRecords, 
       activeStaffMembers, 
       weeks, 
       'UPDATED_TIMETABLE_STRATEGY_v3.7',
       selectedDate,
       setStaffRecords,
       setWeeksData,
       getLeaveTypeColor
     );

   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
     setStaffRecords([]);
     setWeeksData([]);
   } finally {
     setIsLoadingStaffRecords(false);
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
   getLeaveTypeColor
 ]);

 const refreshTimetableData = useCallback(async (): Promise<void> => {
   await loadTimetableData();
 }, [loadTimetableData]);

 useEffect(() => {
   const hasAllRequiredDeps = context && 
     staffRecordsService && 
     managingGroupId && 
     currentUserId &&
     weeks.length > 0 &&
     staffMembers.length > 0;

   if (!hasAllRequiredDeps) {
     setStaffRecords([]);
     setWeeksData([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords(undefined);
     return;
   }

   const timeoutId = setTimeout(() => {
     loadTimetableData().catch(error => {
       console.error('[useTimetableStaffRecordsData] Error in useEffect:', error);
     });
   }, 300);

   return () => {
     clearTimeout(timeoutId);
   };
 }, [
   selectedDate.toISOString(),
   weeks.length,
   staffMembers.length,
   managingGroupId,
   currentUserId,
   getLeaveTypeColor,
 ]);

 return {
   loadTimetableData,
   refreshTimetableData
 };
};