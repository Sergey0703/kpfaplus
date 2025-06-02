// 6. src/webparts/kpfaplus/services/DepartmentService.ts (ОБНОВЛЕННЫЙ)
// ============================================================================
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

// Определим интерфейс для элементов, возвращаемых из RemoteSiteService
export interface IRemoteListItem {
  id: string;
  fields?: Record<string, unknown>;
}

// Интерфейс для данных создания группы
interface ICreateGroupData {
  Title: string;
  DayOfStartWeek: number;
  EnterLunchTime: boolean;
  LeaveExportFolder: string;
  ManagerLookupId: number;
  Deleted: number;
}

export class DepartmentService {
  private logSource: string = "DepartmentService";
  private remoteSiteService: RemoteSiteService;
  private listName: string = "StaffGroups";

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
        this.listName, 
        true,
        undefined, 
        { field: "Title", ascending: true }
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
      const sampleItems = await this.remoteSiteService.getListItems(
        this.listName, 
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
        let managerFieldName = "ManagerId";
        
        if (Object.prototype.hasOwnProperty.call(fields, 'ManagerLookupId')) {
          managerFieldName = "ManagerLookupId";
          this.logInfo(`Using field "ManagerLookupId" for manager filtering`);
        } else if (Object.prototype.hasOwnProperty.call(fields, 'ManagerId')) {
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
          this.listName, 
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

  /**
   * Помечает группу как удаленную (не удаляет физически)
   * @param groupId ID группы
   * @returns Promise с результатом операции
   */
  public async markGroupAsDeleted(groupId: string): Promise<boolean> {
    try {
      this.logInfo(`Marking group as deleted, ID: ${groupId}`);
      
      if (!groupId) {
        throw new Error("Group ID is empty or invalid");
      }
      
      const groupIdNumber = parseInt(groupId);
      if (isNaN(groupIdNumber)) {
        throw new Error(`Invalid group ID format: ${groupId}`);
      }
      
      // Используем метод updateListItem из RemoteSiteService
      const success = await this.remoteSiteService.updateListItem(
        this.listName,
        groupIdNumber,
        {
          Deleted: 1
        }
      );
      
      if (success) {
        this.logInfo(`Successfully marked group as deleted, ID: ${groupId}`);
        return true;
      } else {
        throw new Error(`Failed to mark group as deleted, ID: ${groupId}`);
      }
    } catch (error) {
      this.logError(`Error marking group as deleted: ${error}`);
      throw error;
    }
  }

  /**
   * Снимает отметку удаления с группы
   * @param groupId ID группы
   * @returns Promise с результатом операции
   */
  public async markGroupAsActive(groupId: string): Promise<boolean> {
    try {
      this.logInfo(`Marking group as active, ID: ${groupId}`);
      
      if (!groupId) {
        throw new Error("Group ID is empty or invalid");
      }
      
      const groupIdNumber = parseInt(groupId);
      if (isNaN(groupIdNumber)) {
        throw new Error(`Invalid group ID format: ${groupId}`);
      }
      
      // Используем метод updateListItem из RemoteSiteService
      const success = await this.remoteSiteService.updateListItem(
        this.listName,
        groupIdNumber,
        {
          Deleted: 0
        }
      );
      
      if (success) {
        this.logInfo(`Successfully marked group as active, ID: ${groupId}`);
        return true;
      } else {
        throw new Error(`Failed to mark group as active, ID: ${groupId}`);
      }
    } catch (error) {
      this.logError(`Error marking group as active: ${error}`);
      throw error;
    }
  }

  /**
   * Обновляет данные группы
   * @param groupId ID группы
   * @param updateData Данные для обновления
   * @returns Promise с результатом операции
   */
  public async updateGroup(groupId: string, updateData: Partial<IDepartment>): Promise<boolean> {
    try {
      this.logInfo(`Updating group, ID: ${groupId}`);
      
      if (!groupId) {
        throw new Error("Group ID is empty or invalid");
      }
      
      const groupIdNumber = parseInt(groupId);
      if (isNaN(groupIdNumber)) {
        throw new Error(`Invalid group ID format: ${groupId}`);
      }
      
      // Подготавливаем данные для обновления в формате SharePoint
      const itemData: Record<string, unknown> = {};
      
      if (updateData.Title !== undefined) {
        itemData.Title = updateData.Title;
      }
      
      if (updateData.DayOfStartWeek !== undefined) {
        itemData.DayOfStartWeek = updateData.DayOfStartWeek;
      }
      
      if (updateData.EnterLunchTime !== undefined) {
        itemData.EnterLunchTime = updateData.EnterLunchTime;
      }
      
      if (updateData.LeaveExportFolder !== undefined) {
        itemData.LeaveExportFolder = updateData.LeaveExportFolder;
      }
      
      if (updateData.Deleted !== undefined) {
        itemData.Deleted = updateData.Deleted ? 1 : 0;
      }
      
      this.logInfo(`Prepared update data: ${JSON.stringify(itemData, null, 2)}`);
      
      // Используем метод updateListItem из RemoteSiteService
      const success = await this.remoteSiteService.updateListItem(
        this.listName,
        groupIdNumber,
        itemData
      );
      
      if (success) {
        this.logInfo(`Successfully updated group, ID: ${groupId}`);
        return true;
      } else {
        throw new Error(`Failed to update group, ID: ${groupId}`);
      }
    } catch (error) {
      this.logError(`Error updating group: ${error}`);
      throw error;
    }
  }

  /**
   * Создает новую группу
   * @param groupData Данные новой группы
   * @returns Promise с ID новой группы или undefined при ошибке
   */
  public async createGroup(groupData: ICreateGroupData): Promise<string | undefined> {
    try {
      this.logInfo(`Creating new group`);
      
      // Подготавливаем данные для создания в формате SharePoint
      const itemData: Record<string, unknown> = {
        Title: groupData.Title || 'New Group',
        DayOfStartWeek: groupData.DayOfStartWeek || 1,
        EnterLunchTime: groupData.EnterLunchTime !== undefined ? groupData.EnterLunchTime : true,
        LeaveExportFolder: groupData.LeaveExportFolder || '',
        ManagerLookupId: groupData.ManagerLookupId,
        Deleted: groupData.Deleted || 0
      };
      
      this.logInfo(`Prepared create data: ${JSON.stringify(itemData, null, 2)}`);
      
      try {
        // Создаем новый элемент через RemoteSiteService
        const response = await this.remoteSiteService.addListItem(
          this.listName,
          itemData
        );
        
        if (response && response.id) {
          const newGroupId = String(response.id);
          this.logInfo(`Created new group with ID: ${newGroupId}`);
          return newGroupId;
        } else {
          throw new Error('Failed to get ID from the created item');
        }
      } catch (createError) {
        this.logError(`Error creating new group: ${createError}`);
        throw createError;
      }
    } catch (error) {
      this.logError(`Error creating group: ${error}`);
      return undefined;
    }
  }

  /**
   * Преобразует данные из Graph API в объекты департаментов
   * @param items Данные из Graph API
   * @returns Массив объектов IDepartment
   */
  private mapToDepartments(items: IRemoteListItem[]): IDepartment[] {
    return items.map(item => {
      const fields = item.fields || {};
      
      // Получение ID менеджера
      let managerId = 0;
      // Проверяем различные возможные имена полей для ID менеджера
      if (fields.ManagerLookupId !== undefined) {
        managerId = parseInt(String(fields.ManagerLookupId)) || 0;
      } else if (fields.ManagerId !== undefined) {
        managerId = parseInt(String(fields.ManagerId)) || 0;
      }
      
      // Получение имени менеджера
      let managerTitle = "";
      if (fields.ManagerLookup !== undefined) {
        managerTitle = String(fields.ManagerLookup);
      } else if (fields.Manager !== undefined) {
        if (typeof fields.Manager === 'object' && fields.Manager !== null) {
          const managerObj = fields.Manager as { Title?: string };
          if (managerObj.Title) {
            managerTitle = managerObj.Title;
          }
        } else if (typeof fields.Manager === 'string') {
          managerTitle = fields.Manager;
        }
      }
      
      // Создаем объект департамента
      return {
        ID: parseInt(item.id || "0"),
        Title: typeof fields.Title === 'string' ? fields.Title : "Unknown",
        Deleted: Boolean(fields.Deleted),
        LeaveExportFolder: typeof fields.LeaveExportFolder === 'string' ? fields.LeaveExportFolder : "",
        DayOfStartWeek: parseInt(String(fields.DayOfStartWeek || "0")),
        TypeOfSRS: parseInt(String(fields.TypeOfSRS || "0")),
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