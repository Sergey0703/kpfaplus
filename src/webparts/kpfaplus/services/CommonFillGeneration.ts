// src/webparts/kpfaplus/services/CommonFillGeneration.ts
// ОБНОВЛЕНО: С детальным логированием всего процесса заполнения
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { WeeklyTimeTableUtils } from '../models/IWeeklyTimeTable';
import { IContract } from '../models/IContract';
import { IFillParams } from './CommonFillValidation';

// *** ИНТЕРФЕЙСЫ ДЛЯ ШАБЛОНОВ И АНАЛИЗА ***
interface IScheduleTemplate {
  id: string;
  title: string;
  NumberOfWeek?: number;
  numberOfWeek?: number;
  NumberOfShift?: number;
  shiftNumber?: number;
  dayOfWeek: number;
  start: string;
  end: string;
  lunch: string;
  total?: string;
  deleted?: number;
  Deleted?: number;
  // Дни недели после форматирования
  monday?: { start: string; end: string };
  tuesday?: { start: string; end: string };
  wednesday?: { start: string; end: string };
  thursday?: { start: string; end: string };
  friday?: { start: string; end: string };
  saturday?: { start: string; end: string };
  sunday?: { start: string; end: string };
}

// *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ ДЕТАЛЬНОГО АНАЛИЗА ***
interface IContractsAnalysis {
  totalFound: number;
  activeInPeriod: IContract[];
  selectedContract: IContract;
  selectionReason: string;
}

interface ITemplatesAnalysis {
  weeklyScheduleId: string;
  weeklyScheduleTitle: string;
  totalTemplatesFound: number;
  templatesAfterFiltering: number;
  weeksInSchedule: number[];
  shiftsAvailable: number[];
  dayOfStartWeek: number;
  weekStartDayName: string;
  templatesByWeek: Map<number, IScheduleTemplate[]>;
}

interface IDayGenerationInfo {
  date: string;
  weekNumber: number;
  dayNumber: number;
  dayName: string;
  templateFound: boolean;
  templateUsed?: IScheduleTemplate;
  workingHours?: string;
  lunchMinutes?: number;
  isHoliday: boolean;
  isLeave: boolean;
  leaveType?: string;
  skipReason?: string;
}

interface IGenerationAnalysis {
  totalDaysInPeriod: number;
  daysGenerated: number;
  daysSkipped: number;
  holidaysDetected: number;
  leavesDetected: number;
  dailyInfo: IDayGenerationInfo[];
  weeklyStats: Map<number, { total: number; generated: number; skipped: number }>;
}

export class CommonFillGeneration {
  private staffRecordsService: StaffRecordsService;
  private holidaysService: HolidaysService;
  private daysOfLeavesService: DaysOfLeavesService;
  private weeklyTimeTableService: WeeklyTimeTableService;

  // *** НОВЫЕ ПОЛЯ ДЛЯ ХРАНЕНИЯ АНАЛИЗА ***
  private contractsAnalysis?: IContractsAnalysis;
  private templatesAnalysis?: ITemplatesAnalysis;
  private generationAnalysis?: IGenerationAnalysis;

  constructor(context: WebPartContext) {
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    this.holidaysService = HolidaysService.getInstance(context);
    this.daysOfLeavesService = DaysOfLeavesService.getInstance(context);
    this.weeklyTimeTableService = new WeeklyTimeTableService(context);
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает детальный анализ всего процесса заполнения ***
   */
  public getDetailedAnalysis(): {
    contracts?: IContractsAnalysis;
    templates?: ITemplatesAnalysis;
    generation?: IGenerationAnalysis;
  } {
    return {
      contracts: this.contractsAnalysis,
      templates: this.templatesAnalysis,
      generation: this.generationAnalysis
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Анализирует контракты для детального логирования ***
   */
  public analyzeContracts(
    allContracts: IContract[], 
    activeContracts: IContract[], 
    selectedContract: IContract,
    selectedDate: Date
  ): void {
    console.log('[CommonFillGeneration] Performing detailed contracts analysis...');

    let selectionReason = '';
    if (activeContracts.length === 1) {
      selectionReason = 'Only one active contract found for the period';
    } else if (activeContracts.length > 1) {
      selectionReason = `Selected first of ${activeContracts.length} active contracts`;
    } else {
      selectionReason = 'No active contracts found (using fallback)';
    }

    this.contractsAnalysis = {
      totalFound: allContracts.length,
      activeInPeriod: activeContracts,
      selectedContract: selectedContract,
      selectionReason: selectionReason
    };

    console.log('[CommonFillGeneration] Contracts analysis completed:', {
      total: this.contractsAnalysis.totalFound,
      active: this.contractsAnalysis.activeInPeriod.length,
      selected: this.contractsAnalysis.selectedContract.id,
      reason: this.contractsAnalysis.selectionReason
    });
  }

  /**
   * Загружает праздники для месяца
   */
  public async loadHolidays(date: Date): Promise<IHoliday[]> {
    try {
      console.log(`[CommonFillGeneration] Loading holidays for ${date.getMonth() + 1}/${date.getFullYear()}`);
      const holidays = await this.holidaysService.getHolidaysByMonthAndYear(date);
      console.log(`[CommonFillGeneration] Loaded ${holidays.length} holidays`);
      
      // Логируем первые несколько праздников для отладки
      if (holidays.length > 0) {
        holidays.slice(0, 3).forEach((holiday, index) => {
          console.log(`[CommonFillGeneration] Holiday ${index + 1}: ${new Date(holiday.date).toLocaleDateString()} - ${holiday.title}`);
        });
      }
      
      return holidays;
    } catch (error) {
      console.error('[CommonFillGeneration] Error loading holidays:', error);
      return [];
    }
  }

  /**
   * Загружает отпуска сотрудника
   */
  public async loadLeaves(params: IFillParams): Promise<ILeaveDay[]> {
    try {
      if (!params.staffMember.employeeId) {
        console.log('[CommonFillGeneration] No employee ID - skipping leaves loading');
        return [];
      }

      console.log(`[CommonFillGeneration] Loading leaves for employee ${params.staffMember.employeeId}`);
      const leaves = await this.daysOfLeavesService.getLeavesForMonthAndYear(
        params.selectedDate,
        parseInt(params.staffMember.employeeId, 10),
        parseInt(params.currentUserId || '0', 10),
        parseInt(params.managingGroupId || '0', 10)
      );

      // Фильтруем удаленные отпуска
      const activeLeaves = leaves.filter((leave: ILeaveDay) => !leave.deleted);
      console.log(`[CommonFillGeneration] Loaded ${leaves.length} total leaves, ${activeLeaves.length} active`);

      // Логируем первые несколько отпусков для отладки
      if (activeLeaves.length > 0) {
        activeLeaves.slice(0, 3).forEach((leave, index) => {
          const endDateStr = leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'ongoing';
          console.log(`[CommonFillGeneration] Leave ${index + 1}: ${new Date(leave.startDate).toLocaleDateString()} - ${endDateStr}, type: ${leave.typeOfLeave}, title: "${leave.title}"`);
        });
      }

      return activeLeaves;
    } catch (error) {
      console.error('[CommonFillGeneration] Error loading leaves:', error);
      return [];
    }
  }

  /**
   * *** ОБНОВЛЕНО: Загружает шаблоны с детальным анализом ***
   */
  public async loadWeeklyTemplates(contractId: string, dayOfStartWeek: number): Promise<IScheduleTemplate[]> {
    try {
      console.log(`[CommonFillGeneration] Loading weekly templates with detailed analysis for contract ${contractId}`);
      
      // *** ШАГ 1: ПОЛУЧЕНИЕ ШАБЛОНОВ ИЗ SHAREPOINT ***
      const weeklyTimeItems = await this.weeklyTimeTableService.getWeeklyTimeTableByContractId(contractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        console.log('[CommonFillGeneration] No weekly time items found');
        this.initializeEmptyTemplatesAnalysis(contractId, dayOfStartWeek);
        return [];
      }

      console.log(`[CommonFillGeneration] Retrieved ${weeklyTimeItems.length} weekly time items from SharePoint`);

      // *** ШАГ 2: ПЕРВИЧНАЯ ФИЛЬТРАЦИЯ УДАЛЁННЫХ ШАБЛОНОВ ***
      const activeWeeklyTimeItems = weeklyTimeItems.filter((item: any) => {
        const isDeleted = 
          item.fields?.Deleted === 1 || 
          item.Deleted === 1 ||
          item.fields?.deleted === 1 ||
          item.deleted === 1;
        
        return !isDeleted;
      });

      console.log(`[CommonFillGeneration] After primary filtering: ${activeWeeklyTimeItems.length} active weekly time items`);

      if (activeWeeklyTimeItems.length === 0) {
        this.initializeEmptyTemplatesAnalysis(contractId, dayOfStartWeek);
        return [];
      }

      // *** ШАГ 3: ФОРМАТИРОВАНИЕ ШАБЛОНОВ С УЧЁТОМ НАЧАЛА НЕДЕЛИ ГРУППЫ ***
      console.log(`[CommonFillGeneration] Formatting templates with dayOfStartWeek: ${dayOfStartWeek}`);
      const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(activeWeeklyTimeItems, dayOfStartWeek);
      
      if (!formattedTemplates) {
        console.log('[CommonFillGeneration] Failed to format weekly templates');
        this.initializeEmptyTemplatesAnalysis(contractId, dayOfStartWeek);
        return [];
      }

      console.log(`[CommonFillGeneration] Successfully formatted ${formattedTemplates.length} templates`);

      // *** ШАГ 4: ВТОРИЧНАЯ ФИЛЬТРАЦИЯ УДАЛЁННЫХ ШАБЛОНОВ ***
      const finalTemplates = formattedTemplates.filter((template: any) => 
        template.deleted !== 1 && template.Deleted !== 1
      );

      console.log(`[CommonFillGeneration] Final formatted templates: ${finalTemplates.length}`);

      // *** ШАГ 5: ПРЕОБРАЗОВАНИЕ В ЕДИНЫЙ ФОРМАТ ***
      const scheduleTemplates: IScheduleTemplate[] = this.convertToScheduleTemplates(finalTemplates);

      // *** ШАГ 6: ГРУППИРОВКА ШАБЛОНОВ ДЛЯ БЫСТРОГО ДОСТУПА ***
      const groupedTemplates = this.groupTemplatesByWeekAndDay(scheduleTemplates);

      // *** ШАГ 7: ДЕТАЛЬНЫЙ АНАЛИЗ ШАБЛОНОВ ***
      const scheduleTitle = this.extractScheduleTitle(weeklyTimeItems);
      this.analyzeTemplates(
        contractId, 
        scheduleTitle,
        weeklyTimeItems.length,
        finalTemplates.length,
        dayOfStartWeek,
        scheduleTemplates,
        groupedTemplates
      );

      // Сохраняем группированные шаблоны для использования в generateScheduleRecords
      (scheduleTemplates as any)._groupedTemplates = groupedTemplates;

      return scheduleTemplates;
    } catch (error) {
      console.error('[CommonFillGeneration] Error loading weekly templates:', error);
      this.initializeEmptyTemplatesAnalysis(contractId, dayOfStartWeek);
      return [];
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Инициализирует пустой анализ шаблонов ***
   */
  private initializeEmptyTemplatesAnalysis(contractId: string, dayOfStartWeek: number): void {
    this.templatesAnalysis = {
      weeklyScheduleId: contractId,
      weeklyScheduleTitle: 'No schedule found',
      totalTemplatesFound: 0,
      templatesAfterFiltering: 0,
      weeksInSchedule: [],
      shiftsAvailable: [],
      dayOfStartWeek: dayOfStartWeek,
      weekStartDayName: this.getDayName(dayOfStartWeek),
      templatesByWeek: new Map()
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Детальный анализ шаблонов ***
   */
  private analyzeTemplates(
    contractId: string,
    scheduleTitle: string,
    totalFound: number,
    afterFiltering: number,
    dayOfStartWeek: number,
    scheduleTemplates: IScheduleTemplate[],
    groupedTemplates: Map<string, IScheduleTemplate[]>
  ): void {
    console.log('[CommonFillGeneration] Performing detailed templates analysis...');

    // Анализ недель в расписании
    const weeksSet = new Set<number>();
    const shiftsSet = new Set<number>();

    scheduleTemplates.forEach(template => {
      const weekNum = template.NumberOfWeek || template.numberOfWeek || 1;
      const shiftNum = template.NumberOfShift || template.shiftNumber || 1;
      weeksSet.add(weekNum);
      shiftsSet.add(shiftNum);
    });

    // Группировка по неделям
    const templatesByWeek = new Map<number, IScheduleTemplate[]>();
    scheduleTemplates.forEach(template => {
      const weekNum = template.NumberOfWeek || template.numberOfWeek || 1;
      if (!templatesByWeek.has(weekNum)) {
        templatesByWeek.set(weekNum, []);
      }
      templatesByWeek.get(weekNum)?.push(template);
    });

    this.templatesAnalysis = {
      weeklyScheduleId: contractId,
      weeklyScheduleTitle: scheduleTitle,
      totalTemplatesFound: totalFound,
      templatesAfterFiltering: afterFiltering,
      weeksInSchedule: Array.from(weeksSet).sort(),
      shiftsAvailable: Array.from(shiftsSet).sort(),
      dayOfStartWeek: dayOfStartWeek,
      weekStartDayName: this.getDayName(dayOfStartWeek),
      templatesByWeek: templatesByWeek
    };

    console.log('[CommonFillGeneration] Templates analysis completed:', {
      schedule: this.templatesAnalysis.weeklyScheduleTitle,
      totalFound: this.templatesAnalysis.totalTemplatesFound,
      afterFiltering: this.templatesAnalysis.templatesAfterFiltering,
      weeks: this.templatesAnalysis.weeksInSchedule,
      shifts: this.templatesAnalysis.shiftsAvailable,
      weekStart: this.templatesAnalysis.weekStartDayName
    });
  }

  /**
   * *** НОВЫЙ МЕТОД: Безопасно извлекает название расписания ***
   */
  private extractScheduleTitle(weeklyTimeItems: any[]): string {
    if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
      return 'No Schedule Found';
    }

    const firstItem = weeklyTimeItems[0];
    if (!firstItem) {
      return 'Unknown Schedule';
    }

    // Пробуем разные варианты получения названия
    let title = '';
    
    if (typeof firstItem.Title === 'string') {
      title = firstItem.Title;
    } else if (typeof firstItem.title === 'string') {
      title = firstItem.title;
    } else if (firstItem.fields && typeof firstItem.fields.Title === 'string') {
      title = firstItem.fields.Title;
    } else if (firstItem.fields && typeof firstItem.fields.title === 'string') {
      title = firstItem.fields.title;
    }

    return title.trim() || 'Unknown Schedule';
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает название дня недели ***
   */
  private getDayName(dayNumber: number): string {
    const dayNames: { [key: number]: string } = {
      1: 'Monday',
      2: 'Tuesday', 
      3: 'Wednesday',
      4: 'Thursday',
      5: 'Friday',
      6: 'Saturday',
      7: 'Sunday'
    };
    return dayNames[dayNumber] || 'Unknown';
  }

  /**
   * Преобразует отформатированные шаблоны в единый формат
   */
  private convertToScheduleTemplates(formattedTemplates: any[]): IScheduleTemplate[] {
    const scheduleTemplates: IScheduleTemplate[] = [];

    formattedTemplates.forEach((template: any) => {
      const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
      const shiftNumber = template.NumberOfShift || template.shiftNumber || 1;

      // Проходим по всем дням недели
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dayInfo = template[day];
        
        if (dayInfo && dayInfo.start && dayInfo.end) {
          const scheduleTemplate: IScheduleTemplate = {
            id: template.id || template.ID || '',
            title: template.Title || template.title || '',
            NumberOfWeek: weekNumber,
            numberOfWeek: weekNumber,
            NumberOfShift: shiftNumber,
            shiftNumber: shiftNumber,
            dayOfWeek: i + 1,
            start: dayInfo.start,
            end: dayInfo.end,
            lunch: template.lunch || '30',
            total: template.total || '',
            deleted: template.deleted || 0,
            Deleted: template.Deleted || 0,
            // Сохраняем все дни для совместимости
            monday: template.monday,
            tuesday: template.tuesday,
            wednesday: template.wednesday,
            thursday: template.thursday,
            friday: template.friday,
            saturday: template.saturday,
            sunday: template.sunday
          };

          scheduleTemplates.push(scheduleTemplate);
        }
      }
    });

    console.log(`[CommonFillGeneration] Converted ${formattedTemplates.length} raw templates to ${scheduleTemplates.length} schedule templates`);
    return scheduleTemplates;
  }

  /**
   * Группировка шаблонов для быстрого доступа
   */
  private groupTemplatesByWeekAndDay(templates: IScheduleTemplate[]): Map<string, IScheduleTemplate[]> {
    console.log(`[CommonFillGeneration] Grouping ${templates.length} templates by week and day`);
    
    const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();

    templates.forEach((template: IScheduleTemplate) => {
      const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
      const dayNumber = template.dayOfWeek;
      
      const key = `${weekNumber}-${dayNumber}`;
      
      if (!templatesByWeekAndDay.has(key)) {
        templatesByWeekAndDay.set(key, []);
      }
      
      templatesByWeekAndDay.get(key)?.push(template);
    });

    console.log(`[CommonFillGeneration] Created ${templatesByWeekAndDay.size} template groups`);
    return templatesByWeekAndDay;
  }

  /**
   * *** ОБНОВЛЕНО: Генерирует записи с детальным анализом ***
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: IScheduleTemplate[]
  ): Promise<Partial<IStaffRecord>[]> {
    console.log(`[CommonFillGeneration] Generating schedule records with detailed analysis for ${params.staffMember.name}`);

    // Определяем период для генерации
    const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
    const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);

    const contractStartDate = contract.startDate;
    const contractFinishDate = contract.finishDate;

    const firstDay = contractStartDate && contractStartDate > startOfMonth 
      ? new Date(contractStartDate) 
      : new Date(startOfMonth);

    const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
      ? new Date(contractFinishDate) 
      : new Date(endOfMonth);

    console.log(`[CommonFillGeneration] Generation period: ${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`);

    // Создаем кэши для быстрого поиска
    const holidayCache = this.createHolidayCache(holidays);
    const leavePeriods = this.createLeavePeriods(leaves);

    // *** ИНИЦИАЛИЗИРУЕМ АНАЛИЗ ГЕНЕРАЦИИ ***
    this.initializeGenerationAnalysis(firstDay, lastDay);

    // Получаем группированные шаблоны
    const groupedTemplates = (weeklyTemplates as any)._groupedTemplates as Map<string, IScheduleTemplate[]>;
    if (!groupedTemplates) {
      console.error('[CommonFillGeneration] No grouped templates found - using fallback logic');
      return this.generateRecordsWithFallback(params, contract, firstDay, lastDay, weeklyTemplates, holidayCache, leavePeriods);
    }

    const records: Partial<IStaffRecord>[] = [];

    // *** ПЕРЕБИРАЕМ ВСЕ ДНИ ПЕРИОДА С ДЕТАЛЬНЫМ АНАЛИЗОМ ***
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // Вычисляем номер недели и день недели
      const weekAndDay = this.calculateWeekAndDay(currentDate, startOfMonth, params.dayOfStartWeek || 7);
      
      // Ищем подходящие шаблоны для этого дня
      const templatesForDay = this.findTemplatesForDay(groupedTemplates, weekAndDay.weekNumber, weekAndDay.dayNumber);
      
      // *** СОЗДАЕМ ИНФОРМАЦИЮ О ДНЕ ДЛЯ АНАЛИЗА ***
      const dayInfo: IDayGenerationInfo = {
        date: currentDate.toLocaleDateString(),
        weekNumber: weekAndDay.weekNumber,
        dayNumber: weekAndDay.dayNumber,
        dayName: this.getDayName(weekAndDay.dayNumber),
        templateFound: templatesForDay.length > 0,
        isHoliday: this.isHoliday(currentDate, holidayCache),
        isLeave: this.isLeave(currentDate, leavePeriods)
      };

      if (dayInfo.isLeave) {
        const leave = this.getLeaveForDay(currentDate, leavePeriods);
        dayInfo.leaveType = leave?.typeOfLeave || 'Unknown';
      }

      if (templatesForDay.length > 0) {
        const selectedTemplate = templatesForDay[0];
        dayInfo.templateUsed = selectedTemplate;
        dayInfo.workingHours = `${selectedTemplate.start}-${selectedTemplate.end}`;
        dayInfo.lunchMinutes = parseInt(selectedTemplate.lunch || '30', 10);
        
        console.log(`[CommonFillGeneration] ${dayInfo.date} (${dayInfo.dayName}): Week ${dayInfo.weekNumber}, Template: ${dayInfo.workingHours}, Lunch: ${dayInfo.lunchMinutes}min`);
        
        const record = this.createStaffRecordFromTemplate(
          currentDate, 
          selectedTemplate, 
          contract, 
          holidayCache, 
          leavePeriods
        );
        
        records.push(record);
        this.updateGenerationStats(weekAndDay.weekNumber, true);
      } else {
        dayInfo.skipReason = 'No template found for this week/day combination';
        console.log(`[CommonFillGeneration] ${dayInfo.date} (${dayInfo.dayName}): Week ${dayInfo.weekNumber}, Day ${dayInfo.dayNumber} - ${dayInfo.skipReason}`);
        this.updateGenerationStats(weekAndDay.weekNumber, false);
      }

      // Добавляем информацию о дне в анализ
      this.generationAnalysis?.dailyInfo.push(dayInfo);
    }

    // *** ЗАВЕРШАЕМ АНАЛИЗ ГЕНЕРАЦИИ ***
    this.finalizeGenerationAnalysis(records.length, holidays.length, leaves.length);

    console.log(`[CommonFillGeneration] Generated ${records.length} schedule records with detailed analysis`);
    return records;
  }

  /**
   * *** НОВЫЙ МЕТОД: Инициализирует анализ генерации ***
   */
  private initializeGenerationAnalysis(firstDay: Date, lastDay: Date): void {
    const totalDays = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    this.generationAnalysis = {
      totalDaysInPeriod: totalDays,
      daysGenerated: 0,
      daysSkipped: 0,
      holidaysDetected: 0,
      leavesDetected: 0,
      dailyInfo: [],
      weeklyStats: new Map()
    };

    console.log(`[CommonFillGeneration] Initialized generation analysis for ${totalDays} days`);
  }

  /**
   * *** НОВЫЙ МЕТОД: Обновляет статистику генерации ***
   */
  private updateGenerationStats(weekNumber: number, generated: boolean): void {
    if (!this.generationAnalysis?.weeklyStats.has(weekNumber)) {
      this.generationAnalysis?.weeklyStats.set(weekNumber, { total: 0, generated: 0, skipped: 0 });
    }

    const weekStats = this.generationAnalysis?.weeklyStats.get(weekNumber);
    if (weekStats) {
      weekStats.total++;
      if (generated) {
        weekStats.generated++;
        this.generationAnalysis!.daysGenerated++;
      } else {
        weekStats.skipped++;
        this.generationAnalysis!.daysSkipped++;
      }
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Завершает анализ генерации ***
   */
  private finalizeGenerationAnalysis(recordsGenerated: number, holidaysCount: number, leavesCount: number): void {
    if (this.generationAnalysis) {
      this.generationAnalysis.holidaysDetected = holidaysCount;
      this.generationAnalysis.leavesDetected = leavesCount;
      
      console.log('[CommonFillGeneration] Generation analysis completed:', {
        totalDays: this.generationAnalysis.totalDaysInPeriod,
        generated: this.generationAnalysis.daysGenerated,
        skipped: this.generationAnalysis.daysSkipped,
        holidays: this.generationAnalysis.holidaysDetected,
        leaves: this.generationAnalysis.leavesDetected
      });
    }
  }

  /**
   * *** НОВЫЕ ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ АНАЛИЗА ***
   */
  private isHoliday(date: Date, holidayCache: Map<string, IHoliday>): boolean {
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    return holidayCache.has(dateKey);
  }

  private isLeave(date: Date, leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>): boolean {
    return leavePeriods.some(leave => date >= leave.startDate && date <= leave.endDate);
  }

  private getLeaveForDay(date: Date, leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>): {typeOfLeave: string, title: string} | undefined {
    return leavePeriods.find(leave => date >= leave.startDate && date <= leave.endDate);
  }

  /**
   * Вычисляет номер недели и день недели
   */
  private calculateWeekAndDay(date: Date, startOfMonth: Date, dayOfStartWeek: number): { weekNumber: number; dayNumber: number } {
    const dayOfMonth = date.getDate();
    const weekNumber = Math.ceil(dayOfMonth / 7);
    
    let dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    if (dayOfStartWeek === 2) { // Понедельник = начало недели
      dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    } else if (dayOfStartWeek === 7) { // Суббота = начало недели
      dayOfWeek = (dayOfWeek + 1) % 7 + 1;
    }
    
    return { weekNumber, dayNumber: dayOfWeek };
  }

  /**
   * Находит шаблоны для конкретной недели и дня
   */
  private findTemplatesForDay(
    groupedTemplates: Map<string, IScheduleTemplate[]>, 
    weekNumber: number, 
    dayNumber: number
  ): IScheduleTemplate[] {
    const key = `${weekNumber}-${dayNumber}`;
    const templates = groupedTemplates.get(key) || [];
    
    if (templates.length === 0) {
      const fallbackKey = `1-${dayNumber}`;
      const fallbackTemplates = groupedTemplates.get(fallbackKey) || [];
      
      if (fallbackTemplates.length > 0) {
        console.log(`[CommonFillGeneration] Using fallback template for week 1, day ${dayNumber}`);
        return fallbackTemplates;
      }
    }
    
    return templates;
  }

  /**
   * Создает запись расписания из шаблона
   */
  private createStaffRecordFromTemplate(
    date: Date,
    template: IScheduleTemplate,
    contract: IContract,
    holidayCache: Map<string, IHoliday>,
    leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>
  ): Partial<IStaffRecord> {
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    
    // Проверяем, является ли день праздником
    const isHoliday = holidayCache.has(dateKey);
    
    // Проверяем, находится ли сотрудник в отпуске в этот день
    const leaveForDay = leavePeriods.find(leave => 
      date >= leave.startDate && date <= leave.endDate
    );
    const isLeave = !!leaveForDay;

    // Используем время из шаблона
    const startTime = this.parseTimeString(template.start);
    const endTime = this.parseTimeString(template.end);
    const lunchTime = parseInt(template.lunch || '30', 10);

    const record: Partial<IStaffRecord> = {
      Title: `Template=${contract.id} Week=${template.NumberOfWeek || template.numberOfWeek || 1} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
      Date: new Date(date),
      ShiftDate1: new Date(date.getFullYear(), date.getMonth(), date.getDate(), startTime.hours, startTime.minutes),
      ShiftDate2: new Date(date.getFullYear(), date.getMonth(), date.getDate(), endTime.hours, endTime.minutes),
      TimeForLunch: lunchTime,
      Contract: parseInt(template.total || '1', 10),
      Holiday: isHoliday ? 1 : 0,
      WeeklyTimeTableID: contract.id,
      WeeklyTimeTableTitle: contract.template || '',
      Checked: 0,
      Deleted: 0
    };

    // Добавляем тип отпуска если сотрудник в отпуске
    if (isLeave && leaveForDay) {
      record.TypeOfLeaveID = leaveForDay.typeOfLeave;
    }

    return record;
  }

  /**
   * Парсит строку времени в часы и минуты
   */
  private parseTimeString(timeStr: string): { hours: number; minutes: number } {
    try {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      
      return {
        hours: isNaN(hours) ? 9 : hours,
        minutes: isNaN(minutes) ? 0 : minutes
      };
    } catch (error) {
      console.error(`[CommonFillGeneration] Error parsing time string "${timeStr}":`, error);
      return { hours: 9, minutes: 0 };
    }
  }

  /**
   * Fallback генерация записей с упрощенной логикой
   */
  private generateRecordsWithFallback(
    params: IFillParams,
    contract: IContract,
    firstDay: Date,
    lastDay: Date,
    weeklyTemplates: IScheduleTemplate[],
    holidayCache: Map<string, IHoliday>,
    leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>
  ): Partial<IStaffRecord>[] {
    console.log('[CommonFillGeneration] Using fallback generation logic');
    
    const records: Partial<IStaffRecord>[] = [];

    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      if (weeklyTemplates.length > 0) {
        const template = weeklyTemplates[0];
        const record = this.createStaffRecordFromTemplate(currentDate, template, contract, holidayCache, leavePeriods);
        records.push(record);
      }
    }

    return records;
  }

  /**
   * Создает кэш праздников для быстрого поиска
   */
  private createHolidayCache(holidays: IHoliday[]): Map<string, IHoliday> {
    const cache = new Map<string, IHoliday>();
    holidays.forEach((holiday: IHoliday) => {
      const date = new Date(holiday.date);
      const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      cache.set(key, holiday);
    });
    console.log(`[CommonFillGeneration] Created holiday cache with ${cache.size} entries`);
    return cache;
  }

  /**
   * Создает массив периодов отпусков для быстрой проверки
   */
  private createLeavePeriods(leaves: ILeaveDay[]): Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}> {
    const leavePeriods = leaves.map((leave: ILeaveDay) => ({
      startDate: new Date(leave.startDate),
      endDate: leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31),
      typeOfLeave: leave.typeOfLeave.toString(),
      title: leave.title || ''
    }));
    
    console.log(`[CommonFillGeneration] Created leave periods cache with ${leavePeriods.length} entries`);
    return leavePeriods;
  }

  /**
   * Сохраняет сгенерированные записи в SharePoint
   */
  public async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<number> {
    console.log(`[CommonFillGeneration] Saving ${records.length} generated records with detailed analysis`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillGeneration] Saving record ${i + 1}/${records.length} for ${record.Date?.toLocaleDateString()}`);
        
        const employeeId = params.staffMember.employeeId;
        const managerId = params.currentUserId;
        const staffGroupId = params.managingGroupId;
        
        if (!employeeId || employeeId === '0' || employeeId.trim() === '') {
          const errorMsg = `Missing or invalid employeeId for record ${i + 1}: "${employeeId}"`;
          errors.push(errorMsg);
          console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
          continue;
        }
        
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,
          managerId || '0',
          staffGroupId || '0',
          employeeId
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillGeneration] ✓ Created record ID=${newRecordId} for ${record.Date?.toLocaleDateString()}`);
          
          if (record.TypeOfLeaveID) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created with leave type: ${record.TypeOfLeaveID}`);
          }
          if (record.Holiday === 1) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created for holiday`);
          }
          
          if (record.ShiftDate1 && record.ShiftDate2) {
            const startTime = `${record.ShiftDate1.getHours()}:${record.ShiftDate1.getMinutes().toString().padStart(2, '0')}`;
            const endTime = `${record.ShiftDate2.getHours()}:${record.ShiftDate2.getMinutes().toString().padStart(2, '0')}`;
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} time: ${startTime}-${endTime}, lunch: ${record.TimeForLunch}min`);
          }
        } else {
          const errorMsg = `Failed to create record for ${record.Date?.toLocaleDateString()}: No ID returned`;
          errors.push(errorMsg);
          console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = `Error creating record ${i + 1} for ${record.Date?.toLocaleDateString()}: ${error}`;
        errors.push(errorMsg);
        console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
      }

      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[CommonFillGeneration] Save operation completed with detailed analysis: ${successCount}/${records.length} successful`);
    
    if (errors.length > 0) {
      console.error(`[CommonFillGeneration] Save errors (${errors.length}):`, errors);
    }

    return successCount;
  }
}