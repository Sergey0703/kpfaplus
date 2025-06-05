// src/webparts/kpfaplus/services/CommonFillService.ts - WITH SCHEDULE TAB LOGIC
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

// Export interfaces for compatibility
export { IFillParams, IExistingRecordsCheck, DialogType, IDialogConfig, IScheduleLogicResult };

// *** НОВЫЙ ИНТЕРФЕЙС: Результат операции заполнения с диалогом ***
export interface IFillResult {
  success: boolean;
  message: string;
  messageType: MessageBarType;
  createdRecordsCount?: number;
  deletedRecordsCount?: number;
  // *** НОВЫЕ ПОЛЯ ДЛЯ ПОДДЕРЖКИ ДИАЛОГОВ ***
  requiresDialog?: boolean;
  dialogConfig?: IDialogConfig;
  canProceed?: boolean;
}

// *** НОВЫЙ ИНТЕРФЕЙС: Параметры для выполнения заполнения после подтверждения ***
export interface IPerformFillParams extends IFillParams {
  contractId: string;
  replaceExisting: boolean;
}

export class CommonFillService {
  private static instance: CommonFillService;
  private webPartContext: WebPartContext;
  
  // Core services
  private contractsService: ContractsService;
  private scheduleLogsService: ScheduleLogsService;
  private validationService: CommonFillValidation;
  private generationService: CommonFillGeneration;

  private constructor(context: WebPartContext) {
    this.webPartContext = context;
    this.contractsService = ContractsService.getInstance(context);
    this.scheduleLogsService = ScheduleLogsService.getInstance(context);
    this.validationService = new CommonFillValidation(context);
    this.generationService = new CommonFillGeneration(context);
    
    console.log('[CommonFillService] Service initialized with Schedule tab logic');
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

  public async deleteExistingRecords(existingRecords: any[]): Promise<boolean> {
    return this.validationService.deleteExistingRecords(existingRecords);
  }

  public isContractActiveInMonth(contract: IContract, date: Date): boolean {
    return this.validationService.isContractActiveInMonth(contract, date);
  }

  /**
   * *** ГЛАВНАЯ ФУНКЦИЯ: Проверяет записи и возвращает конфигурацию диалога (НЕ ЗАПОЛНЯЕТ АВТОМАТИЧЕСКИ) ***
   * Эта функция заменяет старую автоматическую логику заполнения
   */
  public async checkScheduleForFill(params: IFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Checking schedule for fill (Schedule tab logic):', params.staffMember.name);
    
    try {
      // *** ШАГ 1: ВАЛИДАЦИЯ ПАРАМЕТРОВ ***
      const validation = this.validationService.validateFillParams(params);
      if (!validation.isValid) {
        const result: IFillResult = {
          success: false,
          message: `Validation failed: ${validation.errors.join(', ')}`,
          messageType: MessageBarType.error,
          requiresDialog: false,
          canProceed: false
        };
        await this.createFillLog(params, result, undefined, `Validation errors: ${validation.errors.join(', ')}`);
        return result;
      }

      // *** ШАГ 2: ЗАГРУЗКА КОНТРАКТОВ ***
      const employeeId = params.staffMember.employeeId;
      const managerId = params.currentUserId || '';
      const groupId = params.managingGroupId || '';
      
      if (!employeeId || employeeId.trim() === '' || employeeId === '0') {
        const result: IFillResult = {
          success: false,
          message: 'Invalid employee ID - cannot check schedule.',
          messageType: MessageBarType.error,
          requiresDialog: false,
          canProceed: false
        };
        await this.createFillLog(params, result, undefined, 'Invalid employee ID');
        return result;
      }
      
      const contracts = await this.contractsService.getContractsForStaffMember(employeeId, managerId, groupId);
      const activeContracts = contracts.filter((contract: IContract) => 
        !contract.isDeleted && this.validationService.isContractActiveInMonth(contract, params.selectedDate)
      );

      if (activeContracts.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No active contracts found for this staff member in the selected period.',
          messageType: MessageBarType.warning,
          requiresDialog: false,
          canProceed: false
        };
        await this.createFillLog(params, result, undefined, 'No active contracts found');
        return result;
      }

      const selectedContract = activeContracts[0];
      console.log(`[CommonFillService] Using contract: ${selectedContract.id}`);

      // *** ШАГ 3: ПРИМЕНЕНИЕ SCHEDULE TAB ЛОГИКИ ***
      const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
        params, 
        selectedContract.id
      );

      console.log('[CommonFillService] Schedule logic result:', {
        dialogType: scheduleLogicResult.dialogConfig.type,
        recordsCount: scheduleLogicResult.existingRecords.length,
        canProceed: scheduleLogicResult.canProceed
      });

      // *** ШАГ 4: ВОЗВРАЩАЕМ РЕЗУЛЬТАТ С ДИАЛОГОМ (НЕ ЗАПОЛНЯЕМ!) ***
      const result: IFillResult = {
        success: false, // НЕ success пока пользователь не подтвердит
        message: scheduleLogicResult.dialogConfig.message,
        messageType: scheduleLogicResult.dialogConfig.type === DialogType.ProcessedRecordsBlock 
          ? MessageBarType.error 
          : MessageBarType.info,
        requiresDialog: true,
        dialogConfig: scheduleLogicResult.dialogConfig,
        canProceed: scheduleLogicResult.canProceed
      };

      // Логируем проверку
      await this.createFillLog(params, {
        ...result,
        message: `Schedule check: ${scheduleLogicResult.dialogConfig.type} - ${scheduleLogicResult.dialogConfig.message}`
      }, selectedContract.id, `Dialog type: ${scheduleLogicResult.dialogConfig.type}`);

      return result;

    } catch (error) {
      console.error('[CommonFillService] Error checking schedule for fill:', error);
      
      const result: IFillResult = {
        success: false,
        message: `Error checking schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        requiresDialog: false,
        canProceed: false
      };
      
      await this.createFillLog(params, result, undefined, `Error: ${error}`);
      return result;
    }
  }

  /**
   * *** НОВАЯ ФУНКЦИЯ: Выполняет фактическое заполнение ПОСЛЕ подтверждения пользователя ***
   * Вызывается только после того, как пользователь подтвердил диалог
   */
  public async performFillOperation(performParams: IPerformFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Performing fill operation after user confirmation:', {
      staffMember: performParams.staffMember.name,
      contractId: performParams.contractId,
      replaceExisting: performParams.replaceExisting,
      period: performParams.selectedDate.toLocaleDateString()
    });

    const operationDetails: string[] = [];
    
    try {
      operationDetails.push('=== FILL OPERATION AFTER CONFIRMATION ===');
      operationDetails.push(`Staff: ${performParams.staffMember.name}`);
      operationDetails.push(`Contract: ${performParams.contractId}`);
      operationDetails.push(`Replace existing: ${performParams.replaceExisting}`);
      operationDetails.push(`Period: ${performParams.selectedDate.toLocaleDateString()}`);
      operationDetails.push('');

      // *** ШАГ 1: УДАЛЕНИЕ СУЩЕСТВУЮЩИХ ЗАПИСЕЙ (ЕСЛИ НУЖНО) ***
      let deletedRecordsCount = 0;
      if (performParams.replaceExisting) {
        operationDetails.push('STEP 1: Deleting existing records...');
        
        // Получаем записи для удаления
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
              messageType: MessageBarType.error
            };
            operationDetails.push('ERROR: Failed to delete existing records');
            await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
            return result;
          }
          deletedRecordsCount = scheduleLogicResult.existingRecords.length;
          operationDetails.push(`✓ Successfully deleted ${deletedRecordsCount} existing records`);
        }
      }

      // *** ШАГ 2: ЗАГРУЗКА ДАННЫХ ДЛЯ ГЕНЕРАЦИИ ***
      operationDetails.push('STEP 2: Loading data for generation...');
      const [holidays, leaves, weeklyTemplates] = await Promise.all([
        this.generationService.loadHolidays(performParams.selectedDate),
        this.generationService.loadLeaves(performParams),
        this.generationService.loadWeeklyTemplates(performParams.contractId, performParams.dayOfStartWeek || 7)
      ]);

      operationDetails.push(`✓ Loaded ${holidays.length} holidays, ${leaves.length} leaves, ${weeklyTemplates.length} templates`);

      if (weeklyTemplates.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No weekly schedule templates found for the selected contract.',
          messageType: MessageBarType.warning
        };
        operationDetails.push('ERROR: No weekly templates found');
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
          messageType: MessageBarType.error
        };
        operationDetails.push('ERROR: Contract not found');
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // *** ШАГ 4: ГЕНЕРАЦИЯ ЗАПИСЕЙ ***
      operationDetails.push('STEP 3: Generating schedule records...');
      const generatedRecords = await this.generationService.generateScheduleRecords(
        performParams,
        selectedContract,
        holidays,
        leaves,
        weeklyTemplates
      );

      operationDetails.push(`✓ Generated ${generatedRecords.length} schedule records`);

      if (generatedRecords.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No schedule records generated.',
          messageType: MessageBarType.warning
        };
        operationDetails.push('ERROR: No records generated');
        await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
        return result;
      }

      // *** ШАГ 5: СОХРАНЕНИЕ ЗАПИСЕЙ ***
      operationDetails.push('STEP 4: Saving generated records...');
      const savedCount = await this.generationService.saveGeneratedRecords(generatedRecords, performParams);
      operationDetails.push(`✓ Successfully saved ${savedCount} of ${generatedRecords.length} records`);

      // *** ШАГ 6: ФОРМИРОВАНИЕ РЕЗУЛЬТАТА ***
      const result: IFillResult = {
        success: savedCount > 0,
        message: savedCount === generatedRecords.length 
          ? `Successfully generated ${savedCount} schedule records for ${performParams.selectedDate.toLocaleDateString()}`
          : `Generated ${savedCount} of ${generatedRecords.length} records. Some failed to save.`,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount,
        deletedRecordsCount: deletedRecordsCount,
        requiresDialog: false
      };

      console.log('[CommonFillService] Fill operation completed:', {
        success: result.success,
        created: result.createdRecordsCount,
        deleted: result.deletedRecordsCount,
        period: performParams.selectedDate.toLocaleDateString()
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
        messageType: MessageBarType.error
      };
      
      await this.createFillLog(performParams, result, performParams.contractId, operationDetails.join('\n'));
      return result;
    }
  }

  /**
   * *** УСТАРЕВШАЯ ФУНКЦИЯ: Оставлена для совместимости, но теперь использует новую логику ***
   * Рекомендуется использовать checkScheduleForFill() + performFillOperation()
   */
  public async fillScheduleForStaff(params: IFillParams, replaceExisting: boolean = false): Promise<IFillResult> {
    console.log('[CommonFillService] DEPRECATED: fillScheduleForStaff called - use checkScheduleForFill + performFillOperation instead');
    
    // Проверяем записи с новой логикой
    const checkResult = await this.checkScheduleForFill(params);
    
    // Если требуется диалог, возвращаем результат проверки
    if (checkResult.requiresDialog) {
      return checkResult;
    }
    
    // Если диалог не требуется (ошибка), возвращаем ошибку
    return checkResult;
  }

  // Create fill log with proper typing
  private async createFillLog(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): Promise<void> {
    try {
      const logMessage = this.buildLogMessage(params, result, contractId, additionalDetails);
      
      // Base required parameters
      const logParams: ICreateScheduleLogParams = {
        title: `Fill Operation - ${params.staffMember.name} (${params.selectedDate.toLocaleDateString()})`,
        result: result.success ? 2 : 1,
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
        console.log(`[CommonFillService] Log created with ID: ${logId}`);
      }

    } catch (error) {
      console.error('[CommonFillService] Error creating log:', error);
    }
  }

  // Build log message
  private buildLogMessage(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== FILL OPERATION LOG ===`);
    lines.push(`Date: ${new Date().toLocaleString()}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${params.selectedDate.toLocaleDateString()}`);
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push('');

    const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
    const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);
    lines.push(`PERIOD DETAILS:`);
    lines.push(`Selected Date: ${params.selectedDate.toLocaleDateString()}`);
    lines.push(`Month Range: ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`);
    lines.push('');

    lines.push(`OPERATION RESULT: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Message: ${result.message}`);
    
    if (result.requiresDialog) {
      lines.push(`Requires Dialog: ${result.dialogConfig?.type || 'Unknown'}`);
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

    if (additionalDetails) {
      lines.push('OPERATION DETAILS:');
      lines.push(additionalDetails);
      lines.push('');
    }

    lines.push(`=== END LOG ===`);
    
    return lines.join('\n');
  }

  // Service management methods
  public static clearInstance(): void {
    CommonFillService.instance = undefined as any;
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
    };
  } {
    return {
      version: '2.1.0', // *** ВЕРСИЯ С SCHEDULE TAB ЛОГИКОЙ ***
      context: !!this.webPartContext,
      services: {
        contracts: !!this.contractsService,
        scheduleLogs: !!this.scheduleLogsService,
        validation: !!this.validationService,
        generation: !!this.generationService
      }
    };
  }

  public async testServices(): Promise<{
    contracts: boolean;
    scheduleLogs: boolean;
    validation: boolean;
    generation: boolean;
    errors: string[];
  }> {
    const results = {
      contracts: false,
      scheduleLogs: false,
      validation: false,
      generation: false,
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

    console.log('[CommonFillService] Service test results:', results);
    return results;
  }
}