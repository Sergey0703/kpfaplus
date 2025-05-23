// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import path for StaffRecordsService
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';

// --- ИМПОРТИРУЕМ ИНТЕРФЕЙСЫ ИЗ StaffRecordsInterfaces ---
// Corrected import path - StaffRecordsInterfaces is up 3 levels from services folder,
// and useStaffRecordsData is 2 levels down from ScheduleTab folder.
// So, from useStaffRecordsData (in ScheduleTab/utils), go up 2 levels to ScheduleTab/,
// then up 1 level to kpfaplus/components/Tabs/, then up 1 level to kpfaplus/components/,
// then up 1 level to kpfaplus/.models or kpfaplus/.services folder.
// Path to StaffRecordsInterfaces is ../../../../../services/StaffRecordsInterfaces
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces'; // <-- Правильный путь
// ---------------------------------------------------------

// Corrected import path - types is up 4 levels from utils
import { IStaffMember } from '../../../../models/types'; // <-- Правильный путь
// Corrected import path - ScheduleTabFillInterfaces is in the same utils folder
import { IExistingRecordCheck } from './ScheduleTabFillInterfaces'; // <-- Правильный путь
// Import state interface from same utils folder
import { IScheduleTabState } from './useScheduleTabState'; // <-- Правильный путь

interface UseStaffRecordsDataProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedContractId?: string;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  // State setters from orchestrator (includes pagination state setters now)
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
  // Pass current pagination state values as props
  currentPage: number;
  itemsPerPage: number;
}

interface UseStaffRecordsDataReturn {
  loadStaffRecords: (overrideDate?: Date, contractId?: string) => void;
  getExistingRecordsWithStatus: (startDate: Date, endDate: Date, employeeId: string, currentUserId?: string, staffGroupId?: string) => Promise<IExistingRecordCheck[]>;
  markRecordsAsDeleted: (recordIds: string[]) => Promise<boolean>;
  // Note: staffRecords, isLoadingStaffRecords, errorStaffRecords, totalItemCount are now part of the state managed by the orchestrator
}

export const useStaffRecordsData = (props: UseStaffRecordsDataProps): UseStaffRecordsDataReturn => {
  const {
    context,
    selectedDate,
    selectedContractId,
    selectedStaff,
    currentUserId,
    managingGroupId,
    staffRecordsService,
    setState, // We have setState to update the main state object
    currentPage, // Get current pagination state
    itemsPerPage, // Get current pagination state
  } = props;

  // Create state setters for the staff records slice of the main state
  // These setters update the main state object managed by useScheduleTabState
  const setStaffRecords = useCallback((records: IStaffRecord[]) => setState(prevState => ({ ...prevState, staffRecords: records })), [setState]);
  const setIsLoadingStaffRecords = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingStaffRecords: isLoading })), [setState]);
  const setErrorStaffRecords = useCallback((error?: string) => setState(prevState => ({ ...prevState, errorStaffRecords: error })), [setState]);
  const setTotalItemCount = useCallback((total: number) => setState(prevState => ({ ...prevState, totalItemCount: total })), [setState]); // Setter for total count


  const loadStaffRecords = useCallback(async (overrideDate?: Date, contractId?: string): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    const contractIdToUse = contractId !== undefined ? contractId : selectedContractId;

    console.log('[useStaffRecordsData] loadStaffRecords called with parameters:', {
      date: dateToUse.toISOString(),
      employeeId: selectedStaff?.employeeId,
      selectedContractId: contractIdToUse,
      currentPage, // Log pagination parameters
      itemsPerPage, // Log pagination parameters
    });

    if (!context || !staffRecordsService) {
      console.log('[useStaffRecordsData] Cannot load records: missing context or service');
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Service not available.');
      setTotalItemCount(0); // Reset total count
      return;
    }

    if (!selectedStaff || !selectedStaff.employeeId) {
      console.log('[useStaffRecordsData] Cannot load records: missing selected staff or employeeId');
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Selected staff member not found.');
      setTotalItemCount(0); // Reset total count
      return;
    }

    try {
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);

      const date = new Date(dateToUse.getTime());
      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const employeeId = selectedStaff.employeeId;
      const timeTableId = contractIdToUse;

      const currentUserID = currentUserId || '0';
      const staffGroupID = managingGroupId || '0';

      // --- ИЗМЕНЕНО ДЛЯ СЕРВЕРНОЙ ПАГИНАЦИИ ---
      // Рассчитываем skip и top для запроса к сервису
      const skip = (currentPage - 1) * itemsPerPage;
      const top = itemsPerPage;

      const queryParams: IStaffRecordsQueryParams = { // Используем IStaffRecordsQueryParams из StaffRecordsInterfaces
        startDate: firstDayOfMonth,
        endDate: lastDayOfMonth,
        currentUserID: currentUserID,
        staffGroupID: staffGroupID,
        employeeID: employeeId,
        timeTableID: timeTableId,
        skip: skip, // Передаем skip
        top: top,   // Передаем top
        // Сортировка (orderBy) по умолчанию обрабатывается внутри StaffRecordsService.getStaffRecordsWithOptions
      };

      console.log('[useStaffRecordsData] Calling staffRecordsService.getStaffRecordsWithOptions with:', queryParams);

      // Вызываем новый метод сервиса, который поддерживает пагинацию и возвращает totalCount
      // getStaffRecordsWithOptions возвращает Promise<IStaffRecordsResult> { records: IStaffRecord[], totalCount: number, error?: string }
      const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams); // Используем IStaffRecordsResult из StaffRecordsInterfaces

      console.log(`[useStaffRecordsData] Received result: ${result.records.length} records, totalCount: ${result.totalCount}`);

      // Обновляем состояние записей и ОБЩЕЕ количество записей
      setStaffRecords(result.records); // These are records for the current page
      setTotalItemCount(result.totalCount); // Set the total count from the service

      if (result.error) {
         setErrorStaffRecords(`Failed to load schedule records: ${result.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useStaffRecordsData] Error loading schedule records:', error);
      setErrorStaffRecords(`Failed to load schedule records: ${errorMessage}`);
      setStaffRecords([]); // Clear records on error
      setTotalItemCount(0); // Reset total count on error
    } finally {
      setIsLoadingStaffRecords(false);
    }
  }, [
      // --- Зависимости loadStaffRecords ---
      context, // Зависит от контекста
      staffRecordsService, // Зависит от сервиса
      selectedStaff?.employeeId, // Зависит от выбранного сотрудника
      selectedDate, // Зависит от даты
      selectedContractId, // Зависит от выбранного контракта
      currentUserId, // Зависит от ID пользователя
      managingGroupId, // Зависит от ID группы
      currentPage, // <--- !!! ВАЖНО: При изменении текущей страницы !!!
      itemsPerPage, // <--- !!! ВАЖНО: При изменении количества элементов на странице !!!
      // --- Зависимости State Setters ---
      setStaffRecords,
      setIsLoadingStaffRecords,
      setErrorStaffRecords,
      setTotalItemCount, // Добавлен сеттер общего количества в зависимости
  ]);


  // getExistingRecordsWithStatus и markRecordsAsDeleted не зависят от пагинации напрямую
  // Они остаются без изменений, но их вызовы извне должны учитывать, что они могут работать
  // со всеми записями или с подмножеством в зависимости от их собственной логики и того,
  // как они реализованы в StaffRecordsService.
  // В данном случае, getExistingRecordsWithStatus вызывает getStaffRecords (старый метод),
  // который возвращает *все* записи за период. Это может быть неоптимально
  // для получения статуса обработки, если период очень большой.
  // И markRecordsAsDeleted вызывает markRecordAsDeleted по ID, что нормально.

  // Для getExistingRecordsWithStatus, если период проверки может быть большим,
  // возможно, стоит переделать его, чтобы он тоже использовал пагинацию внутренне
  // или чтобы StaffRecordsService предоставил более оптимизированный метод
  // для проверки статуса большого числа записей по фильтру без загрузки всех полей.
  // Но для текущей задачи пагинации таблицы, мы оставим их как есть.

  const getExistingRecordsWithStatus = useCallback(async (
    startDate: Date,
    endDate: Date,
    employeeId: string, // This employeeId is likely a parameter passed into this function, not necessarily from selectedStaff
    currentUserIdParam?: string,
    staffGroupIdParam?: string
  ): Promise<IExistingRecordCheck[]> => {
    console.log('[useStaffRecordsData] getExistingRecordsWithStatus called');
    if (!context || !staffRecordsService) {
      console.log('[useStaffRecordsData] Cannot get existing records: missing dependencies');
      return [];
    }

    const currentUserID = currentUserIdParam || currentUserId || '0';
    const staffGroupID = staffGroupIdParam || managingGroupId || '0';

    try {
      // ЭТОТ МЕТОД ВСЕ ЕЩЕ ВЫЗЫВАЕТ СТАРЫЙ getStaffRecords, который может вернуть много данных
      // Если StaffRecordsService.getStaffRecords был изменен для использования getStaffRecordsWithOptions
      // без skip/top, он вернет все за период. Если нет, его поведение непредсказуемо.
      // Предполагается, что StaffRecordsService.getStaffRecords теперь вызывает StaffRecordsService.getStaffRecordsWithOptions
      // с параметрами пагинации undefined/null, что приведет к загрузке *всех* записей за период.
      const records = await staffRecordsService.getStaffRecords( // getStaffRecords возвращает Promise<IStaffRecord[]>
        startDate,
        endDate,
        currentUserID,
        staffGroupID,
        employeeId // Use the employeeId passed as a parameter
      );

      console.log(`[useStaffRecordsData] Retrieved ${records.length} existing records for status check`);

      const existingRecordsCheck: IExistingRecordCheck[] = records.map((record: IStaffRecord) => ({
        id: record.ID,
        checked: record.Checked || 0,
        exportResult: record.ExportResult || '0',
        date: record.Date,
        title: record.Title
      }));

      return existingRecordsCheck;
    } catch (error) {
      console.error('[useStaffRecordsData] Error getting existing records:', error);
      return [];
    }
  }, [context, staffRecordsService, currentUserId, managingGroupId]); // Зависит от тех же пропсов

  // markRecordsAsDeleted вызывает markRecordAsDeleted по ID, что не зависит от пагинации
  const markRecordsAsDeleted = useCallback(async (recordIds: string[]): Promise<boolean> => {
    console.log(`[useStaffRecordsData] markRecordsAsDeleted called for ${recordIds.length} records:`, recordIds);
    if (!staffRecordsService || recordIds.length === 0) {
      console.log('[useStaffRecordsData] Cannot mark records as deleted: missing service or empty ID list');
      return false;
    }

    try {
      let successCount = 0;
      const failedIds: string[] = [];

      for (const recordId of recordIds) {
        try {
          // Вызываем markRecordAsDeleted по ID, что не зависит от пагинации
          const success = await staffRecordsService.markRecordAsDeleted(recordId); // markRecordAsDeleted возвращает Promise<boolean>
          if (success) {
            successCount++;
          } else {
            failedIds.push(recordId);
            console.error(`[useStaffRecordsData] Failed to mark record ${recordId} as deleted`);
          }
        } catch (error) {
          failedIds.push(recordId);
          console.error(`[useStaffRecordsData] Error marking record ${recordId} as deleted:`, error);
        }
      }

      const allSuccess = failedIds.length === 0;
      console.log(`[useStaffRecordsData] Mark as deleted result: ${successCount}/${recordIds.length} successful, ${failedIds.length} failed`);

      if (failedIds.length > 0) {
        console.error('[useStaffRecordsData] Failed to mark records as deleted:', failedIds);
      }

      return allSuccess;
    } catch (error) {
      console.error('[useStaffRecordsData] Error in markRecordsAsDeleted:', error);
      return false;
    }
  }, [staffRecordsService]); // Зависит только от сервиса

  // --- ЭФФЕКТ ЗАГРУЗКИ ДАННЫХ ---
  // Этот эффект будет срабатывать при изменении зависимостей и вызывать loadStaffRecords
  useEffect(() => {
    console.log('[useStaffRecordsData] useEffect triggered for staff records loading:');
    if (context && staffRecordsService && selectedStaff?.employeeId) {
      // Вызываем loadStaffRecords. Он использует актуальные значения из пропсов и состояния (currentPage, itemsPerPage).
      void loadStaffRecords();
    } else {
      // Очищаем записи и сбрасываем общее количество, если зависимости недоступны
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
      setTotalItemCount(0); // Сбрасываем общее количество
    }
  }, [
    // --- Зависимости useEffect ---
    context, // При изменении контекста
    staffRecordsService, // При изменении сервиса
    selectedStaff?.employeeId, // При изменении выбранного сотрудника
    selectedDate, // При изменении даты (месяца)
    selectedContractId, // При изменении выбранного контракта
    currentUserId, // При изменении ID пользователя
    managingGroupId, // При изменении ID группы
    currentPage, // <--- !!! ВАЖНО: При изменении текущей страницы !!!
    itemsPerPage, // <--- !!! ВАЖНО: При изменении количества элементов на странице !!!
    // --- Функциональные зависимости ---
    loadStaffRecords, // loadStaffRecords обернут в useCallback, поэтому включаем его
    // --- Зависимости State Setters (опционально, но хорошая практика) ---
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords,
    setTotalItemCount,
  ]);

  // Возвращаем только функции, которые нужно вызывать извне
  return {
    loadStaffRecords, // Может быть полезен для ручного обновления (например, после сохранения)
    getExistingRecordsWithStatus, // Используется для логики Fill
    markRecordsAsDeleted, // Используется для логики Fill
  };
};