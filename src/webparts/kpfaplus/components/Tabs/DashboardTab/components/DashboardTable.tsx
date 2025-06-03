// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardTable.tsx
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
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
  TooltipHost
} from '@fluentui/react';
import { useDataContext } from '../../../../context';
import { ScheduleLogsService, IScheduleLog } from '../../../../services/ScheduleLogsService';

// Интерфейс для расширенного staff member с состоянием autoschedule
export interface IStaffMemberWithAutoschedule {
  id: string;
  name: string;
  employeeId: string;
  autoschedule: boolean;
  deleted: number;
}

// Интерфейс для расширенного staff member с логами
export interface IStaffMemberWithLog extends IStaffMemberWithAutoschedule {
  lastLog?: IScheduleLog;
  isLoadingLog?: boolean;
}

interface IDashboardTableProps {
  staffMembersData: IStaffMemberWithAutoschedule[];
  isLoading: boolean;
  onAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  onFillStaff: (staffId: string, staffName: string) => Promise<void>;
  // Новые пропсы для работы с логами
  context?: any; // WebPartContext
}

// Компонент для отображения статуса лога
const LogStatusIndicator: React.FC<{
  log?: IScheduleLog;
  isLoading?: boolean;
  onClick?: () => void;
}> = ({ log, isLoading, onClick }) => {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <Spinner size={SpinnerSize.xSmall} />
        <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
      </div>
    );
  }

  if (!log) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#d1d1d1', // Серый для "нет логов"
            border: '1px solid #ccc'
          }}
        />
        <span style={{ fontSize: '12px', color: '#666' }}>No logs</span>
      </div>
    );
  }

  // Определяем цвет на основе результата
  const getStatusColor = (result: number): string => {
    switch (result) {
      case 2: return '#107c10'; // Зеленый для успеха
      case 1: return '#d13438'; // Красный для ошибки
      default: return '#ffaa44'; // Оранжевый для неизвестного
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
    <TooltipHost content={`Last operation: ${statusText} at ${logDate} ${logTime}`}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '5px',
          cursor: onClick ? 'pointer' : 'default'
        }}
        onClick={onClick}
      >
        <div 
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            border: '1px solid #fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
          }}
        />
        <span style={{ fontSize: '12px', color: '#323130' }}>
          {logDate}
        </span>
        {onClick && (
          <IconButton
            iconProps={{ iconName: 'Info' }}
            title="View log details"
            styles={{
              root: { 
                width: '16px', 
                height: '16px',
                color: '#605e5c'
              }
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
    context
  } = props;

  const { selectedDepartmentId } = useDataContext();

  // Состояние для данных с логами
  const [staffMembersWithLogs, setStaffMembersWithLogs] = useState<IStaffMemberWithLog[]>([]);
  const [logsService, setLogsService] = useState<ScheduleLogsService | undefined>(undefined);

  console.log('[DashboardTable] Rendering with staff count:', staffMembersData.length);

  // Инициализация сервиса логов
  useEffect(() => {
    if (context) {
      console.log('[DashboardTable] Initializing ScheduleLogsService...');
      const service = ScheduleLogsService.getInstance(context);
      setLogsService(service);
    }
  }, [context]);

  // Конвертируем staffMembersData в staffMembersWithLogs
  useEffect(() => {
    const membersWithLogs: IStaffMemberWithLog[] = staffMembersData.map(member => ({
      ...member,
      lastLog: undefined,
      isLoadingLog: false
    }));
    
    setStaffMembersWithLogs(membersWithLogs);
    console.log('[DashboardTable] Converted staff members to members with logs:', membersWithLogs.length);
  }, [staffMembersData]);

  // Функция для загрузки последнего лога для конкретного сотрудника
  const loadLastLogForStaff = useCallback(async (staffMember: IStaffMemberWithLog): Promise<void> => {
    if (!logsService || !staffMember.employeeId) {
      console.log(`[DashboardTable] Cannot load log for ${staffMember.name}: missing service or employeeId`);
      return;
    }

    console.log(`[DashboardTable] Loading last log for staff: ${staffMember.name} (ID: ${staffMember.employeeId})`);

    // Обновляем состояние - показываем загрузку
    setStaffMembersWithLogs(prev => prev.map(member => 
      member.id === staffMember.id 
        ? { ...member, isLoadingLog: true }
        : member
    ));

    try {
      // Получаем последний лог для этого сотрудника
      const logsResult = await logsService.getScheduleLogs({
        staffMemberId: staffMember.employeeId,
        top: 1, // Берем только последний
        skip: 0
      });

      if (logsResult.error) {
        console.error(`[DashboardTable] Error loading logs for ${staffMember.name}:`, logsResult.error);
        return;
      }

      const lastLog = logsResult.logs.length > 0 ? logsResult.logs[0] : undefined;
      
      console.log(`[DashboardTable] Loaded log for ${staffMember.name}:`, lastLog ? {
        id: lastLog.ID,
        result: lastLog.Result,
        created: lastLog.Created.toLocaleString()
      } : 'No logs found');

      // Обновляем состояние с полученным логом
      setStaffMembersWithLogs(prev => prev.map(member => 
        member.id === staffMember.id 
          ? { 
              ...member, 
              lastLog: lastLog,
              isLoadingLog: false 
            }
          : member
      ));

    } catch (error) {
      console.error(`[DashboardTable] Error loading logs for ${staffMember.name}:`, error);
      
      // Обновляем состояние - убираем загрузку
      setStaffMembersWithLogs(prev => prev.map(member => 
        member.id === staffMember.id 
          ? { ...member, isLoadingLog: false }
          : member
      ));
    }
  }, [logsService]);

  // Загружаем логи для всех сотрудников при инициализации
  useEffect(() => {
    if (logsService && staffMembersWithLogs.length > 0) {
      console.log('[DashboardTable] Loading logs for all staff members...');
      
      // Загружаем логи для каждого сотрудника с небольшой задержкой
      staffMembersWithLogs.forEach((member, index) => {
        setTimeout(() => {
          void loadLastLogForStaff(member);
        }, index * 200); // 200ms между запросами для предотвращения перегрузки
      });
    }
  }, [logsService, staffMembersWithLogs.length]); // Используем length вместо всего массива

  // Функция для обработки клика по логу (пока заглушка)
  const handleLogClick = useCallback((staffMember: IStaffMemberWithLog): void => {
    if (!staffMember.lastLog) return;
    
    console.log('[DashboardTable] Log clicked for staff:', staffMember.name, 'Log:', staffMember.lastLog);
    // TODO: Здесь будет открытие диалога с деталями лога (Этап 2)
    alert(`Log details will be shown here.\n\nStaff: ${staffMember.name}\nResult: ${staffMember.lastLog.Result === 2 ? 'Success' : 'Error'}\nDate: ${staffMember.lastLog.Created.toLocaleString()}\n\nMessage (first 100 chars):\n${staffMember.lastLog.Message.substring(0, 100)}...`);
  }, []);

  // Рендер ячейки с toggle для autoschedule
  const renderAutoscheduleCell = (item: IStaffMemberWithLog): JSX.Element => {
    return (
      <Toggle
        checked={item.autoschedule}
        onChange={(_, checked): void => {
          if (checked !== undefined) {
            // Используем .then().catch() для обработки Promise
            onAutoscheduleToggle(item.id, checked)
              .then(() => {
                console.log(`[DashboardTable] Autoschedule updated for ${item.name}`);
              })
              .catch(error => {
                console.error(`[DashboardTable] Error updating autoschedule for ${item.name}:`, error);
              });
          }
        }}
        disabled={isLoading}
      />
    );
  };

  // Рендер ячейки с кнопкой Fill
  const renderFillCell = (item: IStaffMemberWithLog): JSX.Element => {
    return (
      <PrimaryButton
        text="Fill"
        onClick={(): void => {
          // Используем .then().catch() для обработки Promise
          onFillStaff(item.id, item.name)
            .then(() => {
              console.log(`[DashboardTable] Fill completed for ${item.name}`);
              // После успешного выполнения Fill перезагружаем лог для этого сотрудника
              void loadLastLogForStaff(item);
            })
            .catch(error => {
              console.error(`[DashboardTable] Error in Fill for ${item.name}:`, error);
              // При ошибке тоже перезагружаем лог (может появиться лог об ошибке)
              void loadLastLogForStaff(item);
            });
        }}
        disabled={isLoading}
        styles={{
          root: {
            backgroundColor: '#0078d4',
            borderColor: '#0078d4',
            minWidth: '60px'
          }
        }}
      />
    );
  };

  // Рендер ячейки с индикатором лога
  const renderLogStatusCell = (item: IStaffMemberWithLog): JSX.Element => {
    return (
      <LogStatusIndicator
        log={item.lastLog}
        isLoading={item.isLoadingLog}
        onClick={item.lastLog ? () => handleLogClick(item) : undefined}
      />
    );
  };

  // Колонки таблицы
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Staff Member',
      fieldName: 'name',
      minWidth: 180,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: IStaffMemberWithLog): JSX.Element => (
        <span style={{ fontWeight: '500' }}>{item.name}</span>
      )
    },
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 60,
      maxWidth: 80,
      onRender: (item: IStaffMemberWithLog): JSX.Element => (
        <span style={{ fontSize: '12px', color: '#666' }}>{item.id}</span>
      )
    },
    {
      key: 'employeeId',
      name: 'Employee ID',
      fieldName: 'employeeId',
      minWidth: 90,
      maxWidth: 110,
      onRender: (item: IStaffMemberWithLog): JSX.Element => (
        <span style={{ fontSize: '12px', color: '#666' }}>{item.employeeId}</span>
      )
    },
    {
      key: 'autoschedule',
      name: 'Autoschedule',
      minWidth: 100,
      maxWidth: 120,
      onRender: renderAutoscheduleCell
    },
    {
      key: 'lastLog',
      name: 'Last Log',
      minWidth: 100,
      maxWidth: 150,
      onRender: renderLogStatusCell
    },
    {
      key: 'fill',
      name: 'Action',
      minWidth: 80,
      maxWidth: 100,
      onRender: renderFillCell
    }
  ];

  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing {staffMembersWithLogs.length} active staff members (deleted staff excluded)
        {logsService && (
          <span style={{ marginLeft: '10px', color: '#0078d4' }}>
            • Logs service active
          </span>
        )}
      </p>
      
      {staffMembersWithLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No active staff members found in the selected department.</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Department ID: {selectedDepartmentId}
          </p>
        </div>
      ) : (
        <DetailsList
          items={staffMembersWithLogs}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          compact={true}
        />
      )}
    </div>
  );
};