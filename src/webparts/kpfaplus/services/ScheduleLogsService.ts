// src/webparts/kpfaplus/services/ScheduleLogsService.ts - ПОЛНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { 
  IGetPaginatedListItemsOptions, 
  IRemotePaginatedItemsResponse,
  IRemoteListItemResponse 
} from "./RemoteSiteInterfaces";

// Интерфейс для записи лога операций заполнения расписания
export interface IScheduleLog {
  ID: string;
  Title: string;
  Manager: IScheduleLogLookup | undefined;
  StaffMember: IScheduleLogLookup | undefined;
  StaffGroup: IScheduleLogLookup | undefined;
  WeeklyTimeTable: IScheduleLogLookup | undefined;
  Result: number;
  Message: string;
  Date: Date;                    // *** ПОЛЕ: Дата периода заполнения ***
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
  Date?: string;                 // *** ПОЛЕ: Дата периода заполнения ***
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
  date: Date;                    // *** ПОЛЕ: Дата периода заполнения ***
}

export interface IUpdateScheduleLogParams {
  title?: string;
  managerId?: string | number;
  staffMemberId?: string | number;
  staffGroupId?: string | number;
  weeklyTimeTableId?: string | number;
  result?: number;
  message?: string;
  date?: Date;                   // *** ПОЛЕ: Дата периода заполнения ***
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
  // *** ПАРАМЕТРЫ ДЛЯ ФИЛЬТРАЦИИ ПО ДАТЕ ПЕРИОДА ***
  periodDate?: Date;             // Точная дата периода
  periodStartDate?: Date;        // Начало диапазона дат периода  
  periodEndDate?: Date;          // Конец диапазона дат периода
}

export class ScheduleLogsService {
  private static _instance: ScheduleLogsService;
  private _logSource: string = "ScheduleLogsService";
  private _listName: string = "ScheduleLogs";
  private _remoteSiteService: RemoteSiteService;

  private constructor(context: WebPartContext) {
    console.log('[ScheduleLogsService] Инициализация с полной поддержкой Date field');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService инициализирован с поддержкой Date field");
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] Создание нового экземпляра с Date support');
      ScheduleLogsService._instance = new ScheduleLogsService(context);
    }
    return ScheduleLogsService._instance;
  }

  public async createScheduleLog(params: ICreateScheduleLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`[DEBUG] Создание нового лога для периода: ${params.date.toLocaleDateString()}`);
      
      const fields = this.prepareFieldsForCreate(params);
      this.logInfo(`[DEBUG] Подготовленные поля для создания: ${JSON.stringify(fields, null, 2)}`);

      const result = await this._remoteSiteService.createListItem(this._listName, fields);

      if (result && result.id) {
        this.logInfo(`[DEBUG] Успешно создан лог с ID: ${result.id} для периода: ${params.date.toLocaleDateString()}`);
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
      this.logInfo(`[DEBUG] Получение логов с параметрами: ${JSON.stringify(params || {})}`);

      // *** ВРЕМЕННО УБИРАЕМ ФИЛЬТРАЦИЮ ДЛЯ ОТЛАДКИ ***
      const filter = this.buildFilter(params);
      const orderBy = { field: 'fields/Created', ascending: false };

      this.logInfo(`[DEBUG] Построенный фильтр: ${filter || 'отсутствует'}`);
      this.logInfo(`[DEBUG] Сортировка: ${JSON.stringify(orderBy)}`);

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

      // *** УБИРАЕМ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ - ОСТАВЛЯЕМ ТОЛЬКО НЕОБХОДИМОЕ ***
      const mappedLogs = response.items.map((item: IRemoteListItemResponse) => this.mapRawToScheduleLog(item));

      this.logInfo(`[DEBUG] Всего получено логов: ${mappedLogs.length}`);
      if (mappedLogs.length > 0) {
        this.logInfo(`[DEBUG] Первый лог: ID=${mappedLogs[0].ID}, Result=${mappedLogs[0].Result}, Date=${mappedLogs[0].Date.toLocaleDateString()}, Title="${mappedLogs[0].Title}"`);
      }

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
      this.logInfo(`[DEBUG] Успешно получен лог: ${mappedLog.Title}, период: ${mappedLog.Date.toLocaleDateString()}`);

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

    // Обязательные поля
    fields.Title = params.title;
    fields.Result = params.result;
    fields.Message = params.message;
    
    // *** ПОЛЕ: Дата периода заполнения ***
    fields.Date = params.date.toISOString();
    this.logInfo(`[DEBUG] Установлена дата периода: ${params.date.toLocaleDateString()} (ISO: ${params.date.toISOString()})`);

    // Lookup поля с правильными названиями
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

    // *** ПОЛЕ: Обновление даты периода ***
    if (params.date !== undefined) {
      fields.Date = params.date.toISOString();
      this.logInfo(`[DEBUG] Обновлена дата периода: ${params.date.toLocaleDateString()} (ISO: ${params.date.toISOString()})`);
    }

    // Lookup поля для обновления с правильными названиями
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
   * *** ВОССТАНОВЛЕННАЯ ФИЛЬТРАЦИЯ ПО ДАТЕ С ПРАВИЛЬНЫМ ПОЛЕМ ***
   */
  private buildFilter(params?: IScheduleLogsQueryParams): string | undefined {
    if (!params) return undefined;

    const filters: string[] = [];

    // Фильтр по дате создания
    if (params.startDate) {
      filters.push(`fields/Created ge '${params.startDate.toISOString()}'`);
    }

    if (params.endDate) {
      filters.push(`fields/Created le '${params.endDate.toISOString()}'`);
    }

    // *** ВОССТАНОВЛЕННАЯ ФИЛЬТРАЦИЯ ПО ДАТЕ ПЕРИОДА ***
    if (params.periodDate) {
      // Фильтруем по месяцу и году выбранной даты
      const year = params.periodDate.getFullYear();
      const month = params.periodDate.getMonth() + 1; // JavaScript месяцы 0-based
      
      // Первый день месяца
      const firstDay = new Date(year, month - 1, 1);
      firstDay.setHours(0, 0, 0, 0);
      
      // Последний день месяца  
      const lastDay = new Date(year, month, 0);
      lastDay.setHours(23, 59, 59, 999);
      
      filters.push(`fields/Date ge '${firstDay.toISOString()}' and fields/Date le '${lastDay.toISOString()}'`);
      
      this.logInfo(`[DEBUG] Фильтр по периоду: ${params.periodDate.toLocaleDateString()}`);
      this.logInfo(`[DEBUG] Диапазон фильтра: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
    }

    if (params.periodStartDate) {
      const dateStart = new Date(params.periodStartDate);
      dateStart.setHours(0, 0, 0, 0);
      filters.push(`fields/Date ge '${dateStart.toISOString()}'`);
      this.logInfo(`[DEBUG] Фильтр периода от: ${params.periodStartDate.toLocaleDateString()}`);
    }

    if (params.periodEndDate) {
      const dateEnd = new Date(params.periodEndDate);
      dateEnd.setHours(23, 59, 59, 999);
      filters.push(`fields/Date le '${dateEnd.toISOString()}'`);
      this.logInfo(`[DEBUG] Фильтр периода до: ${params.periodEndDate.toLocaleDateString()}`);
    }

    // Фильтры по lookup полям
    if (params.managerId && String(params.managerId) !== '0') {
      filters.push(`fields/ManagerLookupId eq ${params.managerId}`);
    }

    if (params.staffMemberId && String(params.staffMemberId) !== '0') {
      filters.push(`fields/StaffMemberLookupId eq ${params.staffMemberId}`);
      this.logInfo(`[DEBUG] Фильтр по сотруднику: StaffMemberLookupId = ${params.staffMemberId}`);
    }

    if (params.staffGroupId && String(params.staffGroupId) !== '0') {
      filters.push(`fields/StaffGroupLookupId eq ${params.staffGroupId}`);
    }

    // Фильтр по результату
    if (params.result !== undefined) {
      filters.push(`fields/Result eq ${params.result}`);
    }

    const resultFilter = filters.length > 0 ? filters.join(' and ') : undefined;
    this.logInfo(`[DEBUG] Итоговый фильтр: ${resultFilter || 'отсутствует'}`);
    
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

    // *** ОПТИМИЗИРОВАННОЕ ЧТЕНИЕ ПОЛЕЙ НА ОСНОВЕ НАЙДЕННОЙ СТРУКТУРЫ ***
    const id = (raw as any).id || (raw as any).fields?.id;
    const title = (raw as any).fields?.Title;
    const result = (raw as any).fields?.Result;
    const dateField = (raw as any).fields?.Date;
    const message = (raw as any).fields?.Message;
    
    // *** ЧТЕНИЕ ДАТЫ ***
    let logDate = new Date();
    if (dateField) {
      try {
        logDate = new Date(dateField);
        if (isNaN(logDate.getTime())) {
          console.warn(`[ScheduleLogsService] Invalid date: ${dateField}`);
          logDate = new Date();
        }
      } catch (error) {
        console.error(`[ScheduleLogsService] Error parsing date: ${dateField}`, error);
        logDate = new Date();
      }
    }
    
    const parsedResult = typeof result === 'string' ? parseInt(result, 10) : (result as number || 0);
    
    return {
      ID: String(id || ''),
      Title: String(title || ''),
      Manager: mapLookup((raw as any).fields?.Manager),
      StaffMember: mapLookup((raw as any).fields?.StaffMember),
      StaffGroup: mapLookup((raw as any).fields?.StaffGroup),
      WeeklyTimeTable: mapLookup((raw as any).fields?.WeeklyTimeTable),
      Result: parsedResult,
      Message: String(message || ''),
      Date: logDate,
      Created: (raw as any).fields?.Created ? new Date((raw as any).fields.Created) : new Date(),
      Modified: (raw as any).fields?.Modified ? new Date((raw as any).fields.Modified) : new Date()
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