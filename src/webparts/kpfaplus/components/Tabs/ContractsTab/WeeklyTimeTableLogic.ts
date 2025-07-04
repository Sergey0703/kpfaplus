// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableLogic.ts
import { 
    IFormattedWeeklyTimeRow
  } from '../../../models/IWeeklyTimeTable';
import { IDayHoursComplete } from '../../../models/IWeeklyTimeTable';
// ЗАКОММЕНТИРОВАНО: import { DateUtils } from '../../CustomDatePicker/CustomDatePicker';

// Интерфейс для расширенной строки с дополнительным полем displayedTotalHours
export interface IExtendedWeeklyTimeRow extends IFormattedWeeklyTimeRow {
  displayedTotalHours?: string;
  NumberOfShift?: number;
  [key: string]: string | IDayHoursComplete | number | undefined;
}

// СТАРЫЕ ФУНКЦИИ РАБОТЫ С ДАТАМИ - ЗАКОММЕНТИРОВАНЫ (больше не нужны с числовыми полями)
/*
// Получение начала недели для заданной даты
export const getStartOfWeek = (date: Date, startOfWeek: number = 1): Date => {
  const normalizedDate = DateUtils.normalizeDateToUTCMidnight(date);
  const dayOfWeek = normalizedDate.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Вычисляем смещение от начала недели
  let daysToSubtract = dayOfWeek - (startOfWeek - 1);
  if (daysToSubtract < 0) {
    daysToSubtract += 7;
  }
  
  // Создаем дату начала недели
  const startDate = new Date(normalizedDate);
  startDate.setUTCDate(startDate.getUTCDate() - daysToSubtract);
  
  return DateUtils.normalizeDateToUTCMidnight(startDate);
};

// Получение конца недели для заданной даты
export const getEndOfWeek = (date: Date, startOfWeek: number = 1): Date => {
  const startDate = getStartOfWeek(date, startOfWeek);
  const endDate = new Date(startDate);
  endDate.setUTCDate(endDate.getUTCDate() + 6);
  endDate.setUTCHours(23, 59, 59, 999);
  
  return endDate;
};

// ФУНКЦИЯ: Нормализация временных данных в строках недельного расписания
export const normalizeWeeklyTimeRowDates = (row: IExtendedWeeklyTimeRow): IExtendedWeeklyTimeRow => {
  const normalizedRow = { ...row };
  
  // Проверяем специфичные поля, которые могут содержать даты
  // В IExtendedWeeklyTimeRow обычно даты могут быть в метаданных
  if ((row as Record<string, unknown>).createdDate && (row as Record<string, unknown>).createdDate instanceof Date) {
    const originalDate = (row as Record<string, unknown>).createdDate as Date;
    const normalizedDate = DateUtils.normalizeDateToUTCMidnight(originalDate);
    (normalizedRow as Record<string, unknown>).createdDate = normalizedDate;
    
    console.log(`[WeeklyTimeTableLogic] Normalized createdDate: ${originalDate.toISOString()} → ${normalizedDate.toISOString()}`);
  }
  
  if ((row as Record<string, unknown>).modifiedDate && (row as Record<string, unknown>).modifiedDate instanceof Date) {
    const originalDate = (row as Record<string, unknown>).modifiedDate as Date;
    const normalizedDate = DateUtils.normalizeDateToUTCMidnight(originalDate);
    (normalizedRow as Record<string, unknown>).modifiedDate = normalizedDate;
    
    console.log(`[WeeklyTimeTableLogic] Normalized modifiedDate: ${originalDate.toISOString()} → ${normalizedDate.toISOString()}`);
  }
  
  // Проверяем дополнительные поля через безопасное приведение типов
  const additionalFields = ['startDate', 'endDate'];
  additionalFields.forEach(field => {
    const fieldValue = (normalizedRow as Record<string, unknown>)[field];
    if (fieldValue && fieldValue instanceof Date) {
      const originalDate = fieldValue as Date;
      const normalizedDate = DateUtils.normalizeDateToUTCMidnight(originalDate);
      (normalizedRow as Record<string, unknown>)[field] = normalizedDate;
      
      console.log(`[WeeklyTimeTableLogic] Normalized ${field}: ${originalDate.toISOString()} → ${normalizedDate.toISOString()}`);
    }
  });
  
  return normalizedRow;
};

// ФУНКЦИЯ: Создание временной метки для недельного расписания
export const createWeeklyTimeStamp = (baseDate: Date, timeHours: string, timeMinutes: string): Date => {
  const hours = parseInt(timeHours, 10);
  const minutes = parseInt(timeMinutes, 10);
  
  if (isNaN(hours) || isNaN(minutes)) {
    console.warn(`[WeeklyTimeTableLogic] Invalid time components: ${timeHours}:${timeMinutes}`);
    return DateUtils.normalizeDateToUTCMidnight(baseDate);
  }
  
  // Используем DateUtils для создания времени смены
  return DateUtils.createShiftDateTime(baseDate, hours, minutes);
};

// ФУНКЦИЯ: Парсинг времени из строки в формате HH:MM
export const parseTimeString = (timeString: string): { hours: string, minutes: string } | undefined => {
  if (!timeString) {
    return undefined;
  }
  
  // Пытаемся распарсить время в различных форматах
  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = timeString.match(timeRegex);
  
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    
    // Валидация времени
    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);
    
    if (hoursNum >= 0 && hoursNum <= 23 && minutesNum >= 0 && minutesNum <= 59) {
      return { hours, minutes };
    }
  }
  
  console.warn(`[WeeklyTimeTableLogic] Invalid time format: ${timeString}`);
  return undefined;
};

// ФУНКЦИЯ: Форматирование времени для отображения
export const formatTimeForDisplay = (hours: string | number, minutes: string | number): string => {
  const h = typeof hours === 'string' ? hours : hours.toString().padStart(2, '0');
  const m = typeof minutes === 'string' ? minutes : minutes.toString().padStart(2, '0');
  
  return `${h}:${m}`;
};

// ФУНКЦИЯ: Получение текущей даты для недельного расписания
export const getCurrentWeekDate = (): Date => {
  const today = new Date();
  return DateUtils.normalizeDateToUTCMidnight(today);
};

// ФУНКЦИЯ: Проверка, является ли дата в пределах текущей недели
export const isDateInCurrentWeek = (date: Date, startOfWeek: number = 1): boolean => {
  const currentDate = getCurrentWeekDate();
  const inputDate = DateUtils.normalizeDateToUTCMidnight(date);
  
  // Получаем начало недели для обеих дат
  const currentWeekStart = getStartOfWeek(currentDate, startOfWeek);
  const inputWeekStart = getStartOfWeek(inputDate, startOfWeek);
  
  // Сравниваем, в одной ли неделе находятся даты
  return DateUtils.isSameDay(currentWeekStart, inputWeekStart);
};

// ФУНКЦИЯ: Валидация времени смены с использованием DateUtils  
export const validateShiftTime = (
  startHours: string, 
  startMinutes: string, 
  endHours: string, 
  endMinutes: string
): { isValid: boolean; message?: string } => {
  
  const parsedStart = parseTimeString(`${startHours}:${startMinutes}`);
  const parsedEnd = parseTimeString(`${endHours}:${endMinutes}`);
  
  if (!parsedStart || !parsedEnd) {
    return { isValid: false, message: 'Invalid time format' };
  }
  
  // Создаем базовую дату для сравнения времени
  const baseDate = new Date('2025-01-01');
  const startDateTime = createWeeklyTimeStamp(baseDate, parsedStart.hours, parsedStart.minutes);
  const endDateTime = createWeeklyTimeStamp(baseDate, parsedEnd.hours, parsedEnd.minutes);
  
  if (endDateTime <= startDateTime) {
    return { isValid: false, message: 'End time must be after start time' };
  }
  
  // Проверяем, что смена не длится более 24 часов
  const diffInHours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
  if (diffInHours > 24) {
    return { isValid: false, message: 'Shift cannot be longer than 24 hours' };
  }
  
  return { isValid: true };
};

// ФУНКЦИЯ: Получение метаданных для отладки времени
export const getTimeDebugInfo = (date: Date): Record<string, unknown> => {
  return {
    original: date.toISOString(),
    normalized: DateUtils.normalizeDateToUTCMidnight(date).toISOString(),
    utcDay: date.getUTCDay(),
    utcDate: date.getUTCDate(),
    utcMonth: date.getUTCMonth() + 1,
    utcYear: date.getUTCFullYear(),
    utcHours: date.getUTCHours(),
    utcMinutes: date.getUTCMinutes(),
    localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
  };
};

// УСТАРЕВШАЯ ФУНКЦИЯ - ЗАКОММЕНТИРОВАНА (не должна использоваться)
// Вспомогательная функция для извлечения номера недели из названия строки
// function extractWeekNumber(name: string): number {
//   const match = name?.match(/Week\s+(\d+)/i);
//   return match ? parseInt(match[1], 10) : 1;
// }
*/

// НОВЫЕ ФУНКЦИИ для работы с числовыми полями времени (заменяют старые функции работы с датами)

/**
 * Парсинг времени из строки в формате HH:MM для числовых полей
 * @param timeString Строка времени в формате "HH:MM"
 * @returns Объект с часами и минутами или undefined
 */
export const parseNumericTimeString = (timeString: string): { hours: string, minutes: string } | undefined => {
  if (!timeString) {
    return undefined;
  }
  
  // Пытаемся распарсить время в различных форматах
  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = timeString.match(timeRegex);
  
  if (match) {
    const hours = match[1].padStart(2, '0');
    const minutes = match[2];
    
    // Валидация времени
    const hoursNum = parseInt(hours, 10);
    const minutesNum = parseInt(minutes, 10);
    
    if (hoursNum >= 0 && hoursNum <= 23 && minutesNum >= 0 && minutesNum <= 59) {
      return { hours, minutes };
    }
  }
  
  console.warn(`[WeeklyTimeTableLogic] Invalid time format: ${timeString}`);
  return undefined;
};

/**
 * Форматирование времени для отображения (числовые поля)
 * @param hours Часы (строка или число)
 * @param minutes Минуты (строка или число)
 * @returns Отформатированная строка времени
 */
export const formatNumericTimeForDisplay = (hours: string | number, minutes: string | number): string => {
  const h = typeof hours === 'string' ? hours : hours.toString().padStart(2, '0');
  const m = typeof minutes === 'string' ? minutes : minutes.toString().padStart(2, '0');
  
  return `${h}:${m}`;
};

/**
 * Валидация времени смены с использованием числовых полей
 * @param startHours Часы начала смены
 * @param startMinutes Минуты начала смены
 * @param endHours Часы окончания смены
 * @param endMinutes Минуты окончания смены
 * @returns Результат валидации
 */
export const validateNumericShiftTime = (
  startHours: string | number, 
  startMinutes: string | number, 
  endHours: string | number, 
  endMinutes: string | number
): { isValid: boolean; message?: string } => {
  
  // Преобразуем в числа
  const startH = typeof startHours === 'number' ? startHours : parseInt(startHours.toString(), 10);
  const startM = typeof startMinutes === 'number' ? startMinutes : parseInt(startMinutes.toString(), 10);
  const endH = typeof endHours === 'number' ? endHours : parseInt(endHours.toString(), 10);
  const endM = typeof endMinutes === 'number' ? endMinutes : parseInt(endMinutes.toString(), 10);
  
  // Валидация значений
  if (isNaN(startH) || startH < 0 || startH > 23) {
    return { isValid: false, message: 'Invalid start hours' };
  }
  if (isNaN(startM) || startM < 0 || startM > 59) {
    return { isValid: false, message: 'Invalid start minutes' };
  }
  if (isNaN(endH) || endH < 0 || endH > 23) {
    return { isValid: false, message: 'Invalid end hours' };
  }
  if (isNaN(endM) || endM < 0 || endM > 59) {
    return { isValid: false, message: 'Invalid end minutes' };
  }
  
  // Преобразуем в минуты для сравнения
  const startTotalMinutes = startH * 60 + startM;
  const endTotalMinutes = endH * 60 + endM;
  
  if (endTotalMinutes <= startTotalMinutes) {
    // Проверяем случай перехода через полночь
    const nextDayEndMinutes = endTotalMinutes + 24 * 60;
    const diffInHours = (nextDayEndMinutes - startTotalMinutes) / 60;
    
    if (diffInHours > 24) {
      return { isValid: false, message: 'Shift cannot be longer than 24 hours' };
    }
    
    // Если смена переходит через полночь, это допустимо
    return { isValid: true };
  }
  
  // Проверяем, что смена не длится более 24 часов
  const diffInHours = (endTotalMinutes - startTotalMinutes) / 60;
  if (diffInHours > 24) {
    return { isValid: false, message: 'Shift cannot be longer than 24 hours' };
  }
  
  return { isValid: true };
};

// АКТИВНЫЕ ФУНКЦИИ (логика работы с таблицей) - ИСПРАВЛЕНО для использования только NumberOfWeek и NumberOfShift

/**
 * ИСПРАВЛЕНО: Определяет, можно ли удалить строку таблицы
 * Использует ТОЛЬКО поля NumberOfWeek и NumberOfShift
 * @param data Данные таблицы
 * @param rowIndex Индекс проверяемой строки
 * @returns true, если строку можно удалить, иначе false
 */
export const canDeleteRow = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
  if (!data || rowIndex < 0 || rowIndex >= data.length) {
    return false;
  }
  
  const currentRow = data[rowIndex];
  
  // Если строка уже удалена, то её нельзя удалить повторно
  if (currentRow.deleted === 1 || currentRow.Deleted === 1) {
    return false;
  }
  
  // ИСПРАВЛЕНО: Получаем номер недели ТОЛЬКО из поля NumberOfWeek
  const currentWeekNumber = currentRow.NumberOfWeek;
  
  if (currentWeekNumber === undefined) {
    console.error(`[canDeleteRow] Row ${rowIndex} (ID: ${currentRow.id}) missing NumberOfWeek field`);
    return false;
  }
  
  // Проверяем, есть ли неудаленные строки с большим номером недели
  const hasNextWeek = data.some(row => {
    // Учитываем только неудаленные строки
    const isRowDeleted = row.deleted === 1 || row.Deleted === 1;
    if (isRowDeleted) return false;
    
    const weekNumber = row.NumberOfWeek;
    if (weekNumber === undefined) return false;
    
    return weekNumber > currentWeekNumber;
  });
  
  // Фильтруем только неудаленные строки в текущей неделе
  const activeRowsInWeek = data.filter(row => {
    const isRowDeleted = row.deleted === 1 || row.Deleted === 1;
    if (isRowDeleted) return false;
    
    const weekNumber = row.NumberOfWeek;
    return weekNumber === currentWeekNumber;
  });
  
  // Определяем индекс текущей строки среди активных в этой неделе
  const indexInActiveRows = activeRowsInWeek.findIndex(row => row.id === currentRow.id);
  const isLastInActiveRows = indexInActiveRows === activeRowsInWeek.length - 1;
  
  // Если строка не последняя среди активных, удалять нельзя
  if (!isLastInActiveRows) {
    return false;
  }
  
  // Если это последняя неделя, то всегда можно удалить последнюю строку недели
  if (!hasNextWeek) {
    return true;
  }
  
  // Если в неделе больше одной активной смены, можно удалить последнюю смену
  return activeRowsInWeek.length > 1;
};

/**
 * Результат анализа недель в таблице
 */
export interface IWeekAnalysisResult {
  /** Все найденные номера недель */
  weekNumbers: number[];
  /** Максимальный номер недели */
  maxWeekNumber: number;
  /** Номера полностью удаленных недель */
  fullyDeletedWeeks: number[];
  /** Флаг наличия полностью удаленных недель */
  hasFullyDeletedWeeks: boolean;
}

/**
 * ИСПРАВЛЕНО: Анализирует данные таблицы для определения состояния недель
 * Использует ТОЛЬКО поля NumberOfWeek и NumberOfShift
 * @param data Данные таблицы недельного расписания
 * @returns Результат анализа недель
 */
export const analyzeWeeklyTableData = (data: IExtendedWeeklyTimeRow[]): IWeekAnalysisResult => {
  // Если нет данных, возвращаем пустой результат
  if (!data || data.length === 0) {
    return {
      weekNumbers: [],
      maxWeekNumber: 0,
      fullyDeletedWeeks: [],
      hasFullyDeletedWeeks: false
    };
  }

  // Собираем все номера недель
  const weekNumbers: number[] = [];
  
  // Объект для группировки смен по неделям
  const weekShifts: Record<number, { total: number, deleted: number }> = {};
  
  // Анализируем данные
  for (const row of data) {
    // ИСПРАВЛЕНО: Получаем номер недели ТОЛЬКО из поля NumberOfWeek
    const weekNumber = row.NumberOfWeek;
    
    if (weekNumber === undefined) {
      console.warn(`[analyzeWeeklyTableData] Row ${row.id} missing NumberOfWeek field, skipping`);
      continue;
    }
    
    // Если номер недели определен и больше 0
    if (weekNumber > 0) {
      // Добавляем в список номеров недель, если его там еще нет
      if (!weekNumbers.includes(weekNumber)) {
        weekNumbers.push(weekNumber);
      }
      
      // Инициализируем счетчики для недели, если они еще не созданы
      if (!weekShifts[weekNumber]) {
        weekShifts[weekNumber] = { total: 0, deleted: 0 };
      }
      
      // Увеличиваем общее количество смен для этой недели
      weekShifts[weekNumber].total++;
      
      // Если смена удалена, увеличиваем счетчик удаленных смен
      const isDeleted = row.deleted === 1 || row.Deleted === 1;
      if (isDeleted) {
        weekShifts[weekNumber].deleted++;
      }
    }
  }
  
  // Сортируем номера недель
  weekNumbers.sort((a, b) => a - b);
  
  // Находим максимальный номер недели
  const maxWeekNumber = weekNumbers.length > 0 ? Math.max(...weekNumbers) : 0;
  
  // Определяем полностью удаленные недели
  const fullyDeletedWeeks: number[] = [];
  
  for (const weekNumber in weekShifts) {
    if (Object.prototype.hasOwnProperty.call(weekShifts, weekNumber)) {
      const stats = weekShifts[weekNumber];
      
      // Если все смены недели удалены, добавляем неделю в список полностью удаленных
      if (stats.total > 0 && stats.total === stats.deleted) {
        fullyDeletedWeeks.push(parseInt(weekNumber, 10));
      }
    }
  }
  
  // Возвращаем результат анализа
  return {
    weekNumbers,
    maxWeekNumber,
    fullyDeletedWeeks,
    hasFullyDeletedWeeks: fullyDeletedWeeks.length > 0
  };
};

/**
 * Результат проверки возможности добавления новой недели
 */
export interface IAddWeekCheckResult {
  /** Возможно ли добавление новой недели */
  canAdd: boolean;
  /** Номер недели для добавления (если canAdd = true) */
  weekNumberToAdd: number;
  /** Сообщение для пользователя */
  message: string;
  /** Номера полностью удаленных недель */
  fullyDeletedWeeks: number[];
}

/**
 * Проверяет возможность добавления новой недели на основе результатов анализа
 * @param analysisResult Результат анализа недель в таблице
 * @returns Результат проверки возможности добавления
 */
export const checkCanAddNewWeek = (analysisResult: IWeekAnalysisResult): IAddWeekCheckResult => {
  // Если нет данных о неделях, значит можно добавить первую неделю
  if (analysisResult.weekNumbers.length === 0) {
    return {
      canAdd: true,
      weekNumberToAdd: 1,
      message: "The first week (1 week) will be added.",
      fullyDeletedWeeks: []
    };
  }
  
  // Проверяем наличие полностью удаленных недель
  if (analysisResult.hasFullyDeletedWeeks) {
    // Сортируем удаленные недели для удобства
    const sortedDeletedWeeks = [...analysisResult.fullyDeletedWeeks].sort((a, b) => a - b);
    
    // Формируем сообщение для пользователя
    let message = `Fully deleted weeks detected: ${sortedDeletedWeeks.join(', ')}. `;
    message += `Before adding a new week, you need to restore the deleted weeks.`;
    
    return {
      canAdd: false,
      weekNumberToAdd: 0,
      message,
      fullyDeletedWeeks: sortedDeletedWeeks
    };
  }
  
  // Если все существующие недели активны (или частично активны),
  // можно добавить следующую неделю
  const nextWeekNumber = analysisResult.maxWeekNumber + 1;
  
  return {
    canAdd: true,
    weekNumberToAdd: nextWeekNumber,
    message: `New week ${nextWeekNumber} has been added.`,
    fullyDeletedWeeks: []
  };
};

/**
 * Комплексная проверка возможности добавления новой недели
 * @param data Данные таблицы недельного расписания
 * @returns Результат проверки возможности добавления
 */
export const checkCanAddNewWeekFromData = (data: IExtendedWeeklyTimeRow[]): IAddWeekCheckResult => {
  // Анализируем данные
  const analysisResult = analyzeWeeklyTableData(data);
  
  // Проверяем возможность добавления
  return checkCanAddNewWeek(analysisResult);
};

/**
 * ИСПРАВЛЕНО: Проверяет, можно ли восстановить удаленную строку
 * Использует ТОЛЬКО поля NumberOfWeek и NumberOfShift
 * @param data Данные таблицы
 * @param rowIndex Индекс проверяемой строки
 * @returns true, если строку можно восстановить, иначе false
 */
export const canRestoreRow = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
  if (!data || rowIndex < 0 || rowIndex >= data.length) {
    console.log(`canRestoreRow: Invalid input, data.length=${data?.length}, rowIndex=${rowIndex}`);
    return false;
  }
  
  const currentRow = data[rowIndex];
  console.log(`canRestoreRow: Checking row ${rowIndex}, ID=${currentRow.id}, deleted=${currentRow.deleted}, Deleted=${currentRow.Deleted}`);
  
  // Проверяем, удалена ли строка
  const isDeleted = currentRow.deleted === 1 || currentRow.Deleted === 1;
  if (!isDeleted) {
    console.log(`canRestoreRow: Row ${rowIndex} is not deleted`);
    // Если строка не удалена, то её нельзя восстанавливать
    return false;
  }
  
  // ИСПРАВЛЕНО: Получаем номер недели и смены ТОЛЬКО из полей NumberOfWeek и NumberOfShift
  const currentWeekNumber = currentRow.NumberOfWeek;
  const currentShiftNumber = currentRow.NumberOfShift;
  
  if (currentWeekNumber === undefined) {
    console.error(`[canRestoreRow] Row ${rowIndex} (ID: ${currentRow.id}) missing NumberOfWeek field`);
    return false;
  }
  
  if (currentShiftNumber === undefined) {
    console.error(`[canRestoreRow] Row ${rowIndex} (ID: ${currentRow.id}) missing NumberOfShift field`);
    return false;
  }
  
  console.log(`canRestoreRow: Row ${rowIndex} is in week ${currentWeekNumber}, shift ${currentShiftNumber}`);
  
  // Найдем все удаленные строки в той же неделе
  const deletedRowsInSameWeek = data.filter(row => {
    const rowWeekNumber = row.NumberOfWeek;
    const isRowDeleted = row.deleted === 1 || row.Deleted === 1;
    
    return rowWeekNumber === currentWeekNumber && isRowDeleted;
  });
  
  console.log(`canRestoreRow: Found ${deletedRowsInSameWeek.length} deleted rows in week ${currentWeekNumber}`);
  
  // Если удаленных строк в этой неделе нет, то что-то пошло не так
  if (deletedRowsInSameWeek.length === 0) {
    console.error(`No deleted rows found in week ${currentWeekNumber} but row ${rowIndex} is marked as deleted`);
    return false;
  }
  
  // Логируем найденные удаленные строки для отладки
  deletedRowsInSameWeek.forEach((row, idx) => {
    console.log(`canRestoreRow: Deleted row ${idx} in week ${currentWeekNumber}: ID=${row.id}, shift=${row.NumberOfShift}`);
  });
  
  // ИСПРАВЛЕНО: Найдем строку с минимальным номером смены среди удаленных (использует только NumberOfShift)
  const minShiftNumber = Math.min(...deletedRowsInSameWeek.map(row => row.NumberOfShift || 1));
  
  console.log(`canRestoreRow: Min shift number among deleted rows: ${minShiftNumber}`);
  console.log(`canRestoreRow: Current row shift number: ${currentShiftNumber}`);
  console.log(`canRestoreRow: Can restore row ${rowIndex}? ${currentShiftNumber === minShiftNumber}`);
  
  // Строку можно восстановить, если её номер смены минимален среди всех удаленных в этой неделе
  return currentShiftNumber === minShiftNumber;
};

// Функция для получения множества уникальных шаблонов в данных
export const getUniqueTemplates = (data: IExtendedWeeklyTimeRow[]): { templateId: string, rows: IExtendedWeeklyTimeRow[] }[] => {
  if (!data || data.length === 0) {
    return [];
  }

  // ИСПРАВЛЕНО: Группируем строки по шаблону используя NumberOfWeek вместо извлечения из имени
  const templateMap = new Map<string, IExtendedWeeklyTimeRow[]>();
  
  data.forEach(row => {
    // ИСПРАВЛЕНО: Используем NumberOfWeek вместо извлечения из имени
    const weekNumber = row.NumberOfWeek;
    
    if (weekNumber !== undefined) {
      const templateKey = `template_${weekNumber}`;
      
      if (!templateMap.has(templateKey)) {
        templateMap.set(templateKey, []);
      }
      templateMap.get(templateKey)?.push(row);
    } else {
      console.warn(`[getUniqueTemplates] Row ${row.id} missing NumberOfWeek field, using ID as fallback`);
      // Если формат данных некорректный, используем ID как ключ
      const templateKey = `template_${row.id}`;
      templateMap.set(templateKey, [row]);
    }
  });
  
  // Преобразуем Map в массив объектов для удобства использования
  const templates: { templateId: string, rows: IExtendedWeeklyTimeRow[] }[] = [];
  templateMap.forEach((rows, templateId) => {
    // ИСПРАВЛЕНО: Сортируем строки в каждом шаблоне по NumberOfWeek и NumberOfShift
    rows.sort((a, b) => {
      // Сначала по NumberOfWeek
      const weekA = a.NumberOfWeek || 0;
      const weekB = b.NumberOfWeek || 0;
      
      if (weekA !== weekB) {
        return weekA - weekB;
      }
      
      // Затем по NumberOfShift
      const shiftA = a.NumberOfShift || 0;
      const shiftB = b.NumberOfShift || 0;
      
      return shiftA - shiftB;
    });
    
    templates.push({ templateId, rows });
  });
  
  return templates;
};

/**
 * ИСПРАВЛЕННАЯ функция для расчета общего количества часов для шаблона с правильным форматированием
 * @param rows Строки шаблона
 * @returns Строка с общим временем в формате "XXh:YYm" (английская локализация)
 */
export const calculateTotalHoursForTemplate = (rows: IExtendedWeeklyTimeRow[]): string => {
  if (!rows || rows.length === 0) {
    return '0h:00m'; // ИСПРАВЛЕНО: английская локализация
  }
  
  // Конвертируем строки времени в минуты для суммирования
  let totalMinutes = 0;
  
  rows.forEach(row => {
    // Проверяем, не удалена ли строка
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // Если строка удалена, не учитываем её время
    if (!isDeleted && row.totalHours) {
      // ИСПРАВЛЕНО: Поддержка как русской, так и английской локализации
      // Извлекаем часы и минуты из строки формата "XXч:YYм" или "XXh:YYm"
      const hoursMatch = row.totalHours.match(/(\d+)[чh]/);
      const minutesMatch = row.totalHours.match(/:(\d+)[мm]/);
      
      const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
      const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
      
      // Суммируем в минутах
      totalMinutes += (hours * 60) + minutes;
      
      // Логируем для отладки
      console.log(`[calculateTotalHoursForTemplate] Including time from row ID=${row.id}, time=${row.totalHours}, in minutes=${(hours * 60) + minutes}`);
    } else {
      // Логируем исключенные строки для отладки
      const reason = isDeleted ? 'deleted' : 'no totalHours';
      console.log(`[calculateTotalHoursForTemplate] Excluding time from row ID=${row.id}, reason=${reason}, time=${row.totalHours}`);
    }
  });
  
  // Конвертируем обратно в формат "XXh:YYm" (английская локализация)
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  const result = `${totalHours}h:${remainingMinutes.toString().padStart(2, '0')}m`; // ИСПРАВЛЕНО: английская локализация
  
  console.log(`[calculateTotalHoursForTemplate] Total time calculated: ${result} from ${rows.length} rows (${rows.filter(r => !(r.deleted === 1 || r.Deleted === 1)).length} active)`);
  
  return result;
};

/**
 * Обновляет отображаемое общее время в первой строке каждого шаблона
 * с учетом статуса удаления строк
 * @param data Данные таблицы
 * @returns Обновленные данные таблицы
 */
export const updateDisplayedTotalHours = (data: IExtendedWeeklyTimeRow[]): IExtendedWeeklyTimeRow[] => {
  if (!data || data.length === 0) {
    return data;
  }
  
  // Получаем шаблоны
  const templates = getUniqueTemplates(data);
  
  // Создаем новый массив с обновленными данными
  const updatedData = [...data];
  
  // Для каждого шаблона обновляем первую строку
  templates.forEach(template => {
    if (template.rows.length > 0) {
      // Вычисляем общее время для этого шаблона
      // Функция calculateTotalHoursForTemplate сама отфильтрует удаленные строки
      const totalHoursForTemplate = calculateTotalHoursForTemplate(template.rows);
      
      // Находим индекс первой строки этого шаблона в общем массиве
      const firstRowIndex = updatedData.findIndex(row => row.id === template.rows[0].id);
      
      if (firstRowIndex !== -1) {
        // Обновляем отображаемое время в первой строке шаблона
        updatedData[firstRowIndex] = {
          ...updatedData[firstRowIndex],
          displayedTotalHours: totalHoursForTemplate
        };
        
        // Логируем для отладки
        console.log(`[updateDisplayedTotalHours] Updated displayedTotalHours for template first row ID=${template.rows[0].id} to ${totalHoursForTemplate}`);
      }
    }
  });
  
  return updatedData;
};

// ИСПРАВЛЕНО: Определяет, является ли строка первой в своем шаблоне
// Использует ТОЛЬКО поле NumberOfWeek
export const isFirstRowInTemplate = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
  if (!data || rowIndex < 0 || rowIndex >= data.length) {
    return false;
  }
  
  const currentRow = data[rowIndex];
  
  // ИСПРАВЛЕНО: Получаем номер недели ТОЛЬКО из поля NumberOfWeek
  const currentWeekNumber = currentRow.NumberOfWeek;
  
  if (currentWeekNumber === undefined) {
    console.warn(`[isFirstRowInTemplate] Row ${rowIndex} (ID: ${currentRow.id}) missing NumberOfWeek field`);
    return true; // Если данные некорректны, предполагаем что это первая строка шаблона
  }
  
  // Проверяем, есть ли строки с таким же номером недели до текущей строки
  for (let i = 0; i < rowIndex; i++) {
    const prevRow = data[i];
    const prevWeekNumber = prevRow.NumberOfWeek;
    
    if (prevWeekNumber === currentWeekNumber) {
      return false; // Нашли строку с таким же номером недели выше, значит текущая строка не первая в шаблоне
    }
  }
  
  return true; // Не найдена строка с таким же номером недели выше, значит это первая строка в шаблоне
};

// Вспомогательная функция для получения названия дня недели
export const getStartDayName = (day: number): string => {
  switch (day) {
    case 1: return "Sunday";
    case 2: return "Monday";
    case 3: return "Tuesday";
    case 4: return "Wednesday";
    case 5: return "Thursday";
    case 6: return "Friday";
    case 7: return "Saturday";
    default: return "Unknown";
  }
};

// Функция для получения упорядоченных дней недели в зависимости от dayOfStartWeek
export const getOrderedWeekDays = (dayOfStartWeek: number): { name: string; key: string; }[] => {
  // Определяем все дни недели с сокращенными названиями (до 3 букв)
  const allDays = [
    { name: 'Sun', key: 'sunday' },
    { name: 'Mon', key: 'monday' },
    { name: 'Tue', key: 'tuesday' },
    { name: 'Wed', key: 'wednesday' },
    { name: 'Thu', key: 'thursday' },
    { name: 'Fri', key: 'friday' },
    { name: 'Sat', key: 'saturday' }
  ];
  
  // Если dayOfStartWeek в пределах 1-7
  if (dayOfStartWeek >= 1 && dayOfStartWeek <= 7) {
    // Вычисляем смещение (dayOfStartWeek - 1, т.к. индексы массива начинаются с 0)
    const offset = dayOfStartWeek - 1;
    // Смещаем массив
    return [...allDays.slice(offset), ...allDays.slice(0, offset)];
  }
  
  // По умолчанию (или при некорректном значении) используем порядок с субботы (7)
  return [
    { name: 'Sat', key: 'saturday' },
    { name: 'Sun', key: 'sunday' },
    { name: 'Mon', key: 'monday' },
    { name: 'Tue', key: 'tuesday' },
    { name: 'Wed', key: 'wednesday' },
    { name: 'Thu', key: 'thursday' },
    { name: 'Fri', key: 'friday' }
  ];
};

// ИСПРАВЛЕНО: Определяет, является ли строка последней в своем шаблоне
// Использует ТОЛЬКО поле NumberOfWeek
export const isLastRowInTemplate = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
    if (!data || rowIndex < 0 || rowIndex >= data.length) {
      return false;
    }
    
    const currentRow = data[rowIndex];
    
    // ИСПРАВЛЕНО: Получаем номер недели ТОЛЬКО из поля NumberOfWeek
    const currentWeekNumber = currentRow.NumberOfWeek;
    
    if (currentWeekNumber === undefined) {
      console.warn(`[isLastRowInTemplate] Row ${rowIndex} (ID: ${currentRow.id}) missing NumberOfWeek field`);
      return true; // Если данные некорректны, предполагаем, что это единственная строка шаблона
    }
    
    // Если это последняя строка в массиве
    if (rowIndex === data.length - 1) {
      return true;
    }
    
    // Проверяем следующую строку
    const nextRow = data[rowIndex + 1];
    const nextWeekNumber = nextRow.NumberOfWeek;
    
    // Если у следующей строки другой номер недели или отсутствует NumberOfWeek, значит текущая строка последняя
    return nextWeekNumber === undefined || nextWeekNumber !== currentWeekNumber;
};