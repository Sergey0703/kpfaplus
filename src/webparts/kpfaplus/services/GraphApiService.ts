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

// Константа для базового пути к сайту для переиспользования
const SITE_PATH = 'kpfaie.sharepoint.com:/sites/KPFADataBackUp';

/**
 * Универсальный сервис для работы с Microsoft Graph API
 * Предоставляет методы для работы с файлами в SharePoint
 * 
 * ИСПРАВЛЕНО: Правильное построение путей для SharePoint sites
 */
export class GraphApiService {
  private static instance: GraphApiService;
  private graphClient: MSGraphClientV3 | undefined;
  private context: WebPartContext;
  
  // *** ИСПРАВЛЕНО: Возвращаем кэширование Site ID для производительности ***
  private cachedSiteId: string = '';

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
   * *** НОВЫЙ МЕТОД (возвращен и исправлен): Получает ID сайта по его пути ***
   * Это первый шаг в надежном двухэтапном подходе.
   */
  private async getSiteIdByPath(): Promise<string> {
    if (this.cachedSiteId) {
      return this.cachedSiteId;
    }

    const graphClient = await this.initializeGraphClient();
    const siteLookupPath = `/sites/${SITE_PATH}`;
    
    console.log('[GraphApiService] Robust Step 1: Getting Site ID from path:', siteLookupPath);
    
    try {
      const siteResponse = await graphClient.api(siteLookupPath).get();
      if (!siteResponse || !siteResponse.id) {
        throw new Error("Site ID not found in response for path.");
      }
      this.cachedSiteId = siteResponse.id;
      console.log('[GraphApiService] Robust Step 1 SUCCESS: Found Site ID:', this.cachedSiteId);
      return this.cachedSiteId;
    } catch (error) {
      console.error('[GraphApiService] Robust Step 1 FAILED: Could not get Site ID.', error);
      throw this.handleGraphApiError(error);
    }
  }

  /**
   * *** НОВЫЙ МЕТОД: Получает DriveItem по пути к файлу ***
   */
  private async getDriveItemByPath(filePath: string): Promise<any> {
    const siteId = await this.getSiteIdByPath();
    const graphClient = await this.initializeGraphClient();
    const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    // *** ИСПРАВЛЕНО: Этот URL использует полученный ID сайта и является надежным ***
    const metadataGraphPath = `/sites/${siteId}/drive/root:/${cleanPath}`;

    console.log('[GraphApiService] Robust Step 2: Getting DriveItem metadata from:', metadataGraphPath);
    
    try {
        const driveItem = await graphClient.api(metadataGraphPath).get();
        if (!driveItem || !driveItem.id) {
            throw new Error("DriveItem ID not found in metadata response.");
        }
        console.log('[GraphApiService] Robust Step 2 SUCCESS: Found DriveItem with ID:', driveItem.id);
        return driveItem;
    } catch (error) {
        console.error('[GraphApiService] Robust Step 2 FAILED: Could not get DriveItem metadata.', error);
        throw this.handleGraphApiError(error);
    }
  }

  /**
   * Скачивает файл Excel из SharePoint
   * @param filePath - путь к файлу в формате "Shared Documents/path/to/file.xlsx"
   * @returns ArrayBuffer с содержимым файла
   */
  public async downloadExcelFile(filePath: string): Promise<ArrayBuffer> {
    console.log('[GraphApiService] *** DOWNLOADING EXCEL FILE (Robust 2-step approach) ***');
    
    try {
        const driveItem = await this.getDriveItemByPath(filePath);
        const siteId = this.cachedSiteId; // getDriveItemByPath уже закэшировал его
        const driveItemId = driveItem.id;

        const graphClient = await this.initializeGraphClient();
        // *** ИСПРАВЛЕНО: Финальный надежный URL для скачивания контента ***
        const contentGraphPath = `/sites/${siteId}/drive/items/${driveItemId}/content`;

        console.log('[GraphApiService] Robust Step 3: Downloading content from:', contentGraphPath);

        const response = await graphClient.api(contentGraphPath).get();

        if (!response) {
            throw new Error('Empty response from Graph API on content download.');
        }

        console.log('[GraphApiService] Robust Step 3 SUCCESS: File content downloaded successfully.');
        return response as ArrayBuffer;

    } catch (error) {
        console.error('[GraphApiService] Error during robust download process:', error);
        if (!(error instanceof GraphApiServiceError)) {
            throw this.handleGraphApiError(error);
        }
        throw error;
    }
  }

  /**
   * Загружает файл Excel обратно в SharePoint
   */
  public async uploadExcelFile(filePath: string, data: ArrayBuffer): Promise<boolean> {
    console.log('[GraphApiService] *** UPLOADING EXCEL FILE (Robust 2-step approach) ***');
    
    try {
        const driveItem = await this.getDriveItemByPath(filePath);
        const siteId = this.cachedSiteId;
        const driveItemId = driveItem.id;

        const graphClient = await this.initializeGraphClient();
        // *** ИСПРАВЛЕНО: Финальный надежный URL для загрузки контента ***
        const contentGraphPath = `/sites/${siteId}/drive/items/${driveItemId}/content`;

        console.log('[GraphApiService] Robust Step 3: Uploading content to:', contentGraphPath);

        const response = await graphClient.api(contentGraphPath).put(data);

        if (response && response.id) {
            console.log('[GraphApiService] Robust Step 3 SUCCESS: File uploaded successfully.');
            return true;
        }
        
        throw new Error("Upload response did not contain expected data.");

    } catch (error) {
        console.error('[GraphApiService] Error during robust upload process:', error);
        if (!(error instanceof GraphApiServiceError)) {
            throw this.handleGraphApiError(error);
        }
        throw error;
    }
  }

  /**
   * Проверяет доступность файла для редактирования
   */
  public async checkFileAvailability(filePath: string): Promise<IFileAvailabilityResult> {
    console.log('[GraphApiService] *** CHECKING FILE AVAILABILITY (Robust metadata check) ***');
    
    try {
      const driveItem = await this.getDriveItemByPath(filePath);
      
      const result: IFileAvailabilityResult = {
        available: true,
        lastModified: driveItem.lastModifiedDateTime ? new Date(driveItem.lastModifiedDateTime) : undefined,
        size: driveItem.size,
        lockedBy: driveItem.lastModifiedBy?.user?.displayName
      };

      console.log('[GraphApiService] File availability check result:', result);
      return result;

    } catch (error) {
      console.warn('[GraphApiService] File availability check failed:', error);
      
      const graphError = (error instanceof GraphApiServiceError) ? error : this.handleGraphApiError(error);
      
      return {
        available: false,
        errorDetails: graphError.message
      };
    }
  }

  /**
   * Обрабатывает ошибки Graph API и конвертирует их в типизированные ошибки
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
        case 400:
          code = 'badRequest';
          message = 'Bad Request. The URL or request body is malformed.';
          break;
        case 404:
          code = 'itemNotFound';
          message = 'File or resource not found.';
          break;
        case 403:
          code = 'accessDenied';
          message = 'Access denied to file.';
          break;
        case 423:
          code = 'locked';
          message = 'File is locked for editing.';
          break;
        case 409:
          code = 'conflict';
          message = 'File conflict occurred.';
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