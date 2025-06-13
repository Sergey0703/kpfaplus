// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDataMapper.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ISRSRecord } from './SRSTabInterfaces';

/**
 * Утилита для преобразования IStaffRecord в ISRSRecord
 * ОБНОВЛЕНО: Исправлена обработка типов отпусков и добавлено маппинг поля Holiday
 */
export class SRSDataMapper {

  /**
   * Преобразует массив IStaffRecord в массив ISRSRecord
   */
  public static mapStaffRecordsToSRSRecords(staffRecords: IStaffRecord[]): ISRSRecord[] {
    console.log('[SRSDataMapper] Converting', staffRecords.length, 'IStaffRecord to ISRSRecord with Holiday and TypeOfLeave mapping');
    
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
   * ОБНОВЛЕНО: Улучшена логика извлечения TypeOfLeaveID и добавлено маппинг Holiday
   */
  private static mapSingleStaffRecordToSRS(record: IStaffRecord): ISRSRecord {
    console.log(`[SRSDataMapper] *** MAPPING STAFF RECORD ${record.ID} TO SRS RECORD WITH HOLIDAY SUPPORT ***`);
    console.log(`[SRSDataMapper] Record data:`, {
      ID: record.ID,
      Date: record.Date?.toLocaleDateString(),
      TypeOfLeaveID: record.TypeOfLeaveID,
      TypeOfLeave: record.TypeOfLeave,
      LeaveTime: record.LeaveTime,
      WorkTime: record.WorkTime,
      // *** НОВОЕ: Логирование поля Holiday ***
      Holiday: record.Holiday
    });

    // Извлекаем время начала и окончания работы
    const startWork = SRSDataMapper.extractTimeComponents(record.ShiftDate1);
    const finishWork = SRSDataMapper.extractTimeComponents(record.ShiftDate2);
    
    // Определяем день недели
    const dayOfWeek = SRSDataMapper.getDayOfWeek(record.Date);
    
    // Извлечение типа отпуска
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    
    // Рассчитываем рабочие часы
    const hours = record.WorkTime || '0.00';
    
    // *** НОВОЕ: Извлечение поля Holiday ***
    const holidayValue = SRSDataMapper.extractHolidayValue(record);
    
    // Определяем статус (пока заглушка)
    const status = SRSDataMapper.determineStatus(record);
    
    const srsRecord: ISRSRecord = {
      id: record.ID,
      date: record.Date,
      dayOfWeek: dayOfWeek,
      hours: hours,
      relief: false, // В IStaffRecord нет этого поля, ставим false
      startWork: startWork,
      finishWork: finishWork,
      lunch: (record.TimeForLunch || 0).toString(),
      typeOfLeave: typeOfLeaveValue,
      timeLeave: (record.LeaveTime || 0).toString(),
      shift: 1, // В IStaffRecord нет этого поля, ставим 1
      contract: (record.Contract || 1).toString(),
      contractCheck: true, // В IStaffRecord нет этого поля, ставим true
      status: status,
      srs: !!typeOfLeaveValue && typeOfLeaveValue !== '', // SRS если есть тип отпуска
      checked: false, // Начальное состояние - не выбрано
      deleted: record.Deleted === 1,
      // *** НОВОЕ: Маппинг поля Holiday ***
      Holiday: holidayValue
    };

    console.log(`[SRSDataMapper] *** MAPPED SRS RECORD WITH HOLIDAY ***:`, {
      id: srsRecord.id,
      date: srsRecord.date.toLocaleDateString(),
      typeOfLeave: srsRecord.typeOfLeave,
      timeLeave: srsRecord.timeLeave,
      srs: srsRecord.srs,
      hours: srsRecord.hours,
      // *** НОВОЕ: Логирование замапленного Holiday ***
      Holiday: srsRecord.Holiday,
      isHoliday: srsRecord.Holiday === 1
    });

    return srsRecord;
  }

  /**
   * *** НОВЫЙ МЕТОД: Извлечение поля Holiday из StaffRecord ***
   * Обрабатывает различные форматы поля Holiday в данных из SharePoint
   */
  private static extractHolidayValue(record: IStaffRecord): number {
    console.log(`[SRSDataMapper] *** EXTRACTING HOLIDAY VALUE ***`);
    console.log(`[SRSDataMapper] Record ID: ${record.ID}`);
    
    let holidayValue = 0; // По умолчанию - не праздник
    
    // *** ВАРИАНТ 1: Прямое числовое поле Holiday ***
    if (typeof record.Holiday === 'number') {
      holidayValue = record.Holiday;
      console.log(`[SRSDataMapper] Found Holiday (number): ${holidayValue}`);
      return holidayValue;
    }
    
    // *** ВАРИАНТ 2: Строковое поле Holiday ***
    if (typeof record.Holiday === 'string') {
      const parsed = parseInt(record.Holiday, 10);
      if (!isNaN(parsed)) {
        holidayValue = parsed;
        console.log(`[SRSDataMapper] Found Holiday (string): "${record.Holiday}" -> ${holidayValue}`);
        return holidayValue;
      }
      console.log(`[SRSDataMapper] Holiday string "${record.Holiday}" is not a valid number`);
    }
    
    // *** ВАРИАНТ 3: Булевское поле Holiday ***
    if (typeof record.Holiday === 'boolean') {
      holidayValue = record.Holiday ? 1 : 0;
      console.log(`[SRSDataMapper] Found Holiday (boolean): ${record.Holiday} -> ${holidayValue}`);
      return holidayValue;
    }
    
    // *** ВАРИАНТ 4: Проверяем другие возможные поля ***
    const recordAny = record as any;
    
    // Проверяем поле holiday (lowercase)
    if ('holiday' in recordAny && recordAny.holiday !== undefined) {
      if (typeof recordAny.holiday === 'number') {
        holidayValue = recordAny.holiday;
        console.log(`[SRSDataMapper] Found holiday (lowercase, number): ${holidayValue}`);
        return holidayValue;
      }
      if (typeof recordAny.holiday === 'string') {
        const parsed = parseInt(recordAny.holiday, 10);
        if (!isNaN(parsed)) {
          holidayValue = parsed;
          console.log(`[SRSDataMapper] Found holiday (lowercase, string): "${recordAny.holiday}" -> ${holidayValue}`);
          return holidayValue;
        }
      }
      if (typeof recordAny.holiday === 'boolean') {
        holidayValue = recordAny.holiday ? 1 : 0;
        console.log(`[SRSDataMapper] Found holiday (lowercase, boolean): ${recordAny.holiday} -> ${holidayValue}`);
        return holidayValue;
      }
    }
    
    // *** ВАРИАНТ 5: Проверяем поле IsHoliday ***
    if ('IsHoliday' in recordAny && recordAny.IsHoliday !== undefined) {
      if (typeof recordAny.IsHoliday === 'boolean') {
        holidayValue = recordAny.IsHoliday ? 1 : 0;
        console.log(`[SRSDataMapper] Found IsHoliday (boolean): ${recordAny.IsHoliday} -> ${holidayValue}`);
        return holidayValue;
      }
      if (typeof recordAny.IsHoliday === 'number') {
        holidayValue = recordAny.IsHoliday;
        console.log(`[SRSDataMapper] Found IsHoliday (number): ${holidayValue}`);
        return holidayValue;
      }
    }
    
    console.log(`[SRSDataMapper] *** NO HOLIDAY VALUE FOUND ***`);
    console.log(`[SRSDataMapper] Available fields in record:`, Object.keys(record));
    console.log(`[SRSDataMapper] Holiday field type:`, typeof record.Holiday);
    console.log(`[SRSDataMapper] Holiday field value:`, record.Holiday);
    
    return 0; // По умолчанию не праздник
  }

  /**
   * Улучшенный метод извлечения TypeOfLeaveID из StaffRecord
   * Проверяет все возможные источники типа отпуска
   */
  private static extractTypeOfLeaveID(record: IStaffRecord): string {
    console.log(`[SRSDataMapper] *** EXTRACTING TYPE OF LEAVE ID ***`);
    console.log(`[SRSDataMapper] Record ID: ${record.ID}`);
    
    let typeOfLeaveValue = '';
    
    // *** ВАРИАНТ 1: Прямое поле TypeOfLeaveID (строка) ***
    if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0') {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      console.log(`[SRSDataMapper] Found TypeOfLeaveID (direct string): "${typeOfLeaveValue}"`);
      return typeOfLeaveValue;
    }
    
    // *** ВАРИАНТ 2: Объект TypeOfLeave с полем Id ***
    if (record.TypeOfLeave && typeof record.TypeOfLeave === 'object') {
      // Проверяем разные возможные поля в объекте
      const typeOfLeaveObj = record.TypeOfLeave as any;
      
      // Поле Id (наиболее вероятное)
      if (typeOfLeaveObj.Id && typeOfLeaveObj.Id !== '' && typeOfLeaveObj.Id !== '0') {
        typeOfLeaveValue = String(typeOfLeaveObj.Id);
        console.log(`[SRSDataMapper] Found TypeOfLeave.Id: "${typeOfLeaveValue}"`);
        return typeOfLeaveValue;
      }
      
      // Поле ID (альтернативное)
      if (typeOfLeaveObj.ID && typeOfLeaveObj.ID !== '' && typeOfLeaveObj.ID !== '0') {
        typeOfLeaveValue = String(typeOfLeaveObj.ID);
        console.log(`[SRSDataMapper] Found TypeOfLeave.ID: "${typeOfLeaveValue}"`);
        return typeOfLeaveValue;
      }
      
      // Поле id (еще одна альтернатива)
      if (typeOfLeaveObj.id && typeOfLeaveObj.id !== '' && typeOfLeaveObj.id !== '0') {
        typeOfLeaveValue = String(typeOfLeaveObj.id);
        console.log(`[SRSDataMapper] Found TypeOfLeave.id: "${typeOfLeaveValue}"`);
        return typeOfLeaveValue;
      }
      
      console.log(`[SRSDataMapper] TypeOfLeave object found but no valid Id field:`, typeOfLeaveObj);
    }
    
    // *** ВАРИАНТ 3: TypeOfLeaveID как число ***
    if (typeof record.TypeOfLeaveID === 'number' && record.TypeOfLeaveID > 0) {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      console.log(`[SRSDataMapper] Found TypeOfLeaveID (number): ${typeOfLeaveValue}`);
      return typeOfLeaveValue;
    }
    
    // *** ВАРИАНТ 4: Попытка извлечь из других полей ***
    const recordAny = record as any;
    
    // Проверяем поле typeOfLeaveId (camelCase)
    if (recordAny.typeOfLeaveId && recordAny.typeOfLeaveId !== '' && recordAny.typeOfLeaveId !== '0') {
      typeOfLeaveValue = String(recordAny.typeOfLeaveId);
      console.log(`[SRSDataMapper] Found typeOfLeaveId (camelCase): "${typeOfLeaveValue}"`);
      return typeOfLeaveValue;
    }
    
    // Проверяем поле LeaveTypeID (альтернативное имя)
    if (recordAny.LeaveTypeID && recordAny.LeaveTypeID !== '' && recordAny.LeaveTypeID !== '0') {
      typeOfLeaveValue = String(recordAny.LeaveTypeID);
      console.log(`[SRSDataMapper] Found LeaveTypeID: "${typeOfLeaveValue}"`);
      return typeOfLeaveValue;
    }
    
    console.log(`[SRSDataMapper] *** NO TYPE OF LEAVE FOUND ***`);
    console.log(`[SRSDataMapper] Available fields in record:`, Object.keys(record));
    
    return ''; // Возвращаем пустую строку если ничего не найдено
  }

  /**
   * Извлекает компоненты времени из даты
   */
  private static extractTimeComponents(date: Date | undefined): { hours: string; minutes: string } {
    if (!date) {
      return { hours: '00', minutes: '00' };
    }

    try {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return { hours, minutes };
    } catch (error) {
      console.warn('[SRSDataMapper] Error extracting time components:', error);
      return { hours: '00', minutes: '00' };
    }
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
   * ОБНОВЛЕНО: Улучшена логика с учетом типов отпусков и праздников
   */
  private static determineStatus(record: IStaffRecord): 'positive' | 'negative' | 'none' {
    // Если запись удалена, то negative
    if (record.Deleted === 1) {
      return 'negative';
    }
    
    // *** ОБНОВЛЕНО: Положительный статус если есть тип отпуска ***
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    if (typeOfLeaveValue && typeOfLeaveValue !== '') {
      console.log(`[SRSDataMapper] Positive status due to type of leave: ${typeOfLeaveValue}`);
      return 'positive';
    }
    
    // *** НОВОЕ: Положительный статус для праздников ***
    const holidayValue = SRSDataMapper.extractHolidayValue(record);
    if (holidayValue === 1) {
      console.log(`[SRSDataMapper] Positive status due to holiday`);
      return 'positive';
    }
    
    // Если есть время отпуска без типа отпуска
    if (record.LeaveTime && record.LeaveTime > 0) {
      return 'positive';
    }
    
    return 'none';
  }

  /**
   * Создает пустую SRS запись в случае ошибки
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
      // *** НОВОЕ: Пустое значение Holiday ***
      Holiday: 0
    };
  }

  /**
   * Преобразует ISRSRecord обратно в частичный IStaffRecord для сохранения
   * ОБНОВЛЕНО: Включает сохранение типа отпуска и праздника
   */
  public static mapSRSRecordToStaffRecordUpdate(srsRecord: ISRSRecord): Partial<IStaffRecord> {
    console.log(`[SRSDataMapper] *** MAPPING SRS RECORD TO STAFF RECORD UPDATE ***`);
    console.log(`[SRSDataMapper] SRS Record ID: ${srsRecord.id}`);
    console.log(`[SRSDataMapper] Type of leave: "${srsRecord.typeOfLeave}"`);
    console.log(`[SRSDataMapper] Holiday: ${srsRecord.Holiday}`);
    
    // Создаем объект для обновления записи в API
    const updateData: Partial<IStaffRecord> = {
      ID: srsRecord.id,
      // Date обычно не изменяется
      TimeForLunch: parseInt(srsRecord.lunch) || 0,
      LeaveTime: parseFloat(srsRecord.timeLeave) || 0,
      Contract: parseInt(srsRecord.contract) || 1,
      Deleted: srsRecord.deleted ? 1 : 0,
      // *** НОВОЕ: Сохранение поля Holiday ***
      Holiday: srsRecord.Holiday || 0
    };

    // Сохранение типа отпуска
    if (srsRecord.typeOfLeave && srsRecord.typeOfLeave !== '') {
      updateData.TypeOfLeaveID = srsRecord.typeOfLeave;
      console.log(`[SRSDataMapper] Including TypeOfLeaveID in update: "${srsRecord.typeOfLeave}"`);
    } else {
      // Если тип отпуска пустой, явно очищаем поле
      updateData.TypeOfLeaveID = '';
      console.log(`[SRSDataMapper] Clearing TypeOfLeaveID (empty type of leave)`);
    }

    // Преобразуем время начала и окончания обратно в Date
    if (srsRecord.startWork.hours !== '00' || srsRecord.startWork.minutes !== '00') {
      const startDate = new Date(srsRecord.date);
      startDate.setHours(parseInt(srsRecord.startWork.hours), parseInt(srsRecord.startWork.minutes), 0, 0);
      updateData.ShiftDate1 = startDate;
    }

    if (srsRecord.finishWork.hours !== '00' || srsRecord.finishWork.minutes !== '00') {
      const finishDate = new Date(srsRecord.date);
      finishDate.setHours(parseInt(srsRecord.finishWork.hours), parseInt(srsRecord.finishWork.minutes), 0, 0);
      updateData.ShiftDate2 = finishDate;
    }

    console.log('[SRSDataMapper] *** MAPPED UPDATE DATA WITH HOLIDAY ***:', {
      originalId: srsRecord.id,
      updateFields: Object.keys(updateData),
      hasTypeOfLeave: !!updateData.TypeOfLeaveID,
      typeOfLeaveValue: updateData.TypeOfLeaveID,
      // *** НОВОЕ: Логирование Holiday в обновлении ***
      holidayValue: updateData.Holiday,
      isHoliday: updateData.Holiday === 1
    });

    return updateData;
  }

  /**
   * Валидация SRS записи
   * Проверяет, является ли запись валидной для SRS (должна иметь тип отпуска)
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
   * Возвращает только записи с типами отпусков
   */
  public static filterSRSRecords(staffRecords: IStaffRecord[]): IStaffRecord[] {
    console.log(`[SRSDataMapper] Filtering ${staffRecords.length} staff records for SRS`);
    
    const srsRecords = staffRecords.filter(record => SRSDataMapper.isValidSRSRecord(record));
    
    console.log(`[SRSDataMapper] Filtered to ${srsRecords.length} valid SRS records`);
    
    return srsRecords;
  }

  /**
   * Получение статистики по типам отпусков
   * Анализирует распределение типов отпусков в записях
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
   * *** НОВЫЙ МЕТОД: Получение статистики по праздникам ***
   * Анализирует распределение праздничных записей
   */
  public static getHolidayStatistics(staffRecords: IStaffRecord[]): {
    totalRecords: number;
    holidayRecords: number;
    regularRecords: number;
    holidayPercentage: number;
  } {
    console.log(`[SRSDataMapper] Analyzing holiday statistics for ${staffRecords.length} records`);
    
    const holidayRecords = staffRecords.filter(record => SRSDataMapper.extractHolidayValue(record) === 1);
    const regularRecords = staffRecords.filter(record => SRSDataMapper.extractHolidayValue(record) === 0);
    
    const stats = {
      totalRecords: staffRecords.length,
      holidayRecords: holidayRecords.length,
      regularRecords: regularRecords.length,
      holidayPercentage: staffRecords.length > 0 ? Math.round((holidayRecords.length / staffRecords.length) * 100) : 0
    };
    
    console.log(`[SRSDataMapper] Holiday statistics:`, stats);
    
    return stats;
  }

  /**
   * Отладочная информация о записи
   * Выводит детальную информацию о том, как извлекается тип отпуска и праздник
   */
  public static debugRecordMapping(record: IStaffRecord): void {
    console.log(`[SRSDataMapper] *** DEBUG INFO FOR RECORD ${record.ID} ***`);
    console.log(`[SRSDataMapper] TypeOfLeaveID (direct):`, record.TypeOfLeaveID);
    console.log(`[SRSDataMapper] TypeOfLeave (object):`, record.TypeOfLeave);
    console.log(`[SRSDataMapper] LeaveTime:`, record.LeaveTime);
    console.log(`[SRSDataMapper] Extracted type of leave:`, SRSDataMapper.extractTypeOfLeaveID(record));
    console.log(`[SRSDataMapper] Is valid SRS record:`, SRSDataMapper.isValidSRSRecord(record));
    // *** НОВОЕ: Отладка Holiday ***
    console.log(`[SRSDataMapper] Holiday (direct):`, record.Holiday);
    console.log(`[SRSDataMapper] Extracted holiday value:`, SRSDataMapper.extractHolidayValue(record));
    console.log(`[SRSDataMapper] All record keys:`, Object.keys(record));
  }
}