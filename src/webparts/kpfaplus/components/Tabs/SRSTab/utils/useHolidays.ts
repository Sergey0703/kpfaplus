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
 * *** ИСПРАВЛЕНО: Устранена проблема race condition и промежуточных состояний ***
 */
export const useHolidays = (props: UseHolidaysProps): UseHolidaysReturn => {
  const { context, fromDate, toDate, setState } = props;

  // *** ИСПРАВЛЕНИЕ 1: Ref для предотвращения race conditions ***
  const loadingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  console.log('[SRS useHolidays] Hook initialized with FIXED race condition handling (Date-only format):', {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    hasContext: !!context,
    raceConditionProtection: true
  });

  // *** ИСПРАВЛЕНИЕ 2: Стабильные helper функции без лишних зависимостей ***
  const setHolidays = useCallback((holidays: IHoliday[]) => {
    if (!loadingRef.current) {
      console.log('[SRS useHolidays] Skipping setHolidays - loading cancelled');
      return;
    }
    console.log('[SRS useHolidays] Setting holidays:', holidays.length);
    setState(prevState => ({ ...prevState, holidays }));
  }, [setState]);

  const setIsLoadingHolidays = useCallback((isLoading: boolean) => {
    console.log('[SRS useHolidays] Setting isLoadingHolidays:', isLoading);
    setState(prevState => ({ ...prevState, isLoadingHolidays: isLoading }));
    loadingRef.current = isLoading;
  }, [setState]);

  const setError = useCallback((error?: string) => {
    if (error) {
      console.error('[SRS useHolidays] Setting error:', error);
    }
    setState(prevState => ({ ...prevState, errorSRS: error }));
  }, [setState]);

  /**
   * *** ИСПРАВЛЕНО: Стабильная функция загрузки с защитой от race conditions ***
   */
  const loadHolidays = useCallback(async (): Promise<void> => {
    console.log('[SRS useHolidays] *** FIXED loadHolidays called for date range (Date-only) ***:', {
      fromDate: fromDate.toLocaleDateString(),
      toDate: toDate.toLocaleDateString(),
      currentlyLoading: loadingRef.current
    });
    
    // *** ИСПРАВЛЕНИЕ 3: Отменяем предыдущую загрузку если она еще идет ***
    if (abortControllerRef.current) {
      console.log('[SRS useHolidays] Aborting previous loading operation');
      abortControllerRef.current.abort();
    }

    if (!context) {
      console.log('[SRS useHolidays] Cannot load holidays: missing context');
      // *** ИСПРАВЛЕНИЕ: НЕ очищаем holidays если нет контекста ***
      setIsLoadingHolidays(false);
      return;
    }

    // *** ИСПРАВЛЕНИЕ 4: Проверяем, не идет ли уже загрузка ***
    if (loadingRef.current) {
      console.log('[SRS useHolidays] Loading already in progress, skipping');
      return;
    }

    // Создаем новый AbortController для этой операции
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setIsLoadingHolidays(true);
      setError(undefined);

      console.log('[SRS useHolidays] Fetching holidays from service for date range (FIXED)');
      
      const holidaysService = HolidaysService.getInstance(context);
      
      // Определяем все месяцы в диапазоне для загрузки
      const monthsToLoad = getMonthsInDateRange(fromDate, toDate);
      
      console.log('[SRS useHolidays] Loading holidays for months (FIXED):', monthsToLoad);
      
      // *** ИСПРАВЛЕНИЕ 5: Загружаем все месяцы параллельно вместо последовательно ***
      const loadPromises = monthsToLoad.map(async (monthYear) => {
        if (abortController.signal.aborted) {
          throw new Error('Operation aborted');
        }

        try {
          console.log(`[SRS useHolidays] Loading holidays for ${monthYear.month}/${monthYear.year} (parallel)`);
          const monthDate = new Date(monthYear.year, monthYear.month - 1, 1);
          return await holidaysService.getHolidaysByMonthAndYear(monthDate);
        } catch (monthError) {
          console.error(`[SRS useHolidays] Error loading holidays for ${monthYear.month}/${monthYear.year}:`, monthError);
          // Возвращаем пустой массив вместо выброса ошибки
          return [];
        }
      });

      // Ждем завершения всех загрузок
      const monthResults = await Promise.all(loadPromises);
      
      // Проверяем, не была ли операция отменена
      if (abortController.signal.aborted) {
        console.log('[SRS useHolidays] Operation was aborted, not updating state');
        return;
      }

      // *** ИСПРАВЛЕНИЕ: Объединяем все результаты (ES2017 совместимо) ***
      const allHolidays: IHoliday[] = monthResults.reduce((acc, monthHolidays) => acc.concat(monthHolidays), []);
      
      // *** ИСПРАВЛЕНИЕ 6: Упрощенная фильтрация для Date-only формата ***
      const filteredHolidays = allHolidays.filter(holiday => {
        // Простое сравнение без нормализации времени
        const holidayTime = holiday.date.getTime();
        const fromTime = fromDate.getTime();
        const toTime = toDate.getTime();
        
        return holidayTime >= fromTime && holidayTime <= toTime;
      });

      console.log('[SRS useHolidays] *** FIXED: Holidays loaded and filtered (Date-only) ***:', {
        totalLoaded: allHolidays.length,
        filteredCount: filteredHolidays.length,
        dateRange: `${fromDate.toLocaleDateString()} - ${toDate.toLocaleDateString()}`,
        raceConditionProtected: true
      });

      // Логируем найденные праздники для отладки
      if (filteredHolidays.length > 0) {
        console.log('[SRS useHolidays] Found holidays in SRS date range (FIXED Date-only):');
        filteredHolidays.forEach(holiday => {
          console.log(`  - ${holiday.title}: ${holiday.date.toLocaleDateString()}`);
        });
      } else {
        console.log('[SRS useHolidays] No holidays found in the specified SRS date range (FIXED)');
      }

      // *** ИСПРАВЛЕНИЕ 7: Устанавливаем holidays ТОЛЬКО если операция не была отменена ***
      if (!abortController.signal.aborted && loadingRef.current) {
        setHolidays(filteredHolidays);
      }

    } catch (error) {
      // Игнорируем ошибки отмены операции
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[SRS useHolidays] Loading was aborted');
        return;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SRS useHolidays] Error loading holidays (FIXED):', error);
      
      // *** ИСПРАВЛЕНИЕ: НЕ очищаем holidays при ошибке, оставляем предыдущие ***
      setError(`Failed to load holidays: ${errorMessage}`);
      
    } finally {
      // *** ИСПРАВЛЕНИЕ 8: Очищаем состояние загрузки только если это наша операция ***
      if (abortControllerRef.current === abortController) {
        setIsLoadingHolidays(false);
        abortControllerRef.current = null;
      }
    }
  }, [context, fromDate, toDate, setHolidays, setIsLoadingHolidays, setError]);

  // *** ИСПРАВЛЕНИЕ 9: Оптимизированный эффект с правильными зависимостями ***
  useEffect(() => {
    console.log('[SRS useHolidays] *** FIXED useEffect triggered for context/dates change ***');
    console.log('[SRS useHolidays] Dependencies (FIXED):', {
      hasContext: !!context,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      preventRaceConditions: true
    });
    
    if (context) {
      // *** ИСПРАВЛЕНИЕ: Добавляем небольшую задержку для избежания множественных вызовов ***
      const timeoutId = setTimeout(() => {
        void loadHolidays();
      }, 10);

      return () => {
        clearTimeout(timeoutId);
        // Отменяем загрузку при размонтировании или изменении зависимостей
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      };
    } else {
      console.log('[SRS useHolidays] Context not available (FIXED), not clearing holidays');
      setIsLoadingHolidays(false);
    }
  }, [context, fromDate.getTime(), toDate.getTime(), loadHolidays]);

  // *** ИСПРАВЛЕНИЕ 10: Cleanup при размонтировании ***
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      loadingRef.current = false;
    };
  }, []);

  return {
    loadHolidays
  };
};

/**
 * *** ИСПРАВЛЕНО: Функция получения месяцев в диапазоне дат ***
 * Устранена ошибка no-unmodified-loop-condition + оптимизация
 */
function getMonthsInDateRange(fromDate: Date, toDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  
  // Нормализуем даты к первому дню месяца для корректного сравнения
  const startDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endDate = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  
  console.log('[getMonthsInDateRange] *** FIXED: Calculating months for SRS range (Date-only) ***:', {
    originalFrom: fromDate.toISOString(),
    originalTo: toDate.toISOString(),
    normalizedStart: startDate.toISOString(),
    normalizedEnd: endDate.toISOString()
  });
  
  // *** ИСПРАВЛЕНИЕ: Используем отдельную переменную currentDate для итерации ***
  const currentDate = new Date(startDate);
  
  // *** ИСПРАВЛЕНИЕ: Цикл с правильным условием выхода ***
  while (currentDate <= endDate) {
    const month = currentDate.getMonth() + 1; // API ожидает 1-12, а не 0-11
    const year = currentDate.getFullYear();
    
    months.push({ month, year });
    console.log(`[getMonthsInDateRange] Added month for SRS (FIXED): ${month}/${year}`);
    
    // *** ИСПРАВЛЕНИЕ: Переходим к следующему месяцу правильно ***
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  console.log(`[getMonthsInDateRange] *** FIXED: Total months to load for SRS: ${months.length} ***`);
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