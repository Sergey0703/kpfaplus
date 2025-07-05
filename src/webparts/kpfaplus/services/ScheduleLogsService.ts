// src/webparts/kpfaplus/services/ScheduleLogsService.ts - ЧАСТЬ 1/4
// ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Убрана UTC конвертация для Date-only поля ScheduleLogs.Date
// ДОБАВЛЕНО: Поддержка автозаполнения и специализированного логирования

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

// ✅ ИСПРАВЛЕНО: Структура интерфейса для полной совместимости с LogDetailsDialog
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
    console.log('[ScheduleLogsService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Инициализация БЕЗ UTC конвертации для Date-only поля');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("ScheduleLogsService initialized with FIXED Date-only format support and auto-fill");
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService._instance) {
      console.log('[ScheduleLogsService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создание нового экземпляра с Date-only фиксом');
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

  // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: НОВЫЙ метод ensureDate БЕЗ DateUtils.normalizeDateToUTCMidnight
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
          this.logInfo(`[DEBUG] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Invalid date string for ensureDate: ${value}`);
          return new Date();
        }
      } else {
        this.logInfo(`[DEBUG] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Unsupported date type for ensureDate: ${typeof value}`);
        return new Date();
      }
      
      // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: НЕ ИСПОЛЬЗУЕМ DateUtils.normalizeDateToUTCMidnight!
      // Для Date-only полей возвращаем дату как есть
      console.log('[ScheduleLogsService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ensureDate БЕЗ UTC конвертации');
      console.log('[ScheduleLogsService] Input value:', value);
      console.log('[ScheduleLogsService] Parsed date (no UTC conversion):', date.toISOString());
      
      return date;
    } catch (error) {
      this.logError(`Error converting date with FIXED logic: ${error}`);
      return new Date();
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
  // src/webparts/kpfaplus/services/ScheduleLogsService.ts - ЧАСТЬ 2/4
// ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Приватные методы с правильной обработкой Date-only полей

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

    // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Фильтр по дате с правильной Date-only обработкой
    if (params.periodDate) {
      console.log('[ScheduleLogsService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Строим Date-only фильтр для ScheduleLogs.Date');
      console.log('[ScheduleLogsService] Input periodDate:', params.periodDate.toLocaleDateString());
      
      // ✅ ИСПРАВЛЕНО: Используем локальные компоненты для создания границ месяца
      const year = params.periodDate.getFullYear();
      const month = params.periodDate.getMonth();
      
      // Создаем границы месяца в локальном времени, затем конвертируем в UTC строки
      const startOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

      // OData формат для дат в Graph API
      const startDateISO = startOfMonth.toISOString();
      const endDateISO = endOfMonth.toISOString();
      
      filterParts.push(`(fields/Date ge '${startDateISO}' and fields/Date le '${endDateISO}')`);
      
      console.log('[ScheduleLogsService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Date-only фильтр создан правильно');
      console.log('[ScheduleLogsService] Month boundaries:', {
        year,
        month: month + 1,
        startISO: startDateISO,
        endISO: endDateISO
      });
      
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Adding Date filter for ScheduleLogs.Date: ${startDateISO} to ${endDateISO}`);
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
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Built server filter with Date-only support: ${filter}`);
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
      this.logInfo('✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Analyzing ScheduleLogs field structure with Date-only awareness');
      
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
        
        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Sample ScheduleLogs item structure: ${JSON.stringify(fields, null, 2)}`);
        
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

        // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Проверяем структуру Date поля
        if (fields.Date !== undefined) {
          console.log('[ScheduleLogsService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Found ScheduleLogs.Date field structure');
          console.log('[ScheduleLogsService] Date field sample value:', fields.Date);
          console.log('[ScheduleLogsService] Date field type:', typeof fields.Date);
          this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ScheduleLogs.Date field confirmed as Date-only field`);
        }
      } else {
        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: No sample items found in list "${this._listName}". Using default field names.`);
      }
      
      return {
        staffMemberField,
        managerField,
        staffGroupField,
        weeklyTimeTableField
      };
    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error analyzing ScheduleLogs fields: ${error}`);
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
   * *** НОВЫЙ МЕТОД: Строит сообщение для лога автозаполнения ***
   */
  private buildAutoFillLogMessage(params: ICreateAutoFillLogParams): string {
    const lines: string[] = [];
    
    lines.push(`=== AUTO-FILL LOG MESSAGE WITH FIXED DATE-ONLY SUPPORT ===`);
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
    
    // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Параметры операции с Date-only форматированием
    lines.push(`OPERATION PARAMETERS WITH FIXED DATE-ONLY SUPPORT:`);
    
    // Форматируем дату для отображения БЕЗ timezone conversion
    const displayDate = `${params.date.getDate().toString().padStart(2, '0')}.${(params.date.getMonth() + 1).toString().padStart(2, '0')}.${params.date.getFullYear()}`;
    lines.push(`Period (Date-only): ${displayDate}`);
    lines.push(`Period (ISO for storage): ${params.date.toISOString()}`);
    
    lines.push(`Staff Member ID: ${params.staffMemberId || 'N/A'}`);
    lines.push(`Manager ID: ${params.managerId || 'N/A'}`);
    lines.push(`Staff Group ID: ${params.staffGroupId || 'N/A'}`);
    lines.push(`Weekly Time Table ID: ${params.weeklyTimeTableId || 'N/A'}`);
    lines.push(`Result Code: ${params.result} (${params.result === 2 ? 'Success' : params.result === 3 ? 'Warning/Skip' : 'Error'})`);
    
    lines.push(`=== END AUTO-FILL LOG WITH FIXED DATE-ONLY SUPPORT ===`);
    
    return lines.join('\n');
  }
  // src/webparts/kpfaplus/services/ScheduleLogsService.ts - ЧАСТЬ 3/4
// 🚨 КРИТИЧНЫЕ ИСПРАВЛЕНИЯ: Основные методы БЕЗ DateUtils.normalizeDateToUTCMidnight

  /**
   * ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Получает логи С СЕРВЕРНОЙ ФИЛЬТРАЦИЕЙ и Date-only поддержкой
   */
  public async getScheduleLogs(params: IGetScheduleLogsParams = {}): Promise<IScheduleLogsResult> {
    try {
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Fetching schedule logs with FIXED Date-only support`);
      this.logInfo(`Parameters: ${JSON.stringify(params)}`);

      // *** ШАГ 1: АНАЛИЗ СТРУКТУРЫ ПОЛЕЙ (ОДИН РАЗ) ***
      const fieldNames = await this.analyzeScheduleLogsFields();
      
      // *** ШАГ 2: СТРОИМ СЕРВЕРНЫЙ ФИЛЬТР С ПОДДЕРЖКОЙ АВТОЗАПОЛНЕНИЯ ***
      const serverFilter = this.buildServerFilter(params);
      
      // *** ШАГ 3: ВЫПОЛНЯЕМ ЗАПРОС С СЕРВЕРНОЙ ФИЛЬТРАЦИЕЙ ***
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Executing request with Date-only aware server filter: ${serverFilter || 'no filter'}`);
      
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true,
        serverFilter, // *** СЕРВЕРНАЯ ФИЛЬТРАЦИЯ! ***
        { field: "Created", ascending: false } // Сортируем по дате создания (новые сначала)
      );
      
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Retrieved ${items.length} schedule logs with fixed Date-only support`);
      
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
            Date: this.ensureDate(fields.Date), // ✅ ИСПРАВЛЕНО: БЕЗ UTC конвертации
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
            Created: this.ensureDate(fields.Created), // ✅ ИСПРАВЛЕНО: БЕЗ UTC конвертации
            Modified: this.ensureDate(fields.Modified) // ✅ ИСПРАВЛЕНО: БЕЗ UTC конвертации
          };
          
          logs.push(log);
        } catch (itemError) {
          this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error processing log item: ${itemError}`);
        }
      }

      // *** ШАГ 5: ПРИМЕНЯЕМ КЛИЕНТСКУЮ ПАГИНАЦИЮ (если нужно) ***
      let paginatedLogs = logs;
      if (params.top || params.skip) {
        const skip = params.skip || 0;
        const top = params.top || 50;
        paginatedLogs = logs.slice(skip, skip + top);
        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Applied pagination with Date-only support (skip: ${skip}, top: ${top}): ${paginatedLogs.length} logs from ${logs.length} total`);
      }
      
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Successfully fetched ${paginatedLogs.length} logs with FIXED Date-only support`);
      
      return {
        logs: paginatedLogs,
        totalCount: logs.length,
        error: undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error fetching schedule logs: ${errorMessage}`);
      
      return {
        logs: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создает лог операции БЕЗ DateUtils.normalizeDateToUTCMidnight
   */
  public async createScheduleLog(params: ICreateScheduleLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Creating schedule log with FIXED Date-only format`);
      this.logInfo(`Parameters: ${JSON.stringify(params)}`);

      // СКОПИРОВАНО ИЗ ContractsService: Подготавливаем данные для MS Graph API
      const itemData: Record<string, unknown> = {
        Title: params.title,
        Result: params.result,
        Message: params.message
      };

      // 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Правильная обработка Date-only поля ScheduleLogs.Date
      if (params.date) {
        console.log('[ScheduleLogsService] 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ScheduleLogs.Date = Date-only поле, НЕ ИСПОЛЬЗУЕМ UTC КОНВЕРТАЦИЮ');
        console.log('[ScheduleLogsService] Original date (UI):', params.date.toLocaleDateString());
        
        // ✅ ИСПРАВЛЕНО: Используем локальные компоненты даты для Date-only поля
        const year = params.date.getFullYear();
        const month = (params.date.getMonth() + 1).toString().padStart(2, '0');
        const day = params.date.getDate().toString().padStart(2, '0');
        
        // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Date-only формат с UTC полночью для предотвращения timezone conversion
        const dateOnlyString = `${year}-${month}-${day}T00:00:00.000Z`;
        itemData.Date = dateOnlyString;
        
        console.log('[ScheduleLogsService] 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ScheduleLogs.Date (Date-only поле)');
        console.log('[ScheduleLogsService] Date-only string для SharePoint:', dateOnlyString);
        console.log('[ScheduleLogsService] Expected result: Правильный месяц в ScheduleLogs');
        
        this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Date normalized for ScheduleLogs.Date (Date-only): ${params.date.toLocaleDateString()} → ${dateOnlyString}`);
        
        // 🚨 УБРАНО: DateUtils.normalizeDateToUTCMidnight() - он делает timezone conversion!
        // const normalizedDate = DateUtils.normalizeDateToUTCMidnight(params.date);
        // itemData.Date = normalizedDate.toISOString();
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

      this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Prepared item data for save with FIXED Date-only: ${JSON.stringify(itemData, null, 2)}`);

      // СКОПИРОВАНО ИЗ ContractsService: Создаем новый элемент через RemoteSiteService
      try {
        const listId = await this._remoteSiteService.getListId(this._listName);
        
        const response = await this._remoteSiteService.addListItem(
          listId,
          itemData
        );
        
        if (response && response.id) {
          const result = this.ensureString(response.id);
          this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ScheduleLog создан с правильным Date-only форматом, ID: ${result}`);
          return result;
        } else {
          throw new Error('Failed to get ID from the created item');
        }
      } catch (error) {
        this.logError(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error creating new schedule log: ${error}`);
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error creating schedule log: ${errorMessage}`);
      return undefined;
    }
  }

  /**
   * 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создает лог для автозаполнения БЕЗ DateUtils.normalizeDateToUTCMidnight
   */
  public async createAutoFillLog(params: ICreateAutoFillLogParams): Promise<string | undefined> {
    try {
      this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Creating auto-fill log with FIXED Date-only format`);
      this.logInfo(`Auto-fill parameters: ${JSON.stringify(params)}`);

      // Подготавливаем данные для MS Graph API
      const itemData: Record<string, unknown> = {
        Title: `[${params.operationType}] ${params.title}`,
        Result: params.result,
        Message: this.buildAutoFillLogMessage(params)
      };

      // 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Правильная обработка Date-only поля ScheduleLogs.Date
      if (params.date) {
        console.log('[ScheduleLogsService] 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill ScheduleLogs.Date (Date-only поле)');
        console.log('[ScheduleLogsService] Original date (UI):', params.date.toLocaleDateString());
        
        // ✅ ИСПРАВЛЕНО: Используем локальные компоненты даты для Date-only поля
        const year = params.date.getFullYear();
        const month = (params.date.getMonth() + 1).toString().padStart(2, '0');
        const day = params.date.getDate().toString().padStart(2, '0');
        
        // ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Date-only формат с UTC полночью для предотвращения timezone conversion
        const dateOnlyString = `${year}-${month}-${day}T00:00:00.000Z`;
        itemData.Date = dateOnlyString;
        
        console.log('[ScheduleLogsService] 🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill ScheduleLogs.Date');
        console.log('[ScheduleLogsService] Date-only string для SharePoint:', dateOnlyString);
        console.log('[ScheduleLogsService] Expected result: Правильный месяц в Auto-fill ScheduleLogs');
        
        this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill date normalized for ScheduleLogs.Date (Date-only): ${params.date.toLocaleDateString()} → ${dateOnlyString}`);
        
        // 🚨 УБРАНО: DateUtils.normalizeDateToUTCMidnight() - он делает timezone conversion!
        // const normalizedDate = DateUtils.normalizeDateToUTCMidnight(params.date);
        // itemData.Date = normalizedDate.toISOString();
      }

      // [Остальная логика остается без изменений - добавление lookup полей]
      
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

      this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Prepared auto-fill item data for save with FIXED Date-only: ${JSON.stringify(itemData, null, 2)}`);

      // Создаем новый элемент через RemoteSiteService
      try {
        const listId = await this._remoteSiteService.getListId(this._listName);
        
        const response = await this._remoteSiteService.addListItem(
          listId,
          itemData
        );
        
        if (response && response.id) {
          const result = this.ensureString(response.id);
          this.logInfo(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill ScheduleLog создан с правильным Date-only форматом, ID: ${result}`);
          return result;
        } else {
          throw new Error('Failed to get ID from the created auto-fill log item');
        }
      } catch (error) {
        this.logError(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error creating new auto-fill log: ${error}`);
        throw error;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`🚨 КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error creating auto-fill log: ${errorMessage}`);
      return undefined;
    }
  }
  // src/webparts/kpfaplus/services/ScheduleLogsService.ts - ЧАСТЬ 4/4
// ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Дополнительные методы с поддержкой FIXED Date-only

  /**
   * ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Получает конкретный лог по ID с FIXED Date-only поддержкой
   */
  public async getScheduleLogById(logId: string): Promise<IScheduleLog | undefined> {
    try {
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Getting schedule log by ID: ${logId} with FIXED Date-only support`);

      // ИСПРАВЛЕНО: Используем прямой доступ к элементу по ID через RemoteSiteService
      const logIdNumber = parseInt(logId, 10);
      if (isNaN(logIdNumber)) {
        this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Invalid logId format: ${logId}`);
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
          Date: this.ensureDate(fields.Date), // ✅ ИСПРАВЛЕНО: БЕЗ UTC конвертации
          StaffMemberId: fields.StaffMemberLookupId ? this.ensureString(fields.StaffMemberLookupId) : undefined,
          ManagerId: fields.ManagerLookupId ? this.ensureString(fields.ManagerLookupId) : undefined,
          StaffGroupId: fields.StaffGroupLookupId ? this.ensureString(fields.StaffGroupLookupId) : undefined,
          WeeklyTimeTableId: fields.WeeklyTimeTableLookupId ? this.ensureString(fields.WeeklyTimeTableLookupId) : undefined,
          WeeklyTimeTableTitle: fields.WeeklyTimeTableLookup ? this.ensureString(fields.WeeklyTimeTableLookup) : undefined,
          Manager: createLookupInfo('ManagerLookupId', 'ManagerLookup'),
          StaffMember: createLookupInfo('StaffMemberLookupId', 'StaffMemberLookup'),
          StaffGroup: createLookupInfo('StaffGroupLookupId', 'StaffGroupLookup'),
          WeeklyTimeTable: createLookupInfo('WeeklyTimeTableLookupId', 'WeeklyTimeTableLookup'),
          Created: this.ensureDate(fields.Created), // ✅ ИСПРАВЛЕНО: БЕЗ UTC конвертации
          Modified: this.ensureDate(fields.Modified) // ✅ ИСПРАВЛЕНО: БЕЗ UTC конвертации
        };

        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Successfully retrieved log with FIXED Date-only support: ${log.Title}`);
        return log;
      } else {
        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Log with ID ${logId} not found`);
        return undefined;
      }

    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error getting schedule log by ID ${logId}: ${error}`);
      return undefined;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает статистику автозаполнения с FIXED Date-only поддержкой ***
   */
  public async getAutoFillStats(params: { 
    managerId?: string; 
    staffGroupId?: string; 
    periodDate?: Date;
    staffMemberId?: string;
  } = {}): Promise<IAutoFillLogStats> {
    try {
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Getting auto-fill statistics with FIXED Date-only filtering`);
      
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
      
      // Определяем период покрытия с правильной Date-only обработкой
      if (logs.length > 0) {
        const dates = logs.map(log => log.Date).sort((a, b) => a.getTime() - b.getTime());
        stats.periodCoverage.startDate = dates[0];
        stats.periodCoverage.endDate = dates[dates.length - 1];
      }
      
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill statistics with FIXED Date-only support: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error getting auto-fill statistics: ${error}`);
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
   * *** НОВЫЙ МЕТОД: Получает статистику логов с FIXED Date-only поддержкой ***
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
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Getting schedule logs statistics with FIXED Date-only support`);
      
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
      
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Schedule logs statistics with auto-fill breakdown: ${JSON.stringify(stats)}`);
      return stats;
      
    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error getting schedule logs statistics: ${error}`);
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
   * *** НОВЫЙ МЕТОД: Логирует предупреждение для автозаполнения с FIXED Date-only ***
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
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Logging auto-fill warning for staff: ${params.staffName} with FIXED Date-only`);
      
      const autoFillParams: ICreateAutoFillLogParams = {
        title: `Auto-Fill Warning - ${params.staffName}`,
        result: 3, // Warning
        message: `Auto-fill operation skipped: ${params.reason}`,
        date: params.period, // ✅ БУДЕТ ОБРАБОТАНО ПРАВИЛЬНО в createAutoFillLog
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
      
      const logId = await this.createAutoFillLog(autoFillParams); // ✅ ИСПОЛЬЗУЕТ ИСПРАВЛЕННЫЙ МЕТОД
      
      if (logId) {
        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill warning logged with FIXED Date-only, ID: ${logId}`);
      }
      
      return logId;
      
    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error logging auto-fill warning: ${error}`);
      return undefined;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Логирует пропуск автозаполнения с FIXED Date-only ***
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
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Logging auto-fill skip for staff: ${params.staffName} with FIXED Date-only`);
      
      const autoFillParams: ICreateAutoFillLogParams = {
        title: `Auto-Fill Skipped - ${params.staffName}`,
        result: 3, // Info/Skip
        message: `Auto-fill operation skipped: ${params.reason}`,
        date: params.period, // ✅ БУДЕТ ОБРАБОТАНО ПРАВИЛЬНО в createAutoFillLog
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
      
      const logId = await this.createAutoFillLog(autoFillParams); // ✅ ИСПОЛЬЗУЕТ ИСПРАВЛЕННЫЙ МЕТОД
      
      if (logId) {
        this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill skip logged with FIXED Date-only, ID: ${logId}`);
      }
      
      return logId;
      
    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error logging auto-fill skip: ${error}`);
      return undefined;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает детальную статистику по периодам с FIXED Date-only поддержкой ***
   */
  public async getDetailedStatsForPeriod(params: {
    managerId: string;
    staffGroupId: string;
    startDate: Date;
    endDate: Date;
  }): Promise<{
    totalLogs: number;
    logsByResult: { [result: number]: number };
    logsByOperationType: { autoFill: number; manual: number };
    dailyBreakdown: Array<{
      date: string;
      logsCount: number;
      successCount: number;
      errorCount: number;
    }>;
    staffBreakdown: Array<{
      staffId: string;
      staffName?: string;
      logsCount: number;
      lastActivity: Date;
    }>;
  }> {
    try {
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Getting detailed stats for period with FIXED Date-only support`);
      
      // Получаем все логи за период без periodDate (используем startDate/endDate логику)
      const result = await this.getScheduleLogs({
        managerId: params.managerId,
        staffGroupId: params.staffGroupId
        // Не используем periodDate, так как нам нужен кастомный период
      });
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Фильтруем логи по кастомному периоду с правильной Date-only логикой
      const filteredLogs = result.logs.filter(log => {
        const logDate = log.Date;
        return logDate >= params.startDate && logDate <= params.endDate;
      });
      
      // Статистика по результатам
      const logsByResult: { [result: number]: number } = {};
      filteredLogs.forEach(log => {
        logsByResult[log.Result] = (logsByResult[log.Result] || 0) + 1;
      });
      
      // Статистика по типам операций
      const autoFillLogs = filteredLogs.filter(log => log.Title.includes('Auto-Fill'));
      const manualLogs = filteredLogs.filter(log => !log.Title.includes('Auto-Fill'));
      
      // Daily breakdown с правильным Date-only форматированием
      const dailyMap = new Map<string, { logsCount: number; successCount: number; errorCount: number }>();
      filteredLogs.forEach(log => {
        const dateKey = log.Date.toLocaleDateString(); // ✅ ИСПОЛЬЗУЕМ localeString для Date-only
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { logsCount: 0, successCount: 0, errorCount: 0 });
        }
        const dayStats = dailyMap.get(dateKey)!;
        dayStats.logsCount++;
        if (log.Result === 2) dayStats.successCount++;
        if (log.Result === 1) dayStats.errorCount++;
      });
      
      const dailyBreakdown = Array.from(dailyMap.entries()).map(([date, stats]) => ({
        date,
        ...stats
      }));
      
      // Staff breakdown
      const staffMap = new Map<string, { logsCount: number; lastActivity: Date; staffName?: string }>();
      filteredLogs.forEach(log => {
        if (log.StaffMemberId) {
          const staffId = log.StaffMemberId;
          if (!staffMap.has(staffId)) {
            staffMap.set(staffId, { 
              logsCount: 0, 
              lastActivity: log.Date,
              staffName: log.StaffMember?.Title
            });
          }
          const staffStats = staffMap.get(staffId)!;
          staffStats.logsCount++;
          if (log.Date > staffStats.lastActivity) {
            staffStats.lastActivity = log.Date;
          }
        }
      });
      
      const staffBreakdown = Array.from(staffMap.entries()).map(([staffId, stats]) => ({
        staffId,
        ...stats
      }));
      
      const detailedStats = {
        totalLogs: filteredLogs.length,
        logsByResult,
        logsByOperationType: {
          autoFill: autoFillLogs.length,
          manual: manualLogs.length
        },
        dailyBreakdown,
        staffBreakdown
      };
      
      this.logInfo(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Detailed stats calculated with FIXED Date-only support: ${JSON.stringify(detailedStats)}`);
      return detailedStats;
      
    } catch (error) {
      this.logError(`✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Error getting detailed stats: ${error}`);
      return {
        totalLogs: 0,
        logsByResult: {},
        logsByOperationType: { autoFill: 0, manual: 0 },
        dailyBreakdown: [],
        staffBreakdown: []
      };
    }
  }

}