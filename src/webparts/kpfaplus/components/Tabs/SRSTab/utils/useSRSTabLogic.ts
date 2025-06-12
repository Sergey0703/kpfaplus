// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSTabLogic.ts

import { useCallback, useMemo, useState } from 'react';
import { ITabProps } from '../../../../models/types';
import { ISRSTabState, useSRSTabState, SRSTabStateHelpers } from './useSRSTabState';
import { useSRSData } from './useSRSData';
import { SRSDateUtils } from './SRSDateUtils';
import { ISRSRecord } from './SRSTabInterfaces';
import { calculateSRSWorkTime } from './SRSTimeCalculationUtils';

/**
 * Интерфейс для возвращаемых значений главного хука useSRSTabLogic
 */
export interface UseSRSTabLogicReturn extends ISRSTabState {
  // Обработчики дат
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
  
  // Обработчики данных
  onRefreshData: () => void;
  onExportAll: () => void;
  
  // Обработчики сохранения
  onSave: () => void;
  onSaveChecked: () => void;
  
  // Обработчики ошибок
  onErrorDismiss: () => void;
  
  // Обработчики выбора элементов
  onItemCheck: (itemId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  
  // Обработчики изменения элементов таблицы
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  
  // Вычисляемые значения
  hasCheckedItems: boolean;
  selectedItemsCount: number;
  
  // Функции для работы с данными
  loadSRSData: () => Promise<void>;
  isDataValid: boolean;
}

/**
 * Главный оркестрирующий хук для SRS Tab
 * Координирует состояние, загрузку данных и обработчики событий
 * Упрощенная версия по сравнению с ScheduleTab - только SRS функциональность
 */
export const useSRSTabLogic = (props: ITabProps): UseSRSTabLogicReturn => {
  const { selectedStaff, context, currentUserId, managingGroupId } = props;

  console.log('[useSRSTabLogic] Orchestrator hook initialized with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffEmployeeId: selectedStaff?.employeeId,
    hasContext: !!context,
    currentUserId,
    managingGroupId
  });

  // Инициализируем состояние SRS Tab
  const { state, setState } = useSRSTabState();

  // Локальное состояние для отслеживания изменений в таблице
  const [modifiedRecords, setModifiedRecords] = useState<Map<string, Partial<ISRSRecord>>>(new Map());

  // Инициализируем хук загрузки SRS данных
  const { loadSRSData, refreshSRSData, isDataValid } = useSRSData({
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    fromDate: state.fromDate,
    toDate: state.toDate,
    setState
  });

  // ===============================================
  // ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ДАТ
  // ===============================================

  /**
   * Обработчик изменения даты "От"
   * Автоматически обновляет дату "До" если необходимо
   */
  const handleFromDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useSRSTabLogic] handleFromDateChange called with date:', date?.toISOString());
    
    if (!date) {
      console.log('[useSRSTabLogic] No date provided to handleFromDateChange');
      return;
    }

    // Нормализуем новую дату
    const normalizedFromDate = SRSDateUtils.calculateWeekRange(date).start;
    console.log('[useSRSTabLogic] Normalized fromDate:', normalizedFromDate.toISOString());

    // Проверяем, нужно ли обновить toDate
    const shouldUpdateTo = SRSDateUtils.shouldUpdateToDate(normalizedFromDate, state.toDate);
    
    if (shouldUpdateTo) {
      // Автоматически рассчитываем новую toDate
      const newToDate = SRSDateUtils.getWeekEndAfterDate(normalizedFromDate);
      console.log('[useSRSTabLogic] Auto-updating toDate to:', newToDate.toISOString());
      
      // Обновляем обе даты одновременно
      SRSTabStateHelpers.updateDates(setState, normalizedFromDate, newToDate);
    } else {
      // Обновляем только fromDate
      console.log('[useSRSTabLogic] Keeping current toDate, only updating fromDate');
      SRSTabStateHelpers.updateDates(setState, normalizedFromDate, state.toDate);
    }

    // Очищаем локальные изменения при смене дат
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
  }, [state.toDate, setState]);

  /**
   * Обработчик изменения даты "До"
   * Валидирует, что toDate не раньше fromDate
   */
  const handleToDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useSRSTabLogic] handleToDateChange called with date:', date?.toISOString());
    
    if (!date) {
      console.log('[useSRSTabLogic] No date provided to handleToDateChange');
      return;
    }

    // Нормализуем новую дату к концу дня
    const normalizedToDate = SRSDateUtils.calculateWeekRange(date).end;
    console.log('[useSRSTabLogic] Normalized toDate:', normalizedToDate.toISOString());

    // Проверяем, что toDate не раньше fromDate
    if (normalizedToDate < state.fromDate) {
      console.warn('[useSRSTabLogic] toDate cannot be before fromDate, adjusting fromDate');
      
      // Если toDate раньше fromDate, корректируем fromDate
      const newFromDate = SRSDateUtils.calculateWeekRange(normalizedToDate).start;
      SRSTabStateHelpers.updateDates(setState, newFromDate, normalizedToDate);
    } else {
      // Обновляем только toDate
      SRSTabStateHelpers.updateDates(setState, state.fromDate, normalizedToDate);
    }

    // Очищаем локальные изменения при смене дат
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
  }, [state.fromDate, setState]);

  // ===============================================
  // ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ЭЛЕМЕНТОВ ТАБЛИЦЫ
  // ===============================================

  /**
   * Обработчик изменения элементов таблицы
   * Обновляет локальное состояние изменений для немедленного отображения
   * *** ФИНАЛЬНОЕ ИСПРАВЛЕНИЕ: Правильная обработка всех полей, включая relief ***
   */
  const handleItemChange = useCallback((item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }): void => {
    console.log('[useSRSTabLogic] *** HANDLE ITEM CHANGE ***');
    console.log('[useSRSTabLogic] Item ID:', item.id);
    console.log('[useSRSTabLogic] Field:', field);
    console.log('[useSRSTabLogic] Value:', value);
    console.log('[useSRSTabLogic] Value type:', typeof value);
    
    // Создаем обновленную запись
    let updatedItem = { ...item };
    
    // *** ИСПРАВЛЕНО: Обрабатываем различные типы полей с правильной логикой пересчета ***
    if (field === 'startWork' && typeof value === 'object') {
      updatedItem.startWork = value;
      console.log('[useSRSTabLogic] Updated startWork:', value);
    } else if (field === 'finishWork' && typeof value === 'object') {
      updatedItem.finishWork = value;
      console.log('[useSRSTabLogic] Updated finishWork:', value);
    } else if (field === 'relief') {
      // *** ИСПРАВЛЕНО: Relief НЕ влияет на время работы ***
      updatedItem.relief = value as boolean;
      console.log('[useSRSTabLogic] Updated relief (NO time recalculation):', value);
    } else if (field === 'workingHours') {
      // *** ИСПРАВЛЕНО: workingHours приходит уже вычисленным из SRSTable ***
      updatedItem.hours = value as string;
      console.log('[useSRSTabLogic] Updated workingHours directly (pre-calculated):', value);
    } else if (field === 'typeOfLeave') {
      updatedItem.typeOfLeave = value as string;
      console.log('[useSRSTabLogic] Updated typeOfLeave:', value);
    } else if (field === 'timeLeave') {
      updatedItem.timeLeave = value as string;
      console.log('[useSRSTabLogic] Updated timeLeave:', value);
    } else {
      // Для других полей используем прямое присвоение с проверкой типа
      (updatedItem as any)[field] = value;
      console.log('[useSRSTabLogic] Updated field', field, 'with value:', value);
    }
    
    // *** ИСПРАВЛЕНО: Пересчитываем время ТОЛЬКО для временных полей (НЕ для relief и workingHours) ***
    const timeFields = ['startWork', 'finishWork']; // НЕ включаем relief!
    if (timeFields.includes(field)) {
      const newWorkTime = calculateSRSWorkTime(updatedItem);
      updatedItem.hours = newWorkTime;
      console.log('[useSRSTabLogic] *** TIME RECALCULATED ***:', {
        itemId: item.id,
        field,
        newValue: value,
        calculatedTime: newWorkTime,
        reliefStatus: updatedItem.relief // Показываем, что relief не влияет
      });
    } else {
      console.log('[useSRSTabLogic] *** NO TIME RECALCULATION *** for field:', field);
    }
    
    // Сохраняем изменения в локальном состоянии
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      
      // Объединяем существующие изменения с новыми
      const newModifications: any = { ...existingModifications };
      
      if (field === 'startWork') {
        newModifications.startWork = updatedItem.startWork;
      } else if (field === 'finishWork') {
        newModifications.finishWork = updatedItem.finishWork;
      } else if (field === 'workingHours') {
        newModifications.hours = value as string;
      } else if (field === 'relief') {
        // *** ИСПРАВЛЕНО: Сохраняем relief без пересчета времени ***
        newModifications.relief = value as boolean;
        console.log('[useSRSTabLogic] Saved relief change without time recalculation');
      } else if (field === 'typeOfLeave') {
        newModifications.typeOfLeave = value as string;
      } else if (field === 'timeLeave') {
        newModifications.timeLeave = value as string;
      } else {
        newModifications[field] = value;
      }
      
      // Если пересчитали время, добавляем и его
      if (timeFields.includes(field)) {
        newModifications.hours = updatedItem.hours;
        console.log('[useSRSTabLogic] Saved recalculated hours:', updatedItem.hours);
      }
      
      newModified.set(item.id, newModifications);
      return newModified;
    });
    
    // Помечаем как измененное
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSTabLogic] *** ITEM CHANGE COMPLETE ***');
    console.log('[useSRSTabLogic] Modified records count:', modifiedRecords.size + 1);
  }, [setState, modifiedRecords.size]);

  /**
   * Обработчик изменения времени обеда
   * *** ИСПРАВЛЕНО: Не пересчитывает время локально, полагается на SRSTable ***
   */
  const handleLunchTimeChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] handleLunchTimeChange:', { itemId: item.id, value });
    
    // *** ИСПРАВЛЕНО: Не пересчитываем время здесь - это делает SRSTable ***
    // SRSTable.handleLunchTimeChange уже пересчитал время и вызовет handleItemChange с 'workingHours'
    
    // Сохраняем только изменение времени обеда в локальном состоянии
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      newModified.set(item.id, {
        ...existingModifications,
        lunch: value
        // hours будет добавлено отдельным вызовом handleItemChange с 'workingHours'
      });
      return newModified;
    });
    
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSTabLogic] Lunch time change applied, waiting for workingHours update from SRSTable');
  }, [setState]);

  /**
   * Обработчик изменения номера контракта
   */
  const handleContractNumberChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] handleContractNumberChange:', { itemId: item.id, value });
    
    // Сохраняем изменения в локальном состоянии
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      newModified.set(item.id, {
        ...existingModifications,
        contract: value
      });
      return newModified;
    });
    
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSTabLogic] Contract number change applied to local state');
  }, [setState]);

  // ===============================================
  // ОСТАЛЬНЫЕ ОБРАБОТЧИКИ
  // ===============================================

  /**
   * Обработчик принудительного обновления данных
   */
  const handleRefreshData = useCallback((): void => {
    console.log('[useSRSTabLogic] Manual refresh requested');
    // Очищаем локальные изменения при обновлении
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    void refreshSRSData();
  }, [refreshSRSData, setState]);

  /**
   * Обработчик экспорта всех SRS данных
   */
  const handleExportAll = useCallback((): void => {
    console.log('[useSRSTabLogic] Export all SRS data requested');
    console.log('[useSRSTabLogic] Current SRS records count:', state.srsRecords.length);
    
    if (state.srsRecords.length === 0) {
      console.warn('[useSRSTabLogic] No SRS records to export');
      return;
    }

    console.log('[useSRSTabLogic] Exporting SRS records:', {
      recordsCount: state.srsRecords.length,
      totalHours: state.totalHours,
      dateRange: `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`
    });

    // TODO: Реализовать экспорт SRS данных
    alert(`Export functionality will be implemented. Records to export: ${state.srsRecords.length}`);
  }, [state.srsRecords, state.totalHours, state.fromDate, state.toDate]);

  /**
   * Обработчик сохранения всех изменений
   */
  const handleSave = useCallback((): void => {
    console.log('[useSRSTabLogic] Save all changes requested');
    
    if (!state.hasUnsavedChanges) {
      console.log('[useSRSTabLogic] No unsaved changes to save');
      return;
    }

    console.log('[useSRSTabLogic] Saving changes for modified records:', {
      modifiedRecordsCount: modifiedRecords.size,
      modifiedIds: Array.from(modifiedRecords.keys())
    });
    
    // Логируем детали изменений для отладки (включая relief)
    modifiedRecords.forEach((modifications, itemId) => {
      console.log(`[useSRSTabLogic] Modified record ${itemId}:`, modifications);
      if ('relief' in modifications) {
        console.log(`[useSRSTabLogic] Record ${itemId} has relief change:`, modifications.relief);
      }
    });
    
    // TODO: Реализовать сохранение изменений через StaffRecordsService
    // Пока что заглушка
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    console.log('[useSRSTabLogic] Changes saved successfully (mock)');
  }, [state.hasUnsavedChanges, modifiedRecords, setState]);

  /**
   * Обработчик сохранения только отмеченных записей
   */
  const handleSaveChecked = useCallback((): void => {
    console.log('[useSRSTabLogic] Save checked items requested');
    
    if (state.selectedItems.size === 0) {
      console.log('[useSRSTabLogic] No items selected for saving');
      return;
    }

    const selectedIds = Array.from(state.selectedItems);
    console.log('[useSRSTabLogic] Saving changes for selected records:', selectedIds);
    
    // Фильтруем только изменения для выбранных записей
    const selectedModifications = new Map();
    selectedIds.forEach(id => {
      if (modifiedRecords.has(id)) {
        selectedModifications.set(id, modifiedRecords.get(id));
      }
    });
    
    console.log('[useSRSTabLogic] Selected modifications to save:', {
      selectedCount: selectedIds.length,
      modifiedSelectedCount: selectedModifications.size
    });
    
    // TODO: Реализовать сохранение выбранных записей
    // Пока что заглушка
    SRSTabStateHelpers.clearSelection(setState);
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    // Удаляем сохраненные изменения из локального состояния
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      selectedIds.forEach(id => newModified.delete(id));
      return newModified;
    });
    
    console.log('[useSRSTabLogic] Selected records saved successfully (mock)');
  }, [state.selectedItems, setState, modifiedRecords]);

  /**
   * Обработчик закрытия ошибок
   */
  const handleErrorDismiss = useCallback((): void => {
    console.log('[useSRSTabLogic] Error dismiss requested');
    
    setState(prevState => ({
      ...prevState,
      error: undefined,
      errorSRS: undefined
    }));
  }, [setState]);

  /**
   * Обработчик выбора/снятия выбора отдельного элемента
   */
  const handleItemCheck = useCallback((itemId: string, checked: boolean): void => {
    console.log('[useSRSTabLogic] Item check changed:', { itemId, checked });
    
    SRSTabStateHelpers.toggleItemSelection(setState, itemId);
    
    // Помечаем как измененное (если нужно)
    if (!state.hasUnsavedChanges) {
      SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    }
  }, [setState, state.hasUnsavedChanges]);

  /**
   * Обработчик выбора/снятия выбора всех элементов
   */
  const handleSelectAll = useCallback((checked: boolean): void => {
    console.log('[useSRSTabLogic] Select all changed:', checked);
    
    if (checked) {
      SRSTabStateHelpers.selectAll(setState);
    } else {
      SRSTabStateHelpers.clearSelection(setState);
    }
  }, [setState]);

  // ===============================================
  // ВЫЧИСЛЯЕМЫЕ ЗНАЧЕНИЯ
  // ===============================================

  /**
   * Проверяет, есть ли отмеченные элементы
   */
  const hasCheckedItems = useMemo((): boolean => {
    return state.selectedItems.size > 0;
  }, [state.selectedItems.size]);

  /**
   * Количество выбранных элементов
   */
  const selectedItemsCount = useMemo((): number => {
    return state.selectedItems.size;
  }, [state.selectedItems.size]);

  // ===============================================
  // ВОЗВРАЩАЕМЫЙ ОБЪЕКТ
  // ===============================================

  const hookReturn: UseSRSTabLogicReturn = useMemo(() => ({
    // Распространяем все свойства состояния
    ...state,
    
    // Обработчики дат
    onFromDateChange: handleFromDateChange,
    onToDateChange: handleToDateChange,
    
    // Обработчики данных
    onRefreshData: handleRefreshData,
    onExportAll: handleExportAll,
    
    // Обработчики сохранения
    onSave: handleSave,
    onSaveChecked: handleSaveChecked,
    
    // Обработчики ошибок
    onErrorDismiss: handleErrorDismiss,
    
    // Обработчики выбора
    onItemCheck: handleItemCheck,
    onSelectAll: handleSelectAll,
    
    // Обработчики изменения элементов таблицы
    onItemChange: handleItemChange,
    onLunchTimeChange: handleLunchTimeChange,
    onContractNumberChange: handleContractNumberChange,
    
    // Вычисляемые значения
    hasCheckedItems,
    selectedItemsCount,
    
    // Функции работы с данными
    loadSRSData,
    isDataValid
  }), [
    state,
    handleFromDateChange,
    handleToDateChange,
    handleRefreshData,
    handleExportAll,
    handleSave,
    handleSaveChecked,
    handleErrorDismiss,
    handleItemCheck,
    handleSelectAll,
    handleItemChange,
    handleLunchTimeChange,
    handleContractNumberChange,
    hasCheckedItems,
    selectedItemsCount,
    loadSRSData,
    isDataValid
  ]);

  console.log('[useSRSTabLogic] Hook return object prepared with computed values:', {
    recordsCount: state.srsRecords.length,
    totalHours: state.totalHours,
    hasCheckedItems,
    selectedItemsCount,
    isDataValid,
    hasUnsavedChanges: state.hasUnsavedChanges,
    isLoading: state.isLoadingSRS,
    modifiedRecordsCount: modifiedRecords.size
  });

  return hookReturn;
};