// src/webparts/kpfaplus/models/IWeeklyTimeTable.ts
// Интерфейс для данных из списка WeeklyTimeTables
export interface IWeeklyTimeTableItem {
  id: string;
  weekNumber: number;
  shiftNumber: number;
  dayOfWeek: number; // 0-6, где 0 - воскресенье, 1 - понедельник и т.д.
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  lunchTime: number;
  deleted: boolean;
  creator: {
    id: string;
    title: string;
  };
  idOfTemplate: {
    id: string;
    title: string;
  };
}

// Интерфейс для форматированных данных таблицы недельного расписания
export interface IFormattedWeeklyTimeRow {
  id: string;
  name: string; // "Week 1", "Week 1 Shift 2", и т.д.
  lunch: string;
  saturday: { hours: string; minutes: string; };
  sunday: { hours: string; minutes: string; };
  monday: { hours: string; minutes: string; };
  tuesday: { hours: string; minutes: string; };
  wednesday: { hours: string; minutes: string; };
  thursday: { hours: string; minutes: string; };
  friday: { hours: string; minutes: string; };
  total: string;
  
  // Добавляем индексную сигнатуру для доступа по строковому ключу
  [key: string]: any;
}

// Утилиты для работы с недельным расписанием
export class WeeklyTimeTableUtils {
  /**
   * Преобразует данные из списка WeeklyTimeTables в формат для отображения в таблице
   * @param items Данные из списка WeeklyTimeTables
   * @returns Форматированные данные для таблицы
   */
  public static formatWeeklyTimeTableData(items: any[]): IFormattedWeeklyTimeRow[] {
    // Если нет данных, возвращаем пустой массив
    if (!items || items.length === 0) {
      return [];
    }

    // Создаем карту для группировки данных по неделе и смене
    const weekShiftMap = new Map<string, any[]>();
    
    // Группируем записи по неделе и смене
    items.forEach(item => {
      const fields = item.fields || {};
      
      // Логируем структуру первого элемента для отладки
      if (weekShiftMap.size === 0) {
        console.log("Sample WeeklyTimeTable item structure:", JSON.stringify(fields, null, 2));
      }

      // Проверяем разные варианты имен полей (SharePoint может вернуть разные форматы)
      // WeekNumber может быть как WeekNumber, так и WeekNumberLookupId
      const weekNumber = fields.WeekNumber || 
                         fields.WeekNumberLookupId || 
                         1;
                         
      // ShiftNumber может быть как ShiftNumber, так и ShiftNumberLookupId
      const shiftNumber = fields.ShiftNumber || 
                          fields.ShiftNumberLookupId || 
                          1;
                          
      // Формируем ключ для группировки данных
      const key = `${weekNumber}-${shiftNumber}`;
      
      // Если для этой комбинации недели и смены еще нет записей, создаем пустой массив
      if (!weekShiftMap.has(key)) {
        weekShiftMap.set(key, []);
      }
      
      // DayOfWeek может быть указан напрямую или через lookup
      const dayOfWeek = fields.DayOfWeek !== undefined ? fields.DayOfWeek : 
                       (fields.DayOfWeekLookupId !== undefined ? fields.DayOfWeekLookupId : 
                       (typeof fields.DayOfWeekLookup === 'string' ? parseInt(fields.DayOfWeekLookup) : 0));
      
      // StartHour может быть в разных форматах
      const startHour = fields.StartHour !== undefined ? fields.StartHour : 
                       (fields.StartHourLookupId !== undefined ? fields.StartHourLookupId : 
                       (typeof fields.StartHourLookup === 'string' ? parseInt(fields.StartHourLookup) : 0));
      
      // StartMinute может быть в разных форматах
      const startMinute = fields.StartMinute !== undefined ? fields.StartMinute : 
                          (fields.StartMinuteLookupId !== undefined ? fields.StartMinuteLookupId : 
                          (typeof fields.StartMinuteLookup === 'string' ? parseInt(fields.StartMinuteLookup) : 0));
      
      // EndHour может быть в разных форматах
      const endHour = fields.EndHour !== undefined ? fields.EndHour : 
                     (fields.EndHourLookupId !== undefined ? fields.EndHourLookupId : 
                     (typeof fields.EndHourLookup === 'string' ? parseInt(fields.EndHourLookup) : 0));
      
      // EndMinute может быть в разных форматах
      const endMinute = fields.EndMinute !== undefined ? fields.EndMinute : 
                        (fields.EndMinuteLookupId !== undefined ? fields.EndMinuteLookupId : 
                        (typeof fields.EndMinuteLookup === 'string' ? parseInt(fields.EndMinuteLookup) : 0));
      
      // LunchTime может быть в разных форматах
      const lunchTime = fields.LunchTime !== undefined ? fields.LunchTime : 
                        (fields.LunchTimeLookupId !== undefined ? fields.LunchTimeLookupId : 
                        (typeof fields.LunchTimeLookup === 'string' ? parseInt(fields.LunchTimeLookup) : 0));
      
      // Добавляем запись в массив для этой комбинации недели и смены
      const existingItems = weekShiftMap.get(key);
      if (existingItems) {
        existingItems.push({
          id: item.id,
          weekNumber,
          shiftNumber,
          dayOfWeek,
          startHour,
          startMinute,
          endHour,
          endMinute,
          lunchTime,
          deleted: fields.Deleted === 1 || fields.Deleted === true || false
        });
      }
    });
    
    // Преобразуем сгруппированные данные в формат для отображения в таблице
    const formattedRows: IFormattedWeeklyTimeRow[] = [];
    
    weekShiftMap.forEach((dayItems, key) => {
      const [weekNumber, shiftNumber] = key.split('-').map(Number);
      
      // Формируем имя строки
      let rowName = `Week ${weekNumber}`;
      if (shiftNumber > 1) {
        rowName += ` Shift ${shiftNumber}`;
      }
      
      // Создаем объект строки с пустыми значениями для всех дней
      const row: IFormattedWeeklyTimeRow = {
        id: key,
        name: rowName,
        lunch: '0',
        saturday: { hours: '00', minutes: '00' },
        sunday: { hours: '00', minutes: '00' },
        monday: { hours: '00', minutes: '00' },
        tuesday: { hours: '00', minutes: '00' },
        wednesday: { hours: '00', minutes: '00' },
        thursday: { hours: '00', minutes: '00' },
        friday: { hours: '00', minutes: '00' },
        total: '1'
      };
      
      // Заполняем данными для каждого дня
      dayItems.forEach(dayItem => {
        // Определяем, какой день недели обрабатываем
        // В SharePoint: 0 - воскресенье, 1 - понедельник, ..., 6 - суббота
        // В нашем интерфейсе: sunday, monday, ..., saturday
        const dayOfWeek = dayItem.dayOfWeek;
        let dayName = '';
        
        switch (dayOfWeek) {
          case 0: dayName = 'sunday'; break;
          case 1: dayName = 'monday'; break;
          case 2: dayName = 'tuesday'; break;
          case 3: dayName = 'wednesday'; break;
          case 4: dayName = 'thursday'; break;
          case 5: dayName = 'friday'; break;
          case 6: dayName = 'saturday'; break;
          default: dayName = 'monday'; break;
        }
        
        // Проверяем, что dayName - это допустимый день недели и соответствующее свойство существует в объекте
        if (dayName && 
            (dayName === 'saturday' || dayName === 'sunday' || dayName === 'monday' || 
             dayName === 'tuesday' || dayName === 'wednesday' || dayName === 'thursday' || 
             dayName === 'friday') && 
            row[dayName]) {
          
          // Заполняем время для соответствующего дня
          row[dayName] = {
            hours: dayItem.startHour.toString().padStart(2, '0'),
            minutes: dayItem.startMinute.toString().padStart(2, '0')
          };
        }
        
        // Заполняем время обеда (берем из первой записи для этой недели/смены)
        if (!row.lunch || row.lunch === '0') {
          row.lunch = dayItem.lunchTime.toString();
        }
      });
      
      // Добавляем строку в результаты
      formattedRows.push(row);
    });
    
    // Сортируем строки по номеру недели и смены
    formattedRows.sort((a, b) => {
      const [weekA, shiftA] = a.id.split('-').map(Number);
      const [weekB, shiftB] = b.id.split('-').map(Number);
      
      // Сначала сортируем по номеру недели
      if (weekA !== weekB) {
        return weekA - weekB;
      }
      
      // Затем по номеру смены
      return shiftA - shiftB;
    });
    
    return formattedRows;
  }
}