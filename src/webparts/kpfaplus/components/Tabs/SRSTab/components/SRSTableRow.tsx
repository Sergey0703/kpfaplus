// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback } from 'react';
import { Checkbox, Dropdown, DefaultButton, IDropdownOption, TooltipHost, Text } from '@fluentui/react';
import { ISRSTableRowProps, ISRSRecord } from '../utils/SRSTabInterfaces';

export const SRSTableRow: React.FC<ISRSTableRowProps & {
  rowPositionInDate: number;
  totalTimeForDate: string; 
  totalRowsInDate: number;
  displayWorkTime: string;
  isTimesEqual: boolean;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
}> = (props) => {
  const {
    item,
    options,
    isEven,
    rowPositionInDate,
    totalTimeForDate,
    totalRowsInDate,
    displayWorkTime,
    isTimesEqual,
    onItemChange
  } = props;

  // Styles for cells in Schedule table style
  const cellStyle: React.CSSProperties = {
    border: '1px solid #edebe9', // Soft border like in Schedule
    padding: '8px', // Increased padding like in Schedule
    textAlign: 'center',
    fontSize: '12px',
    verticalAlign: 'middle'
  };

  // Row style with alternating colors like in Schedule, plus error highlighting
  const rowStyle: React.CSSProperties = {
    backgroundColor: item.deleted ? '#f5f5f5' : (isTimesEqual ? '#ffeded' : (isEven ? '#ffffff' : '#f9f9f9')),
    opacity: item.deleted ? 0.6 : 1,
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Get day of week like in Schedule
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.date.getDay()];

  // Render date cell content based on row position within date group
  const renderDateCell = (): JSX.Element => {
    // If this is the first row of the date, display date and day of week
    if (rowPositionInDate === 0) {
      return (
        <>
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
            {item.deleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none' }}>(Deleted)</span>}
          </div>
        </>
      );
    }
    // If this is the second row of the date and there are multiple rows, display total hours in blue
    else if (rowPositionInDate === 1 && totalRowsInDate > 1) {
      return (
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '12px', 
          color: '#0078d4', // Blue color like in Schedule
          textAlign: 'center',
          marginTop: '8px',
          ...(item.deleted && { color: '#88a0bd', textDecoration: 'line-through' }) // Lighter blue for deleted
        }}>
          {totalTimeForDate}
          {item.deleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none', fontSize: '10px' }}>(Deleted)</span>}
        </div>
      );
    }
    // For third and subsequent rows of the date, leave cell empty or show minimal info
    else {
      return (
        <div>
          {item.deleted && <span style={{ color: '#d83b01', fontSize: '10px', textDecoration: 'none' }}>(Deleted)</span>}
        </div>
      );
    }
  };

  // Event handlers
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

  // Dropdown styles in Schedule style with error highlighting
  const getDropdownStyles = (isError = false): object => ({
    root: { 
      width: 60, 
      margin: '0 2px',
      borderColor: isError ? '#a4262c' : undefined,
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
      width: 140,
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
      {/* Date cell with special rendering based on position */}
      <td style={{ ...cellStyle, textAlign: 'left' }}>
        {renderDateCell()}
      </td>

      {/* Hours cell with calculated time and error highlighting */}
      <td style={{ 
        ...cellStyle, 
        fontWeight: 'bold',
        color: isTimesEqual ? '#a4262c' : (displayWorkTime === '0.00' ? '#666' : 'inherit'),
        ...(item.deleted && { color: '#888', textDecoration: 'line-through' })
      }}>
        {isTimesEqual ? (
          <TooltipHost content="Start and end times are the same. Please adjust the times.">
            <Text style={{ color: '#a4262c', fontWeight: 'bold' }}>
              {displayWorkTime}
            </Text>
          </TooltipHost>
        ) : (
          <span>{displayWorkTime}</span>
        )}
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

      {/* Relief cell */}
      <td style={cellStyle}>
        <Checkbox
          checked={item.relief}
          onChange={handleReliefChange}
          disabled={item.deleted}
        />
      </td>

      {/* Start Work cell */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={item.startWork.hours}
            options={options.hours}
            onChange={handleStartHourChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>:</span>
          <Dropdown
            selectedKey={item.startWork.minutes}
            options={options.minutes}
            onChange={handleStartMinuteChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
        </div>
      </td>

      {/* Finish Work cell */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={item.finishWork.hours}
            options={options.hours}
            onChange={handleFinishHourChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>:</span>
          <Dropdown
            selectedKey={item.finishWork.minutes}
            options={options.minutes}
            onChange={handleFinishMinuteChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
        </div>
      </td>

      {/* Lunch cell */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={item.lunch}
          options={options.lunchTimes}
          onChange={handleLunchChange}
          disabled={item.deleted}
          styles={getLunchDropdownStyles()}
        />
      </td>

      {/* Type of Leave cell */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={item.typeOfLeave}
          options={options.leaveTypes}
          onChange={handleLeaveTypeChange}
          disabled={item.deleted}
          styles={getLeaveDropdownStyles()}
        />
      </td>

      {/* Time Leave cell */}
      <td style={cellStyle}>
        <input
          type="text"
          value={item.timeLeave}
          onChange={handleTimeLeaveChange}
          maxLength={4}
          disabled={item.deleted}
          style={{
            width: '70px',
            height: '28px',
            border: '1px solid #d6d6d6',
            fontSize: '12px',
            textAlign: 'center',
            borderRadius: '2px',
            backgroundColor: item.deleted ? '#f5f5f5' : 'white'
          }}
        />
      </td>

      {/* +Shift button */}
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

      {/* Contract cell */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={item.contract}
          options={options.contractNumbers}
          onChange={handleContractChange}
          disabled={item.deleted}
          styles={getContractDropdownStyles()}
        />
      </td>

      {/* Check (Status) cell */}
      <td style={cellStyle}>
        {item.status === 'positive' && <span style={{ color: 'green', fontSize: '16px' }}>👍</span>}
        {item.status === 'negative' && <span style={{ color: 'red', fontSize: '16px' }}>👎</span>}
      </td>

      {/* SRS cell */}
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