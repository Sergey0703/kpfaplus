// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataAnalytics.ts
import { 
  IDayInfo, 
  IWeekGroup,
  IShiftInfo,
  IWeeklyStaffData
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Аналитика и статистика для данных расписания
 * Содержит методы анализа, статистики, экспорта и отчетности
 * Версия 3.0 - Полная поддержка цветов отпусков
 */
export class TimetableDataAnalytics {

  // *** ОСНОВНАЯ СТАТИСТИКА ***

  /**
   * Получает расширенную сводную статистику по данным
   */
  public static getAdvancedDataSummary(weekGroups: IWeekGroup[]): {
    totalWeeks: number;
    weeksWithData: number;
    totalStaff: number;
    activeStaff: number;
    deletedStaff: number;
    templatesStaff: number;
    totalRecords: number;
    totalShifts: number;
    totalWorkMinutes: number;
    totalLeaveShifts: number;
    uniqueLeaveTypes: number;
    averageHoursPerWeek: number;
    dataCompleteness: number;
    leaveUsageRate: number;
  } {
    const totalWeeks = weekGroups.length;
    const weeksWithData = weekGroups.filter(w => w.hasData).length;
    
    // Берем данные из первой недели для анализа состава сотрудников
    const firstWeekStaff = weekGroups.length > 0 ? weekGroups[0].staffRows : [];
    const totalStaff = firstWeekStaff.length;
    
    let activeStaff = 0;
    let deletedStaff = 0;
    let templatesStaff = 0;
    let totalRecords = 0;
    let totalShifts = 0;
    let totalWorkMinutes = 0;
    let totalLeaveShifts = 0;
    const allLeaveTypes = new Set<string>();
    
    // Анализируем состав сотрудников
    firstWeekStaff.forEach(staff => {
      if (staff.isDeleted) deletedStaff++;
      else activeStaff++;
      if (!staff.hasPersonInfo) templatesStaff++;
    });
    
    // Анализируем все недели
    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((dayData) => {
          const day = dayData as IDayInfo;
          totalRecords += day.shifts.length;
          totalShifts += day.shifts.length;
          totalWorkMinutes += day.totalMinutes;
          
          // Анализируем отпуска
          day.shifts.forEach(shift => {
            if (shift.typeOfLeaveId) {
              totalLeaveShifts++;
              allLeaveTypes.add(shift.typeOfLeaveId);
            }
          });
        });
      });
    });

    const averageHoursPerWeek = totalStaff > 0 && totalWeeks > 0 ? 
      Math.round((totalWorkMinutes / 60) / (totalStaff * totalWeeks) * 100) / 100 : 0;
    
    const dataCompleteness = totalWeeks > 0 ? 
      Math.round((weeksWithData / totalWeeks) * 100) : 0;
    
    const leaveUsageRate = totalShifts > 0 ? 
      Math.round((totalLeaveShifts / totalShifts) * 100) : 0;

    return {
      totalWeeks,
      weeksWithData,
      totalStaff,
      activeStaff,
      deletedStaff,
      templatesStaff,
      totalRecords,
      totalShifts,
      totalWorkMinutes,
      totalLeaveShifts,
      uniqueLeaveTypes: allLeaveTypes.size,
      averageHoursPerWeek,
      dataCompleteness,
      leaveUsageRate
    };
  }

  // *** АНАЛИТИКА ЦВЕТОВ ОТПУСКОВ ***

  /**
   * Анализирует использование цветов отпусков
   */
  public static analyzeLeaveColorsUsage(weekGroups: IWeekGroup[]): {
    totalDaysWithLeave: number;
    uniqueLeaveColors: number;
    leaveColorBreakdown: Array<{
      color: string;
      count: number;
      percentage: number;
      associatedTypes: string[];
    }>;
    mostUsedLeaveColor?: string;
    leastUsedLeaveColor?: string;
    colorDistributionQuality: string;
  } {
    const colorCounts = new Map<string, { count: number; types: Set<string> }>();
    let totalDaysWithLeave = 0;

    // Собираем статистику по цветам
    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((dayData) => {
          const day = dayData as IDayInfo;
          if (day.hasLeave && day.leaveTypeColor) {
            totalDaysWithLeave++;
            
            if (!colorCounts.has(day.leaveTypeColor)) {
              colorCounts.set(day.leaveTypeColor, { count: 0, types: new Set() });
            }
            
            const colorData = colorCounts.get(day.leaveTypeColor)!;
            colorData.count++;
            
            // Собираем типы отпусков для этого цвета
            day.shifts.forEach(shift => {
              if (shift.typeOfLeaveTitle) {
                colorData.types.add(shift.typeOfLeaveTitle);
              }
            });
          }
        });
      });
    });

    // Создаем детальную разбивку
    const leaveColorBreakdown: Array<{
      color: string;
      count: number;
      percentage: number;
      associatedTypes: string[];
    }> = [];
    
    colorCounts.forEach((data, color) => {
      const associatedTypes: string[] = [];
      data.types.forEach(type => associatedTypes.push(type));
      
      leaveColorBreakdown.push({
        color,
        count: data.count,
        percentage: totalDaysWithLeave > 0 ? Math.round((data.count / totalDaysWithLeave) * 100) : 0,
        associatedTypes
      });
    });
    
    leaveColorBreakdown.sort((a, b) => b.count - a.count);

    const mostUsedLeaveColor = leaveColorBreakdown.length > 0 ? leaveColorBreakdown[0].color : undefined;
    const leastUsedLeaveColor = leaveColorBreakdown.length > 1 ? 
      leaveColorBreakdown[leaveColorBreakdown.length - 1].color : undefined;

    let colorDistributionQuality = 'NONE';
    if (colorCounts.size === 0) {
      colorDistributionQuality = 'NONE';
    } else if (colorCounts.size === 1) {
      colorDistributionQuality = 'SINGLE_COLOR';
    } else if (colorCounts.size <= 3) {
      colorDistributionQuality = 'LIMITED_VARIETY';
    } else {
      colorDistributionQuality = 'GOOD_VARIETY';
    }

    return {
      totalDaysWithLeave,
      uniqueLeaveColors: colorCounts.size,
      leaveColorBreakdown,
      mostUsedLeaveColor,
      leastUsedLeaveColor,
      colorDistributionQuality
    };
  }

  // *** АНАЛИЗ НЕДЕЛЬНЫХ ДАННЫХ ***

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
    daysWithData.forEach((dayData) => {
      const day = dayData as IDayInfo;
      totalShifts += day.shifts.length;
    });
    
    // Подсчитываем уникальные типы отпусков (исправлено для совместимости с ES5)
    const allShifts: IShiftInfo[] = [];
    daysWithData.forEach((dayData) => {
      const day = dayData as IDayInfo;
      day.shifts.forEach((shift: IShiftInfo) => {
        allShifts.push(shift);
      });
    });
    const leaveTypesCount = TimetableShiftCalculator.getUniqueLeaveTypes(allShifts).length;
    
    return {
      hasData: totalDaysWithData > 0,
      totalDaysWithData,
      totalShifts,
      leaveTypesCount,
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
    processingQuality: string;
    leaveColorsCoverage: string;
  } {
    const weeksWithData = weekGroups.filter(w => w.hasData).length;
    const totalStaffProcessed = weekGroups.length > 0 ? weekGroups[0].staffRows.length : 0;
    const totalLeaveTypes = Object.keys(leaveTypesIndex).length;
    
    let recordsWithLeave = 0;
    Object.values(leaveTypesIndex).forEach(lt => {
      recordsWithLeave += lt.count;
    });
    
    let processingQuality = 'UNKNOWN';
    let leaveColorsCoverage = 'NONE';
    
    if (weeksWithData > weekGroups.length * 0.8) {
      processingQuality = 'EXCELLENT';
    } else if (weeksWithData > weekGroups.length * 0.5) {
      processingQuality = 'GOOD';
    } else if (weeksWithData > 0) {
      processingQuality = 'FAIR';
    } else {
      processingQuality = 'POOR';
    }
    
    if (totalLeaveTypes === 0) {
      leaveColorsCoverage = 'NONE';
    } else if (recordsWithLeave < staffRecords.length * 0.1) {
      leaveColorsCoverage = 'LOW';
    } else if (recordsWithLeave < staffRecords.length * 0.3) {
      leaveColorsCoverage = 'MEDIUM';
    } else {
      leaveColorsCoverage = 'HIGH';
    }
    
    return {
      totalWeeksProcessed: weekGroups.length,
      weeksWithData,
      totalStaffProcessed,
      totalRecordsProcessed: staffRecords.length,
      totalLeaveTypes,
      recordsWithLeave,
      processingQuality,
      leaveColorsCoverage
    };
  }

  // *** АНАЛИЗ ПРОДУКТИВНОСТИ ***

  /**
   * Анализирует продуктивность и использование времени
   */
  public static analyzeProductivityMetrics(weekGroups: IWeekGroup[]): {
    averageHoursPerStaff: number;
    medianHoursPerStaff: number;
    maxHoursPerStaff: number;
    minHoursPerStaff: number;
    staffUtilizationRate: number;
    averageShiftsPerDay: number;
    peakWorkDays: Array<{ dayName: string; totalHours: number }>;
    underutilizedStaff: Array<{ staffName: string; totalHours: number }>;
    overutilizedStaff: Array<{ staffName: string; totalHours: number }>;
  } {
    const staffHours: Array<{ staffName: string; totalHours: number }> = [];
    const dayTotals: Record<number, number> = {};
    
    // Собираем данные по сотрудникам и дням
    if (weekGroups.length > 0) {
      const firstWeek = weekGroups[0];
      
      firstWeek.staffRows.forEach(staffRow => {
        let totalStaffHours = 0;
        
        weekGroups.forEach(weekGroup => {
          const matchingStaff = weekGroup.staffRows.find(s => s.staffId === staffRow.staffId);
          if (matchingStaff) {
            totalStaffHours += matchingStaff.weekData.totalWeekMinutes / 60;
            
            // Анализируем по дням недели
            Object.entries(matchingStaff.weekData.days).forEach(([dayNum, dayValue]) => {
              const dayNumber = parseInt(dayNum);
              const dayInfo = dayValue as IDayInfo;
              if (!dayTotals[dayNumber]) dayTotals[dayNumber] = 0;
              dayTotals[dayNumber] += dayInfo.totalMinutes / 60;
            });
          }
        });
        
        staffHours.push({
          staffName: staffRow.staffName,
          totalHours: Math.round(totalStaffHours * 100) / 100
        });
      });
    }
    
    // Рассчитываем статистики
    const hoursValues = staffHours.map(s => s.totalHours).sort((a, b) => a - b);
    const averageHoursPerStaff = hoursValues.length > 0 ? 
      Math.round((hoursValues.reduce((sum, h) => sum + h, 0) / hoursValues.length) * 100) / 100 : 0;
    
    const medianHoursPerStaff = hoursValues.length > 0 ? 
      hoursValues[Math.floor(hoursValues.length / 2)] : 0;
    
    const maxHoursPerStaff = hoursValues.length > 0 ? hoursValues[hoursValues.length - 1] : 0;
    const minHoursPerStaff = hoursValues.length > 0 ? hoursValues[0] : 0;
    
    // Показатель использования (процент сотрудников с > 0 часов)
    const activeStaff = staffHours.filter(s => s.totalHours > 0).length;
    const staffUtilizationRate = staffHours.length > 0 ? 
      Math.round((activeStaff / staffHours.length) * 100) : 0;
    
    // Среднее количество смен в день - ИСПРАВЛЕНО для TypeScript
    let totalShifts = 0;
    weekGroups.forEach(week => {
      week.staffRows.forEach(staff => {
        Object.values(staff.weekData.days).forEach((dayValue) => {
          const dayInfo = dayValue as IDayInfo;
          totalShifts += dayInfo.shifts.length;
        });
      });
    });
    
    const totalDays = weekGroups.length * 7;
    const averageShiftsPerDay = totalDays > 0 ? Math.round((totalShifts / totalDays) * 100) / 100 : 0;
    
    // Пиковые дни недели
    const peakWorkDays = Object.entries(dayTotals)
      .map(([dayNum, hours]) => ({
        dayName: TimetableWeekCalculator.getDayName(parseInt(dayNum)),
        totalHours: Math.round(hours * 100) / 100
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
    
    // Недоиспользованные и переиспользованные сотрудники
    const avgThreshold = averageHoursPerStaff;
    const underutilizedStaff = staffHours
      .filter(s => s.totalHours < avgThreshold * 0.5 && s.totalHours > 0)
      .sort((a, b) => a.totalHours - b.totalHours);
    
    const overutilizedStaff = staffHours
      .filter(s => s.totalHours > avgThreshold * 1.5)
      .sort((a, b) => b.totalHours - a.totalHours);
    
    return {
      averageHoursPerStaff,
      medianHoursPerStaff,
      maxHoursPerStaff,
      minHoursPerStaff,
      staffUtilizationRate,
      averageShiftsPerDay,
      peakWorkDays,
      underutilizedStaff,
      overutilizedStaff
    };
  }

  // *** АНАЛИЗ ПАТТЕРНОВ ОТПУСКОВ ***

  /**
   * Анализирует паттерны использования отпусков
   */
  public static analyzeLeavePatterns(weekGroups: IWeekGroup[]): {
    totalLeaveRequests: number;
    leaveRequestsByType: Array<{ type: string; count: number; percentage: number }>;
    leaveRequestsByDay: Array<{ dayName: string; count: number }>;
    leaveRequestsByWeek: Array<{ weekNum: number; count: number }>;
    staffWithMostLeave: Array<{ staffName: string; leaveCount: number }>;
    averageLeavePerStaff: number;
    leaveDistributionQuality: string;
  } {
    let totalLeaveRequests = 0;
    const leaveTypesCounts = new Map<string, number>();
    const leaveDayCounts: Record<number, number> = {};
    const leaveWeekCounts: Record<number, number> = {};
    const staffLeaveCounts = new Map<string, number>();
    
    // Собираем статистику по отпускам
    weekGroups.forEach(weekGroup => {
      let weekLeaveCount = 0;
      
      weekGroup.staffRows.forEach(staffRow => {
        let staffLeaveCount = 0;
        
        Object.entries(staffRow.weekData.days).forEach(([dayNum, dayData]) => {
          const day = dayData as IDayInfo;
          day.shifts.forEach(shift => {
            if (shift.typeOfLeaveId) {
              totalLeaveRequests++;
              weekLeaveCount++;
              staffLeaveCount++;
              
              // По типам отпусков
              const leaveType = shift.typeOfLeaveTitle || shift.typeOfLeaveId;
              leaveTypesCounts.set(leaveType, (leaveTypesCounts.get(leaveType) || 0) + 1);
              
              // По дням недели
              const dayNumber = parseInt(dayNum);
              leaveDayCounts[dayNumber] = (leaveDayCounts[dayNumber] || 0) + 1;
            }
          });
        });
        
        if (staffLeaveCount > 0) {
          staffLeaveCounts.set(staffRow.staffName, 
            (staffLeaveCounts.get(staffRow.staffName) || 0) + staffLeaveCount);
        }
      });
      
      if (weekLeaveCount > 0) {
        leaveWeekCounts[weekGroup.weekInfo.weekNum] = weekLeaveCount;
      }
    });
    
    // Формируем результаты
    const leaveRequestsByType: Array<{ type: string; count: number; percentage: number }> = [];
    leaveTypesCounts.forEach((count, type) => {
      leaveRequestsByType.push({
        type,
        count,
        percentage: totalLeaveRequests > 0 ? Math.round((count / totalLeaveRequests) * 100) : 0
      });
    });
    leaveRequestsByType.sort((a, b) => b.count - a.count);
    
    const leaveRequestsByDay = Object.entries(leaveDayCounts)
      .map(([dayNum, count]) => ({
        dayName: TimetableWeekCalculator.getDayName(parseInt(dayNum)),
        count
      }))
      .sort((a, b) => b.count - a.count);
    
    const leaveRequestsByWeek = Object.entries(leaveWeekCounts)
      .map(([weekNum, count]) => ({
        weekNum: parseInt(weekNum),
        count
      }))
      .sort((a, b) => a.weekNum - b.weekNum);
    
    const staffWithMostLeave: Array<{ staffName: string; leaveCount: number }> = [];
    staffLeaveCounts.forEach((count, staffName) => {
      staffWithMostLeave.push({ staffName, leaveCount: count });
    });
    staffWithMostLeave.sort((a, b) => b.leaveCount - a.leaveCount);
    
    const totalStaff = weekGroups.length > 0 ? weekGroups[0].staffRows.length : 0;
    const averageLeavePerStaff = totalStaff > 0 ? 
      Math.round((totalLeaveRequests / totalStaff) * 100) / 100 : 0;
    
    let leaveDistributionQuality = 'UNKNOWN';
    if (totalLeaveRequests === 0) {
      leaveDistributionQuality = 'NO_LEAVE';
    } else if (staffLeaveCounts.size < totalStaff * 0.2) {
      leaveDistributionQuality = 'CONCENTRATED';
    } else if (staffLeaveCounts.size < totalStaff * 0.5) {
      leaveDistributionQuality = 'MODERATE';
    } else {
      leaveDistributionQuality = 'WELL_DISTRIBUTED';
    }
    
    return {
      totalLeaveRequests,
      leaveRequestsByType,
      leaveRequestsByDay,
      leaveRequestsByWeek,
      staffWithMostLeave: staffWithMostLeave.slice(0, 10), // Топ 10
      averageLeavePerStaff,
      leaveDistributionQuality
    };
  }

  // *** ЭКСПОРТ И ОТЧЕТНОСТЬ ***

  /**
   * Экспортирует данные с цветами отпусков в структурированном формате
   */
  public static exportWeeksDataWithLeaveColors(weekGroups: IWeekGroup[]): {
    metadata: {
      exportDate: string;
      totalWeeks: number;
      totalStaff: number;
      totalRecords: number;
      leaveColorsCount: number;
    };
    weeks: Array<{
      weekNum: number;
      weekStart: string;
      weekEnd: string;
      staff: Array<{
        staffId: string;
        staffName: string;
        totalHours: number;
        days: Array<{
          dayNumber: number;
          date: string;
          dayName: string;
          shifts: Array<{
            startTime: string;
            endTime: string;
            workMinutes: number;
            leaveType?: {
              id: string;
              title: string;
              color: string;
            };
          }>;
          totalMinutes: number;
          leaveColor?: string;
          hasLeave: boolean;
        }>;
      }>;
    }>;
    leaveColorsLegend: Array<{
      color: string;
      associatedTypes: string[];
      usageCount: number;
    }>;
  } {
    const leaveColorsAnalysis = this.analyzeLeaveColorsUsage(weekGroups);
    
    const exportData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalWeeks: weekGroups.length,
        totalStaff: weekGroups.length > 0 ? weekGroups[0].staffRows.length : 0,
        totalRecords: 0,
        leaveColorsCount: leaveColorsAnalysis.uniqueLeaveColors
      },
      weeks: weekGroups.map(weekGroup => ({
        weekNum: weekGroup.weekInfo.weekNum,
        weekStart: weekGroup.weekInfo.weekStart.toISOString(),
        weekEnd: weekGroup.weekInfo.weekEnd.toISOString(),
        staff: weekGroup.staffRows.map(staffRow => ({
          staffId: staffRow.staffId,
          staffName: staffRow.staffName,
          totalHours: Math.round(staffRow.weekData.totalWeekMinutes / 60 * 100) / 100,
          days: Object.entries(staffRow.weekData.days).map(([dayNum, dayData]) => {
            const day = dayData as IDayInfo;
            return {
              dayNumber: parseInt(dayNum),
              date: day.date.toISOString(),
              dayName: TimetableWeekCalculator.getDayName(parseInt(dayNum)),
              shifts: day.shifts.map(shift => ({
                startTime: shift.startTime.toISOString(),
                endTime: shift.endTime.toISOString(),
                workMinutes: shift.workMinutes,
                leaveType: shift.typeOfLeaveId ? {
                  id: shift.typeOfLeaveId,
                  title: shift.typeOfLeaveTitle || shift.typeOfLeaveId,
                  color: shift.typeOfLeaveColor || '#cccccc'
                } : undefined
              })),
              totalMinutes: day.totalMinutes,
              leaveColor: day.leaveTypeColor,
              hasLeave: day.hasLeave
            };
          })
        }))
      })),
      leaveColorsLegend: leaveColorsAnalysis.leaveColorBreakdown.map(item => ({
        color: item.color,
        associatedTypes: item.associatedTypes,
        usageCount: item.count
      }))
    };

    // Подсчитываем общее количество записей
    exportData.metadata.totalRecords = exportData.weeks.reduce((sum, week) => 
      sum + week.staff.reduce((staffSum, staff) => 
        staffSum + staff.days.reduce((daySum, day) => daySum + day.shifts.length, 0), 0), 0);

    return exportData;
  }

  /**
   * Создает сводный аналитический отчет
   */
  public static generateComprehensiveReport(weekGroups: IWeekGroup[]): {
    summary: ReturnType<typeof TimetableDataAnalytics.getAdvancedDataSummary>;
    leaveColors: ReturnType<typeof TimetableDataAnalytics.analyzeLeaveColorsUsage>;
    productivity: ReturnType<typeof TimetableDataAnalytics.analyzeProductivityMetrics>;
    leavePatterns: ReturnType<typeof TimetableDataAnalytics.analyzeLeavePatterns>;
    recommendations: string[];
    reportGeneratedAt: string;
  } {
    const summary = this.getAdvancedDataSummary(weekGroups);
    const leaveColors = this.analyzeLeaveColorsUsage(weekGroups);
    const productivity = this.analyzeProductivityMetrics(weekGroups);
    const leavePatterns = this.analyzeLeavePatterns(weekGroups);
    
    const recommendations: string[] = [];
    
    // Генерируем рекомендации на основе анализа
    if (summary.dataCompleteness < 50) {
      recommendations.push('Improve data completeness - only ' + summary.dataCompleteness + '% of weeks have data');
    }
    
    if (summary.leaveUsageRate > 30) {
      recommendations.push('High leave usage rate (' + summary.leaveUsageRate + '%) - consider reviewing leave policies');
    }
    
    if (productivity.staffUtilizationRate < 70) {
      recommendations.push('Low staff utilization (' + productivity.staffUtilizationRate + '%) - consider workload redistribution');
    }
    
    if (productivity.overutilizedStaff.length > 0) {
      recommendations.push(productivity.overutilizedStaff.length + ' staff members are overutilized - consider workload balancing');
    }
    
    if (leaveColors.colorDistributionQuality === 'SINGLE_COLOR') {
      recommendations.push('Only one leave color type detected - consider diversifying leave types');
    }
    
    if (leavePatterns.leaveDistributionQuality === 'CONCENTRATED') {
      recommendations.push('Leave requests are concentrated among few staff - monitor leave distribution');
    }
    
    return {
      summary,
      leaveColors,
      productivity,
      leavePatterns,
      recommendations,
      reportGeneratedAt: new Date().toISOString()
    };
  }
}