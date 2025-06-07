// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableHooks.ts
// ИСПРАВЛЕНО: Поиск строк по ID вместо индекса для корректной работы с фильтрованными данными

import { useState, useEffect } from 'react';
import { IDropdownOption, MessageBarType } from '@fluentui/react';
import { 
  IExtendedWeeklyTimeRow,
  updateDisplayedTotalHours
} from './WeeklyTimeTableLogic';
import { WeeklyTimeTableUtils, IDayHoursComplete } from '../../../models/IWeeklyTimeTable';
import { DateUtils } from '../../CustomDatePicker/CustomDatePicker';

/**
 * Хук для получения опций для выпадающего списка часов
 * @returns Массив опций для выпадающего списка часов
 */
export const useHoursOptions = (): IDropdownOption[] => {
  const [options, setOptions] = useState<IDropdownOption[]>([]);

  useEffect(() => {
    const hourOptions: IDropdownOption[] = [];
    for (let i = 0; i <= 23; i++) {
      const value = i.toString().padStart(2, '0');
      hourOptions.push({ key: value, text: value });
    }
    setOptions(hourOptions);
  }, []);

  return options;
};

/**
 * Хук для получения опций для выпадающего списка минут
 * @returns Массив опций для выпадающего списка минут
 */
export const useMinutesOptions = (): IDropdownOption[] => {
  const [options, setOptions] = useState<IDropdownOption[]>([]);

  useEffect(() => {
    const minuteOptions: IDropdownOption[] = [];
    for (let i = 0; i <= 55; i += 5) {
      const value = i.toString().padStart(2, '0');
      minuteOptions.push({ key: value, text: value });
    }
    setOptions(minuteOptions);
  }, []);

  return options;
};

/**
 * Хук для получения опций для выпадающего списка времени обеда
 * @returns Массив опций для выпадающего списка времени обеда
 */
export const useLunchOptions = (): IDropdownOption[] => {
  const [options, setOptions] = useState<IDropdownOption[]>([]);

  useEffect(() => {
    const lunchOptions: IDropdownOption[] = [];
    for (let i = 0; i <= 60; i += 5) {
      lunchOptions.push({ key: i.toString(), text: i.toString() });
    }
    setOptions(lunchOptions);
  }, []);

  return options;
};

/**
 * ИСПРАВЛЕННАЯ функция обработки изменения времени - теперь принимает ID строки
 * @param timeTableData Текущие данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @returns Функция-обработчик изменения времени
 */
export const useTimeChangeHandler = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | undefined>>
): ((rowId: string, dayKey: string, field: 'hours' | 'minutes', value: string) => void) => {
  return (rowId: string, dayKey: string, field: 'hours' | 'minutes', value: string): void => {
    console.log(`[TimeChangeHandler] Called with rowId=${rowId}, dayKey=${dayKey}, field=${field}, value=${value}`);
    
    // ИСПРАВЛЕНО: Находим строку по ID вместо использования индекса
    const targetRowIndex = timeTableData.findIndex(row => row.id === rowId);
    
    if (targetRowIndex === -1) {
      console.error(`[TimeChangeHandler] Row with ID ${rowId} not found in timeTableData`);
      return;
    }
    
    const targetRow = timeTableData[targetRowIndex];
    
    // Проверяем удаление по найденной строке
    const isDeleted = targetRow.deleted === 1 || targetRow.Deleted === 1;
    
    console.log(`[TimeChangeHandler] Found row: ID=${targetRow.id}, deleted=${targetRow.deleted}, Deleted=${targetRow.Deleted}, isDeleted=${isDeleted}`);
    
    if (isDeleted) {
      console.log(`[TimeChangeHandler] Cannot change time for deleted row ID: ${targetRow.id}`);
      setStatusMessage({
        type: MessageBarType.warning,
        message: 'Cannot edit deleted items. Restore the item first.'
      });
      
      setTimeout(() => {
        setStatusMessage(undefined);
      }, 3000);
      
      return;
    }
    
    const [dayName, timeType] = dayKey.split('-');
    const newData = [...timeTableData];
    const rowDay = dayName.toLowerCase() as keyof IExtendedWeeklyTimeRow;
    
    if (rowDay === 'saturday' || rowDay === 'sunday' || rowDay === 'monday' || 
        rowDay === 'tuesday' || rowDay === 'wednesday' || rowDay === 'thursday' || rowDay === 'friday') {
      
      const dayData = newData[targetRowIndex][rowDay] as IDayHoursComplete;
      
      if (dayData) {
        const timeToUpdate = timeType === 'end' ? 'end' : 'start';
        
        // Создаем обновленные данные времени
        const updatedTimeData = {
          ...dayData[timeToUpdate],
          [field]: value
        };
        
        // Применяем изменение
        newData[targetRowIndex] = {
          ...newData[targetRowIndex],
          [rowDay]: {
            ...dayData,
            [timeToUpdate]: updatedTimeData
          }
        };
        
        // Создаем нормализованные объекты времени для расчета
        const normalizedDayData: Record<string, IDayHoursComplete> = {};
        
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
          const dayKey = day as keyof IExtendedWeeklyTimeRow;
          const dayValue = newData[targetRowIndex][dayKey] as IDayHoursComplete;
          
          if (dayValue) {
            normalizedDayData[day] = {
              start: dayValue.start,
              end: dayValue.end
            };
          }
        });
        
        // Пересчитываем общее время работы
        const totalHours = WeeklyTimeTableUtils.calculateTotalWorkHours(
          {
            monday: normalizedDayData.monday,
            tuesday: normalizedDayData.tuesday,
            wednesday: normalizedDayData.wednesday,
            thursday: normalizedDayData.thursday,
            friday: normalizedDayData.friday,
            saturday: normalizedDayData.saturday,
            sunday: normalizedDayData.sunday
          },
          newData[targetRowIndex].lunch
        );
        
        // Обновляем общее время работы в строке
        newData[targetRowIndex] = {
          ...newData[targetRowIndex],
          totalHours
        };
        
        // Отмечаем строку как измененную
        const newChangedRows = new Set(changedRows);
        newChangedRows.add(rowId);
        setChangedRows(newChangedRows);
        
        // Сбрасываем статусное сообщение при внесении корректных изменений
        setStatusMessage(undefined);
        
        // Логируем изменение
        console.log(`[TimeChange] Updated ${dayName}.${timeType}.${field} to ${value} for row ID: ${rowId}`);
        console.log(`[TimeChange] New total hours: ${totalHours}`);
      } else {
        console.error(`Day data not found for ${rowDay} in row ID: ${rowId}`);
      }
    } else {
      console.error(`Invalid day key: ${dayKey}`);
    }
    
    // Обновляем данные таблицы
    setTimeTableData(newData);
    
    // Обновляем отображаемое общее время в первой строке каждого шаблона
    const updatedData = updateDisplayedTotalHours(newData);
    setTimeTableData(updatedData);
  };
};

/**
 * ИСПРАВЛЕННАЯ функция для обработки изменения времени обеда - теперь принимает ID строки
 * @param timeTableData Текущие данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @returns Функция-обработчик изменения времени обеда
 */
export const useLunchChangeHandler = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | undefined>>
): ((rowId: string, value: string) => void) => {
  return (rowId: string, value: string): void => {
    console.log(`[LunchChangeHandler] Called with rowId=${rowId}, value=${value}`);
    
    // ИСПРАВЛЕНО: Находим строку по ID вместо использования индекса
    const targetRowIndex = timeTableData.findIndex(row => row.id === rowId);
    
    if (targetRowIndex === -1) {
      console.error(`[LunchChangeHandler] Row with ID ${rowId} not found in timeTableData`);
      return;
    }
    
    const targetRow = timeTableData[targetRowIndex];
    
    // Проверяем удаление по найденной строке
    const isDeleted = targetRow.deleted === 1 || targetRow.Deleted === 1;
    
    console.log(`[LunchChangeHandler] Found row: ID=${targetRow.id}, deleted=${targetRow.deleted}, Deleted=${targetRow.Deleted}, isDeleted=${isDeleted}`);
    
    // Если строка удалена, не делаем никаких изменений
    if (isDeleted) {
      console.log(`[LunchChangeHandler] Cannot change lunch time for deleted row ID: ${targetRow.id}`);
      setStatusMessage({
        type: MessageBarType.warning,
        message: 'Cannot edit deleted items. Restore the item first.'
      });
      
      // Скрываем сообщение через некоторое время
      setTimeout(() => {
        setStatusMessage(undefined);
      }, 3000);
      
      return;
    }
    
    // Валидация времени обеда
    const lunchMinutes = parseInt(value, 10);
    if (isNaN(lunchMinutes) || lunchMinutes < 0 || lunchMinutes > 120) {
      setStatusMessage({
        type: MessageBarType.error,
        message: 'Lunch time must be between 0 and 120 minutes'
      });
      
      setTimeout(() => {
        setStatusMessage(undefined);
      }, 5000);
      
      return;
    }
    
    const newData = [...timeTableData];
    
    newData[targetRowIndex].lunch = value;
    console.log(`[LunchChangeHandler] Changing lunch time for row ID: ${rowId} to ${value}`);
    
    // Пересчитываем общее время работы после изменения времени обеда
    const updatedRow = newData[targetRowIndex];
    const totalHours = WeeklyTimeTableUtils.calculateTotalWorkHours(
      {
        monday: updatedRow.monday as IDayHoursComplete,
        tuesday: updatedRow.tuesday as IDayHoursComplete,
        wednesday: updatedRow.wednesday as IDayHoursComplete,
        thursday: updatedRow.thursday as IDayHoursComplete,
        friday: updatedRow.friday as IDayHoursComplete,
        saturday: updatedRow.saturday as IDayHoursComplete,
        sunday: updatedRow.sunday as IDayHoursComplete
      },
      value
    );
    
    // Обновляем общее время работы в строке
    newData[targetRowIndex] = {
      ...newData[targetRowIndex],
      totalHours,
      lunch: value
    };
    
    setTimeTableData(newData);
    
    // Отмечаем строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(rowId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при внесении изменений
    setStatusMessage(undefined);
    
    // Обновляем отображаемое общее время в первой строке каждого шаблона
    const updatedData = updateDisplayedTotalHours(newData);
    setTimeTableData(updatedData);
  };
};

/**
 * ИСПРАВЛЕННАЯ функция для обработки изменения контракта - теперь принимает ID строки
 * @param timeTableData Текущие данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @returns Функция-обработчик изменения контракта
 */
export const useContractChangeHandler = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | undefined>>
): ((rowId: string, value: string) => void) => {
  return (rowId: string, value: string): void => {
    console.log(`[ContractChangeHandler] Called with rowId=${rowId}, value=${value}`);
    
    // ИСПРАВЛЕНО: Находим строку по ID вместо использования индекса
    const targetRowIndex = timeTableData.findIndex(row => row.id === rowId);
    
    if (targetRowIndex === -1) {
      console.error(`[ContractChangeHandler] Row with ID ${rowId} not found in timeTableData`);
      return;
    }
    
    const targetRow = timeTableData[targetRowIndex];
    
    // Проверяем удаление по найденной строке
    const isDeleted = targetRow.deleted === 1 || targetRow.Deleted === 1;
    
    console.log(`[ContractChangeHandler] Found row: ID=${targetRow.id}, deleted=${targetRow.deleted}, Deleted=${targetRow.Deleted}, isDeleted=${isDeleted}`);
    
    // Если строка удалена, не делаем никаких изменений
    if (isDeleted) {
      console.log(`[ContractChangeHandler] Cannot change contract for deleted row ID: ${targetRow.id}`);
      setStatusMessage({
        type: MessageBarType.warning,
        message: 'Cannot edit deleted items. Restore the item first.'
      });
      
      // Скрываем сообщение через некоторое время
      setTimeout(() => {
        setStatusMessage(undefined);
      }, 3000);
      
      return;
    }
    
    // Валидация значения контракта
    const contractNumber = parseInt(value, 10);
    if (isNaN(contractNumber) || contractNumber < 1 || contractNumber > 10) {
      setStatusMessage({
        type: MessageBarType.error,
        message: 'Contract number must be between 1 and 10'
      });
      
      setTimeout(() => {
        setStatusMessage(undefined);
      }, 5000);
      
      return;
    }
    
    const newData = [...timeTableData];
    
    newData[targetRowIndex].total = value;
    console.log(`[ContractChangeHandler] Changing contract for row ID: ${rowId} to ${value}`);
    
    setTimeTableData(newData);
    
    // Отмечаем строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(rowId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при внесении изменений
    setStatusMessage(undefined);
  };
};

/**
 * Хук для обновления общего времени для всех шаблонов
 * @param timeTableData Текущие данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @returns Функция для обновления общего времени
 */
export const useUpdateTotalHours = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>
): (() => void) => {
  return (): void => {
    const updatedData = updateDisplayedTotalHours(timeTableData);
    setTimeTableData(updatedData);
    console.log('[UpdateTotalHours] Updated displayed total hours for all templates');
  };
};

/**
 * Получение информации о текущем времени/дате (статическая версия)
 * Полезна для отладки проблем с временными зонами
 * @returns Объект с информацией о текущем времени
 */
export const getCurrentTimeInfo = (): {
  currentDate: Date;
  normalizedDate: Date;
  timeZone: string;
  utcOffset: number;
} => {
  const currentDate = new Date();
  const normalizedDate = DateUtils.normalizeDateToUTCMidnight(currentDate);
  
  return {
    currentDate,
    normalizedDate,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcOffset: currentDate.getTimezoneOffset()
  };
};