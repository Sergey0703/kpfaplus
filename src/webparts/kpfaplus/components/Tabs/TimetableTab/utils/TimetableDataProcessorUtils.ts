// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorUtils.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IWeeklyStaffData, IDayInfo } from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';

/**
 * Specialized module for utility functions and helpers
 * Extracted from TimetableDataProcessorCore for better maintainability
 * ОБНОВЛЕНО: Переход на числовые поля времени ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes
 */
export class TimetableDataProcessorUtils {

  /**
   * Извлекает время из записи используя числовые поля
   * НОВЫЙ МЕТОД: Использует ShiftDate1Hours/Minutes и ShiftDate2Hours/Minutes
   */
  private static extractTimeFromRecord(record: IStaffRecord): {
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
    isValidTime: boolean;
    hasWorkTime: boolean;
  } {
    // *** ИСПОЛЬЗУЕМ ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
    const startHours = record.ShiftDate1Hours ?? 0;
    const startMinutes = record.ShiftDate1Minutes ?? 0;
    const endHours = record.ShiftDate2Hours ?? 0;
    const endMinutes = record.ShiftDate2Minutes ?? 0;
    
    // Валидация числовых значений
    const isValidTime = (
      startHours >= 0 && startHours <= 23 &&
      startMinutes >= 0 && startMinutes <= 59 &&
      endHours >= 0 && endHours <= 23 &&
      endMinutes >= 0 && endMinutes <= 59
    );
    
    // Проверяем наличие рабочего времени (не 00:00 - 00:00)
    const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);
    
    return {
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      isValidTime,
      hasWorkTime
    };
  }

  /**
   * *** ОБНОВЛЕННЫЙ МЕТОД v4.1 ***
   * Получает ВСЕ записи для конкретного дня недели (включая без рабочего времени)
   * ОБНОВЛЕНО: Использует числовые поля времени для анализа
   */
  public static getAllRecordsForDayEnhanced(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    console.log(`[TimetableDataProcessorUtils] *** ENHANCED DAY RECORDS WITH NUMERIC FIELDS ***`);
    
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

    // *** ОБНОВЛЕННАЯ ДИАГНОСТИКА С ЧИСЛОВЫМИ ПОЛЯМИ ***
    const recordsWithLeave = dayRecords.filter(r => r.TypeOfLeaveID && r.TypeOfLeaveID !== '0');
    const recordsWithHoliday = dayRecords.filter(r => r.Holiday === 1);
    const recordsWithWorkTime = dayRecords.filter(r => {
      const timeData = this.extractTimeFromRecord(r);
      return timeData.hasWorkTime;
    });

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Day ${dayNumber} records analysis WITH NUMERIC FIELDS ***`, {
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
   * ОБНОВЛЕНО: Использует числовые поля времени для анализа
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
    console.log(`[TimetableDataProcessorUtils] *** ANALYZING NON-WORK MARKERS WITH NUMERIC FIELDS ***`);
    
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
      // *** ПРОВЕРЯЕМ РАБОЧЕЕ ВРЕМЯ ЧЕРЕЗ ЧИСЛОВЫЕ ПОЛЯ ***
      const timeData = this.extractTimeFromRecord(record);
      const hasWorkTime = timeData.hasWorkTime;

      const isHoliday = record.Holiday === 1;
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';

      console.log(`[TimetableDataProcessorUtils] Record ${record.ID}: numeric time ${timeData.startHours}:${timeData.startMinutes}-${timeData.endHours}:${timeData.endMinutes}, hasWork: ${hasWorkTime}`);

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

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Non-work markers analysis WITH NUMERIC FIELDS ***`, {
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
   * ОБНОВЛЕНО: Проверяет числовые поля времени вместо ShiftDate1/ShiftDate2
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
    console.log(`[TimetableDataProcessorUtils] *** VALIDATING RECORDS WITH NUMERIC TIME FIELDS ***`);
    
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

      // *** ОБНОВЛЕНО: Проверка числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      
      if (!timeData.isValidTime) {
        issues.push({
          recordId: record.ID,
          issue: `Invalid numeric time fields: ${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`,
          severity: 'ERROR'
        });
        timeIssues++;
        recordHasIssues = true;
      }

      // Проверка на слишком длинные смены (более 24 часов)
      if (timeData.isValidTime && timeData.hasWorkTime) {
        const startMinutes = timeData.startHours * 60 + timeData.startMinutes;
        const endMinutes = timeData.endHours * 60 + timeData.endMinutes;
        
        let durationMinutes = 0;
        if (endMinutes >= startMinutes) {
          durationMinutes = endMinutes - startMinutes;
        } else {
          // Смена через полночь
          durationMinutes = (24 * 60) - startMinutes + endMinutes;
        }
        
        const durationHours = durationMinutes / 60;
        if (durationHours > 24) {
          issues.push({
            recordId: record.ID,
            issue: `Shift duration ${durationHours.toFixed(1)} hours seems excessive`,
            severity: 'WARNING'
          });
          dataInconsistencies++;
        }
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

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Validation completed WITH NUMERIC FIELDS ***`, {
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
   * ОБНОВЛЕНО: Использует числовые поля времени для анализа
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
    console.log(`[TimetableDataProcessorUtils] *** GENERATING STATISTICS WITH NUMERIC FIELDS ***`);
    
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

    // *** ОБНОВЛЕННЫЙ АНАЛИЗ ВРЕМЕННЫХ ПАТТЕРНОВ С ЧИСЛОВЫМИ ПОЛЯМИ ***
    let recordsWithWorkTime = 0;
    let recordsWithHolidays = 0;
    let recordsWithLeave = 0;
    let recordsWithBoth = 0;
    let completeRecords = 0;

    records.forEach(record => {
      let isComplete = true;

      // *** ПРОВЕРЯЕМ РАБОЧЕЕ ВРЕМЯ ЧЕРЕЗ ЧИСЛОВЫЕ ПОЛЯ ***
      const timeData = this.extractTimeFromRecord(record);
      if (timeData.hasWorkTime) recordsWithWorkTime++;

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
      if (!timeData.isValidTime) isComplete = false;

      if (isComplete) completeRecords++;
    });

    const incompleteRecords = totalRecords - completeRecords;
    const qualityScore = totalRecords > 0 ? Math.round((completeRecords / totalRecords) * 100) : 0;

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Statistics generated WITH NUMERIC FIELDS ***`, {
      totalRecords,
      dateSpan: `${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`,
      uniqueStaff,
      recordsWithWorkTime,
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
   * ОБНОВЛЕНО: Проверяет числовые поля времени при оптимизации
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
    console.log(`[TimetableDataProcessorUtils] *** OPTIMIZING RECORDS WITH NUMERIC FIELDS ***`);
    
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

    // *** УДАЛЯЕМ ЗАПИСИ С НЕВАЛИДНЫМИ ЧИСЛОВЫМИ ПОЛЯМИ ВРЕМЕНИ ***
    const validTimeRecords = optimizedRecords.filter(record => {
      const timeData = this.extractTimeFromRecord(record);
      if (!timeData.isValidTime) {
        optimizations.push(`Removed record ${record.ID} - invalid numeric time fields`);
        return false;
      }
      return true;
    });
    optimizedRecords = validTimeRecords;

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

    console.log(`[TimetableDataProcessorUtils] *** v4.1: Records optimized WITH NUMERIC FIELDS ***`, {
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
   * ОБНОВЛЕНО: Указывает на поддержку числовых полей времени
   */
  public static getModuleInfo(): {
    version: string;
    module: string;
    features: string[];
    totalMethods: number;
    numericFieldsSupport: boolean;
  } {
    return {
      version: '4.1',
      module: 'TimetableDataProcessorUtils',
      features: [
       'Enhanced record retrieval for days with numeric time fields',
       'Holiday counting in weekly data',
       'Non-work markers analysis with numeric fields',
       'Date calculations with validation',
       'Records integrity validation for numeric time fields',
       'Flexible grouping utilities',
       'Comprehensive statistics generation with numeric support',
       'Performance optimization with numeric validation',
       'Advanced indexing'
     ],
     totalMethods: Object.getOwnPropertyNames(TimetableDataProcessorUtils)
       .filter(name => typeof TimetableDataProcessorUtils[name as keyof typeof TimetableDataProcessorUtils] === 'function')
       .length,
     numericFieldsSupport: true
   };
 }
}