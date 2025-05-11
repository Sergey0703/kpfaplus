// src/webparts/kpfaplus/models/IWeeklyTimeTable.ts

// Интерфейс для часов и минут
export interface IDayHours {
  hours: string;
  minutes: string;
}

// Обновление интерфейса для данных из списка WeeklyTimeTables
export interface IWeeklyTimeTableItem {
  id: string;
  weekNumber: number;
  shiftNumber: number;
  contract: number;
  title: string;
  creator: {
    id: string;
    title: string;
  };
  idOfTemplate: {
    id: string;
    title: string;
  };
  fields?: any; // Добавляем поле fields для поддержки существующей структуры
}

// Интерфейс для форматированных данных таблицы недельного расписания
export interface IFormattedWeeklyTimeRow {
  id: string;
  name: string; // "Week 1", "Week 1 Shift 2", и т.д.
  lunch: string;
  saturday: IDayHours;
  sunday: IDayHours;
  monday: IDayHours;
  tuesday: IDayHours;
  wednesday: IDayHours;
  thursday: IDayHours;
  friday: IDayHours;
  total: string;
  
  // Добавляем индексную сигнатуру для доступа по строковому ключу
  [key: string]: string | IDayHours;
}

// Утилиты для работы с недельным расписанием
export class WeeklyTimeTableUtils {
  // Вспомогательный метод для извлечения часов и минут из даты
  private static extractTimeFromDate(dateString: string | undefined): IDayHours {
    if (!dateString) {
      return { hours: '00', minutes: '00' };
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return { hours: '00', minutes: '00' };
      }
      
      const hours = date.getUTCHours().toString().padStart(2, '0');
      const minutes = date.getUTCMinutes().toString().padStart(2, '0');
      
      return { hours, minutes };
    } catch (error) {
      console.error("Error extracting time from date:", error);
      return { hours: '00', minutes: '00' };
    }
  }
  
  // Метод для получения порядка дней в зависимости от DayOfStartWeek
  public static getDayOrder(dayOfStartWeek: number): string[] {
    // Массив дней недели в стандартном порядке (начиная с воскресенья)
    const standardDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    // Если dayOfStartWeek в пределах 1-7
    if (dayOfStartWeek >= 1 && dayOfStartWeek <= 7) {
      // Смещаем массив так, чтобы dayOfStartWeek был первым днем
      const orderedDays = [...standardDays];
      // Вычисляем смещение (dayOfStartWeek - 1, т.к. индексы массива начинаются с 0)
      const offset = dayOfStartWeek - 1;
      // Смещаем массив
      return [...orderedDays.slice(offset), ...orderedDays.slice(0, offset)];
    }
    
    // По умолчанию (или при некорректном значении) используем порядок с субботы (7)
    return ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  }
  
  /**
   * Преобразует данные из списка WeeklyTimeTables в формат для отображения в таблице
   * @param items Данные из списка WeeklyTimeTables
   * @param dayOfStartWeek День начала недели (1 = Воскресенье, 2 = Понедельник, ..., 7 = Суббота)
   * @returns Форматированные данные для таблицы
   */
  public static formatWeeklyTimeTableData(
    items: any[],
    dayOfStartWeek: number = 7
  ): IFormattedWeeklyTimeRow[] {
    // Если нет данных, возвращаем пустой массив
    if (!items || items.length === 0) {
      return [];
    }

    console.log("Sample WeeklyTimeTable item structure:", JSON.stringify(items[0].fields || {}, null, 2));
    console.log(`Using DayOfStartWeek = ${dayOfStartWeek}, week starts with: ${this.getDayOrder(dayOfStartWeek)[0]}`);

    // Создаем массив для результатов
    const formattedRows: IFormattedWeeklyTimeRow[] = [];
    
    // Обрабатываем каждый элемент из списка WeeklyTimeTables
    items.forEach(item => {
      const fields = item.fields || {};
      
      // Получаем номер недели и смены
      const weekNumber = fields.NumberOfWeek || 1;
      const shiftNumber = fields.NumberOfShift || 1;
      const contract = fields.Contract || 1;
      const timeForLunch = fields.TimeForLunch || 30;
      
      // Формируем имя строки
      let rowName = fields.Title || `Week ${weekNumber}`;
      if (shiftNumber > 1) {
        rowName += ` Shift ${shiftNumber}`;
      }
      
      // Извлекаем часы и минуты для каждого дня
      const mondayStart = this.extractTimeFromDate(fields.MondeyStartWork); // Обратите внимание на опечатку
      const tuesdayStart = this.extractTimeFromDate(fields.TuesdayStartWork);
      const wednesdayStart = this.extractTimeFromDate(fields.WednesdayStartWork);
      const thursdayStart = this.extractTimeFromDate(fields.ThursdayStartWork);
      const fridayStart = this.extractTimeFromDate(fields.FridayStartWork);
      const saturdayStart = this.extractTimeFromDate(fields.SaturdayStartWork);
      const sundayStart = this.extractTimeFromDate(fields.SundayStartWork);
      
      // Создаем объект строки с извлеченными значениями для всех дней
      const row: IFormattedWeeklyTimeRow = {
        id: item.id,
        name: rowName,
        lunch: timeForLunch.toString(),
        saturday: saturdayStart,
        sunday: sundayStart,
        monday: mondayStart,
        tuesday: tuesdayStart,
        wednesday: wednesdayStart,
        thursday: thursdayStart,
        friday: fridayStart,
        total: contract.toString()
      };
      
      // Добавляем строку в результаты
      formattedRows.push(row);
    });
    
    // Сортируем строки по номеру недели и смены
    formattedRows.sort((a, b) => {
      const weekA = parseInt(a.name.split(' ')[1]) || 0;
      const weekB = parseInt(b.name.split(' ')[1]) || 0;
      
      // Если номера недель отличаются, сортируем по номеру недели
      if (weekA !== weekB) {
        return weekA - weekB;
      }
      
      // Иначе проверяем наличие "Shift" в имени
      const hasShiftA = a.name.includes('Shift');
      const hasShiftB = b.name.includes('Shift');
      
      // Если у одной есть "Shift", а у другой нет, то та, у которой нет, идет первой
      if (hasShiftA !== hasShiftB) {
        return hasShiftA ? 1 : -1;
      }
      
      // Если обе имеют "Shift" или обе не имеют, смотрим на номер смены
      const shiftA = hasShiftA ? parseInt(a.name.split('Shift ')[1]) || 0 : 0;
      const shiftB = hasShiftB ? parseInt(b.name.split('Shift ')[1]) || 0 : 0;
      
      return shiftA - shiftB;
    });
    
    return formattedRows;
  }
}