// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelInterfaces.ts

import { ISRSRecord } from '../SRSTabInterfaces';

/**
 * *** РЕПЛИКА OFFICE SCRIPT: Формат записи для Excel экспорта ***
 * Точно соответствует интерфейсу SRSRecord из Office Script
 */
export interface ISRSExcelRecord {
  // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
  ShiftStart: Date;        // **ИСПРАВЛЕНО**: "08:00" -> Date object
  ShiftEnd: Date;          // **ИСПРАВЛЕНО**: "16:00" -> Date object
  LunchTime: Date;         // **ИСПРАВЛЕНО**: "0:30" -> Date object
  // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
  Contract: number;          // 1 или 2 - номер контракта
  TypeOfLeaveID: number;     // 0-19 - тип отпуска (0 = обычная работа)
  LeaveTime: number;         // "7.50" - время отпуска в часах (число)
  LunchNote?: string;        // Комментарий к обеду (пока не используется)
  TotalHoursNote?: string;   // Комментарий к общему времени (пока не используется)
  LeaveNote?: string;        // Комментарий к отпуску (пока не используется)
}

// ... (остальная часть файла остается без изменений) ...

export interface ISRSExcelMetadata {
  maxRows: number;
}
export interface ISRSExcelExportData {
  metadata: ISRSExcelMetadata;
  records: ISRSExcelRecord[];
}
export interface ISRSExcelExportParams {
  date: string;
  typeOfSRS: number;
  jsonData: string;
  filePath: string;
}
export interface ISRSExcelProcessingConfig {
  worksheetName: string;
  dateSearchRange: string;
  typeOfSRS: number;
  maxRowsToProcess: number;
  enableComments: boolean;
  clearCommentsFirst: boolean;
  enableLogging: boolean;
}
export interface ISRSButtonOperationResult {
  success: boolean;
  operation: 'excel_export' | 'toggle_export_result' | 'create_schedule' | 'update_record' | 'error';
  recordId?: string;
  message?: string;
  error?: string;
  userMessage?: string;
  processingTime?: number;
  recordsProcessed?: number;
  cellsUpdated?: number;
  excelFilePath?: string;
}
export interface ISRSExcelOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  operation: 'export_to_excel';
  processingTime?: number;
  recordsProcessed?: number;
  cellsUpdated?: number;
  commentsAdded?: number;
  dateFound?: boolean;
  dateRowIndex?: number;
  typeOfSRS?: number;
  maxRows?: number;
}
export interface ISRSExcelError {
  code: string;
  message: string;
  operation?: string;
  date?: string;
  typeOfSRS?: number;
  recordsCount?: number;
  worksheetName?: string;
  cellAddress?: string;
  rowIndex?: number;
  originalError?: Error | string | unknown;
  stackTrace?: string;
}
export interface ISRSExcelColumnMapping {
  typeOfSRS: number;
  contract: number;
  shiftStartColumn: string;
  shiftEndColumn: string;
  lunchTimeColumn: string;
  totalHoursColumn?: string;
  leaveType1Column?: string;
  leaveType2Column?: string;
  extendedLeaveColumns: string[];
}
export interface ISRSExcelColumnMappingData {
  type2Contract1: ISRSExcelColumnMapping;
  type2Contract2: ISRSExcelColumnMapping;
  type3Contract1: ISRSExcelColumnMapping;
  type3Contract2: ISRSExcelColumnMapping;
}
export interface ISRSExcelClearingConfig {
  typeOfSRS: number;
  columnsToClean: string[];
  maxRows: number;
  clearComments: boolean;
}
export interface ISRSExcelProcessingStats {
  totalTime: number;
  downloadTime?: number;
  processingTime?: number;
  uploadTime?: number;
  inputRecords: number;
  processedRecords: number;
  skippedRecords: number;
  cellsCleared: number;
  cellsUpdated: number;
  commentsAdded: number;
  commentsCleared: number;
  typeOfSRS: number;
  contractsProcessed: Set<number>;
  leaveTypesProcessed: Set<number>;
  success: boolean;
  warnings: string[];
  errors: string[];
}
export interface ISRSRecordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  hasValidTime: boolean;
  hasValidContract: boolean;
  hasValidLeaveType: boolean;
  hasValidLeaveTime: boolean;
}
export interface ISRSExcelOperationContext {
  sourceRecords: ISRSRecord[];
  targetDate: Date;
  selectedStaffInfo: {
    id: string;
    name: string;
    filePath: string;
  };
  config: ISRSExcelProcessingConfig;
  columnMapping: ISRSExcelColumnMapping;
  exportData: ISRSExcelExportData;
  stats: ISRSExcelProcessingStats;
  isProcessing: boolean;
  startTime: number;
  currentStep: string;
}
export const SRS_EXCEL_CONSTANTS = {
  WORKSHEET_NAME: '2.Employee  Data Entry',
  DATE_SEARCH_RANGE: 'A1:A2000',
  SRS_TYPE_2: 2,
  SRS_TYPE_3: 3,
  DEFAULT_SRS_TYPE: 2,
  MAX_ROWS_TYPE_2: 2,
  MAX_ROWS_TYPE_3: 3,
  CLEAR_COLUMNS_TYPE_2: ['B', 'C', 'F', 'J', 'K', 'L', 'M', 'P', 'T', 'U', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF'],
  CLEAR_COLUMNS_TYPE_3: ['B', 'C', 'F', 'I', 'J', 'K', 'L', 'O', 'R', 'S', 'AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB'],
  EXTENDED_LEAVE_COLUMNS_TYPE_2: ['AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB', 'BC', 'BD', 'BE', 'BF'],
  EXTENDED_LEAVE_COLUMNS_TYPE_3: ['AL', 'AM', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AV', 'AW', 'AX', 'AY', 'AZ', 'BA', 'BB'],
  EXTENDED_LEAVE_ID_MIN: 3,
  EXTENDED_LEAVE_ID_MAX: 19,
  ERROR_CODES: { DATE_NOT_FOUND: 'DATE_NOT_FOUND', WORKSHEET_NOT_FOUND: 'WORKSHEET_NOT_FOUND', INVALID_TYPE_OF_SRS: 'INVALID_TYPE_OF_SRS', INVALID_CONTRACT: 'INVALID_CONTRACT', INVALID_LEAVE_TYPE: 'INVALID_LEAVE_TYPE', FILE_PROCESSING_FAILED: 'FILE_PROCESSING_FAILED', VALIDATION_FAILED: 'VALIDATION_FAILED', COLUMN_MAPPING_FAILED: 'COLUMN_MAPPING_FAILED' }
} as const;
export type SRSType = typeof SRS_EXCEL_CONSTANTS.SRS_TYPE_2 | typeof SRS_EXCEL_CONSTANTS.SRS_TYPE_3;
export type ContractNumber = 1 | 2;
export type LeaveTypeID = number;
export type SRSErrorCode = keyof typeof SRS_EXCEL_CONSTANTS.ERROR_CODES;