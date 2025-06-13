// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService } from '../../../../services/StaffRecordsService';
import { IStaffMember } from '../../../../models/types';
import { ISRSTabState, SRSTabStateHelpers } from './useSRSTabState';
import { SRSDateUtils } from './SRSDateUtils';
import { DateUtils } from '../../../CustomDatePicker/CustomDatePicker';

/**
 * Интерфейс для параметров хука useSRSData
 * ОБНОВЛЕНО: Добавлен параметр showDeleted
 */
interface UseSRSDataProps {
  context?: WebPartContext;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  fromDate: Date;
  toDate: Date;
  showDeleted: boolean; // *** НОВОЕ: Флаг отображения удаленных записей ***
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
}

/**
 * Интерфейс для возвращаемых значений хука useSRSData
 */
interface UseSRSDataReturn {
  loadSRSData: () => Promise<void>;
  refreshSRSData: () => Promise<void>;
  isDataValid: boolean;
}

/**
 * Custom hook для загрузки и управления SRS данными
 * ИСПРАВЛЕНО: Теперь загружает ВСЕ записи (не только с TypeOfLeave) с поддержкой showDeleted
 */
export const useSRSData = (props: UseSRSDataProps): UseSRSDataReturn => {
  const {
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    fromDate,
    toDate,
    showDeleted, // *** НОВОЕ: Получаем флаг showDeleted ***
    setState
  } = props;

  console.log('[useSRSData] Hook initialized with props and showDeleted support:', {
    hasContext: !!context,
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffEmployeeId: selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    daysInRange: SRSDateUtils.calculateDaysInRange(fromDate, toDate),
    showDeleted: showDeleted, // *** НОВОЕ ***
    showDeletedSupport: true
  });

  /**
   * Проверяет валидность данных для загрузки SRS
   */
  const isDataValid = useCallback((): boolean => {
    const hasContext = !!context;
    const hasSelectedStaff = !!selectedStaff?.employeeId;
    const hasValidDates = !!(fromDate && toDate && fromDate <= toDate);
    const hasCurrentUser = !!(currentUserId && currentUserId !== '0');
    const hasManagingGroup = !!(managingGroupId && managingGroupId !== '0');
    
    const valid = hasContext && hasSelectedStaff && hasValidDates && hasCurrentUser && hasManagingGroup;
    
    if (!valid) {
      console.log('[useSRSData] Data validation failed:', {
        hasContext,
        hasSelectedStaff,
        hasValidDates,
        hasCurrentUser,
        hasManagingGroup,
        selectedStaffEmployeeId: selectedStaff?.employeeId,
        currentUserId,
        managingGroupId
      });
    }
    
    return valid;
  }, [context, selectedStaff?.employeeId, fromDate, toDate, currentUserId, managingGroupId]);

  /**
   * ИСПРАВЛЕНО: Основная функция загрузки SRS данных
   * Теперь использует getStaffRecords() вместо getStaffRecordsForSRSReports()
   * чтобы получить ВСЕ записи, а не только с TypeOfLeave
   * ОБНОВЛЕНО: Добавлена серверная фильтрация по showDeleted
   */
  const loadSRSData = useCallback(async (): Promise<void> => {
    console.log('[useSRSData] loadSRSData called - LOADING ALL RECORDS with showDeleted filter');
    console.log('[useSRSData] showDeleted filter value:', showDeleted);

    // Проверяем валидность данных
    if (!isDataValid()) {
      console.log('[useSRSData] Cannot load SRS data: invalid parameters');
      SRSTabStateHelpers.updateSRSRecords(setState, []);
      return;
    }

    if (!selectedStaff?.employeeId) {
      console.log('[useSRSData] Cannot load SRS data: missing employeeId');
      SRSTabStateHelpers.updateSRSRecords(setState, []);
      return;
    }

    if (!currentUserId || currentUserId === '0') {
      console.log('[useSRSData] Cannot load SRS data: missing or invalid currentUserId');
      SRSTabStateHelpers.setErrorSRS(setState, 'Current user ID is required for SRS data access');
      return;
    }

    if (!managingGroupId || managingGroupId === '0') {
      console.log('[useSRSData] Cannot load SRS data: missing or invalid managingGroupId');
      SRSTabStateHelpers.setErrorSRS(setState, 'Managing group ID is required for SRS data access');
      return;
    }

    try {
      // Устанавливаем состояние загрузки
      SRSTabStateHelpers.setLoadingSRS(setState, true);
      console.log('[useSRSData] Starting SRS data load for ALL RECORDS with showDeleted filter...');

      // Получаем экземпляр сервиса
      const staffRecordsService = StaffRecordsService.getInstance(context!);
      
      // Используем точные даты пользователя
      const normalizedFromDate = DateUtils.normalizeDateToUTCMidnight(fromDate);
      const normalizedToDate = DateUtils.normalizeDateToUTCMidnight(toDate);
      
      console.log('[useSRSData] Loading ALL SRS data with showDeleted filter:', {
        staffEmployeeId: selectedStaff.employeeId,
        staffName: selectedStaff.name,
        userSelectedFromDate: fromDate.toISOString(),
        userSelectedToDate: toDate.toISOString(),
        normalizedFromDate: normalizedFromDate.toISOString(),
        normalizedToDate: normalizedToDate.toISOString(),
        dateRangeInDays: SRSDateUtils.calculateDaysInRange(normalizedFromDate, normalizedToDate),
        currentUserId,
        managingGroupId,
        showDeleted: showDeleted, // *** НОВОЕ ***
        serverSideFiltering: true
      });

      // *** ОБНОВЛЕНО: Используем getStaffRecordsWithFilter для серверной фильтрации ***
      console.log('[useSRSData] *** USING SERVER-SIDE FILTERING BY DELETED STATUS ***');
      console.log('[useSRSData] Calling getStaffRecordsWithFilter with showDeleted:', showDeleted);

      // Проверяем, есть ли метод getStaffRecordsWithFilter в сервисе
      let allRecords;
      if (typeof staffRecordsService.getStaffRecordsWithFilter === 'function') {
        console.log('[useSRSData] Using getStaffRecordsWithFilter for server-side deleted filtering');
        
        // *** НОВЫЙ МЕТОД: Серверная фильтрация по статусу удаления ***
        allRecords = await staffRecordsService.getStaffRecordsWithFilter(
          normalizedFromDate,
          normalizedToDate,
          currentUserId,
          managingGroupId,
          selectedStaff.employeeId,
          undefined, // timeTableID - нам нужны все записи
          showDeleted // *** КЛЮЧЕВОЙ ПАРАМЕТР: Флаг включения удаленных записей ***
        );
        
        console.log('[useSRSData] *** SERVER-SIDE FILTERING APPLIED ***');
        console.log('[useSRSData] Records received after server filtering:', {
          recordsCount: allRecords.length,
          showDeleted: showDeleted,
          serverFilteredProperly: true
        });
        
      } else {
        console.warn('[useSRSData] getStaffRecordsWithFilter not available, using fallback with client-side filtering');
        
        // *** FALLBACK: Старый метод с клиентской фильтрацией ***
        allRecords = await staffRecordsService.getStaffRecords(
          normalizedFromDate,
          normalizedToDate,
          currentUserId,
          managingGroupId,
          selectedStaff.employeeId
        );
        
        // *** КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ по статусу удаления (fallback) ***
        if (!showDeleted) {
          const originalCount = allRecords.length;
          allRecords = allRecords.filter((record: any) => record.Deleted !== 1);
          console.log('[useSRSData] Client-side filtering applied:', {
            originalCount,
            filteredCount: allRecords.length,
            removedDeletedCount: originalCount - allRecords.length
          });
        } else {
          console.log('[useSRSData] Client-side: keeping all records including deleted ones');
        }
      }

      console.log('[useSRSData] ALL SRS data loaded with deletion filter applied:', {
        recordsCount: allRecords.length,
        hasData: allRecords.length > 0,
        showDeleted: showDeleted,
        filteringMethod: typeof staffRecordsService.getStaffRecordsWithFilter === 'function' ? 'server-side' : 'client-side'
      });

      // Фильтруем записи в ТОЧНОМ диапазоне дат пользователя
      const filteredRecords = allRecords.filter((record: any) => {
        const recordInRange = SRSDateUtils.isDateInRange(record.Date, normalizedFromDate, normalizedToDate);
        
        if (!recordInRange) {
          console.log(`[useSRSData] Record ${record.ID} (${record.Date.toLocaleDateString()}) is outside user-selected date range, filtering out`);
        }
        
        return recordInRange;
      });

      console.log('[useSRSData] After EXACT date range filtering (with deletion status):', {
        originalCount: allRecords.length,
        filteredCount: filteredRecords.length,
        userSelectedRange: `${normalizedFromDate.toLocaleDateString()} - ${normalizedToDate.toLocaleDateString()}`,
        showDeleted: showDeleted
      });

      // Логируем статистику по типам записей
      if (filteredRecords.length > 0) {
        const recordTypes = filteredRecords.reduce((acc: any, record: any) => {
          const hasTypeOfLeave = !!(record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0');
          const isDeleted = record.Deleted === 1;
          
          let type = 'Regular Work';
          if (isDeleted) {
            type = hasTypeOfLeave ? `Deleted Leave: ${record.TypeOfLeaveID}` : 'Deleted Work';
          } else if (hasTypeOfLeave) {
            type = `Leave: ${record.TypeOfLeaveID}`;
          }
          
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('[useSRSData] ALL records by type and deletion status:', recordTypes);

        // *** НОВОЕ: Подробная статистика удаленных записей ***
        const deletedCount = filteredRecords.filter((record: any) => record.Deleted === 1).length;
        const activeCount = filteredRecords.length - deletedCount;
        
        console.log('[useSRSData] *** DELETION STATUS STATISTICS ***:', {
          totalRecords: filteredRecords.length,
          activeRecords: activeCount,
          deletedRecords: deletedCount,
          showDeleted: showDeleted,
          deletedPercentage: filteredRecords.length > 0 ? Math.round((deletedCount / filteredRecords.length) * 100) : 0
        });

        // Логируем первые несколько записей для проверки
        filteredRecords.slice(0, 5).forEach((record: any, index: number) => {
          const hasTypeOfLeave = !!(record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0');
          const isDeleted = record.Deleted === 1;
          
          console.log(`[useSRSData] Sample record ${index + 1}:`, {
            id: record.ID,
            date: record.Date.toLocaleDateString(),
            typeOfLeaveId: record.TypeOfLeaveID || 'No leave type',
            typeOfLeaveTitle: record.TypeOfLeave?.Title || 'Regular work day',
            leaveTime: record.LeaveTime,
            workTime: record.WorkTime,
            isRegularWork: !hasTypeOfLeave,
            isDeleted: isDeleted, // *** НОВОЕ ***
            status: isDeleted ? 'DELETED' : 'ACTIVE'
          });
        });
      }

      // ИСПРАВЛЕНО: Обновляем состояние с ВСЕ записями (включая/исключая удаленные согласно фильтру)
      SRSTabStateHelpers.updateSRSRecords(setState, filteredRecords);

      console.log('[useSRSData] ALL SRS data with deletion filter successfully loaded and state updated');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useSRSData] Critical error loading ALL SRS data with deletion filter:', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, `Failed to load SRS data: ${errorMessage}`);
      SRSTabStateHelpers.updateSRSRecords(setState, []);
    }
  }, [
    context,
    selectedStaff?.employeeId,
    selectedStaff?.name,
    currentUserId,
    managingGroupId,
    fromDate,
    toDate,
    showDeleted, // *** НОВАЯ ЗАВИСИМОСТЬ ***
    setState,
    isDataValid
  ]);

  /**
   * Функция для принудительного обновления SRS данных
   * Алиас для loadSRSData с дополнительным логированием
   */
  const refreshSRSData = useCallback(async (): Promise<void> => {
    console.log('[useSRSData] Manual refresh requested for ALL RECORDS with current showDeleted filter');
    console.log('[useSRSData] Current showDeleted value:', showDeleted);
    await loadSRSData();
  }, [loadSRSData, showDeleted]);

  /**
   * Effect для автоматической загрузки данных при изменении зависимостей
   * ОБНОВЛЕНО: Добавлена зависимость от showDeleted
   */
  useEffect(() => {
    console.log('[useSRSData] useEffect triggered - checking if ALL data load with deletion filter is needed');
    console.log('[useSRSData] Dependencies:', {
      hasContext: !!context,
      selectedStaffEmployeeId: selectedStaff?.employeeId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      showDeleted: showDeleted, // *** НОВОЕ ***
      isDataValidResult: isDataValid()
    });

    if (isDataValid()) {
      console.log('[useSRSData] Data is valid, triggering load of ALL RECORDS with deletion filter');
      void loadSRSData();
    } else {
      console.log('[useSRSData] Data is invalid, clearing ALL SRS records');
      SRSTabStateHelpers.updateSRSRecords(setState, []);
    }
  }, [
    context,
    selectedStaff?.employeeId,
    fromDate,
    toDate,
    showDeleted, // *** НОВАЯ ЗАВИСИМОСТЬ: При изменении showDeleted перезагружаем данные ***
    isDataValid,
    loadSRSData,
    setState
  ]);

  /**
   * Effect для очистки данных при смене сотрудника
   */
  useEffect(() => {
    console.log('[useSRSData] Staff member changed, clearing state');
    
    if (!selectedStaff?.employeeId) {
      console.log('[useSRSData] No staff selected, clearing ALL SRS data');
      SRSTabStateHelpers.updateSRSRecords(setState, []);
      SRSTabStateHelpers.setErrorSRS(setState, undefined);
    }
  }, [selectedStaff?.id, setState]); // Используем id, а не employeeId для отслеживания смены сотрудника

  return {
    loadSRSData,
    refreshSRSData,
    isDataValid: isDataValid()
  };
};