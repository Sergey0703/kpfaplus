// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableRow.tsx
import * as React from 'react';
import { 
  Dropdown, 
  IconButton, 
  PrimaryButton, 
  Text, 
  TooltipHost,
  IDropdownStyles
} from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';
import { IScheduleItem, IScheduleOptions } from './ScheduleTable';
import { formatDate } from './ScheduleTableUtils';

export interface IScheduleTableRowProps {
  item: IScheduleItem;
  rowIndex: number;
  rowPositionInDate: number; // Позиция строки внутри даты (0 - первая, 1 - вторая и т.д.)
  totalTimeForDate: string; // Общее время работы за день в формате "Total: XXh:XXm"
  totalRowsInDate: number; // Общее количество строк в дате (включая удаленные)
  options: IScheduleOptions;
  displayWorkTime: string;
  isTimesEqual: boolean;
  showDeleteConfirmDialog: (id: string) => void;
  showAddShiftConfirmDialog: (item: IScheduleItem) => void; // Changed to pass the entire item
  showRestoreConfirmDialog: (id: string) => void;
  onRestoreItem?: (id: string) => Promise<boolean>; 
  onItemChange: (item: IScheduleItem, field: string, value: string) => void;
  onContractNumberChange: (item: IScheduleItem, value: string) => void;
  onLunchTimeChange: (item: IScheduleItem, value: string) => void;
}

export const ScheduleTableRow: React.FC<IScheduleTableRowProps> = (props) => {
  const { 
    item, 
    rowIndex, 
    rowPositionInDate,
    totalTimeForDate,
    totalRowsInDate,
    options, 
    displayWorkTime, 
    isTimesEqual,
    showDeleteConfirmDialog,
    showAddShiftConfirmDialog,
    showRestoreConfirmDialog,
    onRestoreItem,
    onItemChange,
    onContractNumberChange,
    onLunchTimeChange
  } = props;

  // Определяем, удалена ли запись
  const isDeleted = item.deleted === true;
  
  // Определяем, является ли день праздником
  const isHoliday = item.Holiday === 1;
  
  // Определяем цвет фона для строки и классы
  const isEvenRow = rowIndex % 2 === 0;
  let backgroundColor = isEvenRow ? '#f9f9f9' : '#ffffff';
  let rowClassName = '';
  
  // Определяем цвета для праздничных ячеек (inline-стили)
  const getHolidayCellStyle = (isFirstTwoCells: boolean = false): React.CSSProperties => {
    if (isHoliday && !isDeleted && isFirstTwoCells) {
      return {
        backgroundColor: '#ffe6f0', // Светло-розовый для праздничных дней
      };
    }
    return {};
  };
  
  if (isDeleted) {
    backgroundColor = '#f5f5f5';
    rowClassName = styles.deletedRow;
  } else if (isTimesEqual) {
    backgroundColor = '#ffeded';
  }

  // Стили для dropdown при удаленных записях
  const getDropdownStyles = (isError = false): Partial<IDropdownStyles> => ({
    root: { 
      width: 60, 
      margin: '0 4px',
      borderColor: isError ? '#a4262c' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  const getLunchDropdownStyles = (): Partial<IDropdownStyles> => ({
    root: { 
      width: 80,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  const getLeaveDropdownStyles = (): Partial<IDropdownStyles> => ({
    root: { 
      width: 150,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  const getContractDropdownStyles = (): Partial<IDropdownStyles> => ({
    root: { 
      width: 50,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  // Определяем значения по умолчанию для контрактов
  const defaultContractOptions = [
    { key: '1', text: '1' },
    { key: '2', text: '2' },
    { key: '3', text: '3' }
  ];

  // Определяем содержимое ячейки с датой в зависимости от позиции строки
  const renderDateCell = (): JSX.Element => {
    // Если это первая строка даты, отображаем дату и день недели
    if (rowPositionInDate === 0) {
      return (
        <>
          <div className={isDeleted ? styles.deletedText : ''}>
            {formatDate(item.date)}
          </div>
          <div style={{ fontWeight: 'normal', fontSize: '12px' }} className={isDeleted ? styles.deletedText : ''}>
            {item.dayOfWeek}
            {isHoliday && !isDeleted && (
              <div style={{ color: '#e81123', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
                Holiday
              </div>
            )}
            {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none' }}>(Deleted)</span>}
          </div>
        </>
      );
    }
    // Если это вторая строка даты и в дате несколько строк, отображаем общую сумму часов за день
    else if (rowPositionInDate === 1 && totalRowsInDate > 1) {
      return (
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '12px', 
          color: '#0078d4', 
          textAlign: 'center',
          marginTop: '8px',
          ...(isDeleted && { color: '#88a0bd', textDecoration: 'line-through' }) // Более светлый синий для удаленных
        }}>
          {totalTimeForDate}
          {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none', fontSize: '10px' }}>(Deleted)</span>}
        </div>
      );
    }
    // Если это третья или последующие строки даты, оставляем ячейку пустой
    else {
      return (
        <div>
          {isDeleted && <span style={{ color: '#d83b01', fontSize: '10px', textDecoration: 'none' }}>(Deleted)</span>}
          {isHoliday && !isDeleted && (
            <div style={{ color: '#e81123', fontSize: '10px', fontWeight: 'bold' }}>
              Holiday
            </div>
          )}
        </div>
      );
    }
  };

  // Обработчик клика по кнопке "+Shift" с подтверждением
  const handleAddShiftClick = (): void => {
    // Вызываем диалог подтверждения вместо прямого действия, передавая всю запись
    showAddShiftConfirmDialog(item);
  };

  return (
    <tr 
      style={{ 
        backgroundColor: backgroundColor || undefined,
        border: '1px solid #edebe9',
        marginBottom: '4px',
        borderRadius: '2px',
        ...(isDeleted && { color: '#888' })
      }}
      className={rowClassName}
    >
      {/* Ячейка с датой */}
      <td style={{ 
        padding: '8px 0 8px 8px',
        ...getHolidayCellStyle(true) // Применяем розовый фон для праздничных дней
      }}>
        {renderDateCell()}
      </td>
      
      {/* Ячейка с рабочими часами */}
      <td style={{ 
        textAlign: 'center',
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
        color: isTimesEqual ? '#a4262c' : (displayWorkTime === '0.00' ? '#666' : 'inherit'),
        ...getHolidayCellStyle(true) // Применяем розовый фон для праздничных дней
      }}
      className={isDeleted ? styles.deletedText : ''}>
        {isTimesEqual ? (
          <TooltipHost content="Start and end times are the same. Please adjust the times.">
            <Text style={{ color: '#a4262c', fontWeight: 'bold' }} className={isDeleted ? styles.deletedText : ''}>
              {displayWorkTime}
            </Text>
          </TooltipHost>
        ) : (
          <span className={isDeleted ? styles.deletedText : ''}>{displayWorkTime}</span>
        )}
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
      </td>
      
      {/* Ячейка с началом работы */}
      <td style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Dropdown
            selectedKey={item.startHour}
            options={options.hours}
            onChange={(_, option): void => option && onItemChange(item, 'startHour', option.key as string)}
            styles={getDropdownStyles(isTimesEqual)}
            disabled={isDeleted}
          />
          <Dropdown
            selectedKey={item.startMinute}
            options={options.minutes}
            onChange={(_, option): void => option && onItemChange(item, 'startMinute', option.key as string)}
            styles={getDropdownStyles(isTimesEqual)}
            disabled={isDeleted}
          />
        </div>
      </td>
      
      {/* Ячейка с окончанием работы */}
      <td style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Dropdown
            selectedKey={item.finishHour}
            options={options.hours}
            onChange={(_, option): void => option && onItemChange(item, 'finishHour', option.key as string)}
            styles={getDropdownStyles(isTimesEqual)}
            disabled={isDeleted}
          />
          <Dropdown
            selectedKey={item.finishMinute}
            options={options.minutes}
            onChange={(_, option): void => option && onItemChange(item, 'finishMinute', option.key as string)}
            styles={getDropdownStyles(isTimesEqual)}
            disabled={isDeleted}
          />
        </div>
      </td>
      
      {/* Ячейка с временем обеда */}
      <td style={{ textAlign: 'center' }}>
        <Dropdown
          selectedKey={item.lunchTime}
          options={options.lunchTimes}
          onChange={(_, option): void => option && onLunchTimeChange(item, option.key as string)}
          styles={getLunchDropdownStyles()}
          disabled={isDeleted}
        />
      </td>
      
      {/* Ячейка с типом отпуска */}
      <td style={{ textAlign: 'center' }}>
        <Dropdown
          selectedKey={item.typeOfLeave ? String(item.typeOfLeave) : ''}
          options={options.leaveTypes}
          onChange={(_, option): void => option && onItemChange(item, 'typeOfLeave', option.key as string)}
          styles={getLeaveDropdownStyles()}
          disabled={isDeleted}
        />
      </td>
      
      {/* Кнопка +Shift */}
      <td style={{ textAlign: 'center', padding: '0' }}>
        <PrimaryButton
          text="+Shift"
          styles={{ 
            root: { 
              minWidth: 60, 
              padding: '0 4px', 
              backgroundColor: '#107c10',
              ...(isDeleted && {
                backgroundColor: '#f5f5f5',
                color: '#888',
                borderColor: '#ddd'
              })
            } 
          }}
          onClick={handleAddShiftClick} // Используем новый обработчик с подтверждением
          disabled={isDeleted}
        />
      </td>
      
      {/* Ячейка с номером контракта */}
      <td>
        <Dropdown
          selectedKey={item.contractNumber || '1'}
          options={options.contractNumbers || defaultContractOptions}
          onChange={(_, option): void => option && onContractNumberChange(item, option.key as string)}
          styles={getContractDropdownStyles()}
          disabled={isDeleted}
        />
      </td>
      
      {/* Иконка удаления или восстановления в зависимости от статуса */}
      <td style={{ textAlign: 'center', padding: '0' }}>
        {isDeleted ? (
          // Кнопка восстановления для удаленных записей
          <IconButton
            iconProps={{ iconName: 'Refresh' }}
            title="Restore"
            ariaLabel="Restore"
            onClick={(): void => {
              if (onRestoreItem) {
                showRestoreConfirmDialog(item.id);
              } else {
                console.error('Restore handler is not available');
              }
            }}
            styles={{
              root: { color: '#107c10' }, // Зеленый цвет для восстановления
              rootHovered: { color: '#0b5a0b' }
            }}
            disabled={!onRestoreItem}
          />
        ) : (
          // Кнопка удаления для активных записей
          <IconButton
            iconProps={{ iconName: 'Delete' }}
            title="Delete"
            ariaLabel="Delete"
            onClick={(): void => showDeleteConfirmDialog(item.id)}
            styles={{ 
              root: { color: '#e81123' },
              rootHovered: { color: '#a80000' }
            }}
          />
        )}
      </td>
      
      {/* Текстовое поле для ID */}
      <td style={{ 
        textAlign: 'center', 
        fontSize: '12px', 
        color: isDeleted ? '#888' : '#666'
      }}>
        {item.id}
      </td>
    </tr>
  );
};