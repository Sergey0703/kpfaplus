// src/webparts/kpfaplus/services/CommonFillService.ts - Core Orchestration (Part 1/4)
// ИСПРАВЛЕНО: Добавлена правильная передача данных о праздниках и отпусках в ScheduleLogs
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
    
    console.log('[CommonFillService] Service initialized with modular architecture and detailed logging support');
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
      
      // Получаем детальную информацию для логирования
      const detailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
      
      await this.loggingModule.createFillLog(
        params, 
        validationResult, 
        validationResult.contractId, 
        undefined, 
        detailedLoggingInfo
      );
      
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
      
      // Получаем детальную информацию даже для ошибок
      const detailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
      
      await this.loggingModule.createFillLog(
        params, 
        errorResult, 
        undefined, 
        undefined, 
        detailedLoggingInfo
      );
      
      return errorResult;
    }
  }

  public async performFillOperation(performParams: IPerformFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Coordinating fill operation with detailed logging:', {
      staffMember: performParams.staffMember.name,
      period: this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)
    });

    try {
      let deletedRecordsCount = 0;
      let analysisReport = '';

      // Delete existing records if needed
      if (performParams.replaceExisting) {
        const scheduleLogicResult = await this.validationService.checkExistingRecordsWithScheduleLogic(
          performParams, performParams.contractId
        );
        
        if (scheduleLogicResult.existingRecords.length > 0) {
          console.log(`[CommonFillService] Удаляем ${scheduleLogicResult.existingRecords.length} существующих записей`);
          
          // Сохраняем количество удаляемых записей
          deletedRecordsCount = scheduleLogicResult.existingRecords.length;
          
          // Передаем информацию об удаляемых записях в generation service
          this.generationService.setDeletedRecordsCount(deletedRecordsCount);
          
          const deleteSuccess = await this.validationService.deleteExistingRecords(scheduleLogicResult.existingRecords);
          if (!deleteSuccess) {
            const result: IFillResult = {
              success: false,
              message: 'Failed to delete existing records.',
              messageType: MessageBarType.error,
              logResult: 1,
              deletedRecordsCount: 0
            };
            
            // Получаем детальную информацию для логирования
            const detailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
            
            await this.loggingModule.createFillLog(
              performParams, 
              result, 
              performParams.contractId, 
              undefined, 
              detailedLoggingInfo
            );
            
            return result;
          }
          
          console.log(`[CommonFillService] ✓ Успешно удалено ${deletedRecordsCount} записей`);
        }
      }

      // Contract analysis
      const contracts = await this.contractsService.getContractsForStaffMember(
        performParams.staffMember.employeeId || '',
        performParams.currentUserId || '',
        performParams.managingGroupId || ''
      );
      
      const activeContracts = contracts.filter(c => 
        !c.isDeleted && this.validationService.isContractActiveInMonth(c, performParams.selectedDate)
      );
      
      const selectedContract = activeContracts.find(c => c.id === performParams.contractId);
      
      if (!selectedContract) {
        const result: IFillResult = {
          success: false,
          message: 'Selected contract not found.',
          messageType: MessageBarType.error,
          logResult: 1,
          deletedRecordsCount
        };
        
        // Получаем детальную информацию для логирования
        const detailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
        
        await this.loggingModule.createFillLog(
          performParams, 
          result, 
          performParams.contractId, 
          undefined, 
          detailedLoggingInfo
        );
        
        return result;
      }

      // Передаем анализ контрактов в generation service
      this.generationService.analyzeContracts(
        contracts, 
        activeContracts, 
        selectedContract, 
        performParams.selectedDate
      );

      // *** ИСПРАВЛЕНИЕ: Load data и НЕМЕДЛЕННАЯ ПЕРЕДАЧА В GENERATION SERVICE ***
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

      // *** ИСПРАВЛЕНИЕ: ОБЯЗАТЕЛЬНО устанавливаем детальную информацию СРАЗУ после загрузки ***
      console.log('[CommonFillService] *** ИСПРАВЛЕНИЕ: Устанавливаем детальную информацию для ScheduleLogs ***');
      console.log(`[CommonFillService] Загружено праздников: ${holidays.length}`);
      console.log(`[CommonFillService] Загружено отпусков: ${leaves.length}`);
      
      // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Устанавливаем данные в generation service для передачи в ScheduleLogs ***
      this.generationService.setDetailedHolidaysInfo(holidays);
      this.generationService.setDetailedLeavesInfo(leaves);
      
      // Проверяем что данные установлены
      const verificationInfo = this.generationService.getDetailedLoggingInfo();
      console.log('[CommonFillService] *** ПРОВЕРКА: Данные установлены для ScheduleLogs ***');
      console.log(`[CommonFillService] Удаленных записей: ${verificationInfo.deletedRecordsCount}`);
      console.log(`[CommonFillService] Деталей праздников: ${verificationInfo.holidaysDetails.length}`);
      console.log(`[CommonFillService] Деталей отпусков: ${verificationInfo.leavesDetails.length}`);

      if (weeklyTemplates.length === 0) {
        // Получаем анализ для включения в лог
        analysisReport = this.generationService.generateAnalysisReport();
        
        const result: IFillResult = {
          success: false,
          message: 'No weekly schedule templates found.',
          messageType: MessageBarType.warning,
          logResult: 1,
          deletedRecordsCount
        };
        
        // Получаем детальную информацию для логирования
        const detailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
        
        await this.loggingModule.createFillLog(
          performParams, 
          result, 
          performParams.contractId, 
          analysisReport, 
          detailedLoggingInfo
        );
        
        return result;
      }

      // Generate and save records
      const generatedRecords = await this.generationService.generateScheduleRecords(
        performParams, selectedContract, holidays, leaves, weeklyTemplates
      );
      
      // Передаем количество удаленных записей при сохранении
      const savedCount = await this.generationService.saveGeneratedRecords(
        generatedRecords, 
        performParams, 
        deletedRecordsCount
      );

      // Получаем полный анализ для включения в лог
      analysisReport = this.generationService.generateAnalysisReport();

      const result: IFillResult = {
        success: savedCount > 0,
        message: `Generated ${savedCount} schedule records for ${this.dateUtils.formatDateOnlyForDisplay(performParams.selectedDate)}`,
        messageType: savedCount === generatedRecords.length ? MessageBarType.success : MessageBarType.warning,
        createdRecordsCount: savedCount,
        deletedRecordsCount,
        logResult: savedCount > 0 ? 2 : 1
      };

      // *** ИСПРАВЛЕНИЕ: ФИНАЛЬНАЯ ПЕРЕДАЧА всей детальной информации в ScheduleLogs ***
      const finalDetailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
      
      console.log('[CommonFillService] *** ФИНАЛЬНАЯ ПРОВЕРКА: Данные для ScheduleLogs ***');
      console.log(`[CommonFillService] Удаленных записей: ${finalDetailedLoggingInfo.deletedRecordsCount}`);
      console.log(`[CommonFillService] Праздников: ${finalDetailedLoggingInfo.holidaysDetails.length}`);
      console.log(`[CommonFillService] Отпусков: ${finalDetailedLoggingInfo.leavesDetails.length}`);

      await this.loggingModule.createFillLog(
        performParams, 
        result, 
        performParams.contractId, 
        analysisReport, 
        finalDetailedLoggingInfo
      );
      
      return result;

    } catch (error) {
      // Получаем детальную информацию и анализ даже для ошибок
      const detailedLoggingInfo = this.generationService.getDetailedLoggingInfo();
      const analysisReport = this.generationService.generateAnalysisReport();
      
      const result: IFillResult = {
        success: false,
        message: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
        messageType: MessageBarType.error,
        logResult: 1,
        deletedRecordsCount: detailedLoggingInfo.deletedRecordsCount
      };
      
      await this.loggingModule.createFillLog(
        performParams, 
        result, 
        performParams.contractId, 
        analysisReport, 
        detailedLoggingInfo
      );
      
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
      version: '7.2.0-fixed-detailed-logging',
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
      autoFillSupport: true,
      detailedLoggingSupport: true,
      features: [
        'FIXED: Proper holidays and leaves logging to ScheduleLogs',
        'Detailed holidays and leaves logging',
        'Deleted records count tracking',
        'Comprehensive logging reports',
        'Date-only format support for all logging'
      ]
    };
  }
}