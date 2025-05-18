// src/webparts/kpfaplus/services/StaffRecordsFetchService.ts
import { RemoteSiteService } from "./RemoteSiteService";
import { 
  IStaffRecordsQueryParams
} from "./StaffRecordsInterfaces";

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
   * Получает записи расписания персонала из SharePoint
   * 
   * @param queryParams Параметры запроса
   * @returns Promise с массивом сырых записей из SharePoint
   */
  public async fetchStaffRecords(
    queryParams: IStaffRecordsQueryParams
  ): Promise<Array<{ id: string | number; fields?: Record<string, unknown> }>> {
    try {
      const { startDate, endDate, currentUserID, staffGroupID, employeeID, timeTableID } = queryParams;
      
      // Расширенное логирование параметров запроса
      this.logInfo(`[DEBUG] fetchStaffRecords ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${startDate.toISOString()},
        endDate: ${endDate.toISOString()},
        currentUserID: ${currentUserID} (тип: ${typeof currentUserID}),
        staffGroupID: ${staffGroupID} (тип: ${typeof staffGroupID}),
        employeeID: ${employeeID} (тип: ${typeof employeeID}),
        timeTableID: ${timeTableID || 'не указан'} (тип: ${typeof timeTableID})
      `);

      // Проверяем наличие RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError('[ОШИБКА] RemoteSiteService не инициализирован');
        return [];
      }

      // Проверяем авторизацию RemoteSiteService
      if (!this._remoteSiteService.isAuthorized()) {
        this.logError('[ОШИБКА] RemoteSiteService не авторизован, пытаемся получить авторизованный клиент...');
        try {
          // Вызываем getGraphClient(), который в свою очередь вызовет ensureAuthorization()
          await this._remoteSiteService.getGraphClient();
          this.logInfo('[DEBUG] Статус авторизации после попытки: ' + 
            (this._remoteSiteService.isAuthorized() ? 'успешно' : 'неудачно'));
        } catch (authError) {
          this.logError(`[ОШИБКА] Не удалось получить авторизацию: ${authError}`);
          return [];
        }
      }

      // Проверка имени списка
      if (!this._listName) {
        this.logError('[ОШИБКА] Имя списка не определено');
        return [];
      }

      // Форматирование дат для фильтрации
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      this.logInfo(`[DEBUG] Форматированные даты для запроса: ${startDateStr} - ${endDateStr}`);

      // Строим фильтр для запроса к SharePoint
      let filter = this.buildFilterExpression(startDateStr, endDateStr, employeeID, staffGroupID, currentUserID, timeTableID);
      this.logInfo(`[DEBUG] ИТОГОВЫЙ ФИЛЬТР: ${filter}`);
      
      // ПЕРЕД запросом проверим список
      try {
        const listInfo = await this._remoteSiteService.getListInfo(this._listName);
        this.logInfo(`[DEBUG] Список "${this._listName}" существует, ID: ${listInfo.id}, количество элементов: ${listInfo.itemCount}`);
      } catch (listError) {
        this.logError(`[ОШИБКА] Ошибка проверки списка "${this._listName}": ${listError}`);
      }
      
      // Получаем записи из SharePoint с использованием RemoteSiteService
      this.logInfo(`[DEBUG] НАЧИНАЕМ запрос к списку ${this._listName}...`);
      let rawItems: Array<{ id: string | number; fields?: Record<string, unknown> }> = [];
      try {
        rawItems = await this._remoteSiteService.getListItems(
          this._listName,
          true, // expandFields
          filter,
          { field: "Date", ascending: true } // сортировка по дате
        );
        this.logInfo(`[DEBUG] ПОЛУЧЕН ответ: ${rawItems.length} элементов`);
      } catch (requestError) {
        this.logError(`[ОШИБКА] Ошибка при запросе к списку: ${JSON.stringify(requestError)}`);
        throw requestError; // Пробрасываем ошибку дальше
      }
      
      // Логирование результата запроса
      this.logInfo(`Получено ${rawItems.length} элементов расписания из SharePoint`);
      if (rawItems.length > 0) {
        this.logDetailedDataInfo(rawItems[0]);
      } else {
        this.logInfo(`[DEBUG] Нет элементов в ответе от сервера для фильтра: ${filter}`);
      }
      
      return rawItems;
    } catch (error) {
      this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить записи расписания: ${error instanceof Error ? error.message : String(error)}`);
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);
      
      // В случае ошибки возвращаем пустой массив
      return [];
    }
  }

  /**
   * Получает одну запись расписания по ID
   * 
   * @param recordId ID записи для получения
   * @returns Promise с объектом записи или null при ошибке
   */
  public async fetchStaffRecordById(
    recordId: string | number
  ): Promise<{ id: string | number; fields?: Record<string, unknown> } | null> {
    try {
      this.logInfo(`[DEBUG] Получение записи по ID: ${recordId}`);
      
      // Проверяем авторизацию и наличие RemoteSiteService
      if (!this._remoteSiteService || !this._remoteSiteService.isAuthorized()) {
        await this._remoteSiteService.getGraphClient();
      }
      
      // Формируем фильтр по ID
      const filter = `ID eq ${recordId}`;
      
      // Выполняем запрос
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        filter
      );
      
      if (items.length === 0) {
        this.logInfo(`[DEBUG] Запись с ID: ${recordId} не найдена`);
        return null;
      }
      
      this.logInfo(`[DEBUG] Запись с ID: ${recordId} успешно получена`);
      return items[0];
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось получить запись по ID: ${recordId}: ${error}`);
      return null;
    }
  }

  /**
   * Подсчитывает количество записей, соответствующих параметрам запроса
   * 
   * @param queryParams Параметры запроса
   * @returns Promise с количеством записей
   */
  public async countStaffRecords(
    queryParams: IStaffRecordsQueryParams
  ): Promise<number> {
    try {
      const { startDate, endDate, currentUserID, staffGroupID, employeeID, timeTableID } = queryParams;
      
      // Формируем фильтр
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      
      const filter = this.buildFilterExpression(startDateStr, endDateStr, employeeID, staffGroupID, currentUserID, timeTableID);
      
      // Получаем количество элементов
      this.logInfo(`[DEBUG] Подсчет элементов с фильтром: ${filter}`);
      
      const count = await this._remoteSiteService.getListItemsCount(this._listName, filter);
      
      this.logInfo(`[DEBUG] Количество элементов: ${count}`);
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
    // Базовое условие: период
    let filter = `fields/Date ge '${startDateStr}' and fields/Date le '${endDateStr}'`;
    
    // Добавляем условие по сотруднику, если указано
    if (employeeID) {
      filter += ` and fields/StaffMemberLookupId eq ${employeeID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID сотрудника: ${employeeID}`);
    } else {
      this.logInfo(`[DEBUG] ID сотрудника не указан или некорректен: ${employeeID}`);
    }
    
    // Добавляем условие по группе, если указано
    if (staffGroupID) {
      filter += ` and fields/StaffGroupLookupId eq ${staffGroupID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID группы: ${staffGroupID}`);
    } else {
      this.logInfo(`[DEBUG] ID группы не указан или некорректен: ${staffGroupID}`);
    }
    
    // Добавляем условие по менеджеру (текущему пользователю), если указано
    if (currentUserID) {
      filter += ` and fields/ManagerLookupId eq ${currentUserID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID менеджера: ${currentUserID}`);
    } else {
      this.logInfo(`[DEBUG] ID менеджера не указан или некорректен: ${currentUserID}`);
    }
    
    // Добавляем условие по недельному расписанию, если указано
    if (timeTableID) {
      filter += ` and fields/WeeklyTimeTableLookupId eq ${timeTableID}`;
      this.logInfo(`[DEBUG] Добавлено условие по ID недельного расписания: ${timeTableID}`);
    }
    
    return filter;
  }

  /**
   * Форматирует дату для использования в фильтре запроса
   * @param date Дата для форматирования
   * @returns Строка даты в формате для фильтра SharePoint
   */
  private formatDateForFilter(date: Date): string {
    try {
      // Формат ISO для SharePoint: YYYY-MM-DDT00:00:00Z
      const formattedDate = date.toISOString().split('T')[0] + 'T00:00:00Z';
      return formattedDate;
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка форматирования даты ${date}: ${error instanceof Error ? error.message : String(error)}`);
      // В случае ошибки, возвращаем текущую дату
      return new Date().toISOString().split('T')[0] + 'T00:00:00Z';
    }
  }

  /**
   * Логирует подробную информацию о полученных данных для диагностики
   * @param item Элемент данных для логирования
   */
  private logDetailedDataInfo(item: { id: string | number; fields?: Record<string, unknown> }): void {
    this.logInfo(`[DEBUG] Пример ПЕРВОГО элемента: ${JSON.stringify(item, null, 2)}`);
    
    // Проверка структуры полей
    if (item && item.fields) {
      this.logInfo(`[DEBUG] Поля первого элемента: ${Object.keys(item.fields).join(', ')}`);
      
      // Проверка полей LookupId
      const lookupFields = Object.keys(item.fields).filter(key => key.includes('LookupId'));
      this.logInfo(`[DEBUG] Поля LookupId: ${lookupFields.join(', ')}`);
      
      // Проверка важных полей
      ['Date', 'StaffMember', 'StaffMemberLookupId', 'WeeklyTimeTable', 'WeeklyTimeTableLookupId'].forEach(field => {
        const hasField = item.fields && item.fields[field] !== undefined;
        this.logInfo(`[DEBUG] Поле ${field}: ${hasField ? 'присутствует' : 'отсутствует'}`);
        if (hasField && item.fields) {
          this.logInfo(`[DEBUG] Значение ${field}: ${JSON.stringify(item.fields[field])}`);
        }
      });
    } else {
      this.logInfo(`[DEBUG] ВНИМАНИЕ: У первого элемента нет поля 'fields'`);
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