// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSTabLogic.ts

import { useCallback, useMemo, useState } from 'react';
import { ITabProps } from '../../../../models/types';
import { ISRSTabState, useSRSTabState, SRSTabStateHelpers } from './useSRSTabState';
import { useSRSData } from './useSRSData';
import { useTypesOfLeave } from './useTypesOfLeave';
import { useHolidays } from './useHolidays';
import { SRSDateUtils } from './SRSDateUtils';
import { ISRSRecord } from './SRSTabInterfaces';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';

// *** ОБНОВЛЕНО: Интерфейс данных для новой смены с числовыми полями времени ***
export interface INewSRSShiftData {
  date: Date;
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  Holiday?: number;
  // *** НОВОЕ: Числовые поля времени для StaffRecordsService ***
  ShiftDate1Hours?: number;
  ShiftDate1Minutes?: number;
  ShiftDate2Hours?: number;
  ShiftDate2Minutes?: number;
}

/**
 * *** УПРОЩЕННЫЙ: Интерфейс для возвращаемых значений главного хука useSRSTabLogic ***
 * Убран totalHours - теперь вычисляется в SRSTable в реальном времени
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
  
  // *** УПРОЩЕННЫЕ: Обработчики изменения элементов таблицы - убраны пересчеты totalHours ***
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  onTypeOfLeaveChange: (item: ISRSRecord, value: string) => void;
  
  // РЕАЛЬНЫЕ ОБРАБОТЧИКИ: Удаление/восстановление через StaffRecordsService
  onDeleteRecord: (recordId: string) => Promise<boolean>;
  onRestoreRecord: (recordId: string) => Promise<boolean>;
  
  // *** ОБНОВЛЕНО: Обработчик добавления смены с числовыми полями времени ***
  onAddShift: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
  
  // Обработчик переключения отображения удаленных записей
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
 * *** УПРОЩЕННЫЙ: Главный оркестрирующий хук для SRS Tab ***
 * УБРАНЫ: Проблемные useEffect'ы для totalHours, пересчеты в handleItemChange
 * СОХРАНЕНЫ: Все реальные операции с сервером (delete/restore/addShift)
 */
export const useSRSTabLogic = (props: ITabProps): UseSRSTabLogicReturn => {
  const { selectedStaff, context, currentUserId, managingGroupId } = props;

  console.log('[useSRSTabLogic] *** SIMPLIFIED ORCHESTRATOR HOOK (NO TOTAL HOURS IN STATE) ***:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffEmployeeId: selectedStaff?.employeeId,
    hasContext: !!context,
    currentUserId,
    managingGroupId,
    realDeleteRestoreEnabled: true,
    realAddShiftEnabled: true,
    numericTimeFieldsSupport: true,
    showDeletedSupport: true,
    simplifiedArchitecture: true, // *** НОВОЕ: Упрощенная архитектура ***
    totalHoursCalculation: 'Real-time in SRSTable' // *** НОВОЕ ***
  });

  // Инициализируем состояние SRS Tab
  const { state, setState } = useSRSTabState();

  // Локальное состояние для отслеживания изменений в таблице
  const [modifiedRecords, setModifiedRecords] = useState<Map<string, Partial<ISRSRecord>>>(new Map());

  // РЕАЛЬНОЕ СОСТОЯНИЕ: Локальное состояние для операций удаления/восстановления
  const [deleteOperations, setDeleteOperations] = useState<Map<string, boolean>>(new Map());
  const [restoreOperations, setRestoreOperations] = useState<Map<string, boolean>>(new Map());

  // НОВОЕ СОСТОЯНИЕ: Локальное состояние для операций добавления смены
  const [addShiftOperations, setAddShiftOperations] = useState<Map<string, boolean>>(new Map());

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

  // Инициализируем хук загрузки SRS данных с правильной передачей showDeleted
  const { loadSRSData, refreshSRSData, isDataValid } = useSRSData({
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    fromDate: state.fromDate,
    toDate: state.toDate,
    showDeleted: state.showDeleted,
    setState
  });

  // *** УБРАНЫ: Проблемные useEffect'ы для пересчета totalHours ***
  // Больше нет автоматических пересчетов totalHours при изменении srsRecords или showDeleted
  // Total Hours теперь вычисляется в реальном времени в SRSTable

  // ===============================================
  // *** ОБНОВЛЕНА ФУНКЦИЯ: ДОБАВЛЕНИЕ СМЕНЫ С ЧИСЛОВЫМИ ПОЛЯМИ ВРЕМЕНИ ***
  // ===============================================

  /**
   * *** ОБНОВЛЕНО: Добавление смены SRS с числовыми полями времени ***
   * Использует метод createStaffRecord из StaffRecordsService с новыми полями
   */
  const handleAddShift = useCallback(async (date: Date, shiftData?: INewSRSShiftData): Promise<boolean> => {
    console.log('[useSRSTabLogic] *** REAL ADD SHIFT OPERATION WITH NUMERIC TIME FIELDS ***');
    console.log('[useSRSTabLogic] Date for new shift:', date.toLocaleDateString());
    console.log('[useSRSTabLogic] Shift data:', shiftData);
    
    // Проверяем базовые требования
    if (!context) {
      console.error('[useSRSTabLogic] Context is not available for add shift operation');
      return false;
    }

    if (!selectedStaff?.employeeId) {
      console.error('[useSRSTabLogic] Selected staff employeeId is not available for add shift operation');
      return false;
    }

    if (!currentUserId || currentUserId === '0') {
      console.error('[useSRSTabLogic] Current user ID is not available for add shift operation');
      return false;
    }

    if (!managingGroupId || managingGroupId === '0') {
      console.error('[useSRSTabLogic] Managing group ID is not available for add shift operation');
      return false;
    }

    // Создаем ключ операции на основе даты
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Проверяем, не выполняется ли уже операция добавления для этой даты
    if (addShiftOperations.get(dateKey)) {
      console.warn('[useSRSTabLogic] Add shift operation already in progress for this date');
      return false;
    }

    try {
      // Отмечаем начало операции добавления смены
      setAddShiftOperations(prev => new Map(prev.set(dateKey, true)));
      
      console.log('[useSRSTabLogic] Starting REAL add shift operation using StaffRecordsService with NUMERIC TIME FIELDS...');
      
      // Используем РЕАЛЬНЫЙ StaffRecordsService
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      // *** ПОДГОТОВКА ДАННЫХ: Создаем объект для новой записи с ЧИСЛОВЫМИ ПОЛЯМИ ВРЕМЕНИ ***
      console.log('[useSRSTabLogic] Preparing new SRS record data with NUMERIC TIME FIELDS...');
      
      // Подготавливаем дату
      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);

      // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем числовые поля времени по умолчанию 00:00-00:00 ***
      const defaultStartHours = 0;   // 00:00 по умолчанию
      const defaultStartMinutes = 0;
      const defaultEndHours = 0;     // 00:00 по умолчанию  
      const defaultEndMinutes = 0;

      // Используем данные из shiftData или значения по умолчанию
      const timeForLunch = shiftData?.timeForLunch ? parseInt(shiftData.timeForLunch, 10) : 30;
      const contract = shiftData?.contract ? parseInt(shiftData.contract, 10) : 1;
      const typeOfLeaveID = shiftData?.typeOfLeave && shiftData.typeOfLeave !== '' ? shiftData.typeOfLeave : '';
      const holidayFlag = shiftData?.Holiday || 0;

      // *** СТРУКТУРА ДАННЫХ С ЧИСЛОВЫМИ ПОЛЯМИ ВРЕМЕНИ ***
      const createData: Partial<IStaffRecord> = {
        Date: newDate,
        // *** НОВОЕ: Устанавливаем числовые поля времени (основные) ***
        ShiftDate1Hours: shiftData?.ShiftDate1Hours ?? defaultStartHours,    // Начало: 0 часов
        ShiftDate1Minutes: shiftData?.ShiftDate1Minutes ?? defaultStartMinutes, // Начало: 0 минут
        ShiftDate2Hours: shiftData?.ShiftDate2Hours ?? defaultEndHours,      // Конец: 0 часов
        ShiftDate2Minutes: shiftData?.ShiftDate2Minutes ?? defaultEndMinutes,   // Конец: 0 минут
        // *** СОВМЕСТИМОСТЬ: Date поля для старых компонентов (установим в undefined) ***
        ShiftDate1: undefined,
        ShiftDate2: undefined,
        TimeForLunch: timeForLunch,
        Contract: contract,
        WeeklyTimeTableID: undefined, // В SRS нет selectedContractId
        TypeOfLeaveID: typeOfLeaveID,
        Title: typeOfLeaveID ? `Leave on ${date.toLocaleDateString()}` : `SRS Shift on ${date.toLocaleDateString()}`,
        Holiday: holidayFlag
      };

      const employeeId = selectedStaff.employeeId;
      const currentUserID = currentUserId;
      const staffGroupID = managingGroupId;

      console.log('[useSRSTabLogic] *** CREATING NEW SRS SHIFT WITH NUMERIC TIME FIELDS ***');
      console.log('[useSRSTabLogic] Numeric time fields:', {
        ShiftDate1Hours: createData.ShiftDate1Hours,
        ShiftDate1Minutes: createData.ShiftDate1Minutes,
        ShiftDate2Hours: createData.ShiftDate2Hours,
        ShiftDate2Minutes: createData.ShiftDate2Minutes,
        startTime: `${createData.ShiftDate1Hours}:${createData.ShiftDate1Minutes?.toString().padStart(2, '0')}`,
        endTime: `${createData.ShiftDate2Hours}:${createData.ShiftDate2Minutes?.toString().padStart(2, '0')}`
      });
      
      console.log('[useSRSTabLogic] Other fields:', {
        currentUserID,
        staffGroupID,
        employeeId,
        timeForLunch,
        contract,
        typeOfLeaveID,
        holidayFlag
      });
      
      console.log('[useSRSTabLogic] Calling staffRecordsService.createStaffRecord() with NUMERIC TIME FIELDS...');
      
      // *** РЕАЛЬНЫЙ ВЫЗОВ: createStaffRecord с числовыми полями времени ***
      const newRecordId = await staffRecordsService.createStaffRecord(
        createData, 
        currentUserID, 
        staffGroupID, 
        employeeId
      );
      
      if (newRecordId && typeof newRecordId === 'string') {
        console.log('[useSRSTabLogic] *** REAL ADD SHIFT WITH NUMERIC TIME FIELDS SUCCESSFUL ***');
        console.log('[useSRSTabLogic] New SRS record created with ID:', newRecordId);
        console.log('[useSRSTabLogic] Record contains numeric time fields:', {
          ShiftDate1Hours: createData.ShiftDate1Hours,
          ShiftDate1Minutes: createData.ShiftDate1Minutes,
          ShiftDate2Hours: createData.ShiftDate2Hours,
          ShiftDate2Minutes: createData.ShiftDate2Minutes
        });
        
        // Автоматически обновляем данные, чтобы показать новую запись
        console.log('[useSRSTabLogic] Auto-refreshing data to show new shift with numeric time fields...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
        
        return true;
      } else {
        console.error('[useSRSTabLogic] REAL add shift operation failed - server returned invalid result');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSTabLogic] Error during REAL add shift operation with numeric time fields:', error);
      
      // Показываем ошибку пользователю через состояние
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to add new shift: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      // Убираем отметку об операции добавления смены
      setAddShiftOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(dateKey);
        return newMap;
      });
    }
  }, [context, selectedStaff?.employeeId, currentUserId, managingGroupId, refreshSRSData, addShiftOperations, setState]);

  // ===============================================
  // РЕАЛЬНЫЕ ОБРАБОТЧИКИ: УДАЛЕНИЕ/ВОССТАНОВЛЕНИЕ ЧЕРЕЗ STAFFRECORDSSERVICE
  // ===============================================

  /**
   * *** РЕАЛЬНАЯ ФУНКЦИЯ: Удаление записи SRS через StaffRecordsService ***
   */
  const handleDeleteRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[useSRSTabLogic] *** REAL DELETE RECORD OPERATION STARTED ***');
    console.log('[useSRSTabLogic] Record ID to delete:', recordId);
    
    if (!context) {
      console.error('[useSRSTabLogic] Context is not available for delete operation');
      return false;
    }

    if (deleteOperations.get(recordId)) {
      console.warn('[useSRSTabLogic] Delete operation already in progress for this record');
      return false;
    }

    try {
      setDeleteOperations(prev => new Map(prev.set(recordId, true)));
      
      console.log('[useSRSTabLogic] Starting REAL delete operation using StaffRecordsService...');
      
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      console.log('[useSRSTabLogic] Calling staffRecordsService.markRecordAsDeleted()...');
      
      const success = await staffRecordsService.markRecordAsDeleted(recordId);
      
      if (success) {
        console.log('[useSRSTabLogic] *** REAL DELETE OPERATION SUCCESSFUL ***');
        console.log('[useSRSTabLogic] Record marked as deleted on server:', recordId);
        
        setModifiedRecords(prev => {
          const newMap = new Map(prev);
          newMap.delete(recordId);
          return newMap;
        });
        
        console.log('[useSRSTabLogic] Auto-refreshing data to reflect server changes...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
        
        return true;
      } else {
        console.error('[useSRSTabLogic] REAL delete operation failed - server returned false');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSTabLogic] Error during REAL delete operation:', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      setDeleteOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(recordId);
        return newMap;
      });
    }
  }, [context, refreshSRSData, deleteOperations, setState]);

  /**
   * *** РЕАЛЬНАЯ ФУНКЦИЯ: Восстановление записи SRS через StaffRecordsService ***
   */
  const handleRestoreRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[useSRSTabLogic] *** REAL RESTORE RECORD OPERATION STARTED ***');
    console.log('[useSRSTabLogic] Record ID to restore:', recordId);
    
    if (!context) {
      console.error('[useSRSTabLogic] Context is not available for restore operation');
      return false;
    }

    if (restoreOperations.get(recordId)) {
      console.warn('[useSRSTabLogic] Restore operation already in progress for this record');
      return false;
    }

    try {
      setRestoreOperations(prev => new Map(prev.set(recordId, true)));
      
      console.log('[useSRSTabLogic] Starting REAL restore operation using StaffRecordsService...');
      
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      console.log('[useSRSTabLogic] Calling staffRecordsService.restoreDeletedRecord()...');
      
      const success = await staffRecordsService.restoreDeletedRecord(recordId);
      
      if (success) {
        console.log('[useSRSTabLogic] *** REAL RESTORE OPERATION SUCCESSFUL ***');
        console.log('[useSRSTabLogic] Record restored on server:', recordId);
        
        console.log('[useSRSTabLogic] Auto-refreshing data to reflect server changes...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
        
        return true;
      } else {
        console.error('[useSRSTabLogic] REAL restore operation failed - server returned false');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSTabLogic] Error during REAL restore operation:', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to restore record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
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

  const handleFromDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useSRSTabLogic] handleFromDateChange called with date:', date?.toISOString());
    
    if (!date) {
      console.log('[useSRSTabLogic] No date provided to handleFromDateChange');
      return;
    }

    const normalizedFromDate = SRSDateUtils.calculateWeekRange(date).start;
    console.log('[useSRSTabLogic] Normalized fromDate:', normalizedFromDate.toISOString());

    const shouldUpdateTo = SRSDateUtils.shouldUpdateToDate(normalizedFromDate, state.toDate);
    
    if (shouldUpdateTo) {
      const newToDate = SRSDateUtils.getWeekEndAfterDate(normalizedFromDate);
      console.log('[useSRSTabLogic] Auto-updating toDate to:', newToDate.toISOString());
      
      SRSTabStateHelpers.updateDates(setState, normalizedFromDate, newToDate);
    } else {
      console.log('[useSRSTabLogic] Keeping current toDate, only updating fromDate');
      SRSTabStateHelpers.updateDates(setState, normalizedFromDate, state.toDate);
    }

    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    setAddShiftOperations(new Map());

    console.log('[useSRSTabLogic] Triggering holidays reload due to fromDate change');
    loadHolidays();
  }, [state.toDate, setState, loadHolidays]);

  const handleToDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useSRSTabLogic] handleToDateChange called with date:', date?.toISOString());
    
    if (!date) {
      console.log('[useSRSTabLogic] No date provided to handleToDateChange');
      return;
    }

    const normalizedToDate = SRSDateUtils.calculateWeekRange(date).end;
    console.log('[useSRSTabLogic] Normalized toDate:', normalizedToDate.toISOString());

    if (normalizedToDate < state.fromDate) {
      console.warn('[useSRSTabLogic] toDate cannot be before fromDate, adjusting fromDate');
      
      const newFromDate = SRSDateUtils.calculateWeekRange(normalizedToDate).start;
      SRSTabStateHelpers.updateDates(setState, newFromDate, normalizedToDate);
    } else {
      SRSTabStateHelpers.updateDates(setState, state.fromDate, normalizedToDate);
    }

    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    setAddShiftOperations(new Map());

    console.log('[useSRSTabLogic] Triggering holidays reload due to toDate change');
    loadHolidays();
  }, [state.fromDate, setState, loadHolidays]);

  // ===============================================
  // ОБРАБОТЧИК ПЕРЕКЛЮЧЕНИЯ ОТОБРАЖЕНИЯ УДАЛЕННЫХ ЗАПИСЕЙ
  // ===============================================

  const handleToggleShowDeleted = useCallback((checked: boolean): void => {
    console.log('[useSRSTabLogic] *** HANDLE TOGGLE SHOW DELETED (SIMPLIFIED ARCHITECTURE) ***');
    console.log('[useSRSTabLogic] Previous showDeleted state:', state.showDeleted);
    console.log('[useSRSTabLogic] New showDeleted value:', checked);
    console.log('[useSRSTabLogic] Total Hours will be recalculated in SRSTable automatically');
    
    SRSTabStateHelpers.setShowDeleted(setState, checked);
    
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    console.log('[useSRSTabLogic] showDeleted state updated, data will be automatically reloaded via useSRSData effect');
    console.log('[useSRSTabLogic] *** TOGGLE SHOW DELETED COMPLETE (SIMPLIFIED) ***');
    
  }, [state.showDeleted, setState]);

  // ===============================================
  // *** УПРОЩЕННЫЕ: ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ЭЛЕМЕНТОВ ТАБЛИЦЫ ***
  // ===============================================

  /**
   * *** УПРОЩЕН: Обработчик изменения элементов без пересчета totalHours ***
   * Total Hours теперь вычисляется в реальном времени в SRSTable
   */
  const handleItemChange = useCallback((item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }): void => {
    console.log('[useSRSTabLogic] *** SIMPLIFIED ITEM CHANGE (NO TOTAL HOURS RECALC) ***');
    console.log('[useSRSTabLogic] Item ID:', item.id);
    console.log('[useSRSTabLogic] Field:', field);
    console.log('[useSRSTabLogic] Value:', value);
    console.log('[useSRSTabLogic] Total Hours will be recalculated in SRSTable automatically');
    
    // Сохраняем изменения в локальном состоянии для сохранения
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      
      const newModifications: Record<string, unknown> = { ...existingModifications };
      
      if (field === 'startWork') {
        newModifications.startWork = value;
      } else if (field === 'finishWork') {
        newModifications.finishWork = value;
      } else if (field === 'workingHours') {
        newModifications.hours = value as string;
      } else if (field === 'relief') {
        newModifications.relief = value as boolean;
        console.log('[useSRSTabLogic] Saved relief change (no time recalculation here)');
      } else if (field === 'typeOfLeave') {
        newModifications.typeOfLeave = value as string;
        console.log('[useSRSTabLogic] Saved typeOfLeave change:', value);
      } else if (field === 'timeLeave') {
        newModifications.timeLeave = value as string;
      } else {
        newModifications[field] = value;
      }
      
      newModified.set(item.id, newModifications);
      return newModified;
    });
    
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSTabLogic] *** SIMPLIFIED ITEM CHANGE COMPLETE ***');
    console.log('[useSRSTabLogic] Modified records count:', modifiedRecords.size + 1);
  }, [setState, modifiedRecords.size]);

  const handleTypeOfLeaveChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] *** HANDLE TYPE OF LEAVE CHANGE (SIMPLIFIED) ***');
    console.log('[useSRSTabLogic] Item ID:', item.id);
    console.log('[useSRSTabLogic] New type of leave:', value);
    
    handleItemChange(item, 'typeOfLeave', value);
    
    console.log('[useSRSTabLogic] Type of leave change delegated to simplified handleItemChange');
  }, [handleItemChange]);

  const handleLunchTimeChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] *** SIMPLIFIED LUNCH TIME CHANGE ***');
    console.log('[useSRSTabLogic] handleLunchTimeChange:', { itemId: item.id, value });
    console.log('[useSRSTabLogic] Total Hours will be recalculated in SRSTable automatically');
    
    // Сохраняем только изменение времени обеда в локальном состоянии
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      newModified.set(item.id, {
        ...existingModifications,
        lunch: value
      });
      return newModified;
    });
    
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSTabLogic] Simplified lunch time change applied to local state only');
  }, [setState]);

  const handleContractNumberChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSTabLogic] handleContractNumberChange:', { itemId: item.id, value });
    
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

  const handleRefreshData = useCallback((): void => {
    console.log('[useSRSTabLogic] Manual refresh requested (simplified architecture)');
    
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    setDeleteOperations(new Map());
    setRestoreOperations(new Map());
    setAddShiftOperations(new Map());
    
    void refreshSRSData();
    loadTypesOfLeave();
    loadHolidays();
  }, [refreshSRSData, setState, loadTypesOfLeave, loadHolidays]);

  const handleExportAll = useCallback((): void => {
    console.log('[useSRSTabLogic] *** EXPORT ALL SRS DATA (SIMPLIFIED ARCHITECTURE) ***');
    console.log('[useSRSTabLogic] Current SRS records count:', state.srsRecords.length);
    console.log('[useSRSTabLogic] Types of leave available:', state.typesOfLeave.length);
    console.log('[useSRSTabLogic] Holidays available:', state.holidays.length);
    console.log('[useSRSTabLogic] Show deleted enabled:', state.showDeleted);
    console.log('[useSRSTabLogic] Total Hours: Calculated in real-time by SRSTable');
    console.log('[useSRSTabLogic] Numeric time fields support: enabled');
    
    if (state.srsRecords.length === 0) {
      console.warn('[useSRSTabLogic] No SRS records to export');
      return;
    }

    console.log('[useSRSTabLogic] Exporting SRS records (simplified architecture):', {
      recordsCount: state.srsRecords.length,
      dateRange: `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
      typesOfLeaveCount: state.typesOfLeave.length,
      holidaysCount: state.holidays.length,
      showDeleted: state.showDeleted,
      deletedRecordsCount: state.srsRecords.filter(r => r.Deleted === 1).length,
      activeRecordsCount: state.srsRecords.filter(r => r.Deleted !== 1).length,
      numericTimeFieldsEnabled: true,
      simplifiedArchitecture: true,
      totalHoursCalculation: 'Real-time in SRSTable'
    });

    alert(`Export functionality will be implemented. Records to export: ${state.srsRecords.length}, Types of leave: ${state.typesOfLeave.length}, Holidays: ${state.holidays.length}, Show deleted: ${state.showDeleted}, Total Hours: Calculated in real-time, Numeric time fields: enabled`);
  }, [state.srsRecords, state.fromDate, state.toDate, state.typesOfLeave, state.holidays, state.showDeleted]);

  /**
   * *** УПРОЩЕН: Обработчик сохранения всех изменений ***
   * Убраны пересчеты totalHours - Total Hours теперь в SRSTable
   */
  const handleSave = useCallback(async (): Promise<void> => {
    console.log('[useSRSTabLogic] *** SIMPLIFIED SAVE ALL CHANGES (NO TOTAL HOURS RECALC) ***');
    
    if (!state.hasUnsavedChanges) {
      console.log('[useSRSTabLogic] No unsaved changes to save');
      return;
    }

    if (!context) {
      console.error('[useSRSTabLogic] Context is not available for save operation');
      return;
    }

    console.log('[useSRSTabLogic] Saving changes for modified records (simplified architecture):', {
      modifiedRecordsCount: modifiedRecords.size,
      modifiedIds: Array.from(modifiedRecords.keys()),
      totalHoursHandling: 'Calculated in real-time by SRSTable'
    });

    try {
      const staffRecordsService = StaffRecordsService.getInstance(context);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Сохраняем каждую измененную запись
      const modifiedEntries = Array.from(modifiedRecords.entries());
      for (let i = 0; i < modifiedEntries.length; i++) {
        const [itemId, modifications] = modifiedEntries[i];
        try {
          console.log(`[useSRSTabLogic] *** SAVING RECORD ${itemId} WITH MODIFICATIONS ***:`, modifications);

          // Находим оригинальную запись
          const originalRecord = state.srsRecords.find(r => r.ID === itemId);
          if (!originalRecord) {
            console.error(`[useSRSTabLogic] Original record not found for ID: ${itemId}`);
            errorCount++;
            errors.push(`Record ${itemId} not found`);
            continue;
          }

          // Создаем объект для обновления с числовыми полями времени
          const updateData: Partial<IStaffRecord> = {};

          // *** КЛЮЧЕВОЕ: Обработка изменений времени с числовыми полями ***
          if ('startWork' in modifications) {
            const startWork = modifications.startWork as { hours: string; minutes: string };
            updateData.ShiftDate1Hours = parseInt(startWork.hours, 10);
            updateData.ShiftDate1Minutes = parseInt(startWork.minutes, 10);
            console.log(`[useSRSTabLogic] Setting start time (numeric): ${updateData.ShiftDate1Hours}:${updateData.ShiftDate1Minutes}`);
          }

          if ('finishWork' in modifications) {
            const finishWork = modifications.finishWork as { hours: string; minutes: string };
            updateData.ShiftDate2Hours = parseInt(finishWork.hours, 10);
            updateData.ShiftDate2Minutes = parseInt(finishWork.minutes, 10);
            console.log(`[useSRSTabLogic] Setting finish time (numeric): ${updateData.ShiftDate2Hours}:${updateData.ShiftDate2Minutes}`);
          }

          // Обработка других полей
          if ('lunch' in modifications) {
            updateData.TimeForLunch = parseInt(modifications.lunch as string, 10);
            console.log(`[useSRSTabLogic] Setting lunch time: ${updateData.TimeForLunch}`);
          }

          if ('contract' in modifications) {
            updateData.Contract = parseInt(modifications.contract as string, 10);
            console.log(`[useSRSTabLogic] Setting contract: ${updateData.Contract}`);
          }

          if ('typeOfLeave' in modifications) {
            updateData.TypeOfLeaveID = modifications.typeOfLeave as string;
            console.log(`[useSRSTabLogic] Setting type of leave: ${updateData.TypeOfLeaveID}`);
          }

          if ('timeLeave' in modifications) {
            updateData.LeaveTime = parseFloat(modifications.timeLeave as string);
            console.log(`[useSRSTabLogic] Setting leave time: ${updateData.LeaveTime}`);
          }

          if ('hours' in modifications) {
            updateData.WorkTime = modifications.hours as string;
            console.log(`[useSRSTabLogic] Setting work time: ${updateData.WorkTime}`);
          }

          if ('relief' in modifications) {
            // Relief не сохраняется в StaffRecords, это только UI поле
            console.log(`[useSRSTabLogic] Relief field ignored (UI only): ${modifications.relief}`);
          }

          // Проверяем, есть ли что сохранять
          if (Object.keys(updateData).length === 0) {
            console.log(`[useSRSTabLogic] No server fields to update for record ${itemId}`);
            successCount++;
            continue;
          }

          console.log(`[useSRSTabLogic] *** CALLING REAL StaffRecordsService.updateStaffRecord ***`);
          console.log(`[useSRSTabLogic] Update data for record ${itemId}:`, updateData);

          // *** РЕАЛЬНЫЙ ВЫЗОВ: updateStaffRecord с числовыми полями времени ***
          const success = await staffRecordsService.updateStaffRecord(itemId, updateData);

          if (success) {
            console.log(`[useSRSTabLogic] *** REAL SAVE SUCCESSFUL *** for record ${itemId}`);
            successCount++;
          } else {
            console.error(`[useSRSTabLogic] *** REAL SAVE FAILED *** for record ${itemId}`);
            errorCount++;
            errors.push(`Failed to save record ${itemId}`);
          }

        } catch (recordError) {
          const errorMessage = recordError instanceof Error ? recordError.message : String(recordError);
          console.error(`[useSRSTabLogic] Error saving record ${itemId}:`, recordError);
          errorCount++;
          errors.push(`Error saving record ${itemId}: ${errorMessage}`);
        }
      }

      console.log(`[useSRSTabLogic] *** SIMPLIFIED SAVE OPERATION COMPLETE ***:`, {
        totalRecords: modifiedRecords.size,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : 'None',
        totalHoursHandling: 'Will be recalculated automatically in SRSTable'
      });

      if (successCount > 0) {
        // Очищаем локальные изменения для успешно сохраненных записей
        setModifiedRecords(prev => {
          const newModified = new Map(prev);
          // Удаляем только успешно сохраненные записи
          // TODO: Можно улучшить, отслеживая какие именно записи сохранились
          if (errorCount === 0) {
            newModified.clear(); // Если все успешно, очищаем все
          }
          return newModified;
        });

        SRSTabStateHelpers.setHasUnsavedChanges(setState, errorCount > 0);

        // Обновляем данные с сервера
        console.log('[useSRSTabLogic] Auto-refreshing data after save (Total Hours will recalculate in SRSTable)...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
      }

      if (errorCount > 0) {
        // Показываем ошибки пользователю
        const errorMessage = `Saved ${successCount} records, failed ${errorCount}. Errors: ${errors.join(', ')}`;
        SRSTabStateHelpers.setErrorSRS(setState, errorMessage);
      }

      console.log('[useSRSTabLogic] *** SIMPLIFIED SAVE OPERATION COMPLETE ***');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useSRSTabLogic] Critical error during simplified save operation:', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, `Save operation failed: ${errorMessage}`);
    }
  }, [state.hasUnsavedChanges, modifiedRecords, setState, context, state.srsRecords, refreshSRSData]);

  const handleSaveChecked = useCallback((): void => {
    console.log('[useSRSTabLogic] Save checked items requested (simplified architecture)');
    
    if (state.selectedItems.size === 0) {
      console.log('[useSRSTabLogic] No items selected for saving');
      return;
    }

    const selectedIds = Array.from(state.selectedItems);
    console.log('[useSRSTabLogic] Saving changes for selected records:', selectedIds);
    
    const selectedModifications = new Map();
    selectedIds.forEach(id => {
      if (modifiedRecords.has(id)) {
        selectedModifications.set(id, modifiedRecords.get(id));
      }
    });
    
    console.log('[useSRSTabLogic] Selected modifications to save:', {
      selectedCount: selectedIds.length,
      modifiedSelectedCount: selectedModifications.size,
      totalHoursHandling: 'Will be recalculated automatically in SRSTable'
    });
    
    // TODO: Реализовать сохранение выбранных записей
    SRSTabStateHelpers.clearSelection(setState);
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      selectedIds.forEach(id => newModified.delete(id));
      return newModified;
    });
    
    console.log('[useSRSTabLogic] Selected records saved successfully (mock) - Total Hours will update in SRSTable');
  }, [state.selectedItems, setState, modifiedRecords]);

  const handleErrorDismiss = useCallback((): void => {
    console.log('[useSRSTabLogic] Error dismiss requested');
    
    setState(prevState => ({
      ...prevState,
      error: undefined,
      errorSRS: undefined
    }));
  }, [setState]);

  const handleItemCheck = useCallback((itemId: string, checked: boolean): void => {
    console.log('[useSRSTabLogic] Item check changed:', { itemId, checked });
    
    SRSTabStateHelpers.toggleItemSelection(setState, itemId);
    
    if (!state.hasUnsavedChanges) {
      SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    }
  }, [setState, state.hasUnsavedChanges]);

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

  const hasCheckedItems = useMemo((): boolean => {
    return state.selectedItems.size > 0;
  }, [state.selectedItems.size]);

  const selectedItemsCount = useMemo((): number => {
    return state.selectedItems.size;
  }, [state.selectedItems.size]);

  const hasOngoingOperations = useMemo((): boolean => {
    return deleteOperations.size > 0 || restoreOperations.size > 0 || addShiftOperations.size > 0;
  }, [deleteOperations.size, restoreOperations.size, addShiftOperations.size]);

  // ===============================================
  // *** УПРОЩЕННЫЙ: ВОЗВРАЩАЕМЫЙ ОБЪЕКТ БЕЗ TOTALHOURS ***
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
    
    // *** УПРОЩЕННЫЕ: Обработчики изменения элементов таблицы ***
    onItemChange: handleItemChange,
    onLunchTimeChange: handleLunchTimeChange,
    onContractNumberChange: handleContractNumberChange,
    onTypeOfLeaveChange: handleTypeOfLeaveChange,
    
    // РЕАЛЬНЫЕ ОБРАБОТЧИКИ: Удаление/восстановление через StaffRecordsService
    onDeleteRecord: handleDeleteRecord,
    onRestoreRecord: handleRestoreRecord,
    
    // *** ОБНОВЛЕНО: Обработчик добавления смены с числовыми полями времени ***
    onAddShift: handleAddShift,
    
    // Обработчик переключения отображения удаленных записей
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
    handleDeleteRecord,
    handleRestoreRecord,
    handleAddShift,
    handleToggleShowDeleted,
    hasCheckedItems,
    selectedItemsCount,
    loadSRSData,
    isDataValid,
    loadTypesOfLeave,
    loadHolidays
  ]);

  console.log('[useSRSTabLogic] *** SIMPLIFIED HOOK RETURN OBJECT PREPARED ***:', {
    recordsCount: state.srsRecords.length,
    // *** УБРАНО: totalHours больше не в состоянии ***
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
    deleteOperationsCount: deleteOperations.size,
    restoreOperationsCount: restoreOperations.size,
    hasOngoingOperations,
    realDeleteRestoreIntegration: 'StaffRecordsService.markRecordAsDeleted & restoreDeletedRecord',
    addShiftOperationsCount: addShiftOperations.size,
    realAddShiftIntegration: 'StaffRecordsService.createStaffRecord WITH NUMERIC TIME FIELDS',
    showDeleted: state.showDeleted,
    showDeletedSupport: true,
    hasToggleShowDeletedHandler: !!handleToggleShowDeleted,
    hasAddShiftHandler: !!handleAddShift,
    numericTimeFieldsSupport: true,
    simplifiedArchitecture: true, // *** НОВОЕ ***
    totalHoursCalculation: 'Real-time in SRSTable', // *** НОВОЕ ***
    noProblematicUseEffects: true // *** НОВОЕ ***
  });

  return hookReturn;
};