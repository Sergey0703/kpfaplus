// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelInterfaces.ts

import { ISRSRecord } from '../SRSTabInterfaces';

/**
 * *** РЕПЛИКА OFFICE SCRIPT: Формат записи для Excel экспорта ***
 * Точно соответствует интерфейсу SRSRecord из Office Script
 */
export interface ISRSExcelRecord {
  ShiftStart: string;        // "08:00" - время начала смены
  ShiftEnd: string;          // "16:00" - время окончания смены  
  LunchTime: string;         // "0:30" - время обеда
  Contract: number;          // 1 или 2 - номер контракта
  TypeOfLeaveID: number;     // 0-19 - тип отпуска (0 = обычная работа)
  LeaveTime: string;         // "7.50" - время отпуска в часах
  LunchNote?: string;        // Комментарий к обеду (пока не используется)
  TotalHoursNote?: string;   // Комментарий к общему времени (пока не используется)
  LeaveNote?: string;        // Комментарий к отпуску (пока не используется)
}

/**
 * *** РЕПЛИКА OFFICE SCRIPT: Метаданные для экспорта ***
 * Точно соответствует интерфейсу ExportMetadata из Office Script
 */
export interface ISRSExcelMetadata {
  maxRows: number;           // Максимальное количество строк для заполнения (2 для typeOfSRS=2, 3 для typeOfSRS=3)
}

/**
 * *** РЕПЛИКА OFFICE SCRIPT: Полные данные для экспорта ***
 * Точно соответствует интерфейсу ExportData из Office Script
 */
export interface ISRSExcelExportData {
  metadata: ISRSExcelMetadata;
  records: ISRSExcelRecord[];
}

/**
 * Параметры для экспорта SRS данных в Excel
 * Соответствуют параметрам функции main() из Office Script
 */
export interface ISRSExcelExportParams {
  date: string;              // Дата для поиска в Excel (формат "31.12.2024")
  typeOfSRS: number;         // Тип SRS (2 или 3) - определяет колонки и maxRows
  jsonData: string;          // JSON строка с ISRSExcelExportData
  filePath: string;          // Путь к Excel файлу в SharePoint
}

/**
 * Конфигурация для обработки SRS Excel файла
 */
export interface ISRSExcelProcessingConfig {
  worksheetName: string;           // Имя листа Excel ("2.Employee  Data Entry")
  dateSearchRange: string;         // Диапазон поиска даты ("A1:A2000")
  typeOfSRS: number;              // Тип SRS (2 или 3)
  maxRowsToProcess: number;       // Максимальное количество строк для обработки
  enableComments: boolean;        // Включить добавление комментариев
  clearCommentsFirst: boolean;    // Очищать комментарии перед записью
  enableLogging: boolean;         // Включить подробное логирование
}

/**
 * Результат операции SRS Excel экспорта
 */
export interface ISRSExcelOperationResult {
  success: boolean;               // Успешность операции
  message?: string;               // Сообщение об успехе
  error?: string;                 // Описание ошибки
  operation: 'export_to_excel';  // Тип операции
  
  // Статистика операции
  processingTime?: number;        // Время обработки в миллисекундах
  recordsProcessed?: number;      // Количество обработанных записей
  cellsUpdated?: number;          // Количество обновленных ячеек
  commentsAdded?: number;         // Количество добавленных комментариев
  
  // Детали файла
  filePath?: string;              // Путь к обработанному файлу
  worksheetName?: string;         // Имя обработанного листа
  dateFound?: boolean;            // Была ли найдена дата в Excel
  dateRowIndex?: number;          // Индекс строки с найденной датой
  
  // Конфигурация
  typeOfSRS?: number;             // Использованный тип SRS
  maxRows?: number;               // Максимальное количество строк
}

/**
 * Ошибки специфичные для SRS Excel операций
 */
export interface ISRSExcelError {
  code: string;                   // Код ошибки
  message: string;                // Сообщение об ошибке
  operation?: string;             // Операция во время которой произошла ошибка
  
  // Контекст SRS
  date?: string;                  // Дата для которой выполнялся экспорт
  typeOfSRS?: number;             // Тип SRS
  recordsCount?: number;          // Количество записей для экспорта
  
  // Контекст Excel
  worksheetName?: string;         // Имя листа
  cellAddress?: string;           // Адрес ячейки где произошла ошибка
  rowIndex?: number;              // Индекс строки
  
  // Техническая информация
  originalError?: Error | string | unknown; // *** FIXED: Replace any with specific union type ***
  stackTrace?: string;            // Stack trace для отладки
}

/**
 * Маппинг колонок Excel для разных типов SRS и контрактов
 * Реплика логики из Office Script
 */
export interface ISRSExcelColumnMapping {
  typeOfSRS: number;              // 2 или 3
  contract: number;               // 1 или 2
  
  // Основные колонки
  shiftStartColumn: string;       // Колонка начала смены (B, C, K, L)
  shiftEndColumn: string;         // Колонка окончания смены (C, K, L, M)
  lunchTimeColumn: string;        // Колонка времени обеда (F, O, P)
  totalHoursColumn?: string;      // Колонка для комментария общего времени (H, I, Q, S)
  
  // Колонки отпусков (TypeOfLeaveID 1, 2)
  leaveType1Column?: string;      // Колонка для TypeOfLeaveID = 1 (J, K, S, U)
  leaveType2Column?: string;      // Колонка для TypeOfLeaveID = 2 (I, J, R, T)
  
  // Диапазон колонок для TypeOfLeaveID 3-19
  extendedLeaveColumns: string[]; // Массив колонок AL-BB или AP-BF
}

/**
 * Данные для создания маппинга колонок
 */
export interface ISRSExcelColumnMappingData {
  // Маппинги для typeOfSRS = 2
  type2Contract1: ISRSExcelColumnMapping;
  type2Contract2: ISRSExcelColumnMapping;
  
  // Маппинги для typeOfSRS = 3  
  type3Contract1: ISRSExcelColumnMapping;
  type3Contract2: ISRSExcelColumnMapping;
}

/**
 * Конфигурация для очистки ячеек Excel
 * Реплика функции getColumnsForClearing из Office Script
 */
export interface ISRSExcelClearingConfig {
  typeOfSRS: number;              // Тип SRS (2 или 3)
  columnsToClean: string[];       // Массив колонок для очистки
  maxRows: number;                // Максимальное количество строк для очистки
  clearComments: boolean;         // Очищать ли комментарии
}

/**
 * Статистика выполнения SRS Excel операции
 */
export interface ISRSExcelProcessingStats {
  // Временные метрики
  totalTime: number;              // Общее время выполнения
  downloadTime?: number;          // Время загрузки файла
  processingTime?: number;        // Время обработки Excel
  uploadTime?: number;            // Время сохранения файла
  
  // Метрики обработки данных
  inputRecords: number;           // Количество входных записей
  processedRecords: number;       // Количество обработанных записей
  skippedRecords: number;         // Количество пропущенных записей
  
  // Метрики Excel операций
  cellsCleared: number;           // Количество очищенных ячеек
  cellsUpdated: number;           // Количество обновленных ячеек
  commentsAdded: number;          // Количество добавленных комментариев
  commentsCleared: number;        // Количество удаленных комментариев
  
  // Конфигурация
  typeOfSRS: number;              // Использованный тип SRS
  contractsProcessed: Set<number>; // Обработанные контракты (1, 2)
  leaveTypesProcessed: Set<number>; // Обработанные типы отпусков
  
  // Результат
  success: boolean;               // Общий успех операции
  warnings: string[];             // Предупреждения
  errors: string[];               // Ошибки
}

/**
 * Параметры для валидации SRS записи перед экспортом
 */
export interface ISRSRecordValidationResult {
  isValid: boolean;               // Валидна ли запись для экспорта
  errors: string[];               // Ошибки валидации
  warnings: string[];             // Предупреждения валидации
  
  // Проверенные поля
  hasValidTime: boolean;          // Корректное время начала/окончания
  hasValidContract: boolean;      // Корректный номер контракта
  hasValidLeaveType: boolean;     // Корректный тип отпуска
  hasValidLeaveTime: boolean;     // Корректное время отпуска
}

/**
 * Контекст для обработки SRS Excel операции
 * Содержит всю необходимую информацию для выполнения экспорта
 */
export interface ISRSExcelOperationContext {
  // Входные данные
  sourceRecords: ISRSRecord[];         // Исходные SRS записи
  targetDate: Date;                    // Целевая дата для экспорта
  selectedStaffInfo: {                 // Информация о выбранном сотруднике
    id: string;
    name: string;
    filePath: string;                  // Путь к Excel файлу сотрудника
  };
  
  // Конфигурация
  config: ISRSExcelProcessingConfig;   // Конфигурация обработки
  columnMapping: ISRSExcelColumnMapping; // Маппинг колонок
  
  // Подготовленные данные
  exportData: ISRSExcelExportData;     // Данные для экспорта
  
  // Статистика выполнения
  stats: ISRSExcelProcessingStats;     // Статистика операции
  
  // Состояние операции
  isProcessing: boolean;               // Выполняется ли операция
  startTime: number;                   // Время начала операции
  currentStep: string;                 // Текущий этап операции
}

/**
 * *** КОНСТАНТЫ ДЛЯ SRS EXCEL ОПЕРАЦИЙ ***
 * Реплика констант из Office Script
 */
export const SRS_EXCEL_CONSTANTS = {
  // Конфигурация листа
  WORKSHEET_NAME: '2.Employee  Data Entry',
  DATE_SEARCH_RANGE: 'A1:A2000',
  
  // Типы SRS
  SRS_TYPE_2: 2,
  SRS_TYPE_3: 3,
  DEFAULT_SRS_TYPE: 2,
  
  // Максимальные строки
  MAX_ROWS_TYPE_2: 2,
  MAX_ROWS_TYPE_3: 3,
  
  // Колонки для очистки (typeOfSRS = 2)
  CLEAR_COLUMNS_TYPE_2: [
    'B', 'C', 'F', 'J', 'K', 'L', 'M', 'P', 'T', 'U',
    'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY',
    'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF'
  ],
  
  // Колонки для очистки (typeOfSRS = 3)
  CLEAR_COLUMNS_TYPE_3: [
    'B', 'C', 'F', 'I', 'J', 'K', 'L', 'O', 'R', 'S',
    'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU',
    'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB'
  ],
  
  // Диапазоны колонок для TypeOfLeaveID 3-19
  EXTENDED_LEAVE_COLUMNS_TYPE_2: [
    'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY',
    'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF'
  ],
  
  EXTENDED_LEAVE_COLUMNS_TYPE_3: [
    'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU',
    'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB'
  ],
  
  // Диапазон TypeOfLeaveID для extended leave columns
  EXTENDED_LEAVE_ID_MIN: 3,
  EXTENDED_LEAVE_ID_MAX: 19,
  
  // Коды ошибок
  ERROR_CODES: {
    DATE_NOT_FOUND: 'DATE_NOT_FOUND',
    WORKSHEET_NOT_FOUND: 'WORKSHEET_NOT_FOUND',
    INVALID_TYPE_OF_SRS: 'INVALID_TYPE_OF_SRS',
    INVALID_CONTRACT: 'INVALID_CONTRACT',
    INVALID_LEAVE_TYPE: 'INVALID_LEAVE_TYPE',
    FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    COLUMN_MAPPING_FAILED: 'COLUMN_MAPPING_FAILED'
  }
} as const;

/**
 * Типы для констант
 */
export type SRSType = typeof SRS_EXCEL_CONSTANTS.SRS_TYPE_2 | typeof SRS_EXCEL_CONSTANTS.SRS_TYPE_3;
export type ContractNumber = 1 | 2;
export type LeaveTypeID = number; // 0-19
export type SRSErrorCode = keyof typeof SRS_EXCEL_CONSTANTS.ERROR_CODES;