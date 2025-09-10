// src/webparts/kpfaplus/services/GraphApiService.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MSGraphClientV3 } from '@microsoft/sp-http';

export interface IGraphApiError {
  code: string;
  message: string;
  details?: string;
  statusCode?: number;
}

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
    
    this.isFileLocked = error.code === 'locked' || error.statusCode === 423;
    this.isNotFound = error.code === 'itemNotFound' || error.statusCode === 404;
    this.isAccessDenied = error.code === 'accessDenied' || error.statusCode === 403;
    this.isConflict = error.code === 'conflict' || error.statusCode === 409;
  }
}

export interface IFileAvailabilityResult {
  available: boolean;
  lockedBy?: string;
  lastModified?: Date;
  size?: number;
  errorDetails?: string;
}

// *** ADDED: Interface for Drive Item response ***
interface IDriveItem {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  lastModifiedBy?: {
    user?: {
      displayName: string;
    };
  };
}

// *** ADDED: Interface for Site response ***
interface ISiteResponse {
  id: string;
  displayName: string;
}

// *** ADDED: Interface for Upload Session response ***
interface IUploadSession {
  uploadUrl: string;
  expirationDateTime: string;
}

// *** ADDED: Interface for HTTP error response ***
interface IHttpErrorResponse {
  response: {
    status: number;
    data?: unknown;
  };
}

// *** ADDED: Interface for Graph API error response ***
interface IGraphApiErrorResponse {
  code?: string;
  message?: string;
  details?: string;
  statusCode?: number;
}

const SITE_PATH = 'kpfaie.sharepoint.com:/sites/StaffRecordSheets';

export class GraphApiService {
  private static instance: GraphApiService;
  private graphClient: MSGraphClientV3 | undefined;
  private context: WebPartContext;
  
  private cachedSiteId: string = '';

  private constructor(context: WebPartContext) {
    this.context = context;
  }

  public static getInstance(context: WebPartContext): GraphApiService {
    if (!GraphApiService.instance) {
      GraphApiService.instance = new GraphApiService(context);
    }
    return GraphApiService.instance;
  }

  private async initializeGraphClient(): Promise<MSGraphClientV3> {
    if (!this.graphClient) {
      this.graphClient = await this.context.msGraphClientFactory.getClient('3');
    }
    return this.graphClient;
  }
  
  private async getSiteIdByPath(): Promise<string> {
    if (this.cachedSiteId) {
      return this.cachedSiteId;
    }
    const graphClient = await this.initializeGraphClient();
    const siteLookupPath = `/sites/${SITE_PATH}`;
    
    try {
      const siteResponse = await graphClient.api(siteLookupPath).get() as ISiteResponse;
      this.cachedSiteId = siteResponse.id;
      return this.cachedSiteId;
    } catch (error) {
      throw this.handleGraphApiError(error);
    }
  }

  private async getDriveItemByPath(filePath: string): Promise<IDriveItem> {
    const siteId = await this.getSiteIdByPath();
    const graphClient = await this.initializeGraphClient();
    
    let relativePath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
    
    const docLibPrefix = "Shared Documents/";
    if (relativePath.toLowerCase().startsWith(docLibPrefix.toLowerCase())) {
        relativePath = relativePath.substring(docLibPrefix.length);
    }
    
    const metadataGraphPath = `/sites/${siteId}/drive/root:/${relativePath}`;

    try {
        const driveItem = await graphClient.api(metadataGraphPath).get() as IDriveItem;
        return driveItem;
    } catch (error) {
        throw this.handleGraphApiError(error);
    }
  }

  public async downloadExcelFile(filePath: string): Promise<ArrayBuffer> {
    try {
        const driveItem = await this.getDriveItemByPath(filePath);
        const siteId = this.cachedSiteId;
        const driveItemId = driveItem.id;

        const graphClient = await this.initializeGraphClient();
        const contentGraphPath = `/sites/${siteId}/drive/items/${driveItemId}/content`;

        // *** FIXED: Using getStream() for binary data download ***
        const response = await graphClient
            .api(contentGraphPath)
            .getStream();

        // Convert ReadableStream to ArrayBuffer
        const reader = response.getReader();
        const chunks: Uint8Array[] = [];
        
        try {
            let done = false;
            while (!done) {
                const result = await reader.read();
                done = result.done;
                if (!done && result.value) {
                    chunks.push(result.value);
                }
            }
        } finally {
            reader.releaseLock();
        }
        
        // Combine all chunks into a single ArrayBuffer
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        return result.buffer;
    } catch (error) {
        if (!(error instanceof GraphApiServiceError)) {
            throw this.handleGraphApiError(error);
        }
        throw error;
    }
  }

  public async uploadExcelFile(filePath: string, data: ArrayBuffer): Promise<boolean> {
    try {
        const driveItem = await this.getDriveItemByPath(filePath);
        const siteId = this.cachedSiteId;
        const driveItemId = driveItem.id;

        const graphClient = await this.initializeGraphClient();
        const createSessionUrl = `/sites/${siteId}/drive/items/${driveItemId}/createUploadSession`;

        const session = await graphClient.api(createSessionUrl).post({
          item: { "@microsoft.graph.conflictBehavior": "replace" }
        }) as IUploadSession;
        
        if (!session || !session.uploadUrl) {
          throw new Error("Failed to create upload session.");
        }

        const response = await fetch(session.uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Length': data.byteLength.toString(),
            'Content-Range': `bytes 0-${data.byteLength - 1}/${data.byteLength}`
          },
          body: data
        });

        if (response.ok) {
          return true;
        } else {
          const errorText = await response.text();
          throw new Error(`Upload session failed with status ${response.status}: ${errorText}`);
        }

    } catch (error) {
        if (!(error instanceof GraphApiServiceError)) {
            throw this.handleGraphApiError(error);
        }
        throw error;
    }
  }
  
  public async checkFileAvailability(filePath: string): Promise<IFileAvailabilityResult> {
    try {
      const driveItem = await this.getDriveItemByPath(filePath);
      return {
        available: true,
        lastModified: driveItem.lastModifiedDateTime ? new Date(driveItem.lastModifiedDateTime) : undefined,
        size: driveItem.size,
        lockedBy: driveItem.lastModifiedBy?.user?.displayName
      };
    } catch (error) {
      const graphError = (error instanceof GraphApiServiceError) ? error : this.handleGraphApiError(error);
      return { available: false, errorDetails: graphError.message };
    }
  }

  private handleGraphApiError(error: unknown): GraphApiServiceError {
    let graphError: IGraphApiError;
    if (this.isGraphApiErrorLike(error)) {
      graphError = { code: error.code || 'unknown', message: error.message || 'Unknown', statusCode: error.statusCode };
    } else if (this.isHttpErrorLike(error)) {
      const status = error.response.status;
      let code = 'httpError', message = `HTTP Error ${status}`;
      switch (status) {
        case 400: code = 'badRequest'; message = 'Bad Request.'; break;
        case 404: code = 'itemNotFound'; message = 'File not found.'; break;
        case 403: code = 'accessDenied'; message = 'Access denied.'; break;
        case 423: code = 'locked'; message = 'File is locked.'; break;
        case 409: code = 'conflict'; message = 'File conflict.'; break;
      }
      graphError = { code, message, statusCode: status };
    } else {
      graphError = { code: 'unknown', message: error instanceof Error ? error.message : 'Unknown error.' };
    }
    return new GraphApiServiceError(graphError);
  }

  private isGraphApiErrorLike(error: unknown): error is IGraphApiErrorResponse {
    return typeof error === 'object' && error !== null && ('code' in error || 'message' in error);
  }

  private isHttpErrorLike(error: unknown): error is IHttpErrorResponse {
    return typeof error === 'object' && 
           error !== null && 
           'response' in error && 
           typeof (error as IHttpErrorResponse).response === 'object' && 
           (error as IHttpErrorResponse).response !== null && 
           'status' in (error as IHttpErrorResponse).response;
  }

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