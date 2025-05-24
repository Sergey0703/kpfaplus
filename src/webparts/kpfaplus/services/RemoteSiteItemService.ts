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


public async getPaginatedListItems(
 graphClient: MSGraphClientV3,
 listTitle: string,
 options: IGetPaginatedListItemsOptions
): Promise<IRemotePaginatedItemsResponse> {
 try {
   const startTime = Date.now();
   console.log(`[DEBUG] *** getPaginatedListItems CALLED for: ${listTitle} ***`);
   console.log(`[DEBUG] *** Options:`, options);

   // Получаем ID списка
   const listId = await this._listService.getListId(graphClient, listTitle);
   console.log(`[DEBUG] List ID obtained: ${listId}`);

   const {
     expandFields = true,
     filter,
     orderBy,
     skip = 0,
     top = 60,
     nextLink,
   } = options;

   console.log(`[DEBUG] Parsed options:`, {
     expandFields,
     filter,
     orderBy,
     skip,
     top,
     nextLink
   });

   // Проверяем, что top имеет допустимое значение (60 или 90)
   const validatedTop = (top === 60 || top === 90) ? top : 60;

   let request;

   // Если передан nextLink, используем его напрямую
   if (nextLink) {
     console.log(`[DEBUG] Using provided nextLink for pagination`);
     request = graphClient.api(nextLink);
   } else {
     // Если nextLink не передан, формируем новый запрос
     request = graphClient
       .api(`/sites/${this._siteId}/lists/${listId}/items`)
       .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
       .header('ConsistencyLevel', 'eventual');

     // Применяем $select и $expand
     if (expandFields) {
       request = request.select('id,fields');
       request = request.expand('fields');
       console.log(`[DEBUG] Applying simple select/expand for list items`);
     } else {
       request = request.select('id');
       console.log(`[DEBUG] Applying minimal select 'id' as expandFields is false`);
     }

     // Обрабатываем фильтр
     if (filter) {
       console.log(`[DEBUG] Applying filter: ${filter}`);
       request = request.filter(filter);
     }

     // Обрабатываем сортировку
     if (orderBy) {
       const orderByString = `${orderBy.field} ${orderBy.ascending ? 'asc' : 'desc'}`;
       console.log(`[DEBUG] Applying orderby: ${orderByString}`);
       request = request.orderby(orderByString);
     }

     // Устанавливаем размер страницы (только top)
     request = request.top(validatedTop);
     console.log(`[DEBUG] Applying page size: top=${validatedTop}`);
   }

   console.log(`[DEBUG] Making paginated request for list "${listTitle}"`);
   let response;
   try {
     response = await request.get();
     console.log(`[DEBUG] Graph API response received successfully`);
   } catch (requestError) {
     console.error(`[ERROR] Graph API request failed:`, requestError);
     if (filter) {
       console.error(`[ERROR] Filter was: "${filter}"`);
     }
     if (orderBy) {
       console.error(`[ERROR] OrderBy was: "${orderBy.field} ${orderBy.ascending ? 'asc' : 'desc'}"`);
     }
     throw requestError;
   }

   // Извлекаем элементы из ответа Graph API
   const items = response?.value || [];
   const responseNextLink = response['@odata.nextLink'];
   
   console.log(`[DEBUG] Response items: ${items.length}, hasNextLink: ${!!responseNextLink}`);

// ПРОСТЫЕ ЛОГИ без map:
if (items.length > 0) {
  console.log(`[DEBUG] First item ID: ${items[0].id}`);
  console.log(`[DEBUG] Last item ID: ${items[items.length - 1].id}`);
  console.log(`[DEBUG] First item date: ${(items[0].fields as any)?.Date}`);
  console.log(`[DEBUG] Second item date: ${(items[1]?.fields as any)?.Date}`);
  console.log(`[DEBUG] Third item date: ${(items[2]?.fields as any)?.Date}`);
}
   // Получаем точное количество записей с сервера
   let totalCount = 0;

   // ВСЕГДА делаем отдельный запрос для получения точного количества
   try {
     console.log(`[DEBUG] Getting exact total count with $count=true`);
     
     const countRequest = graphClient
       .api(`/sites/${this._siteId}/lists/${listId}/items`)
       .header('ConsistencyLevel', 'eventual')
       .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly') // ← ДОБАВЛЕН HEADER!
       .count(true)
       .top(1); // Берем минимум записей, нас интересует только @odata.count

     // Применяем ТОТ ЖЕ фильтр, что и в основном запросе
     if (filter) {
       countRequest.filter(filter);
       console.log(`[DEBUG] Applied same filter to count request: ${filter}`);
     }
     
     const countResponse = await countRequest.get();
     totalCount = countResponse['@odata.count'];
     
     console.log(`[DEBUG] Count response:`, countResponse);
     console.log(`[DEBUG] @odata.count value:`, countResponse['@odata.count']);
     console.log(`[DEBUG] Exact total count from server: ${totalCount}`);
     
     if (totalCount === undefined || totalCount === null || isNaN(totalCount)) {
       throw new Error('Server did not return valid @odata.count');
     }
     
   } catch (countError) {
     console.error(`[ERROR] $count=true failed:`, countError);
     
     // Fallback: делаем запрос всех ID для подсчета
     try {
       console.log(`[DEBUG] Fallback: counting all items with select id only`);
       
       const fallbackRequest = graphClient
         .api(`/sites/${this._siteId}/lists/${listId}/items`)
         .select('id')
         .top(5000) // Увеличиваем лимит для подсчета
         .header('ConsistencyLevel', 'eventual')
         .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly'); // ← ДОБАВЛЕН HEADER!
         
       if (filter) {
         fallbackRequest.filter(filter);
         console.log(`[DEBUG] Applied same filter to fallback: ${filter}`);
       }
       
       console.log(`[DEBUG] Making fallback count request with HonorNonIndexedQueries header...`);
       const fallbackResponse = await fallbackRequest.get();
       const fallbackItems = fallbackResponse.value || [];
       const fallbackNextLink = fallbackResponse['@odata.nextLink'];
       
       console.log(`[DEBUG] Fallback response: ${fallbackItems.length} items, hasNextLink: ${!!fallbackNextLink}`);
       
       if (fallbackNextLink) {
         // Если есть nextLink, значит записей больше 5000
         console.log(`[WARNING] More than 5000 records found! Making additional requests to get exact count.`);
         
         // Рекурсивно получаем все страницы для точного подсчета
         let allItemsCount = fallbackItems.length;
         let currentNextLink = fallbackNextLink;
         
         while (currentNextLink && allItemsCount < 10000) { // Защита от бесконечного цикла
           try {
             const nextPageRequest = graphClient.api(currentNextLink);
             const nextPageResponse = await nextPageRequest.get();
             const nextPageItems = nextPageResponse.value || [];
             
             allItemsCount += nextPageItems.length;
             currentNextLink = nextPageResponse['@odata.nextLink'];
             
             console.log(`[DEBUG] Additional page: ${nextPageItems.length} items, total so far: ${allItemsCount}`);
             
             if (!currentNextLink) {
               break; // Достигнут конец
             }
           } catch (nextPageError) {
             console.error(`[ERROR] Error getting next page for count:`, nextPageError);
             break;
           }
         }
         
         totalCount = allItemsCount;
         console.log(`[DEBUG] Final exact count from all pages: ${totalCount}`);
         
       } else {
         // Нет nextLink - точное количество
         totalCount = fallbackItems.length;
         console.log(`[DEBUG] Exact fallback count: ${totalCount}`);
       }
       
     } catch (fallbackError) {
       console.error(`[ERROR] Fallback count also failed:`, fallbackError);
       console.log(`[DEBUG] Fallback error details:`, JSON.stringify(fallbackError, null, 2));
       
       // В крайнем случае используем информацию о наличии nextLink
       if (responseNextLink) {
         console.log(`[DEBUG] Has nextLink, so records > ${items.length}. Using minimum estimate.`);
         totalCount = items.length + 1; // Минимальная оценка
       } else {
         console.log(`[DEBUG] No nextLink, using current page size as totalCount.`);
         totalCount = items.length;
       }
     }
   }

   console.log(`[DEBUG] Final totalCount: ${totalCount}`);

   // Вычисляем диапазон записей для UI
   const rangeStart = skip + 1;
   const rangeEnd = skip + items.length;

   console.log(`[DEBUG] Range: ${rangeStart}-${rangeEnd} of ${totalCount}`);

   // Преобразуем полученные элементы в нужный формат IRemoteListItemResponse
   const paginatedItems: IRemoteListItemResponse[] = items.map((item: Record<string, unknown>) => {
     return {
       id: DataTypeAdapter.toString(item.id),
       fields: (item as Record<string, unknown>).fields as IRemoteListItemField || {},
       '@odata.etag': (item as Record<string, unknown>)['@odata.etag'] as string,
     };
   });

   const totalDuration = Date.now() - startTime;
   console.log(`[DEBUG] getPaginatedListItems completed in ${totalDuration}ms`);

   // Возвращаем объект с элементами для страницы, точным общим количеством и информацией о диапазоне
   const result = {
     items: paginatedItems,
     totalCount: totalCount,
     nextLink: responseNextLink,
     rangeStart: rangeStart,
     rangeEnd: rangeEnd
   };

   console.log(`[DEBUG] Final result:`, {
     itemsCount: result.items.length,
     totalCount: result.totalCount,
     hasNextLink: !!result.nextLink,
     rangeStart: result.rangeStart,
     rangeEnd: result.rangeEnd
   });

   return result;

 } catch (error) {
   console.error(`[ERROR] getPaginatedListItems failed for "${listTitle}":`, error);
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

          const listId = await this._listService.getListId(graphClient, listTitle);

          const response = await graphClient
            .api(`/sites/${this._siteId}/lists/${listId}/items`)
            .post({
              fields: options.fields
            });

          this.logInfo(`Successfully created item in list "${listTitle}" with ID: ${response?.id}`);

           // ИСПРАВЛЕНО: Assuming the response includes the created item's id and fields
          return {
            id: DataTypeAdapter.toString(response.id),
            fields: (response as Record<string, unknown>).fields as IRemoteListItemField || {} // Access fields if present
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

            // ИСПРАВЛЕНО: Assuming the response includes the item's id and fields
            return {
              id: DataTypeAdapter.toString(response.id),
              fields: (response as Record<string, unknown>).fields as IRemoteListItemField || {} // Access fields if present
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