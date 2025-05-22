// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillHelpers.ts

import { MessageBarType } from '@fluentui/react';
import { IDayHours } from '../../../../models/IWeeklyTimeTable';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { 
  IScheduleTemplate, 
  IDayData, 
  ILeavePeriod, 
  HolidayCache, 
  TemplateCache,
  IExistingRecordCheck,
  IRecordsProcessingStatus
} from './ScheduleTabFillInterfaces';

/**
 * Анализирует статус обработки существующих записей
 */
export function checkRecordsProcessingStatus(records: IExistingRecordCheck[]): IRecordsProcessingStatus {
  console.log(`[ScheduleTabFillHelpers] Analyzing ${records.length} existing records for processing status`);
  
  const processedRecords = records.filter(record => {
    const isProcessed = record.checked > 0 || (record.exportResult && record.exportResult.trim() !== '' && record.exportResult !== '0');
    
    if (isProcessed) {
      console.log(`[ScheduleTabFillHelpers] Record ${record.id} is processed: Checked=${record.checked}, ExportResult="${record.exportResult}"`);
    }
    
    return isProcessed;
  });
  
  const unprocessedRecords = records.filter(record => {
    const isUnprocessed = record.checked === 0 && (!record.exportResult || record.exportResult.trim() === '' || record.exportResult === '0');
    return isUnprocessed;
  });
  
  const result: IRecordsProcessingStatus = {
    hasProcessedRecords: processedRecords.length > 0,
    processedCount: processedRecords.length,
    totalCount: records.length,
    processedRecords,
    unprocessedRecords
  };
  
  console.log(`[ScheduleTabFillHelpers] Processing status analysis result:`, {
    total: result.totalCount,
    processed: result.processedCount,
    unprocessed: result.unprocessedRecords.length,
    hasProcessed: result.hasProcessedRecords
  });
  
  return result;
}

/**
 * Создает сообщение о блокировке операции из-за обработанных записей
 */
export function createProcessingBlockMessage(status: IRecordsProcessingStatus): { text: string; type: MessageBarType } {
  return {
    text: `Cannot replace records: ${status.processedCount} of ${status.totalCount} records have been processed (checked or exported). Manual review required.`,
    type: MessageBarType.error
  };
}

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
 * Function to create confirmation dialog for schedule fill with processing status check
 */
export const createFillConfirmationDialog = (
  existingRecords: IExistingRecordCheck[],
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
  if (existingRecords.length === 0) {
    // Нет существующих записей - не показываем диалог
    return {
      isOpen: false,
      title: '',
      message: '',
      confirmButtonText: '',
      cancelButtonText: '',
      onConfirm: () => {},
      confirmButtonColor: ''
    };
  }

  // Есть записи - показываем диалог замены
  return {
    isOpen: true,
    title: 'Replace Schedule Records',
    message: `Found ${existingRecords.length} existing unprocessed records for this period. Replace them with new records from template?`,
    confirmButtonText: 'Replace',
    cancelButtonText: 'Cancel',
    onConfirm,
    confirmButtonColor: '#d83b01' // Orange color for replacement warning
  };
};