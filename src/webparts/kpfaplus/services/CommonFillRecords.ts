// src/webparts/kpfaplus/services/CommonFillRecords.ts
// RECORD GENERATION AND SAVING: All record creation and persistence logic
// ИСПРАВЛЕНО: Удалено дублирование методов, используются dateUtils для Date-only операций

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
    console.log('[CommonFillRecords] Record generator initialized with dateUtils integration for Date-only operations');
  }

  // *** PUBLIC API METHODS ***

  /**
   * Загружает праздники для месяца с поддержкой Date-only формата
   * ПРАВИЛЬНО: HolidaysService уже использует Date-only методы внутри
   */
  public async loadHolidays(date: Date): Promise<IHoliday[]> {
    try {
      console.log(`[CommonFillRecords] Loading holidays for ${date.getMonth() + 1}/${date.getFullYear()} with Date-only format support`);
      
      // ПРАВИЛЬНО: Создаем дату с локальными компонентами, HolidaysService обработает правильно
      const normalizedDate = this.dateUtils.createDateOnlyFromDate(date);
      console.log(`[CommonFillRecords] Normalized date for holidays query: ${normalizedDate.toLocaleDateString()}`);
      
      const holidays = await this.holidaysService.getHolidaysByMonthAndYear(normalizedDate);
      console.log(`[CommonFillRecords] Loaded ${holidays.length} holidays with Date-only format`);
      
      // Логируем первые несколько праздников для отладки Date-only формата
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
   * Загружает отпуска сотрудника с поддержкой Date-only формата
   * ПРАВИЛЬНО: DaysOfLeavesService уже использует Date-only методы внутри
   */
  public async loadLeaves(params: IFillParams): Promise<ILeaveDay[]> {
    try {
      if (!params.staffMember.employeeId) {
        console.log('[CommonFillRecords] No employee ID - skipping leaves loading');
        return [];
      }

      console.log(`[CommonFillRecords] Loading leaves for employee ${params.staffMember.employeeId} with Date-only format support`);
      
      // ПРАВИЛЬНО: Создаем дату с локальными компонентами, DaysOfLeavesService обработает правильно
      const normalizedDate = this.dateUtils.createDateOnlyFromDate(params.selectedDate);
      console.log(`[CommonFillRecords] Normalized date for leaves query: ${normalizedDate.toLocaleDateString()}`);
      
      const leaves = await this.daysOfLeavesService.getLeavesForMonthAndYear(
        normalizedDate,
        parseInt(params.staffMember.employeeId, 10),
        parseInt(params.currentUserId || '0', 10),
        parseInt(params.managingGroupId || '0', 10)
      );

      // Фильтруем удаленные отпуска
      const activeLeaves = leaves.filter((leave: ILeaveDay) => !leave.deleted);
      console.log(`[CommonFillRecords] Loaded ${leaves.length} total leaves, ${activeLeaves.length} active with Date-only format`);

      // Логируем первые несколько отпусков для отладки Date-only формата
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
   * Генерирует записи расписания с правильной логикой чередования недель и числовыми полями времени
   * ИСПРАВЛЕНО: Использует dateUtils методы вместо собственных
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: IScheduleTemplate[]
  ): Promise<IGenerationResult> {
    console.log(`[CommonFillRecords] *** GENERATING WITH DATEUTILS INTEGRATION ***`);
    console.log(`[CommonFillRecords] Generating schedule records using dateUtils for ${params.staffMember.name}`);

    // ИСПРАВЛЕНО: Приводим даты контракта к строкам для совместимости
    const contractStartDate = contract.startDate ? 
      (typeof contract.startDate === 'string' ? contract.startDate : contract.startDate.toISOString()) : undefined;
    const contractFinishDate = contract.finishDate ? 
      (typeof contract.finishDate === 'string' ? contract.finishDate : contract.finishDate.toISOString()) : undefined;

    // ИСПРАВЛЕНО: Используем dateUtils метод вместо собственного
    const periodInfo = this.dateUtils.calculateMonthPeriod(
      params.selectedDate,
      contractStartDate,
      contractFinishDate
    );

    // Инициализируем анализ генерации
    const generationAnalysis = this.analysis.initializeGenerationAnalysis(periodInfo.firstDay, periodInfo.lastDay);

    // ИСПРАВЛЕНО: Используем dateUtils методы для кэширования
    const holidayCache = this.dateUtils.createHolidayCacheWithDateOnly(holidays);
    const leavePeriods = this.dateUtils.createLeavePeriodsWithDateOnly(leaves);

    // Получаем группированные шаблоны и анализируем логику чередования
    const groupedTemplates = (weeklyTemplates as IScheduleTemplate[] & { _groupedTemplates?: Map<string, IScheduleTemplate[]> })._groupedTemplates;
    if (!groupedTemplates) {
      console.error('[CommonFillRecords] No grouped templates found');
      return {
        records: [],
        totalGenerated: 0,
        analysis: generationAnalysis
      };
    }

    // Анализируем логику чередования недель
    const templatesAnalysis = this.analysis.getTemplatesAnalysis();
    const numberOfWeekTemplates = templatesAnalysis?.numberOfWeekTemplates || 1;
    console.log(`[CommonFillRecords] Week chaining analysis: ${numberOfWeekTemplates} week templates found`);
    console.log(`[CommonFillRecords] Chaining logic: ${this.dateUtils.getWeekChainingDescription(numberOfWeekTemplates)}`);

    const records: Partial<IStaffRecord>[] = [];

    console.log(`[CommonFillRecords] Will process ${periodInfo.totalDays} days from ${periodInfo.firstDay.toISOString()} to ${periodInfo.lastDay.toISOString()}`);

    // *** ОСНОВНОЙ ЦИКЛ ГЕНЕРАЦИИ ЗАПИСЕЙ С UTC ДАТАМИ ***
    for (let dayIndex = 0; dayIndex < periodInfo.totalDays; dayIndex++) {
      // Создаем UTC дату для каждой итерации
      const currentDate = new Date(Date.UTC(
        periodInfo.firstDay.getUTCFullYear(),
        periodInfo.firstDay.getUTCMonth(),
        periodInfo.firstDay.getUTCDate() + dayIndex,
        0, 0, 0, 0
      ));

      // ИСПРАВЛЕНО: Используем значение по умолчанию для dayOfStartWeek
      const dayOfStartWeek = params.dayOfStartWeek || DEFAULT_VALUES.FILL_PARAMS.dayOfStartWeek;

      // Вычисляем номер недели с исправленным алгоритмом
      const weekAndDay = this.dateUtils.calculateWeekAndDayWithChaining(
        currentDate, 
        periodInfo.startOfMonth, 
        dayOfStartWeek, 
        numberOfWeekTemplates
      );
      
      // Ищем все шаблоны (все смены) для этого дня
      const templatesForDay = this.templates.findTemplatesForDay(groupedTemplates, weekAndDay.templateWeekNumber, weekAndDay.dayNumber);
      
      // Создаем информацию о дне для анализа
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
        // Создаем записи для всех смен как в ScheduleTab с числовыми полями
        console.log(`[CommonFillRecords] ${dayInfo.date} (${dayInfo.dayName}): Calendar week ${dayInfo.weekNumber}, Template week ${weekAndDay.templateWeekNumber}, Found ${templatesForDay.length} shifts`);
        
        // Обрабатываем каждый шаблон асинхронно с числовыми полями
        for (const template of templatesForDay) {
          console.log(`[CommonFillRecords] Creating record for shift ${template.NumberOfShift}: ${template.startTime}-${template.endTime}, Lunch: ${template.lunchMinutes}min`);
          
          // ИСПРАВЛЕНО: ИСПОЛЬЗУЕМ createStaffRecordFromTemplateNumeric С ЧИСЛОВЫМИ ПОЛЯМИ
          const record = await this.createStaffRecordFromTemplateNumeric(
            currentDate, 
            template, 
            contract, 
            params,
            holidayCache, 
            leavePeriods
          );
          
          records.push(record);
        }
        
        // Для анализа используем первый шаблон
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

      // Добавляем информацию о дне в анализ
      this.analysis.addDayInfo(dayInfo);
    }

    // Завершаем анализ генерации
    const finalAnalysis = this.analysis.finalizeGenerationAnalysis(records.length, holidays.length, leaves.length);

    console.log(`[CommonFillRecords] *** DATEUTILS INTEGRATION COMPLETED ***`);
    console.log(`[CommonFillRecords] Generated ${records.length} schedule records using dateUtils methods`);
    
    return {
      records,
      totalGenerated: records.length,
      analysis: finalAnalysis
    };
  }

  /**
   * Сохраняет сгенерированные записи в SharePoint с числовыми полями
   * ПРАВИЛЬНО: StaffRecords.Date - это DateTime поле, используем Date объекты
   */
  public async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<ISaveResult> {
    console.log(`[CommonFillRecords] *** SAVING STAFFRECORDS WITH DATETIME FIELD ***`);
    console.log(`[CommonFillRecords] Saving ${records.length} generated records to StaffRecords (DateTime field)`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillRecords] Saving record ${i + 1}/${records.length} for ${record.Date?.toISOString()}`);
        
        const employeeId = params.staffMember.employeeId;
        const managerId = params.currentUserId;
        const staffGroupId = params.managingGroupId;
        
        if (!employeeId || employeeId === '0' || employeeId.trim() === '') {
          const errorMsg = `Missing or invalid employeeId for record ${i + 1}: "${employeeId}"`;
          errors.push(errorMsg);
          console.error(`[CommonFillRecords] ✗ ${errorMsg}`);
          continue;
        }
        
        // Логируем числовые поля времени перед сохранением
        if (record.ShiftDate1Hours !== undefined && record.ShiftDate1Minutes !== undefined && 
            record.ShiftDate2Hours !== undefined && record.ShiftDate2Minutes !== undefined) {
          console.log(`[CommonFillRecords] *** NUMERIC TIME FIELDS TO STAFFRECORDS ***`);
          console.log(`[CommonFillRecords] Date (DateTime field): ${record.Date?.toISOString()}`);
          console.log(`[CommonFillRecords] Start Time: ${record.ShiftDate1Hours}:${record.ShiftDate1Minutes?.toString().padStart(2, '0')}`);
          console.log(`[CommonFillRecords] End Time: ${record.ShiftDate2Hours}:${record.ShiftDate2Minutes?.toString().padStart(2, '0')}`);
          console.log(`[CommonFillRecords] Time for Lunch: ${record.TimeForLunch} minutes`);
        }
        
        // ПРАВИЛЬНО: StaffRecordsService.createStaffRecord принимает Date объекты для DateTime поля
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,
          managerId || '0',
          staffGroupId || '0',
          employeeId
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillRecords] ✓ Created StaffRecord ID=${newRecordId} for ${record.Date?.toISOString()}`);
          
          if (record.TypeOfLeaveID) {
            console.log(`[CommonFillRecords] ✓ Record ${newRecordId} created with leave type: ${record.TypeOfLeaveID}`);
          }
          if (record.Holiday === FILL_CONSTANTS.FLAGS.HOLIDAY) {
            console.log(`[CommonFillRecords] ✓ Record ${newRecordId} created for holiday (DateTime field)`);
          }
          
          if (record.ShiftDate1Hours !== undefined && record.ShiftDate2Hours !== undefined) {
            console.log(`[CommonFillRecords] ✓ Record ${newRecordId} saved to StaffRecords with NUMERIC TIME FIELDS`);
            console.log(`[CommonFillRecords] ✓ Saved times: ${record.ShiftDate1Hours}:${record.ShiftDate1Minutes?.toString().padStart(2, '0')} - ${record.ShiftDate2Hours}:${record.ShiftDate2Minutes?.toString().padStart(2, '0')}`);
          }
        } else {
          const errorMsg = `Failed to create StaffRecord for ${record.Date?.toISOString()}: No ID returned`;
          errors.push(errorMsg);
          console.error(`[CommonFillRecords] ✗ ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = `Error creating StaffRecord ${i + 1} for ${record.Date?.toISOString()}: ${error}`;
        errors.push(errorMsg);
        console.error(`[CommonFillRecords] ✗ ${errorMsg}`);
      }

      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[CommonFillRecords] *** STAFFRECORDS DATETIME SAVE COMPLETED ***`);
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
   * Создает запись расписания из шаблона с ЧИСЛОВЫМИ ПОЛЯМИ ВРЕМЕНИ
   * ИСПРАВЛЕНО: Использует dateUtils методы для Date-only операций
   */
  private async createStaffRecordFromTemplateNumeric(
    date: Date,
    template: IScheduleTemplate,
    contract: IContract,
    params: IFillParams,
    holidayCache: Map<string, IHoliday>,
    leavePeriods: ILeavePeriod[]
  ): Promise<Partial<IStaffRecord>> {
    // ИСПРАВЛЕНО: Используем dateUtils метод вместо собственного
    const dateKey = this.dateUtils.formatDateOnlyForComparison(date);
    
    // ИСПРАВЛЕНО: Проверяем, является ли день праздником с dateUtils
    const isHoliday = holidayCache.has(dateKey);
    
    // ИСПРАВЛЕНО: Проверяем, находится ли сотрудник в отпуске с dateUtils
    const leaveForDay = leavePeriods.find(leave => {
      const checkDate = this.dateUtils.createDateOnlyFromDate(date);
      const leaveStart = this.dateUtils.createDateOnlyFromDate(leave.startDate);
      const leaveEnd = this.dateUtils.createDateOnlyFromDate(leave.endDate);
      
      return checkDate >= leaveStart && checkDate <= leaveEnd;
    });
    const isLeave = !!leaveForDay;

    // ИСПРАВЛЕНО: Парсим время из шаблона и получаем числовые поля с timezone adjustment
    const startTime = this.dateUtils.parseTimeString(template.startTime);
    const endTime = this.dateUtils.parseTimeString(template.endTime);
    const lunchTime = template.lunchMinutes;

    console.log(`[CommonFillRecords] *** USING DATEUTILS FOR NUMERIC TIME FIELDS ***`);
    console.log(`[CommonFillRecords] Creating record for ${date.toISOString()}: Shift ${template.NumberOfShift}, ${template.startTime}-${template.endTime}, lunch: ${lunchTime}min, holiday: ${isHoliday}, leave: ${isLeave}`);

    // ИСПРАВЛЕНО: Используем dateUtils для получения скорректированного времени
    const adjustedStartTime = await this.dateUtils.getAdjustedNumericTime(startTime);
    const adjustedEndTime = await this.dateUtils.getAdjustedNumericTime(endTime);

    console.log(`[CommonFillRecords] *** DATEUTILS NUMERIC TIME ADJUSTMENT ***`);
    console.log(`[CommonFillRecords] Start time: ${template.startTime} → ${adjustedStartTime.hours}:${adjustedStartTime.minutes}`);
    console.log(`[CommonFillRecords] End time: ${template.endTime} → ${adjustedEndTime.hours}:${adjustedEndTime.minutes}`);

    const record: Partial<IStaffRecord> = {
      Title: `Template=${contract.id} Week=${template.NumberOfWeek} Shift=${template.NumberOfShift}`,
      Date: new Date(date), // ПРАВИЛЬНО: UTC дата для StaffRecords.Date (DateTime поле)
      
      // *** ПРАВИЛЬНО: ТОЛЬКО ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ С DATEUTILS ADJUSTMENT ***
      ShiftDate1Hours: adjustedStartTime.hours,
      ShiftDate1Minutes: adjustedStartTime.minutes,
      ShiftDate2Hours: adjustedEndTime.hours,
      ShiftDate2Minutes: adjustedEndTime.minutes,
      
      TimeForLunch: lunchTime,
      Contract: template.NumberOfShift,  // ИСПРАВЛЕНО: используем номер смены вместо total
      Holiday: isHoliday ? FILL_CONSTANTS.FLAGS.HOLIDAY : FILL_CONSTANTS.FLAGS.NO_HOLIDAY,
      WeeklyTimeTableID: contract.id,
      WeeklyTimeTableTitle: contract.template || '',
      Checked: FILL_CONSTANTS.FLAGS.NOT_DELETED,
      Deleted: FILL_CONSTANTS.FLAGS.NOT_DELETED
    };

    // Добавляем тип отпуска если сотрудник в отпуске
    if (isLeave && leaveForDay) {
      record.TypeOfLeaveID = leaveForDay.typeOfLeave;
      console.log(`[CommonFillRecords] Added leave type ${record.TypeOfLeaveID} for ${date.toISOString()}: ${leaveForDay.title}`);
    }

    console.log(`[CommonFillRecords] *** FINAL RECORD WITH DATEUTILS INTEGRATION ***`);
    console.log(`[CommonFillRecords] Record: ${JSON.stringify({
      Title: record.Title,
      Date: record.Date?.toISOString(),
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
   * Валидирует параметры заполнения
   */
  public validateFillParams(params: IFillParams): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка обязательных полей
    if (!params.selectedDate) errors.push('Selected date is missing');
    if (!params.staffMember) errors.push('Staff member is missing');
    if (!params.staffMember?.id) errors.push('Staff member ID is missing');
    if (!params.staffMember?.employeeId) errors.push('Employee ID is missing');
    if (!params.context) errors.push('Context is missing');

    // Проверка значений
    if (params.currentUserId === '0' || !params.currentUserId) {
      warnings.push('Current user ID is not set or is 0');
    }
    if (params.managingGroupId === '0' || !params.managingGroupId) {
      warnings.push('Managing group ID is not set or is 0');
    }
    if (params.dayOfStartWeek !== undefined && (params.dayOfStartWeek < 1 || params.dayOfStartWeek > 7)) {
      errors.push(`Invalid day of start week: ${params.dayOfStartWeek} (must be 1-7)`);
    }

    // Проверка даты
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
   * Получает статистику по записям
   * ИСПРАВЛЕНО: Использует dateUtils для форматирования дат
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
        // ИСПРАВЛЕНО: Используем dateUtils для форматирования дат
        start: earliestDate ? this.dateUtils.formatDateOnlyForDisplay(earliestDate) : 'N/A',
        end: latestDate ? this.dateUtils.formatDateOnlyForDisplay(latestDate) : 'N/A'
      },
      timeRanges
    };
  }

  /**
   * Создает краткий отчет по записям
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
   * Валидирует сгенерированные записи
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

      // Проверка обязательных полей
      if (!record.Date) recordIssues.push('Missing date');
      if (!record.Title) recordIssues.push('Missing title');
      if (record.ShiftDate1Hours === undefined) recordIssues.push('Missing start hours');
      if (record.ShiftDate1Minutes === undefined) recordIssues.push('Missing start minutes');
      if (record.ShiftDate2Hours === undefined) recordIssues.push('Missing end hours');
      if (record.ShiftDate2Minutes === undefined) recordIssues.push('Missing end minutes');

      // Проверка диапазонов значений
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

      // Проверка логических ограничений
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
   * Оптимизирует записи для сохранения (группировка, сортировка)
   */
  public optimizeRecordsForSaving(records: Partial<IStaffRecord>[]): Partial<IStaffRecord>[] {
    // Сортируем записи по дате и смене для оптимального сохранения
    return [...records].sort((a, b) => {
      // Сначала по дате
      if (a.Date && b.Date) {
        const dateCompare = a.Date.getTime() - b.Date.getTime();
        if (dateCompare !== 0) return dateCompare;
      }
      
      // Затем по номеру смены
      if (a.Contract && b.Contract) {
        return a.Contract - b.Contract;
      }
      
      return 0;
    });
  }

  /**
   * Создает резервную копию записей в JSON формате
   */
  public createRecordsBackup(records: Partial<IStaffRecord>[], params: IFillParams): string {
    const backup = {
      timestamp: new Date().toISOString(),
      staffMember: {
        id: params.staffMember.id,
        name: params.staffMember.name,
        employeeId: params.staffMember.employeeId
      },
      // ИСПРАВЛЕНО: Используем dateUtils для форматирования периода
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate),
      totalRecords: records.length,
      records: records.map(record => ({
        ...record,
        Date: record.Date?.toISOString()
      })),
      statistics: this.getRecordsStatistics(records)
    };

    return JSON.stringify(backup, null, 2);
  }

  /**
   * Восстанавливает записи из резервной копии
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
   * Получает диагностическую информацию о процессе генерации
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
        dateUtils: !!this.dateUtils // ДОБАВЛЕНО: статус dateUtils
      },
      memoryUsage: 'Not available in browser environment',
      lastOperation: 'Records generation and saving with dateUtils integration',
      performanceMetrics: {
        averageRecordCreationTime: 0, // Would need timing implementation
        totalOperationTime: 0 // Would need timing implementation
      }
    };
  }
}