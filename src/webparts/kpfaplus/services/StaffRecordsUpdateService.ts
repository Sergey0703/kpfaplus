// src/webparts/kpfaplus/services/StaffRecordsUpdateService.ts
import { RemoteSiteService } from "./RemoteSiteService";
import { IStaffRecordUpdateParams } from "./StaffRecordsInterfaces";

/**
 * Сервис для обновления и создания записей расписания персонала
 * Отвечает за операции создания, обновления, удаления и восстановления записей
 */
export class StaffRecordsUpdateService {
  private _remoteSiteService: RemoteSiteService;
  private _listName: string;
  private _logSource: string;

  /**
   * Конструктор сервиса обновления записей
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
    this._logSource = logSource + ".Update";
    this.logInfo("StaffRecordsUpdateService инициализирован");
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
      
      // Проверяем параметры
      if (!recordId) {
        this.logError("[ОШИБКА] Не указан ID записи для обновления");
        return false;
      }
      
      // Подготавливаем поля для обновления
      const fields = this.prepareFieldsForUpdate(updateParams);
      
      this.logInfo(`[DEBUG] Подготовлены поля для обновления: ${JSON.stringify(fields)}`);
      
      // Проверяем авторизацию RemoteSiteService
      if (!this._remoteSiteService.isAuthorized()) {
        await this._remoteSiteService.getGraphClient();
      }
      
      // Выполняем запрос на обновление
      const result = await this._remoteSiteService.updateListItem(
        this._listName,
        Number(recordId), // Преобразуем в число
        fields
      );
      
      if (result) {
        this.logInfo(`[DEBUG] Запись ID: ${recordId} успешно обновлена`);
      } else {
        this.logError(`[ОШИБКА] Не удалось обновить запись ID: ${recordId}`);
      }
      
      return result;
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка при обновлении записи ID: ${recordId}: ${error instanceof Error ? error.message : String(error)}`);
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
      
      // Проверяем обязательные параметры
      if (!createParams.date) {
        this.logError("[ОШИБКА] Не указана дата для новой записи");
        return undefined;
      }
      
      // Подготавливаем поля для создания
      const fields = this.prepareFieldsForCreate(createParams);
      
      this.logInfo(`[DEBUG] Подготовлены поля для создания: ${JSON.stringify(fields)}`);
      
      // Проверяем авторизацию RemoteSiteService
      if (!this._remoteSiteService.isAuthorized()) {
        await this._remoteSiteService.getGraphClient();
      }
      
      // Создаем запись
      const result = await this._remoteSiteService.createListItem(
        this._listName,
        fields
      );
      
      if (result && result.id) {
        this.logInfo(`[DEBUG] Создана новая запись с ID: ${result.id}`);
        return result.id.toString();
      } else {
        this.logError("[ОШИБКА] Не удалось создать новую запись");
        return undefined;
      }
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка при создании новой записи: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /**
   * Физически удаляет запись (полное удаление)
   * 
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async deleteStaffRecord(recordId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Физическое удаление записи ID: ${recordId}`);
      
      // Проверяем авторизацию RemoteSiteService
      if (!this._remoteSiteService.isAuthorized()) {
        await this._remoteSiteService.getGraphClient();
      }
      
      // Получаем Graph клиент
      const graphClient = await this._remoteSiteService.getGraphClient();
      
      // Получаем ID списка
      const listId = await this._remoteSiteService.getListId(this._listName);
      
      // Получаем ID сайта
      const siteId = this._remoteSiteService.getTargetSiteId();
      
      if (!siteId) {
        this.logError("[ОШИБКА] Не удалось получить ID сайта");
        return false;
      }
      
      // Выполняем запрос на удаление
      await graphClient
        .api(`/sites/${siteId}/lists/${listId}/items/${recordId}`)
        .delete();
      
      this.logInfo(`[DEBUG] Запись ID: ${recordId} успешно удалена физически`);
      return true;
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка при физическом удалении записи ID: ${recordId}: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Помечает запись как удаленную (soft delete)
   * 
   * @param recordId ID записи для пометки
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async markAsDeleted(recordId: string | number): Promise<boolean> {
    return this.updateStaffRecord(recordId, { deleted: 1 });
  }

  /**
   * Восстанавливает удаленную запись
   * 
   * @param recordId ID записи для восстановления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async restoreRecord(recordId: string | number): Promise<boolean> {
    return this.updateStaffRecord(recordId, { deleted: 0 });
  }

  /**
   * Обновление поля Checked для записи
   * 
   * @param recordId ID записи
   * @param checked Значение флага проверки (1 = проверено, 0 = не проверено)
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async updateCheckedStatus(
    recordId: string | number, 
    checked: number
  ): Promise<boolean> {
    return this.updateStaffRecord(recordId, { checked });
  }

  /**
   * Подготавливает объект полей для обновления записи, преобразуя
   * параметры из IStaffRecordUpdateParams в формат для SharePoint API
   * 
   * @param params Параметры обновления
   * @returns Объект с полями для запроса
   */
  private prepareFieldsForUpdate(params: IStaffRecordUpdateParams): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    
    // Преобразуем параметры в формат для SharePoint
    if (params.title !== undefined) {
      fields.Title = params.title;
    }
    
    if (params.date !== undefined) {
      fields.Date = params.date.toISOString();
    }
    
    if (params.shiftDate1 !== undefined) {
      fields.ShiftDate1 = params.shiftDate1 ? params.shiftDate1.toISOString() : null;
    }
    
    if (params.shiftDate2 !== undefined) {
      fields.ShiftDate2 = params.shiftDate2 ? params.shiftDate2.toISOString() : null;
    }
    
    if (params.shiftDate3 !== undefined) {
      fields.ShiftDate3 = params.shiftDate3 ? params.shiftDate3.toISOString() : null;
    }
    
    if (params.shiftDate4 !== undefined) {
      fields.ShiftDate4 = params.shiftDate4 ? params.shiftDate4.toISOString() : null;
    }
    
    if (params.timeForLunch !== undefined) {
      fields.TimeForLunch = params.timeForLunch;
    }
    
    if (params.contract !== undefined) {
      fields.Contract = params.contract;
    }
    
    if (params.holiday !== undefined) {
      fields.Holiday = params.holiday;
    }
    
    if (params.typeOfLeaveID !== undefined) {
      fields.TypeOfLeaveId = params.typeOfLeaveID;
    }
    
    if (params.weeklyTimeTableID !== undefined) {
      fields.WeeklyTimeTableId = params.weeklyTimeTableID;
    }
    
    if (params.deleted !== undefined) {
      fields.Deleted = params.deleted;
    }
    
    if (params.checked !== undefined) {
      fields.Checked = params.checked;
    }
    
    if (params.exportResult !== undefined) {
      fields.ExportResult = params.exportResult;
    }
    
    return fields;
  }

  /**
   * Подготавливает объект полей для создания записи, преобразуя
   * параметры из IStaffRecordUpdateParams в формат для SharePoint API
   * с обязательными полями
   * 
   * @param params Параметры создания
   * @returns Объект с полями для запроса
   */
  private prepareFieldsForCreate(params: IStaffRecordUpdateParams): Record<string, unknown> {
    // Сначала подготавливаем все поля как для обновления
    const fields = this.prepareFieldsForUpdate(params);
    
    // Добавляем обязательные поля, если они отсутствуют
    if (!fields.Title) {
      // Генерируем заголовок по дате, если не указан
      if (params.date) {
        fields.Title = params.date.toLocaleDateString();
      } else {
        fields.Title = new Date().toLocaleDateString();
      }
    }
    
    // Обязательно должна быть дата
    if (!fields.Date) {
      fields.Date = params.date ? params.date.toISOString() : new Date().toISOString();
    }
    
    // Устанавливаем флаги по умолчанию, если не указаны
    if (fields.Deleted === undefined) {
      fields.Deleted = 0;
    }
    
    if (fields.Checked === undefined) {
      fields.Checked = 0;
    }
    
    // Устанавливаем номер контракта по умолчанию, если не указан
    if (fields.Contract === undefined) {
      fields.Contract = 1;
    }
    
    return fields;
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