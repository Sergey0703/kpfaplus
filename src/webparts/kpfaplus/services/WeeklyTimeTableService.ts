// src/webparts/kpfaplus/services/WeeklyTimeTableService.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IDayHours } from '../models/IWeeklyTimeTable';
import { RemoteSiteService } from './RemoteSiteService';
import { IRemoteListItemResponse } from '../services';
// import { DateUtils } from "../components/CustomDatePicker/CustomDatePicker"; // ЗАКОММЕНТИРОВАНО - больше не используется

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
  
  // НОВЫЕ ЧИСЛОВЫЕ ПОЛЯ для часов и минут
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
  
  TimeForLunch?: number;
  Contract?: number;
  Deleted?: number;
  [key: string]: unknown;
}

/**
 * Сервис для работы с данными недельного расписания
 * ОБНОВЛЕНО: Добавлена поддержка числовых полей для часов и минут
 */
export class WeeklyTimeTableService {
  private remoteSiteService: RemoteSiteService;
  private listName: string = 'WeeklyTimeTables'; // Имя списка в SharePoint

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
    
    console.log("WeeklyTimeTableService инициализирован с поддержкой числовых полей для времени");
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

  /**
   * НОВЫЙ МЕТОД: Преобразование IDayHours в числовые поля для SharePoint
   * @param time Объект с часами и минутами
   * @param dayPrefix Префикс дня (например, "Monday", "Tuesday")
   * @param timeType Тип времени ("Start" или "End")
   * @returns Объект с числовыми полями часов и минут
   */
  private formatTimeFieldsForSharePoint(
    time: IDayHours,
    dayPrefix: string,
    timeType: 'Start' | 'End'
  ): { hoursField: string; minutesField: string; hoursValue: number; minutesValue: number } {
    try {
      const hours = parseInt(time.hours.toString());
      const minutes = parseInt(time.minutes.toString());
      
      // Валидация
      if (isNaN(hours) || hours < 0 || hours > 23) {
        throw new Error(`Invalid hours value: ${time.hours}`);
      }
      
      if (isNaN(minutes) || minutes < 0 || minutes > 59) {
        throw new Error(`Invalid minutes value: ${time.minutes}`);
      }
      
      const hoursField = `${dayPrefix}${timeType}WorkHours`;
      const minutesField = `${dayPrefix}${timeType}WorkMinutes`;
      
      return {
        hoursField,
        minutesField,
        hoursValue: hours,
        minutesValue: minutes
      };
    } catch (error) {
      console.error(`Error formatting time fields for SharePoint: ${error}`);
      throw error;
    }
  }

  /**
   * НОВЫЙ МЕТОД: Парсинг числовых полей времени из SharePoint обратно в IDayHours
   * @param fields Поля из SharePoint
   * @param dayPrefix Префикс дня (например, "Monday", "Tuesday")
   * @param timeType Тип времени ("Start" или "End")
   * @returns Объект IDayHours или undefined если поля не найдены
   */
  private parseTimeFieldsFromSharePoint(
    fields: Record<string, unknown>,
    dayPrefix: string,
    timeType: 'Start' | 'End'
  ): IDayHours | undefined {
    try {
      const hoursField = `${dayPrefix}${timeType}WorkHours`;
      const minutesField = `${dayPrefix}${timeType}WorkMinutes`;
      
      const hoursValue = fields[hoursField];
      const minutesValue = fields[minutesField];
      
      // Если оба поля отсутствуют, возвращаем undefined
      if (hoursValue === undefined && minutesValue === undefined) {
        return undefined;
      }
      
      // Преобразуем в числа с валидацией
      const hours = typeof hoursValue === 'number' ? hoursValue : 
                   typeof hoursValue === 'string' ? parseInt(hoursValue) : 0;
      const minutes = typeof minutesValue === 'number' ? minutesValue :
                     typeof minutesValue === 'string' ? parseInt(minutesValue) : 0;
      
      // Валидация значений
      const validHours = Math.max(0, Math.min(23, isNaN(hours) ? 0 : hours));
      const validMinutes = Math.max(0, Math.min(59, isNaN(minutes) ? 0 : minutes));
      
      return {
        hours: validHours.toString().padStart(2, '0'),
        minutes: validMinutes.toString().padStart(2, '0')
      };
    } catch (error) {
      console.error(`Error parsing time fields from SharePoint: ${error}`);
      return { hours: '00', minutes: '00' };
    }
  }

  public async updateWeeklyTimeTableItem(item: IWeeklyTimeTableUpdateItem): Promise<boolean> {
    try {
      // Формируем объект с полями для обновления - напрямую, без вложенного объекта fields
      const updateData: Record<string, unknown> = {};
      
      // НОВЫЙ ПОДХОД: Используем числовые поля для времени начала работы
      if (item.mondayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.mondayStart, 'Monday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.tuesdayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.tuesdayStart, 'Tuesday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.wednesdayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.wednesdayStart, 'Wednesday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.thursdayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.thursdayStart, 'Thursday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.fridayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.fridayStart, 'Friday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.saturdayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.saturdayStart, 'Saturday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.sundayStart) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.sundayStart, 'Sunday', 'Start');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      // НОВЫЙ ПОДХОД: Используем числовые поля для времени окончания работы
      if (item.mondayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.mondayEnd, 'Monday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.tuesdayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.tuesdayEnd, 'Tuesday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.wednesdayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.wednesdayEnd, 'Wednesday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.thursdayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.thursdayEnd, 'Thursday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.fridayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.fridayEnd, 'Friday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.saturdayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.saturdayEnd, 'Saturday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
      }
      
      if (item.sundayEnd) {
        const timeFields = this.formatTimeFieldsForSharePoint(item.sundayEnd, 'Sunday', 'End');
        updateData[timeFields.hoursField] = timeFields.hoursValue;
        updateData[timeFields.minutesField] = timeFields.minutesValue;
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
      
      console.log('Updating item with numeric time fields data:', updateData);
      
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
  
  // СТАРЫЕ МЕТОДЫ - ЗАКОММЕНТИРОВАНЫ, НО ОСТАВЛЕНЫ ДЛЯ ОБРАТНОЙ СОВМЕСТИМОСТИ
  /*
  /**
   * СТАРЫЙ МЕТОД: Форматирование времени для сохранения в SharePoint с использованием DateUtils
   * Сохраняет базовую дату 2025-01-01, но нормализует время через DateUtils
   * @param time Объект с часами и минутами
   * @returns Строка даты в формате ISO для SharePoint
   */
  /*
  private formatTimeForSharePoint(time: IDayHours): string {
    try {
      // Базовая дата (СОХРАНЯЕМ как требуется - 1 января 2025 года)
      const baseDate = new Date('2025-01-01');
      
      // ИСПРАВЛЕНО: Используем DateUtils.createShiftDateTime для правильной нормализации времени
      const normalizedDateTime = DateUtils.createShiftDateTime(
  baseDate,
  parseInt(time.hours.toString()), // Приводим к числу
  parseInt(time.minutes.toString()) // Приводим к числу
);
      const result = normalizedDateTime.toISOString();
      
      // Логируем только каждый 10-й вызов для экономии логов
      if (Math.random() < 0.1) {
        console.log(`[DEBUG] formatTimeForSharePoint: ${time.hours}:${time.minutes} на ${baseDate.toISOString().split('T')[0]} → ${result}`);
      }
      
      return result;
    } catch (error) {
      console.error(`Error formatting time for SharePoint: ${error}`);
      // Запасной вариант - старый формат
      const baseDate = '2025-01-01';
      return `${baseDate}T${String(time.hours).padStart(2, '0')}:${String(time.minutes).padStart(2, '0')}:00Z`;
    }
  }
  */

  /*
  /**
   * СТАРЫЙ МЕТОД: Парсинг времени из SharePoint с использованием DateUtils
   * Обрабатывает строки времени из SharePoint и возвращает нормализованные объекты IDayHours
   * @param timeString Строка времени из SharePoint в ISO формате
   * @returns Объект IDayHours с часами и минутами
   */
  /*
  private parseTimeFromSharePoint(timeString: string | undefined): IDayHours | undefined {
    if (!timeString) {
      return undefined;
    }
    
    try {
      // Парсим дату из SharePoint
      const parsedDate = new Date(timeString);
      
      if (isNaN(parsedDate.getTime())) {
        console.warn(`Invalid time string from SharePoint: ${timeString}`);
        return undefined;
      }
      
      // Нормализуем через DateUtils для консистентной обработки временных зон
      // Используем createShiftDateTime чтобы сохранить время, но нормализовать базу
      const baseDate = new Date('2025-01-01');
      const normalizedDateTime = DateUtils.createShiftDateTime(
        baseDate,
        parsedDate.getHours(),
        parsedDate.getMinutes()
      );
      
     return {
  hours: normalizedDateTime.getHours().toString(), // Приводим к строке
  minutes: normalizedDateTime.getMinutes().toString() // Приводим к строке
};
    } catch (error) {
      console.error(`Error parsing time from SharePoint: ${error}`);
      return undefined;
    }
  }
  */

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
 * ОБНОВЛЕНО: Использует числовые поля для часов и минут
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
    
    // НОВЫЙ ПОДХОД: Добавляем числовые поля времени начала работы для каждого дня
    if (item.mondayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.mondayStart, 'Monday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.tuesdayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.tuesdayStart, 'Tuesday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.wednesdayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.wednesdayStart, 'Wednesday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.thursdayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.thursdayStart, 'Thursday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.fridayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.fridayStart, 'Friday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.saturdayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.saturdayStart, 'Saturday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.sundayStart) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.sundayStart, 'Sunday', 'Start');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    // НОВЫЙ ПОДХОД: Добавляем числовые поля времени окончания работы для каждого дня
    if (item.mondayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.mondayEnd, 'Monday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.tuesdayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.tuesdayEnd, 'Tuesday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.wednesdayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.wednesdayEnd, 'Wednesday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.thursdayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.thursdayEnd, 'Thursday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.fridayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.fridayEnd, 'Friday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.saturdayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.saturdayEnd, 'Saturday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
    }
    
    if (item.sundayEnd) {
      const timeFields = this.formatTimeFieldsForSharePoint(item.sundayEnd, 'Sunday', 'End');
      createData[timeFields.hoursField] = timeFields.hoursValue;
      createData[timeFields.minutesField] = timeFields.minutesValue;
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
    console.log(`Creating weekly time table item with numeric time fields:`, JSON.stringify(createData, null, 2));
    
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

  /**
   * НОВЫЙ МЕТОД: Получение и парсинг элемента недельного расписания с числовыми полями времени
   * Возвращает элемент с правильно обработанными полями времени из числовых полей
   * @param itemId ID элемента для получения
   * @returns Элемент с нормализованными полями времени или undefined
   */
  public async getWeeklyTimeTableItem(itemId: string): Promise<IWeeklyTimeTableItem | undefined> {
    try {
      console.log(`Getting weekly time table item ID: ${itemId}`);
      
      // Преобразуем строковый ID в число
      const itemIdNum = parseInt(itemId, 10);
      if (isNaN(itemIdNum)) {
        throw new Error(`Invalid item ID: ${itemId}`);
      }
      
      // Получаем элемент через RemoteSiteService
      const rawItem = await this.remoteSiteService.getListItem(
        this.listName,
        itemIdNum,
        true // expandFields
      );
      
      if (!rawItem) {
        console.log(`Weekly time table item ID: ${itemId} not found`);
        return undefined;
      }
      
      // Создаем объект элемента с нормализованными полями времени
      const item: IWeeklyTimeTableItem = {
        id: rawItem.id.toString(),
        fields: rawItem.fields,
        NumberOfWeek: rawItem.fields?.NumberOfWeek as number,
        NumberOfShift: rawItem.fields?.NumberOfShift as number,
        Title: rawItem.fields?.Title as string,
        Deleted: rawItem.fields?.Deleted as number
      };
      
      // НОВЫЙ ПОДХОД: Добавляем нормализованные поля времени через parseTimeFieldsFromSharePoint
      if (rawItem.fields) {
        // Времена начала работы - используем числовые поля
        item.mondayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Monday', 'Start');
        item.tuesdayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Tuesday', 'Start');
        item.wednesdayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Wednesday', 'Start');
        item.thursdayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Thursday', 'Start');
        item.fridayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Friday', 'Start');
        item.saturdayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Saturday', 'Start');
        item.sundayStart = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Sunday', 'Start');
        
        // Времена окончания работы - используем числовые поля
        item.mondayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Monday', 'End');
        item.tuesdayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Tuesday', 'End');
        item.wednesdayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Wednesday', 'End');
        item.thursdayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Thursday', 'End');
        item.fridayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Friday', 'End');
        item.saturdayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Saturday', 'End');
        item.sundayEnd = this.parseTimeFieldsFromSharePoint(rawItem.fields, 'Sunday', 'End');
        
        // Другие поля
        item.lunchMinutes = rawItem.fields.TimeForLunch as number;
        item.contractNumber = rawItem.fields.Contract as number;
      }
      
      console.log(`Successfully retrieved and parsed weekly time table item ID: ${itemId} using numeric time fields`);
      return item;
    } catch (err) {
      console.error('Error getting weekly time table item:', err);
      throw err;
    }
  }
}