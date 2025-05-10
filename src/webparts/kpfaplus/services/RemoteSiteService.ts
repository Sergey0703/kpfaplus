// src/webparts/kpfaplus/services/RemoteSiteService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { DataTypeAdapter } from '../utils/DataTypeAdapter';

// Интерфейс для информации о сайте
export interface IRemoteSiteInfo {
  id: string;
  title: string;
  url: string;
  created: string;
  lastModifiedDateTime: string;
  description?: string;
  serverRelativeUrl?: string;
  webTemplate?: string;
  [key: string]: unknown; // Индексная сигнатура для дополнительных полей
}

// Интерфейс для информации о списке
export interface IRemoteListInfo {
  id: string;
  title: string;
  itemCount: number;
  description?: string;
  defaultViewUrl?: string;
  lastModifiedDateTime?: string;
  [key: string]: unknown; // Индексная сигнатура для дополнительных полей
}

// Интерфейс для полей Lookup
export interface ILookupField {
  Id: number;
  Title: string;
  [key: string]: unknown;
}

// Интерфейс для элементов списка с типизированными полями
export interface IRemoteListItemField {
  [key: string]: unknown;
}

// Интерфейс для элементов списка
export interface IRemoteListItemResponse {
  id: string;
  fields?: IRemoteListItemField;
  [key: string]: unknown;
}

// Интерфейс для полей списка
export interface IRemoteListFieldInfo {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  columnGroup?: string;
  enforceUniqueValues?: boolean;
  indexed?: boolean;
  required?: boolean;
  readOnly?: boolean;
  [key: string]: unknown;
}

export class RemoteSiteService {
  private static _instance: RemoteSiteService | undefined = undefined;
  protected _context: WebPartContext;
  protected _logSource: string;
  
  // URL удаленного сайта
  protected _remoteSiteUrl: string = "https://kpfaie.sharepoint.com/sites/KPFAData";
  
  // ID сайта для Graph API (заполняется при инициализации)
  protected _targetSiteId: string | undefined = undefined;
  protected _targetSiteDriveId: string | undefined = undefined;
  
  // Флаг авторизации
  protected _isAuthorized: boolean = false;
  
  private constructor(context: WebPartContext) {
    this._context = context;
    this._logSource = "RemoteSiteService";
    
    // Инициализируем Graph авторизацию при создании экземпляра
    this.initGraphAuthorization().catch(error => 
      this.logError(`Failed to initialize Graph authorization: ${error instanceof Error ? error.message : String(error)}`)
    );
  }

  public static getInstance(context: WebPartContext): RemoteSiteService {
    if (!RemoteSiteService._instance) {
      RemoteSiteService._instance = new RemoteSiteService(context);
    }
    return RemoteSiteService._instance;
  }

  /**
   * Инициализирует авторизацию через Graph API и получает ID сайта
   */
  private async initGraphAuthorization(): Promise<void> {
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
        this._targetSiteDriveId = response.drive?.id;
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
   * Получает URL удаленного сайта
   * @returns URL удаленного сайта
   */
  public getRemoteSiteUrl(): string {
    return this._remoteSiteUrl;
  }
  
  /**
   * Получает ID целевого сайта
   * @returns ID целевого сайта или undefined, если авторизация не выполнена
   */
  public getTargetSiteId(): string | undefined {
    return this._targetSiteId;
  }
  
  /**
   * Возвращает статус авторизации
   * @returns true если авторизация выполнена, иначе false
   */
  public isAuthorized(): boolean {
    return this._isAuthorized && this._targetSiteId !== undefined;
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
  public async testRemoteSiteConnection(): Promise<IRemoteSiteInfo> {
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
   * Получает ID списка по его имени с удаленного сайта
   * @param listTitle Название списка
   * @returns Promise с ID списка
   */
  public async getListId(listTitle: string): Promise<string> {
    try {
      await this.ensureAuthorization();
      
      const graphClient = await this.getGraphClient();
      
      this.logInfo(`Fetching list ID for list "${listTitle}"...`);
      
      const listsResponse = await graphClient
        .api(`/sites/${this._targetSiteId}/lists`)
        .filter(`displayName eq '${listTitle}'`)
        .get();
      
      if (!listsResponse.value || listsResponse.value.length === 0) {
        throw new Error(`List "${listTitle}" not found on remote site`);
      }
      
      const listId = DataTypeAdapter.toString(listsResponse.value[0].id);
      this.logInfo(`Successfully found list "${listTitle}" with ID: ${listId}`);
      
      return listId;
    } catch (error) {
      this.logError(`Failed to get list ID for "${listTitle}": ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

/**
 * Получает элементы списка с удаленного сайта
 * @param listTitle Название списка
 * @param expandFields Поля для expand
 * @param filter Фильтр (опционально)
 * @param orderBy Сортировка (опционально)
 * @returns Promise с элементами списка
 */
public async getListItems(
    listTitle: string,
    expandFields: boolean = true,
    filter?: string,
    orderBy?: { field: string, ascending: boolean }
  ): Promise<IRemoteListItemResponse[]> {
    try {
      await this.ensureAuthorization();
      
      const listId = await this.getListId(listTitle);
      const graphClient = await this.getGraphClient();
      
      this.logInfo(`Getting items from list "${listTitle}" with ID: ${listId}...`);
      
      let request = graphClient
        .api(`/sites/${this._targetSiteId}/lists/${listId}/items`);
      
      // Заголовки для разрешения запросов по неиндексированным полям
      request = request
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .header('ConsistencyLevel', 'eventual');
      
      // Обязательно добавляем expand fields перед любой фильтрацией
      if (expandFields) {
        request = request.expand('fields');
      }
      
      // Обрабатываем фильтр
      if (filter) {
        // Всегда добавляем prefix fields/ для фильтрации
        const modifiedFilter = filter.startsWith('fields/') ? filter : `fields/${filter}`;
        this.logInfo(`Applying filter: ${modifiedFilter}`);
        request = request.filter(modifiedFilter);
      }
      
      // Аналогично для сортировки
      if (orderBy) {
        // Добавляем префикс fields/ к полю
        const fieldWithPrefix = orderBy.field.startsWith('fields/') ? 
          orderBy.field : `fields/${orderBy.field}`;
        
        const orderByString = `${fieldWithPrefix} ${orderBy.ascending ? 'asc' : 'desc'}`;
        this.logInfo(`Applying orderby: ${orderByString}`);
        request = request.orderby(orderByString);
      }
      
      // Выполняем запрос с обработкой ошибок
      let response;
      try {
        this.logInfo(`Executing request to get items from list "${listTitle}"`);
        response = await request.get();
      } catch (requestError) {
        // Детальное логирование ошибки для отладки
        const errorDetails = {
          message: (requestError as Error).message,
          statusCode: (requestError as { statusCode?: number }).statusCode,
          code: (requestError as { code?: string }).code,
          requestId: (requestError as { requestId?: string }).requestId,
          body: (requestError as { body?: unknown }).body
        };
        
        this.logError(`Error getting items from list "${listTitle}": ${JSON.stringify(errorDetails, null, 2)}`);
        
        // Если ошибка связана с фильтром, логируем оригинальный фильтр для отладки
        if (filter && 
           ((requestError as Error).message.includes("filter") || 
            (requestError as Error).message.includes("query"))) {
          this.logError(`Original filter: "${filter}"`);
        }
        
        throw requestError;
      }
      
      const items = response?.value || [];
      this.logInfo(`Successfully retrieved ${items.length} items from list "${listTitle}"`);
      
      // Выводим первый элемент для анализа структуры
      if (items.length > 0) {
        this.logInfo(`First item sample: ${JSON.stringify(items[0], null, 2)}`);
      }
      
      // Просто возвращаем элементы, не модифицируя их
      // Преобразование типов будет выполняться в сервисах-потребителях с использованием DataTypeAdapter
      return items.map((item: Record<string, unknown>) => {
        const responseItem: IRemoteListItemResponse = {
          id: DataTypeAdapter.toString(item.id),
          fields: item.fields as IRemoteListItemField || {}
        };
        
        // Копируем остальные свойства
        for (const key in item) {
          if (Object.prototype.hasOwnProperty.call(item, key) && key !== 'id' && key !== 'fields') {
            responseItem[key] = item[key];
          }
        }
        
        return responseItem;
      });
    } catch (error) {
      this.logError(`Failed to get items from list "${listTitle}": ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

/**
 * Обновляет элемент списка через Graph API
 * @param listTitle Название списка
 * @param itemId ID элемента списка
 * @param fields Поля для обновления
 * @returns Promise с результатом операции
 */
public async updateListItem(
  listTitle: string,
  itemId: number,
  fields: Record<string, unknown>
): Promise<boolean> {
  try {
    await this.ensureAuthorization();
    
    // Получаем ID списка
    const listId = await this.getListId(listTitle);
    
    // Получаем Graph клиент
    const graphClient = await this.getGraphClient();
    
    // Выполняем запрос на обновление
    await graphClient
      .api(`/sites/${this._targetSiteId}/lists/${listId}/items/${itemId}/fields`)
      .update(fields);
    
    this.logInfo(`Successfully updated item ID: ${itemId} in list "${listTitle}"`);
    return true;
  } catch (error) {
    this.logError(`Error updating item ID: ${itemId} in list "${listTitle}": ${error}`);
    throw error;
  }
}

  /**
   * Проверяет доступность списка на удаленном сайте используя авторизованный доступ
   * @param listTitle Название списка для проверки
   * @returns Promise с информацией о списке или ошибкой
   */
  public async checkRemoteListExists(listTitle: string): Promise<IRemoteListInfo> {
    try {
      // Убедимся, что у нас есть авторизация на удаленный сайт
      await this.ensureAuthorization();
      
      // Получаем Graph клиент с авторизационным токеном
      const graphClient: MSGraphClientV3 = await this._context.msGraphClientFactory.getClient('3');
      
      // Получаем список с использованием авторизованного доступа
      // Используем фильтрацию на стороне сервера для оптимизации
      const listsResponse = await graphClient
        .api(`/sites/${this._targetSiteId}/lists`)
        .filter(`displayName eq '${listTitle}'`)
        .get();
      
      if (!listsResponse.value || listsResponse.value.length === 0) {
        throw new Error(`List "${listTitle}" not found`);
      }
      
      const listData = listsResponse.value[0];
      
      // Получаем элементы списка (максимум 1000, если больше - нужна пагинация)
      const itemsResponse = await graphClient
        .api(`/sites/${this._targetSiteId}/lists/${listData.id}/items`)
        .top(1000)
        .header('Prefer', 'allowthrottleablequeries')
        .header('Prefer', 'NonIndexedQueriesRequiringPayfulRandomly')
        .get();
      
      // Подсчитываем количество элементов из полученного массива
      const itemCount = itemsResponse.value ? itemsResponse.value.length : 0;
      
      this.logInfo(`Successfully accessed list "${listTitle}" with ${itemCount} items`);
      
      // Преобразуем данные из Graph API в наш интерфейс IRemoteListInfo
      const listInfo: IRemoteListInfo = {
        id: DataTypeAdapter.toString(listData.id),
        title: DataTypeAdapter.toString(listData.displayName),
        itemCount: DataTypeAdapter.toNumber(itemCount),
        description: DataTypeAdapter.toString(listData.description),
        defaultViewUrl: DataTypeAdapter.toString(listData.webUrl),
        lastModifiedDateTime: DataTypeAdapter.toString(listData.lastModifiedDateTime)
      };
      
      return listInfo;
    } catch (error) {
      this.logError(`Failed to access list "${listTitle}": ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

/**
 * Получает информацию о списке
 * @param listTitle Название списка
 * @returns Promise с информацией о списке
 */
public async getListInfo(listTitle: string): Promise<IRemoteListInfo> {
  try {
    await this.ensureAuthorization();
    
    // Получаем Graph клиент
    const graphClient = await this.getGraphClient();
    
    // Получаем информацию о списке
    const response = await graphClient
      .api(`/sites/${this._targetSiteId}/lists?$filter=displayName eq '${listTitle}'`)
      .get();
    
    if (response && response.value && response.value.length > 0) {
      const listData = response.value[0];
      
      return {
        id: DataTypeAdapter.toString(listData.id),
        title: DataTypeAdapter.toString(listData.displayName),
        itemCount: DataTypeAdapter.toNumber(listData.items?.count),
        description: DataTypeAdapter.toString(listData.description),
        defaultViewUrl: DataTypeAdapter.toString(listData.webUrl),
        lastModifiedDateTime: DataTypeAdapter.toString(listData.lastModifiedDateTime)
      };
    } else {
      throw new Error(`List "${listTitle}" not found`);
    }
  } catch (error) {
    this.logError(`Error getting list info for "${listTitle}": ${error}`);
    throw error;
  }
}

/**
 * Получает поля списка
 * @param listTitle Название списка
 * @returns Promise с полями списка
 */
public async getListFields(listTitle: string): Promise<IRemoteListFieldInfo[]> {
  try {
    await this.ensureAuthorization();
    
    // Получаем ID списка
    const listId = await this.getListId(listTitle);
    
    // Получаем Graph клиент
    const graphClient = await this.getGraphClient();
    
    // Получаем поля списка
    const response = await graphClient
      .api(`/sites/${this._targetSiteId}/lists/${listId}/columns`)
      .get();
    
    if (response && response.value) {
      return response.value.map((field: Record<string, unknown>) => ({
        id: DataTypeAdapter.toString(field.id),
        name: DataTypeAdapter.toString(field.name),
        displayName: DataTypeAdapter.toString(field.displayName),
        description: DataTypeAdapter.toString(field.description),
        columnGroup: DataTypeAdapter.toString(field.columnGroup),
        enforceUniqueValues: DataTypeAdapter.toBoolean(field.enforceUniqueValues),
        indexed: DataTypeAdapter.toBoolean(field.indexed),
        required: DataTypeAdapter.toBoolean(field.required),
        readOnly: DataTypeAdapter.toBoolean(field.readOnly)
      }));
    } else {
      return [];
    }
  } catch (error) {
    this.logError(`Error getting list fields for "${listTitle}": ${error}`);
    throw error;
  }
}

  /**
 * Создает новый элемент списка
 * @param listTitle Название списка
 * @param fields Поля для создания
 * @returns Promise с созданным элементом
 */
public async createListItem(
  listTitle: string,
  fields: Record<string, unknown>
): Promise<{ id: string; fields: IRemoteListItemField }> {
  try {
    this.logInfo(`Creating new item in list "${listTitle}"`);
    await this.ensureAuthorization();
    
    // Получаем ID списка
    const listId = await this.getListId(listTitle);
    
    // Получаем Graph клиент
    const graphClient = await this.getGraphClient();
    
    // Создаем элемент списка через Graph API
    const response = await graphClient
      .api(`/sites/${this._targetSiteId}/lists/${listId}/items`)
      .post({
        fields: fields
      });
    
    this.logInfo(`Successfully created item in list "${listTitle}" with ID: ${response?.id}`);
    
    // Возвращаем созданный элемент
    return {
      id: DataTypeAdapter.toString(response.id),
      fields: response.fields || {}
    };
  } catch (error) {
    this.logError(`Error creating item in list "${listTitle}": ${error}`);
    throw error;
  }
}

  /**
   * Проверяет все необходимые списки на удаленном сайте используя авторизованный доступ
   * @returns Promise с результатами проверки
   */
  public async checkAllRequiredLists(): Promise<{ [listName: string]: IRemoteListInfo | { error: string } }> {
    const requiredLists = [
      "Staff",
      "StaffGroups",
      "GroupMembers",
      "WeeklySchedule",
      "TypeOfWorkers"
    ];
    
    const results: { [listName: string]: IRemoteListInfo | { error: string } } = {};
    
    // Сначала проверяем авторизацию
    try {
      await this.ensureAuthorization();
    } catch (error) {
      // Если авторизация не удалась, возвращаем ошибку для всех списков
      const errorMessage = error instanceof Error ? error.message : String(error);
      for (const listTitle of requiredLists) {
        results[listTitle] = {
          error: `Authorization to remote site failed: ${errorMessage}`
        };
      }
      return results;
    }
    
    // Если авторизация успешна, проверяем каждый список
    for (const listTitle of requiredLists) {
      try {
        results[listTitle] = await this.checkRemoteListExists(listTitle);
      } catch (error) {
        results[listTitle] = { 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return results;
  }

 /**
 * Добавляет новый элемент в список через MS Graph API
 * @param listId ID списка
 * @param fields Поля элемента
 * @returns Promise с добавленным элементом
 */
public async addListItem(
  listId: string, 
  fields: Record<string, unknown>
): Promise<{ id: string; fields: IRemoteListItemField }> {
  try {
    this.logInfo(`Adding item to list with ID: ${listId}`);
    
    // Получаем инстанс графа
    const graphClient = await this.getGraphClient();
    
    // Выполняем запрос к MS Graph API
    const response = await graphClient
      .api(`/sites/${this._targetSiteId}/lists/${listId}/items`)
      .post({
        fields: fields
      });
    
    this.logInfo(`Successfully added item to list: ${JSON.stringify(response)}`);
    
    return {
      id: DataTypeAdapter.toString(response.id),
      fields: response.fields || {}
    };
  } catch (error) {
    this.logError(`Error adding item to list: ${error}`);
    throw error;
  }
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