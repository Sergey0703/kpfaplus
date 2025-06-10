// src/webparts/kpfaplus/services/CommonFillGeneration.ts
// ИСПРАВЛЕНО: Добавлена правильная обработка UTC времени как в Schedule tab
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { RemoteSiteService } from './RemoteSiteService';
import { SharePointTimeZoneUtils } from '../utils/SharePointTimeZoneUtils';
import { IContract } from '../models/IContract';
import { IFillParams } from './CommonFillValidation';

// *** ИНТЕРФЕЙСЫ ДЛЯ ШАБЛОНОВ И АНАЛИЗА ***
interface IScheduleTemplate {
  id: string;
  contractId: string;
  NumberOfWeek: number;
  NumberOfShift: number;
  dayOfWeek: number; // 1-7 (Monday-Sunday)
  dayName: string;
  startTime: string; // HH:mm формат
  endTime: string;   // HH:mm формат  
  lunchMinutes: number;
  deleted: number;
}

// *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ ДЕТАЛЬНОГО АНАЛИЗА ***
interface IContractsAnalysis {
  totalFound: number;
  activeInPeriod: IContract[];
  selectedContract: IContract;
  selectionReason: string;
}

interface ITemplatesAnalysis {
  contractId: string;
  contractName: string;
  totalItemsFromServer: number;
  afterManagerFilter: number;
  afterDeletedFilter: number;
  finalTemplatesCount: number;
  weeksInSchedule: number[];
  shiftsAvailable: number[];
  numberOfWeekTemplates: number;
  dayOfStartWeek: number;
  weekStartDayName: string;
  templatesByWeekAndDay: Map<string, IScheduleTemplate[]>;
  filteringDetails: string[];
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

// *** ИНТЕРФЕЙС ДЛЯ WEEKLY TIME TABLE ITEM ***
interface IWeeklyTimeTableItem {
  id: string;
  fields?: {
    NumberOfWeek?: number;
    NumberOfShift?: number;
    TimeForLunch?: number;
    Deleted?: number;
    CreatorLookupId?: string;
    creatorId?: string;
    Creator?: string;
    MondeyStartWork?: string; // Опечатка в SharePoint
    MondayEndWork?: string;
    TuesdayStartWork?: string;
    TuesdayEndWork?: string;
    WednesdayStartWork?: string;
    WednesdayEndWork?: string;
    ThursdayStartWork?: string;
    ThursdayEndWork?: string;
    FridayStartWork?: string;
    FridayEndWork?: string;
    SaturdayStartWork?: string;
    SaturdayEndWork?: string;
    SundayStartWork?: string;
    SundayEndWork?: string;
    [key: string]: unknown;
  };
}

export class CommonFillGeneration {
  private staffRecordsService: StaffRecordsService;
  private holidaysService: HolidaysService;
  private daysOfLeavesService: DaysOfLeavesService;
  private weeklyTimeTableService: WeeklyTimeTableService;
  private remoteSiteService: RemoteSiteService; // *** ДОБАВЛЕН RemoteSiteService ***

  // *** НОВЫЕ ПОЛЯ ДЛЯ ХРАНЕНИЯ АНАЛИЗА ***
  private contractsAnalysis?: IContractsAnalysis;
  private templatesAnalysis?: ITemplatesAnalysis;
  private generationAnalysis?: IGenerationAnalysis;

  constructor(context: WebPartContext) {
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    this.holidaysService = HolidaysService.getInstance(context);
    this.daysOfLeavesService = DaysOfLeavesService.getInstance(context);
    this.weeklyTimeTableService = new WeeklyTimeTableService(context);
    this.remoteSiteService = RemoteSiteService.getInstance(context); // *** ИНИЦИАЛИЗАЦИЯ RemoteSiteService ***
    
    console.log('[CommonFillGeneration] Service initialized with UTC timezone handling like Schedule tab');
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
   * *** ИСПРАВЛЕНО: Helper function to create Date object with specified time using UTC + timezone adjustment ***
   * Копирует логику из Schedule tab (ScheduleTabFillHelpers.createDateWithTime)
   * 
   * @param baseDate Base date
   * @param time Object with hours and minutes (может быть undefined)
   * @returns Date object with set time in UTC с корректировкой часового пояса
   */
  private async createDateWithTime(
    baseDate: Date, 
    time?: { hours: string; minutes: string }
  ): Promise<Date> {
    const result = new Date(baseDate);
    
    if (!time) {
      result.setUTCHours(0, 0, 0, 0);
      console.log(`[CommonFillGeneration] No time provided, set to UTC midnight: ${result.toISOString()}`);
      return result;
    }
    
    const hours = parseInt(time.hours || '0', 10);
    const minutes = parseInt(time.minutes || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      console.warn(`[CommonFillGeneration] Invalid time components: hours="${time.hours}", minutes="${time.minutes}"`);
      result.setUTCHours(0, 0, 0, 0);
      console.warn(`[CommonFillGeneration] Set to UTC midnight: ${result.toISOString()}`);
      return result;
    }
    
    console.log(`[CommonFillGeneration] *** UTC TIMEZONE ADJUSTMENT LIKE SCHEDULE TAB ***`);
    console.log(`[CommonFillGeneration] Input time from template: ${hours}:${minutes}`);
    
    // *** ИСПРАВЛЕНО: Используем SharePointTimeZoneUtils как в Schedule tab ***
    const adjustedTime = await SharePointTimeZoneUtils.adjustTimeForSharePointTimeZone(
      hours, 
      minutes, 
      this.remoteSiteService, 
      baseDate
    );
    
    result.setUTCHours(adjustedTime.hours, adjustedTime.minutes, 0, 0);
    
    console.log(`[CommonFillGeneration] *** TIMEZONE ADJUSTMENT COMPLETED ***`);
    console.log(`[CommonFillGeneration] ${hours}:${minutes} → ${adjustedTime.hours}:${adjustedTime.minutes} UTC`);
    console.log(`[CommonFillGeneration] Final result: ${result.toISOString()}`);
    
    return result;
  }

  /**
   * *** НОВЫЙ МЕТОД: Парсит время из SharePoint формата ***
   */
  private parseTimeFromSharePoint(timeValue: unknown): string | null {
    if (!timeValue) return null;
    
    try {
      // SharePoint возвращает время в формате "2025-01-01T09:00:00Z" или подобном
      let timeStr = String(timeValue);
      
      // Извлекаем часть времени после "T"
      if (timeStr.includes('T')) {
        timeStr = timeStr.split('T')[1];
      }
      
      // Убираем секунды и Z
      if (timeStr.includes(':')) {
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
          const hours = timeParts[0].padStart(2, '0');
          const minutes = timeParts[1].padStart(2, '0');
          return `${hours}:${minutes}`;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`[CommonFillGeneration] Error parsing time "${timeValue}":`, error);
      return null;
    }
  }
  /**
   * *** НОВЫЙ МЕТОД: Инициализирует пустой анализ шаблонов ***
   */
  private initializeEmptyTemplatesAnalysis(
    contractId: string, 
    contractName: string,
    dayOfStartWeek: number,
    filteringDetails: string[]
  ): void {
    this.templatesAnalysis = {
      contractId: contractId,
      contractName: contractName || 'No contract found',
      totalItemsFromServer: 0,
      afterManagerFilter: 0,
      afterDeletedFilter: 0,
      finalTemplatesCount: 0,
      weeksInSchedule: [],
      shiftsAvailable: [],
      numberOfWeekTemplates: 0,
      dayOfStartWeek: dayOfStartWeek,
      weekStartDayName: this.getDayName(dayOfStartWeek),
      templatesByWeekAndDay: new Map(),
      filteringDetails: filteringDetails
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Описание логики чередования недель ***
   */
  private getWeekChainingDescription(numberOfWeekTemplates: number): string {
    switch (numberOfWeekTemplates) {
      case 1:
        return 'Single week template - repeat for all weeks (1,1,1,1)';
      case 2:
        return 'Two week templates - alternate pattern (1,2,1,2)';
      case 3:
        return 'Three week templates - cycle pattern (1,2,3,1,2,3,...)';
      case 4:
        return 'Four week templates - full month cycle (1,2,3,4)';
      default:
        return `${numberOfWeekTemplates} week templates - custom cycle pattern`;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает название дня недели ***
   */
  private getDayName(dayNumber: number): string {
    // *** ИСПОЛЬЗУЕМ СТАНДАРТНУЮ JAVASCRIPT НУМЕРАЦИЮ ***
    // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    console.log(`[CommonFillGeneration] getDayName: dayNumber=${dayNumber} → ${dayNames[dayNumber] || 'Unknown'}`);
    
    return dayNames[dayNumber] || 'Unknown';
  }

  /**
   * *** ПЕРЕПИСАННЫЙ МЕТОД: Загружает шаблоны с правильной клиентской фильтрацией ***
   */
  public async loadWeeklyTemplates(
    contractId: string, 
    dayOfStartWeek: number,
    currentUserId: string,
    managingGroupId: string
  ): Promise<IScheduleTemplate[]> {
    try {
      console.log(`[CommonFillGeneration] Loading weekly templates with detailed analysis and client-side filtering`);
      console.log(`[CommonFillGeneration] Parameters: contractId=${contractId}, currentUserId=${currentUserId}, managingGroupId=${managingGroupId}, dayOfStartWeek=${dayOfStartWeek}`);
      
      const filteringDetails: string[] = [];
      
      // *** ШАГ 1: ПОЛУЧЕНИЕ ДАННЫХ С СЕРВЕРА (ЧАСТИЧНАЯ ФИЛЬТРАЦИЯ) ***
      filteringDetails.push('=== WEEKLY TEMPLATES LOADING PROCESS ===');
      filteringDetails.push(`Contract ID: ${contractId}`);
      filteringDetails.push(`Current User ID: ${currentUserId}`);
      filteringDetails.push(`Managing Group ID: ${managingGroupId}`);
      filteringDetails.push(`Day of Start Week: ${dayOfStartWeek}`);
      filteringDetails.push('');
      
      const weeklyTimeItems = await this.weeklyTimeTableService.getWeeklyTimeTableByContractId(contractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        console.log('[CommonFillGeneration] No weekly time items found from server');
        this.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, filteringDetails);
        return [];
      }

      filteringDetails.push(`STEP 1: Server Response Analysis`);
      filteringDetails.push(`Total items from server: ${weeklyTimeItems.length}`);
      filteringDetails.push(`Server filter applied: fields/IdOfTemplateLookupId eq ${contractId}`);
      filteringDetails.push('');

      // *** ШАГ 2: КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ПО МЕНЕДЖЕРУ ***
      console.log(`[CommonFillGeneration] Applying client-side CreatorLookupId filter: ${currentUserId}`);

      const afterManagerFilter = weeklyTimeItems.filter((item: IWeeklyTimeTableItem) => {
        const fields = item.fields || {};
        
        // ИСПРАВЛЕНО: используем CreatorLookupId вместо ManagerLookupId
        const creatorLookupId = fields.CreatorLookupId || fields.creatorId || fields.Creator;
        
        // Преобразуем в строку для сравнения
        const creatorIdStr = String(creatorLookupId || '0');
        const currentUserIdStr = String(currentUserId || '0');
        
        const matches = creatorIdStr === currentUserIdStr;
        
        if (!matches) {
          console.log(`[CommonFillGeneration] Filtered out item ID=${item.id}: CreatorLookupId=${creatorIdStr} !== currentUserId=${currentUserIdStr}`);
        }
        
        return matches;
      });

      filteringDetails.push(`STEP 2: Creator Filter Applied`);
      filteringDetails.push(`Filter: CreatorLookupId eq ${currentUserId}`);
      filteringDetails.push(`Items after creator filter: ${afterManagerFilter.length}`);
      filteringDetails.push(`Filtered out: ${weeklyTimeItems.length - afterManagerFilter.length} items`);
      filteringDetails.push('');

      console.log(`[CommonFillGeneration] After creator filter: ${afterManagerFilter.length} items (filtered out: ${weeklyTimeItems.length - afterManagerFilter.length})`);
      
      // *** ШАГ 3: КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ПО УДАЛЕННЫМ ЗАПИСЯМ ***
      console.log(`[CommonFillGeneration] Applying client-side Deleted filter`);
      
      const afterDeletedFilter = afterManagerFilter.filter((item: IWeeklyTimeTableItem) => {
        const fields = item.fields || {};
        const deleted = fields.Deleted || 0;
        
        // Проверяем что запись НЕ удалена (Deleted !== 1)
        const isNotDeleted = Number(deleted) !== 1;
        
        if (!isNotDeleted) {
          console.log(`[CommonFillGeneration] Filtered out deleted item ID=${item.id}: Deleted=${deleted}`);
        }
        
        return isNotDeleted;
      });

      filteringDetails.push(`STEP 3: Deleted Filter Applied`);
      filteringDetails.push(`Filter: Deleted ne 1`);
      filteringDetails.push(`Items after deleted filter: ${afterDeletedFilter.length}`);
      filteringDetails.push(`Filtered out: ${afterManagerFilter.length - afterDeletedFilter.length} deleted items`);
      filteringDetails.push('');

      console.log(`[CommonFillGeneration] After deleted filter: ${afterDeletedFilter.length} items (filtered out: ${afterManagerFilter.length - afterDeletedFilter.length})`);

      if (afterDeletedFilter.length === 0) {
        this.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, filteringDetails);
        return [];
      }

      // *** ШАГ 4: ПРЕОБРАЗОВАНИЕ В ШАБЛОНЫ С РЕАЛЬНЫМИ ПОЛЯМИ ВРЕМЕНИ ***
      console.log(`[CommonFillGeneration] Converting ${afterDeletedFilter.length} items to schedule templates with real time fields`);
      
      const scheduleTemplates: IScheduleTemplate[] = [];
      
      afterDeletedFilter.forEach((item: IWeeklyTimeTableItem, index: number) => {
        const fields = item.fields || {};
        
        console.log(`[CommonFillGeneration] Processing item ${index + 1}/${afterDeletedFilter.length}, ID=${item.id}`);
        console.log(`[CommonFillGeneration] Item fields:`, {
          NumberOfWeek: fields.NumberOfWeek,
          NumberOfShift: fields.NumberOfShift,
          TimeForLunch: fields.TimeForLunch,
          Deleted: fields.Deleted
        });
        
        const numberOfWeek = Number(fields.NumberOfWeek || 1);
        const numberOfShift = Number(fields.NumberOfShift || 1);
        const timeForLunch = Number(fields.TimeForLunch || 30);
        const deleted = Number(fields.Deleted || 0);
        
        // *** ИЗВЛЕКАЕМ ВРЕМЯ РАБОТЫ ДЛЯ КАЖДОГО ДНЯ НЕДЕЛИ ***
        const daysData = [
          { day: 1, name: 'Monday', startField: 'MondeyStartWork', endField: 'MondayEndWork' }, // ⚠️ Опечатка в SharePoint!
          { day: 2, name: 'Tuesday', startField: 'TuesdayStartWork', endField: 'TuesdayEndWork' },
          { day: 3, name: 'Wednesday', startField: 'WednesdayStartWork', endField: 'WednesdayEndWork' },
          { day: 4, name: 'Thursday', startField: 'ThursdayStartWork', endField: 'ThursdayEndWork' },
          { day: 5, name: 'Friday', startField: 'FridayStartWork', endField: 'FridayEndWork' },
          { day: 6, name: 'Saturday', startField: 'SaturdayStartWork', endField: 'SaturdayEndWork' },
          { day: 7, name: 'Sunday', startField: 'SundayStartWork', endField: 'SundayEndWork' }
        ];
        
        daysData.forEach(dayData => {
          const startTimeRaw = fields[dayData.startField as keyof typeof fields];
          const endTimeRaw = fields[dayData.endField as keyof typeof fields];
          
          if (startTimeRaw && endTimeRaw) {
            const startTime = this.parseTimeFromSharePoint(startTimeRaw);
            const endTime = this.parseTimeFromSharePoint(endTimeRaw);
            
            if (startTime && endTime) {
              const template: IScheduleTemplate = {
                id: String(item.id),
                contractId: contractId,
                NumberOfWeek: numberOfWeek,
                NumberOfShift: numberOfShift,
                dayOfWeek: dayData.day,
                dayName: dayData.name,
                startTime: startTime,
                endTime: endTime,
                lunchMinutes: timeForLunch,
                deleted: deleted
              };
              
              scheduleTemplates.push(template);
              
              console.log(`[CommonFillGeneration] Created template for ${dayData.name}: Week ${numberOfWeek}, Shift ${numberOfShift}, ${startTime}-${endTime}, Lunch: ${timeForLunch}min`);
            } else {
              console.log(`[CommonFillGeneration] Skipped ${dayData.name} - invalid time format: start="${startTimeRaw}", end="${endTimeRaw}"`);
            }
          } else {
            console.log(`[CommonFillGeneration] Skipped ${dayData.name} - no time data: start="${startTimeRaw}", end="${endTimeRaw}"`);
          }
        });
      });

      // *** ШАГ 5: ГРУППИРОВКА ШАБЛОНОВ ДЛЯ БЫСТРОГО ДОСТУПА ***
      const groupedTemplates = this.groupTemplatesByWeekAndDay(scheduleTemplates);

      // *** ШАГ 6: ДЕТАЛЬНЫЙ АНАЛИЗ ШАБЛОНОВ ***
      const contractName = this.contractsAnalysis?.selectedContract?.template || 'Unknown Contract';
      this.analyzeTemplates(
        contractId,
        contractName,
        weeklyTimeItems.length,
        afterManagerFilter.length,
        afterDeletedFilter.length,
        scheduleTemplates.length,
        dayOfStartWeek,
        scheduleTemplates,
        groupedTemplates,
        filteringDetails
      );

      // Сохраняем группированные шаблоны для использования в generateScheduleRecords
      (scheduleTemplates as IScheduleTemplate[] & { _groupedTemplates?: Map<string, IScheduleTemplate[]> })._groupedTemplates = groupedTemplates;

      console.log(`[CommonFillGeneration] Successfully loaded and processed ${scheduleTemplates.length} schedule templates`);
      return scheduleTemplates;
      
    } catch (error) {
      console.error('[CommonFillGeneration] Error loading weekly templates:', error);
      this.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, [`ERROR: ${error}`]);
      return [];
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Детальный анализ шаблонов ***
   */
  private analyzeTemplates(
    contractId: string,
    contractName: string,
    totalFromServer: number,
    afterManagerFilter: number,
    afterDeletedFilter: number,
    finalTemplatesCount: number,
    dayOfStartWeek: number,
    scheduleTemplates: IScheduleTemplate[],
    groupedTemplates: Map<string, IScheduleTemplate[]>,
    filteringDetails: string[]
  ): void {
    console.log('[CommonFillGeneration] Performing detailed templates analysis...');

    // Анализ недель и смен в расписании
    const weeksSet = new Set<number>();
    const shiftsSet = new Set<number>();

    scheduleTemplates.forEach(template => {
      weeksSet.add(template.NumberOfWeek);
      shiftsSet.add(template.NumberOfShift);
    });

    const weeksInSchedule = Array.from(weeksSet).sort();
    const shiftsAvailable = Array.from(shiftsSet).sort();
    const numberOfWeekTemplates = weeksInSchedule.length;

    // Финальные детали фильтрации
    filteringDetails.push(`STEP 4: Template Conversion Completed`);
    filteringDetails.push(`Final schedule templates: ${finalTemplatesCount}`);
    filteringDetails.push(`Weeks in schedule: [${weeksInSchedule.join(', ')}]`);
    filteringDetails.push(`Shifts available: [${shiftsAvailable.join(', ')}]`);
    filteringDetails.push(`Number of week templates: ${numberOfWeekTemplates}`);
    filteringDetails.push(`Week chaining logic: ${this.getWeekChainingDescription(numberOfWeekTemplates)}`);
    filteringDetails.push('');

    this.templatesAnalysis = {
      contractId: contractId,
      contractName: contractName,
      totalItemsFromServer: totalFromServer,
      afterManagerFilter: afterManagerFilter,
      afterDeletedFilter: afterDeletedFilter,
      finalTemplatesCount: finalTemplatesCount,
      weeksInSchedule: weeksInSchedule,
      shiftsAvailable: shiftsAvailable,
      numberOfWeekTemplates: numberOfWeekTemplates,
      dayOfStartWeek: dayOfStartWeek,
      weekStartDayName: this.getDayName(dayOfStartWeek),
      templatesByWeekAndDay: groupedTemplates,
      filteringDetails: filteringDetails
    };

    console.log('[CommonFillGeneration] Templates analysis completed:', {
      contract: this.templatesAnalysis.contractName,
      totalFromServer: this.templatesAnalysis.totalItemsFromServer,
      afterManagerFilter: this.templatesAnalysis.afterManagerFilter,
      afterDeletedFilter: this.templatesAnalysis.afterDeletedFilter,
      finalTemplates: this.templatesAnalysis.finalTemplatesCount,
      weeks: this.templatesAnalysis.weeksInSchedule,
      shifts: this.templatesAnalysis.shiftsAvailable,
      weekStart: this.templatesAnalysis.weekStartDayName
    });
  }

  /**
   * *** ПЕРЕПИСАННЫЙ МЕТОД: Группировка шаблонов для быстрого доступа ***
   */
  private groupTemplatesByWeekAndDay(templates: IScheduleTemplate[]): Map<string, IScheduleTemplate[]> {
    console.log(`[CommonFillGeneration] Grouping ${templates.length} templates by week, day AND shift`);
    
    const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();

    templates.forEach((template: IScheduleTemplate) => {
      const weekNumber = template.NumberOfWeek;
      const dayNumber = template.dayOfWeek;
      const shiftNumber = template.NumberOfShift;  // ← ДОБАВЛЯЕМ СМЕНУ В ГРУППИРОВКУ
      
      // *** НОВЫЙ КЛЮЧ: неделя-день-смена ***
      const key = `${weekNumber}-${dayNumber}-${shiftNumber}`;
      
      if (!templatesByWeekAndDay.has(key)) {
        templatesByWeekAndDay.set(key, []);
      }
      
      templatesByWeekAndDay.get(key)?.push(template);
      
      console.log(`[CommonFillGeneration] Grouped template: Week ${weekNumber}, Day ${dayNumber} (${template.dayName}), Shift ${shiftNumber}, Time: ${template.startTime}-${template.endTime}`);
    });

    console.log(`[CommonFillGeneration] Created ${templatesByWeekAndDay.size} template groups with shifts`);
    
    // *** ЛОГИРУЕМ СТРУКТУРУ ГРУПП ***
    templatesByWeekAndDay.forEach((templates, key) => {
      console.log(`[CommonFillGeneration] Group "${key}": ${templates.length} templates`);
    });
    
    return templatesByWeekAndDay;
  }
  /**
   * *** ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ МЕТОД: Генерирует записи с правильной логикой чередования недель и UTC ***
   * ИСПРАВЛЕНО: Теперь использует UTC для всех дат и async/await для timezone adjustment
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: IScheduleTemplate[]
  ): Promise<Partial<IStaffRecord>[]> {
    console.log(`[CommonFillGeneration] Generating schedule records with CORRECTED UTC logic and ALL shifts for ${params.staffMember.name}`);

    // *** ИСПРАВЛЕННЫЙ РАСЧЕТ ПЕРИОДА МЕСЯЦА С UTC ***
    const startOfMonth = new Date(Date.UTC(
      params.selectedDate.getUTCFullYear(), 
      params.selectedDate.getUTCMonth(), 
      1, 
      0, 0, 0, 0
    ));
    
    const endOfMonth = new Date(Date.UTC(
      params.selectedDate.getUTCFullYear(), 
      params.selectedDate.getUTCMonth() + 1, 
      0, 
      23, 59, 59, 999
    ));

    console.log(`[CommonFillGeneration] CORRECTED UTC Month period: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);

    const contractStartDate = contract.startDate;
    const contractFinishDate = contract.finishDate;

    // *** ИСПРАВЛЕННАЯ ЛОГИКА: ИСПОЛЬЗУЕМ ТОЧНЫЕ ГРАНИЦЫ МЕСЯЦА С UTC ***
    let firstDay: Date;
    if (contractStartDate && new Date(contractStartDate) > startOfMonth) {
      firstDay = new Date(Date.UTC(
        new Date(contractStartDate).getUTCFullYear(),
        new Date(contractStartDate).getUTCMonth(),
        new Date(contractStartDate).getUTCDate(),
        0, 0, 0, 0
      ));
    } else {
      firstDay = startOfMonth;
    }

    let lastDay: Date;
    if (contractFinishDate && new Date(contractFinishDate) < endOfMonth) {
      lastDay = new Date(Date.UTC(
        new Date(contractFinishDate).getUTCFullYear(),
        new Date(contractFinishDate).getUTCMonth(),
        new Date(contractFinishDate).getUTCDate(),
        23, 59, 59, 999
      ));
    } else {
      lastDay = endOfMonth;
    }

    console.log(`[CommonFillGeneration] CORRECTED UTC Generation period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);

    // *** ПРОВЕРЯЕМ КОЛИЧЕСТВО ДНЕЙ ***
    const totalDays = Math.floor((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    console.log(`[CommonFillGeneration] CORRECTED Total days in period: ${totalDays}`);

    this.initializeGenerationAnalysis(firstDay, lastDay);

    // Создаем кэши для быстрого поиска
    const holidayCache = this.createHolidayCache(holidays);
    const leavePeriods = this.createLeavePeriods(leaves);

    // *** ПОЛУЧАЕМ ГРУППИРОВАННЫЕ ШАБЛОНЫ И АНАЛИЗИРУЕМ ЛОГИКУ ЧЕРЕДОВАНИЯ ***
    const groupedTemplates = (weeklyTemplates as IScheduleTemplate[] & { _groupedTemplates?: Map<string, IScheduleTemplate[]> })._groupedTemplates;
    if (!groupedTemplates) {
      console.error('[CommonFillGeneration] No grouped templates found');
      return [];
    }

    // *** АНАЛИЗИРУЕМ ЛОГИКУ ЧЕРЕДОВАНИЯ НЕДЕЛЬ ***
    const numberOfWeekTemplates = this.templatesAnalysis?.numberOfWeekTemplates || 1;
    console.log(`[CommonFillGeneration] Week chaining analysis: ${numberOfWeekTemplates} week templates found`);
    console.log(`[CommonFillGeneration] Chaining logic: ${this.getWeekChainingDescription(numberOfWeekTemplates)}`);

    const records: Partial<IStaffRecord>[] = [];

    // *** ИСПРАВЛЕНО: Вычисляем общее количество дней и создаем массив дат заранее ***
    const totalDaysToProcess = Math.floor((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    console.log(`[CommonFillGeneration] Will process ${totalDaysToProcess} days from ${firstDay.toISOString()} to ${lastDay.toISOString()}`);

    // *** ОСНОВНОЙ ЦИКЛ ГЕНЕРАЦИИ ЗАПИСЕЙ С UTC ДАТАМИ ***
    for (let dayIndex = 0; dayIndex < totalDaysToProcess; dayIndex++) {
      // *** СОЗДАЕМ UTC ДАТУ ДЛЯ КАЖДОЙ ИТЕРАЦИИ ***
      const currentDate = new Date(Date.UTC(
        firstDay.getUTCFullYear(),
        firstDay.getUTCMonth(),
        firstDay.getUTCDate() + dayIndex,
        0, 0, 0, 0
      ));

      // *** ВЫЧИСЛЯЕМ НОМЕР НЕДЕЛИ С ИСПРАВЛЕННЫМ АЛГОРИТМОМ ***
      const weekAndDay = this.calculateWeekAndDayWithChaining(
        currentDate, 
        startOfMonth, 
        params.dayOfStartWeek || 7, 
        numberOfWeekTemplates
      );
      
      // *** ИЩЕМ ВСЕ ШАБЛОНЫ (ВСЕ СМЕНЫ) ДЛЯ ЭТОГО ДНЯ ***
      const templatesForDay = this.findTemplatesForDay(groupedTemplates, weekAndDay.templateWeekNumber, weekAndDay.dayNumber);
      
      // *** СОЗДАЕМ ИНФОРМАЦИЮ О ДНЕ ДЛЯ АНАЛИЗА ***
      const dayInfo: IDayGenerationInfo = {
        date: currentDate.toLocaleDateString(),
        weekNumber: weekAndDay.calendarWeekNumber,
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
        // *** СОЗДАЕМ ЗАПИСИ ДЛЯ ВСЕХ СМЕН КАК В SCHEDULETAB С UTC ***
        console.log(`[CommonFillGeneration] ${dayInfo.date} (${dayInfo.dayName}): Calendar week ${dayInfo.weekNumber}, Template week ${weekAndDay.templateWeekNumber}, Found ${templatesForDay.length} shifts`);
        
        // *** ОБРАБАТЫВАЕМ КАЖДЫЙ ШАБЛОН АСИНХРОННО С UTC ***
        for (const template of templatesForDay) {
          console.log(`[CommonFillGeneration] Creating record for shift ${template.NumberOfShift}: ${template.startTime}-${template.endTime}, Lunch: ${template.lunchMinutes}min`);
          
          // *** ИСПРАВЛЕНО: ИСПОЛЬЗУЕМ ASYNC createStaffRecordFromTemplate ***
          const record = await this.createStaffRecordFromTemplate(
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
        
        this.updateGenerationStats(weekAndDay.calendarWeekNumber, true);
      } else {
        dayInfo.skipReason = `No template found for week ${weekAndDay.templateWeekNumber}, day ${weekAndDay.dayNumber} combination`;
        console.log(`[CommonFillGeneration] ${dayInfo.date} (${dayInfo.dayName}): Calendar week ${dayInfo.weekNumber}, Template week ${weekAndDay.templateWeekNumber}, Day ${dayInfo.dayNumber} - ${dayInfo.skipReason}`);
        this.updateGenerationStats(weekAndDay.calendarWeekNumber, false);
      }

      // Добавляем информацию о дне в анализ
      this.generationAnalysis?.dailyInfo.push(dayInfo);
    }

    // *** ЗАВЕРШАЕМ АНАЛИЗ ГЕНЕРАЦИИ ***
    this.finalizeGenerationAnalysis(records.length, holidays.length, leaves.length);

    console.log(`[CommonFillGeneration] CORRECTED: Generated ${records.length} schedule records (including ALL shifts) with proper UTC week chaining logic`);
    return records;
  }

  /**
   * *** НОВЫЙ МЕТОД: Вычисляет номер недели и день с учетом логики чередования ***
   */
  private calculateWeekAndDayWithChaining(
    date: Date, 
    startOfMonth: Date, 
    dayOfStartWeek: number, 
    numberOfWeekTemplates: number
  ): { 
    calendarWeekNumber: number; 
    templateWeekNumber: number; 
    dayNumber: number 
  } {
    console.log(`[CommonFillGeneration] *** CALCULATING WEEK AND DAY FOR ${date.toISOString()} ***`);
    console.log(`[CommonFillGeneration] Input parameters: dayOfStartWeek=${dayOfStartWeek}, numberOfWeekTemplates=${numberOfWeekTemplates}`);
    
    // *** 1. ПОЛУЧАЕМ СТАНДАРТНЫЙ ДЕНЬ НЕДЕЛИ ИЗ JAVASCRIPT (UTC) ***
    const jsDay = date.getUTCDay(); // 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    console.log(`[CommonFillGeneration] JavaScript UTC day: ${jsDay} (${this.getDayName(jsDay)})`);
    
    // *** 2. ПРЕОБРАЗУЕМ В НУЖНУЮ НУМЕРАЦИЮ В ЗАВИСИМОСТИ ОТ dayOfStartWeek ***
    let dayNumber: number;
    
    if (dayOfStartWeek === 2) {
      // *** ПОНЕДЕЛЬНИК = НАЧАЛО НЕДЕЛИ (1=Monday, 2=Tuesday, ..., 7=Sunday) ***
      dayNumber = jsDay === 0 ? 7 : jsDay; // Воскресенье становится 7, остальные без изменений
      console.log(`[CommonFillGeneration] Monday-based week: ${jsDay} → ${dayNumber}`);
    } else if (dayOfStartWeek === 7) {
      // *** СУББОТА = НАЧАЛО НЕДЕЛИ (1=Saturday, 2=Sunday, ..., 7=Friday) ***
      dayNumber = (jsDay + 2) % 7;
      if (dayNumber === 0) dayNumber = 7;
      console.log(`[CommonFillGeneration] Saturday-based week: ${jsDay} → ${dayNumber}`);
    } else {
      // *** ВОСКРЕСЕНЬЕ = НАЧАЛО НЕДЕЛИ (стандартная JS логика) ***
      dayNumber = jsDay;
      console.log(`[CommonFillGeneration] Sunday-based week: ${jsDay} → ${dayNumber}`);
    }
    
    // *** 3. ВЫЧИСЛЯЕМ КАЛЕНДАРНУЮ НЕДЕЛЮ МЕСЯЦА С UTC ***
    const dayOfMonth = date.getUTCDate();
    const firstDayOfMonth = new Date(Date.UTC(startOfMonth.getUTCFullYear(), startOfMonth.getUTCMonth(), 1, 0, 0, 0, 0));
    const firstDayJS = firstDayOfMonth.getUTCDay(); // JavaScript день недели первого дня месяца в UTC
    
    console.log(`[CommonFillGeneration] Month calculation: dayOfMonth=${dayOfMonth}, firstDayJS=${firstDayJS}`);
    
    // Корректируем первый день месяца в зависимости от dayOfStartWeek
    let adjustedFirstDay: number;
    
    if (dayOfStartWeek === 2) {
      // Понедельник = начало недели
      adjustedFirstDay = firstDayJS === 0 ? 6 : firstDayJS - 1; // Sunday=6, Monday=0, Tuesday=1, etc.
    } else if (dayOfStartWeek === 7) {
      // Суббота = начало недели
      adjustedFirstDay = (firstDayJS + 1) % 7; // Saturday=0, Sunday=1, Monday=2, etc.
    } else {
      // Воскресенье = начало недели (стандартная JS логика)
      adjustedFirstDay = firstDayJS;
    }
    
    const calendarWeekNumber = Math.floor((dayOfMonth - 1 + adjustedFirstDay) / 7) + 1;
    
    console.log(`[CommonFillGeneration] Week calculation: adjustedFirstDay=${adjustedFirstDay} → calendarWeekNumber=${calendarWeekNumber}`);
    
    // *** 4. ВЫЧИСЛЯЕМ НОМЕР НЕДЕЛИ ШАБЛОНА С УЧЕТОМ ЧЕРЕДОВАНИЯ ***
    let templateWeekNumber: number;
    
    switch (numberOfWeekTemplates) {
      case 1:
        templateWeekNumber = 1;
        console.log(`[CommonFillGeneration] Single week template: templateWeekNumber=1`);
        break;
      case 2:
        templateWeekNumber = (calendarWeekNumber - 1) % 2 + 1;
        console.log(`[CommonFillGeneration] Two week alternating: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
      case 3:
        templateWeekNumber = (calendarWeekNumber - 1) % 3 + 1;
        console.log(`[CommonFillGeneration] Three week cycle: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
      case 4:
        templateWeekNumber = Math.min(calendarWeekNumber, 4);
        console.log(`[CommonFillGeneration] Four week cycle: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
      default:
        templateWeekNumber = (calendarWeekNumber - 1) % numberOfWeekTemplates + 1;
        console.log(`[CommonFillGeneration] Custom ${numberOfWeekTemplates} week cycle: week ${calendarWeekNumber} → template ${templateWeekNumber}`);
        break;
    }
    
    // *** 5. ФИНАЛЬНАЯ ПРОВЕРКА И ЛОГИРОВАНИЕ ***
    const dayName = this.getDayName(dayNumber);
    console.log(`[CommonFillGeneration] *** FINAL RESULT FOR ${date.toISOString()} ***`);
    console.log(`[CommonFillGeneration] - Calendar week: ${calendarWeekNumber}`);
    console.log(`[CommonFillGeneration] - Template week: ${templateWeekNumber}`);
    console.log(`[CommonFillGeneration] - Day number: ${dayNumber}`);
    console.log(`[CommonFillGeneration] - Day name: ${dayName}`);
    console.log(`[CommonFillGeneration] - Expected day name: ${date.toLocaleDateString('en-US', { weekday: 'long' })}`);
    
    // *** ДОПОЛНИТЕЛЬНАЯ ПРОВЕРКА КОРРЕКТНОСТИ ***
    const expectedDayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    if (dayName !== expectedDayName) {
      console.error(`[CommonFillGeneration] *** DAY NAME MISMATCH *** Got: ${dayName}, Expected: ${expectedDayName}`);
    }
    
    return { 
      calendarWeekNumber, 
      templateWeekNumber, 
      dayNumber 
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Находит шаблоны для конкретной недели и дня ***
   */
  private findTemplatesForDay(
    groupedTemplates: Map<string, IScheduleTemplate[]>, 
    templateWeekNumber: number, 
    dayNumber: number
  ): IScheduleTemplate[] {
    const allTemplatesForDay: IScheduleTemplate[] = [];
    
    console.log(`[CommonFillGeneration] Looking for ALL shifts for week ${templateWeekNumber}, day ${dayNumber}`);
    
    // *** ПОИСК ВСЕХ СМЕН ДЛЯ ЭТОГО ДНЯ ***
    groupedTemplates.forEach((templates, key) => {
      const [week, day, shift] = key.split('-').map(Number);
      
      if (week === templateWeekNumber && day === dayNumber) {
        console.log(`[CommonFillGeneration] Found shift ${shift} for week ${week}, day ${day}: ${templates.length} templates`);
        allTemplatesForDay.push(...templates);
      }
    });
    
    // *** FALLBACK: если не найдено, пробуем неделю 1 ***
    if (allTemplatesForDay.length === 0 && templateWeekNumber !== 1) {
      console.log(`[CommonFillGeneration] No templates found for week ${templateWeekNumber}, day ${dayNumber} - trying fallback to week 1`);
      
      groupedTemplates.forEach((templates, key) => {
        const [week, day, shift] = key.split('-').map(Number);
        
        if (week === 1 && day === dayNumber) {
          console.log(`[CommonFillGeneration] Fallback: found shift ${shift} for week 1, day ${day}: ${templates.length} templates`);
          allTemplatesForDay.push(...templates);
        }
      });
    }
    
    // *** СОРТИРУЕМ ПО НОМЕРУ СМЕНЫ ***
    allTemplatesForDay.sort((a, b) => a.NumberOfShift - b.NumberOfShift);
    
    console.log(`[CommonFillGeneration] Total templates found for week ${templateWeekNumber}, day ${dayNumber}: ${allTemplatesForDay.length} (shifts: ${allTemplatesForDay.map(t => t.NumberOfShift).join(', ')})`);
    
    return allTemplatesForDay;
  }

  /**
   * *** ИСПРАВЛЕННЫЙ МЕТОД: Создает запись расписания из шаблона с UTC ***
   */
  private async createStaffRecordFromTemplate(
    date: Date,
    template: IScheduleTemplate,
    contract: IContract,
    params: IFillParams,
    holidayCache: Map<string, IHoliday>,
    leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>
  ): Promise<Partial<IStaffRecord>> {
    const dateKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    
    // Проверяем, является ли день праздником
    const isHoliday = holidayCache.has(dateKey);
    
    // Проверяем, находится ли сотрудник в отпуске в этот день
    const leaveForDay = leavePeriods.find(leave => 
      date >= leave.startDate && date <= leave.endDate
    );
    const isLeave = !!leaveForDay;

    // *** ИСПРАВЛЕНО: Парсим время из шаблона и создаем UTC даты с timezone adjustment ***
    const startTime = this.parseTimeString(template.startTime);
    const endTime = this.parseTimeString(template.endTime);
    const lunchTime = template.lunchMinutes;

    console.log(`[CommonFillGeneration] Creating record for ${date.toISOString()}: Shift ${template.NumberOfShift}, ${template.startTime}-${template.endTime}, lunch: ${lunchTime}min, holiday: ${isHoliday}, leave: ${isLeave}`);

    // *** ИСПРАВЛЕНО: Используем async createDateWithTime с timezone adjustment ***
    const shiftDate1 = await this.createDateWithTime(date, startTime);
    const shiftDate2 = await this.createDateWithTime(date, endTime);

    console.log(`[CommonFillGeneration] *** UTC SHIFT TIMES CREATED ***`);
    console.log(`[CommonFillGeneration] ShiftDate1 (start): ${shiftDate1.toISOString()}`);
    console.log(`[CommonFillGeneration] ShiftDate2 (end): ${shiftDate2.toISOString()}`);

    const record: Partial<IStaffRecord> = {
      Title: `Template=${contract.id} Week=${template.NumberOfWeek} Shift=${template.NumberOfShift}`,
      Date: new Date(date), // *** UTC дата ***
      ShiftDate1: shiftDate1, // *** UTC время с timezone adjustment ***
      ShiftDate2: shiftDate2, // *** UTC время с timezone adjustment ***
      TimeForLunch: lunchTime,
      Contract: template.NumberOfShift,  // *** ИСПРАВЛЕНО: используем номер смены вместо total ***
      Holiday: isHoliday ? 1 : 0,
      WeeklyTimeTableID: contract.id,
      WeeklyTimeTableTitle: contract.template || '',
      Checked: 0,
      Deleted: 0
    };

    // Добавляем тип отпуска если сотрудник в отпуске
    if (isLeave && leaveForDay) {
      record.TypeOfLeaveID = leaveForDay.typeOfLeave;
      console.log(`[CommonFillGeneration] Added leave type ${record.TypeOfLeaveID} for ${date.toISOString()}: ${leaveForDay.title}`);
    }

    return record;
  }

  /**
   * *** НОВЫЙ МЕТОД: Парсит строку времени в часы и минуты ***
   */
  private parseTimeString(timeStr: string): { hours: string; minutes: string } {
    try {
      const parts = timeStr.split(':');
      const hours = parts[0] || '9';
      const minutes = parts.length > 1 ? parts[1] : '0';
      
      return {
        hours: hours.padStart(2, '0'),
        minutes: minutes.padStart(2, '0')
      };
    } catch (error) {
      console.error(`[CommonFillGeneration] Error parsing time string "${timeStr}":`, error);
      return { hours: '09', minutes: '00' };
    }
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
   * *** ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ДЛЯ АНАЛИЗА ***
   */
  private isHoliday(date: Date, holidayCache: Map<string, IHoliday>): boolean {
    const dateKey = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
    return holidayCache.has(dateKey);
  }

  private isLeave(date: Date, leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>): boolean {
    return leavePeriods.some(leave => date >= leave.startDate && date <= leave.endDate);
  }

  private getLeaveForDay(date: Date, leavePeriods: Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}>): {typeOfLeave: string, title: string} | undefined {
    return leavePeriods.find(leave => date >= leave.startDate && date <= leave.endDate);
  }

  /**
   * *** НОВЫЙ МЕТОД: Создает кэш праздников для быстрого поиска с UTC ***
   */
  private createHolidayCache(holidays: IHoliday[]): Map<string, IHoliday> {
    const cache = new Map<string, IHoliday>();
    holidays.forEach((holiday: IHoliday) => {
      const date = new Date(holiday.date);
      // *** ИСПРАВЛЕНО: Используем UTC методы ***
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
      cache.set(key, holiday);
    });
    console.log(`[CommonFillGeneration] Created holiday cache with ${cache.size} entries using UTC`);
    return cache;
  }

  /**
   * *** НОВЫЙ МЕТОД: Создает массив периодов отпусков для быстрой проверки ***
   */
  private createLeavePeriods(leaves: ILeaveDay[]): Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}> {
    // *** FILTER OUT DELETED LEAVES FOR DASHBOARD TAB ***
    const activeLeaves = leaves.filter(leave => {
      const isDeleted = leave.deleted === true;
      if (isDeleted) {
        console.log(`[CommonFillGeneration] Filtering out deleted leave: ${leave.title} (${new Date(leave.startDate).toLocaleDateString()} - ${leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'ongoing'})`);
      }
      return !isDeleted;
    });
    
    const leavePeriods = activeLeaves.map((leave: ILeaveDay) => ({
      startDate: new Date(leave.startDate),
      endDate: leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31),
      typeOfLeave: leave.typeOfLeave.toString(),
      title: leave.title || ''
    }));
    
    console.log(`[CommonFillGeneration] Created leave periods cache with ${leavePeriods.length} entries from ${leaves.length} total`);
    return leavePeriods;
  }

  /**
   * *** ОБНОВЛЕННЫЙ МЕТОД: Сохраняет сгенерированные записи в SharePoint ***
   */
  public async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<number> {
    console.log(`[CommonFillGeneration] Saving ${records.length} generated records with UTC timezone handling`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillGeneration] Saving record ${i + 1}/${records.length} for ${record.Date?.toISOString()}`);
        
        const employeeId = params.staffMember.employeeId;
        const managerId = params.currentUserId;
        const staffGroupId = params.managingGroupId;
        
        if (!employeeId || employeeId === '0' || employeeId.trim() === '') {
          const errorMsg = `Missing or invalid employeeId for record ${i + 1}: "${employeeId}"`;
          errors.push(errorMsg);
          console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
          continue;
        }
        
        // *** ЛОГИРУЕМ UTC ВРЕМЕНА ПЕРЕД СОХРАНЕНИЕМ ***
        if (record.ShiftDate1 && record.ShiftDate2) {
          console.log(`[CommonFillGeneration] *** UTC TIMES BEING SAVED ***`);
          console.log(`[CommonFillGeneration] Date: ${record.Date?.toISOString()}`);
          console.log(`[CommonFillGeneration] ShiftDate1: ${record.ShiftDate1.toISOString()}`);
          console.log(`[CommonFillGeneration] ShiftDate2: ${record.ShiftDate2.toISOString()}`);
          console.log(`[CommonFillGeneration] Local representation - Start: ${record.ShiftDate1.toLocaleString()}`);
          console.log(`[CommonFillGeneration] Local representation - End: ${record.ShiftDate2.toLocaleString()}`);
        }
        
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,
          managerId || '0',
          staffGroupId || '0',
          employeeId
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillGeneration] ✓ Created record ID=${newRecordId} for ${record.Date?.toISOString()}`);
          
          if (record.TypeOfLeaveID) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created with leave type: ${record.TypeOfLeaveID}`);
          }
          if (record.Holiday === 1) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created for holiday`);
          }
          
          if (record.ShiftDate1 && record.ShiftDate2) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} saved with UTC times - no timezone shift should occur`);
          }
        } else {
          const errorMsg = `Failed to create record for ${record.Date?.toISOString()}: No ID returned`;
          errors.push(errorMsg);
          console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = `Error creating record ${i + 1} for ${record.Date?.toISOString()}: ${error}`;
        errors.push(errorMsg);
        console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
      }

      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[CommonFillGeneration] Save operation completed with UTC handling: ${successCount}/${records.length} successful`);
    
    if (errors.length > 0) {
      console.error(`[CommonFillGeneration] Save errors (${errors.length}):`, errors);
    }

    return successCount;
  }
}