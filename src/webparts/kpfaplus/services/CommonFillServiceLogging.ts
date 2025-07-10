// src/webparts/kpfaplus/services/CommonFillServiceLogging.ts - Logging Operations (Part 4/4)
// ВОССТАНОВЛЕНО: Добавлена техническая информация о периоде и Date-only обработке
// ОСНОВНОЙ ФУНКЦИОНАЛ: Логирование операций заполнения с правильной поддержкой Date-only полей

import { ScheduleLogsService, ICreateScheduleLogParams } from './ScheduleLogsService';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { IFillParams, DialogType } from './CommonFillValidation';
import { IFillResult } from './CommonFillService';

export class CommonFillServiceLogging {
  private scheduleLogsService: ScheduleLogsService;
  private dateUtils: CommonFillDateUtils;

  constructor(
    scheduleLogsService: ScheduleLogsService,
    dateUtils: CommonFillDateUtils
  ) {
    this.scheduleLogsService = scheduleLogsService;
    this.dateUtils = dateUtils;
    console.log('[CommonFillServiceLogging] Logging module initialized with Date-only format support and restored technical details');
  }

  // *** ОСНОВНЫЕ МЕТОДЫ ЛОГИРОВАНИЯ ***

  /**
   * Создает основной лог операции заполнения с правильным Date-only форматом
   * ОБНОВЛЕНО: Добавлена поддержка детального логирования праздников и отпусков
   */
  public async createFillLog(
    params: IFillParams, 
    result: IFillResult, 
    contractId?: string,
    additionalDetails?: string,
    detailedLoggingInfo?: {
      deletedRecordsCount: number;
      holidaysDetails: Array<{ date: string; title: string }>;
      leavesDetails: Array<{ startDate: string; endDate: string; title: string; typeOfLeave: string }>;
    }
  ): Promise<void> {
    try {
      const logMessage = this.buildDetailedLogMessage(params, result, contractId, additionalDetails, detailedLoggingInfo);
      const periodStr = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);
      
      // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для создания Date-only Date объекта ***
      const dateOnlyForScheduleLogs = this.dateUtils.createDateOnlyFromDate(params.selectedDate);
      
      console.log('[CommonFillServiceLogging] *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: SCHEDULELOGS DATE-ONLY ПОЛЕ ***');
      console.log('[CommonFillServiceLogging] Creating ScheduleLog with Date-only field:', this.dateUtils.formatDateOnlyForDisplay(dateOnlyForScheduleLogs));
      
      const logParams: ICreateScheduleLogParams = {
        title: `Fill Operation - ${params.staffMember.name} (${periodStr})`,
        result: result.logResult || (result.success ? 2 : 1),
        message: logMessage,
        date: dateOnlyForScheduleLogs  // ✅ Date-only Date объект для ScheduleLogs.Date
      };

      // Добавляем опциональные параметры только если они валидны
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
        console.log(`[CommonFillServiceLogging] ✅ ScheduleLog created with Date-only format, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillServiceLogging] Error creating fill log:', error);
    }
  }

  /**
   * Логирует отказ пользователя с правильным Date-only форматом
   */
  public async logUserRefusal(params: IFillParams, dialogType: DialogType, contractId?: string): Promise<void> {
    console.log('[CommonFillServiceLogging] Logging user refusal with Date-only format:', {
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
      logResult: 3 // Warning/Info
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
   * Создает быстрый лог для простых операций
   */
  public async createQuickLog(
    params: IFillParams,
    message: string,
    contractId?: string,
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

      // Добавляем опциональные параметры
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

  // *** ПРИВАТНЫЕ HELPER МЕТОДЫ ***

  /**
   * *** ВОССТАНОВЛЕНО: Формирует детальное сообщение для лога с ПОЛНОЙ Date-only информацией ***
   * ОБНОВЛЕНО: Добавлено детальное логирование праздников и отпусков
   * НОВОЕ: Добавлены секции анализа контрактов и шаблонов
   */
  private buildDetailedLogMessage(
    params: IFillParams, 
    result: IFillResult, 
    contractId?: string,
    additionalDetails?: string,
    detailedLoggingInfo?: {
      deletedRecordsCount: number;
      holidaysDetails: Array<{ date: string; title: string }>;
      leavesDetails: Array<{ startDate: string; endDate: string; title: string; typeOfLeave: string }>;
    }
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== DETAILED FILL OPERATION LOG WITH FIXED DATE-ONLY LOGGING ===`);
    lines.push(`Date: ${new Date().toISOString()}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push('');

    // *** ВОССТАНОВЛЕНО: ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О ПЕРИОДЕ С DATE-ONLY ФОРМАТОМ ***
    const monthPeriod = this.getMonthPeriodForDisplay(params.selectedDate);
    
    lines.push(`PERIOD AND DATE-ONLY PROCESSING DETAILS:`);
    lines.push(`Selected Date (Date-only): ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`);
    lines.push(`Month Range (Date-only): ${monthPeriod.start} - ${monthPeriod.end}`);
    lines.push(`Day of Start Week: ${params.dayOfStartWeek || 7}`);
    lines.push(`Current User ID (for filtering): ${params.currentUserId || 'N/A'}`);
    lines.push(`Managing Group ID (for filtering): ${params.managingGroupId || 'N/A'}`);
    lines.push(`Date-only Format Processing: ENABLED (correct UI behavior)`);
    lines.push('');

    // *** НОВОЕ: ПАРСИНГ И ОТОБРАЖЕНИЕ АНАЛИЗА КОНТРАКТОВ И ШАБЛОНОВ ***
    if (additionalDetails) {
      const analysisData = this.parseAnalysisReport(additionalDetails);
      
      // DETAILED CONTRACTS ANALYSIS
      if (analysisData.contractsAnalysis) {
        lines.push('DETAILED CONTRACTS ANALYSIS:');
        lines.push(`Total contracts found: ${analysisData.contractsAnalysis.totalFound}`);
        lines.push(`Active contracts in period: ${analysisData.contractsAnalysis.activeCount}`);
        lines.push(`Selected contract: ${analysisData.contractsAnalysis.selectedContract}`);
        lines.push(`Selection reason: ${analysisData.contractsAnalysis.selectionReason}`);
        lines.push('');
      }
      
      // DETAILED TEMPLATES ANALYSIS
      if (analysisData.templatesAnalysis) {
        lines.push('DETAILED TEMPLATES ANALYSIS WITH FIXED DATE-ONLY LOGGING:');
        lines.push(`Contract: ${analysisData.templatesAnalysis.contractInfo}`);
        lines.push(`Items from server: ${analysisData.templatesAnalysis.itemsFromServer}`);
        lines.push(`After manager filter: ${analysisData.templatesAnalysis.afterManagerFilter}`);
        lines.push(`After deleted filter: ${analysisData.templatesAnalysis.afterDeletedFilter}`);
        lines.push(`Final templates: ${analysisData.templatesAnalysis.finalTemplates}`);
        lines.push(`Week start day: ${analysisData.templatesAnalysis.weekStartDay}`);
        lines.push(`Weeks in schedule: ${analysisData.templatesAnalysis.weeksInSchedule}`);
        lines.push(`Shifts available: ${analysisData.templatesAnalysis.shiftsAvailable}`);
        lines.push(`Number of week templates: ${analysisData.templatesAnalysis.numberOfWeekTemplates}`);
        lines.push('');
      }
      
      // FILTERING PROCESS DETAILS
      if (analysisData.filteringDetails && analysisData.filteringDetails.length > 0) {
        lines.push('FILTERING PROCESS DETAILS:');
        analysisData.filteringDetails.forEach(detail => {
          lines.push(detail);
        });
        lines.push('');
      }
    }

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
    
    // *** НОВОЕ: Детальная информация об удаленных записях из detailedLoggingInfo ***
    if (detailedLoggingInfo && detailedLoggingInfo.deletedRecordsCount > 0) {
      lines.push(`Records Deleted (Detailed): ${detailedLoggingInfo.deletedRecordsCount}`);
    }
    
    if (contractId) {
      lines.push(`Contract ID: ${contractId}`);
    }
    
    lines.push('');

    // *** НОВОЕ: ДЕТАЛЬНАЯ ИНФОРМАЦИЯ О ПРАЗДНИКАХ ***
    if (detailedLoggingInfo && detailedLoggingInfo.holidaysDetails.length > 0) {
      lines.push('=== HOLIDAYS DETAILS ===');
      detailedLoggingInfo.holidaysDetails.forEach(holiday => {
        lines.push(`${holiday.date}: ${holiday.title}`);
      });
      lines.push('');
    } else if (detailedLoggingInfo) {
      lines.push('=== HOLIDAYS DETAILS ===');
      lines.push('No holidays found in period');
      lines.push('');
    }

    // *** НОВОЕ: ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ОБ ОТПУСКАХ ***
    if (detailedLoggingInfo && detailedLoggingInfo.leavesDetails.length > 0) {
      lines.push('=== LEAVES DETAILS ===');
      detailedLoggingInfo.leavesDetails.forEach(leave => {
        lines.push(`${leave.startDate} - ${leave.endDate}: ${leave.title} (Type: ${leave.typeOfLeave})`);
      });
      lines.push('');
    } else if (detailedLoggingInfo) {
      lines.push('=== LEAVES DETAILS ===');
      lines.push('No leaves found in period');
      lines.push('');
    }

    // *** НОВОЕ: СВОДКА ПО ДЕТАЛЬНОМУ ЛОГИРОВАНИЮ ***
    if (detailedLoggingInfo) {
      lines.push('=== DETAILED LOGGING SUMMARY ===');
      lines.push(`Deleted Records: ${detailedLoggingInfo.deletedRecordsCount}`);
      lines.push(`Holidays Found: ${detailedLoggingInfo.holidaysDetails.length}`);
      lines.push(`Leaves Found: ${detailedLoggingInfo.leavesDetails.length}`);
      lines.push('');
    }

    lines.push(`=== END DETAILED LOG ===`);
    
    return lines.join('\n');
  }

  /**
   * *** НОВОЕ: Парсит отчет анализа и извлекает структурированную информацию ***
   */
  private parseAnalysisReport(analysisReport: string): {
    contractsAnalysis?: {
      totalFound: number;
      activeCount: number;
      selectedContract: string;
      selectionReason: string;
    };
    templatesAnalysis?: {
      contractInfo: string;
      itemsFromServer: number;
      afterManagerFilter: number;
      afterDeletedFilter: number;
      finalTemplates: number;
      weekStartDay: string;
      weeksInSchedule: string;
      shiftsAvailable: string;
      numberOfWeekTemplates: number;
    };
    filteringDetails?: string[];
  } {
    const result: ReturnType<typeof this.parseAnalysisReport> = {};
    
    try {
      // Парсинг анализа контрактов
      const contractsMatch = analysisReport.match(/--- CONTRACTS ANALYSIS ---([\s\S]*?)(?=---|$)/);
      if (contractsMatch) {
        const contractsSection = contractsMatch[1];
        
        const totalFoundMatch = contractsSection.match(/Total contracts found: (\d+)/);
        const activeMatch = contractsSection.match(/Active in period: (\d+)/);
        const selectedMatch = contractsSection.match(/Selected contract: (.*?)$/m);
        const reasonMatch = contractsSection.match(/Selection reason: (.*?)$/m);
        
        if (totalFoundMatch && activeMatch && selectedMatch && reasonMatch) {
          result.contractsAnalysis = {
            totalFound: parseInt(totalFoundMatch[1], 10),
            activeCount: parseInt(activeMatch[1], 10),
            selectedContract: selectedMatch[1].trim(),
            selectionReason: reasonMatch[1].trim()
          };
        }
      }
      
      // Парсинг анализа шаблонов
      const templatesMatch = analysisReport.match(/--- TEMPLATES ANALYSIS ---([\s\S]*?)(?=---|$)/);
      if (templatesMatch) {
        const templatesSection = templatesMatch[1];
        
        const contractMatch = templatesSection.match(/Contract: (.*?)$/m);
        const serverResponseMatch = templatesSection.match(/Server response: (\d+) items/);
        const managerFilterMatch = templatesSection.match(/After manager filter: (\d+) items/);
        const deletedFilterMatch = templatesSection.match(/After deleted filter: (\d+) items/);
        const finalTemplatesMatch = templatesSection.match(/Final templates: (\d+)/);
        const weekStartMatch = templatesSection.match(/Week start day: (.*?)$/m);
        const weeksMatch = templatesSection.match(/Weeks in schedule: (\[.*?\])/);
        const shiftsMatch = templatesSection.match(/Shifts available: (\[.*?\])/);
        const weekTemplatesMatch = templatesSection.match(/Week chaining: .*?(\d+) week template/);
        
        if (contractMatch && serverResponseMatch && finalTemplatesMatch) {
          result.templatesAnalysis = {
            contractInfo: contractMatch[1].trim(),
            itemsFromServer: parseInt(serverResponseMatch[1], 10),
            afterManagerFilter: managerFilterMatch ? parseInt(managerFilterMatch[1], 10) : 0,
            afterDeletedFilter: deletedFilterMatch ? parseInt(deletedFilterMatch[1], 10) : 0,
            finalTemplates: parseInt(finalTemplatesMatch[1], 10),
            weekStartDay: weekStartMatch ? weekStartMatch[1].trim() : 'Unknown',
            weeksInSchedule: weeksMatch ? weeksMatch[1] : '[]',
            shiftsAvailable: shiftsMatch ? shiftsMatch[1] : '[]',
            numberOfWeekTemplates: weekTemplatesMatch ? parseInt(weekTemplatesMatch[1], 10) : 1
          };
        }
      }
      
      // Парсинг деталей фильтрации
      const filteringMatch = analysisReport.match(/=== WEEKLY TEMPLATES LOADING WITH SCHEDULE TAB APPROACH ===([\s\S]*?)(?=---|$)/);
      if (filteringMatch) {
        const filteringSection = filteringMatch[1];
        const filteringLines = filteringSection.split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .slice(0, 20); // Берем первые 20 строк для ограничения размера
        
        if (filteringLines.length > 0) {
          result.filteringDetails = [
            '=== WEEKLY TEMPLATES LOADING WITH SCHEDULE TAB APPROACH ===',
            ...filteringLines
          ];
        }
      }
      
    } catch (error) {
      console.warn('[CommonFillServiceLogging] Error parsing analysis report:', error);
    }
    
    return result;
  }

  /**
   * Получает период месяца для отображения в логах используя dateUtils
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

  // *** ИНФОРМАЦИОННЫЕ МЕТОДЫ ***

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
      version: '2.1.0-restored-technical-details',
      dateOnlySupport: true,
      capabilities: [
        'Date-only format logging for ScheduleLogs',
        'Fill operation logging with detailed analysis',
        'User refusal logging',
        'Quick logging for simple operations',
        'Restored technical period information',
        'Detailed holidays and leaves logging',
        'Deleted records tracking',
        'Month range calculation with Date-only format'
      ],
      servicesAvailable: {
        scheduleLogs: !!this.scheduleLogsService,
        dateUtils: !!this.dateUtils
      }
    };
  }
}