// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback } from 'react';
import { Checkbox, Dropdown, DefaultButton, IDropdownOption } from '@fluentui/react';
import { ISRSTableRowProps } from '../utils/SRSTabInterfaces';

export const SRSTableRow: React.FC<ISRSTableRowProps> = (props) => {
  const {
    item,
    options,
    isEven,
    onItemChange
  } = props;

  // ИЗМЕНЕНО: Стили ячеек в стиле Schedule таблицы
  const cellStyle: React.CSSProperties = {
    border: '1px solid #edebe9', // Мягкая граница как в Schedule
    padding: '8px', // Увеличенный padding как в Schedule
    textAlign: 'center',
    fontSize: '12px',
    verticalAlign: 'middle'
  };

  // ИЗМЕНЕНО: Стиль строки с чередованием цветов как в Schedule
  const rowStyle: React.CSSProperties = {
    backgroundColor: item.deleted ? '#f5f5f5' : (isEven ? '#ffffff' : '#f9f9f9'),
    opacity: item.deleted ? 0.6 : 1,
  };

  // Обработчики изменений
  const handleReliefChange = useCallback((ev?: React.FormEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      onItemChange(item, 'relief', checked);
    }
  }, [item, onItemChange]);

  const handleStartHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      const newStartWork = { ...item.startWork, hours: option.key as string };
      onItemChange(item, 'startWork', newStartWork);
    }
  }, [item, onItemChange]);

  const handleStartMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      const newStartWork = { ...item.startWork, minutes: option.key as string };
      onItemChange(item, 'startWork', newStartWork);
    }
  }, [item, onItemChange]);

  const handleFinishHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      const newFinishWork = { ...item.finishWork, hours: option.key as string };
      onItemChange(item, 'finishWork', newFinishWork);
    }
  }, [item, onItemChange]);

  const handleFinishMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      const newFinishWork = { ...item.finishWork, minutes: option.key as string };
      onItemChange(item, 'finishWork', newFinishWork);
    }
  }, [item, onItemChange]);

  const handleLunchChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      onItemChange(item, 'lunch', option.key as string);
    }
  }, [item, onItemChange]);

  const handleLeaveTypeChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      onItemChange(item, 'typeOfLeave', option.key as string);
    }
  }, [item, onItemChange]);

  const handleTimeLeaveChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    onItemChange(item, 'timeLeave', event.target.value);
  }, [item, onItemChange]);

  const handleContractChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      onItemChange(item, 'contract', option.key as string);
    }
  }, [item, onItemChange]);

  const handleAddShift = useCallback((): void => {
    console.log('[SRSTableRow] Add shift clicked for date:', item.date.toLocaleDateString());
  }, [item.date]);

  // Форматирование даты
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // ДОБАВЛЕНО: Определяем день недели как в Schedule
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.date.getDay()];

  // ИЗМЕНЕНО: Стили для dropdown в стиле Schedule
  const getDropdownStyles = (): object => ({
    root: { 
      width: 60, 
      margin: '0 2px',
      ...(item.deleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      ...(item.deleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      ...(item.deleted && {
        color: '#aaa'
      })
    }
  });

  const getLunchDropdownStyles = (): object => ({
    root: { 
      width: 80,
      ...(item.deleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      ...(item.deleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  const getLeaveDropdownStyles = (): object => ({
    root: { 
      width: 140, // Уменьшили ширину
      ...(item.deleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      ...(item.deleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  const getContractDropdownStyles = (): object => ({
    root: { 
      width: 50,
      ...(item.deleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      ...(item.deleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  return (
    <tr style={rowStyle}>
      {/* ИЗМЕНЕНО: Ячейка с датой в стиле Schedule */}
      <td style={{ ...cellStyle, textAlign: 'left' }}>
        <div style={{ 
          fontWeight: '600',
          fontSize: '12px',
          ...(item.deleted && { color: '#888', textDecoration: 'line-through' })
        }}>
          {formatDate(item.date)}
        </div>
        <div style={{ 
          fontSize: '11px', 
          color: '#666',
          marginTop: '2px',
          ...(item.deleted && { color: '#aaa', textDecoration: 'line-through' })
        }}>
          {dayOfWeek}
        </div>
      </td>

      {/* Ячейка с рабочими часами */}
      <td style={{ 
        ...cellStyle, 
        fontWeight: 'bold',
        color: item.hours === '0.00' ? '#666' : 'inherit',
        ...(item.deleted && { color: '#888', textDecoration: 'line-through' })
      }}>
        {item.hours}
        {item.deleted && (
          <div style={{ 
            fontSize: '10px', 
            color: '#d83b01', 
            marginTop: '2px',
            textDecoration: 'none' 
          }}>
            (deleted)
          </div>
        )}
      </td>

      {/* Ячейка Relief */}
      <td style={cellStyle}>
        <Checkbox
          checked={item.relief}
          onChange={handleReliefChange}
          disabled={item.deleted}
        />
      </td>

      {/* ИЗМЕНЕНО: Ячейки времени в стиле Schedule */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={item.startWork.hours}
            options={options.hours}
            onChange={handleStartHourChange}
            disabled={item.deleted}
            styles={getDropdownStyles()}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>:</span>
          <Dropdown
            selectedKey={item.startWork.minutes}
            options={options.minutes}
            onChange={handleStartMinuteChange}
            disabled={item.deleted}
            styles={getDropdownStyles()}
          />
        </div>
      </td>

      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={item.finishWork.hours}
            options={options.hours}
            onChange={handleFinishHourChange}
            disabled={item.deleted}
            styles={getDropdownStyles()}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>:</span>
          <Dropdown
            selectedKey={item.finishWork.minutes}
            options={options.minutes}
            onChange={handleFinishMinuteChange}
            disabled={item.deleted}
            styles={getDropdownStyles()}
          />
        </div>
      </td>

      {/* Ячейка Lunch */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={item.lunch}
          options={options.lunchTimes}
          onChange={handleLunchChange}
          disabled={item.deleted}
          styles={getLunchDropdownStyles()}
        />
      </td>

      {/* Ячейка Type of Leave */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={item.typeOfLeave}
          options={options.leaveTypes}
          onChange={handleLeaveTypeChange}
          disabled={item.deleted}
          styles={getLeaveDropdownStyles()}
        />
      </td>

      {/* Ячейка Time Leave */}
      <td style={cellStyle}>
        <input
          type="text"
          value={item.timeLeave}
          onChange={handleTimeLeaveChange}
          maxLength={4}
          disabled={item.deleted}
          style={{
            width: '70px',
            height: '28px', // Увеличена высота как в Schedule
            border: '1px solid #d6d6d6',
            fontSize: '12px',
            textAlign: 'center',
            borderRadius: '2px', // Добавлен радиус
            backgroundColor: item.deleted ? '#f5f5f5' : 'white'
          }}
        />
      </td>

      {/* ИЗМЕНЕНО: Кнопка +Shift в стиле Schedule */}
      <td style={cellStyle}>
        <DefaultButton
          text="+Shift"
          onClick={handleAddShift}
          disabled={item.deleted}
          styles={{ 
            root: { 
              backgroundColor: '#107c10',
              color: 'white',
              border: 'none',
              minWidth: '60px',
              height: '28px',
              fontSize: '11px',
              borderRadius: '2px',
              ...(item.deleted && {
                backgroundColor: '#f5f5f5',
                color: '#888',
                borderColor: '#ddd'
              })
            },
            rootHovered: !item.deleted ? {
              backgroundColor: '#0b5a0b'
            } : undefined
          }}
        />
      </td>

      {/* Ячейка Contract */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={item.contract}
          options={options.contractNumbers}
          onChange={handleContractChange}
          disabled={item.deleted}
          styles={getContractDropdownStyles()}
        />
      </td>

      {/* Ячейка Check (Status) */}
      <td style={cellStyle}>
        {item.status === 'positive' && <span style={{ color: 'green', fontSize: '16px' }}>👍</span>}
        {item.status === 'negative' && <span style={{ color: 'red', fontSize: '16px' }}>👎</span>}
      </td>

      {/* Ячейка SRS */}
      <td style={cellStyle}>
        {item.srs && (
          <span style={{
            color: '#0078d4',
            fontWeight: '600',
            fontSize: '12px'
          }}>
            SRS
          </span>
        )}
      </td>
    </tr>
  );
};