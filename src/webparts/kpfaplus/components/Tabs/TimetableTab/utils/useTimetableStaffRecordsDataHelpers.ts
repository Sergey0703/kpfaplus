// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsDataHelpers.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { 
  IWeekInfo, 
  IWeekGroup,
  IStaffMember,
  ITimetableStaffRow,
  IDayInfo,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableDataProcessor } from './TimetableDataProcessor';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';

/**
 * Обработка и установка результатов с детальной диагностикой
 * ИСПРАВЛЕНО v3.7: Добавлена передача getLeaveTypeColor в TimetableDataProcessor
 */
export const processAndSetResults = async (
  allRecords: IStaffRecord[], 
  activeStaffMembers: IStaffMember[], 
  weeks: IWeekInfo[],
  strategy: string,
  selectedDate: Date,
  setStaffRecords: (records: IStaffRecord[]) => void,
  setWeeksData: (weeksData: IWeekGroup[]) => void,
  // *** НОВОЕ v3.7: Добавляем функцию getLeaveTypeColor ***
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
): Promise<void> => {
  console.log(`[processAndSetResults] *** PROCESSING RESULTS FROM ${strategy.toUpperCase()} STRATEGY WITH DIAGNOSTICS v3.7 ***`);
  console.log(`[processAndSetResults] *** v3.7: getLeaveTypeColor function availability check ***`, {
    getLeaveTypeColorExists: !!getLeaveTypeColor,
    functionType: typeof getLeaveTypeColor,
    note: 'This function will be passed to TimetableDataProcessor'
  });
  
  // Создаем Set с employeeId активных сотрудников для быстрой фильтрации
  const activeEmployeeIds = new Set(
    activeStaffMembers
      .map(staff => staff.employeeId?.toString())
      .filter(id => id && id !== '0')
  );

  console.log('[processAndSetResults] Active employee IDs for filtering:', Array.from(activeEmployeeIds));

  // *** ДЕТАЛЬНАЯ ДИАГНОСТИКА ВХОДЯЩИХ ДАННЫХ (ПОСЛЕ ЗАГРУЗКИ ВСЕХ ЗАПИСЕЙ) ***
  console.log('[processAndSetResults] *** RAW DATA ANALYSIS (ALL RECORDS LOADED) ***');
  
  const recordsByStaffId: Record<string, number> = {};
  const recordsByDate: Record<string, number> = {};
  const uniqueStaffIdsInRecords = new Set<string>();
  
  allRecords.forEach(record => {
    const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
    const dateStr = record.Date.toLocaleDateString();
    
    recordsByStaffId[staffId] = (recordsByStaffId[staffId] || 0) + 1;
    recordsByDate[dateStr] = (recordsByDate[dateStr] || 0) + 1;
    uniqueStaffIdsInRecords.add(staffId);
  });

  console.log('[processAndSetResults] Raw data analysis (ALL RECORDS):', {
    totalRecordsFromServer: allRecords.length,
    uniqueStaffIdsInRecords: uniqueStaffIdsInRecords.size,
    staffIdsInRecords: Array.from(uniqueStaffIdsInRecords).slice(0, 10), // Показываем первые 10
    activeStaffCount: activeStaffMembers.length,
    activeEmployeeIds: Array.from(activeEmployeeIds),
    uniqueDatesCount: Object.keys(recordsByDate).length,
    monthSpan: Object.keys(recordsByDate).length > 20 ? 
      'GOOD: Data spans full month' : 
      'WARNING: Limited date range'
  });

  // *** КРИТИЧЕСКАЯ ДИАГНОСТИКА: Проверяем даты записей ***
  console.log('[processAndSetResults] *** CRITICAL DATE ANALYSIS (ALL RECORDS) ***');

  // Анализируем даты всех записей
  const dateAnalysis: Record<string, { count: number; recordIds: string[] }> = {};
  const monthYearAnalysis: Record<string, number> = {};

  allRecords.forEach(record => {
    const recordDate = new Date(record.Date);
    const dateStr = recordDate.toLocaleDateString('en-GB');
    const monthYear = recordDate.toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' });
    
    if (!dateAnalysis[dateStr]) {
      dateAnalysis[dateStr] = { count: 0, recordIds: [] };
    }
    dateAnalysis[dateStr].count++;
    dateAnalysis[dateStr].recordIds.push(record.ID);
    
    monthYearAnalysis[monthYear] = (monthYearAnalysis[monthYear] || 0) + 1;
  });

  // Сортируем даты для анализа
  const sortedDates = Object.keys(dateAnalysis).sort((a, b) => 
    new Date(a.split('/').reverse().join('-')).getTime() - 
    new Date(b.split('/').reverse().join('-')).getTime()
  );

  console.log('[processAndSetResults] Date distribution analysis (ALL RECORDS):', {
    totalUniqueDates: sortedDates.length,
    dateRange: sortedDates.length > 0 ? `${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}` : 'No dates',
    monthYearDistribution: monthYearAnalysis,
    first10Dates: sortedDates.slice(0, 10).map(date => ({
      date,
      count: dateAnalysis[date].count
    })),
    last10Dates: sortedDates.slice(-10).map(date => ({
      date,
      count: dateAnalysis[date].count
    })),
    dataQuality: sortedDates.length > 20 ? 'EXCELLENT: Full month coverage' : 'POOR: Limited coverage'
  });

  // *** ПРОВЕРЯЕМ ЗАПРОШЕННЫЙ ДИАПАЗОН VS ПОЛУЧЕННЫЕ ДАННЫЕ ***
  const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

  console.log('[processAndSetResults] *** REQUEST VS RECEIVED DATA ANALYSIS ***');
  console.log('[processAndSetResults] Request parameters:', {
    requestedMonth: selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    requestedStartDate: startDate.toLocaleDateString('en-GB'),
    requestedEndDate: endDate.toLocaleDateString('en-GB'),
    requestedRange: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`
  });

  // Проверяем, попадают ли записи в запрошенный диапазон
  const recordsInRange = allRecords.filter(record => {
    const recordDate = new Date(record.Date);
    return recordDate >= startDate && recordDate <= endDate;
  });

  const recordsOutsideRange = allRecords.filter(record => {
    const recordDate = new Date(record.Date);
    return recordDate < startDate || recordDate > endDate;
  });

  console.log('[processAndSetResults] Records vs requested range:', {
    totalRecords: allRecords.length,
    recordsInRequestedRange: recordsInRange.length,
    recordsOutsideRange: recordsOutsideRange.length,
    percentageInRange: Math.round((recordsInRange.length / allRecords.length) * 100) + '%',
    result: recordsOutsideRange.length === 0 ? 'PERFECT: All records in range' : 'ISSUE: Some records outside range'
  });

  if (recordsOutsideRange.length > 0) {
    console.error('[processAndSetResults] 🚨 RECORDS OUTSIDE RANGE DETECTED:', {
      count: recordsOutsideRange.length,
      examples: recordsOutsideRange.slice(0, 5).map(record => ({
        id: record.ID,
        date: record.Date.toLocaleDateString('en-GB'),
        staffId: record.StaffMemberLookupId
      }))
    });
  }

  // *** ПРОВЕРЯЕМ РАСПРЕДЕЛЕНИЕ ПО НЕДЕЛЯМ (КЛЮЧЕВАЯ ДИАГНОСТИКА) ***
  const firstWeek = weeks[0];
  if (firstWeek) {
    const weekDistribution: Record<number, number> = {};
    
    allRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      const matchingWeek = weeks.find(week => 
        TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
      );
      
      if (matchingWeek) {
        weekDistribution[matchingWeek.weekNum] = (weekDistribution[matchingWeek.weekNum] || 0) + 1;
      }
    });
    
    console.log('[processAndSetResults] *** WEEK DISTRIBUTION ANALYSIS (CRITICAL) ***');
    console.log('[processAndSetResults] Records distribution by weeks:', {
      weekDistribution,
      totalWeeks: weeks.length,
      weeksWithData: Object.keys(weekDistribution).length,
      isFirstWeekDominant: weekDistribution[1] && weekDistribution[1] > (allRecords.length * 0.8) ? 
        '🚨 CRITICAL: >80% records in week 1!' : 
        '✅ GOOD: Normal distribution',
      distributionBalance: Object.keys(weekDistribution).length > 1 ? 
        'EXCELLENT: Multi-week data' : 
        'CRITICAL: Single week concentration',
      
      // Детальная статистика по неделям
      weekBreakdown: weeks.map(week => ({
        weekNum: week.weekNum,
        weekRange: `${week.weekStart.toLocaleDateString('en-GB')} - ${week.weekEnd.toLocaleDateString('en-GB')}`,
        recordsCount: weekDistribution[week.weekNum] || 0,
        percentage: Math.round(((weekDistribution[week.weekNum] || 0) / allRecords.length) * 100) + '%'
      }))
    });

    // *** ФИНАЛЬНАЯ ДИАГНОСТИКА ПРОБЛЕМЫ ***
    const singleWeekConcentration = Object.keys(weekDistribution).length === 1 && weekDistribution[1];
    if (singleWeekConcentration) {
      console.error('[processAndSetResults] 🚨🚨🚨 PROBLEM IDENTIFIED 🚨🚨🚨');
      console.error('[processAndSetResults] ISSUE: All records concentrated in Week 1');
      console.error('[processAndSetResults] SOLUTION IMPLEMENTED: Using getAllStaffRecordsForTimetable should fix this');
      console.error('[processAndSetResults] If problem persists, check server-side filtering in RemoteSiteItemService.getAllFilteredItemsForTimetable');
    } else {
      console.log('[processAndSetResults] ✅ SUCCESS: Records properly distributed across weeks');
    }
  }

  // *** АНАЛИЗ СОВПАДЕНИЙ ПО СОТРУДНИКАМ ***
  const matchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => activeEmployeeIds.has(id));
  const nonMatchingStaffIds = Array.from(uniqueStaffIdsInRecords).filter(id => !activeEmployeeIds.has(id));
  
  console.log('[processAndSetResults] Staff ID matching analysis:', {
    matchingStaffIds: matchingStaffIds,
    nonMatchingStaffIds: nonMatchingStaffIds.slice(0, 3), // Показываем только первые 3
    matchingCount: matchingStaffIds.length,
    nonMatchingCount: nonMatchingStaffIds.length,
    coverageQuality: matchingStaffIds.length > nonMatchingStaffIds.length ? 
      'GOOD: More matching than non-matching' : 
      'ISSUE: More non-matching IDs'
  });

  // Фильтруем полученные записи по нашим активным сотрудникам
  const filteredRecords = allRecords.filter(record => {
    const recordStaffMemberId = record.StaffMemberLookupId?.toString();
    return recordStaffMemberId && activeEmployeeIds.has(recordStaffMemberId);
  });

  console.log('[processAndSetResults] *** CLIENT-SIDE FILTERING COMPLETED ***');
  console.log('[processAndSetResults] Filtering results:', {
    totalRecordsFromServer: allRecords.length,
    filteredRecordsForOurStaff: filteredRecords.length,
    filteringEfficiency: `${Math.round((filteredRecords.length / allRecords.length) * 100)}% records matched our staff`,
    activeStaffCount: activeStaffMembers.length,
    result: filteredRecords.length > 0 ? 'SUCCESS: Found matching records' : 'PROBLEM: No matching records'
  });

  // *** КРИТИЧЕСКАЯ ПРОВЕРКА РАСПРЕДЕЛЕНИЯ ПО НЕДЕЛЯМ (ПОСЛЕ ФИЛЬТРАЦИИ) ***
  const recordsByWeek: Record<number, number> = {};
  
  filteredRecords.forEach(record => {
    const recordDate = new Date(record.Date);
    
    // Находим неделю для этой записи
    const matchingWeek = weeks.find(week => 
      TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
    );
    
    if (matchingWeek) {
      recordsByWeek[matchingWeek.weekNum] = (recordsByWeek[matchingWeek.weekNum] || 0) + 1;
    } else {
      console.warn(`[processAndSetResults] ⚠️ Record ${record.ID} (${recordDate.toLocaleDateString()}) does not match any calculated week!`);
    }
  });

  console.log('[processAndSetResults] *** FINAL RECORDS DISTRIBUTION BY WEEKS (AFTER FILTERING) ***', {
    weeklyDistribution: recordsByWeek,
    totalWeeks: weeks.length,
    weeksWithData: Object.keys(recordsByWeek).length,
    avgRecordsPerWeek: Object.keys(recordsByWeek).length > 0 ? 
      Math.round(filteredRecords.length / Object.keys(recordsByWeek).length) : 0,
    finalResult: Object.keys(recordsByWeek).length > 1 ? 
      '🎉 SUCCESS: Multi-week data distribution achieved!' : 
      '❌ STILL FAILED: Single week concentration persists',
    
    // Показываем финальное распределение
    finalWeekBreakdown: weeks.map(week => ({
      weekNum: week.weekNum,
      recordsCount: recordsByWeek[week.weekNum] || 0,
      percentage: filteredRecords.length > 0 ? 
        Math.round(((recordsByWeek[week.weekNum] || 0) / filteredRecords.length) * 100) + '%' : '0%'
    }))
  });

  // Сохраняем отфильтрованные записи
  console.log('[processAndSetResults] *** SETTING FILTERED STAFF RECORDS IN STATE ***');
  setStaffRecords(filteredRecords);

  // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.7: Передача getLeaveTypeColor в TimetableDataProcessor ***
  console.log('[processAndSetResults] *** v3.7: CALLING TimetableDataProcessor.processDataByWeeks WITH getLeaveTypeColor ***');
  console.log('[processAndSetResults] *** v3.7: getLeaveTypeColor function status before passing ***', {
    getLeaveTypeColorExists: !!getLeaveTypeColor,
    functionType: typeof getLeaveTypeColor,
    willBePassed: true,
    expectedResult: 'Colors should now be available in TimetableDataProcessorCore'
  });

  const weeksData = TimetableDataProcessor.processDataByWeeks({
    staffRecords: filteredRecords,
    staffMembers: activeStaffMembers,
    weeks: weeks,
    currentUserId: undefined, // Не используется в новой версии
    managingGroupId: undefined, // Не используется в новой версии
    getLeaveTypeColor, // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v3.7: Передаем функцию ***
    holidayColor: TIMETABLE_COLORS.HOLIDAY
  });

  console.log(`[processAndSetResults] *** PROCESSOR COMPLETED v3.7 ***`);
  console.log(`[processAndSetResults] Processed ${weeksData.length} week groups using ${strategy} strategy with getLeaveTypeColor function`);
  
  // Логируем статистику по неделям
  weeksData.forEach((weekGroup: IWeekGroup) => {
    const staffWithData = weekGroup.staffRows.filter((row: ITimetableStaffRow) =>
      Object.values(row.weekData.days).some((day: IDayInfo) => day.hasData)
    ).length;
    
    console.log(`[processAndSetResults] Week ${weekGroup.weekInfo.weekNum}: ${staffWithData}/${weekGroup.staffRows.length} staff have data`);
  });

  // Общая статистика
  const totalStaffRows = weeksData.reduce((sum, week) => sum + week.staffRows.length, 0);
  const weeksWithData = weeksData.filter(week => week.hasData).length;
  
  console.log('[processAndSetResults] *** TIMETABLE STRATEGY PERFORMANCE SUMMARY v3.7 ***');
  console.log('[processAndSetResults] Final processing summary with getLeaveTypeColor:', {
    strategy: strategy,
    totalWeeks: weeksData.length,
    weeksWithData,
    totalStaffRows,
    averageStaffPerWeek: Math.round(totalStaffRows / (weeksData.length || 1)),
    totalRecordsProcessed: filteredRecords.length,
    dataQuality: weeksWithData > 1 ? 
      '🎉 EXCELLENT: Multi-week data achieved with new strategy!' : 
      '❌ STILL FAILED: Single week concentration - need to investigate server filtering',
    expectedImprovement: 'Should load all records and distribute across weeks WITH COLORS',
    getLeaveTypeColorPassed: !!getLeaveTypeColor,
    colorFunctionStatus: getLeaveTypeColor ? 'PASSED TO PROCESSOR ✓' : 'MISSING ✗'
  });

  setWeeksData(weeksData);

  // Проверяем если есть проблемы с данными - ИСПРАВЛЕНО: НЕ УСТАНАВЛИВАЕМ ОШИБКИ для желтого предупреждения
  if (filteredRecords.length === 0 && activeStaffMembers.length > 0) {
    console.warn('[processAndSetResults] Warning: No records found for any active staff members');
    // НЕ устанавливаем ошибку - это просто отсутствие данных для желтого предупреждения
  } else if (weeksWithData <= 1 && filteredRecords.length > 10) {
    console.warn('[processAndSetResults] Warning: Data concentration in single week despite using new strategy');
    // НЕ устанавливаем ошибку - данные есть, но сконцентрированы
  }
};