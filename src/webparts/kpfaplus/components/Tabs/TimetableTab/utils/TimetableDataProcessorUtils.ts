// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorUtils.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IWeeklyStaffData, IDayInfo } from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';

/**
 * Specialized module for utility functions and helpers
 * Extracted from TimetableDataProcessorCore for better maintainability
 * Version 4.1 - Refactored modular architecture
 */
export class TimetableDataProcessorUtils {

  /**
   * *** УЛУЧШЕННЫЙ МЕТОД v4.1 ***
   * Получает ВСЕ записи для конкретного дня недели (включая без рабочего времени)
   * REFACTORED: Extracted from core with enhanced error handling
   */
  public static getAllRecordsForDayEnhanced(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    // Фильтруем ВСЕ записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableDataProcessorUtils] *** v4.1: Invalid date in record ${record.ID} ***`);
        return false;
      }

      const recordDayNumber = TimetableShiftCalculatorCore.getDayNumber(recordDate);
      
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      return isCorrectDay && isInWeek;
    });

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Found ${dayRecords.length} total records for day ${dayNumber} ***`);

    // Дополнительная диагностика v4.1
    const recordsWithLeave = dayRecords.filter(r => r.TypeOfLeaveID && r.TypeOfLeaveID !== '0');
    const recordsWithHoliday = dayRecords.filter(r => r.Holiday === 1);
    const recordsWithWorkTime = dayRecords.filter(r => {
      const hasWork = r.ShiftDate1 && r.ShiftDate2 && 
        !(r.ShiftDate1.getHours() === 0 && r.ShiftDate1.getMinutes() === 0 && 
          r.ShiftDate2.getHours() === 0 && r.ShiftDate2.getMinutes() === 0);
      return hasWork;
    });

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Day ${dayNumber} records analysis ***`, {
      totalRecords: dayRecords.length,
      recordsWithLeave: recordsWithLeave.length,
      recordsWithHoliday: recordsWithHoliday.length,
      recordsWithWorkTime: recordsWithWorkTime.length,
      recordsWithoutWorkTime: dayRecords.length - recordsWithWorkTime.length
    });

    return dayRecords;
  }

  /**
   * Подсчитывает количество праздников в недельных данных
   * REFACTORED v4.1: Extracted from core for better organization
   */
  public static countHolidaysInWeekData(weeklyData: IWeeklyStaffData): number {
    let holidaysCount = 0;
    Object.values(weeklyData.days).forEach((day: IDayInfo) => {
      if (day.hasHoliday) {
        holidaysCount += day.shifts.filter(s => s.isHoliday).length;
        if (day.shifts.length === 0 && day.hasHoliday) {
          holidaysCount += 1;
        }
      }
    });
    return holidaysCount;
  }

  /**
   * Анализирует записи на наличие отметок без рабочего времени
   * REFACTORED v4.1: Enhanced analysis with better categorization
   */
  public static analyzeRecordsForNonWorkMarkers(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithWorkTime: number;
    recordsWithoutWorkTime: number;
    nonWorkHolidayRecords: number;
    nonWorkLeaveRecords: number;
    nonWorkRecordsWithBoth: number;
    categorization: {
      pureWorkRecords: number;
      workWithMarkers: number;
      pureMarkers: number;
      emptyRecords: number;
    };
  } {
    const totalRecords = records.length;
    let recordsWithWorkTime = 0;
    let recordsWithoutWorkTime = 0;
    let nonWorkHolidayRecords = 0;
    let nonWorkLeaveRecords = 0;
    let nonWorkRecordsWithBoth = 0;

    // Детальная категоризация
    let pureWorkRecords = 0;
    let workWithMarkers = 0;
    let pureMarkers = 0;
    let emptyRecords = 0;

    records.forEach(record => {
      // Проверяем есть ли рабочее время
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      const isHoliday = record.Holiday === 1;
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';

      if (hasWorkTime) {
        recordsWithWorkTime++;
        
        if (isHoliday || hasLeaveType) {
          workWithMarkers++;
        } else {
          pureWorkRecords++;
        }
      } else {
        recordsWithoutWorkTime++;

        // Анализируем записи без рабочего времени на предмет отметок
        if (isHoliday && hasLeaveType) {
          nonWorkRecordsWithBoth++;
        } else if (isHoliday) {
          nonWorkHolidayRecords++;
        } else if (hasLeaveType) {
          nonWorkLeaveRecords++;
        } else {
          emptyRecords++;
        }

        if (isHoliday || hasLeaveType) {
          pureMarkers++;
        }
      }
    });

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Non-work markers analysis ***`, {
      totalRecords,
      recordsWithWorkTime,
      recordsWithoutWorkTime,
      nonWorkHolidayRecords,
      nonWorkLeaveRecords,
      nonWorkRecordsWithBoth,
      categorization: {
        pureWorkRecords,
        workWithMarkers,
        pureMarkers,
        emptyRecords
      }
    });

    return {
      totalRecords,
      recordsWithWorkTime,
      recordsWithoutWorkTime,
      nonWorkHolidayRecords,
      nonWorkLeaveRecords,
      nonWorkRecordsWithBoth,
      categorization: {
        pureWorkRecords,
        workWithMarkers,
        pureMarkers,
        emptyRecords
      }
    };
  }

  /**
   * Получает дату для дня недели в рамках недели
   * REFACTORED v4.1: Improved date calculation with validation
   */
  public static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    if (dayNumber < 1 || dayNumber > 7) {
      console.warn(`[TimetableDataProcessorUtils] Invalid day number: ${dayNumber}, using 1`);
      dayNumber = 1;
    }

    const date = new Date(weekStart);
    const startDayNumber = TimetableShiftCalculatorCore.getDayNumber(weekStart);
    
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7;
    }
    
    date.setDate(weekStart.getDate() + offset);
    
    console.log(`[TimetableDataProcessorUtils] *** v4.1: Date calculation ***`, {
      weekStart: weekStart.toLocaleDateString(),
      dayNumber,
      startDayNumber,
      offset,
      resultDate: date.toLocaleDateString()
    });
    
    return date;
  }

  /**
   * Валидирует записи на корректность данных
   * REFACTORED v4.1: Comprehensive validation
   */
  public static validateRecordsIntegrity(
    records: IStaffRecord[]
  ): {
    isValid: boolean;
    validRecords: number;
    invalidRecords: number;
    issues: Array<{
      recordId: string;
      issue: string;
      severity: 'ERROR' | 'WARNING';
    }>;
    summary: {
      dateIssues: number;
      timeIssues: number;
      staffIssues: number;
      dataInconsistencies: number;
    };
  } {
    const issues: Array<{
      recordId: string;
      issue: string;
      severity: 'ERROR' | 'WARNING';
    }> = [];

    let validRecords = 0;
    let invalidRecords = 0;
    let dateIssues = 0;
    let timeIssues = 0;
    let staffIssues = 0;
    let dataInconsistencies = 0;

    records.forEach(record => {
      let recordHasIssues = false;

      // Проверка даты
      if (!record.Date || isNaN(record.Date.getTime())) {
        issues.push({
          recordId: record.ID,
          issue: 'Invalid or missing Date field',
          severity: 'ERROR'
        });
        dateIssues++;
        recordHasIssues = true;
      }

      // Проверка времен смены
      if (record.ShiftDate1 && isNaN(record.ShiftDate1.getTime())) {
        issues.push({
          recordId: record.ID,
          issue: 'Invalid ShiftDate1',
          severity: 'ERROR'
        });
        timeIssues++;
        recordHasIssues = true;
      }

      if (record.ShiftDate2 && isNaN(record.ShiftDate2.getTime())) {
        issues.push({
          recordId: record.ID,
          issue: 'Invalid ShiftDate2',
          severity: 'ERROR'
        });
        timeIssues++;
        recordHasIssues = true;
      }

      // Проверка сотрудника
      if (!record.StaffMemberLookupId) {
        issues.push({
          recordId: record.ID,
          issue: 'Missing StaffMemberLookupId',
          severity: 'ERROR'
        });
        staffIssues++;
        recordHasIssues = true;
      }

      // Проверка логической согласованности
      if (record.ShiftDate1 && record.ShiftDate2) {
        const start = record.ShiftDate1.getTime();
        const end = record.ShiftDate2.getTime();
        
        // Предупреждение о слишком длинных сменах (более 24 часов)
        const diffHours = Math.abs(end - start) / (1000 * 60 * 60);
        if (diffHours > 24) {
          issues.push({
            recordId: record.ID,
            issue: `Shift duration ${diffHours.toFixed(1)} hours seems excessive`,
            severity: 'WARNING'
          });
          dataInconsistencies++;
        }
      }

      // Проверка времени обеда
      if (record.ShiftDate3 && record.ShiftDate4) {
        if (isNaN(record.ShiftDate3.getTime()) || isNaN(record.ShiftDate4.getTime())) {
          issues.push({
            recordId: record.ID,
            issue: 'Invalid lunch break times',
            severity: 'WARNING'
          });
          timeIssues++;
        }
      }

      // Проверка полей отпуска и праздника
      if (record.Holiday === 1 && record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        issues.push({
          recordId: record.ID,
          issue: 'Record has both Holiday=1 and TypeOfLeaveID - potential data inconsistency',
          severity: 'WARNING'
        });
        dataInconsistencies++;
      }

      if (recordHasIssues) {
        invalidRecords++;
      } else {
        validRecords++;
      }
    });

    const isValid = issues.filter(i => i.severity === 'ERROR').length === 0;

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Validation completed ***`, {
      totalRecords: records.length,
      validRecords,
      invalidRecords,
      errorIssues: issues.filter(i => i.severity === 'ERROR').length,
      warningIssues: issues.filter(i => i.severity === 'WARNING').length
    });

    return {
      isValid,
      validRecords,
      invalidRecords,
      issues,
      summary: {
        dateIssues,
        timeIssues,
        staffIssues,
        dataInconsistencies
      }
    };
  }

  /**
   * Группирует записи по различным критериям
   * REFACTORED v4.1: Flexible grouping utility
   */
  public static groupRecordsBy(
    records: IStaffRecord[],
    groupBy: 'date' | 'staff' | 'week' | 'month' | 'leaveType' | 'holiday'
  ): Record<string, IStaffRecord[]> {
    const groups: Record<string, IStaffRecord[]> = {};

    records.forEach(record => {
      let groupKey = '';

      switch (groupBy) {
        case 'date': {
          groupKey = record.Date.toLocaleDateString('en-GB');
          break;
        }
        case 'staff': {
          groupKey = record.StaffMemberLookupId?.toString() || 'Unknown';
          break;
        }
        case 'week': {
          const weekStart = this.getWeekStart(record.Date);
          groupKey = weekStart.toLocaleDateString('en-GB');
          break;
        }
        case 'month': {
          groupKey = record.Date.toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' });
          break;
        }
        case 'leaveType': {
          groupKey = record.TypeOfLeaveID || 'No Leave';
          break;
        }
        case 'holiday': {
          groupKey = record.Holiday === 1 ? 'Holiday' : 'Regular';
          break;
        }
        default: {
          groupKey = 'All';
        }
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(record);
    });

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Grouped ${records.length} records by ${groupBy} ***`, {
      groupsCount: Object.keys(groups).length,
      groupSizes: Object.entries(groups).map(([key, value]) => ({ key, size: value.length }))
    });

    return groups;
  }

  /**
   * Получает начало недели для даты
   * REFACTORED v4.1: Week calculation helper
   */
  private static getWeekStart(date: Date): Date {
    const dayOfWeek = date.getDay(); // 0 = Sunday
    const diff = date.getDate() - dayOfWeek;
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }

  /**
   * Создает статистику по записям
   * REFACTORED v4.1: Comprehensive statistics generation
   */
  public static generateRecordsStatistics(
    records: IStaffRecord[]
  ): {
    totalRecords: number;
    dateRange: {
      earliest: string;
      latest: string;
      spanDays: number;
    };
    staffCoverage: {
      uniqueStaff: number;
      staffWithMostRecords: { staffId: string; count: number };
      averageRecordsPerStaff: number;
    };
    timePatterns: {
      recordsWithWorkTime: number;
      recordsWithHolidays: number;
      recordsWithLeave: number;
      recordsWithBoth: number;
    };
    dataQuality: {
      completeRecords: number;
      incompleteRecords: number;
      qualityScore: number;
    };
  } {
    const totalRecords = records.length;
    
    if (totalRecords === 0) {
      return {
        totalRecords: 0,
        dateRange: { earliest: '', latest: '', spanDays: 0 },
        staffCoverage: { uniqueStaff: 0, staffWithMostRecords: { staffId: '', count: 0 }, averageRecordsPerStaff: 0 },
        timePatterns: { recordsWithWorkTime: 0, recordsWithHolidays: 0, recordsWithLeave: 0, recordsWithBoth: 0 },
        dataQuality: { completeRecords: 0, incompleteRecords: 0, qualityScore: 0 }
      };
    }

    // Анализ диапазона дат
    const dates = records.map(r => r.Date).filter(d => !isNaN(d.getTime()));
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())));
    const latest = new Date(Math.max(...dates.map(d => d.getTime())));
    const spanDays = Math.ceil((latest.getTime() - earliest.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Анализ покрытия сотрудников
    const staffCounts = new Map<string, number>();
    records.forEach(record => {
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      staffCounts.set(staffId, (staffCounts.get(staffId) || 0) + 1);
    });

    const uniqueStaff = staffCounts.size;
    let staffWithMostRecords = { staffId: '', count: 0 };
    let totalStaffRecords = 0;

    staffCounts.forEach((count, staffId) => {
      totalStaffRecords += count;
      if (count > staffWithMostRecords.count) {
        staffWithMostRecords = { staffId, count };
      }
    });

    const averageRecordsPerStaff = uniqueStaff > 0 ? Math.round(totalStaffRecords / uniqueStaff) : 0;

    // Анализ временных паттернов
    let recordsWithWorkTime = 0;
    let recordsWithHolidays = 0;
    let recordsWithLeave = 0;
    let recordsWithBoth = 0;
    let completeRecords = 0;

    records.forEach(record => {
      let isComplete = true;

      // Проверяем рабочее время
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);
      
      if (hasWorkTime) recordsWithWorkTime++;

      // Проверяем праздники
      if (record.Holiday === 1) recordsWithHolidays++;

      // Проверяем отпуска
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') recordsWithLeave++;

      // Проверяем комбинации
      if (record.Holiday === 1 && record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithBoth++;
      }

      // Проверяем полноту записи
      if (!record.Date || isNaN(record.Date.getTime())) isComplete = false;
      if (!record.StaffMemberLookupId) isComplete = false;

      if (isComplete) completeRecords++;
    });

    const incompleteRecords = totalRecords - completeRecords;
    const qualityScore = totalRecords > 0 ? Math.round((completeRecords / totalRecords) * 100) : 0;

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Statistics generated ***`, {
      totalRecords,
      dateSpan: `${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`,
      uniqueStaff,
      qualityScore: qualityScore + '%'
    });

    return {
      totalRecords,
      dateRange: {
        earliest: earliest.toLocaleDateString('en-GB'),
        latest: latest.toLocaleDateString('en-GB'),
        spanDays
      },
      staffCoverage: {
        uniqueStaff,
        staffWithMostRecords,
        averageRecordsPerStaff
      },
      timePatterns: {
        recordsWithWorkTime,
        recordsWithHolidays,
        recordsWithLeave,
        recordsWithBoth
      },
      dataQuality: {
        completeRecords,
        incompleteRecords,
        qualityScore
      }
    };
  }

  /**
   * Оптимизирует список записей для обработки
   * REFACTORED v4.1: Performance optimization utility
   */
  public static optimizeRecordsForProcessing(
    records: IStaffRecord[]
  ): {
    optimizedRecords: IStaffRecord[];
    removedCount: number;
    optimizations: string[];
    performance: {
      originalSize: number;
      optimizedSize: number;
      reductionPercentage: number;
    };
  } {
    const originalSize = records.length;
    const optimizations: string[] = [];
    let optimizedRecords = [...records];

    // Удаляем записи с невалидными датами
    const validDateRecords = optimizedRecords.filter(record => {
      const isValid = record.Date && !isNaN(record.Date.getTime());
      if (!isValid) {
        optimizations.push(`Removed record ${record.ID} - invalid date`);
      }
      return isValid;
    });
    optimizedRecords = validDateRecords;

    // Удаляем записи без указания сотрудника
    const validStaffRecords = optimizedRecords.filter(record => {
      const isValid = record.StaffMemberLookupId;
      if (!isValid) {
        optimizations.push(`Removed record ${record.ID} - missing staff ID`);
      }
      return isValid;
    });
    optimizedRecords = validStaffRecords;

    // Сортируем по дате для оптимизации последующей обработки
    optimizedRecords.sort((a, b) => a.Date.getTime() - b.Date.getTime());
    optimizations.push('Records sorted by date for optimal processing');

    const optimizedSize = optimizedRecords.length;
    const removedCount = originalSize - optimizedSize;
    const reductionPercentage = originalSize > 0 ? 
      Math.round((removedCount / originalSize) * 100) : 0;

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Records optimized ***`, {
      originalSize,
      optimizedSize,
      removedCount,
      reductionPercentage: reductionPercentage + '%',
      optimizations: optimizations.length
    });

    return {
      optimizedRecords,
      removedCount,
      optimizations,
      performance: {
        originalSize,
        optimizedSize,
        reductionPercentage
      }
    };
  }

  /**
   * Создает индекс записей для быстрого поиска
   * REFACTORED v4.1: Enhanced indexing utility
   */
  public static createRecordsIndex(
    records: IStaffRecord[]
  ): {
    byStaff: Map<string, IStaffRecord[]>;
    byDate: Map<string, IStaffRecord[]>;
    byWeek: Map<string, IStaffRecord[]>;
    byLeaveType: Map<string, IStaffRecord[]>;
    indexStats: {
      totalRecords: number;
      uniqueStaff: number;
      uniqueDates: number;
      uniqueWeeks: number;
      uniqueLeaveTypes: number;
    };
  } {
    const byStaff = new Map<string, IStaffRecord[]>();
    const byDate = new Map<string, IStaffRecord[]>();
    const byWeek = new Map<string, IStaffRecord[]>();
    const byLeaveType = new Map<string, IStaffRecord[]>();

    records.forEach(record => {
      // Индекс по сотрудникам
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      if (!byStaff.has(staffId)) {
        byStaff.set(staffId, []);
      }
      byStaff.get(staffId)!.push(record);

      // Индекс по датам
      const dateKey = record.Date.toLocaleDateString('en-GB');
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, []);
      }
      byDate.get(dateKey)!.push(record);

      // Индекс по неделям
      const weekStart = this.getWeekStart(record.Date);
      const weekKey = weekStart.toLocaleDateString('en-GB');
      if (!byWeek.has(weekKey)) {
        byWeek.set(weekKey, []);
      }
      byWeek.get(weekKey)!.push(record);

      // Индекс по типам отпусков
      const leaveTypeKey = record.TypeOfLeaveID || 'No Leave';
      if (!byLeaveType.has(leaveTypeKey)) {
        byLeaveType.set(leaveTypeKey, []);
      }
      byLeaveType.get(leaveTypeKey)!.push(record);
    });

    const indexStats = {
      totalRecords: records.length,
      uniqueStaff: byStaff.size,
      uniqueDates: byDate.size,
      uniqueWeeks: byWeek.size,
      uniqueLeaveTypes: byLeaveType.size
    };

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Index created ***`, indexStats);

    return {
      byStaff,
      byDate,
      byWeek,
      byLeaveType,
      indexStats
    };
  }

  /**
   * Получает информацию о модуле
   * REFACTORED v4.1: Module information
   */
  public static getModuleInfo(): {
    version: string;
    module: string;
    features: string[];
    totalMethods: number;
  } {
    return {
      version: '4.1',
      module: 'TimetableDataProcessorUtils',
      features: [
        'Enhanced record retrieval for days',
        'Holiday counting in weekly data',
        'Non-work markers analysis',
        'Date calculations with validation',
        'Records integrity validation',
        'Flexible grouping utilities',
        'Comprehensive statistics generation',
        'Performance optimization',
        'Advanced indexing'
      ],
      totalMethods: Object.getOwnPropertyNames(TimetableDataProcessorUtils)
        .filter(name => typeof TimetableDataProcessorUtils[name as keyof typeof TimetableDataProcessorUtils] === 'function')
        .length
    };
  }
}