// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableHooks.ts
import { useState, useEffect } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { 
  IExtendedWeeklyTimeRow,
  updateDisplayedTotalHours
} from './WeeklyTimeTableLogic';
import { WeeklyTimeTableUtils, IDayHoursComplete } from '../../../models/IWeeklyTimeTable';

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
 * Функция для обработки изменения времени в ячейке
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
    type: number;
    message: string;
  } | null>>
) => {
  return (rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string): void => {
    // Разбиваем ключ на имя дня и тип времени (start/end)
    const [dayName, timeType] = dayKey.split('-');
    
    // Создаем копию данных
    const newData = [...timeTableData];
    const rowDay = dayName.toLowerCase() as keyof IExtendedWeeklyTimeRow;
    const rowId = newData[rowIndex].id;
    
    // Проверяем, что rowDay - это день недели
    if (rowDay === 'saturday' || rowDay === 'sunday' || rowDay === 'monday' || 
        rowDay === 'tuesday' || rowDay === 'wednesday' || rowDay === 'thursday' || rowDay === 'friday') {
      
      // Получаем данные дня
      const dayData = newData[rowIndex][rowDay] as IDayHoursComplete;
      
      if (dayData) {
        // Определяем, изменяем время начала или окончания
        const timeToUpdate = timeType === 'end' ? 'end' : 'start';
        
        // Безопасно обновляем поле в объекте
        newData[rowIndex] = {
          ...newData[rowIndex],
          [rowDay]: {
            ...dayData,
            [timeToUpdate]: {
              ...dayData[timeToUpdate],
              [field]: value
            }
          }
        };
        
        // Пересчитываем общее время работы после изменения
        const row = newData[rowIndex];
        const totalHours = WeeklyTimeTableUtils.calculateTotalWorkHours(
          {
            monday: row.monday as IDayHoursComplete,
            tuesday: row.tuesday as IDayHoursComplete,
            wednesday: row.wednesday as IDayHoursComplete,
            thursday: row.thursday as IDayHoursComplete,
            friday: row.friday as IDayHoursComplete,
            saturday: row.saturday as IDayHoursComplete,
            sunday: row.sunday as IDayHoursComplete
          },
          row.lunch
        );
        
        // Обновляем общее время работы в строке
        newData[rowIndex] = {
          ...newData[rowIndex],
          totalHours
        };
        
        // Отмечаем строку как измененную
        const newChangedRows = new Set(changedRows);
        newChangedRows.add(rowId);
        setChangedRows(newChangedRows);
        
        // Сбрасываем статусное сообщение при внесении изменений
        setStatusMessage(null);
      }
    }
    
    setTimeTableData(newData);
    
    // Обновляем отображаемое общее время в первой строке каждого шаблона
    const updatedData = updateDisplayedTotalHours(newData);
    setTimeTableData(updatedData);
  };
};

/**
 * Функция для обработки изменения времени обеда
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
    type: number;
    message: string;
  } | null>>
) => {
  return (rowIndex: number, value: string): void => {
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    newData[rowIndex].lunch = value;
    console.log(`Changing lunch time for row ${rowIndex} to ${value}`);
    
    // Пересчитываем общее время работы после изменения времени обеда
    const row = newData[rowIndex];
    const totalHours = WeeklyTimeTableUtils.calculateTotalWorkHours(
      {
        monday: row.monday as IDayHoursComplete,
        tuesday: row.tuesday as IDayHoursComplete,
        wednesday: row.wednesday as IDayHoursComplete,
        thursday: row.thursday as IDayHoursComplete,
        friday: row.friday as IDayHoursComplete,
        saturday: row.saturday as IDayHoursComplete,
        sunday: row.sunday as IDayHoursComplete
      },
      value
    );
    
    // Обновляем общее время работы в строке
    newData[rowIndex] = {
      ...newData[rowIndex],
      totalHours,
      lunch: value
    };
    
    setTimeTableData(newData);
    
    // Отмечаем строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(rowId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при внесении изменений
    setStatusMessage(null);
    
    // Обновляем отображаемое общее время в первой строке каждого шаблона
    const updatedData = updateDisplayedTotalHours(newData);
    setTimeTableData(updatedData);
  };
};

/**
 * Функция для обработки изменения контракта
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
    type: number;
    message: string;
  } | null>>
) => {
  return (rowIndex: number, value: string): void => {
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    newData[rowIndex].total = value;
    setTimeTableData(newData);
    
    // Отмечаем строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(rowId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при внесении изменений
    setStatusMessage(null);
  };
};

/**
 * Функция для обновления общего времени для всех шаблонов
 * @param timeTableData Текущие данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @returns Функция для обновления общего времени
 */
export const useUpdateTotalHours = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>
) => {
  return (): void => {
    const updatedData = updateDisplayedTotalHours(timeTableData);
    setTimeTableData(updatedData);
    console.log('Updated displayed total hours for all templates');
  };
};