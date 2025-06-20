// src/webparts/kpfaplus/services/ScheduleLogsService.ts
// ИСПРАВЛЕНО: Добавлена серверная фильтрация по образцу ContractsService
// ДОБАВЛЕНО: Поддержка автозаполнения и специализированного логирования

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

// *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ АВТОЗАПОЛНЕНИЯ ***
export interface ICreateAutoFillLogParams extends ICreateScheduleLogParams {
  operationType: 'AUTO_FILL' | 'AUTO_SKIP' | 'AUTO_WARNING';
  autoFillDetails?: {
    hasAutoschedule: boolean;
    hasProcessedRecords?: boolean;
    recordsCreated?: number;
    skipReason?: string;
  };
}

export interface IAutoFillLogStats {
  totalAutoFillLogs: number;
  successfulAutoFills: number;
  skippedAutoFills: number;
  warningAutoFills: number;
  errorAutoFills: number;
  periodCoverage: {
    startDate: Date;
    endDate: Date;
    logsInPeriod: number;
  };
}

export interface IGetScheduleLogsParams {
  staffMemberId?: string;
  managerId?: string;
  staffGroupId?: string;
  periodDate?: Date;
  top?: number;
  skip?: number;
  // *** НОВЫЕ ПАРАМЕТРЫ ДЛЯ АВТОЗАПОЛНЕНИЯ ***
  operationType?: 'AUTO_FILL' | 'MANUAL' | 'ALL';
  resultFilter?: number[]; // Фильтр по Result (1=Error, 2=Success, 3=Warning)
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
    console.log('[ScheduleLogsService] Инициализация с серверной фильтрацией и поддержкой автозаполнения');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService initialized with server-side filtering and auto-fill support");
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] Создание нового экземпляра с серверной фильтрацией и автозаполнением');
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
   * *** НОВЫЙ МЕТОД: Формирует серверный фильтр для ScheduleLogs с поддержкой автозаполнения ***
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

    // *** НОВЫЙ ФИЛЬТР: По типу операции (автозаполнение) ***
    if (params.operationType && params.operationType !== 'ALL') {
      if (params.operationType === 'AUTO_FILL') {
        // Фильтруем логи автозаполнения по заголовку
        filterParts.push(`(contains(fields/Title, 'Auto-Fill'))`);
        this.logInfo(`Adding OperationType filter: Auto-Fill logs only`);
      } else if (params.operationType === 'MANUAL') {
        // Фильтруем ручные операции (исключаем автозаполнение)
        filterParts.push(`(not contains(fields/Title, 'Auto-Fill'))`);
        this.logInfo(`Adding OperationType filter: Manual operations only`);
      }
    }

    // *** НОВЫЙ ФИЛЬТР: По Result коду ***
    if (params.resultFilter && params.resultFilter.length > 0) {
      if (params.resultFilter.length === 1) {
        filterParts.push(`fields/Result eq ${params.resultFilter[0]}`);
        this.logInfo(`Adding Result filter: Result eq ${params.resultFilter[0]}`);
      } else {
        const resultFilters = params.resultFilter.map(result => `fields/Result eq ${result}`);
        filterParts.push(`(${resultFilters.join(' or ')})`);
        this.logInfo(`Adding Result filter: Result in [${params.resultFilter.join(', ')}]`);
      }
    }

    if (filterParts.length > 0) {
      const filter = filterParts.join(' and ');
      this.logInfo(`Built server filter with auto-fill support: ${filter}`);
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
   * *** ИСПРАВЛЕНО: Получает логи С СЕРВЕРНОЙ ФИЛЬТРАЦИЕЙ и поддержкой автозаполнения ***
   */
  public async getScheduleLogs(params: IGetScheduleLogsParams = {}): Promise<IScheduleLogsResult> {
    try {
      this.logInfo(`Fetching schedule logs WITH SERVER-SIDE FILTERING and auto-fill support`);
      this.logInfo(`Parameters: ${JSON.stringify(params)}`);

      // *** ШАГ 1: АНАЛИЗ СТРУКТУРЫ ПОЛЕЙ (ОДИН РАЗ) ***
      const fieldNames = await this.analyzeScheduleLogsFields();
      
      // *** ШАГ 2: СТРОИМ СЕРВЕРНЫЙ ФИЛЬТР С ПОДДЕРЖКОЙ АВТОЗАПОЛНЕНИЯ ***
      const serverFilter = this.buildServerFilter(params);
      
      // *** ШАГ 3: ВЫПОЛНЯЕМ ЗАПРОС С СЕРВЕРНОЙ ФИЛЬТРАЦИЕЙ ***
      this.logInfo(`Executing request with server filter: ${serverFilter || 'no filter'}`);
      
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true,
        serverFilter, // *** СЕРВЕРНАЯ ФИЛЬТРАЦИЯ! ***
        { field: "Created", ascending: false } // Сортируем по дате создания (новые сначала)
      );
      
      this.logInfo(`Retrieved ${items.length} schedule logs with server-side filtering and auto-fill support`);
      
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
      
      this.logInfo(`Successfully fetched ${paginatedLogs.length} logs with server-side filtering and auto-fill support`);
      
      return {
        logs: paginatedLogs,
        totalCount: logs.length,
        error: undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Error fetching schedule logs with server filtering and auto-fill support: ${errorMessage}`);
      
      return {
        logs: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Создает лог для автозаполнения ***
   */
  public async createAutoFillLog(params: ICreateAutoFillLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`Creating auto-fill log using enhanced pattern`);
      this.logInfo(`Auto-fill parameters: ${JSON.stringify(params)}`);

      // Подготавливаем данные для MS Graph API
      const itemData: Record<string, unknown> = {
        Title: `[${params.operationType}] ${params.title}`,
        Result: params.result,
        Message: this.buildAutoFillLogMessage(params)
      };

      // Добавляем дату с нормализацией через DateUtils
      if (params.date) {
        const normalizedDate = DateUtils.normalizeDateToUTCMidnight(params.date);
        itemData.Date = normalizedDate.toISOString();
        this.logInfo(`[DEBUG] Auto-fill date normalized: ${params.date.toISOString()} → ${normalizedDate.toISOString()}`);
      }

      // Добавляем lookup поля если они есть
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

      this.logInfo(`Prepared auto-fill item data for save: ${JSON.stringify(itemData, null, 2)}`);

      // Создаем новый элемент через RemoteSiteService
      try {
        const listId = await this._remoteSiteService.getListId(this._listName);
        
        const response = await this._remoteSiteService.addListItem(
          listId,
          itemData
        );
        
        if (response && response.id) {
          const result = this.ensureString(response.id);
          this.logInfo(`Created new auto-fill log with ID: ${result}`);
          return result;
        } else {
          throw new Error('Failed to get ID from the created auto-fill log item');
        }
      } catch (error) {
        this.logError(`Error creating new auto-fill log: ${error}`);
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`Error creating auto-fill log: ${errorMessage}`);
      return undefined;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Строит сообщение для лога автозаполнения ***
   */
  private buildAutoFillLogMessage(params: ICreateAutoFillLogParams): string {
    const lines: string[] = [];
    
    lines.push(`=== AUTO-FILL LOG MESSAGE ===`);
    lines.push(`Operation Type: ${params.operationType}`);
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push('');
    
    // Основное сообщение
    lines.push(params.message);
    lines.push('');
    
    // Детали автозаполнения
    if (params.autoFillDetails) {
      lines.push(`AUTO-FILL DETAILS:`);
      lines.push(`Has AutoSchedule: ${params.autoFillDetails.hasAutoschedule}`);
      
      if (params.autoFillDetails.hasProcessedRecords !== undefined) {
        lines.push(`Has Processed Records: ${params.autoFillDetails.hasProcessedRecords}`);
      }
      
      if (params.autoFillDetails.recordsCreated !== undefined) {
        lines.push(`Records Created: ${params.autoFillDetails.recordsCreated}`);
      }
      
      if (params.autoFillDetails.skipReason) {
        lines.push(`Skip Reason: ${params.autoFillDetails.skipReason}`);
      }
      
      lines.push('');
    }
    
    // Параметры операции
    lines.push(`OPERATION PARAMETERS:`);
    lines.push(`Period: ${params.date.toISOString()}`);
    lines.push(`Staff Member ID: ${params.staffMemberId || 'N/A'}`);
    lines.push(`Manager ID: ${params.managerId || 'N/A'}`);
    lines.push(`Staff Group ID: ${params.staffGroupId || 'N/A'}`);
    lines.push(`Weekly Time Table ID: ${params.weeklyTimeTableId || 'N/A'}`);
    lines.push(`Result Code: ${params.result} (${params.result === 2 ? 'Success' : params.result === 3 ? 'Warning/Skip' : 'Error'})`);
    
    lines.push(`=== END AUTO-FILL LOG ===`);
    
    return lines.join('\n');
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
   * *** НОВЫЙ МЕТОД: Получает статистику автозаполнения ***
   */
  public async getAutoFillStats(params: { 
    managerId?: string; 
    staffGroupId?: string; 
    periodDate?: Date;
    staffMemberId?: string;
  } = {}): Promise<IAutoFillLogStats> {
    try {
      this.logInfo(`Getting auto-fill statistics with filtering`);
      
      // Получаем логи автозаполнения с серверной фильтрацией
      const logsParams: IGetScheduleLogsParams = {
        ...params,
        operationType: 'AUTO_FILL' // Только логи автозаполнения
      };
      
      const result = await this.getScheduleLogs(logsParams);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      const logs = result.logs;
      
      // Подсчитываем статистику автозаполнения
      const stats: IAutoFillLogStats = {
        totalAutoFillLogs: logs.length,
        successfulAutoFills: logs.filter(log => log.Result === 2).length,
        skippedAutoFills: logs.filter(log => log.Result === 3 && log.Title.includes('Skipped')).length,
        warningAutoFills: logs.filter(log => log.Result === 3 && !log.Title.includes('Skipped')).length,
        errorAutoFills: logs.filter(log => log.Result === 1).length,
        periodCoverage: {
          startDate: params.periodDate || new Date(),
          endDate: params.periodDate || new Date(),
          logsInPeriod: logs.length
        }
      };
      
      // Определяем период покрытия
      if (logs.length > 0) {
        const dates = logs.map(log => log.Date).sort((a, b) => a.getTime() - b.getTime());
        stats.periodCoverage.startDate = dates[0];
        stats.periodCoverage.endDate = dates[dates.length - 1];
      }
      
      this.logInfo(`Auto-fill statistics: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error) {
      this.logError(`Error getting auto-fill statistics: ${error}`);
      return {
        totalAutoFillLogs: 0,
        successfulAutoFills: 0,
        skippedAutoFills: 0,
        warningAutoFills: 0,
        errorAutoFills: 0,
        periodCoverage: {
          startDate: new Date(),
          endDate: new Date(),
          logsInPeriod: 0
        }
      };
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает статистику логов с серверной фильтрацией и поддержкой автозаполнения ***
   */
  public async getScheduleLogsStats(params: IGetScheduleLogsParams = {}): Promise<{
    totalLogs: number;
    successCount: number;
    errorCount: number;
    infoCount: number;
    autoFillCount: number;
    manualCount: number;
  }> {
    try {
      this.logInfo(`Getting schedule logs statistics with server filtering and auto-fill support`);
      
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
        infoCount: logs.filter(log => log.Result === 3).length,
        autoFillCount: logs.filter(log => log.Title.includes('Auto-Fill')).length,
        manualCount: logs.filter(log => !log.Title.includes('Auto-Fill')).length
      };
      
      this.logInfo(`Schedule logs statistics with auto-fill breakdown: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error) {
      this.logError(`Error getting schedule logs statistics: ${error}`);
      return {
        totalLogs: 0,
        successCount: 0,
        errorCount: 0,
        infoCount: 0,
        autoFillCount: 0,
        manualCount: 0
      };
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Логирует предупреждение для автозаполнения ***
   */
  public async logAutoFillWarning(params: {
    staffMemberId: string;
    staffName: string;
    managerId: string;
    staffGroupId: string;
    period: Date;
    reason: string;
    weeklyTimeTableId?: string;
  }): Promise<string | undefined> {
    try {
      this.logInfo(`Logging auto-fill warning for staff: ${params.staffName}`);
      
      const autoFillParams: ICreateAutoFillLogParams = {
        title: `Auto-Fill Warning - ${params.staffName}`,
        result: 3, // Warning
        message: `Auto-fill operation skipped: ${params.reason}`,
        date: params.period,
        staffMemberId: params.staffMemberId,
        managerId: params.managerId,
        staffGroupId: params.staffGroupId,
        weeklyTimeTableId: params.weeklyTimeTableId,
        operationType: 'AUTO_WARNING',
        autoFillDetails: {
          hasAutoschedule: true,
          hasProcessedRecords: params.reason.toLowerCase().includes('processed'),
          skipReason: params.reason
        }
      };
      
      const logId = await this.createAutoFillLog(autoFillParams);
      
      if (logId) {
        this.logInfo(`Auto-fill warning logged with ID: ${logId}`);
      }
      
      return logId;
      
    } catch (error) {
      this.logError(`Error logging auto-fill warning: ${error}`);
      return undefined;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Логирует пропуск автозаполнения ***
   */
  public async logAutoFillSkip(params: {
    staffMemberId: string;
    staffName: string;
    managerId: string;
    staffGroupId: string;
    period: Date;
    reason: string;
    weeklyTimeTableId?: string;
  }): Promise<string | undefined> {
    try {
      this.logInfo(`Logging auto-fill skip for staff: ${params.staffName}`);
      
      const autoFillParams: ICreateAutoFillLogParams = {
        title: `Auto-Fill Skipped - ${params.staffName}`,
        result: 3, // Info/Skip
        message: `Auto-fill operation skipped: ${params.reason}`,
        date: params.period,
        staffMemberId: params.staffMemberId,
        managerId: params.managerId,
        staffGroupId: params.staffGroupId,
        weeklyTimeTableId: params.weeklyTimeTableId,
        operationType: 'AUTO_SKIP',
        autoFillDetails: {
          hasAutoschedule: false, // Skipped usually means autoschedule is off
          skipReason: params.reason
        }
      };
      
      const logId = await this.createAutoFillLog(autoFillParams);
      
      if (logId) {
        this.logInfo(`Auto-fill skip logged with ID: ${logId}`);
      }
      
      return logId;
      
    } catch (error) {
      this.logError(`Error logging auto-fill skip: ${error}`);
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