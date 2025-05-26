// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessor.ts
import { 
  ITimetableDataParams, 
  ITimetableRow, 
  IWeeklyStaffData, 
  IDayInfo, 
  IWeekInfo,
  IWeekGroup,
  ITimetableStaffRow
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculator } from './TimetableShiftCalculator';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Процессор данных для таблицы расписания
 * Преобразует данные StaffRecords в структуру для отображения по неделям и дням
 * ИСПРАВЛЕННАЯ ВЕРСИЯ: Улучшенное сопоставление записей с сотрудниками
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

      // Получаем записи для этого сотрудника (данные уже отфильтрованы!)
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
   * ИСПРАВЛЕННЫЙ метод получения записей для сотрудника
   * Теперь поддерживает множественные способы сопоставления
   */
  private static getStaffRecords(
    allRecords: IStaffRecord[], 
    staffMember: any
  ): IStaffRecord[] {
    const staffEmployeeId = staffMember.employeeId || '';
    
    console.log(`[TimetableDataProcessor] *** DEBUG getStaffRecords START ***`);
    console.log(`[TimetableDataProcessor] Staff: ${staffMember.name} (employeeId: ${staffEmployeeId})`);
    console.log(`[TimetableDataProcessor] Total records received: ${allRecords.length}`);
    
    if (allRecords.length > 0) {
      console.log(`[TimetableDataProcessor] Sample records structure:`, allRecords.slice(0, 2).map(r => ({
        ID: r.ID,
        Date: r.Date?.toLocaleDateString(),
        StaffMemberLookupId: r.StaffMemberLookupId,
        WeeklyTimeTableID: r.WeeklyTimeTableID,
        Title: r.Title?.substring(0, 30),
        allKeys: Object.keys(r)
      })));
    }
    
    if (!staffEmployeeId) {
      console.log(`[TimetableDataProcessor] No employeeId for staff: ${staffMember.name} - SKIPPING`);
      return [];
    }
    
    console.log(`[TimetableDataProcessor] Looking for matches with employeeId: "${staffEmployeeId}" (type: ${typeof staffEmployeeId})`);
    
    let matchingRecords: IStaffRecord[] = [];
    
    // СПОСОБ 1: Поиск по StaffMemberLookupId
    const hasStaffMemberLookupId = allRecords.some(r => 
      r.StaffMemberLookupId !== undefined && 
      r.StaffMemberLookupId !== null &&
      r.StaffMemberLookupId.toString().trim() !== ''
    );
    
    console.log(`[TimetableDataProcessor] Records have StaffMemberLookupId field: ${hasStaffMemberLookupId}`);
    
    if (hasStaffMemberLookupId) {
      const uniqueStaffMemberIds = Array.from(new Set(
        allRecords
          .map(r => r.StaffMemberLookupId?.toString())
          .filter(Boolean)
      ));
      console.log(`[TimetableDataProcessor] Available StaffMemberLookupId values:`, uniqueStaffMemberIds);
      
      matchingRecords = allRecords.filter(record => {
        const recordStaffMemberId = record.StaffMemberLookupId?.toString() || '';
        const staffEmployeeIdStr = staffEmployeeId.toString();
        const isMatch = recordStaffMemberId === staffEmployeeIdStr;
        
        if (isMatch) {
          console.log(`[TimetableDataProcessor] ✅ MATCH by StaffMemberLookupId: ${recordStaffMemberId} === ${staffEmployeeIdStr}`);
        }
        
        return isMatch;
      });
      
      console.log(`[TimetableDataProcessor] Matches by StaffMemberLookupId: ${matchingRecords.length}`);
    }
    
    // СПОСОБ 2: Если не нашли по StaffMemberLookupId, попробуем по WeeklyTimeTableID
    if (matchingRecords.length === 0) {
      console.log(`[TimetableDataProcessor] No matches by StaffMemberLookupId, trying WeeklyTimeTableID...`);
      
      const hasWeeklyTimeTableID = allRecords.some(r => 
        r.WeeklyTimeTableID !== undefined && 
        r.WeeklyTimeTableID !== null &&
        r.WeeklyTimeTableID.toString().trim() !== ''
      );
      
      console.log(`[TimetableDataProcessor] Records have WeeklyTimeTableID field: ${hasWeeklyTimeTableID}`);
      
      if (hasWeeklyTimeTableID) {
        const uniqueWeeklyTimeTableIds = Array.from(new Set(
          allRecords
            .map(r => r.WeeklyTimeTableID?.toString())
            .filter(Boolean)
        ));
        console.log(`[TimetableDataProcessor] Available WeeklyTimeTableID values:`, uniqueWeeklyTimeTableIds);
        
        matchingRecords = allRecords.filter(record => {
          const recordWeeklyTimeTableID = record.WeeklyTimeTableID?.toString() || '';
          const staffEmployeeIdStr = staffEmployeeId.toString();
          const isMatch = recordWeeklyTimeTableID === staffEmployeeIdStr;
          
          if (isMatch) {
            console.log(`[TimetableDataProcessor] ✅ MATCH by WeeklyTimeTableID: ${recordWeeklyTimeTableID} === ${staffEmployeeIdStr}`);
          }
          
          return isMatch;
        });
        
        console.log(`[TimetableDataProcessor] Matches by WeeklyTimeTableID: ${matchingRecords.length}`);
      }
    }
    
    // СПОСОБ 3: Поиск по Title (содержит паттерн T=employeeId)
    if (matchingRecords.length === 0) {
      console.log(`[TimetableDataProcessor] No matches by ID fields. Trying Title pattern matching...`);
      
      matchingRecords = allRecords.filter(record => {
        if (!record.Title) return false;
        
        // Ищем паттерн T=X где X это employeeId
        const titleMatch = record.Title.match(/T=(\d+)/);
        if (titleMatch) {
          const titleEmployeeId = titleMatch[1];
          const isMatch = titleEmployeeId === staffEmployeeId.toString();
          
          if (isMatch) {
            console.log(`[TimetableDataProcessor] ✅ MATCH by Title pattern T=${titleEmployeeId}: "${record.Title}"`);
          }
          
          return isMatch;
        }
        
        return false;
      });
      
      console.log(`[TimetableDataProcessor] Matches by Title pattern: ${matchingRecords.length}`);
    }
    
    // СПОСОБ 4: Поиск в сырых данных (если это SharePoint структура)
    if (matchingRecords.length === 0 && allRecords.length > 0) {
      console.log(`[TimetableDataProcessor] No matches found. Checking raw data structure...`);
      
      const firstRecord = allRecords[0] as any;
      console.log(`[TimetableDataProcessor] Raw record keys:`, Object.keys(firstRecord));
      
      // Проверяем fields (SharePoint structure)
      if (firstRecord.fields) {
        console.log(`[TimetableDataProcessor] Fields in raw data:`, Object.keys(firstRecord.fields));
        
        // Ищем в fields.StaffMemberLookupId
        const fieldsStaffMatches = allRecords.filter(record => {
          const rawRecord = record as any;
          if (rawRecord.fields && rawRecord.fields.StaffMemberLookupId) {
            const fieldStaffId = rawRecord.fields.StaffMemberLookupId.toString();
            const isMatch = fieldStaffId === staffEmployeeId.toString();
            
            if (isMatch) {
              console.log(`[TimetableDataProcessor] ✅ MATCH by fields.StaffMemberLookupId: ${fieldStaffId}`);
            }
            
            return isMatch;
          }
          return false;
        });
        
        if (fieldsStaffMatches.length > 0) {
          matchingRecords = fieldsStaffMatches;
          console.log(`[TimetableDataProcessor] Matches by fields.StaffMemberLookupId: ${matchingRecords.length}`);
        }
      }
    }
    
    // СПОСОБ 5: Простой поиск содержимого employeeId в Title
    if (matchingRecords.length === 0) {
      console.log(`[TimetableDataProcessor] Trying simple Title contains search...`);
      
      const titleContainsMatches = allRecords.filter(record => {
        return record.Title && record.Title.includes(staffEmployeeId);
      });
      
      console.log(`[TimetableDataProcessor] Records with employeeId in Title: ${titleContainsMatches.length}`);
      if (titleContainsMatches.length > 0) {
        console.log(`[TimetableDataProcessor] Sample Title matches:`, 
          titleContainsMatches.slice(0, 2).map(r => r.Title)
        );
        
        // Не используем этот способ автоматически, только для отладки
      }
    }
    
    console.log(`[TimetableDataProcessor] Final result for ${staffMember.name}: ${matchingRecords.length} records`);
    
    if (matchingRecords.length > 0) {
      console.log(`[TimetableDataProcessor] Sample matching records:`, 
        matchingRecords.slice(0, 2).map(r => ({
          ID: r.ID,
          Date: r.Date.toLocaleDateString(),
          StaffMemberLookupId: r.StaffMemberLookupId,
          WeeklyTimeTableID: r.WeeklyTimeTableID,
          Title: r.Title?.substring(0, 30)
        }))
      );
    }
    
    console.log(`[TimetableDataProcessor] *** DEBUG getStaffRecords END ***`);
    
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
  private static hasPersonInfo(staffMember: any): boolean {
    // Проверяем наличие employeeId как признак реального сотрудника
    const hasEmployeeId = staffMember.employeeId && 
                         staffMember.employeeId !== '0' && 
                         staffMember.employeeId.trim() !== '';
    
    // Проверяем, что сотрудник не помечен как удаленный
    const isNotDeleted = staffMember.deleted !== 1;
    
    // Проверяем, что это не явно указанный шаблон
    const isNotTemplate = !staffMember.isTemplate;
    
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

  /**
   * Группирует записи по сотрудникам для отладки
   */
  public static debugGroupRecordsByStaff(records: IStaffRecord[]): Record<string, IStaffRecord[]> {
    const grouped: Record<string, IStaffRecord[]> = {};
    
    records.forEach(record => {
      const key = record.StaffMemberLookupId?.toString() || record.Title || record.ID || 'Unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(record);
    });
    
    console.log('[TimetableDataProcessor] Records grouped by staff:', Object.keys(grouped).map(key => ({
      key,
      count: grouped[key].length,
      sampleDates: grouped[key].slice(0, 3).map(r => r.Date.toLocaleDateString())
    })));
    
    return grouped;
  }

  /**
   * Получает уникальные значения полей для анализа данных
   */
  public static analyzeStaffRecordsFields(records: IStaffRecord[]): {
    staffMemberLookupIds: string[];
    weeklyTimeTableIds: string[];
    titlePatterns: string[];
    dateRange: { start: Date; end: Date } | null;
  } {
    const staffMemberLookupIds: string[] = [];
    const weeklyTimeTableIds: string[] = [];
    const titlePatterns: string[] = [];
    
    records.forEach(record => {
      if (record.StaffMemberLookupId) {
        const id = record.StaffMemberLookupId.toString();
        if (!staffMemberLookupIds.includes(id)) {
          staffMemberLookupIds.push(id);
        }
      }
      
      if (record.WeeklyTimeTableID) {
        const id = record.WeeklyTimeTableID.toString();
        if (!weeklyTimeTableIds.includes(id)) {
          weeklyTimeTableIds.push(id);
        }
      }
      
      if (record.Title) {
        if (!titlePatterns.includes(record.Title)) {
          titlePatterns.push(record.Title);
        }
      }
    });
    
    const dates = records.map(r => r.Date).sort((a, b) => a.getTime() - b.getTime());
    const dateRange = dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null;
    
    console.log('[TimetableDataProcessor] Staff records analysis:', {
      totalRecords: records.length,
      uniqueStaffMemberLookupIds: staffMemberLookupIds.length,
      uniqueWeeklyTimeTableIds: weeklyTimeTableIds.length,
      uniqueTitlePatterns: titlePatterns.length,
      dateRange: dateRange ? {
        start: dateRange.start.toLocaleDateString(),
        end: dateRange.end.toLocaleDateString()
      } : null
    });
    
    return {
      staffMemberLookupIds,
      weeklyTimeTableIds,
      titlePatterns,
      dateRange
    };
  }
}