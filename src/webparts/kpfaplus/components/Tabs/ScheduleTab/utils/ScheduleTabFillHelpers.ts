// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillHelpers.ts

import { IDayHours } from '../../../../models/IWeeklyTimeTable';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { 
  IScheduleTemplate, 
  IDayData, 
  ILeavePeriod, 
  HolidayCache, 
  TemplateCache
} from './ScheduleTabFillInterfaces';

/**
 * Вспомогательная функция для определения применяемого номера недели
 */
export function getAppliedWeekNumber(calculatedWeekNumber: number, numberOfWeekTemplates: number): number {
  switch (numberOfWeekTemplates) {
    case 1:
      return 1;
    case 2:
      return ((calculatedWeekNumber - 1) % 2) + 1;
    case 3:
      return calculatedWeekNumber <= 3 ? calculatedWeekNumber : 1;
    case 4:
      return calculatedWeekNumber <= 4 ? calculatedWeekNumber : calculatedWeekNumber % 4 || 4;
    default:
      return 1;
  }
}

/**
 * Helper function to create Date object with specified time
 */
export function createDateWithTime(baseDate: Date, time?: IDayHours): Date {
  const result = new Date(baseDate);
  
  if (!time) {
    result.setHours(0, 0, 0, 0);
    return result;
  }
  
  try {
    const hours = parseInt(time.hours || '0', 10);
    const minutes = parseInt(time.minutes || '0', 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      result.setHours(0, 0, 0, 0);
    } else {
      result.setHours(hours, minutes, 0, 0);
    }
  } catch (error) {
    console.error(`[ScheduleTabFillHelpers] Error parsing time:`, error);
    result.setHours(0, 0, 0, 0);
  }
  
  return result;
}

/**
 * Создает кэш праздников для быстрого поиска
 */
export function createHolidayCache(holidays: IHoliday[]): HolidayCache {
  const holidayMap = new Map<string, IHoliday>();
  
  holidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date);
    const key = `${holidayDate.getFullYear()}-${holidayDate.getMonth() + 1}-${holidayDate.getDate()}`;
    holidayMap.set(key, holiday);
  });
  
  console.log(`[ScheduleTabFillHelpers] Создан кэш праздников: ${holidayMap.size} записей`);
  return holidayMap;
}

/**
 * Создает массив периодов отпусков для быстрой проверки
 */
export function createLeavePeriods(leaves: ILeaveDay[]): ILeavePeriod[] {
  const leavePeriods = leaves.map(leave => {
    const startDate = new Date(leave.startDate);
    const endDate = leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31);
    return {
      startDate,
      endDate,
      typeOfLeave: leave.typeOfLeave.toString(),
      title: leave.title
    };
  });
  
  console.log(`[ScheduleTabFillHelpers] Подготовлен кэш отпусков: ${leavePeriods.length} записей`);
  return leavePeriods;
}

/**
 * Группирует шаблоны по номеру недели и дню недели
 */
export function groupTemplatesByWeekAndDay(activeTemplates: IScheduleTemplate[], dayOfStartWeek: number): TemplateCache {
  const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();
  
  activeTemplates.forEach(template => {
    const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const dayInfo = template[day];
      
      if (dayInfo && 
          typeof dayInfo === 'object' && 
          'start' in dayInfo && 
          'end' in dayInfo && 
          dayInfo.start && 
          dayInfo.end) {
        
        const key = `${weekNumber}-${i + 1}`;
        
        if (!templatesByWeekAndDay.has(key)) {
          templatesByWeekAndDay.set(key, []);
        }
        
        templatesByWeekAndDay.get(key)?.push({
          ...template,
          dayOfWeek: i + 1,
          start: dayInfo.start as IDayHours,
          end: dayInfo.end as IDayHours,
          lunch: template.lunch || '30'
        });
      }
    }
  });
  
  console.log(`[ScheduleTabFillHelpers] Сгруппированы шаблоны: ${templatesByWeekAndDay.size} комбинаций`);
  return templatesByWeekAndDay;
}

/**
 * Подготавливает данные для всех дней периода
 */
export function prepareDaysData(
  firstDay: Date,
  lastDay: Date,
  holidayCache: HolidayCache,
  leavePeriods: ILeavePeriod[],
  templatesByWeekAndDay: TemplateCache,
  numberOfWeekTemplates: number
): Map<string, IDayData> {
  console.log(`[ScheduleTabFillHelpers] Начинаем подготовку данных для всех дней периода...`);
  
  const dayCount = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysData = new Map<string, IDayData>();
  
  for (let i = 0; i < dayCount; i++) {
    const currentDate = new Date(firstDay);
    currentDate.setDate(firstDay.getDate() + i);
    
    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
    
    const dayIndex = currentDate.getDay();
    const adjustedDayIndex = dayIndex === 0 ? 7 : dayIndex;
    
    const dayOfMonth = currentDate.getDate();
    const weekNumber = Math.floor((dayOfMonth - 1) / 7) + 1;
    const appliedWeekNumber = getAppliedWeekNumber(weekNumber, numberOfWeekTemplates);
    
    const isHoliday = holidayCache.has(dateKey);
    const holidayInfo = isHoliday ? holidayCache.get(dateKey) : undefined;
    
    const leaveForDay = leavePeriods.find(leave => 
      currentDate >= leave.startDate && currentDate <= leave.endDate
    );
    const isLeave = !!leaveForDay;
    
    const key = `${appliedWeekNumber}-${adjustedDayIndex}`;
    const templatesForDay = templatesByWeekAndDay.get(key) || [];
    
    daysData.set(dateKey, {
      date: new Date(currentDate),
      isHoliday,
      holidayInfo,
      isLeave,
      leaveInfo: leaveForDay ? {
        typeOfLeave: leaveForDay.typeOfLeave,
        title: leaveForDay.title
      } : undefined,
      templates: templatesForDay,
      dayOfWeek: adjustedDayIndex,
      weekNumber,
      appliedWeekNumber
    });
  }
  
  console.log(`[ScheduleTabFillHelpers] Подготовлены данные для ${daysData.size} дней`);
  return daysData;
}

/**
 * Function to create confirmation dialog for schedule fill
 */
export const createFillConfirmationDialog = (
  hasExistingRecords: boolean,
  onConfirm: () => void
): {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  onConfirm: () => void;
  confirmButtonColor: string;
} => {
  if (hasExistingRecords) {
    return {
      isOpen: true,
      title: 'Confirm Fill Operation',
      message: 'There are existing records in the schedule. Filling the schedule will add new records based on templates. Do you want to continue?',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#d83b01'
    };
  } else {
    return {
      isOpen: true,
      title: 'Fill Schedule',
      message: 'Do you want to fill the schedule based on template data?',
      confirmButtonText: 'Fill',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#107c10'
    };
  }
};