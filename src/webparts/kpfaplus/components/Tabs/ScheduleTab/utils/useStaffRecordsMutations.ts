// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsMutations.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths relative to utils folder
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
// Corrected import path - types is up 4 levels from utils
import { IStaffMember } from '../../../../models/types';
// Corrected import path - components is sibling to utils, ScheduleTable is inside components
import { INewShiftData} from '../components/ScheduleTable'; // Import IScheduleItem if needed
// Импортируем IScheduleTabState для типизации prevState
import { IScheduleTabState } from './useScheduleTabState'; // <-- ИМПОРТ IScheduleTabState
import { useCallback, useMemo } from 'react'; // Import useMemo

interface UseStaffRecordsMutationsProps {
context?: WebPartContext;
selectedDate: Date;
selectedContractId?: string;
selectedStaff?: IStaffMember; // Needed for employeeId in create
currentUserId?: string; // Needed for manager ID in create
managingGroupId?: string; // Needed for staff group ID in create
staffRecordsService?: StaffRecordsService;
// Function to reload records after a mutation - PROVIDED BY ORCHESTRATOR
reloadRecords: (overrideDate?: Date, contractId?: string) => void; // Specify type here
// State setters for general loading/error if mutations are global
// ИСПРАВЛЕНИЕ: Явно указываем тип для setState, используя IScheduleTabState
setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>; // <-- ИСПРАВЛЕНО
}

// ДОБАВЛЕН интерфейс для возвращаемого типа хука
export interface UseStaffRecordsMutationsReturn {
handleAddShift: (date: Date, shiftData?: INewShiftData) => Promise<void>;
handleUpdateStaffRecord: (recordId: string, updateData: Partial<IStaffRecord>) => Promise<boolean>;
handleCreateStaffRecord: (
  createData: Partial<IStaffRecord>,
  currentUserIdParam?: string,
  staffGroupIdParam?: string,
  staffMemberIdParam?: string
) => Promise<string | undefined>;
handleDeleteStaffRecord: (recordId: string) => Promise<boolean>;
handleRestoreStaffRecord: (recordId: string) => Promise<boolean>;
// *** ДОБАВЛЯЕМ НОВУЮ ФУНКЦИЮ ГРУППОВОГО УДАЛЕНИЯ: ***
handleBulkDeleteStaffRecords: (recordIds: string[]) => Promise<{ successCount: number; failedIds: string[] }>;
}

// Custom hook for staff records mutation actions
// ИСПРАВЛЕНО: Добавлен явный тип возврата
export const useStaffRecordsMutations = (
props: UseStaffRecordsMutationsProps
): UseStaffRecordsMutationsReturn => {
const {
  context,
  selectedDate,
  selectedContractId,
  selectedStaff,
  currentUserId,
  managingGroupId,
  staffRecordsService,
  reloadRecords,
  setState
} = props;

 // Create state setters using useCallback for stability (using general loading/error)
 // ИСПРАВЛЕНИЕ: Явно указываем тип для prevState в функциях сеттеров
const setIsLoading = useCallback((isLoading: boolean) => setState((prevState: IScheduleTabState) => ({ ...prevState, isLoading })), [setState]); // <-- ИСПРАВЛЕНО
const setError = useCallback((error?: string) => setState((prevState: IScheduleTabState) => ({ ...prevState, error })), [setState]); // <-- ИСПРАВЛЕНО

// Helper to handle common mutation pattern
const handleMutation = useCallback(async (
  mutationFn: () => Promise<boolean | string | undefined>,
  successMessage: string,
  errorMessage: string
): Promise<boolean | string | undefined> => {
  // Проверяем сервис перед вызовом
  if (!staffRecordsService) {
       console.error(`[useStaffRecordsMutations] Cannot perform mutation (${errorMessage}): staffRecordsService is not available`);
       setError('Service not available.');
       return errorMessage.startsWith('create') ? undefined : false;
   }
  try {
    setIsLoading(true);
    setError(undefined);

    const result = await mutationFn();

    if (result !== false && result !== undefined) {
      console.log(`[useStaffRecordsMutations] Mutation successful: ${successMessage}`);
      setTimeout(() => {
        void reloadRecords(selectedDate, selectedContractId);
      }, 500);
    } else if (result === false) {
       console.error(`[useStaffRecordsMutations] Mutation failed: ${errorMessage}`);
       setError(`Failed to complete action: ${errorMessage}`);
    }

    return result;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[useStaffRecordsMutations] Error during mutation (${errorMessage}):`, error);
    setError(`Error: ${msg}`);
    return errorMessage.startsWith('create') ? undefined : false;
  } finally {
     setTimeout(() => setIsLoading(false), 600);
  }
}, [context, staffRecordsService, reloadRecords, selectedDate, selectedContractId, setIsLoading, setError]);

// *** ИСПРАВЛЕННАЯ ФУНКЦИЯ handleAddShift С ИСПОЛЬЗОВАНИЕМ ВРЕМЕНИ ОБЕДА ИЗ shiftData ***
const handleAddShift = useCallback(async (date: Date, shiftData?: INewShiftData): Promise<void> => {
    console.log(`[useStaffRecordsMutations] *** HANDLE ADD SHIFT WITH LUNCH TIME FROM SHIFT DATA ***`);
    console.log(`[useStaffRecordsMutations] handleAddShift called for date: ${date.toLocaleDateString()}`);
    console.log(`[useStaffRecordsMutations] shiftData received:`, shiftData);
    
    // Проверяем наличие необходимых данных и сервиса
    if (!selectedStaff?.employeeId) {
      console.error('[useStaffRecordsMutations] Cannot add shift: missing selected staff or employeeId');
      setError('Selected staff member not found.');
      return;
    }
     if (!staffRecordsService) { // Проверка наличия сервиса уже есть в handleMutation, но можно добавить и здесь для ясности
          console.error('[useStaffRecordsMutations] Cannot add shift: staffRecordsService is not available');
          setError('Service not available.');
          return;
     }

    // *** СОЗДАЕМ НОРМАЛИЗОВАННУЮ ДАТУ (DATE-ONLY) ***
    const newDate = new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(), 
      date.getUTCDate(),
      0, 0, 0, 0
    ));  // UTC timezone

    console.log(`[useStaffRecordsMutations] *** CREATING RECORD WITH DATE-ONLY + NUMERIC FIELDS ***`);
    console.log(`[useStaffRecordsMutations] Date-only field: ${newDate.toISOString()}`);
    
    // *** ИСПОЛЬЗУЕМ ЧИСЛОВЫЕ ЗНАЧЕНИЯ ВРЕМЕНИ НАПРЯМУЮ ***
    const startHours = 0;
    const startMinutes = 0;
    const finishHours = 0;
    const finishMinutes = 0;

    // *** ИСПРАВЛЕНИЕ: Используем время обеда из shiftData или значение по умолчанию ***
    const lunchTimeMinutes = shiftData?.timeForLunch ? parseInt(shiftData.timeForLunch, 10) : 60;
    
    console.log(`[useStaffRecordsMutations] *** LUNCH TIME FROM SHIFT DATA ***`);
    console.log(`[useStaffRecordsMutations] shiftData.timeForLunch: ${shiftData?.timeForLunch}`);
    console.log(`[useStaffRecordsMutations] Parsed lunch time: ${lunchTimeMinutes} minutes`);

    console.log(`[useStaffRecordsMutations] *** NUMERIC TIME FIELDS ***`);
    console.log(`[useStaffRecordsMutations] Start: ${startHours}:${startMinutes}`);
    console.log(`[useStaffRecordsMutations] Finish: ${finishHours}:${finishMinutes}`);

    const createData: Partial<IStaffRecord> = {
      Date: newDate, // *** DATE-ONLY ПОЛЕ ***
      
      // *** ТОЛЬКО ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
      ShiftDate1Hours: startHours,
      ShiftDate1Minutes: startMinutes,
      ShiftDate2Hours: finishHours,
      ShiftDate2Minutes: finishMinutes,
      
      TimeForLunch: lunchTimeMinutes, // *** ИСПРАВЛЕНО: Используем время обеда из shiftData ***
      Contract: shiftData?.contractNumber ? parseInt(shiftData.contractNumber, 10) : 1,
      WeeklyTimeTableID: selectedContractId,
      TypeOfLeaveID: shiftData?.typeOfLeave || '',
      Title: shiftData?.typeOfLeave ? `Leave on ${date.toLocaleDateString()}` : `Shift on ${date.toLocaleDateString()}`
    };

    const employeeId = selectedStaff.employeeId;
    const currentUserID = currentUserId || '0';
    const staffGroupID = managingGroupId || '0';

    console.log('[useStaffRecordsMutations] *** CREATING NEW SHIFT WITH LUNCH TIME FROM EXISTING SHIFT ***');
    console.log('[useStaffRecordsMutations] Lunch time used:', createData.TimeForLunch, 'minutes');
    console.log('[useStaffRecordsMutations] Numeric time fields:', {
      ShiftDate1Hours: createData.ShiftDate1Hours,
      ShiftDate1Minutes: createData.ShiftDate1Minutes,
      ShiftDate2Hours: createData.ShiftDate2Hours,
      ShiftDate2Minutes: createData.ShiftDate2Minutes
    });
    console.log('[useStaffRecordsMutations] Date-only field:', {
      Date: createData.Date?.toISOString()
    });
    console.log('[useStaffRecordsMutations] Using reference IDs:', {
      currentUserID,
      staffGroupID,
      employeeId
    });

    await handleMutation(
        // Используем стрелочную функцию для отложенного вызова сервиса
        () => staffRecordsService.createStaffRecord(createData, currentUserID, staffGroupID, employeeId),
        'Shift added successfully with lunch time from existing shift.',
        'add shift'
    );
}, [selectedStaff?.employeeId, selectedContractId, currentUserId, managingGroupId, staffRecordsService, handleMutation, setError]);

const handleUpdateStaffRecord = useCallback(async (recordId: string, updateData: Partial<IStaffRecord>): Promise<boolean> => {
  console.log(`[useStaffRecordsMutations] *** UPDATE STAFF RECORD WITH NUMERIC FIELDS ONLY ***`);
  console.log(`[useStaffRecordsMutations] handleUpdateStaffRecord called for record ID: ${recordId}`);
  
  // *** ЛОГИРУЕМ ВХОДЯЩИЕ ДАННЫЕ ДЛЯ ОТЛАДКИ ***
  console.log(`[useStaffRecordsMutations] Update data received:`, {
    hasDate: !!updateData.Date,
    hasShiftDate1Hours: updateData.ShiftDate1Hours !== undefined,
    hasShiftDate1Minutes: updateData.ShiftDate1Minutes !== undefined,
    hasShiftDate2Hours: updateData.ShiftDate2Hours !== undefined,
    hasShiftDate2Minutes: updateData.ShiftDate2Minutes !== undefined,
    numericFields: {
      ShiftDate1Hours: updateData.ShiftDate1Hours,
      ShiftDate1Minutes: updateData.ShiftDate1Minutes,
      ShiftDate2Hours: updateData.ShiftDate2Hours,
      ShiftDate2Minutes: updateData.ShiftDate2Minutes
    },
    dateOnlyField: {
      Date: updateData.Date?.toISOString()
    }
  });
  
   // Проверяем наличие сервиса перед использованием
   if (!staffRecordsService) {
        console.error('[useStaffRecordsMutations] Cannot update record: staffRecordsService is not available');
         setError('Service not available.');
         return false;
   }

  const result = await handleMutation(
      // Используем стрелочную функцию для отложенного вызова сервиса
      () => staffRecordsService.updateStaffRecord(recordId, updateData),
      `Record ${recordId} updated successfully with numeric time fields only.`,
      `update record ${recordId}`
  );
  return result === true; // Результат handleMutation может быть undefined (для создания), поэтому явное сравнение с true
}, [staffRecordsService, handleMutation, setError]);

// *** ОБНОВЛЕННАЯ ФУНКЦИЯ handleCreateStaffRecord ТОЛЬКО С ЧИСЛОВЫМИ ПОЛЯМИ ***
const handleCreateStaffRecord = useCallback(async (
  createData: Partial<IStaffRecord>,
  currentUserIdParam?: string, // Optional override
  staffGroupIdParam?: string,  // Optional override
  staffMemberIdParam?: string  // Optional override
): Promise<string | undefined> => {
  console.log(`[useStaffRecordsMutations] *** CREATE STAFF RECORD WITH NUMERIC FIELDS ONLY ***`);
  console.log(`[useStaffRecordsMutations] handleCreateStaffRecord called`);

  // *** ЛОГИРУЕМ ВХОДЯЩИЕ ДАННЫЕ ДЛЯ ОТЛАДКИ ***
  console.log(`[useStaffRecordsMutations] Create data received:`, {
    hasDate: !!createData.Date,
    hasShiftDate1Hours: createData.ShiftDate1Hours !== undefined,
    hasShiftDate1Minutes: createData.ShiftDate1Minutes !== undefined,
    hasShiftDate2Hours: createData.ShiftDate2Hours !== undefined,
    hasShiftDate2Minutes: createData.ShiftDate2Minutes !== undefined,
    numericFields: {
      ShiftDate1Hours: createData.ShiftDate1Hours,
      ShiftDate1Minutes: createData.ShiftDate1Minutes,
      ShiftDate2Hours: createData.ShiftDate2Hours,
      ShiftDate2Minutes: createData.ShiftDate2Minutes
    },
    dateOnlyField: {
      Date: createData.Date?.toISOString()
    }
  });

   // Проверяем наличие сервиса перед использованием
   if (!staffRecordsService) {
        console.error('[useStaffRecordsMutations] Cannot create record: staffRecordsService is not available');
         setError('Service not available.');
         return undefined; // undefined для создания при ошибке сервиса
   }

  const userId = currentUserIdParam || currentUserId || '0';
  const groupId = staffGroupIdParam || managingGroupId || '0';
  const staffId = staffMemberIdParam || selectedStaff?.employeeId; // Use prop if param not provided

  if (!staffId || staffId === '0') { // Ensure staff member ID is available
       console.error('[useStaffRecordsMutations] Cannot create record: missing or invalid staffMemberId');
       setError('Missing staff member ID for creation.');
       return undefined; // undefined для создания при отсутствующем ID сотрудника
  }

  const newRecordId = await handleMutation(
      // Используем стрелочную функцию для отложенного вызова сервиса
      () => staffRecordsService.createStaffRecord(createData, userId, groupId, staffId),
      'Record created successfully with numeric time fields only.',
      'create record'
  );
  // Возвращаем результат, который может быть строкой ID или undefined
  return typeof newRecordId === 'string' ? newRecordId : undefined;
}, [currentUserId, managingGroupId, selectedStaff?.employeeId, staffRecordsService, handleMutation, setError]);

const handleDeleteStaffRecord = useCallback(async (recordId: string): Promise<boolean> => {
  console.log(`[useStaffRecordsMutations] handleDeleteStaffRecord called for record ID: ${recordId}`);
   // Проверяем наличие сервиса перед использованием
   if (!staffRecordsService) {
        console.error('[useStaffRecordsMutations] Cannot delete record: staffRecordsService is not available');
         setError('Service not available.');
         return false; // false для удаления при ошибке сервиса
   }

  const result = await handleMutation(
      // Используем стрелочную функцию для отложенного вызова сервиса
      () => staffRecordsService.markRecordAsDeleted(recordId), // Используем markRecordAsDeleted
      `Record ${recordId} marked as deleted successfully.`,
      `delete record ${recordId}`
  );
  return result === true; // Результат handleMutation может быть undefined (для создания), поэтому явное сравнение с true
}, [staffRecordsService, handleMutation, setError]); // Зависит от markRecordAsDeleted

const handleRestoreStaffRecord = useCallback(async (recordId: string): Promise<boolean> => {
  console.log(`[useStaffRecordsMutations] handleRestoreStaffRecord called for record ID: ${recordId}`);
  // Проверяем наличие сервиса перед использованием
   if (!staffRecordsService) {
        console.error('[useStaffRecordsMutations] Cannot restore record: staffRecordsService is not available');
         setError('Service not available.');
         return false; // false для восстановления при ошибке сервиса
   }

  const result = await handleMutation(
      // Используем стрелочную функцию для отложенного вызова сервиса
      () => staffRecordsService.restoreDeletedRecord(recordId),
      `Record ${recordId} restored successfully.`,
      `restore record ${recordId}`
  );
  return result === true; // Результат handleMutation может быть undefined (для создания), поэтому явное сравнение с true
}, [staffRecordsService, handleMutation, setError]); // Зависит от restoreDeletedRecord

// *** НОВАЯ ФУНКЦИЯ ГРУППОВОГО УДАЛЕНИЯ БЕЗ АВТОПЕРЕЗАГРУЗКИ ***
const handleBulkDeleteStaffRecords = useCallback(async (recordIds: string[]): Promise<{ successCount: number; failedIds: string[] }> => {
  console.log(`[useStaffRecordsMutations] *** BULK DELETE FUNCTION CALLED ***`);
  console.log(`[useStaffRecordsMutations] handleBulkDeleteStaffRecords called for ${recordIds.length} records`);
  
  // Проверяем наличие сервиса
  if (!staffRecordsService) {
    console.error('[useStaffRecordsMutations] Cannot perform bulk delete: staffRecordsService is not available');
    setError('Service not available.');
    return { successCount: 0, failedIds: recordIds };
  }

  console.log(`[useStaffRecordsMutations] *** IMPORTANT: NO AUTO-RELOAD - PARENT WILL HANDLE REFRESH ***`);
  
  // Устанавливаем состояние загрузки
  setIsLoading(true);
  setError(undefined);

  let successCount = 0;
  const failedIds: string[] = [];
  
  try {
    // *** УДАЛЯЕМ ЗАПИСИ БЕЗ АВТОМАТИЧЕСКОЙ ПЕРЕЗАГРУЗКИ ПОСЛЕ КАЖДОЙ ***
    for (const recordId of recordIds) {
      try {
        console.log(`[useStaffRecordsMutations] Processing record ${successCount + 1}/${recordIds.length}: ${recordId}`);
        
        // *** ВЫЗЫВАЕМ СЕРВИС НАПРЯМУЮ БЕЗ handleMutation ***
        // handleMutation делает reloadRecords после каждого вызова - мы этого НЕ хотим
        const success = await staffRecordsService.markRecordAsDeleted(recordId);
        
        if (success) {
          successCount++;
          console.log(`[useStaffRecordsMutations] ✓ Successfully deleted record ${recordId} (${successCount}/${recordIds.length})`);
        } else {
          failedIds.push(recordId);
          console.error(`[useStaffRecordsMutations] ✗ Failed to delete record ${recordId}`);
        }
      } catch (error) {
        console.error(`[useStaffRecordsMutations] ✗ Error deleting record ${recordId}:`, error);
        failedIds.push(recordId);
      }
      
      // Небольшая пауза между удалениями для предотвращения перегрузки сервера
      if (recordIds.length > 1 && successCount + failedIds.length < recordIds.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`[useStaffRecordsMutations] *** BULK DELETION COMPLETED ***`);
    console.log(`[useStaffRecordsMutations] Final result: ${successCount}/${recordIds.length} successful, ${failedIds.length} failed`);
    
    if (failedIds.length > 0) {
      console.error('[useStaffRecordsMutations] Failed to delete records:', failedIds);
      setError(`Failed to delete ${failedIds.length} of ${recordIds.length} records.`);
    }

    // *** НЕ ВЫЗЫВАЕМ reloadRecords() ЗДЕСЬ - ЭТО СДЕЛАЕТ РОДИТЕЛЬСКИЙ КОМПОНЕНТ ***
    console.log(`[useStaffRecordsMutations] *** NO AUTO-RELOAD - PARENT COMPONENT WILL HANDLE REFRESH ***`);
    
    return { successCount, failedIds };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[useStaffRecordsMutations] Error during bulk deletion:', error);
    setError(`Error during bulk deletion: ${errorMessage}`);
    
    // Если произошла критическая ошибка, считаем что все записи не удалены
    return { successCount, failedIds: recordIds };
    
  } finally {
    // Убираем состояние загрузки через небольшую задержку
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  }
}, [staffRecordsService, setIsLoading, setError]);

// ИСПРАВЛЕНО: Возвращаем useMemo с явным типом возврата
return useMemo((): UseStaffRecordsMutationsReturn => ({
  handleAddShift,
  handleUpdateStaffRecord,
  handleCreateStaffRecord,
  handleDeleteStaffRecord,
  handleRestoreStaffRecord,
  // *** ДОБАВЛЯЕМ НОВУЮ ФУНКЦИЮ: ***
  handleBulkDeleteStaffRecords,
}), [
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord,
    // *** ДОБАВЛЯЕМ В ЗАВИСИМОСТИ: ***
    handleBulkDeleteStaffRecords,
]);
};