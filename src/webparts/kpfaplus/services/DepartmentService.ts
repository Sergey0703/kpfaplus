// src/webparts/kpfaplus/services/DepartmentService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

export interface IDepartment {
  ID: number;
  Title: string;
  Deleted: boolean;
  LeaveExportFolder: string;
  DayOfStartWeek: number;
  TypeOfSRS: number;
  EnterLunchTime: boolean;
  Manager: {
    Id: number;
    Title: string;
  };
}

export class DepartmentService {
  private logSource: string = "DepartmentService";
  private remoteSiteService: RemoteSiteService;

  constructor(context: WebPartContext) {
    // Получаем экземпляр RemoteSiteService
    this.remoteSiteService = RemoteSiteService.getInstance(context);
  }

  /**
   * Fetches department list from SharePoint
   * @returns Promise with department data
   */
  public async fetchDepartments(): Promise<IDepartment[]> {
    try {
      this.logInfo("Starting fetchDepartments from remote site");
      
      // Получаем элементы списка StaffGroups с удаленного сайта
      const items = await this.remoteSiteService.getListItems(
        "StaffGroups", 
        true,
        undefined, 
        { field: "Title", ascending: true } // Префикс fields/ будет добавлен в getListItems
      );
      
      this.logInfo(`Fetched ${items.length} departments from remote site`);
      
      // Преобразуем полученные данные в нужный формат
      const departments: IDepartment[] = this.mapToDepartments(items);
      
      return departments;
    } catch (error) {
      this.logError(`Error fetching departments from remote site: ${error}`);
      // Возвращаем пустой массив вместо выбрасывания исключения
      return [];
    }
  }

   /**
 * Fetches departments by manager ID using server-side filtering
 * @param managerId ID of the manager
 * @returns Promise with filtered department data
 */
public async fetchDepartmentsByManager(managerId: number): Promise<IDepartment[]> {
  try {
    this.logInfo(`Starting fetchDepartmentsByManager for manager ID: ${managerId} from remote site`);
    
    if (!managerId || managerId <= 0) {
      this.logInfo(`Manager ID ${managerId} is invalid or 0. Returning empty array.`);
      return [];
    }
    
    // Проверяем структуру данных, запрашивая один элемент для анализа
    let sampleItems = await this.remoteSiteService.getListItems(
      "StaffGroups", 
      true,
      undefined,
      undefined
    );
    
    // Если есть хотя бы один элемент, анализируем его структуру
    if (sampleItems.length > 0) {
      const sampleItem = sampleItems[0];
      const fields = sampleItem.fields || {};
      
      // Логируем подробную структуру элемента для анализа
      this.logInfo(`Sample StaffGroup item structure: ${JSON.stringify(fields, null, 2)}`);
      
      // Определяем, какое поле использовать для фильтрации менеджера
      // Из логов видно, что поле может называться ManagerLookupId вместо ManagerId
      let managerFieldName = "ManagerId";
      
      if (fields.hasOwnProperty('ManagerLookupId')) {
        managerFieldName = "ManagerLookupId";
        this.logInfo(`Using field "ManagerLookupId" for manager filtering`);
      } else if (fields.hasOwnProperty('ManagerId')) {
        this.logInfo(`Using field "ManagerId" for manager filtering`);
      } else {
        // Ищем любое поле, содержащее "Manager" и "Id"
        for (const key of Object.keys(fields)) {
          if (key.includes("Manager") && key.includes("Id")) {
            managerFieldName = key;
            this.logInfo(`Found manager ID field: "${key}"`);
            break;
          }
        }
      }
      
      // Формируем фильтр с использованием найденного имени поля
      const filter = `${managerFieldName} eq ${managerId}`;
      this.logInfo(`Using filter: ${filter}`);
      
      // Запрашиваем элементы с фильтрацией на сервере
      const items = await this.remoteSiteService.getListItems(
        "StaffGroups", 
        true,
        filter,
        { field: "Title", ascending: true }
      );
      
      this.logInfo(`Filtered ${items.length} departments for manager ID: ${managerId} from remote site`);
      
      // Преобразуем результат в нужный формат
      const departments: IDepartment[] = this.mapToDepartments(items);
      
      return departments;
    } else {
      this.logError("Cannot analyze StaffGroups structure - no items found");
      return [];
    }
  } catch (error) {
    this.logError(`Error in fetchDepartmentsByManager from remote site: ${error}`);
    // Возвращаем пустой массив вместо выбрасывания исключения
    return [];
  }
}

 ///////////
/**
 * Преобразует данные из Graph API в объекты департаментов
 * @param items Данные из Graph API
 * @returns Массив объектов IDepartment
 */
private mapToDepartments(items: any[]): IDepartment[] {
  return items.map(item => {
    const fields = item.fields || {};
    
    // Получение ID менеджера
    let managerId = 0;
    // Проверяем различные возможные имена полей для ID менеджера
    if (fields.ManagerLookupId !== undefined) {
      managerId = parseInt(fields.ManagerLookupId) || 0;
    } else if (fields.ManagerId !== undefined) {
      managerId = parseInt(fields.ManagerId) || 0;
    }
    
    // Получение имени менеджера
    let managerTitle = "";
    if (fields.ManagerLookup !== undefined) {
      managerTitle = fields.ManagerLookup;
    } else if (fields.Manager !== undefined) {
      if (typeof fields.Manager === 'object' && fields.Manager.Title) {
        managerTitle = fields.Manager.Title;
      } else if (typeof fields.Manager === 'string') {
        managerTitle = fields.Manager;
      }
    }
    
    // Создаем объект департамента
    return {
      ID: parseInt(item.id || "0"),
      Title: fields.Title || "Unknown",
      Deleted: Boolean(fields.Deleted),
      LeaveExportFolder: fields.LeaveExportFolder || "",
      DayOfStartWeek: parseInt(fields.DayOfStartWeek || "0"),
      TypeOfSRS: parseInt(fields.TypeOfSRS || "0"),
      EnterLunchTime: Boolean(fields.EnterLunchTime),
      Manager: {
        Id: managerId,
        Title: managerTitle
      }
    };
  });
}

  /**
   * Helper method to log info messages
   * @param message Message to log
   */
  private logInfo(message: string): void {
    console.log(`[${this.logSource}] ${message}`);
  }

  /**
   * Helper method to log error messages
   * @param message Error message to log
   */
  private logError(message: string): void {
    console.error(`[${this.logSource}] ${message}`);
  }
}