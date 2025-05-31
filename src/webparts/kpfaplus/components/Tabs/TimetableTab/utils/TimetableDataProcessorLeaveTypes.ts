// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorLeaveTypes.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Specialized module for leave types analysis and processing
 * Extracted from TimetableDataProcessorCore for better maintainability
 * Version 4.1 - Refactored modular architecture
 */
export class TimetableDataProcessorLeaveTypes {

  /**
   * *** КЛЮЧЕВОЙ МЕТОД v4.1 ***
   * Улучшенное извлечение информации о типе отпуска из записей дня
   * CRITICAL FIX: Правильное получение полных названий типов отпусков
   */
  public static analyzeLeaveInfoFromRecordsEnhanced(
    allDayRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasNonWorkLeave: boolean;
    leaveTypeId?: string;
    leaveTypeTitle?: string;
    leaveTypeColor?: string;
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] *** ANALYZING LEAVE INFO v4.1 *** from ${allDayRecords.length} records with ENHANCED TITLE EXTRACTION`);
    
    // Ищем записи без рабочего времени, но с типом отпуска
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // Проверяем что нет рабочего времени
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);
      
      // Но есть тип отпуска
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1: Record ${record.ID} analysis ***`, {
        hasWorkTime,
        hasLeaveType,
        leaveTypeId: record.TypeOfLeaveID,
        typeOfLeaveObject: record.TypeOfLeave,
        leaveTypeTitle: record.TypeOfLeave?.Title
      });
      
      return !hasWorkTime && hasLeaveType;
    });

    if (nonWorkLeaveRecords.length === 0) {
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1: No non-work leave records found ***`);
      return { hasNonWorkLeave: false };
    }

    // Берем первую найденную запись с отпуском
    const leaveRecord = nonWorkLeaveRecords[0];
    const leaveTypeId = leaveRecord.TypeOfLeaveID;
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.1: Улучшенное получение названия типа отпуска ***
    let leaveTypeTitle: string | undefined = undefined;
    
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1: EXTRACTING LEAVE TYPE TITLE ***`, {
      leaveTypeId,
      typeOfLeaveObject: leaveRecord.TypeOfLeave,
      hasTypeOfLeaveObject: !!leaveRecord.TypeOfLeave,
      typeOfLeaveObjectTitle: leaveRecord.TypeOfLeave?.Title
    });
    
    // Приоритет 1: Название из связанного объекта TypeOfLeave (самый надежный)
    if (leaveRecord.TypeOfLeave && leaveRecord.TypeOfLeave.Title) {
      leaveTypeTitle = leaveRecord.TypeOfLeave.Title;
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1 SUCCESS: FOUND LEAVE TITLE FROM LINKED OBJECT: ${leaveTypeTitle} ***`);
    }
    // Приоритет 2: Поиск в дополнительных полях записи
    else if ((leaveRecord as unknown as Record<string, unknown>).Title && typeof (leaveRecord as unknown as Record<string, unknown>).Title === 'string') {
      leaveTypeTitle = (leaveRecord as unknown as Record<string, unknown>).Title as string;
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1 SUCCESS: FOUND LEAVE TITLE FROM RECORD.TITLE: ${leaveTypeTitle} ***`);
    }
    // Приоритет 3: ID как название (fallback - что даст "Type X")
    else if (leaveTypeId) {
      leaveTypeTitle = leaveTypeId;
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1 FALLBACK: USING LEAVE ID AS TITLE: ${leaveTypeTitle} ***`);
    }
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.1: Получение цвета типа отпуска ***
    let leaveTypeColor: string | undefined = undefined;
    
    if (getLeaveTypeColor && leaveTypeId) {
      leaveTypeColor = getLeaveTypeColor(leaveTypeId);
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1: LEAVE COLOR LOOKUP ***`, {
        leaveTypeId,
        leaveTypeColor,
        hasColorFunction: !!getLeaveTypeColor,
        colorFound: !!leaveTypeColor
      });
    } else {
      console.warn(`[TimetableDataProcessorLeaveTypes] *** v4.1: WARNING: No color function or leave type ID for color lookup ***`);
    }

    const result = {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.1: COMPLETE LEAVE TYPE INFO EXTRACTED ***`, {
      recordId: leaveRecord.ID,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      hasColor: !!leaveTypeColor,
      hasTitle: !!leaveTypeTitle,
      titleSource: leaveRecord.TypeOfLeave?.Title ? 'TypeOfLeave.Title' : 
                   (leaveRecord as unknown as Record<string, unknown>).Title ? 'Record.Title' : 'LeaveTypeId',
      enhancement: 'v4.1 - Full leave type information preserved for UI display with modular architecture'
    });

    return result;
  }

  /**
   * Анализирует записи на предмет отпусков без рабочего времени
   * REFACTORED v4.1: Extracted from core for better organization
   */
  public static analyzeRecordsForLeaveMarkers(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithLeaveType: number;
    nonWorkLeaveRecords: number;
    leaveTypesFound: Array<{ id: string; title?: string; count: number }>;
  } {
    const totalRecords = records.length;
    let recordsWithLeaveType = 0;
    let nonWorkLeaveRecords = 0;
    
    const leaveTypesMap = new Map<string, { id: string; title?: string; count: number }>();

    records.forEach(record => {
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeaveType++;
        
        // Собираем информацию о типах отпусков
        const leaveTypeId = record.TypeOfLeaveID;
        if (!leaveTypesMap.has(leaveTypeId)) {
          leaveTypesMap.set(leaveTypeId, {
            id: leaveTypeId,
            title: record.TypeOfLeave?.Title,
            count: 0
          });
        }
        leaveTypesMap.get(leaveTypeId)!.count++;

        // Проверяем есть ли рабочее время
        const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
          !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
            record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

        if (!hasWorkTime) {
          nonWorkLeaveRecords++;
        }
      }
    });

    const leaveTypesFound: Array<{ id: string; title?: string; count: number }> = [];
    leaveTypesMap.forEach(leaveType => {
      leaveTypesFound.push(leaveType);
    });

    return {
      totalRecords,
      recordsWithLeaveType,
      nonWorkLeaveRecords,
      leaveTypesFound
    };
  }

  /**
   * Извлекает полную информацию о типе отпуска из записи
   * REFACTORED v4.1: Specialized method for single record analysis
   */
  public static extractLeaveTypeInfoFromRecord(
    record: IStaffRecord,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasLeaveType: boolean;
    leaveTypeId?: string;
    leaveTypeTitle?: string;
    leaveTypeColor?: string;
  } {
    if (!record.TypeOfLeaveID || record.TypeOfLeaveID === '0') {
      return { hasLeaveType: false };
    }

    const leaveTypeId = record.TypeOfLeaveID;
    let leaveTypeTitle: string | undefined = undefined;
    let leaveTypeColor: string | undefined = undefined;

    // Получаем название
    if (record.TypeOfLeave && record.TypeOfLeave.Title) {
      leaveTypeTitle = record.TypeOfLeave.Title;
    } else {
      leaveTypeTitle = leaveTypeId;
    }

    // Получаем цвет
    if (getLeaveTypeColor) {
      leaveTypeColor = getLeaveTypeColor(leaveTypeId);
    }

    return {
      hasLeaveType: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };
  }

  /**
   * Валидирует качество информации о типах отпусков
   * REFACTORED v4.1: Extracted validation logic
   */
  public static validateLeaveTypesData(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
    statistics: {
      totalRecords: number;
      recordsWithLeaveType: number;
      recordsWithValidTitles: number;
      recordsWithValidColors: number;
      missingColorMappings: string[];
    };
  } {
    const issues: string[] = [];
    const warnings: string[] = [];
    
    const totalRecords = records.length;
    let recordsWithLeaveType = 0;
    let recordsWithValidTitles = 0;
    let recordsWithValidColors = 0;
    const missingColorMappings = new Set<string>();

    records.forEach(record => {
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeaveType++;
        
        // Проверяем название
        if (record.TypeOfLeave && record.TypeOfLeave.Title) {
          recordsWithValidTitles++;
        } else {
          warnings.push(`Record ${record.ID} has leave type ${record.TypeOfLeaveID} but no title`);
        }
        
        // Проверяем цвет
        if (getLeaveTypeColor) {
          const color = getLeaveTypeColor(record.TypeOfLeaveID);
          if (color) {
            recordsWithValidColors++;
          } else {
            missingColorMappings.add(record.TypeOfLeaveID);
          }
        } else {
          issues.push('Leave type color function not provided');
        }
      }
    });

    // Добавляем предупреждения о недостающих цветах
    if (missingColorMappings.size > 0) {
      const missingArray: string[] = [];
      missingColorMappings.forEach(mapping => missingArray.push(mapping));
      warnings.push(`${missingColorMappings.size} leave types have no color mapping: ${missingArray.join(', ')}`);
    }

    const isValid = issues.length === 0 && warnings.length < totalRecords * 0.1; // Менее 10% предупреждений

    return {
      isValid,
      issues,
      warnings,
      statistics: {
        totalRecords,
        recordsWithLeaveType,
        recordsWithValidTitles,
        recordsWithValidColors,
        missingColorMappings: Array.from(missingColorMappings)
      }
    };
  }

  /**
   * Создает сводку по типам отпусков
   * REFACTORED v4.1: Comprehensive summary generation
   */
  public static createLeaveTypesSummary(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    totalLeaveRecords: number;
    uniqueLeaveTypes: number;
    leaveTypesBreakdown: Array<{
      id: string;
      title: string;
      color?: string;
      count: number;
      percentage: number;
    }>;
    qualityScore: number;
    recommendations: string[];
  } {
    const leaveTypesMap = new Map<string, { id: string; title: string; color?: string; count: number }>();
    let totalLeaveRecords = 0;

    records.forEach(record => {
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        totalLeaveRecords++;
        
        const leaveTypeId = record.TypeOfLeaveID;
        const leaveTypeTitle = record.TypeOfLeave?.Title || leaveTypeId;
        const leaveTypeColor = getLeaveTypeColor ? getLeaveTypeColor(leaveTypeId) : undefined;
        
        if (leaveTypesMap.has(leaveTypeId)) {
          leaveTypesMap.get(leaveTypeId)!.count++;
        } else {
          leaveTypesMap.set(leaveTypeId, {
            id: leaveTypeId,
            title: leaveTypeTitle,
            color: leaveTypeColor,
            count: 1
          });
        }
      }
    });

    const leaveTypesBreakdown: Array<{
      id: string;
      title: string;
      color?: string;
      count: number;
      percentage: number;
    }> = [];

    leaveTypesMap.forEach(leaveType => {
      leaveTypesBreakdown.push({
        ...leaveType,
        percentage: totalLeaveRecords > 0 ? Math.round((leaveType.count / totalLeaveRecords) * 100) : 0
      });
    });

    // Сортируем по количеству использований
    leaveTypesBreakdown.sort((a, b) => b.count - a.count);

    // Вычисляем качественный балл
    const typesWithTitles = leaveTypesBreakdown.filter(lt => lt.title !== lt.id).length;
    const typesWithColors = leaveTypesBreakdown.filter(lt => lt.color).length;
    
    let qualityScore = 100;
    if (leaveTypesBreakdown.length > 0) {
      const titlesCoverage = typesWithTitles / leaveTypesBreakdown.length;
      const colorsCoverage = typesWithColors / leaveTypesBreakdown.length;
      
      qualityScore = Math.round((titlesCoverage * 50) + (colorsCoverage * 50));
    }

    // Генерируем рекомендации
    const recommendations: string[] = [];
    if (typesWithTitles < leaveTypesBreakdown.length) {
      recommendations.push('Some leave types are missing proper titles - check TypeOfLeave.Title field');
    }
    if (typesWithColors < leaveTypesBreakdown.length) {
      recommendations.push('Some leave types are missing color mappings - update getLeaveTypeColor function');
    }
    if (qualityScore < 80) {
      recommendations.push('Overall leave types data quality is below 80% - review configuration');
    }

    return {
      totalLeaveRecords,
      uniqueLeaveTypes: leaveTypesBreakdown.length,
      leaveTypesBreakdown,
      qualityScore,
      recommendations
    };
  }

  /**
   * Получает статистику по использованию типов отпусков
   * REFACTORED v4.1: Usage pattern analysis
   */
  public static getLeaveTypesUsageStatistics(
    records: IStaffRecord[]
  ): {
    totalRecords: number;
    recordsWithLeave: number;
    leaveUsagePercentage: number;
    mostUsedLeaveTypes: Array<{ id: string; title?: string; count: number; percentage: number }>;
    usagePatterns: {
      workDaysWithLeave: number;
      nonWorkDaysWithLeave: number;
      mixedUsage: number;
    };
  } {
    const totalRecords = records.length;
    let recordsWithLeave = 0;
    let workDaysWithLeave = 0;
    let nonWorkDaysWithLeave = 0;
    let mixedUsage = 0;

    const leaveUsageMap = new Map<string, { id: string; title?: string; count: number }>();

    records.forEach(record => {
      if (record.TypeOfLeaveID && record.TypeOfLeaveID !== '0') {
        recordsWithLeave++;
        
        const leaveTypeId = record.TypeOfLeaveID;
        if (!leaveUsageMap.has(leaveTypeId)) {
          leaveUsageMap.set(leaveTypeId, {
            id: leaveTypeId,
            title: record.TypeOfLeave?.Title,
            count: 0
          });
        }
        leaveUsageMap.get(leaveTypeId)!.count++;

        // Анализируем паттерн использования
        const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
          !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
            record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

        if (hasWorkTime) {
          workDaysWithLeave++;
        } else {
          nonWorkDaysWithLeave++;
        }

        // Проверяем смешанное использование (отпуск + праздник)
        if (record.Holiday === 1) {
          mixedUsage++;
        }
      }
    });

    const leaveUsagePercentage = totalRecords > 0 ? Math.round((recordsWithLeave / totalRecords) * 100) : 0;

    const mostUsedLeaveTypes: Array<{ id: string; title?: string; count: number; percentage: number }> = [];
    leaveUsageMap.forEach(usage => {
      mostUsedLeaveTypes.push({
        ...usage,
        percentage: recordsWithLeave > 0 ? Math.round((usage.count / recordsWithLeave) * 100) : 0
      });
    });

    // Сортируем по использованию
    mostUsedLeaveTypes.sort((a, b) => b.count - a.count);

    return {
      totalRecords,
      recordsWithLeave,
      leaveUsagePercentage,
      mostUsedLeaveTypes: mostUsedLeaveTypes.slice(0, 10), // Топ 10
      usagePatterns: {
        workDaysWithLeave,
        nonWorkDaysWithLeave,
        mixedUsage
      }
    };
  }
}