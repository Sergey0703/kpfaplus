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
    Value: string;
  };
}

// Интерфейс для элемента списка департаментов в SharePoint
interface IDepartmentItem {
  ID: number;
  Title: string;
  Deleted: boolean;
  LeaveExportFolder: string;
  DayOfStartWeek: number;
  TypeOfSRS: number;
  EnterLunchTime: boolean;
  Manager?: {
    Id: number;
    Title: string;
  };
  [key: string]: any; // Для дополнительных полей
}

export class DepartmentService {
  private sp: any;
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
      
      // Получение элементов из списка "Departments"
      const items: IDepartmentItem[] = await this.sp.web.lists
        .getByTitle("StaffGroups") // Название вашего списка
        .items
        .select("ID,Title,Deleted,LeaveExportFolder,DayOfStartWeek,TypeOfSRS,EnterLunchTime,Manager/Id,Manager/Title")
        .expand("Manager") // Раскрываем поле Manager для получения связанных данных
        .top(1000) // Ограничиваем выборку, если нужно
        .orderBy("Title", true) // Сортировка по названию
        ();
      
      // Преобразуем полученные данные в нужный формат с явным указанием типа item
      const departments: IDepartment[] = items.map((item: IDepartmentItem) => ({
        ID: item.ID,
        Title: item.Title,
        Deleted: item.Deleted || false,
        LeaveExportFolder: item.LeaveExportFolder || "",
        DayOfStartWeek: item.DayOfStartWeek || 0,
        TypeOfSRS: item.TypeOfSRS || 0,
        EnterLunchTime: item.EnterLunchTime || false,
        Manager: {
          Id: item.Manager ? item.Manager.Id : 0,
          Value: item.Manager ? item.Manager.Title : ""
        }
      }));
      
      this.logInfo(`Fetched ${departments.length} departments`);
      return departments;
    } catch (error) {
      this.logError(`Error fetching departments: ${error}`);
      throw error;
    }
  }

  /**
   * Fetches department list from another site
   * @param siteUrl URL of the site containing the departments list
   * @returns Promise with department data
   */
  public async fetchDepartmentsFromOtherSite(siteUrl: string): Promise<IDepartment[]> {
    try {
      this.logInfo(`Starting fetchDepartments from site: ${siteUrl}`);
      
      // Получение элементов из списка "Departments" на другом сайте
      const items: IDepartmentItem[] = await this.sp.site.getWebByUrl(siteUrl).lists
        .getByTitle("Departments")
        .items
        .select("ID,Title,Deleted,LeaveExportFolder,DayOfStartWeek,TypeOfSRS,EnterLunchTime,Manager/Id,Manager/Title")
        .expand("Manager")
        .top(1000)
        .orderBy("Title", true)
        ();
      
      // Преобразуем полученные данные в нужный формат с явным указанием типа item
      const departments: IDepartment[] = items.map((item: IDepartmentItem) => ({
        ID: item.ID,
        Title: item.Title,
        Deleted: item.Deleted || false,
        LeaveExportFolder: item.LeaveExportFolder || "",
        DayOfStartWeek: item.DayOfStartWeek || 0,
        TypeOfSRS: item.TypeOfSRS || 0,
        EnterLunchTime: item.EnterLunchTime || false,
        Manager: {
          Id: item.Manager ? item.Manager.Id : 0,
          Value: item.Manager ? item.Manager.Title : ""
        }
      }));
      
      this.logInfo(`Fetched ${departments.length} departments from other site`);
      return departments;
    } catch (error) {
      this.logError(`Error fetching departments from other site: ${error}`);
      throw error;
    }
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