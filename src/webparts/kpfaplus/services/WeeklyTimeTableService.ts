// src/webparts/kpfaplus/services/WeeklyTimeTableService.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IDayHours } from '../models/IWeeklyTimeTable';
import { RemoteSiteService } from './RemoteSiteService';

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
  //totalHours?: string;
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
  public async getWeeklyTimeTableByContractId(contractId: string): Promise<any[]> {
    try {
      // Используем RemoteSiteService вместо прямого вызова PnP JS
      const filter = `fields/IdOfTemplateLookupId eq ${contractId} and fields/Deleted eq 0`;
      
      const items = await this.remoteSiteService.getListItems(
        this.listName,
        true, // expandFields
        filter,
        { field: "Title", ascending: true } // сортировка
      );
      
      return items;
    } catch (err) {
      console.error('Error getting weekly time table by contract ID:', err);
      throw err;
    }
  }

  public async updateWeeklyTimeTableItem(item: IWeeklyTimeTableUpdateItem): Promise<any> {
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
      if (item.lunchMinutes) {
        updateData.TimeForLunch = parseInt(item.lunchMinutes);
      }
      
      // Обновляем номер контракта
      if (item.contractNumber) {
        updateData.Contract = parseInt(item.contractNumber);
      }
      
      // Обновляем общее время работы
     // if (item.totalHours) {
     //   updateData.TotalWorkHours = item.totalHours;
     // }
      
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
  public async batchUpdateWeeklyTimeTable(items: IWeeklyTimeTableUpdateItem[]): Promise<any[]> {
    try {
      // Массив для результатов операций
      const results: any[] = [];
      
      // Обновляем каждый элемент по отдельности
      for (const item of items) {
        try {
          const result = await this.updateWeeklyTimeTableItem(item);
          results.push({
            id: item.id,
            success: true,
            result
          });
        } catch (itemErr) {
          console.error(`Error updating item ${item.id}:`, itemErr);
          results.push({
            id: item.id,
            success: false,
            error: itemErr.message || 'Unknown error'
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
   * @returns ID созданного элемента
   */
  public async createWeeklyTimeTableItem(item: IWeeklyTimeTableUpdateItem, contractId: string, creatorId: string): Promise<string> {
    try {
      // Формируем объект с полями для создания
      const createData: any = {
        fields: {
          Title: `Week ${new Date().toISOString()}`,
        }
      };
      
      // Проверяем и преобразуем contractId в число для поля IdOfTemplateLookupId
      if (contractId) {
        createData.fields.IdOfTemplateLookupId = parseInt(contractId);
      }
      
      // Проверяем и преобразуем creatorId в число для поля CreatorLookupId
      if (creatorId) {
        // Здесь мы должны извлечь числовой ID из creatorId
        // Если creatorId уже является числом или строковым представлением числа, используем его
        // В противном случае нужно получить ID пользователя по имени пользователя
        const userIdMatch = creatorId.match(/\d+/); // Извлекаем числа из строки
        if (userIdMatch) {
          createData.fields.CreatorLookupId = parseInt(userIdMatch[0]);
        } else {
          // Если не удалось извлечь числовой ID, логируем ошибку, но продолжаем
          console.warn(`Could not extract numeric ID from creatorId: ${creatorId}`);
        }
      }
      
      // Добавляем поля времени начала работы для каждого дня
      if (item.mondayStart) {
        createData.fields.MondeyStartWork = this.formatTimeForSharePoint(item.mondayStart);
      }
      
      if (item.tuesdayStart) {
        createData.fields.TuesdayStartWork = this.formatTimeForSharePoint(item.tuesdayStart);
      }
      
      if (item.wednesdayStart) {
        createData.fields.WednesdayStartWork = this.formatTimeForSharePoint(item.wednesdayStart);
      }
      
      if (item.thursdayStart) {
        createData.fields.ThursdayStartWork = this.formatTimeForSharePoint(item.thursdayStart);
      }
      
      if (item.fridayStart) {
        createData.fields.FridayStartWork = this.formatTimeForSharePoint(item.fridayStart);
      }
      
      if (item.saturdayStart) {
        createData.fields.SaturdayStartWork = this.formatTimeForSharePoint(item.saturdayStart);
      }
      
      if (item.sundayStart) {
        createData.fields.SundayStartWork = this.formatTimeForSharePoint(item.sundayStart);
      }
      
      // Добавляем время обеда
      if (item.lunchMinutes) {
        createData.fields.TimeForLunch = parseInt(item.lunchMinutes);
      }
      
      // Добавляем номер контракта
      if (item.contractNumber) {
        createData.fields.Contract = parseInt(item.contractNumber);
      }
      
      // Устанавливаем поле Deleted в 0
      createData.fields.Deleted = 0;
      
      // Используем createListItem из RemoteSiteService
      const result = await this.remoteSiteService.createListItem(
        this.listName,
        createData
      );
      
      return result.id.toString();
    } catch (err) {
      console.error('Error creating weekly time table item:', err);
      throw err;
    }
  }
}