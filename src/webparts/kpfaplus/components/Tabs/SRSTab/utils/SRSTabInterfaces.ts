// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSTabInterfaces.ts

import { IDropdownOption } from '@fluentui/react';

/**
 * Основной интерфейс для записи SRS
 * ОБНОВЛЕНО: Добавлено поле Holiday для поддержки праздников
 */
export interface ISRSRecord {
  id: string;
  date: Date;
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
  // *** НОВОЕ: Поле для поддержки праздников ***
  Holiday?: number; // Признак праздника: 1 = праздник, 0 = рабочий день (как в StaffRecords)
}

/**
 * *** НОВЫЙ ИНТЕРФЕЙС: Данные для новой смены (аналог из Schedule) ***
 */
export interface INewSRSShiftData {
  date: Date;
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  Holiday?: number;
}

/**
 * Опции для выпадающих списков в SRS таблице
 * ОБНОВЛЕНО: Добавлены типы отпусков
 */
export interface ISRSTableOptions {
  hours: IDropdownOption[]; // 00-23
  minutes: IDropdownOption[]; // 00, 05, 10, ..., 55
  lunchTimes: IDropdownOption[]; // 0, 5, 10, ..., 30
  leaveTypes: IDropdownOption[]; // *** ОБНОВЛЕНО: Типы отпусков из справочника ***
  contractNumbers: IDropdownOption[]; // 1, 2, 3
}

/**
 * Пропсы для компонента SRSFilterControls
 */
export interface ISRSFilterControlsProps {
  fromDate: Date;
  toDate: Date;
  totalHours: string;
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
 * Пропсы для компонента SRSTable
 * *** ИСПРАВЛЕНО: Добавлены showDeleted и onToggleShowDeleted ***
 * *** НОВОЕ: Добавлен onAddShift ***
 */
export interface ISRSTableProps {
  items: ISRSRecord[];
  options: ISRSTableOptions;
  isLoading: boolean;
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  // *** НОВОЕ: Обработчик изменения типа отпуска ***
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
  // *** НОВОЕ: Обработчики удаления/восстановления ***
  showDeleteConfirmDialog?: (id: string) => void;
  showRestoreConfirmDialog?: (id: string) => void;
  onDeleteItem?: (id: string) => Promise<boolean>;
  onRestoreItem?: (id: string) => Promise<boolean>;
  // *** ИСПРАВЛЕНО: Добавлены пропсы для showDeleted ***
  showDeleted: boolean; // Флаг отображения удаленных записей
  onToggleShowDeleted: (checked: boolean) => void; // Обработчик переключения флага
  // *** НОВОЕ: Добавлен обработчик добавления смены ***
  onAddShift?: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
}

/**
 * Пропсы для компонента SRSTableRow
 * ОБНОВЛЕНО: Добавлены типы отпусков и delete/restore функционал
 * *** НОВОЕ: Добавлен onAddShift ***
 */
export interface ISRSTableRowProps {
  item: ISRSRecord;
  options: ISRSTableOptions;
  isEven: boolean; // Для чередования цветов строк
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  // *** НОВОЕ: Дополнительные обработчики ***
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
  // *** НОВОЕ: Обработчики удаления/восстановления ***
  showDeleteConfirmDialog?: (id: string) => void;
  showRestoreConfirmDialog?: (id: string) => void;
  onDeleteItem?: (id: string) => Promise<boolean>;
  onRestoreItem?: (id: string) => Promise<boolean>;
  // *** НОВОЕ: Добавлен обработчик добавления смены ***
  onAddShift?: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
}

/**
 * Состояние SRS вкладки (для будущего использования)
 * ОБНОВЛЕНО: Добавлены типы отпусков и showDeleted
 */
export interface ISRSTabState {
  fromDate: Date;
  toDate: Date;
  srsData: ISRSRecord[];
  totalHours: string;
  isLoading: boolean;
  error?: string;
  hasUnsavedChanges: boolean;
  selectedItems: Set<string>; // ID выбранных записей
  // *** НОВОЕ: Типы отпусков ***
  typesOfLeave: Array<{ id: string; title: string; color?: string }>; // Упрощенный интерфейс типов отпусков
  isLoadingTypesOfLeave: boolean;
  // *** ИСПРАВЛЕНО: Добавлено поле showDeleted ***
  showDeleted: boolean; // Флаг отображения удаленных записей
}

/**
 * Параметры для операций с SRS данными (для будущего использования)
 */
export interface ISRSOperationParams {
  fromDate: Date;
  toDate: Date;
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
 * *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ РАБОТЫ С ТИПАМИ ОТПУСКОВ ***
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
 * *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ DELETE/RESTORE ФУНКЦИОНАЛА ***
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
 * *** ИСПРАВЛЕНО: Интерфейсы для showDeleted функционала ***
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
 * *** ИСПРАВЛЕНО: Обязательное поле showDeleted ***
 */
export interface ISRSFilterParams {
  fromDate: Date;
  toDate: Date;
  showDeleted: boolean; // *** ИСПРАВЛЕНО: Убран optional, сделан обязательным ***
  staffId?: string;
  typeOfLeave?: string;
}

/**
 * Расширенные пропсы для главного компонента SRS Tab
 * *** ИСПРАВЛЕНО: Обязательные пропсы для showDeleted ***
 */
export interface ISRSTabProps {
  // Основные пропсы
  selectedStaff?: { id: string; name: string; employeeId: string };
  context?: unknown;
  currentUserId?: string;
  managingGroupId?: string;
  
  // Данные состояния
  fromDate: Date;
  toDate: Date;
  srsRecords: ISRSRecord[];
  totalHours: string;
  
  // Типы отпусков
  typesOfLeave: ISRSTypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  
  // *** НОВОЕ: Праздники ***
  holidays: Array<{ id: string; title: string; date: Date }>; // Упрощенный интерфейс праздников
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
  
  // *** ИСПРАВЛЕНО: Обязательные пропсы для showDeleted ***
  showDeleted: boolean; // *** ИСПРАВЛЕНО: Убран optional, сделан обязательным ***
  
  // Обработчики
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
  
  // *** НОВОЕ: Обработчики праздников ***
  loadHolidays: () => void;
  
  // *** НОВОЕ: Обработчики delete/restore ***
  onDeleteRecord: (recordId: string) => Promise<ISRSDeleteResult>;
  onRestoreRecord: (recordId: string) => Promise<ISRSRestoreResult>;
  
  // *** ИСПРАВЛЕНО: Обязательный обработчик showDeleted ***
  onToggleShowDeleted: (checked: boolean) => void; // *** ИСПРАВЛЕНО: Убран optional, сделан обязательным ***
  
  // *** НОВОЕ: Добавлен обработчик добавления смены ***
  onAddShift: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
}

/**
 * *** НОВОЕ: Конфигурация опций SRS таблицы ***
 * Функция-помощник для создания опций с типами отпусков
 */
export interface ISRSTableOptionsConfig {
  /**
   * Создает опции для SRS таблицы включая типы отпусков
   */
  createSRSTableOptions: (typesOfLeave: ISRSTypeOfLeave[]) => ISRSTableOptions;
}

/**
 * *** ИСПРАВЛЕНО: Интерфейсы для диалогов подтверждения ***
 */

/**
 * Пропсы для диалога подтверждения удаления
 * *** ИСПРАВЛЕНО: Добавлены обязательные обработчики ***
 */
export interface ISRSDeleteConfirmDialogProps {
  isOpen: boolean;
  recordId: string;
  recordDate?: string;
  staffName?: string;
  onConfirm: (recordId: string) => void; // *** ИСПРАВЛЕНО: Обязательный обработчик ***
  onCancel: () => void; // *** ИСПРАВЛЕНО: Обязательный обработчик ***
}

/**
 * Пропсы для диалога подтверждения восстановления
 * *** ИСПРАВЛЕНО: Добавлены обязательные обработчики ***
 */
export interface ISRSRestoreConfirmDialogProps {
  isOpen: boolean;
  recordId: string;
  recordDate?: string;
  staffName?: string;
  onConfirm: (recordId: string) => void; // *** ИСПРАВЛЕНО: Обязательный обработчик ***
  onCancel: () => void; // *** ИСПРАВЛЕНО: Обязательный обработчик ***
}

/**
 * *** ОБНОВЛЕННЫЕ: Утилиты для работы с типами отпусков в SRS ***
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
   * *** НОВОЕ: Валидация записи перед удалением ***
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
   * *** НОВОЕ: Валидация записи перед восстановлением ***
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
   * *** ИСПРАВЛЕНО: Получение статистики удаленных записей ***
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
   * *** ИСПРАВЛЕНО: Фильтрация записей по статусу удаления ***
   * Применяет клиентскую фильтрацию записей на основе showDeleted
   */
  public static filterRecordsByDeletedStatus(
    records: ISRSRecord[], 
    showDeleted: boolean // *** ИСПРАВЛЕНО: Убран optional, сделан обязательным ***
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
   * *** ИСПРАВЛЕНО: Получение краткой статистики для UI ***
   * Возвращает текст для отображения в интерфейсе с учетом showDeleted
   */
  public static getRecordsDisplayText(
    records: ISRSRecord[], 
    showDeleted: boolean // *** ИСПРАВЛЕНО: Убран optional, сделан обязательным ***
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
   * *** ИСПРАВЛЕНО: Проверка необходимости показа переключателя ***
   * Определяет, нужно ли показывать переключатель "Show deleted"
   */
  public static shouldShowDeletedToggle(records: ISRSRecord[]): boolean {
    const stats = SRSTableOptionsHelper.getDeletedRecordsStatistics(records);
    return stats.deletedRecords > 0; // Показываем переключатель только если есть удаленные записи
  }

  /**
   * *** НОВАЯ ФУНКЦИЯ: Проверка совместимости showDeleted состояний ***
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
   * *** НОВАЯ ФУНКЦИЯ: Создание параметров фильтрации ***
   * Создает объект параметров фильтрации с правильными типами
   */
  public static createFilterParams(
    fromDate: Date,
    toDate: Date,
    showDeleted: boolean, // *** ОБЯЗАТЕЛЬНЫЙ ПАРАМЕТР ***
    staffId?: string,
    typeOfLeave?: string
  ): ISRSFilterParams {
    return {
      fromDate,
      toDate,
      showDeleted, // *** ОБЯЗАТЕЛЬНЫЙ ***
      staffId,
      typeOfLeave
    };
  }

  /**
   * *** НОВАЯ ФУНКЦИЯ: Валидация параметров фильтрации ***
   * Проверяет корректность параметров фильтрации
   */
  public static validateFilterParams(params: ISRSFilterParams): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Проверяем даты
    if (!params.fromDate || !params.toDate) {
      errors.push('From date and to date are required');
    } else if (params.fromDate > params.toDate) {
      errors.push('From date must be before or equal to to date');
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
}