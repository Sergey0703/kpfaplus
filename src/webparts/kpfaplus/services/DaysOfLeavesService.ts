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
    Date?: string; // Дата начала в строковом формате (Date-only)
    Date2?: string; // Дата окончания в строковом формате (Date-only)
    StaffMember?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffMemberLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffMemberLookupId?: number;
    Manager?: { Id?: number; Title?: string; [key: string]: unknown };
    ManagerLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    ManagerLookupId?: number;
    StaffGroup?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffGroupLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    StaffGroupLookupId?: number;
    TypeOfLeave?: { Id?: number; Title?: string; [key: string]: unknown } | number | string;
    TypeOfLeaveLookup?: { Id?: number; Title?: string; [key: string]: unknown };
    TypeOfLeaveLookupId?: number;
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
 * ОБНОВЛЕНО: Работа с Date-only полем (без времени) для устранения проблем с часовыми поясами
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
    this.logInfo("DaysOfLeavesService initialized with RemoteSiteService (Date-only mode)");
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
          
          // Новый код: Анализ структуры TypeOfLeave поля
          if (sampleItem.fields && sampleItem.fields.TypeOfLeave) {
            this.logInfo(`[DEBUG] TypeOfLeave field structure in sample: ${JSON.stringify(sampleItem.fields.TypeOfLeave, null, 2)}`);
            this.logInfo(`[DEBUG] TypeOfLeave field type: ${typeof sampleItem.fields.TypeOfLeave}`);
          }
          
          // Проверяем наличие TypeOfLeaveLookupId
          if (sampleItem.fields && sampleItem.fields.TypeOfLeaveLookupId !== undefined) {
            this.logInfo(`[DEBUG] TypeOfLeaveLookupId found in sample: ${sampleItem.fields.TypeOfLeaveLookupId}`);
          }
        }
      } catch (sampleError) {
        this.logError(`Error getting sample items: ${sampleError}`);
        // Продолжаем выполнение, так как это только для отладки
      }
      
      // ИСПРАВЛЕНО: Правильное вычисление границ месяца
      const firstDayOfMonth = new Date(year, month - 1, 1);
      const lastDayOfMonth = new Date(year, month, 0);
      
      // Форматируем даты для фильтрации (Date-only формат)
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
      
      // НЕ добавляем фильтр по Deleted - пусть клиент сам фильтрует
      // filter += ` and (fields/Deleted eq null or fields/Deleted ne 1)`;
      // Теперь загружаем ВСЕ записи (и активные, и удаленные) для клиентской фильтрации
      
      this.logInfo(`Using filter: ${filter}`);
      this.logInfo(`Date range: ${firstDayOfMonth.toLocaleDateString()} - ${lastDayOfMonth.toLocaleDateString()}`);
      
      // Выполняем запрос к SharePoint с фильтром на сервере
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        filter,
        { field: "Date", ascending: true } // сортировка по дате начала
      );
      
      this.logInfo(`Retrieved ${items.length} leave days with server-side filtering`);
      
      // Логируем структуру полученных отпусков для диагностики проблемы с TypeOfLeave
      if (items.length > 0) {
        const sampleItem = items[0] as IRawLeaveDayItem;
        if (sampleItem.fields) {
          this.logInfo(`[DEBUG] First leave item ID: ${sampleItem.id}`);
          this.logInfo(`[DEBUG] TypeOfLeave field: ${JSON.stringify(sampleItem.fields.TypeOfLeave, null, 2)}`);
          this.logInfo(`[DEBUG] TypeOfLeave field type: ${typeof sampleItem.fields.TypeOfLeave}`);
          
          if (sampleItem.fields.TypeOfLeaveLookupId !== undefined) {
            this.logInfo(`[DEBUG] TypeOfLeaveLookupId field: ${sampleItem.fields.TypeOfLeaveLookupId}`);
          }
        }
      }
      
      // Преобразуем данные из SharePoint в формат ILeaveDay
      const leaveDays = this.mapToLeaveDays(items);
      
      // Логируем результаты преобразования
      this.logInfo(`[DEBUG] Mapped ${leaveDays.length} leave days`);
      if (leaveDays.length > 0) {
        leaveDays.forEach((leaveDay, index) => {
          this.logInfo(`[DEBUG] Mapped leave #${index + 1} (ID: ${leaveDay.id}): typeOfLeave=${leaveDay.typeOfLeave}, title=${leaveDay.title}`);
        });
      }
      
      return leaveDays;
    } catch (error) {
      this.logError(`Error fetching leaves: ${error}`);
      return [];
    }
  }

  /**
   * Помечает отпуск как удаленный (не удаляет физически)
   * @param leaveId ID отпуска
   * @returns Promise с результатом операции
   */
  public async markLeaveAsDeleted(leaveId: string): Promise<boolean> {
    try {
      this.logInfo(`Marking leave as deleted, ID: ${leaveId}`);
      
      if (!leaveId) {
        throw new Error("Leave ID is empty or invalid");
      }
      
      const leaveIdNumber = parseInt(leaveId);
      if (isNaN(leaveIdNumber)) {
        throw new Error(`Invalid leave ID format: ${leaveId}`);
      }
      
      // Используем метод updateListItem из RemoteSiteService
      const success = await this._remoteSiteService.updateListItem(
        this._listName,
        leaveIdNumber,
        {
          Deleted: 1
        }
      );
      
      if (success) {
        this.logInfo(`Successfully marked leave as deleted, ID: ${leaveId}`);
        return true;
      } else {
        throw new Error(`Failed to mark leave as deleted, ID: ${leaveId}`);
      }
    } catch (error) {
      this.logError(`Error marking leave as deleted: ${error}`);
      throw error;
    }
  }

  /**
   * Снимает отметку удаления с отпуска
   * @param leaveId ID отпуска
   * @returns Promise с результатом операции
   */
  public async markLeaveAsActive(leaveId: string): Promise<boolean> {
    try {
      this.logInfo(`Marking leave as active, ID: ${leaveId}`);
      
      if (!leaveId) {
        throw new Error("Leave ID is empty or invalid");
      }
      
      const leaveIdNumber = parseInt(leaveId);
      if (isNaN(leaveIdNumber)) {
        throw new Error(`Invalid leave ID format: ${leaveId}`);
      }
      
      // Используем метод updateListItem из RemoteSiteService
      const success = await this._remoteSiteService.updateListItem(
        this._listName,
        leaveIdNumber,
        {
          Deleted: 0
        }
      );
      
      if (success) {
        this.logInfo(`Successfully marked leave as active, ID: ${leaveId}`);
        return true;
      } else {
        throw new Error(`Failed to mark leave as active, ID: ${leaveId}`);
      }
    } catch (error) {
      this.logError(`Error marking leave as active: ${error}`);
      throw error;
    }
  }

  /**
   * Обновляет данные отпуска
   * @param leaveId ID отпуска
   * @param updateData Данные для обновления
   * @returns Promise с результатом операции
   */
  public async updateLeave(leaveId: string, updateData: Partial<ILeaveDay>): Promise<boolean> {
    try {
      this.logInfo(`Updating leave, ID: ${leaveId}`);
      
      if (!leaveId) {
        throw new Error("Leave ID is empty or invalid");
      }
      
      const leaveIdNumber = parseInt(leaveId);
      if (isNaN(leaveIdNumber)) {
        throw new Error(`Invalid leave ID format: ${leaveId}`);
      }
      
      // Подготавливаем данные для обновления в формате SharePoint
      const itemData: Record<string, unknown> = {};
      
      if (updateData.title !== undefined) {
        itemData.Title = updateData.title;
      }
      
      // ОБНОВЛЕНО: Обработка Date-only формата для дат
      if (updateData.startDate !== undefined) {
        itemData.Date = this.formatDateForSharePoint(updateData.startDate);
      }
      
      if (updateData.endDate !== undefined) {
        itemData.Date2 = updateData.endDate ? this.formatDateForSharePoint(updateData.endDate) : null;
      }
      
      if (updateData.typeOfLeave !== undefined) {
        itemData.TypeOfLeaveLookupId = updateData.typeOfLeave;
      }
      
      if (updateData.deleted !== undefined) {
        itemData.Deleted = updateData.deleted ? 1 : 0;
      }
      
      this.logInfo(`Prepared update data: ${JSON.stringify(itemData, null, 2)}`);
      
      // Используем метод updateListItem из RemoteSiteService
      const success = await this._remoteSiteService.updateListItem(
        this._listName,
        leaveIdNumber,
        itemData
      );
      
      if (success) {
        this.logInfo(`Successfully updated leave, ID: ${leaveId}`);
        return true;
      } else {
        throw new Error(`Failed to update leave, ID: ${leaveId}`);
      }
    } catch (error) {
      this.logError(`Error updating leave: ${error}`);
      throw error;
    }
  }

  /**
   * Создает новый отпуск
   * @param leaveData Данные нового отпуска
   * @returns Promise с ID нового отпуска или undefined при ошибке
   */
  public async createLeave(leaveData: Omit<ILeaveDay, 'id' | 'created' | 'createdBy'>): Promise<string | undefined> {
    try {
      this.logInfo(`Creating new leave`);
      
      // Подготавливаем данные для создания в формате SharePoint
      const itemData: Record<string, unknown> = {
        Title: leaveData.title || '',
        Date: this.formatDateForSharePoint(leaveData.startDate),
        StaffMemberLookupId: leaveData.staffMemberId,
        ManagerLookupId: leaveData.managerId,
        StaffGroupLookupId: leaveData.staffGroupId,
        TypeOfLeaveLookupId: leaveData.typeOfLeave,
        Deleted: leaveData.deleted ? 1 : 0
      };
      
      // ОБНОВЛЕНО: Добавляем дату окончания в Date-only формате, если она есть
      if (leaveData.endDate) {
        itemData.Date2 = this.formatDateForSharePoint(leaveData.endDate);
      }
      
      this.logInfo(`Prepared create data: ${JSON.stringify(itemData, null, 2)}`);
      
      try {
        // Создаем новый элемент через RemoteSiteService, передавая имя списка
        const response = await this._remoteSiteService.addListItem(
          this._listName, // Передаем имя списка, а не ID
          itemData
        );
        
        if (response && response.id) {
          const newLeaveId = String(response.id);
          this.logInfo(`Created new leave with ID: ${newLeaveId}`);
          return newLeaveId;
        } else {
          throw new Error('Failed to get ID from the created item');
        }
      } catch (createError) {
        this.logError(`Error creating new leave: ${createError}`);
        throw createError;
      }
    } catch (error) {
      this.logError(`Error creating leave: ${error}`);
      return undefined;
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
   * Форматирует дату для сравнения (только год-месяц-день)
   * @param date Дата для форматирования
   * @returns Строка в формате "YYYY-MM-DD"
   */
  private formatDateForComparison(date: Date): string {
    // Используем локальные компоненты даты без учета времени
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
    // Формат для Date-only поля в SharePoint
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
   * ИСПРАВЛЕНО: Форматирует дату для отправки в SharePoint (предотвращает timezone конверсию)
   * Использует UTC полночь для принуждения правильного сохранения Date-only полей
   * @param date Дата для форматирования
   * @returns Строка даты в формате UTC для SharePoint
   */
  private formatDateForSharePoint(date: Date): string {
    // Используем локальные компоненты даты для избежания проблем с часовыми поясами
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // ИСПРАВЛЕНО: Отправляем как UTC полночь с явным Z, чтобы предотвратить timezone конверсию SharePoint
    // Это решает известную проблему с Date-only полями в SharePoint Graph API
    const formattedDate = `${year}-${month}-${day}T00:00:00.000Z`;
    
    this.logInfo(`Formatted date for SharePoint: ${date.toLocaleDateString()} -> ${formattedDate}`);
    
    return formattedDate;
  }

  /**
   * ОБНОВЛЕНО: Преобразует сырые данные из SharePoint в массив объектов ILeaveDay
   * Использует тот же подход что и в HolidaysService для правильной обработки Date-only формата
   * @param items Данные из SharePoint
   * @returns Массив объектов ILeaveDay
   */
  private mapToLeaveDays(items: unknown[]): ILeaveDay[] {
    // Используем промежуточный массив, который может содержать undefined
    const mappedItems = items
      .map((item, index): ILeaveDay | undefined => {
        try {
          const typedItem = item as IRawLeaveDayItem;
          const fields = typedItem.fields || {};
          
          // Проверка наличия обязательных полей
          if (!fields.Date) {
            this.logError(`Missing required date field for leave item ${typedItem.id}`);
            return undefined;
          }

          // ИСПРАВЛЕНО: Используем тот же подход что и в HolidaysService для обработки Date-only формата
          let startDate: Date;
          
          // Логируем исходное значение даты
          this.logInfo(`[DEBUG] Raw startDate from SharePoint for item ${typedItem.id}: "${fields.Date}"`);
          
          if (typeof fields.Date === 'string') {
            // Если приходит строка даты (например, "2025-06-01" или "2025-06-01T00:00:00Z")
            const dateStr = fields.Date;
            
            // Убираем время если оно есть, оставляем только дату
            const dateOnlyStr = dateStr.split('T')[0];
            this.logInfo(`[DEBUG] Date after splitting on T: "${dateOnlyStr}"`);
            
            // Создаем дату из компонентов для избежания проблем с часовыми поясами
            const dateParts = dateOnlyStr.split('-');
            if (dateParts.length === 3) {
              const year = parseInt(dateParts[0]);
              const month = parseInt(dateParts[1]) - 1; // месяцы в JS 0-based
              const day = parseInt(dateParts[2]);
              
              startDate = new Date(year, month, day);
              this.logInfo(`[DEBUG] Created startDate from components: ${this.formatDateForComparison(startDate)} (Year: ${year}, Month: ${month}, Day: ${day})`);
            } else {
              // Fallback на стандартный парсинг
              startDate = new Date(dateStr);
              this.logInfo(`[DEBUG] Used fallback parsing for startDate: ${this.formatDateForComparison(startDate)}`);
            }
          } else {
            // Если уже объект Date
            startDate = new Date(fields.Date);
            this.logInfo(`[DEBUG] Converted object to startDate: ${this.formatDateForComparison(startDate)}`);
          }
          
          if (isNaN(startDate.getTime())) {
            this.logError(`Invalid start date format for leave item ${typedItem.id}: ${fields.Date}`);
            return undefined;
          }

          // ИСПРАВЛЕНО: Используем тот же подход для endDate (Date2)
          let endDate: Date | undefined;
          
          if (fields.Date2) {
            // Логируем исходное значение даты окончания
            this.logInfo(`[DEBUG] Raw endDate from SharePoint for item ${typedItem.id}: "${fields.Date2}"`);
            
            if (typeof fields.Date2 === 'string') {
              const dateStr = fields.Date2;
              const dateOnlyStr = dateStr.split('T')[0];
              this.logInfo(`[DEBUG] EndDate after splitting on T: "${dateOnlyStr}"`);
              
              const dateParts = dateOnlyStr.split('-');
              if (dateParts.length === 3) {
                const year = parseInt(dateParts[0]);
                const month = parseInt(dateParts[1]) - 1; // месяцы в JS 0-based
                const day = parseInt(dateParts[2]);
                
                endDate = new Date(year, month, day);
                this.logInfo(`[DEBUG] Created endDate from components: ${this.formatDateForComparison(endDate)} (Year: ${year}, Month: ${month}, Day: ${day})`);
              } else {
                endDate = new Date(dateStr);
                this.logInfo(`[DEBUG] Used fallback parsing for endDate: ${this.formatDateForComparison(endDate)}`);
              }
            } else {
              endDate = new Date(fields.Date2);
              this.logInfo(`[DEBUG] Converted object to endDate: ${this.formatDateForComparison(endDate)}`);
            }
            
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
          
          // ИСПРАВЛЕНО: Правильное извлечение типа отпуска (TypeOfLeave)
          let typeOfLeave = 0;
          
          // Логируем все возможные поля TypeOfLeave для диагностики
          this.logInfo(`[DEBUG] Item ${typedItem.id} TypeOfLeave analysis:`);
          
          if (fields.TypeOfLeaveLookupId !== undefined) {
            this.logInfo(`[DEBUG] - TypeOfLeaveLookupId: ${fields.TypeOfLeaveLookupId}`);
            typeOfLeave = Number(fields.TypeOfLeaveLookupId);
          }
          
          if (fields.TypeOfLeave !== undefined) {
            this.logInfo(`[DEBUG] - TypeOfLeave: ${JSON.stringify(fields.TypeOfLeave)} (${typeof fields.TypeOfLeave})`);
            
            // Обработка в зависимости от типа поля TypeOfLeave
            if (typeof fields.TypeOfLeave === 'object' && fields.TypeOfLeave !== null) {
              // Если это объект lookup, извлекаем Id
              const typeObj = fields.TypeOfLeave as { Id?: number | string, LookupId?: number | string };
              if (typeObj.Id !== undefined) {
                this.logInfo(`[DEBUG] - TypeOfLeave объект с Id: ${typeObj.Id}`);
                typeOfLeave = Number(typeObj.Id);
              } else if (typeObj.LookupId !== undefined) {
                this.logInfo(`[DEBUG] - TypeOfLeave объект с LookupId: ${typeObj.LookupId}`);
                typeOfLeave = Number(typeObj.LookupId);
              }
            } else if (typeof fields.TypeOfLeave === 'number') {
              // Если это прямое числовое значение
              this.logInfo(`[DEBUG] - TypeOfLeave число: ${fields.TypeOfLeave}`);
              typeOfLeave = fields.TypeOfLeave;
            } else if (typeof fields.TypeOfLeave === 'string') {
              // Если это строка, пробуем преобразовать в число
              this.logInfo(`[DEBUG] - TypeOfLeave строка: ${fields.TypeOfLeave}`);
              const parsed = parseInt(fields.TypeOfLeave, 10);
              if (!isNaN(parsed)) {
                typeOfLeave = parsed;
              }
            }
          }
          
          // Проверяем также TypeOfLeave.Id если TypeOfLeave - объект
          if (fields.TypeOfLeave && typeof fields.TypeOfLeave === 'object' && 'Id' in fields.TypeOfLeave) {
            const typeOfLeaveObject = fields.TypeOfLeave as { Id?: number | string };
            const typeIdValue = typeOfLeaveObject.Id;
            this.logInfo(`[DEBUG] - TypeOfLeave.Id: ${typeIdValue}`);
            
            if (typeIdValue !== undefined && typeIdValue !== null) {
              typeOfLeave = Number(typeIdValue);
            }
          }
          
          // Если TypeOfLeaveLookup присутствует, тоже используем его
          if (fields.TypeOfLeaveLookup) {
            this.logInfo(`[DEBUG] - TypeOfLeaveLookup: ${JSON.stringify(fields.TypeOfLeaveLookup)}`);
            const lookupId = this.getLookupId(fields.TypeOfLeaveLookup);
            if (lookupId !== undefined) {
              typeOfLeave = lookupId;
            }
          }
          
          this.logInfo(`[DEBUG] - Final typeOfLeave value: ${typeOfLeave}`);
          
          // Создаем объект ILeaveDay
          const result: ILeaveDay = {
            id: String(typedItem.id),
            title: String(fields.Title || ''),
            startDate: startDate,
            endDate: endDate, // Может быть undefined для открытых отпусков
            staffMemberId: Number(staffMemberId),
            managerId: Number(managerId),
            staffGroupId: Number(staffGroupId),
            typeOfLeave: typeOfLeave,
            created: fields.Created ? new Date(fields.Created) : new Date(),
            createdBy: String(fields.CreatedBy || fields['Created By'] || ''),
            deleted: Boolean(fields.Deleted === 1 || fields.Deleted === true)
          };

          this.logInfo(`[DEBUG] Final mapped leave: ID=${result.id}, startDate=${this.formatDateForComparison(result.startDate)}, endDate=${result.endDate ? this.formatDateForComparison(result.endDate) : 'undefined'}`);
          
          return result;
        } catch (error) {
          this.logError(`Error processing leave item ${(item as {id?: string | number})?.id || 'unknown'}: ${error}`);
          return undefined;
        }
      });
    
    // Фильтруем undefined элементы и возвращаем массив ILeaveDay
    return mappedItems.filter((item): item is ILeaveDay => item !== undefined);
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