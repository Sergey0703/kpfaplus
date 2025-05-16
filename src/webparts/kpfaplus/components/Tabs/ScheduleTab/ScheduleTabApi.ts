// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabApi.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { ContractsService } from '../../../services/ContractsService';
import { HolidaysService, IHoliday } from '../../../services/HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from '../../../services/DaysOfLeavesService';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { IContract } from '../../../models/IContract';

/**
* Функция для загрузки праздников для конкретного месяца и года
*/
export const fetchHolidaysForMonthAndYear = async (
 context: WebPartContext,
 date: Date,
 setIsLoadingHolidays: (isLoading: boolean) => void,
 setHolidays: (holidays: IHoliday[]) => void,
 setError: (error?: string) => void
): Promise<void> => {
 const holidaysService = HolidaysService.getInstance(context);
 if (!holidaysService) return;
 
 setIsLoadingHolidays(true);
 
 try {
   const year = date.getFullYear();
   const month = date.getMonth() + 1; // +1 потому что getMonth() возвращает 0-11
   
   console.log(`[ScheduleTab] Fetching holidays for year: ${year}, month: ${month}`);
   
   // Используем метод для получения праздников за месяц с фильтрацией на сервере
   const holidaysData = await holidaysService.getHolidaysByMonthAndYear(date);
   
   console.log(`[ScheduleTab] Retrieved ${holidaysData.length} holidays for month ${month}/${year}`);
   setHolidays(holidaysData);
   
   // Логируем первые несколько праздников для проверки
   if (holidaysData.length > 0) {
     const sampleHolidays = holidaysData.slice(0, 3);
     console.log("[ScheduleTab] Sample holidays:", sampleHolidays);
   }
 } catch (err) {
   console.error(`Error fetching holidays for month ${date.getMonth() + 1} and year ${date.getFullYear()}:`, err);
   setError(`Failed to load holidays. ${err instanceof Error ? err.message : ''}`);
 } finally {
   setIsLoadingHolidays(false);
 }
};

/**
* Функция для загрузки всех типов отпусков
*/
export const fetchTypesOfLeave = async (
 context: WebPartContext,
 typeOfLeaveService: TypeOfLeaveService,
 setIsLoadingTypesOfLeave: (isLoading: boolean) => void,
 setTypesOfLeave: (typesOfLeave: ITypeOfLeave[]) => void,
 setError: (error?: string) => void
): Promise<void> => {
 if (!typeOfLeaveService) return;
 
 setIsLoadingTypesOfLeave(true);
 
 try {
   console.log('[ScheduleTab] Fetching types of leave');
   
   // Получаем все типы отпусков без фильтрации
   const typesOfLeaveData = await typeOfLeaveService.getAllTypesOfLeave(true); // true для форсирования обновления кэша
   
   console.log(`[ScheduleTab] Retrieved ${typesOfLeaveData.length} types of leave`);
   setTypesOfLeave(typesOfLeaveData);
   
   // Логируем первые несколько типов отпусков для проверки
   if (typesOfLeaveData.length > 0) {
     const sampleTypes = typesOfLeaveData.slice(0, 3);
     console.log("[ScheduleTab] Sample types of leave:", sampleTypes);
   }
 } catch (err) {
   console.error(`Error fetching types of leave:`, err);
   setError(`Failed to load types of leave. ${err instanceof Error ? err.message : ''}`);
 } finally {
   setIsLoadingTypesOfLeave(false);
 }
};

/**
* Функция для загрузки отпусков для месяца и года
*/
export const fetchLeavesForMonthAndYear = async (
 context: WebPartContext,
 date: Date,
 staffMemberId: number,
 managerId?: number,
 staffGroupId?: number,
 setIsLoadingLeaves?: (isLoading: boolean) => void,
 setLeaves?: (leaves: ILeaveDay[]) => void,
 setError?: (error?: string) => void
): Promise<ILeaveDay[]> => {
 const daysOfLeavesService = DaysOfLeavesService.getInstance(context);
 if (!daysOfLeavesService || !staffMemberId) return [];
 
 if (setIsLoadingLeaves) {
   setIsLoadingLeaves(true);
 }
 
 try {
   console.log(`[ScheduleTab] Fetching leaves for date: ${date.toLocaleDateString()}, staffMemberId: ${staffMemberId}, managerId: ${managerId}, staffGroupId: ${staffGroupId}`);
   
   const leavesData = await daysOfLeavesService.getLeavesForMonthAndYear(
     date,
     staffMemberId,
     managerId || 0,
     staffGroupId || 0
   );
   
   console.log(`[ScheduleTab] Retrieved ${leavesData.length} leaves for month ${date.getMonth() + 1} and year ${date.getFullYear()}`);
   
   if (setLeaves) {
     setLeaves(leavesData);
   }
   
   // Логируем первые несколько отпусков для проверки
   if (leavesData.length > 0) {
     const sampleLeaves = leavesData.slice(0, 3);
     console.log("[ScheduleTab] Sample leaves:", sampleLeaves);
   }
   
   return leavesData;
 } catch (err) {
   console.error(`Error fetching leaves for month ${date.getMonth() + 1} and year ${date.getFullYear()}:`, err);
   if (setError) {
     setError(`Failed to load leaves. ${err instanceof Error ? err.message : ''}`);
   }
   return [];
 } finally {
   if (setIsLoadingLeaves) {
     setIsLoadingLeaves(false);
   }
 }
};

/**
* Функция для загрузки контрактов сотрудника
*/
export const fetchContracts = async (
 context: WebPartContext,
 employeeId: string,
 managerId?: string,
 staffGroupId?: string,
 setIsLoading?: (isLoading: boolean) => void,
 setContracts?: (contracts: IContract[]) => void,
 setSelectedContractId?: (contractId?: string) => void,
 setError?: (error?: string) => void
): Promise<IContract[]> => {
 const contractsService = ContractsService.getInstance(context);
 if (!contractsService || !employeeId) return [];
 
 if (setIsLoading) {
   setIsLoading(true);
 }
 
 if (setError) {
   setError(undefined);
 }
 
 try {
   console.log("[ScheduleTab] Fetching contracts for employee ID:", employeeId, 
     "manager ID:", managerId, "staff group ID:", staffGroupId);
   
   // Вызываем метод из сервиса
   const contractsData = await contractsService.getContractsForStaffMember(
     employeeId,
     managerId,
     staffGroupId
   );
   
   console.log(`[ScheduleTab] Retrieved ${contractsData.length} contracts`);
   
   // Фильтруем только активные контракты
   const activeContracts = contractsData.filter(contract => !contract.isDeleted);
   
   if (setContracts) {
     setContracts(activeContracts);
   }
   
   // Если есть контракты, выбираем первый
   if (activeContracts.length > 0 && setSelectedContractId) {
     setSelectedContractId(activeContracts[0].id);
   }
   
   return activeContracts;
 } catch (err) {
   console.error('Error fetching contracts:', err);
   if (setError) {
     setError(`Failed to load contracts. ${err instanceof Error ? err.message : ''}`);
   }
   return [];
 } finally {
   if (setIsLoading) {
     setIsLoading(false);
   }
 }
};

/**
* Функция для получения текстового названия типа отпуска
* @deprecated Используйте getLeaveTypeInfo для получения полной информации о типе отпуска
*/
export const getLeaveTypeText = (typeOfLeave: number): string => {
 switch (typeOfLeave) {
   case 1:
     return 'Ежегодный отпуск';
   case 2:
     return 'Больничный';
   case 3:
     return 'Административный';
   case 4:
     return 'Отпуск без сохранения ЗП';
   case 5:
     return 'Декретный отпуск';
   default:
     return `Тип ${typeOfLeave}`;
 }
};

/**
* Функция для получения информации о типе отпуска из справочника
*/
export const getLeaveTypeInfo = (
 typeOfLeave: number, 
 typesOfLeaveData: ITypeOfLeave[]
): { title: string; color?: string } => {
 // Ищем тип отпуска в справочнике
 const typeInfo = typesOfLeaveData.find(t => t.id === typeOfLeave.toString());
 
 // Если найден, возвращаем его данные
 if (typeInfo) {
   return {
     title: typeInfo.title,
     color: typeInfo.color
   };
 }
 
 // Если не найден, возвращаем резервное значение
 return {
   title: getLeaveTypeText(typeOfLeave),
   color: undefined
 };
};

/**
* Проверяет, нужно ли обновлять данные при изменении даты
*/
export const shouldRefreshDataOnDateChange = (
 currentDate: Date,
 newDate: Date
): boolean => {
 const currentMonth = currentDate.getMonth();
 const currentYear = currentDate.getFullYear();
 const newMonth = newDate.getMonth();
 const newYear = newDate.getFullYear();
 
 // Если изменился месяц или год, нужно обновить данные
 return currentMonth !== newMonth || currentYear !== newYear;
};