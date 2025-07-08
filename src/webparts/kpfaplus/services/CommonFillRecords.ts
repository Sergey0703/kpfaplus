// src/webparts/kpfaplus/services/CommonFillRecords.ts
// RECORD GENERATION AND SAVING: All record creation and persistence logic
// UPDATED: StaffRecords.Date is now Date-only field, not DateTime

import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { IContract } from '../models/IContract';
import { 
  IFillParams,
  IScheduleTemplate,
  IGenerationResult,
  ISaveResult,
  IDayGenerationInfo,
  ILeavePeriod,
  FILL_CONSTANTS,
  DEFAULT_VALUES
} from './CommonFillTypes';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { CommonFillAnalysis } from './CommonFillAnalysis';
import { CommonFillTemplates } from './CommonFillTemplates';

export class CommonFillRecords {
  private staffRecordsService: StaffRecordsService;
  private holidaysService: HolidaysService;
  private daysOfLeavesService: DaysOfLeavesService;
  private dateUtils: CommonFillDateUtils;
  private analysis: CommonFillAnalysis;
  private templates: CommonFillTemplates;

  constructor(
    staffRecordsService: StaffRecordsService,
    holidaysService: HolidaysService,
    daysOfLeavesService: DaysOfLeavesService,
    dateUtils: CommonFillDateUtils,
    analysis: CommonFillAnalysis,
    templates: CommonFillTemplates
  ) {
    this.staffRecordsService = staffRecordsService;
    this.holidaysService = holidaysService;
    this.daysOfLeavesService = daysOfLeavesService;
    this.dateUtils = dateUtils;
    this.analysis = analysis;
    this.templates = templates;
    console.log('[CommonFillRecords] Record generator initialized - StaffRecords.Date is now Date-only field');
  }

  // *** PUBLIC API METHODS ***

  /**
   * Loads holidays for month with Date-only format support
   * CORRECT: HolidaysService already uses Date-only methods internally
   */
  public async loadHolidays(date: Date): Promise<IHoliday[]> {
    try {
      console.log(`[CommonFillRecords] Loading holidays for ${date.getMonth() + 1}/${date.getFullYear()} with Date-only format support`);
      
      // CORRECT: Create date with local components, HolidaysService will handle properly
      const normalizedDate = this.dateUtils.createDateOnlyFromDate(date);
      console.log(`[CommonFillRecords] Normalized date for holidays query: ${normalizedDate.toLocaleDateString()}`);
      
      const holidays = await this.holidaysService.getHolidaysByMonthAndYear(normalizedDate);
      console.log(`[CommonFillRecords] Loaded ${holidays.length} holidays with Date-only format`);
      
      // Log first few holidays for Date-only format debugging
      if (holidays.length > 0) {
        holidays.slice(0, 3).forEach((holiday, index) => {
          const holidayDateStr = this.dateUtils.formatDateOnlyForDisplay(holiday.date);
          console.log(`[CommonFillRecords] Holiday ${index + 1}: ${holidayDateStr} - ${holiday.title}`);
        });
      }
      
      return holidays;
    } catch (error) {
      console.error('[CommonFillRecords] Error loading holidays with Date-only format:', error);
      return [];
    }
  }

  /**
   * Loads staff leaves with Date-only format support
   * CORRECT: DaysOfLeavesService already uses Date-only methods internally
   */
  public async loadLeaves(params: IFillParams): Promise<ILeaveDay[]> {
    try {
      if (!params.staffMember.employeeId) {
        console.log('[CommonFillRecords] No employee ID - skipping leaves loading');
        return [];
      }

      console.log(`[CommonFillRecords] Loading leaves for employee ${params.staffMember.employeeId} with Date-only format support`);
      
      // CORRECT: Create date with local components, DaysOfLeavesService will handle properly
      const normalizedDate = this.dateUtils.createDateOnlyFromDate(params.selectedDate);
      console.log(`[CommonFillRecords] Normalized date for leaves query: ${normalizedDate.toLocaleDateString()}`);
      
      const leaves = await this.daysOfLeavesService.getLeavesForMonthAndYear(
        normalizedDate,
        parseInt(params.staffMember.employeeId, 10),
        parseInt(params.currentUserId || '0', 10),
        parseInt(params.managingGroupId || '0', 10)
      );

      // Filter deleted leaves
      const activeLeaves = leaves.filter((leave: ILeaveDay) => !leave.deleted);
      console.log(`[CommonFillRecords] Loaded ${leaves.length} total leaves, ${activeLeaves.length} active with Date-only format`);

      // Log first few leaves for Date-only format debugging
      if (activeLeaves.length > 0) {
        activeLeaves.slice(0, 3).forEach((leave, index) => {
          const startDateStr = this.dateUtils.formatDateOnlyForDisplay(leave.startDate);
          const endDateStr = leave.endDate ? this.dateUtils.formatDateOnlyForDisplay(leave.endDate) : 'ongoing';
          console.log(`[CommonFillRecords] Leave ${index + 1}: ${startDateStr} - ${endDateStr}, type: ${leave.typeOfLeave}, title: "${leave.title}"`);
        });
      }

      return activeLeaves;
    } catch (error) {
      console.error('[CommonFillRecords] Error loading leaves with Date-only format:', error);
      return [];
    }
  }

  /**
   * *** UPDATED: Generates schedule records with StaffRecords.Date as Date-only field ***
   * Uses dateUtils methods for Date-only operations
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: IScheduleTemplate[]
  ): Promise<IGenerationResult> {
    console.log(`[CommonFillRecords] *** GENERATING WITH STAFFRECORDS DATE-ONLY FIELD ***`);
    console.log(`[CommonFillRecords] Generating schedule records for ${params.staffMember.name} - StaffRecords.Date is now Date-only`);

    // Convert contract dates to strings for compatibility
    const contractStartDate = contract.startDate ? 
      (typeof contract.startDate === 'string' ? contract.startDate : contract.startDate.toISOString()) : undefined;
    const contractFinishDate = contract.finishDate ? 
      (typeof contract.finishDate === 'string' ? contract.finishDate : contract.finishDate.toISOString()) : undefined;

    // Use dateUtils method instead of own method
    const periodInfo = this.dateUtils.calculateMonthPeriod(
      params.selectedDate,
      contractStartDate,
      contractFinishDate
    );

    // Initialize generation analysis
    const generationAnalysis = this.analysis.initializeGenerationAnalysis(periodInfo.firstDay, periodInfo.lastDay);

    // Use dateUtils methods for caching
    const holidayCache = this.dateUtils.createHolidayCacheWithDateOnly(holidays);
    const leavePeriods = this.dateUtils.createLeavePeriodsWithDateOnly(leaves);

    // Get grouped templates and analyze chaining logic
    const groupedTemplates = (weeklyTemplates as IScheduleTemplate[] & { _groupedTemplates?: Map<string, IScheduleTemplate[]> })._groupedTemplates;
    if (!groupedTemplates) {
      console.error('[CommonFillRecords] No grouped templates found');
      return {
        records: [],
        totalGenerated: 0,
        analysis: generationAnalysis
      };
    }

    // Analyze week chaining logic
    const templatesAnalysis = this.analysis.getTemplatesAnalysis();
    const numberOfWeekTemplates = templatesAnalysis?.numberOfWeekTemplates || 1;
    console.log(`[CommonFillRecords] Week chaining analysis: ${numberOfWeekTemplates} week templates found`);
    console.log(`[CommonFillRecords] Chaining logic: ${this.dateUtils.getWeekChainingDescription(numberOfWeekTemplates)}`);

    const records: Partial<IStaffRecord>[] = [];

    console.log(`[CommonFillRecords] Will process ${periodInfo.totalDays} days from ${periodInfo.firstDay.toISOString()} to ${periodInfo.lastDay.toISOString()}`);

    // *** MAIN GENERATION LOOP WITH DATE-ONLY StaffRecords ***
    for (let dayIndex = 0; dayIndex < periodInfo.totalDays; dayIndex++) {
      // Create date for each iteration - will be converted to Date-only for StaffRecords
      const currentDate = new Date(Date.UTC(
        periodInfo.firstDay.getFullYear(),
        periodInfo.firstDay.getMonth(),
        periodInfo.firstDay.getDate() + dayIndex,
        0, 0, 0, 0
      ));

      // Use default value for dayOfStartWeek
      const dayOfStartWeek = params.dayOfStartWeek || DEFAULT_VALUES.FILL_PARAMS.dayOfStartWeek;

      // Calculate week number with corrected algorithm
      const weekAndDay = this.dateUtils.calculateWeekAndDayWithChaining(
        currentDate, 
        periodInfo.startOfMonth, 
        dayOfStartWeek, 
        numberOfWeekTemplates
      );
      
      // Find all templates (all shifts) for this day
      const templatesForDay = this.templates.findTemplatesForDay(groupedTemplates, weekAndDay.templateWeekNumber, weekAndDay.dayNumber);
      
      // Create day information for analysis
      const dayInfo: IDayGenerationInfo = {
        date: currentDate.toLocaleDateString(),
        weekNumber: weekAndDay.calendarWeekNumber,
        dayNumber: weekAndDay.dayNumber,
        dayName: this.dateUtils.getDayName(weekAndDay.dayNumber),
        templateFound: templatesForDay.length > 0,
        isHoliday: this.dateUtils.isHolidayWithDateOnly(currentDate, holidayCache),
        isLeave: this.dateUtils.isLeaveWithDateOnly(currentDate, leavePeriods)
      };

      if (dayInfo.isLeave) {
        const leave = this.dateUtils.getLeaveForDayWithDateOnly(currentDate, leavePeriods);
        dayInfo.leaveType = leave?.typeOfLeave || 'Unknown';
      }

      if (templatesForDay.length > 0) {
        // Create records for all shifts like in ScheduleTab with numeric fields
        console.log(`[CommonFillRecords] ${dayInfo.date} (${dayInfo.dayName}): Calendar week ${dayInfo.weekNumber}, Template week ${weekAndDay.templateWeekNumber}, Found ${templatesForDay.length} shifts`);
        
        // Process each template asynchronously with numeric fields
        for (const template of templatesForDay) {
          console.log(`[CommonFillRecords] Creating record for shift ${template.NumberOfShift}: ${template.startTime}-${template.endTime}, Lunch: ${template.lunchMinutes}min`);
          
          // *** UPDATED: Use createStaffRecordFromTemplateWithDateOnly with Date-only StaffRecords.Date ***
          const record = await this.createStaffRecordFromTemplateWithDateOnly(
            currentDate, 
            template, 
            contract, 
            params,
            holidayCache, 
            leavePeriods
          );
          
          records.push(record);
        }
        
        // For analysis use first template
        const firstTemplate = templatesForDay[0];
        dayInfo.templateUsed = firstTemplate;
        dayInfo.workingHours = `${firstTemplate.startTime}-${firstTemplate.endTime}`;
        dayInfo.lunchMinutes = firstTemplate.lunchMinutes;
        
        this.analysis.updateGenerationStats(weekAndDay.calendarWeekNumber, true);
      } else {
        dayInfo.skipReason = `No template found for week ${weekAndDay.templateWeekNumber}, day ${weekAndDay.dayNumber} combination`;
        console.log(`[CommonFillRecords] ${dayInfo.date} (${dayInfo.dayName}): Calendar week ${dayInfo.weekNumber}, Template week ${weekAndDay.templateWeekNumber}, Day ${dayInfo.dayNumber} - ${dayInfo.skipReason}`);
        this.analysis.updateGenerationStats(weekAndDay.calendarWeekNumber, false);
      }

      // Add day information to analysis
      this.analysis.addDayInfo(dayInfo);
    }

    // Complete generation analysis
    const finalAnalysis = this.analysis.finalizeGenerationAnalysis(records.length, holidays.length, leaves.length);

    console.log(`[CommonFillRecords] *** STAFFRECORDS DATE-ONLY GENERATION COMPLETED ***`);
    console.log(`[CommonFillRecords] Generated ${records.length} schedule records with StaffRecords.Date as Date-only field`);
    
    return {
      records,
      totalGenerated: records.length,
      analysis: finalAnalysis
    };
  }

  /**
   * *** UPDATED: Saves generated records to SharePoint with StaffRecords.Date as Date-only field ***
   */
  public async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<ISaveResult> {
    console.log(`[CommonFillRecords] *** SAVING STAFFRECORDS WITH DATE-ONLY FIELD ***`);
    console.log(`[CommonFillRecords] Saving ${records.length} generated records to StaffRecords (Date-only field)`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillRecords] Saving record ${i + 1}/${records.length} for ${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}`);
        
        const employeeId = params.staffMember.employeeId;
        const managerId = params.currentUserId;
        const staffGroupId = params.managingGroupId;
        
        if (!employeeId || employeeId === '0' || employeeId.trim() === '') {
          const errorMsg = `Missing or invalid employeeId for record ${i + 1}: "${employeeId}"`;
          errors.push(errorMsg);
          console.error(`[CommonFillRecords] ✗ ${errorMsg}`);
          continue;
        }
        
        // Log numeric time fields before saving
        if (record.ShiftDate1Hours !== undefined && record.ShiftDate1Minutes !== undefined && 
            record.ShiftDate2Hours !== undefined && record.ShiftDate2Minutes !== undefined) {
          console.log(`[CommonFillRecords] *** NUMERIC TIME FIELDS TO STAFFRECORDS ***`);
          console.log(`[CommonFillRecords] Date (Date-only field): ${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}`);
          console.log(`[CommonFillRecords] Start Time: ${record.ShiftDate1Hours}:${record.ShiftDate1Minutes?.toString().padStart(2, '0')}`);
          console.log(`[CommonFillRecords] End Time: ${record.ShiftDate2Hours}:${record.ShiftDate2Minutes?.toString().padStart(2, '0')}`);
          console.log(`[CommonFillRecords] Time for Lunch: ${record.TimeForLunch} minutes`);
        }
        
        // *** UPDATED: StaffRecordsService.createStaffRecord now expects Date-only Date objects ***
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,
          managerId || '0',
          staffGroupId || '0',
          employeeId
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillRecords] ✓ Created StaffRecord ID=${newRecordId} for ${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}`);
          
          if (record.TypeOfLeaveID) {
            console.log(`[CommonFillRecords] ✓ Record ${newRecordId} created with leave type: ${record.TypeOfLeaveID}`);
          }
          if (record.Holiday === FILL_CONSTANTS.FLAGS.HOLIDAY) {
            console.log(`[CommonFillRecords] ✓ Record ${newRecordId} created for holiday (Date-only field)`);
          }
          
          if (record.ShiftDate1Hours !== undefined && record.ShiftDate2Hours !== undefined) {
            console.log(`[CommonFillRecords] ✓ Record ${newRecordId} saved to StaffRecords with NUMERIC TIME FIELDS and Date-only Date`);
            console.log(`[CommonFillRecords] ✓ Saved times: ${record.ShiftDate1Hours}:${record.ShiftDate1Minutes?.toString().padStart(2, '0')} - ${record.ShiftDate2Hours}:${record.ShiftDate2Minutes?.toString().padStart(2, '0')}`);
          }
        } else {
          const errorMsg = `Failed to create StaffRecord for ${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}: No ID returned`;
          errors.push(errorMsg);
          console.error(`[CommonFillRecords] ✗ ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = `Error creating StaffRecord ${i + 1} for ${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}: ${error}`;
        errors.push(errorMsg);
        console.error(`[CommonFillRecords] ✗ ${errorMsg}`);
      }

      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[CommonFillRecords] *** STAFFRECORDS DATE-ONLY SAVE COMPLETED ***`);
    console.log(`[CommonFillRecords] Save operation to StaffRecords completed: ${successCount}/${records.length} successful`);
    
    if (errors.length > 0) {
      console.error(`[CommonFillRecords] Save errors (${errors.length}):`, errors);
    }

    return {
      successCount,
      totalRecords: records.length,
      errors
    };
  }

  // *** PRIVATE METHODS ***

  /**
   * *** UPDATED: Creates staff record from template with StaffRecords.Date as Date-only field ***
   * Uses dateUtils methods for Date-only operations
   */
  private async createStaffRecordFromTemplateWithDateOnly(
    date: Date,
    template: IScheduleTemplate,
    contract: IContract,
    params: IFillParams,
    holidayCache: Map<string, IHoliday>,
    leavePeriods: ILeavePeriod[]
  ): Promise<Partial<IStaffRecord>> {
    // Use dateUtils method instead of own method
    const dateKey = this.dateUtils.formatDateOnlyForComparison(date);
    
    // Check if day is holiday with dateUtils
    const isHoliday = holidayCache.has(dateKey);
    
    // Check if staff is on leave with dateUtils
    const leaveForDay = leavePeriods.find(leave => {
      const checkDate = this.dateUtils.createDateOnlyFromDate(date);
      const leaveStart = this.dateUtils.createDateOnlyFromDate(leave.startDate);
      const leaveEnd = this.dateUtils.createDateOnlyFromDate(leave.endDate);
      
      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
    const isLeave = !!leaveForDay;

    // Parse time from template and get numeric fields with timezone adjustment
    const startTime = this.dateUtils.parseTimeString(template.startTime);
    const endTime = this.dateUtils.parseTimeString(template.endTime);
    const lunchTime = template.lunchMinutes;

    console.log(`[CommonFillRecords] *** USING DATEUTILS FOR STAFFRECORDS DATE-ONLY FIELD ***`);
    console.log(`[CommonFillRecords] Creating record for ${this.dateUtils.formatDateOnlyForDisplay(date)}: Shift ${template.NumberOfShift}, ${template.startTime}-${template.endTime}, lunch: ${lunchTime}min, holiday: ${isHoliday}, leave: ${isLeave}`);

    // Use dateUtils for getting adjusted time
    const adjustedStartTime = await this.dateUtils.getAdjustedNumericTime(startTime);
    const adjustedEndTime = await this.dateUtils.getAdjustedNumericTime(endTime);

    console.log(`[CommonFillRecords] *** DATEUTILS NUMERIC TIME ADJUSTMENT ***`);
    console.log(`[CommonFillRecords] Start time: ${template.startTime} → ${adjustedStartTime.hours}:${adjustedStartTime.minutes}`);
    console.log(`[CommonFillRecords] End time: ${template.endTime} → ${adjustedEndTime.hours}:${adjustedEndTime.minutes}`);

    // *** UPDATED: Create Date-only Date object for StaffRecords.Date field ***
    const dateOnlyForStaffRecords = this.dateUtils.createDateOnlyFromDate(date);

    const record: Partial<IStaffRecord> = {
      Title: `Template=${contract.id} Week=${template.NumberOfWeek} Shift=${template.NumberOfShift}`,
      Date: dateOnlyForStaffRecords, // *** UPDATED: Date-only Date object for StaffRecords.Date field ***
      
      // *** CORRECT: ONLY NUMERIC TIME FIELDS WITH DATEUTILS ADJUSTMENT ***
      ShiftDate1Hours: adjustedStartTime.hours,
      ShiftDate1Minutes: adjustedStartTime.minutes,
      ShiftDate2Hours: adjustedEndTime.hours,
      ShiftDate2Minutes: adjustedEndTime.minutes,
      
      TimeForLunch: lunchTime,
      Contract: template.NumberOfShift,  // Use shift number instead of total
      Holiday: isHoliday ? FILL_CONSTANTS.FLAGS.HOLIDAY : FILL_CONSTANTS.FLAGS.NO_HOLIDAY,
      WeeklyTimeTableID: contract.id,
      WeeklyTimeTableTitle: contract.template || '',
      Checked: FILL_CONSTANTS.FLAGS.NOT_DELETED,
      Deleted: FILL_CONSTANTS.FLAGS.NOT_DELETED
    };

    // Add leave type if staff is on leave
    if (isLeave && leaveForDay) {
      record.TypeOfLeaveID = leaveForDay.typeOfLeave;
      console.log(`[CommonFillRecords] Added leave type ${record.TypeOfLeaveID} for ${this.dateUtils.formatDateOnlyForDisplay(date)}: ${leaveForDay.title}`);
    }

    console.log(`[CommonFillRecords] *** FINAL RECORD WITH STAFFRECORDS DATE-ONLY FIELD ***`);
    console.log(`[CommonFillRecords] Record: ${JSON.stringify({
      Title: record.Title,
      Date: record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A',
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes,
      TimeForLunch: record.TimeForLunch,
      Holiday: record.Holiday,
      TypeOfLeaveID: record.TypeOfLeaveID
    }, null, 2)}`);

    return record;
  }

  // *** UTILITY METHODS ***

  /**
   * Validates fill parameters
   */
  public validateFillParams(params: IFillParams): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!params.selectedDate) errors.push('Selected date is missing');
    if (!params.staffMember) errors.push('Staff member is missing');
    if (!params.staffMember?.id) errors.push('Staff member ID is missing');
    if (!params.staffMember?.employeeId) errors.push('Employee ID is missing');
    if (!params.context) errors.push('Context is missing');

    // Check values
    if (params.currentUserId === '0' || !params.currentUserId) {
      warnings.push('Current user ID is not set or is 0');
    }
    if (params.managingGroupId === '0' || !params.managingGroupId) {
      warnings.push('Managing group ID is not set or is 0');
    }
    if (params.dayOfStartWeek !== undefined && (params.dayOfStartWeek < 1 || params.dayOfStartWeek > 7)) {
      errors.push(`Invalid day of start week: ${params.dayOfStartWeek} (must be 1-7)`);
    }

    // Check date
    if (params.selectedDate && isNaN(params.selectedDate.getTime())) {
      errors.push('Selected date is invalid');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * *** UPDATED: Gets records statistics with dateUtils for date formatting ***
   */
  public getRecordsStatistics(records: Partial<IStaffRecord>[]): {
    totalRecords: number;
    holidayRecords: number;
    leaveRecords: number;
    workingRecords: number;
    shifts: number[];
    dateRange: {
      start: string;
      end: string;
    };
    timeRanges: Set<string>;
  } {
    const shifts = new Set<number>();
    const timeRanges = new Set<string>();
    let holidayRecords = 0;
    let leaveRecords = 0;
    let earliestDate: Date | undefined;
    let latestDate: Date | undefined;

    records.forEach(record => {
      if (record.Contract) shifts.add(record.Contract);
      if (record.Holiday === FILL_CONSTANTS.FLAGS.HOLIDAY) holidayRecords++;
      if (record.TypeOfLeaveID) leaveRecords++;
      
      if (record.ShiftDate1Hours !== undefined && record.ShiftDate2Hours !== undefined) {
        const startTime = `${record.ShiftDate1Hours}:${record.ShiftDate1Minutes?.toString().padStart(2, '0')}`;
        const endTime = `${record.ShiftDate2Hours}:${record.ShiftDate2Minutes?.toString().padStart(2, '0')}`;
        timeRanges.add(`${startTime}-${endTime}`);
      }

      if (record.Date) {
        if (!earliestDate || record.Date < earliestDate) {
          earliestDate = record.Date;
        }
        if (!latestDate || record.Date > latestDate) {
          latestDate = record.Date;
        }
      }
    });

    const workingRecords = records.length - holidayRecords - leaveRecords;

    return {
      totalRecords: records.length,
      holidayRecords,
      leaveRecords,
      workingRecords,
      shifts: Array.from(shifts).sort(),
      dateRange: {
        // *** UPDATED: Use dateUtils for date formatting ***
        start: earliestDate ? this.dateUtils.formatDateOnlyForDisplay(earliestDate) : 'N/A',
        end: latestDate ? this.dateUtils.formatDateOnlyForDisplay(latestDate) : 'N/A'
      },
      timeRanges
    };
  }

  /**
   * Creates brief report on records
   */
  public generateRecordsReport(records: Partial<IStaffRecord>[]): string {
    const stats = this.getRecordsStatistics(records);
    const lines: string[] = [];

    lines.push('=== GENERATED RECORDS REPORT ===');
    lines.push('');
    lines.push(`Total records: ${stats.totalRecords}`);
    lines.push(`Working days: ${stats.workingRecords}`);
    lines.push(`Holidays: ${stats.holidayRecords}`);
    lines.push(`Leave days: ${stats.leaveRecords}`);
    lines.push(`Period: ${stats.dateRange.start} - ${stats.dateRange.end}`);
    lines.push(`Shifts: [${stats.shifts.join(', ')}]`);
    lines.push('');
    lines.push('Time ranges:');
    Array.from(stats.timeRanges).forEach(range => {
      lines.push(`  - ${range}`);
    });
    lines.push('');
    lines.push('=== END OF REPORT ===');

    return lines.join('\n');
  }

  /**
   * Validates generated records
   */
  public validateGeneratedRecords(records: Partial<IStaffRecord>[]): {
    isValid: boolean;
    issues: string[];
    validRecords: number;
    invalidRecords: number;
  } {
    const issues: string[] = [];
    let validRecords = 0;
    let invalidRecords = 0;

    records.forEach((record, index) => {
      const recordIssues: string[] = [];

      // Check required fields
      if (!record.Date) recordIssues.push('Missing date');
      if (!record.Title) recordIssues.push('Missing title');
      if (record.ShiftDate1Hours === undefined) recordIssues.push('Missing start hours');
      if (record.ShiftDate1Minutes === undefined) recordIssues.push('Missing start minutes');
      if (record.ShiftDate2Hours === undefined) recordIssues.push('Missing end hours');
      if (record.ShiftDate2Minutes === undefined) recordIssues.push('Missing end minutes');

      // Check value ranges
      if (record.ShiftDate1Hours !== undefined && (record.ShiftDate1Hours < 0 || record.ShiftDate1Hours > 23)) {
        recordIssues.push(`Invalid start hours: ${record.ShiftDate1Hours}`);
      }
      if (record.ShiftDate1Minutes !== undefined && (record.ShiftDate1Minutes < 0 || record.ShiftDate1Minutes > 59)) {
        recordIssues.push(`Invalid start minutes: ${record.ShiftDate1Minutes}`);
      }
      if (record.ShiftDate2Hours !== undefined && (record.ShiftDate2Hours < 0 || record.ShiftDate2Hours > 23)) {
        recordIssues.push(`Invalid end hours: ${record.ShiftDate2Hours}`);
      }
      if (record.ShiftDate2Minutes !== undefined && (record.ShiftDate2Minutes < 0 || record.ShiftDate2Minutes > 59)) {
        recordIssues.push(`Invalid end minutes: ${record.ShiftDate2Minutes}`);
      }

      // Check logical constraints
      if (record.TimeForLunch !== undefined && (record.TimeForLunch < 0 || record.TimeForLunch > 120)) {
        recordIssues.push(`Unusual lunch time: ${record.TimeForLunch} minutes`);
      }
      if (record.Holiday !== undefined && record.Holiday !== 0 && record.Holiday !== 1) {
        recordIssues.push(`Invalid holiday flag: ${record.Holiday}`);
      }

      if (recordIssues.length === 0) {
        validRecords++;
      } else {
        invalidRecords++;
        issues.push(`Record ${index + 1}: ${recordIssues.join(', ')}`);
      }
    });

    return {
      isValid: invalidRecords === 0,
      issues,
      validRecords,
      invalidRecords
    };
  }

  /**
   * Optimizes records for saving (grouping, sorting)
   */
  public optimizeRecordsForSaving(records: Partial<IStaffRecord>[]): Partial<IStaffRecord>[] {
    // Sort records by date and shift for optimal saving
    return [...records].sort((a, b) => {
      // First by date
      if (a.Date && b.Date) {
        const dateCompare = a.Date.getTime() - b.Date.getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      
      // Then by shift number
      if (a.Contract && b.Contract) {
        return a.Contract - b.Contract;
      }
      
      return 0;
    });
  }

  /**
   * Creates backup of records in JSON format
   */
  public createRecordsBackup(records: Partial<IStaffRecord>[], params: IFillParams): string {
    const backup = {
      timestamp: new Date().toISOString(),
      staffMember: {
        id: params.staffMember.id,
        name: params.staffMember.name,
        employeeId: params.staffMember.employeeId
      },
      // *** UPDATED: Use dateUtils for period formatting ***
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate),
      totalRecords: records.length,
      records: records.map(record => ({
        ...record,
        Date: record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : null
      })),
      statistics: this.getRecordsStatistics(records)
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Restores records from backup
   */
  public restoreRecordsFromBackup(backupJson: string): {
    success: boolean;
    records?: Partial<IStaffRecord>[];
    metadata?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    error?: string;
  } {
    try {
      const backup = JSON.parse(backupJson);
      
      if (!backup.records || !Array.isArray(backup.records)) {
        return {
          success: false,
          error: 'Invalid backup format: missing or invalid records array'
        };
      }

      const records = backup.records.map((record: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        ...record,
        Date: record.Date ? new Date(record.Date) : undefined
      }));

      return {
        success: true,
        records,
        metadata: {
          timestamp: backup.timestamp,
          staffMember: backup.staffMember,
          period: backup.period,
          totalRecords: backup.totalRecords,
          statistics: backup.statistics
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse backup: ${error}`
      };
    }
  }

  /**
   * Gets diagnostic information about generation process
   */
  public getDiagnostics(): {
    servicesStatus: {
      staffRecords: boolean;
      holidays: boolean;
      leaves: boolean;
      dateUtils: boolean;
    };
    memoryUsage: string;
    lastOperation: string;
    performanceMetrics: {
      averageRecordCreationTime: number;
      totalOperationTime: number;
    };
  } {
    return {
      servicesStatus: {
        staffRecords: !!this.staffRecordsService,
        holidays: !!this.holidaysService,
        leaves: !!this.daysOfLeavesService,
        dateUtils: !!this.dateUtils // Status of dateUtils
      },
      memoryUsage: 'Not available in browser environment',
      lastOperation: 'Records generation and saving with StaffRecords Date-only field support',
      performanceMetrics: {
        averageRecordCreationTime: 0, // Would need timing implementation
        totalOperationTime: 0 // Would need timing implementation
      }
    };
  }
}