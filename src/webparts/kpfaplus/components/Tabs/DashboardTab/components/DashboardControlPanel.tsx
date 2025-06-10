// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardControlPanel.tsx
import * as React from 'react';
import { PrimaryButton, Stack, Spinner } from '@fluentui/react';
import { CustomDatePicker } from '../../../CustomDatePicker/CustomDatePicker'; // ДОБАВЛЕНО

// УДАЛЕНО: Локализация для DatePicker - теперь используется из CustomDatePicker
// УДАЛЕНО: const datePickerStringsEN = { ... };

// УДАЛЕНО: Форматирование даты - теперь используется из CustomDatePicker  
// УДАЛЕНО: const formatDate = (date?: Date): string => { ... };

// УДАЛЕНО: Константа для минимальной ширины календаря - теперь в CustomDatePicker
// УДАЛЕНО: const calendarMinWidth = '655px';

interface IDashboardControlPanelProps {
  selectedDate: Date;
  isLoading: boolean;
  staffCount: number;
  onDateChange: (date: Date | undefined) => void;
  onFillAll: () => Promise<void>;
}

export const DashboardControlPanel: React.FC<IDashboardControlPanelProps> = (props) => {
  const {
    selectedDate,
    isLoading,
    staffCount,
    onDateChange,
    onFillAll
  } = props;

  console.log('[DashboardControlPanel] Rendering with CustomDatePicker and date:', selectedDate?.toLocaleDateString());

  // УДАЛЕНО: Обработчик закрытия календаря - теперь в CustomDatePicker
  // УДАЛЕНО: const calendarDismissHandler = (): void => { ... };

  // Обработчик для кнопки Fill in All
  const handleFillAllClick = (): void => {
    console.log('[DashboardControlPanel] Fill in All clicked');
    // Используем .then().catch() для обработки Promise
    onFillAll()
      .then(() => {
        console.log('[DashboardControlPanel] Fill in All completed');
      })
      .catch(error => {
        console.error('[DashboardControlPanel] Error in Fill in All:', error);
      });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '15px',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e1e5e9',
      marginBottom: '20px'
    }}>
      <Stack.Item style={{ minWidth: '220px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '5px',
          color: '#323130'
        }}>Select Date</div>
        {/* ИСПРАВЛЕНО: Заменен стандартный DatePicker на CustomDatePicker */}
        <CustomDatePicker
          value={selectedDate}
          onChange={onDateChange}
          disabled={isLoading}
          placeholder="Select date..."
          label=""
          showGoToToday={true}
          data-testid="dashboard-date-picker"
          styles={{
            root: { width: '220px' }
          }}
        />
      </Stack.Item>

      <div>
        <PrimaryButton 
          text="Fill in All" 
          onClick={handleFillAllClick}
          disabled={isLoading || staffCount === 0}
          styles={{
            root: {
              backgroundColor: '#107c10', // зеленый цвет
              borderColor: '#107c10'
            }
          }}
        />
      </div>
      
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Spinner size={1} />
          <span style={{ fontSize: '12px', color: '#666' }}>Processing...</span>
        </div>
      )}
    </div>
  );
};