// src/webparts/kpfaplus/services/ScheduleLogsService.ts
// ИСПРАВЛЕНО: Добавлена серверная фильтрация по образцу ContractsService

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { DateUtils } from "../components/CustomDatePicker/CustomDatePicker";

// ИСПРАВЛЕНО: Структура интерфейса для полной совместимости с LogDetailsDialog
export interface IScheduleLogLookup {
  Id: string;
  Title: string;
}

export interface IScheduleLog {
  ID: string;
  Title: string;
  Result: number;
  Message: string;
  Date: Date;
  // Для обратной совместимости - ID поля
  StaffMemberId?: string;
  ManagerId?: string;
  StaffGroupId?: string;
  WeeklyTimeTableId?: string;
  WeeklyTimeTableTitle?: string;
  // Для LogDetailsDialog - объекты lookup
  Manager?: IScheduleLogLookup;
  StaffMember?: IScheduleLogLookup;
  StaffGroup?: IScheduleLogLookup;
  WeeklyTimeTable?: IScheduleLogLookup;
  Created: Date;
  Modified: Date;
}

export interface ICreateScheduleLogParams {
  title: string;
  result: number;
  message: string;
  date: Date;
  staffMemberId?: string;
  managerId?: string;
  staffGroupId?: string;
  weeklyTimeTableId?: string;
}

export interface IGetScheduleLogsParams {
  staffMemberId?: string;
  managerId?: string;
  staffGroupId?: string;
  periodDate?: Date;
  top?: number;
  skip?: number;
}

export interface IScheduleLogsResult {
  logs: IScheduleLog[];
  totalCount: number;
  error?: string;
}

export class ScheduleLogsService {
  private static _instance: ScheduleLogsService;
  private _listName: string = "ScheduleLogs";
  private _logSource: string = "ScheduleLogsService";
  private _remoteSiteService: RemoteSiteService;

  private constructor(context: WebPartContext) {
    console.log('[ScheduleLogsService] Инициализация с серверной фильтрацией по образцу ContractsService');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService initialized with server-side filtering like ContractsService");
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] Создание нового экземпляра с серверной фильтрацией');
      ScheduleLogsService._instance = new ScheduleLogsService(context);
    }
    return ScheduleLogsService._instance;
  }

  // СКОПИРОВАНО ИЗ ContractsService: Вспомогательные методы для преобразования типов
  private ensureString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  private ensureNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  // СКОПИРОВАНО ИЗ ContractsService: Преобразует значение в дату с нормализацией через DateUtils
  private ensureDate(value: unknown): Date {
    if (value === null || value === undefined) {
      return new Date();
    }
    
    try {
      let date: Date;
      
      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'string') {
        date = new Date(value);
        if (isNaN(date.getTime())) {
          this.logInfo(`[DEBUG] Invalid date string for ensureDate: ${value}`);
          return new Date();
        }
      } else {
        this.logInfo(`[DEBUG] Unsupported date type for ensureDate: ${typeof value}`);
        return new Date();
      }
      
      // Нормализуем дату через DateUtils как в ContractsService
      const normalizedDate = DateUtils.normalizeDateToUTCMidnight(date);
      return normalizedDate;
    } catch (error) {
      this.logError(`Error converting date: ${error}`);
      return new Date();
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Формирует серверный фильтр для ScheduleLogs по образцу ContractsService ***
   */
  private buildServerFilter(params: IGetScheduleLogsParams): string | undefined {
    const filterParts: string[] = [];

    // Фильтр по StaffMemberId
    if (params.staffMemberId && params.staffMemberId !== '' && params.staffMemberId !== '0') {
      const staffMemberIdNum = parseInt(params.staffMemberId, 10);
      if (!isNaN(staffMemberIdNum)) {
        filterParts.push(`fields/StaffMemberLookupId eq ${staffMemberIdNum}`);
        this.logInfo(`Adding StaffMember filter: StaffMemberLookupId eq ${staffMemberIdNum}`);
      }
    }

    // Фильтр по ManagerId
    if (params.managerId && params.managerId !== '' && params.managerId !== '0') {
      const managerIdNum = parseInt(params.managerId, 10);
      if (!isNaN(managerIdNum)) {
        filterParts.push(`fields/ManagerLookupId eq ${managerIdNum}`);
        this.logInfo(`Adding Manager filter: ManagerLookupId eq ${managerIdNum}`);
      }
    }

    // Фильтр по StaffGroupId
    if (params.staffGroupId && params.staffGroupId !== '' && params.staffGroupId !== '0') {
      const staffGroupIdNum = parseInt(params.staffGroupId, 10);
      if (!isNaN(staffGroupIdNum)) {
        filterParts.push(`fields/StaffGroupLookupId eq ${staffGroupIdNum}`);
        this.logInfo(`Adding StaffGroup filter: StaffGroupLookupId eq ${staffGroupIdNum}`);
      }
    }

    // *** ИСПРАВЛЕНО: Фильтр по дате с UTC границами месяца ***
    if (params.periodDate) {
      const startOfMonth = new Date(Date.UTC(
        params.periodDate.getUTCFullYear(), 
        params.periodDate.getUTCMonth(), 
        1, 
        0, 0, 0, 0
      ));
      
      const endOfMonth = new Date(Date.UTC(
        params.periodDate.getUTCFullYear(), 
        params.periodDate.getUTCMonth() + 1, 
        0, 
        23, 59, 59, 999
      ));

      // OData формат для дат в Graph API
      const startDateISO = startOfMonth.toISOString();
      const endDateISO = endOfMonth.toISOString();
      
      filterParts.push(`(fields/Date ge '${startDateISO}' and fields/Date le '${endDateISO}')`);
      this.logInfo(`Adding Date filter: Date between ${startDateISO} and ${endDateISO}`);
    }

    if (filterParts.length > 0) {
      const filter = filterParts.join(' and ');
      this.logInfo(`Built server filter: ${filter}`);
      return filter;
    }

    this.logInfo('No server filter needed - returning all records');
    return undefined;
  }

  /**
   * *** НОВЫЙ МЕТОД: Анализирует структуру полей ScheduleLogs по образцу ContractsService ***
   */
  private async analyzeScheduleLogsFields(): Promise<{
    staffMemberField: string;
    managerField: string;
    staffGroupField: string;
    weeklyTimeTableField: string;
  }> {
    try {
      this.logInfo('Analyzing ScheduleLogs field structure like ContractsService does');
      
      // Получаем образцы для анализа структуры
      const sampleItems = await this._remoteSiteService.getListItems(
        this._listName, 
        true,
        undefined,  // Без фильтра
        { field: "Title", ascending: true }
      );
      
      let staffMemberField = "StaffMemberLookupId";
      let managerField = "ManagerLookupId";
      let staffGroupField = "StaffGroupLookupId";
      let weeklyTimeTableField = "WeeklyTimeTableLookupId";
      
      if (sampleItems.length > 0) {
        const sampleItem = sampleItems[0];
        const fields = sampleItem.fields || {};
        
        this.logInfo(`Sample ScheduleLogs item structure: ${JSON.stringify(fields, null, 2)}`);
        
        // Определяем правильные имена полей для lookup-полей
        if (fields.StaffMemberLookupId !== undefined) {
          staffMemberField = "StaffMemberLookupId";
          this.logInfo(`Using field name "${staffMemberField}" for StaffMember filtering`);
        } else if (fields.StaffMemberId !== undefined) {
          staffMemberField = "StaffMemberId";
          this.logInfo(`Using field name "${staffMemberField}" for StaffMember filtering`);
        }
        
        if (fields.ManagerLookupId !== undefined) {
          managerField = "ManagerLookupId";
          this.logInfo(`Using field name "${managerField}" for Manager filtering`);
        } else if (fields.ManagerId !== undefined) {
          managerField = "ManagerId";
          this.logInfo(`Using field name "${managerField}" for Manager filtering`);
        }
        
        if (fields.StaffGroupLookupId !== undefined) {
          staffGroupField = "StaffGroupLookupId";
          this.logInfo(`Using field name "${staffGroupField}" for StaffGroup filtering`);
        } else if (fields.StaffGroupId !== undefined) {
          staffGroupField = "StaffGroupId";
          this.logInfo(`Using field name "${staffGroupField}" for StaffGroup filtering`);
        }
        
        if (fields.WeeklyTimeTableLookupId !== undefined) {
          weeklyTimeTableField = "WeeklyTimeTableLookupId";
          this.logInfo(`Using field name "${weeklyTimeTableField}" for WeeklyTimeTable filtering`);
        } else if (fields.WeeklyTimeTableId !== undefined) {
          weeklyTimeTableField = "WeeklyTimeTableId";
          this.logInfo(`Using field name "${weeklyTimeTableField}" for WeeklyTimeTable filtering`);
        }
      } else {
        this.logInfo(`No sample items found in list "${this._listName}". Using default field names.`);
      }
      
      return {
        staffMemberField,
        managerField,
        staffGroupField,
        weeklyTimeTableField
      };
    } catch (error) {
      this.logError(`Error analyzing ScheduleLogs fields: ${error}`);
      // Возвращаем значения по умолчанию
      return {
        staffMemberField: "StaffMemberLookupId",
        managerField: "ManagerLookupId",
        staffGroupField: "StaffGroupLookupId",
        weeklyTimeTableField: "WeeklyTimeTableLookupId"
      };
    }
  }

  /**
   * *** ИСПРАВЛЕНО: Получает логи С СЕРВЕРНОЙ ФИЛЬТРАЦИЕЙ по образцу ContractsService ***
   */
  public async getScheduleLogs(params: IGetScheduleLogsParams = {}): Promise<IScheduleLogsResult> {
    try {
      this.logInfo(`Fetching schedule logs WITH SERVER-SIDE FILTERING like ContractsService`);
      this.logInfo(`Parameters: ${JSON.stringify(params)}`);

      // *** ШАГ 1: АНАЛИЗ СТРУКТУРЫ ПОЛЕЙ (ОДИН РАЗ) ***
      const fieldNames = await this.analyzeScheduleLogsFields();
      
      // *** ШАГ 2: СТРОИМ СЕРВЕРНЫЙ ФИЛЬТР ***
      const serverFilter = this.buildServerFilter(params);
      
      // *** ШАГ 3: ВЫПОЛНЯЕМ ЗАПРОС С СЕРВЕРНОЙ ФИЛЬТРАЦИЕЙ ***
      this.logInfo(`Executing request with server filter: ${serverFilter || 'no filter'}`);
      
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true,
        serverFilter, // *** СЕРВЕРНАЯ ФИЛЬТРАЦИЯ! ***
        { field: "Created", ascending: false } // Сортируем по дате создания (новые сначала)
      );
      
      this.logInfo(`Retrieved ${items.length} schedule logs with server-side filtering`);
      
      // *** ШАГ 4: ПРЕОБРАЗУЕМ ДАННЫЕ В ФОРМАТ IScheduleLog ***
      const logs: IScheduleLog[] = [];
      
      for (const item of items) {
        try {
          const fields = item.fields || {};
          
          // Создаем lookup объекты для LogDetailsDialog
          const createLookupInfo = (lookupIdField: string, lookupTitleField: string): IScheduleLogLookup | undefined => {
            const id = fields[lookupIdField];
            const title = fields[lookupTitleField];
            if (id && title) {
              return {
                Id: this.ensureString(id),
                Title: this.ensureString(title)
              };
            }
            return undefined;
          };

          const log: IScheduleLog = {
            ID: this.ensureString(item.id),
            Title: this.ensureString(fields.Title),
            Result: this.ensureNumber(fields.Result),
            Message: this.ensureString(fields.Message),
            Date: this.ensureDate(fields.Date),
            // ID поля для обратной совместимости
            StaffMemberId: fields[fieldNames.staffMemberField] ? this.ensureString(fields[fieldNames.staffMemberField]) : undefined,
            ManagerId: fields[fieldNames.managerField] ? this.ensureString(fields[fieldNames.managerField]) : undefined,
            StaffGroupId: fields[fieldNames.staffGroupField] ? this.ensureString(fields[fieldNames.staffGroupField]) : undefined,
            WeeklyTimeTableId: fields[fieldNames.weeklyTimeTableField] ? this.ensureString(fields[fieldNames.weeklyTimeTableField]) : undefined,
            WeeklyTimeTableTitle: fields.WeeklyTimeTableLookup ? this.ensureString(fields.WeeklyTimeTableLookup) : undefined,
            // Объекты lookup для LogDetailsDialog
            Manager: createLookupInfo('ManagerLookupId', 'ManagerLookup'),
            StaffMember: createLookupInfo('StaffMemberLookupId', 'StaffMemberLookup'),
            StaffGroup: createLookupInfo('StaffGroupLookupId', 'StaffGroupLookup'),
            WeeklyTimeTable: createLookupInfo('WeeklyTimeTableLookupId', 'WeeklyTimeTableLookup'),
            Created: this.ensureDate(fields.Created),
            Modified: this.ensureDate(fields.Modified)
          };
          
          logs.push(log);
        } catch (itemError) {
          this.logError(`Error processing log item: ${itemError}`);
        }
      }

      // *** ШАГ 5: ПРИМЕНЯЕМ КЛИЕНТСКУЮ ПАГИНАЦИЮ (если нужно) ***
      let paginatedLogs = logs;
      if (params.top || params.skip) {
        const skip = params.skip || 0;
        const top = params.top || 50;
        paginatedLogs = logs.slice(skip, skip + top);
        this.logInfo(`Applied pagination (skip: ${skip}, top: ${top}): ${paginatedLogs.length} logs from ${logs.length} total`);
      }
      
      this.logInfo(`Successfully fetched ${paginatedLogs.length} logs with server-side filtering`);
      
      return {
        logs: paginatedLogs,
        totalCount: logs.length,
        error: undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Error fetching schedule logs with server filtering: ${errorMessage}`);
      
      return {
        logs: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Создает лог операции используя паттерн из ContractsService
   */
  public async createScheduleLog(params: ICreateScheduleLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`Creating schedule log using ContractsService pattern`);
      this.logInfo(`Parameters: ${JSON.stringify(params)}`);

      // СКОПИРОВАНО ИЗ ContractsService: Подготавливаем данные для MS Graph API
      const itemData: Record<string, unknown> = {
        Title: params.title,
        Result: params.result,
        Message: params.message
      };

      // СКОПИРОВАНО ИЗ ContractsService: Добавляем дату с нормализацией через DateUtils
      if (params.date) {
        const normalizedDate = DateUtils.normalizeDateToUTCMidnight(params.date);
        itemData.Date = normalizedDate.toISOString();
        this.logInfo(`[DEBUG] Date normalized: ${params.date.toISOString()} → ${normalizedDate.toISOString()}`);
      }

      // СКОПИРОВАНО ИЗ ContractsService: Добавляем lookup поля если они есть
      if (params.staffMemberId && params.staffMemberId !== '' && params.staffMemberId !== '0') {
        try {
          const staffMemberId = parseInt(params.staffMemberId, 10);
          if (!isNaN(staffMemberId)) {
            itemData.StaffMemberLookupId = staffMemberId;
          }
        } catch (e) {
          console.warn(`Could not parse staffMemberId: ${params.staffMemberId}`, e);
        }
      }

      if (params.managerId && params.managerId !== '' && params.managerId !== '0') {
        try {
          const managerId = parseInt(params.managerId, 10);
          if (!isNaN(managerId)) {
            itemData.ManagerLookupId = managerId;
          }
        } catch (e) {
          console.warn(`Could not parse managerId: ${params.managerId}`, e);
        }
      }

      if (params.staffGroupId && params.staffGroupId !== '' && params.staffGroupId !== '0') {
        try {
          const staffGroupId = parseInt(params.staffGroupId, 10);
          if (!isNaN(staffGroupId)) {
            itemData.StaffGroupLookupId = staffGroupId;
          }
        } catch (e) {
          console.warn(`Could not parse staffGroupId: ${params.staffGroupId}`, e);
        }
      }

      if (params.weeklyTimeTableId && params.weeklyTimeTableId !== '' && params.weeklyTimeTableId !== '0') {
        try {
          const weeklyTimeTableId = parseInt(params.weeklyTimeTableId, 10);
          if (!isNaN(weeklyTimeTableId)) {
            itemData.WeeklyTimeTableLookupId = weeklyTimeTableId;
          }
        } catch (e) {
          console.warn(`Could not parse weeklyTimeTableId: ${params.weeklyTimeTableId}`, e);
        }
      }

      this.logInfo(`Prepared item data for save: ${JSON.stringify(itemData, null, 2)}`);

      // СКОПИРОВАНО ИЗ ContractsService: Создаем новый элемент через RemoteSiteService
      try {
        const listId = await this._remoteSiteService.getListId(this._listName);
        
        const response = await this._remoteSiteService.addListItem(
          listId,
          itemData
        );
        
        if (response && response.id) {
          const result = this.ensureString(response.id);
          this.logInfo(`Created new schedule log with ID: ${result}`);
          return result;
        } else {
          throw new Error('Failed to get ID from the created item');
        }
      } catch (error) {
        this.logError(`Error creating new schedule log: ${error}`);
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Error creating schedule log: ${errorMessage}`);
      return undefined;
    }
  }

  /**
   * Получает конкретный лог по ID используя прямой доступ (без фильтрации)
   */
  public async getScheduleLogById(logId: string): Promise<IScheduleLog | undefined> {
    try {
      this.logInfo(`Getting schedule log by ID: ${logId} using direct access (no filtering)`);

      // ИСПРАВЛЕНО: Используем прямой доступ к элементу по ID через RemoteSiteService
      const logIdNumber = parseInt(logId, 10);
      if (isNaN(logIdNumber)) {
        this.logError(`Invalid logId format: ${logId}`);
        return undefined;
      }

      // Используем метод getListItem из RemoteSiteService для прямого доступа
      const item = await this._remoteSiteService.getListItem(
        this._listName,
        logIdNumber,
        true // expandFields
      );

      if (item) {
        const fields = item.fields || {};

        const createLookupInfo = (lookupIdField: string, lookupTitleField: string): IScheduleLogLookup | undefined => {
          const id = fields[lookupIdField];
          const title = fields[lookupTitleField];
          if (id && title) {
            return {
              Id: this.ensureString(id),
              Title: this.ensureString(title)
            };
          }
          return undefined;
        };

        const log: IScheduleLog = {
          ID: this.ensureString(item.id),
          Title: this.ensureString(fields.Title),
          Result: this.ensureNumber(fields.Result),
          Message: this.ensureString(fields.Message),
          Date: this.ensureDate(fields.Date),
          StaffMemberId: fields.StaffMemberLookupId ? this.ensureString(fields.StaffMemberLookupId) : undefined,
          ManagerId: fields.ManagerLookupId ? this.ensureString(fields.ManagerLookupId) : undefined,
          StaffGroupId: fields.StaffGroupLookupId ? this.ensureString(fields.StaffGroupLookupId) : undefined,
          WeeklyTimeTableId: fields.WeeklyTimeTableLookupId ? this.ensureString(fields.WeeklyTimeTableLookupId) : undefined,
          WeeklyTimeTableTitle: fields.WeeklyTimeTableLookup ? this.ensureString(fields.WeeklyTimeTableLookup) : undefined,
          Manager: createLookupInfo('ManagerLookupId', 'ManagerLookup'),
          StaffMember: createLookupInfo('StaffMemberLookupId', 'StaffMemberLookup'),
          StaffGroup: createLookupInfo('StaffGroupLookupId', 'StaffGroupLookup'),
          WeeklyTimeTable: createLookupInfo('WeeklyTimeTableLookupId', 'WeeklyTimeTableLookup'),
          Created: this.ensureDate(fields.Created),
          Modified: this.ensureDate(fields.Modified)
        };

        this.logInfo(`Successfully retrieved log using direct access: ${log.Title}`);
        return log;
      } else {
        this.logInfo(`Log with ID ${logId} not found using direct access`);
        return undefined;
      }

    } catch (error) {
      this.logError(`Error getting schedule log by ID ${logId} using direct access: ${error}`);
      return undefined;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает статистику логов с серверной фильтрацией ***
   */
  public async getScheduleLogsStats(params: IGetScheduleLogsParams = {}): Promise<{
    totalLogs: number;
    successCount: number;
    errorCount: number;
    infoCount: number;
  }> {
    try {
      this.logInfo(`Getting schedule logs statistics with server filtering`);
      
      // Получаем все логи с серверной фильтрацией
      const result = await this.getScheduleLogs(params);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      const logs = result.logs;
      
      // Подсчитываем статистику
      const stats = {
        totalLogs: logs.length,
        successCount: logs.filter(log => log.Result === 2).length,
        errorCount: logs.filter(log => log.Result === 1).length,
        infoCount: logs.filter(log => log.Result === 3).length
      };
      
      this.logInfo(`Schedule logs statistics: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error) {
      this.logError(`Error getting schedule logs statistics: ${error}`);
      return {
        totalLogs: 0,
        successCount: 0,
        errorCount: 0,
        infoCount: 0
      };
    }
  }

  /**
   * СКОПИРОВАНО ИЗ ContractsService: Статический метод для очистки экземпляра
   */
  public static clearInstance(): void {
    ScheduleLogsService._instance = undefined as unknown as ScheduleLogsService;
    console.log('[ScheduleLogsService] Instance cleared');
  }

  /**
   * СКОПИРОВАНО ИЗ ContractsService: Helper method to log info messages
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * СКОПИРОВАНО ИЗ ContractsService: Helper method to log error messages
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}