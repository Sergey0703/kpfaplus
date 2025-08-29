// src/webparts/kpfaplus/services/ExcelService.ts

import * as ExcelJS from 'exceljs';

/**
 * Интерфейс для ошибок Excel операций
 */
export interface IExcelServiceError {
  code: string;
  message: string;
  operation?: string;
  cellAddress?: string;
  worksheetName?: string;
}

/**
 * Класс ошибок Excel сервиса
 */
export class ExcelServiceError extends Error {
  public readonly code: string;
  public readonly operation?: string;
  public readonly cellAddress?: string;
  public readonly worksheetName?: string;

  constructor(error: IExcelServiceError) {
    super(error.message);
    this.name = 'ExcelServiceError';
    this.code = error.code;
    this.operation = error.operation;
    this.cellAddress = error.cellAddress;
    this.worksheetName = error.worksheetName;
  }
}

/**
 * Результат поиска значения в диапазоне
 */
export interface IFindValueResult {
  found: boolean;
  row?: number;      // 0-based индекс строки
  column?: number;   // 0-based индекс колонки
  address?: string;  // Адрес ячейки (A1, B5, etc.)
  value?: any;       // Найденное значение
}

/**
 * Информация о листе Excel
 */
export interface IWorksheetInfo {
  name: string;
  id: number;
  rowCount: number;
  columnCount: number;
  exists: boolean;
}

/**
 * Универсальный сервис для работы с Excel файлами через ExcelJS
 * Предоставляет базовые операции для чтения/записи Excel файлов
 */
export class ExcelService {
  private static instance: ExcelService;
  
  private constructor() {
    console.log('[ExcelService] Instance created');
  }

  /**
   * Получает экземпляр сервиса (Singleton)
   */
  public static getInstance(): ExcelService {
    if (!ExcelService.instance) {
      ExcelService.instance = new ExcelService();
    }
    return ExcelService.instance;
  }

  /**
   * Загружает workbook из ArrayBuffer
   * @param buffer - содержимое Excel файла
   * @returns ExcelJS.Workbook
   */
  public async loadWorkbookFromBuffer(buffer: ArrayBuffer): Promise<ExcelJS.Workbook> {
    console.log('[ExcelService] *** LOADING WORKBOOK FROM BUFFER ***');
    console.log('[ExcelService] Buffer size:', buffer.byteLength, 'bytes');

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const worksheetCount = workbook.worksheets.length;
      const worksheetNames = workbook.worksheets.map(ws => ws.name);

      console.log('[ExcelService] Workbook loaded successfully:', {
        worksheetCount,
        worksheetNames,
        creator: workbook.creator || 'unknown'
      });

      return workbook;

    } catch (error) {
      console.error('[ExcelService] Error loading workbook:', error);
      throw this.createError(
        'LOAD_WORKBOOK_FAILED',
        `Failed to load Excel workbook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'loadWorkbookFromBuffer'
      );
    }
  }

  /**
   * Сохраняет workbook в ArrayBuffer
   * @param workbook - ExcelJS workbook для сохранения
   * @returns ArrayBuffer с содержимым файла
   */
  public async saveWorkbookToBuffer(workbook: ExcelJS.Workbook): Promise<ArrayBuffer> {
    console.log('[ExcelService] *** SAVING WORKBOOK TO BUFFER ***');
    
    try {
      const buffer = await workbook.xlsx.writeBuffer();
      
      console.log('[ExcelService] Workbook saved to buffer successfully:', {
        bufferSize: buffer.byteLength,
        worksheetCount: workbook.worksheets.length
      });

      return buffer;

    } catch (error) {
      console.error('[ExcelService] Error saving workbook:', error);
      throw this.createError(
        'SAVE_WORKBOOK_FAILED',
        `Failed to save Excel workbook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'saveWorkbookToBuffer'
      );
    }
  }

  /**
   * Получает информацию о листе или проверяет его существование
   * @param workbook - Excel workbook
   * @param worksheetName - имя листа
   * @returns информация о листе
   */
  public getWorksheetInfo(workbook: ExcelJS.Workbook, worksheetName: string): IWorksheetInfo {
    console.log('[ExcelService] Getting worksheet info:', worksheetName);

    const worksheet = workbook.getWorksheet(worksheetName);
    
    if (!worksheet) {
      console.warn('[ExcelService] Worksheet not found:', worksheetName);
      return {
        name: worksheetName,
        id: -1,
        rowCount: 0,
        columnCount: 0,
        exists: false
      };
    }

    const info: IWorksheetInfo = {
      name: worksheet.name,
      id: worksheet.id,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      exists: true
    };

    console.log('[ExcelService] Worksheet info:', info);
    return info;
  }

  /**
   * Получает лист Excel с проверкой существования
   * @param workbook - Excel workbook
   * @param worksheetName - имя листа
   * @returns ExcelJS.Worksheet
   */
  public getWorksheet(workbook: ExcelJS.Workbook, worksheetName: string): ExcelJS.Worksheet {
    console.log('[ExcelService] Getting worksheet:', worksheetName);

    const worksheet = workbook.getWorksheet(worksheetName);
    
    if (!worksheet) {
      const availableSheets = workbook.worksheets.map(ws => ws.name).join(', ');
      throw this.createError(
        'WORKSHEET_NOT_FOUND',
        `Worksheet "${worksheetName}" not found. Available sheets: ${availableSheets}`,
        'getWorksheet',
        undefined,
        worksheetName
      );
    }

    console.log('[ExcelService] Worksheet found:', {
      name: worksheet.name,
      id: worksheet.id,
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount
    });

    return worksheet;
  }

  /**
   * Ищет значение в указанном диапазоне ячеек
   * @param worksheet - лист Excel
   * @param range - диапазон поиска (например, "A1:A2000")
   * @param searchValue - искомое значение
   * @param exactMatch - точное совпадение (default: true)
   * @returns результат поиска
   */
  public findValueInRange(
    worksheet: ExcelJS.Worksheet, 
    range: string, 
    searchValue: string,
    exactMatch: boolean = true
  ): IFindValueResult {
    console.log('[ExcelService] *** SEARCHING VALUE IN RANGE ***');
    console.log('[ExcelService] Range:', range);
    console.log('[ExcelService] Search value:', searchValue);
    console.log('[ExcelService] Exact match:', exactMatch);

    try {
      const searchValueTrimmed = searchValue.trim();
      
      // Парсим диапазон
      const rangeParts = range.split(':');
      if (rangeParts.length !== 2) {
        throw new Error(`Invalid range format: ${range}. Expected format: A1:B10`);
      }
      
      const startCell = worksheet.getCell(rangeParts[0]);
      const endCell = worksheet.getCell(rangeParts[1]);
      
      // Получаем координаты с проверкой типов
      const startRow = typeof startCell.row === 'number' ? startCell.row : 1;
      const startCol = typeof startCell.col === 'number' ? startCell.col : 1;
      const endRow = typeof endCell.row === 'number' ? endCell.row : startRow;
      const endCol = typeof endCell.col === 'number' ? endCell.col : startCol;

      console.log('[ExcelService] Search parameters:', {
        startRow,
        endRow,
        startCol,
        endCol,
        totalCells: (endRow - startRow + 1) * (endCol - startCol + 1)
      });

      // Проходим по всем ячейкам в диапазоне
      for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
          const cell = worksheet.getCell(row, col);
          const cellValue = cell.value?.toString().trim() || '';
          
          // Проверяем совпадение
          const isMatch = exactMatch 
            ? cellValue === searchValueTrimmed
            : cellValue.includes(searchValueTrimmed);
          
          if (isMatch && cellValue !== '') {
            const result: IFindValueResult = {
              found: true,
              row: row - 1, // Возвращаем 0-based индекс
              column: col - 1, // Возвращаем 0-based индекс
              address: cell.address,
              value: cell.value
            };
            
            console.log('[ExcelService] Value found:', result);
            return result;
          }
        }
      }

      console.log('[ExcelService] Value not found in range');
      return { found: false };

    } catch (error) {
      console.error('[ExcelService] Error searching value:', error);
      throw this.createError(
        'SEARCH_VALUE_FAILED',
        `Failed to search value in range ${range}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'findValueInRange'
      );
    }
  }

  /**
   * Устанавливает значение в ячейку
   * @param worksheet - лист Excel
   * @param address - адрес ячейки (например, "A1")
   * @param value - значение для установки
   */
  public setCellValue(worksheet: ExcelJS.Worksheet, address: string, value: any): void {
    try {
      const cell = worksheet.getCell(address);
      cell.value = value;
      
      console.log('[ExcelService] Cell value set:', {
        address,
        value,
        type: typeof value
      });

    } catch (error) {
      console.error('[ExcelService] Error setting cell value:', error);
      throw this.createError(
        'SET_CELL_VALUE_FAILED',
        `Failed to set value in cell ${address}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'setCellValue',
        address
      );
    }
  }

  /**
   * Очищает значения в указанных ячейках
   * @param worksheet - лист Excel
   * @param addresses - массив адресов ячеек для очистки
   */
  public clearCells(worksheet: ExcelJS.Worksheet, addresses: string[]): void {
    console.log('[ExcelService] *** CLEARING CELLS ***');
    console.log('[ExcelService] Addresses to clear:', addresses.length);

    try {
      let clearedCount = 0;
      
      addresses.forEach(address => {
        try {
          const cell = worksheet.getCell(address);
          cell.value = null;
          clearedCount++;
        } catch (cellError) {
          console.warn(`[ExcelService] Failed to clear cell ${address}:`, cellError);
        }
      });

      console.log('[ExcelService] Cells cleared:', {
        requested: addresses.length,
        cleared: clearedCount,
        failed: addresses.length - clearedCount
      });

    } catch (error) {
      console.error('[ExcelService] Error clearing cells:', error);
      throw this.createError(
        'CLEAR_CELLS_FAILED',
        `Failed to clear cells: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'clearCells'
      );
    }
  }

  /**
   * Добавляет комментарий к ячейке
   * @param worksheet - лист Excel
   * @param address - адрес ячейки
   * @param commentText - текст комментария
   */
  public addCellComment(worksheet: ExcelJS.Worksheet, address: string, commentText: string): boolean {
    console.log('[ExcelService] Adding comment to cell:', { address, commentText });

    try {
      const cell = worksheet.getCell(address);
      
      // ExcelJS поддерживает комментарии через note
      cell.note = commentText;
      
      console.log('[ExcelService] Comment added successfully to cell:', address);
      return true;

    } catch (error) {
      console.warn('[ExcelService] Failed to add comment:', error);
      return false;
    }
  }

  /**
   * Удаляет все комментарии в указанном диапазоне строк
   * @param worksheet - лист Excel
   * @param startRow - начальная строка (1-based)
   * @param endRow - конечная строка (1-based)
   */
  public deleteCommentsInRowRange(worksheet: ExcelJS.Worksheet, startRow: number, endRow: number): void {
    console.log('[ExcelService] *** DELETING COMMENTS IN ROW RANGE ***');
    console.log('[ExcelService] Row range:', { startRow, endRow });

    try {
      let deletedCount = 0;

      // Проходим по всем строкам в диапазоне
      for (let row = startRow; row <= endRow; row++) {
        // Получаем все ячейки в строке (проходим по разумному диапазону колонок)
        for (let col = 1; col <= 200; col++) { // A до колонки GR (200 колонок)
          try {
            const cell = worksheet.getCell(row, col);
            if (cell.note) {
              (cell as any).note = null; // Исправлено: обходим типизацию ExcelJS
              deletedCount++;
            }
          } catch (cellError) {
            // Игнорируем ошибки отдельных ячеек
          }
        }
      }

      console.log('[ExcelService] Comments deleted:', {
        rowRange: `${startRow}-${endRow}`,
        deletedCount
      });

    } catch (error) {
      console.warn('[ExcelService] Error deleting comments:', error);
      // Не бросаем ошибку, так как это не критично
    }
  }

  /**
   * Создает типизированную ошибку Excel сервиса
   */
  private createError(
    code: string, 
    message: string, 
    operation?: string, 
    cellAddress?: string, 
    worksheetName?: string
  ): ExcelServiceError {
    return new ExcelServiceError({
      code,
      message,
      operation,
      cellAddress,
      worksheetName
    });
  }

  /**
   * Статические методы для проверки типов ошибок
   */
  public static isWorksheetNotFound(error: any): boolean {
    return error instanceof ExcelServiceError && error.code === 'WORKSHEET_NOT_FOUND';
  }

  public static isLoadWorkbookFailed(error: any): boolean {
    return error instanceof ExcelServiceError && error.code === 'LOAD_WORKBOOK_FAILED';
  }

  public static isSaveWorkbookFailed(error: any): boolean {
    return error instanceof ExcelServiceError && error.code === 'SAVE_WORKBOOK_FAILED';
  }
}