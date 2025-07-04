// src/webparts/kpfaplus/components/CustomDatePicker/CustomDatePicker.tsx
import * as React from 'react';
import {
  DatePicker,
  DayOfWeek,
  IDatePickerStrings,
  IDatePickerStyles,
  ICalloutProps
} from '@fluentui/react';

export interface ICustomDatePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  showGoToToday?: boolean;
  firstDayOfWeek?: DayOfWeek;
  styles?: Partial<IDatePickerStyles>;
  calloutProps?: ICalloutProps;
  'data-testid'?: string;
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
  shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
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

/**
 * Utility functions for date normalization
 * These functions ensure consistent date handling across the application
 */
export class DateUtils {
  /**
   * Normalizes date to UTC midnight (00:00:00 UTC time)
   * This ensures no timezone shift issues when working with dates
   */
  static normalizeToUTCMidnight(date: Date | undefined): Date | undefined {
    if (!date) return undefined;
    
    console.log('[CustomDatePicker] [DateUtils] Input date:', date.toISOString());
    
    // Get the local date components
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    // Create new date with UTC midnight time
    const normalized = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    
    console.log('[CustomDatePicker] [DateUtils] Normalized date (UTC midnight):', normalized.toISOString());
    return normalized;
  }

  /**
   * НОВАЯ ФУНКЦИЯ: Принимает объект Date и возвращает новый объект Date, 
   * у которого время установлено на полночь по UTC (00:00:00.000Z).
   * Это гарантирует, что при сохранении в SharePoint будет использоваться только дата, без времени.
   * @param localDate - Дата для нормализации.
   * @returns Новый объект Date, нормализованный к полуночи по UTC.
   */
  static normalizeDateToUTCMidnight(localDate: Date | undefined): Date {
    if (!localDate || !(localDate instanceof Date) || isNaN(localDate.getTime())) {
      console.warn('[DateUtils] normalizeDateToUTCMidnight: Invalid date provided:', localDate);
      return new Date(); // Возвращаем текущую дату как fallback
    }
    
    // Создаем новую дату, чтобы не изменять исходный объект (иммутабельность)
    const normalizedDate = new Date(localDate);
    // Устанавливаем время на 00:00:00.000 в UTC
    normalizedDate.setUTCHours(0, 0, 0, 0); 
    
    console.log(`[DateUtils] Normalized date: ${localDate.toISOString()} -> ${normalizedDate.toISOString()}`);
    return normalizedDate;
  }

  /**
   * НОВАЯ ФУНКЦИЯ: Нормализует дату для записи StaffRecord - устанавливает время на полночь UTC
   * Специальная версия для StaffRecords
   */
  static normalizeStaffRecordDate(date: Date): Date {
    return DateUtils.normalizeDateToUTCMidnight(date);
  }

  /**
   * НОВАЯ ФУНКЦИЯ: Создает дату с временем для ShiftDate1/ShiftDate2 - сохраняет время, но нормализует дату
   */
  static createShiftDateTime(baseDate: Date, hours: number, minutes: number): Date {
    // Сначала нормализуем базовую дату к UTC полуночи
    const normalizedBase = DateUtils.normalizeDateToUTCMidnight(baseDate);
    // Затем добавляем время в UTC
    normalizedBase.setUTCHours(hours, minutes, 0, 0);
    console.log(`[DateUtils] Created shift datetime: base=${baseDate.toISOString()}, time=${hours}:${minutes}, result=${normalizedBase.toISOString()}`);
    return normalizedBase;
  }

  /**
   * Creates a date from local date components at UTC midnight
   * This is useful when you want to create a date representing a specific day
   * without timezone complications
   */
  static createUTCDate(year: number, month: number, day: number): Date {
    const date = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    console.log('[CustomDatePicker] [DateUtils] Created UTC date:', date.toISOString(), `from components: ${year}-${month + 1}-${day}`);
    return date;
  }

  /**
   * Formats date for display as dd.mm.yyyy
   * Uses local date components to avoid timezone issues in display
   */
  static formatForDisplay(date?: Date): string {
    if (!date) return '';
    
    // Use local date components for display to avoid timezone confusion
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  }

  /**
   * Serializes date for storage (date-only format YYYY-MM-DD)
   * Uses local date components to ensure the displayed date is what gets saved
   */
  static serializeDateOnly(date?: Date): string {
    if (!date) return '';
    
    // Use local date components for serialization
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    const serialized = `${year}-${month}-${day}`;
    console.log('[CustomDatePicker] [DateUtils] Serialized date:', serialized, 'from date:', date.toISOString());
    return serialized;
  }

  /**
   * Deserializes date from storage (YYYY-MM-DD format to UTC midnight)
   * Creates a date that represents the specified day at UTC midnight
   */
  static deserializeDateOnly(dateString: string): Date | undefined {
    if (!dateString) return undefined;
    
    try {
      console.log('[CustomDatePicker] [DateUtils] Deserializing date string:', dateString);
      
      // Parse YYYY-MM-DD format
      const parts = dateString.split('-');
      if (parts.length !== 3) {
        console.warn('[CustomDatePicker] [DateUtils] Invalid date format:', dateString);
        return undefined;
      }
      
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Month is 0-based in JavaScript
      const day = parseInt(parts[2], 10);
      
      if (isNaN(year) || isNaN(month) || isNaN(day)) {
        console.warn('[CustomDatePicker] [DateUtils] Invalid date components:', { year, month: month + 1, day });
        return undefined;
      }
      
      // Create date with UTC midnight - this ensures the date represents the exact day
      // regardless of user's timezone
      const deserialized = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
      console.log('[CustomDatePicker] [DateUtils] Deserialized date (UTC midnight):', deserialized.toISOString());
      
      return deserialized;
    } catch (error) {
      console.error('[CustomDatePicker] [DateUtils] Error deserializing date:', error);
      return undefined;
    }
  }

  /**
   * Gets the first day of the current month at UTC midnight
   */
  static getFirstDayOfCurrentMonth(): Date {
    const now = new Date();
    return DateUtils.createUTCDate(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * Checks if two dates represent the same day (ignoring time)
   */
  static isSameDay(date1?: Date, date2?: Date): boolean {
    if (!date1 || !date2) return false;
    
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * ИСПРАВЛЕНО: Gets the start of month for a given date
   * Возвращает первый день месяца в 00:00:00 UTC
   * Для фильтрации используется принцип "больше или равно" (ge)
   */
  static getStartOfMonth(date: Date): Date {
    console.log('[DateUtils] getStartOfMonth input:', date.toISOString());
    
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // ИСПРАВЛЕНО: Возвращаем точно первый день месяца в полночь UTC
    // Фильтр SharePoint "ge" (больше или равно) должен включить записи с этой датой
    const result = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    
    console.log('[DateUtils] getStartOfMonth result (first day UTC midnight):', result.toISOString());
    console.log('[DateUtils] getStartOfMonth day of month:', result.getUTCDate());
    console.log('[DateUtils] getStartOfMonth month:', result.getUTCMonth() + 1);
    
    return result;
  }

  /**
   * ИСПРАВЛЕНО: Gets the end of month for a given date
   * Возвращает последний день месяца в 23:59:59.999 UTC
   */
  static getEndOfMonth(date: Date): Date {
    console.log('[DateUtils] getEndOfMonth input:', date.toISOString());
    
    // Получаем последний день месяца через стандартный JavaScript подход
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Используем new Date(year, month + 1, 0) для получения последнего дня текущего месяца
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const lastDay = lastDayOfMonth.getDate();
    
    // Создаем дату последнего дня месяца в конце дня (23:59:59.999 UTC)
    const result = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999));
    
    console.log('[DateUtils] getEndOfMonth result (last day UTC end-of-day):', result.toISOString());
    console.log('[DateUtils] getEndOfMonth day of month:', result.getUTCDate());
    console.log('[DateUtils] getEndOfMonth calculated last day:', lastDay);
    
    return result;
  }

  /**
   * НОВАЯ ФУНКЦИЯ: Создает начальную дату для фильтра SharePoint
   * Использует небольшой отрицательный offset для гарантии включения граничных дат
   */
  static getStartOfMonthForFilter(date: Date): Date {
    console.log('[DateUtils] getStartOfMonthForFilter input:', date.toISOString());
    
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Создаем дату первого дня месяца в полночь UTC
    const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    
    // Отнимаем 1 секунду для гарантированного включения записей с этой датой
    // SharePoint фильтр "ge" иногда может исключать точные совпадения из-за точности миллисекунд
    const result = new Date(firstDay.getTime() - 1000);
    
    console.log('[DateUtils] getStartOfMonthForFilter result (with 1s offset):', result.toISOString());
    console.log('[DateUtils] getStartOfMonthForFilter original first day:', firstDay.toISOString());
    
    return result;
  }

  /**
   * НОВАЯ ФУНКЦИЯ: Создает конечную дату для фильтра SharePoint
   * Использует конец дня плюс небольшой положительный offset
   */
  static getEndOfMonthForFilter(date: Date): Date {
    console.log('[DateUtils] getEndOfMonthForFilter input:', date.toISOString());
    
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // Получаем последний день месяца
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const lastDay = lastDayOfMonth.getDate();
    
    // Создаем дату последнего дня месяца в конце дня UTC
    const endOfLastDay = new Date(Date.UTC(year, month, lastDay, 23, 59, 59, 999));
    
    // Добавляем 1 секунду для гарантированного включения записей последнего дня
    const result = new Date(endOfLastDay.getTime() + 1000);
    
    console.log('[DateUtils] getEndOfMonthForFilter result (with 1s offset):', result.toISOString());
    console.log('[DateUtils] getEndOfMonthForFilter original end of day:', endOfLastDay.toISOString());
    
    return result;
  }

  /**
   * ОТЛАДОЧНАЯ ФУНКЦИЯ: Проверяет, попадает ли дата в диапазон фильтра
   */
  static isDateInFilterRange(testDate: Date, startFilter: Date, endFilter: Date): boolean {
    const inRange = testDate >= startFilter && testDate <= endFilter;
    console.log(`[DateUtils] Date range check:
      Test date: ${testDate.toISOString()}
      Start filter: ${startFilter.toISOString()}
      End filter: ${endFilter.toISOString()}
      In range: ${inRange}
      Test >= Start: ${testDate >= startFilter}
      Test <= End: ${testDate <= endFilter}`);
    return inRange;
  }

  /**
   * ОТЛАДОЧНАЯ ФУНКЦИЯ: Логирует информацию о месячном диапазоне
   */
  static logMonthlyRange(inputDate: Date, startDate: Date, endDate: Date): void {
    console.log(`[DateUtils] *** MONTHLY RANGE DEBUG ***
      Input date: ${inputDate.toISOString()}
      Input month: ${inputDate.getUTCMonth() + 1}/${inputDate.getUTCFullYear()}
      Input day: ${inputDate.getUTCDate()}
      
      Filter start: ${startDate.toISOString()}
      Filter end: ${endDate.toISOString()}
      
      Range days: ${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))}
      
      Test dates:
      - First of month: ${DateUtils.isDateInFilterRange(
        new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), 1, 0, 0, 0, 0)),
        startDate,
        endDate
      )}
      - Middle of month: ${DateUtils.isDateInFilterRange(
        new Date(Date.UTC(inputDate.getUTCFullYear(), inputDate.getUTCMonth(), 15, 12, 0, 0, 0)),
        startDate,
        endDate
      )}
    `);
  }
}

export const CustomDatePicker: React.FC<ICustomDatePickerProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = "Select date",
  label,
  showGoToToday = true,
  firstDayOfWeek = DayOfWeek.Monday,
  styles,
  calloutProps,
  'data-testid': dataTestId,
}) => {
  console.log('[CustomDatePicker] Rendering with value:', value?.toISOString());

  // Normalize the incoming value to UTC midnight
  const normalizedValue = React.useMemo(() => {
    return DateUtils.normalizeToUTCMidnight(value);
  }, [value]);

  console.log('[CustomDatePicker] Normalized value:', normalizedValue?.toISOString());

  // Handler for date selection
  const handleDateSelect = React.useCallback((date: Date | undefined): void => {
    console.log('[CustomDatePicker] Date selected from picker:', date?.toISOString());
    
    // Normalize the selected date and pass it to parent
    const normalizedDate = DateUtils.normalizeToUTCMidnight(date);
    console.log('[CustomDatePicker] Calling onChange with normalized date:', normalizedDate?.toISOString());
    
    onChange(normalizedDate);
  }, [onChange]);

  // Format date for display
  const formatDate = React.useCallback((date?: Date): string => {
    return DateUtils.formatForDisplay(date);
  }, []);

  // Calendar dismiss handler
  const handleCalendarDismiss = React.useCallback((): void => {
    console.log('[CustomDatePicker] Calendar dismissed');
  }, []);

  // Default styles matching FilterControls specifications
  const defaultStyles: Partial<IDatePickerStyles> = {
    root: {
      width: '220px', // Match FilterControls width
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
    // Merge custom styles if provided
    ...styles
  };

  // Default callout props matching FilterControls specifications
  const defaultCalloutProps: ICalloutProps = {
    styles: {
      calloutMain: {
        minWidth: '655px', // Match FilterControls calendar min width
      }
    },
    ...calloutProps
  };

  return (
    <DatePicker
      value={normalizedValue}
      onSelectDate={handleDateSelect}
      firstDayOfWeek={firstDayOfWeek}
      strings={datePickerStringsEN}
      formatDate={formatDate}
      allowTextInput={false}
      disabled={disabled}
      placeholder={placeholder}
      label={label}
      showGoToToday={showGoToToday}
      showMonthPickerAsOverlay={true}
      styles={defaultStyles}
      calendarProps={{
        onDismiss: handleCalendarDismiss,
        firstDayOfWeek: firstDayOfWeek,
        showGoToToday: showGoToToday,
        showSixWeeksByDefault: true,
        showWeekNumbers: false,
      }}
      calloutProps={defaultCalloutProps}
      data-testid={dataTestId}
    />
  );
};