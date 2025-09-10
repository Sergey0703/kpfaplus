// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSButtonHandlerOk2.ts

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

/**
 * Parameters for SRS button handler
 */
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

/**
 * Result interface for SRS button operations
 */
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
 * Interface for Excel export parameters
 */
interface IExcelExportParams {
  records: ISRSRecord[];
  targetDate: Date;
  selectedStaff: ISRSButtonHandlerParams['selectedStaff'];
  context: WebPartContext;
}

/**
 * Interface for record validation result
 */
interface IRecordValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Interface for export statistics
 */
interface IExportStatistics {
  totalRecords: number;
  checkedRecords: number;
  validRecords: number;
  invalidRecords: number;
  holidayRecords: number;
  leaveRecords: number;
}

/**
 * Main handler for SRS button clicks
 * Processes SRS records for Excel export with comprehensive error handling
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

  console.log('[SRSButtonHandlerOk2] *** SRS EXCEL EXPORT HANDLER STARTED ***');
  console.log('[SRSButtonHandlerOk2] Processing item:', {
    id: item.id,
    date: item.date.toLocaleDateString(),
    checked: item.checked,
    deleted: item.deleted
  });

  const startTime = Date.now();

  try {
    // Validate basic requirements
    const validationResult = validateBasicRequirements(params);
    if (!validationResult.success) {
      return validationResult;
    }

    // Normalize target date
    const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    console.log('[SRSButtonHandlerOk2] Target date normalized:', {
      original: item.date.toISOString(),
      normalized: targetDate.toISOString(),
      display: SRSDateUtils.formatDateForDisplay(targetDate)
    });

    // Collect and validate records for the target date
    const recordsForDate = collectRecordsForDate(state.srsRecords, targetDate);
    const checkedRecords = recordsForDate.filter(record => 
      record.checked === true && !record.deleted
    );

    console.log('[SRSButtonHandlerOk2] Records analysis:', {
      totalRecordsForDate: recordsForDate.length,
      checkedRecords: checkedRecords.length,
      deletedRecords: recordsForDate.filter(r => r.deleted).length
    });

    if (checkedRecords.length === 0) {
      return {
        success: false,
        operation: 'error',
        error: 'No checked records found for export',
        recordId: item.id,
        userMessage: 'Please check at least one record before exporting.',
        processingTime: Date.now() - startTime
      };
    }

    // Generate export statistics
    const exportStats = generateExportStatistics(checkedRecords, params.holidays);
    console.log('[SRSButtonHandlerOk2] Export statistics:', exportStats);

    // Initialize StaffRecordsService
    const staffRecordsService = StaffRecordsService.getInstance(context);

    // Set processing status for all checked records
    await setProcessingStatus(staffRecordsService, checkedRecords, 'processing');

    // Update UI state to show processing
    updateUIState(setState, state, checkedRecords, 0);

    // Perform Excel export
    const exportResult = await performExcelExport({
      records: checkedRecords,
      targetDate: targetDate,
      selectedStaff: selectedStaff,
      context: context
    });

    // Determine final status based on export result
    const finalExportResult = exportResult.success ? 2 : 1;
    const finalTitle = generateStatusTitle(exportResult.success, targetDate, exportResult.error);

    // Update final status for all checked records
    await setProcessingStatus(staffRecordsService, checkedRecords, 'completed', finalExportResult, finalTitle);

    // Schedule data refresh
    setTimeout(() => {
      void refreshSRSData();
    }, 500);

    // Return comprehensive result
    return {
      recordId: item.id,
      userMessage: generateUserMessage(exportResult, checkedRecords.length),
      processingTime: Date.now() - startTime,
      ...exportResult
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during main handler';
    console.error('[SRSButtonHandlerOk2] Critical error:', errorMsg);

    // Attempt to set error status
    try {
      const staffRecordsService = StaffRecordsService.getInstance(context);
      await staffRecordsService.updateStaffRecord(item.id, {
        ExportResult: 1,
        Title: `Export Failed: ${errorMsg}`
      });
      setTimeout(() => {
        void refreshSRSData();
      }, 500);
    } catch {
      console.error('[SRSButtonHandlerOk2] Failed to set error status for record:', item.id);
    }

    return {
      success: false,
      operation: 'error',
      error: errorMsg,
      recordId: item.id,
      userMessage: `Export failed: ${errorMsg}`,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Validates basic requirements for SRS button operation
 */
function validateBasicRequirements(params: ISRSButtonHandlerParams): ISRSButtonOperationResult {
  const { item, context, selectedStaff } = params;

  if (!context) {
    return {
      success: false,
      operation: 'error',
      error: 'WebPart context is required',
      recordId: item.id
    };
  }

  if (!selectedStaff) {
    return {
      success: false,
      operation: 'error',
      error: 'Selected staff information is required',
      recordId: item.id
    };
  }

  if (!selectedStaff.pathForSRSFile) {
    return {
      success: false,
      operation: 'error',
      error: 'SRS file path is not configured for selected staff',
      recordId: item.id
    };
  }

  if (item.deleted) {
    return {
      success: false,
      operation: 'error',
      error: 'Cannot export deleted records',
      recordId: item.id
    };
  }

  // Validation passed
  return {
    success: true,
    operation: 'excel_export',
    recordId: item.id
  };
}

/**
 * Collects records for a specific date
 */
function collectRecordsForDate(allRecords: IStaffRecord[], targetDate: Date): ISRSRecord[] {
  const recordsForDate = allRecords.filter(record => {
    if (!record.Date) return false;
    const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.Date);
    const normalizedTarget = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    return SRSDateUtils.areDatesEqual(recordDate, normalizedTarget);
  });

  console.log('[SRSButtonHandlerOk2] Collected records for date:', {
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    recordsFound: recordsForDate.length
  });

  return recordsForDate.map(staffRecord => convertStaffRecordToSRS(staffRecord));
}

/**
 * Converts IStaffRecord to ISRSRecord format
 */
function convertStaffRecordToSRS(staffRecord: IStaffRecord): ISRSRecord {
  const normalizedDate = staffRecord.Date 
    ? SRSDateUtils.normalizeDateToLocalMidnight(staffRecord.Date) 
    : new Date();

  return {
    id: staffRecord.ID,
    date: normalizedDate,
    dayOfWeek: getDayOfWeek(normalizedDate),
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

/**
 * Gets day of week string for a date
 */
function getDayOfWeek(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()] || 'Unknown';
}

/**
 * Generates export statistics
 */
function generateExportStatistics(records: ISRSRecord[], holidays: IHoliday[]): IExportStatistics {
  const totalRecords = records.length;
  const checkedRecords = records.filter(r => r.checked).length;
  const validRecords = records.filter(r => validateRecordForExport(r).isValid).length;
  const invalidRecords = totalRecords - validRecords;
  
  const holidayRecords = records.filter(record => {
    return holidays.some(holiday => {
      const holidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
      const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.date);
      return SRSDateUtils.areDatesEqual(holidayDate, recordDate);
    });
  }).length;
  
  const leaveRecords = records.filter(r => 
    r.typeOfLeave && r.typeOfLeave !== '' && r.typeOfLeave !== '0'
  ).length;

  return {
    totalRecords,
    checkedRecords,
    validRecords,
    invalidRecords,
    holidayRecords,
    leaveRecords
  };
}

/**
 * Validates a record for export
 */
function validateRecordForExport(record: ISRSRecord): IRecordValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate basic fields
  if (!record.id) {
    errors.push('Record ID is required');
  }

  if (!record.date) {
    errors.push('Record date is required');
  }

  if (record.deleted) {
    errors.push('Cannot export deleted records');
  }

  // Validate contract
  const contract = parseInt(record.contract, 10);
  if (isNaN(contract) || contract < 1 || contract > 3) {
    errors.push('Invalid contract number');
  }

  // Validate time fields
  const startHour = parseInt(record.startWork.hours, 10);
  const startMinute = parseInt(record.startWork.minutes, 10);
  const finishHour = parseInt(record.finishWork.hours, 10);
  const finishMinute = parseInt(record.finishWork.minutes, 10);

  if (isNaN(startHour) || startHour < 0 || startHour > 23) {
    errors.push('Invalid start hour');
  }

  if (isNaN(startMinute) || startMinute < 0 || startMinute > 59) {
    errors.push('Invalid start minute');
  }

  if (isNaN(finishHour) || finishHour < 0 || finishHour > 23) {
    errors.push('Invalid finish hour');
  }

  if (isNaN(finishMinute) || finishMinute < 0 || finishMinute > 59) {
    errors.push('Invalid finish minute');
  }

  // Check for same start/end time
  if (startHour === finishHour && startMinute === finishMinute && 
      (startHour !== 0 || startMinute !== 0)) {
    warnings.push('Start and end times are the same');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Sets processing status for records
 */
async function setProcessingStatus(
  service: StaffRecordsService,
  records: ISRSRecord[],
  status: 'processing' | 'completed',
  exportResult?: number,
  title?: string
): Promise<void> {
  const updatePromises = records.map(record => {
    const updateData: Partial<IStaffRecord> = {};

    if (status === 'processing') {
      updateData.ExportResult = 0;
      updateData.Title = 'Processing Export...';
    } else if (status === 'completed') {
      updateData.ExportResult = exportResult || 1;
      updateData.Title = title || 'Export Completed';
    }

    return service.updateStaffRecord(record.id, updateData);
  });

  await Promise.all(updatePromises);
  console.log('[SRSButtonHandlerOk2] Updated status for', records.length, 'records:', status);
}

/**
 * Updates UI state during processing
 */
function updateUIState(
  setState: (updater: (prev: ISRSTabState) => ISRSTabState) => void,
  currentState: ISRSTabState,
  checkedRecords: ISRSRecord[],
  exportResult: number
): void {
  setState(prevState => {
    const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
      if (checkedRecords.some(r => r.id === record.ID)) {
        return { ...record, ExportResult: exportResult };
      }
      return record;
    });
    return { ...prevState, srsRecords: newSrsRecords };
  });
}

/**
 * Generates status title based on export result
 */
function generateStatusTitle(success: boolean, targetDate: Date, error?: string): string {
  const dateStr = SRSDateUtils.formatDateForDisplay(targetDate);
  
  if (success) {
    return `Exported to Excel on ${dateStr}`;
  } else {
    return `Export Failed on ${dateStr}${error ? `: ${error}` : ''}`;
  }
}

/**
 * Generates user-friendly message
 */
function generateUserMessage(exportResult: ISRSButtonOperationResult, recordCount: number): string {
  if (exportResult.success) {
    return `Successfully exported ${recordCount} record${recordCount === 1 ? '' : 's'} to Excel.`;
  } else {
    return `Export failed: ${exportResult.error || 'Unknown error'}`;
  }
}

/**
 * Performs the actual Excel export operation
 */
async function performExcelExport(params: IExcelExportParams): Promise<ISRSButtonOperationResult> {
  const { records, targetDate, selectedStaff, context } = params;
  const startTime = Date.now();

  console.log('[SRSButtonHandlerOk2] Starting Excel export:', {
    recordCount: records.length,
    targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
    filePath: selectedStaff.pathForSRSFile,
    typeOfSRS: selectedStaff.typeOfSRS
  });

  try {
    // Determine SRS type
    const typeOfSRS: SRSType = determineSRSType(selectedStaff.typeOfSRS);
    console.log('[SRSButtonHandlerOk2] Using SRS type:', typeOfSRS);

    // Prepare export data
    const exportData = SRSExcelDataMapper.prepareSRSDataForExcelExport(
      records, 
      targetDate, 
      typeOfSRS
    );

    if (exportData.records.length === 0) {
      throw new Error('No valid records available for export after filtering and validation');
    }

    console.log('[SRSButtonHandlerOk2] Export data prepared:', {
      originalRecords: records.length,
      validRecords: exportData.records.length,
      maxRows: exportData.metadata.maxRows
    });

    // Initialize services
    const graphApiService = GraphApiService.getInstance(context);
    const excelService = ExcelService.getInstance();

    // Download Excel file
    console.log('[SRSButtonHandlerOk2] Downloading Excel file...');
    const fileBuffer = await graphApiService.downloadExcelFile(selectedStaff.pathForSRSFile);

    // Load workbook
    console.log('[SRSButtonHandlerOk2] Loading workbook...');
    const workbook = await excelService.loadWorkbookFromBuffer(fileBuffer);
    const worksheet = excelService.getWorksheet(workbook, SRS_EXCEL_CONSTANTS.WORKSHEET_NAME);

    // Process export
    console.log('[SRSButtonHandlerOk2] Processing Excel export...');
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
        operation: 'error',
        error: processingResult.error || 'Excel processing failed',
        processingTime: Date.now() - startTime
      };
    }

    console.log('[SRSButtonHandlerOk2] Excel processing completed:', {
      recordsProcessed: processingResult.recordsProcessed,
      cellsUpdated: processingResult.cellsUpdated,
      commentsAdded: processingResult.commentsAdded
    });

    // Save and upload workbook
    console.log('[SRSButtonHandlerOk2] Saving workbook...');
    const updatedBuffer = await excelService.saveWorkbookToBuffer(workbook);

    console.log('[SRSButtonHandlerOk2] Uploading file...');
    const uploadSuccess = await graphApiService.uploadExcelFile(
      selectedStaff.pathForSRSFile, 
      updatedBuffer
    );

    if (!uploadSuccess) {
      return {
        success: false,
        operation: 'error',
        error: 'Failed to upload updated Excel file',
        processingTime: Date.now() - startTime
      };
    }

    console.log('[SRSButtonHandlerOk2] Excel export completed successfully');

    return {
      success: true,
      operation: 'excel_export',
      message: processingResult.message,
      recordsProcessed: processingResult.recordsProcessed,
      cellsUpdated: processingResult.cellsUpdated,
      processingTime: Date.now() - startTime,
      excelFilePath: selectedStaff.pathForSRSFile
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during Excel export';
    console.error('[SRSButtonHandlerOk2] Excel export error:', errorMsg);

    return {
      success: false,
      operation: 'error',
      error: errorMsg,
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * Determines SRS type from configuration
 */
function determineSRSType(typeOfSRS?: number): SRSType {
  // Fixed: Remove duplicate else-if condition
  if (typeOfSRS === 3) {
    return 3;
  } else {
    return 2; // Default to type 2
  }
}