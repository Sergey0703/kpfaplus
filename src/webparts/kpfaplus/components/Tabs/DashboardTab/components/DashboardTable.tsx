// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardTable.tsx
// UPDATED: Removed View Log button, added clickable Log Status, removed header controls
import * as React from 'react';
import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  IColumn, 
  SelectionMode,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Toggle,
  Icon,
  TooltipHost,
  PrimaryButton,
  DefaultButton
} from '@fluentui/react';
import { ScheduleLogsService } from '../../../../services/ScheduleLogsService';
import { LogDetailsDialog } from '../../../LogDetailsDialog';
import { ILoadingState } from '../../../../context/types';

// *** INTERFACES ***
export interface IStaffMemberWithAutoschedule {
  id: string;
  name: string;
  employeeId: string;
  autoschedule: boolean;
  deleted: number;
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

interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

interface ILogData {
  hasLog?: boolean;
  logId?: string;
  logResult?: number;
  isLoading?: boolean;
  error?: string;
}

interface IStaffWithLogs extends IStaffMemberWithAutoschedule {
  logData?: ILogData;
}

interface IDashboardTableProps {
  staffMembersData: IStaffMemberWithAutoschedule[];
  selectedDate: Date;
  logsService?: ScheduleLogsService;
  isLoading: boolean;
  infoMessage?: IInfoMessage;
  confirmDialog: IConfirmDialogState;
  setInfoMessage: (message: IInfoMessage | undefined) => void;
  setConfirmDialog: (dialog: IConfirmDialogState) => void;
  managingGroupId?: string;
  onBulkLogRefresh: (staffIds: string[], isInitialLoad?: boolean) => Promise<void>;
  onLogRefresh: (staffId: string) => Promise<void>;
  onFillStaff: (staffId: string, staffName: string) => Promise<void>;
  onAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  getCachedLogsForStaff: (staffId: string) => ILogData;
  clearLogCache?: () => void;
  registerTableResetCallback?: (callback: () => void) => void;
  loadingState?: ILoadingState;
}

// *** UTILITY FUNCTIONS ***
const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

const getLogStatusIcon = (logData?: ILogData): JSX.Element => {
  if (logData?.isLoading) {
    return <Spinner size={SpinnerSize.xSmall} />;
  }
  
  if (logData?.error) {
    return <Icon iconName="ErrorBadge" style={{ color: '#d13438' }} />;
  }
  
  if (logData?.hasLog) {
    const result = logData.logResult;
    if (result === 2) {
      return <Icon iconName="CheckMark" style={{ color: '#107c10' }} />;
    } else if (result === 1) {
      return <Icon iconName="ErrorBadge" style={{ color: '#d13438' }} />;
    } else {
      return <Icon iconName="Warning" style={{ color: '#ff8c00' }} />;
    }
  }
  
  return <Icon iconName="Remove" style={{ color: '#605e5c' }} />;
};

const getLogStatusText = (logData?: ILogData): string => {
  if (logData?.isLoading) return 'Loading...';
  if (logData?.error) return 'Error';
  if (logData?.hasLog) {
    const result = logData.logResult;
    if (result === 2) return 'Success';
    if (result === 1) return 'Error';
    return 'Warning';
  }
  return 'No log';
};

const getLogStatusColor = (logData?: ILogData): string => {
  if (logData?.isLoading) return '#605e5c';
  if (logData?.error) return '#d13438';
  if (logData?.hasLog) {
    const result = logData.logResult;
    if (result === 2) return '#107c10';
    if (result === 1) return '#d13438';
    return '#ff8c00';
  }
  return '#605e5c';
};

// *** MAIN COMPONENT ***
export const DashboardTable: React.FC<IDashboardTableProps> = (props) => {
  const {
    staffMembersData,
    selectedDate,
    logsService,
    isLoading,
    infoMessage,
    setInfoMessage,
    managingGroupId,
    onBulkLogRefresh,
    onLogRefresh,
    onFillStaff,
    onAutoscheduleToggle,
    getCachedLogsForStaff,
    clearLogCache,
    registerTableResetCallback,
    loadingState
  } = props;

  // *** REFS FOR TRACKING ***
  const lastProcessedKeyRef = useRef<string>('');
  const lastGroupRef = useRef<string>('');
  const lastStaffIdsRef = useRef<string>('');
  
  // *** STATE FOR LOADING DURING LOG RELOAD ***
  const [isReloadingLogs, setIsReloadingLogs] = useState<boolean>(false);
  
  const [logDetailsDialog, setLogDetailsDialog] = useState<{
    isOpen: boolean;
    logId?: string;
    staffName?: string;
  }>({ isOpen: false });

  // *** Register reset callback on mount ***
  useEffect(() => {
    if (registerTableResetCallback) {
      const resetCallback = (): void => {
        console.log('[DashboardTable] 🔄 RESETTING TABLE STATE - clearing lastProcessedKeyRef');
        lastProcessedKeyRef.current = '';
      };
      
      console.log('[DashboardTable] 📝 Registering reset callback with useDashboardLogic');
      registerTableResetCallback(resetCallback);
    }
  }, [registerTableResetCallback]);

  // *** Track group changes and reset key (BACKUP SOLUTION) ***
  useEffect(() => {
    if (managingGroupId && managingGroupId !== lastGroupRef.current && lastGroupRef.current !== '') {
      console.log('[DashboardTable] 🔄 GROUP CHANGED DETECTED - BACKUP RESET:', {
        from: lastGroupRef.current,
        to: managingGroupId,
        action: 'Resetting lastProcessedKeyRef as backup'
      });
      
      lastProcessedKeyRef.current = '';
      lastStaffIdsRef.current = '';
    }
    lastGroupRef.current = managingGroupId || '';
  }, [managingGroupId]);

  // *** TRACK STAFF MEMBERS CHANGES AND TRIGGER RELOAD ***
  useEffect(() => {
    const currentStaffIds = staffMembersData.map(staff => staff.id).sort().join(',');
    const previousStaffIds = lastStaffIdsRef.current;
    
    if (previousStaffIds && previousStaffIds !== currentStaffIds && onBulkLogRefresh && logsService && managingGroupId) {
      console.log('[DashboardTable] 🔄 STAFF IDS CHANGED - TRIGGERING LOG RELOAD:', {
        previous: previousStaffIds,
        current: currentStaffIds,
        action: 'Reloading logs for new staff IDs'
      });
      
      setIsReloadingLogs(true);
      
      if (clearLogCache) {
        console.log('[DashboardTable] 🧹 CLEARING LOG DATA due to staff IDs change');
        clearLogCache();
      }
      
      const currentStaffIdsArray = staffMembersData.map(staff => staff.id);
      console.log('[DashboardTable] 🚀 RELOADING LOGS FOR NEW STAFF IDS:', currentStaffIdsArray);
      
      onBulkLogRefresh(currentStaffIdsArray, true)
        .then(() => {
          console.log('[DashboardTable] 🎉 Staff IDs change log reload completed successfully');
          
          const currentKey = `${managingGroupId}-${formatDate(selectedDate)}`;
          lastProcessedKeyRef.current = currentKey;
          lastStaffIdsRef.current = currentStaffIds;
          
          setIsReloadingLogs(false);
        })
        .catch((error: Error) => {
          console.error('[DashboardTable] ❌ Staff IDs change log reload failed:', error);
          setIsReloadingLogs(false);
        });
    }
    
    lastStaffIdsRef.current = currentStaffIds;
  }, [staffMembersData, onBulkLogRefresh, logsService, managingGroupId, selectedDate, clearLogCache]);

  // *** MEMOIZED STAFF DATA WITH LOG STATUS ***
  const staffMembersWithLogs = useMemo((): IStaffWithLogs[] => {
    console.log('[DashboardTable] Recalculating staffMembersWithLogs:', {
      staffCount: staffMembersData.length,
      cachedLogsCount: staffMembersData.length
    });

    return staffMembersData.map((staff: IStaffMemberWithAutoschedule): IStaffWithLogs => {
      const logData = getCachedLogsForStaff(staff.id);
      
      return {
        ...staff,
        logData
      };
    });
  }, [staffMembersData, getCachedLogsForStaff]);

  // *** IMPROVED LOGIC FOR AUTO-LOADING WITH STAFF LOADING SYNCHRONIZATION ***
  useEffect(() => {
    console.log('[DashboardTable] useEffect triggered - checking conditions');

    if (loadingState) {
      const isAppLoading = loadingState.isLoading;
      const isStaffRelatedLoading = loadingState.loadingSteps.some(step => 
        (step.id === 'fetch-group-members' || step.id === 'refresh-staff') && 
        step.status === 'loading'
      );
      
      if (isAppLoading || isStaffRelatedLoading) {
        console.log('[DashboardTable] ⏳ Staff members are loading, waiting...');
        return;
      }
    }

    if (onBulkLogRefresh && staffMembersData.length > 0 && logsService && managingGroupId) {
      const currentStaffIds = staffMembersData.map((staff: IStaffMemberWithAutoschedule) => staff.id);
      const currentKey = `${managingGroupId}-${formatDate(selectedDate)}`;
      const lastKey = lastProcessedKeyRef.current;

      const isNewGroupOrPeriod = currentKey !== lastKey;
      
      if (isNewGroupOrPeriod) {
        console.log('[DashboardTable] ✅ NEW GROUP/PERIOD DETECTED - Triggering initial bulk log refresh');
        
        if (clearLogCache) {
          console.log('[DashboardTable] 🧹 CLEARING LOG DATA due to group/period change');
          clearLogCache();
        }

        onBulkLogRefresh(currentStaffIds, true)
          .then(() => {
            console.log('[DashboardTable] 🎉 Bulk refresh completed successfully');
            lastProcessedKeyRef.current = currentKey;
            lastStaffIdsRef.current = currentStaffIds.join(',');
          })
          .catch((error: Error) => {
            console.error('[DashboardTable] ❌ Bulk refresh failed:', error);
          });
      }
    }
  }, [
    loadingState,
    onBulkLogRefresh, 
    staffMembersData, 
    logsService, 
    managingGroupId, 
    selectedDate, 
    clearLogCache
  ]);

  // *** COLUMN DEFINITIONS WITH CLICKABLE LOG STATUS ***
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Staff Member',
      fieldName: 'name',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 500, fontSize: '13px' }}>{item.name}</span>
        </div>
      )
    },
    {
      key: 'employeeId',
      name: 'Employee ID',
      fieldName: 'employeeId',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => (
        <span style={{ fontSize: '13px' }}>{item.employeeId}</span>
      )
    },
    {
      key: 'logStatus',
      name: 'Log Status',
      fieldName: 'logStatus',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => {
        const logData = item.logData;
        const hasClickableLog = logData?.hasLog && logData?.logId;

        return (
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              cursor: hasClickableLog ? 'pointer' : 'default',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease'
            }}
            onClick={hasClickableLog ? () => {
              setLogDetailsDialog({
                isOpen: true,
                logId: logData.logId,
                staffName: item.name
              });
            } : undefined}
            onMouseEnter={(e) => {
              if (hasClickableLog) {
                e.currentTarget.style.backgroundColor = '#f3f2f1';
              }
            }}
            onMouseLeave={(e) => {
              if (hasClickableLog) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
            title={hasClickableLog ? 'Click to view log details' : undefined}
          >
            {getLogStatusIcon(logData)}
            <span style={{ 
              color: getLogStatusColor(logData), 
              fontSize: '12px',
              fontWeight: 500,
              textDecoration: hasClickableLog ? 'underline' : 'none'
            }}>
              {getLogStatusText(logData)}
            </span>
          </div>
        );
      }
    },
    {
      key: 'actions',
      name: 'Actions',
      fieldName: 'actions',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <TooltipHost content="Refresh log data for this staff member">
            <DefaultButton
              iconProps={{ iconName: 'Refresh' }}
              text="Refresh"
              onClick={(): void => {
                console.log(`[DashboardTable] *** MANUAL REFRESH CLICKED *** for staff ID=${item.id}, Name="${item.name}"`);
                void onLogRefresh(item.id);
              }}
              disabled={isLoading}
              styles={{
                root: { minWidth: '65px', height: '28px' },
                label: { fontSize: '11px' }
              }}
            />
          </TooltipHost>
          
          <TooltipHost content="Fill schedule for this staff member">
            <PrimaryButton
              iconProps={{ iconName: 'Add' }}
              text="Fill"
              onClick={(): void => {
                void onFillStaff(item.id, item.name);
              }}
              disabled={isLoading}
              styles={{
                root: { minWidth: '55px', height: '28px' },
                label: { fontSize: '11px' }
              }}
            />
          </TooltipHost>
        </div>
      )
    },
    {
      key: 'autoschedule',
      name: 'Auto Schedule',
      fieldName: 'autoschedule',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Toggle
            checked={item.autoschedule}
            onChange={(_, checked) => onAutoscheduleToggle(item.id, checked || false)}
            disabled={isLoading}
          />
        </div>
      )
    }
  ];

  // *** EVENT HANDLERS ***
  const handleCloseLogDetails = useCallback((): void => {
    setLogDetailsDialog({ isOpen: false });
  }, []);

  // *** RENDER ***
  return (
    <div style={{ width: '100%', padding: '16px', position: 'relative' }}>
      {/* INFO MESSAGE */}
      {infoMessage && (
        <MessageBar
          messageBarType={infoMessage.type}
          onDismiss={() => setInfoMessage(undefined)}
          dismissButtonAriaLabel="Close"
          styles={{ root: { marginBottom: '16px' } }}
        >
          {infoMessage.text}
        </MessageBar>
      )}

      {/* HEADER CONTROLS - COMMENTED OUT */}
      {/*
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
            Staff Schedule Dashboard
          </h3>
          <span style={{ color: '#605e5c', fontSize: '14px' }}>
            {formatDate(selectedDate)} • {staffMembersData.length} staff members
          </span>
          <span style={{ color: '#107c10', fontSize: '12px', fontWeight: 500 }}>
            🤖 {autoScheduleStaffCount} with Auto Schedule
          </span>
          <span style={{ color: '#0078d4', fontSize: '12px', fontWeight: 500 }}>
            🔄 Auto-refresh enabled
          </span>
          {loadingState && loadingState.loadingSteps.some(step => 
            step.id === 'fetch-group-members' && step.status === 'loading'
          ) && (
            <span style={{ color: '#ff8c00', fontSize: '12px', fontWeight: 500 }}>
              ⏳ Loading staff members...
            </span>
          )}
          {isReloadingLogs && (
            <span style={{ color: '#0078d4', fontSize: '12px', fontWeight: 500 }}>
              🔄 Updating logs...
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <DefaultButton
            iconProps={{ iconName: 'Refresh' }}
            text="Refresh All"
            onClick={(): void => {
              void handleRefreshAll();
            }}
            disabled={isLoading || staffMembersData.length === 0 || isReloadingLogs}
          />
          <PrimaryButton
            iconProps={{ iconName: 'Robot' }}
            text="Auto Fill All"
            onClick={(): void => {
              void handleAutoFillAll();
            }}
            disabled={isLoading || autoScheduleStaffCount === 0 || isReloadingLogs}
            styles={{
              root: {
                backgroundColor: '#107c10',
                borderColor: '#107c10'
              }
            }}
            title={`Automatically fill schedules for ${autoScheduleStaffCount} staff members with Auto Schedule enabled`}
          />
        </div>
      </div>
      */}

      {/* LOADING OVERLAY */}
      {isLoading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          marginBottom: '16px',
          borderRadius: '4px',
          border: '1px solid #edebe9'
        }}>
          <Spinner size={SpinnerSize.medium} label="Processing..." />
        </div>
      )}

      {/* LOG RELOADING OVERLAY */}
      {isReloadingLogs && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            padding: '24px',
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
            border: '1px solid #e1e5e9'
          }}>
            <Spinner size={SpinnerSize.medium} />
            <span style={{ 
              fontSize: '14px', 
              color: '#323130',
              fontWeight: 500
            }}>
              Updating logs for new staff members...
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: '#605e5c'
            }}>
              Please wait while we synchronize the data
            </span>
          </div>
        </div>
      )}

      {/* STAFF TABLE */}
      {staffMembersData.length > 0 ? (
        <DetailsList
          items={staffMembersWithLogs}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          styles={{
            root: {
              border: '1px solid #edebe9',
              borderRadius: '4px',
              opacity: isReloadingLogs ? 0.6 : 1,
              transition: 'opacity 0.2s ease'
            },
            headerWrapper: {
              backgroundColor: '#f3f2f1'
            }
          }}
        />
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#605e5c',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          border: '1px solid #edebe9',
          opacity: isReloadingLogs ? 0.6 : 1,
          transition: 'opacity 0.2s ease'
        }}>
          <Icon iconName="People" style={{ fontSize: '48px', marginBottom: '16px', color: '#c8c6c4' }} />
          <h3 style={{ margin: '0 0 8px 0', color: '#323130' }}>No staff members found</h3>
          <p style={{ margin: 0 }}>No staff members are assigned to this group for the selected period.</p>
        </div>
      )}

      {/* LOG DETAILS DIALOG */}
      <LogDetailsDialog
        isOpen={logDetailsDialog.isOpen}
        logId={logDetailsDialog.logId}
        staffName={logDetailsDialog.staffName}
        logsService={logsService}
        title="Fill Operation Log Details"
        onDismiss={handleCloseLogDetails}
      />
    </div>
  );
};