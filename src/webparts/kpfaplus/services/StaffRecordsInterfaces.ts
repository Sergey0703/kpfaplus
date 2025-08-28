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
  ExportResult: number;          // Результат экспорта записи
  Title: string;                 // Заголовок записи
  Date: Date;                    // Дата записи
  
  // СУЩЕСТВУЮЩИЕ поля даты-времени (для обратной совместимости с другими вкладками)
  ShiftDate1: Date | undefined;  // Время начала работы
  ShiftDate2: Date | undefined;  // Время окончания работы
  ShiftDate3: Date | undefined;  // Время начала обеда
  ShiftDate4: Date | undefined;  // Время окончания обеда
  
  // НОВЫЕ числовые поля времени (основные для ScheduleTab)
  ShiftDate1Hours?: number;      // Часы начала работы (0-23)
  ShiftDate1Minutes?: number;    // Минуты начала работы (0-59)
  ShiftDate2Hours?: number;      // Часы окончания работы (0-23)
  ShiftDate2Minutes?: number;    // Минуты окончания работы (0-59)
  ShiftDate3Hours?: number;      // Часы начала обеда (0-23)
  ShiftDate3Minutes?: number;    // Минуты начала обеда (0-59)
  ShiftDate4Hours?: number;      // Часы окончания обеда (0-23)
  ShiftDate4Minutes?: number;    // Минуты окончания обеда (0-59)
  
  TimeForLunch: number;          // Продолжительность обеда в минутах
  Contract: number;              // Номер контракта
  Holiday: number;               // Признак праздника: 1 = праздник, 0 = рабочий день
  TypeOfLeaveID: string;         // ID типа отпуска
  TypeOfLeave: IStaffRecordTypeOfLeave | undefined; // Тип отпуска
  WeeklyTimeTableID: string;     // ID недельного расписания
  WeeklyTimeTable: IStaffRecordWeeklyTimeTable | undefined; // Недельное расписание
  WeeklyTimeTableTitle: string;  // Название недельного расписания
  LeaveTime: number;             // Часы отпуска (например, 8.5)
  
  // Дополнительные рассчитываемые поля
  SortOrder?: number;            // Порядок сортировки
  WorkTime?: string;             // Рассчитанное рабочее время в формате "часы.минуты"
  StaffMemberLookupId?: string;  // ID сотрудника (lookup)
  ManagerLookupId?: string;      // ID менеджера (lookup)
  StaffGroupLookupId?: string;   // ID группы (lookup)
}

/**
 * Интерфейс для сырых данных из SharePoint (необработанные данные)
 */
export interface IRawStaffRecord {
  ID?: string | number;          // ID записи
  Deleted?: number | string | boolean;  // Флаг удаления
  Checked?: number | string | boolean;  // Флаг проверки
  ExportResult?: number;         // Результат экспорта
  Title?: string;                // Заголовок
  Date?: string;                 // Дата (в строковом формате)
  
  // СУЩЕСТВУЮЩИЕ поля даты-времени (для обратной совместимости)
  ShiftDate1?: string;           // Время начала работы (в строковом формате)
  ShiftDate2?: string;           // Время окончания работы (в строковом формате)
  ShiftDate3?: string;           // Время начала обеда (в строковом формате)
  ShiftDate4?: string;           // Время окончания обеда (в строковом формате)
  
  // НОВЫЕ числовые поля времени из SharePoint
  ShiftDate1Hours?: number | string;    // Часы начала работы
  ShiftDate1Minutes?: number | string;  // Минуты начала работы
  ShiftDate2Hours?: number | string;    // Часы окончания работы
  ShiftDate2Minutes?: number | string;  // Минуты окончания работы
  ShiftDate3Hours?: number | string;    // Часы начала обеда
  ShiftDate3Minutes?: number | string;  // Минуты начала обеда
  ShiftDate4Hours?: number | string;    // Часы окончания обеда
  ShiftDate4Minutes?: number | string;  // Минуты окончания обеда
  
  TimeForLunch?: number | string; // Время обеда
  Contract?: number | string;    // Номер контракта
  Holiday?: number | string | boolean; // Признак праздника
  LeaveTime?: number | string;   // Часы отпуска из SharePoint
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
 * ДОБАВЛЕНЫ поля для пагинации: skip и top
 */
export interface IStaffRecordsQueryParams {
  startDate: Date;               // Дата начала периода
  endDate: Date;                 // Дата окончания периода
  currentUserID: string | number; // ID текущего пользователя
  staffGroupID: string | number; // ID группы сотрудников
  employeeID: string | number;   // ID сотрудника
  timeTableID?: string | number; // ID недельного расписания (опционально)
  
  // --- ПАРАМЕТРЫ ПАГИНАЦИИ ---
  skip?: number;                 // Количество записей для пропуска (для пагинации)
  top?: number;                  // Максимальное количество записей для возврата (60 или 90)
  nextLink?: string;             // Ссылка на следующую страницу из Graph API
  // -------------------------------
}

/**
 * Интерфейс для результатов обработки данных StaffRecords
 * ПОЛЕ totalCount УЖЕ ПРИСУТСТВУЕТ, что отлично!
 */
export interface IStaffRecordsResult {
  records: IStaffRecord[];       // Массив обработанных записей (теперь это данные для текущей страницы)
  totalCount: number;            // Общее количество записей, соответствующих фильтру (для расчета общего числа страниц)
  error?: string;                // Ошибка (если есть)
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
  
  // СУЩЕСТВУЮЩИЕ поля даты-времени (для обратной совместимости)
  shiftDate1?: Date | undefined; // Время начала работы
  shiftDate2?: Date | undefined; // Время окончания работы
  shiftDate3?: Date | undefined; // Время начала обеда
  shiftDate4?: Date | undefined; // Время окончания обеда
  
  // НОВЫЕ числовые поля времени
  shiftDate1Hours?: number;      // Часы начала работы (0-23)
  shiftDate1Minutes?: number;    // Минуты начала работы (0-59)
  shiftDate2Hours?: number;      // Часы окончания работы (0-23)
  shiftDate2Minutes?: number;    // Минуты окончания работы (0-59)
  shiftDate3Hours?: number;      // Часы начала обеда (0-23)
  shiftDate3Minutes?: number;    // Минуты начала обеда (0-59)
  shiftDate4Hours?: number;      // Часы окончания обеда (0-23)
  shiftDate4Minutes?: number;    // Минуты окончания обеда (0-59)
  
  timeForLunch?: number;         // Время обеда
  contract?: number;             // Номер контракта
  holiday?: number;              // Признак праздника
  leaveTime?: number;            // Часы отпуска
  typeOfLeaveID?: string;        // ID типа отпуска
  weeklyTimeTableID?: string;    // ID недельного расписания
  deleted?: number;              // Флаг удаления
  checked?: number;              // Флаг проверки
  exportResult?: number;         // Результат экспорта
}