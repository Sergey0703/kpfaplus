// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelProcessingHelpers.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelRecord,
  ISRSExcelProcessingStats,
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelInterfaces';
import { SRSExcelCellOperations } from './SRSExcelCellOperations';

/**
 * Interface for processing result
 */
export interface IProcessingResult {
  recordsProcessed: number;
  cellsUpdated: number;
  commentsAdded: number;
  errors: string[];
  warnings: string[];
}

/**
 * Service for SRS Excel processing coordination and helper operations
 * Handles record processing coordination, statistics, and utility functions
 */
export class SRSExcelProcessingHelpers {
  private addLog: (message: string) => void;
  private updateStats: (updates: Partial<ISRSExcelProcessingStats>) => void;

  constructor(
    addLogCallback: (message: string) => void,
    updateStatsCallback: (updates: Partial<ISRSExcelProcessingStats>) => void
  ) {
    this.addLog = addLogCallback;
    this.updateStats = updateStatsCallback;
  }

  /**
   * *** DETAILED LOGGING: Processes all SRS records ***
   * Main coordinator for processing all records in the export data
   */
  public async processAllRecords(
    worksheet: ExcelJS.Worksheet,
    records: ISRSExcelRecord[],
    typeOfSRS: SRSType,
    baseRowIndex: number,
    cellOperations: SRSExcelCellOperations
  ): Promise<IProcessingResult> {
    console.log('[SRSExcelProcessingHelpers] *** PROCESSING SRS RECORDS ***');
    console.log('[SRSExcelProcessingHelpers] Processing parameters:', {
      totalRecords: records.length,
      typeOfSRS,
      baseRowIndex,
      startingExcelRow: baseRowIndex + 1,
      worksheetName: worksheet.name
    });
    
    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;
    let recordsProcessed: number = 0;
    const processingErrors: string[] = [];
    const processingWarnings: string[] = [];
    const baseRow: number = baseRowIndex;

    // Analyze incoming records before processing
    const recordAnalysis = this.analyzeRecords(records);
    console.log('[SRSExcelProcessingHelpers] Record analysis:', recordAnalysis);

    // Process each record sequentially
    for (let recordIndex: number = 0; recordIndex < records.length; recordIndex++) {
      const record: ISRSExcelRecord = records[recordIndex];
      const currentRowIndex: number = baseRow + recordIndex + 1; // +1 because Excel is 1-indexed
      const recordNumber = recordIndex + 1;

      console.log('[SRSExcelProcessingHelpers] *** PROCESSING RECORD', recordNumber, 'OF', records.length, '***');

      try {
        const recordResult = await this.processSingleRecord(
          worksheet, 
          record, 
          typeOfSRS, 
          currentRowIndex, 
          recordNumber,
          cellOperations
        );

        cellsUpdated += recordResult.cellsUpdated;
        commentsAdded += recordResult.commentsAdded;
        recordsProcessed++;

        console.log('[SRSExcelProcessingHelpers] Record', recordNumber, 'processing completed:', {
          cellsUpdated: recordResult.cellsUpdated,
          commentsAdded: recordResult.commentsAdded,
          cumulativeCellsUpdated: cellsUpdated,
          cumulativeCommentsAdded: commentsAdded
        });

      } catch (recordError) {
        const errorMsg = `Error processing record ${recordNumber}: ${recordError}`;
        console.error('[SRSExcelProcessingHelpers]', errorMsg);
        processingErrors.push(errorMsg);
        
        // Continue processing remaining records
        continue;
      }
    }

    const result: IProcessingResult = {
      recordsProcessed,
      cellsUpdated,
      commentsAdded,
      errors: processingErrors,
      warnings: processingWarnings
    };

    console.log('[SRSExcelProcessingHelpers] *** ALL RECORDS PROCESSING COMPLETED ***');
    console.log('[SRSExcelProcessingHelpers] Final processing results:', {
      totalRecords: records.length,
      recordsProcessed,
      cellsUpdated,
      commentsAdded,
      processingErrors: processingErrors.length,
      successRate: `${Math.round((recordsProcessed / records.length) * 100)}%`
    });

    if (processingErrors.length > 0) {
      console.error('[SRSExcelProcessingHelpers] Processing errors encountered:', processingErrors);
    }

    this.addLog(`Processed ${records.length} records, updated ${cellsUpdated} cells, added ${commentsAdded} comments with ${processingErrors.length} errors`);

    // Update statistics through callback
    this.updateStats({
      processedRecords: recordsProcessed,
      cellsUpdated,
      commentsAdded,
      errors: processingErrors,
      warnings: processingWarnings
    });

    return result;
  }

  /**
   * Processes a single SRS record with comprehensive error handling
   */
  private async processSingleRecord(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    currentRowIndex: number,
    recordNumber: number,
    cellOperations: SRSExcelCellOperations
  ): Promise<{ cellsUpdated: number; commentsAdded: number }> {
    console.log('[SRSExcelProcessingHelpers] Processing single record details:', {
      recordNumber,
      excelRowIndex: currentRowIndex,
      contract: record.Contract,
      typeOfLeaveID: record.TypeOfLeaveID,
      shiftStart: record.ShiftStart,
      shiftEnd: record.ShiftEnd,
      lunchTime: record.LunchTime,
      leaveTime: record.LeaveTime
    });

    let totalCellsUpdated = 0;
    let totalCommentsAdded = 0;

    // Step 1: Process basic record data by type
    console.log('[SRSExcelProcessingHelpers] Step 1: Processing basic record by type');
    const basicResult = cellOperations.processRecordByType(worksheet, record, typeOfSRS, currentRowIndex);
    totalCellsUpdated += basicResult.cellsUpdated;
    totalCommentsAdded += basicResult.commentsAdded;

    console.log('[SRSExcelProcessingHelpers] Basic processing result:', {
      cellsUpdated: basicResult.cellsUpdated,
      commentsAdded: basicResult.commentsAdded
    });

    // Step 2: Process extended leave types (3-19) if applicable
    if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
        record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
      
      console.log('[SRSExcelProcessingHelpers] Step 2: Processing extended leave type', record.TypeOfLeaveID);
      
      const extendedResult = cellOperations.processExtendedLeaveType(worksheet, record, typeOfSRS, currentRowIndex);
      totalCellsUpdated += extendedResult.cellsUpdated;
      totalCommentsAdded += extendedResult.commentsAdded;
      
      console.log('[SRSExcelProcessingHelpers] Extended leave processing result:', extendedResult);
    } 
    // Step 3: Handle basic leave types (1-2) with comments
    else if (record.TypeOfLeaveID === 1 || record.TypeOfLeaveID === 2) {
      console.log('[SRSExcelProcessingHelpers] Step 3: Processing basic leave type', record.TypeOfLeaveID);
      
      if (record.LeaveNote) {
        const leaveColumn: string | undefined = cellOperations.getLeaveColumnForBasicTypes(typeOfSRS, record.Contract, record.TypeOfLeaveID);
        if (leaveColumn) {
          const cellAddress = `${leaveColumn}${currentRowIndex}`;
          console.log('[SRSExcelProcessingHelpers] Adding leave note to basic leave cell', cellAddress);
          
          const commentAdded = cellOperations.addCommentToCell(worksheet, cellAddress, record.LeaveNote);
          if (commentAdded) {
            totalCommentsAdded++;
            console.log('[SRSExcelProcessingHelpers] Successfully added leave note to', cellAddress);
          }
        } else {
          console.warn('[SRSExcelProcessingHelpers] Could not determine leave column for basic type', record.TypeOfLeaveID);
        }
      }
    }

    console.log('[SRSExcelProcessingHelpers] *** RECORD', recordNumber, 'PROCESSING COMPLETED ***');
    console.log('[SRSExcelProcessingHelpers] Final record result:', {
      totalCellsUpdated,
      totalCommentsAdded
    });

    return {
      cellsUpdated: totalCellsUpdated,
      commentsAdded: totalCommentsAdded
    };
  }

  /**
   * Analyzes records before processing to provide insights
   */
  public analyzeRecords(records: ISRSExcelRecord[]): {
    totalRecords: number;
    contractBreakdown: Record<number, number>;
    leaveTypeBreakdown: Record<number, number>;
    hasComments: boolean;
    hasExtendedLeaveTypes: boolean;
    timeRangeAnalysis: {
      earliestStart: Date | undefined;
      latestEnd: Date | undefined;
      averageLunchTime: number;
    };
    leaveTimeAnalysis: {
      totalLeaveTime: number;
      averageLeaveTime: number;
      maxLeaveTime: number;
    };
  } {
    console.log('[SRSExcelProcessingHelpers] *** ANALYZING RECORDS FOR PROCESSING ***');
    this.addLog(`Starting analysis of ${records.length} records`);
    
    const analysis = {
      totalRecords: records.length,
      contractBreakdown: {} as Record<number, number>,
      leaveTypeBreakdown: {} as Record<number, number>,
      hasComments: false,
      hasExtendedLeaveTypes: false,
      timeRangeAnalysis: {
        earliestStart: undefined as Date | undefined,
        latestEnd: undefined as Date | undefined,
        averageLunchTime: 0
      },
      leaveTimeAnalysis: {
        totalLeaveTime: 0,
        averageLeaveTime: 0,
        maxLeaveTime: 0
      }
    };

    let totalLunchMinutes = 0;

    records.forEach(record => {
      // Contract analysis
      analysis.contractBreakdown[record.Contract] = (analysis.contractBreakdown[record.Contract] || 0) + 1;
      
      // Leave type analysis
      analysis.leaveTypeBreakdown[record.TypeOfLeaveID] = (analysis.leaveTypeBreakdown[record.TypeOfLeaveID] || 0) + 1;
      
      // Comments check
      if (record.LunchNote || record.TotalHoursNote || record.LeaveNote) {
        analysis.hasComments = true;
      }
      
      // Extended leave types check
      if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
          record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
        analysis.hasExtendedLeaveTypes = true;
      }

      // Time range analysis
      if (record.ShiftStart instanceof Date) {
        if (!analysis.timeRangeAnalysis.earliestStart || record.ShiftStart < analysis.timeRangeAnalysis.earliestStart) {
          analysis.timeRangeAnalysis.earliestStart = record.ShiftStart;
        }
      }

      if (record.ShiftEnd instanceof Date) {
        if (!analysis.timeRangeAnalysis.latestEnd || record.ShiftEnd > analysis.timeRangeAnalysis.latestEnd) {
          analysis.timeRangeAnalysis.latestEnd = record.ShiftEnd;
        }
      }

      // Lunch time analysis (assuming LunchTime is Date representing duration)
      if (record.LunchTime instanceof Date) {
        const lunchMinutes = record.LunchTime.getHours() * 60 + record.LunchTime.getMinutes();
        totalLunchMinutes += lunchMinutes;
      }

      // Leave time analysis
      analysis.leaveTimeAnalysis.totalLeaveTime += record.LeaveTime;
      if (record.LeaveTime > analysis.leaveTimeAnalysis.maxLeaveTime) {
        analysis.leaveTimeAnalysis.maxLeaveTime = record.LeaveTime;
      }
    });

    // Calculate averages
    if (records.length > 0) {
      analysis.timeRangeAnalysis.averageLunchTime = totalLunchMinutes / records.length;
      analysis.leaveTimeAnalysis.averageLeaveTime = analysis.leaveTimeAnalysis.totalLeaveTime / records.length;
    }

    console.log('[SRSExcelProcessingHelpers] Record analysis completed:', analysis);
    this.addLog(`Analysis complete: ${analysis.contractBreakdown[1] || 0} Contract 1, ${analysis.contractBreakdown[2] || 0} Contract 2, ${analysis.hasExtendedLeaveTypes ? 'has' : 'no'} extended leave types`);
    
    return analysis;
  }

  /**
   * Validates processing parameters before execution
   */
  public validateProcessingParameters(
    worksheet: ExcelJS.Worksheet,
    records: ISRSExcelRecord[],
    typeOfSRS: SRSType,
    baseRowIndex: number
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    console.log('[SRSExcelProcessingHelpers] *** VALIDATING PROCESSING PARAMETERS ***');
    
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate worksheet
    if (!worksheet) {
      errors.push('Worksheet is required for processing');
    } else {
      if (worksheet.rowCount < baseRowIndex + records.length) {
        warnings.push(`Worksheet may not have enough rows. Current: ${worksheet.rowCount}, Required: ${baseRowIndex + records.length}`);
      }
    }

    // Validate records
    if (!records || records.length === 0) {
      errors.push('No records provided for processing');
    } else {
      if (records.length > 10) {
        warnings.push(`Large number of records to process: ${records.length}`);
      }

      // Validate individual records
      let invalidRecords = 0;
      records.forEach((record, index) => {
        if (!record.Contract || (record.Contract !== 1 && record.Contract !== 2)) {
          errors.push(`Record ${index + 1}: Invalid contract ${record.Contract}`);
          invalidRecords++;
        }

        if (record.TypeOfLeaveID < 0 || record.TypeOfLeaveID > 19) {
          errors.push(`Record ${index + 1}: Invalid TypeOfLeaveID ${record.TypeOfLeaveID}`);
          invalidRecords++;
        }

        if (!record.ShiftStart || !record.ShiftEnd || !record.LunchTime) {
          errors.push(`Record ${index + 1}: Missing required time fields`);
          invalidRecords++;
        }
      });

      if (invalidRecords > 0) {
        warnings.push(`${invalidRecords} records have validation issues`);
      }
    }

    // Validate SRS type
    if (typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_2 && typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      errors.push(`Invalid SRS type: ${typeOfSRS}. Must be 2 or 3`);
    }

    // Validate base row index
    if (baseRowIndex < 0) {
      errors.push('Base row index cannot be negative');
    }

    if (baseRowIndex > 1000) {
      warnings.push(`Very high base row index: ${baseRowIndex}`);
    }

    const result = {
      isValid: errors.length === 0,
      errors,
      warnings
    };

    console.log('[SRSExcelProcessingHelpers] Parameter validation result:', {
      isValid: result.isValid,
      errorsCount: errors.length,
      warningsCount: warnings.length
    });

    return result;
  }

  /**
   * Calculates processing statistics and estimates
   */
  public calculateProcessingEstimates(
    records: ISRSExcelRecord[],
    typeOfSRS: SRSType
  ): {
    estimatedCellUpdates: number;
    estimatedComments: number;
    estimatedProcessingTime: number; // in milliseconds
    complexityScore: number; // 1-10 scale
  } {
    console.log('[SRSExcelProcessingHelpers] *** CALCULATING PROCESSING ESTIMATES ***');
    
    let estimatedCellUpdates = 0;
    let estimatedComments = 0;
    let complexityScore = 1;

    records.forEach(record => {
      // Basic cells per record (start, end, lunch times)
      estimatedCellUpdates += 3;

      // Leave type cells
      if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
          record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
        estimatedCellUpdates += 1; // Extended leave type
        complexityScore += 0.5; // Extended types are more complex
      } else if (record.TypeOfLeaveID === 1 || record.TypeOfLeaveID === 2) {
        estimatedCellUpdates += 1; // Basic leave type
      }

      // Comments
      if (record.LunchNote) estimatedComments++;
      if (record.TotalHoursNote) estimatedComments++;
      if (record.LeaveNote) estimatedComments++;

      // Complexity factors
      if (record.LunchNote || record.TotalHoursNote || record.LeaveNote) {
        complexityScore += 0.3; // Comments add complexity
      }
    });

    // Type-specific adjustments
    if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      complexityScore += 1; // Type 3 is more complex
    }

    // Estimate processing time (rough approximation)
    const baseTimePerRecord = 50; // milliseconds
    const complexityMultiplier = Math.min(complexityScore, 10);
    const estimatedProcessingTime = records.length * baseTimePerRecord * complexityMultiplier;

    const estimates = {
      estimatedCellUpdates,
      estimatedComments,
      estimatedProcessingTime: Math.round(estimatedProcessingTime),
      complexityScore: Math.min(Math.round(complexityScore * 10) / 10, 10)
    };

    console.log('[SRSExcelProcessingHelpers] Processing estimates:', estimates);
    return estimates;
  }

  /**
   * Creates processing summary for logging
   */
  public createProcessingSummary(
    records: ISRSExcelRecord[],
    result: IProcessingResult,
    processingTime: number
  ): {
    summary: string;
    details: Record<string, unknown>;
  } {
    const successRate = records.length > 0 ? Math.round((result.recordsProcessed / records.length) * 100) : 0;
    const avgCellsPerRecord = result.recordsProcessed > 0 ? Math.round(result.cellsUpdated / result.recordsProcessed) : 0;
    const avgCommentsPerRecord = result.recordsProcessed > 0 ? Math.round((result.commentsAdded / result.recordsProcessed) * 10) / 10 : 0;

    const summary = `Processed ${result.recordsProcessed}/${records.length} records (${successRate}%) in ${processingTime}ms. Updated ${result.cellsUpdated} cells, added ${result.commentsAdded} comments.`;

    const details: Record<string, unknown> = {
      inputRecords: records.length,
      processedRecords: result.recordsProcessed,
      skippedRecords: records.length - result.recordsProcessed,
      cellsUpdated: result.cellsUpdated,
      commentsAdded: result.commentsAdded,
      processingTime: processingTime,
      successRate: `${successRate}%`,
      avgCellsPerRecord,
      avgCommentsPerRecord,
      errors: result.errors.length,
      warnings: result.warnings.length,
      efficiency: {
        recordsPerSecond: processingTime > 0 ? Math.round((result.recordsProcessed * 1000) / processingTime) : 0,
        cellsPerSecond: processingTime > 0 ? Math.round((result.cellsUpdated * 1000) / processingTime) : 0
      }
    };

    console.log('[SRSExcelProcessingHelpers] Processing summary created:', { summary, details });
    return { summary, details };
  }

  /**
   * Handles processing recovery and retry logic
   */
  public async retryFailedOperations(
    worksheet: ExcelJS.Worksheet,
    failedRecords: ISRSExcelRecord[],
    typeOfSRS: SRSType,
    baseRowIndex: number,
    cellOperations: SRSExcelCellOperations,
    maxRetries: number = 2
  ): Promise<IProcessingResult> {
    console.log('[SRSExcelProcessingHelpers] *** RETRYING FAILED OPERATIONS ***');
    console.log('[SRSExcelProcessingHelpers] Retry parameters:', {
      failedRecordsCount: failedRecords.length,
      maxRetries,
      typeOfSRS,
      baseRowIndex
    });

    let attempt = 0;
    let lastResult: IProcessingResult = {
      recordsProcessed: 0,
      cellsUpdated: 0,
      commentsAdded: 0,
      errors: [],
      warnings: []
    };

    while (attempt < maxRetries && failedRecords.length > 0) {
      attempt++;
      console.log('[SRSExcelProcessingHelpers] Retry attempt', attempt, 'of', maxRetries);

      try {
        // Wait a brief moment between retries
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));

        lastResult = await this.processAllRecords(
          worksheet,
          failedRecords,
          typeOfSRS,
          baseRowIndex,
          cellOperations
        );

        if (lastResult.errors.length === 0) {
          console.log('[SRSExcelProcessingHelpers] Retry attempt', attempt, 'succeeded');
          break;
        } else {
          console.log('[SRSExcelProcessingHelpers] Retry attempt', attempt, 'had', lastResult.errors.length, 'errors');
        }

      } catch (retryError) {
        console.error('[SRSExcelProcessingHelpers] Retry attempt', attempt, 'failed:', retryError);
        lastResult.errors.push(`Retry attempt ${attempt} failed: ${retryError}`);
      }
    }

    console.log('[SRSExcelProcessingHelpers] Retry operations completed after', attempt, 'attempts');
    return lastResult;
  }
}