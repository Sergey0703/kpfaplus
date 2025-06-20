// src/webparts/kpfaplus/services/CommonFillValidation.ts
// ИСПРАВЛЕНО: Добавлена поддержка UTC для границ месяца и проверки записей
// ДОБАВЛЕНО: Поддержка автозаполнения и специальная валидация для staff с autoschedule
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { IContract } from '../models/IContract';
import { IStaffMember } from '../models/types';

// Интерфейс для параметров операции заполнения
export interface IFillParams {
  selectedDate: Date;
  staffMember: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;
  context: WebPartContext;
}

// Интерфейс для результата проверки существующих записей
export interface IExistingRecordsCheck {
  hasExistingRecords: boolean;
  recordsCount: number;
  hasProcessedRecords: boolean;
  processedCount: number;
  existingRecords: IStaffRecord[];
}

// *** НОВЫЕ ИНТЕРФЕЙСЫ ИЗ SCHEDULE TAB ***
export enum DialogType {
  EmptySchedule = 'EmptySchedule',
  UnprocessedRecordsReplace = 'UnprocessedRecordsReplace',
  ProcessedRecordsBlock = 'ProcessedRecordsBlock'
}

export interface IDialogConfig {
  type: DialogType;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText?: string;
  confirmButtonColor: string;
}

export interface IScheduleLogicResult {
  dialogConfig: IDialogConfig;
  existingRecords: IStaffRecord[];
  canProceed: boolean;
}

// *** НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ АВТОЗАПОЛНЕНИЯ ***
export interface IAutoFillValidationResult {
  isValid: boolean;
  canAutoFill: boolean;
  errors: string[];
  warnings: string[];
  autoScheduleEnabled: boolean;
  hasProcessedRecords: boolean;
  existingRecordsCount: number;
  processedRecordsCount: number;
  actionRequired: 'PROCEED' | 'REPLACE' | 'SKIP_WITH_WARNING' | 'BLOCK';
  skipReason?: string;
}

export interface IAutoFillSafetyCheck {
  safe: boolean;
  reason?: string;
  hasProcessedRecords: boolean;
  processedRecordsDetails?: {
    count: number;
    examples: Array<{
      id: string;
      date: string;
      checked: number;
      exportResult: string;
    }>;
  };
}

export class CommonFillValidation {
  private staffRecordsService: StaffRecordsService;

  constructor(context: WebPartContext) {
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    console.log('[CommonFillValidation] Service initialized with UTC support for month boundaries and auto-fill validation');
  }

  /**
   * *** ИСПРАВЛЕНО: Проверяет существующие записи с UTC границами месяца ***
   */
  public async checkExistingRecords(params: IFillParams): Promise<IExistingRecordsCheck> {
    console.log('[CommonFillValidation] Checking existing records with UTC boundaries for staff:', params.staffMember.name);

    try {
      // *** ИСПРАВЛЕНО: Определяем период используя UTC методы ***
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

      console.log(`[CommonFillValidation] *** UTC MONTH BOUNDARIES ***`);
      console.log(`[CommonFillValidation] Start of month (UTC): ${startOfMonth.toISOString()}`);
      console.log(`[CommonFillValidation] End of month (UTC): ${endOfMonth.toISOString()}`);
      console.log(`[CommonFillValidation] Selected date: ${params.selectedDate.toISOString()}`);

      if (!params.staffMember.employeeId) {
        console.warn('[CommonFillValidation] Staff member has no employeeId');
        return {
          hasExistingRecords: false,
          recordsCount: 0,
          hasProcessedRecords: false,
          processedCount: 0,
          existingRecords: []
        };
      }

      const employeeId = params.staffMember.employeeId;
      const managerId = params.currentUserId || '0';
      const groupId = params.managingGroupId || '0';
      
      const queryParams = {
        startDate: startOfMonth,  // *** UTC дата ***
        endDate: endOfMonth,      // *** UTC дата ***
        currentUserID: managerId,
        staffGroupID: groupId,
        employeeID: employeeId,
      };

      console.log('[CommonFillValidation] Query params with UTC boundaries:', {
        startDate: queryParams.startDate.toISOString(),
        endDate: queryParams.endDate.toISOString(),
        employeeID: queryParams.employeeID,
        managerId: queryParams.currentUserID,
        groupId: queryParams.staffGroupID
      });

      const result = await this.staffRecordsService.getAllStaffRecordsForTimetable(queryParams);
      
      if (result.error) {
        throw new Error(result.error);
      }

      const allRecords = result.records;

      // Фильтруем записи по удаленным
      const existingRecords = allRecords.filter((record: IStaffRecord) => {
        const notDeleted = record.Deleted !== 1;
        return notDeleted;
      });

      console.log(`[CommonFillValidation] Found ${allRecords.length} total records, ${existingRecords.length} active (not deleted) with UTC boundaries`);

      // Проверяем, есть ли обработанные записи
      const processedRecords = existingRecords.filter((record: IStaffRecord) => {
        const isProcessed = (record.Checked && record.Checked > 0) || 
                           (record.ExportResult && record.ExportResult.trim() !== '' && record.ExportResult !== '0');
        if (isProcessed) {
          console.log(`[CommonFillValidation] Found processed record ID=${record.ID}: Checked=${record.Checked}, ExportResult="${record.ExportResult}"`);
        }
        return isProcessed;
      });

      const result_check: IExistingRecordsCheck = {
        hasExistingRecords: existingRecords.length > 0,
        recordsCount: existingRecords.length,
        hasProcessedRecords: processedRecords.length > 0,
        processedCount: processedRecords.length,
        existingRecords: existingRecords
      };

      console.log('[CommonFillValidation] Existing records check result with UTC boundaries:', {
        hasExisting: result_check.hasExistingRecords,
        totalActive: result_check.recordsCount,
        hasProcessed: result_check.hasProcessedRecords,
        processedCount: result_check.processedCount
      });

      return result_check;

    } catch (error) {
      console.error('[CommonFillValidation] Error checking existing records with UTC boundaries:', error);
      throw new Error(`Failed to check existing records: ${error}`);
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Валидация специально для автозаполнения ***
   */
  public async validateAutoFillConditions(params: IFillParams): Promise<IAutoFillValidationResult> {
    console.log('[CommonFillValidation] Validating auto-fill conditions with UTC support for:', params.staffMember.name);
    console.log('[CommonFillValidation] Auto-fill validation parameters:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: params.selectedDate.toISOString(), // *** UTC дата ***
      autoScheduleEnabled: params.staffMember.autoSchedule || false
    });

    const errors: string[] = [];
    const warnings: string[] = [];
    let actionRequired: 'PROCEED' | 'REPLACE' | 'SKIP_WITH_WARNING' | 'BLOCK' = 'PROCEED';
    let skipReason: string | undefined;

    try {
      // *** ПРОВЕРКА 1: Базовая валидация параметров ***
      const basicValidation = this.validateFillParams(params);
      if (!basicValidation.isValid) {
        errors.push(...basicValidation.errors);
      }

      // *** ПРОВЕРКА 2: AutoSchedule должен быть включен ***
      const autoScheduleEnabled = params.staffMember.autoSchedule || false;
      if (!autoScheduleEnabled) {
        errors.push('Auto Schedule is not enabled for this staff member');
        actionRequired = 'BLOCK';
        skipReason = 'Auto Schedule disabled';
      }

      // *** ПРОВЕРКА 3: Существующие записи с особой логикой для автозаполнения ***
      let hasProcessedRecords = false;
      let existingRecordsCount = 0;
      let processedRecordsCount = 0;

      if (basicValidation.isValid) {
        try {
          const existingCheck = await this.checkExistingRecords(params);
          existingRecordsCount = existingCheck.recordsCount;
          hasProcessedRecords = existingCheck.hasProcessedRecords;
          processedRecordsCount = existingCheck.processedCount;

          console.log('[CommonFillValidation] Auto-fill existing records analysis:', {
            existingRecords: existingRecordsCount,
            hasProcessedRecords,
            processedCount: processedRecordsCount
          });

          // *** ЛОГИКА АВТОЗАПОЛНЕНИЯ ***
          if (hasProcessedRecords) {
            // Есть обработанные записи - автозаполнение ЗАБЛОКИРОВАНО
            errors.push(`Found ${processedRecordsCount} processed records (Checked>0 or ExportResult>0)`);
            actionRequired = 'SKIP_WITH_WARNING';
            skipReason = 'Has processed records that cannot be automatically replaced';
            warnings.push('Staff member will be skipped due to processed records - warning will be logged');
          } else if (existingRecordsCount > 0) {
            // Есть необработанные записи - можно заменить автоматически
            warnings.push(`Found ${existingRecordsCount} unprocessed records that will be automatically replaced`);
            actionRequired = 'REPLACE';
          } else {
            // Нет записей - можно создавать новые
            actionRequired = 'PROCEED';
          }

        } catch (recordsError) {
          errors.push(`Error checking existing records: ${recordsError}`);
          actionRequired = 'BLOCK';
        }
      }

      const result: IAutoFillValidationResult = {
        isValid: errors.length === 0,
        canAutoFill: errors.length === 0 && actionRequired !== 'BLOCK',
        errors,
        warnings,
        autoScheduleEnabled,
        hasProcessedRecords,
        existingRecordsCount,
        processedRecordsCount,
        actionRequired,
        skipReason
      };

      console.log('[CommonFillValidation] Auto-fill validation result:', {
        isValid: result.isValid,
        canAutoFill: result.canAutoFill,
        actionRequired: result.actionRequired,
        skipReason: result.skipReason,
        errorsCount: result.errors.length,
        warningsCount: result.warnings.length
      });

      return result;

    } catch (error) {
      console.error('[CommonFillValidation] Error validating auto-fill conditions:', error);
      
      return {
        isValid: false,
        canAutoFill: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
        warnings: [],
        autoScheduleEnabled: params.staffMember.autoSchedule || false,
        hasProcessedRecords: false,
        existingRecordsCount: 0,
        processedRecordsCount: 0,
        actionRequired: 'BLOCK',
        skipReason: 'Validation error occurred'
      };
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Проверка безопасности автозаполнения ***
   */
  public async checkAutoFillSafety(params: IFillParams): Promise<IAutoFillSafetyCheck> {
    console.log('[CommonFillValidation] Checking auto-fill safety with detailed processed records analysis');

    try {
      const existingCheck = await this.checkExistingRecords(params);
      
      if (!existingCheck.hasProcessedRecords) {
        return {
          safe: true,
          hasProcessedRecords: false
        };
      }

      // Детальный анализ обработанных записей
      const processedRecords = existingCheck.existingRecords.filter((record: IStaffRecord) => {
        return (record.Checked && record.Checked > 0) || 
               (record.ExportResult && record.ExportResult.trim() !== '' && record.ExportResult !== '0');
      });

      const processedRecordsDetails = {
        count: processedRecords.length,
        examples: processedRecords.slice(0, 5).map(record => ({
          id: record.ID,
          date: record.Date ? record.Date.toLocaleDateString() : 'N/A',
          checked: record.Checked || 0,
          exportResult: record.ExportResult || 'N/A'
        }))
      };

      console.log('[CommonFillValidation] Auto-fill safety check - found processed records:', processedRecordsDetails);

      return {
        safe: false,
        reason: `Found ${processedRecords.length} processed records that cannot be automatically replaced`,
        hasProcessedRecords: true,
        processedRecordsDetails
      };

    } catch (error) {
      console.error('[CommonFillValidation] Error checking auto-fill safety:', error);
      
      return {
        safe: false,
        reason: `Error checking safety: ${error instanceof Error ? error.message : String(error)}`,
        hasProcessedRecords: false
      };
    }
  }

  /**
   * *** ОСНОВНОЙ МЕТОД: Реализует логику Schedule tab для проверки записей и определения диалога ***
   */
  public async checkExistingRecordsWithScheduleLogic(params: IFillParams, contractId: string): Promise<IScheduleLogicResult> {
    console.log('[CommonFillValidation] Implementing Schedule tab logic with UTC support for:', {
      staffMember: params.staffMember.name,
      contractId,
      period: params.selectedDate.toISOString() // *** UTC дата ***
    });

    try {
      // *** ШАГ 1: ПОЛУЧЕНИЕ СУЩЕСТВУЮЩИХ ЗАПИСЕЙ С ФИЛЬТРАЦИЕЙ КАК В SCHEDULE TAB ***
      const existingRecords = await this.getExistingRecordsWithStatus(params, contractId);
      
      console.log(`[CommonFillValidation] Schedule logic found ${existingRecords.length} existing records with UTC boundaries`);

      // *** ШАГ 2: АНАЛИЗ СТАТУСА ЗАПИСЕЙ ***
      const processingStatus = this.checkRecordsProcessingStatus(existingRecords);
      
      console.log('[CommonFillValidation] Processing status:', {
        total: existingRecords.length,
        processed: processingStatus.processedCount,
        unprocessed: processingStatus.unprocessedCount
      });

      // *** ШАГ 3: ОПРЕДЕЛЕНИЕ ТИПА ДИАЛОГА КАК В SCHEDULE TAB ***
      const dialogConfig = this.determineDialogType(existingRecords, processingStatus);

      return {
        dialogConfig,
        existingRecords,
        canProceed: dialogConfig.type === DialogType.EmptySchedule || dialogConfig.type === DialogType.UnprocessedRecordsReplace
      };

    } catch (error) {
      console.error('[CommonFillValidation] Error in Schedule logic with UTC support:', error);
      
      // Возвращаем ошибку как блокирующий диалог
      return {
        dialogConfig: {
          type: DialogType.ProcessedRecordsBlock,
          title: 'Error',
          message: `Error checking existing records: ${error instanceof Error ? error.message : String(error)}`,
          confirmButtonText: 'OK',
          confirmButtonColor: '#d83b01'
        },
        existingRecords: [],
        canProceed: false
      };
    }
  }

  /**
   * *** ИСПРАВЛЕНО: Получает существующие записи с UTC фильтром как в Schedule tab ***
   */
  private async getExistingRecordsWithStatus(params: IFillParams, contractId: string): Promise<IStaffRecord[]> {
    console.log('[CommonFillValidation] Getting existing records with Schedule tab filtering logic and UTC boundaries');

    // *** ИСПРАВЛЕНО: Определяем период с учетом контракта используя UTC ***
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

    // Корректируем период с учетом дат действия контракта (если нужно)
    const firstDay = startOfMonth;
    const lastDay = endOfMonth;

    console.log(`[CommonFillValidation] *** UTC SCHEDULE TAB FILTERING PERIOD ***`);
    console.log(`[CommonFillValidation] First day (UTC): ${firstDay.toISOString()}`);
    console.log(`[CommonFillValidation] Last day (UTC): ${lastDay.toISOString()}`);

    if (!params.staffMember.employeeId) {
      console.warn('[CommonFillValidation] No employee ID for Schedule tab filtering');
      return [];
    }

    const employeeId = params.staffMember.employeeId;
    const managerId = params.currentUserId || '0';
    const groupId = params.managingGroupId || '0';

    console.log('[CommonFillValidation] Schedule tab filter criteria with UTC:', {
      employeeId,
      managerId,
      groupId,
      contractId,
      period: `${firstDay.toISOString()} - ${lastDay.toISOString()}`
    });

    // Используем тот же запрос что и Schedule tab с UTC границами
    const queryParams = {
      startDate: firstDay,  // *** UTC дата ***
      endDate: lastDay,     // *** UTC дата ***
      currentUserID: managerId,
      staffGroupID: groupId,
      employeeID: employeeId
    };

    const result = await this.staffRecordsService.getAllStaffRecordsForTimetable(queryParams);
    
    if (result.error) {
      throw new Error(result.error);
    }

    // Фильтруем записи как в Schedule tab
    const filteredRecords = result.records.filter((record: IStaffRecord) => {
      // 1. Исключаем удаленные записи
      if (record.Deleted === 1) {
        return false;
      }

      // 2. Дополнительная фильтрация по контракту (если нужно)
      // В Schedule tab может быть дополнительная фильтрация по WeeklyTimeTableID
      if (contractId && record.WeeklyTimeTableID && record.WeeklyTimeTableID !== contractId) {
        console.log(`[CommonFillValidation] Filtering out record with different contract: ${record.WeeklyTimeTableID} !== ${contractId}`);
        return false;
      }

      return true;
    });

    console.log(`[CommonFillValidation] Schedule tab filtering result with UTC: ${result.records.length} total → ${filteredRecords.length} filtered`);

    return filteredRecords;
  }

  /**
   * *** НОВЫЙ МЕТОД: Определяет тип диалога как в Schedule tab ***
   */
  private determineDialogType(existingRecords: IStaffRecord[], processingStatus: ReturnType<typeof this.checkRecordsProcessingStatus>): IDialogConfig {
    console.log('[CommonFillValidation] Determining dialog type like Schedule tab:', {
      recordsCount: existingRecords.length,
      processedCount: processingStatus.processedCount,
      unprocessedCount: processingStatus.unprocessedCount
    });

    // *** СЦЕНАРИЙ 1: НЕТ ЗАПИСЕЙ → EmptySchedule диалог ***
    if (existingRecords.length === 0) {
      console.log('[CommonFillValidation] No records found → EmptySchedule dialog');
      return {
        type: DialogType.EmptySchedule,
        title: 'Fill Schedule',
        message: 'Do you want to fill the schedule based on template data?',
        confirmButtonText: 'Fill',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#107c10' // Зеленый цвет (безопасная операция)
      };
    }

    // *** СЦЕНАРИЙ 2: ЕСТЬ ОБРАБОТАННЫЕ ЗАПИСИ → ProcessedRecordsBlock диалог ***
    if (processingStatus.hasProcessedRecords) {
      console.log('[CommonFillValidation] Found processed records → ProcessedRecordsBlock dialog');
      return {
        type: DialogType.ProcessedRecordsBlock,
        title: 'Cannot Replace Records',
        message: `Found ${processingStatus.processedCount} processed records. Manual review required.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#d83b01' // Красный цвет (блокировка)
      };
    }

    // *** СЦЕНАРИЙ 3: ТОЛЬКО НЕОБРАБОТАННЫЕ ЗАПИСИ → UnprocessedRecordsReplace диалог ***
    console.log('[CommonFillValidation] Found only unprocessed records → UnprocessedRecordsReplace dialog');
    return {
      type: DialogType.UnprocessedRecordsReplace,
      title: 'Replace Schedule Records',
      message: `Found ${existingRecords.length} existing unprocessed records. Replace them?`,
      confirmButtonText: 'Replace',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#d83b01' // Оранжевый цвет (предупреждение)
    };
  }

  /**
   * Удаляет существующие записи (помечает как удаленные)
   */
  public async deleteExistingRecords(existingRecords: IStaffRecord[]): Promise<boolean> {
    console.log(`[CommonFillValidation] Deleting ${existingRecords.length} existing records`);

    try {
      let successCount = 0;

      for (const record of existingRecords) {
        try {
          const success = await this.staffRecordsService.markRecordAsDeleted(record.ID);
          if (success) {
            successCount++;
            console.log(`[CommonFillValidation] ✓ Successfully deleted record ID: ${record.ID}`);
          } else {
            console.error(`[CommonFillValidation] ✗ Failed to delete record ID: ${record.ID}`);
          }
        } catch (error) {
          console.error(`[CommonFillValidation] ✗ Error deleting record ID ${record.ID}:`, error);
        }

        // Небольшая пауза между операциями удаления
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[CommonFillValidation] Delete operation completed: ${successCount}/${existingRecords.length} successful`);
      return successCount === existingRecords.length;

    } catch (error) {
      console.error('[CommonFillValidation] Error deleting existing records:', error);
      return false;
    }
  }

  /**
   * *** ИСПРАВЛЕНО: Проверяет активность контракта в указанном месяце с UTC ***
   */
  public isContractActiveInMonth(contract: IContract, date: Date): boolean {
    if (!contract.startDate) {
      console.log(`[CommonFillValidation] Contract ${contract.id} has no start date - excluding`);
      return false;
    }

    // *** ИСПРАВЛЕНО: Используем UTC методы для создания границ месяца ***
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

    console.log(`[CommonFillValidation] *** UTC CONTRACT VALIDATION ***`);
    console.log(`[CommonFillValidation] Month boundaries (UTC): ${firstDayOfMonth.toISOString()} - ${lastDayOfMonth.toISOString()}`);
    console.log(`[CommonFillValidation] Contract ${contract.id} dates: ${contract.startDate ? new Date(contract.startDate).toISOString() : 'no start'} - ${contract.finishDate ? new Date(contract.finishDate).toISOString() : 'no end'}`);

    // *** ИСПРАВЛЕНО: Нормализуем дату начала контракта к UTC ***
    const startDate = new Date(contract.startDate);
    const startDateUTC = new Date(Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate(),
      0, 0, 0, 0
    ));

    // Проверяем дату начала контракта
    if (startDateUTC > lastDayOfMonth) {
      console.log(`[CommonFillValidation] Contract ${contract.id} starts after selected month - excluding`);
      console.log(`[CommonFillValidation] Contract start (UTC): ${startDateUTC.toISOString()}, Month end (UTC): ${lastDayOfMonth.toISOString()}`);
      return false;
    }

    // Если нет даты окончания, контракт активен
    if (!contract.finishDate) {
      console.log(`[CommonFillValidation] Contract ${contract.id} is open-ended and starts before/in selected month - including`);
      return true;
    }

    // *** ИСПРАВЛЕНО: Нормализуем дату окончания контракта к UTC ***
    const finishDate = new Date(contract.finishDate);
    const finishDateUTC = new Date(Date.UTC(
      finishDate.getUTCFullYear(),
      finishDate.getUTCMonth(),
      finishDate.getUTCDate(),
      23, 59, 59, 999
    ));

    // Проверяем дату окончания контракта
    const isActive = finishDateUTC >= firstDayOfMonth;
    console.log(`[CommonFillValidation] Contract ${contract.id} validation result with UTC:`, {
      contractStart: startDateUTC.toISOString(),
      contractEnd: finishDateUTC.toISOString(),
      monthStart: firstDayOfMonth.toISOString(),
      monthEnd: lastDayOfMonth.toISOString(),
      isActive: isActive
    });
    
    return isActive;
  }

  /**
   * *** РАСШИРЕННАЯ ВАЛИДАЦИЯ: Включает проверки для автозаполнения ***
   */
  public validateFillParams(params: IFillParams): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.staffMember.employeeId) {
      errors.push('Staff member has no employee ID');
    }

    if (!params.currentUserId || params.currentUserId === '0' || params.currentUserId.trim() === '') {
      errors.push('Invalid or missing currentUserId');
    }
    
    if (!params.managingGroupId || params.managingGroupId === '0' || params.managingGroupId.trim() === '') {
      errors.push('Invalid or missing managingGroupId');
    }

    if (!params.selectedDate || isNaN(params.selectedDate.getTime())) {
      errors.push('Invalid selected date');
    }

    if (!params.context) {
      errors.push('Missing WebPart context');
    }

    // *** НОВАЯ ВАЛИДАЦИЯ: Проверяем что дата может быть конвертирована в UTC ***
    try {
      if (params.selectedDate) {
        const utcTest = params.selectedDate.toISOString();
        console.log(`[CommonFillValidation] Date UTC validation passed: ${utcTest}`);
      }
    } catch {
      errors.push('Selected date cannot be converted to UTC format');
    }

    // *** ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ ДЛЯ АВТОЗАПОЛНЕНИЯ ***
    if (params.staffMember.autoSchedule !== undefined) {
      console.log(`[CommonFillValidation] Auto Schedule status for ${params.staffMember.name}: ${params.staffMember.autoSchedule}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * *** РАСШИРЕННАЯ ПРОВЕРКА: Статус обработки записей с детальным анализом ***
   */
  public checkRecordsProcessingStatus(records: IStaffRecord[]): {
    processedCount: number;
    unprocessedCount: number;
    hasProcessedRecords: boolean;
    hasUnprocessedRecords: boolean;
    processedRecordsDetails: Array<{
      id: string;
      date: string;
      checked: number;
      exportResult: string;
      processingType: 'CHECKED' | 'EXPORTED' | 'BOTH';
    }>;
  } {
    let processedCount = 0;
    let unprocessedCount = 0;
    const processedRecordsDetails: Array<{
      id: string;
      date: string;
      checked: number;
      exportResult: string;
      processingType: 'CHECKED' | 'EXPORTED' | 'BOTH';
    }> = [];

    records.forEach((record: IStaffRecord) => {
      const isChecked = record.Checked && record.Checked > 0;
      const isExported = record.ExportResult && record.ExportResult.trim() !== '' && record.ExportResult !== '0';
      const isProcessed = isChecked || isExported;
      
      if (isProcessed) {
        processedCount++;
        
        // Определяем тип обработки
        let processingType: 'CHECKED' | 'EXPORTED' | 'BOTH';
        if (isChecked && isExported) {
          processingType = 'BOTH';
        } else if (isChecked) {
          processingType = 'CHECKED';
        } else {
          processingType = 'EXPORTED';
        }
        
        processedRecordsDetails.push({
          id: record.ID,
          date: record.Date ? record.Date.toLocaleDateString() : 'N/A',
          checked: record.Checked || 0,
          exportResult: record.ExportResult || 'N/A',
          processingType
        });
        
        console.log(`[CommonFillValidation] Processed record ID=${record.ID}: Checked=${record.Checked}, ExportResult="${record.ExportResult}", Type=${processingType}`);
      } else {
        unprocessedCount++;
      }
    });

    const result = {
      processedCount,
      unprocessedCount,
      hasProcessedRecords: processedCount > 0,
      hasUnprocessedRecords: unprocessedCount > 0,
      processedRecordsDetails
    };

    console.log('[CommonFillValidation] Enhanced processing status analysis:', {
      total: records.length,
      processed: result.processedCount,
      unprocessed: result.unprocessedCount,
      processedDetailsCount: result.processedRecordsDetails.length
    });

    return result;
  }

  /**
   * *** НОВЫЙ МЕТОД: Специальная валидация для автозаполнения с учетом autoschedule ***
   */
  public validateAutoScheduleConditions(params: IFillParams): { 
    isValid: boolean; 
    errors: string[]; 
    autoScheduleEnabled: boolean;
    canProceedWithAutoFill: boolean;
  } {
    console.log('[CommonFillValidation] Validating AutoSchedule conditions for:', params.staffMember.name);
    
    const errors: string[] = [];
    const autoScheduleEnabled = params.staffMember.autoSchedule || false;

    // Базовая валидация
    const baseValidation = this.validateFillParams(params);
    if (!baseValidation.isValid) {
      errors.push(...baseValidation.errors);
    }

    // Специфичная для автозаполнения валидация
    if (!autoScheduleEnabled) {
      errors.push('Auto Schedule must be enabled for automatic fill operations');
    }

    // Проверка наличия необходимых данных для автозаполнения
    if (!params.staffMember.id || params.staffMember.id.trim() === '') {
      errors.push('Staff member ID is required for auto-fill');
    }

    if (!params.staffMember.name || params.staffMember.name.trim() === '') {
      errors.push('Staff member name is required for auto-fill');
    }

    const canProceedWithAutoFill = errors.length === 0 && autoScheduleEnabled;

    console.log('[CommonFillValidation] AutoSchedule validation result:', {
      isValid: errors.length === 0,
      autoScheduleEnabled,
      canProceedWithAutoFill,
      errorsCount: errors.length,
      staffMember: params.staffMember.name
    });

    return {
      isValid: errors.length === 0,
      errors,
      autoScheduleEnabled,
      canProceedWithAutoFill
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Получение детальной информации о processed records для логирования ***
   */
  public async getProcessedRecordsDetails(params: IFillParams): Promise<{
    hasProcessedRecords: boolean;
    processedRecords: IStaffRecord[];
    summary: {
      totalProcessed: number;
      checkedOnly: number;
      exportedOnly: number;
      both: number;
      dateRange: {
        earliest: string;
        latest: string;
      };
    };
  }> {
    try {
      const existingCheck = await this.checkExistingRecords(params);
      
      if (!existingCheck.hasProcessedRecords) {
        return {
          hasProcessedRecords: false,
          processedRecords: [],
          summary: {
            totalProcessed: 0,
            checkedOnly: 0,
            exportedOnly: 0,
            both: 0,
            dateRange: {
              earliest: 'N/A',
              latest: 'N/A'
            }
          }
        };
      }

      // Фильтруем обработанные записи
      const processedRecords = existingCheck.existingRecords.filter((record: IStaffRecord) => {
        return (record.Checked && record.Checked > 0) || 
               (record.ExportResult && record.ExportResult.trim() !== '' && record.ExportResult !== '0');
      });

      // Анализируем типы обработки
      let checkedOnly = 0;
      let exportedOnly = 0;
      let both = 0;

      const dates: Date[] = [];

      processedRecords.forEach(record => {
        const isChecked = record.Checked && record.Checked > 0;
        const isExported = record.ExportResult && record.ExportResult.trim() !== '' && record.ExportResult !== '0';

        if (isChecked && isExported) {
          both++;
        } else if (isChecked) {
          checkedOnly++;
        } else if (isExported) {
          exportedOnly++;
        }

        if (record.Date) {
          dates.push(record.Date);
        }
      });

      // Определяем диапазон дат
      dates.sort((a, b) => a.getTime() - b.getTime());
      const earliest = dates.length > 0 ? dates[0].toLocaleDateString() : 'N/A';
      const latest = dates.length > 0 ? dates[dates.length - 1].toLocaleDateString() : 'N/A';

      const result = {
        hasProcessedRecords: true,
        processedRecords,
        summary: {
          totalProcessed: processedRecords.length,
          checkedOnly,
          exportedOnly,
          both,
          dateRange: {
            earliest,
            latest
          }
        }
      };

      console.log('[CommonFillValidation] Processed records detailed analysis:', result.summary);

      return result;

    } catch (error) {
      console.error('[CommonFillValidation] Error getting processed records details:', error);
      
      return {
        hasProcessedRecords: false,
        processedRecords: [],
        summary: {
          totalProcessed: 0,
          checkedOnly: 0,
          exportedOnly: 0,
          both: 0,
          dateRange: {
            earliest: 'Error',
            latest: 'Error'
          }
        }
      };
    }
  }
}