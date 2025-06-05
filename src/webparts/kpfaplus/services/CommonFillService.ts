// src/webparts/kpfaplus/services/CommonFillService.ts - WITH DETAILED LOGGING AND CLIENT-SIDE FILTERING
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
    
    console.log('[CommonFillService] Service initialized with detailed logging and client-side filtering support');
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
   * Проверяет записи и возвращает конфигурацию диалога (НЕ ЗАПОЛНЯЕТ АВТОМАТИЧЕСКИ)
   */
  public async checkScheduleForFill(params: IFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Checking schedule for fill with detailed analysis and client-side filtering:', params.staffMember.name);
    console.log('[CommonFillService] Parameters for filtering:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: params.selectedDate.toLocaleDateString()
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
      console.log('[CommonFillService] Checking weekly templates availability with client-side filtering...');
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
  private async performContractsAnalysis(params: IFillParams): Promise<{
    allContracts: IContract[];
    activeContracts: IContract[];
    analysisDetails: string[];
  }> {
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
    analysisDetails.push(`Selected Date: ${params.selectedDate.toLocaleDateString()}`);
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
      analysisDetails.push(`Selected period: ${params.selectedDate.toLocaleDateString()}`);
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
  private buildContractsAnalysisLog(contractsAnalysis: {
    allContracts: IContract[];
    activeContracts: IContract[];
    analysisDetails: string[];
  }): string {
    return contractsAnalysis.analysisDetails.join('\n');
  }

  /**
   * Выполняет фактическое заполнение ПОСЛЕ подтверждения пользователя
   */
  public async performFillOperation(performParams: IPerformFillParams): Promise<IFillResult> {
    console.log('[CommonFillService] Performing fill operation with detailed logging and client-side filtering:', {
      staffMember: performParams.staffMember.name,
      contractId: performParams.contractId,
      replaceExisting: performParams.replaceExisting,
      period: performParams.selectedDate.toLocaleDateString(),
      currentUserId: performParams.currentUserId,
      managingGroupId: performParams.managingGroupId
    });

    const operationDetails: string[] = [];
    
    try {
      operationDetails.push('=== DETAILED FILL OPERATION AFTER CONFIRMATION WITH CLIENT-SIDE FILTERING ===');
      operationDetails.push(`Staff: ${performParams.staffMember.name} (ID: ${performParams.staffMember.employeeId})`);
      operationDetails.push(`Contract: ${performParams.contractId}`);
      operationDetails.push(`Replace existing: ${performParams.replaceExisting}`);
      operationDetails.push(`Period: ${performParams.selectedDate.toLocaleDateString()}`);
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

      // *** ДЕТАЛЬНАЯ ЗАГРУЗКА ДАННЫХ С АНАЛИЗОМ И НОВОЙ ФИЛЬТРАЦИЕЙ ***
      operationDetails.push('STEP 2: Loading data for generation with detailed analysis and client-side filtering...');
      
      const [holidays, leaves, weeklyTemplates] = await Promise.all([
        this.generationService.loadHolidays(performParams.selectedDate),
        this.generationService.loadLeaves(performParams),
        this.generationService.loadWeeklyTemplates(
          performParams.contractId, 
          performParams.dayOfStartWeek || 7,
          performParams.currentUserId || '0',     // *** НОВЫЙ ПАРАМЕТР ***
          performParams.managingGroupId || '0'   // *** НОВЫЙ ПАРАМЕТР ***
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

      // *** ГЕНЕРАЦИЯ ЗАПИСЕЙ С ДЕТАЛЬНЫМ АНАЛИЗОМ ***
      operationDetails.push('STEP 3: Generating schedule records with detailed analysis...');
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
        operationDetails.push('DETAILED TEMPLATES ANALYSIS WITH CLIENT-SIDE FILTERING:');
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
        operationDetails.push('DETAILED GENERATION ANALYSIS:');
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

      // Сохранение записей
      operationDetails.push('');
      operationDetails.push('STEP 4: Saving generated records...');
      const savedCount = await this.generationService.saveGeneratedRecords(generatedRecords, performParams);
      operationDetails.push(`✓ Successfully saved ${savedCount} of ${generatedRecords.length} records`);

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

      console.log('[CommonFillService] Fill operation completed with detailed analysis and client-side filtering:', {
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
    console.log('[CommonFillService] Logging user refusal with detailed info:', {
      staffMember: params.staffMember.name,
      dialogType,
      period: params.selectedDate.toLocaleDateString()
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
      `Period: ${params.selectedDate.toLocaleDateString()}`,
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
   * *** ОБНОВЛЕНО: Создает лог с детальной информацией включая фильтрацию ***
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
        console.log(`[CommonFillService] Detailed log created with ID: ${logId}, Result: ${logParams.result}`);
      }

    } catch (error) {
      console.error('[CommonFillService] Error creating detailed log:', error);
    }
  }

  /**
   * *** ОБНОВЛЕНО: Формирует детальное сообщение для лога с информацией о фильтрации ***
   */
  private buildDetailedLogMessage(
    params: IFillParams, 
    result: IFillResult, 
    contractId: string | undefined,
    additionalDetails: string
  ): string {
    const lines: string[] = [];
    
    lines.push(`=== DETAILED FILL OPERATION LOG WITH CLIENT-SIDE FILTERING ===`);
    lines.push(`Date: ${new Date().toLocaleString()}`);
    lines.push(`Staff: ${params.staffMember.name} (ID: ${params.staffMember.employeeId})`);
    lines.push(`Period: ${params.selectedDate.toLocaleDateString()}`);
    lines.push(`Manager: ${params.currentUserId || 'N/A'}`);
    lines.push(`Staff Group: ${params.managingGroupId || 'N/A'}`);
    lines.push('');

    // *** ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ О ПЕРИОДЕ И ФИЛЬТРАЦИИ ***
    const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
    const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);
    lines.push(`PERIOD AND FILTERING DETAILS:`);
    lines.push(`Selected Date: ${params.selectedDate.toLocaleDateString()}`);
    lines.push(`Month Range: ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`);
    lines.push(`Day of Start Week: ${params.dayOfStartWeek || 7}`);
    lines.push(`Current User ID (for filtering): ${params.currentUserId || 'N/A'}`);
    lines.push(`Managing Group ID (for filtering): ${params.managingGroupId || 'N/A'}`);
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

    // *** ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ВКЛЮЧАЯ ФИЛЬТРАЦИЮ ***
    if (additionalDetails) {
      lines.push('DETAILED OPERATION ANALYSIS:');
      lines.push(additionalDetails);
      lines.push('');
    }

    lines.push(`=== END DETAILED LOG ===`);
    
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
    clientSideFiltering: boolean;
  } {
    return {
      version: '4.0.0', // *** ВЕРСИЯ С КЛИЕНТСКОЙ ФИЛЬТРАЦИЕЙ ***
      context: !!this.webPartContext,
      services: {
        contracts: !!this.contractsService,
        scheduleLogs: !!this.scheduleLogsService,
        validation: !!this.validationService,
        generation: !!this.generationService
      },
      clientSideFiltering: true // *** НОВАЯ ВОЗМОЖНОСТЬ ***
    };
  }

  public async testServices(): Promise<{
    contracts: boolean;
    scheduleLogs: boolean;
    validation: boolean;
    generation: boolean;
    clientSideFiltering: boolean;
    errors: string[];
  }> {
    const results = {
      contracts: false,
      scheduleLogs: false,
      validation: false,
      generation: false,
      clientSideFiltering: false,
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

    // *** ТЕСТИРУЕМ КЛИЕНТСКУЮ ФИЛЬТРАЦИЮ ***
    try {
      await this.generationService.loadWeeklyTemplates('1', 7, '1', '1');
      results.clientSideFiltering = true;
    } catch (error) {
      results.errors.push(`ClientSideFiltering: ${error}`);
    }

    console.log('[CommonFillService] Detailed service test results with client-side filtering:', results);
    return results;
  }
}