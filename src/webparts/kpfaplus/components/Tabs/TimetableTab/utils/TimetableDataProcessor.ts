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
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';
import { TimetableDataUtils } from './TimetableDataUtils';
import { TimetableDataAnalytics } from './TimetableDataAnalytics';
//import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Основной процессор данных для таблицы расписания
 * Версия 3.2 - ИСПРАВЛЕНО: Показ праздников и отпусков даже без рабочих смен
 * НОВОЕ: Добавлена специальная поддержка Excel экспорта
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
      version: '3.2 - Shows holidays/leaves even without work shifts'
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
   * Версия 3.2: ИСПРАВЛЕНО - показ праздников/отпусков даже без рабочих смен
   */
  public static processDataByWeeks(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] *** PROCESSING DATA BY WEEKS v3.2 (HOLIDAYS/LEAVES WITHOUT SHIFTS) ***');
    console.log('[TimetableDataProcessor] Using modular architecture with utilities, analytics and Holiday support:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      architecture: 'Modular v3.2 - Utils + Analytics + Holiday Priority System + Non-work days'
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
    console.log('[TimetableDataProcessor] *** STAGE 3: Processing weeks with leave colors and Holiday support (including non-work days) ***');
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} (${index + 1}/${weeks.length}) with Holiday support and non-work days`);

      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;
      let weekLeaveTypesCount = 0;
      let weekHolidaysCount = 0;

      // Обрабатываем каждого сотрудника в этой неделе
      staffMembers.forEach(staffMember => {
        // Получаем записи сотрудника из индекса и фильтруем по неделе
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);
        
        // ИСПРАВЛЕНО: Обрабатываем недельные данные с полной поддержкой цветов отпусков и праздников (включая дни без смен)
        const weeklyData = this.processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
          staffWeekRecords, 
          week, 
          getLeaveTypeColor, 
          holidayColor
        );
        
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
    console.log('[TimetableDataProcessor] *** PROCESSING COMPLETED v3.2 (HOLIDAYS/LEAVES WITHOUT SHIFTS) ***', finalStats);

    return weekGroups;
  }

  /**
   * НОВЫЙ МЕТОД: Специальная обработка данных для экспорта в Excel
   * Версия 3.2: Включает отметки праздников/отпусков даже без рабочих смен
   */
  public static processDataForExcelExport(params: ITimetableDataParams): IWeekGroup[] {
    const { staffRecords, staffMembers, weeks, currentUserId, managingGroupId, getLeaveTypeColor, holidayColor } = params;

    console.log('[TimetableDataProcessor] *** PROCESSING DATA FOR EXCEL EXPORT v3.2 ***');
    console.log('[TimetableDataProcessor] Excel export processing with full Holiday/Leave markers support:', {
      staffRecordsCount: staffRecords.length,
      staffMembersCount: staffMembers.length,
      weeksCount: weeks.length,
      currentUserId,
      managingGroupId,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
      version: '3.2 - Full support for non-work Holiday/Leave markers in Excel export'
    });

    // Проверка входных данных
    if (!staffRecords.length || !staffMembers.length || !weeks.length) {
      console.warn('[TimetableDataProcessor] Missing essential data for Excel export - returning empty result');
      return [];
    }

    // *** СОЗДАНИЕ ИНДЕКСОВ С ПОМОЩЬЮ УТИЛИТ ***
    const startTime = performance.now();
    
    console.log('[TimetableDataProcessor] *** CREATING INDEXES FOR EXCEL EXPORT ***');
    const recordsIndex = TimetableDataUtils.createStaffRecordsIndex(staffRecords);
    //const weekRecordsIndex = TimetableDataUtils.createWeeksRecordsIndex(staffRecords, weeks);
    //const leaveTypesIndex = TimetableDataUtils.createLeaveTypesIndex(staffRecords, getLeaveTypeColor);
    
    const indexTime = performance.now() - startTime;
    console.log('[TimetableDataProcessor] *** INDEXES CREATED FOR EXCEL EXPORT ***', {
      indexCreationTime: Math.round(indexTime) + 'ms',
      utilsUsed: 'TimetableDataUtils for all indexing operations'
    });

    // *** ОБРАБОТКА НЕДЕЛЬ С ПОЛНОЙ ПОДДЕРЖКОЙ ОТМЕТОК ДЛЯ EXCEL ***
    console.log('[TimetableDataProcessor] *** PROCESSING WEEKS FOR EXCEL WITH FULL MARKERS SUPPORT ***');
    const weekGroups: IWeekGroup[] = [];

    weeks.forEach((week, index) => {
      console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} for Excel export with full markers support`);

      const staffRows: ITimetableStaffRow[] = [];
      let weekHasData = false;

      // Обрабатываем каждого сотрудника в этой неделе
      staffMembers.forEach(staffMember => {
        // Получаем записи сотрудника из индекса и фильтруем по неделе
        const staffAllRecords = TimetableDataUtils.getStaffRecordsFromIndex(recordsIndex, staffMember);
        const staffWeekRecords = TimetableDataUtils.filterRecordsByWeek(staffAllRecords, week);
        
        // *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: Используем метод с полной поддержкой отметок для Excel ***
        const weeklyData = this.processWeekDataForExcelWithFullMarkers(
          staffWeekRecords, 
          week, 
          getLeaveTypeColor, 
          holidayColor
        );
        
        // Анализируем данные сотрудника
        const staffAnalysis = TimetableDataAnalytics.analyzeStaffWeekData(weeklyData);
        if (staffAnalysis.hasData) {
          weekHasData = true;
        }

        const staffRow: ITimetableStaffRow = {
          staffId: staffMember.id,
          staffName: staffMember.name,
          isDeleted: staffMember.deleted === 1,
          hasPersonInfo: TimetableDataUtils.hasPersonInfo(staffMember),
          weekData: weeklyData
        };

        staffRows.push(staffRow);
      });

      // Сортируем сотрудников в группе недели
      const sortedStaffRows = TimetableDataUtils.sortStaffRowsInWeek(staffRows);

      const weekGroup: IWeekGroup = {
        weekInfo: week,
        staffRows: sortedStaffRows,
        isExpanded: true, // Для экспорта все недели "развернуты"
        hasData: weekHasData
      };

      weekGroups.push(weekGroup);

      console.log(`[TimetableDataProcessor] Week ${week.weekNum} processed for Excel export:`, {
        staffCount: sortedStaffRows.length,
        hasData: weekHasData
      });
    });

    console.log('[TimetableDataProcessor] *** EXCEL EXPORT PROCESSING COMPLETED ***');
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
   * НОВЫЙ МЕТОД: Обрабатывает недельные данные включая дни без смен, но с отметками праздников/отпусков
   * Версия 3.2: ИСПРАВЛЕНО - показ праздников/отпусков даже без рабочих смен
   */
  private static processWeekDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
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

    console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} with ${weekRecords.length} records (including non-work holiday/leave markers)`);

    // Обрабатываем каждый день недели (1-7) с поддержкой цветов отпусков и праздников
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
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
   * НОВЫЙ МЕТОД: Обработка недельных данных специально для Excel экспорта
   * Версия 3.2: Максимальная поддержка отметок праздников/отпусков
   */
  private static processWeekDataForExcelWithFullMarkers(
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

    // Фильтруем записи по неделе
    const weekRecords = TimetableDataUtils.filterRecordsByWeek(staffRecords, week);

    console.log(`[TimetableDataProcessor] Processing week ${week.weekNum} for Excel with ${weekRecords.length} records (including full markers support)`);

    // *** ОБРАБАТЫВАЕМ КАЖДЫЙ ДЕНЬ НЕДЕЛИ С МАКСИМАЛЬНОЙ ПОДДЕРЖКОЙ ОТМЕТОК ***
    for (let dayNum = 1; dayNum <= 7; dayNum++) {
      const dayInfo = this.processDayDataForExcelWithFullMarkers(
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
   * НОВЫЙ МЕТОД: Обрабатывает дневные данные включая дни без смен, но с отметками праздников/отпусков
   * Версия 3.2: ИСПРАВЛЕНО - показ праздников/отпусков даже без рабочих смен
   */
  private static processDayDataWithLeaveColorsAndHolidaysIncludingNonWorkDays(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    // Находим дату для этого дня недели используя утилиты
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    console.log(`[TimetableDataProcessor] Processing day ${dayNumber} (${dayDate.toLocaleDateString()}) including non-work holiday/leave markers`);

    // *** НОВОЕ: Ищем ВСЕ записи для этого дня (включая без рабочего времени) ***
    const allDayRecords = weekRecords.filter(record => {
      const recordDate = new Date(record.Date);
      const recordDayNumber = TimetableShiftCalculator.getDayNumber(recordDate);
      const isCorrectDay = recordDayNumber === dayNumber;
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      
      return isCorrectDay && isInWeek;
    });

    console.log(`[TimetableDataProcessor] Found ${allDayRecords.length} records for day ${dayNumber}`);

    // Получаем смены только для записей с рабочим временем
    const shifts = TimetableShiftCalculator.getShiftsForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    // *** НОВОЕ: Анализируем ВСЕ записи дня (включая без смен) на предмет праздников/отпусков ***
    let hasNonWorkHoliday = false;
    let hasNonWorkLeave = false;
    let nonWorkLeaveTypeId: string | undefined = undefined;
    let nonWorkLeaveTypeColor: string | undefined = undefined;

    allDayRecords.forEach(record => {
      const isHoliday = record.Holiday === 1;
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      // Проверяем есть ли рабочее время в этой записи
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      console.log(`[TimetableDataProcessor] Record ${record.ID}: Holiday=${record.Holiday}, LeaveType=${record.TypeOfLeaveID}, HasWorkTime=${hasWorkTime}`);

      // Если нет рабочего времени, но есть отметки - это отпуск/праздник без работы
      if (!hasWorkTime) {
        if (isHoliday) {
          hasNonWorkHoliday = true;
          console.log(`[TimetableDataProcessor] Found non-work holiday on day ${dayNumber}`);
        }
        
        if (hasLeaveType) {
          hasNonWorkLeave = true;
          nonWorkLeaveTypeId = record.TypeOfLeaveID;
          
          // Получаем цвет типа отпуска
          if (getLeaveTypeColor && nonWorkLeaveTypeId) {
            nonWorkLeaveTypeColor = getLeaveTypeColor(nonWorkLeaveTypeId);
            console.log(`[TimetableDataProcessor] Found non-work leave type ${nonWorkLeaveTypeId} with color ${nonWorkLeaveTypeColor} on day ${dayNumber}`);
          }
        }
      }
    });

    // Рассчитываем общие минуты (только от смен с рабочим временем)
    const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    
    // Форматируем содержимое (только смены с рабочим временем)
    let formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // *** НОВОЕ: Добавляем информацию о праздниках/отпусках без смен ***
    if (!shifts.length && (hasNonWorkHoliday || hasNonWorkLeave)) {
      if (hasNonWorkHoliday) {
        formattedContent = "Holiday";
      } else if (hasNonWorkLeave) {
        formattedContent = "Leave";
      }
    }

    // ОБНОВЛЕНО: Определяем цвет ячейки включая дни без смен
    const workShiftsLeaveColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasWorkShiftsLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasWorkShiftsHoliday = TimetableShiftCalculator.hasHolidays ? TimetableShiftCalculator.hasHolidays(shifts) : shifts.some(s => s.isHoliday);
    
    // Объединяем информацию о праздниках и отпусках (из смен и из отдельных записей)
    const hasHoliday = hasWorkShiftsHoliday || hasNonWorkHoliday;
    const hasLeave = hasWorkShiftsLeave || hasNonWorkLeave;
    
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    // НОВОЕ: Определяем финальный цвет ячейки по системе приоритетов (включая дни без смен)
    let finalCellColor: string | undefined = undefined;
    let leaveTypeColor: string | undefined = undefined;
    
    if (hasHoliday) {
      // Праздники имеют высший приоритет
      finalCellColor = holidayColorFinal;
      console.log(`[TimetableDataProcessor] Day ${dayNumber}: Applied HOLIDAY color (including non-work)`);
    } else if (hasLeave) {
      // Приоритет: цвет из смен, затем цвет из отдельных записей
      leaveTypeColor = workShiftsLeaveColor || nonWorkLeaveTypeColor;
      if (leaveTypeColor) {
        finalCellColor = leaveTypeColor;
        console.log(`[TimetableDataProcessor] Day ${dayNumber}: Applied LEAVE color ${leaveTypeColor} (including non-work)`);
      }
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0 || hasNonWorkHoliday || hasNonWorkLeave, // ИСПРАВЛЕНО: Считаем данными и дни без смен, но с отметками
      leaveTypeColor,
      hasLeave,
      // НОВЫЕ поля для праздников
      hasHoliday,
      holidayColor: hasHoliday ? holidayColorFinal : undefined,
      finalCellColor
    };
  }

  /**
   * НОВЫЙ МЕТОД: Обработка дневных данных специально для Excel экспорта
   * Версия 3.2: Максимальная детализация праздников/отпусков для Excel
   */
  private static processDayDataForExcelWithFullMarkers(
    weekRecords: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    holidayColor?: string
  ): IDayInfo {
    // Находим дату для этого дня недели
    const dayDate = TimetableDataUtils.getDateForDayInWeek(weekStart, dayNumber);
    
    console.log(`[TimetableDataProcessor] Processing day ${dayNumber} for Excel with full markers (${dayDate.toLocaleDateString()})`);

    // *** ИСПОЛЬЗУЕМ МЕТОД С ПОЛНОЙ ПОДДЕРЖКОЙ ОТМЕТОК ИЗ CORE ***
    const shifts = TimetableShiftCalculatorCore.getShiftsAndMarkersForDay(
      weekRecords,
      dayNumber,
      weekStart,
      weekEnd,
      getLeaveTypeColor
    );

    // Рассчитываем общие минуты (только от смен с рабочим временем)
    const totalMinutes = shifts.reduce((sum, shift) => {
      // Исключаем отметки без рабочего времени из подсчета минут
      return shift.workMinutes > 0 ? sum + shift.workMinutes : sum;
    }, 0);
    
    // Форматируем содержимое
    const formattedContent = TimetableShiftCalculator.formatDayContent(shifts);

    // *** РАСШИРЕННЫЙ АНАЛИЗ ДЛЯ EXCEL ЭКСПОРТА ***
    const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasHolidayMarkers = shifts.some(s => s.isHoliday && s.workMinutes === 0);
    const hasLeaveMarkers = shifts.some(s => s.typeOfLeaveId && s.workMinutes === 0);
    const hasHolidayInWorkShifts = shifts.some(s => s.isHoliday && s.workMinutes > 0);
    const hasLeaveInWorkShifts = shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);

    // Определяем цвета с системой приоритетов
    const leaveTypeColor = TimetableShiftCalculator.getDominantLeaveColor(shifts);
    const hasLeave = TimetableShiftCalculator.hasLeaveTypes(shifts);
    const hasHoliday = TimetableShiftCalculator.hasHolidays ? 
      TimetableShiftCalculator.hasHolidays(shifts) : 
      shifts.some(s => s.isHoliday);
    
    const holidayColorFinal = holidayColor || TIMETABLE_COLORS.HOLIDAY;

    // *** ФИНАЛЬНЫЙ ЦВЕТ ЯЧЕЙКИ ПО СИСТЕМЕ ПРИОРИТЕТОВ ДЛЯ EXCEL ***
    let finalCellColor: string | undefined = undefined;
    if (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) {
      finalCellColor = holidayColorFinal; // Праздники имеют высший приоритет
    } else if ((hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts) && leaveTypeColor) {
      finalCellColor = leaveTypeColor; // Типы отпусков имеют средний приоритет
    }

    // Логирование для Excel экспорта
    if (shifts.length > 0 || hasHolidayMarkers || hasLeaveMarkers) {
      console.log(`[TimetableDataProcessor] Day ${dayNumber} Excel export analysis:`, {
        hasWorkShifts,
        hasHolidayMarkers,
        hasLeaveMarkers,
        hasHolidayInWorkShifts,
        hasLeaveInWorkShifts,
        finalCellColor,
        shiftsCount: shifts.length,
        totalMinutes,
        priorityApplied: hasHoliday || hasHolidayMarkers ? 'HOLIDAY' : 
                         hasLeave || hasLeaveMarkers ? 'LEAVE_TYPE' : 'DEFAULT'
      });
    }

    return {
      dayNumber,
      date: dayDate,
      shifts,
      totalMinutes,
      formattedContent,
      hasData: shifts.length > 0, // Есть любые данные (смены или отметки)
      leaveTypeColor,
      hasLeave: hasLeave || hasLeaveMarkers || hasLeaveInWorkShifts,
      // Поддержка праздников
      hasHoliday: hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts,
      holidayColor: (hasHoliday || hasHolidayMarkers || hasHolidayInWorkShifts) ? holidayColorFinal : undefined,
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
        // Если есть праздники без смен, тоже считаем (день помечен как праздничный)
        if (day.shifts.length === 0 && day.hasHoliday) {
          holidaysCount += 1;
        }
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
      version: '3.2',
      architecture: 'Modular',
      modules: [
        'TimetableDataProcessor (Main API)',
        'TimetableDataUtils (Indexing, Validation, Filtering)',
        'TimetableDataAnalytics (Statistics, Reports, Export)'
      ],
      features: [
        'Leave Colors Support',
        'Holiday Support with Priority System',
        'Non-work Days Holiday/Leave Marking',
        'Excel Export with Full Markers Support',
        'Advanced Analytics',
        'Performance Optimization',
        'Data Validation',
        'Comprehensive Reporting'
      ],
      compatibility: 'Fully backward compatible with v2.x, v3.0 and v3.1'
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
      recommendations.push('Modular architecture is properly configured with Holiday support, non-work days marking, and Excel export functionality');
    }

    return {
      isValid,
      modules,
      recommendations
    };
  }

  /**
   * НОВЫЙ МЕТОД: Получает статистику по Excel экспорту
   */
  public static getExcelExportPreview(weekGroups: IWeekGroup[]): {
    totalCells: number;
    cellsWithData: number;
    cellsWithHolidays: number;
    cellsWithLeave: number;
    coloredCells: number;
    exportQuality: string;
    recommendations: string[];
  } {
    let totalCells = 0;
    let cellsWithData = 0;
    let cellsWithHolidays = 0;
    let cellsWithLeave = 0;
    let coloredCells = 0;

    weekGroups.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        // 7 дней в неделе
        for (let dayNum = 1; dayNum <= 7; dayNum++) {
          totalCells++;
          const dayData = staffRow.weekData.days[dayNum];
          
          if (dayData && dayData.hasData) {
            cellsWithData++;
          }
          
          if (dayData && dayData.hasHoliday) {
            cellsWithHolidays++;
          }
          
          if (dayData && dayData.hasLeave) {
            cellsWithLeave++;
          }
          
          if (dayData && dayData.finalCellColor && dayData.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
            coloredCells++;
          }
        }
      });
    });

    const dataRatio = totalCells > 0 ? (cellsWithData / totalCells) * 100 : 0;
    let exportQuality = 'UNKNOWN';
    
    if (dataRatio > 80) {
      exportQuality = 'EXCELLENT';
    } else if (dataRatio > 50) {
      exportQuality = 'GOOD';
    } else if (dataRatio > 20) {
      exportQuality = 'FAIR';
    } else {
      exportQuality = 'POOR';
    }

    const recommendations: string[] = [];
    
    if (cellsWithHolidays === 0) {
      recommendations.push('No holiday markers found - check Holiday field in source data');
    }
    
    if (cellsWithLeave === 0) {
      recommendations.push('No leave markers found - check TypeOfLeave configuration');
    }
    
    if (coloredCells < (cellsWithHolidays + cellsWithLeave)) {
      recommendations.push('Some holidays/leaves may not have proper colors assigned');
    }
    
    if (dataRatio < 10) {
      recommendations.push('Very low data coverage - consider expanding date range or checking filters');
    }

    return {
      totalCells,
      cellsWithData,
      cellsWithHolidays,
      cellsWithLeave,
      coloredCells,
      exportQuality,
      recommendations
    };
  }
}