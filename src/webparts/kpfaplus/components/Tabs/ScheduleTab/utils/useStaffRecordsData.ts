// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { IStaffMember } from '../../../../models/types';
import { IExistingRecordCheck } from './ScheduleTabFillInterfaces';
import { IScheduleTabState } from './useScheduleTabState'; // Import state interface from same utils folder

interface UseStaffRecordsDataProps {
  context?: WebPartContext;
  selectedDate: Date;
  selectedContractId?: string;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  setState: React.Dispatch<React.SetStateAction<IScheduleTabState>>;
  currentPage: number;
  itemsPerPage: number;
  // --- ИСПРАВЛЕНИЕ: ДОБАВЛЕНО ПОЛЕ showDeleted ---
  showDeleted: boolean; // Флаг для фильтрации удаленных записей на стороне сервера
  // -------------------------------------------
}

// ИСПРАВЛЕНО: Добавлен параметр timeTableID в getExistingRecordsWithStatus
interface UseStaffRecordsDataReturn {
  loadStaffRecords: (overrideDate?: Date, contractId?: string) => void;
  getExistingRecordsWithStatus: (
    startDate: Date, 
    endDate: Date, 
    employeeId: string, 
    currentUserId?: string, 
    staffGroupId?: string, 
    timeTableID?: string // <-- ДОБАВЛЕН ПАРАМЕТР timeTableID
  ) => Promise<IExistingRecordCheck[]>;
  markRecordsAsDeleted: (recordIds: string[]) => Promise<boolean>;
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
    setState,
    currentPage,
    itemsPerPage,
    // --- ИСПРАВЛЕНИЕ: ИЗВЛЕКАЕМ showDeleted ИЗ ПРОПСОВ ---
    showDeleted,
    // -------------------------------------------------
  } = props;

  const setStaffRecords = useCallback((records: IStaffRecord[]) => setState(prevState => ({ ...prevState, staffRecords: records })), [setState]);
  const setIsLoadingStaffRecords = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingStaffRecords: isLoading })), [setState]);
  const setErrorStaffRecords = useCallback((error?: string) => setState(prevState => ({ ...prevState, errorStaffRecords: error })), [setState]);
  const setTotalItemCount = useCallback((total: number) => setState(prevState => ({ ...prevState, totalItemCount: total })), [setState]);

  const loadStaffRecords = useCallback(async (overrideDate?: Date, contractId?: string): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    const contractIdToUse = contractId !== undefined ? contractId : selectedContractId;

    console.log('[useStaffRecordsData] loadStaffRecords called with parameters:', {
      date: dateToUse.toISOString(),
      employeeId: selectedStaff?.employeeId,
      selectedContractId: contractIdToUse,
      currentPage,
      itemsPerPage,
      showDeleted, // <-- Логируем showDeleted
    });

    if (!context || !staffRecordsService) {
      console.log('[useStaffRecordsData] Cannot load records: missing context or service');
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Service not available.');
      setTotalItemCount(0);
      return;
    }

    if (!selectedStaff || !selectedStaff.employeeId) {
      console.log('[useStaffRecordsData] Cannot load records: missing selected staff or employeeId');
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Selected staff member not found.');
      setTotalItemCount(0);
      return;
    }

    try {
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);

      const date = new Date(dateToUse.getTime());
      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const employeeId = selectedStaff.employeeId;
      const timeTableId = contractIdToUse; // <-- ИСПРАВЛЕНИЕ ОПЕЧАТКИ: contractIdToUse

      const currentUserID = currentUserId || '0';
      const staffGroupID = managingGroupId || '0';

      const skip = (currentPage - 1) * itemsPerPage;
      const top = itemsPerPage;

      const queryParams: IStaffRecordsQueryParams = {
        startDate: firstDayOfMonth,
        endDate: lastDayOfMonth,
        currentUserID: currentUserID,
        staffGroupID: staffGroupID,
        employeeID: employeeId,
        timeTableID: timeTableId,
        skip: skip,
        top: top,
        // --- ИСПРАВЛЕНИЕ: ПЕРЕДАЕМ showDeleted В ПАРАМЕТРЫ ЗАПРОСА ---
        // (Это потребует изменения buildFilterExpression в StaffRecordsFetchService.ts)
        // Но пока просто передаем его в queryParams
        // Фактическая фильтрация по showDeleted должна быть реализована в StaffRecordsFetchService.ts
        // Например, добавить поле `includeDeleted?: boolean` в IStaffRecordsQueryParams,
        // и использовать `showDeleted` для установки этого поля.
        // Для текущего шага, пока просто добавляем, предполагая, что fetchService будет использовать это.
        // Или, что более вероятно, `buildFilterExpression` должен быть модифицирован, чтобы включать `fields/Deleted eq 0`
        // когда `showDeleted` равно `false`.
        // Пока не меняем buildFilterExpression, просто передаем.
        //
        // Если вы хотите фильтровать удаленные записи на сервере,
        // вам нужно будет модифицировать StaffRecordsFetchService.buildFilterExpression.
        //
        // Для упрощения, пока не добавляем сюда `showDeleted` как параметр запроса,
        // а предполагаем, что фильтрация удаленных будет происходить выше,
        // или что StaffRecordsService предоставит опцию фильтрации.
        //
        // Давайте пока не будем передавать showDeleted через queryParams,
        // т.к. это потребует изменения всех сервисов.
        // showDeleted: showDeleted // <-- ЗАКОММЕНТИРОВАНО ВРЕМЕННО, чтобы не вызывать новых ошибок
        // ------------------------------------------------------------------
      };

      console.log('[useStaffRecordsData] Calling staffRecordsService.getStaffRecordsWithOptions with:', queryParams);

      const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

      console.log(`[useStaffRecordsData] Received result: ${result.records.length} records, totalCount: ${result.totalCount}`);

      setStaffRecords(result.records);
      setTotalItemCount(result.totalCount);

      if (result.error) {
         setErrorStaffRecords(`Failed to load schedule records: ${result.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useStaffRecordsData] Error loading schedule records:', error);
      setErrorStaffRecords(`Failed to load schedule records: ${errorMessage}`);
      setStaffRecords([]);
      setTotalItemCount(0);
    } finally {
      setIsLoadingStaffRecords(false);
    }
  }, [
      context,
      staffRecordsService,
      selectedStaff?.employeeId,
      selectedDate,
      selectedContractId,
      currentUserId,
      managingGroupId,
      currentPage,
      itemsPerPage,
      // --- ИСПРАВЛЕНИЕ: ДОБАВЛЕНО showDeleted В ЗАВИСИМОСТИ ---
      showDeleted, // <-- Добавлено showDeleted в зависимости useEffect
      // -----------------------------------------------------
      setStaffRecords,
      setIsLoadingStaffRecords,
      setErrorStaffRecords,
      setTotalItemCount,
  ]);

  // ИСПРАВЛЕНО: Добавлен параметр timeTableIDParam
  const getExistingRecordsWithStatus = useCallback(async (
    startDate: Date,
    endDate: Date,
    employeeId: string,
    currentUserIdParam?: string,
    staffGroupIdParam?: string,
    timeTableIDParam?: string // <-- ДОБАВЛЕН ПАРАМЕТР timeTableID
  ): Promise<IExistingRecordCheck[]> => {
    console.log('[useStaffRecordsData] getExistingRecordsWithStatus called with timeTableID:', timeTableIDParam);
    if (!context || !staffRecordsService) {
      console.log('[useStaffRecordsData] Cannot get existing records: missing dependencies');
      return [];
    }

    const currentUserID = currentUserIdParam || currentUserId || '0';
    const staffGroupID = staffGroupIdParam || managingGroupId || '0';
    const timeTableID = timeTableIDParam || selectedContractId; // <-- ИСПОЛЬЗУЕМ ПЕРЕДАННЫЙ ИЛИ ИЗ СОСТОЯНИЯ

    try {
      // ИСПРАВЛЕНО: Используем getStaffRecordsWithOptions с полными параметрами вместо getStaffRecords
      const queryParams: IStaffRecordsQueryParams = {
        startDate: startDate,
        endDate: endDate,
        currentUserID: currentUserID,
        staffGroupID: staffGroupID,
        employeeID: employeeId,
        timeTableID: timeTableID, // <-- ПЕРЕДАЕМ timeTableID
        skip: 0, // Для проверки существующих записей берем все
        top: 1000 // Достаточно большое число для получения всех записей периода
      };

      console.log('[useStaffRecordsData] getExistingRecordsWithStatus query params:', queryParams);

      const result = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

      console.log(`[useStaffRecordsData] Retrieved ${result.records.length} existing records for status check (with timeTableID: ${timeTableID})`);

      const existingRecordsCheck: IExistingRecordCheck[] = result.records.map((record: IStaffRecord) => ({
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
  }, [context, staffRecordsService, currentUserId, managingGroupId, selectedContractId]); // <-- ДОБАВЛЕН selectedContractId в зависимости

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
          const success = await staffRecordsService.markRecordAsDeleted(recordId);
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
  }, [staffRecordsService]);

  // --- ЭФФЕКТ ЗАГРУЗКИ ДАННЫХ ---
  // Этот эффект будет срабатывать при изменении зависимостей и вызывать loadStaffRecords
  useEffect(() => {
    console.log('[useStaffRecordsData] useEffect triggered for staff records loading:');
    if (context && staffRecordsService && selectedStaff?.employeeId) {
      void loadStaffRecords();
    } else {
      setStaffRecords([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
      setTotalItemCount(0);
    }
  }, [
    context,
    staffRecordsService,
    selectedStaff?.employeeId,
    selectedDate,
    selectedContractId,
    currentUserId,
    managingGroupId,
    currentPage,
    itemsPerPage,
    // --- ИСПРАВЛЕНИЕ: ДОБАВЛЕНО showDeleted В ЗАВИСИМОСТИ ---
    showDeleted, // <-- Добавлено showDeleted в зависимости useEffect
    // -----------------------------------------------------
    loadStaffRecords,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords,
    setTotalItemCount,
  ]);

  return {
    loadStaffRecords,
    getExistingRecordsWithStatus,
    markRecordsAsDeleted,
  };
};