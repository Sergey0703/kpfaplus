// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useTypesOfLeave.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths
import { TypeOfLeaveService, ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
// Corrected import path - ScheduleTabApi is sibling to utils
import { fetchTypesOfLeave } from '../ScheduleTabApi';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder

interface UseTypesOfLeaveProps {
  context?: WebPartContext;
  typeOfLeaveService?: TypeOfLeaveService;
  // State setters passed from orchestrator
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

interface UseTypesOfLeaveReturn {
  loadTypesOfLeave: () => void;
}

export const useTypesOfLeave = (props: UseTypesOfLeaveProps): UseTypesOfLeaveReturn => {
  const {
    context,
    typeOfLeaveService,
    setState
  } = props;

  const setTypesOfLeave = useCallback((types: ITypeOfLeave[]) => setState(prevState => ({ ...prevState, typesOfLeave: types })), [setState]);
  const setIsLoadingTypesOfLeave = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingTypesOfLeave: isLoading })), [setState]);
  const setError = useCallback((error?: string) => setState(prevState => ({ ...prevState, error })), [setState]);

  const loadTypesOfLeave = useCallback(() => {
    console.log('[useTypesOfLeave] loadTypesOfLeave called');
    if (!context || !typeOfLeaveService) {
      console.log('[useTypesOfLeave] Cannot load types of leave: missing context or service');
      setTypesOfLeave([]);
      setIsLoadingTypesOfLeave(false);
      return;
    }

    void fetchTypesOfLeave(
      context,
      typeOfLeaveService,
      setIsLoadingTypesOfLeave,
      setTypesOfLeave,
      setError
    );
  }, [
      context, typeOfLeaveService,
      setTypesOfLeave, setIsLoadingTypesOfLeave, setError
  ]);

  useEffect(() => {
    console.log('[useTypesOfLeave] useEffect triggered for context/service:');
    if (context && typeOfLeaveService) {
      loadTypesOfLeave();
    } else {
        setTypesOfLeave([]);
        setIsLoadingTypesOfLeave(false);
    }
  }, [
    context,
    typeOfLeaveService,
    loadTypesOfLeave
  ]);

  return {
    loadTypesOfLeave
  };
};