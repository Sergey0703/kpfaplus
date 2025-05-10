// src/webparts/kpfaplus/services/ContractsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPFI, spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";

import { IContract, IContractFormData } from '../models/IContract';
import { RemoteSiteService } from './RemoteSiteService';

// Интерфейс для данных, которые отправляются в SharePoint
interface ISharePointContractData {
  Title?: string;
  ContractedHoursSchedule?: number;
  Deleted?: number;
  TypeOfWorkerId?: number;
  StartDate?: Date;
  FinishDate?: Date;
  StaffMemberScheduleId?: number;
  ManagerId?: number;
  StaffGroupId?: number;
  [key: string]: unknown; // Для дополнительных полей
}

export class ContractsService {
  private static _instance: ContractsService;
  private _listName: string = "WeeklySchedule";
  private _sp: SPFI;
  private _logSource: string = "ContractsService";
  private _remoteSiteService: RemoteSiteService;

  private constructor(context: WebPartContext) {
    // Инициализация PnP JS с контекстом для локальных операций (будем постепенно уходить от этого)
    this._sp = spfi().using(SPFx(context));
    
    // Инициализация RemoteSiteService для работы с удаленным сайтом
    this._remoteSiteService = RemoteSiteService.getInstance(context);
    
    this.logInfo("ContractsService initialized with RemoteSiteService");
  }

  public static getInstance(context: WebPartContext): ContractsService {
    if (!ContractsService._instance) {
      ContractsService._instance = new ContractsService(context);
    }
    return ContractsService._instance;
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
    if (typeof value === 'number') {
      return value === 1;
    }
    return Boolean(value);
  }

  private ensureDate(value: unknown): Date | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    try {
      // Если value уже является датой
      if (value instanceof Date) {
        return value;
      }
      
      // Если value - строка даты
      if (typeof value === 'string') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? undefined : date;
      }
      
      return undefined;
    } catch (error) {
      this.logError(`Error converting date: ${error}`);
      return undefined;
    }
  }

  /**
 * Получает контракты для указанного сотрудника по его Employee ID через RemoteSiteService
 * @param employeeId ID сотрудника (EmployeeID)
 * @param managerId ID менеджера (необязательно)
 * @param staffGroupId ID группы сотрудников (необязательно)
 * @returns Promise с массивом контрактов
 */
public async getContractsForStaffMember(
  employeeId: string,
  managerId?: string,
  staffGroupId?: string
): Promise<IContract[]> {
  try {
    // Логируем параметры запроса
    if (managerId && staffGroupId) {
      this.logInfo(`Fetching contracts for employee ID: ${employeeId}, manager ID: ${managerId}, staff group ID: ${staffGroupId}`);
    } else {
      this.logInfo(`Fetching contracts for employee ID: ${employeeId}`);
    }
    
    // Преобразуем ID в число для корректной фильтрации (если это числовые ID)
    const employeeIdNum = parseInt(employeeId);
    
    if (isNaN(employeeIdNum)) {
      this.logError(`Invalid employee ID: ${employeeId}`);
      return [];
    }
    
    // Сначала получим несколько элементов для анализа структуры данных
    try {
      const sampleItems = await this._remoteSiteService.getListItems(
        this._listName,
        true,
        undefined,  // Без фильтра
        { field: "Title", ascending: true }
      );
      
      // Анализируем структуру первого элемента (если есть)
      if (sampleItems.length > 0) {
        const sampleItem = sampleItems[0];
        const fields = sampleItem.fields || {};
        
        this.logInfo(`Sample item structure: ${JSON.stringify(fields, null, 2)}`);
        
        // Определяем правильные имена полей для lookup-полей
        let staffMemberFieldName = "StaffMemberScheduleId";
        let managerFieldName = "ManagerId";
        let staffGroupFieldName = "StaffGroupId";
        
        // Проверяем наличие LookupId вариантов полей
        if (fields.StaffMemberScheduleLookupId !== undefined) {
          staffMemberFieldName = "StaffMemberScheduleLookupId";
          this.logInfo(`Using field name "${staffMemberFieldName}" for StaffMember filtering`);
        }
        
        if (fields.ManagerLookupId !== undefined) {
          managerFieldName = "ManagerLookupId";
          this.logInfo(`Using field name "${managerFieldName}" for Manager filtering`);
        }
        
        if (fields.StaffGroupLookupId !== undefined) {
          staffGroupFieldName = "StaffGroupLookupId";
          this.logInfo(`Using field name "${staffGroupFieldName}" for StaffGroup filtering`);
        }
        
        // Строим фильтр с правильными именами полей
        // ВАЖНО: для MS Graph API всем полям нужен префикс fields/
        let filter = `${staffMemberFieldName} eq ${employeeIdNum}`;
        
        // Добавляем условия для менеджера, если указан
        if (managerId) {
          const managerIdNum = parseInt(managerId);
          if (!isNaN(managerIdNum)) {
            filter += ` and fields/${managerFieldName} eq ${managerIdNum}`;
          }
        }
        
        // Добавляем условия для группы, если указана
        if (staffGroupId) {
          const staffGroupIdNum = parseInt(staffGroupId);
          if (!isNaN(staffGroupIdNum)) {
            filter += ` and fields/${staffGroupFieldName} eq ${staffGroupIdNum}`;
          }
        }
        
        this.logInfo(`Using filter for contracts: ${filter}`);
        
        // Получаем элементы с применением только серверной фильтрации
        const items = await this._remoteSiteService.getListItems(
          this._listName,
          true,
          filter,
          { field: "Title", ascending: true }
        );
        
        this.logInfo(`Retrieved ${items.length} contracts for employee ID: ${employeeId}`);
        
        // Преобразуем данные в формат IContract прямо здесь
        const contracts: IContract[] = [];
        
        for (const item of items) {
          try {
            const fields = item.fields || {};
            
            // Проверяем поле Deleted
            const isDeleted = this.ensureBoolean(fields.Deleted);
            
            // Получаем информацию о типе работника
            let typeOfWorkerInfo = { id: '', value: '' };
            if (fields.TypeOfWorkerLookupId !== undefined) {
              typeOfWorkerInfo = { 
                id: this.ensureString(fields.TypeOfWorkerLookupId), 
                value: this.ensureString(fields.TypeOfWorkerLookup) || 'Unknown Type'
              };
            } else if (fields.TypeOfWorkerId !== undefined) {
              typeOfWorkerInfo = { 
                id: this.ensureString(fields.TypeOfWorkerId), 
                value: this.ensureString(fields.TypeOfWorkerTitle) || 'Unknown Type'
              };
            } else if (fields.TypeOfWorker && typeof fields.TypeOfWorker === 'object') {
              const typeObj = fields.TypeOfWorker as Record<string, unknown>;
              typeOfWorkerInfo = {
                id: this.ensureString(typeObj.Id || typeObj.id),
                value: this.ensureString(typeObj.Title || typeObj.title)
              };
            }
            
            // Получаем информацию о сотруднике
            let staffMemberInfo = undefined;
            if (fields.StaffMemberScheduleLookupId !== undefined) {
              staffMemberInfo = {
                id: this.ensureString(fields.StaffMemberScheduleLookupId),
                value: this.ensureString(fields.StaffMemberScheduleLookup) || 'Unknown Staff'
              };
            } else if (fields.StaffMemberScheduleId !== undefined) {
              staffMemberInfo = {
                id: this.ensureString(fields.StaffMemberScheduleId),
                value: this.ensureString(fields.StaffMemberScheduleTitle) || 'Unknown Staff'
              };
            } else if (fields.StaffMemberSchedule && typeof fields.StaffMemberSchedule === 'object') {
              const staffObj = fields.StaffMemberSchedule as Record<string, unknown>;
              staffMemberInfo = {
                id: this.ensureString(staffObj.Id || staffObj.id),
                value: this.ensureString(staffObj.Title || staffObj.title)
              };
            }
            
            // Получаем информацию о менеджере
            let managerInfo = undefined;
            if (fields.ManagerLookupId !== undefined) {
              managerInfo = {
                id: this.ensureString(fields.ManagerLookupId),
                value: this.ensureString(fields.ManagerLookup) || 'Unknown Manager'
              };
            } else if (fields.ManagerId !== undefined) {
              managerInfo = {
                id: this.ensureString(fields.ManagerId),
                value: this.ensureString(fields.ManagerTitle) || 'Unknown Manager'
              };
            } else if (fields.Manager && typeof fields.Manager === 'object') {
              const managerObj = fields.Manager as Record<string, unknown>;
              managerInfo = {
                id: this.ensureString(managerObj.Id || managerObj.id),
                value: this.ensureString(managerObj.Title || managerObj.title)
              };
            }
            
            // Получаем информацию о группе
            let staffGroupInfo = undefined;
            if (fields.StaffGroupLookupId !== undefined) {
              staffGroupInfo = {
                id: this.ensureString(fields.StaffGroupLookupId),
                value: this.ensureString(fields.StaffGroupLookup) || 'Unknown Group'
              };
            } else if (fields.StaffGroupId !== undefined) {
              staffGroupInfo = {
                id: this.ensureString(fields.StaffGroupId),
                value: this.ensureString(fields.StaffGroupTitle) || 'Unknown Group'
              };
            } else if (fields.StaffGroup && typeof fields.StaffGroup === 'object') {
              const groupObj = fields.StaffGroup as Record<string, unknown>;
              staffGroupInfo = {
                id: this.ensureString(groupObj.Id || groupObj.id),
                value: this.ensureString(groupObj.Title || groupObj.title)
              };
            }
            
            // Создаем объект контракта
            const contract: IContract = {
              id: this.ensureString(item.id),
              template: this.ensureString(fields.Title),
              typeOfWorker: typeOfWorkerInfo,
              contractedHours: this.ensureNumber(fields.ContractedHoursSchedule),
              startDate: this.ensureDate(fields.StartDate),
              finishDate: this.ensureDate(fields.FinishDate),
              isDeleted: isDeleted,
              staffMember: staffMemberInfo,
              manager: managerInfo,
              staffGroup: staffGroupInfo
            };
            
            this.logInfo(`Mapped contract: ID=${contract.id}, Title=${contract.template}`);
            
            // Добавляем контракт в список результатов
            contracts.push(contract);
          } catch (itemError) {
            this.logError(`Error processing contract item: ${itemError}`);
            // Продолжаем обработку других элементов
          }
        }
        
        return contracts;
      } else {
        this.logInfo(`No sample items found in list "${this._listName}". Using default field names.`);
        
        // Если не удалось получить образцы, используем стандартные имена полей
        // с правильным форматированием для MS Graph API
        let filter = `fields/StaffMemberScheduleLookupId eq ${employeeIdNum}`;
        
        // Добавляем условия для менеджера, если указан
        if (managerId) {
          const managerIdNum = parseInt(managerId);
          if (!isNaN(managerIdNum)) {
            filter += ` and fields/ManagerLookupId eq ${managerIdNum}`;
          }
        }
        
        // Добавляем условия для группы, если указана
        if (staffGroupId) {
          const staffGroupIdNum = parseInt(staffGroupId);
          if (!isNaN(staffGroupIdNum)) {
            filter += ` and fields/StaffGroupLookupId eq ${staffGroupIdNum}`;
          }
        }
        
        this.logInfo(`Using default filter for contracts: ${filter}`);
        
        // Получаем элементы только с серверной фильтрацией
        const items = await this._remoteSiteService.getListItems(
          this._listName,
          true,
          filter,
          { field: "Title", ascending: true }
        );
        
        this.logInfo(`Retrieved ${items.length} contracts with default filter`);
        
        // Преобразуем данные в формат IContract аналогично как выше
        const contracts: IContract[] = [];
        
        for (const item of items) {
          try {
            const fields = item.fields || {};
            
            // Проверяем поле Deleted
            const isDeleted = this.ensureBoolean(fields.Deleted);
            
            // Получаем информацию о типе работника
            let typeOfWorkerInfo = { id: '', value: '' };
            if (fields.TypeOfWorkerLookupId !== undefined) {
              typeOfWorkerInfo = { 
                id: this.ensureString(fields.TypeOfWorkerLookupId), 
                value: this.ensureString(fields.TypeOfWorkerLookup) || 'Unknown Type'
              };
            } else if (fields.TypeOfWorkerId !== undefined) {
              typeOfWorkerInfo = { 
                id: this.ensureString(fields.TypeOfWorkerId), 
                value: this.ensureString(fields.TypeOfWorkerTitle) || 'Unknown Type'
              };
            } else if (fields.TypeOfWorker && typeof fields.TypeOfWorker === 'object') {
              const typeObj = fields.TypeOfWorker as Record<string, unknown>;
              typeOfWorkerInfo = {
                id: this.ensureString(typeObj.Id || typeObj.id),
                value: this.ensureString(typeObj.Title || typeObj.title)
              };
            }
            
            // И далее аналогично...
            // (код аналогичен блоку выше)
            
            const contract: IContract = {
              id: this.ensureString(item.id),
              template: this.ensureString(fields.Title),
              typeOfWorker: typeOfWorkerInfo,
              contractedHours: this.ensureNumber(fields.ContractedHoursSchedule),
              startDate: this.ensureDate(fields.StartDate),
              finishDate: this.ensureDate(fields.FinishDate),
              isDeleted: isDeleted,
              // Остальные поля...
            };
            
            contracts.push(contract);
          } catch (itemError) {
            this.logError(`Error processing contract item: ${itemError}`);
          }
        }
        
        return contracts;
      }
    } catch (sampleError) {
      this.logError(`Error getting sample items: ${sampleError}`);
      return [];
    }
  } catch (error) {
    this.logError(`Error fetching contracts via RemoteSiteService: ${error}`);
    return [];
  }
}

  /**
   * Сохраняет изменения в существующем контракте или создает новый
   * @param contractData Данные контракта для сохранения
   * @returns ID сохраненного контракта
   */
  public async saveContract(contractData: IContractFormData): Promise<string> {
    try {
      this.logInfo(`Saving contract: ${JSON.stringify(contractData)}`);
      
      const list = this._sp.web.lists.getByTitle(this._listName);
      
      // Подготавливаем данные для SharePoint
      const itemData: ISharePointContractData = {
        Title: contractData.template || '',
        ContractedHoursSchedule: contractData.contractedHours || 0,
        Deleted: contractData.isDeleted === true ? 1 : 0
      };
      
      // Добавляем ID типа работника, если он есть
      if (contractData.typeOfWorkerId && contractData.typeOfWorkerId !== '') {
        try {
          itemData.TypeOfWorkerId = parseInt(contractData.typeOfWorkerId);
        } catch (e) {
          console.warn(`Could not parse typeOfWorkerId: ${contractData.typeOfWorkerId}`, e);
        }
      }
      
      // Добавляем дату начала, если она есть
      if (contractData.startDate) {
        itemData.StartDate = contractData.startDate;
      }
      
      // Добавляем дату окончания, если она есть
      if (contractData.finishDate) {
        itemData.FinishDate = contractData.finishDate;
      }
      
      // Добавляем ID сотрудника, если он есть
      if (contractData.staffMemberId) {
        try {
          // Преобразуем в число, если это строка
          const staffMemberId = typeof contractData.staffMemberId === 'string' 
            ? parseInt(contractData.staffMemberId) 
            : contractData.staffMemberId;
            
          if (!isNaN(staffMemberId)) {
            itemData.StaffMemberScheduleId = staffMemberId;
          } else {
            console.warn(`Invalid staffMemberId: ${contractData.staffMemberId}`);
          }
        } catch (e) {
          console.warn(`Error setting StaffMemberScheduleId: ${e}`);
        }
      }
      
      // Добавляем ID менеджера, если он есть
      if (contractData.managerId) {
        try {
          // Преобразуем в число, если это строка
          const managerId = typeof contractData.managerId === 'string' 
            ? parseInt(contractData.managerId) 
            : contractData.managerId;
            
          if (!isNaN(managerId)) {
            itemData.ManagerId = managerId;
          } else {
            console.warn(`Invalid managerId: ${contractData.managerId}`);
          }
        } catch (e) {
          console.warn(`Error setting ManagerId: ${e}`);
        }
      }
      
      // Добавляем ID группы сотрудников, если он есть
      if (contractData.staffGroupId) {
        try {
          // Преобразуем в число, если это строка
          const staffGroupId = typeof contractData.staffGroupId === 'string' 
            ? parseInt(contractData.staffGroupId) 
            : contractData.staffGroupId;
            
          if (!isNaN(staffGroupId)) {
            itemData.StaffGroupId = staffGroupId;
          } else {
            console.warn(`Invalid staffGroupId: ${contractData.staffGroupId}`);
          }
        } catch (e) {
          console.warn(`Error setting StaffGroupId: ${e}`);
        }
      }
      
      this.logInfo(`Prepared item data for save: ${JSON.stringify(itemData, null, 2)}`);
      
      let result;
      
      // Если есть ID, то обновляем, иначе создаем новый
      if (contractData.id && contractData.id !== 'new') {
        this.logInfo(`Updating existing contract ID: ${contractData.id}`);
        await list.items.getById(parseInt(contractData.id)).update(itemData);
        result = contractData.id;
      } else {
        this.logInfo('Creating new contract with data: ' + JSON.stringify(itemData));
        
        try {
          // Добавляем элемент в список
          const addResult = await list.items.add(itemData);
          
          // Получаем ID созданного элемента безопасным способом
          if (addResult && addResult.data && addResult.data.ID) {
            result = addResult.data.ID.toString();
            this.logInfo(`Created new contract with ID: ${result}`);
          } else {
            throw new Error('Failed to get ID from the created item');
          }
        } catch (error) {
          this.logError(`Error in add operation: ${error}`);
          
          // План Б: попробуем найти только что созданный элемент используя правильный метод для PnP JS
          const newItems = await list.items
            .filter(`Title eq '${itemData.Title}'`)
            .orderBy('Created', false)
            .top(1)(); // Используем () вместо get() для вызова запроса
            
          if (newItems && newItems.length > 0) {
            result = newItems[0].ID.toString();
            this.logInfo(`Found newly created item with ID: ${result}`);
          } else {
            throw error; // Если не нашли элемент, пробрасываем исходную ошибку
          }
        }
      }
      
      return result;
    } catch (error) {
      this.logError(`Error saving contract: ${error}`);
      throw error;
    }
  }

  /**
   * Помечает контракт как удаленный (не удаляет физически)
   * @param contractId ID контракта
   */
  public async markContractAsDeleted(contractId: string): Promise<void> {
    try {
      this.logInfo(`Marking contract as deleted, ID: ${contractId}`);
      
      if (!contractId) {
        throw new Error("Contract ID is empty or invalid");
      }
      
      const contractIdNumber = parseInt(contractId);
      if (isNaN(contractIdNumber)) {
        throw new Error(`Invalid contract ID format: ${contractId}`);
      }
      
      // Add more verbose logging
      this.logInfo(`About to update contract ${contractId} in list ${this._listName}`);
      
      const result = await this._sp.web.lists.getByTitle(this._listName).items
        .getById(contractIdNumber)
        .update({
          Deleted: 1
        });
        
      this.logInfo(`Update result: ${JSON.stringify(result)}`);
      this.logInfo(`Successfully marked contract as deleted, ID: ${contractId}`);
    } catch (error) {
      this.logError(`Error marking contract as deleted: ${error}`);
      throw error;
    }
  }

  public async markContractAsNotDeleted(contractId: string): Promise<void> {
    try {
      this.logInfo(`Marking contract as not deleted: ${contractId}`);
      
      // Обновляем флаг Deleted в SharePoint
      await this._sp.web.lists.getByTitle(this._listName)
        .items.getById(parseInt(contractId))
        .update({
          Deleted: 0
        });
      
      this.logInfo(`Contract ${contractId} marked as not deleted successfully`);
    } catch (error) {
      this.logError(`Error marking contract as not deleted: ${error}`);
      throw error;
    }
  }
  
  /**
   * Helper method to log info messages
   * @param message Message to log
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * Helper method to log error messages
   * @param message Error message to log
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}