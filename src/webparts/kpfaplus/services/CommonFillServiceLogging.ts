// src/webparts/kpfaplus/services/CommonFillServiceLogging.ts - Logging Operations (Part 4/4)
// МОДУЛЬ: Логирование операций заполнения с правильной поддержкой Date-only полей
// COMPLETE IMPLEMENTATION: Enhanced logging with detailed analysis and Date-only format support

import { ScheduleLogsService, ICreateScheduleLogParams } from './ScheduleLogsService';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { 
  IFillParams, 
  DialogType 
} from './CommonFillValidation';

// Import types from main service and other modules
import { IFillResult, IAutoFillResult } from './CommonFillService';

// *** INTERFACES FOR LOGGING OPERATIONS ***
interface ILogStatistics {
  totalLogs: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  dateRange: {
    earliest: string;
    latest: string;
  };
  logsByStaff: Map<string, number>;
  logsByPeriod: Map<string, number>;
}

export class CommonFillServiceLogging {
  private scheduleLogsService: ScheduleLogsService;
  private dateUtils: CommonFillDateUtils;

  constructor(
    scheduleLogsService: ScheduleLogsService,
    dateUtils: CommonFillDateUtils
  ) {
    this.scheduleLogsService = scheduleLogsService;
    this.dateUtils = dateUtils;
    console.log('[CommonFillServiceLogging] Logging module initialized with FIXED Date-only format support');
  }

  // *** PUBLIC API METHODS ***

  /**
   * *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создает лог с правильным Date-only форматом для ScheduleLogs ***
   */
  public async createFillLog(
    params: IFillParams, 
    result: IFillResult, 
    contractId?: string,
    additionalDetails?: string
  ): Promise<void> {
    try {
      const logMessage = this.buildDetailedLogMessage(params, result, contractId, additionalDetails);
      
      // *** ИСПРАВЛЕНО: Используем dateUtils для заголовка лога ***
      const periodStr = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);
      
      // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для создания Date-only Date объекта ***
      const dateOnlyForScheduleLogs = this.dateUtils.createDateOnlyFromDate(params.selectedDate);
      
      console.log('[CommonFillServiceLogging] *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: SCHEDULELOGS DATE-ONLY ПОЛЕ ***');
      console.log('[CommonFillServiceLogging] Original date (UI):', this.dateUtils.formatDateOnlyForDisplay(params.selectedDate));
      console.log('[CommonFillServiceLogging] Date-only Date object for ScheduleLogs.Date:', dateOnlyForScheduleLogs.toISOString());
      console.log('[CommonFillServiceLogging] Expected result: Correct month in ScheduleLogs');
      
      const logParams: ICreateScheduleLogParams = {
        title: `Fill Operation - ${params.staffMember.name} (${periodStr})`,
        result: result.logResult || (result.success ? 2 : 1),
        message: logMessage,
        // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создаем Date-only Date объект без timezone проблем ***
        date: this.dateUtils.createDateOnlyFromDate(params.selectedDate)  // ✅ Date-only Date объект!
      };

      // Add optional parameters only if they have valid values
      if (params.currentUserId && params.currentUserId.trim() !== '' && params.currentUserId !== '0') {
        logParams.managerId = params.currentUserId;
      }
      
      if (params.staffMember.employeeId && params.staffMember.employeeId.trim() !== '' && params.staffMember.employeeId !== '0') {
        logParams.staffMemberId = params.staffMember.employeeId;
      }
      
      if (params.managingGroupId && params.managingGroupId.trim() !== '' && params.managingGroupId !== '0') {
        logParams.staffGroupId = params.managingGroupId;
      }
      
      if (contractId && contractId.trim() !== '' && contractId !== '0') {
        logParams.weeklyTimeTableId = contractId;
      }

      const logId = await this.scheduleLogsService.createScheduleLog(logParams);
      
      if (logId) {
        console.log(`[CommonFillServiceLogging] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ScheduleLog создан с правильным Date-only форматом, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating fill log with fixed Date-only format:', error);
    }
  }

  /**
   * *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создание автозаполнения лога с правильным Date-only форматом ***
   */
  public async createAutoFillLog(
    params: IFillParams, 
    result: IAutoFillResult, 
    contractId?: string,
    operationDetails?: string
  ): Promise<void> {
    try {
      let logTitle: string;
      let logMessage: string;

      const periodStr = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);

      if (result.skipped) {
        logTitle = `Auto-Fill Skipped - ${params.staffMember.name} (${periodStr})`;
        logMessage = this.buildAutoFillLogMessage(params, result, contractId, operationDetails, 'SKIPPED');
      } else if (result.success) {
        logTitle = `Auto-Fill Success - ${params.staffMember.name} (${periodStr})`;
        logMessage = this.buildAutoFillLogMessage(params, result, contractId, operationDetails, 'SUCCESS');
      } else {
        logTitle = `Auto-Fill Error - ${params.staffMember.name} (${periodStr})`;
        logMessage = this.buildAutoFillLogMessage(params, result, contractId, operationDetails, 'ERROR');
      }
      
      // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для Date-only поля ScheduleLogs.Date ***
      const dateOnlyForScheduleLogs = this.dateUtils.createDateOnlyFromDate(params.selectedDate);
      
      console.log('[CommonFillServiceLogging] *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: AUTO-FILL SCHEDULELOGS DATE-ONLY ***');
      console.log('[CommonFillServiceLogging] Original date (UI):', this.dateUtils.formatDateOnlyForDisplay(params.selectedDate));
      console.log('[CommonFillServiceLogging] Date-only Date object for ScheduleLogs.Date:', dateOnlyForScheduleLogs.toISOString());
      
      const logParams: ICreateScheduleLogParams = {
        title: logTitle,
        result: result.logResult,
        message: logMessage,
        // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создаем Date-only Date объект без timezone проблем ***
        date: this.dateUtils.createDateOnlyFromDate(params.selectedDate)  // ✅ Date-only Date объект!
      };

      // Add optional parameters only if they have valid values
      if (params.currentUserId && params.currentUserId.trim() !== '' && params.currentUserId !== '0') {
        logParams.managerId = params.currentUserId;
      }
      
      if (params.staffMember.employeeId && params.staffMember.employeeId.trim() !== '' && params.staffMember.employeeId !== '0') {
        logParams.staffMemberId = params.staffMember.employeeId;
      }
      
      if (params.managingGroupId && params.managingGroupId.trim() !== '' && params.managingGroupId !== '0') {
        logParams.staffGroupId = params.managingGroupId;
      }
      
      if (contractId && contractId.trim() !== '' && contractId !== '0') {
        logParams.weeklyTimeTableId = contractId;
      }

      const logId = await this.scheduleLogsService.createScheduleLog(logParams);
      
      if (logId) {
        console.log(`[CommonFillServiceLogging] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill ScheduleLog создан с правильным Date-only форматом, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating auto-fill log with fixed Date-only format:', error);
    }
  }

  /**
   * Логирует отказ пользователя с правильным Date-only форматом
   */
  public async logUserRefusal(params: IFillParams, dialogType: DialogType, contractId?: string): Promise<void> {
    console.log('[CommonFillServiceLogging] Logging user refusal with FIXED Date-only logging:', {
      staffMember: params.staffMember.name,
      dialogType,
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)
    });

    const result: IFillResult = {
      success: false,
      message: `User cancelled ${dialogType} dialog for ${params.staffMember.name}`,
      messageType: 4, // Info
      requiresDialog: false,
      canProceed: false,
      logResult: 3
    };

    const refusalDetails = [
      'USER REFUSAL DETAILS:',
      `Dialog type: ${dialogType}`,
      `Staff member: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`,
      `Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`,
      `Contract ID: ${contractId || 'Not specified'}`,
      `Manager ID: ${params.currentUserId || 'Not specified'}`,
      `Group ID: ${params.managingGroupId || 'Not specified'}`,
      `Action: User cancelled the operation`
    ];

    await this.createFillLog(params, result, contractId, refusalDetails.join('\n'));
  }

  /**
   * Создает лог операции с подробным анализом
   */
  public async createDetailedOperationLog(
    params: IFillParams,
    operationType: 'FILL' | 'AUTO_FILL' | 'VALIDATION' | 'DELETE',
    status: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO',
    message: string,
    details: {
      contractId?: string;
      recordsCreated?: number;
      recordsDeleted?: number;
      processingTime?: number;
      additionalInfo?: string;
    }
  ): Promise<string | undefined> {
    try {
      const periodStr = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);
      const timestamp = new Date().toISOString();
      
      const logTitle = `${operationType} Operation - ${params.staffMember.name} (${periodStr})`;
      
      const logDetails = [
        `=== ${operationType} OPERATION LOG WITH FIXED DATE-ONLY LOGGING ===`,
        `Timestamp: ${timestamp}`,
        `Operation Type: ${operationType}`,
        `Status: ${status}`,
        `Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`,
        `Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`,
        `Manager: ${params.currentUserId || 'N/A'}`,
        `Staff Group: ${params.managingGroupId || 'N/A'}`,
        '',
        `OPERATION RESULT: ${status}`,
        `Message: ${message}`,
        ''
      ];

      // Add detailed information
      if (details.contractId) {
        logDetails.push(`Contract ID: ${details.contractId}`);
      }
      
      if (details.recordsCreated !== undefined) {
        logDetails.push(`Records Created: ${details.recordsCreated}`);
      }
      
      if (details.recordsDeleted !== undefined) {
        logDetails.push(`Records Deleted: ${details.recordsDeleted}`);
      }
      
      if (details.processingTime !== undefined) {
        logDetails.push(`Processing Time: ${this.formatDuration(details.processingTime)}`);
      }

      if (details.additionalInfo) {
        logDetails.push('');
        logDetails.push('ADDITIONAL DETAILS:');
        logDetails.push(details.additionalInfo);
      }

      logDetails.push('');
      logDetails.push(`=== END ${operationType} LOG ===`);

      // Determine log result code
      let logResult: number;
      switch (status) {
        case 'SUCCESS':
          logResult = 2;
          break;
        case 'WARNING':
        case 'INFO':
          logResult = 3;
          break;
        case 'ERROR':
        default:
          logResult = 1;
          break;
      }

      // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для Date-only поля ***
      const logParams: ICreateScheduleLogParams = {
        title: logTitle,
        result: logResult,
        message: logDetails.join('\n'),
        date: this.dateUtils.createDateOnlyFromDate(params.selectedDate)
      };

      // Add optional parameters
      if (params.currentUserId && params.currentUserId.trim() !== '' && params.currentUserId !== '0') {
        logParams.managerId = params.currentUserId;
      }
      
      if (params.staffMember.employeeId && params.staffMember.employeeId.trim() !== '' && params.staffMember.employeeId !== '0') {
        logParams.staffMemberId = params.staffMember.employeeId;
      }
      
      if (params.managingGroupId && params.managingGroupId.trim() !== '' && params.managingGroupId !== '0') {
        logParams.staffGroupId = params.managingGroupId;
      }
      
      if (details.contractId && details.contractId.trim() !== '' && details.contractId !== '0') {
        logParams.weeklyTimeTableId = details.contractId;
      }

      const logId = await this.scheduleLogsService.createScheduleLog(logParams);
      
      if (logId) {
        console.log(`[CommonFillServiceLogging] ✅ Detailed operation log created with Date-only format, ID: ${logId}, Type: ${operationType}, Status: ${status}`);
      }

      return logId;

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating detailed operation log:', error);
      return undefined;
    }
  }

  /**
   * Получает статистику логов для staff member
   */
  public async getLogStatisticsForStaff(
    staffMemberId: string,
    managerId: string,
    staffGroupId: string,
    periodStartDate: Date,
    periodEndDate: Date
  ): Promise<ILogStatistics> {
    try {
      console.log('[CommonFillServiceLogging] Getting log statistics with Date-only format support:', {
        staffMemberId,
        period: `${this.dateUtils.formatDateOnlyForDisplay(periodStartDate)} - ${this.dateUtils.formatDateOnlyForDisplay(periodEndDate)}`
      });

      // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Используем Date-only даты для запроса ***
      const startDateOnly = this.dateUtils.createDateOnlyFromDate(periodStartDate);

      const logsResult = await this.scheduleLogsService.getScheduleLogs({
        staffMemberId,
        managerId,
        staffGroupId,
        periodDate: startDateOnly,
        top: 1000
      });

      if (logsResult.error) {
        throw new Error(logsResult.error);
      }

      const logs = logsResult.logs;
      
      // Анализируем статистику
      let successCount = 0;
      let errorCount = 0;
      let warningCount = 0;
      
      const logsByStaff = new Map<string, number>();
      const logsByPeriod = new Map<string, number>();
      
      const dates: Date[] = [];

      logs.forEach(log => {
        // Подсчет по результатам
        switch (log.Result) {
          case 2:
            successCount++;
            break;
          case 3:
            warningCount++;
            break;
          case 1:
          default:
            errorCount++;
            break;
        }

        // Группировка по staff
        if (log.StaffMemberId) {
          const currentCount = logsByStaff.get(log.StaffMemberId) || 0;
          logsByStaff.set(log.StaffMemberId, currentCount + 1);
        }

        // Группировка по периодам (месяцам)
        if (log.Date) {
          const periodKey = this.dateUtils.formatDateOnlyForDisplay(log.Date).substring(3); // MM.YYYY
          const currentCount = logsByPeriod.get(periodKey) || 0;
          logsByPeriod.set(periodKey, currentCount + 1);
          dates.push(log.Date);
        }
      });

      // Определяем диапазон дат
      dates.sort((a, b) => a.getTime() - b.getTime());
      const earliest = dates.length > 0 ? this.dateUtils.formatDateOnlyForDisplay(dates[0]) : 'N/A';
      const latest = dates.length > 0 ? this.dateUtils.formatDateOnlyForDisplay(dates[dates.length - 1]) : 'N/A';

      const statistics: ILogStatistics = {
        totalLogs: logs.length,
        successCount,
        errorCount,
        warningCount,
        dateRange: {
          earliest,
          latest
        },
        logsByStaff,
        logsByPeriod
      };

      console.log('[CommonFillServiceLogging] Log statistics with Date-only format:', {
        total: statistics.totalLogs,
        success: statistics.successCount,
        errors: statistics.errorCount,
        warnings: statistics.warningCount,
        dateRange: statistics.dateRange
      });

      return statistics;

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error getting log statistics:', error);
      
      return {
        totalLogs: 0,
        successCount: 0,
        errorCount: 0,
        warningCount: 0,
        dateRange: {
          earliest: 'Error',
          latest: 'Error'
        },
        logsByStaff: new Map(),
        logsByPeriod: new Map()
      };
    }
  }

  /**
   * Создает сводный отчет по операциям
   */
  public async generateOperationReport(
    staffMemberId: string,
    managerId: string,
    staffGroupId: string,
    periodStartDate: Date,
    periodEndDate: Date
  ): Promise<string> {
    try {
      const statistics = await this.getLogStatisticsForStaff(
        staffMemberId,
        managerId,
        staffGroupId,
        periodStartDate,
        periodEndDate
      );

      const lines: string[] = [];
      
      lines.push('=== FILL OPERATIONS REPORT WITH DATE-ONLY FORMAT ===');
      lines.push('');
      lines.push(`Staff Member ID: ${staffMemberId}`);
      lines.push(`Manager ID: ${managerId}`);
      lines.push(`Staff Group ID: ${staffGroupId}`);
      lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(periodStartDate)} - ${this.dateUtils.formatDateOnlyForDisplay(periodEndDate)}`);
      lines.push(`Report Generated: ${this.dateUtils.formatDateOnlyForDisplay(new Date())}`);
      lines.push('');
      
      lines.push('SUMMARY STATISTICS:');
      lines.push(`Total Operations: ${statistics.totalLogs}`);
      lines.push(`Successful: ${statistics.successCount} (${this.calculatePercentage(statistics.successCount, statistics.totalLogs)}%)`);
      lines.push(`Errors: ${statistics.errorCount} (${this.calculatePercentage(statistics.errorCount, statistics.totalLogs)}%)`);
      lines.push(`Warnings/Info: ${statistics.warningCount} (${this.calculatePercentage(statistics.warningCount, statistics.totalLogs)}%)`);
      lines.push(`Date Range: ${statistics.dateRange.earliest} - ${statistics.dateRange.latest}`);
      lines.push('');

      if (statistics.logsByPeriod.size > 0) {
        lines.push('OPERATIONS BY PERIOD:');
        Array.from(statistics.logsByPeriod.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([period, count]) => {
            lines.push(`  ${period}: ${count} operations`);
          });
        lines.push('');
      }

      // Success rate analysis
      const successRate = this.calculatePercentage(statistics.successCount, statistics.totalLogs);
      lines.push('PERFORMANCE ANALYSIS:');
      
      if (successRate >= 90) {
        lines.push('✅ Excellent performance (≥90% success rate)');
      } else if (successRate >= 75) {
        lines.push('⚠️ Good performance (75-89% success rate)');
      } else if (successRate >= 50) {
        lines.push('⚠️ Moderate performance (50-74% success rate)');
      } else {
        lines.push('❌ Poor performance (<50% success rate)');
      }
      
      lines.push('');
      lines.push('=== END OF REPORT ===');
      
      return lines.join('\n');

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error generating operation report:', error);
      return `Error generating report: ${error}`;
    }
  }

  // *** PRIVATE HELPER METHODS ***

  /**
   * *** ОБНОВЛЕНО: Формирует детальное сообщение для лога с FIXED Date-only информацией ***
   */
  private buildDetailedLogMessage(
    params: IFillParams, 
    result: IFillResult, 
    contractId?: string,
    additionalDetails?: string
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== DETAILED FILL OPERATION LOG WITH FIXED DATE-ONLY LOGGING ===`);
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push('');

    // *** ИСПРАВЛЕНО: ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О ПЕРИОДЕ С DATE-ONLY ФОРМАТОМ ***
    const monthPeriod = this.getMonthPeriodForDisplay(params.selectedDate);
    
    lines.push(`PERIOD AND DATE-ONLY PROCESSING DETAILS:`);
    lines.push(`Selected Date (Date-only): ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    lines.push(`Month Range (Date-only): ${monthPeriod.start} - ${monthPeriod.end}`);
    lines.push(`Day of Start Week: ${params.dayOfStartWeek || 7}`);
    lines.push(`Current User ID (for filtering): ${params.currentUserId || 'N/A'}`);
    lines.push(`Managing Group ID (for filtering): ${params.managingGroupId || 'N/A'}`);
    lines.push(`Date-only Format Processing: ENABLED (correct UI behavior)`);
    lines.push('');

    // *** ПРАВИЛЬНЫЙ СТАТУС ОПЕРАЦИИ ***
    const logResult = result.logResult || (result.success ? 2 : 1);
    const operationStatus = logResult === 2 ? 'SUCCESS' : 
                           logResult === 3 ? 'INFO/REFUSAL' : 'FAILED';
    
    lines.push(`OPERATION RESULT: ${operationStatus}`);
    lines.push(`Message: ${result.message}`);
    
    if (result.requiresDialog) {
      lines.push(`Requires Dialog: Yes`);
      lines.push(`Log Status: ${logResult === 3 ? 'Info/Refusal' : 'Dialog Request'}`);
    }
    
    if (result.createdRecordsCount !== undefined) {
      lines.push(`Records Created: ${result.createdRecordsCount}`);
    }
    
    if (result.deletedRecordsCount !== undefined) {
      lines.push(`Records Deleted: ${result.deletedRecordsCount}`);
    }
    
    if (contractId) {
      lines.push(`Contract ID: ${contractId}`);
    }
    
    lines.push('');

    // *** ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ВКЛЮЧАЯ ПРАВИЛЬНЫЕ ПЕРИОДЫ ***
    if (additionalDetails) {
      lines.push('DETAILED OPERATION ANALYSIS WITH FIXED DATE-ONLY LOGGING:');
      lines.push(additionalDetails);
      lines.push('');
    }

    lines.push(`=== END DETAILED LOG ===`);
    
    return lines.join('\n');
  }

  /**
   * *** НОВЫЙ МЕТОД: Формирует сообщение для лога автозаполнения ***
   */
  private buildAutoFillLogMessage(
    params: IFillParams, 
    result: IAutoFillResult, 
    contractId: string | undefined,
    operationDetails: string | undefined,
    status: 'SUCCESS' | 'ERROR' | 'SKIPPED'
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== AUTO-FILL OPERATION LOG WITH FIXED DATE-ONLY LOGGING ===`);
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push(`Status: ${status}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push(`Auto Schedule: ${params.staffMember.autoSchedule || false}`);
    lines.push('');

    // *** ИСПРАВЛЕНО: ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О ПЕРИОДЕ С DATE-ONLY ФОРМАТОМ ***
    const monthPeriod = this.getMonthPeriodForDisplay(params.selectedDate);
    
    lines.push(`PERIOD AND DATE-ONLY PROCESSING DETAILS:`);
    lines.push(`Selected Date (Date-only): ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    lines.push(`Month Range (Date-only): ${monthPeriod.start} - ${monthPeriod.end}`);
    lines.push(`Day of Start Week: ${params.dayOfStartWeek || 7}`);
    lines.push(`Date-only Format Processing: ENABLED (correct UI behavior)`);
    lines.push('');

    // *** РЕЗУЛЬТАТ ОПЕРАЦИИ ***
    lines.push(`AUTO-FILL RESULT: ${status}`);
    lines.push(`Message: ${result.message}`);
    
    if (result.skipped) {
      lines.push(`Skip Reason: ${result.skipReason || 'Unknown'}`);
    }
    
    if (result.createdRecordsCount !== undefined) {
      lines.push(`Records Created: ${result.createdRecordsCount}`);
    }
    
    if (contractId) {
      lines.push(`Contract ID: ${contractId}`);
    }
    
    lines.push(`Log Result Code: ${result.logResult} (${result.logResult === 2 ? 'Success' : result.logResult === 3 ? 'Warning/Skip' : 'Error'})`);
    lines.push('');

    // *** ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ВКЛЮЧАЯ ПРАВИЛЬНЫЕ ПЕРИОДЫ ***
    if (operationDetails) {
      lines.push('DETAILED AUTO-FILL OPERATION ANALYSIS:');
      lines.push(operationDetails);
      lines.push('');
    }

    lines.push(`=== END AUTO-FILL LOG ===`);
    
    return lines.join('\n');
  }

  /**
   * *** ИСПРАВЛЕНО: Получает период месяца для отображения в логах используя dateUtils ***
   */
  private getMonthPeriodForDisplay(date: Date): { start: string; end: string } {
    try {
      const startOfMonth = this.dateUtils.createDateOnlyFromComponents(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = this.dateUtils.createDateOnlyFromComponents(date.getFullYear(), date.getMonth() + 1, 0);
      
      return {
        start: this.dateUtils.formatDateOnlyForDisplay(startOfMonth),
        end: this.dateUtils.formatDateOnlyForDisplay(endOfMonth)
      };
    } catch (error) {
      console.warn('[CommonFillServiceLogging] Error getting month period for display:', error);
      return {
        start: 'Error',
        end: 'Error'
      };
    }
  }

  /**
   * Форматирует длительность в читаемом виде
   */
  private formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${milliseconds}ms`;
    }
    
    const seconds = Math.floor(milliseconds / 1000);
    if (seconds < 60) {
      return `${seconds}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Вычисляет процентное соотношение
   */
  private calculatePercentage(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }

  // *** ADVANCED LOGGING METHODS ***

  /**
   * Создает лог с метриками производительности
   */
  public async createPerformanceLog(
    params: IFillParams,
    operationType: string,
    metrics: {
      startTime: number;
      endTime: number;
      recordsProcessed: number;
      operationsCompleted: number;
      errorsEncountered: number;
      memoryUsage?: number;
    },
    contractId?: string
  ): Promise<void> {
    try {
      const processingTime = metrics.endTime - metrics.startTime;
      const successRate = metrics.operationsCompleted > 0 
        ? Math.round((metrics.operationsCompleted / (metrics.operationsCompleted + metrics.errorsEncountered)) * 100)
        : 0;

      const performanceReport = [
        '=== PERFORMANCE METRICS WITH DATE-ONLY FORMAT ===',
        `Operation Type: ${operationType}`,
        `Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`,
        `Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`,
        '',
        'TIMING METRICS:',
        `Start Time: ${new Date(metrics.startTime).toISOString()}`,
        `End Time: ${new Date(metrics.endTime).toISOString()}`,
        `Total Processing Time: ${this.formatDuration(processingTime)}`,
        '',
        'OPERATION METRICS:',
        `Records Processed: ${metrics.recordsProcessed}`,
        `Operations Completed: ${metrics.operationsCompleted}`,
        `Errors Encountered: ${metrics.errorsEncountered}`,
        `Success Rate: ${successRate}%`,
        '',
        'PERFORMANCE ANALYSIS:',
        `Records per Second: ${this.calculateRate(metrics.recordsProcessed, processingTime)}`,
        `Operations per Second: ${this.calculateRate(metrics.operationsCompleted, processingTime)}`,
        ''
      ];

      if (metrics.memoryUsage) {
        performanceReport.push(`Memory Usage: ${this.formatMemory(metrics.memoryUsage)}`);
        performanceReport.push('');
      }

      // Performance assessment
      const recordsPerSecond = this.calculateRate(metrics.recordsProcessed, processingTime);
      if (recordsPerSecond > 10) {
        performanceReport.push('✅ Excellent performance (>10 records/sec)');
      } else if (recordsPerSecond > 5) {
        performanceReport.push('✅ Good performance (5-10 records/sec)');
      } else if (recordsPerSecond > 1) {
        performanceReport.push('⚠️ Moderate performance (1-5 records/sec)');
      } else {
        performanceReport.push('❌ Poor performance (<1 record/sec)');
      }

      performanceReport.push('');
      performanceReport.push('=== END PERFORMANCE METRICS ===');

      await this.createDetailedOperationLog(
        params,
        'FILL',
        successRate > 80 ? 'SUCCESS' : successRate > 50 ? 'WARNING' : 'ERROR',
        `Performance monitoring: ${successRate}% success rate, ${this.formatDuration(processingTime)} processing time`,
        {
          contractId,
          recordsCreated: metrics.recordsProcessed,
          processingTime,
          additionalInfo: performanceReport.join('\n')
        }
      );

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating performance log:', error);
    }
  }

  /**
   * Создает лог с анализом ошибок
   */
  public async createErrorAnalysisLog(
    params: IFillParams,
    errors: Array<{
      type: string;
      message: string;
      timestamp: number;
      context?: string;
    }>,
    contractId?: string
  ): Promise<void> {
    try {
      const errorsByType = new Map<string, number>();
      const recentErrors = errors.slice(-10); // Last 10 errors

      errors.forEach(error => {
        const count = errorsByType.get(error.type) || 0;
        errorsByType.set(error.type, count + 1);
      });

      const errorAnalysis = [
        '=== ERROR ANALYSIS WITH DATE-ONLY FORMAT ===',
        `Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`,
        `Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`,
        `Analysis Time: ${new Date().toISOString()}`,
        '',
        'ERROR SUMMARY:',
        `Total Errors: ${errors.length}`,
        `Error Types: ${errorsByType.size}`,
        '',
        'ERRORS BY TYPE:'
      ];

      Array.from(errorsByType.entries())
        .sort(([, a], [, b]) => b - a)
        .forEach(([type, count]) => {
          const percentage = this.calculatePercentage(count, errors.length);
          errorAnalysis.push(`  ${type}: ${count} occurrences (${percentage}%)`);
        });

      errorAnalysis.push('');
      errorAnalysis.push('RECENT ERRORS:');
      
      recentErrors.forEach((error, index) => {
        const timeStr = new Date(error.timestamp).toISOString();
        errorAnalysis.push(`  ${index + 1}. [${timeStr}] ${error.type}: ${error.message}`);
        if (error.context) {
          errorAnalysis.push(`     Context: ${error.context}`);
        }
      });

      errorAnalysis.push('');
      errorAnalysis.push('RECOMMENDATIONS:');
      
      // Generate recommendations based on error patterns
      const topErrorType = Array.from(errorsByType.entries()).sort(([, a], [, b]) => b - a)[0];
      if (topErrorType) {
        const [errorType, count] = topErrorType;
        const percentage = this.calculatePercentage(count, errors.length);
        
        if (percentage > 50) {
          errorAnalysis.push(`⚠️ PRIMARY ISSUE: ${errorType} accounts for ${percentage}% of errors`);
          errorAnalysis.push('   Recommendation: Focus on resolving this error type first');
        }
        
        if (errorType.toLowerCase().includes('timeout')) {
          errorAnalysis.push('💡 Consider increasing timeout values or optimizing queries');
        } else if (errorType.toLowerCase().includes('permission')) {
          errorAnalysis.push('💡 Review user permissions and access rights');
        } else if (errorType.toLowerCase().includes('validation')) {
          errorAnalysis.push('💡 Review input data validation and business rules');
        }
      }

      errorAnalysis.push('');
      errorAnalysis.push('=== END ERROR ANALYSIS ===');

      await this.createDetailedOperationLog(
        params,
        'VALIDATION',
        'ERROR',
        `Error analysis: ${errors.length} errors found, ${errorsByType.size} distinct types`,
        {
          contractId,
          additionalInfo: errorAnalysis.join('\n')
        }
      );

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating error analysis log:', error);
    }
  }

  /**
   * Создает суммарный лог по операциям автозаполнения
   */
  public async createAutoFillSummaryLog(
    batchResults: Array<{
      staffId: string;
      staffName: string;
      success: boolean;
      message: string;
      createdRecords?: number;
      skipReason?: string;
      processingTime?: number;
    }>,
    totalExecutionTime: number,
    selectedDate: Date,
    managerId: string = '',
    staffGroupId: string = ''
  ): Promise<void> {
    try {
      const successfulOperations = batchResults.filter(r => r.success);
      const skippedOperations = batchResults.filter(r => !r.success && r.skipReason);
      const failedOperations = batchResults.filter(r => !r.success && !r.skipReason);
      
      const totalRecordsCreated = batchResults
        .filter(r => r.createdRecords)
        .reduce((sum, r) => sum + (r.createdRecords || 0), 0);

      const summaryReport = [
        '=== AUTO-FILL BATCH SUMMARY WITH DATE-ONLY FORMAT ===',
        `Execution Date: ${new Date().toISOString()}`,
        `Period: ${this.dateUtils.formatDateOnlyForDisplay(selectedDate)}`,
        `Manager ID: ${managerId || 'N/A'}`,
        `Staff Group ID: ${staffGroupId || 'N/A'}`,
        `Total Execution Time: ${this.formatDuration(totalExecutionTime)}`,
        '',
        'BATCH STATISTICS:',
        `Total Staff Processed: ${batchResults.length}`,
        `Successful Operations: ${successfulOperations.length} (${this.calculatePercentage(successfulOperations.length, batchResults.length)}%)`,
        `Skipped Operations: ${skippedOperations.length} (${this.calculatePercentage(skippedOperations.length, batchResults.length)}%)`,
        `Failed Operations: ${failedOperations.length} (${this.calculatePercentage(failedOperations.length, batchResults.length)}%)`,
        `Total Records Created: ${totalRecordsCreated}`,
        '',
        'PERFORMANCE METRICS:',
        `Operations per Minute: ${this.calculateRate(batchResults.length, totalExecutionTime, 60000)}`,
        `Records per Minute: ${this.calculateRate(totalRecordsCreated, totalExecutionTime, 60000)}`,
        `Average Time per Staff: ${this.formatDuration(totalExecutionTime / batchResults.length)}`,
        ''
      ];

      // Add successful operations
      if (successfulOperations.length > 0) {
        summaryReport.push('SUCCESSFUL OPERATIONS:');
        successfulOperations.forEach(op => {
          summaryReport.push(`  ✅ ${op.staffName}: ${op.createdRecords || 0} records created`);
        });
        summaryReport.push('');
      }

      // Add skipped operations
      if (skippedOperations.length > 0) {
        summaryReport.push('SKIPPED OPERATIONS:');
        skippedOperations.forEach(op => {
          summaryReport.push(`  ⚠️ ${op.staffName}: ${op.skipReason || 'Unknown reason'}`);
        });
        summaryReport.push('');
      }

      // Add failed operations
      if (failedOperations.length > 0) {
        summaryReport.push('FAILED OPERATIONS:');
        failedOperations.forEach(op => {
          summaryReport.push(`  ❌ ${op.staffName}: ${op.message}`);
        });
        summaryReport.push('');
      }

      // Overall assessment
      const successRate = this.calculatePercentage(successfulOperations.length, batchResults.length);
      summaryReport.push('OVERALL ASSESSMENT:');
      
      if (successRate >= 90) {
        summaryReport.push('🎉 Excellent batch performance (≥90% success rate)');
      } else if (successRate >= 75) {
        summaryReport.push('✅ Good batch performance (75-89% success rate)');
      } else if (successRate >= 50) {
        summaryReport.push('⚠️ Moderate batch performance (50-74% success rate)');
      } else {
        summaryReport.push('❌ Poor batch performance (<50% success rate)');
      }

      summaryReport.push('');
      summaryReport.push('=== END AUTO-FILL BATCH SUMMARY ===');

      // Create a synthetic params object for logging
      const summaryParams: IFillParams = {
        selectedDate,
        staffMember: {
          id: 'BATCH_OPERATION',
          name: `Auto-Fill Batch (${batchResults.length} staff)`,
          employeeId: 'BATCH'
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        currentUserId: managerId,
        managingGroupId: staffGroupId,
        context: {} as any // eslint-disable-line @typescript-eslint/no-explicit-any
      };

      await this.createDetailedOperationLog(
        summaryParams,
        'AUTO_FILL',
        successRate > 75 ? 'SUCCESS' : successRate > 50 ? 'WARNING' : 'ERROR',
        `Auto-fill batch completed: ${successfulOperations.length}/${batchResults.length} successful, ${totalRecordsCreated} records created`,
        {
          recordsCreated: totalRecordsCreated,
          processingTime: totalExecutionTime,
          additionalInfo: summaryReport.join('\n')
        }
      );

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating auto-fill summary log:', error);
    }
  }

  // *** UTILITY HELPER METHODS ***

  /**
   * Вычисляет скорость операций
   */
  private calculateRate(operations: number, timeMs: number, timeUnit: number = 1000): number {
    if (timeMs === 0) return 0;
    return Math.round((operations / timeMs) * timeUnit * 100) / 100;
  }

  /**
   * Форматирует память в читаемом виде
   */
  private formatMemory(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
  }

  /**
   * Создает краткий лог для быстрых операций
   */
  public async createQuickLog(
    params: IFillParams,
    message: string,
    contractId: string | undefined = undefined,
    logLevel: 'SUCCESS' | 'ERROR' | 'WARNING' | 'INFO' = 'INFO'
  ): Promise<void> {
    try {
      const logResult = logLevel === 'SUCCESS' ? 2 : logLevel === 'ERROR' ? 1 : 3;
      const periodStr = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);
      
      const quickLogParams: ICreateScheduleLogParams = {
        title: `Quick Log - ${params.staffMember.name} (${periodStr})`,
        result: logResult,
        message: `[${logLevel}] ${message}`,
        date: this.dateUtils.createDateOnlyFromDate(params.selectedDate)
      };

      // Add optional parameters
      if (params.currentUserId && params.currentUserId.trim() !== '' && params.currentUserId !== '0') {
        quickLogParams.managerId = params.currentUserId;
      }
      
      if (params.staffMember.employeeId && params.staffMember.employeeId.trim() !== '' && params.staffMember.employeeId !== '0') {
        quickLogParams.staffMemberId = params.staffMember.employeeId;
      }
      
      if (params.managingGroupId && params.managingGroupId.trim() !== '' && params.managingGroupId !== '0') {
        quickLogParams.staffGroupId = params.managingGroupId;
      }
      
      if (contractId && contractId.trim() !== '' && contractId !== '0') {
        quickLogParams.weeklyTimeTableId = contractId;
      }

      await this.scheduleLogsService.createScheduleLog(quickLogParams);

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating quick log:', error);
    }
  }

  /**
   * Получает информацию о модуле логирования
   */
  public getLoggingInfo(): {
    version: string;
    dateOnlySupport: boolean;
    capabilities: string[];
    servicesAvailable: {
      scheduleLogs: boolean;
      dateUtils: boolean;
    };
  } {
    return {
      version: '2.0.0-logging-module',
      dateOnlySupport: true,
      capabilities: [
        'Fixed Date-only format logging for ScheduleLogs',
        'Detailed operation logging with analysis',
        'Auto-fill operation logging',
        'Performance metrics logging',
        'Error analysis and reporting',
        'Batch operation summary logging',
        'User refusal logging',
        'Quick logging for simple operations',
        'Log statistics and reporting'
      ],
      servicesAvailable: {
        scheduleLogs: !!this.scheduleLogsService,
        dateUtils: !!this.dateUtils
      }
    };
  }

  /**
   * Тестирует функциональность логирования
   */
  public async testLogging(
    testParams: IFillParams
  ): Promise<{
    success: boolean;
    results: {
      quickLog: boolean;
      detailedLog: boolean;
      autoFillLog: boolean;
      userRefusalLog: boolean;
    };
    errors: string[];
  }> {
    const results = {
      quickLog: false,
      detailedLog: false,
      autoFillLog: false,
      userRefusalLog: false
    };
    const errors: string[] = [];

    try {
      // Test quick log
      await this.createQuickLog(testParams, 'Test quick log');
      results.quickLog = true;
    } catch (error) {
      errors.push(`Quick log test failed: ${error}`);
    }

    try {
      // Test detailed log
      await this.createDetailedOperationLog(
        testParams,
        'FILL',
        'INFO',
        'Test detailed log',
        {}
      );
      results.detailedLog = true;
    } catch (error) {
      errors.push(`Detailed log test failed: ${error}`);
    }

    try {
      // Test auto-fill log
      const testAutoFillResult: IAutoFillResult = {
        success: true,
        message: 'Test auto-fill log',
        messageType: 4,
        logResult: 3
      };
      await this.createAutoFillLog(testParams, testAutoFillResult, 'TEST_CONTRACT');
      results.autoFillLog = true;
    } catch (error) {
      errors.push(`Auto-fill log test failed: ${error}`);
    }

    try {
      // Test user refusal log
      await this.logUserRefusal(testParams, DialogType.EmptySchedule);
      results.userRefusalLog = true;
    } catch (error) {
      errors.push(`User refusal log test failed: ${error}`);
    }

    const success = Object.values(results).every(result => result);

    console.log('[CommonFillServiceLogging] Logging test results:', {
      success,
      results,
      errorCount: errors.length
    });

    return {
      success,
      results,
      errors
    };
  }
}