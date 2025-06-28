// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSTabState.ts

import { useState } from 'react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { IHoliday } from '../../../../services/HolidaysService';
import { SRSDateUtils } from './SRSDateUtils';

/**
 * Интерфейс для состояния SRS Tab
 * *** ОЧИЩЕН: Убрано поле totalHours - теперь вычисляется в реальном времени в SRSTable ***
 */
export interface ISRSTabState {
  // Основные даты периода
  fromDate: Date;                    // Дата начала периода (по умолчанию - первый день месяца)
  toDate: Date;                      // Дата окончания периода (по умолчанию - конец недели после fromDate)
  
  // Данные SRS записей
  srsRecords: IStaffRecord[];        // Записи SRS (только с TypeOfLeave)
  // *** УБРАНО: totalHours: string; - теперь вычисляется в реальном времени ***
  
  // Типы отпусков
  typesOfLeave: ITypeOfLeave[];      // Справочник типов отпусков
  isLoadingTypesOfLeave: boolean;    // Состояние загрузки типов отпусков
  
  // Праздники
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
  
  // Флаг отображения удаленных записей
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
 * Custom hook для управления состоянием SRS Tab
 * *** УПРОЩЕН: Убрана инициализация totalHours - теперь Real-time архитектура ***
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
    // *** УБРАНО: totalHours: '0:00' - теперь вычисляется в реальном времени в SRSTable ***
    
    // Типы отпусков
    typesOfLeave: [],
    isLoadingTypesOfLeave: false,
    
    // Праздники
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
    
    // Флаг отображения удаленных записей
    showDeleted: false, // По умолчанию удаленные записи не показываем (как в Schedule)
    
    // Флаги
    isInitialized: false
  });
  
  console.log('[useSRSTabState] *** REAL-TIME TOTAL HOURS ARCHITECTURE *** State initialized:', {
    fromDate: state.fromDate.toISOString(),
    toDate: state.toDate.toISOString(),
    daysInRange: SRSDateUtils.calculateDaysInRange(state.fromDate, state.toDate),
    typesOfLeaveSupport: true,
    holidaysSupport: true,
    showDeletedSupport: true,
    showDeleted: state.showDeleted,
    totalHoursCalculation: 'Real-time in SRSTable', // *** НОВАЯ АРХИТЕКТУРА ***
    noTotalHoursInState: true, // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ ***
    cleanedFromComplexLogic: true
  });
  
  return {
    state,
    setState
  };
};

/**
 * Вспомогательные функции для работы с состоянием SRS Tab
 * *** ОЧИЩЕНЫ: Убраны все функции для работы с totalHours ***
 */
export const SRSTabStateHelpers = {
  
  /**
   * *** УПРОЩЕНО: Обновляет SRS записи БЕЗ пересчета totalHours ***
   * Total Hours теперь вычисляется в реальном времени в SRSTable
   */
  updateSRSRecords: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>,
    records: IStaffRecord[]
  ): void => {
    console.log('[SRSTabStateHelpers] *** UPDATING SRS RECORDS (REAL-TIME TOTAL HOURS ARCHITECTURE) ***');
    console.log('[SRSTabStateHelpers] Records count:', records.length);
    console.log('[SRSTabStateHelpers] Total Hours will be calculated in real-time by SRSTable');
    
    setState(prevState => ({
      ...prevState,
      srsRecords: records,
      // *** УБРАНО: totalHours: calculateTotalHours(records) ***
      isLoadingSRS: false,
      errorSRS: undefined
    }));
    
    console.log('[SRSTabStateHelpers] SRS records updated (simplified):', {
      recordsCount: records.length,
      deletedRecords: records.filter(r => r.Deleted === 1).length,
      activeRecords: records.filter(r => r.Deleted !== 1).length,
      totalHoursHandling: 'Real-time calculation in SRSTable'
    });
  },

  // HELPER ФУНКЦИИ ДЛЯ ТИПОВ ОТПУСКОВ (без изменений)

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

  // HELPER ФУНКЦИИ ДЛЯ ПРАЗДНИКОВ (без изменений)

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
   * Получение статистики праздников
   * *** УПРОЩЕНО: Убрана логика расчета часов по праздникам ***
   */
  getHolidaysStatistics: (
    state: ISRSTabState
  ): {
    totalHolidays: number;
    holidaysInPeriod: number;
    holidayRecords: number;
  } => {
    const holidaysInPeriod = state.holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate >= state.fromDate && holidayDate <= state.toDate;
    }).length;

    const holidayRecords = state.srsRecords.filter(record => record.Holiday === 1).length;

    // *** УБРАНО: holidayWorkingHours - теперь вычисляется в реальном времени ***

    const statistics = {
      totalHolidays: state.holidays.length,
      holidaysInPeriod,
      holidayRecords
      // *** УБРАНО: holidayWorkingHours ***
    };

    console.log('[SRSTabStateHelpers] getHolidaysStatistics (simplified):', statistics);
    return statistics;
  },

  // HELPER ФУНКЦИИ ДЛЯ SHOWDELETED (без изменений)

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
   * Получение статистики удаленных записей
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

  // *** УБРАНЫ: updateTotalHours, recalculateTotalHours функции ***
  // Total Hours теперь вычисляется в реальном времени в SRSTable
  
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
   * *** УПРОЩЕНО: Убран сброс totalHours ***
   */
  resetState: (
    setState: React.Dispatch<React.SetStateAction<ISRSTabState>>
  ): void => {
    const { fromDate, toDate } = getSavedDates();
    
    setState({
      fromDate,
      toDate,
      srsRecords: [],
      // *** УБРАНО: totalHours: '0:00' ***
      // Сброс типов отпусков
      typesOfLeave: [],
      isLoadingTypesOfLeave: false,
      // Сброс праздников
      holidays: [],
      isLoadingHolidays: false,
      isLoading: false,
      isLoadingSRS: false,
      error: undefined,
      errorSRS: undefined,
      hasUnsavedChanges: false,
      selectedItems: new Set<string>(),
      // Сброс showDeleted
      showDeleted: false, // По умолчанию не показываем удаленные
      isInitialized: false
    });
    
    console.log('[SRSTabStateHelpers] *** STATE RESET TO REAL-TIME TOTAL HOURS ARCHITECTURE ***:', {
      totalHoursHandling: 'Real-time calculation in SRSTable',
      cleanedFromComplexLogic: true,
      typesOfLeaveSupport: true,
      holidaysSupport: true,
      showDeletedSupport: true
    });
  }
};

// *** УБРАНО: export { calculateTotalHours } ***
// Total Hours теперь вычисляется в реальном времени в SRSTable