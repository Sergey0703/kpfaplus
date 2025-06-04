// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogs.ts
// ИСПРАВЛЕНО: Полностью убран кэш - всегда возвращаем пустые данные до явной загрузки
import { useState, useCallback, useRef } from 'react';
import { ScheduleLogsService } from '../../../../services/ScheduleLogsService';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';

// *** ИНТЕРФЕЙСЫ ДЛЯ ЛОГОВ ***
interface ILiveLogData {
  [staffId: string]: {
    log?: any;
    error?: string;
    isLoading: boolean;
  };
}

export interface ILogStats {
  success: number;
  error: number;
  noLogs: number;
  loading: number;
  cached: number;
  expired: number;
}

interface IUseDashboardLogsParams {
  logsService?: ScheduleLogsService;
  staffMembersData: IStaffMemberWithAutoschedule[];
  selectedDate: Date;
  currentUserId?: string;
  managingGroupId?: string;
}

interface IUseDashboardLogsReturn {
  liveLogData: ILiveLogData;
  dataUpdateCounter: number;
  handleLogRefresh: (staffId: string, isInitialLoad?: boolean) => Promise<void>;
  handleBulkLogRefresh: (staffIds: string[], isInitialLoad?: boolean) => Promise<void>;
  clearLogData: () => void;
  getLogStats: () => ILogStats;
  getLiveLogsForStaff: () => { [staffId: string]: any };
  handleInitialLoadComplete: () => void;
}

// Utility functions
const formatDate = (date?: Date): string => {
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

export const useDashboardLogs = (params: IUseDashboardLogsParams): IUseDashboardLogsReturn => {
  const { logsService, staffMembersData, selectedDate, currentUserId, managingGroupId } = params;

  console.log('[useDashboardLogs] Logs hook initialized - NO CACHE MODE');

  // *** STATE FOR LIVE LOG DATA - БЕЗ КЭША ***
  const [liveLogData, setLiveLogData] = useState<ILiveLogData>({});
  const [dataUpdateCounter, setDataUpdateCounter] = useState<number>(0);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);

  // *** CLEAR LOG DATA ***
  const clearLogData = useCallback((): void => {
    console.log('[useDashboardLogs] 🧹 Clearing live log data - NO CACHE');
    setLiveLogData({});
    setDataUpdateCounter(prev => {
      const newCounter = prev + 1;
      console.log('[useDashboardLogs] 📊 Data counter incremented to (CLEAR):', newCounter);
      return newCounter;
    });
  }, []);

  // *** UPDATE LIVE LOG DATA ***
  const updateLiveLogData = useCallback((staffId: string, data: { log?: any; error?: string; isLoading: boolean }) => {
    console.log(`[useDashboardLogs] 🔄 UPDATING LOG DATA for staff ${staffId} - NO CACHE:`, {
      staffId,
      hasLog: !!data.log,
      logId: data.log?.ID,
      logResult: data.log?.Result,
      isLoading: data.isLoading,
      error: data.error,
      currentGroupId: managingGroupId
    });

    setLiveLogData(prev => {
      const newData = {
        ...prev,
        [staffId]: data
      };
      
      console.log(`[useDashboardLogs] 🔄 UPDATED LOG DATA STATE - NO CACHE:`, {
        totalStaff: Object.keys(newData).length,
        updatedStaffId: staffId,
        allStaffIds: Object.keys(newData)
      });
      
      return newData;
    });
  }, [managingGroupId]);

  // *** GET LOG STATISTICS ***
  const getLogStats = useCallback((): ILogStats => {
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

  // *** БЕЗ КЭША - ВСЕГДА ВОЗВРАЩАЕМ ТОЛЬКО АКТУАЛЬНЫЕ ДАННЫЕ ***
  const getLiveLogsForStaff = useCallback((): { [staffId: string]: any } => {
    console.log(`[useDashboardLogs] 📊 PROVIDING LOG DATA TO COMPONENT - NO CACHE:`, {
      liveLogDataKeys: Object.keys(liveLogData),
      liveLogDataCount: Object.keys(liveLogData).length,
      currentGroupId: managingGroupId,
      sampleData: Object.keys(liveLogData).slice(0, 2).map(key => ({
        staffId: key,
        hasLog: !!liveLogData[key]?.log,
        isLoading: liveLogData[key]?.isLoading,
        error: liveLogData[key]?.error
      }))
    });

    // *** ДЕТАЛЬНОЕ ЛОГИРОВАНИЕ ДАННЫХ БЕЗ КЭША ***
    Object.entries(liveLogData).forEach(([staffId, data]) => {
      console.log(`[useDashboardLogs] 📋 Staff ${staffId} log data - NO CACHE:`, {
        hasLog: !!data.log,
        logId: data.log?.ID,
        logResult: data.log?.Result,
        isLoading: data.isLoading,
        error: data.error
      });
    });

    // *** ВОЗВРАЩАЕМ ТОЛЬКО ЗАГРУЖЕННЫЕ ДАННЫЕ - БЕЗ КЭША ***
    const resultData: { [staffId: string]: any } = {};
    
    Object.entries(liveLogData).forEach(([staffId, data]) => {
      resultData[staffId] = {
        hasLog: !!data.log,
        logId: data.log?.ID,
        logResult: data.log?.Result,
        isLoading: data.isLoading,
        error: data.error
      };
    });

    console.log('[useDashboardLogs] 🚀 RETURNING DATA - NO CACHE:', {
      returnedKeys: Object.keys(resultData),
      returnedCount: Object.keys(resultData).length
    });

    return resultData;
  }, [liveLogData, managingGroupId]);

  // *** HANDLE INITIAL LOAD COMPLETE ***
  const handleInitialLoadComplete = useCallback((): void => {
    console.log('[useDashboardLogs] Initial log load completed - NO CACHE');
  }, []);

  // *** SINGLE LOG REFRESH ***
  const handleLogRefresh = useCallback(async (staffId: string, isInitialLoad: boolean = false): Promise<void> => {
    if (!logsService) {
      console.log('[useDashboardLogs] Cannot refresh log: service not available');
      if (isInitialLoad) handleInitialLoadComplete();
      return;
    }

    const staffMember = staffMembersData.find(staff => staff.id === staffId);
    if (!staffMember?.employeeId) {
      console.log('[useDashboardLogs] Cannot refresh log: staff not found or no employeeId');
      if (isInitialLoad) handleInitialLoadComplete();
      return;
    }

    console.log(`[useDashboardLogs] 🔄 FRESH LOG FETCH - NO CACHE for ${staffMember.name} (period: ${formatDate(selectedDate)}) ${isInitialLoad ? '[INITIAL]' : ''}`);
    console.log(`[useDashboardLogs] 🔍 ID MAPPING DEBUG - NO CACHE:
      - Staff Table ID (KEY): ${staffId}
      - Employee ID (API): ${staffMember.employeeId}
      - Staff Name: ${staffMember.name}`);
    console.log(`[useDashboardLogs] 📋 FILTER PARAMS - NO CACHE:
      - StaffMemberId: ${staffMember.employeeId}
      - ManagerId: ${currentUserId}
      - StaffGroupId: ${managingGroupId}
      - PeriodDate: ${selectedDate.toLocaleDateString()}`);

    // *** SET LOADING STATE ***
    updateLiveLogData(staffId, {
      log: undefined,
      error: undefined,
      isLoading: true
    });

    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      abortControllerRef.current = new AbortController();

      // *** FETCH FRESH LOG DATA ***
      const logsResult = await logsService.getScheduleLogs({
        staffMemberId: staffMember.employeeId,   // ✅ Staff filter (employee ID for API)
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
      
      console.log(`[useDashboardLogs] ✅ FRESH LOG DATA RECEIVED - NO CACHE for ${staffMember.name}: ${lastLog ? `Found log ID=${lastLog.ID}, Result=${lastLog.Result}` : 'No logs found'}`);
      console.log(`[useDashboardLogs] 🔍 STORING DATA WITH KEY - NO CACHE: ${staffId} (Staff Table ID)`);

      // *** STORE LOG DATA WITH STAFF TABLE ID AS KEY ***
      updateLiveLogData(staffId, {
        log: lastLog,
        error: undefined,
        isLoading: false
      });

      // *** VERIFICATION OF STORED DATA ***
      console.log(`[useDashboardLogs] 🔍 LOG DATA STORED VERIFICATION - NO CACHE:`, {
        keyUsed: staffId,
        staffName: staffMember.name,
        hasLog: !!lastLog,
        logId: lastLog?.ID,
        willBeFoundInTable: `Should be found by DashboardTable using key: ${staffId}`
      });

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[useDashboardLogs] Log refresh aborted for ${staffMember.name}`);
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[useDashboardLogs] ❌ ERROR fetching log for ${staffMember.name}:`, errorMessage);
      
      // *** STORE ERROR WITH STAFF TABLE ID AS KEY ***
      updateLiveLogData(staffId, {
        log: undefined,
        error: errorMessage,
        isLoading: false
      });
    } finally {
      if (isInitialLoad) {
        setTimeout(() => {
          handleInitialLoadComplete();
        }, 500);
      }
    }
  }, [logsService, staffMembersData, selectedDate, handleInitialLoadComplete, currentUserId, managingGroupId, updateLiveLogData]);

  // *** BULK LOG REFRESH ***
  const handleBulkLogRefresh = useCallback(async (staffIds: string[], isInitialLoad: boolean = false): Promise<void> => {
    console.log(`[useDashboardLogs] 🔄 BULK LOG REFRESH called - NO CACHE with ${staffIds.length} staff IDs, isInitialLoad: ${isInitialLoad}`);
    console.log(`[useDashboardLogs] Staff IDs - NO CACHE: ${staffIds.join(', ')}`);
    console.log(`[useDashboardLogs] Logs service available: ${!!logsService}`);
    
    if (!logsService || staffIds.length === 0) {
      console.log('[useDashboardLogs] Cannot execute bulk refresh: no service or no staff IDs');
      if (isInitialLoad) handleInitialLoadComplete();
      return;
    }

    console.log(`[useDashboardLogs] 🚀 BULK LOG REFRESH - NO CACHE for ${staffIds.length} staff members (period: ${formatDate(selectedDate)}) ${isInitialLoad ? '[INITIAL]' : ''}`);

    const batchSize = 3;
    const batches: string[][] = [];
    
    for (let i = 0; i < staffIds.length; i += batchSize) {
      batches.push(staffIds.slice(i, i + batchSize));
    }

    let completedFirstBatch = false;

    for (const batch of batches) {
      console.log(`[useDashboardLogs] Processing batch - NO CACHE: ${batch.join(', ')}`);
      
      const promises = batch.map(staffId => 
        handleLogRefresh(staffId, isInitialLoad && !completedFirstBatch)
      );
      
      try {
        await Promise.all(promises);
        console.log(`[useDashboardLogs] Batch completed - NO CACHE: ${batch.join(', ')}`);
      } catch (error) {
        console.warn('[useDashboardLogs] Some log refreshes failed:', error);
      }

      completedFirstBatch = true;
      
      if (batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[useDashboardLogs] Bulk log refresh completed - NO CACHE for period: ${formatDate(selectedDate)} ${isInitialLoad ? '[INITIAL]' : ''}`);
  }, [logsService, selectedDate, handleLogRefresh, handleInitialLoadComplete]);

  return {
    liveLogData,
    dataUpdateCounter,
    handleLogRefresh,
    handleBulkLogRefresh,
    clearLogData,
    getLogStats,
    getLiveLogsForStaff,
    handleInitialLoadComplete
  };
};