// src/webparts/kpfaplus/services/HolidaysService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

// Интерфейс для праздничных дней
export interface IHoliday {
  id: string;
  title: string;
  date: Date;
  yearOfHolidays: number;
}

// Интерфейс для необработанных данных из SharePoint
interface IRawHolidayItem {
  id: string;
  fields?: {
    Title?: string;
    Date?: string;
    YearOfHolidays?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Сервис для работы со списком праздничных дней в SharePoint
 * ОБНОВЛЕНО: Работа с Date-only полем (без времени) для устранения проблем с часовыми поясами
 */
export class HolidaysService {
  private static _instance: HolidaysService;
  private _listName: string = "Holidays";
  private _logSource: string = "HolidaysService";
  private _remoteSiteService: RemoteSiteService;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    // Инициализация RemoteSiteService для работы с удаленным сайтом
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("HolidaysService initialized with RemoteSiteService (Date-only mode)");
  }

  /**
   * Получение экземпляра сервиса (Singleton паттерн)
   * @param context Контекст веб-части
   * @returns Экземпляр HolidaysService
   */
  public static getInstance(context: WebPartContext): HolidaysService {
    if (!HolidaysService._instance) {
      HolidaysService._instance = new HolidaysService(context);
    }
    return HolidaysService._instance;
  }

  /**
   * Получение всех праздников из списка SharePoint
   * @returns Promise с массивом всех праздников
   */
  public async getAllHolidays(): Promise<IHoliday[]> {
    try {
      this.logInfo("Fetching all holidays");
      
      // Получаем все элементы из списка Holidays
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        undefined, // без фильтра
        { field: "Date", ascending: true } // сортировка по дате
      );
      
      this.logInfo(`Retrieved ${items.length} holidays`);
      
      // Преобразуем данные из SharePoint в формат IHoliday
      const holidays = this.mapToHolidays(items as IRawHolidayItem[]);
      
      return holidays;
    } catch (error) {
      this.logError(`Error fetching all holidays: ${error}`);
      return [];
    }
  }

  /**
   * Получение праздников для конкретного года
   * @param year Год, для которого нужны праздники
   * @returns Promise с массивом праздников для указанного года
   */
  public async getHolidaysByYear(year: number): Promise<IHoliday[]> {
    try {
      this.logInfo(`Fetching holidays for year ${year}`);
      
      // Формируем фильтр для запроса по году
      // Используем диапазон дат: от 1 января до 31 декабря указанного года
      const startOfYear = this.formatDateForFilter(new Date(year, 0, 1)); // 1 января
      const endOfYear = this.formatDateForFilter(new Date(year, 11, 31)); // 31 декабря
      
      const filter = `fields/Date ge '${startOfYear}' and fields/Date le '${endOfYear}'`;
      
      this.logInfo(`Using year filter: ${filter}`);
      
      // Получаем праздники с фильтрацией на сервере
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        filter,
        { field: "Date", ascending: true } // сортировка по дате
      );
      
      this.logInfo(`Retrieved ${items.length} holidays for year ${year}`);
      
      // Преобразуем данные из SharePoint в формат IHoliday
      const holidays = this.mapToHolidays(items as IRawHolidayItem[]);
      
      return holidays;
    } catch (error) {
      this.logError(`Error fetching holidays for year ${year}: ${error}`);
      return [];
    }
  }

  /**
   * ИСПРАВЛЕНО: Получение праздников для конкретного месяца и года с правильными границами
   * @param date Дата, содержащая месяц и год для фильтрации
   * @returns Promise с массивом праздников для указанного месяца и года
   */
  public async getHolidaysByMonthAndYear(date: Date): Promise<IHoliday[]> {
    try {
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11, не добавляем +1
      
      this.logInfo(`Fetching holidays for year: ${year}, month: ${month + 1}`);
      
      // ИСПРАВЛЕНО: Правильное вычисление границ месяца
      const firstDayOfMonth = new Date(year, month, 1); // Первый день месяца
      const lastDayOfMonth = new Date(year, month + 1, 0); // Последний день месяца
      
      // Форматируем даты для фильтрации (Date-only формат)
      const firstDayStr = this.formatDateForFilter(firstDayOfMonth);
      const lastDayStr = this.formatDateForFilter(lastDayOfMonth);
      
      // Строим фильтр для запроса
      const filter = `fields/Date ge '${firstDayStr}' and fields/Date le '${lastDayStr}'`;
      
      this.logInfo(`Using filter: ${filter}`);
      this.logInfo(`Date range: ${firstDayOfMonth.toLocaleDateString()} - ${lastDayOfMonth.toLocaleDateString()}`);
      
      // Выполняем запрос к SharePoint с фильтром на сервере
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        filter,
        { field: "Date", ascending: true } // сортировка по дате
      );
      
      this.logInfo(`Retrieved ${items.length} holidays with server-side filtering for month ${month + 1}/${year}`);
      
      // Преобразуем данные из SharePoint в формат IHoliday
      const holidays = this.mapToHolidays(items as IRawHolidayItem[]);
      
      return holidays;
    } catch (error) {
      this.logError(`Error fetching holidays for month ${date.getMonth() + 1}/${date.getFullYear()}: ${error}`);
      return [];
    }
  }

  /**
   * УПРОЩЕНО: Проверяет, является ли указанная дата праздничным днем
   * @param date Дата для проверки
   * @param holidays Массив праздников для проверки
   * @returns true, если дата является праздником, иначе false
   */
  public isHoliday(date: Date, holidays: IHoliday[]): boolean {
    // Приводим дату к формату "YYYY-MM-DD" для сравнения только по дате
    const dateString = this.formatDateForComparison(date);
    
    // Проверяем, есть ли в массиве праздник с такой же датой
    const isHolidayFound = holidays.some(holiday => 
      this.formatDateForComparison(holiday.date) === dateString
    );
    
    if (isHolidayFound) {
      this.logInfo(`Date ${dateString} is a holiday`);
    }
    
    return isHolidayFound;
  }

  /**
   * Получает информацию о празднике для указанной даты
   * @param date Дата для проверки
   * @param holidays Массив праздников для проверки
   * @returns Объект праздника или undefined, если дата не является праздником
   */
  public getHolidayInfo(date: Date, holidays: IHoliday[]): IHoliday | undefined {
    // Приводим дату к формату для сравнения
    const dateString = this.formatDateForComparison(date);
    
    // Ищем праздник с такой же датой
    const holidayInfo = holidays.find(holiday => 
      this.formatDateForComparison(holiday.date) === dateString
    );
    
    if (holidayInfo) {
      this.logInfo(`Found holiday info for ${dateString}: ${holidayInfo.title}`);
    }
    
    return holidayInfo;
  }

  /**
   * УПРОЩЕНО: Форматирует дату для сравнения (только год-месяц-день)
   * Удалена сложная логика с часовыми поясами - теперь используем только компоненты даты
   * @param date Дата для форматирования
   * @returns Строка в формате "YYYY-MM-DD"
   */
  private formatDateForComparison(date: Date): string {
    // УПРОЩЕНО: Используем локальные компоненты даты без учета времени
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  /**
   * ИСПРАВЛЕНО: Форматирует дату для использования в фильтре запроса (Date-only формат)
   * @param date Дата для форматирования
   * @returns Строка даты в формате для фильтра SharePoint (Date-only)
   */
  private formatDateForFilter(date: Date): string {
    // ИСПРАВЛЕНО: Формат для Date-only поля в SharePoint
    // Используем локальные компоненты даты для избежания проблем с часовыми поясами
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Возвращаем в формате YYYY-MM-DD (без времени)
    const formattedDate = `${year}-${month}-${day}`;
    
    this.logInfo(`Formatted date for filter: ${date.toLocaleDateString()} -> ${formattedDate}`);
    
    return formattedDate;
  }

  /**
   * ОБНОВЛЕНО: Преобразует сырые данные из SharePoint в массив объектов IHoliday
   * Улучшена обработка Date-only формата
   * @param items Сырые данные из SharePoint
   * @returns Массив объектов IHoliday
   */
  private mapToHolidays(items: IRawHolidayItem[]): IHoliday[] {
    return items
      .map(item => {
        const fields = item.fields || {};
        
        try {
          // Проверяем наличие всех необходимых полей
          if (!fields.Title || !fields.Date || !fields.YearOfHolidays) {
            this.logError(`Missing required fields for holiday item ${item.id}. Title: ${!!fields.Title}, Date: ${!!fields.Date}, Year: ${!!fields.YearOfHolidays}`);
            return null;
          }
          
          // УЛУЧШЕНО: Обработка Date-only формата из SharePoint
          let date: Date;
          
          if (typeof fields.Date === 'string') {
            // Если приходит строка даты (например, "2025-06-15" или "2025-06-15T00:00:00Z")
            const dateStr = fields.Date;
            
            // Убираем время если оно есть, оставляем только дату
            const dateOnlyStr = dateStr.split('T')[0];
            
            // Создаем дату из компонентов для избежания проблем с часовыми поясами
            const dateParts = dateOnlyStr.split('-');
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // месяцы в JS 0-based
              const day = parseInt(dateParts[2]);
              
              date = new Date(year, month, day);
            } else {
              // Fallback на стандартный парсинг
              date = new Date(dateStr);
            }
          } else {
            // Если уже объект Date
            date = new Date(fields.Date);
          }
          
          // Проверяем валидность даты
          if (isNaN(date.getTime())) {
            this.logError(`Invalid date format for holiday item ${item.id}: ${fields.Date}`);
            return null;
          }
          
          // Преобразуем строку года в число
          const yearOfHolidays = parseInt(fields.YearOfHolidays);
          if (isNaN(yearOfHolidays)) {
            this.logError(`Invalid year format for holiday item ${item.id}: ${fields.YearOfHolidays}`);
            return null;
          }
          
          // Создаем объект IHoliday
          const holiday: IHoliday = {
            id: item.id.toString(),
            title: fields.Title.toString(),
            date: date,
            yearOfHolidays: yearOfHolidays
          };
          
          this.logInfo(`Mapped holiday: ${holiday.title} on ${this.formatDateForComparison(holiday.date)}`);
          
          return holiday;
        } catch (error) {
          this.logError(`Error processing holiday item ${item.id}: ${error}`);
          return null;
        }
      })
      .filter(holiday => holiday !== null) as IHoliday[]; // Фильтруем null элементы
  }
  
  /**
   * Логирование информационных сообщений
   * @param message Сообщение для логирования
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }
  
  /**
   * Логирование сообщений об ошибках
   * @param message Сообщение об ошибке для логирования
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}