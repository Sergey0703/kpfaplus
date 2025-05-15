// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableControls.tsx
import * as React from 'react';
import {
  Toggle,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { NewWeekButton, SaveButton } from './WeeklyTimeTableButtons';
import { StatusMessageType } from './actions/WeeklyTimeTableTypes';

export interface IWeeklyTimeTableControlsProps {
  // Основные пропсы
  contractName?: string;
  showDeleted: boolean;
  onShowDeletedChange: (ev: React.MouseEvent<HTMLElement>, checked?: boolean) => void;
  
  // Пропсы для кнопок и действий
  onAddWeek: () => void;
  onSave: () => Promise<void>;
  isButtonsDisabled: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  changedRowsCount: number;
  
  // Пропсы для статуса и сообщений
  statusMessage: StatusMessageType;
}

/**
 * Компонент для элементов управления таблицей недельного расписания
 */
export const WeeklyTimeTableControls: React.FC<IWeeklyTimeTableControlsProps> = ({
  contractName,
  showDeleted,
  onShowDeletedChange,
  onAddWeek,
  onSave,
  isButtonsDisabled,
  isSaving,
  hasUnsavedChanges,
  changedRowsCount,
  statusMessage
}) => {
  return (
    // Исправление: используем имя класса из существующих стилей
    <div className={styles.weeklyTimeTable}> 
      {/* Заголовок и переключатели */}
      <div className={styles.tableHeader}>
        <div className={styles.tableTitle}>
          <h3>{contractName || 'Weekly Schedule'}</h3>
          <div className={styles.toggleContainer}>
            <Toggle
              label="Show Deleted"
              checked={showDeleted}
              onChange={onShowDeletedChange}
              styles={{ root: { marginBottom: 0 } }}
            />
          </div>
        </div>
        <div className={styles.actionButtons}>
          <NewWeekButton onClick={onAddWeek} isSaving={isSaving} />
          <SaveButton 
            onClick={onSave} 
            disabled={isButtonsDisabled || !hasUnsavedChanges} 
            isSaving={isSaving} 
          />
          {/* Индикатор сохранения */}
          {isSaving && (
            <Spinner
              size={SpinnerSize.small}
              styles={{ root: { marginLeft: 8, display: 'inline-block' } }}
            />
          )}
        </div>
      </div>
      
      {/* Отображение статусного сообщения */}
      {statusMessage && (
        <div className={styles.statusMessageContainer}>
          <MessageBar
            messageBarType={statusMessage.type}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {statusMessage.message}
          </MessageBar>
        </div>
      )}
      
      {/* Отображение информации о количестве измененных строк */}
      {hasUnsavedChanges && changedRowsCount > 0 && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          isMultiline={false}
          styles={{ root: { marginTop: 10, marginBottom: 10 } }}
        >
          {`You have ${changedRowsCount} unsaved ${changedRowsCount === 1 ? 'change' : 'changes'}. Don't forget to click "Save" to apply them.`}
        </MessageBar>
      )}
    </div>
  );
};

export default WeeklyTimeTableControls;