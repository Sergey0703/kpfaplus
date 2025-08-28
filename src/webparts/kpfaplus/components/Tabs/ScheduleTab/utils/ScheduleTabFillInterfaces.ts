// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillInterfaces.ts

import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IDayHours } from '../../../../models/IWeeklyTimeTable';

/**
 * Interface for existing record status check
 */
export interface IExistingRecordCheck {
  id: string;
  checked: number;
  exportResult: number;
  date: Date;
  title?: string;
}

/**
 * Interface for records processing status analysis  
 */
export interface IRecordsProcessingStatus {
  hasProcessedRecords: boolean;
  processedCount: number;
  totalCount: number;
  processedRecords: IExistingRecordCheck[];
  unprocessedRecords: IExistingRecordCheck[];
}

/**
 * Interface for fill operation parameters
 */
export interface IFillOperationParams {
  selectedDate: Date;
  selectedStaffId?: string;
  employeeId: string;
  selectedContract: IContract | undefined;
  selectedContractId: string | undefined;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;
  context?: WebPartContext;
}

/**
 * Interface for operation handlers and callbacks
 */
export interface IFillOperationHandlers {
  createStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
  setOperationMessage: (message: { text: string; type: MessageBarType } | undefined) => void;
  setIsSaving: (isSaving: boolean) => void;
  onRefreshData?: () => void;
  // Новые методы для работы с существующими записями
  getExistingRecordsWithStatus?: (startDate: Date, endDate: Date, employeeId: string, currentUserId?: string, staffGroupId?: string) => Promise<IExistingRecordCheck[]>;
  markRecordsAsDeleted?: (recordIds: string[]) => Promise<boolean>;
}

/**
 * Интерфейс для шаблона расписания
 */
export interface IScheduleTemplate {
  NumberOfWeek?: number;
  numberOfWeek?: number;
  NumberOfShift?: number;
  shiftNumber?: number;
  dayOfWeek?: number;
  start?: IDayHours;
  end?: IDayHours;
  lunch?: string;
  total?: string;
  deleted?: number;
  Deleted?: number;
  [key: string]: unknown;
}

/**
 * Интерфейс для данных дня месяца
 */
export interface IDayData {
  date: Date;
  isHoliday: boolean;
  holidayInfo?: IHoliday;
  isLeave: boolean;
  leaveInfo?: { typeOfLeave: string; title: string };
  templates: IScheduleTemplate[];
  dayOfWeek: number; // 1-7, где 1 - понедельник, 7 - воскресенье
  weekNumber: number; // Номер недели в месяце (1-5)
  appliedWeekNumber: number; // Применяемый номер недели для шаблона
}

/**
 * Интерфейс для периода отпуска (оптимизированный для поиска)
 */
export interface ILeavePeriod {
  startDate: Date;
  endDate: Date;
  typeOfLeave: string;
  title: string;
}

/**
 * Интерфейс для кэша праздников
 */
export type HolidayCache = Map<string, IHoliday>;

/**
 * Интерфейс для кэша шаблонов
 */
export type TemplateCache = Map<string, IScheduleTemplate[]>;