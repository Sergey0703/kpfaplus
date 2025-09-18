// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSButtonHandler.ts

import { ISRSRecord, ISRSTabState } from './SRSTabInterfaces';
import { IHoliday } from '../../../../services/HolidaysService';
import { ISRSTypeOfLeave } from './SRSTabInterfaces';
import { SRSDateUtils } from './SRSDateUtils';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { GraphApiService } from '../../../../services/GraphApiService';
import { ExcelService } from '../../../../services/ExcelService';
import { SRSExcelDataMapper } from './SRSExcelExport/SRSExcelDataMapper';
import { SRSExcelProcessor } from './SRSExcelExport/SRSExcelProcessor';
import {
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelExport/SRSExcelInterfaces';

// *** НОВОЕ: Импорт helpers для панели сообщений ***
import { createSRSSuccessMessage, createSRSErrorMessage, createSRSWarningMessage } from '../components/SRSMessagePanel';

export interface ISRSButtonHandlerParams {
  item: ISRSRecord;
  context: WebPartContext;
  selectedStaff: {
    id: string;
    name: string;
    employeeId: string;
    pathForSRSFile: string;
    typeOfSRS?: number;
  };
  currentUserId?: string;
  managingGroupId?: string;
  state: ISRSTabState;
  holidays: IHoliday[];
  typesOfLeave: ISRSTypeOfLeave[];
  refreshSRSData: () => Promise<void>;
  setState: (updater: (prev: ISRSTabState) => ISRSTabState) => void;
}

// Интерфейс определен локально
export interface ISRSButtonOperationResult {
  success: boolean;
  operation: 'excel_export' | 'toggle_export_result' | 'create_schedule' | 'update_record' | 'error';
  recordId?: string;
  message?: string;
  error?: string;
  userMessage?: string;
  processingTime?: number;
  recordsProcessed?: number;
  cellsUpdated?: number;
  excelFilePath?: string;
}

/**
 * *** ОБНОВЛЕНО: Главный обработчик кнопки SRS с поддержкой панели сообщений ***
 * Теперь показывает детальные сообщения об успехе/ошибках на панели
 */
export async function handleSRSButtonClick(params: ISRSButtonHandlerParams): Promise<ISRSButtonOperationResult> {
  const {
    item,
    context,
    selectedStaff,
    state,
    refreshSRSData,
    setState
  } = params;

  console.log('[SRSButtonHandler] *** SRS EXCEL EXPORT HANDLER STARTED WITH MESSAGE PANEL SUPPORT ***');

  // *** НОВОЕ: Очищаем предыдущие сообщения в начале операции ***
  setState(prevState => ({
    ...prevState,
    srsMessage: undefined
  }));

  try {
    const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    const recordsForDate = collectRecordsForDate(state.srsRecords, targetDate);
    const checkedRecords = recordsForDate.filter(record => record.checked === true && !record.deleted);

    console.log('[SRSButtonHandler] Records analysis for export:', {
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      totalRecordsForDate: recordsForDate.length,
      checkedRecords: checkedRecords.length,
      uncheckedRecords: recordsForDate.length - checkedRecords.length
    });

    // *** ПРОВЕРКА 1: Нет отмеченных записей для экспорта ***
    if (checkedRecords.length === 0) {
      console.log('[SRSButtonHandler] No checked records found for export');
      
      // *** НОВОЕ: Устанавливаем warning сообщение с детальной информацией ***
      const warningData = createSRSWarningMessage(
        'No checked records found for export',
        [
          'Please check at least one record before clicking SRS export',
          'Only checked (✓) records will be exported to Excel',
          `Date selected: ${SRSDateUtils.formatDateForDisplay(targetDate)}`,
          `Total records on this date: ${recordsForDate.length}`,
          'Check the boxes in the "Check" column to select records for export'
        ]
      );
      
      setState(prevState => ({
        ...prevState,
        srsMessage: {
          text: warningData.message,
          type: 'warning',
          details: warningData.details,
          timestamp: Date.now()
        }
      }));
      
      return { success: false, operation: 'error', error: 'No checked records found for export' };
    }

    // *** ПРОВЕРКА 2: Проверяем доступность Excel файла ***
    if (!selectedStaff.pathForSRSFile) {
      console.error('[SRSButtonHandler] No Excel file path configured for staff member');
      
      const errorData = createSRSErrorMessage(
        'Excel file path not configured',
        'SRS Export Configuration',
        [
          `Staff member: ${selectedStaff.name}`,
          'Excel file path (pathForSRSFile) is not configured',
          'Contact administrator to configure SRS Excel file path',
          'This is required for SRS export functionality'
        ]
      );
      
      setState(prevState => ({
        ...prevState,
        srsMessage: {
          text: errorData.message,
          type: 'error',
          details: errorData.details,
          timestamp: Date.now()
        }
      }));
      
      return { success: false, operation: 'error', error: 'Excel file path not configured' };
    }

    console.log('[SRSButtonHandler] Starting Excel export process:', {
      checkedRecords: checkedRecords.length,
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      excelFilePath: selectedStaff.pathForSRSFile,
      staffName: selectedStaff.name
    });

    // *** ШАГ 1: Обновляем статус записей на "Processing" ***
    const staffRecordsService = StaffRecordsService.getInstance(context);

    for (const record of checkedRecords) {
      await staffRecordsService.updateStaffRecord(record.id, { 
        ExportResult: 0, 
        Title: `Processing Export...` 
      });
    }

    // Обновляем UI состояние
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        if (checkedRecords.some(r => r.id === record.ID)) {
          return { ...record, ExportResult: 0 };
        }
        return record;
      });
      return { ...prevState, srsRecords: newSrsRecords };
    });

    // *** ШАГ 2: Выполняем экспорт в Excel ***
    const exportResult = await performExcelExport({
      records: checkedRecords,
      targetDate: targetDate,
      selectedStaff: selectedStaff,
      context: context
    });

    console.log('[SRSButtonHandler] Excel export completed:', {
      success: exportResult.success,
      processingTime: exportResult.processingTime,
      cellsUpdated: exportResult.cellsUpdated,
      error: exportResult.error
    });

    // *** ШАГ 3: Обновляем финальный статус записей ***
    const finalExportResult = exportResult.success ? 2 : 1;
    const finalTitle = exportResult.success
      ? `Exported to Excel on ${SRSDateUtils.formatDateForDisplay(targetDate)}`
      : `Export Failed on ${SRSDateUtils.formatDateForDisplay(targetDate)}`;

    for (const record of checkedRecords) {
      await staffRecordsService.updateStaffRecord(record.id, { 
        ExportResult: finalExportResult, 
        Title: finalTitle 
      });
    }

    // Обновляем данные с сервера
    setTimeout(() => { void refreshSRSData(); }, 500);

    // *** НОВОЕ: Устанавливаем success или error сообщение с детальной информацией ***
    if (exportResult.success) {
      console.log('[SRSButtonHandler] Setting success message');
      
      const successData = createSRSSuccessMessage(
        checkedRecords.length,
        exportResult.processingTime,
        exportResult.cellsUpdated
      );
      
      // Добавляем дополнительные детали для успешного экспорта
      const enhancedDetails = [
        ...successData.details,
        `Target date: ${SRSDateUtils.formatDateForDisplay(targetDate)}`,
        `Staff member: ${selectedStaff.name}`,
        `Excel file: ${selectedStaff.pathForSRSFile}`,
        `SRS Type: ${selectedStaff.typeOfSRS || 2}`,
        'Records have been marked as exported in the system'
      ];
      
      setState(prevState => ({
        ...prevState,
        srsMessage: {
          text: successData.message,
          type: 'success',
          details: enhancedDetails,
          timestamp: Date.now()
        }
      }));
      
    } else {
      console.log('[SRSButtonHandler] Setting error message');
      
      const errorData = createSRSErrorMessage(
        exportResult.error || 'Excel export operation failed',
        'Excel Export Operation',
        [
          `Export error: ${exportResult.error || 'Unknown error'}`,
          `Target date: ${SRSDateUtils.formatDateForDisplay(targetDate)}`,
          `Records attempted: ${checkedRecords.length}`,
          `Staff member: ${selectedStaff.name}`,
          `Excel file: ${selectedStaff.pathForSRSFile}`,
          `Processing time: ${exportResult.processingTime || 0}ms`,
          'Possible causes:',
          '• Excel file is not accessible or locked',
          '• Date not found in Excel file (check date format)',
          '• Network connectivity issues',
          '• File permissions or SharePoint access issues',
          'Check browser console for detailed error information'
        ]
      );
      
      setState(prevState => ({
        ...prevState,
        srsMessage: {
          text: errorData.message,
          type: 'error',
          details: errorData.details,
          timestamp: Date.now()
        }
      }));
    }

    return {
      recordId: item.id,
      userMessage: exportResult.success 
        ? `Successfully exported ${checkedRecords.length} records to Excel.` 
        : `Export failed: ${exportResult.error}`,
      ...exportResult
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during SRS export handler';
    console.error(`[SRSButtonHandler] Critical error in main handler:`, error);
    
    // *** НОВОЕ: Устанавливаем критическое error сообщение с максимальной детализацией ***
    const criticalErrorData = createSRSErrorMessage(
      `Critical SRS Export Error: ${errorMsg}`,
      'SRS Export Handler',
      [
        `Critical error: ${errorMsg}`,
        `Target date: ${SRSDateUtils.formatDateForDisplay(item.date)}`,
        `Staff member: ${selectedStaff.name}`,
        `Excel file path: ${selectedStaff.pathForSRSFile || 'Not configured'}`,
        `Item ID: ${item.id}`,
        `Error type: ${error instanceof Error ? error.constructor.name : typeof error}`,
        'This is a system-level error that requires investigation',
        'Troubleshooting steps:',
        '• Check browser console for stack trace',
        '• Verify SharePoint connectivity',
        '• Confirm Excel file accessibility',
        '• Check user permissions for file access',
        '• Contact system administrator if issue persists'
      ]
    );
    
    setState(prevState => ({
      ...prevState,
      srsMessage: {
        text: criticalErrorData.message,
        type: 'error',
        details: criticalErrorData.details,
        timestamp: Date.now()
      }
    }));
    
    // Пытаемся обновить статус записи об ошибке
    try {
        const staffRecordsService = StaffRecordsService.getInstance(context);
        await staffRecordsService.updateStaffRecord(item.id, { 
          ExportResult: 1, 
          Title: `Export Failed: ${errorMsg}` 
        });
        setTimeout(() => { void refreshSRSData(); }, 500);
    } catch (statusError) {
        console.error(`[SRSButtonHandler] Failed to even set error status for record ${item.id}:`, statusError);
    }
    
    return { success: false, operation: 'error', error: errorMsg };
  }
}

/**
 * *** ОБНОВЛЕНО: Выполняет экспорт в Excel с детальным логированием для панели сообщений ***
 */
async function performExcelExport(params: {
  records: ISRSRecord[];
  targetDate: Date;
  selectedStaff: ISRSButtonHandlerParams['selectedStaff'];
  context: WebPartContext;
}): Promise<ISRSButtonOperationResult> {

  const { records, targetDate, selectedStaff, context } = params;
  const startTime = Date.now();

  console.log('[SRSButtonHandler] *** STARTING EXCEL EXPORT PROCESS ***');
  console.log('[SRSButtonHandler] Export parameters:', {
    recordsCount: records.length,
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    excelDateFormat: SRSDateUtils.formatDateForExcelSearch(targetDate),
    staffName: selectedStaff.name,
    excelFilePath: selectedStaff.pathForSRSFile,
    typeOfSRS: selectedStaff.typeOfSRS || 2
  });

  try {
    // *** ШАГ 1: Подготовка данных для экспорта ***
    const typeOfSRS: SRSType = (selectedStaff.typeOfSRS === 3) ? 3 : 2;
    console.log('[SRSButtonHandler] Preparing export data for SRS Type:', typeOfSRS);
    
    const exportData = SRSExcelDataMapper.prepareSRSDataForExcelExport(records, targetDate, typeOfSRS);

    if (exportData.records.length === 0) {
        const error = "No valid records were available for export after filtering and validation.";
        console.error('[SRSButtonHandler]', error);
        return { 
          success: false, 
          operation: 'error', 
          error: error,
          processingTime: Date.now() - startTime 
        };
    }

    console.log('[SRSButtonHandler] Export data prepared:', {
      validRecords: exportData.records.length,
      invalidRecords: records.length - exportData.records.length,
      maxRows: exportData.metadata.maxRows
    });

    // *** ШАГ 2: Инициализация сервисов ***
    console.log('[SRSButtonHandler] Initializing services...');
    const graphApiService = GraphApiService.getInstance(context);
    const excelService = ExcelService.getInstance();

    // *** ШАГ 3: Загрузка Excel файла ***
    console.log('[SRSButtonHandler] Downloading Excel file:', selectedStaff.pathForSRSFile);
    const fileBuffer = await graphApiService.downloadExcelFile(selectedStaff.pathForSRSFile);
    console.log('[SRSButtonHandler] Excel file downloaded successfully, size:', fileBuffer.byteLength, 'bytes');

    // *** ШАГ 4: Загрузка рабочей книги ***
    console.log('[SRSButtonHandler] Loading Excel workbook...');
    const workbook = await excelService.loadWorkbookFromBuffer(fileBuffer);
    console.log('[SRSButtonHandler] Workbook loaded successfully');

    // *** ШАГ 5: Получение рабочего листа ***
    console.log('[SRSButtonHandler] Getting worksheet:', SRS_EXCEL_CONSTANTS.WORKSHEET_NAME);
    const worksheet = excelService.getWorksheet(workbook, SRS_EXCEL_CONSTANTS.WORKSHEET_NAME);
    console.log('[SRSButtonHandler] Worksheet found successfully');

    // *** ШАГ 6: Обработка данных в Excel ***
    console.log('[SRSButtonHandler] Starting Excel data processing...');
    const processor = new SRSExcelProcessor();
    const dateString = SRSDateUtils.formatDateForExcelSearch(targetDate);
    
    console.log('[SRSButtonHandler] Excel processing parameters:', {
      dateString: dateString,
      typeOfSRS: typeOfSRS,
      recordsToProcess: exportData.records.length
    });

    const processingResult = await processor.processSRSExcelExport(
      workbook, 
      worksheet, 
      dateString, 
      typeOfSRS, 
      exportData
    );

    console.log('[SRSButtonHandler] Excel processing completed:', {
      success: processingResult.success,
      cellsUpdated: processingResult.cellsUpdated,
      recordsProcessed: processingResult.recordsProcessed,
      error: processingResult.error
    });

    if (!processingResult.success) {
      return { 
        success: false, 
        operation: 'error', 
        error: processingResult.error || 'Excel processing failed',
        processingTime: Date.now() - startTime 
      };
    }

    // *** ШАГ 7: Сохранение и загрузка обновленного файла ***
    console.log('[SRSButtonHandler] Saving updated Excel workbook...');
    const updatedBuffer = await excelService.saveWorkbookToBuffer(workbook);
    console.log('[SRSButtonHandler] Workbook saved to buffer, size:', updatedBuffer.byteLength, 'bytes');

    console.log('[SRSButtonHandler] Uploading updated Excel file...');
    const uploadSuccess = await graphApiService.uploadExcelFile(selectedStaff.pathForSRSFile, updatedBuffer);

    if (!uploadSuccess) {
      return { 
        success: false, 
        operation: 'error', 
        error: 'Failed to upload updated Excel file to SharePoint',
        processingTime: Date.now() - startTime 
      };
    }

    console.log('[SRSButtonHandler] *** EXCEL EXPORT PROCESS COMPLETED SUCCESSFULLY ***');

    return {
      success: true,
      operation: 'excel_export',
      message: processingResult.message || 'Excel export completed successfully',
      recordsProcessed: processingResult.recordsProcessed || exportData.records.length,
      cellsUpdated: processingResult.cellsUpdated || 0,
      processingTime: Date.now() - startTime,
      excelFilePath: selectedStaff.pathForSRSFile
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during Excel export';
    console.error(`[SRSButtonHandler] Error in performExcelExport:`, error);
    
    // Детальное логирование для отладки
    if (error instanceof Error && error.stack) {
      console.error('[SRSButtonHandler] Error stack trace:', error.stack);
    }
    
    return { 
      success: false, 
      operation: 'error', 
      error: errorMsg, 
      processingTime: Date.now() - startTime 
    };
  }
}

/**
 * Собирает записи для указанной даты из общего списка
 */
function collectRecordsForDate(allRecords: IStaffRecord[], targetDate: Date): ISRSRecord[] {
  console.log('[SRSButtonHandler] Collecting records for date:', SRSDateUtils.formatDateForDisplay(targetDate));
  
  const recordsForDate = allRecords.filter(record => {
    if (!record.Date) {
      console.warn('[SRSButtonHandler] Record has no date:', record.ID);
      return false;
    }
    
    const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.Date);
    const targetDateNormalized = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    
    return SRSDateUtils.areDatesEqual(recordDate, targetDateNormalized);
  });
  
  console.log('[SRSButtonHandler] Records found for date:', {
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    recordsFound: recordsForDate.length,
    totalRecordsChecked: allRecords.length
  });
  
  return recordsForDate.map(staffRecord => convertStaffRecordToSRS(staffRecord));
}

/**
 * Конвертирует IStaffRecord в ISRSRecord для обработки
 */
function convertStaffRecordToSRS(staffRecord: IStaffRecord): ISRSRecord {
  const normalizedDate = staffRecord.Date ? SRSDateUtils.normalizeDateToLocalMidnight(staffRecord.Date) : new Date();
  
  return {
    id: staffRecord.ID,
    date: normalizedDate,
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
    srs: staffRecord.ExportResult === 2,
    checked: staffRecord.Checked === 1,
    deleted: staffRecord.Deleted === 1,
    Holiday: 0
  };
}