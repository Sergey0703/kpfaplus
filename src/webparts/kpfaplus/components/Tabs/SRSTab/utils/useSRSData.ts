// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useSRSData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { IStaffMember } from '../../../../models/types';
import { ISRSTabState, SRSTabStateHelpers } from './useSRSTabState';
import { SRSDateUtils } from './SRSDateUtils';

/**
* Интерфейс для параметров хука useSRSData
* ОБНОВЛЕНО: Добавлен параметр showDeleted по аналогии с Schedule Tab
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
* ИСПРАВЛЕНО: Использует те же методы сервиса что и Schedule Tab
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

 console.log('[useSRSData] Hook initialized with showDeleted support:', {
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
  * Использует те же методы сервиса что и Schedule Tab
  */
 const loadSRSData = useCallback(async (): Promise<void> => {
   console.log('[useSRSData] *** loadSRSData called - USING SCHEDULE TAB METHODS ***');
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
     console.log('[useSRSData] Starting SRS data load with Schedule Tab methods...');

     // Получаем экземпляр сервиса
     const staffRecordsService = StaffRecordsService.getInstance(context!);
     
     // *** ИСПРАВЛЕНИЕ: Создаем UTC границы дат как в Schedule Tab ***
     const normalizedFromDate = new Date(Date.UTC(
       fromDate.getUTCFullYear(),
       fromDate.getUTCMonth(),
       fromDate.getUTCDate(),
       0, 0, 0, 0
     ));
     
     const normalizedToDate = new Date(Date.UTC(
       toDate.getUTCFullYear(),
       toDate.getUTCMonth(),
       toDate.getUTCDate(),
       23, 59, 59, 999
     ));
     
     console.log('[useSRSData] *** USING UTC DATE BOUNDARIES ***');
     console.log('[useSRSData] Original fromDate:', fromDate.toISOString());
     console.log('[useSRSData] Original toDate:', toDate.toISOString());
     console.log('[useSRSData] Normalized fromDate (UTC):', normalizedFromDate.toISOString());
     console.log('[useSRSData] Normalized toDate (UTC):', normalizedToDate.toISOString());

     console.log('[useSRSData] Loading SRS data with parameters:', {
       staffEmployeeId: selectedStaff.employeeId,
       staffName: selectedStaff.name,
       normalizedFromDate: normalizedFromDate.toISOString(),
       normalizedToDate: normalizedToDate.toISOString(),
       dateRangeInDays: SRSDateUtils.calculateDaysInRange(normalizedFromDate, normalizedToDate),
       currentUserId,
       managingGroupId,
       showDeleted: showDeleted, // *** НОВОЕ ***
       method: 'Schedule Tab compatible methods'
     });

     let allRecords: IStaffRecord[] = [];

     if (showDeleted) {
       // *** ВАРИАНТ 1: ПОКАЗЫВАЕМ ВСЕ ЗАПИСИ - КАК В SCHEDULE TAB ***
       console.log('[useSRSData] *** LOADING ALL RECORDS (INCLUDING DELETED) ***');
       
       const queryParams: IStaffRecordsQueryParams = {
         startDate: normalizedFromDate,
         endDate: normalizedToDate,
         currentUserID: currentUserId,
         staffGroupID: managingGroupId,
         employeeID: selectedStaff.employeeId,
         timeTableID: undefined, // SRS не привязан к конкретному timetable
         skip: 0,
         top: 5000 // Большое число для получения всех записей за период
       };

       console.log('[useSRSData] Using getStaffRecordsWithOptions for all records');
       console.log('[useSRSData] Query params:', {
         ...queryParams,
         startDate: queryParams.startDate.toISOString(),
         endDate: queryParams.endDate.toISOString()
       });

       const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams);
       
       if (result.error) {
         throw new Error(result.error);
       }
       
       allRecords = result.records;
       
       console.log('[useSRSData] *** ALL RECORDS LOADED (INCLUDING DELETED) ***');
       console.log('[useSRSData] Total records from server:', allRecords.length);
       
     } else {
       // *** ВАРИАНТ 2: ПОКАЗЫВАЕМ ТОЛЬКО АКТИВНЫЕ ЗАПИСИ - КАК В SCHEDULE TAB ***
       console.log('[useSRSData] *** LOADING ONLY ACTIVE RECORDS ***');
       
       const allRecordsQueryParams = {
         startDate: normalizedFromDate,
         endDate: normalizedToDate,
         currentUserID: currentUserId,
         staffGroupID: managingGroupId,
         employeeID: selectedStaff.employeeId,
         timeTableID: undefined // SRS не привязан к конкретному timetable
       };

       console.log('[useSRSData] Using getAllStaffRecordsForTimetable + client filtering');
       console.log('[useSRSData] Query params:', {
         ...allRecordsQueryParams,
         startDate: allRecordsQueryParams.startDate.toISOString(),
         endDate: allRecordsQueryParams.endDate.toISOString()
       });

       const allRecordsResult: IStaffRecordsResult = await staffRecordsService.getAllStaffRecordsForTimetable(allRecordsQueryParams);

       if (allRecordsResult.error) {
         throw new Error(allRecordsResult.error);
       }

       console.log('[useSRSData] *** ALL RECORDS LOADED ***');
       console.log('[useSRSData] Total records from server:', allRecordsResult.records.length);

       // *** КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ: ТОЛЬКО АКТИВНЫЕ ЗАПИСИ ***
       allRecords = allRecordsResult.records.filter((record: IStaffRecord) => record.Deleted !== 1);
       
       console.log('[useSRSData] *** CLIENT FILTERING ***');
       console.log('[useSRSData] Total records:', allRecordsResult.records.length);
       console.log('[useSRSData] Active records:', allRecords.length);
       console.log('[useSRSData] Deleted records:', allRecordsResult.records.length - allRecords.length);
     }

     // Фильтруем записи в ТОЧНОМ диапазоне дат пользователя
     const filteredRecords = allRecords.filter((record: any) => {
       const recordInRange = SRSDateUtils.isDateInRange(record.Date, normalizedFromDate, normalizedToDate);
       
       if (!recordInRange) {
         console.log(`[useSRSData] Record ${record.ID} (${record.Date.toLocaleDateString()}) is outside user-selected date range, filtering out`);
       }
       
       return recordInRange;
     });

     console.log('[useSRSData] After EXACT date range filtering:', {
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

       console.log('[useSRSData] Records by type and deletion status:', recordTypes);

       // *** ПОДРОБНАЯ СТАТИСТИКА УДАЛЕННЫХ ЗАПИСЕЙ ***
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
           isDeleted: isDeleted,
           status: isDeleted ? 'DELETED' : 'ACTIVE'
         });
       });
     }

     // Обновляем состояние с записями
     SRSTabStateHelpers.updateSRSRecords(setState, filteredRecords);

     console.log('[useSRSData] SRS data successfully loaded and state updated using Schedule Tab methods');

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
   showDeleted, // *** НОВАЯ ЗАВИСИМОСТЬ ***
   setState,
   isDataValid
 ]);

 /**
  * Функция для принудительного обновления SRS данных
  * Алиас для loadSRSData с дополнительным логированием
  */
 const refreshSRSData = useCallback(async (): Promise<void> => {
   console.log('[useSRSData] Manual refresh requested with current showDeleted filter');
   console.log('[useSRSData] Current showDeleted value:', showDeleted);
   await loadSRSData();
 }, [loadSRSData, showDeleted]);

 /**
  * Effect для автоматической загрузки данных при изменении зависимостей
  * ОБНОВЛЕНО: Добавлена зависимость от showDeleted
  */
 useEffect(() => {
   console.log('[useSRSData] useEffect triggered - checking if data load is needed');
   console.log('[useSRSData] Dependencies:', {
     hasContext: !!context,
     selectedStaffEmployeeId: selectedStaff?.employeeId,
     fromDate: fromDate.toISOString(),
     toDate: toDate.toISOString(),
     showDeleted: showDeleted, // *** НОВОЕ ***
     isDataValidResult: isDataValid()
   });

   if (isDataValid()) {
     console.log('[useSRSData] Data is valid, triggering load with current showDeleted filter');
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