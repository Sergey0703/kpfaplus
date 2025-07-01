// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import {
  ITimetableDataParams,
  ITimetableRow,
  IWeekGroup,
  ITimetableStaffRow,
  IStaffMember,
  IWeekInfo
} from '../interfaces/TimetableInterfaces';
import { TimetableDataUtils } from './TimetableDataUtils';
import { TimetableDataAnalytics } from './TimetableDataAnalytics';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

import { TimetableDataProcessorCore } from './TimetableDataProcessorCore';

/**
 * Основной процессор данных для таблицы расписания
 */
export class TimetableDataProcessor {

  /**
   * Основной метод обработки данных
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, getLeaveTypeColor, holidayColor, holidays, holidaysService } = params;

    const rows: ITimetableRow[] = [];
    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);

    staffMembers.forEach(staffMember => {
      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: TimetableDataUtils.hasPersonInfo(staffMember),
        weeks: {}
      };

      const staffStaffRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);

      weeks.forEach(week => {
        const weeklyData = TimetableDataProcessorCore.processWeekDataWithLeaveColorsAndHolidays(
            staffStaffRecords,
            week,
            getLeaveTypeColor,
            holidayColor,
            holidays,
            holidaysService
        );
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    return TimetableDataProcessorCore.sortStaffRows(rows);
  }

  /**
   * Обработка данных с группировкой по неделям
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, getLeaveTypeColor, holidayColor, holidays, holidaysService } = params;

    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      return [];
    }

    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;

      staffMembers.forEach(staffMember => {
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);

        const weeklyData = TimetableDataProcessorCore.processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
          staffWeekRecords,
          week,
          getLeaveTypeColor,
          holidayColor,
          holidays,
          holidaysService
        );

        const staffAnalysis = TimetableDataAnalytics.analyzeStaffWeekData(weeklyData);
        if (staffAnalysis.hasData) weekHasData = true;

        const staffRow: ITimetableStaffRow = {
          staffId: staffMember.id,
          staffName: staffMember.name,
          isDeleted: staffMember.deleted === 1,
          hasPersonInfo: TimetableDataUtils.hasPersonInfo(staffMember),
          weekData: weeklyData
        };
        staffRows.push(staffRow);
      });

      const sortedStaffRows = TimetableDataUtils.sortStaffRowsInWeek(staffRows);
      const weekGroup: IWeekGroup = {
        weekInfo: week,
        staffRows: sortedStaffRows,
        isExpanded: index === 0,
        hasData: weekHasData
      };
      weekGroups.push(weekGroup);
    });

    return weekGroups;
  }

  /**
   * Специальная обработка данных для экспорта в Excel
   */
  public static processDataForExcelExport(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, getLeaveTypeColor, holidayColor, holidays, holidaysService } = params;

    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      return [];
    }

    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach(week => {
      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;

      staffMembers.forEach(staffMember => {
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);

        const weeklyData = TimetableDataProcessorCore.processWeekDataForExcelWithFullMarkers(
          staffWeekRecords,
          week,
          getLeaveTypeColor,
          holidayColor,
          holidays,
          holidaysService
        );

        const staffAnalysis = TimetableDataAnalytics.analyzeStaffWeekData(weeklyData);
        if (staffAnalysis.hasData) weekHasData = true;

        const staffRow: ITimetableStaffRow = {
          staffId: staffMember.id,
          staffName: staffMember.name,
          isDeleted: staffMember.deleted === 1,
          hasPersonInfo: TimetableDataUtils.hasPersonInfo(staffMember),
          weekData: weeklyData
        };
        staffRows.push(staffRow);
      });

      const sortedStaffRows = TimetableDataUtils.sortStaffRowsInWeek(staffRows);
      const weekGroup: IWeekGroup = {
        weekInfo: week,
        staffRows: sortedStaffRows,
        isExpanded: true,
        hasData: weekHasData
      };
      weekGroups.push(weekGroup);
    });

    return weekGroups;
  }

  // Делегирование к утилитам и аналитике
  public static getAdvancedDataSummary(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataAnalytics.getAdvancedDataSummary> {
    return TimetableDataAnalytics.getAdvancedDataSummary(weekGroups);
  }

  public static analyzeLeaveColorsUsage(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataAnalytics.analyzeLeaveColorsUsage> {
    return TimetableDataAnalytics.analyzeLeaveColorsUsage(weekGroups);
  }

  public static filterWeeksDataAdvanced(
    weekGroups: IWeekGroup[],
    filters: {
      showDeleted?: boolean;
      showTemplates?: boolean;
      searchText?: string;
      showOnlyWithLeave?: boolean;
      leaveTypeIds?: string[];
      leaveColors?: string[];
      minHoursPerWeek?: number;
      maxHoursPerWeek?: number;
      showOnlyWithHoliday?: boolean;
      hideHolidays?: boolean;
    }
  ): ReturnType<typeof TimetableDataUtils.filterWeeksDataAdvanced> {
    return TimetableDataUtils.filterWeeksDataAdvanced(weekGroups, filters);
  }

  public static exportWeeksDataWithLeaveColors(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataAnalytics.exportWeeksDataWithLeaveColors> {
    return TimetableDataAnalytics.exportWeeksDataWithLeaveColors(weekGroups);
  }

  public static validateDataIntegrityWithLeaveColors(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): ReturnType<typeof TimetableDataUtils.validateDataIntegrityWithLeaveColors> {
    return TimetableDataUtils.validateDataIntegrityWithLeaveColors(
      staffRecords,
      staffMembers,
      getLeaveTypeColor
    );
  }

  public static optimizeProcessingPerformance(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    weeks: IWeekInfo[]
  ): ReturnType<typeof TimetableDataUtils.optimizeProcessingPerformance> {
    return TimetableDataUtils.optimizeProcessingPerformance(staffRecords, staffMembers, weeks);
  }

  public static analyzeProductivityMetrics(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataAnalytics.analyzeProductivityMetrics> {
    return TimetableDataAnalytics.analyzeProductivityMetrics(weekGroups);
  }

  public static analyzeLeavePatterns(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataAnalytics.analyzeLeavePatterns> {
    return TimetableDataAnalytics.analyzeLeavePatterns(weekGroups);
  }

  public static generateComprehensiveReport(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataAnalytics.generateComprehensiveReport> {
    return TimetableDataAnalytics.generateComprehensiveReport(weekGroups);
  }

  // Статические методы для быстрого доступа
  public static get Utils(): typeof TimetableDataUtils {
    return TimetableDataUtils;
  }

  public static get Analytics(): typeof TimetableDataAnalytics {
    return TimetableDataAnalytics;
  }
}