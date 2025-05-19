// src/webparts/kpfaplus/utils/TimeCalculationUtils.ts

/**
 * Утилиты для расчета рабочего времени, обеденного перерыва и других временных операций.
 * Этот модуль предоставляет чистые функции, которые можно использовать как в сервисах,
 * так и в компонентах пользовательского интерфейса для обеспечения согласованных расчетов.
 */

/**
 * Интерфейс для результата расчета рабочего времени
 */
export interface IWorkTimeResult {
    /** Общее рабочее время в минутах */
    totalMinutes: number;
    /** Форматированное рабочее время в формате "часы.минуты" */
    formattedTime: string;
    /** Порядок сортировки для записи */
    sortOrder: number;
    /** Время обеда в минутах */
    lunchMinutes: number;
    /** Общее время смены без вычета обеда в минутах */
    shiftMinutes: number;
  }
  
  /**
   * Интерфейс для входных данных расчета рабочего времени
   */
  export interface IWorkTimeInput {
    /** Дата и время начала работы */
    startTime?: Date | undefined;
    /** Дата и время окончания работы */
    endTime?: Date | undefined;
    /** Дата и время начала обеда (опционально) */
    lunchStartTime?: Date | undefined;
    /** Дата и время окончания обеда (опционально) */
    lunchEndTime?: Date | undefined;
    /** Продолжительность обеда в минутах (альтернатива lunchStartTime/lunchEndTime) */
    lunchDurationMinutes?: number;
  }
  
  /**
   * Интерфейс для конвертации часов и минут в строковый формат
   */
  export interface ITimeComponents {
    hours: number;
    minutes: number;
  }
  
  /**
   * Расчет рабочего времени на основе времени начала, окончания и обеда
   * 
   * @param input Входные данные для расчета (время начала, окончания, обеда)
   * @returns Результат расчета рабочего времени
   */
  export function calculateWorkTime(input: IWorkTimeInput): IWorkTimeResult {
    // Устанавливаем значения по умолчанию
    const result: IWorkTimeResult = {
      totalMinutes: 0,
      formattedTime: "0.00",
      sortOrder: 1,
      lunchMinutes: 0,
      shiftMinutes: 0
    };
    
    // Если нет времени начала или окончания, возвращаем значения по умолчанию
    if (!input.startTime || !input.endTime) {
      return result;
    }
    
    // Получаем часы и минуты из дат
    const startHours = input.startTime.getHours();
    const startMinutes = input.startTime.getMinutes();
    const endHours = input.endTime.getHours();
    const endMinutes = input.endTime.getMinutes();
    
    // Расчет общего количества минут начала и окончания
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    // Проверяем, являются ли времена начала и окончания нулевыми (00:00)
    const isStartTimeZero = startHours === 0 && startMinutes === 0;
    const isEndTimeZero = endHours === 0 && endMinutes === 0;
    
    // Определяем SortOrder (порядок сортировки) для записи
    let sortOrder = 1; // По умолчанию
    
    if (isStartTimeZero && isEndTimeZero) {
      // Если оба времени нулевые, устанавливаем SortOrder в 1 (показываем в конце)
      sortOrder = 1;
    } else if (!isStartTimeZero) {
      // Если время начала не нулевое, устанавливаем SortOrder в 0 (показываем в начале)
      sortOrder = 0;
    } else if (!isEndTimeZero) {
      // Если время начала нулевое, но время окончания не нулевое, устанавливаем SortOrder в 0
      sortOrder = 0;
    }
    
    // Расчет рабочих минут с учетом перехода через полночь и специальных случаев
    let shiftMinutes = 0;
    
    // Проверяем на равенство времени начала и окончания
    if (startTotalMinutes === endTotalMinutes) {
      // Особый случай: время начала и окончания совпадают
      
      // Проверяем, не являются ли они оба нулевыми
      if (isStartTimeZero && isEndTimeZero) {
        // Оба времени 00:00 - считаем, что рабочий день не определен
        shiftMinutes = 0;
      } else {
        // Времена совпадают, но не равны 00:00 
        // Это может быть случай, когда пользователь случайно установил одинаковые значения
        // или есть какой-то специальный случай (например, работа ровно 24 часа)
        // По умолчанию считаем, что это ошибка ввода и устанавливаем 0
        shiftMinutes = 0;
      }
    } else if (endTotalMinutes < startTotalMinutes) {
      // Случай, когда время окончания меньше времени начала - смена переходит через полночь
      
      // Особый случай: если конец в 00:00, считаем это как конец дня (24:00)
      if (isEndTimeZero) {
        shiftMinutes = (24 * 60) - startTotalMinutes;
      } else {
        // Стандартный переход через полночь
        shiftMinutes = endTotalMinutes + (24 * 60) - startTotalMinutes;
      }
    } else {
      // Обычный случай, когда окончание позже начала в пределах одного дня
      shiftMinutes = endTotalMinutes - startTotalMinutes;
    }
    
    // Расчет времени обеда
    let lunchMinutes = 0;
    
    // Используем время обеда из входного параметра, если задано
    if (typeof input.lunchDurationMinutes === 'number' && input.lunchDurationMinutes > 0) {
      lunchMinutes = input.lunchDurationMinutes;
    } 
    // Иначе рассчитываем из времени начала и окончания обеда, если они заданы
    else if (input.lunchStartTime && input.lunchEndTime) {
      const lunchStartHours = input.lunchStartTime.getHours();
      const lunchStartMinutes = input.lunchStartTime.getMinutes();
      const lunchEndHours = input.lunchEndTime.getHours();
      const lunchEndMinutes = input.lunchEndTime.getMinutes();
      
      // Проверяем, не является ли время обеда нулевым (00:00)
      const isLunchStartZero = lunchStartHours === 0 && lunchStartMinutes === 0;
      const isLunchEndZero = lunchEndHours === 0 && lunchEndMinutes === 0;
      
      // Если оба времени не нулевые, рассчитываем длительность обеда
      if (!(isLunchStartZero && isLunchEndZero)) {
        const lunchStartTotalMinutes = lunchStartHours * 60 + lunchStartMinutes;
        const lunchEndTotalMinutes = lunchEndHours * 60 + lunchEndMinutes;
        
        // Рассчитываем длительность обеда с учетом возможного перехода через полночь
        if (lunchEndTotalMinutes < lunchStartTotalMinutes) {
          lunchMinutes = lunchEndTotalMinutes + (24 * 60) - lunchStartTotalMinutes;
        } else {
          lunchMinutes = lunchEndTotalMinutes - lunchStartTotalMinutes;
        }
      }
    }
    
    // Если рабочее время меньше времени обеда, то время обеда не может быть больше рабочего времени
    if (shiftMinutes > 0 && lunchMinutes > shiftMinutes) {
      lunchMinutes = shiftMinutes;
    }
    
    // Рассчитываем чистое рабочее время (общее время - обед)
    const totalMinutes = Math.max(0, shiftMinutes - lunchMinutes);
    
    // Форматируем результат в формате "часы.минуты"
    const formattedTime = formatMinutesToTime(totalMinutes);
    
    // Заполняем и возвращаем результат
    return {
      totalMinutes,
      formattedTime,
      sortOrder,
      lunchMinutes,
      shiftMinutes
    };
  }
  
  /**
   * Преобразует минуты в строку формата "часы.минуты"
   * 
   * @param totalMinutes Общее количество минут
   * @returns Строка в формате "часы.минуты"
   */
  export function formatMinutesToTime(totalMinutes: number): string {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}.${minutes.toString().padStart(2, '0')}`;
  }
  
  /**
   * Преобразует строку времени в формате "часы.минуты" в общее количество минут
   * 
   * @param timeString Строка времени в формате "часы.минуты"
   * @returns Общее количество минут
   */
  export function parseTimeToMinutes(timeString: string): number {
    try {
      const parts = timeString.split('.');
      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parts.length > 1 ? (parseInt(parts[1], 10) || 0) : 0;
      return hours * 60 + minutes;
    } catch (error) {
      console.error(`[TimeCalculationUtils] Error parsing time string "${timeString}":`, error);
      return 0;
    }
  }
  
  /**
   * Разбивает общее количество минут на часы и минуты
   * 
   * @param totalMinutes Общее количество минут
   * @returns Объект с часами и минутами
   */
  export function minutesToTimeComponents(totalMinutes: number): ITimeComponents {
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60
    };
  }
  
  /**
   * Преобразует часы и минуты в общее количество минут
   * 
   * @param hours Часы
   * @param minutes Минуты
   * @returns Общее количество минут
   */
  export function timeComponentsToMinutes(hours: number, minutes: number): number {
    return (hours * 60) + minutes;
  }
  
  /**
   * Создает объект Date на основе базовой даты и заданных часов и минут
   * 
   * @param baseDate Базовая дата
   * @param hours Часы
   * @param minutes Минуты
   * @returns Объект Date с заданными часами и минутами
   */
  export function createTimeFromComponents(baseDate: Date, hours: number, minutes: number): Date {
    const newDate = new Date(baseDate);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
  }
  
  /**
   * Форматирует часы и минуты в строку времени "HH:MM"
   * 
   * @param hours Часы
   * @param minutes Минуты
   * @returns Строка времени "HH:MM"
   */
  export function formatTimeString(hours: number, minutes: number): string {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }
  
  /**
   * Вычисляет общее рабочее время для массива записей
   * 
   * @param workTimes Массив строк рабочего времени в формате "часы.минуты"
   * @returns Общее количество минут
   */
  export function calculateTotalWorkTimeFromArray(workTimes: string[]): number {
    return workTimes.reduce((total, timeString) => {
      return total + parseTimeToMinutes(timeString);
    }, 0);
  }
  
  /**
   * Проверяет, является ли время начала и окончания работы одинаковым
   * 
   * @param startTime Время начала
   * @param endTime Время окончания
   * @returns true, если время начала и окончания совпадает
   */
  export function isStartEndTimeSame(startTime?: Date | undefined, endTime?: Date | undefined): boolean {
    if (!startTime || !endTime) {
      return false;
    }
    
    const startHours = startTime.getHours();
    const startMinutes = startTime.getMinutes();
    const endHours = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    
    return startHours === endHours && startMinutes === endMinutes;
  }
  
  /**
   * Проверяет, является ли указанное время нулевым (00:00)
   * 
   * @param time Время для проверки
   * @returns true, если время равно 00:00
   */
  export function isZeroTime(time?: Date | undefined): boolean {
    if (!time) {
      return false;
    }
    
    return time.getHours() === 0 && time.getMinutes() === 0;
  }