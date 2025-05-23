// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useContracts.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths
import { IContract } from '../../../../models/IContract';
// Corrected import path - ScheduleTabApi is sibling to utils
import { fetchContracts } from '../ScheduleTabApi';
// Corrected import path - types is up 4 levels from utils - IMPORT IStaffMember here
import { IStaffMember } from '../../../../models/types';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder

interface UseContractsProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedStaff?: IStaffMember; // <-- Changed from IStaffBasic
  currentUserId?: string;
  managingGroupId?: string;
  // State setters passed from orchestrator
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

interface UseContractsReturn {
  loadContracts: () => void;
}

export const useContracts = (props: UseContractsProps): UseContractsReturn => {
  const {
    context,
    selectedDate,
    selectedStaff,
    currentUserId,
    managingGroupId,
    setState
  } = props;

  const setContracts = useCallback((contracts: IContract[]) => setState(prevState => ({ ...prevState, contracts })), [setState]);
  const setSelectedContractId = useCallback((contractId?: string) => setState(prevState => ({ ...prevState, selectedContractId: contractId })), [setState]);
  const setIsLoading = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoading })), [setState]);
  const setError = useCallback((error?: string) => setState(prevState => ({ ...prevState, error })), [setState]);

  const loadContracts = useCallback(() => {
    console.log('[useContracts] loadContracts called for staff:', selectedStaff?.employeeId, 'date:', selectedDate.toISOString());
    if (!context || !selectedStaff?.employeeId) { // Still using employeeId property from IStaffMember
      console.log('[useContracts] Cannot load contracts: missing context or employeeId');
      setContracts([]);
      setSelectedContractId(undefined);
      setIsLoading(false);
      return;
    }

    void fetchContracts(
      context,
      selectedStaff.employeeId,
      currentUserId,
      managingGroupId,
      setIsLoading,
      setContracts,
      setSelectedContractId,
      setError,
      selectedDate
    );
  }, [
      context, selectedDate, selectedStaff?.employeeId, currentUserId, managingGroupId,
      setContracts, setSelectedContractId, setIsLoading, setError
  ]);

  useEffect(() => {
    console.log('[useContracts] useEffect triggered for selectedStaff/context/selectedDate:');
     if (context && selectedStaff?.employeeId) {
       loadContracts();
     } else {
        setContracts([]);
        setSelectedContractId(undefined);
        setIsLoading(false);
     }
  }, [
    context,
    selectedStaff?.employeeId,
    selectedDate,
    currentUserId,
    managingGroupId,
    loadContracts
  ]);

  return {
    loadContracts
  };
};