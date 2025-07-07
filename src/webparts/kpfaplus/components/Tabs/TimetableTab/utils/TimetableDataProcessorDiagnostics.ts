// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorDiagnostics.ts
// ОБНОВЛЕНО v5.0: Date-only поддержка для поля Date

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IWeeklyStaffData, IWeekInfo, IDayInfo } from '../interfaces/TimetableInterfaces';
import { TimetableDataUtils } from './TimetableDataUtils';

export class TimetableDataProcessorDiagnostics {

  public static diagnoseWeekProcessing(
    staffRecords: IStaffRecord[],
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    weekNum: number;
    totalRecords: number;
    recordsWithLeave: number;
    recordsWithHoliday: number;
    hasColorFunction: boolean;
    processingQuality: string;
    recommendations: string[];
  } {
    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);
    let recordsWithLeave = 0;
    let recordsWithHoliday = 0;

    weekRecords.forEach(record => {
      // *** ОБНОВЛЕНО v5.0: Date-only валидация ***
      const recordDate = new Date(record.Date);
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableDataProcessorDiagnostics] v5.0: Invalid date-only field in record ${record.ID}`);
      }

      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeave++;
      }
      if (record.Holiday === 1) recordsWithHoliday++;
    });

    let processingQuality = 'UNKNOWN';
    const recommendations: string[] = [];

    if (weekRecords.length === 0) {
      processingQuality = 'NO_DATA';
      recommendations.push('No records found for this week');
    } else if (recordsWithLeave > 0 && !getLeaveTypeColor) {
      processingQuality = 'MISSING_COLOR_FUNCTION';
      recommendations.push('Leave records found but no color function provided');
    } else {
      processingQuality = 'GOOD';
      recommendations.push('Week processing should work well');
    }

    return {
      weekNum: week.weekNum,
      totalRecords: weekRecords.length,
      recordsWithLeave,
      recordsWithHoliday,
      hasColorFunction: !!getLeaveTypeColor,
      processingQuality,
      recommendations
    };
  }

  public static getProcessingStatistics(weeklyData: IWeeklyStaffData): {
    weekNum: number;
    daysWithData: number;
    daysWithLeave: number;
    daysWithHoliday: number;
    totalShifts: number;
    processingQuality: string;
  } {
    const days = Object.values(weeklyData.days) as IDayInfo[];
    const daysWithData = days.filter(day => day.hasData).length;
    const daysWithLeave = days.filter(day => day.hasLeave).length;
    const daysWithHoliday = days.filter(day => day.hasHoliday).length;
    const totalShifts = days.reduce((sum, day) => sum + day.shifts.length, 0);

    const dataCompleteness = Math.round((daysWithData / days.length) * 100);
    
    let processingQuality = 'UNKNOWN';
    if (daysWithData === 0) {
      processingQuality = 'NO_DATA';
    } else if (dataCompleteness >= 75) {
      processingQuality = 'GOOD';
    } else if (dataCompleteness >= 50) {
      processingQuality = 'FAIR';
    } else {
      processingQuality = 'POOR';
    }

    return {
      weekNum: weeklyData.weekNum,
      daysWithData,
      daysWithLeave,
      daysWithHoliday,
      totalShifts,
      processingQuality
    };
  }

  public static validateProcessingResults(weeklyData: IWeeklyStaffData): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    const days = Object.values(weeklyData.days) as IDayInfo[];

    if (days.length !== 7) {
      issues.push(`Expected 7 days, got ${days.length}`);
    }

    days.forEach((day, index) => {
      if (!Array.isArray(day.shifts)) {
        issues.push(`Day ${index + 1} has invalid shifts array`);
      }

      // *** ОБНОВЛЕНО v5.0: Date-only валидация ***
      if (day.date && isNaN(day.date.getTime())) {
        issues.push(`Day ${index + 1} has invalid date-only field`);
      }

      if (day.hasLeave && day.formattedContent?.startsWith('Type ')) {
        warnings.push(`Day ${index + 1} showing leave type ID instead of name`);
      }
    });

    const calculatedTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
    if (Math.abs(calculatedTotal - weeklyData.totalWeekMinutes) > 1) {
      issues.push(`Week total mismatch: calculated ${calculatedTotal}, stored ${weeklyData.totalWeekMinutes}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  public static createProcessingSummary(
    weeklyData: IWeeklyStaffData
  ): {
    weekNum: number;
    summary: string;
    qualityScore: number;
    recommendations: string[];
  } {
    const stats = this.getProcessingStatistics(weeklyData);
    const validation = this.validateProcessingResults(weeklyData);
    
    const details = {
      daysWithData: stats.daysWithData,
      daysWithLeave: stats.daysWithLeave
    };

    let qualityScore = 100;
    
    if (validation.warnings.length > 0) {
      qualityScore -= validation.warnings.length * 10;
    }

    if (stats.daysWithData < 3) {
      qualityScore -= 20;
    }

    qualityScore = Math.max(0, Math.round(qualityScore));

    const summary = `Week ${weeklyData.weekNum}: ${details.daysWithData}/7 days with data, ` +
                   `${details.daysWithLeave} leave days, quality score: ${qualityScore}%`;

    const recommendations = [...validation.warnings];
    
    if (qualityScore < 80) {
      recommendations.push('Quality score below 80% - review configuration');
    }

    return {
      weekNum: weeklyData.weekNum,
      summary,
      qualityScore,
      recommendations
    };
  }
}