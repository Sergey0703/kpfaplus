// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSTimeCalculationUtils.ts

import { ISRSRecord } from './SRSTabInterfaces';

/**
 * Utility functions for time calculations in SRS table
 * Similar to ScheduleTableUtils but adapted for SRS records
 * РЕФАКТОРИНГ: Никаких изменений - уже работает с числовыми полями через ISRSRecord
 */

/**
 * Calculates working hours for an SRS record
 * Takes start time, end time, and lunch time into account
 * ПРИМЕЧАНИЕ: Работает с числовыми полями через ISRSRecord.startWork/finishWork
 * 
 * @param record - The SRS record to calculate time for
 * @returns Formatted time string (e.g., "7:30")
 */
export const calculateSRSWorkTime = (record: ISRSRecord): string => {
  // Parse hours and minutes from strings (уже приходят из числовых полей через SRSDataMapper)
  const startHour = parseInt(record.startWork.hours, 10) || 0;
  const startMinute = parseInt(record.startWork.minutes, 10) || 0;
  const finishHour = parseInt(record.finishWork.hours, 10) || 0;
  const finishMinute = parseInt(record.finishWork.minutes, 10) || 0;
  
  // Lunch time is in minutes as string (e.g., "0", "15", "30", "45", "60")
  const lunchMinutes = parseInt(record.lunch, 10) || 0;

  console.log('[SRSTimeCalculationUtils] *** CALCULATING WORK TIME WITH NUMERIC FIELDS ***');
  console.log('[SRSTimeCalculationUtils] Record ID:', record.id);
  console.log('[SRSTimeCalculationUtils] Start time:', `${record.startWork.hours}:${record.startWork.minutes}`, `(${startHour}:${startMinute})`);
  console.log('[SRSTimeCalculationUtils] Finish time:', `${record.finishWork.hours}:${record.finishWork.minutes}`, `(${finishHour}:${finishMinute})`);
  console.log('[SRSTimeCalculationUtils] Lunch minutes:', lunchMinutes);
  console.log('[SRSTimeCalculationUtils] Relief status:', record.relief, '(should NOT affect calculation)');

  // Простая проверка на одинаковое время
  if (startHour === finishHour && startMinute === finishMinute) {
    if (startHour === 0 && startMinute === 0) {
      console.log('[SRSTimeCalculationUtils] Both times are 00:00, returning 0:00');
      return "0:00";
    } else {
      console.log('[SRSTimeCalculationUtils] Start and finish times are the same, returning 0:00');
      return "0:00";
    }
  }

  // Упрощенная логика расчета в минутах
  const startMinutesTotal = startHour * 60 + startMinute;
  let finishMinutesTotal = finishHour * 60 + finishMinute;

  console.log('[SRSTimeCalculationUtils] Start minutes total:', startMinutesTotal);
  console.log('[SRSTimeCalculationUtils] Finish minutes total (initial):', finishMinutesTotal);

  // Обработка ночных смен (когда время окончания меньше времени начала)
  if (finishMinutesTotal <= startMinutesTotal) {
    console.log('[SRSTimeCalculationUtils] Finish time is before or equal to start time, assuming next day shift');
    finishMinutesTotal += (24 * 60); // Добавляем сутки (1440 минут)
    console.log('[SRSTimeCalculationUtils] Adjusted finish minutes for next day:', finishMinutesTotal);
  }

  // Рассчитываем общее рабочее время в минутах
  let totalWorkMinutes = finishMinutesTotal - startMinutesTotal;
  
  console.log('[SRSTimeCalculationUtils] Work minutes before lunch subtraction:', totalWorkMinutes);
  console.log('[SRSTimeCalculationUtils] Lunch minutes to subtract:', lunchMinutes);

  // Вычитаем время обеда
  totalWorkMinutes -= lunchMinutes;

  console.log('[SRSTimeCalculationUtils] Total work minutes after lunch subtraction:', totalWorkMinutes);

  // Проверка на отрицательное время
  if (totalWorkMinutes < 0) {
    console.warn('[SRSTimeCalculationUtils] Negative work time calculated, returning 0:00');
    return "0:00";
  }

  // Правильное форматирование в часы и минуты
  const hours = Math.floor(totalWorkMinutes / 60);
  const minutes = totalWorkMinutes % 60;

  // Форматируем результат в формат "H:MM" (как ожидается в системе)
  const formattedTime = `${hours}:${minutes.toString().padStart(2, '0')}`;

  console.log('[SRSTimeCalculationUtils] *** CALCULATION RESULT ***');
  console.log('[SRSTimeCalculationUtils] Total work minutes:', totalWorkMinutes);
  console.log('[SRSTimeCalculationUtils] Hours:', hours);
  console.log('[SRSTimeCalculationUtils] Minutes:', minutes);
  console.log('[SRSTimeCalculationUtils] Formatted time:', formattedTime);

  // Тестовые случаи для проверки
  console.log('[SRSTimeCalculationUtils] *** VERIFICATION ***');
  if (startHour === 8 && startMinute === 0 && finishHour === 9 && finishMinute === 0 && lunchMinutes === 0) {
    console.log('[SRSTimeCalculationUtils] TEST CASE: 08:00-09:00, no lunch, expected: 1:00, actual:', formattedTime);
  }
  if (startHour === 8 && startMinute === 0 && finishHour === 16 && finishMinute === 0 && lunchMinutes === 30) {
    console.log('[SRSTimeCalculationUtils] TEST CASE: 08:00-16:00, 30min lunch, expected: 7:30, actual:', formattedTime);
  }
  if (startHour === 23 && startMinute === 0 && finishHour === 7 && finishMinute === 0 && lunchMinutes === 0) {
    console.log('[SRSTimeCalculationUtils] TEST CASE: 23:00-07:00, no lunch, expected: 8:00, actual:', formattedTime);
  }

  return formattedTime;
};

/**
 * Checks if start and end times are the same for an SRS record
 * Used to highlight potential errors in the UI
 * ПРИМЕЧАНИЕ: Работает с числовыми полями через ISRSRecord.startWork/finishWork
 * 
 * @param record - The SRS record to check
 * @returns true if start and end times are the same (and not both 00:00)
 */
export const checkSRSStartEndTimeSame = (record: ISRSRecord): boolean => {
  // Parse hours and minutes from strings (уже приходят из числовых полей через SRSDataMapper)
  const startHour = parseInt(record.startWork.hours, 10) || 0;
  const startMinute = parseInt(record.startWork.minutes, 10) || 0;
  const finishHour = parseInt(record.finishWork.hours, 10) || 0;
  const finishMinute = parseInt(record.finishWork.minutes, 10) || 0;

  // Простая проверка без создания Date объектов
  const areSame = (startHour === finishHour && startMinute === finishMinute) && 
                  !(startHour === 0 && startMinute === 0 && finishHour === 0 && finishMinute === 0);

  if (areSame) {
    console.log(`[SRSTimeCalculationUtils] Start and end times are the same for record ${record.id}: ${startHour}:${startMinute}`);
  }

  return areSame;
};

/**
 * Validates if the time configuration is valid for an SRS record
 * ПРИМЕЧАНИЕ: Работает с числовыми полями через ISRSRecord.startWork/finishWork
 * 
 * @param record - The SRS record to validate
 * @returns Object with validation results
 */
export const validateSRSTimeConfiguration = (record: ISRSRecord): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse times (уже приходят из числовых полей через SRSDataMapper)
  const startHour = parseInt(record.startWork.hours, 10) || 0;
  const startMinute = parseInt(record.startWork.minutes, 10) || 0;
  const finishHour = parseInt(record.finishWork.hours, 10) || 0;
  const finishMinute = parseInt(record.finishWork.minutes, 10) || 0;
  const lunchMinutes = parseInt(record.lunch, 10) || 0;

  // Validate hour ranges
  if (startHour < 0 || startHour > 23) {
    errors.push(`Invalid start hour: ${startHour}`);
  }
  if (finishHour < 0 || finishHour > 23) {
    errors.push(`Invalid finish hour: ${finishHour}`);
  }

  // Validate minute ranges
  if (startMinute < 0 || startMinute > 59) {
    errors.push(`Invalid start minute: ${startMinute}`);
  }
  if (finishMinute < 0 || finishMinute > 59) {
    errors.push(`Invalid finish minute: ${finishMinute}`);
  }

  // Check for same start/end times
  if (checkSRSStartEndTimeSame(record)) {
    errors.push('Start and end work times cannot be the same');
  }

  // Check lunch time validity
  if (lunchMinutes > 0) {
    const startMinutesTotal = startHour * 60 + startMinute;
    let finishMinutesTotal = finishHour * 60 + finishMinute;
    
    // Handle next day scenario
    if (finishMinutesTotal <= startMinutesTotal) {
      finishMinutesTotal += (24 * 60);
    }
    
    const totalPossibleMinutes = finishMinutesTotal - startMinutesTotal;
    
    if (lunchMinutes >= totalPossibleMinutes) {
      errors.push('Lunch time cannot be longer than or equal to total work period');
    }
  }

  // Check for extremely long shifts
  const calculatedTime = calculateSRSWorkTime(record);
  const [hoursStr, minutesStr] = calculatedTime.split(':');
  const hours = parseInt(hoursStr, 10) + (parseInt(minutesStr, 10) / 60);
  if (hours > 16) {
    warnings.push('Work shift longer than 16 hours detected');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Formats time components for display
 * ПРИМЕЧАНИЕ: Работает со строковыми значениями из ISRSRecord
 * 
 * @param hours - Hours as string
 * @param minutes - Minutes as string
 * @returns Formatted time string "HH:MM"
 */
export const formatSRSTimeForDisplay = (hours: string, minutes: string): string => {
  const h = (hours || '00').padStart(2, '0');
  const m = (minutes || '00').padStart(2, '0');
  return `${h}:${m}`;
};

/**
 * Creates an updated SRS record with recalculated work time
 * Used when any time-related field changes
 * ПРИМЕЧАНИЕ: Relief НЕ пересчитывает время
 * 
 * @param record - Original SRS record
 * @param field - Field that changed
 * @param value - New value for the field
 * @returns Updated record with recalculated hours
 */
export const updateSRSRecordWithCalculatedTime = (
  record: ISRSRecord, 
  field: string, 
  value: string | boolean | { hours: string; minutes: string }
): ISRSRecord => {
  // Create updated record with new field value
  let updatedRecord: ISRSRecord;

  switch (field) {
    case 'startWork':
      updatedRecord = { ...record, startWork: value as { hours: string; minutes: string } };
      break;
    case 'finishWork':
      updatedRecord = { ...record, finishWork: value as { hours: string; minutes: string } };
      break;
    case 'lunch':
      updatedRecord = { ...record, lunch: value as string };
      break;
    case 'relief':
      // Relief не влияет на время работы
      updatedRecord = { ...record, relief: value as boolean };
      console.log('[SRSTimeCalculationUtils] Relief changed, NOT recalculating time');
      return updatedRecord; // Возвращаем без пересчета времени
    default:
      updatedRecord = { 
        ...record, 
        [field]: value 
      } as ISRSRecord;
      break;
  }

  // Recalculate hours only if it's a time-related field (NOT relief)
  const timeRelatedFields = ['startWork', 'finishWork', 'lunch'];
  if (timeRelatedFields.includes(field)) {
    const newHours = calculateSRSWorkTime(updatedRecord);
    updatedRecord = { ...updatedRecord, hours: newHours };

    console.log('[SRSTimeCalculationUtils] Updated record with calculated time:', {
      recordId: record.id,
      field,
      oldHours: record.hours,
      newHours,
      startTime: formatSRSTimeForDisplay(updatedRecord.startWork.hours, updatedRecord.startWork.minutes),
      finishTime: formatSRSTimeForDisplay(updatedRecord.finishWork.hours, updatedRecord.finishWork.minutes),
      lunch: updatedRecord.lunch
    });
  }

  return updatedRecord;
};