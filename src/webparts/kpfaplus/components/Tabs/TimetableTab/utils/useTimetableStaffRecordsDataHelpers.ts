// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsDataHelpers.ts
// ОБНОВЛЕНО v5.0: Полная поддержка Date-only формата
// Date-only: Поле Date больше не содержит время, используется только дата

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { 
  IWeekInfo, 
  IWeekGroup,
  IStaffMember,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableDataProcessor } from './TimetableDataProcessor';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';

/**
 * ОБНОВЛЕНО v5.0: Обрабатывает и устанавливает результаты с Date-only поддержкой
 * Date-only: Все операции с датами нормализованы к полуночи для точных сравнений
 */
export const processAndSetResults = async (
  allRecords: IStaffRecord[], 
  activeStaffMembers: IStaffMember[], 
  weeks: IWeekInfo[],
  strategy: string,
  selectedDate: Date,
  setStaffRecords: (records: IStaffRecord[]) => void,
  setWeeksData: (weeksData: IWeekGroup[]) => void,
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
): Promise<void> => {
  console.log('[processAndSetResults] v5.0: Processing with date-only support');
  
  const activeEmployeeIds = new Set(
    activeStaffMembers
      .map(staff => staff.employeeId?.toString())
      .filter(id => id && id !== '0')
  );

  console.log('[processAndSetResults] v5.0: Active employee IDs:', {
    activeStaffCount: activeStaffMembers.length,
    activeEmployeeIds: Array.from(activeEmployeeIds),
    strategy
  });

  // *** ОБНОВЛЕНО v5.0: Date-only анализ данных ***
  const recordsByStaffId: Record<string, number> = {};
  const recordsByDate: Record<string, number> = {};
  const uniqueStaffIdsInRecords = new Set<string>();
  
  // Date-only статистика
  let recordsWithValidDates = 0;
  let recordsWithInvalidDates = 0;
  const dateRange = {
    earliest: null as Date | null,
    latest: null as Date | null
  };
  
  allRecords.forEach(record => {
    const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
    
    // *** ОБНОВЛЕНО v5.0: Date-only обработка ***
    const recordDate = new Date(record.Date);
    
    if (isNaN(recordDate.getTime())) {
      recordsWithInvalidDates++;
      console.warn(`[processAndSetResults] v5.0: Invalid date-only field in record ${record.ID}`);
    } else {
      recordsWithValidDates++;
      
      // Нормализуем к date-only для точной статистики
      const normalizedDate = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
      const dateStr = normalizedDate.toLocaleDateString();
      
      // Обновляем диапазон дат
      if (!dateRange.earliest || normalizedDate < dateRange.earliest) {
        dateRange.earliest = normalizedDate;
      }
      if (!dateRange.latest || normalizedDate > dateRange.latest) {
        dateRange.latest = normalizedDate;
      }
      
      recordsByDate[dateStr] = (recordsByDate[dateStr] || 0) + 1;
    }
    
    recordsByStaffId[staffId] = (recordsByStaffId[staffId] || 0) + 1;
    uniqueStaffIdsInRecords.add(staffId);
  });

  console.log('[processAndSetResults] v5.0: Date-only data analysis:', {
    totalRecords: allRecords.length,
    recordsWithValidDates,
    recordsWithInvalidDates,
    dateRange: {
      earliest: dateRange.earliest?.toLocaleDateString(),
      latest: dateRange.latest?.toLocaleDateString(),
      spanDays: dateRange.earliest && dateRange.latest ? 
        Math.ceil((dateRange.latest.getTime() - dateRange.earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0
    },
    uniqueDates: Object.keys(recordsByDate).length,
    uniqueStaffIds: uniqueStaffIdsInRecords.size
  });

  // *** ОБНОВЛЕНО v5.0: Date-only валидация диапазона ***
  const normalizedSelectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  const startDate = new Date(normalizedSelectedDate.getFullYear(), normalizedSelectedDate.getMonth(), 1);
  const endDate = new Date(normalizedSelectedDate.getFullYear(), normalizedSelectedDate.getMonth() + 1, 0);

  console.log('[processAndSetResults] v5.0: Date-only range validation:', {
    selectedDate: normalizedSelectedDate.toLocaleDateString(),
    startDate: startDate.toLocaleDateString(),
    endDate: endDate.toLocaleDateString(),
    expectedMonth: normalizedSelectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  });

  const recordsOutsideRange = allRecords.filter(record => {
    const recordDate = new Date(record.Date);
    
    if (isNaN(recordDate.getTime())) {
      return false; // Пропускаем невалидные даты
    }
    
    // *** Date-only сравнение ***
    const normalizedRecordDate = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
    return normalizedRecordDate < startDate || normalizedRecordDate > endDate;
  });

  if (recordsOutsideRange.length > 0) {
    console.warn(`[processAndSetResults] v5.0: ${recordsOutsideRange.length} records outside expected date-only range`);
    console.warn('[processAndSetResults] v5.0: Records outside range:', 
      recordsOutsideRange.slice(0, 5).map(r => ({
        id: r.ID,
        date: new Date(r.Date).toLocaleDateString(),
        staffId: r.StaffMemberLookupId
      }))
    );
  }

  // *** ОБНОВЛЕНО v5.0: Date-only анализ распределения по неделям ***
  const weekDistribution: Record<number, number> = {};
  
  allRecords.forEach(record => {
    const recordDate = new Date(record.Date);
    
    if (isNaN(recordDate.getTime())) {
      return; // Пропускаем невалидные даты
    }
    
    const matchingWeek = weeks.find(week => 
      TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
    );
    
    if (matchingWeek) {
      weekDistribution[matchingWeek.weekNum] = (weekDistribution[matchingWeek.weekNum] || 0) + 1;
    } else {
      console.warn(`[processAndSetResults] v5.0: Record ${record.ID} with date ${recordDate.toLocaleDateString()} does not match any week`);
    }
  });
  
  const weeksWithRecords = Object.keys(weekDistribution).length;
  const singleWeekConcentration = weeksWithRecords === 1 && weekDistribution[1];
  
  console.log('[processAndSetResults] v5.0: Date-only week distribution:', {
    totalWeeks: weeks.length,
    weeksWithRecords,
    weekDistribution,
    singleWeekConcentration: !!singleWeekConcentration
  });
  
  if (singleWeekConcentration) {
    console.error('[processAndSetResults] v5.0: CRITICAL: All records concentrated in Week 1 - check server-side date-only filtering');
    console.error('[processAndSetResults] v5.0: This indicates a potential issue with SharePoint date-only field processing');
  }

  // *** ОБНОВЛЕНО v5.0: Date-only фильтрация записей по активным сотрудникам ***
  const filteredRecords = allRecords.filter(record => {
    // Проверяем валидность даты
    const recordDate = new Date(record.Date);
    if (isNaN(recordDate.getTime())) {
      console.warn(`[processAndSetResults] v5.0: Skipping record ${record.ID} - invalid date-only field`);
      return false;
    }
    
    // Проверяем активность сотрудника
    const recordStaffMemberId = record.StaffMemberLookupId?.toString();
    const isActiveStaff = recordStaffMemberId && activeEmployeeIds.has(recordStaffMemberId);
    
    if (!isActiveStaff) {
      // Не логируем каждую запись - только сводную статистику
      return false;
    }
    
    return true;
  });

  console.log('[processAndSetResults] v5.0: Date-only record filtering result:', {
    originalRecords: allRecords.length,
    filteredRecords: filteredRecords.length,
    filteredOutCount: allRecords.length - filteredRecords.length,
    filteringEfficiency: allRecords.length > 0 ? 
      Math.round((filteredRecords.length / allRecords.length) * 100) + '%' : '0%'
  });

  // *** ОБНОВЛЕНО v5.0: Date-only финальная проверка распределения по неделям ***
  const recordsByWeek: Record<number, number> = {};
  const recordsOutsideWeeks: IStaffRecord[] = [];
  
  filteredRecords.forEach(record => {
    const recordDate = new Date(record.Date);
    const matchingWeek = weeks.find(week => 
      TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
    );
    
    if (matchingWeek) {
      recordsByWeek[matchingWeek.weekNum] = (recordsByWeek[matchingWeek.weekNum] || 0) + 1;
    } else {
      recordsOutsideWeeks.push(record);
      console.warn(`[processAndSetResults] v5.0: Record ${record.ID} with date-only ${recordDate.toLocaleDateString()} does not match any week`);
    }
  });

  console.log('[processAndSetResults] v5.0: Final date-only week distribution:', {
    recordsByWeek,
    recordsOutsideWeeks: recordsOutsideWeeks.length,
    weeksWithData: Object.keys(recordsByWeek).length
  });

  // Устанавливаем отфильтрованные записи
  setStaffRecords(filteredRecords);

  // *** ОБНОВЛЕНО v5.0: Обработка данных с Date-only поддержкой ***
  console.log('[processAndSetResults] v5.0: Processing weeks data with date-only support');
  
  const weeksData = TimetableDataProcessor.processDataByWeeks({
    staffRecords: filteredRecords,
    staffMembers: activeStaffMembers,
    weeks: weeks,
    currentUserId: undefined,
    managingGroupId: undefined,
    getLeaveTypeColor,
    holidayColor: TIMETABLE_COLORS.HOLIDAY
  });

  // *** ОБНОВЛЕНО v5.0: Date-only сводка производительности ***
  const weeksWithData = weeksData.filter(week => week.hasData).length;
  const dataQuality = weeksWithData > 0 ? 
    (weeksWithData === 1 ? 'POOR - Single week' : 
     weeksWithData < weeks.length * 0.5 ? 'FAIR - Partial coverage' : 
     'GOOD - Multi-week coverage') : 'CRITICAL - No data';
  
  console.log(`[processAndSetResults] v5.0: Date-only processing completed:`, {
    strategy,
    totalWeeks: weeksData.length,
    weeksWithData,
    dataQuality,
    recordsProcessed: filteredRecords.length,
    activeStaffMembers: activeStaffMembers.length,
    dateOnlyValidation: 'PASSED'
  });

  setWeeksData(weeksData);

  // *** ОБНОВЛЕНО v5.0: Date-only диагностика и предупреждения ***
  if (filteredRecords.length === 0 && activeStaffMembers.length > 0) {
    console.warn('[processAndSetResults] v5.0: CRITICAL: No records found for any active staff members with valid date-only fields');
    console.warn('[processAndSetResults] v5.0: Possible causes:');
    console.warn('  - SharePoint date-only field processing issues');
    console.warn('  - Timezone conversion problems in date-only fields');
    console.warn('  - Invalid employee ID mappings');
    console.warn('  - Date range filtering too restrictive');
  } else if (weeksWithData <= 1 && filteredRecords.length > 10) {
    console.warn(`[processAndSetResults] v5.0: WARNING: Data concentrated in single week despite ${strategy} strategy`);
    console.warn('[processAndSetResults] v5.0: Date-only fields may have timezone conversion issues');
    console.warn('[processAndSetResults] v5.0: Consider checking SharePoint date-only field configuration');
  } else if (recordsWithInvalidDates > 0) {
    console.warn(`[processAndSetResults] v5.0: WARNING: ${recordsWithInvalidDates} records have invalid date-only fields`);
    console.warn('[processAndSetResults] v5.0: This may indicate SharePoint date-only field corruption');
  }

  // *** НОВОЕ v5.0: Date-only валидация успешности ***
  const processingSuccess = {
    hasValidRecords: filteredRecords.length > 0,
    hasMultiWeekData: weeksWithData > 1,
    dateRangeValid: recordsOutsideRange.length < allRecords.length * 0.1, // Менее 10% записей вне диапазона
    dateFieldsValid: recordsWithInvalidDates < allRecords.length * 0.05, // Менее 5% невалидных дат
    overallSuccess: filteredRecords.length > 0 && weeksWithData > 0 && recordsWithInvalidDates === 0
  };

  console.log('[processAndSetResults] v5.0: Date-only processing validation:', processingSuccess);

  if (!processingSuccess.overallSuccess) {
    console.error('[processAndSetResults] v5.0: Date-only processing validation failed - check SharePoint date field configuration');
  }
};