// src/webparts/kpfaplus/services/StaffRecordsInterfaces.ts

/**
 * Интерфейсы и типы для работы с записями расписания персонала
 */

/**
 * Интерфейс для типа отпуска в StaffRecords
 */
export interface IStaffRecordTypeOfLeave {
    Id: string;        // Идентификатор типа отпуска
    Title: string;     // Название типа отпуска
  }
  
  /**
   * Интерфейс для недельного расписания в StaffRecords
   */
  export interface IStaffRecordWeeklyTimeTable {
    Id: string;        // Идентификатор недельного расписания
    Title: string;     // Название недельного расписания
  }
  
  /**
   * Интерфейс для данных записи расписания (обработанные данные)
   */
  export interface IStaffRecord {
    ID: string;                    // Уникальный идентификатор записи
    Deleted: number;               // Флаг удаления: 1 = помечена на удаление, 0 = активна
    Checked: number;               // Флаг проверки записи
    ExportResult: string;          // Результат экспорта записи
    Title: string;                 // Заголовок записи
    Date: Date;                    // Дата записи
    ShiftDate1: Date | undefined;  // Время начала работы
    ShiftDate2: Date | undefined;  // Время окончания работы
    ShiftDate3: Date | undefined;  // Время начала обеда
    ShiftDate4: Date | undefined;  // Время окончания обеда
    TimeForLunch: number;          // Продолжительность обеда в минутах
    Contract: number;              // Номер контракта
    Holiday: number;               // Признак праздника: 1 = праздник, 0 = рабочий день
    TypeOfLeaveID: string;         // ID типа отпуска
    TypeOfLeave: IStaffRecordTypeOfLeave | undefined; // Тип отпуска
    WeeklyTimeTableID: string;     // ID недельного расписания
    WeeklyTimeTable: IStaffRecordWeeklyTimeTable | undefined; // Недельное расписание
    WeeklyTimeTableTitle: string;  // Название недельного расписания
    
    // Дополнительные рассчитываемые поля
    SortOrder?: number;            // Порядок сортировки
    WorkTime?: string;             // Рассчитанное рабочее время в формате "часы.минуты"
  }
  
  /**
   * Интерфейс для сырых данных из SharePoint (необработанные данные)
   */
  export interface IRawStaffRecord {
    ID?: string | number;          // ID записи
    Deleted?: number | string | boolean;  // Флаг удаления
    Checked?: number | string | boolean;  // Флаг проверки
    ExportResult?: string;         // Результат экспорта
    Title?: string;                // Заголовок
    Date?: string;                 // Дата (в строковом формате)
    ShiftDate1?: string;           // Время начала работы (в строковом формате)
    ShiftDate2?: string;           // Время окончания работы (в строковом формате)
    ShiftDate3?: string;           // Время начала обеда (в строковом формате)
    ShiftDate4?: string;           // Время окончания обеда (в строковом формате)
    TimeForLunch?: number | string; // Время обеда
    Contract?: number | string;    // Номер контракта
    Holiday?: number | string | boolean; // Признак праздника
    TypeOfLeave?: {                // Тип отпуска (lookup)
      Id?: string | number;        // ID типа отпуска
      ID?: string | number;        // ID типа отпуска (альтернативное поле)
      Title?: string;              // Название типа отпуска
    };
    WeeklyTimeTable?: {            // Недельное расписание (lookup)
      Id?: string | number;        // ID недельного расписания
      ID?: string | number;        // ID недельного расписания (альтернативное поле)
      Title?: string;              // Название недельного расписания
    };
    [key: string]: unknown;        // Индексная сигнатура для дополнительных свойств
  }
  
  /**
   * Интерфейс для параметров запроса к API StaffRecords
   */
  export interface IStaffRecordsQueryParams {
    startDate: Date;               // Дата начала периода
    endDate: Date;                 // Дата окончания периода
    currentUserID: string | number; // ID текущего пользователя
    staffGroupID: string | number; // ID группы сотрудников
    employeeID: string | number;   // ID сотрудника
    timeTableID?: string | number; // ID недельного расписания (опционально)
  }
  
  /**
   * Интерфейс для результатов расчета рабочего времени
   */
  export interface IWorkTimeCalculationResult {
    workTime: string;              // Рабочее время в формате "часы.минуты"
    sortOrder: number;             // Порядок сортировки
    workMinutes: number;           // Общее количество рабочих минут
    lunchMinutes: number;          // Время обеда в минутах
    netWorkMinutes: number;        // Чистое рабочее время (без обеда) в минутах
  }
  
  /**
   * Интерфейс для результатов обработки данных StaffRecords
   */
  export interface IStaffRecordsResult {
    records: IStaffRecord[];       // Массив обработанных записей
    totalCount: number;            // Общее количество записей
    error?: string;                // Ошибка (если есть)
  }
  
  /**
   * Перечисление для типов сортировки записей
   */
  export enum StaffRecordsSortType {
    ByDate = 'date',               // Сортировка по дате
    ByStartTime = 'startTime',     // Сортировка по времени начала
    ByEndTime = 'endTime',         // Сортировка по времени окончания 
    ByWorkTime = 'workTime'        // Сортировка по рабочему времени
  }
  
  /**
   * Интерфейс для параметров сортировки
   */
  export interface ISortOptions {
    type: StaffRecordsSortType;    // Тип сортировки
    ascending: boolean;            // Направление сортировки: true = по возрастанию, false = по убыванию
  }
  
  /**
   * Интерфейс для параметров создания и обновления записи
   */
  export interface IStaffRecordUpdateParams {
    title?: string;                // Заголовок
    date?: Date;                   // Дата
    shiftDate1?: Date | null;      // Время начала работы
    shiftDate2?: Date | null;      // Время окончания работы
    shiftDate3?: Date | null;      // Время начала обеда
    shiftDate4?: Date | null;      // Время окончания обеда
    timeForLunch?: number;         // Время обеда
    contract?: number;             // Номер контракта
    holiday?: number;              // Признак праздника
    typeOfLeaveID?: string;        // ID типа отпуска
    weeklyTimeTableID?: string;    // ID недельного расписания
    deleted?: number;              // Флаг удаления
    checked?: number;              // Флаг проверки
    exportResult?: string;         // Результат экспорта
  }