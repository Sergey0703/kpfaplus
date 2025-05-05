// src/webparts/kpfaplus/services/GroupMemberService.ts
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
   * Обновляет данные члена группы
   * @param groupMemberId ID члена группы для обновления
   * @param data Данные для обновления
   * @returns Promise с результатом операции
   */
  public async updateGroupMember(groupMemberId: number, data: any): Promise<boolean> {
    try {
      this.logInfo(`Starting updateGroupMember for ID: ${groupMemberId}`);
      
      if (!groupMemberId || groupMemberId <= 0) {
        this.logInfo(`Group Member ID ${groupMemberId} is invalid or 0. Update failed.`);
        return false;
      }
      
      // Подготавливаем данные для обновления
      const updateData: any = {};
      
      // Добавляем только те поля, которые были переданы
      if (data.autoSchedule !== undefined) {
        updateData.AutoSchedule = data.autoSchedule;
      }
      
      if (data.pathForSRSFile !== undefined) {
        updateData.PathForSRSFile = data.pathForSRSFile;
      }
      
      if (data.generalNote !== undefined) {
        updateData.GeneralNote = data.generalNote;
      }
      
      if (data.deleted !== undefined) {
        updateData.Deleted = data.deleted;
      }
      
      // Если нет данных для обновления, выходим
      if (Object.keys(updateData).length === 0) {
        this.logInfo("No data provided for update");
        return false;
      }
      
      // Обновляем элемент в списке SharePoint
      await this.sp.web.lists
        .getByTitle("GroupMembers")
        .items
        .getById(groupMemberId)
        .update(updateData);
      
      this.logInfo(`Successfully updated GroupMember with ID: ${groupMemberId}`);
      return true;
    } catch (error) {
      this.logError(`Error in updateGroupMember: ${error}`);
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