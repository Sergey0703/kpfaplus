// src/webparts/kpfaplus/services/GroupMemberService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPFI, spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";
import { IGroupMember } from "../models/types";

export class GroupMemberService {
  private sp: SPFI;
  private logSource = "GroupMemberService";

  constructor(context: WebPartContext) {
    this.sp = spfi().using(SPFx(context));
  }

  // Логирование
  private logInfo(message: string): void {
    console.log(`[${this.logSource}] ${message}`);
  }

  private logError(message: string): void {
    console.error(`[${this.logSource}] ${message}`);
  }

  /**
   * Получает список членов группы по ID группы
   * @param groupId ID группы
   * @returns Promise с массивом членов группы
   */
  public async fetchGroupMembersByGroupId(groupId: number): Promise<IGroupMember[]> {
    try {
      this.logInfo(`Fetching group members for group ID: ${groupId}`);

      if (!groupId) {
        this.logInfo("Group ID is empty. Returning empty array.");
        return [];
      }

      // Получаем записи из списка GroupMembers
      const items = await this.sp.web.lists
        .getByTitle("GroupMembers")
        .items
        .filter(`GroupId eq ${groupId}`)
        .expand("Employee,Group")
        .select(
          "ID,Title,Group/ID,Group/Title,Employee/Id,Employee/Title,AutoSchedule,PathForSRSFile,GeneralNote,Deleted,ContractedHours"
        )();

      this.logInfo(`Retrieved ${items.length} group members for group ID: ${groupId}`);

      // Преобразуем в формат IGroupMember
      const groupMembers: IGroupMember[] = [];

      for (const item of items) {
        const groupMember: IGroupMember = {
          ID: item.ID,
          Title: item.Title || "",
          Group: {
            ID: item.Group ? item.Group.ID : groupId,
            Title: item.Group ? item.Group.Title : ""
          },
          Employee: {
            Id: item.Employee ? item.Employee.Id : "",
            Title: item.Employee ? item.Employee.Title : ""
          },
          AutoSchedule: item.AutoSchedule || false,
          PathForSRSFile: item.PathForSRSFile || "",
          GeneralNote: item.GeneralNote || "",
          Deleted: item.Deleted || 0,
          ContractedHours: item.ContractedHours || 0
        };

        groupMembers.push(groupMember);
      }

      return groupMembers;
    } catch (error) {
      this.logError(`Error in fetchGroupMembersByGroupId: ${error}`);
      throw error;
    }
  }

  /**
   * Обновляет данные члена группы
   * @param groupMemberId ID члена группы
   * @param updateData Данные для обновления
   * @returns Promise с результатом операции
   */
  public async updateGroupMember(
    groupMemberId: number,
    updateData: {
      autoSchedule?: boolean,
      pathForSRSFile?: string,
      generalNote?: string,
      deleted?: number
    }
  ): Promise<boolean> {
    try {
      this.logInfo(`Updating group member ID: ${groupMemberId}`);

      if (!groupMemberId) {
        this.logInfo("Group member ID is empty. Update failed.");
        return false;
      }

      // Создаем объект данных для обновления
      const data: any = {};

      // Добавляем только те поля, которые были переданы
      if (updateData.autoSchedule !== undefined) {
        data.AutoSchedule = updateData.autoSchedule;
      }

      if (updateData.pathForSRSFile !== undefined) {
        data.PathForSRSFile = updateData.pathForSRSFile;
      }

      if (updateData.generalNote !== undefined) {
        data.GeneralNote = updateData.generalNote;
      }

      if (updateData.deleted !== undefined) {
        data.Deleted = updateData.deleted;
      }

      // Выполняем обновление
      await this.sp.web.lists
        .getByTitle("GroupMembers")
        .items
        .getById(groupMemberId)
        .update(data);

      this.logInfo(`Successfully updated group member ID: ${groupMemberId}`);
      return true;
    } catch (error) {
      this.logError(`Error updating group member: ${error}`);
      throw error;
    }
  }

  /**
   * Создает нового члена группы, связывая сотрудника из Staff с группой
   * @param groupId ID группы
   * @param staffId ID сотрудника из списка Staff
   * @param additionalData Дополнительные данные для члена группы
   * @returns Promise с результатом операции
   */
  // Обновленная версия createGroupMemberFromStaff с дополнительной проверкой
  public async createGroupMemberFromStaff(
    groupId: number, 
    staffId: number, 
    additionalData: { 
      autoSchedule?: boolean, 
      pathForSRSFile?: string, 
      generalNote?: string 
    }
  ): Promise<boolean> {
    try {
      this.logInfo(`Starting createGroupMemberFromStaff for group ID: ${groupId}, staff ID: ${staffId}`);
      
      if (!groupId || groupId <= 0) {
        this.logInfo(`Group ID ${groupId} is invalid or 0. Create failed.`);
        return false;
      }
      
      if (!staffId || staffId <= 0) {
        this.logInfo(`Staff ID ${staffId} is invalid or 0. Create failed.`);
        return false;
      }
      
      // Подготавливаем данные для создания записи в GroupMembers
      const createData: any = {
        GroupId: groupId,            // Поле для связи с группой
        EmployeeId: staffId,         // Поле для связи с сотрудником
        AutoSchedule: additionalData.autoSchedule ?? false,
        PathForSRSFile: additionalData.pathForSRSFile ?? "",
        GeneralNote: additionalData.generalNote ?? "",
        Deleted: 0,                  // По умолчанию не удален
        ContractedHours: 0           // По умолчанию 0 часов
      };
      
      this.logInfo(`Prepared data for creating GroupMember: ${JSON.stringify(createData)}`);
      
      // Создаем запись в списке GroupMembers
      try {
        const result = await this.sp.web.lists
          .getByTitle("GroupMembers")
          .items
          .add(createData);
        
        if (result && result.data) {
          this.logInfo(`Successfully created GroupMember with ID: ${result.data.ID}`);
          return true;
        } else {
          this.logInfo(`Create operation completed but no data returned`);
          // Даже если данные не возвращены, считаем операцию успешной,
          // если не было исключения
          return true;
        }
      } catch (spError) {
        this.logError(`Error adding item to SharePoint: ${spError}`);
        throw new Error(`Error adding staff to group: ${spError}`);
      }
    } catch (error) {
      this.logError(`Error in createGroupMemberFromStaff: ${error}`);
      throw error;
    }
  }

}