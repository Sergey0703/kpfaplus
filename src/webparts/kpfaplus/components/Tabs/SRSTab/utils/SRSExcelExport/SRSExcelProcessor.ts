// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/SRSExcelExport/SRSExcelProcessor.ts

import * as ExcelJS from 'exceljs';
import { 
  ISRSExcelExportData,
  ISRSExcelOperationResult,
  ISRSExcelProcessingConfig,
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
  private logs: string[] = [];
  private stats: ISRSExcelProcessingStats;

  constructor() {
    this.stats = this.createInitialStats();
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

    const startTime = Date.now();
    this.logs = [];
    this.stats = this.createInitialStats();
    this.stats.typeOfSRS = typeOfSRS;
    this.stats.inputRecords = exportData.records.length;

    try {
      // Проверка входных данных
      this.validateInputs(workbook, worksheet, date, typeOfSRS, exportData);

      // Максимальное количество строк для обработки
      const maxPossibleRows = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
        ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
        : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;

      this.addLog(`Received ${exportData.records.length} records for processing. Type: ${typeOfSRS}`);

      // 1. Найти строку с датой в колонке A
      const baseRowIndex = await this.findDateInWorksheet(worksheet, date);
      this.addLog(`Found target date "${date}" at row ${baseRowIndex + 1} (0-based: ${baseRowIndex})`);

      // 2. Очистить все возможные строки
      await this.clearAllRows(worksheet, typeOfSRS, baseRowIndex, maxPossibleRows);

      // 3. Очистить все комментарии в обрабатываемых строках
      await this.clearCommentsInRows(worksheet, baseRowIndex, maxPossibleRows);

      // 4. Обработать каждую запись
      await this.processRecords(worksheet, exportData.records, typeOfSRS, baseRowIndex);

      // 5. Финализировать статистику
      this.finalizeStats(startTime);

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
      this.handleProcessingError(error, startTime);
      
      const errorResult: ISRSExcelOperationResult = {
        success: false,
        operation: 'export_to_excel',
        error: error instanceof Error ? error.message : 'Unknown processing error',
        processingTime: Date.now() - startTime,
        recordsProcessed: this.stats.processedRecords,
        typeOfSRS,
        dateFound: this.stats.processedRecords > 0
      };

      console.error('[SRSExcelProcessor] *** SRS EXCEL EXPORT FAILED ***', errorResult);
      return errorResult;
    }
  }

  /**
   * Валидирует входные данные
   */
  private validateInputs(
    workbook: ExcelJS.Workbook,
    worksheet: ExcelJS.Worksheet,
    date: string,
    typeOfSRS: SRSType,
    exportData: ISRSExcelExportData
  ): void {
    if (!workbook) {
      throw this.createError('WORKBOOK_NOT_FOUND', 'Workbook not found or inaccessible');
    }

    if (!worksheet) {
      throw this.createError('WORKSHEET_NOT_FOUND', 'Target worksheet not found');
    }

    if (!date || date.trim() === '') {
      throw this.createError('INVALID_DATE', 'Date parameter is required');
    }

    if (typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_2 && typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      throw this.createError('INVALID_TYPE_OF_SRS', `Invalid typeOfSRS: ${typeOfSRS}. Must be 2 or 3`);
    }

    if (!exportData.records || exportData.records.length === 0) {
      throw this.createError('NO_RECORDS', 'No records to process');
    }

    console.log('[SRSExcelProcessor] Input validation passed');
  }

  /**
   * Ищет дату в листе Excel (реплика логики из Office Script)
   */
  private async findDateInWorksheet(worksheet: ExcelJS.Worksheet, targetDate: string): Promise<number> {
    console.log('[SRSExcelProcessor] *** SEARCHING FOR DATE IN WORKSHEET ***');
    console.log('[SRSExcelProcessor] Target date:', targetDate);
    console.log('[SRSExcelProcessor] Search range:', SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE);

    const targetValue = targetDate.trim();
    
    // Получаем диапазон A1:A2000
    const rangeParts = SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE.split(':');
    const startCell = worksheet.getCell(rangeParts[0]);
    const endCell = worksheet.getCell(rangeParts[1]);
    
    const startRow = startCell.row;
    const endRow = endCell.row;

    // Проходим по всем строкам в диапазоне
    for (let row = startRow; row <= endRow; row++) {
      const cell = worksheet.getCell(row, 1); // Колонка A = индекс 1
      const cellValue = cell.value?.toString().trim() || '';
      
      if (cellValue && cellValue === targetValue) {
        console.log('[SRSExcelProcessor] Date found at row:', row, '(0-based:', row - 1, ')');
        return row - 1; // Возвращаем 0-based индекс
      }
    }

    throw this.createError('DATE_NOT_FOUND', `Target date "${targetValue}" not found in the worksheet`);
  }

  /**
   * Очищает все строки (реплика логики из Office Script)
   */
  private async clearAllRows(
    worksheet: ExcelJS.Worksheet, 
    typeOfSRS: SRSType, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): Promise<void> {
    console.log('[SRSExcelProcessor] *** CLEARING ALL ROWS ***');
    
    const columns = this.getColumnsForClearing(typeOfSRS);
    console.log('[SRSExcelProcessor] Columns to clear:', columns.join(', '));

    let clearedCells = 0;

    // Очищаем все возможные строки
    for (let i = 0; i < maxPossibleRows; i++) {
      const currentRowIndex = baseRowIndex + i + 1; // +1 потому что Excel 1-indexed

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
    this.addLog(`Cleared ${clearedCells} cells in ${maxPossibleRows} rows`);

    console.log('[SRSExcelProcessor] Cleared cells:', clearedCells);
  }

  /**
   * Очищает комментарии в обрабатываемых строках (реплика из Office Script)
   */
  private async clearCommentsInRows(
    worksheet: ExcelJS.Worksheet, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): Promise<void> {
    console.log('[SRSExcelProcessor] *** CLEARING COMMENTS IN ROWS ***');
    
    let deletedComments = 0;
    const startRow = baseRowIndex + 1; // Excel 1-indexed
    const endRow = baseRowIndex + maxPossibleRows;

    try {
      // ExcelJS не имеет прямого API для получения всех комментариев
      // Очищаем комментарии построчно в разумном диапазоне колонок
      for (let row = startRow; row <= endRow; row++) {
        // Проходим по колонкам от A до BZ (примерно 200 колонок)
        for (let col = 1; col <= 200; col++) {
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
   * Обрабатывает записи SRS (реплика логики из Office Script)
   */
  private async processRecords(
    worksheet: ExcelJS.Worksheet,
    records: ISRSExcelRecord[],
    typeOfSRS: SRSType,
    baseRowIndex: number
  ): Promise<void> {
    console.log('[SRSExcelProcessor] *** PROCESSING SRS RECORDS ***');
    
    let cellsUpdated = 0;
    let commentsAdded = 0;

    for (let recordIndex = 0; recordIndex < records.length; recordIndex++) {
      const record = records[recordIndex];
      const currentRowIndex = baseRowIndex + recordIndex + 1; // +1 because Excel is 1-indexed

      console.log(`[SRSExcelProcessor] Processing record ${recordIndex + 1}/${records.length}:`, {
        contract: record.Contract,
        typeOfLeaveID: record.TypeOfLeaveID,
        rowIndex: currentRowIndex
      });

      if (typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
        const result = await this.processRecordForType3(worksheet, record, currentRowIndex);
        cellsUpdated += result.cellsUpdated;
        commentsAdded += result.commentsAdded;
      } else {
        const result = await this.processRecordForType2(worksheet, record, currentRowIndex);
        cellsUpdated += result.cellsUpdated;
        commentsAdded += result.commentsAdded;
      }

      // Обработка TypeOfLeaveID 3-19 (общая для всех типов)
      if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
          record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
        const extendedResult = await this.processExtendedLeaveType(worksheet, record, typeOfSRS, currentRowIndex);
        cellsUpdated += extendedResult.cellsUpdated;
        commentsAdded += extendedResult.commentsAdded;
      } 
      // Комментарии для TypeOfLeaveID 1-2
      else if (record.TypeOfLeaveID === 1 || record.TypeOfLeaveID === 2) {
        if (record.LeaveNote) {
          const leaveColumn = this.getLeaveColumnForType12(typeOfSRS, record.Contract, record.TypeOfLeaveID);
          if (leaveColumn) {
            this.addComment(worksheet, `${leaveColumn}${currentRowIndex}`, record.LeaveNote);
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
   * Обрабатывает запись для typeOfSRS = 3
   */
  private async processRecordForType3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): Promise<{ cellsUpdated: number; commentsAdded: number }> {
    let cellsUpdated = 0;
    let commentsAdded = 0;

    if (record.Contract === 1) {
      // Contract 1, Type 3
      worksheet.getCell(`B${rowIndex}`).value = record.ShiftStart;
      worksheet.getCell(`C${rowIndex}`).value = record.ShiftEnd;
      worksheet.getCell(`F${rowIndex}`).value = record.LunchTime;
      cellsUpdated += 3;

      // Комментарии
      if (record.LunchNote) {
        this.addComment(worksheet, `F${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addComment(worksheet, `H${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки
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

      // Комментарии
      if (record.LunchNote) {
        this.addComment(worksheet, `O${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addComment(worksheet, `Q${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки
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
  private async processRecordForType2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): Promise<{ cellsUpdated: number; commentsAdded: number }> {
    let cellsUpdated = 0;
    let commentsAdded = 0;

    if (record.Contract === 1) {
      // Contract 1, Type 2
      worksheet.getCell(`B${rowIndex}`).value = record.ShiftStart;
      worksheet.getCell(`C${rowIndex}`).value = record.ShiftEnd;
      worksheet.getCell(`F${rowIndex}`).value = record.LunchTime;
      cellsUpdated += 3;

      // Комментарии
      if (record.LunchNote) {
        this.addComment(worksheet, `F${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addComment(worksheet, `I${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки
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

      // Комментарии
      if (record.LunchNote) {
        this.addComment(worksheet, `P${rowIndex}`, record.LunchNote);
        commentsAdded++;
      }
      if (record.TotalHoursNote) {
        this.addComment(worksheet, `S${rowIndex}`, record.TotalHoursNote);
        commentsAdded++;
      }

      // TypeOfLeaveID специфичные ячейки
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
  private async processExtendedLeaveType(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    rowIndex: number
  ): Promise<{ cellsUpdated: number; commentsAdded: number }> {
    const columns = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_3
      : SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_2;

    const leaveColumn = columns[record.TypeOfLeaveID - 3]; // -3 because array starts from TypeOfLeaveID 3
    
    if (leaveColumn) {
      worksheet.getCell(`${leaveColumn}${rowIndex}`).value = record.LeaveTime;
      
      let commentsAdded = 0;
      if (record.LeaveNote) {
        this.addComment(worksheet, `${leaveColumn}${rowIndex}`, record.LeaveNote);
        commentsAdded = 1;
      }

      return { cellsUpdated: 1, commentsAdded };
    }

    return { cellsUpdated: 0, commentsAdded: 0 };
  }

  /**
   * Получает колонку для TypeOfLeaveID 1-2
   */
  private getLeaveColumnForType12(typeOfSRS: SRSType, contract: number, typeOfLeaveID: number): string | null {
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
      return SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_3;
    } else {
      return SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_2;
    }
  }

  /**
   * Добавляет комментарий к ячейке (реплика из Office Script)
   */
  private addComment(worksheet: ExcelJS.Worksheet, cellAddress: string, commentText: string): boolean {
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
      const errorMsg = `Error: Failed to add comment to ${cellAddress}: ${e}`;
      this.addLog(errorMsg);
      console.warn('[SRSExcelProcessor]', errorMsg);
      return false;
    }
  }

  /**
   * Инициализирует статистику
   */
  private createInitialStats(): ISRSExcelProcessingStats {
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
   * Финализирует статистику
   */
  private finalizeStats(startTime: number): void {
    this.stats.totalTime = Date.now() - startTime;
    this.stats.success = true;
    this.stats.skippedRecords = this.stats.inputRecords - this.stats.processedRecords;
  }

  /**
   * Обрабатывает ошибки
   */
  private handleProcessingError(error: any, startTime: number): void {
    this.stats.totalTime = Date.now() - startTime;
    this.stats.success = false;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.stats.errors.push(errorMessage);
    this.addLog(`Error: ${errorMessage}`);

    console.error('[SRSExcelProcessor] Processing error:', error);
  }

  /**
   * Добавляет запись в лог
   */
  private addLog(message: string): void {
    this.logs.push(message);
    console.log(`[SRSExcelProcessor] ${message}`);
  }

  /**
   * Создает типизированную ошибку
   */
  private createError(code: string, message: string, details?: any): ISRSExcelError {
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