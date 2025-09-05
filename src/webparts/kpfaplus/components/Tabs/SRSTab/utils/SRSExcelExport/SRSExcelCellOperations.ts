// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelCellOperations.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelRecord,
  SRS_EXCEL_CONSTANTS,
  SRSType
} from './SRSExcelInterfaces';

/**
 * Service for Excel cell operations and data writing
 * Handles record processing, cell value setting, and comment management
 * *** FIXED: Does not set formulas in D, G, I columns - Excel already has them ***
 */
export class SRSExcelCellOperations {
  private addLog: (message: string) => void;

  constructor(addLogCallback: (message: string) => void) {
    this.addLog = addLogCallback;
  }

  /**
   * Processes a single SRS record based on SRS type
   */
  public processRecordByType(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] Processing record by type:', {
      typeOfSRS,
      rowIndex,
      contract: record.Contract
    });

    if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      return this.processRecordForType3(worksheet, record, rowIndex);
    } else {
      return this.processRecordForType2(worksheet, record, rowIndex);
    }
  }

  /**
   * Processes record for typeOfSRS = 3
   */
  public processRecordForType3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING RECORD FOR TYPE 3 ***');
    console.log('[SRSExcelCellOperations] Type 3 processing parameters:', {
      rowIndex,
      contract: record.Contract,
      shiftStart: record.ShiftStart,
      shiftEnd: record.ShiftEnd,
      lunchTime: record.LunchTime,
      typeOfLeaveID: record.TypeOfLeaveID,
      leaveTime: record.LeaveTime
    });

    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;

    if (record.Contract === 1) {
      const contractResult = this.processContract1Type3(worksheet, record, rowIndex);
      cellsUpdated += contractResult.cellsUpdated;
      commentsAdded += contractResult.commentsAdded;
    } else if (record.Contract === 2) {
      const contractResult = this.processContract2Type3(worksheet, record, rowIndex);
      cellsUpdated += contractResult.cellsUpdated;
      commentsAdded += contractResult.commentsAdded;
    }

    console.log('[SRSExcelCellOperations] *** TYPE 3 PROCESSING COMPLETED ***');
    console.log('[SRSExcelCellOperations] Type 3 results:', {
      cellsUpdated,
      commentsAdded
    });

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Processes Contract 1 for Type 3 SRS
   */
  private processContract1Type3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING CONTRACT 1, TYPE 3 ***');
    
    let cellsUpdated = 0;
    let commentsAdded = 0;

    // Start time - B column
    const startResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `B${rowIndex}`, 
      record.ShiftStart, 
      'h:mm AM/PM',
      'Start time'
    );
    if (startResult.success) cellsUpdated++;

    // End time - C column  
    const endResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `C${rowIndex}`, 
      record.ShiftEnd, 
      'h:mm AM/PM',
      'End time'
    );
    if (endResult.success) cellsUpdated++;

    // Lunch time - F column
    const lunchResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `F${rowIndex}`, 
      record.LunchTime, 
      '[h]:mm',
      'Lunch time'
    );
    if (lunchResult.success) cellsUpdated++;

    console.log('[SRSExcelCellOperations] Contract 1 Type 3 cells set:', {
      startTime: `B${rowIndex}`,
      endTime: `C${rowIndex}`,
      lunchTime: `F${rowIndex}`
    });

    // Comments for Contract 1, Type 3
    if (record.LunchNote) {
      if (this.addCommentToCell(worksheet, `F${rowIndex}`, record.LunchNote)) {
        commentsAdded++;
      }
    }
    
    if (record.TotalHoursNote) {
      if (this.addCommentToCell(worksheet, `H${rowIndex}`, record.TotalHoursNote)) {
        commentsAdded++;
      }
    }

    // TypeOfLeaveID specific cells for Contract 1, Type 3
    const leaveResult = this.processLeaveTypesContract1Type3(worksheet, record, rowIndex);
    cellsUpdated += leaveResult.cellsUpdated;

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Processes Contract 2 for Type 3 SRS
   */
  private processContract2Type3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING CONTRACT 2, TYPE 3 ***');
    
    let cellsUpdated = 0;
    let commentsAdded = 0;

    // Start time - K column
    const startResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `K${rowIndex}`, 
      record.ShiftStart, 
      'h:mm AM/PM',
      'Start time'
    );
    if (startResult.success) cellsUpdated++;

    // End time - L column
    const endResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `L${rowIndex}`, 
      record.ShiftEnd, 
      'h:mm AM/PM',
      'End time'
    );
    if (endResult.success) cellsUpdated++;

    // Lunch time - O column
    const lunchResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `O${rowIndex}`, 
      record.LunchTime, 
      '[h]:mm',
      'Lunch time'
    );
    if (lunchResult.success) cellsUpdated++;

    console.log('[SRSExcelCellOperations] Contract 2 Type 3 cells set:', {
      startTime: `K${rowIndex}`,
      endTime: `L${rowIndex}`,
      lunchTime: `O${rowIndex}`
    });

    // Comments for Contract 2, Type 3
    if (record.LunchNote) {
      if (this.addCommentToCell(worksheet, `O${rowIndex}`, record.LunchNote)) {
        commentsAdded++;
      }
    }
    
    if (record.TotalHoursNote) {
      if (this.addCommentToCell(worksheet, `Q${rowIndex}`, record.TotalHoursNote)) {
        commentsAdded++;
      }
    }

    // TypeOfLeaveID specific cells for Contract 2, Type 3
    const leaveResult = this.processLeaveTypesContract2Type3(worksheet, record, rowIndex);
    cellsUpdated += leaveResult.cellsUpdated;

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Processes record for typeOfSRS = 2
   */
  public processRecordForType2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING RECORD FOR TYPE 2 ***');
    console.log('[SRSExcelCellOperations] Type 2 processing parameters:', {
      rowIndex,
      contract: record.Contract,
      shiftStart: record.ShiftStart,
      shiftEnd: record.ShiftEnd,
      lunchTime: record.LunchTime,
      typeOfLeaveID: record.TypeOfLeaveID,
      leaveTime: record.LeaveTime
    });

    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;

    if (record.Contract === 1) {
      const contractResult = this.processContract1Type2(worksheet, record, rowIndex);
      cellsUpdated += contractResult.cellsUpdated;
      commentsAdded += contractResult.commentsAdded;
    } else if (record.Contract === 2) {
      const contractResult = this.processContract2Type2(worksheet, record, rowIndex);
      cellsUpdated += contractResult.cellsUpdated;
      commentsAdded += contractResult.commentsAdded;
    }

    console.log('[SRSExcelCellOperations] *** TYPE 2 PROCESSING COMPLETED ***');
    console.log('[SRSExcelCellOperations] Type 2 results:', {
      cellsUpdated,
      commentsAdded
    });

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Processes Contract 1 for Type 2 SRS
   */
  private processContract1Type2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING CONTRACT 1, TYPE 2 ***');
    
    let cellsUpdated = 0;
    let commentsAdded = 0;

    // Start time - B column
    const startResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `B${rowIndex}`, 
      record.ShiftStart, 
      'h:mm AM/PM',
      'Start time'
    );
    if (startResult.success) cellsUpdated++;

    // End time - C column
    const endResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `C${rowIndex}`, 
      record.ShiftEnd, 
      'h:mm AM/PM',
      'End time'
    );
    if (endResult.success) cellsUpdated++;

    // Lunch time - F column
    const lunchResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `F${rowIndex}`, 
      record.LunchTime, 
      '[h]:mm',
      'Lunch time'
    );
    if (lunchResult.success) cellsUpdated++;

    console.log('[SRSExcelCellOperations] Contract 1 Type 2 cells set:', {
      startTime: `B${rowIndex}`,
      endTime: `C${rowIndex}`,
      lunchTime: `F${rowIndex}`
    });

    // Comments for Contract 1, Type 2
    if (record.LunchNote) {
      if (this.addCommentToCell(worksheet, `F${rowIndex}`, record.LunchNote)) {
        commentsAdded++;
      }
    }
    
    if (record.TotalHoursNote) {
      if (this.addCommentToCell(worksheet, `I${rowIndex}`, record.TotalHoursNote)) {
        commentsAdded++;
      }
    }

    // TypeOfLeaveID specific cells for Contract 1, Type 2
    const leaveResult = this.processLeaveTypesContract1Type2(worksheet, record, rowIndex);
    cellsUpdated += leaveResult.cellsUpdated;

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Processes Contract 2 for Type 2 SRS
   */
  private processContract2Type2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING CONTRACT 2, TYPE 2 ***');
    
    let cellsUpdated = 0;
    let commentsAdded = 0;

    // Start time - L column
    const startResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `L${rowIndex}`, 
      record.ShiftStart, 
      '[$-409]h:mm AM/PM',
      'Start time'
    );
    if (startResult.success) cellsUpdated++;

    // End time - M column
    const endResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `M${rowIndex}`, 
      record.ShiftEnd, 
      '[$-409]h:mm AM/PM',
      'End time'
    );
    if (endResult.success) cellsUpdated++;

    // Lunch time - P column
    const lunchResult = this.setCellValueWithSpecificFormat(
      worksheet, 
      `P${rowIndex}`, 
      record.LunchTime, 
      '[h]:mm',
      'Lunch time'
    );
    if (lunchResult.success) cellsUpdated++;

    console.log('[SRSExcelCellOperations] Contract 2 Type 2 cells set:', {
      startTime: `L${rowIndex}`,
      endTime: `M${rowIndex}`,
      lunchTime: `P${rowIndex}`
    });

    // Comments for Contract 2, Type 2
    if (record.LunchNote) {
      if (this.addCommentToCell(worksheet, `P${rowIndex}`, record.LunchNote)) {
        commentsAdded++;
      }
    }
    
    if (record.TotalHoursNote) {
      if (this.addCommentToCell(worksheet, `S${rowIndex}`, record.TotalHoursNote)) {
        commentsAdded++;
      }
    }

    // TypeOfLeaveID specific cells for Contract 2, Type 2
    const leaveResult = this.processLeaveTypesContract2Type2(worksheet, record, rowIndex);
    cellsUpdated += leaveResult.cellsUpdated;

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Sets cell value with specific format and detailed logging
   */
  private setCellValueWithSpecificFormat(
    worksheet: ExcelJS.Worksheet,
    cellAddress: string,
    value: any,
    format: string,
    description: string
  ): { cell: string; value: any; success: boolean } {
    try {
      console.log('[SRSExcelCellOperations] *** SETTING CELL WITH SPECIFIC FORMAT ***');
      console.log('[SRSExcelCellOperations] Cell:', cellAddress, 'Value:', value, 'Format:', format, 'Description:', description);
      
      const cell = worksheet.getCell(cellAddress);
      const oldValue = cell.value;
      
      // Set value and specific format
      cell.value = value;
      cell.numFmt = format;
      
      console.log('[SRSExcelCellOperations] ✓ Successfully updated', cellAddress, ':', oldValue, '->', value, 'with format:', format);
      return { cell: cellAddress, value: value, success: true };
      
    } catch (error) {
      console.error('[SRSExcelCellOperations] ✗ Failed to update', cellAddress, ':', error);
      return { cell: cellAddress, value: value, success: false };
    }
  }

  /**
   * Processes extended leave types (TypeOfLeaveID 3-19)
   */
  public processExtendedLeaveType(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelCellOperations] *** PROCESSING EXTENDED LEAVE TYPE ***');
    console.log('[SRSExcelCellOperations] Extended leave parameters:', {
      typeOfLeaveID: record.TypeOfLeaveID,
      typeOfSRS,
      rowIndex,
      leaveTime: record.LeaveTime,
      leaveNote: record.LeaveNote ? 'Yes' : 'No'
    });

    const columns: string[] = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? [...SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_3]
      : [...SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_2];

    console.log('[SRSExcelCellOperations] Extended leave columns available:', columns);
    console.log('[SRSExcelCellOperations] Column range:', `${columns[0]} - ${columns[columns.length - 1]}`);

    const columnIndex: number = record.TypeOfLeaveID - 3; // -3 because array starts from TypeOfLeaveID 3
    console.log('[SRSExcelCellOperations] Calculated column index:', columnIndex, 'for TypeOfLeaveID', record.TypeOfLeaveID);
    
    const leaveColumn: string | undefined = columns[columnIndex];
    
    if (leaveColumn) {
      const cellAddress = `${leaveColumn}${rowIndex}`;
      console.log('[SRSExcelCellOperations] Target cell for extended leave:', cellAddress);
      
      try {
        const cell = worksheet.getCell(cellAddress);
        const oldValue = cell.value;
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00'; // Numeric format for leave time
        
        console.log('[SRSExcelCellOperations] ✓ Successfully set extended leave value:', {
          cell: cellAddress,
          oldValue,
          newValue: record.LeaveTime,
          typeOfLeaveID: record.TypeOfLeaveID
        });
        
        let commentsAdded = 0;
        if (record.LeaveNote) {
          console.log('[SRSExcelCellOperations] Adding leave note to extended leave cell', cellAddress);
          if (this.addCommentToCell(worksheet, cellAddress, record.LeaveNote)) {
            commentsAdded = 1;
            console.log('[SRSExcelCellOperations] ✓ Successfully added leave note to', cellAddress);
          } else {
            console.warn('[SRSExcelCellOperations] ✗ Failed to add leave note to', cellAddress);
          }
        }

        console.log('[SRSExcelCellOperations] *** EXTENDED LEAVE TYPE PROCESSING COMPLETED ***');
        return { cellsUpdated: 1, commentsAdded };
        
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Error setting extended leave value in', cellAddress, ':', error);
        return { cellsUpdated: 0, commentsAdded: 0 };
      }
    } else {
      console.error('[SRSExcelCellOperations] ✗ Invalid column index for extended leave type:', {
        typeOfLeaveID: record.TypeOfLeaveID,
        calculatedIndex: columnIndex,
        availableColumns: columns.length,
        validRange: '3-19'
      });
      return { cellsUpdated: 0, commentsAdded: 0 };
    }
  }

  /**
   * Gets leave column for basic leave types (TypeOfLeaveID 1-2)
   */
  public getLeaveColumnForBasicTypes(typeOfSRS: SRSType, contract: number, typeOfLeaveID: number): string | null {
    console.log('[SRSExcelCellOperations] Getting leave column for basic types:', {
      typeOfSRS,
      contract,
      typeOfLeaveID
    });

    let column: string | null = null;

    if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      if (contract === 1) {
        column = typeOfLeaveID === 1 ? 'J' : 'I'; // Type 3, Contract 1
      } else if (contract === 2) {
        column = typeOfLeaveID === 1 ? 'S' : 'R'; // Type 3, Contract 2
      }
    } else {
      if (contract === 1) {
        column = typeOfLeaveID === 1 ? 'K' : 'J'; // Type 2, Contract 1
      } else if (contract === 2) {
        column = typeOfLeaveID === 1 ? 'U' : 'T'; // Type 2, Contract 2
      }
    }

    console.log('[SRSExcelCellOperations] Determined leave column:', column || 'None');
    return column;
  }

  /**
   * Adds comment to cell
   */
  public addCommentToCell(worksheet: ExcelJS.Worksheet, cellAddress: string, commentText: string): boolean {
    console.log('[SRSExcelCellOperations] *** ADDING COMMENT TO CELL ***');
    console.log('[SRSExcelCellOperations] Comment parameters:', {
      cellAddress,
      commentLength: commentText.length,
      commentPreview: commentText.substring(0, 50) + (commentText.length > 50 ? '...' : '')
    });

    try {
      const cell = worksheet.getCell(cellAddress);
      
      // Clear existing comment
      if (cell.note) {
        const oldComment = cell.note;
        console.log('[SRSExcelCellOperations] Clearing existing comment from', cellAddress, ':', oldComment);
        delete (cell as { note?: string }).note;
      }

      // Add new comment
      (cell as { note: string }).note = commentText;
      
      console.log('[SRSExcelCellOperations] ✓ Successfully added comment to', cellAddress);
      console.log('[SRSExcelCellOperations] Comment content:', commentText);
      this.addLog(`Added comment to ${cellAddress}: ${commentText}`);
      return true;

    } catch (e) {
      const errorMsg: string = `Failed to add comment to ${cellAddress}: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[SRSExcelCellOperations] ✗', errorMsg);
      this.addLog(`Error: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Process leave types for Contract 1, Type 3
   */
  private processLeaveTypesContract1Type3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number } {
    let cellsUpdated = 0;

    if (record.TypeOfLeaveID === 1) {
      console.log('[SRSExcelCellOperations] Setting leave type 1 value in J' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`J${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 1 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 1 value:', error);
      }
    }
    
    if (record.TypeOfLeaveID === 2) {
      console.log('[SRSExcelCellOperations] Setting leave type 2 value in I' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`I${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 2 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 2 value:', error);
      }
    }

    return { cellsUpdated };
  }

  /**
   * Process leave types for Contract 2, Type 3
   */
  private processLeaveTypesContract2Type3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number } {
    let cellsUpdated = 0;

    if (record.TypeOfLeaveID === 1) {
      console.log('[SRSExcelCellOperations] Setting leave type 1 value in S' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`S${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 1 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 1 value:', error);
      }
    }
    
    if (record.TypeOfLeaveID === 2) {
      console.log('[SRSExcelCellOperations] Setting leave type 2 value in R' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`R${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 2 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 2 value:', error);
      }
    }

    return { cellsUpdated };
  }

  /**
   * Process leave types for Contract 1, Type 2
   */
  private processLeaveTypesContract1Type2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number } {
    let cellsUpdated = 0;

    if (record.TypeOfLeaveID === 1) {
      console.log('[SRSExcelCellOperations] Setting leave type 1 value in K' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`K${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 1 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 1 value:', error);
      }
    }
    
    if (record.TypeOfLeaveID === 2) {
      console.log('[SRSExcelCellOperations] Setting leave type 2 value in J' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`J${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 2 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 2 value:', error);
      }
    }

    return { cellsUpdated };
  }

  /**
   * Process leave types for Contract 2, Type 2
   */
  private processLeaveTypesContract2Type2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number } {
    let cellsUpdated = 0;

    if (record.TypeOfLeaveID === 1) {
      console.log('[SRSExcelCellOperations] Setting leave type 1 value in U' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`U${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 1 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 1 value:', error);
      }
    }
    
    if (record.TypeOfLeaveID === 2) {
      console.log('[SRSExcelCellOperations] Setting leave type 2 value in T' + rowIndex, ':', record.LeaveTime);
      try {
        const cell = worksheet.getCell(`T${rowIndex}`);
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00';
        cellsUpdated++;
        console.log('[SRSExcelCellOperations] ✓ Leave type 2 value set successfully');
      } catch (error) {
        console.error('[SRSExcelCellOperations] ✗ Failed to set leave type 2 value:', error);
      }
    }

    return { cellsUpdated };
  }
}