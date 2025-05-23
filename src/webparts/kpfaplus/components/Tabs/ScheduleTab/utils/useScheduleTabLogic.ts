// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useScheduleTabLogic.ts

import * as React from 'react';
import { useEffect, useCallback, useMemo } from 'react';
import { IDropdownOption } from '@fluentui/react';
// Corrected import paths - need to go up 4 levels from utils - IMPORT ITabProps here
import { ITabProps } from '../../../../models/types';
// Corrected import path - ScheduleTabApi is sibling to utils
import { shouldRefreshDataOnDateChange } from '../ScheduleTabApi';
// Import state hook from same utils folder
import { IScheduleTabState, useScheduleTabState } from './useScheduleTabState';
// Import services hook from same utils folder
import { useScheduleTabServices } from './useScheduleTabServices';//import { IScheduleTabServices, useScheduleTabServices } from './useScheduleTabServices';
// Import data hooks from same utils folder
import { useHolidaysAndLeaves } from './useHolidaysAndLeaves';
import { useContracts } from './useContracts';
import { useTypesOfLeave } from './useTypesOfLeave';
import { useStaffRecordsData } from './useStaffRecordsData';
import { useStaffRecordsMutations } from './useStaffRecordsMutations';


// Define the return type of the main orchestrator hook
interface UseScheduleTabLogicReturn extends IScheduleTabState {
  // Handlers from orchestrator
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onErrorDismiss: () => void;
  onRefreshData: () => void;

  // Pass down handlers/getters from specific hooks using their final names
  getExistingRecordsWithStatus: ReturnType<typeof useStaffRecordsData>['getExistingRecordsWithStatus'];
  markRecordsAsDeleted: ReturnType<typeof useStaffRecordsData>['markRecordsAsDeleted'];
  onAddShift: ReturnType<typeof useStaffRecordsMutations>['handleAddShift'];
  onUpdateStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleUpdateStaffRecord'];
  onCreateStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleCreateStaffRecord'];
  onDeleteStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleDeleteStaffRecord'];
  onRestoreStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleRestoreStaffRecord'];

}

export const useScheduleTabLogic = (props: ITabProps): UseScheduleTabLogicReturn => {
  const { selectedStaff, context, currentUserId, managingGroupId } = props;

  console.log('[useScheduleTabLogic] Orchestrator hook initialized');

  const { state, setState } = useScheduleTabState();

  const services = useScheduleTabServices(context);
  // TS6133: 'IScheduleTabServices' is declared but its value is never read.
  // This warning persists as the interface type isn't used for a variable annotation here. Harmless.

  const { loadHolidaysAndLeaves } = useHolidaysAndLeaves({
    context,
    selectedDate: state.selectedDate,
    selectedStaff, // ITabProps ensures this is IStaffMember
    currentUserId,
    managingGroupId,
    holidaysService: services.holidaysService,
    daysOfLeavesService: services.daysOfLeavesService,
    setState
  });

  const { loadContracts } = useContracts({
    context,
    selectedDate: state.selectedDate,
    selectedStaff, // ITabProps ensures this is IStaffMember
    currentUserId,
    managingGroupId,
    setState
  });

  const { loadTypesOfLeave } = useTypesOfLeave({
    context,
    typeOfLeaveService: services.typeOfLeaveService,
    setState
  });

  const {
    loadStaffRecords,
    getExistingRecordsWithStatus,
    markRecordsAsDeleted
  } = useStaffRecordsData({
    context,
    selectedDate: state.selectedDate,
    selectedContractId: state.selectedContractId,
    selectedStaff, // ITabProps ensures this is IStaffMember
    currentUserId,
    managingGroupId,
    staffRecordsService: services.staffRecordsService,
    setState
  });

  const {
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord,
  } = useStaffRecordsMutations({
    context,
    selectedDate: state.selectedDate,
    selectedContractId: state.selectedContractId,
    selectedStaff, // ITabProps ensures this is IStaffMember
    currentUserId,
    managingGroupId,
    staffRecordsService: services.staffRecordsService,
    reloadRecords: loadStaffRecords,
    setState
  });


  const handleDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useScheduleTabLogic] handleDateChange called with date:', date?.toISOString());
    if (!date) {
      console.log('[useScheduleTabLogic] No date provided to handleDateChange');
      return;
    }

    const currentDate = state.selectedDate;

    setState(prevState => ({ ...prevState, selectedDate: date }));

     if (shouldRefreshDataOnDateChange(currentDate, date)) {
       console.log('[useScheduleTabLogic] Month or year changed, triggering dependent loads via effects');
        loadHolidaysAndLeaves();
        loadContracts();
        loadTypesOfLeave();
     } else {
         console.log('[useScheduleTabLogic] Only day changed, staff records hook effect will handle reload.');
     }

  }, [state.selectedDate, setState, loadHolidaysAndLeaves, loadContracts, loadTypesOfLeave]);

  const handleContractChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    console.log('[useScheduleTabLogic] handleContractChange called with option:', option);
    if (option) {
      const newContractId = option.key.toString();
      console.log(`[useScheduleTabLogic] Contract changing from ${state.selectedContractId} to: ${newContractId}`);

      setState(prevState => ({ ...prevState, selectedContractId: newContractId }));

      console.log('[useScheduleTabLogic] Contract changed, useStaffRecordsData effect will trigger reload.');
    }
  }, [state.selectedContractId, setState]);

  const handleErrorDismiss = useCallback((): void => {
    console.log('[useScheduleTabLogic] handleErrorDismiss called');
    setState(prevState => ({ ...prevState, error: undefined, errorStaffRecords: undefined }));
  }, [setState]);

  const handleRefreshData = useCallback((): void => {
    console.log('[useScheduleTabLogic] handleRefreshData called');
    loadHolidaysAndLeaves();
    loadContracts();
    loadTypesOfLeave();
    loadStaffRecords();
  }, [loadHolidaysAndLeaves, loadContracts, loadTypesOfLeave, loadStaffRecords]);


  useEffect(() => {
    console.log('[useScheduleTabLogic] Main orchestrator useEffect triggered for selectedStaff/context:');
    if (selectedStaff?.id && context) {
      console.log('[useScheduleTabLogic] Staff or context available. Initializing loads...');
      loadContracts();
      loadTypesOfLeave();
      loadHolidaysAndLeaves();
      // Staff Records load is also handled by its effect depending on staff, context, date, contract.

    } else {
      console.log('[useScheduleTabLogic] Clearing state - staff or context not available');
      setState(prevState => ({
        ...prevState,
        contracts: [],
        selectedContractId: undefined,
        staffRecords: [],
        holidays: [],
        leaves: [],
        typesOfLeave: [],
        isLoading: false,
        isLoadingHolidays: false,
        isLoadingLeaves: false,
        isLoadingStaffRecords: false,
        isLoadingTypesOfLeave: false,
        error: undefined,
        errorStaffRecords: undefined,
      }));
    }
  }, [selectedStaff?.id, context, loadContracts, loadTypesOfLeave, loadHolidaysAndLeaves, setState]); // Added setState dependency

  const hookReturn: UseScheduleTabLogicReturn = useMemo(() => ({
    ...state,
    onDateChange: handleDateChange,
    onContractChange: handleContractChange,
    onErrorDismiss: handleErrorDismiss,
    onRefreshData: handleRefreshData,
    getExistingRecordsWithStatus: getExistingRecordsWithStatus,
    markRecordsAsDeleted: markRecordsAsDeleted,
    onAddShift: handleAddShift,
    onUpdateStaffRecord: handleUpdateStaffRecord,
    onCreateStaffRecord: handleCreateStaffRecord,
    onDeleteStaffRecord: handleDeleteStaffRecord,
    onRestoreStaffRecord: handleRestoreStaffRecord,

  }), [
    state,
    handleDateChange,
    handleContractChange,
    handleErrorDismiss,
    handleRefreshData,
    getExistingRecordsWithStatus,
    markRecordsAsDeleted,
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord
  ]);

  return hookReturn;
};