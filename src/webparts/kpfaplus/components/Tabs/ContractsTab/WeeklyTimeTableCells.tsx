// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableCells.tsx
import * as React from 'react';
import {
  Dropdown,
  IDropdownOption
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { IExtendedWeeklyTimeRow } from './WeeklyTimeTableLogic';
//import { IDayHoursComplete } from '../../../models/IWeeklyTimeTable';

/**
 * Интерфейс для свойств компонента TimeCell
 */
interface ITimeCellProps {
  hours: string;
  minutes: string;
  rowIndex: number;
  dayKey: string;
  isChanged: boolean;
  isDeleted?: boolean; // Флаг для определения удаленной строки
  hoursOptions: IDropdownOption[];
  minutesOptions: IDropdownOption[];
  onTimeChange: (rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string) => void;
}

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
  
  // Инлайн-стиль для контейнера ячейки времени
  const cellContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    padding: '2px',
    height: '30px'
  };
  
  // Создаем компактные стили для выпадающих списков
  const dropdownStyles = {
    dropdown: { 
      width: 40,
      minWidth: 40,
      maxWidth: 40,
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
      padding: '0 2px',
      height: '24px',
      lineHeight: '24px',
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
      minHeight: '24px',
      padding: '2px 8px'
    },
    dropdownItemSelected: {
      fontSize: '12px',
      minHeight: '24px'
    },
    caretDown: {
      fontSize: '8px',
      padding: '0 2px',
      right: '2px',
      ...(isDeleted && {
        color: '#aaa'
      })
    },
    callout: {
      minWidth: '80px',
      maxWidth: '90px'
    }
  };
  
  // Инлайн-стиль для контейнера Dropdown
  const dropdownContainerStyle: React.CSSProperties = {
    display: 'inline-block',
    margin: '0 1px',
    width: '40px',
    minWidth: '40px',
    maxWidth: '40px'
  };
  
  // Инлайн-стиль для разделителя
  const separatorStyle: React.CSSProperties = {
    margin: '0 1px',
    fontWeight: 'bold',
    fontSize: '12px',
    display: 'inline-block',
    verticalAlign: 'middle',
    ...(isDeleted && {
      color: '#888',
      textDecoration: 'line-through'
    })
  };
  
  return (
    <div className={cellClassName} style={cellContainerStyle}>
      <div style={dropdownContainerStyle}>
        <Dropdown
          options={hoursOptions}
          selectedKey={hours}
          onChange={(e, option) => {
            if (!isDeleted && option) {
              onTimeChange(rowIndex, dayKey, 'hours', option.key as string || '00');
            }
          }}
          disabled={isDeleted}
          styles={dropdownStyles}
          ariaLabel={`Hours for ${dayKey}`}
          dropdownWidth={40}
        />
      </div>
      <span style={separatorStyle}>:</span>
      <div style={dropdownContainerStyle}>
        <Dropdown
          options={minutesOptions}
          selectedKey={minutes}
          onChange={(e, option) => {
            if (!isDeleted && option) {
              onTimeChange(rowIndex, dayKey, 'minutes', option.key as string || '00');
            }
          }}
          disabled={isDeleted}
          styles={dropdownStyles}
          ariaLabel={`Minutes for ${dayKey}`}
          dropdownWidth={40}
        />
      </div>
    </div>
  );
};

/**
 * Интерфейс для свойств компонента LunchCell
 */
interface ILunchCellProps {
  lunch: string;
  rowIndex: number;
  isChanged: boolean;
  isDeleted?: boolean; // Флаг для определения удаленной строки
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
  isDeleted = false,
  lunchOptions,
  onLunchChange
}) => {
  // Компактные стили для dropdown
  const dropdownStyles = {
    dropdown: { 
      width: 50,
      minWidth: 45,
      fontSize: '12px',
      ...(isChanged && {
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        border: '1px solid #ffcc00'
      }),
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      padding: '0 4px', // Уменьшаем внутренние отступы
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
      minHeight: '24px',
      padding: '2px 8px' // Уменьшаем padding в выпадающем списке
    },
    dropdownItemSelected: {
      fontSize: '12px',
      minHeight: '24px'
    },
    caretDown: {
      fontSize: '8px', // Уменьшаем размер стрелки
      padding: '0 2px', // Уменьшаем отступы вокруг стрелки
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  };
  
  return (
    <Dropdown
      options={lunchOptions}
      selectedKey={lunch}
      onChange={(e, option) => {
        if (!isDeleted && option) {
          onLunchChange(rowIndex, option?.key as string || '0');
        }
      }}
      disabled={isDeleted}
      styles={dropdownStyles}
      dropdownWidth={50}
    />
  );
};

/**
 * Интерфейс для свойств компонента ContractCell
 */
interface IContractCellProps {
  contractNumber: string;
  rowIndex: number;
  isChanged: boolean;
  isDeleted?: boolean; // Флаг для определения удаленной строки
  onContractChange: (rowIndex: number, value: string) => void;
}

/**
 * Компонент для отображения ячейки с номером контракта
 */
export const ContractCell: React.FC<IContractCellProps> = ({
  contractNumber,
  rowIndex,
  isChanged,
  isDeleted = false,
  onContractChange
}) => {
  // Компактные стили для dropdown
  const dropdownStyles = {
    dropdown: { 
      width: 40,
      minWidth: 35,
      fontSize: '12px',
      ...(isChanged && {
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        border: '1px solid #ffcc00'
      }),
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      padding: '0 4px', // Уменьшаем внутренние отступы
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
      minHeight: '24px',
      padding: '2px 8px' // Уменьшаем padding в выпадающем списке
    },
    dropdownItemSelected: {
      fontSize: '12px',
      minHeight: '24px'
    },
    caretDown: {
      fontSize: '8px', // Уменьшаем размер стрелки
      padding: '0 2px', // Уменьшаем отступы вокруг стрелки
      ...(isDeleted && {
        color: '#aaa'
      })
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
      onChange={(e, option) => {
        if (!isDeleted && option) {
          onContractChange(rowIndex, option?.key as string || '1');
        }
      }}
      disabled={isDeleted}
      styles={dropdownStyles}
      dropdownWidth={40}
    />
  );
};

/**
 * Интерфейс для свойств компонента TotalHoursCell
 */
interface ITotalHoursCellProps {
  timeTableData: IExtendedWeeklyTimeRow[];
  rowIndex: number;
  isFirstRowInTemplate: boolean;
  isLastRowInTemplate: boolean;
  isDeleted?: boolean; // Флаг для определения удаленной строки
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
  isDeleted = false,
  renderAddShiftButton
}) => {
  const row = timeTableData[rowIndex];
  
  return (
    <div className={styles.totalHoursContainer}>
      {isFirstRowInTemplate && (
        <div className={`${styles.totalHoursValue} ${isDeleted ? styles.deletedText : ''}`}>
          {row.displayedTotalHours || row.totalHours || '0ч:00м'}
          
          {/* Для удаленных строк добавляем пояснение, что время не учитывается */}
          {isDeleted && (
            <div style={{ 
              fontSize: '10px', 
              color: '#d83b01', 
              marginTop: '2px',
              textDecoration: 'none' 
            }}>
              (not counted)
            </div>
          )}
        </div>
      )}
      
      {(isFirstRowInTemplate && isLastRowInTemplate) || (!isFirstRowInTemplate && isLastRowInTemplate) ? (
        <div className={isFirstRowInTemplate ? styles.addShiftButtonWrapper : styles.addShiftButtonContainer}>
          {/* Показываем кнопку добавления смены только для не удаленных строк */}
          {!isDeleted && renderAddShiftButton(rowIndex)}
        </div>
      ) : null}
    </div>
  );
};