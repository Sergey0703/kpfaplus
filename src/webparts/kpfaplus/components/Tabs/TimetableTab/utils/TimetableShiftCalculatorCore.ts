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
 * ОБНОВЛЕНО: Полный переход на числовые поля времени + Date-only поддержка
 * Версия 5.0 - Date-only support with numeric time fields
 */
export class TimetableShiftCalculatorCore {

  /**
   * Рассчитывает рабочие минуты для одной смены
   * ОБНОВЛЕНО v5.0: Date-only поддержка для recordDate
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
      // *** Date-only parameters ***
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

    // *** ОБНОВЛЕНО v5.0: Date-only holiday detection ***
    let finalIsHoliday = false;
    if (recordDate && holidays && holidaysService) {
      // recordDate теперь date-only, сравниваем только даты
      finalIsHoliday = holidaysService.isHoliday(recordDate, holidays);
      console.log(`[TimetableShiftCalculatorCore] v5.0 Date-only holiday check: ${recordDate.toLocaleDateString()} = ${finalIsHoliday}`);
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
   * ОБНОВЛЕНО v5.0: Извлекает время из записи используя числовые поля
   * Date-only: поле Date больше не содержит время
   */
  private static extractTimeFromRecord(record: IStaffRecord): {
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
    isValidTime: boolean;
    recordDate: Date; // Date-only
  } {
    console.log(`[TimetableShiftCalculatorCore] v5.0: Extracting time from numeric fields for record ${record.ID}`);
    
    // *** ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
    const startHours = record.ShiftDate1Hours ?? 0;
    const startMinutes = record.ShiftDate1Minutes ?? 0;
    const endHours = record.ShiftDate2Hours ?? 0;
    const endMinutes = record.ShiftDate2Minutes ?? 0;
    
    // *** Date-only поле ***
    const recordDate = new Date(record.Date);
    
    console.log(`[TimetableShiftCalculatorCore] v5.0: Record ${record.ID} data:`, {
      date: recordDate.toLocaleDateString(),
      dateISO: recordDate.toISOString(),
      time: `${startHours}:${startMinutes.toString().padStart(2, '0')} - ${endHours}:${endMinutes.toString().padStart(2, '0')}`,
      numericFields: { startHours, startMinutes, endHours, endMinutes }
    });
    
    // Валидация числовых значений времени
    const isValidTime = (
      startHours >= 0 && startHours <= 23 &&
      startMinutes >= 0 && startMinutes <= 59 &&
      endHours >= 0 && endHours <= 23 &&
      endMinutes >= 0 && endMinutes <= 59
    );
    
    if (!isValidTime) {
      console.warn(`[TimetableShiftCalculatorCore] v5.0: Invalid time values in record ${record.ID}:`, {
        startHours, startMinutes, endHours, endMinutes
      });
    }
    
    // *** ВАЖНО: Date теперь date-only, не нужно проверять время в Date ***
    if (isNaN(recordDate.getTime())) {
      console.warn(`[TimetableShiftCalculatorCore] v5.0: Invalid date in record ${record.ID}`);
    }
    
    return {
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      isValidTime,
      recordDate
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Создает объект Date с числовыми компонентами времени
   * baseDate теперь date-only
   */
  private static createTimeFromNumericComponents(baseDate: Date, hours: number, minutes: number): Date {
    // Создаем новую дату на основе date-only поля
    const result = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    result.setHours(hours, minutes, 0, 0);
    
    console.log(`[TimetableShiftCalculatorCore] v5.0: Created time from date-only base:`, {
      baseDateOnly: baseDate.toLocaleDateString(),
      time: `${hours}:${minutes}`,
      result: result.toISOString()
    });
    
    return result;
  }

  /**
   * ОБНОВЛЕНО v5.0: Обрабатывает записи StaffRecord в IShiftInfo
   * Date-only support + числовые поля времени
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IShiftInfo[] {
    console.log(`[TimetableShiftCalculatorCore] v5.0: Processing ${records.length} records with date-only support`);
    
    if (records.length === 0) {
      return [];
    }

    const validRecords = records.filter(record => {
      const timeData = this.extractTimeFromRecord(record);
      
      if (!timeData.isValidTime) {
        console.warn(`[TimetableShiftCalculatorCore] v5.0: Skipping record ${record.ID} - invalid numeric time`);
        return false;
      }

      // *** Date-only валидация ***
      if (isNaN(timeData.recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] v5.0: Skipping record ${record.ID} - invalid date-only field`);
        return false;
      }

      const { startHours, startMinutes, endHours, endMinutes } = timeData;
      
      // Пропускаем записи 00:00 - 00:00 (они будут обработаны как отметки)
      if (startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0) {
        console.log(`[TimetableShiftCalculatorCore] v5.0: Skipping record ${record.ID} - zero time (marker only)`);
        return false;
      }

      return true;
    });

    console.log(`[TimetableShiftCalculatorCore] v5.0: Valid records after filtering: ${validRecords.length}`);

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
   * ОБНОВЛЕНО v5.0: Создает смены из отсортированных записей
   * Date-only support + числовые поля времени
   */
  private static createShiftsFromRecords(
    sortedRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidays?: IHoliday[],
    holidaysService?: HolidaysService
  ): IShiftInfo[] {
    console.log(`[TimetableShiftCalculatorCore] v5.0: Creating shifts with date-only support`);
    
    const shifts: IShiftInfo[] = sortedRecords.map(record => {
      console.log(`[TimetableShiftCalculatorCore] v5.0: Processing record ${record.ID}`);
      
      // *** ИЗВЛЕКАЕМ ДАННЫЕ ИЗ ЧИСЛОВЫХ ПОЛЕЙ + DATE-ONLY ***
      const timeData = this.extractTimeFromRecord(record);
      const { startHours, startMinutes, endHours, endMinutes, recordDate } = timeData;
      
      // Создаем объекты Date из числовых компонентов времени и date-only даты
      const startTime = this.createTimeFromNumericComponents(recordDate, startHours, startMinutes);
      const endTime = this.createTimeFromNumericComponents(recordDate, endHours, endMinutes);
      
      console.log(`[TimetableShiftCalculatorCore] v5.0: Created times for record ${record.ID}:`, {
        dateOnly: recordDate.toLocaleDateString(),
        timeNumeric: `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      // *** ОБРАБОТКА ОБЕДА (ShiftDate3/ShiftDate4 остаются Date объектами) ***
      const lunchStart = record.ShiftDate3 ? new Date(record.ShiftDate3) : undefined;
      const lunchEnd = record.ShiftDate4 ? new Date(record.ShiftDate4) : undefined;
      const timeForLunch = record.TimeForLunch || 0;

      if (lunchStart && isNaN(lunchStart.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] v5.0: Invalid ShiftDate3 in record ${record.ID}`);
      }
      if (lunchEnd && isNaN(lunchEnd.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] v5.0: Invalid ShiftDate4 in record ${record.ID}`);
      }

      // *** ОБРАБОТКА ТИПОВ ОТПУСКОВ ***
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

      // *** ОБНОВЛЕНО v5.0: Date-only holiday detection ***
      let isHoliday = false;
      let holidayColor: string | undefined = undefined;

      if (holidays && holidaysService) {
        // recordDate теперь date-only, идеально для сравнения с holidays
        isHoliday = holidaysService.isHoliday(recordDate, holidays);
        if (isHoliday) {
          holidayColor = TIMETABLE_COLORS.HOLIDAY;
          console.log(`[TimetableShiftCalculatorCore] v5.0: Holiday detected for date-only ${recordDate.toLocaleDateString()}`);
        }
      }

      // *** РАСЧЕТ СМЕНЫ ***
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
        // *** Date-only parameters ***
        recordDate, // Date-only поле
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

      console.log(`[TimetableShiftCalculatorCore] v5.0: Created shift:`, {
        recordId: record.ID,
        dateOnly: recordDate.toLocaleDateString(),
        time: `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`,
        workMinutes: calculation.workMinutes,
        isHoliday: calculation.isHoliday
      });

      return shift;
    });
    
    console.log(`[TimetableShiftCalculatorCore] v5.0: Created ${shifts.length} shifts with date-only support`);
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
   * ОБНОВЛЕНО v5.0: Получает все смены для конкретного дня недели из записей
   * Date-only support для фильтрации по дням
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
    console.log(`[TimetableShiftCalculatorCore] v5.0: Getting shifts for day ${dayNumber} with date-only support`);
    
    const dayRecords = records.filter(record => {
      // *** Date-only фильтрация ***
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] v5.0: Invalid date-only field in record ${record.ID}`);
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      
      // *** Date-only сравнение для проверки принадлежности к неделе ***
      const isInWeek = this.isDateInWeekDateOnly(recordDate, weekStart, weekEnd);
      const isCorrectDay = recordDayNumber === dayNumber;
      
      console.log(`[TimetableShiftCalculatorCore] v5.0: Record ${record.ID} day filter:`, {
        recordDate: recordDate.toLocaleDateString(),
        recordDayNumber,
        targetDayNumber: dayNumber,
        isCorrectDay,
        isInWeek
      });
      
      return isCorrectDay && isInWeek;
    });

    console.log(`[TimetableShiftCalculatorCore] v5.0: Found ${dayRecords.length} records for day ${dayNumber}`);
    
    return this.processStaffRecordsToShifts(dayRecords, getLeaveTypeColor, holidays, holidaysService);
  }

  /**
   * НОВЫЙ МЕТОД v5.0: Date-only проверка принадлежности к неделе
   */
  private static isDateInWeekDateOnly(date: Date, weekStart: Date, weekEnd: Date): boolean {
    // Нормализуем все даты к полуночи для точного сравнения
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const normalizedWeekStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    const normalizedWeekEnd = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate());
    
    const result = normalizedDate >= normalizedWeekStart && normalizedDate <= normalizedWeekEnd;
    
    console.log(`[TimetableShiftCalculatorCore] v5.0: Date-only week check:`, {
      date: normalizedDate.toLocaleDateString(),
      weekStart: normalizedWeekStart.toLocaleDateString(),
      weekEnd: normalizedWeekEnd.toLocaleDateString(),
      isInWeek: result
    });
    
    return result;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает ВСЕ записи для конкретного дня недели
   * Date-only support
   */
  public static getAllRecordsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    console.log(`[TimetableShiftCalculatorCore] v5.0: Getting all records for day ${dayNumber} with date-only support`);
    
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] v5.0: Invalid date-only field in record ${record.ID}`);
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      const isInWeek = this.isDateInWeekDateOnly(recordDate, weekStart, weekEnd);
      const isCorrectDay = recordDayNumber === dayNumber;
      
      return isCorrectDay && isInWeek;
    });

    console.log(`[TimetableShiftCalculatorCore] v5.0: Found ${dayRecords.length} total records for day ${dayNumber}`);
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
   * ОБНОВЛЕНО v5.0: Извлекает информацию о типе отпуска из записей дня без рабочего времени
   * Date-only support
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
    console.log(`[TimetableShiftCalculatorCore] v5.0: Extracting leave info with date-only support`);
    
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // *** ПРОВЕРЯЕМ ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
      const timeData = this.extractTimeFromRecord(record);
      const hasWorkTime = !(timeData.startHours === 0 && timeData.startMinutes === 0 && 
                           timeData.endHours === 0 && timeData.endMinutes === 0);
      
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      console.log(`[TimetableShiftCalculatorCore] v5.0: Record ${record.ID} leave analysis:`, {
        dateOnly: timeData.recordDate.toLocaleDateString(),
        hasWorkTime,
        hasLeaveType,
        leaveTypeId: record.TypeOfLeaveID
      });
      
      return !hasWorkTime && hasLeaveType;
    });

    if (nonWorkLeaveRecords.length === 0) {
      console.log(`[TimetableShiftCalculatorCore] v5.0: No non-work leave records found`);
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

    console.log(`[TimetableShiftCalculatorCore] v5.0: Extracted leave info:`, {
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    });

    return {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };
  }
}