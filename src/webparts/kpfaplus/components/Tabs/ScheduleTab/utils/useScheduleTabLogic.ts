// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useScheduleTabLogic.ts

import * as React from 'react';
import { useEffect, useCallback, useMemo } from 'react';
import { IDropdownOption } from '@fluentui/react';
// Corrected import paths - need to go up 4 levels from utils - IMPORT ITabProps here
import { ITabProps } from '../../../../models/types';
// Corrected import path - ScheduleTabApi is sibling to utils
import { shouldRefreshDataOnDateChange } from '../ScheduleTabApi';
// Import state hook from same utils folder
import { IScheduleTabState, useScheduleTabState } from './useScheduleTabState';
// Import services hook from same utils folder
import { useScheduleTabServices } from './useScheduleTabServices';
// Import data hooks from same utils folder
import { useHolidaysAndLeaves } from './useHolidaysAndLeaves';
import { useContracts } from './useContracts';
import { useTypesOfLeave } from './useTypesOfLeave';
import { useStaffRecordsData } from './useStaffRecordsData';
import { useStaffRecordsMutations } from './useStaffRecordsMutations';


// --- ИСПРАВЛЕНИЕ: Добавлено ключевое слово 'export' ---
export interface UseScheduleTabLogicReturn extends IScheduleTabState {
 // Handlers from orchestrator
 onDateChange: (date: Date | undefined) => void;
 onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
 onErrorDismiss: () => void;
 onRefreshData: () => void;

 // Обработчики пагинации
 onPageChange: (page: number) => void;
 onItemsPerPageChange: (itemsPerPage: number) => void;

 // Pass down handlers/getters from specific hooks using their final names
 getExistingRecordsWithStatus: ReturnType<typeof useStaffRecordsData>['getExistingRecordsWithStatus'];
 markRecordsAsDeleted: ReturnType<typeof useStaffRecordsData>['markRecordsAsDeleted'];
 onAddShift: ReturnType<typeof useStaffRecordsMutations>['handleAddShift'];
 onUpdateStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleUpdateStaffRecord'];
 onCreateStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleCreateStaffRecord'];
 onDeleteStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleDeleteStaffRecord'];
 onRestoreStaffRecord: ReturnType<typeof useStaffRecordsMutations>['handleRestoreStaffRecord'];

 // Добавлены showDeleted и onToggleShowDeleted, как часть возвращаемого значения оркестратора
 showDeleted: boolean; // <-- showDeleted state from orchestrator
 onToggleShowDeleted: (checked: boolean) => void; // <-- onToggleShowDeleted handler from orchestrator

 // *** ДОБАВЛЯЕМ НОВЫЕ ФУНКЦИИ ДЛЯ ГРУППОВОГО УДАЛЕНИЯ: ***
 onBulkDeleteStaffRecords: (recordIds: string[]) => Promise<{ successCount: number; failedIds: string[] }>;
}

export const useScheduleTabLogic = (props: ITabProps): UseScheduleTabLogicReturn => {
 const { selectedStaff, context, currentUserId, managingGroupId } = props;

 console.log('[useScheduleTabLogic] Orchestrator hook initialized');

 // Управление основным состоянием, включая пагинацию и showDeleted
 const { state, setState } = useScheduleTabState(); // state теперь включает currentPage, itemsPerPage, totalItemCount, showDeleted

 // Инициализация сервисов
 const services = useScheduleTabServices(context);


 // --- ХУКИ ЗАГРУЗКИ ДАННЫХ (теперь принимают currentPage, itemsPerPage, showDeleted) ---
 const { loadHolidaysAndLeaves } = useHolidaysAndLeaves({
 context,
 selectedDate: state.selectedDate,
 selectedStaff,
 currentUserId,
 managingGroupId,
 // УБРАНО: holidaysService: services.holidaysService,
 // УБРАНО: daysOfLeavesService: services.daysOfLeavesService,
 setState // Передаем setState для обновления общего состояния
});

 const { loadContracts } = useContracts({
   context,
   selectedDate: state.selectedDate,
   selectedStaff,
   currentUserId,
   managingGroupId,
   setState // Передаем setState для обновления общего состояния
 });

 const { loadTypesOfLeave } = useTypesOfLeave({
   context,
   typeOfLeaveService: services.typeOfLeaveService,
   setState // Передаем setState для обновления общего состояния
 });

 const {
   loadStaffRecords, // Этот метод теперь использует state.currentPage, state.itemsPerPage, state.showDeleted
   getExistingRecordsWithStatus,
   markRecordsAsDeleted
 } = useStaffRecordsData({
   context,
   selectedDate: state.selectedDate,
   selectedContractId: state.selectedContractId,
   selectedStaff,
   currentUserId,
   managingGroupId,
   staffRecordsService: services.staffRecordsService,
   setState, // Передаем setState для обновления общего состояния
   currentPage: state.currentPage, // Передаем текущую страницу в хук данных
   itemsPerPage: state.itemsPerPage, // Передаем количество элементов на странице в хук данных
   showDeleted: state.showDeleted // <-- Передаем showDeleted в хук данных
 });

 const {
   handleAddShift,
   handleUpdateStaffRecord,
   handleCreateStaffRecord,
   handleDeleteStaffRecord,
   handleRestoreStaffRecord,
   // *** ДОБАВЛЯЕМ НОВУЮ ФУНКЦИЮ ГРУППОВОГО УДАЛЕНИЯ: ***
   handleBulkDeleteStaffRecords: mutationsBulkDelete, // ← ПЕРЕИМЕНОВЫВАЕМ ДЛЯ ИЗБЕЖАНИЯ КОНФЛИКТА
 } = useStaffRecordsMutations({
   context,
   selectedDate: state.selectedDate,
   selectedContractId: state.selectedContractId,
   selectedStaff,
   currentUserId,
   managingGroupId,
   staffRecordsService: services.staffRecordsService,
   reloadRecords: loadStaffRecords, // Передаем функцию загрузки для обновления после мутаций
   setState // Передаем setState для обновления общего состояния (loading/error)
 });

 // --- ОБРАБОТЧИКИ ИЗМЕНЕНИЯ СОСТОЯНИЯ (включая пагинацию и showDeleted) ---

 const handleDateChange = useCallback((date: Date | undefined): void => {
   console.log('[useScheduleTabLogic] handleDateChange called with date:', date?.toISOString());
   if (!date) {
     console.log('[useScheduleTabLogic] No date provided to handleDateChange');
     return;
   }

   const currentDate = state.selectedDate;

   // *** ДОБАВЛЯЕМ СОХРАНЕНИЕ ДАТЫ В sessionStorage ***
   try {
     sessionStorage.setItem('scheduleTab_selectedDate', date.toISOString());
     console.log('[useScheduleTabLogic] Date saved to sessionStorage:', date.toISOString());
   } catch (error) {
     console.warn('[useScheduleTabLogic] Error saving date to sessionStorage:', error);
   }

   // Обновляем дату И сбрасываем пагинацию на первую страницу при смене даты
   setState(prevState => ({
     ...prevState,
     selectedDate: date,
     currentPage: 1, // Сброс страницы
     // totalItemCount будет обновлен в useStaffRecordsData после загрузки
   }));

    if (shouldRefreshDataOnDateChange(currentDate, date)) {
      console.log('[useScheduleTabLogic] Month or year changed, triggering dependent loads via effects');
       // Эффекты в хуках загрузки данных (Holidays/Leaves, Contracts, StaffRecords) сработают,
       // так как state.selectedDate изменился.
    } else {
        console.log('[useScheduleTabLogic] Only day changed, staff records hook effect will handle reload.');
        // Эффект в useStaffRecordsData сработает, так как state.selectedDate изменился.
    }

    // При изменении даты всегда нужно перезагрузить контракты
    // Эффект в useContracts сработает, так как state.selectedDate изменился.

 }, [state.selectedDate, setState]); // Зависимости для useCallback

 const handleContractChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
   console.log('[useScheduleTabLogic] handleContractChange called with option:', option);
   if (option) {
     const newContractId = option.key.toString();
     console.log(`[useScheduleTabLogic] Contract changing from ${state.selectedContractId} to: ${newContractId}`);

     // Обновляем ID контракта И сбрасываем пагинацию на первую страницу при смене контракта
     setState(prevState => ({
       ...prevState,
       selectedContractId: newContractId,
       currentPage: 1, // Сброс страницы
       // totalItemCount будет обновлен в useStaffRecordsData после загрузки
     }));

     // Эффект в useStaffRecordsData сработает, так как state.selectedContractId изменился.
     console.log('[useScheduleTabLogic] Contract changed, useStaffRecordsData effect will trigger reload.');
   }
 }, [state.selectedContractId, setState]); // Зависимости для useCallback

 const handleErrorDismiss = useCallback((): void => {
   console.log('[useScheduleTabLogic] handleErrorDismiss called');
   setState(prevState => ({ ...prevState, error: undefined, errorStaffRecords: undefined }));
 }, [setState]); // Зависимости для useCallback

 const handleRefreshData = useCallback((): void => {
   console.log('[useScheduleTabLogic] handleRefreshData called');
   // Вызываем loadStaffRecords напрямую. Он использует актуальные значения пагинации.
   void loadStaffRecords();
   // Также обновляем другие данные, которые не зависят от пагинации
   loadHolidaysAndLeaves();
   loadContracts(); // Контракты тоже могут зависеть от даты
   loadTypesOfLeave(); // Типы отпусков редко меняются, но можно обновить
 }, [loadStaffRecords, loadHolidaysAndLeaves, loadContracts, loadTypesOfLeave]); // Зависимости для useCallback


 // --- ИСПРАВЛЕННЫЕ ОБРАБОТЧИКИ ПАГИНАЦИИ (БЕЗ ПРИНУДИТЕЛЬНОЙ ПЕРЕЗАГРУЗКИ) ---
 const handlePageChange = useCallback((page: number): void => {
   console.log('[useScheduleTabLogic] handlePageChange called with page:', page);
   if (page === state.currentPage) {
       console.log('[useScheduleTabLogic] Page is already', page, '. Skipping update.');
       return;
   }
   
   console.log('[useScheduleTabLogic] Updating currentPage to:', page);
   // ИСПРАВЛЕНО: Убрана принудительная перезагрузка через setTimeout
   // Обновляем только текущую страницу - useEffect в useStaffRecordsData сработает автоматически
   setState(prevState => ({ ...prevState, currentPage: page }));
   
   // УДАЛЕНО: Принудительная перезагрузка данных
   // console.log('[useScheduleTabLogic] *** FORCING DATA RELOAD FOR NEW PAGE ***');
   // setTimeout(() => {
   //     loadStaffRecords(); // ← ЭТОТ ВЫЗОВ УДАЛЕН!
   // }, 50);
   
}, [state.currentPage, setState]); // ИСПРАВЛЕНО: Убрана зависимость loadStaffRecords

 const handleItemsPerPageChange = useCallback((itemsPerPage: number): void => {
     console.log('[useScheduleTabLogic] handleItemsPerPageChange called with itemsPerPage:', itemsPerPage);
     if (itemsPerPage === state.itemsPerPage) {
          console.log('[useScheduleTabLogic] Items per page is already', itemsPerPage, '. Skipping update.');
          return; // Не обновляем, если количество элементов то же
     }
      // Обновляем количество элементов на странице И сбрасываем страницу на первую.
      // loadStaffRecords будет вызван эффектом.
     setState(prevState => ({ ...prevState, itemsPerPage: itemsPerPage, currentPage: 1 }));
 }, [state.itemsPerPage, setState]); // Зависимости для useCallback

 // --- НОВЫЙ ОБРАБОТЧИК ДЛЯ TOGGLE SHOW DELETED ---
 const handleToggleShowDeleted = useCallback((checked: boolean): void => {
     console.log('[useScheduleTabLogic] handleToggleShowDeleted called with:', checked);
     // Обновляем состояние showDeleted. loadStaffRecords будет вызван эффектом.
     setState(prevState => ({ ...prevState, showDeleted: checked }));
 }, [setState]); // Зависит от setState

 // *** ФУНКЦИЯ ГРУППОВОГО УДАЛЕНИЯ БЕЗ АВТОПЕРЕЗАГРУЗКИ (ПЕРЕИМЕНОВАННАЯ) ***
 const handleBulkDeleteWithoutReload = useCallback(async (recordIds: string[]): Promise<{ successCount: number; failedIds: string[] }> => {
   console.log(`[useScheduleTabLogic] handleBulkDeleteWithoutReload called for ${recordIds.length} records`);
   
   if (!mutationsBulkDelete) {
     // Fallback к обычному удалению БЕЗ автоперезагрузки
     console.log('[useScheduleTabLogic] mutationsBulkDelete not available, using fallback without auto-reload');
     let successCount = 0;
     const failedIds: string[] = [];
     
     for (const recordId of recordIds) {
       try {
         // *** ВАЖНО: Используем прямой вызов сервиса БЕЗ handleMutation ***
         // handleDeleteStaffRecord вызывает handleMutation, которая делает reloadRecords
         // Мы этого НЕ хотим для группового удаления
         if (services.staffRecordsService) {
           const success = await services.staffRecordsService.markRecordAsDeleted(recordId);
           if (success) {
             successCount++;
             console.log(`[useScheduleTabLogic] ✓ Direct service call: deleted record ${recordId}`);
           } else {
             failedIds.push(recordId);
             console.error(`[useScheduleTabLogic] ✗ Direct service call: failed to delete record ${recordId}`);
           }
         } else {
           failedIds.push(recordId);
           console.error(`[useScheduleTabLogic] ✗ Staff records service not available for record ${recordId}`);
         }
       } catch (error) {
         console.error(`[useScheduleTabLogic] ✗ Error deleting record ${recordId}:`, error);
         failedIds.push(recordId);
       }
     }
     
     console.log(`[useScheduleTabLogic] Fallback bulk deletion completed: ${successCount}/${recordIds.length} successful, ${failedIds.length} failed`);
     return { successCount, failedIds };
   }
   
   // Используем оптимизированную функцию из useStaffRecordsMutations
   console.log('[useScheduleTabLogic] Using optimized bulk delete function from useStaffRecordsMutations');
   return await mutationsBulkDelete(recordIds);
 }, [mutationsBulkDelete, services.staffRecordsService]);


 // --- ОСНОВНЫЕ ЭФФЕКТЫ (реагируют на смену сотрудника/контекста) ---
 // Эффекты загрузки данных, зависящие от даты/контракта/пагинации, находятся внутри useStaffRecordsData и других хуков.

 useEffect(() => {
   console.log('[useScheduleTabLogic] Main orchestrator useEffect triggered for selectedStaff/context:');
   if (selectedStaff?.id && context) {
     console.log('[useScheduleTabLogic] Staff or context available. Initializing loads...');
     // При смене сотрудника, сбрасываем пагинацию на первую страницу
     setState(prevState => ({
          ...prevState,
          currentPage: 1,
          // totalItemCount будет обновлен в useStaffRecordsData
     }));

     // Инициируем загрузку контрактов, типов отпусков и праздников/отпусков.
     // Эффекты в соответствующих хуках сработают из-за зависимостей на context, selectedStaff, selectedDate.
     loadContracts(); // Зависит от staff, context, date
     loadTypesOfLeave(); // Зависит от context, service
     loadHolidaysAndLeaves(); // Зависит от staff, context, date

     // Загрузка записей расписания для первой страницы (после сброса пагинации)
     // будет вызвана эффектом в useStaffRecordsData, который зависит от currentPage.

   } else {
     console.log('[useScheduleTabLogic] Clearing state - staff or context not available');
     // Очищаем все состояние, включая пагинацию
     setState(prevState => ({
       ...prevState,
       contracts: [],
       selectedContractId: undefined,
       staffRecords: [],
       holidays: [],
       leaves: [],
       typesOfLeave: [],
       isLoading: false,
       isLoadingHolidays: false,
       isLoadingLeaves: false,
       isLoadingStaffRecords: false,
       isLoadingTypesOfLeave: false,
       error: undefined,
       errorStaffRecords: undefined,
       // --- Сброс пагинации ---
       currentPage: 1,
       totalItemCount: 0,
       // itemsPerPage остается как есть по умолчанию
       // showDeleted тоже сбрасывается к начальному значению (false)
       showDeleted: false, // <-- Сброс showDeleted
        hasNextPage: false,
     }));
   }
 }, [selectedStaff?.id, context, setState, loadContracts, loadTypesOfLeave, loadHolidaysAndLeaves]); // Зависимости useEffect


 // --- ОБЪЕДИНЯЕМ И ВОЗВРАЩАЕМ ---

 const hookReturn: UseScheduleTabLogicReturn = useMemo(() => ({
   ...state, // Распространяем все свойства состояния из useScheduleTabState (включая пагинацию и showDeleted)
   // Передаем основные обработчики
   onDateChange: handleDateChange,
   onContractChange: handleContractChange,
   onErrorDismiss: handleErrorDismiss,
   onRefreshData: handleRefreshData,

   // Передаем обработчики пагинации
   onPageChange: handlePageChange,
   onItemsPerPageChange: handleItemsPerPageChange,

   // Передаем обработчик showDeleted
   onToggleShowDeleted: handleToggleShowDeleted, // <-- Включен в возвращаемый объект

   // Передаем обработчики/геттеры из специализированных хуков
   getExistingRecordsWithStatus: getExistingRecordsWithStatus,
   markRecordsAsDeleted: markRecordsAsDeleted,
   onAddShift: handleAddShift,
   onUpdateStaffRecord: handleUpdateStaffRecord,
   onCreateStaffRecord: handleCreateStaffRecord,
   onDeleteStaffRecord: handleDeleteStaffRecord,
   onRestoreStaffRecord: handleRestoreStaffRecord,

   // *** ДОБАВЛЯЕМ НОВУЮ ФУНКЦИЮ ГРУППОВОГО УДАЛЕНИЯ: ***
   onBulkDeleteStaffRecords: handleBulkDeleteWithoutReload, // ← ИСПОЛЬЗУЕМ ПЕРЕИМЕНОВАННУЮ ФУНКЦИЮ
 }), [
   state, // Зависит от всех свойств состояния
   handleDateChange,
   handleContractChange,
   handleErrorDismiss,
   handleRefreshData,
   handlePageChange,
   handleItemsPerPageChange,
   handleToggleShowDeleted, // <-- Включен в зависимости useMemo
   getExistingRecordsWithStatus,
   markRecordsAsDeleted,
   handleAddShift,
   handleUpdateStaffRecord,
   handleCreateStaffRecord,
   handleDeleteStaffRecord,
   handleRestoreStaffRecord,
   // *** ДОБАВЛЯЕМ В ЗАВИСИМОСТИ: ***
   handleBulkDeleteWithoutReload, // ← ИСПОЛЬЗУЕМ ПЕРЕИМЕНОВАННУЮ ФУНКЦИЮ
 ]);

 return hookReturn;
};