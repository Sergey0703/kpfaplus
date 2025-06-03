// src/webparts/kpfaplus/components/Tabs/DashboardTab/DashboardTab.tsx
import * as React from 'react';
import { MessageBar } from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { DashboardControlPanel } from './components/DashboardControlPanel';
import { DashboardTable } from './components/DashboardTable';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { useDashboardLogic } from './hooks/useDashboardLogic';

// Import the interface for proper typing
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
  const { managingGroupId, currentUserId } = props;

  console.log('[DashboardTab] Rendering with props:', {
    managingGroupId: props.managingGroupId,
    currentUserId: props.currentUserId,
    dayOfStartWeek: props.dayOfStartWeek
  });

  // Используем кастомный хук для всей логики
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
    handleFillAll
  } = useDashboardLogic(props.context);

  // Обработчик закрытия диалога подтверждения
  const handleDismissConfirmDialog = (): void => {
    setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Dashboard
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {managingGroupId} | Current User ID: {currentUserId} | Active Staff: {staffMembersData.length}
        </p>
      </div>

      {/* Информационное сообщение */}
      {infoMessage && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar 
            messageBarType={infoMessage.type}
            onDismiss={() => setInfoMessage(undefined)}
            dismissButtonAriaLabel="Close"
          >
            {infoMessage.text}
          </MessageBar>
        </div>
      )}

      {/* Command Panel */}
      <DashboardControlPanel
        selectedDate={selectedDate}
        isLoading={isLoading}
        staffCount={staffMembersData.length}
        onDateChange={handleDateChange}
        onFillAll={handleFillAll}
      />

      {/* Staff Members Table */}
      <DashboardTable
        staffMembersData={staffMembersData}
        isLoading={isLoading}
        onAutoscheduleToggle={handleAutoscheduleToggle}
        onFillStaff={handleFillStaff}
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