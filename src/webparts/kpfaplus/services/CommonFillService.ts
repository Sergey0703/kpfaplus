// src/webparts/kpfaplus/services/CommonFillService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MessageBarType } from '@fluentui/react';
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { ContractsService } from './ContractsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { WeeklyTimeTableUtils } from '../models/IWeeklyTimeTable';
import { IContract } from '../models/IContract';
import { IStaffMember } from '../models/types';

// Интерфейс для параметров операции заполнения
export interface IFillParams {
  selectedDate: Date;
  staffMember: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;
  context: WebPartContext;
}

// Интерфейс для результата проверки существующих записей
export interface IExistingRecordsCheck {
  hasExistingRecords: boolean;
  recordsCount: number;
  hasProcessedRecords: boolean;
  processedCount: number;
  existingRecords: IStaffRecord[];
}

// Интерфейс для результата операции заполнения
export interface IFillResult {
  success: boolean;
  message: string;
  messageType: MessageBarType;
  createdRecordsCount?: number;
  deletedRecordsCount?: number;
}

export class CommonFillService {
  private static instance: CommonFillService;
  private webPartContext: WebPartContext;
  
  // Сервисы
  private staffRecordsService: StaffRecordsService;
  private contractsService: ContractsService;
  private holidaysService: HolidaysService;
  private daysOfLeavesService: DaysOfLeavesService;
  private weeklyTimeTableService: WeeklyTimeTableService;

  private constructor(context: WebPartContext) {
    this.webPartContext = context;
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    this.contractsService = ContractsService.getInstance(context);
    this.holidaysService = HolidaysService.getInstance(context);
    this.daysOfLeavesService = DaysOfLeavesService.getInstance(context);
    this.weeklyTimeTableService = new WeeklyTimeTableService(context);
  }

  public static getInstance(context: WebPartContext): CommonFillService {
    if (!CommonFillService.instance) {
      CommonFillService.instance = new CommonFillService(context);
    }
    return CommonFillService.instance;
  }

  /**
   * Проверяет существующие записи для сотрудника в указанном периоде
   */
  public async checkExistingRecords(params: IFillParams): Promise<IExistingRecordsCheck> {
    console.log('[CommonFillService] Checking existing records for staff:', params.staffMember.name);

    try {
      // Определяем период (весь месяц выбранной даты)
      const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
      const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);

      console.log(`[CommonFillService] Checking period: ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`);

      if (!params.staffMember.employeeId) {
        console.warn('[CommonFillService] Staff member has no employeeId');
        return {
          hasExistingRecords: false,
          recordsCount: 0,
          hasProcessedRecords: false,
          processedCount: 0,
          existingRecords: []
        };
      }

      // Используем существующий метод из StaffRecordsService
      const allRecords = await this.staffRecordsService.getAllStaffRecords(
        parseInt(params.staffMember.employeeId, 10),
        parseInt(params.currentUserId || '0', 10),
        parseInt(params.managingGroupId || '0', 10)
      );

      // Фильтруем записи по периоду и удаленным
      const existingRecords = allRecords.filter((record: IStaffRecord) => {
        const recordDate = new Date(record.Date);
        const inPeriod = recordDate >= startOfMonth && recordDate <= endOfMonth;
        const notDeleted = !record.deleted;
        return inPeriod && notDeleted;
      });

      console.log(`[CommonFillService] Found ${allRecords.length} total records, ${existingRecords.length} in period and not deleted`);

      // Проверяем, есть ли обработанные записи (checked > 0 или exportResult не пустое)
      const processedRecords = existingRecords.filter((record: IStaffRecord) => {
        const isProcessed = (record.checked && record.checked > 0) || 
                           (record.exportResult && record.exportResult.trim() !== '' && record.exportResult !== '0');
        if (isProcessed) {
          console.log(`[CommonFillService] Found processed record ID=${record.ID}: checked=${record.checked}, exportResult="${record.exportResult}"`);
        }
        return isProcessed;
      });

      const result: IExistingRecordsCheck = {
        hasExistingRecords: existingRecords.length > 0,
        recordsCount: existingRecords.length,
        hasProcessedRecords: processedRecords.length > 0,
        processedCount: processedRecords.length,
        existingRecords: existingRecords
      };

      console.log('[CommonFillService] Existing records check result:', {
        hasExisting: result.hasExistingRecords,
        totalActive: result.recordsCount,
        hasProcessed: result.hasProcessedRecords,
        processedCount: result.processedCount
      });

      return result;

    } catch (error) {
      console.error('[CommonFillService] Error checking existing records:', error);
      throw new Error(`Failed to check existing records: ${error}`);
    }
  }

  /**
   * Удаляет существующие записи (помечает как удаленные)
   */
  public async deleteExistingRecords(existingRecords: IStaffRecord[]): Promise<boolean> {
    console.log(`[CommonFillService] Deleting ${existingRecords.length} existing records`);

    try {
      let successCount = 0;

      for (const record of existingRecords) {
        try {
          // Используем правильное название метода и поля ID
          const success = await this.staffRecordsService.markRecordAsDeleted(record.ID);
          if (success) {
            successCount++;
            console.log(`[CommonFillService] ✓ Successfully deleted record ID: ${record.ID}`);
          } else {
            console.error(`[CommonFillService] ✗ Failed to delete record ID: ${record.ID}`);
          }
        } catch (error) {
          console.error(`[CommonFillService] ✗ Error deleting record ID ${record.ID}:`, error);
        }

        // Небольшая пауза между операциями удаления
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[CommonFillService] Delete operation completed: ${successCount}/${existingRecords.length} successful`);
      return successCount === existingRecords.length;

    } catch (error) {
      console.error('[CommonFillService] Error deleting existing records:', error);
      return false;
    }
  }

  /**
   * Основная функция заполнения расписания для одного сотрудника
   */
  public async fillScheduleForStaff(params: IFillParams, replaceExisting: boolean = false): Promise<IFillResult> {
    console.log('[CommonFillService] Starting fill operation for staff:', params.staffMember.name);
    console.log('[CommonFillService] Fill parameters:', {
      date: params.selectedDate.toLocaleDateString(),
      employeeId: params.staffMember.employeeId,
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      replaceExisting
    });

    try {
      // Валидация входных параметров
      if (!params.staffMember.employeeId) {
        return {
          success: false,
          message: 'Staff member has no employee ID',
          messageType: MessageBarType.error
        };
      }

      // 1. Проверяем существующие записи
      if (!replaceExisting) {
        const existingCheck = await this.checkExistingRecords(params);
        
        if (existingCheck.hasExistingRecords) {
          if (existingCheck.hasProcessedRecords) {
            return {
              success: false,
              message: `Cannot replace records: ${existingCheck.processedCount} of ${existingCheck.recordsCount} records have been processed (checked or exported). Manual review required.`,
              messageType: MessageBarType.error
            };
          }
          
          return {
            success: false,
            message: `Found ${existingCheck.recordsCount} existing records for this period. Please confirm replacement.`,
            messageType: MessageBarType.warning
          };
        }
      }

      // 2. Если нужно заменить существующие записи
      let deletedRecordsCount = 0;
      if (replaceExisting) {
        const existingCheck = await this.checkExistingRecords(params);
        
        if (existingCheck.hasExistingRecords) {
          if (existingCheck.hasProcessedRecords) {
            return {
              success: false,
              message: `Cannot replace records: ${existingCheck.processedCount} of ${existingCheck.recordsCount} records have been processed.`,
              messageType: MessageBarType.error
            };
          }

          // Удаляем существующие записи
          console.log(`[CommonFillService] Deleting ${existingCheck.recordsCount} existing records before creating new ones`);
          const deleteSuccess = await this.deleteExistingRecords(existingCheck.existingRecords);
          if (!deleteSuccess) {
            return {
              success: false,
              message: 'Failed to delete existing records. Fill operation cancelled.',
              messageType: MessageBarType.error
            };
          }
          deletedRecordsCount = existingCheck.recordsCount;
        }
      }

      // 3. Получаем контракты сотрудника
      console.log('[CommonFillService] Loading contracts for staff member');
      const contracts = await this.contractsService.getContractsForStaffMember(
        params.staffMember.employeeId,
        params.currentUserId,
        params.managingGroupId
      );

      const activeContracts = contracts.filter((contract: IContract) => 
        !contract.isDeleted && this.isContractActiveInMonth(contract, params.selectedDate)
      );

      console.log(`[CommonFillService] Found ${contracts.length} total contracts, ${activeContracts.length} active for selected period`);

      if (activeContracts.length === 0) {
        return {
          success: false,
          message: 'No active contracts found for this staff member in the selected period.',
          messageType: MessageBarType.warning
        };
      }

      // Используем первый активный контракт
      const selectedContract = activeContracts[0];
      console.log(`[CommonFillService] Using contract: ${selectedContract.id} - ${selectedContract.template || 'No template name'}`);

      // 4. Загружаем данные для заполнения
      console.log('[CommonFillService] Loading holidays, leaves, and weekly templates');
      const [holidays, leaves, weeklyTemplates] = await Promise.all([
        this.loadHolidays(params.selectedDate),
        this.loadLeaves(params),
        this.loadWeeklyTemplates(selectedContract.id)
      ]);

      console.log(`[CommonFillService] Loaded data: ${holidays.length} holidays, ${leaves.length} leaves, ${weeklyTemplates.length} weekly templates`);

      if (weeklyTemplates.length === 0) {
        return {
          success: false,
          message: 'No weekly schedule templates found for the selected contract.',
          messageType: MessageBarType.warning
        };
      }

      // 5. Генерируем записи расписания
      const generatedRecords = await this.generateScheduleRecords(
        params,
        selectedContract,
        holidays,
        leaves,
        weeklyTemplates
      );

      if (generatedRecords.length === 0) {
        return {
          success: false,
          message: 'No schedule records generated. Please check the contract templates and selected period.',
          messageType: MessageBarType.warning
        };
      }

      // 6. Сохраняем сгенерированные записи
      const savedCount = await this.saveGeneratedRecords(generatedRecords, params);

      const result: IFillResult = {
        success: savedCount > 0,
        message: savedCount === generatedRecords.length 
          ? `Successfully generated ${savedCount} schedule records`
          : `Generated ${savedCount} of ${generatedRecords.length} records. Some records failed to save.`,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount,
        deletedRecordsCount: deletedRecordsCount
      };

      console.log('[CommonFillService] Fill operation completed:', {
        success: result.success,
        created: result.createdRecordsCount,
        deleted: result.deletedRecordsCount,
        message: result.message
      });

      return result;

    } catch (error) {
      console.error('[CommonFillService] Error during fill operation:', error);
      return {
        success: false,
        message: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error
      };
    }
  }

  /**
   * Проверяет, активен ли контракт в указанном месяце
   */
  private isContractActiveInMonth(contract: IContract, date: Date): boolean {
    if (!contract.startDate) {
      console.log(`[CommonFillService] Contract ${contract.id} has no start date - excluding`);
      return false;
    }

    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    firstDayOfMonth.setHours(0, 0, 0, 0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    const startDate = new Date(contract.startDate);
    startDate.setHours(0, 0, 0, 0);

    // Проверяем дату начала контракта
    if (startDate > lastDayOfMonth) {
      console.log(`[CommonFillService] Contract ${contract.id} starts after selected month - excluding`);
      return false;
    }

    // Если нет даты окончания, контракт активен
    if (!contract.finishDate) {
      console.log(`[CommonFillService] Contract ${contract.id} is open-ended and starts before/in selected month - including`);
      return true;
    }

    const finishDate = new Date(contract.finishDate);
    finishDate.setHours(23, 59, 59, 999);

    // Проверяем дату окончания контракта
    const isActive = finishDate >= firstDayOfMonth;
    console.log(`[CommonFillService] Contract ${contract.id} ends ${finishDate.toLocaleDateString()} - ${isActive ? 'including' : 'excluding'}`);
    
    return isActive;
  }

  /**
   * Загружает праздники для месяца
   */
  private async loadHolidays(date: Date): Promise<IHoliday[]> {
    try {
      console.log(`[CommonFillService] Loading holidays for ${date.getMonth() + 1}/${date.getFullYear()}`);
      const holidays = await this.holidaysService.getHolidaysByMonthAndYear(date);
      console.log(`[CommonFillService] Loaded ${holidays.length} holidays`);
      
      // Логируем первые несколько праздников для отладки
      if (holidays.length > 0) {
        holidays.slice(0, 3).forEach((holiday, index) => {
          console.log(`[CommonFillService] Holiday ${index + 1}: ${new Date(holiday.date).toLocaleDateString()} - ${holiday.title}`);
        });
      }
      
      return holidays;
    } catch (error) {
      console.error('[CommonFillService] Error loading holidays:', error);
      return [];
    }
  }

  /**
   * Загружает отпуска сотрудника
   */
  private async loadLeaves(params: IFillParams): Promise<ILeaveDay[]> {
    try {
      if (!params.staffMember.employeeId) {
        console.log('[CommonFillService] No employee ID - skipping leaves loading');
        return [];
      }

      console.log(`[CommonFillService] Loading leaves for employee ${params.staffMember.employeeId}`);
      const leaves = await this.daysOfLeavesService.getLeavesForMonthAndYear(
        params.selectedDate,
        parseInt(params.staffMember.employeeId, 10),
        parseInt(params.currentUserId || '0', 10),
        parseInt(params.managingGroupId || '0', 10)
      );

      // Фильтруем удаленные отпуска
      const activeLeaves = leaves.filter((leave: ILeaveDay) => !leave.deleted);
      console.log(`[CommonFillService] Loaded ${leaves.length} total leaves, ${activeLeaves.length} active`);

      // Логируем первые несколько отпусков для отладки
      if (activeLeaves.length > 0) {
        activeLeaves.slice(0, 3).forEach((leave, index) => {
          const endDateStr = leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'ongoing';
          console.log(`[CommonFillService] Leave ${index + 1}: ${new Date(leave.startDate).toLocaleDateString()} - ${endDateStr}, type: ${leave.typeOfLeave}, title: "${leave.title}"`);
        });
      }

      return activeLeaves;
    } catch (error) {
      console.error('[CommonFillService] Error loading leaves:', error);
      return [];
    }
  }

  /**
   * Загружает шаблоны недельного расписания
   */
  private async loadWeeklyTemplates(contractId: string): Promise<any[]> {
    try {
      console.log(`[CommonFillService] Loading weekly templates for contract ${contractId}`);
      const weeklyTimeItems = await this.weeklyTimeTableService.getWeeklyTimeTableByContractId(contractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        console.log('[CommonFillService] No weekly time items found');
        return [];
      }

      console.log(`[CommonFillService] Retrieved ${weeklyTimeItems.length} weekly time items`);

      // Фильтруем удаленные шаблоны
      const activeItems = weeklyTimeItems.filter((item: any) => {
        const isDeleted = item.fields?.Deleted === 1 || item.Deleted === 1 ||
                         item.fields?.deleted === 1 || item.deleted === 1;
        return !isDeleted;
      });

      console.log(`[CommonFillService] Filtered to ${activeItems.length} active weekly time items`);

      if (activeItems.length === 0) {
        return [];
      }

      // Форматируем шаблоны
      const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(activeItems, params.dayOfStartWeek || 7);
      
      if (!formattedTemplates) {
        console.log('[CommonFillService] Failed to format weekly templates');
        return [];
      }

      // Дополнительная фильтрация после форматирования
      const finalTemplates = formattedTemplates.filter((template: any) => 
        template.deleted !== 1 && template.Deleted !== 1
      );

      console.log(`[CommonFillService] Final formatted templates: ${finalTemplates.length}`);

      // Логируем информацию о шаблонах
      if (finalTemplates.length > 0) {
        finalTemplates.forEach((template: any, index: number) => {
          console.log(`[CommonFillService] Template ${index + 1}: Week=${template.NumberOfWeek || template.numberOfWeek || 1}, Shift=${template.NumberOfShift || template.shiftNumber || 1}`);
        });
      }

      return finalTemplates;
    } catch (error) {
      console.error('[CommonFillService] Error loading weekly templates:', error);
      return [];
    }
  }

  /**
   * Генерирует записи расписания на основе шаблонов и данных
   */
  private async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: any[]
  ): Promise<Partial<IStaffRecord>[]> {
    console.log(`[CommonFillService] Generating schedule records for ${params.staffMember.name}`);

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

    console.log(`[CommonFillService] Generation period: ${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`);

    // Создаем кэши для быстрого поиска
    const holidayCache = this.createHolidayCache(holidays);
    const leavePeriods = this.createLeavePeriods(leaves);

    const records: Partial<IStaffRecord>[] = [];

    // Перебираем все дни периода
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // Получаем шаблоны для этого дня (упрощенная логика - используем первый шаблон)
      // TODO: Реализовать полную логику выбора шаблонов по дням недели и номеру недели
      if (weeklyTemplates.length > 0) {
        // Берем первый шаблон (можно улучшить логику выбора)
        const template = weeklyTemplates[0];
        const record = this.createStaffRecord(currentDate, template, contract, holidayCache, leavePeriods);
        records.push(record);
      }
    }

    console.log(`[CommonFillService] Generated ${records.length} schedule records`);
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
    console.log(`[CommonFillService] Created holiday cache with ${cache.size} entries`);
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
    
    console.log(`[CommonFillService] Created leave periods cache with ${leavePeriods.length} entries`);
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
    const holidayInfo = isHoliday ? holidayCache.get(dateKey) : undefined;
    
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
      // Поля для связи с пользователем и группой будут установлены при сохранении
      checked: 0,
      deleted: false
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
    
    console.log(`[CommonFillService] Created record: ${logDetails}`);

    return record;
  }

  /**
   * Сохраняет сгенерированные записи в SharePoint
   */
  private async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<number> {
    console.log(`[CommonFillService] Saving ${records.length} generated records`);

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      try {
        console.log(`[CommonFillService] Saving record ${i + 1}/${records.length} for ${record.Date?.toLocaleDateString()}`);
        
        const newRecordId = await this.staffRecordsService.createStaffRecord(
          record,
          params.currentUserId,    // Manager ID
          params.managingGroupId,  // Staff Group ID
          params.staffMember.employeeId // Employee ID
        );

        if (newRecordId) {
          successCount++;
          console.log(`[CommonFillService] ✓ Created record ID=${newRecordId} for ${record.Date?.toLocaleDateString()}`);
        } else {
          const errorMsg = `Failed to create record for ${record.Date?.toLocaleDateString()}: No ID returned`;
          errors.push(errorMsg);
          console.error(`[CommonFillService] ✗ ${errorMsg}`);
        }
      } catch (error) {
        const errorMsg = `Error creating record ${i + 1} for ${record.Date?.toLocaleDateString()}: ${error}`;
        errors.push(errorMsg);
        console.error(`[CommonFillService] ✗ ${errorMsg}`);
      }

      // Небольшая пауза между созданиями записей для предотвращения перегрузки
      if (i < records.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Логируем результаты сохранения
    console.log(`[CommonFillService] Save operation completed: ${successCount}/${records.length} successful`);
    
    if (errors.length > 0) {
      console.error(`[CommonFillService] Save errors (${errors.length}):`, errors);
    }

    return successCount;
  }

  /**
   * Вспомогательный метод для создания времени с конкретными часами и минутами
   */
  private createDateWithTime(baseDate: Date, hours: number, minutes: number): Date {
    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  /**
   * Получает текстовое описание дня недели
   */
  private getDayName(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  /**
   * Определяет номер недели в месяце
   */
  private getWeekNumberInMonth(date: Date): number {
    const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfMonth = date.getDate();
    return Math.ceil((dayOfMonth + firstDayOfMonth.getDay()) / 7);
  }

  /**
   * Проверяет, является ли дата рабочим днем (понедельник-пятница)
   */
  private isWorkingDay(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=Monday, 5=Friday
  }

  /**
   * Форматирует время в читаемый вид для логирования
   */
  private formatTimeForLogging(hours: number, minutes: number): string {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Проверяет валидность параметров заполнения
   */
  private validateFillParams(params: IFillParams): string[] {
    const errors: string[] = [];

    if (!params.selectedDate) {
      errors.push('Selected date is required');
    }

    if (!params.staffMember) {
      errors.push('Staff member is required');
    } else {
      if (!params.staffMember.employeeId) {
        errors.push('Staff member must have an employee ID');
      }
      if (!params.staffMember.name) {
        errors.push('Staff member must have a name');
      }
    }

    if (!params.context) {
      errors.push('WebPart context is required');
    }

    return errors;
  }

  /**
   * Получает статистику по генерации записей
   */
  private getGenerationStatistics(
    records: Partial<IStaffRecord>[],
    holidays: IHoliday[],
    leaves: ILeaveDay[]
  ): {
    totalRecords: number;
    holidayRecords: number;
    leaveRecords: number;
    regularRecords: number;
  } {
    let holidayRecords = 0;
    let leaveRecords = 0;

    records.forEach(record => {
      if (record.Holiday === 1) {
        holidayRecords++;
      }
      if (record.TypeOfLeaveID) {
        leaveRecords++;
      }
    });

    const regularRecords = records.length - holidayRecords - leaveRecords;

    const stats = {
      totalRecords: records.length,
      holidayRecords,
      leaveRecords,
      regularRecords
    };

    console.log('[CommonFillService] Generation statistics:', stats);
    return stats;
  }

  /**
   * Очищает кэш сервиса (может понадобиться для тестирования)
   */
  public static clearInstance(): void {
    CommonFillService.instance = undefined as any;
    console.log('[CommonFillService] Instance cleared');
  }

  /**
   * Получает версию сервиса для отладки
   */
  public getServiceInfo(): {
    version: string;
    context: boolean;
    services: {
      staffRecords: boolean;
      contracts: boolean;
      holidays: boolean;
      leaves: boolean;
      weeklyTimeTable: boolean;
    };
  } {
    return {
      version: '1.0.0',
      context: !!this.webPartContext,
      services: {
        staffRecords: !!this.staffRecordsService,
        contracts: !!this.contractsService,
        holidays: !!this.holidaysService,
        leaves: !!this.daysOfLeavesService,
        weeklyTimeTable: !!this.weeklyTimeTableService
      }
    };
  }

  /**
   * Метод для тестирования подключения к сервисам
   */
  public async testServices(): Promise<{
    staffRecords: boolean;
    contracts: boolean;
    holidays: boolean;
    leaves: boolean;
    weeklyTimeTable: boolean;
    errors: string[];
  }> {
    const results = {
      staffRecords: false,
      contracts: false,
      holidays: false,
      leaves: false,
      weeklyTimeTable: false,
      errors: [] as string[]
    };

    try {
      // Тестируем StaffRecordsService
      await this.staffRecordsService.getAllStaffRecords(1, 1, 1);
      results.staffRecords = true;
    } catch (error) {
      results.errors.push(`StaffRecords: ${error}`);
    }

    try {
      // Тестируем ContractsService
      await this.contractsService.getContractsForStaffMember('1', '1', '1');
      results.contracts = true;
    } catch (error) {
      results.errors.push(`Contracts: ${error}`);
    }

    try {
      // Тестируем HolidaysService
      await this.holidaysService.getHolidaysByMonthAndYear(new Date());
      results.holidays = true;
    } catch (error) {
      results.errors.push(`Holidays: ${error}`);
    }

    try {
      // Тестируем DaysOfLeavesService
      await this.daysOfLeavesService.getLeavesForMonthAndYear(new Date(), 1, 1, 1);
      results.leaves = true;
    } catch (error) {
      results.errors.push(`Leaves: ${error}`);
    }

    try {
      // Тестируем WeeklyTimeTableService
      await this.weeklyTimeTableService.getWeeklyTimeTableByContractId('1');
      results.weeklyTimeTable = true;
    } catch (error) {
      results.errors.push(`WeeklyTimeTable: ${error}`);
    }

    console.log('[CommonFillService] Service test results:', results);
    return results;
  }
}