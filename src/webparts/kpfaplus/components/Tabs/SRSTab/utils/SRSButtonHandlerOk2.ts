// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSButtonHandler.ts

import { ISRSRecord, ISRSTabState } from './SRSTabInterfaces';
import { IHoliday } from '../../../../services/HolidaysService';
import { ISRSTypeOfLeave } from './SRSTabInterfaces';
import { SRSDateUtils } from './SRSDateUtils';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { spfi, SPFx, SPFI } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/files";
import "@pnp/sp/folders";
import * as ExcelJS from 'exceljs';

/**
 * Interface for SRS Button Handler parameters
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
 * Result of SRS button operation
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
 * Main function to handle SRS button click - Excel export functionality
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
    refreshSRSData,
    setState
  } = params;

  console.log('[SRSButtonHandler] *** SRS BUTTON HANDLER STARTED ***');
  console.log('[SRSButtonHandler] Item details:', {
    id: item.id,
    date: item.date.toLocaleDateString(),
    dateISO: item.date.toISOString(),
    currentCheckedStatus: item.checked,
    currentExportResultStatus: item.srs,
    selectedStaff: selectedStaff.name,
    excelFilePath: selectedStaff.pathForSRSFile,
    typeOfSRS: selectedStaff.typeOfSRS || 'default(2)'
  });

  // Validation of input parameters
  console.log('[SRSButtonHandler] *** VALIDATING PARAMETERS ***');

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

  if (!currentUserId || currentUserId === '0') {
    console.error('[SRSButtonHandler] Current user ID is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Current user ID is not available'
    };
  }

  if (!managingGroupId || managingGroupId === '0') {
    console.error('[SRSButtonHandler] Managing group ID is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Managing group ID is not available'
    };
  }

  if (!selectedStaff.pathForSRSFile || selectedStaff.pathForSRSFile.trim() === '') {
    console.error('[SRSButtonHandler] Excel file path is not available');
    return {
      success: false,
      operation: 'error',
      error: 'Excel file path is not configured for selected staff',
      userMessage: 'Path to Excel file is not configured for selected staff'
    };
  }

  if (item.deleted) {
    console.warn('[SRSButtonHandler] Cannot perform Excel export on deleted record');
    return {
      success: false,
      operation: 'error',
      error: 'Cannot perform Excel export on deleted record',
      userMessage: 'Cannot export deleted record'
    };
  }

  console.log('[SRSButtonHandler] All parameters validated successfully');

  // Analyze current state and collect data
  console.log('[SRSButtonHandler] *** COLLECTING RECORDS FOR EXCEL EXPORT ***');

  // Check if the date is a holiday
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

  console.log('[SRSButtonHandler] Date analysis:', {
    itemDate: item.date.toLocaleDateString(),
    isHolidayDate,
    holidayTitle: holidayInfo?.title || 'Not a holiday',
    totalHolidays: holidays.length
  });

  try {
    // 1. Collect all records for the target date
    const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    const recordsForDate = collectRecordsForDate(state.srsRecords, targetDate);
    
    console.log('[SRSButtonHandler] Records collected for date:', {
      targetDate: SRSDateUtils.formatDateForDisplay(targetDate),
      totalRecords: recordsForDate.length,
      recordIds: recordsForDate.map(r => r.id)
    });

    // 2. Filter only checked records (checked=true)
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
        userMessage: 'No checked records found for export on selected date'
      };
    }

    // 3. Set processing status (ExportResult = 0) via StaffRecordsService
    console.log('[SRSButtonHandler] *** SETTING PROCESSING STATUS ***');

    const staffRecordsService = StaffRecordsService.getInstance(context);

    for (const record of checkedRecords) {
      const updateDataProcessing: Partial<IStaffRecord> = {
        ExportResult: 0, // Processing
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

    // Update local state for immediate display
    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        const targetRecord = checkedRecords.find(r => r.id === record.ID);
        if (targetRecord) {
          return {
            ...record,
            ExportResult: 0 // Processing
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

    // 4. Perform Simple Excel Export (using PnP SP)
    console.log('[SRSButtonHandler] *** PERFORMING SIMPLE EXCEL EXPORT ***');

    const exportResult = await performSimpleExcelExport(checkedRecords, selectedStaff, context);

    // 5. Update final status (ExportResult = 2 success or 1 error)
    console.log('[SRSButtonHandler] *** UPDATING FINAL STATUS ***');

    const finalExportResult = exportResult.success ? 2 : 1; // 2 = success, 1 = error
    const finalTitle = exportResult.success 
      ? `Exported to Excel on ${SRSDateUtils.formatDateForDisplay(targetDate)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`
      : `Export Failed on ${SRSDateUtils.formatDateForDisplay(targetDate)}${isHolidayDate ? ` (${holidayInfo?.title})` : ''}`;

    for (const record of checkedRecords) {
      const updateDataFinal: Partial<IStaffRecord> = {
        ExportResult: finalExportResult,
        Title: finalTitle
      };

      const success = await staffRecordsService.updateStaffRecord(record.id, updateDataFinal);
      
      if (!success) {
        console.warn('[SRSButtonHandler] Failed to update final status for record:', record.id);
      }
    }

    // Update local state with final status
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

    // 6. Refresh data from server
    console.log('[SRSButtonHandler] *** REFRESHING DATA FROM SERVER ***');
    setTimeout(() => {
      void refreshSRSData();
    }, 500);

    // 7. Return result
    if (exportResult.success) {
      const result: ISRSButtonOperationResult = {
        success: true,
        operation: 'excel_export',
        recordId: item.id,
        message: `Successfully exported ${checkedRecords.length} records to Excel`,
        userMessage: `Successfully exported ${checkedRecords.length} records to Excel`,
        processingTime: exportResult.processingTime,
        recordsProcessed: checkedRecords.length,
        cellsUpdated: exportResult.cellsUpdated || 0,
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

    // Set error status via StaffRecordsService
    try {
      const staffRecordsService = StaffRecordsService.getInstance(context);
      const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
      
      const errorUpdateData: Partial<IStaffRecord> = {
        ExportResult: 1, // Error
        Title: `Export Error on ${SRSDateUtils.formatDateForDisplay(targetDate)}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };

      await staffRecordsService.updateStaffRecord(item.id, errorUpdateData);
      
      // Update local state
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

    // Show error in component state
    setState(prevState => ({
      ...prevState,
      errorSRS: `Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    }));

    return {
      success: false,
      operation: 'error',
      recordId: item.id,
      error: error instanceof Error ? error.message : 'Unknown error occurred during Excel export',
      userMessage: 'An error occurred during Excel export'
    };
  }
}

/**
 * Simple Excel export function using PnP SP (like your first program)
 * This will actually modify the Excel file
 */
async function performSimpleExcelExport(
  checkedRecords: ISRSRecord[], 
  selectedStaff: ISRSButtonHandlerParams['selectedStaff'], 
  context: WebPartContext
): Promise<{ success: boolean; error?: string; processingTime: number; cellsUpdated?: number }> {
  
  const startTime = Date.now();
  console.log('[SRSButtonHandler] *** STARTING SIMPLE EXCEL EXPORT ***');
  
  try {
    // Initialize PnP SP
    const sp: SPFI = spfi().using(SPFx(context));
    
    // Get site name from context (similar to your first program)
    const siteUrl = context.pageContext.web.serverRelativeUrl;
    const siteName = siteUrl.split('/').filter(Boolean)[1];
    
    // Construct full file path
    const fullFilePath = `/sites/${siteName}/${selectedStaff.pathForSRSFile}`;
    
    console.log('[SRSButtonHandler] Excel file details:', {
      siteName,
      pathForSRSFile: selectedStaff.pathForSRSFile,
      fullFilePath,
      recordsToProcess: checkedRecords.length
    });

    // 1. Download Excel file using PnP SP (like your first program)
    console.log('[SRSButtonHandler] Step 1: Downloading Excel file...');
    const fileBuffer = await sp.web.getFileByServerRelativePath(fullFilePath).getBuffer();
    console.log('[SRSButtonHandler] File downloaded successfully, size:', fileBuffer.byteLength);

    // 2. Load workbook with ExcelJS
    console.log('[SRSButtonHandler] Step 2: Loading workbook...');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    console.log('[SRSButtonHandler] Workbook loaded, worksheets:', workbook.worksheets.map(ws => ws.name));

    // 3. Find target worksheet
    const targetWorksheetName = '2.Employee  Data Entry';
    const worksheet = workbook.getWorksheet(targetWorksheetName);
    
    if (!worksheet) {
      console.error('[SRSButtonHandler] Target worksheet not found:', targetWorksheetName);
      return {
        success: false,
        error: `Worksheet "${targetWorksheetName}" not found in Excel file`,
        processingTime: Date.now() - startTime
      };
    }
    
    console.log('[SRSButtonHandler] Target worksheet found:', worksheet.name);

    // 4. Simple Excel modification for testing
    console.log('[SRSButtonHandler] Step 3: Modifying Excel file...');
    let cellsUpdated = 0;
    
    // Find a cell to write test data (for example, write to B2)
    const testCell = worksheet.getCell('B2');
    const oldValue = testCell.value;
    
    // Write simple test data
    const testData = `SRS Export Test - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
    testCell.value = testData;
    cellsUpdated++;
    
    console.log('[SRSButtonHandler] Test modification:', {
      cell: 'B2',
      oldValue: oldValue,
      newValue: testData,
      recordsCount: checkedRecords.length
    });

    // Add a comment to show which records were processed
    if (checkedRecords.length > 0) {
      const commentText = `Processed ${checkedRecords.length} records: ${checkedRecords.map(r => r.id).join(', ')}`;
      
      // Add comment to cell (ExcelJS way)
      try {
        (testCell as any).note = commentText;
        console.log('[SRSButtonHandler] Added comment to B2:', commentText);
      } catch (commentError) {
        console.warn('[SRSButtonHandler] Could not add comment:', commentError);
      }
    }

    // Optional: Write some record data to verify functionality
    if (checkedRecords.length > 0) {
      const firstRecord = checkedRecords[0];
      
      // Write first record data to C2, D2, E2 for testing
      worksheet.getCell('C2').value = `Start: ${firstRecord.startWork.hours}:${firstRecord.startWork.minutes}`;
      worksheet.getCell('D2').value = `End: ${firstRecord.finishWork.hours}:${firstRecord.finishWork.minutes}`;
      worksheet.getCell('E2').value = `Contract: ${firstRecord.contract}`;
      cellsUpdated += 3;
      
      console.log('[SRSButtonHandler] Added sample record data to C2:E2');
    }

    // 5. Save workbook back to buffer
    console.log('[SRSButtonHandler] Step 4: Saving workbook...');
    const updatedBuffer = await workbook.xlsx.writeBuffer();
    console.log('[SRSButtonHandler] Workbook saved to buffer, size:', updatedBuffer.byteLength);

    // 6. Upload updated file back to SharePoint using PnP SP
    console.log('[SRSButtonHandler] Step 5: Uploading updated file...');
    await sp.web.getFileByServerRelativePath(fullFilePath).setContent(updatedBuffer);
    console.log('[SRSButtonHandler] File uploaded successfully');

    const processingTime = Date.now() - startTime;
    
    console.log('[SRSButtonHandler] *** SIMPLE EXCEL EXPORT COMPLETED SUCCESSFULLY ***');
    console.log('[SRSButtonHandler] Summary:', {
      processingTime: `${processingTime}ms`,
      cellsUpdated,
      recordsProcessed: checkedRecords.length,
      filePath: fullFilePath
    });
    
    return {
      success: true,
      processingTime,
      cellsUpdated
    };

  } catch (error) {
    console.error('[SRSButtonHandler] Error in simple Excel export:', error);
    
    const processingTime = Date.now() - startTime;
    let errorMessage = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    
    // Provide more specific error messages
    if (errorMessage.includes('404') || errorMessage.includes('not found')) {
      errorMessage = 'Excel file not found. Check the file path in staff configuration.';
    } else if (errorMessage.includes('403') || errorMessage.includes('access denied')) {
      errorMessage = 'Access denied to Excel file. Check permissions.';
    } else if (errorMessage.includes('Worksheet') && errorMessage.includes('not found')) {
      errorMessage = 'Required worksheet not found in Excel file.';
    }
    
    return {
      success: false,
      error: errorMessage,
      processingTime
    };
  }
}

/**
 * Helper Functions
 */

/**
 * Collects all records for specified date from state
 */
function collectRecordsForDate(allRecords: IStaffRecord[], targetDate: Date): ISRSRecord[] {
  console.log('[SRSButtonHandler] Collecting records for date:', SRSDateUtils.formatDateForDisplay(targetDate));

  const recordsForDate = allRecords.filter(record => {
    if (!record.Date) return false;
    
    const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.Date);
    const normalizedTargetDate = SRSDateUtils.normalizeDateToLocalMidnight(targetDate);
    
    return SRSDateUtils.areDatesEqual(recordDate, normalizedTargetDate);
  });

  // Convert IStaffRecord to ISRSRecord
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
 * Converts IStaffRecord to ISRSRecord for data collection
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
    srs: staffRecord.ExportResult === 2,
    checked: staffRecord.Checked === 1,
    deleted: staffRecord.Deleted === 1,
    Holiday: 0
  };
}

/**
 * Gets user-friendly error message for Excel export errors
 */
function getExcelExportErrorMessage(error?: string): string {
  if (!error) {
    return 'An unknown error occurred during Excel export';
  }

  if (error.includes('locked') || error.includes('Locked')) {
    return 'Excel file is locked. Close the file and try again.';
  }
  
  if (error.includes('not found') || error.includes('Not Found')) {
    return 'Excel file not found. Check the file path.';
  }
  
  if (error.includes('access denied') || error.includes('Access Denied')) {
    return 'No access to Excel file. Check access permissions.';
  }
  
  return error;
}

/**
 * Additional utility functions for ExportResult operations
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

export function getExportResultOperationDescription(currentExportResultStatus: boolean, item: ISRSRecord, isHoliday: boolean, holidayTitle?: string): string {
  const operation = 'Export to Excel';
  const date = SRSDateUtils.formatDateForDisplay(item.date);
  const holidayText = isHoliday ? ` (${holidayTitle || 'Holiday'})` : '';
  const leaveText = item.typeOfLeave ? ` - ${item.typeOfLeave}` : '';
  
  return `${operation} for ${date}${holidayText}${leaveText}`;
}

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

console.log('[SRSButtonHandler] *** SIMPLE EXCEL MODIFICATION HANDLER LOADED ***');
console.log('[SRSButtonHandler] Features available:', {
  mainHandler: 'handleSRSButtonClick (with actual Excel modification)',
  excelMethod: 'PnP SP download/upload + ExcelJS processing',
  testModification: 'Writes test data to B2 cell + sample record data to C2:E2',
  servicesUsed: [
    'StaffRecordsService (SharePoint updates)',
    'PnP SP (file operations)',
    'ExcelJS (Excel processing)'
  ],
  utilities: [
    'canPerformExportResultOperation',
    'getExportResultOperationDescription', 
    'createExportResultRecordTitle'
  ],
  exportResultStatuses: {
    0: 'Processing',
    1: 'Error', 
    2: 'Success'
  },
  errorHandling: 'Comprehensive error catching with user-friendly messages',
  stateManagement: 'Local state update + server data refresh'
});