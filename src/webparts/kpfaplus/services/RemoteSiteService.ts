// src/webparts/kpfaplus/services/RemoteSiteService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { MSGraphClientV3 } from '@microsoft/sp-http';
import {
  IRemoteSiteInfo,
  IRemoteListInfo,
  IRemoteListFieldInfo,
  IRemoteListItemResponse,
  IRemoteListItemField,
  IGetListItemsOptions, // Для существующего метода getListItems
  // --- ИМПОРТ НОВЫХ ИНТЕРФЕЙСОВ ---
  // Убедитесь, что эти интерфейсы определены и экспортированы в './RemoteSiteInterfaces.ts'
  IGetPaginatedListItemsOptions,
  IRemotePaginatedItemsResponse
  // -----------------------------
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
  private _remoteSiteUrl: string = "https://kpfaie.sharepoint.com/sites/KPFAData"; // Убедитесь, что это правильный URL

  // Вспомогательные сервисы
  private _authService: RemoteSiteAuthService;
  private _listService: RemoteSiteListService | undefined = undefined;
  private _itemService: RemoteSiteItemService | undefined = undefined;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    this.logInfo("Инициализация RemoteSiteService с контекстом");
    // Инициализируем сервис авторизации
    this._authService = new RemoteSiteAuthService(context, this._logSource, this._remoteSiteUrl);

    // Инициализируем сервисы после получения ID сайта.
    // Конструктор не может быть асинхронным. ensureServices() будет ждать готовности.
    // Мы можем запустить процесс авторизации и инициализации сервисов здесь,
    // но доступ к _listService и _itemService должен идти через ensureServices().

    // Запускаем асинхронную инициализацию в фоне.
    this._authService.initGraphAuthorization()
      .then(() => {
        const siteId = this._authService.getTargetSiteId();
        if (siteId) {
          // Инициализируем сервисы, если авторизация в фоне завершилась успешно
          this.initServices(siteId);
          this.logInfo("Вспомогательные сервисы (List, Item) инициализированы после фоновой авторизации");
        } else {
           this.logError("RemoteSiteService: ID сайта не получен после фоновой initGraphAuthorization.");
        }
      })
      .catch(error =>
        this.logError(`RemoteSiteService: Ошибка при фоновой initGraphAuthorization: ${error instanceof Error ? error.message : String(error)}`)
      );

     // ВАЖНОЕ ИСПРАВЛЕНИЕ: Удаляем прямой доступ к _targetSiteId здесь,
     // так как он не существует в this и может быть доступен только через _authService.
     // Инициализация сервисов должна происходить только после успешной авторизации,
     // как это делается в ensureServices().
     // const initialSiteId = this._authService.getTargetSiteId();
     // if (initialSiteId) {
     //     this.initServices(initialSiteId);
     //     this.logInfo("Вспомогательные сервисы (List, Item) инициализированы из ранее полученного Site ID");
     // }

     // Сервисы _listService и _itemService должны быть Undefined сразу после конструктора,
     // пока ensureServices() не завершится успешно.
  }

  /**
   * Инициализирует _listService и _itemService
   * @param siteId ID сайта SharePoint
   */
  private initServices(siteId: string): void {
    // Инициализируем сервисы только если они еще не были инициализированы
    if (!this._listService) {
       this._listService = new RemoteSiteListService(siteId, this._logSource);
       this.logInfo("_listService инициализирован");
    }
     if (!this._itemService) {
       // listService должен быть готов для инициализации itemService
       if (this._listService) {
         this._itemService = new RemoteSiteItemService(siteId, this._logSource, this._listService);
         this.logInfo("_itemService инициализирован");
       } else {
         this.logError("RemoteSiteService: Cannot initialize _itemService, _listService is not ready.");
       }
    }
  }

  /**
   * Статический метод для получения (или создания) экземпляра сервиса
   * @param context Контекст веб-части
   * @returns экземпляр RemoteSiteService
   */
  public static getInstance(context: WebPartContext): RemoteSiteService {
    if (!RemoteSiteService._instance) {
      console.log('[RemoteSiteService] Создание нового экземпляра Singleton');
      RemoteSiteService._instance = new RemoteSiteService(context);
    } else {
      console.log('[RemoteSiteService] Возврат существующего экземпляра Singleton');
      // При возврате существующего экземпляра, возможно, стоит убедиться, что авторизация в нем активна
      // this._instance._authService.ensureAuthorization().catch(err => console.error("Failed to ensure authorization on existing instance", err));
    }
    return RemoteSiteService._instance;
  }

  /**
   * Убеждается, что сервисы авторизованы и инициализированы.
   * Это необходимо вызывать в начале каждого публичного метода,
   * который зависит от авторизации или внутренних сервисов.
   */
  private async ensureServices(): Promise<void> {
    // Сначала убедимся, что авторизация выполнена
    await this._authService.ensureAuthorization(); // Этот метод получит Site ID и установит флаг _isAuthorized

    // Если сервисы еще не инициализированы И Site ID доступен
    const siteId = this._authService.getTargetSiteId();
    if (siteId && (!this._listService || !this._itemService)) {
      this.logInfo("ensureServices: Инициализация сервисов, так как они не были готовы, но Site ID доступен");
      this.initServices(siteId); // Повторная попытка инициализации сервисов
    } else if (!siteId) {
       const errorMsg = "Site ID недоступен после авторизации. Проверьте разрешения приложения.";
       this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] ${errorMsg}`);
      throw new Error(errorMsg);
    }
     // Если siteId есть И сервисы инициализированы, просто продолжаем
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
     // Авторизация считается полной, если AuthService авторизован И сервисы инициализированы
    return this._authService.isAuthorized() && this._listService !== undefined && this._itemService !== undefined;
  }

  /**
   * Получает экземпляр Graph клиента
   * @returns Promise с Graph клиентом
   */
  public async getGraphClient(): Promise<MSGraphClientV3> {
     // Этот метод тоже должен убедиться в авторизации перед получением клиента
    await this._authService.ensureAuthorization();
    return this._authService.getGraphClient();
  }

  /**
   * Проверяет авторизацию и соединение с удаленным сайтом
   * @returns Promise с информацией о веб-сайте
   */
  public async testRemoteSiteConnection(): Promise<IRemoteSiteInfo> {
     // ensureServices implicitly calls ensureAuthorization and checks for services
    await this.ensureServices();
     // The logic to test connection is in AuthService, so delegate there
    return this._authService.testConnection();
  }

  /**
   * Получает ID списка по его имени с удаленного сайта
   * @param listTitle Название списка
   * @returns Promise с ID списка
   */
  public async getListId(listTitle: string): Promise<string> {
    await this.ensureServices();
    if (!this._listService) { throw new Error("List service not initialized after ensureServices"); }
    const graphClient = await this.getGraphClient();
    return this._listService.getListId(graphClient, listTitle);
  }

  /**
   * Получает элементы списка с удаленного сайта (возможно, многостраничный запрос)
   * Это существующий метод для сбора всех страниц до maxItems.
   *
   * @param listTitle Название списка
   * @param expandFields Поля для expand
   * @param filter Фильтр (опционально)
   * @param orderBy Сортировка (опционально)
   * @returns Promise с элементами списка
   */
  public async getListItems( // <-- Метод оставлен как есть для совместимости
    listTitle: string,
    expandFields: boolean = true,
    filter?: string,
    orderBy?: { field: string, ascending: boolean }
  ): Promise<IRemoteListItemResponse[]> {
    await this.ensureServices();
    if (!this._itemService) { throw new Error("Item service not initialized after ensureServices"); }
    const graphClient = await this.getGraphClient();

    const options: IGetListItemsOptions = {
      expandFields,
      filter,
      orderBy
      // maxItems and pageSize defaults are handled inside RemoteSiteItemService.getListItems
    };

    return this._itemService.getListItems(graphClient, listTitle, options);
  }

  /**
   * --- НОВЫЙ ПУБЛИЧНЫЙ МЕТОД ДЛЯ ПАГИНАЦИИ ---
   * Получает ОДНУ страницу элементов списка с поддержкой пагинации и общего количества.
   *
   * @param listTitle Название списка
   * @param options Опции запроса, включая skip, top, filter и orderBy
   * @returns Promise с объектом, содержащим элементы для страницы и общее количество
   */
  public async getPaginatedItemsFromList(
  listTitle: string,
  options: IGetPaginatedListItemsOptions
): Promise<IRemotePaginatedItemsResponse> {
  console.log(`[DEBUG] RemoteSiteService.getPaginatedItemsFromList called for: ${listTitle}`);
  console.log(`[DEBUG] Options:`, options);
  
  await this.ensureServices();
  if (!this._itemService) { 
    throw new Error("Item service not initialized after ensureServices"); 
  }

  const graphClient = await this.getGraphClient();
  console.log(`[DEBUG] Calling itemService.getPaginatedListItems...`);

  return this._itemService.getPaginatedListItems(graphClient, listTitle, options);
}

  /**
   * --- НОВЫЙ МЕТОД ДЛЯ TIMETABLE: ЗАГРУЗКА ВСЕХ ОТФИЛЬТРОВАННЫХ ДАННЫХ ---
   * Получает ВСЕ элементы списка с применением фильтра без пагинации.
   * Специально создан для Timetable где нужны все данные месяца сразу.
   *
   * @param listTitle Название списка
   * @param filter OData фильтр (обязательный)
   * @param orderBy Сортировка (опционально)
   * @returns Promise с объектом, содержащим ВСЕ отфильтрованные элементы
   */
  public async getAllFilteredItemsFromList(
    listTitle: string,
    filter: string,
    orderBy?: { field: string, ascending: boolean }
  ): Promise<{ items: IRemoteListItemResponse[], totalCount: number }> {
    console.log(`[DEBUG] RemoteSiteService.getAllFilteredItemsFromList called for: ${listTitle}`);
    console.log(`[DEBUG] Filter: ${filter}`);
    console.log(`[DEBUG] OrderBy:`, orderBy);
    
    await this.ensureServices();
    if (!this._itemService) { 
      throw new Error("Item service not initialized after ensureServices"); 
    }

    const graphClient = await this.getGraphClient();
    console.log(`[DEBUG] Calling itemService.getAllFilteredItemsForTimetable...`);

    return this._itemService.getAllFilteredItemsForTimetable(
      graphClient, 
      listTitle, 
      filter, 
      orderBy
    );
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
    if (!this._itemService) { throw new Error("Item service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();

    // Делегируем вызов
    return this._itemService.updateListItem(graphClient, listTitle, itemId, { fields });
  }

  /**
   * Проверяет доступность списка на удаленном сайте используя авторизованный доступ
   * @param listTitle Название списка для проверки
   * @returns Promise с информацией о списке или ошибкой
   */
  public async checkRemoteListExists(listTitle: string): Promise<IRemoteListInfo> {
    await this.ensureServices();
    if (!this._listService) { throw new Error("List service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();
    // Делегируем вызов
    return this._listService.checkListExists(graphClient, listTitle);
  }

  /**
   * Получает информацию о списке
   * @param listTitle Название списка
   * @returns Promise с информацией о списке
   */
  public async getListInfo(listTitle: string): Promise<IRemoteListInfo> {
    await this.ensureServices();
    if (!this._listService) { throw new Error("List service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();
    // Делегируем вызов
    return this._listService.getListInfo(graphClient, listTitle);
  }

  /**
   * Получает поля списка
   * @param listTitle Название списка
   * @returns Promise с полями списка
   */
  public async getListFields(listTitle: string): Promise<IRemoteListFieldInfo[]> {
    await this.ensureServices();
    if (!this._listService) { throw new Error("List service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();
    // Делегируем вызов
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
    if (!this._itemService) { throw new Error("Item service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();
    const result = await this._itemService.createListItem(graphClient, listTitle, { fields });
    // Преобразуем результат к нужному типу (как и раньше)
    return { id: result.id, fields: result.fields || {} };
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
    if (!this._listService) { throw new Error("List service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();
    // Делегируем вызов
    return this._listService.checkMultipleLists(graphClient, requiredLists);
  }

  /**
   * Добавляет новый элемент в список через MS Graph API
   * @param listId ID списка
   * @param fields Поля элемента
   * @returns Promise с добавленным элементом
   */
   /**
 * Добавляет новый элемент в список через MS Graph API
 * @param listId ID списка
 * @param fields Поля элемента
 * @returns Promise с добавленным элементом
 */
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
    
    // ИСПРАВЛЕНИЕ: Используем listId напрямую как ID списка, не как название
    // Выполняем запрос к MS Graph API
    const response = await graphClient
      .api(`/sites/${this.getTargetSiteId()}/lists/${listId}/items`)
      .post({
        fields: fields
      });
    
    this.logInfo(`Successfully added item to list: ${JSON.stringify(response)}`);
    
    return {
      id: response.id.toString(),
      fields: response.fields || {}
    };
  } catch (error) {
    this.logError(`Error adding item to list: ${error}`);
    throw error;
  }
}

  /**
   * Получает количество элементов в списке, удовлетворяющих фильтру
   *
   * @param listTitle Название списка
   * @param filter Фильтр для подсчета элементов (опционально)
   * @returns Promise с количеством элементов
   */
  public async getListItemsCount( // <-- Метод оставлен как есть, но для пагинации предпочтительнее $count=true в getPaginatedItemsFromList
    listTitle: string,
    filter?: string
  ): Promise<number> {
    await this.ensureServices();
    if (!this._listService) { throw new Error("List service not initialized after ensureServices"); } // Дополнительная проверка
    const graphClient = await this.getGraphClient();
    // Делегируем вызов
    return this._listService.getListItemsCount(graphClient, listTitle, filter);
  }

   /**
   * --- НОВЫЙ ПУБЛИЧНЫЙ МЕТОД ---
   * Получает один элемент списка по ID.
   *
   * @param listTitle Название списка
   * @param itemId ID элемента
   * @param expandFields Расширять поля (по умолчанию true)
   * @returns Promise с элементом списка в формате IRemoteListItemResponse
   */
  public async getListItem( // <-- Делаем публичным метод для получения одного элемента
    listTitle: string,
    itemId: string | number,
    expandFields: boolean = true
  ): Promise<IRemoteListItemResponse> {
     await this.ensureServices(); // Убеждаемся, что сервисы и авторизация готовы
     if (!this._itemService) { throw new Error("Item service not initialized after ensureServices"); } // Дополнительная проверка

     const graphClient = await this.getGraphClient();

     // Делегируем вызов методу в RemoteSiteItemService
     return this._itemService.getListItem(graphClient, listTitle, itemId, expandFields);
  }

   /**
   * --- НОВЫЙ ПУБЛИЧНЫЙ МЕТОД ---
   * Удаляет элемент списка (физически).
   *
   * @param listTitle Название списка
   * @param itemId ID элемента
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async deleteListItem( // <-- Делаем публичным метод для физического удаления
    listTitle: string,
    itemId: string | number
  ): Promise<boolean> {
    await this.ensureServices(); // Убеждаемся, что сервисы и авторизация готовы
     if (!this._itemService) { throw new Error("Item service not initialized after ensureServices"); } // Дополнительная проверка

     const graphClient = await this.getGraphClient();

     // Делегируем вызов методу в RemoteSiteItemService
     return this._itemService.deleteListItem(graphClient, listTitle, itemId);
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