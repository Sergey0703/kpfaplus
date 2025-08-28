// src/webparts/kpfaplus/services/CommonFillValidation.ts
// ИСПРАВЛЕНО: StaffRecords.Date теперь Date-only field с правильной обработкой периодов запросов
// ДОБАВЛЕНО: Поддержка автозаполнения и специальная валидация для staff с autoschedule
// FIXED: TypeScript lint error - replaced require with proper ES6 import

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { IContract } from '../models/IContract';
import { IStaffMember } from '../models/types';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { RemoteSiteService } from './RemoteSiteService';

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
      exportResult: number;
    }>;
  };
}

export class CommonFillValidation {
  private staffRecordsService: StaffRecordsService;
  private dateUtils: CommonFillDateUtils;

  constructor(context: WebPartContext) {
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    // FIXED: Replaced require statement with proper ES6 import
    const remoteSiteService = RemoteSiteService.getInstance(context);
    this.dateUtils = new CommonFillDateUtils(remoteSiteService);
    console.log('[CommonFillValidation] Service initialized - ИСПРАВЛЕНО: StaffRecords.Date правильная обработка периодов запросов');
  }

  /**
   * *** ИСПРАВЛЕНО: Checks existing StaffRecords с правильными периодами для Date-only field ***
   */
  public async checkExistingRecords(params: IFillParams): Promise<IExistingRecordsCheck> {
    console.log('[CommonFillValidation] ИСПРАВЛЕНО: Checking existing StaffRecords с правильными периодами для Date-only field:', params.staffMember.name);

    try {
      // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для правильного расчета периода ***
      const periodInfo = this.dateUtils.calculateMonthPeriod(params.selectedDate);

      console.log(`[CommonFillValidation] *** ИСПРАВЛЕНО: StaffRecords Date-only field query с правильными границами ***`);
      console.log(`[CommonFillValidation] Исправленный период: ${this.dateUtils.formatDateOnlyForDisplay(periodInfo.firstDay)} - ${this.dateUtils.formatDateOnlyForDisplay(periodInfo.lastDay)}`);
      console.log(`[CommonFillValidation] StaffRecords.Date теперь Date-only field - используем правильный подход к запросам`);

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
      
      // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для создания правильных Date-only дат для запроса ***
      // Создаем Date-only даты которые НЕ будут сдвинуты SharePoint
      const startDateForQuery = this.dateUtils.createDateOnlyFromDate(periodInfo.firstDay);
      const endDateForQuery = this.dateUtils.createDateOnlyFromDate(periodInfo.lastDay);
      
      const queryParams = {
        startDate: startDateForQuery,  // *** Date-only field - правильный Date объект ***
        endDate: endDateForQuery,      // *** Date-only field - правильный Date объект ***
        currentUserID: managerId,
        staffGroupID: groupId,
        employeeID: employeeId,
      };

      console.log('[CommonFillValidation] ИСПРАВЛЕНО: StaffRecords query params с правильными Date-only границами:', {
        startDate: this.dateUtils.formatDateOnlyForDisplay(queryParams.startDate),
        endDate: this.dateUtils.formatDateOnlyForDisplay(queryParams.endDate),
        employeeID: queryParams.employeeID,
        managerId: queryParams.currentUserID,
        groupId: queryParams.staffGroupID,
        originalSelectedDate: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)
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

      console.log(`[CommonFillValidation] ИСПРАВЛЕНО: Found ${allRecords.length} total StaffRecords, ${existingRecords.length} active для правильного периода`);

      // Проверяем, есть ли обработанные записи
      const processedRecords = existingRecords.filter((record: IStaffRecord) => {
        const isProcessed = (record.Checked && record.Checked > 0) || 
                           (record.ExportResult && record.ExportResult>0);
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

      console.log('[CommonFillValidation] ИСПРАВЛЕНО: StaffRecords check result с правильными Date-only границами:', {
        hasExisting: result_check.hasExistingRecords,
        totalActive: result_check.recordsCount,
        hasProcessed: result_check.hasProcessedRecords,
        processedCount: result_check.processedCount,
        period: `${this.dateUtils.formatDateOnlyForDisplay(periodInfo.firstDay)} - ${this.dateUtils.formatDateOnlyForDisplay(periodInfo.lastDay)}`
      });

      return result_check;

    } catch (error) {
      console.error('[CommonFillValidation] ИСПРАВЛЕНО: Error checking existing StaffRecords с правильными периодами:', error);
      throw new Error(`Failed to check existing records: ${error}`);
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Валидация специально для автозаполнения ***
   */
  public async validateAutoFillConditions(params: IFillParams): Promise<IAutoFillValidationResult> {
    console.log('[CommonFillValidation] Validating auto-fill conditions with Date-only StaffRecords for:', params.staffMember.name);
    console.log('[CommonFillValidation] Auto-fill validation parameters:', {
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      selectedDate: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate),
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

      // *** ПРОВЕРКА 3: Существующие записи StaffRecords (Date-only field) с особой логикой для автозаполнения ***
      let hasProcessedRecords = false;
      let existingRecordsCount = 0;
      let processedRecordsCount = 0;

      if (basicValidation.isValid) {
        try {
          const existingCheck = await this.checkExistingRecords(params);
          existingRecordsCount = existingCheck.recordsCount;
          hasProcessedRecords = existingCheck.hasProcessedRecords;
          processedRecordsCount = existingCheck.processedCount;

          console.log('[CommonFillValidation] Auto-fill existing StaffRecords analysis с правильными Date-only boundaries:', {
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
          errors.push(`Error checking existing StaffRecords: ${recordsError}`);
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

      console.log('[CommonFillValidation] Auto-fill validation result с правильными Date-only StaffRecords:', {
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
    console.log('[CommonFillValidation] Checking auto-fill safety with detailed processed StaffRecords analysis');

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
               (record.ExportResult && record.ExportResult>0);
      });

      const processedRecordsDetails = {
        count: processedRecords.length,
        examples: processedRecords.slice(0, 5).map(record => ({
          id: record.ID,
          date: record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A',
          checked: record.Checked || 0,
          exportResult: record.ExportResult || 0
        }))
      };

      console.log('[CommonFillValidation] Auto-fill safety check - found processed StaffRecords:', processedRecordsDetails);

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
   * *** ОСНОВНОЙ МЕТОД: Реализует логику Schedule tab для проверки StaffRecords и определения диалога ***
   */
  public async checkExistingRecordsWithScheduleLogic(params: IFillParams, contractId: string): Promise<IScheduleLogicResult> {
    console.log('[CommonFillValidation] ИСПРАВЛЕНО: Implementing Schedule tab logic с правильными Date-only StaffRecords для:', {
      staffMember: params.staffMember.name,
      contractId,
      period: this.dateUtils.formatDateOnlyForDisplay(params.selectedDate)
    });

    try {
      // *** ШАГ 1: ПОЛУЧЕНИЕ СУЩЕСТВУЮЩИХ StaffRecords с правильной фильтрацией ***
      const existingRecords = await this.getExistingRecordsWithStatus(params, contractId);
      
      console.log(`[CommonFillValidation] ИСПРАВЛЕНО: Schedule logic found ${existingRecords.length} existing StaffRecords с правильными границами`);

      // *** ШАГ 2: АНАЛИЗ СТАТУСА ЗАПИСЕЙ ***
      const processingStatus = this.checkRecordsProcessingStatus(existingRecords);
      
      console.log('[CommonFillValidation] StaffRecords processing status:', {
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
      console.error('[CommonFillValidation] ИСПРАВЛЕНО: Error in Schedule logic с правильными Date-only StaffRecords:', error);
      
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
   * *** ИСПРАВЛЕНО: Gets existing StaffRecords с правильной обработкой Date-only field ***
   */
  private async getExistingRecordsWithStatus(params: IFillParams, contractId: string): Promise<IStaffRecord[]> {
    console.log('[CommonFillValidation] ИСПРАВЛЕНО: Getting existing StaffRecords с правильной Schedule tab filtering logic');

    // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Используем dateUtils для СОЗДАНИЯ UTC ДАТ ДЛЯ ЗАПРОСА ***
    const selectedDate = params.selectedDate;
    const startOfMonthUTC = this.dateUtils.createUTCDateOnly(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
    );
    const endOfMonthUTC = this.dateUtils.createUTCDateOnly(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    );

    console.log(`[CommonFillValidation] *** ИСПРАВЛЕНО: StaffRecords Date-only field filtering с UTC границами ***`);
    console.log(`[CommonFillValidation] Исправленный UTC период: ${startOfMonthUTC.toISOString()} - ${endOfMonthUTC.toISOString()}`);
    
    if (!params.staffMember.employeeId) {
      console.warn('[CommonFillValidation] No employee ID for Schedule tab filtering');
      return [];
    }

    const employeeId = params.staffMember.employeeId;
    const managerId = params.currentUserId || '0';
    const groupId = params.managingGroupId || '0';

    const queryParams = {
      startDate: startOfMonthUTC,  // <-- ИСПОЛЬЗУЕМ UTC ДАТУ
      endDate: endOfMonthUTC,      // <-- ИСПОЛЬЗУЕМ UTC ДАТУ
      currentUserID: managerId,
      staffGroupID: groupId,
      employeeID: employeeId
    };

    console.log('[CommonFillValidation] ИСПРАВЛЕНО: Schedule tab query params с UTC границами:', {
      startDate: queryParams.startDate.toISOString(),
      endDate: queryParams.endDate.toISOString(),
      employeeID: queryParams.employeeID,
      contractId
    });

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
      if (contractId && record.WeeklyTimeTableID && record.WeeklyTimeTableID !== contractId) {
        console.log(`[CommonFillValidation] Filtering out record with different contract: ${record.WeeklyTimeTableID} !== ${contractId}`);
        return false;
      }

      return true;
    });

    console.log(`[CommonFillValidation] ИСПРАВЛЕНО: Schedule tab StaffRecords filtering result с UTC границами: ${result.records.length} total → ${filteredRecords.length} filtered`);

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
      console.log('[CommonFillValidation] No StaffRecords found → EmptySchedule dialog');
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
      console.log('[CommonFillValidation] Found processed StaffRecords → ProcessedRecordsBlock dialog');
      return {
        type: DialogType.ProcessedRecordsBlock,
        title: 'Cannot Replace Records',
        message: `Found ${processingStatus.processedCount} processed records. Manual review required.`,
        confirmButtonText: 'OK',
        confirmButtonColor: '#d83b01' // Красный цвет (блокировка)
      };
    }

    // *** СЦЕНАРИЙ 3: ТОЛЬКО НЕОБРАБОТАННЫЕ ЗАПИСИ → UnprocessedRecordsReplace диалог ***
    console.log('[CommonFillValidation] Found only unprocessed StaffRecords → UnprocessedRecordsReplace dialog');
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
   * Удаляет существующие записи StaffRecords (помечает как удаленные)
   */
  public async deleteExistingRecords(existingRecords: IStaffRecord[]): Promise<boolean> {
    console.log(`[CommonFillValidation] Deleting ${existingRecords.length} existing StaffRecords`);

    try {
      let successCount = 0;

      for (const record of existingRecords) {
        try {
          const success = await this.staffRecordsService.markRecordAsDeleted(record.ID);
          if (success) {
            successCount++;
            console.log(`[CommonFillValidation] ✓ Successfully deleted StaffRecord ID: ${record.ID}`);
          } else {
            console.error(`[CommonFillValidation] ✗ Failed to delete StaffRecord ID: ${record.ID}`);
          }
        } catch (error) {
          console.error(`[CommonFillValidation] ✗ Error deleting StaffRecord ID ${record.ID}:`, error);
        }

        // Небольшая пауза между операциями удаления
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      console.log(`[CommonFillValidation] StaffRecords delete operation completed: ${successCount}/${existingRecords.length} successful`);
      return successCount === existingRecords.length;

    } catch (error) {
      console.error('[CommonFillValidation] Error deleting existing StaffRecords:', error);
      return false;
    }
  }

  /**
   * *** ИСПРАВЛЕНО: Checks contract activity in specified month с правильной Date-only поддержкой ***
   */
  public isContractActiveInMonth(contract: IContract, date: Date): boolean {
    if (!contract.startDate) {
      console.log(`[CommonFillValidation] Contract ${contract.id} has no start date - excluding`);
      return false;
    }

    // *** ИСПРАВЛЕНО: Используем dateUtils для создания правильных month boundaries ***
    const periodInfo = this.dateUtils.calculateMonthPeriod(date);
    const firstDayOfMonth = periodInfo.firstDay;
    const lastDayOfMonth = periodInfo.lastDay;

    console.log(`[CommonFillValidation] *** ИСПРАВЛЕНО: Date-only contract validation с правильными границами ***`);
    console.log(`[CommonFillValidation] Month boundaries (правильные Date-only): ${this.dateUtils.formatDateOnlyForDisplay(firstDayOfMonth)} - ${this.dateUtils.formatDateOnlyForDisplay(lastDayOfMonth)}`);
    console.log(`[CommonFillValidation] Contract ${contract.id} dates: ${contract.startDate ? this.dateUtils.formatDateOnlyForDisplay(new Date(contract.startDate)) : 'no start'} - ${contract.finishDate ? this.dateUtils.formatDateOnlyForDisplay(new Date(contract.finishDate)) : 'no end'}`);

    // *** ИСПРАВЛЕНО: Используем dateUtils для нормализации contract dates ***
    const startDate = new Date(contract.startDate);
    const startDateOnly = this.dateUtils.createDateOnlyFromDate(startDate);

    // Check contract start date
    if (startDateOnly > lastDayOfMonth) {
      console.log(`[CommonFillValidation] Contract ${contract.id} starts after selected month - excluding`);
      console.log(`[CommonFillValidation] Contract start (Date-only): ${this.dateUtils.formatDateOnlyForDisplay(startDateOnly)}, Month end (Date-only): ${this.dateUtils.formatDateOnlyForDisplay(lastDayOfMonth)}`);
      return false;
    }

    // If no finish date, contract is active
    if (!contract.finishDate) {
      console.log(`[CommonFillValidation] Contract ${contract.id} is open-ended and starts before/in selected month - including`);
      return true;
    }

    // *** ИСПРАВЛЕНО: Используем dateUtils для нормализации contract finish date ***
    const finishDate = new Date(contract.finishDate);
    const finishDateOnly = this.dateUtils.createDateOnlyFromDate(finishDate);

    // Check contract finish date
    const isActive = finishDateOnly >= firstDayOfMonth;
    
    console.log(`[CommonFillValidation] ИСПРАВЛЕНО: Contract ${contract.id} validation result с правильной Date-only поддержкой:`, {
      contractStart: this.dateUtils.formatDateOnlyForDisplay(startDateOnly),
      contractEnd: this.dateUtils.formatDateOnlyForDisplay(finishDateOnly),
      monthStart: this.dateUtils.formatDateOnlyForDisplay(firstDayOfMonth),
      monthEnd: this.dateUtils.formatDateOnlyForDisplay(lastDayOfMonth),
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

    // *** ИСПРАВЛЕНО: Проверяем что дата может быть правильно обработана в Date-only формате ***
    try {
      if (params.selectedDate) {
        const dateOnlyTest = this.dateUtils.formatDateOnlyForDisplay(params.selectedDate);
        const periodTest = this.dateUtils.calculateMonthPeriod(params.selectedDate);
        console.log(`[CommonFillValidation] ИСПРАВЛЕНО: Date-only validation passed: ${dateOnlyTest}, period: ${this.dateUtils.formatDateOnlyForDisplay(periodTest.firstDay)} - ${this.dateUtils.formatDateOnlyForDisplay(periodTest.lastDay)}`);
      }
    } catch {
      errors.push('Selected date cannot be converted to Date-only format or period calculation failed');
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
   * *** РАСШИРЕННАЯ ПРОВЕРКА: Статус обработки StaffRecords с детальным анализом ***
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
      exportResult: number;
      processingType: 'CHECKED' | 'EXPORTED' | 'BOTH';
    }>;
  } {
    let processedCount = 0;
    let unprocessedCount = 0;
    const processedRecordsDetails: Array<{
      id: string;
      date: string;
      checked: number;
      exportResult: number;
      processingType: 'CHECKED' | 'EXPORTED' | 'BOTH';
    }> = [];

    records.forEach((record: IStaffRecord) => {
      const isChecked = record.Checked && record.Checked > 0;
      const isExported = record.ExportResult && record.ExportResult>0;
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
          date: record.Date ? this.dateUtils.formatDateOnlyForDisplay(record.Date) : 'N/A',
          checked: record.Checked || 0,
          exportResult: record.ExportResult || 0,
          processingType
        });
        
        console.log(`[CommonFillValidation] Processed StaffRecord ID=${record.ID}: Checked=${record.Checked}, ExportResult="${record.ExportResult}", Type=${processingType}`);
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

    console.log('[CommonFillValidation] Enhanced StaffRecords processing status analysis:', {
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
    console.log('[CommonFillValidation] Validating AutoSchedule conditions с правильными Date-only StaffRecords для:', params.staffMember.name);
    
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

    console.log('[CommonFillValidation] AutoSchedule validation result с правильными Date-only StaffRecords:', {
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
   * *** НОВЫЙ МЕТОД: Получение детальной информации о processed StaffRecords для логирования ***
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
               (record.ExportResult && record.ExportResult>0);
      });

      // Анализируем типы обработки
      let checkedOnly = 0;
      let exportedOnly = 0;
      let both = 0;

      const dates: Date[] = [];

      processedRecords.forEach(record => {
        const isChecked = record.Checked && record.Checked > 0;
        const isExported = record.ExportResult && record.ExportResult>0;

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

      // Определяем диапазон дат с Date-only форматированием
      dates.sort((a, b) => a.getTime() - b.getTime());
      const earliest = dates.length > 0 ? this.dateUtils.formatDateOnlyForDisplay(dates[0]) : 'N/A';
      const latest = dates.length > 0 ? this.dateUtils.formatDateOnlyForDisplay(dates[dates.length - 1]) : 'N/A';

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

      console.log('[CommonFillValidation] Processed StaffRecords detailed analysis:', result.summary);

      return result;

    } catch (error) {
      console.error('[CommonFillValidation] Error getting processed StaffRecords details:', error);
      
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