// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelValidationAndUtils.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelExportData,
  ISRSExcelError,
  ISRSExcelRecord,
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelInterfaces';

/**
 * Service for Excel input validation and utility operations
 * Handles date finding, input validation, and helper calculations
 */
export class SRSExcelValidationAndUtils {
  private addLog: (message: string) => void;
  private createProcessingError: (code: string, message: string, details?: unknown) => ISRSExcelError;

  constructor(
    addLogCallback: (message: string) => void,
    createErrorCallback: (code: string, message: string, details?: unknown) => ISRSExcelError
  ) {
    this.addLog = addLogCallback;
    this.createProcessingError = createErrorCallback;
  }

  /**
   * Validates all input data for Excel processing
   */
  public validateInputData(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    date: string,
    typeOfSRS: SRSType,
    exportData: ISRSExcelExportData
  ): void {
    console.log('[SRSExcelValidationAndUtils] *** VALIDATING INPUT DATA ***');
    
    this.validateWorkbook(workbook);
    this.validateWorksheet(worksheet);
    this.validateDate(date);
    this.validateTypeOfSRS(typeOfSRS);
    this.validateExportData(exportData);
    
    console.log('[SRSExcelValidationAndUtils] *** ALL INPUT VALIDATIONS PASSED ***');
  }

  /**
   * Validates Excel workbook
   */
  private validateWorkbook(workbook: ExcelJS.Workbook): void {
    if (!workbook) {
      console.error('[SRSExcelValidationAndUtils] VALIDATION ERROR: Workbook not found or inaccessible');
      throw this.createProcessingError('WORKBOOK_NOT_FOUND', 'Workbook not found or inaccessible');
    }
    console.log('[SRSExcelValidationAndUtils] ✓ Workbook validation passed');
  }

  /**
   * Validates Excel worksheet with detailed information
   */
  private validateWorksheet(worksheet: ExcelJS.Worksheet): void {
    if (!worksheet) {
      console.error('[SRSExcelValidationAndUtils] VALIDATION ERROR: Target worksheet not found');
      throw this.createProcessingError('WORKSHEET_NOT_FOUND', 'Target worksheet not found');
    }
    console.log('[SRSExcelValidationAndUtils] ✓ Worksheet validation passed');

    // Additional worksheet details validation
    try {
      const worksheetName = worksheet.name;
      console.log('[SRSExcelValidationAndUtils] ✓ Worksheet details:', {
        name: worksheetName,
        expectedName: SRS_EXCEL_CONSTANTS.WORKSHEET_NAME,
        isCorrectName: worksheetName === SRS_EXCEL_CONSTANTS.WORKSHEET_NAME,
        rowCount: worksheet.rowCount,
        columnCount: worksheet.columnCount
      });
      
      if (worksheetName !== SRS_EXCEL_CONSTANTS.WORKSHEET_NAME) {
        console.warn('[SRSExcelValidationAndUtils] WARNING: Worksheet name mismatch:', {
          actual: worksheetName,
          expected: SRS_EXCEL_CONSTANTS.WORKSHEET_NAME
        });
      }
    } catch (worksheetError) {
      console.error('[SRSExcelValidationAndUtils] Error reading worksheet details:', worksheetError);
    }
  }

  /**
   * Validates date parameter
   */
  private validateDate(date: string): void {
    if (!date || date.trim() === '') {
      console.error('[SRSExcelValidationAndUtils] VALIDATION ERROR: Date parameter is required');
      throw this.createProcessingError('INVALID_DATE', 'Date parameter is required');
    }
    console.log('[SRSExcelValidationAndUtils] ✓ Date validation passed:', date);
  }

  /**
   * Validates SRS type parameter
   */
  private validateTypeOfSRS(typeOfSRS: SRSType): void {
    if (typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_2 && typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      console.error('[SRSExcelValidationAndUtils] VALIDATION ERROR: Invalid typeOfSRS:', typeOfSRS);
      throw this.createProcessingError('INVALID_TYPE_OF_SRS', `Invalid typeOfSRS: ${typeOfSRS}. Must be 2 or 3`);
    }
    console.log('[SRSExcelValidationAndUtils] ✓ TypeOfSRS validation passed:', typeOfSRS);
  }

  /**
   * Validates export data
   */
  private validateExportData(exportData: ISRSExcelExportData): void {
    if (!exportData.records || exportData.records.length === 0) {
      console.error('[SRSExcelValidationAndUtils] VALIDATION ERROR: No records to process');
      throw this.createProcessingError('NO_RECORDS', 'No records to process');
    }
    console.log('[SRSExcelValidationAndUtils] ✓ Records validation passed:', exportData.records.length, 'records');
  }

  /**
   * Gets maximum rows for SRS type
   */
  public getMaxRowsForType(typeOfSRS: SRSType): number {
    const maxRows = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
      : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;
    
    console.log('[SRSExcelValidationAndUtils] Max rows for typeOfSRS', typeOfSRS, ':', maxRows);
    return maxRows;
  }

  /**
   * *** DETAILED LOGGING: Finds date in Excel worksheet ***
   * Performs comprehensive search with extensive logging
   */
  public findDateInWorksheet(worksheet: ExcelJS.Worksheet, targetDate: string): number {
    console.log('[SRSExcelValidationAndUtils] *** SEARCHING FOR DATE IN WORKSHEET ***');
    console.log('[SRSExcelValidationAndUtils] Target date to find:', targetDate);
    console.log('[SRSExcelValidationAndUtils] Search range:', SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE);
    console.log('[SRSExcelValidationAndUtils] Worksheet name:', worksheet.name);
    console.log('[SRSExcelValidationAndUtils] Worksheet dimensions:', {
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount
    });

    const targetValue: string = targetDate.trim();
    
    // Parse search range A1:A2000
    const rangeParts: string[] = SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE.split(':');
    const startCell = worksheet.getCell(rangeParts[0]);
    const endCell = worksheet.getCell(rangeParts[1]);
    
    const startRow: number = typeof startCell.row === 'number' ? startCell.row : parseInt(String(startCell.row), 10) || 1;
    const endRow: number = typeof endCell.row === 'number' ? endCell.row : parseInt(String(endCell.row), 10) || 2000;

    console.log('[SRSExcelValidationAndUtils] Search parameters:', {
      startRow,
      endRow,
      totalRowsToCheck: endRow - startRow + 1,
      searchColumn: 'A (index 1)'
    });

    const searchResult = this.performDateSearch(worksheet, startRow, endRow, targetValue);
    
    if (searchResult.found && searchResult.row) {
      console.log('[SRSExcelValidationAndUtils] *** EXACT DATE MATCH FOUND ***');
      console.log('[SRSExcelValidationAndUtils] Match details:', {
        row: searchResult.row,
        zeroBasedIndex: searchResult.row - 1,
        cellValue: searchResult.cellValue,
        targetValue: targetValue,
        totalDatesFound: searchResult.totalDatesFound
      });
      
      this.addLog(`Date "${targetValue}" found at row ${searchResult.row} (0-based: ${searchResult.row - 1})`);
      return searchResult.row - 1; // Return 0-based index
    }

    // Date not found - log comprehensive error information
    this.logDateNotFoundError(targetValue, searchResult, startRow, endRow, worksheet.name);
    throw this.createProcessingError('DATE_NOT_FOUND', `Target date "${targetValue}" not found in the worksheet`);
  }

  /**
   * Performs the actual date search with progress logging
   */
  private performDateSearch(
    worksheet: ExcelJS.Worksheet, 
    startRow: number, 
    endRow: number, 
    targetValue: string
  ): {
    found: boolean;
    row?: number;
    cellValue?: string;
    totalDatesFound: number;
    foundDates: Array<{row: number, value: string}>;
  } {
    let searchProgress = 0;
    const progressInterval = 100; // Log every 100 rows
    const foundDates: Array<{row: number, value: string}> = [];

    // Search through all rows in range
    for (let row: number = startRow; row <= endRow; row++) {
      try {
        const cell = worksheet.getCell(row, 1); // Column A = index 1
        const cellValue: string = cell.value?.toString().trim() || '';
        
        // Log search progress
        searchProgress++;
        if (searchProgress % progressInterval === 0) {
          console.log('[SRSExcelValidationAndUtils] Search progress:', {
            currentRow: row,
            progress: `${searchProgress}/${endRow - startRow + 1}`,
            percentage: Math.round((searchProgress / (endRow - startRow + 1)) * 100) + '%'
          });
        }

        // Track all non-empty values found
        if (cellValue && cellValue.length > 0) {
          foundDates.push({row, value: cellValue});
          
          // Log first few dates for debugging
          if (foundDates.length <= 10) {
            console.log('[SRSExcelValidationAndUtils] Found date value at row', row, ':', cellValue);
          }
          
          // Check for exact match
          if (cellValue === targetValue) {
            return {
              found: true,
              row: row,
              cellValue: cellValue,
              totalDatesFound: foundDates.length,
              foundDates: foundDates
            };
          }
        }
      } catch (cellError) {
        console.warn('[SRSExcelValidationAndUtils] Error reading cell at row', row, ':', cellError);
        continue;
      }
    }

    return {
      found: false,
      totalDatesFound: foundDates.length,
      foundDates: foundDates
    };
  }

  /**
   * Logs detailed information when date is not found
   */
  private logDateNotFoundError(
    targetValue: string, 
    searchResult: { foundDates: Array<{row: number, value: string}> }, 
    startRow: number, 
    endRow: number, 
    worksheetName: string
  ): void {
    console.error('[SRSExcelValidationAndUtils] *** DATE NOT FOUND ***');
    console.error('[SRSExcelValidationAndUtils] Search completed without finding target date');
    console.error('[SRSExcelValidationAndUtils] Search summary:', {
      targetDate: targetValue,
      totalDatesFound: searchResult.foundDates.length,
      searchRange: `${startRow}-${endRow}`,
      worksheet: worksheetName
    });

    // Log all found dates for analysis
    if (searchResult.foundDates.length > 0) {
      console.error('[SRSExcelValidationAndUtils] All dates found during search:');
      searchResult.foundDates.forEach((dateInfo, index) => {
        console.error(`[SRSExcelValidationAndUtils] ${index + 1}. Row ${dateInfo.row}: "${dateInfo.value}"`);
      });
      
      // Look for similar dates
      const similarDates = searchResult.foundDates.filter(dateInfo => 
        dateInfo.value.includes(targetValue) || targetValue.includes(dateInfo.value)
      );
      
      if (similarDates.length > 0) {
        console.error('[SRSExcelValidationAndUtils] Similar dates found:');
        similarDates.forEach(dateInfo => {
          console.error(`[SRSExcelValidationAndUtils] Row ${dateInfo.row}: "${dateInfo.value}" (similarity check)`);
        });
      }
    } else {
      console.error('[SRSExcelValidationAndUtils] No dates found in column A at all!');
      console.error('[SRSExcelValidationAndUtils] This might indicate:');
      console.error('[SRSExcelValidationAndUtils] - Wrong worksheet');
      console.error('[SRSExcelValidationAndUtils] - Dates are in different column'); 
      console.error('[SRSExcelValidationAndUtils] - Date format mismatch');
      console.error('[SRSExcelValidationAndUtils] - Empty worksheet');
    }
  }

  /**
   * Analyzes records before processing
   */
  public analyzeRecords(records: ISRSExcelRecord[]): {
    totalRecords: number;
    contractBreakdown: Record<number, number>;
    leaveTypeBreakdown: Record<number, number>;
    hasComments: boolean;
    hasExtendedLeaveTypes: boolean;
  } {
    console.log('[SRSExcelValidationAndUtils] *** ANALYZING RECORDS ***');
    
    const analysis = {
      totalRecords: records.length,
      contractBreakdown: {} as Record<number, number>,
      leaveTypeBreakdown: {} as Record<number, number>,
      hasComments: false,
      hasExtendedLeaveTypes: false
    };

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
    });

    console.log('[SRSExcelValidationAndUtils] Record analysis completed:', analysis);
    return analysis;
  }

  /**
   * Validates individual record data
   */
  public validateRecord(record: ISRSExcelRecord): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate contract
    if (record.Contract !== 1 && record.Contract !== 2) {
      errors.push(`Invalid contract: ${record.Contract}. Must be 1 or 2.`);
    }

    // Validate leave type ID
    if (record.TypeOfLeaveID < 0 || record.TypeOfLeaveID > 19) {
      errors.push(`Invalid TypeOfLeaveID: ${record.TypeOfLeaveID}. Must be between 0 and 19.`);
    }

    // Validate leave time
    if (record.LeaveTime < 0 || record.LeaveTime > 24) {
      warnings.push(`Leave time ${record.LeaveTime} seems unusual. Should be between 0 and 24 hours.`);
    }

    // Validate time objects
    if (!record.ShiftStart || !record.ShiftEnd || !record.LunchTime) {
      errors.push('Missing required time fields (ShiftStart, ShiftEnd, or LunchTime).');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Gets column letter from column number (A, B, C, etc.)
   */
  public getColumnLetter(columnNumber: number): string {
    let result = '';
    while (columnNumber > 0) {
      columnNumber--;
      result = String.fromCharCode(65 + (columnNumber % 26)) + result;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return result;
  }
}