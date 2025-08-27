// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTable.tsx

import * as React from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
// ИСПРАВЛЕНО: 'Text' удален из импорта, так как он больше не используется
import { Spinner, SpinnerSize, Toggle } from '@fluentui/react';
import { ISRSTableProps, ISRSRecord } from '../utils/SRSTabInterfaces';
import { SRSTableRow } from './SRSTableRow';
import { 
  calculateSRSWorkTime,
  checkSRSStartEndTimeSame
} from '../utils/SRSTimeCalculationUtils';

// *** ИСПРАВЛЕНО: Интерфейс данных для новой смены без Holiday поля ***
import { INewSRSShiftData } from './SRSTableRow';

// *** ОБНОВЛЕННЫЙ ИМПОРТ: SRSFilterControls без totalHours ***
import { SRSFilterControls } from './SRSFilterControls';

export const SRSTable: React.FC<ISRSTableProps & {
  // *** НОВЫЕ ПРОПСЫ: Для передачи данных в SRSFilterControls ***
  fromDate: Date;
  toDate: Date;
  isLoading: boolean;
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  onRefresh: () => void;
  onExportAll: () => void;
  onSave: () => void;
  onSaveChecked: () => void;
  hasChanges: boolean;
  hasCheckedItems: boolean;
  // *** НОВОЕ: Добавлен onItemCheck prop для поддержки checkbox функциональности ***
  onItemCheck?: (item: ISRSRecord, checked: boolean) => void;
}> = (props) => {
  const {
    items,
    options,
    // *** НОВОЕ: Получаем holidays prop для определения праздников ***
    holidays,
    isLoading,
    onItemChange,
    onLunchTimeChange,
    onContractNumberChange,
    // *** НОВОЕ: Обработчик типов отпусков ***
    onTypeOfLeaveChange,
    // *** НОВОЕ: Обработчики удаления/восстановления ***
    showDeleteConfirmDialog,
    showRestoreConfirmDialog,
    onDeleteItem,
    onRestoreItem,
    // *** ИСПРАВЛЕНО: Обязательные пропсы для showDeleted ***
    showDeleted,
    onToggleShowDeleted,
    onAddShift,
    // *** НОВЫЕ ПРОПСЫ: Для SRSFilterControls ***
    fromDate,
    toDate,
    onFromDateChange,
    onToDateChange,
    onRefresh,
    onExportAll,
    onSave,
    onSaveChecked,
    hasChanges,
    hasCheckedItems,
    // *** НОВОЕ: Обработчик checkbox функциональности ***
    onItemCheck
  } = props;

  // *** КЛЮЧЕВОЕ ДОБАВЛЕНИЕ: State для вычисленного времени работы ***
  const [calculatedWorkTimes, setCalculatedWorkTimes] = useState<Record<string, string>>({});

  // *** НОВОЕ: State для отслеживания актуальных значений времени каждой записи ***
  const [currentItemValues, setCurrentItemValues] = useState<Record<string, {
    startWork: { hours: string; minutes: string };
    finishWork: { hours: string; minutes: string };
    lunch: string;
  }>>({});

  // *** ИСПРАВЛЕНО: State для диалога подтверждения добавления смены без Holiday проверки ***
  const [addShiftConfirmDialog, setAddShiftConfirmDialog] = useState({
    isOpen: false,
    item: null as ISRSRecord | null,
    title: '',
    message: ''
  });

  console.log('[SRSTable] Rendering with REAL-TIME TOTAL HOURS CALCULATION AND HOLIDAYS LIST WITHOUT HOLIDAY FIELD CHECKS (Date-only):', {
    itemsCount: items.length,
    // *** НОВОЕ: Логируем информацию о праздниках Date-only ***
    holidaysCount: holidays.length,
    holidaysAvailable: holidays.length > 0,
    holidayDates: holidays.map(h => h.date.toLocaleDateString()),
    hasTypeOfLeaveHandler: !!onTypeOfLeaveChange,
    optionsLeaveTypesCount: options.leaveTypes?.length || 0,
    hasDeleteHandler: !!showDeleteConfirmDialog,
    hasRestoreHandler: !!showRestoreConfirmDialog,
    showDeleted: showDeleted,
    hasToggleShowDeleted: !!onToggleShowDeleted,
    showDeletedIsRequired: showDeleted !== undefined,
    toggleHandlerIsRequired: !!onToggleShowDeleted,
    deletedItemsCount: items.filter(item => item.deleted === true).length,
    activeItemsCount: items.filter(item => item.deleted !== true).length,
    hasAddShiftDialog: true,
    addShiftDialogOpen: addShiftConfirmDialog.isOpen,
    realTimeTotalHours: true, // *** НОВАЯ ФУНКЦИЯ ***
    holidaysFromList: true, // *** НОВАЯ ФУНКЦИЯ: Праздники из списка Date-only, а не из поля ***
    addShiftWithoutHolidayCheck: true, // *** ИСПРАВЛЕНО: Добавление смены без проверки Holiday поля ***
    hasItemCheckHandler: !!onItemCheck // *** НОВОЕ: Логируем наличие checkbox обработчика ***
  });

  // *** КЛЮЧЕВАЯ ФУНКЦИЯ: Вычисление общего времени в реальном времени ***
  const calculateCurrentTotalHours = useMemo((): string => {
    console.log('[SRSTable] *** CALCULATING REAL-TIME TOTAL HOURS ***');
    
    if (!items || items.length === 0) {
      console.log('[SRSTable] No items, returning 0:00');
      return '0:00';
    }

    let totalMinutes = 0;
    
    // Фильтруем записи согласно showDeleted
    const recordsToCount = showDeleted 
      ? items 
      : items.filter(item => item.deleted !== true);
    
    console.log('[SRSTable] Records to count for total:', {
      totalItems: items.length,
      recordsToCount: recordsToCount.length,
      showDeleted: showDeleted,
      deletedItems: items.filter(item => item.deleted === true).length
    });

    recordsToCount.forEach((item, index) => {
      try {
        // Получаем актуальное вычисленное время для этой записи
        const workTime = calculatedWorkTimes[item.id] || item.hours || '0:00';
        
        console.log(`[SRSTable] Item ${index} (ID: ${item.id}) work time: ${workTime}`);
        
        // Парсим время в формате "H:MM" или "H.MM"
        let itemMinutes = 0;
        
        if (workTime.includes(':')) {
          // Формат "7:30"
          const [hoursStr, minutesStr] = workTime.split(':');
          const hours = parseInt(hoursStr, 10) || 0;
          const minutes = parseInt(minutesStr, 10) || 0;
          itemMinutes = (hours * 60) + minutes;
        } else if (workTime.includes('.')) {
          // Формат "7.50" 
          const [hoursStr, minutesDecimalStr] = workTime.split('.');
          const hours = parseInt(hoursStr, 10) || 0;
          const minutesDecimal = parseInt(minutesDecimalStr.padEnd(2, '0'), 10) || 0;
          itemMinutes = (hours * 60) + minutesDecimal;
        } else {
          // Только часы "7"
          const hours = parseFloat(workTime) || 0;
          itemMinutes = Math.round(hours * 60);
        }
        
        // Валидация
        if (itemMinutes < 0) {
          console.warn(`[SRSTable] Item ${index} has negative minutes (${itemMinutes}), setting to 0`);
          itemMinutes = 0;
        } else if (itemMinutes > (24 * 60)) {
          console.warn(`[SRSTable] Item ${index} has more than 24 hours (${itemMinutes} minutes), capping`);
          itemMinutes = 24 * 60;
        }
        
        totalMinutes += itemMinutes;
        
        console.log(`[SRSTable] Item ${index} contributes ${itemMinutes} minutes. Running total: ${totalMinutes}`);
        
      } catch (error) {
        console.error(`[SRSTable] Error processing item ${index}:`, error);
      }
    });

    // Конвертируем в часы:минуты
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const result = `${totalHours}:${remainingMinutes.toString().padStart(2, '0')}`;
    
    console.log('[SRSTable] *** REAL-TIME TOTAL CALCULATION RESULT ***:', {
      totalRecords: recordsToCount.length,
      totalMinutes,
      totalHours,
      remainingMinutes,
      formattedResult: result,
      showDeleted: showDeleted
    });
    
    return result;
  }, [items, calculatedWorkTimes, showDeleted]);

  // *** ДОБАВЛЕНО: Инициализация вычисленного времени и актуальных значений при загрузке элементов ***
  useEffect(() => {
    console.log('[SRSTable] Effect: items array changed. Calculating work times and initializing current values for all items.');
    const initialWorkTimes: Record<string, string> = {};
    const initialCurrentValues: Record<string, {
      startWork: { hours: string; minutes: string };
      finishWork: { hours: string; minutes: string };
      lunch: string;
    }> = {};

    items.forEach(item => {
      // Вычисляем время сразу при загрузке, а не берем из item.hours
      const calculatedTime = calculateSRSWorkTime(item);
      initialWorkTimes[item.id] = calculatedTime;
      
      // Инициализируем актуальные значения времени
      initialCurrentValues[item.id] = {
        startWork: item.startWork,
        finishWork: item.finishWork,
        lunch: item.lunch
      };
      
      console.log(`[SRSTable] Calculated time for item ${item.id}: ${calculatedTime} (was: ${item.hours})`);
    });
    
    setCalculatedWorkTimes(initialWorkTimes);
    setCurrentItemValues(initialCurrentValues);
  }, [items]);

  // *** ДОБАВЛЕНО: Функция для получения отображаемого времени работы ***
  const getDisplayWorkTime = useCallback((item: ISRSRecord): string => {
    if (calculatedWorkTimes[item.id]) {
      return calculatedWorkTimes[item.id];
    }
    return item.hours;
  }, [calculatedWorkTimes]);

  // *** НОВАЯ ФУНКЦИЯ: Получение актуальных значений времени для записи ***
  const getCurrentItemValues = useCallback((itemId: string): {
    startWork: { hours: string; minutes: string };
    finishWork: { hours: string; minutes: string };
    lunch: string;
  } => {
    return currentItemValues[itemId] || {
      startWork: { hours: '00', minutes: '00' },
      finishWork: { hours: '00', minutes: '00' },
      lunch: '0'
    };
  }, [currentItemValues]);

  // *** ИСПРАВЛЕНО: Обработчик показа диалога подтверждения добавления смены без Holiday проверки ***
  const showAddShiftConfirmDialog = useCallback((item: ISRSRecord): void => {
    console.log('[SRSTable] *** SHOW ADD SHIFT CONFIRM DIALOG WITHOUT HOLIDAY CHECK *** for item:', item.id);
    
    // Проверяем, что запись не удалена
    if (item.deleted) {
      console.warn('[SRSTable] Cannot add shift to deleted record');
      return;
    }

    console.log('[SRSTable] Setting up add shift dialog without Holiday field checks');

    setAddShiftConfirmDialog({
      isOpen: true,
      item: item,
      title: 'Confirm Add Shift',
      message: `Are you sure you want to add a new shift on ${item.date.toLocaleDateString()}?`
    });
  }, []);

  // *** ИСПРАВЛЕНО: Обработчик подтверждения добавления смены без Holiday поля ***
  const handleAddShiftConfirm = useCallback(async (): Promise<void> => {
    const { item } = addShiftConfirmDialog;
    console.log('[SRSTable] *** HANDLE ADD SHIFT CONFIRM WITHOUT HOLIDAY FIELD ***');
    console.log('[SRSTable] Item for shift creation:', item?.id);

    if (!item) {
      console.error('[SRSTable] No item selected for shift creation');
      setAddShiftConfirmDialog(prev => ({ ...prev, isOpen: false, item: null }));
      return;
    }

    // *** ПРОВЕРЯЕМ НАЛИЧИЕ onAddShift ПРОПСА ***
    if (!onAddShift) {
      console.error('[SRSTable] onAddShift handler not available - cannot create shift');
      alert('Add Shift functionality is not available. Please check component configuration.');
      setAddShiftConfirmDialog(prev => ({ ...prev, isOpen: false, item: null }));
      return;
    }

    try {
      console.log('[SRSTable] Preparing shift data for creation WITHOUT Holiday field...');

      // *** ИСПРАВЛЕНО: Создаем данные для новой смены без Holiday поля ***
      const shiftData: INewSRSShiftData = {
        date: new Date(item.date), // Та же дата
        timeForLunch: item.lunch,  // Используем время обеда из текущей записи
        contract: item.contract,   // Тот же контракт
        contractNumber: item.contract, // Используем contract как contractNumber
        typeOfLeave: item.typeOfLeave, // Тот же тип отпуска (если есть)
        // *** ИСПРАВЛЕНО: Holiday всегда 0 - не передаем значение из item ***
        Holiday: 0 // Всегда 0, так как праздники определяются из holidays list Date-only
      };

      console.log('[SRSTable] Shift data prepared for service call WITHOUT Holiday field checks (Date-only):', {
        date: shiftData.date.toISOString(),
        dateLocal: shiftData.date.toLocaleDateString(),
        timeForLunch: shiftData.timeForLunch,
        contract: shiftData.contract,
        contractNumber: shiftData.contractNumber,
        typeOfLeave: shiftData.typeOfLeave || 'none',
        Holiday: shiftData.Holiday + ' (always 0)',
        holidayDeterminedBy: 'holidays list Date-only, not Holiday field'
      });

      // *** РЕАЛЬНЫЙ ВЫЗОВ: onAddShift из пропсов ***
      console.log('[SRSTable] *** CALLING onAddShift HANDLER WITHOUT HOLIDAY CHECKS ***');
      console.log('[SRSTable] This will trigger StaffRecordsService.createStaffRecord via useSRSTabLogic');
      
      const success = await onAddShift(shiftData.date, shiftData);
      
      if (success) {
        console.log('[SRSTable] *** ADD SHIFT OPERATION SUCCESSFUL WITHOUT HOLIDAY CHECKS ***');
        console.log('[SRSTable] New shift created successfully, data will be auto-refreshed');
        
        // Показываем уведомление об успехе (опционально)
        // alert(`Shift added successfully on ${shiftData.date.toLocaleDateString()}!`);
        
      } else {
        console.error('[SRSTable] *** ADD SHIFT OPERATION FAILED ***');
        console.error('[SRSTable] onAddShift returned false - shift creation failed');
        
        // Показываем ошибку пользователю
        alert(`Failed to add shift on ${shiftData.date.toLocaleDateString()}. Please try again.`);
      }

      // Закрываем диалог в любом случае
      setAddShiftConfirmDialog(prev => ({ ...prev, isOpen: false, item: null }));

    } catch (error) {
      console.error('[SRSTable] Error during add shift operation:', error);
      
      // Показываем ошибку пользователю
      alert(`Error adding shift: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Закрываем диалог
      setAddShiftConfirmDialog(prev => ({ ...prev, isOpen: false, item: null }));
    }
  }, [addShiftConfirmDialog.item, onAddShift]);

  // *** ОБРАБОТЧИК: Отмена добавления смены (без изменений) ***
  const handleAddShiftCancel = useCallback((): void => {
    console.log('[SRSTable] Add shift dialog cancelled');
    setAddShiftConfirmDialog(prev => ({ ...prev, isOpen: false, item: null }));
  }, []);

  // *** ИСПРАВЛЕНО: Обработчик изменения времени с обновлением актуальных значений ***
  const handleTimeChange = useCallback((item: ISRSRecord, field: string, value: string | { hours: string; minutes: string }): void => {
    if (item.deleted) { return; }
    
    console.log(`[SRSTable] *** TIME CHANGE EVENT ***`);
    console.log(`[SRSTable] Item ID: ${item.id}`);
    console.log(`[SRSTable] Field: ${field}`);
    console.log(`[SRSTable] New value:`, value);
    
    // *** ИСПРАВЛЕНО: НЕ пересчитываем время для relief ***
    if (field === 'relief') {
      console.log(`[SRSTable] Relief change detected - no time recalculation needed`);
      onItemChange(item, field, value);
      return; // Выходим без пересчета времени
    }
    
    // *** ИСПРАВЛЕНО: НЕ пересчитываем время для других нетемпоральных полей ***
    const temporalFields = ['startWork', 'finishWork', 'lunch'];
    if (!temporalFields.includes(field)) {
      console.log(`[SRSTable] Non-temporal field ${field} changed - no time recalculation needed`);
      onItemChange(item, field, value);
      return; // Выходим без пересчета времени для других полей
    }
    
    // *** НОВОЕ: Получаем текущие актуальные значения для данной записи ***
    const currentValues = getCurrentItemValues(item.id);
    console.log(`[SRSTable] Current values for item ${item.id}:`, currentValues);
    
    // *** НОВОЕ: Обновляем актуальные значения с новым изменением ***
    const updatedCurrentValues = { ...currentValues };
    if (field === 'startWork' && typeof value === 'object') {
      updatedCurrentValues.startWork = value;
    } else if (field === 'finishWork' && typeof value === 'object') {
      updatedCurrentValues.finishWork = value;
    } else if (field === 'lunch') {
      updatedCurrentValues.lunch = value as string;
    }
    
    // *** НОВОЕ: Сохраняем обновленные актуальные значения ***
    setCurrentItemValues(prev => ({
      ...prev,
      [item.id]: updatedCurrentValues
    }));
    
    // Создаем обновленный элемент с актуальными значениями
    const updatedItem: ISRSRecord = {
      ...item,
      startWork: updatedCurrentValues.startWork,
      finishWork: updatedCurrentValues.finishWork,
      lunch: updatedCurrentValues.lunch
    };
    
    console.log(`[SRSTable] Updated item with current values before calculation:`, {
      startWork: updatedItem.startWork,
      finishWork: updatedItem.finishWork,
      lunch: updatedItem.lunch,
      relief: updatedItem.relief // Relief не должен влиять на расчет
    });
    
    // Пересчитываем время работы только для временных полей
    const timeFields = ['startWork', 'finishWork']; // НЕ включаем relief и typeOfLeave!
    if (timeFields.includes(field)) {
      const newWorkTime = calculateSRSWorkTime(updatedItem);
      console.log(`[SRSTable] *** CALCULATED NEW WORK TIME: ${newWorkTime} ***`);
      
      // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Обновляем локальное состояние вычисленного времени ***
      setCalculatedWorkTimes(prev => {
        const newTimes = {
          ...prev,
          [item.id]: newWorkTime
        };
        console.log(`[SRSTable] Updated calculatedWorkTimes for item ${item.id}:`, {
          oldTime: prev[item.id],
          newTime: newWorkTime,
          totalHoursWillRecalculate: true // *** Total Hours пересчитается автоматически! ***
        });
        return newTimes;
      });
      
      // Вызываем родительский обработчик БЕЗ принудительного обновления totalHours
      console.log(`[SRSTable] Calling parent onItemChange for field: ${field}`);
      onItemChange(updatedItem, field, value);
      
      console.log(`[SRSTable] *** TIME CHANGE COMPLETE WITH REAL-TIME TOTAL HOURS ***`);
    }
  }, [calculatedWorkTimes, onItemChange, getCurrentItemValues]);

  // *** ИСПРАВЛЕНО: Обработчик изменения времени обеда с использованием актуальных значений ***
  const handleLunchTimeChange = useCallback((item: ISRSRecord, value: string): void => {
    if (item.deleted) { return; }
    
    console.log(`[SRSTable] *** LUNCH TIME CHANGE WITH REAL-TIME TOTAL HOURS ***`);
    console.log(`[SRSTable] handleLunchTimeChange called for item ${item.id}, value: ${value}`);
    
    // *** НОВОЕ: Получаем актуальные значения времени ***
    const currentValues = getCurrentItemValues(item.id);
    console.log(`[SRSTable] Current values for lunch calculation:`, currentValues);
    
    // *** ИСПРАВЛЕНО: Создаем updatedItem с АКТУАЛЬНЫМИ значениями времени ***
    const updatedItem: ISRSRecord = {
      ...item,
      startWork: currentValues.startWork,    // *** АКТУАЛЬНЫЕ ЗНАЧЕНИЯ ***
      finishWork: currentValues.finishWork,  // *** АКТУАЛЬНЫЕ ЗНАЧЕНИЯ ***
      lunch: value                          // *** НОВОЕ ЗНАЧЕНИЕ ОБЕДА ***
    };
    
    // *** НОВОЕ: Обновляем актуальные значения с новым временем обеда ***
    setCurrentItemValues(prev => ({
      ...prev,
      [item.id]: {
        ...currentValues,
        lunch: value
      }
    }));
    
    // Пересчитываем время работы с актуальными значениями
    const workTime = calculateSRSWorkTime(updatedItem);
    
    console.log(`[SRSTable] *** LUNCH RECALCULATION WITH REAL-TIME TOTAL ***:`, {
      itemId: item.id,
      actualStartTime: `${currentValues.startWork.hours}:${currentValues.startWork.minutes}`,
      actualFinishTime: `${currentValues.finishWork.hours}:${currentValues.finishWork.minutes}`,
      newLunchValue: value,
      recalculatedTime: workTime,
      previousTime: calculatedWorkTimes[item.id],
      totalHoursWillUpdate: true // *** Total Hours обновится автоматически! ***
    });
    
    // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Обновляем локальное состояние вычисленного времени ***
    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));
    
    // Вызываем родительские обработчики БЕЗ принудительного обновления totalHours
    onLunchTimeChange(updatedItem, value);
    
    console.log(`[SRSTable] *** LUNCH TIME CHANGE COMPLETE WITH REAL-TIME TOTAL ***`);
  }, [calculatedWorkTimes, onLunchTimeChange, getCurrentItemValues]);

  // *** НОВЫЙ ОБРАБОТЧИК: Изменение типа отпуска ***
  const handleTypeOfLeaveChange = useCallback((item: ISRSRecord, value: string): void => {
    if (item.deleted) { return; }
    
    console.log(`[SRSTable] *** TYPE OF LEAVE CHANGE ***`);
    console.log(`[SRSTable] Item ID: ${item.id}`);
    console.log(`[SRSTable] Old type of leave: "${item.typeOfLeave}"`);
    console.log(`[SRSTable] New type of leave: "${value}"`);
    
    // Находим информацию о типе отпуска в опциях
    const selectedLeaveType = options.leaveTypes.find(option => option.key === value);
    if (selectedLeaveType) {
      console.log(`[SRSTable] Selected leave type details:`, {
        key: selectedLeaveType.key,
        text: selectedLeaveType.text,
        data: selectedLeaveType.data
      });
    }
    
    // *** ВАЖНО: Типы отпусков НЕ влияют на время работы ***
    console.log(`[SRSTable] Type of leave change does NOT affect work time calculation`);
    
    // Вызываем специальный обработчик типов отпусков если доступен
    if (onTypeOfLeaveChange) {
      console.log(`[SRSTable] Calling onTypeOfLeaveChange handler`);
      onTypeOfLeaveChange(item, value);
    } else {
      // Fallback к общему обработчику
      console.log(`[SRSTable] Using fallback onItemChange for typeOfLeave`);
      onItemChange(item, 'typeOfLeave', value);
    }
    
    console.log(`[SRSTable] *** TYPE OF LEAVE CHANGE COMPLETE ***`);
  }, [options.leaveTypes, onTypeOfLeaveChange, onItemChange]);

  // *** ОБРАБОТЧИК: Изменение номера контракта ***
  const handleContractNumberChange = useCallback((item: ISRSRecord, value: string): void => {
    if (item.deleted) { return; }
    
    console.log(`[SRSTable] Contract number change for item ${item.id}: ${item.contract} -> ${value}`);
    onContractNumberChange(item, value);
  }, [onContractNumberChange]);

  // *** ИСПРАВЛЕНО: Обработчик переключения отображения удаленных записей ***
  const handleToggleShowDeleted = useCallback((ev?: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    console.log('[SRSTable] *** HANDLE TOGGLE SHOW DELETED WITH REAL-TIME TOTAL RECALC ***');
    console.log('[SRSTable] Show deleted toggle changed:', checked);
    console.log('[SRSTable] onToggleShowDeleted handler available:', !!onToggleShowDeleted);
    console.log('[SRSTable] Total Hours will recalculate automatically based on new filter');
    
    if (checked !== undefined && onToggleShowDeleted) {
      console.log('[SRSTable] Calling parent onToggleShowDeleted handler');
      onToggleShowDeleted(checked);
    } else {
      console.warn('[SRSTable] onToggleShowDeleted handler not available or checked value undefined');
    }
  }, [onToggleShowDeleted]);

  // Helper function to check if this is the first row with a new date
  const isFirstRowWithNewDate = (items: typeof props.items, index: number): boolean => {
    if (index === 0) return true; // First row always starts a new date
    
    // *** УПРОЩЕНО: Сравниваем даты без нормализации времени для Date-only формата ***
    const currentDate = items[index].date;
    const previousDate = items[index - 1].date;
    
    // Сравниваем только компоненты даты (год, месяц, день)
    return (
      currentDate.getFullYear() !== previousDate.getFullYear() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getDate() !== previousDate.getDate()
    );
  };

  // Helper function to determine row position within date group
  const getRowPositionInDate = (items: typeof props.items, index: number): number => {
    if (index === 0) return 0; // First row always has position 0
    
    const currentDate = items[index].date;
    let position = 0;
    
    // Count how many rows with the same date were before current one (including deleted)
    for (let i = 0; i < index; i++) {
      const itemDate = items[i].date;
      
      // *** УПРОЩЕНО: Сравниваем компоненты даты без нормализации для Date-only формата ***
      if (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      ) {
        position++;
      }
    }
    
    return position;
  };

  // Helper function to calculate total hours for date (only for non-deleted rows)
  const calculateTotalHoursForDate = (items: typeof props.items, index: number): string => {
    const currentDate = items[index].date;
    
    // Find all rows with the same date
    const sameDateRows = items.filter(item => {
      const itemDate = item.date;
      // *** УПРОЩЕНО: Сравниваем компоненты даты для Date-only формата ***
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      );
    });
    
    // Calculate total time, adding work time only from non-deleted shifts
    let totalHours = 0;
    let totalMinutes = 0;
    
    sameDateRows.forEach(item => {
      // Skip deleted records
      if (item.deleted === true) {
        return;
      }
      
      // *** ИСПРАВЛЕНО: Используем вычисленное время, а не item.hours из API ***
      const workTime = getDisplayWorkTime(item);
      const [hoursStr, minutesStr] = workTime.split('.');
      
      const hours = parseInt(hoursStr, 10) || 0;
      const minutes = parseInt(minutesStr, 10) || 0;
      
      totalHours += hours;
      totalMinutes += minutes;
    });
    
    // Convert excess minutes to hours
    if (totalMinutes >= 60) {
      totalHours += Math.floor(totalMinutes / 60);
      totalMinutes = totalMinutes % 60;
    }
    
    return `Total: ${totalHours}h:${totalMinutes.toString().padStart(2, '0')}m`;
  };

  // Helper function to count total rows (including deleted) in date group
  const countTotalRowsInDate = (items: typeof props.items, index: number): number => {
    const currentDate = items[index].date;
    
    // Count all rows with the same date
    return items.filter(item => {
      const itemDate = item.date;
      
      // *** УПРОЩЕНО: Сравниваем компоненты даты для Date-only формата ***
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      );
    }).length;
  };

  // ИСПРАВЛЕНО: Функция `getRecordsStatistics` удалена, так как переменная `recordsStats` больше не используется

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        <Spinner size={SpinnerSize.large} label="Loading SRS data..." />
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: SRSFilterControls теперь получает вычисленное значение *** */}
      <SRSFilterControls
        fromDate={fromDate}
        toDate={toDate}
        calculatedTotalHours={calculateCurrentTotalHours} // *** НОВОЕ: Вычисленное значение вместо totalHours ***
        isLoading={isLoading}
        onFromDateChange={onFromDateChange}
        onToDateChange={onToDateChange}
        onRefresh={onRefresh}
        onExportAll={onExportAll}
        onSave={onSave}
        onSaveChecked={onSaveChecked}
        hasChanges={hasChanges}
        hasCheckedItems={hasCheckedItems}
      />

      {/* Таблица с переключателем Show deleted */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        {/* *** ИСПРАВЛЕНО: Единственный заголовок с переключателем Show deleted *** */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 0',
          borderBottom: '1px solid #edebe9',
          marginBottom: '10px'
        }}>
          {/* *** ИСПРАВЛЕНО: Переключатель Show deleted - Toggle вместо Checkbox *** */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Toggle
              label="Show deleted"
              checked={showDeleted}
              onChange={handleToggleShowDeleted}
              disabled={isLoading}
              onText="On"
              offText="Off"
              styles={{
                root: { marginRight: '10px' },
                label: { fontSize: '14px', fontWeight: '600' }
              }}
            />
          </div>
          
          {/* Блок с информацией был полностью удален */}

        </div>

        <table style={{ 
          borderSpacing: '0', 
          borderCollapse: 'collapse', 
          width: '100%', 
          tableLayout: 'fixed',
          border: '1px solid #edebe9'
        }}>
          <colgroup>
            <col style={{ width: '100px' }} /> {/* Date */}
            <col style={{ width: '60px' }} />  {/* Hrs */}
            <col style={{ width: '60px' }} />  {/* Relief? */}
            <col style={{ width: '150px' }} /> {/* Start Work */}
            <col style={{ width: '150px' }} /> {/* Finish Work */}
            <col style={{ width: '100px' }} /> {/* Lunch */}
            <col style={{ width: '150px' }} /> {/* Type of Leave */}
            <col style={{ width: '100px' }} /> {/* Time Leave (h) */}
            <col style={{ width: '70px' }} />  {/* Shift */}
            <col style={{ width: '60px' }} />  {/* Contract */}
            <col style={{ width: '50px' }} />  {/* Check */}
            <col style={{ width: '50px' }} />  {/* SRS */}
            {/* *** НОВОЕ: Добавлена колонка для удаления/восстановления *** */}
            <col style={{ width: '80px' }} />  {/* Delete/Restore + ID */}
          </colgroup>

          <thead>
            <tr>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'left',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Date</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Hours</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Relief</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Start Work</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Finish Work</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Lunch</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Type of Leave</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Time Leave (h)</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Shift</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Contract</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Check</th>
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>SRS</th>
              {/* *** НОВОЕ: Заголовок для колонки удаления *** */}
              <th style={{ 
                backgroundColor: '#f3f3f3',
                padding: '8px',
                textAlign: 'center',
                fontWeight: '600',
                fontSize: '12px',
                border: '1px solid #edebe9'
              }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td 
                  colSpan={13} // *** ОБНОВЛЕНО: Увеличено с 12 до 13 колонок ***
                  style={{
                    textAlign: 'center',
                    padding: '40px',
                    fontSize: '14px',
                    color: '#666',
                    fontStyle: 'italic',
                    border: '1px solid #edebe9'
                  }}
                >
                  No SRS records found for the selected date range.
                  <br />
                  Please adjust the date range and click Refresh.
                  {/* *** НОВОЕ: Информация о типах отпусков *** */}
                  <br />
                  <small style={{ color: '#888', marginTop: '10px', display: 'block' }}>
                    {options.leaveTypes.length > 0 
                      ? `${options.leaveTypes.length - 1} types of leave available` 
                      : 'Loading types of leave...'}
                  </small>
                  
                  {/* *** НОВОЕ: Информация о праздниках из списка Date-only *** */}
                  <br />
                  <small style={{ color: '#ff69b4', marginTop: '5px', display: 'block' }}>
                    {holidays.length > 0 
                      ? `${holidays.length} holidays loaded from holidays list (Date-only)` 
                      : 'Loading holidays from list...'}
                  </small>
                  
                  {/* *** ИСПРАВЛЕНО: Информация о фильтре удаленных с обязательным showDeleted *** */}
                  <br />
                  <small style={{ color: '#888', marginTop: '5px', display: 'block' }}>
                    {showDeleted 
                      ? 'Showing all records including deleted ones' 
                      : 'Hiding deleted records (use "Show deleted" to see all)'}
                  </small>
                  {/* *** ИСПРАВЛЕНО: Информация о функционале добавления смены без Holiday проверки *** */}
                  <br />
                  <small style={{ color: '#107c10', marginTop: '5px', display: 'block' }}>
                    Use +Shift button to add new SRS records (no Holiday field checks, Date-only)
                  </small>
                  {/* *** НОВОЕ: Информация о Real-time Total Hours *** */}
                  <br />
                  <small style={{ color: '#0078d4', marginTop: '5px', display: 'block' }}>
                    Total Hours: {calculateCurrentTotalHours} (Real-time calculation)
                  </small>
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <React.Fragment key={item.id}>
                  {/* Add blue line before rows with new date */}
                  {isFirstRowWithNewDate(items, index) && (
                    <tr style={{ height: '1px', padding: 0 }}>
                      <td colSpan={13} style={{ // *** ОБНОВЛЕНО: Увеличено с 12 до 13 колонок ***
                        backgroundColor: '#0078d4', 
                        height: '1px',
                        padding: 0,
                        border: 'none'
                      }} />
                    </tr>
                  )}
                  
                  <SRSTableRow
                    key={item.id}
                    item={item}
                    options={options}
                    // *** НОВОЕ: Передаем holidays список для определения праздников Date-only ***
                    holidays={holidays}
                    isEven={index % 2 === 0}
                    rowPositionInDate={getRowPositionInDate(items, index)}
                    totalTimeForDate={calculateTotalHoursForDate(items, index)}
                    totalRowsInDate={countTotalRowsInDate(items, index)}
                    displayWorkTime={getDisplayWorkTime(item)} // *** ПЕРЕДАЕМ ВЫЧИСЛЕННОЕ ВРЕМЯ ***
                    isTimesEqual={checkSRSStartEndTimeSame(item)}
                    onItemChange={handleTimeChange} // *** ИСПОЛЬЗУЕМ НАШИ ОБРАБОТЧИКИ С ПРОВЕРКОЙ НА RELIEF ***
                    onLunchTimeChange={handleLunchTimeChange} // *** ИСПОЛЬЗУЕМ НАШИ ОБРАБОТЧИКИ С АКТУАЛЬНЫМИ ЗНАЧЕНИЯМИ ***
                    onContractNumberChange={handleContractNumberChange}
                    // *** НОВОЕ: Передаем обработчик типов отпусков ***
                    onTypeOfLeaveChange={handleTypeOfLeaveChange}
                    // *** НОВОЕ: Передаем обработчики удаления/восстановления ***
                    showDeleteConfirmDialog={showDeleteConfirmDialog}
                    showRestoreConfirmDialog={showRestoreConfirmDialog}
                    onDeleteItem={onDeleteItem}
                    onRestoreItem={onRestoreItem}
                    // *** ИСПРАВЛЕНО: Передаем обработчик добавления смены без Holiday проверки ***
                    showAddShiftConfirmDialog={showAddShiftConfirmDialog}
                    // *** НОВОЕ: Передаем обработчик checkbox функциональности ***
                    onItemCheck={onItemCheck}
                  />
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>

        {/* *** ИСПРАВЛЕНО: Диалог подтверждения добавления смены без Holiday проверки *** */}
        {addShiftConfirmDialog.isOpen && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.4)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '4px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ 
                margin: '0 0 16px 0', 
                fontSize: '18px', 
                fontWeight: '600',
                color: '#323130'
              }}>
                {addShiftConfirmDialog.title}
              </h3>
              
              <p style={{ 
                margin: '0 0 24px 0', 
                fontSize: '14px', 
                lineHeight: '1.4',
                color: '#605e5c'
              }}>
                {addShiftConfirmDialog.message}
                {/* *** ИСПРАВЛЕНО: Дополнительная информация о создании без Holiday проверки *** */}
                <br />
                <small style={{ color: '#888', marginTop: '8px', display: 'block' }}>
                  New shift will be created with 00:00-00:00 time and Holiday=0. Holidays are determined automatically from holidays list (Date-only).
                </small>
              </p>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px'
              }}>
                <button
                  onClick={handleAddShiftCancel}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d1d1d1',
                    backgroundColor: 'white',
                    color: '#323130',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  Cancel
                </button>
                
                <button
                  onClick={handleAddShiftConfirm}
                  style={{
                    padding: '8px 16px',
                    border: 'none',
                    backgroundColor: '#107c10',
                    color: 'white',
                    borderRadius: '2px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Add Shift
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};