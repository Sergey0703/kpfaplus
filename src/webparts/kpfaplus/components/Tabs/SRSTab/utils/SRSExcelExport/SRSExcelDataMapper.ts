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
 * **НОВАЯ ФУНКЦИЯ**: Конвертирует строковое время в объект Date в UTC.
 * Это предотвращает проблемы с часовыми поясами при записи файла.
 * Excel хранит время как дробную часть дня, начиная с эпохи 1899-12-30 (из-за бага с високосным 1900 годом).
 */
const convertTimeToUTCDate = (time: { hours: string; minutes: string }): Date => {
    const hours = parseInt(time.hours, 10) || 0;
    const minutes = parseInt(time.minutes, 10) || 0;
    // Создаем UTC дату, чтобы избежать смещения часового пояса
    return new Date(Date.UTC(1899, 11, 30, hours, minutes));
};

const convertLunchToUTCDate = (lunchMinutesStr: string): Date => {
    const totalMinutes = parseInt(lunchMinutesStr, 10) || 0;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return new Date(Date.UTC(1899, 11, 30, hours, minutes));
}
// --- КОНЕЦ ИСПРАВЛЕНИЯ ---


export class SRSExcelDataMapper {

  public static prepareSRSDataForExcelExport(
    records: ISRSRecord[],
    targetDate: Date,
    typeOfSRS: SRSType = SRS_EXCEL_CONSTANTS.DEFAULT_SRS_TYPE
  ): ISRSExcelExportData {
    
    const validRecords = records.filter(record => {
      if (record.deleted || !record.checked) return false;
      const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.date);
      const targetDateNormalized = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
      return SRSDateUtils.areDatesEqual(recordDate, targetDateNormalized);
    }).filter(r => this.validateRecordForExport(r).isValid);
    
    const excelRecords = validRecords.map(record => 
      this.mapSRSRecordToExcelRecord(record)
    );

    const metadata = this.createExportMetadata(typeOfSRS, excelRecords.length);

    return { metadata, records: excelRecords };
  }

  private static mapSRSRecordToExcelRecord(record: ISRSRecord): ISRSExcelRecord {
    // **ИСПРАВЛЕНО**: Конвертируем все значения времени в объекты Date (UTC)
    const shiftStart = convertTimeToUTCDate(record.startWork);
    const shiftEnd = convertTimeToUTCDate(record.finishWork);
    const lunchTime = convertLunchToUTCDate(record.lunch);
    const leaveTime = parseFloat(record.timeLeave || '0');
    
    const contract = this.parseContractNumber(record.contract);
    const typeOfLeaveID = this.parseLeaveTypeID(record.typeOfLeave);

    return {
      ShiftStart: shiftStart,
      ShiftEnd: shiftEnd,
      LunchTime: lunchTime,
      Contract: contract,
      TypeOfLeaveID: typeOfLeaveID,
      LeaveTime: leaveTime,
    };
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

  private static createExportMetadata(typeOfSRS: SRSType, recordsCount: number): ISRSExcelMetadata {
      const maxRows = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
        ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
        : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;
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

  private static validateTimeFields(record: ISRSRecord, errors: string[], warnings: string[]): boolean { return true; }
  private static validateContract(record: ISRSRecord, errors: string[], warnings: string[]): boolean { return true; }
  private static validateLeaveType(record: ISRSRecord, errors: string[], warnings: string[]): boolean { return true; }
  private static validateLeaveTime(record: ISRSRecord, errors: string[], warnings: string[]): boolean { return true; }
}