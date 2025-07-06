// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabActionHandlers.ts
import { MessageBarType } from '@fluentui/react';
import { IScheduleItem, INewShiftData } from '../components/ScheduleTable';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
* Интерфейс с общими параметрами для обработчиков действий
*/
export interface IActionHandlerParams {
 setIsSaving: (isSaving: boolean) => void;
 setOperationMessage: (message: { text: string; type: MessageBarType; } | undefined) => void;
 setModifiedRecords: React.Dispatch<React.SetStateAction<Record<string, IScheduleItem>>>;
 onRefreshData?: () => void;
}

/**
* *** ИСПРАВЛЕННАЯ ФУНКЦИЯ formatDateForSharePoint ***
* Создает UTC полночь для Date-only полей SharePoint
* Предотвращает проблемы с timezone и DST
*/
const formatDateForSharePoint = (date: Date): Date => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  console.log(`[ScheduleTabActionHandlers] *** FORMATTING DATE FOR SHAREPOINT (UTC) ***`);
  console.log(`[ScheduleTabActionHandlers] Input date: ${date.toISOString()}`);
  console.log(`[ScheduleTabActionHandlers] Extracted components: ${year}-${month + 1}-${day}`);
  
  // Создаем UTC полночь чтобы предотвратить timezone конверсию SharePoint
  const utcDate = new Date(`${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00.000Z`);
  
  console.log(`[ScheduleTabActionHandlers] Created UTC date: ${utcDate.toISOString()}`);
  console.log(`[ScheduleTabActionHandlers] UTC components: ${utcDate.getUTCFullYear()}-${utcDate.getUTCMonth() + 1}-${utcDate.getUTCDate()}`);
  
  return utcDate;
};

/**
* *** ОБНОВЛЕННАЯ ФУНКЦИЯ formatItemForUpdate С UTC DATE-ONLY ***
* Приоритет числовых полей при формировании данных для обновления
* ИСПРАВЛЕНО: Использует UTC полночь для Date-only поля
*/
export const formatItemForUpdate = (recordId: string, scheduleItem: IScheduleItem): Partial<IStaffRecord> => {
 console.log(`[ScheduleTabActionHandlers] *** formatItemForUpdate WITH UTC DATE-ONLY FIELD ***`);
 console.log(`[ScheduleTabActionHandlers] formatItemForUpdate for record ID: ${recordId}`);
 console.log(`[ScheduleTabActionHandlers] Input schedule item date: ${scheduleItem.date.toISOString()}`);
 console.log(`[ScheduleTabActionHandlers] *** IMPORTANT: Using UTC midnight for Date-only field ***`);

 // *** ИСПРАВЛЕНО: Создаем UTC полночь для Date-only поля ***
 const utcMidnightDate = formatDateForSharePoint(scheduleItem.date);

 console.log(`[ScheduleTabActionHandlers] Created UTC midnight date for Date-only field: ${utcMidnightDate.toISOString()}`);

 // *** ПРИОРИТЕТ ЧИСЛОВЫХ ПОЛЕЙ ДЛЯ ВРЕМЕНИ ***
 let startHour: number, startMinute: number, finishHour: number, finishMinute: number;

 // Проверяем наличие числовых полей (ПРИОРИТЕТ)
 if (typeof scheduleItem.startHours === 'number' && typeof scheduleItem.startMinutes === 'number' &&
     typeof scheduleItem.finishHours === 'number' && typeof scheduleItem.finishMinutes === 'number') {
   
   console.log(`[ScheduleTabActionHandlers] *** USING NUMERIC FIELDS (PRIORITY) ***`);
   startHour = scheduleItem.startHours;
   startMinute = scheduleItem.startMinutes;
   finishHour = scheduleItem.finishHours;
   finishMinute = scheduleItem.finishMinutes;
   
   console.log(`[ScheduleTabActionHandlers] Numeric time values: ${startHour}:${startMinute} - ${finishHour}:${finishMinute}`);
 } else {
   // Fallback к строковым полям
   console.log(`[ScheduleTabActionHandlers] *** FALLBACK TO STRING FIELDS ***`);
   startHour = parseInt(scheduleItem.startHour, 10) || 0;
   startMinute = parseInt(scheduleItem.startMinute, 10) || 0;
   finishHour = parseInt(scheduleItem.finishHour, 10) || 0;
   finishMinute = parseInt(scheduleItem.finishMinute, 10) || 0;
   
   console.log(`[ScheduleTabActionHandlers] Parsed string time values: ${startHour}:${startMinute} - ${finishHour}:${finishMinute}`);
 }

 const updateData: Partial<IStaffRecord> = {
   // *** ИСПРАВЛЕНО: Используем UTC полночь для Date-only поля ***
   Date: utcMidnightDate,
   
   // *** ТОЛЬКО ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
   ShiftDate1Hours: startHour,
   ShiftDate1Minutes: startMinute,
   ShiftDate2Hours: finishHour,
   ShiftDate2Minutes: finishMinute,
   
   // Numeric values
   TimeForLunch: parseInt(scheduleItem.lunchTime, 10) || 0,
   Contract: parseInt(scheduleItem.contractNumber || '1', 10),
   
   // TypeOfLeave could be a string ID or empty
   TypeOfLeaveID: scheduleItem.typeOfLeave || '',
   
   // Work time as calculated
   WorkTime: scheduleItem.workingHours
 };

 console.log(`[ScheduleTabActionHandlers] *** FINAL UPDATE DATA - UTC DATE-ONLY + NUMERIC FIELDS ONLY ***`);
 console.log(`[ScheduleTabActionHandlers] Numeric fields:`, {
   ShiftDate1Hours: updateData.ShiftDate1Hours,
   ShiftDate1Minutes: updateData.ShiftDate1Minutes,
   ShiftDate2Hours: updateData.ShiftDate2Hours,
   ShiftDate2Minutes: updateData.ShiftDate2Minutes
 });
 console.log(`[ScheduleTabActionHandlers] UTC Date-only field:`, {
   Date: updateData.Date?.toISOString(),
   DateUTCComponents: updateData.Date ? `${updateData.Date.getUTCFullYear()}-${updateData.Date.getUTCMonth() + 1}-${updateData.Date.getUTCDate()}` : 'undefined'
 });
 console.log(`[ScheduleTabActionHandlers] Other fields:`, {
   TimeForLunch: updateData.TimeForLunch,
   Contract: updateData.Contract,
   TypeOfLeaveID: updateData.TypeOfLeaveID,
   WorkTime: updateData.WorkTime
 });

 return updateData;
};

/**
* Обработчик для сохранения всех изменений в расписании
*/
export const handleSaveAllChanges = async (
 modifiedRecords: Record<string, IScheduleItem>,
 onUpdateStaffRecord: (recordId: string, updateData: Partial<IStaffRecord>) => Promise<boolean>,
 params: IActionHandlerParams
): Promise<void> => {
 const { setIsSaving, setOperationMessage, setModifiedRecords, onRefreshData } = params;

 if (!onUpdateStaffRecord) {
   console.error('Update staff record function is not provided');
   setOperationMessage({
     text: 'Unable to save changes: Update function not available',
     type: MessageBarType.error
   });
   return;
 }
 
 setIsSaving(true);
 
 try {
   const modifiedIds = Object.keys(modifiedRecords);
   
   if (modifiedIds.length === 0) {
     setOperationMessage({
       text: 'No changes to save',
       type: MessageBarType.info
     });
     setIsSaving(false);
     return;
   }
   
   console.log(`[ScheduleTabActionHandlers] *** SAVING ${modifiedIds.length} MODIFIED RECORDS WITH UTC DATE-ONLY + NUMERIC FIELDS ***`);
   
   let successCount = 0;
   const failedRecords: string[] = [];
   
   // Process records in batches to avoid overloading the server
   const batchSize = 5; // Process 5 records at a time
   for (let i = 0; i < modifiedIds.length; i += batchSize) {
     const currentBatch = modifiedIds.slice(i, i + batchSize);
     
     // Create an array of promises for the current batch
     const batchPromises = currentBatch.map(async (recordId) => {
       const scheduleItem = modifiedRecords[recordId];
       
       console.log(`[ScheduleTabActionHandlers] *** PROCESSING RECORD ${recordId} ***`);
       console.log(`[ScheduleTabActionHandlers] Schedule Item:`, {
         startHour: scheduleItem.startHour,
         startMinute: scheduleItem.startMinute,
         finishHour: scheduleItem.finishHour,
         finishMinute: scheduleItem.finishMinute,
         startHours: scheduleItem.startHours,
         startMinutes: scheduleItem.startMinutes,
         finishHours: scheduleItem.finishHours,
         finishMinutes: scheduleItem.finishMinutes,
         workingHours: scheduleItem.workingHours,
         date: scheduleItem.date.toISOString()
       });
       
       // *** ИСПОЛЬЗУЕМ ОБНОВЛЕННУЮ formatItemForUpdate С UTC DATE-ONLY ***
       const updateData = formatItemForUpdate(recordId, scheduleItem);
       
       console.log(`[ScheduleTabActionHandlers] *** FORMATTED UPDATE DATA FOR ${recordId} ***`);
       
       try {
         const success = await onUpdateStaffRecord(recordId, updateData);
         
         if (success) {
           successCount++;
           console.log(`[ScheduleTabActionHandlers] ✓ Successfully updated record ${recordId} with UTC date-only + numeric fields`);
           return { recordId, success: true };
         } else {
           failedRecords.push(recordId);
           return { recordId, success: false, error: 'Update returned false' };
         }
       } catch (error) {
         console.error(`[ScheduleTabActionHandlers] ✗ Error saving record ${recordId}:`, error);
         failedRecords.push(recordId);
         return { recordId, success: false, error };
       }
     });
     
     // Wait for all promises in this batch to complete before moving to the next batch
     const batchResults = await Promise.all(batchPromises);
     console.log(`[ScheduleTabActionHandlers] Batch results:`, batchResults);
     
     // Add a small delay between batches to not overwhelm the server
     if (i + batchSize < modifiedIds.length) {
       await new Promise(resolve => setTimeout(resolve, 500));
     }
   }
   
   // Show appropriate message based on results
   if (successCount === modifiedIds.length) {
     setOperationMessage({
       text: `All ${successCount} changes saved successfully with UTC date-only + numeric time fields`,
       type: MessageBarType.success
     });
     // Clear all modified records since they've been saved
     setModifiedRecords({});
   } else if (successCount > 0) {
     setOperationMessage({
       text: `Saved ${successCount} of ${modifiedIds.length} changes. Failed to save ${failedRecords.length} records.`,
       type: MessageBarType.warning
     });
     // Clear only the successfully saved records
     const newModifiedRecords = { ...modifiedRecords };
     modifiedIds.forEach((id) => {
       if (!failedRecords.includes(id)) {
         delete newModifiedRecords[id];
       }
     });
     setModifiedRecords(newModifiedRecords);
   } else {
     setOperationMessage({
       text: `Failed to save any changes. Please try again.`,
       type: MessageBarType.error
     });
   }
   
   // If we have a parent refresh function, call it to refresh the data
   if (onRefreshData) {
     onRefreshData();
   }
 } catch (error) {
   console.error('[ScheduleTabActionHandlers] Error during save operation:', error);
   setOperationMessage({
     text: `Error saving changes: ${error instanceof Error ? error.message : String(error)}`,
     type: MessageBarType.error
   });
 } finally {
   setIsSaving(false);
 }
};

/**
* Обработчик для добавления новой смены в расписание
*/
export const handleAddShift = (
 date: Date, 
 shiftData: INewShiftData | undefined,
 onAddShift: (date: Date, shiftData?: INewShiftData) => void,
 params: IActionHandlerParams
): void => {
 const { setIsSaving, setOperationMessage } = params;
 
 if (!onAddShift) {
   console.error('Add shift function is not provided');
   setOperationMessage({
     text: 'Unable to add new shift: Function not available',
     type: MessageBarType.error
   });
   return;
 }
 
 console.log(`[ScheduleTabActionHandlers] Adding shift for date: ${date.toLocaleDateString()}`);
 
 setIsSaving(true);
 
 try {
   // Call the onAddShift function with the date and shift data
   onAddShift(date, shiftData);
   
   setOperationMessage({
     text: `New shift added for ${date.toLocaleDateString()}`,
     type: MessageBarType.success
   });
   
   // Clear the message after a delay
   setTimeout(() => {
     setOperationMessage(undefined);
   }, 3000);
 } catch (error) {
   console.error('Error adding new shift:', error);
   setOperationMessage({
     text: `Error adding new shift: ${error instanceof Error ? error.message : String(error)}`,
     type: MessageBarType.error
   });
 } finally {
   setIsSaving(false);
 }
};

/**
* Обработчик для удаления записи из расписания
*/
export const handleDeleteItem = async (
 id: string,
 modifiedRecords: Record<string, IScheduleItem>,
 onDeleteStaffRecord: (recordId: string) => Promise<boolean>,
 params: IActionHandlerParams
): Promise<void> => {
 const { setIsSaving, setOperationMessage, setModifiedRecords, onRefreshData } = params;
 
 if (!onDeleteStaffRecord) {
   console.error('Delete staff record function is not provided');
   setOperationMessage({
     text: 'Unable to delete record: Delete function not available',
     type: MessageBarType.error
   });
   return;
 }
 
 console.log(`Deleting item with ID: ${id}`);
 
 setIsSaving(true);
 
 try {
   const success = await onDeleteStaffRecord(id);
   
   if (success) {
     setOperationMessage({
       text: 'Record deleted successfully',
       type: MessageBarType.success
     });
     
     // Если запись была в списке модифицированных, удаляем её оттуда
     if (modifiedRecords[id]) {
       const newModifiedRecords = { ...modifiedRecords };
       delete newModifiedRecords[id];
       setModifiedRecords(newModifiedRecords);
     }
     
     // Обновляем данные
     if (onRefreshData) {
       onRefreshData();
     }
   } else {
     setOperationMessage({
       text: 'Failed to delete record. Please try again.',
       type: MessageBarType.error
     });
   }
 } catch (error) {
   console.error('Error deleting record:', error);
   setOperationMessage({
     text: `Error deleting record: ${error instanceof Error ? error.message : String(error)}`,
     type: MessageBarType.error
   });
 } finally {
   setIsSaving(false);
 }
};

/**
* Обработчик для восстановления удаленной записи в расписании
*/
export const handleRestoreItem = async (
 id: string,
 modifiedRecords: Record<string, IScheduleItem>,
 onRestoreStaffRecord: (recordId: string) => Promise<boolean>,
 params: IActionHandlerParams
): Promise<void> => {
 const { setIsSaving, setOperationMessage, setModifiedRecords, onRefreshData } = params;
 
 if (!onRestoreStaffRecord) {
   console.error('Restore staff record function is not provided');
   setOperationMessage({
     text: 'Unable to restore record: Restore function not available',
     type: MessageBarType.error
   });
   return;
 }
 
 console.log(`Restoring item with ID: ${id}`);
 
 setIsSaving(true);
 
 try {
   const success = await onRestoreStaffRecord(id);
   
   if (success) {
     setOperationMessage({
       text: 'Record restored successfully',
       type: MessageBarType.success
     });
     
     // Если запись была в списке модифицированных, удаляем её оттуда
     if (modifiedRecords[id]) {
       const newModifiedRecords = { ...modifiedRecords };
       delete newModifiedRecords[id];
       setModifiedRecords(newModifiedRecords);
     }
     
     // Обновляем данные
     if (onRefreshData) {
       onRefreshData();
     }
   } else {
     setOperationMessage({
       text: 'Failed to restore record. Please try again.',
       type: MessageBarType.error
     });
   }
 } catch (error) {
   console.error('Error restoring record:', error);
   setOperationMessage({
     text: `Error restoring record: ${error instanceof Error ? error.message : String(error)}`,
     type: MessageBarType.error
   });
 } finally {
   setIsSaving(false);
 }
};