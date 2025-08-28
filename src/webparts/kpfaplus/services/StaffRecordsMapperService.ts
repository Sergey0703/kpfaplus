// src/webparts/kpfaplus/services/StaffRecordsMapperService.ts
import { 
    IStaffRecord,
    IStaffRecordTypeOfLeave,
    IStaffRecordWeeklyTimeTable
  } from "./StaffRecordsInterfaces";
  
  /**
   * Сервис для преобразования данных из SharePoint в бизнес-модели
   * Отвечает за маппинг, валидацию и нормализацию данных
   * 
   * ОБНОВЛЕНО: ВСЕ поля дат теперь Date-only (без времени) - убрана UTC нормализация
   * ОБНОВЛЕНО: Добавлена поддержка числовых полей времени для ScheduleTab
   * ИСПРАВЛЕНО: Убрана избыточная обработка ВСЕХ полей дат через DateUtils
   */
  export class StaffRecordsMapperService {
    private _logSource: string;
  
    /**
     * Конструктор сервиса преобразования данных
     * @param logSource Префикс для логов
     */
    constructor(logSource: string) {
      this._logSource = logSource + ".Mapper";
      this.logInfo("StaffRecordsMapperService инициализирован с поддержкой Date-only полей и числовых полей времени");
    }
  
    /**
     * Преобразует сырые данные из SharePoint в массив объектов IStaffRecord
     * ИСПРАВЛЕНО: ВСЕ поля дат теперь обрабатываются как Date-only (без UTC нормализации)
     * 
     * @param rawItems Сырые данные из SharePoint
     * @returns Массив объектов IStaffRecord
     */
    public mapToStaffRecords(rawItems: unknown[]): IStaffRecord[] {
      try {
        this.logInfo(`[DEBUG] mapToStaffRecords: Начинаем преобразование ${rawItems.length} сырых элементов с Date-only полями`);
  
        // Маппинг сырых данных в формат IStaffRecord
        const mappedItems = rawItems.map((item, index) => {
          try {
            const rawItem = item as { id: string | number; fields?: Record<string, unknown> };
            const fields = rawItem.fields || {};
            
            // Логируем структуру каждого 5-го элемента (чтобы не перегружать логи)
            if (index % 5 === 0) {
              this.logInfo(`[DEBUG] Обрабатываем элемент #${index}, ID: ${rawItem.id}`);
              this.logInfo(`[DEBUG] Поля элемента #${index}: ${Object.keys(fields).join(', ')}`);
            }
            
            // Преобразуем все поля из сырых данных
            const staffRecord = this.mapSingleStaffRecord(rawItem.id, fields, index);
            
            // Логируем созданную запись для каждого 10-го элемента
            if (index % 10 === 0) {
              this.logInfo(`[DEBUG] Создана запись для элемента #${index}, ID: ${staffRecord.ID}, Date: ${staffRecord.Date.toLocaleDateString()}`);
            }
            
            return staffRecord;
          } catch (itemError) {
            this.logError(`[ОШИБКА] Ошибка обработки элемента #${index}: ${itemError instanceof Error ? itemError.message : String(itemError)}`);
            // Возвращаем undefined для фильтрации неудачных элементов
            return undefined;
          }
        });
  
        // Фильтруем неопределенные элементы
        const filteredItems = mappedItems.filter((item): item is IStaffRecord => item !== undefined);
        this.logInfo(`[DEBUG] mapToStaffRecords: Преобразовано ${filteredItems.length} элементов из ${rawItems.length} исходных с Date-only полями`);
  
        return filteredItems;
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании элементов расписания: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    }
  
    /**
     * Преобразует одну сырую запись в структурированный объект IStaffRecord
     * ОБНОВЛЕНО: Поле Date теперь Date-only, время смен хранится в числовых полях
     * УДАЛЕНО: ShiftDate1-4 поля больше не используются
     * 
     * @param id Идентификатор записи
     * @param fields Поля записи
     * @param index Индекс записи в общем массиве (для логов)
     * @returns Структурированный объект IStaffRecord
     */
    private mapSingleStaffRecord(
      id: string | number, 
      fields: Record<string, unknown>,
      index: number
    ): IStaffRecord {
      // Парсим только основную дату (Date-only)
      const mainDate = this.parseMainDate(fields.Date as string, index, 'Date');
      
      // Получаем информацию о типе отпуска
      const { typeOfLeaveID, typeOfLeave } = this.extractTypeOfLeave(fields.TypeOfLeaveLookupId, index);
      
      // Получаем информацию о недельном расписании из правильного поля
      const { weeklyTimeTableID, weeklyTimeTable, weeklyTimeTableTitle } = 
        this.extractWeeklyTimeTable(fields.WeeklyTimeTableLookupId, index);
      
      // Создаем объект IStaffRecord с преобразованными данными
      return {
        ID: id.toString(),
        Deleted: this.ensureNumber(fields.Deleted, 0),
        Checked: this.ensureNumber(fields.Checked, 0),
        ExportResult: this.ensureNumber(fields.ExportResult,0),
        Title: this.ensureString(fields.Title),
        Date: mainDate, // Date-only поле
        
        // УДАЛЕНО: ShiftDate1-4 поля больше не используются
        ShiftDate1: undefined,
        ShiftDate2: undefined,
        ShiftDate3: undefined,
        ShiftDate4: undefined,
        
        // Числовые поля времени (основные для времени смен)
        ShiftDate1Hours: this.ensureNumber(fields.ShiftDate1Hours),
        ShiftDate1Minutes: this.ensureNumber(fields.ShiftDate1Minutes),
        ShiftDate2Hours: this.ensureNumber(fields.ShiftDate2Hours),
        ShiftDate2Minutes: this.ensureNumber(fields.ShiftDate2Minutes),
        ShiftDate3Hours: this.ensureNumber(fields.ShiftDate3Hours),
        ShiftDate3Minutes: this.ensureNumber(fields.ShiftDate3Minutes),
        ShiftDate4Hours: this.ensureNumber(fields.ShiftDate4Hours),
        ShiftDate4Minutes: this.ensureNumber(fields.ShiftDate4Minutes),
        
        TimeForLunch: this.ensureNumber(fields.TimeForLunch, 0),
        Contract: this.ensureNumber(fields.Contract, 1),
        Holiday: this.ensureNumber(fields.Holiday, 0),
        LeaveTime: this.ensureNumber(fields.LeaveTime, 0),
        TypeOfLeaveID: typeOfLeaveID,
        TypeOfLeave: typeOfLeave,
        StaffMemberLookupId: this.ensureString(fields.StaffMemberLookupId),
        WeeklyTimeTableID: weeklyTimeTableID,
        WeeklyTimeTable: weeklyTimeTable,
        WeeklyTimeTableTitle: weeklyTimeTableTitle
      };
    }

    /**
     * ОБНОВЛЕНО: Парсинг основной даты записи БЕЗ нормализации времени
     * Поле Date теперь Date-only, поэтому НЕ нормализуем к полуночи UTC
     * 
     * @param dateString Строка с датой из SharePoint
     * @param index Индекс записи (для логов)
     * @param fieldName Название поля (для логов)
     * @returns Объект Date БЕЗ UTC нормализации
     */
    private parseMainDate(dateString: string | undefined, index: number, fieldName: string): Date {
      try {
        if (!dateString) {
          this.logError(`[ОШИБКА] Отсутствует обязательное поле ${fieldName} для элемента #${index}`);
          // Возвращаем текущую дату без нормализации как запасной вариант
          return new Date();
        }
        
        // Парсим дату из SharePoint (обычно в ISO формате)
        const parsedDate = new Date(dateString);
        if (isNaN(parsedDate.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ${fieldName} для элемента #${index}: ${dateString}`);
          return new Date();
        }

        // ИСПРАВЛЕНО: Поле Date теперь Date-only - НЕ нормализуем к полуночи UTC
        // Возвращаем дату как есть, так как SharePoint теперь хранит только дату без времени
        const dateOnlyResult = parsedDate;
        
        // Логируем только если есть изменения (каждый 20-й элемент для экономии логов)
        if (index % 20 === 0) {
          this.logInfo(`[DEBUG] ${fieldName} элемента #${index} (Date-only): ${dateString} → ${dateOnlyResult.toISOString()}`);
          this.logInfo(`[DEBUG] No UTC normalization applied (Date-only field)`);
        }
        
        return dateOnlyResult;
      } catch (dateError) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ${fieldName} для элемента #${index}: ${dateError}`);
        return new Date();
      }
    }



    /**
     * Извлекает информацию о типе отпуска из правильного поля TypeOfLeaveLookupId
     */
    private extractTypeOfLeave(typeOfLeaveRaw: unknown, index: number): {
      typeOfLeaveID: string;
      typeOfLeave: IStaffRecordTypeOfLeave | undefined;
    } {
      let typeOfLeave: IStaffRecordTypeOfLeave | undefined = undefined;
      let typeOfLeaveID = '';
      
      // TypeOfLeaveLookupId приходит как строка или число
      if (typeOfLeaveRaw) {
        if (typeof typeOfLeaveRaw === 'string' || typeof typeOfLeaveRaw === 'number') {
          typeOfLeaveID = String(typeOfLeaveRaw);
          if (index % 50 === 0) { // Логируем каждый 50-й для экономии
            this.logInfo(`[DEBUG] Элемент #${index}: Extracted TypeOfLeaveID from LookupId: ${typeOfLeaveID}`);
          }
          
          // Создаем минимальный объект TypeOfLeave с ID
          typeOfLeave = {
            Id: typeOfLeaveID,
            Title: `Type ${typeOfLeaveID}` // Название будет заменено при полной загрузке данных
          };
        }
        // Обрабатываем случай, если все-таки придет объект (для backward compatibility)
        else if (typeof typeOfLeaveRaw === 'object' && typeOfLeaveRaw !== null) {
          const typeData = typeOfLeaveRaw as { Id?: string | number; Title?: string };
          typeOfLeaveID = typeData.Id?.toString() || '';
          
          if (typeOfLeaveID && typeData.Title) {
            typeOfLeave = {
              Id: typeOfLeaveID,
              Title: typeData.Title.toString()
            };
          }
        }
      }
      
      return { typeOfLeaveID, typeOfLeave };
    }
  
    /**
     * Извлекает информацию о недельном расписании из правильного поля WeeklyTimeTableLookupId
     * 
     * @param weeklyTimeTableRaw Сырые данные недельного расписания (WeeklyTimeTableLookupId)
     * @param index Индекс записи (для логов)
     * @returns Объект с ID, названием и структурированным объектом недельного расписания
     */
    private extractWeeklyTimeTable(weeklyTimeTableRaw: unknown, index: number): {
      weeklyTimeTableID: string;
      weeklyTimeTable: IStaffRecordWeeklyTimeTable | undefined;
      weeklyTimeTableTitle: string;
    } {
      let weeklyTimeTable: IStaffRecordWeeklyTimeTable | undefined = undefined;
      let weeklyTimeTableID = '';
      let weeklyTimeTableTitle = '';
      
      if (weeklyTimeTableRaw) {
        if (index % 50 === 0) { // Логируем каждый 50-й для экономии
          this.logInfo(`[DEBUG] Элемент #${index} имеет поле WeeklyTimeTableLookupId: ${JSON.stringify(weeklyTimeTableRaw)}`);
        }
        
        // WeeklyTimeTableLookupId приходит как строка или число
        if (typeof weeklyTimeTableRaw === 'string' || typeof weeklyTimeTableRaw === 'number') {
          weeklyTimeTableID = String(weeklyTimeTableRaw);
          if (index % 50 === 0) {
            this.logInfo(`[DEBUG] Элемент #${index}: Extracted WeeklyTimeTableID from LookupId: ${weeklyTimeTableID}`);
          }
          
          // Создаем минимальный объект WeeklyTimeTable с ID
          weeklyTimeTable = {
            Id: weeklyTimeTableID,
            Title: `Contract ${weeklyTimeTableID}` // Название будет заменено при полной загрузке данных
          };
          weeklyTimeTableTitle = `Contract ${weeklyTimeTableID}`;
        }
        // Обрабатываем случай, если все-таки придет объект (для backward compatibility)
        else if (typeof weeklyTimeTableRaw === 'object' && weeklyTimeTableRaw !== null) {
          const tableData = weeklyTimeTableRaw as { Id?: string | number; Title?: string };
          weeklyTimeTableID = tableData.Id?.toString() || '';
          
          if (weeklyTimeTableID && tableData.Title) {
            weeklyTimeTable = {
              Id: weeklyTimeTableID,
              Title: tableData.Title.toString()
            };
            weeklyTimeTableTitle = tableData.Title.toString();
          }
        }
      } else {
        // Логируем случаи, когда поле отсутствует (только каждый 100-й для экономии)
        if (index % 100 === 0) {
          this.logInfo(`[DEBUG] Элемент #${index}: WeeklyTimeTableLookupId отсутствует или пустое`);
        }
      }
      
      return { weeklyTimeTableID, weeklyTimeTable, weeklyTimeTableTitle };
    }
  
    /**
     * Вспомогательный метод для преобразования значения в строку
     * @param value Значение для преобразования
     * @param defaultValue Значение по умолчанию (опционально)
     * @returns Строковое представление значения
     */
    private ensureString(value: unknown, defaultValue: string = ''): string {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      
      if (typeof value === 'string') {
        return value;
      }
      
      if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
      }
      
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value);
        } catch (error) {
          this.logError(`[ОШИБКА] Ошибка преобразования объекта в строку: ${error instanceof Error ? error.message : String(error)}`);
          return defaultValue;
        }
      }
      
      return defaultValue;
    }
  
    /**
     * Вспомогательный метод для преобразования значения в число
     * @param value Значение для преобразования
     * @param defaultValue Значение по умолчанию (опционально)
     * @returns Числовое представление значения
     */
    private ensureNumber(value: unknown, defaultValue: number = 0): number {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      
      if (typeof value === 'number') {
        return value;
      }
      
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        return isNaN(parsed) ? defaultValue : parsed;
      }
      
      if (typeof value === 'boolean') {
        return value ? 1 : 0;
      }
      
      return defaultValue;
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