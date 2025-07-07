// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableWeekCalculator.ts
import { IWeekInfo, IWeekCalculationParams } from '../interfaces/TimetableInterfaces';

/**
 * Утилита для расчета недель месяца
 * ОБНОВЛЕНО v5.0: Полная поддержка Date-only формата
 * Реплицирует логику из Power Apps для создания WeeksCollection
 * Date-only: Все операции с датами используют нормализованные даты без времени
 */
export class TimetableWeekCalculator {
  
  /**
   * ОБНОВЛЕНО v5.0: Рассчитывает недели для выбранного месяца с Date-only поддержкой
   * Реплицирует логику Set(varWeeksCount, ...) из Power Apps
   */
  public static calculateWeeksForMonth(params: IWeekCalculationParams): IWeekInfo[] {
    const { selectedDate, startWeekDay } = params;
    
    console.log('[TimetableWeekCalculator] v5.0: Calculating weeks with date-only support for:', {
      selectedDate: selectedDate.toLocaleDateString(),
      selectedDateISO: selectedDate.toISOString(),
      startWeekDay
    });

    // ОБНОВЛЕНО v5.0: Нормализуем selectedDate к date-only
    const normalizedSelectedDate = this.normalizeDateToDateOnly(selectedDate);
    
    // Получаем первый и последний день месяца (date-only)
    const monthStart = new Date(normalizedSelectedDate.getFullYear(), normalizedSelectedDate.getMonth(), 1);
    const monthEnd = new Date(normalizedSelectedDate.getFullYear(), normalizedSelectedDate.getMonth() + 1, 0);
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only month range:', {
      monthStart: monthStart.toLocaleDateString(),
      monthEnd: monthEnd.toLocaleDateString(),
      monthStartISO: monthStart.toISOString(),
      monthEndISO: monthEnd.toISOString()
    });

    // Рассчитываем количество недель (аналогично Power Apps формуле)
    const weeksCount = this.calculateWeeksCount(monthStart, monthEnd, startWeekDay);
    
    console.log('[TimetableWeekCalculator] v5.0: Calculated weeks count:', weeksCount);

    // Находим начало первой недели (аналогично selectedDay в Power Apps)
    const firstWeekStart = this.calculateFirstWeekStart(normalizedSelectedDate, startWeekDay);
    
    console.log('[TimetableWeekCalculator] v5.0: First week start (date-only):', {
      firstWeekStart: firstWeekStart.toLocaleDateString(),
      firstWeekStartISO: firstWeekStart.toISOString()
    });

    // Создаем массив недель (аналогично ForAll(Sequence(varWeeksCount), ...))
    const weeks: IWeekInfo[] = [];
    for (let i = 0; i < weeksCount; i++) {
      const weekStart = new Date(firstWeekStart.getFullYear(), firstWeekStart.getMonth(), firstWeekStart.getDate());
      weekStart.setDate(firstWeekStart.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekLabel = `Week ${i + 1}: ${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`;
      
      weeks.push({
        weekNum: i + 1,
        weekStart,
        weekEnd,
        weekLabel
      });
    }

    console.log('[TimetableWeekCalculator] v5.0: Generated date-only weeks:', weeks.map(w => ({
      weekNum: w.weekNum,
      weekStart: w.weekStart.toLocaleDateString(),
      weekEnd: w.weekEnd.toLocaleDateString(),
      weekStartISO: w.weekStart.toISOString(),
      weekEndISO: w.weekEnd.toISOString()
    })));

    return weeks;
  }

  /**
   * НОВЫЙ МЕТОД v5.0: Нормализует дату к date-only формату
   */
  private static normalizeDateToDateOnly(date: Date): Date {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    console.log('[TimetableWeekCalculator] v5.0: Date normalization:', {
      original: date.toISOString(),
      normalized: normalized.toISOString(),
      originalLocal: date.toLocaleDateString(),
      normalizedLocal: normalized.toLocaleDateString()
    });
    return normalized;
  }

  /**
   * ОБНОВЛЕНО v5.0: Рассчитывает количество недель в месяце с Date-only поддержкой
   * Реплицирует формулу RoundUp(...) из Power Apps
   */
  private static calculateWeeksCount(monthStart: Date, monthEnd: Date, startWeekDay: number): number {
    console.log('[TimetableWeekCalculator] v5.0: Calculating weeks count with date-only support');
    
    // Количество дней в месяце (date-only расчет)
    const monthDays = Math.ceil((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // День начала первой недели относительно startWeekDay
    const monthStartWeekday = this.convertJSWeekdayToPowerApps(monthStart.getDay());
    let startWeekOffset = 0;
    
    if (monthStartWeekday >= startWeekDay) {
      startWeekOffset = monthStartWeekday - startWeekDay;
    } else {
      startWeekOffset = 7 - (startWeekDay - monthStartWeekday);
    }

    // Дни до конца последней недели
    const monthEndWeekday = this.convertJSWeekdayToPowerApps(monthEnd.getDay());
    let endWeekOffset = 0;
    
    if (monthEndWeekday >= startWeekDay) {
      endWeekOffset = 7 - (monthEndWeekday - startWeekDay + 1);
    } else {
      endWeekOffset = startWeekDay - monthEndWeekday - 1;
    }

    // Общее количество дней включая дни соседних недель
    const totalDays = monthDays + startWeekOffset + endWeekOffset;
    
    // Количество недель (округление вверх)
    const weeksCount = Math.ceil(totalDays / 7);
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only weeks calculation:', {
      monthDays,
      startWeekOffset,
      endWeekOffset,
      totalDays,
      weeksCount,
      monthStartWeekday,
      monthEndWeekday,
      startWeekDay
    });

    return weeksCount;
  }

  /**
   * ОБНОВЛЕНО v5.0: Находит начало первой недели с Date-only поддержкой
   * Реплицирует логику selectedDay из Power Apps
   */
  private static calculateFirstWeekStart(selectedDate: Date, startWeekDay: number): Date {
    console.log('[TimetableWeekCalculator] v5.0: Calculating first week start with date-only support');
    
    const selectedDay = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const currentWeekday = this.convertJSWeekdayToPowerApps(selectedDate.getDay());
    
    let daysToSubtract = 0;

    if (startWeekDay === 7) { // Неделя начинается с субботы
      if (currentWeekday === 7) { // Сегодня суббота
        daysToSubtract = 0;
      } else {
        // Вычисляем дни до предыдущей субботы
        daysToSubtract = (currentWeekday - 7 + 7) % 7;
      }
    } else { // Неделя начинается с другого дня
      if (currentWeekday === 1) { // Сегодня воскресенье
        daysToSubtract = 6;
      } else {
        daysToSubtract = 2 - currentWeekday;
        if (daysToSubtract > 0) {
          // Если результат положительный, нужен предыдущий понедельник
          daysToSubtract = daysToSubtract - 7;
        }
        daysToSubtract = Math.abs(daysToSubtract);
      }
    }

    // Перемещаемся к началу недели (date-only операция)
    selectedDay.setDate(selectedDate.getDate() - daysToSubtract);
    
    // Находим первый день месяца (date-only)
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    
    // Защита от бесконечного цикла
    let iterationCount = 0;
    const maxIterations = 10;
    
    // Если начало недели после начала месяца, двигаемся назад на неделю
    while (selectedDay.getTime() > monthStart.getTime() && iterationCount < maxIterations) {
      selectedDay.setDate(selectedDay.getDate() - 7);
      iterationCount++;
    }
    
    if (iterationCount >= maxIterations) {
      console.warn('[TimetableWeekCalculator] v5.0: Maximum iterations reached in calculateFirstWeekStart');
    }
    
    // Убеждаемся, что мы находимся в правильной неделе относительно месяца
    const testDate = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
    testDate.setDate(testDate.getDate() + 6); // Конец недели
    
    if (testDate.getTime() < monthStart.getTime()) {
      selectedDay.setDate(selectedDay.getDate() + 7);
    }

    console.log('[TimetableWeekCalculator] v5.0: First week start calculation result:', {
      selectedDate: selectedDate.toLocaleDateString(),
      currentWeekday,
      startWeekDay,
      daysToSubtract,
      resultDate: selectedDay.toLocaleDateString(),
      resultISO: selectedDay.toISOString()
    });

    return selectedDay;
  }

  /**
   * Преобразует день недели из JavaScript формата (0=Sunday) в Power Apps формат (1=Sunday)
   */
  private static convertJSWeekdayToPowerApps(jsWeekday: number): number {
    return jsWeekday + 1; // 0->1, 1->2, ..., 6->7
  }

  /**
   * Преобразует день недели из Power Apps формата (1=Sunday) в JavaScript формат (0=Sunday)
   */
  public static convertPowerAppsWeekdayToJS(powerAppsWeekday: number): number {
    return powerAppsWeekday - 1; // 1->0, 2->1, ..., 7->6
  }

  /**
   * Форматирует дату в формате dd/mm
   */
  private static formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает номер дня недели для конкретной даты с Date-only поддержкой
   * (аналогично GetDayNumber в Power Apps)
   */
  public static getDayNumber(date: Date): number {
    // Нормализуем дату для точного определения дня недели
    const normalizedDate = this.normalizeDateToDateOnly(date);
    const result = this.convertJSWeekdayToPowerApps(normalizedDate.getDay());
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only day number calculation:', {
      originalDate: date.toLocaleDateString(),
      normalizedDate: normalizedDate.toLocaleDateString(),
      dayNumber: result,
      dayName: this.getDayName(result)
    });
    
    return result;
  }

  /**
   * ОБНОВЛЕНО v5.0: Проверяет, попадает ли дата в указанную неделю с Date-only поддержкой
   */
  public static isDateInWeek(date: Date, weekStart: Date, weekEnd: Date): boolean {
    // Нормализуем все даты к date-only для точного сравнения
    const normalizedDate = this.normalizeDateToDateOnly(date);
    const normalizedWeekStart = this.normalizeDateToDateOnly(weekStart);
    const normalizedWeekEnd = this.normalizeDateToDateOnly(weekEnd);
    
    const result = normalizedDate >= normalizedWeekStart && normalizedDate <= normalizedWeekEnd;
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only week check:', {
      date: normalizedDate.toLocaleDateString(),
      weekStart: normalizedWeekStart.toLocaleDateString(),
      weekEnd: normalizedWeekEnd.toLocaleDateString(),
      isInWeek: result
    });
    
    return result;
  }

  /**
   * Получает название дня недели
   */
  public static getDayName(dayNumber: number): string {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayNumber - 1] || 'Unknown';
  }

  /**
   * Получает упорядоченный массив дней недели согласно startWeekDay
   */
  public static getOrderedDaysOfWeek(startWeekDay: number): number[] {
    const days = [1, 2, 3, 4, 5, 6, 7]; // Sunday=1, Monday=2, ..., Saturday=7
    
    const startIndex = days.indexOf(startWeekDay);
    if (startIndex === -1) return days;
    
    return [...days.slice(startIndex), ...days.slice(0, startIndex)];
  }

  /**
   * Форматирует минуты в часы и минуты (вспомогательная функция)
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
   * ОБНОВЛЕНО v5.0: Получает дату для конкретного дня недели в указанной неделе с Date-only поддержкой
   */
  public static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    console.log('[TimetableWeekCalculator] v5.0: Getting date for day in week with date-only support');
    
    // Нормализуем weekStart к date-only
    const normalizedWeekStart = this.normalizeDateToDateOnly(weekStart);
    
    const date = new Date(normalizedWeekStart.getFullYear(), normalizedWeekStart.getMonth(), normalizedWeekStart.getDate());
    
    // Находим, какой день недели у weekStart
    const startDayNumber = this.getDayNumber(normalizedWeekStart);
    
    // Рассчитываем смещение до нужного дня
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7; // Если день на следующей неделе
    }
    
    date.setDate(normalizedWeekStart.getDate() + offset);
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only day calculation result:', {
      weekStart: normalizedWeekStart.toLocaleDateString(),
      dayNumber,
      startDayNumber,
      offset,
      resultDate: date.toLocaleDateString(),
      resultISO: date.toISOString()
    });
    
    return date;
  }

  /**
   * Получает краткое название дня недели
   */
  public static getShortDayName(dayNumber: number): string {
    const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return shortDayNames[dayNumber - 1] || 'Unk';
  }

  /**
   * ОБНОВЛЕНО v5.0: Проверяет, является ли дата выходным с Date-only поддержкой
   */
  public static isWeekend(date: Date): boolean {
    const dayNumber = this.getDayNumber(date);
    const result = dayNumber === 1 || dayNumber === 7; // Sunday or Saturday
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only weekend check:', {
      date: date.toLocaleDateString(),
      dayNumber,
      dayName: this.getDayName(dayNumber),
      isWeekend: result
    });
    
    return result;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает первый день недели для заданной даты с Date-only поддержкой
   */
  public static getWeekStart(date: Date, startWeekDay: number): Date {
    console.log('[TimetableWeekCalculator] v5.0: Getting week start with date-only support');
    
    const normalizedDate = this.normalizeDateToDateOnly(date);
    const dayNumber = this.getDayNumber(normalizedDate);
    const daysFromStart = (dayNumber - startWeekDay + 7) % 7;
    
    const weekStart = new Date(normalizedDate.getFullYear(), normalizedDate.getMonth(), normalizedDate.getDate());
    weekStart.setDate(normalizedDate.getDate() - daysFromStart);
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only week start calculation:', {
      inputDate: normalizedDate.toLocaleDateString(),
      dayNumber,
      startWeekDay,
      daysFromStart,
      weekStart: weekStart.toLocaleDateString()
    });
    
    return weekStart;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает последний день недели для заданной даты с Date-only поддержкой
   */
  public static getWeekEnd(date: Date, startWeekDay: number): Date {
    const weekStart = this.getWeekStart(date, startWeekDay);
    const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
    weekEnd.setDate(weekStart.getDate() + 6);
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only week end calculation:', {
      inputDate: date.toLocaleDateString(),
      weekStart: weekStart.toLocaleDateString(),
      weekEnd: weekEnd.toLocaleDateString()
    });
    
    return weekEnd;
  }

  /**
   * ОБНОВЛЕНО v5.0: Проверяет, находятся ли две даты в одной неделе с Date-only поддержкой
   */
  public static areDatesInSameWeek(date1: Date, date2: Date, startWeekDay: number): boolean {
    const week1Start = this.getWeekStart(date1, startWeekDay);
    const week2Start = this.getWeekStart(date2, startWeekDay);
    
    const result = week1Start.getTime() === week2Start.getTime();
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only same week check:', {
      date1: date1.toLocaleDateString(),
      date2: date2.toLocaleDateString(),
      week1Start: week1Start.toLocaleDateString(),
      week2Start: week2Start.toLocaleDateString(),
      areSameWeek: result
    });
    
    return result;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает номер недели в году (ISO week number) с Date-only поддержкой
   */
  public static getWeekNumber(date: Date): number {
    const normalizedDate = this.normalizeDateToDateOnly(date);
    
    const d = new Date(Date.UTC(normalizedDate.getFullYear(), normalizedDate.getMonth(), normalizedDate.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    
    console.log('[TimetableWeekCalculator] v5.0: Date-only ISO week number:', {
      date: normalizedDate.toLocaleDateString(),
      weekNumber
    });
    
    return weekNumber;
  }

  /**
   * Форматирует период недели в читаемый вид
   */
  public static formatWeekPeriod(weekStart: Date, weekEnd: Date): string {
    const startStr = weekStart.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short'
    });
    const endStr = weekEnd.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
    
    return `${startStr} - ${endStr}`;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает количество рабочих дней в неделе с Date-only поддержкой
   */
  public static getWorkingDaysInWeek(weekStart: Date, weekEnd: Date): number {
    console.log('[TimetableWeekCalculator] v5.0: Calculating working days with date-only support');
    
    const normalizedWeekStart = this.normalizeDateToDateOnly(weekStart);
    const normalizedWeekEnd = this.normalizeDateToDateOnly(weekEnd);
    
    let workingDays = 0;
    const currentDate = new Date(normalizedWeekStart.getFullYear(), normalizedWeekStart.getMonth(), normalizedWeekStart.getDate());
    
    // Защита от бесконечного цикла с date-only сравнением
    let iterationCount = 0;
    const maxIterations = 8; // Максимум 8 дней (с запасом для недели)
    
    while (currentDate.getTime() <= normalizedWeekEnd.getTime() && iterationCount < maxIterations) {
      if (!this.isWeekend(currentDate)) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
      iterationCount++;
    }
    
    if (iterationCount >= maxIterations) {
      console.warn('[TimetableWeekCalculator] v5.0: Maximum iterations reached in getWorkingDaysInWeek');
    }
    
    console.log('[TimetableWeekCalculator] v5.0: Working days calculation result:', {
      weekStart: normalizedWeekStart.toLocaleDateString(),
      weekEnd: normalizedWeekEnd.toLocaleDateString(),
      workingDays,
      iterations: iterationCount
    });
    
    return workingDays;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает массив всех дат в неделе с Date-only поддержкой
   */
  public static getDatesInWeek(weekStart: Date, weekEnd: Date): Date[] {
    console.log('[TimetableWeekCalculator] v5.0: Getting dates in week with date-only support');
    
    const normalizedWeekStart = this.normalizeDateToDateOnly(weekStart);
    const normalizedWeekEnd = this.normalizeDateToDateOnly(weekEnd);
    
    const dates: Date[] = [];
    const currentDate = new Date(normalizedWeekStart.getFullYear(), normalizedWeekStart.getMonth(), normalizedWeekStart.getDate());
    
    // Защита от бесконечного цикла с date-only сравнением
    let iterationCount = 0;
    const maxIterations = 8; // Максимум 8 дней (с запасом для недели)
    
    while (currentDate.getTime() <= normalizedWeekEnd.getTime() && iterationCount < maxIterations) {
      dates.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()));
      currentDate.setDate(currentDate.getDate() + 1);
      iterationCount++;
    }
    
    if (iterationCount >= maxIterations) {
      console.warn('[TimetableWeekCalculator] v5.0: Maximum iterations reached in getDatesInWeek');
    }
    
    console.log('[TimetableWeekCalculator] v5.0: Dates in week result:', {
      weekStart: normalizedWeekStart.toLocaleDateString(),
      weekEnd: normalizedWeekEnd.toLocaleDateString(),
      datesCount: dates.length,
      dates: dates.map(d => d.toLocaleDateString())
    });
    
    return dates;
  }
}