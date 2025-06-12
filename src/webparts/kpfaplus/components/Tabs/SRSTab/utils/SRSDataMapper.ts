// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDataMapper.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ISRSRecord } from './SRSTabInterfaces';

/**
 * Утилита для преобразования IStaffRecord в ISRSRecord
 * ОБНОВЛЕНО: Исправлена обработка типов отпусков из StaffRecords
 */
export class SRSDataMapper {

  /**
   * Преобразует массив IStaffRecord в массив ISRSRecord
   */
  public static mapStaffRecordsToSRSRecords(staffRecords: IStaffRecord[]): ISRSRecord[] {
    console.log('[SRSDataMapper] Converting', staffRecords.length, 'IStaffRecord to ISRSRecord with improved TypeOfLeave mapping');
    
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
   * ИСПРАВЛЕНО: Улучшена логика извлечения TypeOfLeaveID
   */
  private static mapSingleStaffRecordToSRS(record: IStaffRecord): ISRSRecord {
    console.log(`[SRSDataMapper] *** MAPPING STAFF RECORD ${record.ID} TO SRS RECORD ***`);
    console.log(`[SRSDataMapper] Record data:`, {
      ID: record.ID,
      Date: record.Date?.toLocaleDateString(),
      TypeOfLeaveID: record.TypeOfLeaveID,
      TypeOfLeave: record.TypeOfLeave,
      LeaveTime: record.LeaveTime,
      WorkTime: record.WorkTime
    });

    // Извлекаем время начала и окончания работы
    const startWork = SRSDataMapper.extractTimeComponents(record.ShiftDate1);
    const finishWork = SRSDataMapper.extractTimeComponents(record.ShiftDate2);
    
    // Определяем день недели
    const dayOfWeek = SRSDataMapper.getDayOfWeek(record.Date);
    
    // *** ИСПРАВЛЕНО: Улучшенное извлечение типа отпуска ***
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    
    // Рассчитываем рабочие часы
    const hours = record.WorkTime || '0.00';
    
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
      typeOfLeave: typeOfLeaveValue, // *** ИСПРАВЛЕНО: используется улучшенное извлечение ***
      timeLeave: (record.LeaveTime || 0).toString(),
      shift: 1, // В IStaffRecord нет этого поля, ставим 1
      contract: (record.Contract || 1).toString(),
      contractCheck: true, // В IStaffRecord нет этого поля, ставим true
      status: status,
      srs: !!typeOfLeaveValue && typeOfLeaveValue !== '', // *** ИСПРАВЛЕНО: SRS если есть тип отпуска ***
      checked: false, // Начальное состояние - не выбрано
      deleted: record.Deleted === 1
    };

    console.log(`[SRSDataMapper] *** MAPPED SRS RECORD ***:`, {
      id: srsRecord.id,
      date: srsRecord.date.toLocaleDateString(),
      typeOfLeave: srsRecord.typeOfLeave,
      timeLeave: srsRecord.timeLeave,
      srs: srsRecord.srs,
      hours: srsRecord.hours
    });

    return srsRecord;
  }

  /**
   * *** НОВЫЙ МЕТОД: Улучшенное извлечение TypeOfLeaveID из StaffRecord ***
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
    // Иногда данные могут храниться в нестандартных местах
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
   * ОБНОВЛЕНО: Улучшена логика с учетом типов отпусков
   */
  private static determineStatus(record: IStaffRecord): 'positive' | 'negative' | 'none' {
    // Если запись удалена, то negative
    if (record.Deleted === 1) {
      return 'negative';
    }
    
    // *** ОБНОВЛЕНО: Положительный статус если есть тип отпуска ***
    const typeOfLeaveValue = SRSDataMapper.extractTypeOfLeaveID(record);
    if (typeOfLeaveValue && typeOfLeaveValue !== '') {
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
      typeOfLeave: '', // *** ПУСТОЙ ТИП ОТПУСКА ***
      timeLeave: '0.00',
      shift: 1,
      contract: '1',
      contractCheck: false,
      status: 'none',
      srs: false, // *** НЕТ SRS БЕЗ ТИПА ОТПУСКА ***
      checked: false,
      deleted: false
    };
  }

  /**
   * Преобразует ISRSRecord обратно в частичный IStaffRecord для сохранения
   * ОБНОВЛЕНО: Включает сохранение типа отпуска
   */
  public static mapSRSRecordToStaffRecordUpdate(srsRecord: ISRSRecord): Partial<IStaffRecord> {
    console.log(`[SRSDataMapper] *** MAPPING SRS RECORD TO STAFF RECORD UPDATE ***`);
    console.log(`[SRSDataMapper] SRS Record ID: ${srsRecord.id}`);
    console.log(`[SRSDataMapper] Type of leave: "${srsRecord.typeOfLeave}"`);
    
    // Создаем объект для обновления записи в API
    const updateData: Partial<IStaffRecord> = {
      ID: srsRecord.id,
      // Date обычно не изменяется
      TimeForLunch: parseInt(srsRecord.lunch) || 0,
      LeaveTime: parseFloat(srsRecord.timeLeave) || 0,
      Contract: parseInt(srsRecord.contract) || 1,
      Deleted: srsRecord.deleted ? 1 : 0
    };

    // *** ОБНОВЛЕНО: Сохранение типа отпуска ***
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

    console.log('[SRSDataMapper] *** MAPPED UPDATE DATA ***:', {
      originalId: srsRecord.id,
      updateFields: Object.keys(updateData),
      hasTypeOfLeave: !!updateData.TypeOfLeaveID,
      typeOfLeaveValue: updateData.TypeOfLeaveID
    });

    return updateData;
  }

  /**
   * *** НОВЫЙ МЕТОД: Валидация SRS записи ***
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
   * *** НОВЫЙ МЕТОД: Фильтрация записей для SRS ***
   * Возвращает только записи с типами отпусков
   */
  public static filterSRSRecords(staffRecords: IStaffRecord[]): IStaffRecord[] {
    console.log(`[SRSDataMapper] Filtering ${staffRecords.length} staff records for SRS`);
    
    const srsRecords = staffRecords.filter(record => SRSDataMapper.isValidSRSRecord(record));
    
    console.log(`[SRSDataMapper] Filtered to ${srsRecords.length} valid SRS records`);
    
    return srsRecords;
  }

  /**
   * *** НОВЫЙ МЕТОД: Получение статистики по типам отпусков ***
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
   * *** НОВЫЙ МЕТОД: Отладочная информация о записи ***
   * Выводит детальную информацию о том, как извлекается тип отпуска
   */
  public static debugRecordTypeOfLeave(record: IStaffRecord): void {
    console.log(`[SRSDataMapper] *** DEBUG INFO FOR RECORD ${record.ID} ***`);
    console.log(`[SRSDataMapper] TypeOfLeaveID (direct):`, record.TypeOfLeaveID);
    console.log(`[SRSDataMapper] TypeOfLeave (object):`, record.TypeOfLeave);
    console.log(`[SRSDataMapper] LeaveTime:`, record.LeaveTime);
    console.log(`[SRSDataMapper] Extracted type of leave:`, SRSDataMapper.extractTypeOfLeaveID(record));
    console.log(`[SRSDataMapper] Is valid SRS record:`, SRSDataMapper.isValidSRSRecord(record));
    console.log(`[SRSDataMapper] All record keys:`, Object.keys(record));
  }
}