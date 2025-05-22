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
    // Эта проверка выполняется для подстраховки, основная проверка должна быть в ScheduleTabContent
    if (getExistingRecordsWithStatus && markRecordsAsDeleted) {
      console.log('[ScheduleTabFillService] Final check and cleanup of existing records...');
      
      const existingRecords = await getExistingRecordsWithStatus(
        firstDay,
        lastDay,
        employeeId,
        currentUserId,
        managingGroupId
      );
      
      if (existingRecords.length > 0) {
        console.log(`[ScheduleTabFillService] Found ${existingRecords.length} existing records - marking as deleted`);
        
        // Последняя проверка на обработанные записи (для подстраховки)
        const processingStatus = checkRecordsProcessingStatus(existingRecords);
        
        if (processingStatus.hasProcessedRecords) {
          console.error(`[ScheduleTabFillService] CRITICAL: Found ${processingStatus.processedCount} processed records that should have been blocked earlier!`);
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
        
        console.log(`[ScheduleTabFillService] Successfully marked ${recordIds.length} records as deleted`);
        
        setOperationMessage({
          text: `Replaced ${recordIds.length} existing records. Creating new records from template...`,
          type: MessageBarType.info
        });
      } else {
        console.log('[ScheduleTabFillService] No existing records found - proceeding with normal fill');
      }
    } else {
      console.log('[ScheduleTabFillService] Existing records check handlers not available - proceeding with fill');
    }
    
    // *** ОСНОВНАЯ ЛОГИКА ЗАПОЛНЕНИЯ ***
    
    // Подготавливаем кэши для оптимизации
    const holidayCache = createHolidayCache(holidays);
    const leavePeriods = createLeavePeriods(leaves);
    
    // Получаем шаблоны недельного расписания
    console.log('[ScheduleTabFillService] Loading weekly schedule templates...');
    const weeklyTimeService = new WeeklyTimeTableService(context);
    const weeklyTimeItems = await weeklyTimeService.getWeeklyTimeTableByContractId(selectedContractId);
    
    if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
      setOperationMessage({
        text: 'No weekly templates found for the selected contract',
        type: MessageBarType.warning
      });
      return;
    }
    
    console.log(`[ScheduleTabFillService] Retrieved ${weeklyTimeItems.length} weekly time templates`);
    
    // Форматируем и фильтруем шаблоны
    const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeItems, dayOfStartWeek);
    
    if (!formattedTemplates || formattedTemplates.length === 0) {
      setOperationMessage({
        text: 'Error formatting weekly templates',
        type: MessageBarType.error
      });
      return;
    }
    
    console.log(`[ScheduleTabFillService] Formatted ${formattedTemplates.length} templates`);
    
    // Фильтруем удаленные шаблоны
    const activeTemplates = formattedTemplates.filter(template => 
      template.deleted !== 1 && template.Deleted !== 1
    );
    
    console.log(`[ScheduleTabFillService] Active templates: ${activeTemplates.length}`);
    
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
    
    console.log(`[ScheduleTabFillService] Number of week templates: ${numberOfWeekTemplates}`);
    
    const daysData = prepareDaysData(
      firstDay, 
      lastDay, 
      holidayCache, 
      leavePeriods, 
      templatesByWeekAndDay, 
      numberOfWeekTemplates
    );
    
    // Генерируем записи расписания
    console.log('[ScheduleTabFillService] Generating schedule records from templates...');
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
    
    console.log(`[ScheduleTabFillService] Generated ${generatedRecords.length} schedule records`);
    
    // Логируем детали ID перед созданием записей
    console.log(`[ScheduleTabFillService] Creating records with IDs:
      staffMemberId=${employeeId} (${typeof employeeId})
      currentUserId=${currentUserId || 'N/A'} (${typeof currentUserId})
      staffGroupId=${managingGroupId || 'N/A'} (${typeof managingGroupId})
    `);
    
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
      console.log('[ScheduleTabFillService] Refreshing UI data...');
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
 * Проверяет существующие записи и возвращает статус их обработки
 * Эта функция может быть вызвана отдельно для предварительной проверки
 */
export const checkExistingRecordsStatus = async (
  params: IFillOperationParams,
  getExistingRecordsWithStatus: (startDate: Date, endDate: Date, employeeId: string, currentUserId?: string, staffGroupId?: string) => Promise<IExistingRecordCheck[]>
): Promise<IRecordsProcessingStatus | null> => {
  const { selectedDate, employeeId, selectedContract, currentUserId, managingGroupId } = params;
  
  if (!selectedContract || !employeeId) {
    return null;
  }
  
  try {
    console.log('[ScheduleTabFillService] checkExistingRecordsStatus called');
    
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
    
    console.log(`[ScheduleTabFillService] Checking existing records for period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
    
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
    console.error('[ScheduleTabFillService] Error checking existing records:', error);
    return null;
  }
};

/**
 * Генерирует записи расписания на основе подготовленных данных
 */
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
        
        // Если сотрудник в отпуске в этот день, добавляем тип отпуска
        if (dayData.isLeave && dayData.leaveInfo) {
          const typeOfLeave = dayData.leaveInfo.typeOfLeave;
          if (typeOfLeave && typeOfLeave !== '0' && Number(typeOfLeave) !== 0) {
            recordData.TypeOfLeaveID = String(typeOfLeave);
            console.log(`[ScheduleTabFillService] Added leave type ${recordData.TypeOfLeaveID} for ${dayData.date.toLocaleDateString()}: ${dayData.leaveInfo.title}`);
          }
        }
        
        console.log(`[ScheduleTabFillService] Generated record for ${dayData.date.toLocaleDateString()}:
          - Start: ${recordData.ShiftDate1?.toLocaleTimeString() || 'N/A'}
          - End: ${recordData.ShiftDate2?.toLocaleTimeString() || 'N/A'}
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
  console.log(`[ScheduleTabFillService] Starting to save ${records.length} generated records...`);
  
  let successCount = 0;
  const failedRecords: string[] = [];
  
  // Сохраняем записи последовательно для лучшего контроля
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    
    try {
      console.log(`[ScheduleTabFillService] Creating record ${i + 1}/${records.length} for ${record.Date?.toLocaleDateString()}:
        - TypeOfLeaveID: ${record.TypeOfLeaveID || 'not set'} (type: ${typeof record.TypeOfLeaveID})
        - Holiday: ${record.Holiday}
        - Contract: ${record.Contract}
        - TimeForLunch: ${record.TimeForLunch}
      `);
      
      const newRecordId = await createStaffRecord(
        record,
        currentUserId,    // Manager ID
        managingGroupId,  // Staff Group ID
        employeeId        // Employee ID
      );
      
      if (newRecordId) {
        successCount++;
        if (record.TypeOfLeaveID) {
          console.log(`[ScheduleTabFillService] ✓ Created record ID=${newRecordId} for ${record.Date?.toLocaleDateString()} with leave type: ${record.TypeOfLeaveID}`);
        } else {
          console.log(`[ScheduleTabFillService] ✓ Created record ID=${newRecordId} for ${record.Date?.toLocaleDateString()} (no leave type)`);
        }
      } else {
        failedRecords.push(record.Title || 'Unknown');
        console.error(`[ScheduleTabFillService] ✗ Failed to create record for ${record.Date?.toLocaleDateString()}: ${record.Title}`);
      }
    } catch (error) {
      console.error(`[ScheduleTabFillService] ✗ Error creating record ${i + 1} for ${record.Date?.toLocaleDateString()}:`, error);
      failedRecords.push(record.Title || 'Unknown');
    }
    
    // Небольшая пауза между созданиями записей для предотвращения перегрузки
    if (i < records.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  // Показываем результат
  console.log(`[ScheduleTabFillService] Save operation completed: ${successCount}/${records.length} successful, ${failedRecords.length} failed`);
  
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
  
  if (failedRecords.length > 0) {
    console.error('[ScheduleTabFillService] Failed records:', failedRecords);
  }
}