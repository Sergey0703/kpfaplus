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
    const { startTime, endTime, lunchStart, lunchEnd, timeForLunch, enterLunchTime } = params;

    console.log('[TimetableShiftCalculator] Calculating shift:', {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      lunchStart: lunchStart?.toISOString(),
      lunchEnd: lunchEnd?.toISOString(),
      timeForLunch,
      enterLunchTime
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

    if (enterLunchTime && timeForLunch) {
      // Используем заданное время обеда из TimeForLunch
      lunchMinutes = timeForLunch;
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
        lunchMinutes = lunchEndMinutes - lunchStartMinutes;
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
    records: IStaffRecord[], 
    enterLunchTime: boolean
  ): IShiftInfo[] {
    console.log('[TimetableShiftCalculator] Processing records to shifts:', records.length);

    // Фильтруем и сортируем записи (аналогично SortByColumns в Power Apps)
    const validRecords = records.filter(record => {
      // Исключаем записи без времен или с нулевыми временами
      if (!record.ShiftDate1 || !record.ShiftDate2) {
        return false;
      }

      const start = new Date(record.ShiftDate1);
      const end = new Date(record.ShiftDate2);
      
      const startStr = this.formatTime(start);
      const endStr = this.formatTime(end);

      // Исключаем записи где оба времени 00:00
      return !(startStr === "00:00" && endStr === "00:00");
    });

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

      const calculation = this.calculateShiftMinutes({
        startTime,
        endTime,
        lunchStart,
        lunchEnd,
        timeForLunch,
        enterLunchTime
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

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  /**
   * Форматирует время в формате HH:mm
   */
  public static formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Проверяет, является ли время нулевым (00:00)
   */
  public static isTimeZero(date: Date): boolean {
    return date.getHours() === 0 && date.getMinutes() === 0;
  }

  /**
   * Получает все смены для конкретного дня недели из записей
   */
  public static getShiftsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    enterLunchTime: boolean
  ): IShiftInfo[] {
    // Фильтруем записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      const recordDayNumber = this.getDayNumber(recordDate);
      
      return recordDayNumber === dayNumber && 
             recordDate >= weekStart && 
             recordDate <= weekEnd;
    });

    return this.processStaffRecordsToShifts(dayRecords, enterLunchTime);
  }

  /**
   * Получает номер дня недели для даты (1=Sunday, 2=Monday, etc.)
   */
  public static getDayNumber(date: Date): number {
    return date.getDay() + 1; // JS: 0=Sunday -> наш формат: 1=Sunday
  }
}