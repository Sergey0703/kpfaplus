// src/webparts/kpfaplus/services/ContractsService.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { SPFI, spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import "@pnp/sp/fields";

import { IContract, IContractFormData } from '../models/IContract';

export class ContractsService {
  private static _instance: ContractsService;
  private _listName: string = "WeeklySchedule";
  private _sp: SPFI;
  private _logSource: string = "ContractsService";

  private constructor(context: WebPartContext) {
    // Инициализация PnP JS с контекстом в самом сервисе
    this._sp = spfi().using(SPFx(context));
  }

  public static getInstance(context: WebPartContext): ContractsService {
    if (!ContractsService._instance) {
      ContractsService._instance = new ContractsService(context);
    }
    return ContractsService._instance;
  }

/**
 * Получает контракты для указанного сотрудника по его Employee ID
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
      
      // Создаем базовый фильтр по EmployeeID
      // Важное изменение: меняем StaffMemberSchedule/Id на StaffMemberSchedule/Employee/Id
      let filter = `StaffMemberSchedule eq ${employeeIdNum}`;
      
      // Добавляем дополнительные условия, если они указаны
      if (managerId) {
        const managerIdNum = parseInt(managerId);
        filter += ` and Manager/Id eq ${managerIdNum}`;
      }
      
      if (staffGroupId) {
        const staffGroupIdNum = parseInt(staffGroupId);
        filter += ` and StaffGroup/Id eq ${staffGroupIdNum}`;
      }
      
      // Получение данных из списка WeeklySchedule
      const items = await this._sp.web.lists.getByTitle(this._listName).items
        .select("ID,Title,Deleted,TypeOfWorker/Id,TypeOfWorker/Title,ContractedHoursSchedule,StartDate,FinishDate,StaffMemberSchedule/Id,StaffMemberSchedule/Title")
        .expand("TypeOfWorker,StaffMemberSchedule")
        .filter(filter)();
      
      this.logInfo(`Fetched ${items.length} contracts for employee ID: ${employeeId}`);
      
      // Маппинг данных в формат IContract
      return items.map((item: any) => this.mapSharePointItemToContract(item));
    } catch (error) {
      this.logError(`Error fetching contracts: ${error}`);
      throw error;
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
      const itemData = {
        Title: contractData.template,
        TypeOfWorkerId: parseInt(contractData.typeOfWorkerId) || null,
        ContractedHoursSchedule: contractData.contractedHours,
        StartDate: contractData.startDate,
        FinishDate: contractData.finishDate,
        Deleted: contractData.isDeleted || 0
      //  StaffMemberScheduleId: contractData.staffMemberId ? parseInt(contractData.staffMemberId) : null
      };
      
      let result;
      
      // Если есть ID, то обновляем, иначе создаем новый
      if (contractData.id && contractData.id !== 'new') {
        this.logInfo(`Updating existing contract ID: ${contractData.id}`);
        await list.items.getById(parseInt(contractData.id)).update(itemData);
        result = contractData.id;
      } else {
        this.logInfo('Creating new contract');
        const response = await list.items.add(itemData);
        result = response.data.ID.toString();
        this.logInfo(`Created new contract with ID: ${result}`);
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
      
      await this._sp.web.lists.getByTitle(this._listName).items
        .getById(parseInt(contractId))
        .update({
          Deleted: 1
        });
        
      this.logInfo(`Successfully marked contract as deleted, ID: ${contractId}`);
    } catch (error) {
      this.logError(`Error marking contract as deleted: ${error}`);
      throw error;
    }
  }

  // В файле ContractsService.ts
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
   * Преобразует элемент SharePoint в формат IContract
   * @param item Элемент из SharePoint
   * @returns Отформатированный объект контракта
   */
  /**
 * Преобразует элемент SharePoint в формат IContract
 * @param item Элемент из SharePoint
 * @returns Отформатированный объект контракта
 */
private mapSharePointItemToContract(item: any): IContract {
    return {
      id: item.ID.toString(),
      template: item.Title || '',
      typeOfWorker: item.TypeOfWorker ? {
        id: item.TypeOfWorker.Id.toString(),
        value: item.TypeOfWorker.Title || ''
      } : { id: '', value: '' },
      contractedHours: item.ContractedHoursSchedule || 0,
      startDate: item.StartDate ? new Date(item.StartDate) : null,
      finishDate: item.FinishDate ? new Date(item.FinishDate) : null,
      isDeleted: item.Deleted === 1, // Преобразуем числовое значение в boolean
      manager: item.Manager ? {
        id: item.Manager.Id.toString(),
        value: item.Manager.Title || ''
      } : undefined,
      staffGroup: item.StaffGroup ? {
        id: item.StaffGroup.Id.toString(),
        value: item.StaffGroup.Title || ''
      } : undefined,
      staffMember: item.StaffMemberSchedule ? {
        id: item.StaffMemberSchedule.Id.toString(),
        value: item.StaffMemberSchedule.Title || ''
      } : undefined
    };
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