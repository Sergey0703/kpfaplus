// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsMutations.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
// Corrected import path - types is up 4 levels from utils - IMPORT IStaffMember here
import { IStaffMember } from '../../../../models/types';
// Corrected import path - components is sibling to utils, ScheduleTable is inside components
import { INewShiftData } from '../components/ScheduleTable';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder
import { useCallback } from 'react';

type ReloadStaffRecords = (date?: Date, contractId?: string) => void;

interface UseStaffRecordsMutationsProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedContractId?: string;
  selectedStaff?: IStaffMember; // <-- Changed from IStaffBasic
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  reloadRecords: ReloadStaffRecords;
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

interface UseStaffRecordsMutationsReturn {
  handleAddShift: (date: Date, shiftData?: INewShiftData) => Promise<void>;
  handleUpdateStaffRecord: (recordId: string, updateData: Partial<IStaffRecord>) => Promise<boolean>;
  handleCreateStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
  handleDeleteStaffRecord: (recordId: string) => Promise<boolean>;
  handleRestoreStaffRecord: (recordId: string) => Promise<boolean>;
}

export const useStaffRecordsMutations = (props: UseStaffRecordsMutationsProps): UseStaffRecordsMutationsReturn => {
  const {
    context,
    selectedDate,
    selectedContractId,
    selectedStaff,
    currentUserId,
    managingGroupId,
    staffRecordsService,
    reloadRecords,
    setState
  } = props;

   const setIsLoading = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoading })), [setState]);
  const setError = useCallback((error?: string) => setState(prevState => ({ ...prevState, error })), [setState]);

  const handleMutation = useCallback(async (
    mutationFn: () => Promise<boolean | string | undefined>,
    successMessage: string,
    errorMessage: string
  ): Promise<boolean | string | undefined> => {
    if (!context || !staffRecordsService) {
      console.error(`[useStaffRecordsMutations] Cannot perform mutation (${errorMessage}): missing context or service`);
      setError(`Service not available. ${errorMessage}`);
      return errorMessage.startsWith('create') ? undefined : false;
    }
    try {
      setIsLoading(true);
      setError(undefined);

      const result = await mutationFn();

      if (result !== false && result !== undefined) {
        console.log(`[useStaffRecordsMutations] Mutation successful: ${successMessage}`);
        setTimeout(() => {
          void reloadRecords(selectedDate, selectedContractId);
        }, 500);
      } else if (result === false) {
         console.error(`[useStaffRecordsMutations] Mutation failed: ${errorMessage}`);
         setError(`Failed to complete action: ${errorMessage}`);
      }

      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[useStaffRecordsMutations] Error during mutation (${errorMessage}):`, error);
      setError(`Error: ${msg}`);
      return errorMessage.startsWith('create') ? undefined : false;
    } finally {
       setTimeout(() => setIsLoading(false), 600);
    }
  }, [context, staffRecordsService, reloadRecords, selectedDate, selectedContractId, setIsLoading, setError]);


  const handleAddShift = useCallback(async (date: Date, shiftData?: INewShiftData): Promise<void> => {
      console.log(`[useStaffRecordsMutations] handleAddShift called for date: ${date.toLocaleDateString()}`);
      if (!selectedStaff?.employeeId) { // Still using employeeId property from IStaffMember
        console.error('[useStaffRecordsMutations] Cannot add shift: missing selected staff or employeeId');
        setError('Selected staff member not found.');
        return;
      }

      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);

      const shiftDate1 = new Date(newDate);
      shiftDate1.setHours(9, 0, 0, 0);

      const shiftDate2 = new Date(newDate);
      shiftDate2.setHours(17, 0, 0, 0);

      const createData: Partial<IStaffRecord> = {
        Date: newDate,
        ShiftDate1: shiftDate1,
        ShiftDate2: shiftDate2,
        TimeForLunch: shiftData ? parseInt(shiftData.timeForLunch, 10) || 60 : 60,
        Contract: shiftData?.contractNumber ? parseInt(shiftData.contractNumber, 10) : 1,
        WeeklyTimeTableID: selectedContractId,
        TypeOfLeaveID: shiftData?.typeOfLeave || '',
        Title: `Shift on ${date.toLocaleDateString()}`,
        Holiday: shiftData?.holiday || 0
      };

      const employeeId = selectedStaff.employeeId; // Still using employeeId property from IStaffMember
      const currentUserID = currentUserId || '0';
      const staffGroupID = managingGroupId || '0';

      console.log('[useStaffRecordsMutations] Creating new shift with data:', JSON.stringify(createData, null, 2));
      console.log('[useStaffRecordsMutations] Using reference IDs:', {
        currentUserID,
        staffGroupID,
        employeeId
      });

      await handleMutation(
          () => staffRecordsService!.createStaffRecord(createData, currentUserID, staffGroupID, employeeId),
          'Shift added successfully.',
          'add shift'
      );
  }, [selectedStaff?.employeeId, selectedContractId, currentUserId, managingGroupId, staffRecordsService, handleMutation, setError]);


  const handleUpdateStaffRecord = useCallback(async (recordId: string, updateData: Partial<IStaffRecord>): Promise<boolean> => {
    console.log(`[useStaffRecordsMutations] handleUpdateStaffRecord called for record ID: ${recordId}`);
    const result = await handleMutation(
        () => staffRecordsService!.updateStaffRecord(recordId, updateData),
        `Record ${recordId} updated successfully.`,
        `update record ${recordId}`
    );
    return result === true;
  }, [staffRecordsService, handleMutation]);

  const handleCreateStaffRecord = useCallback(async (
    createData: Partial<IStaffRecord>,
    currentUserIdParam?: string,
    staffGroupIdParam?: string,
    staffMemberIdParam?: string
  ): Promise<string | undefined> => {
    console.log(`[useStaffRecordsMutations] handleCreateStaffRecord called`);

    const userId = currentUserIdParam || currentUserId || '0';
    const groupId = staffGroupIdParam || managingGroupId || '0';
    const staffId = staffMemberIdParam || selectedStaff?.employeeId; // Still using employeeId property from IStaffMember

    if (!staffId) {
         console.error('[useStaffRecordsMutations] Cannot create record: missing staffMemberId');
         setError('Missing staff member ID for creation.');
         return undefined;
    }

    const newRecordId = await handleMutation(
        () => staffRecordsService!.createStaffRecord(createData, userId, groupId, staffId),
        'Record created successfully.',
        'create record'
    );
    return typeof newRecordId === 'string' ? newRecordId : undefined;
  }, [currentUserId, managingGroupId, selectedStaff?.employeeId, staffRecordsService, handleMutation, setError]);

  const handleDeleteStaffRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log(`[useStaffRecordsMutations] handleDeleteStaffRecord called for record ID: ${recordId}`);
     const result = await handleMutation(
        () => staffRecordsService!.markRecordAsDeleted(recordId),
        `Record ${recordId} marked as deleted successfully.`,
        `delete record ${recordId}`
    );
    return result === true;
  }, [staffRecordsService, handleMutation]);

  const handleRestoreStaffRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log(`[useStaffRecordsMutations] handleRestoreStaffRecord called for record ID: ${recordId}`);
    const result = await handleMutation(
        () => staffRecordsService!.restoreDeletedRecord(recordId),
        `Record ${recordId} restored successfully.`,
        `restore record ${recordId}`
    );
    return result === true;
  }, [staffRecordsService, handleMutation]);


  return {
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord,
  };
};