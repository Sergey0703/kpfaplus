// src/webparts/kpfaplus/components/Tabs/DashboardTab/DashboardTab.tsx
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { MessageBar, CommandBar, ICommandBarItemProps } from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { DashboardControlPanel } from './components/DashboardControlPanel';
import { DashboardTable } from './components/DashboardTable';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../LoadingSpinner/LoadingSpinner';
import { useDashboardLogic } from './hooks/useDashboardLogic';
import { useDataContext } from '../../../context';

interface IConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  onConfirm: () => void;
}

export const DashboardTab: React.FC<ITabProps> = (props) => {
  const { managingGroupId, currentUserId, context } = props;
  
  // *** GET GROUP ID FROM CONTEXT IF NOT IN PROPS ***
  const { selectedDepartmentId } = useDataContext();
  const effectiveGroupId = managingGroupId || selectedDepartmentId;

  console.log('[DashboardTab] Rendering with enhanced logging, optimization and Date field support');
  console.log('[DashboardTab] Group ID resolution:', {
    propsGroupId: managingGroupId,
    contextGroupId: selectedDepartmentId,
    effectiveGroupId
  });

  // Get all functions and data from the hook
  const {
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
    getLogCacheStats,
    getCachedLogsForStaff // *** CRITICAL: Get live logs function ***
  } = useDashboardLogic({
    context,
    currentUserId,
    managingGroupId: effectiveGroupId // *** FIXED: Use effective group ID ***
  });

  // *** КРИТИЧЕСКИ ВАЖНО: СТАБИЛИЗИРОВАННЫЕ ДАННЫЕ ДЛЯ ПЕРЕДАЧИ В ТАБЛИЦУ ***
  const stableCachedLogs = useMemo(() => {
    const logs = getCachedLogsForStaff();
    console.log('[DashboardTab] 📊 МЕМОИЗИРОВАННЫЕ ДАННЫЕ ДЛЯ ТАБЛИЦЫ:', {
      totalLogs: Object.keys(logs).length,
      effectiveGroupId,
      logKeys: Object.keys(logs),
      sampleLogData: Object.keys(logs).slice(0, 2).map(key => ({
        staffId: key,
        hasLog: !!logs[key]?.log,
        logId: logs[key]?.log?.ID,
        logResult: logs[key]?.log?.Result,
        isLoading: logs[key]?.isLoading,
        error: logs[key]?.error
      }))
    });
    return logs;
  }, [getCachedLogsForStaff, effectiveGroupId]);

  // *** ДОПОЛНИТЕЛЬНОЕ ЛОГИРОВАНИЕ ПЕРЕДАЧИ ДАННЫХ ***
  console.log('[DashboardTab] 🔍 ПРОВЕРКА ПЕРЕДАЧИ ДАННЫХ В DASHBOARDTABLE:', {
    effectiveGroupId,
    staffCount: staffMembersData.length,
    cachedLogsCount: Object.keys(stableCachedLogs).length,
    logsServiceAvailable: !!logsService,
    handleBulkLogRefreshAvailable: !!handleBulkLogRefresh,
    clearLogCacheAvailable: !!clearLogCache, // *** ДОБАВЛЕНО ***
    selectedDate: selectedDate?.toLocaleDateString()
  });

  // Cache statistics
  const cacheStats = getLogCacheStats();

  // Format selected date
  const formatSelectedDate = useCallback((): string => {
    if (!selectedDate) return 'N/A';
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const year = selectedDate.getFullYear();
    return `${day}.${month}.${year}`;
  }, [selectedDate]);

  // Get period display name
  const getPeriodDisplayName = useCallback((): string => {
    if (!selectedDate) return 'N/A';
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[selectedDate.getMonth()];
    const year = selectedDate.getFullYear();
    return `${monthName} ${year}`;
  }, [selectedDate]);

  // Handle confirm dialog dismiss
  const handleDismissConfirmDialog = useCallback((): void => {
    setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
  }, [setConfirmDialog]);

  // Handle refresh all logs
  const handleRefreshAllLogs = useCallback((): void => {
    console.log(`[DashboardTab] Triggering bulk log refresh for period: ${formatSelectedDate()}`);
    const staffIds = staffMembersData.map(staff => staff.id);
    void handleBulkLogRefresh(staffIds);
  }, [staffMembersData, handleBulkLogRefresh, formatSelectedDate]);

  // Handle clear cache
  const handleClearCache = useCallback((): void => {
    console.log('[DashboardTab] Clearing log cache manually');
    clearLogCache();
    setInfoMessage({
      text: `Log cache cleared for period ${formatSelectedDate()}`,
      type: 1 // MessageBarType.success
    });
  }, [clearLogCache, formatSelectedDate, setInfoMessage]);

  // *** ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ЛОГОВ ПО STAFF ID ***
  const getCachedLogsForStaffMember = useCallback((staffId: string) => {
    return stableCachedLogs[staffId] || { hasLog: false, isLoading: false, error: undefined };
  }, [stableCachedLogs]);

  // Command bar items
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh-all-logs',
      text: 'Refresh All Logs',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefreshAllLogs,
      disabled: !logsService || staffMembersData.length === 0,
      title: `Refresh logs for all staff members (Period: ${formatSelectedDate()})`
    },
    {
      key: 'clear-cache',
      text: 'Clear Cache',
      iconProps: { iconName: 'Clear' },
      onClick: handleClearCache,
      disabled: cacheStats.cached === 0,
      title: 'Clear cached logs to force refresh from server'
    }
  ];

  // Command bar far items
  const commandBarFarItems: ICommandBarItemProps[] = [
    {
      key: 'period-info',
      text: `Period: ${formatSelectedDate()}`,
      iconProps: { iconName: 'Calendar' },
      disabled: true,
      title: `Current selected period: ${getPeriodDisplayName()}`
    },
    {
      key: 'cache-info',
      text: `Cache: ${cacheStats.cached}/${cacheStats.cached + cacheStats.expired}`,
      iconProps: { iconName: 'Database' },
      disabled: true,
      title: `Log cache status: ${cacheStats.cached} active, ${cacheStats.expired} expired entries`
    }
  ];

  // Show loading spinner if loading
  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#fafafa',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <LoadingSpinner showDetails={true} />
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#fafafa'
    }}>
      {/* Header with period information */}
      <div style={{ 
        marginBottom: '15px',
        padding: '15px',
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e1e5e9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 10px 0',
          color: '#323130',
          fontSize: '24px',
          fontWeight: '600'
        }}>
          Dashboard - {getPeriodDisplayName()}
        </h2>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '15px',
          fontSize: '14px',
          color: '#666'
        }}>
          <span><strong>Group ID:</strong> {effectiveGroupId || 'N/A'}</span>
          <span><strong>User ID:</strong> {currentUserId || 'N/A'}</span>
          <span><strong>Active Staff:</strong> {staffMembersData.length}</span>
          <span><strong>Selected Period:</strong> {formatSelectedDate()}</span>
          {logsService && (
            <span style={{ color: '#0078d4', fontWeight: '500' }}>
              <strong>Logs Service:</strong> Active 
              (Cache: {cacheStats.cached}/{cacheStats.cached + cacheStats.expired})
            </span>
          )}
        </div>
      </div>

      {/* Command bar */}
      {logsService && (
        <div style={{ marginBottom: '15px' }}>
          <CommandBar
            items={commandBarItems}
            farItems={commandBarFarItems}
            styles={{
              root: {
                padding: 0,
                height: '44px',
                backgroundColor: '#ffffff',
                border: '1px solid #e1e5e9',
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }
            }}
          />
        </div>
      )}

      {/* Info message */}
      {infoMessage && infoMessage.type !== 4 && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar 
            messageBarType={infoMessage.type}
            onDismiss={() => setInfoMessage(undefined)}
            dismissButtonAriaLabel="Close"
            isMultiline={false}
            styles={{
              root: {
                borderRadius: '6px'
              }
            }}
          >
            {infoMessage.text}
          </MessageBar>
        </div>
      )}

      {/* Control panel */}
      <div style={{ marginBottom: '20px' }}>
        <DashboardControlPanel
          selectedDate={selectedDate}
          isLoading={isLoading}
          staffCount={staffMembersData.length}
          onDateChange={handleDateChange}
          onFillAll={handleFillAll}
        />
      </div>

      {/* Main table */}
      <div style={{ 
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e1e5e9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {/* *** КРИТИЧЕСКИ ВАЖНО: ПРОВЕРЯЕМ ПЕРЕДАЧУ ДАННЫХ ПРЯМО ПЕРЕД РЕНДЕРОМ *** */}
        {console.log('[DashboardTab] 🚀 ПЕРЕДАЧА ДАННЫХ В DASHBOARDTABLE СЕЙЧАС:', {
          effectiveGroupId,
          handleBulkLogRefresh: !!handleBulkLogRefresh,
          staffCount: staffMembersData.length,
          logsService: !!logsService,
          cachedLogsKeys: Object.keys(stableCachedLogs),
          cachedLogsCount: Object.keys(stableCachedLogs).length,
          clearLogCache: !!clearLogCache, // *** ДОБАВЛЕНО ***
          selectedDate: selectedDate?.toLocaleDateString(),
          sampleCachedLogData: Object.keys(stableCachedLogs).slice(0, 1).map(key => ({
            staffId: key,
            hasLog: !!stableCachedLogs[key]?.log,
            logId: stableCachedLogs[key]?.log?.ID,
            isLoading: stableCachedLogs[key]?.isLoading
          }))
        })}
        
        <DashboardTable
          staffMembersData={staffMembersData}
          selectedDate={selectedDate}
          logsService={logsService}
          isLoading={isLoading}
          infoMessage={infoMessage}
          confirmDialog={confirmDialog}
          setInfoMessage={setInfoMessage}
          setConfirmDialog={setConfirmDialog}
          managingGroupId={effectiveGroupId}
          onBulkLogRefresh={handleBulkLogRefresh}
          onLogRefresh={handleLogRefresh}
          onFillStaff={handleFillStaff}
          onFillAll={handleFillAll}
          onAutoscheduleToggle={handleAutoscheduleToggle}
          getCachedLogsForStaff={getCachedLogsForStaffMember}
          clearLogCache={clearLogCache} // *** ДОБАВЛЕНО: ПЕРЕДАЧА clearLogCache ***
        />
      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={
          confirmDialog.message.toLowerCase().includes('period') || 
          confirmDialog.message.toLowerCase().includes(formatSelectedDate().toLowerCase()) 
            ? confirmDialog.message 
            : `${confirmDialog.message}\n\nPeriod: ${getPeriodDisplayName()} (${formatSelectedDate()})`
        }
        confirmButtonText={confirmDialog.confirmButtonText}
        cancelButtonText={confirmDialog.cancelButtonText}
        onConfirm={confirmDialog.onConfirm}
        onDismiss={handleDismissConfirmDialog}
        confirmButtonColor={confirmDialog.confirmButtonColor}
      />
    </div>
  );
};