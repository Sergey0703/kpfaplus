// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelDataCleaning.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelProcessingStats,
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelInterfaces';

/**
 * Service for cleaning Excel data before processing
 * Handles row clearing, comment removal, and data cleanup operations
 */
export class SRSExcelDataCleaning {
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
   * *** DETAILED LOGGING: Clears all target rows ***
   * Clears data in all rows that will be processed
   */
  public clearAllRows(
    worksheet: ExcelJS.Worksheet, 
    typeOfSRS: SRSType, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): void {
    console.log('[SRSExcelDataCleaning] *** CLEARING ALL ROWS ***');
    console.log('[SRSExcelDataCleaning] Clear operation parameters:', {
      typeOfSRS,
      baseRowIndex,
      maxPossibleRows,
      worksheetName: worksheet.name
    });
    
    const columns: string[] = this.getColumnsForClearing(typeOfSRS);
    console.log('[SRSExcelDataCleaning] Columns to clear:', columns.join(', '));
    console.log('[SRSExcelDataCleaning] Total columns to clear:', columns.length);

    const clearingResult = this.performRowClearing(worksheet, columns, baseRowIndex, maxPossibleRows);
    
    // Update statistics
    this.updateStats({ cellsCleared: clearingResult.totalClearedCells });
    
    console.log('[SRSExcelDataCleaning] *** ROW CLEARING COMPLETED ***');
    console.log('[SRSExcelDataCleaning] Clearing results:', {
      totalCellsCleared: clearingResult.totalClearedCells,
      rowsProcessed: maxPossibleRows,
      columnsPerRow: columns.length,
      expectedTotalCells: maxPossibleRows * columns.length + (maxPossibleRows - 1), // +dates except first row
      errorsCount: clearingResult.errors.length,
      successRate: clearingResult.errors.length === 0 ? '100%' : `${Math.round((1 - clearingResult.errors.length / (maxPossibleRows * columns.length)) * 100)}%`
    });

    if (clearingResult.errors.length > 0) {
      console.error('[SRSExcelDataCleaning] Clearing errors encountered:', clearingResult.errors);
    }

    this.addLog(`Cleared ${clearingResult.totalClearedCells} cells in ${maxPossibleRows} rows with ${clearingResult.errors.length} errors`);
  }

  /**
   * Performs the actual row clearing operation
   */
  private performRowClearing(
    worksheet: ExcelJS.Worksheet,
    columns: string[],
    baseRowIndex: number,
    maxPossibleRows: number
  ): {
    totalClearedCells: number;
    errors: string[];
  } {
    let clearedCells: number = 0;
    const errors: string[] = [];
    const baseRow: number = baseRowIndex;

    console.log('[SRSExcelDataCleaning] Starting row clearing process:', {
      startingRow: baseRow + 1,
      endingRow: baseRow + maxPossibleRows,
      totalRowsToClear: maxPossibleRows
    });

    // Clear all possible rows
    for (let i: number = 0; i < maxPossibleRows; i++) {
      const currentRowIndex: number = baseRow + i + 1; // +1 because Excel is 1-indexed
      
      console.log('[SRSExcelDataCleaning] Clearing row', currentRowIndex, `(${i + 1}/${maxPossibleRows})`);

      const rowResult = this.clearSingleRow(worksheet, currentRowIndex, columns, i === 0);
      clearedCells += rowResult.clearedCells;
      errors.push(...rowResult.errors);
    }

    return { totalClearedCells: clearedCells, errors };
  }

  /**
   * Clears a single row with detailed logging
   */
  private clearSingleRow(
    worksheet: ExcelJS.Worksheet,
    rowIndex: number,
    columns: string[],
    isFirstRow: boolean
  ): {
    clearedCells: number;
    errors: string[];
  } {
    let rowClearedCells = 0;
    const rowErrors: string[] = [];

    try {
      // Clear date in all rows except the first
      if (!isFirstRow) {
        const dateCell = worksheet.getCell(rowIndex, 1); // Column A
        const oldDateValue = dateCell.value;
        dateCell.value = null;
        rowClearedCells++;
        
        if (oldDateValue) {
          console.log('[SRSExcelDataCleaning] Cleared date from row', rowIndex, '- was:', oldDateValue);
        }
      }

      // Clear each cell by address
      for (const col of columns) {
        try {
          const cellAddress = `${col}${rowIndex}`;
          const cell = worksheet.getCell(cellAddress);
          const oldValue = cell.value;
          cell.value = null;
          rowClearedCells++;
          
          if (oldValue) {
            console.log('[SRSExcelDataCleaning] Cleared cell', cellAddress, '- was:', oldValue);
          }
        } catch (cellError) {
          const errorMsg = `Error clearing cell ${col}${rowIndex}: ${cellError}`;
          console.error('[SRSExcelDataCleaning]', errorMsg);
          rowErrors.push(errorMsg);
        }
      }
      
      console.log('[SRSExcelDataCleaning] Row', rowIndex, 'clearing summary:', {
        cellsCleared: rowClearedCells,
        expectedCells: columns.length + (isFirstRow ? 0 : 1), // +1 for date if not first row
        success: rowErrors.length === 0
      });

    } catch (rowError) {
      const errorMsg = `Error clearing row ${rowIndex}: ${rowError}`;
      console.error('[SRSExcelDataCleaning]', errorMsg);
      rowErrors.push(errorMsg);
    }

    return { clearedCells: rowClearedCells, errors: rowErrors };
  }

  /**
   * *** DETAILED LOGGING: Clears comments in processing rows ***
   * Removes all comments in the target processing area
   */
  public clearCommentsInRows(
    worksheet: ExcelJS.Worksheet, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): void {
    console.log('[SRSExcelDataCleaning] *** CLEARING COMMENTS IN ROWS ***');
    console.log('[SRSExcelDataCleaning] Comment clearing parameters:', {
      baseRowIndex,
      maxPossibleRows,
      worksheetName: worksheet.name
    });
    
    const commentResult = this.performCommentClearing(worksheet, baseRowIndex, maxPossibleRows);
    
    // Update statistics
    this.updateStats({ commentsCleared: commentResult.deletedComments });
    
    console.log('[SRSExcelDataCleaning] *** COMMENT CLEARING COMPLETED ***');
    console.log('[SRSExcelDataCleaning] Comment clearing results:', {
      totalCommentsDeleted: commentResult.deletedComments,
      rowsProcessed: maxPossibleRows,
      errorsCount: commentResult.errors.length,
      successRate: commentResult.errors.length === 0 ? '100%' : `${Math.round((1 - commentResult.errors.length / (maxPossibleRows * 200)) * 100)}%`
    });

    this.addLog(`Cleared ${commentResult.deletedComments} comments in rows ${baseRowIndex + 1}-${baseRowIndex + maxPossibleRows} with ${commentResult.errors.length} errors`);

    if (commentResult.errors.length > 0 && commentResult.errors.length <= 10) {
      console.warn('[SRSExcelDataCleaning] Comment clearing errors (showing first 10):', commentResult.errors.slice(0, 10));
    } else if (commentResult.errors.length > 10) {
      console.warn('[SRSExcelDataCleaning] Comment clearing errors:', `${commentResult.errors.length} total errors (too many to display)`);
    }
  }

  /**
   * Performs the actual comment clearing operation
   */
  private performCommentClearing(
    worksheet: ExcelJS.Worksheet,
    baseRowIndex: number,
    maxPossibleRows: number
  ): {
    deletedComments: number;
    errors: string[];
  } {
    let deletedComments: number = 0;
    const errors: string[] = [];
    const startRow: number = baseRowIndex + 1; // Excel 1-indexed
    const endRow: number = baseRowIndex + maxPossibleRows;

    console.log('[SRSExcelDataCleaning] Comment clearing range:', {
      startRow,
      endRow,
      totalRows: maxPossibleRows,
      columnsToCheck: 200
    });

    try {
      // ExcelJS doesn't have direct API for getting all comments
      // Clear comments row by row in reasonable column range
      for (let row: number = startRow; row <= endRow; row++) {
        console.log('[SRSExcelDataCleaning] Checking row', row, 'for comments');
        
        const rowResult = this.clearCommentsInSingleRow(worksheet, row);
        deletedComments += rowResult.deletedComments;
        errors.push(...rowResult.errors);
      }

    } catch (commentError) {
      const errorMsg = `Critical error during comment clearing: ${commentError}`;
      console.error('[SRSExcelDataCleaning]', errorMsg);
      errors.push(errorMsg);
      this.addLog(`Warning: Could not clear all comments - ${commentError}`);
    }

    return { deletedComments, errors };
  }

  /**
   * Clears comments in a single row
   */
  private clearCommentsInSingleRow(
    worksheet: ExcelJS.Worksheet,
    row: number
  ): {
    deletedComments: number;
    errors: string[];
  } {
    let rowCommentsFound = 0;
    let rowCommentsCleared = 0;
    const rowErrors: string[] = [];
    
    // Check columns from A to BZ (approximately 200 columns)
    for (let col: number = 1; col <= 200; col++) {
      try {
        const cell = worksheet.getCell(row, col);
        
        if (cell.note) {
          rowCommentsFound++;
          const oldComment = cell.note;
          console.log('[SRSExcelDataCleaning] Found comment in cell', `${this.getColumnLetter(col)}${row}:`, oldComment);
          
          // ExcelJS note property handling
          delete (cell as { note?: string }).note;
          rowCommentsCleared++;
          
          console.log('[SRSExcelDataCleaning] Cleared comment from cell', `${this.getColumnLetter(col)}${row}`);
        }
      } catch (cellError) {
        const errorMsg = `Error checking/clearing comment in cell ${this.getColumnLetter(col)}${row}: ${cellError}`;
        rowErrors.push(errorMsg);
        continue;
      }
    }
    
    if (rowCommentsFound > 0) {
      console.log('[SRSExcelDataCleaning] Row', row, 'comment summary:', {
        commentsFound: rowCommentsFound,
        commentsCleared: rowCommentsCleared
      });
    }

    return { deletedComments: rowCommentsCleared, errors: rowErrors };
  }

  /**
   * Gets columns to clear based on SRS type
   */
  private getColumnsForClearing(typeOfSRS: SRSType): string[] {
    const columns = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? [...SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_3]
      : [...SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_2];

    console.log('[SRSExcelDataCleaning] Columns for clearing (typeOfSRS=' + typeOfSRS + '):', columns);
    return columns;
  }

  /**
   * Converts column number to letter (A, B, C, etc.)
   */
  private getColumnLetter(columnNumber: number): string {
    let result = '';
    while (columnNumber > 0) {
      columnNumber--;
      result = String.fromCharCode(65 + (columnNumber % 26)) + result;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return result;
  }

  /**
   * Clears specific cells by address array
   */
  public clearSpecificCells(worksheet: ExcelJS.Worksheet, cellAddresses: string[]): {
    clearedCount: number;
    errors: string[];
  } {
    console.log('[SRSExcelDataCleaning] *** CLEARING SPECIFIC CELLS ***');
    console.log('[SRSExcelDataCleaning] Addresses to clear:', cellAddresses.length);

    let clearedCount = 0;
    const errors: string[] = [];

    cellAddresses.forEach(address => {
      try {
        const cell = worksheet.getCell(address);
        const oldValue = cell.value;
        cell.value = null;
        clearedCount++;
        
        if (oldValue) {
          console.log('[SRSExcelDataCleaning] Cleared specific cell', address, '- was:', oldValue);
        }
      } catch (cellError) {
        const errorMsg = `Failed to clear cell ${address}: ${cellError}`;
        console.warn('[SRSExcelDataCleaning]', errorMsg);
        errors.push(errorMsg);
      }
    });

    console.log('[SRSExcelDataCleaning] Specific cells clearing result:', {
      requested: cellAddresses.length,
      cleared: clearedCount,
      failed: errors.length
    });

    return { clearedCount, errors };
  }

  /**
   * Clears entire row range (all columns)
   */
  public clearEntireRowRange(
    worksheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    maxColumns: number = 200
  ): {
    clearedCells: number;
    errors: string[];
  } {
    console.log('[SRSExcelDataCleaning] *** CLEARING ENTIRE ROW RANGE ***');
    console.log('[SRSExcelDataCleaning] Range:', { startRow, endRow, maxColumns });

    let clearedCells = 0;
    const errors: string[] = [];

    for (let row = startRow; row <= endRow; row++) {
      for (let col = 1; col <= maxColumns; col++) {
        try {
          const cell = worksheet.getCell(row, col);
          if (cell.value) {
            cell.value = null;
            clearedCells++;
          }
        } catch (cellError) {
          errors.push(`Error clearing cell ${this.getColumnLetter(col)}${row}: ${cellError}`);
        }
      }
    }

    console.log('[SRSExcelDataCleaning] Entire row range cleared:', {
      rowsProcessed: endRow - startRow + 1,
      clearedCells,
      errors: errors.length
    });

    return { clearedCells, errors };
  }

  /**
   * Validates clearing operation parameters
   */
  public validateClearingParameters(
    baseRowIndex: number,
    maxPossibleRows: number,
    typeOfSRS: SRSType
  ): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate base row index
    if (baseRowIndex < 0) {
      errors.push('Base row index cannot be negative');
    }

    // Validate max rows
    if (maxPossibleRows <= 0) {
      errors.push('Max possible rows must be positive');
    }

    if (maxPossibleRows > 10) {
      warnings.push(`Large number of rows to clear: ${maxPossibleRows}`);
    }

    // Validate SRS type
    if (typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_2 && typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      errors.push(`Invalid SRS type: ${typeOfSRS}`);
    }

    // Calculate total operations
    const columns = this.getColumnsForClearing(typeOfSRS);
    const totalOperations = maxPossibleRows * columns.length;
    
    if (totalOperations > 1000) {
      warnings.push(`Large number of clearing operations: ${totalOperations}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}