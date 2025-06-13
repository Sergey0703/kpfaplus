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
 * ОБНОВЛЕНО: Добавлены типы отпусков
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
}

/**
 * Пропсы для компонента SRSTableRow
 * ОБНОВЛЕНО: Добавлены типы отпусков
 */
export interface ISRSTableRowProps {
  item: ISRSRecord;
  options: ISRSTableOptions;
  isEven: boolean; // Для чередования цветов строк
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  // *** НОВОЕ: Дополнительные обработчики ***
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
}

/**
 * Состояние SRS вкладки (для будущего использования)
 * ОБНОВЛЕНО: Добавлены типы отпусков
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
 * Расширенные пропсы для главного компонента SRS Tab
 * ОБНОВЛЕНО: Включает типы отпусков и праздники
 */
export interface ISRSTabProps {
  // Основные пропсы
  selectedStaff?: { id: string; name: string; employeeId: string };
  context?: any;
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
 * *** НОВОЕ: Утилиты для работы с типами отпусков в SRS ***
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
}