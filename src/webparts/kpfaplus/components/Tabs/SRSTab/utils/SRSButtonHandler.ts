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
  // **ИСПРАВЛЕНО**: Удален некорректный импорт ISRSButtonOperationResult
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelExport/SRSExcelInterfaces';


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

// **ИСПРАВЛЕНО**: Интерфейс определен локально, как и должно быть.
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


export async function handleSRSButtonClick(params: ISRSButtonHandlerParams): Promise<ISRSButtonOperationResult> {
  const {
    item,
    context,
    selectedStaff,
    state,
    refreshSRSData,
    setState
  } = params;

  console.log('[SRSButtonHandler] *** SRS EXCEL EXPORT HANDLER STARTED ***');

  try {
    const targetDate = SRSDateUtils.normalizeDateToLocalMidnight(item.date);
    const recordsForDate = collectRecordsForDate(state.srsRecords, targetDate);
    const checkedRecords = recordsForDate.filter(record => record.checked === true && !record.deleted);

    if (checkedRecords.length === 0) {
      return { success: false, operation: 'error', error: 'No checked records found for export' };
    }

    const staffRecordsService = StaffRecordsService.getInstance(context);

    for (const record of checkedRecords) {
      await staffRecordsService.updateStaffRecord(record.id, { ExportResult: 0, Title: `Processing Export...` });
    }

    setState(prevState => {
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        if (checkedRecords.some(r => r.id === record.ID)) {
          return { ...record, ExportResult: 0 };
        }
        return record;
      });
      return { ...prevState, srsRecords: newSrsRecords };
    });

    const exportResult = await performExcelExport({
      records: checkedRecords,
      targetDate: targetDate,
      selectedStaff: selectedStaff,
      context: context
    });

    const finalExportResult = exportResult.success ? 2 : 1;
    const finalTitle = exportResult.success
      ? `Exported to Excel on ${SRSDateUtils.formatDateForDisplay(targetDate)}`
      : `Export Failed on ${SRSDateUtils.formatDateForDisplay(targetDate)}`;

    for (const record of checkedRecords) {
      await staffRecordsService.updateStaffRecord(record.id, { ExportResult: finalExportResult, Title: finalTitle });
    }

    setTimeout(() => { void refreshSRSData(); }, 500);

    return {
      recordId: item.id,
      userMessage: exportResult.success ? `Successfully exported ${checkedRecords.length} records.` : `Export failed: ${exportResult.error}`,
      ...exportResult
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during main handler';
    console.error(`[SRSButtonHandler] Critical error: ${errorMsg}`);
    try {
        const staffRecordsService = StaffRecordsService.getInstance(context);
        await staffRecordsService.updateStaffRecord(item.id, { ExportResult: 1, Title: `Export Failed: ${errorMsg}` });
        setTimeout(() => { void refreshSRSData(); }, 500);
    } catch {
        // **FIXED**: Removed unused 'statusError' variable
        console.error(`[SRSButtonHandler] Failed to even set error status for record ${item.id}`);
    }
    return { success: false, operation: 'error', error: errorMsg };
  }
}

async function performExcelExport(params: {
  records: ISRSRecord[];
  targetDate: Date;
  selectedStaff: ISRSButtonHandlerParams['selectedStaff'];
  context: WebPartContext;
}): Promise<ISRSButtonOperationResult> {

  const { records, targetDate, selectedStaff, context } = params;
  const startTime = Date.now();

  try {
    const typeOfSRS: SRSType = (selectedStaff.typeOfSRS === 3) ? 3 : 2;
    const exportData = SRSExcelDataMapper.prepareSRSDataForExcelExport(records, targetDate, typeOfSRS);

    if (exportData.records.length === 0) {
        throw new Error("No valid records were available for export after filtering and validation.");
    }

    const graphApiService = GraphApiService.getInstance(context);
    const excelService = ExcelService.getInstance();

    const fileBuffer = await graphApiService.downloadExcelFile(selectedStaff.pathForSRSFile);
    const workbook = await excelService.loadWorkbookFromBuffer(fileBuffer);
    const worksheet = excelService.getWorksheet(workbook, SRS_EXCEL_CONSTANTS.WORKSHEET_NAME);

    const processor = new SRSExcelProcessor();
    const dateString = SRSDateUtils.formatDateForExcelSearch(targetDate);

    const processingResult = await processor.processSRSExcelExport(workbook, worksheet, dateString, typeOfSRS, exportData);

    if (!processingResult.success) {
      return { success: false, operation: 'error', error: processingResult.error, processingTime: Date.now() - startTime };
    }

    const updatedBuffer = await excelService.saveWorkbookToBuffer(workbook);
    const uploadSuccess = await graphApiService.uploadExcelFile(selectedStaff.pathForSRSFile, updatedBuffer);

    if (!uploadSuccess) {
      return { success: false, operation: 'error', error: 'Failed to upload updated Excel file', processingTime: Date.now() - startTime };
    }

    return {
      success: true,
      operation: 'excel_export',
      message: processingResult.message,
      recordsProcessed: processingResult.recordsProcessed,
      cellsUpdated: processingResult.cellsUpdated,
      processingTime: Date.now() - startTime,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error during Excel export';
    console.error(`[SRSButtonHandler] Error in performExcelExport: ${errorMsg}`);
    return { success: false, operation: 'error', error: errorMsg, processingTime: Date.now() - startTime };
  }
}

function collectRecordsForDate(allRecords: IStaffRecord[], targetDate: Date): ISRSRecord[] {
  const recordsForDate = allRecords.filter(record => {
    if (!record.Date) return false;
    return SRSDateUtils.areDatesEqual(SRSDateUtils.normalizeDateToLocalMidnight(record.Date), SRSDateUtils.normalizeDateToLocalMidnight(targetDate));
  });
  return recordsForDate.map(staffRecord => convertStaffRecordToSRS(staffRecord));
}

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