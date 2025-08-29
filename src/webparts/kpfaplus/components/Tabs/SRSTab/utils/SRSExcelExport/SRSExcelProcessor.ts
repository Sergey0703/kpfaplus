// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelProcessor.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelExportData,
  ISRSExcelOperationResult,
  ISRSExcelProcessingStats,
  ISRSExcelError,
  SRS_EXCEL_CONSTANTS,
  SRSType,
  ISRSExcelRecord
} from './SRSExcelInterfaces';

/**
 * Основной процессор для экспорта SRS данных в Excel
 * Реплицирует логику Office Script для работы с ExcelJS
 */
export class SRSExcelProcessor {
  private logs: string[];
  private stats: ISRSExcelProcessingStats;

  constructor() {
    this.logs = [];
    this.stats = this.initializeStats();
  }

  /**
   * *** ГЛАВНАЯ ФУНКЦИЯ: Обрабатывает экспорт SRS данных в Excel ***
   * Реплика функции main() из Office Script
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
      // Валидация входных данных
      this.validateInputData(workbook, worksheet, date, typeOfSRS, exportData);

      // Определяем максимальное количество строк
      const maxPossibleRows: number = this.getMaxRowsForType(typeOfSRS);
      this.addLog(`Received ${exportData.records.length} records for processing. Type: ${typeOfSRS}`);

      // 1. Найти строку с датой в колонке A
      const baseRowIndex: number = this.findDateInWorksheet(worksheet, date);
      this.addLog(`Found target date "${date}" at row ${baseRowIndex + 1} (0-based: ${baseRowIndex})`);

      // 2. Очистить все возможные строки
      this.clearAllRows(worksheet, typeOfSRS, baseRowIndex, maxPossibleRows);

      // 3. Очистить все комментарии в обрабатываемых строках
      this.clearCommentsInRows(worksheet, baseRowIndex, maxPossibleRows);

      // 4. Обработать каждую запись
      this.processAllRecords(worksheet, exportData.records, typeOfSRS, baseRowIndex);

      // 5. Финализировать статистику
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
   * Валидирует входные данные
   */
  private validateInputData(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    date: string,
    typeOfSRS: SRSType,
    exportData: ISRSExcelExportData
  ): void {
    if (!workbook) {
      throw this.createProcessingError('WORKBOOK_NOT_FOUND', 'Workbook not found or inaccessible');
    }

    if (!worksheet) {
      throw this.createProcessingError('WORKSHEET_NOT_FOUND', 'Target worksheet not found');
    }

    if (!date || date.trim() === '') {
      throw this.createProcessingError('INVALID_DATE', 'Date parameter is required');
    }

    if (typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_2 && typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      throw this.createProcessingError('INVALID_TYPE_OF_SRS', `Invalid typeOfSRS: ${typeOfSRS}. Must be 2 or 3`);
    }

    if (!exportData.records || exportData.records.length === 0) {
      throw this.createProcessingError('NO_RECORDS', 'No records to process');
    }

    console.log('[SRSExcelProcessor] Input validation passed');
  }

  /**
   * Получает максимальное количество строк для типа SRS
   */
  private getMaxRowsForType(typeOfSRS: SRSType): number {
    return typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
      : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;
  }

  /**
   * Ищет дату в листе Excel (реплика логики из Office Script)
   */
  private findDateInWorksheet(worksheet: ExcelJS.Worksheet, targetDate: string): number {
    console.log('[SRSExcelProcessor] *** SEARCHING FOR DATE IN WORKSHEET ***');
    console.log('[SRSExcelProcessor] Target date:', targetDate);
    console.log('[SRSExcelProcessor] Search range:', SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE);

    const targetValue: string = targetDate.trim();
    
    // Парсим диапазон A1:A2000
    const rangeParts: string[] = SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE.split(':');
    const startCell = worksheet.getCell(rangeParts[0]);
    const endCell = worksheet.getCell(rangeParts[1]);
    
    const startRow: number = typeof startCell.row === 'number' ? startCell.row : parseInt(String(startCell.row), 10) || 1;
    const endRow: number = typeof endCell.row === 'number' ? endCell.row : parseInt(String(endCell.row), 10) || 2000;

    // Проходим по всем строкам в диапазоне
    for (let row: number = startRow; row <= endRow; row++) {
      const cell = worksheet.getCell(row, 1); // Колонка A = индекс 1
      const cellValue: string = cell.value?.toString().trim() || '';
      
      if (cellValue && cellValue === targetValue) {
        console.log('[SRSExcelProcessor] Date found at row:', row, '(0-based:', row - 1, ')');
        return row - 1; // Возвращаем 0-based индекс
      }
    }

    throw this.createProcessingError('DATE_NOT_FOUND', `Target date "${targetValue}" not found in the worksheet`);
  }

  /**
   * Очищает все строки (реплика логики из Office Script)
   */
  private clearAllRows(
    worksheet: ExcelJS.Worksheet, 
    typeOfSRS: SRSType, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): void {
    console.log('[SRSExcelProcessor] *** CLEARING ALL ROWS ***');
    
    const columns: string[] = this.getColumnsForClearing(typeOfSRS);
    console.log('[SRSExcelProcessor] Columns to clear:', columns.join(', '));

    let clearedCells: number = 0;
    const baseRow: number = baseRowIndex;
    const maxRows: number = maxPossibleRows;

    // Очищаем все возможные строки
    for (let i: number = 0; i < maxRows; i++) {
      const currentRowIndex: number = baseRow + i + 1; // +1 потому что Excel 1-indexed

      // Очищаем дату во всех строках кроме первой
      if (i > 0) {
        const dateCell = worksheet.getCell(currentRowIndex, 1); // Колонка A
        dateCell.value = null;
        clearedCells++;
      }

      // Очищаем каждую ячейку по адресу
      for (const col of columns) {
        const cell = worksheet.getCell(`${col}${currentRowIndex}`);
        cell.value = null;
        clearedCells++;
      }
    }

    this.stats.cellsCleared = clearedCells;
    this.addLog(`Cleared ${clearedCells} cells in ${maxRows} rows`);

    console.log('[SRSExcelProcessor] Cleared cells:', clearedCells);
  }

  /**
   * Очищает комментарии в обрабатываемых строках (реплика из Office Script)
   */
  private clearCommentsInRows(
    worksheet: ExcelJS.Worksheet, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): void {
    console.log('[SRSExcelProcessor] *** CLEARING COMMENTS IN ROWS ***');
    
    let deletedComments: number = 0;
    const baseRow: number = baseRowIndex;
    const maxRows: number = maxPossibleRows;
    const startRow: number = baseRow + 1; // Excel 1-indexed
    const endRow: number = baseRow + maxRows;

    try {
      // ExcelJS не имеет прямого API для получения всех комментариев
      // Очищаем комментарии построчно в разумном диапазоне колонок
      for (let row: number = startRow; row <= endRow; row++) {
        // Проходим по колонкам от A до BZ (примерно 200 колонок)
        for (let col: number = 1; col <= 200; col++) {
          const cell = worksheet.getCell(row, col);
          if (cell.note) {
            (cell as any).note = null;
            deletedComments++;
          }
        }
      }

      this.stats.commentsCleared = deletedComments;
      this.addLog(`Cleared ${deletedComments} comments in rows ${startRow}-${endRow}`);

      console.log('[SRSExcelProcessor] Cleared comments:', deletedComments);

    } catch (commentError) {
      console.warn('[SRSExcelProcessor] Error clearing comments (non-critical):', commentError);
      this.addLog(`Warning: Could not clear all comments - ${commentError}`);
    }
  }

  /**
   * Обрабатывает все записи SRS (реплика логики из Office Script)
   */
  private processAllRecords(
    worksheet: ExcelJS.Worksheet,
    records: ISRSExcelRecord[],
    typeOfSRS: SRSType,
    baseRowIndex: number
  ): void {
    console.log('[SRSExcelProcessor] *** PROCESSING SRS RECORDS ***');
    
    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;
    const baseRow: number = baseRowIndex;

    for (let recordIndex: number = 0; recordIndex < records.length; recordIndex++) {
      const record: ISRSExcelRecord = records[recordIndex];
      const currentRowIndex: number = baseRow + recordIndex + 1; // +1 because Excel is 1-indexed

      console.log(`[SRSExcelProcessor] Processing record ${recordIndex + 1}/${records.length}:`, {
        contract: record.Contract,
        typeOfLeaveID: record.TypeOfLeaveID,
        rowIndex: currentRowIndex
      });

      // Обработка по типам SRS
      const result = this.processRecordByType(worksheet, record, typeOfSRS, currentRowIndex);
      cellsUpdated += result.cellsUpdated;
      commentsAdded += result.commentsAdded;

      // Обработка расширенных типов отпусков (3-19)
      if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
          record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
        const extendedResult = this.processExtendedLeaveType(worksheet, record, typeOfSRS, currentRowIndex);
        cellsUpdated += extendedResult.cellsUpdated;
        commentsAdded += extendedResult.commentsAdded;
      } 
      // Комментарии для базовых типов отпусков (1-2)
      else if (record.TypeOfLeaveID === 1 || record.TypeOfLeaveID === 2) {
        if (record.LeaveNote) {
          const leaveColumn: string | null = this.getLeaveColumnForBasicTypes(typeOfSRS, record.Contract, record.TypeOfLeaveID);
          if (leaveColumn) {
            this.addCommentToCell(worksheet, `${leaveColumn}${currentRowIndex}`, record.LeaveNote);
            commentsAdded++;
          }
        }
      }

      this.stats.processedRecords++;
    }

    this.stats.cellsUpdated = cellsUpdated;
    this.stats.commentsAdded = commentsAdded;

    this.addLog(`Processed ${records.length} records, updated ${cellsUpdated} cells, added ${commentsAdded} comments`);
    console.log('[SRSExcelProcessor] Processing complete:', { cellsUpdated, commentsAdded });
  }

  /**
   * Обрабатывает запись по типу SRS
   */
  private processRecordByType(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      return this.processRecordForType3(worksheet, record, rowIndex);
    } else {
      return this.processRecordForType2(worksheet, record, rowIndex);
    }
  }

  /**
   * Обрабатывает запись для typeOfSRS = 3
   */
  private processRecordForType3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;

    if (record.Contract === 1) {
      // Contract 1, Type 3
      worksheet.getCell(`B${rowIndex}`).value = record.ShiftStart;
      worksheet.getCell(`C${rowIndex}`).value = record.ShiftEnd;
      worksheet.getCell(`F${rowIndex}`).value = record.LunchTime;
      cellsUpdated += 3;

      // Комментарии для Contract 1, Type 3
      if (record.LunchNote) {
        this.addCommentToCell(worksheet, `F${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addCommentToCell(worksheet, `H${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки для Contract 1, Type 3
      if (record.TypeOfLeaveID === 1) {
        worksheet.getCell(`J${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }
      if (record.TypeOfLeaveID === 2) {
        worksheet.getCell(`I${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }

    } else if (record.Contract === 2) {
      // Contract 2, Type 3
      worksheet.getCell(`K${rowIndex}`).value = record.ShiftStart;
      worksheet.getCell(`L${rowIndex}`).value = record.ShiftEnd;
      worksheet.getCell(`O${rowIndex}`).value = record.LunchTime;
      cellsUpdated += 3;

      // Комментарии для Contract 2, Type 3
      if (record.LunchNote) {
        this.addCommentToCell(worksheet, `O${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addCommentToCell(worksheet, `Q${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки для Contract 2, Type 3
      if (record.TypeOfLeaveID === 1) {
        worksheet.getCell(`S${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }
      if (record.TypeOfLeaveID === 2) {
        worksheet.getCell(`R${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }
    }

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Обрабатывает запись для typeOfSRS = 2
   */
  private processRecordForType2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;

    if (record.Contract === 1) {
      // Contract 1, Type 2
      worksheet.getCell(`B${rowIndex}`).value = record.ShiftStart;
      worksheet.getCell(`C${rowIndex}`).value = record.ShiftEnd;
      worksheet.getCell(`F${rowIndex}`).value = record.LunchTime;
      cellsUpdated += 3;

      // Комментарии для Contract 1, Type 2
      if (record.LunchNote) {
        this.addCommentToCell(worksheet, `F${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addCommentToCell(worksheet, `I${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки для Contract 1, Type 2
      if (record.TypeOfLeaveID === 1) {
        worksheet.getCell(`K${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }
      if (record.TypeOfLeaveID === 2) {
        worksheet.getCell(`J${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }

    } else if (record.Contract === 2) {
      // Contract 2, Type 2
      worksheet.getCell(`L${rowIndex}`).value = record.ShiftStart;
      worksheet.getCell(`M${rowIndex}`).value = record.ShiftEnd;
      worksheet.getCell(`P${rowIndex}`).value = record.LunchTime;
      cellsUpdated += 3;

      // Комментарии для Contract 2, Type 2
      if (record.LunchNote) {
        this.addCommentToCell(worksheet, `P${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addCommentToCell(worksheet, `S${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки для Contract 2, Type 2
      if (record.TypeOfLeaveID === 1) {
        worksheet.getCell(`U${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }
      if (record.TypeOfLeaveID === 2) {
        worksheet.getCell(`T${rowIndex}`).value = record.LeaveTime;
        cellsUpdated++;
      }
    }

    return { cellsUpdated, commentsAdded };
  }

  /**
   * Обрабатывает расширенные типы отпусков (TypeOfLeaveID 3-19)
   */
  private processExtendedLeaveType(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    const columns: string[] = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? [...SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_3]
      : [...SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_2];

    const columnIndex: number = record.TypeOfLeaveID - 3; // -3 because array starts from TypeOfLeaveID 3
    const leaveColumn: string | undefined = columns[columnIndex];
    
    if (leaveColumn) {
      worksheet.getCell(`${leaveColumn}${rowIndex}`).value = record.LeaveTime;
      
      let commentsAdded: number = 0;
      if (record.LeaveNote) {
        this.addCommentToCell(worksheet, `${leaveColumn}${rowIndex}`, record.LeaveNote);
        commentsAdded = 1;
      }

      return { cellsUpdated: 1, commentsAdded };
    }

    return { cellsUpdated: 0, commentsAdded: 0 };
  }

  /**
   * Получает колонку для базовых типов отпусков (TypeOfLeaveID 1-2)
   */
  private getLeaveColumnForBasicTypes(typeOfSRS: SRSType, contract: number, typeOfLeaveID: number): string | null {
    if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      if (contract === 1) {
        return typeOfLeaveID === 1 ? 'J' : 'I'; // Type 3, Contract 1
      } else if (contract === 2) {
        return typeOfLeaveID === 1 ? 'S' : 'R'; // Type 3, Contract 2
      }
    } else {
      if (contract === 1) {
        return typeOfLeaveID === 1 ? 'K' : 'J'; // Type 2, Contract 1
      } else if (contract === 2) {
        return typeOfLeaveID === 1 ? 'U' : 'T'; // Type 2, Contract 2
      }
    }
    return null;
  }

  /**
   * Получает колонки для очистки (реплика из Office Script)
   */
  private getColumnsForClearing(typeOfSRS: SRSType): string[] {
    if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      return [...SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_3];
    } else {
      return [...SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_2];
    }
  }

  /**
   * Добавляет комментарий к ячейке (реплика из Office Script)
   */
  private addCommentToCell(worksheet: ExcelJS.Worksheet, cellAddress: string, commentText: string): boolean {
    try {
      const cell = worksheet.getCell(cellAddress);
      
      // Очищаем существующий комментарий
      if (cell.note) {
        (cell as any).note = null;
      }

      // Добавляем новый комментарий
      cell.note = commentText;
      
      this.addLog(`Added comment to ${cellAddress}: ${commentText}`);
      return true;

    } catch (e) {
      const errorMsg: string = `Error: Failed to add comment to ${cellAddress}: ${e}`;
      this.addLog(errorMsg);
      console.warn('[SRSExcelProcessor]', errorMsg);
      return false;
    }
  }

  /**
   * Инициализирует статистику
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
   * Сбрасывает процессор к начальному состоянию
   */
  private resetProcessor(): void {
    this.logs = [];
    this.stats = this.initializeStats();
  }

  /**
   * Финализирует обработку
   */
  private finalizeProcessing(startTime: number): void {
    this.stats.totalTime = Date.now() - startTime;
    this.stats.success = true;
    this.stats.skippedRecords = this.stats.inputRecords - this.stats.processedRecords;
  }

  /**
   * Обрабатывает ошибки
   */
  private handleError(error: any, startTime: number, typeOfSRS?: SRSType): ISRSExcelOperationResult {
    this.stats.totalTime = Date.now() - startTime;
    this.stats.success = false;
    
    const errorMessage: string = error instanceof Error ? error.message : String(error);
    this.stats.errors.push(errorMessage);
    this.addLog(`Error: ${errorMessage}`);

    console.error('[SRSExcelProcessor] Processing error:', error);

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
   * Добавляет запись в лог
   */
  private addLog(message: string): void {
    this.logs.push(message);
    console.log(`[SRSExcelProcessor] ${message}`);
  }

  /**
   * Создает типизированную ошибку обработки
   */
  private createProcessingError(code: string, message: string, details?: any): ISRSExcelError {
    return {
      code,
      message,
      operation: 'processSRSExcelExport',
      originalError: details
    };
  }

  /**
   * Получает текущую статистику
   */
  public getStats(): ISRSExcelProcessingStats {
    return { ...this.stats };
  }

  /**
   * Получает логи обработки
   */
  public getLogs(): string[] {
    return [...this.logs];
  }
}