// src/webparts/kpfaplus/services/WeeklyTimeTableService.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IDayHours } from '../models/IWeeklyTimeTable';
import { RemoteSiteService } from './RemoteSiteService';
import { IRemoteListItemResponse } from '../services';
export interface IWeeklyTimeTableUpdateItem {
  id: string;
  // Время начала
  mondayStart?: IDayHours;
  tuesdayStart?: IDayHours;
  wednesdayStart?: IDayHours;
  thursdayStart?: IDayHours;
  fridayStart?: IDayHours;
  saturdayStart?: IDayHours;
  sundayStart?: IDayHours;
  
  // Время окончания
  mondayEnd?: IDayHours;
  tuesdayEnd?: IDayHours;
  wednesdayEnd?: IDayHours;
  thursdayEnd?: IDayHours;
  fridayEnd?: IDayHours;
  saturdayEnd?: IDayHours;
  sundayEnd?: IDayHours;
  
  lunchMinutes?: string;
  contractNumber?: string;
  deleted?: number;
}

// Интерфейс для элементов недельного расписания
export interface IWeeklyTimeTableItem {
  id: string;
  fields?: Record<string, unknown>;
  NumberOfWeek?: number;
  NumberOfShift?: number;
  Title?: string;
  Deleted?: number;
  [key: string]: unknown;
}

// Интерфейс для результата создания элемента
export interface ICreateItemResult {
  id: string;
  success: boolean;
  error?: string;
}

// Интерфейс для результата обновления элемента
export interface IUpdateItemResult {
  id: string;
  success: boolean;
  error?: string;
}

// Интерфейс для данных создания нового элемента
export interface ICreateWeeklyTimeTableData {
  Title: string;
  NumberOfWeek: number;
  NumberOfShift: number;
  IdOfTemplateLookupId?: number;
  CreatorLookupId?: number;
  MondeyStartWork?: string;
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
  TimeForLunch?: number;
  Contract?: number;
  Deleted?: number;
  [key: string]: unknown;
}

/**
 * Сервис для работы с данными недельного расписания
 */
export class WeeklyTimeTableService {
  private remoteSiteService: RemoteSiteService;
  private listName: string = 'WeeklyTimeTables'; // Имя списка в SharePoint - обратите внимание на изменение имени!

  /**
   * Конструктор сервиса
   * @param context Контекст веб-части
   * @param listName Имя списка (опционально)
   */
  constructor(context: WebPartContext, listName?: string) {
    this.remoteSiteService = RemoteSiteService.getInstance(context);
    
    if (listName) {
      this.listName = listName;
    }
  }

/**
 * Получение данных недельного расписания для контракта
 * @param contractId ID контракта
 * @returns Массив данных недельного расписания
 */
public async getWeeklyTimeTableByContractId(contractId: string): Promise<IRemoteListItemResponse[]> {
  try {
    // Используем RemoteSiteService вместо прямого вызова PnP JS
    // Изменяем фильтр, чтобы получать все записи, включая удаленные
    const filter = `fields/IdOfTemplateLookupId eq ${contractId}`;
    
    console.log(`Getting weekly time table for contract ID: ${contractId} with filter: ${filter}`);
    
    // Поскольку метод поддерживает только одно поле сортировки,
    // используем NumberOfWeek как основное поле сортировки
    const orderBy = { field: "fields/NumberOfWeek", ascending: true };
    
    console.log(`Getting weekly time table for contract ID: ${contractId} with ordering by ${orderBy.field}`);
    
    const items = await this.remoteSiteService.getListItems(
      this.listName,
      true, // expandFields
      filter,
      orderBy // одно поле сортировки
    );
    
    console.log(`Retrieved ${items.length} weekly time table items. Filter removed "Deleted eq 0" condition to get all items.`);
    
    // Поскольку на сервере мы можем отсортировать только по одному полю,
    // дополнительную сортировку делаем на клиенте
    items.sort((a, b) => {
      // Сначала по IdOfTemplateLookupId
      const templateA = Number(a.fields?.IdOfTemplateLookupId || 0);
      const templateB = Number(b.fields?.IdOfTemplateLookupId || 0);
      
      if (templateA !== templateB) {
        return templateA - templateB;
      }
      
      // Затем по NumberOfWeek
      const weekA = Number(a.fields?.NumberOfWeek || 0);
      const weekB = Number(b.fields?.NumberOfWeek || 0);
      
      if (weekA !== weekB) {
        return weekA - weekB;
      }
      
      // И наконец по NumberOfShift
      const shiftA = Number(a.fields?.NumberOfShift || 0);
      const shiftB = Number(b.fields?.NumberOfShift || 0);
      
      return shiftA - shiftB;
    });
    
    return items;
  } catch (err) {
    console.error('Error getting weekly time table by contract ID:', err);
    throw err;
  }
}

  public async updateWeeklyTimeTableItem(item: IWeeklyTimeTableUpdateItem): Promise<boolean> {
    try {
      // Формируем объект с полями для обновления - напрямую, без вложенного объекта fields
      const updateData: Record<string, unknown> = {};
      
      // Обратите внимание, что в SharePoint для понедельника есть опечатка: MondeyStartWork
      if (item.mondayStart) {
        updateData.MondeyStartWork = this.formatTimeForSharePoint(item.mondayStart);
      }
      if (item.tuesdayStart) {
        updateData.TuesdayStartWork = this.formatTimeForSharePoint(item.tuesdayStart);
      }
      if (item.wednesdayStart) {
        updateData.WednesdayStartWork = this.formatTimeForSharePoint(item.wednesdayStart);
      }
      if (item.thursdayStart) {
        updateData.ThursdayStartWork = this.formatTimeForSharePoint(item.thursdayStart);
      }
      if (item.fridayStart) {
        updateData.FridayStartWork = this.formatTimeForSharePoint(item.fridayStart);
      }
      if (item.saturdayStart) {
        updateData.SaturdayStartWork = this.formatTimeForSharePoint(item.saturdayStart);
      }
      if (item.sundayStart) {
        updateData.SundayStartWork = this.formatTimeForSharePoint(item.sundayStart);
      }
      
      // Обновляем поля времени окончания работы для каждого дня
      // Обратите внимание на MondayEndWork (без опечатки)
      if (item.mondayEnd) {
        updateData.MondayEndWork = this.formatTimeForSharePoint(item.mondayEnd);
      }
      if (item.tuesdayEnd) {
        updateData.TuesdayEndWork = this.formatTimeForSharePoint(item.tuesdayEnd);
      }
      if (item.wednesdayEnd) {
        updateData.WednesdayEndWork = this.formatTimeForSharePoint(item.wednesdayEnd);
      }
      if (item.thursdayEnd) {
        updateData.ThursdayEndWork = this.formatTimeForSharePoint(item.thursdayEnd);
      }
      if (item.fridayEnd) {
        updateData.FridayEndWork = this.formatTimeForSharePoint(item.fridayEnd);
      }
      if (item.saturdayEnd) {
        updateData.SaturdayEndWork = this.formatTimeForSharePoint(item.saturdayEnd);
      }
      if (item.sundayEnd) {
        updateData.SundayEndWork = this.formatTimeForSharePoint(item.sundayEnd);
      }
      
      // Обновляем время обеда
      if (item.lunchMinutes !== undefined && item.lunchMinutes !== null) {
        // Убедимся, что значение всегда передается как число
        updateData.TimeForLunch = parseInt(item.lunchMinutes);
      }
      
      // Обновляем номер контракта
      if (item.contractNumber) {
        updateData.Contract = parseInt(item.contractNumber);
      }
      
      console.log('Updating item with data:', updateData);
      
      // Используем updateListItem из RemoteSiteService
      // Преобразуем строковый ID в число перед передачей
      return await this.remoteSiteService.updateListItem(
        this.listName,
        parseInt(item.id), // Преобразуем строку в число
        updateData
      );
    } catch (err) {
      console.error('Error updating weekly time table item:', err);
      throw err;
    }
  }
  
  /**
   * Форматирование времени для сохранения в SharePoint
   * @param time Объект с часами и минутами
   * @returns Строка даты в формате ISO для SharePoint
   */
  private formatTimeForSharePoint(time: IDayHours): string {
    // Базовая дата (1 января 2025 года)
    const baseDate = '2025-01-01';
    
    // Форматируем время в строку для SharePoint
    return `${baseDate}T${time.hours}:${time.minutes}:00Z`;
  }
  
  /**
   * Массовое обновление элементов недельного расписания
   * @param items Массив данных для обновления
   * @returns Результаты операций обновления
   */
  public async batchUpdateWeeklyTimeTable(items: IWeeklyTimeTableUpdateItem[]): Promise<IUpdateItemResult[]> {
    try {
      // Массив для результатов операций
      const results: IUpdateItemResult[] = [];
      
      // Обновляем каждый элемент по отдельности
      for (const item of items) {
        try {
          const success = await this.updateWeeklyTimeTableItem(item);
results.push({
  id: item.id,
  success: success
});
        } catch (itemErr: unknown) {
          console.error(`Error updating item ${item.id}:`, itemErr);
          results.push({
            id: item.id,
            success: false,
            error: itemErr instanceof Error ? itemErr.message : 'Unknown error'
          });
        }
      }
      
      return results;
    } catch (err) {
      console.error('Error batch updating weekly time table:', err);
      throw err;
    }
  }

/**
 * Создание нового элемента недельного расписания
 * @param item Данные для создания
 * @param contractId ID контракта
 * @param currentUserId ID текущего пользователя из списка Staff
 * @param numberOfWeek Номер недели (опционально)
 * @param numberOfShift Номер смены (опционально)
 * @returns ID созданного элемента
 */
public async createWeeklyTimeTableItem(
  item: IWeeklyTimeTableUpdateItem, 
  contractId: string, 
  currentUserId: number | string,
  numberOfWeek?: number,
  numberOfShift?: number
): Promise<string> {
  try {
    // Определяем номер недели
    const weekNumber = numberOfWeek !== undefined ? 
      numberOfWeek : 
      Math.floor(new Date().getDate() / 7) + 1;
    
    // Определяем номер смены
    const shiftNumber = numberOfShift !== undefined ? numberOfShift : 1;
    
    // Формируем объект с полями для создания
    const createData: ICreateWeeklyTimeTableData = {
      Title: `Week ${weekNumber}`,
      NumberOfWeek: weekNumber,
      NumberOfShift: shiftNumber,
      Deleted: 0
    };
    
    // Проверяем и преобразуем contractId в число для поля IdOfTemplateLookupId
    if (contractId) {
      try {
        const contractIdNum = parseInt(contractId);
        if (!isNaN(contractIdNum)) {
          createData.IdOfTemplateLookupId = contractIdNum;
          console.log(`Setting IdOfTemplateLookupId to ${contractIdNum}`);
        } else {
          console.warn(`Invalid contract ID format: ${contractId}`);
        }
      } catch (parseError) {
        console.warn(`Error parsing contract ID: ${parseError}`);
      }
    } else {
      console.warn('No contract ID provided for weekly time table item');
    }
    
    // Добавляем Creator - ссылку на текущего пользователя
    if (currentUserId) {
      // Преобразуем currentUserId в число, если это строка
      let creatorId: number;
      
      if (typeof currentUserId === 'string') {
        try {
          creatorId = parseInt(currentUserId);
          if (isNaN(creatorId)) {
            console.warn(`Cannot parse creator ID string: ${currentUserId}`);
            creatorId = 0;
          }
        } catch (parseError) {
          console.warn(`Error parsing creator ID: ${parseError}`);
          creatorId = 0;
        }
      } else {
        creatorId = currentUserId;
      }
      
      if (creatorId > 0) {
        // Добавляем ID создателя как LookupId
        createData.CreatorLookupId = creatorId;
        console.log(`Setting CreatorLookupId to ${creatorId}`);
      } else {
        console.warn(`Invalid creator ID value: ${currentUserId}`);
      }
    } else {
      console.warn(`No creator ID provided for weekly time table item`);
    }
    
    // Добавляем поля времени начала работы для каждого дня
    if (item.mondayStart) {
      createData.MondeyStartWork = this.formatTimeForSharePoint(item.mondayStart);
    }
    
    if (item.tuesdayStart) {
      createData.TuesdayStartWork = this.formatTimeForSharePoint(item.tuesdayStart);
    }
    
    if (item.wednesdayStart) {
      createData.WednesdayStartWork = this.formatTimeForSharePoint(item.wednesdayStart);
    }
    
    if (item.thursdayStart) {
      createData.ThursdayStartWork = this.formatTimeForSharePoint(item.thursdayStart);
    }
    
    if (item.fridayStart) {
      createData.FridayStartWork = this.formatTimeForSharePoint(item.fridayStart);
    }
    
    if (item.saturdayStart) {
      createData.SaturdayStartWork = this.formatTimeForSharePoint(item.saturdayStart);
    }
    
    if (item.sundayStart) {
      createData.SundayStartWork = this.formatTimeForSharePoint(item.sundayStart);
    }
    
    // Добавляем поля времени окончания работы для каждого дня
    if (item.mondayEnd) {
      createData.MondayEndWork = this.formatTimeForSharePoint(item.mondayEnd);
    }
    
    if (item.tuesdayEnd) {
      createData.TuesdayEndWork = this.formatTimeForSharePoint(item.tuesdayEnd);
    }
    
    if (item.wednesdayEnd) {
      createData.WednesdayEndWork = this.formatTimeForSharePoint(item.wednesdayEnd);
    }
    
    if (item.thursdayEnd) {
      createData.ThursdayEndWork = this.formatTimeForSharePoint(item.thursdayEnd);
    }
    
    if (item.fridayEnd) {
      createData.FridayEndWork = this.formatTimeForSharePoint(item.fridayEnd);
    }
    
    if (item.saturdayEnd) {
      createData.SaturdayEndWork = this.formatTimeForSharePoint(item.saturdayEnd);
    }
    
    if (item.sundayEnd) {
      createData.SundayEndWork = this.formatTimeForSharePoint(item.sundayEnd);
    }
    
    // Добавляем время обеда
    if (item.lunchMinutes) {
      try {
        const lunchVal = parseInt(item.lunchMinutes);
        if (!isNaN(lunchVal)) {
          createData.TimeForLunch = lunchVal;
        } else {
          createData.TimeForLunch = 30; // Значение по умолчанию
          console.warn(`Invalid lunch minutes format: ${item.lunchMinutes}, using default value 30`);
        }
      } catch (parseError) {
        createData.TimeForLunch = 30; // Значение по умолчанию
        console.warn(`Error parsing lunch minutes: ${parseError}, using default value 30`);
      }
    } else {
      createData.TimeForLunch = 30; // Значение по умолчанию
    }
    
    // Добавляем номер контракта
    if (item.contractNumber) {
      try {
        const contractNum = parseInt(item.contractNumber);
        if (!isNaN(contractNum)) {
          createData.Contract = contractNum;
        } else {
          createData.Contract = 1; // Значение по умолчанию
          console.warn(`Invalid contract number format: ${item.contractNumber}, using default value 1`);
        }
      } catch (parseError) {
        createData.Contract = 1; // Значение по умолчанию
        console.warn(`Error parsing contract number: ${parseError}, using default value 1`);
      }
    } else {
      createData.Contract = 1; // Значение по умолчанию
    }
    
    // Логируем данные для создания
    console.log(`Creating weekly time table item with data:`, JSON.stringify(createData, null, 2));
    
    // Используем метод из RemoteSiteService для создания элемента
    try {
      const listId = await this.remoteSiteService.getListId(this.listName);
      console.log(`Got list ID for ${this.listName}: ${listId}`);
      
      const result = await this.remoteSiteService.addListItem(listId, createData);
      console.log(`Successfully created weekly time table item with ID: ${result.id}`);
      
      return result.id.toString();
    } catch (serverError) {
      console.error(`Error creating item on server: ${serverError}`);
      throw new Error(`Server error creating weekly time table item: ${serverError instanceof Error ? serverError.message : String(serverError)}`);
    }
  } catch (err) {
    console.error('Error creating weekly time table item:', err);
    throw err;
  }
}

  /**
 * Удаляет элемент недельного расписания (устанавливает Deleted=1)
 * @param itemId ID элемента для удаления
 * @returns Promise с результатом операции
 */
public async deleteWeeklyTimeTableItem(itemId: string): Promise<boolean> {
  try {
    console.log(`Deleting weekly time table item ID: ${itemId}`);
    
    // Преобразуем строковый ID в число
    const itemIdNum = parseInt(itemId, 10);
    if (isNaN(itemIdNum)) {
      throw new Error(`Invalid item ID: ${itemId}`);
    }
    
    // Используем метод из RemoteSiteService для обновления элемента с установкой Deleted=1
    const success = await this.remoteSiteService.updateListItem(
      this.listName,
      itemIdNum,
      {
        Deleted: 1 // Устанавливаем флаг Deleted в 1 (мягкое удаление)
      }
    );
    
    return success;
  } catch (err) {
    console.error('Error deleting weekly time table item:', err);
    throw err;
  }
}

/**
 * Восстанавливает удаленный элемент недельного расписания (устанавливает Deleted=0)
 * @param itemId ID элемента для восстановления
 * @returns Promise с результатом операции
 */
public async restoreWeeklyTimeTableItem(itemId: string): Promise<boolean> {
  try {
    console.log(`Restoring weekly time table item ID: ${itemId}`);
    
    // Преобразуем строковый ID в число
    const itemIdNum = parseInt(itemId, 10);
    if (isNaN(itemIdNum)) {
      throw new Error(`Invalid item ID: ${itemId}`);
    }
    
    // Используем метод из RemoteSiteService для обновления элемента с установкой Deleted=0
    const success = await this.remoteSiteService.updateListItem(
      this.listName,
      itemIdNum,
      {
        Deleted: 0 // Устанавливаем флаг Deleted в 0 (восстановление)
      }
    );
    
    return success;
  } catch (err) {
    console.error('Error restoring weekly time table item:', err);
    throw err;
  }
}
}