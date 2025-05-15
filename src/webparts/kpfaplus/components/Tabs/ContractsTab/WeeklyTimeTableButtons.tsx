// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableButtons.tsx
import * as React from 'react';
import {
  PrimaryButton,
  IconButton
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';

interface IAddShiftButtonProps {
  onClick: () => void;
  isSaving: boolean;
}

/**
 * Компонент кнопки добавления смены
 */
export const AddShiftButton: React.FC<IAddShiftButtonProps> = ({
  onClick,
  isSaving
}) => {
  return (
    <PrimaryButton
      text="+ Shift"
      onClick={onClick}
      styles={{ 
        root: { 
          minWidth: '60px', 
          height: '24px', 
          fontSize: '12px',
          padding: '0 8px'
        }
      }}
      disabled={isSaving}
    />
  );
};

interface IDeleteButtonProps {
  rowIndex: number;
  rowId: string;
  onClick: (rowId: string) => void;
  isSaving: boolean;
  isDeleted?: boolean; // Добавляем свойство isDeleted
}

/**
 * Компонент кнопки удаления или восстановления (в зависимости от статуса удаления)
 */
export const DeleteButton: React.FC<IDeleteButtonProps> = ({
  rowIndex,
  rowId,
  onClick,
  isSaving,
  isDeleted = false
}) => {
  console.log(`DeleteButton for row ID=${rowId}, rowIndex=${rowIndex}, isDeleted=${isDeleted}`);
  
  return (
    <IconButton
      iconProps={{ iconName: isDeleted ? 'Refresh' : 'Delete' }}
      title={isDeleted ? "Restore" : "Delete"}
      ariaLabel={isDeleted ? "Restore" : "Delete"}
      onClick={() => onClick(rowId)}
      styles={{ 
        root: { 
          margin: 0, 
          padding: 0,
          color: isDeleted ? '#107c10' : '#e81123',
          selectors: {
            '&:hover': {
              color: isDeleted ? '#85d185' : '#f1707b'
            }
          }
        },
        icon: {
          fontSize: '16px',
          fontWeight: 600
        }
      }}
      disabled={isSaving}
    />
  );
};

interface ISaveButtonProps {
  onClick: () => Promise<void>;
  disabled: boolean;
  isSaving: boolean;
}

/**
 * Компонент кнопки сохранения
 */
export const SaveButton: React.FC<ISaveButtonProps> = ({
  onClick,
  disabled,
  isSaving
}) => {
  return (
    <PrimaryButton
      text="Save"
      onClick={onClick}
      iconProps={{ iconName: 'Save' }}
      disabled={disabled || isSaving}
    />
  );
};

interface INewWeekButtonProps {
  onClick: () => void;
  isSaving: boolean;
}

/**
 * Компонент кнопки добавления новой недели
 */
export const NewWeekButton: React.FC<INewWeekButtonProps> = ({
  onClick,
  isSaving
}) => {
  return (
    <PrimaryButton
      text="New Week"
      onClick={onClick}
      styles={{ root: { marginRight: 8 } }}
      disabled={isSaving}
    />
  );
};

interface IActionsCellProps {
  rowId: string;
  renderDeleteButton: () => JSX.Element;
  isDeleted?: boolean; // Добавляем флаг удаления
}

/**
 * Компонент ячейки с действиями
 */
export const ActionsCell: React.FC<IActionsCellProps> = ({
  rowId,
  renderDeleteButton,
  isDeleted = false
}) => {
  console.log(`ActionsCell for row ID=${rowId}, isDeleted=${isDeleted}`);
  
  return (
    <div className={styles.actionsContainer}>
      {renderDeleteButton()}
      <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>ID: {rowId}</span>
    </div>
  );
};