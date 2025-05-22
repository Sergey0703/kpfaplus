// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabDataUtils.ts
import { IStaffRecord } from "../../../../services/StaffRecordsService";
import { IScheduleItem } from "../components/ScheduleTable";
import { IContract } from "../../../../models/IContract";

/**
 * Вспомогательная функция для создания Date из часов и минут
 */
export const createTimeFromScheduleItem = (baseDate: Date, hourStr: string, minuteStr: string): Date => {
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minuteStr, 10) || 0;
  
  // Create a new Date object to avoid modifying the original
  const result = new Date(baseDate.getTime());
  result.setHours(hour, minute, 0, 0);
  return result;
};

/**
 * Преобразует данные записей расписания в формат для отображения в таблице
 */
export const convertStaffRecordsToScheduleItems = (
  records: IStaffRecord[] | undefined, 
  selectedContract?: IContract
): IScheduleItem[] => {
  if (!records || records.length === 0) {
    return [];
  }

  return records.map(record => {
    // Форматирование дня недели
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][record.Date.getDay()];
    
    // Получение часов и минут из дат
    const startHour = record.ShiftDate1 ? record.ShiftDate1.getHours().toString().padStart(2, '0') : '00';
    const startMinute = record.ShiftDate1 ? record.ShiftDate1.getMinutes().toString().padStart(2, '0') : '00';
    const finishHour = record.ShiftDate2 ? record.ShiftDate2.getHours().toString().padStart(2, '0') : '00';
    const finishMinute = record.ShiftDate2 ? record.ShiftDate2.getMinutes().toString().padStart(2, '0') : '00';
    
    // Извлекаем значение TypeOfLeaveID, проверяя оба возможных формата данных
    let typeOfLeaveValue = '';
    
    // Проверяем, есть ли объект TypeOfLeave с Id внутри
    if (record.TypeOfLeave && record.TypeOfLeave.Id) {
      typeOfLeaveValue = String(record.TypeOfLeave.Id);
      console.log(`[DEBUG] Record ${record.ID}: Using TypeOfLeave.Id: ${typeOfLeaveValue}`);
    } 
    // Если нет объекта TypeOfLeave, проверяем прямое поле TypeOfLeaveID
    else if (record.TypeOfLeaveID) {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      console.log(`[DEBUG] Record ${record.ID}: Using TypeOfLeaveID directly: ${typeOfLeaveValue}`);
    } else {
      console.log(`[DEBUG] Record ${record.ID}: No TypeOfLeave found, using empty string`);
    }
    
    // Формирование объекта IScheduleItem
    const scheduleItem = {
      id: record.ID,
      date: record.Date,
      dayOfWeek,
      workingHours: record.WorkTime || '0.00',
      startHour,
      startMinute,
      finishHour,
      finishMinute,
      lunchTime: record.TimeForLunch.toString(),
      typeOfLeave: typeOfLeaveValue, 
      shift: 1, // По умолчанию 1
      contract: record.WeeklyTimeTableTitle || selectedContract?.template || '',
      contractId: record.WeeklyTimeTableID || selectedContract?.id || '',
      contractNumber: record.Contract.toString(),
      deleted: record.Deleted === 1, // Добавляем флаг deleted
      Holiday: record.Holiday // Добавляем поле Holiday для определения праздничных дней
    };
    
    return scheduleItem;
  });
};

/**
 * Форматирует объект IStaffRecord для обновления из IScheduleItem
 */
export const formatItemForUpdate = (recordId: string, scheduleItem: IScheduleItem): Partial<IStaffRecord> => {
  return {
    // Dates need to be proper Date objects
    ShiftDate1: createTimeFromScheduleItem(scheduleItem.date, scheduleItem.startHour, scheduleItem.startMinute),
    ShiftDate2: createTimeFromScheduleItem(scheduleItem.date, scheduleItem.finishHour, scheduleItem.finishMinute),
    // Numeric values
    TimeForLunch: parseInt(scheduleItem.lunchTime, 10) || 0,
    Contract: parseInt(scheduleItem.contractNumber || '1', 10),
    // TypeOfLeave could be a string ID or empty
    TypeOfLeaveID: scheduleItem.typeOfLeave || '',
    // Work time as calculated
    WorkTime: scheduleItem.workingHours,
    // Holiday status
    Holiday: scheduleItem.Holiday // Сохраняем статус праздника при обновлении
  };
};