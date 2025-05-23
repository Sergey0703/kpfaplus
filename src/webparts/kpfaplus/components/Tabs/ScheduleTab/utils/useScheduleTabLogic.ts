// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useScheduleTabLogic.ts

import * as React from 'react';
import { useEffect, useCallback, useMemo } from 'react';
import { IDropdownOption } from '@fluentui/react';
// Corrected import paths - need to go up 4 levels from utils - IMPORT ITabProps here
import { ITabProps } from '../../../../models/types'; // <-- Corrected path
// Corrected import path - ScheduleTabApi is sibling to utils
import { shouldRefreshDataOnDateChange } from '../ScheduleTabApi'; // <-- Corrected path
// Import state hook from same utils folder
import { IScheduleTabState, useScheduleTabState } from './useScheduleTabState'; // <-- Corrected path
// Import services hook from same utils folder
// Убираем импорт IScheduleTabServices, так как он не используется напрямую
import { useScheduleTabServices } from './useScheduleTabServices'; // <-- Corrected path
// Import data hooks from same utils folder
import { useHolidaysAndLeaves } from './useHolidaysAndLeaves'; // <-- Corrected path
import { useContracts } from './useContracts'; // <-- Corrected path
import { useTypesOfLeave } from './useTypesOfLeave'; // <-- Corrected path
import { useStaffRecordsData } from './useStaffRecordsData'; // <-- Corrected path
import { useStaffRecordsMutations } from './useStaffRecordsMutations'; // <-- Corrected path

// Define the return type of the main orchestrator hook
// ДОБАВЛЯЕМ обработчики пагинации в возвращаемый тип
interface UseScheduleTabLogicReturn extends IScheduleTabState {
  // Handlers from orchestrator
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onErrorDismiss: () => void;
  onRefreshData: () => void;

  // ДОБАВЛЯЕМ обработчики пагинации
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

  // Сервисы передаются в ScheduleTabContent напрямую из props, а не из хука
  // holidaysService?: HolidaysService; // Не возвращаем сервисы из этого хука
  // daysOfLeavesService?: DaysOfLeavesService;
  // typeOfLeaveService?: TypeOfLeaveService;
  // staffRecordsService?: StaffRecordsService;
}

export const useScheduleTabLogic = (props: ITabProps): UseScheduleTabLogicReturn => {
  const { selectedStaff, context, currentUserId, managingGroupId } = props;

  console.log('[useScheduleTabLogic] Orchestrator hook initialized');

  // Управление основным состоянием, включая пагинацию
  const { state, setState } = useScheduleTabState(); // state теперь включает currentPage, itemsPerPage, totalItemCount

  // Инициализация сервисов
  const services = useScheduleTabServices(context);
  // TS6133: 'IScheduleTabServices' is declared but its value is never read.
  // Это предупреждение для импорта IScheduleTabServices, который мы убрали выше.


  // --- ХУКИ ЗАГРУЗКИ ДАННЫХ (теперь принимают currentPage и itemsPerPage) ---
  const { loadHolidaysAndLeaves } = useHolidaysAndLeaves({
    context,
    selectedDate: state.selectedDate,
    selectedStaff,
    currentUserId,
    managingGroupId,
    holidaysService: services.holidaysService,
    daysOfLeavesService: services.daysOfLeavesService,
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
    loadStaffRecords, // Этот метод теперь использует state.currentPage и state.itemsPerPage
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
  });

  const {
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord,
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

  // --- ОБРАБОТЧИКИ ИЗМЕНЕНИЯ СОСТОЯНИЯ (включая пагинацию) ---

  const handleDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useScheduleTabLogic] handleDateChange called with date:', date?.toISOString());
    if (!date) {
      console.log('[useScheduleTabLogic] No date provided to handleDateChange');
      return;
    }

    const currentDate = state.selectedDate;

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


  // --- НОВЫЕ ОБРАБОТЧИКИ ПАГИНАЦИИ ---
  const handlePageChange = useCallback((page: number): void => {
      console.log('[useScheduleTabLogic] handlePageChange called with page:', page);
      if (page === state.currentPage) {
          console.log('[useScheduleTabLogic] Page is already', page, '. Skipping update.');
          return; // Не обновляем, если страница та же
      }
       // Обновляем только текущую страницу. loadStaffRecords будет вызван эффектом.
      setState(prevState => ({ ...prevState, currentPage: page }));
  }, [state.currentPage, setState]); // Зависимости для useCallback

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
      }));
    }
  }, [selectedStaff?.id, context, setState, loadContracts, loadTypesOfLeave, loadHolidaysAndLeaves]); // Зависимости useEffect


  // --- ОБЪЕДИНЯЕМ И ВОЗВРАЩАЕМ ---

  const hookReturn: UseScheduleTabLogicReturn = useMemo(() => ({
    ...state, // Распространяем все свойства состояния из useScheduleTabState (включая пагинацию)
    // Передаем основные обработчики
    onDateChange: handleDateChange,
    onContractChange: handleContractChange,
    onErrorDismiss: handleErrorDismiss,
    onRefreshData: handleRefreshData,

    // Передаем обработчики пагинации
    onPageChange: handlePageChange,
    onItemsPerPageChange: handleItemsPerPageChange,


    // Передаем обработчики/геттеры из специализированных хуков
    getExistingRecordsWithStatus: getExistingRecordsWithStatus,
    markRecordsAsDeleted: markRecordsAsDeleted,
    onAddShift: handleAddShift,
    onUpdateStaffRecord: handleUpdateStaffRecord,
    onCreateStaffRecord: handleCreateStaffRecord,
    onDeleteStaffRecord: handleDeleteStaffRecord,
    onRestoreStaffRecord: handleRestoreStaffRecord,

    // Сервисы НЕ ВОЗВРАЩАЮТСЯ из этого хука, они используются внутри.
    // ScheduleTabContent получит их как props от основного компонента ScheduleTab.

  }), [
    state, // Зависит от всех свойств состояния
    handleDateChange,
    handleContractChange,
    handleErrorDismiss,
    handleRefreshData,
    handlePageChange, // Включаем в зависимости useMemo
    handleItemsPerPageChange, // Включаем в зависимости useMemo
    getExistingRecordsWithStatus,
    markRecordsAsDeleted,
    handleAddShift,
    handleUpdateStaffRecord,
    handleCreateStaffRecord,
    handleDeleteStaffRecord,
    handleRestoreStaffRecord
  ]);

  return hookReturn;
};