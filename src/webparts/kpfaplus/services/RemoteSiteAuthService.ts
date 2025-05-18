// src/webparts/kpfaplus/services/RemoteSiteAuthService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { IRemoteSiteInfo } from './RemoteSiteInterfaces';
import { DataTypeAdapter } from '../utils/DataTypeAdapter';

/**
 * Сервис для авторизации и инициализации соединения с удаленным сайтом
 */
export class RemoteSiteAuthService {
  private _context: WebPartContext;
  private _logSource: string;
  
  // URL удаленного сайта
  private _remoteSiteUrl: string;
  
  // ID сайта для Graph API (заполняется при инициализации)
  private _targetSiteId: string | undefined = undefined;
  
  // Флаг авторизации
  private _isAuthorized: boolean = false;

  /**
   * Конструктор сервиса авторизации
   * @param context Контекст веб-части
   * @param logSource Источник для логов
   * @param remoteSiteUrl URL удаленного сайта
   */
  constructor(context: WebPartContext, logSource: string, remoteSiteUrl: string) {
    this._context = context;
    this._logSource = logSource;
    this._remoteSiteUrl = remoteSiteUrl;
  }

  /**
   * Инициализирует авторизацию через Graph API и получает ID сайта
   */
  public async initGraphAuthorization(): Promise<void> {
    try {
      this.logInfo("Initializing Graph client and authorizing access to remote site...");
      
      // Получаем Graph клиент, который автоматически включает токен авторизации
      const graphClient: MSGraphClientV3 = await this._context.msGraphClientFactory.getClient('3');
      
      // Проверка базовых разрешений - пробуем получить свой профиль
      try {
        const myProfile = await graphClient.api('/me').select('displayName,userPrincipalName,mail').get();
        this.logInfo(`Successfully authenticated as: ${myProfile.displayName} (${myProfile.userPrincipalName || myProfile.mail})`);
      } catch (profileError) {
        this.logError(`Failed to get user profile: ${(profileError as Error).message || String(profileError)}`);
        this.logInfo("Continuing with site authorization despite profile error...");
      }
      
      this.logInfo("Successfully obtained Graph client with authorization token");
      
      // Извлекаем домен и относительный путь из URL
      const url = new URL(this._remoteSiteUrl);
      const hostname = url.hostname;
      const pathname = url.pathname;
      
      // Проверяем доступ к удаленному сайту, используя авторизационный токен
      this.logInfo(`Verifying authorized access to remote site at ${hostname}${pathname}`);
      
      try {
        // Запрашиваем ID сайта по хостнейму и пути
        const response = await graphClient
          .api(`/sites/${hostname}:${pathname}`)
          .get();
        
        this._targetSiteId = response.id;
        this._isAuthorized = true;
        
        this.logInfo(`Authorization successful. Site ID: ${this._targetSiteId}`);
      } catch (authError) {
        this._isAuthorized = false;
        
        // Детальное логирование ошибки
        const error = authError as {
          message: string;
          statusCode: number;
          code: string;
          requestId: string;
        };
        
        this.logError(`Remote site authentication error: ${JSON.stringify({
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
          requestId: error.requestId
        }, null, 2)}`);
        
        if (error.statusCode === 401 || error.statusCode === 403) {
          this.logError("Authorization to remote site failed - insufficient permissions.");
          this.logError("Ensure that app permissions are approved in SharePoint Admin Center:");
          this.logError("1. Go to SharePoint Admin Center > Advanced > API access");
          this.logError("2. Approve pending requests for Microsoft Graph permissions");
        } else {
          this.logError(`Remote site authorization error: ${error.message}`);
        }
        
        throw new Error(`Failed to authorize access to remote site: ${error.message}`);
      }
    } catch (error) {
      this.logError(`Failed to initialize Graph authorization: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Убеждается, что авторизация на удаленный сайт выполнена
   * @returns Promise, который разрешается, если авторизация успешна
   */
  public async ensureAuthorization(): Promise<void> {
    if (!this._isAuthorized || !this._targetSiteId) {
      this.logInfo("Re-initializing Graph authorization...");
      await this.initGraphAuthorization();
      
      if (!this._isAuthorized || !this._targetSiteId) {
        throw new Error("Authorization to remote site failed. Check application permissions.");
      }
    }
  }

  /**
   * Получает экземпляр Graph клиента
   * @returns Promise с Graph клиентом
   */
  public async getGraphClient(): Promise<MSGraphClientV3> {
    await this.ensureAuthorization();
    return this._context.msGraphClientFactory.getClient('3');
  }

  /**
   * Проверяет авторизацию и соединение с удаленным сайтом
   * @returns Promise с информацией о веб-сайте
   */
  public async testConnection(): Promise<IRemoteSiteInfo> {
    try {
      // Убедимся, что у нас есть авторизация на удаленный сайт
      await this.ensureAuthorization();
      
      // Получаем информацию о сайте через Graph API с авторизационным токеном
      const graphClient: MSGraphClientV3 = await this._context.msGraphClientFactory.getClient('3');
      const siteData = await graphClient
        .api(`/sites/${this._targetSiteId}`)
        .get();
      
      this.logInfo(`Successfully connected to remote site: ${siteData.displayName}`);
      
      // Преобразуем данные из Graph API в наш интерфейс IRemoteSiteInfo
      const siteInfo: IRemoteSiteInfo = {
        id: DataTypeAdapter.toString(siteData.id),
        title: DataTypeAdapter.toString(siteData.displayName),
        url: DataTypeAdapter.toString(siteData.webUrl),
        created: DataTypeAdapter.toString(siteData.createdDateTime),
        lastModifiedDateTime: DataTypeAdapter.toString(siteData.lastModifiedDateTime),
        description: DataTypeAdapter.toString(siteData.description),
        serverRelativeUrl: DataTypeAdapter.toString(new URL(siteData.webUrl).pathname),
        webTemplate: DataTypeAdapter.toString(siteData.template?.displayName)
      };
      
      return siteInfo;
    } catch (error) {
      this.logError(`Failed to connect to remote site: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Проверяет, авторизован ли сервис
   * @returns Статус авторизации
   */
  public isAuthorized(): boolean {
    return this._isAuthorized && this._targetSiteId !== undefined;
  }

  /**
   * Получает ID целевого сайта
   * @returns ID сайта
   */
  public getTargetSiteId(): string | undefined {
    return this._targetSiteId;
  }

  /**
   * Получает URL удаленного сайта
   * @returns URL сайта
   */
  public getRemoteSiteUrl(): string {
    return this._remoteSiteUrl;
  }

  /**
   * Логирует информационное сообщение
   * @param message сообщение для логирования
   */
  protected logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * Логирует сообщение об ошибке
   * @param message сообщение об ошибке для логирования
   */
  protected logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}