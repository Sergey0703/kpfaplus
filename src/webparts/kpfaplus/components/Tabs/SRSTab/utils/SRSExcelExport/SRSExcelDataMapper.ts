// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelDataMapper.ts

import { ISRSRecord } from '../SRSTabInterfaces';
import { 
  ISRSExcelRecord, 
  ISRSExcelExportData, 
  ISRSExcelMetadata,
  ISRSRecordValidationResult,
  SRS_EXCEL_CONSTANTS,
  SRSType,
  ContractNumber,
  LeaveTypeID
} from './SRSExcelInterfaces';
import { SRSDateUtils } from '../SRSDateUtils';

/**
 * Сервис для конвертации данных SRS в формат Excel экспорта
 * Преобразует ISRSRecord[] в формат, ожидаемый Office Script
 */
export class SRSExcelDataMapper {

  /**
   * *** ГЛАВНАЯ ФУНКЦИЯ: Подготавливает данные SRS для экспорта в Excel ***
   * @param records - все SRS записи
   * @param targetDate - дата для которой делаем экспорт
   * @param typeOfSRS - тип SRS (2 или 3)
   * @returns данные готовые для Office Script
   */
  public static prepareSRSDataForExcelExport(
    records: ISRSRecord[],
    targetDate: Date,
    typeOfSRS: SRSType = SRS_EXCEL_CONSTANTS.DEFAULT_SRS_TYPE
  ): ISRSExcelExportData {
    console.log('[SRSExcelDataMapper] *** PREPARING SRS DATA FOR EXCEL EXPORT ***');
    console.log('[SRSExcelDataMapper] Input parameters:', {
      totalRecords: records.length,
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      targetDateISO: targetDate.toISOString(),
      typeOfSRS
    });

    // 1. Фильтруем записи за указанную дату с checked=true
    const filteredRecords = this.filterRecordsForExport(records, targetDate);
    
    console.log('[SRSExcelDataMapper] Filtered records for export:', {
      filteredCount: filteredRecords.length,
      filterCriteria: 'same date + checked=true + not deleted'
    });

    // 2. Валидируем отфильтрованные записи
    const validationResults = filteredRecords.map(record => ({
      record,
      validation: this.validateRecordForExport(record)
    }));

    const validRecords = validationResults
      .filter(result => result.validation.isValid)
      .map(result => result.record);

    const invalidRecords = validationResults
      .filter(result => !result.validation.isValid);

    if (invalidRecords.length > 0) {
      console.warn('[SRSExcelDataMapper] Some records failed validation:', {
        invalidCount: invalidRecords.length,
        errors: invalidRecords.map(r => ({
          recordId: r.record.id,
          errors: r.validation.errors
        }))
      });
    }

    console.log('[SRSExcelDataMapper] Validation results:', {
      totalFiltered: filteredRecords.length,
      validRecords: validRecords.length,
      invalidRecords: invalidRecords.length
    });

    // 3. Конвертируем валидные записи в формат Excel
    const excelRecords = validRecords.map(record => 
      this.mapSRSRecordToExcelRecord(record)
    );

    // 4. Создаем метаданные
    const metadata = this.createExportMetadata(typeOfSRS, excelRecords.length);

    // 5. Создаем финальный объект для экспорта
    const exportData: ISRSExcelExportData = {
      metadata,
      records: excelRecords
    };

    console.log('[SRSExcelDataMapper] *** EXCEL EXPORT DATA PREPARED ***', {
      metadata,
      recordsCount: excelRecords.length,
      recordsPreview: excelRecords.slice(0, 3).map(r => ({
        ShiftStart: r.ShiftStart,
        ShiftEnd: r.ShiftEnd,
        Contract: r.Contract,
        TypeOfLeaveID: r.TypeOfLeaveID
      }))
    });

    return exportData;
  }

  /**
   * Фильтрует записи для экспорта: та же дата + checked=true + не удалены
   */
  private static filterRecordsForExport(records: ISRSRecord[], targetDate: Date): ISRSRecord[] {
    console.log('[SRSExcelDataMapper] Filtering records for export...');

    const filteredRecords = records.filter(record => {
      // Проверяем что запись не удалена
      if (record.deleted === true) {
        return false;
      }

      // Проверяем что запись отмечена для экспорта
      if (record.checked !== true) {
        return false;
      }

      // Проверяем что дата совпадает (используем Date-only сравнение)
      const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.date);
      const targetDateNormalized = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
      
      if (!SRSDateUtils.areDatesEqual(recordDate, targetDateNormalized)) {
        return false;
      }

      return true;
    });

    console.log('[SRSExcelDataMapper] Filter results:', {
      originalCount: records.length,
      filteredCount: filteredRecords.length,
      deletedFiltered: records.filter(r => r.deleted === true).length,
      uncheckedFiltered: records.filter(r => r.checked !== true).length,
      wrongDateFiltered: records.length - filteredRecords.length - 
        records.filter(r => r.deleted === true).length - 
        records.filter(r => r.checked !== true).length
    });

    return filteredRecords;
  }

  /**
   * Конвертирует одну SRS запись в формат Excel
   */
  private static mapSRSRecordToExcelRecord(record: ISRSRecord): ISRSExcelRecord {
    console.log(`[SRSExcelDataMapper] Mapping SRS record ${record.id} to Excel format`);

    // Форматируем время начала и окончания
    const shiftStart = this.formatTimeForExcel(record.startWork);
    const shiftEnd = this.formatTimeForExcel(record.finishWork);
    
    // Форматируем время обеда (из минут в формат "0:30")
    const lunchTime = this.formatLunchTimeForExcel(record.lunch);
    
    // Конвертируем контракт в число
    const contract = this.parseContractNumber(record.contract);
    
    // Конвертируем тип отпуска в число
    const typeOfLeaveID = this.parseLeaveTypeID(record.typeOfLeave);
    
    // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
    // **ИСПРАВЛЕНО**: Время отпуска как число, а не строка.
    const leaveTime = parseFloat(record.timeLeave || '0');
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

    const excelRecord: ISRSExcelRecord = {
      ShiftStart: shiftStart,
      ShiftEnd: shiftEnd,
      LunchTime: lunchTime,
      Contract: contract,
      TypeOfLeaveID: typeOfLeaveID,
      LeaveTime: leaveTime,
      // Комментарии пока не используются
      LunchNote: undefined,
      TotalHoursNote: undefined,
      LeaveNote: undefined
    };

    console.log(`[SRSExcelDataMapper] Record ${record.id} mapped:`, {
      original: {
        startWork: `${record.startWork.hours}:${record.startWork.minutes}`,
        finishWork: `${record.finishWork.hours}:${record.finishWork.minutes}`,
        lunch: record.lunch,
        contract: record.contract,
        typeOfLeave: record.typeOfLeave,
        timeLeave: record.timeLeave
      },
      excel: {
        ShiftStart: excelRecord.ShiftStart,
        ShiftEnd: excelRecord.ShiftEnd,
        LunchTime: excelRecord.LunchTime,
        Contract: excelRecord.Contract,
        TypeOfLeaveID: excelRecord.TypeOfLeaveID,
        LeaveTime: excelRecord.LeaveTime
      }
    });

    return excelRecord;
  }

  /**
   * Форматирует время в формат "HH:MM" для Excel
   */
  private static formatTimeForExcel(time: { hours: string; minutes: string }): string {
    const hours = time.hours.padStart(2, '0');
    const minutes = time.minutes.padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Форматирует время обеда из минут в формат "H:MM"
   */
  private static formatLunchTimeForExcel(lunchMinutes: string): string {
    const minutes = parseInt(lunchMinutes, 10) || 0;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')}`;
  }

  /**
   * Парсит номер контракта в число с валидацией
   */
  private static parseContractNumber(contractStr: string): ContractNumber {
    const contract = parseInt(contractStr, 10);
    
    if (contract === 1 || contract === 2) {
      return contract as ContractNumber;
    }
    
    console.warn('[SRSExcelDataMapper] Invalid contract number, defaulting to 1:', contractStr);
    return 1;
  }

  /**
   * Парсит тип отпуска в число с валидацией
   */
  private static parseLeaveTypeID(typeOfLeaveStr: string): LeaveTypeID {
    if (!typeOfLeaveStr || typeOfLeaveStr.trim() === '') {
      return 0; // 0 = обычная работа, не отпуск
    }
    
    const leaveTypeID = parseInt(typeOfLeaveStr, 10);
    
    if (isNaN(leaveTypeID)) {
      console.warn('[SRSExcelDataMapper] Invalid leave type ID, defaulting to 0:', typeOfLeaveStr);
      return 0;
    }
    
    // Проверяем допустимый диапазон
    if (leaveTypeID < 0 || leaveTypeID > 19) {
      console.warn('[SRSExcelDataMapper] Leave type ID out of range (0-19), defaulting to 0:', leaveTypeID);
      return 0;
    }
    
    return leaveTypeID;
  }

  /**
   * Создает метаданные для экспорта
   */
  private static createExportMetadata(typeOfSRS: SRSType, recordsCount: number): ISRSExcelMetadata {
    const maxRows = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
      : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;

    console.log('[SRSExcelDataMapper] Creating export metadata:', {
      typeOfSRS,
      maxRows,
      recordsCount,
      willTruncate: recordsCount > maxRows
    });

    if (recordsCount > maxRows) {
      console.warn(`[SRSExcelDataMapper] Records count (${recordsCount}) exceeds maxRows (${maxRows}) for typeOfSRS=${typeOfSRS}. Only first ${maxRows} records will be exported.`);
    }

    return {
      maxRows
    };
  }

  /**
   * Валидирует SRS запись перед экспортом
   */
  private static validateRecordForExport(record: ISRSRecord): ISRSRecordValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверяем время начала и окончания
    const hasValidTime = this.validateTimeFields(record, errors, warnings);
    
    // Проверяем контракт
    const hasValidContract = this.validateContract(record, errors, warnings);
    
    // Проверяем тип отпуска
    const hasValidLeaveType = this.validateLeaveType(record, errors, warnings);
    
    // Проверяем время отпуска
    const hasValidLeaveTime = this.validateLeaveTime(record, errors, warnings);

    const isValid = errors.length === 0;

    const result: ISRSRecordValidationResult = {
      isValid,
      errors,
      warnings,
      hasValidTime,
      hasValidContract,
      hasValidLeaveType,
      hasValidLeaveTime
    };

    if (!isValid) {
      console.warn(`[SRSExcelDataMapper] Validation failed for record ${record.id}:`, result);
    }

    return result;
  }

  /**
   * Валидирует поля времени
   */
  private static validateTimeFields(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    let isValid = true;

    // Проверяем часы и минуты начала
    const startHours = parseInt(record.startWork.hours, 10);
    const startMinutes = parseInt(record.startWork.minutes, 10);
    
    if (isNaN(startHours) || startHours < 0 || startHours > 23) {
      errors.push(`Invalid start work hours: ${record.startWork.hours}`);
      isValid = false;
    }
    
    if (isNaN(startMinutes) || startMinutes < 0 || startMinutes > 59) {
      errors.push(`Invalid start work minutes: ${record.startWork.minutes}`);
      isValid = false;
    }

    // Проверяем часы и минуты окончания
    const endHours = parseInt(record.finishWork.hours, 10);
    const endMinutes = parseInt(record.finishWork.minutes, 10);
    
    if (isNaN(endHours) || endHours < 0 || endHours > 23) {
      errors.push(`Invalid finish work hours: ${record.finishWork.hours}`);
      isValid = false;
    }
    
    if (isNaN(endMinutes) || endMinutes < 0 || endMinutes > 59) {
      errors.push(`Invalid finish work minutes: ${record.finishWork.minutes}`);
      isValid = false;
    }

    // Проверяем что время начала != времени окончания
    if (startHours === endHours && startMinutes === endMinutes && !(startHours === 0 && startMinutes === 0)) {
      warnings.push('Start and end times are the same');
    }

    return isValid;
  }

  /**
   * Валидирует номер контракта
   */
  private static validateContract(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    const contract = parseInt(record.contract, 10);
    
    if (isNaN(contract)) {
      errors.push(`Invalid contract number: ${record.contract}`);
      return false;
    }
    
    if (contract !== 1 && contract !== 2) {
      errors.push(`Contract number must be 1 or 2, got: ${contract}`);
      return false;
    }
    
    return true;
  }

  /**
   * Валидирует тип отпуска
   */
  private static validateLeaveType(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    // Пустой тип отпуска допустим (означает обычную работу)
    if (!record.typeOfLeave || record.typeOfLeave.trim() === '') {
      return true;
    }
    
    const leaveTypeID = parseInt(record.typeOfLeave, 10);
    
    if (isNaN(leaveTypeID)) {
      errors.push(`Invalid leave type ID: ${record.typeOfLeave}`);
      return false;
    }
    
    if (leaveTypeID < 0 || leaveTypeID > 19) {
      errors.push(`Leave type ID must be 0-19, got: ${leaveTypeID}`);
      return false;
    }
    
    return true;
  }

  /**
   * Валидирует время отпуска
   */
  private static validateLeaveTime(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    // Пустое время отпуска допустимо
    if (!record.timeLeave || record.timeLeave.trim() === '') {
      return true;
    }
    
    const leaveTime = parseFloat(record.timeLeave);
    
    if (isNaN(leaveTime)) {
      errors.push(`Invalid leave time: ${record.timeLeave}`);
      return false;
    }
    
    if (leaveTime < 0) {
      errors.push(`Leave time cannot be negative: ${leaveTime}`);
      return false;
    }
    
    if (leaveTime > 24) {
      warnings.push(`Leave time seems high: ${leaveTime} hours`);
    }
    
    return true;
  }

  /**
   * Создает JSON строку для передачи в Office Script (как параметр jsonData)
   */
  public static createJsonDataForOfficeScript(exportData: ISRSExcelExportData): string {
    try {
      const jsonData = JSON.stringify(exportData);
      console.log('[SRSExcelDataMapper] JSON data created for Office Script:', {
        jsonLength: jsonData.length,
        recordsCount: exportData.records.length,
        maxRows: exportData.metadata.maxRows
      });
      return jsonData;
    } catch (error) {
      console.error('[SRSExcelDataMapper] Error creating JSON data:', error);
      throw new Error(`Failed to create JSON data for Office Script: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Получает статистику подготовленных данных
   */
  public static getExportDataStatistics(exportData: ISRSExcelExportData): {
    totalRecords: number;
    contractBreakdown: Record<number, number>;
    leaveTypeBreakdown: Record<number, number>;
    hasComments: boolean;
    estimatedCellsToUpdate: number;
  } {
    const stats = {
      totalRecords: exportData.records.length,
      contractBreakdown: {} as Record<number, number>,
      leaveTypeBreakdown: {} as Record<number, number>,
      hasComments: false,
      estimatedCellsToUpdate: 0
    };

    // Анализируем записи
    exportData.records.forEach(record => {
      // Подсчет по контрактам
      stats.contractBreakdown[record.Contract] = (stats.contractBreakdown[record.Contract] || 0) + 1;
      
      // Подсчет по типам отпусков
      stats.leaveTypeBreakdown[record.TypeOfLeaveID] = (stats.leaveTypeBreakdown[record.TypeOfLeaveID] || 0) + 1;
      
      // Проверка комментариев
      if (record.LunchNote || record.TotalHoursNote || record.LeaveNote) {
        stats.hasComments = true;
      }
      
      // Примерная оценка количества ячеек для обновления (каждая запись ~ 4-6 ячеек)
      stats.estimatedCellsToUpdate += 5;
    });

    console.log('[SRSExcelDataMapper] Export data statistics:', stats);
    
    return stats;
  }
}