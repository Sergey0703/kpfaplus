// src/webparts/kpfaplus/services/GroupMemberService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";
import { IGroupMember } from "../models/types";
import { RemoteSiteService } from "./RemoteSiteService";

export class GroupMemberService {
  private logSource = "GroupMemberService";
  // Добавляем контекст и remoteSiteService как поля класса
  private _context: WebPartContext;
  private remoteSiteService: RemoteSiteService;

  constructor(context: WebPartContext) {
    this._context = context;
    // Инициализируем RemoteSiteService
    this.remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo(`GroupMemberService initialized for web: ${this._context.pageContext.web.title}`);
  }

  // Вспомогательные методы для преобразования типов
  private ensureString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  private ensureNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  private ensureBoolean(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    return Boolean(value);
  }

  // Логирование
  private logInfo(message: string): void {
    console.log(`[${this.logSource}] ${message}`);
  }

  private logError(message: string): void {
    console.error(`[${this.logSource}] ${message}`);
  }

 /**
 * Получает список членов группы по ID группы через RemoteSiteService
 * @param groupId ID группы
 * @returns Promise с массивом членов группы
 */
public async fetchGroupMembersByGroupId(groupId: number): Promise<IGroupMember[]> {
  try {
    this.logInfo(`Fetching group members for group ID: ${groupId} using RemoteSiteService`);

    if (!groupId) {
      this.logInfo("Group ID is empty. Returning empty array.");
      return [];
    }

    // Формируем фильтр для запроса
    const filter = `GroupId eq ${groupId}`;
    
    // Получаем записи из списка GroupMembers через RemoteSiteService
    const items = await this.remoteSiteService.getListItems(
      "GroupMembers",
      true, // expandFields = true
      filter,
      { field: "Title", ascending: true }
    );

    this.logInfo(`Retrieved ${items.length} group members for group ID: ${groupId} via RemoteSiteService`);

    // Для отладки выведем структуру первого элемента
    if (items.length > 0) {
      this.logInfo(`Sample group member data: ${JSON.stringify(items[0], null, 2)}`);
    }

    // Преобразуем в формат IGroupMember
    const groupMembers: IGroupMember[] = [];

    for (const item of items) {
      const fields = item.fields || {};
      
      // Получаем ID сотрудника
      let employeeId = "";
      
      if (fields.EmployeeLookupId) {
        employeeId = this.ensureString(fields.EmployeeLookupId);
      } else if (fields.EmployeeId) {
        employeeId = this.ensureString(fields.EmployeeId);
      }
      
      // Получаем имя сотрудника - наиболее важная часть
      // В Graph API и через RemoteSiteService поле EmployeeLookup или Employee.Title может содержать имя
      let employeeTitle = "";
      
      if (fields.EmployeeLookup) {
        // Если есть прямое поле EmployeeLookup
        employeeTitle = this.ensureString(fields.EmployeeLookup);
      } else if (fields.Employee && typeof fields.Employee === 'object') {
        // Если есть вложенный объект Employee с полем Title
        const employeeObj = fields.Employee as Record<string, unknown>;
        employeeTitle = this.ensureString(employeeObj.Title);
      } else if (fields.Title) {
        // Если нет специальных полей для имени сотрудника, используем Title самого элемента
        employeeTitle = this.ensureString(fields.Title);
      } else {
        // Если ничего не помогло, пробуем найти любое поле, которое может содержать имя
        for (const key of Object.keys(fields)) {
          if (
            (key.includes("Employee") || key.includes("Staff")) && 
            (key.includes("Title") || key.includes("Name"))
          ) {
            if (fields[key] && typeof fields[key] === 'string') {
              employeeTitle = this.ensureString(fields[key]);
              break;
            }
          }
        }
      }
      
      // Если все равно не удалось получить имя, используем заглушку
      if (!employeeTitle) {
        employeeTitle = `Staff #${item.id}`;
      }
      
      // Создаем объект члена группы
      const groupMember: IGroupMember = {
        ID: this.ensureNumber(item.id),
        Title: employeeTitle || `Staff #${item.id}`, // Используем найденное имя или заглушку
        Group: {
          ID: groupId,
          Title: this.ensureString(fields.GroupLookup) // Название группы
        },
        Employee: {
          Id: employeeId,
          Title: employeeTitle
        },
        AutoSchedule: this.ensureBoolean(fields.AutoSchedule),
        PathForSRSFile: this.ensureString(fields.PathForSRSFile),
        GeneralNote: this.ensureString(fields.GeneralNote),
        Deleted: typeof fields.Deleted === 'number' ? fields.Deleted as number : (this.ensureBoolean(fields.Deleted) ? 1 : 0), // Преобразуем в число
        ContractedHours: this.ensureNumber(fields.ContractedHours)
      };

      // Логируем созданный объект для отладки
      this.logInfo(`Mapped group member: ID=${groupMember.ID}, Title=${groupMember.Title}, Deleted=${groupMember.Deleted}`);
      
      groupMembers.push(groupMember);
    }

    // ВАЖНО: Дополнительно получим информацию о сотрудниках из списка Staff
    try {
      // Получаем список всех сотрудников (Staff)
      const staffItems = await this.remoteSiteService.getListItems(
        "Staff",
        true,
        undefined,
        undefined
      );
      
      this.logInfo(`Retrieved ${staffItems.length} staff entries to enrich group members data`);
      
      // Создаем карту ID сотрудников -> Имя сотрудника
      const staffMap = new Map();
      
      for (const staff of staffItems) {
        const fields = staff.fields || {};
        const staffId = this.ensureString(staff.id);
        const staffTitle = this.ensureString(fields.Title);
        
        if (staffId && staffTitle) {
          staffMap.set(staffId, staffTitle);
          this.logInfo(`Staff mapping: ID=${staffId}, Title=${staffTitle}`);
        }
      }
      
      // Обогащаем наши данные группы именами из списка Staff
      for (const groupMember of groupMembers) {
        if (groupMember.Employee && groupMember.Employee.Id) {
          const staffTitle = staffMap.get(groupMember.Employee.Id);
          if (staffTitle) {
            this.logInfo(`Enriching group member ${groupMember.ID} with Staff title: ${staffTitle}`);
            groupMember.Title = staffTitle;
            groupMember.Employee.Title = staffTitle;
          }
        }
      }
    } catch (staffError) {
      this.logError(`Error enriching with Staff data: ${staffError}`);
      // Продолжаем работу даже при ошибке обогащения данными
    }

    return groupMembers;
  } catch (error) {
    this.logError(`Error in fetchGroupMembersByGroupIdRemote via RemoteSiteService: ${error}`);
    throw error;
  }
}

  /**
   * Получает список членов группы по ID группы через RemoteSiteService
   * @param groupId ID группы
   * @returns Promise с массивом членов группы
   */
  public async fetchGroupMembersByGroupIdRemote(groupId: number): Promise<IGroupMember[]> {
    try {
      this.logInfo(`Fetching group members for group ID: ${groupId} using RemoteSiteService`);

      if (!groupId) {
        this.logInfo("Group ID is empty. Returning empty array.");
        return [];
      }

      // Используем уже инициализированный remoteSiteService
      // Формируем фильтр для запроса
      const filter = `GroupId eq ${groupId}`;
      
      // Получаем записи из списка GroupMembers через RemoteSiteService
      const items = await this.remoteSiteService.getListItems(
        "GroupMembers",
        true, // expandFields = true
        filter,
        { field: "Title", ascending: true }
      );

      this.logInfo(`Retrieved ${items.length} group members for group ID: ${groupId} via RemoteSiteService`);

      // Преобразуем в формат IGroupMember
      const groupMembers: IGroupMember[] = [];

      for (const item of items) {
        const fields = item.fields || {};
        
        // Обработка Employee (связанная сущность)
        let employeeId = "";
        let employeeTitle = "";
        
        // Проверяем наличие данных о сотруднике в разных возможных форматах
        if (fields.EmployeeLookupId) {
          employeeId = this.ensureString(fields.EmployeeLookupId);
        } else if (fields.EmployeeId) {
          employeeId = this.ensureString(fields.EmployeeId);
        }
        
        if (fields.EmployeeLookup) {
          employeeTitle = this.ensureString(fields.EmployeeLookup);
        } else if (fields.Employee && typeof fields.Employee === 'object') {
          const employeeObj = fields.Employee as Record<string, unknown>;
          employeeTitle = this.ensureString(employeeObj.Title);
        }
        
        // Обработка Group (связанная сущность)
        let groupTitle = "";
        if (fields.GroupLookup) {
          groupTitle = this.ensureString(fields.GroupLookup);
        } else if (fields.Group && typeof fields.Group === 'object') {
          const groupObj = fields.Group as Record<string, unknown>;
          groupTitle = this.ensureString(groupObj.Title);
        }
        
        // Создаем объект члена группы
        const groupMember: IGroupMember = {
          ID: this.ensureNumber(item.id),
          Title: this.ensureString(fields.Title),
          Group: {
            ID: groupId,
            Title: groupTitle
          },
          Employee: {
            Id: employeeId,
            Title: employeeTitle
          },
          AutoSchedule: this.ensureBoolean(fields.AutoSchedule),
          PathForSRSFile: this.ensureString(fields.PathForSRSFile),
          GeneralNote: this.ensureString(fields.GeneralNote),
          Deleted: this.ensureNumber(fields.Deleted),
          ContractedHours: this.ensureNumber(fields.ContractedHours)
        };

        groupMembers.push(groupMember);
      }

      return groupMembers;
    } catch (error) {
      this.logError(`Error in fetchGroupMembersByGroupIdRemote via RemoteSiteService: ${error}`);
      throw error;
    }
  }
  
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
      this.logInfo(`Updating group member ID: ${groupMemberId} via RemoteSiteService`);
  
      if (!groupMemberId) {
        this.logInfo("Group member ID is empty. Update failed.");
        return false;
      }
  
      // Создаем объект данных для обновления
      const data: Record<string, unknown> = {};
  
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
  
      // Используем метод из RemoteSiteService для обновления
      const success = await this.remoteSiteService.updateListItem("GroupMembers", groupMemberId, data);
  
      this.logInfo(`Update result for group member ID: ${groupMemberId}: ${success}`);
      return success;
    } catch (error) {
      this.logError(`Error updating group member via RemoteSiteService: ${error}`);
      throw error;
    }
  }

/**
 * Создает нового члена группы через RemoteSiteService (MS Graph API)
 * @param groupId ID группы
 * @param staffId ID сотрудника из списка Staff
 * @param additionalData Дополнительные данные для члена группы
 * @returns Promise с результатом операции
 */
public async createGroupMemberFromStaff(
  groupId: number, 
  staffId: number, 
  additionalData: { 
    autoSchedule?: boolean, 
    pathForSRSFile?: string, 
    generalNote?: string,
    currentUserId?: number
  }
): Promise<{ success: boolean; alreadyExists: boolean; newItemId?: number }> {
  try {
    this.logInfo(`Starting createGroupMemberFromStaffRemote for group ID: ${groupId}, staff ID: ${staffId}`);
    
    // Проверяем валидность входных данных
    if (!groupId || groupId <= 0) {
      this.logInfo(`Group ID ${groupId} is invalid or 0. Create failed.`);
      return { success: false, alreadyExists: false };
    }
    
    if (!staffId || staffId <= 0) {
      this.logInfo(`Staff ID ${staffId} is invalid or 0. Create failed.`);
      return { success: false, alreadyExists: false };
    }
    
    // Проверяем, есть ли уже сотрудник в группе
    const isAlreadyInGroup = await this.isStaffInGroup(groupId, staffId);
    if (isAlreadyInGroup) {
      this.logInfo(`Staff ID: ${staffId} is already in group ID: ${groupId}. Skipping.`);
      return { success: true, alreadyExists: true };
    }
    
    // Подготавливаем данные для создания записи в GroupMembers
    // Используем ПРАВИЛЬНЫЕ имена полей из логов существующих элементов
    const createData: Record<string, unknown> = {
      GroupLookupId: groupId,         // Правильное имя поля из логов
      EmployeeLookupId: staffId,      // Правильное имя поля из логов
      AutoSchedule: additionalData.autoSchedule ?? false,
      PathForSRSFile: additionalData.pathForSRSFile ?? "",
      GeneralNote: additionalData.generalNote ?? "",
      Deleted: 0,
      ContractedHours: 0
    };
    
    // Добавляем Manager, если currentUserId был передан
    if (additionalData.currentUserId) {
      createData.ManagerLookupId = additionalData.currentUserId; // Правильное имя поля из логов
    }
    
    this.logInfo(`Prepared data for creating GroupMember: ${JSON.stringify(createData)}`);
    
    // Создаем элемент списка через RemoteSiteService
    try {
      // Получаем идентификатор списка GroupMembers
      const listId = await this.remoteSiteService.getListId("GroupMembers");
      
      // Добавляем элемент в список через MS Graph API
      const response = await this.remoteSiteService.addListItem(listId, createData);
      
      if (response && response.id) {
        this.logInfo(`Successfully created GroupMember with ID: ${response.id}`);
        return { success: true, alreadyExists: false, newItemId: this.ensureNumber(response.id) };
      } else {
        this.logInfo(`Create operation completed but no valid response returned`);
        return { success: false, alreadyExists: false };
      }
    } catch (createError) {
      this.logError(`Error creating item via RemoteSiteService: ${createError}`);
      throw new Error(`Error adding staff to group: ${createError}`);
    }
  } catch (error) {
    this.logError(`Error in createGroupMemberFromStaffRemote: ${error}`);
    throw error;
  }
}

/**
 * Проверяет наличие сотрудника в группе через RemoteSiteService (MS Graph API)
 * @param groupId ID группы
 * @param staffId ID сотрудника
 * @returns Promise с результатом проверки
 */
public async isStaffInGroup(groupId: number, staffId: number): Promise<boolean> {
  try {
    this.logInfo(`Checking if staff ID: ${staffId} is already in group ID: ${groupId} via RemoteSiteService`);
    
    // Получаем все элементы для группы (без фильтра)
    const items = await this.remoteSiteService.getListItems(
      "GroupMembers",
      true, // expandFields = true
      undefined, // Без фильтра, так как MS Graph может иметь проблемы с фильтрацией по lookups
      undefined // без сортировки
    );
    
    // Вручную проверяем, есть ли сотрудник в группе
    const isInGroup = items.some(item => {
      const fields = item.fields || {};
      
      // Используем правильные имена полей из логов существующих элементов
      let groupValue = null;
      if (fields.GroupLookupId !== undefined) {
        groupValue = this.ensureNumber(fields.GroupLookupId);
      }
      
      let employeeValue = null;
      if (fields.EmployeeLookupId !== undefined) {
        employeeValue = this.ensureNumber(fields.EmployeeLookupId);
      }
      
      // Проверяем значение Deleted
      const isDeleted = this.ensureNumber(fields.Deleted) === 1 || this.ensureBoolean(fields.Deleted);
      
      // Сотрудник в группе, если найден элемент с соответствующими ID и он не удален
      return groupValue === groupId && employeeValue === staffId && !isDeleted;
    });
    
    this.logInfo(`Staff ID: ${staffId} is ${isInGroup ? 'already' : 'not'} in group ID: ${groupId} (manual check)`);
    return isInGroup;
  } catch (error) {
    this.logError(`Error checking if staff is in group via RemoteSiteService: ${error}`);
    // В случае ошибки, предполагаем что сотрудника нет в группе
    return false;
  }
}
}