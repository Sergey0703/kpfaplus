// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import { 
  ITimetableDataParams, 
  ITimetableRow, 
  IWeeklyStaffData, 
  IDayInfo, 
  IWeekInfo 
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Процессор данных для таблицы расписания
 * Преобразует данные StaffRecords в структуру для отображения по неделям и дням
 */
export class TimetableDataProcessor {

  /**
   * Основной метод обработки данных
   * Преобразует входные данные в структуру ITimetableRow[]
   */
  public static processData(params: ITimetableDataParams): ITimetableRow[] {
    const { staffRecords, staffMembers, weeks, enterLunchTime } = params;

    console.log('[TimetableDataProcessor] Processing data:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      enterLunchTime
    });

    const rows: ITimetableRow[] = [];

    // Обрабатываем каждого сотрудника
    staffMembers.forEach(staffMember => {
      console.log(`[TimetableDataProcessor] Processing staff: ${staffMember.name} (ID: ${staffMember.id})`);

      const row: ITimetableRow = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isDeleted: staffMember.deleted === 1,
        hasPersonInfo: this.hasPersonInfo(staffMember),
        weeks: {}
      };

      // Получаем записи для этого сотрудника
      const staffStaffRecords = this.getStaffRecords(staffRecords, staffMember);
      
      console.log(`[TimetableDataProcessor] Found ${staffStaffRecords.length} records for ${staffMember.name}`);

      // Обрабатываем каждую неделю
      weeks.forEach(week => {
        const weeklyData = this.processWeekData(
          staffStaffRecords, 
          week, 
          enterLunchTime
        );
        
        row.weeks[week.weekNum] = weeklyData;
      });

      rows.push(row);
    });

    // Сортируем строки: реальные сотрудники сначала, потом по имени
    const sortedRows = this.sortStaffRows(rows);

    console.log(`[TimetableDataProcessor] Processed ${sortedRows.length} staff rows`);
    return sortedRows;
  }

  /**
   * Обрабатывает данные для одной недели одного сотрудника
   */
  private static processWeekData(
    staffRecords: IStaffRecord[], 
    week: IWeekInfo, 
    enterLunchTime: boolean
  ): IWeeklyStaffData {
    console.log(`[TimetableDataProcessor] Processing week ${week.weekNum}:`, {
      weekStart: week.weekStart.toISOString(),
      weekEnd: week.weekEnd.toISOString()
    });

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
        week.weekEnd, 
        enterLunchTime
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
    weekEnd: Date,
    enterLunchTime: boolean
  ): IDayInfo {
    // Находим дату для этого дня недели
    const dayDate = this.getDateForDayInWeek(weekStart, dayNumber);
    
    // Получаем смены для этого дня
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      enterLunchTime
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
   * Получает записи конкретного сотрудника
   */
  private static getStaffRecords(allRecords: IStaffRecord[], staffMember: any): IStaffRecord[] {
    const staffEmployeeId = parseInt(staffMember.employeeId || '0', 10);
    
    // Пытаемся найти записи по разным критериям
    return allRecords.filter(record => {
      // Способ 1: По ID записи (если содержит ID сотрудника)
      if (record.ID.includes(staffMember.id)) {
        return true;
      }
      
      // Способ 2: По employeeId (если есть связь в StaffRecord)
      if (staffEmployeeId > 0) {
        // Проверяем по Title (имени) - временное решение
        if (record.Title && record.Title.includes(staffMember.name)) {
          return true;
        }
      }
      
      return false;
    });
  }

  /**
   * Проверяет, есть ли у сотрудника данные Person (реальный vs шаблон)  
   */
  private static hasPersonInfo(staffMember: any): boolean {
    // В реальной реализации нужно проверить наличие поля Person.Email
    // Пока возвращаем true для всех, кроме явных шаблонов
    return !staffMember.isTemplate && staffMember.deleted !== 1;
  }

  /**
   * Сортирует строки сотрудников
   */
  private static sortStaffRows(rows: ITimetableRow[]): ITimetableRow[] {
    return rows.sort((a, b) => {
      // Сначала по наличию данных Person (реальные сотрудники vs шаблоны)
      if (a.hasPersonInfo !== b.hasPersonInfo) {
        return a.hasPersonInfo ? -1 : 1; // Реальные сначала
      }
      
      // Затем активные перед удаленными
      if (a.isDeleted !== b.isDeleted) {
        return a.isDeleted ? 1 : -1; // Активные сначала
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
   * Получает сводную статистику по данным
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
      Object.values(row.weeks).forEach(week => {
        Object.values(week.days).forEach(day => {
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
   * Фильтрует данные по критериям
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
}