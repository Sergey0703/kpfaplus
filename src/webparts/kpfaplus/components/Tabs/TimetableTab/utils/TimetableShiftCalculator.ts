// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculator.ts
import {
  IShiftCalculationParams,
  IShiftCalculationResult,
  IShiftInfo
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { TimetableTimeUtils } from './TimetableTimeUtils'; // Import time utilities
import { TimetableLeaveUtils } from './TimetableLeaveUtils'; // Import leave/styling utilities
import * as React from 'react'; // Import React for CSSProperties

/**
 * Калькулятор смен и рабочего времени
 * Реплицирует логику из Power Apps формул FormatDayShifts, CalculateDayMinutes и др.
 * ОБНОВЛЕНО: Поддержка цветов отпусков
 *
 * Этот файл содержит основную логику расчета смен и их обработки.
 * Вспомогательные функции по работе с датой/временем и отпусками вынесены в отдельные утилиты.
 * Все публичные методы из утилит переэкспортируются классом TimetableShiftCalculator
 * для сохранения обратной совместимости API.
 */
export class TimetableShiftCalculator {

  /**
   * Рассчитывает рабочие минуты для одной смены
   * ИСПРАВЛЕНО: Новый формат смены без пробела и в формате (HH:MM)
   * ОБНОВЛЕНО: Поддержка информации о типе отпуска
   */
  public static calculateShiftMinutes(params: IShiftCalculationParams): IShiftCalculationResult {
    const {
      startTime,
      endTime,
      lunchStart,
      lunchEnd,
      timeForLunch,
      typeOfLeaveId,
      typeOfLeaveTitle,
      typeOfLeaveColor
    } = params;

    console.log('[TimetableShiftCalculator] Calculating shift:', {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      lunchStart: lunchStart?.toISOString(),
      lunchEnd: lunchEnd?.toISOString(),
      timeForLunch,
      typeOfLeaveId,
      typeOfLeaveColor
    });

    // Проверяем на нулевые времена (00:00)
    const isStartZero = TimetableTimeUtils.isTimeZero(startTime);
    const isEndZero = TimetableTimeUtils.isTimeZero(endTime);

    // Если оба времени нулевые, нет рабочего времени
    if (isStartZero && isEndZero) {
      return {
        workMinutes: 0,
        formattedTime: TimetableTimeUtils.formatMinutesToHours(0), // Should be "0h 00m" for total line
        formattedShift: "00:00-00:00(0:00)",
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor
      };
    }

    // Рассчитываем общее время смены с учетом перехода через полночь
    const totalShiftMinutes = TimetableTimeUtils.calculateDurationMinutes(startTime, endTime);


    // Рассчитываем время обеда
    let lunchMinutes = 0;

    // Приоритет у timeForLunch если доступно и больше 0
    if (timeForLunch && timeForLunch > 0) {
      lunchMinutes = timeForLunch;
      console.log('[TimetableShiftCalculator] Using timeForLunch:', timeForLunch);
    } else if (lunchStart && lunchEnd) {
      // Рассчитываем время обеда из ShiftDate3 и ShiftDate4
      const isLunchStartZero = TimetableTimeUtils.isTimeZero(lunchStart);
      const isLunchEndZero = TimetableTimeUtils.isTimeZero(lunchEnd);

      if (!isLunchStartZero || !isLunchEndZero) {
         // Calculate lunch duration. Assuming lunch is always within a single day cycle.
         const lunchStartMinutes = lunchStart.getHours() * 60 + lunchStart.getMinutes();
         const lunchEndMinutes = lunchEnd.getHours() * 60 + lunchEnd.getMinutes();

         if (lunchEndMinutes >= lunchStartMinutes) {
             lunchMinutes = lunchEndMinutes - lunchStartMinutes;
              console.log('[TimetableShiftCalculator] Using calculated lunch time:', lunchMinutes);
         } else if (lunchEndMinutes < lunchStartMinutes) {
             // Lunch ends before it starts on the same day - this is likely an error in source data
             console.warn('[TimetableShiftCalculator] Lunch ends before it starts (treated as 0 minutes):', {lunchStart, lunchEnd});
             lunchMinutes = 0; // Treat as 0 minutes rather than assuming overnight lunch
         }
      }
    }

    // Вычитаем время обеда из общего времени смены
    const workMinutes = Math.max(0, totalShiftMinutes - lunchMinutes);

    // formattedTime is typically used for the "Total" line,
    // which should be in the old "Hh MMm" format.
    const formattedTotalLineTime = TimetableTimeUtils.formatMinutesToHours(workMinutes);

     // formattedShift is for the individual shift display (e.g., "10:00-18:00(8:00)")
    const startTimeStr = TimetableTimeUtils.formatTime(startTime);
    const endTimeStr = TimetableTimeUtils.formatTime(endTime);
     // Use HH:MM format for shift duration
    const formattedWorkTime = TimetableTimeUtils.formatMinutesToHoursMinutes(workMinutes);
    const formattedShift = `${startTimeStr}-${endTimeStr}(${formattedWorkTime})`;


    console.log('[TimetableShiftCalculator] Calculated result:', {
      totalShiftMinutes,
      lunchMinutes,
      workMinutes,
      formattedTotalLineTime, // Renamed for clarity
      formattedShift,
      typeOfLeaveColor
    });


    return {
      workMinutes,
      formattedTime: formattedTotalLineTime, // Keep the old name in the interface for backward compatibility if needed
      formattedShift,
      typeOfLeaveId,
      typeOfLeaveTitle,
      typeOfLeaveColor
    };
  }

  /**
   * Обрабатывает записи StaffRecord в IShiftInfo
   * Реплицирует логику сортировки и обработки смен из Power Apps
   * ОБНОВЛЕНО: Поддержка информации о типах отпусков
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
     if (records.length === 0) {
      return [];
    }

    // Фильтруем и сортируем записи (аналогично SortByColumns в Power Apps)
    const validRecords = records.filter(record => {
      // Исключаем записи без времен или с нулевыми временами
      if (!record.ShiftDate1 || !record.ShiftDate2) {
        console.log(`[TimetableShiftCalculator] Skipping record ${record.ID}: missing ShiftDate1 or ShiftDate2`);
        return false;
      }

      const start = new Date(record.ShiftDate1);
      const end = new Date(record.ShiftDate2);

      // Проверяем валидность дат
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.log(`[TimetableShiftCalculator] Skipping record ${record.ID}: invalid dates`);
        return false;
      }

      const startStr = TimetableTimeUtils.formatTime(start);
      const endStr = TimetableTimeUtils.formatTime(end);

      // Исключаем записи где оба времени 00:00 (считаем это отсутствием смены)
      if (startStr === "00:00" && endStr === "00:00") {
        console.log(`[TimetableShiftCalculator] Skipping record ${record.ID}: both times are 00:00`);
        return false;
      }

       // Ensure ShiftDate1 and ShiftDate2 are not the same date AND time unless they are 00:00 (handled above).
       // A shift must have duration. Allowing same start/end time (like 10:00 - 10:00) is 0 duration.
       // Let's check this condition too for validity.
        if (start.getTime() === end.getTime()) {
             console.log(`[TimetableShiftCalculator] Skipping record ${record.ID}: Start and end times are the same (${startStr}).`);
             return false;
        }


      return true;
    });

    console.log(`[TimetableShiftCalculator] Valid records: ${validRecords.length}/${records.length}`);

    if (validRecords.length === 0) {
      return [];
    }

    // Soring by ShiftDate1 ascending (analogous to Power Apps SortByColumns)
    // Note: If ShiftDate1 includes date+time, this sorts correctly.
    // If ShiftDate1 is just time, sorting needs to be on time value only.
    // Assuming ShiftDate1 is date+time and sorting by full datetime is intended.
    const sortedRecords = validRecords.sort((a, b) => {
      // Assuming ShiftDate1 are valid Date strings/objects after filtering
      const aStart = new Date(a.ShiftDate1!).getTime();
      const bStart = new Date(b.ShiftDate1!).getTime();
      return aStart - bStart;
    });

    // Преобразуем в IShiftInfo
    const shifts: IShiftInfo[] = sortedRecords.map(record => {
       // Ensure these are treated as Dates, which they should be if valid
      const startTime = new Date(record.ShiftDate1!);
      const endTime = new Date(record.ShiftDate2!);
      const lunchStart = record.ShiftDate3 ? new Date(record.ShiftDate3) : undefined;
      const lunchEnd = record.ShiftDate4 ? new Date(record.ShiftDate4) : undefined;
      const timeForLunch = record.TimeForLunch || 0;

       // Check lunch dates validity and nullify if invalid
      const validLunchStart = (lunchStart && !isNaN(lunchStart.getTime())) ? lunchStart : undefined;
      const validLunchEnd = (lunchEnd && !isNaN(lunchEnd.getTime())) ? lunchEnd : undefined;

      if (lunchStart && !validLunchStart) {
         console.warn(`[TimetableShiftCalculator] Invalid ShiftDate3 in record ${record.ID}: ${record.ShiftDate3}`);
      }
       if (lunchEnd && !validLunchEnd) {
         console.warn(`[TimetableShiftCalculator] Invalid ShiftDate4 in record ${record.ID}: ${record.ShiftDate4}`);
      }


      // ДОБАВЛЕНО: Обработка типа отпуска
      let typeOfLeaveId: string | undefined = undefined;
      let typeOfLeaveTitle: string | undefined = undefined;
      let typeOfLeaveColor: string | undefined = undefined;

      if (record.TypeOfLeaveID) {
        typeOfLeaveId = record.TypeOfLeaveID;

        // Получаем цвет типа отпуска если доступна функция
        if (getLeaveTypeColor) {
          typeOfLeaveColor = getLeaveTypeColor(typeOfLeaveId);
        }

        // Получаем название типа отпуска если доступно
        // TypeOfLeave is a lookup field, expecting TypeOfLeave.Title
        // Check if TypeOfLeave is an object and has a Title property
        if (record.TypeOfLeave && typeof record.TypeOfLeave === 'object' && 'Title' in record.TypeOfLeave && record.TypeOfLeave.Title) {
          typeOfLeaveTitle = record.TypeOfLeave.Title;
        } else if (typeOfLeaveId) {
             // Sometimes the lookup might just be the ID string if not expanded,
             // or the Title might be missing/null even if the lookup object exists.
             // Use a fallback title if ID is present but title is not found clearly.
             console.warn(`[TimetableShiftCalculator] TypeOfLeave title missing for record ${record.ID} with TypeOfLeaveID ${typeOfLeaveId}. Full TypeOfLeave value:`, record.TypeOfLeave);
             typeOfLeaveTitle = `Leave ID ${typeOfLeaveId}`; // Fallback title
        }


        if (typeOfLeaveColor) {
          console.log(`[TimetableShiftCalculator] Applied leave type ${typeOfLeaveId} with color ${typeOfLeaveColor} to shift ${record.ID}`);
        }
      }

      const calculation = TimetableShiftCalculator.calculateShiftMinutes({
        startTime,
        endTime,
        lunchStart: validLunchStart, // Pass validated dates
        lunchEnd: validLunchEnd,     // Pass validated dates
        timeForLunch,
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor
      });

      return {
        recordId: record.ID,
        startTime,
        endTime,
        lunchStart: validLunchStart, // Store validated dates
        lunchEnd: validLunchEnd,     // Store validated dates
        timeForLunch,
        workMinutes: calculation.workMinutes,
        formattedShift: calculation.formattedShift,
        typeOfLeaveId: calculation.typeOfLeaveId,
        typeOfLeaveTitle: calculation.typeOfLeaveTitle,
        typeOfLeaveColor: calculation.typeOfLeaveColor
      };
    });

    console.log('[TimetableShiftCalculator] Processed shifts:', shifts.length);

    // Log sample shifts for debugging
    if (shifts.length > 0) {
      console.log('[TimetableShiftCalculator] Sample shifts:');
      shifts.slice(0, 3).forEach((shift, index) => {
        console.log(`  Shift ${index + 1}: ${shift.formattedShift} (${shift.workMinutes} min)${shift.typeOfLeaveColor ? ` - Leave color: ${shift.typeOfLeaveColor}` : ''}`);
      });
    }

    return shifts;
  }

  /**
   * Formats the content for a single day cell.
   * Replicates FormatDayShifts logic from Power Apps.
   */
  public static formatDayContent(shifts: IShiftInfo[]): string {
     if (shifts.length === 0) {
      return "";
    }

    // Format shift lines (analogous to Concat in Power Apps)
    const shiftLines = shifts.map(shift => shift.formattedShift);

    let content = shiftLines.join(";\n");

    // If there are shifts, add the total line.
    if (shifts.length > 0) {
        const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
        // Use the format specifically for totals (Hh MMm)
        const totalFormatted = TimetableTimeUtils.formatMinutesToHours(totalMinutes);
        // Add a newline before "Total:" only if there are multiple shifts,
        // otherwise append directly after the single shift line.
        content += `${shifts.length > 1 ? '\n' : ''}Total: ${totalFormatted}`;
    }

    return content;
  }


  /**
   * Calculates total weekly hours for an employee.
   * Replicates CalculateWeeklyHours from Power Apps.
   */
  public static calculateWeeklyHours(
    allShifts: IShiftInfo[]
  ): { totalMinutes: number; formattedTotal: string } {
    const totalMinutes = allShifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
     // Use the format specifically for totals (Hh MMm)
    const formattedTotal = TimetableTimeUtils.formatMinutesToHours(totalMinutes);

    return {
      totalMinutes,
      formattedTotal: ` ${formattedTotal}` // Add leading space like in Power Apps
    };
  }

  /**
   * Retrieves shifts for a specific day of the week within a given week range from records.
   * UPDATED: Supports getting leave type color.
   */
  public static getShiftsForDay(
    records: IStaffRecord[],
    dayNumber: number, // 1=Sunday, 2=Monday, etc.
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    // Normalize weekStart and weekEnd to start/end of day for robust comparison
    // This normalization is helpful for filtering records based on Date field which might have time components
    const startOfWeek = new Date(weekStart);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(weekEnd);
    endOfWeek.setHours(23, 59, 59, 999);


    // Filter records for the specific day number within the given week range
    const dayRecords = records.filter(record => {
      if (!record.Date) {
         console.warn(`[TimetableShiftCalculator] Skipping record ${record.ID}: missing Date field.`);
         return false;
      }
      const recordDate = new Date(record.Date);

      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculator] Invalid date in record ${record.ID}: ${record.Date}`);
        return false;
      }

      const recordDayNumber = TimetableTimeUtils.getDayNumber(recordDate);

      // Check if the record date is within the week range (inclusive)
      const isInWeek = recordDate >= startOfWeek && recordDate <= endOfWeek;
      const isCorrectDay = recordDayNumber === dayNumber;

      if (isCorrectDay && isInWeek) {
        // console.log(`[TimetableShiftCalculator] Found record for day ${TimetableTimeUtils.getDayName(dayNumber)} (${dayNumber}): ${record.ID} on ${recordDate.toLocaleDateString()}`);
      } else {
         // Optional: Log why a record was excluded
         // console.log(`[TimetableShiftCalculator] Skipping record for day ${TimetableTimeUtils.getDayName(dayNumber)} (${dayNumber}): ${record.ID} on ${recordDate.toLocaleDateString()} - IsCorrectDay: ${isCorrectDay}, IsInWeek: ${isInWeek}`);
      }

      return isCorrectDay && isInWeek;
    });

     console.log(`[TimetableShiftCalculator] Found ${dayRecords.length} records for day ${TimetableTimeUtils.getDayName(dayNumber)} (${dayNumber}) within week ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);

    // Process the filtered records to get IShiftInfo objects
    return TimetableShiftCalculator.processStaffRecordsToShifts(dayRecords, getLeaveTypeColor);
  }


  // --- RE-EXPORTED METHODS FROM UTILITIES ---
  // These methods simply proxy the calls to the correct utility class
  // to maintain the original public API of TimetableShiftCalculator.

  // Re-exporting TimetableTimeUtils methods
  public static formatMinutesToHoursMinutes(totalMinutes: number): string {
    return TimetableTimeUtils.formatMinutesToHoursMinutes(totalMinutes);
  }

  public static formatMinutesToHours(totalMinutes: number): string {
    return TimetableTimeUtils.formatMinutesToHours(totalMinutes);
  }

  public static formatTime(date: Date): string {
    return TimetableTimeUtils.formatTime(date);
  }

  public static formatTimeWithSeconds(date: Date): string {
    return TimetableTimeUtils.formatTimeWithSeconds(date);
  }

  public static parseTimeStringToMinutes(timeString: string): number {
    return TimetableTimeUtils.parseTimeStringToMinutes(timeString);
  }

  public static createTimeForDate(baseDate: Date, hours: number, minutes: number): Date {
    return TimetableTimeUtils.createTimeForDate(baseDate, hours, minutes);
  }

  public static isTimeZero(date: Date): boolean {
    return TimetableTimeUtils.isTimeZero(date);
  }

  public static isValidWorkTime(startTime: Date, endTime: Date): boolean {
    return TimetableTimeUtils.isValidWorkTime(startTime, endTime);
  }

  public static getDayNumber(date: Date): number {
    return TimetableTimeUtils.getDayNumber(date);
  }

  public static getDayName(dayNumber: number): string {
    return TimetableTimeUtils.getDayName(dayNumber);
  }

  public static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    return TimetableTimeUtils.calculateDurationMinutes(startTime, endTime);
  }

   public static formatDuration(minutes: number): string {
       return TimetableTimeUtils.formatDuration(minutes);
   }

    public static minutesToDecimalHours(minutes: number): number {
        return TimetableTimeUtils.minutesToDecimalHours(minutes);
    }

    public static decimalHoursToMinutes(hours: number): number {
        return TimetableTimeUtils.decimalHoursToMinutes(hours);
    }

     public static formatTime12Hour(date: Date): string {
        return TimetableTimeUtils.formatTime12Hour(date);
     }


  // Re-exporting TimetableLeaveUtils methods
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): Array<{
    id: string;
    title: string; // Corrected signature here too
    color: string;
    count: number;
  }> {
    return TimetableLeaveUtils.getUniqueLeaveTypes(shifts);
  }

  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return TimetableLeaveUtils.hasLeaveTypes(shifts);
  }

  public static getDominantLeaveColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableLeaveUtils.getDominantLeaveColor(shifts);
  }

  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    return TimetableLeaveUtils.formatLeaveInfo(shifts);
  }

  public static getFirstLeaveColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableLeaveUtils.getFirstLeaveColor(shifts);
  }

  public static hasSpecificLeaveType(shifts: IShiftInfo[], leaveTypeId: string): boolean {
    return TimetableLeaveUtils.hasSpecificLeaveType(shifts, leaveTypeId);
  }

  public static getAllLeaveColors(shifts: IShiftInfo[]): string[] {
    return TimetableLeaveUtils.getAllLeaveColors(shifts);
  }

   public static createLeaveColorsGradient(shifts: IShiftInfo[]): string | undefined {
        return TimetableLeaveUtils.createLeaveColorsGradient(shifts);
   }

  public static getLeaveTypesStatistics(shifts: IShiftInfo[]): {
    totalShifts: number;
    totalWorkMinutes: number;
    averageShiftMinutes: number;
    shortestShiftMinutes: number;
    longestShiftMinutes: number;
    formattedStatistics: string;
    shiftsWithLeave: number;
    leaveTypes: string[];
  } {
     // Recalculate main statistics here (or call a combined utility if one existed)
    const totalShifts = shifts.length;
    const workMinutes = shifts.map(s => s.workMinutes);
    const totalWorkMinutes = workMinutes.reduce((sum, min) => sum + min, 0);
    const averageShiftMinutes = totalShifts > 0 ? Math.round(totalWorkMinutes / totalShifts) : 0;
    const shortestShiftMinutes = totalShifts > 0 ? Math.min(...workMinutes) : 0;
    const longestShiftMinutes = totalShifts > 0 ? Math.max(...workMinutes) : 0;


    // Get leave specific stats from the utility
    const leaveStats = TimetableLeaveUtils.getLeaveTypesStatistics(shifts);

    const formattedStatistics = [
      `${totalShifts} shifts`,
      `Total: ${TimetableTimeUtils.formatMinutesToHours(totalWorkMinutes)}`,
      `Avg: ${TimetableTimeUtils.formatMinutesToHours(averageShiftMinutes)}`,
      totalShifts > 0 ? `Range: ${TimetableTimeUtils.formatMinutesToHours(shortestShiftMinutes)} - ${TimetableTimeUtils.formatMinutesToHours(longestShiftMinutes)}` : '',
      leaveStats.totalShiftsWithLeave > 0 ? `Leave: ${leaveStats.totalShiftsWithLeave}` : ''
    ].filter(s => s).join(', ');


    return {
      totalShifts,
      totalWorkMinutes,
      averageShiftMinutes,
      shortestShiftMinutes,
      longestShiftMinutes,
      formattedStatistics,
      shiftsWithLeave: leaveStats.totalShiftsWithLeave,
       // Fix noImplicitAny by typing 'lt'
      leaveTypes: leaveStats.leaveTypeBreakdown.map((lt: { title: string }) => lt.title) // Return just titles in this array
    };
  }


  public static doShiftsOverlap(shift1: IShiftInfo, shift2: IShiftInfo): boolean {
      return TimetableLeaveUtils.doShiftsOverlap(shift1, shift2);
  }

  public static findOverlappingShifts(shifts: IShiftInfo[]): IShiftInfo[][] {
       return TimetableLeaveUtils.findOverlappingShifts(shifts);
  }

   // The return type here must match TimetableLeaveUtils.createLeaveCellStyles
   public static createLeaveCellStyles(shifts: IShiftInfo[]): React.CSSProperties {
        return TimetableLeaveUtils.createLeaveCellStyles(shifts);
   }

    public static getTextColorForBackground(backgroundColor: string): string {
        return TimetableLeaveUtils.getTextColorForBackground(backgroundColor);
    }

    // This method proxies the call to the public static method in TimetableLeaveUtils.
   public static applyColorSchemeToShifts(shifts: IShiftInfo[]): Array<IShiftInfo & {
    colorScheme: {
      backgroundColor: string;
      textColor: string;
      borderColor: string;
    }
  }> {
       return TimetableLeaveUtils.applyColorSchemeToShifts(shifts);
   }
}