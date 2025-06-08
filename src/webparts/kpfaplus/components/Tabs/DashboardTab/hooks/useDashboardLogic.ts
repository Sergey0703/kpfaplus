// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogic.ts
// ИСПРАВЛЕНО: Добавлен тип возвращаемого значения для функции
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useDataContext } from '../../../../context';
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { CommonFillService } from '../../../../services/CommonFillService';
import { ScheduleLogsService } from '../../../../services/ScheduleLogsService';
import { useDashboardLogs } from './useDashboardLogs';
import { useDashboardFill } from './useDashboardFill';

// Interfaces
interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

interface IConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  onConfirm: () => void;
}

interface IUseDashboardLogicParams {
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
}

// ИСПРАВЛЕНО: Добавлен интерфейс для типа возвращаемого значения
interface IUseDashboardLogicReturn {
  // CORE STATE
  staffMembersData: IStaffMemberWithAutoschedule[];
  selectedDate: Date;
  isLoading: boolean;
  infoMessage?: IInfoMessage;
  confirmDialog: IConfirmDialogState;
  setInfoMessage: (message: IInfoMessage | undefined) => void;
  setConfirmDialog: (dialog: IConfirmDialogState | ((prev: IConfirmDialogState) => IConfirmDialogState)) => void;
  
  // DATE HANDLING
  handleDateChange: (date: Date | undefined) => void;
  
  // AUTOSCHEDULE
  handleAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  
  // FILL OPERATIONS
  handleFillStaff: (staffId: string, staffName: string) => Promise<void>;
  handleFillAll: () => Promise<void>;
  
  // LOG OPERATIONS
  logsService?: ScheduleLogsService;
  handleLogRefresh: (staffId: string) => Promise<void>;
  handleBulkLogRefresh: (staffIds: string[]) => Promise<void>;
  clearLogCache: () => void;
  getLogCacheStats: () => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  getCachedLogsForStaff: () => { [staffId: string]: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
  
  // TABLE RESET FUNCTIONALITY
  registerTableResetCallback: (callback: () => void) => void;
  
  // UTILITY FUNCTIONS
  startInitialLoading: () => void;
}

// Constants
const DEBOUNCE_DELAY = 300; // 300ms for debounce

// Utility functions
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

// ИСПРАВЛЕНО: Добавлен явный тип возвращаемого значения
export const useDashboardLogic = (params: IUseDashboardLogicParams): IUseDashboardLogicReturn => {
  const { context, currentUserId, managingGroupId } = params;
  
  console.log('[useDashboardLogic] Main coordinator hook initialized - modular architecture');

  // Context data
  const { staffMembers, updateStaffMember } = useDataContext();

  // State variables
  const [selectedDate, setSelectedDate] = useState<Date>(getSavedSelectedDate());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(true);
  const [infoMessage, setInfoMessage] = useState<IInfoMessage | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<IConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#0078d4',
    onConfirm: (): void => {}
  });

  // Refs
  const debounceTimerRef = useRef<number | null>(null);
  const lastGroupIdRef = useRef<string>('');
  // *** NEW: Callback для сброса состояния таблицы ***
  const resetTableStateCallbackRef = useRef<(() => void) | null>(null);

  // Memoized services
  const fillService = useMemo(() => {
    if (context) {
      console.log('[useDashboardLogic] Initializing CommonFillService...');
      return CommonFillService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const logsService = useMemo(() => {
    if (context) {
      console.log('[useDashboardLogic] Initializing ScheduleLogsService...');
      return ScheduleLogsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Memoized staff data
  const staffMembersData = useMemo((): IStaffMemberWithAutoschedule[] => {
    console.log('[useDashboardLogic] Processing staff members:', staffMembers.length);
    
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

  // *** LOGS HOOK INTEGRATION ***
  const logsHook = useDashboardLogs({
    logsService,
    staffMembersData,
    selectedDate,
    currentUserId,
    managingGroupId
  });

  // *** FILL HOOK INTEGRATION ***
  const fillHook = useDashboardFill({
    context,
    currentUserId,
    managingGroupId,
    selectedDate,
    staffMembers,
    staffMembersData,
    fillService,
    setIsLoading,
    setInfoMessage,
    setConfirmDialog,
    handleLogRefresh: logsHook.handleLogRefresh,
    handleBulkLogRefresh: logsHook.handleBulkLogRefresh
  });

  // *** NEW: Функция для регистрации callback сброса состояния таблицы ***
  const registerTableResetCallback = useCallback((callback: () => void): void => {
    console.log('[useDashboardLogic] 📝 Registering table reset callback');
    resetTableStateCallbackRef.current = callback;
  }, []);

  // *** NEW: Отслеживание смены группы и сброс состояния таблицы ***
  useEffect(() => {
    console.log('[useDashboardLogic] 🔍 GROUP CHANGE TRACKING:', {
      currentGroupId: managingGroupId,
      lastGroupId: lastGroupIdRef.current,
      isGroupChanged: managingGroupId !== lastGroupIdRef.current
    });
    
    if (managingGroupId && managingGroupId !== lastGroupIdRef.current && lastGroupIdRef.current !== '') {
      console.log('[useDashboardLogic] 🔄 GROUP CHANGED:', {
        from: lastGroupIdRef.current,
        to: managingGroupId,
        action: 'Will reset table state and clear log data'
      });
      
      // *** СБРОС СОСТОЯНИЯ ТАБЛИЦЫ - аналогично смене даты ***
      if (resetTableStateCallbackRef.current) {
        console.log('[useDashboardLogic] 🔄 Calling table reset callback');
        resetTableStateCallbackRef.current();
      }
      
      // *** ОЧИСТКА ДАННЫХ ЛОГОВ - аналогично смене даты ***
      console.log('[useDashboardLogic] 🧹 Clearing log data due to group change');
      logsHook.clearLogData();
    }
    
    // *** UPDATE REF AFTER PROCESSING ***
    if (managingGroupId) {
      lastGroupIdRef.current = managingGroupId;
    }
  }, [managingGroupId, logsHook]);

  // Combined loading state
  const combinedIsLoading = useMemo(() => {
    return isLoading || isLoadingLogs;
  }, [isLoading, isLoadingLogs]);

  // Auto-hide messages
  useEffect(() => {
    if (infoMessage) {
      const timer = setTimeout(() => {
        setInfoMessage(undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  // Initial loading effect
  useEffect(() => {
    console.log('[useDashboardLogic] 🔄 Initial mount effect');
    setIsLoadingLogs(true);
    
    const fallbackTimer = setTimeout(() => {
      console.log('[useDashboardLogic] ⏰ Fallback timer: stopping loading after 6 seconds');
      setIsLoadingLogs(false);
    }, 6000);
    
    return () => {
      console.log('[useDashboardLogic] 🧹 Cleaning up initial mount effect');
      clearTimeout(fallbackTimer);
    };
  }, []);

  // Services ready effect
  useEffect(() => {
    if (logsService && staffMembersData.length > 0) {
      console.log('[useDashboardLogic] 📊 Services and staff data are ready');
      console.log(`[useDashboardLogic] - LogsService: ${!!logsService}`);
      console.log(`[useDashboardLogic] - Staff count: ${staffMembersData.length}`);
      console.log(`[useDashboardLogic] - Currently loading logs: ${isLoadingLogs}`);
    }
  }, [logsService, staffMembersData.length, isLoadingLogs]);

  // Cleanup on unmount
  useEffect(() => {
    return (): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Helper functions
  const setLogLoadingState = useCallback((loading: boolean): void => {
    console.log(`[useDashboardLogic] Setting log loading state: ${loading}`);
    setIsLoadingLogs(loading);
  }, []);

  const startInitialLoading = useCallback((): void => {
    console.log('[useDashboardLogic] Starting initial loading (tab opened/reopened)');
    setIsLoadingLogs(true);
  }, []);

  // Date change handler
  const handleDateChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[useDashboardLogic] Date change requested:', formatDate(date));
      
      setLogLoadingState(true);
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout((): void => {
        console.log('[useDashboardLogic] Applying debounced date change:', formatDate(date));
        
        try {
          sessionStorage.setItem('dashboardTab_selectedDate', date.toISOString());
        } catch (error) {
          console.warn('[useDashboardLogic] Error saving date:', error);
        }
        
        setSelectedDate(date);
        
        // *** СБРОС СОСТОЯНИЯ ТАБЛИЦЫ ПРИ СМЕНЕ ДАТЫ ***
        if (resetTableStateCallbackRef.current) {
          console.log('[useDashboardLogic] 🔄 Calling table reset callback for date change');
          resetTableStateCallbackRef.current();
        }
        
        // *** ОЧИСТКА ДАННЫХ ПРИ СМЕНЕ ДАТЫ ***
        logsHook.clearLogData();
        
        setTimeout((): void => {
          console.log('[useDashboardLogic] Auto-stopping loading state after period change');
          setLogLoadingState(false);
        }, 2000);
        
      }, DEBOUNCE_DELAY);
    }
  }, [logsHook, setLogLoadingState]);

  // *** ENHANCED AUTOSCHEDULE TOGGLE WITH PROPER SERVICE INTEGRATION ***
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
  }, [updateStaffMember, setIsLoading, setInfoMessage]);

  return {
    // *** CORE STATE ***
    staffMembersData,
    selectedDate,
    isLoading: combinedIsLoading,
    infoMessage,
    confirmDialog,
    setInfoMessage,
    setConfirmDialog,
    
    // *** DATE HANDLING ***
    handleDateChange,
    
    // *** AUTOSCHEDULE (KEPT IN MAIN HOOK) ***
    handleAutoscheduleToggle,
    
    // *** FILL OPERATIONS (DELEGATED TO FILL HOOK) ***
    handleFillStaff: fillHook.handleFillStaff,
    handleFillAll: fillHook.handleFillAll,
    
    // *** LOG OPERATIONS (DELEGATED TO LOGS HOOK) ***
    logsService,
    handleLogRefresh: logsHook.handleLogRefresh,
    handleBulkLogRefresh: logsHook.handleBulkLogRefresh,
    clearLogCache: logsHook.clearLogData,
    getLogCacheStats: logsHook.getLogStats,
    getCachedLogsForStaff: logsHook.getLiveLogsForStaff,
    
    // *** NEW: TABLE RESET FUNCTIONALITY ***
    registerTableResetCallback,
    
    // *** UTILITY FUNCTIONS ***
    startInitialLoading
  };
};