import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";

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

// Интерфейс для элементов, возвращаемых из SharePoint
interface ISharePointItem {
  ID: number;
  Title: string;
  Deleted?: boolean;
  LeaveExportFolder?: string;
  DayOfStartWeek?: number;
  TypeOfSRS?: number;
  EnterLunchTime?: boolean;
  Manager?: {
    Id?: number;
    Title?: string;
  };
  [key: string]: unknown;
}

export class DepartmentService {
  private sp: ReturnType<typeof spfi>;
  private logSource: string = "DepartmentService";

  constructor(context: WebPartContext) {
    // Инициализация PnP JS с контекстом SPFx
    this.sp = spfi().using(SPFx(context));
  }

  /**
   * Fetches department list from SharePoint
   * @returns Promise with department data
   */
  public async fetchDepartments(): Promise<IDepartment[]> {
    try {
      this.logInfo("Starting fetchDepartments");
      
      // Получение элементов из списка "StaffGroups"
      const items = await this.sp.web.lists
        .getByTitle("StaffGroups")
        .items
        .select("ID,Title,Deleted,LeaveExportFolder,DayOfStartWeek,TypeOfSRS,EnterLunchTime,Manager/Id,Manager/Title")
        .expand("Manager")
        .top(1000)
        .orderBy("Title", true)();
      
      this.logInfo(`Fetched ${items.length} departments`);
      
      // Преобразуем полученные данные в нужный формат
      const departments: IDepartment[] = this.mapToDepartments(items);
      
      return departments;
    } catch (error) {
      this.logError(`Error fetching departments: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches departments by manager ID using server-side filtering
   * @param managerId ID of the manager
   * @returns Promise with filtered department data
   */
  public async fetchDepartmentsByManager(managerId: number): Promise<IDepartment[]> {
    try {
      this.logInfo(`Starting fetchDepartmentsByManager for manager ID: ${managerId}`);
      
      if (!managerId || managerId <= 0) {
        this.logInfo(`Manager ID ${managerId} is invalid or 0. Returning empty array.`);
        return []; 
      }
      
      // Используем простую фильтрацию по ManagerId - этот вариант работает стабильно
      const items = await this.sp.web.lists
        .getByTitle("StaffGroups")
        .items
        .select("ID,Title,Deleted,LeaveExportFolder,DayOfStartWeek,TypeOfSRS,EnterLunchTime,Manager/Id,Manager/Title")
        .expand("Manager")
        .filter(`ManagerId eq ${managerId}`)
        .top(1000)();
      
      this.logInfo(`Filtered ${items.length} departments for manager ID: ${managerId}`);
      
      // Логирование полученных результатов для отладки
      items.forEach((item: ISharePointItem, index: number) => {
        this.logInfo(`Result #${index + 1}: ID=${item.ID}, Title=${item.Title}, Manager=${JSON.stringify(item.Manager)}`);
      });
      
      // Преобразуем результат в нужный формат
      const departments: IDepartment[] = this.mapToDepartments(items);
      
      return departments;
    } catch (error) {
      this.logError(`Error in fetchDepartmentsByManager: ${error}`);
      throw error;
    }
  }

  /**
   * Преобразует данные SharePoint в объекты департаментов
   * @param items Данные из SharePoint
   * @returns Массив объектов IDepartment
   */
  private mapToDepartments(items: ISharePointItem[]): IDepartment[] {
    return items.map(item => ({
      ID: item.ID,
      Title: item.Title,
      Deleted: item.Deleted || false,
      LeaveExportFolder: item.LeaveExportFolder || "",
      DayOfStartWeek: item.DayOfStartWeek || 0,
      TypeOfSRS: item.TypeOfSRS || 0,
      EnterLunchTime: item.EnterLunchTime || false,
      Manager: item.Manager ? {
        Id: item.Manager.Id || 0,
        Title: item.Manager.Title || ""
      } : {
        Id: 0,
        Title: ""
      }
    }));
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