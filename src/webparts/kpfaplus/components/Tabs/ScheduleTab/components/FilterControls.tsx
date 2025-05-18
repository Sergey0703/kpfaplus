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

const datePickerStrings: IDatePickerStrings = {
  months: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
  ],
  shortMonths: [
    'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июнь',
    'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'
  ],
  days: [
    'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
    'Четверг', 'Пятница', 'Суббота'
  ],
  shortDays: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
  goToToday: 'Сегодня',
  prevMonthAriaLabel: 'Предыдущий месяц',
  nextMonthAriaLabel: 'Следующий месяц',
  prevYearAriaLabel: 'Предыдущий год',
  nextYearAriaLabel: 'Следующий год',
  closeButtonAriaLabel: 'Закрыть',
  monthPickerHeaderAriaLabel: '{0}, выберите месяц',
  yearPickerHeaderAriaLabel: '{0}, выберите год',
  isRequiredErrorMessage: 'Необходимо выбрать дату',
  invalidInputErrorMessage: 'Неверный формат даты'
};

const controlStyles = mergeStyleSets({
  controlGroup: {
    marginRight: '40px'
  },
  label: {
    marginBottom: '5px',
    fontWeight: 600
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
        <div className={controlStyles.label}>Выберите дату</div>
        <DatePicker
          value={selectedDate}
          onSelectDate={handleDateSelect}
          firstDayOfWeek={DayOfWeek.Monday}
          strings={datePickerStrings}
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
                // Попытка скрыть дни из других месяцев через CSS
                // Этот селектор может потребовать уточнения на основе DOM!
                '.ms-DatePicker-day--disabled.ms-DatePicker-day--outfocus .ms-DatePicker-day-button': {
                   visibility: 'hidden', // Скрываем содержимое кнопки дня
                },
                // Или, если у них есть более специфический класс для "вне месяца":
                // '.ms-DatePicker-day--นอกเดือน .ms-DatePicker-day-button': { // Замените 'นอกเดือน' на реальный класс
                //   visibility: 'hidden',
                // },
                // Если нужно скрыть всю ячейку, а не только текст:
                // '.ms-DatePicker-day--disabled.ms-DatePicker-day--outfocus': {
                //   visibility: 'hidden',
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
            showSixWeeksByDefault: true, // Важно оставить, чтобы сетка не "прыгала"
            showWeekNumbers: false,
            // showDaysOutsideCurrentMonth: false, // Убрано из-за ошибки
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
        <div className={controlStyles.label}>Выберите контракт</div>
        <Dropdown
          placeholder="Выберите контракт"
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
          text="Fill"
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