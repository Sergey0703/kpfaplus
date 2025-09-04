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
    console.log('[SRSExcelProcessor] *** VALIDATING INPUT DATA ***');
    
    if (!workbook) {
      console.error('[SRSExcelProcessor] VALIDATION ERROR: Workbook not found or inaccessible');
      throw this.createProcessingError('WORKBOOK_NOT_FOUND', 'Workbook not found or inaccessible');
    }
    console.log('[SRSExcelProcessor] ✓ Workbook validation passed');

    if (!worksheet) {
      console.error('[SRSExcelProcessor] VALIDATION ERROR: Target worksheet not found');
      throw this.createProcessingError('WORKSHEET_NOT_FOUND', 'Target worksheet not found');
    }
    console.log('[SRSExcelProcessor] ✓ Worksheet validation passed');

    // Дополнительная проверка листа
    try {
      const worksheetName = worksheet.name;
      console.log('[SRSExcelProcessor] ✓ Worksheet details:', {
        name: worksheetName,
        expectedName: SRS_EXCEL_CONSTANTS.WORKSHEET_NAME,
        isCorrectName: worksheetName === SRS_EXCEL_CONSTANTS.WORKSHEET_NAME,
        rowCount: worksheet.rowCount,
        columnCount: worksheet.columnCount
      });
      
      if (worksheetName !== SRS_EXCEL_CONSTANTS.WORKSHEET_NAME) {
        console.warn('[SRSExcelProcessor] WARNING: Worksheet name mismatch:', {
          actual: worksheetName,
          expected: SRS_EXCEL_CONSTANTS.WORKSHEET_NAME
        });
      }
    } catch (worksheetError) {
      console.error('[SRSExcelProcessor] Error reading worksheet details:', worksheetError);
    }

    if (!date || date.trim() === '') {
      console.error('[SRSExcelProcessor] VALIDATION ERROR: Date parameter is required');
      throw this.createProcessingError('INVALID_DATE', 'Date parameter is required');
    }
    console.log('[SRSExcelProcessor] ✓ Date validation passed:', date);

    if (typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_2 && typeOfSRS !== SRS_EXCEL_CONSTANTS.SRS_TYPE_3) {
      console.error('[SRSExcelProcessor] VALIDATION ERROR: Invalid typeOfSRS:', typeOfSRS);
      throw this.createProcessingError('INVALID_TYPE_OF_SRS', `Invalid typeOfSRS: ${typeOfSRS}. Must be 2 or 3`);
    }
    console.log('[SRSExcelProcessor] ✓ TypeOfSRS validation passed:', typeOfSRS);

    if (!exportData.records || exportData.records.length === 0) {
      console.error('[SRSExcelProcessor] VALIDATION ERROR: No records to process');
      throw this.createProcessingError('NO_RECORDS', 'No records to process');
    }
    console.log('[SRSExcelProcessor] ✓ Records validation passed:', exportData.records.length, 'records');

    console.log('[SRSExcelProcessor] *** ALL INPUT VALIDATIONS PASSED ***');
  }

  /**
   * Получает максимальное количество строк для типа SRS
   */
  private getMaxRowsForType(typeOfSRS: SRSType): number {
    const maxRows = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_3 
      : SRS_EXCEL_CONSTANTS.MAX_ROWS_TYPE_2;
    
    console.log('[SRSExcelProcessor] Max rows for typeOfSRS', typeOfSRS, ':', maxRows);
    return maxRows;
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Ищет дату в листе Excel ***
   */
  private findDateInWorksheet(worksheet: ExcelJS.Worksheet, targetDate: string): number {
    console.log('[SRSExcelProcessor] *** SEARCHING FOR DATE IN WORKSHEET ***');
    console.log('[SRSExcelProcessor] Target date to find:', targetDate);
    console.log('[SRSExcelProcessor] Search range:', SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE);
    console.log('[SRSExcelProcessor] Worksheet name:', worksheet.name);
    console.log('[SRSExcelProcessor] Worksheet dimensions:', {
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount
    });

    const targetValue: string = targetDate.trim();
    
    // Парсим диапазон A1:A2000
    const rangeParts: string[] = SRS_EXCEL_CONSTANTS.DATE_SEARCH_RANGE.split(':');
    const startCell = worksheet.getCell(rangeParts[0]);
    const endCell = worksheet.getCell(rangeParts[1]);
    
    const startRow: number = typeof startCell.row === 'number' ? startCell.row : parseInt(String(startCell.row), 10) || 1;
    const endRow: number = typeof endCell.row === 'number' ? endCell.row : parseInt(String(endCell.row), 10) || 2000;

    console.log('[SRSExcelProcessor] Search parameters:', {
      startRow,
      endRow,
      totalRowsToCheck: endRow - startRow + 1,
      searchColumn: 'A (index 1)'
    });

    let searchProgress = 0;
    const progressInterval = 100; // Логируем каждые 100 строк
    let foundDates: Array<{row: number, value: string}> = [];

    // Проходим по всем строкам в диапазоне
    for (let row: number = startRow; row <= endRow; row++) {
      try {
        const cell = worksheet.getCell(row, 1); // Колонка A = индекс 1
        const cellValue: string = cell.value?.toString().trim() || '';
        
        // Логируем прогресс
        searchProgress++;
        if (searchProgress % progressInterval === 0) {
          console.log('[SRSExcelProcessor] Search progress:', {
            currentRow: row,
            progress: `${searchProgress}/${endRow - startRow + 1}`,
            percentage: Math.round((searchProgress / (endRow - startRow + 1)) * 100) + '%'
          });
        }

        // Если нашли непустое значение, логируем его
        if (cellValue && cellValue.length > 0) {
          foundDates.push({row, value: cellValue});
          
          // Логируем первые несколько найденных дат для отладки
          if (foundDates.length <= 10) {
            console.log('[SRSExcelProcessor] Found date value at row', row, ':', cellValue);
          }
          
          // Проверяем точное совпадение
          if (cellValue === targetValue) {
            console.log('[SRSExcelProcessor] *** EXACT DATE MATCH FOUND ***');
            console.log('[SRSExcelProcessor] Match details:', {
              row: row,
              zeroBasedIndex: row - 1,
              cellValue: cellValue,
              targetValue: targetValue,
              searchProgress: `${searchProgress}/${endRow - startRow + 1}`
            });
            
            console.log('[SRSExcelProcessor] Total dates found in search:', foundDates.length);
            return row - 1; // Возвращаем 0-based индекс
          }
        }
      } catch (cellError) {
        console.warn('[SRSExcelProcessor] Error reading cell at row', row, ':', cellError);
        continue;
      }
    }

    // Если дата не найдена, логируем подробную информацию
    console.error('[SRSExcelProcessor] *** DATE NOT FOUND ***');
    console.error('[SRSExcelProcessor] Search completed without finding target date');
    console.error('[SRSExcelProcessor] Search summary:', {
      targetDate: targetValue,
      totalRowsSearched: searchProgress,
      totalDatesFound: foundDates.length,
      searchRange: `${startRow}-${endRow}`,
      worksheet: worksheet.name
    });

    // Логируем все найденные даты для анализа
    if (foundDates.length > 0) {
      console.error('[SRSExcelProcessor] All dates found during search:');
      foundDates.forEach((dateInfo, index) => {
        console.error(`[SRSExcelProcessor] ${index + 1}. Row ${dateInfo.row}: "${dateInfo.value}"`);
      });
      
      // Ищем похожие даты
      const similarDates = foundDates.filter(dateInfo => 
        dateInfo.value.includes(targetValue) || targetValue.includes(dateInfo.value)
      );
      
      if (similarDates.length > 0) {
        console.error('[SRSExcelProcessor] Similar dates found:');
        similarDates.forEach(dateInfo => {
          console.error(`[SRSExcelProcessor] Row ${dateInfo.row}: "${dateInfo.value}" (similarity check)`);
        });
      }
    } else {
      console.error('[SRSExcelProcessor] No dates found in column A at all!');
      console.error('[SRSExcelProcessor] This might indicate:');
      console.error('[SRSExcelProcessor] - Wrong worksheet');
      console.error('[SRSExcelProcessor] - Dates are in different column'); 
      console.error('[SRSExcelProcessor] - Date format mismatch');
      console.error('[SRSExcelProcessor] - Empty worksheet');
    }

    throw this.createProcessingError('DATE_NOT_FOUND', `Target date "${targetValue}" not found in the worksheet`);
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Очищает все строки ***
   */
  private clearAllRows(
    worksheet: ExcelJS.Worksheet, 
    typeOfSRS: SRSType, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): void {
    console.log('[SRSExcelProcessor] *** CLEARING ALL ROWS ***');
    console.log('[SRSExcelProcessor] Clear operation parameters:', {
      typeOfSRS,
      baseRowIndex,
      maxPossibleRows,
      worksheetName: worksheet.name
    });
    
    const columns: string[] = this.getColumnsForClearing(typeOfSRS);
    console.log('[SRSExcelProcessor] Columns to clear:', columns.join(', '));
    console.log('[SRSExcelProcessor] Total columns to clear:', columns.length);

    let clearedCells: number = 0;
    let errors: string[] = [];
    const baseRow: number = baseRowIndex;
    const maxRows: number = maxPossibleRows;

    console.log('[SRSExcelProcessor] Starting row clearing process:', {
      startingRow: baseRow + 1,
      endingRow: baseRow + maxRows,
      totalRowsToClear: maxRows
    });

    // Очищаем все возможные строки
    for (let i: number = 0; i < maxRows; i++) {
      const currentRowIndex: number = baseRow + i + 1; // +1 потому что Excel 1-indexed
      
      console.log('[SRSExcelProcessor] Clearing row', currentRowIndex, `(${i + 1}/${maxRows})`);

      try {
        // Очищаем дату во всех строках кроме первой
        if (i > 0) {
          const dateCell = worksheet.getCell(currentRowIndex, 1); // Колонка A
          const oldDateValue = dateCell.value;
          dateCell.value = null;
          clearedCells++;
          
          if (oldDateValue) {
            console.log('[SRSExcelProcessor] Cleared date from row', currentRowIndex, '- was:', oldDateValue);
          }
        }

        // Очищаем каждую ячейку по адресу
        let rowCellsCleared = 0;
        for (const col of columns) {
          try {
            const cellAddress = `${col}${currentRowIndex}`;
            const cell = worksheet.getCell(cellAddress);
            const oldValue = cell.value;
            cell.value = null;
            clearedCells++;
            rowCellsCleared++;
            
            if (oldValue) {
              console.log('[SRSExcelProcessor] Cleared cell', cellAddress, '- was:', oldValue);
            }
          } catch (cellError) {
            const errorMsg = `Error clearing cell ${col}${currentRowIndex}: ${cellError}`;
            console.error('[SRSExcelProcessor]', errorMsg);
            errors.push(errorMsg);
          }
        }
        
        console.log('[SRSExcelProcessor] Row', currentRowIndex, 'clearing summary:', {
          cellsCleared: rowCellsCleared,
          expectedCells: columns.length,
          success: rowCellsCleared === columns.length
        });

      } catch (rowError) {
        const errorMsg = `Error clearing row ${currentRowIndex}: ${rowError}`;
        console.error('[SRSExcelProcessor]', errorMsg);
        errors.push(errorMsg);
      }
    }

    this.stats.cellsCleared = clearedCells;
    
    console.log('[SRSExcelProcessor] *** ROW CLEARING COMPLETED ***');
    console.log('[SRSExcelProcessor] Clearing results:', {
      totalCellsCleared: clearedCells,
      rowsProcessed: maxRows,
      columnsPerRow: columns.length,
      expectedTotalCells: maxRows * columns.length + (maxRows - 1), // +даты кроме первой строки
      errorsCount: errors.length,
      successRate: errors.length === 0 ? '100%' : `${Math.round((1 - errors.length / (maxRows * columns.length)) * 100)}%`
    });

    if (errors.length > 0) {
      console.error('[SRSExcelProcessor] Clearing errors encountered:', errors);
    }

    this.addLog(`Cleared ${clearedCells} cells in ${maxRows} rows with ${errors.length} errors`);
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Очищает комментарии в обрабатываемых строках ***
   */
  private clearCommentsInRows(
    worksheet: ExcelJS.Worksheet, 
    baseRowIndex: number, 
    maxPossibleRows: number
  ): void {
    console.log('[SRSExcelProcessor] *** CLEARING COMMENTS IN ROWS ***');
    console.log('[SRSExcelProcessor] Comment clearing parameters:', {
      baseRowIndex,
      maxPossibleRows,
      worksheetName: worksheet.name
    });
    
    let deletedComments: number = 0;
    let errors: string[] = [];
    const baseRow: number = baseRowIndex;
    const maxRows: number = maxPossibleRows;
    const startRow: number = baseRow + 1; // Excel 1-indexed
    const endRow: number = baseRow + maxRows;

    console.log('[SRSExcelProcessor] Comment clearing range:', {
      startRow,
      endRow,
      totalRows: maxRows,
      columnsToCheck: 200
    });

    try {
      // ExcelJS не имеет прямого API для получения всех комментариев
      // Очищаем комментарии построчно в разумном диапазоне колонок
      for (let row: number = startRow; row <= endRow; row++) {
        console.log('[SRSExcelProcessor] Checking row', row, 'for comments');
        let rowCommentsFound = 0;
        let rowCommentsCleared = 0;
        
        // Проходим по колонкам от A до BZ (примерно 200 колонок)
        for (let col: number = 1; col <= 200; col++) {
          try {
            const cell = worksheet.getCell(row, col);
            
            if (cell.note) {
              rowCommentsFound++;
              const oldComment = cell.note;
              console.log('[SRSExcelProcessor] Found comment in cell', `${this.getColumnLetter(col)}${row}:`, oldComment);
              
              // ExcelJS note property handling
              delete (cell as { note?: string }).note;
              deletedComments++;
              rowCommentsCleared++;
              
              console.log('[SRSExcelProcessor] Cleared comment from cell', `${this.getColumnLetter(col)}${row}`);
            }
          } catch (cellError) {
            const errorMsg = `Error checking/clearing comment in cell ${this.getColumnLetter(col)}${row}: ${cellError}`;
            errors.push(errorMsg);
            continue;
          }
        }
        
        if (rowCommentsFound > 0) {
          console.log('[SRSExcelProcessor] Row', row, 'comment summary:', {
            commentsFound: rowCommentsFound,
            commentsCleared: rowCommentsCleared
          });
        }
      }

      this.stats.commentsCleared = deletedComments;
      
      console.log('[SRSExcelProcessor] *** COMMENT CLEARING COMPLETED ***');
      console.log('[SRSExcelProcessor] Comment clearing results:', {
        totalCommentsDeleted: deletedComments,
        rowsProcessed: maxRows,
        errorsCount: errors.length,
        successRate: errors.length === 0 ? '100%' : `${Math.round((1 - errors.length / (maxRows * 200)) * 100)}%`
      });

      this.addLog(`Cleared ${deletedComments} comments in rows ${startRow}-${endRow} with ${errors.length} errors`);

    } catch (commentError) {
      const errorMsg = `Critical error during comment clearing: ${commentError}`;
      console.error('[SRSExcelProcessor]', errorMsg);
      this.addLog(`Warning: Could not clear all comments - ${commentError}`);
    }

    if (errors.length > 0 && errors.length <= 10) {
      console.warn('[SRSExcelProcessor] Comment clearing errors (showing first 10):', errors.slice(0, 10));
    } else if (errors.length > 10) {
      console.warn('[SRSExcelProcessor] Comment clearing errors:', `${errors.length} total errors (too many to display)`);
    }
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Обрабатывает все записи SRS ***
   */
  private processAllRecords(
    worksheet: ExcelJS.Worksheet,
    records: ISRSExcelRecord[],
    typeOfSRS: SRSType,
    baseRowIndex: number
  ): void {
    console.log('[SRSExcelProcessor] *** PROCESSING SRS RECORDS ***');
    console.log('[SRSExcelProcessor] Processing parameters:', {
      totalRecords: records.length,
      typeOfSRS,
      baseRowIndex,
      startingExcelRow: baseRowIndex + 1,
      worksheetName: worksheet.name
    });
    
    let cellsUpdated: number = 0;
    let commentsAdded: number = 0;
    let processingErrors: string[] = [];
    const baseRow: number = baseRowIndex;

    // Анализируем входные данные
    const recordAnalysis = this.analyzeRecords(records);
    console.log('[SRSExcelProcessor] Record analysis:', recordAnalysis);

    for (let recordIndex: number = 0; recordIndex < records.length; recordIndex++) {
      const record: ISRSExcelRecord = records[recordIndex];
      const currentRowIndex: number = baseRow + recordIndex + 1; // +1 because Excel is 1-indexed
      const recordNumber = recordIndex + 1;

      console.log('[SRSExcelProcessor] *** PROCESSING RECORD', recordNumber, 'OF', records.length, '***');
      console.log('[SRSExcelProcessor] Record details:', {
        recordIndex,
        excelRowIndex: currentRowIndex,
        contract: record.Contract,
        typeOfLeaveID: record.TypeOfLeaveID,
        shiftStart: record.ShiftStart,
        shiftEnd: record.ShiftEnd,
        lunchTime: record.LunchTime,
        leaveTime: record.LeaveTime
      });

      try {
        // Обработка по типам SRS
        const result = this.processRecordByType(worksheet, record, typeOfSRS, currentRowIndex);
        cellsUpdated += result.cellsUpdated;
        commentsAdded += result.commentsAdded;

        console.log('[SRSExcelProcessor] Record', recordNumber, 'basic processing result:', {
          cellsUpdated: result.cellsUpdated,
          commentsAdded: result.commentsAdded
        });

        // Обработка расширенных типов отпусков (3-19)
        if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
            record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
          
          console.log('[SRSExcelProcessor] Processing extended leave type', record.TypeOfLeaveID, 'for record', recordNumber);
          
          const extendedResult = this.processExtendedLeaveType(worksheet, record, typeOfSRS, currentRowIndex);
          cellsUpdated += extendedResult.cellsUpdated;
          commentsAdded += extendedResult.commentsAdded;
          
          console.log('[SRSExcelProcessor] Extended leave processing result:', extendedResult);
        } 
        // Комментарии для базовых типов отпусков (1-2)
        else if (record.TypeOfLeaveID === 1 || record.TypeOfLeaveID === 2) {
          console.log('[SRSExcelProcessor] Processing basic leave type', record.TypeOfLeaveID, 'for record', recordNumber);
          
          if (record.LeaveNote) {
            const leaveColumn: string | null = this.getLeaveColumnForBasicTypes(typeOfSRS, record.Contract, record.TypeOfLeaveID);
            if (leaveColumn) {
              const cellAddress = `${leaveColumn}${currentRowIndex}`;
              console.log('[SRSExcelProcessor] Adding leave note to cell', cellAddress);
              
              const commentAdded = this.addCommentToCell(worksheet, cellAddress, record.LeaveNote);
              if (commentAdded) {
                commentsAdded++;
                console.log('[SRSExcelProcessor] Successfully added leave note to', cellAddress);
              }
            } else {
              console.warn('[SRSExcelProcessor] Could not determine leave column for basic type', record.TypeOfLeaveID);
            }
          }
        }

        this.stats.processedRecords++;
        
        console.log('[SRSExcelProcessor] *** RECORD', recordNumber, 'PROCESSING COMPLETED ***');
        console.log('[SRSExcelProcessor] Record', recordNumber, 'final result:', {
          cellsUpdated: cellsUpdated,
          commentsAdded: commentsAdded,
          totalProcessed: this.stats.processedRecords
        });

      } catch (recordError) {
        const errorMsg = `Error processing record ${recordNumber}: ${recordError}`;
        console.error('[SRSExcelProcessor]', errorMsg);
        processingErrors.push(errorMsg);
        
        // Продолжаем обработку остальных записей
        continue;
      }
    }

    this.stats.cellsUpdated = cellsUpdated;
    this.stats.commentsAdded = commentsAdded;

    console.log('[SRSExcelProcessor] *** ALL RECORDS PROCESSING COMPLETED ***');
    console.log('[SRSExcelProcessor] Final processing results:', {
      totalRecords: records.length,
      recordsProcessed: this.stats.processedRecords,
      cellsUpdated: cellsUpdated,
      commentsAdded: commentsAdded,
      processingErrors: processingErrors.length,
      successRate: `${Math.round((this.stats.processedRecords / records.length) * 100)}%`
    });

    if (processingErrors.length > 0) {
      console.error('[SRSExcelProcessor] Processing errors encountered:', processingErrors);
    }

    this.addLog(`Processed ${records.length} records, updated ${cellsUpdated} cells, added ${commentsAdded} comments with ${processingErrors.length} errors`);
  }

  /**
   * Анализирует записи перед обработкой
   */
  private analyzeRecords(records: ISRSExcelRecord[]): {
    totalRecords: number;
    contractBreakdown: Record<number, number>;
    leaveTypeBreakdown: Record<number, number>;
    hasComments: boolean;
    hasExtendedLeaveTypes: boolean;
  } {
    const analysis = {
      totalRecords: records.length,
      contractBreakdown: {} as Record<number, number>,
      leaveTypeBreakdown: {} as Record<number, number>,
      hasComments: false,
      hasExtendedLeaveTypes: false
    };

    records.forEach(record => {
      // Анализ контрактов
      analysis.contractBreakdown[record.Contract] = (analysis.contractBreakdown[record.Contract] || 0) + 1;
      
      // Анализ типов отпусков
      analysis.leaveTypeBreakdown[record.TypeOfLeaveID] = (analysis.leaveTypeBreakdown[record.TypeOfLeaveID] || 0) + 1;
      
      // Проверка комментариев
      if (record.LunchNote || record.TotalHoursNote || record.LeaveNote) {
        analysis.hasComments = true;
      }
      
      // Проверка расширенных типов отпусков
      if (record.TypeOfLeaveID >= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MIN && 
          record.TypeOfLeaveID <= SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_ID_MAX) {
        analysis.hasExtendedLeaveTypes = true;
      }
    });

    return analysis;
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
    console.log('[SRSExcelProcessor] Processing record by type:', {
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
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Обрабатывает запись для typeOfSRS = 3 ***
   */
  private processRecordForType3(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelProcessor] *** PROCESSING RECORD FOR TYPE 3 ***');
    console.log('[SRSExcelProcessor] Type 3 processing parameters:', {
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
    const updateResults: Array<{cell: string, value: any, success: boolean}> = [];

    if (record.Contract === 1) {
      console.log('[SRSExcelProcessor] Processing Contract 1, Type 3');
      
      // Contract 1, Type 3 - основные ячейки
      const updates = [
        { cell: `B${rowIndex}`, value: record.ShiftStart, desc: 'Start time' },
        { cell: `C${rowIndex}`, value: record.ShiftEnd, desc: 'End time' },
        { cell: `F${rowIndex}`, value: record.LunchTime, desc: 'Lunch time' }
      ];
      
      updates.forEach(update => {
        try {
          console.log('[SRSExcelProcessor] Updating cell', update.cell, 'with', update.value, `(${update.desc})`);
          const cell = worksheet.getCell(update.cell);
          const oldValue = cell.value;
          
          // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Устанавливаем значение и правильный формат времени ***
          cell.value = update.value;
          // Different formats for different cell types
          if (update.desc === 'Lunch time') {
            cell.numFmt = 'h:mm'; // Lunch time format (duration)
          } else {
            cell.numFmt = 'h:mm AM/PM'; // Shift time format (time of day)
          }
          
          cellsUpdated++;
          
          updateResults.push({ cell: update.cell, value: update.value, success: true });
          console.log('[SRSExcelProcessor] ✓ Successfully updated', update.cell, ':', oldValue, '->', update.value, 'with correct time format');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to update', update.cell, ':', error);
          updateResults.push({ cell: update.cell, value: update.value, success: false });
        }
      });

      // Комментарии для Contract 1, Type 3
      if (record.LunchNote) {
        console.log('[SRSExcelProcessor] Adding lunch note to F' + rowIndex);
        if (this.addCommentToCell(worksheet, `F${rowIndex}`, record.LunchNote)) {
          commentsAdded++;
        }
      }
      
      if (record.TotalHoursNote) {
        console.log('[SRSExcelProcessor] Adding total hours note to H' + rowIndex);
        if (this.addCommentToCell(worksheet, `H${rowIndex}`, record.TotalHoursNote)) {
          commentsAdded++;
        }
      }

      // TypeOfLeaveID специфичные ячейки для Contract 1, Type 3
      if (record.TypeOfLeaveID === 1) {
        console.log('[SRSExcelProcessor] Setting leave type 1 value in J' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`J${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 1 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 1 value:', error);
        }
      }
      
      if (record.TypeOfLeaveID === 2) {
        console.log('[SRSExcelProcessor] Setting leave type 2 value in I' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`I${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 2 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 2 value:', error);
        }
      }

    } else if (record.Contract === 2) {
      console.log('[SRSExcelProcessor] Processing Contract 2, Type 3');
      
      // Contract 2, Type 3 - основные ячейки
      const updates = [
        { cell: `K${rowIndex}`, value: record.ShiftStart, desc: 'Start time' },
        { cell: `L${rowIndex}`, value: record.ShiftEnd, desc: 'End time' },
        { cell: `O${rowIndex}`, value: record.LunchTime, desc: 'Lunch time' }
      ];
      
      updates.forEach(update => {
        try {
          console.log('[SRSExcelProcessor] Updating cell', update.cell, 'with', update.value, `(${update.desc})`);
          const cell = worksheet.getCell(update.cell);
          const oldValue = cell.value;
          
          // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Устанавливаем значение и правильный формат времени ***
          cell.value = update.value;
          // Different formats for different cell types
          if (update.desc === 'Lunch time') {
            cell.numFmt = 'h:mm'; // Lunch time format (duration)
          } else {
            cell.numFmt = 'h:mm AM/PM'; // Shift time format (time of day)
          }
          
          cellsUpdated++;
          
          updateResults.push({ cell: update.cell, value: update.value, success: true });
          console.log('[SRSExcelProcessor] ✓ Successfully updated', update.cell, ':', oldValue, '->', update.value, 'with correct time format');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to update', update.cell, ':', error);
          updateResults.push({ cell: update.cell, value: update.value, success: false });
        }
      });

      // Комментарии для Contract 2, Type 3
      if (record.LunchNote) {
        console.log('[SRSExcelProcessor] Adding lunch note to O' + rowIndex);
        if (this.addCommentToCell(worksheet, `O${rowIndex}`, record.LunchNote)) {
          commentsAdded++;
        }
      }
      
      if (record.TotalHoursNote) {
        console.log('[SRSExcelProcessor] Adding total hours note to Q' + rowIndex);
        if (this.addCommentToCell(worksheet, `Q${rowIndex}`, record.TotalHoursNote)) {
          commentsAdded++;
        }
      }

      // TypeOfLeaveID специфичные ячейки для Contract 2, Type 3
      if (record.TypeOfLeaveID === 1) {
        console.log('[SRSExcelProcessor] Setting leave type 1 value in S' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`S${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 1 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 1 value:', error);
        }
      }
      
      if (record.TypeOfLeaveID === 2) {
        console.log('[SRSExcelProcessor] Setting leave type 2 value in R' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`R${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 2 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 2 value:', error);
        }
      }
    }

    console.log('[SRSExcelProcessor] *** TYPE 3 PROCESSING COMPLETED ***');
    console.log('[SRSExcelProcessor] Type 3 results:', {
      cellsUpdated,
      commentsAdded,
      updateResults: updateResults.length,
      successfulUpdates: updateResults.filter(r => r.success).length,
      failedUpdates: updateResults.filter(r => !r.success).length
    });

    return { cellsUpdated, commentsAdded };
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Обрабатывает запись для typeOfSRS = 2 ***
   */
  private processRecordForType2(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelProcessor] *** PROCESSING RECORD FOR TYPE 2 ***');
    console.log('[SRSExcelProcessor] Type 2 processing parameters:', {
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
    const updateResults: Array<{cell: string, value: any, success: boolean}> = [];

    if (record.Contract === 1) {
      console.log('[SRSExcelProcessor] Processing Contract 1, Type 2');
      
      // Contract 1, Type 2 - основные ячейки
      const updates = [
        { cell: `B${rowIndex}`, value: record.ShiftStart, desc: 'Start time' },
        { cell: `C${rowIndex}`, value: record.ShiftEnd, desc: 'End time' },
        { cell: `F${rowIndex}`, value: record.LunchTime, desc: 'Lunch time' }
      ];
      
      updates.forEach(update => {
        try {
          console.log('[SRSExcelProcessor] Updating cell', update.cell, 'with', update.value, `(${update.desc})`);
          const cell = worksheet.getCell(update.cell);
          const oldValue = cell.value;
          
          // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Устанавливаем значение и правильный формат времени ***
          cell.value = update.value;
          // Different formats for different cell types
          if (update.desc === 'Lunch time') {
            cell.numFmt = 'h:mm'; // Lunch time format (duration)
          } else {
            cell.numFmt = 'h:mm AM/PM'; // Shift time format (time of day)
          }
          
          cellsUpdated++;
          
          updateResults.push({ cell: update.cell, value: update.value, success: true });
          console.log('[SRSExcelProcessor] ✓ Successfully updated', update.cell, ':', oldValue, '->', update.value, 'with correct time format');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to update', update.cell, ':', error);
          updateResults.push({ cell: update.cell, value: update.value, success: false });
        }
      });

      // Комментарии для Contract 1, Type 2
      if (record.LunchNote) {
        console.log('[SRSExcelProcessor] Adding lunch note to F' + rowIndex);
        if (this.addCommentToCell(worksheet, `F${rowIndex}`, record.LunchNote)) {
          commentsAdded++;
        }
      }
      
      if (record.TotalHoursNote) {
        console.log('[SRSExcelProcessor] Adding total hours note to I' + rowIndex);
        if (this.addCommentToCell(worksheet, `I${rowIndex}`, record.TotalHoursNote)) {
          commentsAdded++;
        }
      }

      // TypeOfLeaveID специфичные ячейки для Contract 1, Type 2
      if (record.TypeOfLeaveID === 1) {
        console.log('[SRSExcelProcessor] Setting leave type 1 value in K' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`K${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 1 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 1 value:', error);
        }
      }
      
      if (record.TypeOfLeaveID === 2) {
        console.log('[SRSExcelProcessor] Setting leave type 2 value in J' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`J${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 2 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 2 value:', error);
        }
      }

    } else if (record.Contract === 2) {
      console.log('[SRSExcelProcessor] Processing Contract 2, Type 2');
      
      // Contract 2, Type 2 - основные ячейки
      const updates = [
        { cell: `L${rowIndex}`, value: record.ShiftStart, desc: 'Start time' },
        { cell: `M${rowIndex}`, value: record.ShiftEnd, desc: 'End time' },
        { cell: `P${rowIndex}`, value: record.LunchTime, desc: 'Lunch time' }
      ];
      
      updates.forEach(update => {
        try {
          console.log('[SRSExcelProcessor] Updating cell', update.cell, 'with', update.value, `(${update.desc})`);
          const cell = worksheet.getCell(update.cell);
          const oldValue = cell.value;
          
          // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Устанавливаем значение и правильный формат времени ***
          cell.value = update.value;
          // Different formats for different cell types
          if (update.desc === 'Lunch time') {
            cell.numFmt = 'h:mm'; // Lunch time format (duration)
          } else {
            cell.numFmt = 'h:mm AM/PM'; // Shift time format (time of day)
          }
          
          cellsUpdated++;
          
          updateResults.push({ cell: update.cell, value: update.value, success: true });
          console.log('[SRSExcelProcessor] ✓ Successfully updated', update.cell, ':', oldValue, '->', update.value, 'with correct time format');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to update', update.cell, ':', error);
          updateResults.push({ cell: update.cell, value: update.value, success: false });
        }
      });

      // Комментарии для Contract 2, Type 2
      if (record.LunchNote) {
        console.log('[SRSExcelProcessor] Adding lunch note to P' + rowIndex);
        if (this.addCommentToCell(worksheet, `P${rowIndex}`, record.LunchNote)) {
          commentsAdded++;
        }
      }
      
      if (record.TotalHoursNote) {
        console.log('[SRSExcelProcessor] Adding total hours note to S' + rowIndex);
        if (this.addCommentToCell(worksheet, `S${rowIndex}`, record.TotalHoursNote)) {
          commentsAdded++;
        }
      }

      // TypeOfLeaveID специфичные ячейки для Contract 2, Type 2
      if (record.TypeOfLeaveID === 1) {
        console.log('[SRSExcelProcessor] Setting leave type 1 value in U' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`U${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 1 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 1 value:', error);
        }
      }
      
      if (record.TypeOfLeaveID === 2) {
        console.log('[SRSExcelProcessor] Setting leave type 2 value in T' + rowIndex, ':', record.LeaveTime);
        try {
          const cell = worksheet.getCell(`T${rowIndex}`);
          cell.value = record.LeaveTime;
          cell.numFmt = '0.00'; // Числовой формат для времени отпуска
          cellsUpdated++;
          console.log('[SRSExcelProcessor] ✓ Leave type 2 value set successfully');
        } catch (error) {
          console.error('[SRSExcelProcessor] ✗ Failed to set leave type 2 value:', error);
        }
      }
    }

    console.log('[SRSExcelProcessor] *** TYPE 2 PROCESSING COMPLETED ***');
    console.log('[SRSExcelProcessor] Type 2 results:', {
      cellsUpdated,
      commentsAdded,
      updateResults: updateResults.length,
      successfulUpdates: updateResults.filter(r => r.success).length,
      failedUpdates: updateResults.filter(r => !r.success).length
    });

    return { cellsUpdated, commentsAdded };
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Обрабатывает расширенные типы отпусков (TypeOfLeaveID 3-19) ***
   */
  private processExtendedLeaveType(
    worksheet: ExcelJS.Worksheet,
    record: ISRSExcelRecord,
    typeOfSRS: SRSType,
    rowIndex: number
  ): { cellsUpdated: number; commentsAdded: number } {
    console.log('[SRSExcelProcessor] *** PROCESSING EXTENDED LEAVE TYPE ***');
    console.log('[SRSExcelProcessor] Extended leave parameters:', {
      typeOfLeaveID: record.TypeOfLeaveID,
      typeOfSRS,
      rowIndex,
      leaveTime: record.LeaveTime,
      leaveNote: record.LeaveNote ? 'Yes' : 'No'
    });

    const columns: string[] = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? [...SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_3]
      : [...SRS_EXCEL_CONSTANTS.EXTENDED_LEAVE_COLUMNS_TYPE_2];

    console.log('[SRSExcelProcessor] Extended leave columns available:', columns);
    console.log('[SRSExcelProcessor] Column range:', `${columns[0]} - ${columns[columns.length - 1]}`);

    const columnIndex: number = record.TypeOfLeaveID - 3; // -3 because array starts from TypeOfLeaveID 3
    console.log('[SRSExcelProcessor] Calculated column index:', columnIndex, 'for TypeOfLeaveID', record.TypeOfLeaveID);
    
    const leaveColumn: string | undefined = columns[columnIndex];
    
    if (leaveColumn) {
      const cellAddress = `${leaveColumn}${rowIndex}`;
      console.log('[SRSExcelProcessor] Target cell for extended leave:', cellAddress);
      
      try {
        const cell = worksheet.getCell(cellAddress);
        const oldValue = cell.value;
        cell.value = record.LeaveTime;
        cell.numFmt = '0.00'; // Числовой формат для времени отпуска
        
        console.log('[SRSExcelProcessor] ✓ Successfully set extended leave value:', {
          cell: cellAddress,
          oldValue,
          newValue: record.LeaveTime,
          typeOfLeaveID: record.TypeOfLeaveID
        });
        
        let commentsAdded = 0;
        if (record.LeaveNote) {
          console.log('[SRSExcelProcessor] Adding leave note to extended leave cell', cellAddress);
          if (this.addCommentToCell(worksheet, cellAddress, record.LeaveNote)) {
            commentsAdded = 1;
            console.log('[SRSExcelProcessor] ✓ Successfully added leave note to', cellAddress);
          } else {
            console.warn('[SRSExcelProcessor] ✗ Failed to add leave note to', cellAddress);
          }
        }

        console.log('[SRSExcelProcessor] *** EXTENDED LEAVE TYPE PROCESSING COMPLETED ***');
        return { cellsUpdated: 1, commentsAdded };
        
      } catch (error) {
        console.error('[SRSExcelProcessor] ✗ Error setting extended leave value in', cellAddress, ':', error);
        return { cellsUpdated: 0, commentsAdded: 0 };
      }
    } else {
      console.error('[SRSExcelProcessor] ✗ Invalid column index for extended leave type:', {
        typeOfLeaveID: record.TypeOfLeaveID,
        calculatedIndex: columnIndex,
        availableColumns: columns.length,
        validRange: '3-19'
      });
      return { cellsUpdated: 0, commentsAdded: 0 };
    }
  }

  /**
   * Получает колонку для базовых типов отпусков (TypeOfLeaveID 1-2)
   */
  private getLeaveColumnForBasicTypes(typeOfSRS: SRSType, contract: number, typeOfLeaveID: number): string | null {
    console.log('[SRSExcelProcessor] Getting leave column for basic types:', {
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

    console.log('[SRSExcelProcessor] Determined leave column:', column || 'None');
    return column;
  }

  /**
   * Получает колонки для очистки (реплика из Office Script)
   */
  private getColumnsForClearing(typeOfSRS: SRSType): string[] {
    const columns = typeOfSRS === SRS_EXCEL_CONSTANTS.SRS_TYPE_3 
      ? [...SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_3]
      : [...SRS_EXCEL_CONSTANTS.CLEAR_COLUMNS_TYPE_2];

    console.log('[SRSExcelProcessor] Columns for clearing (typeOfSRS=' + typeOfSRS + '):', columns);
    return columns;
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Добавляет комментарий к ячейке ***
   */
  private addCommentToCell(worksheet: ExcelJS.Worksheet, cellAddress: string, commentText: string): boolean {
    console.log('[SRSExcelProcessor] *** ADDING COMMENT TO CELL ***');
    console.log('[SRSExcelProcessor] Comment parameters:', {
      cellAddress,
      commentLength: commentText.length,
      commentPreview: commentText.substring(0, 50) + (commentText.length > 50 ? '...' : '')
    });

    try {
      const cell = worksheet.getCell(cellAddress);
      
      // Очищаем существующий комментарий
      if (cell.note) {
        const oldComment = cell.note;
        console.log('[SRSExcelProcessor] Clearing existing comment from', cellAddress, ':', oldComment);
        delete (cell as { note?: string }).note;
      }

      // Добавляем новый комментарий
      (cell as { note: string }).note = commentText;
      
      console.log('[SRSExcelProcessor] ✓ Successfully added comment to', cellAddress);
      console.log('[SRSExcelProcessor] Comment content:', commentText);
      this.addLog(`Added comment to ${cellAddress}: ${commentText}`);
      return true;

    } catch (e) {
      const errorMsg: string = `Failed to add comment to ${cellAddress}: ${e instanceof Error ? e.message : String(e)}`;
      console.error('[SRSExcelProcessor] ✗', errorMsg);
      this.addLog(`Error: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Преобразует номер колонки в букву (A, B, C, etc.)
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
    
    console.log('[SRSExcelProcessor] *** PROCESSING FINALIZED ***');
    console.log('[SRSExcelProcessor] Final statistics:', this.stats);
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Обрабатывает ошибки ***
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
   * Добавляет запись в лог
   */
  private addLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    console.log(`[SRSExcelProcessor] ${message}`);
  }

  /**
   * Создает типизированную ошибку обработки
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
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Получает текущую статистику ***
   */
  public getStats(): ISRSExcelProcessingStats {
    console.log('[SRSExcelProcessor] Current statistics requested:', this.stats);
    return { ...this.stats };
  }

  /**
   * *** ДЕТАЛЬНЫЕ ЛОГИ: Получает логи обработки ***
   */
  public getLogs(): string[] {
    console.log('[SRSExcelProcessor] Processing logs requested:', {
      totalLogs: this.logs.length,
      logsPreview: this.logs.slice(-5) // Последние 5 записей
    });
    return [...this.logs];
  }
}