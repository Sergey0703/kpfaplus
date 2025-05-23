// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
// Corrected import path - types is up 4 levels from utils - IMPORT IStaffMember here
import { IStaffMember } from '../../../../models/types';
// Corrected import path - ScheduleTabFillInterfaces is in the same utils folder
import { IExistingRecordCheck } from './ScheduleTabFillInterfaces';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder

interface UseStaffRecordsDataProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedContractId?: string;
  selectedStaff?: IStaffMember; // <-- Changed from IStaffBasic
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  // State setters from orchestrator
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

interface UseStaffRecordsDataReturn {
  loadStaffRecords: (overrideDate?: Date, contractId?: string) => void;
  getExistingRecordsWithStatus: (startDate: Date, endDate: Date, employeeId: string, currentUserId?: string, staffGroupId?: string) => Promise<IExistingRecordCheck[]>;
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
    setState
  } = props;

  const setStaffRecords = useCallback((records: IStaffRecord[]) => setState(prevState => ({ ...prevState, staffRecords: records })), [setState]);
  const setIsLoadingStaffRecords = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingStaffRecords: isLoading })), [setState]);
  const setErrorStaffRecords = useCallback((error?: string) => setState(prevState => ({ ...prevState, errorStaffRecords: error })), [setState]);

  const loadStaffRecords = useCallback(async (overrideDate?: Date, contractId?: string): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    const contractIdToUse = contractId !== undefined ? contractId : selectedContractId;
    console.log('[useStaffRecordsData] loadStaffRecords called with parameters:', {
      date: dateToUse.toISOString(),
      employeeId: selectedStaff?.employeeId, // Still using employeeId property from IStaffMember
      selectedContractId: contractIdToUse,
    });

    if (!context || !staffRecordsService) {
      console.log('[useStaffRecordsData] Cannot load records: missing context or service');
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Service not available.');
      return;
    }

    if (!selectedStaff || !selectedStaff.employeeId) { // Still using employeeId property from IStaffMember
      console.log('[useStaffRecordsData] Cannot load records: missing selected staff or employeeId');
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Selected staff member not found.');
      return;
    }

    try {
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);

      const date = new Date(dateToUse.getTime());
      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const employeeId = selectedStaff.employeeId; // Still using employeeId property from IStaffMember
      const timeTableId = contractIdToUse;

      const currentUserID = currentUserId || '0';
      const staffGroupID = managingGroupId || '0';

      console.log('[useStaffRecordsData] API call parameters:', {
        firstDayOfMonth: firstDayOfMonth.toISOString(),
        lastDayOfMonth: lastDayOfMonth.toISOString(),
        employeeId,
        currentUserID,
        staffGroupID,
        timeTableId
      });

      const records = await staffRecordsService.getStaffRecords(
        firstDayOfMonth,
        lastDayOfMonth,
        currentUserID,
        staffGroupID,
        employeeId,
        timeTableId
      );

      console.log(`[useStaffRecordsData] Loaded ${records.length} schedule records`);
      setStaffRecords(records);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useStaffRecordsData] Error loading schedule records:', error);
      setErrorStaffRecords(`Failed to load schedule records: ${errorMessage}`);
      setStaffRecords([]);
    } finally {
      setIsLoadingStaffRecords(false);
    }
  }, [
      context, selectedDate, selectedContractId, selectedStaff?.employeeId, currentUserId, managingGroupId, staffRecordsService,
      setStaffRecords, setIsLoadingStaffRecords, setErrorStaffRecords
  ]);


  const getExistingRecordsWithStatus = useCallback(async (
    startDate: Date,
    endDate: Date,
    employeeId: string, // This employeeId is likely a parameter passed into this function, not necessarily from selectedStaff
    currentUserIdParam?: string,
    staffGroupIdParam?: string
  ): Promise<IExistingRecordCheck[]> => {
    console.log('[useStaffRecordsData] getExistingRecordsWithStatus called');
    if (!context || !staffRecordsService) {
      console.log('[useStaffRecordsData] Cannot get existing records: missing dependencies');
      return [];
    }

    const currentUserID = currentUserIdParam || currentUserId || '0';
    const staffGroupID = staffGroupIdParam || managingGroupId || '0';

    try {
      const records = await staffRecordsService.getStaffRecords(
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeId // Use the employeeId passed as a parameter
      );

      console.log(`[useStaffRecordsData] Retrieved ${records.length} existing records for status check`);

      const existingRecordsCheck: IExistingRecordCheck[] = records.map((record: IStaffRecord) => ({
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
  }, [context, staffRecordsService, currentUserId, managingGroupId]);


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
    console.log('[useStaffRecordsData] useEffect triggered for staff records loading:');
    if (context && staffRecordsService && selectedStaff?.employeeId) {
      void loadStaffRecords();
    } else {
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
    }
  }, [
    context,
    staffRecordsService,
    selectedStaff?.employeeId,
    selectedDate,
    selectedContractId,
    currentUserId,
    managingGroupId,
    loadStaffRecords,
    setStaffRecords, setIsLoadingStaffRecords, setErrorStaffRecords
  ]);

  return {
    loadStaffRecords,
    getExistingRecordsWithStatus,
    markRecordsAsDeleted,
  };
};