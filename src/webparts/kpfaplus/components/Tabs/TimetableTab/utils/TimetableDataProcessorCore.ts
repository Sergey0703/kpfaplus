// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorCore.ts
import {
  ITimetableRow,
  IWeeklyStaffData,
  IDayInfo,
  IWeekInfo,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableDataUtils } from './TimetableDataUtils';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IHoliday, HolidaysService } from '../../../../services/HolidaysService';

import { TimetableDataProcessorLeaveTypes } from './TimetableDataProcessorLeaveTypes';
import { TimetableDataProcessorUtils } from './TimetableDataProcessorUtils';

export class TimetableDataProcessorCore {

  /**
   * *** ОБНОВЛЕНО: Добавлена поддержка holidays ***
   */
  public static processWeekDataWithLeaveColorsAndHolidays(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
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
        holidayColor,
        holidays,
        holidaysService
      );
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);
    
    return weeklyData;
  }

  /**
   * *** ОБНОВЛЕНО: Добавлена поддержка holidays ***
   */
  public static processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
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
      const dayInfo = this.processDayDataIncludingNonWorkDays(
        weekRecords,
        dayNum,
        week.weekStart,
        week.weekEnd,
        getLeaveTypeColor,
        holidayColor,
        holidays,
        holidaysService
      );
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);
    
    return weeklyData;
  }

  /**
   * *** ОБНОВЛЕНО: Добавлена поддержка holidays ***
   */
  public static processWeekDataForExcelWithFullMarkers(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
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
      const dayInfo = this.processDayDataForExcel(
        weekRecords,
        dayNum,
        week.weekStart,
        week.weekEnd,
        getLeaveTypeColor,
        holidayColor,
        holidays,
        holidaysService
      );
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);
    
    return weeklyData;
  }

  /**
   * *** ОБНОВЛЕНО: Заменена логика holidays с поля Holiday на HolidaysService ***
   */
  private static processDayDataWithLeaveColorsAndHolidays(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    // *** ОБНОВЛЕНО: Передаем holidays в getShiftsForDay ***
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor,
      holidays,
      holidaysService
    );

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);
    
    const allDayRecords = TimetableDataProcessorUtils.getAllRecordsForDayEnhanced(weekRecords, dayNumber, weekStart, weekEnd);
    const leaveAnalysis = TimetableDataProcessorLeaveTypes.analyzeLeaveInfoFromRecordsEnhanced(allDayRecords, getLeaveTypeColor);

    let leaveTypeColor: string | undefined;
    
    if (shifts.length > 0) {
      leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
    }
    
    if (!leaveTypeColor && leaveAnalysis.leaveTypeColor) {
      leaveTypeColor = leaveAnalysis.leaveTypeColor;
    }

    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts) || leaveAnalysis.hasNonWorkLeave;
    
    // *** ОБНОВЛЕНО: Используем HolidaysService вместо поля Holiday ***
    const hasHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday) ||
      this.isDateHoliday(dayDate, holidays, holidaysService);
    
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    if (shifts.length === 0) {
      if (hasHoliday) {
        formattedContent = "Holiday";
      } else if (leaveAnalysis.hasNonWorkLeave && leaveAnalysis.leaveTypeTitle) {
        formattedContent = leaveAnalysis.leaveTypeTitle;
      }
    }

    let finalCellColor: string | undefined = undefined;
    
    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
    } else if (hasLeave && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0 || hasHoliday || leaveAnalysis.hasNonWorkLeave,
      leaveTypeColor,
      hasLeave,
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * *** ОБНОВЛЕНО: Заменена логика holidays с поля Holiday на HolidaysService ***
   */
  private static processDayDataIncludingNonWorkDays(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    const allDayRecords = TimetableDataProcessorUtils.getAllRecordsForDayEnhanced(weekRecords, dayNumber, weekStart, weekEnd);

    // *** ОБНОВЛЕНО: Передаем holidays в getShiftsForDay ***
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor,
      holidays,
      holidaysService
    );

    const leaveInfo = TimetableDataProcessorLeaveTypes.analyzeLeaveInfoFromRecordsEnhanced(allDayRecords, getLeaveTypeColor);
    
    // *** ОБНОВЛЕНО: Используем HolidaysService вместо поля Holiday ***
    const holidayInfo = this.analyzeHolidayInfoFromDate(dayDate, holidays, holidaysService);

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    if (!shifts.length) {
      if (holidayInfo.hasHoliday) {
        formattedContent = "Holiday";
      } else if (leaveInfo.hasNonWorkLeave && leaveInfo.leaveTypeTitle) {
        formattedContent = leaveInfo.leaveTypeTitle;
      }
    }

    const workShiftsLeaveColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
    const hasWorkShiftsLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasWorkShiftsHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday);

    const hasHoliday = hasWorkShiftsHoliday || holidayInfo.hasHoliday;
    const hasLeave = hasWorkShiftsLeave || leaveInfo.hasNonWorkLeave;
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    let leaveTypeColor: string | undefined = undefined;

    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
    } else if (hasLeave) {
      leaveTypeColor = workShiftsLeaveColor || leaveInfo.leaveTypeColor;
      if (leaveTypeColor) {
        finalCellColor = leaveTypeColor;
      }
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0 || holidayInfo.hasHoliday || leaveInfo.hasNonWorkLeave,
      leaveTypeColor,
      hasLeave,
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * *** ОБНОВЛЕНО: Заменена логика holidays с поля Holiday на HolidaysService ***
   */
  private static processDayDataForExcel(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    // *** ОБНОВЛЕНО: Передаем holidays в getShiftsForDay ***
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor,
      holidays,
      holidaysService
    );

    const allDayRecords = TimetableDataProcessorUtils.getAllRecordsForDayEnhanced(weekRecords, dayNumber, weekStart, weekEnd);
    const leaveInfo = TimetableDataProcessorLeaveTypes.analyzeLeaveInfoFromRecordsEnhanced(allDayRecords, getLeaveTypeColor);
    
    // *** ОБНОВЛЕНО: Используем HolidaysService вместо поля Holiday ***
    const holidayInfo = this.analyzeHolidayInfoFromDate(dayDate, holidays, holidaysService);

    const totalMinutes = shifts.reduce((sum, shift) => {
      return shift.workMinutes > 0 ? sum + shift.workMinutes : sum;
    }, 0);
    
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    if (shifts.length === 0) {
      if (holidayInfo.hasHoliday) {
        formattedContent = 'Holiday';
      } else if (leaveInfo.hasNonWorkLeave && leaveInfo.leaveTypeTitle) {
        formattedContent = leaveInfo.leaveTypeTitle;
      }
    }

    const hasHolidayInWorkShifts = shifts.some(s => s.isHoliday && s.workMinutes > 0);
    const hasLeaveInWorkShifts = shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);
    const hasHolidayMarkers = shifts.some(s => s.isHoliday && s.workMinutes === 0) || holidayInfo.hasHoliday;
    const hasLeaveMarkers = shifts.some(s => s.typeOfLeaveId && s.workMinutes === 0) || leaveInfo.hasNonWorkLeave;

    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor) || leaveInfo.leaveTypeColor;
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts) || leaveInfo.hasNonWorkLeave;
    const hasHoliday = TimetableShiftCalculator.hasHolidays ?
      TimetableShiftCalculator.hasHolidays(shifts) :
      shifts.some(s => s.isHoliday) || holidayInfo.hasHoliday;
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    if (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) {
      finalCellColor = holidayColorFinal;
    } else if ((hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts) && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0 || leaveInfo.hasNonWorkLeave || holidayInfo.hasHoliday,
      leaveTypeColor,
      hasLeave: hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts || leaveInfo.hasNonWorkLeave,
      hasHoliday: hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts,
      holidayColor: (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Проверяет является ли дата праздником через HolidaysService ***
   */
  private static isDateHoliday(
    date: Date, 
    holidays?: IHoliday[], 
    holidaysService?: HolidaysService
  ): boolean {
    if (!holidays || holidays.length === 0) {
      return false;
    }

    // Используем HolidaysService для проверки если доступен
    if (holidaysService) {
      return holidaysService.isHoliday(date, holidays);
    }

    // Fallback: простая проверка по дате
    const dateString = this.formatDateForComparison(date);
    return holidays.some(holiday => 
      this.formatDateForComparison(holiday.date) === dateString
    );
  }

  /**
   * *** НОВЫЙ МЕТОД: Анализирует информацию о празднике для даты ***
   */
  private static analyzeHolidayInfoFromDate(
    date: Date,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): {
    hasHoliday: boolean;
    holidayInfo?: IHoliday;
  } {
    const hasHoliday = this.isDateHoliday(date, holidays, holidaysService);
    
    let holidayInfo: IHoliday | undefined = undefined;
    if (hasHoliday && holidays && holidaysService) {
      holidayInfo = holidaysService.getHolidayInfo(date, holidays);
    }

    return {
      hasHoliday,
      holidayInfo
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Форматирует дату для сравнения ***
   */
  private static formatDateForComparison(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }

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

  public static countHolidaysInWeekData(weeklyData: IWeeklyStaffData): number {
    return TimetableDataProcessorUtils.countHolidaysInWeekData(weeklyData);
  }
}