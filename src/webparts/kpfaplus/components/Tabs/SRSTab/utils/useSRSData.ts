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
 showDeleted: boolean; // Флаг отображения удаленных записей
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
* ОБНОВЛЕНО: Использует Date-only формат для поля Date, убрана поддержка ShiftDate1-4
*/
export const useSRSData = (props: UseSRSDataProps): UseSRSDataReturn => {
 const {
   context,
   selectedStaff,
   currentUserId,
   managingGroupId,
   fromDate,
   toDate,
   showDeleted,
   setState
 } = props;

 console.log('[useSRSData] Hook initialized with Date-only format and showDeleted support:', {
   hasContext: !!context,
   hasSelectedStaff: !!selectedStaff,
   selectedStaffId: selectedStaff?.id,
   selectedStaffEmployeeId: selectedStaff?.employeeId,
   currentUserId,
   managingGroupId,
   fromDate: fromDate.toISOString(),
   toDate: toDate.toISOString(),
   daysInRange: SRSDateUtils.calculateDaysInRange(fromDate, toDate),
   showDeleted: showDeleted,
   showDeletedSupport: true,
   dateOnlyFormat: true, // НОВОЕ: Поле Date теперь Date-only
   noShiftDateFields: true // НОВОЕ: ShiftDate1-4 больше не используются
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
  * ОБНОВЛЕНО: Основная функция загрузки SRS данных с Date-only форматом
  * Использует те же методы сервиса что и Schedule Tab
  */
 const loadSRSData = useCallback(async (): Promise<void> => {
   console.log('[useSRSData] *** loadSRSData called - USING Date-only format ***');
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
     console.log('[useSRSData] Starting SRS data load with Date-only format...');

     // Получаем экземпляр сервиса
     const staffRecordsService = StaffRecordsService.getInstance(context!);
     
     // *** ОБНОВЛЕНО: Создаем границы дат для SharePoint Date-only полей ***
     const dateBounds = SRSDateUtils.createSharePointDateRangeBounds(fromDate, toDate);
     
     console.log('[useSRSData] *** USING Date-only format boundaries ***');
     console.log('[useSRSData] Original fromDate:', fromDate.toLocaleDateString());
     console.log('[useSRSData] Original toDate:', toDate.toLocaleDateString());
     console.log('[useSRSData] SharePoint startBound (Date-only):', dateBounds.startBound.toISOString());
     console.log('[useSRSData] SharePoint endBound (Date-only):', dateBounds.endBound.toISOString());
     console.log('[useSRSData] Formatted for SharePoint:', {
       start: dateBounds.startBoundFormatted,
       end: dateBounds.endBoundFormatted
     });

     console.log('[useSRSData] Loading SRS data with Date-only parameters:', {
       staffEmployeeId: selectedStaff.employeeId,
       staffName: selectedStaff.name,
       startBound: dateBounds.startBound.toISOString(),
       endBound: dateBounds.endBound.toISOString(),
       dateRangeInDays: SRSDateUtils.calculateDaysInRange(fromDate, toDate),
       currentUserId,
       managingGroupId,
       showDeleted: showDeleted,
       dateFormat: 'Date-only (no time component)',
       method: 'Schedule Tab compatible methods with Date-only support'
     });

     let allRecords: IStaffRecord[] = [];

     if (showDeleted) {
       // *** ВАРИАНТ 1: ПОКАЗЫВАЕМ ВСЕ ЗАПИСИ - КАК В SCHEDULE TAB ***
       console.log('[useSRSData] *** LOADING ALL RECORDS (INCLUDING DELETED) with Date-only ***');
       
       const queryParams: IStaffRecordsQueryParams = {
         startDate: dateBounds.startBound, // Используем Date-only границы
         endDate: dateBounds.endBound,     // Используем Date-only границы
         currentUserID: currentUserId,
         staffGroupID: managingGroupId,
         employeeID: selectedStaff.employeeId,
         timeTableID: undefined, // SRS не привязан к конкретному timetable
         skip: 0,
         top: 5000 // Большое число для получения всех записей за период
       };

       console.log('[useSRSData] Using getStaffRecordsWithOptions for all records (Date-only)');
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
       
       console.log('[useSRSData] *** ALL RECORDS LOADED (INCLUDING DELETED) with Date-only ***');
       console.log('[useSRSData] Total records from server:', allRecords.length);
       
     } else {
       // *** ВАРИАНТ 2: ПОКАЗЫВАЕМ ТОЛЬКО АКТИВНЫЕ ЗАПИСИ - КАК В SCHEDULE TAB ***
       console.log('[useSRSData] *** LOADING ONLY ACTIVE RECORDS with Date-only ***');
       
       const allRecordsQueryParams = {
         startDate: dateBounds.startBound, // Используем Date-only границы
         endDate: dateBounds.endBound,     // Используем Date-only границы
         currentUserID: currentUserId,
         staffGroupID: managingGroupId,
         employeeID: selectedStaff.employeeId,
         timeTableID: undefined // SRS не привязан к конкретному timetable
       };

       console.log('[useSRSData] Using getAllStaffRecordsForTimetable + client filtering (Date-only)');
       console.log('[useSRSData] Query params:', {
         ...allRecordsQueryParams,
         startDate: allRecordsQueryParams.startDate.toISOString(),
         endDate: allRecordsQueryParams.endDate.toISOString()
       });

       const allRecordsResult: IStaffRecordsResult = await staffRecordsService.getAllStaffRecordsForTimetable(allRecordsQueryParams);

       if (allRecordsResult.error) {
         throw new Error(allRecordsResult.error);
       }

       console.log('[useSRSData] *** ALL RECORDS LOADED with Date-only ***');
       console.log('[useSRSData] Total records from server:', allRecordsResult.records.length);

       // *** КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ: ТОЛЬКО АКТИВНЫЕ ЗАПИСИ ***
       allRecords = allRecordsResult.records.filter((record: IStaffRecord) => record.Deleted !== 1);
       
       console.log('[useSRSData] *** CLIENT FILTERING with Date-only ***');
       console.log('[useSRSData] Total records:', allRecordsResult.records.length);
       console.log('[useSRSData] Active records:', allRecords.length);
       console.log('[useSRSData] Deleted records:', allRecordsResult.records.length - allRecords.length);
     }

     // Фильтруем записи в ТОЧНОМ диапазоне дат пользователя (с Date-only форматом)
     const filteredRecords = allRecords.filter((record: IStaffRecord) => {
       const recordInRange = SRSDateUtils.isDateInRange(record.Date, fromDate, toDate);
       
       if (!recordInRange) {
         console.log(`[useSRSData] Record ${record.ID} (${SRSDateUtils.formatDateForDisplay(record.Date)}) is outside user-selected date range, filtering out`);
       }
       
       return recordInRange;
     });

     console.log('[useSRSData] After EXACT date range filtering with Date-only:', {
       originalCount: allRecords.length,
       filteredCount: filteredRecords.length,
       userSelectedRange: `${SRSDateUtils.formatDateForDisplay(fromDate)} - ${SRSDateUtils.formatDateForDisplay(toDate)}`,
       showDeleted: showDeleted,
       dateFormat: 'Date-only (no time component)'
     });

     // Логируем статистику по типам записей (с Date-only информацией)
     if (filteredRecords.length > 0) {
       const recordTypes = filteredRecords.reduce((acc: Record<string, number>, record: IStaffRecord) => {
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

       console.log('[useSRSData] Records by type and deletion status (Date-only):', recordTypes);

       // *** ПОДРОБНАЯ СТАТИСТИКА УДАЛЕННЫХ ЗАПИСЕЙ с Date-only ***
       const deletedCount = filteredRecords.filter((record: IStaffRecord) => record.Deleted === 1).length;
       const activeCount = filteredRecords.length - deletedCount;
       
       console.log('[useSRSData] *** DELETION STATUS STATISTICS (Date-only) ***:', {
         totalRecords: filteredRecords.length,
         activeRecords: activeCount,
         deletedRecords: deletedCount,
         showDeleted: showDeleted,
         deletedPercentage: filteredRecords.length > 0 ? Math.round((deletedCount / filteredRecords.length) * 100) : 0,
         dateFormat: 'Date-only fields'
       });

       // Логируем первые несколько записей для проверки Date-only формата
       filteredRecords.slice(0, 5).forEach((record: IStaffRecord, index: number) => {
         const hasTypeOfLeave = !!(record.TypeOfLeaveID && record.TypeOfLeaveID !== '' && record.TypeOfLeaveID !== '0');
         const isDeleted = record.Deleted === 1;
         
         console.log(`[useSRSData] Sample record ${index + 1} (Date-only format):`, {
           id: record.ID,
           date: SRSDateUtils.formatDateForDisplay(record.Date),
           dateISO: record.Date.toISOString(),
           typeOfLeaveId: record.TypeOfLeaveID || 'No leave type',
           typeOfLeaveTitle: (record.TypeOfLeave as { Title?: string } | undefined)?.Title || 'Regular work day',
           leaveTime: record.LeaveTime,
           workTime: record.WorkTime,
           isRegularWork: !hasTypeOfLeave,
           isDeleted: isDeleted,
           status: isDeleted ? 'DELETED' : 'ACTIVE',
           dateFieldFormat: 'Date-only (no time component)',
           // Проверяем что ShiftDate поля больше не используются
           noShiftDateFields: 'ShiftDate1-4 fields no longer used'
         });
       });
     }

     // Обновляем состояние с записями
     SRSTabStateHelpers.updateSRSRecords(setState, filteredRecords);

     console.log('[useSRSData] SRS data successfully loaded with Date-only format and state updated');

   } catch (error) {
     const errorMessage = error instanceof Error ? error.message : String(error);
     console.error('[useSRSData] Critical error loading SRS data with Date-only format:', error);
     
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
   showDeleted,
   setState,
   isDataValid
 ]);

 /**
  * Функция для принудительного обновления SRS данных
  * Алиас для loadSRSData с дополнительным логированием
  */
 const refreshSRSData = useCallback(async (): Promise<void> => {
   console.log('[useSRSData] Manual refresh requested with Date-only format and current showDeleted filter');
   console.log('[useSRSData] Current showDeleted value:', showDeleted);
   console.log('[useSRSData] Date format: Date-only (no time component)');
   await loadSRSData();
 }, [loadSRSData, showDeleted]);

 /**
  * Effect для автоматической загрузки данных при изменении зависимостей
  * ОБНОВЛЕНО: Добавлена зависимость от showDeleted
  */
 useEffect(() => {
   console.log('[useSRSData] useEffect triggered - checking if data load is needed (Date-only format)');
   console.log('[useSRSData] Dependencies:', {
     hasContext: !!context,
     selectedStaffEmployeeId: selectedStaff?.employeeId,
     fromDate: fromDate.toLocaleDateString(),
     toDate: toDate.toLocaleDateString(),
     fromDateISO: fromDate.toISOString(),
     toDateISO: toDate.toISOString(),
     showDeleted: showDeleted,
     isDataValidResult: isDataValid(),
     dateFormat: 'Date-only fields',
     noShiftDateSupport: true
   });

   if (isDataValid()) {
     console.log('[useSRSData] Data is valid, triggering load with Date-only format and current showDeleted filter');
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
   showDeleted, // При изменении showDeleted перезагружаем данные
   isDataValid,
   loadSRSData,
   setState
 ]);

 /**
  * Effect для очистки данных при смене сотрудника
  */
 useEffect(() => {
   console.log('[useSRSData] Staff member changed, clearing state (Date-only format)');
   
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