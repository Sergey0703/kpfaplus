// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSDateUtils.ts

/**
 * Утилиты для работы с датами в SRS Tab
 * ОБНОВЛЕНО: Все методы работают только с датами без времени
 * Поле Date теперь имеет тип "только дата" в SharePoint
 * ShiftDate1, ShiftDate2, ShiftDate3, ShiftDate4 больше не используются
 */
export class SRSDateUtils {
  
  /**
   * Helper function to get the correct day suffix (st, nd, rd, th)
   * @param day - The day of the month (1-31)
   * @returns The correct ordinal suffix as a string
   */
  private static getDaySuffix(day: number): string {
    if (day > 3 && day < 21) return 'th'; // for 4-20
    switch (day % 10) {
        case 1:  return "st";
        case 2:  return "nd";
        case 3:  return "rd";
        default: return "th";
    }
  }

  /**
   * Форматирует дату для отправки в SharePoint в формате "только дата"
   * КРИТИЧЕСКИ ВАЖНО: Добавляет 'Z' суффикс для предотвращения timezone сдвигов
   * 
   * @param date - Дата для форматирования
   * @returns Строка в формате YYYY-MM-DDTHH:mm:ss.sssZ (UTC midnight)
   */
  public static formatDateForSharePoint(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const formattedDate = `${year}-${month}-${day}T00:00:00.000Z`;
    
    console.log('[SRSDateUtils] formatDateForSharePoint (Date-only):', {
      input: date.toISOString(),
      inputLocal: date.toLocaleDateString(),
      output: formattedDate,
      reason: 'UTC midnight prevents SharePoint timezone shifts for Date-only fields'
    });
    
    return formattedDate;
  }

  /**
   * Парсит дату из SharePoint формата в локальную дату
   */
  public static parseSharePointDate(sharePointDate: string | Date): Date {
    if (!sharePointDate) {
      console.warn('[SRSDateUtils] parseSharePointDate: empty date provided');
      return new Date();
    }

    let parsedDate: Date;
    
    if (sharePointDate instanceof Date) {
      parsedDate = new Date(sharePointDate);
    } else {
      parsedDate = new Date(sharePointDate);
    }

    const localDate = new Date(
      parsedDate.getFullYear(),
      parsedDate.getMonth(),
      parsedDate.getDate()
    );

    console.log('[SRSDateUtils] parseSharePointDate (Date-only):', {
      input: sharePointDate,
      parsed: parsedDate.toISOString(),
      normalized: localDate.toISOString(),
      localDisplay: localDate.toLocaleDateString()
    });

    return localDate;
  }

  /**
   * Нормализует дату к локальной полуночи (без UTC)
   */
  public static normalizeDateToLocalMidnight(date: Date): Date {
    if (!date) {
      console.error('[SRSDateUtils] normalizeDateToLocalMidnight: date is required');
      return new Date();
    }

    const normalizedDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    );
    
    console.log('[SRSDateUtils] normalizeDateToLocalMidnight (Date-only):', {
      input: date.toISOString(),
      normalized: normalizedDate.toISOString(),
      localDisplay: normalizedDate.toLocaleDateString()
    });
    
    return normalizedDate;
  }

  /**
   * Нормализует дату к UTC полуночи для запросов к SharePoint
   */
  public static normalizeDateToUTCMidnight(date: Date): Date {
    if (!date) {
      console.error('[SRSDateUtils] normalizeDateToUTCMidnight: date is required');
      return new Date();
    }

    const normalizedDate = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      0, 0, 0, 0
    ));
    
    console.log('[SRSDateUtils] normalizeDateToUTCMidnight (Date-only):', {
      input: date.toISOString(),
      inputLocal: date.toLocaleDateString(),
      normalized: normalizedDate.toISOString(),
      purpose: 'For SharePoint Date-only field queries'
    });
    
    return normalizedDate;
  }

  /**
   * Получает первый день текущего месяца (для fromDate по умолчанию)
   */
  public static getFirstDayOfCurrentMonth(): Date {
    const today = new Date();
    const firstDay = new Date(
      today.getFullYear(),
      today.getMonth(),
      1,
      0, 0, 0, 0
    );
    
    console.log('[SRSDateUtils] getFirstDayOfCurrentMonth (Date-only):', {
      today: today.toLocaleDateString(),
      firstDay: firstDay.toLocaleDateString(),
      firstDayISO: firstDay.toISOString()
    });
    
    return firstDay;
  }

  /**
   * Получает дату ровно через 6 дней после указанной даты (полная неделя)
   */
  public static getWeekEndAfterDate(startDate: Date): Date {
    if (!startDate) {
      console.error('[SRSDateUtils] getWeekEndAfterDate: startDate is required');
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }

    const normalizedStartDate = SRSDateUtils.normalizeDateToLocalMidnight(startDate);
    
    const weekEnd = new Date(normalizedStartDate);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    console.log('[SRSDateUtils] getWeekEndAfterDate (Date-only):', {
      startDate: startDate.toLocaleDateString(),
      normalizedStartDate: normalizedStartDate.toLocaleDateString(),
      daysAdded: 6,
      weekEnd: weekEnd.toLocaleDateString(),
      weekEndISO: weekEnd.toISOString()
    });
    
    return weekEnd;
  }

  /**
   * Рассчитывает полный недельный диапазон начиная с указанной даты
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

    const normalizedStart = SRSDateUtils.normalizeDateToLocalMidnight(startDate);
    
    const weekEnd = SRSDateUtils.getWeekEndAfterDate(normalizedStart);
    
    console.log('[SRSDateUtils] calculateWeekRange (Date-only):', {
      inputDate: startDate.toLocaleDateString(),
      start: normalizedStart.toLocaleDateString(),
      end: weekEnd.toLocaleDateString(),
      startISO: normalizedStart.toISOString(),
      endISO: weekEnd.toISOString(),
      daysSpan: 7
    });
    
    return {
      start: normalizedStart,
      end: weekEnd
    };
  }

  /**
   * Получает дату конца недели для текущего месяца (по умолчанию для toDate)
   */
  public static getDefaultToDate(): Date {
    const firstDayOfMonth = SRSDateUtils.getFirstDayOfCurrentMonth();
    const defaultToDate = SRSDateUtils.getWeekEndAfterDate(firstDayOfMonth);
    
    console.log('[SRSDateUtils] getDefaultToDate (Date-only):', {
      firstDayOfMonth: firstDayOfMonth.toLocaleDateString(),
      defaultToDate: defaultToDate.toLocaleDateString(),
      firstDayISO: firstDayOfMonth.toISOString(),
      defaultToDateISO: defaultToDate.toISOString()
    });
    
    return defaultToDate;
  }

  /**
   * Проверяет, нужно ли обновить toDate при изменении fromDate
   */
  public static shouldUpdateToDate(newFromDate: Date, currentToDate: Date): boolean {
    if (!newFromDate || !currentToDate) {
      return true;
    }

    const normalizedFrom = SRSDateUtils.normalizeDateToLocalMidnight(newFromDate);
    const normalizedTo = SRSDateUtils.normalizeDateToLocalMidnight(currentToDate);
    
    if (normalizedTo < normalizedFrom) {
      console.log('[SRSDateUtils] shouldUpdateToDate: toDate is before fromDate, update needed');
      return true;
    }
    
    const diffInMs = normalizedTo.getTime() - normalizedFrom.getTime();
    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
    
    const needsUpdate = diffInDays > 14;
    
    console.log('[SRSDateUtils] shouldUpdateToDate (Date-only):', {
      fromDate: normalizedFrom.toLocaleDateString(),
      toDate: normalizedTo.toLocaleDateString(),
      fromDateISO: normalizedFrom.toISOString(),
      toDateISO: normalizedTo.toISOString(),
      diffInDays: diffInDays,
      needsUpdate: needsUpdate
    });
    
    return needsUpdate;
  }

  /**
   * Форматирует дату для отображения в интерфейсе SRS
   */
  public static formatDateForDisplay(date: Date): string {
    if (!date) {
      return 'Invalid Date';
    }

    try {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const year = date.getFullYear();
      
      const formatted = `${day}.${month}.${year}`;
      
      console.log('[SRSDateUtils] formatDateForDisplay (Date-only):', {
        input: date.toISOString(),
        inputLocal: date.toLocaleDateString(),
        formatted: formatted
      });
      
      return formatted;
    } catch (error) {
      console.error('[SRSDateUtils] formatDateForDisplay error:', error);
      return 'Invalid Date';
    }
  }

  /**
   * *** ИСПРАВЛЕНО: Форматирует дату для поиска в Excel в формате "1st of June" ***
   * Специально для SRS Excel экспорта
   * 
   * @param date Дата для форматирования
   * @returns Строка в формате "1st of June" для поиска в Excel
   */
  public static formatDateForExcelSearch(date: Date): string {
    if (!date) {
      console.warn('[SRSDateUtils] formatDateForExcelSearch: empty date provided');
      return '';
    }

    try {
      // --- НАЧАЛО ИСПРАВЛЕНИЯ ---
      // **КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ**: Используем полные названия месяцев.
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
      
      const day = date.getDate();
      const monthName = monthNames[date.getMonth()];
      const suffix = this.getDaySuffix(day);
      
      const formatted = `${day}${suffix} of ${monthName}`;
      
      console.log('[SRSDateUtils] formatDateForExcelSearch (for Excel search):', {
        input: date.toISOString(),
        inputLocal: date.toLocaleDateString(),
        formatted: formatted,
        purpose: 'Excel date search in "[Day]th of [Month]" format'
      });
      
      return formatted;
    } catch (error) {
      console.error('[SRSDateUtils] formatDateForExcelSearch error:', error);
      return '';
    }
  }

  /**
   * Рассчитывает количество дней в указанном диапазоне
   */
  public static calculateDaysInRange(startDate: Date, endDate: Date): number {
    if (!startDate || !endDate) {
      return 0;
    }

    try {
      const normalizedStart = SRSDateUtils.normalizeDateToLocalMidnight(startDate);
      const normalizedEnd = SRSDateUtils.normalizeDateToLocalMidnight(endDate);
      
      const diffInMs = normalizedEnd.getTime() - normalizedStart.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;
      
      const result = Math.max(0, diffInDays);
      
      console.log('[SRSDateUtils] calculateDaysInRange (Date-only):', {
        startDate: normalizedStart.toLocaleDateString(),
        endDate: normalizedEnd.toLocaleDateString(),
        diffInDays: result
      });
      
      return result;
    } catch (error) {
      console.error('[SRSDateUtils] calculateDaysInRange error:', error);
      return 0;
    }
  }

  /**
   * Проверяет, попадает ли дата в указанный диапазон
   */
  public static isDateInRange(date: Date, startDate: Date, endDate: Date): boolean {
    if (!date || !startDate || !endDate) {
      return false;
    }

    try {
      const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(date);
      const normalizedStart = SRSDateUtils.normalizeDateToLocalMidnight(startDate);
      const normalizedEnd = SRSDateUtils.normalizeDateToLocalMidnight(endDate);
      
      const inRange = normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
      
      console.log('[SRSDateUtils] isDateInRange (Date-only):', {
        date: normalizedDate.toLocaleDateString(),
        startDate: normalizedStart.toLocaleDateString(),
        endDate: normalizedEnd.toLocaleDateString(),
        inRange: inRange
      });
      
      return inRange;
    } catch (error) {
      console.error('[SRSDateUtils] isDateInRange error:', error);
      return false;
    }
  }

  /**
   * Получает следующую неделю от указанной даты
   */
  public static getNextWeek(currentDate: Date): Date {
    if (!currentDate) {
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }

    try {
      const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(currentDate);
      const nextWeek = new Date(normalizedDate);
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      console.log('[SRSDateUtils] getNextWeek (Date-only):', {
        currentDate: normalizedDate.toLocaleDateString(),
        nextWeek: nextWeek.toLocaleDateString()
      });
      
      return nextWeek;
    } catch (error) {
      console.error('[SRSDateUtils] getNextWeek error:', error);
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }
  }

  /**
   * Получает предыдущую неделю от указанной даты
   */
  public static getPreviousWeek(currentDate: Date): Date {
    if (!currentDate) {
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }

    try {
      const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(currentDate);
      const previousWeek = new Date(normalizedDate);
      previousWeek.setDate(previousWeek.getDate() - 7);
      
      console.log('[SRSDateUtils] getPreviousWeek (Date-only):', {
        currentDate: normalizedDate.toLocaleDateString(),
        previousWeek: previousWeek.toLocaleDateString()
      });
      
      return previousWeek;
    } catch (error) {
      console.error('[SRSDateUtils] getPreviousWeek error:', error);
      return SRSDateUtils.getFirstDayOfCurrentMonth();
    }
  }

  /**
   * Сравнивает две даты без учета времени
   */
  public static areDatesEqual(date1: Date, date2: Date): boolean {
    if (!date1 || !date2) {
      return false;
    }

    try {
      const normalized1 = SRSDateUtils.normalizeDateToLocalMidnight(date1);
      const normalized2 = SRSDateUtils.normalizeDateToLocalMidnight(date2);
      
      const equal = normalized1.getTime() === normalized2.getTime();
      
      console.log('[SRSDateUtils] areDatesEqual (Date-only):', {
        date1: normalized1.toLocaleDateString(),
        date2: normalized2.toLocaleDateString(),
        equal: equal
      });
      
      return equal;
    } catch (error) {
      console.error('[SRSDateUtils] areDatesEqual error:', error);
      return false;
    }
  }

  /**
   * Создает границы диапазона дат для запросов к SharePoint
   */
  public static createSharePointDateRangeBounds(fromDate: Date, toDate: Date): {
    startBound: Date;
    endBound: Date;
    startBoundFormatted: string;
    endBoundFormatted: string;
  } {
    if (!fromDate || !toDate) {
      throw new Error('Both fromDate and toDate are required for SharePoint range bounds');
    }

    const startBound = new Date(Date.UTC(
      fromDate.getFullYear(),
      fromDate.getMonth(),
      fromDate.getDate(),
      0, 0, 0, 0
    ));

    const endBound = new Date(Date.UTC(
      toDate.getFullYear(),
      toDate.getMonth(),
      toDate.getDate(),
      23, 59, 59, 999
    ));

    const startBoundFormatted = SRSDateUtils.formatDateForSharePoint(fromDate);
    const endBoundFormatted = SRSDateUtils.formatDateForSharePoint(toDate);

    console.log('[SRSDateUtils] createSharePointDateRangeBounds (Date-only):', {
      inputFromDate: fromDate.toLocaleDateString(),
      inputToDate: toDate.toLocaleDateString(),
      startBound: startBound.toISOString(),
      endBound: endBound.toISOString(),
      startBoundFormatted,
      endBoundFormatted,
      purpose: 'For SharePoint Date-only field range queries'
    });

    return {
      startBound,
      endBound,
      startBoundFormatted,
      endBoundFormatted
    };
  }

  /**
   * Валидирует дату для использования с Date-only полями
   */
  public static validateDateForSharePoint(date: Date): {
    isValid: boolean;
    error?: string;
    normalizedDate?: Date;
  } {
    if (!date) {
      return {
        isValid: false,
        error: 'Date is required'
      };
    }

    if (!(date instanceof Date)) {
      return {
        isValid: false,
        error: 'Value must be a Date object'
      };
    }

    if (isNaN(date.getTime())) {
      return {
        isValid: false,
        error: 'Date is invalid'
      };
    }

    const year = date.getFullYear();
    if (year < 1900 || year > 2100) {
      return {
        isValid: false,
        error: `Year ${year} is outside acceptable range (1900-2100)`
      };
    }

    const normalizedDate = SRSDateUtils.normalizeDateToLocalMidnight(date);

    console.log('[SRSDateUtils] validateDateForSharePoint (Date-only):', {
      input: date.toISOString(),
      inputLocal: date.toLocaleDateString(),
      isValid: true,
      normalizedDate: normalizedDate.toISOString()
    });

    return {
      isValid: true,
      normalizedDate
    };
  }
  
  /**
   * NEW: Serializes a Date object to a timezone-agnostic YYYY-MM-DD string.
   * This is the correct way to store a "Date Only" value in storage.
   */
  public static serializeDateOnly(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const serialized = `${year}-${month}-${day}`;
    console.log(`[SRSDateUtils] Serializing date ${date.toLocaleDateString()} to ${serialized}`);
    return serialized;
  }

  /**
   * NEW: Deserializes a YYYY-MM-DD string back into a local Date object.
   * Treats the string as a local date, preventing timezone shifts.
   */
  public static deserializeDateOnly(dateString: string): Date | null {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JS
      const day = parseInt(parts[2], 10);
      
      // Creating the date this way interprets the values in the local timezone
      const deserialized = new Date(year, month, day);
      console.log(`[SRSDateUtils] Deserializing string "${dateString}" to ${deserialized.toLocaleDateString()}`);
      return deserialized;
    }
    console.warn(`[SRSDateUtils] Invalid date string for deserialization: ${dateString}`);
    return null;
  }
}