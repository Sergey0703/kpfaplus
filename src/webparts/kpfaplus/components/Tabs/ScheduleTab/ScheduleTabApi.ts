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
  
  console.log(`[ScheduleTabApi] Fetching holidays for year: ${year}, month: ${month}`);
  
  // Используем метод для получения праздников за месяц с фильтрацией на сервере
  const holidaysData = await holidaysService.getHolidaysByMonthAndYear(date);
  
  console.log(`[ScheduleTabApi] Retrieved ${holidaysData.length} holidays for month ${month}/${year}`);
  setHolidays(holidaysData);
  
  // Логируем первые несколько праздников для проверки
  if (holidaysData.length > 0) {
    const sampleHolidays = holidaysData.slice(0, 3);
    console.log("[ScheduleTabApi] Sample holidays:", sampleHolidays);
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
  console.log('[ScheduleTabApi] Fetching types of leave');
  
  // Получаем все типы отпусков без фильтрации
  const typesOfLeaveData = await typeOfLeaveService.getAllTypesOfLeave(true); // true для форсирования обновления кэша
  
  console.log(`[ScheduleTabApi] Retrieved ${typesOfLeaveData.length} types of leave`);
  setTypesOfLeave(typesOfLeaveData);
  
  // Логируем первые несколько типов отпусков для проверки
  if (typesOfLeaveData.length > 0) {
    const sampleTypes = typesOfLeaveData.slice(0, 3);
    console.log("[ScheduleTabApi] Sample types of leave:", sampleTypes);
  }
} catch (err) {
  console.error(`Error fetching types of leave:`, err);
  setError(`Failed to load types of leave. ${err instanceof Error ? err.message : ''}`);
} finally {
  setIsLoadingTypesOfLeave(false);
}
};

/**
* ОБНОВЛЕНО: Функция для загрузки отпусков для месяца и года (Date-only совместимость)
* Теперь корректно работает с Date-only полями из SharePoint
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
  console.log(`[ScheduleTabApi] *** FETCHING LEAVES WITH DATE-ONLY COMPATIBILITY ***`);
  console.log(`[ScheduleTabApi] Input date: ${date.toISOString()}`);
  console.log(`[ScheduleTabApi] Staff: ${staffMemberId}, Manager: ${managerId || 0}, Group: ${staffGroupId || 0}`);
  console.log(`[ScheduleTabApi] IMPORTANT: DaysOfLeavesService already handles Date-only field format correctly`);
  
  // DaysOfLeavesService.getLeavesForMonthAndYear уже обновлен для работы с Date-only полями
  const leavesData = await daysOfLeavesService.getLeavesForMonthAndYear(
    date,
    staffMemberId,
    managerId || 0,
    staffGroupId || 0
  );
  
  console.log(`[ScheduleTabApi] *** PROCESSING LEAVES DATA FOR DATE-ONLY COMPATIBILITY ***`);
  console.log(`[ScheduleTabApi] Retrieved ${leavesData.length} total leaves from service`);
  
  // *** ОБНОВЛЕНО: Улучшенная фильтрация удаленных отпусков для Date-only полей ***
  const activeLeavesData = leavesData.filter(leave => {
    const isDeleted = leave.deleted === true;
    if (isDeleted) {
      console.log(`[ScheduleTabApi] Filtering out deleted leave: ${leave.title} (${formatDateForComparison(leave.startDate)} - ${leave.endDate ? formatDateForComparison(leave.endDate) : 'ongoing'})`);
    }
    return !isDeleted;
  });
  
  console.log(`[ScheduleTabApi] *** DATE-ONLY FILTERING COMPLETE ***`);
  console.log(`[ScheduleTabApi] Total leaves: ${leavesData.length}, Active leaves: ${activeLeavesData.length}`);
  console.log(`[ScheduleTabApi] Month: ${date.getMonth() + 1}, Year: ${date.getFullYear()}`);
  
  if (setLeaves) {
    setLeaves(activeLeavesData);
  }
  
  // *** ОБНОВЛЕНО: Логирование с Date-only совместимым форматом ***
  if (activeLeavesData.length > 0) {
    console.log(`[ScheduleTabApi] *** SAMPLE ACTIVE LEAVES (DATE-ONLY FORMAT) ***`);
    const sampleLeaves = activeLeavesData.slice(0, 3);
    sampleLeaves.forEach((leave, index) => {
      const startDateFormatted = formatDateForComparison(leave.startDate);
      const endDateFormatted = leave.endDate ? formatDateForComparison(leave.endDate) : 'ongoing';
      console.log(`[ScheduleTabApi] Leave ${index + 1}: "${leave.title}" (${startDateFormatted} - ${endDateFormatted}), Type: ${leave.typeOfLeave}`);
    });
  } else {
    console.log(`[ScheduleTabApi] No active leaves found for the specified period`);
  }
  
  return activeLeavesData;
} catch (err) {
  console.error(`[ScheduleTabApi] Error fetching leaves for month ${date.getMonth() + 1} and year ${date.getFullYear()}:`, err);
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
* НОВАЯ ФУНКЦИЯ: Форматирует дату для сравнения (Date-only совместимость)
* Создает строку даты только с компонентами года, месяца и дня
* Совместимо с Date-only форматом из SharePoint
*/
const formatDateForComparison = (date: Date): string => {
const year = date.getFullYear();
const month = (date.getMonth() + 1).toString().padStart(2, '0');
const day = date.getDate().toString().padStart(2, '0');
return `${year}-${month}-${day}`;
};

/**
* ОБНОВЛЕНО: Проверяет, активен ли контракт в указанном месяце (Date-only совместимость)
* @param contract Контракт для проверки
* @param date Дата, для определения месяца и года
* @returns true если контракт активен в указанном месяце, иначе false
*/
export const isContractActiveInMonth = (contract: IContract, date: Date): boolean => {
// Контракт должен иметь дату начала
if (!contract.startDate) {
  return false;
}

// *** ОБНОВЛЕНО: Получаем первый и последний день месяца с Date-only совместимостью ***
const year = date.getFullYear();
const month = date.getMonth();

// Создаем границы месяца как локальные даты (без времени)
const firstDayOfMonth = new Date(year, month, 1);
const lastDayOfMonth = new Date(year, month + 1, 0);

// *** ИСПРАВЛЕНО: Нормализуем время для корректного сравнения Date-only полей ***
firstDayOfMonth.setHours(0, 0, 0, 0);
lastDayOfMonth.setHours(23, 59, 59, 999);

// *** ОБНОВЛЕНО: Нормализуем даты контракта для Date-only сравнения ***
const startDate = new Date(contract.startDate);
startDate.setHours(0, 0, 0, 0);

console.log(`[ScheduleTabApi] *** CONTRACT DATE-ONLY COMPATIBILITY CHECK ***`);
console.log(`[ScheduleTabApi] Month boundaries: ${formatDateForComparison(firstDayOfMonth)} - ${formatDateForComparison(lastDayOfMonth)}`);
console.log(`[ScheduleTabApi] Contract start: ${formatDateForComparison(startDate)}`);

// Проверяем дату начала контракта
// Контракт должен начаться не позже последнего дня месяца
if (startDate > lastDayOfMonth) {
  console.log(`[ScheduleTabApi] Contract starts after month end: ${formatDateForComparison(startDate)} > ${formatDateForComparison(lastDayOfMonth)}`);
  return false;
}

// Если нет даты окончания, контракт активен
if (!contract.finishDate) {
  console.log(`[ScheduleTabApi] Contract has no end date - considered active`);
  return true;
}

// *** ОБНОВЛЕНО: Обработка даты окончания с Date-only совместимостью ***
const finishDate = new Date(contract.finishDate);
finishDate.setHours(23, 59, 59, 999);

console.log(`[ScheduleTabApi] Contract finish: ${formatDateForComparison(finishDate)}`);

// Проверяем дату окончания контракта
// Контракт должен закончиться не раньше первого дня месяца
const isActive = finishDate >= firstDayOfMonth;
console.log(`[ScheduleTabApi] Contract active in month: ${isActive}`);

return isActive;
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
setError?: (error?: string) => void,
selectedDate?: Date
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
  console.log("[ScheduleTabApi] Fetching contracts for employee ID:", employeeId, 
    "manager ID:", managerId, "staff group ID:", staffGroupId);
  
  // Вызываем метод из сервиса
  const contractsData = await contractsService.getContractsForStaffMember(
    employeeId,
    managerId,
    staffGroupId
  );
  
  console.log(`[ScheduleTabApi] Retrieved ${contractsData.length} total contracts`);
  
  // Фильтруем только не удаленные контракты
  let filteredContracts = contractsData.filter(contract => !contract.isDeleted);
  
  // Если указана дата, фильтруем контракты по активности в выбранном месяце
  if (selectedDate) {
    const dateForFilter = new Date(selectedDate);
    
    filteredContracts = filteredContracts.filter(contract => 
      isContractActiveInMonth(contract, dateForFilter)
    );
    
    console.log(`[ScheduleTabApi] Filtered to ${filteredContracts.length} contracts active in month ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
  }
  
  if (setContracts) {
    setContracts(filteredContracts);
  }
  
  // Если есть контракты, выбираем первый
  if (filteredContracts.length > 0 && setSelectedContractId) {
    setSelectedContractId(filteredContracts[0].id);
  } else if (filteredContracts.length === 0 && setSelectedContractId) {
    // Если контрактов нет, сбрасываем выбранный ID
    setSelectedContractId(undefined);
  }
  
  return filteredContracts;
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
* ОБНОВЛЕНО: Проверяет, нужно ли обновлять данные при изменении даты (Date-only совместимость)
*/
export const shouldRefreshDataOnDateChange = (
currentDate: Date,
newDate: Date
): boolean => {
// *** ОБНОВЛЕНО: Используем Date-only сравнение для определения необходимости обновления ***
const currentMonth = currentDate.getMonth();
const currentYear = currentDate.getFullYear();
const newMonth = newDate.getMonth();
const newYear = newDate.getFullYear();

console.log(`[ScheduleTabApi] *** DATE CHANGE CHECK (DATE-ONLY COMPATIBILITY) ***`);
console.log(`[ScheduleTabApi] Current: ${currentYear}-${currentMonth + 1}, New: ${newYear}-${newMonth + 1}`);

// Если изменился месяц или год, нужно обновить данные
const shouldRefresh = currentMonth !== newMonth || currentYear !== newYear;
console.log(`[ScheduleTabApi] Should refresh data: ${shouldRefresh}`);

return shouldRefresh;
};