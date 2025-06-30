// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableUtils.ts
import { 
  createTimeFromComponents,
  isStartEndTimeSame,
  isZeroTime
} from '../../../../utils/TimeCalculationUtils';
import { IScheduleItem } from './ScheduleTable';

// Функция форматирования даты
export const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// *** ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ РАСЧЕТА РАБОЧЕГО ВРЕМЕНИ ***
export const calculateItemWorkTime = (item: IScheduleItem): string => {
  console.log(`[ScheduleTableUtils] *** CALCULATING WORK TIME FOR ITEM ${item.id} ***`);
  
  // Парсим часы и минуты из строк с валидацией
  const startHour = parseInt(item.startHour || '0', 10);
  const startMinute = parseInt(item.startMinute || '0', 10);
  const finishHour = parseInt(item.finishHour || '0', 10);
  const finishMinute = parseInt(item.finishMinute || '0', 10);
  const lunchMinutes = parseInt(item.lunchTime || '0', 10);

  console.log(`[ScheduleTableUtils] Input: ${startHour}:${startMinute} - ${finishHour}:${finishMinute}, lunch: ${lunchMinutes}min`);

  // Валидация входных данных
  if (isNaN(startHour) || isNaN(startMinute) || isNaN(finishHour) || isNaN(finishMinute)) {
    console.warn(`[ScheduleTableUtils] Invalid time values detected, returning 0.00`);
    return "0.00";
  }

  // Валидация диапазонов
  if (startHour < 0 || startHour > 23 || finishHour < 0 || finishHour > 23 ||
      startMinute < 0 || startMinute > 59 || finishMinute < 0 || finishMinute > 59) {
    console.warn(`[ScheduleTableUtils] Time values out of range, returning 0.00`);
    return "0.00";
  }

  // Создаем даты для расчета (используем одну и ту же базовую дату)
  const baseDate = new Date(2000, 0, 1); // Используем фиксированную дату для расчетов
  const startDate = createTimeFromComponents(baseDate, startHour, startMinute);
  const finishDate = createTimeFromComponents(baseDate, finishHour, finishMinute);

  console.log(`[ScheduleTableUtils] Created dates: start=${startDate.toISOString()}, finish=${finishDate.toISOString()}`);

  // Если начальное и конечное время совпадают, и они не 00:00
  if (isStartEndTimeSame(startDate, finishDate)) {
    if (isZeroTime(startDate) && isZeroTime(finishDate)) {
      console.log(`[ScheduleTableUtils] Both times are 00:00, returning 0.00`);
      return "0.00";
    } else {
      console.log(`[ScheduleTableUtils] Start and end times are the same (${startHour}:${startMinute}), returning 0.00`);
      return "0.00";
    }
  }

  // *** ИСПРАВЛЕННЫЙ РАСЧЕТ ВРЕМЕНИ ***
  // Переводим в минуты для точного расчета
  const startTotalMinutes = startHour * 60 + startMinute;
  const finishTotalMinutes = finishHour * 60 + finishMinute;
  
  console.log(`[ScheduleTableUtils] Total minutes: start=${startTotalMinutes}, finish=${finishTotalMinutes}`);

  // Рассчитываем разность в минутах
  let workMinutes = 0;
  
  if (finishTotalMinutes > startTotalMinutes) {
    // Обычный случай - работа в пределах одного дня
    workMinutes = finishTotalMinutes - startTotalMinutes;
  } else if (finishTotalMinutes < startTotalMinutes) {
    // Работа через полночь (например, 23:00 - 01:00)
    workMinutes = (24 * 60 - startTotalMinutes) + finishTotalMinutes;
    console.log(`[ScheduleTableUtils] Work spans midnight, calculated minutes: ${workMinutes}`);
  } else {
    // Времена равны - уже обработано выше
    workMinutes = 0;
  }

  // Вычитаем время обеда
  workMinutes = Math.max(0, workMinutes - lunchMinutes);
  
  console.log(`[ScheduleTableUtils] Work minutes after lunch deduction: ${workMinutes}`);

  // *** ПРАВИЛЬНОЕ ПРЕОБРАЗОВАНИЕ В ДЕСЯТИЧНЫЕ ЧАСЫ ***
  // Формула: часы + (минуты / 60)
  const workHours = Math.floor(workMinutes / 60);
  const remainingMinutes = workMinutes % 60;
  const decimalHours = workHours + (remainingMinutes / 60);
  
  console.log(`[ScheduleTableUtils] *** CONVERSION TO DECIMAL ***`);
  console.log(`[ScheduleTableUtils] Work minutes: ${workMinutes}`);
  console.log(`[ScheduleTableUtils] Work hours (floor): ${workHours}`);
  console.log(`[ScheduleTableUtils] Remaining minutes: ${remainingMinutes}`);
  console.log(`[ScheduleTableUtils] Decimal calculation: ${workHours} + (${remainingMinutes} / 60) = ${workHours} + ${remainingMinutes / 60} = ${decimalHours}`);

  // Форматируем результат с двумя знаками после запятой
  const result = decimalHours.toFixed(2);
  
  console.log(`[ScheduleTableUtils] *** FINAL RESULT: ${result} ***`);
  
  // *** ПРОВЕРКА КОРРЕКТНОСТИ ДЛЯ ПРИМЕРА ИЗ СКРИНШОТА ***
  if (startHour === 10 && startMinute === 0 && finishHour === 11 && finishMinute === 0) {
    console.log(`[ScheduleTableUtils] *** SPECIAL CHECK FOR 10:00-11:00 CASE ***`);
    console.log(`[ScheduleTableUtils] Should be 1.00 hour (60 minutes)`);
    console.log(`[ScheduleTableUtils] Our calculation: ${workMinutes} minutes = ${decimalHours} hours = ${result}`);
  }

  return result;
};

// Функция для проверки, совпадают ли время начала и окончания
export const checkStartEndTimeSame = (item: IScheduleItem): boolean => {
  // Парсим часы и минуты из строк
  const startHour = parseInt(item.startHour, 10) || 0;
  const startMinute = parseInt(item.startMinute, 10) || 0;
  const finishHour = parseInt(item.finishHour, 10) || 0;
  const finishMinute = parseInt(item.finishMinute, 10) || 0;

  // Создаем даты для сравнения
  const startDate = createTimeFromComponents(item.date, startHour, startMinute);
  const finishDate = createTimeFromComponents(item.date, finishHour, finishMinute);

  // Проверяем, совпадают ли даты и не равны ли они обе 00:00
  return isStartEndTimeSame(startDate, finishDate) && 
         !(isZeroTime(startDate) && isZeroTime(finishDate));
};