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
    // Определяем период для заполнения
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    const contractStartDate = selectedContract.startDate;
    const contractFinishDate = selectedContract.finishDate;
    
    const firstDay = contractStartDate && contractStartDate > startOfMonth 
      ? new Date(contractStartDate) 
      : new Date(startOfMonth);
    
    const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
      ? new Date(contractFinishDate) 
      : new Date(endOfMonth);
    
    console.log(`[ScheduleTabFillService] Fill operation period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
    
    // *** УДАЛЯЕМ СУЩЕСТВУЮЩИЕ ЗАПИСИ ПЕРЕД СОЗДАНИЕМ НОВЫХ ***
    if (getExistingRecordsWithStatus && markRecordsAsDeleted) {
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
        
        setOperationMessage({
          text: `Replaced ${recordIds.length} existing records. Creating new records from template...`,
          type: MessageBarType.info
        });
      }
    }
    
    // *** ОСНОВНАЯ ЛОГИКА ЗАПОЛНЕНИЯ ***
    
    // Подготавливаем кэши для оптимизации
    const holidayCache = createHolidayCache(holidays);
    const leavePeriods = createLeavePeriods(leaves);
    
    // Получаем шаблоны недельного расписания
    const weeklyTimeService = new WeeklyTimeTableService(context);
    const weeklyTimeItems = await weeklyTimeService.getWeeklyTimeTableByContractId(selectedContractId);
    
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
    
    const daysData = prepareDaysData(
      firstDay, 
      lastDay, 
      holidayCache, 
      leavePeriods, 
      templatesByWeekAndDay, 
      numberOfWeekTemplates
    );
    
    // Генерируем записи расписания
    const generatedRecords = generateScheduleRecords(
      daysData, 
      selectedContract, 
      selectedContractId
    );
    
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
    // Определяем период для проверки
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    const contractStartDate = selectedContract.startDate;
    const contractFinishDate = selectedContract.finishDate;
    
    const firstDay = contractStartDate && contractStartDate > startOfMonth 
      ? new Date(contractStartDate) 
      : new Date(startOfMonth);
    
    const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
      ? new Date(contractFinishDate) 
      : new Date(endOfMonth);
    
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
// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillService.ts
// Фрагмент функции generateScheduleRecords - ИСПРАВЛЕННАЯ ВЕРСИЯ

// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillService.ts
// ПРАВИЛЬНОЕ исправление функции generateScheduleRecords

function generateScheduleRecords(
  daysData: Map<string, IDayData>,
  selectedContract: IContract,
  selectedContractId: string
): Partial<IStaffRecord>[] {
  const generatedRecords: Partial<IStaffRecord>[] = [];
  
  console.log(`[ScheduleTabFillService] Generating records for ${daysData.size} days`);
  
  daysData.forEach((dayData, dateKey) => {
    if (dayData.templates.length > 0) {
      console.log(`[ScheduleTabFillService] Day ${dayData.date.toLocaleDateString()}: found ${dayData.templates.length} templates`);
      
      dayData.templates.forEach((template, templateIndex) => {
        if (!template.start || !template.end) {
          console.log(`[ScheduleTabFillService] Skipping template ${templateIndex} for ${dayData.date.toLocaleDateString()}: missing start/end time`);
          return;
        }
        
        // *** ИСПРАВЛЕНИЕ: Создаем дату с местной полуночью ***
        // Для поля Date нужна дата с полуночью по местному времени
        const localMidnightDate = new Date(
          dayData.date.getFullYear(),
          dayData.date.getMonth(), 
          dayData.date.getDate(),
          0, 0, 0, 0 // Местная полночь
        );
        
        console.log(`[ScheduleTabFillService] *** CORRECT DATE FIELD CREATION ***`);
        console.log(`[ScheduleTabFillService] Original dayData.date: ${dayData.date.toISOString()}`);
        console.log(`[ScheduleTabFillService] Local midnight date for Date field: ${localMidnightDate.toISOString()}`);
        console.log(`[ScheduleTabFillService] Local time representation: ${localMidnightDate.toLocaleString()}`);
        
        // Для времен смен используем UTC (как и раньше)
        const shiftDate1 = createDateWithTime(dayData.date, template.start);
        const shiftDate2 = createDateWithTime(dayData.date, template.end);
        
        console.log(`[ScheduleTabFillService] *** COMPARING DATE FORMATS ***`);
        console.log(`[ScheduleTabFillService] Date field (local midnight): ${localMidnightDate.toISOString()}`);
        console.log(`[ScheduleTabFillService] ShiftDate1 (UTC time): ${shiftDate1.toISOString()}`);
        console.log(`[ScheduleTabFillService] ShiftDate2 (UTC time): ${shiftDate2.toISOString()}`);
        
        // Проверяем что даты относятся к одному календарному дню
        const dateFieldDay = localMidnightDate.getDate();
        const dateFieldMonth = localMidnightDate.getMonth();
        const dateFieldYear = localMidnightDate.getFullYear();
        
        const shift1Day = shiftDate1.getUTCDate();
        const shift1Month = shiftDate1.getUTCMonth();
        const shift1Year = shiftDate1.getUTCFullYear();
        
        console.log(`[ScheduleTabFillService] *** DATE CONSISTENCY CHECK ***`);
        console.log(`[ScheduleTabFillService] Date field: ${dateFieldYear}-${dateFieldMonth + 1}-${dateFieldDay}`);
        console.log(`[ScheduleTabFillService] Shift1 UTC: ${shift1Year}-${shift1Month + 1}-${shift1Day}`);
        
        const recordData: Partial<IStaffRecord> = {
          Title: `Template=${selectedContractId} Week=${dayData.appliedWeekNumber} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
          // *** ИСПРАВЛЕНИЕ: Используем местную полночь для поля Date ***
          Date: localMidnightDate, // ✅ ПРАВИЛЬНО - местная полночь
          ShiftDate1: shiftDate1,  // UTC время
          ShiftDate2: shiftDate2,  // UTC время
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
            console.log(`[ScheduleTabFillService] Added leave type ${recordData.TypeOfLeaveID} for ${localMidnightDate.toLocaleDateString()}: ${dayData.leaveInfo.title}`);
          }
        }
        
        // Специальное логирование для октября 2024
        if (localMidnightDate.getMonth() === 9 && localMidnightDate.getFullYear() === 2024 && localMidnightDate.getDate() === 1) {
          console.log(`[ScheduleTabFillService] *** OCTOBER 1st 2024 RECORD CREATION ***`);
          console.log(`[ScheduleTabFillService] Record data for Oct 1st:`, {
            Title: recordData.Title,
            Date: recordData.Date?.toISOString(),
            'Date (local)': recordData.Date?.toLocaleString(),
            ShiftDate1: recordData.ShiftDate1?.toISOString(),
            ShiftDate2: recordData.ShiftDate2?.toISOString(),
            localDateDay: localMidnightDate.getDate(),
            localDateMonth: localMidnightDate.getMonth() + 1,
            shift1UTCDay: shiftDate1.getUTCDate(),
            shift1UTCMonth: shiftDate1.getUTCMonth() + 1
          });
        }
        
       console.log(`[ScheduleTabFillService] Generated record for ${dayData.date.toLocaleDateString()}:
  - Start: ${recordData.ShiftDate1?.toLocaleTimeString() || 'N/A'} (UTC: ${recordData.ShiftDate1?.toISOString() || 'N/A'})
  - End: ${recordData.ShiftDate2?.toLocaleTimeString() || 'N/A'} (UTC: ${recordData.ShiftDate2?.toISOString() || 'N/A'})
  - Lunch: ${recordData.TimeForLunch} min
  - Holiday: ${recordData.Holiday === 1 ? 'Yes' : 'No'}
  - Leave Type: ${recordData.TypeOfLeaveID || 'None'}
`);
        
        generatedRecords.push(recordData);
      });
    }
  });
  
  console.log(`[ScheduleTabFillService] Total generated records: ${generatedRecords.length}`);
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