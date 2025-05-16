// src/webparts/kpfaplus/services/TypeOfLeaveService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

/**
 * Интерфейс для типа отпуска
 */
export interface ITypeOfLeave {
  id: string;
  title: string;
  color?: string;  // Цвет для отображения в UI (опциональное поле)
  order?: number;  // Порядок для сортировки (опциональное поле)
}

/**
 * Сервис для работы со списком типов отпусков
 */
export class TypeOfLeaveService {
  private static _instance: TypeOfLeaveService;
  private _listName: string = "TypeOfLeave";
  private _logSource: string = "TypeOfLeaveService";
  private _remoteSiteService: RemoteSiteService;
  
  // Кэш типов отпусков для повторного использования
  private _typesOfLeaveCache: ITypeOfLeave[] | null = null;

  /**
   * Приватный конструктор для паттерна Singleton
   * @param context Контекст веб-части
   */
  private constructor(context: WebPartContext) {
    // Инициализация RemoteSiteService для работы с удаленным сайтом
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo("TypeOfLeaveService initialized with RemoteSiteService");
  }

  /**
   * Получение экземпляра сервиса (Singleton паттерн)
   * @param context Контекст веб-части
   * @returns Экземпляр TypeOfLeaveService
   */
  public static getInstance(context: WebPartContext): TypeOfLeaveService {
    if (!TypeOfLeaveService._instance) {
      TypeOfLeaveService._instance = new TypeOfLeaveService(context);
    }
    return TypeOfLeaveService._instance;
  }

  /**
   * Получает все типы отпусков
   * @param forceRefresh Принудительно обновить кэш
   * @returns Promise с массивом типов отпусков
   */
  public async getAllTypesOfLeave(forceRefresh: boolean = false): Promise<ITypeOfLeave[]> {
    try {
      // Если у нас уже есть кэш и не требуется принудительное обновление, возвращаем его
      if (this._typesOfLeaveCache !== null && !forceRefresh) {
        this.logInfo(`Using cached types of leave (${this._typesOfLeaveCache.length} items)`);
        return this._typesOfLeaveCache;
      }
      
      this.logInfo("Fetching all types of leave from the server");
      
      // Получаем все элементы из списка TypeOfLeave
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        undefined, // без фильтра
        { field: "Title", ascending: true } // сортировка по заголовку
      );
      
      this.logInfo(`Retrieved ${items.length} types of leave from the server`);
      
      // Преобразуем данные из SharePoint в формат ITypeOfLeave
      const typesOfLeave = this.mapToTypesOfLeave(items);
      
      // Сохраняем результат в кэше
      this._typesOfLeaveCache = typesOfLeave;
      
      return typesOfLeave;
    } catch (error) {
      this.logError(`Error fetching types of leave: ${error}`);
      
      // Если есть кэш, возвращаем его даже при ошибке запроса
      if (this._typesOfLeaveCache !== null) {
        this.logInfo(`Using cached types of leave after error (${this._typesOfLeaveCache.length} items)`);
        return this._typesOfLeaveCache;
      }
      
      return [];
    }
  }

  /**
   * Получает тип отпуска по ID
   * @param id ID типа отпуска
   * @returns Promise с типом отпуска или undefined, если не найден
   */
  public async getTypeOfLeaveById(id: string | number): Promise<ITypeOfLeave | undefined> {
    try {
      // Проверяем наличие кэша
      if (this._typesOfLeaveCache === null) {
        // Если кэша нет, загружаем все типы отпусков
        await this.getAllTypesOfLeave();
      }
      
      // Если кэш есть, ищем в нем тип отпуска по ID
      if (this._typesOfLeaveCache !== null) {
        const typeOfLeave = this._typesOfLeaveCache.find(t => 
          t.id === id.toString() || t.id === id
        );
        
        if (typeOfLeave) {
          this.logInfo(`Found type of leave with ID ${id} in cache: ${typeOfLeave.title}`);
          return typeOfLeave;
        }
      }
      
      // Если не нашли в кэше, делаем запрос к серверу напрямую
      this.logInfo(`Fetching type of leave with ID ${id} from the server`);
      
      const filter = `fields/ID eq ${id}`;
      const items = await this._remoteSiteService.getListItems(
        this._listName,
        true, // expandFields
        filter
      );
      
      if (items.length > 0) {
        const typeOfLeave = this.mapToTypesOfLeave(items)[0];
        
        // Обновляем кэш, если он уже существует
        if (this._typesOfLeaveCache !== null) {
          const existingIndex = this._typesOfLeaveCache.findIndex(t => t.id === typeOfLeave.id);
          
          if (existingIndex !== -1) {
            this._typesOfLeaveCache[existingIndex] = typeOfLeave;
          } else {
            this._typesOfLeaveCache.push(typeOfLeave);
          }
        }
        
        this.logInfo(`Retrieved type of leave with ID ${id} from the server: ${typeOfLeave.title}`);
        return typeOfLeave;
      }
      
      this.logInfo(`Type of leave with ID ${id} not found`);
      return undefined;
    } catch (error) {
      this.logError(`Error fetching type of leave with ID ${id}: ${error}`);
      return undefined;
    }
  }

  /**
   * Получает информацию о типе отпуска (название, цвет) по его ID
   * @param typeId ID типа отпуска
   * @returns Promise с объектом, содержащим информацию о типе отпуска
   */
  public async getTypeOfLeaveInfo(typeId: string | number): Promise<{ title: string; color?: string }> {
    try {
      // Пытаемся получить тип отпуска по ID
      const typeOfLeave = await this.getTypeOfLeaveById(typeId);
      
      if (typeOfLeave) {
        return {
          title: typeOfLeave.title,
          color: typeOfLeave.color
        };
      }
      
      // Если тип отпуска не найден, возвращаем значение по умолчанию
      return {
        title: `Тип отпуска ${typeId}`,
        color: undefined
      };
    } catch (error) {
      this.logError(`Error getting type of leave info for ID ${typeId}: ${error}`);
      
      return {
        title: `Тип отпуска ${typeId}`,
        color: undefined
      };
    }
  }

  /**
   * Получает текстовое название типа отпуска по его ID
   * @param typeId ID типа отпуска
   * @returns Promise с названием типа отпуска
   */
  public async getTypeOfLeaveText(typeId: string | number): Promise<string> {
    try {
      const info = await this.getTypeOfLeaveInfo(typeId);
      return info.title;
    } catch (error) {
      this.logError(`Error getting type of leave text for ID ${typeId}: ${error}`);
      return `Тип отпуска ${typeId}`;
    }
  }

  /**
   * Синхронная версия получения текста типа отпуска (использует кэш)
   * @param typeId ID типа отпуска
   * @returns Название типа отпуска
   */
  public getTypeOfLeaveTextSync(typeId: string | number): string {
    try {
      // Если кэш не инициализирован, возвращаем базовое значение
      if (this._typesOfLeaveCache === null) {
        return `Тип отпуска ${typeId}`;
      }
      
      // Ищем тип отпуска в кэше
      const typeOfLeave = this._typesOfLeaveCache.find(t => 
        t.id === typeId.toString() || t.id === typeId
      );
      
      if (typeOfLeave) {
        return typeOfLeave.title;
      }
      
      return `Тип отпуска ${typeId}`;
    } catch (error: unknown) {
      this.logError(`Error in getTypeOfLeaveTextSync for ID ${typeId}: ${error}`);
      return `Тип отпуска ${typeId}`;
    }
  }

  /**
   * Преобразует данные из SharePoint в массив объектов ITypeOfLeave
   * @param items Данные из SharePoint
   * @returns Массив объектов ITypeOfLeave
   */
  private mapToTypesOfLeave(items: unknown[]): ITypeOfLeave[] {
    // Промежуточный массив типов отпусков, который может содержать null элементы
    const mappedTypes = items
      .map((item): ITypeOfLeave | null => {
        try {
          const typedItem = item as {
            id?: string;
            fields?: {
              ID?: string | number;
              Title?: string;
              Color?: string;
              Order?: string | number;
              [key: string]: unknown;
            };
            [key: string]: unknown;
          };
          
          const fields = typedItem.fields || {};
          
          // Извлекаем ID и проверяем
          const id = fields.ID || typedItem.id || '';
          if (!id) {
            this.logError(`Missing ID for type of leave item`);
            return null;
          }
          
          // Извлекаем название и проверяем
          const title = fields.Title || '';
          if (!title) {
            this.logError(`Missing Title for type of leave item ${id}`);
            return null;
          }
          
          // Создаем объект ITypeOfLeave
          return {
            id: id.toString(),
            title: title as string,
            color: fields.Color as string | undefined,
            order: typeof fields.Order === 'number' 
              ? fields.Order 
              : typeof fields.Order === 'string' 
                ? parseInt(fields.Order, 10) 
                : undefined
          };
        } catch (error) {
          this.logError(`Error processing type of leave item: ${error}`);
          return null;
        }
      });
    
    // Фильтруем null элементы и возвращаем типизированный массив
    return mappedTypes.filter((type): type is ITypeOfLeave => type !== null);
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