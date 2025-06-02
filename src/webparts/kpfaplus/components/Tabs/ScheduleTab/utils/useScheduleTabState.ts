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

 staffRecords: IStaffRecord[]; // Записи ТОЛЬКО для текущей страницы
 isLoadingStaffRecords: boolean;
 errorStaffRecords?: string; // Specific error for staff records

 currentPage: number;      // Текущая страница (начинается с 1)
 itemsPerPage: number;     // Количество записей на странице
 totalItemCount: number;   // Общее количество записей, соответствующих фильтрам (получено от сервиса)
 
 showDeleted: boolean;     // Флаг для отображения удаленных записей
 hasNextPage: boolean;
}

// Определяем возвращаемый тип хука состояния
interface UseScheduleTabStateReturn {
 state: IScheduleTabState;
 setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
}

// Функция для получения первого дня текущего месяца
const getFirstDayOfCurrentMonth = (): Date => {
 const now = new Date();
 return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Функция для получения сохраненной даты из sessionStorage
const getSavedSelectedDate = (): Date => {
 try {
   const savedDate = sessionStorage.getItem('scheduleTab_selectedDate');
   if (savedDate) {
     const parsedDate = new Date(savedDate);
     // Проверяем, что дата валидна
     if (!isNaN(parsedDate.getTime())) {
       console.log('[useScheduleTabState] Restored selected date from sessionStorage:', parsedDate.toISOString());
       return parsedDate;
     } else {
       console.warn('[useScheduleTabState] Invalid date found in sessionStorage, using first day of current month');
     }
   } else {
     console.log('[useScheduleTabState] No saved date found in sessionStorage, using first day of current month');
   }
 } catch (error) {
   console.warn('[useScheduleTabState] Error reading saved date from sessionStorage:', error);
 }
 
 // Возвращаем первый день текущего месяца по умолчанию
 const firstDay = getFirstDayOfCurrentMonth();
 console.log('[useScheduleTabState] Using first day of current month as default:', firstDay.toISOString());
 return firstDay;
};

// Custom hook to manage the main state
export const useScheduleTabState = (): UseScheduleTabStateReturn => {
 // Инициализируем состояние, включая новые поля пагинации и showDeleted
 const [state, setState] = useState<IScheduleTabState>({
   selectedDate: getSavedSelectedDate(), // Используем сохраненную дату или первый день месяца
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
   errorStaffRecords: undefined,

   currentPage: 1,       // Начинаем с первой страницы
   itemsPerPage: 60,     // Устанавливаем количество элементов на странице по умолчанию
   totalItemCount: 0,    // Изначально общее количество записей равно 0
   
   showDeleted: false,   // По умолчанию удаленные записи не показываем
   hasNextPage: false,  
 });

 console.log('[useScheduleTabState] State initialized with selectedDate:', state.selectedDate.toISOString());

 return {
   state,
   setState,
 };
};