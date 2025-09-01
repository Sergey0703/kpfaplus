// src/webparts/kpfaplus/services/GraphApiService.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';

/**
 * Интерфейс для ошибок Graph API
 */
export interface IGraphApiError {
  code: string;
  message: string;
  details?: string;
  statusCode?: number;
}

/**
 * Класс ошибок Graph API с дополнительной типизацией
 */
export class GraphApiServiceError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly isFileLocked: boolean;
  public readonly isNotFound: boolean;
  public readonly isAccessDenied: boolean;
  public readonly isConflict: boolean;

  constructor(error: IGraphApiError) {
    super(error.message);
    this.name = 'GraphApiServiceError';
    this.code = error.code;
    this.statusCode = error.statusCode;
    
    // Определяем типы ошибок для удобной проверки
    this.isFileLocked = error.code === 'locked' || error.statusCode === 423;
    this.isNotFound = error.code === 'itemNotFound' || error.statusCode === 404;
    this.isAccessDenied = error.code === 'accessDenied' || error.statusCode === 403;
    this.isConflict = error.code === 'conflict' || error.statusCode === 409;
  }
}

/**
 * Результат проверки доступности файла
 */
export interface IFileAvailabilityResult {
  available: boolean;
  lockedBy?: string;
  lastModified?: Date;
  size?: number;
  errorDetails?: string;
}

/**
 * Универсальный сервис для работы с Microsoft Graph API
 * Предоставляет методы для работы с файлами в SharePoint
 */
export class GraphApiService {
  private static instance: GraphApiService;
  private graphClient: MSGraphClientV3 | undefined;
  private context: WebPartContext;

  private constructor(context: WebPartContext) {
    this.context = context;
    console.log('[GraphApiService] Instance created');
  }

  /**
   * Получает экземпляр сервиса (Singleton)
   */
  public static getInstance(context: WebPartContext): GraphApiService {
    if (!GraphApiService.instance) {
      GraphApiService.instance = new GraphApiService(context);
    }
    return GraphApiService.instance;
  }

  /**
   * Инициализирует Graph Client при первом использовании
   */
  private async initializeGraphClient(): Promise<MSGraphClientV3> {
    if (!this.graphClient) {
      console.log('[GraphApiService] Initializing MS Graph Client...');
      this.graphClient = await this.context.msGraphClientFactory.getClient('3');
      console.log('[GraphApiService] MS Graph Client initialized successfully');
    }
    return this.graphClient;
  }

  /**
   * Скачивает файл Excel из SharePoint
   * @param filePath - путь к файлу в формате "/sites/sitename/path/to/file.xlsx"
   * @returns ArrayBuffer с содержимым файла
   */
  public async downloadExcelFile(filePath: string): Promise<ArrayBuffer> {
    console.log('[GraphApiService] *** DOWNLOADING EXCEL FILE ***');
    console.log('[GraphApiService] File path:', filePath);

    try {
      const graphClient = await this.initializeGraphClient();

      // Конвертируем путь SharePoint в Graph API URL
      const graphPath = this.convertSharePointPathToGraphPath(filePath);
      console.log('[GraphApiService] Graph API path:', graphPath);

      // Скачиваем содержимое файла
      const response = await graphClient
        .api(graphPath)
        .get();

      if (!response) {
        throw new Error('Empty response from Graph API');
      }

      console.log('[GraphApiService] File downloaded successfully:', {
        contentLength: response.byteLength || 'unknown',
        type: 'ArrayBuffer'
      });

      return response as ArrayBuffer;

    } catch (error) {
      console.error('[GraphApiService] Error downloading file:', error);
      throw this.handleGraphApiError(error);
    }
  }

  /**
   * Загружает файл Excel обратно в SharePoint
   * @param filePath - путь к файлу в SharePoint
   * @param data - данные файла в формате ArrayBuffer
   * @returns true если успешно
   */
  public async uploadExcelFile(filePath: string, data: ArrayBuffer): Promise<boolean> {
    console.log('[GraphApiService] *** UPLOADING EXCEL FILE ***');
    console.log('[GraphApiService] File path:', filePath);
    console.log('[GraphApiService] Data size:', data.byteLength, 'bytes');

    try {
      const graphClient = await this.initializeGraphClient();

      // Конвертируем путь SharePoint в Graph API URL для загрузки
      const graphPath = this.convertSharePointPathToGraphPath(filePath, true);
      console.log('[GraphApiService] Graph API upload path:', graphPath);

      // Загружаем файл
      const response = await graphClient
        .api(graphPath)
        .put(data);

      if (response && response.id) {
        console.log('[GraphApiService] File uploaded successfully:', {
          fileId: response.id,
          name: response.name,
          size: response.size
        });
        return true;
      } else {
        console.warn('[GraphApiService] Upload response missing expected fields:', response);
        return false;
      }

    } catch (error) {
      console.error('[GraphApiService] Error uploading file:', error);
      throw this.handleGraphApiError(error);
    }
  }

  /**
   * Проверяет доступность файла для редактирования
   * @param filePath - путь к файлу в SharePoint
   * @returns информация о доступности файла
   */
  public async checkFileAvailability(filePath: string): Promise<IFileAvailabilityResult> {
    console.log('[GraphApiService] *** CHECKING FILE AVAILABILITY ***');
    console.log('[GraphApiService] File path:', filePath);

    try {
      const graphClient = await this.initializeGraphClient();

      // Получаем метаданные файла
      const graphPath = this.convertSharePointPathToGraphPath(filePath);
      const metadataPath = graphPath.replace('/content', ''); // Убираем /content для метаданных

      const response = await graphClient
        .api(metadataPath)
        .get();

      const result: IFileAvailabilityResult = {
        available: true, // Если мы получили ответ, файл доступен
        lastModified: response.lastModifiedDateTime ? new Date(response.lastModifiedDateTime) : undefined,
        size: response.size,
        lockedBy: response.lastModifiedBy?.user?.displayName
      };

      console.log('[GraphApiService] File availability check result:', result);
      return result;

    } catch (error) {
      console.warn('[GraphApiService] File availability check failed:', error);
      
      const graphError = this.handleGraphApiError(error);
      
      return {
        available: false,
        errorDetails: graphError.message
      };
    }
  }

  /**
   * Конвертирует путь SharePoint в Graph API путь
   * @param sharePointPath - путь SharePoint (/sites/...)
   * @param forUpload - если true, добавляет :/content: для загрузки
   * @returns путь для Graph API
   */
 private convertSharePointPathToGraphPath(sharePointPath: string, forUpload: boolean = false): string {
    const cleanPath = sharePointPath.startsWith('/') ? sharePointPath.substring(1) : sharePointPath;
    
    if (forUpload) {
        return `/sites/kpfaie.sharepoint.com:/sites/KPFADataBackUp:/drive/root:/${cleanPath}:/content`;
    } else {
        return `/sites/kpfaie.sharepoint.com:/sites/KPFADataBackUp:/drive/root:/${cleanPath}:/content`;
    }
}

  /**
   * Обрабатывает ошибки Graph API и конвертирует их в типизированные ошибки
   * @param error - исходная ошибка
   * @returns типизированная ошибка GraphApiServiceError
   */
  private handleGraphApiError(error: unknown): GraphApiServiceError {
    console.error('[GraphApiService] Processing Graph API error:', error);

    let graphError: IGraphApiError;

    // Обрабатываем разные форматы ошибок
    if (this.isGraphApiErrorLike(error)) {
      // Стандартная ошибка Graph API
      graphError = {
        code: error.code || 'unknown',
        message: error.message || 'Unknown Graph API error',
        details: error.details || String(error),
        statusCode: error.statusCode
      };
    } else if (this.isHttpErrorLike(error)) {
      // HTTP ошибка
      const status = error.response.status;
      let code = 'httpError';
      let message = `HTTP Error ${status}`;

      switch (status) {
        case 404:
          code = 'itemNotFound';
          message = 'File not found';
          break;
        case 403:
          code = 'accessDenied';
          message = 'Access denied to file';
          break;
        case 423:
          code = 'locked';
          message = 'File is locked for editing';
          break;
        case 409:
          code = 'conflict';
          message = 'File conflict occurred';
          break;
      }

      graphError = {
        code,
        message,
        statusCode: status,
        details: error.response?.data ? String(error.response.data) : String(error)
      };
    } else {
      // Неизвестная ошибка
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const errorDetails = error instanceof Error ? error.toString() : String(error);
      
      graphError = {
        code: 'unknown',
        message: errorMessage,
        details: errorDetails
      };
    }

    console.log('[GraphApiService] Processed error:', {
      code: graphError.code,
      message: graphError.message,
      statusCode: graphError.statusCode,
      isFileLocked: graphError.code === 'locked' || graphError.statusCode === 423,
      isNotFound: graphError.code === 'itemNotFound' || graphError.statusCode === 404,
      isAccessDenied: graphError.code === 'accessDenied' || graphError.statusCode === 403
    });

    return new GraphApiServiceError(graphError);
  }

  /**
   * Type guards для проверки типов ошибок
   */
  private isGraphApiErrorLike(error: unknown): error is { 
    code?: string; 
    message?: string; 
    details?: string; 
    statusCode?: number;
  } {
    return typeof error === 'object' && error !== null && 
           ('code' in error || 'message' in error);
  }

  private isHttpErrorLike(error: unknown): error is { 
    response: { 
      status: number; 
      data?: unknown; 
    };
  } {
    return typeof error === 'object' && error !== null && 
           'response' in error && 
           typeof (error as { response: unknown }).response === 'object' &&
           (error as { response: unknown }).response !== null &&
           'status' in (error as { response: { status: unknown } }).response;
  }

  /**
   * Статический метод для проверки типа ошибки (удобство использования)
   */
  public static isFileLocked(error: unknown): boolean {
    return error instanceof GraphApiServiceError && error.isFileLocked;
  }

  public static isFileNotFound(error: unknown): boolean {
    return error instanceof GraphApiServiceError && error.isNotFound;
  }

  public static isAccessDenied(error: unknown): boolean {
    return error instanceof GraphApiServiceError && error.isAccessDenied;
  }
}