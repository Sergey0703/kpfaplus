// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSTabInterfaces.ts

import { IDropdownOption } from '@fluentui/react';

/**
 * Основной интерфейс для записи SRS
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
}

/**
 * Опции для выпадающих списков в SRS таблице
 */
export interface ISRSTableOptions {
  hours: IDropdownOption[]; // 00-23
  minutes: IDropdownOption[]; // 00, 05, 10, ..., 55
  lunchTimes: IDropdownOption[]; // 0, 5, 10, ..., 30
  leaveTypes: IDropdownOption[]; // Типы отпусков
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
 */
export interface ISRSTableProps {
  items: ISRSRecord[];
  options: ISRSTableOptions;
  isLoading: boolean;
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | number | { hours: string; minutes: string }) => void;
  // Убираем все неиспользуемые в текущей версии:
  // onItemCheck: (itemId: string, checked: boolean) => void;
  // onSelectAll: (checked: boolean) => void;
  // allSelected: boolean;
  // hasSelectedItems: boolean;
}

/**
 * Пропсы для компонента SRSTableRow
 */
export interface ISRSTableRowProps {
  item: ISRSRecord;
  options: ISRSTableOptions;
  isEven: boolean; // Для чередования цветов строк
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | number | { hours: string; minutes: string }) => void;
  // Убираем неиспользуемый в текущей версии:
  // onItemCheck: (itemId: string, checked: boolean) => void;
}

/**
 * Состояние SRS вкладки (для будущего использования)
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