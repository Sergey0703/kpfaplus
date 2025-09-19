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

// *** NEW: Interface for bulk export parameters ***
export interface ISRSBulkExportParams {
  records: ISRSRecord[]; // Multiple records to export
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
  operation: 'excel_export' | 'bulk_excel_export' | 'toggle_export_result' | 'create_schedule' | 'update_record' | 'error';
  recordId?: string;
  recordIds?: string[]; // *** NEW: For bulk operations ***
  message?: string;
  error?: string;
  userMessage?: string;
  processingTime?: number;
  recordsProcessed?: number;
  cellsUpdated?: number;
  excelFilePath?: string;
  exportedDates?: string[]; // *** NEW: For bulk operations ***
}

/**
 * *** REFACTORED: Main SRS button click handler - now supports single item exports ***
 * Maintains backward compatibility while delegating to common export logic
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

  console.log('[SRSButtonHandler] *** SINGLE SRS EXPORT HANDLER STARTED ***');
  console.log('[SRSButtonHandler] Item to export:', {
    id: item.id,
    date: SRSDateUtils.formatDateForDisplay(item.date),
    dateISO: item.date.toISOString(),
    typeOfLeave: item.typeOfLeave || 'Regular work',
    deleted: item.deleted,
    checked: item.checked
  });

  // *** НОВОЕ: Очищаем предыдущие сообщения в начале операции ***
  setState(prevState => ({
    ...prevState,
    srsMessage: undefined
  }));

  try {
    const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    const recordsForDate = collectRecordsForDate(state.srsRecords, targetDate);
    const checkedRecords = recordsForDate.filter(record => record.checked === true && !record.deleted);

    console.log('[SRSButtonHandler] Single item export analysis:', {
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      totalRecordsForDate: recordsForDate.length,
      checkedRecords: checkedRecords.length,
      uncheckedRecords: recordsForDate.length - checkedRecords.length,
      exportMode: 'single_item_trigger'
    });

    // Delegate to common export logic
    const result = await performSRSExport({
      records: checkedRecords,
      targetDate: targetDate,
      selectedStaff: selectedStaff,
      context: context,
      currentUserId: params.currentUserId,
      managingGroupId: params.managingGroupId,
      state: state,
      refreshSRSData: refreshSRSData,
      setState: setState,
      exportMode: 'single_item'
    });

    console.log('[SRSButtonHandler] *** SINGLE SRS EXPORT COMPLETED ***:', result);
    return {
      ...result,
      recordId: item.id,
      operation: 'excel_export'
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during single SRS export';
    console.error('[SRSButtonHandler] Critical error in single export handler:', error);
    
    // Set critical error message
    const criticalErrorData = createSRSErrorMessage(
      `Critical SRS Export Error: ${errorMsg}`,
      'Single SRS Export Handler',
      [
        `Critical error: ${errorMsg}`,
        `Target date: ${SRSDateUtils.formatDateForDisplay(item.date)}`,
        `Staff member: ${selectedStaff.name}`,
        `Excel file path: ${selectedStaff.pathForSRSFile || 'Not configured'}`,
        `Item ID: ${item.id}`,
        'This is a system-level error that requires investigation'
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
    
    return { 
      success: false, 
      operation: 'error', 
      error: errorMsg,
      recordId: item.id
    };
  }
}

/**
 * *** NEW: Bulk SRS export handler for multiple records ***
 * Handles export of multiple records across potentially multiple dates
 */
export async function handleSRSBulkExport(params: ISRSBulkExportParams): Promise<ISRSButtonOperationResult> {
  const {
    records,
    context,
    selectedStaff,
    state,
    refreshSRSData,
    setState
  } = params;

  console.log('[SRSButtonHandler] *** BULK SRS EXPORT HANDLER STARTED ***');
  console.log('[SRSButtonHandler] Records to export:', {
    totalRecords: records.length,
    recordIds: records.map(r => r.id),
    dateRange: records.length > 0 ? {
      earliest: records.reduce((min, r) => r.date < min ? r.date : min, records[0].date).toLocaleDateString(),
      latest: records.reduce((max, r) => r.date > max ? r.date : max, records[0].date).toLocaleDateString()
    } : 'No records'
  });

  // Clear previous messages
  setState(prevState => ({
    ...prevState,
    srsMessage: undefined
  }));

  try {
    // Group records by date
    const recordsByDate = new Map<string, ISRSRecord[]>();
    
    records.forEach(record => {
      const dateKey = SRSDateUtils.formatDateForDisplay(record.date);
      if (!recordsByDate.has(dateKey)) {
        recordsByDate.set(dateKey, []);
      }
      recordsByDate.get(dateKey)!.push(record);
    });

    console.log('[SRSButtonHandler] Bulk export - records grouped by date:', {
      totalDates: recordsByDate.size,
      datesWithRecords: Array.from(recordsByDate.keys()),
      recordsPerDate: Array.from(recordsByDate.entries()).map(([date, recs]) => ({
        date,
        count: recs.length
      }))
    });

    // Process each date group
    let totalExported = 0;
    let totalFailed = 0;
    const exportResults: Array<{ date: string; success: boolean; error?: string; recordsCount: number }> = [];
    const processedDates: string[] = [];

    // Convert Map entries to array for ES5 compatibility
    const dateGroupsArray = Array.from(recordsByDate.entries());
    
    for (let i = 0; i < dateGroupsArray.length; i++) {
      const [dateKey, dateRecords] = dateGroupsArray[i];
      
      try {
        console.log(`[SRSButtonHandler] *** PROCESSING BULK EXPORT FOR DATE ${dateKey} (${dateRecords.length} records) ***`);

        const targetDate = dateRecords[0].date;

        // Use common export logic for this date group
        const exportResult = await performSRSExport({
          records: dateRecords,
          targetDate: targetDate,
          selectedStaff: selectedStaff,
          context: context,
          currentUserId: params.currentUserId,
          managingGroupId: params.managingGroupId,
          state: state,
          refreshSRSData: refreshSRSData,
          setState: setState,
          exportMode: 'bulk'
        });

        if (exportResult.success) {
          console.log(`[SRSButtonHandler] ✓ Bulk export successful for date ${dateKey}: ${dateRecords.length} records`);
          totalExported += dateRecords.length;
          processedDates.push(dateKey);
          exportResults.push({
            date: dateKey,
            success: true,
            recordsCount: dateRecords.length
          });
        } else {
          console.error(`[SRSButtonHandler] ✗ Bulk export failed for date ${dateKey}: ${exportResult.error}`);
          totalFailed += dateRecords.length;
          exportResults.push({
            date: dateKey,
            success: false,
            error: exportResult.error,
            recordsCount: dateRecords.length
          });
        }

      } catch (dateExportError) {
        const errorMsg = dateExportError instanceof Error ? dateExportError.message : String(dateExportError);
        console.error(`[SRSButtonHandler] Critical error during bulk export for date ${dateKey}:`, dateExportError);
        totalFailed += dateRecords.length;
        exportResults.push({
          date: dateKey,
          success: false,
          error: errorMsg,
          recordsCount: dateRecords.length
        });
      }
    }

    console.log('[SRSButtonHandler] *** BULK SRS EXPORT PROCESS COMPLETED ***');
    console.log('[SRSButtonHandler] Final bulk export results:', {
      totalRecordsAttempted: records.length,
      totalExported,
      totalFailed,
      successfulDates: exportResults.filter(r => r.success).length,
      failedDates: exportResults.filter(r => !r.success).length,
      processedDates,
      exportResults
    });

    // Set appropriate bulk export message
    if (totalFailed === 0) {
      // Complete success
      const successData = createSRSSuccessMessage(
        totalExported,
        undefined, // No single processing time for bulk
        undefined  // No single cells updated for bulk
      );
      
      const enhancedDetails = [
        ...successData.details,
        `Dates processed: ${processedDates.join(', ')}`,
        `Staff member: ${selectedStaff.name}`,
        `Excel file: ${selectedStaff.pathForSRSFile}`,
        'All records have been marked as exported in the system'
      ];
      
      setState(prevState => ({
        ...prevState,
        srsMessage: {
          text: `Successfully exported all ${totalExported} checked records to Excel`,
          type: 'success',
          details: enhancedDetails,
          timestamp: Date.now()
        }
      }));
      
    } else if (totalExported === 0) {
      // Complete failure
      const failedDatesInfo = exportResults
        .filter(r => !r.success)
        .map(r => `${r.date}: ${r.error}`)
        .join('; ');

      const errorData = createSRSErrorMessage(
        `Failed to export all ${totalFailed} checked records`,
        'Bulk Export Operation',
        [
          `Records failed: ${totalFailed}`,
          `Dates failed: ${exportResults.filter(r => !r.success).length}`,
          `Errors: ${failedDatesInfo}`,
          `Staff member: ${selectedStaff.name}`,
          `Excel file: ${selectedStaff.pathForSRSFile}`
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
      
    } else {
      // Partial success
      const successfulDatesInfo = exportResults
        .filter(r => r.success)
        .map(r => `${r.date} (${r.recordsCount} records)`)
        .join(', ');

      const failedDatesInfo = exportResults
        .filter(r => !r.success)
        .map(r => `${r.date}: ${r.error}`)
        .join('; ');

      const warningData = createSRSWarningMessage(
        `Partially exported checked records: ${totalExported} successful, ${totalFailed} failed`,
        [
          `Successfully exported: ${totalExported} records`,
          `Failed to export: ${totalFailed} records`,
          `Successful dates: ${successfulDatesInfo}`,
          `Failed dates: ${failedDatesInfo}`,
          `Staff member: ${selectedStaff.name}`
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
    }

    return {
      success: totalFailed === 0,
      operation: 'bulk_excel_export',
      recordIds: records.map(r => r.id),
      message: totalFailed === 0 ? 
        `Successfully exported ${totalExported} records` : 
        `Exported ${totalExported} records, failed ${totalFailed}`,
      recordsProcessed: totalExported,
      exportedDates: processedDates,
      excelFilePath: selectedStaff.pathForSRSFile
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during bulk SRS export';
    console.error('[SRSButtonHandler] Critical error in bulk export handler:', error);
    
    const criticalErrorData = createSRSErrorMessage(
      `Critical Bulk SRS Export Error: ${errorMsg}`,
      'Bulk SRS Export Handler',
      [
        `Critical error: ${errorMsg}`,
        `Records attempted: ${records.length}`,
        `Staff member: ${selectedStaff.name}`,
        `Excel file path: ${selectedStaff.pathForSRSFile || 'Not configured'}`,
        'This is a system-level error that requires investigation'
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
    
    return { 
      success: false, 
      operation: 'error', 
      error: errorMsg,
      recordIds: records.map(r => r.id)
    };
  }
}

/**
 * *** REFACTORED: Common SRS export logic for both single and bulk operations ***
 * Extracted from original handleSRSButtonClick to support code reuse
 */
async function performSRSExport(params: {
  records: ISRSRecord[];
  targetDate: Date;
  selectedStaff: ISRSBulkExportParams['selectedStaff'];
  context: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
  state: ISRSTabState;
  refreshSRSData: () => Promise<void>;
  setState: (updater: (prev: ISRSTabState) => ISRSTabState) => void;
  exportMode: 'single_item' | 'bulk';
}): Promise<ISRSButtonOperationResult> {
  
  const {
    records,
    targetDate,
    selectedStaff,
    context,
   // currentUserId,
   // managingGroupId,
  //  state,
    refreshSRSData,
    setState,
    exportMode
  } = params;

  const startTime = Date.now();

  console.log('[SRSButtonHandler] *** COMMON SRS EXPORT LOGIC STARTED ***');
  console.log('[SRSButtonHandler] Export parameters:', {
    recordsCount: records.length,
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    exportMode,
    staffName: selectedStaff.name,
    excelFilePath: selectedStaff.pathForSRSFile,
    typeOfSRS: selectedStaff.typeOfSRS || 2
  });

  // *** ПРОВЕРКА 1: Нет отмеченных записей для экспорта ***
  if (records.length === 0) {
    console.log('[SRSButtonHandler] No records provided for export');
    
    const warningData = createSRSWarningMessage(
      exportMode === 'single_item' ? 
        'No checked records found for export on this date' :
        'No records provided for bulk export',
      [
        exportMode === 'single_item' ? 
          'Please check at least one record on this date before clicking SRS export' :
          'No records were provided for bulk export operation',
        'Only checked (✓) records will be exported to Excel',
        `Target date: ${SRSDateUtils.formatDateForDisplay(targetDate)}`,
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
    
    return { success: false, operation: 'error', error: 'No records found for export' };
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
    recordsToExport: records.length,
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    excelFilePath: selectedStaff.pathForSRSFile,
    staffName: selectedStaff.name,
    exportMode
  });

  try {
    // *** ШАГ 1: Обновляем статус записей на "Processing" ***
    const staffRecordsService = StaffRecordsService.getInstance(context);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      await staffRecordsService.updateStaffRecord(record.id, { 
        ExportResult: 0, 
        Title: `Processing Export...` 
      });
    }

    // Обновляем UI состояние
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        if (records.some(r => r.id === record.ID)) {
          return { ...record, ExportResult: 0 };
        }
        return record;
      });
      return { ...prevState, srsRecords: newSrsRecords };
    });

    // *** ШАГ 2: Выполняем экспорт в Excel ***
    const exportResult = await performExcelExport({
      records: records,
      targetDate: targetDate,
      selectedStaff: selectedStaff,
      context: context
    });

    console.log('[SRSButtonHandler] Excel export completed:', {
      success: exportResult.success,
      processingTime: exportResult.processingTime,
      cellsUpdated: exportResult.cellsUpdated,
      error: exportResult.error,
      exportMode
    });

    // *** ШАГ 3: Обновляем финальный статус записей ***
    const finalExportResult = exportResult.success ? 2 : 1;
    const finalTitle = exportResult.success
      ? `Exported to Excel on ${SRSDateUtils.formatDateForDisplay(targetDate)}`
      : `Export Failed on ${SRSDateUtils.formatDateForDisplay(targetDate)}`;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      await staffRecordsService.updateStaffRecord(record.id, { 
        ExportResult: finalExportResult, 
        Title: finalTitle 
      });
    }

    // Обновляем данные с сервера
    setTimeout(() => { void refreshSRSData(); }, 500);

    // Return success/error result (message setting handled by caller)
    return {
      success: exportResult.success,
      operation: exportMode === 'single_item' ? 'excel_export' : 'bulk_excel_export',
      recordsProcessed: records.length,
      processingTime: Date.now() - startTime,
      cellsUpdated: exportResult.cellsUpdated,
      excelFilePath: selectedStaff.pathForSRSFile,
      error: exportResult.error
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during SRS export';
    console.error(`[SRSButtonHandler] Critical error in common export logic (${exportMode}):`, error);
    
    // Пытаемся обновить статус записи об ошибке
    try {
        const staffRecordsService = StaffRecordsService.getInstance(context);
        for (let i = 0; i < records.length; i++) {
          const record = records[i];
          await staffRecordsService.updateStaffRecord(record.id, { 
            ExportResult: 1, 
            Title: `Export Failed: ${errorMsg}` 
          });
        }
        setTimeout(() => { void refreshSRSData(); }, 500);
    } catch (statusError) {
        console.error(`[SRSButtonHandler] Failed to set error status for records:`, statusError);
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
 * *** ОБНОВЛЕНО: Выполняет экспорт в Excel с детальным логированием для панели сообщений ***
 * (No changes to this function - it already works for both single and bulk)
 */
async function performExcelExport(params: {
  records: ISRSRecord[];
  targetDate: Date;
  selectedStaff: ISRSBulkExportParams['selectedStaff'];
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