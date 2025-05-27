// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsData.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffRecordsResult, IStaffRecordsQueryParams } from '../../../../services/StaffRecordsInterfaces';
import { 
  IWeekInfo, 
  IWeekGroup,
  IStaffMember, // FIXED: Added proper import
  ITimetableStaffRow, // FIXED: Added missing import
  IDayInfo // FIXED: Added missing import
} from '../interfaces/TimetableInterfaces';
import { TimetableDataProcessor } from './TimetableDataProcessor';

interface UseTimetableStaffRecordsDataProps {
  context?: WebPartContext;
  selectedDate: Date;
  currentUserId?: string;
  managingGroupId?: string;
  staffRecordsService?: StaffRecordsService;
  weeks: IWeekInfo[];
  staffMembers: IStaffMember[]; // FIXED: заменили 'any[]' на 'IStaffMember[]'
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

      // ИСПРАВЛЕНИЕ: Используем диапазон выбранного месяца, а не недель
      const startDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1);
      const endDate = new Date(dateToUse.getFullYear(), dateToUse.getMonth() + 1, 0);

      console.log('[useTimetableStaffRecordsData] Loading data for date range:', {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      });

      // Фильтруем только активных сотрудников (не удаленных)
      const activeStaffMembers = staffMembers.filter(staffMember => {
        const isDeleted = staffMember.deleted === 1;
        const hasEmployeeId = staffMember.employeeId && staffMember.employeeId !== '0';
        
        if (isDeleted) {
          console.log(`[useTimetableStaffRecordsData] Excluding deleted staff: ${staffMember.name}`);
          return false;
        }
        
        if (!hasEmployeeId) {
          console.log(`[useTimetableStaffRecordsData] Excluding staff without employeeId: ${staffMember.name}`);
          return false;
        }
        
        return true;
      });

      console.log(`[useTimetableStaffRecordsData] Active staff members with employeeId: ${activeStaffMembers.length}/${staffMembers.length}`);

      if (activeStaffMembers.length === 0) {
        console.log('[useTimetableStaffRecordsData] No active staff members with employeeId found');
        setStaffRecords([]);
        setWeeksData([]);
        setIsLoadingStaffRecords(false);
        return;
      }

      // Логируем информацию о сотрудниках для отладки
      console.log('[useTimetableStaffRecordsData] Staff members to process:');
      activeStaffMembers.forEach((staff, index) => {
        console.log(`[useTimetableStaffRecordsData] Staff ${index + 1}:`, {
          name: staff.name,
          id: staff.id,
          employeeId: staff.employeeId,
          employeeIdType: typeof staff.employeeId
        });
      });

      // *** НОВЫЙ ПОДХОД: Отдельный запрос для каждого сотрудника ***
      const allStaffRecords: IStaffRecord[] = [];
      let successfulRequests = 0;
      let failedRequests = 0;

      console.log(`[useTimetableStaffRecordsData] *** STARTING INDIVIDUAL REQUESTS FOR ${activeStaffMembers.length} STAFF MEMBERS ***`);

      // Делаем запросы для каждого сотрудника
      for (const staffMember of activeStaffMembers) {
        try {
          console.log(`[useTimetableStaffRecordsData] Loading records for: ${staffMember.name} (employeeId: ${staffMember.employeeId})`);

          const queryParams: IStaffRecordsQueryParams = {
            startDate: startDate,
            endDate: endDate,
            currentUserID: currentUserId,           // *** ФИЛЬТР ПО МЕНЕДЖЕРУ ***
            staffGroupID: managingGroupId,          // *** ФИЛЬТР ПО ГРУППЕ ***
            employeeID: staffMember.employeeId || '', // FIXED: Handle undefined case
            timeTableID: undefined,                 // Не фильтруем по контракту
            skip: 0,
            top: 5000 // Достаточно для одного сотрудника
          };

          console.log(`[useTimetableStaffRecordsData] Query params for ${staffMember.name}:`, queryParams);

          const result: IStaffRecordsResult = await staffRecordsService.getStaffRecordsWithOptions(queryParams);

          console.log(`[useTimetableStaffRecordsData] Result for ${staffMember.name}:`, {
            recordsCount: result.records.length,
            totalCount: result.totalCount,
            hasError: !!result.error
          });

          if (result.error) {
            console.error(`[useTimetableStaffRecordsData] Error for ${staffMember.name}: ${result.error}`);
            failedRequests++;
          } else {
            // Добавляем записи к общему списку
            allStaffRecords.push(...result.records);
            successfulRequests++;
            
            // Логируем примеры записей для первых нескольких сотрудников
            if (successfulRequests <= 3 && result.records.length > 0) {
              console.log(`[useTimetableStaffRecordsData] Sample records for ${staffMember.name}:`, 
                result.records.slice(0, 2).map(r => ({
                  ID: r.ID,
                  Date: r.Date.toLocaleDateString(),
                  Title: r.Title,
                  StaffMemberLookupId: r.StaffMemberLookupId,
                  WeeklyTimeTableID: r.WeeklyTimeTableID,
                  ShiftDate1: r.ShiftDate1?.toLocaleTimeString(),
                  ShiftDate2: r.ShiftDate2?.toLocaleTimeString()
                }))
              );
            }
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`[useTimetableStaffRecordsData] Exception loading records for ${staffMember.name}:`, errorMessage);
          failedRequests++;
        }
      }

      console.log(`[useTimetableStaffRecordsData] *** REQUESTS COMPLETED ***`);
      console.log(`[useTimetableStaffRecordsData] Summary:`, {
        totalStaff: activeStaffMembers.length,
        successfulRequests,
        failedRequests,
        totalRecordsLoaded: allStaffRecords.length
      });

      // Анализируем полученные записи
      if (allStaffRecords.length > 0) {
        const dateRange = {
          start: Math.min(...allStaffRecords.map(r => r.Date.getTime())),
          end: Math.max(...allStaffRecords.map(r => r.Date.getTime()))
        };
        
        console.log(`[useTimetableStaffRecordsData] Loaded records date range:`, {
          firstRecordDate: new Date(dateRange.start).toLocaleDateString(),
          lastRecordDate: new Date(dateRange.end).toLocaleDateString(),
          totalRecords: allStaffRecords.length
        });

        // Анализируем распределение записей по сотрудникам
        const recordsByStaff: Record<string, number> = {};
        allStaffRecords.forEach(record => {
          const key = record.StaffMemberLookupId?.toString() || record.Title || 'Unknown';
          recordsByStaff[key] = (recordsByStaff[key] || 0) + 1;
        });
        
        console.log('[useTimetableStaffRecordsData] Records distribution by staff:', recordsByStaff);

        // *** ДОПОЛНИТЕЛЬНАЯ ОТЛАДКА: Анализируем структуру записей ***
        console.log('[useTimetableStaffRecordsData] *** RECORDS STRUCTURE ANALYSIS ***');
        if (allStaffRecords.length > 0) {
          const sampleRecord = allStaffRecords[0];
          console.log('[useTimetableStaffRecordsData] Sample record structure:', {
            ID: sampleRecord.ID,
            Date: sampleRecord.Date,
            StaffMemberLookupId: sampleRecord.StaffMemberLookupId,
            WeeklyTimeTableID: sampleRecord.WeeklyTimeTableID,
            Title: sampleRecord.Title,
            ShiftDate1: sampleRecord.ShiftDate1,
            ShiftDate2: sampleRecord.ShiftDate2,
            allFields: Object.keys(sampleRecord)
          });
        }
      }

      // Сохраняем все загруженные записи
      console.log('[useTimetableStaffRecordsData] *** SETTING STAFF RECORDS IN STATE ***');
      console.log('[useTimetableStaffRecordsData] Setting staff records count:', allStaffRecords.length);
      setStaffRecords(allStaffRecords);

      // *** ДОБАВЛЯЕМ ОТЛАДКУ ПЕРЕД ВЫЗОВОМ ПРОЦЕССОРА ***
      console.log('[useTimetableStaffRecordsData] *** CALLING TimetableDataProcessor.processDataByWeeks ***');
      console.log('[useTimetableStaffRecordsData] Passing to processor:', {
        staffRecords: allStaffRecords.length,
        staffMembers: activeStaffMembers.length,
        weeks: weeks.length,
        currentUserId: currentUserId,
        managingGroupId: managingGroupId,
        firstFewRecords: allStaffRecords.slice(0, 2).map(r => ({
          ID: r.ID,
          Date: r.Date?.toLocaleDateString(),
          StaffMemberLookupId: r.StaffMemberLookupId,
          WeeklyTimeTableID: r.WeeklyTimeTableID
        })),
        firstFewStaffMembers: activeStaffMembers.slice(0, 2).map(s => ({
          name: s.name,
          employeeId: s.employeeId
        }))
      });

      // Обрабатываем данные в структуру групп недель
      const weeksData = TimetableDataProcessor.processDataByWeeks({
        staffRecords: allStaffRecords,
        staffMembers: activeStaffMembers, // Используем только активных сотрудников
        weeks: weeks,
        // Оставляем параметры для совместимости и логирования
        currentUserId: currentUserId,
        managingGroupId: managingGroupId
      });

      console.log(`[useTimetableStaffRecordsData] *** PROCESSOR COMPLETED ***`);
      console.log(`[useTimetableStaffRecordsData] Processed ${weeksData.length} week groups`);
      
      // Логируем статистику по неделям
      weeksData.forEach((weekGroup: IWeekGroup) => {
        const staffWithData = weekGroup.staffRows.filter((row: ITimetableStaffRow) => // FIXED: Заменили 'any' на 'ITimetableStaffRow'
          Object.values(row.weekData.days).some((day: IDayInfo) => day.hasData) // FIXED: Заменили 'any' на 'IDayInfo'
        ).length;
        
        console.log(`[useTimetableStaffRecordsData] Week ${weekGroup.weekInfo.weekNum}: ${staffWithData}/${weekGroup.staffRows.length} staff have data`);
      });

      // Общая статистика
      const totalStaffRows = weeksData.reduce((sum, week) => sum + week.staffRows.length, 0);
      const weeksWithData = weeksData.filter(week => week.hasData).length;
      
      console.log('[useTimetableStaffRecordsData] Final processing summary:', {
        totalWeeks: weeksData.length,
        weeksWithData,
        totalStaffRows,
        averageStaffPerWeek: Math.round(totalStaffRows / (weeksData.length || 1)),
        totalRecordsProcessed: allStaffRecords.length,
        successfulRequests,
        failedRequests
      });

      console.log('[useTimetableStaffRecordsData] *** SETTING WEEKS DATA IN STATE ***');
      setWeeksData(weeksData);

      // Если были ошибки в запросах, но есть успешные результаты
      if (failedRequests > 0 && successfulRequests > 0) {
        setErrorStaffRecords(`Warning: Failed to load data for ${failedRequests} staff members out of ${activeStaffMembers.length}`);
      } else if (failedRequests > 0 && successfulRequests === 0) {
        setErrorStaffRecords(`Failed to load data for all staff members`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableStaffRecordsData] *** CRITICAL ERROR loading timetable data ***:', error);
      setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
      setStaffRecords([]);
      setWeeksData([]);
    } finally {
      console.log('[useTimetableStaffRecordsData] *** SETTING LOADING STATE TO FALSE ***');
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
      console.log('[useTimetableStaffRecordsData] Missing dependencies analysis:', {
        hasContext: !!context,
        hasStaffRecordsService: !!staffRecordsService,
        hasManagingGroupId: !!managingGroupId,
        hasCurrentUserId: !!currentUserId,
        weeksCount: weeks.length,
        staffMembersCount: staffMembers.length
      });
      
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
    }
  }, [
    selectedDate,
    weeks.length,
    staffMembers.length,
    managingGroupId,
    currentUserId,
    loadTimetableData
  ]);

  return {
    loadTimetableData,
    refreshTimetableData
  };
};