// src/webparts/kpfaplus/services/RemoteSiteListService.ts
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { DataTypeAdapter } from '../utils/DataTypeAdapter';
import { 
  IRemoteListInfo, 
  IRemoteListFieldInfo
} from './RemoteSiteInterfaces';

/**
 * Сервис для работы со списками в удаленном сайте SharePoint
 */
export class RemoteSiteListService {
  private _siteId: string;
  private _logSource: string;

  /**
   * Конструктор сервиса списков
   * @param siteId ID сайта SharePoint
   * @param logSource Источник для логов
   */
  constructor(siteId: string, logSource: string) {
    this._siteId = siteId;
    this._logSource = logSource;
  }

  /**
   * Получает ID списка по его имени с удаленного сайта
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @returns Promise с ID списка
   */
  public async getListId(graphClient: MSGraphClientV3, listTitle: string): Promise<string> {
    try {
      this.logInfo(`Fetching list ID for list "${listTitle}"...`);
      
      const listsResponse = await graphClient
        .api(`/sites/${this._siteId}/lists`)
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
   * Получает информацию о списке
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @returns Promise с информацией о списке
   */
  public async getListInfo(graphClient: MSGraphClientV3, listTitle: string): Promise<IRemoteListInfo> {
    try {
      this.logInfo(`Getting info for list "${listTitle}"`);
      
      // Получаем информацию о списке
      const response = await graphClient
        .api(`/sites/${this._siteId}/lists?$filter=displayName eq '${listTitle}'`)
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
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @returns Promise с полями списка
   */
  public async getListFields(graphClient: MSGraphClientV3, listTitle: string): Promise<IRemoteListFieldInfo[]> {
    try {
      this.logInfo(`Getting fields for list "${listTitle}"`);
      
      // Получаем ID списка
      const listId = await this.getListId(graphClient, listTitle);
      
      // Получаем поля списка
      const response = await graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/columns`)
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
   * Проверяет доступность списка на удаленном сайте
   * @param graphClient Graph клиент
   * @param listTitle Название списка для проверки
   * @returns Promise с информацией о списке
   */
  public async checkListExists(graphClient: MSGraphClientV3, listTitle: string): Promise<IRemoteListInfo> {
    try {
      this.logInfo(`Checking if list "${listTitle}" exists`);
      
      // Получаем список с использованием авторизованного доступа
      // Используем фильтрацию на стороне сервера для оптимизации
      const listsResponse = await graphClient
        .api(`/sites/${this._siteId}/lists`)
        .filter(`displayName eq '${listTitle}'`)
        .get();
      
      if (!listsResponse.value || listsResponse.value.length === 0) {
        throw new Error(`List "${listTitle}" not found`);
      }
      
      const listData = listsResponse.value[0];
      
      // Получаем элементы списка (максимум 100, если больше - нужна пагинация)
      const itemsResponse = await graphClient
        .api(`/sites/${this._siteId}/lists/${listData.id}/items`)
        .top(100)
        .header('Prefer', 'allowthrottleablequeries')
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .header('ConsistencyLevel', 'eventual')
        .get();
      
      // Подсчитываем количество элементов из полученного массива
      const itemCount = itemsResponse.value ? itemsResponse.value.length : 0;
      
      this.logInfo(`Successfully accessed list "${listTitle}" with at least ${itemCount} items`);
      
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
   * Получает количество элементов в списке, соответствующих фильтру
   * @param graphClient Graph клиент  
   * @param listTitle Название списка
   * @param filter Фильтр для подсчета элементов (опционально)
   * @returns Promise с количеством элементов
   */
  public async getListItemsCount(
    graphClient: MSGraphClientV3,
    listTitle: string,
    filter?: string
  ): Promise<number> {
    try {
      const listId = await this.getListId(graphClient, listTitle);
      
      this.logInfo(`Getting count of items in list "${listTitle}" with ID: ${listId}...`);
      
      // К сожалению, Graph API не поддерживает прямой подсчет с $count для SharePoint списков
      // Поэтому делаем запрос с минимальными полями, но получаем все элементы для подсчета
      let request = graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items`)
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .header('ConsistencyLevel', 'eventual')
        .select('id') // Запрашиваем только ID для минимизации размера ответа
        .top(999); // Максимальное количество элементов на страницу
      
      // Добавляем фильтр, если указан
      if (filter) {
        const modifiedFilter = filter.startsWith('fields/') ? filter : `fields/${filter}`;
        request = request.filter(modifiedFilter);
      }
      
      const startTime = Date.now();
      this.logInfo(`[PERF] Executing count request for list "${listTitle}"`);
      
      // Выполняем запрос и получаем первую страницу
      const response = await request.get();
      const items = response?.value || [];
      
      // Получаем общее количество элементов, включая следующие страницы, если они есть
      let totalItems = items.length;
      let nextLink = response['@odata.nextLink'];
      
      // Если есть следующие страницы, продолжаем запросы для получения точного количества
      while (nextLink) {
        const nextPageResponse = await graphClient.api(nextLink).get();
        const nextPageItems = nextPageResponse?.value || [];
        totalItems += nextPageItems.length;
        nextLink = nextPageResponse['@odata.nextLink'];
        
        this.logInfo(`Retrieved additional ${nextPageItems.length} items, current count: ${totalItems}`);
      }
      
      const duration = Date.now() - startTime;
      this.logInfo(`[PERF] Count request completed in ${duration}ms. Total items: ${totalItems}`);
      
      return totalItems;
    } catch (error) {
      this.logError(`Error getting count of items in list "${listTitle}": ${error}`);
      return 0;
    }
  }

  /**
   * Проверяет несколько списков за один раз
   * @param graphClient Graph клиент
   * @param listTitles Массив с названиями списков для проверки
   * @returns Promise с результатами проверки для каждого списка
   */
  public async checkMultipleLists(
    graphClient: MSGraphClientV3,
    listTitles: string[]
  ): Promise<{ [listName: string]: IRemoteListInfo | { error: string } }> {
    const results: { [listName: string]: IRemoteListInfo | { error: string } } = {};
    
    // Проверяем каждый список
    for (const listTitle of listTitles) {
      try {
        results[listTitle] = await this.checkListExists(graphClient, listTitle);
      } catch (error) {
        results[listTitle] = { 
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return results;
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