// src/webparts/kpfaplus/services/StaffRecordsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { 
  IStaffRecord, 
  IStaffRecordsQueryParams, 
  ISortOptions,
  IStaffRecordUpdateParams,
  IStaffRecordsResult,
  StaffRecordsSortType
} from "./StaffRecordsInterfaces";
import { StaffRecordsFetchService } from "./StaffRecordsFetchService";
import { StaffRecordsMapperService } from "./StaffRecordsMapperService";
import { StaffRecordsCalculationService } from "./StaffRecordsCalculationService";
import { StaffRecordsUpdateService } from "./StaffRecordsUpdateService";

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
  private _updateService: StaffRecordsUpdateService;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    console.log('[StaffRecordsService] Инициализация сервиса с контекстом');
    // Инициализируем RemoteSiteService
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    
    // Инициализируем специализированные сервисы
    this._fetchService = new StaffRecordsFetchService(this._remoteSiteService, this._listName, this._logSource);
    this._mapperService = new StaffRecordsMapperService(this._logSource);
    this._calculationService = new StaffRecordsCalculationService(this._logSource);
    this._updateService = new StaffRecordsUpdateService(this._remoteSiteService, this._listName, this._logSource);
    
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
      // Логируем начало выполнения метода
      this.logInfo(`[DEBUG] getStaffRecords ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${startDate.toISOString()},
        endDate: ${endDate.toISOString()},
        currentUserID: ${currentUserID} (тип: ${typeof currentUserID}),
        staffGroupID: ${staffGroupID} (тип: ${typeof staffGroupID}),
        employeeID: ${employeeID} (тип: ${typeof employeeID}),
        timeTableID: ${timeTableID || 'не указан'} (тип: ${typeof timeTableID})`
      );

      // Создаем параметры запроса
      const queryParams: IStaffRecordsQueryParams = {
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeID,
        timeTableID
      };

      // Получаем сырые данные из API через сервис получения данных
      const rawItems = await this._fetchService.fetchStaffRecords(queryParams);
      
      this.logInfo(`Получено ${rawItems.length} элементов расписания из SharePoint`);
      
      // Преобразуем сырые данные в формат IStaffRecord
      const mappedRecords = this._mapperService.mapToStaffRecords(rawItems);
      
      this.logInfo(`Успешно преобразовано ${mappedRecords.length} элементов расписания`);
      
      // Рассчитываем рабочее время для каждой записи
      const recordsWithWorkTime = mappedRecords.map(record => 
        this._calculationService.calculateWorkTime(record)
      );
      
      // Сортируем записи по дате, порядку сортировки и времени начала
      const sortOptions: ISortOptions = {
        type: StaffRecordsSortType.ByDate,
        ascending: true
      };
      
      const sortedRecords = this._calculationService.sortStaffRecords(recordsWithWorkTime, sortOptions);
      
      this.logInfo(`Возвращаем ${sortedRecords.length} обработанных записей расписания`);
      
      // Логируем первую запись после обработки (если есть)
      if (sortedRecords.length > 0) {
        this.logInfo(`[DEBUG] Пример первой обработанной записи:
          ID: ${sortedRecords[0].ID}
          Date: ${sortedRecords[0].Date.toLocaleDateString()}
          SortOrder: ${sortedRecords[0].SortOrder}
          WorkTime: ${sortedRecords[0].WorkTime}
          Start: ${sortedRecords[0].ShiftDate1 ? sortedRecords[0].ShiftDate1.toLocaleTimeString() : 'N/A'}
          End: ${sortedRecords[0].ShiftDate2 ? sortedRecords[0].ShiftDate2.toLocaleTimeString() : 'N/A'}
          TypeOfLeaveID: ${sortedRecords[0].TypeOfLeaveID}
          WeeklyTimeTableTitle: ${sortedRecords[0].WeeklyTimeTableTitle}`
        );
      }
      
      return sortedRecords;
    } catch (error) {
      this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] Не удалось получить записи расписания: ${error instanceof Error ? error.message : String(error)}`);
      console.error('[StaffRecordsService] [DEBUG] Подробности ошибки:', error);
      
      // В случае ошибки возвращаем пустой массив
      return [];
    }
  }

  /**
   * Получение записей расписания персонала с расширенными опциями
   * 
   * @param queryParams Параметры запроса
   * @param sortOptions Опции сортировки (опционально)
   * @returns Promise с результатами запроса
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
        sortOptions: ${sortOptions ? JSON.stringify(sortOptions) : 'не указаны'}`
      );
      
      // Получаем сырые данные из API
      const rawItems = await this._fetchService.fetchStaffRecords(queryParams);
      
      // Преобразуем сырые данные в формат IStaffRecord
      const mappedRecords = this._mapperService.mapToStaffRecords(rawItems);
      
      // Рассчитываем рабочее время для каждой записи
      const recordsWithWorkTime = mappedRecords.map(record => 
        this._calculationService.calculateWorkTime(record)
      );
      
      // Сортируем записи согласно опциям или по умолчанию
      const defaultSortOptions: ISortOptions = sortOptions || {
        type: StaffRecordsSortType.ByDate,
        ascending: true
      };
      
      const sortedRecords = this._calculationService.sortStaffRecords(
        recordsWithWorkTime, 
        defaultSortOptions
      );
      
      this.logInfo(`[DEBUG] Получено и обработано ${sortedRecords.length} записей расписания`);
      
      // Формируем и возвращаем результат
      return {
        records: sortedRecords,
        totalCount: sortedRecords.length
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] Не удалось получить записи расписания: ${errorMessage}`);
      
      // В случае ошибки возвращаем объект с ошибкой
      return {
        records: [],
        totalCount: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Обновляет запись расписания
   * 
   * @param recordId ID записи для обновления
   * @param updateParams Параметры обновления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async updateStaffRecord(
    recordId: string | number, 
    updateParams: IStaffRecordUpdateParams
  ): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Обновление записи ID: ${recordId}`);
      return await this._updateService.updateStaffRecord(recordId, updateParams);
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось обновить запись ID: ${recordId}: ${error}`);
      return false;
    }
  }

  /**
   * Создает новую запись расписания
   * 
   * @param createParams Параметры для создания записи
   * @returns Promise с ID созданной записи или undefined при ошибке
   */
  public async createStaffRecord(
    createParams: IStaffRecordUpdateParams
  ): Promise<string | undefined> {
    try {
      this.logInfo(`[DEBUG] Создание новой записи расписания`);
      return await this._updateService.createStaffRecord(createParams);
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось создать новую запись: ${error}`);
      return undefined;
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
      this.logInfo(`[DEBUG] Пометка записи ID: ${recordId} как удаленной`);
      return await this._updateService.updateStaffRecord(recordId, { deleted: 1 });
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось пометить запись ID: ${recordId} как удаленную: ${error}`);
      return false;
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
      this.logInfo(`[DEBUG] Восстановление удаленной записи ID: ${recordId}`);
      return await this._updateService.updateStaffRecord(recordId, { deleted: 0 });
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось восстановить запись ID: ${recordId}: ${error}`);
      return false;
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
      this.logInfo(`[DEBUG] Расчет общего рабочего времени для ${records.length} записей`);
      return this._calculationService.calculateTotalWorkTime(records);
    } catch (error) {
      this.logError(`[ОШИБКА] Не удалось рассчитать общее рабочее время: ${error}`);
      return 0;
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

// Для обратной совместимости сохраняем экспорт интерфейсов из базового файла
export { IStaffRecord, IStaffRecordTypeOfLeave, IStaffRecordWeeklyTimeTable } from './StaffRecordsInterfaces';