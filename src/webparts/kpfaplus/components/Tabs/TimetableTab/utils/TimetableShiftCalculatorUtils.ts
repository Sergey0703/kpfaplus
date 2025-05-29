// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorUtils.ts
import { IShiftInfo } from '../interfaces/TimetableInterfaces';

/**
 * Утилиты и вспомогательные функции для работы с расчетами времени
 * Содержит валидацию, парсинг, анализ и общие утилиты
 */
export class TimetableShiftCalculatorUtils {

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

    return true;
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
   * ОБНОВЛЕНО: Добавлена статистика по типам отпусков
   */
  public static getShiftsStatistics(shifts: IShiftInfo[]): {
    totalShifts: number;
    totalWorkMinutes: number;
    averageShiftMinutes: number;
    shortestShiftMinutes: number;
    longestShiftMinutes: number;
    formattedStatistics: string;
    shiftsWithLeave: number;
    leaveTypes: string[];
  } {
    if (shifts.length === 0) {
      return {
        totalShifts: 0,
        totalWorkMinutes: 0,
        averageShiftMinutes: 0,
        shortestShiftMinutes: 0,
        longestShiftMinutes: 0,
        formattedStatistics: "No shifts",
        shiftsWithLeave: 0,
        leaveTypes: []
      };
    }

    const workMinutes = shifts.map(s => s.workMinutes);
    const totalWorkMinutes = workMinutes.reduce((sum, min) => sum + min, 0);
    const averageShiftMinutes = Math.round(totalWorkMinutes / shifts.length);
    const shortestShiftMinutes = Math.min(...workMinutes);
    const longestShiftMinutes = Math.max(...workMinutes);

    // ДОБАВЛЕНО: Статистика по типам отпусков
    const shiftsWithLeave = shifts.filter(s => s.typeOfLeaveId).length;
    const leaveTypesSet = new Set<string>();
    shifts.forEach(s => {
      if (s.typeOfLeaveTitle) {
        leaveTypesSet.add(s.typeOfLeaveTitle);
      }
    });
    const leaveTypes: string[] = [];
    leaveTypesSet.forEach(type => leaveTypes.push(type));

    const formattedStatistics = [
      `${shifts.length} shifts`,
      `Total: ${this.formatMinutesToHours(totalWorkMinutes)}`,
      `Avg: ${this.formatMinutesToHours(averageShiftMinutes)}`,
      `Range: ${this.formatMinutesToHours(shortestShiftMinutes)} - ${this.formatMinutesToHours(longestShiftMinutes)}`,
      shiftsWithLeave > 0 ? `Leave: ${shiftsWithLeave}` : ''
    ].filter(s => s).join(', ');

    return {
      totalShifts: shifts.length,
      totalWorkMinutes,
      averageShiftMinutes,
      shortestShiftMinutes,
      longestShiftMinutes,
      formattedStatistics,
      shiftsWithLeave,
      leaveTypes
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

  /**
   * Вспомогательный метод для форматирования минут в часы (для статистики)
   */
  private static formatMinutesToHours(totalMinutes: number): string {
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
}