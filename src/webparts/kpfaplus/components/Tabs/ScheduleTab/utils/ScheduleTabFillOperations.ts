// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillOperations.ts

import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IDayHours, WeeklyTimeTableUtils } from '../../../../models/IWeeklyTimeTable';
import { WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';

/**
* Interface for fill operation parameters
*/
export interface IFillOperationParams {
 selectedDate: Date;
 selectedStaffId?: string;
 employeeId: string;
 selectedContract: IContract | undefined;
 selectedContractId: string | undefined;
 holidays: IHoliday[];
 leaves: ILeaveDay[];
 currentUserId?: string;
 managingGroupId?: string;
 dayOfStartWeek?: number;
 context?: WebPartContext;
}

/**
* Interface for operation handlers and callbacks
*/
export interface IFillOperationHandlers {
 createStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
 setOperationMessage: (message: { text: string; type: MessageBarType } | undefined) => void;
 setIsSaving: (isSaving: boolean) => void;
 onRefreshData?: () => void;
}

/**
* Интерфейс для шаблона расписания
* ОБНОВЛЕНО: Использует числовые поля времени
*/
interface IScheduleTemplate {
 NumberOfWeek?: number;
 numberOfWeek?: number;
 NumberOfShift?: number;
 shiftNumber?: number;
 dayOfWeek?: number;
 start?: IDayHours; // Время из числовых полей
 end?: IDayHours;   // Время из числовых полей
 lunch?: string;
 total?: string;
 deleted?: number;
 Deleted?: number;
 [key: string]: unknown;
}

/**
* Интерфейс для данных дня месяца
*/
interface IDayData {
 date: Date;
 isHoliday: boolean;
 holidayInfo?: IHoliday;
 isLeave: boolean;
 leaveInfo?: { typeOfLeave: string; title: string };
 templates: IScheduleTemplate[];
 dayOfWeek: number; // 1-7, где 1 - понедельник, 7 - воскресенье
 weekNumber: number; // Номер недели в месяце (1-5)
 appliedWeekNumber: number; // Применяемый номер недели для шаблона
}

/**
* Вспомогательная функция для определения применяемого номера недели
*/
function getAppliedWeekNumber(calculatedWeekNumber: number, numberOfWeekTemplates: number): number {
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
* Main function for filling schedule based on templates
* ОБНОВЛЕНО: Работает только с Date-only + числовые поля времени
* УДАЛЕНО: Создание ShiftDate1/ShiftDate2/ShiftDate3/ShiftDate4 полей
* @param params Parameters for the operation
* @param handlers Handlers and callbacks for the operation
*/
export const fillScheduleFromTemplate = async (
 params: IFillOperationParams,
 handlers: IFillOperationHandlers
): Promise<void> => {
 const { 
   selectedDate, employeeId, 
   selectedContract, selectedContractId, 
   holidays, leaves, currentUserId, managingGroupId, dayOfStartWeek = 7,
   context
 } = params;
 
 const { createStaffRecord, setOperationMessage, setIsSaving, onRefreshData } = handlers;

 // Preliminary data validation
 if (!selectedContract || !selectedContractId) {
   setOperationMessage({
     text: 'Cannot fill schedule: No contract selected',
     type: MessageBarType.error
   });
   return;
 }

 if (!employeeId) {
   setOperationMessage({
     text: 'Cannot fill schedule: Invalid employee ID',
     type: MessageBarType.error
   });
   return;
 }

 if (!context) {
   setOperationMessage({
     text: 'Cannot fill schedule: WebPart context is not available',
     type: MessageBarType.error
   });
   return;
 }

 // Set loading state
 setIsSaving(true);

 try {
   // Define month start and end for selected date
   const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
   const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
   
   console.log(`[ScheduleTabFillOperations] Month period: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
   
   // Adjust dates based on contract dates
   const contractStartDate = selectedContract.startDate;
   const contractFinishDate = selectedContract.finishDate;
   
   // Determine actual start and end dates for generation
   const firstDay = contractStartDate && contractStartDate > startOfMonth 
     ? new Date(contractStartDate) 
     : new Date(startOfMonth);
   
   const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
     ? new Date(contractFinishDate) 
     : new Date(endOfMonth);
   
   console.log(`[ScheduleTabFillOperations] Adjusted period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
   
   // *** ОПТИМИЗАЦИЯ 1: Предварительная подготовка кэша праздников ***
   // Создаем Map для быстрого поиска праздников по дате
   const holidayMap = new Map<string, IHoliday>();
   
   // Заполняем Map ключами в формате "YYYY-MM-DD" для быстрого поиска
   holidays.forEach(holiday => {
     const holidayDate = new Date(holiday.date);
     const key = `${holidayDate.getFullYear()}-${holidayDate.getMonth() + 1}-${holidayDate.getDate()}`;
     holidayMap.set(key, holiday);
   });
   
   console.log(`[ScheduleTabFillOperations] Создан кэш праздников: ${holidayMap.size} записей`);
   
   // *** ОПТИМИЗАЦИЯ 2: Предварительная подготовка кэша отпусков ***
   // Создаем массив периодов отпусков для быстрой проверки
   const leavePeriods = leaves.map(leave => {
     const startDate = new Date(leave.startDate);
     const endDate = leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31); // Далекое будущее для открытых отпусков
     return {
       startDate,
       endDate,
       typeOfLeave: leave.typeOfLeave.toString(),
       title: leave.title
     };
   });
   
   console.log(`[ScheduleTabFillOperations] Подготовлен кэш отпусков: ${leavePeriods.length} записей`);
   
   // Fetch weekly schedule templates
   try {
     const weeklyTimeService = new WeeklyTimeTableService(context);
     
     // Request templates from service
     const weeklyTimeItems = await weeklyTimeService.getWeeklyTimeTableByContractId(selectedContractId);
     
     if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
       setOperationMessage({
         text: 'No weekly templates found for the selected contract',
         type: MessageBarType.warning
       });
       setIsSaving(false);
       return;
     }
     
     console.log(`[ScheduleTabFillOperations] Retrieved ${weeklyTimeItems.length} weekly time templates`);
     console.log(`[ScheduleTabFillOperations] ОБНОВЛЕНО: Шаблоны содержат числовые поля времени`);
     
     // Format raw data for use - now using numeric time fields
     const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeItems, dayOfStartWeek);
     
     if (!formattedTemplates || formattedTemplates.length === 0) {
       setOperationMessage({
         text: 'Error formatting weekly templates',
         type: MessageBarType.error
       });
       setIsSaving(false);
       return;
     }
     
     console.log(`[ScheduleTabFillOperations] Formatted ${formattedTemplates.length} templates from numeric time fields`);
     
     // Filter deleted templates
     const activeTemplates = formattedTemplates.filter(template => 
       template.deleted !== 1 && template.Deleted !== 1
     );
     
     console.log(`[ScheduleTabFillOperations] Active templates: ${activeTemplates.length}`);
     
     if (activeTemplates.length === 0) {
       setOperationMessage({
         text: 'No active weekly templates found for the selected contract',
         type: MessageBarType.warning
       });
       setIsSaving(false);
       return;
     }
     
     // *** ОПТИМИЗАЦИЯ 3: Группировка шаблонов по номеру недели и дню недели ***
     const templatesByWeekAndDay = new Map<string, IScheduleTemplate[]>();
     
     activeTemplates.forEach(template => {
       const weekNumber = template.NumberOfWeek || template.numberOfWeek || 1;
       
       // Для каждого дня недели проверяем, есть ли расписание
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
             console.log(`[ScheduleTabFillOperations] Skipping ${day} for template: incomplete time data from numeric fields`);
             console.log(`[ScheduleTabFillOperations] Start: hours="${startTime.hours}", minutes="${startTime.minutes}"`);
             console.log(`[ScheduleTabFillOperations] End: hours="${endTime.hours}", minutes="${endTime.minutes}"`);
             continue;
           }
           
           const key = `${weekNumber}-${i + 1}`; // Формат "номер_недели-номер_дня"
           
           if (!templatesByWeekAndDay.has(key)) {
             templatesByWeekAndDay.set(key, []);
           }
           
           templatesByWeekAndDay.get(key)?.push({
             ...template,
             dayOfWeek: i + 1, // 1 = Monday, ..., 7 = Sunday
             start: startTime,
             end: endTime,
             lunch: template.lunch || '30'
           });
           
           console.log(`[ScheduleTabFillOperations] Added template for key ${key} (${day}) from numeric fields: ${startTime.hours}:${startTime.minutes} - ${endTime.hours}:${endTime.minutes}`);
         }
       }
     });
     
     console.log(`[ScheduleTabFillOperations] Сгруппированы шаблоны по неделям и дням: ${templatesByWeekAndDay.size} комбинаций`);
     
     // Determine number of distinct weekly templates
     const distinctWeeks = new Set(activeTemplates.map(template => template.NumberOfWeek || template.numberOfWeek || 1));
     const numberOfWeekTemplates = distinctWeeks.size || 1;
     
     console.log(`[ScheduleTabFillOperations] Number of week templates: ${numberOfWeekTemplates}`);
     
     // *** НОВАЯ ОПТИМИЗАЦИЯ: Предварительная подготовка данных для всех дней периода ***
     console.log(`[ScheduleTabFillOperations] Начинаем подготовку данных для всех дней периода...`);
     
     // Количество дней в периоде
     const dayCount = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
     
     // Создаем и заполняем структуру данных для каждого дня в периоде
     const daysData = new Map<string, IDayData>();
     
     for (let i = 0; i < dayCount; i++) {
       // Текущий день
       const currentDate = new Date(firstDay);
       currentDate.setDate(firstDay.getDate() + i);
       
       // Формируем ключ для даты в формате "YYYY-MM-DD"
       const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
       
       // Определяем день недели (1-7, где 1 - понедельник, 7 - воскресенье)
       const dayIndex = currentDate.getDay();
       const adjustedDayIndex = dayIndex === 0 ? 7 : dayIndex;
       
       // Определяем номер недели в месяце
       const dayOfMonth = currentDate.getDate();
       const weekNumber = Math.floor((dayOfMonth - 1) / 7) + 1;
       
       // Определяем применяемый номер недели на основе количества шаблонов
       const appliedWeekNumber = getAppliedWeekNumber(weekNumber, numberOfWeekTemplates);
       
       // Проверяем, является ли день праздником
       const isHoliday = holidayMap.has(dateKey);
       const holidayInfo = isHoliday ? holidayMap.get(dateKey) : undefined;
       
       // Проверяем, находится ли сотрудник в отпуске в этот день
       const leaveForDay = leavePeriods.find(leave => 
         currentDate >= leave.startDate && currentDate <= leave.endDate
       );
       
       const isLeave = !!leaveForDay;
       
       // Получаем шаблоны для этого дня недели и недели
       const key = `${appliedWeekNumber}-${adjustedDayIndex}`;
       const templatesForDay = templatesByWeekAndDay.get(key) || [];
       
       // Сохраняем всю информацию для этого дня
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
     
     console.log(`[ScheduleTabFillOperations] Подготовлены данные для ${daysData.size} дней`);
     
     // Генерируем записи расписания на основе подготовленных данных
     const generatedRecords: Partial<IStaffRecord>[] = [];
     
     // Перебираем все дни в нашей структуре данных
     daysData.forEach((dayData, dateKey) => {
       // Если для этого дня есть шаблоны, создаем записи
       if (dayData.templates.length > 0) {
         console.log(`[ScheduleTabFillOperations] День ${dayData.date.toLocaleDateString()}: найдено ${dayData.templates.length} шаблонов с числовыми полями времени`);
         
         // Для каждого шаблона создаем запись расписания
         dayData.templates.forEach(template => {
           // Проверяем наличие времени начала и окончания в шаблоне
           if (!template.start || !template.end) {
             console.log(`[ScheduleTabFillOperations] Пропуск шаблона без времени начала/окончания для ${dayData.date.toLocaleDateString()}`);
             return; // Пропускаем этот шаблон
           }
           
           // *** ОБНОВЛЕНО: Используем ТОЛЬКО числовые поля времени ***
           console.log(`[ScheduleTabFillOperations] *** CREATING RECORD WITH NUMERIC FIELDS ONLY ***`);
           console.log(`[ScheduleTabFillOperations] Template start time from numeric fields: ${template.start.hours}:${template.start.minutes}`);
           console.log(`[ScheduleTabFillOperations] Template end time from numeric fields: ${template.end.hours}:${template.end.minutes}`);
           console.log(`[ScheduleTabFillOperations] Base date: ${dayData.date.toISOString()}`);
           
           // *** ИЗВЛЕКАЕМ ЧИСЛОВЫЕ ЗНАЧЕНИЯ ВРЕМЕНИ ***
           const startHours = parseInt(template.start.hours, 10);
           const startMinutes = parseInt(template.start.minutes, 10);
           const finishHours = parseInt(template.end.hours, 10);
           const finishMinutes = parseInt(template.end.minutes, 10);
           
           // Создаем объект записи ТОЛЬКО с Date-only + числовые поля времени
           const recordData: Partial<IStaffRecord> = {
             Title: `Template=${selectedContractId} Week=${dayData.appliedWeekNumber} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
             Date: new Date(dayData.date), // *** DATE-ONLY ПОЛЕ ***
             
             // *** ТОЛЬКО ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
             ShiftDate1Hours: startHours,
             ShiftDate1Minutes: startMinutes,
             ShiftDate2Hours: finishHours,
             ShiftDate2Minutes: finishMinutes,
             
             TimeForLunch: parseInt(template.lunch || '30', 10),
             Contract: parseInt(template.total || '1', 10),
             WeeklyTimeTableID: selectedContractId,
             WeeklyTimeTableTitle: selectedContract.template || ''
           };
           
           // Если сотрудник в отпуске в этот день, добавляем тип отпуска
           if (dayData.isLeave && dayData.leaveInfo) {
             const typeOfLeave = dayData.leaveInfo.typeOfLeave;
             
             // Проверяем, что тип отпуска не пустой и не ноль
             if (!typeOfLeave || typeOfLeave === '0' || Number(typeOfLeave) === 0) {
               console.log(`[ScheduleTabFillOperations] ВНИМАНИЕ: Тип отпуска для ${dayData.date.toLocaleDateString()} пустой или равен нулю: "${typeOfLeave}"`);
             } else {
               // Преобразуем в строку, если это число
               recordData.TypeOfLeaveID = String(typeOfLeave);
               console.log(`[ScheduleTabFillOperations] Установлен тип отпуска для ${dayData.date.toLocaleDateString()}: ${recordData.TypeOfLeaveID} (${dayData.leaveInfo.title})`);
             }
           } else if (dayData.isLeave) {
             console.log(`[ScheduleTabFillOperations] ВНИМАНИЕ: День ${dayData.date.toLocaleDateString()} отмечен как отпуск, но информация о типе отпуска отсутствует!`);
           }
           
           console.log(`[ScheduleTabFillOperations] Подготовлена запись для ${dayData.date.toLocaleDateString()} ТОЛЬКО с числовыми полями:
             - Начало смены: ${startHours}:${startMinutes}
             - Конец смены: ${finishHours}:${finishMinutes}
             - Время на обед: ${recordData.TimeForLunch} мин.
             - ID типа отпуска: ${recordData.TypeOfLeaveID || 'не установлен'}
             - ID шаблона: ${recordData.WeeklyTimeTableID}
           `);
           
           // Добавляем запись в коллекцию
           generatedRecords.push(recordData);
         });
       }
     });
     
     console.log(`[ScheduleTabFillOperations] Сгенерировано ${generatedRecords.length} записей ТОЛЬКО с числовыми полями времени`);
     
     // If no records generated, show error
     if (generatedRecords.length === 0) {
       setOperationMessage({
         text: 'No records generated. Please check the contract and weekly templates.',
         type: MessageBarType.warning
       });
       setIsSaving(false);
       return;
     }
     
     // Data validation for IDs before proceeding
     if (!employeeId || employeeId === '0' || employeeId === '') {
       console.error(`[ScheduleTabFillOperations] Missing or invalid employeeId: ${employeeId}`);
     }
     
     if (!currentUserId || currentUserId === '0' || currentUserId === '') {
       console.error(`[ScheduleTabFillOperations] Missing or invalid currentUserId: ${currentUserId}`);
     }
     
     if (!managingGroupId || managingGroupId === '0' || managingGroupId === '') {
       console.error(`[ScheduleTabFillOperations] Missing or invalid managingGroupId: ${managingGroupId}`);
     }
     
     // Log the IDs being passed before creation
     console.log(`[ScheduleTabFillOperations] Will create records with these IDs:
       staffMemberId=${employeeId} (${typeof employeeId})
       currentUserId=${currentUserId || 'N/A'} (${typeof currentUserId})
       staffGroupId=${managingGroupId || 'N/A'} (${typeof managingGroupId})
     `);
     
     // Save generated records
     let successCount = 0;
     const failedRecords: string[] = [];
     
     // Save records sequentially
     for (const record of generatedRecords) {
       try {
         console.log(`[ScheduleTabFillOperations] Создание записи для ${record.Date?.toLocaleDateString()} ТОЛЬКО с числовыми полями:
           - TypeOfLeaveID: ${record.TypeOfLeaveID || 'не установлен'} (тип: ${typeof record.TypeOfLeaveID})
           - Contract: ${record.Contract}
           - TimeForLunch: ${record.TimeForLunch}
           - ShiftDate1Hours: ${record.ShiftDate1Hours}
           - ShiftDate1Minutes: ${record.ShiftDate1Minutes}
           - ShiftDate2Hours: ${record.ShiftDate2Hours}
           - ShiftDate2Minutes: ${record.ShiftDate2Minutes}
           - Date (Date-only): ${record.Date?.toISOString()}
         `);
         
         // Call create method with explicit ID passing
         const newRecordId = await createStaffRecord(
           record,
           currentUserId,      // Manager ID
           managingGroupId,    // Staff Group ID
           employeeId          // Employee ID
         );
         
         if (newRecordId) {
           successCount++;
           if (record.TypeOfLeaveID) {
             console.log(`[ScheduleTabFillOperations] УСПЕХ: Создана запись ID=${newRecordId} для ${record.Date?.toLocaleDateString()} с типом отпуска: ${record.TypeOfLeaveID}`);
           } else {
             console.log(`[ScheduleTabFillOperations] УСПЕХ: Создана запись ID=${newRecordId} для ${record.Date?.toLocaleDateString()} (без типа отпуска)`);
           }
         } else {
           failedRecords.push(record.Title || 'Unknown');
           console.error(`[ScheduleTabFillOperations] НЕУДАЧА: Не удалось создать запись для ${record.Date?.toLocaleDateString()}: ${record.Title}`);
         }
       } catch (error) {
         console.error(`[ScheduleTabFillOperations] ОШИБКА при создании записи для ${record.Date?.toLocaleDateString()}:`, error);
         failedRecords.push(record.Title || 'Unknown');
       }
     }
     
     // Show result message
     if (successCount === generatedRecords.length) {
       setOperationMessage({
         text: `Successfully generated ${successCount} schedule records from template with numeric time fields only`,
         type: MessageBarType.success
       });
     } else if (successCount > 0) {
       setOperationMessage({
         text: `Generated ${successCount} of ${generatedRecords.length} records. Failed: ${failedRecords.length}`,
         type: MessageBarType.warning
       });
     } else {
       setOperationMessage({
         text: `Failed to generate any records. Please try again.`,
         type: MessageBarType.error
       });
     }
     
     // Refresh data in UI
     if (onRefreshData) {
       onRefreshData();
     }
   } catch (templateError) {
     console.error('[ScheduleTabFillOperations] Error retrieving or processing templates:', templateError);
     setOperationMessage({
       text: `Error retrieving templates: ${templateError instanceof Error ? templateError.message : String(templateError)}`,
       type: MessageBarType.error
     });
   }
 } catch (error) {
   console.error('[ScheduleTabFillOperations] Error during schedule fill operation:', error);
   setOperationMessage({
     text: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
     type: MessageBarType.error
   });
 } finally {
   setIsSaving(false);
 }
};

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
   // If there are existing records, show warning
   return {
     isOpen: true,
     title: 'Confirm Fill Operation',
     message: 'There are existing records in the schedule. Filling the schedule will add new records based on templates. Do you want to continue?',
     confirmButtonText: 'Continue',
     cancelButtonText: 'Cancel',
     onConfirm,
     confirmButtonColor: '#d83b01' // Orange color for warning
   };
 } else {
   // If no records, show simple confirmation
   return {
     isOpen: true,
     title: 'Fill Schedule',
     message: 'Do you want to fill the schedule based on template data?',
     confirmButtonText: 'Fill',
     cancelButtonText: 'Cancel',
     onConfirm,
     confirmButtonColor: '#107c10' // Green color for confirmation
   };
 }
};