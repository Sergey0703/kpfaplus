// src/webparts/kpfaplus/models/IWeeklyTimeTable.ts

// Интерфейс для часов и минут (для начала и окончания)
export interface IDayHours {
  hours: string;
  minutes: string;
}

// Интерфейс для часов и минут с временем начала и окончания
export interface IDayHoursComplete {
  start: IDayHours;
  end: IDayHours;
}

// Интерфейс для сырых данных из источника (API SharePoint)
export interface IWeeklyTimeTableRawItem {
  id?: string | number;
  ID?: string | number;
  fields?: {
    id?: string | number;
    ID?: string | number;
    Deleted?: number;
    deleted?: number;
    NumberOfShift?: number;
    numberOfShift?: number; 
    NumberOfWeek?: number;
    numberOfWeek?: number;
    IdOfTemplate?: string | number;
    idOfTemplate?: string | number;
    IdOfTemplateLookupId?: string | number;
    Title?: string;
    Contract?: number;
    TimeForLunch?: number;
    
    // СТАРЫЕ DateTime поля (закомментированы - больше не используются)
    /*
    MondeyStartWork?: string; // С опечаткой как в коде
    MondayEndWork?: string;
    TuesdayStartWork?: string;
    TuesdayEndWork?: string;
    WednesdayStartWork?: string;
    WednesdayEndWork?: string;
    ThursdayStartWork?: string;
    ThursdayEndWork?: string;
    FridayStartWork?: string;
    FridayEndWork?: string;
    SaturdayStartWork?: string;
    SaturdayEndWork?: string;
    SundayStartWork?: string;
    SundayEndWork?: string;
    StartLunch?: string;
    EndLunch?: string;
    */
    
    // --- НОВЫЕ ЧИСЛОВЫЕ ПОЛЯ ДЛЯ ЧАСОВ И МИНУТ (ТЕПЕРЬ ОСНОВНЫЕ) ---
    // Monday
    MondayStartWorkHours?: number;
    MondayStartWorkMinutes?: number;
    MondayEndWorkHours?: number;
    MondayEndWorkMinutes?: number;
    
    // Tuesday
    TuesdayStartWorkHours?: number;
    TuesdayStartWorkMinutes?: number;
    TuesdayEndWorkHours?: number;
    TuesdayEndWorkMinutes?: number;
    
    // Wednesday
    WednesdayStartWorkHours?: number;
    WednesdayStartWorkMinutes?: number;
    WednesdayEndWorkHours?: number;
    WednesdayEndWorkMinutes?: number;
    
    // Thursday
    ThursdayStartWorkHours?: number;
    ThursdayStartWorkMinutes?: number;
    ThursdayEndWorkHours?: number;
    ThursdayEndWorkMinutes?: number;
    
    // Friday
    FridayStartWorkHours?: number;
    FridayStartWorkMinutes?: number;
    FridayEndWorkHours?: number;
    FridayEndWorkMinutes?: number;
    
    // Saturday
    SaturdayStartWorkHours?: number;
    SaturdayStartWorkMinutes?: number;
    SaturdayEndWorkHours?: number;
    SaturdayEndWorkMinutes?: number;
    
    // Sunday
    SundayStartWorkHours?: number;
    SundayStartWorkMinutes?: number;
    SundayEndWorkHours?: number;
    SundayEndWorkMinutes?: number;
    
    // --- КОНЕЦ НОВЫХ ПОЛЕЙ ---
    
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
  fields?: Record<string, unknown>; // Поддержка существующей структуры
  
  // СТАРЫЕ поля для времени начала и окончания (закомментированы)
  /*
  mondayStartWork?: string;
  mondayEndWork?: string;
  tuesdayStartWork?: string;
  tuesdayEndWork?: string;
  wednesdayStartWork?: string;
  wednesdayEndWork?: string;
  thursdayStartWork?: string;
  thursdayEndWork?: string;
  fridayStartWork?: string;
  fridayEndWork?: string;
  saturdayStartWork?: string;
  saturdayEndWork?: string;
  sundayStartWork?: string;
  sundayEndWork?: string;
  */
  
  // Дополнительные поля
  timeForLunch?: number;
  totalWorkHours?: string; // Для отображения общего времени работы
}

// Интерфейс для форматированных данных таблицы недельного расписания
export interface IFormattedWeeklyTimeRow {
  id: string;
  name: string; // "Week 1", "Week 1 Shift 2", и т.д.
  lunch: string;
  totalHours: string; // Общее время работы в формате "XXч:XXм"
  
  // Добавляем поля NumberOfWeek и NumberOfShift
  NumberOfWeek?: number; // Делаем опциональными, чтобы избежать ошибок при преобразовании типов
  NumberOfShift?: number;
  
  // Обновленные поля для дней недели с полным временем (начало и конец)
  saturday: IDayHoursComplete;
  sunday: IDayHoursComplete;
  monday: IDayHoursComplete;
  tuesday: IDayHoursComplete;
  wednesday: IDayHoursComplete;
  thursday: IDayHoursComplete;
  friday: IDayHoursComplete;
  
  total: string; // Номер контракта
  
  // Изменяем индексную сигнатуру, чтобы она поддерживала числовые значения
  [key: string]: string | IDayHoursComplete | number | undefined;
}

// Утилиты для работы с недельным расписанием
export class WeeklyTimeTableUtils {
  
  // НОВЫЙ МЕТОД: Извлечение часов и минут из числовых полей
  private static extractTimeFromNumericFields(
    hoursValue: unknown, 
    minutesValue: unknown
  ): IDayHours {
    // Преобразуем в числа с валидацией
    const hours = typeof hoursValue === 'number' ? hoursValue : 
                 typeof hoursValue === 'string' ? parseInt(hoursValue) : 0;
    const minutes = typeof minutesValue === 'number' ? minutesValue :
                   typeof minutesValue === 'string' ? parseInt(minutesValue) : 0;
    
    // Валидация значений
    const validHours = Math.max(0, Math.min(23, isNaN(hours) ? 0 : hours));
    const validMinutes = Math.max(0, Math.min(59, isNaN(minutes) ? 0 : minutes));
    
    const hoursStr = validHours.toString().padStart(2, '0');
    const minutesStr = validMinutes.toString().padStart(2, '0');
    
    console.log(`[WeeklyTimeTableUtils] Numeric fields: hours=${hoursValue}, minutes=${minutesValue} → ${hoursStr}:${minutesStr}`);
    
    return { hours: hoursStr, minutes: minutesStr };
  }

  // СТАРЫЙ МЕТОД - ЗАКОММЕНТИРОВАН
  /*
  // Вспомогательный метод для извлечения часов и минут из даты
  private static extractTimeFromDate(dateString: string | undefined): IDayHours {
  if (!dateString) {
    return { hours: '00', minutes: '00' };
  }

  const date = new Date(dateString);
  
  // Получаем UTC время
  let hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  
  // ИСПРАВЛЕНИЕ: Вычитаем 1 час для компенсации часового пояса UTC+1
  hours = hours - 1;
  if (hours < 0) {
    hours = 23; // Переходим на предыдущий день
  }
  
  const hoursStr = hours.toString().padStart(2, '0');
  const minutesStr = minutes.toString().padStart(2, '0');
  
  console.log(`[WeeklyTimeTableUtils] Original UTC: ${date.getUTCHours()}:${date.getUTCMinutes()}`);
  console.log(`[WeeklyTimeTableUtils] Adjusted for timezone: ${hoursStr}:${minutesStr}`);
  
  return { hours: hoursStr, minutes: minutesStr };
}
  */
  
  // Вспомогательный метод для безопасного получения строки из unknown
  private static safeString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    return undefined;
  }
  
  // Вспомогательный метод для безопасного получения числа из unknown
  private static safeNumber(value: unknown, defaultValue: number = 0): number {
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    }
    return defaultValue;
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
  
  
  public static formatWeeklyTimeTableData(
    items: IWeeklyTimeTableRawItem[],
    dayOfStartWeek: number = 7
  ): IFormattedWeeklyTimeRow[] {
    // Если нет данных, возвращаем пустой массив
    if (!items || items.length === 0) {
      return [];
    }
  
    console.log("Sample WeeklyTimeTable item structure:", JSON.stringify(items[0] || {}, null, 2));
    console.log(`Using DayOfStartWeek = ${dayOfStartWeek}, week starts with: ${this.getDayOrder(dayOfStartWeek)[0]}`);
    console.log("ОБНОВЛЕНО: Используем числовые поля для времени вместо DateTime полей");

    // Создаем массив для результатов
    const formattedRows: IFormattedWeeklyTimeRow[] = [];
    
    // Обрабатываем каждый элемент из списка WeeklyTimeTables
    items.forEach(item => {
      const fields = item.fields || item; // Поддержка как старого формата с fields, так и нового прямого формата
      
      // Получаем номер недели и смены с использованием safeNumber
      const weekNumber = this.safeNumber(fields.NumberOfWeek, 1);
      const shiftNumber = this.safeNumber(fields.NumberOfShift, 1);
      const contract = this.safeNumber(fields.Contract, 1);
      
      // Получаем время обеда из поля TimeForLunch, используем фактическое значение вместо значения по умолчанию
      const timeForLunch = fields.TimeForLunch !== undefined ? this.safeNumber(fields.TimeForLunch, 30) : 30;
      
      // Формируем имя строки
      const title = this.safeString(fields.Title) || '';
      let rowName = title ? title : `Week ${weekNumber}`;
      if (shiftNumber > 1) {
        rowName += ` Shift ${shiftNumber}`;
      }
      
      // НОВЫЙ ПОДХОД: Извлекаем часы и минуты для начала работы каждого дня из числовых полей
      const mondayStart = this.extractTimeFromNumericFields(
        fields.MondayStartWorkHours, 
        fields.MondayStartWorkMinutes
      );
      const tuesdayStart = this.extractTimeFromNumericFields(
        fields.TuesdayStartWorkHours, 
        fields.TuesdayStartWorkMinutes
      );
      const wednesdayStart = this.extractTimeFromNumericFields(
        fields.WednesdayStartWorkHours, 
        fields.WednesdayStartWorkMinutes
      );
      const thursdayStart = this.extractTimeFromNumericFields(
        fields.ThursdayStartWorkHours, 
        fields.ThursdayStartWorkMinutes
      );
      const fridayStart = this.extractTimeFromNumericFields(
        fields.FridayStartWorkHours, 
        fields.FridayStartWorkMinutes
      );
      const saturdayStart = this.extractTimeFromNumericFields(
        fields.SaturdayStartWorkHours, 
        fields.SaturdayStartWorkMinutes
      );
      const sundayStart = this.extractTimeFromNumericFields(
        fields.SundayStartWorkHours, 
        fields.SundayStartWorkMinutes
      );
      
      // НОВЫЙ ПОДХОД: Извлекаем часы и минуты для окончания работы каждого дня из числовых полей
      const mondayEnd = this.extractTimeFromNumericFields(
        fields.MondayEndWorkHours, 
        fields.MondayEndWorkMinutes
      );
      const tuesdayEnd = this.extractTimeFromNumericFields(
        fields.TuesdayEndWorkHours, 
        fields.TuesdayEndWorkMinutes
      );
      const wednesdayEnd = this.extractTimeFromNumericFields(
        fields.WednesdayEndWorkHours, 
        fields.WednesdayEndWorkMinutes
      );
      const thursdayEnd = this.extractTimeFromNumericFields(
        fields.ThursdayEndWorkHours, 
        fields.ThursdayEndWorkMinutes
      );
      const fridayEnd = this.extractTimeFromNumericFields(
        fields.FridayEndWorkHours, 
        fields.FridayEndWorkMinutes
      );
      const saturdayEnd = this.extractTimeFromNumericFields(
        fields.SaturdayEndWorkHours, 
        fields.SaturdayEndWorkMinutes
      );
      const sundayEnd = this.extractTimeFromNumericFields(
        fields.SundayEndWorkHours, 
        fields.SundayEndWorkMinutes
      );
      
      // Создаем объект строки с извлеченными значениями для всех дней
      const row: IFormattedWeeklyTimeRow = {
        id: typeof item.id === 'number' ? item.id.toString() : (item.id || ''),
        name: rowName,
        lunch: timeForLunch.toString(), // Используем точное значение из поля TimeForLunch
        totalHours: '', // Временно устанавливаем пустую строку, заполним после создания всей структуры

        NumberOfWeek: weekNumber,
        NumberOfShift: shiftNumber,
        
        // Структура с временем начала и окончания для каждого дня
        saturday: { 
          start: saturdayStart, 
          end: saturdayEnd
        },
        sunday: { 
          start: sundayStart, 
          end: sundayEnd 
        },
        monday: { 
          start: mondayStart, 
          end: mondayEnd 
        },
        tuesday: { 
          start: tuesdayStart, 
          end: tuesdayEnd 
        },
        wednesday: { 
          start: wednesdayStart, 
          end: wednesdayEnd 
        },
        thursday: { 
          start: thursdayStart, 
          end: thursdayEnd 
        },
        friday: { 
          start: fridayStart, 
          end: fridayEnd 
        },
        
        total: contract.toString()
      };
      
      // Выводим для отладки значение timeForLunch
      console.log(`Row ${row.id} - TimeForLunch from server: ${fields.TimeForLunch}, using value: ${timeForLunch}`);
      // После создания row
      console.log(`Row ${row.id} - NumberOfShift from server: ${fields.NumberOfShift}, using value: ${shiftNumber}`);
      // Рассчитываем общее время работы
      row.totalHours = this.calculateTotalWorkHours(
        {
          monday: row.monday as IDayHoursComplete,
          tuesday: row.tuesday as IDayHoursComplete,
          wednesday: row.wednesday as IDayHoursComplete,
          thursday: row.thursday as IDayHoursComplete,
          friday: row.friday as IDayHoursComplete,
          saturday: row.saturday as IDayHoursComplete,
          sunday: row.sunday as IDayHoursComplete
        },
        row.lunch
      );
      
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
    
    // Добавим дополнительные логи для проверки преобразованных данных
    if (formattedRows.length > 0) {
      console.log(`Example of first formatted row (id=${formattedRows[0].id}) with numeric time fields:`);
      console.log(`- lunch: ${formattedRows[0].lunch}`);
      console.log(`- totalHours: ${formattedRows[0].totalHours}`);
      console.log(`- monday start: ${formattedRows[0].monday.start.hours}:${formattedRows[0].monday.start.minutes}`);
      console.log(`- monday end: ${formattedRows[0].monday.end.hours}:${formattedRows[0].monday.end.minutes}`);
    }
    
    return formattedRows;
  }


  /**
   * Вычисляет общее время работы для данных
   * @param dayData Объект с данными времени начала и окончания для всех дней
   * @param lunchMinutes Время обеда в минутах
   * @returns Строка в формате "XXч:XXм" с общим временем работы
   */
  public static calculateTotalWorkHours(
    dayData: {
      monday: IDayHoursComplete;
      tuesday: IDayHoursComplete;
      wednesday: IDayHoursComplete;
      thursday: IDayHoursComplete;
      friday: IDayHoursComplete;
      saturday: IDayHoursComplete;
      sunday: IDayHoursComplete;
    }, 
    lunchMinutes: string
  ): string {
    // Функция для расчета минут между началом и концом дня
    const calculateDayMinutes = (day: IDayHoursComplete): number => {
      // Если время не задано или равны друг другу, считаем что работы не было
      if (!day.start.hours || !day.end.hours) return 0;
      
      const startHours = parseInt(day.start.hours);
      const startMinutes = parseInt(day.start.minutes);
      const endHours = parseInt(day.end.hours);
      const endMinutes = parseInt(day.end.minutes);
      
      // Если начало и конец одинаковые, считаем что работы не было
      if (startHours === endHours && startMinutes === endMinutes) return 0;
      
      // Общее время в минутах
      let totalMinutes = (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
      
      // Если конец меньше или равен началу, считаем что смена перешла на следующий день
      if (totalMinutes <= 0) {
        // Особый случай для 00:00 - считаем как конец текущего дня, а не начало следующего
        if (endHours === 0 && endMinutes === 0) {
          totalMinutes = (24 * 60) - (startHours * 60 + startMinutes);
        } else {
          totalMinutes += 24 * 60;
        }
      }
      
      return totalMinutes;
    };
    
    // Считаем общее время по всем дням в объекте
    const days = {
      monday: dayData.monday,
      tuesday: dayData.tuesday,
      wednesday: dayData.wednesday,
      thursday: dayData.thursday,
      friday: dayData.friday,
      saturday: dayData.saturday,
      sunday: dayData.sunday
    };
    
    // Считаем минуты за каждый день и общую сумму
    let totalMinutes = 0;
    let workingDaysCount = 0;
    
    Object.entries(days).forEach(([_, day]) => {
      const dayMinutes = calculateDayMinutes(day);
      if (dayMinutes > 0) {
        totalMinutes += dayMinutes;
        workingDaysCount++;
      }
    });
    
    // Вычитаем время обеда для каждого рабочего дня
    const lunchMinutesPerDay = parseInt(lunchMinutes) || 0;
    totalMinutes -= lunchMinutesPerDay * workingDaysCount;
    
    // Убедимся, что общее время не отрицательное
    totalMinutes = Math.max(0, totalMinutes);
    
    // Преобразуем в формат "XXч:XXм"
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h:${minutes.toString().padStart(2, '0')}m`;
  }
}