// src/webparts/kpfaplus/components/Tabs/DashboardTab/DashboardTab.tsx
import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { MessageBar, CommandBar, ICommandBarItemProps } from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { DashboardControlPanel } from './components/DashboardControlPanel';
import { DashboardTable } from './components/DashboardTable';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { useDashboardLogic } from './hooks/useDashboardLogic';

// Интерфейс для диалога подтверждения
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

  console.log('[DashboardTab] Rendering with enhanced logging and optimization features');

  // Получаем все функции и данные из оптимизированного хука
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
    getLogCacheStats
  } = useDashboardLogic({
    context,
    currentUserId,
    managingGroupId
  });

  // Статистика для отладки
  const cacheStats = getLogCacheStats();

  // Обработчик закрытия диалога подтверждения
  const handleDismissConfirmDialog = useCallback((): void => {
    setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
  }, [setConfirmDialog]);

  // Command Bar для дополнительных действий
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh-all-logs',
      text: 'Refresh All Logs',
      iconProps: { iconName: 'Refresh' },
      onClick: (): void => {
        const staffIds = staffMembersData.map(staff => staff.id);
        void handleBulkLogRefresh(staffIds);
      },
      disabled: !logsService || staffMembersData.length === 0
    },
    {
      key: 'clear-cache',
      text: 'Clear Log Cache',
      iconProps: { iconName: 'Clear' },
      onClick: (): void => {
        clearLogCache();
      },
      disabled: cacheStats.cached === 0
    }
  ];

  const commandBarFarItems: ICommandBarItemProps[] = [
    {
      key: 'cache-info',
      text: `Cache: ${cacheStats.cached} active, ${cacheStats.expired} expired`,
      iconProps: { iconName: 'Info' },
      disabled: true
    }
  ];

  // Логирование состояния для отладки
  useEffect(() => {
    console.log('[DashboardTab] State update:', {
      staffCount: staffMembersData.length,
      hasLogsService: !!logsService,
      selectedDate: selectedDate.toLocaleDateString(),
      isLoading,
      cacheStats
    });
  }, [staffMembersData.length, logsService, selectedDate, isLoading, cacheStats]);

  console.log('[DashboardTab] Rendering dashboard with full optimization:', {
    staffCount: staffMembersData.length,
    hasLogsService: !!logsService,
    hasContext: !!context,
    cacheActive: cacheStats.cached,
    cacheExpired: cacheStats.expired
  });

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Заголовок и информация */}
      <div style={{ marginBottom: '15px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Dashboard
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {managingGroupId} | Current User ID: {currentUserId} | Active Staff: {staffMembersData.length}
          {logsService && (
            <span style={{ marginLeft: '10px', color: '#0078d4' }}>
              • Logs Service Active (Cache: {cacheStats.cached}/{cacheStats.cached + cacheStats.expired})
            </span>
          )}
        </p>
      </div>

      {/* Command Bar для управления */}
      {logsService && (
        <div style={{ marginBottom: '10px' }}>
          <CommandBar
            items={commandBarItems}
            farItems={commandBarFarItems}
            styles={{
              root: {
                padding: 0,
                height: '40px',
                backgroundColor: '#faf9f8',
                border: '1px solid #e1e5e9',
                borderRadius: '4px'
              }
            }}
          />
        </div>
      )}

      {/* Информационное сообщение */}
      {infoMessage && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar 
            messageBarType={infoMessage.type}
            onDismiss={() => setInfoMessage(undefined)}
            dismissButtonAriaLabel="Close"
            isMultiline={false}
          >
            {infoMessage.text}
          </MessageBar>
        </div>
      )}

      {/* Панель управления */}
      <DashboardControlPanel
        selectedDate={selectedDate}
        isLoading={isLoading}
        staffCount={staffMembersData.length}
        onDateChange={handleDateChange}
        onFillAll={handleFillAll}
      />

      {/* Основная таблица сотрудников */}
      <DashboardTable
        staffMembersData={staffMembersData}
        isLoading={isLoading}
        onAutoscheduleToggle={handleAutoscheduleToggle}
        onFillStaff={handleFillStaff}
        context={context}
        logsService={logsService}
        onLogRefresh={handleLogRefresh}
      />

      {/* Диалог подтверждения */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmButtonText={confirmDialog.confirmButtonText}
        cancelButtonText={confirmDialog.cancelButtonText}
        onConfirm={confirmDialog.onConfirm}
        onDismiss={handleDismissConfirmDialog}
        confirmButtonColor={confirmDialog.confirmButtonColor}
      />
    </div>
  );
};