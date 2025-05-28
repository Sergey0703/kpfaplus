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
  IShiftInfo
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Оптимизированный процессор данных для таблицы расписания
 * Преобразует данные StaffRecords в структуру для отображения по неделям и дням
 * ВЕРСИЯ 3.0: Полная поддержка цветов отпусков + оптимизированная обработка данных
 */
export class TimetableDataProcessor {

  /**
   * Основной метод обработки данных (старый формат - для совместимости)
   * Преобразует входные данные в структуру ITimetableRow[]
   * ОБНОВЛЕНО: Полная поддержка цветов отпусков
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor } = params;

    console.log('[TimetableDataProcessor] Processing data (legacy format with leave colors support):', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      version: '3.0 - Full leave colors support'
    });

    const rows: ITimetableRow[] = [];

    // Создаем оптимизированный индекс записей
    const recordsIndex = this.createStaffRecordsIndex(staffRecords);
    console.log('[TimetableDataProcessor] Created optimized records index:', Object.keys(recordsIndex).length, 'unique staff');

    // Обрабатываем каждого сотрудника
    staffMembers.forEach(staffMember => {
      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: this.hasPersonInfo(staffMember),
        weeks: {}
      };

      // Получаем записи для этого сотрудника из индекса
      const staffStaffRecords = this.getStaffRecordsFromIndex(recordsIndex, staffMember);
      
      if (staffStaffRecords.length > 0) {
        console.log(`[TimetableDataProcessor] Processing ${staffMember.name}: ${staffStaffRecords.length} records`);
      }

      // Обрабатываем каждую неделю с поддержкой цветов отпусков
      weeks.forEach(week => {
        const weeklyData = this.processWeekDataWithLeaveColors(staffStaffRecords, week, getLeaveTypeColor);
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    // Сортируем строки
    const sortedRows = this.sortStaffRows(rows);

    console.log(`[TimetableDataProcessor] Processed ${sortedRows.length} staff rows with leave colors support`);
    return sortedRows;
  }

  /**
   * ГЛАВНЫЙ МЕТОД: Обработка данных с группировкой по неделям
   * Преобразует входные данные в структуру IWeekGroup[]
   * ВЕРСИЯ 3.0: Максимальная оптимизация + полная поддержка цветов отпусков
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor } = params;

    console.log('[TimetableDataProcessor] *** PROCESSING DATA BY WEEKS v3.0 ***');
    console.log('[TimetableDataProcessor] Advanced processing with leave colors:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      version: '3.0 - Optimized with full leave colors support'
    });

    // Проверка входных данных
    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      console.warn('[TimetableDataProcessor] Missing essential data - returning empty result');
      return [];
    }

    // *** ЭТАП 1: СОЗДАНИЕ ОПТИМИЗИРОВАННЫХ ИНДЕКСОВ ***
    const startTime = performance.now();
    
    console.log('[TimetableDataProcessor] *** STAGE 1: Creating optimized indexes ***');
    const recordsIndex = this.createStaffRecordsIndex(staffRecords);
    const weekRecordsIndex = this.createWeeksRecordsIndex(staffRecords, weeks);
    const leaveTypesIndex = this.createLeaveTypesIndex(staffRecords, getLeaveTypeColor);
    
    const indexTime = performance.now() - startTime;
    console.log('[TimetableDataProcessor] *** INDEXES CREATED ***', {
      indexCreationTime: Math.round(indexTime) + 'ms',
      staffIndex: Object.keys(recordsIndex).length + ' unique staff',
      weekIndex: Object.keys(weekRecordsIndex).length + ' weeks with data',
      leaveTypesIndex: Object.keys(leaveTypesIndex).length + ' unique leave types',
      totalRecordsIndexed: staffRecords.length
    });

    // *** ЭТАП 2: АНАЛИЗ ДАННЫХ И ДИАГНОСТИКА ***
    console.log('[TimetableDataProcessor] *** STAGE 2: Data analysis and diagnostics ***');
    const dataAnalysis = this.analyzeDataDistribution(staffRecords, staffMembers, weeks, weekRecordsIndex);
    console.log('[TimetableDataProcessor] Data analysis results:', dataAnalysis);

    // *** ЭТАП 3: ОБРАБОТКА НЕДЕЛЬ С ЦВЕТАМИ ОТПУСКОВ ***
    console.log('[TimetableDataProcessor] *** STAGE 3: Processing weeks with leave colors ***');
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} (${index + 1}/${weeks.length})`);

      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;
      let weekLeaveTypesCount = 0;

      // Обрабатываем каждого сотрудника в этой неделе
      staffMembers.forEach(staffMember => {
        // Получаем записи сотрудника из индекса и фильтруем по неделе
        const staffAllRecords = this.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = this.filterRecordsByWeek(staffAllRecords, week);
        
        // Обрабатываем недельные данные с полной поддержкой цветов отпусков
        const weeklyData = this.processWeekDataWithLeaveColors(staffWeekRecords, week, getLeaveTypeColor);
        
        // Анализируем данные сотрудника
        const staffAnalysis = this.analyzeStaffWeekData(weeklyData);
        if (staffAnalysis.hasData) {
          weekHasData = true;
        }
        if (staffAnalysis.leaveTypesCount > 0) {
          weekLeaveTypesCount += staffAnalysis.leaveTypesCount;
        }

        const staffRow: ITimetableStaffRow = {
          staffId: staffMember.id,
          staffName: staffMember.name,
          isDeleted: staffMember.deleted === 1,
          hasPersonInfo: this.hasPersonInfo(staffMember),
          weekData: weeklyData
        };

        staffRows.push(staffRow);
      });

      // Сортируем сотрудников в группе недели
      const sortedStaffRows = this.sortStaffRowsInWeek(staffRows);

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
        leaveTypesFound: weekLeaveTypesCount > 0 ? weekLeaveTypesCount : 'none'
      });
    });

    // *** ЭТАП 4: ФИНАЛЬНАЯ СТАТИСТИКА И ВАЛИДАЦИЯ ***
    console.log('[TimetableDataProcessor] *** STAGE 4: Final statistics and validation ***');
    const finalStats = this.generateFinalStatistics(weekGroups, staffRecords, leaveTypesIndex);
    console.log('[TimetableDataProcessor] *** PROCESSING COMPLETED v3.0 ***', finalStats);

    return weekGroups;
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Создает индекс записей по сотрудникам ***
   */
  private static createStaffRecordsIndex(allRecords: IStaffRecord[]): Record<string, IStaffRecord[]> {
    console.log('[TimetableDataProcessor] Creating staff records index...');
    
    const index: Record<string, IStaffRecord[]> = {};
    let indexedRecords = 0;
    
    allRecords.forEach(record => {
      const staffMemberId = record.StaffMemberLookupId?.toString();
      if (staffMemberId) {
        if (!index[staffMemberId]) {
          index[staffMemberId] = [];
        }
        index[staffMemberId].push(record);
        indexedRecords++;
      }
    });

    // Сортируем записи в каждой группе по дате для оптимизации
    Object.keys(index).forEach(staffId => {
      index[staffId].sort((a, b) => a.Date.getTime() - b.Date.getTime());
    });

    console.log('[TimetableDataProcessor] Staff records index created:', {
      uniqueStaff: Object.keys(index).length,
      recordsIndexed: indexedRecords,
      indexEfficiency: Math.round((indexedRecords / allRecords.length) * 100) + '%'
    });

    return index;
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Создает индекс записей по неделям ***
   */
  private static createWeeksRecordsIndex(allRecords: IStaffRecord[], weeks: IWeekInfo[]): Record<number, IStaffRecord[]> {
    console.log('[TimetableDataProcessor] Creating weeks records index...');
    
    const index: Record<number, IStaffRecord[]> = {};
    
    // Инициализируем индекс для всех недель
    weeks.forEach(week => {
      index[week.weekNum] = [];
    });

    let recordsOutsideWeeks = 0;
    
    // Распределяем записи по неделям
    allRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      
      // Находим неделю для этой записи
      const matchingWeek = weeks.find(week => 
        TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
      );
      
      if (matchingWeek) {
        index[matchingWeek.weekNum].push(record);
      } else {
        recordsOutsideWeeks++;
      }
    });

    const weeksWithRecords = Object.values(index).filter(records => records.length > 0).length;
    
    console.log('[TimetableDataProcessor] Weeks records index created:', {
      totalWeeks: weeks.length,
      weeksWithRecords: weeksWithRecords,
      recordsOutsideWeeks: recordsOutsideWeeks,
      distributionQuality: weeksWithRecords > 1 ? 'GOOD - Multi-week distribution' : 'WARNING - Single week concentration'
    });

    return index;
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Создает индекс типов отпусков ***
   */
  private static createLeaveTypesIndex(
    allRecords: IStaffRecord[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): Record<string, { count: number; color?: string; title?: string }> {
    console.log('[TimetableDataProcessor] Creating leave types index...');
    
    const index: Record<string, { count: number; color?: string; title?: string }> = {};
    
    if (!getLeaveTypeColor) {
      console.log('[TimetableDataProcessor] No leave type color function provided - skipping leave types indexing');
      return index;
    }
    
    allRecords.forEach(record => {
      if (record.TypeOfLeaveID) {
        const leaveTypeId = record.TypeOfLeaveID;
        
        if (!index[leaveTypeId]) {
          index[leaveTypeId] = {
            count: 0,
            color: getLeaveTypeColor(leaveTypeId),
            title: record.TypeOfLeave?.Title || leaveTypeId
          };
        }
        
        index[leaveTypeId].count++;
      }
    });

    console.log('[TimetableDataProcessor] Leave types index created:', {
      uniqueLeaveTypes: Object.keys(index).length,
      totalRecordsWithLeave: Object.values(index).reduce((sum, lt) => sum + lt.count, 0),
      leaveTypesBreakdown: Object.entries(index).map(([id, data]) => ({
        id,
        title: data.title,
        count: data.count,
        hasColor: !!data.color
      }))
    });

    return index;
  }

  /**
   * *** ОПТИМИЗИРОВАННЫЙ МЕТОД: Получение записей для сотрудника из индекса ***
   */
  private static getStaffRecordsFromIndex(
    recordsIndex: Record<string, IStaffRecord[]>,
    staffMember: IStaffMember
  ): IStaffRecord[] {
    const staffEmployeeId = staffMember.employeeId?.toString();
    
    if (!staffEmployeeId) {
      return [];
    }
    
    return recordsIndex[staffEmployeeId] || [];
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Фильтрует записи по неделе ***
   */
  private static filterRecordsByWeek(records: IStaffRecord[], week: IWeekInfo): IStaffRecord[] {
    return records.filter(record => {
      const recordDate = new Date(record.Date);
      return TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
    });
  }

  /**
   * *** ГЛАВНЫЙ МЕТОД v3.0: Обработка недельных данных с полной поддержкой цветов отпусков ***
   */
  private static processWeekDataWithLeaveColors(
    staffRecords: IStaffRecord[], 
    week: IWeekInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IWeeklyStaffData {
    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    // Фильтруем записи по неделе (дополнительная проверка)
    const weekRecords = this.filterRecordsByWeek(staffRecords, week);

    // Обрабатываем каждый день недели (1-7) с поддержкой цветов отпусков
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColors(
        weekRecords, 
        dayNum, 
        week.weekStart, 
        week.weekEnd,
        getLeaveTypeColor
      );
      
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    // Форматируем недельный итог
    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);

    return weeklyData;
  }

  /**
   * *** ГЛАВНЫЙ МЕТОД v3.0: Обработка дневных данных с полной поддержкой цветов отпусков ***
   */
  private static processDayDataWithLeaveColors(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IDayInfo {
    // Находим дату для этого дня недели
    const dayDate = this.getDateForDayInWeek(weekStart, dayNumber);
    
    // Получаем смены для дня с полной поддержкой цветов отпусков
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

    // *** ПОЛНАЯ ПОДДЕРЖКА ЦВЕТОВ ОТПУСКОВ v3.0 ***
    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);

    // Дополнительная информация о типах отпусков
    const leaveInfo = {
      leaveTypeColor,
      hasLeave,
      leaveTypesCount: TimetableShiftCalculator.getUniqueLeaveTypes(shifts).length,
      allLeaveColors: TimetableShiftCalculator.getAllLeaveColors(shifts),
      leaveInfo: TimetableShiftCalculator.formatLeaveInfo(shifts)
    };

    if (hasLeave) {
      console.log(`[TimetableDataProcessor] Day ${dayNumber} has leave:`, leaveInfo);
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0,
      leaveTypeColor,
      hasLeave
    };
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Анализирует распределение данных ***
   */
  private static analyzeDataDistribution(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    weeks: IWeekInfo[],
    weekRecordsIndex: Record<number, IStaffRecord[]>
  ): {
    totalRecords: number;
    totalStaff: number;
    totalWeeks: number;
    weeksWithData: number;
    avgRecordsPerWeek: number;
    dataQuality: string;
    recommendations: string[];
  } {
    const weeksWithData = Object.values(weekRecordsIndex).filter(records => records.length > 0).length;
    const avgRecordsPerWeek = weeksWithData > 0 ? Math.round(staffRecords.length / weeksWithData) : 0;
    
    let dataQuality = 'UNKNOWN';
    const recommendations: string[] = [];
    
    if (weeksWithData === 0) {
      dataQuality = 'CRITICAL - No data';
      recommendations.push('Check date ranges and filters');
    } else if (weeksWithData === 1) {
      dataQuality = 'POOR - Single week concentration';
      recommendations.push('Verify week calculation logic');
      recommendations.push('Check server-side date filtering');
    } else if (weeksWithData < weeks.length * 0.5) {
      dataQuality = 'FAIR - Sparse distribution';
      recommendations.push('Consider data completeness');
    } else {
      dataQuality = 'GOOD - Multi-week distribution';
    }
    
    return {
      totalRecords: staffRecords.length,
      totalStaff: staffMembers.length,
      totalWeeks: weeks.length,
      weeksWithData,
      avgRecordsPerWeek,
      dataQuality,
      recommendations
    };
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Анализирует недельные данные сотрудника ***
   */
  private static analyzeStaffWeekData(weeklyData: IWeeklyStaffData): {
    hasData: boolean;
    totalDaysWithData: number;
    totalShifts: number;
    leaveTypesCount: number;
    totalMinutes: number;
  } {
    const daysWithData = Object.values(weeklyData.days).filter(day => day.hasData);
    const totalDaysWithData = daysWithData.length;
    const totalShifts = daysWithData.reduce((sum, day) => sum + day.shifts.length, 0);
    
    // Подсчитываем уникальные типы отпусков (исправлено для совместимости с ES5)
    const allShifts: IShiftInfo[] = [];
    daysWithData.forEach(day => {
      day.shifts.forEach(shift => {
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
   * *** НОВЫЙ МЕТОД v3.0: Генерирует финальную статистику ***
   */
  private static generateFinalStatistics(
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
    const recordsWithLeave = Object.values(leaveTypesIndex).reduce((sum, lt) => sum + lt.count, 0);
    
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

  /**
   * Проверяет, есть ли у сотрудника данные Person (реальный vs шаблон)  
   */
  private static hasPersonInfo(staffMember: IStaffMember): boolean {
    const hasEmployeeId = !!(staffMember.employeeId && 
                         staffMember.employeeId !== '0' && 
                         staffMember.employeeId.trim() !== '');
    const isNotDeleted = (staffMember.deleted || 0) !== 1;
    const isNotTemplate = !(staffMember.isTemplate || false);
    
    return hasEmployeeId && isNotDeleted && isNotTemplate;
  }

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

  /**
   * Сортирует строки сотрудников в группе недели
   */
  private static sortStaffRowsInWeek(staffRows: ITimetableStaffRow[]): ITimetableStaffRow[] {
    return staffRows.sort((a, b) => {
      if (a.isDeleted !== b.isDeleted) {
        return a.isDeleted ? 1 : -1;
      }
      if (a.hasPersonInfo !== b.hasPersonInfo) {
        return a.hasPersonInfo ? -1 : 1;
      }
      return a.staffName.localeCompare(b.staffName);
    });
  }

  /**
   * Получает дату для конкретного дня недели в указанной неделе
   */
  private static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    const date = new Date(weekStart);
    const startDayNumber = TimetableWeekCalculator.getDayNumber(weekStart);
    
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7;
    }
    
    date.setDate(weekStart.getDate() + offset);
    return date;
  }

  // *** ДОПОЛНИТЕЛЬНЫЕ УТИЛИТЫ v3.0 ***

  /**
   * *** НОВЫЙ МЕТОД v3.0: Получает сводную статистику по данным (улучшенная версия) ***
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
        Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
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

  /**
   * *** НОВЫЙ МЕТОД v3.0: Анализирует использование цветов отпусков ***
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
        Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
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
    const leaveColorBreakdown = Array.from(colorCounts.entries()).map(([color, data]) => ({
      color,
      count: data.count,
      percentage: totalDaysWithLeave > 0 ? Math.round((data.count / totalDaysWithLeave) * 100) : 0,
      associatedTypes: Array.from(data.types)
    })).sort((a, b) => b.count - a.count);

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

  /**
   * *** НОВЫЙ МЕТОД v3.0: Фильтрует данные недель по критериям с поддержкой цветов отпусков ***
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
    }
  ): IWeekGroup[] {
    return weekGroups.map(weekGroup => {
      const filteredStaffRows = weekGroup.staffRows.filter(staffRow => {
        // Основные фильтры
        if (!filters.showDeleted && staffRow.isDeleted) return false;
        if (!filters.showTemplates && !staffRow.hasPersonInfo) return false;
        
        // Поиск по имени
        if (filters.searchText && 
            !staffRow.staffName.toLowerCase().includes(filters.searchText.toLowerCase())) {
          return false;
        }

        // Фильтр по часам
        if (filters.minHoursPerWeek && staffRow.weekData.totalWeekMinutes < filters.minHoursPerWeek * 60) {
          return false;
        }
        if (filters.maxHoursPerWeek && staffRow.weekData.totalWeekMinutes > filters.maxHoursPerWeek * 60) {
          return false;
        }

        // Фильтр по наличию отпусков
        if (filters.showOnlyWithLeave) {
          const hasAnyLeave = Object.values(staffRow.weekData.days).some((day: IDayInfo) => day.hasLeave);
          if (!hasAnyLeave) return false;
        }

        // Фильтр по конкретным типам отпусков
        if (filters.leaveTypeIds && filters.leaveTypeIds.length > 0) {
          const hasMatchingLeaveType = Object.values(staffRow.weekData.days).some((day: IDayInfo) => 
            day.shifts.some(shift => 
              shift.typeOfLeaveId && filters.leaveTypeIds!.includes(shift.typeOfLeaveId)
            )
          );
          if (!hasMatchingLeaveType) return false;
        }

        // Фильтр по цветам отпусков
        if (filters.leaveColors && filters.leaveColors.length > 0) {
          const hasMatchingLeaveColor = Object.values(staffRow.weekData.days).some((day: IDayInfo) => 
            day.leaveTypeColor && filters.leaveColors!.includes(day.leaveTypeColor)
          );
          if (!hasMatchingLeaveColor) return false;
        }
        
        return true;
      });

      return {
        ...weekGroup,
        staffRows: filteredStaffRows,
        hasData: filteredStaffRows.some(staffRow => 
          Object.values(staffRow.weekData.days).some((day: IDayInfo) => day.hasData)
        )
      };
    });
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Экспортирует данные с цветами отпусков ***
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
          days: Object.entries(staffRow.weekData.days).map(([dayNum, day]) => ({
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
          }))
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
   * *** НОВЫЙ МЕТОД v3.0: Валидация данных с проверкой цветов отпусков ***
   */
  public static validateDataIntegrityWithLeaveColors(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    leaveColorsValidation: {
      totalRecordsWithLeave: number;
      recordsWithValidColors: number;
      recordsWithInvalidColors: number;
      missingColorMappings: string[];
    };
    statistics: {
      recordsWithValidStaff: number;
      recordsWithInvalidStaff: number;
      staffWithRecords: number;
      staffWithoutRecords: number;
    };
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    // Создаем Set активных employeeId для быстрой проверки
    const activeEmployeeIds = new Set(
      staffMembers
        .filter(staff => staff.deleted !== 1 && staff.employeeId && staff.employeeId !== '0')
        .map(staff => staff.employeeId?.toString())
    );

    let recordsWithValidStaff = 0;
    let recordsWithInvalidStaff = 0;
    let totalRecordsWithLeave = 0;
    let recordsWithValidColors = 0;
    let recordsWithInvalidColors = 0;
    const missingColorMappings = new Set<string>();
    
    // Проверяем каждую запись
    staffRecords.forEach(record => {
      const recordStaffId = record.StaffMemberLookupId?.toString();
      
      // Проверка персонала
      if (!recordStaffId) {
        issues.push(`Record ${record.ID} has no StaffMemberLookupId`);
        recordsWithInvalidStaff++;
      } else if (activeEmployeeIds.has(recordStaffId)) {
        recordsWithValidStaff++;
      } else {
        recordsWithInvalidStaff++;
        warnings.push(`Record ${record.ID} references unknown/inactive staff: ${recordStaffId}`);
      }

      // Проверка дат
      if (!record.Date || isNaN(record.Date.getTime())) {
        issues.push(`Record ${record.ID} has invalid Date`);
      }
      if (!record.ShiftDate1 || isNaN(record.ShiftDate1.getTime())) {
        issues.push(`Record ${record.ID} has invalid ShiftDate1`);
      }
      if (!record.ShiftDate2 || isNaN(record.ShiftDate2.getTime())) {
        issues.push(`Record ${record.ID} has invalid ShiftDate2`);
      }

      // Проверка цветов отпусков
      if (record.TypeOfLeaveID) {
        totalRecordsWithLeave++;
        
        if (getLeaveTypeColor) {
          const color = getLeaveTypeColor(record.TypeOfLeaveID);
          if (color) {
            recordsWithValidColors++;
          } else {
            recordsWithInvalidColors++;
            missingColorMappings.add(record.TypeOfLeaveID);
          }
        } else {
          recordsWithInvalidColors++;
          warnings.push('Leave type color function not provided');
        }
      }
    });

    // Проверяем покрытие сотрудников
    const recordsIndex = this.createStaffRecordsIndex(staffRecords);
    const staffWithRecords = staffMembers.filter(staff => {
      const employeeId = staff.employeeId?.toString();
      return employeeId && recordsIndex[employeeId] && recordsIndex[employeeId].length > 0;
    }).length;
    
    const staffWithoutRecords = staffMembers.length - staffWithRecords;
    
    if (staffWithoutRecords > staffMembers.length * 0.3) {
      warnings.push(`${staffWithoutRecords} staff members have no schedule records (${Math.round(staffWithoutRecords / staffMembers.length * 100)}%)`);
    }

    // Предупреждения по цветам отпусков
    if (missingColorMappings.size > 0) {
      warnings.push(`${missingColorMappings.size} leave types have no color mapping: ${Array.from(missingColorMappings).join(', ')}`);
    }

    const statistics = {
      recordsWithValidStaff,
      recordsWithInvalidStaff,
      staffWithRecords,
      staffWithoutRecords
    };

    const leaveColorsValidation = {
      totalRecordsWithLeave,
      recordsWithValidColors,
      recordsWithInvalidColors,
      missingColorMappings: Array.from(missingColorMappings)
    };

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      warnings,
      leaveColorsValidation,
      statistics
    };
  }

  /**
   * *** НОВЫЙ МЕТОД v3.0: Оптимизирует производительность обработки ***
   */
  public static optimizeProcessingPerformance(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    weeks: IWeekInfo[]
  ): {
    shouldUseIndexing: boolean;
    shouldUseBatching: boolean;
    recommendedBatchSize: number;
    estimatedProcessingTime: number;
    optimizationRecommendations: string[];
  } {
    const recordsCount = staffRecords.length;
    const staffCount = staffMembers.length;
    const weeksCount = weeks.length;
    const totalOperations = recordsCount * weeksCount;

    const optimizationRecommendations: string[] = [];
    
    // Определяем нужно ли индексирование
    const shouldUseIndexing = recordsCount > 100 || staffCount > 20;
    if (shouldUseIndexing) {
      optimizationRecommendations.push('Use record indexing for fast lookups');
    }

    // Определяем нужно ли батчинг
    const shouldUseBatching = totalOperations > 10000;
    const recommendedBatchSize = shouldUseBatching ? Math.max(10, Math.min(100, Math.ceil(staffCount / 4))) : staffCount;
    if (shouldUseBatching) {
      optimizationRecommendations.push(`Process staff in batches of ${recommendedBatchSize}`);
    }

    // Оценка времени обработки (в миллисекундах)
    let estimatedProcessingTime = totalOperations * 0.01; // Базовая оценка
    if (shouldUseIndexing) estimatedProcessingTime *= 0.5; // Индексирование ускоряет в 2 раза
    if (shouldUseBatching) estimatedProcessingTime *= 0.8; // Батчинг дает 20% ускорение

    // Дополнительные рекомендации
    if (recordsCount > 5000) {
      optimizationRecommendations.push('Consider implementing data pagination');
    }
    if (weeksCount > 8) {
      optimizationRecommendations.push('Consider lazy loading for distant weeks');
    }
    if (staffCount > 50) {
      optimizationRecommendations.push('Consider virtualization for staff list');
    }

    return {
      shouldUseIndexing,
      shouldUseBatching,
      recommendedBatchSize,
      estimatedProcessingTime: Math.round(estimatedProcessingTime),
      optimizationRecommendations
    };
  }
}