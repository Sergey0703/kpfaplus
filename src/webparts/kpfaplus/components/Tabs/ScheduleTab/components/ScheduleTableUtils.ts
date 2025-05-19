// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableUtils.ts
import { 
  calculateWorkTime, 
  IWorkTimeInput, 
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

// Функция для расчета рабочего времени
export const calculateItemWorkTime = (item: IScheduleItem): string => {
  // Парсим часы и минуты из строк
  const startHour = parseInt(item.startHour, 10) || 0;
  const startMinute = parseInt(item.startMinute, 10) || 0;
  const finishHour = parseInt(item.finishHour, 10) || 0;
  const finishMinute = parseInt(item.finishMinute, 10) || 0;
  const lunchMinutes = parseInt(item.lunchTime, 10) || 0;

  // Создаем даты для расчета
  const startDate = createTimeFromComponents(item.date, startHour, startMinute);
  const finishDate = createTimeFromComponents(item.date, finishHour, finishMinute);

  // Если начальное и конечное время совпадают, и они не 00:00
  if (isStartEndTimeSame(startDate, finishDate) && 
      (!isZeroTime(startDate) || !isZeroTime(finishDate))) {
    console.log(`[ScheduleTable] Start and end times are the same for item ${item.id}. Returning 0.00`);
    return "0.00";
  }

  // Подготавливаем входные данные для расчета
  const input: IWorkTimeInput = {
    startTime: startDate,
    endTime: finishDate,
    lunchDurationMinutes: lunchMinutes
  };

  // Используем утилиту для расчета рабочего времени
  const result = calculateWorkTime(input);
  return result.formattedTime;
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