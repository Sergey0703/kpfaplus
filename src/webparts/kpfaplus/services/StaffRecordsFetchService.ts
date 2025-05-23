// src/webparts/kpfaplus/services/StaffRecordsFetchService.ts
import { RemoteSiteService } from "./RemoteSiteService";
import {
  IStaffRecordsQueryParams,
  IRawStaffRecord,
} from "./StaffRecordsInterfaces";

// Импортируем IRemotePaginatedItemsResponse из RemoteSiteInterfaces.ts
import { IRemotePaginatedItemsResponse } from "./RemoteSiteInterfaces";

// Определяем возвращаемый тип fetchStaffRecords как IRemotePaginatedItemsResponse
type IFetchStaffRecordsResult = IRemotePaginatedItemsResponse;

/**
 * Сервис для получения записей сотрудников из SharePoint
 * Отвечает за формирование запросов, фильтров и получение данных через API
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
    this.logInfo("StaffRecordsFetchService инициализирован");
  }

  /**
   * Получает записи расписания персонала из SharePoint с поддержкой пагинации.
   * Использует метод getPaginatedItemsFromList из RemoteSiteService.
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
        `[DEBUG] fetchStaffRecords ВЫЗВАН С ПАРАМЕТРАМИ:` +
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
        return { items: [], totalCount: 0 };
      }

      // Проверка имени списка
      if (!this._listName) {
        const errorMsg = "Имя списка не определено";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        throw new Error(errorMsg); // Бросаем ошибку, если имя списка не определено
      }

      // Форматирование дат для фильтрации
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      this.logInfo(
        `[DEBUG] Форматированные даты для запроса: ${startDateStr} - ${endDateStr}`
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
      this.logInfo(`[DEBUG] НАЧИНАЕМ запрос к списку ${this._listName} с пагинацией через RemoteSiteService...`);

      let fetchResult: IRemotePaginatedItemsResponse; // Используем импортированный тип
      try {
        // Вызываем новый публичный метод RemoteSiteService.getPaginatedItemsFromList
        // Удаляем свойство select, так как оно не существует в интерфейсе IGetPaginatedListItemsOptions
        fetchResult = await this._remoteSiteService.getPaginatedItemsFromList(
          this._listName,
          { // Передаем опции в формате IGetPaginatedListItemsOptions
            expandFields: true, // Расширять поля для маппинга в StaffRecordsService
            filter: filter,
            orderBy: orderBy,
            skip: skip || 0, // Передаем skip (по умолчанию 0 если не указан)
            top: top || 100, // Передаем top (по умолчанию 100 если не указан, или ваш размер страницы)
            // Удаляем select: "id,fields", так как это свойство не существует в интерфейсе
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

      // Логирование результата запроса
      this.logInfo(
        `Получено ${fetchResult.items.length} элементов расписания из SharePoint для текущей страницы (сырые данные)`
      );
      if (fetchResult.items.length > 0) {
        // Логируем первый элемент сырых данных
        this.logDetailedDataInfo(fetchResult.items[0]);
      } else {
        this.logInfo(
          `[DEBUG] Нет элементов в ответе от сервера для фильтра: ${filter} с skip=${skip}, top=${top}`
        );
      }

      // Возвращаем объект с сырыми записями для страницы и общим количеством.
      // StaffRecordsService будет ответственен за маппинг IRawStaffRecord в IStaffRecord.
      return {
        items: fetchResult.items,
        totalCount: fetchResult.totalCount
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
   * Получает одну запись расписания по ID
   * Использует публичный метод RemoteSiteService.getListItem
   *
   * @param recordId ID записи для получения
   * @returns Promise с объектом записи или null при ошибке
   */
  public async fetchStaffRecordById(
    recordId: string | number
  ): Promise<IRawStaffRecord | undefined> { // Возвращаем IRawStaffRecord
    try {
      this.logInfo(`[DEBUG] Получение записи по ID: ${recordId} через RemoteSiteService...`);

      // Проверка наличия RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError("[ОШИБКА] RemoteSiteService не инициализирован");
        return undefined;
      }

      // --- ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД RemoteSiteService.getListItem ---
      const rawItem = await this._remoteSiteService.getListItem(
        this._listName,
        recordId,
        true // expandFields = true для получения всех полей
      );

      if (!rawItem || !rawItem.id) {
        this.logInfo(`[DEBUG] Запись с ID: ${recordId} не найдена или получена некорректно.`);
        return undefined;
      }

      this.logInfo(`[DEBUG] Запись с ID: ${recordId} успешно получена`);
      // Возвращаем сырой формат, приводим к типу IRawStaffRecord для ясности
      // Копируем свойства из rawItem.fields на верхний уровень для соответствия IRawStaffRecord,
      // так как StaffRecordsMapperService ожидает такую структуру.
      // Или изменяем маппер, чтобы он работал с rawItem.fields.
      // Предполагаем, что маппер ожидает плоскую структуру IRawStaffRecord.
      // Тогда нужно скопировать поля:
      const flatRawItem: IRawStaffRecord = {
        ID: rawItem.id,
        ...rawItem.fields, // Копируем поля из fields на верхний уровень
        // Если есть другие топ-уровневые свойства, кроме id и fields, их тоже нужно скопировать
        // например: '@odata.etag': (rawItem as any)['@odata.etag'],
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


  private buildFilterExpression(
  startDateStr: string,
  endDateStr: string,
  employeeID: string | number,
  staffGroupID: string | number,
  currentUserID: string | number,
  timeTableID?: string | number
): string {
  // Базовое условие: период С префиксом fields/
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
   * Форматирует дату для использования в фильтре запроса
   * @param date Дата для форматирования
   * @returns Строка даты в формате для фильтра SharePoint (YYYY-MM-DDT00:00:00Z)
   */
  private formatDateForFilter(date: Date): string {
    if (!date || isNaN(date.getTime())) {
      this.logError('[ОШИБКА] formatDateForFilter: Получена недействительная дата.');
      const fallbackDate = new Date();
      this.logError(`[ОШИБКА] formatDateForFilter: Используется запасная дата ${fallbackDate.toISOString()}`);
      return fallbackDate.toISOString().split('T')[0] + 'T00:00:00Z';
    }
    try {
      // Формат ISO для SharePoint: YYYY-MM-DDT00:00:00Z
      // Устанавливаем время в 00:00:00Z для точного сравнения по дате
      const dateUtc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const formattedDate = dateUtc.toISOString();
      return formattedDate;
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка форматирования даты ${date}: ${error instanceof Error ? error.message : String(error)}`);
      const fallbackDate = new Date();
      this.logError(`[ОШИБКА] formatDateForFilter: Используется запасная дата ${fallbackDate.toISOString()}`);
      return fallbackDate.toISOString().split('T')[0] + 'T00:00:00Z';
    }
  }


  /**
   * Логирует подробную информацию о полученных данных для диагностики
   * @param item Элемент данных для логирования
   */
  private logDetailedDataInfo(item: IRawStaffRecord): void { // Принимаем IRawStaffRecord
    this.logInfo(`[DEBUG] Пример ПЕРВОГО элемента (сырые данные): ${JSON.stringify(item, null, 2)}`);

    // Проверка наличия полей (используя оператор ?)
    if (item) {
      const fields = item; // В этом сервисе мы работаем с полями напрямую как IRawStaffRecord
      this.logInfo(`[DEBUG] Поля первого элемента: ${Object.keys(fields).join(', ')}`);

      // Проверка полей Lookup
      const lookupFields = Object.keys(fields).filter(key => key.endsWith('LookupId') || key.includes('Lookup'));
      this.logInfo(`[DEBUG] Поля LookupId/Lookup: ${lookupFields.join(', ')}`);

      // Проверка важных полей
      ['ID', 'Title', 'Date', 'ShiftDate1', 'ShiftDate2', 'TimeForLunch', 'Deleted', 'TypeOfLeave', 'WeeklyTimeTable'].forEach(field => {
        const hasField = fields[field] !== undefined; // Проверяем наличие поля
        this.logInfo(`[DEBUG] Поле ${field}: ${hasField ? 'присутствует' : 'отсутствует'}`);
        if (hasField) {
          this.logInfo(`[DEBUG] Значение ${field}: ${JSON.stringify(fields[field])}`);
        }
      });
    } else {
      this.logInfo(`[DEBUG] ВНИМАНИЕ: Первый элемент пустой или не имеет полей`);
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