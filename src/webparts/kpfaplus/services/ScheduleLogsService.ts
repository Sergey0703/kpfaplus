// src/webparts/kpfaplus/services/ScheduleLogsService.ts
// ИСПРАВЛЕНО: Использует проверенные паттерны из ContractsService.ts

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
    console.log('[ScheduleLogsService] Инициализация по образцу ContractsService');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService initialized with RemoteSiteService pattern from ContractsService");
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] Создание нового экземпляра по образцу ContractsService');
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

  // Удален неиспользуемый метод ensureBoolean

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
      if (params.staffMemberId && params.staffMemberId !== '') {
        try {
          const staffMemberId = parseInt(params.staffMemberId);
          if (!isNaN(staffMemberId)) {
            itemData.StaffMemberLookupId = staffMemberId;
          }
        } catch (e) {
          console.warn(`Could not parse staffMemberId: ${params.staffMemberId}`, e);
        }
      }

      if (params.managerId && params.managerId !== '') {
        try {
          const managerId = parseInt(params.managerId);
          if (!isNaN(managerId)) {
            itemData.ManagerLookupId = managerId;
          }
        } catch (e) {
          console.warn(`Could not parse managerId: ${params.managerId}`, e);
        }
      }

      if (params.staffGroupId && params.staffGroupId !== '') {
        try {
          const staffGroupId = parseInt(params.staffGroupId);
          if (!isNaN(staffGroupId)) {
            itemData.StaffGroupLookupId = staffGroupId;
          }
        } catch (e) {
          console.warn(`Could not parse staffGroupId: ${params.staffGroupId}`, e);
        }
      }

      if (params.weeklyTimeTableId && params.weeklyTimeTableId !== '') {
        try {
          const weeklyTimeTableId = parseInt(params.weeklyTimeTableId);
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
   * УПРОЩЕНО: Получает логи БЕЗ фильтрации сначала, как временное решение
   */
  public async getScheduleLogs(params: IGetScheduleLogsParams = {}): Promise<IScheduleLogsResult> {
    try {
      this.logInfo(`Fetching schedule logs WITHOUT filtering (temporary solution)`);
      this.logInfo(`Parameters: ${JSON.stringify(params)}`);

      // ВРЕМЕННО: Получаем ВСЕ записи без фильтрации
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true,
        undefined, // БЕЗ фильтра
        { field: "Title", ascending: true }
      );
      
      this.logInfo(`Retrieved ${items.length} schedule logs (all records)`);
      
      // Преобразуем данные в формат IScheduleLog
      const logs: IScheduleLog[] = [];
      
      for (const item of items) {
        try {
          const fields = item.fields || {};
          
          // СКОПИРОВАНО ИЗ ContractsService: Получаем информацию о lookup полях
          const createLookupInfo = (lookupField: unknown): IScheduleLogLookup | undefined => {
            if (!lookupField || typeof lookupField !== 'object') return undefined;
            const obj = lookupField as Record<string, unknown>;
            const id = obj.Id || obj.ID || obj.id;
            const title = obj.Title || obj.title;
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
            StaffMemberId: fields.StaffMemberLookupId ? this.ensureString(fields.StaffMemberLookupId) : undefined,
            ManagerId: fields.ManagerLookupId ? this.ensureString(fields.ManagerLookupId) : undefined,
            StaffGroupId: fields.StaffGroupLookupId ? this.ensureString(fields.StaffGroupLookupId) : undefined,
            WeeklyTimeTableId: fields.WeeklyTimeTableLookupId ? this.ensureString(fields.WeeklyTimeTableLookupId) : undefined,
            WeeklyTimeTableTitle: fields.WeeklyTimeTableLookup ? this.ensureString(fields.WeeklyTimeTableLookup) : undefined,
            // Объекты lookup для LogDetailsDialog
            Manager: createLookupInfo(fields.Manager),
            StaffMember: createLookupInfo(fields.StaffMember),
            StaffGroup: createLookupInfo(fields.StaffGroup),
            WeeklyTimeTable: createLookupInfo(fields.WeeklyTimeTable),
            Created: this.ensureDate(fields.Created),
            Modified: this.ensureDate(fields.Modified)
          };
          
          logs.push(log);
        } catch (itemError) {
          this.logError(`Error processing log item: ${itemError}`);
        }
      }

      // ПРИМЕНЯЕМ КЛИЕНТСКУЮ ФИЛЬТРАЦИЮ если нужно
      let filteredLogs = logs;

      if (params.staffMemberId && params.staffMemberId !== '') {
        filteredLogs = filteredLogs.filter(log => log.StaffMemberId === params.staffMemberId);
        this.logInfo(`Filtered by StaffMemberId ${params.staffMemberId}: ${filteredLogs.length} logs`);
      }

      if (params.managerId && params.managerId !== '') {
        filteredLogs = filteredLogs.filter(log => log.ManagerId === params.managerId);
        this.logInfo(`Filtered by ManagerId ${params.managerId}: ${filteredLogs.length} logs`);
      }

      if (params.staffGroupId && params.staffGroupId !== '') {
        filteredLogs = filteredLogs.filter(log => log.StaffGroupId === params.staffGroupId);
        this.logInfo(`Filtered by StaffGroupId ${params.staffGroupId}: ${filteredLogs.length} logs`);
      }

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

        filteredLogs = filteredLogs.filter(log => {
          const logDate = new Date(log.Date);
          return logDate >= startOfMonth && logDate <= endOfMonth;
        });
        this.logInfo(`Filtered by period ${params.periodDate.toLocaleDateString()}: ${filteredLogs.length} logs`);
      }

      // Применяем пагинацию если нужно
      if (params.top || params.skip) {
        const skip = params.skip || 0;
        const top = params.top || 50;
        filteredLogs = filteredLogs.slice(skip, skip + top);
        this.logInfo(`Applied pagination (skip: ${skip}, top: ${top}): ${filteredLogs.length} logs`);
      }
      
      return {
        logs: filteredLogs,
        totalCount: filteredLogs.length,
        error: undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Error fetching schedule logs: ${errorMessage}`);
      
      return {
        logs: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Получает конкретный лог по ID используя паттерн из ContractsService
   */
  public async getScheduleLogById(logId: string): Promise<IScheduleLog | undefined> {
    try {
      this.logInfo(`Getting schedule log by ID: ${logId}`);

      // Используем тот же подход что и в ContractsService
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true,
        `Id eq ${logId}`,
        { field: "Title", ascending: true }
      );

      if (items.length > 0) {
        const item = items[0];
        const fields = item.fields || {};

        const createLookupInfo = (lookupField: unknown): IScheduleLogLookup | undefined => {
          if (!lookupField || typeof lookupField !== 'object') return undefined;
          const obj = lookupField as Record<string, unknown>;
          const id = obj.Id || obj.ID || obj.id;
          const title = obj.Title || obj.title;
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
          Manager: createLookupInfo(fields.Manager),
          StaffMember: createLookupInfo(fields.StaffMember),
          StaffGroup: createLookupInfo(fields.StaffGroup),
          WeeklyTimeTable: createLookupInfo(fields.WeeklyTimeTable),
          Created: this.ensureDate(fields.Created),
          Modified: this.ensureDate(fields.Modified)
        };

        this.logInfo(`Successfully retrieved log: ${log.Title}`);
        return log;
      } else {
        this.logInfo(`Log with ID ${logId} not found`);
        return undefined;
      }

    } catch (error) {
      this.logError(`Error getting schedule log by ID ${logId}: ${error}`);
      return undefined;
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