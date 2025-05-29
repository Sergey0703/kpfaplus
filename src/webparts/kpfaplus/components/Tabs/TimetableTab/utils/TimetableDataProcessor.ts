// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import { 
  ITimetableDataParams, 
  ITimetableRow, 
  IWeeklyStaffData, 
  IDayInfo, 
  IWeekInfo,
  IWeekGroup,
  ITimetableStaffRow,
  IStaffMember,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableDataUtils } from './TimetableDataUtils';
import { TimetableDataAnalytics } from './TimetableDataAnalytics';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Основной процессор данных для таблицы расписания
 * Версия 3.1 - Модульная архитектура с полной поддержкой цветов отпусков и праздников
 * 
 * Этот класс является главным API для обработки данных расписания.
 * Он координирует работу утилит (TimetableDataUtils) и аналитики (TimetableDataAnalytics).
 */
export class TimetableDataProcessor {

  // *** ОСНОВНЫЕ ПУБЛИЧНЫЕ МЕТОДЫ ***

  /**
   * Основной метод обработки данных (для совместимости со старым кодом)
   * Преобразует входные данные в структуру ITimetableRow[]
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] Processing data (legacy format with leave colors and Holiday support):', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      version: '3.1 - Modular architecture with Holiday support'
    });

    const rows: ITimetableRow[] = [];

    // Используем утилиты для создания индекса
    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    console.log('[TimetableDataProcessor] Using TimetableDataUtils for indexing');

    // Обрабатываем каждого сотрудника
    staffMembers.forEach(staffMember => {
      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: TimetableDataUtils.hasPersonInfo(staffMember),
        weeks: {}
      };

      // Получаем записи для этого сотрудника из индекса
      const staffStaffRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
      
      if (staffStaffRecords.length > 0) {
        console.log(`[TimetableDataProcessor] Processing ${staffMember.name}: ${staffStaffRecords.length} records`);
      }

      // Обрабатываем каждую неделю с поддержкой цветов отпусков и праздников
      weeks.forEach(week => {
        const weeklyData = this.processWeekDataWithLeaveColorsAndHolidays(staffStaffRecords, week, getLeaveTypeColor, holidayColor);
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    // Сортируем строки используя утилиты
    const sortedRows = this.sortStaffRows(rows);

    console.log(`[TimetableDataProcessor] Processed ${sortedRows.length} staff rows using modular architecture with Holiday support`);
    return sortedRows;
  }

  /**
   * ГЛАВНЫЙ МЕТОД: Обработка данных с группировкой по неделям
   * Преобразует входные данные в структуру IWeekGroup[]
   * Версия 3.1: Использует модульную архитектуру с TimetableDataUtils и TimetableDataAnalytics + Holiday support
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] *** PROCESSING DATA BY WEEKS v3.1 (MODULAR + HOLIDAYS) ***');
    console.log('[TimetableDataProcessor] Using modular architecture with utilities, analytics and Holiday support:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      architecture: 'Modular v3.1 - Utils + Analytics + Holiday Priority System'
    });

    // Проверка входных данных
    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      console.warn('[TimetableDataProcessor] Missing essential data - returning empty result');
      return [];
    }

    // *** ЭТАП 1: СОЗДАНИЕ ИНДЕКСОВ С ПОМОЩЬЮ УТИЛИТ ***
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

    // *** ЭТАП 2: АНАЛИЗ ДАННЫХ С ПОМОЩЬЮ УТИЛИТ ***
    console.log('[TimetableDataProcessor] *** STAGE 2: Data analysis using TimetableDataUtils ***');
    const dataAnalysis = TimetableDataUtils.analyzeDataDistribution(staffRecords, staffMembers, weeks, weekRecordsIndex);
    console.log('[TimetableDataProcessor] Data analysis results from utils:', dataAnalysis);

    // *** ЭТАП 3: ОБРАБОТКА НЕДЕЛЬ С ЦВЕТАМИ ОТПУСКОВ И ПРАЗДНИКАМИ ***
    console.log('[TimetableDataProcessor] *** STAGE 3: Processing weeks with leave colors and Holiday support ***');
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} (${index + 1}/${weeks.length}) with Holiday support`);

      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;
      let weekLeaveTypesCount = 0;
      let weekHolidaysCount = 0;

      // Обрабатываем каждого сотрудника в этой неделе
      staffMembers.forEach(staffMember => {
        // Получаем записи сотрудника из индекса и фильтруем по неделе
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);
        
        // Обрабатываем недельные данные с полной поддержкой цветов отпусков и праздников
        const weeklyData = this.processWeekDataWithLeaveColorsAndHolidays(staffWeekRecords, week, getLeaveTypeColor, holidayColor);
        
        // Анализируем данные сотрудника с помощью аналитики
        const staffAnalysis = TimetableDataAnalytics.analyzeStaffWeekData(weeklyData);
        if (staffAnalysis.hasData) {
          weekHasData = true;
        }
        if (staffAnalysis.leaveTypesCount > 0) {
          weekLeaveTypesCount += staffAnalysis.leaveTypesCount;
        }

        // НОВОЕ: Подсчитываем праздники
        const holidaysInWeek = this.countHolidaysInWeekData(weeklyData);
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

      // Сортируем сотрудников в группе недели используя утилиты
      const sortedStaffRows = TimetableDataUtils.sortStaffRowsInWeek(staffRows);

      const weekGroup: IWeekGroup = {
        weekInfo: week,
        staffRows: sortedStaffRows,
        isExpanded: index === 0, // Первая неделя развернута по умолчанию
        hasData: weekHasData
      };

      weekGroups.push(weekGroup);

      console.log(`[TimetableDataProcessor] Week ${week.weekNum} completed:`, {
        staffCount: sortedStaffRows.length,
        hasData: weekHasData,
        leaveTypesFound: weekLeaveTypesCount > 0 ? weekLeaveTypesCount : 'none',
        holidaysFound: weekHolidaysCount > 0 ? weekHolidaysCount : 'none'
      });
    });

    // *** ЭТАП 4: ФИНАЛЬНАЯ СТАТИСТИКА С ПОМОЩЬЮ АНАЛИТИКИ ***
    console.log('[TimetableDataProcessor] *** STAGE 4: Final statistics using TimetableDataAnalytics ***');
    const finalStats = TimetableDataAnalytics.generateFinalStatistics(weekGroups, staffRecords, leaveTypesIndex);
    console.log('[TimetableDataProcessor] *** PROCESSING COMPLETED v3.1 (MODULAR + HOLIDAYS) ***', finalStats);

    return weekGroups;
  }

  // *** ПРИВАТНЫЕ МЕТОДЫ ОБРАБОТКИ ***

  /**
   * Обрабатывает недельные данные с полной поддержкой цветов отпусков и праздников
   * ОБНОВЛЕНО: Добавлена поддержка Holiday поля
   */
  private static processWeekDataWithLeaveColorsAndHolidays(
    staffRecords: IStaffRecord[], 
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IWeeklyStaffData {
    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    // Фильтруем записи по неделе используя утилиты
    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);

    // Обрабатываем каждый день недели (1-7) с поддержкой цветов отпусков и праздников
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColorsAndHolidays(
        weekRecords, 
        dayNum, 
        week.weekStart, 
        week.weekEnd,
        getLeaveTypeColor,
        holidayColor
      );
      
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    // Форматируем недельный итог
    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);

    return weeklyData;
  }

  /**
   * Обрабатывает дневные данные с полной поддержкой цветов отпусков и праздников
   * ОБНОВЛЕНО: Полная поддержка Holiday поля и системы приоритетов
   */
  private static processDayDataWithLeaveColorsAndHolidays(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    // Находим дату для этого дня недели используя утилиты
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    // Получаем смены для дня с полной поддержкой цветов отпусков и праздников
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    // Рассчитываем общие минуты
    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    
    // Форматируем содержимое
    const formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // ОБНОВЛЕНО: Определяем цвет ячейки и наличие отпуска/праздника используя новую систему приоритетов
    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    
    // НОВОЕ: Поддержка праздников
    const hasHoliday = TimetableShiftCalculator.hasHolidays ? TimetableShiftCalculator.hasHolidays(shifts) : shifts.some(s => s.isHoliday);
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    // НОВОЕ: Определяем финальный цвет ячейки по системе приоритетов
    let finalCellColor: string | undefined = undefined;
    if (hasHoliday) {
      // Праздники имеют высший приоритет
      finalCellColor = holidayColorFinal;
    } else if (hasLeave && leaveTypeColor) {
      // Типы отпусков имеют средний приоритет
      finalCellColor = leaveTypeColor;
    }
    // Иначе остается undefined (белый фон по умолчанию)

    // Дополнительная информация о типах отпусков и праздниках для отладки
    if (hasHoliday) {
      console.log(`[TimetableDataProcessor] Day ${dayNumber} has HOLIDAY (priority 1):`, {
        holidayColor: holidayColorFinal,
        hasLeave,
        leaveTypeColor: hasLeave ? leaveTypeColor : 'none',
        finalColor: finalCellColor,
        priorityApplied: 'HOLIDAY (highest)'
      });
    } else if (hasLeave) {
      console.log(`[TimetableDataProcessor] Day ${dayNumber} has leave (priority 2):`, {
        leaveTypeColor,
        finalColor: finalCellColor,
        priorityApplied: 'LEAVE_TYPE'
      });
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0,
      leaveTypeColor,
      hasLeave,
      // НОВЫЕ поля для праздников
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * НОВЫЙ МЕТОД: Подсчитывает количество праздников в недельных данных
   */
  private static countHolidaysInWeekData(weeklyData: IWeeklyStaffData): number {
    let holidaysCount = 0;
    
    Object.values(weeklyData.days).forEach((day: IDayInfo) => {
      if (day.hasHoliday) {
        holidaysCount += day.shifts.filter(s => s.isHoliday).length;
      }
    });
    
    return holidaysCount;
  }

  // *** МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ (ИСПОЛЬЗУЮТ УТИЛИТЫ) ***

  /**
   * Сортирует строки сотрудников (для старого формата)
   */
  private static sortStaffRows(rows: ITimetableRow[]): ITimetableRow[] {
    return rows.sort((a, b) => {
      if (a.isDeleted !== b.isDeleted) {
        return a.isDeleted ? 1 : -1;
      }
      if (a.hasPersonInfo !== b.hasPersonInfo) {
        return a.hasPersonInfo ? -1 : 1;
      }
      return a.staffName.localeCompare(b.staffName);
    });
  }

  // *** ДЕЛЕГИРОВАНИЕ К УТИЛИТАМ И АНАЛИТИКЕ ***

  /**
   * Получает расширенную сводную статистику (делегирует к TimetableDataAnalytics)
   */
  public static getAdvancedDataSummary(weekGroups: IWeekGroup[]) {
    return TimetableDataAnalytics.getAdvancedDataSummary(weekGroups);
  }

  /**
   * Анализирует использование цветов отпусков (делегирует к TimetableDataAnalytics)
   */
  public static analyzeLeaveColorsUsage(weekGroups: IWeekGroup[]) {
    return TimetableDataAnalytics.analyzeLeaveColorsUsage(weekGroups);
  }

  /**
   * Фильтрует данные недель по критериям (делегирует к TimetableDataUtils)
   */
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
      // НОВОЕ: Фильтры для праздников
      showOnlyWithHoliday?: boolean;
      hideHolidays?: boolean;
    }
  ) {
    return TimetableDataUtils.filterWeeksDataAdvanced(weekGroups, filters);
  }

  /**
   * Экспортирует данные с цветами отпусков (делегирует к TimetableDataAnalytics)
   */
  public static exportWeeksDataWithLeaveColors(weekGroups: IWeekGroup[]) {
    return TimetableDataAnalytics.exportWeeksDataWithLeaveColors(weekGroups);
  }

  /**
   * Валидация данных с проверкой цветов отпусков (делегирует к TimetableDataUtils)
   */
  public static validateDataIntegrityWithLeaveColors(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ) {
    return TimetableDataUtils.validateDataIntegrityWithLeaveColors(
      staffRecords, 
      staffMembers, 
      getLeaveTypeColor
    );
  }

  /**
   * Оптимизирует производительность обработки (делегирует к TimetableDataUtils)
   */
  public static optimizeProcessingPerformance(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    weeks: IWeekInfo[]
  ) {
    return TimetableDataUtils.optimizeProcessingPerformance(staffRecords, staffMembers, weeks);
  }

  /**
   * Анализирует продуктивность и использование времени (делегирует к TimetableDataAnalytics)
   */
  public static analyzeProductivityMetrics(weekGroups: IWeekGroup[]) {
    return TimetableDataAnalytics.analyzeProductivityMetrics(weekGroups);
  }

  /**
   * Анализирует паттерны использования отпусков (делегирует к TimetableDataAnalytics)
   */
  public static analyzeLeavePatterns(weekGroups: IWeekGroup[]) {
    return TimetableDataAnalytics.analyzeLeavePatterns(weekGroups);
  }

  /**
   * Создает сводный аналитический отчет (делегирует к TimetableDataAnalytics)
   */
  public static generateComprehensiveReport(weekGroups: IWeekGroup[]) {
    return TimetableDataAnalytics.generateComprehensiveReport(weekGroups);
  }

  // *** СТАТИЧЕСКИЕ МЕТОДЫ ДЛЯ БЫСТРОГО ДОСТУПА ***

  /**
   * Быстрый доступ к утилитам
   */
  public static get Utils() {
    return TimetableDataUtils;
  }

  /**
   * Быстрый доступ к аналитике
   */
  public static get Analytics() {
    return TimetableDataAnalytics;
  }

  // *** ИНФОРМАЦИЯ О ВЕРСИИ ***

  /**
   * Информация о версии и архитектуре
   */
  public static getVersionInfo(): {
    version: string;
    architecture: string;
    modules: string[];
    features: string[];
    compatibility: string;
  } {
    return {
      version: '3.1',
      architecture: 'Modular',
      modules: [
        'TimetableDataProcessor (Main API)',
        'TimetableDataUtils (Indexing, Validation, Filtering)',
        'TimetableDataAnalytics (Statistics, Reports, Export)'
      ],
      features: [
        'Leave Colors Support',
        'Holiday Support with Priority System',
        'Advanced Analytics',
        'Performance Optimization',
        'Data Validation',
        'Comprehensive Reporting'
      ],
      compatibility: 'Fully backward compatible with v2.x and v3.0'
    };
  }

  /**
   * Проверяет целостность модульной архитектуры
   */
  public static validateModularArchitecture(): {
    isValid: boolean;
    modules: Array<{
      name: string;
      available: boolean;
      methods: number;
    }>;
    recommendations: string[];
  } {
    const modules = [
      {
        name: 'TimetableDataUtils',
        available: !!TimetableDataUtils,
        methods: Object.getOwnPropertyNames(TimetableDataUtils).filter(name => 
          typeof TimetableDataUtils[name as keyof typeof TimetableDataUtils] === 'function'
        ).length
      },
      {
        name: 'TimetableDataAnalytics',
        available: !!TimetableDataAnalytics,
        methods: Object.getOwnPropertyNames(TimetableDataAnalytics).filter(name => 
          typeof TimetableDataAnalytics[name as keyof typeof TimetableDataAnalytics] === 'function'
        ).length
      }
    ];

    const isValid = modules.every(module => module.available && module.methods > 0);
    
    const recommendations: string[] = [];
    if (!isValid) {
      recommendations.push('Some modules are missing or incomplete');
      modules.forEach(module => {
        if (!module.available) {
          recommendations.push(`Module ${module.name} is not available`);
        }
        if (module.methods === 0) {
          recommendations.push(`Module ${module.name} has no methods`);
        }
      });
    } else {
      recommendations.push('Modular architecture is properly configured with Holiday support');
    }

    return {
      isValid,
      modules,
      recommendations
    };
  }
}