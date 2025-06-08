// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabDataUtils.ts
import { IStaffRecord } from "../../../../services/StaffRecordsService";
import { IScheduleItem } from "../components/ScheduleTable";
import { IContract } from "../../../../models/IContract";
import { DateUtils } from '../../../CustomDatePicker/CustomDatePicker';

/**
 * Вспомогательная функция для создания Date из часов и минут
 * ИСПРАВЛЕНО: Использует DateUtils для правильной нормализации базовой даты
 */
export const createTimeFromScheduleItem = (baseDate: Date, hourStr: string, minuteStr: string): Date => {
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minuteStr, 10) || 0;
  
  console.log(`[ScheduleTabDataUtils] createTimeFromScheduleItem: base=${baseDate.toISOString()}, time=${hour}:${minute}`);
  
  // ИСПРАВЛЕНО: Используем DateUtils для создания времени смены с нормализованной базовой датой
  const result = DateUtils.createShiftDateTime(baseDate, hour, minute);
  
  console.log(`[ScheduleTabDataUtils] createTimeFromScheduleItem result: ${result.toISOString()}`);
  return result;
};

/**
 * Преобразует данные записей расписания в формат для отображения в таблице
 * ИСПРАВЛЕНО: Используется правильное извлечение UTC времени из дат для отображения
 */
export const convertStaffRecordsToScheduleItems = (
  records: IStaffRecord[] | undefined, 
  selectedContract?: IContract
): IScheduleItem[] => {
  if (!records || records.length === 0) {
    return [];
  }

  console.log(`[ScheduleTabDataUtils] Converting ${records.length} staff records to schedule items`);
  console.log(`[ScheduleTabDataUtils] Using ONLY data from StaffRecords - no mixing with leaves/holidays data`);
  console.log(`[ScheduleTabDataUtils] IMPORTANT: Using DateUtils for date normalization to fix October 1st issue`);
  console.log(`[ScheduleTabDataUtils] *** CRITICAL: Using getUTCHours/getUTCMinutes for correct time display ***`);

  return records.map((record, index) => {
    // ИСПРАВЛЕНО: Нормализуем основную дату записи к UTC полуночи для консистентности
    const normalizedDate = DateUtils.normalizeStaffRecordDate(record.Date);
    
    console.log(`[ScheduleTabDataUtils] Record ${index}: Original date=${record.Date.toISOString()}, Normalized date=${normalizedDate.toISOString()}`);
    
    // Специальная отладка для октября 2024
    if (record.Date.getUTCMonth() === 9 && record.Date.getUTCFullYear() === 2024 && record.Date.getUTCDate() === 1) {
      console.log(`[ScheduleTabDataUtils] *** PROCESSING OCTOBER 1st RECORD ***`);
      console.log(`[ScheduleTabDataUtils] Record ID: ${record.ID}`);
      console.log(`[ScheduleTabDataUtils] Original Date: ${record.Date.toISOString()}`);
      console.log(`[ScheduleTabDataUtils] Normalized Date: ${normalizedDate.toISOString()}`);
      console.log(`[ScheduleTabDataUtils] Record details:`, {
        ID: record.ID,
        Title: record.Title,
        Deleted: record.Deleted,
        ShiftDate1: record.ShiftDate1?.toISOString(),
        ShiftDate2: record.ShiftDate2?.toISOString()
      });
    }
    
    // Форматирование дня недели
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][normalizedDate.getDay()];
    
    // ИСПРАВЛЕНО: Получение часов и минут из дат с использованием UTC методов
    console.log(`[ScheduleTabDataUtils] *** EXTRACTING TIME USING UTC METHODS ***`);
    if (record.ShiftDate1) {
      console.log(`[ScheduleTabDataUtils] ShiftDate1 stored: ${record.ShiftDate1.toISOString()}`);
      console.log(`[ScheduleTabDataUtils] Local time would be: ${record.ShiftDate1.getHours()}:${record.ShiftDate1.getMinutes()}`);
      console.log(`[ScheduleTabDataUtils] UTC time (correct): ${record.ShiftDate1.getUTCHours()}:${record.ShiftDate1.getUTCMinutes()}`);
    }
    if (record.ShiftDate2) {
      console.log(`[ScheduleTabDataUtils] ShiftDate2 stored: ${record.ShiftDate2.toISOString()}`);
      console.log(`[ScheduleTabDataUtils] Local time would be: ${record.ShiftDate2.getHours()}:${record.ShiftDate2.getMinutes()}`);
      console.log(`[ScheduleTabDataUtils] UTC time (correct): ${record.ShiftDate2.getUTCHours()}:${record.ShiftDate2.getUTCMinutes()}`);
    }
    
    // ИСПРАВЛЕНО: Используем getUTCHours() и getUTCMinutes() вместо getHours() и getMinutes()
    const startHour = record.ShiftDate1 ? record.ShiftDate1.getUTCHours().toString().padStart(2, '0') : '00';
    const startMinute = record.ShiftDate1 ? record.ShiftDate1.getUTCMinutes().toString().padStart(2, '0') : '00';
    const finishHour = record.ShiftDate2 ? record.ShiftDate2.getUTCHours().toString().padStart(2, '0') : '00';
    const finishMinute = record.ShiftDate2 ? record.ShiftDate2.getUTCMinutes().toString().padStart(2, '0') : '00';
    
    console.log(`[ScheduleTabDataUtils] *** EXTRACTED UTC TIME FOR DISPLAY ***`);
    console.log(`[ScheduleTabDataUtils] Start time: ${startHour}:${startMinute} (from UTC)`);
    console.log(`[ScheduleTabDataUtils] Finish time: ${finishHour}:${finishMinute} (from UTC)`);
    
    // ИСПРАВЛЕНО: Извлекаем значение TypeOfLeaveID ТОЛЬКО из записи расписания
    let typeOfLeaveValue = '';
    
    // Проверяем оба возможных формата данных из StaffRecords
    if (record.TypeOfLeave && record.TypeOfLeave.Id) {
      typeOfLeaveValue = String(record.TypeOfLeave.Id);
      console.log(`[ScheduleTabDataUtils] Record ${record.ID}: Using TypeOfLeave.Id from StaffRecord: ${typeOfLeaveValue}`);
    } 
    // Если нет объекта TypeOfLeave, проверяем прямое поле TypeOfLeaveID
    else if (record.TypeOfLeaveID) {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      console.log(`[ScheduleTabDataUtils] Record ${record.ID}: Using TypeOfLeaveID from StaffRecord: ${typeOfLeaveValue}`);
    } else {
      console.log(`[ScheduleTabDataUtils] Record ${record.ID}: No TypeOfLeave found in StaffRecord, using empty string`);
    }
    
    // Формирование объекта IScheduleItem с нормализованной датой
    const scheduleItem: IScheduleItem = {
      id: record.ID,
      date: normalizedDate, // ИСПРАВЛЕНО: используем нормализованную дату
      dayOfWeek,
      workingHours: record.WorkTime || '0.00',
      startHour,
      startMinute,
      finishHour,
      finishMinute,
      lunchTime: record.TimeForLunch.toString(),
      typeOfLeave: typeOfLeaveValue, // ИСПРАВЛЕНО: используется ТОЛЬКО значение из StaffRecords
      shift: 1, // По умолчанию 1
      contract: record.WeeklyTimeTableTitle || selectedContract?.template || '',
      contractId: record.WeeklyTimeTableID || selectedContract?.id || '',
      contractNumber: record.Contract.toString(),
      deleted: record.Deleted === 1, // Добавляем флаг deleted
      Holiday: record.Holiday // ИСПРАВЛЕНО: используется ТОЛЬКО значение из StaffRecords
    };
    
    // Дополнительное логирование для октября 2024
    if (normalizedDate.getUTCMonth() === 9 && normalizedDate.getUTCFullYear() === 2024 && normalizedDate.getUTCDate() === 1) {
      console.log(`[ScheduleTabDataUtils] *** CREATED OCTOBER 1st SCHEDULE ITEM ***`);
      console.log(`[ScheduleTabDataUtils] Schedule Item:`, {
        id: scheduleItem.id,
        date: scheduleItem.date.toISOString(),
        dayOfWeek: scheduleItem.dayOfWeek,
        startTime: `${scheduleItem.startHour}:${scheduleItem.startMinute}`,
        finishTime: `${scheduleItem.finishHour}:${scheduleItem.finishMinute}`,
        deleted: scheduleItem.deleted,
        Holiday: scheduleItem.Holiday
      });
    }
    
    // Логирование для каждого элемента (только для первых нескольких для экономии места)
    if (index < 3) {
      console.log(`[ScheduleTabDataUtils] *** FINAL SCHEDULE ITEM ${index + 1} ***`);
      console.log(`[ScheduleTabDataUtils] ID: ${scheduleItem.id}`);
      console.log(`[ScheduleTabDataUtils] Date: ${scheduleItem.date.toISOString()}`);
      console.log(`[ScheduleTabDataUtils] Time: ${scheduleItem.startHour}:${scheduleItem.startMinute} - ${scheduleItem.finishHour}:${scheduleItem.finishMinute}`);
      console.log(`[ScheduleTabDataUtils] Working hours: ${scheduleItem.workingHours}`);
      console.log(`[ScheduleTabDataUtils] Type of leave: ${scheduleItem.typeOfLeave || 'none'}`);
      console.log(`[ScheduleTabDataUtils] Deleted: ${scheduleItem.deleted}`);
      console.log(`[ScheduleTabDataUtils] Holiday: ${scheduleItem.Holiday}`);
    }
    
    return scheduleItem;
  });
};

/**
 * Форматирует объект IStaffRecord для обновления из IScheduleItem
 * ИСПРАВЛЕНО: Использует нормализованные даты для обновления
 */
export const formatItemForUpdate = (recordId: string, scheduleItem: IScheduleItem): Partial<IStaffRecord> => {
  console.log(`[ScheduleTabDataUtils] formatItemForUpdate for record ID: ${recordId}`);
  console.log(`[ScheduleTabDataUtils] Input schedule item date: ${scheduleItem.date.toISOString()}`);
  
  // ИСПРАВЛЕНО: Нормализуем основную дату к UTC полуночи перед обновлением
  const normalizedDate = DateUtils.normalizeStaffRecordDate(scheduleItem.date);
  
  console.log(`[ScheduleTabDataUtils] Normalized date for update: ${normalizedDate.toISOString()}`);
  
  // Специальная отладка для октября 2024
  if (scheduleItem.date.getUTCMonth() === 9 && scheduleItem.date.getUTCFullYear() === 2024 && scheduleItem.date.getUTCDate() === 1) {
    console.log(`[ScheduleTabDataUtils] *** FORMATTING OCTOBER 1st ITEM FOR UPDATE ***`);
    console.log(`[ScheduleTabDataUtils] Record ID: ${recordId}`);
    console.log(`[ScheduleTabDataUtils] Original item date: ${scheduleItem.date.toISOString()}`);
    console.log(`[ScheduleTabDataUtils] Normalized date: ${normalizedDate.toISOString()}`);
  }
  
  // Создаем даты для времени смен с использованием нормализованной базовой даты
  const shiftDate1 = createTimeFromScheduleItem(scheduleItem.date, scheduleItem.startHour, scheduleItem.startMinute);
  const shiftDate2 = createTimeFromScheduleItem(scheduleItem.date, scheduleItem.finishHour, scheduleItem.finishMinute);
  
  console.log(`[ScheduleTabDataUtils] Created shift times:
    ShiftDate1: ${shiftDate1.toISOString()} (${scheduleItem.startHour}:${scheduleItem.startMinute})
    ShiftDate2: ${shiftDate2.toISOString()} (${scheduleItem.finishHour}:${scheduleItem.finishMinute})`);
  
  const updateData: Partial<IStaffRecord> = {
    // ВАЖНО: Используем нормализованную дату для основного поля Date
    Date: normalizedDate, // Это будет преобразовано в ISO string в StaffRecordsService
    
    // Dates need to be proper Date objects - используем обновленную функцию
    ShiftDate1: shiftDate1,
    ShiftDate2: shiftDate2,
    
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
  
  console.log(`[ScheduleTabDataUtils] formatItemForUpdate result:`, {
    Date: updateData.Date?.toISOString(),
    ShiftDate1: updateData.ShiftDate1?.toISOString(),
    ShiftDate2: updateData.ShiftDate2?.toISOString(),
    TimeForLunch: updateData.TimeForLunch,
    Contract: updateData.Contract,
    TypeOfLeaveID: updateData.TypeOfLeaveID,
    WorkTime: updateData.WorkTime,
    Holiday: updateData.Holiday
  });
  
  return updateData;
};

/**
 * НОВАЯ ФУНКЦИЯ: Создает нормализованную дату для новой записи расписания
 * Используется при создании записей из шаблона или вручную
 */
export const createNormalizedScheduleDate = (inputDate: Date): Date => {
  const normalizedDate = DateUtils.normalizeStaffRecordDate(inputDate);
  
  console.log(`[ScheduleTabDataUtils] createNormalizedScheduleDate:
    Input: ${inputDate.toISOString()}
    Output: ${normalizedDate.toISOString()}`);
  
  return normalizedDate;
};

/**
 * НОВАЯ ФУНКЦИЯ: Проверяет, является ли дата первым днем октября 2024
 * Вспомогательная функция для отладки
 */
export const isOctober1st2024 = (date: Date): boolean => {
  const isOct1st = date.getUTCFullYear() === 2024 && 
                   date.getUTCMonth() === 9 && 
                   date.getUTCDate() === 1;
                   
  if (isOct1st) {
    console.log(`[ScheduleTabDataUtils] *** DETECTED OCTOBER 1st 2024 DATE: ${date.toISOString()} ***`);
  }
  
  return isOct1st;
};

/**
 * НОВАЯ ФУНКЦИЯ: Логирует детальную информацию о преобразовании записи
 * Полезно для отладки проблем с датами
 */
export const logScheduleItemConversion = (record: IStaffRecord, scheduleItem: IScheduleItem): void => {
  console.log(`[ScheduleTabDataUtils] *** SCHEDULE ITEM CONVERSION LOG ***`);
  console.log(`Record ID: ${record.ID}`);
  console.log(`Original StaffRecord Date: ${record.Date.toISOString()}`);
  console.log(`Converted ScheduleItem Date: ${scheduleItem.date.toISOString()}`);
  console.log(`Date components match: ${
    record.Date.getUTCFullYear() === scheduleItem.date.getUTCFullYear() &&
    record.Date.getUTCMonth() === scheduleItem.date.getUTCMonth() &&
    record.Date.getUTCDate() === scheduleItem.date.getUTCDate()
  }`);
  console.log(`Working Hours: ${scheduleItem.workingHours}`);
  console.log(`Day of Week: ${scheduleItem.dayOfWeek}`);
  console.log(`Deleted Status: ${scheduleItem.deleted}`);
  console.log(`Holiday Status: ${scheduleItem.Holiday}`);
  console.log(`Type of Leave: ${scheduleItem.typeOfLeave || 'none'}`);
  console.log(`Start Time: ${scheduleItem.startHour}:${scheduleItem.startMinute} (extracted from UTC)`);
  console.log(`Finish Time: ${scheduleItem.finishHour}:${scheduleItem.finishMinute} (extracted from UTC)`);
  console.log(`Lunch Time: ${scheduleItem.lunchTime} minutes`);
  console.log(`Contract: ${scheduleItem.contract} (ID: ${scheduleItem.contractId})`);
  console.log(`Contract Number: ${scheduleItem.contractNumber}`);
  
  // Проверяем на октябрь 2024
  if (isOctober1st2024(scheduleItem.date)) {
    console.log(`[ScheduleTabDataUtils] *** THIS IS AN OCTOBER 1st 2024 RECORD - SHOULD BE VISIBLE IN SCHEDULE ***`);
  }
};

/**
 * НОВАЯ ФУНКЦИЯ: Валидирует корректность дат в ScheduleItem
 * Проверяет, что даты нормализованы правильно
 */
export const validateScheduleItemDates = (scheduleItem: IScheduleItem): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Проверяем, что основная дата нормализована к UTC полуночи
  const mainDate = scheduleItem.date;
  if (mainDate.getUTCHours() !== 0 || mainDate.getUTCMinutes() !== 0 || 
      mainDate.getUTCSeconds() !== 0 || mainDate.getUTCMilliseconds() !== 0) {
    errors.push(`Main date is not normalized to UTC midnight: ${mainDate.toISOString()}`);
  }
  
  // Проверяем, что времена смен имеют правильное время
  const startHourNum = parseInt(scheduleItem.startHour, 10);
  const startMinuteNum = parseInt(scheduleItem.startMinute, 10);
  const finishHourNum = parseInt(scheduleItem.finishHour, 10);
  const finishMinuteNum = parseInt(scheduleItem.finishMinute, 10);
  
  if (isNaN(startHourNum) || startHourNum < 0 || startHourNum > 23) {
    errors.push(`Invalid start hour: ${scheduleItem.startHour}`);
  }
  
  if (isNaN(startMinuteNum) || startMinuteNum < 0 || startMinuteNum > 59) {
    errors.push(`Invalid start minute: ${scheduleItem.startMinute}`);
  }
  
  if (isNaN(finishHourNum) || finishHourNum < 0 || finishHourNum > 23) {
    errors.push(`Invalid finish hour: ${scheduleItem.finishHour}`);
  }
  
  if (isNaN(finishMinuteNum) || finishMinuteNum < 0 || finishMinuteNum > 59) {
    errors.push(`Invalid finish minute: ${scheduleItem.finishMinute}`);
  }
  
  // Проверяем логическую корректность времени
  const startMinutesTotal = startHourNum * 60 + startMinuteNum;
  const finishMinutesTotal = finishHourNum * 60 + finishMinuteNum;
  
  if (startMinutesTotal >= finishMinutesTotal && startMinutesTotal !== 0 && finishMinutesTotal !== 0) {
    errors.push(`Start time (${scheduleItem.startHour}:${scheduleItem.startMinute}) is after finish time (${scheduleItem.finishHour}:${scheduleItem.finishMinute})`);
  }
  
  const isValid = errors.length === 0;
  
  if (!isValid) {
    console.error(`[ScheduleTabDataUtils] Schedule item validation failed for ID ${scheduleItem.id}:`, errors);
  }
  
  return { isValid, errors };
};

/**
 * НОВАЯ ФУНКЦИЯ: Массовая валидация массива ScheduleItem
 * Полезно для проверки корректности всей коллекции
 */
export const validateScheduleItems = (scheduleItems: IScheduleItem[]): {
  validItems: IScheduleItem[];
  invalidItems: { item: IScheduleItem; errors: string[] }[];
  summary: { total: number; valid: number; invalid: number; };
} => {
  console.log(`[ScheduleTabDataUtils] Validating ${scheduleItems.length} schedule items`);
  
  const validItems: IScheduleItem[] = [];
  const invalidItems: { item: IScheduleItem; errors: string[] }[] = [];
  
  scheduleItems.forEach(item => {
    const validation = validateScheduleItemDates(item);
    if (validation.isValid) {
      validItems.push(item);
    } else {
      invalidItems.push({ item, errors: validation.errors });
    }
  });
  
  const summary = {
    total: scheduleItems.length,
    valid: validItems.length,
    invalid: invalidItems.length
  };
  
  console.log(`[ScheduleTabDataUtils] Validation summary:`, summary);
  
  if (invalidItems.length > 0) {
    console.warn(`[ScheduleTabDataUtils] Found ${invalidItems.length} invalid schedule items`);
    invalidItems.forEach(({ item, errors }) => {
      console.warn(`[ScheduleTabDataUtils] Invalid item ID ${item.id}:`, errors);
    });
  }
  
  return { validItems, invalidItems, summary };
};

/**
 * ОТЛАДОЧНАЯ ФУНКЦИЯ: Выводит статистику по датам в коллекции ScheduleItem
 */
export const logScheduleItemsDateStatistics = (scheduleItems: IScheduleItem[]): void => {
  console.log(`[ScheduleTabDataUtils] *** SCHEDULE ITEMS DATE STATISTICS ***`);
  console.log(`Total items: ${scheduleItems.length}`);
  
  // Группируем по дням
  const dateGroups = scheduleItems.reduce((groups, item) => {
    const dateKey = item.date.toISOString().split('T')[0]; // YYYY-MM-DD
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(item);
    return groups;
  }, {} as Record<string, IScheduleItem[]>);
  
  const sortedDateKeys = Object.keys(dateGroups).sort();
  
  console.log(`Dates represented: ${sortedDateKeys.length}`);
  console.log(`Date range: ${sortedDateKeys[0] || 'none'} to ${sortedDateKeys[sortedDateKeys.length - 1] || 'none'}`);
  
  // Проверяем наличие записей за 1 октября 2024
  const oct1Key = '2024-10-01';
  if (dateGroups[oct1Key]) {
    console.log(`*** OCTOBER 1st 2024 FOUND: ${dateGroups[oct1Key].length} items ***`);
    dateGroups[oct1Key].forEach(item => {
      console.log(`  - ID: ${item.id}, deleted: ${item.deleted}, holiday: ${item.Holiday}, time: ${item.startHour}:${item.startMinute}-${item.finishHour}:${item.finishMinute}`);
    });
  } else {
    console.log(`*** OCTOBER 1st 2024 NOT FOUND in schedule items ***`);
  }
  
  // Статистика по месяцам
  const monthGroups = sortedDateKeys.reduce((months, dateKey) => {
    const monthKey = dateKey.substring(0, 7); // YYYY-MM
    if (!months[monthKey]) {
      months[monthKey] = 0;
    }
    months[monthKey] += dateGroups[dateKey].length;
    return months;
  }, {} as Record<string, number>);
  
  console.log('Items per month:');
  Object.entries(monthGroups).forEach(([month, count]) => {
    console.log(`  ${month}: ${count} items`);
  });
  
  // Статистика по статусам
  const deletedCount = scheduleItems.filter(item => item.deleted).length;
  const holidayCount = scheduleItems.filter(item => item.Holiday === 1).length;
  const leaveCount = scheduleItems.filter(item => item.typeOfLeave && item.typeOfLeave !== '').length;
  
  console.log('Status statistics:');
  console.log(`  Active items: ${scheduleItems.length - deletedCount}`);
  console.log(`  Deleted items: ${deletedCount}`);
  console.log(`  Holiday items: ${holidayCount}`);
  console.log(`  Leave items: ${leaveCount}`);
  
  // Статистика времени (только для первых нескольких для экономии)
  console.log('Time statistics (first 5 items):');
  scheduleItems.slice(0, 5).forEach((item, index) => {
    console.log(`  ${index + 1}. ID ${item.id}: ${item.startHour}:${item.startMinute}-${item.finishHour}:${item.finishMinute} (${item.workingHours})`);
  });
};