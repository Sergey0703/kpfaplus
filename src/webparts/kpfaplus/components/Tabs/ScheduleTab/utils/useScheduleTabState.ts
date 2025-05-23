// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useScheduleTabState.ts

import { useState } from 'react';
// Corrected import paths
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
// IScheduleTabState doesn't directly use IStaffBasic/IStaffMember, so no change here.
// ... (IScheduleTabState interface and hook definition) ...
export interface IScheduleTabState {
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  error?: string;
  holidays: IHoliday[];
  isLoadingHolidays: boolean;
  leaves: ILeaveDay[];
  isLoadingLeaves: boolean;
  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  staffRecords: IStaffRecord[];
  isLoadingStaffRecords: boolean;
  errorStaffRecords?: string;
}

interface UseScheduleTabStateReturn {
  state: IScheduleTabState;
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

export const useScheduleTabState = (): UseScheduleTabStateReturn => {
  const [state, setState] = useState<IScheduleTabState>({
    selectedDate: new Date(),
    contracts: [],
    selectedContractId: undefined,
    isLoading: false,
    error: undefined,
    holidays: [],
    isLoadingHolidays: false,
    leaves: [],
    isLoadingLeaves: false,
    typesOfLeave: [],
    isLoadingTypesOfLeave: false,
    staffRecords: [],
    isLoadingStaffRecords: false,
    errorStaffRecords: undefined
  });

  return {
    state,
    setState,
  };
};