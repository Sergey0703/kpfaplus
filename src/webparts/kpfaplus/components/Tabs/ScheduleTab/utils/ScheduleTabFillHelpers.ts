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
* *** ОБНОВЛЕНО: Создает массив периодов отпусков для быстрой проверки с Date-only совместимостью ***
* Теперь корректно работает с Date-only полями из DaysOfLeaves
*/
export function createLeavePeriods(leaves: ILeaveDay[]): ILeavePeriod[] {
console.log(`[ScheduleTabFillHelpers] *** CREATING LEAVE PERIODS WITH DATE-ONLY COMPATIBILITY ***`);
console.log(`[ScheduleTabFillHelpers] Processing ${leaves.length} leave records from DaysOfLeaves with Date-only fields`);

// *** FILTER OUT DELETED LEAVES FOR SCHEDULE TAB ***
const activeLeaves = leaves.filter(leave => {
  const isDeleted = leave.deleted === true;
  if (isDeleted) {
    // *** ОБНОВЛЕНО: Date-only совместимое логирование ***
    const startDateOnly = formatDateOnlyForLogging(leave.startDate);
    const endDateOnly = leave.endDate ? formatDateOnlyForLogging(leave.endDate) : 'ongoing';
    console.log(`[ScheduleTabFillHelpers] Filtering out deleted leave: ${leave.title} (${startDateOnly} - ${endDateOnly})`);
  }
  return !isDeleted;
});

console.log(`[ScheduleTabFillHelpers] *** DATE-ONLY PROCESSING ***`);
console.log(`[ScheduleTabFillHelpers] Total leaves: ${leaves.length}, Active leaves: ${activeLeaves.length}`);

const leavePeriods = activeLeaves.map(leave => {
  // *** ОБНОВЛЕНО: Обработка Date-only полей из DaysOfLeaves ***
  // Создаем нормализованные даты для корректного сравнения
  const startDate = new Date(leave.startDate);
  
  // *** КРИТИЧЕСКИ ВАЖНО: Нормализация к локальной полуночи для Date-only полей ***
  // Date-only поля из SharePoint содержат дату без времени
  const normalizedStartDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0, 0, 0, 0 // Локальная полночь
  );
  
  let normalizedEndDate: Date;
  
  if (leave.endDate) {
    const endDate = new Date(leave.endDate);
    // *** ОБНОВЛЕНО: Для Date-only поля окончания устанавливаем конец дня ***
    normalizedEndDate = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23, 59, 59, 999 // Конец дня для включения всего дня в период
    );
  } else {
    // Если дата окончания не указана, считаем отпуск открытым до далекого будущего
    normalizedEndDate = new Date(2099, 11, 31, 23, 59, 59, 999);
  }
  
  const period: ILeavePeriod = {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    typeOfLeave: leave.typeOfLeave.toString(),
    title: leave.title
  };
  
  // *** ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ ДЛЯ DATE-ONLY СОВМЕСТИМОСТИ ***
  console.log(`[ScheduleTabFillHelpers] *** DATE-ONLY LEAVE PERIOD CREATED ***`);
  console.log(`[ScheduleTabFillHelpers] Original dates: ${formatDateOnlyForLogging(leave.startDate)} - ${leave.endDate ? formatDateOnlyForLogging(leave.endDate) : 'ongoing'}`);
  console.log(`[ScheduleTabFillHelpers] Normalized dates: ${formatDateOnlyForLogging(normalizedStartDate)} - ${formatDateOnlyForLogging(normalizedEndDate)}`);
  console.log(`[ScheduleTabFillHelpers] Leave: "${leave.title}", Type: ${leave.typeOfLeave}`);
  
  return period;
});

console.log(`[ScheduleTabFillHelpers] *** LEAVE PERIODS CREATION COMPLETED ***`);
console.log(`[ScheduleTabFillHelpers] Создан кэш отпусков с Date-only совместимостью: ${leavePeriods.length} активных записей из ${leaves.length} общих`);

// Логируем информацию об отпусках для отладки
leavePeriods.forEach((period, index) => {
  if (index < 3) { // Логируем только первые 3 для экономии места
    const startDateOnly = formatDateOnlyForLogging(period.startDate);
    const endDateOnly = formatDateOnlyForLogging(period.endDate);
    const isOngoing = period.endDate.getFullYear() === 2099;
    
    console.log(`[ScheduleTabFillHelpers] Date-only period ${index + 1}: ${startDateOnly} - ${isOngoing ? 'ongoing' : endDateOnly}, type: ${period.typeOfLeave}, title: "${period.title}"`);
  }
});

return leavePeriods;
}

/**
* *** НОВАЯ ФУНКЦИЯ: Date-only форматирование для логирования ***
* Создает читаемую строку даты в формате YYYY-MM-DD
*/
function formatDateOnlyForLogging(date: Date): string {
const year = date.getFullYear();
const month = (date.getMonth() + 1).toString().padStart(2, '0');
const day = date.getDate().toString().padStart(2, '0');
return `${year}-${month}-${day}`;
}

/**
* Группирует шаблоны по номеру недели и дню недели
* ОБНОВЛЕНО: Работает с числовыми полями времени в шаблонах
*/
export function groupTemplatesByWeekAndDay(activeTemplates: IScheduleTemplate[], dayOfStartWeek: number): TemplateCache {
const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();

console.log(`[ScheduleTabFillHelpers] Grouping ${activeTemplates.length} templates by week and day, dayOfStartWeek=${dayOfStartWeek}`);
console.log(`[ScheduleTabFillHelpers] ОБНОВЛЕНО: Шаблоны содержат время из числовых полей`);

activeTemplates.forEach((template, templateIndex) => {
  const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
  
  console.log(`[ScheduleTabFillHelpers] Processing template ${templateIndex}: week=${weekNumber}, shift=${template.NumberOfShift || template.shiftNumber || 1}`);
  
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const dayInfo = template[day];
    
    // *** ОБНОВЛЕНО: Проверяем структуру времени из числовых полей ***
    if (dayInfo && 
        typeof dayInfo === 'object' && 
        'start' in dayInfo && 
        'end' in dayInfo && 
        dayInfo.start && 
        dayInfo.end) {
      
      // *** ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ: Проверяем, что поля времени заполнены ***
      const startTime = dayInfo.start as IDayHours;
      const endTime = dayInfo.end as IDayHours;
      
      if (!startTime.hours || !startTime.minutes || !endTime.hours || !endTime.minutes) {
        console.log(`[ScheduleTabFillHelpers] Skipping ${day} for template ${templateIndex}: incomplete time data from numeric fields`);
        console.log(`[ScheduleTabFillHelpers] Start: hours="${startTime.hours}", minutes="${startTime.minutes}"`);
        console.log(`[ScheduleTabFillHelpers] End: hours="${endTime.hours}", minutes="${endTime.minutes}"`);
        continue;
      }
      
      const key = `${weekNumber}-${i + 1}`;
      
      if (!templatesByWeekAndDay.has(key)) {
        templatesByWeekAndDay.set(key, []);
      }
      
      const processedTemplate: IScheduleTemplate = {
        ...template,
        dayOfWeek: i + 1,
        start: startTime,
        end: endTime,
        lunch: template.lunch || '30'
      };
      
      templatesByWeekAndDay.get(key)?.push(processedTemplate);
      
      // *** ОБНОВЛЕНО: Логируем время из числовых полей ***
      console.log(`[ScheduleTabFillHelpers] Added template for key ${key} (${day}) from numeric fields: ${startTime.hours}:${startTime.minutes} - ${endTime.hours}:${endTime.minutes}`);
    } else {
      // Логируем пропущенные дни
      if (templateIndex === 0) { // Логируем только для первого шаблона, чтобы не засорять логи
        console.log(`[ScheduleTabFillHelpers] Skipping ${day} for template ${templateIndex}: no valid time data from numeric fields`);
      }
    }
  }
});

console.log(`[ScheduleTabFillHelpers] Сгруппированы шаблоны с числовыми полями времени: ${templatesByWeekAndDay.size} комбинаций`);

// Логируем сводку по группировке
templatesByWeekAndDay.forEach((templates, key) => {
  console.log(`[ScheduleTabFillHelpers] Key ${key}: ${templates.length} template(s)`);
});

return templatesByWeekAndDay;
}

/**
* *** ОБНОВЛЕНО: prepareDaysData с улучшенной Date-only логикой для отпусков ***
* Подготавливает данные для всех дней периода с правильным подсчетом дней
* ИСПРАВЛЕНО: Использует UTC методы для создания дат и правильно считает количество дней
* ОБНОВЛЕНО: Корректно проверяет отпуска с Date-only полями
*/
export function prepareDaysData(
firstDay: Date,
lastDay: Date,
holidayCache: HolidayCache,
leavePeriods: ILeavePeriod[],
templatesByWeekAndDay: TemplateCache,
numberOfWeekTemplates: number
): Map<string, IDayData> {
console.log(`[ScheduleTabFillHelpers] *** UPDATED prepareDaysData WITH DATE-ONLY LEAVE COMPATIBILITY ***`);
console.log(`[ScheduleTabFillHelpers] Period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
console.log(`[ScheduleTabFillHelpers] Templates contain time from numeric fields`);
console.log(`[ScheduleTabFillHelpers] Leave periods created with Date-only compatibility`);

// *** ИСПРАВЛЕНИЕ: Правильный расчет количества дней в периоде ***
// Создаем нормализованные даты для точного подсчета дней
const normalizedFirstDay = new Date(Date.UTC(
  firstDay.getUTCFullYear(),
  firstDay.getUTCMonth(),
  firstDay.getUTCDate(),
  0, 0, 0, 0
));

const normalizedLastDay = new Date(Date.UTC(
  lastDay.getUTCFullYear(),
  lastDay.getUTCMonth(),
  lastDay.getUTCDate(),
  0, 0, 0, 0
));

// Правильный расчет количества дней: разность дат в днях + 1
const timeDiffMs = normalizedLastDay.getTime() - normalizedFirstDay.getTime();
const dayCount = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24)) + 1;

console.log(`[ScheduleTabFillHelpers] *** CORRECTED DAY CALCULATION ***`);
console.log(`[ScheduleTabFillHelpers] Normalized first day: ${normalizedFirstDay.toISOString()}`);
console.log(`[ScheduleTabFillHelpers] Normalized last day: ${normalizedLastDay.toISOString()}`);
console.log(`[ScheduleTabFillHelpers] Time difference (ms): ${timeDiffMs}`);
console.log(`[ScheduleTabFillHelpers] Time difference (days): ${timeDiffMs / (1000 * 60 * 60 * 24)}`);
console.log(`[ScheduleTabFillHelpers] Calculated day count: ${dayCount}`);

const daysData = new Map<string, IDayData>();

for (let i = 0; i < dayCount; i++) {
  // *** ИСПРАВЛЕНИЕ: Используем UTC методы для создания дат С ПРОВЕРКОЙ ГРАНИЦ ***
  const currentDate = new Date(Date.UTC(
    normalizedFirstDay.getUTCFullYear(),
    normalizedFirstDay.getUTCMonth(),
    normalizedFirstDay.getUTCDate() + i,
    0, 0, 0, 0  // UTC полночь
  ));
  
  // *** КРИТИЧЕСКИ ВАЖНАЯ ПРОВЕРКА: убеждаемся, что не выходим за границы периода ***
  if (currentDate > normalizedLastDay) {
    console.warn(`[ScheduleTabFillHelpers] *** DAY BOUNDARY CHECK FAILED ***`);
    console.warn(`[ScheduleTabFillHelpers] Generated date ${currentDate.toISOString()} exceeds lastDay ${normalizedLastDay.toISOString()}`);
    console.warn(`[ScheduleTabFillHelpers] Breaking loop at day ${i + 1} of ${dayCount}`);
    break;
  }
  
  console.log(`[ScheduleTabFillHelpers] Day ${i + 1}/${dayCount}: ${currentDate.toISOString()}`);
  
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
  
  // *** ОБНОВЛЕНО: Проверяем отпуска с улучшенной Date-only логикой ***
  const leaveForDay = leavePeriods.find(leave => {
    // *** ИСПРАВЛЕНО: Создаем локальную дату для сравнения с нормализованными периодами отпусков ***
    // currentDate в UTC, а leave periods в локальном времени
    const localCurrentDate = new Date(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate(),
      12, 0, 0, 0 // Полдень локального времени для надежного сравнения
    );
    
    const isInLeave = localCurrentDate >= leave.startDate && localCurrentDate <= leave.endDate;
    
    if (isInLeave) {
      console.log(`[ScheduleTabFillHelpers] *** DATE-ONLY LEAVE MATCH FOUND ***`);
      console.log(`[ScheduleTabFillHelpers] Date: ${formatDateOnlyForLogging(currentDate)} matches leave "${leave.title}"`);
      console.log(`[ScheduleTabFillHelpers] Leave period: ${formatDateOnlyForLogging(leave.startDate)} - ${formatDateOnlyForLogging(leave.endDate)}`);
      console.log(`[ScheduleTabFillHelpers] Leave type: ${leave.typeOfLeave}`);
    }
    
    return isInLeave;
  });
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
  
  // *** СПЕЦИАЛЬНАЯ ОТЛАДКА ДЛЯ 1 ОКТЯБРЯ 2024 ***
  if (currentDate.getUTCDate() === 1 && currentDate.getUTCMonth() === 9 && currentDate.getUTCFullYear() === 2024) {
    console.log(`[ScheduleTabFillHelpers] *** OCTOBER 1st 2024 DAY DATA PREPARED ***`);
    console.log(`[ScheduleTabFillHelpers] Date: ${currentDate.toISOString()}`);
    console.log(`[ScheduleTabFillHelpers] Day of week: ${adjustedDayIndex} (${['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][adjustedDayIndex]})`);
    console.log(`[ScheduleTabFillHelpers] Week number: ${weekNumber}, Applied week: ${appliedWeekNumber}`);
    console.log(`[ScheduleTabFillHelpers] Is holiday: ${isHoliday}`);
    console.log(`[ScheduleTabFillHelpers] Is leave: ${isLeave} (Date-only compatible check)`);
    console.log(`[ScheduleTabFillHelpers] Templates count: ${templatesForDay.length}`);
    console.log(`[ScheduleTabFillHelpers] Template lookup key: ${key}`);
    console.log(`[ScheduleTabFillHelpers] Templates contain time from numeric fields`);
  }
  
  // Логируем информацию о дне (только для первых нескольких дней и важных случаев)
  if (i < 3 || isHoliday || isLeave || templatesForDay.length > 0) {
    const dayName = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][adjustedDayIndex];
    console.log(`[ScheduleTabFillHelpers] Day ${i + 1} (${currentDate.toLocaleDateString()} ${dayName}): holiday=${isHoliday}, leave=${isLeave} (Date-only), templates=${templatesForDay.length}, week=${appliedWeekNumber}`);
    
    if (isHoliday && holidayInfo) {
      console.log(`[ScheduleTabFillHelpers]   Holiday: ${holidayInfo.title}`);
    }
    
    if (isLeave && leaveForDay) {
      console.log(`[ScheduleTabFillHelpers]   Leave (Date-only): ${leaveForDay.title} (type: ${leaveForDay.typeOfLeave})`);
      console.log(`[ScheduleTabFillHelpers]   Leave period: ${formatDateOnlyForLogging(leaveForDay.startDate)} - ${formatDateOnlyForLogging(leaveForDay.endDate)}`);
    }
    
    if (templatesForDay.length > 0) {
      templatesForDay.forEach((template, tIndex) => {
        // *** ОБНОВЛЕНО: Логируем время из числовых полей ***
        console.log(`[ScheduleTabFillHelpers]   Template ${tIndex + 1} (from numeric): ${template.start?.hours}:${template.start?.minutes} - ${template.end?.hours}:${template.end?.minutes}, lunch: ${template.lunch}min`);
      });
    }
  }
}

console.log(`[ScheduleTabFillHelpers] *** FINAL RESULT: CORRECT DAY COUNT WITH DATE-ONLY LEAVES ***`);
console.log(`[ScheduleTabFillHelpers] Expected days: ${dayCount}, Generated days: ${daysData.size}`);
console.log(`[ScheduleTabFillHelpers] Day count matches: ${dayCount === daysData.size ? 'YES ✓' : 'NO ✗'}`);
console.log(`[ScheduleTabFillHelpers] Templates contain time from numeric fields: ✓`);
console.log(`[ScheduleTabFillHelpers] Leave periods use Date-only compatible logic: ✓`);
console.log(`[ScheduleTabFillHelpers] UTC timezone safe for DST transitions: ✓`);

// Статистика по подготовленным данным
let holidaysCount = 0;
let leavesCount = 0;
let templatesCount = 0;

daysData.forEach(dayData => {
  if (dayData.isHoliday) holidaysCount++;
  if (dayData.isLeave) leavesCount++;
  templatesCount += dayData.templates.length;
});

console.log(`[ScheduleTabFillHelpers] Summary with Date-only leaves: ${holidaysCount} holidays, ${leavesCount} leave days, ${templatesCount} total templates`);

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
* ОБНОВЛЕНО: Проверяет время из числовых полей
*/
export function validateTemplate(template: IScheduleTemplate): boolean {
// Проверяем наличие обязательных полей
if (!template.start || !template.end) {
  console.warn(`[ScheduleTabFillHelpers] Template validation failed: missing start or end time`);
  return false;
}

// *** ОБНОВЛЕНО: Проверяем корректность времени из числовых полей ***
const startHours = parseInt(template.start.hours || '0', 10);
const startMinutes = parseInt(template.start.minutes || '0', 10);
const endHours = parseInt(template.end.hours || '0', 10);
const endMinutes = parseInt(template.end.minutes || '0', 10);

if (isNaN(startHours) || isNaN(startMinutes) || isNaN(endHours) || isNaN(endMinutes)) {
  console.warn(`[ScheduleTabFillHelpers] Template validation failed: invalid time format from numeric fields`);
  console.warn(`[ScheduleTabFillHelpers] Start: ${template.start.hours}:${template.start.minutes}, End: ${template.end.hours}:${template.end.minutes}`);
  return false;
}

if (startHours < 0 || startHours > 23 || endHours < 0 || endHours > 23) {
  console.warn(`[ScheduleTabFillHelpers] Template validation failed: hours out of range (numeric fields)`);
  console.warn(`[ScheduleTabFillHelpers] Start hours: ${startHours}, End hours: ${endHours}`);
  return false;
}

if (startMinutes < 0 || startMinutes > 59 || endMinutes < 0 || endMinutes > 59) {
  console.warn(`[ScheduleTabFillHelpers] Template validation failed: minutes out of range (numeric fields)`);
  console.warn(`[ScheduleTabFillHelpers] Start minutes: ${startMinutes}, End minutes: ${endMinutes}`);
  return false;
}

console.log(`[ScheduleTabFillHelpers] Template validation passed for numeric fields: ${startHours}:${startMinutes} - ${endHours}:${endMinutes}`);
return true;
}

/**
* Форматирует время в читаемый вид для логирования
* ОБНОВЛЕНО: Работает с временем из числовых полей
*/
export function formatTimeForLogging(time?: IDayHours): string {
if (!time || !time.hours || !time.minutes) {
  return '00:00';
}

// *** ОБНОВЛЕНО: Форматируем время из числовых полей ***
const hours = time.hours.toString().padStart(2, '0');
const minutes = time.minutes.toString().padStart(2, '0');
return `${hours}:${minutes}`;
}

/**
* *** ОБНОВЛЕНО: Подсчитывает статистику по дням данных с Date-only совместимостью ***
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
  if (dayData.isLeave) leaveDays++; // *** Теперь проверка отпусков использует Date-only логику ***
  if (dayData.templates.length > 0) {
    daysWithTemplates++;
    totalTemplates += dayData.templates.length;
  }
});

const workingDays = daysData.size - holidayDays - leaveDays;

const stats = {
  totalDays: daysData.size,
  holidayDays,
  leaveDays, // *** Статистика отпусков с Date-only совместимостью ***
  workingDays,
  daysWithTemplates,
  totalTemplates
};

console.log(`[ScheduleTabFillHelpers] Days data statistics with Date-only leaves:`, stats);

return stats;
}