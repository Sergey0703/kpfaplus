// src/webparts/kpfaplus/components/Tabs/DashboardTab/DashboardTab.tsx
// COMPLETE IMPLEMENTATION: Enhanced Auto-Fill with timer, spinner, and execution time tracking
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

  console.log('[DashboardTab] Rendering with enhanced logging, optimization and Auto Fill support');
  console.log('[DashboardTab] Group ID resolution:', {
    propsGroupId: managingGroupId,
    contextGroupId: selectedDepartmentId,
    effectiveGroupId
  });

  // *** Get all functions and data from the hook ***
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
    handleAutoFillAll, // NEW: auto-fill function
    autoFillProgress, // NEW: progress tracking
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

  // *** STABILIZED DATA FOR TABLE ***
  const stableCachedLogs = useMemo(() => {
    const logs = getCachedLogsForStaff();
    console.log('[DashboardTab] 📊 MEMOIZED DATA FOR TABLE:', {
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

  // *** ADDITIONAL LOGGING FOR DATA PASSING ***
  console.log('[DashboardTab] 🔍 DATA PASSING CHECK TO DASHBOARDTABLE:', {
    effectiveGroupId,
    staffCount: staffMembersData.length,
    cachedLogsCount: Object.keys(stableCachedLogs).length,
    logsServiceAvailable: !!logsService,
    handleBulkLogRefreshAvailable: !!handleBulkLogRefresh,
    clearLogCacheAvailable: !!clearLogCache,
    registerTableResetCallbackAvailable: !!registerTableResetCallback,
    selectedDate: selectedDate?.toLocaleDateString(),
    loadingStateAvailable: !!loadingState,
    isStaffLoading: loadingState?.loadingSteps.some(step => 
      step.id === 'fetch-group-members' && step.status === 'loading'
    ),
    handleAutoFillAllAvailable: !!handleAutoFillAll
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

  // *** FUNCTION TO GET LOGS BY STAFF ID ***
  const getCachedLogsForStaffMember = useCallback((staffId: string) => {
    return stableCachedLogs[staffId] || { hasLog: false, isLoading: false, error: undefined };
  }, [stableCachedLogs]);

  // Show loading spinner if loading
  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        paddingTop: '40px', // Reduced from default padding - less space from top
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: '#fafafa',
        justifyContent: 'flex-start', // Changed from center to start
        alignItems: 'center'
      }}>
        {/* Enhanced Loading Spinner with Auto-Fill Progress */}
        {autoFillProgress && autoFillProgress.isActive ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '40px',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            border: '1px solid #e1e5e9',
            minWidth: '500px',
            maxWidth: '600px'
          }}>
            {/* Progress Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '24px',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#107c10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: 'white', fontSize: '20px', fontWeight: 'bold' }}>AF</span>
              </div>
              <div>
                <h2 style={{ 
                  margin: 0, 
                  color: '#323130', 
                  fontSize: '20px', 
                  fontWeight: '600' 
                }}>
                  Auto Fill in Progress
                </h2>
                <p style={{ 
                  margin: 0, 
                  color: '#605e5c', 
                  fontSize: '14px' 
                }}>
                  Processing staff members with Auto Schedule enabled
                </p>
              </div>
            </div>

            {/* Execution Timer */}
            <div style={{
              width: '100%',
              textAlign: 'center',
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#f0f7ff',
              borderRadius: '8px',
              border: '1px solid #b3d7ff'
            }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0078d4', marginBottom: '4px' }}>
                {(() => {
                  const minutes = Math.floor(autoFillProgress.elapsedTime / 60000);
                  const seconds = Math.floor((autoFillProgress.elapsedTime % 60000) / 1000);
                  return minutes > 0 ? `${minutes}:${seconds.toString().padStart(2, '0')}` : `${seconds}s`;
                })()}
              </div>
              <div style={{ fontSize: '12px', color: '#605e5c' }}>
                Execution Time
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{
              width: '100%',
              backgroundColor: '#f3f2f1',
              borderRadius: '8px',
              height: '12px',
              marginBottom: '16px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${(autoFillProgress.completed / autoFillProgress.total) * 100}%`,
                height: '100%',
                backgroundColor: '#107c10',
                borderRadius: '8px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Progress Counter */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: '20px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              <span style={{ color: '#323130' }}>
                Progress: {autoFillProgress.completed} / {autoFillProgress.total}
              </span>
              <span style={{ color: '#107c10' }}>
                {Math.round((autoFillProgress.completed / autoFillProgress.total) * 100)}%
              </span>
            </div>

            {/* Current Activity */}
            <div style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e1e5e9',
              marginBottom: '20px'
            }}>
              {autoFillProgress.isPaused ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ff8c00',
                    animation: 'pulse 1.5s infinite'
                  }} />
                  <span style={{ color: '#323130', fontWeight: '500' }}>
                    ⏳ Waiting {Math.ceil(autoFillProgress.remainingPauseTime / 1000)} seconds before processing next staff member...
                  </span>
                </div>
              ) : autoFillProgress.isProcessing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #f3f3f3',
                    borderTop: '2px solid #107c10',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ color: '#323130', fontWeight: '500' }}>
                    🔄 Processing: {autoFillProgress.currentStaffName}...
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#107c10'
                  }} />
                  <span style={{ color: '#323130', fontWeight: '500' }}>
                    ✅ Completed: {autoFillProgress.currentStaffName}
                  </span>
                </div>
              )}
            </div>

            {/* Results Summary */}
            {autoFillProgress.completed > 0 && (
              <div style={{
                width: '100%',
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                {autoFillProgress.successCount > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: '#dff6dd',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#107c10'
                  }}>
                    ✓ {autoFillProgress.successCount} Success
                  </div>
                )}
                {autoFillProgress.skippedCount > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: '#fff4ce',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#ff8c00'
                  }}>
                    ⚠ {autoFillProgress.skippedCount} Skipped
                  </div>
                )}
                {autoFillProgress.errorCount > 0 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    backgroundColor: '#fde7e9',
                    borderRadius: '16px',
                    fontSize: '12px',
                    fontWeight: '500',
                    color: '#d13438'
                  }}>
                    ✗ {autoFillProgress.errorCount} Errors
                  </div>
                )}
              </div>
            )}

            {/* Next Staff Member Info */}
            {!autoFillProgress.isPaused && !autoFillProgress.isProcessing && autoFillProgress.nextStaffName && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                backgroundColor: '#f0f7ff',
                borderRadius: '6px',
                border: '1px solid #b3d7ff',
                fontSize: '12px',
                color: '#0078d4',
                width: '100%',
                textAlign: 'center'
              }}>
                Next: {autoFillProgress.nextStaffName}
              </div>
            )}

            {/* CSS Animations */}
            <style>{`
              @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
              }
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        ) : (
          <LoadingSpinner showDetails={true} />
        )}
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
          {/* Auto Fill support indicator */}
          <span style={{ color: '#107c10', fontWeight: '500' }}>
            <strong>Auto Fill:</strong> Available
          </span>
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
          onAutoFillAll={handleAutoFillAll} // NEW: auto-fill function
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
        {/* CRITICAL: Data passing verification */}
        {console.log('[DashboardTab] 🚀 PASSING DATA TO DASHBOARDTABLE NOW:', {
          effectiveGroupId,
          handleBulkLogRefresh: !!handleBulkLogRefresh,
          staffCount: staffMembersData.length,
          logsService: !!logsService,
          cachedLogsKeys: Object.keys(stableCachedLogs),
          cachedLogsCount: Object.keys(stableCachedLogs).length,
          clearLogCache: !!clearLogCache,
          registerTableResetCallback: !!registerTableResetCallback,
          selectedDate: selectedDate?.toLocaleDateString(),
          loadingState: !!loadingState,
          loadingStepsCount: loadingState?.loadingSteps.length,
          handleAutoFillAllAvailable: true,
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
     //     onAutoFillAll={handleAutoFillAll} // NEW: auto-fill function
          onAutoscheduleToggle={handleAutoscheduleToggle}
          getCachedLogsForStaff={getCachedLogsForStaffMember}
          clearLogCache={clearLogCache}
          registerTableResetCallback={registerTableResetCallback}
          loadingState={loadingState} // Loading state for synchronization
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