// src/webparts/kpfaplus/services/ScheduleLogsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { 
  IGetPaginatedListItemsOptions, 
  IRemotePaginatedItemsResponse,
  IRemoteListItemResponse 
} from "./RemoteSiteInterfaces";

/**
 * Интерфейс для записи лога операций заполнения расписания
 */
export interface IScheduleLog {
  ID: string;                    // Уникальный идентификатор записи
  Title: string;                 // Заголовок записи
  Manager: IScheduleLogLookup | undefined;         // Менеджер (lookup)
  StaffMember: IScheduleLogLookup | undefined;     // Сотрудник (lookup)
  StaffGroup: IScheduleLogLookup | undefined;      // Группа сотрудников (lookup)
  WeeklyTimeTable: IScheduleLogLookup | undefined; // Недельное расписание (lookup)
  Result: number;                // Результат операции: 1 = ошибка, 2 = успех
  Message: string;               // Детальный лог операции
  Created: Date;                 // Дата создания записи
  Modified: Date;                // Дата изменения записи
}

/**
 * Интерфейс для lookup полей
 */
export interface IScheduleLogLookup {
  Id: string;
  Title: string;
}

/**
 * Интерфейс для сырых данных из SharePoint
 */
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

/**
 * Интерфейс для параметров создания лога
 */
export interface ICreateScheduleLogParams {
  title: string;                 // Заголовок записи
  managerId?: string | number;   // ID менеджера (опционально)
  staffMemberId?: string | number; // ID сотрудника (опционально)
  staffGroupId?: string | number;  // ID группы сотрудников (опционально)
  weeklyTimeTableId?: string | number; // ID недельного расписания (опционально)
  result: number;                // Результат операции (1 = ошибка, 2 = успех)
  message: string;               // Детальное сообщение
}

/**
 * Интерфейс для параметров обновления лога
 */
export interface IUpdateScheduleLogParams {
  title?: string;
  managerId?: string | number;
  staffMemberId?: string | number;
  staffGroupId?: string | number;
  weeklyTimeTableId?: string | number;
  result?: number;
  message?: string;
}

/**
 * Интерфейс для результатов запроса логов
 */
export interface IScheduleLogsResult {
  logs: IScheduleLog[];
  totalCount: number;
  error?: string;
}

/**
 * Интерфейс для параметров запроса логов
 */
export interface IScheduleLogsQueryParams {
  startDate?: Date;              // Дата начала периода (опционально)
  endDate?: Date;                // Дата окончания периода (опционально)
  managerId?: string | number;   // ID менеджера для фильтрации (опционально)
  staffMemberId?: string | number; // ID сотрудника для фильтрации (опционально)
  staffGroupId?: string | number;  // ID группы для фильтрации (опционально)
  result?: number;               // Фильтр по результату (опционально)
  skip?: number;                 // Количество записей для пропуска (пагинация)
  top?: number;                  // Максимальное количество записей
}

/**
 * Сервис для работы с логами операций заполнения расписания
 */
export class ScheduleLogsService {
  private static _instance: ScheduleLogsService;
  private _logSource: string = "ScheduleLogsService";
  private _listName: string = "ScheduleLogs";
  private _remoteSiteService: RemoteSiteService;

  /**
   * Приватный конструктор для паттерна Singleton
   */
  private constructor(context: WebPartContext) {
    console.log('[ScheduleLogsService] Инициализация сервиса с контекстом');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService инициализирован с RemoteSiteService");
  }

  /**
   * Получение экземпляра сервиса (Singleton паттерн)
   */
  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] Создание нового экземпляра');
      ScheduleLogsService._instance = new ScheduleLogsService(context);
    } else {
      console.log('[ScheduleLogsService] Возврат существующего экземпляра');
    }
    return ScheduleLogsService._instance;
  }

  /**
   * Создает новую запись лога
   */
  public async createScheduleLog(params: ICreateScheduleLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`[DEBUG] Создание нового лога: ${params.title}`);
      this.logInfo(`[DEBUG] Параметры лога:
        managerId: ${params.managerId || 'не указан'}
        staffMemberId: ${params.staffMemberId || 'не указан'}
        staffGroupId: ${params.staffGroupId || 'не указан'}
        weeklyTimeTableId: ${params.weeklyTimeTableId || 'не указан'}
        result: ${params.result}
        messageLength: ${params.message.length} символов`);

      // Подготавливаем поля для создания
      const fields = this.prepareFieldsForCreate(params);

      this.logInfo(`[DEBUG] Подготовленные поля для создания: ${JSON.stringify(fields, null, 2)}`);

      // Создаем запись через RemoteSiteService
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
      console.error('[ScheduleLogsService] Подробности ошибки:', error);
      return undefined;
    }
  }

  /**
   * Получает записи логов с возможностью фильтрации
   */
  public async getScheduleLogs(params?: IScheduleLogsQueryParams): Promise<IScheduleLogsResult> {
    try {
      this.logInfo(`[DEBUG] Получение логов с параметрами: ${JSON.stringify(params || {})}`);

      // Строим фильтр для запроса
      const filter = this.buildFilter(params);
      const orderBy = { field: 'Created', ascending: false }; // Сортируем по дате создания (новые сначала)

      this.logInfo(`[DEBUG] Фильтр: ${filter || 'отсутствует'}`);
      this.logInfo(`[DEBUG] Сортировка: ${JSON.stringify(orderBy)}`);

      // Определяем опции для запроса
      const options: IGetPaginatedListItemsOptions = {
        expandFields: true, // Включаем expand для lookup полей
        filter: filter,
        orderBy: orderBy,
        top: params?.top || 50,
        skip: params?.skip || 0
      };

      // Получаем данные через RemoteSiteService
      const response: IRemotePaginatedItemsResponse = await this._remoteSiteService.getPaginatedItemsFromList(
        this._listName,
        options
      );

      this.logInfo(`[DEBUG] Получено ${response.items.length} записей из ${response.totalCount} общих`);

      // Преобразуем сырые данные в типизированные
      const mappedLogs = response.items.map((item: IRemoteListItemResponse) => this.mapRawToScheduleLog(item));

      return {
        logs: mappedLogs,
        totalCount: response.totalCount,
        error: undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Ошибка при получении логов: ${errorMessage}`);
      console.error('[ScheduleLogsService] Подробности ошибки:', error);

      return {
        logs: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Получает один лог по ID
   */
  public async getScheduleLogById(logId: string | number): Promise<IScheduleLog | undefined> {
    try {
      this.logInfo(`[DEBUG] Получение лога по ID: ${logId}`);

      const item = await this._remoteSiteService.getListItem(
        this._listName,
        Number(logId),
        true // expandFields = true
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

  /**
   * Обновляет существующий лог
   */
  public async updateScheduleLog(
    logId: string | number, 
    params: IUpdateScheduleLogParams
  ): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Обновление лога ID: ${logId}`);

      // Подготавливаем поля для обновления
      const fields = this.prepareFieldsForUpdate(params);

      if (Object.keys(fields).length === 0) {
        this.logInfo(`[DEBUG] Нет полей для обновления лога ID: ${logId}`);
        return true; // Считаем успешным если нечего обновлять
      }

      this.logInfo(`[DEBUG] Поля для обновления: ${JSON.stringify(fields)}`);

      // Обновляем через RemoteSiteService
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

  /**
   * Удаляет лог (если потребуется)
   */
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

  /**
   * Подготавливает поля для создания записи
   */
  private prepareFieldsForCreate(params: ICreateScheduleLogParams): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    // Обязательные поля
    fields.Title = params.title;
    fields.Result = params.result;
    fields.Message = params.message;

    // Lookup поля (опциональные)
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

  /**
   * Подготавливает поля для обновления записи
   */
  private prepareFieldsForUpdate(params: IUpdateScheduleLogParams): Record<string, unknown> {
    const fields: Record<string, unknown> = {};

    // Обновляем только переданные поля
    if (params.title !== undefined) {
      fields.Title = params.title;
    }

    if (params.result !== undefined) {
      fields.Result = params.result;
    }

    if (params.message !== undefined) {
      fields.Message = params.message;
    }

    // Lookup поля для обновления
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
   * Строит фильтр для запроса на основе параметров
   */
  private buildFilter(params?: IScheduleLogsQueryParams): string | undefined {
    if (!params) return undefined;

    const filters: string[] = [];

    // Фильтр по дате создания
    if (params.startDate) {
      filters.push(`Created ge '${params.startDate.toISOString()}'`);
    }

    if (params.endDate) {
      filters.push(`Created le '${params.endDate.toISOString()}'`);
    }

    // Фильтры по lookup полям
    if (params.managerId && String(params.managerId) !== '0') {
      filters.push(`Manager/Id eq ${params.managerId}`);
    }

    if (params.staffMemberId && String(params.staffMemberId) !== '0') {
      filters.push(`StaffMember/Id eq ${params.staffMemberId}`);
    }

    if (params.staffGroupId && String(params.staffGroupId) !== '0') {
      filters.push(`StaffGroup/Id eq ${params.staffGroupId}`);
    }

    // Фильтр по результату
    if (params.result !== undefined) {
      filters.push(`Result eq ${params.result}`);
    }

    return filters.length > 0 ? filters.join(' and ') : undefined;
  }

  /**
   * Преобразует сырые данные SharePoint в типизированный объект
   */
  private mapRawToScheduleLog(raw: IRawScheduleLog): IScheduleLog {
    // Вспомогательная функция для обработки lookup полей
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

  /**
   * Логирование информационных сообщений
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * Логирование сообщений об ошибках
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }

  /**
   * Очистка экземпляра (для тестирования)
   */
  public static clearInstance(): void {
    ScheduleLogsService._instance = undefined as any;
    console.log('[ScheduleLogsService] Instance cleared');
  }
}