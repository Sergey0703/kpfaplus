// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillService.ts

import { MessageBarType } from '@fluentui/react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';
import { WeeklyTimeTableUtils } from '../../../../models/IWeeklyTimeTable';
import { IContract } from '../../../../models/IContract';
import { 
  IFillOperationParams, 
  IFillOperationHandlers,
  IDayData
} from './ScheduleTabFillInterfaces';
import {
  createHolidayCache,
  createLeavePeriods,
  groupTemplatesByWeekAndDay,
  prepareDaysData,
  createDateWithTime
} from './ScheduleTabFillHelpers';

/**
 * Main function for filling schedule based on templates
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
    
    console.log(`[ScheduleTabFillService] Period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
    
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
    
    // Форматируем и фильтруем шаблоны
    const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeItems, dayOfStartWeek);
    const activeTemplates = formattedTemplates.filter(template => 
      template.deleted !== 1 && template.Deleted !== 1
    );
    
    if (activeTemplates.length === 0) {
      setOperationMessage({
        text: 'No active weekly templates found for the selected contract',
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
    
    if (onRefreshData) {
      onRefreshData();
    }
    
  } catch (error) {
    console.error('[ScheduleTabFillService] Error during fill operation:', error);
    setOperationMessage({
      text: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
      type: MessageBarType.error
    });
  } finally {
    setIsSaving(false);
  }
};

/**
 * Генерирует записи расписания на основе подготовленных данных
 */
function generateScheduleRecords(
  daysData: Map<string, IDayData>,
  selectedContract: IContract,  // ИСПРАВЛЕНО: заменил any на IContract
  selectedContractId: string
): Partial<IStaffRecord>[] {
  const generatedRecords: Partial<IStaffRecord>[] = [];
  
  daysData.forEach((dayData) => {
    if (dayData.templates.length > 0) {
      dayData.templates.forEach(template => {
        if (!template.start || !template.end) {
          return;
        }
        
        const shiftDate1 = createDateWithTime(dayData.date, template.start);
        const shiftDate2 = createDateWithTime(dayData.date, template.end);
        
        const recordData: Partial<IStaffRecord> = {
          Title: `Template=${selectedContractId} Week=${dayData.appliedWeekNumber} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
          Date: new Date(dayData.date),
          ShiftDate1: shiftDate1,
          ShiftDate2: shiftDate2,
          TimeForLunch: parseInt(template.lunch || '30', 10),
          Contract: parseInt(template.total || '1', 10),
          Holiday: dayData.isHoliday ? 1 : 0,
          WeeklyTimeTableID: selectedContractId,
          WeeklyTimeTableTitle: selectedContract.template || ''
        };
        
        if (dayData.isLeave && dayData.leaveInfo) {
          const typeOfLeave = dayData.leaveInfo.typeOfLeave;
          if (typeOfLeave && typeOfLeave !== '0' && Number(typeOfLeave) !== 0) {
            recordData.TypeOfLeaveID = String(typeOfLeave);
          }
        }
        
        generatedRecords.push(recordData);
      });
    }
  });
  
  console.log(`[ScheduleTabFillService] Generated ${generatedRecords.length} records`);
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
  
  for (const record of records) {
    try {
      const newRecordId = await createStaffRecord(
        record,
        currentUserId,
        managingGroupId,
        employeeId
      );
      
      if (newRecordId) {
        successCount++;
      } else {
        failedRecords.push(record.Title || 'Unknown');
      }
    } catch (error) {
      console.error(`[ScheduleTabFillService] Error creating record:`, error);
      failedRecords.push(record.Title || 'Unknown');
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