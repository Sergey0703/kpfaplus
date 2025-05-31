// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataAnalytics.ts
import { 
  IDayInfo, 
  IWeekGroup,
  IWeeklyStaffData
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Аналитика и статистика для данных расписания
 * Сокращенная версия - только необходимые методы
 */
export class TimetableDataAnalytics {

  /**
   * Получает базовую статистику по данным
   */
  public static getAdvancedDataSummary(weekGroups: IWeekGroup[]): {
    totalWeeks: number;
    weeksWithData: number;
    totalStaff: number;
    totalRecords: number;
    totalShifts: number;
    totalWorkMinutes: number;
    totalLeaveShifts: number;
    uniqueLeaveTypes: number;
  } {
    const totalWeeks = weekGroups.length;
    const weeksWithData = weekGroups.filter(w => w.hasData).length;
    
    const firstWeekStaff = weekGroups.length > 0 ? weekGroups[0].staffRows : [];
    const totalStaff = firstWeekStaff.length;
    
    let totalRecords = 0;
    let totalShifts = 0;
    let totalWorkMinutes = 0;
    let totalLeaveShifts = 0;
    const allLeaveTypes = new Set<string>();
    
    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((dayData) => {
          const day = dayData as IDayInfo;
          totalRecords += day.shifts.length;
          totalShifts += day.shifts.length;
          totalWorkMinutes += day.totalMinutes;
          
          day.shifts.forEach(shift => {
            if (shift.typeOfLeaveId) {
              totalLeaveShifts++;
              allLeaveTypes.add(shift.typeOfLeaveId);
            }
          });
        });
      });
    });

    return {
      totalWeeks,
      weeksWithData,
      totalStaff,
      totalRecords,
      totalShifts,
      totalWorkMinutes,
      totalLeaveShifts,
      uniqueLeaveTypes: allLeaveTypes.size
    };
  }

  /**
   * Анализирует недельные данные сотрудника
   */
  public static analyzeStaffWeekData(weeklyData: IWeeklyStaffData): {
    hasData: boolean;
    totalDaysWithData: number;
    totalShifts: number;
    leaveTypesCount: number;
    totalMinutes: number;
  } {
    const daysWithData = Object.values(weeklyData.days).filter((dayData) => {
      const day = dayData as IDayInfo;
      return day.hasData;
    });
    const totalDaysWithData = daysWithData.length;
    
    let totalShifts = 0;
    const allLeaveTypes = new Set<string>();
    
    daysWithData.forEach((dayData) => {
      const day = dayData as IDayInfo;
      totalShifts += day.shifts.length;
      day.shifts.forEach(shift => {
        if (shift.typeOfLeaveId) {
          allLeaveTypes.add(shift.typeOfLeaveId);
        }
      });
    });
    
    return {
      hasData: totalDaysWithData > 0,
      totalDaysWithData,
      totalShifts,
      leaveTypesCount: allLeaveTypes.size,
      totalMinutes: weeklyData.totalWeekMinutes
    };
  }

  /**
   * Генерирует финальную статистику обработки
   */
  public static generateFinalStatistics(
    weekGroups: IWeekGroup[],
    staffRecords: IStaffRecord[],
    leaveTypesIndex: Record<string, { count: number; color?: string; title?: string }>
  ): {
    totalWeeksProcessed: number;
    weeksWithData: number;
    totalStaffProcessed: number;
    totalRecordsProcessed: number;
    totalLeaveTypes: number;
    recordsWithLeave: number;
  } {
    const weeksWithData = weekGroups.filter(w => w.hasData).length;
    const totalStaffProcessed = weekGroups.length > 0 ? weekGroups[0].staffRows.length : 0;
    const totalLeaveTypes = Object.keys(leaveTypesIndex).length;
    
    let recordsWithLeave = 0;
    Object.values(leaveTypesIndex).forEach(lt => {
      recordsWithLeave += lt.count;
    });
    
    return {
      totalWeeksProcessed: weekGroups.length,
      weeksWithData,
      totalStaffProcessed,
      totalRecordsProcessed: staffRecords.length,
      totalLeaveTypes,
      recordsWithLeave
    };
  }

  /**
   * Экспортирует базовые данные
   */
  public static exportWeeksDataWithLeaveColors(weekGroups: IWeekGroup[]): {
    metadata: {
      exportDate: string;
      totalWeeks: number;
      totalStaff: number;
      totalRecords: number;
    };
    weeks: Array<{
      weekNum: number;
      weekStart: string;
      weekEnd: string;
      staffCount: number;
    }>;
  } {
    let totalRecords = 0;
    
    const weeks = weekGroups.map(weekGroup => {
      const weekRecords = weekGroup.staffRows.reduce((sum, staffRow) => 
        sum + Object.values(staffRow.weekData.days).reduce((daySum, dayData) => 
          daySum + (dayData as IDayInfo).shifts.length, 0), 0);
      
      totalRecords += weekRecords;
      
      return {
        weekNum: weekGroup.weekInfo.weekNum,
        weekStart: weekGroup.weekInfo.weekStart.toISOString(),
        weekEnd: weekGroup.weekInfo.weekEnd.toISOString(),
        staffCount: weekGroup.staffRows.length
      };
    });

    return {
      metadata: {
        exportDate: new Date().toISOString(),
        totalWeeks: weekGroups.length,
        totalStaff: weekGroups.length > 0 ? weekGroups[0].staffRows.length : 0,
        totalRecords
      },
      weeks
    };
  }

  /**
   * Анализирует использование цветов отпусков (упрощенная версия)
   */
  public static analyzeLeaveColorsUsage(weekGroups: IWeekGroup[]): {
    totalDaysWithLeave: number;
    uniqueLeaveColors: number;
    leaveColorBreakdown: Array<{
      color: string;
      count: number;
      percentage: number;
    }>;
  } {
    const colorCounts = new Map<string, number>();
    let totalDaysWithLeave = 0;

    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((dayData) => {
          const day = dayData as IDayInfo;
          if (day.hasLeave && day.leaveTypeColor) {
            totalDaysWithLeave++;
            const existing = colorCounts.get(day.leaveTypeColor);
            colorCounts.set(day.leaveTypeColor, (existing || 0) + 1);
          }
        });
      });
    });

    const leaveColorBreakdown: Array<{
      color: string;
      count: number;
      percentage: number;
    }> = [];
    
    colorCounts.forEach((count, color) => {
      leaveColorBreakdown.push({
        color,
        count,
        percentage: totalDaysWithLeave > 0 ? Math.round((count / totalDaysWithLeave) * 100) : 0
      });
    });
    
    leaveColorBreakdown.sort((a, b) => b.count - a.count);

    return {
      totalDaysWithLeave,
      uniqueLeaveColors: colorCounts.size,
      leaveColorBreakdown
    };
  }

  /**
   * Анализирует метрики продуктивности (упрощенная версия)
   */
  public static analyzeProductivityMetrics(weekGroups: IWeekGroup[]): {
    averageHoursPerStaff: number;
    maxHoursPerStaff: number;
    minHoursPerStaff: number;
    staffUtilizationRate: number;
  } {
    const staffHours: number[] = [];
    
    if (weekGroups.length > 0) {
      const firstWeek = weekGroups[0];
      
      firstWeek.staffRows.forEach(staffRow => {
        let totalStaffHours = 0;
        
        weekGroups.forEach(weekGroup => {
          const matchingStaff = weekGroup.staffRows.find(s => s.staffId === staffRow.staffId);
          if (matchingStaff) {
            totalStaffHours += matchingStaff.weekData.totalWeekMinutes / 60;
          }
        });
        
        staffHours.push(Math.round(totalStaffHours * 100) / 100);
      });
    }
    
    const averageHoursPerStaff = staffHours.length > 0 ? 
      Math.round((staffHours.reduce((sum, h) => sum + h, 0) / staffHours.length) * 100) / 100 : 0;
    
    const maxHoursPerStaff = staffHours.length > 0 ? Math.max(...staffHours) : 0;
    const minHoursPerStaff = staffHours.length > 0 ? Math.min(...staffHours) : 0;
    
    const activeStaff = staffHours.filter(h => h > 0).length;
    const staffUtilizationRate = staffHours.length > 0 ? 
      Math.round((activeStaff / staffHours.length) * 100) : 0;

    return {
      averageHoursPerStaff,
      maxHoursPerStaff,
      minHoursPerStaff,
      staffUtilizationRate
    };
  }

  /**
   * Анализирует паттерны использования отпусков (упрощенная версия)
   */
  public static analyzeLeavePatterns(weekGroups: IWeekGroup[]): {
    totalLeaveRequests: number;
    leaveRequestsByType: Array<{ type: string; count: number; percentage: number }>;
    averageLeavePerStaff: number;
  } {
    let totalLeaveRequests = 0;
    const leaveTypesCounts = new Map<string, number>();
    const staffLeaveCounts = new Map<string, number>();
    
    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        let staffLeaveCount = 0;
        
        Object.values(staffRow.weekData.days).forEach((dayData) => {
          const day = dayData as IDayInfo;
          day.shifts.forEach(shift => {
            if (shift.typeOfLeaveId) {
              totalLeaveRequests++;
              staffLeaveCount++;
              
              const leaveType = shift.typeOfLeaveTitle || shift.typeOfLeaveId;
              leaveTypesCounts.set(leaveType, (leaveTypesCounts.get(leaveType) || 0) + 1);
            }
          });
        });
        
        if (staffLeaveCount > 0) {
          staffLeaveCounts.set(staffRow.staffName, 
            (staffLeaveCounts.get(staffRow.staffName) || 0) + staffLeaveCount);
        }
      });
    });
    
    const leaveRequestsByType: Array<{ type: string; count: number; percentage: number }> = [];
    leaveTypesCounts.forEach((count, type) => {
      leaveRequestsByType.push({
        type,
        count,
        percentage: totalLeaveRequests > 0 ? Math.round((count / totalLeaveRequests) * 100) : 0
      });
    });
    leaveRequestsByType.sort((a, b) => b.count - a.count);
    
    const totalStaff = weekGroups.length > 0 ? weekGroups[0].staffRows.length : 0;
    const averageLeavePerStaff = totalStaff > 0 ? 
      Math.round((totalLeaveRequests / totalStaff) * 100) / 100 : 0;
    
    return {
      totalLeaveRequests,
      leaveRequestsByType,
      averageLeavePerStaff
    };
  }

  /**
   * Создает базовый отчет
   */
  public static generateComprehensiveReport(weekGroups: IWeekGroup[]): {
    summary: ReturnType<typeof TimetableDataAnalytics.getAdvancedDataSummary>;
    leaveColors: ReturnType<typeof TimetableDataAnalytics.analyzeLeaveColorsUsage>;
    productivity: ReturnType<typeof TimetableDataAnalytics.analyzeProductivityMetrics>;
    leavePatterns: ReturnType<typeof TimetableDataAnalytics.analyzeLeavePatterns>;
    reportGeneratedAt: string;
  } {
    const summary = this.getAdvancedDataSummary(weekGroups);
    const leaveColors = this.analyzeLeaveColorsUsage(weekGroups);
    const productivity = this.analyzeProductivityMetrics(weekGroups);
    const leavePatterns = this.analyzeLeavePatterns(weekGroups);
    
    return {
      summary,
      leaveColors,
      productivity,
      leavePatterns,
      reportGeneratedAt: new Date().toISOString()
    };
  }
}