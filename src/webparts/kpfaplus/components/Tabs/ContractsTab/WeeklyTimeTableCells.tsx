// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableCells.tsx
import * as React from 'react';
import {
  Dropdown,
  IDropdownOption
} from '@fluentui/react';
//import { IDropdownOption, MessageBarType } from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { IExtendedWeeklyTimeRow } from './WeeklyTimeTableLogic';

interface ITimeCellProps {
  hours: string;
  minutes: string;
  rowIndex: number;
  dayKey: string;
  isChanged: boolean;
  isDeleted?: boolean; // Добавляем флаг удаления
  hoursOptions: IDropdownOption[];
  minutesOptions: IDropdownOption[];
  onTimeChange: (rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string) => void;
}

/**
 * Компонент для отображения ячейки времени
 */
/**
 * Интерфейс для свойств компонента TimeCell
 */
interface ITimeCellProps {
  hours: string;
  minutes: string;
  rowIndex: number;
  dayKey: string;
  isChanged: boolean;
  isDeleted?: boolean; // Добавляем флаг для определения удаленной строки
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
  isDeleted = false,
  hoursOptions,
  minutesOptions,
  onTimeChange
}) => {
  // Определяем стили для ячейки в зависимости от того, была ли она изменена и удалена
  const cellClassName = `${styles.timeCell} ${isChanged ? styles.changedCell : ''} ${isDeleted ? styles.deletedCell : ''}`;
  
  // Создаем собственные стили для выпадающих списков в зависимости от статуса удаления
  const dropdownStyles = {
    dropdown: { 
      width: 50,
      fontSize: '12px',
      // Добавляем стили для удаленных ячеек
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      padding: '0 8px',
      // Добавляем стили для удаленных ячеек
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
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
    },
    // Добавляем стили для стрелки выпадающего списка
    caretDown: {
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  };
  
  return (
    <div className={cellClassName}>
      <Dropdown
        options={hoursOptions}
        selectedKey={hours}
        onChange={(e, option) => {
          if (!isDeleted && option) {
            onTimeChange(rowIndex, dayKey, 'hours', option.key as string || '00');
          }
        }}
        disabled={isDeleted} // Блокируем выпадающий список для удаленных строк
        styles={dropdownStyles}
        ariaLabel={`Hours for ${dayKey}`}
      />
      <span className={`${styles.timeSeparator} ${isDeleted ? styles.deletedText : ''}`}>:</span>
      <Dropdown
        options={minutesOptions}
        selectedKey={minutes}
        onChange={(e, option) => {
          if (!isDeleted && option) {
            onTimeChange(rowIndex, dayKey, 'minutes', option.key as string || '00');
          }
        }}
        disabled={isDeleted} // Блокируем выпадающий список для удаленных строк
        styles={dropdownStyles}
        ariaLabel={`Minutes for ${dayKey}`}
      />
      
      {/* Дополнительный индикатор для удаленных строк (опционально) */}
      {isDeleted && (
        <div 
          
          title="This item is deleted. Restore it to make changes."
          
        />
      )}
    </div>
  );
};


interface ILunchCellProps {
  lunch: string;
  rowIndex: number;
  isChanged: boolean;
  isDeleted?: boolean; // Добавляем флаг удаления
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
  isDeleted = false, // Добавляем по умолчанию
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
  isDeleted?: boolean; // Добавляем флаг для определения удаленной строки
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
  isDeleted?: boolean; // Добавляем флаг для определения удаленной строки
  renderAddShiftButton: (rowIndex?: number) => JSX.Element;
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