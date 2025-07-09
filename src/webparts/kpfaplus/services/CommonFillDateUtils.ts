// src/webparts/kpfaplus/services/CommonFillDateUtils.ts
// DATE AND TIME UTILITIES: All date/time calculations and timezone handling
// FIXED: formatDateOnlyForSharePoint now uses UTC midnight for ALL Date-only fields including StaffRecords.Date

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
    console.log('[CommonFillDateUtils] FIXED: Utility class initialized - ALL Date-only fields use UTC midnight format');
  }

  // *** FIXED: Now used for ALL SharePoint Date-only fields (ScheduleLogs.Date, Holidays.date, StaffRecords.Date, DaysOfLeaves.Date) ***

  /**
   * *** FIXED: Formats Date-only date for ALL SharePoint Date-only fields ***
   * Prevents timezone conversion for ALL Date-only fields including StaffRecords.Date
   */
  public formatDateOnlyForSharePoint(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // FIXED: Send as UTC midnight to prevent timezone conversion for ALL Date-only fields
    // Adding 'Z' forces UTC time and prevents SharePoint from shifting dates
    const utcString = `${year}-${month}-${day}T00:00:00.000Z`;
    
    console.log('[CommonFillDateUtils] *** FIXED: DATE-ONLY FIELD FORMAT FOR ALL SHAREPOINT DATE-ONLY FIELDS ***');
    console.log('[CommonFillDateUtils] Input date:', this.formatDateOnlyForDisplay(date));
    console.log('[CommonFillDateUtils] Date-only SharePoint format:', utcString);
    console.log('[CommonFillDateUtils] FIXED: Purpose: ScheduleLogs.Date, Holidays.date, StaffRecords.Date, DaysOfLeaves.Date (ALL Date-only fields)');
    
    return utcString;
  }

  /**
   * *** FIXED: Creates Date object from Date-only SharePoint string for ALL Date-only fields ***
   */
  public createDateFromDateOnlySharePointString(utcString: string): Date {
    const date = new Date(utcString);
    console.log('[CommonFillDateUtils] *** FIXED: PARSING DATE-ONLY SHAREPOINT STRING FOR ALL DATE-ONLY FIELDS ***');
    console.log('[CommonFillDateUtils] SharePoint string:', utcString);
    console.log('[CommonFillDateUtils] Parsed date:', this.formatDateOnlyForDisplay(date));
    return date;
  }

  // *** DATE-ONLY CORE METHODS - FOR UI OPERATIONS ***

  /**
   * Creates Date-only object from components (for UI operations)
   * Avoids timezone issues using local components
   */
  public createDateOnlyFromComponents(year: number, month: number, day: number): Date {
    // month should be 0-based for Date constructor
    return new Date(year, month, day);
  }

  /**
   * Creates Date-only object from existing date (for UI operations)
   * Keeps only date components, removes time
   */
  public createDateOnlyFromDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Formats Date-only date for user display
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
   * Formats Date-only date for comparison
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
   * Gets first day of current month with Date-only approach (for UI)
   */
  public getFirstDayOfCurrentMonth(): Date {
    const now = new Date();
    const result = this.createDateOnlyFromComponents(now.getFullYear(), now.getMonth(), 1);
    
    console.log('[CommonFillDateUtils] *** FIRST DAY OF CURRENT MONTH (DATE-ONLY) ***');
    console.log('[CommonFillDateUtils] Current date:', this.formatDateOnlyForDisplay(now));
    console.log('[CommonFillDateUtils] First day of month (local time):', this.formatDateOnlyForDisplay(result));
    
    return result;
  }

  // *** UI OPERATIONS: Date-only save/restore for UI (month selection) ***

  /**
   * Save Date-only for UI operations (month selection) without UTC
   */
  public saveDateOnlyForUI(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const dateOnlyString = `${year}-${month}-01`;
    
    console.log('[CommonFillDateUtils] *** SAVING DATE-ONLY FOR UI WITHOUT UTC ***');
    console.log('[CommonFillDateUtils] Input date:', this.formatDateOnlyForDisplay(date));
    console.log('[CommonFillDateUtils] Saved string (no UTC):', dateOnlyString);
    
    return dateOnlyString;
  }

  /**
   * Restore Date-only for UI operations without UTC
   */
  public restoreDateOnlyForUI(savedDateString: string): Date {
    try {
      console.log('[CommonFillDateUtils] *** RESTORING DATE-ONLY FOR UI WITHOUT UTC ***');
      console.log('[CommonFillDateUtils] Saved string:', savedDateString);
      
      const [year, month] = savedDateString.split('-').map(Number);
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

  // *** FIXED: All UTC methods for DateTime fields have been REMOVED since ALL fields are now Date-only ***
  // The following methods have been removed since StaffRecords.Date is now Date-only:
  // - normalizeToUTCForSharePoint()
  // - restoreFromSharePointDateTime() 
  // - createUTCBoundariesForSharePointQuery()

  // *** DAY NAME UTILITIES ***

  /**
   * Gets day name from JavaScript day number
   */
  public getJSDayName(jsDay: number): string {
    return DAY_NAMES.JAVASCRIPT[jsDay as JavaScriptDayNumber] || 'Unknown';
  }

  /**
   * Gets day name from SharePoint day number
   */
  public getSharePointDayName(dayNumber: number): string {
    return DAY_NAMES.SHAREPOINT[dayNumber as SharePointDayNumber] || 'Unknown';
  }

  /**
   * Gets day name (uses SharePoint format)
   */
  public getDayName(dayNumber: number): string {
    return this.getSharePointDayName(dayNumber);
  }

  // *** WEEK AND DAY CALCULATIONS ***

  /**
   * Calculates week number and day with chaining logic
   * Proper JavaScript -> SharePoint day conversion
   */
  public calculateWeekAndDayWithChaining(
    date: Date, 
    startOfMonth: Date, 
    dayOfStartWeek: number, 
    numberOfWeekTemplates: number
  ): IWeekAndDayResult {
    console.log(`[CommonFillDateUtils] *** WEEK AND DAY CALCULATION FOR ${date.toISOString()} ***`);
    console.log(`[CommonFillDateUtils] Input parameters: dayOfStartWeek=${dayOfStartWeek}, numberOfWeekTemplates=${numberOfWeekTemplates}`);
    
    // 1. GET STANDARD DAY OF WEEK FROM JAVASCRIPT (UTC)
    const jsDay = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    console.log(`[CommonFillDateUtils] JavaScript UTC day: ${jsDay} (${this.getJSDayName(jsDay)})`);
    
    // 2. PROPER JS -> SharePoint CONVERSION
    let dayNumber: number;
    
    // JavaScript: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    // SharePoint: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
    
    if (jsDay === FILL_CONSTANTS.JS_DAYS.SUNDAY) {
      dayNumber = FILL_CONSTANTS.SHAREPOINT_DAYS.SUNDAY; // Sunday = 7
    } else {
      dayNumber = jsDay; // Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
    }
    
    console.log(`[CommonFillDateUtils] *** JS TO SHAREPOINT CONVERSION ***`);
    console.log(`[CommonFillDateUtils] JavaScript day ${jsDay} (${this.getJSDayName(jsDay)}) → SharePoint day ${dayNumber}`);
    
    // 3. VERIFY CONVERSION
    const expectedDayName = this.getJSDayName(jsDay);
    const convertedDayName = this.getSharePointDayName(dayNumber as SharePointDayNumber);
    
    if (expectedDayName !== convertedDayName) {
      console.error(`[CommonFillDateUtils] *** CONVERSION ERROR ***`);
      console.error(`[CommonFillDateUtils] Expected: ${expectedDayName}, got: ${convertedDayName}`);
    } else {
      console.log(`[CommonFillDateUtils] ✅ Day conversion correct: ${expectedDayName}`);
    }
    
    // 4. CALCULATE CALENDAR WEEK OF MONTH WITH UTC
    const dayOfMonth = date.getUTCDate();
    const firstDayOfMonth = new Date(Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth(), 1, 0, 0, 0, 0));
    const firstDayJS = firstDayOfMonth.getUTCDay(); // JavaScript day of week of first day of month in UTC
    
    console.log(`[CommonFillDateUtils] Month calculation: dayOfMonth=${dayOfMonth}, firstDayJS=${firstDayJS}`);
    
    // WEEK CALCULATION LOGIC
    let adjustedFirstDay: number;
    
    if (dayOfStartWeek === FILL_CONSTANTS.WEEK_START_DAYS.MONDAY) {
      // Monday = week start for WEEK NUMBER CALCULATION
      adjustedFirstDay = firstDayJS === 0 ? 6 : firstDayJS - 1; // Sunday=6, Monday=0, Tuesday=1, etc.
    } else if (dayOfStartWeek === FILL_CONSTANTS.WEEK_START_DAYS.SATURDAY) {
      // Saturday = week start for WEEK NUMBER CALCULATION
      adjustedFirstDay = (firstDayJS + 1) % 7; // Saturday=0, Sunday=1, Monday=2, etc.
    } else {
      // Sunday = week start for WEEK NUMBER CALCULATION (standard JS logic)
      adjustedFirstDay = firstDayJS;
    }
    
    const calendarWeekNumber = Math.floor((dayOfMonth - 1 + adjustedFirstDay) / 7) + 1;
    
    console.log(`[CommonFillDateUtils] Week calculation: adjustedFirstDay=${adjustedFirstDay} → calendarWeekNumber=${calendarWeekNumber}`);
    
    // 5. CALCULATE TEMPLATE WEEK NUMBER WITH CHAINING
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
    
    // 6. FINAL VERIFICATION AND LOGGING
    console.log(`[CommonFillDateUtils] *** RESULT FOR ${date.toISOString()} ***`);
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
   * Gets week chaining description
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
   * Determines week chaining pattern by number of templates
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
   * Parses time string into hours and minutes components
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
   * Gets time with timezone adjustment in numeric format
   * Returns hours and minutes instead of creating Date object
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
      // Use SharePointTimeZoneUtils for correct time adjustment
      const adjustedTime = await SharePointTimeZoneUtils.adjustTimeForSharePointTimeZone(
        hours, 
        minutes, 
        this.remoteSiteService, 
        new Date() // Use current date for DST determination
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
   * Formats numeric time for display
   */
  public formatNumericTime(time: INumericTimeResult): string {
    const hours = time.hours.toString().padStart(2, '0');
    const minutes = time.minutes.toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  // *** HOLIDAY AND LEAVE UTILITIES WITH FIXED DATE-ONLY SUPPORT ***

  /**
   * FIXED: Creates holiday cache for fast lookup with Date-only support
   * Now properly handles all Date-only fields using UTC midnight approach
   */
  public createHolidayCacheWithDateOnly(holidays: IHoliday[]): Map<string, IHoliday> {
    const cache = new Map<string, IHoliday>();
    holidays.forEach((holiday: IHoliday) => {
      const key = this.formatDateOnlyForComparison(holiday.date);
      cache.set(key, holiday);
      console.log(`[CommonFillDateUtils] FIXED: Added holiday to Date-only cache: ${key} - ${holiday.title}`);
    });
    console.log(`[CommonFillDateUtils] FIXED: Created Date-only holiday cache with ${cache.size} entries`);
    return cache;
  }

  /**
   * FIXED: Creates leave periods array for fast checking with Date-only support
   * Now properly handles all Date-only fields using UTC midnight approach
   */
  public createLeavePeriodsWithDateOnly(leaves: ILeaveDay[]): ILeavePeriod[] {
    // Filter deleted leaves for Dashboard Tab
    const activeLeaves = leaves.filter(leave => {
      const isDeleted = leave.deleted === true;
      if (isDeleted) {
        console.log(`[CommonFillDateUtils] FIXED: Filtering out deleted leave: ${leave.title} (${this.formatDateOnlyForDisplay(leave.startDate)} - ${leave.endDate ? this.formatDateOnlyForDisplay(leave.endDate) : 'ongoing'})`);
      }
      return !isDeleted;
    });
    
    const leavePeriods = activeLeaves.map((leave: ILeaveDay): ILeavePeriod => {
      // FIXED: Create Date-only objects for correct comparison using UTC midnight approach
      const startDate = this.createDateOnlyFromDate(leave.startDate);
      const endDate = leave.endDate ? this.createDateOnlyFromDate(leave.endDate) : new Date(2099, 11, 31);
      
      console.log(`[CommonFillDateUtils] FIXED: Added leave to Date-only cache: ${this.formatDateOnlyForDisplay(startDate)} - ${this.formatDateOnlyForDisplay(endDate)}, type: ${leave.typeOfLeave}, title: "${leave.title}"`);
      
      return {
        startDate,
        endDate,
        typeOfLeave: leave.typeOfLeave.toString(),
        title: leave.title || ''
      };
    });
    
    console.log(`[CommonFillDateUtils] FIXED: Created Date-only leave periods cache with ${leavePeriods.length} entries from ${leaves.length} total`);
    return leavePeriods;
  }

  /**
   * FIXED: Check holiday with Date-only support
   */
  public isHolidayWithDateOnly(date: Date, holidayCache: Map<string, IHoliday>): boolean {
    const dateKey = this.formatDateOnlyForComparison(date);
    return holidayCache.has(dateKey);
  }

  /**
   * FIXED: Check leave with Date-only support
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
   * FIXED: Get leave for day with Date-only support
   */
  public getLeaveForDayWithDateOnly(date: Date, leavePeriods: ILeavePeriod[]): ILeavePeriod | undefined {
    return leavePeriods.find(leave => {
      const checkDate = this.createDateOnlyFromDate(date);
      const leaveStart = this.createDateOnlyFromDate(leave.startDate);
      const leaveEnd = this.createDateOnlyFromDate(leave.endDate);
      
      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
  }

  // *** MONTH PERIOD CALCULATIONS - Date-only for local operations ***

  /**
   * Calculates month period with proper local time handling
   */
  public calculateMonthPeriod(selectedDate: Date, contractStartDate?: string, contractFinishDate?: string): {
    startOfMonth: Date;
    endOfMonth: Date;
    firstDay: Date;
    lastDay: Date;
    totalDays: number;
  } {
    console.log('[CommonFillDateUtils] *** CALCULATING MONTH PERIOD ***');
    console.log('[CommonFillDateUtils] Selected date (input):', this.formatDateOnlyForDisplay(selectedDate));
    
    // Create local dates for UI operations
    const startOfMonth = this.createDateOnlyFromComponents(
      selectedDate.getFullYear(), 
      selectedDate.getMonth(), 
      1
    );
    
    const endOfMonth = this.createDateOnlyFromComponents(
      selectedDate.getFullYear(), 
      selectedDate.getMonth() + 1, 
      0 // Last day of month
    );

    console.log(`[CommonFillDateUtils] *** MONTH BOUNDARIES (LOCAL TIME) ***`);
    console.log(`[CommonFillDateUtils] Start of month (local): ${this.formatDateOnlyForDisplay(startOfMonth)}`);
    console.log(`[CommonFillDateUtils] End of month (local): ${this.formatDateOnlyForDisplay(endOfMonth)}`);

    // Use local dates for generation period determination
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

    // Calculate number of days using local time
    const totalDays = Math.floor((lastDay.getTime() - firstDay.getTime()) / FILL_CONSTANTS.TIMEZONE.MILLISECONDS_PER_DAY) + 1;

    console.log(`[CommonFillDateUtils] *** FINAL PERIOD (LOCAL TIME) ***`);
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
}