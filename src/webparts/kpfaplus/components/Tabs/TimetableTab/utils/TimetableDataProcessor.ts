// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import { 
  ITimetableDataParams, 
  ITimetableRow, 
  IWeeklyStaffData, 
  IDayInfo, 
  IWeekInfo,
  IWeekGroup,
  ITimetableStaffRow,
  IStaffMember // FIXED: Added proper import
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Процессор данных для таблицы расписания
 * Преобразует данные StaffRecords в структуру для отображения по неделям и дням
 * УПРОЩЕННАЯ ВЕРСИЯ: Только поиск по StaffMemberLookupId
 */
export class TimetableDataProcessor {

  /**
   * Основной метод обработки данных (старый формат - для совместимости)
   * Преобразует входные данные в структуру ITimetableRow[]
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId } = params;

    console.log('[TimetableDataProcessor] Processing data (old format):', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId
    });

    const rows: ITimetableRow[] = [];

    // Обрабатываем каждого сотрудника
    staffMembers.forEach(staffMember => {
      console.log(`[TimetableDataProcessor] Processing staff: ${staffMember.name} (employeeId: ${staffMember.employeeId})`);

      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: this.hasPersonInfo(staffMember),
        weeks: {}
      };

      // Получаем записи для этого сотрудника (данные уже отфильтрованы на сервере!)
      const staffStaffRecords = this.getStaffRecords(staffRecords, staffMember);
      
      console.log(`[TimetableDataProcessor] Found ${staffStaffRecords.length} records for ${staffMember.name}`);

      // Обрабатываем каждую неделю
      weeks.forEach(week => {
        const weeklyData = this.processWeekData(staffStaffRecords, week);
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    // Сортируем строки
    const sortedRows = this.sortStaffRows(rows);

    console.log(`[TimetableDataProcessor] Processed ${sortedRows.length} staff rows (old format)`);
    return sortedRows;
  }

  /**
   * НОВЫЙ МЕТОД: Обработка данных с группировкой по неделям
   * Преобразует входные данные в структуру IWeekGroup[]
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId } = params;

    console.log('[TimetableDataProcessor] Processing data by weeks:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      note: 'Data already filtered on server'
    });

    const weekGroups: IWeekGroup[] = [];

    // Обрабатываем каждую неделю
    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum}: ${week.weekLabel}`);

      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;

      // Для каждой недели обрабатываем всех переданных сотрудников
      staffMembers.forEach(staffMember => {
        // Получаем записи для этого сотрудника (данные уже отфильтрованы на сервере!)
        const staffStaffRecords = this.getStaffRecords(staffRecords, staffMember);
        
        // Обрабатываем данные только для текущей недели
        const weeklyData = this.processWeekData(staffStaffRecords, week);
        
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
      console.log(`[TimetableDataProcessor] Week ${week.weekNum}: ${sortedStaffRows.length} staff, hasData: ${weekHasData}`);
    });

    console.log(`[TimetableDataProcessor] Processed ${weekGroups.length} week groups`);
    return weekGroups;
  }

  /**
   * УПРОЩЕННЫЙ метод получения записей для сотрудника
   * Только поиск по StaffMemberLookupId - больше никаких способов!
   */
  private static getStaffRecords(
    allRecords: IStaffRecord[], 
    staffMember: IStaffMember // FIXED: заменили 'any' на 'IStaffMember'
  ): IStaffRecord[] {
    const staffEmployeeId = staffMember.employeeId || '';
    
    console.log(`[TimetableDataProcessor] Getting records for: ${staffMember.name} (employeeId: ${staffEmployeeId})`);
    
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
    
    console.log(`[TimetableDataProcessor] Found ${matchingRecords.length} records for ${staffMember.name}`);
    
    return matchingRecords;
  }

  /**
   * Обрабатывает данные для одной недели одного сотрудника
   */
  private static processWeekData(
    staffRecords: IStaffRecord[], 
    week: IWeekInfo
  ): IWeeklyStaffData {
    console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} with ${staffRecords.length} records`);

    const weeklyData: IWeeklyStaffData = {
      weekNum: week.weekNum,
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      days: {},
      totalWeekMinutes: 0,
      formattedWeekTotal: "0h 00m"
    };

    // Получаем записи для этой недели
    const weekRecords = staffRecords.filter(record => {
      const recordDate = new Date(record.Date);
      return TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
    });

    console.log(`[TimetableDataProcessor] Found ${weekRecords.length} records for week ${week.weekNum}`);

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
   */
  private static processDayData(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IDayInfo {
    // Находим дату для этого дня недели
    const dayDate = this.getDateForDayInWeek(weekStart, dayNumber);
    
    // Получаем смены для этого дня
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
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
  private static hasPersonInfo(staffMember: IStaffMember): boolean { // FIXED: заменили 'any' на 'IStaffMember'
    // Проверяем наличие employeeId как признак реального сотрудника
    const hasEmployeeId = !!(staffMember.employeeId && 
                         staffMember.employeeId !== '0' && 
                         staffMember.employeeId.trim() !== ''); // FIXED: Convert to boolean
    
    // Проверяем, что сотрудник не помечен как удаленный
    const isNotDeleted = (staffMember.deleted || 0) !== 1; // FIXED: Handle undefined case
    
    // Проверяем, что это не явно указанный шаблон
    const isNotTemplate = !(staffMember.isTemplate || false); // FIXED: Handle undefined case
    
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
   */
  public static getDataSummary(rows: ITimetableRow[]): {
    totalStaff: number;
    activeStaff: number;
    deletedStaff: number;
    templatesStaff: number;
    totalRecords: number;
  } {
    const totalStaff = rows.length;
    const activeStaff = rows.filter(r => !r.isDeleted).length;
    const deletedStaff = rows.filter(r => r.isDeleted).length;
    const templatesStaff = rows.filter(r => !r.hasPersonInfo).length;
    
    let totalRecords = 0;
    rows.forEach(row => {
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
    const totalStaff = firstWeekStaff.length;
    const activeStaff = firstWeekStaff.filter(s => !s.isDeleted).length;
    const deletedStaff = firstWeekStaff.filter(s => s.isDeleted).length;
    const templatesStaff = firstWeekStaff.filter(s => !s.hasPersonInfo).length;
    
    let totalRecords = 0;
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
}