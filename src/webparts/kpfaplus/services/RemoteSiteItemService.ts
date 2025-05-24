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
              pageSize = 1000, // Увеличенный размер страницы для лучшей производительности
              maxItems = 10000 // Увеличенный лимит для больших списков
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
   console.log(`[DEBUG] *** CLIENT-SIDE PAGINATION MODE ***`);
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
     showDeleted = false, // ← ДОБАВЛЕН ПАРАМЕТР showDeleted
   } = options;

   console.log(`[DEBUG] Parsed options:`, {
     expandFields,
     filter,
     orderBy,
     skip,
     top,
     nextLink,
     showDeleted, // ← ДОБАВЛЕН В ЛОГИРОВАНИЕ
     clientSidePagination: true
   });

   // Проверяем, что top имеет допустимое значение (60 или 90)
   const validatedTop = (top === 60 || top === 90) ? top : 60;

   // *** КЛИЕНТСКАЯ ПАГИНАЦИЯ: Загружаем все данные за раз ***
   // Устанавливаем большой размер страницы для загрузки всех записей месяца
   const serverPageSize = 3000; // Увеличено для больших объемов данных StaffRecords + запас

   let request = graphClient
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

   // *** ЗАГРУЖАЕМ ВСЕ ДАННЫЕ С СЕРВЕРА ***
   request = request.top(serverPageSize);
   console.log(`[DEBUG] Loading all data from server: top=${serverPageSize} (client-side pagination)`);

   console.log(`[DEBUG] Making request to load all data for list "${listTitle}"`);
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

   // Извлекаем ВСЕ элементы из ответа Graph API
   let allItems = response?.value || [];
   const responseNextLink = response['@odata.nextLink'];
   
   console.log(`[DEBUG] Initial response: ${allItems.length} items, hasNextLink: ${!!responseNextLink}`);

   // Если есть nextLink, загружаем остальные страницы
   if (responseNextLink) {
     console.log(`[DEBUG] Loading additional pages using nextLink...`);
     let currentNextLink = responseNextLink;
     let pageNumber = 2;
     
     while (currentNextLink && allItems.length < 5000) { // Защита от бесконечного цикла
       try {
         console.log(`[DEBUG] Loading page ${pageNumber} using nextLink`);
         const nextPageResponse = await graphClient.api(currentNextLink).get();
         const nextPageItems = nextPageResponse?.value || [];
         
         allItems = [...allItems, ...nextPageItems];
         currentNextLink = nextPageResponse['@odata.nextLink'];
         
         console.log(`[DEBUG] Page ${pageNumber}: loaded ${nextPageItems.length} items, total: ${allItems.length}`);
         
         if (!currentNextLink) {
           console.log(`[DEBUG] No more pages - all data loaded`);
           break;
         }
         
         pageNumber++;
       } catch (nextPageError) {
         console.error(`[ERROR] Error loading page ${pageNumber}:`, nextPageError);
         break;
       }
     }
   }

   console.log(`[DEBUG] Total items loaded from server: ${allItems.length}`);

   // *** ДОБАВЛЕНА КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ ПО DELETED ***
   const filteredItems = allItems;

   /*if (!showDeleted) {
     // Фильтруем - показываем только неудаленные записи (Deleted = 0, null, undefined, или false)
     filteredItems = allItems.filter((item: Record<string, unknown>) => {
       const deleted = (item.fields as any)?.Deleted;
       // Считаем запись удаленной, если Deleted = 1 или '1' или true
       const isDeleted = deleted === 1 || deleted === '1' || deleted === true;
       return !isDeleted;
     });
     console.log(`[DEBUG] Client-side filtering applied: ${allItems.length} total -> ${filteredItems.length} non-deleted records`);
   } else {
     console.log(`[DEBUG] Show Deleted is ON - showing all records including deleted: ${allItems.length}`);
   } */

   // *** КЛИЕНТСКАЯ ПАГИНАЦИЯ: Выбираем нужную страницу ИЗ ОТФИЛЬТРОВАННЫХ ДАННЫХ ***
   const totalCount = filteredItems.length; // Используем количество отфильтрованных записей
   const startIndex = skip;
   const endIndex = Math.min(skip + validatedTop, totalCount);
   
   console.log(`[DEBUG] Client-side pagination on filtered data: skip=${skip}, top=${validatedTop}`);
   console.log(`[DEBUG] Filtered array slice: startIndex=${startIndex}, endIndex=${endIndex}, totalFiltered=${totalCount}`);
   
   // Получаем только записи для текущей страницы ИЗ ОТФИЛЬТРОВАННЫХ данных
   const paginatedItems = filteredItems.slice(startIndex, endIndex);
   
   console.log(`[DEBUG] Client-paginated result: ${paginatedItems.length} items for current page`);

   // Логируем информацию о первых элементах страницы
   if (paginatedItems.length > 0) {
     console.log(`[DEBUG] First item on page - ID: ${paginatedItems[0].id}`);
     console.log(`[DEBUG] Last item on page - ID: ${paginatedItems[paginatedItems.length - 1].id}`);
     //console.log(`[DEBUG] First item date: ${(paginatedItems[0].fields as any)?.Date}`);
     if (paginatedItems.length > 1) {
     //  console.log(`[DEBUG] Second item date: ${(paginatedItems[1].fields as any)?.Date}`);
     }
     if (paginatedItems.length > 2) {
    //   console.log(`[DEBUG] Third item date: ${(paginatedItems[2].fields as any)?.Date}`);
     }
   }

   // Вычисляем диапазон записей для UI
   const rangeStart = startIndex + 1;
   const rangeEnd = startIndex + paginatedItems.length;

   console.log(`[DEBUG] Range: ${rangeStart}-${rangeEnd} of ${totalCount}`);

   // Преобразуем элементы текущей страницы в нужный формат IRemoteListItemResponse
   const formattedItems: IRemoteListItemResponse[] = paginatedItems.map((item: Record<string, unknown>) => {
     return {
       id: DataTypeAdapter.toString(item.id),
       fields: (item as Record<string, unknown>).fields as IRemoteListItemField || {},
       '@odata.etag': (item as Record<string, unknown>)['@odata.etag'] as string,
     };
   });

   const totalDuration = Date.now() - startTime;
   console.log(`[DEBUG] getPaginatedListItems completed in ${totalDuration}ms`);

   // Определяем, есть ли следующая страница (для UI кнопки Next)
   const hasNextPage = endIndex < totalCount;

   // Возвращаем объект с элементами для страницы и точным общим количеством
   const result = {
     items: formattedItems,
     totalCount: totalCount,
     nextLink: hasNextPage ? 'client-side-pagination' : undefined, // Флаг для UI
     rangeStart: rangeStart,
     rangeEnd: rangeEnd
   };

   console.log(`[DEBUG] Final result:`, {
     itemsCount: result.items.length,
     totalCount: result.totalCount,
     hasNextPage: hasNextPage,
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