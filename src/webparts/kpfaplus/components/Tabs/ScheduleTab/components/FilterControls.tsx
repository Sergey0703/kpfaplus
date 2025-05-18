// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/FilterControls.tsx
import * as React from 'react';
import {
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  DatePicker,
  DayOfWeek,
  IDatePickerStrings,
  mergeStyleSets,
  Stack,
  IStackTokens,
  IStackStyles,
} from '@fluentui/react';
import { IContract } from '../../../../models/IContract';

export interface IFilterControlsProps {
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onFillButtonClick?: () => void;
}

// English localization for the DatePicker
const datePickerStringsEN: IDatePickerStrings = {
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  shortMonths: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  days: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
  ],
  shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'], // Or Sun, Mon, Tue...
  goToToday: 'Go to today',
  prevMonthAriaLabel: 'Go to previous month',
  nextMonthAriaLabel: 'Go to next month',
  prevYearAriaLabel: 'Go to previous year',
  nextYearAriaLabel: 'Go to next year',
  closeButtonAriaLabel: 'Close date picker',
  monthPickerHeaderAriaLabel: '{0}, select a month',
  yearPickerHeaderAriaLabel: '{0}, select a year',
  isRequiredErrorMessage: 'Field is required.',
  invalidInputErrorMessage: 'Invalid date format.'
};

const controlStyles = mergeStyleSets({
  controlGroup: {
    marginRight: '40px'
  },
  label: {
    marginBottom: '5px',
    fontWeight: 600
    // No need to translate "Выберите дату" / "Выберите контракт" here,
    // as these are part of your component's JSX, not the DatePicker's internal strings.
    // If you want to translate these labels too, you'll need to do it in the JSX.
  }
});

const stackStyles: IStackStyles = {
  root: {
    display: 'flex',
    alignItems: 'flex-end',
    marginTop: '15px',
    marginBottom: '15px'
  }
};

const stackTokens: IStackTokens = {
  childrenGap: 20
};

export const FilterControls: React.FC<IFilterControlsProps> = ({
  selectedDate,
  contracts,
  selectedContractId,
  isLoading,
  onDateChange,
  onContractChange,
  onFillButtonClick
}) => {
  console.log('[FilterControls] Rendering with selectedDate:', selectedDate.toISOString());

  const contractOptions: IDropdownOption[] = contracts.map(contract => ({
    key: contract.id,
    text: contract.template
  }));

  const handleDateSelect = (date: Date | null | undefined): void => {
    console.log('[FilterControls] Date selected:', date?.toISOString());
    if (date) {
      onDateChange(date);
    }
  };

  // Date formatting can remain language-agnostic (dd.mm.yyyy) or be changed
  // For example, for US format (mm/dd/yyyy):
  // const formatDate = (date?: Date): string => {
  //   if (!date) return '';
  //   const month = (date.getMonth() + 1).toString().padStart(2, '0');
  //   const day = date.getDate().toString().padStart(2, '0');
  //   const year = date.getFullYear();
  //   return `${month}/${day}/${year}`;
  // };
  // For now, keeping your dd.mm.yyyy format:
  const formatDate = (date?: Date): string => {
    if (!date) return '';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };


  const calendarDismissHandler = (): void => {
    console.log('[FilterControls] Calendar dismissed');
  };

  const calendarMinWidth = '655px';

  return (
    <Stack horizontal styles={stackStyles} tokens={stackTokens}>
      <Stack.Item className={controlStyles.controlGroup}>
        {/* Translate these labels if needed */}
        <div className={controlStyles.label}>Select date</div> {/* Изменено */}
        <DatePicker
          value={selectedDate}
          onSelectDate={handleDateSelect}
          firstDayOfWeek={DayOfWeek.Monday} // Monday is common in Europe, Sunday in US
          strings={datePickerStringsEN} // Using English strings
          formatDate={formatDate} // Using your custom dd.mm.yyyy format
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
                  color: '#a19f9d', // Style to dim days from other months
                },
                // If the above doesn't work, and text is in a span:
                // 'td[class*="dayOutsideNavigatedMonth"] button[class*="dayButton"] span': {
                //   color: '#a19f9d',
                // },
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

      <Stack.Item className={controlStyles.controlGroup}>
        {/* Translate these labels if needed */}
        <div className={controlStyles.label}>Select contract</div> {/* Изменено */}
        <Dropdown
          // placeholder="Выберите контракт" // Translate if needed
          placeholder="Select contract" // Изменено
          options={contractOptions}
          selectedKey={selectedContractId}
          onChange={onContractChange}
          disabled={isLoading || contractOptions.length === 0}
          styles={{
            root: { width: '250px' }
          }}
        />
      </Stack.Item>

      <Stack.Item align="end">
        <PrimaryButton
          text="Fill" // "Fill" is already English
          onClick={onFillButtonClick}
          disabled={isLoading}
          styles={{
            root: {
              backgroundColor: '#0078d4',
              minWidth: '80px',
              height: '32px'
            }
          }}
        />
      </Stack.Item>
    </Stack>
  );
};