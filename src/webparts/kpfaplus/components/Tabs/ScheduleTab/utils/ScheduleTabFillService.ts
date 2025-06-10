// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillService.ts

import { MessageBarType } from '@fluentui/react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';
import { WeeklyTimeTableUtils } from '../../../../models/IWeeklyTimeTable';
import { IContract } from '../../../../models/IContract';
import { 
  IFillOperationParams, 
  IFillOperationHandlers,
  IDayData,
  IExistingRecordCheck,
  IRecordsProcessingStatus
} from './ScheduleTabFillInterfaces';
import {
  createHolidayCache,
  createLeavePeriods,
  groupTemplatesByWeekAndDay,
  prepareDaysData,
  createDateWithTime,
  checkRecordsProcessingStatus,
  createProcessingBlockMessage
} from './ScheduleTabFillHelpers';
import { RemoteSiteService } from '../../../../services/RemoteSiteService';

/**
 * Main function for filling schedule based on templates
 * Предполагается, что проверка существующих записей и диалог подтверждения
 * уже выполнены в вызывающем коде (ScheduleTabContent)
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
  
  const { 
    createStaffRecord, 
    setOperationMessage, 
    setIsSaving, 
    onRefreshData,
    getExistingRecordsWithStatus,
    markRecordsAsDeleted 
  } = handlers;

  // Предварительная валидация данных
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

  setIsSaving(true);

  try {
    // *** ИСПРАВЛЕНИЕ: Создаем границы месяца в UTC используя UTC методы ***
    const startOfMonth = new Date(Date.UTC(
      selectedDate.getUTCFullYear(), 
      selectedDate.getUTCMonth(), 
      1, 
      0, 0, 0, 0
    ));
    
    const endOfMonth = new Date(Date.UTC(
      selectedDate.getUTCFullYear(), 
      selectedDate.getUTCMonth() + 1, 
      0, 
      23, 59, 59, 999
    ));

    console.log(`[ScheduleTabFillService] *** UTC MONTH BOUNDARIES FOR FILL OPERATION ***`);
    console.log(`[ScheduleTabFillService] Start of month (UTC): ${startOfMonth.toISOString()}`);
    console.log(`[ScheduleTabFillService] End of month (UTC): ${endOfMonth.toISOString()}`);
    console.log(`[ScheduleTabFillService] Selected date: ${selectedDate.toISOString()}`);
    
    const contractStartDate = selectedContract.startDate;
    const contractFinishDate = selectedContract.finishDate;
    
    console.log(`[ScheduleTabFillService] Contract boundaries:`);
    console.log(`[ScheduleTabFillService] Contract start: ${contractStartDate?.toISOString() || 'not set'}`);
    console.log(`[ScheduleTabFillService] Contract finish: ${contractFinishDate?.toISOString() || 'not set'}`);
    
    // *** ИСПРАВЛЕНИЕ: Нормализуем даты контракта к UTC если они существуют ***
    let firstDay: Date;
    if (contractStartDate && contractStartDate > startOfMonth) {
      // Если дата начала контракта позже начала месяца, используем дату контракта
      firstDay = new Date(Date.UTC(
        contractStartDate.getUTCFullYear(),
        contractStartDate.getUTCMonth(),
        contractStartDate.getUTCDate(),
        0, 0, 0, 0
      ));
      console.log(`[ScheduleTabFillService] Using contract start date as first day`);
    } else {
      // Иначе используем начало месяца
      firstDay = startOfMonth;
      console.log(`[ScheduleTabFillService] Using month start as first day`);
    }

    let lastDay: Date;
    if (contractFinishDate && contractFinishDate < endOfMonth) {
      // Если дата окончания контракта раньше конца месяца, используем дату контракта
      lastDay = new Date(Date.UTC(
        contractFinishDate.getUTCFullYear(),
        contractFinishDate.getUTCMonth(),
        contractFinishDate.getUTCDate(),
        23, 59, 59, 999
      ));
      console.log(`[ScheduleTabFillService] Using contract finish date as last day`);
    } else {
      // Иначе используем конец месяца
      lastDay = endOfMonth;
      console.log(`[ScheduleTabFillService] Using month end as last day`);
    }
    
    console.log(`[ScheduleTabFillService] *** FINAL FILL PERIOD (UTC) ***`);
    console.log(`[ScheduleTabFillService] First day: ${firstDay.toISOString()}`);
    console.log(`[ScheduleTabFillService] Last day: ${lastDay.toISOString()}`);
    
    // *** УДАЛЯЕМ СУЩЕСТВУЮЩИЕ ЗАПИСИ ПЕРЕД СОЗДАНИЕМ НОВЫХ ***
    if (getExistingRecordsWithStatus && markRecordsAsDeleted) {
      console.log(`[ScheduleTabFillService] Checking for existing records to delete...`);
      
      const existingRecords = await getExistingRecordsWithStatus(
        firstDay,
        lastDay,
        employeeId,
        currentUserId,
        managingGroupId
      );
      
      if (existingRecords.length > 0) {
        // Последняя проверка на обработанные записи (для подстраховки)
        const processingStatus = checkRecordsProcessingStatus(existingRecords);
        
        if (processingStatus.hasProcessedRecords) {
          const blockMessage = createProcessingBlockMessage(processingStatus);
          setOperationMessage(blockMessage);
          return;
        }
        
        // Помечаем все записи как удаленные
        const recordIds = existingRecords.map(record => record.id);
        const deleteSuccess = await markRecordsAsDeleted(recordIds);
        
        if (!deleteSuccess) {
          setOperationMessage({
            text: `Failed to mark ${recordIds.length} existing records as deleted. Fill operation cancelled.`,
            type: MessageBarType.error
          });
          return;
        }
        
        console.log(`[ScheduleTabFillService] Marked ${recordIds.length} existing records as deleted`);
        setOperationMessage({
          text: `Replaced ${recordIds.length} existing records. Creating new records from template...`,
          type: MessageBarType.info
        });
      } else {
        console.log(`[ScheduleTabFillService] No existing records found to delete`);
      }
    }
    
    // *** ОСНОВНАЯ ЛОГИКА ЗАПОЛНЕНИЯ ***
    
    // Подготавливаем кэши для оптимизации
    const holidayCache = createHolidayCache(holidays);
    const leavePeriods = createLeavePeriods(leaves);
    
    // Получаем шаблоны недельного расписания
    const weeklyTimeService = new WeeklyTimeTableService(context);
    const weeklyTimeItems = await weeklyTimeService.getWeeklyTimeTableByContractId(selectedContractId);
    
    // *** ДОБАВЛЕН DEBUG ЛОГ №1: RAW DATA FROM SERVICE ***
    console.log(`[DEBUG] *** RAW WEEKLY TIME ITEMS FROM SERVICE ***`);
    console.log(`[DEBUG] Total items received: ${weeklyTimeItems?.length || 0}`);
    if (weeklyTimeItems && weeklyTimeItems.length > 0) {
      console.log(`[DEBUG] First raw item structure:`, JSON.stringify(weeklyTimeItems[0], null, 2));
      
      // Проверяем поля времени в первом элементе
      const firstItem = weeklyTimeItems[0];
      const fields = firstItem.fields || firstItem;
      console.log(`[DEBUG] *** TIME FIELDS IN RAW DATA ***`);
      console.log(`[DEBUG] MondayStartWork: "${fields.MondeyStartWork || fields.MondayStartWork}"`);
      console.log(`[DEBUG] MondayEndWork: "${fields.MondayEndWork}"`);
      console.log(`[DEBUG] TuesdayStartWork: "${fields.TuesdayStartWork}"`);
      console.log(`[DEBUG] TuesdayEndWork: "${fields.TuesdayEndWork}"`);
    }
    
    if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
      setOperationMessage({
        text: 'No weekly templates found for the selected contract',
        type: MessageBarType.warning
      });
      return;
    }
    
    // *** ИСПРАВЛЕНИЕ: Фильтруем удаленные записи ПЕРЕД форматированием ***
    const activeWeeklyTimeItems = weeklyTimeItems.filter(item => {
      const isDeleted = 
        item.fields?.Deleted === 1 || 
        item.Deleted === 1 ||
        item.fields?.deleted === 1 ||
        item.deleted === 1;
      
      return !isDeleted;
    });
    
    if (activeWeeklyTimeItems.length === 0) {
      setOperationMessage({
        text: 'No active weekly templates found for the selected contract (all templates are deleted)',
        type: MessageBarType.warning
      });
      return;
    }
    
    // Форматируем и фильтруем шаблоны
    const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(activeWeeklyTimeItems, dayOfStartWeek);
    
    // *** ДОБАВЛЕН DEBUG ЛОГ №2: FORMATTED TEMPLATES ***
    console.log(`[DEBUG] *** FORMATTED TEMPLATES FROM WeeklyTimeTableUtils ***`);
    console.log(`[DEBUG] Total formatted templates: ${formattedTemplates?.length || 0}`);
    if (formattedTemplates && formattedTemplates.length > 0) {
      console.log(`[DEBUG] First formatted template:`, JSON.stringify(formattedTemplates[0], null, 2));
      
      // Проверяем структуру времени в отформатированном шаблоне
      const firstTemplate = formattedTemplates[0];
      console.log(`[DEBUG] *** TIME STRUCTURE IN FORMATTED TEMPLATE ***`);
      console.log(`[DEBUG] Monday start:`, firstTemplate.monday.start);
      console.log(`[DEBUG] Monday end:`, firstTemplate.monday.end);
      console.log(`[DEBUG] Tuesday start:`, firstTemplate.tuesday.start);
      console.log(`[DEBUG] Tuesday end:`, firstTemplate.tuesday.end);
    }
    
    if (!formattedTemplates || formattedTemplates.length === 0) {
      setOperationMessage({
        text: 'Error formatting weekly templates',
        type: MessageBarType.error
      });
      return;
    }
    
    // Дополнительная фильтрация удаленных шаблонов после форматирования
    const activeTemplates = formattedTemplates.filter(template => 
      template.deleted !== 1 && template.Deleted !== 1
    );
    
    if (activeTemplates.length === 0) {
      setOperationMessage({
        text: 'No active weekly templates found for the selected contract after formatting',
        type: MessageBarType.warning
      });
      return;
    }
    
    // Группируем шаблоны и подготавливаем данные дней
    const templatesByWeekAndDay = groupTemplatesByWeekAndDay(activeTemplates, dayOfStartWeek);
    const distinctWeeks = new Set(activeTemplates.map(template => template.NumberOfWeek || template.numberOfWeek || 1));
    const numberOfWeekTemplates = distinctWeeks.size || 1;
    
    // *** ИСПРАВЛЕНИЕ: Передаем UTC границы в prepareDaysData ***
    const daysData = prepareDaysData(
      firstDay, 
      lastDay, 
      holidayCache, 
      leavePeriods, 
      templatesByWeekAndDay, 
      numberOfWeekTemplates
    );
    
    // Генерируем записи расписания
    const remoteSiteService = RemoteSiteService.getInstance(context);
    const generatedRecords = await generateScheduleRecords(daysData, selectedContract, selectedContractId, remoteSiteService);
    
    if (generatedRecords.length === 0) {
      setOperationMessage({
        text: 'No records generated. Please check the contract and weekly templates.',
        type: MessageBarType.warning
      });
      return;
    }
    
    // Сохраняем сгенерированные записи
    await saveGeneratedRecords(
      generatedRecords, 
      createStaffRecord, 
      currentUserId, 
      managingGroupId, 
      employeeId,
      setOperationMessage
    );
    
    // Обновляем данные в UI
    if (onRefreshData) {
      onRefreshData();
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    setOperationMessage({
      text: `Error filling schedule: ${errorMessage}`,
      type: MessageBarType.error
    });
  } finally {
    setIsSaving(false);
  }
};

/**
 * Проверяет существующие записи и возвращает статус их обработки
 */
export const checkExistingRecordsStatus = async (
  params: IFillOperationParams,
  getExistingRecordsWithStatus: (startDate: Date, endDate: Date, employeeId: string, currentUserId?: string, staffGroupId?: string) => Promise<IExistingRecordCheck[]>
): Promise<IRecordsProcessingStatus | undefined> => {
  const { selectedDate, employeeId, selectedContract, currentUserId, managingGroupId } = params;
  
  if (!selectedContract || !employeeId) {
    return undefined;
  }
  
  try {
    // *** ИСПРАВЛЕНИЕ: Используем UTC методы для границ месяца ***
    const startOfMonth = new Date(Date.UTC(
      selectedDate.getUTCFullYear(), 
      selectedDate.getUTCMonth(), 
      1, 
      0, 0, 0, 0
    ));
    
    const endOfMonth = new Date(Date.UTC(
      selectedDate.getUTCFullYear(), 
      selectedDate.getUTCMonth() + 1, 
      0, 
      23, 59, 59, 999
    ));
    
    const contractStartDate = selectedContract.startDate;
    const contractFinishDate = selectedContract.finishDate;
    
    // *** ИСПРАВЛЕНИЕ: Нормализуем даты контракта к UTC ***
    let firstDay: Date;
    if (contractStartDate && contractStartDate > startOfMonth) {
      firstDay = new Date(Date.UTC(
        contractStartDate.getUTCFullYear(),
        contractStartDate.getUTCMonth(),
        contractStartDate.getUTCDate(),
        0, 0, 0, 0
      ));
    } else {
      firstDay = startOfMonth;
    }

    let lastDay: Date;
    if (contractFinishDate && contractFinishDate < endOfMonth) {
      lastDay = new Date(Date.UTC(
        contractFinishDate.getUTCFullYear(),
        contractFinishDate.getUTCMonth(),
        contractFinishDate.getUTCDate(),
        23, 59, 59, 999
      ));
    } else {
      lastDay = endOfMonth;
    }
    
    const existingRecords = await getExistingRecordsWithStatus(
      firstDay,
      lastDay,
      employeeId,
      currentUserId,
      managingGroupId
    );
    
    if (existingRecords.length === 0) {
      return {
        hasProcessedRecords: false,
        processedCount: 0,
        totalCount: 0,
        processedRecords: [],
        unprocessedRecords: []
      };
    }
    
    return checkRecordsProcessingStatus(existingRecords);
    
  } catch (error) {
    return undefined;
  }
};

/**
 * Генерирует записи расписания на основе подготовленных данных
 */
async function generateScheduleRecords(
  daysData: Map<string, IDayData>,
  selectedContract: IContract,
  selectedContractId: string,
  remoteSiteService: RemoteSiteService  // ← ДОБАВЛЕН ПАРАМЕТР
): Promise<Partial<IStaffRecord>[]> {
  const generatedRecords: Partial<IStaffRecord>[] = [];
  
  // Используем for...of для поддержки async/await
  for (const dayData of Array.from(daysData.values())) {
    if (dayData.templates.length > 0) {
      // Логи только для 1 октября
      if (dayData.date.getUTCDate() === 1 && dayData.date.getUTCMonth() === 9 && dayData.date.getUTCFullYear() === 2024) {
        console.log(`[ScheduleTabFillService] *** OCTOBER 1st RECORD GENERATION ***`);
        console.log(`[ScheduleTabFillService] Day ${dayData.date.toLocaleDateString()}: found ${dayData.templates.length} templates`);
        console.log(`[ScheduleTabFillService] Day data:`, {
          date: dayData.date.toISOString(),
          dayOfWeek: dayData.dayOfWeek,
          weekNumber: dayData.weekNumber,
          appliedWeekNumber: dayData.appliedWeekNumber,
          isHoliday: dayData.isHoliday,
          isLeave: dayData.isLeave
        });
      }
      
      // Обрабатываем каждый шаблон асинхронно
      for (let templateIndex = 0; templateIndex < dayData.templates.length; templateIndex++) {
        const template = dayData.templates[templateIndex];
        if (!template.start || !template.end) {
          if (dayData.date.getUTCDate() === 1 && dayData.date.getUTCMonth() === 9 && dayData.date.getUTCFullYear() === 2024) {
            console.log(`[ScheduleTabFillService] Oct 1st: Skipping template ${templateIndex} - missing start/end time`);
          }
          continue;
        }
        
        // *** ИСПРАВЛЕНИЕ: Используем await для асинхронного создания времени ***
        console.log(`[DEBUG] *** PROCESSING TEMPLATE TIME FOR ${dayData.date.toLocaleDateString()} ***`);
        console.log(`[DEBUG] Template ${templateIndex} start time object:`, template.start);
        console.log(`[DEBUG] Template ${templateIndex} end time object:`, template.end);
        console.log(`[DEBUG] Base date for shift creation: ${dayData.date.toISOString()}`);
        
        // ИСПРАВЛЕНО: Правильный порядок параметров и await
        const shiftDate1 = await createDateWithTime(dayData.date, remoteSiteService, template.start);
        const shiftDate2 = await createDateWithTime(dayData.date, remoteSiteService, template.end);
        
        console.log(`[DEBUG] *** CREATED SHIFT TIMES ***`);
        console.log(`[DEBUG] ShiftDate1 (start): ${shiftDate1.toISOString()}`);
        console.log(`[DEBUG] ShiftDate2 (end): ${shiftDate2.toISOString()}`);
        console.log(`[DEBUG] Local time representation - Start: ${shiftDate1.toLocaleString()}`);
        console.log(`[DEBUG] Local time representation - End: ${shiftDate2.toLocaleString()}`);
        
        const recordData: Partial<IStaffRecord> = {
          Title: `Template=${selectedContractId} Week=${dayData.appliedWeekNumber} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
          Date: dayData.date,
          ShiftDate1: shiftDate1,  // ← Теперь это Date, не Promise<Date>
          ShiftDate2: shiftDate2,  // ← Теперь это Date, не Promise<Date>
          TimeForLunch: parseInt(template.lunch || '30', 10),
          Contract: parseInt(template.total || '1', 10),
          Holiday: dayData.isHoliday ? 1 : 0,
          WeeklyTimeTableID: selectedContractId,
          WeeklyTimeTableTitle: selectedContract.template || ''
        };
        
        // Если сотрудник в отпуске в этот день, добавляем тип отпуска
        if (dayData.isLeave && dayData.leaveInfo) {
          const typeOfLeave = dayData.leaveInfo.typeOfLeave;
          if (typeOfLeave && typeOfLeave !== '0' && Number(typeOfLeave) !== 0) {
            recordData.TypeOfLeaveID = String(typeOfLeave);
          }
        }
        
        // Детальные логи только для 1 октября
        if (dayData.date.getUTCDate() === 1 && dayData.date.getUTCMonth() === 9 && dayData.date.getUTCFullYear() === 2024) {
          console.log(`[ScheduleTabFillService] *** OCTOBER 1st TEMPLATE ${templateIndex + 1} ***`);
          console.log(`[ScheduleTabFillService] Template start time: ${template.start?.hours}:${template.start?.minutes}`);
          console.log(`[ScheduleTabFillService] Template end time: ${template.end?.hours}:${template.end?.minutes}`);
          console.log(`[ScheduleTabFillService] Template week: ${template.NumberOfWeek}, shift: ${template.NumberOfShift}`);
          console.log(`[ScheduleTabFillService] Generated ShiftDate1: ${shiftDate1.toISOString()}`);
          console.log(`[ScheduleTabFillService] Generated ShiftDate2: ${shiftDate2.toISOString()}`);
          console.log(`[ScheduleTabFillService] Record Date: ${recordData.Date?.toISOString()}`);
          console.log(`[ScheduleTabFillService] Holiday: ${recordData.Holiday}, Leave Type: ${recordData.TypeOfLeaveID || 'None'}`);
        }
        
        generatedRecords.push(recordData);
      }
    }
  }
  
  return generatedRecords;
}

/**
 * Сохраняет сгенерированные записи
 */
async function saveGeneratedRecords(
  records: Partial<IStaffRecord>[],
  createStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>,
  currentUserId?: string,
  managingGroupId?: string,
  employeeId?: string,
  setOperationMessage?: (message: { text: string; type: MessageBarType } | undefined) => void
): Promise<void> {
  
  let successCount = 0;
  const failedRecords: string[] = [];
  
  // Сохраняем записи последовательно для лучшего контроля
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    try {
      // *** ЛОГИ ТОЛЬКО ДЛЯ 1 ОКТЯБРЯ ***
      if (record.Date && record.Date.getUTCDate() === 1 && record.Date.getUTCMonth() === 9 && record.Date.getUTCFullYear() === 2024) {
        console.log(`[ScheduleTabFillService] *** CREATING OCTOBER 1st RECORD ${i + 1}/${records.length} ***`);
        console.log(`[ScheduleTabFillService] Record data for Oct 1st:`, {
          Title: record.Title,
          Date: record.Date?.toISOString(),
          ShiftDate1: record.ShiftDate1?.toISOString(),
          ShiftDate2: record.ShiftDate2?.toISOString(),
          TimeForLunch: record.TimeForLunch,
          TypeOfLeaveID: record.TypeOfLeaveID || 'not set',
          Holiday: record.Holiday,
          Contract: record.Contract
        });
      }
      
      const newRecordId = await createStaffRecord(
        record,
        currentUserId,    // Manager ID
        managingGroupId,  // Staff Group ID
        employeeId        // Employee ID
      );
      
      if (newRecordId) {
        successCount++;
        if (record.Date && record.Date.getUTCDate() === 1 && record.Date.getUTCMonth() === 9 && record.Date.getUTCFullYear() === 2024) {
          console.log(`[ScheduleTabFillService] *** OCTOBER 1st RECORD CREATED SUCCESSFULLY: ID=${newRecordId} ***`);
        }
      } else {
        failedRecords.push(record.Title || 'Unknown');
      }
    } catch (error) {
      failedRecords.push(record.Title || 'Unknown');
    }
    
    // Небольшая пауза между созданиями записей
    if (i < records.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Показываем результат
  if (setOperationMessage) {
    if (successCount === records.length) {
      setOperationMessage({
        text: `Successfully generated ${successCount} schedule records from template`,
        type: MessageBarType.success
      });
    } else if (successCount > 0) {
      setOperationMessage({
        text: `Generated ${successCount} of ${records.length} records. Failed: ${failedRecords.length}`,
        type: MessageBarType.warning
      });
    } else {
      setOperationMessage({
        text: `Failed to generate any records. Please try again.`,
        type: MessageBarType.error
      });
    }
  }
}