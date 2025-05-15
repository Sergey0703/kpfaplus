// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableLogic.ts
import { 
    IFormattedWeeklyTimeRow
  } from '../../../models/IWeeklyTimeTable';
  // В начале файла WeeklyTimeTableLogic.ts добавьте импорт
import { IDayHoursComplete } from '../../../models/IWeeklyTimeTable';
  // Интерфейс для расширенной строки с дополнительным полем displayedTotalHours
  export interface IExtendedWeeklyTimeRow extends IFormattedWeeklyTimeRow {
    displayedTotalHours?: string;
    NumberOfShift?: number;
    [key: string]: string | IDayHoursComplete | number | undefined;
  }
  
  // Функция для получения множества уникальных шаблонов в данных
  export const getUniqueTemplates = (data: IExtendedWeeklyTimeRow[]): { templateId: string, rows: IExtendedWeeklyTimeRow[] }[] => {
    if (!data || data.length === 0) {
      return [];
    }
  
    // Группируем строки по шаблону (используем часть имени до "Week")
    const templateMap = new Map<string, IExtendedWeeklyTimeRow[]>();
    
    data.forEach(row => {
      // Предполагаем, что формат имени включает номер недели (например, "Week 1", "Week 1 Shift 2")
      const match = row.name.match(/Week\s+(\d+)/i);
      if (match) {
        const weekNumber = match[1];
        // Используем комбинацию числа недели и общего количества недель в шаблоне как ключ
        const templateKey = `template_${weekNumber}`;
        
        if (!templateMap.has(templateKey)) {
          templateMap.set(templateKey, []);
        }
        templateMap.get(templateKey)?.push(row);
      } else {
        // Если формат имени не соответствует ожидаемому, используем ID как ключ
        const templateKey = `template_${row.id}`;
        templateMap.set(templateKey, [row]);
      }
    });
    
    // Преобразуем Map в массив объектов для удобства использования
    const templates: { templateId: string, rows: IExtendedWeeklyTimeRow[] }[] = [];
    templateMap.forEach((rows, templateId) => {
      // Сортируем строки в каждом шаблоне по номеру недели и смены
      rows.sort((a, b) => {
        // Извлекаем номер недели
        const weekA = parseInt(a.name.split('Week ')[1]?.split(' ')[0] || '0', 10);
        const weekB = parseInt(b.name.split('Week ')[1]?.split(' ')[0] || '0', 10);
        
        if (weekA !== weekB) {
          return weekA - weekB;
        }
        
        // Если неделя одинаковая, сортируем по наличию "Shift" и номеру смены
        const shiftAMatch = a.name.match(/Shift\s+(\d+)/i);
        const shiftBMatch = b.name.match(/Shift\s+(\d+)/i);
        
        const shiftA = shiftAMatch ? parseInt(shiftAMatch[1], 10) : 0;
        const shiftB = shiftBMatch ? parseInt(shiftBMatch[1], 10) : 0;
        
        return shiftA - shiftB;
      });
      
      templates.push({ templateId, rows });
    });
    
    return templates;
  };
  
  // Функция для расчета общего количества часов для шаблона
 
  /**
 * Функция для расчета общего количества часов для шаблона с учетом статуса удаления строк
 * @param rows Строки шаблона
 * @returns Строка с общим временем в формате "XXч:YYм"
 */
export const calculateTotalHoursForTemplate = (rows: IExtendedWeeklyTimeRow[]): string => {
  if (!rows || rows.length === 0) {
    return '0ч:00м';
  }
  
  // Конвертируем строки времени в минуты для суммирования
  let totalMinutes = 0;
  
  rows.forEach(row => {
    // Проверяем, не удалена ли строка
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // Если строка удалена, не учитываем её время
    if (!isDeleted) {
      // Извлекаем часы и минуты из строки формата "XXч:YYм"
      const hoursMatch = row.totalHours?.match(/(\d+)ч/);
      const minutesMatch = row.totalHours?.match(/:(\d+)м/);
      
      const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
      const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
      
      // Суммируем в минутах
      totalMinutes += (hours * 60) + minutes;
      
      // Логируем для отладки
      console.log(`Including time from row ID=${row.id}, time=${row.totalHours}, in minutes=${(hours * 60) + minutes}`);
    } else {
      // Логируем исключенные строки для отладки
      console.log(`Excluding time from deleted row ID=${row.id}, time=${row.totalHours}`);
    }
  });
  
  // Конвертируем обратно в формат "XXч:YYм"
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  
  console.log(`Total time calculated: ${totalHours}ч:${remainingMinutes.toString().padStart(2, '0')}м from ${rows.length} rows (${rows.filter(r => !(r.deleted === 1 || r.Deleted === 1)).length} active)`);
  
  return `${totalHours}ч:${remainingMinutes.toString().padStart(2, '0')}м`;
};
  // Обновляем отображение общего времени в первой строке каждого шаблона
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
        console.log(`Updated displayedTotalHours for template first row ID=${template.rows[0].id} to ${totalHoursForTemplate}`);
      }
    }
  });
  
  return updatedData;
};
  
  // Определяет, является ли строка первой в своем шаблоне
  export const isFirstRowInTemplate = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
    if (!data || rowIndex < 0 || rowIndex >= data.length) {
      return false;
    }
    
    const currentRow = data[rowIndex];
    
    // Извлекаем номер недели из имени текущей строки
    const weekMatch = currentRow.name.match(/Week\s+(\d+)/i);
    if (!weekMatch) {
      return true; // Если формат имени не соответствует, предполагаем что это первая строка шаблона
    }
    
    const weekNumber = weekMatch[1];
    
    // Проверяем, есть ли строки с таким же номером недели до текущей строки
    for (let i = 0; i < rowIndex; i++) {
      const prevRow = data[i];
      const prevWeekMatch = prevRow.name.match(/Week\s+(\d+)/i);
      if (prevWeekMatch && prevWeekMatch[1] === weekNumber) {
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
    // Определяем все дни недели (начиная с воскресенья, как в стандарте)
    const allDays = [
      { name: 'Sunday', key: 'sunday' },
      { name: 'Monday', key: 'monday' },
      { name: 'Tuesday', key: 'tuesday' },
      { name: 'Wednesday', key: 'wednesday' },
      { name: 'Thursday', key: 'thursday' },
      { name: 'Friday', key: 'friday' },
      { name: 'Saturday', key: 'saturday' }
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
      { name: 'Saturday', key: 'saturday' },
      { name: 'Sunday', key: 'sunday' },
      { name: 'Monday', key: 'monday' },
      { name: 'Tuesday', key: 'tuesday' },
      { name: 'Wednesday', key: 'wednesday' },
      { name: 'Thursday', key: 'thursday' },
      { name: 'Friday', key: 'friday' }
    ];
  };

// Определяет, является ли строка последней в своем шаблоне
export const isLastRowInTemplate = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
    if (!data || rowIndex < 0 || rowIndex >= data.length) {
      return false;
    }
    
    const currentRow = data[rowIndex];
    
    // Извлекаем номер недели из имени текущей строки
    const weekMatch = currentRow.name.match(/Week\s+(\d+)/i);
    if (!weekMatch) {
      return true; // Если формат имени не соответствует, предполагаем, что это единственная строка шаблона
    }
    
    const weekNumber = weekMatch[1];
    
    // Если это последняя строка в массиве или следующая строка имеет другой номер недели
    if (rowIndex === data.length - 1) {
      return true;
    }
    
    // Проверяем следующую строку
    const nextRow = data[rowIndex + 1];
    const nextWeekMatch = nextRow.name.match(/Week\s+(\d+)/i);
    
    // Если у следующей строки другой номер недели или нет совпадения, значит текущая строка последняя
    return !nextWeekMatch || nextWeekMatch[1] !== weekNumber;
};

/**
 * Определяет, можно ли удалить строку таблицы
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
  
  // Получаем номер недели текущей строки
  const currentWeekNumber = currentRow.NumberOfWeek || extractWeekNumber(currentRow.name);
  
  // Проверяем, есть ли неудаленные строки с большим номером недели
  const hasNextWeek = data.some(row => {
    // Учитываем только неудаленные строки
    const isRowDeleted = row.deleted === 1 || row.Deleted === 1;
    if (isRowDeleted) return false;
    
    const weekNumber = row.NumberOfWeek || extractWeekNumber(row.name);
    return weekNumber > currentWeekNumber;
  });
  
  // Фильтруем только неудаленные строки в текущей неделе
  const activeRowsInWeek = data.filter(row => {
    const isRowDeleted = row.deleted === 1 || row.Deleted === 1;
    if (isRowDeleted) return false;
    
    const weekNumber = row.NumberOfWeek || extractWeekNumber(row.name);
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
 * Анализирует данные таблицы для определения состояния недель
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
    // Получаем номер недели
    let weekNumber = row.NumberOfWeek;
    
    // Если номер недели не определен, пытаемся извлечь из имени
    if (weekNumber === undefined) {
      const match = row.name.match(/Week\s+(\d+)/i);
      weekNumber = match ? parseInt(match[1], 10) : 0;
    }
    
    // Если номер недели определен и больше 0
    if (weekNumber && weekNumber > 0) {
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
    message: `New week ${nextWeekNumber} has been added.`,//message: `Будет добавлена новая неделя (Week ${nextWeekNumber}).`,
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
  
  // Получаем номер недели текущей строки
  const currentWeekNumber = currentRow.NumberOfWeek || extractWeekNumber(currentRow.name);
  // Получаем номер смены текущей строки
  const currentShiftNumber = currentRow.NumberOfShift || 1;
  
  console.log(`canRestoreRow: Row ${rowIndex} is in week ${currentWeekNumber}, shift ${currentShiftNumber}`);
  
  // Найдем все удаленные строки в той же неделе
  const deletedRowsInSameWeek = data.filter(row => {
    const rowWeekNumber = row.NumberOfWeek || extractWeekNumber(row.name);
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
    console.log(`canRestoreRow: Deleted row ${idx} in week ${currentWeekNumber}: ID=${row.id}, shift=${row.NumberOfShift || 1}`);
  });
  
  // Найдем строку с минимальным номером смены среди удаленных
  const minShiftNumber = Math.min(...deletedRowsInSameWeek.map(row => row.NumberOfShift || 1));
  
  console.log(`canRestoreRow: Min shift number among deleted rows: ${minShiftNumber}`);
  console.log(`canRestoreRow: Current row shift number: ${currentShiftNumber}`);
  console.log(`canRestoreRow: Can restore row ${rowIndex}? ${currentShiftNumber === minShiftNumber}`);
  
  // Строку можно восстановить, если её номер смены минимален среди всех удаленных в этой неделе
  return currentShiftNumber === minShiftNumber;
};

/**
 * Вспомогательная функция для извлечения номера недели из названия строки
 * @param name Название строки
 * @returns Номер недели или 1, если не удалось извлечь
 */
function extractWeekNumber(name: string): number {
  const match = name?.match(/Week\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 1;
}