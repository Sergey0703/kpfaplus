// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTableRow.tsx

import * as React from 'react';
import { useCallback, useState, useEffect } from 'react';
import { Checkbox, Dropdown, DefaultButton, IconButton, IDropdownOption, TooltipHost, Text } from '@fluentui/react';
import { ISRSTableRowProps, ISRSRecord, isHolidayDate, getHolidayInfo } from '../utils/SRSTabInterfaces';
import { calculateSRSWorkTime } from '../utils/SRSTimeCalculationUtils';

// *** ОБНОВЛЕНО: Интерфейс данных для новой смены без проверки Holiday поля ***
export interface INewSRSShiftData {
  date: Date;
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  Holiday?: number; // Всегда 0 - праздники определяются из holidays list
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
  onItemCheck?: (item: ISRSRecord, checked: boolean) => void;
  // *** НОВОЕ: Добавлен обработчик для кнопки SRS ***
  onSRSButtonClick?: (item: ISRSRecord) => void;
}> = (props) => {
  const {
    item,
    options,
    // *** НОВОЕ: Получаем holidays list для определения праздников ***
    holidays,
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
    onAddShift,
    onItemCheck,
    // *** НОВОЕ: Получаем обработчик кнопки SRS ***
    onSRSButtonClick
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
  const [localTimeLeave, setLocalTimeLeave] = useState(item.timeLeave);

  // *** УПРОЩЕНО: Определение праздника на основе списка праздников без нормализации времени ***
  const isHoliday = isHolidayDate(item.date, holidays);
  const holidayInfo = getHolidayInfo(item.date, holidays);

  // Определяем состояние записи: Является ли запись удаленной
  const isDeleted = item.deleted === true;

  console.log(`[SRSTableRow] Rendering row for item ${item.id} with HOLIDAY FROM HOLIDAYS LIST (Date-only):`, {
    date: item.date.toLocaleDateString(),
    // *** ИЗМЕНЕНО: Логируем праздник на основе списка с Date-only форматом ***
    isHoliday: isHoliday,
    holidayFromList: !!holidayInfo,
    holidayTitle: holidayInfo?.title || 'Not a holiday',
    holidaysListCount: holidays.length,
    originalHolidayField: item.Holiday, // Показываем для сравнения, но не используем
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
    holidayDetectionMethod: 'Holidays list date matching (Date-only), not Holiday field', // *** НОВОЕ ***
    checked: item.checked,
    hasItemCheckHandler: !!onItemCheck,
    // *** НОВОЕ: Логируем информацию о кнопке SRS ***
    rowPositionInDate,
    hasSRSButtonHandler: !!onSRSButtonClick,
    willShowSRSButton: rowPositionInDate === 0 && !!onSRSButtonClick
  });

  // Синхронизируем локальное состояние с props при изменении item
  useEffect(() => {
    console.log('[SRSTableRow] Syncing local state with item (numeric time fields + timeLeave + holiday from list Date-only):', {
      itemId: item.id,
      startWork: item.startWork,
      finishWork: item.finishWork,
      lunch: item.lunch,
      contract: item.contract,
      typeOfLeave: item.typeOfLeave,
      timeLeave: item.timeLeave,
      deleted: item.deleted,
      checked: item.checked,
      // *** ИЗМЕНЕНО: Логируем праздник из списка Date-only, а не из поля ***
      holidayFromField: item.Holiday,
      holidayFromList: isHoliday,
      holidayTitle: holidayInfo?.title || 'Not a holiday'
    });
    
    setLocalStartWork(item.startWork);
    setLocalFinishWork(item.finishWork);
    setLocalLunch(item.lunch);
    setLocalContract(item.contract);
    setLocalTypeOfLeave(item.typeOfLeave);
    setLocalTimeLeave(item.timeLeave);
  }, [item.id, item.startWork, item.finishWork, item.lunch, item.contract, item.typeOfLeave, item.timeLeave, item.deleted, item.checked, isHoliday, holidayInfo]);

  // *** ИСПРАВЛЕНО: Обработчик клика по кнопке "+Shift" без проверки Holiday поля ***
  const handleAddShiftClick = useCallback((): void => {
    console.log(`[SRSTableRow] *** ADD SHIFT CLICK WITHOUT HOLIDAY FIELD CHECK *** for item ${item.id} on date: ${item.date.toLocaleDateString()}`);
    
    if (!showAddShiftConfirmDialog) {
      console.error('[SRSTableRow] showAddShiftConfirmDialog handler not available - cannot show confirmation dialog');
      return;
    }

    console.log('[SRSTableRow] Calling showAddShiftConfirmDialog with item data for NUMERIC time fields creation WITHOUT holiday check');
    console.log('[SRSTableRow] Item data for shift creation:', {
      id: item.id,
      date: item.date.toISOString(),
      lunch: item.lunch,
      contract: item.contract,
      contractNumber: item.contract, // Используем contract как contractNumber
      typeOfLeave: item.typeOfLeave,
      // *** ИСПРАВЛЕНО: Убрана передача информации о праздниках ***
      holidayHandling: 'Always 0 - determined from holidays list (Date-only), not passed to creation',
      // *** НОВОЕ: Логируем текущие числовые значения времени для будущей смены ***
      currentStartWork: `${item.startWork.hours}:${item.startWork.minutes}`,
      currentFinishWork: `${item.finishWork.hours}:${item.finishWork.minutes}`,
      willCreateWith: 'Numeric time fields (00:00-00:00 by default), Holiday=0 (determined from holidays list Date-only)'
    });
    
    // Передаем весь item в диалог подтверждения
    showAddShiftConfirmDialog(item);
    
  }, [item, showAddShiftConfirmDialog]);

  // *** НОВОЕ: Обработчик изменения состояния checkbox ***
  const handleCheckChange = useCallback((ev?: React.FormEvent<HTMLElement>, checked?: boolean): void => {
    if (checked === undefined || isDeleted) {
      return;
    }

    console.log(`[SRSTableRow] *** CHECK CHANGE *** for item ${item.id}:`, {
      oldValue: item.checked,
      newValue: checked,
      itemId: item.id,
      isDeleted: isDeleted
    });

    if (onItemCheck) {
      onItemCheck(item, checked);
    } else {
      console.warn('[SRSTableRow] onItemCheck handler not provided');
    }
  }, [item, isDeleted, onItemCheck]);

  // *** НОВОЕ: Обработчик клика по кнопке SRS ***
  const handleSRSButtonClick = useCallback((): void => {
    console.log(`[SRSTableRow] *** SRS BUTTON CLICK *** for item ${item.id} on date: ${item.date.toLocaleDateString()}`);
    
    if (!onSRSButtonClick) {
      console.error('[SRSTableRow] onSRSButtonClick handler not available');
      return;
    }

    console.log('[SRSTableRow] Calling onSRSButtonClick handler:', {
      itemId: item.id,
      date: item.date.toISOString(),
      rowPositionInDate,
      isFirstRowOfDay: rowPositionInDate === 0
    });
    
    onSRSButtonClick(item);
  }, [item, onSRSButtonClick, rowPositionInDate]);

  // *** ОБНОВЛЕНО: Holiday cell style - колонко-специфичная стилизация на основе списка праздников Date-only ***
  const getHolidayCellStyle = (columnType: 'date' | 'hours' | 'other'): React.CSSProperties => {
    // *** ИЗМЕНЕНО: Используем isHoliday из списка праздников Date-only вместо item.Holiday ***
    if (!isHoliday) {
      return {};
    }
    
    // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Только Date и Hours колонки получают праздничный фон ***
    if (columnType === 'date' || columnType === 'hours') {
      return {
        backgroundColor: 'rgb(255, 230, 240)', // *** ТОЧНЫЙ ЦВЕТ ИЗ SCHEDULE TAB ***
        borderColor: '#ff69b4',
      };
    }
    
    // Для всех остальных колонок - без праздничного фона
    return {};
  };

  // *** ОБНОВЛЕНО: Базовые стили ячеек с колонко-специфичным праздничным стилем на основе списка Date-only ***
  const getCellStyle = (columnType: 'date' | 'hours' | 'other'): React.CSSProperties => {
    return {
      border: '1px solid #edebe9',
      padding: '8px',
      textAlign: columnType === 'date' ? 'left' : 'center',
      fontSize: '12px',
      verticalAlign: 'middle',
      ...getHolidayCellStyle(columnType) // *** ПРИМЕНЯЕМ ПРАЗДНИЧНЫЙ СТИЛЬ ПО КОЛОНКАМ НА ОСНОВЕ СПИСКА Date-only ***
    };
  };

  // *** ОБНОВЛЕНО: Стили строки - убран праздничный фон со всей строки ***
  const rowStyle: React.CSSProperties = {
    backgroundColor: isDeleted 
      ? '#f5f5f5' 
      : isEven 
        ? '#ffffff' 
        : '#f9f9f9',
    // *** УБРАНО: Праздничная стилизация всей строки ***
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

  // *** ОБНОВЛЕНО: Рендер ячейки даты - с праздниками из списка Date-only ***
  const renderDateCell = (): JSX.Element => {
    if (rowPositionInDate === 0) {
      return (
        <>
          <div style={{ 
            fontWeight: '600',
            fontSize: '12px',
            // *** ИЗМЕНЕНО: Цвет на основе isHoliday из списка Date-only ***
            color: isHoliday ? '#d83b01' : (isDeleted ? '#888' : 'inherit'),
            ...(isDeleted && { textDecoration: 'line-through' })
          }}>
            {formatDate(item.date)}
          </div>
          <div style={{ 
            fontSize: '11px', 
            // *** ИЗМЕНЕНО: Цвет на основе isHoliday из списка Date-only ***
            color: isHoliday ? '#d83b01' : '#666',
            marginTop: '2px',
            ...(isDeleted && { color: '#aaa', textDecoration: 'line-through' })
          }}>
            {dayOfWeek}
            {/* *** ОБНОВЛЕНО: Индикатор праздника на основе списка Date-only с названием праздника *** */}
            {isHoliday && !isDeleted && (
              <div style={{ 
                color: '#d83b01', 
                fontWeight: '600',
                fontSize: '10px',
                marginTop: '2px'
              }}>
                {holidayInfo?.title || 'Holiday'}
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
          // *** ИЗМЕНЕНО: Цвет на основе isHoliday из списка Date-only ***
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
          {/* *** ОБНОВЛЕНО: Праздничный индикатор на основе списка Date-only с названием *** */}
          {isHoliday && !isDeleted && (
            <div style={{ color: '#e81123', fontSize: '10px', fontWeight: 'bold' }}>
              {holidayInfo?.title || 'Holiday'}
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
      console.log('[SRSTableRow] *** LUNCH CHANGE WITH CURRENT LOCAL VALUES AND HOLIDAY FROM LIST Date-only ***');
      console.log('[SRSTableRow] Lunch time changing from', localLunch, 'to', option.key);
      console.log('[SRSTableRow] Current local start work:', localStartWork);
      console.log('[SRSTableRow] Current local finish work:', localFinishWork);
      console.log('[SRSTableRow] Holiday status from list (Date-only):', isHoliday, holidayInfo?.title || 'Not a holiday');
      
      const updatedItemWithCurrentTimes: ISRSRecord = {
        ...item,
        startWork: localStartWork,
        finishWork: localFinishWork,
        lunch: option.key as string
      };
      
      console.log('[SRSTableRow] Updated item for lunch calculation:', {
        startWork: updatedItemWithCurrentTimes.startWork,
        finishWork: updatedItemWithCurrentTimes.finishWork,
        lunch: updatedItemWithCurrentTimes.lunch,
        holidayFromList: isHoliday
      });
      
      const recalculatedWorkTime = calculateSRSWorkTime(updatedItemWithCurrentTimes);
      
      console.log('[SRSTableRow] *** RECALCULATED WORK TIME WITH CURRENT VALUES AND HOLIDAY FROM LIST Date-only ***:', {
        oldWorkTime: displayWorkTime,
        newWorkTime: recalculatedWorkTime,
        startTime: `${localStartWork.hours}:${localStartWork.minutes}`,
        finishTime: `${localFinishWork.hours}:${localFinishWork.minutes}`,
        lunchMinutes: option.key,
        holidayInfo: isHoliday ? (holidayInfo?.title || 'Holiday') : 'Regular day'
      });
      
      setLocalLunch(option.key as string);
      lunchTimeChangeHandler(updatedItemWithCurrentTimes, option.key as string);
    }
  }, [item, lunchTimeChangeHandler, localLunch, localStartWork, localFinishWork, displayWorkTime, isHoliday, holidayInfo]);

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

  // Добавляем обработчик изменения Time Leave
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
  // *** ОБНОВЛЕННЫЕ ФУНКЦИИ СТИЛИЗАЦИИ DROPDOWN - УБРАНЫ ПРАЗДНИЧНЫЕ ФОНЫ ***
  // ===============================================

  const getDropdownStyles = (isError = false): object => ({
    root: { 
      width: 60, 
      margin: '0 2px',
      borderColor: isError ? '#a4262c' : undefined,
      // *** УБРАНО: Праздничный фон для dropdown ***
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** ИЗМЕНЕНО: Праздничный цвет текста на основе isHoliday из списка Date-only ***
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    },
    caretDown: {
      // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#aaa'
      })
    }
  });

  const getLunchDropdownStyles = (): object => ({
    root: { 
      width: 80,
      // *** УБРАНО: Праздничный фон для dropdown ***
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
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
      // *** УБРАНО: Праздничный фон для dropdown ***
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
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
      // *** УБРАНО: Праздничный фон для dropdown ***
      ...(isDeleted && {
        backgroundColor: '#f5f5f5',
        color: '#888',
        borderColor: '#ddd'
      })
    },
    title: {
      fontSize: '12px',
      // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
      color: isHoliday ? '#d83b01' : undefined,
      ...(isDeleted && {
        color: '#888',
        textDecoration: 'line-through'
      })
    }
  });

  // Логирование текущих отображаемых значений для отладки
  console.log('[SRSTableRow] Rendering row for item', item.id, 'with HOLIDAY FROM HOLIDAYS LIST Date-only and FIXED timeLeave:', {
    displayWorkTime,
    localStartWork,
    localFinishWork,
    localLunch,
    localContract,
    localTypeOfLeave,
    localTimeLeave,
    isTimesEqual,
    // *** ИЗМЕНЕНО: Логируем праздник из списка Date-only ***
    isHolidayFromList: isHoliday,
    holidayTitle: holidayInfo?.title || 'Not a holiday',
    originalHolidayField: item.Holiday, // Для сравнения
    isDeleted,
    hasRealDeleteIntegration: !!showDeleteConfirmDialog,
    hasRealRestoreIntegration: !!showRestoreConfirmDialog,
    hasAddShiftIntegration: !!showAddShiftConfirmDialog,
    numericTimeFieldsSupport: true,
    timeLeaveFixed: true,
    holidayDetectionMethod: 'Holidays list date matching (Date-only)', // *** НОВОЕ ***
    addShiftWithoutHolidayCheck: true, // *** ИСПРАВЛЕНО ***
    checked: item.checked,
    hasItemCheckHandler: !!onItemCheck,
    // *** НОВОЕ: Информация о кнопке SRS ***
    rowPositionInDate,
    hasSRSButtonHandler: !!onSRSButtonClick,
    willShowSRSButton: rowPositionInDate === 0 && !!onSRSButtonClick
  });

  return (
    <tr style={rowStyle}>
      {/* *** ОБНОВЛЕНО: Ячейка даты с праздничным фоном на основе списка Date-only *** */}
      <td style={getCellStyle('date')}>
        {renderDateCell()}
      </td>

      {/* *** ОБНОВЛЕНО: Ячейка часов с праздничным фоном на основе списка Date-only *** */}
      <td style={{ 
        ...getCellStyle('hours'), 
        fontWeight: 'bold',
        color: isTimesEqual 
          ? '#a4262c' 
          : isHoliday 
            ? '#d83b01'  // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
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
        {/* *** ОБНОВЛЕНО: Индикатор праздника на основе списка Date-only с названием *** */}
        {isHoliday && !isDeleted && (
          <div style={{ 
            fontSize: '10px', 
            color: '#d83b01', 
            marginTop: '2px',
            fontWeight: 'normal'
          }}>
            {holidayInfo?.title || 'Holiday'}
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

      {/* *** ОБНОВЛЕНО: Все остальные ячейки БЕЗ праздничного фона *** */}
      
      {/* Relief cell */}
      <td style={getCellStyle('other')}>
        <Checkbox
          checked={item.relief}
          onChange={handleReliefChange}
          disabled={isDeleted}
        />
      </td>

      {/* Start Work cell */}
      <td style={getCellStyle('other')}>
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
      <td style={getCellStyle('other')}>
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
      <td style={getCellStyle('other')}>
        <Dropdown
          selectedKey={localLunch}
          options={options.lunchTimes}
          onChange={handleLunchChange}
          disabled={isDeleted}
          styles={getLunchDropdownStyles()}
        />
      </td>

      {/* Type of Leave cell */}
      <td style={getCellStyle('other')}>
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
      <td style={getCellStyle('other')}>
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
            backgroundColor: isDeleted ? '#f5f5f5' : 'white', 
            // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
            color: isHoliday ? '#d83b01' : (isDeleted ? '#888' : 'inherit'),
            ...(isDeleted && { textDecoration: 'line-through' })
          }}
        />
      </td>

      {/* *** ИСПРАВЛЕНО: +Shift button - всегда зеленый, без проверки праздников *** */}
      <td style={getCellStyle('other')}>
        <DefaultButton
          text="+Shift"
          onClick={handleAddShiftClick}
          disabled={isDeleted}
          styles={{ 
            root: { 
              backgroundColor: '#107c10', // *** ИСПРАВЛЕНО: Всегда зеленый, без проверки праздников ***
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
              backgroundColor: '#0b5a0b' // *** ИСПРАВЛЕНО: Всегда темно-зеленый hover, без проверки праздников ***
            } : undefined
          }}
        />
      </td>

      {/* Contract cell */}
      <td style={getCellStyle('other')}>
        <Dropdown
          selectedKey={localContract}
          options={options.contractNumbers}
          onChange={handleContractChange}
          disabled={isDeleted}
          styles={getContractDropdownStyles()}
        />
      </td>

      {/* *** ИЗМЕНЕНО: Check cell - теперь с реальным checkbox *** */}
      <td style={getCellStyle('other')}>
        <Checkbox
          checked={item.checked}
          onChange={handleCheckChange}
          disabled={isDeleted}
          styles={{
            root: {
              // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
              color: isHoliday ? '#d83b01' : undefined,
              ...(isDeleted && {
                color: '#888',
                opacity: 0.6
              })
            }
          }}
        />
      </td>

      {/* *** ИЗМЕНЕНО: SRS cell - теперь с кнопкой в первой строке дня *** */}
      <td style={getCellStyle('other')}>
        {rowPositionInDate === 0 && onSRSButtonClick && (
          <DefaultButton
            text="SRS"
            onClick={handleSRSButtonClick}
            disabled={isDeleted}
            styles={{
              root: {
                backgroundColor: '#0078d4',
                color: 'white',
                border: 'none',
                minWidth: '50px',
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
                backgroundColor: '#106ebe'
              } : undefined
            }}
          />
        )}
        {/* *** ОСТАВЛЕНО: Показываем SRS текст если нет кнопки и item.srs === true *** */}
        {(rowPositionInDate !== 0 || !onSRSButtonClick) && item.srs && (
          <span style={{
            // *** ИЗМЕНЕНО: Праздничный цвет на основе isHoliday из списка Date-only ***
            color: isHoliday ? '#ff69b4' : '#0078d4',
            fontWeight: '600',
            fontSize: '12px'
          }}>
            SRS
          </span>
        )}
      </td>

      {/* Actions (Delete/Restore) + ID */}
      <td style={{ ...getCellStyle('other'), padding: '4px' }}>
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