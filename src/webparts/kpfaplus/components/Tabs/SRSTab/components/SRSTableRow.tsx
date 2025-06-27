// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { Checkbox, Dropdown, DefaultButton, IconButton, IDropdownOption, TooltipHost, Text } from '@fluentui/react';
import { ISRSTableRowProps, ISRSRecord } from '../utils/SRSTabInterfaces';
import { calculateSRSWorkTime } from '../utils/SRSTimeCalculationUtils';

// *** ОБНОВЛЕНО: Интерфейс данных для новой смены с числовыми полями времени ***
export interface INewSRSShiftData {
  date: Date;
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  Holiday?: number;
  // *** НОВОЕ: Числовые поля времени для создания смены ***
  ShiftDate1Hours?: number;
  ShiftDate1Minutes?: number;
  ShiftDate2Hours?: number;
  ShiftDate2Minutes?: number;
}

export const SRSTableRow: React.FC<ISRSTableRowProps & {
  rowPositionInDate: number;
  totalTimeForDate: string; 
  totalRowsInDate: number;
  displayWorkTime: string;
  isTimesEqual: boolean;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
  showDeleteConfirmDialog?: (id: string) => void;
  showRestoreConfirmDialog?: (id: string) => void;
  onDeleteItem?: (id: string) => Promise<boolean>;
  onRestoreItem?: (id: string) => Promise<boolean>;
  showAddShiftConfirmDialog?: (item: ISRSRecord) => void;
  onAddShift?: (date: Date, shiftData?: INewSRSShiftData) => void;
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
    onTypeOfLeaveChange,
    showDeleteConfirmDialog,
    showRestoreConfirmDialog,
    showAddShiftConfirmDialog,
    onAddShift
  } = props;

  // Extract handlers directly from props to avoid unused variable errors
  const lunchTimeChangeHandler = props.onLunchTimeChange;
  const contractNumberChangeHandler = props.onContractNumberChange;

  // Локальное состояние для актуальных значений
  const [localStartWork, setLocalStartWork] = useState(item.startWork);
  const [localFinishWork, setLocalFinishWork] = useState(item.finishWork);
  const [localLunch, setLocalLunch] = useState(item.lunch);
  const [localContract, setLocalContract] = useState(item.contract);
  const [localTypeOfLeave, setLocalTypeOfLeave] = useState(item.typeOfLeave);
  // *** ИСПРАВЛЕНИЕ: Добавляем локальное состояние для timeLeave ***
  const [localTimeLeave, setLocalTimeLeave] = useState(item.timeLeave);

  // Определяем состояние записи: Является ли запись праздничной
  const isHoliday = item.Holiday === 1;
  if (item.id === '34825') {
    console.log(`[SRSTableRow] Record 34825 Holiday value:`, item.Holiday);
    console.log(`[SRSTableRow] Record 34825 isHoliday calculated:`, isHoliday);
  }

  // Определяем состояние записи: Является ли запись удаленной
  const isDeleted = item.deleted === true;

  console.log(`[SRSTableRow] Rendering row for item ${item.id} with NUMERIC TIME FIELDS integration and FIXED timeLeave support:`, {
    date: item.date.toLocaleDateString(),
    isHoliday: isHoliday,
    holidayValue: item.Holiday,
    displayWorkTime: displayWorkTime,
    isTimesEqual: isTimesEqual,
    deleted: item.deleted,
    isDeleted: isDeleted,
    hasDeleteHandler: !!showDeleteConfirmDialog,
    hasRestoreHandler: !!showRestoreConfirmDialog,
    hasAddShiftHandler: !!showAddShiftConfirmDialog,
    onAddShiftAvailable: !!onAddShift,
    workingWithNumericFields: true,
    timeLeave: item.timeLeave,
    localTimeLeave: localTimeLeave,
    timeLeaveFixed: true
  });

  // *** ИСПРАВЛЕНИЕ: Синхронизируем локальное состояние с props при изменении item (включая timeLeave) ***
  useEffect(() => {
    console.log('[SRSTableRow] Syncing local state with item (numeric time fields + timeLeave support):', {
      itemId: item.id,
      startWork: item.startWork,
      finishWork: item.finishWork,
      lunch: item.lunch,
      contract: item.contract,
      typeOfLeave: item.typeOfLeave,
      timeLeave: item.timeLeave, // *** ИСПРАВЛЕНИЕ ***
      deleted: item.deleted,
      holiday: item.Holiday
    });
    
    setLocalStartWork(item.startWork);
    setLocalFinishWork(item.finishWork);
    setLocalLunch(item.lunch);
    setLocalContract(item.contract);
    setLocalTypeOfLeave(item.typeOfLeave);
    // *** ИСПРАВЛЕНИЕ: Синхронизируем timeLeave ***
    setLocalTimeLeave(item.timeLeave);
  }, [item.id, item.startWork, item.finishWork, item.lunch, item.contract, item.typeOfLeave, item.timeLeave, item.deleted]);

  // *** ОБНОВЛЕНО: Обработчик клика по кнопке "+Shift" с числовыми полями времени ***
  const handleAddShiftClick = useCallback((): void => {
    console.log(`[SRSTableRow] *** ADD SHIFT CLICK WITH NUMERIC TIME FIELDS *** for item ${item.id} on date: ${item.date.toLocaleDateString()}`);
    
    if (!showAddShiftConfirmDialog) {
      console.error('[SRSTableRow] showAddShiftConfirmDialog handler not available - cannot show confirmation dialog');
      return;
    }

    console.log('[SRSTableRow] Calling showAddShiftConfirmDialog with item data for NUMERIC time fields creation');
    console.log('[SRSTableRow] Item data for shift creation:', {
      id: item.id,
      date: item.date.toISOString(),
      lunch: item.lunch,
      contract: item.contract,
      contractNumber: item.contract, // Используем contract как contractNumber
      typeOfLeave: item.typeOfLeave,
      Holiday: item.Holiday,
      // *** НОВОЕ: Логируем текущие числовые значения времени для будущей смены ***
      currentStartWork: `${item.startWork.hours}:${item.startWork.minutes}`,
      currentFinishWork: `${item.finishWork.hours}:${item.finishWork.minutes}`,
      willCreateWith: 'Numeric time fields (00:00-00:00 by default)'
    });
    
    // Передаем весь item в диалог подтверждения
    showAddShiftConfirmDialog(item);
    
  }, [item, showAddShiftConfirmDialog]);

  // Функция стилизации: Получение стилей праздничных ячеек
  const getHolidayCellStyle = (): React.CSSProperties => {
    if (!isHoliday) {
      return {};
    }
    
    return {
      backgroundColor: '#ffe6f0', // Розовый фон для праздников
      borderColor: '#ff69b4',     // Розовая граница
    };
  };

  // Базовые стили для ячеек
  const cellStyle: React.CSSProperties = {
    border: '1px solid #edebe9',
    padding: '8px',
    textAlign: 'center',
    fontSize: '12px',
    verticalAlign: 'middle',
    ...getHolidayCellStyle()
  };

  // Стили строки с учетом праздников, ошибок и удаления
  const rowStyle: React.CSSProperties = {
    backgroundColor: isDeleted 
      ? '#f5f5f5' 
      : isHoliday 
        ? '#ffe6f0' // Pink for holidays
        : isEven 
          ? '#ffffff' 
          : '#f9f9f9',
    opacity: isDeleted ? 0.6 : 1,
  };

  // Форматирование даты для отображения
  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Получение дня недели
  const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][item.date.getDay()];

  // Рендер ячейки даты: С учетом праздников и удаления
  const renderDateCell = (): JSX.Element => {
    if (rowPositionInDate === 0) {
      return (
        <>
          <div style={{ 
            fontWeight: '600',
            fontSize: '12px',
            color: isHoliday ? '#d83b01' : (isDeleted ? '#888' : 'inherit'),
            ...(isDeleted && { textDecoration: 'line-through' })
          }}>
            {formatDate(item.date)}
          </div>
          <div style={{ 
            fontSize: '11px', 
            color: isHoliday ? '#d83b01' : '#666',
            marginTop: '2px',
            ...(isDeleted && { color: '#aaa', textDecoration: 'line-through' })
          }}>
            {dayOfWeek}
            {/* Индикатор: Отображение "Holiday" для праздников */}
            {isHoliday && !isDeleted && (
              <div style={{ 
                color: '#d83b01', 
                fontWeight: '600',
                fontSize: '10px',
                marginTop: '2px'
              }}>
                Holiday
              </div>
            )}
            {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none' }}>(Deleted)</span>}
          </div>
        </>
      );
    }
    else if (rowPositionInDate === 1 && totalRowsInDate > 1) {
      return (
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '12px', 
          color: isHoliday ? '#ff69b4' : '#0078d4',
          textAlign: 'center',
          marginTop: '8px',
          ...(isDeleted && { color: '#88a0bd', textDecoration: 'line-through' })
        }}>
          {totalTimeForDate}
          {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none', fontSize: '10px' }}>(Deleted)</span>}
        </div>
      );
    }
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

  // ===============================================
  // ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ДАННЫХ
  // ===============================================

  const handleReliefChange = useCallback((ev?: React.FormEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      onItemChange(item, 'relief', checked);
    }
  }, [item, onItemChange]);

  const handleStartHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Start hour changing from', localStartWork.hours, 'to', option.key);
      const newStartWork = { ...localStartWork, hours: option.key as string };
      setLocalStartWork(newStartWork);
      onItemChange(item, 'startWork', newStartWork);
    }
  }, [item, onItemChange, localStartWork]);

  const handleStartMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Start minute changing from', localStartWork.minutes, 'to', option.key);
      const newStartWork = { ...localStartWork, minutes: option.key as string };
      setLocalStartWork(newStartWork);
      onItemChange(item, 'startWork', newStartWork);
    }
  }, [item, onItemChange, localStartWork]);

  const handleFinishHourChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Finish hour changing from', localFinishWork.hours, 'to', option.key);
      const newFinishWork = { ...localFinishWork, hours: option.key as string };
      setLocalFinishWork(newFinishWork);
      onItemChange(item, 'finishWork', newFinishWork);
    }
  }, [item, onItemChange, localFinishWork]);

  const handleFinishMinuteChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] Finish minute changing from', localFinishWork.minutes, 'to', option.key);
      const newFinishWork = { ...localFinishWork, minutes: option.key as string };
      setLocalFinishWork(newFinishWork);
      onItemChange(item, 'finishWork', newFinishWork);
    }
  }, [item, onItemChange, localFinishWork]);

  const handleLunchChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] *** LUNCH CHANGE WITH CURRENT LOCAL VALUES ***');
      console.log('[SRSTableRow] Lunch time changing from', localLunch, 'to', option.key);
      console.log('[SRSTableRow] Current local start work:', localStartWork);
      console.log('[SRSTableRow] Current local finish work:', localFinishWork);
      
      const updatedItemWithCurrentTimes: ISRSRecord = {
        ...item,
        startWork: localStartWork,
        finishWork: localFinishWork,
        lunch: option.key as string
      };
      
      console.log('[SRSTableRow] Updated item for lunch calculation:', {
        startWork: updatedItemWithCurrentTimes.startWork,
        finishWork: updatedItemWithCurrentTimes.finishWork,
        lunch: updatedItemWithCurrentTimes.lunch
      });
      
      const recalculatedWorkTime = calculateSRSWorkTime(updatedItemWithCurrentTimes);
      
      console.log('[SRSTableRow] *** RECALCULATED WORK TIME WITH CURRENT VALUES ***:', {
        oldWorkTime: displayWorkTime,
        newWorkTime: recalculatedWorkTime,
        startTime: `${localStartWork.hours}:${localStartWork.minutes}`,
        finishTime: `${localFinishWork.hours}:${localFinishWork.minutes}`,
        lunchMinutes: option.key
      });
      
      setLocalLunch(option.key as string);
      lunchTimeChangeHandler(updatedItemWithCurrentTimes, option.key as string);
    }
  }, [item, lunchTimeChangeHandler, localLunch, localStartWork, localFinishWork, displayWorkTime]);

  const handleTypeOfLeaveChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      console.log('[SRSTableRow] *** TYPE OF LEAVE CHANGE ***');
      console.log('[SRSTableRow] Type of leave changing from', localTypeOfLeave, 'to', option.key);
      
      const selectedType = options.leaveTypes.find(leaveType => leaveType.key === option.key);
      if (selectedType) {
        console.log('[SRSTableRow] Selected type details:', {
          key: selectedType.key,
          text: selectedType.text,
          data: selectedType.data
        });
      }
      
      setLocalTypeOfLeave(option.key as string);
      
      console.log('[SRSTableRow] Type of leave change does NOT affect work time calculation');
      
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
      setLocalContract(option.key as string);
      contractNumberChangeHandler(item, option.key as string);
    }
  }, [item, contractNumberChangeHandler, localContract]);

  // *** ИСПРАВЛЕНИЕ: Добавляем обработчик изменения Time Leave ***
  const handleTimeLeaveChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    console.log('[SRSTableRow] *** TIME LEAVE CHANGE ***');
    console.log('[SRSTableRow] Time leave changing from', localTimeLeave, 'to', value);
    
    // Валидация: разрешаем только числа и точку
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setLocalTimeLeave(value);
      onItemChange(item, 'timeLeave', value);
      console.log('[SRSTableRow] Time leave change applied to local state and parent');
    } else {
      console.log('[SRSTableRow] Invalid time leave value, ignoring:', value);
    }
  }, [item, onItemChange, localTimeLeave]);

  // ===============================================
  // РЕАЛЬНЫЕ ОБРАБОТЧИКИ УДАЛЕНИЯ/ВОССТАНОВЛЕНИЯ
  // ===============================================

  const handleDeleteClick = useCallback((): void => {
    console.log('[SRSTableRow] *** REAL DELETE CLICK *** for item:', item.id);
    
    if (showDeleteConfirmDialog) {
      console.log('[SRSTableRow] Calling showDeleteConfirmDialog - will trigger REAL StaffRecordsService.markRecordAsDeleted');
      showDeleteConfirmDialog(item.id);
    } else {
      console.warn('[SRSTableRow] showDeleteConfirmDialog handler not provided - REAL delete unavailable');
    }
  }, [item.id, showDeleteConfirmDialog]);

  const handleRestoreClick = useCallback((): void => {
    console.log('[SRSTableRow] *** REAL RESTORE CLICK *** for item:', item.id);
    
    if (showRestoreConfirmDialog) {
      console.log('[SRSTableRow] Calling showRestoreConfirmDialog - will trigger REAL StaffRecordsService.restoreDeletedRecord');
      showRestoreConfirmDialog(item.id);
    } else {
      console.warn('[SRSTableRow] showRestoreConfirmDialog handler not provided - REAL restore unavailable');
    }
  }, [item.id, showRestoreConfirmDialog]);

  // ===============================================
  // ФУНКЦИИ СТИЛИЗАЦИИ DROPDOWN
  // ===============================================

  const getDropdownStyles = (isError = false): object => ({
    root: { 
      width: 60, 
      margin: '0 2px',
      borderColor: isError ? '#a4262c' : undefined,
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  const getLunchDropdownStyles = (): object => ({
    root: { 
      width: 80,
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  const getLeaveDropdownStyles = (): object => ({
    root: { 
      width: 140,
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  const getContractDropdownStyles = (): object => ({
    root: { 
      width: 50,
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  // Логирование текущих отображаемых значений для отладки
  console.log('[SRSTableRow] Rendering row for item', item.id, 'with display values, NUMERIC time fields, and FIXED timeLeave:', {
    displayWorkTime,
    localStartWork,
    localFinishWork,
    localLunch,
    localContract,
    localTypeOfLeave,
    localTimeLeave, // *** ИСПРАВЛЕНИЕ ***
    isTimesEqual,
    isHoliday,
    isDeleted,
    hasRealDeleteIntegration: !!showDeleteConfirmDialog,
    hasRealRestoreIntegration: !!showRestoreConfirmDialog,
    hasAddShiftIntegration: !!showAddShiftConfirmDialog,
    numericTimeFieldsSupport: true,
    timeLeaveFixed: true // *** НОВОЕ ***
  });

  return (
    <tr style={rowStyle}>
      {/* Ячейка даты: С поддержкой праздников и удаления */}
      <td style={{ ...cellStyle, textAlign: 'left' }}>
        {renderDateCell()}
      </td>

      {/* Ячейка часов: С выделением праздников и удаления */}
      <td style={{ 
        ...cellStyle, 
        fontWeight: 'bold',
        color: isTimesEqual 
          ? '#a4262c' 
          : isHoliday 
            ? '#d83b01'
            : (displayWorkTime === '0:00' ? '#666' : 'inherit'),
        ...(isDeleted && { color: '#888', textDecoration: 'line-through' })
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
        {/* Индикатор праздника */}
        {isHoliday && !isDeleted && (
          <div style={{ 
            fontSize: '10px', 
            color: '#d83b01', 
            marginTop: '2px',
            fontWeight: 'normal'
          }}>
            Holiday
          </div>
        )}
        {isDeleted && (
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
          disabled={isDeleted}
        />
      </td>

      {/* Start Work cell */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={localStartWork.hours}
            options={options.hours}
            onChange={handleStartHourChange}
            disabled={isDeleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
          <span style={{ fontSize: '12px', color: isHoliday ? '#d83b01' : '#666' }}>:</span>
          <Dropdown
            selectedKey={localStartWork.minutes}
            options={options.minutes}
            onChange={handleStartMinuteChange}
            disabled={isDeleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
        </div>
      </td>

      {/* Finish Work cell */}
      <td style={cellStyle}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
          <Dropdown
            selectedKey={localFinishWork.hours}
            options={options.hours}
            onChange={handleFinishHourChange}
            disabled={isDeleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
          <span style={{ fontSize: '12px', color: isHoliday ? '#d83b01' : '#666' }}>:</span>
          <Dropdown
            selectedKey={localFinishWork.minutes}
            options={options.minutes}
            onChange={handleFinishMinuteChange}
            disabled={isDeleted}
            styles={getDropdownStyles(isTimesEqual)}
          />
        </div>
      </td>

      {/* Lunch cell */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={localLunch}
          options={options.lunchTimes}
          onChange={handleLunchChange}
          disabled={isDeleted}
          styles={getLunchDropdownStyles()}
        />
      </td>

      {/* Type of Leave cell */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={localTypeOfLeave}
          options={options.leaveTypes}
          onChange={handleTypeOfLeaveChange}
          disabled={isDeleted}
          styles={getLeaveDropdownStyles()}
          placeholder="Select type..."
        />
      </td>

      {/* *** ИСПРАВЛЕНО: Time Leave cell с локальным состоянием и правильным обработчиком *** */}
      <td style={cellStyle}>
        <input
          type="text"
          value={localTimeLeave}
          onChange={handleTimeLeaveChange}
          maxLength={6}
          disabled={isDeleted}
          placeholder="0.00"
          style={{
            width: '70px',
            height: '28px',
            border: '1px solid #d6d6d6',
            fontSize: '12px',
            textAlign: 'center',
            borderRadius: '2px',
            backgroundColor: isHoliday ? '#ffe6f0' : (isDeleted ? '#f5f5f5' : 'white'),
            color: isHoliday ? '#d83b01' : (isDeleted ? '#888' : 'inherit'),
            ...(isDeleted && { textDecoration: 'line-through' })
          }}
        />
      </td>

      {/* +Shift button - с правильным обработчиком */}
      <td style={cellStyle}>
        <DefaultButton
          text="+Shift"
          onClick={handleAddShiftClick}
          disabled={isDeleted}
          styles={{ 
            root: { 
              backgroundColor: isHoliday ? '#ff69b4' : '#107c10',
              color: 'white',
              border: 'none',
              minWidth: '60px',
              height: '28px',
              fontSize: '11px',
              borderRadius: '2px',
              ...(isDeleted && {
                backgroundColor: '#f5f5f5',
                color: '#888',
                borderColor: '#ddd'
              })
            },
            rootHovered: !isDeleted ? {
              backgroundColor: isHoliday ? '#ff1493' : '#0b5a0b'
            } : undefined
          }}
        />
      </td>

      {/* Contract cell */}
      <td style={cellStyle}>
        <Dropdown
          selectedKey={localContract}
          options={options.contractNumbers}
          onChange={handleContractChange}
          disabled={isDeleted}
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
            color: isHoliday ? '#ff69b4' : '#0078d4',
            fontWeight: '600',
            fontSize: '12px'
          }}>
            SRS
          </span>
        )}
      </td>

      {/* Actions (Delete/Restore) + ID */}
      <td style={{ ...cellStyle, padding: '4px' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: '4px'
        }}>
          {/* РЕАЛЬНЫЕ КНОПКИ: Delete/Restore с интеграцией StaffRecordsService */}
          {isDeleted ? (
            // РЕАЛЬНАЯ КНОПКА ВОССТАНОВЛЕНИЯ: Вызывает StaffRecordsService.restoreDeletedRecord
            <IconButton
              iconProps={{ iconName: 'Refresh' }}
              title="Restore (via StaffRecordsService)"
              ariaLabel="Restore via StaffRecordsService"
              onClick={handleRestoreClick}
              disabled={!showRestoreConfirmDialog}
              styles={{
                root: { 
                  color: '#107c10',
                  width: '24px',
                  height: '24px'
                },
                rootHovered: { color: '#0b5a0b' },
                rootDisabled: {
                  color: '#ccc'
                }
              }}
            />
          ) : (
            // РЕАЛЬНАЯ КНОПКА УДАЛЕНИЯ: Вызывает StaffRecordsService.markRecordAsDeleted
            <IconButton
              iconProps={{ iconName: 'Delete' }}
              title="Delete (via StaffRecordsService)"
              ariaLabel="Delete via StaffRecordsService"
              onClick={handleDeleteClick}
              disabled={!showDeleteConfirmDialog}
              styles={{ 
                root: { 
                  color: '#e81123',
                  width: '24px',
                  height: '24px'
                },
                rootHovered: { color: '#a80000' },
                rootDisabled: {
                  color: '#ccc'
                }
              }}
            />
          )}
          
          {/* ID Text */}
          <div style={{ 
            fontSize: '10px', 
            color: isDeleted ? '#888' : '#666',
            textAlign: 'center',
            lineHeight: '1',
            marginTop: '4px'
          }}>
            {item.id}
          </div>
                    
        </div>
      </td>
    </tr>
  );
};