// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useHolidaysAndLeaves.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths
import { HolidaysService, IHoliday } from '../../../../services/HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from '../../../../services/DaysOfLeavesService';
// Corrected import path - ScheduleTabApi is sibling to utils
import { fetchHolidaysForMonthAndYear, fetchLeavesForMonthAndYear } from '../ScheduleTabApi';
// Corrected import path - types is up 4 levels from utils - IMPORT IStaffMember here
import { IStaffMember } from '../../../../models/types';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder

interface UseHolidaysAndLeavesProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedStaff?: IStaffMember; // <-- Changed from IStaffBasic
  currentUserId?: string;
  managingGroupId?: string;
  holidaysService?: HolidaysService;
  daysOfLeavesService?: DaysOfLeavesService;
  // State setters passed from orchestrator
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

interface UseHolidaysAndLeavesReturn {
  loadHolidaysAndLeaves: () => void;
}

export const useHolidaysAndLeaves = (props: UseHolidaysAndLeavesProps): UseHolidaysAndLeavesReturn => {
  const {
    context,
    selectedDate,
    selectedStaff,
    currentUserId,
    managingGroupId,
    holidaysService,
    daysOfLeavesService,
    setState
  } = props;

  const setHolidays = useCallback((holidays: IHoliday[]) => setState(prevState => ({ ...prevState, holidays })), [setState]);
  const setIsLoadingHolidays = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingHolidays: isLoading })), [setState]);
  const setLeaves = useCallback((leaves: ILeaveDay[]) => setState(prevState => ({ ...prevState, leaves })), [setState]);
  const setIsLoadingLeaves = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingLeaves: isLoading })), [setState]);
  const setError = useCallback((error?: string) => setState(prevState => ({ ...prevState, error })), [setState]);

  const loadHolidaysAndLeaves = useCallback(() => {
    console.log('[useHolidaysAndLeaves] loadHolidaysAndLeaves called for:', selectedDate.toISOString());
    if (!context) {
      console.log('[useHolidaysAndLeaves] Cannot load data: missing context');
      setIsLoadingHolidays(false);
      setIsLoadingLeaves(false);
      setHolidays([]);
      setLeaves([]);
      return;
    }

    // Load holidays
    if (holidaysService) {
        void fetchHolidaysForMonthAndYear(
            context,
            selectedDate,
            setIsLoadingHolidays,
            setHolidays,
            setError
        );
    } else {
        console.warn('[useHolidaysAndLeaves] Holidays service not available');
        setIsLoadingHolidays(false);
        setHolidays([]);
    }

    // Load leaves, if staff selected and service available
    if (selectedStaff?.employeeId && daysOfLeavesService) { // Still using employeeId property from IStaffMember
      void fetchLeavesForMonthAndYear(
        context,
        selectedDate,
        parseInt(selectedStaff.employeeId, 10),
        currentUserId ? parseInt(currentUserId, 10) : undefined,
        managingGroupId ? parseInt(managingGroupId, 10) : undefined,
        setIsLoadingLeaves,
        setLeaves,
        setError
      );
    } else {
        console.log('[useHolidaysAndLeaves] Cannot load leaves: missing selected staff or service');
        setIsLoadingLeaves(false);
        setLeaves([]);
    }
  }, [
      context, selectedDate, selectedStaff?.employeeId, currentUserId, managingGroupId,
      holidaysService, daysOfLeavesService,
      setIsLoadingHolidays, setHolidays, setIsLoadingLeaves, setLeaves, setError
  ]);

  useEffect(() => {
    console.log('[useHolidaysAndLeaves] useEffect triggered for selectedDate/selectedStaff/context/services:');
     if (context) {
        loadHolidaysAndLeaves();
     }
  }, [
    context,
    selectedDate,
    selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    holidaysService,
    daysOfLeavesService,
    loadHolidaysAndLeaves
  ]);

  return {
    loadHolidaysAndLeaves
  };
};