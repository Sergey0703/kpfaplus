// src/webparts/kpfaplus/services/StaffRecordsCommandService.ts
import { IStaffRecord } from "./StaffRecordsInterfaces";
import { RemoteSiteService } from "./RemoteSiteService";

/**
 * Сервис для операций записи данных расписания персонала
 * Отвечает за создание, обновление и удаление записей
 * 
 * ОБНОВЛЕНО: Поле Date теперь Date-only (без времени)
 * УДАЛЕНО: Поддержка полей ShiftDate1-4 (больше не используются)
 * ОБНОВЛЕНО: Добавлена поддержка числовых полей времени для ScheduleTab
 */
export class StaffRecordsCommandService {
  private _logSource: string;
  private _remoteSiteService: RemoteSiteService;
  private _listName: string;

  /**
   * Конструктор сервиса команд
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
    this._logSource = logSource + ".Command";
    this.logInfo("StaffRecordsCommandService инициализирован с Date-only полями и числовыми полями времени");
  }

  /**
   * Обновляет запись расписания
   * ОБНОВЛЕНО: Поле Date теперь Date-only (без времени)
   * УДАЛЕНО: Поддержка полей ShiftDate1-4
   * ОБНОВЛЕНО: Добавлена поддержка числовых полей времени
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

      // ОБНОВЛЕНО: Process Date field as Date-only (без нормализации времени)
      if (updateData.Date) {
        // Поле Date теперь Date-only - сохраняем как есть без нормализации времени
        fields.Date = updateData.Date.toISOString();
        this.logInfo(`[DEBUG] Date-only field: ${updateData.Date.toISOString()}`);
      }

      // НОВОЕ: Process numeric time fields
      if (updateData.ShiftDate1Hours !== undefined) {
        fields.ShiftDate1Hours = updateData.ShiftDate1Hours;
        this.logInfo(`[DEBUG] Setting ShiftDate1Hours to ${updateData.ShiftDate1Hours}`);
      }
      if (updateData.ShiftDate1Minutes !== undefined) {
        fields.ShiftDate1Minutes = updateData.ShiftDate1Minutes;
        this.logInfo(`[DEBUG] Setting ShiftDate1Minutes to ${updateData.ShiftDate1Minutes}`);
      }
      if (updateData.ShiftDate2Hours !== undefined) {
        fields.ShiftDate2Hours = updateData.ShiftDate2Hours;
        this.logInfo(`[DEBUG] Setting ShiftDate2Hours to ${updateData.ShiftDate2Hours}`);
      }
      if (updateData.ShiftDate2Minutes !== undefined) {
        fields.ShiftDate2Minutes = updateData.ShiftDate2Minutes;
        this.logInfo(`[DEBUG] Setting ShiftDate2Minutes to ${updateData.ShiftDate2Minutes}`);
      }
      if (updateData.ShiftDate3Hours !== undefined) {
        fields.ShiftDate3Hours = updateData.ShiftDate3Hours;
        this.logInfo(`[DEBUG] Setting ShiftDate3Hours to ${updateData.ShiftDate3Hours}`);
      }
      if (updateData.ShiftDate3Minutes !== undefined) {
        fields.ShiftDate3Minutes = updateData.ShiftDate3Minutes;
        this.logInfo(`[DEBUG] Setting ShiftDate3Minutes to ${updateData.ShiftDate3Minutes}`);
      }
      if (updateData.ShiftDate4Hours !== undefined) {
        fields.ShiftDate4Hours = updateData.ShiftDate4Hours;
        this.logInfo(`[DEBUG] Setting ShiftDate4Hours to ${updateData.ShiftDate4Hours}`);
      }
      if (updateData.ShiftDate4Minutes !== undefined) {
        fields.ShiftDate4Minutes = updateData.ShiftDate4Minutes;
        this.logInfo(`[DEBUG] Setting ShiftDate4Minutes to ${updateData.ShiftDate4Minutes}`);
      }

      // Process numeric fields
      if (updateData.TimeForLunch !== undefined) {
        fields.TimeForLunch = updateData.TimeForLunch === null ? null : updateData.TimeForLunch;
      }
      if (updateData.Contract !== undefined) {
        fields.Contract = updateData.Contract === null ? null : updateData.Contract;
      }
      if (updateData.Holiday !== undefined) {
        fields.Holiday = updateData.Holiday === null ? null : updateData.Holiday;
      }
      if (updateData.Deleted !== undefined) {
        fields.Deleted = updateData.Deleted;
      }
      if (updateData.Checked !== undefined) {
        fields.Checked = updateData.Checked;
      }
      if (updateData.LeaveTime !== undefined) {
        fields.LeaveTime = updateData.LeaveTime === null ? null : updateData.LeaveTime;
      }

      // Process string fields
      if (updateData.Title !== undefined) {
        fields.Title = updateData.Title;
      }
      if (updateData.ExportResult !== undefined) {
        fields.ExportResult = updateData.ExportResult;
      }

      // Handle lookup fields (using LookupId suffix)
      if (updateData.TypeOfLeaveID !== undefined) {
        if (updateData.TypeOfLeaveID === '' || updateData.TypeOfLeaveID === null) {
          fields.TypeOfLeaveLookupId = null;
          this.logInfo(`[DEBUG] Clearing TypeOfLeaveLookupId`);
        } else {
          try {
            const typeOfLeaveId = parseInt(updateData.TypeOfLeaveID, 10);
            if (!isNaN(typeOfLeaveId)) {
              fields.TypeOfLeaveLookupId = typeOfLeaveId;
              this.logInfo(`[DEBUG] Setting TypeOfLeaveLookupId to ${typeOfLeaveId}`);
            } else {
              this.logError(`[ERROR] Invalid TypeOfLeaveID format for update: ${updateData.TypeOfLeaveID}`);
            }
          } catch (parseError) {
            this.logError(`[ERROR] Error parsing TypeOfLeaveID for update: ${parseError}`);
          }
        }
      }

      if (updateData.WeeklyTimeTableID !== undefined) {
        if (updateData.WeeklyTimeTableID === '' || updateData.WeeklyTimeTableID === null) {
          fields.WeeklyTimeTableLookupId = null;
          this.logInfo(`[DEBUG] Clearing WeeklyTimeTableLookupId`);
        } else {
          try {
            const weeklyTimeTableId = parseInt(String(updateData.WeeklyTimeTableID), 10);
            if (!isNaN(weeklyTimeTableId)) {
              fields.WeeklyTimeTableLookupId = weeklyTimeTableId;
              this.logInfo(`[DEBUG] Setting WeeklyTimeTableLookupId to ${weeklyTimeTableId}`);
            } else {
              this.logError(`[ERROR] Invalid WeeklyTimeTableID format for update: ${updateData.WeeklyTimeTableID}`);
            }
          } catch (parseError) {
            this.logError(`[ERROR] Error parsing WeeklyTimeTableID for update: ${parseError}`);
          }
        }
      }

      this.logInfo(`[DEBUG] Prepared fields for update: ${JSON.stringify(fields)}`);

      // Check if there are any fields to update
      if (Object.keys(fields).length === 0) {
        this.logInfo(`[DEBUG] No fields to update for record ID: ${recordId}. Skipping update call.`);
        return true;
      }

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
        throw new Error(`Update failed for record ID: ${recordId}`);
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error updating staff record ID: ${recordId}: ${errorMessage}`);
      throw new Error(`Error updating staff record ID: ${recordId}: ${errorMessage}`);
    }
  }

  /**
   * Creates a new staff record
   * ОБНОВЛЕНО: Поле Date теперь Date-only (без времени)
   * УДАЛЕНО: Поддержка полей ShiftDate1-4
   * ОБНОВЛЕНО: Добавлена поддержка числовых полей времени
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
    try {
      this.logInfo(`[DEBUG] Creating new staff record with IDs:
        staffMemberID=${staffMemberID} (${typeof staffMemberID})
        currentUserID=${currentUserID} (${typeof currentUserID})
        staffGroupID=${staffGroupID} (${typeof staffGroupID})
      `);

      // Convert the createParams to the format expected by the SharePoint API
      const fields: Record<string, unknown> = {};

      // Set default title if not provided
      fields.Title = createParams.Title || `Record ${new Date().toISOString()}`;

      // ОБНОВЛЕНО: Process Date field (required) as Date-only (без нормализации времени)
      if (createParams.Date) {
        // Поле Date теперь Date-only - сохраняем как есть без нормализации времени
        fields.Date = createParams.Date.toISOString();
        this.logInfo(`[DEBUG] create Date-only field: ${createParams.Date.toISOString()}`);
      } else {
        this.logError(`[ERROR] Create failed: Date is a required field for a new record but was not provided in createParams.`);
        throw new Error("Date is required to create a staff record.");
      }

      // НОВОЕ: Process numeric time fields for creation
      if (createParams.ShiftDate1Hours !== undefined) {
        fields.ShiftDate1Hours = createParams.ShiftDate1Hours;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate1Hours to ${createParams.ShiftDate1Hours}`);
      }
      if (createParams.ShiftDate1Minutes !== undefined) {
        fields.ShiftDate1Minutes = createParams.ShiftDate1Minutes;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate1Minutes to ${createParams.ShiftDate1Minutes}`);
      }
      if (createParams.ShiftDate2Hours !== undefined) {
        fields.ShiftDate2Hours = createParams.ShiftDate2Hours;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate2Hours to ${createParams.ShiftDate2Hours}`);
      }
      if (createParams.ShiftDate2Minutes !== undefined) {
        fields.ShiftDate2Minutes = createParams.ShiftDate2Minutes;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate2Minutes to ${createParams.ShiftDate2Minutes}`);
      }
      if (createParams.ShiftDate3Hours !== undefined) {
        fields.ShiftDate3Hours = createParams.ShiftDate3Hours;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate3Hours to ${createParams.ShiftDate3Hours}`);
      }
      if (createParams.ShiftDate3Minutes !== undefined) {
        fields.ShiftDate3Minutes = createParams.ShiftDate3Minutes;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate3Minutes to ${createParams.ShiftDate3Minutes}`);
      }
      if (createParams.ShiftDate4Hours !== undefined) {
        fields.ShiftDate4Hours = createParams.ShiftDate4Hours;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate4Hours to ${createParams.ShiftDate4Hours}`);
      }
      if (createParams.ShiftDate4Minutes !== undefined) {
        fields.ShiftDate4Minutes = createParams.ShiftDate4Minutes;
        this.logInfo(`[DEBUG] Create: Setting ShiftDate4Minutes to ${createParams.ShiftDate4Minutes}`);
      }

      // Process numeric fields (use default if not provided)
      fields.TimeForLunch = createParams.TimeForLunch !== undefined ? createParams.TimeForLunch : 30;
      fields.Contract = createParams.Contract !== undefined ? createParams.Contract : 1;
      fields.Holiday = createParams.Holiday !== undefined ? createParams.Holiday : 0;
      fields.Deleted = createParams.Deleted !== undefined ? createParams.Deleted : 0;
      fields.Checked = createParams.Checked !== undefined ? createParams.Checked : 0;
      fields.LeaveTime = createParams.LeaveTime !== undefined ? createParams.LeaveTime : 0;

      // Process string fields (optional)
      if (typeof createParams.ExportResult === 'string' || createParams.ExportResult === null) {
        fields.ExportResult = createParams.ExportResult;
      }

      // Process lookup fields with correct LookupId suffix
      // Type of Leave
      if (createParams.TypeOfLeaveID !== undefined) {
        if (createParams.TypeOfLeaveID === '' || createParams.TypeOfLeaveID === null) {
          fields.TypeOfLeaveLookupId = null;
          this.logInfo(`[DEBUG] Setting TypeOfLeaveLookupId to null`);
        } else {
          try {
            const typeOfLeaveId = parseInt(createParams.TypeOfLeaveID, 10);
            if (!isNaN(typeOfLeaveId)) {
              fields.TypeOfLeaveLookupId = typeOfLeaveId;
              this.logInfo(`[DEBUG] Setting TypeOfLeaveLookupId to ${typeOfLeaveId}`);
            } else {
              this.logError(`[ERROR] Invalid TypeOfLeaveID format for create: ${createParams.TypeOfLeaveID}`);
            }
          } catch (parseError) {
            this.logError(`[ERROR] Error parsing TypeOfLeaveID for create: ${parseError}`);
          }
        }
      }

      // Weekly Time Table
      if (createParams.WeeklyTimeTableID !== undefined) {
        if (createParams.WeeklyTimeTableID === '' || createParams.WeeklyTimeTableID === null) {
          fields.WeeklyTimeTableLookupId = null;
          this.logInfo(`[DEBUG] Setting WeeklyTimeTableLookupId to null`);
        } else {
          try {
            const weeklyTimeTableId = parseInt(String(createParams.WeeklyTimeTableID), 10);
            if (!isNaN(weeklyTimeTableId)) {
              fields.WeeklyTimeTableLookupId = weeklyTimeTableId;
              this.logInfo(`[DEBUG] Setting WeeklyTimeTableLookupId to ${weeklyTimeTableId}`);
            } else {
              this.logError(`[ERROR] Invalid WeeklyTimeTableID format for create: ${createParams.WeeklyTimeTableID}`);
            }
          } catch (parseError) {
            this.logError(`[ERROR] Error parsing WeeklyTimeTableID for create: ${parseError}`);
          }
        }
      } else {
        this.logInfo(`[DEBUG] WeeklyTimeTableID not provided or empty string for create. Setting WeeklyTimeTableLookupId to null.`);
        fields.WeeklyTimeTableLookupId = null;
      }

      // Staff Member (Employee) - required reference
      if (staffMemberID && String(staffMemberID).trim() !== '' && String(staffMemberID) !== '0') {
        try {
          const staffMemberId = parseInt(String(staffMemberID), 10);
          if (!isNaN(staffMemberId)) {
            fields.StaffMemberLookupId = staffMemberId;
            this.logInfo(`[DEBUG] Setting StaffMemberLookupId to ${staffMemberId}`);
          } else {
            this.logError(`[ERROR] Invalid staffMemberID format for create: ${staffMemberID}`);
            throw new Error("Invalid Staff Member ID format.");
          }
        } catch (parseError) {
          this.logError(`[ERROR] Error parsing StaffMemberID for create: ${parseError}`);
          throw new Error(`Error parsing Staff Member ID: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
        }
      } else {
        const errorMsg = `[ERROR] Staff Member ID is required for create but was not provided or is invalid: ${staffMemberID}`;
        this.logError(errorMsg);
        throw new Error(errorMsg);
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
        fields.ManagerLookupId = null;
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
        fields.StaffGroupLookupId = null;
      }

      // Log the complete field set for debugging
      this.logInfo(`[DEBUG] *** FINAL CREATE FIELDS WITH NUMERIC TIME FIELDS ***`);
      this.logInfo(`[DEBUG] Date-only field: ${fields.Date}`);
      this.logInfo(`[DEBUG] Numeric time fields: Start=${fields.ShiftDate1Hours}:${fields.ShiftDate1Minutes}, End=${fields.ShiftDate2Hours}:${fields.ShiftDate2Minutes}`);
      this.logInfo(`[DEBUG] All fields: ${JSON.stringify(fields)}`);

      // Use the RemoteSiteService to create the item
      const result = await this._remoteSiteService.createListItem(this._listName, fields);

      if (result && result.id) {
        this.logInfo(`[DEBUG] Successfully created staff record with ID: ${result.id}`);
        this.logInfo(`[DEBUG] *** RECORD CREATED WITH NUMERIC TIME FIELDS AND DATE-ONLY ***`);
        return result.id.toString();
      } else {
        this.logError(`[DEBUG] Failed to create staff record, no ID returned in result`);
        throw new Error("Creation failed, no ID returned from service.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error creating staff record: ${errorMessage}`);
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
      await this.updateStaffRecord(recordId, { Deleted: 1 });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error marking record ID: ${recordId} as deleted: ${errorMessage}`);
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
      await this.updateStaffRecord(recordId, { Deleted: 0 });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error restoring record ID: ${recordId}: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Полностью удаляет запись из списка (hard delete)
   * Использует публичный метод deleteListItem из RemoteSiteService
   *
   * @param recordId ID записи для удаления
   * @returns Promise с результатом операции (true = успех, false = ошибка)
   */
  public async deleteStaffRecord(recordId: string | number): Promise<boolean> {
    try {
      this.logInfo(`[DEBUG] Attempting hard delete of record ID: ${recordId} from the list`);

      const success = await this._remoteSiteService.deleteListItem(this._listName, recordId);

      if (success) {
        this.logInfo(`[DEBUG] Successfully hard deleted record ID: ${recordId}`);
        return true;
      } else {
        this.logError(`[ERROR] RemoteSiteService.deleteListItem reported failure for ID: ${recordId}`);
        this.logInfo(`[DEBUG] Hard delete failed for ID: ${recordId}, falling back to soft delete.`);
        try {
          const softDeleteSuccess = await this.markRecordAsDeleted(recordId);
          if (softDeleteSuccess) {
            this.logInfo(`[DEBUG] Soft delete fallback successful for ID: ${recordId}`);
            return true;
          } else {
            this.logError(`[ERROR] Soft delete fallback also failed for ID: ${recordId} after hard delete failure.`);
            return false;
          }
        } catch (softDeleteError) {
          const errorMessage = softDeleteError instanceof Error ? softDeleteError.message : String(softDeleteError);
          this.logError(`[ERROR] Exception during soft delete fallback for record ID: ${recordId}: ${errorMessage}`);
          return false;
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Exception during hard delete of record ID: ${recordId}: ${errorMessage}`);
      this.logInfo(`[DEBUG] Hard delete exception for ID: ${recordId}, falling back to soft delete.`);
      try {
        const softDeleteSuccess = await this.markRecordAsDeleted(recordId);
        if (softDeleteSuccess) {
          this.logInfo(`[DEBUG] Soft delete fallback successful for ID: ${recordId}`);
          return true;
        } else {
          this.logError(`[ERROR] Soft delete fallback also failed for ID: ${recordId} after hard delete exception.`);
          return false;
        }
      } catch (softDeleteError) {
        const errorMessage = softDeleteError instanceof Error ? softDeleteError.message : String(softDeleteError);
        this.logError(`[ERROR] Exception during soft delete fallback for record ID: ${recordId}: ${errorMessage}`);
        return false;
      }
    }
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
    try {
      this.logInfo(`[DEBUG] Updating checked status for record ID: ${recordId} to ${checked}`);
      await this.updateStaffRecord(recordId, { Checked: checked });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ERROR] Error updating checked status for record ID: ${recordId}: ${errorMessage}`);
      return false;
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