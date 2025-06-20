// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardControlPanel.tsx
import * as React from 'react';
import { PrimaryButton, Stack, Spinner } from '@fluentui/react';
import { CustomDatePicker } from '../../../CustomDatePicker/CustomDatePicker'; // ДОБАВЛЕНО

interface IDashboardControlPanelProps {
  selectedDate: Date;
  isLoading: boolean;
  staffCount: number;
  onDateChange: (date: Date | undefined) => void;
  onAutoFillAll: () => Promise<void>; // ИЗМЕНЕНО: переименовано с onFillAll на onAutoFillAll
}

export const DashboardControlPanel: React.FC<IDashboardControlPanelProps> = (props) => {
  const {
    selectedDate,
    isLoading,
    staffCount,
    onDateChange,
    onAutoFillAll // ИЗМЕНЕНО: используем новую функцию автозаполнения
  } = props;

  console.log('[DashboardControlPanel] Rendering with CustomDatePicker and Auto Fill functionality, date:', selectedDate?.toLocaleDateString());

  // ИЗМЕНЕНО: Обработчик для кнопки Auto Fill All
  const handleAutoFillAllClick = (): void => {
    console.log('[DashboardControlPanel] Auto Fill All clicked - will process staff with autoschedule enabled');
    // Используем .then().catch() для обработки Promise
    onAutoFillAll()
      .then(() => {
        console.log('[DashboardControlPanel] Auto Fill All completed');
      })
      .catch(error => {
        console.error('[DashboardControlPanel] Error in Auto Fill All:', error);
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
        {/* ИЗМЕНЕНО: Кнопка теперь вызывает автозаполнение только для staff с включенным autoschedule */}
        <PrimaryButton 
          text="Auto Fill All" 
          onClick={handleAutoFillAllClick}
          disabled={isLoading || staffCount === 0}
          styles={{
            root: {
              backgroundColor: '#107c10', // зеленый цвет
              borderColor: '#107c10'
            }
          }}
          title="Automatically fill schedules for all staff members with Auto Schedule enabled"
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