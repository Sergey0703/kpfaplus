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
   // Запись считается обработанной если:
   // 1. Checked > 0 (помечена как проверенная)
   // 2. ExportResult не пустое и не равно '0' (экспортирована)
   const isProcessed = record.checked > 0 || (
     record.exportResult && 
     record.exportResult.trim() !== '' && 
     record.exportResult !== '0'
   );
   
   if (isProcessed) {
     console.log(`[ScheduleTabFillHelpers] Record ${record.id} is processed: Checked=${record.checked}, ExportResult="${record.exportResult}"`);
   }
   
   return isProcessed;
 });
 
 const unprocessedRecords = records.filter(record => {
   // Запись считается необработанной если:
   // 1. Checked = 0 (не проверена)
   // 2. ExportResult пустое или равно '0' (не экспортирована)
   const isUnprocessed = record.checked === 0 && (
     !record.exportResult || 
     record.exportResult.trim() === '' || 
     record.exportResult === '0'
   );
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
 const message = `Cannot replace records: ${status.processedCount} of ${status.totalCount} records have been processed (checked or exported). Manual review required.`;
 
 console.log(`[ScheduleTabFillHelpers] Created blocking message: ${message}`);
 
 return {
   text: message,
   type: MessageBarType.error
 };
}

/**
* Вспомогательная функция для определения применяемого номера недели
*/
export function getAppliedWeekNumber(calculatedWeekNumber: number, numberOfWeekTemplates: number): number {
 let appliedWeek: number;
 
 switch (numberOfWeekTemplates) {
   case 1:
     // Всегда используем неделю 1
     appliedWeek = 1;
     break;
   case 2:
     // Чередуем недели 1 и 2
     appliedWeek = ((calculatedWeekNumber - 1) % 2) + 1;
     break;
   case 3:
     // Используем недели 1, 2, 3, затем снова 1
     appliedWeek = calculatedWeekNumber <= 3 ? calculatedWeekNumber : 1;
     break;
   case 4:
     // Используем недели 1, 2, 3, 4, затем повторяем цикл
     appliedWeek = calculatedWeekNumber <= 4 ? calculatedWeekNumber : calculatedWeekNumber % 4 || 4;
     break;
   default:
     // По умолчанию используем неделю 1
     appliedWeek = 1;
 }
 
 console.log(`[ScheduleTabFillHelpers] Applied week number: calculated=${calculatedWeekNumber}, templates=${numberOfWeekTemplates}, applied=${appliedWeek}`);
 return appliedWeek;
}

/**
* Helper function to create Date object with specified time
* ИСПРАВЛЕНО: Используем UTC методы для консистентности с SharePoint
*/
export function createDateWithTime(baseDate: Date, time?: IDayHours): Date {
 const result = new Date(baseDate);
 
 if (!time) {
   // *** ИСПРАВЛЕНИЕ: Используем setUTCHours вместо setHours ***
   result.setUTCHours(0, 0, 0, 0);
   console.log(`[ScheduleTabFillHelpers] No time provided, set to UTC midnight: ${result.toISOString()}`);
   return result;
 }
 
 try {
   const hours = parseInt(time.hours || '0', 10);
   const minutes = parseInt(time.minutes || '0', 10);
   
   if (isNaN(hours) || isNaN(minutes)) {
     console.warn(`[ScheduleTabFillHelpers] Invalid time components: hours="${time.hours}", minutes="${time.minutes}"`);
     // *** ИСПРАВЛЕНИЕ: Используем setUTCHours вместо setHours ***
     result.setUTCHours(0, 0, 0, 0);
     console.warn(`[ScheduleTabFillHelpers] Set to UTC midnight: ${result.toISOString()}`);
   } else {
     // *** ИСПРАВЛЕНИЕ: Используем setUTCHours вместо setHours ***
     result.setUTCHours(hours, minutes, 0, 0);
     console.log(`[ScheduleTabFillHelpers] Set UTC time ${hours}:${minutes} on base date → result: ${result.toISOString()}`);
   }
 } catch (error) {
   console.error(`[ScheduleTabFillHelpers] Error parsing time:`, error);
   // *** ИСПРАВЛЕНИЕ: Используем setUTCHours вместо setHours ***
   result.setUTCHours(0, 0, 0, 0);
   console.error(`[ScheduleTabFillHelpers] Error, set to UTC midnight: ${result.toISOString()}`);
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
 
 // Логируем несколько примеров для отладки
 if (holidayMap.size > 0) {
   const sampleKeys = Array.from(holidayMap.keys()).slice(0, 3);
   console.log(`[ScheduleTabFillHelpers] Sample holiday keys: ${sampleKeys.join(', ')}`);
 }
 
 return holidayMap;
}

/**
* Создает массив периодов отпусков для быстрой проверки
*/
export function createLeavePeriods(leaves: ILeaveDay[]): ILeavePeriod[] {
 // *** FILTER OUT DELETED LEAVES FOR SCHEDULE TAB ***
 const activeLeaves = leaves.filter(leave => {
   const isDeleted = leave.deleted === true;
   if (isDeleted) {
     console.log(`[ScheduleTabFillHelpers] Filtering out deleted leave: ${leave.title} (${new Date(leave.startDate).toLocaleDateString()} - ${leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'ongoing'})`);
   }
   return !isDeleted;
 });
 
 const leavePeriods = activeLeaves.map(leave => {
   const startDate = new Date(leave.startDate);
   // Если дата окончания не указана, считаем отпуск открытым до далекого будущего
   const endDate = leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31);
   
   return {
     startDate,
     endDate,
     typeOfLeave: leave.typeOfLeave.toString(),
     title: leave.title
   };
 });
 
 console.log(`[ScheduleTabFillHelpers] Подготовлен кэш отпусков: ${leavePeriods.length} активных записей из ${leaves.length} общих`);
 
 // Логируем информацию об отпусках для отладки
 leavePeriods.forEach((period, index) => {
   if (index < 3) { // Логируем только первые 3 для экономии места
     console.log(`[ScheduleTabFillHelpers] Active leave period ${index + 1}: ${period.startDate.toLocaleDateString()} - ${period.endDate.toLocaleDateString()}, type: ${period.typeOfLeave}, title: "${period.title}"`);
   }
 });
 
 return leavePeriods;
}

/**
* Группирует шаблоны по номеру недели и дню недели
*/
export function groupTemplatesByWeekAndDay(activeTemplates: IScheduleTemplate[], dayOfStartWeek: number): TemplateCache {
 const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();
 
 console.log(`[ScheduleTabFillHelpers] Grouping ${activeTemplates.length} templates by week and day, dayOfStartWeek=${dayOfStartWeek}`);
 
 activeTemplates.forEach((template, templateIndex) => {
   const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
   
   console.log(`[ScheduleTabFillHelpers] Processing template ${templateIndex}: week=${weekNumber}, shift=${template.NumberOfShift || template.shiftNumber || 1}`);
   
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
       
       const processedTemplate: IScheduleTemplate = {
         ...template,
         dayOfWeek: i + 1,
         start: dayInfo.start as IDayHours,
         end: dayInfo.end as IDayHours,
         lunch: template.lunch || '30'
       };
       
       templatesByWeekAndDay.get(key)?.push(processedTemplate);
       
       // Логируем добавление шаблона
       console.log(`[ScheduleTabFillHelpers] Added template for key ${key} (${day}): ${(dayInfo.start as IDayHours).hours}:${(dayInfo.start as IDayHours).minutes} - ${(dayInfo.end as IDayHours).hours}:${(dayInfo.end as IDayHours).minutes}`);
     } else {
       // Логируем пропущенные дни
       if (templateIndex === 0) { // Логируем только для первого шаблона, чтобы не засорять логи
         console.log(`[ScheduleTabFillHelpers] Skipping ${day} for template ${templateIndex}: no valid time data`);
       }
     }
   }
 });
 
 console.log(`[ScheduleTabFillHelpers] Сгруппированы шаблоны: ${templatesByWeekAndDay.size} комбинаций`);
 
 // Логируем сводку по группировке
 templatesByWeekAndDay.forEach((templates, key) => {
   console.log(`[ScheduleTabFillHelpers] Key ${key}: ${templates.length} template(s)`);
 });
 
 return templatesByWeekAndDay;
}

/**
* Подготавливает данные для всех дней периода
* ИСПРАВЛЕНО: Используем UTC методы для создания дат
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
 console.log(`[ScheduleTabFillHelpers] Period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
 
 const dayCount = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
 const daysData = new Map<string, IDayData>();
 
 console.log(`[ScheduleTabFillHelpers] Will process ${dayCount} days`);
 
 for (let i = 0; i < dayCount; i++) {
   // *** ИСПРАВЛЕНИЕ: Используем UTC методы для создания дат ***
   const currentDate = new Date(Date.UTC(
     firstDay.getUTCFullYear(),
     firstDay.getUTCMonth(),
     firstDay.getUTCDate() + i,
     0, 0, 0, 0  // UTC полночь
   ));
   
   console.log(`[ScheduleTabFillHelpers] Day ${i + 1}: ${currentDate.toISOString()}`);
   
   // *** ИСПРАВЛЕНИЕ: Используем UTC методы для ключа ***
   const dateKey = `${currentDate.getUTCFullYear()}-${currentDate.getUTCMonth() + 1}-${currentDate.getUTCDate()}`;
   
   // *** ИСПРАВЛЕНИЕ: Определяем день недели в UTC ***
   const dayIndex = currentDate.getUTCDay();
   const adjustedDayIndex = dayIndex === 0 ? 7 : dayIndex;
   
   // *** ИСПРАВЛЕНИЕ: Определяем номер недели в месяце в UTC ***
   const dayOfMonth = currentDate.getUTCDate();
   const weekNumber = Math.floor((dayOfMonth - 1) / 7) + 1;
   const appliedWeekNumber = getAppliedWeekNumber(weekNumber, numberOfWeekTemplates);
   
   // Проверяем, является ли день праздником
   const isHoliday = holidayCache.has(dateKey);
   const holidayInfo = isHoliday ? holidayCache.get(dateKey) : undefined;
   
   // Проверяем, находится ли сотрудник в отпуске в этот день
   const leaveForDay = leavePeriods.find(leave => 
     currentDate >= leave.startDate && currentDate <= leave.endDate
   );
   const isLeave = !!leaveForDay;
   
   // Получаем шаблоны для этого дня недели и недели
   const key = `${appliedWeekNumber}-${adjustedDayIndex}`;
   const templatesForDay = templatesByWeekAndDay.get(key) || [];
   
   // Создаем объект данных дня
   const dayData: IDayData = {
     date: currentDate,  // Теперь это UTC дата с полуночью
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
   };
   
   daysData.set(dateKey, dayData);
   
   // Логируем информацию о дне (только для первых нескольких дней и важных случаев)
   if (i < 3 || isHoliday || isLeave || templatesForDay.length > 0) {
     const dayName = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][adjustedDayIndex];
     console.log(`[ScheduleTabFillHelpers] Day ${i + 1} (${currentDate.toLocaleDateString()} ${dayName}): holiday=${isHoliday}, leave=${isLeave}, templates=${templatesForDay.length}, week=${appliedWeekNumber}`);
     
     if (isHoliday && holidayInfo) {
       console.log(`[ScheduleTabFillHelpers]   Holiday: ${holidayInfo.title}`);
     }
     
     if (isLeave && leaveForDay) {
       console.log(`[ScheduleTabFillHelpers]   Leave: ${leaveForDay.title} (type: ${leaveForDay.typeOfLeave})`);
     }
     
     if (templatesForDay.length > 0) {
       templatesForDay.forEach((template, tIndex) => {
         console.log(`[ScheduleTabFillHelpers]   Template ${tIndex + 1}: ${template.start?.hours}:${template.start?.minutes} - ${template.end?.hours}:${template.end?.minutes}, lunch: ${template.lunch}min`);
       });
     }
   }
 }
 
 console.log(`[ScheduleTabFillHelpers] Подготовлены данные для ${daysData.size} дней`);
 
 // Статистика по подготовленным данным
 let holidaysCount = 0;
 let leavesCount = 0;
 let templatesCount = 0;
 
 daysData.forEach(dayData => {
   if (dayData.isHoliday) holidaysCount++;
   if (dayData.isLeave) leavesCount++;
   templatesCount += dayData.templates.length;
 });
 
 console.log(`[ScheduleTabFillHelpers] Summary: ${holidaysCount} holidays, ${leavesCount} leave days, ${templatesCount} total templates`);
 
 return daysData;
}

/**
* УСТАРЕЛА: Function to create confirmation dialog for schedule fill with processing status check
* Эта функция больше не используется, так как логика диалогов перенесена в ScheduleTabContent
* Оставлена для обратной совместимости
* 
* @deprecated Use dialog logic in ScheduleTabContent instead
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
 console.warn('[ScheduleTabFillHelpers] createFillConfirmationDialog is deprecated. Use dialog logic in ScheduleTabContent instead.');
 
 if (existingRecords.length === 0) {
   // Нет существующих записей - простой диалог заполнения
   return {
     isOpen: true,
     title: 'Fill Schedule',
     message: 'Do you want to fill the schedule based on template data?',
     confirmButtonText: 'Fill',
     cancelButtonText: 'Cancel',
     onConfirm,
     confirmButtonColor: '#107c10' // Green color for fill
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

/**
* Валидирует данные шаблона перед использованием
*/
export function validateTemplate(template: IScheduleTemplate): boolean {
 // Проверяем наличие обязательных полей
 if (!template.start || !template.end) {
   console.warn(`[ScheduleTabFillHelpers] Template validation failed: missing start or end time`);
   return false;
 }
 
 // Проверяем корректность времени
 const startHours = parseInt(template.start.hours || '0', 10);
 const startMinutes = parseInt(template.start.minutes || '0', 10);
 const endHours = parseInt(template.end.hours || '0', 10);
 const endMinutes = parseInt(template.end.minutes || '0', 10);
 
 if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
   console.warn(`[ScheduleTabFillHelpers] Template validation failed: invalid time format`);
   return false;
 }
 
 if (startHours < 0 || startHours > 23 || endHours < 0 || endHours > 23) {
   console.warn(`[ScheduleTabFillHelpers] Template validation failed: hours out of range`);
   return false;
 }
 
 if (startMinutes < 0 || startMinutes > 59 || endMinutes < 0 || endMinutes > 59) {
   console.warn(`[ScheduleTabFillHelpers] Template validation failed: minutes out of range`);
   return false;
 }
 
 return true;
}

/**
* Форматирует время в читаемый вид для логирования
*/
export function formatTimeForLogging(time?: IDayHours): string {
 if (!time) {
   return '00:00';
 }
 
 const hours = (time.hours || '0').padStart(2, '0');
 const minutes = (time.minutes || '0').padStart(2, '0');
 return `${hours}:${minutes}`;
}

/**
* Подсчитывает статистику по дням данных
*/
export function calculateDaysDataStatistics(daysData: Map<string, IDayData>): {
 totalDays: number;
 holidayDays: number;
 leaveDays: number;
 workingDays: number;
 daysWithTemplates: number;
 totalTemplates: number;
} {
 let holidayDays = 0;
 let leaveDays = 0;
 let daysWithTemplates = 0;
 let totalTemplates = 0;
 
 daysData.forEach(dayData => {
   if (dayData.isHoliday) holidayDays++;
   if (dayData.isLeave) leaveDays++;
   if (dayData.templates.length > 0) {
     daysWithTemplates++;
     totalTemplates += dayData.templates.length;
   }
 });
 
 const workingDays = daysData.size - holidayDays - leaveDays;
 
 const stats = {
   totalDays: daysData.size,
   holidayDays,
   leaveDays,
   workingDays,
   daysWithTemplates,
   totalTemplates
 };
 
 console.log(`[ScheduleTabFillHelpers] Days data statistics:`, stats);
 
 return stats;
}