// src/webparts/kpfaplus/models/IWeeklyTimeTable.ts
// Интерфейс для данных из списка WeeklyTimeTables
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

    console.log("Sample WeeklyTimeTable item structure:", JSON.stringify(items[0].fields || {}, null, 2));

    // Создаем массив для результатов
    const formattedRows: IFormattedWeeklyTimeRow[] = [];
    
    // Обрабатываем каждый элемент из списка WeeklyTimeTables
    items.forEach(item => {
      const fields = item.fields || {};
      
      // Получаем номер недели и смены
      const weekNumber = fields.NumberOfWeek || 1;
      const shiftNumber = fields.NumberOfShift || 1;
      const contract = fields.Contract || 1;
      
      // Формируем имя строки
      let rowName = fields.Title || `Week ${weekNumber}`;
      if (shiftNumber > 1) {
        rowName += ` Shift ${shiftNumber}`;
      }
      
      // Создаем объект строки с пустыми значениями для всех дней
      const row: IFormattedWeeklyTimeRow = {
        id: item.id,
        name: rowName,
        lunch: '30', // Значение по умолчанию
        saturday: { hours: '00', minutes: '00' },
        sunday: { hours: '00', minutes: '00' },
        monday: { hours: '00', minutes: '00' },
        tuesday: { hours: '00', minutes: '00' },
        wednesday: { hours: '00', minutes: '00' },
        thursday: { hours: '00', minutes: '00' },
        friday: { hours: '00', minutes: '00' },
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