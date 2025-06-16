// src/webparts/kpfaplus/services/StaffRecordsQueryService.ts
import {
  IStaffRecord,
  IStaffRecordsQueryParams,
  ISortOptions,
  IStaffRecordsResult,
  StaffRecordsSortType,
} from "./StaffRecordsInterfaces";
import { StaffRecordsFetchService } from "./StaffRecordsFetchService";
import { StaffRecordsMapperService } from "./StaffRecordsMapperService";
import { StaffRecordsCalculationService } from "./StaffRecordsCalculationService";
import { DateUtils } from "../components/CustomDatePicker/CustomDatePicker";

/**
 * Сервис для операций чтения данных расписания персонала
 * Отвечает за получение, фильтрацию, сортировку и расчет данных
 * 
 * ОБНОВЛЕНО: Добавлена нормализация дат через DateUtils для решения проблемы с 1 октября
 * ОБНОВЛЕНО: Добавлена поддержка числовых полей времени (ShiftDate1Hours, ShiftDate1Minutes, ShiftDate2Hours, ShiftDate2Minutes)
 */
export class StaffRecordsQueryService {
  private _logSource: string;
  private _fetchService: StaffRecordsFetchService;
  private _mapperService: StaffRecordsMapperService;
  private _calculationService: StaffRecordsCalculationService;

  /**
   * Конструктор сервиса запросов
   * @param fetchService Сервис получения данных
   * @param mapperService Сервис преобразования данных
   * @param calculationService Сервис расчетов
   * @param logSource Префикс для логов
   */
  constructor(
    fetchService: StaffRecordsFetchService,
    mapperService: StaffRecordsMapperService,
    calculationService: StaffRecordsCalculationService,
    logSource: string
  ) {
    this._fetchService = fetchService;
    this._mapperService = mapperService;
    this._calculationService = calculationService;
    this._logSource = logSource + ".Query";
    this.logInfo("StaffRecordsQueryService инициализирован с поддержкой DateUtils и числовых полей времени");
  }

  /**
   * Получение записей расписания персонала
   * Этот метод сохранен для обратной совместимости с текущим API
   * ИСПРАВЛЕНО: Добавлена нормализация дат для решения проблемы с 1 октября
   * ОБНОВЛЕНО: Записи теперь содержат числовые поля времени
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
      
      // ИСПРАВЛЕНО: Нормализуем даты через DateUtils для решения проблемы с 1 октября
      const normalizedStartDate = DateUtils.normalizeDateToUTCMidnight(startDate);
      const normalizedEndDate = DateUtils.normalizeDateToUTCMidnight(endDate);
      
      this.logInfo(`[DEBUG] Исходные даты: ${startDate.toISOString()} - ${endDate.toISOString()}`);
      this.logInfo(`[DEBUG] Нормализованные даты: ${normalizedStartDate.toISOString()} - ${normalizedEndDate.toISOString()}`);
      
      // Создаем параметры запроса с нормализованными датами
      const queryParams: IStaffRecordsQueryParams = {
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        currentUserID,
        staffGroupID,
        employeeID,
        timeTableID
      };

      // Используем getStaffRecordsWithOptions для выполнения запроса
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
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);
      return []; // Возвращаем пустой массив при ошибке
    }
  }

  /**
   * Получение записей расписания персонала с расширенными опциями, включая пагинацию.
   * ИСПРАВЛЕНО: Добавлена нормализация дат для решения проблемы с 1 октября
   * ОБНОВЛЕНО: Записи теперь содержат числовые поля времени
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
      // ИСПРАВЛЕНО: Нормализуем даты в queryParams для решения проблемы с 1 октября
      const normalizedStartDate = DateUtils.normalizeDateToUTCMidnight(queryParams.startDate);
      const normalizedEndDate = DateUtils.normalizeDateToUTCMidnight(queryParams.endDate);
      
      // Создаем нормализованные параметры запроса
      const normalizedQueryParams: IStaffRecordsQueryParams = {
        ...queryParams,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      };

      // Логируем начало выполнения метода с нормализованными датами
      this.logInfo(`[DEBUG] getStaffRecordsWithOptions ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${queryParams.startDate.toISOString()} → ${normalizedStartDate.toISOString()},
        endDate: ${queryParams.endDate.toISOString()} → ${normalizedEndDate.toISOString()},
        currentUserID: ${queryParams.currentUserID},
        staffGroupID: ${queryParams.staffGroupID},
        employeeID: ${queryParams.employeeID},
        timeTableID: ${queryParams.timeTableID || 'не указан'},
        skip: ${queryParams.skip !== undefined ? queryParams.skip : 'не указан'},
        top: ${queryParams.top !== undefined ? queryParams.top : 'не указан'},
        sortOptions: ${sortOptions ? JSON.stringify(sortOptions) : 'не указаны'}`
      );

      // Получаем сырые данные из API через сервис получения данных с нормализованными датами
      const fetchResult = await this._fetchService.fetchStaffRecords(normalizedQueryParams);

      // Проверяем наличие ошибки в fetchResult
      if (!fetchResult || fetchResult.items === undefined || fetchResult.totalCount === undefined) {
        const errorMsg = "Получены некорректные данные от fetchService.fetchStaffRecords";
        this.logError(`[ОШИБКА] ${errorMsg}`);
        return { records: [], totalCount: 0, error: errorMsg };
      }

      // Преобразуем СЫРЫЕ данные для ТЕКУЩЕЙ СТРАНИЦЫ в формат IStaffRecord
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
      return {
        records: sortedRecords,
        totalCount: fetchResult.totalCount,
        error: undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] Не удалось получить записи расписания с опциями: ${errorMessage}`);
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

      // В случае ошибки возвращаем объект с ошибкой и пустым результатом
      return {
        records: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Получение ВСЕХ записей расписания персонала за период БЕЗ ПАГИНАЦИИ.
   * ИСПРАВЛЕНО: Добавлена нормализация дат для решения проблемы с 1 октября
   * ОБНОВЛЕНО: Записи теперь содержат числовые поля времени
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
      // ИСПРАВЛЕНО: Нормализуем даты в queryParams для решения проблемы с 1 октября
      const normalizedStartDate = DateUtils.normalizeDateToUTCMidnight(queryParams.startDate);
      const normalizedEndDate = DateUtils.normalizeDateToUTCMidnight(queryParams.endDate);
      
      // Создаем нормализованные параметры запроса
      const normalizedQueryParams = {
        ...queryParams,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      };

      // Логируем начало выполнения метода с нормализованными датами
      this.logInfo(`[DEBUG] getAllStaffRecordsForTimetable ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${queryParams.startDate.toISOString()} → ${normalizedStartDate.toISOString()},
        endDate: ${queryParams.endDate.toISOString()} → ${normalizedEndDate.toISOString()},
        currentUserID: ${queryParams.currentUserID},
        staffGroupID: ${queryParams.staffGroupID},
        employeeID: ${queryParams.employeeID},
        timeTableID: ${queryParams.timeTableID || 'не указан'},
        sortOptions: ${sortOptions ? JSON.stringify(sortOptions) : 'не указаны'},
        NOTE: ЗАГРУЖАЕМ ВСЕ ДАННЫЕ БЕЗ ПАГИНАЦИИ`
      );

      // Получаем ВСЕ сырые данные из API через новый сервис получения данных с нормализованными датами
      const fetchResult = await this._fetchService.fetchAllStaffRecordsForTimetable(normalizedQueryParams);

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
        records: sortedRecords,
        totalCount: fetchResult.totalCount,
        error: undefined
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] Не удалось получить все записи расписания: ${errorMessage}`);
      console.error(`[${this._logSource}] [DEBUG] Подробности ошибки:`, error);

      // В случае ошибки возвращаем объект с ошибкой и пустым результатом
      return {
        records: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Получает ВСЕ АКТИВНЫЕ записи расписания (исключает Deleted=1)
   * ИСПРАВЛЕНО: Добавлена нормализация дат для решения проблемы с 1 октября
   * ОБНОВЛЕНО: Записи теперь содержат числовые поля времени
   */
  public async getAllActiveStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ records: IStaffRecord[]; totalCount: number; error?: string }> {
    try {
      // ИСПРАВЛЕНО: Нормализуем даты в queryParams для решения проблемы с 1 октября
      const normalizedStartDate = DateUtils.normalizeDateToUTCMidnight(queryParams.startDate);
      const normalizedEndDate = DateUtils.normalizeDateToUTCMidnight(queryParams.endDate);
      
      // Создаем нормализованные параметры запроса
      const normalizedQueryParams = {
        ...queryParams,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      };

      this.logInfo('[DEBUG] getAllActiveStaffRecordsForTimetable ВЫЗВАН С ПАРАМЕТРАМИ:');
      this.logInfo(`        startDate: ${queryParams.startDate.toISOString()} → ${normalizedStartDate.toISOString()}`);
      this.logInfo(`        endDate: ${queryParams.endDate.toISOString()} → ${normalizedEndDate.toISOString()}`);
      this.logInfo(`        currentUserID: ${queryParams.currentUserID}`);
      this.logInfo(`        staffGroupID: ${queryParams.staffGroupID}`);
      this.logInfo(`        employeeID: ${queryParams.employeeID}`);
      this.logInfo(`        timeTableID: ${queryParams.timeTableID || 'не указан'}`);
      this.logInfo(`        NOTE: ЗАГРУЖАЕМ ВСЕ АКТИВНЫЕ ДАННЫЕ БЕЗ ПАГИНАЦИИ (исключая Deleted=1)`);

      // Получаем ВСЕ активные элементы через новый метод fetchService с нормализованными датами
      const fetchResult = await this._fetchService.fetchAllActiveStaffRecordsForTimetable(normalizedQueryParams);
      
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

  /**
   * Получает записи расписания с заполненным типом отпуска
   * ИСПРАВЛЕНО: Добавлена нормализация дат для решения проблемы с 1 октября
   * ОБНОВЛЕНО: Записи теперь содержат числовые поля времени
   * 
   * @param queryParams Параметры запроса (без пагинации)
   * @returns Promise с результатами (записи с типом отпуска, исключая удаленные)
   */
  public async getStaffRecordsForSRSReports(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ records: IStaffRecord[]; totalCount: number; error?: string }> {
    try {
      // ИСПРАВЛЕНО: Нормализуем даты в queryParams для решения проблемы с 1 октября
      const normalizedStartDate = DateUtils.normalizeDateToUTCMidnight(queryParams.startDate);
      const normalizedEndDate = DateUtils.normalizeDateToUTCMidnight(queryParams.endDate);
      
      // Создаем нормализованные параметры запроса
      const normalizedQueryParams = {
        ...queryParams,
        startDate: normalizedStartDate,
        endDate: normalizedEndDate
      };

      this.logInfo('[DEBUG] getStaffRecordsForSRSReports ВЫЗВАН С ПАРАМЕТРАМИ:');
      this.logInfo(`        startDate: ${queryParams.startDate.toISOString()} → ${normalizedStartDate.toISOString()}`);
      this.logInfo(`        endDate: ${queryParams.endDate.toISOString()} → ${normalizedEndDate.toISOString()}`);
      this.logInfo(`        currentUserID: ${queryParams.currentUserID}`);
      this.logInfo(`        staffGroupID: ${queryParams.staffGroupID}`);
      this.logInfo(`        employeeID: ${queryParams.employeeID}`);
      this.logInfo(`        timeTableID: ${queryParams.timeTableID || 'не указан'}`);
      this.logInfo(`        NOTE: ЗАГРУЖАЕМ ЗАПИСИ С ТИПОМ ОТПУСКА (TypeOfLeave IS NOT NULL) БЕЗ УДАЛЕННЫХ`);

      // Получаем записи через новый метод fetchService специально для SRS Reports с нормализованными датами
      const fetchResult = await this._fetchService.fetchStaffRecordsForSRSReports(normalizedQueryParams);
      
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
   * Получает одну запись расписания по ID
   * ОБНОВЛЕНО: Запись теперь содержит числовые поля времени
   *
   * @param recordId ID записи для получения
   * @returns Promise с записью или undefined при ошибке
   */
  public async getStaffRecordById(recordId: string | number): Promise<IStaffRecord | undefined> {
    try {
      this.logInfo(`[DEBUG] Getting staff record by ID: ${recordId} through fetch service`);

      // Fetch the raw item data using fetchService
      const rawItem = await this._fetchService.fetchStaffRecordById(recordId);

      if (!rawItem) {
        this.logInfo(`[DEBUG] No raw record found with ID: ${recordId}`);
        return undefined;
      }

      // Convert the raw item to IStaffRecord format using the mapper
      const mappedRecords = this._mapperService.mapToStaffRecords([rawItem]);

      if (mappedRecords.length === 0) {
        this.logError(`[DEBUG] Failed to map raw record with ID: ${rawItem.ID || recordId}`);
        return undefined;
      }

      // Calculate work time for the mapped record
      const recordWithWorkTime = this._calculationService.calculateWorkTime(mappedRecords[0]);

      this.logInfo(`[DEBUG] Successfully retrieved and processed record ID: ${recordWithWorkTime.ID}`);

      return recordWithWorkTime;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error getting staff record ID: ${recordId}: ${errorMessage}`);
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
      const totalTime = this._calculationService.calculateTotalWorkTime(records);
      
      this.logInfo(`[DEBUG] Total work time calculated: ${totalTime} minutes for ${records.length} records`);
      
      return totalTime;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error calculating total work time: ${errorMessage}`);
      return 0;
    }
  }

  // ===============================================
  // LOGGING
  // ===============================================

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