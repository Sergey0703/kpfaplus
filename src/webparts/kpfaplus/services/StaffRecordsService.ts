// src/webparts/kpfaplus/services/StaffRecordsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { 
  IStaffRecord, 
  IStaffRecordsQueryParams, 
  ISortOptions,
  IStaffRecordsResult,
  StaffRecordsSortType
} from "./StaffRecordsInterfaces";
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
    if (updateData.ShiftDate1) {
      fields.ShiftDate1 = updateData.ShiftDate1.toISOString();
    }
    if (updateData.ShiftDate2) {
      fields.ShiftDate2 = updateData.ShiftDate2.toISOString();
    }
    if (updateData.ShiftDate3) {
      fields.ShiftDate3 = updateData.ShiftDate3?.toISOString() || null;
    }
    if (updateData.ShiftDate4) {
      fields.ShiftDate4 = updateData.ShiftDate4?.toISOString() || null;
    }
    
    // Process numeric fields
    if (typeof updateData.TimeForLunch === 'number') {
      fields.TimeForLunch = updateData.TimeForLunch;
    }
    if (typeof updateData.Contract === 'number') {
      fields.Contract = updateData.Contract;
    }
    if (typeof updateData.Holiday === 'number') {
      fields.Holiday = updateData.Holiday;
    }
    if (typeof updateData.Deleted === 'number') {
      fields.Deleted = updateData.Deleted;
    }
    if (typeof updateData.Checked === 'number') {
      fields.Checked = updateData.Checked;
    }
    
    // Process string fields
    if (updateData.Title) {
      fields.Title = updateData.Title;
    }
    if (updateData.ExportResult) {
      fields.ExportResult = updateData.ExportResult;
    }
    
    // REMOVE THIS: Do not include WorkTime as it's not a field in the SharePoint list
    // if (updateData.WorkTime) {
    //   fields.WorkTime = updateData.WorkTime;
    // }
    
    // Handle lookup fields
    if (updateData.TypeOfLeaveID) {
      // For TypeOfLeave, we need to use the lookup field format
      fields.TypeOfLeave = parseInt(updateData.TypeOfLeaveID, 10);
    } else if (updateData.TypeOfLeaveID === '') {
      // If explicitly set to empty string, clear the lookup
      fields.TypeOfLeave = null;
    }
    
    if (updateData.WeeklyTimeTableID) {
      fields.WeeklyTimeTable = parseInt(updateData.WeeklyTimeTableID, 10);
    }
    
    this.logInfo(`[DEBUG] Prepared fields for update: ${JSON.stringify(fields)}`);
    
    // Use the RemoteSiteService to update the item
    const success = await this._remoteSiteService.updateListItem(
      this._listName,
      Number(recordId),
      fields
    );
    
    if (success) {
      this.logInfo(`[DEBUG] Successfully updated staff record ID: ${recordId}`);
    } else {
      this.logError(`[DEBUG] Failed to update staff record ID: ${recordId}`);
    }
    
    return success;
  } catch (error) {
    this.logError(`[ERROR] Error updating staff record ID: ${recordId}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
  /**
   * Создает новую запись расписания
   * 
   * @param createParams Параметры для создания записи
   * @returns Promise с ID созданной записи или undefined при ошибке
   */
  public async createStaffRecord(
    createParams: Partial<IStaffRecord>
  ): Promise<string | undefined> {
    try {
      this.logInfo(`[DEBUG] Creating new staff record`);
      
      // Convert the createParams to the format expected by the SharePoint API
      const fields: Record<string, unknown> = {};
      
      // Set default title if not provided
      fields.Title = createParams.Title || `Record ${new Date().toISOString()}`;
      
      // Process Date fields
      if (createParams.Date) {
        fields.Date = createParams.Date.toISOString();
      } else {
        // Default to current date if not provided
        fields.Date = new Date().toISOString();
      }
      
      // Process shift times
      if (createParams.ShiftDate1) {
        fields.ShiftDate1 = createParams.ShiftDate1.toISOString();
      }
      if (createParams.ShiftDate2) {
        fields.ShiftDate2 = createParams.ShiftDate2.toISOString();
      }
      if (createParams.ShiftDate3) {
        fields.ShiftDate3 = createParams.ShiftDate3?.toISOString();
      }
      if (createParams.ShiftDate4) {
        fields.ShiftDate4 = createParams.ShiftDate4?.toISOString();
      }
      
      // Process numeric fields
      fields.TimeForLunch = createParams.TimeForLunch !== undefined ? createParams.TimeForLunch : 30;
      fields.Contract = createParams.Contract !== undefined ? createParams.Contract : 1;
      fields.Holiday = createParams.Holiday !== undefined ? createParams.Holiday : 0;
      fields.Deleted = createParams.Deleted !== undefined ? createParams.Deleted : 0;
      fields.Checked = createParams.Checked !== undefined ? createParams.Checked : 0;
      
      // Process lookup fields
      if (createParams.TypeOfLeaveID) {
        fields.TypeOfLeave = parseInt(createParams.TypeOfLeaveID, 10);
      }
      
      if (createParams.WeeklyTimeTableID) {
        fields.WeeklyTimeTable = parseInt(createParams.WeeklyTimeTableID, 10);
      }
      
      // Add required references if not provided
      if (!fields.StaffMember && createParams.WeeklyTimeTableID) {
        // Try to extract staff member from WeeklyTimeTable
        try {
          // This method doesn't exist, so we need to implement an alternative approach
          // or remove this code until the method is available
          
          // Commented out since getListItem doesn't exist on RemoteSiteService
          /*
          const weeklyTimeTable = await this._remoteSiteService.getListItem(
            'WeeklyTimeTables',
            createParams.WeeklyTimeTableID,
            true
          );
          
          if (weeklyTimeTable?.fields?.StaffMember) {
            fields.StaffMember = weeklyTimeTable.fields.StaffMember;
          }
          */
        } catch (error) {
          this.logError(`[DEBUG] Error getting WeeklyTimeTable info: ${error}`);
          // Continue without StaffMember if retrieval fails
        }
      }
      
      this.logInfo(`[DEBUG] Prepared fields for creation: ${JSON.stringify(fields)}`);
      
      // Use the RemoteSiteService to create the item
      const result = await this._remoteSiteService.createListItem(this._listName, fields);
      
      if (result && result.id) {
        this.logInfo(`[DEBUG] Successfully created staff record with ID: ${result.id}`);
        return result.id;
      } else {
        this.logError(`[DEBUG] Failed to create staff record, no ID returned`);
        return undefined;
      }
    } catch (error) {
      this.logError(`[ERROR] Error creating staff record: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
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
      return await this.updateStaffRecord(recordId, { Deleted: 1 });
    } catch (error) {
      this.logError(`[ERROR] Error marking record ID: ${recordId} as deleted: ${error instanceof Error ? error.message : String(error)}`);
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
      this.logInfo(`[DEBUG] Restoring deleted record ID: ${recordId}`);
      return await this.updateStaffRecord(recordId, { Deleted: 0 });
    } catch (error) {
      this.logError(`[ERROR] Error restoring record ID: ${recordId}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Полностью удаляет запись из списка (hard delete)
   * Использует обычное обновление с флагом Deleted = 1, так как прямое удаление не реализовано
   * 
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async deleteStaffRecord(recordId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Deleting record ID: ${recordId} from the list`);
      
      // Since RemoteSiteService doesn't have a deleteListItem method,
      // we'll use markRecordAsDeleted instead
      return await this.markRecordAsDeleted(recordId);
    } catch (error) {
      this.logError(`[ERROR] Error deleting staff record ID: ${recordId}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
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
      this.logInfo(`[DEBUG] Getting staff record by ID: ${recordId}`);
      
      // Fetch the raw item data
      const rawItem = await this._fetchService.fetchStaffRecordById(recordId);
      
      if (!rawItem) {
        this.logInfo(`[DEBUG] No record found with ID: ${recordId}`);
        return undefined;
      }
      
      // Convert the raw item to IStaffRecord format
      const mappedRecords = this._mapperService.mapToStaffRecords([rawItem]);
      
      if (mappedRecords.length === 0) {
        this.logError(`[DEBUG] Failed to map record with ID: ${recordId}`);
        return undefined;
      }
      
      // Calculate work time for the record
      const recordWithWorkTime = this._calculationService.calculateWorkTime(mappedRecords[0]);
      
      this.logInfo(`[DEBUG] Successfully retrieved and processed record ID: ${recordId}`);
      
      return recordWithWorkTime;
    } catch (error) {
      this.logError(`[ERROR] Error getting staff record ID: ${recordId}: ${error instanceof Error ? error.message : String(error)}`);
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
      return this._calculationService.calculateTotalWorkTime(records);
    } catch (error) {
      this.logError(`[ERROR] Error calculating total work time: ${error instanceof Error ? error.message : String(error)}`);
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