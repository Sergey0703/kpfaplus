// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogic.ts
// COMPLETE IMPLEMENTATION: Auto-fill with detailed progress tracking, UTC date handling and timezone support
// ADDED: Real-time progress with current staff, pause countdown, and success/error counters
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

// *** NEW: AUTO-FILL PROGRESS INTERFACE ***
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
  
  // DATE HANDLING
  handleDateChange: (date: Date | undefined) => void;
  
  // AUTOSCHEDULE
  handleAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  
  // FILL OPERATIONS
  handleFillStaff: (staffId: string, staffName: string) => Promise<void>;
  handleFillAll: () => Promise<void>; // LEGACY: for compatibility
  handleAutoFillAll: () => Promise<void>; // NEW: auto-fill function
  
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

// *** UTILITY FUNCTIONS ***
const formatDate = (date?: Date): string => {
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// *** UTC DATE HANDLING FUNCTIONS ***
const getFirstDayOfCurrentMonth = (): Date => {
  const now = new Date();
  const result = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  console.log('[useDashboardLogic] *** FIRST DAY OF CURRENT MONTH (UTC) ***');
  console.log('[useDashboardLogic] Current date:', now.toISOString());
  console.log('[useDashboardLogic] First day of month:', result.toISOString());
  console.log('[useDashboardLogic] Display format:', formatDate(result));
  return result;
};

const getSavedSelectedDate = (): Date => {
  try {
    const savedDate = sessionStorage.getItem('dashboardTab_selectedDate');
    if (savedDate) {
      const parsedDate = new Date(savedDate);
      if (!isNaN(parsedDate.getTime())) {
        console.log('[useDashboardLogic] Restoring date from sessionStorage:', savedDate);
        
        // *** NORMALIZE DATE TO FIRST DAY OF MONTH WITH UTC ***
        const normalizedDate = new Date(Date.UTC(
          parsedDate.getUTCFullYear(),
          parsedDate.getUTCMonth(),
          1, // Always first day of month
          0, 0, 0, 0
        ));
        
        console.log('[useDashboardLogic] *** DATE RESTORATION WITH UTC NORMALIZATION ***');
        console.log('[useDashboardLogic] Original saved:', savedDate);
        console.log('[useDashboardLogic] Parsed date:', parsedDate.toISOString());
        console.log('[useDashboardLogic] Normalized to first of month:', normalizedDate.toISOString());
        console.log('[useDashboardLogic] Display format:', formatDate(normalizedDate));
        
        return normalizedDate;
      }
    }
  } catch (error) {
    console.warn('[useDashboardLogic] Error reading saved date:', error);
  }
  return getFirstDayOfCurrentMonth();
};

// *** MAIN HOOK IMPLEMENTATION ***
export const useDashboardLogic = (params: IUseDashboardLogicParams): IUseDashboardLogicReturn => {
  const { context, currentUserId, managingGroupId } = params;
  
  console.log('[useDashboardLogic] Main coordinator hook initialized with UTC date handling and Auto Fill support');

  // *** CONTEXT DATA ***
  const { staffMembers, updateStaffMember } = useDataContext();

  // *** STATE VARIABLES ***
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
  
  // *** NEW: AUTO-FILL PROGRESS STATE ***
  const [autoFillProgress, setAutoFillProgress] = useState<IAutoFillProgress | undefined>(undefined);

  // *** REFS ***
  const debounceTimerRef = useRef<number | null>(null);
  const lastGroupIdRef = useRef<string>('');
  const resetTableStateCallbackRef = useRef<(() => void) | null>(null);

  // *** INITIAL DATE LOGGING ***
  useEffect(() => {
    console.log('[useDashboardLogic] *** INITIAL SELECTED DATE ANALYSIS ***');
    console.log('[useDashboardLogic] Selected date (UTC):', selectedDate.toISOString());
    console.log('[useDashboardLogic] Selected date (display):', formatDate(selectedDate));
    console.log('[useDashboardLogic] Month/Year:', {
      year: selectedDate.getUTCFullYear(),
      month: selectedDate.getUTCMonth() + 1,
      monthName: selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    });
  }, []);

  // *** MEMOIZED SERVICES ***
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

  // *** AUTO-HIDE MESSAGES ***
  useEffect(() => {
    if (infoMessage) {
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

  // *** DATE CHANGE HANDLER WITH UTC SUPPORT ***
  const handleDateChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[useDashboardLogic] Date change requested:', formatDate(date));
      console.log('[useDashboardLogic] *** INCOMING DATE ANALYSIS ***');
      console.log('[useDashboardLogic] Raw input date:', date.toISOString());
      console.log('[useDashboardLogic] Display format:', formatDate(date));
      
      setLogLoadingState(true);
      
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = window.setTimeout((): void => {
        console.log('[useDashboardLogic] Applying debounced date change:', formatDate(date));
        
        try {
          // *** NORMALIZE DATE BEFORE SAVING ***
          const normalizedDate = new Date(Date.UTC(
            date.getUTCFullYear(),
            date.getUTCMonth(),
            1, // Always first day of month
            0, 0, 0, 0
          ));
          
          console.log('[useDashboardLogic] *** DATE NORMALIZATION BEFORE SAVING ***');
          console.log('[useDashboardLogic] Input date:', date.toISOString());
          console.log('[useDashboardLogic] Input display:', formatDate(date));
          console.log('[useDashboardLogic] Normalized date:', normalizedDate.toISOString());
          console.log('[useDashboardLogic] Normalized display:', formatDate(normalizedDate));
          
          sessionStorage.setItem('dashboardTab_selectedDate', normalizedDate.toISOString());
          setSelectedDate(normalizedDate);
          
          console.log('[useDashboardLogic] *** FINAL SELECTED DATE SET ***');
          console.log('[useDashboardLogic] Final date:', normalizedDate.toISOString());
          console.log('[useDashboardLogic] Will generate for month:', {
            year: normalizedDate.getUTCFullYear(),
            month: normalizedDate.getUTCMonth() + 1,
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
  }, [logsHook, setLogLoadingState]);

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

  // *** NEW: PERFORM AUTO-FILL OPERATION WITH DETAILED PROGRESS ***
  const performAutoFillAllOperation = useCallback(async (autoScheduleStaff: IStaffMemberWithAutoschedule[]): Promise<void> => {
    console.log(`[useDashboardLogic] 🤖 PERFORMING AUTO-FILL WITHOUT DIALOGS for ${autoScheduleStaff.length} staff members`);
    
    try {
      setIsLoading(true);
      
      let processedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const processedStaffIds: string[] = [];
      const processResults: string[] = [];

      // *** INITIALIZE AUTO-FILL PROGRESS ***
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
        remainingPauseTime: 0
      });

      // *** SEQUENTIAL PROCESSING OF EACH STAFF MEMBER WITHOUT DIALOGS ***
      for (let i = 0; i < autoScheduleStaff.length; i++) {
        const staff = autoScheduleStaff[i];
        const nextStaff = i < autoScheduleStaff.length - 1 ? autoScheduleStaff[i + 1] : undefined;
        
        console.log(`[useDashboardLogic] 🔄 Auto-processing ${i + 1}/${autoScheduleStaff.length}: ${staff.name} WITHOUT DIALOGS`);
        
        // *** UPDATE PROGRESS - CURRENT STAFF ***
        setAutoFillProgress(prev => prev ? {
          ...prev,
          currentStaffName: staff.name,
          nextStaffName: nextStaff?.name,
          isPaused: false,
          remainingPauseTime: 0
        } : undefined);
        
        try {
          // *** USE processStaffMemberAuto INSTEAD OF handleFillStaff ***
          const result = await fillHook.processStaffMemberAuto(staff);
          
          if (result.success) {
            processedCount++;
            processedStaffIds.push(staff.id);
            processResults.push(`✓ ${staff.name}: ${result.message}`);
            console.log(`[useDashboardLogic] ✅ Auto-fill completed for ${staff.name}: ${result.message}`);
            
            // *** UPDATE SUCCESS COUNTER ***
            setAutoFillProgress(prev => prev ? {
              ...prev,
              completed: i + 1,
              successCount: processedCount
            } : undefined);
          } else {
            if (result.message.includes('⚠️') || result.message.includes('Skipped')) {
              skippedCount++;
              processResults.push(`⚠ ${staff.name}: ${result.message}`);
              console.log(`[useDashboardLogic] ⚠️ Auto-fill skipped for ${staff.name}: ${result.message}`);
              
              // *** UPDATE SKIPPED COUNTER ***
              setAutoFillProgress(prev => prev ? {
                ...prev,
                completed: i + 1,
                skippedCount: skippedCount
              } : undefined);
            } else {
              errorCount++;
              processResults.push(`✗ ${staff.name}: ${result.message}`);
              console.error(`[useDashboardLogic] ❌ Auto-fill failed for ${staff.name}: ${result.message}`);
              
              // *** UPDATE ERROR COUNTER ***
              setAutoFillProgress(prev => prev ? {
                ...prev,
                completed: i + 1,
                errorCount: errorCount
              } : undefined);
            }
          }
          
        } catch (error) {
          errorCount++;
          const errorMsg = error instanceof Error ? error.message : String(error);
          processResults.push(`✗ ${staff.name}: ${errorMsg}`);
          console.error(`[useDashboardLogic] ❌ Auto-fill error for ${staff.name}:`, error);
          
          // *** UPDATE ERROR COUNTER ***
          setAutoFillProgress(prev => prev ? {
            ...prev,
            completed: i + 1,
            errorCount: errorCount
          } : undefined);
        }

        // *** PAUSE BETWEEN PROCESSING WITH DETAILED DISPLAY ***
        if (i < autoScheduleStaff.length - 1) {
          console.log(`[useDashboardLogic] ⏳ Waiting ${AUTO_FILL_DELAY / 1000} seconds before next staff member...`);
          
          // *** SHOW PAUSE STATE ***
          setAutoFillProgress(prev => prev ? {
            ...prev,
            isPaused: true,
            remainingPauseTime: AUTO_FILL_DELAY
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

      // *** COMPLETE PROGRESS ***
      setAutoFillProgress(prev => prev ? {
        ...prev,
        isActive: false,
        isPaused: false,
        remainingPauseTime: 0,
        currentStaffName: 'Completed',
        nextStaffName: undefined
      } : undefined);

      // Show final message
      let resultType: MessageBarType;
      let resultMessage: string;

      if (errorCount === 0) {
        resultType = MessageBarType.success;
        resultMessage = `Auto-fill completed! Processed: ${processedCount}, Skipped: ${skippedCount} of ${autoScheduleStaff.length} staff members.`;
      } else if (processedCount > 0) {
        resultType = MessageBarType.warning;
        resultMessage = `Auto-fill completed with issues. Processed: ${processedCount}, Skipped: ${skippedCount}, Errors: ${errorCount} of ${autoScheduleStaff.length} staff members.`;
      } else {
        resultType = MessageBarType.error;
        resultMessage = `Auto-fill failed. No staff members were processed successfully. Errors: ${errorCount}, Skipped: ${skippedCount}.`;
      }

      setInfoMessage({
        text: resultMessage,
        type: resultType
      });

      console.log(`[useDashboardLogic] 🏁 AUTO FILL ALL COMPLETED WITHOUT DIALOGS:`, {
        total: autoScheduleStaff.length,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
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
      console.error('[useDashboardLogic] Auto-fill all error:', error);
      setInfoMessage({
        text: `Error in Auto Fill All operation: ${error}`,
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

  // *** NEW: AUTO-FILL ALL FUNCTION ***
  const handleAutoFillAll = useCallback(async (): Promise<void> => {
    console.log(`[useDashboardLogic] 🚀 AUTO FILL ALL STARTED for period: ${formatDate(selectedDate)}`);
    
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
      message: `Do you want to automatically fill schedules for ${autoScheduleStaff.length} staff members with Auto Schedule enabled for ${formatDate(selectedDate)} period?\n\nThis will process each staff member automatically without additional confirmations.`,
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
    
    // *** DATE HANDLING ***
    handleDateChange,
    
    // *** AUTOSCHEDULE ***
    handleAutoscheduleToggle,
    
    // *** FILL OPERATIONS ***
    handleFillStaff: fillHook.handleFillStaff,
    handleFillAll: fillHook.handleFillAll, // LEGACY: for compatibility
    handleAutoFillAll, // NEW: auto-fill function with progress tracking
    
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