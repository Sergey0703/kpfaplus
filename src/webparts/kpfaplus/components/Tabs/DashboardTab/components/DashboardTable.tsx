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

interface IDashboardTableProps {
  staffMembersData: IStaffMemberWithAutoschedule[];
  isLoading: boolean;
  onAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  onFillStaff: (staffId: string, staffName: string) => Promise<void>;
  context?: any;
  logsService?: ScheduleLogsService;
  onLogRefresh?: (staffId: string) => Promise<void>;
}

// Компонент индикатора статуса лога
const LogStatusIndicator: React.FC<{
  log?: IScheduleLog;
  isLoading?: boolean;
  error?: string;
  onClick?: () => void;
  onRetry?: () => void;
}> = ({ log, isLoading, error, onClick, onRetry }) => {
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
      case 2: return '#107c10';
      case 1: return '#d13438';
      default: return '#ffaa44';
    }
  };

  const getStatusText = (result: number): string => {
    switch (result) {
      case 2: return 'Success';
      case 1: return 'Error';
      default: return 'Unknown';
    }
  };

  const statusColor = getStatusColor(log.Result);
  const statusText = getStatusText(log.Result);
  const logDate = log.Created.toLocaleDateString();
  const logTime = log.Created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <TooltipHost content={`Last operation: ${statusText} at ${logDate} ${logTime}\nClick to view details`}>
      <div 
        style={{ 
          display: 'flex', alignItems: 'center', gap: '8px',
          cursor: onClick ? 'pointer' : 'default', padding: '4px 8px',
          borderRadius: '4px', transition: 'background-color 0.2s ease',
          minHeight: '28px'
        }}
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
          </span>
          <span style={{ fontSize: '10px', color: '#666' }}>
            {logDate} {logTime}
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
  ///  context,
    logsService,
    onLogRefresh
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

  // Загрузка лога
  const loadLastLogForStaff = useCallback(async (staffMember: IStaffMemberWithLog, retryCount = 0): Promise<void> => {
    if (!logsService || !staffMember.employeeId) return;

    const maxRetries = 2;
    const retryDelay = 1000 * (retryCount + 1);

    setStaffMembersWithLogs(prev => prev.map(member => 
      member.id === staffMember.id ? { ...member, isLoadingLog: true, logError: undefined } : member
    ));

    try {
      const logsResult = await logsService.getScheduleLogs({
        staffMemberId: staffMember.employeeId,
        top: 1, skip: 0
      });

      if (logsResult.error) throw new Error(logsResult.error);

      const lastLog = logsResult.logs.length > 0 ? logsResult.logs[0] : undefined;
      
      setStaffMembersWithLogs(prev => prev.map(member => 
        member.id === staffMember.id ? { 
          ...member, lastLog, isLoadingLog: false, logError: undefined
        } : member
      ));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (retryCount < maxRetries) {
        setTimeout(() => {
          void loadLastLogForStaff(staffMember, retryCount + 1);
        }, retryDelay);
      } else {
        setStaffMembersWithLogs(prev => prev.map(member => 
          member.id === staffMember.id ? { 
            ...member, isLoadingLog: false, logError: errorMessage
          } : member
        ));
      }
    }
  }, [logsService]);

  // Загрузка логов для всех
  useEffect(() => {
    if (logsService && staffMembersWithLogs.length > 0) {
      staffMembersWithLogs.forEach((member, index) => {
        if (!member.lastLog && !member.isLoadingLog && !member.logError) {
          setTimeout(() => {
            void loadLastLogForStaff(member);
          }, index * 150);
        }
      });
    }
  }, [logsService, staffMembersWithLogs.length]);

  // Обновление всех логов - НЕ async
  const refreshAllLogs = useCallback((): void => {
    if (!logsService || staffMembersWithLogs.length === 0) return;

    console.log('[DashboardTable] Refreshing all logs...');
    setIsRefreshingAllLogs(true);

    // Сбрасываем состояние
    setStaffMembersWithLogs(prev => prev.map(member => ({
      ...member, lastLog: undefined, logError: undefined, isLoadingLog: false
    })));

    // Перезагружаем логи
    staffMembersWithLogs.forEach((member, i) => {
      setTimeout(() => {
        void loadLastLogForStaff(member);
      }, i * 100);
    });

    setTimeout(() => {
      setIsRefreshingAllLogs(false);
    }, 2000);
  }, [logsService, staffMembersWithLogs, loadLastLogForStaff]);

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
    void loadLastLogForStaff(staffMember);
  }, [loadLastLogForStaff]);

  const handlePostFillLogRefresh = useCallback(async (staffId: string, staffName: string): Promise<void> => {
    if (onLogRefresh) {
      await onLogRefresh(staffId);
    } else {
      const staffMember = staffMembersWithLogs.find(member => member.id === staffId);
      if (staffMember) {
        setTimeout(() => {
          void loadLastLogForStaff(staffMember);
        }, 1500);
      }
    }
  }, [onLogRefresh, staffMembersWithLogs, loadLastLogForStaff]);

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

  // Command Bar - все обработчики НЕ async
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
      text: 'Refresh Logs',
      iconProps: { iconName: 'Refresh' },
      onClick: refreshAllLogs, // НЕ async!
      disabled: isRefreshingAllLogs || !logsService
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
      key: 'lastLog', name: 'Last Operation',
      minWidth: 120, maxWidth: 180,
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
      {/* Информация и Command Bar */}
      <div style={{ marginBottom: '10px' }}>
        <p style={{ fontSize: '12px', color: '#666', margin: '0 0 10px 0' }}>
          Showing {filteredStaffMembers.length} of {staffMembersWithLogs.length} staff members
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

      {/* Сообщение о статусе */}
      {isRefreshingAllLogs && (
        <MessageBar
          messageBarType={MessageBarType.info}
          styles={{ root: { marginBottom: '10px' } }}
        >
          Refreshing logs for all staff members...
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

      {/* Диалог просмотра лога */}
      <LogDetailsDialog
        isOpen={logDialog.isOpen}
        logId={logDialog.logId}
        staffName={logDialog.staffName}
        logsService={logsService}
        onDismiss={handleLogDialogDismiss}
        title="Fill Operation Log Details"
        subtitle={logDialog.staffName ? `Staff Member: ${logDialog.staffName}` : undefined}
      />
    </div>
  );
};