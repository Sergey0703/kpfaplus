// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogic.ts
// UPDATED: NO CACHE - ALWAYS FETCH FRESH DATA
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { useDataContext } from '../../../../context';
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { CommonFillService, IFillParams } from '../../../../services/CommonFillService';
import { ScheduleLogsService } from '../../../../services/ScheduleLogsService';

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

// *** NO CACHE - LIVE LOG DATA STATE ***
interface ILiveLogData {
  [staffId: string]: {
    log?: any;
    error?: string;
    isLoading: boolean;
  };
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

export const useDashboardLogic = (params: IUseDashboardLogicParams) => {
  const { context, currentUserId, managingGroupId } = params;
  
  console.log('[useDashboardLogic] Hook initialized - NO CACHE - ALWAYS FRESH FETCH');

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
    onConfirm: () => {}
  });

  // *** NO CACHE - LIVE DATA STATE ***
  const [liveLogData, setLiveLogData] = useState<ILiveLogData>({});

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<number | null>(null);

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

  // Combined loading state
  const combinedIsLoading = useMemo(() => {
    return isLoading || isLoadingLogs;
  }, [isLoading, isLoadingLogs]);

  // *** NO CACHE - LIVE DATA FUNCTIONS ***
  const clearLogData = useCallback((): void => {
    console.log('[useDashboardLogic] 🧹 Clearing live log data (NO CACHE)');
    setLiveLogData({});
  }, []);

  const getLogStats = useCallback(() => {
    let success = 0;
    let error = 0;
    let noLogs = 0;
    let loading = 0;

    Object.values(liveLogData).forEach(entry => {
      if (entry.isLoading) loading++;
      else if (entry.error) error++;
      else if (entry.log) {
        if (entry.log.Result === 2) success++;
        else error++;
      } else noLogs++;
    });

    return { success, error, noLogs, loading, cached: 0, expired: 0 };
  }, [liveLogData]);

  // *** RETURN LIVE LOG DATA (NO CACHE) ***
  const getLiveLogsForStaff = useCallback((): { [staffId: string]: any } => {
    console.log(`[useDashboardLogic] 📊 Getting live log data for ${Object.keys(liveLogData).length} staff members`);
    return liveLogData;
  }, [liveLogData]);

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

  // Clear data when group changes
  useEffect(() => {
    if (managingGroupId) {
      console.log(`[useDashboardLogic] 🔄 Group changed to: ${managingGroupId}, clearing live data`);
      clearLogData();
    }
  }, [managingGroupId, clearLogData]);

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
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Helper functions
  const setLogLoadingState = useCallback((loading: boolean): void => {
    console.log(`[useDashboardLogic] Setting log loading state: ${loading}`);
    setIsLoadingLogs(loading);
  }, []);

  const handleInitialLoadComplete = useCallback((): void => {
    console.log('[useDashboardLogic] Initial load completed, stopping loading spinner');
    setIsLoadingLogs(false);
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

      debounceTimerRef.current = window.setTimeout(() => {
        console.log('[useDashboardLogic] Applying debounced date change:', formatDate(date));
        
        try {
          sessionStorage.setItem('dashboardTab_selectedDate', date.toISOString());
        } catch (error) {
          console.warn('[useDashboardLogic] Error saving date:', error);
        }
        
        setSelectedDate(date);
        clearLogData();
        
        setTimeout(() => {
          console.log('[useDashboardLogic] Auto-stopping loading state after period change');
          setLogLoadingState(false);
        }, 2000);
        
      }, DEBOUNCE_DELAY);
    }
  }, [clearLogData, setLogLoadingState]);

  // Create fill parameters
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

  // *** ALWAYS FRESH FETCH - NO CACHE ***
  const handleLogRefresh = useCallback(async (staffId: string, isInitialLoad: boolean = false): Promise<void> => {
    if (!logsService) {
      console.log('[useDashboardLogic] Cannot refresh log: service not available');
      if (isInitialLoad) handleInitialLoadComplete();
      return;
    }

    const staffMember = staffMembersData.find(staff => staff.id === staffId);
    if (!staffMember?.employeeId) {
      console.log('[useDashboardLogic] Cannot refresh log: staff not found or no employeeId');
      if (isInitialLoad) handleInitialLoadComplete();
      return;
    }

    console.log(`[useDashboardLogic] 🔄 FRESH FETCH for ${staffMember.name} (period: ${formatDate(selectedDate)}) ${isInitialLoad ? '[INITIAL]' : ''}`);
    console.log(`[useDashboardLogic] 📋 FILTER PARAMS:
      - StaffMemberId: ${staffMember.employeeId}
      - ManagerId: ${currentUserId}
      - StaffGroupId: ${managingGroupId}
      - PeriodDate: ${selectedDate.toLocaleDateString()}`);

    // Set loading state
    setLiveLogData(prev => ({
      ...prev,
      [staffId]: {
        log: undefined,
        error: undefined,
        isLoading: true
      }
    }));

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // *** ALWAYS FETCH FRESH - CHECK ALL FILTER PARAMETERS ***
      const logsResult = await logsService.getScheduleLogs({
        staffMemberId: staffMember.employeeId,   // ✅ Staff filter
        managerId: currentUserId,                // ✅ Manager filter  
        staffGroupId: managingGroupId,           // ✅ Group filter
        periodDate: selectedDate,                // ✅ Period filter
        top: 1,
        skip: 0
      });

      if (logsResult.error) {
        throw new Error(logsResult.error);
      }

      const lastLog = logsResult.logs.length > 0 ? logsResult.logs[0] : undefined;
      
      console.log(`[useDashboardLogic] ✅ FRESH DATA RECEIVED for ${staffMember.name}: ${lastLog ? `Found log ID=${lastLog.ID}, Result=${lastLog.Result}` : 'No logs found'}`);

      // Update live data
      setLiveLogData(prev => ({
        ...prev,
        [staffId]: {
          log: lastLog,
          error: undefined,
          isLoading: false
        }
      }));

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[useDashboardLogic] Log refresh aborted for ${staffMember.name}`);
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[useDashboardLogic] ❌ ERROR fetching log for ${staffMember.name}:`, errorMessage);
      
      // Update with error
      setLiveLogData(prev => ({
        ...prev,
        [staffId]: {
          log: undefined,
          error: errorMessage,
          isLoading: false
        }
      }));
    } finally {
      if (isInitialLoad) {
        setTimeout(() => {
          handleInitialLoadComplete();
        }, 500);
      }
    }
  }, [logsService, staffMembersData, selectedDate, handleInitialLoadComplete, currentUserId, managingGroupId]);

  // *** BULK FRESH FETCH - NO CACHE ***
  const handleBulkLogRefresh = useCallback(async (staffIds: string[], isInitialLoad: boolean = false): Promise<void> => {
    console.log(`[useDashboardLogic] 🔄 BULK FRESH FETCH called with ${staffIds.length} staff IDs, isInitialLoad: ${isInitialLoad}`);
    console.log(`[useDashboardLogic] Staff IDs: ${staffIds.join(', ')}`);
    console.log(`[useDashboardLogic] Logs service available: ${!!logsService}`);
    
    if (!logsService || staffIds.length === 0) {
      console.log('[useDashboardLogic] Cannot execute bulk refresh: no service or no staff IDs');
      if (isInitialLoad) handleInitialLoadComplete();
      return;
    }

    console.log(`[useDashboardLogic] 🚀 BULK FRESH FETCH for ${staffIds.length} staff members (period: ${formatDate(selectedDate)}) ${isInitialLoad ? '[INITIAL]' : ''}`);

    if (!isInitialLoad) {
      setLogLoadingState(true);
    }

    const batchSize = 3;
    const batches: string[][] = [];
    
    for (let i = 0; i < staffIds.length; i += batchSize) {
      batches.push(staffIds.slice(i, i + batchSize));
    }

    let completedFirstBatch = false;

    for (const batch of batches) {
      console.log(`[useDashboardLogic] Processing batch: ${batch.join(', ')}`);
      
      const promises = batch.map(staffId => 
        handleLogRefresh(staffId, isInitialLoad && !completedFirstBatch)
      );
      
      try {
        await Promise.all(promises);
        console.log(`[useDashboardLogic] Batch completed: ${batch.join(', ')}`);
      } catch (error) {
        console.warn('[useDashboardLogic] Some log refreshes failed:', error);
      }

      completedFirstBatch = true;
      
      if (batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[useDashboardLogic] Bulk refresh completed for period: ${formatDate(selectedDate)} ${isInitialLoad ? '[INITIAL]' : ''}`);
    
    if (!isInitialLoad) {
      setTimeout(() => {
        setLogLoadingState(false);
      }, 1000);
    }
  }, [logsService, selectedDate, handleLogRefresh, setLogLoadingState, handleInitialLoadComplete]);

  // Fill operations (simplified - no cache clearing needed)
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
      console.log(`[useDashboardLogic] Starting fill for ${staffName} (period: ${formatDate(selectedDate)})`);

      const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);

      setInfoMessage({
        text: result.message,
        type: result.messageType
      });

      if (result.success) {
        console.log(`[useDashboardLogic] Fill successful for ${staffName} - will refresh log`);
        
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
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`[useDashboardLogic] Fill error for ${staffMember.name}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        errorCount++;
      }
    }

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

    if (processedStaffIds.length > 0) {
      setTimeout(() => {
        void handleBulkLogRefresh(processedStaffIds);
      }, 2000);
    }
  }, [fillService, selectedDate, staffMembersData, createFillParams, handleBulkLogRefresh]);

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
  }, [staffMembersData, selectedDate, fillService, createFillParams, performFillAllOperation]);

  return {
    staffMembersData,
    selectedDate,
    isLoading: combinedIsLoading,
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
    clearLogCache: clearLogData,        // *** RENAMED ***
    getLogCacheStats: getLogStats,      // *** RENAMED ***
    startInitialLoading,
    getCachedLogsForStaff: getLiveLogsForStaff  // *** RENAMED TO LIVE DATA ***
  };
};