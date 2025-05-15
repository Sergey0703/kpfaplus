// src/webparts/kpfaplus/components/Tabs/ContractsTab/actions/WeeklyTimeTableTypes.ts
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IExtendedWeeklyTimeRow } from '../WeeklyTimeTableLogic';

/**
 * Типы диалогов
 */
export enum DialogType {
  DELETE = 'delete',        // Диалог удаления смены
  RESTORE = 'restore',      // Диалог восстановления смены 
  ADD_WEEK = 'addWeek',     // Диалог добавления новой недели
  ADD_SHIFT = 'addShift',   // Диалог добавления новой смены
  INFO = 'info'             // Информационный диалог
}

// Определяем общий тип для statusMessage, используя undefined вместо null
export type StatusMessageType = {
  type: MessageBarType;
  message: string;
} | undefined;

// Определяем тип для pendingActionRowIdRef, используя undefined вместо null
export type PendingActionRowIdRefType = React.MutableRefObject<string | undefined>;

/**
 * Тип функции для выполнения добавления новой недели
 */
export type ExecuteAddNewWeekFn = (
  context: WebPartContext,
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  contractId: string | undefined,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>,
  weekNumberToAdd: number,
  currentUserId: number,
  onSaveComplete?: (success: boolean) => void,
  onRefresh?: () => void
) => void;

/**
 * Тип функции для выполнения добавления новой смены
 */
export type ExecuteAddNewShiftFn = (
  context: WebPartContext,
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  contractId: string | undefined,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>,
  weekNumber: number,
  shiftNumber: number,
  currentUserId: number,
  onSaveComplete?: (success: boolean) => void,
  onRefresh?: () => void
) => void;