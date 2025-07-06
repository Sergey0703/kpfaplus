// src/webparts/kpfaplus/services/StaffRecordsFetchService.ts
import { RemoteSiteService } from "./RemoteSiteService";
import {
  IStaffRecordsQueryParams,
  IRawStaffRecord,
} from "./StaffRecordsInterfaces";

// Импортируем IRemotePaginatedItemsResponse из RemoteSiteInterfaces.ts
import { IRemotePaginatedItemsResponse, IRemoteListItemResponse } from "./RemoteSiteInterfaces";

// Определяем возвращаемый тип fetchStaffRecords как IRemotePaginatedItemsResponse
type IFetchStaffRecordsResult = IRemotePaginatedItemsResponse;

/**
 * Сервис для получения записей сотрудников из SharePoint
 * Отвечает за формирование запросов, фильтров и получение данных через API
 * 
 * ОБНОВЛЕНО: Поле Date теперь Date-only (без времени)
 * УДАЛЕНО: Поддержка полей ShiftDate1-4 (больше не используются)
 * ОБНОВЛЕНО: Добавлена поддержка числовых полей времени для ScheduleTab
 */
export class StaffRecordsFetchService {
  private _remoteSiteService: RemoteSiteService;
  private _listName: string;
  private _logSource: string;

  /**
   * Конструктор сервиса получения данных о записях персонала
   * @param remoteSiteService Сервис для работы с удаленным сайтом
   * @param listName Название списка в SharePoint
   * @param logSource Префикс для логов
   */
  constructor(
    remoteSiteService: RemoteSiteService,
    listName: string,
    logSource: string
  ) {
    this._remoteSiteService = remoteSiteService;
    this._listName = listName;
    this._logSource = logSource + ".Fetch";
    this.logInfo("StaffRecordsFetchService инициализирован с Date-only полями и числовыми полями времени");
  }

  /**
   * Получает записи расписания персонала из SharePoint с поддержкой пагинации.
   * Использует метод getPaginatedItemsFromList из RemoteSiteService.
   * ОБНОВЛЕНО: Поле Date теперь Date-only, числовые поля времени получаются
   *
   * @param queryParams Параметры запроса, включая skip и top для пагинации, а также filter и orderBy
   * @returns Promise с объектом IRemotePaginatedItemsResponse, содержащим массив сырых записей для страницы и общее количество
   */
  public async fetchStaffRecords(
    queryParams: IStaffRecordsQueryParams
  ): Promise<IFetchStaffRecordsResult> {
    try {
      const {
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeID,
        timeTableID,
        skip, // Параметры пагинации
        top,  // Параметры пагинации
      } = queryParams;

      // Расширенное логирование параметров запроса, включая пагинацию
      this.logInfo(
        `[DEBUG] fetchStaffRecords ВЫЗВАН С ПАРАМЕТРАМИ (с Date-only и числовыми полями времени):` +
        `\n  startDate: ${startDate.toISOString()}` +
        `\n  endDate: ${endDate.toISOString()}` +
        `\n  currentUserID: ${currentUserID} (тип: ${typeof currentUserID})` +
        `\n  staffGroupID: ${staffGroupID} (тип: ${typeof staffGroupID})` +
        `\n  employeeID: ${employeeID} (тип: ${typeof employeeID})` +
        `\n  timeTableID: ${timeTableID || "не указан"} (тип: ${typeof timeTableID})` +
        `\n  skip: ${skip !== undefined ? skip : 'не указан'}` + // Логирование skip
        `\n  top: ${top !== undefined ? top : 'не указан'}`    // Логирование top
      );

      // Проверяем наличие RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError("[ОШИБКА] RemoteSiteService не инициализирован");
        // Возвращаем пустой результат в случае ошибки сервиса
        return { 
          items: [], 
          totalCount: 0,
          rangeStart: 0, // Добавляем новые свойства
          rangeEnd: 0    // Добавляем новые свойства
        };
      }

      // Проверка имени списка
      if (!this._listName) {
        const errorMsg = "Имя списка не определено";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg); // Бросаем ошибку, если имя списка не определено
      }

      // ОБНОВЛЕНО: Даты уже в правильном формате Date-only, используем без дополнительного форматирования
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      this.logInfo(
        `[DEBUG] Форматированные даты для запроса (Date-only): ${startDateStr} - ${endDateStr}`
      );

      // Проверка валидности дат после форматирования
      if (startDateStr === '' || endDateStr === '') {
        const errorMsg = "Некорректные даты начала/окончания периода";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Строим фильтр для запроса к SharePoint
      const filter = this.buildFilterExpression(
        startDateStr,
        endDateStr,
        employeeID,
        staffGroupID,
        currentUserID,
        timeTableID
      );
      this.logInfo(`[DEBUG] ИТОГОВЫЙ ФИЛЬТР: ${filter}`);

      // Определяем параметры сортировки по умолчанию (по дате)
      const orderBy = { field: "fields/Date", ascending: true };

      // --- ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД RemoteSiteService.getPaginatedItemsFromList ---
      this.logInfo(`[DEBUG] НАЧИНАЕМ запрос к списку ${this._listName} с пагинацией через RemoteSiteService (включая числовые поля времени)...`);

      let fetchResult: IRemotePaginatedItemsResponse; // Используем импортированный тип
      try {
        // Вызываем новый публичный метод RemoteSiteService.getPaginatedItemsFromList
        fetchResult = await this._remoteSiteService.getPaginatedItemsFromList(
          this._listName,
          { // Передаем опции в формате IGetPaginatedListItemsOptions
            expandFields: true, // Расширять поля для маппинга в StaffRecordsService (включает числовые поля времени)
            filter: filter,
            orderBy: orderBy,
            skip: skip || 0, // Передаем skip (по умолчанию 0 если не указан)
            top: top || 60, // Передаем top (по умолчанию 60 если не указан, или размер страницы по умолчанию)
            nextLink: queryParams.nextLink // Передаем nextLink, если он есть
          }
        );

        this.logInfo(
          `[DEBUG] ПОЛУЧЕН ответ от RemoteSiteService.getPaginatedItemsFromList: ${fetchResult.items.length} элементов на странице, ОБЩЕЕ количество: ${fetchResult.totalCount}`
        );
      } catch (requestError) {
        this.logError(
          `[ОШИБКА] Ошибка при запросе к списку с пагинацией через RemoteSiteService: ${JSON.stringify(requestError)}`
        );
        throw requestError; // Пробрасываем ошибку дальше
      }

      // Логирование результата запроса с проверкой числовых полей времени
      this.logInfo(
        `Получено ${fetchResult.items.length} элементов расписания из SharePoint для текущей страницы (сырые данные с числовыми полями времени)`
      );
      if (fetchResult.items.length > 0) {
        // Логируем первый элемент сырых данных с проверкой числовых полей
        this.logDetailedDataInfoWithNumericFields(fetchResult.items[0]);
      } else {
        this.logInfo(
          `[DEBUG] Нет элементов в ответе от сервера для фильтра: ${filter} с skip=${skip}, top=${top}`
        );
      }

      // Возвращаем объект с сырыми записями для страницы и общим количеством.
      // StaffRecordsService будет ответственен за маппинг IRawStaffRecord в IStaffRecord.
      return {
        items: fetchResult.items,
        totalCount: fetchResult.totalCount,
        nextLink: fetchResult.nextLink,
        rangeStart: fetchResult.rangeStart || (skip || 0) + 1, // Используем значения из fetchResult или вычисляем
        rangeEnd: fetchResult.rangeEnd || (skip || 0) + fetchResult.items.length // Используем значения из fetchResult или вычисляем
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(
        `[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить записи расписания: ${errorMessage}`
      );
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

      // В случае ошибки, пробрасываем ее дальше
      throw new Error(`Failed to fetch staff records: ${errorMessage}`);
    }
  }
  /**
   * --- НОВЫЙ МЕТОД ДЛЯ TIMETABLE ---
   * Получает ВСЕ записи расписания персонала за период БЕЗ ПАГИНАЦИИ.
   * Использует getAllFilteredItemsFromList вместо getPaginatedItemsFromList.
   * ОБНОВЛЕНО: Поле Date теперь Date-only, включает поддержку числовых полей времени
   *
   * @param queryParams Параметры запроса (без skip/top - не нужны)
   * @returns Promise с объектом содержащим ВСЕ записи и общее количество
   */
  public async fetchAllStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ items: IRemoteListItemResponse[], totalCount: number }> {
    try {
      const {
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeID,
        timeTableID
      } = queryParams;

      // Расширенное логирование параметров запроса
      this.logInfo(
        `[DEBUG] fetchAllStaffRecordsForTimetable ВЫЗВАН С ПАРАМЕТРАМИ (с Date-only и числовыми полями времени):` +
        `\n  startDate: ${startDate.toISOString()}` +
        `\n  endDate: ${endDate.toISOString()}` +
        `\n  currentUserID: ${currentUserID} (тип: ${typeof currentUserID})` +
        `\n  staffGroupID: ${staffGroupID} (тип: ${typeof staffGroupID})` +
        `\n  employeeID: ${employeeID} (тип: ${typeof employeeID})` +
        `\n  timeTableID: ${timeTableID || "не указан"} (тип: ${typeof timeTableID})` +
        `\n  NOTE: БЕЗ ПАГИНАЦИИ - загружаем ВСЕ данные за период (включая числовые поля времени)`
      );

      // Проверяем наличие RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError("[ОШИБКА] RemoteSiteService не инициализирован");
        return { items: [], totalCount: 0 };
      }

      // Проверка имени списка
      if (!this._listName) {
        const errorMsg = "Имя списка не определено";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // ОБНОВЛЕНО: Даты уже в правильном формате Date-only, используем без дополнительного форматирования
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      this.logInfo(
        `[DEBUG] Форматированные даты для запроса (Date-only): ${startDateStr} - ${endDateStr}`
      );

      // Проверка валидности дат после форматирования
      if (startDateStr === '' || endDateStr === '') {
        const errorMsg = "Некорректные даты начала/окончания периода";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Строим фильтр для запроса к SharePoint
      const filter = this.buildFilterExpression(
        startDateStr,
        endDateStr,
        employeeID,
        staffGroupID,
        currentUserID,
        timeTableID
      );
      this.logInfo(`[DEBUG] ИТОГОВЫЙ ФИЛЬТР: ${filter}`);

      // Определяем параметры сортировки по умолчанию (по дате)
      const orderBy = { field: "fields/Date", ascending: true };

      // --- ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД RemoteSiteService.getAllFilteredItemsFromList ---
      this.logInfo(`[DEBUG] НАЧИНАЕМ запрос к списку ${this._listName} БЕЗ пагинации через RemoteSiteService (включая числовые поля времени)...`);

      let fetchResult: { items: IRemoteListItemResponse[], totalCount: number };
      try {
        // Вызываем новый метод RemoteSiteService.getAllFilteredItemsFromList
        fetchResult = await this._remoteSiteService.getAllFilteredItemsFromList(
          this._listName,
          filter,
          orderBy
        );

        this.logInfo(
          `[DEBUG] ПОЛУЧЕН ответ от RemoteSiteService.getAllFilteredItemsFromList: ${fetchResult.items.length} элементов, ОБЩЕЕ количество: ${fetchResult.totalCount}`
        );
      } catch (requestError) {
        this.logError(
          `[ОШИБКА] Ошибка при запросе ко всем элементам списка через RemoteSiteService: ${JSON.stringify(requestError)}`
        );
        throw requestError;
      }

      // Логирование результата запроса
      this.logInfo(
        `Получено ${fetchResult.items.length} элементов расписания из SharePoint (ВСЕ данные за период с числовыми полями времени)`
      );
      if (fetchResult.items.length > 0) {
        // Логируем первый элемент сырых данных с проверкой числовых полей
        this.logDetailedDataInfoWithNumericFields(fetchResult.items[0]);
      } else {
        this.logInfo(
          `[DEBUG] Нет элементов в ответе от сервера для фильтра: ${filter}`
        );
      }

      // Возвращаем объект с ВСЕ записями и общим количеством
      return {
        items: fetchResult.items,
        totalCount: fetchResult.totalCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(
        `[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить все записи расписания: ${errorMessage}`
      );
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

      // В случае ошибки, пробрасываем ее дальше
      throw new Error(`Failed to fetch all staff records: ${errorMessage}`);
    }
  }

  /**
   * --- НОВЫЙ МЕТОД ДЛЯ TIMETABLE С ФИЛЬТРАЦИЕЙ УДАЛЕННЫХ ЗАПИСЕЙ ---
   * Получает ВСЕ активные записи расписания персонала за период БЕЗ ПАГИНАЦИИ.
   * Исключает записи с Deleted=1.
   * Использует getAllFilteredItemsFromList вместо getPaginatedItemsFromList.
   * ОБНОВЛЕНО: Поле Date теперь Date-only, включает поддержку числовых полей времени
   *
   * @param queryParams Параметры запроса (без skip/top - не нужны)
   * @returns Promise с объектом содержащим ВСЕ активные записи и общее количество
   */
  public async fetchAllActiveStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ items: IRemoteListItemResponse[], totalCount: number }> {
    try {
      const {
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeID,
        timeTableID
      } = queryParams;

      // Расширенное логирование параметров запроса
      this.logInfo(
        `[DEBUG] fetchAllActiveStaffRecordsForTimetable ВЫЗВАН С ПАРАМЕТРАМИ (с Date-only и числовыми полями времени):` +
        `\n  startDate: ${startDate.toISOString()}` +
        `\n  endDate: ${endDate.toISOString()}` +
        `\n  currentUserID: ${currentUserID} (тип: ${typeof currentUserID})` +
        `\n  staffGroupID: ${staffGroupID} (тип: ${typeof staffGroupID})` +
        `\n  employeeID: ${employeeID} (тип: ${typeof employeeID})` +
        `\n  timeTableID: ${timeTableID || "не указан"} (тип: ${typeof timeTableID})` +
        `\n  NOTE: БЕЗ ПАГИНАЦИИ - загружаем ВСЕ АКТИВНЫЕ данные за период (исключая Deleted=1, включая числовые поля времени)`
      );

      // Проверяем наличие RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError("[ОШИБКА] RemoteSiteService не инициализирован");
        return { items: [], totalCount: 0 };
      }

      // Проверка имени списка
      if (!this._listName) {
        const errorMsg = "Имя списка не определено";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // ОБНОВЛЕНО: Даты уже в правильном формате Date-only, используем без дополнительного форматирования
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      this.logInfo(
        `[DEBUG] Форматированные даты для запроса (Date-only): ${startDateStr} - ${endDateStr}`
      );

      // Проверка валидности дат после форматирования
      if (startDateStr === '' || endDateStr === '') {
        const errorMsg = "Некорректные даты начала/окончания периода";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Строим фильтр для запроса к SharePoint с исключением удаленных записей
      const filter = this.buildFilterExpressionExcludingDeleted(
        startDateStr,
        endDateStr,
        employeeID,
        staffGroupID,
        currentUserID,
        timeTableID
      );
      this.logInfo(`[DEBUG] ИТОГОВЫЙ ФИЛЬТР С ИСКЛЮЧЕНИЕМ DELETED=1: ${filter}`);

      // Определяем параметры сортировки по умолчанию (по дате)
      const orderBy = { field: "fields/Date", ascending: true };

      // --- ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД RemoteSiteService.getAllFilteredItemsFromList ---
      this.logInfo(`[DEBUG] НАЧИНАЕМ запрос к списку ${this._listName} БЕЗ пагинации и БЕЗ DELETED записей через RemoteSiteService (включая числовые поля времени)...`);

      let fetchResult: { items: IRemoteListItemResponse[], totalCount: number };
      try {
        // Вызываем новый метод RemoteSiteService.getAllFilteredItemsFromList
        fetchResult = await this._remoteSiteService.getAllFilteredItemsFromList(
          this._listName,
          filter,
          orderBy
        );

        this.logInfo(
          `[DEBUG] ПОЛУЧЕН ответ от RemoteSiteService.getAllFilteredItemsFromList: ${fetchResult.items.length} АКТИВНЫХ элементов, ОБЩЕЕ количество: ${fetchResult.totalCount}`
        );
      } catch (requestError) {
        this.logError(
          `[ОШИБКА] Ошибка при запросе ко всем активным элементам списка через RemoteSiteService: ${JSON.stringify(requestError)}`
        );
        throw requestError;
      }

      // Логирование результата запроса
      this.logInfo(
        `Получено ${fetchResult.items.length} АКТИВНЫХ элементов расписания из SharePoint (исключены Deleted=1, включены числовые поля времени)`
      );
      if (fetchResult.items.length > 0) {
        // Логируем первый элемент сырых данных с проверкой числовых полей
        this.logDetailedDataInfoWithNumericFields(fetchResult.items[0]);
      } else {
        this.logInfo(
          `[DEBUG] Нет активных элементов в ответе от сервера для фильтра: ${filter}`
        );
      }

      // Возвращаем объект с ВСЕ активными записями и общим количеством
      return {
        items: fetchResult.items,
        totalCount: fetchResult.totalCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(
        `[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить все активные записи расписания: ${errorMessage}`
      );
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

      // В случае ошибки, пробрасываем ее дальше
      throw new Error(`Failed to fetch all active staff records: ${errorMessage}`);
    }
  }

  /**
   * НОВЫЙ МЕТОД ДЛЯ SRS REPORTS: Получает записи с заполненным типом отпуска
   * Базируется на fetchAllActiveStaffRecordsForTimetable + фильтр TypeOfLeaveLookupId IS NOT NULL
   * ОБНОВЛЕНО: Поле Date теперь Date-only, включает поддержку числовых полей времени
   */
  public async fetchStaffRecordsForSRSReports(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ items: IRemoteListItemResponse[], totalCount: number }> {
    try {
      this.logInfo('[DEBUG] fetchStaffRecordsForSRSReports НАЧИНАЕТСЯ (с Date-only и числовыми полями времени)');
      this.logInfo(`[DEBUG] Параметры запроса для SRS Reports: ${JSON.stringify({
        startDate: queryParams.startDate.toISOString(),
        endDate: queryParams.endDate.toISOString(),
        currentUserID: queryParams.currentUserID,
        staffGroupID: queryParams.staffGroupID,
        employeeID: queryParams.employeeID,
        timeTableID: queryParams.timeTableID
      })}`);

      // Проверяем наличие RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError("[ОШИБКА] RemoteSiteService не инициализирован");
        return { items: [], totalCount: 0 };
      }

      // Проверка имени списка
      if (!this._listName) {
        const errorMsg = "Имя списка не определено";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // ОБНОВЛЕНО: Даты уже в правильном формате Date-only, используем без дополнительного форматирования
      const startDateStr = this.formatDateForFilter(queryParams.startDate);
      const endDateStr = this.formatDateForFilter(queryParams.endDate);
      this.logInfo(
        `[DEBUG] Форматированные даты для запроса (Date-only): ${startDateStr} - ${endDateStr}`
      );

      // Проверка валидности дат после форматирования
      if (startDateStr === '' || endDateStr === '') {
        const errorMsg = "Некорректные даты начала/окончания периода";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Строим фильтр для SRS Reports с дополнительным условием TypeOfLeaveLookupId IS NOT NULL
      const filter = this.buildFilterForSRSReports(
        startDateStr,
        endDateStr,
        queryParams.employeeID,
        queryParams.staffGroupID,
        queryParams.currentUserID,
        queryParams.timeTableID
      );
      this.logInfo(`[DEBUG] SRS Reports фильтр: ${filter}`);

      // Определяем параметры сортировки по умолчанию (по дате)
      const orderBy = { field: "fields/Date", ascending: true };

      // --- ИСПОЛЬЗУЕМ МЕТОД RemoteSiteService.getAllFilteredItemsFromList ---
      this.logInfo(`[DEBUG] НАЧИНАЕМ запрос к списку ${this._listName} для SRS Reports через RemoteSiteService (включая числовые поля времени)...`);

      let fetchResult: { items: IRemoteListItemResponse[], totalCount: number };
      try {
        // Вызываем метод RemoteSiteService.getAllFilteredItemsFromList
        fetchResult = await this._remoteSiteService.getAllFilteredItemsFromList(
          this._listName,
          filter,
          orderBy
        );

        this.logInfo(
          `[DEBUG] ПОЛУЧЕН ответ от RemoteSiteService.getAllFilteredItemsFromList: ${fetchResult.items.length} элементов с типом отпуска, ОБЩЕЕ количество: ${fetchResult.totalCount}`
        );
      } catch (requestError) {
        this.logError(
          `[ОШИБКА] Ошибка при запросе к списку для SRS Reports через RemoteSiteService: ${JSON.stringify(requestError)}`
        );
        throw requestError;
      }

      // Логирование результата запроса
      this.logInfo(
        `Получено ${fetchResult.items.length} элементов с типом отпуска из SharePoint для SRS Reports (включая числовые поля времени)`
      );
      if (fetchResult.items.length > 0) {
        // Логируем первый элемент сырых данных с проверкой числовых полей
        this.logDetailedDataInfoWithNumericFields(fetchResult.items[0]);
      } else {
        this.logInfo(
          `[DEBUG] Нет элементов с типом отпуска в ответе от сервера для фильтра: ${filter}`
        );
      }

      this.logInfo(`[DEBUG] fetchStaffRecordsForSRSReports ЗАВЕРШЕН: ${fetchResult.items.length} записей`);
      return fetchResult;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] fetchStaffRecordsForSRSReports: ${errorMessage}`);
      console.error(`[${this._logSource}] Подробности ошибки:`, error);
      
      // Возвращаем пустой результат при ошибке
      return {
        items: [],
        totalCount: 0
      };
    }
  }

  /**
   * ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Построение фильтра для SRS Reports
   * Добавляет условие TypeOfLeaveLookupId IS NOT NULL к базовому фильтру
   */
  private buildFilterForSRSReports(
    startDateStr: string,
    endDateStr: string,
    employeeID: string | number,
    staffGroupID: string | number,
    currentUserID: string | number,
    timeTableID?: string | number
  ): string {
    try {
      // Используем существующий метод построения фильтра с исключением удаленных записей
      const baseFilter = this.buildFilterExpressionExcludingDeleted(
        startDateStr,
        endDateStr,
        employeeID,
        staffGroupID,
        currentUserID,
        timeTableID
      );
      
      // Добавляем условие для типа отпуска
      const typeOfLeaveFilter = 'fields/TypeOfLeaveLookupId ne null';
      
      // Объединяем фильтры
      const combinedFilter = baseFilter 
        ? `(${baseFilter}) and (${typeOfLeaveFilter})`
        : typeOfLeaveFilter;

      this.logInfo(`[DEBUG] SRS Reports комбинированный фильтр: ${combinedFilter}`);
      return combinedFilter;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] buildFilterForSRSReports: ${errorMessage}`);
      // Возвращаем только фильтр типа отпуска при ошибке
      return 'fields/TypeOfLeaveLookupId ne null';
    }
  }
  /**
   * ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Строит выражение фильтра с исключением удаленных записей (Deleted=1)
   *
   * @param startDateStr Отформатированная строка даты начала
   * @param endDateStr Отформатированная строка даты окончания
   * @param employeeID ID сотрудника
   * @param staffGroupID ID группы
   * @param currentUserID ID текущего пользователя
   * @param timeTableID ID недельного расписания (опционально)
   * @returns Строка фильтра для запроса с исключением Deleted=1
   */
  private buildFilterExpressionExcludingDeleted(
    startDateStr: string,
    endDateStr: string,
    employeeID: string | number,
    staffGroupID: string | number,
    currentUserID: string | number,
    timeTableID?: string | number
  ): string {
    // Используем существующий метод для построения базового фильтра
    let filter = this.buildFilterExpression(
      startDateStr,
      endDateStr,
      employeeID,
      staffGroupID,
      currentUserID,
      timeTableID
    );

    // Добавляем исключение удаленных записей
    filter += ` and fields/Deleted ne 1`;
    this.logInfo(`[DEBUG] Добавлено условие исключения удаленных записей: fields/Deleted ne 1`);

    return filter;
  }

  /**
   * Получает одну запись расписания по ID
   * Использует публичный метод RemoteSiteService.getListItem
   * ОБНОВЛЕНО: Поле Date теперь Date-only, получает числовые поля времени
   *
   * @param recordId ID записи для получения
   * @returns Promise с объектом записи или null при ошибке
   */
  public async fetchStaffRecordById(
    recordId: string | number
  ): Promise<IRawStaffRecord | undefined> { // Возвращаем IRawStaffRecord
    try {
      this.logInfo(`[DEBUG] Получение записи по ID: ${recordId} через RemoteSiteService (с Date-only и числовыми полями времени)...`);

      // Проверка наличия RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError("[ОШИБКА] RemoteSiteService не инициализирован");
        return undefined;
      }

      // --- ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД RemoteSiteService.getListItem ---
      const rawItem = await this._remoteSiteService.getListItem(
        this._listName,
        recordId,
        true // expandFields = true для получения всех полей (включая числовые поля времени)
      );

      if (!rawItem || !rawItem.id) {
        this.logInfo(`[DEBUG] Запись с ID: ${recordId} не найдена или получена некорректно.`);
        return undefined;
      }

      this.logInfo(`[DEBUG] Запись с ID: ${recordId} успешно получена (включая Date-only и числовые поля времени)`);
      
      // Проверяем наличие числовых полей времени в полученных данных
      this.logNumericTimeFieldsAvailability(rawItem);
      
      // Возвращаем сырой формат, приводим к типу IRawStaffRecord для ясности
      // Копируем свойства из rawItem.fields на верхний уровень для соответствия IRawStaffRecord,
      // так как StaffRecordsMapperService ожидает такую структуру.
      const flatRawItem: IRawStaffRecord = {
        ID: rawItem.id,
        ...rawItem.fields, // Копируем поля из fields на верхний уровень (включая числовые поля времени)
      };
      return flatRawItem;

    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось получить запись по ID: ${recordId}: ${error}`);
      // В случае ошибки возвращаем undefined
      return undefined;
    }
  }

  /**
   * Подсчитывает количество записей, соответствующих параметрам запроса
   * Этот метод МОЖЕТ быть оставлен для других целей, но для пагинации таблицы не нужен.
   *
   * @param queryParams Параметры запроса (без пагинации, только фильтр)
   * @returns Promise с количеством записей
   */
  public async countStaffRecords(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top'> // Убеждаемся, что пагинация не передается
  ): Promise<number> {
    // Этот метод остается без изменений, он использует RemoteSiteService.getListItemsCount
    try {
      const { startDate, endDate, currentUserID, staffGroupID, employeeID, timeTableID } = queryParams;

      // Формируем фильтр
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);

      const filter = this.buildFilterExpression(startDateStr, endDateStr, employeeID, staffGroupID, currentUserID, timeTableID);

      // Получаем количество элементов, используя RemoteSiteService.getListItemsCount
      this.logInfo(`[DEBUG] Подсчет элементов с фильтром: ${filter} (через RemoteSiteService.getListItemsCount)`);

      // --- ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД RemoteSiteService.getListItemsCount ---
      const count = await this._remoteSiteService.getListItemsCount(
        this._listName,
        filter
      );

      this.logInfo(`[DEBUG] Количество элементов (через RemoteSiteService.getListItemsCount): ${count}`);
      return count;
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось подсчитать количество записей: ${error}`);
      return 0;
    }
  }

  /**
   * Строит выражение фильтра для запроса к SharePoint
   *
   * @param startDateStr Отформатированная строка даты начала
   * @param endDateStr Отформатированная строка даты окончания
   * @param employeeID ID сотрудника
   * @param staffGroupID ID группы
   * @param currentUserID ID текущего пользователя
   * @param timeTableID ID недельного расписания (опционально)
   * @returns Строка фильтра для запроса
   */
  private buildFilterExpression(
    startDateStr: string,
    endDateStr: string,
    employeeID: string | number,
    staffGroupID: string | number,
    currentUserID: string | number,
    timeTableID?: string | number
  ): string {
    // Базовое условие: период с префиксом fields/
    let filter = `fields/Date ge '${startDateStr}' and fields/Date le '${endDateStr}'`;

    // Добавляем условие по сотруднику, если указано - с префиксом fields/
    if (employeeID && employeeID !== '0') {
      filter += ` and fields/StaffMemberLookupId eq ${employeeID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID сотрудника: ${employeeID}`);
    } else {
      this.logInfo(`[DEBUG] ID сотрудника не указан или некорректен: ${employeeID}. Фильтрация по сотруднику не применяется.`);
    }

    // Добавляем условие по группе, если указано - с префиксом fields/
    if (staffGroupID && staffGroupID !== '0') {
      filter += ` and fields/StaffGroupLookupId eq ${staffGroupID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID группы: ${staffGroupID}`);
    } else {
      this.logInfo(`[DEBUG] ID группы не указан или некорректен: ${staffGroupID}. Фильтрация по группе не применяется.`);
    }

    // Добавляем условие по менеджеру (текущему пользователю), если указано - с префиксом fields/
    if (currentUserID && currentUserID !== '0') {
      filter += ` and fields/ManagerLookupId eq ${currentUserID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID менеджера: ${currentUserID}`);
    } else {
      this.logInfo(`[DEBUG] ID менеджера не указан или некорректен: ${currentUserID}. Фильтрация по менеджеру не применяется.`);
    }

    // Добавляем условие по недельному расписанию, если указано - с префиксом fields/
    if (timeTableID && timeTableID !== '0' && timeTableID !== '') {
      filter += ` and fields/WeeklyTimeTableLookupId eq ${timeTableID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID недельного расписания: ${timeTableID}`);
    } else {
      this.logInfo(`[DEBUG] ID недельного расписания не указан или некорректен: ${timeTableID}. Фильтрация по расписанию не применяется.`);
    }

    return filter;
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Форматирует дату для использования в фильтре запроса
   * ОБНОВЛЕНО: Поле Date теперь Date-only - используем дату как есть
   * @param date Дата для форматирования
   * @returns Строка даты в формате для фильтра SharePoint
   */
  private formatDateForFilter(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      this.logError('[ОШИБКА] formatDateForFilter: Получена недействительная дата.');
      const fallbackDate = new Date();
      this.logError(`[ОШИБКА] formatDateForFilter: Используется запасная дата ${fallbackDate.toISOString()}`);
      return fallbackDate.toISOString();
    }
    
    try {
      // ОБНОВЛЕНО: Поле Date теперь Date-only - используем дату как есть без дополнительного форматирования
      const formattedDate = date.toISOString();
      
      this.logInfo(`[DEBUG] formatDateForFilter (Date-only): вход=${date.toISOString()}, выход=${formattedDate}`);
      return formattedDate;
      
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка форматирования даты ${date}: ${error instanceof Error ? error.message : String(error)}`);
      const fallbackDate = new Date();
      this.logError(`[ОШИБКА] formatDateForFilter: Используется запасная дата ${fallbackDate.toISOString()}`);
      return fallbackDate.toISOString();
    }
  }

  /**
   * НОВЫЙ МЕТОД: Логирует подробную информацию о полученных данных для диагностики
   * ОБНОВЛЕНО: Включает проверку числовых полей времени
   * @param item Элемент данных для логирования
   */
  private logDetailedDataInfoWithNumericFields(item: IRemoteListItemResponse): void {
    this.logInfo(`[DEBUG] Пример ПЕРВОГО элемента (сырые данные с Date-only и числовыми полями времени): ${JSON.stringify(item, null, 2)}`);

    // Проверка наличия полей (используя оператор ?)
    if (item && item.fields) {
      const fields = item.fields;
      this.logInfo(`[DEBUG] Поля первого элемента: ${Object.keys(fields).join(', ')}`);

      // Проверка полей Lookup
      const lookupFields = Object.keys(fields).filter(key => key.endsWith('LookupId') || key.includes('Lookup'));
      this.logInfo(`[DEBUG] Поля LookupId/Lookup: ${lookupFields.join(', ')}`);

      // Проверка важных существующих полей (без ShiftDate1-4)
      ['ID', 'Title', 'Date', 'TimeForLunch', 'Deleted', 'TypeOfLeave', 'WeeklyTimeTable'].forEach(field => {
        const hasField = fields[field] !== undefined;
        this.logInfo(`[DEBUG] Поле ${field}: ${hasField ? 'присутствует' : 'отсутствует'}`);
        if (hasField) {
          this.logInfo(`[DEBUG] Значение ${field}: ${JSON.stringify(fields[field])}`);
        }
      });

      // *** ПРОВЕРКА: Числовые поля времени ***
      this.logInfo(`[DEBUG] *** ПРОВЕРКА ЧИСЛОВЫХ ПОЛЕЙ ВРЕМЕНИ (Date-only) ***`);
      const numericTimeFields = [
        'ShiftDate1Hours', 'ShiftDate1Minutes', 
        'ShiftDate2Hours', 'ShiftDate2Minutes',
        'ShiftDate3Hours', 'ShiftDate3Minutes',
        'ShiftDate4Hours', 'ShiftDate4Minutes'
      ];
      
      numericTimeFields.forEach(field => {
        const hasField = fields[field] !== undefined;
        const value = fields[field];
        this.logInfo(`[DEBUG] Числовое поле времени ${field}: ${hasField ? 'присутствует' : 'отсутствует'}`);
        if (hasField) {
          this.logInfo(`[DEBUG] Значение ${field}: ${value} (тип: ${typeof value})`);
        }
      });

      // Проверка, есть ли хотя бы одно числовое поле времени
      const hasAnyNumericTimeField = numericTimeFields.some(field => fields[field] !== undefined);
      if (hasAnyNumericTimeField) {
        this.logInfo(`[DEBUG] ✅ УСПЕХ: Обнаружены числовые поля времени в данных SharePoint`);
      } else {
        this.logError(`[DEBUG] ❌ ПРЕДУПРЕЖДЕНИЕ: Числовые поля времени НЕ найдены в данных SharePoint`);
      }

      // Проверка поля Date (должно быть Date-only)
      if (fields.Date) {
        this.logInfo(`[DEBUG] ✅ Поле Date присутствует (Date-only): ${fields.Date}`);
      } else {
        this.logError(`[DEBUG] ❌ Поле Date отсутствует`);
      }

    } else {
      this.logInfo(`[DEBUG] ВНИМАНИЕ: Первый элемент пустой или не имеет полей`);
    }
  }

  /**
   * НОВЫЙ МЕТОД: Проверяет доступность числовых полей времени в полученной записи
   * @param rawItem Сырые данные записи из SharePoint
   */
  private logNumericTimeFieldsAvailability(rawItem: IRemoteListItemResponse): void {
    if (!rawItem || !rawItem.fields) {
      this.logError(`[DEBUG] ❌ Нет данных для проверки числовых полей времени`);
      return;
    }

    const fields = rawItem.fields;
    const numericTimeFields = [
      'ShiftDate1Hours', 'ShiftDate1Minutes', 
      'ShiftDate2Hours', 'ShiftDate2Minutes',
      'ShiftDate3Hours', 'ShiftDate3Minutes',
      'ShiftDate4Hours', 'ShiftDate4Minutes'
    ];

    this.logInfo(`[DEBUG] *** ПРОВЕРКА ЧИСЛОВЫХ ПОЛЕЙ ВРЕМЕНИ ДЛЯ ЗАПИСИ ID: ${rawItem.id} (Date-only) ***`);
    
    const presentFields: string[] = [];
    const missingFields: string[] = [];

    numericTimeFields.forEach(field => {
      if (fields[field] !== undefined) {
        presentFields.push(`${field}=${fields[field]}`);
      } else {
        missingFields.push(field);
      }
    });

    if (presentFields.length > 0) {
      this.logInfo(`[DEBUG] ✅ Найденные числовые поля времени: ${presentFields.join(', ')}`);
    }

    if (missingFields.length > 0) {
      this.logInfo(`[DEBUG] ⚠️ Отсутствующие числовые поля времени: ${missingFields.join(', ')}`);
    }

    // Проверка основных полей времени для ScheduleTab
    const mainFields = ['ShiftDate1Hours', 'ShiftDate1Minutes', 'ShiftDate2Hours', 'ShiftDate2Minutes'];
    const hasMainFields = mainFields.every(field => fields[field] !== undefined);

    if (hasMainFields) {
      this.logInfo(`[DEBUG] ✅ ОТЛИЧНО: Все основные числовые поля времени присутствуют для ScheduleTab`);
    } else {
      this.logError(`[DEBUG] ❌ ПРОБЛЕМА: Не все основные числовые поля времени найдены для ScheduleTab`);
    }

    // Проверка поля Date
    if (fields.Date) {
      this.logInfo(`[DEBUG] ✅ Поле Date присутствует (Date-only): ${fields.Date}`);
    } else {
      this.logError(`[DEBUG] ❌ Поле Date отсутствует`);
    }
  }

  /**
   * Логирование информационных сообщений
   * @param message Сообщение для логирования
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * Логирование сообщений об ошибках
   * @param message Сообщение об ошибке для логирования
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}