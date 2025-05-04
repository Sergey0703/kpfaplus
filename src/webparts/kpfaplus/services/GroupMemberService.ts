import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { IGroupMember } from '../models/types';

// Интерфейс для элементов, возвращаемых из SharePoint
interface ISharePointGroupMemberItem {
  ID: number;
  Title: string;
  AutoSchedule?: boolean;
  PathForSRSFile?: string;
  GeneralNote?: string;
  Deleted?: boolean;
  ContractedHours?: number;
  Employee?: {
    Id?: string;
    Title?: string;
  };
  Group?: {
    ID?: number;
    Title?: string;
  };
  [key: string]: unknown;
}

export class GroupMemberService {
  private sp: ReturnType<typeof spfi>;
  private logSource: string = "GroupMemberService";

  constructor(context: WebPartContext) {
    // Инициализация PnP JS с контекстом SPFx
    this.sp = spfi().using(SPFx(context));
  }

  /**
   * Получение членов группы по ID группы
   * @param groupId ID группы для фильтрации
   * @returns Promise с массивом GroupMembers
   */
  public async fetchGroupMembersByGroupId(groupId: number): Promise<IGroupMember[]> {
    try {
      this.logInfo(`Starting fetchGroupMembersByGroupId for group ID: ${groupId}`);
      
      if (!groupId || groupId <= 0) {
        this.logInfo(`Group ID ${groupId} is invalid or 0. Returning empty array.`);
        return []; 
      }
      
      // Используем фильтрацию по Group/ID
      this.logInfo(`Constructing query for GroupMembers with Group/ID = ${groupId}`);
      
      const items = await this.sp.web.lists
        .getByTitle("GroupMembers")
        .items
        .select("ID,Title,AutoSchedule,PathForSRSFile,GeneralNote,Deleted,ContractedHours,Employee/Id,Employee/Title,Group/ID,Group/Title")
        .expand("Employee,Group")
        .filter(`Group/ID eq ${groupId}`)
        .top(1000)();
      
      this.logInfo(`Fetched ${items.length} group members for group ID: ${groupId}`);
      
      // Логирование полученных результатов для отладки
      items.forEach((item: ISharePointGroupMemberItem, index: number) => {
        this.logInfo(`Result #${index + 1}: ID=${item.ID}, Title=${item.Title}, Employee=${JSON.stringify(item.Employee)}, Group=${JSON.stringify(item.Group)}, Deleted=${item.Deleted}`);
      });
      
      // Преобразуем результат в нужный формат
      const groupMembers: IGroupMember[] = this.mapToGroupMembers(items);
      
      return groupMembers;
    } catch (error) {
      this.logError(`Error in fetchGroupMembersByGroupId: ${error}`);
      throw error;
    }
  }

  /**
   * Преобразует данные SharePoint в объекты GroupMember
   * @param items Данные из SharePoint
   * @returns Массив объектов IGroupMember
   */
  private mapToGroupMembers(items: ISharePointGroupMemberItem[]): IGroupMember[] {
    this.logInfo(`Mapping ${items.length} items to IGroupMember objects`);
    
    return items.map(item => {
      const result: IGroupMember = {
        ID: item.ID,
        Title: item.Title || "",
        Group: {
          ID: item.Group?.ID || 0,
          Title: item.Group?.Title || ""
        },
        Employee: {
          Id: item.Employee?.Id || "",
          Title: item.Employee?.Title || ""
        },
        AutoSchedule: item.AutoSchedule || false,
        PathForSRSFile: item.PathForSRSFile || "",
        GeneralNote: item.GeneralNote || "",
        Deleted: item.Deleted || false,
        ContractedHours: item.ContractedHours || 0
      };
      
      this.logInfo(`Mapped item ID=${item.ID} to GroupMember object`);
      return result;
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