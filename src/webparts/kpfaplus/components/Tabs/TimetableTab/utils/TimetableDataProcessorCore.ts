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
 * ВЕРСИЯ 4.0: КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ сохранения полных названий типов отпусков для дней без смен
 * НОВОЕ: Улучшенная передача функций getLeaveTypeColor и typesOfLeave для правильного отображения
 */
export class TimetableDataProcessorCore {

  /**
   * Обрабатывает недельные данные с полной поддержкой цветов отпусков и праздников
   * (Used by legacy processData)
   * ОБНОВЛЕНО v4.0: Улучшенная передача функций для получения названий типов отпусков
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

    console.log(`[TimetableDataProcessorCore] *** PROCESSING WEEK ${week.weekNum} v4.0 *** with ENHANCED LEAVE TYPE SUPPORT`, {
      weekRecordsCount: weekRecords.length,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      enhancement: 'v4.0 - Improved leave type names preservation'
    });

    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColorsAndHolidaysEnhanced(
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
    
    console.log(`[TimetableDataProcessorCore] *** WEEK ${week.weekNum} PROCESSED v4.0 *** Total minutes: ${weeklyData.totalWeekMinutes}`);
    return weeklyData;
  }

  /**
   * *** НОВЫЙ УЛУЧШЕННЫЙ МЕТОД v4.0 *** 
   * Обрабатывает дневные данные с полной поддержкой цветов отпусков и праздников
   * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильная передача функции getLeaveTypeColor и сохранение полных названий
   */
  private static processDayDataWithLeaveColorsAndHolidaysEnhanced(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    console.log(`[TimetableDataProcessorCore] *** PROCESSING DAY ${dayNumber} v4.0 *** with ENHANCED LEAVE TYPE SUPPORT`);
    
    // Получаем смены для этого дня
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor // *** КРИТИЧЕСКИ ВАЖНО v4.0: Передаем функцию ***
    );

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    
    // *** БАЗОВОЕ ФОРМАТИРОВАНИЕ КОНТЕНТА ***
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);
    
    // *** НОВОЕ v4.0: Расширенный анализ записей дня для получения информации о типах отпусков ***
    const allDayRecords = this.getAllRecordsForDayEnhanced(weekRecords, dayNumber, weekStart, weekEnd);
    const leaveAnalysis = this.analyzeLeaveInfoFromRecordsEnhanced(allDayRecords, getLeaveTypeColor);

    console.log(`[TimetableDataProcessorCore] *** DAY ${dayNumber} ANALYSIS v4.0 ***`, {
      shiftsCount: shifts.length,
      totalMinutes,
      allRecordsCount: allDayRecords.length,
      leaveAnalysis: {
        hasNonWorkLeave: leaveAnalysis.hasNonWorkLeave,
        leaveTypeTitle: leaveAnalysis.leaveTypeTitle,
        leaveTypeColor: leaveAnalysis.leaveTypeColor
      }
    });
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.0: Улучшенное определение цвета отпуска ***
    let leaveTypeColor: string | undefined;
    
    // Приоритет 1: Цвет из рабочих смен
    if (shifts.length > 0) {
      leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
    }
    
    // Приоритет 2: Цвет из записей без работы (дни только с отпуском)
    if (!leaveTypeColor && leaveAnalysis.leaveTypeColor) {
      leaveTypeColor = leaveAnalysis.leaveTypeColor;
      console.log(`[TimetableDataProcessorCore] *** v4.0: Applied leave color from non-work records: ${leaveTypeColor} ***`);
    }

    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts) || leaveAnalysis.hasNonWorkLeave;
    const hasHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday);
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.0: Улучшенное формирование formattedContent для дней без смен ***
    if (shifts.length === 0) {
      if (hasHoliday) {
        formattedContent = "Holiday";
        console.log(`[TimetableDataProcessorCore] *** v4.0: Set Holiday content for day ${dayNumber} ***`);
      } else if (leaveAnalysis.hasNonWorkLeave && leaveAnalysis.leaveTypeTitle) {
        // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем ПОЛНОЕ НАЗВАНИЕ вместо ID ***
        formattedContent = leaveAnalysis.leaveTypeTitle;
        console.log(`[TimetableDataProcessorCore] *** v4.0 SUCCESS: Set FULL LEAVE TITLE for day ${dayNumber}: ${leaveAnalysis.leaveTypeTitle} ***`);
      }
    }

    // *** СИСТЕМА ПРИОРИТЕТОВ ЦВЕТОВ v4.0 ***
    let finalCellColor: string | undefined = undefined;
    
    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
      console.log(`[TimetableDataProcessorCore] *** v4.0: Applied holiday color: ${finalCellColor} ***`);
    } else if (hasLeave && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
      console.log(`[TimetableDataProcessorCore] *** v4.0: Applied leave color for day ${dayNumber}: ${leaveTypeColor} ***`);
    }

    // *** СОЗДАЕМ РЕЗУЛЬТИРУЮЩИЙ ОБЪЕКТ ДНЕВНЫХ ДАННЫХ ***
    const result: IDayInfo = {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent, // *** v4.0: Содержит полное название типа отпуска ***
      hasData: shifts.length > 0 || hasHoliday || leaveAnalysis.hasNonWorkLeave,
      leaveTypeColor, // *** v4.0: Включает цвет из записей без работы ***
      hasLeave,
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor // *** v4.0: Финальный цвет для применения к ячейке ***
    };

    console.log(`[TimetableDataProcessorCore] *** DAY ${dayNumber} RESULT v4.0 ***`, {
      formattedContent: result.formattedContent,
      leaveTypeColor: result.leaveTypeColor,
      finalCellColor: result.finalCellColor,
      hasLeave: result.hasLeave,
      hasHoliday: result.hasHoliday,
      enhancement: 'v4.0 - Full leave type names and colors preserved'
    });

    return result;
  }

  /**
   * *** ГЛАВНЫЙ ИСПРАВЛЕННЫЙ МЕТОД v4.0 ***
   * Обрабатывает недельные данные включая дни без смен, но с отметками праздников/отпусков
   * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Полное сохранение информации о типах отпусков с названиями
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
    
    console.log(`[TimetableDataProcessorCore] *** PROCESSING WEEK ${week.weekNum} v4.0 *** INCLUDING NON-WORK DAYS with ENHANCED LEAVE TYPE PRESERVATION`, {
      weekRecordsCount: weekRecords.length,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY
    });

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
    
    console.log(`[TimetableDataProcessorCore] *** WEEK ${week.weekNum} COMPLETED v4.0 *** with ENHANCED LEAVE TYPE SUPPORT`);
    return weeklyData;
  }

  /**
   * *** ПОЛНОСТЬЮ ИСПРАВЛЕННЫЙ МЕТОД v4.0 ***
   * Обрабатывает дневные данные включая дни без смен
   * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Получение полных названий типов отпусков и применение цветов
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
    
    console.log(`[TimetableDataProcessorCore] *** PROCESSING DAY ${dayNumber} v4.0 *** INCLUDING NON-WORK DAYS with ENHANCED LEAVE TYPE SUPPORT`);
    
    // Получаем ВСЕ записи для этого дня (не только с рабочим временем)
    const allDayRecords = this.getAllRecordsForDayEnhanced(weekRecords, dayNumber, weekStart, weekEnd);

    console.log(`[TimetableDataProcessorCore] *** DAY ${dayNumber} v4.0: Found ${allDayRecords.length} total records ***`);

    // Получаем обычные смены (с рабочим временем)
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor // *** КРИТИЧЕСКИ ВАЖНО v4.0: Передаем функцию ***
    );

    // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ v4.0: Расширенный анализ записей без рабочего времени ***
    const leaveInfo = this.analyzeLeaveInfoFromRecordsEnhanced(allDayRecords, getLeaveTypeColor);
    const holidayInfo = this.analyzeHolidayInfoFromRecords(allDayRecords);

    console.log(`[TimetableDataProcessorCore] *** DAY ${dayNumber} ANALYSIS v4.0 ***`, {
      shiftsCount: shifts.length,
      totalRecordsCount: allDayRecords.length,
      leaveInfo: {
        hasNonWorkLeave: leaveInfo.hasNonWorkLeave,
        leaveTypeId: leaveInfo.leaveTypeId,
        leaveTypeTitle: leaveInfo.leaveTypeTitle,
        leaveTypeColor: leaveInfo.leaveTypeColor
      },
      holidayInfo: {
        hasNonWorkHoliday: holidayInfo.hasNonWorkHoliday,
        nonWorkHolidayRecords: holidayInfo.nonWorkHolidayRecords
      }
    });

    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    
    // *** ИСПРАВЛЕНО v4.0: Улучшенное форматирование контента с полными названиями ***
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // Если нет смен, но есть отметки отпуска/праздника - показываем их с полными названиями
    if (!shifts.length) {
      if (holidayInfo.hasNonWorkHoliday) {
        formattedContent = "Holiday";
        console.log(`[TimetableDataProcessorCore] *** v4.0: Set formattedContent to Holiday for day ${dayNumber} ***`);
      } else if (leaveInfo.hasNonWorkLeave && leaveInfo.leaveTypeTitle) {
        // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.0: Используем полное название типа отпуска ***
        formattedContent = leaveInfo.leaveTypeTitle;
        console.log(`[TimetableDataProcessorCore] *** v4.0 SUCCESS: SET FORMATTED CONTENT TO FULL LEAVE TITLE: ${leaveInfo.leaveTypeTitle} ***`);
      }
    }

    // Определяем наличие отпусков и праздников
    const workShiftsLeaveColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
    const hasWorkShiftsLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasWorkShiftsHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday);

    const hasHoliday = hasWorkShiftsHoliday || holidayInfo.hasNonWorkHoliday;
    const hasLeave = hasWorkShiftsLeave || leaveInfo.hasNonWorkLeave;
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.0: Определение финального цвета с учетом отпусков без работы ***
    let finalCellColor: string | undefined = undefined;
    let leaveTypeColor: string | undefined = undefined;

    console.log(`[TimetableDataProcessorCore] *** COLOR DETERMINATION v4.0 FOR DAY ${dayNumber} ***`, {
      hasHoliday,
      hasLeave,
      hasWorkShifts: shifts.length > 0,
      workShiftsLeaveColor,
      nonWorkLeaveTypeColor: leaveInfo.leaveTypeColor,
      holidayColorFinal
    });

    if (hasHoliday) {
      finalCellColor = holidayColorFinal;
      console.log(`[TimetableDataProcessorCore] *** v4.0: APPLIED HOLIDAY COLOR: ${holidayColorFinal} ***`);
    } else if (hasLeave) {
      // Приоритет: цвет из рабочих смен, затем из записей без работы
      leaveTypeColor = workShiftsLeaveColor || leaveInfo.leaveTypeColor;
      if (leaveTypeColor) {
        finalCellColor = leaveTypeColor;
        console.log(`[TimetableDataProcessorCore] *** v4.0: APPLIED LEAVE COLOR FOR DAY ${dayNumber} ***`, {
          leaveTypeColor,
          source: workShiftsLeaveColor ? 'work shifts' : 'non-work record',
          leaveTypeTitle: leaveInfo.leaveTypeTitle,
          appliedToFinalCellColor: true
        });
      } else {
        console.warn(`[TimetableDataProcessorCore] *** v4.0: WARNING: Leave detected but no color available ***`, {
          hasLeave,
          workShiftsLeaveColor,
          nonWorkLeaveTypeColor: leaveInfo.leaveTypeColor,
          getLeaveTypeColorAvailable: !!getLeaveTypeColor
        });
      }
    }

    // *** ВОЗВРАЩАЕМ РЕЗУЛЬТАТ v4.0 с полной информацией о типе отпуска ***
    const result: IDayInfo = {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent, // *** v4.0: Содержит полное название типа отпуска ***
      hasData: shifts.length > 0 || holidayInfo.hasNonWorkHoliday || leaveInfo.hasNonWorkLeave,
      leaveTypeColor, // *** v4.0: Включает цвет из записей без работы ***
      hasLeave,
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor // *** v4.0: Финальный цвет для применения к ячейке ***
    };

    console.log(`[TimetableDataProcessorCore] *** DAY ${dayNumber} RESULT v4.0 ***`, {
      formattedContent: result.formattedContent,
      leaveTypeColor: result.leaveTypeColor,
      finalCellColor: result.finalCellColor,
      hasLeave: result.hasLeave,
      hasHoliday: result.hasHoliday,
      enhancement: 'v4.0 - Day data processed with full leave type information, names and colors'
    });

    return result;
  }
  /**
   * *** НОВЫЙ КЛЮЧЕВОЙ МЕТОД v4.0 ***
   * Улучшенное извлечение информации о типе отпуска из записей дня
   * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Правильное получение полных названий типов отпусков
   */
  private static analyzeLeaveInfoFromRecordsEnhanced(
    allDayRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasNonWorkLeave: boolean;
    leaveTypeId?: string;
    leaveTypeTitle?: string;
    leaveTypeColor?: string;
  } {
    console.log(`[TimetableDataProcessorCore] *** ANALYZING LEAVE INFO v4.0 *** from ${allDayRecords.length} records with ENHANCED TITLE EXTRACTION`);
    
    // Ищем записи без рабочего времени, но с типом отпуска
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // Проверяем что нет рабочего времени
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);
      
      // Но есть тип отпуска
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      console.log(`[TimetableDataProcessorCore] *** v4.0: Record ${record.ID} analysis ***`, {
        hasWorkTime,
        hasLeaveType,
        leaveTypeId: record.TypeOfLeaveID,
        typeOfLeaveObject: record.TypeOfLeave,
        leaveTypeTitle: record.TypeOfLeave?.Title
      });
      
      return !hasWorkTime && hasLeaveType;
    });

    if (nonWorkLeaveRecords.length === 0) {
      console.log(`[TimetableDataProcessorCore] *** v4.0: No non-work leave records found ***`);
      return { hasNonWorkLeave: false };
    }

    // Берем первую найденную запись с отпуском
    const leaveRecord = nonWorkLeaveRecords[0];
    const leaveTypeId = leaveRecord.TypeOfLeaveID;
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.0: Улучшенное получение названия типа отпуска ***
    let leaveTypeTitle: string | undefined = undefined;
    
    console.log(`[TimetableDataProcessorCore] *** v4.0: EXTRACTING LEAVE TYPE TITLE ***`, {
      leaveTypeId,
      typeOfLeaveObject: leaveRecord.TypeOfLeave,
      hasTypeOfLeaveObject: !!leaveRecord.TypeOfLeave,
      typeOfLeaveObjectTitle: leaveRecord.TypeOfLeave?.Title
    });
    
    // Приоритет 1: Название из связанного объекта TypeOfLeave (самый надежный)
    if (leaveRecord.TypeOfLeave && leaveRecord.TypeOfLeave.Title) {
      leaveTypeTitle = leaveRecord.TypeOfLeave.Title;
      console.log(`[TimetableDataProcessorCore] *** v4.0 SUCCESS: FOUND LEAVE TITLE FROM LINKED OBJECT: ${leaveTypeTitle} ***`);
    }
    // Приоритет 2: Поиск в дополнительных полях записи
    else if ((leaveRecord as any).Title && typeof (leaveRecord as any).Title === 'string') {
      leaveTypeTitle = (leaveRecord as any).Title;
      console.log(`[TimetableDataProcessorCore] *** v4.0 SUCCESS: FOUND LEAVE TITLE FROM RECORD.TITLE: ${leaveTypeTitle} ***`);
    }
    // Приоритет 3: ID как название (fallback - что даст "Type X")
    else if (leaveTypeId) {
      leaveTypeTitle = leaveTypeId;
      console.log(`[TimetableDataProcessorCore] *** v4.0 FALLBACK: USING LEAVE ID AS TITLE: ${leaveTypeTitle} ***`);
    }
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.0: Получение цвета типа отпуска ***
    let leaveTypeColor: string | undefined = undefined;
    
    if (getLeaveTypeColor && leaveTypeId) {
      leaveTypeColor = getLeaveTypeColor(leaveTypeId);
      console.log(`[TimetableDataProcessorCore] *** v4.0: LEAVE COLOR LOOKUP ***`, {
        leaveTypeId,
        leaveTypeColor,
        hasColorFunction: !!getLeaveTypeColor,
        colorFound: !!leaveTypeColor
      });
    } else {
      console.warn(`[TimetableDataProcessorCore] *** v4.0: WARNING: No color function or leave type ID for color lookup ***`);
    }

    const result = {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };

    console.log(`[TimetableDataProcessorCore] *** v4.0: COMPLETE LEAVE TYPE INFO EXTRACTED ***`, {
      recordId: leaveRecord.ID,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      hasColor: !!leaveTypeColor,
      hasTitle: !!leaveTypeTitle,
      titleSource: leaveRecord.TypeOfLeave?.Title ? 'TypeOfLeave.Title' : 
                   (leaveRecord as any).Title ? 'Record.Title' : 'LeaveTypeId',
      enhancement: 'v4.0 - Full leave type information preserved for UI display'
    });

    return result;
  }

  /**
   * *** НОВЫЙ МЕТОД v4.0 ***
   * Анализирует записи дня на предмет праздников
   */
  private static analyzeHolidayInfoFromRecords(
    allDayRecords: IStaffRecord[]
  ): {
    hasNonWorkHoliday: boolean;
    nonWorkHolidayRecords: number;
  } {
    let hasNonWorkHoliday = false;
    let nonWorkHolidayRecords = 0;

    allDayRecords.forEach(record => {
      // Проверяем есть ли рабочее время в этой записи
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      // Если нет рабочего времени, но есть отметка праздника
      if (!hasWorkTime && record.Holiday === 1) {
        hasNonWorkHoliday = true;
        nonWorkHolidayRecords++;
      }
    });

    console.log(`[TimetableDataProcessorCore] *** v4.0: Holiday analysis ***`, {
      totalRecords: allDayRecords.length,
      hasNonWorkHoliday,
      nonWorkHolidayRecords
    });

    return {
      hasNonWorkHoliday,
      nonWorkHolidayRecords
    };
  }

  /**
   * *** УЛУЧШЕННЫЙ МЕТОД v4.0 ***
   * Получает ВСЕ записи для конкретного дня недели (включая без рабочего времени)
   * Расширенная версия для анализа типов отпусков
   */
  private static getAllRecordsForDayEnhanced(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    // Фильтруем ВСЕ записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableDataProcessorCore] *** v4.0: Invalid date in record ${record.ID} ***`);
        return false;
      }

      const recordDayNumber = TimetableShiftCalculatorCore.getDayNumber(recordDate);
      
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      return isCorrectDay && isInWeek;
    });

    console.log(`[TimetableDataProcessorCore] *** v4.0: Found ${dayRecords.length} total records for day ${dayNumber} ***`);

    // *** ДОПОЛНИТЕЛЬНАЯ ДИАГНОСТИКА v4.0 ***
    const recordsWithLeave = dayRecords.filter(r => r.TypeOfLeaveID && r.TypeOfLeaveID !== '0');
    const recordsWithHoliday = dayRecords.filter(r => r.Holiday === 1);
    const recordsWithWorkTime = dayRecords.filter(r => {
      const hasWork = r.ShiftDate1 && r.ShiftDate2 && 
        !(r.ShiftDate1.getHours() === 0 && r.ShiftDate1.getMinutes() === 0 && 
          r.ShiftDate2.getHours() === 0 && r.ShiftDate2.getMinutes() === 0);
      return hasWork;
    });

    console.log(`[TimetableDataProcessorCore] *** v4.0: Day ${dayNumber} records analysis ***`, {
      totalRecords: dayRecords.length,
      recordsWithLeave: recordsWithLeave.length,
      recordsWithHoliday: recordsWithHoliday.length,
      recordsWithWorkTime: recordsWithWorkTime.length,
      recordsWithoutWorkTime: dayRecords.length - recordsWithWorkTime.length
    });

    return dayRecords;
  }

  /**
   * ИСПРАВЛЕННЫЙ МЕТОД v4.0: Обработка недельных данных специально для Excel экспорта
   * УЛУЧШЕНО: Сохранение информации о типах отпусков
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
    
    console.log(`[TimetableDataProcessorCore] *** PROCESSING WEEK ${week.weekNum} FOR EXCEL v4.0 *** with enhanced markers and leave type preservation`);

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
    
    console.log(`[TimetableDataProcessorCore] *** EXCEL WEEK ${week.weekNum} COMPLETED v4.0 ***`);
    return weeklyData;
  }

  /**
   * ИСПРАВЛЕННЫЙ МЕТОД v4.0: Обработка дневных данных специально для Excel экспорта
   * КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Полное сохранение информации о типах отпусков
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
    
    console.log(`[TimetableDataProcessorCore] *** PROCESSING DAY ${dayNumber} FOR EXCEL v4.0 *** with enhanced markers`);
    
    // Используем улучшенный метод для получения смен И отметок
    const shifts = TimetableShiftCalculatorCore.getShiftsAndMarkersForDay ?
      TimetableShiftCalculatorCore.getShiftsAndMarkersForDay(
        weekRecords,
        dayNumber,
        weekStart,
        weekEnd,
        getLeaveTypeColor
      ) : TimetableShiftCalculator.getShiftsForDay(
        weekRecords,
        dayNumber,
        weekStart,
        weekEnd,
        getLeaveTypeColor
      );

    // *** ДОПОЛНИТЕЛЬНО v4.0: Анализируем записи для извлечения информации о типах отпусков ***
    const allDayRecords = this.getAllRecordsForDayEnhanced(weekRecords, dayNumber, weekStart, weekEnd);
    const leaveInfo = this.analyzeLeaveInfoFromRecordsEnhanced(allDayRecords, getLeaveTypeColor);
    const holidayInfo = this.analyzeHolidayInfoFromRecords(allDayRecords);

    const totalMinutes = shifts.reduce((sum, shift) => {
      return shift.workMinutes > 0 ? sum + shift.workMinutes : sum;
    }, 0);
    
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // *** ИСПРАВЛЕНО v4.0: Улучшенное форматирование для Excel ***
    if (shifts.length === 0) {
      if (holidayInfo.hasNonWorkHoliday) {
        formattedContent = 'Holiday';
      } else if (leaveInfo.hasNonWorkLeave && leaveInfo.leaveTypeTitle) {
        formattedContent = leaveInfo.leaveTypeTitle; // *** v4.0: Полное название типа отпуска ***
        console.log(`[TimetableDataProcessorCore] *** v4.0 EXCEL: Set leave title: ${leaveInfo.leaveTypeTitle} ***`);
      }
    }

    const hasHolidayInWorkShifts = shifts.some(s => s.isHoliday && s.workMinutes > 0);
    const hasLeaveInWorkShifts = shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);
    const hasHolidayMarkers = shifts.some(s => s.isHoliday && s.workMinutes === 0) || holidayInfo.hasNonWorkHoliday;
    const hasLeaveMarkers = shifts.some(s => s.typeOfLeaveId && s.workMinutes === 0) || leaveInfo.hasNonWorkLeave;

    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColorSmart(shifts, getLeaveTypeColor) || leaveInfo.leaveTypeColor;
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts) || leaveInfo.hasNonWorkLeave;
    const hasHoliday = TimetableShiftCalculator.hasHolidays ?
      TimetableShiftCalculator.hasHolidays(shifts) :
      shifts.some(s => s.isHoliday) || holidayInfo.hasNonWorkHoliday;
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    let finalCellColor: string | undefined = undefined;
    if (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) {
      finalCellColor = holidayColorFinal;
    } else if ((hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts) && leaveTypeColor) {
      finalCellColor = leaveTypeColor;
    }

    console.log(`[TimetableDataProcessorCore] *** v4.0 EXCEL: Day ${dayNumber} analysis ***`, {
      hasWorkShifts: shifts.some(s => s.workMinutes > 0),
      hasLeaveInfo: leaveInfo.hasNonWorkLeave,
      leaveTypeTitle: leaveInfo.leaveTypeTitle,
      leaveTypeColor: leaveInfo.leaveTypeColor,
      finalCellColor,
      formattedContent
    });

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent, // *** v4.0: Содержит полные названия типов отпусков ***
      hasData: shifts.length > 0 || leaveInfo.hasNonWorkLeave || holidayInfo.hasNonWorkHoliday,
      leaveTypeColor, // *** v4.0: Включает информацию из non-work записей ***
      hasLeave: hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts || leaveInfo.hasNonWorkLeave,
      hasHoliday: hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts,
      holidayColor: (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * НОВЫЙ МЕТОД v4.0: Подсчитывает количество праздников в недельных данных
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

  // *** НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ v4.0 ***

  /**
   * НОВЫЙ МЕТОД v4.0: Диагностика обработки недели с анализом типов отпусков
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
    leaveTypesFound: Array<{ id: string; title?: string; color?: string; count: number }>;
    processingQuality: string;
  } {
    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);
    const recordsByDay: Record<number, number> = {};
    let recordsWithLeave = 0;
    let recordsWithHoliday = 0;
    let recordsWithWorkTime = 0;
    let recordsWithoutWorkTime = 0;
    
    // *** НОВОЕ v4.0: Анализ типов отпусков ***
    const leaveTypesMap = new Map<string, { id: string; title?: string; color?: string; count: number }>();

    weekRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      const dayNumber = TimetableShiftCalculatorCore.getDayNumber(recordDate);
      recordsByDay[dayNumber] = (recordsByDay[dayNumber] || 0) + 1;

      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeave++;
        
        // *** v4.0: Собираем информацию о типах отпусков ***
        const leaveTypeId = record.TypeOfLeaveID;
        if (!leaveTypesMap.has(leaveTypeId)) {
          const leaveTypeColor = getLeaveTypeColor ? getLeaveTypeColor(leaveTypeId) : undefined;
          leaveTypesMap.set(leaveTypeId, {
            id: leaveTypeId,
            title: record.TypeOfLeave?.Title,
            color: leaveTypeColor,
            count: 0
          });
        }
        leaveTypesMap.get(leaveTypeId)!.count++;
      }
      
      if (record.Holiday === 1) recordsWithHoliday++;

      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 &&
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 &&
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      if (hasWorkTime) {
        recordsWithWorkTime++;
      } else {
        recordsWithoutWorkTime++;
      }
    });

    const leaveTypesFound: Array<{ id: string; title?: string; color?: string; count: number }> = [];
    leaveTypesMap.forEach(leaveType => {
      leaveTypesFound.push(leaveType);
    });

    let processingQuality = 'UNKNOWN';
    if (weekRecords.length === 0) {
      processingQuality = 'NO_DATA';
    } else if (recordsWithLeave > 0 && !getLeaveTypeColor) {
      processingQuality = 'MISSING_COLOR_FUNCTION';
    } else if (recordsWithLeave > 0 && leaveTypesFound.some(lt => !lt.color)) {
      processingQuality = 'PARTIAL_COLORS_MISSING';
    } else if (recordsWithoutWorkTime > recordsWithWorkTime) {
      processingQuality = 'MOSTLY_MARKERS';
    } else {
      processingQuality = 'GOOD';
    }

    console.log(`[TimetableDataProcessorCore] *** v4.0: Week ${week.weekNum} diagnosis ***`, {
      processingQuality,
      leaveTypesFound: leaveTypesFound.length,
      hasColorFunction: !!getLeaveTypeColor
    });

    return {
      weekNum: week.weekNum,
      totalRecords: weekRecords.length,
      recordsByDay,
      recordsWithLeave,
      recordsWithHoliday,
      recordsWithWorkTime,
      recordsWithoutWorkTime,
      hasColorFunction: !!getLeaveTypeColor,
      leaveTypesFound,
      processingQuality
    };
  }

  /**
   * НОВЫЙ МЕТОД v4.0: Получает статистику обработки с анализом типов отпусков
   */
  public static getProcessingStatistics(weeklyData: IWeeklyStaffData): {
    weekNum: number;
    totalDays: number;
    daysWithData: number;
    daysWithLeave: number;
    daysWithHoliday: number;
    daysWithColors: number;
    daysWithLeaveNames: number;
    totalShifts: number;
    totalWorkMinutes: number;
    processingQuality: string;
    leaveTypeInfo: Array<{ day: number; title?: string; color?: string }>;
  } {
    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithData = days.filter(day => day.hasData).length;
    const daysWithLeave = days.filter(day => day.hasLeave).length;
    const daysWithHoliday = days.filter(day => day.hasHoliday).length;
    const daysWithColors = days.filter(day => day.finalCellColor && day.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND).length;
    const totalShifts = days.reduce((sum, day) => sum + day.shifts.length, 0);

    // *** НОВОЕ v4.0: Анализ названий типов отпусков ***
    const daysWithLeaveNames = days.filter(day => 
      day.hasLeave && day.formattedContent && 
      !day.formattedContent.startsWith('Type ') && 
      day.formattedContent !== 'Leave'
    ).length;

    const leaveTypeInfo: Array<{ day: number; title?: string; color?: string }> = [];
    days.forEach(day => {
      if (day.hasLeave) {
        leaveTypeInfo.push({
          day: day.dayNumber,
          title: day.formattedContent,
          color: day.leaveTypeColor
        });
      }
    });

    let processingQuality = 'UNKNOWN';
    if (daysWithData === 0) {
      processingQuality = 'NO_DATA';
    } else if (daysWithLeave > 0 && daysWithColors === 0) {
      processingQuality = 'COLORS_MISSING';
    } else if (daysWithLeave > 0 && daysWithLeaveNames === 0) {
      processingQuality = 'NAMES_MISSING';
    } else if (daysWithColors > 0 && daysWithLeaveNames > 0) {
      processingQuality = 'EXCELLENT';
    } else if (daysWithColors > 0) {
      processingQuality = 'COLORS_APPLIED';
    } else {
      processingQuality = 'BASIC_DATA';
    }

    console.log(`[TimetableDataProcessorCore] *** v4.0: Week ${weeklyData.weekNum} statistics ***`, {
      processingQuality,
      daysWithLeaveNames,
      daysWithColors,
      leaveTypeInfoCount: leaveTypeInfo.length
    });

    return {
      weekNum: weeklyData.weekNum,
      totalDays: days.length,
      daysWithData,
      daysWithLeave,
      daysWithHoliday,
      daysWithColors,
      daysWithLeaveNames,
      totalShifts,
      totalWorkMinutes: weeklyData.totalWeekMinutes,
      processingQuality,
      leaveTypeInfo
    };
  }

  /**
   * НОВЫЙ МЕТОД v4.0: Валидация результатов обработки с проверкой типов отпусков
   */
  public static validateProcessingResults(weeklyData: IWeeklyStaffData): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    recommendations: string[];
    leaveTypeValidation: {
      daysWithLeave: number;
      daysWithProperNames: number;
      daysWithColors: number;
      daysShowingTypeX: number;
    };
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithLeave = days.filter(day => day.hasLeave);
    const daysWithHoliday = days.filter(day => day.hasHoliday);
    //const daysWithColors = days.filter(day => day.finalCellColor && day.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND);

    // *** НОВАЯ ВАЛИДАЦИЯ v4.0: Проверка типов отпусков ***
    const daysWithProperNames = daysWithLeave.filter(day => 
      day.formattedContent && 
      !day.formattedContent.startsWith('Type ') && 
      day.formattedContent !== 'Leave' &&
      day.formattedContent !== '-'
    ).length;

    const daysShowingTypeX = daysWithLeave.filter(day => 
      day.formattedContent && day.formattedContent.startsWith('Type ')
    ).length;

    const daysWithLeaveColors = daysWithLeave.filter(day => day.leaveTypeColor).length;

    // Проверка дней недели
    if (days.length !== 7) {
      issues.push(`Expected 7 days, got ${days.length}`);
    }

    // *** НОВЫЕ ПРОВЕРКИ v4.0: Типы отпусков ***
    if (daysShowingTypeX > 0) {
      issues.push(`${daysShowingTypeX} days showing "Type X" instead of proper leave names`);
      recommendations.push('Check getLeaveTypeTitle function and TypeOfLeave data loading');
    }

    if (daysWithLeave.length > 0 && daysWithLeaveColors === 0) {
      issues.push('Leave days found but no colors applied');
      recommendations.push('Check getLeaveTypeColor function and TypeOfLeave configuration');
    }

    if (daysWithLeave.length > 0 && daysWithProperNames === 0) {
      warnings.push('Leave days found but no proper names displayed');
      recommendations.push('Verify TypeOfLeave.Title field population and getLeaveTypeTitle function');
    }

    // Проверка формата данных
    days.forEach((day, index) => {
      if (!day.formattedContent && day.hasData) {
        warnings.push(`Day ${index + 1} has data but no formatted content`);
      }
      if (day.hasLeave && !day.leaveTypeColor) {
        warnings.push(`Day ${index + 1} has leave but no leave color`);
      }
      if (day.hasLeave && day.formattedContent?.startsWith('Type ')) {
        warnings.push(`Day ${index + 1} showing leave type ID instead of name: ${day.formattedContent}`);
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

    // *** НОВЫЕ РЕКОМЕНДАЦИИ v4.0 ***
    if (daysWithHoliday.length > 0 && daysWithLeave.length > 0) {
      recommendations.push('Holiday priority system active - ensure proper color overrides');
    }

    if (daysWithLeave.length > 0 && daysWithProperNames / daysWithLeave.length < 0.8) {
      recommendations.push('Less than 80% of leave days have proper names - check TypeOfLeave.Title field');
    }

    if (daysWithLeave.length > 0 && daysWithLeaveColors / daysWithLeave.length < 0.8) {
      recommendations.push('Less than 80% of leave days have colors - check getLeaveTypeColor function');
    }

    const isValid = issues.length === 0;

    const leaveTypeValidation = {
      daysWithLeave: daysWithLeave.length,
      daysWithProperNames,
      daysWithColors: daysWithLeaveColors,
      daysShowingTypeX
    };

    console.log(`[TimetableDataProcessorCore] *** v4.0: Validation completed ***`, {
      isValid,
      issuesCount: issues.length,
      warningsCount: warnings.length,
      leaveTypeValidation
    });

    return {
      isValid,
      issues,
      warnings,
      recommendations,
      leaveTypeValidation
    };
  }

  /**
   * *** НОВЫЙ МЕТОД v4.0 ***
   * Создает сводку обработки с акцентом на типы отпусков
   */
  public static createProcessingSummary(
    weeklyData: IWeeklyStaffData,
    staffRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    weekNum: number;
    summary: string;
    leaveTypesSummary: string;
    qualityScore: number;
    recommendations: string[];
    details: {
      totalDays: number;
      daysWithData: number;
      daysWithLeave: number;
      daysWithProperLeaveNames: number;
      daysWithLeaveColors: number;
      daysShowingTypeIds: number;
    };
  } {
    const stats = this.getProcessingStatistics(weeklyData);
    const validation = this.validateProcessingResults(weeklyData);
    
    const details = {
      totalDays: stats.totalDays,
      daysWithData: stats.daysWithData,
      daysWithLeave: stats.daysWithLeave,
      daysWithProperLeaveNames: stats.daysWithLeaveNames,
      daysWithLeaveColors: validation.leaveTypeValidation.daysWithColors,
      daysShowingTypeIds: validation.leaveTypeValidation.daysShowingTypeX
    };

    // *** ВЫЧИСЛЯЕМ КАЧЕСТВЕННЫЙ БАЛЛ v4.0 ***
    let qualityScore = 100;
    
    if (details.daysShowingTypeIds > 0) {
      qualityScore -= (details.daysShowingTypeIds / details.daysWithLeave) * 30; // -30% за показ ID
    }
    
    if (details.daysWithLeave > 0) {
      const colorsCoverage = details.daysWithLeaveColors / details.daysWithLeave;
      if (colorsCoverage < 1) {
        qualityScore -= (1 - colorsCoverage) * 25; // -25% за отсутствие цветов
      }
      
      const namesCoverage = details.daysWithProperLeaveNames / details.daysWithLeave;
      if (namesCoverage < 1) {
        qualityScore -= (1 - namesCoverage) * 25; // -25% за отсутствие имен
      }
    }

    qualityScore = Math.max(0, Math.round(qualityScore));

    // *** СОЗДАЕМ СВОДКИ ***
    const summary = `Week ${weeklyData.weekNum}: ${details.daysWithData}/${details.totalDays} days with data, ` +
                   `${details.daysWithLeave} leave days, quality score: ${qualityScore}%`;

    const leaveTypesSummary = details.daysWithLeave > 0 ? 
      `Leave types: ${details.daysWithProperLeaveNames}/${details.daysWithLeave} with proper names, ` +
      `${details.daysWithLeaveColors}/${details.daysWithLeave} with colors` +
      (details.daysShowingTypeIds > 0 ? `, ${details.daysShowingTypeIds} showing IDs` : '') :
      'No leave days found';

    const recommendations: string[] = [...validation.recommendations];
    
    if (qualityScore < 80) {
      recommendations.push('Quality score below 80% - review leave type configuration');
    }
    
    if (details.daysShowingTypeIds > 0) {
      recommendations.push('Some days showing "Type X" - ensure TypeOfLeave.Title is populated');
    }

    console.log(`[TimetableDataProcessorCore] *** v4.0: Processing summary created ***`, {
      weekNum: weeklyData.weekNum,
      qualityScore,
      summary,
      leaveTypesSummary
    });

    return {
      weekNum: weeklyData.weekNum,
      summary,
      leaveTypesSummary,
      qualityScore,
      recommendations,
      details
    };
  }

  /**
   * *** ФИНАЛЬНЫЙ МЕТОД v4.0 ***
   * Проверяет качество обработки типов отпусков
   */
  public static assessLeaveTypeProcessingQuality(
    weeksData: Array<{ weekData: IWeeklyStaffData }>,
    overallStats?: { 
      totalRecords: number; 
      recordsWithLeave: number; 
      hasLeaveTypeColorFunction: boolean 
    }
  ): {
    overallQuality: string;
    qualityScore: number;
    recommendations: string[];
    weeklyScores: Array<{ weekNum: number; score: number; issues: string[] }>;
    leaveTypesCoverage: {
      totalDaysWithLeave: number;
      daysWithProperNames: number;
      daysWithColors: number;
      daysShowingIds: number;
      coveragePercentage: number;
    };
  } {
    console.log(`[TimetableDataProcessorCore] *** v4.0: ASSESSING LEAVE TYPE PROCESSING QUALITY ***`);
    
    let totalDaysWithLeave = 0;
    let daysWithProperNames = 0;
    let daysWithColors = 0;
    let daysShowingIds = 0;
    const weeklyScores: Array<{ weekNum: number; score: number; issues: string[] }> = [];

    weeksData.forEach(weekGroup => {
      const summary = this.createProcessingSummary(weekGroup.weekData, []);
      const weekIssues: string[] = [];
      
      totalDaysWithLeave += summary.details.daysWithLeave;
      daysWithProperNames += summary.details.daysWithProperLeaveNames;
      daysWithColors += summary.details.daysWithLeaveColors;
      daysShowingIds += summary.details.daysShowingTypeIds;
      
      if (summary.details.daysShowingTypeIds > 0) {
        weekIssues.push(`${summary.details.daysShowingTypeIds} days showing Type IDs`);
      }
      
      if (summary.details.daysWithLeave > 0 && summary.details.daysWithLeaveColors === 0) {
        weekIssues.push('No leave colors applied');
      }

      weeklyScores.push({
        weekNum: weekGroup.weekData.weekNum,
        score: summary.qualityScore,
        issues: weekIssues
      });
    });

    const coveragePercentage = totalDaysWithLeave > 0 ? 
      Math.round(((daysWithProperNames + daysWithColors) / (totalDaysWithLeave * 2)) * 100) : 100;

    let qualityScore = coveragePercentage;
    const recommendations: string[] = [];

    // *** ОПРЕДЕЛЯЕМ ОБЩЕЕ КАЧЕСТВО ***
    let overallQuality = 'UNKNOWN';
    
    if (totalDaysWithLeave === 0) {
      overallQuality = 'NO_LEAVE_DAYS';
      qualityScore = 100;
    } else if (daysShowingIds === 0 && daysWithProperNames === totalDaysWithLeave && daysWithColors === totalDaysWithLeave) {
      overallQuality = 'EXCELLENT';
      qualityScore = 100;
    } else if (daysShowingIds === 0 && daysWithProperNames > totalDaysWithLeave * 0.8) {
      overallQuality = 'GOOD';
      qualityScore = Math.max(80, qualityScore);
    } else if (daysShowingIds < totalDaysWithLeave * 0.2) {
      overallQuality = 'FAIR';
      qualityScore = Math.max(60, qualityScore);
    } else {
      overallQuality = 'POOR';
      qualityScore = Math.min(50, qualityScore);
    }

    // *** ГЕНЕРИРУЕМ РЕКОМЕНДАЦИИ ***
    if (daysShowingIds > 0) {
      recommendations.push(`${daysShowingIds} days showing "Type X" instead of names - check TypeOfLeave.Title field`);
    }
    
    if (totalDaysWithLeave > 0 && daysWithColors < totalDaysWithLeave) {
      recommendations.push(`${totalDaysWithLeave - daysWithColors} leave days missing colors - check getLeaveTypeColor function`);
    }
    
    if (overallStats && !overallStats.hasLeaveTypeColorFunction && overallStats.recordsWithLeave > 0) {
      recommendations.push('getLeaveTypeColor function not available - colors cannot be applied');
    }

    const leaveTypesCoverage = {
      totalDaysWithLeave,
      daysWithProperNames,
      daysWithColors,
      daysShowingIds,
      coveragePercentage
    };

    console.log(`[TimetableDataProcessorCore] *** v4.0: LEAVE TYPE QUALITY ASSESSMENT COMPLETED ***`, {
      overallQuality,
      qualityScore,
      leaveTypesCoverage,
      recommendationsCount: recommendations.length
    });

    return {
      overallQuality,
      qualityScore,
      recommendations,
      weeklyScores,
      leaveTypesCoverage
    };
  }
}