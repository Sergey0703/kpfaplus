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
   * Получает контракты для указанного сотрудника
   * @param staffMemberId ID сотрудника
   * @returns Promise с массивом контрактов
   */
  public async getContractsForStaffMember(staffMemberId: string): Promise<IContract[]> {
    try {
      this.logInfo(`Fetching contracts for staff member ID: ${staffMemberId}`);
      
      // Получение данных из списка WeeklySchedule
      const items = await this._sp.web.lists.getByTitle(this._listName).items
      .select("ID,Title,Deleted,TypeOfWorker/Id,TypeOfWorker/Title,ContractedHoursSchedule,StartDate,FinishDate,Manager/Id,Manager/Title,StaffGroup/Id,StaffGroup/Title,StaffMemberSchedule/Id,StaffMemberSchedule/Title")
      .expand("TypeOfWorker,Manager,StaffGroup,StaffMemberSchedule")
      .filter(`StaffMemberSchedule/Id eq ${staffMemberId}`)();
      
      this.logInfo(`Fetched ${items.length} contracts for staff member ID: ${staffMemberId}`);
      
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
        Deleted: contractData.isDeleted || false,
        StaffMemberScheduleId: contractData.staffMemberId ? parseInt(contractData.staffMemberId) : null
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
          Deleted: true
        });
        
      this.logInfo(`Successfully marked contract as deleted, ID: ${contractId}`);
    } catch (error) {
      this.logError(`Error marking contract as deleted: ${error}`);
      throw error;
    }
  }

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
        id: item.TypeOfWorker.Id,
        value: item.TypeOfWorker.Value
      } : { id: '', value: '' },
      contractedHours: item.ContractedHoursSchedule || 0,
      startDate: item.StartDate ? new Date(item.StartDate) : null,
      finishDate: item.FinishDate ? new Date(item.FinishDate) : null,
      isDeleted: item.Deleted === true,
      manager: item.Manager ? {
        id: item.Manager.Id,
        value: item.Manager.Value
      } : undefined,
      staffGroup: item.StaffGroup ? {
        id: item.StaffGroup.Id,
        value: item.StaffGroup.Value
      } : undefined,
      staffMember: item.StaffMemberSchedule ? {
        id: item.StaffMemberSchedule.Id,
        value: item.StaffMemberSchedule.Value
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