// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useHolidays.ts

import { useEffect, useCallback, useRef } from 'react';
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
 * *** ИСПРАВЛЕНО: Упрощена логика, убраны race conditions и problematic timeout ***
 */
export const useHolidays = (props: UseHolidaysProps): UseHolidaysReturn => {
  const { context, fromDate, toDate, setState } = props;

  // *** ИСПРАВЛЕНО: Простое отслеживание состояния загрузки без race conditions ***
  const isLoadingRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  console.log('[SRS useHolidays] Hook initialized with SIMPLIFIED LOGIC (NO RACE CONDITIONS):', {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    hasContext: !!context,
    fixApplied: 'Simplified loading logic, removed race conditions and timeout'
  });

  // *** ИСПРАВЛЕНО: Простые helper функции без сложной логики ***
  const setHolidays = useCallback((holidays: IHoliday[]) => {
    if (!mountedRef.current) {
      console.log('[SRS useHolidays] Component unmounted, skipping setHolidays');
      return;
    }
    
    console.log('[SRS useHolidays] Setting holidays:', holidays.length);
    setState(prevState => ({ 
      ...prevState, 
      holidays: holidays,
      isLoadingHolidays: false 
    }));
  }, [setState]);

  const setIsLoadingHolidays = useCallback((isLoading: boolean) => {
    if (!mountedRef.current) {
      console.log('[SRS useHolidays] Component unmounted, skipping setIsLoadingHolidays');
      return;
    }
    
    console.log('[SRS useHolidays] Setting isLoadingHolidays:', isLoading);
    setState(prevState => ({ 
      ...prevState, 
      isLoadingHolidays: isLoading 
    }));
    isLoadingRef.current = isLoading;
  }, [setState]);

  const setError = useCallback((error?: string) => {
    if (!mountedRef.current) {
      console.log('[SRS useHolidays] Component unmounted, skipping setError');
      return;
    }
    
    if (error) {
      console.error('[SRS useHolidays] Setting error:', error);
    }
    setState(prevState => ({ 
      ...prevState, 
      errorSRS: error,
      isLoadingHolidays: false 
    }));
    isLoadingRef.current = false;
  }, [setState]);

  /**
   * *** ИСПРАВЛЕНО: Упрощенная функция загрузки БЕЗ race conditions ***
   */
  const loadHolidays = useCallback(async (): Promise<void> => {
    console.log('[SRS useHolidays] *** SIMPLIFIED loadHolidays called (NO RACE CONDITIONS) ***:', {
      fromDate: fromDate.toLocaleDateString(),
      toDate: toDate.toLocaleDateString(),
      currentlyLoading: isLoadingRef.current,
      hasContext: !!context
    });
    
    if (!context) {
      console.log('[SRS useHolidays] Cannot load holidays: missing context');
      setIsLoadingHolidays(false);
      return;
    }

    // *** ИСПРАВЛЕНО: Простая проверка без сложной логики race conditions ***
    if (isLoadingRef.current) {
      console.log('[SRS useHolidays] Already loading, skipping duplicate request');
      return;
    }

    try {
      setIsLoadingHolidays(true);
      setError(undefined);

      console.log('[SRS useHolidays] Fetching holidays from service for date range (SIMPLIFIED)');
      
      const holidaysService = HolidaysService.getInstance(context);
      
      // Определяем все месяцы в диапазоне для загрузки
      const monthsToLoad = getMonthsInDateRange(fromDate, toDate);
      
      console.log('[SRS useHolidays] Loading holidays for months (SIMPLIFIED):', monthsToLoad);
      
      // *** ИСПРАВЛЕНО: Простая последовательная загрузка без Promise.all race conditions ***
      const allHolidays: IHoliday[] = [];
      
      for (const monthYear of monthsToLoad) {
        if (!mountedRef.current) {
          console.log('[SRS useHolidays] Component unmounted during loading, stopping');
          return;
        }

        try {
          console.log(`[SRS useHolidays] Loading holidays for ${monthYear.month}/${monthYear.year} (sequential)`);
          const monthDate = new Date(monthYear.year, monthYear.month - 1, 1);
          const monthHolidays = await holidaysService.getHolidaysByMonthAndYear(monthDate);
          
          // *** ИСПРАВЛЕНО: Простое добавление результатов ***
          allHolidays.push(...monthHolidays);
          
          console.log(`[SRS useHolidays] Loaded ${monthHolidays.length} holidays for ${monthYear.month}/${monthYear.year}`);
          
        } catch (monthError) {
          console.error(`[SRS useHolidays] Error loading holidays for ${monthYear.month}/${monthYear.year}:`, monthError);
          // Продолжаем загрузку других месяцев
        }
      }

      // *** ИСПРАВЛЕНО: Проверяем mounted состояние перед установкой результатов ***
      if (!mountedRef.current) {
        console.log('[SRS useHolidays] Component unmounted, not setting results');
        return;
      }

      // *** ИСПРАВЛЕНО: Упрощенная фильтрация для Date-only формата ***
      const filteredHolidays = allHolidays.filter(holiday => {
        // Простое сравнение без нормализации времени
        const holidayTime = holiday.date.getTime();
        const fromTime = fromDate.getTime();
        const toTime = toDate.getTime();
        
        return holidayTime >= fromTime && holidayTime <= toTime;
      });

      console.log('[SRS useHolidays] *** SIMPLIFIED: Holidays loaded and filtered (Date-only) ***:', {
        totalLoaded: allHolidays.length,
        filteredCount: filteredHolidays.length,
        dateRange: `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`,
        simplifiedLogic: true,
        noRaceConditions: true
      });

      // Логируем найденные праздники для отладки
      if (filteredHolidays.length > 0) {
        console.log('[SRS useHolidays] Found holidays in SRS date range (SIMPLIFIED Date-only):');
        filteredHolidays.forEach(holiday => {
          console.log(`  - ${holiday.title}: ${holiday.date.toLocaleDateString()}`);
        });
      } else {
        console.log('[SRS useHolidays] No holidays found in the specified SRS date range (SIMPLIFIED)');
      }

      // *** ИСПРАВЛЕНО: Простая установка результатов без дополнительных проверок ***
      setHolidays(filteredHolidays);

      console.log('[SRS useHolidays] *** HOLIDAYS LOADING COMPLETED SUCCESSFULLY (SIMPLIFIED) ***');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SRS useHolidays] Error loading holidays (SIMPLIFIED):', error);
      
      // *** ИСПРАВЛЕНО: НЕ очищаем holidays при ошибке, оставляем предыдущие ***
      setError(`Failed to load holidays: ${errorMessage}`);
      
    } finally {
      // *** ИСПРАВЛЕНО: Простое завершение загрузки ***
      if (mountedRef.current) {
        setIsLoadingHolidays(false);
      }
    }
  }, [context, fromDate, toDate, setHolidays, setIsLoadingHolidays, setError]);

  // *** ИСПРАВЛЕНО: Упрощенный эффект БЕЗ timeout и сложных зависимостей ***
  useEffect(() => {
    console.log('[SRS useHolidays] *** SIMPLIFIED useEffect triggered ***');
    console.log('[SRS useHolidays] Dependencies (SIMPLIFIED):', {
      hasContext: !!context,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      noTimeout: true,
      noRaceConditions: true
    });
    
    if (context) {
      console.log('[SRS useHolidays] Starting holidays load (SIMPLIFIED, NO TIMEOUT)');
      void loadHolidays();
    } else {
      console.log('[SRS useHolidays] Context not available (SIMPLIFIED), setting loading to false');
      setIsLoadingHolidays(false);
    }
  }, [context, fromDate.getTime(), toDate.getTime(), loadHolidays]);

  // *** ИСПРАВЛЕНО: Простой cleanup при размонтировании ***
  useEffect(() => {
    return () => {
      console.log('[SRS useHolidays] Component unmounting, setting mounted flag to false');
      mountedRef.current = false;
      isLoadingRef.current = false;
    };
  }, []);

  return {
    loadHolidays
  };
};

/**
 * *** ИСПРАВЛЕНО: Упрощенная функция получения месяцев в диапазоне дат ***
 */
function getMonthsInDateRange(fromDate: Date, toDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  
  // Нормализуем даты к первому дню месяца для корректного сравнения
  const startDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endDate = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  
  console.log('[getMonthsInDateRange] *** SIMPLIFIED: Calculating months for SRS range (Date-only) ***:', {
    originalFrom: fromDate.toISOString(),
    originalTo: toDate.toISOString(),
    normalizedStart: startDate.toISOString(),
    normalizedEnd: endDate.toISOString()
  });
  
  // *** ИСПРАВЛЕНО: Упрощенный цикл без сложной логики ***
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    const month = currentDate.getMonth() + 1; // API ожидает 1-12, а не 0-11
    const year = currentDate.getFullYear();
    
    months.push({ month, year });
    console.log(`[getMonthsInDateRange] Added month for SRS (SIMPLIFIED): ${month}/${year}`);
    
    // Переходим к следующему месяцу
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  console.log(`[getMonthsInDateRange] *** SIMPLIFIED: Total months to load for SRS: ${months.length} ***`);
  return months;
}

/**
 * *** УПРОЩЕНО: Проверка является ли дата праздником (без изменений) ***
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
 * *** УПРОЩЕНО: Получение информации о празднике (без изменений) ***
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
 * *** НОВАЯ ФУНКЦИЯ: Получение статистики праздников для SRS периода (без изменений) ***
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
 * *** УПРОЩЕНО: Проверка пересечения праздников с рабочими днями (без изменений) ***
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