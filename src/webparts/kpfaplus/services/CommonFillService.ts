// src/webparts/kpfaplus/services/CommonFillService.ts - WITH UTC SUPPORT AND ASYNC HANDLING
// ИСПРАВЛЕНО: Добавлена поддержка UTC и передача RemoteSiteService в генерацию
// ДОБАВЛЕНО: Поддержка автозаполнения и специальная обработка для staff с autoschedule
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MessageBarType } from '@fluentui/react';
import { ContractsService } from './ContractsService';
import { IContract } from '../models/IContract';
import { IStaffMember } from '../models/types';
import { 
  CommonFillValidation, 
  IFillParams, 
  IExistingRecordsCheck, 
  DialogType, 
  IDialogConfig, 
  IScheduleLogicResult 
} from './CommonFillValidation';
import { CommonFillGeneration } from './CommonFillGeneration';
import { ScheduleLogsService, ICreateScheduleLogParams } from './ScheduleLogsService';
import { RemoteSiteService } from './RemoteSiteService';
import { IStaffRecord } from './StaffRecordsService';

// Export interfaces for compatibility
export { IFillParams, IExistingRecordsCheck, DialogType, IDialogConfig, IScheduleLogicResult };

// Результат операции заполнения с диалогом
export interface IFillResult {
  success: boolean;
  message: string;
  messageType: MessageBarType;
  createdRecordsCount?: number;
  deletedRecordsCount?: number;
  requiresDialog?: boolean;
  dialogConfig?: IDialogConfig;
  canProceed?: boolean;
  logResult?: number; // 1=Error, 2=Success, 3=Info/Refusal
}

// Параметры для выполнения заполнения после подтверждения
export interface IPerformFillParams extends IFillParams {
  contractId: string;
  replaceExisting: boolean;
}

// *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ АВТОЗАПОЛНЕНИЯ ***
export interface IAutoFillEligibilityCheck {
  eligible: boolean;
  reason?: string;
  hasProcessedRecords?: boolean;
  contractId?: string;
}

export interface IAutoFillResult {
  success: boolean;
  message: string;
  messageType: MessageBarType;
  createdRecordsCount?: number;
  skipped?: boolean;
  skipReason?: string;
  logResult: number; // 1=Error, 2=Success, 3=Warning/Skip
}

// *** ИНТЕРФЕЙС ДЛЯ АНАЛИЗА КОНТРАКТОВ ***
interface IContractsAnalysis {
  allContracts: IContract[];
  activeContracts: IContract[];
  analysisDetails: string[];
}

export class CommonFillService {
  private static instance: CommonFillService;
  private webPartContext: WebPartContext;
  
  // Core services
  private contractsService: ContractsService;
  private scheduleLogsService: ScheduleLogsService;
  private validationService: CommonFillValidation;
  private generationService: CommonFillGeneration;
  private remoteSiteService: RemoteSiteService; // *** ДОБАВЛЕН RemoteSiteService ***

  private constructor(context: WebPartContext) {
    this.webPartContext = context;
    this.contractsService = ContractsService.getInstance(context);
    this.scheduleLogsService = ScheduleLogsService.getInstance(context);
    this.validationService = new CommonFillValidation(context);
    this.generationService = new CommonFillGeneration(context);
    this.remoteSiteService = RemoteSiteService.getInstance(context); // *** ИНИЦИАЛИЗАЦИЯ RemoteSiteService ***
    
    console.log('[CommonFillService] Service initialized with UTC support, timezone handling and Auto Fill support');
  }

  public static getInstance(context: WebPartContext): CommonFillService {
    if (!CommonFillService.instance) {
      CommonFillService.instance = new CommonFillService(context);
    }
    return CommonFillService.instance;
  }

  // Delegation methods for compatibility (old API)
  public async checkExistingRecords(params: IFillParams): Promise<IExistingRecordsCheck> {
    return this.validationService.checkExistingRecords(params);
  }

  public async deleteExistingRecords(existingRecords: IStaffRecord[]): Promise<boolean> {
    return this.validationService.deleteExistingRecords(existingRecords);
  }

  public isContractActiveInMonth(contract: IContract, date: Date): boolean {
    return this.validationService.isContractActiveInMonth(contract, date);
  }

  /**
   * *** НОВЫЙ МЕТОД: Проверка возможности автозаполнения для staff member ***
   */
  public async checkAutoFillEligibility(params: IFillParams): Promise<IAutoFillEligibilityCheck> {
    console.log('[CommonFillService] Checking auto-fill eligibility with UTC support for:', params.staffMember.name);
    console.log('[CommonFillService] Auto-fill parameters:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: params.selectedDate.toISOString(), // *** UTC дата ***
      autoscheduleEnabled: params.staffMember.autoSchedule || false
    });
    
    try {
      // Валидация параметров
      const validation = this.validationService.validateFillParams(params);
      if (!validation.isValid) {
        return {
          eligible: false,
          reason: `Validation failed: ${validation.errors.join(', ')}`
        };
      }

      // *** ДЕТАЛЬНЫЙ АНАЛИЗ КОНТРАКТОВ ***
      const contractsAnalysis = await this.performContractsAnalysis(params);
      
      if (contractsAnalysis.activeContracts.length === 0) {
        return {
          eligible: false,
          reason: 'No active contracts found for this staff member in the selected period'
        };
      }

      const selectedContract = contractsAnalysis.activeContracts[0];
      console.log(`[CommonFillService] Using contract for auto-fill eligibility: ${selectedContract.id} - ${selectedContract.template || 'No name'}`);

      // *** ПРОВЕРЯЕМ ШАБЛОНЫ ***
      console.log('[CommonFillService] Checking weekly templates availability for auto-fill...');
      try {
        const weeklyTemplates = await this.generationService.loadWeeklyTemplates(
          selectedContract.id,
          params.dayOfStartWeek || 7,
          params.currentUserId || '0',
          params.managingGroupId || '0'
        );
        
        if (weeklyTemplates.length === 0) {
          return {
            eligible: false,
            reason: 'No weekly schedule templates found for the selected contract after filtering'
          };
        }
        
      } catch (templatesError) {
        return {
          eligible: false,
          reason: `Error checking weekly templates: ${templatesError instanceof Error ? templatesError.message : String(templatesError)}`
        };
      }

      // Применение Schedule tab логики для автозаполнения
      const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
        params, 
        selectedContract.id
      );

      console.log('[CommonFillService] Auto-fill schedule logic result:', {
        dialogType: scheduleLogicResult.dialogConfig.type,
        recordsCount: scheduleLogicResult.existingRecords.length,
        canProceed: scheduleLogicResult.canProceed
      });

      // *** АНАЛИЗИРУЕМ ВОЗМОЖНОСТЬ АВТОЗАПОЛНЕНИЯ ***
      switch (scheduleLogicResult.dialogConfig.type) {
        case DialogType.EmptySchedule:
          // Нет записей - можно автозаполнять
          return {
            eligible: true,
            contractId: selectedContract.id
          };

        case DialogType.UnprocessedRecordsReplace:
          // Есть необработанные записи - можно автозаполнять с заменой
          return {
            eligible: true,
            contractId: selectedContract.id,
            reason: 'Will replace existing unprocessed records'
          };

        case DialogType.ProcessedRecordsBlock:
          // Есть обработанные записи - НЕ МОЖЕМ автозаполнять
          return {
            eligible: false,
            reason: 'Has processed records (Checked>0 or ExportResult>0)',
            hasProcessedRecords: true,
            contractId: selectedContract.id
          };

        default:
          return {
            eligible: false,
            reason: `Unknown dialog type: ${scheduleLogicResult.dialogConfig.type}`
          };
      }

    } catch (error) {
      console.error('[CommonFillService] Error checking auto-fill eligibility:', error);
      return {
        eligible: false,
        reason: `Error checking eligibility: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Выполнение автозаполнения БЕЗ диалогов ***
   */
  public async performAutoFillOperation(params: IFillParams): Promise<IAutoFillResult> {
    console.log('[CommonFillService] Performing auto-fill operation with UTC support and timezone handling:', {
      staffMember: params.staffMember.name,
      period: params.selectedDate.toISOString(), // *** UTC дата ***
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId
    });

    const operationDetails: string[] = [];
    
    try {
      operationDetails.push('=== AUTO-FILL OPERATION WITH UTC SUPPORT ===');
      operationDetails.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
      operationDetails.push(`Period: ${params.selectedDate.toISOString()}`); // *** UTC дата ***
      operationDetails.push(`Manager: ${params.currentUserId}`);
      operationDetails.push(`Staff Group: ${params.managingGroupId}`);
      operationDetails.push(`Auto Schedule: ${params.staffMember.autoSchedule || false}`);
      operationDetails.push('');

      // *** ШАГ 1: ПРОВЕРКА ВОЗМОЖНОСТИ АВТОЗАПОЛНЕНИЯ ***
      operationDetails.push('STEP 1: Checking auto-fill eligibility...');
      
      const eligibilityCheck = await this.checkAutoFillEligibility(params);
      
      if (!eligibilityCheck.eligible) {
        const result: IAutoFillResult = {
          success: false,
          message: eligibilityCheck.reason || 'Auto-fill not eligible',
          messageType: eligibilityCheck.hasProcessedRecords ? MessageBarType.warning : MessageBarType.error,
          skipped: true,
          skipReason: eligibilityCheck.reason,
          logResult: eligibilityCheck.hasProcessedRecords ? 3 : 1 // Warning if processed records, Error otherwise
        };
        
        operationDetails.push(`✗ Not eligible: ${eligibilityCheck.reason}`);
        
        // Логируем предупреждение для processed records
        if (eligibilityCheck.hasProcessedRecords) {
          await this.createAutoFillLog(params, result, eligibilityCheck.contractId, operationDetails.join('\n'));
        }
        
        return result;
      }

      operationDetails.push(`✓ Eligible for auto-fill`);
      operationDetails.push(`✓ Contract ID: ${eligibilityCheck.contractId}`);

      // *** ШАГ 2: ОПРЕДЕЛЯЕМ ПАРАМЕТРЫ ЗАПОЛНЕНИЯ ***
      const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
        params, 
        eligibilityCheck.contractId!
      );

      const replaceExisting = scheduleLogicResult.dialogConfig.type === DialogType.UnprocessedRecordsReplace;
      operationDetails.push(`✓ Replace existing records: ${replaceExisting}`);

      // *** ШАГ 3: ВЫПОЛНЯЕМ АВТОЗАПОЛНЕНИЕ ***
      operationDetails.push('STEP 2: Executing auto-fill operation...');

      const performParams: IPerformFillParams = {
        ...params,
        contractId: eligibilityCheck.contractId!,
        replaceExisting
      };

      const fillResult = await this.performFillOperation(performParams);

      // *** ШАГ 4: ФОРМИРУЕМ РЕЗУЛЬТАТ ***
      const result: IAutoFillResult = {
        success: fillResult.success,
        message: fillResult.message,
        messageType: fillResult.messageType,
        createdRecordsCount: fillResult.createdRecordsCount,
        skipped: false,
        logResult: fillResult.success ? 2 : 1
      };

      operationDetails.push(`✓ Auto-fill completed: ${fillResult.success ? 'SUCCESS' : 'FAILED'}`);
      operationDetails.push(`✓ Records created: ${fillResult.createdRecordsCount || 0}`);

      // *** ШАГ 5: СОЗДАЕМ ЛОГ АВТОЗАПОЛНЕНИЯ ***
      await this.createAutoFillLog(params, result, eligibilityCheck.contractId, operationDetails.join('\n'));

      console.log('[CommonFillService] Auto-fill operation completed:', {
        success: result.success,
        created: result.createdRecordsCount,
        staffMember: params.staffMember.name,
        period: params.selectedDate.toISOString() // *** UTC дата ***
      });

      return result;

    } catch (error) {
      console.error('[CommonFillService] Error during auto-fill operation:', error);
      
      operationDetails.push('');
      operationDetails.push(`CRITICAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
      
      const result: IAutoFillResult = {
        success: false,
        message: `Error in auto-fill operation: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        skipped: false,
        logResult: 1
      };
      
      await this.createAutoFillLog(params, result, undefined, operationDetails.join('\n'));
      return result;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Создание лога для автозаполнения ***
   */
  private async createAutoFillLog(
    params: IFillParams, 
    result: IAutoFillResult, 
    contractId: string | undefined,
    operationDetails: string
  ): Promise<void> {
    try {
      let logTitle: string;
      let logMessage: string;

      if (result.skipped) {
        logTitle = `Auto-Fill Skipped - ${params.staffMember.name} (${params.selectedDate.toLocaleDateString()})`;
        logMessage = this.buildAutoFillLogMessage(params, result, contractId, operationDetails, 'SKIPPED');
      } else if (result.success) {
        logTitle = `Auto-Fill Success - ${params.staffMember.name} (${params.selectedDate.toLocaleDateString()})`;
        logMessage = this.buildAutoFillLogMessage(params, result, contractId, operationDetails, 'SUCCESS');
      } else {
        logTitle = `Auto-Fill Error - ${params.staffMember.name} (${params.selectedDate.toLocaleDateString()})`;
        logMessage = this.buildAutoFillLogMessage(params, result, contractId, operationDetails, 'ERROR');
      }
      
      const logParams: ICreateScheduleLogParams = {
        title: logTitle,
        result: result.logResult,
        message: logMessage,
        date: params.selectedDate
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
        console.log(`[CommonFillService] Auto-fill log created with UTC support, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillService] Error creating auto-fill log:', error);
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Формирует сообщение для лога автозаполнения ***
   */
  private buildAutoFillLogMessage(
    params: IFillParams, 
    result: IAutoFillResult, 
    contractId: string | undefined,
    operationDetails: string,
    status: 'SUCCESS' | 'ERROR' | 'SKIPPED'
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== AUTO-FILL OPERATION LOG WITH UTC SUPPORT ===`);
    lines.push(`Date: ${new Date().toISOString()}`); // *** UTC timestamp ***
    lines.push(`Status: ${status}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${params.selectedDate.toISOString()}`); // *** UTC дата ***
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push(`Auto Schedule: ${params.staffMember.autoSchedule || false}`);
    lines.push('');

    // *** ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О ПЕРИОДЕ И UTC ОБРАБОТКЕ ***
    const startOfMonth = new Date(Date.UTC(
      params.selectedDate.getUTCFullYear(), 
      params.selectedDate.getUTCMonth(), 
      1, 
      0, 0, 0, 0
    ));
    const endOfMonth = new Date(Date.UTC(
      params.selectedDate.getUTCFullYear(), 
      params.selectedDate.getUTCMonth() + 1, 
      0, 
      23, 59, 59, 999
    ));
    
    lines.push(`PERIOD AND UTC PROCESSING DETAILS:`);
    lines.push(`Selected Date (UTC): ${params.selectedDate.toISOString()}`);
    lines.push(`Month Range (UTC): ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
    lines.push(`Day of Start Week: ${params.dayOfStartWeek || 7}`);
    lines.push(`UTC Timezone Handling: ENABLED (like Schedule tab)`);
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

    // *** ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ВКЛЮЧАЯ UTC ОБРАБОТКУ ***
    if (operationDetails) {
      lines.push('DETAILED AUTO-FILL OPERATION ANALYSIS:');
      lines.push(operationDetails);
      lines.push('');
    }

    lines.push(`=== END AUTO-FILL LOG ===`);
    
    return lines.join('\n');
  }

  /**
   * Проверяет записи и возвращает конфигурацию диалога (НЕ ЗАПОЛНЯЕТ АВТОМАТИЧЕСКИ)
   */
  public async checkScheduleForFill(params: IFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Checking schedule for fill with UTC support and timezone handling:', params.staffMember.name);
    console.log('[CommonFillService] Parameters for filtering:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: params.selectedDate.toISOString() // *** Логируем в UTC ***
    });
    
    try {
      // Валидация параметров
      const validation = this.validationService.validateFillParams(params);
      if (!validation.isValid) {
        const result: IFillResult = {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          messageType: MessageBarType.error,
          requiresDialog: false,
          canProceed: false,
          logResult: 1
        };
        await this.createFillLog(params, result, undefined, `Validation errors: ${validation.errors.join(', ')}`);
        return result;
      }

      // *** ДЕТАЛЬНЫЙ АНАЛИЗ КОНТРАКТОВ ***
      const contractsAnalysis = await this.performContractsAnalysis(params);
      
      if (contractsAnalysis.activeContracts.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No active contracts found for this staff member in the selected period.',
          messageType: MessageBarType.warning,
          requiresDialog: false,
          canProceed: false,
          logResult: 1
        };
        const detailedLog = this.buildContractsAnalysisLog(contractsAnalysis);
        await this.createFillLog(params, result, undefined, detailedLog);
        return result;
      }

      const selectedContract = contractsAnalysis.activeContracts[0];
      console.log(`[CommonFillService] Using contract: ${selectedContract.id} - ${selectedContract.template || 'No name'}`);

      // *** ПЕРЕДАЕМ АНАЛИЗ КОНТРАКТОВ В GENERATION SERVICE ***
      this.generationService.analyzeContracts(
        contractsAnalysis.allContracts,
        contractsAnalysis.activeContracts,
        selectedContract,
        params.selectedDate
      );

      // *** ПРОВЕРЯЕМ ШАБЛОНЫ С НОВОЙ ФИЛЬТРАЦИЕЙ (ТОЛЬКО ДЛЯ АНАЛИЗА) ***
      console.log('[CommonFillService] Checking weekly templates availability with UTC support...');
      try {
        const weeklyTemplates = await this.generationService.loadWeeklyTemplates(
          selectedContract.id,
          params.dayOfStartWeek || 7,
          params.currentUserId || '0',
          params.managingGroupId || '0'
        );
        
        console.log(`[CommonFillService] Weekly templates check result: ${weeklyTemplates.length} templates found`);
        
        if (weeklyTemplates.length === 0) {
          const result: IFillResult = {
            success: false,
            message: 'No weekly schedule templates found for the selected contract after filtering.',
            messageType: MessageBarType.warning,
            requiresDialog: false,
            canProceed: false,
            logResult: 1
          };
          
          // Получаем детальный анализ шаблонов для лога
          const templatesAnalysis = this.generationService.getDetailedAnalysis();
          let templatesLog = 'No templates analysis available';
          
          if (templatesAnalysis.templates) {
            templatesLog = templatesAnalysis.templates.filteringDetails.join('\n');
          }
          
          const detailedLog = this.buildContractsAnalysisLog(contractsAnalysis) + '\n\n' + templatesLog;
          await this.createFillLog(params, result, selectedContract.id, detailedLog);
          return result;
        }
        
      } catch (templatesError) {
        console.error('[CommonFillService] Error checking weekly templates:', templatesError);
        const result: IFillResult = {
          success: false,
          message: `Error checking weekly templates: ${templatesError instanceof Error ? templatesError.message : String(templatesError)}`,
          messageType: MessageBarType.error,
          requiresDialog: false,
          canProceed: false,
          logResult: 1
        };
        
        const detailedLog = this.buildContractsAnalysisLog(contractsAnalysis) + `\n\nTEMPLATES ERROR: ${templatesError}`;
        await this.createFillLog(params, result, selectedContract.id, detailedLog);
        return result;
      }

      // Применение Schedule tab логики
      const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
        params, 
        selectedContract.id
      );

      console.log('[CommonFillService] Schedule logic result:', {
        dialogType: scheduleLogicResult.dialogConfig.type,
        recordsCount: scheduleLogicResult.existingRecords.length,
        canProceed: scheduleLogicResult.canProceed
      });

      // Возвращаем результат с диалогом и правильным logResult
      const result: IFillResult = {
        success: false,
        message: scheduleLogicResult.dialogConfig.message,
        messageType: scheduleLogicResult.dialogConfig.type === DialogType.ProcessedRecordsBlock 
          ? MessageBarType.error 
          : MessageBarType.info,
        requiresDialog: true,
        dialogConfig: scheduleLogicResult.dialogConfig,
        canProceed: scheduleLogicResult.canProceed,
        logResult: 3 // Все типы диалогов - это информационные сообщения
      };

      // *** ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ С АНАЛИЗОМ КОНТРАКТОВ И ШАБЛОНОВ ***
      let detailedLog = this.buildContractsAnalysisLog(contractsAnalysis);
      
      // Добавляем анализ шаблонов если доступен
      const templatesAnalysis = this.generationService.getDetailedAnalysis();
      if (templatesAnalysis.templates) {
        detailedLog += '\n\n' + templatesAnalysis.templates.filteringDetails.join('\n');
      }
      
      await this.createFillLog(params, {
        ...result,
        message: `Schedule check: ${scheduleLogicResult.dialogConfig.type} - ${scheduleLogicResult.dialogConfig.message}`
      }, selectedContract.id, detailedLog);

      return result;

    } catch (error) {
      console.error('[CommonFillService] Error checking schedule for fill:', error);
      
      const result: IFillResult = {
        success: false,
        message: `Error checking schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        requiresDialog: false,
        canProceed: false,
        logResult: 1
      };
      
      await this.createFillLog(params, result, undefined, `Error: ${error}`);
      return result;
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Детальный анализ контрактов ***
   */
  private async performContractsAnalysis(params: IFillParams): Promise<IContractsAnalysis> {
    console.log('[CommonFillService] Performing detailed contracts analysis...');

    const employeeId = params.staffMember.employeeId;
    const managerId = params.currentUserId || '';
    const groupId = params.managingGroupId || '';
    
    if (!employeeId || employeeId.trim() === '' || employeeId === '0') {
      return {
        allContracts: [],
        activeContracts: [],
        analysisDetails: ['ERROR: Invalid employee ID']
      };
    }
    
    const allContracts = await this.contractsService.getContractsForStaffMember(employeeId, managerId, groupId);
    const analysisDetails: string[] = [];
    
    analysisDetails.push(`CONTRACTS ANALYSIS FOR EMPLOYEE ${employeeId}:`);
    analysisDetails.push(`Manager ID: ${managerId}`);
    analysisDetails.push(`Group ID: ${groupId}`);
    analysisDetails.push(`Selected Date: ${params.selectedDate.toISOString()}`); // *** UTC дата ***
    analysisDetails.push(`Total contracts found: ${allContracts.length}`);
    analysisDetails.push('');

    if (allContracts.length === 0) {
      analysisDetails.push('ERROR: No contracts found for this employee');
      return { allContracts, activeContracts: [], analysisDetails };
    }

    // Анализируем каждый контракт
    analysisDetails.push('ALL CONTRACTS DETAILS:');
    allContracts.forEach((contract, index) => {
      const startDateStr = contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'No start date';
      const endDateStr = contract.finishDate ? new Date(contract.finishDate).toLocaleDateString() : 'Open-ended';
      const deletedStatus = contract.isDeleted ? 'DELETED' : 'Active';
      
      analysisDetails.push(`Contract ${index + 1}: ID=${contract.id}, Name="${contract.template || 'No name'}", Status=${deletedStatus}`);
      analysisDetails.push(`  Period: ${startDateStr} - ${endDateStr}`);
    });
    analysisDetails.push('');

    // Фильтруем активные контракты для выбранного периода
    const activeContracts = allContracts.filter((contract: IContract) => 
      !contract.isDeleted && this.validationService.isContractActiveInMonth(contract, params.selectedDate)
    );

    analysisDetails.push('ACTIVE CONTRACTS IN SELECTED PERIOD:');
    if (activeContracts.length === 0) {
      analysisDetails.push('ERROR: No active contracts found for the selected period');
      analysisDetails.push(`Selected period: ${params.selectedDate.toISOString()}`); // *** UTC дата ***
    } else {
      activeContracts.forEach((contract, index) => {
        const startDateStr = contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'No start date';
        const endDateStr = contract.finishDate ? new Date(contract.finishDate).toLocaleDateString() : 'Open-ended';
        
        analysisDetails.push(`Active Contract ${index + 1}: ID=${contract.id}, Name="${contract.template || 'No name'}"`);
        analysisDetails.push(`  Period: ${startDateStr} - ${endDateStr}`);
        
        if (index === 0) {
          analysisDetails.push(`  *** SELECTED FOR USE ***`);
        }
      });
    }
    analysisDetails.push('');

    return { allContracts, activeContracts, analysisDetails };
  }

  /**
   * *** НОВЫЙ МЕТОД: Формирует лог анализа контрактов ***
   */
  private buildContractsAnalysisLog(contractsAnalysis: IContractsAnalysis): string {
    return contractsAnalysis.analysisDetails.join('\n');
  }

  /**
   * *** ИСПРАВЛЕНО: Выполняет фактическое заполнение ПОСЛЕ подтверждения пользователя с UTC поддержкой ***
   */
  public async performFillOperation(performParams: IPerformFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Performing fill operation with UTC support and timezone handling:', {
      staffMember: performParams.staffMember.name,
      contractId: performParams.contractId,
      replaceExisting: performParams.replaceExisting,
      period: performParams.selectedDate.toISOString(), // *** UTC дата ***
      currentUserId: performParams.currentUserId,
      managingGroupId: performParams.managingGroupId
    });

    const operationDetails: string[] = [];
    
    try {
      operationDetails.push('=== DETAILED FILL OPERATION WITH UTC SUPPORT ===');
      operationDetails.push(`Staff: ${performParams.staffMember.name} (ID: ${performParams.staffMember.employeeId})`);
      operationDetails.push(`Contract: ${performParams.contractId}`);
      operationDetails.push(`Replace existing: ${performParams.replaceExisting}`);
      operationDetails.push(`Period: ${performParams.selectedDate.toISOString()}`); // *** UTC дата ***
      operationDetails.push(`Manager: ${performParams.currentUserId}`);
      operationDetails.push(`Staff Group: ${performParams.managingGroupId}`);
      operationDetails.push(`Day of Start Week: ${performParams.dayOfStartWeek || 7}`);
      operationDetails.push('');

      // Удаление существующих записей (если нужно)
      let deletedRecordsCount = 0;
      if (performParams.replaceExisting) {
        operationDetails.push('STEP 1: Deleting existing records...');
        
        const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
          performParams, 
          performParams.contractId
        );

        if (scheduleLogicResult.existingRecords.length > 0) {
          const deleteSuccess = await this.validationService.deleteExistingRecords(scheduleLogicResult.existingRecords);
          if (!deleteSuccess) {
            const result: IFillResult = {
              success: false,
              message: 'Failed to delete existing records.',
              messageType: MessageBarType.error,
              logResult: 1
            };
            operationDetails.push('ERROR: Failed to delete existing records');
            await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
            return result;
          }
          deletedRecordsCount = scheduleLogicResult.existingRecords.length;
          operationDetails.push(`✓ Successfully deleted ${deletedRecordsCount} existing records`);
        }
      }

      // *** ДЕТАЛЬНАЯ ЗАГРУЗКА ДАННЫХ С UTC ПОДДЕРЖКОЙ ***
      operationDetails.push('STEP 2: Loading data for generation with UTC support...');
      
      const [holidays, leaves, weeklyTemplates] = await Promise.all([
        this.generationService.loadHolidays(performParams.selectedDate),
        this.generationService.loadLeaves(performParams),
        this.generationService.loadWeeklyTemplates(
          performParams.contractId, 
          performParams.dayOfStartWeek || 7,
          performParams.currentUserId || '0',
          performParams.managingGroupId || '0'
        )
      ]);

      operationDetails.push(`✓ Loaded ${holidays.length} holidays, ${leaves.length} leaves, ${weeklyTemplates.length} templates`);

      if (weeklyTemplates.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No weekly schedule templates found for the selected contract after filtering.',
          messageType: MessageBarType.warning,
          logResult: 1
        };
        operationDetails.push('ERROR: No weekly templates found after client-side filtering');
        
        // Добавляем детальную информацию о фильтрации
        const templatesAnalysis = this.generationService.getDetailedAnalysis();
        if (templatesAnalysis.templates) {
          operationDetails.push('');
          operationDetails.push('DETAILED FILTERING RESULTS:');
          operationDetails.push(...templatesAnalysis.templates.filteringDetails);
        }
        
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // Загрузка контракта
      const contracts = await this.contractsService.getContractsForStaffMember(
        performParams.staffMember.employeeId || '',
        performParams.currentUserId || '',
        performParams.managingGroupId || ''
      );
      
      const selectedContract = contracts.find(c => c.id === performParams.contractId);
      if (!selectedContract) {
        const result: IFillResult = {
          success: false,
          message: 'Selected contract not found.',
          messageType: MessageBarType.error,
          logResult: 1
        };
        operationDetails.push('ERROR: Contract not found');
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // *** ГЕНЕРАЦИЯ ЗАПИСЕЙ С UTC ПОДДЕРЖКОЙ ***
      operationDetails.push('STEP 3: Generating schedule records with UTC support...');
      console.log('[CommonFillService] *** CALLING ASYNC generateScheduleRecords WITH UTC SUPPORT ***');
      
      const generatedRecords = await this.generationService.generateScheduleRecords(
        performParams,
        selectedContract,
        holidays,
        leaves,
        weeklyTemplates
      );

      operationDetails.push(`✓ Generated ${generatedRecords.length} schedule records with UTC timezone handling`);

      if (generatedRecords.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No schedule records generated.',
          messageType: MessageBarType.warning,
          logResult: 1
        };
        operationDetails.push('ERROR: No records generated');
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // *** ПОЛУЧАЕМ ДЕТАЛЬНЫЙ АНАЛИЗ ОТ GENERATION SERVICE ***
      const detailedAnalysis = this.generationService.getDetailedAnalysis();
      
      // *** ДОБАВЛЯЕМ АНАЛИЗ В ЛОГИ ***
      if (detailedAnalysis.contracts) {
        operationDetails.push('');
        operationDetails.push('DETAILED CONTRACTS ANALYSIS:');
        operationDetails.push(`Total contracts found: ${detailedAnalysis.contracts.totalFound}`);
        operationDetails.push(`Active contracts in period: ${detailedAnalysis.contracts.activeInPeriod.length}`);
        operationDetails.push(`Selected contract: ID=${detailedAnalysis.contracts.selectedContract.id}, Name="${detailedAnalysis.contracts.selectedContract.template || 'No name'}"`);
        operationDetails.push(`Selection reason: ${detailedAnalysis.contracts.selectionReason}`);
      }

      if (detailedAnalysis.templates) {
        operationDetails.push('');
        operationDetails.push('DETAILED TEMPLATES ANALYSIS WITH UTC SUPPORT:');
        operationDetails.push(`Contract: ID=${detailedAnalysis.templates.contractId}, Name="${detailedAnalysis.templates.contractName}"`);
        operationDetails.push(`Items from server: ${detailedAnalysis.templates.totalItemsFromServer}`);
        operationDetails.push(`After manager filter: ${detailedAnalysis.templates.afterManagerFilter}`);
        operationDetails.push(`After deleted filter: ${detailedAnalysis.templates.afterDeletedFilter}`);
        operationDetails.push(`Final templates: ${detailedAnalysis.templates.finalTemplatesCount}`);
        operationDetails.push(`Week start day: ${detailedAnalysis.templates.weekStartDayName} (dayOfStartWeek=${detailedAnalysis.templates.dayOfStartWeek})`);
        operationDetails.push(`Weeks in schedule: [${detailedAnalysis.templates.weeksInSchedule.join(', ')}]`);
        operationDetails.push(`Shifts available: [${detailedAnalysis.templates.shiftsAvailable.join(', ')}]`);
        operationDetails.push(`Number of week templates: ${detailedAnalysis.templates.numberOfWeekTemplates}`);
        operationDetails.push('');
        operationDetails.push('FILTERING PROCESS DETAILS:');
        operationDetails.push(...detailedAnalysis.templates.filteringDetails);
      }

      if (detailedAnalysis.generation) {
        operationDetails.push('');
        operationDetails.push('DETAILED GENERATION ANALYSIS WITH UTC:');
        operationDetails.push(`Total days in period: ${detailedAnalysis.generation.totalDaysInPeriod}`);
        operationDetails.push(`Days generated: ${detailedAnalysis.generation.daysGenerated}`);
        operationDetails.push(`Days skipped: ${detailedAnalysis.generation.daysSkipped}`);
        operationDetails.push(`Holidays detected: ${detailedAnalysis.generation.holidaysDetected}`);
        operationDetails.push(`Leaves detected: ${detailedAnalysis.generation.leavesDetected}`);
        
        // Добавляем статистику по неделям
        operationDetails.push('');
        operationDetails.push('WEEKLY GENERATION STATISTICS:');
        detailedAnalysis.generation.weeklyStats.forEach((stats, weekNumber) => {
          operationDetails.push(`Week ${weekNumber}: ${stats.generated}/${stats.total} generated, ${stats.skipped} skipped`);
        });

        // Добавляем первые несколько дней для примера
        if (detailedAnalysis.generation.dailyInfo.length > 0) {
          operationDetails.push('');
          operationDetails.push('DAILY GENERATION EXAMPLES:');
          detailedAnalysis.generation.dailyInfo.slice(0, 7).forEach(dayInfo => {
            if (dayInfo.templateFound) {
              operationDetails.push(`${dayInfo.date} (${dayInfo.dayName}): Week ${dayInfo.weekNumber}, ${dayInfo.workingHours}, Lunch: ${dayInfo.lunchMinutes}min`);
            } else {
              operationDetails.push(`${dayInfo.date} (${dayInfo.dayName}): Week ${dayInfo.weekNumber}, SKIPPED - ${dayInfo.skipReason}`);
            }
          });
        }
      }

      // *** СОХРАНЕНИЕ ЗАПИСЕЙ С UTC ПОДДЕРЖКОЙ ***
      operationDetails.push('');
      operationDetails.push('STEP 4: Saving generated records with UTC support...');
      console.log('[CommonFillService] *** SAVING RECORDS WITH UTC TIMEZONE HANDLING ***');
      
      const savedCount = await this.generationService.saveGeneratedRecords(generatedRecords, performParams);
      operationDetails.push(`✓ Successfully saved ${savedCount} of ${generatedRecords.length} records with UTC handling`);

      // Формирование результата
      const result: IFillResult = {
        success: savedCount > 0,
        message: savedCount === generatedRecords.length 
          ? `Successfully generated ${savedCount} schedule records for ${performParams.selectedDate.toLocaleDateString()}`
          : `Generated ${savedCount} of ${generatedRecords.length} records. Some failed to save.`,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount,
        deletedRecordsCount: deletedRecordsCount,
        requiresDialog: false,
        logResult: savedCount > 0 ? 2 : 1
      };

      console.log('[CommonFillService] Fill operation completed with UTC support:', {
        success: result.success,
        created: result.createdRecordsCount,
        deleted: result.deletedRecordsCount,
        period: performParams.selectedDate.toISOString() // *** UTC дата ***
      });

      await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
      return result;

    } catch (error) {
      console.error('[CommonFillService] Error during fill operation:', error);
      
      operationDetails.push('');
      operationDetails.push(`CRITICAL ERROR: ${error instanceof Error ? error.message : String(error)}`);
      
      const result: IFillResult = {
        success: false,
        message: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        logResult: 1
      };
      
      await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
      return result;
    }
  }

  /**
   * Логирует отказ пользователя
   */
  public async logUserRefusal(params: IFillParams, dialogType: DialogType, contractId?: string): Promise<void> {
    console.log('[CommonFillService] Logging user refusal with UTC support:', {
      staffMember: params.staffMember.name,
      dialogType,
      period: params.selectedDate.toISOString() // *** UTC дата ***
    });

    const result: IFillResult = {
      success: false,
      message: `User cancelled ${dialogType} dialog for ${params.staffMember.name}`,
      messageType: MessageBarType.info,
      requiresDialog: false,
      canProceed: false,
      logResult: 3
    };

    const refusalDetails = [
      'USER REFUSAL DETAILS:',
      `Dialog type: ${dialogType}`,
      `Staff member: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`,
      `Period: ${params.selectedDate.toISOString()}`, // *** UTC дата ***
      `Contract ID: ${contractId || 'Not specified'}`,
      `Manager ID: ${params.currentUserId || 'Not specified'}`,
      `Group ID: ${params.managingGroupId || 'Not specified'}`,
      `Action: User cancelled the operation`
    ];

    await this.createFillLog(params, result, contractId, refusalDetails.join('\n'));
  }

  /**
   * УСТАРЕВШАЯ ФУНКЦИЯ: Оставлена для совместимости
   */
  public async fillScheduleForStaff(params: IFillParams, replaceExisting: boolean = false): Promise<IFillResult> {
    console.log('[CommonFillService] DEPRECATED: fillScheduleForStaff called - use checkScheduleForFill + performFillOperation instead');
    
    const checkResult = await this.checkScheduleForFill(params);
    
    if (checkResult.requiresDialog) {
      return checkResult;
    }
    
    return checkResult;
  }

  /**
   * *** ОБНОВЛЕНО: Создает лог с детальной информацией включая UTC поддержку ***
   */
  private async createFillLog(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): Promise<void> {
    try {
      const logMessage = this.buildDetailedLogMessage(params, result, contractId, additionalDetails);
      
      const logParams: ICreateScheduleLogParams = {
        title: `Fill Operation - ${params.staffMember.name} (${params.selectedDate.toLocaleDateString()})`,
        result: result.logResult || (result.success ? 2 : 1),
        message: logMessage,
        date: params.selectedDate
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
        console.log(`[CommonFillService] Detailed log created with UTC support, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillService] Error creating detailed log:', error);
    }
  }

  /**
   * *** ОБНОВЛЕНО: Формирует детальное сообщение для лога с UTC информацией ***
   */
  private buildDetailedLogMessage(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== DETAILED FILL OPERATION LOG WITH UTC SUPPORT ===`);
    lines.push(`Date: ${new Date().toISOString()}`); // *** UTC timestamp ***
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${params.selectedDate.toISOString()}`); // *** UTC дата ***
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push('');

    // *** ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О ПЕРИОДЕ И UTC ОБРАБОТКЕ ***
    const startOfMonth = new Date(Date.UTC(
      params.selectedDate.getUTCFullYear(), 
      params.selectedDate.getUTCMonth(), 
      1, 
      0, 0, 0, 0
    ));
    const endOfMonth = new Date(Date.UTC(
      params.selectedDate.getUTCFullYear(), 
      params.selectedDate.getUTCMonth() + 1, 
      0, 
      23, 59, 59, 999
    ));
    
    lines.push(`PERIOD AND UTC PROCESSING DETAILS:`);
    lines.push(`Selected Date (UTC): ${params.selectedDate.toISOString()}`);
    lines.push(`Month Range (UTC): ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
    lines.push(`Day of Start Week: ${params.dayOfStartWeek || 7}`);
    lines.push(`Current User ID (for filtering): ${params.currentUserId || 'N/A'}`);
    lines.push(`Managing Group ID (for filtering): ${params.managingGroupId || 'N/A'}`);
    lines.push(`UTC Timezone Handling: ENABLED (like Schedule tab)`);
    lines.push('');

    // *** ПРАВИЛЬНЫЙ СТАТУС ОПЕРАЦИИ ***
    const logResult = result.logResult || (result.success ? 2 : 1);
    const operationStatus = logResult === 2 ? 'SUCCESS' : 
                           logResult === 3 ? 'INFO/REFUSAL' : 'FAILED';
    
    lines.push(`OPERATION RESULT: ${operationStatus}`);
    lines.push(`Message: ${result.message}`);
    
    if (result.requiresDialog) {
      lines.push(`Requires Dialog: ${result.dialogConfig?.type || 'Unknown'}`);
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

    // *** ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ВКЛЮЧАЯ UTC ОБРАБОТКУ ***
    if (additionalDetails) {
      lines.push('DETAILED OPERATION ANALYSIS WITH UTC SUPPORT:');
      lines.push(additionalDetails);
      lines.push('');
    }

    lines.push(`=== END DETAILED LOG ===`);
    
    return lines.join('\n');
  }

  // Service management methods
  public static clearInstance(): void {
    CommonFillService.instance = undefined as unknown as CommonFillService;
    console.log('[CommonFillService] Instance cleared');
  }

  public getServiceInfo(): {
    version: string;
    context: boolean;
    services: {
      contracts: boolean;
      scheduleLogs: boolean;
      validation: boolean;
      generation: boolean;
      remoteSite: boolean;
    };
    utcSupport: boolean;
    timezoneHandling: boolean;
    autoFillSupport: boolean; // *** НОВОЕ СВОЙСТВО ***
  } {
    return {
      version: '6.0.0', // *** ВЕРСИЯ С AUTO-FILL ПОДДЕРЖКОЙ ***
      context: !!this.webPartContext,
      services: {
        contracts: !!this.contractsService,
        scheduleLogs: !!this.scheduleLogsService,
        validation: !!this.validationService,
        generation: !!this.generationService,
        remoteSite: !!this.remoteSiteService // *** НОВЫЙ СЕРВИС ***
      },
      utcSupport: true, // *** НОВАЯ ВОЗМОЖНОСТЬ ***
      timezoneHandling: true, // *** НОВАЯ ВОЗМОЖНОСТЬ ***
      autoFillSupport: true // *** НОВАЯ ВОЗМОЖНОСТЬ ***
    };
  }

  public async testServices(): Promise<{
    contracts: boolean;
    scheduleLogs: boolean;
    validation: boolean;
    generation: boolean;
    remoteSite: boolean;
    utcSupport: boolean;
    timezoneHandling: boolean;
    autoFillSupport: boolean; // *** НОВЫЙ ТЕСТ ***
    errors: string[];
  }> {
    const results = {
      contracts: false,
      scheduleLogs: false,
      validation: false,
      generation: false,
      remoteSite: false,
      utcSupport: false,
      timezoneHandling: false,
      autoFillSupport: false, // *** НОВЫЙ ТЕСТ ***
      errors: [] as string[]
    };

    try {
      await this.contractsService.getContractsForStaffMember('1', '1', '1');
      results.contracts = true;
    } catch (error) {
      results.errors.push(`Contracts: ${error}`);
    }

    try {
      await this.scheduleLogsService.getScheduleLogs({ top: 1 });
      results.scheduleLogs = true;
    } catch (error) {
      results.errors.push(`ScheduleLogs: ${error}`);
    }

    try {
      const testParams: IFillParams = {
        selectedDate: new Date(),
        staffMember: { id: '1', name: 'Test', employeeId: '1' } as IStaffMember,
        currentUserId: '1',
        managingGroupId: '1',
        context: this.webPartContext
      };
      const validation = this.validationService.validateFillParams(testParams);
      results.validation = validation.isValid || validation.errors.length > 0;
    } catch (error) {
      results.errors.push(`Validation: ${error}`);
    }

    try {
      await this.generationService.loadHolidays(new Date());
      results.generation = true;
    } catch (error) {
      results.errors.push(`Generation: ${error}`);
    }

    // *** ТЕСТИРУЕМ RemoteSiteService ***
    try {
      const isAuthorized = this.remoteSiteService.isAuthorized();
      results.remoteSite = true; // Сервис инициализирован
      console.log(`[CommonFillService] RemoteSiteService authorized: ${isAuthorized}`);
    } catch (error) {
      results.errors.push(`RemoteSite: ${error}`);
    }

    // *** ТЕСТИРУЕМ UTC ПОДДЕРЖКУ ***
    try {
      const utcDate = new Date(Date.UTC(2025, 0, 1, 9, 0, 0, 0));
      const isoString = utcDate.toISOString();
      results.utcSupport = isoString.includes('2025-01-01T09:00:00.000Z');
      console.log(`[CommonFillService] UTC support test: ${results.utcSupport}`);
    } catch (error) {
      results.errors.push(`UTC Support: ${error}`);
    }

    // *** ТЕСТИРУЕМ TIMEZONE HANDLING ***
    try {
      // Проверяем что у нас есть RemoteSiteService для timezone adjustment
      results.timezoneHandling = !!this.remoteSiteService;
      console.log(`[CommonFillService] Timezone handling available: ${results.timezoneHandling}`);
    } catch (error) {
      results.errors.push(`Timezone Handling: ${error}`);
    }

    // *** ТЕСТИРУЕМ AUTO-FILL ПОДДЕРЖКУ ***
    try {
      // Проверяем доступность методов автозаполнения
      const hasAutoFillMethods = typeof this.checkAutoFillEligibility === 'function' && 
                                 typeof this.performAutoFillOperation === 'function';
      
      results.autoFillSupport = hasAutoFillMethods;
      console.log(`[CommonFillService] Auto-fill support available: ${results.autoFillSupport}`);
    } catch (error) {
      results.errors.push(`Auto-Fill Support: ${error}`);
    }

    console.log('[CommonFillService] Detailed service test results with UTC and Auto-Fill support:', results);
    return results;
  }
}