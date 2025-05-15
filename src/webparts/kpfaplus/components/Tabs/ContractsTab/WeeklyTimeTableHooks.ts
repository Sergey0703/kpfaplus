// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableHooks.ts
import { useState, useEffect } from 'react';
import { IDropdownOption, MessageBarType } from '@fluentui/react';
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
    type: MessageBarType;
    message: string;
  } | undefined>>
): ((rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string) => void) => {
  return (rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string): void => {
    // Проверяем, существует ли строка с таким индексом
    if (rowIndex < 0 || rowIndex >= timeTableData.length) {
      console.error(`Invalid row index: ${rowIndex}`);
      return;
    }
    
    // Проверяем, удалена ли строка
    const row = timeTableData[rowIndex];
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // Если строка удалена, не делаем никаких изменений
    if (isDeleted) {
      console.log(`Cannot change time for deleted row ID: ${row.id}`);
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
        const updatedRow = newData[rowIndex];
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
          updatedRow.lunch
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
        setStatusMessage(undefined);
        
        // Выводим информацию об изменении для отладки
        console.log(`Updated ${dayName}.${timeType}.${field} to ${value} for row ${rowIndex} (ID: ${rowId})`);
        console.log(`New total hours: ${totalHours}`);
      } else {
        console.error(`Day data not found for ${rowDay} in row ${rowIndex}`);
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
    type: MessageBarType;
    message: string;
  } | undefined>>
): ((rowIndex: number, value: string) => void) => {
  return (rowIndex: number, value: string): void => {
    // Проверяем, существует ли строка с таким индексом
    if (rowIndex < 0 || rowIndex >= timeTableData.length) {
      console.error(`Invalid row index: ${rowIndex}`);
      return;
    }
    
    // Проверяем, удалена ли строка
    const row = timeTableData[rowIndex];
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // Если строка удалена, не делаем никаких изменений
    if (isDeleted) {
      console.log(`Cannot change lunch time for deleted row ID: ${row.id}`);
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
    
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    newData[rowIndex].lunch = value;
    console.log(`Changing lunch time for row ${rowIndex} to ${value}`);
    
    // Пересчитываем общее время работы после изменения времени обеда
    const updatedRow = newData[rowIndex];
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
    setStatusMessage(undefined);
    
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
    type: MessageBarType;
    message: string;
  } | undefined>>
): ((rowIndex: number, value: string) => void) => {
  return (rowIndex: number, value: string): void => {
    // Проверяем, существует ли строка с таким индексом
    if (rowIndex < 0 || rowIndex >= timeTableData.length) {
      console.error(`Invalid row index: ${rowIndex}`);
      return;
    }
    
    // Проверяем, удалена ли строка
    const row = timeTableData[rowIndex];
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // Если строка удалена, не делаем никаких изменений
    if (isDeleted) {
      console.log(`Cannot change contract for deleted row ID: ${row.id}`);
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
    
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    newData[rowIndex].total = value;
    console.log(`Changing contract for row ${rowIndex} to ${value}`);
    
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
 * Функция для обновления общего времени для всех шаблонов
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
    console.log('Updated displayed total hours for all templates');
  };
};