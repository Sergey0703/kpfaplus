// src/webparts/kpfaplus/services/CommonFillValidation.ts
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

export class CommonFillValidation {
  private staffRecordsService: StaffRecordsService;

  constructor(context: WebPartContext) {
    this.staffRecordsService = StaffRecordsService.getInstance(context);
  }

  /**
   * Проверяет существующие записи для сотрудника в указанном периоде
   */
  public async checkExistingRecords(params: IFillParams): Promise<IExistingRecordsCheck> {
    console.log('[CommonFillValidation] Checking existing records for staff:', params.staffMember.name);

    try {
      // Определяем период (весь месяц выбранной даты)
      const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
      const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);

      console.log(`[CommonFillValidation] Checking period: ${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`);

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
        startDate: startOfMonth,
        endDate: endOfMonth,
        currentUserID: managerId,
        staffGroupID: groupId,
        employeeID: employeeId,
      };

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

      console.log(`[CommonFillValidation] Found ${allRecords.length} total records, ${existingRecords.length} active (not deleted)`);

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

      console.log('[CommonFillValidation] Existing records check result:', {
        hasExisting: result_check.hasExistingRecords,
        totalActive: result_check.recordsCount,
        hasProcessed: result_check.hasProcessedRecords,
        processedCount: result_check.processedCount
      });

      return result_check;

    } catch (error) {
      console.error('[CommonFillValidation] Error checking existing records:', error);
      throw new Error(`Failed to check existing records: ${error}`);
    }
  }

  /**
   * *** ОСНОВНОЙ МЕТОД: Реализует логику Schedule tab для проверки записей и определения диалога ***
   */
  public async checkExistingRecordsWithScheduleLogic(params: IFillParams, contractId: string): Promise<IScheduleLogicResult> {
    console.log('[CommonFillValidation] Implementing Schedule tab logic for:', {
      staffMember: params.staffMember.name,
      contractId,
      period: params.selectedDate.toLocaleDateString()
    });

    try {
      // *** ШАГ 1: ПОЛУЧЕНИЕ СУЩЕСТВУЮЩИХ ЗАПИСЕЙ С ФИЛЬТРАЦИЕЙ КАК В SCHEDULE TAB ***
      const existingRecords = await this.getExistingRecordsWithStatus(params, contractId);
      
      console.log(`[CommonFillValidation] Schedule logic found ${existingRecords.length} existing records`);

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
      console.error('[CommonFillValidation] Error in Schedule logic:', error);
      
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
   * *** НОВЫЙ МЕТОД: Получает существующие записи с тем же фильтром что и Schedule tab ***
   */
  private async getExistingRecordsWithStatus(params: IFillParams, contractId: string): Promise<IStaffRecord[]> {
    console.log('[CommonFillValidation] Getting existing records with Schedule tab filtering logic');

    // Определяем период с учетом контракта (как в Schedule tab)
    const startOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth(), 1);
    const endOfMonth = new Date(params.selectedDate.getFullYear(), params.selectedDate.getMonth() + 1, 0);

    // Корректируем период с учетом дат действия контракта (если нужно)
    const firstDay = startOfMonth;
    const lastDay = endOfMonth;

    console.log(`[CommonFillValidation] Schedule tab filtering period: ${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`);

    if (!params.staffMember.employeeId) {
      console.warn('[CommonFillValidation] No employee ID for Schedule tab filtering');
      return [];
    }

    const employeeId = params.staffMember.employeeId;
    const managerId = params.currentUserId || '0';
    const groupId = params.managingGroupId || '0';

    console.log('[CommonFillValidation] Schedule tab filter criteria:', {
      employeeId,
      managerId,
      groupId,
      contractId,
      period: `${firstDay.toLocaleDateString()} - ${lastDay.toLocaleDateString()}`
    });

    // Используем тот же запрос что и Schedule tab
    const queryParams = {
      startDate: firstDay,
      endDate: lastDay,
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

    console.log(`[CommonFillValidation] Schedule tab filtering result: ${result.records.length} total → ${filteredRecords.length} filtered`);

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
   * Проверяет, активен ли контракт в указанном месяце
   */
  public isContractActiveInMonth(contract: IContract, date: Date): boolean {
    if (!contract.startDate) {
      console.log(`[CommonFillValidation] Contract ${contract.id} has no start date - excluding`);
      return false;
    }

    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    firstDayOfMonth.setHours(0, 0, 0, 0);
    lastDayOfMonth.setHours(23, 59, 59, 999);

    const startDate = new Date(contract.startDate);
    startDate.setHours(0, 0, 0, 0);

    // Проверяем дату начала контракта
    if (startDate > lastDayOfMonth) {
      console.log(`[CommonFillValidation] Contract ${contract.id} starts after selected month - excluding`);
      return false;
    }

    // Если нет даты окончания, контракт активен
    if (!contract.finishDate) {
      console.log(`[CommonFillValidation] Contract ${contract.id} is open-ended and starts before/in selected month - including`);
      return true;
    }

    const finishDate = new Date(contract.finishDate);
    finishDate.setHours(23, 59, 59, 999);

    // Проверяем дату окончания контракта
    const isActive = finishDate >= firstDayOfMonth;
    console.log(`[CommonFillValidation] Contract ${contract.id} ends ${finishDate.toLocaleDateString()} - ${isActive ? 'including' : 'excluding'}`);
    
    return isActive;
  }

  /**
   * Валидирует входные параметры для операции заполнения
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

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Проверяет статус обработки записей (как в Schedule tab)
   */
  public checkRecordsProcessingStatus(records: IStaffRecord[]): {
    processedCount: number;
    unprocessedCount: number;
    hasProcessedRecords: boolean;
    hasUnprocessedRecords: boolean;
  } {
    let processedCount = 0;
    let unprocessedCount = 0;

    records.forEach((record: IStaffRecord) => {
      const isProcessed = (record.Checked && record.Checked > 0) || 
                         (record.ExportResult && record.ExportResult.trim() !== '' && record.ExportResult !== '0');
      
      if (isProcessed) {
        processedCount++;
      } else {
        unprocessedCount++;
      }
    });

    return {
      processedCount,
      unprocessedCount,
      hasProcessedRecords: processedCount > 0,
      hasUnprocessedRecords: unprocessedCount > 0
    };
  }
}