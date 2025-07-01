// src/webparts/kpfaplus/components/Tabs/TimetableTab/interfaces/TimetableInterfaces.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IHoliday, HolidaysService } from '../../../../services/HolidaysService';

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
  
  // Поля для типа отпуска
  typeOfLeaveId?: string;
  typeOfLeaveTitle?: string;
  typeOfLeaveColor?: string;
  
  // Поля для праздников
  isHoliday?: boolean;
  holidayColor?: string;
}

/**
 * Интерфейс для информации о дне
 */
export interface IDayInfo {
  dayNumber: number; // 1=Sunday, 2=Monday, etc.
  date: Date;
  shifts: IShiftInfo[];
  totalMinutes: number;
  formattedContent: string;
  hasData: boolean;
  
  // Поля для отображения цвета отпуска
  leaveTypeColor?: string;
  hasLeave: boolean;
  
  // Поля для праздников
  hasHoliday: boolean;
  holidayColor?: string;
  
  // Финальный цвет ячейки с учетом приоритетов
  finalCellColor?: string;
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

/**
 * Интерфейс для строки сотрудника в конкретной неделе
 */
export interface ITimetableStaffRow {
  staffId: string;
  staffName: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
  weekData: IWeeklyStaffData;
}

/**
 * Интерфейс для группы недели
 */
export interface IWeekGroup {
  weekInfo: IWeekInfo;
  staffRows: ITimetableStaffRow[];
  isExpanded: boolean;
  hasData: boolean;
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
  expandedWeeks: Set<number>;
  weeksData: IWeekGroup[];
  weeks: IWeekInfo[];
}

/**
 * Интерфейс для строки таблицы расписания (для совместимости)
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
 * Интерфейс для пропсов компонентов таблицы
 */
export interface ITimetableTableProps {
  data: ITimetableRow[];
  weeks: IWeekInfo[];
  displayMode: TimetableDisplayMode;
  isLoading: boolean;
  dayOfStartWeek: number;
}

/**
 * Интерфейс для пропсов рендеринга ячейки
 */
export interface ITimetableCellProps {
  staffData: IWeeklyStaffData;
  dayNumber?: number;
  isWeekMode: boolean;
}

export interface IWeekCalculationParams {
  selectedDate: Date;
  startWeekDay: number; // 1=Sunday, 2=Monday, etc.
}

/**
 * Интерфейс для сотрудника
 */
export interface IStaffMember {
  id: string;
  name: string;
  employeeId?: string;
  deleted?: number;
  isTemplate?: boolean;
}

/**
 * *** ОБНОВЛЕННЫЙ ИНТЕРФЕЙС: Добавлена поддержка holidays ***
 * Интерфейс для параметров обработки данных
 */
export interface ITimetableDataParams {
  staffRecords: IStaffRecord[];
  staffMembers: IStaffMember[];
  weeks: IWeekInfo[];
  
  currentUserId?: string;
  managingGroupId?: string;
  
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  holidayColor?: string;
  
  // *** НОВЫЕ ПОЛЯ ДЛЯ HOLIDAYS ***
  holidays?: IHoliday[];
  holidaysService?: HolidaysService;
}

/**
 * Интерфейс для результата расчета времени смены
 */
export interface IShiftCalculationResult {
  workMinutes: number;
  formattedTime: string; // "8h 30m"
  formattedShift: string; // "09:00 - 17:00 (8h 30m)"
  
  // Информация о типе отпуска
  typeOfLeaveId?: string;
  typeOfLeaveTitle?: string;
  typeOfLeaveColor?: string;
  
  // Информация о празднике
  isHoliday?: boolean;
  holidayColor?: string;
}

/**
 * *** ОБНОВЛЕННЫЙ ИНТЕРФЕЙС: Добавлена поддержка holidays ***
 * Интерфейс для параметров расчета смены
 */
export interface IShiftCalculationParams {
  startTime: Date;
  endTime: Date;
  lunchStart?: Date;
  lunchEnd?: Date;
  timeForLunch?: number;
  
  // Информация о типе отпуска из StaffRecord
  typeOfLeaveId?: string;
  typeOfLeaveTitle?: string;
  typeOfLeaveColor?: string;
  
  // Информация о празднике из StaffRecord
  isHoliday?: boolean;
  holidayColor?: string;
  
  // *** НОВЫЕ ПОЛЯ ДЛЯ HOLIDAYS ***
  recordDate?: Date; // Дата записи для проверки holidays
  holidays?: IHoliday[]; // Список holidays для проверки
  holidaysService?: HolidaysService; // Service для проверки holidays
}

/**
 * Интерфейс для пропсов группы недели
 */
export interface IWeekGroupProps {
  weekGroup: IWeekGroup;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
  
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  holidayColor?: string;
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
 */
export interface IWeekGroupContentProps {
  staffRows: ITimetableStaffRow[];
  weekInfo: IWeekInfo;
  dayOfStartWeek: number;
  
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  holidayColor?: string;
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

/**
 * Константы цветов для системы
 */
export const TIMETABLE_COLORS = {
  HOLIDAY: '#f44336',           // Красный цвет для праздников (высший приоритет)
  DEFAULT_LEAVE: '#ffeb3b',     // Желтый цвет для отпусков по умолчанию
  DEFAULT_BACKGROUND: '#ffffff' // Белый цвет по умолчанию
};

/**
 * Интерфейс для приоритетов цветов
 */
export interface IColorPriority {
  priority: number;
  color: string;
  reason: string;
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
  finalColor: string;
  appliedPriority: ColorPriority;
  reasons: string[];
  hasHoliday: boolean;
  hasLeave: boolean;
  holidayShiftsCount: number;
  leaveShiftsCount: number;
}

/**
 * Тип для функции определения цвета ячейки
 */
export type CellColorResolver = (shifts: IShiftInfo[], getLeaveTypeColor?: (id: string) => string | undefined) => IDayColorAnalysis;