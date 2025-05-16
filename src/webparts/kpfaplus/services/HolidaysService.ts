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
    this.logInfo("HolidaysService initialized with RemoteSiteService");
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
      
      // Получаем все праздники без фильтра на сервере
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        undefined, // без фильтра на сервере
        { field: "Date", ascending: true } // сортировка по дате
      );
      
      this.logInfo(`Retrieved ${items.length} total holidays from SharePoint`);
      
      // Преобразуем данные из SharePoint в формат IHoliday
      let holidays = this.mapToHolidays(items as IRawHolidayItem[]);
      
      // Фильтруем локально по году из поля Date
      holidays = holidays.filter(holiday => {
        return holiday.date.getFullYear() === year;
      });
      
      this.logInfo(`Filtered to ${holidays.length} holidays for year ${year}`);
      
      return holidays;
    } catch (error) {
      this.logError(`Error fetching holidays for year ${year}: ${error}`);
      return [];
    }
  }

  /**
   * Проверяет, является ли указанная дата праздничным днем
   * @param date Дата для проверки
   * @param holidays Массив праздников для проверки
   * @returns true, если дата является праздником, иначе false
   */
  public isHoliday(date: Date, holidays: IHoliday[]): boolean {
    // Приводим дату к формату "YYYY-MM-DD" для сравнения только по дате без времени
    const dateString = this.formatDateForComparison(date);
    
    // Проверяем, есть ли в массиве праздник с такой же датой
    return holidays.some(holiday => 
      this.formatDateForComparison(holiday.date) === dateString
    );
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
    return holidays.find(holiday => 
      this.formatDateForComparison(holiday.date) === dateString
    );
  }

  /**
   * Форматирует дату для сравнения (только год-месяц-день)
   * @param date Дата для форматирования
   * @returns Строка в формате "YYYY-MM-DD"
   */
  private formatDateForComparison(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
  }

  /**
   * Преобразует сырые данные из SharePoint в массив объектов IHoliday
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
            this.logError(`Missing required fields for holiday item ${item.id}`);
            return null;
          }
          
          // Преобразуем строку даты в объект Date
          const date = new Date(fields.Date);
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
          return {
            id: item.id.toString(),
            title: fields.Title.toString(),
            date: date,
            yearOfHolidays: yearOfHolidays
          };
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