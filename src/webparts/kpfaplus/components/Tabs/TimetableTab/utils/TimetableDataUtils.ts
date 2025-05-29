// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataUtils.ts
import { 
  IDayInfo, 
  IWeekInfo,
  IWeekGroup,
  ITimetableStaffRow,
  IStaffMember
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Утилиты для обработки данных расписания
 * Содержит индексирование, валидацию, фильтрацию и оптимизацию
 * Версия 3.0 - Полная поддержка цветов отпусков
 */
export class TimetableDataUtils {

  // *** ИНДЕКСИРОВАНИЕ И ОПТИМИЗАЦИЯ ***

  /**
   * Создает индекс записей по сотрудникам для быстрого поиска
   */
  public static createStaffRecordsIndex(allRecords: IStaffRecord[]): Record<string, IStaffRecord[]> {
    console.log('[TimetableDataUtils] Creating staff records index...');
    
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

    console.log('[TimetableDataUtils] Staff records index created:', {
      uniqueStaff: Object.keys(index).length,
      recordsIndexed: indexedRecords,
      indexEfficiency: Math.round((indexedRecords / allRecords.length) * 100) + '%'
    });

    return index;
  }

  /**
   * Создает индекс записей по неделям для оптимизации
   */
  public static createWeeksRecordsIndex(
    allRecords: IStaffRecord[], 
    weeks: IWeekInfo[]
  ): Record<number, IStaffRecord[]> {
    console.log('[TimetableDataUtils] Creating weeks records index...');
    
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
    
    console.log('[TimetableDataUtils] Weeks records index created:', {
      totalWeeks: weeks.length,
      weeksWithRecords: weeksWithRecords,
      recordsOutsideWeeks: recordsOutsideWeeks,
      distributionQuality: weeksWithRecords > 1 ? 'GOOD - Multi-week distribution' : 'WARNING - Single week concentration'
    });

    return index;
  }

  /**
   * Создает индекс типов отпусков с цветами
   */
  public static createLeaveTypesIndex(
    allRecords: IStaffRecord[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): Record<string, { count: number; color?: string; title?: string }> {
    console.log('[TimetableDataUtils] Creating leave types index...');
    
    const index: Record<string, { count: number; color?: string; title?: string }> = {};
    
    if (!getLeaveTypeColor) {
      console.log('[TimetableDataUtils] No leave type color function provided - skipping leave types indexing');
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

    console.log('[TimetableDataUtils] Leave types index created:', {
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
   * Получает записи для сотрудника из индекса
   */
  public static getStaffRecordsFromIndex(
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
   * Фильтрует записи по неделе
   */
  public static filterRecordsByWeek(records: IStaffRecord[], week: IWeekInfo): IStaffRecord[] {
    return records.filter(record => {
      const recordDate = new Date(record.Date);
      return TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd);
    });
  }

  // *** ФИЛЬТРАЦИЯ И ПОИСК ***

  /**
   * Расширенная фильтрация данных недель с поддержкой цветов отпусков
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

  // *** ВАЛИДАЦИЯ И ПРОВЕРКА ДАННЫХ ***

  /**
   * Валидация данных с проверкой цветов отпусков
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
    const missingArray: string[] = [];
    if (missingColorMappings.size > 0) {
      missingColorMappings.forEach(mapping => missingArray.push(mapping));
      warnings.push(`${missingColorMappings.size} leave types have no color mapping: ${missingArray.join(', ')}`);
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
      missingColorMappings: missingArray
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

  // *** ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ ***

  /**
   * Анализирует и предоставляет рекомендации по оптимизации производительности
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

  // *** УТИЛИТАРНЫЕ МЕТОДЫ ***

  /**
   * Проверяет, есть ли у сотрудника данные Person (реальный vs шаблон)
   */
  public static hasPersonInfo(staffMember: IStaffMember): boolean {
    const hasEmployeeId = !!(staffMember.employeeId && 
                         staffMember.employeeId !== '0' && 
                         staffMember.employeeId.trim() !== '');
    const isNotDeleted = (staffMember.deleted || 0) !== 1;
    const isNotTemplate = !(staffMember.isTemplate || false);
    
    return hasEmployeeId && isNotDeleted && isNotTemplate;
  }

  /**
   * Сортирует строки сотрудников в группе недели
   */
  public static sortStaffRowsInWeek(staffRows: ITimetableStaffRow[]): ITimetableStaffRow[] {
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
  public static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    const date = new Date(weekStart);
    const startDayNumber = TimetableWeekCalculator.getDayNumber(weekStart);
    
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7;
    }
    
    date.setDate(weekStart.getDate() + offset);
    return date;
  }

  /**
   * Анализирует распределение данных по неделям
   */
  public static analyzeDataDistribution(
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
}