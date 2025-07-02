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

/**
 * ОБНОВЛЕНО: Поддержка Date-only Holiday формата
 * Удалена зависимость от поля Holiday в StaffRecord - используется только HolidaysService
 */
export class TimetableDataProcessorCore {

  /**
   * ОБНОВЛЕНО: Добавлена поддержка Date-only holidays
   */
  public static processWeekDataWithLeaveColorsAndHolidays(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IWeeklyStaffData {
    console.log('[TimetableDataProcessorCore] *** PROCESSING WEEK DATA WITH DATE-ONLY HOLIDAYS ***', {
      weekNum: week.weekNum,
      weekStart: week.weekStart.toLocaleDateString(),
      weekEnd: week.weekEnd.toLocaleDateString(),
      recordsCount: staffRecords.length,
      holidaysCount: holidays?.length || 0
    });

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
    
    console.log('[TimetableDataProcessorCore] *** WEEK DATA PROCESSED WITH DATE-ONLY HOLIDAYS ***', {
      weekNum: week.weekNum,
      totalMinutes: weeklyData.totalWeekMinutes,
      formattedTotal: weeklyData.formattedWeekTotal
    });
    
    return weeklyData;
  }

  /**
   * ОБНОВЛЕНО: Добавлена поддержка Date-only holidays включая дни без смен
   */
  public static processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IWeeklyStaffData {
    console.log('[TimetableDataProcessorCore] *** PROCESSING WEEK DATA INCLUDING NON-WORK DAYS WITH DATE-ONLY HOLIDAYS ***');

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
   * ОБНОВЛЕНО: Специальная обработка для Excel экспорта с полными отметками Date-only holidays
   */
  public static processWeekDataForExcelWithFullMarkers(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IWeeklyStaffData {
    console.log('[TimetableDataProcessorCore] *** PROCESSING WEEK DATA FOR EXCEL WITH DATE-ONLY HOLIDAYS ***');

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
   * ИСПРАВЛЕНО: Основной метод обработки дня с Date-only Holiday поддержкой
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
    
    console.log('[TimetableDataProcessorCore] *** PROCESSING DAY WITH DATE-ONLY HOLIDAYS ***', {
      dayNumber,
      dayDate: dayDate.toLocaleDateString(),
      dayDateISO: dayDate.toISOString(),
      holidaysAvailable: holidays?.length || 0
    });
    
    // Получаем смены для дня с Date-only Holiday поддержкой
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
    
    // ИСПРАВЛЕНО: Используем Date-only Holiday detection
    const hasHoliday = this.isDateHolidayDateOnly(dayDate, holidays, holidaysService) ||
      (TimetableShiftCalculator.hasHolidays ? TimetableShiftCalculator.hasHolidays(shifts) : shifts.some(s => s.isHoliday));
    
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

    const dayInfo: IDayInfo = {
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

    console.log('[TimetableDataProcessorCore] *** DAY PROCESSED WITH DATE-ONLY HOLIDAYS ***', {
      dayNumber,
      hasData: dayInfo.hasData,
      hasHoliday: dayInfo.hasHoliday,
      hasLeave: dayInfo.hasLeave,
      shiftsCount: shifts.length,
      formattedContent: dayInfo.formattedContent
    });

    return dayInfo;
  }

  /**
   * ИСПРАВЛЕНО: Обработка дня включая дни без смен с Date-only Holiday поддержкой
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

    // Получаем смены с Date-only Holiday поддержкой
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
    
    // ИСПРАВЛЕНО: Date-only Holiday анализ
    const holidayInfo = this.analyzeHolidayInfoFromDateOnly(dayDate, holidays, holidaysService);

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
   * ИСПРАВЛЕНО: Специальная обработка для Excel с полными отметками Date-only holidays
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
    
    // Получаем смены с Date-only Holiday поддержкой
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
    
    // ИСПРАВЛЕНО: Date-only Holiday анализ для Excel
    const holidayInfo = this.analyzeHolidayInfoFromDateOnly(dayDate, holidays, holidaysService);

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
   * НОВЫЙ МЕТОД: Проверяет является ли дата праздником используя Date-only формат
   */
  private static isDateHolidayDateOnly(
    date: Date, 
    holidays?: IHoliday[], 
    holidaysService?: HolidaysService
  ): boolean {
    if (!holidays || holidays.length === 0) {
      console.log('[TimetableDataProcessorCore] No holidays available for check');
      return false;
    }

    console.log('[TimetableDataProcessorCore] *** CHECKING DATE-ONLY HOLIDAY ***', {
      checkDate: date.toLocaleDateString(),
      checkDateISO: date.toISOString(),
      holidaysCount: holidays.length
    });

    // Используем HolidaysService для проверки если доступен
    if (holidaysService) {
      const isHoliday = holidaysService.isHoliday(date, holidays);
      console.log('[TimetableDataProcessorCore] Holiday check via service:', {
        date: date.toLocaleDateString(),
        isHoliday
      });
      return isHoliday;
    }

    // Fallback: Date-only сравнение без времени
    const checkDateStr = this.formatDateForComparisonDateOnly(date);
    const isHoliday = holidays.some(holiday => {
      const holidayDateStr = this.formatDateForComparisonDateOnly(holiday.date);
      const matches = holidayDateStr === checkDateStr;
      
      if (matches) {
        console.log('[TimetableDataProcessorCore] Holiday match found:', {
          checkDate: checkDateStr,
          holidayDate: holidayDateStr,
          holidayTitle: holiday.title
        });
      }
      
      return matches;
    });

    console.log('[TimetableDataProcessorCore] Date-only holiday check result:', {
      date: checkDateStr,
      isHoliday,
      holidaysChecked: holidays.length
    });

    return isHoliday;
  }

  /**
   * НОВЫЙ МЕТОД: Анализирует информацию о празднике для Date-only формата
   */
  private static analyzeHolidayInfoFromDateOnly(
    date: Date,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): {
    hasHoliday: boolean;
    holidayInfo?: IHoliday;
  } {
    const hasHoliday = this.isDateHolidayDateOnly(date, holidays, holidaysService);
    
    let holidayInfo: IHoliday | undefined = undefined;
    if (hasHoliday && holidays && holidaysService) {
      holidayInfo = holidaysService.getHolidayInfo(date, holidays);
    } else if (hasHoliday && holidays) {
      // Fallback поиск без service
      const dateStr = this.formatDateForComparisonDateOnly(date);
      holidayInfo = holidays.find(h => 
        this.formatDateForComparisonDateOnly(h.date) === dateStr
      );
    }

    return {
      hasHoliday,
      holidayInfo
    };
  }

  /**
   * НОВЫЙ МЕТОД: Форматирует дату для Date-only сравнения
   */
  private static formatDateForComparisonDateOnly(date: Date): string {
    // ИСПРАВЛЕНО: Используем локальные компоненты даты без часовых поясов
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * Сортирует строки сотрудников
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

  /**
   * Подсчитывает праздники в недельных данных
   */
  public static countHolidaysInWeekData(weeklyData: IWeeklyStaffData): number {
    return TimetableDataProcessorUtils.countHolidaysInWeekData(weeklyData);
  }
}