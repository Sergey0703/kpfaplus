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
* ИСПРАВЛЕНО: Работа с Date-only полем с правильной обработкой UTC midnight для устранения timezone shifts
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
   this.logInfo("DaysOfLeavesService initialized with FIXED UTC midnight Date-only processing");
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
     
     this.logInfo(`FIXED: Fetching leaves for year: ${year}, month: ${month}, staff: ${staffMemberId}, manager: ${managerId}, group: ${staffGroupId}`);
     
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
     
     // ИСПРАВЛЕНО: Правильное вычисление границ месяца с UTC midnight
     const firstDayOfMonth = new Date(year, month - 1, 1);
     const lastDayOfMonth = new Date(year, month, 0);
     
     // ИСПРАВЛЕНО: Форматируем даты для фильтрации с UTC midnight format
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
     
     // ИСПРАВЛЕНО: Модифицированное условие для Date и Date2 с UTC midnight format
     // Период отпуска пересекается с выбранным месяцем ИЛИ отпуск не имеет даты окончания (открытый отпуск)
     // Дата начала <= последний день месяца И (дата окончания >= первый день месяца ИЛИ дата окончания не задана/null)
     filter += ` and fields/Date le '${lastDayStr}' and (fields/Date2 ge '${firstDayStr}' or fields/Date2 eq null)`;
     
     // НЕ добавляем фильтр по Deleted - пусть клиент сам фильтрует
     // filter += ` and (fields/Deleted eq null or fields/Deleted ne 1)`;
     // Теперь загружаем ВСЕ записи (и активные, и удаленные) для клиентской фильтрации
     
     this.logInfo(`FIXED: Using filter with UTC midnight format: ${filter}`);
     this.logInfo(`FIXED: Date range: ${firstDayOfMonth.toLocaleDateString()} - ${lastDayOfMonth.toLocaleDateString()}`);
     
     // Выполняем запрос к SharePoint с фильтром на сервере
     const items = await this._remoteSiteService.getListItems(
       this._listName,
       true, // expandFields
       filter,
       { field: "Date", ascending: true } // сортировка по дате начала
     );
     
     this.logInfo(`FIXED: Retrieved ${items.length} leave days with server-side filtering and UTC midnight`);
     
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
     
     // ИСПРАВЛЕНО: Преобразуем данные из SharePoint в формат ILeaveDay с UTC midnight parsing
     const leaveDays = this.mapToLeaveDays(items);
     
     // Логируем результаты преобразования
     this.logInfo(`[DEBUG] FIXED: Mapped ${leaveDays.length} leave days with UTC midnight parsing`);
     if (leaveDays.length > 0) {
       leaveDays.forEach((leaveDay, index) => {
         this.logInfo(`[DEBUG] FIXED: Mapped leave #${index + 1} (ID: ${leaveDay.id}): ${this.formatDateForDisplay(leaveDay.startDate)} - ${leaveDay.endDate ? this.formatDateForDisplay(leaveDay.endDate) : 'ongoing'}, typeOfLeave=${leaveDay.typeOfLeave}, title=${leaveDay.title}`);
       });
     }
     
     return leaveDays;
   } catch (error) {
     this.logError(`FIXED: Error fetching leaves with UTC midnight processing: ${error}`);
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
     this.logInfo(`FIXED: Updating leave with UTC midnight format, ID: ${leaveId}`);
     
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
     
     // ИСПРАВЛЕНО: Обработка Date-only формата для дат с UTC midnight
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
     
     this.logInfo(`FIXED: Prepared update data with UTC midnight: ${JSON.stringify(itemData, null, 2)}`);
     
     // Используем метод updateListItem из RemoteSiteService
     const success = await this._remoteSiteService.updateListItem(
       this._listName,
       leaveIdNumber,
       itemData
     );
     
     if (success) {
       this.logInfo(`FIXED: Successfully updated leave with UTC midnight format, ID: ${leaveId}`);
       return true;
     } else {
       throw new Error(`Failed to update leave, ID: ${leaveId}`);
     }
   } catch (error) {
     this.logError(`FIXED: Error updating leave: ${error}`);
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
     this.logInfo(`FIXED: Creating new leave with UTC midnight format`);
     
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
     
     // ИСПРАВЛЕНО: Добавляем дату окончания в UTC midnight формате, если она есть
     if (leaveData.endDate) {
       itemData.Date2 = this.formatDateForSharePoint(leaveData.endDate);
     }
     
     this.logInfo(`FIXED: Prepared create data with UTC midnight: ${JSON.stringify(itemData, null, 2)}`);
     
     try {
       // Создаем новый элемент через RemoteSiteService, передавая имя списка
       const response = await this._remoteSiteService.addListItem(
         this._listName, // Передаем имя списка, а не ID
         itemData
       );
       
       if (response && response.id) {
         const newLeaveId = String(response.id);
         this.logInfo(`FIXED: Created new leave with UTC midnight format, ID: ${newLeaveId}`);
         return newLeaveId;
       } else {
         throw new Error('Failed to get ID from the created item');
       }
     } catch (createError) {
       this.logError(`FIXED: Error creating new leave: ${createError}`);
       throw createError;
     }
   } catch (error) {
     this.logError(`FIXED: Error creating leave: ${error}`);
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
  * ИСПРАВЛЕНО: Проверяет, попадает ли дата в период отпуска с правильной Date-only логикой
  * @param date Дата для проверки
  * @param leaves Массив дней отпуска
  * @returns Информация об отпуске или undefined, если дата не попадает в период отпуска
  */
 public getLeaveForDate(date: Date, leaves: ILeaveDay[]): ILeaveDay | undefined {
   // ИСПРАВЛЕНО: Используем Date-only компоненты для сравнения
   return leaves.find(leave => {
     const checkDate = this.createDateOnlyFromDate(date);
     const startDate = this.createDateOnlyFromDate(leave.startDate);
     
     // Для открытых отпусков (без даты окончания)
     if (!leave.endDate) {
       // Если дата проверки больше или равна дате начала, считаем что она попадает в отпуск
       return checkDate >= startDate;
     }
     
     // Для закрытых отпусков с определенной датой окончания
     const endDate = this.createDateOnlyFromDate(leave.endDate);
     
     const isInRange = checkDate >= startDate && checkDate <= endDate;
     
     if (isInRange) {
       this.logInfo(`FIXED: Date ${this.formatDateForDisplay(date)} is in leave range: ${this.formatDateForDisplay(leave.startDate)} - ${this.formatDateForDisplay(leave.endDate)}`);
     }
     
     return isInRange;
   });
 }

 /**
  * ДОБАВЛЕНО: Создает Date-only объект из существующей даты
  * @param date Исходная дата
  * @returns Date объект с нулевым временем
  */
 private createDateOnlyFromDate(date: Date): Date {
   return new Date(date.getFullYear(), date.getMonth(), date.getDate());
 }

 /**
  * ДОБАВЛЕНО: Форматирует дату для отображения
  * @param date Дата для форматирования
  * @returns Строка в формате DD.MM.YYYY
  */
 private formatDateForDisplay(date: Date): string {
   const day = date.getDate().toString().padStart(2, '0');
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const year = date.getFullYear();
   return `${day}.${month}.${year}`;
 }

  /**
  * ИСПРАВЛЕНО: Форматирует дату для использования в фильтре запроса с UTC midnight format
  * @param date Дата для форматирования
  * @returns Строка даты в формате UTC midnight для фильтра SharePoint
  */
 private formatDateForFilter(date: Date): string {
   // ИСПРАВЛЕНО: Используем тот же UTC midnight формат что и для сохранения
   const year = date.getFullYear();
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const day = date.getDate().toString().padStart(2, '0');
   
   // ИСПРАВЛЕНО: Отправляем как UTC полночь с явным Z для предотвращения timezone конверсии
   const formattedDate = `${year}-${month}-${day}T00:00:00.000Z`;
   
   this.logInfo(`FIXED: Formatted date for filter: ${date.toLocaleDateString()} -> ${formattedDate}`);
   
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
   
   this.logInfo(`FIXED: Formatted date for SharePoint: ${date.toLocaleDateString()} -> ${formattedDate}`);
   
   return formattedDate;
 }

 /**
  * ИСПРАВЛЕНО: Парсит дату из SharePoint Date-only поля с правильной обработкой UTC midnight
  * @param dateString Строка даты из SharePoint
  * @returns Date объект или undefined если парсинг не удался
  */
 private parseSharePointDateOnly(dateString: string): Date | undefined {
   if (!dateString) return undefined;

   try {
     this.logInfo(`FIXED: Parsing SharePoint Date-only: "${dateString}"`);
     
     // Убираем время если оно есть, оставляем только дату
     const dateOnlyStr = dateString.split('T')[0];
     this.logInfo(`FIXED: Date after splitting on T: "${dateOnlyStr}"`);
     
     // Создаем дату из компонентов для избежания проблем с часовыми поясами
     const dateParts = dateOnlyStr.split('-');
     if (dateParts.length === 3) {
       const year = parseInt(dateParts[0]);
       const month = parseInt(dateParts[1]) - 1; // месяцы в JS 0-based
       const day = parseInt(dateParts[2]);
       
       // ИСПРАВЛЕНО: Создаем Date-only объект в локальном времени
       const parsedDate = new Date(year, month, day);
       this.logInfo(`FIXED: Created date from components: ${this.formatDateForDisplay(parsedDate)} (Year: ${year}, Month: ${month}, Day: ${day})`);
       
       if (isNaN(parsedDate.getTime())) {
         this.logError(`FIXED: Invalid date created from components: ${dateString}`);
         return undefined;
       }
       
       return parsedDate;
     } else {
       this.logError(`FIXED: Invalid date format, expected YYYY-MM-DD: ${dateString}`);
       return undefined;
     }
   } catch (error) {
     this.logError(`FIXED: Error parsing SharePoint Date-only: ${error}`);
     return undefined;
   }
 }

 /**
  * ИСПРАВЛЕНО: Преобразует сырые данные из SharePoint в массив объектов ILeaveDay
  * Использует правильную обработку Date-only формата с UTC midnight parsing
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

         // ИСПРАВЛЕНО: Используем новый метод парсинга Date-only с UTC midnight
         const startDate = this.parseSharePointDateOnly(fields.Date);
         if (!startDate) {
           this.logError(`Invalid start date format for leave item ${typedItem.id}: ${fields.Date}`);
           return undefined;
         }

         // ИСПРАВЛЕНО: Используем тот же подход для endDate (Date2)
         let endDate: Date | undefined;
         if (fields.Date2) {
           endDate = this.parseSharePointDateOnly(fields.Date2);
           if (!endDate) {
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

         this.logInfo(`[DEBUG] FIXED: Final mapped leave: ID=${result.id}, startDate=${this.formatDateForDisplay(result.startDate)}, endDate=${result.endDate ? this.formatDateForDisplay(result.endDate) : 'undefined'}, typeOfLeave=${result.typeOfLeave}`);
         
         return result;
       } catch (error) {
         this.logError(`FIXED: Error processing leave item ${(item as {id?: string | number})?.id || 'unknown'}: ${error}`);
         return undefined;
       }
     });
   
   // Фильтруем undefined элементы и возвращаем массив ILeaveDay
   const filteredResults = mappedItems.filter((item): item is ILeaveDay => item !== undefined);
   
   this.logInfo(`FIXED: Successfully mapped ${filteredResults.length} leave days with UTC midnight parsing`);
   return filteredResults;
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
  * Очищает экземпляр сервиса (для тестирования)
  */
 public static clearInstance(): void {
   DaysOfLeavesService._instance = undefined as unknown as DaysOfLeavesService;
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