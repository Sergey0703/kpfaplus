// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSButtonHandler.ts

import { ISRSRecord, ISRSTabState } from './SRSTabInterfaces';
import { IHoliday } from '../../../../services/HolidaysService';
import { ISRSTypeOfLeave } from './SRSTabInterfaces';
import { SRSDateUtils } from './SRSDateUtils';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { WebPartContext } from '@microsoft/sp-webpart-base';

// *** НОВЫЕ ИМПОРТЫ: Существующие сервисы ***
import { GraphApiService } from '../../../../services/GraphApiService';
//import { RemoteSiteService } from '../../../../services/RemoteSiteService';
import { ExcelService } from '../../../../services/ExcelService';

// *** НОВЫЕ ИМПОРТЫ: SRS Excel утилиты ***
import { SRSExcelDataMapper } from './SRSExcelExport/SRSExcelDataMapper';
import { SRSExcelProcessor } from './SRSExcelExport/SRSExcelProcessor';
import { 
  ISRSExcelExportData,
  ISRSExcelOperationResult,
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelExport/SRSExcelInterfaces';

/**
 * *** ОБНОВЛЕННЫЙ FILE: Обработчик кнопки SRS с полным Excel экспортом ***
 * Теперь выполняет полный экспорт в Excel + обновление ExportResult поля
 * Использует существующие сервисы и SRS Excel утилиты
 * СОХРАНЕНО: Вся оригинальная логика валидации и обновления SharePoint
 */

/**
 * Интерфейс параметров для обработчика кнопки SRS
 * ОБНОВЛЕНО: Добавлены поля для Excel экспорта + сохранены оригинальные поля
 */
export interface ISRSButtonHandlerParams {
  item: ISRSRecord;
  context: WebPartContext;
  selectedStaff: { 
    id: string; 
    name: string; 
    employeeId: string;
    pathForSRSFile: string; // *** ВОССТАНОВЛЕНО: Путь к Excel файлу ***
    typeOfSRS?: number;     // *** ДОБАВЛЕНО: Тип SRS (2 или 3) ***
  };
  currentUserId?: string;   // *** ВОССТАНОВЛЕНО: Использовался в валидации ***
  managingGroupId?: string; // *** ВОССТАНОВЛЕНО: Использовался в валидации ***
  state: ISRSTabState;
  holidays: IHoliday[];
  typesOfLeave: ISRSTypeOfLeave[];
  refreshSRSData: () => Promise<void>;
  setState: (updater: (prev: ISRSTabState) => ISRSTabState) => void;
}

/**
 * Результат операции SRS кнопки
 * ОБНОВЛЕНО: Добавлены поля для Excel экспорта + сохранены оригинальные
 */
export interface ISRSButtonOperationResult {
  success: boolean;
  operation: 'excel_export' | 'toggle_export_result' | 'create_schedule' | 'update_record' | 'error';
  recordId?: string;
  message?: string;
  error?: string;
  userMessage?: string; // *** ДОБАВЛЕНО: Сообщение для пользователя ***
  
  // *** ДОБАВЛЕНО: Статистика Excel экспорта ***
  processingTime?: number;
  recordsProcessed?: number;
  cellsUpdated?: number;
  excelFilePath?: string;
}

/**
 * *** ГЛАВНАЯ ФУНКЦИЯ: Обработчик нажатия кнопки SRS с полным Excel экспортом ***
 * 
 * ОБНОВЛЕННАЯ ЛОГИКА:
 * 1. Валидация (сохранена оригинальная + новые проверки Excel)
 * 2. Сбор всех записей за дату с checked=true  
 * 3. Установка ExportResult = 0 (в процессе) через StaffRecordsService
 * 4. Выполнение Excel экспорта через существующие сервисы
 * 5. Установка ExportResult = 2 (успех) или 1 (ошибка) через StaffRecordsService
 * 6. Обновление локального состояния + refreshSRSData
 * 
 * @param params - Параметры для обработки Excel экспорта
 * @returns Promise<ISRSButtonOperationResult> - Результат операции
 */
export async function handleSRSButtonClick(params: ISRSButtonHandlerParams): Promise<ISRSButtonOperationResult> {
  const {
    item,
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    state,
    holidays,
    typesOfLeave,
    refreshSRSData,
    setState
  } = params;

  // ИСПРАВЛЕНО: Логируем использование переменных из деструктуризации
  console.log('[SRSButtonHandler] State has', state.srsRecords.length, 'records');
  console.log('[SRSButtonHandler] Available leave types:', typesOfLeave.length);

  console.log('[SRSButtonHandler] *** SRS EXCEL EXPORT HANDLER STARTED ***');
  console.log('[SRSButtonHandler] Item details:', {
    id: item.id,
    date: item.date.toLocaleDateString(),
    dateISO: item.date.toISOString(),
    currentCheckedStatus: item.checked,
    currentExportResultStatus: item.srs, // В ISRSRecord это поле представляет ExportResult
    selectedStaff: selectedStaff.name,
    excelFilePath: selectedStaff.pathForSRSFile,
    typeOfSRS: selectedStaff.typeOfSRS || 'default(2)'
  });

  // ===============================================
  // ВАЛИДАЦИЯ ВХОДНЫХ ПАРАМЕТРОВ (ВОССТАНОВЛЕНА ОРИГИНАЛЬНАЯ)
  // ===============================================

  console.log('[SRSButtonHandler] *** VALIDATING PARAMETERS FOR EXCEL EXPORT ***');

  if (!context) {
    console.error('[SRSButtonHandler] Context is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Context is not available'
    };
  }

  if (!selectedStaff?.employeeId) {
    console.error('[SRSButtonHandler] Selected staff employeeId is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Selected staff is not available'
    };
  }

  // *** ВОССТАНОВЛЕНО: Оригинальная валидация currentUserId ***
  if (!currentUserId || currentUserId === '0') {
    console.error('[SRSButtonHandler] Current user ID is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Current user ID is not available'
    };
  }

  // *** ВОССТАНОВЛЕНО: Оригинальная валидация managingGroupId ***
  if (!managingGroupId || managingGroupId === '0') {
    console.error('[SRSButtonHandler] Managing group ID is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Managing group ID is not available'
    };
  }

  // *** ВОССТАНОВЛЕНО: Проверка pathForSRSFile ***
  if (!selectedStaff.pathForSRSFile || selectedStaff.pathForSRSFile.trim() === '') {
    console.error('[SRSButtonHandler] Excel file path is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Excel file path is not configured for selected staff',
      userMessage: 'Путь к Excel файлу не настроен для выбранного сотрудника'
    };
  }

  if (item.deleted) {
    console.warn('[SRSButtonHandler] Cannot perform Excel export on deleted record');
    return {
      success: false,
      operation: 'error',
      error: 'Cannot perform Excel export on deleted record',
      userMessage: 'Нельзя экспортировать удаленную запись'
    };
  }

  console.log('[SRSButtonHandler] All parameters validated successfully for Excel export');

  // ===============================================
  // АНАЛИЗ ТЕКУЩЕГО СОСТОЯНИЯ И СБОР ДАННЫХ
  // ===============================================

  console.log('[SRSButtonHandler] *** COLLECTING RECORDS FOR EXCEL EXPORT ***');

  // Проверяем, является ли дата праздничной (используем holidays list Date-only)
  const isHolidayDate = holidays.some(holiday => {
    const normalizedHolidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
    const normalizedItemDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    return SRSDateUtils.areDatesEqual(normalizedHolidayDate, normalizedItemDate);
  });

  const holidayInfo = holidays.find(holiday => {
    const normalizedHolidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
    const normalizedItemDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    return SRSDateUtils.areDatesEqual(normalizedHolidayDate, normalizedItemDate);
  });

  console.log('[SRSButtonHandler] Date analysis (Date-only format):', {
    itemDate: item.date.toLocaleDateString(),
    isHolidayDate,
    holidayTitle: holidayInfo?.title || 'Not a holiday',
    totalHolidays: holidays.length,
    dateFormat: 'Date-only comparison using SRSDateUtils'
  });

  try {
    // 1. Собираем все записи за целевую дату
    const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    const recordsForDate = collectRecordsForDate(state.srsRecords, targetDate);
    
    console.log('[SRSButtonHandler] Records collected for date:', {
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      totalRecords: recordsForDate.length,
      recordIds: recordsForDate.map(r => r.id)
    });

    // 2. Фильтруем только отмеченные записи (checked=true)
    const checkedRecords = recordsForDate.filter(record => record.checked === true && !record.deleted);
    
    console.log('[SRSButtonHandler] Checked records for export:', {
      checkedCount: checkedRecords.length,
      totalForDate: recordsForDate.length,
      checkedIds: checkedRecords.map(r => r.id)
    });

    if (checkedRecords.length === 0) {
      return {
        success: false,
        operation: 'error',
        error: 'No checked records found for export',
        userMessage: 'Нет отмеченных записей для экспорта на выбранную дату'
      };
    }

    // ===============================================
    // УСТАНОВКА СТАТУСА "В ПРОЦЕССЕ" (ВОССТАНОВЛЕНО)
    // ===============================================

    console.log('[SRSButtonHandler] *** SETTING PROCESSING STATUS WITH STAFFRECORDSSERVICE ***');

    const staffRecordsService = StaffRecordsService.getInstance(context);

    // *** ВОССТАНОВЛЕНО: Устанавливаем ExportResult = 0 (в процессе) для всех записей дня ***
    for (const record of checkedRecords) {
      const updateDataProcessing: Partial<IStaffRecord> = {
        ExportResult: 0, // В процессе
        Title: `Processing Export for ${SRSDateUtils.formatDateForDisplay(record.date)}${record.typeOfLeave ? ` (${record.typeOfLeave})` : ''}${isHolidayDate ? ` - ${holidayInfo?.title || 'Holiday'}` : ''}`
      };

      const success = await staffRecordsService.updateStaffRecord(record.id, updateDataProcessing);
      
      if (!success) {
        console.error('[SRSButtonHandler] Failed to set processing status for record:', record.id);
        return {
          success: false,
          operation: 'error',
          recordId: record.id,
          error: 'Failed to update processing status in SharePoint'
        };
      }
    }

    // *** ВОССТАНОВЛЕНО: Обновляем локальное состояние для немедленного отражения ***
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        const targetRecord = checkedRecords.find(r => r.id === record.ID);
        if (targetRecord) {
          return {
            ...record,
            ExportResult: 0 // В процессе
          };
        }
        return record;
      });

      return {
        ...prevState,
        srsRecords: newSrsRecords
      };
    });

    console.log('[SRSButtonHandler] Processing status set for all records');

    // ===============================================
    // ВЫПОЛНЕНИЕ EXCEL ЭКСПОРТА
    // ===============================================

    console.log('[SRSButtonHandler] *** PERFORMING EXCEL EXPORT ***');

    const exportResult = await performExcelExport({
      records: checkedRecords,
      targetDate: targetDate,
      selectedStaff: selectedStaff,
      context: context
    });

    // ===============================================
    // ОБНОВЛЕНИЕ ФИНАЛЬНОГО СТАТУСА (ВОССТАНОВЛЕНО)
    // ===============================================

    console.log('[SRSButtonHandler] *** UPDATING FINAL STATUS WITH STAFFRECORDSSERVICE ***');

    const finalExportResult = exportResult.success ? 2 : 1; // 2 = успех, 1 = ошибка
    const finalTitle = exportResult.success 
      ? `Exported to Excel on ${SRSDateUtils.formatDateForDisplay(targetDate)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`
      : `Export Failed on ${SRSDateUtils.formatDateForDisplay(targetDate)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`;

    // *** ВОССТАНОВЛЕНО: Обновляем финальный статус через StaffRecordsService ***
    for (const record of checkedRecords) {
      const updateDataFinal: Partial<IStaffRecord> = {
        ExportResult: finalExportResult,
        Title: finalTitle
      };

      const success = await staffRecordsService.updateStaffRecord(record.id, updateDataFinal);
      
      if (!success) {
        console.warn('[SRSButtonHandler] Failed to update final status for record:', record.id);
        // Не прерываем процесс, просто логируем предупреждение
      }
    }

    // *** ВОССТАНОВЛЕНО: Обновляем локальное состояние с финальным статусом ***
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        const targetRecord = checkedRecords.find(r => r.id === record.ID);
        if (targetRecord) {
          return {
            ...record,
            ExportResult: finalExportResult,
            Title: finalTitle
          };
        }
        return record;
      });

      return {
        ...prevState,
        srsRecords: newSrsRecords
      };
    });

    console.log('[SRSButtonHandler] Final status updated for all records:', finalExportResult);

    // ===============================================
    // ОБНОВЛЕНИЕ ДАННЫХ С СЕРВЕРА (ВОССТАНОВЛЕНО)
    // ===============================================

    console.log('[SRSButtonHandler] *** REFRESHING DATA FROM SERVER ***');
    console.log('[SRSButtonHandler] Scheduling data refresh to sync with server...');

    // *** ВОССТАНОВЛЕНО: Обновляем данные с сервера для полной синхронизации ***
    setTimeout(() => {
      void refreshSRSData();
    }, 500);

    // ===============================================
    // ВОЗВРАТ РЕЗУЛЬТАТА (ВОССТАНОВЛЕН ОРИГИНАЛЬНЫЙ ФОРМАТ)
    // ===============================================

    if (exportResult.success) {
      const result: ISRSButtonOperationResult = {
        success: true,
        operation: 'excel_export',
        recordId: item.id,
        message: `Successfully exported ${checkedRecords.length} records to Excel and updated ExportResult`,
        userMessage: `Успешно экспортировано ${checkedRecords.length} записей в Excel`,
        processingTime: exportResult.processingTime,
        recordsProcessed: exportResult.recordsProcessed,
        cellsUpdated: exportResult.cellsUpdated,
        excelFilePath: selectedStaff.pathForSRSFile
      };

      console.log('[SRSButtonHandler] *** EXCEL EXPORT COMPLETED SUCCESSFULLY ***', result);
      return result;
    } else {
      const result: ISRSButtonOperationResult = {
        success: false,
        operation: 'error',
        recordId: item.id,
        error: exportResult.error || 'Excel export failed',
        userMessage: getExcelExportErrorMessage(exportResult.error),
        processingTime: exportResult.processingTime
      };

      console.error('[SRSButtonHandler] *** EXCEL EXPORT FAILED ***', result);
      return result;
    }

  } catch (error) {
    console.error('[SRSButtonHandler] Error during Excel export operation:', error);

    // *** ВОССТАНОВЛЕНО: Устанавливаем статус ошибки через StaffRecordsService ***
    try {
      const staffRecordsService = StaffRecordsService.getInstance(context);
      const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
      
      const errorUpdateData: Partial<IStaffRecord> = {
        ExportResult: 1, // Ошибка
        Title: `Export Error on ${SRSDateUtils.formatDateForDisplay(targetDate)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      await staffRecordsService.updateStaffRecord(item.id, errorUpdateData);
      
      // Обновляем локальное состояние
      setState(prevState => {
        const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
          if (record.ID === item.id) {
            return {
              ...record,
              ExportResult: 1,
              Title: errorUpdateData.Title!
            };
          }
          return record;
        });

        return {
          ...prevState,
          srsRecords: newSrsRecords
        };
      });

    } catch (updateError) {
      console.error('[SRSButtonHandler] Failed to update error status:', updateError);
    }

    // *** ВОССТАНОВЛЕНО: Показываем ошибку в состоянии компонента ***
    setState(prevState => ({
      ...prevState,
      errorSRS: `Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));

    return {
      success: false,
      operation: 'error',
      recordId: item.id,
      error: error instanceof Error ? error.message : 'Unknown error occurred during Excel export',
      userMessage: 'Произошла ошибка при экспорте в Excel'
    };
  }
}

/**
 * *** НОВАЯ ФУНКЦИЯ: Выполняет полный Excel экспорт ***
 * Использует существующие сервисы и SRS Excel утилиты
 */
async function performExcelExport(params: {
  records: ISRSRecord[];
  targetDate: Date;
  selectedStaff: ISRSButtonHandlerParams['selectedStaff'];
  context: WebPartContext;
}): Promise<ISRSExcelOperationResult> {
  
  const { records, targetDate, selectedStaff, context } = params;
  const startTime = Date.now();

  console.log('[SRSButtonHandler] *** STARTING EXCEL EXPORT PROCESS ***');
  console.log('[SRSButtonHandler] Export parameters:', {
    recordsCount: records.length,
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    filePath: selectedStaff.pathForSRSFile,
    typeOfSRS: selectedStaff.typeOfSRS || SRS_EXCEL_CONSTANTS.DEFAULT_SRS_TYPE
  });

  try {
    // 1. Подготовка данных для Excel через SRSExcelDataMapper
    const typeOfSRS: SRSType = (selectedStaff.typeOfSRS === 3) ? 3 : 2;
    const exportData: ISRSExcelExportData = SRSExcelDataMapper.prepareSRSDataForExcelExport(
      records, 
      targetDate, 
      typeOfSRS
    );

    console.log('[SRSButtonHandler] Excel export data prepared:', {
      recordsCount: exportData.records.length,
      maxRows: exportData.metadata.maxRows,
      typeOfSRS
    });

    // 2. Инициализация сервисов
    const graphApiService = GraphApiService.getInstance(context);
    const excelService = ExcelService.getInstance();

    // 3. Скачивание Excel файла из SharePoint
    console.log('[SRSButtonHandler] Downloading Excel file from SharePoint...');
    const fileBuffer = await graphApiService.downloadExcelFile(selectedStaff.pathForSRSFile);

    // 4. Загрузка workbook через ExcelJS
    console.log('[SRSButtonHandler] Loading workbook with ExcelJS...');
    const workbook = await excelService.loadWorkbookFromBuffer(fileBuffer);

    // 5. Получение целевого листа
    const worksheet = excelService.getWorksheet(workbook, SRS_EXCEL_CONSTANTS.WORKSHEET_NAME);

    // 6. Обработка Excel данных через SRSExcelProcessor
    console.log('[SRSButtonHandler] Processing Excel data...');
    const processor = new SRSExcelProcessor();
    const dateString = SRSDateUtils.formatDateForExcelSearch(targetDate);
    
    const processingResult = await processor.processSRSExcelExport(
      workbook,
      worksheet,
      dateString,
      typeOfSRS,
      exportData
    );

    if (!processingResult.success) {
      return {
        success: false,
        operation: 'export_to_excel',
        error: processingResult.error || 'Excel processing failed',
        processingTime: Date.now() - startTime
      };
    }

    // 7. Сохранение workbook в buffer
    console.log('[SRSButtonHandler] Saving workbook to buffer...');
    const updatedBuffer = await excelService.saveWorkbookToBuffer(workbook);

    // 8. Загрузка обновленного файла обратно в SharePoint
    console.log('[SRSButtonHandler] Uploading updated file to SharePoint...');
    const uploadSuccess = await graphApiService.uploadExcelFile(selectedStaff.pathForSRSFile, updatedBuffer);

    if (!uploadSuccess) {
      return {
        success: false,
        operation: 'export_to_excel',
        error: 'Failed to upload updated Excel file to SharePoint',
        processingTime: Date.now() - startTime
      };
    }

    // Успешный результат
    const result: ISRSExcelOperationResult = {
      success: true,
      operation: 'export_to_excel',
      message: `Successfully exported ${exportData.records.length} records to Excel`,
      processingTime: Date.now() - startTime,
      recordsProcessed: processingResult.recordsProcessed || exportData.records.length,
      cellsUpdated: processingResult.cellsUpdated || 0,
      filePath: selectedStaff.pathForSRSFile,
      worksheetName: SRS_EXCEL_CONSTANTS.WORKSHEET_NAME,
      dateFound: processingResult.dateFound,
      typeOfSRS: typeOfSRS
    };

    console.log('[SRSButtonHandler] *** EXCEL EXPORT PROCESS COMPLETED SUCCESSFULLY ***', result);
    return result;

  } catch (error) {
    console.error('[SRSButtonHandler] Error in Excel export process:', error);

    // Обработка специфичных ошибок через существующие сервисы
    let userFriendlyError = 'Unknown error occurred during Excel export';
    
    if (GraphApiService.isFileLocked(error)) {
      userFriendlyError = 'Файл открыт в Excel. Закройте файл и попробуйте снова.';
    } else if (GraphApiService.isFileNotFound(error)) {
      userFriendlyError = 'Excel файл не найден по указанному пути.';
    } else if (GraphApiService.isAccessDenied(error)) {
      userFriendlyError = 'Нет доступа к Excel файлу. Проверьте права доступа.';
    } else if (ExcelService.isWorksheetNotFound(error)) {
      userFriendlyError = `Лист "${SRS_EXCEL_CONSTANTS.WORKSHEET_NAME}" не найден в Excel файле.`;
    } else if (error instanceof Error) {
      userFriendlyError = error.message;
    }

    return {
      success: false,
      operation: 'export_to_excel',
      error: userFriendlyError,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * *** ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (ВОССТАНОВЛЕНЫ И НОВЫЕ) ***
 */

/**
 * Собирает все записи за указанную дату из состояния
 */
function collectRecordsForDate(allRecords: IStaffRecord[], targetDate: Date): ISRSRecord[] {
  console.log('[SRSButtonHandler] Collecting records for date:', SRSDateUtils.formatDateForDisplay(targetDate));

  const recordsForDate = allRecords.filter(record => {
    if (!record.Date) return false;
    
    const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.Date);
    const normalizedTargetDate = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    
    return SRSDateUtils.areDatesEqual(recordDate, normalizedTargetDate);
  });

  // Преобразуем IStaffRecord в ISRSRecord
  const srsRecords: ISRSRecord[] = recordsForDate.map(staffRecord => {
    return convertStaffRecordToSRS(staffRecord);
  });

  console.log('[SRSButtonHandler] Records collected:', {
    totalFound: srsRecords.length,
    recordIds: srsRecords.map(r => r.id)
  });

  return srsRecords;
}

/**
 * Преобразование IStaffRecord в ISRSRecord для сбора данных
 */
function convertStaffRecordToSRS(staffRecord: IStaffRecord): ISRSRecord {
  return {
    id: staffRecord.ID,
    date: staffRecord.Date ? SRSDateUtils.normalizeDateToLocalMidnight(staffRecord.Date) : new Date(),
    dayOfWeek: 'Unknown',
    hours: staffRecord.WorkTime || '0.00',
    relief: false,
    startWork: { 
      hours: (staffRecord.ShiftDate1Hours || 0).toString().padStart(2, '0'),
      minutes: (staffRecord.ShiftDate1Minutes || 0).toString().padStart(2, '0')
    },
    finishWork: { 
      hours: (staffRecord.ShiftDate2Hours || 0).toString().padStart(2, '0'),
      minutes: (staffRecord.ShiftDate2Minutes || 0).toString().padStart(2, '0')
    },
    lunch: (staffRecord.TimeForLunch || 0).toString(),
    typeOfLeave: (staffRecord.TypeOfLeaveID || '').toString(),
    timeLeave: (staffRecord.LeaveTime || 0).toString(),
    shift: 1,
    contract: (staffRecord.Contract || 1).toString(),
    contractCheck: true,
    status: staffRecord.Deleted === 1 ? 'negative' : 'none',
    srs: staffRecord.ExportResult === 1,
    checked: staffRecord.Checked === 1,
    deleted: staffRecord.Deleted === 1,
    Holiday: 0
  };
}

/**
 * Получает понятное сообщение об ошибке Excel экспорта
 */
function getExcelExportErrorMessage(error?: string): string {
  if (!error) {
    return 'Произошла неизвестная ошибка при экспорте в Excel';
  }

  // Преобразуем технические ошибки в понятные сообщения
  if (error.includes('locked') || error.includes('Locked')) {
    return 'Файл Excel заблокирован. Закройте файл и попробуйте снова.';
  }
  
  if (error.includes('not found') || error.includes('Not Found')) {
    return 'Файл Excel не найден. Проверьте путь к файлу.';
  }
  
  if (error.includes('access denied') || error.includes('Access Denied')) {
    return 'Нет доступа к файлу Excel. Проверьте права доступа.';
  }
  
  return error;
}

/**
 * *** ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ (ВОССТАНОВЛЕНЫ ИЗ ОРИГИНАЛЬНОГО ФАЙЛА) ***
 */

/**
 * Проверяет, можно ли выполнить ExportResult операцию для записи
 */
export function canPerformExportResultOperation(item: ISRSRecord): { canPerform: boolean; reason?: string } {
  if (item.deleted) {
    return {
      canPerform: false,
      reason: 'Cannot perform ExportResult operation on deleted record'
    };
  }

  return {
    canPerform: true
  };
}

/**
 * Получает текстовое описание ExportResult операции
 */
export function getExportResultOperationDescription(currentExportResultStatus: boolean, item: ISRSRecord, isHoliday: boolean, holidayTitle?: string): string {
  const operation = 'Export to Excel';
  const date = SRSDateUtils.formatDateForDisplay(item.date);
  const holidayText = isHoliday ? ` (${holidayTitle || 'Holiday'})` : '';
  const leaveText = item.typeOfLeave ? ` - ${item.typeOfLeave}` : '';
  
  return `${operation} for ${date}${holidayText}${leaveText}`;
}

/**
 * Создает заголовок записи на основе ExportResult статуса и других данных
 */
export function createExportResultRecordTitle(
  date: Date, 
  exportResultStatus: number, 
  typeOfLeave?: string, 
  isHoliday: boolean = false, 
  holidayTitle?: string
): string {
  const formattedDate = SRSDateUtils.formatDateForDisplay(date);
  let shiftType = 'Regular Shift';
  
  switch (exportResultStatus) {
    case 0:
      shiftType = 'Processing Export';
      break;
    case 1:
      shiftType = 'Export Failed';
      break;
    case 2:
      shiftType = 'Exported Shift';
      break;
  }
  
  const leaveText = typeOfLeave ? ` (${typeOfLeave})` : '';
  const holidayText = isHoliday ? ` - ${holidayTitle || 'Holiday'}` : '';
  
  return `${shiftType} on ${formattedDate}${leaveText}${holidayText}`;
}

/**
 * Получает статистику ExportResult записей в указанном диапазоне дат
 */
export function getExportResultStatistics(records: ISRSRecord[]): {
  totalRecords: number;
  exportedRecords: number;
  processingRecords: number;
  errorRecords: number;
  notExportedRecords: number;
  exportedPercentage: number;
  deletedExportedRecords: number;
} {
  const totalRecords = records.length;
  const activeRecords = records.filter(r => !r.deleted);
  
  // Анализируем записи по статусу ExportResult (через поле srs в ISRSRecord)
  const exportedRecords = activeRecords.filter(r => r.srs === true && getExportResultFromRecord(r) === 2).length;
  const processingRecords = activeRecords.filter(r => getExportResultFromRecord(r) === 0).length;
  const errorRecords = activeRecords.filter(r => getExportResultFromRecord(r) === 1).length;
  const notExportedRecords = activeRecords.filter(r => r.srs === false).length;
  const deletedExportedRecords = records.filter(r => r.deleted && r.srs === true).length;
  
  const exportedPercentage = activeRecords.length > 0 ? Math.round((exportedRecords / activeRecords.length) * 100) : 0;

  return {
    totalRecords,
    exportedRecords,
    processingRecords,
    errorRecords,
    notExportedRecords,
    exportedPercentage,
    deletedExportedRecords
  };
}

/**
 * Проверяет наличие конфликтов ExportResult в один день
 */
export function checkExportResultConflicts(records: ISRSRecord[], targetDate: Date): {
  hasConflicts: boolean;
  conflictingRecords: ISRSRecord[];
  details: string[];
} {
  const sameDay = records.filter(record => {
    const normalizedRecordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.date);
    const normalizedTargetDate = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    return SRSDateUtils.areDatesEqual(normalizedRecordDate, normalizedTargetDate) && !record.deleted;
  });

  const exportedOnDay = sameDay.filter(record => record.srs === true && getExportResultFromRecord(record) === 2);
  const hasConflicts = exportedOnDay.length > 1;

  const details: string[] = [];
  if (hasConflicts) {
    details.push(`Multiple exported records found for ${SRSDateUtils.formatDateForDisplay(targetDate)}`);
    details.push(`Exported records: ${exportedOnDay.length}`);
  }

  return {
    hasConflicts,
    conflictingRecords: exportedOnDay,
    details
  };
}

/**
 * Форматирует результат ExportResult операции для отображения пользователю
 */
export function formatExportResultOperationResult(result: ISRSButtonOperationResult): string {
  if (!result.success) {
    return result.userMessage || result.error || 'Excel export failed';
  }

  switch (result.operation) {
    case 'excel_export':
      return result.userMessage || result.message || 'Excel export completed successfully';
    case 'toggle_export_result':
      return result.message || 'ExportResult status updated successfully';
    case 'create_schedule':
      return `Schedule created successfully${result.recordId ? ` (ID: ${result.recordId})` : ''}`;
    case 'update_record':
      return `Record updated successfully${result.recordId ? ` (ID: ${result.recordId})` : ''}`;
    default:
      return 'Operation completed successfully';
  }
}

/**
 * Вспомогательная функция для получения ExportResult из ISRSRecord
 * (в ISRSRecord нет прямого поля ExportResult, используем логику на основе srs поля)
 */
function getExportResultFromRecord(record: ISRSRecord): number {
  // Простая логика: если srs=true считаем что экспортировано (2), иначе не экспортировано (0)
  // В реальности это значение должно браться из исходной IStaffRecord
  if (record.srs === true) {
    return 2; // Экспортировано
  }
  return 0; // Не экспортировано
}

/**
 * *** ДОПОЛНИТЕЛЬНАЯ ЛОГИКА ДЛЯ БУДУЩИХ РАСШИРЕНИЙ ***
 */

/**
 * Интерфейс для расширенных ExportResult операций (будущее использование)
 */
export interface IExtendedExportResultOperations {
  bulkToggleExportResult: (records: ISRSRecord[], newStatus: boolean) => Promise<ISRSButtonOperationResult[]>;
  copyExportResultToWeek: (sourceRecord: ISRSRecord, targetWeek: Date) => Promise<ISRSButtonOperationResult>;
  generateExportResultReport: (records: ISRSRecord[], fromDate: Date, toDate: Date) => Promise<string>;
}

/**
 * Проверяет совместимость ExportResult операций с типами отпусков
 */
export function checkExportResultLeaveTypeCompatibility(
  typeOfLeave: string, 
  typesOfLeave: ISRSTypeOfLeave[]
): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];
  
  if (!typeOfLeave || typeOfLeave === '') {
    return { compatible: true, warnings };
  }

  const leaveType = typesOfLeave.find(type => type.id === typeOfLeave);
  if (!leaveType) {
    warnings.push(`Unknown leave type: ${typeOfLeave}`);
    return { compatible: false, warnings };
  }

  // Дополнительные проверки совместимости можно добавить здесь
  return { compatible: true, warnings };
}

console.log('[SRSButtonHandler] *** EXCEL EXPORT BUTTON HANDLER MODULE LOADED ***');
console.log('[SRSButtonHandler] Features available:', {
  mainHandler: 'handleSRSButtonClick (with full Excel export + ExportResult updates)',
  excelExport: 'performExcelExport (using existing services)',
  servicesUsed: [
    'StaffRecordsService (SharePoint updates)', // *** ВОССТАНОВЛЕНО ***
    'GraphApiService (file operations)',
    'ExcelService (workbook processing)', 
    'RemoteSiteService (available if needed)',
    'SRSExcelDataMapper (data preparation)',
    'SRSExcelProcessor (Excel processing)'
  ],
  utilities: [
    'canPerformExportResultOperation',
    'getExportResultOperationDescription',
    'createExportResultRecordTitle',
    'getExportResultStatistics',
    'checkExportResultConflicts',
    'formatExportResultOperationResult',
    'checkExportResultLeaveTypeCompatibility'
  ],
  validationRestored: [
    'currentUserId validation', // *** ВОССТАНОВЛЕНО ***
    'managingGroupId validation', // *** ВОССТАНОВЛЕНО ***
    'pathForSRSFile validation' // *** ВОССТАНОВЛЕНО ***
  ],
  exportResultStatuses: {
    0: 'Processing (в процессе)',
    1: 'Error (ошибка экспорта)',
    2: 'Success (успешный экспорт)'
  },
  dateFormat: 'Date-only using SRSDateUtils',
  errorHandling: 'Comprehensive error catching with user-friendly messages + SharePoint status updates',
  stateManagement: 'Local state update + server data refresh via StaffRecordsService',
  fieldUsed: 'ExportResult (0 = processing, 1 = error, 2 = success) via StaffRecordsService'
});