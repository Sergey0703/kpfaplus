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
 */
interface UseSRSDataProps {
  context?: WebPartContext;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  fromDate: Date;
  toDate: Date;
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
 * ИСПРАВЛЕНО: Теперь загружает ВСЕ записи (не только с TypeOfLeave)
 */
export const useSRSData = (props: UseSRSDataProps): UseSRSDataReturn => {
  const {
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    fromDate,
    toDate,
    setState
  } = props;

  console.log('[useSRSData] Hook initialized with props:', {
    hasContext: !!context,
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffEmployeeId: selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    fromDate: fromDate.toISOString(),
    toDate: toDate.toISOString(),
    daysInRange: SRSDateUtils.calculateDaysInRange(fromDate, toDate)
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
   */
  const loadSRSData = useCallback(async (): Promise<void> => {
    console.log('[useSRSData] loadSRSData called - LOADING ALL RECORDS (not just TypeOfLeave)');

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
      console.log('[useSRSData] Starting SRS data load for ALL RECORDS...');

      // Получаем экземпляр сервиса
      const staffRecordsService = StaffRecordsService.getInstance(context!);
      
      // Используем точные даты пользователя
      const normalizedFromDate = DateUtils.normalizeDateToUTCMidnight(fromDate);
      const normalizedToDate = DateUtils.normalizeDateToUTCMidnight(toDate);
      
      console.log('[useSRSData] Loading ALL SRS data (including regular working days):', {
        staffEmployeeId: selectedStaff.employeeId,
        staffName: selectedStaff.name,
        userSelectedFromDate: fromDate.toISOString(),
        userSelectedToDate: toDate.toISOString(),
        normalizedFromDate: normalizedFromDate.toISOString(),
        normalizedToDate: normalizedToDate.toISOString(),
        dateRangeInDays: SRSDateUtils.calculateDaysInRange(normalizedFromDate, normalizedToDate),
        currentUserId,
        managingGroupId
      });

      // ИСПРАВЛЕНО: Используем getStaffRecords() с правильными параметрами
      console.log('[useSRSData] ИСПРАВЛЕНО: Calling getStaffRecords with correct signature');

      // ИСПРАВЛЕНО: Загружаем ВСЕ данные используя правильный метод getStaffRecords
      const allRecords = await staffRecordsService.getStaffRecords(
        normalizedFromDate,
        normalizedToDate,
        currentUserId,
        managingGroupId,
        selectedStaff.employeeId
        // НЕ передаем timeTableID - нам нужны все записи
      );

      console.log('[useSRSData] ALL SRS data loaded (including regular working days):', {
        recordsCount: allRecords.length,
        hasData: allRecords.length > 0
      });

      // Фильтруем записи в ТОЧНОМ диапазоне дат пользователя
      const filteredRecords = allRecords.filter((record: any) => {
        const recordInRange = SRSDateUtils.isDateInRange(record.Date, normalizedFromDate, normalizedToDate);
        
        if (!recordInRange) {
          console.log(`[useSRSData] Record ${record.ID} (${record.Date.toLocaleDateString()}) is outside user-selected date range, filtering out`);
        }
        
        return recordInRange;
      });

      console.log('[useSRSData] After EXACT date range filtering (ALL RECORDS):', {
        originalCount: allRecords.length,
        filteredCount: filteredRecords.length,
        userSelectedRange: `${normalizedFromDate.toLocaleDateString()} - ${normalizedToDate.toLocaleDateString()}`
      });

      // ИСПРАВЛЕНО: НЕ фильтруем по TypeOfLeave - показываем ВСЕ записи
      console.log('[useSRSData] ИСПРАВЛЕНО: Showing ALL records (not filtering by TypeOfLeave):', {
        allRecordsCount: filteredRecords.length
      });

      // Логируем статистику по типам записей
      if (filteredRecords.length > 0) {
        const recordTypes = filteredRecords.reduce((acc: any, record: any) => {
          const hasTypeOfLeave = !!(record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0');
          const type = hasTypeOfLeave ? `Leave: ${record.TypeOfLeaveID}` : 'Regular Work';
          
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('[useSRSData] ALL records by type (including regular work):', recordTypes);

        // Логируем первые несколько записей для проверки
        filteredRecords.slice(0, 5).forEach((record: any, index: number) => {
          const hasTypeOfLeave = !!(record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0');
          console.log(`[useSRSData] Sample ALL record ${index + 1}:`, {
            id: record.ID,
            date: record.Date.toLocaleDateString(),
            typeOfLeaveId: record.TypeOfLeaveID || 'No leave type',
            typeOfLeaveTitle: record.TypeOfLeave?.Title || 'Regular work day',
            leaveTime: record.LeaveTime,
            workTime: record.WorkTime,
            isRegularWork: !hasTypeOfLeave
          });
        });
      }

      // ИСПРАВЛЕНО: Обновляем состояние с ВСЕ записями (не только с TypeOfLeave)
      SRSTabStateHelpers.updateSRSRecords(setState, filteredRecords);

      console.log('[useSRSData] ALL SRS data (including regular working days) successfully loaded and state updated');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useSRSData] Critical error loading ALL SRS data:', error);
      
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
    setState,
    isDataValid
  ]);

  /**
   * Функция для принудительного обновления SRS данных
   * Алиас для loadSRSData с дополнительным логированием
   */
  const refreshSRSData = useCallback(async (): Promise<void> => {
    console.log('[useSRSData] Manual refresh requested for ALL RECORDS');
    await loadSRSData();
  }, [loadSRSData]);

  /**
   * Effect для автоматической загрузки данных при изменении зависимостей
   */
  useEffect(() => {
    console.log('[useSRSData] useEffect triggered - checking if ALL data load is needed');
    console.log('[useSRSData] Dependencies:', {
      hasContext: !!context,
      selectedStaffEmployeeId: selectedStaff?.employeeId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      isDataValidResult: isDataValid()
    });

    if (isDataValid()) {
      console.log('[useSRSData] Data is valid, triggering load of ALL RECORDS');
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