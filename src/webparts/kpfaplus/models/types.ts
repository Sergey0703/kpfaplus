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
}

export interface IDepartment {
  ID: number;
  Title: string;
  // Дополнительные поля департамента
}

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

// Формат данных для отображения в галерее
export interface IStaffMember {
  id: string;
  name: string;
  groupMemberId?: string; // Делаем необязательным
  employeeId?: string;    // Делаем необязательным
  autoSchedule?: boolean;
  pathForSRSFile?: string;
  generalNote?: string;
  deleted?: number; // Изменено с boolean на number
  contractedHours?: number;
  photo?: string;
}

// src/webparts/kpfaplus/models/types.ts - дополнение существующего файла

export interface ITabProps {
  selectedStaff: IStaffMember | undefined;
  autoSchedule?: boolean;
  onAutoScheduleChange?: (ev: React.MouseEvent<HTMLElement>, checked?: boolean) => void;
  srsFilePath?: string;
  onSrsFilePathChange?: (newValue: string) => void;
  generalNote?: string;
  onGeneralNoteChange?: (newValue: string) => void;
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

// Интерфейс данных для обновления сотрудника
export interface IStaffMemberUpdateData {
  name?: string;
  autoSchedule?: boolean;
  pathForSRSFile?: string;
  generalNote?: string;
  deleted?: number; // Изменено с boolean на number
}