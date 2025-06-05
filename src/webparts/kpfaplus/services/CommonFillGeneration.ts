// src/webparts/kpfaplus/services/CommonFillGeneration.ts
// ОБНОВЛЕНО: С полной логикой Schedule tab для обработки шаблонов
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { WeeklyTimeTableUtils } from '../models/IWeeklyTimeTable';
import { IContract } from '../models/IContract';
import { IFillParams } from './CommonFillValidation';

// *** ИНТЕРФЕЙСЫ ДЛЯ ШАБЛОНОВ (ИЗ SCHEDULE TAB) ***
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

//interface ITemplateForDay {
//  template: IScheduleTemplate;
//  weekNumber: number;
//  dayNumber: number;
//}

export class CommonFillGeneration {
  private staffRecordsService: StaffRecordsService;
  private holidaysService: HolidaysService;
  private daysOfLeavesService: DaysOfLeavesService;
  private weeklyTimeTableService: WeeklyTimeTableService;

  constructor(context: WebPartContext) {
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    this.holidaysService = HolidaysService.getInstance(context);
    this.daysOfLeavesService = DaysOfLeavesService.getInstance(context);
    this.weeklyTimeTableService = new WeeklyTimeTableService(context);
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
   * *** ОБНОВЛЕНО: Загружает шаблоны недельного расписания с логикой Schedule tab ***
   */
  public async loadWeeklyTemplates(contractId: string, dayOfStartWeek: number): Promise<IScheduleTemplate[]> {
    try {
      console.log(`[CommonFillGeneration] Loading weekly templates for contract ${contractId} with Schedule tab logic`);
      
      // *** ШАГ 1: ПОЛУЧЕНИЕ ШАБЛОНОВ ИЗ SHAREPOINT ***
      const weeklyTimeItems = await this.weeklyTimeTableService.getWeeklyTimeTableByContractId(contractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        console.log('[CommonFillGeneration] No weekly time items found');
        return [];
      }

      console.log(`[CommonFillGeneration] Retrieved ${weeklyTimeItems.length} weekly time items`);

      // *** ШАГ 2: ПЕРВИЧНАЯ ФИЛЬТРАЦИЯ УДАЛЁННЫХ ШАБЛОНОВ ***
      const activeWeeklyTimeItems = weeklyTimeItems.filter((item: any) => {
        const isDeleted = 
          item.fields?.Deleted === 1 || 
          item.Deleted === 1 ||
          item.fields?.deleted === 1 ||
          item.deleted === 1;
        
        return !isDeleted; // Оставляем только неудалённые шаблоны
      });

      console.log(`[CommonFillGeneration] After primary filtering: ${activeWeeklyTimeItems.length} active weekly time items`);

      if (activeWeeklyTimeItems.length === 0) {
        return [];
      }

      // *** ШАГ 3: ФОРМАТИРОВАНИЕ ШАБЛОНОВ С УЧЁТОМ НАЧАЛА НЕДЕЛИ ГРУППЫ ***
      console.log(`[CommonFillGeneration] Formatting templates with dayOfStartWeek: ${dayOfStartWeek}`);
      const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(activeWeeklyTimeItems, dayOfStartWeek);
      
      if (!formattedTemplates) {
        console.log('[CommonFillGeneration] Failed to format weekly templates');
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
      console.log(`[CommonFillGeneration] Created ${groupedTemplates.size} template groups`);

      // Логируем информацию о шаблонах
      if (scheduleTemplates.length > 0) {
        scheduleTemplates.slice(0, 3).forEach((template: IScheduleTemplate, index: number) => {
          console.log(`[CommonFillGeneration] Template ${index + 1}: Week=${template.NumberOfWeek || template.numberOfWeek || 1}, Shift=${template.NumberOfShift || template.shiftNumber || 1}`);
        });
      }

      // Сохраняем группированные шаблоны для использования в generateScheduleRecords
      (scheduleTemplates as any)._groupedTemplates = groupedTemplates;

      return scheduleTemplates;
    } catch (error) {
      console.error('[CommonFillGeneration] Error loading weekly templates:', error);
      return [];
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Преобразует отформатированные шаблоны в единый формат ***
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
        const dayInfo = template[day]; // Время начала и окончания для этого дня
        
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
   * *** НОВЫЙ МЕТОД: Группировка шаблонов для быстрого доступа (ИЗ SCHEDULE TAB) ***
   */
  private groupTemplatesByWeekAndDay(templates: IScheduleTemplate[]): Map<string, IScheduleTemplate[]> {
    console.log(`[CommonFillGeneration] Grouping ${templates.length} templates by week and day`);
    
    const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();

    templates.forEach((template: IScheduleTemplate) => {
      const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
      const dayNumber = template.dayOfWeek;
      
      // Создаём ключ: "1-1" (1-я неделя, 1-й день), "1-2" (1-я неделя, 2-й день) и т.д.
      const key = `${weekNumber}-${dayNumber}`;
      
      if (!templatesByWeekAndDay.has(key)) {
        templatesByWeekAndDay.set(key, []);
      }
      
      // Добавляем шаблон в соответствующую группу
      templatesByWeekAndDay.get(key)?.push(template);
      
      console.log(`[CommonFillGeneration] Added template to group ${key}: ${template.start}-${template.end}, shift ${template.NumberOfShift || template.shiftNumber || 1}`);
    });

    console.log(`[CommonFillGeneration] Created ${templatesByWeekAndDay.size} template groups:`);
    templatesByWeekAndDay.forEach((templates: IScheduleTemplate[], key: string) => {
      console.log(`[CommonFillGeneration] Group ${key}: ${templates.length} templates`);
    });

    return templatesByWeekAndDay;
  }

  /**
   * *** ОБНОВЛЕНО: Генерирует записи расписания с логикой Schedule tab ***
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: IScheduleTemplate[]
  ): Promise<Partial<IStaffRecord>[]> {
    console.log(`[CommonFillGeneration] Generating schedule records for ${params.staffMember.name} with Schedule tab logic`);

    // Определяем период для генерации
    const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
    const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);

    const contractStartDate = contract.startDate;
    const contractFinishDate = contract.finishDate;

    // Определяем реальный период с учетом контракта
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

    // *** ПОЛУЧАЕМ ГРУППИРОВАННЫЕ ШАБЛОНЫ ***
    const groupedTemplates = (weeklyTemplates as any)._groupedTemplates as Map<string, IScheduleTemplate[]>;
    if (!groupedTemplates) {
      console.error('[CommonFillGeneration] No grouped templates found - using fallback logic');
      return this.generateRecordsWithFallback(params, contract, firstDay, lastDay, weeklyTemplates, holidayCache, leavePeriods);
    }

    const records: Partial<IStaffRecord>[] = [];

    // *** ПЕРЕБИРАЕМ ВСЕ ДНИ ПЕРИОДА С ЛОГИКОЙ SCHEDULE TAB ***
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // *** ВЫЧИСЛЯЕМ НОМЕР НЕДЕЛИ И ДЕНЬ НЕДЕЛИ ***
      const weekAndDay = this.calculateWeekAndDay(currentDate, startOfMonth, params.dayOfStartWeek || 7);
      
      // *** ИЩЕМ ПОДХОДЯЩИЕ ШАБЛОНЫ ДЛЯ ЭТОГО ДНЯ ***
      const templatesForDay = this.findTemplatesForDay(groupedTemplates, weekAndDay.weekNumber, weekAndDay.dayNumber);
      
      if (templatesForDay.length > 0) {
        // Используем первый подходящий шаблон (можно улучшить логику выбора)
        const selectedTemplate = templatesForDay[0];
        
        console.log(`[CommonFillGeneration] Date ${currentDate.toLocaleDateString()}: Week ${weekAndDay.weekNumber}, Day ${weekAndDay.dayNumber}, Template: ${selectedTemplate.start}-${selectedTemplate.end}`);
        
        const record = this.createStaffRecordFromTemplate(
          currentDate, 
          selectedTemplate, 
          contract, 
          holidayCache, 
          leavePeriods
        );
        
        records.push(record);
      } else {
        console.log(`[CommonFillGeneration] No template found for ${currentDate.toLocaleDateString()} (Week ${weekAndDay.weekNumber}, Day ${weekAndDay.dayNumber})`);
      }
    }

    console.log(`[CommonFillGeneration] Generated ${records.length} schedule records using Schedule tab logic`);
    return records;
  }

  /**
   * *** НОВЫЙ МЕТОД: Вычисляет номер недели и день недели как в Schedule tab ***
   */
  private calculateWeekAndDay(date: Date, startOfMonth: Date, dayOfStartWeek: number): { weekNumber: number; dayNumber: number } {
    // Вычисляем номер недели в месяце (1-4 или 1-5)
    const dayOfMonth = date.getDate();
    const weekNumber = Math.ceil(dayOfMonth / 7);
    
    // Вычисляем день недели с учетом dayOfStartWeek
    let dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    
    // Корректируем с учетом начала недели
    if (dayOfStartWeek === 2) { // Понедельник = начало недели
      dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // Воскресенье становится 7
    } else if (dayOfStartWeek === 7) { // Суббота = начало недели
      dayOfWeek = (dayOfWeek + 1) % 7 + 1; // Суббота становится 1, воскресенье 2, и т.д.
    }
    
    const result = {
      weekNumber,
      dayNumber: dayOfWeek
    };
    
    console.log(`[CommonFillGeneration] Date ${date.toLocaleDateString()}: Week ${result.weekNumber}, Day ${result.dayNumber} (dayOfStartWeek=${dayOfStartWeek})`);
    return result;
  }

  /**
   * *** НОВЫЙ МЕТОД: Находит шаблоны для конкретной недели и дня ***
   */
  private findTemplatesForDay(
    groupedTemplates: Map<string, IScheduleTemplate[]>, 
    weekNumber: number, 
    dayNumber: number
  ): IScheduleTemplate[] {
    const key = `${weekNumber}-${dayNumber}`;
    const templates = groupedTemplates.get(key) || [];
    
    if (templates.length === 0) {
      // Пробуем найти шаблон для первой недели если не нашли для текущей
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
   * *** ОБНОВЛЕНО: Создает запись расписания из шаблона ***
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

    // *** ИСПОЛЬЗУЕМ ВРЕМЯ ИЗ ШАБЛОНА ***
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

    // Логируем создание записи для отладки
    const logDetails = [
      `Date: ${date.toLocaleDateString()}`,
      `Template: ${template.start}-${template.end}`,
      `Holiday: ${isHoliday ? 'Yes' : 'No'}`,
      `Leave: ${isLeave ? `Yes (${leaveForDay?.title})` : 'No'}`,
      `Week: ${template.NumberOfWeek || template.numberOfWeek || 1}`,
      `Shift: ${template.NumberOfShift || template.shiftNumber || 1}`
    ].join(', ');
    
    console.log(`[CommonFillGeneration] Created record with Schedule tab logic: ${logDetails}`);

    return record;
  }

  /**
   * *** НОВЫЙ МЕТОД: Парсит строку времени в часы и минуты ***
   */
  private parseTimeString(timeStr: string): { hours: number; minutes: number } {
    try {
      // Поддерживаем форматы: "09:00", "9:00", "09:30", etc.
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
      
      return {
        hours: isNaN(hours) ? 9 : hours,
        minutes: isNaN(minutes) ? 0 : minutes
      };
    } catch (error) {
      console.error(`[CommonFillGeneration] Error parsing time string "${timeStr}":`, error);
      return { hours: 9, minutes: 0 }; // Fallback
    }
  }

  /**
   * *** FALLBACK МЕТОД: Генерация записей с упрощенной логикой ***
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
        // Берем первый шаблон
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
      endDate: leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31), // Далекое будущее для открытых отпусков
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
    console.log(`[CommonFillGeneration] Saving ${records.length} generated records with Schedule tab logic`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillGeneration] Saving record ${i + 1}/${records.length} for ${record.Date?.toLocaleDateString()}`);
        
        const employeeId = params.staffMember.employeeId;
        const managerId = params.currentUserId;
        const staffGroupId = params.managingGroupId;
        
        console.log(`[CommonFillGeneration] Creating record with IDs:
          employeeId: ${employeeId} (${typeof employeeId})
          managerId: ${managerId} (${typeof managerId})  
          staffGroupId: ${staffGroupId} (${typeof staffGroupId})`);
        
        // Проверяем, что employeeId не пустой
        if (!employeeId || employeeId === '0' || employeeId.trim() === '') {
          const errorMsg = `Missing or invalid employeeId for record ${i + 1}: "${employeeId}"`;
          errors.push(errorMsg);
          console.error(`[CommonFillGeneration] ✗ ${errorMsg}`);
          continue;
        }
        
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,                    // createData: Partial<IStaffRecord>
          managerId || '0',         // currentUserID (Manager) - строка или число
          staffGroupId || '0',      // staffGroupID - строка или число  
          employeeId                // staffMemberID (Employee) - строка или число
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillGeneration] ✓ Created record ID=${newRecordId} for ${record.Date?.toLocaleDateString()}`);
          
          // Дополнительное логирование для отладки Schedule tab логики
          if (record.TypeOfLeaveID) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created with leave type: ${record.TypeOfLeaveID}`);
          }
          if (record.Holiday === 1) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created for holiday`);
          }
          
          // Логируем информацию о времени из шаблона
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

      // Небольшая пауза между созданиями записей для предотвращения перегрузки
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Логируем результаты сохранения
    console.log(`[CommonFillGeneration] Save operation completed with Schedule tab logic: ${successCount}/${records.length} successful`);
    
    if (errors.length > 0) {
      console.error(`[CommonFillGeneration] Save errors (${errors.length}):`, errors);
    }

    return successCount;
  }
}