// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import {
  ITimetableDataParams,
  ITimetableRow,
  IWeekGroup,
  ITimetableStaffRow,
  IStaffMember,
  IWeekInfo,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableDataUtils } from './TimetableDataUtils';
import { TimetableDataAnalytics } from './TimetableDataAnalytics';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

// Import new core and meta modules
import { TimetableDataProcessorCore } from './TimetableDataProcessorCore';
import { TimetableDataProcessorMeta } from './TimetableDataProcessorMeta';

/**
 * Основной процессор данных для таблицы расписания
 * Версия 3.3 - ИСПРАВЛЕНО: Показ праздников и отпусков даже без рабочих смен + сохранение информации о типах отпусков
 * НОВОЕ: Добавлена специальная поддержка Excel экспорта
 *
 * Этот класс является главным API для обработки данных расписания.
 * Он координирует работу утилит (TimetableDataUtils), аналитики (TimetableDataAnalytics),
 * и основного процессинга (TimetableDataProcessorCore).
 */
export class TimetableDataProcessor {

  // *** ОСНОВНЫЕ ПУБЛИЧНЫЕ МЕТОДЫ ***

  /**
   * Основной метод обработки данных (для совместимости со старым кодом)
   * Преобразует входные данные в структуру ITimetableRow[]
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] Processing data (legacy format with leave colors and Holiday support v3.3):', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      version: '3.3 - Shows holidays/leaves even without work shifts + preserves leave type info'
    });

    const rows: ITimetableRow[] = [];

    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    console.log('[TimetableDataProcessor] Using TimetableDataUtils for indexing');

    staffMembers.forEach(staffMember => {
      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: TimetableDataUtils.hasPersonInfo(staffMember),
        weeks: {}
      };

      const staffStaffRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);

      if (staffStaffRecords.length > 0) {
        console.log(`[TimetableDataProcessor] Processing ${staffMember.name}: ${staffStaffRecords.length} records`);
      }

      weeks.forEach(week => {
        // Delegate to TimetableDataProcessorCore
        const weeklyData = TimetableDataProcessorCore.processWeekDataWithLeaveColorsAndHolidays(
            staffStaffRecords,
            week,
            getLeaveTypeColor,
            holidayColor
        );
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    // Delegate sorting to TimetableDataProcessorCore
    const sortedRows = TimetableDataProcessorCore.sortStaffRows(rows);

    console.log(`[TimetableDataProcessor] Processed ${sortedRows.length} staff rows using modular architecture with Holiday support v3.3`);
    return sortedRows;
  }

  /**
   * ГЛАВНЫЙ МЕТОД: Обработка данных с группировкой по неделям
   * Преобразует входные данные в структуру IWeekGroup[]
   * Версия 3.3: ИСПРАВЛЕНО - показ праздников/отпусков даже без рабочих смен + сохранение информации о типах отпусков
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] *** PROCESSING DATA BY WEEKS v3.3 (HOLIDAYS/LEAVES WITHOUT SHIFTS + LEAVE TYPE INFO PRESERVATION) ***');
    console.log('[TimetableDataProcessor] Using modular architecture with utilities, analytics and Holiday support v3.3:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      architecture: 'Modular v3.3 - Utils + Analytics + Core + Meta + Holiday Priority System + Non-work days + Leave Type Info Preservation'
    });

    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      console.warn('[TimetableDataProcessor] Missing essential data - returning empty result');
      return [];
    }

    const startTime = performance.now();
    console.log('[TimetableDataProcessor] *** STAGE 1: Creating indexes using TimetableDataUtils ***');
    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    const weekRecordsIndex = TimetableDataUtils.createWeeksRecordsIndex(staffRecords, weeks);
    const leaveTypesIndex = TimetableDataUtils.createLeaveTypesIndex(staffRecords, getLeaveTypeColor);
    const indexTime = performance.now() - startTime;
    console.log('[TimetableDataProcessor] *** INDEXES CREATED USING UTILS ***', {
      indexCreationTime: Math.round(indexTime) + 'ms',
      utilsUsed: 'TimetableDataUtils for all indexing operations'
    });

    console.log('[TimetableDataProcessor] *** STAGE 2: Data analysis using TimetableDataUtils ***');
    const dataAnalysis = TimetableDataUtils.analyzeDataDistribution(staffRecords, staffMembers, weeks, weekRecordsIndex);
    console.log('[TimetableDataProcessor] Data analysis results from utils:', dataAnalysis);

    console.log('[TimetableDataProcessor] *** STAGE 3: Processing weeks with leave colors and Holiday support v3.3 (including non-work days + leave type preservation) ***');
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} (${index + 1}/${weeks.length}) with Holiday support v3.3 and leave type preservation`);
      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;
      let weekLeaveTypesCount = 0;
      let weekHolidaysCount = 0;

      staffMembers.forEach(staffMember => {
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);

        // Delegate to TimetableDataProcessorCore with FIXED leave type preservation
        const weeklyData = TimetableDataProcessorCore.processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
          staffWeekRecords,
          week,
          getLeaveTypeColor,
          holidayColor
        );

        const staffAnalysis = TimetableDataAnalytics.analyzeStaffWeekData(weeklyData);
        if (staffAnalysis.hasData) weekHasData = true;
        if (staffAnalysis.leaveTypesCount > 0) weekLeaveTypesCount += staffAnalysis.leaveTypesCount;
        
        // Delegate to TimetableDataProcessorCore for counting holidays
        const holidaysInWeek = TimetableDataProcessorCore.countHolidaysInWeekData(weeklyData);
        weekHolidaysCount += holidaysInWeek;

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

      console.log(`[TimetableDataProcessor] Week ${week.weekNum} completed v3.3:`, {
        staffCount: sortedStaffRows.length,
        hasData: weekHasData,
        leaveTypesFound: weekLeaveTypesCount > 0 ? weekLeaveTypesCount : 'none',
        holidaysFound: weekHolidaysCount > 0 ? weekHolidaysCount : 'none',
        improvement: 'Leave type information now preserved in dayData'
      });
    });

    console.log('[TimetableDataProcessor] *** STAGE 4: Final statistics using TimetableDataAnalytics ***');
    const finalStats = TimetableDataAnalytics.generateFinalStatistics(weekGroups, staffRecords, leaveTypesIndex);
    console.log('[TimetableDataProcessor] *** PROCESSING COMPLETED v3.3 (HOLIDAYS/LEAVES WITHOUT SHIFTS + LEAVE TYPE INFO PRESERVATION) ***', finalStats);

    return weekGroups;
  }

  /**
   * НОВЫЙ МЕТОД: Специальная обработка данных для экспорта в Excel
   * Версия 3.3: Включает отметки праздников/отпусков даже без рабочих смен + сохранение информации о типах отпусков
   */
  public static processDataForExcelExport(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] *** PROCESSING DATA FOR EXCEL EXPORT v3.3 ***');
    console.log('[TimetableDataProcessor] Excel export processing with full Holiday/Leave markers support + leave type preservation v3.3:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      version: '3.3 - Full support for non-work Holiday/Leave markers in Excel export + leave type info preservation'
    });

    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      console.warn('[TimetableDataProcessor] Missing essential data for Excel export - returning empty result');
      return [];
    }

    const startTime = performance.now();
    console.log('[TimetableDataProcessor] *** CREATING INDEXES FOR EXCEL EXPORT ***');
    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    const indexTime = performance.now() - startTime;
    console.log('[TimetableDataProcessor] *** INDEXES CREATED FOR EXCEL EXPORT ***', {
      indexCreationTime: Math.round(indexTime) + 'ms',
      utilsUsed: 'TimetableDataUtils for all indexing operations'
    });

    console.log('[TimetableDataProcessor] *** PROCESSING WEEKS FOR EXCEL WITH FULL MARKERS SUPPORT + LEAVE TYPE PRESERVATION ***');
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} for Excel export with full markers support + leave type preservation v3.3`);
      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;

      staffMembers.forEach(staffMember => {
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);

        // Delegate to TimetableDataProcessorCore with FIXED leave type preservation
        const weeklyData = TimetableDataProcessorCore.processWeekDataForExcelWithFullMarkers(
          staffWeekRecords,
          week,
          getLeaveTypeColor,
          holidayColor
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

      console.log(`[TimetableDataProcessor] Week ${week.weekNum} processed for Excel export v3.3:`, {
        staffCount: sortedStaffRows.length,
        hasData: weekHasData,
        improvement: 'Excel export now preserves leave type information'
      });
    });

    console.log('[TimetableDataProcessor] *** EXCEL EXPORT PROCESSING COMPLETED v3.3 ***');
    return weekGroups;
  }
  // *** ДЕЛЕГИРОВАНИЕ К УТИЛИТАМ И АНАЛИТИКЕ (REMAINS AS PUBLIC API OF PROCESSOR) ***

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

  // *** СТАТИЧЕСКИЕ МЕТОДЫ ДЛЯ БЫСТРОГО ДОСТУПА ***

  public static get Utils(): typeof TimetableDataUtils {
    return TimetableDataUtils;
  }

  public static get Analytics(): typeof TimetableDataAnalytics {
    return TimetableDataAnalytics;
  }

  // *** ИНФОРМАЦИЯ О ВЕРСИИ И META-МЕТОДЫ - DELEGATE TO TimetableDataProcessorMeta.ts ***

  public static getVersionInfo(): ReturnType<typeof TimetableDataProcessorMeta.getVersionInfo> {
    return TimetableDataProcessorMeta.getVersionInfo();
  }

  public static validateModularArchitecture(): ReturnType<typeof TimetableDataProcessorMeta.validateModularArchitecture> {
    // We can enhance this by passing the actual Core and Meta classes if needed for deeper validation
    return TimetableDataProcessorMeta.validateModularArchitecture();
  }

  public static getExcelExportPreview(weekGroups: IWeekGroup[]): ReturnType<typeof TimetableDataProcessorMeta.getExcelExportPreview> {
    return TimetableDataProcessorMeta.getExcelExportPreview(weekGroups);
  }
}