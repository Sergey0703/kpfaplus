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
 * Fetches departments by manager ID using client-side filtering
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
    
    // Пробуем получить все департаменты и затем фильтруем локально
    // Это обходит проблемы с неиндексированными полями
    const allDepartments = await this.fetchDepartments();
    this.logInfo(`Fetched all departments (${allDepartments.length}) to filter by manager ID: ${managerId}`);
    
    // Фильтруем локально
    const filteredDepartments = allDepartments.filter(department => {
      return department.Manager && department.Manager.Id === managerId;
    });
    
    this.logInfo(`Filtered ${filteredDepartments.length} departments for manager ID: ${managerId}`);
    
    return filteredDepartments;
  } catch (error) {
    this.logError(`Error in fetchDepartmentsByManager: ${error}`);
    return [];
  }
}

  /**
   * Преобразует данные из Graph API в объекты департаментов
   * @param items Данные из Graph API
   * @returns Массив объектов IDepartment
   */
  private mapToDepartments(items: any[]): IDepartment[] {
    // Для отладки структуры первого элемента
    if (items.length > 0) {
      const firstItem = items[0];
      const fields = firstItem.fields || {};
      this.logInfo(`Sample StaffGroup item structure: ${JSON.stringify({
        id: firstItem.id,
        fields: fields,
        managerField: fields.Manager,
        managerIdField: fields.ManagerId
      }, null, 2)}`);
    }
    
    return items.map(item => {
      const fields = item.fields || {};
      
      // Получаем ID и Title менеджера из полей
      let managerId = 0;
      let managerTitle = "";
      
      // Определяем, как хранится информация о менеджере
      if (fields.ManagerId) {
        // Если есть отдельное поле для ID менеджера
        managerId = parseInt(fields.ManagerId) || 0;
      }
      
      if (fields.Manager) {
        // Если поле Manager - объект
        if (typeof fields.Manager === 'object') {
          if (fields.Manager.Id) {
            managerId = parseInt(fields.Manager.Id) || 0;
          } else if (fields.Manager.id) {
            managerId = parseInt(fields.Manager.id) || 0;
          }
          
          if (fields.Manager.Title) {
            managerTitle = fields.Manager.Title;
          } else if (fields.Manager.title) {
            managerTitle = fields.Manager.title;
          } else if (fields.Manager.DisplayName) {
            managerTitle = fields.Manager.DisplayName;
          }
        } 
        // Если поле Manager - строка
        else if (typeof fields.Manager === 'string') {
          managerTitle = fields.Manager;
        }
      }
      
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