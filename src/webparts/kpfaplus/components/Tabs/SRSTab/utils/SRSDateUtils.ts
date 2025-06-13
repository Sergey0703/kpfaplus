// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDateUtils.ts

import { DateUtils } from '../../../CustomDatePicker/CustomDatePicker';

/**
 * Утилиты для работы с датами в SRS Tab
 * Специализированные функции для расчета недельных периодов и автоматического обновления дат
 */
export class SRSDateUtils {
  
  /**
   * Получает первый день текущего месяца (для fromDate по умолчанию)
   * Нормализует дату к UTC полуночи для корректной работы с API
   * 
   * @returns Первый день текущего месяца в UTC полуночи
   */
  public static getFirstDayOfCurrentMonth(): Date {
    const today = new Date();
    const firstDay = new Date(Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      1,
      0, 0, 0, 0
    ));
    
    console.log('[SRSDateUtils] getFirstDayOfCurrentMonth:', {
      today: today.toISOString(),
      firstDay: firstDay.toISOString()
    });
    
    return firstDay;
  }

  /**
   * ИСПРАВЛЕНО: Получает дату ровно через 6 дней после указанной даты (полная неделя)
   * Вместо поиска ближайшего воскресенья, добавляет ровно 6 дней
   * 
   * @param startDate Начальная дата
   * @returns Дата через 6 дней в UTC полуночи
   */
  public static getWeekEndAfterDate(startDate: Date): Date {
    if (!startDate) {
      console.error('[SRSDateUtils] getWeekEndAfterDate: startDate is required');
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }

    // Нормализуем входную дату к UTC полуночи
    const normalizedStartDate = DateUtils.normalizeDateToUTCMidnight(startDate);
    
    // ИСПРАВЛЕНО: Добавляем ровно 6 дней (полная неделя от startDate)
    const weekEnd = new Date(normalizedStartDate);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
    
    console.log('[SRSDateUtils] getWeekEndAfterDate FIXED:', {
      startDate: startDate.toISOString(),
      normalizedStartDate: normalizedStartDate.toISOString(),
      daysAdded: 6,
      weekEnd: weekEnd.toISOString(),
      startDateFormatted: normalizedStartDate.toLocaleDateString(),
      weekEndFormatted: weekEnd.toLocaleDateString()
    });
    
    return weekEnd;
  }

  /**
   * Рассчитывает полный недельный диапазон начиная с указанной даты
   * Возвращает диапазон от startDate до startDate + 6 дней
   * 
   * @param startDate Начальная дата
   * @returns Объект с началом и концом недели
   */
  public static calculateWeekRange(startDate: Date): { start: Date; end: Date } {
    if (!startDate) {
      console.error('[SRSDateUtils] calculateWeekRange: startDate is required');
      const fallbackDate = SRSDateUtils.getFirstDayOfCurrentMonth();
      return {
        start: fallbackDate,
        end: SRSDateUtils.getWeekEndAfterDate(fallbackDate)
      };
    }

    // Нормализуем начальную дату
    const normalizedStart = DateUtils.normalizeDateToUTCMidnight(startDate);
    
    // Получаем конец недели (startDate + 6 дней)
    const weekEnd = SRSDateUtils.getWeekEndAfterDate(normalizedStart);
    
    console.log('[SRSDateUtils] calculateWeekRange FIXED:', {
      inputDate: startDate.toISOString(),
      start: normalizedStart.toISOString(),
      end: weekEnd.toISOString(),
      startFormatted: normalizedStart.toLocaleDateString(),
      endFormatted: weekEnd.toLocaleDateString(),
      daysSpan: 7 // Start date + 6 days = 7 days total
    });
    
    return {
      start: normalizedStart,
      end: weekEnd
    };
  }

  /**
   * ИСПРАВЛЕНО: Получает дату конца недели для текущего месяца (по умолчанию для toDate)
   * Берет первый день месяца и добавляет 6 дней
   * 
   * @returns Первый день месяца + 6 дней
   */
  public static getDefaultToDate(): Date {
    const firstDayOfMonth = SRSDateUtils.getFirstDayOfCurrentMonth();
    const defaultToDate = SRSDateUtils.getWeekEndAfterDate(firstDayOfMonth);
    
    console.log('[SRSDateUtils] getDefaultToDate FIXED:', {
      firstDayOfMonth: firstDayOfMonth.toISOString(),
      defaultToDate: defaultToDate.toISOString(),
      firstDayFormatted: firstDayOfMonth.toLocaleDateString(),
      defaultToDateFormatted: defaultToDate.toLocaleDateString()
    });
    
    return defaultToDate;
  }

  /**
   * Проверяет, нужно ли обновить toDate при изменении fromDate
   * Обновляет только если разница больше недели или если toDate раньше fromDate
   * 
   * @param newFromDate Новая дата начала
   * @param currentToDate Текущая дата окончания
   * @returns true если нужно обновить toDate
   */
  public static shouldUpdateToDate(newFromDate: Date, currentToDate: Date): boolean {
    if (!newFromDate || !currentToDate) {
      return true;
    }

    // Нормализуем даты для сравнения
    const normalizedFrom = DateUtils.normalizeDateToUTCMidnight(newFromDate);
    const normalizedTo = DateUtils.normalizeDateToUTCMidnight(currentToDate);
    
    // Проверяем, что toDate не раньше fromDate
    if (normalizedTo < normalizedFrom) {
      console.log('[SRSDateUtils] shouldUpdateToDate: toDate is before fromDate, update needed');
      return true;
    }
    
    // ИСПРАВЛЕНО: Проверяем, что разница не больше 2 недель (14 дней)
    const diffInMs = normalizedTo.getTime() - normalizedFrom.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    const needsUpdate = diffInDays > 14;
    
    console.log('[SRSDateUtils] shouldUpdateToDate:', {
      fromDate: normalizedFrom.toISOString(),
      toDate: normalizedTo.toISOString(),
      fromDateFormatted: normalizedFrom.toLocaleDateString(),
      toDateFormatted: normalizedTo.toLocaleDateString(),
      diffInDays: diffInDays,
      needsUpdate: needsUpdate
    });
    
    return needsUpdate;
  }

  /**
   * Форматирует дату для отображения в интерфейсе SRS
   * 
   * @param date Дата для форматирования
   * @returns Отформатированная строка даты
   */
  public static formatDateForDisplay(date: Date): string {
    if (!date) {
      return 'Invalid Date';
    }

    try {
      // Используем локальную дату для отображения пользователю
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      return `${day}.${month}.${year}`;
    } catch (error) {
      console.error('[SRSDateUtils] formatDateForDisplay error:', error);
      return 'Invalid Date';
    }
  }

  /**
   * Рассчитывает количество дней в указанном диапазоне
   * 
   * @param startDate Дата начала
   * @param endDate Дата окончания
   * @returns Количество дней в диапазоне (включительно)
   */
  public static calculateDaysInRange(startDate: Date, endDate: Date): number {
    if (!startDate || !endDate) {
      return 0;
    }

    try {
      const normalizedStart = DateUtils.normalizeDateToUTCMidnight(startDate);
      const normalizedEnd = DateUtils.normalizeDateToUTCMidnight(endDate);
      
      const diffInMs = normalizedEnd.getTime() - normalizedStart.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1; // +1 для включения последнего дня
      
      return Math.max(0, diffInDays);
    } catch (error) {
      console.error('[SRSDateUtils] calculateDaysInRange error:', error);
      return 0;
    }
  }

  /**
   * Проверяет, попадает ли дата в указанный диапазон
   * 
   * @param date Проверяемая дата
   * @param startDate Дата начала диапазона
   * @param endDate Дата окончания диапазона
   * @returns true если дата в диапазоне
   */
  public static isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    if (!date || !startDate || !endDate) {
      return false;
    }

    try {
      const normalizedDate = DateUtils.normalizeDateToUTCMidnight(date);
      const normalizedStart = DateUtils.normalizeDateToUTCMidnight(startDate);
      const normalizedEnd = DateUtils.normalizeDateToUTCMidnight(endDate);
      
      return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
    } catch (error) {
      console.error('[SRSDateUtils] isDateInRange error:', error);
      return false;
    }
  }

  /**
   * Получает следующую неделю от указанной даты
   * 
   * @param currentDate Текущая дата
   * @returns Дата через неделю
   */
  public static getNextWeek(currentDate: Date): Date {
    if (!currentDate) {
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }

    try {
      const normalizedDate = DateUtils.normalizeDateToUTCMidnight(currentDate);
      const nextWeek = new Date(normalizedDate);
      nextWeek.setUTCDate(nextWeek.getUTCDate() + 7);
      
      return nextWeek;
    } catch (error) {
      console.error('[SRSDateUtils] getNextWeek error:', error);
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }
  }

  /**
   * Получает предыдущую неделю от указанной даты
   * 
   * @param currentDate Текущая дата
   * @returns Дата неделю назад
   */
  public static getPreviousWeek(currentDate: Date): Date {
    if (!currentDate) {
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }

    try {
      const normalizedDate = DateUtils.normalizeDateToUTCMidnight(currentDate);
      const previousWeek = new Date(normalizedDate);
      previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);
      
      return previousWeek;
    } catch (error) {
      console.error('[SRSDateUtils] getPreviousWeek error:', error);
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }
  }
}