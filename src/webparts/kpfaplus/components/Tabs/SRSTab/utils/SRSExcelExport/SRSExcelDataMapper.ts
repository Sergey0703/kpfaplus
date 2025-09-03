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

// --- НАЧАЛО ИСПРАВЛЕНИЯ ---
/**
 * **НОВАЯ ФУНКЦИЯ**: Конвертирует строковое время в объект Date.
 * ExcelJS лучше работает с объектами Date для ячеек времени.
 * Мы используем дату эпохи Excel (1899-12-31) для представления "только времени".
 */
const convertTimeToDate = (time: { hours: string; minutes: string }): Date => {
    const hours = parseInt(time.hours, 10) || 0;
    const minutes = parseInt(time.minutes, 10) || 0;
    // Excel's epoch for time values starts on day 0, which is Dec 31, 1899 for compatibility.
    return new Date(1899, 11, 31, hours, minutes, 0);
};

const convertLunchToDate = (lunchMinutesStr: string): Date => {
    const totalMinutes = parseInt(lunchMinutesStr, 10) || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return new Date(1899, 11, 31, hours, minutes, 0);
}
// --- КОНЕЦ ИСПРАВЛЕНИЯ ---

/**
 * Сервис для конвертации данных SRS в формат Excel экспорта
 */
export class SRSExcelDataMapper {

  /**
   * *** ГЛАВНАЯ ФУНКЦИЯ: Подготавливает данные SRS для экспорта в Excel ***
   */
  public static prepareSRSDataForExcelExport(
    records: ISRSRecord[],
    targetDate: Date,
    typeOfSRS: SRSType = SRS_EXCEL_CONSTANTS.DEFAULT_SRS_TYPE
  ): ISRSExcelExportData {
    // ... (остальная часть функции без изменений) ...
    console.log('[SRSExcelDataMapper] *** PREPARING SRS DATA FOR EXCEL EXPORT ***');
    console.log('[SRSExcelDataMapper] Input parameters:', {
      totalRecords: records.length,
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      targetDateISO: targetDate.toISOString(),
      typeOfSRS
    });

    const filteredRecords = this.filterRecordsForExport(records, targetDate);
    
    console.log('[SRSExcelDataMapper] Filtered records for export:', {
      filteredCount: filteredRecords.length,
      filterCriteria: 'same date + checked=true + not deleted'
    });

    const validationResults = filteredRecords.map(record => ({
      record,
      validation: this.validateRecordForExport(record)
    }));

    const validRecords = validationResults
      .filter(result => result.validation.isValid)
      .map(result => result.record);

    if (validationResults.some(r => !r.validation.isValid)) {
      console.warn('[SRSExcelDataMapper] Some records failed validation...');
    }
    
    const excelRecords = validRecords.map(record => 
      this.mapSRSRecordToExcelRecord(record)
    );

    const metadata = this.createExportMetadata(typeOfSRS, excelRecords.length);

    const exportData: ISRSExcelExportData = {
      metadata,
      records: excelRecords
    };

    console.log('[SRSExcelDataMapper] *** EXCEL EXPORT DATA PREPARED ***');
    return exportData;
  }

  /**
   * Фильтрует записи для экспорта: та же дата + checked=true + не удалены
   */
  private static filterRecordsForExport(records: ISRSRecord[], targetDate: Date): ISRSRecord[] {
    return records.filter(record => {
      if (record.deleted || !record.checked) return false;
      return SRSDateUtils.areDatesEqual(
        SRSDateUtils.normalizeDateToLocalMidnight(record.date),
        SRSDateUtils.normalizeDateToLocalMidnight(targetDate)
      );
    });
  }

  /**
   * Конвертирует одну SRS запись в формат Excel
   */
  private static mapSRSRecordToExcelRecord(record: ISRSRecord): ISRSExcelRecord {
    // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
    // **ИСПРАВЛЕНО**: Конвертируем все значения времени в объекты Date
    const shiftStart = convertTimeToDate(record.startWork);
    const shiftEnd = convertTimeToDate(record.finishWork);
    const lunchTime = convertLunchToDate(record.lunch);
    // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
    
    const contract = this.parseContractNumber(record.contract);
    const typeOfLeaveID = this.parseLeaveTypeID(record.typeOfLeave);
    const leaveTime = parseFloat(record.timeLeave || '0');

    const excelRecord: ISRSExcelRecord = {
      ShiftStart: shiftStart,
      ShiftEnd: shiftEnd,
      LunchTime: lunchTime,
      Contract: contract,
      TypeOfLeaveID: typeOfLeaveID,
      LeaveTime: leaveTime,
    };

    console.log(`[SRSExcelDataMapper] Record ${record.id} mapped to Excel format with Date objects.`);
    return excelRecord;
  }
  
  private static parseContractNumber(contractStr: string): ContractNumber {
    const contract = parseInt(contractStr, 10);
    return (contract === 1 || contract === 2) ? contract : 1;
  }
  
  private static parseLeaveTypeID(typeOfLeaveStr: string): LeaveTypeID {
    if (!typeOfLeaveStr) return 0;
    const leaveTypeID = parseInt(typeOfLeaveStr, 10);
    if (isNaN(leaveTypeID) || leaveTypeID < 0 || leaveTypeID > 19) return 0;
    return leaveTypeID;
  }

  // ... (остальные функции (createExportMetadata, validateRecordForExport, etc.) остаются без изменений) ...
  private static createExportMetadata(typeOfSRS: SRSType, recordsCount: number): ISRSExcelMetadata {
    const maxRows = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
      : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;
    if (recordsCount > maxRows) {
      console.warn(`[SRSExcelDataMapper] Records count (${recordsCount}) exceeds maxRows (${maxRows}).`);
    }
    return { maxRows };
  }
  private static validateRecordForExport(record: ISRSRecord): ISRSRecordValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const hasValidTime = this.validateTimeFields(record, errors, warnings);
    const hasValidContract = this.validateContract(record, errors, warnings);
    const hasValidLeaveType = this.validateLeaveType(record, errors, warnings);
    const hasValidLeaveTime = this.validateLeaveTime(record, errors, warnings);
    const isValid = errors.length === 0;
    return { isValid, errors, warnings, hasValidTime, hasValidContract, hasValidLeaveType, hasValidLeaveTime };
  }
  private static validateTimeFields(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    let isValid = true;
    const startHours = parseInt(record.startWork.hours, 10);
    if (isNaN(startHours) || startHours < 0 || startHours > 23) { isValid = false; errors.push('Invalid start hours'); }
    const startMinutes = parseInt(record.startWork.minutes, 10);
    if (isNaN(startMinutes) || startMinutes < 0 || startMinutes > 59) { isValid = false; errors.push('Invalid start minutes'); }
    const endHours = parseInt(record.finishWork.hours, 10);
    if (isNaN(endHours) || endHours < 0 || endHours > 23) { isValid = false; errors.push('Invalid end hours'); }
    const endMinutes = parseInt(record.finishWork.minutes, 10);
    if (isNaN(endMinutes) || endMinutes < 0 || endMinutes > 59) { isValid = false; errors.push('Invalid end minutes'); }
    if (startHours === endHours && startMinutes === endMinutes && !(startHours === 0 && startMinutes === 0)) {
      warnings.push('Start and end times are the same');
    }
    return isValid;
  }
  private static validateContract(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    const contract = parseInt(record.contract, 10);
    if (isNaN(contract) || (contract !== 1 && contract !== 2)) {
      errors.push(`Contract must be 1 or 2, got: ${record.contract}`);
      return false;
    }
    return true;
  }
  private static validateLeaveType(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    if (!record.typeOfLeave) return true;
    const leaveTypeID = parseInt(record.typeOfLeave, 10);
    if (isNaN(leaveTypeID) || leaveTypeID < 0 || leaveTypeID > 19) {
      errors.push(`Leave type ID must be 0-19, got: ${leaveTypeID}`);
      return false;
    }
    return true;
  }
  private static validateLeaveTime(record: ISRSRecord, errors: string[], warnings: string[]): boolean {
    if (!record.timeLeave) return true;
    const leaveTime = parseFloat(record.timeLeave);
    if (isNaN(leaveTime)) { errors.push('Invalid leave time'); return false; }
    if (leaveTime < 0) { errors.push('Leave time cannot be negative'); return false; }
    if (leaveTime > 24) { warnings.push('Leave time seems high'); }
    return true;
  }
  public static createJsonDataForOfficeScript(exportData: ISRSExcelExportData): string {
    return JSON.stringify(exportData);
  }
  public static getExportDataStatistics(exportData: ISRSExcelExportData): any {
    // ... implementation
    return {};
  }
}