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
 */
export const useHolidays = (props: UseHolidaysProps): UseHolidaysReturn => {
  const { context, fromDate, toDate, setState } = props;

  console.log('[SRS useHolidays] Hook initialized with date range:', {
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
   */
  const loadHolidays = useCallback(async (): Promise<void> => {
    console.log('[SRS useHolidays] loadHolidays called for date range:', {
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
      
      // *** КЛЮЧЕВАЯ ФИЛЬТРАЦИЯ: Оставляем только праздники в точном диапазоне дат ***
      const filteredHolidays = allHolidays.filter(holiday => {
        const holidayDate = new Date(holiday.date);
        const isInRange = holidayDate >= fromDate && holidayDate <= toDate;
        
        if (!isInRange) {
          console.log(`[SRS useHolidays] Holiday ${holiday.title} (${holidayDate.toLocaleDateString()}) is outside SRS date range, filtering out`);
        }
        
        return isInRange;
      });

      console.log('[SRS useHolidays] Holidays loaded and filtered:', {
        totalLoaded: allHolidays.length,
        filteredCount: filteredHolidays.length,
        dateRange: `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`
      });

      // Логируем найденные праздники для отладки
      if (filteredHolidays.length > 0) {
        console.log('[SRS useHolidays] Found holidays in SRS date range:');
        filteredHolidays.forEach(holiday => {
          console.log(`  - ${holiday.title}: ${new Date(holiday.date).toLocaleDateString()}`);
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
 * *** ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Получение месяцев в диапазоне дат ***
 * Возвращает список месяцев/годов, которые нужно загрузить для покрытия диапазона
 * АДАПТИРОВАНО для SRS: может охватывать несколько месяцев
 */
function getMonthsInDateRange(fromDate: Date, toDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  
  // Нормализуем даты к первому дню месяца для корректного сравнения
  const startDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endDate = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  
  console.log('[getMonthsInDateRange] Calculating months for SRS range:', {
    originalFrom: fromDate.toISOString(),
    originalTo: toDate.toISOString(),
    normalizedStart: startDate.toISOString(),
    normalizedEnd: endDate.toISOString()
  });
  
  // Перебираем месяцы от начальной до конечной даты
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const month = currentDate.getMonth() + 1; // API ожидает 1-12, а не 0-11
    const year = currentDate.getFullYear();
    
    months.push({ month, year });
    console.log(`[getMonthsInDateRange] Added month for SRS: ${month}/${year}`);
    
    // Переходим к следующему месяцу
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  console.log(`[getMonthsInDateRange] Total months to load for SRS: ${months.length}`);
  return months;
}

/**
 * *** ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Проверка является ли дата праздником ***
 * Для использования в компонентах SRS
 */
export function isHolidayDate(date: Date, holidays: IHoliday[]): boolean {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0); // Нормализуем к полуночи
  
  const isHoliday = holidays.some(holiday => {
    const holidayDate = new Date(holiday.date);
    holidayDate.setHours(0, 0, 0, 0); // Нормализуем к полуночи
    return holidayDate.getTime() === targetDate.getTime();
  });
  
  return isHoliday;
}

/**
 * *** ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: Получение информации о празднике ***
 * Возвращает объект праздника для указанной даты
 */
export function getHolidayInfo(date: Date, holidays: IHoliday[]): IHoliday | undefined {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0); // Нормализуем к полуночи
  
  const holiday = holidays.find(holiday => {
    const holidayDate = new Date(holiday.date);
    holidayDate.setHours(0, 0, 0, 0); // Нормализуем к полуночи
    return holidayDate.getTime() === targetDate.getTime();
  });
  
  return holiday;
}

/**
 * *** НОВАЯ ФУНКЦИЯ: Получение статистики праздников для SRS периода ***
 * Анализирует распределение праздников в выбранном диапазоне
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
  console.log('[getHolidaysStatistics] Analyzing holidays for SRS period:', {
    totalHolidays: holidays.length,
    fromDate: fromDate.toLocaleDateString(),
    toDate: toDate.toLocaleDateString()
  });

  const holidaysInRange = holidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    return holidayDate >= fromDate && holidayDate <= toDate;
  });

  const holidaysByMonth = holidaysInRange.reduce((acc, holiday) => {
    const holidayDate = new Date(holiday.date);
    const monthKey = `${holidayDate.getFullYear()}-${(holidayDate.getMonth() + 1).toString().padStart(2, '0')}`;
    acc[monthKey] = (acc[monthKey] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const holidaysList = holidaysInRange.map(holiday => {
    const holidayDate = new Date(holiday.date);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return {
      title: holiday.title,
      date: holidayDate.toLocaleDateString(),
      dayOfWeek: dayNames[holidayDate.getDay()]
    };
  });

  const statistics = {
    totalHolidays: holidays.length,
    holidaysInRange: holidaysInRange.length,
    holidaysByMonth,
    holidaysList
  };

  console.log('[getHolidaysStatistics] SRS holidays statistics:', statistics);
  return statistics;
}

/**
 * *** НОВАЯ ФУНКЦИЯ: Проверка пересечения праздников с рабочими днями ***
 * Определяет какие праздники выпадают на рабочие дни в SRS записях
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
    const holidayDate = new Date(holiday.date);
    
    // Ищем совпадения с рабочими днями
    const matchingWorkDate = workDates.find(workDate => {
      const workDateNormalized = new Date(workDate);
      workDateNormalized.setHours(0, 0, 0, 0);
      holidayDate.setHours(0, 0, 0, 0);
      return workDateNormalized.getTime() === holidayDate.getTime();
    });

    if (matchingWorkDate) {
      const isWeekend = holidayDate.getDay() === 0 || holidayDate.getDay() === 6; // Sunday = 0, Saturday = 6
      
      overlaps.push({
        holiday,
        workDate: matchingWorkDate,
        isWeekend
      });

      console.log(`[checkHolidayWorkdayOverlap] Found overlap: ${holiday.title} on ${holidayDate.toLocaleDateString()} (${isWeekend ? 'Weekend' : 'Weekday'})`);
    }
  });

  console.log(`[checkHolidayWorkdayOverlap] Found ${overlaps.length} holiday-workday overlaps`);
  return overlaps;
}