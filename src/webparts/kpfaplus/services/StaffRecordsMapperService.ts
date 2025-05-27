// src/webparts/kpfaplus/services/StaffRecordsMapperService.ts
import { 
    IStaffRecord,
    IStaffRecordTypeOfLeave,
    IStaffRecordWeeklyTimeTable
  } from "./StaffRecordsInterfaces";
  
  /**
   * Сервис для преобразования данных из SharePoint в бизнес-модели
   * Отвечает за маппинг, валидацию и нормализацию данных
   */
  export class StaffRecordsMapperService {
    private _logSource: string;
  
    /**
     * Конструктор сервиса преобразования данных
     * @param logSource Префикс для логов
     */
    constructor(logSource: string) {
      this._logSource = logSource + ".Mapper";
      this.logInfo("StaffRecordsMapperService инициализирован");
    }
  
    /**
     * Преобразует сырые данные из SharePoint в массив объектов IStaffRecord
     * @param rawItems Сырые данные из SharePoint
     * @returns Массив объектов IStaffRecord
     */
    public mapToStaffRecords(rawItems: unknown[]): IStaffRecord[] {
      try {
        this.logInfo(`[DEBUG] mapToStaffRecords: Начинаем преобразование ${rawItems.length} сырых элементов`);
  
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
        this.logInfo(`[DEBUG] mapToStaffRecords: Преобразовано ${filteredItems.length} элементов из ${rawItems.length} исходных`);
  
        return filteredItems;
      } catch (error) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании элементов расписания: ${error instanceof Error ? error.message : String(error)}`);
        return [];
      }
    }
  
    /**
     * Преобразует одну сырую запись в структурированный объект IStaffRecord
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
      // Преобразуем даты из строк в объекты Date
      const dateObj = this.parseDate(fields.Date as string, index, 'Date');
      const shiftDate1 = this.parseOptionalDate(fields.ShiftDate1 as string, index, 'ShiftDate1');
      const shiftDate2 = this.parseOptionalDate(fields.ShiftDate2 as string, index, 'ShiftDate2');
      const shiftDate3 = this.parseOptionalDate(fields.ShiftDate3 as string, index, 'ShiftDate3');
      const shiftDate4 = this.parseOptionalDate(fields.ShiftDate4 as string, index, 'ShiftDate4');
      
      // Получаем информацию о типе отпуска
      // ПРАВИЛЬНО:
const { typeOfLeaveID, typeOfLeave } = this.extractTypeOfLeave(fields.TypeOfLeaveLookupId, index);
      
      // Получаем информацию о недельном расписании
      const { weeklyTimeTableID, weeklyTimeTable, weeklyTimeTableTitle } = 
        this.extractWeeklyTimeTable(fields.WeeklyTimeTable, index);
      
      // Создаем объект IStaffRecord с преобразованными данными
      return {
        ID: id.toString(),
        Deleted: this.ensureNumber(fields.Deleted, 0),
        Checked: this.ensureNumber(fields.Checked, 0),
        ExportResult: this.ensureString(fields.ExportResult),
        Title: this.ensureString(fields.Title),
        Date: dateObj,
        ShiftDate1: shiftDate1,
        ShiftDate2: shiftDate2,
        ShiftDate3: shiftDate3,
        ShiftDate4: shiftDate4,
        TimeForLunch: this.ensureNumber(fields.TimeForLunch, 0),
        Contract: this.ensureNumber(fields.Contract, 1),
        Holiday: this.ensureNumber(fields.Holiday, 0),
        TypeOfLeaveID: typeOfLeaveID,
        TypeOfLeave: typeOfLeave,

        StaffMemberLookupId: this.ensureString(fields.StaffMemberLookupId),
        WeeklyTimeTableID: weeklyTimeTableID,
        WeeklyTimeTable: weeklyTimeTable,
        WeeklyTimeTableTitle: weeklyTimeTableTitle
      };
    }
  
    private extractTypeOfLeave(typeOfLeaveRaw: unknown, index: number): {
  typeOfLeaveID: string;
  typeOfLeave: IStaffRecordTypeOfLeave | undefined;
} {
  let typeOfLeave: IStaffRecordTypeOfLeave | undefined = undefined;
  let typeOfLeaveID = '';
  
  // ИСПРАВЛЕНО: TypeOfLeaveLookupId приходит как строка или число
  if (typeOfLeaveRaw) {
    if (typeof typeOfLeaveRaw === 'string' || typeof typeOfLeaveRaw === 'number') {
      typeOfLeaveID = String(typeOfLeaveRaw);
      this.logInfo(`[DEBUG] Extracted TypeOfLeaveID: ${typeOfLeaveID}`);
      
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
  
  this.logInfo(`[DEBUG] Extracted TypeOfLeaveID: ${typeOfLeaveID}`);
  return { typeOfLeaveID, typeOfLeave };
}
  
    /**
     * Извлекает информацию о недельном расписании из сырых данных
     * @param weeklyTimeTableRaw Сырые данные недельного расписания
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
        this.logInfo(`[DEBUG] Элемент #${index} имеет поле WeeklyTimeTable: ${JSON.stringify(weeklyTimeTableRaw)}`);
        
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
      
      return { weeklyTimeTableID, weeklyTimeTable, weeklyTimeTableTitle };
    }
  
    /**
     * Преобразует строковую дату в объект Date
     * @param dateString Строка с датой
     * @param index Индекс записи (для логов)
     * @param fieldName Название поля (для логов)
     * @returns Объект Date
     */
    private parseDate(dateString: string | undefined, index: number, fieldName: string): Date {
      let dateObj: Date;
      try {
        if (!dateString) {
          this.logError(`[ОШИБКА] Отсутствует обязательное поле ${fieldName} для элемента #${index}`);
          return new Date(); // Возвращаем текущую дату как запасной вариант
        }
        
        dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ${fieldName} для элемента #${index}: ${dateString}`);
          return new Date(); // Возвращаем текущую дату как запасной вариант
        }
        
        return dateObj;
      } catch (dateError) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ${fieldName} для элемента #${index}: ${dateError}`);
        return new Date(); // Возвращаем текущую дату как запасной вариант
      }
    }
  
    /**
     * Преобразует строковую дату в объект Date или undefined
     * @param dateString Строка с датой
     * @param index Индекс записи (для логов)
     * @param fieldName Название поля (для логов)
     * @returns Объект Date или undefined
     */
    private parseOptionalDate(dateString: string | undefined, index: number, fieldName: string): Date | undefined {
      if (!dateString) {
        return undefined;
      }
      
      try {
        const dateObj = new Date(dateString);
        if (isNaN(dateObj.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ${fieldName} для элемента #${index}: ${dateString}`);
          return undefined;
        }
        return dateObj;
      } catch (dateError) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ${fieldName} для элемента #${index}: ${dateError}`);
        return undefined;
      }
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