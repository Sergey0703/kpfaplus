// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorUtils.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IWeeklyStaffData, IDayInfo } from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';

/**
 * Specialized module for utility functions and helpers
 * ОБНОВЛЕНО v5.0: Полная поддержка Date-only формата + числовые поля времени
 * Date-only: Поле Date больше не содержит время, все временные операции через числовые поля
 */
export class TimetableDataProcessorUtils {

  /**
   * ОБНОВЛЕНО v5.0: Извлекает время из записи используя числовые поля
   * Date-only: Поле Date теперь содержит только дату
   */
  private static extractTimeFromRecord(record: IStaffRecord): {
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
    isValidTime: boolean;
    hasWorkTime: boolean;
    recordDate: Date; // Date-only field
  } {
    console.log(`[TimetableDataProcessorUtils] v5.0: Extracting time from numeric fields for record ${record.ID}`);
    
    // *** ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
    const startHours = record.ShiftDate1Hours ?? 0;
    const startMinutes = record.ShiftDate1Minutes ?? 0;
    const endHours = record.ShiftDate2Hours ?? 0;
    const endMinutes = record.ShiftDate2Minutes ?? 0;
    
    // *** Date-only поле ***
    const recordDate = new Date(record.Date);
    
    console.log(`[TimetableDataProcessorUtils] v5.0: Record ${record.ID} extraction:`, {
      dateOnly: recordDate.toLocaleDateString(),
      dateISO: recordDate.toISOString(),
      numericTime: `${startHours}:${startMinutes.toString().padStart(2, '0')} - ${endHours}:${endMinutes.toString().padStart(2, '0')}`,
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes
    });
    
    // Валидация числовых значений времени
    const isValidTime = (
      startHours >= 0 && startHours <= 23 &&
      startMinutes >= 0 && startMinutes <= 59 &&
      endHours >= 0 && endHours <= 23 &&
      endMinutes >= 0 && endMinutes <= 59
    );
    
    // Проверяем наличие рабочего времени (не 00:00 - 00:00)
    const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);
    
    if (!isValidTime) {
      console.warn(`[TimetableDataProcessorUtils] v5.0: Invalid numeric time in record ${record.ID}:`, {
        startHours, startMinutes, endHours, endMinutes
      });
    }
    
    // *** Date-only валидация ***
    if (isNaN(recordDate.getTime())) {
      console.warn(`[TimetableDataProcessorUtils] v5.0: Invalid date-only field in record ${record.ID}`);
    }
    
    return {
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      isValidTime,
      hasWorkTime,
      recordDate
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Нормализует дату к date-only формату
   */
  private static normalizeDateToDateOnly(date: Date): Date {
    const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return normalized;
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает ВСЕ записи для конкретного дня недели с Date-only поддержкой
   * (включая без рабочего времени)
   */
  public static getAllRecordsForDayEnhanced(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    console.log(`[TimetableDataProcessorUtils] v5.0: Getting all records for day ${dayNumber} with date-only support`);
    
    // Нормализуем границы недели к date-only
    const normalizedWeekStart = this.normalizeDateToDateOnly(weekStart);
    const normalizedWeekEnd = this.normalizeDateToDateOnly(weekEnd);
    
    // Фильтруем ВСЕ записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const timeData = this.extractTimeFromRecord(record);
      const recordDate = timeData.recordDate;
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableDataProcessorUtils] v5.0: Invalid date-only field in record ${record.ID}`);
        return false;
      }

      // Нормализуем дату записи к date-only
      const normalizedRecordDate = this.normalizeDateToDateOnly(recordDate);
      const recordDayNumber = TimetableShiftCalculatorCore.getDayNumber(normalizedRecordDate);
      
      // Date-only проверка принадлежности к неделе
      const isInWeek = normalizedRecordDate >= normalizedWeekStart && normalizedRecordDate <= normalizedWeekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      console.log(`[TimetableDataProcessorUtils] v5.0: Record ${record.ID} day filter (date-only):`, {
        recordDate: normalizedRecordDate.toLocaleDateString(),
        recordDayNumber,
        targetDayNumber: dayNumber,
        weekStart: normalizedWeekStart.toLocaleDateString(),
        weekEnd: normalizedWeekEnd.toLocaleDateString(),
        isCorrectDay,
        isInWeek,
        finalResult: isCorrectDay && isInWeek
      });
      
      return isCorrectDay && isInWeek;
    });

    console.log(`[TimetableDataProcessorUtils] v5.0: Found ${dayRecords.length} total records for day ${dayNumber}`);

    // *** ДИАГНОСТИКА С ЧИСЛОВЫМИ ПОЛЯМИ ***
    const recordsWithLeave = dayRecords.filter(r => r.TypeOfLeaveID && r.TypeOfLeaveID !== '0');
    const recordsWithHoliday = dayRecords.filter(r => r.Holiday === 1); // Старое поле для совместимости
    const recordsWithWorkTime = dayRecords.filter(r => {
      const timeData = this.extractTimeFromRecord(r);
      return timeData.hasWorkTime;
    });

    console.log(`[TimetableDataProcessorUtils] v5.0: Day ${dayNumber} records analysis with date-only + numeric fields:`, {
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
   * ОБНОВЛЕНО v5.0: Анализирует записи на наличие отметок без рабочего времени
   * Date-only + числовые поля времени
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
    dateOnlyStatistics: {
      recordsWithValidDates: number;
      recordsWithInvalidDates: number;
      dateRange: {
        earliest?: string;
        latest?: string;
        spanDays: number;
      };
    };
  } {
    console.log(`[TimetableDataProcessorUtils] v5.0: Analyzing non-work markers with date-only + numeric fields`);
    
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

    // *** НОВОЕ v5.0: Date-only статистика ***
    let recordsWithValidDates = 0;
    let recordsWithInvalidDates = 0;
    const validDates: Date[] = [];

    records.forEach(record => {
      // *** ПРОВЕРЯЕМ РАБОЧЕЕ ВРЕМЯ ЧЕРЕЗ ЧИСЛОВЫЕ ПОЛЯ ***
      const timeData = this.extractTimeFromRecord(record);
      const hasWorkTime = timeData.hasWorkTime;
      const recordDate = timeData.recordDate;

      // *** Date-only валидация ***
      if (isNaN(recordDate.getTime())) {
        recordsWithInvalidDates++;
        console.warn(`[TimetableDataProcessorUtils] v5.0: Invalid date-only field in record ${record.ID}`);
      } else {
        recordsWithValidDates++;
        validDates.push(this.normalizeDateToDateOnly(recordDate));
      }

      const isHoliday = record.Holiday === 1; // Старое поле для совместимости
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';

      console.log(`[TimetableDataProcessorUtils] v5.0: Record ${record.ID} analysis:`, {
        dateOnly: recordDate.toLocaleDateString(),
        numericTime: `${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`,
        hasWork: hasWorkTime,
        isHoliday,
        hasLeaveType
      });

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

    // *** НОВОЕ v5.0: Анализ диапазона дат ***
    let dateRange = {
      earliest: undefined as string | undefined,
      latest: undefined as string | undefined,
      spanDays: 0
    };

    if (validDates.length > 0) {
      const sortedDates = validDates.sort((a, b) => a.getTime() - b.getTime());
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];
      
      dateRange = {
        earliest: earliestDate.toLocaleDateString(),
        latest: latestDate.toLocaleDateString(),
        spanDays: Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      };
    }

    console.log(`[TimetableDataProcessorUtils] v5.0: Non-work markers analysis with date-only + numeric fields:`, {
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
      },
      dateOnlyStatistics: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        dateRange
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
      },
      dateOnlyStatistics: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        dateRange
      }
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает дату для дня недели в рамках недели с Date-only поддержкой
   */
  public static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    if (dayNumber < 1 || dayNumber > 7) {
      console.warn(`[TimetableDataProcessorUtils] v5.0: Invalid day number: ${dayNumber}, using 1`);
      dayNumber = 1;
    }

    // Нормализуем weekStart к date-only
    const normalizedWeekStart = this.normalizeDateToDateOnly(weekStart);
    const startDayNumber = TimetableShiftCalculatorCore.getDayNumber(normalizedWeekStart);
    
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7;
    }
    
    const date = new Date(normalizedWeekStart.getFullYear(), normalizedWeekStart.getMonth(), normalizedWeekStart.getDate());
    date.setDate(normalizedWeekStart.getDate() + offset);
    
    console.log(`[TimetableDataProcessorUtils] v5.0: Date-only day calculation:`, {
      weekStart: normalizedWeekStart.toLocaleDateString(),
      dayNumber,
      startDayNumber,
      offset,
      resultDate: date.toLocaleDateString(),
      resultISO: date.toISOString()
    });
    
    return date;
  }

  /**
   * ОБНОВЛЕНО v5.0: Валидирует записи на корректность данных
   * Date-only + числовые поля времени
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
    dateOnlyAnalysis: {
      recordsWithValidDates: number;
      recordsWithInvalidDates: number;
      dateRangeSpanDays: number;
      timezoneSafetyCheck: string;
    };
  } {
    console.log(`[TimetableDataProcessorUtils] v5.0: Validating records with date-only + numeric time fields`);
    
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

    // *** НОВОЕ v5.0: Date-only анализ ***
    let recordsWithValidDates = 0;
    let recordsWithInvalidDates = 0;
    const validDates: Date[] = [];

    records.forEach(record => {
      let recordHasIssues = false;

      // *** ОБНОВЛЕНО v5.0: Проверка date-only поля ***
      const timeData = this.extractTimeFromRecord(record);
      const recordDate = timeData.recordDate;
      
      if (!recordDate || isNaN(recordDate.getTime())) {
        issues.push({
          recordId: record.ID,
          issue: 'Invalid or missing Date field (date-only)',
          severity: 'ERROR'
        });
        dateIssues++;
        recordsWithInvalidDates++;
        recordHasIssues = true;
      } else {
        recordsWithValidDates++;
        validDates.push(this.normalizeDateToDateOnly(recordDate));
      }

      // *** ОБНОВЛЕНО v5.0: Проверка числовых полей времени ***
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

      // Проверка времени обеда (ShiftDate3/ShiftDate4 могут остаться DateTime полями)
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

      // Проверка полей отпуска и праздника (старое поле для совместимости)
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

    // *** НОВОЕ v5.0: Анализ date-only диапазона ***
    let dateRangeSpanDays = 0;
    let timezoneSafetyCheck = 'N/A';

    if (validDates.length > 0) {
      const sortedDates = validDates.sort((a, b) => a.getTime() - b.getTime());
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];
      
      dateRangeSpanDays = Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Проверяем, что все даты нормализованы к полуночи (timezone safety)
      const allDatesNormalized = validDates.every(date => 
        date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0
      );
      
      timezoneSafetyCheck = allDatesNormalized ? 'SAFE - All dates normalized' : 'WARNING - Some dates have time components';
    }

    const isValid = issues.filter(i => i.severity === 'ERROR').length === 0;

    console.log(`[TimetableDataProcessorUtils] v5.0: Validation completed with date-only + numeric fields:`, {
      totalRecords: records.length,
      validRecords,
      invalidRecords,
      errorIssues: issues.filter(i => i.severity === 'ERROR').length,
      warningIssues: issues.filter(i => i.severity === 'WARNING').length,
      recordsWithValidDates,
      recordsWithInvalidDates,
      dateRangeSpanDays,
      timezoneSafetyCheck
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
      },
      dateOnlyAnalysis: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        dateRangeSpanDays,
        timezoneSafetyCheck
      }
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Группирует записи по различным критериям с Date-only поддержкой
   */
  public static groupRecordsBy(
    records: IStaffRecord[],
    groupBy: 'date' | 'staff' | 'week' | 'month' | 'leaveType' | 'holiday'
  ): Record<string, IStaffRecord[]> {
    console.log(`[TimetableDataProcessorUtils] v5.0: Grouping ${records.length} records by ${groupBy} with date-only support`);
    
    const groups: Record<string, IStaffRecord[]> = {};

    records.forEach(record => {
      let groupKey = '';

      const timeData = this.extractTimeFromRecord(record);
      const recordDate = timeData.recordDate;

      switch (groupBy) {
        case 'date': {
          // *** Date-only группировка ***
          if (!isNaN(recordDate.getTime())) {
            groupKey = this.normalizeDateToDateOnly(recordDate).toLocaleDateString('en-GB');
          } else {
            groupKey = 'Invalid Date';
          }
          break;
        }
        case 'staff': {
          groupKey = record.StaffMemberLookupId?.toString() || 'Unknown';
          break;
        }
        case 'week': {
          // *** Date-only неделя ***
          if (!isNaN(recordDate.getTime())) {
            const weekStart = this.getWeekStartDateOnly(recordDate);
            groupKey = weekStart.toLocaleDateString('en-GB');
          } else {
            groupKey = 'Invalid Date';
          }
          break;
        }
        case 'month': {
          // *** Date-only месяц ***
          if (!isNaN(recordDate.getTime())) {
            groupKey = recordDate.toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' });
          } else {
            groupKey = 'Invalid Date';
          }
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

    console.log(`[TimetableDataProcessorUtils] v5.0: Grouped records by ${groupBy} with date-only support:`, {
      groupsCount: Object.keys(groups).length,
      groupSizes: Object.entries(groups).map(([key, value]) => ({ key, size: value.length }))
    });

    return groups;
  }

  /**
   * НОВЫЙ МЕТОД v5.0: Получает начало недели для даты (date-only)
   */
  private static getWeekStartDateOnly(date: Date): Date {
    const normalizedDate = this.normalizeDateToDateOnly(date);
    const dayOfWeek = normalizedDate.getDay(); // 0 = Sunday
    const diff = normalizedDate.getDate() - dayOfWeek;
    const weekStart = new Date(normalizedDate.getFullYear(), normalizedDate.getMonth(), diff);
    return weekStart;
  }

  /**
   * ОБНОВЛЕНО v5.0: Создает статистику по записям с Date-only поддержкой
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
    dateOnlyAnalysis: {
      recordsWithValidDates: number;
      recordsWithInvalidDates: number;
      timezoneSafetyScore: number;
      averageRecordsPerDay: number;
    };
  } {
    console.log(`[TimetableDataProcessorUtils] v5.0: Generating statistics with date-only support`);
    
    const totalRecords = records.length;
    
    if (totalRecords === 0) {
      return {
        totalRecords: 0,
        dateRange: { earliest: '', latest: '', spanDays: 0 },
        staffCoverage: { uniqueStaff: 0, staffWithMostRecords: { staffId: '', count: 0 }, averageRecordsPerStaff: 0 },
        timePatterns: { recordsWithWorkTime: 0, recordsWithHolidays: 0, recordsWithLeave: 0, recordsWithBoth: 0 },
        dataQuality: { completeRecords: 0, incompleteRecords: 0, qualityScore: 0 },
        dateOnlyAnalysis: { recordsWithValidDates: 0, recordsWithInvalidDates: 0, timezoneSafetyScore: 0, averageRecordsPerDay: 0 }
      };
    }

    // *** ОБНОВЛЕНО v5.0: Анализ date-only диапазона дат ***
    const validDates: Date[] = [];
    let recordsWithValidDates = 0;
    let recordsWithInvalidDates = 0;
    
    records.forEach(record => {
      const timeData = this.extractTimeFromRecord(record);
      if (!isNaN(timeData.recordDate.getTime())) {
        validDates.push(this.normalizeDateToDateOnly(timeData.recordDate));
        recordsWithValidDates++;
      } else {
        recordsWithInvalidDates++;
      }
    });

    let earliest = '';
    let latest = '';
    let spanDays = 0;
    let averageRecordsPerDay = 0;

    if (validDates.length > 0) {
      const sortedDates = validDates.sort((a, b) => a.getTime() - b.getTime());
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];
      
      earliest = earliestDate.toLocaleDateString('en-GB');
      latest = latestDate.toLocaleDateString('en-GB');
      spanDays = Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      averageRecordsPerDay = spanDays > 0 ? Math.round((validDates.length / spanDays) * 100) / 100 : 0;
    }

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
    let timezoneSafetyScore = 0;

    records.forEach(record => {
      let isComplete = true;

      // *** ПРОВЕРЯЕМ РАБОЧЕЕ ВРЕМЯ ЧЕРЕЗ ЧИСЛОВЫЕ ПОЛЯ ***
      const timeData = this.extractTimeFromRecord(record);
      if (timeData.hasWorkTime) recordsWithWorkTime++;

      // Проверяем праздники (старое поле для совместимости)
      if (record.Holiday === 1) recordsWithHolidays++;

      // Проверяем отпуска
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') recordsWithLeave++;

      // Проверяем комбинации
      if (record.Holiday === 1 && record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithBoth++;
      }

      // Проверяем полноту записи
      if (isNaN(timeData.recordDate.getTime())) isComplete = false;
      if (!record.StaffMemberLookupId) isComplete = false;
      if (!timeData.isValidTime) isComplete = false;

      // *** НОВОЕ v5.0: Проверка timezone safety ***
      if (!isNaN(timeData.recordDate.getTime())) {
        const normalizedDate = this.normalizeDateToDateOnly(timeData.recordDate);
        if (normalizedDate.getHours() === 0 && normalizedDate.getMinutes() === 0 && normalizedDate.getSeconds() === 0) {
          timezoneSafetyScore++;
        }
      }

      if (isComplete) completeRecords++;
    });

    const incompleteRecords = totalRecords - completeRecords;
    const qualityScore = totalRecords > 0 ? Math.round((completeRecords / totalRecords) * 100) : 0;
    const timezoneSafetyScorePercent = recordsWithValidDates > 0 ? 
      Math.round((timezoneSafetyScore / recordsWithValidDates) * 100) : 0;

    console.log(`[TimetableDataProcessorUtils] v5.0: Statistics generated with date-only support:`, {
      totalRecords,
      dateSpan: `${earliest} - ${latest}`,
      uniqueStaff,
      recordsWithWorkTime,
      qualityScore: qualityScore + '%',
      recordsWithValidDates,
      timezoneSafetyScore: timezoneSafetyScorePercent + '%'
    });

    return {
      totalRecords,
      dateRange: {
        earliest,
        latest,
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
      },
      dateOnlyAnalysis: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        timezoneSafetyScore: timezoneSafetyScorePercent,
        averageRecordsPerDay
      }
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Оптимизирует список записей для обработки
   * Date-only + числовые поля времени
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
    dateOnlyOptimizations: {
      recordsWithNormalizedDates: number;
      duplicateDateRecordsRemoved: number;
      dateRangeOptimized: boolean;
    };
  } {
    console.log(`[TimetableDataProcessorUtils] v5.0: Optimizing records with date-only + numeric fields`);
    
    const originalSize = records.length;
    const optimizations: string[] = [];
    let optimizedRecords = [...records];

    // *** Date-only оптимизации ***
    let recordsWithNormalizedDates = 0;
    let duplicateDateRecordsRemoved = 0;
    let dateRangeOptimized = false;

    // Удаляем записи с невалидными date-only полями
    const validDateRecords = optimizedRecords.filter(record => {
      const timeData = this.extractTimeFromRecord(record);
      const isValid = !isNaN(timeData.recordDate.getTime());
      if (!isValid) {
        optimizations.push(`Removed record ${record.ID} - invalid date-only field`);
      } else {
        recordsWithNormalizedDates++;
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

    // *** НОВОЕ v5.0: Оптимизация дубликатов по date-only + staff ***
    const uniqueRecordsMap = new Map<string, IStaffRecord>();
    optimizedRecords.forEach(record => {
      const timeData = this.extractTimeFromRecord(record);
      const normalizedDate = this.normalizeDateToDateOnly(timeData.recordDate);
      const uniqueKey = `${record.StaffMemberLookupId}-${normalizedDate.getTime()}`;
      
      if (uniqueRecordsMap.has(uniqueKey)) {
        duplicateDateRecordsRemoved++;
        optimizations.push(`Removed duplicate record ${record.ID} - same staff and date`);
      } else {
        uniqueRecordsMap.set(uniqueKey, record);
      }
    });
    
    optimizedRecords = Array.from(uniqueRecordsMap.values());

    // Сортируем по date-only для оптимизации последующей обработки
    optimizedRecords.sort((a, b) => {
      const aTimeData = this.extractTimeFromRecord(a);
      const bTimeData = this.extractTimeFromRecord(b);
      return aTimeData.recordDate.getTime() - bTimeData.recordDate.getTime();
    });
    optimizations.push('Records sorted by date-only for optimal processing');

    // *** НОВОЕ v5.0: Анализ оптимизации диапазона дат ***
    if (optimizedRecords.length > 0) {
      const dates = optimizedRecords.map(r => this.extractTimeFromRecord(r).recordDate);
      const sortedDates = dates.sort((a, b) => a.getTime() - b.getTime());
      const dateSpan = (sortedDates[sortedDates.length - 1].getTime() - sortedDates[0].getTime()) / (1000 * 60 * 60 * 24);
      
      if (dateSpan <= 90) { // Данные в пределах 3 месяцев
        dateRangeOptimized = true;
        optimizations.push('Date range optimized for efficient processing');
      }
    }

    const optimizedSize = optimizedRecords.length;
    const removedCount = originalSize - optimizedSize;
    const reductionPercentage = originalSize > 0 ? 
      Math.round((removedCount / originalSize) * 100) : 0;

    console.log(`[TimetableDataProcessorUtils] v5.0: Records optimized with date-only + numeric fields:`, {
      originalSize,
      optimizedSize,
      removedCount,
      reductionPercentage: reductionPercentage + '%',
      optimizations: optimizations.length,
      recordsWithNormalizedDates,
      duplicateDateRecordsRemoved,
      dateRangeOptimized
    });

    return {
      optimizedRecords,
      removedCount,
      optimizations,
      performance: {
        originalSize,
        optimizedSize,
        reductionPercentage
      },
      dateOnlyOptimizations: {
        recordsWithNormalizedDates,
        duplicateDateRecordsRemoved,
        dateRangeOptimized
      }
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Создает индекс записей для быстрого поиска с Date-only поддержкой
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
    dateOnlyIndexStats: {
      recordsWithValidDates: number;
      recordsWithInvalidDates: number;
      dateIndexEfficiency: number;
    };
  } {
    console.log(`[TimetableDataProcessorUtils] v5.0: Creating records index with date-only support`);
    
    const byStaff = new Map<string, IStaffRecord[]>();
    const byDate = new Map<string, IStaffRecord[]>();
    const byWeek = new Map<string, IStaffRecord[]>();
    const byLeaveType = new Map<string, IStaffRecord[]>();

    let recordsWithValidDates = 0;
    let recordsWithInvalidDates = 0;

    records.forEach(record => {
      // Индекс по сотрудникам
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      if (!byStaff.has(staffId)) {
        byStaff.set(staffId, []);
      }
      byStaff.get(staffId)!.push(record);

      // *** ОБНОВЛЕНО v5.0: Индекс по date-only датам ***
      const timeData = this.extractTimeFromRecord(record);
      if (!isNaN(timeData.recordDate.getTime())) {
        recordsWithValidDates++;
        const normalizedDate = this.normalizeDateToDateOnly(timeData.recordDate);
        const dateKey = normalizedDate.toLocaleDateString('en-GB');
        
        if (!byDate.has(dateKey)) {
          byDate.set(dateKey, []);
        }
        byDate.get(dateKey)!.push(record);

        // *** ОБНОВЛЕНО v5.0: Индекс по date-only неделям ***
        const weekStart = this.getWeekStartDateOnly(normalizedDate);
        const weekKey = weekStart.toLocaleDateString('en-GB');
        if (!byWeek.has(weekKey)) {
          byWeek.set(weekKey, []);
        }
        byWeek.get(weekKey)!.push(record);
      } else {
        recordsWithInvalidDates++;
      }

      // Индекс по типам отпусков
      const leaveTypeKey = record.TypeOfLeaveID || 'No Leave';
      if (!byLeaveType.has(leaveTypeKey)) {
        byLeaveType.set(leaveTypeKey, []);
      }
      byLeaveType.get(leaveTypeKey)!.push(record);
    });

    const dateIndexEfficiency = records.length > 0 ? 
      Math.round((recordsWithValidDates / records.length) * 100) : 0;

    const indexStats = {
      totalRecords: records.length,
      uniqueStaff: byStaff.size,
      uniqueDates: byDate.size,
      uniqueWeeks: byWeek.size,
      uniqueLeaveTypes: byLeaveType.size
    };

    const dateOnlyIndexStats = {
      recordsWithValidDates,
      recordsWithInvalidDates,
      dateIndexEfficiency
    };

    console.log(`[TimetableDataProcessorUtils] v5.0: Index created with date-only support:`, {
      ...indexStats,
      ...dateOnlyIndexStats
    });

    return {
      byStaff,
      byDate,
      byWeek,
      byLeaveType,
      indexStats,
      dateOnlyIndexStats
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Получает информацию о модуле
   */
  public static getModuleInfo(): {
    version: string;
    module: string;
    features: string[];
    totalMethods: number;
    dateOnlySupport: boolean;
    numericFieldsSupport: boolean;
    timezoneIssuesResolved: boolean;
  } {
    return {
      version: '5.0',
      module: 'TimetableDataProcessorUtils',
      features: [
        'Enhanced record retrieval for days with date-only + numeric time fields',
        'Holiday counting in weekly data',
        'Non-work markers analysis with date-only support',
        'Date calculations with timezone-safe validation',
        'Records integrity validation for date-only + numeric time fields',
        'Flexible grouping utilities with date-only support',
        'Comprehensive statistics generation with timezone safety',
        'Performance optimization with date-only validation',
        'Advanced indexing with date-only efficiency tracking',
        'Duplicate detection by date-only + staff combinations'
      ],
      totalMethods: Object.getOwnPropertyNames(TimetableDataProcessorUtils)
        .filter(name => typeof TimetableDataProcessorUtils[name as keyof typeof TimetableDataProcessorUtils] === 'function')
        .length,
      dateOnlySupport: true,
      numericFieldsSupport: true,
      timezoneIssuesResolved: true
    };
  }
}