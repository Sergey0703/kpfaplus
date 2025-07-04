// src/webparts/kpfaplus/services/CommonFillDateUtils.ts
// DATE AND TIME UTILITIES: All date/time calculations and timezone handling
// ИСПРАВЛЕНО: Разделена логика Date-only (UI) и DateTime (SharePoint) операций

import { RemoteSiteService } from './RemoteSiteService';
import { SharePointTimeZoneUtils } from '../utils/SharePointTimeZoneUtils';
import { IHoliday } from './HolidaysService';
import { ILeaveDay } from './DaysOfLeavesService';
import { 
  INumericTimeResult, 
  ITimeComponents, 
  IWeekAndDayResult,
  ILeavePeriod,
  FILL_CONSTANTS,
  DAY_NAMES,
  SharePointDayNumber,
  JavaScriptDayNumber,
  WeekChainingPattern
} from './CommonFillTypes';

export class CommonFillDateUtils {
  private remoteSiteService: RemoteSiteService;

  constructor(remoteSiteService: RemoteSiteService) {
    this.remoteSiteService = remoteSiteService;
    console.log('[CommonFillDateUtils] Utility class initialized with FIXED Date-only format support');
  }

  // *** ИСПРАВЛЕННЫЕ DATE-ONLY CORE METHODS - БЕЗ UTC ДЛЯ UI ОПЕРАЦИЙ ***

  /**
   * Создает Date-only объект из компонентов даты (для UI операций)
   * Избегает проблем с часовыми поясами используя локальные компоненты
   */
  public createDateOnlyFromComponents(year: number, month: number, day: number): Date {
    // month должен быть 0-based для конструктора Date
    // ИСПРАВЛЕНО: НЕ используем UTC для Date-only операций
    return new Date(year, month, day);
  }

  /**
   * Создает Date-only объект из существующей даты (для UI операций)
   * Сохраняет только компоненты даты, убирает время
   */
  public createDateOnlyFromDate(date: Date): Date {
    // ИСПРАВЛЕНО: Используем локальные компоненты, НЕ UTC
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Форматирует Date-only дату для отображения пользователю
   */
  public formatDateOnlyForDisplay(date?: Date): string {
    if (!date) return '';
    try {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      return `${day}.${month}.${year}`;
    } catch (error) {
      console.warn('[CommonFillDateUtils] Error formatting Date-only date for display:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * Форматирует Date-only дату для сравнения
   */
  public formatDateOnlyForComparison(date: Date): string {
    try {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch (error) {
      console.warn('[CommonFillDateUtils] Error formatting Date-only date for comparison:', error);
      return date.toLocaleDateString();
    }
  }

  /**
   * Получает первый день текущего месяца с Date-only подходом (для UI)
   */
  public getFirstDayOfCurrentMonth(): Date {
    const now = new Date();
    const result = this.createDateOnlyFromComponents(now.getFullYear(), now.getMonth(), 1);
    
    console.log('[CommonFillDateUtils] *** FIRST DAY OF CURRENT MONTH (FIXED DATE-ONLY) ***');
    console.log('[CommonFillDateUtils] Current date:', this.formatDateOnlyForDisplay(now));
    console.log('[CommonFillDateUtils] First day of month (local time):', this.formatDateOnlyForDisplay(result));
    
    return result;
  }

  // *** НОВЫЕ МЕТОДЫ: Разделение Date-only (UI) и DateTime (SharePoint) логики ***

  /**
   * НОВЫЙ: Сохранение Date-only для UI операций (выбор месяца) БЕЗ UTC
   */
  public saveDateOnlyForUI(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const dateOnlyString = `${year}-${month}-01`;
    
    console.log('[CommonFillDateUtils] *** НОВОЕ СОХРАНЕНИЕ DATE-ONLY ДЛЯ UI БЕЗ UTC ***');
    console.log('[CommonFillDateUtils] Input date:', this.formatDateOnlyForDisplay(date));
    console.log('[CommonFillDateUtils] Saved string (no UTC):', dateOnlyString);
    
    return dateOnlyString;
  }

  /**
   * НОВЫЙ: Восстановление Date-only для UI операций БЕЗ UTC
   */
  public restoreDateOnlyForUI(savedDateString: string): Date {
    try {
      console.log('[CommonFillDateUtils] *** НОВОЕ ВОССТАНОВЛЕНИЕ DATE-ONLY ДЛЯ UI БЕЗ UTC ***');
      console.log('[CommonFillDateUtils] Saved string:', savedDateString);
      
      const [year, month] = savedDateString.split('-').map(Number);
      // ИСПРАВЛЕНО: Создаем дату в локальном времени, НЕ в UTC
      const restoredDate = this.createDateOnlyFromComponents(year, month - 1, 1);
      
      console.log('[CommonFillDateUtils] Parsed components:', { year, month: month - 1, day: 1 });
      console.log('[CommonFillDateUtils] Restored date (local time):', this.formatDateOnlyForDisplay(restoredDate));
      console.log('[CommonFillDateUtils] Verification: expected month', restoredDate.getMonth() + 1);
      
      return restoredDate;
    } catch (error) {
      console.warn('[CommonFillDateUtils] Error restoring date from storage:', error);
      return this.getFirstDayOfCurrentMonth();
    }
  }

  /**
   * ИСПРАВЛЕНО: Нормализует дату к UTC ТОЛЬКО для сохранения в SharePoint
   * Используется только для DateTime полей в SharePoint, НЕ для Date-only UI операций
   */
  public normalizeToUTCForSharePoint(date: Date): Date {
    // *** ИСПРАВЛЕНО: Этот метод ТОЛЬКО для сохранения в SharePoint DateTime поля ***
    const utcForStorage = new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      FILL_CONSTANTS.TIMEZONE.NOON_SAFE_HOUR, 0, 0, 0  // Полдень UTC для безопасности
    ));
    
    console.log('[CommonFillDateUtils] *** UTC КОНВЕРТАЦИЯ ТОЛЬКО ДЛЯ SHAREPOINT DATETIME ***');
    console.log('[CommonFillDateUtils] Input date (local):', this.formatDateOnlyForDisplay(date));
    console.log('[CommonFillDateUtils] UTC for SharePoint DateTime:', utcForStorage.toISOString());
    console.log('[CommonFillDateUtils] WARNING: This is for SharePoint DateTime fields only!');
    
    return utcForStorage;
  }

  /**
   * ИСПРАВЛЕНО: Восстанавливает дату из SharePoint DateTime поля
   * Используется только для DateTime полей из SharePoint, НЕ для Date-only UI операций
   */
  public restoreFromSharePointDateTime(utcDateString: string): Date {
    try {
      const parsedDate = new Date(utcDateString);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date string');
      }
      
      // *** ИСПРАВЛЕНО: Этот метод ТОЛЬКО для восстановления из SharePoint DateTime ***
      const normalizedDate = this.createDateOnlyFromComponents(
        parsedDate.getUTCFullYear(),  // Используем UTC методы для SharePoint данных
        parsedDate.getUTCMonth(),     // Используем UTC методы для SharePoint данных
        1 // Всегда первый день месяца для периодов
      );
      
      console.log('[CommonFillDateUtils] *** ВОССТАНОВЛЕНИЕ ИЗ SHAREPOINT DATETIME ***');
      console.log('[CommonFillDateUtils] SharePoint UTC string:', utcDateString);
      console.log('[CommonFillDateUtils] UTC components extracted:', {
        year: parsedDate.getUTCFullYear(),
        month: parsedDate.getUTCMonth(),
        day: parsedDate.getUTCDate()
      });
      console.log('[CommonFillDateUtils] Restored date (local time):', this.formatDateOnlyForDisplay(normalizedDate));
      console.log('[CommonFillDateUtils] WARNING: This is for SharePoint DateTime fields only!');
      
      return normalizedDate;
    } catch (error) {
      console.warn('[CommonFillDateUtils] Error restoring date from SharePoint DateTime:', error);
      return this.getFirstDayOfCurrentMonth();
    }
  }

  // *** УСТАРЕВШИЕ МЕТОДЫ - ОСТАВЛЕНЫ ДЛЯ СОВМЕСТИМОСТИ ***
  
  /**
   * @deprecated Используйте normalizeToUTCForSharePoint() для SharePoint или saveDateOnlyForUI() для UI
   */
  public normalizeToUTCForStorage(date: Date): Date {
    console.warn('[CommonFillDateUtils] DEPRECATED: normalizeToUTCForStorage() - use normalizeToUTCForSharePoint() or saveDateOnlyForUI()');
    return this.normalizeToUTCForSharePoint(date);
  }

  /**
   * @deprecated Используйте restoreFromSharePointDateTime() для SharePoint или restoreDateOnlyForUI() для UI
   */
  public restoreFromUTCStorage(savedDate: string): Date {
    console.warn('[CommonFillDateUtils] DEPRECATED: restoreFromUTCStorage() - use restoreFromSharePointDateTime() or restoreDateOnlyForUI()');
    return this.restoreFromSharePointDateTime(savedDate);
  }

  // *** DAY NAME UTILITIES ***

  /**
   * Получает название дня из JavaScript номера дня недели
   */
  public getJSDayName(jsDay: number): string {
    return DAY_NAMES.JAVASCRIPT[jsDay as JavaScriptDayNumber] || 'Unknown';
  }

  /**
   * Получает название дня из SharePoint номера дня недели
   */
  public getSharePointDayName(dayNumber: number): string {
    return DAY_NAMES.SHAREPOINT[dayNumber as SharePointDayNumber] || 'Unknown';
  }

  /**
   * Получает название дня недели (использует SharePoint формат)
   */
  public getDayName(dayNumber: number): string {
    return this.getSharePointDayName(dayNumber);
  }

  // *** WEEK AND DAY CALCULATIONS ***

  /**
   * ИСПРАВЛЕННЫЙ МЕТОД: Вычисляет номер недели и день с учетом логики чередования
   * Правильная логика преобразования дней недели JS -> SharePoint
   */
  public calculateWeekAndDayWithChaining(
    date: Date, 
    startOfMonth: Date, 
    dayOfStartWeek: number, 
    numberOfWeekTemplates: number
  ): IWeekAndDayResult {
    console.log(`[CommonFillDateUtils] *** WEEK AND DAY CALCULATION FOR ${date.toISOString()} ***`);
    console.log(`[CommonFillDateUtils] Input parameters: dayOfStartWeek=${dayOfStartWeek}, numberOfWeekTemplates=${numberOfWeekTemplates}`);
    
    // 1. ПОЛУЧАЕМ СТАНДАРТНЫЙ ДЕНЬ НЕДЕЛИ ИЗ JAVASCRIPT (UTC)
    const jsDay = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    console.log(`[CommonFillDateUtils] JavaScript UTC day: ${jsDay} (${this.getJSDayName(jsDay)})`);
    
    // 2. КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: ПРАВИЛЬНОЕ ПРЕОБРАЗОВАНИЕ JS -> SharePoint
    let dayNumber: number;
    
    // JavaScript: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // SharePoint: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    
    if (jsDay === FILL_CONSTANTS.JS_DAYS.SUNDAY) {
      dayNumber = FILL_CONSTANTS.SHAREPOINT_DAYS.SUNDAY; // Sunday = 7
    } else {
      dayNumber = jsDay; // Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
    }
    
    console.log(`[CommonFillDateUtils] *** ИСПРАВЛЕННОЕ ПРЕОБРАЗОВАНИЕ ***`);
    console.log(`[CommonFillDateUtils] JavaScript day ${jsDay} (${this.getJSDayName(jsDay)}) → SharePoint day ${dayNumber}`);
    
    // 3. ПРОВЕРЯЕМ ПРАВИЛЬНОСТЬ ПРЕОБРАЗОВАНИЯ
    const expectedDayName = this.getJSDayName(jsDay);
    const convertedDayName = this.getSharePointDayName(dayNumber as SharePointDayNumber);
    
    if (expectedDayName !== convertedDayName) {
      console.error(`[CommonFillDateUtils] *** КРИТИЧЕСКАЯ ОШИБКА ПРЕОБРАЗОВАНИЯ ***`);
      console.error(`[CommonFillDateUtils] Ожидалось: ${expectedDayName}, получено: ${convertedDayName}`);
    } else {
      console.log(`[CommonFillDateUtils] ✅ Преобразование дня недели ИСПРАВЛЕНО: ${expectedDayName}`);
    }
    
    // 4. ВЫЧИСЛЯЕМ КАЛЕНДАРНУЮ НЕДЕЛЮ МЕСЯЦА С UTC
    const dayOfMonth = date.getUTCDate();
    const firstDayOfMonth = new Date(Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth(), 1, 0, 0, 0, 0));
    const firstDayJS = firstDayOfMonth.getUTCDay(); // JavaScript день недели первого дня месяца в UTC
    
    console.log(`[CommonFillDateUtils] Month calculation: dayOfMonth=${dayOfMonth}, firstDayJS=${firstDayJS}`);
    
    // ИСПРАВЛЕННАЯ ЛОГИКА РАСЧЕТА НЕДЕЛЬ
    let adjustedFirstDay: number;
    
    if (dayOfStartWeek === FILL_CONSTANTS.WEEK_START_DAYS.MONDAY) {
      // Понедельник = начало недели для РАСЧЕТА НОМЕРА НЕДЕЛИ
      adjustedFirstDay = firstDayJS === 0 ? 6 : firstDayJS - 1; // Sunday=6, Monday=0, Tuesday=1, etc.
    } else if (dayOfStartWeek === FILL_CONSTANTS.WEEK_START_DAYS.SATURDAY) {
      // Суббота = начало недели для РАСЧЕТА НОМЕРА НЕДЕЛИ
      adjustedFirstDay = (firstDayJS + 1) % 7; // Saturday=0, Sunday=1, Monday=2, etc.
    } else {
      // Воскресенье = начало недели для РАСЧЕТА НОМЕРА НЕДЕЛИ (стандартная JS логика)
      adjustedFirstDay = firstDayJS;
    }
    
    const calendarWeekNumber = Math.floor((dayOfMonth - 1 + adjustedFirstDay) / 7) + 1;
    
    console.log(`[CommonFillDateUtils] Week calculation: adjustedFirstDay=${adjustedFirstDay} → calendarWeekNumber=${calendarWeekNumber}`);
    
    // 5. ВЫЧИСЛЯЕМ НОМЕР НЕДЕЛИ ШАБЛОНА С УЧЕТОМ ЧЕРЕДОВАНИЯ
    let templateWeekNumber: number;
    
    switch (numberOfWeekTemplates) {
      case FILL_CONSTANTS.WEEK_PATTERNS.SINGLE:
        templateWeekNumber = 1;
        console.log(`[CommonFillDateUtils] Single week template: templateWeekNumber=1`);
        break;
      case FILL_CONSTANTS.WEEK_PATTERNS.ALTERNATING:
        templateWeekNumber = (calendarWeekNumber - 1) % 2 + 1;
        console.log(`[CommonFillDateUtils] Two week alternating: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
      case FILL_CONSTANTS.WEEK_PATTERNS.THREE_WEEK:
        templateWeekNumber = (calendarWeekNumber - 1) % 3 + 1;
        console.log(`[CommonFillDateUtils] Three week cycle: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
      case FILL_CONSTANTS.WEEK_PATTERNS.MONTHLY:
        templateWeekNumber = Math.min(calendarWeekNumber, 4);
        console.log(`[CommonFillDateUtils] Four week cycle: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
      default:
        templateWeekNumber = (calendarWeekNumber - 1) % numberOfWeekTemplates + 1;
        console.log(`[CommonFillDateUtils] Custom ${numberOfWeekTemplates} week cycle: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
    }
    
    // 6. ФИНАЛЬНАЯ ПРОВЕРКА И ЛОГИРОВАНИЕ
    console.log(`[CommonFillDateUtils] *** ИСПРАВЛЕННЫЙ РЕЗУЛЬТАТ ДЛЯ ${date.toISOString()} ***`);
    console.log(`[CommonFillDateUtils] - Calendar week: ${calendarWeekNumber}`);
    console.log(`[CommonFillDateUtils] - Template week: ${templateWeekNumber}`);
    console.log(`[CommonFillDateUtils] - SharePoint day number: ${dayNumber}`);
    console.log(`[CommonFillDateUtils] - Day name: ${convertedDayName}`);
    
    return { 
      calendarWeekNumber, 
      templateWeekNumber, 
      dayNumber 
    };
  }

  /**
   * Получает описание логики чередования недель
   */
  public getWeekChainingDescription(numberOfWeekTemplates: number): string {
    switch (numberOfWeekTemplates) {
      case FILL_CONSTANTS.WEEK_PATTERNS.SINGLE:
        return 'Single week template - repeat for all weeks (1,1,1,1)';
      case FILL_CONSTANTS.WEEK_PATTERNS.ALTERNATING:
        return 'Two week templates - alternate pattern (1,2,1,2)';
      case FILL_CONSTANTS.WEEK_PATTERNS.THREE_WEEK:
        return 'Three week templates - cycle pattern (1,2,3,1,2,3,...)';
      case FILL_CONSTANTS.WEEK_PATTERNS.MONTHLY:
        return 'Four week templates - full month cycle (1,2,3,4)';
      default:
        return `${numberOfWeekTemplates} week templates - custom cycle pattern`;
    }
  }

  /**
   * Определяет паттерн чередования недель по количеству шаблонов
   */
  public getWeekChainingPattern(numberOfWeekTemplates: number): WeekChainingPattern {
    switch (numberOfWeekTemplates) {
      case 1: return WeekChainingPattern.SINGLE;
      case 2: return WeekChainingPattern.ALTERNATING;
      case 3: return WeekChainingPattern.THREE_WEEK;
      case 4: return WeekChainingPattern.FOUR_WEEK;
      default: return WeekChainingPattern.CUSTOM;
    }
  }

  // *** TIME PROCESSING UTILITIES ***

  /**
   * Парсит строку времени в компоненты часов и минут
   */
  public parseTimeString(timeStr: string): ITimeComponents {
    try {
      const parts = timeStr.split(':');
      const hours = parts[0] || '9';
      const minutes = parts.length > 1 ? parts[1] : '0';
      
      return {
        hours: hours.padStart(2, '0'),
        minutes: minutes.padStart(2, '0')
      };
    } catch (error) {
      console.error(`[CommonFillDateUtils] Error parsing time string "${timeStr}":`, error);
      return { 
        hours: FILL_CONSTANTS.DEFAULT_START_TIME.split(':')[0].padStart(2, '0'),
        minutes: FILL_CONSTANTS.DEFAULT_START_TIME.split(':')[1].padStart(2, '0')
      };
    }
  }

  /**
   * Получает время с timezone adjustment в числовом формате
   * Вместо создания Date объекта возвращает часы и минуты
   */
  public async getAdjustedNumericTime(time?: ITimeComponents): Promise<INumericTimeResult> {
    if (!time) {
      console.log(`[CommonFillDateUtils] No time provided, returning 0:0`);
      return { hours: 0, minutes: 0 };
    }
    
    const hours = parseInt(time.hours || '0', 10);
    const minutes = parseInt(time.minutes || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn(`[CommonFillDateUtils] Invalid time components: hours="${time.hours}", minutes="${time.minutes}"`);
      return { hours: 0, minutes: 0 };
    }
    
    console.log(`[CommonFillDateUtils] *** NUMERIC TIME TIMEZONE ADJUSTMENT ***`);
    console.log(`[CommonFillDateUtils] Input time from template: ${hours}:${minutes}`);
    
    try {
      // Используем SharePointTimeZoneUtils для корректировки времени
      const adjustedTime = await SharePointTimeZoneUtils.adjustTimeForSharePointTimeZone(
        hours, 
        minutes, 
        this.remoteSiteService, 
        new Date() // Используем текущую дату для определения DST
      );
      
      console.log(`[CommonFillDateUtils] *** TIMEZONE ADJUSTMENT COMPLETED ***`);
      console.log(`[CommonFillDateUtils] ${hours}:${minutes} → ${adjustedTime.hours}:${adjustedTime.minutes}`);
      
      return {
        hours: adjustedTime.hours,
        minutes: adjustedTime.minutes
      };
    } catch (error) {
      console.error(`[CommonFillDateUtils] Error in timezone adjustment: ${error}`);
      console.log(`[CommonFillDateUtils] Falling back to original time: ${hours}:${minutes}`);
      return { hours, minutes };
    }
  }

  /**
   * Форматирует числовое время для отображения
   */
  public formatNumericTime(time: INumericTimeResult): string {
    const hours = time.hours.toString().padStart(2, '0');
    const minutes = time.minutes.toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // *** HOLIDAY AND LEAVE UTILITIES ***

  /**
   * Создает кэш праздников для быстрого поиска с Date-only поддержкой
   */
  public createHolidayCacheWithDateOnly(holidays: IHoliday[]): Map<string, IHoliday> {
    const cache = new Map<string, IHoliday>();
    holidays.forEach((holiday: IHoliday) => {
      const key = this.formatDateOnlyForComparison(holiday.date);
      cache.set(key, holiday);
      console.log(`[CommonFillDateUtils] Added holiday to Date-only cache: ${key} - ${holiday.title}`);
    });
    console.log(`[CommonFillDateUtils] Created Date-only holiday cache with ${cache.size} entries`);
    return cache;
  }

  /**
   * Создает массив периодов отпусков для быстрой проверки с Date-only поддержкой
   */
  public createLeavePeriodsWithDateOnly(leaves: ILeaveDay[]): ILeavePeriod[] {
    // Фильтруем удаленные отпуска для Dashboard Tab
    const activeLeaves = leaves.filter(leave => {
      const isDeleted = leave.deleted === true;
      if (isDeleted) {
        console.log(`[CommonFillDateUtils] Filtering out deleted leave: ${leave.title} (${this.formatDateOnlyForDisplay(leave.startDate)} - ${leave.endDate ? this.formatDateOnlyForDisplay(leave.endDate) : 'ongoing'})`);
      }
      return !isDeleted;
    });
    
    const leavePeriods = activeLeaves.map((leave: ILeaveDay): ILeavePeriod => {
      // Создаем Date-only объекты для корректного сравнения
      const startDate = this.createDateOnlyFromDate(leave.startDate);
      const endDate = leave.endDate ? this.createDateOnlyFromDate(leave.endDate) : new Date(2099, 11, 31);
      
      console.log(`[CommonFillDateUtils] Added leave to Date-only cache: ${this.formatDateOnlyForDisplay(startDate)} - ${this.formatDateOnlyForDisplay(endDate)}, type: ${leave.typeOfLeave}, title: "${leave.title}"`);
      
      return {
        startDate,
        endDate,
        typeOfLeave: leave.typeOfLeave.toString(),
        title: leave.title || ''
      };
    });
    
    console.log(`[CommonFillDateUtils] Created Date-only leave periods cache with ${leavePeriods.length} entries from ${leaves.length} total`);
    return leavePeriods;
  }

  /**
   * Проверка праздника с Date-only поддержкой
   */
  public isHolidayWithDateOnly(date: Date, holidayCache: Map<string, IHoliday>): boolean {
    const dateKey = this.formatDateOnlyForComparison(date);
    return holidayCache.has(dateKey);
  }

  /**
   * Проверка отпуска с Date-only поддержкой
   */
  public isLeaveWithDateOnly(date: Date, leavePeriods: ILeavePeriod[]): boolean {
    return leavePeriods.some(leave => {
      const checkDate = this.createDateOnlyFromDate(date);
      const leaveStart = this.createDateOnlyFromDate(leave.startDate);
      const leaveEnd = this.createDateOnlyFromDate(leave.endDate);
      
      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
  }

  /**
   * Получение отпуска для дня с Date-only поддержкой
   */
  public getLeaveForDayWithDateOnly(date: Date, leavePeriods: ILeavePeriod[]): ILeavePeriod | undefined {
    return leavePeriods.find(leave => {
      const checkDate = this.createDateOnlyFromDate(date);
      const leaveStart = this.createDateOnlyFromDate(leave.startDate);
      const leaveEnd = this.createDateOnlyFromDate(leave.endDate);
      
      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
  }

  // *** ИСПРАВЛЕННЫЕ MONTH PERIOD CALCULATIONS - БЕЗ UTC ДЛЯ ЛОКАЛЬНЫХ ОПЕРАЦИЙ ***

  /**
   * ИСПРАВЛЕНО: Вычисляет период месяца с правильной обработкой локального времени и UTC
   */
  public calculateMonthPeriod(selectedDate: Date, contractStartDate?: string, contractFinishDate?: string): {
    startOfMonth: Date;
    endOfMonth: Date;
    firstDay: Date;
    lastDay: Date;
    totalDays: number;
  } {
    console.log('[CommonFillDateUtils] *** ИСПРАВЛЕННЫЙ РАСЧЕТ ПЕРИОДА МЕСЯЦА ***');
    console.log('[CommonFillDateUtils] Selected date (input):', this.formatDateOnlyForDisplay(selectedDate));
    
    // ИСПРАВЛЕНО: Создаем локальные даты для UI операций, НЕ UTC
    const startOfMonth = this.createDateOnlyFromComponents(
      selectedDate.getFullYear(), 
      selectedDate.getMonth(), 
      1
    );
    
    const endOfMonth = this.createDateOnlyFromComponents(
      selectedDate.getFullYear(), 
      selectedDate.getMonth() + 1, 
      0 // Последний день месяца
    );

    console.log(`[CommonFillDateUtils] *** ИСПРАВЛЕННЫЕ ГРАНИЦЫ МЕСЯЦА (ЛОКАЛЬНОЕ ВРЕМЯ) ***`);
    console.log(`[CommonFillDateUtils] Start of month (local): ${this.formatDateOnlyForDisplay(startOfMonth)}`);
    console.log(`[CommonFillDateUtils] End of month (local): ${this.formatDateOnlyForDisplay(endOfMonth)}`);

    // ИСПРАВЛЕНО: Используем локальные даты для определения периода генерации
    let firstDay: Date;
    if (contractStartDate && new Date(contractStartDate) > startOfMonth) {
      const contractStart = new Date(contractStartDate);
      firstDay = this.createDateOnlyFromComponents(
        contractStart.getFullYear(),
        contractStart.getMonth(),
        contractStart.getDate()
      );
      console.log(`[CommonFillDateUtils] Contract start date limits first day: ${this.formatDateOnlyForDisplay(firstDay)}`);
    } else {
      firstDay = startOfMonth;
    }

    let lastDay: Date;
    if (contractFinishDate && new Date(contractFinishDate) < endOfMonth) {
      const contractEnd = new Date(contractFinishDate);
      lastDay = this.createDateOnlyFromComponents(
        contractEnd.getFullYear(),
        contractEnd.getMonth(),
        contractEnd.getDate()
      );
      console.log(`[CommonFillDateUtils] Contract end date limits last day: ${this.formatDateOnlyForDisplay(lastDay)}`);
    } else {
      lastDay = endOfMonth;
    }

    // ИСПРАВЛЕНО: Вычисляем количество дней используя локальное время
    const totalDays = Math.floor((lastDay.getTime() - firstDay.getTime()) / FILL_CONSTANTS.TIMEZONE.MILLISECONDS_PER_DAY) + 1;

    console.log(`[CommonFillDateUtils] *** ИСПРАВЛЕННЫЙ ИТОГОВЫЙ ПЕРИОД (ЛОКАЛЬНОЕ ВРЕМЯ) ***`);
    console.log(`[CommonFillDateUtils] Generation period: ${this.formatDateOnlyForDisplay(firstDay)} - ${this.formatDateOnlyForDisplay(lastDay)}`);
    console.log(`[CommonFillDateUtils] Total days in period: ${totalDays}`);

    return {
      startOfMonth,
      endOfMonth,
      firstDay,
      lastDay,
      totalDays
    };
  }

  /**
   * НОВЫЙ: Создает UTC даты специально для запросов к SharePoint
   * Используется только для запросов к SharePoint списках с DateTime полями
   */
  public createUTCBoundariesForSharePointQuery(firstDay: Date, lastDay: Date): {
    startUTC: Date;
    endUTC: Date;
  } {
    console.log('[CommonFillDateUtils] *** СОЗДАНИЕ UTC ГРАНИЦ ДЛЯ SHAREPOINT ЗАПРОСОВ ***');
    
    const startUTC = new Date(Date.UTC(
      firstDay.getFullYear(),
      firstDay.getMonth(),
      firstDay.getDate(),
      0, 0, 0, 0
    ));
    
    const endUTC = new Date(Date.UTC(
      lastDay.getFullYear(),
      lastDay.getMonth(),
      lastDay.getDate(),
      23, 59, 59, 999
    ));

    console.log(`[CommonFillDateUtils] Local boundaries: ${this.formatDateOnlyForDisplay(firstDay)} - ${this.formatDateOnlyForDisplay(lastDay)}`);
    console.log(`[CommonFillDateUtils] UTC for SharePoint: ${startUTC.toISOString()} - ${endUTC.toISOString()}`);
    console.log(`[CommonFillDateUtils] Purpose: SharePoint DateTime field queries only`);

    return {
      startUTC,
      endUTC
    };
  }
}