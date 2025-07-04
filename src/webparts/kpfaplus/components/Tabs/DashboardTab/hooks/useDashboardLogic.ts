// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogic.ts
// UPDATED: Full support for Date-only format in Holidays and DaysOfLeaves lists
// COMPLETE IMPLEMENTATION: Auto-fill with detailed progress tracking, Date-only support and timezone handling
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useDataContext } from '../../../../context';
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { CommonFillService } from '../../../../services/CommonFillService';
import { ScheduleLogsService } from '../../../../services/ScheduleLogsService';
import { RemoteSiteService } from '../../../../services/RemoteSiteService';
import { CommonFillDateUtils } from '../../../../services/CommonFillDateUtils';
import { useDashboardLogs } from './useDashboardLogs';
import { useDashboardFill } from './useDashboardFill';

// *** INTERFACES ***
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

// *** NEW: AUTO-FILL PROGRESS INTERFACE WITH TIMER AND DATE-ONLY SUPPORT ***
interface IAutoFillProgress {
  isActive: boolean;
  currentStaffName: string;
  nextStaffName?: string;
  completed: number;
  total: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  isPaused: boolean;
  remainingPauseTime: number; // milliseconds
  startTime: number; // timestamp when auto-fill started
  elapsedTime: number; // elapsed time in milliseconds
  isProcessing: boolean; // is currently processing a staff member (show spinner)
}

// *** COMPLETE RETURN TYPE ***
interface IUseDashboardLogicReturn {
  // CORE STATE
  staffMembersData: IStaffMemberWithAutoschedule[];
  selectedDate: Date;
  isLoading: boolean;
  infoMessage?: IInfoMessage;
  confirmDialog: IConfirmDialogState;
  setInfoMessage: (message: IInfoMessage | undefined) => void;
  setConfirmDialog: (dialog: IConfirmDialogState | ((prev: IConfirmDialogState) => IConfirmDialogState)) => void;
  
  // DATE HANDLING WITH DATE-ONLY SUPPORT
  handleDateChange: (date: Date | undefined) => void;
  
  // AUTOSCHEDULE
  handleAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  
  // FILL OPERATIONS
  handleFillStaff: (staffId: string, staffName: string) => Promise<void>;
  handleFillAll: () => Promise<void>; // LEGACY: for compatibility
  handleAutoFillAll: () => Promise<void>; // NEW: auto-fill function with Date-only support
  
  // AUTO-FILL PROGRESS
  autoFillProgress?: IAutoFillProgress; // NEW: real-time progress tracking
  
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

// *** CONSTANTS ***
const DEBOUNCE_DELAY = 300; // 300ms for debounce
const AUTO_FILL_DELAY = 3000; // 3 seconds delay between auto-fill operations

// *** UTILITY FUNCTIONS WITH DATE-ONLY SUPPORT ***
const formatDateOnlyForDisplay = (date?: Date): string => {
  if (!date) return '';
  try {
    // Используем локальные компоненты даты для правильного отображения Date-only полей
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${day}.${month}.${year}`;
  } catch (error) {
    console.warn('[useDashboardLogic] Error formatting Date-only date for display:', error);
    return date.toLocaleDateString();
  }
};

const createDateOnlyFromComponents = (year: number, month: number, day: number): Date => {
  // Создаем дату с локальными компонентами для избежания проблем с часовыми поясами
  // month должен быть 0-based для конструктора Date
  return new Date(year, month, day);
};

// *** DATE-ONLY HANDLING FUNCTIONS ***
const getFirstDayOfCurrentMonth = (): Date => {
  const now = new Date();
  const result = createDateOnlyFromComponents(now.getFullYear(), now.getMonth(), 1);
  
  console.log('[useDashboardLogic] *** FIRST DAY OF CURRENT MONTH (DATE-ONLY) ***');
  console.log('[useDashboardLogic] Current date:', formatDateOnlyForDisplay(now));
  console.log('[useDashboardLogic] First day of month:', formatDateOnlyForDisplay(result));
  console.log('[useDashboardLogic] Display format:', formatDateOnlyForDisplay(result));
  return result;
};

// *** MAIN HOOK IMPLEMENTATION ***
export const useDashboardLogic = (params: IUseDashboardLogicParams): IUseDashboardLogicReturn => {
  const { context, currentUserId, managingGroupId } = params;
  
  console.log('[useDashboardLogic] Main coordinator hook initialized with Date-only format support and Auto Fill');

  // *** CONTEXT DATA ***
  const { staffMembers, updateStaffMember } = useDataContext();

  // *** СОЗДАЕМ ЭКЗЕМПЛЯР DATE UTILS ДЛЯ КОРРЕКТНОЙ РАБОТЫ С ДАТАМИ ***
  const remoteSiteService = useMemo(() => {
    if (context) {
      return RemoteSiteService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const dateUtils = useMemo(() => {
    if (remoteSiteService) {
      return new CommonFillDateUtils(remoteSiteService);
    }
    return undefined;
  }, [remoteSiteService]);

  // *** ФУНКЦИЯ ВОССТАНОВЛЕНИЯ ДАТЫ С ИСПОЛЬЗОВАНИЕМ COMMONFILL DATEUTILS ***
  const getSavedSelectedDate = useCallback((): Date => {
    try {
      const savedDate = sessionStorage.getItem('dashboardTab_selectedDate');
      if (savedDate && dateUtils) {
        console.log('[useDashboardLogic] Restoring date from sessionStorage using CommonFillDateUtils:', savedDate);
        return dateUtils.restoreFromUTCStorage(savedDate);
      }
    } catch (error) {
      console.warn('[useDashboardLogic] Error reading saved date:', error);
    }
    return dateUtils?.getFirstDayOfCurrentMonth() || getFirstDayOfCurrentMonth();
  }, [dateUtils]);

  // *** STATE VARIABLES ***
  const [selectedDate, setSelectedDate] = useState<Date>(() => getSavedSelectedDate());
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
  
  // *** NEW: AUTO-FILL PROGRESS STATE ***
  const [autoFillProgress, setAutoFillProgress] = useState<IAutoFillProgress | undefined>(undefined);

  // *** REFS ***
  const debounceTimerRef = useRef<number | null>(null);
  const lastGroupIdRef = useRef<string>('');
  const resetTableStateCallbackRef = useRef<(() => void) | null>(null);

  // *** INITIAL DATE LOGGING WITH DATE-ONLY SUPPORT ***
  useEffect(() => {
    console.log('[useDashboardLogic] *** INITIAL SELECTED DATE ANALYSIS WITH DATE-ONLY ***');
    console.log('[useDashboardLogic] Selected date (Date-only):', formatDateOnlyForDisplay(selectedDate));
    console.log('[useDashboardLogic] Month/Year:', {
      year: selectedDate.getFullYear(),
      month: selectedDate.getMonth() + 1,
      monthName: selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    });
  }, [selectedDate]);

  // *** MEMOIZED SERVICES ***
  const fillService = useMemo(() => {
    if (context) {
      console.log('[useDashboardLogic] Initializing CommonFillService with Date-only support...');
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

  // *** MEMOIZED STAFF DATA ***
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
    
    // Log staff with autoschedule enabled
    const autoScheduleStaff = activeStaff.filter(staff => staff.autoschedule);
    console.log('[useDashboardLogic] Staff with autoschedule enabled:', autoScheduleStaff.length);
    autoScheduleStaff.forEach(staff => {
      console.log(`[useDashboardLogic] - ${staff.name} (ID: ${staff.employeeId}): autoschedule=true`);
    });
    
    return activeStaff;
  }, [staffMembers]);

  // *** HOOKS INTEGRATION ***
  const logsHook = useDashboardLogs({
    logsService,
    staffMembersData,
    selectedDate,
    currentUserId,
    managingGroupId
  });

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

  // *** TABLE RESET FUNCTIONALITY ***
  const registerTableResetCallback = useCallback((callback: () => void): void => {
    console.log('[useDashboardLogic] 📝 Registering table reset callback');
    resetTableStateCallbackRef.current = callback;
  }, []);

  // *** GROUP CHANGE TRACKING ***
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
      
      if (resetTableStateCallbackRef.current) {
        console.log('[useDashboardLogic] 🔄 Calling table reset callback');
        resetTableStateCallbackRef.current();
      }
      
      console.log('[useDashboardLogic] 🧹 Clearing log data due to group change');
      logsHook.clearLogData();
    }
    
    if (managingGroupId) {
      lastGroupIdRef.current = managingGroupId;
    }
  }, [managingGroupId, logsHook]);

  // *** COMBINED LOADING STATE ***
  const combinedIsLoading = useMemo(() => {
    return isLoading || isLoadingLogs;
  }, [isLoading, isLoadingLogs]);

  // *** AUTO-HIDE MESSAGES (EXCEPT SUCCESS MESSAGES) ***
  useEffect(() => {
    if (infoMessage) {
      // Don't auto-hide success messages with execution time - let user dismiss manually
      if (infoMessage.type === MessageBarType.success && 
          (infoMessage.text.includes('completed in') || infoMessage.text.includes('Auto-fill completed'))) {
        console.log('[useDashboardLogic] Success message with timing - keeping visible for manual dismissal');
        return; // Don't set timer for success messages with execution time
      }
      
      // Auto-hide other messages after 5 seconds
      const timer = setTimeout(() => {
        setInfoMessage(undefined);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  // *** INITIAL LOADING EFFECT ***
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

  // *** SERVICES READY EFFECT ***
  useEffect(() => {
    if (logsService && staffMembersData.length > 0) {
      console.log('[useDashboardLogic] 📊 Services and staff data are ready');
      console.log(`[useDashboardLogic] - LogsService: ${!!logsService}`);
      console.log(`[useDashboardLogic] - Staff count: ${staffMembersData.length}`);
      console.log(`[useDashboardLogic] - Currently loading logs: ${isLoadingLogs}`);
    }
  }, [logsService, staffMembersData.length, isLoadingLogs]);

  // *** CLEANUP ON UNMOUNT ***
  useEffect(() => {
    return (): void => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // *** HELPER FUNCTIONS ***
  const setLogLoadingState = useCallback((loading: boolean): void => {
    console.log(`[useDashboardLogic] Setting log loading state: ${loading}`);
    setIsLoadingLogs(loading);
  }, []);

  const startInitialLoading = useCallback((): void => {
    console.log('[useDashboardLogic] Starting initial loading (tab opened/reopened)');
    setIsLoadingLogs(true);
  }, []);

  // *** DATE CHANGE HANDLER WITH DATE-ONLY SUPPORT ***
  const handleDateChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[useDashboardLogic] Date change requested:', formatDateOnlyForDisplay(date));
      console.log('[useDashboardLogic] *** INCOMING DATE ANALYSIS WITH DATE-ONLY ***');
      console.log('[useDashboardLogic] Raw input date:', formatDateOnlyForDisplay(date));
      console.log('[useDashboardLogic] Display format:', formatDateOnlyForDisplay(date));
      
      setLogLoadingState(true);
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout((): void => {
        console.log('[useDashboardLogic] Applying debounced date change:', formatDateOnlyForDisplay(date));
        
        try {
          // *** ИСПРАВЛЕНО: Используем CommonFillDateUtils для корректного сохранения ***
          const normalizedDate = createDateOnlyFromComponents(
            date.getFullYear(),
            date.getMonth(),
            1 // Always first day of month
          );
          
          console.log('[useDashboardLogic] *** DATE NORMALIZATION WITH COMMONFILL DATEUTILS ***');
          console.log('[useDashboardLogic] Input date:', formatDateOnlyForDisplay(date));
          console.log('[useDashboardLogic] Normalized date:', formatDateOnlyForDisplay(normalizedDate));
          
          if (dateUtils) {
            // *** ИСПРАВЛЕНО: Используем правильный метод из CommonFillDateUtils ***
            const utcForStorage = dateUtils.normalizeToUTCForStorage(normalizedDate);
            sessionStorage.setItem('dashboardTab_selectedDate', utcForStorage.toISOString());
            console.log('[useDashboardLogic] *** ИСПОЛЬЗУЕМ ИСПРАВЛЕННОЕ UTC СОХРАНЕНИЕ ИЗ COMMONFILL DATEUTILS ***');
            console.log('[useDashboardLogic] UTC stored:', utcForStorage.toISOString());
          } else {
            // Fallback to old method if dateUtils not available
            const utcForStorage = new Date(Date.UTC(
              normalizedDate.getFullYear(),
              normalizedDate.getMonth(),
              normalizedDate.getDate(),
              12, 0, 0, 0  // Use noon UTC to avoid timezone boundary issues
            ));
            sessionStorage.setItem('dashboardTab_selectedDate', utcForStorage.toISOString());
            console.log('[useDashboardLogic] *** FALLBACK UTC STORAGE ***');
            console.log('[useDashboardLogic] UTC stored (fallback):', utcForStorage.toISOString());
          }
          
          setSelectedDate(normalizedDate);
          
          console.log('[useDashboardLogic] *** FINAL SELECTED DATE SET WITH DATE-ONLY FIXED ***');
          console.log('[useDashboardLogic] Final date:', formatDateOnlyForDisplay(normalizedDate));
          console.log('[useDashboardLogic] Will generate for month:', {
            year: normalizedDate.getFullYear(),
            month: normalizedDate.getMonth() + 1,
            monthName: normalizedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
          });
        } catch (error) {
          console.warn('[useDashboardLogic] Error saving date:', error);
        }
        
        // *** RESET TABLE STATE ON DATE CHANGE ***
        if (resetTableStateCallbackRef.current) {
          console.log('[useDashboardLogic] 🔄 Calling table reset callback for date change');
          resetTableStateCallbackRef.current();
        }
        
        // *** CLEAR DATA ON DATE CHANGE ***
        logsHook.clearLogData();
        
        setTimeout((): void => {
          console.log('[useDashboardLogic] Auto-stopping loading state after period change');
          setLogLoadingState(false);
        }, 2000);
        
      }, DEBOUNCE_DELAY);
    }
  }, [dateUtils, logsHook, setLogLoadingState]);

  // *** AUTOSCHEDULE TOGGLE ***
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

  // *** NEW: PERFORM AUTO-FILL OPERATION WITH DETAILED PROGRESS AND DATE-ONLY SUPPORT ***
  const performAutoFillAllOperation = useCallback(async (autoScheduleStaff: IStaffMemberWithAutoschedule[]): Promise<void> => {
    console.log(`[useDashboardLogic] 🤖 PERFORMING AUTO-FILL WITH DATE-ONLY SUPPORT for ${autoScheduleStaff.length} staff members`);
    
    const startTime = Date.now(); // Record start time
    
    try {
      setIsLoading(true);
      
      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const processedStaffIds: string[] = [];
      const processResults: string[] = [];

      // *** INITIALIZE AUTO-FILL PROGRESS WITH TIMER ***
      setAutoFillProgress({
        isActive: true,
        currentStaffName: autoScheduleStaff[0].name,
        nextStaffName: autoScheduleStaff.length > 1 ? autoScheduleStaff[1].name : undefined,
        completed: 0,
        total: autoScheduleStaff.length,
        successCount: 0,
        skippedCount: 0,
        errorCount: 0,
        isPaused: false,
        remainingPauseTime: 0,
        startTime: startTime,
        elapsedTime: 0,
        isProcessing: false
      });

      // *** START ELAPSED TIME COUNTER ***
      const timerInterval = setInterval(() => {
        setAutoFillProgress(prev => prev ? {
          ...prev,
          elapsedTime: Date.now() - startTime
        } : undefined);
      }, 1000); // Update every second

      // *** SEQUENTIAL PROCESSING OF EACH STAFF MEMBER WITHOUT DIALOGS ***
      for (let i = 0; i < autoScheduleStaff.length; i++) {
        const staff = autoScheduleStaff[i];
        const nextStaff = i < autoScheduleStaff.length - 1 ? autoScheduleStaff[i + 1] : undefined;
        
        console.log(`[useDashboardLogic] 🔄 Auto-processing ${i + 1}/${autoScheduleStaff.length}: ${staff.name} WITH DATE-ONLY SUPPORT`);
        
        // *** UPDATE PROGRESS - START PROCESSING CURRENT STAFF ***
        setAutoFillProgress(prev => prev ? {
          ...prev,
          currentStaffName: staff.name,
          nextStaffName: nextStaff?.name,
          isPaused: false,
          remainingPauseTime: 0,
          isProcessing: true // Show spinner during processing
        } : undefined);
        
        try {
          // *** USE processStaffMemberAuto WITH DATE-ONLY SUPPORT ***
          const result = await fillHook.processStaffMemberAuto(staff);
          
          if (result.success) {
            processedCount++;
            processedStaffIds.push(staff.id);
            processResults.push(`✓ ${staff.name}: ${result.message}`);
            console.log(`[useDashboardLogic] ✅ Auto-fill completed for ${staff.name}: ${result.message}`);
            
            // *** UPDATE SUCCESS COUNTER AND STOP PROCESSING SPINNER ***
            setAutoFillProgress(prev => prev ? {
              ...prev,
              completed: i + 1,
              successCount: processedCount,
              isProcessing: false
            } : undefined);
          } else {
            if (result.message.includes('⚠️') || result.message.includes('Skipped')) {
              skippedCount++;
              processResults.push(`⚠ ${staff.name}: ${result.message}`);
              console.log(`[useDashboardLogic] ⚠️ Auto-fill skipped for ${staff.name}: ${result.message}`);
              
              // *** UPDATE SKIPPED COUNTER AND STOP PROCESSING SPINNER ***
              setAutoFillProgress(prev => prev ? {
                ...prev,
                completed: i + 1,
                skippedCount: skippedCount,
                isProcessing: false
              } : undefined);
            } else {
              errorCount++;
              processResults.push(`✗ ${staff.name}: ${result.message}`);
              console.error(`[useDashboardLogic] ❌ Auto-fill failed for ${staff.name}: ${result.message}`);
              
              // *** UPDATE ERROR COUNTER AND STOP PROCESSING SPINNER ***
              setAutoFillProgress(prev => prev ? {
                ...prev,
                completed: i + 1,
                errorCount: errorCount,
                isProcessing: false
              } : undefined);
            }
          }
          
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          processResults.push(`✗ ${staff.name}: ${errorMsg}`);
          console.error(`[useDashboardLogic] ❌ Auto-fill error for ${staff.name}:`, error);
          
          // *** UPDATE ERROR COUNTER AND STOP PROCESSING SPINNER ***
          setAutoFillProgress(prev => prev ? {
            ...prev,
            completed: i + 1,
            errorCount: errorCount,
            isProcessing: false
          } : undefined);
        }

        // *** PAUSE BETWEEN PROCESSING WITH DETAILED DISPLAY ***
        if (i < autoScheduleStaff.length - 1) {
          console.log(`[useDashboardLogic] ⏳ Waiting ${AUTO_FILL_DELAY / 1000} seconds before next staff member...`);
          
          // *** SHOW PAUSE STATE ***
          setAutoFillProgress(prev => prev ? {
            ...prev,
            isPaused: true,
            remainingPauseTime: AUTO_FILL_DELAY,
            isProcessing: false
          } : undefined);
          
          // *** ANIMATE REMAINING PAUSE TIME ***
          const pauseInterval = setInterval(() => {
            setAutoFillProgress(prev => {
              if (!prev || !prev.isPaused) {
                clearInterval(pauseInterval);
                return prev;
              }
              
              const newRemainingTime = Math.max(0, prev.remainingPauseTime - 100);
              
              if (newRemainingTime <= 0) {
                clearInterval(pauseInterval);
                return {
                  ...prev,
                  isPaused: false,
                  remainingPauseTime: 0
                };
              }
              
              return {
                ...prev,
                remainingPauseTime: newRemainingTime
              };
            });
          }, 100); // Update every 100ms for smooth animation
          
          // Wait for full delay time
          await new Promise(resolve => setTimeout(resolve, AUTO_FILL_DELAY));
          
          // Clear interval just in case
          clearInterval(pauseInterval);
        }
      }

      // *** STOP TIMER AND CALCULATE FINAL TIME ***
      clearInterval(timerInterval);
      const totalElapsedTime = Date.now() - startTime;
      const minutes = Math.floor(totalElapsedTime / 60000);
      const seconds = Math.floor((totalElapsedTime % 60000) / 1000);
      const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      // *** COMPLETE PROGRESS ***
      setAutoFillProgress(prev => prev ? {
        ...prev,
        isActive: false,
        isPaused: false,
        remainingPauseTime: 0,
        currentStaffName: 'Completed',
        nextStaffName: undefined,
        isProcessing: false,
        elapsedTime: totalElapsedTime
      } : undefined);

      // Show final message with execution time (will not auto-hide)
      let resultType: MessageBarType;
      let resultMessage: string;

      if (errorCount === 0) {
        resultType = MessageBarType.success;
        resultMessage = `Auto-fill completed in ${timeString}! Processed: ${processedCount}, Skipped: ${skippedCount} of ${autoScheduleStaff.length} staff members (Date-only format).`;
      } else if (processedCount > 0) {
        resultType = MessageBarType.warning;
        resultMessage = `Auto-fill completed in ${timeString} with issues. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount} of ${autoScheduleStaff.length} staff members.`;
      } else {
        resultType = MessageBarType.error;
        resultMessage = `Auto-fill failed after ${timeString}. No staff members were processed successfully. Errors: ${errorCount}, Skipped: ${skippedCount}.`;
      }

      setInfoMessage({
        text: resultMessage,
        type: resultType
      });

      console.log(`[useDashboardLogic] 🏁 AUTO FILL ALL COMPLETED WITH DATE-ONLY SUPPORT IN ${timeString}:`, {
        total: autoScheduleStaff.length,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        executionTime: timeString,
        results: processResults
      });

      // Update logs for successfully processed staff
      if (processedStaffIds.length > 0) {
        setTimeout(() => {
          void logsHook.handleBulkLogRefresh(processedStaffIds);
        }, 2000);
      }

      // *** CLEAR PROGRESS AFTER A SHORT DELAY ***
      setTimeout(() => {
        setAutoFillProgress(undefined);
      }, 3000);

    } catch (error) {
      console.error('[useDashboardLogic] Auto-fill all error with Date-only support:', error);
      const totalElapsedTime = Date.now() - startTime;
      const minutes = Math.floor(totalElapsedTime / 60000);
      const seconds = Math.floor((totalElapsedTime % 60000) / 1000);
      const timeString = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      
      setInfoMessage({
        text: `Error in Auto Fill All operation after ${timeString}: ${error}`,
        type: MessageBarType.error
      });
      
      // *** CLEAR PROGRESS ON ERROR ***
      setAutoFillProgress(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [
    fillHook.processStaffMemberAuto,
    logsHook.handleBulkLogRefresh,
    setIsLoading,
    setInfoMessage
  ]);

  // *** NEW: AUTO-FILL ALL FUNCTION WITH DATE-ONLY SUPPORT ***
  const handleAutoFillAll = useCallback(async (): Promise<void> => {
    console.log(`[useDashboardLogic] 🚀 AUTO FILL ALL STARTED WITH DATE-ONLY SUPPORT for period: ${formatDateOnlyForDisplay(selectedDate)}`);
    
    if (!fillService) {
      setInfoMessage({
        text: 'Fill service not available',
        type: MessageBarType.error
      });
      return;
    }

    if (staffMembersData.length === 0) {
      setInfoMessage({
        text: 'No active staff members to process',
        type: MessageBarType.warning
      });
      return;
    }

    // Filter only staff with autoschedule enabled
    const autoScheduleStaff = staffMembersData.filter(staff => staff.autoschedule);
    
    if (autoScheduleStaff.length === 0) {
      setInfoMessage({
        text: 'No staff members with Auto Schedule enabled',
        type: MessageBarType.info
      });
      return;
    }

    console.log(`[useDashboardLogic] Found ${autoScheduleStaff.length} staff members with autoschedule enabled`);
    autoScheduleStaff.forEach(staff => {
      console.log(`[useDashboardLogic] - ${staff.name} (ID: ${staff.employeeId})`);
    });

    // *** SHOW SINGLE CONFIRMATION BEFORE STARTING ***
    setConfirmDialog({
      isOpen: true,
      title: 'Auto Fill All Schedules',
      message: `Do you want to automatically fill schedules for ${autoScheduleStaff.length} staff members with Auto Schedule enabled for ${formatDateOnlyForDisplay(selectedDate)} period?\n\nThis will process each staff member automatically without additional confirmations.\n\nNote: Uses Date-only format for holidays and leaves.`,
      confirmButtonText: 'Start Auto Fill',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#107c10',
      onConfirm: async () => {
        setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
        
        // *** START AUTOMATIC PROCESSING WITHOUT DIALOGS ***
        await performAutoFillAllOperation(autoScheduleStaff);
      }
    });
  }, [
    selectedDate,
    fillService,
    staffMembersData,
    setInfoMessage,
    setConfirmDialog,
    performAutoFillAllOperation
  ]);

  // *** RETURN COMPLETE INTERFACE ***
  return {
    // *** CORE STATE ***
    staffMembersData,
    selectedDate,
    isLoading: combinedIsLoading,
    infoMessage,
    confirmDialog,
    setInfoMessage,
    setConfirmDialog,
    
    // *** DATE HANDLING WITH DATE-ONLY SUPPORT ***
    handleDateChange,
    
    // *** AUTOSCHEDULE ***
    handleAutoscheduleToggle,
    
    // *** FILL OPERATIONS ***
    handleFillStaff: fillHook.handleFillStaff,
    handleFillAll: fillHook.handleFillAll, // LEGACY: for compatibility
    handleAutoFillAll, // NEW: auto-fill function with Date-only support and progress tracking
    
    // *** AUTO-FILL PROGRESS ***
    autoFillProgress, // NEW: real-time progress tracking
    
    // *** LOG OPERATIONS (DELEGATED TO LOGS HOOK) ***
    logsService,
    handleLogRefresh: logsHook.handleLogRefresh,
    handleBulkLogRefresh: logsHook.handleBulkLogRefresh,
    clearLogCache: logsHook.clearLogData,
    getLogCacheStats: logsHook.getLogStats,
    getCachedLogsForStaff: logsHook.getLiveLogsForStaff,
    
    // *** TABLE RESET FUNCTIONALITY ***
    registerTableResetCallback,
    
    // *** UTILITY FUNCTIONS ***
    startInitialLoading
  };
};