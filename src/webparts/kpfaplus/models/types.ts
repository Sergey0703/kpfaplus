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