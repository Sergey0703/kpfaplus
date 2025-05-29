// src/webparts/kpfaplus/components/Tabs/TimetableTab/interfaces/TimetableInterfaces.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Интерфейс для информации о неделе
 */
export interface IWeekInfo {
  weekNum: number;
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

/**
 * Интерфейс для информации о смене
 * ОБНОВЛЕНО: Добавлена поддержка поля Holiday
 */
export interface IShiftInfo {
  recordId: string;
  startTime: Date;
  endTime: Date;
  lunchStart?: Date;
  lunchEnd?: Date;
  timeForLunch: number;
  workMinutes: number;
  formattedShift: string; // "09:00 - 17:00 (8h 00m)"
  
  // СУЩЕСТВУЮЩИЕ: Поля для типа отпуска
  typeOfLeaveId?: string;     // ID типа отпуска из StaffRecord
  typeOfLeaveTitle?: string;  // Название типа отпуска
  typeOfLeaveColor?: string;  // Цвет типа отпуска в Hex формате
  
  // НОВЫЕ: Поля для праздников (Holiday = 1)
  isHoliday?: boolean;        // Флаг праздника (true если Holiday = 1)
  holidayColor?: string;      // Цвет праздника (#f44336 - красный)
}

/**
 * Интерфейс для информации о дне
 * ОБНОВЛЕНО: Добавлена поддержка праздников с приоритетом над отпусками
 */
export interface IDayInfo {
  dayNumber: number; // 1=Sunday, 2=Monday, etc.
  date: Date;
  shifts: IShiftInfo[];
  totalMinutes: number;
  formattedContent: string; // Полный текст для ячейки
  hasData: boolean;
  
  // СУЩЕСТВУЮЩИЕ: Поля для отображения цвета отпуска
  leaveTypeColor?: string;    // Цвет фона ячейки если есть отпуск
  hasLeave: boolean;          // Есть ли отпуск в этом дне
  
  // НОВЫЕ: Поля для праздников (высший приоритет цвета)
  hasHoliday: boolean;        // Есть ли праздник в этом дне (Holiday = 1)
  holidayColor?: string;      // Цвет праздника для дня (#f44336)
  
  // НОВОЕ: Финальный цвет ячейки с учетом приоритетов
  finalCellColor?: string;    // Итоговый цвет: Holiday > TypeOfLeave > Default
}

/**
 * Интерфейс для недельных данных сотрудника
 */
export interface IWeeklyStaffData {
  weekNum: number;
  weekStart: Date;
  weekEnd: Date;
  days: { [dayNumber: number]: IDayInfo };
  totalWeekMinutes: number;
  formattedWeekTotal: string; // "40h 00m"
}

// ===== ИНТЕРФЕЙСЫ ДЛЯ ГРУППИРОВКИ ПО НЕДЕЛЯМ =====

/**
 * Интерфейс для строки сотрудника в конкретной неделе
 */
export interface ITimetableStaffRow {
  staffId: string;
  staffName: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
  weekData: IWeeklyStaffData; // Данные только для этой недели
}

/**
 * Интерфейс для группы недели
 */
export interface IWeekGroup {
  weekInfo: IWeekInfo;
  staffRows: ITimetableStaffRow[];
  isExpanded: boolean;
  hasData: boolean; // Есть ли данные у хотя бы одного сотрудника на этой неделе
}

/**
 * Интерфейс для состояния Timetable tab
 */
export interface ITimetableTabState {
  selectedDate: Date;
  staffRecords: IStaffRecord[];
  isLoadingStaffRecords: boolean;
  errorStaffRecords?: string;
  
  // Состояние групп недель
  expandedWeeks: Set<number>; // Какие недели развернуты (по weekNum)
  weeksData: IWeekGroup[];    // Данные, сгруппированные по неделям
  weeks: IWeekInfo[];         // Информация о неделях месяца
}

/**
 * Интерфейс для строки таблицы расписания (старый формат - для совместимости)
 */
export interface ITimetableRow {
  staffId: string;
  staffName: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
  weeks: { [weekNumber: number]: IWeeklyStaffData };
}

/**
 * Тип для отображения режима таблицы
 */
export enum TimetableDisplayMode {
  ByWeeks = 'weeks',
  ByDays = 'days'
}

/**
 * Интерфейс для пропсов компонентов таблицы (старый формат - для совместимости)
 */
export interface ITimetableTableProps {
  data: ITimetableRow[];
  weeks: IWeekInfo[];
  displayMode: TimetableDisplayMode;
  isLoading: boolean;
  dayOfStartWeek: number;
}

/**
 * Интерфейс для пропсов рендеринга ячейки (старый формат - для совместимости)
 */
export interface ITimetableCellProps {
  staffData: IWeeklyStaffData;
  dayNumber?: number; // Если показываем конкретный день
  isWeekMode: boolean;
}

export interface IWeekCalculationParams {
  selectedDate: Date;
  startWeekDay: number; // 1=Sunday, 2=Monday, etc.
}

/**
 * Интерфейс для сотрудника (заменяет 'any')
 */
export interface IStaffMember {
  id: string;
  name: string;
  employeeId?: string;
  deleted?: number;
  isTemplate?: boolean;
}

/**
 * Интерфейс для параметров обработки данных
 * ОБНОВЛЕНО: Добавлена поддержка праздников
 */
export interface ITimetableDataParams {
  staffRecords: IStaffRecord[];
  staffMembers: IStaffMember[];
  weeks: IWeekInfo[];
  
  // Параметры для логирования и совместимости (данные уже отфильтрованы на сервере)
  currentUserId?: string;    // ID текущего пользователя (менеджера)
  managingGroupId?: string;  // ID управляющей группы
  
  // СУЩЕСТВУЮЩЕЕ: Функция для получения цвета типа отпуска
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  
  // НОВОЕ: Константа цвета праздника
  holidayColor?: string;     // Цвет праздника (по умолчанию #f44336)
}

/**
 * Интерфейс для результата расчета времени смены
 * ОБНОВЛЕНО: Добавлена поддержка праздников
 */
export interface IShiftCalculationResult {
  workMinutes: number;
  formattedTime: string; // "8h 30m"
  formattedShift: string; // "09:00 - 17:00 (8h 30m)"
  
  // СУЩЕСТВУЮЩИЕ: Информация о типе отпуска
  typeOfLeaveId?: string;
  typeOfLeaveTitle?: string;
  typeOfLeaveColor?: string;
  
  // НОВЫЕ: Информация о празднике
  isHoliday?: boolean;       // Флаг праздника
  holidayColor?: string;     // Цвет праздника
}

/**
 * Интерфейс для параметров расчета смены
 * ОБНОВЛЕНО: Добавлена поддержка праздников
 */
export interface IShiftCalculationParams {
  startTime: Date;
  endTime: Date;
  lunchStart?: Date;
  lunchEnd?: Date;
  timeForLunch?: number;
  
  // СУЩЕСТВУЮЩИЕ: Информация о типе отпуска из StaffRecord
  typeOfLeaveId?: string;
  typeOfLeaveTitle?: string;
  typeOfLeaveColor?: string;
  
  // НОВЫЕ: Информация о празднике из StaffRecord
  isHoliday?: boolean;       // Holiday = 1
  holidayColor?: string;     // Цвет праздника (#f44336)
}

// ===== ИНТЕРФЕЙСЫ ДЛЯ КОМПОНЕНТОВ =====

/**
 * Интерфейс для пропсов группы недели
 * ОБНОВЛЕНО: Добавлена поддержка праздников
 */
export interface IWeekGroupProps {
  weekGroup: IWeekGroup;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
  
  // СУЩЕСТВУЮЩЕЕ: Функция для получения цвета типа отпуска
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  
  // НОВОЕ: Цвет праздника
  holidayColor?: string;     // Цвет праздника (по умолчанию #f44336)
}

/**
 * Интерфейс для пропсов заголовка недели
 */
export interface IWeekGroupHeaderProps {
  weekInfo: IWeekInfo;
  isExpanded: boolean;
  hasData: boolean;
  staffCount: number;
  onToggle: () => void;
}

/**
 * Интерфейс для пропсов содержимого недели
 * ОБНОВЛЕНО: Добавлена поддержка праздников
 */
export interface IWeekGroupContentProps {
  staffRows: ITimetableStaffRow[];
  weekInfo: IWeekInfo;
  dayOfStartWeek: number;
  
  // СУЩЕСТВУЮЩЕЕ: Функция для получения цвета типа отпуска
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  
  // НОВОЕ: Цвет праздника
  holidayColor?: string;     // Цвет праздника (по умолчанию #f44336)
}

/**
 * Интерфейс для пропсов управления разворачиванием
 */
export interface IExpandControlsProps {
  totalWeeks: number;
  expandedCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

// ===== НОВЫЕ ИНТЕРФЕЙСЫ ДЛЯ ПРАЗДНИКОВ =====

/**
 * Константы цветов для системы
 */
export const TIMETABLE_COLORS = {
  HOLIDAY: '#f44336',           // Красный цвет для праздников (высший приоритет)
  DEFAULT_LEAVE: '#ffeb3b',     // Желтый цвет для отпусков по умолчанию
  DEFAULT_BACKGROUND: '#ffffff' // Белый цвет по умолчанию
} as const;

/**
 * Интерфейс для приоритетов цветов
 */
export interface IColorPriority {
  priority: number;             // Приоритет (1 = высший)
  color: string;               // Цвет в Hex формате
  reason: string;              // Причина (Holiday, Leave Type, Default)
}

/**
 * Перечисление приоритетов цветов
 */
export enum ColorPriority {
  HOLIDAY = 1,                 // Праздник - высший приоритет
  LEAVE_TYPE = 2,              // Тип отпуска - средний приоритет
  DEFAULT = 3                  // По умолчанию - низший приоритет
}

/**
 * Интерфейс для анализа цветов дня
 */
export interface IDayColorAnalysis {
  finalColor: string;          // Итоговый цвет
  appliedPriority: ColorPriority; // Примененный приоритет
  reasons: string[];           // Список причин для отладки
  hasHoliday: boolean;         // Есть ли праздник
  hasLeave: boolean;           // Есть ли отпуск
  holidayShiftsCount: number;  // Количество смен с праздником
  leaveShiftsCount: number;    // Количество смен с отпуском
}

/**
 * Тип для функции определения цвета ячейки
 */
export type CellColorResolver = (shifts: IShiftInfo[], getLeaveTypeColor?: (id: string) => string | undefined) => IDayColorAnalysis;