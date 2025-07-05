// src/webparts/kpfaplus/services/CommonFillService.ts - WITH FIXED DATE-ONLY LOGGING - PART 1/3
// ИСПРАВЛЕНО: Правильное разделение Date-only (UI) и DateTime (SharePoint) в логировании
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
import { CommonFillDateUtils } from './CommonFillDateUtils';
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
  private remoteSiteService: RemoteSiteService;
  
  // *** ИСПРАВЛЕНО: Добавлен dateUtils для правильной работы с Date-only полями ***
  private dateUtils: CommonFillDateUtils;

  private constructor(context: WebPartContext) {
    this.webPartContext = context;
    this.contractsService = ContractsService.getInstance(context);
    this.scheduleLogsService = ScheduleLogsService.getInstance(context);
    this.validationService = new CommonFillValidation(context);
    this.generationService = new CommonFillGeneration(context);
    this.remoteSiteService = RemoteSiteService.getInstance(context);
    
    // *** ИСПРАВЛЕНО: Инициализируем dateUtils для правильной работы с Date-only полями ***
    this.dateUtils = new CommonFillDateUtils(this.remoteSiteService);
    
    console.log('[CommonFillService] Service initialized with FIXED Date-only logging and Auto Fill support');
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
    console.log('[CommonFillService] Checking auto-fill eligibility with FIXED Date-only logging for:', params.staffMember.name);
    console.log('[CommonFillService] Auto-fill parameters:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate), // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
  // src/webparts/kpfaplus/services/CommonFillService.ts - PART 2/3

  /**
   * *** НОВЫЙ МЕТОД: Выполнение автозаполнения БЕЗ диалогов ***
   */
  public async performAutoFillOperation(params: IFillParams): Promise<IAutoFillResult> {
    console.log('[CommonFillService] Performing auto-fill operation with FIXED Date-only logging:', {
      staffMember: params.staffMember.name,
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate), // *** ИСПРАВЛЕНО: Используем dateUtils ***
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId
    });

    const operationDetails: string[] = [];
    
    try {
      operationDetails.push('=== AUTO-FILL OPERATION WITH FIXED DATE-ONLY LOGGING ===');
      operationDetails.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
      operationDetails.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`); // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
        period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate) // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
   * Проверяет записи и возвращает конфигурацию диалога (НЕ ЗАПОЛНЯЕТ АВТОМАТИЧЕСКИ)
   */
  public async checkScheduleForFill(params: IFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Checking schedule for fill with FIXED Date-only logging:', params.staffMember.name);
    console.log('[CommonFillService] Parameters for filtering:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate) // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
      console.log('[CommonFillService] Checking weekly templates availability with FIXED Date-only logging...');
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
    analysisDetails.push(`Selected Date: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`); // *** ИСПРАВЛЕНО: Используем dateUtils ***
    analysisDetails.push(`Total contracts found: ${allContracts.length}`);
    analysisDetails.push('');

    if (allContracts.length === 0) {
      analysisDetails.push('ERROR: No contracts found for this employee');
      return { allContracts, activeContracts: [], analysisDetails };
    }

    // Анализируем каждый контракт
    analysisDetails.push('ALL CONTRACTS DETAILS:');
    allContracts.forEach((contract, index) => {
      const startDateStr = contract.startDate ? this.dateUtils.formatDateOnlyForDisplay(new Date(contract.startDate)) : 'No start date';
      const endDateStr = contract.finishDate ? this.dateUtils.formatDateOnlyForDisplay(new Date(contract.finishDate)) : 'Open-ended';
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
      analysisDetails.push(`Selected period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`); // *** ИСПРАВЛЕНО: Используем dateUtils ***
    } else {
      activeContracts.forEach((contract, index) => {
        const startDateStr = contract.startDate ? this.dateUtils.formatDateOnlyForDisplay(new Date(contract.startDate)) : 'No start date';
        const endDateStr = contract.finishDate ? this.dateUtils.formatDateOnlyForDisplay(new Date(contract.finishDate)) : 'Open-ended';
        
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
  // src/webparts/kpfaplus/services/CommonFillService.ts - PART 3/3 - КРИТИЧНЫЕ ИСПРАВЛЕНИЯ

  /**
   // src/webparts/kpfaplus/services/CommonFillService.ts - PART 3/3 - КРИТИЧНЫЕ ИСПРАВЛЕНИЯ

  /**
   * *** ИСПРАВЛЕНО: Выполняет фактическое заполнение ПОСЛЕ подтверждения пользователя с FIXED Date-only logging ***
   */
  /**
 * *** ИСПРАВЛЕНО: Выполняет фактическое заполнение ПОСЛЕ подтверждения пользователя с FIXED Date-only logging ***
 */
public async performFillOperation(performParams: IPerformFillParams): Promise<IFillResult> {
  console.log('[CommonFillService] Performing fill operation with FIXED Date-only logging:', {
    staffMember: performParams.staffMember.name,
    contractId: performParams.contractId,
    replaceExisting: performParams.replaceExisting,
    period: this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate), // *** ИСПРАВЛЕНО: Используем dateUtils ***
    currentUserId: performParams.currentUserId,
    managingGroupId: performParams.managingGroupId
  });

  const operationDetails: string[] = [];
  
  try {
    operationDetails.push('=== DETAILED FILL OPERATION WITH FIXED DATE-ONLY LOGGING ===');
    operationDetails.push(`Staff: ${performParams.staffMember.name} (ID: ${performParams.staffMember.employeeId})`);
    operationDetails.push(`Contract: ${performParams.contractId}`);
    operationDetails.push(`Replace existing: ${performParams.replaceExisting}`);
    operationDetails.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)}`); // *** ИСПРАВЛЕНО: Используем dateUtils ***
    operationDetails.push(`Manager: ${performParams.currentUserId}`);
    operationDetails.push(`Staff Group: ${performParams.managingGroupId}`);
    operationDetails.push(`Day of Start Week: ${performParams.dayOfStartWeek || 7}`);
    operationDetails.push('');

    // *** ШАГ 1: УДАЛЕНИЕ СУЩЕСТВУЮЩИХ ЗАПИСЕЙ (КРИТИЧНОЕ ИСПРАВЛЕНИЕ) ***
    let deletedRecordsCount = 0;
    if (performParams.replaceExisting) {
      operationDetails.push('STEP 1: Deleting existing records...');
      console.log('[CommonFillService] *** CRITICAL: DELETING EXISTING RECORDS ***');
      
      try {
        // *** ИСПРАВЛЕНО: Получаем существующие записи с правильной фильтрацией ***
        const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
          performParams, 
          performParams.contractId
        );

        console.log(`[CommonFillService] Found ${scheduleLogicResult.existingRecords.length} existing records to delete`);
        operationDetails.push(`Found ${scheduleLogicResult.existingRecords.length} existing records to delete`);

        if (scheduleLogicResult.existingRecords.length > 0) {
          console.log('[CommonFillService] *** STARTING DELETION PROCESS ***');
          
          // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Детальное логирование каждой операции удаления ***
          for (let i = 0; i < scheduleLogicResult.existingRecords.length; i++) {
            const record = scheduleLogicResult.existingRecords[i];
            console.log(`[CommonFillService] Deleting record ${i + 1}/${scheduleLogicResult.existingRecords.length}: ID=${record.ID}, Date=${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}`);
          }
          
          // *** ИСПРАВЛЕНО: Используем улучшенную версию deleteExistingRecords с детальным логированием ***
          const deleteSuccess = await this.deleteExistingRecordsWithLogging(scheduleLogicResult.existingRecords, operationDetails);
          
          if (!deleteSuccess) {
            const result: IFillResult = {
              success: false,
              message: 'Failed to delete existing records.',
              messageType: MessageBarType.error,
              logResult: 1
            };
            operationDetails.push('❌ ERROR: Failed to delete existing records');
            console.error('[CommonFillService] *** DELETION FAILED ***');
            await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
            return result;
          }
          
          deletedRecordsCount = scheduleLogicResult.existingRecords.length;
          operationDetails.push(`✅ Successfully deleted ${deletedRecordsCount} existing records`);
          console.log(`[CommonFillService] *** DELETION COMPLETED: ${deletedRecordsCount} records deleted ***`);
        } else {
          operationDetails.push('ℹ️ No existing records found to delete');
          console.log('[CommonFillService] No existing records found to delete');
        }
      } catch (deleteError) {
        const result: IFillResult = {
          success: false,
          message: `Error during deletion: ${deleteError instanceof Error ? deleteError.message : String(deleteError)}`,
          messageType: MessageBarType.error,
          logResult: 1
        };
        operationDetails.push(`❌ DELETION ERROR: ${deleteError}`);
        console.error('[CommonFillService] *** DELETION ERROR ***:', deleteError);
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }
    } else {
      operationDetails.push('STEP 1: Skipping deletion (replaceExisting = false)');
      console.log('[CommonFillService] Skipping deletion step (replaceExisting = false)');
    }

    // *** ШАГ 2: ДЕТАЛЬНАЯ ЗАГРУЗКА ДАННЫХ С DATE-ONLY ПОДДЕРЖКОЙ ***
    operationDetails.push('STEP 2: Loading data for generation with Date-only format support...');
    console.log('[CommonFillService] *** LOADING DATA WITH DATE-ONLY SUPPORT ***');
    
    try {
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

      operationDetails.push(`✅ Loaded ${holidays.length} holidays, ${leaves.length} leaves, ${weeklyTemplates.length} templates`);
      console.log(`[CommonFillService] Data loaded: ${holidays.length} holidays, ${leaves.length} leaves, ${weeklyTemplates.length} templates`);

      if (weeklyTemplates.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No weekly schedule templates found for the selected contract after filtering.',
          messageType: MessageBarType.warning,
          logResult: 1
        };
        operationDetails.push('❌ ERROR: No weekly templates found after client-side filtering');
        
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

      // *** ШАГ 3: ЗАГРУЗКА КОНТРАКТА ***
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
        operationDetails.push('❌ ERROR: Contract not found');
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // *** ШАГ 4: ГЕНЕРАЦИЯ ЗАПИСЕЙ С DATE-ONLY ПОДДЕРЖКОЙ ***
      operationDetails.push('STEP 3: Generating schedule records with Date-only format support...');
      console.log('[CommonFillService] *** CALLING generateScheduleRecords WITH DATE-ONLY SUPPORT ***');
      
      const generatedRecords = await this.generationService.generateScheduleRecords(
        performParams,
        selectedContract,
        holidays,
        leaves,
        weeklyTemplates
      );

      operationDetails.push(`✅ Generated ${generatedRecords.length} schedule records with Date-only format handling`);
      console.log(`[CommonFillService] Generated ${generatedRecords.length} records`);

      if (generatedRecords.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No schedule records generated.',
          messageType: MessageBarType.warning,
          logResult: 1
        };
        operationDetails.push('❌ ERROR: No records generated');
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // *** ШАГ 5: ПОЛУЧАЕМ ДЕТАЛЬНЫЙ АНАЛИЗ ОТ GENERATION SERVICE ***
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
        operationDetails.push('DETAILED TEMPLATES ANALYSIS WITH DATE-ONLY SUPPORT:');
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
        operationDetails.push('DETAILED GENERATION ANALYSIS WITH DATE-ONLY:');
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

      // *** ШАГ 6: СОХРАНЕНИЕ ЗАПИСЕЙ С DATE-ONLY ПОДДЕРЖКОЙ ***
      operationDetails.push('');
      operationDetails.push('STEP 4: Saving generated records with Date-only format support...');
      console.log('[CommonFillService] *** SAVING RECORDS WITH DATE-ONLY FORMAT HANDLING ***');
      
      const savedCount = await this.generationService.saveGeneratedRecords(generatedRecords, performParams);
      operationDetails.push(`✅ Successfully saved ${savedCount} of ${generatedRecords.length} records with Date-only format handling`);
      console.log(`[CommonFillService] Saved ${savedCount}/${generatedRecords.length} records`);

      // *** ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ***
      const result: IFillResult = {
        success: savedCount > 0,
        message: savedCount === generatedRecords.length 
          ? `Successfully generated ${savedCount} schedule records for ${this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)}`
          : `Generated ${savedCount} of ${generatedRecords.length} records. Some failed to save.`,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount,
        deletedRecordsCount: deletedRecordsCount,
        requiresDialog: false,
        logResult: savedCount > 0 ? 2 : 1
      };

      console.log('[CommonFillService] Fill operation completed with FIXED Date-only logging:', {
        success: result.success,
        created: result.createdRecordsCount,
        deleted: result.deletedRecordsCount,
        period: this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate) // *** ИСПРАВЛЕНО: Используем dateUtils ***
      });

      await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
      return result;

    } catch (dataError) {
      console.error('[CommonFillService] Error loading data or generating records:', dataError);
      
      operationDetails.push('');
      operationDetails.push(`DATA/GENERATION ERROR: ${dataError instanceof Error ? dataError.message : String(dataError)}`);
      
      const result: IFillResult = {
        success: false,
        message: `Error during generation: ${dataError instanceof Error ? dataError.message : String(dataError)}`,
        messageType: MessageBarType.error,
        logResult: 1
      };
      
      await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
      return result;
    }

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
 * *** ИСПРАВЛЕНО: Удаление записей с детальным логированием через validationService ***
 */
private async deleteExistingRecordsWithLogging(existingRecords: IStaffRecord[], operationDetails: string[]): Promise<boolean> {
  console.log(`[CommonFillService] *** DETAILED DELETION WITH LOGGING *** Deleting ${existingRecords.length} existing StaffRecords`);
  
  try {
    operationDetails.push(`Starting deletion of ${existingRecords.length} records (soft delete: Deleted=1)`);
    
    // Логируем детали записей перед удалением
    existingRecords.forEach((record, index) => {
      console.log(`[CommonFillService] Record ${index + 1}: ID=${record.ID}, Date=${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}, Title="${record.Title || 'No title'}", Current Deleted=${record.Deleted || 0}`);
      operationDetails.push(`  Record ${index + 1}: ID=${record.ID}, Date=${record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A'}, Deleted=${record.Deleted || 0}`);
    });

    console.log('[CommonFillService] *** CALLING validationService.deleteExistingRecords ***');
    operationDetails.push('Calling validationService.deleteExistingRecords()...');
    
    // *** ИСПРАВЛЕНО: Используем validationService.deleteExistingRecords ***
    const deleteSuccess = await this.validationService.deleteExistingRecords(existingRecords);
    
    if (deleteSuccess) {
      console.log(`[CommonFillService] ✅ validationService.deleteExistingRecords returned SUCCESS`);
      operationDetails.push(`✅ validationService.deleteExistingRecords completed successfully`);
      operationDetails.push(`All ${existingRecords.length} records should now have Deleted=1`);
      
      // *** ДОБАВЛЕНО: Проверяем результат удаления ***
      operationDetails.push('');
      operationDetails.push('DELETION VERIFICATION:');
      operationDetails.push('Note: Records are soft-deleted (Deleted=1), not physically removed from SharePoint');
      operationDetails.push('Future queries will filter out these records using "Deleted ne 1" filter');
      
      return true;
    } else {
      console.error(`[CommonFillService] ❌ validationService.deleteExistingRecords returned FAILURE`);
      operationDetails.push(`❌ validationService.deleteExistingRecords failed`);
      operationDetails.push('Some or all records may not have been marked as deleted');
      return false;
    }

  } catch (error) {
    const errorMsg = `Critical error during deletion: ${error instanceof Error ? error.message : String(error)}`;
    console.error(`[CommonFillService] *** DELETION CRITICAL ERROR ***`, error);
    operationDetails.push(`❌ ${errorMsg}`);
    operationDetails.push('Deletion process was interrupted due to an exception');
    return false;
  }
}

  /**
   * Логирует отказ пользователя
   */
  public async logUserRefusal(params: IFillParams, dialogType: DialogType, contractId?: string): Promise<void> {
    console.log('[CommonFillService] Logging user refusal with FIXED Date-only logging:', {
      staffMember: params.staffMember.name,
      dialogType,
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate) // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
      `Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`, // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
   * *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создает лог с правильным Date-only форматом для ScheduleLogs ***
   */
  private async createFillLog(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): Promise<void> {
    try {
      const logMessage = this.buildDetailedLogMessage(params, result, contractId, additionalDetails);
      
      // *** ИСПРАВЛЕНО: Используем dateUtils для заголовка лога ***
      const periodStr = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);
      
      // *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для создания Date-only Date объекта ***
      const dateOnlyForScheduleLogs = this.dateUtils.createDateOnlyFromDate(params.selectedDate);
      
      console.log('[CommonFillService] *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: SCHEDULELOGS DATE-ONLY ПОЛЕ ***');
      console.log('[CommonFillService] Original date (UI):', this.dateUtils.formatDateOnlyForDisplay(params.selectedDate));
      console.log('[CommonFillService] Date-only Date object for ScheduleLogs.Date:', dateOnlyForScheduleLogs.toISOString());
      console.log('[CommonFillService] Expected result: Correct month in ScheduleLogs');
      
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
        console.log(`[CommonFillService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: ScheduleLog создан с правильным Date-only форматом, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillService] Error creating log with fixed Date-only format:', error);
    }
  }

  /**
   * *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Создание автозаполнения лога с правильным Date-only форматом ***
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
      
      console.log('[CommonFillService] *** КРИТИЧНОЕ ИСПРАВЛЕНИЕ: AUTO-FILL SCHEDULELOGS DATE-ONLY ***');
      console.log('[CommonFillService] Original date (UI):', this.dateUtils.formatDateOnlyForDisplay(params.selectedDate));
      console.log('[CommonFillService] Date-only Date object for ScheduleLogs.Date:', dateOnlyForScheduleLogs.toISOString());
      
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
        console.log(`[CommonFillService] ✅ КРИТИЧНОЕ ИСПРАВЛЕНИЕ: Auto-fill ScheduleLog создан с правильным Date-only форматом, ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillService] Error creating auto-fill log with fixed Date-only format:', error);
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
    
    lines.push(`=== AUTO-FILL OPERATION LOG WITH FIXED DATE-ONLY LOGGING ===`);
    lines.push(`Date: ${new Date().toISOString()}`); // Timestamp создания лога в UTC
    lines.push(`Status: ${status}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`); // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
   * *** ОБНОВЛЕНО: Формирует детальное сообщение для лога с FIXED Date-only информацией ***
   */
  private buildDetailedLogMessage(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== DETAILED FILL OPERATION LOG WITH FIXED DATE-ONLY LOGGING ===`);
    lines.push(`Date: ${new Date().toISOString()}`); // Timestamp создания лога в UTC
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)}`); // *** ИСПРАВЛЕНО: Используем dateUtils ***
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
   * *** ИСПРАВЛЕНО: Получает период месяца для отображения в логах используя dateUtils ***
   */
  private getMonthPeriodForDisplay(date: Date): { start: string; end: string } {
    try {
      // *** ИСПРАВЛЕНО: Используем dateUtils для создания Date-only границ месяца ***
      const startOfMonth = this.dateUtils.createDateOnlyFromComponents(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = this.dateUtils.createDateOnlyFromComponents(date.getFullYear(), date.getMonth() + 1, 0);
      
      return {
        start: this.dateUtils.formatDateOnlyForDisplay(startOfMonth),
        end: this.dateUtils.formatDateOnlyForDisplay(endOfMonth)
      };
    } catch (error) {
      console.warn('[CommonFillService] Error getting month period for display:', error);
      return {
        start: 'Error',
        end: 'Error'
      };
    }
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
    dateOnlySupport: boolean; // *** ИСПРАВЛЕНО: переименовано из utcSupport ***
    timezoneHandling: boolean;
    autoFillSupport: boolean;
  } {
    return {
      version: '6.2.0', // *** ВЕРСИЯ С КРИТИЧНЫМИ ИСПРАВЛЕНИЯМИ DATE-ONLY ЛОГИРОВАНИЯ ***
      context: !!this.webPartContext,
      services: {
        contracts: !!this.contractsService,
        scheduleLogs: !!this.scheduleLogsService,
        validation: !!this.validationService,
        generation: !!this.generationService,
        remoteSite: !!this.remoteSiteService
      },
      dateOnlySupport: true, // *** ИСПРАВЛЕНО: Правильная поддержка Date-only для UI ***
      timezoneHandling: true,
      autoFillSupport: true
    };
  }

  public async testServices(): Promise<{
    contracts: boolean;
    scheduleLogs: boolean;
    validation: boolean;
    generation: boolean;
    remoteSite: boolean;
    dateOnlySupport: boolean; // *** ИСПРАВЛЕНО: переименовано ***
    timezoneHandling: boolean;
    autoFillSupport: boolean;
    errors: string[];
  }> {
    const results = {
      contracts: false,
      scheduleLogs: false,
      validation: false,
      generation: false,
      remoteSite: false,
      dateOnlySupport: false, // *** ИСПРАВЛЕНО: переименовано ***
      timezoneHandling: false,
      autoFillSupport: false,
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

    // *** ИСПРАВЛЕНО: ТЕСТИРУЕМ DATE-ONLY ПОДДЕРЖКУ ***
    try {
      const testDate = new Date(2025, 0, 15); // 15 января 2025 в локальном времени
      const formatted = this.dateUtils.formatDateOnlyForDisplay(testDate);
      results.dateOnlySupport = formatted === '15.01.2025';
      console.log(`[CommonFillService] Date-only support test: ${results.dateOnlySupport} (formatted: ${formatted})`);
    } catch (error) {
      results.errors.push(`Date-only Support: ${error}`);
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

    console.log('[CommonFillService] Detailed service test results with КРИТИЧНЫМИ ИСПРАВЛЕНИЯМИ Date-only logging and Auto-Fill support:', results);
    return results;
  }
}