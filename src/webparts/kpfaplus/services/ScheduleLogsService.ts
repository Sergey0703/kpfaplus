// src/webparts/kpfaplus/services/ScheduleLogsService.ts
// ИСПРАВЛЕНО: Заменены any на конкретные типы и удалены неиспользуемые переменные
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

// *** ИНТЕРФЕЙСЫ ДЛЯ SCHEDULE LOGS ***
export interface IScheduleLog {
  ID?: string;
  Title?: string;
  Result?: number; // 1=Error, 2=Success, 3=Info
  Message?: string;
  Date?: string;
  StaffMemberId?: string;
  ManagerId?: string;
  StaffGroupId?: string;
  WeeklyTimeTableId?: string;
  Created: string; // ИСПРАВЛЕНО: убрана опциональность, всегда присутствует
  Modified?: string;
  // ИСПРАВЛЕНО: добавлены специфичные поля для LogDetailsDialog
  StaffMember?: {
    Id: string;
    Title: string;
  };
  Manager?: {
    Id: string;
    Title: string;
  };
  StaffGroup?: {
    Id: string;
    Title: string;
  };
  WeeklyTimeTable?: {
    Id: string;
    Title: string;
  };
  [key: string]: unknown;
}

export interface ICreateScheduleLogParams {
  title: string;
  result: number; // 1=Error, 2=Success, 3=Info
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
  weeklyTimeTableId?: string;
  periodDate?: Date;
  startDate?: Date;
  endDate?: Date;
  top?: number;
  skip?: number;
}

export interface IScheduleLogsResult {
  logs: IScheduleLog[];
  totalCount: number;
  error?: string;
}

// *** ИНТЕРФЕЙС ДЛЯ SHAREPOINT RESPONSE ***
interface ISharePointListResponse {
  value: IScheduleLogSharePointItem[];
  '@odata.count'?: number;
}

interface IScheduleLogSharePointItem {
  ID: string;
  Title: string;
  Result: number;
  Message: string;
  Date: string;
  StaffMemberId?: string;
  ManagerId?: string;
  StaffGroupId?: string;
  WeeklyTimeTableId?: string;
  Created: string; // ИСПРАВЛЕНО: убрана опциональность
  Modified: string;
  // ИСПРАВЛЕНО: добавлены lookup поля
  StaffMember?: {
    Id: string;
    Title: string;
  };
  Manager?: {
    Id: string;
    Title: string;
  };
  StaffGroup?: {
    Id: string;
    Title: string;
  };
  WeeklyTimeTable?: {
    Id: string;
    Title: string;
  };
  [key: string]: unknown;
}

export class ScheduleLogsService {
  private static instance: ScheduleLogsService;
  private context: WebPartContext;
  private listName: string = 'ScheduleLogs';

  private constructor(context: WebPartContext) {
    this.context = context;
    console.log('[ScheduleLogsService] Service initialized');
  }

  public static getInstance(context: WebPartContext): ScheduleLogsService {
    if (!ScheduleLogsService.instance) {
      ScheduleLogsService.instance = new ScheduleLogsService(context);
    }
    return ScheduleLogsService.instance;
  }

  /**
   * Создает новый лог операции заполнения расписания
   */
  public async createScheduleLog(params: ICreateScheduleLogParams): Promise<string | undefined> {
    console.log('[ScheduleLogsService] Creating schedule log:', {
      title: params.title,
      result: params.result,
      date: params.date.toLocaleDateString(),
      staffMemberId: params.staffMemberId,
      managerId: params.managerId
    });

    try {
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      const listUrl = `${siteUrl}/_api/web/lists/getbytitle('${this.listName}')/items`;

      // Формируем данные для создания
      const logData: Record<string, unknown> = {
        Title: params.title,
        Result: params.result,
        Message: params.message,
        Date: params.date.toISOString()
      };

      // Добавляем опциональные поля только если они заданы
      if (params.staffMemberId && params.staffMemberId.trim() !== '' && params.staffMemberId !== '0') {
        logData.StaffMemberId = params.staffMemberId;
      }

      if (params.managerId && params.managerId.trim() !== '' && params.managerId !== '0') {
        logData.ManagerId = params.managerId;
      }

      if (params.staffGroupId && params.staffGroupId.trim() !== '' && params.staffGroupId !== '0') {
        logData.StaffGroupId = params.staffGroupId;
      }

      if (params.weeklyTimeTableId && params.weeklyTimeTableId.trim() !== '' && params.weeklyTimeTableId !== '0') {
        logData.WeeklyTimeTableId = params.weeklyTimeTableId;
      }

      const response: SPHttpClientResponse = await this.context.spHttpClient.post(
        listUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose',
            'Content-Type': 'application/json;odata=verbose',
            'X-RequestDigest': await this.getRequestDigest()
          },
          body: JSON.stringify(logData)
        }
      );

      if (response.ok) {
        const responseData = await response.json() as { d: { ID: string } };
        const logId = responseData.d.ID;
        
        console.log(`[ScheduleLogsService] ✓ Schedule log created successfully with ID: ${logId}`);
        return logId;
      } else {
        const errorText = await response.text();
        console.error('[ScheduleLogsService] ✗ Error creating schedule log:', response.status, errorText);
        return undefined;
      }

    } catch {
      // ИСПРАВЛЕНО: Удалена неиспользуемая переменная error
      console.error('[ScheduleLogsService] ✗ Exception creating schedule log');
      return undefined;
    }
  }

  /**
   * Получает логи операций заполнения расписания с фильтрацией
   */
  public async getScheduleLogs(params: IGetScheduleLogsParams = {}): Promise<IScheduleLogsResult> {
    console.log('[ScheduleLogsService] Getting schedule logs with params:', params);

    try {
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      let apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${this.listName}')/items`;

      // Построение фильтров
      const filters: string[] = [];

      // Фильтр по сотруднику
      if (params.staffMemberId && params.staffMemberId.trim() !== '' && params.staffMemberId !== '0') {
        filters.push(`StaffMemberId eq '${params.staffMemberId}'`);
      }

      // Фильтр по менеджеру
      if (params.managerId && params.managerId.trim() !== '' && params.managerId !== '0') {
        filters.push(`ManagerId eq '${params.managerId}'`);
      }

      // Фильтр по группе
      if (params.staffGroupId && params.staffGroupId.trim() !== '' && params.staffGroupId !== '0') {
        filters.push(`StaffGroupId eq '${params.staffGroupId}'`);
      }

      // Фильтр по контракту
      if (params.weeklyTimeTableId && params.weeklyTimeTableId.trim() !== '' && params.weeklyTimeTableId !== '0') {
        filters.push(`WeeklyTimeTableId eq '${params.weeklyTimeTableId}'`);
      }

      // Фильтр по периоду (если указан periodDate)
      if (params.periodDate) {
        const year = params.periodDate.getFullYear();
        const month = params.periodDate.getMonth();
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0);
        
        const startDateStr = startOfMonth.toISOString();
        const endDateStr = endOfMonth.toISOString();
        
        filters.push(`Date ge datetime'${startDateStr}' and Date le datetime'${endDateStr}'`);
      }
      // Альтернативно, фильтр по диапазону дат
      else if (params.startDate && params.endDate) {
        const startDateStr = params.startDate.toISOString();
        const endDateStr = params.endDate.toISOString();
        
        filters.push(`Date ge datetime'${startDateStr}' and Date le datetime'${endDateStr}'`);
      }

      // Построение URL с параметрами
      const queryParams: string[] = [];
      
      if (filters.length > 0) {
        queryParams.push(`$filter=${encodeURIComponent(filters.join(' and '))}`);
      }

      // Сортировка по дате создания (новые первыми)
      queryParams.push('$orderby=Created desc');

      // Пагинация
      if (params.top && params.top > 0) {
        queryParams.push(`$top=${params.top}`);
      }

      if (params.skip && params.skip > 0) {
        queryParams.push(`$skip=${params.skip}`);
      }

      // Подсчет общего количества
      queryParams.push('$inlinecount=allpages');

      if (queryParams.length > 0) {
        apiUrl += `?${queryParams.join('&')}`;
      }

      console.log('[ScheduleLogsService] API URL:', apiUrl);

      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose'
          }
        }
      );

      if (response.ok) {
        const responseData = await response.json() as { d: ISharePointListResponse };
        const items = responseData.d.value || [];
        const totalCount = responseData.d['@odata.count'] || items.length;

        // Преобразуем SharePoint элементы в наш формат
        const logs: IScheduleLog[] = items.map((item: IScheduleLogSharePointItem): IScheduleLog => ({
          ID: item.ID,
          Title: item.Title,
          Result: item.Result,
          Message: item.Message,
          Date: item.Date,
          StaffMemberId: item.StaffMemberId,
          ManagerId: item.ManagerId,
          StaffGroupId: item.StaffGroupId,
          WeeklyTimeTableId: item.WeeklyTimeTableId,
          Created: item.Created, // ИСПРАВЛЕНО: всегда присутствует
          Modified: item.Modified,
          // ИСПРАВЛЕНО: добавляем lookup поля
          StaffMember: item.StaffMember,
          Manager: item.Manager,
          StaffGroup: item.StaffGroup,
          WeeklyTimeTable: item.WeeklyTimeTable
        }));

        console.log(`[ScheduleLogsService] ✓ Retrieved ${logs.length} schedule logs (total: ${totalCount})`);

        return {
          logs,
          totalCount
        };

      } else {
        const errorText = await response.text();
        console.error('[ScheduleLogsService] ✗ Error getting schedule logs:', response.status, errorText);
        
        return {
          logs: [],
          totalCount: 0,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

    } catch {
      // ИСПРАВЛЕНО: Удалена неиспользуемая переменная error
      console.error('[ScheduleLogsService] ✗ Exception getting schedule logs');
      
      return {
        logs: [],
        totalCount: 0,
        error: 'Exception occurred while fetching logs'
      };
    }
  }

  /**
   * Получает конкретный лог по ID
   */
  public async getScheduleLogById(logId: string): Promise<IScheduleLog | undefined> {
    console.log(`[ScheduleLogsService] Getting schedule log by ID: ${logId}`);

    try {
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${this.listName}')/items(${logId})`;

      const response: SPHttpClientResponse = await this.context.spHttpClient.get(
        apiUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose'
          }
        }
      );

      if (response.ok) {
        const responseData = await response.json() as { d: IScheduleLogSharePointItem };
        const item = responseData.d;

        const log: IScheduleLog = {
          ID: item.ID,
          Title: item.Title,
          Result: item.Result,
          Message: item.Message,
          Date: item.Date,
          StaffMemberId: item.StaffMemberId,
          ManagerId: item.ManagerId,
          StaffGroupId: item.StaffGroupId,
          WeeklyTimeTableId: item.WeeklyTimeTableId,
          Created: item.Created, // ИСПРАВЛЕНО: всегда присутствует
          Modified: item.Modified,
          // ИСПРАВЛЕНО: добавляем lookup поля
          StaffMember: item.StaffMember,
          Manager: item.Manager,
          StaffGroup: item.StaffGroup,
          WeeklyTimeTable: item.WeeklyTimeTable
        };

        console.log(`[ScheduleLogsService] ✓ Retrieved schedule log: ${log.Title}`);
        return log;

      } else if (response.status === 404) {
        console.log(`[ScheduleLogsService] Schedule log with ID ${logId} not found`);
        return undefined;
      } else {
        const errorText = await response.text();
        console.error('[ScheduleLogsService] ✗ Error getting schedule log by ID:', response.status, errorText);
        return undefined;
      }

    } catch {
      // ИСПРАВЛЕНО: Удалена неиспользуемая переменная error
      console.error(`[ScheduleLogsService] ✗ Exception getting schedule log by ID: ${logId}`);
      return undefined;
    }
  }

  /**
   * Удаляет лог по ID
   */
  public async deleteScheduleLog(logId: string): Promise<boolean> {
    console.log(`[ScheduleLogsService] Deleting schedule log: ${logId}`);

    try {
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      const apiUrl = `${siteUrl}/_api/web/lists/getbytitle('${this.listName}')/items(${logId})`;

      const response: SPHttpClientResponse = await this.context.spHttpClient.post(
        apiUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose',
            'X-RequestDigest': await this.getRequestDigest(),
            'IF-MATCH': '*',
            'X-HTTP-Method': 'DELETE'
          }
        }
      );

      if (response.ok || response.status === 204) {
        console.log(`[ScheduleLogsService] ✓ Schedule log ${logId} deleted successfully`);
        return true;
      } else {
        const errorText = await response.text();
        console.error('[ScheduleLogsService] ✗ Error deleting schedule log:', response.status, errorText);
        return false;
      }

    } catch {
      // ИСПРАВЛЕНО: Удалена неиспользуемая переменная error
      console.error(`[ScheduleLogsService] ✗ Exception deleting schedule log: ${logId}`);
      return false;
    }
  }

  /**
   * Получает статистику логов
   */
  public async getLogsStatistics(params: Omit<IGetScheduleLogsParams, 'top' | 'skip'> = {}): Promise<{
    total: number;
    success: number;
    errors: number;
    info: number;
    byStaff: Record<string, number>;
    byManager: Record<string, number>;
    byResult: Record<number, number>;
  } | undefined> {
    console.log('[ScheduleLogsService] Getting logs statistics');

    try {
      // Получаем все логи без пагинации для статистики
      const result = await this.getScheduleLogs({ ...params, top: undefined, skip: undefined });
      
      if (result.error) {
        console.error('[ScheduleLogsService] Error getting logs for statistics:', result.error);
        return undefined;
      }

      const logs = result.logs;
      
      // ИСПРАВЛЕНО: Заменены any на конкретные типы
      const byStaff: Record<string, number> = {};
      const byManager: Record<string, number> = {};
      const byResult: Record<number, number> = { 1: 0, 2: 0, 3: 0 }; // 1=Error, 2=Success, 3=Info
      
      let success = 0;
      let errors = 0;
      let info = 0;

      logs.forEach((log: IScheduleLog) => {
        // Подсчет по результатам
        const result = log.Result || 1;
        byResult[result] = (byResult[result] || 0) + 1;
        
        if (result === 2) success++;
        else if (result === 1) errors++;
        else if (result === 3) info++;

        // Подсчет по сотрудникам
        if (log.StaffMemberId) {
          byStaff[log.StaffMemberId] = (byStaff[log.StaffMemberId] || 0) + 1;
        }

        // Подсчет по менеджерам
        if (log.ManagerId) {
          byManager[log.ManagerId] = (byManager[log.ManagerId] || 0) + 1;
        }
      });

      const statistics = {
        total: logs.length,
        success,
        errors,
        info,
        byStaff,
        byManager,
        byResult
      };

      console.log('[ScheduleLogsService] ✓ Statistics calculated:', {
        total: statistics.total,
        success: statistics.success,
        errors: statistics.errors,
        info: statistics.info
      });

      return statistics;

    } catch {
      // ИСПРАВЛЕНО: Удалена неиспользуемая переменная error
      console.error('[ScheduleLogsService] ✗ Exception calculating logs statistics');
      return undefined;
    }
  }

  /**
   * Получает Request Digest для операций записи
   */
  private async getRequestDigest(): Promise<string> {
    try {
      const siteUrl = this.context.pageContext.web.absoluteUrl;
      const digestUrl = `${siteUrl}/_api/contextinfo`;

      const response: SPHttpClientResponse = await this.context.spHttpClient.post(
        digestUrl,
        SPHttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=verbose'
          }
        }
      );

      if (response.ok) {
        const digestData = await response.json() as { d: { GetContextWebInformation: { FormDigestValue: string } } };
        return digestData.d.GetContextWebInformation.FormDigestValue;
      } else {
        throw new Error(`Failed to get request digest: ${response.status}`);
      }

    } catch (error) {
      console.error('[ScheduleLogsService] Error getting request digest:', error);
      throw error;
    }
  }

  /**
   * Очищает инстанс сервиса
   */
  public static clearInstance(): void {
    ScheduleLogsService.instance = undefined as unknown as ScheduleLogsService;
    console.log('[ScheduleLogsService] Instance cleared');
  }

  /**
   * Получает информацию о сервисе
   */
  public getServiceInfo(): {
    listName: string;
    context: boolean;
    webUrl: string;
  } {
    return {
      listName: this.listName,
      context: !!this.context,
      webUrl: this.context.pageContext.web.absoluteUrl
    };
  }
}