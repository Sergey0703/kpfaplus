// models/types.ts
import * as React from 'react';

export interface IStaffMember {
  id: string;
  name: string;
  groupMemberId?: string;
  employeeId?: string;
  autoSchedule?: boolean;
  deleted?: boolean;
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
  Deleted: boolean;
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
  deleted?: boolean;
  contractedHours?: number;
  photo?: string;
}