// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSTabState.ts

import { useState } from 'react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { SRSDateUtils } from './SRSDateUtils';

/**
 * Интерфейс для состояния SRS Tab
 * Упрощенная версия по сравнению с ScheduleTab - только необходимые поля для SRS
 */
export interface ISRSTabState {
  // Основные даты периода
  fromDate: Date;                    // Дата начала периода (по умолчанию - первый день месяца)
  toDate: Date;                      // Дата окончания периода (по умолчанию - конец недели после fromDate)
  
  // Данные SRS записей
  srsRecords: IStaffRecord[];        // Записи SRS (только с TypeOfLeave)
  totalHours: string;                // Общее количество часов в формате "127:00"
  
  // Состояния загрузки
  isLoading: boolean;                // Общее состояние загрузки
  isLoadingSRS: boolean;             // Загрузка SRS данных
  
  // Ошибки
  error?: string;                    // Общая ошибка
  errorSRS?: string;                 // Ошибка загрузки SRS данных
  
  // Состояние изменений
  hasUnsavedChanges: boolean;        // Есть ли несохраненные изменения
  
  // Выбранные элементы (для массовых операций)
  selectedItems: Set<string>;       // ID выбранных записей
  
  // Дополнительные флаги
  isInitialized: boolean;           // Инициализирован ли компонент
}

/**
 * Возвращаемый тип хука состояния SRS Tab
 */
interface UseSRSTabStateReturn {
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
}

/**
 * Функция для получения сохраненных дат из sessionStorage
 * Пытается восстановить последние выбранные даты пользователя
 */
const getSavedDates = (): { fromDate: Date; toDate: Date } => {
  try {
    const savedFromDate = sessionStorage.getItem('srsTab_fromDate');
    const savedToDate = sessionStorage.getItem('srsTab_toDate');
    
    console.log('[useSRSTabState] Checking saved dates:', {
      savedFromDate,
      savedToDate
    });
    
    let fromDate: Date;
    let toDate: Date;
    
    // Восстанавливаем fromDate или используем первый день месяца по умолчанию
    if (savedFromDate) {
      try {
        const parsedFromDate = new Date(savedFromDate);
        if (!isNaN(parsedFromDate.getTime())) {
          fromDate = parsedFromDate;
          console.log('[useSRSTabState] Restored fromDate from sessionStorage:', fromDate.toISOString());
        } else {
          throw new Error('Invalid saved fromDate');
        }
      } catch (error) {
        console.warn('[useSRSTabState] Invalid saved fromDate, using default:', error);
        fromDate = SRSDateUtils.getFirstDayOfCurrentMonth();
      }
    } else {
      console.log('[useSRSTabState] No saved fromDate, using first day of current month');
      fromDate = SRSDateUtils.getFirstDayOfCurrentMonth();
    }
    
    // Восстанавливаем toDate или рассчитываем на основе fromDate
    if (savedToDate) {
      try {
        const parsedToDate = new Date(savedToDate);
        if (!isNaN(parsedToDate.getTime())) {
          // Проверяем, что сохраненная toDate имеет смысл относительно fromDate
          if (SRSDateUtils.shouldUpdateToDate(fromDate, parsedToDate)) {
            console.log('[useSRSTabState] Saved toDate needs update, recalculating');
            toDate = SRSDateUtils.getWeekEndAfterDate(fromDate);
          } else {
            toDate = parsedToDate;
            console.log('[useSRSTabState] Restored toDate from sessionStorage:', toDate.toISOString());
          }
        } else {
          throw new Error('Invalid saved toDate');
        }
      } catch (error) {
        console.warn('[useSRSTabState] Invalid saved toDate, calculating from fromDate:', error);
        toDate = SRSDateUtils.getWeekEndAfterDate(fromDate);
      }
    } else {
      console.log('[useSRSTabState] No saved toDate, calculating from fromDate');
      toDate = SRSDateUtils.getWeekEndAfterDate(fromDate);
    }
    
    console.log('[useSRSTabState] Final dates:', {
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      daysInRange: SRSDateUtils.calculateDaysInRange(fromDate, toDate)
    });
    
    return { fromDate, toDate };
    
  } catch (error) {
    console.error('[useSRSTabState] Error getting saved dates, using defaults:', error);
    
    // В случае любой ошибки используем значения по умолчанию
    const defaultFromDate = SRSDateUtils.getFirstDayOfCurrentMonth();
    const defaultToDate = SRSDateUtils.getWeekEndAfterDate(defaultFromDate);
    
    return { 
      fromDate: defaultFromDate, 
      toDate: defaultToDate 
    };
  }
};

/**
 * Функция для рассчета общего количества часов из записей SRS
 * *** ИСПРАВЛЕНО: Теперь форматирует в часы:минуты (HH:MM) ***
 * 
 * @param records Массив записей SRS
 * @returns Отформатированная строка с общим количеством часов в формате "40:20"
 */
const calculateTotalHours = (records: IStaffRecord[]): string => {
  try {
    if (!records || records.length === 0) {
      return '0:00';
    }
    
    let totalMinutes = 0;
    
    records.forEach((record, index) => {
      try {
        // Извлекаем рабочее время из поля WorkTime (формат "7.50" или "7:30")
        if (record.WorkTime) {
          const workTimeStr = record.WorkTime.toString();
          
          // *** ИСПРАВЛЕНО: Поддерживаем оба формата - точка и двоеточие ***
          let hours = 0;
          let minutes = 0;
          
          if (workTimeStr.includes(':')) {
            // Формат "7:30"
            const [hoursStr, minutesStr] = workTimeStr.split(':');
            hours = parseInt(hoursStr, 10) || 0;
            minutes = parseInt(minutesStr, 10) || 0;
          } else if (workTimeStr.includes('.')) {
            // Формат "7.50" (где .50 означает 50 минут)
            const [hoursStr, minutesDecimalStr] = workTimeStr.split('.');
            hours = parseInt(hoursStr, 10) || 0;
            const minutesDecimal = parseInt(minutesDecimalStr, 10) || 0;
            minutes = minutesDecimal; // Прямое преобразование, так как .50 = 50 минут
          } else {
            // Только часы
            hours = parseInt(workTimeStr, 10) || 0;
            minutes = 0;
          }
          
          // Конвертируем в общие минуты
          const recordMinutes = (hours * 60) + minutes;
          totalMinutes += recordMinutes;
          
          console.log(`[useSRSTabState] Record ${index}: ${workTimeStr} -> ${hours}h ${minutes}m = ${recordMinutes} total minutes`);
        }
        
        // Альтернативно, используем LeaveTime если WorkTime недоступно
        else if (record.LeaveTime && record.LeaveTime > 0) {
          const leaveHours = record.LeaveTime;
          const leaveMinutes = leaveHours * 60;
          totalMinutes += leaveMinutes;
          
          console.log(`[useSRSTabState] Record ${index}: LeaveTime ${leaveHours}h = ${leaveMinutes} minutes`);
        }
      } catch (recordError) {
        console.error(`[useSRSTabState] Error processing record ${index}:`, recordError);
      }
    });
    
    // *** ИСПРАВЛЕНО: Конвертируем в часы:минуты формат ***
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const formattedHours = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;
    
    console.log('[useSRSTabState] calculateTotalHours result:', {
      recordsCount: records.length,
      totalMinutes,
      totalHours,
      remainingMinutes,
      formattedResult: formattedHours
    });
    
    return formattedHours;
    
  } catch (error) {
    console.error('[useSRSTabState] Error calculating total hours:', error);
    return '0:00';
  }
};

/**
 * Custom hook для управления состоянием SRS Tab
 * Предоставляет централизованное управление состоянием и вспомогательные функции
 */
export const useSRSTabState = (): UseSRSTabStateReturn => {
  // Получаем сохраненные или дефолтные даты
  const { fromDate: savedFromDate, toDate: savedToDate } = getSavedDates();
  
  // Инициализируем состояние
  const [state, setState] = useState<ISRSTabState>({
    // Даты периода
    fromDate: savedFromDate,
    toDate: savedToDate,
    
    // Данные SRS
    srsRecords: [],
    totalHours: '0:00', // *** ИСПРАВЛЕНО: Инициализация в новом формате ***
    
    // Состояния загрузки
    isLoading: false,
    isLoadingSRS: false,
    
    // Ошибки
    error: undefined,
    errorSRS: undefined,
    
    // Изменения
    hasUnsavedChanges: false,
    
    // Выбранные элементы
    selectedItems: new Set<string>(),
    
    // Флаги
    isInitialized: false
  });
  
  console.log('[useSRSTabState] State initialized with dates:', {
    fromDate: state.fromDate.toISOString(),
    toDate: state.toDate.toISOString(),
    daysInRange: SRSDateUtils.calculateDaysInRange(state.fromDate, state.toDate)
  });
  
  return {
    state,
    setState
  };
};

/**
 * Вспомогательные функции для работы с состоянием SRS Tab
 * Эти функции можно использовать в компонентах для обновления состояния
 */
export const SRSTabStateHelpers = {
  
  /**
   * Обновляет SRS записи и пересчитывает общее количество часов
   * *** ИСПРАВЛЕНО: Теперь использует новый формат часы:минуты ***
   */
  updateSRSRecords: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    records: IStaffRecord[]
  ): void => {
    const totalHours = calculateTotalHours(records);
    
    setState(prevState => ({
      ...prevState,
      srsRecords: records,
      totalHours: totalHours, // *** Теперь в формате "40:20" ***
      isLoadingSRS: false,
      errorSRS: undefined
    }));
    
    console.log('[SRSTabStateHelpers] updateSRSRecords:', {
      recordsCount: records.length,
      totalHours
    });
  },
  
  /**
   * Обновляет даты и сохраняет их в sessionStorage
   */
  updateDates: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    fromDate?: Date,
    toDate?: Date
  ): void => {
    setState(prevState => {
      const newFromDate = fromDate || prevState.fromDate;
      const newToDate = toDate || prevState.toDate;
      
      // Сохраняем в sessionStorage
      try {
        sessionStorage.setItem('srsTab_fromDate', newFromDate.toISOString());
        sessionStorage.setItem('srsTab_toDate', newToDate.toISOString());
        console.log('[SRSTabStateHelpers] Dates saved to sessionStorage');
      } catch (error) {
        console.warn('[SRSTabStateHelpers] Failed to save dates to sessionStorage:', error);
      }
      
      return {
        ...prevState,
        fromDate: newFromDate,
        toDate: newToDate
      };
    });
  },
  
  /**
   * Устанавливает состояние загрузки SRS
   */
  setLoadingSRS: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    isLoading: boolean
  ): void => {
    setState(prevState => ({
      ...prevState,
      isLoadingSRS: isLoading,
      ...(isLoading && { errorSRS: undefined }) // Очищаем ошибку при начале загрузки
    }));
  },
  
  /**
   * Устанавливает ошибку загрузки SRS
   */
  setErrorSRS: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    error?: string
  ): void => {
    setState(prevState => ({
      ...prevState,
      errorSRS: error,
      isLoadingSRS: false
    }));
  },
  
  /**
   * Обновляет выбранные элементы
   */
  updateSelectedItems: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    selectedItems: Set<string>
  ): void => {
    setState(prevState => ({
      ...prevState,
      selectedItems: new Set(selectedItems)
    }));
  },
  
  /**
   * Переключает выбор элемента
   */
  toggleItemSelection: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    itemId: string
  ): void => {
    setState(prevState => {
      const newSelectedItems = new Set(prevState.selectedItems);
      
      if (newSelectedItems.has(itemId)) {
        newSelectedItems.delete(itemId);
      } else {
        newSelectedItems.add(itemId);
      }
      
      return {
        ...prevState,
        selectedItems: newSelectedItems
      };
    });
  },
  
  /**
   * Очищает все выбранные элементы
   */
  clearSelection: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    setState(prevState => ({
      ...prevState,
      selectedItems: new Set<string>()
    }));
  },
  
  /**
   * Выбирает все элементы
   */
  selectAll: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    setState(prevState => {
      const allIds = prevState.srsRecords.map(record => record.ID);
      return {
        ...prevState,
        selectedItems: new Set(allIds)
      };
    });
  },
  
  /**
   * Устанавливает флаг несохраненных изменений
   */
  setHasUnsavedChanges: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    hasChanges: boolean
  ): void => {
    setState(prevState => ({
      ...prevState,
      hasUnsavedChanges: hasChanges
    }));
  },
  
  /**
   * Помечает компонент как инициализированный
   */
  setInitialized: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    setState(prevState => ({
      ...prevState,
      isInitialized: true
    }));
  },
  
  /**
   * Сбрасывает состояние к начальным значениям
   */
  resetState: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    const { fromDate, toDate } = getSavedDates();
    
    setState({
      fromDate,
      toDate,
      srsRecords: [],
      totalHours: '0:00', // *** ИСПРАВЛЕНО: Сброс в новом формате ***
      isLoading: false,
      isLoadingSRS: false,
      error: undefined,
      errorSRS: undefined,
      hasUnsavedChanges: false,
      selectedItems: new Set<string>(),
      isInitialized: false
    });
    
    console.log('[SRSTabStateHelpers] State reset to initial values');
  }
};