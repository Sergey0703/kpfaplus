// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardControlPanel.tsx
import * as React from 'react';
import { DatePicker, PrimaryButton, DayOfWeek, Stack, Spinner } from '@fluentui/react';

// Локализация для DatePicker (такая же как в LeavesTab)
const datePickerStringsEN = {
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  shortMonths: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  days: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ],
  shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  goToToday: 'Go to today',
  weekNumberFormatString: 'Week number {0}',
  prevMonthAriaLabel: 'Previous month',
  nextMonthAriaLabel: 'Next month',
  prevYearAriaLabel: 'Previous year',
  nextYearAriaLabel: 'Next year',
  closeButtonAriaLabel: 'Close date picker',
  monthPickerHeaderAriaLabel: '{0}, select to change the year',
  yearPickerHeaderAriaLabel: '{0}, select to change the month'
};

// Форматирование даты в формате dd.mm.yyyy
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

const calendarMinWidth = '655px';

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

  console.log('[DashboardControlPanel] Rendering with date:', formatDate(selectedDate));

  // Обработчик закрытия календаря
  const calendarDismissHandler = (): void => {
    console.log('[DashboardControlPanel] Calendar dismissed');
  };

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
        <DatePicker
          value={selectedDate}
          onSelectDate={onDateChange}
          firstDayOfWeek={DayOfWeek.Monday}
          strings={datePickerStringsEN}
          formatDate={formatDate}
          allowTextInput={false}
          disabled={isLoading}
          showGoToToday={true}
          showMonthPickerAsOverlay={true}
          styles={{
            root: {
              width: '220px',
              selectors: {
                '.ms-DatePicker-weekday': {
                  width: '35px',
                  height: '35px',
                  lineHeight: '35px',
                  padding: 0,
                  textAlign: 'center',
                  fontSize: '12px',
                },
                '.ms-DatePicker-day': {
                  width: '35px',
                  height: '35px',
                  lineHeight: '35px',
                  padding: 0,
                  margin: 0,
                  fontSize: '14px',
                  textAlign: 'center',
                },
                'td[class*="dayOutsideNavigatedMonth"] button[class*="dayButton"]': {
                  color: '#a19f9d',
                },
                '.ms-DatePicker-table': {
                  width: '100%',
                },
              }
            },
            textField: {
              width: '100%',
              height: '32px',
              selectors: {
                '.ms-TextField-field': { height: '32px' },
              },
            },
          }}
          calendarProps={{
            onDismiss: calendarDismissHandler,
            firstDayOfWeek: DayOfWeek.Monday,
            showGoToToday: true,
            showSixWeeksByDefault: true,
            showWeekNumbers: false,
          }}
          calloutProps={{
            styles: {
              calloutMain: {
                minWidth: calendarMinWidth,
              }
            }
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