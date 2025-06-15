// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSTabLogic.ts

import { useCallback, useMemo, useState } from 'react';
import { ITabProps } from '../../../../models/types';
import { ISRSTabState, useSRSTabState, SRSTabStateHelpers } from './useSRSTabState';
import { useSRSData } from './useSRSData';
import { useTypesOfLeave } from './useTypesOfLeave';
import { useHolidays } from './useHolidays';
import { SRSDateUtils } from './SRSDateUtils';
import { ISRSRecord } from './SRSTabInterfaces';
import { calculateSRSWorkTime } from './SRSTimeCalculationUtils';
import { StaffRecordsService } from '../../../../services/StaffRecordsService'; // *** КЛЮЧЕВОЙ ИМПОРТ ***

/**
 * Интерфейс для возвращаемых значений главного хука useSRSTabLogic
 * ОБНОВЛЕНО: Добавлены праздники, showDeleted и РЕАЛЬНЫЙ delete/restore функциональность
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
  onTypeOfLeaveChange: (item: ISRSRecord, value: string) => void;
  
  // *** РЕАЛЬНЫЕ ОБРАБОТЧИКИ: Удаление/восстановление через StaffRecordsService ***
  onDeleteRecord: (recordId: string) => Promise<boolean>;
  onRestoreRecord: (recordId: string) => Promise<boolean>;
  
  // *** ИСПРАВЛЕНО: Обработчик переключения отображения удаленных записей ***
  onToggleShowDeleted: (checked: boolean) => void;
  
  // Вычисляемые значения
  hasCheckedItems: boolean;
  selectedItemsCount: number;
  
  // Функции для работы с данными
  loadSRSData: () => Promise<void>;
  isDataValid: boolean;
  
  // Функции для работы с типами отпусков
  loadTypesOfLeave: () => void;
  
  // Функции для работы с праздниками
  loadHolidays: () => void;
}

/**
 * Главный оркестрирующий хук для SRS Tab
 * ИСПРАВЛЕНО: Добавлен handleToggleShowDeleted обработчик и правильная передача showDeleted
 */
export const useSRSTabLogic = (props: ITabProps): UseSRSTabLogicReturn => {
  const { selectedStaff, context, currentUserId, managingGroupId } = props;

  console.log('[useSRSTabLogic] Orchestrator hook initialized with REAL delete/restore services and showDeleted support:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffEmployeeId: selectedStaff?.employeeId,
    hasContext: !!context,
    currentUserId,
    managingGroupId,
    realDeleteRestoreEnabled: true,
    showDeletedSupport: true
  });

  // Инициализируем состояние SRS Tab
  const { state, setState } = useSRSTabState();

  // Локальное состояние для отслеживания изменений в таблице
  const [modifiedRecords, setModifiedRecords] = useState<Map<string, Partial<ISRSRecord>>>(new Map());

  // *** РЕАЛЬНОЕ СОСТОЯНИЕ: Локальное состояние для операций удаления/восстановления ***
  const [deleteOperations, setDeleteOperations] = useState<Map<string, boolean>>(new Map()); // recordId -> isDeleting
  const [restoreOperations, setRestoreOperations] = useState<Map<string, boolean>>(new Map()); // recordId -> isRestoring

  // Инициализируем хук загрузки типов отпусков
  const { loadTypesOfLeave } = useTypesOfLeave({
    context,
    setState
  });

  // Инициализируем хук загрузки праздников
  const { loadHolidays } = useHolidays({
    context,
    fromDate: state.fromDate,
    toDate: state.toDate,
    setState
  });

  // *** ИСПРАВЛЕНО: Инициализируем хук загрузки SRS данных с правильной передачей showDeleted ***
  const { loadSRSData, refreshSRSData, isDataValid } = useSRSData({
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    fromDate: state.fromDate,
    toDate: state.toDate,
    showDeleted: state.showDeleted, // *** ИСПРАВЛЕНО: Передаем showDeleted из состояния ***
    setState
  });

  // ===============================================
  // *** РЕАЛЬНЫЕ ОБРАБОТЧИКИ: УДАЛЕНИЕ/ВОССТАНОВЛЕНИЕ ЧЕРЕЗ STAFFRECORDSSERVICE ***
  // ===============================================

  /**
   * *** РЕАЛЬНАЯ ФУНКЦИЯ: Удаление записи SRS через StaffRecordsService ***
   * Использует метод markRecordAsDeleted из StaffRecordsService
   */
  const handleDeleteRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[useSRSTabLogic] *** REAL DELETE RECORD OPERATION STARTED ***');
    console.log('[useSRSTabLogic] Record ID to delete:', recordId);
    
    // Проверяем базовые требования
    if (!context) {
      console.error('[useSRSTabLogic] Context is not available for delete operation');
      return false;
    }

    // Проверяем, не выполняется ли уже операция удаления для этой записи
    if (deleteOperations.get(recordId)) {
      console.warn('[useSRSTabLogic] Delete operation already in progress for this record');
      return false;
    }

    try {
      // Отмечаем начало операции удаления
      setDeleteOperations(prev => new Map(prev.set(recordId, true)));
      
      console.log('[useSRSTabLogic] Starting REAL delete operation using StaffRecordsService...');
      
      // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем РЕАЛЬНЫЙ StaffRecordsService ***
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      console.log('[useSRSTabLogic] Calling staffRecordsService.markRecordAsDeleted()...');
      
      // *** РЕАЛЬНЫЙ ВЫЗОВ: markRecordAsDeleted (soft delete) ***
      const success = await staffRecordsService.markRecordAsDeleted(recordId);
      
      if (success) {
        console.log('[useSRSTabLogic] *** REAL DELETE OPERATION SUCCESSFUL ***');
        console.log('[useSRSTabLogic] Record marked as deleted on server:', recordId);
        
        // Удаляем запись из локальных изменений, если она там была
        setModifiedRecords(prev => {
          const newMap = new Map(prev);
          newMap.delete(recordId);
          return newMap;
        });
        
        // Автоматически обновляем данные, чтобы показать изменения с сервера
        console.log('[useSRSTabLogic] Auto-refreshing data to reflect server changes...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500); // Небольшая задержка для гарантии обновления на сервере
        
        return true;
      } else {
        console.error('[useSRSTabLogic] REAL delete operation failed - server returned false');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSTabLogic] Error during REAL delete operation:', error);
      
      // Показываем ошибку пользователю через состояние
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      // Убираем отметку об операции удаления
      setDeleteOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(recordId);
        return newMap;
      });
    }
  }, [context, refreshSRSData, deleteOperations, setState]);

  /**
   * *** РЕАЛЬНАЯ ФУНКЦИЯ: Восстановление записи SRS через StaffRecordsService ***
   * Использует метод restoreDeletedRecord из StaffRecordsService
   */
  const handleRestoreRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[useSRSTabLogic] *** REAL RESTORE RECORD OPERATION STARTED ***');
    console.log('[useSRSTabLogic] Record ID to restore:', recordId);
    
    // Проверяем базовые требования
    if (!context) {
      console.error('[useSRSTabLogic] Context is not available for restore operation');
      return false;
    }

    // Проверяем, не выполняется ли уже операция восстановления для этой записи
    if (restoreOperations.get(recordId)) {
      console.warn('[useSRSTabLogic] Restore operation already in progress for this record');
      return false;
    }

    try {
      // Отмечаем начало операции восстановления
      setRestoreOperations(prev => new Map(prev.set(recordId, true)));
      
      console.log('[useSRSTabLogic] Starting REAL restore operation using StaffRecordsService...');
      
      // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем РЕАЛЬНЫЙ StaffRecordsService ***
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      console.log('[useSRSTabLogic] Calling staffRecordsService.restoreDeletedRecord()...');
      
      // *** РЕАЛЬНЫЙ ВЫЗОВ: restoreDeletedRecord ***
      const success = await staffRecordsService.restoreDeletedRecord(recordId);
      
      if (success) {
        console.log('[useSRSTabLogic] *** REAL RESTORE OPERATION SUCCESSFUL ***');
        console.log('[useSRSTabLogic] Record restored on server:', recordId);
        
        // Автоматически обновляем данные, чтобы показать изменения с сервера
        console.log('[useSRSTabLogic] Auto-refreshing data to reflect server changes...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500); // Небольшая задержка для гарантии обновления на сервере
        
        return true;
      } else {
        console.error('[useSRSTabLogic] REAL restore operation failed - server returned false');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSTabLogic] Error during REAL restore operation:', error);
      
      // Показываем ошибку пользователю через состояние
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to restore record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      // Убираем отметку об операции восстановления
      setRestoreOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(recordId);
        return newMap;
      });
    }
  }, [context, refreshSRSData, restoreOperations, setState]);

  // ===============================================
  // ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ДАТ
  // ===============================================

  /**
   * Обработчик изменения даты "От"
   * ОБНОВЛЕНО: Добавлено обновление праздников при изменении дат
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

    // Обновляем праздники при изменении дат
    console.log('[useSRSTabLogic] Triggering holidays reload due to fromDate change');
    loadHolidays();
  }, [state.toDate, setState, loadHolidays]);

  /**
   * Обработчик изменения даты "До"
   * ОБНОВЛЕНО: Добавлено обновление праздников при изменении дат
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

    // Обновляем праздники при изменении дат
    console.log('[useSRSTabLogic] Triggering holidays reload due to toDate change');
    loadHolidays();
  }, [state.fromDate, setState, loadHolidays]);

  // ===============================================
  // *** ИСПРАВЛЕНО: ОБРАБОТЧИК ПЕРЕКЛЮЧЕНИЯ ОТОБРАЖЕНИЯ УДАЛЕННЫХ ЗАПИСЕЙ ***
  // ===============================================

  /**
   * *** ИСПРАВЛЕНО: Обработчик переключения отображения удаленных записей ***
   * Точно такой же как в Schedule Tab
   */
  const handleToggleShowDeleted = useCallback((checked: boolean): void => {
    console.log('[useSRSTabLogic] *** HANDLE TOGGLE SHOW DELETED ***');
    console.log('[useSRSTabLogic] Previous showDeleted state:', state.showDeleted);
    console.log('[useSRSTabLogic] New showDeleted value:', checked);
    
    // Обновляем состояние showDeleted
    SRSTabStateHelpers.setShowDeleted(setState, checked);
    
    // Очищаем локальные изменения при изменении фильтра
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    console.log('[useSRSTabLogic] showDeleted state updated, data will be automatically reloaded via useSRSData effect');
    console.log('[useSRSTabLogic] *** TOGGLE SHOW DELETED COMPLETE ***');
    
    // *** ВАЖНО: Данные будут автоматически перезагружены через эффект в useSRSData,
    // который отслеживает изменение state.showDeleted в зависимостях
    
  }, [state.showDeleted, setState]);

  // ===============================================
  // ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ЭЛЕМЕНТОВ ТАБЛИЦЫ
  // ===============================================

  /**
   * Обработчик изменения элементов таблицы
   * ОБНОВЛЕНО: Добавлена обработка типов отпусков
   */
  const handleItemChange = useCallback((item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }): void => {
    console.log('[useSRSTabLogic] *** HANDLE ITEM CHANGE WITH TYPES OF LEAVE SUPPORT ***');
    console.log('[useSRSTabLogic] Item ID:', item.id);
    console.log('[useSRSTabLogic] Field:', field);
    console.log('[useSRSTabLogic] Value:', value);
    console.log('[useSRSTabLogic] Value type:', typeof value);
    
    // Создаем обновленную запись
    const updatedItem = { ...item };
    
    // ИСПРАВЛЕНО: Обрабатываем различные типы полей с правильной логикой пересчета
    if (field === 'startWork' && typeof value === 'object') {
      updatedItem.startWork = value;
      console.log('[useSRSTabLogic] Updated startWork:', value);
    } else if (field === 'finishWork' && typeof value === 'object') {
      updatedItem.finishWork = value;
      console.log('[useSRSTabLogic] Updated finishWork:', value);
    } else if (field === 'relief') {
      // ИСПРАВЛЕНО: Relief НЕ влияет на время работы
      updatedItem.relief = value as boolean;
      console.log('[useSRSTabLogic] Updated relief (NO time recalculation):', value);
    } else if (field === 'workingHours') {
      // ИСПРАВЛЕНО: workingHours приходит уже вычисленным из SRSTable
      updatedItem.hours = value as string;
      console.log('[useSRSTabLogic] Updated workingHours directly (pre-calculated):', value);
    } else if (field === 'typeOfLeave') {
      // Обработка типов отпусков
      updatedItem.typeOfLeave = value as string;
      console.log('[useSRSTabLogic] Updated typeOfLeave:', value);
    } else if (field === 'timeLeave') {
      updatedItem.timeLeave = value as string;
      console.log('[useSRSTabLogic] Updated timeLeave:', value);
    } else {
      // Для других полей используем прямое присвоение с проверкой типа
      (updatedItem as Record<string, any>)[field] = value;
      console.log('[useSRSTabLogic] Updated field', field, 'with value:', value);
    }
    
    // ИСПРАВЛЕНО: Пересчитываем время ТОЛЬКО для временных полей (НЕ для relief, typeOfLeave и workingHours)
    const timeFields = ['startWork', 'finishWork']; // НЕ включаем relief и typeOfLeave!
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
      const newModifications: Record<string, any> = { ...existingModifications };
      
      if (field === 'startWork') {
        newModifications.startWork = updatedItem.startWork;
      } else if (field === 'finishWork') {
        newModifications.finishWork = updatedItem.finishWork;
      } else if (field === 'workingHours') {
        newModifications.hours = value as string;
      } else if (field === 'relief') {
        // ИСПРАВЛЕНО: Сохраняем relief без пересчета времени
        newModifications.relief = value as boolean;
        console.log('[useSRSTabLogic] Saved relief change without time recalculation');
      } else if (field === 'typeOfLeave') {
        // Сохранение типа отпуска
        newModifications.typeOfLeave = value as string;
        console.log('[useSRSTabLogic] Saved typeOfLeave change:', value);
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
   * Обработчик изменения типа отпуска
   */
  const handleTypeOfLeaveChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] *** HANDLE TYPE OF LEAVE CHANGE ***');
    console.log('[useSRSTabLogic] Item ID:', item.id);
    console.log('[useSRSTabLogic] New type of leave:', value);
    
    // Используем общий обработчик изменений
    handleItemChange(item, 'typeOfLeave', value);
    
    console.log('[useSRSTabLogic] Type of leave change delegated to handleItemChange');
  }, [handleItemChange]);

  /**
   * Обработчик изменения времени обеда
   * ИСПРАВЛЕНО: Не пересчитывает время локально, полагается на SRSTable
   */
  const handleLunchTimeChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] handleLunchTimeChange:', { itemId: item.id, value });
    
    // ИСПРАВЛЕНО: Не пересчитываем время здесь - это делает SRSTable
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
   * ОБНОВЛЕНО: Включает очистку операций удаления/восстановления
   */
  const handleRefreshData = useCallback((): void => {
    console.log('[useSRSTabLogic] Manual refresh requested (including clearing REAL operations state)');
    
    // Очищаем локальные изменения при обновлении
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    // *** ОБНОВЛЕНО: Очищаем состояния РЕАЛЬНЫХ операций удаления/восстановления ***
    setDeleteOperations(new Map());
    setRestoreOperations(new Map());
    
    // Обновляем SRS данные
    void refreshSRSData();
    
    // Обновляем типы отпусков
    loadTypesOfLeave();
    
    // Обновляем праздники
    loadHolidays();
  }, [refreshSRSData, setState, loadTypesOfLeave, loadHolidays]);

  /**
   * Обработчик экспорта всех SRS данных
   */
  const handleExportAll = useCallback((): void => {
    console.log('[useSRSTabLogic] Export all SRS data requested');
    console.log('[useSRSTabLogic] Current SRS records count:', state.srsRecords.length);
    console.log('[useSRSTabLogic] Types of leave available:', state.typesOfLeave.length);
    console.log('[useSRSTabLogic] Holidays available:', state.holidays.length);
    console.log('[useSRSTabLogic] Show deleted enabled:', state.showDeleted); // *** НОВОЕ ***
    
    if (state.srsRecords.length === 0) {
      console.warn('[useSRSTabLogic] No SRS records to export');
      return;
    }

    console.log('[useSRSTabLogic] Exporting SRS records with types of leave, holidays and delete status filter:', {
      recordsCount: state.srsRecords.length,
      totalHours: state.totalHours,
      dateRange: `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
      typesOfLeaveCount: state.typesOfLeave.length,
      holidaysCount: state.holidays.length,
      showDeleted: state.showDeleted,
      deletedRecordsCount: state.srsRecords.filter(r => r.Deleted === 1).length
    });

    // TODO: Реализовать экспорт SRS данных с типами отпусков, праздниками и учетом фильтра удаленных
    alert(`Export functionality will be implemented. Records to export: ${state.srsRecords.length}, Types of leave: ${state.typesOfLeave.length}, Holidays: ${state.holidays.length}, Show deleted: ${state.showDeleted}`);
  }, [state.srsRecords, state.totalHours, state.fromDate, state.toDate, state.typesOfLeave, state.holidays, state.showDeleted]);

  /**
   * Обработчик сохранения всех изменений
   * ОБНОВЛЕНО: Учитывает изменения типов отпусков
   */
  const handleSave = useCallback((): void => {
    console.log('[useSRSTabLogic] Save all changes requested (including types of leave changes)');
    
    if (!state.hasUnsavedChanges) {
      console.log('[useSRSTabLogic] No unsaved changes to save');
      return;
    }

    console.log('[useSRSTabLogic] Saving changes for modified records:', {
      modifiedRecordsCount: modifiedRecords.size,
      modifiedIds: Array.from(modifiedRecords.keys())
    });
    
    // Логируем детали изменений для отладки (включая typeOfLeave)
    modifiedRecords.forEach((modifications, itemId) => {
      console.log(`[useSRSTabLogic] Modified record ${itemId}:`, modifications);
      if ('relief' in modifications) {
        console.log(`[useSRSTabLogic] Record ${itemId} has relief change:`, modifications.relief);
      }
      if ('typeOfLeave' in modifications) {
        console.log(`[useSRSTabLogic] Record ${itemId} has typeOfLeave change:`, modifications.typeOfLeave);
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

  /**
   * *** РЕАЛЬНОЕ СОСТОЯНИЕ: Проверяет, выполняются ли операции удаления/восстановления ***
   */
  const hasOngoingOperations = useMemo((): boolean => {
    return deleteOperations.size > 0 || restoreOperations.size > 0;
  }, [deleteOperations.size, restoreOperations.size]);

  // ===============================================
  // *** ИСПРАВЛЕНО: ВОЗВРАЩАЕМЫЙ ОБЪЕКТ С onToggleShowDeleted ***
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
    onTypeOfLeaveChange: handleTypeOfLeaveChange,
    
    // *** РЕАЛЬНЫЕ ОБРАБОТЧИКИ: Удаление/восстановление через StaffRecordsService ***
    onDeleteRecord: handleDeleteRecord,
    onRestoreRecord: handleRestoreRecord,
    
    // *** ИСПРАВЛЕНО: Обработчик переключения отображения удаленных записей ***
    onToggleShowDeleted: handleToggleShowDeleted,
    
    // Вычисляемые значения
    hasCheckedItems,
    selectedItemsCount,
    
    // Функции работы с данными
    loadSRSData,
    isDataValid,
    loadTypesOfLeave,
    loadHolidays
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
    handleTypeOfLeaveChange,
    handleDeleteRecord, // *** РЕАЛЬНЫЙ ОБРАБОТЧИК ***
    handleRestoreRecord, // *** РЕАЛЬНЫЙ ОБРАБОТЧИК ***
    handleToggleShowDeleted, // *** ИСПРАВЛЕНО: ДОБАВЛЕН В ЗАВИСИМОСТИ ***
    hasCheckedItems,
    selectedItemsCount,
    loadSRSData,
    isDataValid,
    loadTypesOfLeave,
    loadHolidays
  ]);

  console.log('[useSRSTabLogic] Hook return object prepared with REAL delete/restore services and showDeleted support:', {
    recordsCount: state.srsRecords.length,
    totalHours: state.totalHours,
    hasCheckedItems,
    selectedItemsCount,
    isDataValid,
    hasUnsavedChanges: state.hasUnsavedChanges,
    isLoading: state.isLoadingSRS,
    modifiedRecordsCount: modifiedRecords.size,
    typesOfLeaveCount: state.typesOfLeave.length,
    isLoadingTypesOfLeave: state.isLoadingTypesOfLeave,
    holidaysCount: state.holidays.length,
    isLoadingHolidays: state.isLoadingHolidays,
    // *** РЕАЛЬНАЯ ИНФОРМАЦИЯ: Операции удаления/восстановления через StaffRecordsService ***
    deleteOperationsCount: deleteOperations.size,
    restoreOperationsCount: restoreOperations.size,
    hasOngoingOperations,
    realDeleteRestoreIntegration: 'StaffRecordsService.markRecordAsDeleted & restoreDeletedRecord',
    // *** ИСПРАВЛЕНО: Информация о поддержке showDeleted ***
    showDeleted: state.showDeleted,
    showDeletedSupport: true,
    hasToggleShowDeletedHandler: !!handleToggleShowDeleted
  });

  return hookReturn;
};