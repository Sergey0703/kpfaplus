// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardTable.tsx
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
  onFillAll: () => Promise<void>;
  onAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  getCachedLogsForStaff: (staffId: string) => ILogData;
  clearLogCache?: () => void;
  isLogDataCleared?: boolean; // *** NEW: Flag indicating data was cleared ***
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
    onFillAll,
    onAutoscheduleToggle,
    getCachedLogsForStaff,
    clearLogCache,
    isLogDataCleared = false // *** NEW: Get the flag ***
  } = props;

  // *** REFS FOR TRACKING ***
  const lastProcessedKeyRef = useRef<string>('');
  const [logDetailsDialog, setLogDetailsDialog] = useState<{
    isOpen: boolean;
    logId?: string;
    staffName?: string;
  }>({ isOpen: false });

  // *** DEBUG: ПРОВЕРЯЕМ ЧТО ВОЗВРАЩАЕТ getCachedLogsForStaff ***
  console.log('[DashboardTable] *** DEBUG CACHED LOGS FUNCTION ***');
  staffMembersData.forEach((staff: IStaffMemberWithAutoschedule) => {
    const logData = getCachedLogsForStaff(staff.id);
    console.log(`[DashboardTable] *** DEBUG *** Staff ID=${staff.id}, Name="${staff.name}":`, {
      logData,
      hasLog: logData?.hasLog,
      logId: logData?.logId,
      logResult: logData?.logResult,
      isLoading: logData?.isLoading,
      error: logData?.error
    });
  });

  // *** MEMOIZED STAFF DATA WITH LOG STATUS ***
  const staffMembersWithLogs = useMemo((): IStaffWithLogs[] => {
    console.log('[DashboardTable] Recalculating staffMembersWithLogs:', {
      staffCount: staffMembersData.length,
      cachedLogsCount: staffMembersData.length,
      cachedLogSample: staffMembersData.slice(0, 2).map((staff: IStaffMemberWithAutoschedule) => ({
        id: staff.id,
        name: staff.name,
        logData: getCachedLogsForStaff(staff.id)
      }))
    });

    return staffMembersData.map((staff: IStaffMemberWithAutoschedule): IStaffWithLogs => {
      const logData = getCachedLogsForStaff(staff.id);
      
      console.log(`[DashboardTable] *** PROCESSING STAFF *** ${staff.name} (ID=${staff.id}):`, {
        originalLogData: logData,
        hasLog: logData?.hasLog,
        logId: logData?.logId,
        logResult: logData?.logResult,
        isLoading: logData?.isLoading,
        error: logData?.error
      });
      
      return {
        ...staff,
        logData
      };
    });
  }, [staffMembersData, getCachedLogsForStaff]);

  console.log('[DashboardTable] Using LIVE DATA (NO CACHE) for display:', {
    staffCount: staffMembersData.length,
    liveDataCount: staffMembersWithLogs.length,
    exampleStaff: staffMembersWithLogs[0]
  });

  // *** IMPROVED LOGIC FOR AUTO-LOADING WITH DATA CLEARED FLAG ***
  useEffect(() => {
    console.log('[DashboardTable] useEffect triggered - checking conditions');
    console.log('[DashboardTable] onBulkLogRefresh available:', !!onBulkLogRefresh);
    console.log('[DashboardTable] staffMembersData.length:', staffMembersData.length);
    console.log('[DashboardTable] logsService available:', !!logsService);
    console.log('[DashboardTable] managingGroupId:', managingGroupId);
    console.log('[DashboardTable] selectedDate:', formatDate(selectedDate));
    console.log('[DashboardTable] isLogDataCleared:', isLogDataCleared); // *** NEW LOG ***

    if (onBulkLogRefresh && staffMembersData.length > 0 && logsService && managingGroupId) {
      console.log('[DashboardTable] 🔍 DETAILED STAFF ANALYSIS:');
      console.log('[DashboardTable] Current managingGroupId:', managingGroupId);
      console.log('[DashboardTable] Total staffMembersData received:', staffMembersData.length);

      // Extract staff information for logging
      console.log('[DashboardTable] 📋 STAFF MEMBERS BREAKDOWN:');
      staffMembersData.forEach((staff: IStaffMemberWithAutoschedule, index: number) => {
        console.log(`[DashboardTable] Staff ${index}: ID=${staff.id}, Name="${staff.name}", EmployeeID="${staff.employeeId}", Deleted=${staff.deleted}`);
      });

      const currentStaffIds = staffMembersData.map((staff: IStaffMemberWithAutoschedule) => staff.id);
      console.log('[DashboardTable] 🆔 EXTRACTED STAFF IDS for bulk refresh:', currentStaffIds);

      // Create unique key for current group/period combination
      const currentKey = `${managingGroupId}-${formatDate(selectedDate)}`;
      const lastKey = lastProcessedKeyRef.current;

      console.log('[DashboardTable] 🔑 KEY COMPARISON:');
      console.log('[DashboardTable] Current key:', currentKey);
      console.log('[DashboardTable] Last processed key (ref):', lastKey);

      const isNewGroupOrPeriod = currentKey !== lastKey;
      console.log('[DashboardTable] 🎯 Is new group/period?:', isNewGroupOrPeriod);
      console.log('[DashboardTable] 🧹 Is data was cleared?:', isLogDataCleared); // *** NEW LOG ***

      // *** NEW LOGIC: TRIGGER REFRESH IF NEW GROUP/PERIOD OR DATA WAS CLEARED ***
      if (isNewGroupOrPeriod || isLogDataCleared) {
        const reason = isNewGroupOrPeriod ? 'New group/period' : 'Data was cleared';
        console.log('[DashboardTable] ✅ TRIGGERING REFRESH:', {
          reason,
          action: 'Will refresh with current staff IDs',
          currentStaffIds
        });
        
        if (isNewGroupOrPeriod) {
          console.log('[DashboardTable] ✅ NEW GROUP/PERIOD DETECTED - Triggering initial bulk log refresh');
          console.log('[DashboardTable] Changed from "' + lastKey + '" to "' + currentKey + '"');
          
          // Only clear cache for group/period changes, not for auto-clear
          if (clearLogCache) {
            console.log('[DashboardTable] 🧹 CLEARING LOG DATA due to group/period change');
            clearLogCache();
          }
        } else {
          console.log('[DashboardTable] ✅ DATA WAS CLEARED - Triggering refresh for new staff IDs');
          // Don't clear cache here - data was already cleared automatically
        }

        console.log('[DashboardTable] 🚀 FINAL STAFF IDS FOR BULK REFRESH:', currentStaffIds);
        console.log('[DashboardTable] 🚀 Executing bulk log refresh NOW');
        
        // Execute bulk refresh with isInitialLoad flag
        onBulkLogRefresh(currentStaffIds, true)
          .then(() => {
            console.log('[DashboardTable] 🎉 Bulk refresh completed successfully - updating tracking refs');
            
            // Update refs to prevent duplicate calls
            lastProcessedKeyRef.current = currentKey;
            console.log('[DashboardTable] 📝 Updated refs to:', {
              group: managingGroupId, 
              date: formatDate(selectedDate), 
              key: currentKey
            });
          })
          .catch((error: Error) => {
            console.error('[DashboardTable] ❌ Bulk refresh failed:', error);
          });
      } else {
        console.log('[DashboardTable] ❌ Conditions not met for refresh:', {
          hasRefreshFunction: !!onBulkLogRefresh,
          hasLogsService: !!logsService,
          hasStaff: staffMembersData.length > 0,
          isNewGroupOrPeriod: isNewGroupOrPeriod,
          isDataWasCleared: isLogDataCleared,
          reason: 'No trigger conditions met'
        });

        if (!isNewGroupOrPeriod && !isLogDataCleared) {
          console.log('[DashboardTable] 🔍 Same group/period and no data cleared - no refresh needed');
          console.log('[DashboardTable] Current staff count:', staffMembersData.length);
          console.log('[DashboardTable] Current staff IDs:', currentStaffIds);
        }
      }
    }
  }, [
    onBulkLogRefresh, 
    staffMembersData, 
    logsService, 
    managingGroupId, 
    selectedDate, 
    clearLogCache,
    isLogDataCleared // *** NEW DEPENDENCY ***
  ]);

  // *** COLUMN DEFINITIONS ***
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Staff Member',
      fieldName: 'name',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontWeight: 500 }}>{item.name}</span>
        </div>
      )
    },
    {
      key: 'employeeId',
      name: 'Employee ID',
      fieldName: 'employeeId',
      minWidth: 100,
      maxWidth: 120,
      isResizable: true
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
        console.log(`[DashboardTable] *** RENDERING LOG STATUS *** for ${item.name} (ID=${item.id}):`, {
          hasLog: logData?.hasLog,
          logId: logData?.logId,
          logResult: logData?.logResult,
          isLoading: logData?.isLoading,
          error: logData?.error,
          rawLogData: logData
        });

        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getLogStatusIcon(logData)}
            <span style={{ color: getLogStatusColor(logData) }}>
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <TooltipHost content="Refresh log data for this staff member">
            <DefaultButton
              iconProps={{ iconName: 'Refresh' }}
              text="Refresh"
              onClick={() => {
                console.log(`[DashboardTable] *** MANUAL REFRESH CLICKED *** for staff ID=${item.id}, Name="${item.name}"`);
                onLogRefresh(item.id);
              }}
              disabled={isLoading}
              styles={{
                root: { minWidth: '70px', height: '28px' },
                label: { fontSize: '12px' }
              }}
            />
          </TooltipHost>
          
          <TooltipHost content="Fill schedule for this staff member">
            <PrimaryButton
              iconProps={{ iconName: 'Add' }}
              text="Fill"
              onClick={() => onFillStaff(item.id, item.name)}
              disabled={isLoading}
              styles={{
                root: { minWidth: '60px', height: '28px' },
                label: { fontSize: '12px' }
              }}
            />
          </TooltipHost>

          {item.logData?.hasLog && item.logData?.logId && (
            <TooltipHost content="View log details">
              <DefaultButton
                iconProps={{ iconName: 'View' }}
                text="View"
                onClick={() => setLogDetailsDialog({
                  isOpen: true,
                  logId: item.logData?.logId,
                  staffName: item.name
                })}
                styles={{
                  root: { minWidth: '60px', height: '28px' },
                  label: { fontSize: '12px' }
                }}
              />
            </TooltipHost>
          )}
        </div>
      )
    },
    {
      key: 'autoschedule',
      name: 'Auto Schedule',
      fieldName: 'autoschedule',
      minWidth: 120,
      maxWidth: 140,
      isResizable: true,
      onRender: (item: IStaffWithLogs) => (
        <Toggle
          checked={item.autoschedule}
          onChange={(_, checked) => onAutoscheduleToggle(item.id, checked || false)}
          disabled={isLoading}
        />
      )
    }
  ];

  // *** EVENT HANDLERS ***
  const handleRefreshAll = useCallback(async () => {
    if (staffMembersData.length > 0) {
      const staffIds = staffMembersData.map((staff: IStaffMemberWithAutoschedule) => staff.id);
      console.log('[DashboardTable] *** MANUAL REFRESH ALL CLICKED *** for staff IDs:', staffIds);
      await onBulkLogRefresh(staffIds, false);
    }
  }, [staffMembersData, onBulkLogRefresh]);

  const handleCloseLogDetails = useCallback(() => {
    setLogDetailsDialog({ isOpen: false });
  }, []);

  // *** RENDER ***
  return (
    <div style={{ width: '100%', padding: '16px' }}>
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

      {/* HEADER CONTROLS */}
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
          {isLogDataCleared && (
            <span style={{ color: '#ff8c00', fontSize: '12px', fontWeight: 500 }}>
              🔄 Data refreshing...
            </span>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <DefaultButton
            iconProps={{ iconName: 'Refresh' }}
            text="Refresh All"
            onClick={handleRefreshAll}
            disabled={isLoading || staffMembersData.length === 0}
          />
          <PrimaryButton
            iconProps={{ iconName: 'AddToShoppingList' }}
            text="Fill All"
            onClick={onFillAll}
            disabled={isLoading || staffMembersData.length === 0}
          />
        </div>
      </div>

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
              borderRadius: '4px'
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
          border: '1px solid #edebe9'
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