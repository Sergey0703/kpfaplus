// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableTabState.ts

import { useState, useCallback } from 'react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { 
  ITimetableTabState, 
  IWeekGroup, 
  IWeekInfo 
} from '../interfaces/TimetableInterfaces';

// Интерфейс для возвращаемого типа хука состояния
interface UseTimetableTabStateReturn {
  state: ITimetableTabState;
  setState: React.Dispatch<React.SetStateAction<ITimetableTabState>>;
  // Специализированные методы для работы с неделями
  toggleWeekExpand: (weekNum: number) => void;
  expandAllWeeks: () => void;
  collapseAllWeeks: () => void;
  setWeeksData: (weeksData: IWeekGroup[]) => void;
  setWeeks: (weeks: IWeekInfo[]) => void;
  setStaffRecords: (records: IStaffRecord[]) => void;
  setIsLoadingStaffRecords: (isLoading: boolean) => void;
  setErrorStaffRecords: (error?: string) => void;
}

/**
 * Custom hook для управления состоянием Timetable tab
 */
export const useTimetableTabState = (): UseTimetableTabStateReturn => {
  console.log('[useTimetableTabState] Initializing state hook');
  
  // Инициализируем состояние
  const [state, setState] = useState<ITimetableTabState>({
    selectedDate: new Date(),
    staffRecords: [],
    isLoadingStaffRecords: false,
    errorStaffRecords: undefined,
    
    // По умолчанию первая неделя развернута
    expandedWeeks: new Set([1]),
    weeksData: [],
    weeks: []
  });

  // Метод для переключения состояния развернутости недели
  const toggleWeekExpand = useCallback((weekNum: number): void => {
    console.log(`[useTimetableTabState] Toggling week ${weekNum} expand state`);
    
    setState(prevState => {
      const newExpandedWeeks = new Set(prevState.expandedWeeks);
      
      if (newExpandedWeeks.has(weekNum)) {
        newExpandedWeeks.delete(weekNum);
        console.log(`[useTimetableTabState] Collapsed week ${weekNum}`);
      } else {
        newExpandedWeeks.add(weekNum);
        console.log(`[useTimetableTabState] Expanded week ${weekNum}`);
      }
      
      // Обновляем также состояние isExpanded в weeksData
      const updatedWeeksData = prevState.weeksData.map(weekGroup => ({
        ...weekGroup,
        isExpanded: newExpandedWeeks.has(weekGroup.weekInfo.weekNum)
      }));
      
      return {
        ...prevState,
        expandedWeeks: newExpandedWeeks,
        weeksData: updatedWeeksData
      };
    });
  }, []);

  // Метод для разворачивания всех недель
  const expandAllWeeks = useCallback((): void => {
    console.log('[useTimetableTabState] Expanding all weeks');
    
    setState(prevState => {
      const allWeekNums = prevState.weeks.map(week => week.weekNum);
      const newExpandedWeeks = new Set(allWeekNums);
      
      // Обновляем состояние isExpanded в weeksData
      const updatedWeeksData = prevState.weeksData.map(weekGroup => ({
        ...weekGroup,
        isExpanded: true
      }));
      
      console.log(`[useTimetableTabState] Expanded ${allWeekNums.length} weeks`);
      
      return {
        ...prevState,
        expandedWeeks: newExpandedWeeks,
        weeksData: updatedWeeksData
      };
    });
  }, []);

  // Метод для сворачивания всех недель
  const collapseAllWeeks = useCallback((): void => {
    console.log('[useTimetableTabState] Collapsing all weeks');
    
    setState(prevState => {
      // Обновляем состояние isExpanded в weeksData
      const updatedWeeksData = prevState.weeksData.map(weekGroup => ({
        ...weekGroup,
        isExpanded: false
      }));
      
      return {
        ...prevState,
        expandedWeeks: new Set(), // Пустой Set - все недели свернуты
        weeksData: updatedWeeksData
      };
    });
  }, []);

  // Специализированные сеттеры для удобства
  const setWeeksData = useCallback((weeksData: IWeekGroup[]): void => {
    console.log(`[useTimetableTabState] Setting ${weeksData.length} week groups`);
    setState(prevState => ({ ...prevState, weeksData }));
  }, []);

  const setWeeks = useCallback((weeks: IWeekInfo[]): void => {
    console.log(`[useTimetableTabState] Setting ${weeks.length} weeks info`);
    setState(prevState => ({ ...prevState, weeks }));
  }, []);

  const setStaffRecords = useCallback((records: IStaffRecord[]): void => {
    console.log(`[useTimetableTabState] Setting ${records.length} staff records`);
    setState(prevState => ({ ...prevState, staffRecords: records }));
  }, []);

  const setIsLoadingStaffRecords = useCallback((isLoading: boolean): void => {
    console.log(`[useTimetableTabState] Setting loading state: ${isLoading}`);
    setState(prevState => ({ ...prevState, isLoadingStaffRecords: isLoading }));
  }, []);

  const setErrorStaffRecords = useCallback((error?: string): void => {
    console.log(`[useTimetableTabState] Setting error: ${error || 'none'}`);
    setState(prevState => ({ ...prevState, errorStaffRecords: error }));
  }, []);

  console.log('[useTimetableTabState] Current state:', {
    hasWeeks: state.weeks.length > 0,
    hasWeeksData: state.weeksData.length > 0,
    expandedWeeksCount: state.expandedWeeks.size,
    staffRecordsCount: state.staffRecords.length,
    isLoading: state.isLoadingStaffRecords
  });

  return {
    state,
    setState,
    toggleWeekExpand,
    expandAllWeeks,
    collapseAllWeeks,
    setWeeksData,
    setWeeks,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  };
};