// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback } from 'react';
import { Checkbox, Dropdown, DefaultButton } from '@fluentui/react';
import { ISRSTableRowProps } from '../utils/SRSTabInterfaces';

export const SRSTableRow: React.FC<ISRSTableRowProps> = (props) => {
  const {
    item,
    options,
    isEven,
    onItemChange
    // Убираем неиспользуемый: onItemCheck
  } = props;

  // Стили для ячейки таблицы
  const cellStyle: React.CSSProperties = {
    border: '1px solid black',
    padding: '5px',
    textAlign: 'center',
    fontSize: '12px',
    verticalAlign: 'middle'
  };

  // Стиль строки с чередованием цветов
  const rowStyle: React.CSSProperties = {
    backgroundColor: item.deleted ? '#f5f5f5' : (isEven ? '#f9f9f9' : '#ffffff'),
    opacity: item.deleted ? 0.6 : 1
  };

  // Обработчики изменений
  const handleReliefChange = useCallback((ev?: React.FormEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      onItemChange(item, 'relief', checked);
    }
  }, [item, onItemChange]);

  const handleStartHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      const newStartWork = { ...item.startWork, hours: option.key };
      onItemChange(item, 'startWork', newStartWork);
    }
  }, [item, onItemChange]);

  const handleStartMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      const newStartWork = { ...item.startWork, minutes: option.key };
      onItemChange(item, 'startWork', newStartWork);
    }
  }, [item, onItemChange]);

  const handleFinishHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      const newFinishWork = { ...item.finishWork, hours: option.key };
      onItemChange(item, 'finishWork', newFinishWork);
    }
  }, [item, onItemChange]);

  const handleFinishMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      const newFinishWork = { ...item.finishWork, minutes: option.key };
      onItemChange(item, 'finishWork', newFinishWork);
    }
  }, [item, onItemChange]);

  const handleLunchChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      onItemChange(item, 'lunch', option.key);
    }
  }, [item, onItemChange]);

  const handleLeaveTypeChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      onItemChange(item, 'typeOfLeave', option.key);
    }
  }, [item, onItemChange]);

  const handleTimeLeaveChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    onItemChange(item, 'timeLeave', event.target.value);
  }, [item, onItemChange]);

  const handleContractChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: any): void => {
    if (option) {
      onItemChange(item, 'contract', option.key);
    }
  }, [item, onItemChange]);

  const handleAddShift = useCallback((): void => {
    // Пока заглушка - в будущем будет реальная логика
    console.log('[SRSTableRow] Add shift clicked for date:', item.date.toLocaleDateString());
  }, [item.date]);

  // Форматирование даты
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  return (
    <tr style={rowStyle}>
      {/* Date */}
      <td style={{ ...cellStyle, width: '100px', textAlign: 'left' }}>
        <div>{formatDate(item.date)}</div>
        <div style={{ fontSize: '10px', color: '#666' }}>{item.dayOfWeek}</div>
      </td>

      {/* Hours */}
      <td style={{ ...cellStyle, width: '60px', fontWeight: 'bold' }}>
        {item.hours}
      </td>

      {/* Relief? */}
      <td style={{ ...cellStyle, width: '60px' }}>
        <Checkbox
          checked={item.relief}
          onChange={handleReliefChange}
          disabled={item.deleted}
        />
      </td>

      {/* Start Work */}
      <td style={{ ...cellStyle, width: '150px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
          <Dropdown
            selectedKey={item.startWork.hours}
            options={options.hours}
            onChange={handleStartHourChange}
            disabled={item.deleted}
            styles={{
              root: { width: '45px' },
              dropdown: { minHeight: '24px', fontSize: '12px' }
            }}
          />
          <span style={{ fontSize: '12px' }}>:</span>
          <Dropdown
            selectedKey={item.startWork.minutes}
            options={options.minutes}
            onChange={handleStartMinuteChange}
            disabled={item.deleted}
            styles={{
              root: { width: '45px' },
              dropdown: { minHeight: '24px', fontSize: '12px' }
            }}
          />
        </div>
      </td>

      {/* Finish Work */}
      <td style={{ ...cellStyle, width: '150px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
          <Dropdown
            selectedKey={item.finishWork.hours}
            options={options.hours}
            onChange={handleFinishHourChange}
            disabled={item.deleted}
            styles={{
              root: { width: '45px' },
              dropdown: { minHeight: '24px', fontSize: '12px' }
            }}
          />
          <span style={{ fontSize: '12px' }}>:</span>
          <Dropdown
            selectedKey={item.finishWork.minutes}
            options={options.minutes}
            onChange={handleFinishMinuteChange}
            disabled={item.deleted}
            styles={{
              root: { width: '45px' },
              dropdown: { minHeight: '24px', fontSize: '12px' }
            }}
          />
        </div>
      </td>

      {/* Lunch */}
      <td style={{ ...cellStyle, width: '100px' }}>
        <Dropdown
          selectedKey={item.lunch}
          options={options.lunchTimes}
          onChange={handleLunchChange}
          disabled={item.deleted}
          styles={{
            root: { width: '60px' },
            dropdown: { minHeight: '24px', fontSize: '12px' }
          }}
        />
      </td>

      {/* Type of Leave */}
      <td style={{ ...cellStyle, width: '150px' }}>
        <Dropdown
          selectedKey={item.typeOfLeave}
          options={options.leaveTypes}
          onChange={handleLeaveTypeChange}
          disabled={item.deleted}
          styles={{
            root: { width: '140px' },
            dropdown: { minHeight: '24px', fontSize: '12px' }
          }}
        />
      </td>

      {/* Time Leave (h) */}
      <td style={{ ...cellStyle, width: '100px' }}>
        <input
          type="text"
          value={item.timeLeave}
          onChange={handleTimeLeaveChange}
          maxLength={4}
          disabled={item.deleted}
          style={{
            width: '80px',
            height: '24px',
            border: '1px solid #d6d6d6',
            fontSize: '12px',
            textAlign: 'center',
            backgroundColor: item.deleted ? '#f5f5f5' : 'white'
          }}
        />
      </td>

      {/* Shift */}
      <td style={{ ...cellStyle, width: '70px' }}>
        <DefaultButton
          text="+ Shift"
          onClick={handleAddShift}
          disabled={item.deleted}
          styles={{
            root: {
              backgroundColor: '#107c10',
              color: 'white',
              border: 'none',
              minWidth: '60px',
              height: '24px',
              fontSize: '10px'
            },
            rootHovered: {
              backgroundColor: '#0b5a0b'
            }
          }}
        />
      </td>

      {/* Contract */}
      <td style={{ ...cellStyle, width: '60px' }}>
        <Dropdown
          selectedKey={item.contract}
          options={options.contractNumbers}
          onChange={handleContractChange}
          disabled={item.deleted}
          styles={{
            root: { width: '50px' },
            dropdown: { minHeight: '24px', fontSize: '12px' }
          }}
        />
      </td>

      {/* Check */}
      <td style={{ ...cellStyle, width: '50px' }}>
        {item.status === 'positive' && <span style={{ color: 'green', fontSize: '14px' }}>👍</span>}
        {item.status === 'negative' && <span style={{ color: 'red', fontSize: '14px' }}>👎</span>}
      </td>

      {/* SRS */}
      <td style={{ ...cellStyle, width: '50px' }}>
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