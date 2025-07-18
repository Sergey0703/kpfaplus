// src/webparts/kpfaplus/components/Tabs/LeavesTab/components/LeavesFilterPanel.tsx
import * as React from 'react';
import { DatePicker, Dropdown, IDropdownOption, Toggle, PrimaryButton, Spinner, DayOfWeek, Stack } from '@fluentui/react';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';

interface ILeavesFilterPanelProps {
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
  selectedTypeFilter: string;
  showDeleted: boolean;
  typesOfLeave: ITypeOfLeave[];
  isLoading: boolean;
  onPeriodStartChange: (date: Date | undefined) => void;
  onPeriodEndChange: (date: Date | undefined) => void;
  onTypeFilterChange: (typeId: string) => void;
  onShowDeletedChange: (checked: boolean) => void;
  onAddNewLeave: () => void;
  // Новые props для управления сохранением
  hasUnsavedChanges?: boolean;
  onSaveChanges: () => void;
}

// Локализация для DatePicker (та же что и раньше)
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

// ОБНОВЛЕНО: Форматирование даты в формате dd.mm.yyyy для Date-only
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  // Используем локальные компоненты даты для избежания проблем с часовыми поясами
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

// НОВАЯ ФУНКЦИЯ: Нормализация даты для работы с Date-only
const normalizeDateForDateOnly = (date: Date): Date => {
  // Создаем новую дату с теми же компонентами, но без времени
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

// НОВАЯ ФУНКЦИЯ: Создание последнего дня месяца для выбранной даты
const getLastDayOfMonth = (date: Date): Date => {
  // Создаем дату первого дня следующего месяца, затем вычитаем 1 день
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
};

const calendarMinWidth = '655px';

export const LeavesFilterPanel: React.FC<ILeavesFilterPanelProps> = (props) => {
  const {
    selectedPeriodStart,
    selectedPeriodEnd,
    selectedTypeFilter,
    showDeleted,
    typesOfLeave,
    isLoading,
    onPeriodStartChange,
    onPeriodEndChange,
    onTypeFilterChange,
    onShowDeletedChange,
    onAddNewLeave,
    hasUnsavedChanges = false,
    onSaveChanges
  } = props;

  console.log('[LeavesFilterPanel] Rendering with types:', typesOfLeave.length, 'hasUnsavedChanges:', hasUnsavedChanges);

  // Подготавливаем опции для dropdown типов отпусков
  const typeOptions: IDropdownOption[] = [
    { key: '', text: 'All Types' },
    ...typesOfLeave.map(type => ({
      key: type.id,
      text: type.title
    }))
  ];

  // ОБНОВЛЕНО: Обработчик для первого датапикера (начало периода) с Date-only
  const handleStartDateSelect = (date: Date | null | undefined): void => {
    if (date) {
      // Нормализуем дату для Date-only формата
      const normalizedStartDate = normalizeDateForDateOnly(date);
      
      console.log('[LeavesFilterPanel] Start date selected:', formatDate(normalizedStartDate));
      
      // Устанавливаем выбранную дату как начало периода
      onPeriodStartChange(normalizedStartDate);
      
      // Автоматически устанавливаем конец периода как последний день того же месяца
      const lastDayOfMonth = getLastDayOfMonth(normalizedStartDate);
      const normalizedEndDate = normalizeDateForDateOnly(lastDayOfMonth);
      
      console.log('[LeavesFilterPanel] Auto-setting end date to last day of month:', formatDate(normalizedEndDate));
      
      // Сохраняем автоматически установленную дату окончания в sessionStorage
      try {
        sessionStorage.setItem('leavesTab_periodEnd', normalizedEndDate.toISOString());
        console.log('[LeavesFilterPanel] Auto-set period end saved to sessionStorage:', normalizedEndDate.toISOString());
      } catch (error) {
        console.warn('[LeavesFilterPanel] Error saving auto-set period end to sessionStorage:', error);
      }
      
      onPeriodEndChange(normalizedEndDate);
    }
  };

  // ОБНОВЛЕНО: Обработчик для второго датапикера (конец периода) с Date-only
  const handleEndDateSelect = (date: Date | null | undefined): void => {
    if (date) {
      // Нормализуем дату для Date-only формата
      const normalizedEndDate = normalizeDateForDateOnly(date);
      
      console.log('[LeavesFilterPanel] End date manually selected:', formatDate(normalizedEndDate));
      onPeriodEndChange(normalizedEndDate);
    }
  };

  // Обработчик для кнопки New
  const handleNewButtonClick = (): void => {
    console.log('[LeavesFilterPanel] New button clicked');
    onAddNewLeave();
  };

  // Обработчик для кнопки Save - НОВЫЙ
  const handleSaveButtonClick = (): void => {
    console.log('[LeavesFilterPanel] Save button clicked');
    onSaveChanges();
  };

  // Обработчики закрытия календарей
  const calendarDismissHandlerStart = (): void => {
    console.log('[LeavesFilterPanel] Start date calendar dismissed');
  };

  const calendarDismissHandlerEnd = (): void => {
    console.log('[LeavesFilterPanel] End date calendar dismissed');
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '15px',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e1e5e9'
    }}>
      <Stack.Item style={{ minWidth: '220px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '5px',
          color: '#323130'
        }}>Start Date</div>
        <DatePicker
          value={selectedPeriodStart}
          onSelectDate={handleStartDateSelect}
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
            onDismiss: calendarDismissHandlerStart,
            firstDayOfWeek: DayOfWeek.Monday,
            showGoToToday: true,
            showSixWeeksByDefault: true,
            showWeekNumbers: false,
            // ОБНОВЛЕНО: Обработка выбора даты в календаре для Date-only
            onSelectDate: (selectedDate): void => {
              if (selectedDate) {
                // Нормализуем выбранную дату и обрабатываем
                const normalizedDate = normalizeDateForDateOnly(selectedDate);
                handleStartDateSelect(normalizedDate);
              }
            }
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
      
      <Stack.Item style={{ minWidth: '220px' }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '600',
          marginBottom: '5px',
          color: '#323130'
        }}>End Date</div>
        <DatePicker
          value={selectedPeriodEnd}
          onSelectDate={handleEndDateSelect}
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
            onDismiss: calendarDismissHandlerEnd,
            firstDayOfWeek: DayOfWeek.Monday,
            showGoToToday: true,
            showSixWeeksByDefault: true,
            showWeekNumbers: false,
            // ОБНОВЛЕНО: Обработка выбора даты в календаре для Date-only
            onSelectDate: (selectedDate): void => {
              if (selectedDate) {
                // Нормализуем выбранную дату и обрабатываем
                const normalizedDate = normalizeDateForDateOnly(selectedDate);
                handleEndDateSelect(normalizedDate);
              }
            }
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
      
      <div style={{ minWidth: '200px' }}>
        <Dropdown
          label="Select Type of Leave"
          options={typeOptions}
          selectedKey={selectedTypeFilter}
          onChange={(_, option) => option && onTypeFilterChange(option.key as string)}
          disabled={isLoading || typesOfLeave.length === 0}
        />
      </div>
      
      <div>
        <Toggle
          label="Show Deleted"
          checked={showDeleted}
          onChange={(_, checked) => onShowDeletedChange(!!checked)}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <PrimaryButton 
          text="New" 
          onClick={handleNewButtonClick}
          disabled={isLoading}
          styles={{
            root: {
              backgroundColor: '#107c10', // зеленый цвет для создания
              borderColor: '#107c10'
            }
          }}
        />
        <PrimaryButton 
          text={hasUnsavedChanges ? "Save *" : "Save"}
          onClick={handleSaveButtonClick}
          disabled={!hasUnsavedChanges || isLoading}
          styles={{
            root: {
              backgroundColor: hasUnsavedChanges ? '#0078d4' : '#a19f9d', // синий если есть изменения, серый если нет
              borderColor: hasUnsavedChanges ? '#0078d4' : '#a19f9d',
              color: 'white'
            }
          }}
        />
      </div>
      
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Spinner size={1} />
          <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
        </div>
      )}
    </div>
  );
};