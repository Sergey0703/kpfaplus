// src/webparts/kpfaplus/services/RemoteSiteService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { 
  IRemoteSiteInfo,
  IRemoteListInfo,
  IRemoteListFieldInfo,
  IRemoteListItemResponse,
  IRemoteListItemField,
  IGetListItemsOptions
} from './RemoteSiteInterfaces';
import { RemoteSiteAuthService } from './RemoteSiteAuthService';
import { RemoteSiteListService } from './RemoteSiteListService';
import { RemoteSiteItemService } from './RemoteSiteItemService';

/**
 * Основной сервис для работы с удаленным сайтом SharePoint через Microsoft Graph API
 */
export class RemoteSiteService {
  private static _instance: RemoteSiteService | undefined = undefined;
  private _logSource: string = "RemoteSiteService";
  
  // URL удаленного сайта
  private _remoteSiteUrl: string = "https://kpfaie.sharepoint.com/sites/KPFAData";
  
  // Вспомогательные сервисы
  private _authService: RemoteSiteAuthService;
  private _listService: RemoteSiteListService | undefined = undefined;
  private _itemService: RemoteSiteItemService | undefined = undefined;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    // Инициализируем сервис авторизации
    this._authService = new RemoteSiteAuthService(context, this._logSource, this._remoteSiteUrl);
    
    // Инициализируем сервисы после получения ID сайта
    // Метод initGraphAuthorization инициирует асинхронную авторизацию, 
    // но конструктор не может быть асинхронным, поэтому сервисы создаются отложенно
    
    // Для обеспечения реактивного создания, тестируем, есть ли уже ID сайта
    if (this._authService.getTargetSiteId()) {
      this.initServices(this._authService.getTargetSiteId()!);
    } else {
      // Если ID сайта еще нет, установим его при первом вызове метода, 
      // который зависит от сервисов
      this._authService.initGraphAuthorization()
        .then(() => {
          const siteId = this._authService.getTargetSiteId();
          if (siteId) {
            this.initServices(siteId);
          }
        })
        .catch(error => 
          this.logError(`Failed to initialize services: ${error instanceof Error ? error.message : String(error)}`)
        );
    }
  }

  /**
   * Инициализирует сервисы после получения ID сайта
   * @param siteId ID сайта SharePoint
   */
  private initServices(siteId: string): void {
    this._listService = new RemoteSiteListService(siteId, this._logSource);
    this._itemService = new RemoteSiteItemService(siteId, this._logSource, this._listService);
  }

  /**
   * Статический метод для получения (или создания) экземпляра сервиса
   * @param context Контекст веб-части
   * @returns экземпляр RemoteSiteService
   */
  public static getInstance(context: WebPartContext): RemoteSiteService {
    if (!RemoteSiteService._instance) {
      RemoteSiteService._instance = new RemoteSiteService(context);
    }
    return RemoteSiteService._instance;
  }

  /**
   * Убеждается, что сервисы инициализированы
   */
  private async ensureServices(): Promise<void> {
    // Сначала убедимся, что авторизация выполнена
    await this._authService.ensureAuthorization();
    
    // Если сервисы еще не инициализированы, инициализируем их
    const siteId = this._authService.getTargetSiteId();
    if (siteId && (!this._listService || !this._itemService)) {
      this.initServices(siteId);
    } else if (!siteId) {
      throw new Error("Site ID is not available. Authorization failed or not completed.");
    }
  }

  /**
   * Получает URL удаленного сайта
   * @returns URL удаленного сайта
   */
  public getRemoteSiteUrl(): string {
    return this._authService.getRemoteSiteUrl();
  }
  
  /**
   * Получает ID целевого сайта
   * @returns ID целевого сайта или undefined, если авторизация не выполнена
   */
  public getTargetSiteId(): string | undefined {
    return this._authService.getTargetSiteId();
  }
  
  /**
   * Возвращает статус авторизации
   * @returns true если авторизация выполнена, иначе false
   */
  public isAuthorized(): boolean {
    return this._authService.isAuthorized();
  }
  
  /**
   * Получает экземпляр Graph клиента
   * @returns Promise с Graph клиентом
   */
  public async getGraphClient(): Promise<MSGraphClientV3> {
    return this._authService.getGraphClient();
  }

  /**
   * Проверяет авторизацию и соединение с удаленным сайтом
   * @returns Promise с информацией о веб-сайте
   */
  public async testRemoteSiteConnection(): Promise<IRemoteSiteInfo> {
    return this._authService.testConnection();
  }

  /**
   * Получает ID списка по его имени с удаленного сайта
   * @param listTitle Название списка
   * @returns Promise с ID списка
   */
  public async getListId(listTitle: string): Promise<string> {
    await this.ensureServices();
    if (!this._listService) {
      throw new Error("List service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    return this._listService.getListId(graphClient, listTitle);
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
    await this.ensureServices();
    if (!this._itemService) {
      throw new Error("Item service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    const options: IGetListItemsOptions = {
      expandFields,
      filter,
      orderBy
    };
    
    return this._itemService.getListItems(graphClient, listTitle, options);
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
    await this.ensureServices();
    if (!this._itemService) {
      throw new Error("Item service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    return this._itemService.updateListItem(graphClient, listTitle, itemId, { fields });
  }

  /**
   * Проверяет доступность списка на удаленном сайте используя авторизованный доступ
   * @param listTitle Название списка для проверки
   * @returns Promise с информацией о списке или ошибкой
   */
  public async checkRemoteListExists(listTitle: string): Promise<IRemoteListInfo> {
    await this.ensureServices();
    if (!this._listService) {
      throw new Error("List service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    return this._listService.checkListExists(graphClient, listTitle);
  }

  /**
   * Получает информацию о списке
   * @param listTitle Название списка
   * @returns Promise с информацией о списке
   */
  public async getListInfo(listTitle: string): Promise<IRemoteListInfo> {
    await this.ensureServices();
    if (!this._listService) {
      throw new Error("List service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    return this._listService.getListInfo(graphClient, listTitle);
  }

  /**
   * Получает поля списка
   * @param listTitle Название списка
   * @returns Promise с полями списка
   */
  public async getListFields(listTitle: string): Promise<IRemoteListFieldInfo[]> {
    await this.ensureServices();
    if (!this._listService) {
      throw new Error("List service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    return this._listService.getListFields(graphClient, listTitle);
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
    await this.ensureServices();
    if (!this._itemService) {
      throw new Error("Item service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    const result = await this._itemService.createListItem(graphClient, listTitle, { fields });
    
    // Преобразуем результат к нужному типу
    return {
      id: result.id,
      fields: result.fields || {}
    };
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
    
    await this.ensureServices();
    if (!this._listService) {
      throw new Error("List service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    return this._listService.checkMultipleLists(graphClient, requiredLists);
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
    await this.ensureServices();
    if (!this._itemService) {
      throw new Error("Item service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    const result = await this._itemService.createListItem(graphClient, listId, { fields });
    
    // Преобразуем результат к нужному типу
    return {
      id: result.id,
      fields: result.fields || {}
    };
  }

  /**
   * Получает количество элементов в списке, удовлетворяющих фильтру
   * @param listTitle Название списка
   * @param filter Фильтр для подсчета элементов (опционально)
   * @returns Promise с количеством элементов
   */
  public async getListItemsCount(
    listTitle: string,
    filter?: string
  ): Promise<number> {
    await this.ensureServices();
    if (!this._listService) {
      throw new Error("List service is not initialized");
    }
    const graphClient = await this.getGraphClient();
    
    return this._listService.getListItemsCount(graphClient, listTitle, filter);
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