// models/types.ts
import * as React from 'react';
import { WebPartContext } from "@microsoft/sp-webpart-base";

export interface IStaffMember {
  id: string;
  name: string;
  groupMemberId?: string;
  employeeId?: string;
  autoSchedule?: boolean;
  deleted?: number; // Изменено с boolean на number
  contractedHours?: number;
  photo?: string;
  pathForSRSFile?: string;
  generalNote?: string;
}

export interface IDepartment {
  ID: number;
  Title: string;
  DayOfStartWeek?: number;
  // Дополнительные поля департамента
}

// --- NEW INTERFACES FOR USER IMPERSONATION ---

/**
 * Interface for user information used in impersonation
 */
export interface IUserInfo {
  ID: number;
  Title: string;
  Email: string;
}

/**
 * Interface for impersonation state
 */
export interface IImpersonationState {
  /** The original logged-in user */
  originalUser: IUserInfo | null;
  /** The user being impersonated (if any) */
  impersonatedUser: IUserInfo | null;
  /** Whether impersonation is currently active */
  isImpersonating: boolean;
}

/**
 * Interface for impersonation actions
 */
export interface IImpersonationActions {
  /** Start impersonating a specific user */
  startImpersonation: (user: IUserInfo) => void;
  /** Stop impersonation and return to original user */
  stopImpersonation: () => void;
  /** Get the currently effective user (impersonated or original) */
  getEffectiveUser: () => IUserInfo | null;
}

// --- END NEW INTERFACES ---

export interface ITabProps {
  selectedStaff: IStaffMember | undefined; // Изменено с null на undefined
  autoSchedule?: boolean;
  onAutoScheduleChange?: (ev: React.MouseEvent<HTMLElement>, checked?: boolean) => void;
  srsFilePath?: string;
  onSrsFilePathChange?: (newValue: string) => void;
  generalNote?: string;
  onGeneralNoteChange?: (newValue: string) => void;
  currentUserId?: string;
  managingGroupId?: string;
  // Новое поле для DayOfStartWeek
  dayOfStartWeek?: number;
  // Существующие свойства
  isEditMode?: boolean;
  onSave?: () => Promise<void>;
  onCancel?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  // Новое свойство
  onAddNewStaff?: () => void; // Добавляем обработчик для создания нового сотрудника
  // Добавляем контекст веб-части как необязательный параметр
  context?: WebPartContext;
}

// src/webparts/kpfaplus/models/types.ts - добавим новые интерфейсы

export interface IGroupMember {
  ID: number;
  Title: string;
  Group: {  // Изменено с StaffGroup на Group
    ID: number;
    Title?: string;
  };
  Employee: {
    Id: string;
    Title?: string;
  };
  AutoSchedule: boolean;
  PathForSRSFile: string;
  GeneralNote: string;
  Deleted: number; // Изменено с boolean на number
  ContractedHours: number;
}

// Интерфейс данных для обновления сотрудника
export interface IStaffMemberUpdateData {
  name?: string;
  autoSchedule?: boolean;
  pathForSRSFile?: string;
  generalNote?: string;
  deleted?: number; // Изменено с boolean на number
}