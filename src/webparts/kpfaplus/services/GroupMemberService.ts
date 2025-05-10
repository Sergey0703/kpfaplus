// src/webparts/kpfaplus/services/GroupMemberService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPFI, spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";
import { IGroupMember } from "../models/types";
import { RemoteSiteService } from "./RemoteSiteService";

// Интерфейс для создания записи члена группы
interface ICreateGroupMemberData {
  GroupId: number;
  EmployeeId: number;
  AutoSchedule: boolean;
  PathForSRSFile: string;
  GeneralNote: string;
  Deleted: number;
  ContractedHours: number;
  ManagerId?: number; // Опциональное поле
}

// Интерфейс для элемента списка GroupMembers
interface IGroupMemberItem {
  ID: number;
  GroupId: number;
  EmployeeId: number;
  Deleted?: number;
  Title?: string;
  AutoSchedule?: boolean;
  PathForSRSFile?: string;
  GeneralNote?: string;
  ContractedHours?: number;
}

export class GroupMemberService {
  private sp: SPFI;
  private logSource = "GroupMemberService";
  // Добавляем контекст и remoteSiteService как поля класса
  private _context: WebPartContext;
  private remoteSiteService: RemoteSiteService;

  constructor(context: WebPartContext) {
    this._context = context;
    this.sp = spfi().using(SPFx(context));
    // Инициализируем RemoteSiteService
    this.remoteSiteService = RemoteSiteService.getInstance(context);
    this.logInfo(`GroupMemberService initialized for web: ${this._context.pageContext.web.title}`);
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
        employeeId = fields.EmployeeLookupId.toString();
      } else if (fields.EmployeeId) {
        employeeId = fields.EmployeeId.toString();
      }
      
      // Получаем имя сотрудника - наиболее важная часть
      // В Graph API и через RemoteSiteService поле EmployeeLookup или Employee.Title может содержать имя
      let employeeTitle = "";
      
      if (fields.EmployeeLookup) {
        // Если есть прямое поле EmployeeLookup
        employeeTitle = fields.EmployeeLookup;
      } else if (fields.Employee && typeof fields.Employee === 'object' && fields.Employee.Title) {
        // Если есть вложенный объект Employee с полем Title
        employeeTitle = fields.Employee.Title;
      } else if (fields.Title) {
        // Если нет специальных полей для имени сотрудника, используем Title самого элемента
        employeeTitle = fields.Title;
      } else {
        // Если ничего не помогло, пробуем найти любое поле, которое может содержать имя
        for (const key of Object.keys(fields)) {
          if (
            (key.includes("Employee") || key.includes("Staff")) && 
            (key.includes("Title") || key.includes("Name"))
          ) {
            if (fields[key] && typeof fields[key] === 'string') {
              employeeTitle = fields[key];
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
        ID: parseInt(item.id) || 0,
        Title: employeeTitle || `Staff #${item.id}`, // Используем найденное имя или заглушку
        Group: {
          ID: groupId,
          Title: fields.GroupLookup || "" // Название группы
        },
        Employee: {
          Id: employeeId,
          Title: employeeTitle
        },
        AutoSchedule: Boolean(fields.AutoSchedule),
        PathForSRSFile: fields.PathForSRSFile || "",
        GeneralNote: fields.GeneralNote || "",
        Deleted: typeof fields.Deleted === 'number' ? fields.Deleted : (fields.Deleted === true ? 1 : 0), // Преобразуем в число
        ContractedHours: parseFloat(fields.ContractedHours) || 0
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
        const staffId = staff.id;
        const staffTitle = fields.Title || "";
        
        if (staffId && staffTitle) {
          staffMap.set(staffId.toString(), staffTitle);
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
          employeeId = fields.EmployeeLookupId.toString();
        } else if (fields.EmployeeId) {
          employeeId = fields.EmployeeId.toString();
        }
        
        if (fields.EmployeeLookup) {
          employeeTitle = fields.EmployeeLookup;
        } else if (fields.Employee && typeof fields.Employee === 'object') {
          employeeTitle = fields.Employee.Title || "";
        }
        
        // Обработка Group (связанная сущность)
        let groupTitle = "";
        if (fields.GroupLookup) {
          groupTitle = fields.GroupLookup;
        } else if (fields.Group && typeof fields.Group === 'object') {
          groupTitle = fields.Group.Title || "";
        }
        
        // Создаем объект члена группы
        const groupMember: IGroupMember = {
          ID: parseInt(item.id) || 0,
          Title: fields.Title || "",
          Group: {
            ID: groupId,
            Title: groupTitle
          },
          Employee: {
            Id: employeeId,
            Title: employeeTitle
          },
          AutoSchedule: fields.AutoSchedule || false,
          PathForSRSFile: fields.PathForSRSFile || "",
          GeneralNote: fields.GeneralNote || "",
          Deleted: fields.Deleted || 0,
          ContractedHours: fields.ContractedHours || 0
        };

        groupMembers.push(groupMember);
      }

      return groupMembers;
    } catch (error) {
      this.logError(`Error in fetchGroupMembersByGroupIdRemote via RemoteSiteService: ${error}`);
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
      interface IUpdateData {
        AutoSchedule?: boolean;
        PathForSRSFile?: string;
        GeneralNote?: string;
        Deleted?: number;
      }

      const data: IUpdateData = {};

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
  public async createGroupMemberFromStaff(
    groupId: number, 
    staffId: number, 
    additionalData: { 
      autoSchedule?: boolean, 
      pathForSRSFile?: string, 
      generalNote?: string,
      currentUserId?: number
    }
  ): Promise<{ success: boolean; alreadyExists: boolean }> {
    try {
      this.logInfo(`Starting createGroupMemberFromStaff for group ID: ${groupId}, staff ID: ${staffId}`);
      
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
        return { success: true, alreadyExists: true }; // Указываем, что сотрудник уже существует
      }
      
      // Подготавливаем данные для создания записи в GroupMembers
      const createData: ICreateGroupMemberData = {
        GroupId: groupId,            // Поле для связи с группой
        EmployeeId: staffId,         // Поле для связи с сотрудником
        AutoSchedule: additionalData.autoSchedule ?? false,
        PathForSRSFile: additionalData.pathForSRSFile ?? "",
        GeneralNote: additionalData.generalNote ?? "",
        Deleted: 0,                  // По умолчанию не удален
        ContractedHours: 0           // По умолчанию 0 часов
      };
      
      // Добавляем Manager, если currentUserId был передан
      if (additionalData.currentUserId) {
        createData.ManagerId = additionalData.currentUserId; // Устанавливаем поле ManagerId
      }
      
      this.logInfo(`Prepared data for creating GroupMember: ${JSON.stringify(createData)}`);
      
      // Создаем запись в списке GroupMembers
      try {
        // Тип для результата операции добавления
        interface IAddItemResult {
          data?: {
            ID?: number;
            [key: string]: unknown;
          };
          item?: {
            ID?: number;
            [key: string]: unknown;
          };
        }

        const result = await this.sp.web.lists
          .getByTitle("GroupMembers")
          .items
          .add(createData) as IAddItemResult;
        
        if (result && result.data) {
          this.logInfo(`Successfully created GroupMember with ID: ${result.data.ID}`);
          return { success: true, alreadyExists: false };
        } else {
          this.logInfo(`Create operation completed but no data returned`);
          // Даже если данные не возвращены, считаем операцию успешной, 
          // если не было исключения
          return { success: true, alreadyExists: false };
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

  // В GroupMemberService добавим новый метод для проверки
  public async isStaffInGroup(groupId: number, staffId: number): Promise<boolean> {
    try {
      this.logInfo(`Checking if staff ID: ${staffId} is already in group ID: ${groupId}`);
      
      // Получаем записи из списка GroupMembers, которые соответствуют критериям
      const items: IGroupMemberItem[] = await this.sp.web.lists
        .getByTitle("GroupMembers")
        .items
        .filter(`GroupId eq ${groupId} and EmployeeId eq ${staffId} and Deleted ne 1`)();
      
      // Если найдена хотя бы одна запись, значит сотрудник уже в группе
      const isInGroup = items && items.length > 0;
      this.logInfo(`Staff ID: ${staffId} is ${isInGroup ? 'already' : 'not'} in group ID: ${groupId}`);
      
      return isInGroup;
    } catch (error) {
      this.logError(`Error checking if staff is in group: ${error}`);
      // В случае ошибки, предполагаем что сотрудника нет в группе
      return false;
    }
  }

  /**
 * Проверяет наличие сотрудника в группе с использованием RemoteSiteService
 * @param groupId ID группы
 * @param staffId ID сотрудника
 * @returns Promise с результатом проверки
 */
public async isStaffInGroupRemote(groupId: number, staffId: number): Promise<boolean> {
  try {
    this.logInfo(`Checking if staff ID: ${staffId} is already in group ID: ${groupId} via RemoteSiteService`);
    
    // Формируем фильтр для запроса
    const filter = `GroupId eq ${groupId} and EmployeeId eq ${staffId} and Deleted ne 1`;
    
    // Получаем записи из списка GroupMembers через RemoteSiteService
    const items = await this.remoteSiteService.getListItems(
      "GroupMembers",
      true, // expandFields = true
      filter,
      undefined // без сортировки
    );
    
    // Если найдена хотя бы одна запись, значит сотрудник уже в группе
    const isInGroup = items && items.length > 0;
    this.logInfo(`Staff ID: ${staffId} is ${isInGroup ? 'already' : 'not'} in group ID: ${groupId} (via RemoteSiteService)`);
    
    return isInGroup;
  } catch (error) {
    this.logError(`Error checking if staff is in group via RemoteSiteService: ${error}`);
    // В случае ошибки, предполагаем что сотрудника нет в группе
    return false;
  }
}
}