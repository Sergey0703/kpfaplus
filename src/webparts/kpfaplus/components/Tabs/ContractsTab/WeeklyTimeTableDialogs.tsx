// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableDialogs.tsx
import * as React from 'react';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { DialogType } from './actions/WeeklyTimeTableTypes';

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
  additionalData?: any
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
    case DialogType.DELETE:
      dialogProps = {
        title: 'Confirm Deletion',
        message: 'Are you sure you want to delete this shift?',
        confirmButtonText: 'Delete',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d83b01' // Red color for deletion
      };
      break;
      
    case DialogType.RESTORE:
      dialogProps = {
        title: 'Confirm Restoration',
        message: 'Are you sure you want to restore this shift?',
        confirmButtonText: 'Restore',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#107c10' // Green color for restoration
      };
      break;
      
    case DialogType.ADD_WEEK:
      // Получаем информацию о новой неделе из additionalData
      const weekNumberToAdd = additionalData?.weekNumberToAdd || 1;
      const message = additionalData?.message || `New week ${weekNumberToAdd} will be added.`;
      
      dialogProps = {
        title: 'Add New Week',
        message: `${message} Are you sure you want to add a new week?`,
        confirmButtonText: 'Add',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0078d4' // Blue color for adding
      };
      break;
      
    case DialogType.ADD_SHIFT:
      // Получаем информацию о новой смене из additionalData
      const weekNumber = additionalData?.weekNumber || 1;
      const nextShiftNumber = additionalData?.nextShiftNumber || 1;
      
      dialogProps = {
        title: 'Add New Shift',
        message: `Do you want to add a new shift ${nextShiftNumber} for week ${weekNumber}?`,
        confirmButtonText: 'Add Shift',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#0078d4' // Blue color for adding
      };
      break;
      
    case DialogType.INFO:
      // Информационный диалог с различными вариантами сообщений
      const infoMessage = additionalData?.message || 'Information';
      const customConfirmText = additionalData?.confirmButtonText || 'OK';
      const customCancelText = additionalData?.cancelButtonText || 'Cancel';
      
      dialogProps = {
        title: 'Information',
        message: infoMessage,
        confirmButtonText: customConfirmText,
        cancelButtonText: customCancelText,
        confirmButtonColor: '#0078d4' // Blue color for information
      };
      break;
      
    default:
      console.error(`Unknown dialog type: ${dialogType}`);
  }
  
  return dialogProps;
};

export default WeeklyTimeTableDialogs;