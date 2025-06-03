// src/webparts/kpfaplus/services/ScheduleLogsService.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { 
  IGetPaginatedListItemsOptions, 
  IRemotePaginatedItemsResponse,
  IRemoteListItemResponse 
} from "./RemoteSiteInterfaces";

// Интерфейсы остаются без изменений...
export interface IScheduleLog {
  ID: string;
  Title: string;
  Manager: IScheduleLogLookup | undefined;
  StaffMember: IScheduleLogLookup | undefined;
  StaffGroup: IScheduleLogLookup | undefined;
  WeeklyTimeTable: IScheduleLogLookup | undefined;
  Result: number;
  Message: string;
  Created: Date;
  Modified: Date;
}

export interface IScheduleLogLookup {
  Id: string;
  Title: string;
}

export interface IRawScheduleLog {
  ID?: string | number;
  Title?: string;
  Manager?: {
    Id?: string | number;
    ID?: string | number;
    Title?: string;
  };
  StaffMember?: {
    Id?: string | number;
    ID?: string | number;
    Title?: string;
  };
  StaffGroup?: {
    Id?: string | number;
    ID?: string | number;
    Title?: string;
  };
  WeeklyTimeTable?: {
    Id?: string | number;
    ID?: string | number;
    Title?: string;
  };
  Result?: number | string;
  Message?: string;
  Created?: string;
  Modified?: string;
  [key: string]: unknown;
}

export interface ICreateScheduleLogParams {
  title: string;
  managerId?: string | number;
  staffMemberId?: string | number;
  staffGroupId?: string | number;
  weeklyTimeTableId?: string | number;
  result: number;
  message: string;
}

export interface IUpdateScheduleLogParams {
  title?: string;
  managerId?: string | number;
  staffMemberId?: string | number;
  staffGroupId?: string | number;
  weeklyTimeTableId?: string | number;
  result?: number;
  message?: string;
}

export interface IScheduleLogsResult {
  logs: IScheduleLog[];
  totalCount: number;
  error?: string;
}

export interface IScheduleLogsQueryParams {
  startDate?: Date;
  endDate?: Date;
  managerId?: string | number;
  staffMemberId?: string | number;
  staffGroupId?: string | number;
  result?: number;
  skip?: number;
  top?: number;
}

export class ScheduleLogsService {
  private static _instance: ScheduleLogsService;
  private _logSource: string = "ScheduleLogsService";
  private _listName: string = "ScheduleLogs";
  private _remoteSiteService: RemoteSiteService;

  private constructor(context: WebPartContext) {
    console.log('[ScheduleLogsService] Инициализация с исправленными полями фильтрации');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService инициализирован с исправлениями фильтрации");
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] Создание нового экземпляра с исправлениями');
      ScheduleLogsService._instance = new ScheduleLogsService(context);
    }
    return ScheduleLogsService._instance;
  }

  public async createScheduleLog(params: ICreateScheduleLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`[DEBUG] Создание нового лога: ${params.title}`);
      
      const fields = this.prepareFieldsForCreate(params);
      this.logInfo(`[DEBUG] Подготовленные поля для создания: ${JSON.stringify(fields, null, 2)}`);

      const result = await this._remoteSiteService.createListItem(this._listName, fields);

      if (result && result.id) {
        this.logInfo(`[DEBUG] Успешно создан лог с ID: ${result.id}`);
        return result.id.toString();
      } else {
        this.logError(`[ERROR] Не удалось создать лог - не получен ID`);
        return undefined;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Ошибка при создании лога: ${errorMessage}`);
      return undefined;
    }
  }

  public async getScheduleLogs(params?: IScheduleLogsQueryParams): Promise<IScheduleLogsResult> {
    try {
      this.logInfo(`[DEBUG] Получение логов с исправленными параметрами: ${JSON.stringify(params || {})}`);

      // ИСПРАВЛЕНО: Строим фильтр для запроса с правильными полями
      const filter = this.buildFilter(params);
      // ИСПРАВЛЕНО: Правильное поле для сортировки через fields
      const orderBy = { field: 'fields/Created', ascending: false };

      this.logInfo(`[DEBUG] Исправленный фильтр: ${filter || 'отсутствует'}`);
      this.logInfo(`[DEBUG] Исправленная сортировка: ${JSON.stringify(orderBy)}`);

      const options: IGetPaginatedListItemsOptions = {
        expandFields: true,
        filter: filter,
        orderBy: orderBy,
        top: params?.top || 50,
        skip: params?.skip || 0
      };

      const response: IRemotePaginatedItemsResponse = await this._remoteSiteService.getPaginatedItemsFromList(
        this._listName,
        options
      );

      this.logInfo(`[DEBUG] Получено ${response.items.length} записей из ${response.totalCount} общих`);

      const mappedLogs = response.items.map((item: IRemoteListItemResponse) => this.mapRawToScheduleLog(item));

      return {
        logs: mappedLogs,
        totalCount: response.totalCount,
        error: undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Ошибка при получении логов: ${errorMessage}`);

      return {
        logs: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  public async getScheduleLogById(logId: string | number): Promise<IScheduleLog | undefined> {
    try {
      this.logInfo(`[DEBUG] Получение лога по ID: ${logId}`);

      const item = await this._remoteSiteService.getListItem(
        this._listName,
        Number(logId),
        true
      );

      if (!item) {
        this.logInfo(`[DEBUG] Лог с ID ${logId} не найден`);
        return undefined;
      }

      const mappedLog = this.mapRawToScheduleLog(item);
      this.logInfo(`[DEBUG] Успешно получен лог: ${mappedLog.Title}`);

      return mappedLog;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Ошибка при получении лога ID ${logId}: ${errorMessage}`);
      return undefined;
    }
  }

  public async updateScheduleLog(logId: string | number, params: IUpdateScheduleLogParams): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Обновление лога ID: ${logId}`);

      const fields = this.prepareFieldsForUpdate(params);

      if (Object.keys(fields).length === 0) {
        this.logInfo(`[DEBUG] Нет полей для обновления лога ID: ${logId}`);
        return true;
      }

      const success = await this._remoteSiteService.updateListItem(
        this._listName,
        Number(logId),
        fields
      );

      if (success) {
        this.logInfo(`[DEBUG] Лог ID: ${logId} успешно обновлен`);
      } else {
        this.logError(`[ERROR] Не удалось обновить лог ID: ${logId}`);
      }

      return success;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Ошибка при обновлении лога ID ${logId}: ${errorMessage}`);
      return false;
    }
  }

  public async deleteScheduleLog(logId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Удаление лога ID: ${logId}`);

      const success = await this._remoteSiteService.deleteListItem(this._listName, logId);

      if (success) {
        this.logInfo(`[DEBUG] Лог ID: ${logId} успешно удален`);
      } else {
        this.logError(`[ERROR] Не удалось удалить лог ID: ${logId}`);
      }

      return success;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Ошибка при удалении лога ID ${logId}: ${errorMessage}`);
      return false;
    }
  }

  private prepareFieldsForCreate(params: ICreateScheduleLogParams): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    fields.Title = params.title;
    fields.Result = params.result;
    fields.Message = params.message;

    // ИСПРАВЛЕНО: Lookup поля с правильными названиями
    if (params.managerId && String(params.managerId).trim() !== '' && String(params.managerId) !== '0') {
      try {
        const managerId = parseInt(String(params.managerId), 10);
        if (!isNaN(managerId)) {
          fields.ManagerLookupId = managerId;
          this.logInfo(`[DEBUG] Установлен ManagerLookupId: ${managerId}`);
        }
      } catch (error) {
        this.logError(`[ERROR] Ошибка парсинга managerId: ${params.managerId}`);
      }
    }

    if (params.staffMemberId && String(params.staffMemberId).trim() !== '' && String(params.staffMemberId) !== '0') {
      try {
        const staffMemberId = parseInt(String(params.staffMemberId), 10);
        if (!isNaN(staffMemberId)) {
          fields.StaffMemberLookupId = staffMemberId;
          this.logInfo(`[DEBUG] Установлен StaffMemberLookupId: ${staffMemberId}`);
        }
      } catch (error) {
        this.logError(`[ERROR] Ошибка парсинга staffMemberId: ${params.staffMemberId}`);
      }
    }

    if (params.staffGroupId && String(params.staffGroupId).trim() !== '' && String(params.staffGroupId) !== '0') {
      try {
        const staffGroupId = parseInt(String(params.staffGroupId), 10);
        if (!isNaN(staffGroupId)) {
          fields.StaffGroupLookupId = staffGroupId;
          this.logInfo(`[DEBUG] Установлен StaffGroupLookupId: ${staffGroupId}`);
        }
      } catch (error) {
        this.logError(`[ERROR] Ошибка парсинга staffGroupId: ${params.staffGroupId}`);
      }
    }

    if (params.weeklyTimeTableId && String(params.weeklyTimeTableId).trim() !== '' && String(params.weeklyTimeTableId) !== '0') {
      try {
        const weeklyTimeTableId = parseInt(String(params.weeklyTimeTableId), 10);
        if (!isNaN(weeklyTimeTableId)) {
          fields.WeeklyTimeTableLookupId = weeklyTimeTableId;
          this.logInfo(`[DEBUG] Установлен WeeklyTimeTableLookupId: ${weeklyTimeTableId}`);
        }
      } catch (error) {
        this.logError(`[ERROR] Ошибка парсинга weeklyTimeTableId: ${params.weeklyTimeTableId}`);
      }
    }

    return fields;
  }

  private prepareFieldsForUpdate(params: IUpdateScheduleLogParams): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    if (params.title !== undefined) {
      fields.Title = params.title;
    }

    if (params.result !== undefined) {
      fields.Result = params.result;
    }

    if (params.message !== undefined) {
      fields.Message = params.message;
    }

    // ИСПРАВЛЕНО: Lookup поля для обновления с правильными названиями
    if (params.managerId !== undefined) {
      if (params.managerId === '' || params.managerId === null || params.managerId === '0') {
        fields.ManagerLookupId = null;
      } else {
        try {
          const managerId = parseInt(String(params.managerId), 10);
          if (!isNaN(managerId)) {
            fields.ManagerLookupId = managerId;
          }
        } catch (error) {
          this.logError(`[ERROR] Ошибка парсинга managerId для обновления: ${params.managerId}`);
        }
      }
    }

    if (params.staffMemberId !== undefined) {
      if (params.staffMemberId === '' || params.staffMemberId === null || params.staffMemberId === '0') {
        fields.StaffMemberLookupId = null;
      } else {
        try {
          const staffMemberId = parseInt(String(params.staffMemberId), 10);
          if (!isNaN(staffMemberId)) {
            fields.StaffMemberLookupId = staffMemberId;
          }
        } catch (error) {
          this.logError(`[ERROR] Ошибка парсинга staffMemberId для обновления: ${params.staffMemberId}`);
        }
      }
    }

    if (params.staffGroupId !== undefined) {
      if (params.staffGroupId === '' || params.staffGroupId === null || params.staffGroupId === '0') {
        fields.StaffGroupLookupId = null;
      } else {
        try {
          const staffGroupId = parseInt(String(params.staffGroupId), 10);
          if (!isNaN(staffGroupId)) {
            fields.StaffGroupLookupId = staffGroupId;
          }
        } catch (error) {
          this.logError(`[ERROR] Ошибка парсинга staffGroupId для обновления: ${params.staffGroupId}`);
        }
      }
    }

    if (params.weeklyTimeTableId !== undefined) {
      if (params.weeklyTimeTableId === '' || params.weeklyTimeTableId === null || params.weeklyTimeTableId === '0') {
        fields.WeeklyTimeTableLookupId = null;
      } else {
        try {
          const weeklyTimeTableId = parseInt(String(params.weeklyTimeTableId), 10);
          if (!isNaN(weeklyTimeTableId)) {
            fields.WeeklyTimeTableLookupId = weeklyTimeTableId;
          }
        } catch (error) {
          this.logError(`[ERROR] Ошибка парсинга weeklyTimeTableId для обновления: ${params.weeklyTimeTableId}`);
        }
      }
    }

    return fields;
  }

  /**
   * ИСПРАВЛЕНО: Строит фильтр для запроса с правильными названиями полей
   */
  private buildFilter(params?: IScheduleLogsQueryParams): string | undefined {
    if (!params) return undefined;

    const filters: string[] = [];

    // Фильтр по дате создания - используем fields/ префикс
    if (params.startDate) {
      filters.push(`fields/Created ge '${params.startDate.toISOString()}'`);
    }

    if (params.endDate) {
      filters.push(`fields/Created le '${params.endDate.toISOString()}'`);
    }

    // ИСПРАВЛЕНО: Фильтры по lookup полям - используем fields/ префикс и LookupId суффикс
    if (params.managerId && String(params.managerId) !== '0') {
      filters.push(`fields/ManagerLookupId eq ${params.managerId}`);
    }

    if (params.staffMemberId && String(params.staffMemberId) !== '0') {
      filters.push(`fields/StaffMemberLookupId eq ${params.staffMemberId}`);
    }

    if (params.staffGroupId && String(params.staffGroupId) !== '0') {
      filters.push(`fields/StaffGroupLookupId eq ${params.staffGroupId}`);
    }

    // Фильтр по результату - используем fields/ префикс
    if (params.result !== undefined) {
      filters.push(`fields/Result eq ${params.result}`);
    }

    const resultFilter = filters.length > 0 ? filters.join(' and ') : undefined;
    this.logInfo(`[DEBUG] Построенный фильтр: ${resultFilter || 'отсутствует'}`);
    
    return resultFilter;
  }

  private mapRawToScheduleLog(raw: IRawScheduleLog): IScheduleLog {
    const mapLookup = (lookup: any): IScheduleLogLookup | undefined => {
      if (!lookup) return undefined;
      
      const id = lookup.Id || lookup.ID;
      const title = lookup.Title;
      
      if (id && title) {
        return {
          Id: String(id),
          Title: String(title)
        };
      }
      
      return undefined;
    };

    return {
      ID: String(raw.ID || ''),
      Title: String(raw.Title || ''),
      Manager: mapLookup(raw.Manager),
      StaffMember: mapLookup(raw.StaffMember),
      StaffGroup: mapLookup(raw.StaffGroup),
      WeeklyTimeTable: mapLookup(raw.WeeklyTimeTable),
      Result: typeof raw.Result === 'string' ? parseInt(raw.Result, 10) : (raw.Result as number || 0),
      Message: String(raw.Message || ''),
      Created: raw.Created ? new Date(raw.Created) : new Date(),
      Modified: raw.Modified ? new Date(raw.Modified) : new Date()
    };
  }

  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }

  public static clearInstance(): void {
    ScheduleLogsService._instance = undefined as any;
    console.log('[ScheduleLogsService] Instance cleared');
  }
}