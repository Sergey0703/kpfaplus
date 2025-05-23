// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsMutations.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths relative to utils folder
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
// Corrected import path - types is up 4 levels from utils
import { IStaffMember } from '../../../../models/types';
// Corrected import path - components is sibling to utils, ScheduleTable is inside components
import { INewShiftData, IScheduleItem } from '../components/ScheduleTable'; // Import IScheduleItem if needed
// Импортируем IScheduleTabState для типизации prevState
import { IScheduleTabState } from './useScheduleTabState'; // <-- ИМПОРТ IScheduleTabState
import { useCallback, useMemo } from 'react'; // Import useMemo

// Удаляем тип ReturnType, он не нужен здесь
// type UseScheduleTabMutationsReturn = ReturnType<typeof useStaffRecordsMutations>;

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

// Определяем возвращаемый тип хука здесь или в оркестраторе
// export interface UseScheduleTabMutationsReturn { ... }

// Custom hook for staff records mutation actions
// Убираем ReturnType из объявления функции
export const useStaffRecordsMutations = (props: UseStaffRecordsMutationsProps) => { // No explicit return type here
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


  const handleAddShift = useCallback(async (date: Date, shiftData?: INewShiftData): Promise<void> => {
      console.log(`[useStaffRecordsMutations] handleAddShift called for date: ${date.toLocaleDateString()}`);
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


      const newDate = new Date(date);
      newDate.setHours(0, 0, 0, 0);

      const shiftDate1 = new Date(newDate);
      shiftDate1.setHours(9, 0, 0, 0);

      const shiftDate2 = new Date(newDate);
      shiftDate2.setHours(17, 0, 0, 0);

      const createData: Partial<IStaffRecord> = {
        Date: newDate,
        ShiftDate1: shiftDate1,
        ShiftDate2: shiftDate2,
        TimeForLunch: shiftData ? parseInt(shiftData.timeForLunch, 10) || 60 : 60,
        Contract: shiftData?.contractNumber ? parseInt(shiftData.contractNumber, 10) : 1, // Assuming contractNumber from UI maps to Contract field
        WeeklyTimeTableID: selectedContractId, // Use the currently selected contract ID from state/props
        TypeOfLeaveID: shiftData?.typeOfLeave || '', // Use TypeOfLeaveID from shiftData
        Title: shiftData?.typeOfLeave ? `Leave on ${date.toLocaleDateString()}` : `Shift on ${date.toLocaleDateString()}`, // Dynamic title
        Holiday: shiftData?.Holiday || 0 // <-- ИСПРАВЛЕНО: используем shiftData.Holiday (с большой)
      };

      const employeeId = selectedStaff.employeeId;
      const currentUserID = currentUserId || '0';
      const staffGroupID = managingGroupId || '0';

      console.log('[useStaffRecordsMutations] Creating new shift with data:', JSON.stringify(createData, null, 2));
      console.log('[useStaffRecordsMutations] Using reference IDs:', {
        currentUserID,
        staffGroupID,
        employeeId
      });

      await handleMutation(
          // Используем стрелочную функцию для отложенного вызова сервиса
          () => staffRecordsService.createStaffRecord(createData, currentUserID, staffGroupID, employeeId),
          'Shift added successfully.',
          'add shift'
      );
  }, [selectedStaff?.employeeId, selectedContractId, currentUserId, managingGroupId, staffRecordsService, handleMutation, setError]); // Зависит от onAddShift


  const handleUpdateStaffRecord = useCallback(async (recordId: string, updateData: Partial<IStaffRecord>): Promise<boolean> => {
    console.log(`[useStaffRecordsMutations] handleUpdateStaffRecord called for record ID: ${recordId}`);
     // Проверяем наличие сервиса перед использованием
     if (!staffRecordsService) {
          console.error('[useStaffRecordsMutations] Cannot update record: staffRecordsService is not available');
           setError('Service not available.');
           return false;
     }

    const result = await handleMutation(
        // Используем стрелочную функцию для отложенного вызова сервиса
        () => staffRecordsService.updateStaffRecord(recordId, updateData),
        `Record ${recordId} updated successfully.`,
        `update record ${recordId}`
    );
    return result === true; // Результат handleMutation может быть undefined (для создания), поэтому явное сравнение с true
  }, [staffRecordsService, handleMutation, setError]);


  const handleCreateStaffRecord = useCallback(async (
    createData: Partial<IStaffRecord>,
    currentUserIdParam?: string, // Optional override
    staffGroupIdParam?: string,  // Optional override
    staffMemberIdParam?: string  // Optional override
  ): Promise<string | undefined> => {
    console.log(`[useStaffRecordsMutations] handleCreateStaffRecord called`);

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
        'Record created successfully.',
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


  // Возвращаем useMemo, чтобы возвращаемый объект был стабильным
  // Удаляем ReturnType из объявления функции useStaffRecordsMutations
  return useMemo(() => ({
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord,
  }), [
      handleAddShift,
      handleUpdateStaffRecord,
      handleCreateStaffRecord,
      handleDeleteStaffRecord,
      handleRestoreStaffRecord,
  ]);
};