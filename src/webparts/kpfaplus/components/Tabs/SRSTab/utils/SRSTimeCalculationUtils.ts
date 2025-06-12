// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSTimeCalculationUtils.ts

import { 
  calculateWorkTime, 
  IWorkTimeInput, 
  createTimeFromComponents,
  isStartEndTimeSame,
  isZeroTime
} from '../../../../utils/TimeCalculationUtils';
import { ISRSRecord } from './SRSTabInterfaces';

/**
 * Utility functions for time calculations in SRS table
 * Similar to ScheduleTableUtils but adapted for SRS records
 */

/**
 * Calculates working hours for an SRS record
 * Takes start time, end time, and lunch time into account
 * 
 * @param record - The SRS record to calculate time for
 * @returns Formatted time string (e.g., "7.50")
 */
export const calculateSRSWorkTime = (record: ISRSRecord): string => {
  // Parse hours and minutes from strings
  const startHour = parseInt(record.startWork.hours, 10) || 0;
  const startMinute = parseInt(record.startWork.minutes, 10) || 0;
  const finishHour = parseInt(record.finishWork.hours, 10) || 0;
  const finishMinute = parseInt(record.finishWork.minutes, 10) || 0;
  
  // FIXED: Parse lunch time - it should be in minutes, not a string to parse
  // The lunch field contains minutes as string (e.g., "0", "15", "30", "45", "60")
  const lunchMinutes = parseInt(record.lunch, 10) || 0;

  console.log('[SRSTimeCalculationUtils] calculateSRSWorkTime input:', {
    recordId: record.id,
    date: record.date.toLocaleDateString(),
    startTime: `${record.startWork.hours}:${record.startWork.minutes}`,
    finishTime: `${record.finishWork.hours}:${record.finishWork.minutes}`,
    lunchString: record.lunch,
    lunchMinutes,
    parsedValues: { startHour, startMinute, finishHour, finishMinute }
  });

  // Create dates for calculation using the record's date
  const startDate = createTimeFromComponents(record.date, startHour, startMinute);
  const finishDate = createTimeFromComponents(record.date, finishHour, finishMinute);

  // Check if date creation failed
  if (!startDate || !finishDate) {
    console.error('[SRSTimeCalculationUtils] Failed to create time components for record:', record.id);
    return "0.00";
  }

  console.log('[SRSTimeCalculationUtils] Created time components:', {
    startDate: startDate.toISOString(),
    finishDate: finishDate.toISOString()
  });

  // If start and end times are the same, and they are not both 00:00
  if (isStartEndTimeSame(startDate, finishDate) && 
      (!isZeroTime(startDate) || !isZeroTime(finishDate))) {
    console.log(`[SRSTimeCalculationUtils] Start and end times are the same for record ${record.id}. Returning 0.00`);
    return "0.00";
  }

  // If both times are 00:00, return 0.00
  if (isZeroTime(startDate) && isZeroTime(finishDate)) {
    console.log(`[SRSTimeCalculationUtils] Both start and end times are 00:00 for record ${record.id}. Returning 0.00`);
    return "0.00";
  }

  // Prepare input data for calculation
  const input: IWorkTimeInput = {
    startTime: startDate,
    endTime: finishDate,
    lunchDurationMinutes: lunchMinutes
  };

  console.log('[SRSTimeCalculationUtils] Calling calculateWorkTime with input:', {
    startTime: startDate.toISOString(),
    endTime: finishDate.toISOString(),
    lunchDurationMinutes: input.lunchDurationMinutes
  });

  // Use the utility to calculate work time
  const result = calculateWorkTime(input);
  
  console.log('[SRSTimeCalculationUtils] calculateWorkTime result:', {
    recordId: record.id,
    input: {
      startTime: startDate.toISOString(),
      endTime: finishDate.toISOString(),
      lunchDurationMinutes: lunchMinutes
    },
    result: {
      formattedTime: result.formattedTime,
      totalMinutes: result.totalMinutes
    },
    expected: `For ${formatSRSTimeForDisplay(record.startWork.hours, record.startWork.minutes)} to ${formatSRSTimeForDisplay(record.finishWork.hours, record.finishWork.minutes)} with ${lunchMinutes}min lunch should be ${((finishHour * 60 + finishMinute) - (startHour * 60 + startMinute) - lunchMinutes) / 60} hours`
  });

  return result.formattedTime;
};

/**
 * Checks if start and end times are the same for an SRS record
 * Used to highlight potential errors in the UI
 * 
 * @param record - The SRS record to check
 * @returns true if start and end times are the same (and not both 00:00)
 */
export const checkSRSStartEndTimeSame = (record: ISRSRecord): boolean => {
  // Parse hours and minutes from strings
  const startHour = parseInt(record.startWork.hours, 10) || 0;
  const startMinute = parseInt(record.startWork.minutes, 10) || 0;
  const finishHour = parseInt(record.finishWork.hours, 10) || 0;
  const finishMinute = parseInt(record.finishWork.minutes, 10) || 0;

  // Create dates for comparison
  const startDate = createTimeFromComponents(record.date, startHour, startMinute);
  const finishDate = createTimeFromComponents(record.date, finishHour, finishMinute);

  // Check if date creation failed
  if (!startDate || !finishDate) {
    console.error('[SRSTimeCalculationUtils] Failed to create time components for comparison:', record.id);
    return false;
  }

  // Check if dates are the same and not both 00:00
  const areSame = isStartEndTimeSame(startDate, finishDate) && 
                  !(isZeroTime(startDate) && isZeroTime(finishDate));

  if (areSame) {
    console.log(`[SRSTimeCalculationUtils] Start and end times are the same for record ${record.id}`);
  }

  return areSame;
};

/**
 * Validates if the time configuration is valid for an SRS record
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

  // Parse times
  const startHour = parseInt(record.startWork.hours, 10) || 0;
  const startMinute = parseInt(record.startWork.minutes, 10) || 0;
  const finishHour = parseInt(record.finishWork.hours, 10) || 0;
  const finishMinute = parseInt(record.finishWork.minutes, 10) || 0;
  const lunchMinutes = parseInt(record.lunch, 10) || 0;

  // Create time objects
  const startDate = createTimeFromComponents(record.date, startHour, startMinute);
  const finishDate = createTimeFromComponents(record.date, finishHour, finishMinute);

  // Check if date creation failed
  if (!startDate || !finishDate) {
    errors.push('Invalid time configuration - unable to create time objects');
    return { isValid: false, errors, warnings };
  }

  // Check for same start/end times
  if (checkSRSStartEndTimeSame(record)) {
    errors.push('Start and end work times cannot be the same');
  }

  // Check if end time is before start time (next day scenario)
  if (finishDate < startDate && !(isZeroTime(startDate) && isZeroTime(finishDate))) {
    warnings.push('End time is before start time - assuming next day shift');
  }

  // Check lunch time validity
  if (lunchMinutes > 0) {
    const totalPossibleMinutes = Math.abs(finishDate.getTime() - startDate.getTime()) / (1000 * 60);
    
    if (lunchMinutes >= totalPossibleMinutes) {
      errors.push('Lunch time cannot be longer than or equal to total work period');
    }
  }

  // Check for extremely long shifts
  const totalHours = Math.abs(finishDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
  if (totalHours > 16) {
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
 * 
 * @param record - Original SRS record
 * @param field - Field that changed
 * @param value - New value for the field
 * @returns Updated record with recalculated hours
 */
export const updateSRSRecordWithCalculatedTime = (
  record: ISRSRecord, 
  field: string, 
  value: any
): ISRSRecord => {
  // Create updated record with new field value
  let updatedRecord: ISRSRecord;

  switch (field) {
    case 'startWork':
      updatedRecord = { ...record, startWork: value };
      break;
    case 'finishWork':
      updatedRecord = { ...record, finishWork: value };
      break;
    case 'lunch':
      updatedRecord = { ...record, lunch: value };
      break;
    default:
      updatedRecord = { ...record, [field]: value };
      break;
  }

  // Recalculate hours only if it's a time-related field
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