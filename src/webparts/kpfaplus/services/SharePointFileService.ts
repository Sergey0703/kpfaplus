// src/webparts/kpfaplus/services/SharePointFileService.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
import * as ExcelJS from 'exceljs';
import { GraphApiService, GraphApiServiceError, IFileAvailabilityResult } from './GraphApiService';
import { ExcelService, ExcelServiceError } from './ExcelService';

/**
 * Результат операции с Excel файлом в SharePoint
 */
export interface ISharePointExcelOperationResult {
  success: boolean;
  message?: string;
  error?: string;
  processingTime?: number;
  fileSize?: number;
  worksheetName?: string;
}

/**
 * Параметры для работы с Excel файлом в SharePoint
 */
export interface ISharePointExcelFileParams {
  filePath: string;         // Путь к файлу в SharePoint
  worksheetName: string;    // Имя листа для работы
  checkAvailability?: boolean; // Проверить доступность перед операцией
}

/**
 * Результат загрузки Excel файла из SharePoint
 */
export interface ILoadExcelResult extends ISharePointExcelOperationResult {
  workbook?: ExcelJS.Workbook;
  worksheet?: ExcelJS.Worksheet;
}

/**
 * Композиционный сервис для работы с Excel файлами в SharePoint
 * Объединяет GraphApiService и ExcelService для удобного использования
 */
export class SharePointFileService {
  private static instance: SharePointFileService;
  private graphApiService: GraphApiService;
  private excelService: ExcelService;

  private constructor(context: WebPartContext) {
    // Инициализируем сервисы - context используется через них
    this.graphApiService = GraphApiService.getInstance(context);
    this.excelService = ExcelService.getInstance();
    console.log('[SharePointFileService] Instance created');
  }

  /**
   * Получает экземпляр сервиса (Singleton)
   */
  public static getInstance(context: WebPartContext): SharePointFileService {
    if (!SharePointFileService.instance) {
      SharePointFileService.instance = new SharePointFileService(context);
    }
    return SharePointFileService.instance;
  }

  /**
   * Загружает Excel файл из SharePoint и подготавливает workbook
   * @param params - параметры для загрузки файла
   * @returns результат с workbook и worksheet
   */
  public async loadExcelFile(params: ISharePointExcelFileParams): Promise<ILoadExcelResult> {
    console.log('[SharePointFileService] *** LOADING EXCEL FILE FROM SHAREPOINT ***');
    console.log('[SharePointFileService] File path:', params.filePath);
    console.log('[SharePointFileService] Worksheet name:', params.worksheetName);
    console.log('[SharePointFileService] Check availability:', params.checkAvailability !== false);

    const startTime = Date.now();

    try {
      // 1. Опциональная проверка доступности файла
      if (params.checkAvailability !== false) {
        console.log('[SharePointFileService] Checking file availability...');
        
        const availability = await this.graphApiService.checkFileAvailability(params.filePath);
        
        if (!availability.available) {
          return {
            success: false,
            error: `File not available: ${availability.errorDetails || 'Unknown reason'}`,
            processingTime: Date.now() - startTime
          };
        }

        console.log('[SharePointFileService] File is available:', {
          size: availability.size,
          lastModified: availability.lastModified?.toISOString(),
          lockedBy: availability.lockedBy
        });
      }

      // 2. Скачиваем файл из SharePoint
      console.log('[SharePointFileService] Downloading file from SharePoint...');
      const fileBuffer = await this.graphApiService.downloadExcelFile(params.filePath);

      // 3. Загружаем workbook через ExcelJS
      console.log('[SharePointFileService] Loading workbook with ExcelJS...');
      const workbook = await this.excelService.loadWorkbookFromBuffer(fileBuffer);

      // 4. Получаем нужный лист
      console.log('[SharePointFileService] Getting worksheet...');
      const worksheet = this.excelService.getWorksheet(workbook, params.worksheetName);

      const processingTime = Date.now() - startTime;

      const result: ILoadExcelResult = {
        success: true,
        workbook,
        worksheet,
        processingTime,
        fileSize: fileBuffer.byteLength,
        worksheetName: worksheet.name,
        message: `Excel file loaded successfully from SharePoint`
      };

      console.log('[SharePointFileService] *** EXCEL FILE LOADED SUCCESSFULLY ***', {
        processingTime,
        fileSize: fileBuffer.byteLength,
        worksheetName: worksheet.name,
        worksheetRows: worksheet.rowCount,
        worksheetCols: worksheet.columnCount
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = this.formatError(error);

      console.error('[SharePointFileService] Error loading Excel file:', error);

      return {
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  /**
   * Сохраняет workbook обратно в SharePoint
   * @param workbook - workbook для сохранения
   * @param filePath - путь к файлу в SharePoint
   * @returns результат операции
   */
  public async saveExcelFile(
    workbook: ExcelJS.Workbook, 
    filePath: string
  ): Promise<ISharePointExcelOperationResult> {
    console.log('[SharePointFileService] *** SAVING EXCEL FILE TO SHAREPOINT ***');
    console.log('[SharePointFileService] File path:', filePath);

    const startTime = Date.now();

    try {
      // 1. Конвертируем workbook в buffer
      console.log('[SharePointFileService] Converting workbook to buffer...');
      const buffer = await this.excelService.saveWorkbookToBuffer(workbook);

      // 2. Загружаем файл в SharePoint
      console.log('[SharePointFileService] Uploading file to SharePoint...');
      const uploadSuccess = await this.graphApiService.uploadExcelFile(filePath, buffer);

      const processingTime = Date.now() - startTime;

      if (uploadSuccess) {
        const result: ISharePointExcelOperationResult = {
          success: true,
          message: 'Excel file saved successfully to SharePoint',
          processingTime,
          fileSize: buffer.byteLength
        };

        console.log('[SharePointFileService] *** EXCEL FILE SAVED SUCCESSFULLY ***', {
          processingTime,
          fileSize: buffer.byteLength
        });

        return result;
      } else {
        return {
          success: false,
          error: 'Failed to upload file to SharePoint (unknown reason)',
          processingTime,
          fileSize: buffer.byteLength
        };
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = this.formatError(error);

      console.error('[SharePointFileService] Error saving Excel file:', error);

      return {
        success: false,
        error: errorMessage,
        processingTime
      };
    }
  }

  /**
   * Выполняет операцию с Excel файлом (загрузка -> модификация -> сохранение)
   * @param params - параметры файла
   * @param processor - функция для обработки workbook
   * @returns результат операции
   */
  public async processExcelFile(
    params: ISharePointExcelFileParams,
    processor: (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet) => Promise<void> | void
  ): Promise<ISharePointExcelOperationResult> {
    console.log('[SharePointFileService] *** PROCESSING EXCEL FILE ***');
    console.log('[SharePointFileService] File path:', params.filePath);
    console.log('[SharePointFileService] Worksheet:', params.worksheetName);

    const startTime = Date.now();

    try {
      // 1. Загружаем файл
      const loadResult = await this.loadExcelFile(params);
      
      if (!loadResult.success || !loadResult.workbook || !loadResult.worksheet) {
        return {
          success: false,
          error: `Failed to load file: ${loadResult.error}`,
          processingTime: Date.now() - startTime
        };
      }

      // 2. Обрабатываем файл
      console.log('[SharePointFileService] Processing workbook with provided function...');
      await processor(loadResult.workbook, loadResult.worksheet);

      // 3. Сохраняем файл
      console.log('[SharePointFileService] Saving processed workbook...');
      const saveResult = await this.saveExcelFile(loadResult.workbook, params.filePath);

      const totalProcessingTime = Date.now() - startTime;

      if (saveResult.success) {
        return {
          success: true,
          message: 'Excel file processed and saved successfully',
          processingTime: totalProcessingTime,
          fileSize: saveResult.fileSize,
          worksheetName: loadResult.worksheet.name
        };
      } else {
        return {
          success: false,
          error: `Processing completed but save failed: ${saveResult.error}`,
          processingTime: totalProcessingTime
        };
      }

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = this.formatError(error);

      console.error('[SharePointFileService] Error processing Excel file:', error);

      return {
        success: false,
        error: `Processing failed: ${errorMessage}`,
        processingTime
      };
    }
  }

  /**
   * Проверяет доступность Excel файла в SharePoint
   * @param filePath - путь к файлу
   * @returns информация о доступности
   */
  public async checkExcelFileAvailability(filePath: string): Promise<IFileAvailabilityResult> {
    console.log('[SharePointFileService] Checking Excel file availability:', filePath);
    return await this.graphApiService.checkFileAvailability(filePath);
  }

  /**
   * Форматирует ошибки разных типов в понятное сообщение
   * @param error - ошибка для форматирования
   * @returns отформатированное сообщение об ошибке
   */
  private formatError(error: unknown): string {
    if (error instanceof GraphApiServiceError) {
      if (error.isFileLocked) {
        return `File is currently locked for editing. Please close the file in Excel and try again.`;
      } else if (error.isNotFound) {
        return `Excel file not found in SharePoint. Please check the file path.`;
      } else if (error.isAccessDenied) {
        return `Access denied to Excel file. Please check your permissions.`;
      } else {
        return `SharePoint error: ${error.message}`;
      }
    } else if (error instanceof ExcelServiceError) {
      return `Excel processing error: ${error.message}`;
    } else if (error instanceof Error) {
      return error.message;
    } else {
      return 'Unknown error occurred while processing Excel file';
    }
  }

  /**
   * Статические методы для проверки типов ошибок
   */
  public static isFileLocked(error: unknown): boolean {
    return GraphApiService.isFileLocked(error);
  }

  public static isFileNotFound(error: unknown): boolean {
    return GraphApiService.isFileNotFound(error);
  }

  public static isAccessDenied(error: unknown): boolean {
    return GraphApiService.isAccessDenied(error);
  }

  public static isExcelProcessingError(error: unknown): boolean {
    return error instanceof ExcelServiceError;
  }
}