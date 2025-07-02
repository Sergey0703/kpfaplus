// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabDataUtils.ts
import { IStaffRecord } from "../../../../services/StaffRecordsService";
import { IScheduleItem } from "../components/ScheduleTable";
import { IContract } from "../../../../models/IContract";
import { DateUtils } from '../../../CustomDatePicker/CustomDatePicker';

/**
 * *** НОВАЯ ФУНКЦИЯ: Date-only форматирование для совместимости с HolidaysService ***
 * Создает строку даты в формате YYYY-MM-DD для консистентного сравнения
 * Совместимо с Date-only форматом из SharePoint Holidays list
 */
export const formatDateForComparison = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * *** НОВАЯ ФУНКЦИЯ: Date-only совместимое сравнение дат ***
 * Сравнивает две даты только по компонентам года, месяца и дня
 * Игнорирует время и часовые пояса
 */
export const isDateEqual = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

/**
 * *** НОВАЯ ФУНКЦИЯ: Создание Date-only строки ***
 * Альтернативное название для formatDateForComparison для ясности
 */
export const formatDateOnly = (date: Date): string => {
  return formatDateForComparison(date);
};

/**
 * *** НОВАЯ ФУНКЦИЯ: Проверка является ли дата праздником (Date-only совместимо) ***
 * Использует Date-only сравнение для совместимости с новым форматом Holidays list
 */
export const isHolidayDate = (date: Date, holidays: Array<{ date: Date; title: string }>): boolean => {
  if (!holidays || holidays.length === 0) {
    return false;
  }
  
  const targetDateString = formatDateForComparison(date);
  
  return holidays.some(holiday => {
    const holidayDateString = formatDateForComparison(holiday.date);
    return holidayDateString === targetDateString;
  });
};

/**
 * Вспомогательная функция для создания Date из часов и минут
 * ИСПРАВЛЕНО: Использует прямое создание времени БЕЗ DateUtils.createShiftDateTime
 * для избежания любой потенциальной корректировки часового пояса
 */
export const createTimeFromScheduleItem = (baseDate: Date, hourStr: string, minuteStr: string): Date => {
  const hour = parseInt(hourStr, 10) || 0;
  const minute = parseInt(minuteStr, 10) || 0;
  
  console.log(`[ScheduleTabDataUtils] createTimeFromScheduleItem: base=${baseDate.toISOString()}, time=${hour}:${minute}`);
  
  // *** ИСПРАВЛЕНО: Создаем время напрямую БЕЗ корректировки часового пояса ***
  const result = new Date(baseDate);
  
  // Валидация диапазонов
  if (hour < 0 || hour > 23) {
    console.warn(`[ScheduleTabDataUtils] Hours out of range: ${hour} (should be 0-23), setting to 0`);
    result.setUTCHours(0, 0, 0, 0);
    console.log(`[ScheduleTabDataUtils] createTimeFromScheduleItem result (invalid hours): ${result.toISOString()}`);
    return result;
  }

  if (minute < 0 || minute > 59) {
    console.warn(`[ScheduleTabDataUtils] Minutes out of range: ${minute} (should be 0-59), setting to 0`);
    result.setUTCHours(hour, 0, 0, 0);
    console.log(`[ScheduleTabDataUtils] createTimeFromScheduleItem result (invalid minutes): ${result.toISOString()}`);
    return result;
  }
  
  // *** УБИРАЕМ КОРРЕКТИРОВКУ ЧАСОВОГО ПОЯСА - устанавливаем время напрямую в UTC ***
  result.setUTCHours(hour, minute, 0, 0);
  
  console.log(`[ScheduleTabDataUtils] *** DIRECT TIME SETTING WITHOUT TIMEZONE ADJUSTMENT ***`);
  console.log(`[ScheduleTabDataUtils] Input: ${hour}:${minute} → Output UTC: ${hour}:${minute} (no adjustment)`);
  console.log(`[ScheduleTabDataUtils] createTimeFromScheduleItem result: ${result.toISOString()}`);
  return result;
};

/**
 * Преобразует данные записей расписания в формат для отображения в таблице
 * ОБНОВЛЕНО: Приоритет отдается числовым полям времени, fallback на ShiftDate1/ShiftDate2
 * ИСПРАВЛЕНО: Больше НЕ копирует поле Holiday из StaffRecords
 */
export const convertStaffRecordsToScheduleItems = (
  records: IStaffRecord[] | undefined, 
  selectedContract?: IContract
): IScheduleItem[] => {
  if (!records || records.length === 0) {
    return [];
  }

  console.log(`[ScheduleTabDataUtils] Converting ${records.length} staff records to schedule items`);
  console.log(`[ScheduleTabDataUtils] *** IMPORTANT: Holiday field is NO LONGER copied from StaffRecords ***`);
  console.log(`[ScheduleTabDataUtils] *** Date-only compatibility: ENABLED for holiday detection ***`);

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
      console.log(`[ScheduleTabDataUtils] Date-only format: ${formatDateForComparison(normalizedDate)}`);
    }
    
    // Форматирование дня недели
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][normalizedDate.getDay()];
    
    // *** НОВАЯ ЛОГИКА: Приоритет числовым полям времени ***
    let startHour = '00';
    let startMinute = '00';
    let finishHour = '00';
    let finishMinute = '00';
    
    // ПРИОРИТЕТ 1: Числовые поля времени (для ScheduleTab)
    if (record.ShiftDate1Hours !== undefined && record.ShiftDate1Minutes !== undefined) {
      startHour = record.ShiftDate1Hours.toString().padStart(2, '0');
      startMinute = record.ShiftDate1Minutes.toString().padStart(2, '0');
    } else if (record.ShiftDate1) {
      // FALLBACK: Используем ShiftDate1 с UTC методами
      startHour = record.ShiftDate1.getUTCHours().toString().padStart(2, '0');
      startMinute = record.ShiftDate1.getUTCMinutes().toString().padStart(2, '0');
    }
    
    if (record.ShiftDate2Hours !== undefined && record.ShiftDate2Minutes !== undefined) {
      finishHour = record.ShiftDate2Hours.toString().padStart(2, '0');
      finishMinute = record.ShiftDate2Minutes.toString().padStart(2, '0');
    } else if (record.ShiftDate2) {
      // FALLBACK: Используем ShiftDate2 с UTC методами
      finishHour = record.ShiftDate2.getUTCHours().toString().padStart(2, '0');
      finishMinute = record.ShiftDate2.getUTCMinutes().toString().padStart(2, '0');
    }
    
    // ИСПРАВЛЕНО: Извлекаем значение TypeOfLeaveID ТОЛЬКО из записи расписания
    let typeOfLeaveValue = '';
    
    // Проверяем оба возможных формата данных из StaffRecords
    if (record.TypeOfLeave && record.TypeOfLeave.Id) {
      typeOfLeaveValue = String(record.TypeOfLeave.Id);
    } 
    // Если нет объекта TypeOfLeave, проверяем прямое поле TypeOfLeaveID
    else if (record.TypeOfLeaveID) {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
    }
    
    // *** ИСПРАВЛЕНО: Формирование объекта IScheduleItem БЕЗ поля Holiday ***
    const scheduleItem: IScheduleItem = {
      id: record.ID,
      date: normalizedDate, // ИСПРАВЛЕНО: используем нормализованную дату
      dayOfWeek,
      workingHours: record.WorkTime || '0.00',
      startHour,
      startMinute,
      finishHour,
      finishMinute,
      
      // *** НОВОЕ: Добавляем числовые поля времени если они есть ***
      startHours: record.ShiftDate1Hours,
      startMinutes: record.ShiftDate1Minutes,
      finishHours: record.ShiftDate2Hours,
      finishMinutes: record.ShiftDate2Minutes,
      
      lunchTime: record.TimeForLunch.toString(),
      typeOfLeave: typeOfLeaveValue, // ИСПРАВЛЕНО: используется ТОЛЬКО значение из StaffRecords
      shift: 1, // По умолчанию 1
      contract: record.WeeklyTimeTableTitle || selectedContract?.template || '',
      contractId: record.WeeklyTimeTableID || selectedContract?.id || '',
      contractNumber: record.Contract.toString(),
      deleted: record.Deleted === 1 // Добавляем флаг deleted
      // *** УДАЛЕНО: Holiday: record.Holiday - больше НЕ копируем поле Holiday из StaffRecords ***
    };
    
    // Дополнительное логирование для октября 2024
    if (normalizedDate.getUTCMonth() === 9 && normalizedDate.getUTCFullYear() === 2024 && normalizedDate.getUTCDate() === 1) {
      console.log(`[ScheduleTabDataUtils] *** CREATED OCTOBER 1st SCHEDULE ITEM ***`);
      console.log(`[ScheduleTabDataUtils] Schedule Item:`, {
        id: scheduleItem.id,
        date: scheduleItem.date.toISOString(),
        dateOnly: formatDateForComparison(scheduleItem.date),
        dayOfWeek: scheduleItem.dayOfWeek,
        startTime: `${scheduleItem.startHour}:${scheduleItem.startMinute}`,
        finishTime: `${scheduleItem.finishHour}:${scheduleItem.finishMinute}`,
        numericTime: scheduleItem.startHours !== undefined ? `${scheduleItem.startHours}:${scheduleItem.startMinutes}-${scheduleItem.finishHours}:${scheduleItem.finishMinutes}` : 'N/A',
        deleted: scheduleItem.deleted
        // *** УДАЛЕНО: Holiday: scheduleItem.Holiday - больше НЕ логируем поле Holiday ***
      });
    }
    
    return scheduleItem;
  });
};

/**
 * Форматирует объект IStaffRecord для обновления из IScheduleItem
 * ОБНОВЛЕНО: Заполняет как числовые поля времени, так и ShiftDate1/ShiftDate2 для совместимости
 * ИСПРАВЛЕНО: Больше НЕ включает поле Holiday в данные для обновления
 */
export const formatItemForUpdate = (recordId: string, scheduleItem: IScheduleItem): Partial<IStaffRecord> => {
  console.log(`[ScheduleTabDataUtils] formatItemForUpdate for record ID: ${recordId}`);
  console.log(`[ScheduleTabDataUtils] Input schedule item date: ${scheduleItem.date.toISOString()}`);
  console.log(`[ScheduleTabDataUtils] Input schedule item date-only: ${formatDateForComparison(scheduleItem.date)}`);
  console.log(`[ScheduleTabDataUtils] *** IMPORTANT: Holiday field is NO LONGER included in update data ***`);
  
  // *** ИСПРАВЛЕНИЕ: Создаем дату с местной полуночью для поля Date ***
  const localMidnightDate = new Date(
    scheduleItem.date.getFullYear(),
    scheduleItem.date.getMonth(),
    scheduleItem.date.getDate(),
    0, 0, 0, 0 // Местная полночь
  );
  
  console.log(`[ScheduleTabDataUtils] Created local midnight date for Date field: ${localMidnightDate.toISOString()}`);
  
  // Специальная отладка для октября 2024
  if (scheduleItem.date.getUTCMonth() === 9 && scheduleItem.date.getUTCFullYear() === 2024 && scheduleItem.date.getUTCDate() === 1) {
    console.log(`[ScheduleTabDataUtils] *** FORMATTING OCTOBER 1st ITEM FOR UPDATE ***`);
    console.log(`[ScheduleTabDataUtils] Record ID: ${recordId}`);
    console.log(`[ScheduleTabDataUtils] Original item date: ${scheduleItem.date.toISOString()}`);
    console.log(`[ScheduleTabDataUtils] Original item date-only: ${formatDateForComparison(scheduleItem.date)}`);
    console.log(`[ScheduleTabDataUtils] Local midnight date: ${localMidnightDate.toISOString()}`);
  }
  
  // *** ПРИОРИТЕТ ЧИСЛОВЫХ ПОЛЕЙ ДЛЯ ВРЕМЕНИ ***
  let startHour: number, startMinute: number, finishHour: number, finishMinute: number;

  // Проверяем наличие числовых полей (ПРИОРИТЕТ)
  if (typeof scheduleItem.startHours === 'number' && typeof scheduleItem.startMinutes === 'number' &&
      typeof scheduleItem.finishHours === 'number' && typeof scheduleItem.finishMinutes === 'number') {
    
    console.log(`[ScheduleTabDataUtils] *** USING NUMERIC FIELDS (PRIORITY) ***`);
    startHour = scheduleItem.startHours;
    startMinute = scheduleItem.startMinutes;
    finishHour = scheduleItem.finishHours;
    finishMinute = scheduleItem.finishMinutes;
    
    console.log(`[ScheduleTabDataUtils] Numeric time values: ${startHour}:${startMinute} - ${finishHour}:${finishMinute}`);
  } else {
    // Fallback к строковым полям
    console.log(`[ScheduleTabDataUtils] *** FALLBACK TO STRING FIELDS ***`);
    startHour = parseInt(scheduleItem.startHour, 10) || 0;
    startMinute = parseInt(scheduleItem.startMinute, 10) || 0;
    finishHour = parseInt(scheduleItem.finishHour, 10) || 0;
    finishMinute = parseInt(scheduleItem.finishMinute, 10) || 0;
    
    console.log(`[ScheduleTabDataUtils] Parsed string time values: ${startHour}:${startMinute} - ${finishHour}:${finishMinute}`);
  }
  
  // *** ИСПРАВЛЕНО: Используем createTimeFromScheduleItem с прямым созданием времени ***
  const shiftDate1 = createTimeFromScheduleItem(scheduleItem.date, startHour.toString().padStart(2, '0'), startMinute.toString().padStart(2, '0'));
  const shiftDate2 = createTimeFromScheduleItem(scheduleItem.date, finishHour.toString().padStart(2, '0'), finishMinute.toString().padStart(2, '0'));

  // *** ИСПРАВЛЕНО: updateData БЕЗ поля Holiday ***
  const updateData: Partial<IStaffRecord> = {
    // *** ИСПРАВЛЕНИЕ: Используем местную полночь для поля Date ***
    Date: localMidnightDate,
    
    // *** ОБНОВЛЕНО: Заполняем числовые поля времени (ПРИОРИТЕТ для ScheduleTab) ***
    ShiftDate1Hours: startHour,
    ShiftDate1Minutes: startMinute,
    ShiftDate2Hours: finishHour,
    ShiftDate2Minutes: finishMinute,
    
    // *** ИСПРАВЛЕНО: Времена смен БЕЗ корректировки часового пояса (для обратной совместимости) ***
    ShiftDate1: shiftDate1,
    ShiftDate2: shiftDate2,
    
    // Numeric values
    TimeForLunch: parseInt(scheduleItem.lunchTime, 10) || 0,
    Contract: parseInt(scheduleItem.contractNumber || '1', 10),
    
    // TypeOfLeave could be a string ID or empty
    TypeOfLeaveID: scheduleItem.typeOfLeave || '',
    
    // Work time as calculated
    WorkTime: scheduleItem.workingHours
    
    // *** УДАЛЕНО: Holiday: scheduleItem.Holiday - больше НЕ включаем поле Holiday ***
  };
  
  console.log(`[ScheduleTabDataUtils] *** UPDATE DATA WITHOUT HOLIDAY FIELD ***`);
  console.log(`[ScheduleTabDataUtils] Numeric time fields:`, {
    ShiftDate1Hours: updateData.ShiftDate1Hours,
    ShiftDate1Minutes: updateData.ShiftDate1Minutes,
    ShiftDate2Hours: updateData.ShiftDate2Hours,
    ShiftDate2Minutes: updateData.ShiftDate2Minutes
  });
  console.log(`[ScheduleTabDataUtils] DateTime fields:`, {
    ShiftDate1: updateData.ShiftDate1?.toISOString(),
    ShiftDate2: updateData.ShiftDate2?.toISOString()
  });
  console.log(`[ScheduleTabDataUtils] Other fields (NO Holiday):`, {
    Date: updateData.Date?.toISOString(),
    TimeForLunch: updateData.TimeForLunch,
    Contract: updateData.Contract,
    TypeOfLeaveID: updateData.TypeOfLeaveID,
    WorkTime: updateData.WorkTime
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
    Output: ${normalizedDate.toISOString()}
    Date-only: ${formatDateForComparison(normalizedDate)}`);
  
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
    console.log(`[ScheduleTabDataUtils] *** DETECTED OCTOBER 1st 2024 DATE: ${date.toISOString()} (Date-only: ${formatDateForComparison(date)}) ***`);
  }
  
  return isOct1st;
};

/**
 * НОВАЯ ФУНКЦИЯ: Логирует детальную информацию о преобразовании записи
 * Полезно для отладки проблем с датами
 * ИСПРАВЛЕНО: Больше НЕ логирует поле Holiday
 */
export const logScheduleItemConversion = (record: IStaffRecord, scheduleItem: IScheduleItem): void => {
  console.log(`[ScheduleTabDataUtils] *** SCHEDULE ITEM CONVERSION LOG ***`);
  console.log(`Record ID: ${record.ID}`);
  console.log(`Original StaffRecord Date: ${record.Date.toISOString()}`);
  console.log(`Converted ScheduleItem Date: ${scheduleItem.date.toISOString()}`);
  console.log(`Date-only format: ${formatDateForComparison(scheduleItem.date)}`);
  console.log(`Date components match: ${
    record.Date.getUTCFullYear() === scheduleItem.date.getUTCFullYear() &&
    record.Date.getUTCMonth() === scheduleItem.date.getUTCMonth() &&
    record.Date.getUTCDate() === scheduleItem.date.getUTCDate()
  }`);
  console.log(`Working Hours: ${scheduleItem.workingHours}`);
  console.log(`Day of Week: ${scheduleItem.dayOfWeek}`);
  console.log(`Deleted Status: ${scheduleItem.deleted}`);
  console.log(`Type of Leave: ${scheduleItem.typeOfLeave || 'none'}`);
  console.log(`Start Time: ${scheduleItem.startHour}:${scheduleItem.startMinute}`);
  console.log(`Finish Time: ${scheduleItem.finishHour}:${scheduleItem.finishMinute}`);
  if (scheduleItem.startHours !== undefined) {
    console.log(`Numeric Time: ${scheduleItem.startHours}:${scheduleItem.startMinutes} - ${scheduleItem.finishHours}:${scheduleItem.finishMinutes}`);
  }
  console.log(`Lunch Time: ${scheduleItem.lunchTime} minutes`);
  console.log(`Contract: ${scheduleItem.contract} (ID: ${scheduleItem.contractId})`);
  console.log(`Contract Number: ${scheduleItem.contractNumber}`);
  // *** УДАЛЕНО: Holiday Status логирование ***
  
  // Проверяем на октябрь 2024
  if (isOctober1st2024(scheduleItem.date)) {
    console.log(`[ScheduleTabDataUtils] *** THIS IS AN OCTOBER 1st 2024 RECORD - SHOULD BE VISIBLE IN SCHEDULE ***`);
    console.log(`[ScheduleTabDataUtils] *** Date-only format: ${formatDateForComparison(scheduleItem.date)} ***`);
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
 * ИСПРАВЛЕНО: Больше НЕ включает статистику по Holiday полю
 */
export const logScheduleItemsDateStatistics = (scheduleItems: IScheduleItem[]): void => {
  console.log(`[ScheduleTabDataUtils] *** SCHEDULE ITEMS DATE STATISTICS WITH DATE-ONLY COMPATIBILITY ***`);
  console.log(`Total items: ${scheduleItems.length}`);
  
  // Группируем по дням используя Date-only формат
  const dateGroups = scheduleItems.reduce((groups, item) => {
    const dateKey = formatDateForComparison(item.date);
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
      console.log(`  - ID: ${item.id}, deleted: ${item.deleted}, time: ${item.startHour}:${item.startMinute}-${item.finishHour}:${item.finishMinute}`);
      // *** УДАЛЕНО: holiday: ${item.Holiday} - больше НЕ логируем поле Holiday ***
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
  
  // Статистика по статусам (БЕЗ holiday)
  const deletedCount = scheduleItems.filter(item => item.deleted).length;
  const leaveCount = scheduleItems.filter(item => item.typeOfLeave && item.typeOfLeave !== '').length;
  const numericFieldsCount = scheduleItems.filter(item => 
    typeof item.startHours === 'number' && typeof item.startMinutes === 'number'
  ).length;
  
  console.log('Status statistics (Holiday field NO LONGER tracked):');
  console.log(`  Active items: ${scheduleItems.length - deletedCount}`);
  console.log(`  Deleted items: ${deletedCount}`);
  console.log(`  Leave items: ${leaveCount}`);
  console.log(`  Items with numeric time fields: ${numericFieldsCount}`);
  // *** УДАЛЕНО: Holiday items статистика ***
  
  // Статистика времени (только для первых нескольких для экономии)
  console.log('Time statistics (first 5 items):');
  scheduleItems.slice(0, 5).forEach((item, index) => {
    const numericTime = item.startHours !== undefined ? 
      `${item.startHours}:${item.startMinutes}-${item.finishHours}:${item.finishMinutes}` : 
      'N/A';
    console.log(`  ${index + 1}. ID ${item.id}: ${item.startHour}:${item.startMinute}-${item.finishHour}:${item.finishMinute} (${item.workingHours}) [Numeric: ${numericTime}]`);
  });
  
  // Date-only format статистика
  console.log('Date-only format samples (first 3 dates):');
  sortedDateKeys.slice(0, 3).forEach(dateKey => {
    const itemsForDate = dateGroups[dateKey];
    console.log(`  ${dateKey}: ${itemsForDate.length} items`);
  });
};