// src/webparts/kpfaplus/components/Tabs/DashboardTab/DashboardTab.tsx
import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { MessageBar, CommandBar, ICommandBarItemProps } from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { DashboardControlPanel } from './components/DashboardControlPanel';
import { DashboardTable } from './components/DashboardTable';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { LoadingSpinner } from '../../LoadingSpinner/LoadingSpinner'; // *** ДОБАВЛЯЕМ ИМПОРТ СПИННЕРА ***
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

  console.log('[DashboardTab] Rendering with enhanced logging, optimization and Date field support');

  // Получаем все функции и данные из оптимизированного хука с поддержкой Date
  const hookReturn = useDashboardLogic({
    context,
    currentUserId,
    managingGroupId
  });

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
    getLogCacheStats,
    startInitialLoading
  } = hookReturn;

  // Статистика для отладки с поддержкой Date
  const cacheStats = getLogCacheStats();

  // *** ФУНКЦИЯ: Форматирование выбранной даты ***
  const formatSelectedDate = useCallback((): string => {
    if (!selectedDate) return 'N/A';
    const day = selectedDate.getDate().toString().padStart(2, '0');
    const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
    const year = selectedDate.getFullYear();
    return `${day}.${month}.${year}`;
  }, [selectedDate]);

  // *** ФУНКЦИЯ: Получение названия месяца и года для отображения ***
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

  // Обработчик закрытия диалога подтверждения
  const handleDismissConfirmDialog = useCallback((): void => {
    setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
  }, [setConfirmDialog]);

  // *** ОБРАБОТЧИК: Массовое обновление логов для всех сотрудников ***
  const handleRefreshAllLogs = useCallback((): void => {
    console.log(`[DashboardTab] Triggering bulk log refresh for period: ${formatSelectedDate()}`);
    const staffIds = staffMembersData.map(staff => staff.id);
    void handleBulkLogRefresh(staffIds);
  }, [staffMembersData, handleBulkLogRefresh, formatSelectedDate]);

  // *** ОБРАБОТЧИК: Очистка кэша логов ***
  const handleClearCache = useCallback((): void => {
    console.log('[DashboardTab] Clearing log cache manually');
    clearLogCache();
    setInfoMessage({
      text: `Log cache cleared for period ${formatSelectedDate()}`,
      type: 1 // MessageBarType.success
    });
  }, [clearLogCache, formatSelectedDate, setInfoMessage]);

  // *** COMMAND BAR С ПОДДЕРЖКОЙ Date ***
  const commandBarItems: ICommandBarItemProps[] = [
    {
      key: 'refresh-all-logs',
      text: 'Refresh All Logs',
      iconProps: { iconName: 'Refresh' },
      onClick: handleRefreshAllLogs,
      disabled: !logsService || staffMembersData.length === 0,
      title: `Refresh logs for all staff members (Period: ${formatSelectedDate()})`
    },
    {
      key: 'clear-cache',
      text: 'Clear Cache',
      iconProps: { iconName: 'Clear' },
      onClick: handleClearCache,
      disabled: cacheStats.cached === 0,
      title: 'Clear cached logs to force refresh from server'
    }
  ];

  // *** FAR ITEMS С ИНФОРМАЦИЕЙ О ПЕРИОДЕ И КЭШЕ ***
  const commandBarFarItems: ICommandBarItemProps[] = [
    {
      key: 'period-info',
      text: `Period: ${formatSelectedDate()}`,
      iconProps: { iconName: 'Calendar' },
      disabled: true,
      title: `Current selected period: ${getPeriodDisplayName()}`
    },
    {
      key: 'cache-info',
      text: `Cache: ${cacheStats.cached}/${cacheStats.cached + cacheStats.expired}`,
      iconProps: { iconName: 'Database' },
      disabled: true,
      title: `Log cache status: ${cacheStats.cached} active, ${cacheStats.expired} expired entries`
    }
  ];

  // *** ЭФФЕКТ: Логирование состояния с информацией о периоде ***
  useEffect(() => {
    console.log('[DashboardTab] State update with Date support:', {
      staffCount: staffMembersData.length,
      hasLogsService: !!logsService,
      selectedDate: formatSelectedDate(),
      selectedDateISO: selectedDate.toISOString(),
      periodDisplay: getPeriodDisplayName(),
      isLoading,
      cacheStats: {
        active: cacheStats.cached,
        expired: cacheStats.expired,
        total: cacheStats.cached + cacheStats.expired
      },
      periodMonth: selectedDate.getMonth() + 1,
      periodYear: selectedDate.getFullYear()
    });
  }, [
    staffMembersData.length, 
    logsService, 
    selectedDate, 
    isLoading, 
    cacheStats, 
    formatSelectedDate, 
    getPeriodDisplayName
  ]);

  // *** ЭФФЕКТ: Уведомление об изменении периода (ЗАКОММЕНТИРОВАН) ***
  useEffect(() => {
    console.log(`[DashboardTab] Period changed to: ${formatSelectedDate()} (${getPeriodDisplayName()})`);
    
    // *** ЗАКОММЕНТИРОВАНО: КРАСНОЕ СООБЩЕНИЕ О СМЕНЕ ПЕРИОДА ***
    // if (logsService && staffMembersData.length > 0) {
    //   setInfoMessage({
    //     text: `Switched to period: ${getPeriodDisplayName()}. Logs will be refreshed automatically.`,
    //     type: 1 // MessageBarType.success
    //   });
    // }
  }, [selectedDate]); // Зависимость только от selectedDate

  // *** НОВЫЙ ЭФФЕКТ: Запуск загрузки при первом открытии таба ***
  useEffect(() => {
    console.log('[DashboardTab] Tab mounted/remounted, triggering initial loading');
    startInitialLoading();
  }, []); // *** ПУСТЫЕ ЗАВИСИМОСТИ - ВЫПОЛНЯЕТСЯ ТОЛЬКО ПРИ МОНТИРОВАНИИ ***

  console.log('[DashboardTab] Rendering dashboard with full optimization and Date support:', {
    staffCount: staffMembersData.length,
    hasLogsService: !!logsService,
    hasContext: !!context,
    selectedPeriod: formatSelectedDate(),
    periodDisplay: getPeriodDisplayName(),
    cacheActive: cacheStats.cached,
    cacheExpired: cacheStats.expired,
    managingGroupId,
    currentUserId
  });

  // *** ПОКАЗЫВАЕМ СПИННЕР ЗАГРУЗКИ ВМЕСТО КРАСНОГО СООБЩЕНИЯ ***
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
      {/* *** ЗАГОЛОВОК С ИНФОРМАЦИЕЙ О ПЕРИОДЕ *** */}
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
          <span>
            <strong>Group ID:</strong> {managingGroupId || 'N/A'}
          </span>
          <span>
            <strong>User ID:</strong> {currentUserId || 'N/A'}
          </span>
          <span>
            <strong>Active Staff:</strong> {staffMembersData.length}
          </span>
          <span>
            <strong>Selected Period:</strong> {formatSelectedDate()}
          </span>
          {logsService && (
            <span style={{ color: '#0078d4', fontWeight: '500' }}>
              <strong>Logs Service:</strong> Active 
              (Cache: {cacheStats.cached}/{cacheStats.cached + cacheStats.expired})
            </span>
          )}
        </div>
      </div>

      {/* *** COMMAND BAR С ИНФОРМАЦИЕЙ О ПЕРИОДЕ *** */}
      {logsService && (
        <div style={{ marginBottom: '15px' }}>
          <CommandBar
            items={commandBarItems}
            farItems={commandBarFarItems}
            styles={{
              root: {
                padding: 0,
                height: '44px',
                backgroundColor: '#ffffff',
                border: '1px solid #e1e5e9',
                borderRadius: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }
            }}
          />
        </div>
      )}

      {/* *** ИНФОРМАЦИОННОЕ СООБЩЕНИЕ (ТОЛЬКО ДЛЯ ВАЖНЫХ УВЕДОМЛЕНИЙ) *** */}
      {infoMessage && infoMessage.type !== 4 && ( // *** НЕ ПОКАЗЫВАЕМ ИНФОРМАЦИОННЫЕ СООБЩЕНИЯ (type 4) ***
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

      {/* *** ПАНЕЛЬ УПРАВЛЕНИЯ ДАТОЙ И ОПЕРАЦИЯМИ *** */}
      <div style={{ marginBottom: '20px' }}>
        <DashboardControlPanel
          selectedDate={selectedDate}
          isLoading={isLoading}
          staffCount={staffMembersData.length}
          onDateChange={handleDateChange}
          onFillAll={handleFillAll}
        />
      </div>

      {/* *** ОСНОВНАЯ ТАБЛИЦА СОТРУДНИКОВ С ПОДДЕРЖКОЙ Date *** */}
      <div style={{ 
        flex: 1,
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e1e5e9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        <DashboardTable
          staffMembersData={staffMembersData}
          isLoading={isLoading}
          onAutoscheduleToggle={handleAutoscheduleToggle}
          onFillStaff={handleFillStaff}
          context={context}
          logsService={logsService}
          onLogRefresh={handleLogRefresh}
          selectedDate={selectedDate} // *** ПЕРЕДАЕМ ВЫБРАННУЮ ДАТУ ***
        />
      </div>

      {/* *** ДИАЛОГ ПОДТВЕРЖДЕНИЯ С ИНФОРМАЦИЕЙ О ПЕРИОДЕ *** */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={
          // *** ДОБАВЛЯЕМ ИНФОРМАЦИЮ О ПЕРИОДЕ ЕСЛИ ЕЕ НЕТ В СООБЩЕНИИ ***
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