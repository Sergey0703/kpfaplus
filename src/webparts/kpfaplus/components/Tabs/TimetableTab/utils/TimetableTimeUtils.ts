// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableTimeUtils.ts

/**
 * Утилиты для работы со временем и датами в контексте расписания.
 * Содержит методы для форматирования, парсинга, расчетов продолжительности
 * и проверки валидности времени/дат.
 */
export class TimetableTimeUtils {

  /**
   * Форматирует минуты в формат HH:MM для отображения продолжительности (например, обеда или рабочего времени смены).
   * Используется только для отдельных смен, НЕ для Total.
   */
  public static formatMinutesToHoursMinutes(totalMinutes: number): string {
    if (totalMinutes === 0 || totalMinutes < 0) {
      return "0:00";
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Форматирует минуты в часы и минуты для суммарных значений (аналогично FormatMinutesToHours в Power Apps).
   * ИСПОЛЬЗУЕТСЯ ТОЛЬКО ДЛЯ TOTAL - остается в формате "26h 30m"
   */
  public static formatMinutesToHours(totalMinutes: number): string {
    if (totalMinutes === 0 || totalMinutes < 0) {
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
   * Проверяет, является ли время валидным рабочим временем (не 00:00 - 00:00)
   */
  public static isValidWorkTime(startTime: Date, endTime: Date): boolean {
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return false;
    }

    // Проверяем, что оба времени не 00:00
    if (TimetableTimeUtils.isTimeZero(startTime) && TimetableTimeUtils.isTimeZero(endTime)) {
      return false;
    }

    return true;
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
   * Вычисляет продолжительность между двумя временами в минутах (с учетом перехода через полночь)
   */
  public static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
      return 0;
    }

    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();

    // Handle overnight shifts
    if (endMinutes <= startMinutes && endMinutes > 0) {
       return (24 * 60) - startMinutes + endMinutes;
    } else if (endMinutes === 0) {
       // End time is exactly midnight of the next day
       return (24 * 60) - startMinutes;
    }
     else {
      return endMinutes - startMinutes;
    }
  }

  /**
   * Форматирует продолжительность в удобочитаемый формат (например, "1h 30m")
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
    const displayHours = hours % 12 || 12; // the hour '0' should be '12'

    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  }
}