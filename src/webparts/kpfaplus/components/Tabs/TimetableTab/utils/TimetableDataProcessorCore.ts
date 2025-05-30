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
 * ВЕРСИЯ 3.6: ИСПРАВЛЕНО сохранение информации о типах отпусков для дней без смен
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
   * ИСПРАВЛЕННЫЙ МЕТОД v3.6: Обрабатывает дневные данные с полной поддержкой цветов отпусков и праздников
   * ИСПРАВЛЕНО: Правильная передача функции getLeaveTypeColor
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
      getLeaveTypeColor // *** ИСПРАВЛЕНО v3.6: Передаем функцию ***
    );

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    const formattedContent = TimetableShiftCalculator.formatDayContent(shifts);
    
    // *** ИСПРАВЛЕНО v3.6: Используем правильный метод с функцией ***
    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColorWithFunction ? 
      TimetableShiftCalculator.getDominantLeaveColorWithFunction(shifts, getLeaveTypeColor) :
      TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
      
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday);
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
      console.log(`[TimetableDataProcessorCore] *** v3.6: Applied holiday color: ${finalCellColor} ***`);
    } else if (hasLeave && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
      console.log(`[TimetableDataProcessorCore] *** v3.6: Applied leave color: ${finalCellColor} ***`);
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
   * ГЛАВНЫЙ ИСПРАВЛЕННЫЙ МЕТОД v3.6: Обрабатывает недельные данные включая дни без смен, но с отметками праздников/отпусков
   * ИСПРАВЛЕНО: Сохранение информации о типах отпусков для дней без рабочих смен
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
    
    console.log(`[TimetableDataProcessorCore] *** v3.6: Processing week ${week.weekNum} with enhanced leave type preservation ***`);

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

  /**
   * ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ МЕТОД v3.6: Обрабатывает дневные данные включая дни без смен
   * ИСПРАВЛЕНО: Получение полных названий типов отпусков и применение цветов
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

    console.log(`[TimetableDataProcessorCore] *** v3.6: Day ${dayNumber}: Found ${allDayRecords.length} records ***`);

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

    // Анализируем ВСЕ записи дня для поиска типов отпусков
    allDayRecords.forEach(record => {
      const isHoliday = record.Holiday === 1;
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 &&
        !(new Date(record.ShiftDate1).getHours() === 0 && new Date(record.ShiftDate1).getMinutes() === 0 &&
          new Date(record.ShiftDate2).getHours() === 0 && new Date(record.ShiftDate2).getMinutes() === 0);
      
      console.log(`[TimetableDataProcessorCore] *** v3.6: Record ${record.ID} analysis ***`, {
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
          console.log(`[TimetableDataProcessorCore] *** v3.6: Found non-work holiday in day ${dayNumber} ***`);
        }
        if (hasLeaveType) {
          hasNonWorkLeave = true;
          nonWorkLeaveTypeId = record.TypeOfLeaveID;
          
          // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное получение названия типа отпуска ***
          console.log(`[TimetableDataProcessorCore] *** v3.6: ANALYZING LEAVE TYPE DATA ***`, {
            leaveTypeId: record.TypeOfLeaveID,
            typeOfLeaveObject: record.TypeOfLeave,
            typeOfLeaveTitle: record.TypeOfLeave?.Title,
            hasTypeOfLeaveObject: !!record.TypeOfLeave
          });
          
          // Способ 1: Из связанного объекта TypeOfLeave (самый надежный)
          if (record.TypeOfLeave && record.TypeOfLeave.Title) {
            nonWorkLeaveTypeTitle = record.TypeOfLeave.Title;
            console.log(`[TimetableDataProcessorCore] *** v3.6: SUCCESS: Found leave title from TypeOfLeave object: ${nonWorkLeaveTypeTitle} ***`);
          }
          // Способ 2: Из поля Title если оно есть в record
          else if ((record as any).Title) {
            nonWorkLeaveTypeTitle = (record as any).Title;
            console.log(`[TimetableDataProcessorCore] *** v3.6: SUCCESS: Found leave title from record.Title: ${nonWorkLeaveTypeTitle} ***`);
          }
          // Способ 3: Fallback к ID (что сейчас показывается как "Type 2", "Type 13")
          else {
            nonWorkLeaveTypeTitle = nonWorkLeaveTypeId;
            console.log(`[TimetableDataProcessorCore] *** v3.6: FALLBACK: Using leave ID as title (currently shows as "Type X"): ${nonWorkLeaveTypeTitle} ***`);
          }
          
          // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Получение цвета типа отпуска ***
          if (getLeaveTypeColor && nonWorkLeaveTypeId) {
            nonWorkLeaveTypeColor = getLeaveTypeColor(nonWorkLeaveTypeId);
            console.log(`[TimetableDataProcessorCore] *** v3.6: LEAVE COLOR LOOKUP ***`, {
              leaveTypeId: nonWorkLeaveTypeId,
              leaveTypeColor: nonWorkLeaveTypeColor,
              hasColorFunction: !!getLeaveTypeColor,
              colorFound: !!nonWorkLeaveTypeColor
            });
          }
          
          console.log(`[TimetableDataProcessorCore] *** v3.6: COMPLETE LEAVE TYPE INFO ***`, {
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
    
    // *** ИСПРАВЛЕНО v3.6: Улучшенное форматирование контента с полными названиями ***
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // Если нет смен, но есть отметки отпуска/праздника - показываем их с полными названиями
    if (!shifts.length) {
      if (hasNonWorkHoliday) {
        formattedContent = "Holiday";
        console.log(`[TimetableDataProcessorCore] *** v3.6: Set formattedContent to Holiday for day ${dayNumber} ***`);
      } else if (hasNonWorkLeave && nonWorkLeaveTypeTitle) {
        formattedContent = nonWorkLeaveTypeTitle; // *** ИСПРАВЛЕНО: Полное название типа отпуска ***
        console.log(`[TimetableDataProcessorCore] *** v3.6: SET FORMATTED CONTENT TO LEAVE TITLE: ${nonWorkLeaveTypeTitle} ***`);
      }
    }

    // Определяем наличие отпусков и праздников
    const workShiftsLeaveColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
    const hasWorkShiftsLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasWorkShiftsHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday);

    const hasHoliday = hasWorkShiftsHoliday || hasNonWorkHoliday;
    const hasLeave = hasWorkShiftsLeave || hasNonWorkLeave;
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.6: Определение финального цвета с учетом отпусков без работы ***
    let finalCellColor: string | undefined = undefined;
    let leaveTypeColor: string | undefined = undefined;

    console.log(`[TimetableDataProcessorCore] *** v3.6: COLOR DETERMINATION FOR DAY ${dayNumber} ***`, {
      hasHoliday,
      hasLeave,
      hasWorkShifts: shifts.length > 0,
      workShiftsLeaveColor,
      nonWorkLeaveTypeColor,
      holidayColorFinal
    });

    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
      console.log(`[TimetableDataProcessorCore] *** v3.6: APPLIED HOLIDAY COLOR: ${holidayColorFinal} ***`);
    } else if (hasLeave) {
      // Приоритет: цвет из рабочих смен, затем из записей без работы
      leaveTypeColor = workShiftsLeaveColor || nonWorkLeaveTypeColor;
      if (leaveTypeColor) {
        finalCellColor = leaveTypeColor;
        console.log(`[TimetableDataProcessorCore] *** v3.6: APPLIED LEAVE COLOR FOR DAY ${dayNumber} ***`, {
          leaveTypeColor,
          source: workShiftsLeaveColor ? 'work shifts' : 'non-work record',
          leaveTypeTitle: nonWorkLeaveTypeTitle,
          appliedToFinalCellColor: true
        });
      } else {
        console.warn(`[TimetableDataProcessorCore] *** v3.6: WARNING: Leave detected but no color available ***`, {
          hasLeave,
          workShiftsLeaveColor,
          nonWorkLeaveTypeColor,
          getLeaveTypeColorAvailable: !!getLeaveTypeColor
        });
      }
    }

    // *** ИСПРАВЛЕНО v3.6: Возвращаем dayData с полной информацией о типе отпуска ***
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

    console.log(`[TimetableDataProcessorCore] *** v3.6: DAY ${dayNumber} RESULT ***`, {
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
   * ИСПРАВЛЕННЫЙ МЕТОД v3.6: Обработка недельных данных специально для Excel экспорта
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
    
    console.log(`[TimetableDataProcessorCore] *** v3.6: Processing week ${week.weekNum} for Excel with enhanced markers ***`);

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
   * ИСПРАВЛЕННЫЙ МЕТОД v3.6: Обработка дневных данных специально для Excel экспорта
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

    // *** ИСПРАВЛЕНО v3.6: Улучшенное форматирование для Excel ***
    if (shifts.length === 0 && leaveInfo.hasNonWorkLeave && leaveInfo.leaveTypeTitle) {
      formattedContent = leaveInfo.leaveTypeTitle; // Показываем название типа отпуска
    }

    const hasHolidayInWorkShifts = shifts.some(s => s.isHoliday && s.workMinutes > 0);
    const hasLeaveInWorkShifts = shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);
    const hasHolidayMarkers = shifts.some(s => s.isHoliday && s.workMinutes === 0);
    const hasLeaveMarkers = shifts.some(s => s.typeOfLeaveId && s.workMinutes === 0) || leaveInfo.hasNonWorkLeave;

    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor) || leaveInfo.leaveTypeColor;
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

    console.log(`[TimetableDataProcessorCore] *** v3.6: Excel day ${dayNumber} analysis ***`, {
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
   * НОВЫЙ МЕТОД v3.6: Подсчитывает количество праздников в недельных данных
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

  // *** НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ v3.6 ***

  /**
   * НОВЫЙ МЕТОД v3.6: Диагностика обработки недели
   */
  public static diagnoseWeekProcessing(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    weekNum: number;
    totalRecords: number;
    recordsByDay: Record<number, number>;
    recordsWithLeave: number;
    recordsWithHoliday: number;
    recordsWithWorkTime: number;
    recordsWithoutWorkTime: number;
    hasColorFunction: boolean;
    processingQuality: string;
  } {
    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);
    const recordsByDay: Record<number, number> = {};
    let recordsWithLeave = 0;
    let recordsWithHoliday = 0;
    let recordsWithWorkTime = 0;
    let recordsWithoutWorkTime = 0;

    weekRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      const dayNumber = TimetableShiftCalculator.getDayNumber(recordDate);
      recordsByDay[dayNumber] = (recordsByDay[dayNumber] || 0) + 1;

      if (record.TypeOfLeaveID) recordsWithLeave++;
      if (record.Holiday === 1) recordsWithHoliday++;

      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 &&
        !(new Date(record.ShiftDate1).getHours() === 0 && new Date(record.ShiftDate1).getMinutes() === 0 &&
          new Date(record.ShiftDate2).getHours() === 0 && new Date(record.ShiftDate2).getMinutes() === 0);

      if (hasWorkTime) {
        recordsWithWorkTime++;
      } else {
        recordsWithoutWorkTime++;
      }
    });

    let processingQuality = 'UNKNOWN';
    if (weekRecords.length === 0) {
      processingQuality = 'NO_DATA';
    } else if (recordsWithLeave > 0 && !getLeaveTypeColor) {
      processingQuality = 'MISSING_COLOR_FUNCTION';
    } else if (recordsWithoutWorkTime > recordsWithWorkTime) {
      processingQuality = 'MOSTLY_MARKERS';
    } else {
      processingQuality = 'GOOD';
    }

    return {
      weekNum: week.weekNum,
      totalRecords: weekRecords.length,
      recordsByDay,
      recordsWithLeave,
      recordsWithHoliday,
      recordsWithWorkTime,
      recordsWithoutWorkTime,
      hasColorFunction: !!getLeaveTypeColor,
      processingQuality
    };
  }

  /**
   * НОВЫЙ МЕТОД v3.6: Получает статистику обработки
   */
  public static getProcessingStatistics(weeklyData: IWeeklyStaffData): {
    weekNum: number;
    totalDays: number;
    daysWithData: number;
    daysWithLeave: number;
    daysWithHoliday: number;
    daysWithColors: number;
    totalShifts: number;
    totalWorkMinutes: number;
    processingQuality: string;
  } {
    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithData = days.filter(day => day.hasData).length;
    const daysWithLeave = days.filter(day => day.hasLeave).length;
    const daysWithHoliday = days.filter(day => day.hasHoliday).length;
    const daysWithColors = days.filter(day => day.finalCellColor && day.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND).length;
    const totalShifts = days.reduce((sum, day) => sum + day.shifts.length, 0);

    let processingQuality = 'UNKNOWN';
    if (daysWithData === 0) {
      processingQuality = 'NO_DATA';
    } else if (daysWithLeave > 0 && daysWithColors === 0) {
      processingQuality = 'COLORS_MISSING';
    } else if (daysWithColors > 0) {
      processingQuality = 'COLORS_APPLIED';
    } else {
      processingQuality = 'BASIC_DATA';
    }

    return {
      weekNum: weeklyData.weekNum,
      totalDays: days.length,
      daysWithData,
      daysWithLeave,
      daysWithHoliday,
      daysWithColors,
      totalShifts,
      totalWorkMinutes: weeklyData.totalWeekMinutes,
      processingQuality
    };
  }

  /**
   * НОВЫЙ МЕТОД v3.6: Валидация результатов обработки
   */
  public static validateProcessingResults(weeklyData: IWeeklyStaffData): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithLeave = days.filter(day => day.hasLeave);
    const daysWithHoliday = days.filter(day => day.hasHoliday);
    const daysWithColors = days.filter(day => day.finalCellColor && day.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND);

    // Проверка дней недели
    if (days.length !== 7) {
      issues.push(`Expected 7 days, got ${days.length}`);
    }

    // Проверка цветов отпусков
    if (daysWithLeave.length > 0 && daysWithColors.length === 0) {
      issues.push('Leave days found but no colors applied');
      recommendations.push('Check getLeaveTypeColor function and TypeOfLeave configuration');
    }

    // Проверка формата данных
    days.forEach((day, index) => {
      if (!day.formattedContent && day.hasData) {
        warnings.push(`Day ${index + 1} has data but no formatted content`);
      }
      if (day.hasLeave && !day.leaveTypeColor) {
        warnings.push(`Day ${index + 1} has leave but no leave color`);
      }
      if (day.hasHoliday && !day.holidayColor) {
        warnings.push(`Day ${index + 1} has holiday but no holiday color`);
      }
    });

    // Проверка недельных итогов
    const calculatedTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
    if (calculatedTotal !== weeklyData.totalWeekMinutes) {
      issues.push(`Week total mismatch: calculated ${calculatedTotal}, stored ${weeklyData.totalWeekMinutes}`);
    }

    // Рекомендации по улучшению
    if (daysWithHoliday.length > 0 && daysWithLeave.length > 0) {
      recommendations.push('Holiday priority system active - ensure proper color overrides');
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      warnings,
      recommendations
    };
  }
}