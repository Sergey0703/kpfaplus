// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableDialogs.tsx
import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { DialogType } from './actions/WeeklyTimeTableTypes';

// Определяем интерфейсы для данных диалогов
export interface IAddWeekDialogData {
  weekNumberToAdd: number;
  message: string;
  canAdd: boolean;
  fullyDeletedWeeks: number[];
}

export interface IAddShiftDialogData {
  weekNumber: number;
  nextShiftNumber: number;
  contractId?: string;
}

export interface IInfoDialogData {
  message: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  customAction?: (confirmed: boolean) => void;
}

export interface IWeeklyTimeTableDialogsProps {
  // Состояние диалогов
  isDialogOpen: boolean;
  dialogTitle: string;
  dialogMessage: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  
  // Обработчики диалогов
  onDialogDismiss: () => void;
  onDialogConfirm: () => void;
}

/**
 * Компонент, содержащий все диалоги для операций с недельным расписанием
 */
export const WeeklyTimeTableDialogs: React.FC<IWeeklyTimeTableDialogsProps> = ({
  isDialogOpen,
  dialogTitle,
  dialogMessage,
  confirmButtonText,
  cancelButtonText,
  confirmButtonColor,
  onDialogDismiss,
  onDialogConfirm
}) => {
  return (
    <ConfirmDialog
      isOpen={isDialogOpen}
      title={dialogTitle}
      message={dialogMessage}
      confirmButtonText={confirmButtonText}
      cancelButtonText={cancelButtonText}
      onDismiss={onDialogDismiss}
      onConfirm={onDialogConfirm}
      confirmButtonColor={confirmButtonColor}
    />
  );
};

/**
 * Фабрика для создания параметров диалогов разных типов
 */
export const createDialogProps = (
  dialogType: DialogType,
  additionalData?: unknown // Используем unknown для обратной совместимости
): {
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
} => {
  // Значения по умолчанию
  let dialogProps = {
    title: '',
    message: '',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#0078d4' // Default blue color
  };
  
  // Настраиваем свойства в зависимости от типа диалога
  switch (dialogType) {
    case DialogType.DELETE: {
      // Используем блок кода с фигурными скобками для case, чтобы избежать проблем с областью видимости
      dialogProps = {
        title: 'Confirm Deletion',
        message: 'Are you sure you want to delete this shift?',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d83b01' // Red color for deletion
      };
      break;
    }
      
    case DialogType.RESTORE: {
      dialogProps = {
        title: 'Confirm Restoration',
        message: 'Are you sure you want to restore this shift?',
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#107c10' // Green color for restoration
      };
      break;
    }
      
    case DialogType.ADD_WEEK: {
      // Получаем информацию о новой неделе из additionalData
      const addWeekData = additionalData as IAddWeekDialogData;
      const weekNumberToAdd = addWeekData?.weekNumberToAdd || 1;
      const message = addWeekData?.message || `New week ${weekNumberToAdd} will be added.`;
      
      dialogProps = {
        title: 'Add New Week',
        message: `${message} Are you sure you want to add a new week?`,
        confirmButtonText: 'Add',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0078d4' // Blue color for adding
      };
      break;
    }
      
    case DialogType.ADD_SHIFT: {
      // Получаем информацию о новой смене из additionalData
      const addShiftData = additionalData as IAddShiftDialogData;
      const weekNumber = addShiftData?.weekNumber || 1;
      const nextShiftNumber = addShiftData?.nextShiftNumber || 1;
      
      dialogProps = {
        title: 'Add New Shift',
        message: `Do you want to add a new shift ${nextShiftNumber} for week ${weekNumber}?`,
        confirmButtonText: 'Add Shift',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0078d4' // Blue color for adding
      };
      break;
    }
      
    case DialogType.INFO: {
      // Информационный диалог с различными вариантами сообщений
      const infoData = additionalData as IInfoDialogData;
      const infoMessage = infoData?.message || 'Information';
      const customConfirmText = infoData?.confirmButtonText || 'OK';
      const customCancelText = infoData?.cancelButtonText || 'Cancel';
      
      dialogProps = {
        title: 'Information',
        message: infoMessage,
        confirmButtonText: customConfirmText,
        cancelButtonText: customCancelText,
        confirmButtonColor: '#0078d4' // Blue color for information
      };
      break;
    }
      
    default:
      console.error(`Unknown dialog type: ${dialogType}`);
  }
  
  return dialogProps;
};

export default WeeklyTimeTableDialogs;