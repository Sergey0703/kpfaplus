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

/**
 * Интерфейс для строки таблицы расписания
 */
export interface ITimetableRow {
  staffId: string;
  staffName: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
  weeks: { [weekNumber: number]: IWeeklyStaffData };
}

/**
 * Интерфейс для параметров расчета недель
 */
export interface IWeekCalculationParams {
  selectedDate: Date;
  startWeekDay: number; // 1=Sunday, 2=Monday, etc.
}

/**
 * Интерфейс для параметров обработки данных
 */
export interface ITimetableDataParams {
  staffRecords: IStaffRecord[];
  staffMembers: any[]; // Из контекста
  weeks: IWeekInfo[];
  enterLunchTime: boolean;
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
  enterLunchTime: boolean;
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
  dayNumber?: number; // Если показываем конкретный день
  isWeekMode: boolean;
}