// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSTabInterfaces.ts

import { IDropdownOption } from '@fluentui/react';
import { IHoliday } from '../../../../services/HolidaysService';
import { SRSDateUtils } from './SRSDateUtils';

/**
 * Основной интерфейс для записи SRS
 * ОБНОВЛЕНО: Holiday поле изменено - теперь вычисляется на основе списка праздников (Date-only), а не поля StaffRecords
 */
export interface ISRSRecord {
  id: string;
  date: Date; // ОБНОВЛЕНО: Date-only формат (no time component)
  dayOfWeek: string;
  hours: string; // Рабочие часы в формате "7.50"
  relief: boolean; // Relief checkbox
  startWork: {
    hours: string; // "08"
    minutes: string; // "00"
  };
  finishWork: {
    hours: string; // "16"
    minutes: string; // "00"
  };
  lunch: string; // Время обеда в минутах "30"
  typeOfLeave: string; // Тип отпуска
  timeLeave: string; // Время отпуска в часах "7.50"
  shift: number; // Номер смены
  contract: string; // Номер контракта "1", "2", "3"
  contractCheck: boolean; // Проверка контракта
  status: 'positive' | 'negative' | 'none'; // Статус (👍/👎)
  srs: boolean; // Отметка SRS
  checked: boolean; // Для массовых операций
  deleted?: boolean; // Для удаленных записей
  // ОБНОВЛЕНО: Holiday поле теперь вычисляется на основе списка праздников Date-only
  Holiday?: number; // DEPRECATED: Больше не используется из StaffRecords, вычисляется из holidays list
}

/**
 * ОБНОВЛЕНО: Интерфейс данных для новой смены с Date-only форматом
 */
export interface INewSRSShiftData {
  date: Date; // ОБНОВЛЕНО: Date-only формат
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  Holiday?: number; // ОБНОВЛЕНО: Всегда 0 - праздники определяются из holidays list Date-only, не устанавливается пользователем
}

/**
 * Опции для выпадающих списков в SRS таблице
 * ОБНОВЛЕНО: Добавлены типы отпусков
 */
export interface ISRSTableOptions {
  hours: IDropdownOption[]; // 00-23
  minutes: IDropdownOption[]; // 00, 05, 10, ..., 55
  lunchTimes: IDropdownOption[]; // 0, 5, 10, ..., 30
  leaveTypes: IDropdownOption[]; // ОБНОВЛЕНО: Типы отпусков из справочника
  contractNumbers: IDropdownOption[]; // 1, 2, 3
}

/**
 * ОБНОВЛЕНО: Пропсы для компонента SRSFilterControls - убран totalHours, добавлен calculatedTotalHours
 */
export interface ISRSFilterControlsProps {
  fromDate: Date; // ОБНОВЛЕНО: Date-only формат
  toDate: Date; // ОБНОВЛЕНО: Date-only формат
  calculatedTotalHours: string; // ИЗМЕНЕНО: calculatedTotalHours вместо totalHours
  isLoading: boolean;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  onRefresh: () => void;
  onExportAll: () => void;
  onSave: () => void;
  onSaveChecked: () => void;
  hasChanges: boolean; // Есть ли несохраненные изменения
  hasCheckedItems: boolean; // Есть ли отмеченные записи
}

/**
 * ОБНОВЛЕНО: Пропсы для компонента SRSTable - добавлен holidays list для определения праздников Date-only
 */
export interface ISRSTableProps {
  items: ISRSRecord[];
  options: ISRSTableOptions;
  // НОВОЕ: Список праздников для определения праздничных дней Date-only
  holidays: IHoliday[];
  isLoading: boolean;
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  // НОВОЕ: Обработчик изменения типа отпуска
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
  // НОВОЕ: Обработчики удаления/восстановления
  showDeleteConfirmDialog?: (id: string) => void;
  showRestoreConfirmDialog?: (id: string) => void;
  onDeleteItem?: (id: string) => Promise<boolean>;
  onRestoreItem?: (id: string) => Promise<boolean>;
  // ИСПРАВЛЕНО: Добавлены пропсы для showDeleted
  showDeleted: boolean; // Флаг отображения удаленных записей
  onToggleShowDeleted: (checked: boolean) => void; // Обработчик переключения флага
  // ИСПРАВЛЕНО: Добавлен обработчик добавления смены с Date-only форматом
  onAddShift?: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
  // *** НОВОЕ: Обработчик checkbox функциональности ***
  onItemCheck?: (item: ISRSRecord, checked: boolean) => void;
}

/**
 * Пропсы для компонента SRSTableRow
 * ОБНОВЛЕНО: Добавлен holidays list для определения праздников Date-only
 */
export interface ISRSTableRowProps {
  item: ISRSRecord;
  options: ISRSTableOptions;
  // НОВОЕ: Список праздников для определения является ли день праздничным Date-only
  holidays: IHoliday[];
  isEven: boolean; // Для чередования цветов строк
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  // НОВОЕ: Дополнительные обработчики
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
  // НОВОЕ: Обработчики удаления/восстановления
  showDeleteConfirmDialog?: (id: string) => void;
  showRestoreConfirmDialog?: (id: string) => void;
  onDeleteItem?: (id: string) => Promise<boolean>;
  onRestoreItem?: (id: string) => Promise<boolean>;
  // ИСПРАВЛЕНО: Добавлен обработчик добавления смены с Date-only форматом
  onAddShift?: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
  // *** НОВОЕ: Обработчик checkbox функциональности ***
  onItemCheck?: (item: ISRSRecord, checked: boolean) => void;
}

/**
 * ОБНОВЛЕНО: Состояние SRS вкладки - убрано totalHours
 * Убрано поле totalHours, так как теперь оно вычисляется в реальном времени
 */
export interface ISRSTabState {
  fromDate: Date; // ОБНОВЛЕНО: Date-only формат
  toDate: Date; // ОБНОВЛЕНО: Date-only формат
  srsData: ISRSRecord[];
  // УБРАНО: totalHours: string; - теперь вычисляется в реальном времени
  isLoading: boolean;
  error?: string;
  hasUnsavedChanges: boolean;
  selectedItems: Set<string>; // ID выбранных записей
  // НОВОЕ: Типы отпусков
  typesOfLeave: Array<{ id: string; title: string; color?: string }>; // Упрощенный интерфейс типов отпусков
  isLoadingTypesOfLeave: boolean;
  // ИСПРАВЛЕНО: Добавлено поле showDeleted
  showDeleted: boolean; // Флаг отображения удаленных записей
}

/**
 * Параметры для операций с SRS данными (для будущего использования)
 * ОБНОВЛЕНО: Date-only формат
 */
export interface ISRSOperationParams {
  fromDate: Date; // ОБНОВЛЕНО: Date-only формат
  toDate: Date; // ОБНОВЛЕНО: Date-only формат
  staffId: string;
  managerId?: string;
  staffGroupId?: string;
}

/**
 * Результат операции экспорта SRS
 */
export interface ISRSExportResult {
  success: boolean;
  fileName?: string;
  error?: string;
  recordsCount?: number;
}

/**
 * Результат операции сохранения SRS
 */
export interface ISRSSaveResult {
  success: boolean;
  savedCount: number;
  failedCount: number;
  errors?: string[];
}

/**
 * НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ РАБОТЫ С ТИПАМИ ОТПУСКОВ
 */

/**
 * Интерфейс для передачи типов отпусков в компоненты
 */
export interface ISRSTypeOfLeave {
  id: string;
  title: string;
  color?: string;
}

/**
 * НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ DELETE/RESTORE ФУНКЦИОНАЛА
 */

/**
 * Результат операции удаления записи
 */
export interface ISRSDeleteResult {
  success: boolean;
  recordId: string;
  error?: string;
}

/**
 * Результат операции восстановления записи
 */
export interface ISRSRestoreResult {
  success: boolean;
  recordId: string;
  error?: string;
}

/**
 * Параметры для операций удаления/восстановления
 */
export interface ISRSDeleteRestoreParams {
  recordId: string;
  staffId: string;
  currentUserId: string;
  managingGroupId: string;
}

/**
 * ИСПРАВЛЕНО: Интерфейсы для showDeleted функционала
 */

/**
 * Статистика по удаленным записям
 */
export interface ISRSDeletedStatistics {
  totalRecords: number;
  activeRecords: number;
  deletedRecords: number;
  deletedPercentage: number;
  showDeleted: boolean;
}

/**
 * Параметры фильтрации записей
 * ОБНОВЛЕНО: Date-only формат, обязательное поле showDeleted
 */
export interface ISRSFilterParams {
  fromDate: Date; // ОБНОВЛЕНО: Date-only формат
  toDate: Date; // ОБНОВЛЕНО: Date-only формат
  showDeleted: boolean; // ИСПРАВЛЕНО: Убран optional, сделан обязательным
  staffId?: string;
  typeOfLeave?: string;
}

/**
 * ОБНОВЛЕНО: Расширенные пропсы для главного компонента SRS Tab - убран totalHours, добавлен holidays
 */
export interface ISRSTabProps {
  // Основные пропсы
  selectedStaff?: { id: string; name: string; employeeId: string };
  context?: unknown;
  currentUserId?: string;
  managingGroupId?: string;
  
  // Данные состояния - ОБНОВЛЕНО: Date-only формат
  fromDate: Date; // ОБНОВЛЕНО: Date-only формат
  toDate: Date; // ОБНОВЛЕНО: Date-only формат
  srsRecords: ISRSRecord[];
  // УБРАНО: totalHours: string; - теперь вычисляется в реальном времени
  
  // Типы отпусков
  typesOfLeave: ISRSTypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  
  // ОБНОВЛЕНО: Праздники - теперь обязательны для определения праздничных дней Date-only
  holidays: IHoliday[]; // Список праздников для определения праздничных дней Date-only
  isLoadingHolidays: boolean;
  
  // Состояния загрузки
  isLoading: boolean;
  isLoadingSRS: boolean;
  
  // Ошибки
  error?: string;
  errorSRS?: string;
  
  // Изменения и выбор
  hasUnsavedChanges: boolean;
  selectedItems: Set<string>;
  hasCheckedItems: boolean;
  
  // ИСПРАВЛЕНО: Обязательные пропсы для showDeleted
  showDeleted: boolean; // ИСПРАВЛЕНО: Убран optional, сделан обязательным
  
  // Обработчики - ОБНОВЛЕНО: Date-only формат
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  onRefreshData: () => void;
  onExportAll: () => void;
  onSave: () => void;
  onSaveChecked: () => void;
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  onTypeOfLeaveChange: (item: ISRSRecord, value: string) => void;
  
  // НОВОЕ: Обработчики праздников
  loadHolidays: () => void;
  
  // НОВОЕ: Обработчики delete/restore
  onDeleteRecord: (recordId: string) => Promise<ISRSDeleteResult>;
  onRestoreRecord: (recordId: string) => Promise<ISRSRestoreResult>;
  
  // ИСПРАВЛЕНО: Обязательный обработчик showDeleted
  onToggleShowDeleted: (checked: boolean) => void; // ИСПРАВЛЕНО: Убран optional, сделан обязательным
  
  // ИСПРАВЛЕНО: Добавлен обработчик добавления смены с Date-only форматом
  onAddShift: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
}

/**
 * НОВОЕ: Конфигурация опций SRS таблицы
 * Функция-помощник для создания опций с типами отпусков
 */
export interface ISRSTableOptionsConfig {
  /**
   * Создает опции для SRS таблицы включая типы отпусков
   */
  createSRSTableOptions: (typesOfLeave: ISRSTypeOfLeave[]) => ISRSTableOptions;
}

/**
 * ИСПРАВЛЕНО: Интерфейсы для диалогов подтверждения
 */

/**
 * Пропсы для диалога подтверждения удаления
 * ИСПРАВЛЕНО: Добавлены обязательные обработчики
 */
export interface ISRSDeleteConfirmDialogProps {
  isOpen: boolean;
  recordId: string;
  recordDate?: string;
  staffName?: string;
  onConfirm: (recordId: string) => void; // ИСПРАВЛЕНО: Обязательный обработчик
  onCancel: () => void; // ИСПРАВЛЕНО: Обязательный обработчик
}

/**
 * Пропсы для диалога подтверждения восстановления
 * ИСПРАВЛЕНО: Добавлены обязательные обработчики
 */
export interface ISRSRestoreConfirmDialogProps {
  isOpen: boolean;
  recordId: string;
  recordDate?: string;
  staffName?: string;
  onConfirm: (recordId: string) => void; // ИСПРАВЛЕНО: Обязательный обработчик
  onCancel: () => void; // ИСПРАВЛЕНО: Обязательный обработчик
}

/**
 * ОБНОВЛЕННЫЕ: Функции для работы с праздниками на основе списка праздников и Date-only формата
 */

/**
 * ОБНОВЛЕНО: Проверяет является ли указанная дата праздником на основе списка праздников Date-only
 * Использует SRSDateUtils для корректного сравнения дат
 */
export function isHolidayDate(date: Date, holidays: IHoliday[]): boolean {
  if (!date || !holidays || holidays.length === 0) {
    return false;
  }

  // ОБНОВЛЕНО: Используем SRSDateUtils для корректного сравнения Date-only
  const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(date);
  
  return holidays.some(holiday => {
    const normalizedHolidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
    return SRSDateUtils.areDatesEqual(normalizedDate, normalizedHolidayDate);
  });
}

/**
 * ОБНОВЛЕНО: Получает информацию о празднике для указанной даты Date-only
 * Использует SRSDateUtils для корректного сравнения дат
 */
export function getHolidayInfo(date: Date, holidays: IHoliday[]): IHoliday | undefined {
  if (!date || !holidays || holidays.length === 0) {
    return undefined;
  }

  // ОБНОВЛЕНО: Используем SRSDateUtils для корректного сравнения Date-only
  const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(date);
  
  return holidays.find(holiday => {
    const normalizedHolidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
    return SRSDateUtils.areDatesEqual(normalizedDate, normalizedHolidayDate);
  });
}

/**
 * ОБНОВЛЕНО: Получает статистику праздников в записях SRS на основе списка праздников Date-only
 * Использует SRSDateUtils для операций с датами
 */
export function getHolidayRecordsStatistics(
  records: ISRSRecord[], 
  holidays: IHoliday[]
): {
  totalRecords: number;
  holidayRecords: number;
  regularRecords: number;
  holidayPercentage: number;
  holidayDates: string[];
} {
  const totalRecords = records.length;
  
  const holidayRecords = records.filter(record => 
    isHolidayDate(record.date, holidays)
  );
  
  const regularRecords = records.filter(record => 
    !isHolidayDate(record.date, holidays)
  );

  const holidayDates = holidayRecords.map(record => 
    SRSDateUtils.formatDateForDisplay(record.date)
  );

  return {
    totalRecords,
    holidayRecords: holidayRecords.length,
    regularRecords: regularRecords.length,
    holidayPercentage: totalRecords > 0 ? Math.round((holidayRecords.length / totalRecords) * 100) : 0,
    holidayDates
  };
}

/**
 * ОБНОВЛЕННЫЕ: Утилиты для работы с типами отпусков в SRS
 */
export class SRSTableOptionsHelper {
  /**
   * Создает стандартные опции для SRS таблицы
   */
  public static createStandardOptions(): Omit<ISRSTableOptions, 'leaveTypes'> {
    return {
      hours: Array.from({ length: 24 }, (_, i) => ({
        key: i.toString().padStart(2, '0'),
        text: i.toString().padStart(2, '0')
      })),
      minutes: Array.from({ length: 12 }, (_, i) => {
        const value = (i * 5).toString().padStart(2, '0');
        return { key: value, text: value };
      }),
      lunchTimes: Array.from({ length: 13 }, (_, i) => {
        const value = (i * 5).toString();
        return { key: value, text: value };
      }),
      contractNumbers: [
        { key: '1', text: '1' },
        { key: '2', text: '2' },
        { key: '3', text: '3' }
      ]
    };
  }

  /**
   * Создает опции для типов отпусков
   */
  public static createLeaveTypesOptions(typesOfLeave: ISRSTypeOfLeave[]): IDropdownOption[] {
    const options: IDropdownOption[] = [
      { key: '', text: 'None' } // Первый элемент - "Нет типа отпуска"
    ];

    // Добавляем типы отпусков из справочника
    typesOfLeave.forEach(type => {
      options.push({
        key: type.id,
        text: type.title,
        data: { color: type.color } // Сохраняем цвет для возможного использования
      });
    });

    return options;
  }

  /**
   * Создает полные опции для SRS таблицы
   */
  public static createFullSRSTableOptions(typesOfLeave: ISRSTypeOfLeave[]): ISRSTableOptions {
    const standardOptions = SRSTableOptionsHelper.createStandardOptions();
    const leaveTypesOptions = SRSTableOptionsHelper.createLeaveTypesOptions(typesOfLeave);

    return {
      ...standardOptions,
      leaveTypes: leaveTypesOptions
    };
  }

  /**
   * Находит тип отпуска по ID
   */
  public static findLeaveTypeById(typesOfLeave: ISRSTypeOfLeave[], id: string): ISRSTypeOfLeave | undefined {
    return typesOfLeave.find(type => type.id === id);
  }

  /**
   * Получает название типа отпуска по ID
   */
  public static getLeaveTypeTitle(typesOfLeave: ISRSTypeOfLeave[], id: string): string {
    const leaveType = SRSTableOptionsHelper.findLeaveTypeById(typesOfLeave, id);
    return leaveType ? leaveType.title : 'Unknown';
  }

  /**
   * Получает цвет типа отпуска по ID
   */
  public static getLeaveTypeColor(typesOfLeave: ISRSTypeOfLeave[], id: string): string | undefined {
    const leaveType = SRSTableOptionsHelper.findLeaveTypeById(typesOfLeave, id);
    return leaveType?.color;
  }

  /**
   * НОВОЕ: Валидация записи перед удалением
   * Проверяет можно ли удалить запись
   */
  public static canDeleteRecord(record: ISRSRecord): { canDelete: boolean; reason?: string } {
    // Нельзя удалить уже удаленную запись
    if (record.deleted) {
      return { canDelete: false, reason: 'Record is already deleted' };
    }

    // Можно удалить любую активную запись
    return { canDelete: true };
  }

  /**
   * НОВОЕ: Валидация записи перед восстановлением
   * Проверяет можно ли восстановить запись
   */
  public static canRestoreRecord(record: ISRSRecord): { canRestore: boolean; reason?: string } {
    // Можно восстановить только удаленную запись
    if (!record.deleted) {
      return { canRestore: false, reason: 'Record is not deleted' };
    }

    // Можно восстановить любую удаленную запись
    return { canRestore: true };
  }

  /**
   * ИСПРАВЛЕНО: Получение статистики удаленных записей
   */
  public static getDeletedRecordsStatistics(records: ISRSRecord[]): ISRSDeletedStatistics {
    const totalRecords = records.length;
    const deletedRecords = records.filter(r => r.deleted === true).length;
    const activeRecords = totalRecords - deletedRecords;
    const deletedPercentage = totalRecords > 0 ? Math.round((deletedRecords / totalRecords) * 100) : 0;

    return {
      totalRecords,
      activeRecords,
      deletedRecords,
      deletedPercentage,
      showDeleted: false // По умолчанию, будет установлено вызывающей стороной
    };
  }

  /**
   * ИСПРАВЛЕНО: Фильтрация записей по статусу удаления
   * Применяет клиентскую фильтрацию записей на основе showDeleted
   */
  public static filterRecordsByDeletedStatus(
    records: ISRSRecord[], 
    showDeleted: boolean // ИСПРАВЛЕНО: Убран optional, сделан обязательным
  ): ISRSRecord[] {
    if (showDeleted) {
      // Показываем все записи
      return records;
    } else {
      // Показываем только активные записи
      return records.filter(record => record.deleted !== true);
    }
  }

  /**
   * ИСПРАВЛЕНО: Получение краткой статистики для UI
   * Возвращает текст для отображения в интерфейсе с учетом showDeleted
   */
  public static getRecordsDisplayText(
    records: ISRSRecord[], 
    showDeleted: boolean // ИСПРАВЛЕНО: Убран optional, сделан обязательным
  ): {
    mainText: string;
    detailText: string;
  } {
    const stats = SRSTableOptionsHelper.getDeletedRecordsStatistics(records);
    const visibleCount = showDeleted ? stats.totalRecords : stats.activeRecords;
    
    const mainText = `Showing ${visibleCount} of ${stats.totalRecords} records`;
    
    let detailText = '';
    if (stats.deletedRecords > 0) {
      detailText = `(${stats.activeRecords} active, ${stats.deletedRecords} deleted)`;
    }
    
    return { mainText, detailText };
  }

  /**
   * ИСПРАВЛЕНО: Проверка необходимости показа переключателя
   * Определяет, нужно ли показывать переключатель "Show deleted"
   */
  public static shouldShowDeletedToggle(records: ISRSRecord[]): boolean {
    const stats = SRSTableOptionsHelper.getDeletedRecordsStatistics(records);
    return stats.deletedRecords > 0; // Показываем переключатель только если есть удаленные записи
  }

  /**
   * НОВАЯ ФУНКЦИЯ: Проверка совместимости showDeleted состояний
   * Помогает синхронизировать состояние showDeleted между компонентами
   */
  public static validateShowDeletedState(
    parentShowDeleted: boolean,
    childShowDeleted?: boolean
  ): {
    isConsistent: boolean;
    shouldUpdate: boolean;
    expectedValue: boolean;
  } {
    const isConsistent = childShowDeleted === parentShowDeleted;
    const shouldUpdate = !isConsistent && childShowDeleted !== undefined;
    
    return {
      isConsistent,
      shouldUpdate,
      expectedValue: parentShowDeleted
    };
  }

  /**
   * ОБНОВЛЕНО: Создание параметров фильтрации с Date-only форматом
   * Создает объект параметров фильтрации с правильными типами
   */
  public static createFilterParams(
    fromDate: Date, // ОБНОВЛЕНО: Date-only формат
    toDate: Date, // ОБНОВЛЕНО: Date-only формат
    showDeleted: boolean, // ОБЯЗАТЕЛЬНЫЙ ПАРАМЕТР
    staffId?: string,
    typeOfLeave?: string
  ): ISRSFilterParams {
    return {
      fromDate: SRSDateUtils.normalizeDateToLocalMidnight(fromDate), // ОБНОВЛЕНО: Date-only нормализация
      toDate: SRSDateUtils.normalizeDateToLocalMidnight(toDate), // ОБНОВЛЕНО: Date-only нормализация
      showDeleted, // ОБЯЗАТЕЛЬНЫЙ
      staffId,
      typeOfLeave
    };
  }

  /**
   * ОБНОВЛЕНО: Валидация параметров фильтрации с Date-only проверками
   * Проверяет корректность параметров фильтрации
   */
  public static validateFilterParams(params: ISRSFilterParams): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Проверяем даты с использованием SRSDateUtils
    if (!params.fromDate || !params.toDate) {
      errors.push('From date and to date are required');
    } else {
      // Используем SRSDateUtils для валидации
      const fromValidation = SRSDateUtils.validateDateForSharePoint(params.fromDate);
      const toValidation = SRSDateUtils.validateDateForSharePoint(params.toDate);
      
      if (!fromValidation.isValid) {
        errors.push(`Invalid from date: ${fromValidation.error}`);
      }
      
      if (!toValidation.isValid) {
        errors.push(`Invalid to date: ${toValidation.error}`);
      }
      
      if (fromValidation.isValid && toValidation.isValid && params.fromDate > params.toDate) {
        errors.push('From date must be before or equal to to date');
      }
    }

    // Проверяем showDeleted
    if (typeof params.showDeleted !== 'boolean') {
      errors.push('showDeleted must be a boolean value');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * ОБНОВЛЕНО: Получение праздничной статистики на основе списка праздников и Date-only формата
   * Анализирует праздники в SRS записях используя holidays list вместо Holiday поля
   */
  public static getHolidayStatisticsFromHolidaysList(
    records: ISRSRecord[], 
    holidays: IHoliday[]
  ): {
    totalRecords: number;
    holidayRecords: number;
    regularRecords: number;
    holidayPercentage: number;
    holidaysList: Array<{ title: string; date: string; recordsCount: number }>;
  } {
    const totalRecords = records.length;
    
    // Подсчитываем записи, которые попадают на праздничные дни (Date-only)
    const holidayRecords = records.filter(record => 
      isHolidayDate(record.date, holidays)
    );
    
    const regularRecords = records.filter(record => 
      !isHolidayDate(record.date, holidays)
    );

    // Группируем по праздникам с подсчетом записей для каждого праздника
    const holidaysList = holidays
      .filter(holiday => {
        // Только праздники, на которые есть записи
        return records.some(record => isHolidayDate(record.date, [holiday]));
      })
      .map(holiday => {
        const recordsCount = records.filter(record => 
          isHolidayDate(record.date, [holiday])
        ).length;
        
        return {
          title: holiday.title,
          date: SRSDateUtils.formatDateForDisplay(holiday.date),
          recordsCount
        };
      });

    return {
      totalRecords,
      holidayRecords: holidayRecords.length,
      regularRecords: regularRecords.length,
      holidayPercentage: totalRecords > 0 ? Math.round((holidayRecords.length / totalRecords) * 100) : 0,
      holidaysList
    };
  }

  /**
   * ОБНОВЛЕНО: Создание данных для новой смены с Date-only форматом
   * Подготавливает данные для создания новой SRS смены
   */
  public static createNewShiftData(
    date: Date, // ОБНОВЛЕНО: Date-only формат
    timeForLunch: string = '30',
    contract: string = '1',
    typeOfLeave?: string
  ): INewSRSShiftData {
    return {
      date: SRSDateUtils.normalizeDateToLocalMidnight(date), // ОБНОВЛЕНО: Date-only нормализация
      timeForLunch,
      contract,
      contractNumber: contract,
      typeOfLeave: typeOfLeave || '',
      Holiday: 0 // ИСПРАВЛЕНО: Всегда 0 - праздники определяются из holidays list Date-only
    };
  }

  /**
   * ОБНОВЛЕНО: Валидация данных новой смены с Date-only проверками
   * Проверяет корректность данных для создания новой смены
   */
  public static validateNewShiftData(shiftData: INewSRSShiftData): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверяем дату с использованием SRSDateUtils
    if (!shiftData.date) {
      errors.push('Date is required');
    } else {
      const dateValidation = SRSDateUtils.validateDateForSharePoint(shiftData.date);
      if (!dateValidation.isValid) {
        errors.push(`Invalid date: ${dateValidation.error}`);
      }
    }

    // Проверяем время обеда
    const lunchTime = parseInt(shiftData.timeForLunch, 10);
    if (isNaN(lunchTime) || lunchTime < 0 || lunchTime > 120) {
      errors.push('Lunch time must be between 0 and 120 minutes');
    }

    // Проверяем контракт
    const contract = parseInt(shiftData.contract, 10);
    if (isNaN(contract) || contract < 1 || contract > 3) {
      errors.push('Contract must be 1, 2, or 3');
    }

    // ИСПРАВЛЕНО: НЕ проверяем Holiday поле - оно всегда должно быть 0
    if (shiftData.Holiday !== undefined && shiftData.Holiday !== 0) {
      warnings.push('Holiday field will be ignored - holidays are determined from holidays list (Date-only)');
    }

    // Проверяем тип отпуска (необязательно)
    if (shiftData.typeOfLeave && shiftData.typeOfLeave.trim() === '') {
      warnings.push('Empty type of leave will be treated as no leave type');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * ОБНОВЛЕНО: Подготовка данных смены для отправки на сервер с Date-only форматом
   * Конвертирует INewSRSShiftData в формат для StaffRecordsService
   */
  public static prepareShiftDataForServer(
    shiftData: INewSRSShiftData,
    defaultStartHours: number = 0,
    defaultStartMinutes: number = 0,
    defaultEndHours: number = 0,
    defaultEndMinutes: number = 0
  ): {
    Date: Date; // ОБНОВЛЕНО: Date-only формат
    ShiftDate1Hours: number;
    ShiftDate1Minutes: number;
    ShiftDate2Hours: number;
    ShiftDate2Minutes: number;
    TimeForLunch: number;
    Contract: number;
    TypeOfLeaveID: string;
    Holiday: number; // Всегда 0
    Title: string;
  } {
    const timeForLunch = parseInt(shiftData.timeForLunch, 10) || 30;
    const contract = parseInt(shiftData.contract, 10) || 1;
    const typeOfLeaveID = shiftData.typeOfLeave && shiftData.typeOfLeave !== '' ? shiftData.typeOfLeave : '';

    return {
      Date: SRSDateUtils.normalizeDateToLocalMidnight(shiftData.date), // ОБНОВЛЕНО: Date-only нормализация
      ShiftDate1Hours: defaultStartHours,
      ShiftDate1Minutes: defaultStartMinutes,
      ShiftDate2Hours: defaultEndHours,
      ShiftDate2Minutes: defaultEndMinutes,
      TimeForLunch: timeForLunch,
      Contract: contract,
      TypeOfLeaveID: typeOfLeaveID,
      Holiday: 0, // ИСПРАВЛЕНО: Всегда 0 - праздники определяются из holidays list Date-only
      Title: typeOfLeaveID ? `Leave on ${SRSDateUtils.formatDateForDisplay(shiftData.date)}` : `SRS Shift on ${SRSDateUtils.formatDateForDisplay(shiftData.date)}`
    };
  }
}