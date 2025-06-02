// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorDiagnostics.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IWeeklyStaffData, IWeekInfo, IDayInfo } from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';
import { TimetableDataUtils } from './TimetableDataUtils';

export class TimetableDataProcessorDiagnostics {

  public static diagnoseWeekProcessing(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    weekNum: number;
    totalRecords: number;
    recordsByDay: Record<number, number>;
    recordsWithLeave: number;
    recordsWithHoliday: number;
    recordsWithWorkTime: number;
    recordsWithoutWorkTime: number;
    hasColorFunction: boolean;
    leaveTypesFound: Array<{ id: string; title?: string; color?: string; count: number }>;
    processingQuality: string;
    recommendations: string[];
    dataIntegrity: {
      validRecords: number;
      invalidRecords: number;
      issues: string[];
    };
  } {
    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);
    const recordsByDay: Record<number, number> = {};
    let recordsWithLeave = 0;
    let recordsWithHoliday = 0;
    let recordsWithWorkTime = 0;
    let recordsWithoutWorkTime = 0;
    
    const leaveTypesMap = new Map<string, { id: string; title?: string; color?: string; count: number }>();
    
    let validRecords = 0;
    let invalidRecords = 0;
    const issues: string[] = [];

    weekRecords.forEach(record => {
      let isValid = true;
      
      if (!record.Date || isNaN(record.Date.getTime())) {
        issues.push(`Record ${record.ID} has invalid date`);
        isValid = false;
      }
      
      if (!record.StaffMemberLookupId) {
        issues.push(`Record ${record.ID} missing staff ID`);
        isValid = false;
      }

      if (isValid) {
        validRecords++;
      } else {
        invalidRecords++;
        return;
      }

      const recordDate = new Date(record.Date);
      const dayNumber = TimetableShiftCalculatorCore.getDayNumber(recordDate);
      recordsByDay[dayNumber] = (recordsByDay[dayNumber] || 0) + 1;

      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeave++;
        
        const leaveTypeId = record.TypeOfLeaveID;
        if (!leaveTypesMap.has(leaveTypeId)) {
          const leaveTypeColor = getLeaveTypeColor ? getLeaveTypeColor(leaveTypeId) : undefined;
          leaveTypesMap.set(leaveTypeId, {
            id: leaveTypeId,
            title: record.TypeOfLeave?.Title,
            color: leaveTypeColor,
            count: 0
          });
        }
        leaveTypesMap.get(leaveTypeId)!.count++;
      }
      
      if (record.Holiday === 1) recordsWithHoliday++;

      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 &&
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 &&
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      if (hasWorkTime) {
        recordsWithWorkTime++;
      } else {
        recordsWithoutWorkTime++;
      }
    });

    const leaveTypesFound: Array<{ id: string; title?: string; color?: string; count: number }> = [];
    leaveTypesMap.forEach(leaveType => {
      leaveTypesFound.push(leaveType);
    });

    let processingQuality = 'UNKNOWN';
    const recommendations: string[] = [];

    if (weekRecords.length === 0) {
      processingQuality = 'NO_DATA';
      recommendations.push('No records found for this week');
    } else if (invalidRecords > validRecords * 0.1) {
      processingQuality = 'POOR_DATA_QUALITY';
      recommendations.push('More than 10% of records have data integrity issues');
    } else if (recordsWithLeave > 0 && !getLeaveTypeColor) {
      processingQuality = 'MISSING_COLOR_FUNCTION';
      recommendations.push('Leave records found but no color function provided');
    } else if (recordsWithLeave > 0 && leaveTypesFound.some(lt => !lt.color)) {
      processingQuality = 'PARTIAL_COLORS_MISSING';
      recommendations.push('Some leave types missing color mappings');
    } else if (recordsWithoutWorkTime > recordsWithWorkTime) {
      processingQuality = 'MOSTLY_MARKERS';
      recommendations.push('More marker records than work records - verify data');
    } else {
      processingQuality = 'GOOD';
      recommendations.push('Week processing should work well');
    }

    if (recordsWithLeave === 0 && recordsWithHoliday === 0) {
      recommendations.push('No special markers found - only regular work schedules');
    }

    if (Object.keys(recordsByDay).length < 3) {
      recommendations.push('Records concentrated in few days - check if expected');
    }

    return {
      weekNum: week.weekNum,
      totalRecords: weekRecords.length,
      recordsByDay,
      recordsWithLeave,
      recordsWithHoliday,
      recordsWithWorkTime,
      recordsWithoutWorkTime,
      hasColorFunction: !!getLeaveTypeColor,
      leaveTypesFound,
      processingQuality,
      recommendations,
      dataIntegrity: {
        validRecords,
        invalidRecords,
        issues
      }
    };
  }

  public static getProcessingStatistics(weeklyData: IWeeklyStaffData): {
    weekNum: number;
    totalDays: number;
    daysWithData: number;
    daysWithLeave: number;
    daysWithHoliday: number;
    daysWithColors: number;
    daysWithLeaveNames: number;
    totalShifts: number;
    totalWorkMinutes: number;
    processingQuality: string;
    leaveTypeInfo: Array<{ day: number; title?: string; color?: string }>;
    qualityMetrics: {
      dataCompleteness: number;
      colorCoverage: number;
      nameCoverage: number;
      overallScore: number;
    };
  } {
    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithData = days.filter(day => day.hasData).length;
    const daysWithLeave = days.filter(day => day.hasLeave).length;
    const daysWithHoliday = days.filter(day => day.hasHoliday).length;
    const daysWithColors = days.filter(day => day.finalCellColor && day.finalCellColor !== '#ffffff').length;
    const totalShifts = days.reduce((sum, day) => sum + day.shifts.length, 0);

    const daysWithLeaveNames = days.filter(day => 
      day.hasLeave && day.formattedContent && 
      !day.formattedContent.startsWith('Type ') && 
      day.formattedContent !== 'Leave'
    ).length;

    const leaveTypeInfo: Array<{ day: number; title?: string; color?: string }> = [];
    days.forEach(day => {
      if (day.hasLeave) {
        leaveTypeInfo.push({
          day: day.dayNumber,
          title: day.formattedContent,
          color: day.leaveTypeColor
        });
      }
    });

    const dataCompleteness = Math.round((daysWithData / days.length) * 100);
    const colorCoverage = daysWithLeave > 0 ? Math.round((daysWithColors / daysWithLeave) * 100) : 100;
    const nameCoverage = daysWithLeave > 0 ? Math.round((daysWithLeaveNames / daysWithLeave) * 100) : 100;
    const overallScore = Math.round((dataCompleteness + colorCoverage + nameCoverage) / 3);

    let processingQuality = 'UNKNOWN';
    if (daysWithData === 0) {
      processingQuality = 'NO_DATA';
    } else if (overallScore >= 90) {
      processingQuality = 'EXCELLENT';
    } else if (overallScore >= 75) {
      processingQuality = 'GOOD';
    } else if (overallScore >= 60) {
      processingQuality = 'FAIR';
    } else {
      processingQuality = 'POOR';
    }

    return {
      weekNum: weeklyData.weekNum,
      totalDays: days.length,
      daysWithData,
      daysWithLeave,
      daysWithHoliday,
      daysWithColors,
      daysWithLeaveNames,
      totalShifts,
      totalWorkMinutes: weeklyData.totalWeekMinutes,
      processingQuality,
      leaveTypeInfo,
      qualityMetrics: {
        dataCompleteness,
        colorCoverage,
        nameCoverage,
        overallScore
      }
    };
  }

  public static validateProcessingResults(weeklyData: IWeeklyStaffData): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    recommendations: string[];
    leaveTypeValidation: {
      daysWithLeave: number;
      daysWithProperNames: number;
      daysWithColors: number;
      daysShowingTypeX: number;
    };
    structuralValidation: {
      hasValidDays: boolean;
      hasValidShifts: boolean;
      hasValidTotals: boolean;
    };
    performanceMetrics: {
      processingEfficiency: number;
      dataUtilization: number;
      qualityIndex: number;
    };
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithLeave = days.filter(day => day.hasLeave);

    let hasValidDays = true;
    let hasValidShifts = true;
    let hasValidTotals = true;

    if (days.length !== 7) {
      issues.push(`Expected 7 days, got ${days.length}`);
      hasValidDays = false;
    }

    days.forEach((day, index) => {
      if (!Array.isArray(day.shifts)) {
        issues.push(`Day ${index + 1} has invalid shifts array`);
        hasValidShifts = false;
      }

      if (!day.formattedContent && day.hasData) {
        warnings.push(`Day ${index + 1} has data but no formatted content`);
      }

      if (day.hasLeave && !day.leaveTypeColor) {
        warnings.push(`Day ${index + 1} has leave but no leave color`);
      }

      if (day.hasLeave && day.formattedContent?.startsWith('Type ')) {
        warnings.push(`Day ${index + 1} showing leave type ID instead of name: ${day.formattedContent}`);
      }

      if (day.hasHoliday && !day.holidayColor) {
        warnings.push(`Day ${index + 1} has holiday but no holiday color`);
      }
    });

    const calculatedTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
    if (Math.abs(calculatedTotal - weeklyData.totalWeekMinutes) > 1) {
      issues.push(`Week total mismatch: calculated ${calculatedTotal}, stored ${weeklyData.totalWeekMinutes}`);
      hasValidTotals = false;
    }

    const daysWithProperNames = daysWithLeave.filter(day => 
      day.formattedContent && 
      !day.formattedContent.startsWith('Type ') && 
      day.formattedContent !== 'Leave' &&
      day.formattedContent !== '-'
    ).length;

    const daysShowingTypeX = daysWithLeave.filter(day => 
      day.formattedContent && day.formattedContent.startsWith('Type ')
    ).length;

    const daysWithLeaveColors = daysWithLeave.filter(day => day.leaveTypeColor).length;

    if (daysShowingTypeX > 0) {
      issues.push(`${daysShowingTypeX} days showing "Type X" instead of proper leave names`);
      recommendations.push('Check getLeaveTypeTitle function and TypeOfLeave data loading');
    }

    if (daysWithLeave.length > 0 && daysWithLeaveColors === 0) {
      issues.push('Leave days found but no colors applied');
      recommendations.push('Check getLeaveTypeColor function and TypeOfLeave configuration');
    }

    if (daysWithLeave.length > 0 && daysWithProperNames === 0) {
      warnings.push('Leave days found but no proper names displayed');
      recommendations.push('Verify TypeOfLeave.Title field population and getLeaveTypeTitle function');
    }

    const totalPossibleData = days.length * 24 * 60;
    const actualData = weeklyData.totalWeekMinutes;
    const dataUtilization = totalPossibleData > 0 ? Math.round((actualData / totalPossibleData) * 100) : 0;

    const processingEfficiency = days.filter(day => day.hasData).length / days.length * 100;

    const qualityIndex = Math.round((
      (daysWithLeave.length > 0 ? (daysWithProperNames / daysWithLeave.length) * 50 : 50) +
      (daysWithLeave.length > 0 ? (daysWithLeaveColors / daysWithLeave.length) * 50 : 50)
    ));

    if (qualityIndex < 70) {
      recommendations.push('Quality index below 70% - review leave type configuration');
    }

    if (processingEfficiency < 50) {
      recommendations.push('Low processing efficiency - check if data range is appropriate');
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      warnings,
      recommendations,
      leaveTypeValidation: {
        daysWithLeave: daysWithLeave.length,
        daysWithProperNames,
        daysWithColors: daysWithLeaveColors,
        daysShowingTypeX
      },
      structuralValidation: {
        hasValidDays,
        hasValidShifts,
        hasValidTotals
      },
      performanceMetrics: {
        processingEfficiency: Math.round(processingEfficiency),
        dataUtilization,
        qualityIndex
      }
    };
  }

  public static createProcessingSummary(
    weeklyData: IWeeklyStaffData,
    staffRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    weekNum: number;
    summary: string;
    leaveTypesSummary: string;
    qualityScore: number;
    recommendations: string[];
    details: {
      totalDays: number;
      daysWithData: number;
      daysWithLeave: number;
      daysWithProperLeaveNames: number;
      daysWithLeaveColors: number;
      daysShowingTypeIds: number;
    };
    actionableInsights: {
      criticalIssues: string[];
      improvements: string[];
      nextSteps: string[];
    };
  } {
    const stats = this.getProcessingStatistics(weeklyData);
    const validation = this.validateProcessingResults(weeklyData);
    
    const details = {
      totalDays: stats.totalDays,
      daysWithData: stats.daysWithData,
      daysWithLeave: stats.daysWithLeave,
      daysWithProperLeaveNames: stats.daysWithLeaveNames,
      daysWithLeaveColors: validation.leaveTypeValidation.daysWithColors,
      daysShowingTypeIds: validation.leaveTypeValidation.daysShowingTypeX
    };

    let qualityScore = 100;
    
    if (details.daysShowingTypeIds > 0 && details.daysWithLeave > 0) {
      qualityScore -= (details.daysShowingTypeIds / details.daysWithLeave) * 30;
    }
    
    if (details.daysWithLeave > 0) {
      const colorsCoverage = details.daysWithLeaveColors / details.daysWithLeave;
      if (colorsCoverage < 1) {
        qualityScore -= (1 - colorsCoverage) * 25;
      }
      
      const namesCoverage = details.daysWithProperLeaveNames / details.daysWithLeave;
      if (namesCoverage < 1) {
        qualityScore -= (1 - namesCoverage) * 25;
      }
    }

    if (stats.qualityMetrics.dataCompleteness < 50) {
      qualityScore -= 20;
    }

    qualityScore = Math.max(0, Math.round(qualityScore));

    const summary = `Week ${weeklyData.weekNum}: ${details.daysWithData}/${details.totalDays} days with data, ` +
                   `${details.daysWithLeave} leave days, quality score: ${qualityScore}%`;

    const leaveTypesSummary = details.daysWithLeave > 0 ? 
      `Leave types: ${details.daysWithProperLeaveNames}/${details.daysWithLeave} with proper names, ` +
      `${details.daysWithLeaveColors}/${details.daysWithLeave} with colors` +
      (details.daysShowingTypeIds > 0 ? `, ${details.daysShowingTypeIds} showing IDs` : '') :
      'No leave days found';

    const criticalIssues: string[] = [];
    const improvements: string[] = [];
    const nextSteps: string[] = [];

    if (qualityScore < 50) {
      criticalIssues.push('Quality score critically low - immediate attention needed');
    }

    if (details.daysShowingTypeIds > 0) {
      criticalIssues.push('Leave type IDs displayed instead of names - user experience impacted');
      nextSteps.push('Verify TypeOfLeave.Title field is populated in SharePoint');
      nextSteps.push('Check getLeaveTypeTitle function implementation');
    }

    if (details.daysWithLeave > 0 && details.daysWithLeaveColors === 0) {
      criticalIssues.push('No leave colors applied - visual indicators missing');
      nextSteps.push('Verify getLeaveTypeColor function is properly configured');
      nextSteps.push('Check TypeOfLeave color field mapping');
    }

    if (stats.qualityMetrics.dataCompleteness < 70) {
      improvements.push('Low data completeness - consider expanding date range or checking filters');
    }

    if (qualityScore >= 80) {
      improvements.push('Good quality achieved - consider optimizing performance');
    } else if (qualityScore >= 60) {
      improvements.push('Moderate quality - focus on leave type name resolution');
    } else {
      improvements.push('Quality needs significant improvement - review all configurations');
    }

    if (nextSteps.length === 0) {
      if (qualityScore >= 90) {
        nextSteps.push('Excellent quality - monitor for consistency');
      } else {
        nextSteps.push('Review leave type configuration');
        nextSteps.push('Verify data completeness');
      }
    }

    const recommendations = [...validation.recommendations];
    
    if (qualityScore < 80) {
      recommendations.push('Quality score below 80% - review leave type configuration');
    }

    return {
      weekNum: weeklyData.weekNum,
      summary,
      leaveTypesSummary,
      qualityScore,
      recommendations,
      details,
      actionableInsights: {
        criticalIssues,
        improvements,
        nextSteps
      }
    };
  }

  public static getModuleInfo(): {
    version: string;
    module: string;
    features: string[];
    totalMethods: number;
  } {
    return {
      version: '4.1',
      module: 'TimetableDataProcessorDiagnostics',
      features: [
        'Week processing diagnostics',
        'Processing statistics generation',
        'Result validation with detailed metrics',
        'Processing summary with actionable insights'
      ],
      totalMethods: Object.getOwnPropertyNames(TimetableDataProcessorDiagnostics)
        .filter(name => typeof TimetableDataProcessorDiagnostics[name as keyof typeof TimetableDataProcessorDiagnostics] === 'function')
        .length
    };
  }
}