// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorCore.ts
import {
  ITimetableRow,
  IWeeklyStaffData,
  IDayInfo,
  IWeekInfo,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';
import { TimetableDataUtils } from './TimetableDataUtils';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Core processing logic for TimetableDataProcessor.
 * Handles detailed data transformation at the week and day levels.
 */
export class TimetableDataProcessorCore {

  /**
   * Обрабатывает недельные данные с полной поддержкой цветов отпусков и праздников
   * (Used by legacy processData)
   */
  public static processWeekDataWithLeaveColorsAndHolidays(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IWeeklyStaffData {
    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);

    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColorsAndHolidays(
        weekRecords,
        dayNum,
        week.weekStart,
        week.weekEnd,
        getLeaveTypeColor,
        holidayColor
      );
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);
    return weeklyData;
  }

  /**
   * Обрабатывает дневные данные с полной поддержкой цветов отпусков и праздников
   * (Used by processWeekDataWithLeaveColorsAndHolidays)
   */
  private static processDayDataWithLeaveColorsAndHolidays(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    const formattedContent = TimetableShiftCalculator.formatDayContent(shifts);
    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasHoliday = TimetableShiftCalculator.hasHolidays ? TimetableShiftCalculator.hasHolidays(shifts) : shifts.some(s => s.isHoliday);
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
    } else if (hasLeave && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
    }

    // Logging from original method can be re-added here if needed for debugging this specific path
    // console.log for hasHoliday / hasLeave was present in the original here

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0,
      leaveTypeColor,
      hasLeave,
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * НОВЫЙ МЕТОД: Обрабатывает недельные данные включая дни без смен, но с отметками праздников/отпусков
   * (Used by processDataByWeeks)
   */
  public static processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IWeeklyStaffData {
    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);
    // Original console.log for processing week can be here if needed

    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
        weekRecords,
        dayNum,
        week.weekStart,
        week.weekEnd,
        getLeaveTypeColor,
        holidayColor
      );
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);
    return weeklyData;
  }

  /**
   * НОВЫЙ МЕТОД: Обрабатывает дневные данные включая дни без смен, но с отметками праздников/отпусков
   * (Used by processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays)
   */
  private static processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    // Original console.log for processing day can be here

    const allDayRecords = weekRecords.filter(record => {
      const recordDate = new Date(record.Date);
      const recordDayNumber = TimetableShiftCalculator.getDayNumber(recordDate);
      const isCorrectDay = recordDayNumber === dayNumber;
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      return isCorrectDay && isInWeek;
    });
    // Original console.log for allDayRecords can be here

    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    let hasNonWorkHoliday = false;
    let hasNonWorkLeave = false;
    let nonWorkLeaveTypeId: string | undefined = undefined;
    let nonWorkLeaveTypeColor: string | undefined = undefined;

    allDayRecords.forEach(record => {
      const isHoliday = record.Holiday === 1;
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 &&
        !(new Date(record.ShiftDate1).getHours() === 0 && new Date(record.ShiftDate1).getMinutes() === 0 &&
          new Date(record.ShiftDate2).getHours() === 0 && new Date(record.ShiftDate2).getMinutes() === 0);
      
      // Original console.log for record details can be here

      if (!hasWorkTime) {
        if (isHoliday) {
          hasNonWorkHoliday = true;
          // Original console.log for non-work holiday found can be here
        }
        if (hasLeaveType) {
          hasNonWorkLeave = true;
          nonWorkLeaveTypeId = record.TypeOfLeaveID;
          if (getLeaveTypeColor && nonWorkLeaveTypeId) {
            nonWorkLeaveTypeColor = getLeaveTypeColor(nonWorkLeaveTypeId);
            // Original console.log for non-work leave type found can be here
          }
        }
      }
    });

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    if (!shifts.length && (hasNonWorkHoliday || hasNonWorkLeave)) {
      if (hasNonWorkHoliday) {
        formattedContent = "Holiday";
      } else if (hasNonWorkLeave) {
        formattedContent = "Leave";
      }
    }

    const workShiftsLeaveColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasWorkShiftsLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasWorkShiftsHoliday = TimetableShiftCalculator.hasHolidays ? TimetableShiftCalculator.hasHolidays(shifts) : shifts.some(s => s.isHoliday);

    const hasHoliday = hasWorkShiftsHoliday || hasNonWorkHoliday;
    const hasLeave = hasWorkShiftsLeave || hasNonWorkLeave;
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    let leaveTypeColor: string | undefined = undefined;

    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
      // Original console.log for applied HOLIDAY color can be here
    } else if (hasLeave) {
      leaveTypeColor = workShiftsLeaveColor || nonWorkLeaveTypeColor;
      if (leaveTypeColor) {
        finalCellColor = leaveTypeColor;
        // Original console.log for applied LEAVE color can be here
      }
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0 || hasNonWorkHoliday || hasNonWorkLeave,
      leaveTypeColor,
      hasLeave,
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * НОВЫЙ МЕТОД: Обработка недельных данных специально для Excel экспорта
   * (Used by processDataForExcelExport)
   */
  public static processWeekDataForExcelWithFullMarkers(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IWeeklyStaffData {
    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);
    // Original console.log for processing week for Excel can be here

    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataForExcelWithFullMarkers(
        weekRecords,
        dayNum,
        week.weekStart,
        week.weekEnd,
        getLeaveTypeColor,
        holidayColor
      );
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);
    return weeklyData;
  }

  /**
   * НОВЫЙ МЕТОД: Обработка дневных данных специально для Excel экспорта
   * (Used by processWeekDataForExcelWithFullMarkers)
   */
  private static processDayDataForExcelWithFullMarkers(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    // Original console.log for processing day for Excel can be here

    const shifts = TimetableShiftCalculatorCore.getShiftsAndMarkersForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    const totalMinutes = shifts.reduce((sum, shift) => {
      return shift.workMinutes > 0 ? sum + shift.workMinutes : sum;
    }, 0);
    const formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    //const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasHolidayMarkers = shifts.some(s => s.isHoliday && s.workMinutes === 0);
    const hasLeaveMarkers = shifts.some(s => s.typeOfLeaveId && s.workMinutes === 0);
    const hasHolidayInWorkShifts = shifts.some(s => s.isHoliday && s.workMinutes > 0);
    const hasLeaveInWorkShifts = shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);

    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasHoliday = TimetableShiftCalculator.hasHolidays ?
      TimetableShiftCalculator.hasHolidays(shifts) :
      shifts.some(s => s.isHoliday);
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    if (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) {
      finalCellColor = holidayColorFinal;
    } else if ((hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts) && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
    }

    // Original console.log for Excel export analysis can be here

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0,
      leaveTypeColor,
      hasLeave: hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts,
      hasHoliday: hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts,
      holidayColor: (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * НОВЫЙ МЕТОД: Подсчитывает количество праздников в недельных данных
   * (Used by processDataByWeeks in TimetableDataProcessor)
   */
  public static countHolidaysInWeekData(weeklyData: IWeeklyStaffData): number {
    let holidaysCount = 0;
    Object.values(weeklyData.days).forEach((day: IDayInfo) => {
      if (day.hasHoliday) {
        holidaysCount += day.shifts.filter(s => s.isHoliday).length;
        if (day.shifts.length === 0 && day.hasHoliday) {
          holidaysCount += 1;
        }
      }
    });
    return holidaysCount;
  }

  /**
   * Сортирует строки сотрудников (для старого формата ITimetableRow[])
   * (Used by legacy processData in TimetableDataProcessor)
   */
  public static sortStaffRows(rows: ITimetableRow[]): ITimetableRow[] {
    return rows.sort((a, b) => {
      if (a.isDeleted !== b.isDeleted) {
        return a.isDeleted ? 1 : -1;
      }
      if (a.hasPersonInfo !== b.hasPersonInfo) {
        return a.hasPersonInfo ? -1 : 1;
      }
      return a.staffName.localeCompare(b.staffName);
    });
  }
}