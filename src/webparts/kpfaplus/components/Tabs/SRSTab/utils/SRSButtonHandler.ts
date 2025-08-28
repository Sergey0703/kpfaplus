// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSButtonHandler.ts

import { ISRSRecord, ISRSTabState } from './SRSTabInterfaces';
import { IHoliday } from '../../../../services/HolidaysService';
import { ISRSTypeOfLeave } from './SRSTabInterfaces';
import { SRSDateUtils } from './SRSDateUtils';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { WebPartContext } from '@microsoft/sp-webpart-base';

/**
 * *** UPDATED FILE: Обработчик кнопки SRS с использованием ExportResult поля ***
 * Содержит логику обработки нажатия кнопки SRS в первой строке каждого дня
 * ИЗМЕНЕНО: Использует ExportResult вместо SRS поля
 */

/**
 * Интерфейс параметров для обработчика кнопки SRS
 */
export interface ISRSButtonHandlerParams {
  item: ISRSRecord;
  context: WebPartContext; // ИСПРАВЛЕНО: Конкретный тип вместо any
  selectedStaff: { id: string; name: string; employeeId: string };
  currentUserId?: string;
  managingGroupId?: string;
  state: ISRSTabState;
  holidays: IHoliday[];
  typesOfLeave: ISRSTypeOfLeave[];
  refreshSRSData: () => Promise<void>;
  setState: (updater: (prev: ISRSTabState) => ISRSTabState) => void; // ИСПРАВЛЕНО: Конкретный тип вместо any
}

/**
 * Результат операции ExportResult кнопки
 */
export interface ISRSButtonOperationResult {
  success: boolean;
  operation: 'toggle_export_result' | 'create_schedule' | 'update_record' | 'error';
  recordId?: string;
  message?: string;
  error?: string;
}

/**
 * *** ГЛАВНАЯ ФУНКЦИЯ: Обработчик нажатия кнопки SRS с ExportResult полем ***
 * 
 * Логика работы:
 * 1. Проверяет текущий ExportResult статус записи
 * 2. Переключает ExportResult флаг (1/0)
 * 3. Обновляет запись на сервере
 * 4. Обновляет локальные данные
 * 
 * @param params - Параметры для обработки ExportResult операции
 * @returns Promise<ISRSButtonOperationResult> - Результат операции
 */
export async function handleSRSButtonClick(params: ISRSButtonHandlerParams): Promise<ISRSButtonOperationResult> {
  const {
    item,
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    holidays,
    refreshSRSData,
    setState
  } = params;

  // ИСПРАВЛЕНО: Получаем state и typesOfLeave, используем их для логирования
  console.log('[SRSButtonHandler] State has', params.state.srsRecords.length, 'records');
  console.log('[SRSButtonHandler] Available leave types:', params.typesOfLeave.length);

  console.log('[SRSButtonHandler] *** SRS BUTTON CLICK HANDLER STARTED WITH EXPORTRESULT FIELD ***');
  console.log('[SRSButtonHandler] Item details:', {
    id: item.id,
    date: item.date.toLocaleDateString(),
    dateISO: item.date.toISOString(),
    currentExportResultStatus: item.srs, // В ISRSRecord это поле представляет ExportResult
    typeOfLeave: item.typeOfLeave || 'No type of leave',
    deleted: item.deleted,
    dateFormat: 'Date-only using SRSDateUtils',
    fieldUsed: 'ExportResult (not SRS field)'
  });

  // ===============================================
  // ВАЛИДАЦИЯ ВХОДНЫХ ПАРАМЕТРОВ
  // ===============================================

  console.log('[SRSButtonHandler] *** VALIDATING PARAMETERS ***');

  if (!context) {
    console.error('[SRSButtonHandler] Context is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Context is not available'
    };
  }

  if (!selectedStaff?.employeeId) {
    console.error('[SRSButtonHandler] Selected staff employeeId is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Selected staff is not available'
    };
  }

  if (!currentUserId || currentUserId === '0') {
    console.error('[SRSButtonHandler] Current user ID is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Current user ID is not available'
    };
  }

  if (!managingGroupId || managingGroupId === '0') {
    console.error('[SRSButtonHandler] Managing group ID is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Managing group ID is not available'
    };
  }

  if (item.deleted) {
    console.warn('[SRSButtonHandler] Cannot perform ExportResult operation on deleted record');
    return {
      success: false,
      operation: 'error',
      error: 'Cannot perform ExportResult operation on deleted record'
    };
  }

  console.log('[SRSButtonHandler] All parameters validated successfully');

  // ===============================================
  // АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ EXPORTRESULT
  // ===============================================

  const currentExportResultStatus = item.srs; // В ISRSRecord это поле представляет ExportResult
  const newExportResultStatus = !currentExportResultStatus;
  
  console.log('[SRSButtonHandler] *** EXPORTRESULT STATUS ANALYSIS ***');
  console.log('[SRSButtonHandler] Current ExportResult status:', currentExportResultStatus);
  console.log('[SRSButtonHandler] New ExportResult status will be:', newExportResultStatus);
  console.log('[SRSButtonHandler] Operation type:', newExportResultStatus ? 'Enable ExportResult (set to 1)' : 'Disable ExportResult (set to 0)');

  // Проверяем, является ли дата праздничной (используя holidays list Date-only)
  const isHolidayDate = holidays.some(holiday => {
    const normalizedHolidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
    const normalizedItemDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    return SRSDateUtils.areDatesEqual(normalizedHolidayDate, normalizedItemDate);
  });

  const holidayInfo = holidays.find(holiday => {
    const normalizedHolidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
    const normalizedItemDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    return SRSDateUtils.areDatesEqual(normalizedHolidayDate, normalizedItemDate);
  });

  console.log('[SRSButtonHandler] Date analysis (Date-only format):', {
    itemDate: item.date.toLocaleDateString(),
    isHolidayDate,
    holidayTitle: holidayInfo?.title || 'Not a holiday',
    totalHolidays: holidays.length,
    dateFormat: 'Date-only comparison using SRSDateUtils'
  });

  // ===============================================
  // ПОДГОТОВКА ДАННЫХ ДЛЯ ОБНОВЛЕНИЯ
  // ===============================================

  console.log('[SRSButtonHandler] *** PREPARING UPDATE DATA WITH EXPORTRESULT FIELD ***');

  try {
    const staffRecordsService = StaffRecordsService.getInstance(context);

    // Подготавливаем данные для обновления записи
    const updateData: Partial<IStaffRecord> = {
      // Обновляем заголовок записи для отражения ExportResult статуса
      Title: newExportResultStatus 
        ? `Exported Shift on ${SRSDateUtils.formatDateForDisplay(item.date)}${item.typeOfLeave ? ` (${item.typeOfLeave})` : ''}${isHolidayDate ? ` - ${holidayInfo?.title || 'Holiday'}` : ''}`
        : `Regular Shift on ${SRSDateUtils.formatDateForDisplay(item.date)}${item.typeOfLeave ? ` (${item.typeOfLeave})` : ''}${isHolidayDate ? ` - ${holidayInfo?.title || 'Holiday'}` : ''}`,
    };

    // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем ExportResult поле вместо SRS ***
    const exportResultValue = newExportResultStatus ? 1 : 0;
    updateData.ExportResult = exportResultValue;
    
    console.log('[SRSButtonHandler] Update data prepared with ExportResult field:', {
      recordId: item.id,
      oldExportResultValue: currentExportResultStatus,
      newExportResultValue: newExportResultStatus,
      sharePointExportResultField: exportResultValue,
      newTitle: updateData.Title,
      holidayInfo: isHolidayDate ? holidayInfo?.title : 'Regular day',
      dateFormat: 'Date-only with SRSDateUtils formatting',
      fieldUsed: 'ExportResult (1 = exported, 0 = not exported)'
    });

    // ===============================================
    // ВЫПОЛНЕНИЕ ОБНОВЛЕНИЯ НА СЕРВЕРЕ
    // ===============================================

    console.log('[SRSButtonHandler] *** EXECUTING SERVER UPDATE WITH EXPORTRESULT FIELD ***');
    console.log('[SRSButtonHandler] Calling StaffRecordsService.updateStaffRecord...');

    const success = await staffRecordsService.updateStaffRecord(item.id, updateData);

    if (!success) {
      console.error('[SRSButtonHandler] Server update failed');
      return {
        success: false,
        operation: 'toggle_export_result',
        recordId: item.id,
        error: 'Failed to update ExportResult status on server'
      };
    }

    console.log('[SRSButtonHandler] *** SERVER UPDATE SUCCESSFUL WITH EXPORTRESULT FIELD ***');
    console.log('[SRSButtonHandler] ExportResult status updated on server:', {
      recordId: item.id,
      newExportResultStatus,
      sharePointValue: exportResultValue,
      operationType: newExportResultStatus ? 'ExportResult enabled (1)' : 'ExportResult disabled (0)'
    });

    // ===============================================
    // ОБНОВЛЕНИЕ ЛОКАЛЬНОГО СОСТОЯНИЯ
    // ===============================================

    console.log('[SRSButtonHandler] *** UPDATING LOCAL STATE ***');

    // ИСПРАВЛЕНО: Обновляем локальное состояние для немедленного отражения изменений в UI
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => { // ИСПРАВЛЕНО: Явная типизация
        if (record.ID === item.id) {
          return {
            ...record,
            Title: updateData.Title!, // Обновляем заголовок
            ExportResult: exportResultValue // Обновляем ExportResult поле
          };
        }
        return record;
      });

      console.log('[SRSButtonHandler] Local state updated for immediate UI response');

      return {
        ...prevState,
        srsRecords: newSrsRecords
      };
    });

    // ===============================================
    // ОБНОВЛЕНИЕ ДАННЫХ С СЕРВЕРА
    // ===============================================

    console.log('[SRSButtonHandler] *** REFRESHING DATA FROM SERVER ***');
    console.log('[SRSButtonHandler] Scheduling data refresh to sync with server...');

    // Обновляем данные с сервера для полной синхронизации
    setTimeout(() => {
      void refreshSRSData();
    }, 500);

    // ===============================================
    // ВОЗВРАТ РЕЗУЛЬТАТА УСПЕШНОЙ ОПЕРАЦИИ
    // ===============================================

    const result: ISRSButtonOperationResult = {
      success: true,
      operation: 'toggle_export_result',
      recordId: item.id,
      message: newExportResultStatus 
        ? `ExportResult enabled (1) for ${SRSDateUtils.formatDateForDisplay(item.date)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`
        : `ExportResult disabled (0) for ${SRSDateUtils.formatDateForDisplay(item.date)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`
    };

    console.log('[SRSButtonHandler] *** EXPORTRESULT BUTTON OPERATION COMPLETED SUCCESSFULLY ***');
    console.log('[SRSButtonHandler] Final result:', {
      success: result.success,
      operation: result.operation,
      recordId: result.recordId,
      message: result.message,
      dateFormat: 'Date-only format maintained',
      localStateUpdated: true,
      serverStateUpdated: true,
      dataRefreshScheduled: true,
      fieldUsed: 'ExportResult (1 = exported, 0 = not exported)'
    });

    return result;

  } catch (error) {
    console.error('[SRSButtonHandler] Error during ExportResult button operation:', error);

    // Показываем ошибку в состоянии компонента
    setState(prevState => ({
      ...prevState,
      errorSRS: `ExportResult operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));

    return {
      success: false,
      operation: 'error',
      recordId: item.id,
      error: error instanceof Error ? error.message : 'Unknown error occurred during ExportResult operation'
    };
  }
}

/**
 * *** ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ДЛЯ EXPORTRESULT ОПЕРАЦИЙ ***
 */

/**
 * Проверяет, можно ли выполнить ExportResult операцию для записи
 */
export function canPerformExportResultOperation(item: ISRSRecord): { canPerform: boolean; reason?: string } {
  if (item.deleted) {
    return {
      canPerform: false,
      reason: 'Cannot perform ExportResult operation on deleted record'
    };
  }

  // Дополнительные проверки можно добавить здесь
  // Например, проверка на определенные типы отпусков или состояния

  return {
    canPerform: true
  };
}

/**
 * Получает текстовое описание ExportResult операции
 */
export function getExportResultOperationDescription(currentExportResultStatus: boolean, item: ISRSRecord, isHoliday: boolean, holidayTitle?: string): string {
  const operation = currentExportResultStatus ? 'Disable Export (set to 0)' : 'Enable Export (set to 1)';
  const date = SRSDateUtils.formatDateForDisplay(item.date);
  const holidayText = isHoliday ? ` (${holidayTitle || 'Holiday'})` : '';
  const leaveText = item.typeOfLeave ? ` - ${item.typeOfLeave}` : '';
  
  return `${operation} for ${date}${holidayText}${leaveText}`;
}

/**
 * Создает заголовок записи на основе ExportResult статуса и других данных
 */
export function createExportResultRecordTitle(
  date: Date, 
  exportResultStatus: boolean, 
  typeOfLeave?: string, 
  isHoliday: boolean = false, 
  holidayTitle?: string
): string {
  const formattedDate = SRSDateUtils.formatDateForDisplay(date);
  const shiftType = exportResultStatus ? 'Exported Shift' : 'Regular Shift';
  const leaveText = typeOfLeave ? ` (${typeOfLeave})` : '';
  const holidayText = isHoliday ? ` - ${holidayTitle || 'Holiday'}` : '';
  
  return `${shiftType} on ${formattedDate}${leaveText}${holidayText}`;
}

/**
 * Получает статистику ExportResult записей в указанном диапазоне дат
 */
export function getExportResultStatistics(records: ISRSRecord[]): {
  totalRecords: number;
  exportedRecords: number;
  notExportedRecords: number;
  exportedPercentage: number;
  deletedExportedRecords: number;
} {
  const totalRecords = records.length;
  const activeRecords = records.filter(r => !r.deleted);
  const exportedRecords = activeRecords.filter(r => r.srs === true).length; // В ISRSRecord это поле представляет ExportResult
  const notExportedRecords = activeRecords.filter(r => r.srs === false).length;
  const deletedExportedRecords = records.filter(r => r.deleted && r.srs === true).length;
  const exportedPercentage = activeRecords.length > 0 ? Math.round((exportedRecords / activeRecords.length) * 100) : 0;

  return {
    totalRecords,
    exportedRecords,
    notExportedRecords,
    exportedPercentage,
    deletedExportedRecords
  };
}

/**
 * Проверяет наличие конфликтов ExportResult в один день
 */
export function checkExportResultConflicts(records: ISRSRecord[], targetDate: Date): {
  hasConflicts: boolean;
  conflictingRecords: ISRSRecord[];
  details: string[];
} {
  const sameDay = records.filter(record => {
    const normalizedRecordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.date);
    const normalizedTargetDate = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    return SRSDateUtils.areDatesEqual(normalizedRecordDate, normalizedTargetDate) && !record.deleted;
  });

  const exportedOnDay = sameDay.filter(record => record.srs === true); // В ISRSRecord это поле представляет ExportResult
  const hasConflicts = exportedOnDay.length > 1; // Более одной экспортированной записи в день может быть конфликтом

  const details: string[] = [];
  if (hasConflicts) {
    details.push(`Multiple exported records found for ${SRSDateUtils.formatDateForDisplay(targetDate)}`);
    details.push(`Exported records: ${exportedOnDay.length}`);
  }

  return {
    hasConflicts,
    conflictingRecords: exportedOnDay,
    details
  };
}

/**
 * Форматирует результат ExportResult операции для отображения пользователю
 */
export function formatExportResultOperationResult(result: ISRSButtonOperationResult): string {
  if (!result.success) {
    return `ExportResult operation failed: ${result.error || 'Unknown error'}`;
  }

  switch (result.operation) {
    case 'toggle_export_result':
      return result.message || 'ExportResult status updated successfully';
    case 'create_schedule':
      return `Schedule created successfully${result.recordId ? ` (ID: ${result.recordId})` : ''}`;
    case 'update_record':
      return `Record updated successfully${result.recordId ? ` (ID: ${result.recordId})` : ''}`;
    default:
      return 'ExportResult operation completed successfully';
  }
}

/**
 * *** ДОПОЛНИТЕЛЬНАЯ ЛОГИКА ДЛЯ БУДУЩИХ РАСШИРЕНИЙ ***
 */

/**
 * Интерфейс для расширенных ExportResult операций (будущее использование)
 */
export interface IExtendedExportResultOperations {
  bulkToggleExportResult: (records: ISRSRecord[], newStatus: boolean) => Promise<ISRSButtonOperationResult[]>;
  copyExportResultToWeek: (sourceRecord: ISRSRecord, targetWeek: Date) => Promise<ISRSButtonOperationResult>;
  generateExportResultReport: (records: ISRSRecord[], fromDate: Date, toDate: Date) => Promise<string>;
}

/**
 * Проверяет совместимость ExportResult операций с типами отпусков
 */
export function checkExportResultLeaveTypeCompatibility(
  typeOfLeave: string, 
  typesOfLeave: ISRSTypeOfLeave[]
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!typeOfLeave || typeOfLeave === '') {
    return { compatible: true, warnings };
  }

  const leaveType = typesOfLeave.find(type => type.id === typeOfLeave);
  if (!leaveType) {
    warnings.push(`Unknown leave type: ${typeOfLeave}`);
    return { compatible: false, warnings };
  }

  // Дополнительные проверки совместимости можно добавить здесь
  // Например, некоторые типы отпусков могут быть несовместимы с экспортом

  return { compatible: true, warnings };
}

console.log('[SRSButtonHandler] *** EXPORTRESULT BUTTON HANDLER MODULE LOADED ***');
console.log('[SRSButtonHandler] Features available:', {
  mainHandler: 'handleSRSButtonClick (with ExportResult field)',
  utilities: [
    'canPerformExportResultOperation',
    'getExportResultOperationDescription', 
    'createExportResultRecordTitle',
    'getExportResultStatistics',
    'checkExportResultConflicts',
    'formatExportResultOperationResult',
    'checkExportResultLeaveTypeCompatibility'
  ],
  dateFormat: 'Date-only using SRSDateUtils',
  serverIntegration: 'StaffRecordsService.updateStaffRecord with ExportResult field',
  stateManagement: 'Local state update + server data refresh',
  errorHandling: 'Comprehensive error catching and reporting',
  fieldUsed: 'ExportResult (1 = exported, 0 = not exported, not SRS field)'
});