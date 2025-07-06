// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDataMapper.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ISRSRecord } from './SRSTabInterfaces';
import { SRSDateUtils } from './SRSDateUtils';

/**
 * Утилита для преобразования IStaffRecord в ISRSRecord
 * ОБНОВЛЕНО: Поле Date теперь Date-only, ShiftDate1-4 больше не используются
 * Используется только числовые поля времени для ScheduleTab совместимости
 * Holiday поле больше не используется - праздники определяются из списка holidays (Date-only)
 */
export class SRSDataMapper {

  /**
   * Преобразует массив IStaffRecord в массив ISRSRecord
   * ОБНОВЛЕНО: Date-only формат и только числовые поля времени
   */
  public static mapStaffRecordsToSRSRecords(staffRecords: IStaffRecord[]): ISRSRecord[] {
    console.log('[SRSDataMapper] Converting', staffRecords.length, 'IStaffRecord to ISRSRecord with Date-only format');
    console.log('[SRSDataMapper] Using only numeric time fields, no ShiftDate1-4 support');
    
    return staffRecords.map((record, index) => {
      try {
        return SRSDataMapper.mapSingleStaffRecordToSRS(record);
      } catch (error) {
        console.error(`[SRSDataMapper] Error converting record ${index} (ID: ${record.ID}):`, error);
        // Возвращаем пустую запись в случае ошибки
        return SRSDataMapper.createEmptySRSRecord(record.ID);
      }
    });
  }

  /**
   * Преобразует одну запись IStaffRecord в ISRSRecord
   * ОБНОВЛЕНО: Date-only формат, только числовые поля времени, без Holiday поля
   */
  private static mapSingleStaffRecordToSRS(record: IStaffRecord): ISRSRecord {
    console.log(`[SRSDataMapper] *** MAPPING STAFF RECORD ${record.ID} TO SRS RECORD (Date-only format) ***`);
    console.log(`[SRSDataMapper] Record data:`, {
      ID: record.ID,
      Date: record.Date ? SRSDateUtils.formatDateForDisplay(record.Date) : 'No date',
      DateISO: record.Date ? record.Date.toISOString() : 'No date',
      TypeOfLeaveID: record.TypeOfLeaveID,
      TypeOfLeave: record.TypeOfLeave,
      LeaveTime: record.LeaveTime,
      WorkTime: record.WorkTime,
      // Числовые поля времени
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes,
      // Удаленные поля
      noShiftDateFields: 'ShiftDate1-4 fields no longer used',
      holidayFieldIgnored: 'Holiday field is now determined from holidays list (Date-only), not from StaffRecords',
      dateFormat: 'Date-only (no time component)'
    });

    // Парсим Date поле с использованием Date-only утилит
    const parsedDate = record.Date ? SRSDateUtils.parseSharePointDate(record.Date) : new Date();
    console.log(`[SRSDataMapper] Parsed Date (Date-only):`, {
      original: record.Date ? record.Date.toISOString() : 'No date',
      parsed: parsedDate.toISOString(),
      display: SRSDateUtils.formatDateForDisplay(parsedDate)
    });

    // Извлекаем время начала и окончания работы из числовых полей
    const startWork = SRSDataMapper.extractTimeFromNumericFields(
      record.ShiftDate1Hours, 
      record.ShiftDate1Minutes
    );
    const finishWork = SRSDataMapper.extractTimeFromNumericFields(
      record.ShiftDate2Hours, 
      record.ShiftDate2Minutes
    );
    
    console.log(`[SRSDataMapper] Extracted time from numeric fields:`, {
      startWork: `${startWork.hours}:${startWork.minutes}`,
      finishWork: `${finishWork.hours}:${finishWork.minutes}`,
      source: 'Numeric time fields (ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes)'
    });
    
    // Определяем день недели из Date-only поля
    const dayOfWeek = SRSDataMapper.getDayOfWeek(parsedDate);
    
    // Извлечение типа отпуска
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    
    // Рассчитываем рабочие часы
    const hours = record.WorkTime || '0.00';
    
    // Holiday поле теперь всегда 0 (будет определяться из списка праздников Date-only)
    const holidayValue = 0;
    
    // Определяем статус
    const status = SRSDataMapper.determineStatus(record);
    
    const srsRecord: ISRSRecord = {
      id: record.ID,
      date: parsedDate, // Date-only формат
      dayOfWeek: dayOfWeek,
      hours: hours,
      relief: false,
      startWork: startWork, // Из числовых полей
      finishWork: finishWork, // Из числовых полей
      lunch: (record.TimeForLunch || 0).toString(),
      typeOfLeave: typeOfLeaveValue,
      timeLeave: (record.LeaveTime || 0).toString(),
      shift: 1,
      contract: (record.Contract || 1).toString(),
      contractCheck: true,
      status: status,
      srs: !!typeOfLeaveValue && typeOfLeaveValue !== '',
      checked: false,
      deleted: record.Deleted === 1,
      Holiday: holidayValue // Всегда 0, так как праздники определяются из holidays list (Date-only)
    };

    console.log(`[SRSDataMapper] *** MAPPED SRS RECORD (Date-only format) ***:`, {
      id: srsRecord.id,
      date: SRSDateUtils.formatDateForDisplay(srsRecord.date),
      dateISO: srsRecord.date.toISOString(),
      startWork: `${srsRecord.startWork.hours}:${srsRecord.startWork.minutes}`,
      finishWork: `${srsRecord.finishWork.hours}:${srsRecord.finishWork.minutes}`,
      Holiday: srsRecord.Holiday,
      HolidayDeterminedBy: 'Holidays list (Date-only) in component, not StaffRecords field',
      dateFormat: 'Date-only (no time component)',
      timeFieldsSource: 'Numeric fields only'
    });

    return srsRecord;
  }

  /**
   * Извлечение времени из числовых полей
   * ОБНОВЛЕНО: Более строгая валидация для Date-only совместимости
   */
  private static extractTimeFromNumericFields(
    hours?: number, 
    minutes?: number
  ): { hours: string; minutes: string } {
    
    console.log(`[SRSDataMapper] extractTimeFromNumericFields called with:`, {
      hours: hours,
      minutes: minutes,
      hoursType: typeof hours,
      minutesType: typeof minutes
    });

    // Валидация и нормализация часов
    let normalizedHours = 0;
    if (typeof hours === 'number' && !isNaN(hours) && hours >= 0 && hours <= 23) {
      normalizedHours = Math.floor(hours);
    } else if (typeof hours === 'string') {
      const parsedHours = parseInt(hours, 10);
      if (!isNaN(parsedHours) && parsedHours >= 0 && parsedHours <= 23) {
        normalizedHours = parsedHours;
      }
    }
    
    // Валидация и нормализация минут
    let normalizedMinutes = 0;
    if (typeof minutes === 'number' && !isNaN(minutes) && minutes >= 0 && minutes <= 59) {
      normalizedMinutes = Math.floor(minutes);
    } else if (typeof minutes === 'string') {
      const parsedMinutes = parseInt(minutes, 10);
      if (!isNaN(parsedMinutes) && parsedMinutes >= 0 && parsedMinutes <= 59) {
        normalizedMinutes = parsedMinutes;
      }
    }
    
    // Форматируем в двузначные строки
    const hoursStr = normalizedHours.toString().padStart(2, '0');
    const minutesStr = normalizedMinutes.toString().padStart(2, '0');
    
    const result = {
      hours: hoursStr,
      minutes: minutesStr
    };

    console.log(`[SRSDataMapper] extractTimeFromNumericFields result:`, {
      input: { hours, minutes },
      normalized: { hours: normalizedHours, minutes: normalizedMinutes },
      formatted: result,
      source: 'Numeric time fields for Date-only compatibility'
    });
    
    return result;
  }

  /**
   * Извлечение TypeOfLeaveID из StaffRecord
   * Без изменений - не зависит от Date формата
   */
  private static extractTypeOfLeaveID(record: IStaffRecord): string {
    let typeOfLeaveValue = '';
    
    // Прямое поле TypeOfLeaveID
    if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0') {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      return typeOfLeaveValue;
    }
    
    // Объект TypeOfLeave с полем Id
    if (record.TypeOfLeave && typeof record.TypeOfLeave === 'object') {
      const typeOfLeaveObj = record.TypeOfLeave as unknown as Record<string, unknown>;
      
      if (typeOfLeaveObj.Id && typeOfLeaveObj.Id !== '' && typeOfLeaveObj.Id !== '0') {
        typeOfLeaveValue = String(typeOfLeaveObj.Id);
        return typeOfLeaveValue;
      }
      
      if (typeOfLeaveObj.ID && typeOfLeaveObj.ID !== '' && typeOfLeaveObj.ID !== '0') {
        typeOfLeaveValue = String(typeOfLeaveObj.ID);
        return typeOfLeaveValue;
      }
    }
    
    // TypeOfLeaveID как число
    if (typeof record.TypeOfLeaveID === 'number' && record.TypeOfLeaveID > 0) {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      return typeOfLeaveValue;
    }
    
    return '';
  }

  /**
   * Получает день недели в формате строки
   * ОБНОВЛЕНО: Работает с Date-only форматом
   */
  private static getDayOfWeek(date: Date): string {
    try {
      // Нормализуем дату для корректного определения дня недели
      const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(date);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayOfWeek = days[normalizedDate.getDay()];
      
      console.log(`[SRSDataMapper] getDayOfWeek (Date-only):`, {
        input: date.toISOString(),
        normalized: normalizedDate.toISOString(),
        dayOfWeek: dayOfWeek
      });
      
      return dayOfWeek;
    } catch (error) {
      console.warn('[SRSDataMapper] Error getting day of week:', error);
      return 'Unknown';
    }
  }

  /**
   * Определяет статус записи
   * ОБНОВЛЕНО: Убрана зависимость от Holiday поля из StaffRecords
   */
  private static determineStatus(record: IStaffRecord): 'positive' | 'negative' | 'none' {
    if (record.Deleted === 1) {
      return 'negative';
    }
    
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    if (typeOfLeaveValue && typeOfLeaveValue !== '') {
      return 'positive';
    }
    
    // Holiday поле больше не используется для определения статуса
    // Праздники определяются из списка праздников (Date-only)
    
    if (record.LeaveTime && record.LeaveTime > 0) {
      return 'positive';
    }
    
    return 'none';
  }

  /**
   * Создает пустую SRS запись в случае ошибки
   * ОБНОВЛЕНО: Date-only формат, Holiday всегда 0
   */
  private static createEmptySRSRecord(id: string): ISRSRecord {
    const emptyDate = new Date();
    const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(emptyDate);
    
    return {
      id: id,
      date: normalizedDate, // Date-only формат
      dayOfWeek: 'Unknown',
      hours: '0.00',
      relief: false,
      startWork: { hours: '00', minutes: '00' },
      finishWork: { hours: '00', minutes: '00' },
      lunch: '0',
      typeOfLeave: '',
      timeLeave: '0.00',
      shift: 1,
      contract: '1',
      contractCheck: false,
      status: 'none',
      srs: false,
      checked: false,
      deleted: false,
      Holiday: 0 // Всегда 0 - определяется из списка праздников Date-only
    };
  }

  /**
   * Преобразует ISRSRecord обратно в частичный IStaffRecord для сохранения
   * ОБНОВЛЕНО: Date-only формат, числовые поля времени, без Holiday поля
   */
  public static mapSRSRecordToStaffRecordUpdate(srsRecord: ISRSRecord): Partial<IStaffRecord> {
    console.log(`[SRSDataMapper] *** MAPPING SRS RECORD TO STAFF RECORD UPDATE (Date-only format) ***`);
    console.log(`[SRSDataMapper] SRS Record ID: ${srsRecord.id}`);
    console.log(`[SRSDataMapper] Type of leave: "${srsRecord.typeOfLeave}"`);
    console.log(`[SRSDataMapper] Date (Date-only): ${SRSDateUtils.formatDateForDisplay(srsRecord.date)}`);
    console.log(`[SRSDataMapper] Holiday field NOT saved: Holiday determined from holidays list (Date-only), not saved to StaffRecords`);
    
    const updateData: Partial<IStaffRecord> = {
      ID: srsRecord.id,
      // Date поле: используем Date-only формат для SharePoint
      Date: SRSDateUtils.normalizeDateToLocalMidnight(srsRecord.date),
      TimeForLunch: parseInt(srsRecord.lunch) || 0,
      LeaveTime: parseFloat(srsRecord.timeLeave) || 0,
      Contract: parseInt(srsRecord.contract) || 1,
      Deleted: srsRecord.deleted ? 1 : 0
      // Holiday поле НЕ сохраняется - больше не используется
    };

    // Сохранение времени через числовые поля
    const startHours = parseInt(srsRecord.startWork.hours, 10);
    const startMinutes = parseInt(srsRecord.startWork.minutes, 10);
    const finishHours = parseInt(srsRecord.finishWork.hours, 10);
    const finishMinutes = parseInt(srsRecord.finishWork.minutes, 10);

    if (!isNaN(startHours) && startHours >= 0 && startHours <= 23) {
      updateData.ShiftDate1Hours = startHours;
    }
    if (!isNaN(startMinutes) && startMinutes >= 0 && startMinutes <= 59) {
      updateData.ShiftDate1Minutes = startMinutes;
    }
    if (!isNaN(finishHours) && finishHours >= 0 && finishHours <= 23) {
      updateData.ShiftDate2Hours = finishHours;
    }
    if (!isNaN(finishMinutes) && finishMinutes >= 0 && finishMinutes <= 59) {
      updateData.ShiftDate2Minutes = finishMinutes;
    }

    // Сохранение типа отпуска
    if (srsRecord.typeOfLeave && srsRecord.typeOfLeave !== '') {
      updateData.TypeOfLeaveID = srsRecord.typeOfLeave;
    } else {
      updateData.TypeOfLeaveID = '';
    }

    console.log('[SRSDataMapper] *** MAPPED UPDATE DATA (Date-only format) ***:', {
      originalId: srsRecord.id,
      dateField: 'Date-only format',
      dateValue: updateData.Date?.toISOString(),
      timeFieldsUsed: 'NUMERIC (Hours/Minutes)',
      startTime: `${updateData.ShiftDate1Hours}:${updateData.ShiftDate1Minutes}`,
      finishTime: `${updateData.ShiftDate2Hours}:${updateData.ShiftDate2Minutes}`,
      holidayFieldHandling: 'NOT SAVED - determined from holidays list (Date-only)',
      noShiftDateFields: 'ShiftDate1-4 fields no longer used'
    });

    return updateData;
  }

  /**
   * Валидация SRS записи
   * Без изменений - не зависит от Date формата
   */
  public static isValidSRSRecord(record: IStaffRecord): boolean {
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    const isValid = typeOfLeaveValue !== '' && typeOfLeaveValue !== '0';
    
    if (!isValid) {
      console.log(`[SRSDataMapper] Record ${record.ID} is NOT valid for SRS (no type of leave)`);
    } else {
      console.log(`[SRSDataMapper] Record ${record.ID} is valid for SRS (type of leave: ${typeOfLeaveValue})`);
    }
    
    return isValid;
  }

  /**
   * Фильтрация записей для SRS
   * Без изменений - не зависит от Date формата
   */
  public static filterSRSRecords(staffRecords: IStaffRecord[]): IStaffRecord[] {
    console.log(`[SRSDataMapper] Filtering ${staffRecords.length} staff records for SRS (Date-only format)`);
    
    const srsRecords = staffRecords.filter(record => SRSDataMapper.isValidSRSRecord(record));
    
    console.log(`[SRSDataMapper] Filtered to ${srsRecords.length} valid SRS records`);
    
    return srsRecords;
  }

  /**
   * Получение статистики по типам отпусков
   * Без изменений - не зависит от Date формата
   */
  public static getTypeOfLeaveStatistics(staffRecords: IStaffRecord[]): Record<string, number> {
    console.log(`[SRSDataMapper] Analyzing type of leave statistics for ${staffRecords.length} records (Date-only format)`);
    
    const stats: Record<string, number> = {};
    
    staffRecords.forEach(record => {
      const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
      const key = typeOfLeaveValue || 'No Type';
      
      stats[key] = (stats[key] || 0) + 1;
    });
    
    console.log(`[SRSDataMapper] Type of leave statistics:`, stats);
    
    return stats;
  }

  /**
   * Отладочная информация о записи
   * ОБНОВЛЕНО: Убрана отладка Holiday поля, добавлена Date-only информация
   */
  public static debugRecordMapping(record: IStaffRecord): void {
    console.log(`[SRSDataMapper] *** DEBUG INFO FOR RECORD ${record.ID} (Date-only format) ***`);
    console.log(`[SRSDataMapper] Date (Date-only):`, record.Date ? SRSDateUtils.formatDateForDisplay(record.Date) : 'No date');
    console.log(`[SRSDataMapper] Date ISO:`, record.Date ? record.Date.toISOString() : 'No date');
    console.log(`[SRSDataMapper] TypeOfLeaveID (direct):`, record.TypeOfLeaveID);
    console.log(`[SRSDataMapper] TypeOfLeave (object):`, record.TypeOfLeave);
    console.log(`[SRSDataMapper] LeaveTime:`, record.LeaveTime);
    console.log(`[SRSDataMapper] Extracted type of leave:`, SRSDataMapper.extractTypeOfLeaveID(record));
    console.log(`[SRSDataMapper] Is valid SRS record:`, SRSDataMapper.isValidSRSRecord(record));
    
    // Числовые поля времени
    console.log(`[SRSDataMapper] Numeric time fields:`, {
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes
    });
    
    console.log(`[SRSDataMapper] Holiday handling: Now determined from holidays list (Date-only), not from StaffRecords field`);
    console.log(`[SRSDataMapper] ShiftDate1-4 fields: No longer used`);
    console.log(`[SRSDataMapper] Date format: Date-only (no time component)`);
    console.log(`[SRSDataMapper] All record keys:`, Object.keys(record));
  }

  /**
   * Создание данных для нового SRS записи
   * ОБНОВЛЕНО: Date-only формат без Holiday поля
   */
  public static createNewStaffRecordData(
    date: Date,
    staffData: {
      timeForLunch?: number;
      contract?: number;
      typeOfLeaveID?: string;
      startHours?: number;
      startMinutes?: number;
      endHours?: number;
      endMinutes?: number;
    } = {}
  ): Partial<IStaffRecord> {
    console.log(`[SRSDataMapper] *** CREATING NEW STAFF RECORD DATA (Date-only format) ***`);
    
    const {
      timeForLunch = 30,
      contract = 1,
      typeOfLeaveID = '',
      startHours = 0,
      startMinutes = 0,
      endHours = 0,
      endMinutes = 0
    } = staffData;

    // Нормализуем дату к Date-only формату
    const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(date);

    const newRecordData: Partial<IStaffRecord> = {
      Date: normalizedDate, // Date-only формат
      // Числовые поля времени
      ShiftDate1Hours: startHours,
      ShiftDate1Minutes: startMinutes,
      ShiftDate2Hours: endHours,
      ShiftDate2Minutes: endMinutes,
      TimeForLunch: timeForLunch,
      Contract: contract,
      TypeOfLeaveID: typeOfLeaveID,
      LeaveTime: 0,
      WorkTime: '0:00',
      Deleted: 0,
      Holiday: 0, // Всегда 0 - праздники определяются из holidays list (Date-only)
      Title: typeOfLeaveID ? `Leave on ${SRSDateUtils.formatDateForDisplay(normalizedDate)}` : `SRS Shift on ${SRSDateUtils.formatDateForDisplay(normalizedDate)}`
    };

    console.log(`[SRSDataMapper] New staff record data prepared (Date-only format):`, {
      date: SRSDateUtils.formatDateForDisplay(newRecordData.Date!),
      dateISO: newRecordData.Date!.toISOString(),
      startTime: `${newRecordData.ShiftDate1Hours}:${newRecordData.ShiftDate1Minutes}`,
      endTime: `${newRecordData.ShiftDate2Hours}:${newRecordData.ShiftDate2Minutes}`,
      timeForLunch: newRecordData.TimeForLunch,
      contract: newRecordData.Contract,
      typeOfLeaveID: newRecordData.TypeOfLeaveID,
      Holiday: newRecordData.Holiday + ' (always 0 - determined from holidays list Date-only)',
      title: newRecordData.Title,
      dateFormat: 'Date-only (no time component)',
      noShiftDateSupport: true
    });

    return newRecordData;
  }

  /**
   * Валидация данных для создания записи
   * ОБНОВЛЕНО: Date-only валидация без Holiday поля
   */
  public static validateStaffRecordData(recordData: Partial<IStaffRecord>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка даты с Date-only валидацией
    if (!recordData.Date) {
      errors.push('Date is required');
    } else {
      const dateValidation = SRSDateUtils.validateDateForSharePoint(recordData.Date);
      if (!dateValidation.isValid) {
        errors.push(`Invalid date: ${dateValidation.error}`);
      }
    }

    // Проверка числовых полей времени
    if (recordData.ShiftDate1Hours !== undefined) {
      if (recordData.ShiftDate1Hours < 0 || recordData.ShiftDate1Hours > 23) {
        errors.push('Start hours must be between 0 and 23');
      }
    }

    if (recordData.ShiftDate1Minutes !== undefined) {
      if (recordData.ShiftDate1Minutes < 0 || recordData.ShiftDate1Minutes > 59) {
        errors.push('Start minutes must be between 0 and 59');
      }
    }

    if (recordData.ShiftDate2Hours !== undefined) {
      if (recordData.ShiftDate2Hours < 0 || recordData.ShiftDate2Hours > 23) {
        errors.push('End hours must be between 0 and 23');
      }
    }

    if (recordData.ShiftDate2Minutes !== undefined) {
      if (recordData.ShiftDate2Minutes < 0 || recordData.ShiftDate2Minutes > 59) {
        errors.push('End minutes must be between 0 and 59');
      }
    }

    // Проверка времени обеда
    if (recordData.TimeForLunch !== undefined) {
      if (recordData.TimeForLunch < 0 || recordData.TimeForLunch > 120) {
        errors.push('Lunch time must be between 0 and 120 minutes');
      }
    }

    // Проверка контракта
    if (recordData.Contract !== undefined) {
      if (recordData.Contract < 1 || recordData.Contract > 3) {
        errors.push('Contract must be 1, 2, or 3');
      }
    }

    // Предупреждение о Holiday поле
    if (recordData.Holiday !== undefined && recordData.Holiday !== 0) {
      warnings.push('Holiday field should always be 0 - holidays are determined from holidays list (Date-only)');
    }

    console.log(`[SRSDataMapper] Validation result for staff record data (Date-only format):`, {
      isValid: errors.length === 0,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      holidayFieldHandling: 'Should always be 0 (Date-only)',
      dateFormat: 'Date-only (no time component)'
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}