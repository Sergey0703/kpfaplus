// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { 
  IWeekInfo, 
  IWeekGroup 
} from '../interfaces/TimetableInterfaces';
import { TimetableDataProcessor } from './TimetableDataProcessor';

interface UseTimetableStaffRecordsDataProps {
  context?: WebPartContext;
  selectedDate: Date;
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  weeks: IWeekInfo[];
  staffMembers: any[]; // Из контекста
  setWeeksData: (weeksData: IWeekGroup[]) => void;
  setStaffRecords: (records: IStaffRecord[]) => void;
  setIsLoadingStaffRecords: (isLoading: boolean) => void;
  setErrorStaffRecords: (error?: string) => void;
}

interface UseTimetableStaffRecordsDataReturn {
  loadTimetableData: (overrideDate?: Date) => Promise<void>;
  refreshTimetableData: () => Promise<void>;
}

export const useTimetableStaffRecordsData = (
  props: UseTimetableStaffRecordsDataProps
): UseTimetableStaffRecordsDataReturn => {
  const {
    context,
    selectedDate,
    currentUserId,
    managingGroupId,
    staffRecordsService,
    weeks,
    staffMembers,
    // setState, // Убираем неиспользуемый параметр
    setWeeksData,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  } = props;

  console.log('[useTimetableStaffRecordsData] Hook initialized with:', {
    hasContext: !!context,
    hasStaffRecordsService: !!staffRecordsService,
    weeksCount: weeks.length,
    staffMembersCount: staffMembers.length,
    selectedDate: selectedDate.toISOString(),
    managingGroupId,
    currentUserId
  });

  const loadTimetableData = useCallback(async (overrideDate?: Date): Promise<void> => {
    const dateToUse = overrideDate || selectedDate;
    
    console.log('[useTimetableStaffRecordsData] *** loadTimetableData CALLED ***');
    console.log('[useTimetableStaffRecordsData] Parameters:', {
      date: dateToUse.toISOString(),
      weeksCount: weeks.length,
      staffMembersCount: staffMembers.length,
      managingGroupId,
      currentUserId
    });

    if (!context || !staffRecordsService) {
      console.log('[useTimetableStaffRecordsData] Cannot load records: missing context or service');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Service not available.');
      return;
    }

    if (!managingGroupId || !currentUserId) {
      console.log('[useTimetableStaffRecordsData] Cannot load records: missing managingGroupId or currentUserId');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords('Group ID or User ID not available.');
      return;
    }

    if (weeks.length === 0) {
      console.log('[useTimetableStaffRecordsData] Cannot load records: no weeks calculated');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      return;
    }

    if (staffMembers.length === 0) {
      console.log('[useTimetableStaffRecordsData] No staff members in group');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      return;
    }

    try {
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);

      // Рассчитываем диапазон дат для всех недель месяца
      const startDate = weeks[0].weekStart;
      const endDate = weeks[weeks.length - 1].weekEnd;

      console.log('[useTimetableStaffRecordsData] Loading data for date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      });

      // Загружаем записи для всей группы за весь период
      // Используем employeeID = 0 чтобы получить записи для всех сотрудников группы
      const queryParams: IStaffRecordsQueryParams = {
        startDate: startDate,
        endDate: endDate,
        currentUserID: currentUserId,
        staffGroupID: managingGroupId,
        employeeID: 0, // 0 = все сотрудники группы
        timeTableID: undefined, // Не фильтруем по контракту на уровне Timetable
        skip: 0, // Получаем все записи без пагинации
        top: 10000 // Большое число для получения всех записей
      };

      console.log('[useTimetableStaffRecordsData] Query params:', queryParams);

      const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

      console.log(`[useTimetableStaffRecordsData] *** RECEIVED RESULT ***`);
      console.log(`[useTimetableStaffRecordsData] Records: ${result.records.length}, totalCount: ${result.totalCount}`);
      
      if (result.records.length > 0) {
        console.log(`[useTimetableStaffRecordsData] Date range of loaded records:`, {
          firstRecordDate: result.records[0].Date.toLocaleDateString(),
          lastRecordDate: result.records[result.records.length - 1].Date.toLocaleDateString()
        });
      }

      // Сохраняем сырые записи
      setStaffRecords(result.records);

      // Обрабатываем данные в структуру групп недель
      const weeksData = TimetableDataProcessor.processDataByWeeks({
        staffRecords: result.records,
        staffMembers: staffMembers,
        weeks: weeks
      });

      console.log(`[useTimetableStaffRecordsData] Processed ${weeksData.length} week groups`);
      
      // Логируем статистику по неделям
      weeksData.forEach((weekGroup: IWeekGroup) => {
        const staffWithData = weekGroup.staffRows.filter((row: any) => 
          Object.values(row.weekData.days).some((day: any) => day.hasData)
        ).length;
        
        console.log(`[useTimetableStaffRecordsData] Week ${weekGroup.weekInfo.weekNum}: ${staffWithData}/${weekGroup.staffRows.length} staff have data`);
      });

      setWeeksData(weeksData);

      if (result.error) {
        setErrorStaffRecords(`Failed to load timetable data: ${result.error}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableStaffRecordsData] *** ERROR loading timetable data ***:', error);
      setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
      setStaffRecords([]);
      setWeeksData([]);
    } finally {
      setIsLoadingStaffRecords(false);
    }
  }, [
    context,
    staffRecordsService,
    selectedDate,
    currentUserId,
    managingGroupId,
    weeks,
    staffMembers,
    setStaffRecords,
    setWeeksData,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  ]);

  const refreshTimetableData = useCallback(async (): Promise<void> => {
    console.log('[useTimetableStaffRecordsData] Refreshing timetable data');
    await loadTimetableData();
  }, [loadTimetableData]);

  // Эффект для автоматической загрузки данных при изменении ключевых параметров
  useEffect(() => {
    console.log('[useTimetableStaffRecordsData] *** useEffect TRIGGERED ***');
    console.log('[useTimetableStaffRecordsData] Dependencies:', {
      hasContext: !!context,
      hasStaffRecordsService: !!staffRecordsService,
      hasManagingGroupId: !!managingGroupId,
      hasCurrentUserId: !!currentUserId,
      weeksCount: weeks.length,
      staffMembersCount: staffMembers.length,
      selectedDate: selectedDate.toISOString()
    });
    
    if (
      context && 
      staffRecordsService && 
      managingGroupId && 
      currentUserId &&
      weeks.length > 0 &&
      staffMembers.length > 0
    ) {
      console.log('[useTimetableStaffRecordsData] *** CALLING loadTimetableData from useEffect ***');
      loadTimetableData().catch(error => {
        console.error('[useTimetableStaffRecordsData] Error in useEffect loadTimetableData:', error);
      });
    } else {
      console.log('[useTimetableStaffRecordsData] *** CLEARING DATA - missing dependencies ***');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
    }
  }, [
    selectedDate,      // При смене месяца
    weeks.length,      // При пересчете недель
    staffMembers.length, // При изменении состава группы
    managingGroupId,   // При смене группы
    loadTimetableData  // Функция уже содержит остальные зависимости
  ]);

  return {
    loadTimetableData,
    refreshTimetableData
  };
};