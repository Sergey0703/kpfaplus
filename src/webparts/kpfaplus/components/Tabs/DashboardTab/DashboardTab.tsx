// src/webparts/kpfaplus/components/Tabs/DashboardTab/DashboardTab.tsx
// ИСПРАВЛЕНО: Удалены все элементы кэша, так как кэш не используется
import * as React from 'react';
import { useCallback, useMemo } from 'react';
import { MessageBar } from '@fluentui/react';
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
  
  // *** GET GROUP ID AND LOADING STATE FROM CONTEXT ***
  const { selectedDepartmentId, loadingState } = useDataContext();
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
    getCachedLogsForStaff,
    registerTableResetCallback
  } = useDashboardLogic({
    context,
    currentUserId,
    managingGroupId: effectiveGroupId
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
    clearLogCacheAvailable: !!clearLogCache,
    registerTableResetCallbackAvailable: !!registerTableResetCallback,
    selectedDate: selectedDate?.toLocaleDateString(),
    // *** NEW: LoadingState info ***
    loadingStateAvailable: !!loadingState,
    isStaffLoading: loadingState?.loadingSteps.some(step => 
      step.id === 'fetch-group-members' && step.status === 'loading'
    )
  });

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

  // *** ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ЛОГОВ ПО STAFF ID ***
  const getCachedLogsForStaffMember = useCallback((staffId: string) => {
    return stableCachedLogs[staffId] || { hasLog: false, isLoading: false, error: undefined };
  }, [stableCachedLogs]);

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
            </span>
          )}
        </div>
      </div>

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
          clearLogCache: !!clearLogCache,
          registerTableResetCallback: !!registerTableResetCallback,
          selectedDate: selectedDate?.toLocaleDateString(),
          // *** NEW: LoadingState передача ***
          loadingState: !!loadingState,
          loadingStepsCount: loadingState?.loadingSteps.length,
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
          clearLogCache={clearLogCache}
          registerTableResetCallback={registerTableResetCallback}
          loadingState={loadingState} // *** NEW: Передаем loadingState ***
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