// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useHolidays.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IHoliday, HolidaysService } from '../../../../services/HolidaysService';
import { ISRSTabState } from './useSRSTabState';

interface UseHolidaysProps {
  context?: WebPartContext;
  fromDate: Date;
  toDate: Date;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
}

interface UseHolidaysReturn {
  loadHolidays: () => void;
}

/**
 * Custom hook для загрузки праздников в SRS Tab
 * Адаптирован из Schedule Tab для работы с SRS состоянием и диапазоном дат
 * КЛЮЧЕВОЕ ОТЛИЧИЕ: Использует fromDate-toDate вместо месяца/года
 * *** ОБНОВЛЕНО: Упрощена работа с датами для Date-only формата ***
 */
export const useHolidays = (props: UseHolidaysProps): UseHolidaysReturn => {
  const { context, fromDate, toDate, setState } = props;

  console.log('[SRS useHolidays] Hook initialized with date range (Date-only format):', {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    hasContext: !!context
  });

  // Helper функции для обновления состояния SRS
  const setHolidays = useCallback((holidays: IHoliday[]) => {
    console.log('[SRS useHolidays] Setting holidays:', holidays.length);
    setState(prevState => ({ ...prevState, holidays }));
  }, [setState]);

  const setIsLoadingHolidays = useCallback((isLoading: boolean) => {
    console.log('[SRS useHolidays] Setting isLoadingHolidays:', isLoading);
    setState(prevState => ({ ...prevState, isLoadingHolidays: isLoading }));
  }, [setState]);

  const setError = useCallback((error?: string) => {
    if (error) {
      console.error('[SRS useHolidays] Setting error:', error);
    }
    setState(prevState => ({ ...prevState, errorSRS: error }));
  }, [setState]);

  /**
   * Загружает праздники для диапазона дат SRS
   * ОТЛИЧИЕ от Schedule: использует fromDate-toDate вместо месяца/года
   * *** ОБНОВЛЕНО: Упрощена логика фильтрации для Date-only формата ***
   */
  const loadHolidays = useCallback(async (): Promise<void> => {
    console.log('[SRS useHolidays] loadHolidays called for date range (Date-only):', {
      fromDate: fromDate.toLocaleDateString(),
      toDate: toDate.toLocaleDateString()
    });
    
    if (!context) {
      console.log('[SRS useHolidays] Cannot load holidays: missing context');
      setHolidays([]);
      setIsLoadingHolidays(false);
      return;
    }

    try {
      setIsLoadingHolidays(true);
      setError(undefined);

      console.log('[SRS useHolidays] Fetching holidays from service for date range');
      
      const holidaysService = HolidaysService.getInstance(context);
      
      // *** КЛЮЧЕВОЕ ОТЛИЧИЕ: Загружаем праздники для диапазона дат, а не для месяца ***
      // Определяем все месяцы в диапазоне для загрузки
      const monthsToLoad = getMonthsInDateRange(fromDate, toDate);
      
      console.log('[SRS useHolidays] Loading holidays for months:', monthsToLoad);
      
      // Загружаем праздники для всех месяцев в диапазоне
      const allHolidays: IHoliday[] = [];
      
      for (const monthYear of monthsToLoad) {
        try {
          console.log(`[SRS useHolidays] Loading holidays for ${monthYear.month}/${monthYear.year}`);
          // Создаем дату для месяца/года
          const monthDate = new Date(monthYear.year, monthYear.month - 1, 1);
          const monthHolidays = await holidaysService.getHolidaysByMonthAndYear(monthDate);
          allHolidays.push(...monthHolidays);
          console.log(`[SRS useHolidays] Loaded ${monthHolidays.length} holidays for ${monthYear.month}/${monthYear.year}`);
        } catch (monthError) {
          console.error(`[SRS useHolidays] Error loading holidays for ${monthYear.month}/${monthYear.year}:`, monthError);
          // Продолжаем загрузку других месяцев даже если один не загрузился
        }
      }
      
      // *** УПРОЩЕНО: Фильтрация праздников в точном диапазоне дат для Date-only формата ***
      const filteredHolidays = allHolidays.filter(holiday => {
        // Упрощенное сравнение без нормализации времени
        return holiday.date >= fromDate && holiday.date <= toDate;
      });

      console.log('[SRS useHolidays] Holidays loaded and filtered (Date-only):', {
        totalLoaded: allHolidays.length,
        filteredCount: filteredHolidays.length,
        dateRange: `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`
      });

      // Логируем найденные праздники для отладки
      if (filteredHolidays.length > 0) {
        console.log('[SRS useHolidays] Found holidays in SRS date range (Date-only):');
        filteredHolidays.forEach(holiday => {
          console.log(`  - ${holiday.title}: ${holiday.date.toLocaleDateString()}`);
        });
      } else {
        console.log('[SRS useHolidays] No holidays found in the specified SRS date range');
      }

      setHolidays(filteredHolidays);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SRS useHolidays] Error loading holidays:', error);
      
      setError(`Failed to load holidays: ${errorMessage}`);
      setHolidays([]);
      
    } finally {
      setIsLoadingHolidays(false);
    }
  }, [context, fromDate, toDate, setHolidays, setIsLoadingHolidays, setError]);

  // Эффект для автоматической загрузки при изменении контекста или дат
  useEffect(() => {
    console.log('[SRS useHolidays] useEffect triggered for context/dates change');
    console.log('[SRS useHolidays] Dependencies:', {
      hasContext: !!context,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString()
    });
    
    if (context) {
      void loadHolidays();
    } else {
      console.log('[SRS useHolidays] Context not available, clearing holidays');
      setHolidays([]);
      setIsLoadingHolidays(false);
    }
  }, [context, fromDate, toDate, loadHolidays]);

  return {
    loadHolidays
  };
};

/**
 * *** ИСПРАВЛЕНО: Функция получения месяцев в диапазоне дат ***
 * Возвращает список месяцев/годов, которые нужно загрузить для покрытия диапазона
 * ИСПРАВЛЕНО: Убрана ошибка no-unmodified-loop-condition
 */
function getMonthsInDateRange(fromDate: Date, toDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  
  // Нормализуем даты к первому дню месяца для корректного сравнения
  const startDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endDate = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  
  console.log('[getMonthsInDateRange] Calculating months for SRS range (Date-only):', {
    originalFrom: fromDate.toISOString(),
    originalTo: toDate.toISOString(),
    normalizedStart: startDate.toISOString(),
    normalizedEnd: endDate.toISOString()
  });
  
  // *** ИСПРАВЛЕНО: Используем отдельную переменную currentMonth для итерации ***
  let currentMonth = startDate.getMonth();
  let currentYear = startDate.getFullYear();
  const endMonth = endDate.getMonth();
  const endYear = endDate.getFullYear();
  
  // *** ИСПРАВЛЕНО: Цикл с правильным условием выхода ***
  while (currentYear < endYear || (currentYear === endYear && currentMonth <= endMonth)) {
    const month = currentMonth + 1; // API ожидает 1-12, а не 0-11
    
    months.push({ month, year: currentYear });
    console.log(`[getMonthsInDateRange] Added month for SRS: ${month}/${currentYear}`);
    
    // *** ИСПРАВЛЕНО: Переходим к следующему месяцу правильно ***
    currentMonth++;
    if (currentMonth > 11) { // Декабрь - это 11-й месяц (0-based)
      currentMonth = 0; // Январь следующего года
      currentYear++;
    }
  }
  
  console.log(`[getMonthsInDateRange] Total months to load for SRS: ${months.length}`);
  return months;
}

/**
 * *** УПРОЩЕНО: Проверка является ли дата праздником ***
 * Упрощена для Date-only формата - убрана нормализация времени
 */
export function isHolidayDate(date: Date, holidays: IHoliday[]): boolean {
  // УПРОЩЕНО: Прямое сравнение компонентов даты без нормализации времени
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();
  
  const isHoliday = holidays.some(holiday => {
    return holiday.date.getFullYear() === targetYear &&
           holiday.date.getMonth() === targetMonth &&
           holiday.date.getDate() === targetDay;
  });
  
  return isHoliday;
}

/**
 * *** УПРОЩЕНО: Получение информации о празднике ***
 * Упрощена для Date-only формата - убрана нормализация времени
 */
export function getHolidayInfo(date: Date, holidays: IHoliday[]): IHoliday | undefined {
  // УПРОЩЕНО: Прямое сравнение компонентов даты без нормализации времени
  const targetYear = date.getFullYear();
  const targetMonth = date.getMonth();
  const targetDay = date.getDate();
  
  const holiday = holidays.find(holiday => {
    return holiday.date.getFullYear() === targetYear &&
           holiday.date.getMonth() === targetMonth &&
           holiday.date.getDate() === targetDay;
  });
  
  return holiday;
}

/**
 * *** НОВАЯ ФУНКЦИЯ: Получение статистики праздников для SRS периода ***
 * Анализирует распределение праздников в выбранном диапазоне
 * *** УПРОЩЕНО: Для Date-only формата ***
 */
export function getHolidaysStatistics(
  holidays: IHoliday[], 
  fromDate: Date, 
  toDate: Date
): {
  totalHolidays: number;
  holidaysInRange: number;
  holidaysByMonth: Record<string, number>;
  holidaysList: Array<{ title: string; date: string; dayOfWeek: string }>;
} {
  console.log('[getHolidaysStatistics] Analyzing holidays for SRS period (Date-only):', {
    totalHolidays: holidays.length,
    fromDate: fromDate.toLocaleDateString(),
    toDate: toDate.toLocaleDateString()
  });

  // УПРОЩЕНО: Фильтрация без нормализации времени
  const holidaysInRange = holidays.filter(holiday => {
    return holiday.date >= fromDate && holiday.date <= toDate;
  });

  const holidaysByMonth = holidaysInRange.reduce((acc, holiday) => {
    const monthKey = `${holiday.date.getFullYear()}-${(holiday.date.getMonth() + 1).toString().padStart(2, '0')}`;
    acc[monthKey] = (acc[monthKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const holidaysList = holidaysInRange.map(holiday => {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      title: holiday.title,
      date: holiday.date.toLocaleDateString(),
      dayOfWeek: dayNames[holiday.date.getDay()]
    };
  });

  const statistics = {
    totalHolidays: holidays.length,
    holidaysInRange: holidaysInRange.length,
    holidaysByMonth,
    holidaysList
  };

  console.log('[getHolidaysStatistics] SRS holidays statistics (Date-only):', statistics);
  return statistics;
}

/**
 * *** УПРОЩЕНО: Проверка пересечения праздников с рабочими днями ***
 * Определяет какие праздники выпадают на рабочие дни в SRS записях
 * Упрощена для Date-only формата
 */
export function checkHolidayWorkdayOverlap(
  holidays: IHoliday[],
  workDates: Date[]
): Array<{
  holiday: IHoliday;
  workDate: Date;
  isWeekend: boolean;
}> {
  const overlaps: Array<{
    holiday: IHoliday;
    workDate: Date;
    isWeekend: boolean;
  }> = [];

  holidays.forEach(holiday => {
    // УПРОЩЕНО: Ищем совпадения без нормализации времени
    const matchingWorkDate = workDates.find(workDate => {
      return workDate.getFullYear() === holiday.date.getFullYear() &&
             workDate.getMonth() === holiday.date.getMonth() &&
             workDate.getDate() === holiday.date.getDate();
    });

    if (matchingWorkDate) {
      const isWeekend = holiday.date.getDay() === 0 || holiday.date.getDay() === 6; // Sunday = 0, Saturday = 6
      
      overlaps.push({
        holiday,
        workDate: matchingWorkDate,
        isWeekend
      });

      console.log(`[checkHolidayWorkdayOverlap] Found overlap (Date-only): ${holiday.title} on ${holiday.date.toLocaleDateString()} (${isWeekend ? 'Weekend' : 'Weekday'})`);
    }
  });

  console.log(`[checkHolidayWorkdayOverlap] Found ${overlaps.length} holiday-workday overlaps (Date-only)`);
  return overlaps;
}