// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import { 
  ITimetableDataParams, 
  ITimetableRow, 
  IWeeklyStaffData, 
  IDayInfo, 
  IWeekInfo,
  IWeekGroup,
  ITimetableStaffRow,
  IStaffMember
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Оптимизированный процессор данных для таблицы расписания
 * Преобразует данные StaffRecords в структуру для отображения по неделям и дням
 * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: Работает с данными из одного батчевого запроса
 */
export class TimetableDataProcessor {

  /**
   * Основной метод обработки данных (старый формат - для совместимости)
   * Преобразует входные данные в структуру ITimetableRow[]
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId } = params;

    console.log('[TimetableDataProcessor] Processing data (old format - optimized for batch loading):', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      note: 'Data already filtered by batch request + client filtering'
    });

    const rows: ITimetableRow[] = [];

    // Создаем индекс записей для быстрого поиска
    const recordsIndex = this.createStaffRecordsIndex(staffRecords);
    console.log('[TimetableDataProcessor] Created records index with keys:', Object.keys(recordsIndex).length);

    // Обрабатываем каждого сотрудника
    staffMembers.forEach(staffMember => {
      const staffEmployeeId = staffMember.employeeId?.toString();
      console.log(`[TimetableDataProcessor] Processing staff: ${staffMember.name} (employeeId: ${staffEmployeeId})`);

      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: this.hasPersonInfo(staffMember),
        weeks: {}
      };

      // Получаем записи для этого сотрудника из индекса (данные уже отфильтрованы!)
      const staffStaffRecords = this.getStaffRecordsFromIndex(recordsIndex, staffMember);
      
      console.log(`[TimetableDataProcessor] Found ${staffStaffRecords.length} records for ${staffMember.name} from batch data`);

      // Обрабатываем каждую неделю
      weeks.forEach(week => {
        const weeklyData = this.processWeekData(staffStaffRecords, week);
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    // Сортируем строки
    const sortedRows = this.sortStaffRows(rows);

    console.log(`[TimetableDataProcessor] Processed ${sortedRows.length} staff rows (old format, optimized)`);
    return sortedRows;
  }

  /**
   * НОВЫЙ МЕТОД: Обработка данных с группировкой по неделям
   * Преобразует входные данные в структуру IWeekGroup[]
   * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ для работы с батчевыми данными
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId } = params;

    console.log('[TimetableDataProcessor] *** OPTIMIZED processDataByWeeks started ***');
    console.log('[TimetableDataProcessor] Processing data by weeks (optimized for batch loading):', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      optimizationNote: 'Working with pre-filtered batch data from single request'
    });

    // *** ОПТИМИЗАЦИЯ 1: Создаем индекс записей для быстрого поиска ***
    const startIndexTime = performance.now();
    const recordsIndex = this.createStaffRecordsIndex(staffRecords);
    const indexTime = performance.now() - startIndexTime;

    console.log('[TimetableDataProcessor] *** RECORDS INDEX CREATED ***', {
      indexCreationTime: Math.round(indexTime) + 'ms',
      uniqueStaffInRecords: Object.keys(recordsIndex).length,
      totalRecordsIndexed: staffRecords.length,
      avgRecordsPerStaff: Math.round(staffRecords.length / Object.keys(recordsIndex).length)
    });

    // *** ОПТИМИЗАЦИЯ 2: Предварительный анализ записей по неделям ***
    const weekRecordsIndex = this.createWeeksRecordsIndex(staffRecords, weeks);
    console.log('[TimetableDataProcessor] *** WEEKS INDEX CREATED ***', {
      weeksWithRecords: Object.keys(weekRecordsIndex).length,
      totalWeeks: weeks.length,
      recordsDistribution: Object.entries(weekRecordsIndex).map(([week, records]) => ({
        week: parseInt(week),
        recordsCount: records.length
      }))
    });

    const weekGroups: IWeekGroup[] = [];

    // Обрабатываем каждую неделю
    weeks.forEach((week, index) => {
     // const weekStartTime = performance.now();
      console.log(`[TimetableDataProcessor] *** Processing week ${week.weekNum}: ${week.weekLabel} ***`);

      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;

      // Получаем записи для текущей недели из индекса
      const weekRecords = weekRecordsIndex[week.weekNum] || [];
      console.log(`[TimetableDataProcessor] Week ${week.weekNum} has ${weekRecords.length} total records`);

      // Для каждой недели обрабатываем всех переданных сотрудников
      staffMembers.forEach(staffMember => {
        // *** ОПТИМИЗАЦИЯ 3: Получаем записи сотрудника из индекса, затем фильтруем по неделе ***
        const staffAllRecords = this.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = staffAllRecords.filter(record => {
          const recordDate = new Date(record.Date);
          return TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
        });
        
        // Обрабатываем данные только для текущей недели
        const weeklyData = this.processWeekData(staffWeekRecords, week);
        
        // Проверяем, есть ли данные у этого сотрудника на этой неделе
        const hasStaffData = Object.values(weeklyData.days).some(day => day.hasData);
        if (hasStaffData) {
          weekHasData = true;
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
      
      // const weekProcessTime = performance.now() - weekStartTime;
      // console.log(`[TimetableDataProcessor] Week ${week.weekNum} processed: ${sortedStaffRows.length} staff, hasData: ${weekHasData}, time: ${Math.round(weekProcessTime)}ms`);
    });

    // *** ФИНАЛЬНАЯ СТАТИСТИКА ОПТИМИЗАЦИИ ***
    console.log('[TimetableDataProcessor] *** OPTIMIZATION PERFORMANCE ANALYSIS ***');
    
    const totalRecordsByStaff = Object.entries(recordsIndex).map(([staffId, records]) => ({
      staffId,
      recordsCount: records.length
    }));

    const staffCoverage = {
      totalStaff: staffMembers.length,
      staffWithRecords: totalRecordsByStaff.filter(s => s.recordsCount > 0).length,
      staffWithoutRecords: totalRecordsByStaff.filter(s => s.recordsCount === 0).length,
      maxRecordsPerStaff: Math.max(...totalRecordsByStaff.map(s => s.recordsCount), 0),
      minRecordsPerStaff: Math.min(...totalRecordsByStaff.map(s => s.recordsCount), 0),
      avgRecordsPerStaff: Math.round(staffRecords.length / staffMembers.length)
    };

    console.log(`[TimetableDataProcessor] Staff coverage analysis:`, staffCoverage);

    // Анализируем эффективность индексирования
    const indexEfficiency = {
      totalRecordsProcessed: staffRecords.length,
      uniqueStaffInData: Object.keys(recordsIndex).length,
      weeksWithData: Object.keys(weekRecordsIndex).length,
      dataSpread: `Records spread across ${Object.keys(weekRecordsIndex).length}/${weeks.length} weeks`,
      indexingOverhead: Math.round(indexTime) + 'ms',
      estimatedTimeWithoutIndex: 'Would be much slower with individual filtering'
    };

    console.log(`[TimetableDataProcessor] Indexing efficiency:`, indexEfficiency);

    console.log(`[TimetableDataProcessor] *** OPTIMIZED PROCESSING COMPLETED ***`);
    console.log(`[TimetableDataProcessor] Final results: ${weekGroups.length} week groups processed with optimized batch data`);
    
    return weekGroups;
  }

  /**
   * *** НОВЫЙ МЕТОД: Создает индекс записей по сотрудникам для быстрого поиска ***
   */
  private static createStaffRecordsIndex(
    allRecords: IStaffRecord[]
  ): Record<string, IStaffRecord[]> {
    console.log('[TimetableDataProcessor] Creating staff records index for fast lookups...');
    
    const index: Record<string, IStaffRecord[]> = {};
    
    allRecords.forEach(record => {
      const staffMemberId = record.StaffMemberLookupId?.toString();
      if (staffMemberId) {
        if (!index[staffMemberId]) {
          index[staffMemberId] = [];
        }
        index[staffMemberId].push(record);
      }
    });

    // Сортируем записи в каждой группе по дате для оптимизации
    Object.keys(index).forEach(staffId => {
      index[staffId].sort((a, b) => a.Date.getTime() - b.Date.getTime());
    });

    console.log('[TimetableDataProcessor] Staff records index created:', {
      uniqueStaff: Object.keys(index).length,
      recordsIndexed: allRecords.length,
      sampleStaffRecordCounts: Object.entries(index).slice(0, 3).map(([staffId, records]) => ({
        staffId,
        recordsCount: records.length
      }))
    });

    return index;
  }

  /**
   * *** НОВЫЙ МЕТОД: Создает индекс записей по неделям для оптимизации ***
   */
  private static createWeeksRecordsIndex(
    allRecords: IStaffRecord[],
    weeks: IWeekInfo[]
  ): Record<number, IStaffRecord[]> {
    console.log('[TimetableDataProcessor] Creating weeks records index...');
    
    const index: Record<number, IStaffRecord[]> = {};
    
    // Инициализируем индекс для всех недель
    weeks.forEach(week => {
      index[week.weekNum] = [];
    });

    // *** ДЕТАЛЬНАЯ ДИАГНОСТИКА РАСПРЕДЕЛЕНИЯ ПО НЕДЕЛЯМ ***
    let recordsOutsideWeeks = 0;
    const matchingDetails: Array<{recordId: string, date: string, weekNum: number}> = [];

    // Распределяем записи по неделям
    allRecords.forEach(record => {
      const recordDate = new Date(record.Date);
      
      // Находим неделю для этой записи
      const matchingWeek = weeks.find(week => 
        TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
      );
      
      if (matchingWeek) {
        index[matchingWeek.weekNum].push(record);
        
        // Записываем детали для диагностики (только первые 20 записей)
        if (matchingDetails.length < 20) {
          matchingDetails.push({
            recordId: record.ID,
            date: recordDate.toLocaleDateString(),
            weekNum: matchingWeek.weekNum
          });
        }
      } else {
        recordsOutsideWeeks++;
        console.warn(`[TimetableDataProcessor] ⚠️ Record ${record.ID} (${recordDate.toLocaleDateString()}) does not match any week!`);
        
        // *** ДЕТАЛЬНАЯ ДИАГНОСТИКА ПРОБЛЕМЫ ***
        if (recordsOutsideWeeks <= 5) {
          console.error(`[TimetableDataProcessor] 🔍 DEBUGGING Record ${record.ID}:`);
          console.error(`[TimetableDataProcessor] Record date: ${recordDate.toLocaleDateString()} (${recordDate.toISOString()})`);
          console.error(`[TimetableDataProcessor] Record day of week: ${recordDate.getDay()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][recordDate.getDay()]})`);
          
          // Показываем все рассчитанные недели
          console.error(`[TimetableDataProcessor] Calculated weeks:`);
          weeks.forEach((week, index) => {
            const startDay = week.weekStart.getDay();
            const endDay = week.weekEnd.getDay();
            console.error(`[TimetableDataProcessor] Week ${week.weekNum}: ${week.weekStart.toLocaleDateString()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][startDay]}) - ${week.weekEnd.toLocaleDateString()} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][endDay]})`);
            
            // Проверяем попадает ли запись в эту неделю
            const isInWeek = TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
            console.error(`[TimetableDataProcessor] Does record fit in week ${week.weekNum}? ${isInWeek}`);
          });
        }
      }
    });

    console.log('[TimetableDataProcessor] *** WEEKS INDEX DIAGNOSTIC RESULTS ***');
    console.log('[TimetableDataProcessor] Weeks records index created:', {
      totalWeeks: weeks.length,
      weeksWithRecords: Object.values(index).filter(records => records.length > 0).length,
      recordsOutsideWeeks: recordsOutsideWeeks,
      recordsDistribution: Object.entries(index)
        .filter(([_, records]) => records.length > 0)
        .map(([weekNum, records]) => ({
          week: parseInt(weekNum),
          recordsCount: records.length
        })),
      sampleMatching: matchingDetails.slice(0, 10)
    });
    
    // *** КРИТИЧНО: Проверяем есть ли проблема с концентрацией данных в одной неделе ***
    const nonEmptyWeeks = Object.values(index).filter(records => records.length > 0);
    if (nonEmptyWeeks.length === 1 && allRecords.length > 10) {
      console.error('[TimetableDataProcessor] 🚨 POTENTIAL ISSUE: All records concentrated in single week!');
      console.error('[TimetableDataProcessor] This suggests a problem with date filtering or week calculation');
      
      // Показываем примеры дат записей
      const sampleDates = allRecords.slice(0, 10).map(r => ({
        id: r.ID,
        date: r.Date.toLocaleDateString(),
        dateObj: r.Date
      }));
      console.error('[TimetableDataProcessor] Sample record dates:', sampleDates);
      
      // Показываем рассчитанные недели
      console.error('[TimetableDataProcessor] Calculated weeks:', weeks.map(w => ({
        weekNum: w.weekNum,
        start: w.weekStart.toLocaleDateString(),
        end: w.weekEnd.toLocaleDateString()
      })));
    }

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
      console.log(`[TimetableDataProcessor] No employeeId for staff: ${staffMember.name} - returning empty array`);
      return [];
    }
    
    // Быстрый поиск в индексе вместо фильтрации всего массива
    const matchingRecords = recordsIndex[staffEmployeeId] || [];
    
    if (matchingRecords.length > 0) {
      // console.log(`[TimetableDataProcessor] ✅ FAST INDEX LOOKUP: Found ${matchingRecords.length} records for ${staffMember.name} (employeeId: ${staffEmployeeId})`);
    }
    
    return matchingRecords;
  }

  /**
   * УПРОЩЕННЫЙ метод получения записей для сотрудника (старая версия для совместимости)
   * Только поиск по StaffMemberLookupId - больше никаких способов!
   * ПРИМЕЧАНИЕ: Этот метод оставлен для совместимости, но не используется в оптимизированной версии
   */
  public static getStaffRecordsLegacy(
    allRecords: IStaffRecord[], 
    staffMember: IStaffMember
  ): IStaffRecord[] {
    const staffEmployeeId = staffMember.employeeId || '';
    
    console.log(`[TimetableDataProcessor] Getting records for: ${staffMember.name} (employeeId: ${staffEmployeeId}) - LEGACY SLOW METHOD`);
    console.warn(`[TimetableDataProcessor] WARNING: Using slow legacy method instead of optimized index lookup`);
    
    if (!staffEmployeeId) {
      console.log(`[TimetableDataProcessor] No employeeId for staff: ${staffMember.name} - SKIPPING`);
      return [];
    }
    
    // ЕДИНСТВЕННЫЙ СПОСОБ: Поиск по StaffMemberLookupId
    const matchingRecords = allRecords.filter(record => {
      const recordStaffMemberId = record.StaffMemberLookupId?.toString() || '';
      const staffEmployeeIdStr = staffEmployeeId.toString();
      const isMatch = recordStaffMemberId === staffEmployeeIdStr;
      
      if (isMatch) {
        console.log(`[TimetableDataProcessor] ✅ MATCH: StaffMemberLookupId ${recordStaffMemberId} === employeeId ${staffEmployeeIdStr}`);
      }
      
      return isMatch;
    });
    
    console.log(`[TimetableDataProcessor] Found ${matchingRecords.length} records for ${staffMember.name} using legacy method`);
    
    return matchingRecords;
  }

  /**
   * Обрабатывает данные для одной недели одного сотрудника
   * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: работает с предварительно отфильтрованными данными
   */
  private static processWeekData(
    staffRecords: IStaffRecord[], 
    week: IWeekInfo
  ): IWeeklyStaffData {
    //console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} with ${staffRecords.length} pre-filtered records`);

    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    // *** ОПТИМИЗАЦИЯ: Записи уже могут быть отфильтрованы по неделе, но проверяем для надежности ***
    const weekRecords = staffRecords.filter(record => {
      const recordDate = new Date(record.Date);
      return TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
    });

    //console.log(`[TimetableDataProcessor] After week date filtering: ${weekRecords.length} records for week ${week.weekNum}`);

    // Обрабатываем каждый день недели (1-7)
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayData(
        weekRecords, 
        dayNum, 
        week.weekStart, 
        week.weekEnd
      );
      
      weeklyData.days[dayNum] = dayInfo;
      weeklyData.totalWeekMinutes += dayInfo.totalMinutes;
    }

    // Форматируем недельный итог
    weeklyData.formattedWeekTotal = TimetableShiftCalculator.formatMinutesToHours(weeklyData.totalWeekMinutes);

    return weeklyData;
  }

  /**
   * Обрабатывает данные для одного дня
   * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: работает с предварительно отфильтрованными данными недели
   */
  private static processDayData(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IDayInfo {
    // Находим дату для этого дня недели
    const dayDate = this.getDateForDayInWeek(weekStart, dayNumber);
    
    // *** ОПТИМИЗАЦИЯ: Получаем смены для дня из уже отфильтрованных записей недели ***
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords, // Используем предварительно отфильтрованные записи недели
      dayNumber,
      weekStart,
      weekEnd
    );

    // Рассчитываем общие минуты
    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    
    // Форматируем содержимое
    const formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0
    };
  }

  /**
   * Проверяет, есть ли у сотрудника данные Person (реальный vs шаблон)  
   */
  private static hasPersonInfo(staffMember: IStaffMember): boolean {
    // Проверяем наличие employeeId как признак реального сотрудника
    const hasEmployeeId = !!(staffMember.employeeId && 
                         staffMember.employeeId !== '0' && 
                         staffMember.employeeId.trim() !== '');
    
    // Проверяем, что сотрудник не помечен как удаленный
    const isNotDeleted = (staffMember.deleted || 0) !== 1;
    
    // Проверяем, что это не явно указанный шаблон
    const isNotTemplate = !(staffMember.isTemplate || false);
    
    const result = hasEmployeeId && isNotDeleted && isNotTemplate;
    
    return result;
  }

  /**
   * Сортирует строки сотрудников (для старого формата)
   */
  private static sortStaffRows(rows: ITimetableRow[]): ITimetableRow[] {
    return rows.sort((a, b) => {
      // Сначала по статусу удаления (активные первыми)
      if (a.isDeleted !== b.isDeleted) {
        return a.isDeleted ? 1 : -1;
      }
      
      // Затем по наличию данных Person (реальные сотрудники vs шаблоны)
      if (a.hasPersonInfo !== b.hasPersonInfo) {
        return a.hasPersonInfo ? -1 : 1;
      }
      
      // Затем по имени
      return a.staffName.localeCompare(b.staffName);
    });
  }

  /**
   * Сортирует строки сотрудников в группе недели
   */
  private static sortStaffRowsInWeek(staffRows: ITimetableStaffRow[]): ITimetableStaffRow[] {
    return staffRows.sort((a, b) => {
      // Сначала по статусу удаления (активные первыми)
      if (a.isDeleted !== b.isDeleted) {
        return a.isDeleted ? 1 : -1;
      }
      
      // Затем по наличию данных Person (реальные сотрудники vs шаблоны)
      if (a.hasPersonInfo !== b.hasPersonInfo) {
        return a.hasPersonInfo ? -1 : 1;
      }
      
      // Затем по имени
      return a.staffName.localeCompare(b.staffName);
    });
  }

  /**
   * Получает дату для конкретного дня недели в указанной неделе
   */
  private static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    const date = new Date(weekStart);
    
    // Находим, какой день недели у weekStart
    const startDayNumber = TimetableWeekCalculator.getDayNumber(weekStart);
    
    // Рассчитываем смещение до нужного дня
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7; // Если день на следующей неделе
    }
    
    date.setDate(weekStart.getDate() + offset);
    return date;
  }

  /**
   * Получает сводную статистику по данным (старый формат)
   * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: быстрые вычисления
   */
  public static getDataSummary(rows: ITimetableRow[]): {
    totalStaff: number;
    activeStaff: number;
    deletedStaff: number;
    templatesStaff: number;
    totalRecords: number;
  } {
    const totalStaff = rows.length;
    
    let activeStaff = 0;
    let deletedStaff = 0;
    let templatesStaff = 0;
    let totalRecords = 0;
    
    // Одним проходом считаем все статистики
    rows.forEach(row => {
      if (row.isDeleted) {
        deletedStaff++;
      } else {
        activeStaff++;
      }
      
      if (!row.hasPersonInfo) {
        templatesStaff++;
      }
      
      // Считаем записи
      Object.values(row.weeks).forEach((week: IWeeklyStaffData) => {
        Object.values(week.days).forEach((day: IDayInfo) => {
          totalRecords += day.shifts.length;
        });
      });
    });

    return {
      totalStaff,
      activeStaff,
      deletedStaff,
      templatesStaff,
      totalRecords
    };
  }

  /**
   * Получает сводную статистику по данным недель
   * ОПТИМИЗИРОВАННАЯ ВЕРСИЯ: быстрые вычисления
   */
  public static getWeeksDataSummary(weekGroups: IWeekGroup[]): {
    totalWeeks: number;
    weeksWithData: number;
    totalStaff: number;
    activeStaff: number;
    deletedStaff: number;
    templatesStaff: number;
    totalRecords: number;
  } {
    const totalWeeks = weekGroups.length;
    const weeksWithData = weekGroups.filter(w => w.hasData).length;
    
    // Берем данные из первой недели (состав сотрудников одинаков для всех недель)
    const firstWeekStaff = weekGroups.length > 0 ? weekGroups[0].staffRows : [];
    
    let totalStaff = 0;
    let activeStaff = 0;
    let deletedStaff = 0;
    let templatesStaff = 0;
    let totalRecords = 0;
    
    if (firstWeekStaff.length > 0) {
      totalStaff = firstWeekStaff.length;
      
      // Анализируем состав сотрудников
      firstWeekStaff.forEach(staff => {
        if (staff.isDeleted) {
          deletedStaff++;
        } else {
          activeStaff++;
        }
        
        if (!staff.hasPersonInfo) {
          templatesStaff++;
        }
      });
    }
    
    // Считаем общее количество записей по всем неделям
    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
          totalRecords += day.shifts.length;
        });
      });
    });

    return {
      totalWeeks,
      weeksWithData,
      totalStaff,
      activeStaff,
      deletedStaff,
      templatesStaff,
      totalRecords
    };
  }

  /**
   * Фильтрует данные по критериям (старый формат - для совместимости)
   */
  public static filterData(
    rows: ITimetableRow[], 
    filters: {
      showDeleted?: boolean;
      showTemplates?: boolean;
      searchText?: string;
    }
  ): ITimetableRow[] {
    return rows.filter(row => {
      // Фильтр по удаленным
      if (!filters.showDeleted && row.isDeleted) {
        return false;
      }
      
      // Фильтр по шаблонам
      if (!filters.showTemplates && !row.hasPersonInfo) {
        return false;
      }
      
      // Поиск по имени
      if (filters.searchText && 
          !row.staffName.toLowerCase().includes(filters.searchText.toLowerCase())) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Фильтрует данные недель по критериям
   */
  public static filterWeeksData(
    weekGroups: IWeekGroup[], 
    filters: {
      showDeleted?: boolean;
      showTemplates?: boolean;
      searchText?: string;
    }
  ): IWeekGroup[] {
    return weekGroups.map(weekGroup => {
      const filteredStaffRows = weekGroup.staffRows.filter(staffRow => {
        // Фильтр по удаленным
        if (!filters.showDeleted && staffRow.isDeleted) {
          return false;
        }
        
        // Фильтр по шаблонам
        if (!filters.showTemplates && !staffRow.hasPersonInfo) {
          return false;
        }
        
        // Поиск по имени
        if (filters.searchText && 
            !staffRow.staffName.toLowerCase().includes(filters.searchText.toLowerCase())) {
          return false;
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
   * *** НОВЫЙ МЕТОД: Анализирует эффективность обработки данных ***
   */
  public static analyzeProcessingEfficiency(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[],
    weeks: IWeekInfo[]
  ): {
    dataDistribution: {
      totalRecords: number;
      uniqueStaff: number;
      avgRecordsPerStaff: number;
      weeksSpan: number;
    };
    optimizationPotential: {
      indexingBenefit: string;
      batchLoadingBenefit: string;
      memoryUsage: string;
    };
    recommendations: string[];
  } {
    const recordsIndex = this.createStaffRecordsIndex(staffRecords);
    const uniqueStaff = Object.keys(recordsIndex).length;
    const avgRecordsPerStaff = Math.round(staffRecords.length / (uniqueStaff || 1));
    
    const weeksWithData = weeks.filter(week => {
      return staffRecords.some(record => {
        const recordDate = new Date(record.Date);
        return TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
      });
    }).length;

    const dataDistribution = {
      totalRecords: staffRecords.length,
      uniqueStaff: uniqueStaff,
      avgRecordsPerStaff: avgRecordsPerStaff,
      weeksSpan: weeksWithData
    };

    const optimizationPotential = {
      indexingBenefit: `${uniqueStaff}x faster lookups with index vs linear search`,
      batchLoadingBenefit: `${staffMembers.length} HTTP requests reduced to 1 batch request`,
      memoryUsage: `~${Math.round(staffRecords.length * 0.5)}KB estimated for ${staffRecords.length} records`
    };

    const recommendations: string[] = [];
    
    if (staffMembers.length > 20) {
      recommendations.push("High staff count - batch loading provides significant performance benefit");
    }
    
    if (avgRecordsPerStaff > 50) {
      recommendations.push("High records per staff - indexing provides major lookup optimization");
    }
    
    if (weeksWithData < weeks.length * 0.5) {
      recommendations.push("Sparse data across weeks - consider lazy loading for better UX");
    }
    
    if (staffRecords.length > 1000) {
      recommendations.push("Large dataset - consider implementing pagination and virtualization");
    }

    return {
      dataDistribution,
      optimizationPotential,
      recommendations
    };
  }

  /**
   * *** НОВЫЙ МЕТОД: Валидация целостности данных ***
   */
  public static validateDataIntegrity(
    staffRecords: IStaffRecord[],
    staffMembers: IStaffMember[]
  ): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
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
    
    // Проверяем каждую запись
    staffRecords.forEach(record => {
      const recordStaffId = record.StaffMemberLookupId?.toString();
      
      if (!recordStaffId) {
        issues.push(`Record ${record.ID} has no StaffMemberLookupId`);
        recordsWithInvalidStaff++;
        return;
      }
      
      if (activeEmployeeIds.has(recordStaffId)) {
        recordsWithValidStaff++;
      } else {
        recordsWithInvalidStaff++;
        warnings.push(`Record ${record.ID} references unknown/inactive staff: ${recordStaffId}`);
      }

      // Проверяем валидность дат
      if (!record.Date || isNaN(record.Date.getTime())) {
        issues.push(`Record ${record.ID} has invalid Date`);
      }
      
      if (!record.ShiftDate1 || isNaN(record.ShiftDate1.getTime())) {
        issues.push(`Record ${record.ID} has invalid ShiftDate1`);
      }
      
      if (!record.ShiftDate2 || isNaN(record.ShiftDate2.getTime())) {
        issues.push(`Record ${record.ID} has invalid ShiftDate2`);
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

    const statistics = {
      recordsWithValidStaff,
      recordsWithInvalidStaff,
      staffWithRecords,
      staffWithoutRecords
    };

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      warnings,
      statistics
    };
  }
}