// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorDiagnostics.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IWeeklyStaffData, IWeekInfo, IDayInfo } from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';
import { TimetableDataUtils } from './TimetableDataUtils';

/**
 * Specialized module for diagnostics, validation and quality assessment
 * Extracted from TimetableDataProcessorCore for better maintainability
 * Version 4.1 - Refactored modular architecture
 */
export class TimetableDataProcessorDiagnostics {

  /**
   * *** ДИАГНОСТИКА ОБРАБОТКИ НЕДЕЛИ v4.1 ***
   * REFACTORED: Enhanced week processing diagnostics
   */
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
    
    // Анализ типов отпусков
    const leaveTypesMap = new Map<string, { id: string; title?: string; color?: string; count: number }>();
    
    // Анализ целостности данных
    let validRecords = 0;
    let invalidRecords = 0;
    const issues: string[] = [];

    weekRecords.forEach(record => {
      // Проверка валидности записи
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
        return; // Пропускаем невалидные записи
      }

      const recordDate = new Date(record.Date);
      const dayNumber = TimetableShiftCalculatorCore.getDayNumber(recordDate);
      recordsByDay[dayNumber] = (recordsByDay[dayNumber] || 0) + 1;

      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeave++;
        
        // Собираем информацию о типах отпусков
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

    // Определение качества обработки
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

    // Дополнительные рекомендации
    if (recordsWithLeave === 0 && recordsWithHoliday === 0) {
      recommendations.push('No special markers found - only regular work schedules');
    }

    if (Object.keys(recordsByDay).length < 3) {
      recommendations.push('Records concentrated in few days - check if this is expected');
    }

    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: Week ${week.weekNum} diagnosis completed ***`, {
      processingQuality,
      leaveTypesFound: leaveTypesFound.length,
      hasColorFunction: !!getLeaveTypeColor,
      validRecords,
      invalidRecords
    });

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

  /**
   * *** СТАТИСТИКА ОБРАБОТКИ НЕДЕЛИ v4.1 ***
   * REFACTORED: Enhanced processing statistics
   */
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

    // Анализ названий типов отпусков
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

    // Метрики качества
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

    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: Week ${weeklyData.weekNum} statistics ***`, {
      processingQuality,
      overallScore,
      daysWithLeaveNames,
      daysWithColors
    });

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

  /**
   * *** ВАЛИДАЦИЯ РЕЗУЛЬТАТОВ ОБРАБОТКИ v4.1 ***
   * REFACTORED: Enhanced validation with detailed recommendations
   */
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
    const daysWithHoliday = days.filter(day => day.hasHoliday);

    // Структурная валидация
    let hasValidDays = true;
    let hasValidShifts = true;
    let hasValidTotals = true;

    // Проверка дней недели
    if (days.length !== 7) {
      issues.push(`Expected 7 days, got ${days.length}`);
      hasValidDays = false;
    }

    // Проверка смен
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

    // Проверка недельных итогов
    const calculatedTotal = days.reduce((sum, day) => sum + day.totalMinutes, 0);
    if (Math.abs(calculatedTotal - weeklyData.totalWeekMinutes) > 1) {
      issues.push(`Week total mismatch: calculated ${calculatedTotal}, stored ${weeklyData.totalWeekMinutes}`);
      hasValidTotals = false;
    }

    // Валидация типов отпусков
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

    // Рекомендации по типам отпусков
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

    // Рекомендации по праздникам
    if (daysWithHoliday.length > 0 && daysWithLeave.length > 0) {
      recommendations.push('Holiday priority system active - ensure proper color overrides');
    }

    // Метрики производительности
    const totalPossibleData = days.length * 24 * 60; // Максимум минут в неделе
    const actualData = weeklyData.totalWeekMinutes;
    const dataUtilization = totalPossibleData > 0 ? Math.round((actualData / totalPossibleData) * 100) : 0;

    const processingEfficiency = days.filter(day => day.hasData).length / days.length * 100;

    const qualityIndex = Math.round((
      (daysWithLeave.length > 0 ? (daysWithProperNames / daysWithLeave.length) * 50 : 50) +
      (daysWithLeave.length > 0 ? (daysWithLeaveColors / daysWithLeave.length) * 50 : 50)
    ));

    // Дополнительные рекомендации на основе метрик
    if (qualityIndex < 70) {
      recommendations.push('Quality index below 70% - review leave type configuration');
    }

    if (processingEfficiency < 50) {
      recommendations.push('Low processing efficiency - check if data range is appropriate');
    }

    const isValid = issues.length === 0;

    const leaveTypeValidation = {
      daysWithLeave: daysWithLeave.length,
      daysWithProperNames,
      daysWithColors: daysWithLeaveColors,
      daysShowingTypeX
    };

    const structuralValidation = {
      hasValidDays,
      hasValidShifts,
      hasValidTotals
    };

    const performanceMetrics = {
      processingEfficiency: Math.round(processingEfficiency),
      dataUtilization,
      qualityIndex
    };

    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: Validation completed ***`, {
      isValid,
      issuesCount: issues.length,
      warningsCount: warnings.length,
      qualityIndex
    });

    return {
      isValid,
      issues,
      warnings,
      recommendations,
      leaveTypeValidation,
      structuralValidation,
      performanceMetrics
    };
  }

  /**
   * *** СОЗДАНИЕ СВОДКИ ОБРАБОТКИ v4.1 ***
   * REFACTORED: Enhanced processing summary with actionable insights
   */
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

    // Вычисляем качественный балл
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

    // Создаем сводки
    const summary = `Week ${weeklyData.weekNum}: ${details.daysWithData}/${details.totalDays} days with data, ` +
                   `${details.daysWithLeave} leave days, quality score: ${qualityScore}%`;

    const leaveTypesSummary = details.daysWithLeave > 0 ? 
      `Leave types: ${details.daysWithProperLeaveNames}/${details.daysWithLeave} with proper names, ` +
      `${details.daysWithLeaveColors}/${details.daysWithLeave} with colors` +
      (details.daysShowingTypeIds > 0 ? `, ${details.daysShowingTypeIds} showing IDs` : '') :
      'No leave days found';

    // Actionable insights
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

    // Базовые следующие шаги
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

    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: Processing summary created ***`, {
      weekNum: weeklyData.weekNum,
      qualityScore,
      criticalIssuesCount: criticalIssues.length,
      improvementsCount: improvements.length
    });

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

  /**
   * *** ОЦЕНКА КАЧЕСТВА ОБРАБОТКИ ТИПОВ ОТПУСКОВ v4.1 ***
   * REFACTORED: Comprehensive leave type processing assessment
   */
  public static assessLeaveTypeProcessingQuality(
    weeksData: Array<{ weekData: IWeeklyStaffData }>,
    overallStats?: { 
      totalRecords: number; 
      recordsWithLeave: number; 
      hasLeaveTypeColorFunction: boolean 
    }
  ): {
    overallQuality: string;
    qualityScore: number;
    recommendations: string[];
    weeklyScores: Array<{ weekNum: number; score: number; issues: string[] }>;
    leaveTypesCoverage: {
      totalDaysWithLeave: number;
      daysWithProperNames: number;
      daysWithColors: number;
      daysShowingIds: number;
      coveragePercentage: number;
    };
    trendAnalysis: {
      qualityTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INCONSISTENT';
      averageScore: number;
      scoreVariance: number;
      bestWeek: { weekNum: number; score: number } | undefined;
      worstWeek: { weekNum: number; score: number } | undefined;
    };
    systemHealth: {
      configurationStatus: string;
      dataIntegrity: string;
      userExperience: string;
    };
  } {
    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: ASSESSING LEAVE TYPE PROCESSING QUALITY ***`);
    
    let totalDaysWithLeave = 0;
    let daysWithProperNames = 0;
    let daysWithColors = 0;
    let daysShowingIds = 0;
    const weeklyScores: Array<{ weekNum: number; score: number; issues: string[] }> = [];

    weeksData.forEach(weekGroup => {
      const summary = this.createProcessingSummary(weekGroup.weekData, []);
      const weekIssues: string[] = [];
      
      totalDaysWithLeave += summary.details.daysWithLeave;
      daysWithProperNames += summary.details.daysWithProperLeaveNames;
      daysWithColors += summary.details.daysWithLeaveColors;
      daysShowingIds += summary.details.daysShowingTypeIds;
      
      if (summary.details.daysShowingTypeIds > 0) {
        weekIssues.push(`${summary.details.daysShowingTypeIds} days showing Type IDs`);
      }
      
      if (summary.details.daysWithLeave > 0 && summary.details.daysWithLeaveColors === 0) {
        weekIssues.push('No leave colors applied');
      }

      if (summary.qualityScore < 70) {
        weekIssues.push('Quality score below 70%');
      }

      weeklyScores.push({
        weekNum: weekGroup.weekData.weekNum,
        score: summary.qualityScore,
        issues: weekIssues
      });
    });

    const coveragePercentage = totalDaysWithLeave > 0 ? 
      Math.round(((daysWithProperNames + daysWithColors) / (totalDaysWithLeave * 2)) * 100) : 100;

    // Анализ трендов
    const scores = weeklyScores.map(w => w.score);
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const scoreVariance = scores.length > 1 ? 
      Math.round(scores.reduce((acc, score) => acc + Math.pow(score - averageScore, 2), 0) / scores.length) : 0;

    let qualityTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INCONSISTENT' = 'STABLE';
    if (scores.length > 2) {
      const firstHalf = scores.slice(0, Math.floor(scores.length / 2));
      const secondHalf = scores.slice(Math.floor(scores.length / 2));
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      
      if (scoreVariance > 400) {
        qualityTrend = 'INCONSISTENT';
      } else if (secondAvg > firstAvg + 10) {
        qualityTrend = 'IMPROVING';
      } else if (secondAvg < firstAvg - 10) {
        qualityTrend = 'DECLINING';
      } else {
        qualityTrend = 'STABLE';
      }
    }

    const bestWeek = scores.length > 0 ? 
      weeklyScores.reduce((best, current) => current.score > best.score ? current : best) : undefined;
    const worstWeek = scores.length > 0 ? 
      weeklyScores.reduce((worst, current) => current.score < worst.score ? current : worst) : undefined;

    // Определяем общее качество
    let overallQuality = 'UNKNOWN';
    let qualityScore = averageScore;
    
    if (totalDaysWithLeave === 0) {
      overallQuality = 'NO_LEAVE_DAYS';
      qualityScore = 100;
    } else if (daysShowingIds === 0 && daysWithProperNames === totalDaysWithLeave && daysWithColors === totalDaysWithLeave) {
      overallQuality = 'EXCELLENT';
      qualityScore = Math.max(95, qualityScore);
    } else if (daysShowingIds === 0 && daysWithProperNames > totalDaysWithLeave * 0.8) {
      overallQuality = 'GOOD';
      qualityScore = Math.max(80, qualityScore);
    } else if (daysShowingIds < totalDaysWithLeave * 0.2) {
      overallQuality = 'FAIR';
      qualityScore = Math.max(60, qualityScore);
    } else {
      overallQuality = 'POOR';
      qualityScore = Math.min(50, qualityScore);
    }

    // Системное здоровье
    let configurationStatus = 'UNKNOWN';
    let dataIntegrity = 'UNKNOWN';
    let userExperience = 'UNKNOWN';

    if (overallStats) {
      configurationStatus = overallStats.hasLeaveTypeColorFunction ? 'CONFIGURED' : 'MISSING_FUNCTIONS';
      dataIntegrity = overallStats.recordsWithLeave > 0 ? 'HAS_DATA' : 'NO_DATA';
    }

    if (daysShowingIds === 0 && daysWithColors === totalDaysWithLeave) {
      userExperience = 'EXCELLENT';
    } else if (daysShowingIds < totalDaysWithLeave * 0.1) {
      userExperience = 'GOOD';
    } else {
      userExperience = 'POOR';
    }

    // Генерируем рекомендации
    const recommendations: string[] = [];
    
    if (daysShowingIds > 0) {
      recommendations.push(`${daysShowingIds} days showing "Type X" instead of names - check TypeOfLeave.Title field`);
    }
    
    if (totalDaysWithLeave > 0 && daysWithColors < totalDaysWithLeave) {
      recommendations.push(`${totalDaysWithLeave - daysWithColors} leave days missing colors - check getLeaveTypeColor function`);
    }
    
    if (overallStats && !overallStats.hasLeaveTypeColorFunction && overallStats.recordsWithLeave > 0) {
      recommendations.push('getLeaveTypeColor function not available - colors cannot be applied');
    }

    if (qualityTrend === 'DECLINING') {
      recommendations.push('Quality trend is declining - investigate recent configuration changes');
    } else if (qualityTrend === 'INCONSISTENT') {
      recommendations.push('Quality is inconsistent across weeks - standardize configuration');
    }

    if (scoreVariance > 300) {
      recommendations.push('High score variance indicates inconsistent processing - review data sources');
    }

    const leaveTypesCoverage = {
      totalDaysWithLeave,
      daysWithProperNames,
      daysWithColors,
      daysShowingIds,
      coveragePercentage
    };

    const trendAnalysis = {
      qualityTrend,
      averageScore,
      scoreVariance,
      bestWeek,
      worstWeek
    };

    const systemHealth = {
      configurationStatus,
      dataIntegrity,
      userExperience
    };

    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: LEAVE TYPE QUALITY ASSESSMENT COMPLETED ***`, {
      overallQuality,
      qualityScore,
      leaveTypesCoverage,
      trendAnalysis: qualityTrend
    });

    return {
      overallQuality,
      qualityScore,
      recommendations,
      weeklyScores,
      leaveTypesCoverage,
      trendAnalysis,
      systemHealth
    };
  }

  /**
   * Создает всеобъемлющий отчет по диагностике
   * REFACTORED v4.1: Complete diagnostic report
   */
  public static createComprehensiveDiagnosticReport(
    weeksData: Array<{ weekData: IWeeklyStaffData }>,
    staffRecords: IStaffRecord[],
    overallStats?: { 
      totalRecords: number; 
      recordsWithLeave: number; 
      hasLeaveTypeColorFunction: boolean 
    }
  ): {
    executiveSummary: {
      overallQuality: string;
      qualityScore: number;
      criticalIssues: number;
      recommendations: number;
    };
    weeklyAnalysis: ReturnType<typeof TimetableDataProcessorDiagnostics.createProcessingSummary>[];
    leaveTypeAssessment: ReturnType<typeof TimetableDataProcessorDiagnostics.assessLeaveTypeProcessingQuality>;
    systemRecommendations: {
      immediate: string[];
      shortTerm: string[];
      longTerm: string[];
    };
    reportMetadata: {
      generatedAt: string;
      weeksAnalyzed: number;
      recordsAnalyzed: number;
      version: string;
    };
  } {
    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: CREATING COMPREHENSIVE DIAGNOSTIC REPORT ***`);

    // Еженедельный анализ
    const weeklyAnalysis = weeksData.map(weekGroup => 
      this.createProcessingSummary(weekGroup.weekData, staffRecords)
    );

    // Оценка типов отпусков
    const leaveTypeAssessment = this.assessLeaveTypeProcessingQuality(weeksData, overallStats);

    // Исполнительная сводка
    const allCriticalIssues = weeklyAnalysis.reduce((acc, week) => 
      acc + week.actionableInsights.criticalIssues.length, 0);
    const allRecommendations = weeklyAnalysis.reduce((acc, week) => 
      acc + week.recommendations.length, 0) + leaveTypeAssessment.recommendations.length;

    const executiveSummary = {
      overallQuality: leaveTypeAssessment.overallQuality,
      qualityScore: leaveTypeAssessment.qualityScore,
      criticalIssues: allCriticalIssues,
      recommendations: allRecommendations
    };

    // Системные рекомендации
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    // Категоризируем рекомендации
    weeklyAnalysis.forEach(week => {
      week.actionableInsights.criticalIssues.forEach(issue => {
        if (!immediate.includes(issue)) {
          immediate.push(issue);
        }
      });
      
      week.actionableInsights.improvements.forEach(improvement => {
        if (!shortTerm.includes(improvement)) {
          shortTerm.push(improvement);
        }
      });
    });

    leaveTypeAssessment.recommendations.forEach(rec => {
      if (rec.includes('critical') || rec.includes('missing')) {
        if (!immediate.includes(rec)) {
          immediate.push(rec);
        }
      } else if (rec.includes('check') || rec.includes('verify')) {
        if (!shortTerm.includes(rec)) {
          shortTerm.push(rec);
        }
      } else {
        if (!longTerm.includes(rec)) {
          longTerm.push(rec);
        }
      }
    });

    // Добавляем стандартные долгосрочные рекомендации
    longTerm.push('Implement automated quality monitoring');
    longTerm.push('Consider performance optimization for large datasets');
    longTerm.push('Establish data quality metrics and alerts');

    const reportMetadata = {
      generatedAt: new Date().toISOString(),
      weeksAnalyzed: weeksData.length,
      recordsAnalyzed: staffRecords.length,
      version: '4.1'
    };

    console.log(`[TimetableDataProcessorDiagnostics] *** v4.1: COMPREHENSIVE DIAGNOSTIC REPORT COMPLETED ***`, {
      executiveSummary,
      systemRecommendations: {
        immediate: immediate.length,
        shortTerm: shortTerm.length,
        longTerm: longTerm.length
      }
    });

    return {
      executiveSummary,
      weeklyAnalysis,
      leaveTypeAssessment,
      systemRecommendations: {
        immediate,
        shortTerm,
        longTerm
      },
      reportMetadata
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
      module: 'TimetableDataProcessorDiagnostics',
      features: [
        'Week processing diagnostics',
        'Processing statistics generation',
        'Result validation with detailed metrics',
        'Processing summary with actionable insights',
        'Leave type quality assessment',
        'Trend analysis and system health monitoring',
        'Comprehensive diagnostic reports'
      ],
      totalMethods: Object.getOwnPropertyNames(TimetableDataProcessorDiagnostics)
        .filter(name => typeof TimetableDataProcessorDiagnostics[name as keyof typeof TimetableDataProcessorDiagnostics] === 'function')
        .length
    };
  }
}