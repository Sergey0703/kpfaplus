// src/webparts/kpfaplus/services/StaffRecordsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

// Интерфейс для типа отпуска в StaffRecords
export interface IStaffRecordTypeOfLeave {
  Id: string;
  Title: string;
}

// Интерфейс для недельного расписания в StaffRecords
export interface IStaffRecordWeeklyTimeTable {
  Id: string;
  Title: string;
}

// Интерфейс для данных записи расписания
export interface IStaffRecord {
  ID: string;
  Deleted: number;         // 1 = помечена на удаление, 0 = активна
  Checked: number;         // Флаг проверки записи
  ExportResult: string;    // Результат экспорта записи
  Title: string;
  Date: Date;
  ShiftDate1: Date | undefined; // Время начала работы
  ShiftDate2: Date | undefined; // Время окончания работы
  ShiftDate3: Date | undefined; // Время начала обеда
  ShiftDate4: Date | undefined; // Время окончания обеда
  TimeForLunch: number;    // Продолжительность обеда в минутах
  Contract: number;        // Номер контракта
  Holiday: number;         // Признак праздника
  TypeOfLeaveID: string;   // ID типа отпуска
  TypeOfLeave: IStaffRecordTypeOfLeave | undefined; // Тип отпуска
  WeeklyTimeTableID: string; // ID недельного расписания
  WeeklyTimeTable: IStaffRecordWeeklyTimeTable | undefined; // Недельное расписание
  WeeklyTimeTableTitle: string; // Название недельного расписания
  
  // Дополнительные рассчитываемые поля
  SortOrder?: number;      // Порядок сортировки
  WorkTime?: string;       // Рассчитанное рабочее время
}

// Интерфейс для сырых данных из SharePoint
export interface IRawStaffRecord {
  ID?: string | number;
  Deleted?: number | string | boolean;
  Checked?: number | string | boolean;  // Добавлено поле Checked
  ExportResult?: string;                // Добавлено поле ExportResult
  Title?: string;
  Date?: string;
  ShiftDate1?: string;
  ShiftDate2?: string;
  ShiftDate3?: string;
  ShiftDate4?: string;
  TimeForLunch?: number | string;
  Contract?: number | string;
  Holiday?: number | string | boolean;
  TypeOfLeave?: {
    Id?: string | number;
    ID?: string | number;
    Title?: string;
  };
  WeeklyTimeTable?: {
    Id?: string | number;
    ID?: string | number;
    Title?: string;
  };
  [key: string]: unknown;
}

/**
 * Сервис для работы с записями расписания персонала
 */
export class StaffRecordsService {
  private static _instance: StaffRecordsService;
  private _logSource: string = "StaffRecordsService";
  private _listName: string = "StaffRecords";
  private _remoteSiteService: RemoteSiteService;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    console.log('[StaffRecordsService] Инициализация сервиса с контекстом');
    this._remoteSiteService = RemoteSiteService.getInstance(context);
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
      // Расширенное логирование параметров запроса
      this.logInfo(`[DEBUG] getStaffRecords ВЫЗВАН С ПАРАМЕТРАМИ:
        startDate: ${startDate.toISOString()},
        endDate: ${endDate.toISOString()},
        currentUserID: ${currentUserID} (тип: ${typeof currentUserID}),
        staffGroupID: ${staffGroupID} (тип: ${typeof staffGroupID}),
        employeeID: ${employeeID} (тип: ${typeof employeeID}),
        timeTableID: ${timeTableID || 'не указан'} (тип: ${typeof timeTableID})`
      );

      // Проверяем наличие RemoteSiteService
      if (!this._remoteSiteService) {
        this.logError('[ОШИБКА] RemoteSiteService не инициализирован');
        return [];
      }

      // Проверяем, что RemoteSiteService авторизован
      if (!this._remoteSiteService.isAuthorized()) {
        this.logError('[ОШИБКА] RemoteSiteService не авторизован, пытаемся авторизоваться...');
        await this._remoteSiteService.ensureAuthorization();
        this.logInfo('[DEBUG] Статус авторизации после попытки: ' + 
          (this._remoteSiteService.isAuthorized() ? 'успешно' : 'неудачно'));
      }

      // Проверка listName
      if (!this._listName) {
        this.logError('[ОШИБКА] Имя списка не определено');
        return [];
      }

      // Форматирование дат для фильтрации
      const startDateStr = this.formatDateForFilter(startDate);
      const endDateStr = this.formatDateForFilter(endDate);
      this.logInfo(`[DEBUG] Форматированные даты для запроса: ${startDateStr} - ${endDateStr}`);

      // Строим фильтр для запроса к SharePoint
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
      
      this.logInfo(`[DEBUG] ИТОГОВЫЙ ФИЛЬТР: ${filter}`);
      console.log(`[${this._logSource}] [DEBUG] Вызов RemoteSiteService.getListItems с параметрами:`, {
        listName: this._listName,
        filter
      });
      
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
      
      // Логируем подробности ответа
      this.logInfo(`Получено ${rawItems.length} элементов расписания из SharePoint`);
      if (rawItems.length > 0) {
        this.logInfo(`[DEBUG] Пример ПЕРВОГО элемента: ${JSON.stringify(rawItems[0], null, 2)}`);
        
        // Проверка структуры полей
        if (rawItems[0] && rawItems[0].fields) {
          this.logInfo(`[DEBUG] Поля первого элемента: ${Object.keys(rawItems[0].fields).join(', ')}`);
          
          // Проверка полей LookupId
          const lookupFields = Object.keys(rawItems[0].fields).filter(key => key.includes('LookupId'));
          this.logInfo(`[DEBUG] Поля LookupId: ${lookupFields.join(', ')}`);
          
          // Проверка важных полей
          ['Date', 'StaffMember', 'StaffMemberLookupId', 'WeeklyTimeTable', 'WeeklyTimeTableLookupId'].forEach(field => {
            const hasField = rawItems[0].fields && rawItems[0].fields[field] !== undefined;
            this.logInfo(`[DEBUG] Поле ${field}: ${hasField ? 'присутствует' : 'отсутствует'}`);
            if (hasField && rawItems[0].fields) {
              this.logInfo(`[DEBUG] Значение ${field}: ${JSON.stringify(rawItems[0].fields[field])}`);
            }
          });
        } else {
          this.logInfo(`[DEBUG] ВНИМАНИЕ: У первого элемента нет поля 'fields'`);
        }
      } else {
        this.logInfo(`[DEBUG] Нет элементов в ответе от сервера для фильтра: ${filter}`);
      }
      //////111

// Преобразуем полученные сырые данные в формат IStaffRecord
this.logInfo(`[DEBUG] Начинаем преобразование данных...`);
const mappedRecords = this.mapToStaffRecords(rawItems);

this.logInfo(`[DEBUG] Успешно преобразовано ${mappedRecords.length} элементов расписания`);

// Рассчитываем рабочее время для каждой записи
const recordsWithWorkTime = mappedRecords.map(record => this.calculateWorkTime(record));

// Сортируем записи по дате, порядку сортировки и времени начала
const sortedRecords = this.sortStaffRecords(recordsWithWorkTime);

this.logInfo(`[DEBUG] Возвращаем ${sortedRecords.length} обработанных записей расписания`);

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
  WeeklyTimeTableTitle: ${sortedRecords[0].WeeklyTimeTableTitle}`);
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
* Преобразует сырые данные из SharePoint в массив объектов IStaffRecord
* @param rawItems Сырые данные из SharePoint
* @returns Массив объектов IStaffRecord
*/
private mapToStaffRecords(rawItems: unknown[]): IStaffRecord[] {
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
    
    // Преобразуем даты из строк в объекты Date
    let dateObj: Date;
    try {
      dateObj = fields.Date ? new Date(fields.Date as string) : new Date();
      if (isNaN(dateObj.getTime())) {
        this.logError(`[ОШИБКА] Некорректная дата для элемента #${index}: ${fields.Date}`);
        dateObj = new Date(); // Используем текущую дату как запасной вариант
      }
    } catch (dateError) {
      this.logError(`[ОШИБКА] Ошибка при преобразовании даты для элемента #${index}: ${dateError}`);
      dateObj = new Date();
    }
    
    // Преобразуем время начала работы
    let shiftDate1: Date | undefined = undefined;
    if (fields.ShiftDate1 && typeof fields.ShiftDate1 === 'string') {
      try {
        shiftDate1 = new Date(fields.ShiftDate1);
        if (isNaN(shiftDate1.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ShiftDate1 для элемента #${index}: ${fields.ShiftDate1}`);
          shiftDate1 = undefined;
        }
      } catch (shiftDate1Error) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ShiftDate1 для элемента #${index}: ${shiftDate1Error}`);
        shiftDate1 = undefined;
      }
    }
    
    // Преобразуем время окончания работы
    let shiftDate2: Date | undefined = undefined;
    if (fields.ShiftDate2 && typeof fields.ShiftDate2 === 'string') {
      try {
        shiftDate2 = new Date(fields.ShiftDate2);
        if (isNaN(shiftDate2.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ShiftDate2 для элемента #${index}: ${fields.ShiftDate2}`);
          shiftDate2 = undefined;
        }
      } catch (shiftDate2Error) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ShiftDate2 для элемента #${index}: ${shiftDate2Error}`);
        shiftDate2 = undefined;
      }
    }
    
    // Преобразуем время начала обеда
    let shiftDate3: Date | undefined = undefined;
    if (fields.ShiftDate3 && typeof fields.ShiftDate3 === 'string') {
      try {
        shiftDate3 = new Date(fields.ShiftDate3);
        if (isNaN(shiftDate3.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ShiftDate3 для элемента #${index}: ${fields.ShiftDate3}`);
          shiftDate3 = undefined;
        }
      } catch (shiftDate3Error) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ShiftDate3 для элемента #${index}: ${shiftDate3Error}`);
        shiftDate3 = undefined;
      }
    }
    
    // Преобразуем время окончания обеда
    let shiftDate4: Date | undefined = undefined;
    if (fields.ShiftDate4 && typeof fields.ShiftDate4 === 'string') {
      try {
        shiftDate4 = new Date(fields.ShiftDate4);
        if (isNaN(shiftDate4.getTime())) {
          this.logError(`[ОШИБКА] Некорректная дата ShiftDate4 для элемента #${index}: ${fields.ShiftDate4}`);
          shiftDate4 = undefined;
        }
      } catch (shiftDate4Error) {
        this.logError(`[ОШИБКА] Ошибка при преобразовании ShiftDate4 для элемента #${index}: ${shiftDate4Error}`);
        shiftDate4 = undefined;
      }
    }
    
    // Получаем информацию о типе отпуска
    let typeOfLeave: IStaffRecordTypeOfLeave | undefined = undefined;
    let typeOfLeaveID = '';
    
    if (fields.TypeOfLeave) {
      this.logInfo(`[DEBUG] Элемент #${index} имеет поле TypeOfLeave: ${JSON.stringify(fields.TypeOfLeave)}`);
      
      const typeOfLeaveRaw = fields.TypeOfLeave as { Id?: string | number; Title?: string };
      typeOfLeaveID = typeOfLeaveRaw.Id?.toString() || '';
      
      if (typeOfLeaveID && typeOfLeaveRaw.Title) {
        typeOfLeave = {
          Id: typeOfLeaveID,
          Title: typeOfLeaveRaw.Title.toString()
        };
      }
    }
    
    // Получаем информацию о недельном расписании
    let weeklyTimeTable: IStaffRecordWeeklyTimeTable | undefined = undefined;
    let weeklyTimeTableID = '';
    let weeklyTimeTableTitle = '';
    
    if (fields.WeeklyTimeTable) {
      this.logInfo(`[DEBUG] Элемент #${index} имеет поле WeeklyTimeTable: ${JSON.stringify(fields.WeeklyTimeTable)}`);
      
      const weeklyTimeTableRaw = fields.WeeklyTimeTable as { Id?: string | number; Title?: string };
      weeklyTimeTableID = weeklyTimeTableRaw.Id?.toString() || '';
      
      if (weeklyTimeTableID && weeklyTimeTableRaw.Title) {
        weeklyTimeTable = {
          Id: weeklyTimeTableID,
          Title: weeklyTimeTableRaw.Title.toString()
        };
        
        weeklyTimeTableTitle = weeklyTimeTableRaw.Title.toString();
      }
    }
    
    // Создаем объект IStaffRecord
    const staffRecord: IStaffRecord = {
      ID: rawItem.id.toString(),
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
      WeeklyTimeTableID: weeklyTimeTableID,
      WeeklyTimeTable: weeklyTimeTable,
      WeeklyTimeTableTitle: weeklyTimeTableTitle
    };
    
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
* Рассчитывает рабочее время для записи расписания
* @param record Запись расписания
* @returns Запись расписания с рассчитанным рабочим временем
*/
private calculateWorkTime(record: IStaffRecord): IStaffRecord {
try {
// Проверяем, что есть время начала и окончания работы
if (!record.ShiftDate1 || !record.ShiftDate2) {
  // Если нет времени начала или окончания, устанавливаем WorkTime в "0.00"
  return {
    ...record,
    SortOrder: 1, // Значение по умолчанию для сортировки
    WorkTime: "0.00"
  };
}

// Получаем время начала и окончания работы
const startWork = record.ShiftDate1;
const endWork = record.ShiftDate2;

// Получаем время начала и окончания обеда
const startLunch = record.ShiftDate3;
const endLunch = record.ShiftDate4;

// Рассчитываем минуты для времени начала работы
const startMinutes = startWork.getHours() * 60 + startWork.getMinutes();

// Рассчитываем минуты для времени окончания работы
const endMinutes = endWork.getHours() * 60 + endWork.getMinutes();

// Расчет рабочих минут с учетом перехода через полночь
let workMinutes = 0;

if (endMinutes <= startMinutes && endMinutes > 0) {
  // Если окончание раньше начала и не 00:00, значит смена переходит через полночь
  workMinutes = endMinutes + (24 * 60) - startMinutes;
} else if (endMinutes === 0) {
  // Если окончание в 00:00, считаем это как конец дня (24:00)
  workMinutes = (24 * 60) - startMinutes;
} else {
  // Обычный случай, когда окончание позже начала
  workMinutes = endMinutes - startMinutes;
}

// Расчет минут обеда
let lunchMinutes = 0;

// Используем время обеда из поля TimeForLunch, если задано
if (record.TimeForLunch > 0) {
  lunchMinutes = record.TimeForLunch;
} 
// Иначе рассчитываем из времени начала и окончания обеда, если они заданы
else if (startLunch && endLunch && 
         !(startLunch.getHours() === 0 && startLunch.getMinutes() === 0 &&
           endLunch.getHours() === 0 && endLunch.getMinutes() === 0)) {
  
  const lunchStartMinutes = startLunch.getHours() * 60 + startLunch.getMinutes();
  const lunchEndMinutes = endLunch.getHours() * 60 + endLunch.getMinutes();
  
  lunchMinutes = lunchEndMinutes - lunchStartMinutes;
}

// Рассчитываем чистое рабочее время (общее время - обед)
const netWorkMinutes = Math.max(0, workMinutes - lunchMinutes);

// Форматируем результат в формате "часы.минуты"
const hours = Math.floor(netWorkMinutes / 60);
const minutes = netWorkMinutes % 60;
const workTime = `${hours}.${minutes.toString().padStart(2, '0')}`;

// Рассчитываем SortOrder (порядок сортировки)
let sortOrder = 1; // По умолчанию

// Проверяем, являются ли времена начала и окончания нулевыми (00:00)
const isStartTimeZero = startWork.getHours() === 0 && startWork.getMinutes() === 0;
const isEndTimeZero = endWork.getHours() === 0 && endWork.getMinutes() === 0;

if (isStartTimeZero && isEndTimeZero) {
  // Если оба времени нулевые, устанавливаем SortOrder в 1
  sortOrder = 1;
} else if (!isStartTimeZero) {
  // Если время начала не нулевое, устанавливаем SortOrder в 0
  sortOrder = 0;
} else if (!isEndTimeZero) {
  // Если время начала нулевое, но время окончания не нулевое, устанавливаем SortOrder в 0
  sortOrder = 0;
}

// Возвращаем запись с рассчитанным рабочим временем и порядком сортировки
return {
  ...record,
  SortOrder: sortOrder,
  WorkTime: workTime
};
} catch (error) {
this.logError(`[ОШИБКА] Ошибка при расчете рабочего времени для записи ID ${record.ID}: ${error instanceof Error ? error.message : String(error)}`);

// В случае ошибки возвращаем запись без изменений
return {
  ...record,
  SortOrder: 1,
  WorkTime: "0.00"
};
}
}

      /**
   * Сортирует записи расписания персонала
   * @param records Записи расписания персонала
   * @returns Отсортированные записи
   */
  private sortStaffRecords(records: IStaffRecord[]): IStaffRecord[] {
    try {
      this.logInfo(`[DEBUG] sortStaffRecords: Сортировка ${records.length} записей`);
      
      // Создаем копию массива для сортировки
      const sortedRecords = [...records].sort((a, b) => {
        // Сначала сортируем по дате
        const dateA = a.Date.getTime();
        const dateB = b.Date.getTime();
        
        if (dateA !== dateB) {
          return dateA - dateB;
        }
        
        // Затем по порядку сортировки
        const sortOrderA = a.SortOrder || 1;
        const sortOrderB = b.SortOrder || 1;
        
        if (sortOrderA !== sortOrderB) {
          return sortOrderA - sortOrderB;
        }
        
        // Наконец по времени начала (если есть)
        const startTimeA = a.ShiftDate1 ? a.ShiftDate1.getTime() : 0;
        const startTimeB = b.ShiftDate1 ? b.ShiftDate1.getTime() : 0;
        
        return startTimeA - startTimeB;
      });
      
      this.logInfo(`[DEBUG] sortStaffRecords: Сортировка завершена, получено ${sortedRecords.length} упорядоченных записей`);
      
      return sortedRecords;
    } catch (error) {
      this.logError(`[ОШИБКА] Ошибка при сортировке записей расписания: ${error instanceof Error ? error.message : String(error)}`);
      // В случае ошибки возвращаем несортированный массив
      return records;
    }
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