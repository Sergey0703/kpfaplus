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
}

/**
 * Интерфейс для информации о дне
 */
export interface IDayInfo {
  dayNumber: number; // 1=Sunday, 2=Monday, etc.
  date: Date;
  shifts: IShiftInfo[];
  totalMinutes: number;
  formattedContent: string; // Полный текст для ячейки
  hasData: boolean;
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
 * Параметры currentUserId и managingGroupId оставлены для совместимости и логирования
 */
export interface ITimetableDataParams {
  staffRecords: IStaffRecord[];
  staffMembers: IStaffMember[]; // FIXED: заменили 'any[]' на 'IStaffMember[]'
  weeks: IWeekInfo[];
  
  // Параметры для логирования и совместимости (данные уже отфильтрованы на сервере)
  currentUserId?: string;    // ID текущего пользователя (менеджера)
  managingGroupId?: string;  // ID управляющей группы
}

/**
 * Интерфейс для результата расчета времени смены
 */
export interface IShiftCalculationResult {
  workMinutes: number;
  formattedTime: string; // "8h 30m"
  formattedShift: string; // "09:00 - 17:00 (8h 30m)"
}

/**
 * Интерфейс для параметров расчета смены
 */
export interface IShiftCalculationParams {
  startTime: Date;
  endTime: Date;
  lunchStart?: Date;
  lunchEnd?: Date;
  timeForLunch?: number;
}

// ===== ИНТЕРФЕЙСЫ ДЛЯ КОМПОНЕНТОВ =====

/**
 * Интерфейс для пропсов группы недели
 */
export interface IWeekGroupProps {
  weekGroup: IWeekGroup;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
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