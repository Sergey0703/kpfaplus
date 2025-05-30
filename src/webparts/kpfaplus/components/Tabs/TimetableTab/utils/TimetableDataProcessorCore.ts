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
 * FIXED: Proper preservation of leave type information for non-work days
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
   * FIXED METHOD: Обрабатывает недельные данные включая дни без смен, но с отметками праздников/отпусков
   * Версия 3.3: ИСПРАВЛЕНО сохранение информации о типах отпусков
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
    
    console.log(`[TimetableDataProcessorCore] Processing week ${week.weekNum} with enhanced leave type preservation`);

    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDaysFixed(
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

  // ИСПРАВЛЕННЫЙ МЕТОД для TimetableDataProcessorCore.ts
// Заменить существующий метод processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDays

/**
 * ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ МЕТОД: Обрабатывает дневные данные включая дни без смен
 * ВЕРСИЯ 3.5: ИСПРАВЛЕНО получение полных названий типов отпусков и применение цветов
 */
private static processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDaysFixed(
  weekRecords: IStaffRecord[],
  dayNumber: number,
  weekStart: Date,
  weekEnd: Date,
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
  holidayColor?: string
): IDayInfo {
  const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
  
  // Получаем ВСЕ записи для этого дня (не только с рабочим временем)
  const allDayRecords = weekRecords.filter(record => {
    const recordDate = new Date(record.Date);
    const recordDayNumber = TimetableShiftCalculator.getDayNumber(recordDate);
    const isCorrectDay = recordDayNumber === dayNumber;
    const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
    return isCorrectDay && isInWeek;
  });

  console.log(`[TimetableDataProcessorCore] Day ${dayNumber}: Found ${allDayRecords.length} records`);

  // Получаем обычные смены (с рабочим временем)
  const shifts = TimetableShiftCalculator.getShiftsForDay(
    weekRecords,
    dayNumber,
    weekStart,
    weekEnd,
    getLeaveTypeColor
  );

  // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Расширенный анализ записей без рабочего времени ***
  let hasNonWorkHoliday = false;
  let hasNonWorkLeave = false;
  let nonWorkLeaveTypeId: string | undefined = undefined;
  let nonWorkLeaveTypeTitle: string | undefined = undefined;
  let nonWorkLeaveTypeColor: string | undefined = undefined;
  //let nonWorkLeaveRecord: IStaffRecord | undefined = undefined;

  // Анализируем ВСЕ записи дня для поиска типов отпусков
  allDayRecords.forEach(record => {
    const isHoliday = record.Holiday === 1;
    const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
    const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 &&
      !(new Date(record.ShiftDate1).getHours() === 0 && new Date(record.ShiftDate1).getMinutes() === 0 &&
        new Date(record.ShiftDate2).getHours() === 0 && new Date(record.ShiftDate2).getMinutes() === 0);
    
    console.log(`[TimetableDataProcessorCore] Record ${record.ID} analysis:`, {
      hasWorkTime,
      hasHoliday: isHoliday,
      hasLeave: hasLeaveType,
      leaveTypeId: record.TypeOfLeaveID,
      leaveTypeObject: record.TypeOfLeave,
      leaveTypeTitle: record.TypeOfLeave?.Title
    });

    // Анализируем записи БЕЗ рабочего времени
    if (!hasWorkTime) {
      if (isHoliday) {
        hasNonWorkHoliday = true;
        console.log(`[TimetableDataProcessorCore] Found non-work holiday in day ${dayNumber}`);
      }
      if (hasLeaveType) {
        hasNonWorkLeave = true;
        nonWorkLeaveTypeId = record.TypeOfLeaveID;
    //    nonWorkLeaveRecord = record;
        
        // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное получение названия типа отпуска ***
        console.log(`[TimetableDataProcessorCore] *** ANALYZING LEAVE TYPE DATA ***`, {
          leaveTypeId: record.TypeOfLeaveID,
          typeOfLeaveObject: record.TypeOfLeave,
          typeOfLeaveTitle: record.TypeOfLeave?.Title,
          hasTypeOfLeaveObject: !!record.TypeOfLeave
        });
        
        // Способ 1: Из связанного объекта TypeOfLeave (самый надежный)
        if (record.TypeOfLeave && record.TypeOfLeave.Title) {
          nonWorkLeaveTypeTitle = record.TypeOfLeave.Title;
          console.log(`[TimetableDataProcessorCore] *** SUCCESS: Found leave title from TypeOfLeave object: ${nonWorkLeaveTypeTitle} ***`);
        }
        // Способ 2: Из поля Title если оно есть в record
        else if ((record as any).Title) {
          nonWorkLeaveTypeTitle = (record as any).Title;
          console.log(`[TimetableDataProcessorCore] *** SUCCESS: Found leave title from record.Title: ${nonWorkLeaveTypeTitle} ***`);
        }
        // Способ 3: Fallback к ID
        else {
          nonWorkLeaveTypeTitle = nonWorkLeaveTypeId;
          console.log(`[TimetableDataProcessorCore] *** FALLBACK: Using leave ID as title: ${nonWorkLeaveTypeTitle} ***`);
        }
        
        // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Получение цвета типа отпуска ***
        if (getLeaveTypeColor && nonWorkLeaveTypeId) {
          nonWorkLeaveTypeColor = getLeaveTypeColor(nonWorkLeaveTypeId);
          console.log(`[TimetableDataProcessorCore] *** LEAVE COLOR LOOKUP ***`, {
            leaveTypeId: nonWorkLeaveTypeId,
            leaveTypeColor: nonWorkLeaveTypeColor,
            hasColorFunction: !!getLeaveTypeColor,
            colorFound: !!nonWorkLeaveTypeColor
          });
        }
        
        console.log(`[TimetableDataProcessorCore] *** COMPLETE LEAVE TYPE INFO ***`, {
          day: dayNumber,
          recordId: record.ID,
          leaveTypeId: nonWorkLeaveTypeId,
          leaveTypeTitle: nonWorkLeaveTypeTitle,
          leaveTypeColor: nonWorkLeaveTypeColor,
          success: 'Non-work leave type fully processed'
        });
      }
    }
  });

  const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
  
  // *** ИСПРАВЛЕНО: Улучшенное форматирование контента с полными названиями ***
  let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

  // Если нет смен, но есть отметки отпуска/праздника - показываем их с полными названиями
  if (!shifts.length) {
    if (hasNonWorkHoliday) {
      formattedContent = "Holiday";
      console.log(`[TimetableDataProcessorCore] Set formattedContent to Holiday for day ${dayNumber}`);
    } else if (hasNonWorkLeave && nonWorkLeaveTypeTitle) {
      formattedContent = nonWorkLeaveTypeTitle; // *** ИСПРАВЛЕНО: Полное название типа отпуска ***
      console.log(`[TimetableDataProcessorCore] *** SET FORMATTED CONTENT TO LEAVE TITLE: ${nonWorkLeaveTypeTitle} ***`);
    }
  }

  // Определяем наличие отпусков и праздников
  const workShiftsLeaveColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
  const hasWorkShiftsLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
  const hasWorkShiftsHoliday = TimetableShiftCalculator.hasHolidays ? 
    TimetableShiftCalculator.hasHolidays(shifts) : 
    shifts.some(s => s.isHoliday);

  const hasHoliday = hasWorkShiftsHoliday || hasNonWorkHoliday;
  const hasLeave = hasWorkShiftsLeave || hasNonWorkLeave;
  const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

  // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Определение финального цвета с учетом отпусков без работы ***
  let finalCellColor: string | undefined = undefined;
  let leaveTypeColor: string | undefined = undefined;

  console.log(`[TimetableDataProcessorCore] *** COLOR DETERMINATION FOR DAY ${dayNumber} ***`, {
    hasHoliday,
    hasLeave,
    hasWorkShifts: shifts.length > 0,
    workShiftsLeaveColor,
    nonWorkLeaveTypeColor,
    holidayColorFinal
  });

  if (hasHoliday) {
    finalCellColor = holidayColorFinal;
    console.log(`[TimetableDataProcessorCore] *** APPLIED HOLIDAY COLOR: ${holidayColorFinal} ***`);
  } else if (hasLeave) {
    // Приоритет: цвет из рабочих смен, затем из записей без работы
    leaveTypeColor = workShiftsLeaveColor || nonWorkLeaveTypeColor;
    if (leaveTypeColor) {
      finalCellColor = leaveTypeColor;
      console.log(`[TimetableDataProcessorCore] *** APPLIED LEAVE COLOR FOR DAY ${dayNumber} ***`, {
        leaveTypeColor,
        source: workShiftsLeaveColor ? 'work shifts' : 'non-work record',
        leaveTypeTitle: nonWorkLeaveTypeTitle,
        appliedToFinalCellColor: true
      });
    } else {
      console.warn(`[TimetableDataProcessorCore] *** WARNING: Leave detected but no color available ***`, {
        hasLeave,
        workShiftsLeaveColor,
        nonWorkLeaveTypeColor,
        getLeaveTypeColorAvailable: !!getLeaveTypeColor
      });
    }
  }

  // *** ИСПРАВЛЕНО: Возвращаем dayData с полной информацией о типе отпуска ***
  const result: IDayInfo = {
    dayNumber,
    date: dayDate,
    shifts,
    totalMinutes,
    formattedContent, // *** Содержит полное название типа отпуска ***
    hasData: shifts.length > 0 || hasNonWorkHoliday || hasNonWorkLeave,
    leaveTypeColor, // *** ИСПРАВЛЕНО: Включает цвет из записей без работы ***
    hasLeave,
    hasHoliday,
    holidayColor: hasHoliday ? holidayColorFinal : undefined,
    finalCellColor // *** ИСПРАВЛЕНО: Финальный цвет для применения к ячейке ***
  };

  console.log(`[TimetableDataProcessorCore] *** DAY ${dayNumber} RESULT ***`, {
    formattedContent: result.formattedContent,
    leaveTypeColor: result.leaveTypeColor,
    finalCellColor: result.finalCellColor,
    hasLeave: result.hasLeave,
    hasHoliday: result.hasHoliday,
    success: 'Day data processed with full leave type information and colors'
  });

  return result;
}

  /**
   * FIXED METHOD: Обработка недельных данных специально для Excel экспорта
   * ИСПРАВЛЕНО: Улучшенное сохранение информации о типах отпусков
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
    
    console.log(`[TimetableDataProcessorCore] Processing week ${week.weekNum} for Excel with enhanced markers`);

    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataForExcelWithFullMarkersFixed(
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
   * FIXED METHOD: Обработка дневных данных специально для Excel экспорта
   * ИСПРАВЛЕНО: Полное сохранение информации о типах отпусков
   */
  private static processDayDataForExcelWithFullMarkersFixed(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    // Используем улучшенный метод для получения смен И отметок
    const shifts = TimetableShiftCalculatorCore.getShiftsAndMarkersForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    // *** ДОПОЛНИТЕЛЬНО: Анализируем записи для извлечения информации о типах отпусков ***
    const allDayRecords = TimetableShiftCalculatorCore.getAllRecordsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd
    );

    const leaveInfo = TimetableShiftCalculatorCore.extractLeaveInfoFromNonWorkRecords(
      allDayRecords,
      getLeaveTypeColor
    );

    const totalMinutes = shifts.reduce((sum, shift) => {
      return shift.workMinutes > 0 ? sum + shift.workMinutes : sum;
    }, 0);
    
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // *** ИСПРАВЛЕНО: Улучшенное форматирование для Excel ***
    if (shifts.length === 0 && leaveInfo.hasNonWorkLeave && leaveInfo.leaveTypeTitle) {
      formattedContent = leaveInfo.leaveTypeTitle; // Показываем название типа отпуска
    }

    const hasHolidayInWorkShifts = shifts.some(s => s.isHoliday && s.workMinutes > 0);
    const hasLeaveInWorkShifts = shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);
    const hasHolidayMarkers = shifts.some(s => s.isHoliday && s.workMinutes === 0);
    const hasLeaveMarkers = shifts.some(s => s.typeOfLeaveId && s.workMinutes === 0) || leaveInfo.hasNonWorkLeave;

    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColor(shifts) || leaveInfo.leaveTypeColor;
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts) || leaveInfo.hasNonWorkLeave;
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

    console.log(`[TimetableDataProcessorCore] Excel day ${dayNumber} analysis:`, {
      hasWorkShifts: shifts.some(s => s.workMinutes > 0),
      hasLeaveInfo: leaveInfo.hasNonWorkLeave,
      leaveTypeTitle: leaveInfo.leaveTypeTitle,
      leaveTypeColor: leaveInfo.leaveTypeColor,
      finalCellColor
    });

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0 || leaveInfo.hasNonWorkLeave,
      leaveTypeColor, // *** ИСПРАВЛЕНО: Включает информацию из non-work записей ***
      hasLeave: hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts || leaveInfo.hasNonWorkLeave,
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