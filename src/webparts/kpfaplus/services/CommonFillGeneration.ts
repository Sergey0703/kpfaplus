// src/webparts/kpfaplus/services/CommonFillGeneration.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { WeeklyTimeTableUtils } from '../models/IWeeklyTimeTable';
import { IContract } from '../models/IContract';
import { IFillParams } from './CommonFillValidation';

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
   * Загружает шаблоны недельного расписания
   */
  public async loadWeeklyTemplates(contractId: string, dayOfStartWeek: number): Promise<any[]> {
    try {
      console.log(`[CommonFillGeneration] Loading weekly templates for contract ${contractId}`);
      const weeklyTimeItems = await this.weeklyTimeTableService.getWeeklyTimeTableByContractId(contractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        console.log('[CommonFillGeneration] No weekly time items found');
        return [];
      }

      console.log(`[CommonFillGeneration] Retrieved ${weeklyTimeItems.length} weekly time items`);

      // Фильтруем удаленные шаблоны
      const activeItems = weeklyTimeItems.filter((item: any) => {
        const isDeleted = item.fields?.Deleted === 1 || item.Deleted === 1 ||
                         item.fields?.deleted === 1 || item.deleted === 1;
        return !isDeleted;
      });

      console.log(`[CommonFillGeneration] Filtered to ${activeItems.length} active weekly time items`);

      if (activeItems.length === 0) {
        return [];
      }

      // Форматируем шаблоны
      const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(activeItems, dayOfStartWeek);
      
      if (!formattedTemplates) {
        console.log('[CommonFillGeneration] Failed to format weekly templates');
        return [];
      }

      // Дополнительная фильтрация после форматирования
      const finalTemplates = formattedTemplates.filter((template: any) => 
        template.deleted !== 1 && template.Deleted !== 1
      );

      console.log(`[CommonFillGeneration] Final formatted templates: ${finalTemplates.length}`);

      // Логируем информацию о шаблонах
      if (finalTemplates.length > 0) {
        finalTemplates.forEach((template: any, index: number) => {
          console.log(`[CommonFillGeneration] Template ${index + 1}: Week=${template.NumberOfWeek || template.numberOfWeek || 1}, Shift=${template.NumberOfShift || template.shiftNumber || 1}`);
        });
      }

      return finalTemplates;
    } catch (error) {
      console.error('[CommonFillGeneration] Error loading weekly templates:', error);
      return [];
    }
  }

  /**
   * Генерирует записи расписания на основе шаблонов и данных
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: any[]
  ): Promise<Partial<IStaffRecord>[]> {
    console.log(`[CommonFillGeneration] Generating schedule records for ${params.staffMember.name}`);

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

    const records: Partial<IStaffRecord>[] = [];

    // Перебираем все дни периода
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // Получаем шаблоны для этого дня (упрощенная логика - используем первый шаблон)
      if (weeklyTemplates.length > 0) {
        // Берем первый шаблон (можно улучшить логику выбора)
        const template = weeklyTemplates[0];
        const record = this.createStaffRecord(currentDate, template, contract, holidayCache, leavePeriods);
        records.push(record);
      }
    }

    console.log(`[CommonFillGeneration] Generated ${records.length} schedule records`);
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
   * Создает запись расписания для конкретного дня
   */
  private createStaffRecord(
    date: Date,
    template: any,
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

    // Базовые времена (можно улучшить, используя реальные данные из шаблона)
    const startTime = { hours: 9, minutes: 0 }; // 09:00
    const endTime = { hours: 18, minutes: 0 };  // 18:00
    const lunchTime = 30; // 30 минут

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
      `Holiday: ${isHoliday ? 'Yes' : 'No'}`,
      `Leave: ${isLeave ? `Yes (${leaveForDay?.title})` : 'No'}`,
      `Time: ${startTime.hours}:${startTime.minutes.toString().padStart(2, '0')} - ${endTime.hours}:${endTime.minutes.toString().padStart(2, '0')}`
    ].join(', ');
    
    console.log(`[CommonFillGeneration] Created record: ${logDetails}`);

    return record;
  }

  /**
   * Сохраняет сгенерированные записи в SharePoint
   */
  public async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<number> {
    console.log(`[CommonFillGeneration] Saving ${records.length} generated records`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillGeneration] Saving record ${i + 1}/${records.length} for ${record.Date?.toLocaleDateString()}`);
        
        // ИСПРАВЛЕНИЕ: Правильная передача параметров для createStaffRecord
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
        
        // ИСПРАВЛЕНО: Корректный вызов createStaffRecord с правильными параметрами
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,                    // createData: Partial<IStaffRecord>
          managerId || '0',         // currentUserID (Manager) - строка или число
          staffGroupId || '0',      // staffGroupID - строка или число  
          employeeId                // staffMemberID (Employee) - строка или число
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillGeneration] ✓ Created record ID=${newRecordId} for ${record.Date?.toLocaleDateString()}`);
          
          // Дополнительное логирование для отладки
          if (record.TypeOfLeaveID) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created with leave type: ${record.TypeOfLeaveID}`);
          }
          if (record.Holiday === 1) {
            console.log(`[CommonFillGeneration] ✓ Record ${newRecordId} created for holiday`);
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
    console.log(`[CommonFillGeneration] Save operation completed: ${successCount}/${records.length} successful`);
    
    if (errors.length > 0) {
      console.error(`[CommonFillGeneration] Save errors (${errors.length}):`, errors);
    }

    return successCount;
  }
}