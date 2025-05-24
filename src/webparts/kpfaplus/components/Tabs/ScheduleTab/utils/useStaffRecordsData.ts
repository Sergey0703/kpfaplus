// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { IStaffMember } from '../../../../models/types';
import { IExistingRecordCheck } from './ScheduleTabFillInterfaces';
import { IScheduleTabState } from './useScheduleTabState';

interface UseStaffRecordsDataProps {
 context?: WebPartContext;
 selectedDate: Date;
 selectedContractId?: string;
 selectedStaff?: IStaffMember;
 currentUserId?: string;
 managingGroupId?: string;
 staffRecordsService?: StaffRecordsService;
 setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
 currentPage: number;
 itemsPerPage: number;
 showDeleted: boolean;
}

interface UseStaffRecordsDataReturn {
 loadStaffRecords: (overrideDate?: Date, contractId?: string) => void;
 getExistingRecordsWithStatus: (
   startDate: Date, 
   endDate: Date, 
   employeeId: string, 
   currentUserId?: string, 
   staffGroupId?: string, 
   timeTableID?: string
 ) => Promise<IExistingRecordCheck[]>;
 markRecordsAsDeleted: (recordIds: string[]) => Promise<boolean>;
}

export const useStaffRecordsData = (props: UseStaffRecordsDataProps): UseStaffRecordsDataReturn => {
 const {
   context,
   selectedDate,
   selectedContractId,
   selectedStaff,
   currentUserId,
   managingGroupId,
   staffRecordsService,
   setState,
   currentPage,
   itemsPerPage,
   showDeleted,
 } = props;

 const setStaffRecords = useCallback((records: IStaffRecord[]) => setState(prevState => ({ ...prevState, staffRecords: records })), [setState]);
 const setIsLoadingStaffRecords = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingStaffRecords: isLoading })), [setState]);
 const setErrorStaffRecords = useCallback((error?: string) => setState(prevState => ({ ...prevState, errorStaffRecords: error })), [setState]);
 const setTotalItemCount = useCallback((total: number) => setState(prevState => ({ ...prevState, totalItemCount: total })), [setState]);

 const loadStaffRecords = useCallback(async (overrideDate?: Date, contractId?: string): Promise<void> => {
   const dateToUse = overrideDate || selectedDate;
   const contractIdToUse = contractId !== undefined ? contractId : selectedContractId;

   console.log('[useStaffRecordsData] *** loadStaffRecords CALLED ***');
   console.log('[useStaffRecordsData] Parameters:', {
     date: dateToUse.toISOString(),
     employeeId: selectedStaff?.employeeId,
     selectedContractId: contractIdToUse,
     currentPage,
     itemsPerPage,
     showDeleted,
   });

   if (!context || !staffRecordsService) {
     console.log('[useStaffRecordsData] Cannot load records: missing context or service');
     setStaffRecords([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords('Service not available.');
     setTotalItemCount(0);
     return;
   }

   if (!selectedStaff || !selectedStaff.employeeId) {
     console.log('[useStaffRecordsData] Cannot load records: missing selected staff or employeeId');
     setStaffRecords([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords('Selected staff member not found.');
     setTotalItemCount(0);
     return;
   }

   try {
     setIsLoadingStaffRecords(true);
     setErrorStaffRecords(undefined);

     const date = new Date(dateToUse.getTime());
     const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
     const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

     const employeeId = selectedStaff.employeeId;
     const timeTableId = contractIdToUse;

     const currentUserID = currentUserId || '0';
     const staffGroupID = managingGroupId || '0';

     const skip = (currentPage - 1) * itemsPerPage;
     const top = itemsPerPage;
console.log(`[useStaffRecordsData] *** PAGINATION PARAMS ***`);
console.log(`[useStaffRecordsData] currentPage: ${currentPage}`);
console.log(`[useStaffRecordsData] itemsPerPage: ${itemsPerPage}`);
console.log(`[useStaffRecordsData] calculated skip: ${skip}`);
console.log(`[useStaffRecordsData] calculated top: ${top}`);
     const queryParams: IStaffRecordsQueryParams = {
       startDate: firstDayOfMonth,
       endDate: lastDayOfMonth,
       currentUserID: currentUserID,
       staffGroupID: staffGroupID,
       employeeID: employeeId,
       timeTableID: timeTableId,
       skip: skip,
       top: top,
     };

     console.log('[useStaffRecordsData] *** CALLING staffRecordsService.getStaffRecordsWithOptions ***');
     console.log('[useStaffRecordsData] Query params:', queryParams);

     const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

     console.log(`[useStaffRecordsData] *** RECEIVED RESULT ***`);
     console.log(`[useStaffRecordsData] Records: ${result.records.length}, totalCount: ${result.totalCount}`);

     setStaffRecords(result.records);
     setTotalItemCount(result.totalCount);

     if (result.error) {
        setErrorStaffRecords(`Failed to load schedule records: ${result.error}`);
     }

   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error('[useStaffRecordsData] *** ERROR loading schedule records ***:', error);
     setErrorStaffRecords(`Failed to load schedule records: ${errorMessage}`);
     setStaffRecords([]);
     setTotalItemCount(0);
   } finally {
     setIsLoadingStaffRecords(false);
   }
 }, [
     context,
     staffRecordsService,
     selectedStaff?.employeeId,
     selectedDate,
     selectedContractId,
     currentUserId,
     managingGroupId,
     currentPage,
     itemsPerPage,
     showDeleted,
     setStaffRecords,
     setIsLoadingStaffRecords,
     setErrorStaffRecords,
     setTotalItemCount,
 ]);

 const getExistingRecordsWithStatus = useCallback(async (
   startDate: Date,
   endDate: Date,
   employeeId: string,
   currentUserIdParam?: string,
   staffGroupIdParam?: string,
   timeTableIDParam?: string
 ): Promise<IExistingRecordCheck[]> => {
   console.log('[useStaffRecordsData] getExistingRecordsWithStatus called with timeTableID:', timeTableIDParam);
   if (!context || !staffRecordsService) {
     console.log('[useStaffRecordsData] Cannot get existing records: missing dependencies');
     return [];
   }

   const currentUserID = currentUserIdParam || currentUserId || '0';
   const staffGroupID = staffGroupIdParam || managingGroupId || '0';
   const timeTableID = timeTableIDParam || selectedContractId;

   try {
     const queryParams: IStaffRecordsQueryParams = {
       startDate: startDate,
       endDate: endDate,
       currentUserID: currentUserID,
       staffGroupID: staffGroupID,
       employeeID: employeeId,
       timeTableID: timeTableID,
       skip: 0,
       top: 1000
     };

     console.log('[useStaffRecordsData] getExistingRecordsWithStatus query params:', queryParams);

     const result = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

     console.log(`[useStaffRecordsData] Retrieved ${result.records.length} existing records for status check (with timeTableID: ${timeTableID})`);

     const existingRecordsCheck: IExistingRecordCheck[] = result.records.map((record: IStaffRecord) => ({
       id: record.ID,
       checked: record.Checked || 0,
       exportResult: record.ExportResult || '0',
       date: record.Date,
       title: record.Title
     }));

     return existingRecordsCheck;
   } catch (error) {
     console.error('[useStaffRecordsData] Error getting existing records:', error);
     return [];
   }
 }, [context, staffRecordsService, currentUserId, managingGroupId, selectedContractId]);

 const markRecordsAsDeleted = useCallback(async (recordIds: string[]): Promise<boolean> => {
   console.log(`[useStaffRecordsData] markRecordsAsDeleted called for ${recordIds.length} records:`, recordIds);
   if (!staffRecordsService || recordIds.length === 0) {
     console.log('[useStaffRecordsData] Cannot mark records as deleted: missing service or empty ID list');
     return false;
   }

   try {
     let successCount = 0;
     const failedIds: string[] = [];

     for (const recordId of recordIds) {
       try {
         const success = await staffRecordsService.markRecordAsDeleted(recordId);
         if (success) {
           successCount++;
         } else {
           failedIds.push(recordId);
           console.error(`[useStaffRecordsData] Failed to mark record ${recordId} as deleted`);
         }
       } catch (error) {
         failedIds.push(recordId);
         console.error(`[useStaffRecordsData] Error marking record ${recordId} as deleted:`, error);
       }
     }

     const allSuccess = failedIds.length === 0;
     console.log(`[useStaffRecordsData] Mark as deleted result: ${successCount}/${recordIds.length} successful, ${failedIds.length} failed`);

     if (failedIds.length > 0) {
       console.error('[useStaffRecordsData] Failed to mark records as deleted:', failedIds);
     }

     return allSuccess;
   } catch (error) {
     console.error('[useStaffRecordsData] Error in markRecordsAsDeleted:', error);
     return false;
   }
 }, [staffRecordsService]);

 useEffect(() => {
   console.log('[useStaffRecordsData] *** useEffect TRIGGERED ***');
   console.log('[useStaffRecordsData] Dependencies:', {
     hasContext: !!context,
     hasStaffRecordsService: !!staffRecordsService,
     hasSelectedStaffEmployeeId: !!selectedStaff?.employeeId,
     currentPage,
     itemsPerPage,
     showDeleted
   });
   
   if (context && staffRecordsService && selectedStaff?.employeeId) {
     console.log('[useStaffRecordsData] *** CALLING loadStaffRecords from useEffect ***');
     void loadStaffRecords();
   } else {
     console.log('[useStaffRecordsData] *** CLEARING DATA - missing dependencies ***');
     setStaffRecords([]);
     setIsLoadingStaffRecords(false);
     setErrorStaffRecords(undefined);
     setTotalItemCount(0);
   }
 }, [
   context,
   staffRecordsService,
   selectedStaff?.employeeId,
   selectedDate,
   selectedContractId,
   currentUserId,
   managingGroupId,
   currentPage,
   itemsPerPage,
   showDeleted,
   loadStaffRecords,
   setStaffRecords,
   setIsLoadingStaffRecords,
   setErrorStaffRecords,
   setTotalItemCount,
 ]);

 return {
   loadStaffRecords,
   getExistingRecordsWithStatus,
   markRecordsAsDeleted,
 };
};