// src/webparts/kpfaplus/services/RemoteSiteItemService.ts
import { MSGraphClientV3 } from '@microsoft/sp-http';
import {
  IRemoteListItemResponse,
  IRemoteListItemField,
  IGetListItemsOptions, // Для существующего метода getListItems
  ICreateListItemOptions,
  IUpdateListItemOptions,
  // --- ИМПОРТ НОВЫХ ИНТЕРФЕЙСОВ ---
  // Убедитесь, что эти интерфейсы определены и экспортированы в './RemoteSiteInterfaces.ts'
  IGetPaginatedListItemsOptions,
  IRemotePaginatedItemsResponse
  // -----------------------------
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
    this._logSource = logSource + ".Item"; // Добавил ".Item" для ясности логов
    this._listService = listService;
    this.logInfo("RemoteSiteItemService инициализирован");
  }

  /**
   * Получает элементы списка с удаленного сайта (возможно, многостраничный запрос).
   * Этот метод собирает все страницы данных по `@odata.nextLink` до limit'а maxItems.
   * Его назначение отличается от получения одной страницы для пагинации UI.
   *
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param options Опции запроса (не пагинация в OData смысле, а сбор страниц)
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

            const listId = await this._listService.getListId(graphClient, listTitle);

            this.logInfo(`Getting items from list "${listTitle}" with ID: ${listId}...`);

            const {
              expandFields = true,
              filter,
              orderBy,
              pageSize = 100, // Default Graph API page size
              maxItems = 5000 // Max items to collect across all pages
            } = options;

            let allItems: unknown[] = [];
            let request = graphClient
              .api(`/sites/${this._siteId}/lists/${listId}/items`)
              .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
              .header('ConsistencyLevel', 'eventual');

            request = request.top(pageSize); // Limit items per page from Graph API

            // Применяем $select и $expand
            if (expandFields) {
              if (listTitle === 'StaffRecords') {
                 // Для StaffRecords выбираем только нужные поля и расширяем поле fields
                request = request.select('id,fields/ID,fields/Title,fields/Date,fields/ShiftDate1,fields/ShiftDate2,fields/ShiftDate3,fields/ShiftDate4,fields/TimeForLunch,fields/Contract,fields/Holiday,fields/TypeOfLeave,fields/WeeklyTimeTable,fields/Deleted,fields/Checked,fields/ExportResult,fields/StaffMemberLookupId,fields/ManagerLookupId,fields/StaffGroupLookupId,fields/WeeklyTimeTableLookupId');
                request = request.expand('fields'); // Expand the fields property
                this.logInfo(`[DEBUG] Applying specific select/expand for StaffRecords`);
              } else {
                request = request.expand('fields');
                this.logInfo(`[DEBUG] Applying general expand fields`);
              }
            }


            if (filter) {
              const modifiedFilter = filter.startsWith('fields/') ? filter : `fields/${filter}`;
              this.logInfo(`Applying filter: ${modifiedFilter}`);
              request = request.filter(modifiedFilter);
            }

            if (orderBy) {
              const fieldWithPrefix = orderBy.field.startsWith('fields/') ?
                orderBy.field : `fields/${orderBy.field}`;
              const orderByString = `${fieldWithPrefix} ${orderBy.ascending ? 'asc' : 'desc'}`;
              this.logInfo(`Applying orderby: ${orderByString}`);
              request = request.orderby(orderByString);
            }

            this.logInfo(`[PERF] Executing initial get items request for list "${listTitle}"`);
            const requestStartTime = Date.now();

            let response;
            try {
              response = await request.get();
            } catch (requestError) {
               this.logError(`Error getting items from list "${listTitle}": ${JSON.stringify(requestError, null, 2)}`);
               if (filter) {
                 this.logError(`Original filter was: "${filter}"`);
               }
               throw requestError; // Пробрасываем ошибку
            }

            const requestDuration = Date.now() - requestStartTime;
            this.logInfo(`[PERF] First page request completed in ${requestDuration}ms`);

            const items = response?.value || [];
            allItems = [...allItems, ...items];

            this.logInfo(`Retrieved ${items.length} items from first page of list "${listTitle}". Total collected so far: ${allItems.length}`);

            let nextLink = response['@odata.nextLink'];
            let pageCount = 1;

            while (nextLink && allItems.length < maxItems) {
              pageCount++;
              this.logInfo(`[PERF] Fetching page #${pageCount} using nextLink`);

              const pageStartTime = Date.now();
              try {
                const nextPageResponse = await graphClient.api(nextLink).get();
                const nextPageItems = nextPageResponse?.value || [];
                allItems = [...allItems, ...nextPageItems];

                const pageDuration = Date.now() - pageStartTime;
                this.logInfo(`[PERF] Page #${pageCount} retrieved ${nextPageItems.length} items in ${pageDuration}ms. Total collected: ${allItems.length}`);

                nextLink = nextPageResponse['@odata.nextLink'];
              } catch (pageError) {
                this.logError(`Error retrieving page #${pageCount}: ${pageError instanceof Error ? pageError.message : String(pageError)}. Stopping fetch.`);
                break; // Stop fetching on error
              }
            }

            if (allItems.length > maxItems) {
              this.logInfo(`Trimming results to maxItems (${maxItems}) from ${allItems.length} collected.`);
              allItems = allItems.slice(0, maxItems);
            }

            const totalDuration = Date.now() - startTime;
            this.logInfo(`[PERF] Total getListItems completed in ${totalDuration}ms. Retrieved ${allItems.length} items across ${pageCount} pages.`);

            return allItems.map((item: Record<string, unknown>) => {
              const responseItem: IRemoteListItemResponse = {
                id: DataTypeAdapter.toString(item.id),
                fields: item.fields as IRemoteListItemField || {}
              };

              for (const key in item) {
                if (Object.prototype.hasOwnProperty.call(item, key) && key !== 'id' && key !== 'fields') {
                  responseItem[key] = item[key];
                }
              }
              return responseItem;
            });
          } catch (error) {
            this.logError(`Failed to get items from list "${listTitle}": ${error instanceof Error ? error.message : String(error)}`);
            throw error; // Пропагируем ошибку
          }
  }


  /**
   * Получает ОДНУ страницу элементов списка с поддержкой пагинации и общего количества.
   * Этот метод предназначен специально для серверной пагинации UI.
   *
   * @param graphClient Graph клиент
   * @param listTitle Название списка
   * @param options Опции запроса, включая skip, top, filter и orderBy
   * @returns Promise с объектом, содержащим элементы для страницы и общее количество
   */
  public async getPaginatedListItems(
    graphClient: MSGraphClientV3,
    listTitle: string,
    options: IGetPaginatedListItemsOptions
  ): Promise<IRemotePaginatedItemsResponse> {
    try {
      const startTime = Date.now();
      this.logInfo(`[PERF] Начало выполнения getPaginatedListItems для "${listTitle}" в ${new Date().toISOString()}`);

      // Получаем ID списка
      const listId = await this._listService.getListId(graphClient, listTitle);

      this.logInfo(`Getting paginated items from list "${listTitle}" with ID: ${listId}...`);

      const {
        expandFields = true, // По умолчанию расширяем поля
        filter,
        orderBy,
        skip, // Количество элементов для пропуска
        top,  // Количество элементов для получения (размер страницы)
      } = options;

       // Проверяем, что skip и top указаны и являются числами
      if (typeof skip !== 'number' || typeof top !== 'number' || skip < 0 || top <= 0) {
           const errorMsg = `[ОШИБКА] Некорректные параметры пагинации: skip=${skip}, top=${top}`;
           this.logError(errorMsg);
           throw new Error(errorMsg);
       }


      // Формируем базовый запрос
      let request = graphClient
        .api(`/sites/${this._siteId}/lists/${listId}/items`)
        // Добавляем заголовки для поддержки $count=true и консистентности
        .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
        .header('ConsistencyLevel', 'eventual')
        .count(true); // <--- Запрашиваем общее количество элементов

      // Применяем $select и $expand
       if (expandFields) {
          if (listTitle === 'StaffRecords') {
             // Для StaffRecords выбираем только нужные поля и расширяем поле fields
            request = request.select('id,fields/ID,fields/Title,fields/Date,fields/ShiftDate1,fields/ShiftDate2,fields/ShiftDate3,fields/ShiftDate4,fields/TimeForLunch,fields/Contract,fields/Holiday,fields/TypeOfLeave,fields/WeeklyTimeTable,fields/Deleted,fields/Checked,fields/ExportResult,fields/StaffMemberLookupId,fields/ManagerLookupId,fields/StaffGroupLookupId,fields/WeeklyTimeTableLookupId');
            request = request.expand('fields'); // Expand the fields property
            this.logInfo(`[DEBUG] Applying specific select/expand for StaffRecords`);
           } else {
             request = request.expand('fields');
             this.logInfo(`[DEBUG] Applying general expand fields`);
           }
        } else {
            // Если expandFields === false, запрашиваем только основные поля или те, что нужны для фильтра/сортировки
            // Note: Graph API for list items requires at least 'id'
            request = request.select('id');
             this.logInfo(`[DEBUG] Applying minimal select 'id' as expandFields is false`);
        }


      // Обрабатываем фильтр
      if (filter) {
        const modifiedFilter = filter.startsWith('fields/') ? filter : `fields/${filter}`;
        this.logInfo(`Applying filter: ${modifiedFilter}`);
        request = request.filter(modifiedFilter);
      }

      // Обрабатываем сортировку
      if (orderBy) {
        const fieldWithPrefix = orderBy.field.startsWith('fields/') ?
          orderBy.field : `fields/${orderBy.field}`;
        const orderByString = `${fieldWithPrefix} ${orderBy.ascending ? 'asc' : 'desc'}`;
        this.logInfo(`Applying orderby: ${orderByString}`);
        request = request.orderby(orderByString);
      }

      // --- Применяем параметры пагинации ---
      request = request.skip(skip);
      request = request.top(top);
      this.logInfo(`Applying pagination: skip=${skip}, top=${top}`);
      // -----------------------------------

      this.logInfo(`[PERF] Executing paginated request for list "${listTitle}"`);
      const requestStartTime = Date.now();

      let response;
      try {
        response = await request.get();
      } catch (requestError) {
        this.logError(`Error getting paginated items from list "${listTitle}": ${JSON.stringify(requestError, null, 2)}`);
         if (filter) {
           this.logError(`Original filter was: "${filter}"`);
         }
         if (orderBy) {
            this.logError(`Original orderby was: "${orderBy.field} ${orderBy.ascending ? 'asc' : 'desc'}"`);
         }
        throw requestError; // Пробрасываем ошибку
      }

      const requestDuration = Date.now() - requestStartTime;
      this.logInfo(`[PERF] Paginated request completed in ${requestDuration}ms`);

      // Извлекаем элементы и общее количество из ответа Graph API
      const items = response?.value || [];
      // '@odata.count' должен быть на том же уровне, что и 'value' в ответе
      const totalCount = DataTypeAdapter.toNumber(response['@odata.count'], 0); // Используем адаптер для безопасности

      this.logInfo(`Retrieved ${items.length} items for page, total count: ${totalCount}`);

      // Преобразуем полученные элементы в нужный формат IRemoteListItemResponse
      const paginatedItems: IRemoteListItemResponse[] = items.map((item: Record<string, unknown>) => {
         // Исправляем предупреждение TS6133: создаем и сразу возвращаем объект
         return {
           id: DataTypeAdapter.toString(item.id),
           // Assuming fields are always returned under the 'fields' property when expanded=true
           // Use type assertion if the exact response structure isn't strictly typed
           fields: (item as any).fields || {}, // Adjust type assertion if you have a more specific one
           // Copying other top-level properties that might be useful (e.g., @odata.etag)
           '@odata.etag': (item as any)['@odata.etag'], // Example of copying other properties
           // ... copy other standard properties like createdDateTime, lastModifiedDateTime if needed
         };
      });

      const totalDuration = Date.now() - startTime;
      this.logInfo(`[PERF] Total getPaginatedListItems completed in ${totalDuration}ms.`);

      // Возвращаем объект с элементами для страницы и общим количеством
      return {
        items: paginatedItems,
        totalCount: totalCount,
      };

    } catch (error) {
      this.logError(`Failed to get paginated items from list "${listTitle}": ${error instanceof Error ? error.message : String(error)}`);
      throw error; // Пробрасываем ошибку дальше
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

          const listId = await this._listService.getListId(graphClient, listTitle);

          const response = await graphClient
            .api(`/sites/${this._siteId}/lists/${listId}/items`)
            .post({
              fields: options.fields
            });

          this.logInfo(`Successfully created item in list "${listTitle}" with ID: ${response?.id}`);

           // Assuming the response includes the created item's id and fields
          return {
            id: DataTypeAdapter.toString(response.id),
            fields: (response as any).fields || {} // Access fields if present
          };

        } catch (error) {
          this.logError(`Error creating item in list "${listTitle}": ${error}`);
          throw error; // Propagate the error
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

            const listId = await this._listService.getListId(graphClient, listTitle);

            // Update is applied to the 'fields' endpoint for items
            await graphClient
              .api(`/sites/${this._siteId}/lists/${listId}/items/${itemId}/fields`)
              .update(options.fields);

            this.logInfo(`Successfully updated item ID: ${itemId} in list "${listTitle}"`);
            return true;
          } catch (error) {
            this.logError(`Error updating item ID: ${itemId} in list "${listTitle}": ${error}`);
            throw error; // Пропагируем ошибку
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

            const listId = await this._listService.getListId(graphClient, listTitle);

            // Delete is applied to the item endpoint
            await graphClient
              .api(`/sites/${this._siteId}/lists/${listId}/items/${itemId}`)
              .delete();

            this.logInfo(`Successfully deleted item ID: ${itemId} from list "${listTitle}"`);
            return true;
          } catch (error) {
            this.logError(`Error deleting item ID: ${itemId} from list "${listTitle}": ${error}`);
            throw error; // Пропагируем ошибку
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

            const listId = await this._listService.getListId(graphClient, listTitle);

            let request = graphClient
              .api(`/sites/${this._siteId}/lists/${listId}/items/${itemId}`);

            if (expandFields) {
              request = request.expand('fields');
            }

            const response = await request.get();

            this.logInfo(`Successfully retrieved item ID: ${itemId} from list "${listTitle}"`);

            // Assuming the response includes the item's id and fields
            return {
              id: DataTypeAdapter.toString(response.id),
              fields: (response as any).fields || {} // Access fields if present
            };
          } catch (error) {
            this.logError(`Error getting item ID: ${itemId} from list "${listTitle}": ${error}`);
            throw error; // Пропагируем ошибку
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