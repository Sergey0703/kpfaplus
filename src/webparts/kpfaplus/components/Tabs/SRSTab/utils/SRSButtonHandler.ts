// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSButtonHandler.ts

import { ISRSRecord, ISRSTabState } from './SRSTabInterfaces';
import { IHoliday } from '../../../../services/HolidaysService';
import { ISRSTypeOfLeave } from './SRSTabInterfaces';
import { SRSDateUtils } from './SRSDateUtils';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * *** НОВЫЙ ФАЙЛ: Обработчик кнопки SRS ***
 * Содержит логику обработки нажатия кнопки SRS в первой строке каждого дня
 */

/**
 * Интерфейс параметров для обработчика кнопки SRS
 */
export interface ISRSButtonHandlerParams {
  item: ISRSRecord;
  context: any;
  selectedStaff: { id: string; name: string; employeeId: string };
  currentUserId?: string;
  managingGroupId?: string;
  state: ISRSTabState;
  holidays: IHoliday[];
  typesOfLeave: ISRSTypeOfLeave[];
  refreshSRSData: () => Promise<void>;
  setState: (updater: (prev: ISRSTabState) => ISRSTabState) => void;
}

/**
 * Результат операции SRS кнопки
 */
export interface ISRSButtonOperationResult {
  success: boolean;
  operation: 'toggle_srs' | 'create_schedule' | 'update_record' | 'error';
  recordId?: string;
  message?: string;
  error?: string;
}

/**
 * *** ГЛАВНАЯ ФУНКЦИЯ: Обработчик нажатия кнопки SRS ***
 * 
 * Логика работы:
 * 1. Проверяет текущий SRS статус записи
 * 2. Переключает SRS флаг (true/false)
 * 3. Обновляет запись на сервере
 * 4. Обновляет локальные данные
 * 
 * @param params - Параметры для обработки SRS операции
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
  console.log('[SRSButtonHandler] State has', params.state.srsRecords.length, 'records'); // ИСПРАВЛЕНО
  console.log('[SRSButtonHandler] Available leave types:', params.typesOfLeave.length);

  console.log('[SRSButtonHandler] *** SRS BUTTON CLICK HANDLER STARTED ***');
  console.log('[SRSButtonHandler] Item details:', {
    id: item.id,
    date: item.date.toLocaleDateString(),
    dateISO: item.date.toISOString(),
    currentSRSStatus: item.srs,
    typeOfLeave: item.typeOfLeave || 'No type of leave',
    deleted: item.deleted,
    dateFormat: 'Date-only using SRSDateUtils'
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
    console.warn('[SRSButtonHandler] Cannot perform SRS operation on deleted record');
    return {
      success: false,
      operation: 'error',
      error: 'Cannot perform SRS operation on deleted record'
    };
  }

  console.log('[SRSButtonHandler] All parameters validated successfully');

  // ===============================================
  // АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ SRS
  // ===============================================

  const currentSRSStatus = item.srs;
  const newSRSStatus = !currentSRSStatus;
  
  console.log('[SRSButtonHandler] *** SRS STATUS ANALYSIS ***');
  console.log('[SRSButtonHandler] Current SRS status:', currentSRSStatus);
  console.log('[SRSButtonHandler] New SRS status will be:', newSRSStatus);
  console.log('[SRSButtonHandler] Operation type:', newSRSStatus ? 'Enable SRS' : 'Disable SRS');

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

  console.log('[SRSButtonHandler] *** PREPARING UPDATE DATA ***');

  try {
    const staffRecordsService = StaffRecordsService.getInstance(context);

    // Подготавливаем данные для обновления записи
    const updateData: Partial<IStaffRecord> = {
      // Обновляем заголовок записи для отражения SRS статуса
      Title: newSRSStatus 
        ? `SRS Shift on ${SRSDateUtils.formatDateForDisplay(item.date)}${item.typeOfLeave ? ` (${item.typeOfLeave})` : ''}${isHolidayDate ? ` - ${holidayInfo?.title || 'Holiday'}` : ''}`
        : `Regular Shift on ${SRSDateUtils.formatDateForDisplay(item.date)}${item.typeOfLeave ? ` (${item.typeOfLeave})` : ''}${isHolidayDate ? ` - ${holidayInfo?.title || 'Holiday'}` : ''}`,
    };

    // Добавляем SRS поле если оно существует в IStaffRecord
    const srsFieldValue = newSRSStatus ? 1 : 0;
    (updateData as any).srs = srsFieldValue; // Используем any для обхода типизации
    //const exportResultValue = newSRSStatus ? 1 : 0;
    //updateData.ExportResult = exportResultValue;
    console.log('[SRSButtonHandler] Update data prepared:', {
      recordId: item.id,
      oldSRSValue: currentSRSStatus,
      newSRSValue: newSRSStatus,
      sharePointSRSField: srsFieldValue,
      //sharePointExportResultField: exportResultValue,
      newTitle: updateData.Title,
      holidayInfo: isHolidayDate ? holidayInfo?.title : 'Regular day',
      dateFormat: 'Date-only with SRSDateUtils formatting'
    });

    // ===============================================
    // ВЫПОЛНЕНИЕ ОБНОВЛЕНИЯ НА СЕРВЕРЕ
    // ===============================================

    console.log('[SRSButtonHandler] *** EXECUTING SERVER UPDATE ***');
    console.log('[SRSButtonHandler] Calling StaffRecordsService.updateStaffRecord...');

    const success = await staffRecordsService.updateStaffRecord(item.id, updateData);

    if (!success) {
      console.error('[SRSButtonHandler] Server update failed');
      return {
        success: false,
        operation: 'toggle_srs',
        recordId: item.id,
        error: 'Failed to update SRS status on server'
      };
    }

    console.log('[SRSButtonHandler] *** SERVER UPDATE SUCCESSFUL ***');
    console.log('[SRSButtonHandler] SRS status updated on server:', {
      recordId: item.id,
      newSRSStatus,
      sharePointValue: srsFieldValue,
      operationType: newSRSStatus ? 'SRS enabled' : 'SRS disabled'
    });

    // ===============================================
    // ОБНОВЛЕНИЕ ЛОКАЛЬНОГО СОСТОЯНИЯ
    // ===============================================

    console.log('[SRSButtonHandler] *** UPDATING LOCAL STATE ***');

    // ИСПРАВЛЕНО: Обновляем локальное состояние для немедленного отражения изменений в UI
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: any) => { // ИСПРАВЛЕНО
        if (record.ID === item.id) {
          return {
            ...record,
            Title: updateData.Title! // Обновляем заголовок
          };
        }
        return record;
      });

      console.log('[SRSButtonHandler] Local state updated for immediate UI response');

      return {
        ...prevState,
        srsRecords: newSrsRecords // ИСПРАВЛЕНО
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
      operation: 'toggle_srs',
      recordId: item.id,
      message: newSRSStatus 
        ? `SRS enabled for ${SRSDateUtils.formatDateForDisplay(item.date)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`
        : `SRS disabled for ${SRSDateUtils.formatDateForDisplay(item.date)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`
    };

    console.log('[SRSButtonHandler] *** SRS BUTTON OPERATION COMPLETED SUCCESSFULLY ***');
    console.log('[SRSButtonHandler] Final result:', {
      success: result.success,
      operation: result.operation,
      recordId: result.recordId,
      message: result.message,
      dateFormat: 'Date-only format maintained',
      localStateUpdated: true,
      serverStateUpdated: true,
      dataRefreshScheduled: true
    });

    return result;

  } catch (error) {
    console.error('[SRSButtonHandler] Error during SRS button operation:', error);

    // Показываем ошибку в состоянии компонента
    setState(prevState => ({
      ...prevState,
      errorSRS: `SRS operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));

    return {
      success: false,
      operation: 'error',
      recordId: item.id,
      error: error instanceof Error ? error.message : 'Unknown error occurred during SRS operation'
    };
  }
}

/**
 * *** ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ ДЛЯ SRS ОПЕРАЦИЙ ***
 */

/**
 * Проверяет, можно ли выполнить SRS операцию для записи
 */
export function canPerformSRSOperation(item: ISRSRecord): { canPerform: boolean; reason?: string } {
  if (item.deleted) {
    return {
      canPerform: false,
      reason: 'Cannot perform SRS operation on deleted record'
    };
  }

  // Дополнительные проверки можно добавить здесь
  // Например, проверка на определенные типы отпусков или состояния

  return {
    canPerform: true
  };
}

/**
 * Получает текстовое описание SRS операции
 */
export function getSRSOperationDescription(currentSRSStatus: boolean, item: ISRSRecord, isHoliday: boolean, holidayTitle?: string): string {
  const operation = currentSRSStatus ? 'Disable SRS' : 'Enable SRS';
  const date = SRSDateUtils.formatDateForDisplay(item.date);
  const holidayText = isHoliday ? ` (${holidayTitle || 'Holiday'})` : '';
  const leaveText = item.typeOfLeave ? ` - ${item.typeOfLeave}` : '';
  
  return `${operation} for ${date}${holidayText}${leaveText}`;
}

/**
 * Создает заголовок записи на основе SRS статуса и других данных
 */
export function createSRSRecordTitle(
  date: Date, 
  srsStatus: boolean, 
  typeOfLeave?: string, 
  isHoliday: boolean = false, 
  holidayTitle?: string
): string {
  const formattedDate = SRSDateUtils.formatDateForDisplay(date);
  const shiftType = srsStatus ? 'SRS Shift' : 'Regular Shift';
  const leaveText = typeOfLeave ? ` (${typeOfLeave})` : '';
  const holidayText = isHoliday ? ` - ${holidayTitle || 'Holiday'}` : '';
  
  return `${shiftType} on ${formattedDate}${leaveText}${holidayText}`;
}

/**
 * Получает статистику SRS записей в указанном диапазоне дат
 */
export function getSRSStatistics(records: ISRSRecord[]): {
  totalRecords: number;
  srsEnabledRecords: number;
  srsDisabledRecords: number;
  srsPercentage: number;
  deletedSRSRecords: number;
} {
  const totalRecords = records.length;
  const activeRecords = records.filter(r => !r.deleted);
  const srsEnabledRecords = activeRecords.filter(r => r.srs === true).length;
  const srsDisabledRecords = activeRecords.filter(r => r.srs === false).length;
  const deletedSRSRecords = records.filter(r => r.deleted && r.srs === true).length;
  const srsPercentage = activeRecords.length > 0 ? Math.round((srsEnabledRecords / activeRecords.length) * 100) : 0;

  return {
    totalRecords,
    srsEnabledRecords,
    srsDisabledRecords,
    srsPercentage,
    deletedSRSRecords
  };
}

/**
 * Проверяет наличие конфликтов SRS в один день
 */
export function checkSRSConflicts(records: ISRSRecord[], targetDate: Date): {
  hasConflicts: boolean;
  conflictingRecords: ISRSRecord[];
  details: string[];
} {
  const sameDay = records.filter(record => {
    const normalizedRecordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.date);
    const normalizedTargetDate = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    return SRSDateUtils.areDatesEqual(normalizedRecordDate, normalizedTargetDate) && !record.deleted;
  });

  const srsEnabledOnDay = sameDay.filter(record => record.srs === true);
  const hasConflicts = srsEnabledOnDay.length > 1; // Более одной SRS записи в день может быть конфликтом

  const details: string[] = [];
  if (hasConflicts) {
    details.push(`Multiple SRS records found for ${SRSDateUtils.formatDateForDisplay(targetDate)}`);
    details.push(`SRS enabled records: ${srsEnabledOnDay.length}`);
  }

  return {
    hasConflicts,
    conflictingRecords: srsEnabledOnDay,
    details
  };
}

/**
 * Форматирует результат SRS операции для отображения пользователю
 */
export function formatSRSOperationResult(result: ISRSButtonOperationResult): string {
  if (!result.success) {
    return `SRS operation failed: ${result.error || 'Unknown error'}`;
  }

  switch (result.operation) {
    case 'toggle_srs':
      return result.message || 'SRS status updated successfully';
    case 'create_schedule':
      return `Schedule created successfully${result.recordId ? ` (ID: ${result.recordId})` : ''}`;
    case 'update_record':
      return `Record updated successfully${result.recordId ? ` (ID: ${result.recordId})` : ''}`;
    default:
      return 'SRS operation completed successfully';
  }
}

/**
 * *** ДОПОЛНИТЕЛЬНАЯ ЛОГИКА ДЛЯ БУДУЩИХ РАСШИРЕНИЙ ***
 */

/**
 * Интерфейс для расширенных SRS операций (будущее использование)
 */
export interface IExtendedSRSOperations {
  bulkToggleSRS: (records: ISRSRecord[], newStatus: boolean) => Promise<ISRSButtonOperationResult[]>;
  copySRSToWeek: (sourceRecord: ISRSRecord, targetWeek: Date) => Promise<ISRSButtonOperationResult>;
  generateSRSReport: (records: ISRSRecord[], fromDate: Date, toDate: Date) => Promise<string>;
}

/**
 * Проверяет совместимость SRS операций с типами отпусков
 */
export function checkSRSLeaveTypeCompatibility(
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
  // Например, некоторые типы отпусков могут быть несовместимы с SRS

  return { compatible: true, warnings };
}

console.log('[SRSButtonHandler] *** SRS BUTTON HANDLER MODULE LOADED ***');
console.log('[SRSButtonHandler] Features available:', {
  mainHandler: 'handleSRSButtonClick',
  utilities: [
    'canPerformSRSOperation',
    'getSRSOperationDescription', 
    'createSRSRecordTitle',
    'getSRSStatistics',
    'checkSRSConflicts',
    'formatSRSOperationResult',
    'checkSRSLeaveTypeCompatibility'
  ],
  dateFormat: 'Date-only using SRSDateUtils',
  serverIntegration: 'StaffRecordsService.updateStaffRecord',
  stateManagement: 'Local state update + server data refresh',
  errorHandling: 'Comprehensive error catching and reporting'
});