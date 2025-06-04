// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardTable.tsx
import * as React from 'react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn,
  Toggle,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  IconButton,
  TooltipHost,
  CommandBar,
  ICommandBarItemProps,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { useDataContext } from '../../../../context';
import { ScheduleLogsService, IScheduleLog } from '../../../../services/ScheduleLogsService';
import { LogDetailsDialog } from '../../../../components/LogDetailsDialog';

// Интерфейсы
export interface IStaffMemberWithAutoschedule {
  id: string;
  name: string;
  employeeId: string;
  autoschedule: boolean;
  deleted: number;
}

export interface IStaffMemberWithLog extends IStaffMemberWithAutoschedule {
  lastLog?: IScheduleLog;
  isLoadingLog?: boolean;
  logError?: string;
}

interface ILogDialogState {
  isOpen: boolean;
  logId?: string;
  staffName?: string;
}

enum LogStatusFilter {
  All = 'all',
  Success = 'success', 
  Error = 'error',
  NoLogs = 'no-logs'
}

// *** ОБНОВЛЕННЫЙ ИНТЕРФЕЙС PROPS С ПОДДЕРЖКОЙ BULK REFRESH ***
interface IDashboardTableProps {
  staffMembersData: IStaffMemberWithAutoschedule[];
  isLoading: boolean;
  onAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  onFillStaff: (staffId: string, staffName: string) => Promise<void>;
  context?: any;
  logsService?: ScheduleLogsService;
  onLogRefresh?: (staffId: string, isInitialLoad?: boolean) => Promise<void>; // *** UPDATED ***
  onBulkLogRefresh?: (staffIds: string[], isInitialLoad?: boolean) => Promise<void>; // *** NEW ***
  selectedDate?: Date;
}

// *** ОБНОВЛЕННЫЙ КОМПОНЕНТ ИНДИКАТОРА СТАТУСА ЛОГА ***
const LogStatusIndicator: React.FC<{
  log?: IScheduleLog;
  isLoading?: boolean;
  error?: string;
  onClick?: () => void;
  onRetry?: () => void;
  selectedDate?: Date;
}> = ({ log, isLoading, error, onClick, onRetry, selectedDate }) => {
  
  // *** ФУНКЦИЯ: Проверка соответствия лога выбранному периоду ***
  const isLogForSelectedPeriod = useMemo((): boolean => {
    if (!log || !log.Date || !selectedDate) return true;
    
    const logDate = new Date(log.Date);
    const selectedMonth = selectedDate.getMonth();
    const selectedYear = selectedDate.getFullYear();
    const logMonth = logDate.getMonth();
    const logYear = logDate.getFullYear();
    
    return selectedMonth === logMonth && selectedYear === logYear;
  }, [log, selectedDate]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Spinner size={SpinnerSize.xSmall} />
        <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <TooltipHost content={`Error loading log: ${error}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <IconButton
            iconProps={{ iconName: 'ErrorBadge' }}
            title="Error loading log - click to retry"
            onClick={onRetry}
            styles={{
              root: { width: '20px', height: '20px', color: '#d13438' }
            }}
          />
          <span style={{ fontSize: '11px', color: '#d13438' }}>Error</span>
        </div>
      </TooltipHost>
    );
  }

  if (!log) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div style={{
          width: '12px', height: '12px', borderRadius: '50%',
          backgroundColor: '#d1d1d1', border: '1px solid #ccc'
        }} />
        <span style={{ fontSize: '12px', color: '#666' }}>No logs</span>
      </div>
    );
  }

  const getStatusColor = (result: number): string => {
    switch (result) {
      case 2: return '#107c10'; // Success - зеленый
      case 1: return '#d13438'; // Error - красный  
      case 0: return '#ffaa44'; // Unknown/Warning - оранжевый
      default: return '#a19f9d'; // Undefined - серый
    }
  };

  const getStatusText = (result: number): string => {
    switch (result) {
      case 2: return 'Success';
      case 1: return 'Error';
      case 0: return 'Warning';
      default: return 'Unknown';
    }
  };

  const statusColor = getStatusColor(log.Result);
  const statusText = getStatusText(log.Result);
  const logDate = log.Created.toLocaleDateString();
  const logPeriodDate = log.Date ? new Date(log.Date).toLocaleDateString() : 'N/A';

  const tooltipContent = `Operation: ${statusText}
Period: ${logPeriodDate}${!isLogForSelectedPeriod ? ' (Different period!)' : ''}
Created: ${logDate}
Click to view details`;

  const containerStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '8px',
    cursor: onClick ? 'pointer' : 'default', padding: '4px 8px',
    borderRadius: '4px', transition: 'background-color 0.2s ease',
    minHeight: '28px',
    opacity: isLogForSelectedPeriod ? 1 : 0.6,
    border: isLogForSelectedPeriod ? 'none' : '1px dashed #ffaa44'
  };

  return (
    <TooltipHost content={tooltipContent}>
      <div 
        style={containerStyle}
        onClick={onClick}
        onMouseEnter={(e) => {
          if (onClick) (e.target as HTMLElement).style.backgroundColor = '#f3f2f1';
        }}
        onMouseLeave={(e) => {
          if (onClick) (e.target as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        <div style={{
          width: '12px', height: '12px', borderRadius: '50%',
          backgroundColor: statusColor, border: '1px solid #fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)', flexShrink: 0
        }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          <span style={{ fontSize: '11px', color: '#323130', fontWeight: '500' }}>
            {statusText}
            {!isLogForSelectedPeriod && (
              <span style={{ color: '#ffaa44', marginLeft: '4px' }}>⚠</span>
            )}
          </span>
          <span style={{ fontSize: '10px', color: '#666' }}>
            Period: {logPeriodDate}
          </span>
        </div>
        {onClick && (
          <IconButton
            iconProps={{ iconName: 'Info' }}
            title="View log details"
            styles={{
              root: { width: '20px', height: '20px', color: '#605e5c', flexShrink: 0 },
              icon: { fontSize: '12px' }
            }}
          />
        )}
      </div>
    </TooltipHost>
  );
};

export const DashboardTable: React.FC<IDashboardTableProps> = (props) => {
  const {
    staffMembersData,
    isLoading,
    onAutoscheduleToggle,
    onFillStaff,
    logsService,
    onLogRefresh,
    onBulkLogRefresh,
    selectedDate
  } = props;

  const { selectedDepartmentId } = useDataContext();

  // Состояния
  const [staffMembersWithLogs, setStaffMembersWithLogs] = useState<IStaffMemberWithLog[]>([]);
  const [logDialog, setLogDialog] = useState<ILogDialogState>({
    isOpen: false, logId: undefined, staffName: undefined
  });
  const [statusFilter, setStatusFilter] = useState<LogStatusFilter>(LogStatusFilter.All);
  const [isRefreshingAllLogs, setIsRefreshingAllLogs] = useState<boolean>(false);
  const [logStats, setLogStats] = useState({ success: 0, error: 0, noLogs: 0, loading: 0 });
  const [hasTriggeredInitialLoad, setHasTriggeredInitialLoad] = useState<boolean>(false); // *** NEW STATE ***

  // *** ФОРМАТИРОВАНИЕ ВЫБРАННОЙ ДАТЫ ДЛЯ ОТОБРАЖЕНИЯ ***
  const formatSelectedDate = useCallback((): string => {
    if (!selectedDate) return 'N/A';
    return selectedDate.toLocaleDateString();
  }, [selectedDate]);

  // Конвертация данных
  useEffect(() => {
    const membersWithLogs: IStaffMemberWithLog[] = staffMembersData.map(member => {
      const existingMember = staffMembersWithLogs.find(m => m.id === member.id);
      return {
        ...member,
        lastLog: existingMember?.lastLog,
        isLoadingLog: existingMember?.isLoadingLog || false,
        logError: existingMember?.logError
      };
    });
    setStaffMembersWithLogs(membersWithLogs);
  }, [staffMembersData]);

  // Подсчет статистики
  useEffect(() => {
    const stats = staffMembersWithLogs.reduce((acc, member) => {
      if (member.isLoadingLog) acc.loading++;
      else if (member.logError) acc.error++;
      else if (member.lastLog) {
        if (member.lastLog.Result === 2) acc.success++;
        else acc.error++;
      } else acc.noLogs++;
      return acc;
    }, { success: 0, error: 0, noLogs: 0, loading: 0 });
    setLogStats(stats);
  }, [staffMembersWithLogs]);

  // *** TRIGGER INITIAL LOAD WHEN SERVICES ARE READY - SIMPLIFIED ***
  useEffect(() => {
    console.log('[DashboardTable] useEffect triggered - checking initial load conditions');
    console.log('[DashboardTable] onBulkLogRefresh available:', !!onBulkLogRefresh);
    console.log('[DashboardTable] staffMembersData.length:', staffMembersData.length);
    console.log('[DashboardTable] hasTriggeredInitialLoad:', hasTriggeredInitialLoad);
    console.log('[DashboardTable] logsService available:', !!logsService);
    
    if (onBulkLogRefresh && logsService && staffMembersData.length > 0 && !hasTriggeredInitialLoad) {
      console.log('[DashboardTable] ✅ ALL CONDITIONS MET - Triggering initial bulk log refresh for', staffMembersData.length, 'staff members');
      setHasTriggeredInitialLoad(true);
      
      const staffIds = staffMembersData.map(staff => staff.id);
      console.log('[DashboardTable] Staff IDs for initial load:', staffIds);
      
      // Immediate execution - no delay
      console.log('[DashboardTable] 🚀 Executing initial bulk log refresh NOW');
      void onBulkLogRefresh(staffIds, true);
    } else {
      console.log('[DashboardTable] ❌ Conditions not met for initial load:');
      console.log('  - onBulkLogRefresh:', !!onBulkLogRefresh);
      console.log('  - logsService:', !!logsService);
      console.log('  - staffMembersData.length:', staffMembersData.length);
      console.log('  - hasTriggeredInitialLoad:', hasTriggeredInitialLoad);
    }
  }, [onBulkLogRefresh, logsService, staffMembersData, hasTriggeredInitialLoad]);

  // *** RESET INITIAL LOAD FLAG WHEN PERIOD CHANGES ***
  useEffect(() => {
    console.log(`[DashboardTable] Period changed to: ${formatSelectedDate()}, resetting initial load flag`);
    setHasTriggeredInitialLoad(false);
  }, [selectedDate, formatSelectedDate]);

  // *** ОБНОВЛЕННОЕ ОБНОВЛЕНИЕ ВСЕХ ЛОГОВ ***
  const refreshAllLogs = useCallback((): void => {
    if (!onBulkLogRefresh || staffMembersWithLogs.length === 0) {
      console.log('[DashboardTable] Cannot refresh logs: no bulk refresh function or no staff members');
      return;
    }

    console.log(`[DashboardTable] Manual refresh of all logs for period: ${formatSelectedDate()}`);
    
    setIsRefreshingAllLogs(true);

    const staffIds = staffMembersWithLogs.map(staff => staff.id);
    
    onBulkLogRefresh(staffIds, false) // *** USE BULK REFRESH FROM HOOK ***
      .then(() => {
        console.log('[DashboardTable] Bulk refresh completed successfully');
        setTimeout(() => {
          setIsRefreshingAllLogs(false);
        }, 1000);
      })
      .catch((error) => {
        console.error('[DashboardTable] Bulk refresh failed:', error);
        setTimeout(() => {
          setIsRefreshingAllLogs(false);
        }, 1000);
      });

  }, [onBulkLogRefresh, staffMembersWithLogs, formatSelectedDate]);

  // Обработчики
  const handleLogClick = useCallback((staffMember: IStaffMemberWithLog): void => {
    if (!staffMember.lastLog) return;
    setLogDialog({
      isOpen: true,
      logId: staffMember.lastLog.ID,
      staffName: staffMember.name
    });
  }, []);

  const handleLogDialogDismiss = useCallback((): void => {
    setLogDialog({ isOpen: false, logId: undefined, staffName: undefined });
  }, []);

  const handleLogRetry = useCallback((staffMember: IStaffMemberWithLog): void => {
    if (onLogRefresh) {
      void onLogRefresh(staffMember.id, false); // *** USE HOOK'S LOG REFRESH ***
    }
  }, [onLogRefresh]);

  const handlePostFillLogRefresh = useCallback(async (staffId: string, staffName: string): Promise<void> => {
    if (onLogRefresh) {
      await onLogRefresh(staffId, false);
    }
  }, [onLogRefresh]);

  // Фильтрация
  const filteredStaffMembers = useMemo(() => {
    return staffMembersWithLogs.filter(member => {
      switch (statusFilter) {
        case LogStatusFilter.Success: return member.lastLog?.Result === 2;
        case LogStatusFilter.Error: return member.logError || member.lastLog?.Result === 1;
        case LogStatusFilter.NoLogs: return !member.lastLog && !member.isLoadingLog && !member.logError;
        default: return true;
      }
    });
  }, [staffMembersWithLogs, statusFilter]);

  // *** ОБНОВЛЕННЫЙ COMMAND BAR С ИНФОРМАЦИЕЙ О ПЕРИОДЕ ***
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'filter',
      text: 'Filter',
      iconProps: { iconName: 'Filter' },
      subMenuProps: {
        items: [
          {
            key: 'all',
            text: `All (${staffMembersWithLogs.length})`,
            iconProps: { iconName: statusFilter === LogStatusFilter.All ? 'CheckMark' : undefined },
            onClick: () => setStatusFilter(LogStatusFilter.All)
          },
          {
            key: 'success', 
            text: `Success (${logStats.success})`,
            iconProps: { iconName: statusFilter === LogStatusFilter.Success ? 'CheckMark' : 'Completed' },
            onClick: () => setStatusFilter(LogStatusFilter.Success)
          },
          {
            key: 'error',
            text: `Errors (${logStats.error})`,
            iconProps: { iconName: statusFilter === LogStatusFilter.Error ? 'CheckMark' : 'ErrorBadge' },
            onClick: () => setStatusFilter(LogStatusFilter.Error)
          },
          {
            key: 'no-logs',
            text: `No Logs (${logStats.noLogs})`,
            iconProps: { iconName: statusFilter === LogStatusFilter.NoLogs ? 'CheckMark' : 'CircleRing' },
            onClick: () => setStatusFilter(LogStatusFilter.NoLogs)
          }
        ]
      }
    },
    {
      key: 'refresh',
      text: `Refresh Logs (${formatSelectedDate()})`,
      iconProps: { iconName: 'Refresh' },
      onClick: refreshAllLogs,
      disabled: isRefreshingAllLogs || !onBulkLogRefresh
    }
  ];

  // Рендеры ячеек
  const renderAutoscheduleCell = (item: IStaffMemberWithLog): JSX.Element => (
    <Toggle
      checked={item.autoschedule}
      onChange={(_, checked): void => {
        if (checked !== undefined) {
          onAutoscheduleToggle(item.id, checked).catch(console.error);
        }
      }}
      disabled={isLoading}
    />
  );

  const renderFillCell = (item: IStaffMemberWithLog): JSX.Element => (
    <PrimaryButton
      text="Fill"
      onClick={(): void => {
        onFillStaff(item.id, item.name)
          .then(() => void handlePostFillLogRefresh(item.id, item.name))
          .catch(error => {
            console.error(`Error in Fill for ${item.name}:`, error);
            void handlePostFillLogRefresh(item.id, item.name);
          });
      }}
      disabled={isLoading}
      styles={{
        root: { backgroundColor: '#0078d4', borderColor: '#0078d4', minWidth: '60px' }
      }}
    />
  );

  const renderLogStatusCell = (item: IStaffMemberWithLog): JSX.Element => (
    <LogStatusIndicator
      log={item.lastLog}
      isLoading={item.isLoadingLog}
      error={item.logError}
      onClick={item.lastLog ? () => handleLogClick(item) : undefined}
      onRetry={() => handleLogRetry(item)}
      selectedDate={selectedDate}
    />
  );

  // Колонки
  const columns: IColumn[] = [
    {
      key: 'name', name: 'Staff Member', fieldName: 'name',
      minWidth: 160, maxWidth: 220, isResizable: true,
      onRender: (item: IStaffMemberWithLog) => (
        <span style={{ fontWeight: '500' }}>{item.name}</span>
      )
    },
    {
      key: 'id', name: 'ID', fieldName: 'id', 
      minWidth: 50, maxWidth: 70,
      onRender: (item: IStaffMemberWithLog) => (
        <span style={{ fontSize: '12px', color: '#666' }}>{item.id}</span>
      )
    },
    {
      key: 'employeeId', name: 'Employee ID', fieldName: 'employeeId',
      minWidth: 80, maxWidth: 100,
      onRender: (item: IStaffMemberWithLog) => (
        <span style={{ fontSize: '12px', color: '#666' }}>{item.employeeId}</span>
      )
    },
    {
      key: 'autoschedule', name: 'Autoschedule',
      minWidth: 90, maxWidth: 110,
      onRender: renderAutoscheduleCell
    },
    {
      key: 'lastLog', name: `Last Operation (${formatSelectedDate()})`,
      minWidth: 140, maxWidth: 200,
      onRender: renderLogStatusCell
    },
    {
      key: 'fill', name: 'Action',
      minWidth: 70, maxWidth: 90,
      onRender: renderFillCell
    }
  ];

  return (
    <div style={{ flex: 1 }}>
      {/* *** ОБНОВЛЕННАЯ ИНФОРМАЦИЯ С ДАННЫМИ О ПЕРИОДЕ *** */}
      <div style={{ marginBottom: '10px' }}>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px 0' }}>
          Showing {filteredStaffMembers.length} of {staffMembersWithLogs.length} staff members for period: <strong>{formatSelectedDate()}</strong>
          {statusFilter !== LogStatusFilter.All && ` (filtered by ${statusFilter})`}
          {logsService && (
            <span style={{ marginLeft: '10px', color: '#0078d4' }}>
              • Logs: {logStats.success} success, {logStats.error} errors, {logStats.noLogs} no logs
              {logStats.loading > 0 && `, ${logStats.loading} loading`}
            </span>
          )}
        </p>

        {logsService && (
          <CommandBar
            items={commandBarItems}
            styles={{ root: { padding: 0, height: '40px' } }}
          />
        )}
      </div>

      {/* *** СООБЩЕНИЕ О СТАТУСЕ *** */}
      {isRefreshingAllLogs && (
        <MessageBar
          messageBarType={MessageBarType.info}
          styles={{ root: { marginBottom: '10px' } }}
        >
          Refreshing logs for all staff members (period: {formatSelectedDate()})...
        </MessageBar>
      )}
      
      {/* Таблица */}
      {staffMembersWithLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No active staff members found in the selected department.</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Department ID: {selectedDepartmentId}
          </p>
        </div>
      ) : (
        <DetailsList
          items={filteredStaffMembers}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          compact={true}
        />
      )}

      {/* *** ДИАЛОГ ПРОСМОТРА ЛОГА *** */}
      <LogDetailsDialog
        isOpen={logDialog.isOpen}
        logId={logDialog.logId}
        staffName={logDialog.staffName}
        logsService={logsService}
        onDismiss={handleLogDialogDismiss}
        title="Fill Operation Log Details"
        subtitle={logDialog.staffName ? 
          `Staff Member: ${logDialog.staffName} | Period: ${formatSelectedDate()}` : 
          undefined
        }
      />
    </div>
  );
};