// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSTabState.ts

import { useState } from 'react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { IHoliday } from '../../../../services/HolidaysService'; // *** НОВЫЙ ИМПОРТ ***
import { SRSDateUtils } from './SRSDateUtils';

/**
 * Интерфейс для состояния SRS Tab
 * ОБНОВЛЕНО: Добавлены поля для типов отпусков, праздников и showDeleted
 */
export interface ISRSTabState {
  // Основные даты периода
  fromDate: Date;                    // Дата начала периода (по умолчанию - первый день месяца)
  toDate: Date;                      // Дата окончания периода (по умолчанию - конец недели после fromDate)
  
  // Данные SRS записей
  srsRecords: IStaffRecord[];        // Записи SRS (только с TypeOfLeave)
  totalHours: string;                // Общее количество часов в формате "127:00"
  
  // Типы отпусков
  typesOfLeave: ITypeOfLeave[];      // Справочник типов отпусков
  isLoadingTypesOfLeave: boolean;    // Состояние загрузки типов отпусков
  
  // *** НОВОЕ: Праздники ***
  holidays: IHoliday[];              // Справочник праздников для диапазона дат
  isLoadingHolidays: boolean;        // Состояние загрузки праздников
  
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
  
  // *** НОВОЕ: Флаг отображения удаленных записей ***
  showDeleted: boolean;              // Показывать ли удаленные записи (аналогично Schedule)
  
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
 * *** ИСПРАВЛЕНО: Функция для рассчета общего количества часов из записей SRS ***
 * Правильно парсит различные форматы времени и исключает удаленные записи
 */
const calculateTotalHours = (records: IStaffRecord[]): string => {
  try {
    if (!records || records.length === 0) {
      return '0:00';
    }
    
    let totalMinutes = 0;
    
    console.log('[calculateTotalHours] *** CALCULATING TOTAL HOURS WITH FIXED LOGIC ***');
    console.log('[calculateTotalHours] Records to process:', records.length);
    
    records.forEach((record, index) => {
      try {
        // *** ИСПРАВЛЕНО: Проверяем deleted статус - не включаем удаленные записи ***
        if (record.Deleted === 1) {
          console.log(`[calculateTotalHours] Record ${index} (ID: ${record.ID}) is deleted, skipping`);
          return; // Пропускаем удаленные записи
        }

        let recordMinutes = 0;
        
        // *** ПРИОРИТЕТ 1: Используем вычисленное время из поля WorkTime (расчетное поле) ***
        if (record.WorkTime) {
          const workTimeStr = record.WorkTime.toString().trim();
          console.log(`[calculateTotalHours] Record ${index} (ID: ${record.ID}) WorkTime:`, workTimeStr);
          
          if (workTimeStr.includes(':')) {
            // Формат "7:30" (часы:минуты)
            const [hoursStr, minutesStr] = workTimeStr.split(':');
            const hours = parseInt(hoursStr, 10) || 0;
            const minutes = parseInt(minutesStr, 10) || 0;
            recordMinutes = (hours * 60) + minutes;
            console.log(`[calculateTotalHours] Parsed H:M format: ${hours}h ${minutes}m = ${recordMinutes} minutes`);
          } else if (workTimeStr.includes('.')) {
            // Формат "7.50" (часы.десятичные_минуты)
            const [hoursStr, minutesDecimalStr] = workTimeStr.split('.');
            const hours = parseInt(hoursStr, 10) || 0;
            const minutesDecimal = parseInt(minutesDecimalStr.padEnd(2, '0'), 10) || 0;
            // Конвертируем десятичные минуты (например, 50 = 50 минут, 25 = 25 минут)
            recordMinutes = (hours * 60) + minutesDecimal;
            console.log(`[calculateTotalHours] Parsed decimal format: ${hours}h ${minutesDecimal}m = ${recordMinutes} minutes`);
          } else {
            // Только часы "8" или десятичные часы "7.5"
            const hours = parseFloat(workTimeStr) || 0;
            recordMinutes = Math.round(hours * 60);
            console.log(`[calculateTotalHours] Parsed hours only: ${hours}h = ${recordMinutes} minutes`);
          }
        }
        
        // *** ПРИОРИТЕТ 2: Если WorkTime пустое, используем LeaveTime (для отпусков) ***
        else if (record.LeaveTime && record.LeaveTime > 0) {
          const leaveHours = parseFloat(record.LeaveTime.toString()) || 0;
          recordMinutes = Math.round(leaveHours * 60);
          console.log(`[calculateTotalHours] Using LeaveTime: ${leaveHours}h = ${recordMinutes} minutes`);
        }
        
        // *** ПРИОРИТЕТ 3: Попытка рассчитать время из ShiftDate полей (числовые поля) ***
        else if (record.ShiftDate1Hours !== undefined && record.ShiftDate2Hours !== undefined) {
          console.log(`[calculateTotalHours] Calculating from ShiftDate numeric fields for record ${index}`);
          
          const startHours = record.ShiftDate1Hours || 0;
          const startMinutes = record.ShiftDate1Minutes || 0;
          const endHours = record.ShiftDate2Hours || 0;
          const endMinutes = record.ShiftDate2Minutes || 0;
          const lunchMinutes = record.TimeForLunch || 0;
          
          const startTotalMinutes = (startHours * 60) + startMinutes;
          let endTotalMinutes = (endHours * 60) + endMinutes;
          
          // Обработка ночных смен
          if (endTotalMinutes <= startTotalMinutes) {
            endTotalMinutes += (24 * 60); // Добавляем сутки
          }
          
          const workMinutes = Math.max(0, endTotalMinutes - startTotalMinutes - lunchMinutes);
          recordMinutes = workMinutes;
          
          console.log(`[calculateTotalHours] Calculated from numeric shift fields: ${startHours}:${startMinutes}-${endHours}:${endMinutes}, lunch:${lunchMinutes} = ${recordMinutes} minutes`);
        }
        
        // *** ПРИОРИТЕТ 4: Попытка рассчитать время из ShiftDate полей (Date объекты) ***
        else if (record.ShiftDate1 && record.ShiftDate2) {
          console.log(`[calculateTotalHours] Calculating from ShiftDate Date objects for record ${index}`);
          
          try {
            const startDate = new Date(record.ShiftDate1);
            const endDate = new Date(record.ShiftDate2);
            const lunchMinutes = record.TimeForLunch || 0;
            
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
              let diffMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
              
              // Обработка ночных смен
              if (diffMinutes < 0) {
                diffMinutes += (24 * 60); // Добавляем сутки
              }
              
              const workMinutes = Math.max(0, diffMinutes - lunchMinutes);
              recordMinutes = Math.round(workMinutes);
              
              console.log(`[calculateTotalHours] Calculated from Date objects: ${startDate.toTimeString()}-${endDate.toTimeString()}, lunch:${lunchMinutes} = ${recordMinutes} minutes`);
            }
          } catch (dateError) {
            console.warn(`[calculateTotalHours] Error parsing Date objects for record ${index}:`, dateError);
          }
        }
        
        else {
          console.log(`[calculateTotalHours] Record ${index} (ID: ${record.ID}) has no usable time data, skipping`);
          return;
        }
        
        // *** ВАЛИДАЦИЯ: Проверяем разумность результата ***
        if (recordMinutes < 0) {
          console.warn(`[calculateTotalHours] Record ${index} produced negative minutes (${recordMinutes}), setting to 0`);
          recordMinutes = 0;
        } else if (recordMinutes > (24 * 60)) {
          console.warn(`[calculateTotalHours] Record ${index} produced more than 24 hours (${recordMinutes} minutes), capping at 24h`);
          recordMinutes = 24 * 60;
        }
        
        totalMinutes += recordMinutes;
        
        console.log(`[calculateTotalHours] Record ${index} (ID: ${record.ID}) contributes ${recordMinutes} minutes. Running total: ${totalMinutes} minutes`);
        
      } catch (recordError) {
        console.error(`[calculateTotalHours] Error processing record ${index}:`, recordError);
      }
    });
    
    // *** ИСПРАВЛЕНО: Конвертируем в часы:минуты формат ***
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const formattedHours = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;
    
    console.log('[calculateTotalHours] *** FINAL CALCULATION RESULT ***:', {
      totalRecords: records.length,
      processedRecords: records.filter(r => r.Deleted !== 1).length,
      deletedRecords: records.filter(r => r.Deleted === 1).length,
      totalMinutes,
      totalHours,
      remainingMinutes,
      formattedResult: formattedHours
    });
    
    return formattedHours;
    
  } catch (error) {
    console.error('[calculateTotalHours] *** CRITICAL ERROR calculating total hours ***:', error);
    return '0:00';
  }
};

/**
 * Custom hook для управления состоянием SRS Tab
 * ОБНОВЛЕНО: Добавлена инициализация типов отпусков, праздников и showDeleted
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
    totalHours: '0:00',
    
    // Типы отпусков
    typesOfLeave: [],
    isLoadingTypesOfLeave: false,
    
    // *** НОВОЕ: Праздники ***
    holidays: [],
    isLoadingHolidays: false,
    
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
    
    // *** НОВОЕ: Флаг отображения удаленных записей ***
    showDeleted: false, // По умолчанию удаленные записи не показываем (как в Schedule)
    
    // Флаги
    isInitialized: false
  });
  
  console.log('[useSRSTabState] State initialized with FIXED TOTAL HOURS CALCULATION:', {
    fromDate: state.fromDate.toISOString(),
    toDate: state.toDate.toISOString(),
    daysInRange: SRSDateUtils.calculateDaysInRange(state.fromDate, state.toDate),
    typesOfLeaveSupport: true,
    holidaysSupport: true,
    showDeletedSupport: true,
    showDeleted: state.showDeleted,
    totalHoursCalculationFixed: true
  });
  
  return {
    state,
    setState
  };
};

/**
 * Вспомогательные функции для работы с состоянием SRS Tab
 * ОБНОВЛЕНО: Добавлены функции для работы с типами отпусков, праздниками, showDeleted и ИСПРАВЛЕН расчет часов
 */
export const SRSTabStateHelpers = {
  
  /**
   * *** ИСПРАВЛЕНО: Обновляет SRS записи и пересчитывает общее количество часов ***
   */
  updateSRSRecords: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    records: IStaffRecord[]
  ): void => {
    console.log('[SRSTabStateHelpers] *** UPDATING SRS RECORDS WITH FIXED CALCULATION ***');
    console.log('[SRSTabStateHelpers] Records count:', records.length);
    
    const totalHours = calculateTotalHours(records);
    
    setState(prevState => ({
      ...prevState,
      srsRecords: records,
      totalHours: totalHours,
      isLoadingSRS: false,
      errorSRS: undefined
    }));
    
    console.log('[SRSTabStateHelpers] SRS records updated:', {
      recordsCount: records.length,
      totalHours,
      deletedRecords: records.filter(r => r.Deleted === 1).length,
      activeRecords: records.filter(r => r.Deleted !== 1).length
    });
  },

  // *** HELPER ФУНКЦИИ ДЛЯ ТИПОВ ОТПУСКОВ ***

  /**
   * Обновляет типы отпусков
   */
  updateTypesOfLeave: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    typesOfLeave: ITypeOfLeave[]
  ): void => {
    setState(prevState => ({
      ...prevState,
      typesOfLeave: typesOfLeave,
      isLoadingTypesOfLeave: false
    }));
    
    console.log('[SRSTabStateHelpers] updateTypesOfLeave:', {
      typesCount: typesOfLeave.length,
      types: typesOfLeave.map(t => ({ id: t.id, title: t.title }))
    });
  },

  /**
   * Устанавливает состояние загрузки типов отпусков
   */
  setLoadingTypesOfLeave: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    isLoading: boolean
  ): void => {
    setState(prevState => ({
      ...prevState,
      isLoadingTypesOfLeave: isLoading
    }));
    
    console.log('[SRSTabStateHelpers] setLoadingTypesOfLeave:', isLoading);
  },

  // *** НОВЫЕ HELPER ФУНКЦИИ ДЛЯ ПРАЗДНИКОВ ***

  /**
   * Обновляет праздники
   */
  updateHolidays: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    holidays: IHoliday[]
  ): void => {
    setState(prevState => ({
      ...prevState,
      holidays: holidays,
      isLoadingHolidays: false
    }));
    
    console.log('[SRSTabStateHelpers] updateHolidays:', {
      holidaysCount: holidays.length,
      holidays: holidays.map(h => ({ title: h.title, date: new Date(h.date).toLocaleDateString() }))
    });
  },

  /**
   * Устанавливает состояние загрузки праздников
   */
  setLoadingHolidays: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    isLoading: boolean
  ): void => {
    setState(prevState => ({
      ...prevState,
      isLoadingHolidays: isLoading
    }));
    
    console.log('[SRSTabStateHelpers] setLoadingHolidays:', isLoading);
  },

  /**
   * *** НОВАЯ ФУНКЦИЯ: Получение статистики праздников ***
   * Анализирует праздники в текущем состоянии
   */
  getHolidaysStatistics: (
    state: ISRSTabState
  ): {
    totalHolidays: number;
    holidaysInPeriod: number;
    holidayRecords: number;
    holidayWorkingHours: string;
  } => {
    const holidaysInPeriod = state.holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= state.fromDate && holidayDate <= state.toDate;
    }).length;

    const holidayRecords = state.srsRecords.filter(record => record.Holiday === 1).length;

    // Подсчитываем часы по праздничным записям
    const holidayRecordsArray = state.srsRecords.filter(record => record.Holiday === 1);
    const holidayTotalHours = calculateTotalHours(holidayRecordsArray);

    const statistics = {
      totalHolidays: state.holidays.length,
      holidaysInPeriod,
      holidayRecords,
      holidayWorkingHours: holidayTotalHours
    };

    console.log('[SRSTabStateHelpers] getHolidaysStatistics:', statistics);
    return statistics;
  },

  // *** НОВЫЕ HELPER ФУНКЦИИ ДЛЯ SHOWDELETED ***

  /**
   * Устанавливает флаг отображения удаленных записей
   */
  setShowDeleted: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    showDeleted: boolean
  ): void => {
    setState(prevState => ({
      ...prevState,
      showDeleted: showDeleted
    }));
    
    console.log('[SRSTabStateHelpers] setShowDeleted:', showDeleted);
  },

  /**
   * *** НОВАЯ ФУНКЦИЯ: Получение статистики удаленных записей ***
   * Анализирует удаленные записи в текущем состоянии
   */
  getDeletedRecordsStatistics: (
    state: ISRSTabState
  ): {
    totalRecords: number;
    activeRecords: number;
    deletedRecords: number;
    deletedPercentage: number;
  } => {
    const totalRecords = state.srsRecords.length;
    const deletedRecords = state.srsRecords.filter(record => record.Deleted === 1).length;
    const activeRecords = totalRecords - deletedRecords;
    const deletedPercentage = totalRecords > 0 ? Math.round((deletedRecords / totalRecords) * 100) : 0;

    const statistics = {
      totalRecords,
      activeRecords,
      deletedRecords,
      deletedPercentage
    };

    console.log('[SRSTabStateHelpers] getDeletedRecordsStatistics:', statistics);
    return statistics;
  },

  /**
   * *** НОВАЯ ФУНКЦИЯ: Обновляет только общее количество часов ***
   * Используется для пересчета без изменения записей
   */
  updateTotalHours: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    totalHours: string
  ): void => {
    setState(prevState => ({
      ...prevState,
      totalHours: totalHours
    }));
    
    console.log('[SRSTabStateHelpers] Total hours updated to:', totalHours);
  },

  /**
   * *** НОВАЯ ФУНКЦИЯ: Пересчитывает общее время для текущих записей ***
   * Используется когда нужно пересчитать часы без обновления записей
   */
  recalculateTotalHours: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    setState(prevState => {
      const newTotalHours = calculateTotalHours(prevState.srsRecords);
      
      console.log('[SRSTabStateHelpers] Recalculating total hours:', {
        oldTotal: prevState.totalHours,
        newTotal: newTotalHours,
        recordsCount: prevState.srsRecords.length
      });
      
      return {
        ...prevState,
        totalHours: newTotalHours
      };
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
   * ОБНОВЛЕНО: Включает сброс типов отпусков, праздников и showDeleted
   */
  resetState: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    const { fromDate, toDate } = getSavedDates();
    
    setState({
      fromDate,
      toDate,
      srsRecords: [],
      totalHours: '0:00',
      // Сброс типов отпусков
      typesOfLeave: [],
      isLoadingTypesOfLeave: false,
      // *** НОВОЕ: Сброс праздников ***
      holidays: [],
      isLoadingHolidays: false,
      isLoading: false,
      isLoadingSRS: false,
      error: undefined,
      errorSRS: undefined,
      hasUnsavedChanges: false,
      selectedItems: new Set<string>(),
      // *** НОВОЕ: Сброс showDeleted ***
      showDeleted: false, // По умолчанию не показываем удаленные
      isInitialized: false
    });
    
    console.log('[SRSTabStateHelpers] State reset to initial values with FIXED total hours calculation, types of leave, holidays and showDeleted support');
  }
};

/**
 * *** ЭКСПОРТИРУЕМ ФУНКЦИЮ РАСЧЕТА ДЛЯ ИСПОЛЬЗОВАНИЯ В ДРУГИХ ФАЙЛАХ ***
 * Позволяет использовать исправленную логику расчета в useSRSTabLogic.ts
 */
export { calculateTotalHours };