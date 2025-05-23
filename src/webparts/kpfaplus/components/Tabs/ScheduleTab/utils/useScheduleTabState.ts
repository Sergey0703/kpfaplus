// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useScheduleTabState.ts

import { useState } from 'react';
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

// Интерфейс для общего состояния компонента/хуков
export interface IScheduleTabState {
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean; // General loading state (can be used for initial load/mutations)
  error?: string; // General error state

  holidays: IHoliday[];
  isLoadingHolidays: boolean;

  leaves: ILeaveDay[];
  isLoadingLeaves: boolean;

  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;

  // --- ИЗМЕНЕНО ДЛЯ ПАГИНАЦИИ ---
  staffRecords: IStaffRecord[]; // Записи ТОЛЬКО для текущей страницы
  isLoadingStaffRecords: boolean;
  errorStaffRecords?: string; // Specific error for staff records

  currentPage: number;      // Текущая страница (начинается с 1)
  itemsPerPage: number;     // Количество записей на странице
  totalItemCount: number;   // Общее количество записей, соответствующих фильтрам (получено от сервиса)
  // -------------------------------
}

// Определяем возвращаемый тип хука состояния
interface UseScheduleTabStateReturn {
  state: IScheduleTabState;
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

// Custom hook to manage the main state
export const useScheduleTabState = (): UseScheduleTabStateReturn => {
  // Инициализируем состояние, включая новые поля пагинации
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

    // --- ИНИЦИАЛИЗАЦИЯ ДЛЯ ПАГИНАЦИИ ---
    staffRecords: [],
    isLoadingStaffRecords: false,
    errorStaffRecords: undefined,

    currentPage: 1,       // Начинаем с первой страницы
    itemsPerPage: 20,     // Устанавливаем количество элементов на странице по умолчанию
    totalItemCount: 0     // Изначально общее количество записей равно 0
    // -----------------------------------
  });

  // console.log('[useScheduleTabState] State hook initialized'); // Логируем меньше в утилитарных хуках

  return {
    state,
    setState,
  };
};