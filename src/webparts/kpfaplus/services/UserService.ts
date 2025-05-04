// src/webparts/kpfaplus/services/UserService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/site-users/web";

export interface ICurrentUser {
  ID: number;
  Title: string;
  Email: string;
  // Удалили поле Department
}

export class UserService {
  private sp: ReturnType<typeof spfi>;
  private logSource: string = "UserService";

  constructor(context: WebPartContext) {
    // Инициализация PnP JS с контекстом SPFx
    this.sp = spfi().using(SPFx(context));
  }

  /**
   * Получает информацию о текущем пользователе из списка Staff
   * @returns Promise с данными текущего пользователя
   */
  public async getCurrentUser(): Promise<ICurrentUser | undefined> {
    try {
      this.logInfo("Starting getCurrentUser");
      
      // Получаем email текущего пользователя из контекста
      const currentUser = await this.sp.web.currentUser();
      const currentUserEmail = currentUser.Email;
      
      this.logInfo(`Current user email: ${currentUserEmail}`);
      
      // Ищем пользователя в списке Staff по email
      const items = await this.sp.web.lists
        .getByTitle("Staff") // Название вашего списка
        .items
        .filter(`Email eq '${currentUserEmail}'`)
        .select("ID,Title,Email")
        // Удалили expand для Department
        .top(1)
        ();
      
      if (items.length > 0) {
        const userItem = items[0];
        
        const currentUser: ICurrentUser = {
          ID: userItem.ID,
          Title: userItem.Title,
          Email: userItem.Email
          // Удалили свойство Department
        };
        
        this.logInfo(`Found current user: ${currentUser.Title}`);
        return currentUser;
      } else {
        this.logInfo("Current user not found in Staff list");
        return undefined;
      }
    } catch (error) {
      this.logError(`Error getting current user: ${error}`);
      throw error;
    }
  }

  /**
   * Получает всех сотрудников из списка Staff
   * @returns Promise со списком всех сотрудников
   */
  public async getAllStaff(): Promise<ICurrentUser[]> {
    try {
      this.logInfo("Starting getAllStaff");
      
      const items = await this.sp.web.lists
        .getByTitle("Staff") // Название вашего списка
        .items
        .select("ID,Title,Email")
        // Удалили expand для Department
        .top(5000) // Ограничение выборки
        ();
      
      const staff: ICurrentUser[] = items.map(item => ({
        ID: item.ID,
        Title: item.Title,
        Email: item.Email
        // Удалили свойство Department
      }));
      
      this.logInfo(`Fetched ${staff.length} staff members`);
      return staff;
    } catch (error) {
      this.logError(`Error fetching staff: ${error}`);
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