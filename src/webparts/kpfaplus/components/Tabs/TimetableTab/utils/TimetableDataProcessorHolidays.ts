// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorHolidays.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IShiftInfo, TIMETABLE_COLORS } from '../interfaces/TimetableInterfaces';

/**
 * Specialized module for holidays analysis and processing
 * Extracted from TimetableDataProcessorCore for better maintainability
 * Version 4.2 - UPDATED: Migrated to numeric time fields (ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes)
 */
export class TimetableDataProcessorHolidays {

  /**
   * *** КЛЮЧЕВОЙ МЕТОД v4.2 - UPDATED FOR NUMERIC FIELDS ***
   * Анализирует записи дня на предмет праздников
   * REFACTORED: Extracted from core for better organization
   */
  public static analyzeHolidayInfoFromRecords(
    allDayRecords: IStaffRecord[]
  ): {
    hasNonWorkHoliday: boolean;
    nonWorkHolidayRecords: number;
  } {
    let hasNonWorkHoliday = false;
    let nonWorkHolidayRecords = 0;

    allDayRecords.forEach(record => {
      // *** UPDATED v4.2: Проверяем есть ли рабочее время используя числовые поля ***
      const startHours = record.ShiftDate1Hours ?? 0;
      const startMinutes = record.ShiftDate1Minutes ?? 0;
      const endHours = record.ShiftDate2Hours ?? 0;
      const endMinutes = record.ShiftDate2Minutes ?? 0;
      
      const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);

      // Если нет рабочего времени, но есть отметка праздника
      if (!hasWorkTime && record.Holiday === 1) {
        hasNonWorkHoliday = true;
        nonWorkHolidayRecords++;
      }
    });

    console.log(`[TimetableDataProcessorHolidays] *** v4.2: Holiday analysis ***`, {
      totalRecords: allDayRecords.length,
      hasNonWorkHoliday,
      nonWorkHolidayRecords
    });

    return {
      hasNonWorkHoliday,
      nonWorkHolidayRecords
    };
  }

  /**
   * Анализирует записи на наличие праздников (включая записи без рабочего времени)
   * REFACTORED v4.2: Comprehensive holiday analysis
   */
  public static analyzeHolidayRecords(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithHoliday: number;
    recordsWithLeaveType: number;
    recordsWithBoth: number;
    holidayPercentage: number;
    workHolidayRecords: number;
    nonWorkHolidayRecords: number;
  } {
    const totalRecords = records.length;
    const recordsWithHoliday = records.filter(r => r.Holiday === 1).length;
    const recordsWithLeaveType = records.filter(r => r.TypeOfLeaveID).length;
    const recordsWithBoth = records.filter(r => r.Holiday === 1 && r.TypeOfLeaveID).length;
    const holidayPercentage = totalRecords > 0 ? Math.round((recordsWithHoliday / totalRecords) * 100) : 0;

    // Разделяем записи с праздниками на рабочие и нерабочие
    let workHolidayRecords = 0;
    let nonWorkHolidayRecords = 0;

    records.filter(r => r.Holiday === 1).forEach(record => {
      // *** UPDATED v4.2: Используем числовые поля времени ***
      const startHours = record.ShiftDate1Hours ?? 0;
      const startMinutes = record.ShiftDate1Minutes ?? 0;
      const endHours = record.ShiftDate2Hours ?? 0;
      const endMinutes = record.ShiftDate2Minutes ?? 0;
      
      const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);

      if (hasWorkTime) {
        workHolidayRecords++;
      } else {
        nonWorkHolidayRecords++;
      }
    });

    return {
      totalRecords,
      recordsWithHoliday,
      recordsWithLeaveType,
      recordsWithBoth,
      holidayPercentage,
      workHolidayRecords,
      nonWorkHolidayRecords
    };
  }

  /**
   * Создает "пустую" смену для отметки праздника без рабочего времени
   * REFACTORED v4.2: Holiday marker creation
   */
  public static createNonWorkHolidayMarker(
    recordId: string,
    date: Date,
    holidayColor?: string
  ): IShiftInfo {
    // Создаем фиктивные времена 00:00
    const zeroTime = new Date(date);
    zeroTime.setHours(0, 0, 0, 0);

    return {
      recordId: recordId,
      startTime: zeroTime,
      endTime: zeroTime,
      lunchStart: undefined,
      lunchEnd: undefined,
      timeForLunch: 0,
      workMinutes: 0,
      formattedShift: "Holiday", // Вместо времени показываем "Holiday"
      typeOfLeaveId: undefined,
      typeOfLeaveTitle: undefined,
      typeOfLeaveColor: undefined,
      // Отмечаем как праздник
      isHoliday: true,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY
    };
  }

  /**
   * Анализирует праздничные записи по дням недели
   * REFACTORED v4.2: Day-wise holiday analysis
   */
  public static analyzeHolidaysByDayOfWeek(
    records: IStaffRecord[]
  ): {
    holidaysByDay: Record<number, number>; // day of week -> count
    totalHolidayRecords: number;
    mostCommonHolidayDay: { dayNumber: number; dayName: string; count: number } | undefined;
    holidayDistribution: Array<{ dayNumber: number; dayName: string; count: number; percentage: number }>;
  } {
    const holidaysByDay: Record<number, number> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let totalHolidayRecords = 0;

    // Анализируем записи с праздниками
    records.filter(r => r.Holiday === 1).forEach(record => {
      totalHolidayRecords++;
      const dayOfWeek = record.Date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      holidaysByDay[dayOfWeek] = (holidaysByDay[dayOfWeek] || 0) + 1;
    });

    // Находим самый частый день для праздников
    let mostCommonHolidayDay: { dayNumber: number; dayName: string; count: number } | undefined;
    let maxCount = 0;

    Object.entries(holidaysByDay).forEach(([dayNum, count]) => {
      if (count > maxCount) {
        maxCount = count;
        const dayNumber = parseInt(dayNum);
        mostCommonHolidayDay = {
          dayNumber,
          dayName: dayNames[dayNumber],
          count
        };
      }
    });

    // Создаем распределение
    const holidayDistribution: Array<{ dayNumber: number; dayName: string; count: number; percentage: number }> = [];
    for (let i = 0; i < 7; i++) {
      const count = holidaysByDay[i] || 0;
      holidayDistribution.push({
        dayNumber: i,
        dayName: dayNames[i],
        count,
        percentage: totalHolidayRecords > 0 ? Math.round((count / totalHolidayRecords) * 100) : 0
      });
    }

    return {
      holidaysByDay,
      totalHolidayRecords,
      mostCommonHolidayDay,
      holidayDistribution
    };
  }

  /**
   * Валидирует качество данных о праздниках
   * REFACTORED v4.2: Holiday data validation
   */
  public static validateHolidayData(
    records: IStaffRecord[]
  ): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    statistics: {
      totalRecords: number;
      recordsWithHoliday: number;
      validHolidayRecords: number;
      invalidHolidayRecords: number;
      holidayDataQuality: string;
    };
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    const totalRecords = records.length;
    let recordsWithHoliday = 0;
    let validHolidayRecords = 0;
    let invalidHolidayRecords = 0;

    records.forEach(record => {
      if (record.Holiday === 1) {
        recordsWithHoliday++;
        
        // Проверяем валидность записи праздника
        if (!record.Date || isNaN(record.Date.getTime())) {
          issues.push(`Holiday record ${record.ID} has invalid date`);
          invalidHolidayRecords++;
        } else {
          validHolidayRecords++;
        }
        
        // Проверяем логическую согласованность
        // *** UPDATED v4.2: Используем числовые поля времени ***
        const startHours = record.ShiftDate1Hours ?? 0;
        const startMinutes = record.ShiftDate1Minutes ?? 0;
        const endHours = record.ShiftDate2Hours ?? 0;
        const endMinutes = record.ShiftDate2Minutes ?? 0;
        
        const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);
            
        if (hasWorkTime) {
          warnings.push(`Holiday record ${record.ID} has both holiday flag and work time - unusual combination`);
        }
        
        // Проверяем комбинацию с отпуском
        if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
          warnings.push(`Holiday record ${record.ID} also has leave type ${record.TypeOfLeaveID} - holiday takes priority`);
        }
      }
    });

    let holidayDataQuality = 'UNKNOWN';
    if (recordsWithHoliday === 0) {
      holidayDataQuality = 'NO_HOLIDAYS';
    } else if (validHolidayRecords === recordsWithHoliday) {
      holidayDataQuality = 'EXCELLENT';
    } else if (validHolidayRecords / recordsWithHoliday > 0.9) {
      holidayDataQuality = 'GOOD';
    } else if (validHolidayRecords / recordsWithHoliday > 0.7) {
      holidayDataQuality = 'FAIR';
    } else {
      holidayDataQuality = 'POOR';
    }

    const isValid = issues.length === 0 && invalidHolidayRecords === 0;

    return {
      isValid,
      issues,
      warnings,
      statistics: {
        totalRecords,
        recordsWithHoliday,
        validHolidayRecords,
        invalidHolidayRecords,
        holidayDataQuality
      }
    };
  }

  /**
   * Создает сводку по праздникам
   * REFACTORED v4.2: Comprehensive holiday summary
   */
  public static createHolidaysSummary(
    records: IStaffRecord[]
  ): {
    totalHolidayRecords: number;
    holidayDates: Array<{
      date: string;
      count: number;
      staffMembers: string[];
    }>;
    holidayPatterns: {
      workHolidays: number;
      nonWorkHolidays: number;
      mixedWithLeave: number;
    };
    qualityScore: number;
    recommendations: string[];
  } {
    const holidayRecords = records.filter(r => r.Holiday === 1);
    const totalHolidayRecords = holidayRecords.length;
    
    // Группируем по датам
    const holidayDatesMap = new Map<string, { date: string; count: number; staffMembers: string[] }>();
    
    let workHolidays = 0;
    let nonWorkHolidays = 0;
    let mixedWithLeave = 0;

    holidayRecords.forEach(record => {
      const dateStr = record.Date.toLocaleDateString('en-GB');
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      
      if (!holidayDatesMap.has(dateStr)) {
        holidayDatesMap.set(dateStr, {
          date: dateStr,
          count: 0,
          staffMembers: []
        });
      }
      
      const dateEntry = holidayDatesMap.get(dateStr)!;
      dateEntry.count++;
      if (!dateEntry.staffMembers.includes(staffId)) {
        dateEntry.staffMembers.push(staffId);
      }
      
      // Анализируем паттерны
      // *** UPDATED v4.2: Используем числовые поля времени ***
      const startHours = record.ShiftDate1Hours ?? 0;
      const startMinutes = record.ShiftDate1Minutes ?? 0;
      const endHours = record.ShiftDate2Hours ?? 0;
      const endMinutes = record.ShiftDate2Minutes ?? 0;
      
      const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);
      
      if (hasWorkTime) {
        workHolidays++;
      } else {
        nonWorkHolidays++;
      }
      
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        mixedWithLeave++;
      }
    });

    const holidayDates: Array<{
      date: string;
      count: number;
      staffMembers: string[];
    }> = [];
    
    holidayDatesMap.forEach(entry => {
      holidayDates.push(entry);
    });
    
    // Сортируем по дате
    holidayDates.sort((a, b) => new Date(a.date.split('/').reverse().join('-')).getTime() - 
                              new Date(b.date.split('/').reverse().join('-')).getTime());

    // Вычисляем качественный балл
    let qualityScore = 100;
    
    // Снижаем балл за смешанные записи
    if (totalHolidayRecords > 0) {
      const mixedPercentage = mixedWithLeave / totalHolidayRecords;
      if (mixedPercentage > 0.1) {
        qualityScore -= mixedPercentage * 30; // До -30 баллов за смешанные записи
      }
    }
    
    qualityScore = Math.max(0, Math.round(qualityScore));

    // Генерируем рекомендации
    const recommendations: string[] = [];
    
    if (totalHolidayRecords === 0) {
      recommendations.push('No holiday records found - consider if holidays should be marked in the system');
    }
    
    if (mixedWithLeave > 0) {
      recommendations.push(`${mixedWithLeave} records have both holiday and leave type - holiday takes priority, consider data cleanup`);
    }
    
    if (workHolidays > nonWorkHolidays) {
      recommendations.push('More holidays with work time than without - verify if this is intentional');
    }
    
    if (qualityScore < 80) {
      recommendations.push('Holiday data quality is below 80% - review holiday marking practices');
    }

    return {
      totalHolidayRecords,
      holidayDates,
      holidayPatterns: {
        workHolidays,
        nonWorkHolidays,
        mixedWithLeave
      },
      qualityScore,
      recommendations
    };
  }

  /**
   * Получает статистику использования праздников по периодам
   * REFACTORED v4.2: Time-based holiday analysis
   */
  public static getHolidayUsageByPeriod(
    records: IStaffRecord[],
    startDate: Date,
    endDate: Date
  ): {
    totalDays: number;
    daysWithHolidays: number;
    holidayDensity: number;
    weeklyBreakdown: Array<{
      weekStart: string;
      weekEnd: string;
      holidayCount: number;
      staffCount: number;
    }>;
    monthlyBreakdown: Array<{
      month: string;
      holidayCount: number;
      staffCount: number;
    }>;
  } {
    const holidayRecords = records.filter(r => 
      r.Holiday === 1 && 
      r.Date >= startDate && 
      r.Date <= endDate
    );

    // Подсчитываем уникальные даты с праздниками
    const holidayDatesSet = new Set<string>();
    holidayRecords.forEach(record => {
      holidayDatesSet.add(record.Date.toDateString());
    });

    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const daysWithHolidays = holidayDatesSet.size;
    const holidayDensity = totalDays > 0 ? Math.round((daysWithHolidays / totalDays) * 100) : 0;

    // Недельная разбивка
    const weeklyBreakdown: Array<{
      weekStart: string;
      weekEnd: string;
      holidayCount: number;
      staffCount: number;
    }> = [];

    // Месячная разбивка
    const monthlyMap = new Map<string, { holidayCount: number; staffSet: Set<string> }>();

    holidayRecords.forEach(record => {
      const monthYear = record.Date.toLocaleDateString('en-GB', { month: '2-digit', year: 'numeric' });
      const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
      
      if (!monthlyMap.has(monthYear)) {
        monthlyMap.set(monthYear, { holidayCount: 0, staffSet: new Set() });
      }
      
      const monthEntry = monthlyMap.get(monthYear)!;
      monthEntry.holidayCount++;
      monthEntry.staffSet.add(staffId);
    });

    const monthlyBreakdown: Array<{
      month: string;
      holidayCount: number;
      staffCount: number;
    }> = [];

    monthlyMap.forEach((data, month) => {
      monthlyBreakdown.push({
        month,
        holidayCount: data.holidayCount,
        staffCount: data.staffSet.size
      });
    });

    // Сортируем по месяцам
    monthlyBreakdown.sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalDays,
      daysWithHolidays,
      holidayDensity,
      weeklyBreakdown,
      monthlyBreakdown
    };
  }

  /**
   * Проверяет конфликты между праздниками и отпусками
   * REFACTORED v4.2: Conflict detection
   */
  public static detectHolidayLeaveConflicts(
    records: IStaffRecord[]
  ): {
    totalConflicts: number;
    conflictRecords: Array<{
      recordId: string;
      date: string;
      staffId: string;
      leaveTypeId: string;
      leaveTypeTitle?: string;
      resolution: string;
    }>;
    resolutionSummary: {
      holidayPriority: number;
      needsReview: number;
    };
  } {
    const conflictRecords: Array<{
      recordId: string;
      date: string;
      staffId: string;
      leaveTypeId: string;
      leaveTypeTitle?: string;
      resolution: string;
    }> = [];

    let holidayPriority = 0;
    const needsReview = 0;

    records.forEach(record => {
      if (record.Holiday === 1 && record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
        const dateStr = record.Date.toLocaleDateString('en-GB');
        
        conflictRecords.push({
          recordId: record.ID,
          date: dateStr,
          staffId,
          leaveTypeId: record.TypeOfLeaveID,
          leaveTypeTitle: record.TypeOfLeave?.Title,
          resolution: 'Holiday takes priority over leave type'
        });

        holidayPriority++;
      }
    });

    return {
      totalConflicts: conflictRecords.length,
      conflictRecords,
      resolutionSummary: {
        holidayPriority,
        needsReview
      }
    };
  }
}