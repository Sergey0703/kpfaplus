// src/webparts/kpfaplus/services/RemoteSiteItemService.ts
import { MSGraphClientV3 } from '@microsoft/sp-http';
import { 
  IRemoteListItemResponse,
  IRemoteListItemField,
  IGetListItemsOptions,
  ICreateListItemOptions,
  IUpdateListItemOptions
} from './RemoteSiteInterfaces';
import { RemoteSiteListService } from './RemoteSiteListService';
import { DataTypeAdapter } from '../utils/DataTypeAdapter';

/**
 * Сервис для работы с элементами списков в удаленном сайте SharePoint
 */
export class RemoteSiteItemService {
  private _siteId: string;
  private _logSource: string;
  private _listService: RemoteSiteListService;

  /**
   * Конструктор сервиса элементов списка
   * @param siteId ID сайта SharePoint
   * @param logSource Источник для логов
   * @param listService Сервис для работы со списками
   */
  constructor(siteId: string, logSource: string, listService: RemoteSiteListService) {
    this._siteId = siteId;
    this._logSource = logSource;
    this._listService = listService;
  }

  /**
   * Получает элементы списка с поддержкой пагинации
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param options Опции запроса
   * @returns Promise с элементами списка
   */
  public async getListItems(
    graphClient: MSGraphClientV3,
    listTitle: string,
    options: IGetListItemsOptions = {}
  ): Promise<IRemoteListItemResponse[]> {
    try {
      const startTime = Date.now();
      this.logInfo(`[PERF] Начало выполнения getListItems для "${listTitle}" в ${new Date().toISOString()}`);
      
      // Получаем ID списка
      const listId = await this._listService.getListId(graphClient, listTitle);
      
      this.logInfo(`Getting items from list "${listTitle}" with ID: ${listId}...`);
      
      // Значения по умолчанию
      const {
        expandFields = true,
        filter,
        orderBy,
        pageSize = 100,
        maxItems = 5000
      } = options;
      
      // Создаем массив для хранения всех элементов
      let allItems: unknown[] = [];
      
      // Формируем базовый запрос
      let request = graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items`)
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .header('ConsistencyLevel', 'eventual');
      
      // Устанавливаем лимит на количество элементов на странице
      request = request.top(pageSize);
      
      // Оптимизация: Выборка только необходимых полей
      if (expandFields) {
        if (listTitle === 'StaffRecords') {
          // Для StaffRecords выбираем только нужные поля
          request = request.expand(
            'fields($select=ID,Title,Date,ShiftDate1,ShiftDate2,ShiftDate3,ShiftDate4,TimeForLunch,Contract,Holiday,TypeOfLeave,WeeklyTimeTable,Deleted,Checked,ExportResult,StaffMemberLookupId,ManagerLookupId,StaffGroupLookupId,WeeklyTimeTableLookupId)'
          );
        } else {
          // Для других списков просто расширяем поля
          request = request.expand('fields');
        }
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
      
      this.logInfo(`[PERF] Executing request to get items from list "${listTitle}"`);
      const requestStartTime = Date.now();
      
      // Выполняем первый запрос
      let response;
      try {
        response = await request.get();
      } catch (requestError) {
        const errorDetails = {
          message: (requestError as Error).message,
          statusCode: (requestError as { statusCode?: number }).statusCode,
          code: (requestError as { code?: string }).code,
          requestId: (requestError as { requestId?: string }).requestId,
          body: (requestError as { body?: unknown }).body
        };
        
        this.logError(`Error getting items from list "${listTitle}": ${JSON.stringify(errorDetails, null, 2)}`);
        
        if (filter && 
           ((requestError as Error).message.includes("filter") || 
            (requestError as Error).message.includes("query"))) {
          this.logError(`Original filter: "${filter}"`);
        }
        
        throw requestError;
      }
      
      const requestDuration = Date.now() - requestStartTime;
      this.logInfo(`[PERF] First page request completed in ${requestDuration}ms`);
      
      // Добавляем элементы из первого запроса
      const items = response?.value || [];
      allItems = [...allItems, ...items];
      
      this.logInfo(`Retrieved ${items.length} items from first page of list "${listTitle}"`);
      
      // Получаем ссылку на следующую страницу (если есть)
      let nextLink = response['@odata.nextLink'];
      let pageCount = 1;
      
      // Если есть ссылка на следующую страницу, продолжаем запросы
      while (nextLink && allItems.length < maxItems) {
        pageCount++;
        this.logInfo(`[PERF] Fetching page #${pageCount} using nextLink`);
        
        const pageStartTime = Date.now();
        try {
          // Запрашиваем следующую страницу
          const nextPageResponse = await graphClient.api(nextLink).get();
          
          // Добавляем элементы из следующей страницы
          const nextPageItems = nextPageResponse?.value || [];
          allItems = [...allItems, ...nextPageItems];
          
          const pageDuration = Date.now() - pageStartTime;
          this.logInfo(`[PERF] Page #${pageCount} retrieved ${nextPageItems.length} items in ${pageDuration}ms`);
          
          // Обновляем ссылку на следующую страницу
          nextLink = nextPageResponse['@odata.nextLink'];
        } catch (pageError) {
          this.logError(`Error retrieving page #${pageCount}: ${pageError}`);
          // Прерываем цикл при ошибке
          break;
        }
      }
      
      // Ограничиваем количество элементов до maxItems
      if (allItems.length > maxItems) {
        this.logInfo(`Trimming results to maxItems (${maxItems})`);
        allItems = allItems.slice(0, maxItems);
      }
      
      const totalDuration = Date.now() - startTime;
      this.logInfo(`[PERF] Total request completed in ${totalDuration}ms. Retrieved ${allItems.length} items from ${pageCount} pages.`);
      
      // Преобразуем элементы в нужный формат
      return allItems.map((item: Record<string, unknown>) => {
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
   * Создает новый элемент списка
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param options Опции создания
   * @returns Promise с созданным элементом
   */
  public async createListItem(
    graphClient: MSGraphClientV3,
    listTitle: string,
    options: ICreateListItemOptions
  ): Promise<IRemoteListItemResponse> {
    try {
      this.logInfo(`Creating new item in list "${listTitle}"`);
      
      // Получаем ID списка
      const listId = await this._listService.getListId(graphClient, listTitle);
      
      // Создаем элемент списка через Graph API
      const response = await graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items`)
        .post({
          fields: options.fields
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
   * Обновляет элемент списка
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param itemId ID элемента
   * @param options Опции обновления
   * @returns Promise с результатом операции
   */
  public async updateListItem(
    graphClient: MSGraphClientV3,
    listTitle: string,
    itemId: string | number,
    options: IUpdateListItemOptions
  ): Promise<boolean> {
    try {
      this.logInfo(`Updating item ID: ${itemId} in list "${listTitle}"`);
      
      // Получаем ID списка
      const listId = await this._listService.getListId(graphClient, listTitle);
      
      // Выполняем запрос на обновление
      await graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items/${itemId}/fields`)
        .update(options.fields);
      
      this.logInfo(`Successfully updated item ID: ${itemId} in list "${listTitle}"`);
      return true;
    } catch (error) {
      this.logError(`Error updating item ID: ${itemId} in list "${listTitle}": ${error}`);
      throw error;
    }
  }

  /**
   * Удаляет элемент списка
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param itemId ID элемента
   * @returns Promise с результатом операции
   */
  public async deleteListItem(
    graphClient: MSGraphClientV3,
    listTitle: string,
    itemId: string | number
  ): Promise<boolean> {
    try {
      this.logInfo(`Deleting item ID: ${itemId} from list "${listTitle}"`);
      
      // Получаем ID списка
      const listId = await this._listService.getListId(graphClient, listTitle);
      
      // Выполняем запрос на удаление
      await graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items/${itemId}`)
        .delete();
      
      this.logInfo(`Successfully deleted item ID: ${itemId} from list "${listTitle}"`);
      return true;
    } catch (error) {
      this.logError(`Error deleting item ID: ${itemId} from list "${listTitle}": ${error}`);
      throw error;
    }
  }

  /**
   * Получает один элемент списка по ID
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param itemId ID элемента
   * @param expandFields Расширять поля
   * @returns Promise с элементом списка
   */
  public async getListItem(
    graphClient: MSGraphClientV3,
    listTitle: string,
    itemId: string | number,
    expandFields: boolean = true
  ): Promise<IRemoteListItemResponse> {
    try {
      this.logInfo(`Getting item ID: ${itemId} from list "${listTitle}"`);
      
      // Получаем ID списка
      const listId = await this._listService.getListId(graphClient, listTitle);
      
      // Формируем запрос
      let request = graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items/${itemId}`);
      
      // Расширяем поля, если требуется
      if (expandFields) {
        request = request.expand('fields');
      }
      
      // Выполняем запрос
      const response = await request.get();
      
      this.logInfo(`Successfully retrieved item ID: ${itemId} from list "${listTitle}"`);
      
      // Преобразуем элемент в нужный формат
      return {
        id: DataTypeAdapter.toString(response.id),
        fields: response.fields || {}
      };
    } catch (error) {
      this.logError(`Error getting item ID: ${itemId} from list "${listTitle}": ${error}`);
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