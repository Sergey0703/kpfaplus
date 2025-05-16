// src/webparts/kpfaplus/services/DaysOfLeavesService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

// Интерфейс для дней отпуска
export interface ILeaveDay {
  id: string;
  title: string;
  startDate: Date;   // Дата начала отпуска (поле Date в SharePoint)
  endDate?: Date;    // Дата окончания отпуска (поле Date2 в SharePoint), может быть не задана для открытых отпусков
  staffMemberId: number;
  managerId: number;
  staffGroupId: number;
  typeOfLeave: number;
  created: Date;
  createdBy: string;
  deleted: boolean;
}

// Интерфейс для необработанных данных из SharePoint
interface IRawLeaveDayItem {
  id: string | number;
  fields?: {
    Title?: string;
    Date?: string; // Дата начала в строковом формате
    Date2?: string; // Дата окончания в строковом формате
    StaffMember?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffMemberLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffMemberLookupId?: number;
    Manager?: { Id?: number; Title?: string; [key: string]: unknown };
    ManagerLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    ManagerLookupId?: number;
    StaffGroup?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffGroupLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffGroupLookupId?: number;
    TypeOfLeave?: number;
    Created?: string;
    CreatedBy?: string;
    "Created By"?: string;
    Deleted?: number | boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Сервис для работы со списком дней отпуска в SharePoint
 */
export class DaysOfLeavesService {
  private static _instance: DaysOfLeavesService;
  private _listName: string = "DaysOfLeaves";
  private _logSource: string = "DaysOfLeavesService";
  private _remoteSiteService: RemoteSiteService;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    // Инициализация RemoteSiteService для работы с удаленным сайтом
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("DaysOfLeavesService initialized with RemoteSiteService");
  }

  /**
   * Получение экземпляра сервиса (Singleton паттерн)
   * @param context Контекст веб-части
   * @returns Экземпляр DaysOfLeavesService
   */
  public static getInstance(context: WebPartContext): DaysOfLeavesService {
    if (!DaysOfLeavesService._instance) {
      DaysOfLeavesService._instance = new DaysOfLeavesService(context);
    }
    return DaysOfLeavesService._instance;
  }

  /**
   * Получает дни отпуска для указанного месяца и года с серверной фильтрацией
   * @param date Дата для определения месяца и года
   * @param staffMemberId ID сотрудника
   * @param managerId ID менеджера
   * @param staffGroupId ID группы
   * @returns Promise с массивом дней отпуска
   */
  public async getLeavesForMonthAndYear(
    date: Date,
    staffMemberId: number,
    managerId: number,
    staffGroupId: number
  ): Promise<ILeaveDay[]> {
    try {
      const year = date.getFullYear();
      const month = date.getMonth() + 1; // +1 потому что getMonth() возвращает 0-11
      
      this.logInfo(`Fetching leaves for year: ${year}, month: ${month}, staff: ${staffMemberId}, manager: ${managerId}, group: ${staffGroupId}`);
      
      try {
        // Сначала пробуем получить список всех отпусков без фильтрации
        // Это поможет определить структуру полей
        const sampleItems = await this._remoteSiteService.getListItems(
          this._listName,
          true, // expandFields
          undefined,
          { field: "Date", ascending: true }
        );
        
        this.logInfo(`Retrieved ${sampleItems.length} sample items to analyze field structure`);
        
        if (sampleItems.length > 0) {
          const sampleItem = sampleItems[0];
          this.logInfo(`Sample item structure: ${JSON.stringify(sampleItem, null, 2)}`);
        }
      } catch (sampleError) {
        this.logError(`Error getting sample items: ${sampleError}`);
        // Продолжаем выполнение, так как это только для отладки
      }
      
      // Формируем строки с первым и последним днем месяца для фильтрации
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      
      // Форматируем даты в ISO строки для фильтрации
      const firstDayStr = this.formatDateForFilter(firstDayOfMonth);
      const lastDayStr = this.formatDateForFilter(lastDayOfMonth);
      
      // Строим фильтр для запроса
      // МОДИФИЦИРОВАННЫЙ ФИЛЬТР:
      // 1. Дата начала <= последний день месяца И (дата окончания >= первый день месяца ИЛИ дата окончания не задана)
      // Это позволит учесть отпуска без даты окончания
      
      let filter = `fields/StaffMemberLookupId eq ${staffMemberId}`;
      
      // Добавляем фильтр по Manager, если указан
      if (managerId) {
        filter += ` and fields/ManagerLookupId eq ${managerId}`;
      }
      
      // Добавляем фильтр по StaffGroup, если указан
      if (staffGroupId) {
        filter += ` and fields/StaffGroupLookupId eq ${staffGroupId}`;
      }
      
      // Модифицированное условие для Date и Date2
      // Период отпуска пересекается с выбранным месяцем ИЛИ отпуск не имеет даты окончания (открытый отпуск)
      // Дата начала <= последний день месяца И (дата окончания >= первый день месяца ИЛИ дата окончания не задана/null)
      filter += ` and fields/Date le '${lastDayStr}' and (fields/Date2 ge '${firstDayStr}' or fields/Date2 eq null)`;
      
      // Добавляем фильтр по Deleted
      filter += ` and (fields/Deleted eq null or fields/Deleted ne 1)`;
      
      this.logInfo(`Using filter: ${filter}`);
      
      // Выполняем запрос к SharePoint с фильтром на сервере
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        filter,
        { field: "Date", ascending: true } // сортировка по дате начала
      );
      
      this.logInfo(`Retrieved ${items.length} leave days with server-side filtering`);
      
      // Преобразуем данные из SharePoint в формат ILeaveDay
      const leaveDays = this.mapToLeaveDays(items);
      
      return leaveDays;
    } catch (error) {
      this.logError(`Error fetching leaves: ${error}`);
      return [];
    }
  }

  /**
   * Проверяет, находится ли дата в период отпуска
   * @param date Дата для проверки
   * @param leaves Массив дней отпуска
   * @returns true, если дата находится в период отпуска, иначе false
   */
  public isDateOnLeave(date: Date, leaves: ILeaveDay[]): boolean {
    return this.getLeaveForDate(date, leaves) !== undefined;
  }

  /**
   * Проверяет, попадает ли дата в период отпуска
   * @param date Дата для проверки
   * @param leaves Массив дней отпуска
   * @returns Информация об отпуске или undefined, если дата не попадает в период отпуска
   */
  public getLeaveForDate(date: Date, leaves: ILeaveDay[]): ILeaveDay | undefined {
    // Проверяем, попадает ли дата в диапазон между startDate и endDate
    return leaves.find(leave => {
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0); // Нормализуем время
      
      const startDate = new Date(leave.startDate);
      startDate.setHours(0, 0, 0, 0);
      
      // Для открытых отпусков (без даты окончания)
      if (!leave.endDate) {
        // Если дата проверки больше или равна дате начала, считаем что она попадает в отпуск
        return checkDate >= startDate;
      }
      
      // Для закрытых отпусков с определенной датой окончания
      const endDate = new Date(leave.endDate);
      endDate.setHours(0, 0, 0, 0);
      
      return checkDate >= startDate && checkDate <= endDate;
    });
  }

  /**
   * Форматирует дату для использования в фильтре запроса
   * @param date Дата для форматирования
   * @returns Строка даты в формате для фильтра SharePoint
   */
  private formatDateForFilter(date: Date): string {
    // Формат ISO для SharePoint: YYYY-MM-DDT00:00:00Z
    return date.toISOString().split('T')[0] + 'T00:00:00Z';
  }

  /**
   * Преобразует данные из SharePoint в массив объектов ILeaveDay
   * @param items Данные из SharePoint
   * @returns Массив объектов ILeaveDay
   */
  private mapToLeaveDays(items: unknown[]): ILeaveDay[] {
    // Используем промежуточный массив, который может содержать null
    const mappedItems = items
      .map((item): ILeaveDay | null => {
        try {
          const typedItem = item as IRawLeaveDayItem;
          const fields = typedItem.fields || {};
          
          // Проверка наличия обязательных полей
          if (!fields.Date) {
            this.logError(`Missing required date field for leave item ${typedItem.id}`);
            return null;
          }
          
          // Преобразуем строку даты начала в объект Date
          const startDate = new Date(fields.Date);
          
          if (isNaN(startDate.getTime())) {
            this.logError(`Invalid date format for leave item ${typedItem.id}`);
            return null;
          }
          
          // Обработка случая, когда дата окончания не задана (открытый отпуск)
          let endDate: Date | undefined;
          
          if (fields.Date2) {
            // Если есть дата окончания, преобразуем ее
            endDate = new Date(fields.Date2);
            
            if (isNaN(endDate.getTime())) {
              this.logError(`Invalid end date format for leave item ${typedItem.id}, using undefined`);
              endDate = undefined;
            }
          } else {
            // Если дата окончания не задана, оставляем ее как undefined
            this.logInfo(`Open leave detected for item ${typedItem.id} - no end date specified`);
            endDate = undefined;
          }
          
          // Получаем ID из lookup полей
          const staffMemberId = this.getLookupId(fields.StaffMember) || 
                               this.getLookupId(fields.StaffMemberLookup) || 
                               fields.StaffMemberLookupId || 0;
          
          const managerId = this.getLookupId(fields.Manager) || 
                           this.getLookupId(fields.ManagerLookup) || 
                           fields.ManagerLookupId || 0;
          
          const staffGroupId = this.getLookupId(fields.StaffGroup) || 
                              this.getLookupId(fields.StaffGroupLookup) || 
                              fields.StaffGroupLookupId || 0;
          
          // Создаем объект ILeaveDay
          return {
            id: String(typedItem.id),
            title: String(fields.Title || ''),
            startDate: startDate,
            endDate: endDate, // Может быть undefined для открытых отпусков
            staffMemberId: Number(staffMemberId),
            managerId: Number(managerId),
            staffGroupId: Number(staffGroupId),
            typeOfLeave: Number(fields.TypeOfLeave || 0),
            created: fields.Created ? new Date(fields.Created) : new Date(),
            createdBy: String(fields.CreatedBy || fields['Created By'] || ''),
            deleted: Boolean(fields.Deleted === 1 || fields.Deleted === true)
          };
        } catch (error) {
          this.logError(`Error processing leave item ${(item as {id?: string | number})?.id || 'unknown'}: ${error}`);
          return null;
        }
      });
    
    // Фильтруем null элементы и возвращаем массив ILeaveDay
    return mappedItems.filter((item): item is ILeaveDay => item !== null);
  }

  /**
   * Получает ID из lookup поля
   * @param lookup Lookup поле из SharePoint
   * @returns ID или undefined, если поле отсутствует
   */
  private getLookupId(lookup?: unknown): number | undefined {
    if (!lookup) return undefined;
    
    // Если lookup - число или строка, возвращаем его как число
    if (typeof lookup === 'number') return lookup;
    if (typeof lookup === 'string') return parseInt(lookup, 10);
    
    // Если lookup - объект с полем Id, LookupId или id
    if (typeof lookup === 'object' && lookup !== null) {
      const lookupObj = lookup as Record<string, unknown>;
      if ('Id' in lookupObj && lookupObj.Id !== undefined) return Number(lookupObj.Id);
      if ('id' in lookupObj && lookupObj.id !== undefined) return Number(lookupObj.id);
      if ('LookupId' in lookupObj && lookupObj.LookupId !== undefined) return Number(lookupObj.LookupId);
      if ('lookupId' in lookupObj && lookupObj.lookupId !== undefined) return Number(lookupObj.lookupId);
    }
    
    return undefined;
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