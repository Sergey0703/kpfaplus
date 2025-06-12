// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { Checkbox, Dropdown, DefaultButton, IDropdownOption, TooltipHost, Text } from '@fluentui/react';
import { ISRSTableRowProps, ISRSRecord } from '../utils/SRSTabInterfaces';
import { calculateSRSWorkTime } from '../utils/SRSTimeCalculationUtils';

export const SRSTableRow: React.FC<ISRSTableRowProps & {
  rowPositionInDate: number;
  totalTimeForDate: string; 
  totalRowsInDate: number;
  displayWorkTime: string;
  isTimesEqual: boolean;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  // *** НОВОЕ: Обработчик типов отпусков ***
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
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
    onItemChange,
    // *** НОВОЕ: Извлекаем обработчик типов отпусков ***
    onTypeOfLeaveChange
  } = props;

  // Extract handlers directly from props to avoid unused variable errors
  const lunchTimeChangeHandler = props.onLunchTimeChange;
  const contractNumberChangeHandler = props.onContractNumberChange;

  // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: Локальное состояние для актуальных значений ***
  const [localStartWork, setLocalStartWork] = useState(item.startWork);
  const [localFinishWork, setLocalFinishWork] = useState(item.finishWork);
  const [localLunch, setLocalLunch] = useState(item.lunch);
  const [localContract, setLocalContract] = useState(item.contract);
  // *** НОВОЕ: Локальное состояние для типа отпуска ***
  const [localTypeOfLeave, setLocalTypeOfLeave] = useState(item.typeOfLeave);

  // Синхронизируем локальное состояние с props при изменении item
  useEffect(() => {
    console.log('[SRSTableRow] Syncing local state with item (including type of leave):', {
      itemId: item.id,
      startWork: item.startWork,
      finishWork: item.finishWork,
      lunch: item.lunch,
      contract: item.contract,
      typeOfLeave: item.typeOfLeave // *** НОВОЕ ***
    });
    
    setLocalStartWork(item.startWork);
    setLocalFinishWork(item.finishWork);
    setLocalLunch(item.lunch);
    setLocalContract(item.contract);
    // *** НОВОЕ: Синхронизация типа отпуска ***
    setLocalTypeOfLeave(item.typeOfLeave);
  }, [item.id, item.startWork, item.finishWork, item.lunch, item.contract, item.typeOfLeave]);

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

  // *** ИСПРАВЛЕННЫЕ ОБРАБОТЧИКИ СОБЫТИЙ ДЛЯ ВРЕМЕНИ ***
  const handleReliefChange = useCallback((ev?: React.FormEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      onItemChange(item, 'relief', checked);
    }
  }, [item, onItemChange]);

  const handleStartHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Start hour changing from', localStartWork.hours, 'to', option.key);
      const newStartWork = { ...localStartWork, hours: option.key as string };
      setLocalStartWork(newStartWork); // Обновляем локальное состояние немедленно
      onItemChange(item, 'startWork', newStartWork); // Вызываем handleTimeChange из SRSTable
    }
  }, [item, onItemChange, localStartWork]);

  const handleStartMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Start minute changing from', localStartWork.minutes, 'to', option.key);
      const newStartWork = { ...localStartWork, minutes: option.key as string };
      setLocalStartWork(newStartWork); // Обновляем локальное состояние немедленно
      onItemChange(item, 'startWork', newStartWork); // Вызываем handleTimeChange из SRSTable
    }
  }, [item, onItemChange, localStartWork]);

  const handleFinishHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Finish hour changing from', localFinishWork.hours, 'to', option.key);
      const newFinishWork = { ...localFinishWork, hours: option.key as string };
      setLocalFinishWork(newFinishWork); // Обновляем локальное состояние немедленно
      onItemChange(item, 'finishWork', newFinishWork); // Вызываем handleTimeChange из SRSTable
    }
  }, [item, onItemChange, localFinishWork]);

  const handleFinishMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Finish minute changing from', localFinishWork.minutes, 'to', option.key);
      const newFinishWork = { ...localFinishWork, minutes: option.key as string };
      setLocalFinishWork(newFinishWork); // Обновляем локальное состояние немедленно
      onItemChange(item, 'finishWork', newFinishWork); // Вызываем handleTimeChange из SRSTable
    }
  }, [item, onItemChange, localFinishWork]);

  // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: handleLunchChange использует актуальные локальные значения времени ***
  const handleLunchChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] *** LUNCH CHANGE WITH CURRENT LOCAL VALUES ***');
      console.log('[SRSTableRow] Lunch time changing from', localLunch, 'to', option.key);
      console.log('[SRSTableRow] Current local start work:', localStartWork);
      console.log('[SRSTableRow] Current local finish work:', localFinishWork);
      
      // *** ИСПРАВЛЕНО: Создаем updatedItem с АКТУАЛЬНЫМИ локальными значениями времени ***
      const updatedItemWithCurrentTimes: ISRSRecord = {
        ...item,
        startWork: localStartWork,    // *** ИСПОЛЬЗУЕМ АКТУАЛЬНЫЕ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ ***
        finishWork: localFinishWork,  // *** ИСПОЛЬЗУЕМ АКТУАЛЬНЫЕ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ ***
        lunch: option.key as string   // *** НОВОЕ ЗНАЧЕНИЕ ВРЕМЕНИ ОБЕДА ***
      };
      
      console.log('[SRSTableRow] Updated item for lunch calculation:', {
        startWork: updatedItemWithCurrentTimes.startWork,
        finishWork: updatedItemWithCurrentTimes.finishWork,
        lunch: updatedItemWithCurrentTimes.lunch
      });
      
      // Пересчитываем время работы с актуальными значениями
      const recalculatedWorkTime = calculateSRSWorkTime(updatedItemWithCurrentTimes);
      
      console.log('[SRSTableRow] *** RECALCULATED WORK TIME WITH CURRENT VALUES ***:', {
        oldWorkTime: displayWorkTime,
        newWorkTime: recalculatedWorkTime,
        startTime: `${localStartWork.hours}:${localStartWork.minutes}`,
        finishTime: `${localFinishWork.hours}:${localFinishWork.minutes}`,
        lunchMinutes: option.key
      });
      
      // Обновляем локальное состояние немедленно
      setLocalLunch(option.key as string);
      
      // Вызываем родительский обработчик с пересчитанным временем
      lunchTimeChangeHandler(updatedItemWithCurrentTimes, option.key as string);
    }
  }, [item, lunchTimeChangeHandler, localLunch, localStartWork, localFinishWork, displayWorkTime]);

  // *** НОВЫЙ ОБРАБОТЧИК: Изменение типа отпуска ***
  const handleTypeOfLeaveChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] *** TYPE OF LEAVE CHANGE ***');
      console.log('[SRSTableRow] Type of leave changing from', localTypeOfLeave, 'to', option.key);
      
      // Находим информацию о выбранном типе отпуска
      const selectedType = options.leaveTypes.find(leaveType => leaveType.key === option.key);
      if (selectedType) {
        console.log('[SRSTableRow] Selected type details:', {
          key: selectedType.key,
          text: selectedType.text,
          data: selectedType.data
        });
      }
      
      // Обновляем локальное состояние немедленно
      setLocalTypeOfLeave(option.key as string);
      
      // *** ВАЖНО: Типы отпусков НЕ влияют на время работы ***
      console.log('[SRSTableRow] Type of leave change does NOT affect work time calculation');
      
      // Вызываем специальный обработчик для типов отпусков
      if (onTypeOfLeaveChange) {
        console.log('[SRSTableRow] Calling onTypeOfLeaveChange handler');
        onTypeOfLeaveChange(item, option.key as string);
      } else {
        console.log('[SRSTableRow] No onTypeOfLeaveChange handler, using fallback');
        onItemChange(item, 'typeOfLeave', option.key as string);
      }
      
      console.log('[SRSTableRow] *** TYPE OF LEAVE CHANGE COMPLETE ***');
    }
  }, [item, localTypeOfLeave, options.leaveTypes, onTypeOfLeaveChange, onItemChange]);

  const handleContractChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Contract changing from', localContract, 'to', option.key);
      setLocalContract(option.key as string); // Обновляем локальное состояние немедленно
      contractNumberChangeHandler(item, option.key as string);
    }
  }, [item, contractNumberChangeHandler, localContract]);

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

  // *** НОВЫЕ СТИЛИ: Для dropdown типов отпусков ***
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

  // Log current display values for debugging
  console.log('[SRSTableRow] Rendering row for item', item.id, 'with display values:', {
    displayWorkTime,
    localStartWork,
    localFinishWork,
    localLunch,
    localContract,
    localTypeOfLeave, // *** НОВОЕ ***
    isTimesEqual
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

      {/* Start Work cell - ИСПОЛЬЗУЕМ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={localStartWork.hours}
            options={options.hours}
            onChange={handleStartHourChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>:</span>
          <Dropdown
            selectedKey={localStartWork.minutes}
            options={options.minutes}
            onChange={handleStartMinuteChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
        </div>
      </td>

      {/* Finish Work cell - ИСПОЛЬЗУЕМ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={localFinishWork.hours}
            options={options.hours}
            onChange={handleFinishHourChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
          <span style={{ fontSize: '12px', color: '#666' }}>:</span>
          <Dropdown
            selectedKey={localFinishWork.minutes}
            options={options.minutes}
            onChange={handleFinishMinuteChange}
            disabled={item.deleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
        </div>
      </td>

      {/* Lunch cell - ИСПОЛЬЗУЕМ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ И ИСПРАВЛЕННЫЙ ОБРАБОТЧИК */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={localLunch}
          options={options.lunchTimes}
          onChange={handleLunchChange}
          disabled={item.deleted}
          styles={getLunchDropdownStyles()}
        />
      </td>

      {/* *** НОВАЯ ЯЧЕЙКА: Type of Leave - ИСПОЛЬЗУЕМ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ *** */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={localTypeOfLeave}
          options={options.leaveTypes}
          onChange={handleTypeOfLeaveChange}
          disabled={item.deleted}
          styles={getLeaveDropdownStyles()}
          placeholder="Select type..."
        />
      </td>

      {/* Time Leave cell */}
      <td style={cellStyle}>
        <input
          type="text"
          value={item.timeLeave}
          onChange={(e) => onItemChange(item, 'timeLeave', e.target.value)}
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

      {/* Contract cell - ИСПОЛЬЗУЕМ ЛОКАЛЬНЫЕ ЗНАЧЕНИЯ */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={localContract}
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