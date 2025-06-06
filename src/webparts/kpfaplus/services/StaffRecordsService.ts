// src/webparts/kpfaplus/services/StaffRecordsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import {
  IStaffRecord,
  IStaffRecordsQueryParams,
  ISortOptions,
  IStaffRecordsResult,
} from "./StaffRecordsInterfaces";

import { StaffRecordsFetchService } from "./StaffRecordsFetchService";
import { StaffRecordsMapperService } from "./StaffRecordsMapperService";
import { StaffRecordsCalculationService } from "./StaffRecordsCalculationService";
import { StaffRecordsQueryService } from "./StaffRecordsQueryService";
import { StaffRecordsCommandService } from "./StaffRecordsCommandService";

/**
 * Основной сервис для работы с записями расписания персонала.
 * Этот класс координирует работу специализированных сервисов и предоставляет
 * единый интерфейс для взаимодействия с данными записей сотрудников.
 * 
 * РЕФАКТОРИНГ: Теперь работает как фасад, делегируя операции специализированным сервисам:
 * - StaffRecordsQueryService: все операции чтения
 * - StaffRecordsCommandService: все операции записи
 */
export class StaffRecordsService {
  private static _instance: StaffRecordsService;
  private _logSource: string = "StaffRecordsService";
  private _listName: string = "StaffRecords";
  private _remoteSiteService: RemoteSiteService;

  // Базовые специализированные сервисы
  private _fetchService: StaffRecordsFetchService;
  private _mapperService: StaffRecordsMapperService;
  private _calculationService: StaffRecordsCalculationService;

  // Новые агрегированные сервисы
  private _queryService: StaffRecordsQueryService;
  private _commandService: StaffRecordsCommandService;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    console.log('[StaffRecordsService] Инициализация рефакторенного сервиса с контекстом');
    
    // Инициализируем RemoteSiteService
    this._remoteSiteService = RemoteSiteService.getInstance(context);

    // Инициализируем базовые специализированные сервисы
    this._fetchService = new StaffRecordsFetchService(this._remoteSiteService, this._listName, this._logSource);
    this._mapperService = new StaffRecordsMapperService(this._logSource);
    this._calculationService = new StaffRecordsCalculationService(this._logSource);

    // Инициализируем агрегированные сервисы
    this._queryService = new StaffRecordsQueryService(
      this._fetchService,
      this._mapperService,
      this._calculationService,
      this._logSource
    );

    this._commandService = new StaffRecordsCommandService(
      this._remoteSiteService,
      this._listName,
      this._logSource
    );

    this.logInfo("StaffRecordsService рефакторен и инициализирован с агрегированными сервисами");
  }

  /**
   * Получение экземпляра сервиса (Singleton паттерн)
   * @param context Контекст веб-части
   * @returns Экземпляр StaffRecordsService
   */
  public static getInstance(context: WebPartContext): StaffRecordsService {
    if (!StaffRecordsService._instance) {
      console.log('[StaffRecordsService] Создание нового экземпляра рефакторенного сервиса');
      StaffRecordsService._instance = new StaffRecordsService(context);
    } else {
      console.log('[StaffRecordsService] Возврат существующего экземпляра рефакторенного сервиса');
    }
    return StaffRecordsService._instance;
  }

  // ===============================================
  // QUERY OPERATIONS (delegated to QueryService)
  // ===============================================

  /**
   * Получение записей расписания персонала
   * Метод для обратной совместимости - делегирует вызов QueryService
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
    this.logInfo(`[FACADE] Delegating getStaffRecords to QueryService`);
    return this._queryService.getStaffRecords(
      startDate,
      endDate,
      currentUserID,
      staffGroupID,
      employeeID,
      timeTableID
    );
  }

  /**
   * Получение записей расписания персонала с расширенными опциями, включая пагинацию
   * Делегирует вызов QueryService
   *
   * @param queryParams Параметры запроса, включая пагинацию (skip, top)
   * @param sortOptions Опции сортировки (опционально)
   * @returns Promise с результатами запроса (записи для страницы и общее количество)
   */
  public async getStaffRecordsWithOptions(
    queryParams: IStaffRecordsQueryParams,
    sortOptions?: ISortOptions
  ): Promise<IStaffRecordsResult> {
    this.logInfo(`[FACADE] Delegating getStaffRecordsWithOptions to QueryService`);
    return this._queryService.getStaffRecordsWithOptions(queryParams, sortOptions);
  }

  /**
   * Получение ВСЕХ записей расписания персонала за период БЕЗ ПАГИНАЦИИ
   * Делегирует вызов QueryService
   * 
   * @param queryParams Параметры запроса (без skip/top)
   * @param sortOptions Опции сортировки (опционально)
   * @returns Promise с результатами запроса (ВСЕ записи и общее количество)
   */
  public async getAllStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>,
    sortOptions?: ISortOptions
  ): Promise<IStaffRecordsResult> {
    this.logInfo(`[FACADE] Delegating getAllStaffRecordsForTimetable to QueryService`);
    return this._queryService.getAllStaffRecordsForTimetable(queryParams, sortOptions);
  }

  /**
   * Получает ВСЕ АКТИВНЫЕ записи расписания (исключает Deleted=1)
   * Делегирует вызов QueryService
   */
  public async getAllActiveStaffRecordsForTimetable(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ records: IStaffRecord[]; totalCount: number; error?: string }> {
    this.logInfo(`[FACADE] Delegating getAllActiveStaffRecordsForTimetable to QueryService`);
    return this._queryService.getAllActiveStaffRecordsForTimetable(queryParams);
  }

  /**
   * Получает записи расписания с заполненным типом отпуска
   * Делегирует вызов QueryService
   * 
   * @param queryParams Параметры запроса (без пагинации)
   * @returns Promise с результатами (записи с типом отпуска, исключая удаленные)
   */
  public async getStaffRecordsForSRSReports(
    queryParams: Omit<IStaffRecordsQueryParams, 'skip' | 'top' | 'nextLink'>
  ): Promise<{ records: IStaffRecord[]; totalCount: number; error?: string }> {
    this.logInfo(`[FACADE] Delegating getStaffRecordsForSRSReports to QueryService`);
    return this._queryService.getStaffRecordsForSRSReports(queryParams);
  }

  /**
   * Получает одну запись расписания по ID
   * Делегирует вызов QueryService
   *
   * @param recordId ID записи для получения
   * @returns Promise с записью или undefined при ошибке
   */
  public async getStaffRecordById(recordId: string | number): Promise<IStaffRecord | undefined> {
    this.logInfo(`[FACADE] Delegating getStaffRecordById to QueryService for ID: ${recordId}`);
    return this._queryService.getStaffRecordById(recordId);
  }

  /**
   * Рассчитывает суммарное рабочее время для набора записей
   * Делегирует вызов QueryService
   *
   * @param records Массив записей для расчета
   * @returns Суммарное рабочее время в минутах
   */
  public calculateTotalWorkTime(records: IStaffRecord[]): number {
    this.logInfo(`[FACADE] Delegating calculateTotalWorkTime to QueryService for ${records.length} records`);
    return this._queryService.calculateTotalWorkTime(records);
  }

  // ===============================================
  // COMMAND OPERATIONS (delegated to CommandService)
  // ===============================================

  /**
   * Обновляет запись расписания
   * Делегирует вызов CommandService
   *
   * @param recordId ID записи для обновления
   * @param updateData Параметры обновления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async updateStaffRecord(
    recordId: string | number,
    updateData: Partial<IStaffRecord>
  ): Promise<boolean> {
    this.logInfo(`[FACADE] Delegating updateStaffRecord to CommandService for ID: ${recordId}`);
    return this._commandService.updateStaffRecord(recordId, updateData);
  }

  /**
   * Creates a new staff record
   * Делегирует вызов CommandService
   *
   * @param createParams Параметры для staff record creation
   * @param currentUserID ID of the current user (Manager)
   * @param staffGroupID ID of the staff group
   * @param staffMemberID ID of the staff member (Employee)
   * @returns Promise with the ID of the created record or undefined on error
   */
  public async createStaffRecord(
    createParams: Partial<IStaffRecord>,
    currentUserID?: string | number,
    staffGroupID?: string | number,
    staffMemberID?: string | number
  ): Promise<string | undefined> {
    this.logInfo(`[FACADE] Delegating createStaffRecord to CommandService`);
    return this._commandService.createStaffRecord(createParams, currentUserID, staffGroupID, staffMemberID);
  }

  /**
   * Помечает запись как удаленную (soft delete)
   * Делегирует вызов CommandService
   *
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async markRecordAsDeleted(recordId: string | number): Promise<boolean> {
    this.logInfo(`[FACADE] Delegating markRecordAsDeleted to CommandService for ID: ${recordId}`);
    return this._commandService.markRecordAsDeleted(recordId);
  }

  /**
   * Восстанавливает ранее удаленную запись
   * Делегирует вызов CommandService
   *
   * @param recordId ID записи для восстановления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async restoreDeletedRecord(recordId: string | number): Promise<boolean> {
    this.logInfo(`[FACADE] Delegating restoreDeletedRecord to CommandService for ID: ${recordId}`);
    return this._commandService.restoreDeletedRecord(recordId);
  }

  /**
   * Полностью удаляет запись из списка (hard delete)
   * Делегирует вызов CommandService
   *
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async deleteStaffRecord(recordId: string | number): Promise<boolean> {
    this.logInfo(`[FACADE] Delegating deleteStaffRecord to CommandService for ID: ${recordId}`);
    return this._commandService.deleteStaffRecord(recordId);
  }

  /**
   * Обновление поля Checked для записи
   * Делегирует вызов CommandService
   *
   * @param recordId ID записи
   * @param checked Значение флага проверки (1 = проверено, 0 = не проверено)
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async updateCheckedStatus(
    recordId: string | number,
    checked: number
  ): Promise<boolean> {
    this.logInfo(`[FACADE] Delegating updateCheckedStatus to CommandService for ID: ${recordId}`);
    return this._commandService.updateCheckedStatus(recordId, checked);
  }

  // ===============================================
  // SERVICE ACCESS METHODS (for advanced usage)
  // ===============================================

  /**
   * Предоставляет доступ к QueryService для расширенного использования
   * @returns Экземпляр StaffRecordsQueryService
   */
  public getQueryService(): StaffRecordsQueryService {
    return this._queryService;
  }

  /**
   * Предоставляет доступ к CommandService для расширенного использования
   * @returns Экземпляр StaffRecordsCommandService
   */
  public getCommandService(): StaffRecordsCommandService {
    return this._commandService;
  }

  /**
   * Предоставляет доступ к FetchService для расширенного использования
   * @returns Экземпляр StaffRecordsFetchService
   */
  public getFetchService(): StaffRecordsFetchService {
    return this._fetchService;
  }

  /**
   * Предоставляет доступ к MapperService для расширенного использования
   * @returns Экземпляр StaffRecordsMapperService
   */
  public getMapperService(): StaffRecordsMapperService {
    return this._mapperService;
  }

  /**
   * Предоставляет доступ к CalculationService для расширенного использования
   * @returns Экземпляр StaffRecordsCalculationService
   */
  public getCalculationService(): StaffRecordsCalculationService {
    return this._calculationService;
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


}

// Для обратной совместимости сохраняем экспорт интерфейсов из StaffRecordsInterfaces
export { IStaffRecord, IStaffRecordTypeOfLeave, IStaffRecordWeeklyTimeTable } from './StaffRecordsInterfaces';