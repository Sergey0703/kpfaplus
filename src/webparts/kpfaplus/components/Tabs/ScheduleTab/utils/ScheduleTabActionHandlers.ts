// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabActionHandlers.ts
import { MessageBarType } from '@fluentui/react';
import { IScheduleItem, INewShiftData } from '../components/ScheduleTable';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { formatItemForUpdate } from './ScheduleTabDataUtils';

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
    
    console.log(`Saving ${modifiedIds.length} modified records...`);
    
    let successCount = 0;
    const failedRecords: string[] = [];
    
    // Process records in batches to avoid overloading the server
    const batchSize = 5; // Process 5 records at a time
    for (let i = 0; i < modifiedIds.length; i += batchSize) {
      const currentBatch = modifiedIds.slice(i, i + batchSize);
      
      // Create an array of promises for the current batch
      const batchPromises = currentBatch.map(async (recordId) => {
        const scheduleItem = modifiedRecords[recordId];
        
        console.log(`[DEBUG] Saving record ID ${recordId}:`, scheduleItem);
        
        // Format data for update
        const updateData = formatItemForUpdate(recordId, scheduleItem);
        
        console.log(`[DEBUG] Formatted update data for ID ${recordId}:`, updateData);
        
        try {
          const success = await onUpdateStaffRecord(recordId, updateData);
          
          if (success) {
            successCount++;
            return { recordId, success: true };
          } else {
            failedRecords.push(recordId);
            return { recordId, success: false, error: 'Update returned false' };
          }
        } catch (error) {
          console.error(`Error saving record ${recordId}:`, error);
          failedRecords.push(recordId);
          return { recordId, success: false, error };
        }
      });
      
      // Wait for all promises in this batch to complete before moving to the next batch
      const batchResults = await Promise.all(batchPromises);
      console.log(`[DEBUG] Batch results:`, batchResults);
      
      // Add a small delay between batches to not overwhelm the server
      if (i + batchSize < modifiedIds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Show appropriate message based on results
    if (successCount === modifiedIds.length) {
      setOperationMessage({
        text: `All ${successCount} changes saved successfully`,
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
    console.error('Error during save operation:', error);
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
  
  console.log(`Adding shift for date: ${date.toLocaleDateString()}`);
  
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
      setOperationMessage(undefined); // Изменено: используем undefined вместо null
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