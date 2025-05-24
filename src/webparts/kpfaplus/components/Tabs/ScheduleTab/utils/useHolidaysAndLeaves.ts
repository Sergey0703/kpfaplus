// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useHolidaysAndLeaves.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
// ИСПРАВЛЕНО: Правильные импорты типов
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
// Corrected import path - ScheduleTabApi is sibling to utils
import { fetchHolidaysForMonthAndYear, fetchLeavesForMonthAndYear } from '../ScheduleTabApi';
// Corrected import path - types is up 4 levels from utils - IMPORT IStaffMember here
import { IStaffMember } from '../../../../models/types';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder

interface UseHolidaysAndLeavesProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
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
    setState
  } = props;

  // Создаем функции для обновления состояния
  const setHolidays = useCallback((holidays: IHoliday[]) => {
    console.log('[useHolidaysAndLeaves] Setting holidays:', holidays.length);
    setState(prevState => ({ ...prevState, holidays }));
  }, [setState]);

  const setIsLoadingHolidays = useCallback((isLoading: boolean) => {
    console.log('[useHolidaysAndLeaves] Setting isLoadingHolidays:', isLoading);
    setState(prevState => ({ ...prevState, isLoadingHolidays: isLoading }));
  }, [setState]);

  const setLeaves = useCallback((leaves: ILeaveDay[]) => {
    console.log('[useHolidaysAndLeaves] Setting leaves:', leaves.length);
    setState(prevState => ({ ...prevState, leaves }));
  }, [setState]);

  const setIsLoadingLeaves = useCallback((isLoading: boolean) => {
    console.log('[useHolidaysAndLeaves] Setting isLoadingLeaves:', isLoading);
    setState(prevState => ({ ...prevState, isLoadingLeaves: isLoading }));
  }, [setState]);

  const setError = useCallback((error?: string) => {
    if (error) {
      console.error('[useHolidaysAndLeaves] Setting error:', error);
    }
    setState(prevState => ({ ...prevState, error }));
  }, [setState]);

  const loadHolidaysAndLeaves = useCallback(() => {
    console.log('[useHolidaysAndLeaves] loadHolidaysAndLeaves called with:', {
      date: selectedDate.toISOString(),
      hasContext: !!context,
      hasSelectedStaff: !!selectedStaff,
      staffEmployeeId: selectedStaff?.employeeId,
      currentUserId,
      managingGroupId
    });

    if (!context) {
      console.log('[useHolidaysAndLeaves] Cannot load data: missing context');
      setIsLoadingHolidays(false);
      setIsLoadingLeaves(false);
      setHolidays([]);
      setLeaves([]);
      return;
    }

    // Загружаем праздники
    console.log('[useHolidaysAndLeaves] Loading holidays for date:', selectedDate.toLocaleDateString());
    void fetchHolidaysForMonthAndYear(
      context,
      selectedDate,
      setIsLoadingHolidays,
      setHolidays,
      setError
    );

    // Загружаем отпуска, если есть выбранный сотрудник
    if (selectedStaff?.employeeId) {
      console.log('[useHolidaysAndLeaves] Loading leaves for staff:', {
        employeeId: selectedStaff.employeeId,
        staffName: selectedStaff.name,
        currentUserId,
        managingGroupId
      });

      // ИСПРАВЛЕНО: передаем правильные параметры как в старой версии
      void fetchLeavesForMonthAndYear(
        context,
        selectedDate,
        parseInt(selectedStaff.employeeId, 10), // Преобразуем в число
        currentUserId ? parseInt(currentUserId, 10) : undefined,
        managingGroupId ? parseInt(managingGroupId, 10) : undefined,
        setIsLoadingLeaves,
        setLeaves,
        setError
      );
    } else {
      console.log('[useHolidaysAndLeaves] Cannot load leaves: missing selected staff or employeeId');
      setIsLoadingLeaves(false);
      setLeaves([]);
    }
  }, [
    context, 
    selectedDate, 
    selectedStaff?.employeeId, 
    selectedStaff?.name,
    currentUserId, 
    managingGroupId,
    setIsLoadingHolidays, 
    setHolidays, 
    setIsLoadingLeaves, 
    setLeaves, 
    setError
  ]);

  // Эффект для загрузки данных при изменении зависимостей
  useEffect(() => {
    console.log('[useHolidaysAndLeaves] useEffect triggered for holidays and leaves loading');
    console.log('[useHolidaysAndLeaves] Dependencies:', {
      hasContext: !!context,
      selectedDate: selectedDate.toISOString(),
      selectedStaffEmployeeId: selectedStaff?.employeeId,
      currentUserId,
      managingGroupId
    });

    if (context) {
      loadHolidaysAndLeaves();
    } else {
      console.log('[useHolidaysAndLeaves] Context not available, clearing data');
      setIsLoadingHolidays(false);
      setIsLoadingLeaves(false);
      setHolidays([]);
      setLeaves([]);
    }
  }, [
    context,
    selectedDate,
    selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    loadHolidaysAndLeaves
  ]);

  return {
    loadHolidaysAndLeaves
  };
};