// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDataMapper.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { ISRSRecord } from './SRSTabInterfaces';

/**
 * Утилита для преобразования IStaffRecord в ISRSRecord
 * Преобразует данные из API в формат, ожидаемый SRS компонентами
 */
export class SRSDataMapper {

  /**
   * Преобразует массив IStaffRecord в массив ISRSRecord
   */
  public static mapStaffRecordsToSRSRecords(staffRecords: IStaffRecord[]): ISRSRecord[] {
    console.log('[SRSDataMapper] Converting', staffRecords.length, 'IStaffRecord to ISRSRecord');
    
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
   */
  private static mapSingleStaffRecordToSRS(record: IStaffRecord): ISRSRecord {
    // Извлекаем время начала и окончания работы
    const startWork = SRSDataMapper.extractTimeComponents(record.ShiftDate1);
    const finishWork = SRSDataMapper.extractTimeComponents(record.ShiftDate2);
    
    // Определяем день недели
    const dayOfWeek = SRSDataMapper.getDayOfWeek(record.Date);
    
    // Получаем тип отпуска
    const typeOfLeave = record.TypeOfLeave?.Title || '';
    
    // Рассчитываем рабочие часы
    const hours = record.WorkTime || '0.00';
    
    // Определяем статус (пока заглушка)
    const status = SRSDataMapper.determineStatus(record);
    
    return {
      id: record.ID,
      date: record.Date,
      dayOfWeek: dayOfWeek,
      hours: hours,
      relief: false, // В IStaffRecord нет этого поля, ставим false
      startWork: startWork,
      finishWork: finishWork,
      lunch: (record.TimeForLunch || 0).toString(),
      typeOfLeave: typeOfLeave,
      timeLeave: (record.LeaveTime || 0).toString(),
      shift: 1, // В IStaffRecord нет этого поля, ставим 1
      contract: (record.Contract || 1).toString(),
      contractCheck: true, // В IStaffRecord нет этого поля, ставим true
      status: status,
      srs: !!record.TypeOfLeaveID, // Если есть тип отпуска, то это SRS запись
      checked: false, // Начальное состояние - не выбрано
      deleted: record.Deleted === 1
    };
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
   * Определяет статус записи (заглушка)
   */
  private static determineStatus(record: IStaffRecord): 'positive' | 'negative' | 'none' {
    // Пока простая логика - если есть тип отпуска и время отпуска, то positive
    if (record.TypeOfLeaveID && record.LeaveTime && record.LeaveTime > 0) {
      return 'positive';
    }
    
    // Если запись удалена, то negative
    if (record.Deleted === 1) {
      return 'negative';
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
      deleted: false
    };
  }

  /**
   * Преобразует ISRSRecord обратно в частичный IStaffRecord для сохранения
   */
  public static mapSRSRecordToStaffRecordUpdate(srsRecord: ISRSRecord): Partial<IStaffRecord> {
    // Создаем объект для обновления записи в API
    const updateData: Partial<IStaffRecord> = {
      ID: srsRecord.id,
      // Date обычно не изменяется
      TimeForLunch: parseInt(srsRecord.lunch) || 0,
      LeaveTime: parseFloat(srsRecord.timeLeave) || 0,
      Contract: parseInt(srsRecord.contract) || 1,
      Deleted: srsRecord.deleted ? 1 : 0
    };

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

    console.log('[SRSDataMapper] Mapped SRS record to update data:', {
      originalId: srsRecord.id,
      updateFields: Object.keys(updateData)
    });

    return updateData;
  }
}