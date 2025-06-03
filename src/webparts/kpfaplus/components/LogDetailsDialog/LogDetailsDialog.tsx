// src/webparts/kpfaplus/components/LogDetailsDialog/LogDetailsDialog.tsx
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType,
  Stack,
  Text,
  Separator,
  Icon,
  TooltipHost,
  ScrollablePane,
  ScrollbarVisibility
} from '@fluentui/react';
import { IScheduleLog, ScheduleLogsService } from '../../services/ScheduleLogsService';

interface ILogDetailsDialogProps {
  isOpen: boolean;
  logId?: string;
  staffName?: string;
  logsService?: ScheduleLogsService;
  onDismiss: () => void;
  // Дополнительные опции для кастомизации
  title?: string;
  subtitle?: string;
  width?: string;
  height?: string;
}

interface ILogDetailsState {
  log?: IScheduleLog;
  isLoading: boolean;
  error?: string;
}

// Компонент для отображения поля лога
const LogField: React.FC<{
  label: string;
  value?: string | number | Date;
  valueType?: 'text' | 'date' | 'number' | 'status' | 'multiline';
  icon?: string;
  color?: string;
}> = ({ label, value, valueType = 'text', icon, color }) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const formatValue = (): string => {
    if (value === undefined || value === null) return 'N/A';
    
    switch (valueType) {
      case 'date':
        return value instanceof Date ? value.toLocaleString() : String(value);
      case 'number':
        return String(value);
      case 'status':
        const numValue = Number(value);
        return numValue === 2 ? 'Success' : numValue === 1 ? 'Error' : 'Unknown';
      case 'multiline':
        return String(value);
      default:
        return String(value);
    }
  };

  const getStatusColor = (): string => {
    if (valueType === 'status') {
      const numValue = Number(value);
      return numValue === 2 ? '#107c10' : numValue === 1 ? '#d13438' : '#ffaa44';
    }
    return color || '#323130';
  };

  const getStatusIcon = (): string => {
    if (valueType === 'status') {
      const numValue = Number(value);
      return numValue === 2 ? 'CheckMark' : numValue === 1 ? 'ErrorBadge' : 'Unknown';
    }
    return icon || '';
  };

  return (
    <Stack tokens={{ childrenGap: 4 }} style={{ marginBottom: '12px' }}>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
        {(icon || valueType === 'status') && (
          <Icon 
            iconName={getStatusIcon() || icon} 
            style={{ 
              color: getStatusColor(),
              fontSize: '14px'
            }} 
          />
        )}
        <Text 
          variant="smallPlus" 
          style={{ 
            fontWeight: '600', 
            color: '#323130',
            minWidth: '120px'
          }}
        >
          {label}:
        </Text>
      </Stack>
      
      {valueType === 'multiline' ? (
        <div style={{
          backgroundColor: '#f8f9fa',
          border: '1px solid #e1e5e9',
          borderRadius: '4px',
          padding: '12px',
          marginTop: '4px',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '12px',
          lineHeight: '1.4',
          color: '#323130',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {formatValue()}
        </div>
      ) : (
        <Text 
          variant="medium" 
          style={{ 
            color: getStatusColor(),
            fontWeight: valueType === 'status' ? '600' : '400',
            marginLeft: icon || valueType === 'status' ? '22px' : '0'
          }}
        >
          {formatValue()}
        </Text>
      )}
    </Stack>
  );
};

// Компонент для отображения lookup информации
const LookupField: React.FC<{
  label: string;
  lookup?: { Id: string; Title: string };
  icon?: string;
}> = ({ label, lookup, icon }) => {
  if (!lookup || !lookup.Title) {
    return (
      <LogField 
        label={label}
        value="Not specified"
        icon={icon}
        color="#666"
      />
    );
  }

  return (
    <Stack tokens={{ childrenGap: 4 }} style={{ marginBottom: '12px' }}>
      <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
        {icon && (
          <Icon 
            iconName={icon} 
            style={{ 
              color: '#0078d4',
              fontSize: '14px'
            }} 
          />
        )}
        <Text 
          variant="smallPlus" 
          style={{ 
            fontWeight: '600', 
            color: '#323130',
            minWidth: '120px'
          }}
        >
          {label}:
        </Text>
      </Stack>
      
      <Stack horizontal tokens={{ childrenGap: 8 }} style={{ marginLeft: icon ? '22px' : '0' }}>
        <Text variant="medium" style={{ color: '#323130', fontWeight: '500' }}>
          {lookup.Title}
        </Text>
        <Text variant="small" style={{ color: '#666' }}>
          (ID: {lookup.Id})
        </Text>
      </Stack>
    </Stack>
  );
};

/**
 * Общий компонент для отображения деталей лога операций
 * Может использоваться в разных частях приложения
 */
export const LogDetailsDialog: React.FC<ILogDetailsDialogProps> = (props) => {
  const {
    isOpen,
    logId,
    staffName,
    logsService,
    onDismiss,
    title = 'Operation Log Details',
    subtitle
 //   width = '700px',
   // height = '500px'
  } = props;

  const [state, setState] = useState<ILogDetailsState>({
    log: undefined,
    isLoading: false,
    error: undefined
  });

  console.log('[LogDetailsDialog] Rendering with props:', {
    isOpen,
    logId,
    staffName,
    hasLogsService: !!logsService,
    title
  });

  // Загрузка деталей лога
  const loadLogDetails = useCallback(async (): Promise<void> => {
    if (!logId || !logsService) {
      console.log('[LogDetailsDialog] Cannot load log: missing logId or logsService');
      return;
    }

    console.log(`[LogDetailsDialog] Loading log details for ID: ${logId}`);
    
    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      error: undefined 
    }));

    try {
      const log = await logsService.getScheduleLogById(logId);
      
      if (log) {
        console.log('[LogDetailsDialog] Successfully loaded log:', {
          id: log.ID,
          title: log.Title,
          result: log.Result,
          created: log.Created.toLocaleString()
        });
        
        setState(prev => ({
          ...prev,
          log: log,
          isLoading: false
        }));
      } else {
        console.warn(`[LogDetailsDialog] Log with ID ${logId} not found`);
        setState(prev => ({
          ...prev,
          log: undefined,
          isLoading: false,
          error: `Log with ID ${logId} not found`
        }));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[LogDetailsDialog] Error loading log details:`, error);
      
      setState(prev => ({
        ...prev,
        log: undefined,
        isLoading: false,
        error: `Failed to load log details: ${errorMessage}`
      }));
    }
  }, [logId, logsService]);

  // Эффект для загрузки лога при открытии диалога
  useEffect(() => {
    if (isOpen && logId && logsService) {
      console.log('[LogDetailsDialog] Dialog opened, loading log details...');
      void loadLogDetails();
    } else if (!isOpen) {
      // Очищаем состояние при закрытии диалога
      setState({
        log: undefined,
        isLoading: false,
        error: undefined
      });
    }
  }, [isOpen, loadLogDetails]);

  // Обработчик закрытия диалога
  const handleDismiss = useCallback((): void => {
    console.log('[LogDetailsDialog] Dialog dismissed');
    onDismiss();
  }, [onDismiss]);

  // Обработчик повторной загрузки
  const handleRetry = useCallback((): void => {
    console.log('[LogDetailsDialog] Retrying log load...');
    void loadLogDetails();
  }, [loadLogDetails]);

  // Рендер содержимого диалога
  const renderDialogContent = (): JSX.Element => {
    if (state.isLoading) {
      return (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          padding: '40px',
          gap: '16px'
        }}>
          <Spinner size={SpinnerSize.large} />
          <Text variant="medium">Loading log details...</Text>
        </div>
      );
    }

    if (state.error) {
      return (
        <div style={{ padding: '20px' }}>
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={true}
          >
            {state.error}
          </MessageBar>
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <DefaultButton
              text="Retry"
              iconProps={{ iconName: 'Refresh' }}
              onClick={handleRetry}
            />
          </div>
        </div>
      );
    }

    if (!state.log) {
      return (
        <div style={{ 
          padding: '40px',
          textAlign: 'center'
        }}>
          <Icon 
            iconName="Warning" 
            style={{ 
              fontSize: '48px', 
              color: '#ffaa44',
              marginBottom: '16px'
            }} 
          />
          <Text variant="large" style={{ display: 'block', marginBottom: '8px' }}>
            No Log Data
          </Text>
          <Text variant="medium" style={{ color: '#666' }}>
            Log details could not be loaded.
          </Text>
        </div>
      );
    }

    // Рендер деталей лога
    const log = state.log;
    
    return (
      <div style={{ padding: '20px' }}>
        <ScrollablePane 
          scrollbarVisibility={ScrollbarVisibility.auto}
          style={{ height: '400px', maxHeight: '60vh' }}  // *** ФИКСИРОВАННАЯ ВЫСОТА ***
        >
          <Stack tokens={{ childrenGap: 16 }}>
            {/* Заголовок и основная информация */}
            <div>
              <Text variant="xLarge" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                {log.Title || 'Operation Log'}
              </Text>
              {(staffName || subtitle) && (
                <Text variant="medium" style={{ color: '#666' }}>
                  {subtitle || (staffName && `Staff Member: ${staffName}`)}
                </Text>
              )}
            </div>

            <Separator />

            {/* Статус операции */}
            <LogField
              label="Operation Status"
              value={log.Result}
              valueType="status"
            />

            {/* *** ДАТА ПЕРИОДА В НАЧАЛЕ *** */}
            <LogField
              label="Period Date"
              value={log.Date}
              valueType="date"
              icon="Calendar"
            />

            {/* Основные поля */}
            <LogField
              label="Title"
              value={log.Title}
              icon="FileCode"
            />

            <LogField
              label="Created Date"
              value={log.Created}
              valueType="date"
              icon="DateTime"
            />

            <LogField
              label="Modified Date"
              value={log.Modified}
              valueType="date"
              icon="Edit"
            />

            <Separator />

            {/* Lookup поля */}
            <Text variant="large" style={{ fontWeight: '600', marginBottom: '8px' }}>
              Related Records
            </Text>

            <LookupField
              label="Manager"
              lookup={log.Manager}
              icon="Contact"
            />

            <LookupField
              label="Staff Member"
              lookup={log.StaffMember}
              icon="People"
            />

            <LookupField
              label="Staff Group"
              lookup={log.StaffGroup}
              icon="Group"
            />

            <LookupField
              label="Weekly Time Table"
              lookup={log.WeeklyTimeTable}
              icon="Calendar"
            />

            <Separator />

            {/* Детальное сообщение */}
            <Text variant="large" style={{ fontWeight: '600', marginBottom: '8px' }}>
              Operation Details
            </Text>

            <LogField
              label="Detailed Message"
              value={log.Message}
              valueType="multiline"
            />
          </Stack>
        </ScrollablePane>
      </div>
    );
  };

  return (
    <Dialog
      hidden={!isOpen}
      onDismiss={handleDismiss}
      dialogContentProps={{
        type: DialogType.largeHeader,
        title: title,
        subText: logId ? `Log ID: ${logId}` : undefined
      }}
      modalProps={{
        isBlocking: false,
        styles: { 
          main: { 
            minWidth: '800px',  // *** УВЕЛИЧИЛИ ШИРИНУ ***
            maxWidth: '90vw',
            minHeight: '500px',
            maxHeight: '85vh'   // *** НЕМНОГО УМЕНЬШИЛИ ВЫСОТУ ***
          } 
        }
      }}
    >
      {renderDialogContent()}
      
      <DialogFooter>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <div>
            {/* Кнопка обновления слева */}
            {state.log && !state.isLoading && !state.error && (
              <TooltipHost content="Reload log data">
                <DefaultButton
                  text="Refresh"
                  iconProps={{ iconName: 'Refresh' }}
                  onClick={handleRetry}
                  disabled={state.isLoading}
                />
              </TooltipHost>
            )}
          </div>
          <div>
            {/* Кнопка закрытия справа */}
            <PrimaryButton
              text="Close"
              onClick={handleDismiss}
              disabled={state.isLoading}
            />
          </div>
        </div>
      </DialogFooter>
    </Dialog>
  );
};

export default LogDetailsDialog;