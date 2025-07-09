// src/webparts/kpfaplus/services/CommonFillService.ts - Core Orchestration (Part 1/4)
// РЕФАКТОРИНГ: Основной класс-координатор, КОРОТКИЙ И СФОКУСИРОВАННЫЙ
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MessageBarType } from '@fluentui/react';
import { ContractsService } from './ContractsService';
import { 
  CommonFillValidation, 
  IFillParams, 
  IExistingRecordsCheck, 
  DialogType, 
  IDialogConfig, 
  IScheduleLogicResult 
} from './CommonFillValidation';
import { CommonFillGeneration } from './CommonFillGeneration';
import { ScheduleLogsService } from './ScheduleLogsService';
import { RemoteSiteService } from './RemoteSiteService';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { IStaffRecord } from './StaffRecordsService';

// Import separated modules
import { CommonFillServiceValidation } from './CommonFillServiceValidation';
import { CommonFillServiceAutoFill } from './CommonFillServiceAutoFill';
import { CommonFillServiceLogging } from './CommonFillServiceLogging';

// Export interfaces for compatibility
export { IFillParams, IExistingRecordsCheck, DialogType, IDialogConfig, IScheduleLogicResult };

// Результат операции заполнения
export interface IFillResult {
  success: boolean;
  message: string;
  messageType: MessageBarType;
  createdRecordsCount?: number;
  deletedRecordsCount?: number;
  requiresDialog?: boolean;
  dialogConfig?: IDialogConfig;
  canProceed?: boolean;
  logResult?: number;
}

// Параметры для выполнения заполнения
export interface IPerformFillParams extends IFillParams {
  contractId: string;
  replaceExisting: boolean;
}

// Интерфейсы для автозаполнения
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
  logResult: number;
}

export class CommonFillService {
  private static instance: CommonFillService;
  private webPartContext: WebPartContext;
  
  // Core services
  private contractsService: ContractsService;
  private scheduleLogsService: ScheduleLogsService;
  private validationService: CommonFillValidation;
  private generationService: CommonFillGeneration;
  private dateUtils: CommonFillDateUtils;

  // Modules
  private validationModule: CommonFillServiceValidation;
  private autoFillModule: CommonFillServiceAutoFill;
  private loggingModule: CommonFillServiceLogging;

  private constructor(context: WebPartContext) {
    this.webPartContext = context;
    this.contractsService = ContractsService.getInstance(context);
    this.scheduleLogsService = ScheduleLogsService.getInstance(context);
    this.validationService = new CommonFillValidation(context);
    this.generationService = new CommonFillGeneration(context);
    this.dateUtils = new CommonFillDateUtils(RemoteSiteService.getInstance(context));
    
    // Initialize modules
    this.validationModule = new CommonFillServiceValidation(
      this.contractsService, this.validationService, this.generationService, this.dateUtils
    );
    this.autoFillModule = new CommonFillServiceAutoFill(
      this.validationModule, this.generationService, this.dateUtils
    );
    this.loggingModule = new CommonFillServiceLogging(
      this.scheduleLogsService, this.dateUtils
    );
    
    console.log('[CommonFillService] Service initialized with modular architecture and Date-only support');
  }

  public static getInstance(context: WebPartContext): CommonFillService {
    if (!CommonFillService.instance) {
      CommonFillService.instance = new CommonFillService(context);
    }
    return CommonFillService.instance;
  }

  // Delegation methods for compatibility
  public async checkExistingRecords(params: IFillParams): Promise<IExistingRecordsCheck> {
    return this.validationService.checkExistingRecords(params);
  }

  public async deleteExistingRecords(existingRecords: IStaffRecord[]): Promise<boolean> {
    return this.validationService.deleteExistingRecords(existingRecords);
  }

  // Main API methods - delegated to modules
  public async checkAutoFillEligibility(params: IFillParams): Promise<IAutoFillEligibilityCheck> {
    return this.validationModule.checkAutoFillEligibility(params);
  }

  public async performAutoFillOperation(params: IFillParams): Promise<IAutoFillResult> {
    return this.autoFillModule.performAutoFillOperation(params);
  }

  public async checkScheduleForFill(params: IFillParams): Promise<IFillResult> {
    try {
      const validationResult = await this.validationModule.checkScheduleForFill(params);
      await this.loggingModule.createFillLog(params, validationResult, validationResult.contractId);
      return validationResult;
    } catch (error) {
      const errorResult: IFillResult = {
        success: false,
        message: `Error checking schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        requiresDialog: false,
        canProceed: false,
        logResult: 1
      };
      await this.loggingModule.createFillLog(params, errorResult);
      return errorResult;
    }
  }

  public async performFillOperation(performParams: IPerformFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Coordinating fill operation:', {
      staffMember: performParams.staffMember.name,
      period: this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)
    });

    try {
      // Delete existing records if needed
      if (performParams.replaceExisting) {
        const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
          performParams, performParams.contractId
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
            await this.loggingModule.createFillLog(performParams, result, performParams.contractId);
            return result;
          }
        }
      }

      // Load data
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

      if (weeklyTemplates.length === 0) {
        const result: IFillResult = {
          success: false,
          message: 'No weekly schedule templates found.',
          messageType: MessageBarType.warning,
          logResult: 1
        };
        await this.loggingModule.createFillLog(performParams, result, performParams.contractId);
        return result;
      }

      // Get contract
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
        await this.loggingModule.createFillLog(performParams, result, performParams.contractId);
        return result;
      }

      // Generate and save records
      const generatedRecords = await this.generationService.generateScheduleRecords(
        performParams, selectedContract, holidays, leaves, weeklyTemplates
      );
      const savedCount = await this.generationService.saveGeneratedRecords(generatedRecords, performParams);

      const result: IFillResult = {
        success: savedCount > 0,
        message: `Generated ${savedCount} schedule records for ${this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)}`,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount,
        logResult: savedCount > 0 ? 2 : 1
      };

      await this.loggingModule.createFillLog(performParams, result, performParams.contractId);
      return result;

    } catch (error) {
      const result: IFillResult = {
        success: false,
        message: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        logResult: 1
      };
      await this.loggingModule.createFillLog(performParams, result, performParams.contractId);
      return result;
    }
  }

  public async logUserRefusal(params: IFillParams, dialogType: DialogType, contractId?: string): Promise<void> {
    await this.loggingModule.logUserRefusal(params, dialogType, contractId);
  }

  // Legacy compatibility
  public async fillScheduleForStaff(params: IFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] DEPRECATED: fillScheduleForStaff - use checkScheduleForFill + performFillOperation');
    return this.checkScheduleForFill(params);
  }

  // Service management
  public static clearInstance(): void {
    CommonFillService.instance = undefined as unknown as CommonFillService;
  }

  public getServiceInfo() {
    return {
      version: '7.0.0-modular',
      context: !!this.webPartContext,
      services: {
        contracts: !!this.contractsService,
        scheduleLogs: !!this.scheduleLogsService,
        validation: !!this.validationService,
        generation: !!this.generationService
      },
      modules: {
        validation: !!this.validationModule,
        autoFill: !!this.autoFillModule,
        logging: !!this.loggingModule
      },
      dateOnlySupport: true,
      autoFillSupport: true
    };
  }
}