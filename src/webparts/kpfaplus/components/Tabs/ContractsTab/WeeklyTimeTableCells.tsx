// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableCells.tsx
import * as React from 'react';
import {
  Dropdown,
  IDropdownOption
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { IExtendedWeeklyTimeRow } from './WeeklyTimeTableLogic';

interface ITimeCellProps {
  hours: string;
  minutes: string;
  rowIndex: number;
  dayKey: string;
  isChanged: boolean;
  hoursOptions: IDropdownOption[];
  minutesOptions: IDropdownOption[];
  onTimeChange: (rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string) => void;
}

/**
 * Компонент для отображения ячейки времени
 */
export const TimeCell: React.FC<ITimeCellProps> = ({
  hours, 
  minutes, 
  rowIndex, 
  dayKey, 
  isChanged,
  hoursOptions,
  minutesOptions,
  onTimeChange
}) => {
  // Определяем стили для ячейки в зависимости от того, была ли она изменена
  const cellClassName = isChanged ? `${styles.timeCell} ${styles.changedCell}` : styles.timeCell;
  
  return (
    <div className={cellClassName}>
      <Dropdown
        options={hoursOptions}
        selectedKey={hours}
        onChange={(e, option) => onTimeChange(rowIndex, dayKey, 'hours', option?.key as string || '00')}
        styles={{ 
          dropdown: { 
            width: 50,
            fontSize: '12px'
          },
          title: {
            fontSize: '12px',
            padding: '0 8px'
          },
          dropdownItemHeader: {
            fontSize: '12px'
          },
          dropdownItem: {
            fontSize: '12px',
            minHeight: '24px'
          },
          dropdownItemSelected: {
            fontSize: '12px',
            minHeight: '24px'
          }
        }}
      />
      <span className={styles.timeSeparator}>:</span>
      <Dropdown
        options={minutesOptions}
        selectedKey={minutes}
        onChange={(e, option) => onTimeChange(rowIndex, dayKey, 'minutes', option?.key as string || '00')}
        styles={{ 
          dropdown: { 
            width: 50,
            fontSize: '12px'
          },
          title: {
            fontSize: '12px',
            padding: '0 8px'
          },
          dropdownItemHeader: {
            fontSize: '12px'
          },
          dropdownItem: {
            fontSize: '12px',
            minHeight: '24px'
          },
          dropdownItemSelected: {
            fontSize: '12px',
            minHeight: '24px'
          }
        }}
      />
    </div>
  );
};

interface ILunchCellProps {
  lunch: string;
  rowIndex: number;
  isChanged: boolean;
  lunchOptions: IDropdownOption[];
  onLunchChange: (rowIndex: number, value: string) => void;
}

/**
 * Компонент для отображения ячейки с временем обеда
 */
export const LunchCell: React.FC<ILunchCellProps> = ({
  lunch,
  rowIndex,
  isChanged,
  lunchOptions,
  onLunchChange
}) => {
  // Определяем стили для ячейки в зависимости от того, была ли она изменена
  const dropdownStyles = isChanged ? {
    dropdown: { 
      width: 50,
      fontSize: '12px',
      backgroundColor: 'rgba(255, 255, 0, 0.1)',
      border: '1px solid #ffcc00'
    },
    title: {
      fontSize: '12px',
      padding: '0 8px'
    },
    dropdownItemHeader: {
      fontSize: '12px'
    },
    dropdownItem: {
      fontSize: '12px',
      minHeight: '24px'
    },
    dropdownItemSelected: {
      fontSize: '12px',
      minHeight: '24px'
    }
  } : {
    dropdown: { 
      width: 50,
      fontSize: '12px'
    },
    title: {
      fontSize: '12px',
      padding: '0 8px'
    },
    dropdownItemHeader: {
      fontSize: '12px'
    },
    dropdownItem: {
      fontSize: '12px',
      minHeight: '24px'
    },
    dropdownItemSelected: {
      fontSize: '12px',
      minHeight: '24px'
    }
  };
  
  return (
    <Dropdown
      options={lunchOptions}
      selectedKey={lunch}
      onChange={(e, option) => onLunchChange(rowIndex, option?.key as string || '0')}
      styles={dropdownStyles}
    />
  );
};

interface IContractCellProps {
  contractNumber: string;
  rowIndex: number;
  isChanged: boolean;
  onContractChange: (rowIndex: number, value: string) => void;
}

/**
 * Компонент для отображения ячейки с номером контракта
 */
export const ContractCell: React.FC<IContractCellProps> = ({
  contractNumber,
  rowIndex,
  isChanged,
  onContractChange
}) => {
  // Определяем стили для ячейки в зависимости от того, была ли она изменена
  const dropdownStyles = isChanged ? {
    dropdown: { 
      width: 50,
      fontSize: '12px',
      backgroundColor: 'rgba(255, 255, 0, 0.1)',
      border: '1px solid #ffcc00'
    },
    title: {
      fontSize: '12px',
      padding: '0 8px'
    }
  } : {
    dropdown: { 
      width: 50,
      fontSize: '12px'
    },
    title: {
      fontSize: '12px',
      padding: '0 8px'
    }
  };
  
  return (
    <Dropdown
      options={[
        { key: '1', text: '1' },
        { key: '2', text: '2' },
        { key: '3', text: '3' },
      ]}
      selectedKey={contractNumber}
      onChange={(e, option) => onContractChange(rowIndex, option?.key as string || '1')}
      styles={dropdownStyles}
    />
  );
};

interface ITotalHoursCellProps {
  timeTableData: IExtendedWeeklyTimeRow[];
  rowIndex: number;
  isFirstRowInTemplate: boolean;
  isLastRowInTemplate: boolean;
  renderAddShiftButton: (rowIndex?: number) => JSX.Element; // Изменяем сигнатуру функции
}

/**
 * Компонент для отображения ячейки с общим временем и кнопкой добавления смены
 */
export const TotalHoursCell: React.FC<ITotalHoursCellProps> = ({
  timeTableData,
  rowIndex,
  isFirstRowInTemplate,
  isLastRowInTemplate,
  renderAddShiftButton
}) => {
  const row = timeTableData[rowIndex];
  
  return (
    <div className={styles.totalHoursContainer}>
      {isFirstRowInTemplate && (
        <div className={styles.totalHoursValue}>
          {row.displayedTotalHours || row.totalHours || '0ч:00м'}
        </div>
      )}
      {(isFirstRowInTemplate && isLastRowInTemplate) || (!isFirstRowInTemplate && isLastRowInTemplate) ? (
    <div className={isFirstRowInTemplate ? styles.addShiftButtonWrapper : styles.addShiftButtonContainer}>
      {renderAddShiftButton(rowIndex)} {/* Передаем rowIndex при вызове */}
    </div>
  ) : null}
    </div>
  );
};