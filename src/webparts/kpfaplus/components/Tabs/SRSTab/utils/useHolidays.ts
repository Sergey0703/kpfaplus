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
 */
export const useHolidays = (props: UseHolidaysProps): UseHolidaysReturn => {
  const { context, fromDate, toDate, setState } = props;

  console.log('[SRS useHolidays] Hook initialized with date range:', {
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    hasContext: !!context
  });

  // Helper функции для обновления состояния
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
      
      // *** ОТЛИЧИЕ: Загружаем праздники для диапазона дат, а не для месяца ***
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
      
      // *** ФИЛЬТРАЦИЯ: Оставляем только праздники в точном диапазоне дат ***
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
 */
function getMonthsInDateRange(fromDate: Date, toDate: Date): Array<{ month: number; year: number }> {
  const months: Array<{ month: number; year: number }> = [];
  
  // Нормализуем даты к первому дню месяца для корректного сравнения
  const startDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
  const endDate = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
  
  console.log('[getMonthsInDateRange] Calculating months for range:', {
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
    console.log(`[getMonthsInDateRange] Added month: ${month}/${year}`);
    
    // Переходим к следующему месяцу
    currentDate.setMonth(currentDate.getMonth() + 1);
  }
  
  console.log(`[getMonthsInDateRange] Total months to load: ${months.length}`);
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