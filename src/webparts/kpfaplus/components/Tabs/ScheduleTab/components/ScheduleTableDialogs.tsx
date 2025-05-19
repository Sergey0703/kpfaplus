// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableDialogs.tsx
import * as React from 'react';
import { ConfirmDialog } from '../../../ConfirmDialog/ConfirmDialog';

export interface IScheduleTableDialogsProps {
  confirmDialogProps: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmButtonText: string;
    cancelButtonText: string;
    onConfirm: () => void;
    confirmButtonColor: string;
  };
  onDismiss: () => void;
}

export const ScheduleTableDialogs: React.FC<IScheduleTableDialogsProps> = (props) => {
  const { confirmDialogProps, onDismiss } = props;
  
  return (
    <ConfirmDialog
      isOpen={confirmDialogProps.isOpen}
      title={confirmDialogProps.title}
      message={confirmDialogProps.message}
      confirmButtonText={confirmDialogProps.confirmButtonText}
      cancelButtonText={confirmDialogProps.cancelButtonText}
      onConfirm={confirmDialogProps.onConfirm}
      onDismiss={onDismiss}
      confirmButtonColor={confirmDialogProps.confirmButtonColor}
    />
  );
};