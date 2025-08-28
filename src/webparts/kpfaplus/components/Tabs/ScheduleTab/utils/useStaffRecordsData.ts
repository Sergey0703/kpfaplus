// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { IStaffMember } from '../../../../models/types';
import { IExistingRecordCheck } from './ScheduleTabFillInterfaces';
import { IScheduleTabState } from './useScheduleTabState';
// *** ДОБАВЛЕН ИМПОРТ ФУНКЦИЙ ДЛЯ UTC DATE-ONLY СОВМЕСТИМОСТИ ***
import { formatDateForSharePoint, parseDateFromSharePoint } from './ScheduleTabDataUtils';


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
showDeleted: boolean;
}

interface UseStaffRecordsDataReturn {
loadStaffRecords: (overrideDate?: Date, contractId?: string) => void;
getExistingRecordsWithStatus: (
  startDate: Date, 
  endDate: Date, 
  employeeId: string, 
  currentUserId?: string, 
  staffGroupId?: string, 
  timeTableID?: string
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
  showDeleted,
} = props;

const setStaffRecords = useCallback((records: IStaffRecord[]) => setState(prevState => ({ ...prevState, staffRecords: records })), [setState]);
const setIsLoadingStaffRecords = useCallback((isLoading: boolean) => setState(prevState => ({ ...prevState, isLoadingStaffRecords: isLoading })), [setState]);
const setErrorStaffRecords = useCallback((error?: string) => setState(prevState => ({ ...prevState, errorStaffRecords: error })), [setState]);
const setTotalItemCount = useCallback((total: number) => setState(prevState => ({ ...prevState, totalItemCount: total })), [setState]);

// *** ИСПРАВЛЕННЫЙ МЕТОД loadStaffRecords С UTC DATE-ONLY СОВМЕСТИМОСТЬЮ ***
const loadStaffRecords = useCallback(async (overrideDate?: Date, contractId?: string): Promise<void> => {
  const dateToUse = overrideDate || selectedDate;
  const contractIdToUse = contractId !== undefined ? contractId : selectedContractId;

  console.log('[useStaffRecordsData] *** loadStaffRecords CALLED - WITH UTC DATE-ONLY COMPATIBILITY ***');
  console.log('[useStaffRecordsData] *** PAGINATION PARAMS ***');
  console.log('[useStaffRecordsData] currentPage:', currentPage);
  console.log('[useStaffRecordsData] itemsPerPage:', itemsPerPage);
  console.log('[useStaffRecordsData] showDeleted:', showDeleted);
  console.log('[useStaffRecordsData] IMPORTANT: Using formatDateForSharePoint for consistent UTC boundaries');

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

    // *** ИСПРАВЛЕНИЕ: Используем formatDateForSharePoint для создания UTC границ месяца ***
    const inputDate = dateToUse;
    
    // *** ИСПРАВЛЕНО: Создаем границы месяца используя formatDateForSharePoint ***
    const firstDayOfMonth = formatDateForSharePoint(new Date(
      inputDate.getFullYear(),
      inputDate.getMonth(),
      1
    ));
    
    const lastDayOfMonth = formatDateForSharePoint(new Date(
      inputDate.getFullYear(),
      inputDate.getMonth() + 1,
      0
    ));

    console.log('[useStaffRecordsData] *** USING formatDateForSharePoint FOR CONSISTENT UTC BOUNDARIES ***');
    console.log('[useStaffRecordsData] Input date:', inputDate.toISOString());
    console.log('[useStaffRecordsData] UTC first day of month (formatDateForSharePoint):', firstDayOfMonth.toISOString());
    console.log('[useStaffRecordsData] UTC last day of month (formatDateForSharePoint):', lastDayOfMonth.toISOString());

    // *** СПЕЦИАЛЬНАЯ ОТЛАДКА ДЛЯ ОКТЯБРЯ 2024 ***
    if (inputDate.getUTCMonth() === 9 && inputDate.getUTCFullYear() === 2024) {
      console.log('[useStaffRecordsData] *** OCTOBER 2024 DETECTED - SPECIAL DEBUG ***');
      console.log('[useStaffRecordsData] Input date details:', {
        year: inputDate.getUTCFullYear(),
        month: inputDate.getUTCMonth() + 1,
        day: inputDate.getUTCDate(),
        fullISO: inputDate.toISOString()
      });
      
      // Тестируем, попадает ли 1 октября в наш диапазон
      const testDate1Oct = new Date(Date.UTC(2024, 9, 1, 0, 0, 0, 0)); // 1 октября 2024, полночь UTC
      const testDate1OctMidday = new Date(Date.UTC(2024, 9, 1, 12, 0, 0, 0)); // 1 октября 2024, полдень UTC
      
      console.log('[useStaffRecordsData] *** OCTOBER 1st TEST WITH formatDateForSharePoint BOUNDARIES ***');
      console.log('[useStaffRecordsData] Test date (1 Oct midnight):', testDate1Oct.toISOString());
      console.log('[useStaffRecordsData] Test date (1 Oct midday):', testDate1OctMidday.toISOString());
      console.log('[useStaffRecordsData] 1 Oct midnight >= firstDayOfMonth:', testDate1Oct >= firstDayOfMonth);
      console.log('[useStaffRecordsData] 1 Oct midnight <= lastDayOfMonth:', testDate1Oct <= lastDayOfMonth);
      console.log('[useStaffRecordsData] 1 Oct midday >= firstDayOfMonth:', testDate1OctMidday >= firstDayOfMonth);
      console.log('[useStaffRecordsData] 1 Oct midday <= lastDayOfMonth:', testDate1OctMidday <= lastDayOfMonth);
    }

    const employeeId = selectedStaff.employeeId;
    const timeTableId = contractIdToUse;
    const currentUserID = currentUserId || '0';
    const staffGroupID = managingGroupId || '0';

    if (showDeleted) {
      // *** ВАРИАНТ 1: ПОКАЗЫВАЕМ ВСЕ ЗАПИСИ - СЕРВЕРНАЯ ПАГИНАЦИЯ ***
      console.log('[useStaffRecordsData] *** LOADING ALL RECORDS WITH SERVER PAGINATION ***');
      
      const skip = (currentPage - 1) * itemsPerPage;
      const top = itemsPerPage;

      const queryParams: IStaffRecordsQueryParams = {
        startDate: firstDayOfMonth,  // *** ИСПОЛЬЗУЕМ UTC ГРАНИЦЫ ИЗ formatDateForSharePoint ***
        endDate: lastDayOfMonth,     // *** ИСПОЛЬЗУЕМ UTC ГРАНИЦЫ ИЗ formatDateForSharePoint ***
        currentUserID: currentUserID,
        staffGroupID: staffGroupID,
        employeeID: employeeId,
        timeTableID: timeTableId,
        skip: skip,
        top: top,
      };

      console.log('[useStaffRecordsData] *** SERVER PAGINATION - calling getStaffRecordsWithOptions ***');
      console.log('[useStaffRecordsData] Query params with UTC dates from formatDateForSharePoint:', {
        ...queryParams,
        startDate: queryParams.startDate.toISOString(),
        endDate: queryParams.endDate.toISOString()
      });

      const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

      console.log(`[useStaffRecordsData] *** SERVER PAGINATION RESULT ***`);
      console.log(`[useStaffRecordsData] Records: ${result.records.length}, totalCount: ${result.totalCount}`);

      // *** ИСПРАВЛЕНИЕ: Нормализуем полученные даты используя parseDateFromSharePoint ***
      const normalizedRecords = result.records.map(record => ({
        ...record,
        Date: parseDateFromSharePoint(record.Date)
      }));

      console.log(`[useStaffRecordsData] *** NORMALIZED ${normalizedRecords.length} RECORD DATES USING parseDateFromSharePoint ***`);

      if (normalizedRecords.length > 0) {
        console.log(`[useStaffRecordsData] First record ID: ${normalizedRecords[0].ID}, Date: ${normalizedRecords[0].Date.toISOString()}, Deleted: ${normalizedRecords[0].Deleted}`);
        console.log(`[useStaffRecordsData] Last record ID: ${normalizedRecords[normalizedRecords.length - 1].ID}, Date: ${normalizedRecords[normalizedRecords.length - 1].Date.toISOString()}, Deleted: ${normalizedRecords[normalizedRecords.length - 1].Deleted}`);
        
        // Проверяем, есть ли записи за 1 октября после нормализации
        const oct1Records = normalizedRecords.filter(record => {
          const recordDate = record.Date; // Уже нормализована через parseDateFromSharePoint
          return recordDate.getUTCDate() === 1 && recordDate.getUTCMonth() === 9 && recordDate.getUTCFullYear() === 2024;
        });
        if (oct1Records.length > 0) {
          console.log(`[useStaffRecordsData] *** FOUND ${oct1Records.length} RECORDS FOR OCTOBER 1st AFTER parseDateFromSharePoint! ***`);
          oct1Records.forEach(record => {
            console.log(`[useStaffRecordsData] Oct 1st record: ID=${record.ID}, Date=${record.Date.toISOString()}`);
          });
        } else {
          console.log(`[useStaffRecordsData] *** NO RECORDS FOUND FOR OCTOBER 1st after parseDateFromSharePoint ***`);
        }
      }

      setStaffRecords(normalizedRecords); // *** ИСПОЛЬЗУЕМ НОРМАЛИЗОВАННЫЕ ЗАПИСИ ***
      setTotalItemCount(result.totalCount);

      if (result.error) {
        setErrorStaffRecords(`Failed to load schedule records: ${result.error}`);
      }
      } else {
      // *** ВАРИАНТ 2: ПОКАЗЫВАЕМ ТОЛЬКО АКТИВНЫЕ ЗАПИСИ - ЗАГРУЖАЕМ ВСЕ + КЛИЕНТСКАЯ ПАГИНАЦИЯ ***
      console.log('[useStaffRecordsData] *** LOADING ONLY ACTIVE RECORDS - LOAD ALL + CLIENT PAGINATION ***');
      
      // Используем метод для загрузки ВСЕХ записей без серверной пагинации
      const allRecordsQueryParams = {
        startDate: firstDayOfMonth,  // *** ИСПОЛЬЗУЕМ UTC ГРАНИЦЫ ИЗ formatDateForSharePoint ***
        endDate: lastDayOfMonth,     // *** ИСПОЛЬЗУЕМ UTC ГРАНИЦЫ ИЗ formatDateForSharePoint ***
        currentUserID: currentUserID,
        staffGroupID: staffGroupID,
        employeeID: employeeId,
        timeTableID: timeTableId
        // НЕ передаем skip и top - загружаем ВСЕ записи
      };

      console.log('[useStaffRecordsData] *** LOADING ALL RECORDS - calling getAllStaffRecordsForTimetable ***');
      console.log('[useStaffRecordsData] Query params with UTC dates from formatDateForSharePoint (no pagination):', {
        ...allRecordsQueryParams,
        startDate: allRecordsQueryParams.startDate.toISOString(),
        endDate: allRecordsQueryParams.endDate.toISOString()
      });

      const allRecordsResult: IStaffRecordsResult = await staffRecordsService.getAllStaffRecordsForTimetable(allRecordsQueryParams);

      if (allRecordsResult.error) {
        throw new Error(allRecordsResult.error);
      }

      console.log(`[useStaffRecordsData] *** ALL RECORDS LOADED ***`);
      console.log(`[useStaffRecordsData] Total records from server: ${allRecordsResult.records.length}`);

      // *** ИСПРАВЛЕНИЕ: Нормализуем ВСЕ полученные даты используя parseDateFromSharePoint ***
      const allNormalizedRecords = allRecordsResult.records.map(record => ({
        ...record,
        Date: parseDateFromSharePoint(record.Date)
      }));

      console.log(`[useStaffRecordsData] *** NORMALIZED ${allNormalizedRecords.length} RECORD DATES USING parseDateFromSharePoint ***`);

      // *** ОТЛАДКА ДЛЯ ОКТЯБРЯ: Проверяем, есть ли записи за 1 октября в общем списке после нормализации ***
      const oct1RecordsAll = allNormalizedRecords.filter(record => {
        const recordDate = record.Date; // Уже нормализована через parseDateFromSharePoint
        return recordDate.getUTCDate() === 1 && recordDate.getUTCMonth() === 9 && recordDate.getUTCFullYear() === 2024;
      });
      if (oct1RecordsAll.length > 0) {
        console.log(`[useStaffRecordsData] *** FOUND ${oct1RecordsAll.length} RECORDS FOR OCTOBER 1st in ALL records after parseDateFromSharePoint! ***`);
        oct1RecordsAll.forEach(record => {
          console.log(`[useStaffRecordsData] Oct 1st record: ID=${record.ID}, Date=${record.Date.toISOString()}, Deleted=${record.Deleted}`);
        });
      } else {
        console.log(`[useStaffRecordsData] *** NO RECORDS FOUND FOR OCTOBER 1st in ALL records after parseDateFromSharePoint ***`);
      }

      // *** КЛИЕНТСКАЯ ФИЛЬТРАЦИЯ: ТОЛЬКО АКТИВНЫЕ ЗАПИСИ ***
      const activeRecords = allNormalizedRecords.filter((record: IStaffRecord) => record.Deleted !== 1);
      console.log(`[useStaffRecordsData] *** CLIENT FILTERING ***`);
      console.log(`[useStaffRecordsData] Total records: ${allNormalizedRecords.length}`);
      console.log(`[useStaffRecordsData] Active records: ${activeRecords.length}`);
      console.log(`[useStaffRecordsData] Deleted records: ${allNormalizedRecords.length - activeRecords.length}`);

      // *** ОТЛАДКА ДЛЯ ОКТЯБРЯ: Проверяем, есть ли записи за 1 октября среди активных ***
      const oct1RecordsActive = activeRecords.filter(record => {
        const recordDate = record.Date; // Уже нормализована через parseDateFromSharePoint
        return recordDate.getUTCDate() === 1 && recordDate.getUTCMonth() === 9 && recordDate.getUTCFullYear() === 2024;
      });
      if (oct1RecordsActive.length > 0) {
        console.log(`[useStaffRecordsData] *** FOUND ${oct1RecordsActive.length} ACTIVE RECORDS FOR OCTOBER 1st after parseDateFromSharePoint! ***`);
        oct1RecordsActive.forEach(record => {
          console.log(`[useStaffRecordsData] Oct 1st active record: ID=${record.ID}, Date=${record.Date.toISOString()}`);
        });
      } else {
        console.log(`[useStaffRecordsData] *** NO ACTIVE RECORDS FOUND FOR OCTOBER 1st after parseDateFromSharePoint ***`);
      }

      // *** КЛИЕНТСКАЯ ПАГИНАЦИЯ: ПРИМЕНЯЕМ К АКТИВНЫМ ЗАПИСЯМ ***
      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = startIndex + itemsPerPage;
      const pageActiveRecords = activeRecords.slice(startIndex, endIndex);

      console.log(`[useStaffRecordsData] *** CLIENT PAGINATION ***`);
      console.log(`[useStaffRecordsData] Page ${currentPage}: records ${startIndex + 1}-${Math.min(endIndex, activeRecords.length)} of ${activeRecords.length}`);
      console.log(`[useStaffRecordsData] Records for current page: ${pageActiveRecords.length}`);

      if (pageActiveRecords.length > 0) {
        console.log(`[useStaffRecordsData] First page record ID: ${pageActiveRecords[0].ID}, Date: ${pageActiveRecords[0].Date.toISOString()}, Deleted: ${pageActiveRecords[0].Deleted}`);
        console.log(`[useStaffRecordsData] Last page record ID: ${pageActiveRecords[pageActiveRecords.length - 1].ID}, Date: ${pageActiveRecords[pageActiveRecords.length - 1].Date.toISOString()}, Deleted: ${pageActiveRecords[pageActiveRecords.length - 1].Deleted}`);
        
        // *** ФИНАЛЬНАЯ ПРОВЕРКА ДЛЯ ОКТЯБРЯ: Есть ли записи за 1 октября на текущей странице ***
        const oct1RecordsPage = pageActiveRecords.filter(record => {
          const recordDate = record.Date; // Уже нормализована через parseDateFromSharePoint
          return recordDate.getUTCDate() === 1 && recordDate.getUTCMonth() === 9 && recordDate.getUTCFullYear() === 2024;
        });
        if (oct1RecordsPage.length > 0) {
          console.log(`[useStaffRecordsData] *** SUCCESS: FOUND ${oct1RecordsPage.length} RECORDS FOR OCTOBER 1st ON CURRENT PAGE after parseDateFromSharePoint! ***`);
          oct1RecordsPage.forEach(record => {
            console.log(`[useStaffRecordsData] Oct 1st page record: ID=${record.ID}, Date=${record.Date.toISOString()}`);
          });
        } else {
          console.log(`[useStaffRecordsData] *** NO RECORDS FOR OCTOBER 1st ON CURRENT PAGE (page ${currentPage}) ***`);
        }
      }

      // *** УСТАНАВЛИВАЕМ РЕЗУЛЬТАТ ***
      setStaffRecords(pageActiveRecords);
      setTotalItemCount(activeRecords.length); // Общее количество АКТИВНЫХ записей

      console.log(`[useStaffRecordsData] *** CLIENT PAGINATION FINAL RESULT ***`);
      console.log(`[useStaffRecordsData] Set staffRecords: ${pageActiveRecords.length} records`);
      console.log(`[useStaffRecordsData] Set totalItemCount: ${activeRecords.length} (total active records)`);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[useStaffRecordsData] *** ERROR loading schedule records ***:', error);
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
  showDeleted,
  setStaffRecords,
  setIsLoadingStaffRecords,
  setErrorStaffRecords,
  setTotalItemCount,
]);

// *** ИСПРАВЛЕННЫЙ getExistingRecordsWithStatus С UTC DATE-ONLY СОВМЕСТИМОСТЬЮ ***
const getExistingRecordsWithStatus = useCallback(async (
  startDate: Date,
  endDate: Date,
  employeeId: string,
  currentUserIdParam?: string,
  staffGroupIdParam?: string,
  timeTableIDParam?: string
): Promise<IExistingRecordCheck[]> => {
  console.log('[useStaffRecordsData] *** FIXED: getExistingRecordsWithStatus WITH UTC METHODS ***');
  console.log('[useStaffRecordsData] getExistingRecordsWithStatus called with timeTableID:', timeTableIDParam);
  console.log('[useStaffRecordsData] *** CRITICAL FIX: Using UTC methods for date components ***');
  console.log('[useStaffRecordsData] Input date range:', startDate.toISOString(), '-', endDate.toISOString());
  
  if (!context || !staffRecordsService) {
    console.log('[useStaffRecordsData] Cannot get existing records: missing dependencies');
    return [];
  }

  const currentUserID = currentUserIdParam || currentUserId || '0';
  const staffGroupID = staffGroupIdParam || managingGroupId || '0';
  const timeTableID = timeTableIDParam || selectedContractId;

  try {
    console.log('[useStaffRecordsData] *** Starting to collect ALL pages for existing records ***');
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Используем UTC методы для извлечения компонентов даты ***
    // Входные даты приходят из fillScheduleFromTemplate в UTC формате
    const normalizedStartDate = formatDateForSharePoint(new Date(
      startDate.getUTCFullYear(),   // *** ИСПРАВЛЕНО: UTC метод вместо локального ***
      startDate.getUTCMonth(),      // *** ИСПРАВЛЕНО: UTC метод вместо локального ***
      startDate.getUTCDate()        // *** ИСПРАВЛЕНО: UTC метод вместо локального ***
    ));
    
    const normalizedEndDate = formatDateForSharePoint(new Date(
      endDate.getUTCFullYear(),     // *** ИСПРАВЛЕНО: UTC метод вместо локального ***
      endDate.getUTCMonth(),        // *** ИСПРАВЛЕНО: UTC метод вместо локального ***
      endDate.getUTCDate()          // *** ИСПРАВЛЕНО: UTC метод вместо локального ***
    ));
    
    console.log('[useStaffRecordsData] *** FIXED: NORMALIZED DATES USING UTC METHODS ***');
    console.log('[useStaffRecordsData] Original start date:', startDate.toISOString());
    console.log('[useStaffRecordsData] Original end date:', endDate.toISOString());
    console.log('[useStaffRecordsData] *** startDate UTC components ***:', {
      year: startDate.getUTCFullYear(),
      month: startDate.getUTCMonth(),
      date: startDate.getUTCDate()
    });
    console.log('[useStaffRecordsData] *** endDate UTC components ***:', {
      year: endDate.getUTCFullYear(),
      month: endDate.getUTCMonth(),
      date: endDate.getUTCDate()
    });
    console.log('[useStaffRecordsData] Normalized start date (UTC components + formatDateForSharePoint):', normalizedStartDate.toISOString());
    console.log('[useStaffRecordsData] Normalized end date (UTC components + formatDateForSharePoint):', normalizedEndDate.toISOString());

    // *** СПЕЦИАЛЬНАЯ ОТЛАДКА ДЛЯ ИЮНЯ-ИЮЛЯ TIMEZONE ПРОБЛЕМЫ ***
    if (startDate.getUTCMonth() === 5 || endDate.getUTCMonth() === 5) { // Июнь = месяц 5
      console.log('[useStaffRecordsData] *** JUNE DETECTED - TIMEZONE DEBUG ***');
      console.log('[useStaffRecordsData] *** BEFORE FIX (would use local methods) ***');
      console.log('[useStaffRecordsData] startDate.getFullYear():', startDate.getFullYear(), 'vs getUTCFullYear():', startDate.getUTCFullYear());
      console.log('[useStaffRecordsData] startDate.getMonth():', startDate.getMonth(), 'vs getUTCMonth():', startDate.getUTCMonth());
      console.log('[useStaffRecordsData] startDate.getDate():', startDate.getDate(), 'vs getUTCDate():', startDate.getUTCDate());
      console.log('[useStaffRecordsData] endDate.getFullYear():', endDate.getFullYear(), 'vs getUTCFullYear():', endDate.getUTCFullYear());
      console.log('[useStaffRecordsData] endDate.getMonth():', endDate.getMonth(), 'vs getUTCMonth():', endDate.getUTCMonth());
      console.log('[useStaffRecordsData] endDate.getDate():', endDate.getDate(), 'vs getUTCDate():', endDate.getUTCDate());
      console.log('[useStaffRecordsData] *** AFTER FIX (using UTC methods) ***');
      console.log('[useStaffRecordsData] This should prevent June -> July shift!');
    }

    // Base query parameters (without pagination) - используем нормализованные даты с UTC компонентами
    const baseQueryParams = {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      currentUserID: currentUserID,
      staffGroupID: staffGroupID,
      employeeID: employeeId,
      timeTableID: timeTableID
    };

    console.log('[useStaffRecordsData] Base query params for all pages (UTC normalized):', {
      ...baseQueryParams,
      startDate: baseQueryParams.startDate.toISOString(),
      endDate: baseQueryParams.endDate.toISOString()
    });

    // *** PAGINATION LOOP TO GET ALL RECORDS ***
    const allRecords: IStaffRecord[] = [];
    let currentSkip = 0;
    const pageSize = 60; // Use the standard page size
    let hasMoreData = true;
    let pageNumber = 1;

    while (hasMoreData) {
      console.log(`[useStaffRecordsData] *** Fetching page ${pageNumber} (skip: ${currentSkip}, top: ${pageSize}) ***`);
      
      const queryParams: IStaffRecordsQueryParams = {
        ...baseQueryParams,
        skip: currentSkip,
        top: pageSize
      };

      const result = await staffRecordsService.getStaffRecordsWithOptions(queryParams);
      
      console.log(`[useStaffRecordsData] Page ${pageNumber} result: ${result.records.length} records, total available: ${result.totalCount}`);

      // *** ИСПРАВЛЕНИЕ: Нормализуем даты в полученных записях ***
      const normalizedPageRecords = result.records.map(record => ({
        ...record,
        Date: parseDateFromSharePoint(record.Date)
      }));

      // Add normalized records from this page to our collection
      allRecords.push(...normalizedPageRecords);

      // Check if we need to fetch more pages
      const recordsRetrievedSoFar = allRecords.length;
      hasMoreData = result.records.length === pageSize && recordsRetrievedSoFar < result.totalCount;
      
      if (hasMoreData) {
        currentSkip += pageSize;
        pageNumber++;
        console.log(`[useStaffRecordsData] More data available. Moving to page ${pageNumber} (skip: ${currentSkip})`);
      } else {
        console.log(`[useStaffRecordsData] *** Pagination complete. Retrieved ${recordsRetrievedSoFar} total records with parseDateFromSharePoint normalization ***`);
      }

      // Safety check to prevent infinite loops
      if (pageNumber > 20) {
        console.error('[useStaffRecordsData] Safety break: Too many pages (>20). Stopping pagination.');
        break;
      }
    }

    console.log(`[useStaffRecordsData] *** FINAL RESULT: Collected ${allRecords.length} records across ${pageNumber} pages ***`);

    // *** FILTER OUT ALREADY DELETED RECORDS ***
    const activeRecords = allRecords.filter((record: IStaffRecord) => {
      const isDeleted = record.Deleted === 1;
      if (isDeleted) {
        console.log(`[useStaffRecordsData] Skipping already deleted record: ID=${record.ID}, Date=${record.Date.toLocaleDateString()}`);
      }
      return !isDeleted; // Only include records that are NOT deleted
    });

    console.log(`[useStaffRecordsData] *** FILTERED RESULTS: ${allRecords.length} total -> ${activeRecords.length} active (non-deleted) records ***`);

    // Convert ONLY active records to IExistingRecordCheck format
    const existingRecordsCheck: IExistingRecordCheck[] = activeRecords.map((record: IStaffRecord) => ({
      id: record.ID,
      checked: record.Checked || 0,
      exportResult: record.ExportResult || 0,
      date: record.Date, // Уже нормализована через parseDateFromSharePoint
      title: record.Title
    }));

    console.log(`[useStaffRecordsData] *** FIXED: Converted ${activeRecords.length} active records to IExistingRecordCheck format with UTC-based normalization ***`);
    
    // Log some sample records for verification
    if (existingRecordsCheck.length > 0) {
      console.log('[useStaffRecordsData] Sample records (first 3):');
      existingRecordsCheck.slice(0, 3).forEach((record, index) => {
        console.log(`  ${index + 1}. ID: ${record.id}, Date: ${record.date.toLocaleDateString()}, Checked: ${record.checked}, Export: ${record.exportResult}`);
      });
    }

    // *** СПЕЦИАЛЬНАЯ ПРОВЕРКА ДЛЯ ИЮНЯ ***
    const juneRecords = existingRecordsCheck.filter(record => record.date.getUTCMonth() === 5); // Июнь = месяц 5
    const julyRecords = existingRecordsCheck.filter(record => record.date.getUTCMonth() === 6); // Июль = месяц 6
    
    if (juneRecords.length > 0 || julyRecords.length > 0) {
      console.log(`[useStaffRecordsData] *** TIMEZONE FIX VERIFICATION ***`);
      console.log(`[useStaffRecordsData] June records found: ${juneRecords.length}`);
      console.log(`[useStaffRecordsData] July records found: ${julyRecords.length}`);
      console.log(`[useStaffRecordsData] If you were querying June period, you should see June records, NOT July!`);
    }

    return existingRecordsCheck;

  } catch (error) {
    console.error('[useStaffRecordsData] Error getting existing records with pagination:', error);
    return [];
  }
}, [context, staffRecordsService, currentUserId, managingGroupId, selectedContractId]);

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

useEffect(() => {
 console.log('[useStaffRecordsData] *** useEffect TRIGGERED ***');
 console.log('[useStaffRecordsData] currentPage changed to:', currentPage);
 console.log('[useStaffRecordsData] Dependencies:', {
   hasContext: !!context,
   hasStaffRecordsService: !!staffRecordsService,
   hasSelectedStaffEmployeeId: !!selectedStaff?.employeeId,
   currentPage,
   itemsPerPage,
   showDeleted,
   selectedDate: selectedDate.toISOString()
 });
 
 if (context && staffRecordsService && selectedStaff?.employeeId) {
   console.log('[useStaffRecordsData] *** CALLING loadStaffRecords from useEffect ***');
   void loadStaffRecords();
 } else {
   console.log('[useStaffRecordsData] *** CLEARING DATA - missing dependencies ***');
   setStaffRecords([]);
   setIsLoadingStaffRecords(false);
   setErrorStaffRecords(undefined);
   setTotalItemCount(0);
 }
}, [
 currentPage,
 itemsPerPage,
 selectedStaff?.employeeId,
 selectedContractId,
 showDeleted,
 loadStaffRecords
]);

return {
  loadStaffRecords,
  getExistingRecordsWithStatus,
  markRecordsAsDeleted,
};
}