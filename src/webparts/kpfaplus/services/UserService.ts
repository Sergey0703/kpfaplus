// src/webparts/kpfaplus/services/UserService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";

export interface ICurrentUser {
  ID: number;
  Title: string;
  Email: string;
}

export class UserService {
  private logSource: string = "UserService";
  private remoteSiteService: RemoteSiteService;
  private context: WebPartContext;

  constructor(context: WebPartContext) {
    this.context = context;
    // Получаем экземпляр RemoteSiteService
    this.remoteSiteService = RemoteSiteService.getInstance(context);
  }

  /**
 * Получает информацию о текущем пользователе из списка Staff на удаленном сайте
 * @returns Promise с данными текущего пользователя
 */
public async getCurrentUser(): Promise<ICurrentUser | undefined> {
  try {
    this.logInfo("Starting getCurrentUser from remote site");
    
    // Получаем информацию о пользователе из контекста SharePoint
    // Вместо Graph API используем контекст SharePoint, который более надежен
    const spUser = this.context.pageContext.user;
    this.logInfo(`Current SharePoint user: ${spUser.displayName} (${spUser.email})`);
    
    if (!spUser.email) {
      this.logError("Unable to get user email from SharePoint context");
      return {
        ID: 0,
        Title: spUser.displayName || "Unknown",
        Email: ""
      };
    }
    
    // Получаем все элементы Staff и фильтруем локально
    try {
      const allStaffItems = await this.remoteSiteService.getListItems("Staff", true);
      this.logInfo(`Retrieved ${allStaffItems.length} staff members, checking for match with email ${spUser.email}`);
      
      // Фильтруем локально
      const matchingItems = allStaffItems.filter(item => {
        const fields = item.fields || {};
        // Проверяем поле Email без учета регистра
        return fields.Email && fields.Email.toLowerCase() === spUser.email.toLowerCase();
      });
      
      this.logInfo(`Found ${matchingItems.length} matching staff members for email ${spUser.email}`);
      
      if (matchingItems.length > 0) {
        const userItem = matchingItems[0];
        const fields = userItem.fields || {};
        
        // Логируем найденный элемент для отладки
        this.logInfo(`Staff member data: ${JSON.stringify({
          id: userItem.id,
          title: fields.Title,
          email: fields.Email
        })}`);
        
        const currentUser: ICurrentUser = {
          ID: parseInt(userItem.id) || 0,
          Title: fields.Title || spUser.displayName,
          Email: fields.Email || spUser.email
        };
        
        this.logInfo(`Found current user in Staff list: ${currentUser.Title}`);
        return currentUser;
      } else {
        this.logInfo(`Current user with email ${spUser.email} not found in Staff list`);
        
        // Возвращаем информацию из контекста SharePoint
        return {
          ID: 0,
          Title: spUser.displayName || "Unknown",
          Email: spUser.email
        };
      }
    } catch (staffError) {
      this.logError(`Error getting staff list: ${staffError}`);
      // В случае ошибки все равно возвращаем данные из контекста
      return {
        ID: 0,
        Title: spUser.displayName || "Unknown",
        Email: spUser.email
      };
    }
  } catch (error) {
    this.logError(`Error getting current user: ${error}`);
    // Возвращаем минимальные данные
    return {
      ID: 0,
      Title: "Unknown User",
      Email: ""
    };
  }
}

  /**
   * Получает всех сотрудников из списка Staff на удаленном сайте
   * @returns Promise со списком всех сотрудников
   */
  public async getAllStaff(): Promise<ICurrentUser[]> {
    try {
      this.logInfo("Starting getAllStaff from remote site");
      
      const items = await this.remoteSiteService.getListItems(
        "Staff", 
        true,
        undefined,
        { field: "Title", ascending: true } // Убран префикс fields/
      );
      
      this.logInfo(`Fetched ${items.length} staff members from remote site`);
      
      const staff: ICurrentUser[] = items.map(item => {
        const fields = item.fields || {};
        return {
          ID: parseInt(item.id) || 0,
          Title: fields.Title || "Unknown",
          Email: fields.Email || ""
        };
      });
      
      return staff;
    } catch (error) {
      this.logError(`Error fetching staff from remote site: ${error}`);
      
      // Возвращаем пустой массив вместо выбрасывания исключения
      return [];
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