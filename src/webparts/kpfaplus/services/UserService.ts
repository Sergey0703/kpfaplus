// src/webparts/kpfaplus/services/UserService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { RemoteSiteService } from "./RemoteSiteService";
import { IUserInfo } from "../models/types";

export interface ICurrentUser {
  ID: number;
  Title: string;
  Email: string;
}

export class UserService {
  private logSource: string = "UserService";
  private remoteSiteService: RemoteSiteService;
  private context: WebPartContext;
  
  // --- NEW IMPERSONATION PROPERTIES ---
  private _originalUser: IUserInfo | undefined = undefined;
  private _impersonatedUser: IUserInfo | undefined = undefined;
  private _isImpersonating: boolean = false;
  // --- END NEW PROPERTIES ---

  constructor(context: WebPartContext) {
    this.context = context;
    // Получаем экземпляр RemoteSiteService
    this.remoteSiteService = RemoteSiteService.getInstance(context);
  }

  /**
   * Преобразует значение в строку
   * @param value Любое значение
   * @returns Строковое представление
   */
  private ensureString(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  /**
   * Преобразует значение в число
   * @param value Любое значение
   * @returns Числовое представление
   */
  private ensureNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * --- NEW METHOD ---
   * Converts ICurrentUser to IUserInfo format
   * @param user ICurrentUser object
   * @returns IUserInfo object
   */
  private convertToUserInfo(user: ICurrentUser): IUserInfo {
    return {
      ID: user.ID,
      Title: user.Title,
      Email: user.Email
    };
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
          // Преобразуем Email в строку и проверяем без учета регистра
          const email = this.ensureString(fields.Email);
          return email && email.toLowerCase() === spUser.email.toLowerCase();
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
            ID: this.ensureNumber(userItem.id),
            Title: this.ensureString(fields.Title) || spUser.displayName,
            Email: this.ensureString(fields.Email) || spUser.email
          };
          
          this.logInfo(`Found current user in Staff list: ${currentUser.Title}`);
          
          // --- NEW: Store original user on first load ---
          if (!this._originalUser && !this._isImpersonating) {
            this._originalUser = this.convertToUserInfo(currentUser);
            this.logInfo(`Stored original user: ${this._originalUser.Title}`);
          }
          // --- END NEW ---
          
          return currentUser;
        } else {
          this.logInfo(`Current user with email ${spUser.email} not found in Staff list`);
          
          // Возвращаем информацию из контекста SharePoint
          const fallbackUser: ICurrentUser = {
            ID: 0,
            Title: spUser.displayName || "Unknown",
            Email: spUser.email
          };
          
          // --- NEW: Store original user on first load ---
          if (!this._originalUser && !this._isImpersonating) {
            this._originalUser = this.convertToUserInfo(fallbackUser);
            this.logInfo(`Stored fallback original user: ${this._originalUser.Title}`);
          }
          // --- END NEW ---
          
          return fallbackUser;
        }
      } catch (staffError) {
        this.logError(`Error getting staff list: ${staffError}`);
        // В случае ошибки все равно возвращаем данные из контекста
        const errorFallbackUser: ICurrentUser = {
          ID: 0,
          Title: spUser.displayName || "Unknown",
          Email: spUser.email
        };
        
        // --- NEW: Store original user on first load ---
        if (!this._originalUser && !this._isImpersonating) {
          this._originalUser = this.convertToUserInfo(errorFallbackUser);
          this.logInfo(`Stored error fallback original user: ${this._originalUser.Title}`);
        }
        // --- END NEW ---
        
        return errorFallbackUser;
      }
    } catch (error) {
      this.logError(`Error getting current user: ${error}`);
      // Возвращаем минимальные данные
      const minimalUser: ICurrentUser = {
        ID: 0,
        Title: "Unknown User",
        Email: ""
      };
      
      // --- NEW: Store original user on first load ---
      if (!this._originalUser && !this._isImpersonating) {
        this._originalUser = this.convertToUserInfo(minimalUser);
        this.logInfo(`Stored minimal original user: ${this._originalUser.Title}`);
      }
      // --- END NEW ---
      
      return minimalUser;
    }
  }

  /**
   * --- NEW METHOD ---
   * Gets the effective current user (impersonated user if active, otherwise original user)
   * @returns Promise with the effective current user data
   */
  public async getEffectiveCurrentUser(): Promise<ICurrentUser | undefined> {
    if (this._isImpersonating && this._impersonatedUser) {
      this.logInfo(`Returning impersonated user: ${this._impersonatedUser.Title} (ID: ${this._impersonatedUser.ID})`);
      return {
        ID: this._impersonatedUser.ID,
        Title: this._impersonatedUser.Title,
        Email: this._impersonatedUser.Email
      };
    }
    
    // Return original user
    this.logInfo("Returning original current user");
    return this.getCurrentUser();
  }

  /**
   * --- NEW METHOD ---
   * Starts impersonating a specific user
   * @param user The user to impersonate
   */
  public startImpersonation(user: IUserInfo): void {
    this.logInfo(`Starting impersonation of user: ${user.Title} (ID: ${user.ID})`);
    
    // Ensure we have original user stored
    if (!this._originalUser) {
      this.logError("Cannot start impersonation: original user not stored");
      return;
    }
    
    this._impersonatedUser = { ...user }; // Clone the user object
    this._isImpersonating = true;
    
    this.logInfo(`Impersonation started. Acting as: ${this._impersonatedUser.Title}`);
  }

  /**
   * --- NEW METHOD ---
   * Stops impersonation and returns to original user
   */
  public stopImpersonation(): void {
    if (!this._isImpersonating) {
      this.logInfo("No active impersonation to stop");
      return;
    }
    
    const previousImpersonatedUser = this._impersonatedUser?.Title || "Unknown";
    
    this._impersonatedUser = undefined;
    this._isImpersonating = false;
    
    this.logInfo(`Impersonation stopped. Returned from: ${previousImpersonatedUser} to original user: ${this._originalUser?.Title || "Unknown"}`);
  }

  /**
   * --- NEW METHOD ---
   * Gets the current impersonation state
   * @returns Object with impersonation state information
   */
  public getImpersonationState(): {
    originalUser: IUserInfo | undefined;
    impersonatedUser: IUserInfo | undefined;
    isImpersonating: boolean;
  } {
    return {
      originalUser: this._originalUser ? { ...this._originalUser } : undefined,
      impersonatedUser: this._impersonatedUser ? { ...this._impersonatedUser } : undefined,
      isImpersonating: this._isImpersonating
    };
  }

  /**
   * --- NEW METHOD ---
   * Gets the effective user as IUserInfo
   * @returns The effective user (impersonated or original)
   */
  public getEffectiveUserInfo(): IUserInfo | undefined {
    if (this._isImpersonating && this._impersonatedUser) {
      return { ...this._impersonatedUser };
    }
    
    return this._originalUser ? { ...this._originalUser } : undefined;
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
        { field: "Title", ascending: true }
      );
      
      this.logInfo(`Fetched ${items.length} staff members from remote site`);
      
      const staff: ICurrentUser[] = items.map(item => {
        const fields = item.fields || {};
        return {
          ID: this.ensureNumber(item.id),
          Title: this.ensureString(fields.Title),
          Email: this.ensureString(fields.Email)
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
   * --- NEW METHOD ---
   * Gets all staff members as IUserInfo objects (useful for impersonation selectors)
   * @returns Promise with array of staff members in IUserInfo format
   */
  public async getAllStaffAsUserInfo(): Promise<IUserInfo[]> {
    try {
      const staff = await this.getAllStaff();
      return staff.map(member => this.convertToUserInfo(member));
    } catch (error) {
      this.logError(`Error fetching staff as UserInfo: ${error}`);
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