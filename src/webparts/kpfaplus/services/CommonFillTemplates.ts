// src/webparts/kpfaplus/services/CommonFillTemplates.ts
// TEMPLATE PROCESSING: All template loading, formatting, and grouping logic
// COMPLETE IMPLEMENTATION: Schedule Tab compatibility with Date-only support

import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { WeeklyTimeTableUtils, IFormattedWeeklyTimeRow } from '../models/IWeeklyTimeTable';
import { 
  IScheduleTemplate,
  IWeeklyTimeTableItem,
  FILL_CONSTANTS
} from './CommonFillTypes';
import { CommonFillAnalysis } from './CommonFillAnalysis';
import { CommonFillDateUtils } from './CommonFillDateUtils';

export class CommonFillTemplates {
  private weeklyTimeTableService: WeeklyTimeTableService;
  private analysis: CommonFillAnalysis;
  private dateUtils: CommonFillDateUtils;

  constructor(
    weeklyTimeTableService: WeeklyTimeTableService,
    analysis: CommonFillAnalysis,
    dateUtils: CommonFillDateUtils
  ) {
    this.weeklyTimeTableService = weeklyTimeTableService;
    this.analysis = analysis;
    this.dateUtils = dateUtils;
    console.log('[CommonFillTemplates] Template processor initialized with Schedule Tab formatting');
  }

  // *** PUBLIC API METHODS ***

  /**
   * Загружает шаблоны с Schedule Tab форматированием
   */
  public async loadWeeklyTemplates(
    contractId: string, 
    dayOfStartWeek: number,
    currentUserId: string,
    managingGroupId: string
  ): Promise<IScheduleTemplate[]> {
    try {
      console.log(`[CommonFillTemplates] *** USING SCHEDULE TAB FORMATTING APPROACH ***`);
      console.log(`[CommonFillTemplates] Loading weekly templates with Schedule Tab formatting`);
      console.log(`[CommonFillTemplates] Parameters: contractId=${contractId}, currentUserId=${currentUserId}, managingGroupId=${managingGroupId}, dayOfStartWeek=${dayOfStartWeek}`);
      
      const filteringDetails: string[] = [];
      
      // *** ШАГ 1: ПОЛУЧЕНИЕ ДАННЫХ С СЕРВЕРА ***
      filteringDetails.push('=== WEEKLY TEMPLATES LOADING WITH SCHEDULE TAB APPROACH ===');
      filteringDetails.push(`Contract ID: ${contractId}`);
      filteringDetails.push(`Current User ID: ${currentUserId}`);
      filteringDetails.push(`Managing Group ID: ${managingGroupId}`);
      filteringDetails.push(`Day of Start Week: ${dayOfStartWeek}`);
      filteringDetails.push('');
      
      const weeklyTimeItems = await this.weeklyTimeTableService.getWeeklyTimeTableByContractId(contractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        console.log('[CommonFillTemplates] No weekly time items found from server');
        this.analysis.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, filteringDetails);
        return [];
      }

      filteringDetails.push(`STEP 1: Server Response Analysis`);
      filteringDetails.push(`Total items from server: ${weeklyTimeItems.length}`);
      filteringDetails.push(`Server filter applied: fields/IdOfTemplateLookupId eq ${contractId}`);
      filteringDetails.push('');

      // *** ШАГ 2: КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ПО МЕНЕДЖЕРУ ***
      console.log(`[CommonFillTemplates] Applying client-side CreatorLookupId filter: ${currentUserId}`);

      const afterManagerFilter = this.filterByCreator(weeklyTimeItems, currentUserId);

      filteringDetails.push(`STEP 2: Creator Filter Applied`);
      filteringDetails.push(`Filter: CreatorLookupId eq ${currentUserId}`);
      filteringDetails.push(`Items after creator filter: ${afterManagerFilter.length}`);
      filteringDetails.push(`Filtered out: ${weeklyTimeItems.length - afterManagerFilter.length} items`);
      filteringDetails.push('');

      console.log(`[CommonFillTemplates] After creator filter: ${afterManagerFilter.length} items (filtered out: ${weeklyTimeItems.length - afterManagerFilter.length})`);
      
      // *** ШАГ 3: КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ПО УДАЛЕННЫМ ЗАПИСЯМ ***
      console.log(`[CommonFillTemplates] Applying client-side Deleted filter`);
      
      const afterDeletedFilter = this.filterDeleted(afterManagerFilter);

      filteringDetails.push(`STEP 3: Deleted Filter Applied`);
      filteringDetails.push(`Filter: Deleted ne 1`);
      filteringDetails.push(`Items after deleted filter: ${afterDeletedFilter.length}`);
      filteringDetails.push(`Filtered out: ${afterManagerFilter.length - afterDeletedFilter.length} deleted items`);
      filteringDetails.push('');

      console.log(`[CommonFillTemplates] After deleted filter: ${afterDeletedFilter.length} items (filtered out: ${afterManagerFilter.length - afterDeletedFilter.length})`);

      if (afterDeletedFilter.length === 0) {
        this.analysis.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, filteringDetails);
        return [];
      }

      // *** ШАГ 4: ИСПОЛЬЗУЕМ SCHEDULE TAB ФОРМАТИРОВАНИЕ ***
      console.log(`[CommonFillTemplates] *** APPLYING SCHEDULE TAB FORMATTING ***`);
      console.log(`[CommonFillTemplates] Using WeeklyTimeTableUtils.formatWeeklyTimeTableData() like Schedule Tab`);
      
      const formattedTemplates = this.applyScheduleTabFormatting(afterDeletedFilter, dayOfStartWeek);
      
      console.log(`[CommonFillTemplates] *** SCHEDULE TAB FORMATTING APPLIED ***`);
      console.log(`[CommonFillTemplates] Formatted templates count: ${formattedTemplates.length}`);

      // *** ШАГ 5: КОНВЕРТИРУЕМ В SCHEDULE TEMPLATES ***
      const scheduleTemplates = this.convertToScheduleTemplates(formattedTemplates, contractId);

      // *** ШАГ 6: ГРУППИРОВКА ШАБЛОНОВ ДЛЯ БЫСТРОГО ДОСТУПА ***
      const groupedTemplates = this.groupTemplatesByWeekAndDay(scheduleTemplates);

      // *** ШАГ 7: ДЕТАЛЬНЫЙ АНАЛИЗ ШАБЛОНОВ ***
      const contractName = this.analysis.getContractsAnalysis()?.selectedContract?.template || 'Unknown Contract';
      this.analysis.analyzeTemplates(
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

      console.log(`[CommonFillTemplates] *** SCHEDULE TAB FORMATTING COMPLETED ***`);
      console.log(`[CommonFillTemplates] Successfully processed ${scheduleTemplates.length} schedule templates with Schedule Tab formatting`);
      return scheduleTemplates;
      
    } catch (error) {
      console.error('[CommonFillTemplates] Error loading weekly templates with Schedule Tab formatting:', error);
      this.analysis.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, [`ERROR: ${error}`]);
      return [];
    }
  }

  /**
   * Группирует шаблоны для быстрого доступа
   */
  public groupTemplatesByWeekAndDay(templates: IScheduleTemplate[]): Map<string, IScheduleTemplate[]> {
    console.log(`[CommonFillTemplates] Grouping ${templates.length} templates by week, day AND shift`);
    
    const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();

    templates.forEach((template: IScheduleTemplate) => {
      const weekNumber = template.NumberOfWeek;
      const dayNumber = template.dayOfWeek;
      const shiftNumber = template.NumberOfShift;
      
      // *** КЛЮЧ: неделя-день-смена ***
      const key = `${weekNumber}-${dayNumber}-${shiftNumber}`;
      
      if (!templatesByWeekAndDay.has(key)) {
        templatesByWeekAndDay.set(key, []);
      }
      
      templatesByWeekAndDay.get(key)?.push(template);
      
      console.log(`[CommonFillTemplates] Grouped template: Week ${weekNumber}, Day ${dayNumber} (${template.dayName}), Shift ${shiftNumber}, Time: ${template.startTime}-${template.endTime}`);
    });

    console.log(`[CommonFillTemplates] Created ${templatesByWeekAndDay.size} template groups with shifts`);
    
    // *** ЛОГИРУЕМ СТРУКТУРУ ГРУПП ***
    templatesByWeekAndDay.forEach((templates, key) => {
      console.log(`[CommonFillTemplates] Group "${key}": ${templates.length} templates`);
    });
    
    return templatesByWeekAndDay;
  }

  /**
   * Находит шаблоны для конкретной недели и дня
   */
  public findTemplatesForDay(
    groupedTemplates: Map<string, IScheduleTemplate[]>, 
    templateWeekNumber: number, 
    dayNumber: number
  ): IScheduleTemplate[] {
    const allTemplatesForDay: IScheduleTemplate[] = [];
    
    console.log(`[CommonFillTemplates] Looking for ALL shifts for week ${templateWeekNumber}, day ${dayNumber}`);
    
    // *** ПОИСК ВСЕХ СМЕН ДЛЯ ЭТОГО ДНЯ ***
    groupedTemplates.forEach((templates, key) => {
      const [week, day, shift] = key.split('-').map(Number);
      
      if (week === templateWeekNumber && day === dayNumber) {
        console.log(`[CommonFillTemplates] Found shift ${shift} for week ${week}, day ${day}: ${templates.length} templates`);
        allTemplatesForDay.push(...templates);
      }
    });
    
    // *** FALLBACK: если не найдено, пробуем неделю 1 ***
    if (allTemplatesForDay.length === 0 && templateWeekNumber !== 1) {
      console.log(`[CommonFillTemplates] No templates found for week ${templateWeekNumber}, day ${dayNumber} - trying fallback to week 1`);
      
      groupedTemplates.forEach((templates, key) => {
        const [week, day, shift] = key.split('-').map(Number);
        
        if (week === 1 && day === dayNumber) {
          console.log(`[CommonFillTemplates] Fallback: found shift ${shift} for week 1, day ${day}: ${templates.length} templates`);
          allTemplatesForDay.push(...templates);
        }
      });
    }
    
    // *** СОРТИРУЕМ ПО НОМЕРУ СМЕНЫ ***
    allTemplatesForDay.sort((a, b) => a.NumberOfShift - b.NumberOfShift);
    
    console.log(`[CommonFillTemplates] Total templates found for week ${templateWeekNumber}, day ${dayNumber}: ${allTemplatesForDay.length} (shifts: ${allTemplatesForDay.map(t => t.NumberOfShift).join(', ')})`);
    
    return allTemplatesForDay;
  }

  /**
   * Получает статистику шаблонов
   */
  public getTemplatesStats(): {
    totalTemplates: number;
    weekCount: number;
    shiftCount: number;
    daysCovered: number;
  } {
    const templatesAnalysis = this.analysis.getTemplatesAnalysis();
    
    if (!templatesAnalysis) {
      return {
        totalTemplates: 0,
        weekCount: 0,
        shiftCount: 0,
        daysCovered: 0
      };
    }

    const daysCovered = new Set<number>();
    templatesAnalysis.templatesByWeekAndDay.forEach((templates, key) => {
      const [, day] = key.split('-').map(Number);
      daysCovered.add(day);
    });

    return {
      totalTemplates: templatesAnalysis.finalTemplatesCount,
      weekCount: templatesAnalysis.numberOfWeekTemplates,
      shiftCount: templatesAnalysis.shiftsAvailable.length,
      daysCovered: daysCovered.size
    };
  }

  // *** PRIVATE METHODS ***

  /**
   * Фильтрует элементы по создателю
   */
  private filterByCreator(items: IWeeklyTimeTableItem[], currentUserId: string): IWeeklyTimeTableItem[] {
    return items.filter((item: IWeeklyTimeTableItem) => {
      const fields = item.fields || {};
      
      const creatorLookupId = fields.CreatorLookupId || fields.creatorId || fields.Creator;
      
      const creatorIdStr = String(creatorLookupId || '0');
      const currentUserIdStr = String(currentUserId || '0');
      
      const matches = creatorIdStr === currentUserIdStr;
      
      if (!matches) {
        console.log(`[CommonFillTemplates] Filtered out item ID=${item.id}: CreatorLookupId=${creatorIdStr} !== currentUserId=${currentUserIdStr}`);
      }
      
      return matches;
    });
  }

  /**
   * Фильтрует удаленные элементы
   */
  private filterDeleted(items: IWeeklyTimeTableItem[]): IWeeklyTimeTableItem[] {
    return items.filter((item: IWeeklyTimeTableItem) => {
      const fields = item.fields || {};
      const deleted = fields.Deleted || 0;
      
      const isNotDeleted = Number(deleted) !== FILL_CONSTANTS.FLAGS.DELETED;
      
      if (!isNotDeleted) {
        console.log(`[CommonFillTemplates] Filtered out deleted item ID=${item.id}: Deleted=${deleted}`);
      }
      
      return isNotDeleted;
    });
  }

  /**
   * Применяет Schedule Tab форматирование
   */
  private applyScheduleTabFormatting(
    items: IWeeklyTimeTableItem[], 
    dayOfStartWeek: number
  ): IFormattedWeeklyTimeRow[] {
    // ИСПРАВЛЕНО: Используем тот же метод что и Schedule Tab
    // Приводим тип для совместимости с WeeklyTimeTableUtils
    const compatibleItems = items.map(item => ({
      ...item,
      // Добавляем индексную сигнатуру для совместимости
      ...(item.fields || {})
    })) as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    
    const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(compatibleItems, dayOfStartWeek);
    
    if (formattedTemplates && formattedTemplates.length > 0) {
      const firstTemplate = formattedTemplates[0];
      console.log(`[CommonFillTemplates] *** SCHEDULE TAB TIME FORMAT EXAMPLE ***`);
      console.log(`[CommonFillTemplates] Monday: start=${firstTemplate.monday.start.hours}:${firstTemplate.monday.start.minutes}, end=${firstTemplate.monday.end.hours}:${firstTemplate.monday.end.minutes}`);
      console.log(`[CommonFillTemplates] Tuesday: start=${firstTemplate.tuesday.start.hours}:${firstTemplate.tuesday.start.minutes}, end=${firstTemplate.tuesday.end.hours}:${firstTemplate.tuesday.end.minutes}`);
    }

    return formattedTemplates;
  }

  /**
   * Конвертирует форматированные шаблоны в IScheduleTemplate[]
   */
  private convertToScheduleTemplates(
    formattedTemplates: IFormattedWeeklyTimeRow[], 
    contractId: string
  ): IScheduleTemplate[] {
    const scheduleTemplates: IScheduleTemplate[] = [];
    
    formattedTemplates.forEach((formattedTemplate: IFormattedWeeklyTimeRow) => {
      const numberOfWeek = formattedTemplate.NumberOfWeek || 1;
      const numberOfShift = formattedTemplate.NumberOfShift || 1;
      const timeForLunch = parseInt(formattedTemplate.lunch || '30', 10);
      
      // *** ОБРАБАТЫВАЕМ КАЖДЫЙ ДЕНЬ НЕДЕЛИ ***
      const daysData = [
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.MONDAY, name: 'Monday', dayData: formattedTemplate.monday },
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.TUESDAY, name: 'Tuesday', dayData: formattedTemplate.tuesday },
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.WEDNESDAY, name: 'Wednesday', dayData: formattedTemplate.wednesday },
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.THURSDAY, name: 'Thursday', dayData: formattedTemplate.thursday },
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.FRIDAY, name: 'Friday', dayData: formattedTemplate.friday },
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.SATURDAY, name: 'Saturday', dayData: formattedTemplate.saturday },
        { day: FILL_CONSTANTS.SHAREPOINT_DAYS.SUNDAY, name: 'Sunday', dayData: formattedTemplate.sunday }
      ];
      
      daysData.forEach(dayInfo => {
        const dayData = dayInfo.dayData;
        
        // *** ИСПРАВЛЕНО: Проверяем только наличие данных времени, НЕ исключаем 00:00-00:00 ***
        // 00:00-00:00 это валидное время для выходных дней или дней без работы
        if (dayData.start && dayData.end && 
            dayData.start.hours !== undefined && dayData.end.hours !== undefined) {
          
          const startTime = `${dayData.start.hours}:${dayData.start.minutes}`;
          const endTime = `${dayData.end.hours}:${dayData.end.minutes}`;
          
          const template: IScheduleTemplate = {
            id: String(formattedTemplate.id),
            contractId: contractId,
            NumberOfWeek: numberOfWeek,
            NumberOfShift: numberOfShift,
            dayOfWeek: dayInfo.day,
            dayName: dayInfo.name,
            startTime: startTime,
            endTime: endTime,
            lunchMinutes: timeForLunch,
            deleted: FILL_CONSTANTS.FLAGS.NOT_DELETED
          };
          
          scheduleTemplates.push(template);
          
          console.log(`[CommonFillTemplates] *** SCHEDULE TAB FORMATTED TEMPLATE ***`);
          console.log(`[CommonFillTemplates] ${dayInfo.name}: Week ${numberOfWeek}, Shift ${numberOfShift}, ${startTime}-${endTime}, Lunch: ${timeForLunch}min`);
          
          // *** ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ДЛЯ 00:00-00:00 ДНЕЙ ***
          if (startTime === '00:00' && endTime === '00:00') {
            console.log(`[CommonFillTemplates] *** ВКЛЮЧЕН ДЕНЬ С 00:00-00:00 ***`);
            console.log(`[CommonFillTemplates] ${dayInfo.name}: Week ${numberOfWeek}, Shift ${numberOfShift} - это выходной день или день без работы, но ЗАПИСЬ БУДЕТ СОЗДАНА`);
          }
        } else {
          // Логируем случаи когда данные времени отсутствуют полностью
          console.log(`[CommonFillTemplates] *** ПРОПУЩЕН ДЕНЬ БЕЗ ДАННЫХ ВРЕМЕНИ ***`);
          console.log(`[CommonFillTemplates] ${dayInfo.name}: Week ${numberOfWeek}, Shift ${numberOfShift} - отсутствуют данные start/end времени`);
        }
      });
    });

    return scheduleTemplates;
  }

  // *** VALIDATION METHODS ***

  /**
   * Валидирует шаблон расписания
   */
  public validateScheduleTemplate(template: IScheduleTemplate): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Проверка обязательных полей
    if (!template.id) errors.push('Template ID is missing');
    if (!template.contractId) errors.push('Contract ID is missing');
    if (!template.dayName) errors.push('Day name is missing');
    if (!template.startTime) errors.push('Start time is missing');
    if (!template.endTime) errors.push('End time is missing');

    // Проверка диапазонов значений
    if (template.NumberOfWeek < 1 || template.NumberOfWeek > 4) {
      errors.push(`Invalid week number: ${template.NumberOfWeek} (must be 1-4)`);
    }
    if (template.NumberOfShift < 1 || template.NumberOfShift > 5) {
      errors.push(`Invalid shift number: ${template.NumberOfShift} (must be 1-5)`);
    }
    if (template.dayOfWeek < 1 || template.dayOfWeek > 7) {
      errors.push(`Invalid day of week: ${template.dayOfWeek} (must be 1-7)`);
    }
    if (template.lunchMinutes < 0 || template.lunchMinutes > 120) {
      warnings.push(`Unusual lunch duration: ${template.lunchMinutes} minutes`);
    }

    // Проверка формата времени
    const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timePattern.test(template.startTime)) {
      errors.push(`Invalid start time format: ${template.startTime}`);
    }
    if (!timePattern.test(template.endTime)) {
      errors.push(`Invalid end time format: ${template.endTime}`);
    }

    // Проверка логики времени
    if (template.startTime && template.endTime) {
      const [startHour, startMin] = template.startTime.split(':').map(Number);
      const [endHour, endMin] = template.endTime.split(':').map(Number);
      
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (startMinutes >= endMinutes && !(startMinutes === 0 && endMinutes === 0)) {
        warnings.push(`Start time (${template.startTime}) is not before end time (${template.endTime})`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Валидирует группу шаблонов
   */
  public validateTemplateGroup(templates: IScheduleTemplate[]): {
    isValid: boolean;
    issues: string[];
    statistics: {
      totalTemplates: number;
      uniqueWeeks: number;
      uniqueShifts: number;
      uniqueDays: number;
      validTemplates: number;
      invalidTemplates: number;
    };
  } {
    const issues: string[] = [];
    let validTemplates = 0;
    let invalidTemplates = 0;

    const weeks = new Set<number>();
    const shifts = new Set<number>();
    const days = new Set<number>();

    templates.forEach((template, index) => {
      const validation = this.validateScheduleTemplate(template);
      
      if (validation.isValid) {
        validTemplates++;
        weeks.add(template.NumberOfWeek);
        shifts.add(template.NumberOfShift);
        days.add(template.dayOfWeek);
      } else {
        invalidTemplates++;
        issues.push(`Template ${index}: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        issues.push(`Template ${index} warnings: ${validation.warnings.join(', ')}`);
      }
    });

    // Проверка покрытия дней недели
    const missingDays = [];
    for (let day = 1; day <= 7; day++) {
      if (!days.has(day)) {
        missingDays.push(this.dateUtils.getSharePointDayName(day as any));
      }
    }
    
    if (missingDays.length > 0) {
      issues.push(`Missing days: ${missingDays.join(', ')}`);
    }

    return {
      isValid: invalidTemplates === 0 && issues.length === 0,
      issues,
      statistics: {
        totalTemplates: templates.length,
        uniqueWeeks: weeks.size,
        uniqueShifts: shifts.size,
        uniqueDays: days.size,
        validTemplates,
        invalidTemplates
      }
    };
  }

  // *** UTILITY METHODS ***

  /**
   * Получает шаблоны для конкретной недели
   */
  public getTemplatesForWeek(templates: IScheduleTemplate[], weekNumber: number): IScheduleTemplate[] {
    return templates.filter(template => template.NumberOfWeek === weekNumber);
  }

  /**
   * Получает шаблоны для конкретного дня
   */
  public getTemplatesForDay(templates: IScheduleTemplate[], dayOfWeek: number): IScheduleTemplate[] {
    return templates.filter(template => template.dayOfWeek === dayOfWeek);
  }

  /**
   * Получает шаблоны для конкретной смены
   */
  public getTemplatesForShift(templates: IScheduleTemplate[], shiftNumber: number): IScheduleTemplate[] {
    return templates.filter(template => template.NumberOfShift === shiftNumber);
  }

  /**
   * Сортирует шаблоны по приоритету (неделя, день, смена)
   */
  public sortTemplatesByPriority(templates: IScheduleTemplate[]): IScheduleTemplate[] {
    return [...templates].sort((a, b) => {
      // Сначала по неделе
      if (a.NumberOfWeek !== b.NumberOfWeek) {
        return a.NumberOfWeek - b.NumberOfWeek;
      }
      
      // Затем по дню
      if (a.dayOfWeek !== b.dayOfWeek) {
        return a.dayOfWeek - b.dayOfWeek;
      }
      
      // Наконец по смене
      return a.NumberOfShift - b.NumberOfShift;
    });
  }

  /**
   * Создает краткое описание шаблона
   */
  public getTemplateDescription(template: IScheduleTemplate): string {
    return `W${template.NumberOfWeek}S${template.NumberOfShift} ${template.dayName}: ${template.startTime}-${template.endTime} (${template.lunchMinutes}min lunch)`;
  }

  /**
   * Получает сводку по шаблонам
   */
  public getTemplatesSummary(templates: IScheduleTemplate[]): {
    description: string;
    coverage: string;
    workingHours: string;
  } {
    if (templates.length === 0) {
      return {
        description: 'No templates available',
        coverage: 'No coverage',
        workingHours: 'No working hours'
      };
    }

    const weeks = new Set(templates.map(t => t.NumberOfWeek));
    const shifts = new Set(templates.map(t => t.NumberOfShift));
    const days = new Set(templates.map(t => t.dayOfWeek));

    const workingDays = Array.from(days)
      .sort()
      .map(d => this.dateUtils.getSharePointDayName(d as any))
      .join(', ');

    const timeRanges = new Set(templates.map(t => `${t.startTime}-${t.endTime}`));
    const uniqueTimeRanges = Array.from(timeRanges).join(', ');

    return {
      description: `${templates.length} templates: ${weeks.size} weeks, ${shifts.size} shifts`,
      coverage: `Days: ${workingDays}`,
      workingHours: `Times: ${uniqueTimeRanges}`
    };
  }
}