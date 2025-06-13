// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { Checkbox, Dropdown, DefaultButton, IconButton, IDropdownOption, TooltipHost, Text } from '@fluentui/react';
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
  onTypeOfLeaveChange?: (item: ISRSRecord, value: string) => void;
  // *** РЕАЛЬНАЯ ИНТЕГРАЦИЯ: Обработчики удаления/восстановления через StaffRecordsService ***
  showDeleteConfirmDialog?: (id: string) => void;
  showRestoreConfirmDialog?: (id: string) => void;
  // onDeleteItem и onRestoreItem переданы для совместимости, но не используются в этом компоненте
  onDeleteItem?: (id: string) => Promise<boolean>;
  onRestoreItem?: (id: string) => Promise<boolean>;
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
    // *** РЕАЛЬНАЯ ИНТЕГРАЦИЯ: Деструктуризация обработчиков удаления ***
    showDeleteConfirmDialog,
    showRestoreConfirmDialog
  //  onDeleteItem,
  //  onRestoreItem
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

  // *** СОСТОЯНИЕ ОПЕРАЦИЙ: Отслеживание выполнения операций удаления/восстановления ***
  // Примечание: В текущей реализации состояние операций отслеживается в useSRSTabLogic
  // Эти переменные зарезервированы для будущего использования на уровне компонента
  // const [isDeleting, setIsDeleting] = useState(false);
  // const [isRestoring, setIsRestoring] = useState(false);

  // Синхронизируем локальное состояние с props при изменении item
  useEffect(() => {
    console.log('[SRSTableRow] Syncing local state with item (including type of leave and delete/restore states):', {
      itemId: item.id,
      startWork: item.startWork,
      finishWork: item.finishWork,
      lunch: item.lunch,
      contract: item.contract,
      typeOfLeave: item.typeOfLeave,
      deleted: item.deleted,
      holiday: item.Holiday
    });
    
    setLocalStartWork(item.startWork);
    setLocalFinishWork(item.finishWork);
    setLocalLunch(item.lunch);
    setLocalContract(item.contract);
    setLocalTypeOfLeave(item.typeOfLeave);
  }, [item.id, item.startWork, item.finishWork, item.lunch, item.contract, item.typeOfLeave, item.deleted]);

  // *** ОПРЕДЕЛЯЕМ СОСТОЯНИЕ ЗАПИСИ: Является ли запись праздничной ***
  const isHoliday = item.Holiday === 1;
  if (item.id === '34825') {
    console.log(`[SRSTableRow] Record 34825 Holiday value:`, item.Holiday);
    console.log(`[SRSTableRow] Record 34825 isHoliday calculated:`, isHoliday);
  }

  // *** ОПРЕДЕЛЯЕМ СОСТОЯНИЕ ЗАПИСИ: Является ли запись удаленной ***
  const isDeleted = item.deleted === true;

  console.log(`[SRSTableRow] Rendering row for item ${item.id} with REAL delete/restore integration:`, {
    date: item.date.toLocaleDateString(),
    isHoliday: isHoliday,
    holidayValue: item.Holiday,
    displayWorkTime: displayWorkTime,
    isTimesEqual: isTimesEqual,
    deleted: item.deleted,
    isDeleted: isDeleted,
    hasDeleteHandler: !!showDeleteConfirmDialog,
    hasRestoreHandler: !!showRestoreConfirmDialog,
    realServicesIntegration: true
  });

  // *** ФУНКЦИЯ СТИЛИЗАЦИИ: Получение стилей праздничных ячеек ***
  const getHolidayCellStyle = (): React.CSSProperties => {
    if (!isHoliday) {
      return {};
    }
    
    return {
      backgroundColor: '#ffe6f0', // Розовый фон для праздников (как в Schedule)
      borderColor: '#ff69b4',     // Розовая граница
    };
  };

  // Базовые стили для ячеек (как в Schedule table style)
  const cellStyle: React.CSSProperties = {
    border: '1px solid #edebe9',
    padding: '8px',
    textAlign: 'center',
    fontSize: '12px',
    verticalAlign: 'middle',
    // *** СТИЛИЗАЦИЯ: Добавляем стили праздника ***
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

  // *** РЕНДЕР ЯЧЕЙКИ ДАТЫ: С учетом праздников и удаления ***
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
            {/* *** ИНДИКАТОР: Отображение "Holiday" для праздников *** */}
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

  const handleAddShift = useCallback((): void => {
    console.log('[SRSTableRow] Add shift clicked for date:', item.date.toLocaleDateString());
  }, [item.date]);

  // ===============================================
  // *** РЕАЛЬНЫЕ ОБРАБОТЧИКИ УДАЛЕНИЯ/ВОССТАНОВЛЕНИЯ ***
  // ===============================================

  /**
   * *** РЕАЛЬНЫЙ ОБРАБОТЧИК: Клик по кнопке удаления ***
   * Показывает диалог подтверждения через showDeleteConfirmDialog
   */
  const handleDeleteClick = useCallback((): void => {
    console.log('[SRSTableRow] *** REAL DELETE CLICK *** for item:', item.id);
    
    if (showDeleteConfirmDialog) {
      console.log('[SRSTableRow] Calling showDeleteConfirmDialog - will trigger REAL StaffRecordsService.markRecordAsDeleted');
      showDeleteConfirmDialog(item.id);
    } else {
      console.warn('[SRSTableRow] showDeleteConfirmDialog handler not provided - REAL delete unavailable');
    }
  }, [item.id, showDeleteConfirmDialog]);

  /**
   * *** РЕАЛЬНЫЙ ОБРАБОТЧИК: Клик по кнопке восстановления ***
   * Показывает диалог подтверждения через showRestoreConfirmDialog
   */
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

  // *** СТИЛИЗАЦИЯ: dropdown с учетом праздников и удаления ***
  const getDropdownStyles = (isError = false): object => ({
    root: { 
      width: 60, 
      margin: '0 2px',
      borderColor: isError ? '#a4262c' : undefined,
      // *** СТИЛИ ПРАЗДНИКОВ: Розовый фон для праздников ***
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** СТИЛИ ПРАЗДНИКОВ: Цвет текста для праздников ***
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      // *** СТИЛИ ПРАЗДНИКОВ: Цвет стрелки для праздников ***
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  const getLunchDropdownStyles = (): object => ({
    root: { 
      width: 80,
      // *** СТИЛИ ПРАЗДНИКОВ: Розовый фон для праздников ***
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** СТИЛИ ПРАЗДНИКОВ: Цвет текста для праздников ***
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
      // *** СТИЛИ ПРАЗДНИКОВ: Розовый фон для праздников ***
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** СТИЛИ ПРАЗДНИКОВ: Цвет текста для праздников ***
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
      // *** СТИЛИ ПРАЗДНИКОВ: Розовый фон для праздников ***
      backgroundColor: isHoliday ? '#ffe6f0' : undefined,
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** СТИЛИ ПРАЗДНИКОВ: Цвет текста для праздников ***
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  // Логирование текущих отображаемых значений для отладки
  console.log('[SRSTableRow] Rendering row for item', item.id, 'with display values and REAL services:', {
    displayWorkTime,
    localStartWork,
    localFinishWork,
    localLunch,
    localContract,
    localTypeOfLeave,
    isTimesEqual,
    isHoliday,
    isDeleted,
    hasRealDeleteIntegration: !!showDeleteConfirmDialog,
    hasRealRestoreIntegration: !!showRestoreConfirmDialog
  });

  return (
    <tr style={rowStyle}>
      {/* *** ЯЧЕЙКА ДАТЫ: С поддержкой праздников и удаления *** */}
      <td style={{ ...cellStyle, textAlign: 'left' }}>
        {renderDateCell()}
      </td>

      {/* *** ЯЧЕЙКА ЧАСОВ: С выделением праздников и удаления *** */}
      <td style={{ 
        ...cellStyle, 
        fontWeight: 'bold',
        color: isTimesEqual 
          ? '#a4262c' 
          : isHoliday 
            ? '#d83b01'
            : (displayWorkTime === '0.00' ? '#666' : 'inherit'),
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
        {/* *** ИНДИКАТОР ПРАЗДНИКА *** */}
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

      {/* Time Leave cell */}
      <td style={cellStyle}>
        <input
          type="text"
          value={item.timeLeave}
          onChange={(e) => onItemChange(item, 'timeLeave', e.target.value)}
          maxLength={4}
          disabled={isDeleted}
          style={{
            width: '70px',
            height: '28px',
            border: '1px solid #d6d6d6',
            fontSize: '12px',
            textAlign: 'center',
            borderRadius: '2px',
            // *** СТИЛИ ПРАЗДНИКОВ ***
            backgroundColor: isHoliday ? '#ffe6f0' : (isDeleted ? '#f5f5f5' : 'white'),
            color: isHoliday ? '#d83b01' : undefined
          }}
        />
      </td>

      {/* +Shift button */}
      <td style={cellStyle}>
        <DefaultButton
          text="+Shift"
          onClick={handleAddShift}
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

      {/* *** НОВАЯ ЯЧЕЙКА: Actions (Delete/Restore) + ID С РЕАЛЬНЫМИ СЕРВИСАМИ *** */}
      <td style={{ ...cellStyle, padding: '4px' }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: '4px'
        }}>
          {/* *** РЕАЛЬНЫЕ КНОПКИ: Delete/Restore с интеграцией StaffRecordsService *** */}
          {isDeleted ? (
            // *** РЕАЛЬНАЯ КНОПКА ВОССТАНОВЛЕНИЯ: Вызывает StaffRecordsService.restoreDeletedRecord ***
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
            // *** РЕАЛЬНАЯ КНОПКА УДАЛЕНИЯ: Вызывает StaffRecordsService.markRecordAsDeleted ***
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
          
          {/* *** ОТЛАДОЧНАЯ ИНФОРМАЦИЯ: Показываем состояние интеграции в dev режиме *** */}
          {process.env.NODE_ENV === 'development' && (
            <div style={{
              fontSize: '8px',
              color: '#0078d4',
              textAlign: 'center',
              marginTop: '2px',
              lineHeight: '1'
            }}>
              {showDeleteConfirmDialog && showRestoreConfirmDialog ? 'REAL' : 'MOCK'}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
};