// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableWeekCalculator.ts
import { IWeekInfo, IWeekCalculationParams } from '../interfaces/TimetableInterfaces';

/**
 * Утилита для расчета недель месяца
 * Реплицирует логику из Power Apps для создания WeeksCollection
 */
export class TimetableWeekCalculator {
  
  /**
   * Рассчитывает недели для выбранного месяца
   * Реплицирует логику Set(varWeeksCount, ...) из Power Apps
   */
  public static calculateWeeksForMonth(params: IWeekCalculationParams): IWeekInfo[] {
    const { selectedDate, startWeekDay } = params;
    
    console.log('[TimetableWeekCalculator] Calculating weeks for:', {
      selectedDate: selectedDate.toISOString(),
      startWeekDay
    });

    // Получаем первый и последний день месяца
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    console.log('[TimetableWeekCalculator] Month range:', {
      monthStart: monthStart.toISOString(),
      monthEnd: monthEnd.toISOString()
    });

    // Рассчитываем количество недель (аналогично Power Apps формуле)
    const weeksCount = this.calculateWeeksCount(monthStart, monthEnd, startWeekDay);
    
    console.log('[TimetableWeekCalculator] Calculated weeks count:', weeksCount);

    // Находим начало первой недели (аналогично selectedDay в Power Apps)
    const firstWeekStart = this.calculateFirstWeekStart(selectedDate, startWeekDay);
    
    console.log('[TimetableWeekCalculator] First week start:', firstWeekStart.toISOString());

    // Создаем массив недель (аналогично ForAll(Sequence(varWeeksCount), ...))
    const weeks: IWeekInfo[] = [];
    for (let i = 0; i < weeksCount; i++) {
      const weekStart = new Date(firstWeekStart);
      weekStart.setDate(firstWeekStart.getDate() + (i * 7));
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const weekLabel = `Week ${i + 1}: ${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`;
      
      weeks.push({
        weekNum: i + 1,
        weekStart,
        weekEnd,
        weekLabel
      });
    }

    console.log('[TimetableWeekCalculator] Generated weeks:', weeks.map(w => ({
      weekNum: w.weekNum,
      weekStart: w.weekStart.toISOString(),
      weekEnd: w.weekEnd.toISOString()
    })));

    return weeks;
  }

  /**
   * Рассчитывает количество недель в месяце
   * Реплицирует формулу RoundUp(...) из Power Apps
   */
  private static calculateWeeksCount(monthStart: Date, monthEnd: Date, startWeekDay: number): number {
    // Количество дней в месяце
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
    
    console.log('[TimetableWeekCalculator] Weeks calculation:', {
      monthDays,
      startWeekOffset,
      endWeekOffset,
      totalDays,
      weeksCount
    });

    return weeksCount;
  }

  /**
   * Находит начало первой недели
   * Реплицирует логику selectedDay из Power Apps
   */
  private static calculateFirstWeekStart(selectedDate: Date, startWeekDay: number): Date {
    const selectedDay = new Date(selectedDate);
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

    // Перемещаемся к началу недели
    selectedDay.setDate(selectedDate.getDate() - daysToSubtract);
    
    // Находим первый день месяца
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    
    // Если начало недели после начала месяца, двигаемся назад на неделю
    while (selectedDay > monthStart) {
      selectedDay.setDate(selectedDay.getDate() - 7);
    }
    
    // Убеждаемся, что мы находимся в правильной неделе относительно месяца
    const testDate = new Date(selectedDay);
    testDate.setDate(testDate.getDate() + 6); // Конец недели
    
    if (testDate < monthStart) {
      selectedDay.setDate(selectedDay.getDate() + 7);
    }

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
   * Получает номер дня недели для конкретной даты (аналогично GetDayNumber в Power Apps)
   */
  public static getDayNumber(date: Date): number {
    return this.convertJSWeekdayToPowerApps(date.getDay());
  }

  /**
   * Проверяет, попадает ли дата в указанную неделю
   */
  public static isDateInWeek(date: Date, weekStart: Date, weekEnd: Date): boolean {
    return date >= weekStart && date <= weekEnd;
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
   * Получает дату для конкретного дня недели в указанной неделе
   */
  public static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    const date = new Date(weekStart);
    
    // Находим, какой день недели у weekStart
    const startDayNumber = this.getDayNumber(weekStart);
    
    // Рассчитываем смещение до нужного дня
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7; // Если день на следующей неделе
    }
    
    date.setDate(weekStart.getDate() + offset);
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
   * Проверяет, является ли дата выходным (суббота или воскресенье)
   */
  public static isWeekend(date: Date): boolean {
    const dayNumber = this.getDayNumber(date);
    return dayNumber === 1 || dayNumber === 7; // Sunday or Saturday
  }

  /**
   * Получает первый день недели для заданной даты
   */
  public static getWeekStart(date: Date, startWeekDay: number): Date {
    const dayNumber = this.getDayNumber(date);
    const daysFromStart = (dayNumber - startWeekDay + 7) % 7;
    
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - daysFromStart);
    
    return weekStart;
  }

  /**
   * Получает последний день недели для заданной даты
   */
  public static getWeekEnd(date: Date, startWeekDay: number): Date {
    const weekStart = this.getWeekStart(date, startWeekDay);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return weekEnd;
  }

  /**
   * Проверяет, находятся ли две даты в одной неделе
   */
  public static areDatesInSameWeek(date1: Date, date2: Date, startWeekDay: number): boolean {
    const week1Start = this.getWeekStart(date1, startWeekDay);
    const week2Start = this.getWeekStart(date2, startWeekDay);
    
    return week1Start.getTime() === week2Start.getTime();
  }

  /**
   * Получает номер недели в году (ISO week number)
   */
  public static getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
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
   * Получает количество рабочих дней в неделе (исключая выходные)
   */
  public static getWorkingDaysInWeek(weekStart: Date, weekEnd: Date): number {
    let workingDays = 0;
    const currentDate = new Date(weekStart);
    
    while (currentDate <= weekEnd) {
      if (!this.isWeekend(currentDate)) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  }

  /**
   * Получает массив всех дат в неделе
   */
  public static getDatesInWeek(weekStart: Date, weekEnd: Date): Date[] {
    const dates: Date[] = [];
    const currentDate = new Date(weekStart);
    
    while (currentDate <= weekEnd) {
      dates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return dates;
  }
}