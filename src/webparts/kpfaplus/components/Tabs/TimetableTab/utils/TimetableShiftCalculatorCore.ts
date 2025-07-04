// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorCore.ts
import { 
  IShiftCalculationParams, 
  IShiftCalculationResult, 
  IShiftInfo,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IHoliday, HolidaysService } from '../../../../services/HolidaysService';

/**
 * Основные функции расчета смен и времени
 * ИСПРАВЛЕНО: Удален fallback на поле Holiday - используется только HolidaysService
 */
export class TimetableShiftCalculatorCore {

  /**
   * Рассчитывает рабочие минуты для одной смены
   * ИСПРАВЛЕНО: Удален fallback на isHoliday параметр
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
      typeOfLeaveColor,
      holidayColor,
      // *** ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ ДЛЯ HOLIDAYS ***
      recordDate,
      holidays,
      holidaysService
    } = params;

    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    const isStartZero = startHour === 0 && startMinute === 0;
    const isEndZero = endHour === 0 && endMinute === 0;

    // *** ИСПРАВЛЕНО: Определяем isHoliday ТОЛЬКО через HolidaysService ***
    let finalIsHoliday = false;
    if (recordDate && holidays && holidaysService) {
      finalIsHoliday = holidaysService.isHoliday(recordDate, holidays);
    }

    if (isStartZero && isEndZero) {
      return {
        workMinutes: 0,
        formattedTime: "0h 00m",
        formattedShift: "00:00 - 00:00(0:00)",
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor,
        isHoliday: finalIsHoliday,
        holidayColor: finalIsHoliday ? (holidayColor || TIMETABLE_COLORS.HOLIDAY) : undefined
      };
    }

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    let totalShiftMinutes = 0;
    if (endMinutes <= startMinutes && endMinutes > 0) {
      totalShiftMinutes = endMinutes + (24 * 60) - startMinutes;
    } else if (endMinutes === 0) {
      totalShiftMinutes = (24 * 60) - startMinutes;
    } else {
      totalShiftMinutes = endMinutes - startMinutes;
    }

    let lunchMinutes = 0;
    if (timeForLunch && timeForLunch > 0) {
      lunchMinutes = timeForLunch;
    } else if (lunchStart && lunchEnd) {
      const lunchStartHour = lunchStart.getHours();
      const lunchStartMinute = lunchStart.getMinutes();
      const lunchEndHour = lunchEnd.getHours();
      const lunchEndMinute = lunchEnd.getMinutes();

      const isLunchStartZero = lunchStartHour === 0 && lunchStartMinute === 0;
      const isLunchEndZero = lunchEndHour === 0 && lunchEndMinute === 0;

      if (!isLunchStartZero || !isLunchEndZero) {
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMinute;
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMinute;
        
        if (lunchEndMinutes > lunchStartMinutes) {
          lunchMinutes = lunchEndMinutes - lunchStartMinutes;
        } else if (lunchEndMinutes < lunchStartMinutes) {
          lunchMinutes = lunchEndMinutes + (24 * 60) - lunchStartMinutes;
        }
      }
    }

    const workMinutes = Math.max(0, totalShiftMinutes - lunchMinutes);
    const formattedTime = this.formatMinutesToHours(workMinutes);
    const startTimeStr = this.formatTime(startTime);
    const endTimeStr = this.formatTime(endTime);
    const formattedWorkTime = this.formatMinutesToHoursMinutes(workMinutes);
    const formattedShift = `${startTimeStr}-${endTimeStr}(${formattedWorkTime})`;

    return {
      workMinutes,
      formattedTime,
      formattedShift,
      typeOfLeaveId,
      typeOfLeaveTitle,
      typeOfLeaveColor,
      isHoliday: finalIsHoliday,
      holidayColor: finalIsHoliday ? (holidayColor || TIMETABLE_COLORS.HOLIDAY) : undefined
    };
  }

  /**
   * Форматирует минуты в формат HH:MM для смен
   */
  public static formatMinutesToHoursMinutes(totalMinutes: number): string {
    if (totalMinutes === 0) {
      return "0:00";
    }

    if (totalMinutes < 0) {
      return "0:00";
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Извлекает время из записи используя числовые поля
   * НОВЫЙ МЕТОД: Использует ShiftDate1Hours/Minutes и ShiftDate2Hours/Minutes
   */
  private static extractTimeFromRecord(record: IStaffRecord): {
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
    isValidTime: boolean;
  } {
    console.log(`[TimetableShiftCalculatorCore] *** EXTRACTING TIME FROM NUMERIC FIELDS ***`);
    console.log(`[TimetableShiftCalculatorCore] Record ID: ${record.ID}`);
    
    // *** ИСПОЛЬЗУЕМ ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
    const startHours = record.ShiftDate1Hours ?? 0;
    const startMinutes = record.ShiftDate1Minutes ?? 0;
    const endHours = record.ShiftDate2Hours ?? 0;
    const endMinutes = record.ShiftDate2Minutes ?? 0;
    
    console.log(`[TimetableShiftCalculatorCore] Numeric time fields:`, {
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes,
      extracted: `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`
    });
    
    // Валидация числовых значений
    const isValidTime = (
      startHours >= 0 && startHours <= 23 &&
      startMinutes >= 0 && startMinutes <= 59 &&
      endHours >= 0 && endHours <= 23 &&
      endMinutes >= 0 && endMinutes <= 59
    );
    
    if (!isValidTime) {
      console.warn(`[TimetableShiftCalculatorCore] Invalid time values in record ${record.ID}:`, {
        startHours, startMinutes, endHours, endMinutes
      });
    }
    
    return {
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      isValidTime
    };
  }

  /**
   * Создает объект Date из числовых компонентов времени
   */
  private static createTimeFromNumericComponents(baseDate: Date, hours: number, minutes: number): Date {
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * ИСПРАВЛЕНО: Удален fallback на поле Holiday
   * Обрабатывает записи StaffRecord в IShiftInfo
   * Использует ТОЛЬКО HolidaysService для определения праздников
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IShiftInfo[] {
    console.log(`[TimetableShiftCalculatorCore] *** PROCESSING RECORDS WITH HOLIDAYS SERVICE ONLY ***`);
    console.log(`[TimetableShiftCalculatorCore] Processing ${records.length} records with ${holidays?.length || 0} holidays`);
    
    if (records.length === 0) {
      return [];
    }

    const validRecords = records.filter(record => {
      const timeData = this.extractTimeFromRecord(record);
      
      if (!timeData.isValidTime) {
        console.warn(`[TimetableShiftCalculatorCore] Skipping record ${record.ID} - invalid time values`);
        return false;
      }

      const { startHours, startMinutes, endHours, endMinutes } = timeData;
      
      // Пропускаем записи 00:00 - 00:00
      if (startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0) {
        console.log(`[TimetableShiftCalculatorCore] Skipping record ${record.ID} - zero time (00:00 - 00:00)`);
        return false;
      }

      return true;
    });

    console.log(`[TimetableShiftCalculatorCore] Valid records after filtering: ${validRecords.length}`);

    if (validRecords.length === 0) {
      return [];
    }

    const sortedRecords = validRecords.sort((a, b) => {
      const aTimeData = this.extractTimeFromRecord(a);
      const bTimeData = this.extractTimeFromRecord(b);
      
      const aStartMinutes = aTimeData.startHours * 60 + aTimeData.startMinutes;
      const bStartMinutes = bTimeData.startHours * 60 + bTimeData.startMinutes;
      
      return aStartMinutes - bStartMinutes;
    });

    return this.createShiftsFromRecords(sortedRecords, getLeaveTypeColor, holidays, holidaysService);
  }

  /**
   * ИСПРАВЛЕНО: Удален fallback на поле Holiday
   * Создает смены из отсортированных записей
   * Использует ТОЛЬКО HolidaysService для определения праздников
   */
  private static createShiftsFromRecords(
    sortedRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IShiftInfo[] {
    console.log(`[TimetableShiftCalculatorCore] *** CREATING SHIFTS WITH HOLIDAYS SERVICE ONLY ***`);
    
    const shifts: IShiftInfo[] = sortedRecords.map(record => {
      console.log(`[TimetableShiftCalculatorCore] Processing record ${record.ID} with holidays service only`);
      
      // *** ИЗВЛЕКАЕМ ВРЕМЯ ИЗ ЧИСЛОВЫХ ПОЛЕЙ ***
      const timeData = this.extractTimeFromRecord(record);
      const { startHours, startMinutes, endHours, endMinutes } = timeData;
      
      // Создаем объекты Date из числовых компонентов
      const baseDate = new Date(record.Date);
      const startTime = this.createTimeFromNumericComponents(baseDate, startHours, startMinutes);
      const endTime = this.createTimeFromNumericComponents(baseDate, endHours, endMinutes);
      
      console.log(`[TimetableShiftCalculatorCore] Created times for record ${record.ID}:`, {
        numeric: `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`,
        dates: `${startTime.toISOString()} - ${endTime.toISOString()}`
      });

      const lunchStart = record.ShiftDate3 ? new Date(record.ShiftDate3) : undefined;
      const lunchEnd = record.ShiftDate4 ? new Date(record.ShiftDate4) : undefined;
      const timeForLunch = record.TimeForLunch || 0;

      if (lunchStart && isNaN(lunchStart.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] Invalid ShiftDate3 in record ${record.ID}`);
      }
      if (lunchEnd && isNaN(lunchEnd.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] Invalid ShiftDate4 in record ${record.ID}`);
      }

      let typeOfLeaveId: string | undefined = undefined;
      let typeOfLeaveTitle: string | undefined = undefined;
      let typeOfLeaveColor: string | undefined = undefined;

      if (record.TypeOfLeaveID) {
        typeOfLeaveId = record.TypeOfLeaveID;
        
        if (getLeaveTypeColor) {
          typeOfLeaveColor = getLeaveTypeColor(typeOfLeaveId);
        }
        
        if (record.TypeOfLeave) {
          typeOfLeaveTitle = record.TypeOfLeave.Title;
        }
      }

      // *** ИСПРАВЛЕНО: Используем ТОЛЬКО HolidaysService - никаких fallback ***
      let isHoliday = false;
      let holidayColor: string | undefined = undefined;

      if (holidays && holidaysService) {
        isHoliday = holidaysService.isHoliday(baseDate, holidays);
        if (isHoliday) {
          holidayColor = TIMETABLE_COLORS.HOLIDAY;
          console.log(`[TimetableShiftCalculatorCore] *** HOLIDAY DETECTED via HolidaysService for record ${record.ID} on ${baseDate.toLocaleDateString()} ***`);
        }
      } else {
        console.log(`[TimetableShiftCalculatorCore] No holidays service or data available for record ${record.ID}`);
      }

      const calculation = this.calculateShiftMinutes({
        startTime,
        endTime,
        lunchStart: lunchStart && !isNaN(lunchStart.getTime()) ? lunchStart : undefined,
        lunchEnd: lunchEnd && !isNaN(lunchEnd.getTime()) ? lunchEnd : undefined,
        timeForLunch,
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor,
        holidayColor,
        // *** ОБЯЗАТЕЛЬНЫЕ: Передаем holidays данные ***
        recordDate: baseDate,
        holidays,
        holidaysService
      });

      const shift: IShiftInfo = {
        recordId: record.ID,
        startTime,
        endTime,
        lunchStart,
        lunchEnd,
        timeForLunch,
        workMinutes: calculation.workMinutes,
        formattedShift: calculation.formattedShift,
        typeOfLeaveId: calculation.typeOfLeaveId,
        typeOfLeaveTitle: calculation.typeOfLeaveTitle,
        typeOfLeaveColor: calculation.typeOfLeaveColor,
        isHoliday: calculation.isHoliday,
        holidayColor: calculation.holidayColor
      };

      console.log(`[TimetableShiftCalculatorCore] Created shift with holidays service only:`, {
        recordId: record.ID,
        time: `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`,
        workMinutes: calculation.workMinutes,
        formattedShift: calculation.formattedShift,
        isHoliday: calculation.isHoliday,
        holidayColor: calculation.holidayColor
      });

      return shift;
    });
    
    console.log(`[TimetableShiftCalculatorCore] *** CREATED ${shifts.length} SHIFTS WITH HOLIDAYS SERVICE ONLY ***`);
    return shifts;
  }

  /**
   * Форматирует содержимое дня
   */
  public static formatDayContent(shifts: IShiftInfo[]): string {
    if (shifts.length === 0) {
      return "";
    }

    const shiftLines = shifts.map(shift => shift.formattedShift);
    let content = shiftLines.join(";\n");

    if (shifts.length > 1) {
      const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
      const totalFormatted = this.formatMinutesToHours(totalMinutes);
      content += `\nTotal: ${totalFormatted}`;
    }

    return content;
  }

  /**
   * Рассчитывает недельные часы для сотрудника
   */
  public static calculateWeeklyHours(
    allShifts: IShiftInfo[]
  ): { totalMinutes: number; formattedTotal: string } {
    const totalMinutes = allShifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    const formattedTotal = this.formatMinutesToHours(totalMinutes);
    
    return {
      totalMinutes,
      formattedTotal: ` ${formattedTotal}`
    };
  }

  /**
   * Форматирует минуты в часы и минуты
   */
  public static formatMinutesToHours(totalMinutes: number): string {
    if (totalMinutes === 0) {
      return "0h 00m";
    }

    if (totalMinutes < 0) {
      return "0h 00m";
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  /**
   * Форматирует время в формате HH:mm
   */
  public static formatTime(date: Date): string {
    if (isNaN(date.getTime())) {
      return "00:00";
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Форматирует время в формате HH:mm:ss
   */
  public static formatTimeWithSeconds(date: Date): string {
    if (isNaN(date.getTime())) {
      return "00:00:00";
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * ИСПРАВЛЕНО: Удален fallback на поле Holiday
   * Получает все смены для конкретного дня недели из записей
   * Использует ТОЛЬКО HolidaysService для определения праздников
   */
  public static getShiftsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IShiftInfo[] {
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] Invalid date in record ${record.ID}`);
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      return isCorrectDay && isInWeek;
    });

    return this.processStaffRecordsToShifts(dayRecords, getLeaveTypeColor, holidays, holidaysService);
  }

  /**
   * Получает ВСЕ записи для конкретного дня недели
   */
  public static getAllRecordsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      return isCorrectDay && isInWeek;
    });

    return dayRecords;
  }

  /**
   * Получает номер дня недели для даты (1=Sunday, 2=Monday, etc.)
   */
  public static getDayNumber(date: Date): number {
    if (isNaN(date.getTime())) {
      return 1;
    }
    return date.getDay() + 1;
  }

  /**
   * Получает название дня недели по номеру
   */
  public static getDayName(dayNumber: number): string {
    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayNumber] || 'Unknown';
  }

  /**
   * ИСПРАВЛЕНО: Удален fallback на поле Holiday
   * Извлекает информацию о типе отпуска из записей дня без рабочего времени
   * Использует ТОЛЬКО HolidaysService для определения праздников
   */
  public static extractLeaveInfoFromNonWorkRecords(
    allDayRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): {
    hasNonWorkLeave: boolean;
    leaveTypeId?: string;
    leaveTypeTitle?: string;
    leaveTypeColor?: string;
  } {
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // *** ПРОВЕРЯЕМ ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
      const timeData = this.extractTimeFromRecord(record);
      const hasWorkTime = !(timeData.startHours === 0 && timeData.startMinutes === 0 && 
                           timeData.endHours === 0 && timeData.endMinutes === 0);
      
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      return !hasWorkTime && hasLeaveType;
    });

    if (nonWorkLeaveRecords.length === 0) {
      return { hasNonWorkLeave: false };
    }

    const leaveRecord = nonWorkLeaveRecords[0];
    const leaveTypeId = leaveRecord.TypeOfLeaveID;
    
    let leaveTypeTitle: string | undefined = undefined;
    
    if (leaveRecord.TypeOfLeave && leaveRecord.TypeOfLeave.Title) {
      leaveTypeTitle = leaveRecord.TypeOfLeave.Title;
    } else if (leaveTypeId) {
      leaveTypeTitle = leaveTypeId;
    }
    
    const leaveTypeColor = getLeaveTypeColor ? getLeaveTypeColor(leaveTypeId!) : undefined;

    return {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };
  }
}