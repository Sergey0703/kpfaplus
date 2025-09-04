// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelProcessor.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelExportData,
  ISRSExcelOperationResult,
  ISRSExcelProcessingStats,
  ISRSExcelError,
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelInterfaces';
import { SRSExcelValidationAndUtils } from './SRSExcelValidationAndUtils';
import { SRSExcelDataCleaning } from './SRSExcelDataCleaning';
import { SRSExcelCellOperations } from './SRSExcelCellOperations';
import { SRSExcelProcessingHelpers } from './SRSExcelProcessingHelpers';

/**
 * Main orchestrator for SRS Excel export processing
 * Coordinates all Excel operations through specialized services
 */
export class SRSExcelProcessor {
  private logs: string[];
  private stats: ISRSExcelProcessingStats;
  private validationUtils: SRSExcelValidationAndUtils;
  private dataCleaning: SRSExcelDataCleaning;
  private cellOperations: SRSExcelCellOperations;
  private processingHelpers: SRSExcelProcessingHelpers;

  constructor() {
    this.logs = [];
    this.stats = this.initializeStats();
    
    // Initialize specialized services
    this.validationUtils = new SRSExcelValidationAndUtils(this.addLog.bind(this), this.createProcessingError.bind(this));
    this.dataCleaning = new SRSExcelDataCleaning(this.addLog.bind(this), this.updateStats.bind(this));
    this.cellOperations = new SRSExcelCellOperations(this.addLog.bind(this));
    this.processingHelpers = new SRSExcelProcessingHelpers(this.addLog.bind(this), this.updateStats.bind(this));
  }

  /**
   * *** MAIN FUNCTION: Processes SRS data export to Excel ***
   * Orchestrates the entire export process through specialized services
   */
  public async processSRSExcelExport(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    date: string,
    typeOfSRS: SRSType,
    exportData: ISRSExcelExportData
  ): Promise<ISRSExcelOperationResult> {
    console.log('[SRSExcelProcessor] *** STARTING SRS EXCEL EXPORT PROCESSING ***');
    console.log('[SRSExcelProcessor] Parameters:', {
      date,
      typeOfSRS,
      recordsCount: exportData.records.length,
      maxRows: exportData.metadata.maxRows
    });

    const startTime: number = Date.now();
    this.resetProcessor();
    this.stats.typeOfSRS = typeOfSRS;
    this.stats.inputRecords = exportData.records.length;

    try {
      // Step 1: Validate all input data
      console.log('[SRSExcelProcessor] === STEP 1: VALIDATION ===');
      this.validationUtils.validateInputData(workbook, worksheet, date, typeOfSRS, exportData);
      
      // Step 2: Determine maximum rows and find target date
      console.log('[SRSExcelProcessor] === STEP 2: PREPARATION ===');
      const maxPossibleRows: number = this.validationUtils.getMaxRowsForType(typeOfSRS);
      this.addLog(`Received ${exportData.records.length} records for processing. Type: ${typeOfSRS}`);

      const baseRowIndex: number = this.validationUtils.findDateInWorksheet(worksheet, date);
      this.addLog(`Found target date "${date}" at row ${baseRowIndex + 1} (0-based: ${baseRowIndex})`);

      // Step 3: Clean all target rows and comments
      console.log('[SRSExcelProcessor] === STEP 3: DATA CLEANING ===');
      this.dataCleaning.clearAllRows(worksheet, typeOfSRS, baseRowIndex, maxPossibleRows);
      this.dataCleaning.clearCommentsInRows(worksheet, baseRowIndex, maxPossibleRows);

      // Step 4: Process all SRS records
      console.log('[SRSExcelProcessor] === STEP 4: RECORD PROCESSING ===');
      const processingResult = await this.processingHelpers.processAllRecords(
        worksheet, 
        exportData.records, 
        typeOfSRS, 
        baseRowIndex,
        this.cellOperations
      );

      // Update statistics from processing result
      this.stats.cellsUpdated = processingResult.cellsUpdated;
      this.stats.commentsAdded = processingResult.commentsAdded;
      this.stats.processedRecords = processingResult.recordsProcessed;

      // Step 5: Finalize processing
      console.log('[SRSExcelProcessor] === STEP 5: FINALIZATION ===');
      this.finalizeProcessing(startTime);

      const result: ISRSExcelOperationResult = {
        success: true,
        operation: 'export_to_excel',
        message: `Successfully processed ${exportData.records.length} records`,
        processingTime: this.stats.totalTime,
        recordsProcessed: this.stats.processedRecords,
        cellsUpdated: this.stats.cellsUpdated,
        commentsAdded: this.stats.commentsAdded,
        dateFound: true,
        dateRowIndex: baseRowIndex,
        typeOfSRS,
        maxRows: maxPossibleRows
      };

      console.log('[SRSExcelProcessor] *** SRS EXCEL EXPORT COMPLETED SUCCESSFULLY ***', result);
      return result;

    } catch (error) {
      return this.handleError(error, startTime, typeOfSRS);
    }
  }

  /**
   * Initializes processing statistics
   */
  private initializeStats(): ISRSExcelProcessingStats {
    return {
      totalTime: 0,
      inputRecords: 0,
      processedRecords: 0,
      skippedRecords: 0,
      cellsCleared: 0,
      cellsUpdated: 0,
      commentsAdded: 0,
      commentsCleared: 0,
      typeOfSRS: SRS_EXCEL_CONSTANTS.DEFAULT_SRS_TYPE,
      contractsProcessed: new Set<number>(),
      leaveTypesProcessed: new Set<number>(),
      success: false,
      warnings: [],
      errors: []
    };
  }

  /**
   * Resets processor to initial state
   */
  private resetProcessor(): void {
    this.logs = [];
    this.stats = this.initializeStats();
  }

  /**
   * Updates statistics during processing
   */
  private updateStats(updates: Partial<ISRSExcelProcessingStats>): void {
    Object.assign(this.stats, updates);
  }

  /**
   * Finalizes processing with statistics
   */
  private finalizeProcessing(startTime: number): void {
    this.stats.totalTime = Date.now() - startTime;
    this.stats.success = true;
    this.stats.skippedRecords = this.stats.inputRecords - this.stats.processedRecords;
    
    console.log('[SRSExcelProcessor] *** PROCESSING FINALIZED ***');
    console.log('[SRSExcelProcessor] Final statistics:', this.stats);
  }

  /**
   * Handles processing errors with detailed logging
   */
  private handleError(error: unknown, startTime: number, typeOfSRS?: SRSType): ISRSExcelOperationResult {
    console.error('[SRSExcelProcessor] *** PROCESSING ERROR OCCURRED ***');
    console.error('[SRSExcelProcessor] Error details:', {
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error,
      stack: error instanceof Error ? error.stack : undefined,
      processingTime: Date.now() - startTime,
      typeOfSRS: typeOfSRS || 'unknown'
    });

    this.stats.totalTime = Date.now() - startTime;
    this.stats.success = false;
    
    const errorMessage: string = error instanceof Error ? error.message : String(error);
    this.stats.errors.push(errorMessage);
    this.addLog(`Error: ${errorMessage}`);

    console.error('[SRSExcelProcessor] Current processing statistics at error:', this.stats);
    console.error('[SRSExcelProcessor] Processing logs:', this.logs);

    return {
      success: false,
      operation: 'export_to_excel',
      error: errorMessage,
      processingTime: this.stats.totalTime,
      recordsProcessed: this.stats.processedRecords,
      typeOfSRS: typeOfSRS || SRS_EXCEL_CONSTANTS.DEFAULT_SRS_TYPE,
      dateFound: this.stats.processedRecords > 0
    };
  }

  /**
   * Adds entry to processing log
   */
  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(`[SRSExcelProcessor] ${message}`);
  }

  /**
   * Creates typed processing error
   */
  private createProcessingError(code: string, message: string, details?: unknown): ISRSExcelError {
    const error: ISRSExcelError = {
      code,
      message,
      operation: 'processSRSExcelExport',
      originalError: details
    };
    
    console.error('[SRSExcelProcessor] Created processing error:', error);
    return error;
  }

  /**
   * Gets current processing statistics
   */
  public getStats(): ISRSExcelProcessingStats {
    console.log('[SRSExcelProcessor] Current statistics requested:', this.stats);
    return { ...this.stats };
  }

  /**
   * Gets processing logs
   */
  public getLogs(): string[] {
    console.log('[SRSExcelProcessor] Processing logs requested:', {
      totalLogs: this.logs.length,
      logsPreview: this.logs.slice(-5) // Last 5 entries
    });
    return [...this.logs];
  }
}