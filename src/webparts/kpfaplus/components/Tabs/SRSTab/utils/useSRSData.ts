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
 * Использует существующий StaffRecordsService.getStaffRecordsForSRSReports()
 * для получения записей с заполненным TypeOfLeave
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
   * Основная функция загрузки SRS данных
   * Использует StaffRecordsService.getStaffRecordsForSRSReports()
   */
  const loadSRSData = useCallback(async (): Promise<void> => {
    console.log('[useSRSData] loadSRSData called');

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
      console.log('[useSRSData] Starting SRS data load...');

      // Получаем экземпляр сервиса
      const staffRecordsService = StaffRecordsService.getInstance(context!);
      
      // ИСПРАВЛЕНО: Используем точные даты пользователя, а не расширяем их до границ недель
      // Пользователь выбрал конкретный диапазон - используем его как есть
      const normalizedFromDate = DateUtils.normalizeDateToUTCMidnight(fromDate);
      const normalizedToDate = DateUtils.normalizeDateToUTCMidnight(toDate);
      
      console.log('[useSRSData] Loading SRS data with EXACT user-selected dates:', {
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

      // Подготавливаем параметры запроса для SRS Reports
      const queryParams = {
        startDate: normalizedFromDate,
        endDate: normalizedToDate,
        currentUserID: currentUserId, // Не используем fallback '0' - уже проверили выше
        staffGroupID: managingGroupId, // Не используем fallback '0' - уже проверили выше
        employeeID: selectedStaff.employeeId
        // timeTableID не указываем, так как для SRS нам нужны все записи с TypeOfLeave
      };

      console.log('[useSRSData] Calling getStaffRecordsForSRSReports with params:', queryParams);

      // Загружаем SRS данные (записи с TypeOfLeave, исключая удаленные)
      const result = await staffRecordsService.getStaffRecordsForSRSReports(queryParams);

      console.log('[useSRSData] SRS data loaded:', {
        recordsCount: result.records.length,
        totalCount: result.totalCount,
        hasError: !!result.error
      });

      if (result.error) {
        console.error('[useSRSData] Error from SRS data service:', result.error);
        SRSTabStateHelpers.setErrorSRS(setState, result.error);
        SRSTabStateHelpers.updateSRSRecords(setState, []);
        return;
      }

      // ИСПРАВЛЕНО: Фильтруем записи в ТОЧНОМ диапазоне дат пользователя
      const filteredRecords = result.records.filter(record => {
        const recordInRange = SRSDateUtils.isDateInRange(record.Date, normalizedFromDate, normalizedToDate);
        
        if (!recordInRange) {
          console.log(`[useSRSData] Record ${record.ID} (${record.Date.toLocaleDateString()}) is outside user-selected date range, filtering out`);
        }
        
        return recordInRange;
      });

      console.log('[useSRSData] After EXACT date range filtering:', {
        originalCount: result.records.length,
        filteredCount: filteredRecords.length,
        userSelectedRange: `${normalizedFromDate.toLocaleDateString()} - ${normalizedToDate.toLocaleDateString()}`
      });

      // Дополнительная фильтрация: только записи с заполненным TypeOfLeave
      const srsRecords = filteredRecords.filter(record => {
        const hasTypeOfLeave = !!(record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0');
        const hasLeaveTime = record.LeaveTime && record.LeaveTime > 0;
        
        if (!hasTypeOfLeave) {
          console.log(`[useSRSData] Record ${record.ID} has no TypeOfLeave, filtering out`);
          return false;
        }
        
        if (!hasLeaveTime) {
          console.log(`[useSRSData] Record ${record.ID} has no LeaveTime, but keeping for SRS (TypeOfLeave: ${record.TypeOfLeaveID})`);
        }
        
        return hasTypeOfLeave;
      });

      console.log('[useSRSData] Final SRS records after TypeOfLeave filtering:', {
        beforeTypeFilter: filteredRecords.length,
        finalSRSCount: srsRecords.length
      });

      // Логируем статистику по типам отпусков
      if (srsRecords.length > 0) {
        const typeStats = srsRecords.reduce((acc, record) => {
          const typeId = record.TypeOfLeaveID || 'unknown';
          const typeName = record.TypeOfLeave?.Title || `Type ${typeId}`;
          const key = `${typeId} (${typeName})`;
          
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        console.log('[useSRSData] SRS records by type of leave:', typeStats);

        // Логируем первые несколько записей для проверки
        srsRecords.slice(0, 3).forEach((record, index) => {
          console.log(`[useSRSData] Sample SRS record ${index + 1}:`, {
            id: record.ID,
            date: record.Date.toLocaleDateString(),
            typeOfLeaveId: record.TypeOfLeaveID,
            typeOfLeaveTitle: record.TypeOfLeave?.Title,
            leaveTime: record.LeaveTime,
            workTime: record.WorkTime
          });
        });
      }

      // Обновляем состояние с полученными SRS записями
      SRSTabStateHelpers.updateSRSRecords(setState, srsRecords);

      console.log('[useSRSData] SRS data successfully loaded and state updated');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useSRSData] Critical error loading SRS data:', error);
      
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
    console.log('[useSRSData] Manual refresh requested');
    await loadSRSData();
  }, [loadSRSData]);

  /**
   * Effect для автоматической загрузки данных при изменении зависимостей
   */
  useEffect(() => {
    console.log('[useSRSData] useEffect triggered - checking if data load is needed');
    console.log('[useSRSData] Dependencies:', {
      hasContext: !!context,
      selectedStaffEmployeeId: selectedStaff?.employeeId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      isDataValidResult: isDataValid()
    });

    if (isDataValid()) {
      console.log('[useSRSData] Data is valid, triggering load');
      void loadSRSData();
    } else {
      console.log('[useSRSData] Data is invalid, clearing SRS records');
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
      console.log('[useSRSData] No staff selected, clearing SRS data');
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