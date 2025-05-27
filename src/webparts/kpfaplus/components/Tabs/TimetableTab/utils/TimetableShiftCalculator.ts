// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculator.ts
import { 
  IShiftCalculationParams, 
  IShiftCalculationResult, 
  IShiftInfo 
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Калькулятор смен и рабочего времени
 * Реплицирует логику из Power Apps формул FormatDayShifts, CalculateDayMinutes и др.
 */
export class TimetableShiftCalculator {

  /**
   * Рассчитывает рабочие минуты для одной смены
   * Реплицирует логику из Power Apps формул с учетом перехода через полночь и обеда
   */
  public static calculateShiftMinutes(params: IShiftCalculationParams): IShiftCalculationResult {
    const { startTime, endTime, lunchStart, lunchEnd, timeForLunch } = params;

    console.log('[TimetableShiftCalculator] Calculating shift:', {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      lunchStart: lunchStart?.toISOString(),
      lunchEnd: lunchEnd?.toISOString(),
      timeForLunch
    });

    // Проверяем на нулевые времена (00:00)
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    const isStartZero = startHour === 0 && startMinute === 0;
    const isEndZero = endHour === 0 && endMinute === 0;

    // Если оба времени нулевые, нет рабочего времени
    if (isStartZero && isEndZero) {
      return {
        workMinutes: 0,
        formattedTime: "0h 00m",
        formattedShift: "00:00 - 00:00 (0h 00m)"
      };
    }

    // Конвертируем времена в минуты
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Рассчитываем общее время смены с учетом перехода через полночь
    let totalShiftMinutes = 0;

    if (endMinutes <= startMinutes && endMinutes > 0) {
      // Переход через полночь
      totalShiftMinutes = endMinutes + (24 * 60) - startMinutes;
    } else if (endMinutes === 0) {
      // Конец смены в 00:00 (полночь следующего дня)
      totalShiftMinutes = (24 * 60) - startMinutes;
    } else {
      // Обычная смена в пределах одних суток
      totalShiftMinutes = endMinutes - startMinutes;
    }

    // Рассчитываем время обеда
    let lunchMinutes = 0;

    // Приоритет у timeForLunch если доступно
    if (timeForLunch && timeForLunch > 0) {
      lunchMinutes = timeForLunch;
      console.log('[TimetableShiftCalculator] Using timeForLunch:', timeForLunch);
    } else if (lunchStart && lunchEnd) {
      // Рассчитываем время обеда из ShiftDate3 и ShiftDate4
      const lunchStartHour = lunchStart.getHours();
      const lunchStartMinute = lunchStart.getMinutes();
      const lunchEndHour = lunchEnd.getHours();
      const lunchEndMinute = lunchEnd.getMinutes();

      // Проверяем, не являются ли времена обеда нулевыми
      const isLunchStartZero = lunchStartHour === 0 && lunchStartMinute === 0;
      const isLunchEndZero = lunchEndHour === 0 && lunchEndMinute === 0;

      if (!isLunchStartZero || !isLunchEndZero) {
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMinute;
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMinute;
        
        if (lunchEndMinutes > lunchStartMinutes) {
          lunchMinutes = lunchEndMinutes - lunchStartMinutes;
          console.log('[TimetableShiftCalculator] Using calculated lunch time:', lunchMinutes);
        } else if (lunchEndMinutes < lunchStartMinutes) {
          // Обед через полночь (редкий случай)
          lunchMinutes = lunchEndMinutes + (24 * 60) - lunchStartMinutes;
          console.log('[TimetableShiftCalculator] Using calculated lunch time (overnight):', lunchMinutes);
        }
      }
    }

    // Вычитаем время обеда из общего времени смены
    const workMinutes = Math.max(0, totalShiftMinutes - lunchMinutes);

    // Форматируем результат
    const formattedTime = this.formatMinutesToHours(workMinutes);
    const startTimeStr = this.formatTime(startTime);
    const endTimeStr = this.formatTime(endTime);
    const formattedShift = `${startTimeStr} - ${endTimeStr} (${formattedTime})`;

    console.log('[TimetableShiftCalculator] Calculated result:', {
      totalShiftMinutes,
      lunchMinutes,
      workMinutes,
      formattedTime,
      formattedShift
    });

    return {
      workMinutes,
      formattedTime,
      formattedShift
    };
  }

  /**
   * Обрабатывает записи StaffRecord в IShiftInfo
   * Реплицирует логику сортировки и обработки смен из Power Apps
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[]
  ): IShiftInfo[] {
    //console.log('[TimetableShiftCalculator] Processing records to shifts:', records.length);

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
      
      const startStr = this.formatTime(start);
      const endStr = this.formatTime(end);

      // Исключаем записи где оба времени 00:00
      if (startStr === "00:00" && endStr === "00:00") {
        console.log(`[TimetableShiftCalculator] Skipping record ${record.ID}: both times are 00:00`);
        return false;
      }

      return true;
    });

    console.log(`[TimetableShiftCalculator] Valid records: ${validRecords.length}/${records.length}`);

    if (validRecords.length === 0) {
      return [];
    }

    // Сортируем по времени начала (аналогично "ShiftDate1", "Ascending")
    const sortedRecords = validRecords.sort((a, b) => {
      const aStart = new Date(a.ShiftDate1!).getTime();
      const bStart = new Date(b.ShiftDate1!).getTime();
      return aStart - bStart;
    });

    // Преобразуем в IShiftInfo
    const shifts: IShiftInfo[] = sortedRecords.map(record => {
      const startTime = new Date(record.ShiftDate1!);
      const endTime = new Date(record.ShiftDate2!);
      const lunchStart = record.ShiftDate3 ? new Date(record.ShiftDate3) : undefined;
      const lunchEnd = record.ShiftDate4 ? new Date(record.ShiftDate4) : undefined;
      const timeForLunch = record.TimeForLunch || 0;

      // Проверяем валидность дат обеда
      if (lunchStart && isNaN(lunchStart.getTime())) {
        console.warn(`[TimetableShiftCalculator] Invalid ShiftDate3 in record ${record.ID}`);
      }
      if (lunchEnd && isNaN(lunchEnd.getTime())) {
        console.warn(`[TimetableShiftCalculator] Invalid ShiftDate4 in record ${record.ID}`);
      }

      const calculation = this.calculateShiftMinutes({
        startTime,
        endTime,
        lunchStart: lunchStart && !isNaN(lunchStart.getTime()) ? lunchStart : undefined,
        lunchEnd: lunchEnd && !isNaN(lunchEnd.getTime()) ? lunchEnd : undefined,
        timeForLunch
      });

      return {
        recordId: record.ID,
        startTime,
        endTime,
        lunchStart,
        lunchEnd,
        timeForLunch,
        workMinutes: calculation.workMinutes,
        formattedShift: calculation.formattedShift
      };
    });

    console.log('[TimetableShiftCalculator] Processed shifts:', shifts.length);
    
    // Логируем несколько примеров для отладки
    if (shifts.length > 0) {
      console.log('[TimetableShiftCalculator] Sample shifts:');
      shifts.slice(0, 3).forEach((shift, index) => {
        console.log(`  Shift ${index + 1}: ${shift.formattedShift} (${shift.workMinutes} min)`);
      });
    }

    return shifts;
  }

  /**
   * Форматирует содержимое дня (аналогично FormatDayShifts в Power Apps)
   */
  public static formatDayContent(shifts: IShiftInfo[]): string {
    if (shifts.length === 0) {
      return "";
    }

    // Формируем строки смен (аналогично Concat в Power Apps)
    const shiftLines = shifts.map(shift => shift.formattedShift);
    
    let content = shiftLines.join(";\n");

    // Если несколько смен, добавляем общий итог
    if (shifts.length > 1) {
      const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
      const totalFormatted = this.formatMinutesToHours(totalMinutes);
      content += `\nTotal: ${totalFormatted}`;
    }

    return content;
  }

  /**
   * Рассчитывает недельные часы для сотрудника
   * Реплицирует CalculateWeeklyHours из Power Apps
   */
  public static calculateWeeklyHours(
    allShifts: IShiftInfo[]
  ): { totalMinutes: number; formattedTotal: string } {
    const totalMinutes = allShifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    const formattedTotal = this.formatMinutesToHours(totalMinutes);
    
    return {
      totalMinutes,
      formattedTotal: ` ${formattedTotal}` // Пробел в начале как в Power Apps
    };
  }

  /**
   * Форматирует минуты в часы и минуты (аналогично FormatMinutesToHours в Power Apps)
   */
  public static formatMinutesToHours(totalMinutes: number): string {
    if (totalMinutes === 0) {
      return "0h 00m";
    }

    if (totalMinutes < 0) {
      return "0h 00m"; // Защита от отрицательных значений
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
      return "00:00"; // Защита от невалидных дат
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
   * Парсит строку времени в формате HH:mm в минуты
   */
  public static parseTimeStringToMinutes(timeString: string): number {
    if (!timeString || typeof timeString !== 'string') {
      return 0;
    }

    const parts = timeString.split(':');
    if (parts.length !== 2) {
      return 0;
    }

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) {
      return 0;
    }

    return hours * 60 + minutes;
  }

  /**
   * Создает дату с заданным временем для конкретного дня
   */
  public static createTimeForDate(baseDate: Date, hours: number, minutes: number): Date {
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Проверяет, является ли время нулевым (00:00)
   */
  public static isTimeZero(date: Date): boolean {
    if (isNaN(date.getTime())) {
      return true;
    }
    return date.getHours() === 0 && date.getMinutes() === 0;
  }

  /**
   * Проверяет, является ли время валидным рабочим временем
   */
  public static isValidWorkTime(startTime: Date, endTime: Date): boolean {
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return false;
    }

    // Проверяем, что оба времени не 00:00
    if (this.isTimeZero(startTime) && this.isTimeZero(endTime)) {
      return false;
    }

    // Можем добавить другие проверки валидности
    return true;
  }

  /**
   * Получает все смены для конкретного дня недели из записей
   */
  public static getShiftsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IShiftInfo[] {
   // console.log(`[TimetableShiftCalculator] Getting shifts for day ${dayNumber} in week ${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`);
    
    // Фильтруем записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculator] Invalid date in record ${record.ID}`);
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      if (isCorrectDay && isInWeek) {
        console.log(`[TimetableShiftCalculator] Found record for day ${dayNumber}: ${record.ID} on ${recordDate.toLocaleDateString()}`);
      }
      
      return isCorrectDay && isInWeek;
    });

    //console.log(`[TimetableShiftCalculator] Found ${dayRecords.length} records for day ${dayNumber}`);

    return this.processStaffRecordsToShifts(dayRecords);
  }

  /**
   * Получает номер дня недели для даты (1=Sunday, 2=Monday, etc.)
   */
  public static getDayNumber(date: Date): number {
    if (isNaN(date.getTime())) {
      return 1; // По умолчанию воскресенье
    }
    return date.getDay() + 1; // JS: 0=Sunday -> наш формат: 1=Sunday
  }

  /**
   * Получает название дня недели по номеру
   */
  public static getDayName(dayNumber: number): string {
    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayNumber] || 'Unknown';
  }

  /**
   * Вычисляет продолжительность между двумя временами в минутах
   */
  public static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return 0;
    }

    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

    if (endMinutes >= startMinutes) {
      return endMinutes - startMinutes;
    } else {
      // Переход через полночь
      return (24 * 60) - startMinutes + endMinutes;
    }
  }

  /**
   * Форматирует продолжительность в удобочитаемый формат
   */
  public static formatDuration(minutes: number): string {
    if (minutes <= 0) {
      return "0 min";
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes} min`;
    } else if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Получает статистику по сменам
   */
  public static getShiftsStatistics(shifts: IShiftInfo[]): {
    totalShifts: number;
    totalWorkMinutes: number;
    averageShiftMinutes: number;
    shortestShiftMinutes: number;
    longestShiftMinutes: number;
    formattedStatistics: string;
  } {
    if (shifts.length === 0) {
      return {
        totalShifts: 0,
        totalWorkMinutes: 0,
        averageShiftMinutes: 0,
        shortestShiftMinutes: 0,
        longestShiftMinutes: 0,
        formattedStatistics: "No shifts"
      };
    }

    const workMinutes = shifts.map(s => s.workMinutes);
    const totalWorkMinutes = workMinutes.reduce((sum, min) => sum + min, 0);
    const averageShiftMinutes = Math.round(totalWorkMinutes / shifts.length);
    const shortestShiftMinutes = Math.min(...workMinutes);
    const longestShiftMinutes = Math.max(...workMinutes);

    const formattedStatistics = [
      `${shifts.length} shifts`,
      `Total: ${this.formatMinutesToHours(totalWorkMinutes)}`,
      `Avg: ${this.formatMinutesToHours(averageShiftMinutes)}`,
      `Range: ${this.formatMinutesToHours(shortestShiftMinutes)} - ${this.formatMinutesToHours(longestShiftMinutes)}`
    ].join(', ');

    return {
      totalShifts: shifts.length,
      totalWorkMinutes,
      averageShiftMinutes,
      shortestShiftMinutes,
      longestShiftMinutes,
      formattedStatistics
    };
  }

  /**
   * Проверяет, пересекаются ли две смены по времени
   */
  public static doShiftsOverlap(shift1: IShiftInfo, shift2: IShiftInfo): boolean {
    // Сравниваем только время, не даты
    const start1Minutes = shift1.startTime.getHours() * 60 + shift1.startTime.getMinutes();
    const end1Minutes = shift1.endTime.getHours() * 60 + shift1.endTime.getMinutes();
    const start2Minutes = shift2.startTime.getHours() * 60 + shift2.startTime.getMinutes();
    const end2Minutes = shift2.endTime.getHours() * 60 + shift2.endTime.getMinutes();

    // Простая проверка пересечения (без учета перехода через полночь)
    return (start1Minutes < end2Minutes) && (end1Minutes > start2Minutes);
  }

  /**
   * Находит пересекающиеся смены в списке
   */
  public static findOverlappingShifts(shifts: IShiftInfo[]): IShiftInfo[][] {
    const overlapping: IShiftInfo[][] = [];

    for (let i = 0; i < shifts.length; i++) {
      for (let j = i + 1; j < shifts.length; j++) {
        if (this.doShiftsOverlap(shifts[i], shifts[j])) {
          overlapping.push([shifts[i], shifts[j]]);
        }
      }
    }

    return overlapping;
  }

  /**
   * Конвертирует минуты в десятичные часы
   */
  public static minutesToDecimalHours(minutes: number): number {
    return Math.round((minutes / 60) * 100) / 100; // Округляем до 2 знаков
  }

  /**
   * Конвертирует десятичные часы в минуты
   */
  public static decimalHoursToMinutes(hours: number): number {
    return Math.round(hours * 60);
  }

  /**
   * Форматирует время в 12-часовом формате (AM/PM)
   */
  public static formatTime12Hour(date: Date): string {
    if (isNaN(date.getTime())) {
      return "12:00 AM";
    }

    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;

    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}