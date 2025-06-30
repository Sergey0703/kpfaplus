// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDataMapper.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ISRSRecord } from './SRSTabInterfaces';

/**
 * Утилита для преобразования IStaffRecord в ISRSRecord
 * РЕФАКТОРИНГ: Переход с полей ShiftDate1/ShiftDate2 (Date) на числовые поля времени
 * ОБНОВЛЕНО: Использует ShiftDate1Hours/Minutes и ShiftDate2Hours/Minutes
 * *** ИСПРАВЛЕНО: Убрано извлечение Holiday поля из StaffRecords - теперь Holiday определяется из списка праздников ***
 */
export class SRSDataMapper {

  /**
   * Преобразует массив IStaffRecord в массив ISRSRecord
   */
  public static mapStaffRecordsToSRSRecords(staffRecords: IStaffRecord[]): ISRSRecord[] {
    console.log('[SRSDataMapper] Converting', staffRecords.length, 'IStaffRecord to ISRSRecord with NUMERIC TIME FIELDS and NO Holiday field mapping');
    
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
   * РЕФАКТОРИНГ: Использует числовые поля времени вместо Date объектов
   * *** ИСПРАВЛЕНО: Убрано извлечение Holiday поля - теперь всегда 0 (определяется из списка праздников) ***
   */
  private static mapSingleStaffRecordToSRS(record: IStaffRecord): ISRSRecord {
    console.log(`[SRSDataMapper] *** MAPPING STAFF RECORD ${record.ID} TO SRS RECORD WITHOUT HOLIDAY FIELD ***`);
    console.log(`[SRSDataMapper] Record data:`, {
      ID: record.ID,
      Date: record.Date?.toLocaleDateString(),
      TypeOfLeaveID: record.TypeOfLeaveID,
      TypeOfLeave: record.TypeOfLeave,
      LeaveTime: record.LeaveTime,
      WorkTime: record.WorkTime,
      // *** РЕФАКТОРИНГ: Логируем числовые поля времени ***
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes,
      // *** ИСПРАВЛЕНО: НЕ логируем Holiday поле, так как оно больше не используется ***
      HolidayFieldIgnored: 'Holiday field is now determined from holidays list, not from StaffRecords'
    });

    // *** РЕФАКТОРИНГ: Извлекаем время начала и окончания работы из числовых полей ***
    const startWork = SRSDataMapper.extractTimeFromNumericFields(
      record.ShiftDate1Hours, 
      record.ShiftDate1Minutes
    );
    const finishWork = SRSDataMapper.extractTimeFromNumericFields(
      record.ShiftDate2Hours, 
      record.ShiftDate2Minutes
    );
    
    console.log(`[SRSDataMapper] Extracted time:`, {
      startWork: `${startWork.hours}:${startWork.minutes}`,
      finishWork: `${finishWork.hours}:${finishWork.minutes}`
    });
    
    // Определяем день недели
    const dayOfWeek = SRSDataMapper.getDayOfWeek(record.Date);
    
    // Извлечение типа отпуска
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    
    // Рассчитываем рабочие часы
    const hours = record.WorkTime || '0.00';
    
    // *** ИСПРАВЛЕНО: Holiday поле теперь всегда 0 (будет определяться из списка праздников) ***
    const holidayValue = 0; // Больше не извлекаем из StaffRecords
    
    // Определяем статус
    const status = SRSDataMapper.determineStatus(record);
    
    const srsRecord: ISRSRecord = {
      id: record.ID,
      date: record.Date,
      dayOfWeek: dayOfWeek,
      hours: hours,
      relief: false,
      startWork: startWork, // *** РЕФАКТОРИНГ: Используем числовые поля ***
      finishWork: finishWork, // *** РЕФАКТОРИНГ: Используем числовые поля ***
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
      // *** ИСПРАВЛЕНО: Holiday всегда 0 - будет определяться из списка праздников ***
      Holiday: holidayValue // Всегда 0, так как праздники определяются из holidays list
    };

    console.log(`[SRSDataMapper] *** MAPPED SRS RECORD WITHOUT HOLIDAY FIELD ***:`, {
      id: srsRecord.id,
      date: srsRecord.date.toLocaleDateString(),
      startWork: `${srsRecord.startWork.hours}:${srsRecord.startWork.minutes}`,
      finishWork: `${srsRecord.finishWork.hours}:${srsRecord.finishWork.minutes}`,
      Holiday: srsRecord.Holiday,
      HolidayDeterminedBy: 'Holidays list in component, not StaffRecords field'
    });

    return srsRecord;
  }

  /**
   * *** НОВАЯ ФУНКЦИЯ: Извлечение времени из числовых полей ***
   * Преобразует числовые часы и минуты в объект с валидными строковыми значениями
   */
  private static extractTimeFromNumericFields(
    hours?: number, 
    minutes?: number
  ): { hours: string; minutes: string } {
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
    
    return {
      hours: hoursStr,
      minutes: minutesStr
    };
  }

  /**
   * *** УДАЛЕНО: extractHolidayValue - больше не используется ***
   * Holiday поле теперь определяется из списка праздников, а не из StaffRecords
   */

  /**
   * Извлечение TypeOfLeaveID из StaffRecord
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
   */
  private static getDayOfWeek(date: Date): string {
    try {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[date.getDay()];
    } catch (error) {
      console.warn('[SRSDataMapper] Error getting day of week:', error);
      return 'Unknown';
    }
  }

  /**
   * Определяет статус записи
   * *** ИСПРАВЛЕНО: Убрана зависимость от Holiday поля из StaffRecords ***
   */
  private static determineStatus(record: IStaffRecord): 'positive' | 'negative' | 'none' {
    if (record.Deleted === 1) {
      return 'negative';
    }
    
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    if (typeOfLeaveValue && typeOfLeaveValue !== '') {
      return 'positive';
    }
    
    // *** ИСПРАВЛЕНО: Убрана проверка holiday поля из StaffRecords ***
    // Праздники теперь определяются из списка праздников, а не из поля записи
    
    if (record.LeaveTime && record.LeaveTime > 0) {
      return 'positive';
    }
    
    return 'none';
  }

  /**
   * Создает пустую SRS запись в случае ошибки
   * *** ИСПРАВЛЕНО: Holiday всегда 0 ***
   */
  private static createEmptySRSRecord(id: string): ISRSRecord {
    return {
      id: id,
      date: new Date(),
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
      // *** ИСПРАВЛЕНО: Holiday всегда 0 - определяется из списка праздников ***
      Holiday: 0
    };
  }

  /**
   * Преобразует ISRSRecord обратно в частичный IStaffRecord для сохранения
   * РЕФАКТОРИНГ: Использует числовые поля времени вместо Date объектов
   * *** ИСПРАВЛЕНО: Убрано сохранение Holiday поля - не сохраняем его в StaffRecords ***
   */
  public static mapSRSRecordToStaffRecordUpdate(srsRecord: ISRSRecord): Partial<IStaffRecord> {
    console.log(`[SRSDataMapper] *** MAPPING SRS RECORD TO STAFF RECORD UPDATE WITHOUT HOLIDAY FIELD ***`);
    console.log(`[SRSDataMapper] SRS Record ID: ${srsRecord.id}`);
    console.log(`[SRSDataMapper] Type of leave: "${srsRecord.typeOfLeave}"`);
    console.log(`[SRSDataMapper] Holiday field NOT saved: Holiday determined from holidays list, not saved to StaffRecords`);
    
    const updateData: Partial<IStaffRecord> = {
      ID: srsRecord.id,
      TimeForLunch: parseInt(srsRecord.lunch) || 0,
      LeaveTime: parseFloat(srsRecord.timeLeave) || 0,
      Contract: parseInt(srsRecord.contract) || 1,
      Deleted: srsRecord.deleted ? 1 : 0
      // *** ИСПРАВЛЕНО: Holiday поле НЕ сохраняется - больше не используется ***
      // Holiday: srsRecord.Holiday - УДАЛЕНО
    };

    // *** РЕФАКТОРИНГ: Сохранение времени через числовые поля ***
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

    console.log('[SRSDataMapper] *** MAPPED UPDATE DATA WITHOUT HOLIDAY FIELD ***:', {
      originalId: srsRecord.id,
      timeFieldsUsed: 'NUMERIC (Hours/Minutes)',
      startTime: `${updateData.ShiftDate1Hours}:${updateData.ShiftDate1Minutes}`,
      finishTime: `${updateData.ShiftDate2Hours}:${updateData.ShiftDate2Minutes}`,
      holidayFieldHandling: 'NOT SAVED - determined from holidays list'
    });

    return updateData;
  }

  /**
   * Валидация SRS записи
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
   */
  public static filterSRSRecords(staffRecords: IStaffRecord[]): IStaffRecord[] {
    console.log(`[SRSDataMapper] Filtering ${staffRecords.length} staff records for SRS`);
    
    const srsRecords = staffRecords.filter(record => SRSDataMapper.isValidSRSRecord(record));
    
    console.log(`[SRSDataMapper] Filtered to ${srsRecords.length} valid SRS records`);
    
    return srsRecords;
  }

  /**
   * Получение статистики по типам отпусков
   */
  public static getTypeOfLeaveStatistics(staffRecords: IStaffRecord[]): Record<string, number> {
    console.log(`[SRSDataMapper] Analyzing type of leave statistics for ${staffRecords.length} records`);
    
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
   * *** УДАЛЕНО: getHolidayStatistics - теперь праздники определяются из списка праздников ***
   * Используйте getHolidayRecordsStatistics из SRSTabInterfaces вместо этого
   */

  /**
   * Отладочная информация о записи
   * *** ИСПРАВЛЕНО: Убрана отладка Holiday поля ***
   */
  public static debugRecordMapping(record: IStaffRecord): void {
    console.log(`[SRSDataMapper] *** DEBUG INFO FOR RECORD ${record.ID} WITHOUT HOLIDAY FIELD ***`);
    console.log(`[SRSDataMapper] TypeOfLeaveID (direct):`, record.TypeOfLeaveID);
    console.log(`[SRSDataMapper] TypeOfLeave (object):`, record.TypeOfLeave);
    console.log(`[SRSDataMapper] LeaveTime:`, record.LeaveTime);
    console.log(`[SRSDataMapper] Extracted type of leave:`, SRSDataMapper.extractTypeOfLeaveID(record));
    console.log(`[SRSDataMapper] Is valid SRS record:`, SRSDataMapper.isValidSRSRecord(record));
    // *** ИСПРАВЛЕНО: Убрана отладка Holiday поля ***
    console.log(`[SRSDataMapper] Holiday handling: Now determined from holidays list, not from StaffRecords field`);
    console.log(`[SRSDataMapper] All record keys:`, Object.keys(record));
  }

  /**
   * *** ИСПРАВЛЕНО: Создание данных для нового SRS записи без Holiday поля ***
   * Подготавливает данные для создания новой записи StaffRecord
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
    console.log(`[SRSDataMapper] *** CREATING NEW STAFF RECORD DATA WITHOUT HOLIDAY FIELD ***`);
    
    const {
      timeForLunch = 30,
      contract = 1,
      typeOfLeaveID = '',
      startHours = 0,
      startMinutes = 0,
      endHours = 0,
      endMinutes = 0
    } = staffData;

    const newRecordData: Partial<IStaffRecord> = {
      Date: new Date(date),
      // *** ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
      ShiftDate1Hours: startHours,
      ShiftDate1Minutes: startMinutes,
      ShiftDate2Hours: endHours,
      ShiftDate2Minutes: endMinutes,
      // *** СОВМЕСТИМОСТЬ: Date поля установлены в undefined ***
      ShiftDate1: undefined,
      ShiftDate2: undefined,
      TimeForLunch: timeForLunch,
      Contract: contract,
      TypeOfLeaveID: typeOfLeaveID,
      LeaveTime: 0,
      WorkTime: '0:00',
      Deleted: 0,
      // *** ИСПРАВЛЕНО: Holiday всегда 0 - праздники определяются из holidays list ***
      Holiday: 0,
      Title: typeOfLeaveID ? `Leave on ${date.toLocaleDateString()}` : `SRS Shift on ${date.toLocaleDateString()}`
    };

    console.log(`[SRSDataMapper] New staff record data prepared WITHOUT Holiday field:`, {
      date: newRecordData.Date?.toLocaleDateString(),
      startTime: `${newRecordData.ShiftDate1Hours}:${newRecordData.ShiftDate1Minutes}`,
      endTime: `${newRecordData.ShiftDate2Hours}:${newRecordData.ShiftDate2Minutes}`,
      timeForLunch: newRecordData.TimeForLunch,
      contract: newRecordData.Contract,
      typeOfLeaveID: newRecordData.TypeOfLeaveID,
      Holiday: newRecordData.Holiday + ' (always 0 - determined from holidays list)',
      title: newRecordData.Title
    });

    return newRecordData;
  }

  /**
   * *** ИСПРАВЛЕНО: Валидация данных для создания записи без Holiday поля ***
   * Проверяет корректность данных перед созданием StaffRecord
   */
  public static validateStaffRecordData(recordData: Partial<IStaffRecord>): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка даты
    if (!recordData.Date || isNaN(recordData.Date.getTime())) {
      errors.push('Valid date is required');
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

    // *** ИСПРАВЛЕНО: Предупреждение о Holiday поле ***
    if (recordData.Holiday !== undefined && recordData.Holiday !== 0) {
      warnings.push('Holiday field should always be 0 - holidays are determined from holidays list');
    }

    console.log(`[SRSDataMapper] Validation result for staff record data:`, {
      isValid: errors.length === 0,
      errorsCount: errors.length,
      warningsCount: warnings.length,
      holidayFieldHandling: 'Should always be 0'
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}