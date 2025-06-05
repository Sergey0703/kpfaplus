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

           let allItems: Record<string, unknown>[] = [];
           let request = graphClient
             .api(`/sites/${this._siteId}/lists/${listId}/items`)
             .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
             .header('ConsistencyLevel', 'eventual');

           request = request.top(pageSize); // Limit items per page from Graph API

           // Применяем $select и $expand
           if (expandFields) {
             if (listTitle === 'StaffRecords') {
                // ИСПРАВЛЕНО: Для StaffRecords используем простой select и expand без вложенных полей
               request = request.select('id,fields');
               request = request.expand('fields');
               this.logInfo(`[DEBUG] Using simple select/expand for StaffRecords`);
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
    if (listTitle === 'StaffRecords') {
      // ИСПРАВЛЕНО: Для StaffRecords используем простой select и expand
      request = request.select('id,fields');
      request = request.expand('fields');
      console.log(`[DEBUG] Applying simple select/expand for StaffRecords`);
    } else {
      request = request.select('id,fields');
      request = request.expand('fields');
      console.log(`[DEBUG] Applying simple select/expand for list items`);
    }
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
  let allItems: Record<string, unknown>[] = response?.value || [];
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
      const deleted = (item.fields as IRemoteListItemField)?.Deleted;
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
    //console.log(`[DEBUG] First item date: ${(paginatedItems[0].fields as IRemoteListItemField)?.Date}`);
    if (paginatedItems.length > 1) {
    //  console.log(`[DEBUG] Second item date: ${(paginatedItems[1].fields as IRemoteListItemField)?.Date}`);
    }
    if (paginatedItems.length > 2) {
   //   console.log(`[DEBUG] Third item date: ${(paginatedItems[2].fields as IRemoteListItemField)?.Date}`);
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
  * Получает ВСЕ элементы списка с применением фильтра (специально для Timetable)
  * Автоматически загружает все страницы до получения полного набора данных
  * @param graphClient Graph клиент
  * @param listTitle Название списка
  * @param filter OData фильтр (например: "fields/Date ge '2024-12-01T00:00:00.000Z' and fields/Date le '2024-12-31T00:00:00.000Z' and fields/StaffGroupLookupId eq 54")
  * @param orderBy Сортировка (опционально)
  * @returns Promise с ВСЕМИ отфильтрованными элементами
  */
 /**
  * Получает ВСЕ элементы списка с применением фильтра (специально для Timetable)
  * Автоматически загружает все страницы до получения полного набора данных
  * @param graphClient Graph клиент
  * @param listTitle Название списка
  * @param filter OData фильтр (например: "fields/Date ge '2024-12-01T00:00:00.000Z' and fields/Date le '2024-12-31T00:00:00.000Z' and fields/StaffGroupLookupId eq 54")
  * @param orderBy Сортировка (опционально)
  * @returns Promise с ВСЕМИ отфильтрованными элементами
  */
 public async getAllFilteredItemsForTimetable(
   graphClient: MSGraphClientV3,
   listTitle: string,
   filter: string,
   orderBy?: { field: string; ascending: boolean }
 ): Promise<{ items: IRemoteListItemResponse[]; totalCount: number }> {
   try {
     const startTime = Date.now();
     console.log(`[DEBUG] *** getAllFilteredItemsForTimetable CALLED for: ${listTitle} ***`);
     console.log(`[DEBUG] *** AUTOMATIC COMPLETE DATA LOADING MODE ***`);
     console.log(`[DEBUG] Filter: ${filter}`);
     console.log(`[DEBUG] OrderBy:`, orderBy);

     // Получаем ID списка
     const listId = await this._listService.getListId(graphClient, listTitle);
     console.log(`[DEBUG] List ID obtained: ${listId}`);

     // Параметры для автоматической загрузки всех данных
     const pageSize = 1000; // Размер одной страницы для Graph API
     const maxTotalItems = 10000; // Защита от слишком больших наборов данных
     
     let allItems: Record<string, unknown>[] = [];
     let currentPageNumber = 1;
     let hasMorePages = true;
     let nextLink: string | undefined = undefined;

     // Цикл автоматической загрузки всех страниц
     while (hasMorePages && allItems.length < maxTotalItems) {
       console.log(`[DEBUG] Loading page ${currentPageNumber} (${allItems.length} items loaded so far)...`);
       
       // Строим запрос для текущей страницы
       let request = graphClient
         .api(`/sites/${this._siteId}/lists/${listId}/items`)
         .header('Prefer', 'HonorNonIndexedQueriesWarningMayFailRandomly')
         .header('ConsistencyLevel', 'eventual')
         .top(pageSize);

       // Применяем специфичные настройки для StaffRecords
       if (listTitle === 'StaffRecords') {
         // ИСПРАВЛЕНО: Для StaffRecords используем простой select и expand
         request = request.select('id,fields');
         request = request.expand('fields');
         console.log(`[DEBUG] Applied simple select/expand for StaffRecords`);
       } else {
         request = request.select('id,fields');
         request = request.expand('fields');
         console.log(`[DEBUG] Applied simple select/expand for ${listTitle}`);
       }

       // Применяем фильтр
       if (filter) {
         request = request.filter(filter);
         console.log(`[DEBUG] Applied filter for page ${currentPageNumber}: ${filter}`);
       }

       // Применяем сортировку
       if (orderBy) {
         const orderByString = `${orderBy.field} ${orderBy.ascending ? 'asc' : 'desc'}`;
         request = request.orderby(orderByString);
         console.log(`[DEBUG] Applied orderBy for page ${currentPageNumber}: ${orderByString}`);
       }

       // Если есть nextLink от предыдущей страницы, используем его
       if (nextLink) {
         console.log(`[DEBUG] Using nextLink for page ${currentPageNumber}`);
         request = graphClient.api(nextLink);
       }

       // Выполняем запрос
       const pageStartTime = Date.now();
       let response;
       
       try {
         response = await request.get();
         const pageDuration = Date.now() - pageStartTime;
         console.log(`[DEBUG] Page ${currentPageNumber} request completed in ${pageDuration}ms`);
       } catch (requestError) {
         console.error(`[ERROR] Failed to load page ${currentPageNumber}:`, requestError);
         console.error(`[ERROR] Filter was: "${filter}"`);
         if (orderBy) {
           console.error(`[ERROR] OrderBy was: "${orderBy.field} ${orderBy.ascending ? 'asc' : 'desc'}"`);
         }
         throw requestError;
       }

       // === ДОБАВЛЯЕМ ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ОТВЕТА SHAREPOINT ===
       console.log('=== SHAREPOINT RESPONSE DEBUG ===');
       console.log('[DEBUG] ОТВЕТ ОТ SHAREPOINT для фильтра:', filter);
       console.log('[DEBUG] Количество найденных записей на странице:', response?.value?.length || 0);
       console.log('[DEBUG] Общее количество загруженных записей:', allItems.length);

       if (response?.value && response.value.length > 0) {
         console.log('[DEBUG] Первая найденная запись на этой странице:', JSON.stringify(response.value[0], null, 2));
         
         // Проверяем поле Date в первой записи
         const firstRecord = response.value[0];
         if (firstRecord.fields && firstRecord.fields.Date) {
           console.log('[DEBUG] Дата в первой записи (сырая):', firstRecord.fields.Date);
           console.log('[DEBUG] Тип даты:', typeof firstRecord.fields.Date);
           console.log('[DEBUG] Дата как Date объект:', new Date(firstRecord.fields.Date));
           console.log('[DEBUG] Дата в ISO формате:', new Date(firstRecord.fields.Date).toISOString());
         }
         
         // Проверяем другие важные поля
         if (firstRecord.fields) {
           console.log('[DEBUG] StaffMemberLookupId:', firstRecord.fields.StaffMemberLookupId);
           console.log('[DEBUG] ManagerLookupId:', firstRecord.fields.ManagerLookupId);
           console.log('[DEBUG] StaffGroupLookupId:', firstRecord.fields.StaffGroupLookupId);
           console.log('[DEBUG] Deleted:', firstRecord.fields.Deleted);
         }

         // Показываем еще несколько записей если есть
         if (response.value.length > 1) {
           console.log('[DEBUG] Вторая запись ID:', response.value[1].id);
           if (response.value[1].fields?.Date) {
             console.log('[DEBUG] Вторая запись дата:', response.value[1].fields.Date);
           }
         }
         if (response.value.length > 2) {
           console.log('[DEBUG] Третья запись ID:', response.value[2].id);
           if (response.value[2].fields?.Date) {
             console.log('[DEBUG] Третья запись дата:', response.value[2].fields.Date);
           }
         }
       } else {
         console.log('[DEBUG] ❌ ЗАПИСИ НЕ НАЙДЕНЫ на этой странице для фильтра:', filter);
         console.log('[DEBUG] Возможные причины:');
         console.log('[DEBUG] 1. Неправильный диапазон дат');
         console.log('[DEBUG] 2. Неправильные ID (StaffMember/Manager/StaffGroup)');
         console.log('[DEBUG] 3. Записи помечены как удаленные');
         console.log('[DEBUG] 4. Нет данных в SharePoint для этого фильтра');
       }

       // Тест сравнения дат (только на первой странице)
       if (currentPageNumber === 1) {
         console.log('[DEBUG] === ТЕСТ СРАВНЕНИЯ ДАТ ===');
         console.log('[DEBUG] Фильтр ищет >= 2024-09-30T23:59:59.999Z');
         console.log('[DEBUG] Ожидаем найти записи с датой 2024-10-01T00:00:00.000Z');
         console.log('[DEBUG] Сравнение: 2024-10-01T00:00:00.000Z > 2024-09-30T23:59:59.999Z =', 
           new Date('2024-10-01T00:00:00.000Z') > new Date('2024-09-30T23:59:59.999Z'));
         
         // Проверяем разные временные зоны
         console.log('[DEBUG] === ПРОВЕРКА ВРЕМЕННЫХ ЗОН ===');
         console.log('[DEBUG] UTC: 2024-10-01T00:00:00.000Z');
         console.log('[DEBUG] Ирландское время: 2024-10-01T01:00:00.000Z (UTC+1)');
         console.log('[DEBUG] Проверяем: 2024-10-01T01:00:00.000Z > 2024-09-30T23:59:59.999Z =',
           new Date('2024-10-01T01:00:00.000Z') > new Date('2024-09-30T23:59:59.999Z'));
       }
       console.log('=== END DEBUG ===');

       // Обрабатываем ответ
       const pageItems = response?.value || [];
       allItems = [...allItems, ...pageItems];
       nextLink = response['@odata.nextLink'];
       
       console.log(`[DEBUG] Page ${currentPageNumber}: loaded ${pageItems.length} items, total: ${allItems.length}, hasNextLink: ${!!nextLink}`);

       // Проверяем, есть ли еще страницы
       if (!nextLink || pageItems.length === 0) {
         hasMorePages = false;
         console.log(`[DEBUG] No more pages - all filtered data loaded`);
       } else if (allItems.length >= maxTotalItems) {
         hasMorePages = false;
         console.warn(`[WARNING] Reached maxTotalItems limit (${maxTotalItems}) - stopping load`);
       }

       currentPageNumber++;

       // Защита от бесконечного цикла (максимум 50 страниц)
       if (currentPageNumber > 50) {
         hasMorePages = false;
         console.warn(`[WARNING] Reached maximum page limit (50) - stopping load`);
       }
     }

     const totalDuration = Date.now() - startTime;
     console.log(`[DEBUG] *** getAllFilteredItemsForTimetable COMPLETED ***`);
     console.log(`[DEBUG] Total performance:`, {
       totalItems: allItems.length,
       totalPages: currentPageNumber - 1,
       totalDurationMs: totalDuration,
       avgItemsPerPage: Math.round(allItems.length / (currentPageNumber - 1)),
       avgPageDurationMs: Math.round(totalDuration / (currentPageNumber - 1))
     });

     // Дополнительная диагностика если ничего не найдено
     if (allItems.length === 0) {
       console.log('[DEBUG] === ДИАГНОСТИКА ПУСТОГО РЕЗУЛЬТАТА ===');
       console.log('[DEBUG] Полный фильтр который использовался:', filter);
       console.log('[DEBUG] Список:', listTitle);
       console.log('[DEBUG] ID списка:', listId);
       console.log('[DEBUG] Рекомендации:');
       console.log('[DEBUG] 1. Проверьте данные в SharePoint вручную');
       console.log('[DEBUG] 2. Попробуйте упростить фильтр (только по дате)');
       console.log('[DEBUG] 3. Проверьте правильность ID полей');
       console.log('[DEBUG] ===================================');
     }

     // Преобразуем все элементы в нужный формат
     const formattedItems: IRemoteListItemResponse[] = allItems.map((item: Record<string, unknown>) => {
       return {
         id: DataTypeAdapter.toString(item.id),
         fields: (item as Record<string, unknown>).fields as IRemoteListItemField || {},
         '@odata.etag': (item as Record<string, unknown>)['@odata.etag'] as string,
       };
     });

     // Финальная диагностика данных
     if (formattedItems.length > 0) {
       console.log(`[DEBUG] Sample of loaded data:`);
       console.log(`[DEBUG] First item ID: ${formattedItems[0].id}`);
       console.log(`[DEBUG] Last item ID: ${formattedItems[formattedItems.length - 1].id}`);
       
       if (listTitle === 'StaffRecords') {
         const firstDate = (formattedItems[0].fields as IRemoteListItemField)?.Date;
         const lastDate = (formattedItems[formattedItems.length - 1].fields as IRemoteListItemField)?.Date;
         console.log(`[DEBUG] Date range: ${firstDate} to ${lastDate}`);
         
         // Анализ уникальных StaffMemberLookupId
         const uniqueStaffIds = new Set();
         formattedItems.forEach(item => {
           const staffId = (item.fields as IRemoteListItemField)?.StaffMemberLookupId;
           if (staffId) uniqueStaffIds.add(staffId);
         });
         console.log(`[DEBUG] Unique staff members in data: ${uniqueStaffIds.size}`);
         console.log(`[DEBUG] Staff IDs: ${Array.from(uniqueStaffIds).slice(0, 10).join(', ')}${uniqueStaffIds.size > 10 ? '...' : ''}`);
       }
     }

     return {
       items: formattedItems,
       totalCount: formattedItems.length
     };

   } catch (error) {
     console.error(`[ERROR] getAllFilteredItemsForTimetable failed for "${listTitle}":`, error);
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
             if (listTitle === 'StaffRecords') {
               // ИСПРАВЛЕНО: Для StaffRecords используем простой expand
               request = request.expand('fields');
               this.logInfo(`[DEBUG] Applied simple expand for single StaffRecords item`);
             } else {
               request = request.expand('fields');
             }
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