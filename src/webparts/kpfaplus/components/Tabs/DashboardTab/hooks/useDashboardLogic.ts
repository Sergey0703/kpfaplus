// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogic.ts
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useDataContext } from '../../../../context';
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { CommonFillService, IFillParams } from '../../../../services/CommonFillService';
import { ScheduleLogsService } from '../../../../services/ScheduleLogsService';

// Интерфейс для информационных сообщений
interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

// Интерфейс для диалога подтверждения
interface IConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  onConfirm: () => void;
}

// Интерфейс для параметров хука
interface IUseDashboardLogicParams {
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
}

// *** ОБНОВЛЕННЫЙ ИНТЕРФЕЙС ДЛЯ КЭША ЛОГОВ С ПОДДЕРЖКОЙ Date ***
interface ILogCache {
  [staffId: string]: {
    lastFetch: number;
    data: any;
    error?: string;
    periodDate?: Date; // *** НОВОЕ ПОЛЕ: Дата периода для которого кэширован лог ***
  };
}

// Константы
const CACHE_TIMEOUT = 30000; // 30 секунд
const DEBOUNCE_DELAY = 300; // 300ms для debounce

// Утилиты
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

const getFirstDayOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getSavedSelectedDate = (): Date => {
  try {
    const savedDate = sessionStorage.getItem('dashboardTab_selectedDate');
    if (savedDate) {
      const parsedDate = new Date(savedDate);
      if (!isNaN(parsedDate.getTime())) {
        console.log('[useDashboardLogic] Restored date from sessionStorage:', parsedDate.toISOString());
        return parsedDate;
      }
    }
  } catch (error) {
    console.warn('[useDashboardLogic] Error reading saved date:', error);
  }
  
  return getFirstDayOfCurrentMonth();
};

// *** НОВАЯ УТИЛИТА: Проверка соответствия дат периодов ***
const isSamePeriod = (date1?: Date, date2?: Date): boolean => {
  if (!date1 || !date2) return false;
  
  // Сравниваем год и месяц
  return date1.getFullYear() === date2.getFullYear() && 
         date1.getMonth() === date2.getMonth();
};

// Возвращаемый интерфейс хука
interface IUseDashboardLogicReturn {
  staffMembersData: IStaffMemberWithAutoschedule[];
  selectedDate: Date;
  isLoading: boolean;
  infoMessage: IInfoMessage | undefined;
  confirmDialog: IConfirmDialogState;
  setInfoMessage: (message: IInfoMessage | undefined) => void;
  setConfirmDialog: (dialog: IConfirmDialogState | ((prev: IConfirmDialogState) => IConfirmDialogState)) => void;
  handleDateChange: (date: Date | undefined) => void;
  handleAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  handleFillStaff: (staffId: string, staffName: string) => Promise<void>;
  handleFillAll: () => Promise<void>;
  // *** СЕРВИСЫ И ЛОГИ ***
  logsService: ScheduleLogsService | undefined;
  handleLogRefresh: (staffId: string) => Promise<void>;
  // *** ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ЛОГАМИ ***
  handleBulkLogRefresh: (staffIds: string[]) => Promise<void>;
  clearLogCache: () => void;
  getLogCacheStats: () => { cached: number; expired: number };
}

export const useDashboardLogic = (params: IUseDashboardLogicParams): IUseDashboardLogicReturn => {
  const { context, currentUserId, managingGroupId } = params;
  
  console.log('[useDashboardLogic] Hook initialized with Date field support');

  // Данные из контекста
  const { staffMembers, updateStaffMember } = useDataContext();

  // Основные состояния
  const [selectedDate, setSelectedDate] = useState<Date>(getSavedSelectedDate());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [infoMessage, setInfoMessage] = useState<IInfoMessage | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<IConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#0078d4',
    onConfirm: () => {}
  });

  // *** ОБНОВЛЕННЫЙ РЕФ ДЛЯ КЭШИРОВАНИЯ С ПОДДЕРЖКОЙ Date ***
  const logCacheRef = useRef<ILogCache>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

  // Инициализация сервисов с мемоизацией
  const fillService = useMemo(() => {
    if (context) {
      console.log('[useDashboardLogic] Initializing CommonFillService...');
      return CommonFillService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const logsService = useMemo(() => {
    if (context) {
      console.log('[useDashboardLogic] Initializing ScheduleLogsService with Date support...');
      return ScheduleLogsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Подготовка данных сотрудников с оптимизацией
  const staffMembersData = useMemo((): IStaffMemberWithAutoschedule[] => {
    console.log('[useDashboardLogic] Processing staff members with Date optimization:', staffMembers.length);
    
    const activeStaff = staffMembers
      .filter((staff: IStaffMember) => staff.deleted !== 1)
      .map((staff: IStaffMember) => ({
        id: staff.id,
        name: staff.name,
        employeeId: staff.employeeId || 'N/A',
        autoschedule: staff.autoSchedule || false,
        deleted: staff.deleted || 0
      }));

    console.log('[useDashboardLogic] Active staff members:', activeStaff.length);
    return activeStaff;
  }, [staffMembers]);

  // Автоматическое скрытие сообщений
  useEffect(() => {
    if (infoMessage) {
      const timer = setTimeout(() => {
        setInfoMessage(undefined);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  // Очистка ресурсов при размонтировании
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // *** ОБНОВЛЕННЫЕ ФУНКЦИИ ДЛЯ РАБОТЫ С КЭШЕМ ЛОГОВ С УЧЕТОМ Date ***
  const clearLogCache = useCallback((): void => {
    console.log('[useDashboardLogic] Clearing log cache with Date support');
    logCacheRef.current = {};
  }, []);

  const getLogCacheStats = useCallback(() => {
    const now = Date.now();
    let cached = 0;
    let expired = 0;

    Object.values(logCacheRef.current).forEach(entry => {
      if (now - entry.lastFetch < CACHE_TIMEOUT) {
        cached++;
      } else {
        expired++;
      }
    });

    return { cached, expired };
  }, []);

  // *** ОБНОВЛЕННАЯ ФУНКЦИЯ: Проверка валидности кэша с учетом даты периода ***
  const isLogCacheValid = useCallback((staffId: string, periodDate: Date): boolean => {
    const entry = logCacheRef.current[staffId];
    if (!entry) return false;
    
    const now = Date.now();
    const isNotExpired = (now - entry.lastFetch) < CACHE_TIMEOUT;
    
    // *** ПРОВЕРЯЕМ ТАКЖЕ СООТВЕТСТВИЕ ПЕРИОДА ***
    const isSamePeriodCache = isSamePeriod(entry.periodDate, periodDate);
    
    const isValid = isNotExpired && isSamePeriodCache;
    
    if (!isValid) {
      console.log(`[useDashboardLogic] Cache invalid for ${staffId}: expired=${!isNotExpired}, periodMismatch=${!isSamePeriodCache}`);
    }
    
    return isValid;
  }, []);

  // *** ОБНОВЛЕННЫЙ ОБРАБОТЧИК ИЗМЕНЕНИЯ ДАТЫ С ОЧИСТКОЙ КЭША ***
  const handleDateChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[useDashboardLogic] Date change requested with cache invalidation:', formatDate(date));
      
      // Отменяем предыдущий таймер
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Устанавливаем новый таймер с debounce
      debounceTimerRef.current = window.setTimeout(() => {
        console.log('[useDashboardLogic] Applying debounced date change:', formatDate(date));
        
        try {
          sessionStorage.setItem('dashboardTab_selectedDate', date.toISOString());
        } catch (error) {
          console.warn('[useDashboardLogic] Error saving date:', error);
        }
        
        setSelectedDate(date);
        
        // *** ОЧИЩАЕМ КЭША ПРИ СМЕНЕ ДАТЫ, ТАК КАК ПЕРИОД ИЗМЕНИЛСЯ ***
        console.log('[useDashboardLogic] Clearing cache due to period change');
        clearLogCache();
      }, DEBOUNCE_DELAY);
    }
  }, [clearLogCache]);

  // Создание параметров заполнения с валидацией
  const createFillParams = useCallback((staffMember: IStaffMemberWithAutoschedule): IFillParams | undefined => {
    if (!context) {
      console.error('[useDashboardLogic] Context not available');
      return undefined;
    }

    const fullStaffMember = staffMembers.find(staff => staff.id === staffMember.id);
    if (!fullStaffMember) {
      console.error('[useDashboardLogic] Staff member not found:', staffMember.id);
      return undefined;
    }

    // Валидация критических параметров
    const validationErrors: string[] = [];
    
    if (!fullStaffMember.employeeId || fullStaffMember.employeeId === 'N/A') {
      validationErrors.push('Invalid employeeId');
    }
    
    if (!currentUserId || currentUserId === '0') {
      validationErrors.push('Invalid currentUserId');
    }
    
    if (!managingGroupId || managingGroupId === '0') {
      validationErrors.push('Invalid managingGroupId');
    }

    if (validationErrors.length > 0) {
      console.error('[useDashboardLogic] Validation errors:', validationErrors);
      return undefined;
    }

    return {
      selectedDate,
      staffMember: fullStaffMember,
      currentUserId,
      managingGroupId,
      dayOfStartWeek: 7,
      context
    };
  }, [context, staffMembers, selectedDate, currentUserId, managingGroupId]);

  // *** ОБНОВЛЕННОЕ ОБНОВЛЕНИЕ ЛОГА С УЧЕТОМ ДАТЫ ПЕРИОДА ***
  const handleLogRefresh = useCallback(async (staffId: string): Promise<void> => {
    if (!logsService) {
      console.log('[useDashboardLogic] Cannot refresh log: service not available');
      return;
    }

    const staffMember = staffMembersData.find(staff => staff.id === staffId);
    if (!staffMember?.employeeId) {
      console.log('[useDashboardLogic] Cannot refresh log: staff not found or no employeeId');
      return;
    }

    // *** ПРОВЕРЯЕМ КЭШ С УЧЕТОМ ТЕКУЩЕГО ПЕРИОДА ***
    if (isLogCacheValid(staffId, selectedDate)) {
      console.log(`[useDashboardLogic] Using cached log for ${staffMember.name} (period: ${formatDate(selectedDate)})`);
      return;
    }

    console.log(`[useDashboardLogic] Refreshing log for ${staffMember.name} (period: ${formatDate(selectedDate)})`);

    // *** ОБНОВЛЯЕМ КЭША СРАЗУ, УКАЗЫВАЯ ПЕРИОД ***
    logCacheRef.current[staffId] = {
      lastFetch: Date.now(),
      data: undefined,
      periodDate: new Date(selectedDate) // *** СОХРАНЯЕМ ПЕРИОД ***
    };

    try {
      // Отменяем предыдущий запрос если есть
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Создаем новый AbortController
      abortControllerRef.current = new AbortController();

      // *** ИСПОЛЬЗУЕМ НОВЫЕ ПАРАМЕТРЫ ФИЛЬТРАЦИИ ПО ДАТЕ ПЕРИОДА ***
      const logsResult = await logsService.getScheduleLogs({
        staffMemberId: staffMember.employeeId,
        periodDate: selectedDate, // *** ФИЛЬТРУЕМ ПО ДАТЕ ПЕРИОДА ***
        top: 1,
        skip: 0
      });

      if (logsResult.error) {
        throw new Error(logsResult.error);
      }

      const lastLog = logsResult.logs.length > 0 ? logsResult.logs[0] : undefined;
      
      // *** ОБНОВЛЯЕМ КЭШ С РЕЗУЛЬТАТОМ И ПЕРИОДОМ ***
      logCacheRef.current[staffId] = {
        lastFetch: Date.now(),
        data: lastLog,
        periodDate: new Date(selectedDate) // *** СОХРАНЯЕМ ПЕРИОД ***
      };

      console.log(`[useDashboardLogic] Log refreshed and cached for ${staffMember.name} (period: ${formatDate(selectedDate)})`);

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[useDashboardLogic] Log refresh aborted for ${staffMember.name}`);
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[useDashboardLogic] Error refreshing log for ${staffMember.name}:`, errorMessage);
      
      // *** КЭШИРУЕМ ОШИБКУ С ПЕРИОДОМ ***
      logCacheRef.current[staffId] = {
        lastFetch: Date.now(),
        data: undefined,
        error: errorMessage,
        periodDate: new Date(selectedDate) // *** СОХРАНЯЕМ ПЕРИОД ***
      };
    }
  }, [logsService, staffMembersData, selectedDate, isLogCacheValid]);

  // *** ОБНОВЛЕННОЕ ГРУППОВОЕ ОБНОВЛЕНИЕ ЛОГОВ С УЧЕТОМ ПЕРИОДА ***
  const handleBulkLogRefresh = useCallback(async (staffIds: string[]): Promise<void> => {
    if (!logsService || staffIds.length === 0) {
      return;
    }

    console.log(`[useDashboardLogic] Bulk refresh for ${staffIds.length} staff members (period: ${formatDate(selectedDate)})`);

    const batchSize = 3; // Обрабатываем по 3 одновременно
    const batches: string[][] = [];
    
    for (let i = 0; i < staffIds.length; i += batchSize) {
      batches.push(staffIds.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const promises = batch.map(staffId => handleLogRefresh(staffId));
      
      // Простая обработка всех промисов
      try {
        await Promise.all(promises);
      } catch (error) {
        console.warn('[useDashboardLogic] Some log refreshes failed:', error);
      }
      
      // Небольшая пауза между батчами
      if (batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[useDashboardLogic] Bulk refresh completed for period: ${formatDate(selectedDate)}`);
  }, [logsService, selectedDate, handleLogRefresh]);

  // Операции заполнения с оптимизацией
  const performFillOperation = useCallback(async (
    fillParams: IFillParams, 
    staffName: string, 
    replaceExisting: boolean
  ): Promise<void> => {
    if (!fillService) {
      console.error('[useDashboardLogic] Fill service not available');
      setInfoMessage({
        text: 'Fill service not available',
        type: MessageBarType.error
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log(`[useDashboardLogic] Starting optimized fill for ${staffName} (period: ${formatDate(selectedDate)})`);

      const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);

      setInfoMessage({
        text: result.message,
        type: result.messageType
      });

      if (result.success) {
        console.log(`[useDashboardLogic] Fill successful for ${staffName}`);
        
        // *** ОЧИЩАЕМ КЭША ЛОГА ДЛЯ ЭТОГО СОТРУДНИКА И ПЕРИОДА ***
        delete logCacheRef.current[fillParams.staffMember.id];
        
        // Планируем обновление лога
        setTimeout(() => {
          void handleLogRefresh(fillParams.staffMember.id);
        }, 1500);
      }

    } catch (error) {
      console.error(`[useDashboardLogic] Fill error for ${staffName}:`, error);
      setInfoMessage({
        text: `Error filling schedule for ${staffName}: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [fillService, selectedDate, handleLogRefresh]);

  // Обработчик autoschedule с оптимизацией
  const handleAutoscheduleToggle = useCallback(async (staffId: string, checked: boolean): Promise<void> => {
    console.log('[useDashboardLogic] Autoschedule toggle:', staffId, checked);
    
    try {
      setIsLoading(true);
      const success = await updateStaffMember(staffId, { autoSchedule: checked });
      
      if (success) {
        setInfoMessage({
          text: 'Autoschedule updated successfully',
          type: MessageBarType.success
        });
      } else {
        throw new Error('Failed to update autoschedule');
      }
    } catch (error) {
      console.error('[useDashboardLogic] Autoschedule error:', error);
      setInfoMessage({
        text: `Error updating autoschedule: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [updateStaffMember]);

  // Обработчик заполнения для одного сотрудника
  const handleFillStaff = useCallback(async (staffId: string, staffName: string): Promise<void> => {
    console.log(`[useDashboardLogic] Fill staff operation: ${staffId}, ${staffName} (period: ${formatDate(selectedDate)})`);
    
    const staffMember = staffMembersData.find(staff => staff.id === staffId);
    if (!staffMember) {
      setInfoMessage({
        text: `Staff member not found: ${staffName}`,
        type: MessageBarType.error
      });
      return;
    }

    const fillParams = createFillParams(staffMember);
    if (!fillParams) {
      setInfoMessage({
        text: 'Cannot create fill parameters - check staff data and context',
        type: MessageBarType.error
      });
      return;
    }

    try {
      setIsLoading(true);

      if (!fillService) {
        throw new Error('Fill service not available');
      }

      const existingCheck = await fillService.checkExistingRecords(fillParams);

      if (existingCheck.hasExistingRecords) {
        if (existingCheck.hasProcessedRecords) {
          setInfoMessage({
            text: `Cannot replace records for ${staffName}: ${existingCheck.processedCount} of ${existingCheck.recordsCount} records have been processed.`,
            type: MessageBarType.error
          });
          return;
        } else {
          setConfirmDialog({
            isOpen: true,
            title: 'Replace Existing Records',
            message: `Found ${existingCheck.recordsCount} existing unprocessed records for ${staffName} in ${formatDate(selectedDate)} period. Replace them?`,
            confirmButtonText: 'Replace',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#d83b01',
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              await performFillOperation(fillParams, staffName, true);
            }
          });
          return;
        }
      } else {
        await performFillOperation(fillParams, staffName, false);
      }

    } catch (error) {
      console.error('[useDashboardLogic] Fill staff error:', error);
      setInfoMessage({
        text: `Error in Fill operation: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [staffMembersData, selectedDate, createFillParams, fillService, performFillOperation]);

  // Обработчик заполнения для всех сотрудников
  const handleFillAll = useCallback(async (): Promise<void> => {
    console.log(`[useDashboardLogic] Fill all operation started for period: ${formatDate(selectedDate)}`);
    
    if (!fillService) {
      setInfoMessage({
        text: 'Fill service not available',
        type: MessageBarType.error
      });
      return;
    }

    if (staffMembersData.length === 0) {
      setInfoMessage({
        text: 'No active staff members to fill',
        type: MessageBarType.warning
      });
      return;
    }

    try {
      setIsLoading(true);

      // Проверяем существующие записи для всех сотрудников
      let totalExistingRecords = 0;
      let totalProcessedRecords = 0;
      const staffWithExistingRecords: string[] = [];

      for (const staffMember of staffMembersData) {
        const fillParams = createFillParams(staffMember);
        if (fillParams) {
          const existingCheck = await fillService.checkExistingRecords(fillParams);
          if (existingCheck.hasExistingRecords) {
            totalExistingRecords += existingCheck.recordsCount;
            staffWithExistingRecords.push(staffMember.name);
            
            if (existingCheck.hasProcessedRecords) {
              totalProcessedRecords += existingCheck.processedCount;
            }
          }
        }
      }

      if (totalProcessedRecords > 0) {
        setInfoMessage({
          text: `Cannot fill all: Found ${totalProcessedRecords} processed records. Manual review required.`,
          type: MessageBarType.error
        });
        return;
      }

      if (totalExistingRecords > 0) {
        setConfirmDialog({
          isOpen: true,
          title: 'Replace All Existing Records',
          message: `Found ${totalExistingRecords} existing records for ${staffWithExistingRecords.length} staff members in ${formatDate(selectedDate)} period. Replace all?`,
          confirmButtonText: 'Replace All',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#d83b01',
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            await performFillAllOperation(true);
          }
        });
        return;
      } else {
        await performFillAllOperation(false);
      }

    } catch (error) {
      console.error('[useDashboardLogic] Fill all error:', error);
      setInfoMessage({
        text: `Error in Fill All operation: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [staffMembersData, selectedDate, fillService, createFillParams]);

  // Вспомогательная функция для заполнения всех
  const performFillAllOperation = useCallback(async (replaceExisting: boolean): Promise<void> => {
    if (!fillService) return;

    let successCount = 0;
    let errorCount = 0;
    let totalCreatedRecords = 0;
    let totalDeletedRecords = 0;
    const processedStaffIds: string[] = [];

    console.log(`[useDashboardLogic] Performing fill all operation for period: ${formatDate(selectedDate)}`);

    for (const staffMember of staffMembersData) {
      const fillParams = createFillParams(staffMember);
      if (fillParams) {
        try {
          const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);
          
          if (result.success) {
            successCount++;
            totalCreatedRecords += result.createdRecordsCount || 0;
            totalDeletedRecords += result.deletedRecordsCount || 0;
            processedStaffIds.push(staffMember.id);
            
            // *** ОЧИЩАЕМ КЭША ДЛЯ ОБРАБОТАННОГО СОТРУДНИКА ***
            delete logCacheRef.current[staffMember.id];
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`[useDashboardLogic] Fill error for ${staffMember.name}:`, error);
        }

        // Пауза между операциями
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        errorCount++;
      }
    }

    // Показываем результат
    if (errorCount === 0) {
      setInfoMessage({
        text: `Successfully filled schedule for all ${successCount} staff members for ${formatDate(selectedDate)} period. Created ${totalCreatedRecords} records.`,
        type: MessageBarType.success
      });
    } else {
      setInfoMessage({
        text: `Filled ${successCount} of ${staffMembersData.length} staff members for ${formatDate(selectedDate)} period. ${errorCount} failed.`,
        type: MessageBarType.warning
      });
    }

    // *** ПЛАНИРУЕМ МАССОВОЕ ОБНОВЛЕНИЕ ЛОГОВ ДЛЯ ЭТОГО ПЕРИОДА ***
    if (processedStaffIds.length > 0) {
      setTimeout(() => {
        void handleBulkLogRefresh(processedStaffIds);
      }, 2000);
    }
  }, [fillService, selectedDate, staffMembersData, createFillParams, handleBulkLogRefresh]);

  return {
    staffMembersData,
    selectedDate,
    isLoading,
    infoMessage,
    confirmDialog,
    setInfoMessage,
    setConfirmDialog,
    handleDateChange,
    handleAutoscheduleToggle,
    handleFillStaff,
    handleFillAll,
    logsService,
    handleLogRefresh,
    handleBulkLogRefresh,
    clearLogCache,
    getLogCacheStats
  };
};