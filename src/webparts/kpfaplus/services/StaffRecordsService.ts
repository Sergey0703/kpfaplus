// src/webparts/kpfaplus/services/StaffRecordsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import {
  IStaffRecord,
  IStaffRecordsQueryParams,
  ISortOptions,
  IStaffRecordsResult,
  StaffRecordsSortType,
  // УДАЛЯЕМ неиспользуемые импорты IRawStaffRecord и IRemotePaginatedItemsResponse отсюда
  // IRawStaffRecord, // <-- УДАЛИТЬ
  // IRemotePaginatedItemsResponse, // <-- УДАЛИТЬ
} from "./StaffRecordsInterfaces";
// Мы уже импортируем IRemotePaginatedItemsResponse в StaffRecordsFetchService,
// и не используем его напрямую в StaffRecordsService для типизации переменных.
// Если вам нужен этот тип в StaffRecordsService для чего-то другого, оставьте его.
// Но для компиляции он здесь не нужен.

import { StaffRecordsFetchService } from "./StaffRecordsFetchService";
import { StaffRecordsMapperService } from "./StaffRecordsMapperService";
import { StaffRecordsCalculationService } from "./StaffRecordsCalculationService";

/**
 * Основной сервис для работы с записями расписания персонала.
 * Этот класс координирует работу специализированных сервисов и предоставляет
 * единый интерфейс для взаимодействия с данными записей сотрудников.
 */
export class StaffRecordsService {
  private static _instance: StaffRecordsService;
  private _logSource: string = "StaffRecordsService";
  private _listName: string = "StaffRecords";
  private _remoteSiteService: RemoteSiteService;

  // Специализированные сервисы
  private _fetchService: StaffRecordsFetchService;
  private _mapperService: StaffRecordsMapperService;
  private _calculationService: StaffRecordsCalculationService;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    console.log('[StaffRecordsService] Инициализация сервиса с контекстом');
    // Инициализируем RemoteSiteService
    this._remoteSiteService = RemoteSiteService.getInstance(context);

    // Инициализируем специализированные сервисы
    // Передаем this._remoteSiteService в fetchService, так как он нужен для вызовов Graph
    this._fetchService = new StaffRecordsFetchService(this._remoteSiteService, this._listName, this._logSource);
    this._mapperService = new StaffRecordsMapperService(this._logSource);
    this._calculationService = new StaffRecordsCalculationService(this._logSource);

    this.logInfo("StaffRecordsService инициализирован с RemoteSiteService");
  }

  /**
   * Получение экземпляра сервиса (Singleton паттерн)
   * @param context Контекст веб-части
   * @returns Экземпляр StaffRecordsService
   */
  public static getInstance(context: WebPartContext): StaffRecordsService {
    if (!StaffRecordsService._instance) {
      console.log('[StaffRecordsService] Создание нового экземпляра');
      StaffRecordsService._instance = new StaffRecordsService(context);
    } else {
      console.log('[StaffRecordsService] Возврат существующего экземпляра');
    }
    return StaffRecordsService._instance;
  }

  /**
   * Получение записей расписания персонала
   * Этот метод сохранен для обратной совместимости с текущим API
   * Теперь он будет использовать getStaffRecordsWithOptions для получения всех записей за период.
   * В будущих версиях или для больших наборов данных, этот метод, возможно,
   * стоит переработать, чтобы он тоже использовал пагинацию или был удален.
   *
   * @param startDate Дата начала периода
   * @param endDate Дата окончания периода
   * @param currentUserID ID текущего пользователя
   * @param staffGroupID ID группы сотрудников
   * @param employeeID ID сотрудника
   * @param timeTableID ID недельного расписания (опционально)
   * @returns Promise с массивом записей расписания
   */
  public async getStaffRecords(
    startDate: Date,
    endDate: Date,
    currentUserID: string | number,
    staffGroupID: string | number,
    employeeID: string | number,
    timeTableID?: string | number
  ): Promise<IStaffRecord[]> {
    try {
      this.logInfo(`[DEBUG] getStaffRecords (обратная совместимость) ВЫЗВАН С ПАРАМЕТРАМИ:`);
      // Создаем параметры запроса (без пагинации, т.к. этот метод возвращает все за период)
      const queryParams: IStaffRecordsQueryParams = {
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeID,
        timeTableID
         // skip и top здесь не указываются, fetchService.fetchStaffRecords получит их как undefined
         // RemoteSiteItemService.getPaginatedListItems обрабатывает undefined skip/top
      };

      // Используем getStaffRecordsWithOptions для выполнения запроса
      // Запрос fetchStaffRecords(queryParams) вернет сырые данные (без пагинации)
      // и общее количество. Маппер и калькулятор обработают все полученные сырые данные.
      const result = await this.getStaffRecordsWithOptions(queryParams);

      // Возвращаем только массив обработанных записей, как и раньше
      if (result.error) {
           this.logError(`[ОШИБКА] getStaffRecords: Ошибка при получении данных через getStaffRecordsWithOptions: ${result.error}`);
           return []; // Возвращаем пустой массив при ошибке
      }

      this.logInfo(`getStaffRecords (обратная совместимость): Возвращаем ${result.records.length} записей`);
      return result.records;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить записи расписания (getStaffRecords): ${errorMessage}`);
      console.error('[StaffRecordsService] [DEBUG] Подробности ошибки:', error);
      return []; // Возвращаем пустой массив при ошибке
    }
  }


  /**
   * Получение записей расписания персонала с расширенными опциями, включая пагинацию.
   * Этот метод возвращает обработанные записи ДЛЯ ОДНОЙ СТРАНИЦЫ И ОБЩЕЕ КОЛИЧЕСТВО.
   *
   * @param queryParams Параметры запроса, включая пагинацию (skip, top)
   * @param sortOptions Опции сортировки (опционально)
   * @returns Promise с результатами запроса (записи для страницы и общее количество)
   */
  public async getStaffRecordsWithOptions(
    queryParams: IStaffRecordsQueryParams,
    sortOptions?: ISortOptions
  ): Promise<IStaffRecordsResult> {
    try {
      // Логируем начало выполнения метода
      this.logInfo(`[DEBUG] getStaffRecordsWithOptions ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${queryParams.startDate.toISOString()},
        endDate: ${queryParams.endDate.toISOString()},
        currentUserID: ${queryParams.currentUserID},
        staffGroupID: ${queryParams.staffGroupID},
        employeeID: ${queryParams.employeeID},
        timeTableID: ${queryParams.timeTableID || 'не указан'},
        skip: ${queryParams.skip !== undefined ? queryParams.skip : 'не указан'}, // Логируем пагинацию
        top: ${queryParams.top !== undefined ? queryParams.top : 'не указан'},   // Логируем пагинацию
        sortOptions: ${sortOptions ? JSON.stringify(sortOptions) : 'не указаны'}`
      );

      // Получаем сырые данные из API через сервис получения данных
      // fetchService.fetchStaffRecords возвращает IRemotePaginatedItemsResponse { items: IRawStaffRecord[], totalCount: number }
      const fetchResult = await this._fetchService.fetchStaffRecords(queryParams);

      // Проверяем наличие ошибки в fetchResult (хотя fetchService должен пробрасывать ошибки, лучше перепроверить)
       if (!fetchResult || fetchResult.items === undefined || fetchResult.totalCount === undefined) {
          const errorMsg = "Получены некорректные данные от fetchService.fetchStaffRecords";
           this.logError(`[ОШИБКА] ${errorMsg}`);
           // Возвращаем объект с ошибкой
           return { records: [], totalCount: 0, error: errorMsg };
       }


      // Преобразуем СЫРЫЕ данные для ТЕКУЩЕЙ СТРАНИЦЫ в формат IStaffRecord
      // mapToStaffRecords ожидает массив raw items (IRawStaffRecord[])
      const mappedRecords = this._mapperService.mapToStaffRecords(fetchResult.items);

      // Рассчитываем рабочее время для каждой записи (только для записей на текущей странице)
      const recordsWithWorkTime = mappedRecords.map(record =>
        this._calculationService.calculateWorkTime(record)
      );

      // Сортируем записи согласно опциям или по умолчанию (сортируем только записи на текущей странице)
      const defaultSortOptions: ISortOptions = sortOptions || {
        type: StaffRecordsSortType.ByDate,
        ascending: true
      };

      const sortedRecords = this._calculationService.sortStaffRecords(
        recordsWithWorkTime,
        defaultSortOptions
      );

      this.logInfo(`[DEBUG] Получено и обработано ${sortedRecords.length} записей расписания для текущей страницы.`);
      this.logInfo(`[DEBUG] Общее количество записей (согласно серверу): ${fetchResult.totalCount}`);


      // Формируем и возвращаем результат IStaffRecordsResult
      // records: массив обработанных записей ДЛЯ ТЕКУЩЕЙ СТРАНИЦЫ
      // totalCount: ОБЩЕЕ количество записей, соответствующих фильтру (получено от сервера)
      return {
        records: sortedRecords,
        totalCount: fetchResult.totalCount, // <--- Используем totalCount из результата fetchService
        error: undefined // Сбрасываем ошибку, если запрос прошел успешно
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] Не удалось получить записи расписания с опциями: ${errorMessage}`);
      console.error('[StaffRecordsService] [DEBUG] Подробности ошибки:', error);

      // В случае ошибки возвращаем объект с ошибкой и пустым результатом
      return {
        records: [],
        totalCount: 0, // При ошибке общее количество неизвестно, ставим 0
        error: errorMessage // Пробрасываем сообщение об ошибке
      };
    }
  }

  /**
   * --- НОВЫЙ МЕТОД ДЛЯ TIMETABLE ---
   * Получение ВСЕХ записей расписания персонала за период БЕЗ ПАГИНАЦИИ.
   * Специально создан для TimetableTab где нужны все данные месяца сразу.
   * 
   * @param queryParams Параметры запроса (без skip/top)
   * @param sortOptions Опции сортировки (опционально)
   * @returns Promise с результатами запроса (ВСЕ записи и общее количество)
   */
  public async getAllStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>,
    sortOptions?: ISortOptions
  ): Promise<IStaffRecordsResult> {
    try {
      // Логируем начало выполнения метода
      this.logInfo(`[DEBUG] getAllStaffRecordsForTimetable ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${queryParams.startDate.toISOString()},
        endDate: ${queryParams.endDate.toISOString()},
        currentUserID: ${queryParams.currentUserID},
        staffGroupID: ${queryParams.staffGroupID},
        employeeID: ${queryParams.employeeID},
        timeTableID: ${queryParams.timeTableID || 'не указан'},
        sortOptions: ${sortOptions ? JSON.stringify(sortOptions) : 'не указаны'},
        NOTE: ЗАГРУЖАЕМ ВСЕ ДАННЫЕ БЕЗ ПАГИНАЦИИ`
      );

      // Получаем ВСЕ сырые данные из API через новый сервис получения данных
      const fetchResult = await this._fetchService.fetchAllStaffRecordsForTimetable(queryParams);

      // Проверяем наличие ошибки в fetchResult
      if (!fetchResult || fetchResult.items === undefined || fetchResult.totalCount === undefined) {
        const errorMsg = "Получены некорректные данные от fetchService.fetchAllStaffRecordsForTimetable";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        return { records: [], totalCount: 0, error: errorMsg };
      }

      this.logInfo(`[DEBUG] Получены ВСЕ данные: ${fetchResult.items.length} записей, общее количество: ${fetchResult.totalCount}`);

      // Преобразуем СЫРЫЕ данные (ВСЕ записи) в формат IStaffRecord
      const mappedRecords = this._mapperService.mapToStaffRecords(fetchResult.items);

      // Рассчитываем рабочее время для каждой записи (для ВСЕХ записей сразу)
      const recordsWithWorkTime = mappedRecords.map(record =>
        this._calculationService.calculateWorkTime(record)
      );

      // Сортируем записи согласно опциям или по умолчанию (сортируем ВСЕ записи)
      const defaultSortOptions: ISortOptions = sortOptions || {
        type: StaffRecordsSortType.ByDate,
        ascending: true
      };

      const sortedRecords = this._calculationService.sortStaffRecords(
        recordsWithWorkTime,
        defaultSortOptions
      );

      this.logInfo(`[DEBUG] Получено и обработано ${sortedRecords.length} записей расписания (ВСЕ данные за период).`);
      this.logInfo(`[DEBUG] Общее количество записей (согласно серверу): ${fetchResult.totalCount}`);

      // Формируем и возвращаем результат IStaffRecordsResult
      return {
        records: sortedRecords, // ВСЕ обработанные записи
        totalCount: fetchResult.totalCount, // Общее количество записей с сервера
        error: undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] Не удалось получить все записи расписания: ${errorMessage}`);
      console.error('[StaffRecordsService] [DEBUG] Подробности ошибки:', error);

      // В случае ошибки возвращаем объект с ошибкой и пустым результатом
      return {
        records: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }
//////////////////////
/**
   * НОВЫЙ МЕТОД ДЛЯ TIMETABLE: Получает ВСЕ АКТИВНЫЕ записи расписания (исключает Deleted=1)
   * Использует новый fetchAllActiveStaffRecordsForTimetable из StaffRecordsFetchService
   */
/**
   * НОВЫЙ МЕТОД ДЛЯ TIMETABLE: Получает ВСЕ АКТИВНЫЕ записи расписания (исключает Deleted=1)
   * Использует новый fetchAllActiveStaffRecordsForTimetable из StaffRecordsFetchService
   */
  public async getAllActiveStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ records: IStaffRecord[]; totalCount: number; error?: string }> {
    try {
      this.logInfo('[DEBUG] getAllActiveStaffRecordsForTimetable ВЫЗВАН С ПАРАМЕТРАМИ:');
      this.logInfo(`        startDate: ${queryParams.startDate.toISOString()}`);
      this.logInfo(`        endDate: ${queryParams.endDate.toISOString()}`);
      this.logInfo(`        currentUserID: ${queryParams.currentUserID}`);
      this.logInfo(`        staffGroupID: ${queryParams.staffGroupID}`);
      this.logInfo(`        employeeID: ${queryParams.employeeID}`);
      this.logInfo(`        timeTableID: ${queryParams.timeTableID || 'не указан'}`);
      this.logInfo(`        NOTE: ЗАГРУЖАЕМ ВСЕ АКТИВНЫЕ ДАННЫЕ БЕЗ ПАГИНАЦИИ (исключая Deleted=1)`);

      if (!this._fetchService) {
        const errorMsg = 'StaffRecordsFetchService не инициализирован';
        this.logError(`[ОШИБКА] ${errorMsg}`);
        return { records: [], totalCount: 0, error: errorMsg };
      }

      // Получаем ВСЕ активные элементы через новый метод fetchService
      const fetchResult = await this._fetchService.fetchAllActiveStaffRecordsForTimetable(queryParams);
      
      // Проверяем наличие ошибки в fetchResult
      if (!fetchResult || fetchResult.items === undefined || fetchResult.totalCount === undefined) {
        const errorMsg = "Получены некорректные данные от fetchService.fetchAllActiveStaffRecordsForTimetable";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        return { records: [], totalCount: 0, error: errorMsg };
      }

      this.logInfo(`[DEBUG] Получены ВСЕ активные данные: ${fetchResult.items.length} записей, общее количество: ${fetchResult.totalCount}`);

      // Преобразуем СЫРЫЕ данные (ВСЕ активные записи) в формат IStaffRecord
      const mappedRecords = this._mapperService.mapToStaffRecords(fetchResult.items);

      // Рассчитываем рабочее время для каждой записи
      const recordsWithWorkTime = mappedRecords.map(record =>
        this._calculationService.calculateWorkTime(record)
      );

      // Сортируем записи согласно опциям по умолчанию (сортируем ВСЕ активные записи)
      const defaultSortOptions: ISortOptions = {
        type: StaffRecordsSortType.ByDate,
        ascending: true
      };

      const sortedRecords = this._calculationService.sortStaffRecords(
        recordsWithWorkTime,
        defaultSortOptions
      );

      this.logInfo(`[DEBUG] Получено и обработано ${sortedRecords.length} активных записей расписания (исключены Deleted=1).`);
      this.logInfo(`[DEBUG] Общее количество активных записей (согласно серверу): ${fetchResult.totalCount}`);

      return {
        records: sortedRecords,
        totalCount: fetchResult.totalCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить активные записи расписания: ${errorMessage}`);
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

      return {
        records: [],
        totalCount: 0,
        error: `Failed to get active staff records: ${errorMessage}`
      };
    }
  }
/////////////////////////
// ЭТАП 1: Добавить этот метод в StaffRecordsService.ts
// Вставить ПОСЛЕ метода getAllActiveStaffRecordsForTimetable (около строки 280)

/**
 * НОВЫЙ МЕТОД ДЛЯ SRS REPORTS: Получает записи расписания с заполненным типом отпуска
 * Базируется на getAllActiveStaffRecordsForTimetable + дополнительный фильтр по TypeOfLeave
 * 
 * @param queryParams Параметры запроса (без пагинации)
 * @returns Promise с результатами (записи с типом отпуска, исключая удаленные)
 */
public async getStaffRecordsForSRSReports(
  queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
): Promise<{ records: IStaffRecord[]; totalCount: number; error?: string }> {
  try {
    this.logInfo('[DEBUG] getStaffRecordsForSRSReports ВЫЗВАН С ПАРАМЕТРАМИ:');
    this.logInfo(`        startDate: ${queryParams.startDate.toISOString()}`);
    this.logInfo(`        endDate: ${queryParams.endDate.toISOString()}`);
    this.logInfo(`        currentUserID: ${queryParams.currentUserID}`);
    this.logInfo(`        staffGroupID: ${queryParams.staffGroupID}`);
    this.logInfo(`        employeeID: ${queryParams.employeeID}`);
    this.logInfo(`        timeTableID: ${queryParams.timeTableID || 'не указан'}`);
    this.logInfo(`        NOTE: ЗАГРУЖАЕМ ЗАПИСИ С ТИПОМ ОТПУСКА (TypeOfLeave IS NOT NULL) БЕЗ УДАЛЕННЫХ`);

    if (!this._fetchService) {
      const errorMsg = 'StaffRecordsFetchService не инициализирован';
      this.logError(`[ОШИБКА] ${errorMsg}`);
      return { records: [], totalCount: 0, error: errorMsg };
    }

    // Получаем записи через новый метод fetchService специально для SRS Reports
    const fetchResult = await this._fetchService.fetchStaffRecordsForSRSReports(queryParams);
    
    // Проверяем наличие ошибки в fetchResult
    if (!fetchResult || fetchResult.items === undefined || fetchResult.totalCount === undefined) {
      const errorMsg = "Получены некорректные данные от fetchService.fetchStaffRecordsForSRSReports";
      this.logError(`[ОШИБКА] ${errorMsg}`);
      return { records: [], totalCount: 0, error: errorMsg };
    }

    this.logInfo(`[DEBUG] Получены данные для SRS Reports: ${fetchResult.items.length} записей, общее количество: ${fetchResult.totalCount}`);

    // Преобразуем СЫРЫЕ данные (записи с типом отпуска) в формат IStaffRecord
    const mappedRecords = this._mapperService.mapToStaffRecords(fetchResult.items);

    // Рассчитываем рабочее время для каждой записи
    const recordsWithWorkTime = mappedRecords.map(record =>
      this._calculationService.calculateWorkTime(record)
    );

    // Сортируем записи по дате (важно для группировки по месяцам)
    const defaultSortOptions: ISortOptions = {
      type: StaffRecordsSortType.ByDate,
      ascending: true
    };

    const sortedRecords = this._calculationService.sortStaffRecords(
      recordsWithWorkTime,
      defaultSortOptions
    );

    this.logInfo(`[DEBUG] Получено и обработано ${sortedRecords.length} записей с типом отпуска для SRS Reports.`);
    this.logInfo(`[DEBUG] Общее количество записей с типом отпуска: ${fetchResult.totalCount}`);

    // Дополнительная статистика для отладки
    const typeOfLeaveStats = sortedRecords.reduce((acc, record) => {
      const typeId = record.TypeOfLeaveID || 'unknown';
      acc[typeId] = (acc[typeId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.logInfo(`[DEBUG] Статистика по типам отпусков: ${JSON.stringify(typeOfLeaveStats)}`);

    return {
      records: sortedRecords,
      totalCount: fetchResult.totalCount
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить записи для SRS Reports: ${errorMessage}`);
    console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

    return {
      records: [],
      totalCount: 0,
      error: `Failed to get SRS reports data: ${errorMessage}`
    };
  }
}



  /**
 * Обновляет запись расписания
 *
 * @param recordId ID записи для обновления
 * @param updateData Параметры обновления
 * @returns Promise с результатом операции (true = успех, false = ошибка)
 */
public async updateStaffRecord(
  recordId: string | number,
  updateData: Partial<IStaffRecord>
): Promise<boolean> {
  try {
    this.logInfo(`[DEBUG] Updating staff record ID: ${recordId}`);

    // Convert the updateData to the format expected by the SharePoint API
    const fields: Record<string, unknown> = {};

    // Process Date fields
    if (updateData.Date) {
      fields.Date = updateData.Date.toISOString();
    }

    // Process shift times
    if (updateData.ShiftDate1 !== undefined) { // Check explicitly for undefined to allow null
      fields.ShiftDate1 = updateData.ShiftDate1 ? updateData.ShiftDate1.toISOString() : null;
    } else if (updateData.ShiftDate1 === null) { fields.ShiftDate1 = null; } // Handle explicit null

    if (updateData.ShiftDate2 !== undefined) { // Check explicitly for undefined to allow null
      fields.ShiftDate2 = updateData.ShiftDate2 ? updateData.ShiftDate2.toISOString() : null;
    } else if (updateData.ShiftDate2 === null) { fields.ShiftDate2 = null; } // Handle explicit null

    if (updateData.ShiftDate3 !== undefined) { // Check explicitly for undefined to allow null
        fields.ShiftDate3 = updateData.ShiftDate3 ? updateData.ShiftDate3.toISOString() : null;
    } else if (updateData.ShiftDate3 === null) { fields.ShiftDate3 = null; } // Handle explicit null

    if (updateData.ShiftDate4 !== undefined) { // Check explicitly for undefined to allow null
        fields.ShiftDate4 = updateData.ShiftDate4 ? updateData.ShiftDate4.toISOString() : null;
    } else if (updateData.ShiftDate4 === null) { fields.ShiftDate4 = null; } // Handle explicit null


    // Process numeric fields
    if (updateData.TimeForLunch !== undefined) { // Check explicitly for undefined to allow null
      fields.TimeForLunch = updateData.TimeForLunch === null ? null : updateData.TimeForLunch;
    }
    if (updateData.Contract !== undefined) { // Check explicitly for undefined to allow null
      fields.Contract = updateData.Contract === null ? null : updateData.Contract;
    }
    if (updateData.Holiday !== undefined) { // Check explicitly for undefined to allow null
      fields.Holiday = updateData.Holiday === null ? null : updateData.Holiday;
    }
    if (updateData.Deleted !== undefined) { // Check explicitly for undefined
      fields.Deleted = updateData.Deleted; // Deleted is number 0 or 1, not nullable in IStaffRecordUpdateParams
    }
    if (updateData.Checked !== undefined) { // Check explicitly for undefined
      fields.Checked = updateData.Checked; // Checked is number 0 or 1, not nullable in IStaffRecordUpdateParams
    }


    // Process string fields
    if (updateData.Title !== undefined) { // Check explicitly for undefined to allow null
      fields.Title = updateData.Title;
    }
    if (updateData.ExportResult !== undefined) { // Check explicitly for undefined to allow null
      fields.ExportResult = updateData.ExportResult;
    }


    // Handle lookup fields (using LookupId suffix)
    // We need to update LookupId field, not the complex object field
    if (updateData.TypeOfLeaveID !== undefined) { // Check if undefined or explicitly set to ''/null
      if (updateData.TypeOfLeaveID === '' || updateData.TypeOfLeaveID === null) {
         fields.TypeOfLeaveLookupId = null; // Clear lookup by setting LookupId to null
         this.logInfo(`[DEBUG] Clearing TypeOfLeaveLookupId`);
      } else {
        try {
          const typeOfLeaveId = parseInt(updateData.TypeOfLeaveID, 10);
          if (!isNaN(typeOfLeaveId)) {
            fields.TypeOfLeaveLookupId = typeOfLeaveId;
            this.logInfo(`[DEBUG] Setting TypeOfLeaveLookupId to ${typeOfLeaveId}`);
          } else {
             this.logError(`[ERROR] Invalid TypeOfLeaveID format for update: ${updateData.TypeOfLeaveID}`);
             // Decide whether to throw error or ignore field - ignoring for now
          }
        } catch (parseError) {
          this.logError(`[ERROR] Error parsing TypeOfLeaveID for update: ${parseError}`);
           // Decide whether to throw error or ignore field - ignoring for now
        }
      }
    }

    if (updateData.WeeklyTimeTableID !== undefined) { // Check if undefined or explicitly set to ''/null
       if (updateData.WeeklyTimeTableID === '' || updateData.WeeklyTimeTableID === null) {
           fields.WeeklyTimeTableLookupId = null; // Clear lookup
           this.logInfo(`[DEBUG] Clearing WeeklyTimeTableLookupId`);
       } else {
         try {
           const weeklyTimeTableId = parseInt(String(updateData.WeeklyTimeTableID), 10);
           if (!isNaN(weeklyTimeTableId)) {
             fields.WeeklyTimeTableLookupId = weeklyTimeTableId;
             this.logInfo(`[DEBUG] Setting WeeklyTimeTableLookupId to ${weeklyTimeTableId}`);
           } else {
              this.logError(`[ERROR] Invalid WeeklyTimeTableID format for update: ${updateData.WeeklyTimeTableID}`);
               // Decide whether to throw error or ignore field - ignoring for now
           }
         } catch (parseError) {
           this.logError(`[ERROR] Error parsing WeeklyTimeTableID for update: ${parseError}`);
            // Decide whether to throw error or ignore field - ignoring for now
         }
       }
    }

     // StaffMemberLookupId, ManagerLookupId, StaffGroupLookupId should not typically be updated via this method
     // as they define *which* record this is. They are set during creation.


    this.logInfo(`[DEBUG] Prepared fields for update: ${JSON.stringify(fields)}`);

     // Check if there are any fields to update
     if (Object.keys(fields).length === 0) {
         this.logInfo(`[DEBUG] No fields to update for record ID: ${recordId}. Skipping update call.`);
         return true; // Treat as successful if nothing needed updating
     }

    // Use the RemoteSiteService to update the item
    // RemoteSiteService.updateListItem returns boolean
    const success = await this._remoteSiteService.updateListItem(
      this._listName,
      Number(recordId), // Ensure ID is number if RemoteSiteService expects number
      fields
    );

    if (success) {
      this.logInfo(`[DEBUG] Successfully updated staff record ID: ${recordId}`);
    } else {
      this.logError(`[DEBUG] Failed to update staff record ID: ${recordId}`);
      // If RemoteSiteService.updateListItem returns false, throw an error here
      throw new Error(`Update failed for record ID: ${recordId}`);
    }

    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logError(`[ERROR] Error updating staff record ID: ${recordId}: ${errorMessage}`);
    // Rethrow the error to be caught by the calling code (e.g., mutation hook)
    throw new Error(`Error updating staff record ID: ${recordId}: ${errorMessage}`);
  }
}

/**
 * Creates a new staff record
 *
 * @param createParams Параметры для staff record creation
 * @param currentUserID ID of the current user (Manager)
 * @param staffGroupID ID of the staff group
 * @param staffMemberID ID of the staff member (Employee)
 * @returns Promise with the ID of the created record or undefined on error
 */
public async createStaffRecord(
  createParams: Partial<IStaffRecord>, // Allow partial IStaffRecord
  currentUserID?: string | number,
  staffGroupID?: string | number,
  staffMemberID?: string | number
): Promise<string | undefined> {
  try {
    this.logInfo(`[DEBUG] Creating new staff record with IDs:
      staffMemberID=${staffMemberID} (${typeof staffMemberID})
      currentUserID=${currentUserID} (${typeof currentUserID})
      staffGroupID=${staffGroupID} (${typeof staffGroupID})
    `);

    // Convert the createParams to the format expected by the SharePoint API
    const fields: Record<string, unknown> = {};

    // Set default title if not provided, prefer Title from createParams if available
    fields.Title = createParams.Title || `Record ${new Date().toISOString()}`;

    // Process Date field (required)
    if (createParams.Date) {
      fields.Date = createParams.Date.toISOString();
    } else {
      // Default to current date if not provided
      this.logError(`[ERROR] Create failed: Date is a required field for a new record but was not provided in createParams.`);
      throw new Error("Date is required to create a staff record."); // Throw error if required date is missing
    }

    // Process shift times (optional)
    if (createParams.ShiftDate1) {
      fields.ShiftDate1 = createParams.ShiftDate1.toISOString();
    } else if (createParams.ShiftDate1 === null) { fields.ShiftDate1 = null; } // Allow clearing

    if (createParams.ShiftDate2) {
      fields.ShiftDate2 = createParams.ShiftDate2.toISOString();
    } else if (createParams.ShiftDate2 === null) { fields.ShiftDate2 = null; } // Allow clearing

    if (createParams.ShiftDate3 !== undefined) { // Check explicitly for undefined
        fields.ShiftDate3 = createParams.ShiftDate3?.toISOString() || null;
    } else if (createParams.ShiftDate3 === null) { fields.ShiftDate3 = null; } // Handle explicit null

    if (createParams.ShiftDate4 !== undefined) { // Check explicitly for undefined
        fields.ShiftDate4 = createParams.ShiftDate4?.toISOString() || null;
    } else if (createParams.ShiftDate4 === null) { fields.ShiftDate4 = null; } // Handle explicit null


    // Process numeric fields (use default if not provided)
    fields.TimeForLunch = createParams.TimeForLunch !== undefined ? createParams.TimeForLunch : 30;
    fields.Contract = createParams.Contract !== undefined ? createParams.Contract : 1;
    fields.Holiday = createParams.Holiday !== undefined ? createParams.Holiday : 0;
    fields.Deleted = createParams.Deleted !== undefined ? createParams.Deleted : 0;
    fields.Checked = createParams.Checked !== undefined ? createParams.Checked : 0;

    // Process string fields (optional)
    if (typeof createParams.ExportResult === 'string' || createParams.ExportResult === null) {
      fields.ExportResult = createParams.ExportResult;
    }


    // Process lookup fields with correct LookupId suffix
    // Type of Leave
    if (createParams.TypeOfLeaveID !== undefined) { // Check explicitly for undefined
      if (createParams.TypeOfLeaveID === '' || createParams.TypeOfLeaveID === null) {
         fields.TypeOfLeaveLookupId = null; // Clear lookup
         this.logInfo(`[DEBUG] Setting TypeOfLeaveLookupId to null`);
      } else {
        try {
          const typeOfLeaveId = parseInt(createParams.TypeOfLeaveID, 10);
          if (!isNaN(typeOfLeaveId)) {
            fields.TypeOfLeaveLookupId = typeOfLeaveId;
            this.logInfo(`[DEBUG] Setting TypeOfLeaveLookupId to ${typeOfLeaveId}`);
          } else {
             this.logError(`[ERROR] Invalid TypeOfLeaveID format for create: ${createParams.TypeOfLeaveID}`);
             // Decide whether to throw error or ignore field - ignoring for now
          }
        } catch (parseError) {
          this.logError(`[ERROR] Error parsing TypeOfLeaveID for create: ${parseError}`);
           // Decide whether to throw error or ignore field - ignoring for now
        }
      }
    }


    // Weekly Time Table
    if (createParams.WeeklyTimeTableID !== undefined) { // Check explicitly for undefined
       if (createParams.WeeklyTimeTableID === '' || createParams.WeeklyTimeTableID === null) {
           fields.WeeklyTimeTableLookupId = null; // Clear lookup
           this.logInfo(`[DEBUG] Setting WeeklyTimeTableLookupId to null`);
       } else {
         try {
           const weeklyTimeTableId = parseInt(String(createParams.WeeklyTimeTableID), 10);
           if (!isNaN(weeklyTimeTableId)) {
             fields.WeeklyTimeTableLookupId = weeklyTimeTableId;
             this.logInfo(`[DEBUG] Setting WeeklyTimeTableLookupId to ${weeklyTimeTableId}`);
           } else {
              this.logError(`[ERROR] Invalid WeeklyTimeTableID format for create: ${createParams.WeeklyTimeTableID}`);
               // Decide whether to throw error or ignore field - ignoring for now
           }
         } catch (parseError) {
           this.logError(`[ERROR] Error parsing WeeklyTimeTableID for create: ${parseError}`);
            // Decide whether to throw error or ignore field - ignoring for now
         }
       }
    } else {
       // WeeklyTimeTableID might be required depending on list schema.
       // If not provided, we log a warning. It defaults to null.
       this.logInfo(`[DEBUG] WeeklyTimeTableID not provided or empty string for create. Setting WeeklyTimeTableLookupId to null.`);
       fields.WeeklyTimeTableLookupId = null; // Explicitly set to null if not provided
    }

    // Staff Member (Employee) - required reference
    if (staffMemberID && String(staffMemberID).trim() !== '' && String(staffMemberID) !== '0') { // Ensure staffMemberID is provided and valid
      try {
        const staffMemberId = parseInt(String(staffMemberID), 10);
        if (!isNaN(staffMemberId)) {
          fields.StaffMemberLookupId = staffMemberId;
          this.logInfo(`[DEBUG] Setting StaffMemberLookupId to ${staffMemberId}`);
        } else {
          this.logError(`[ERROR] Invalid staffMemberID format for create: ${staffMemberID}`);
          throw new Error("Invalid Staff Member ID format."); // Throw error if invalid format
        }
      } catch (parseError) {
        this.logError(`[ERROR] Error parsing StaffMemberID for create: ${parseError}`);
         throw new Error(`Error parsing Staff Member ID: ${parseError instanceof Error ? parseError.message : String(parseError)}`); // Throw parsing error
      }
    } else {
      const errorMsg = `[ERROR] Staff Member ID is required for create but was not provided or is invalid: ${staffMemberID}`;
      this.logError(errorMsg);
      throw new Error(errorMsg); // Throw error if required ID is missing
    }


    // Manager (Current User) - optional reference
    if (currentUserID && String(currentUserID).trim() !== '' && String(currentUserID) !== '0') {
      try {
        const managerId = parseInt(String(currentUserID), 10);
        if (!isNaN(managerId)) {
          fields.ManagerLookupId = managerId;
          this.logInfo(`[DEBUG] Setting ManagerLookupId to ${managerId}`);
        } else {
          this.logError(`[ERROR] Invalid currentUserID format for create: ${currentUserID}`);
        }
      } catch (parseError) {
        this.logError(`[ERROR] Error parsing ManagerID for create: ${parseError}`);
      }
    } else {
      this.logInfo(`[DEBUG] No ManagerID provided or empty string. Record will be created without manager reference.`);
       fields.ManagerLookupId = null; // Explicitly set to null if not provided
    }


    // Staff Group - optional reference
    if (staffGroupID && String(staffGroupID).trim() !== '' && String(staffGroupID) !== '0') {
      try {
        const staffGroupId = parseInt(String(staffGroupID), 10);
        if (!isNaN(staffGroupId)) {
          fields.StaffGroupLookupId = staffGroupId;
          this.logInfo(`[DEBUG] Setting StaffGroupLookupId to ${staffGroupId}`);
        } else {
          this.logError(`[ERROR] Invalid staffGroupID format for create: ${staffGroupID}`);
        }
      } catch (parseError) {
        this.logError(`[ERROR] Error parsing StaffGroupID for create: ${parseError}`);
      }
    } else {
      this.logInfo(`[DEBUG] No StaffGroupID provided or empty string. Record will be created without staff group reference.`);
       fields.StaffGroupLookupId = null; // Explicitly set to null if not provided
    }


    // Log the complete field set for debugging
    this.logInfo(`[DEBUG] Prepared fields for creation: ${JSON.stringify(fields)}`);

    // Use the RemoteSiteService to create the item
    // RemoteSiteService.createListItem returns { id: string, fields: IRemoteListItemField }
    const result = await this._remoteSiteService.createListItem(this._listName, fields);

    if (result && result.id) {
      this.logInfo(`[DEBUG] Successfully created staff record with ID: ${result.id}`);
      return result.id.toString(); // Ensure string return
    } else {
      this.logError(`[DEBUG] Failed to create staff record, no ID returned in result`);
      // RemoteSiteService.createListItem might throw on network/API error,
      // but if it returns a result without an ID, that's also a failure.
      // Throw an error here to be caught by the calling code (e.g., mutation hook)
      throw new Error("Creation failed, no ID returned from service.");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    this.logError(`[ERROR] Error creating staff record: ${errorMessage}`);
     // Rethrow the error to be caught by the calling code (e.g., mutation hook)
    throw new Error(`Error creating staff record: ${errorMessage}`);
  }
}

  /**
   * Помечает запись как удаленную (soft delete)
   *
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async markRecordAsDeleted(recordId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Marking record ID: ${recordId} as deleted`);
      // updateStaffRecord throws error on failure, so we catch it here and return false
      await this.updateStaffRecord(recordId, { Deleted: 1 });
      return true; // If updateStaffRecord didn't throw, it was successful
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error marking record ID: ${recordId} as deleted: ${errorMessage}`);
      return false; // Return false on error
    }
  }

  /**
   * Восстанавливает ранее удаленную запись
   *
   * @param recordId ID записи для восстановления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async restoreDeletedRecord(recordId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Restoring deleted record ID: ${recordId}`);
       // updateStaffRecord throws error on failure, so we catch it here and return false
      await this.updateStaffRecord(recordId, { Deleted: 0 });
      return true; // If updateStaffRecord didn't throw, it was successful
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error restoring record ID: ${recordId}: ${errorMessage}`);
      return false; // Return false on error
    }
  }

  /**
   * Полностью удаляет запись из списка (hard delete)
   * Использует публичный метод deleteListItem из RemoteSiteService
   *
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = false)
   */
  public async deleteStaffRecord(recordId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Attempting hard delete of record ID: ${recordId} from the list`);

      // --- ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ МЕТОД RemoteSiteService.deleteListItem ---
      // Этот метод должен возвращать true/false или бросать ошибку.
      const success = await this._remoteSiteService.deleteListItem(this._listName, recordId);

      if (success) {
           this.logInfo(`[DEBUG] Successfully hard deleted record ID: ${recordId}`);
           return true;
      } else {
          // RemoteSiteService.deleteListItem вернул false
          this.logError(`[ERROR] RemoteSiteService.deleteListItem reported failure for ID: ${recordId}`);
          // Если хард-удаление не удалось, можем попробовать мягкое удаление как запасной вариант
          this.logInfo(`[DEBUG] Hard delete failed for ID: ${recordId}, falling back to soft delete.`);
           try {
               const softDeleteSuccess = await this.markRecordAsDeleted(recordId);
               if (softDeleteSuccess) {
                    this.logInfo(`[DEBUG] Soft delete fallback successful for ID: ${recordId}`);
                    return true; // Возвращаем true, т.к. мягкое удаление удалось
               } else {
                   this.logError(`[ERROR] Soft delete fallback also failed for ID: ${recordId} after hard delete exception.`);
                   return false; // Оба метода удаления не удались
               }
           } catch (softDeleteError) {
                const errorMessage = softDeleteError instanceof Error ? softDeleteError.message : String(softDeleteError);
                this.logError(`[ERROR] Exception during soft delete fallback for record ID: ${recordId}: ${errorMessage}`);
                return false;
           }
      }

    } catch (error) {
      // Это catch для исключений, брошенных RemoteSiteService.deleteListItem
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Exception during hard delete of record ID: ${recordId}: ${errorMessage}`);
      // Если хард-удаление бросило исключение, пробуем мягкое удаление как запасной вариант
       this.logInfo(`[DEBUG] Hard delete exception for ID: ${recordId}, falling back to soft delete.`);
       try {
           const softDeleteSuccess = await this.markRecordAsDeleted(recordId);
           if (softDeleteSuccess) {
                this.logInfo(`[DEBUG] Soft delete fallback successful for ID: ${recordId}`);
                return true; // Возвращаем true, т.к. мягкое удаление удалось
           } else {
               this.logError(`[ERROR] Soft delete fallback also failed for ID: ${recordId} after hard delete exception.`);
               return false; // Оба метода удаления не удались
           }
       } catch (softDeleteError) {
            const errorMessage = softDeleteError instanceof Error ? softDeleteError.message : String(softDeleteError);
            this.logError(`[ERROR] Exception during soft delete fallback for record ID: ${recordId}: ${errorMessage}`);
            return false;
       }
    }
  }


  /**
   * Получает одну запись расписания по ID
   *
   * @param recordId ID записи для получения
   * @returns Promise с записью или undefined при ошибке
   */
  public async getStaffRecordById(recordId: string | number): Promise<IStaffRecord | undefined> {
    try {
      this.logInfo(`[DEBUG] Getting staff record by ID: ${recordId} through fetch service`);

      // Fetch the raw item data using fetchService
      // fetchService.fetchStaffRecordById теперь возвращает Promise<IRawStaffRecord | undefined>
      const rawItem = await this._fetchService.fetchStaffRecordById(recordId);

      if (!rawItem) {
        this.logInfo(`[DEBUG] No raw record found with ID: ${recordId}`);
        return undefined;
      }

      // Convert the raw item to IStaffRecord format using the mapper
      // mapToStaffRecords expects an array, so wrap rawItem in an array
      // mapToStaffRecords вернет массив IStaffRecord[]
      const mappedRecords = this._mapperService.mapToStaffRecords([rawItem]);

      if (mappedRecords.length === 0) {
        this.logError(`[DEBUG] Failed to map raw record with ID: ${rawItem.ID || recordId}`); // Use rawItem.ID if available
        return undefined;
      }

      // Calculate work time for the mapped record (первый и единственный элемент в массиве)
      const recordWithWorkTime = this._calculationService.calculateWorkTime(mappedRecords[0]);

      this.logInfo(`[DEBUG] Successfully retrieved and processed record ID: ${recordWithWorkTime.ID}`); // Use ID from processed record

      return recordWithWorkTime;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error getting staff record ID: ${recordId}: ${errorMessage}`);
      // В случае ошибки при получении или обработке, возвращаем undefined
      return undefined;
    }
  }

  /**
   * Рассчитывает суммарное рабочее время для набора записей
   *
   * @param records Массив записей для расчета
   * @returns Суммарное рабочее время в минутах
   */
  public calculateTotalWorkTime(records: IStaffRecord[]): number {
    try {
      this.logInfo(`[DEBUG] Calculating total work time for ${records.length} records`);
      // Delegate calculation to the calculation service
      return this._calculationService.calculateTotalWorkTime(records);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error calculating total work time: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * Обновление поля Checked для записи
   * (Этот метод, кажется, отсутствовал в предыдущей версии StaffRecordsService,
   * но был в ScheduleTab. Возможно, его нужно добавить сюда?)
   * Если он уже есть, оставьте его.
   *
   * @param recordId ID записи
   * @param checked Значение флага проверки (1 = проверено, 0 = не проверено)
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
   public async updateCheckedStatus(
     recordId: string | number,
     checked: number
   ): Promise<boolean> {
     try {
       this.logInfo(`[DEBUG] Updating checked status for record ID: ${recordId} to ${checked}`);
       // updateStaffRecord throws error on failure, so we catch it here and return false
       await this.updateStaffRecord(recordId, { Checked: checked });
       return true; // If updateStaffRecord didn't throw, it was successful
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : String(error);
       this.logError(`[ERROR] Error updating checked status for record ID: ${recordId}: ${errorMessage}`);
       return false; // Return false on error
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

// Для обратной совместимости сохраняем экспорт интерфейсов из StaffRecordsInterfaces
export { IStaffRecord, IStaffRecordTypeOfLeave, IStaffRecordWeeklyTimeTable } from './StaffRecordsInterfaces';