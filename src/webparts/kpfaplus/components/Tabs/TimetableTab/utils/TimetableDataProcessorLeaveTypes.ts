// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorLeaveTypes.ts
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Specialized module for leave types analysis and processing
 * Extracted from TimetableDataProcessorCore for better maintainability
 * Version 4.2 - UPDATED: Migrated to numeric time fields (ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes)
 */
export class TimetableDataProcessorLeaveTypes {

  /**
   * *** UPDATED v4.2 - MIGRATED TO NUMERIC FIELDS ***
   * Извлекает время из записи используя числовые поля
   * НОВЫЙ МЕТОД: Использует ShiftDate1Hours/Minutes и ShiftDate2Hours/Minutes вместо ShiftDate1/ShiftDate2
   */
  private static extractTimeFromRecord(record: IStaffRecord): {
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
    isValidTime: boolean;
    hasWorkTime: boolean;
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: EXTRACTING TIME FROM NUMERIC FIELDS ***`);
    
    // *** ИСПОЛЬЗУЕМ ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
    const startHours = record.ShiftDate1Hours ?? 0;
    const startMinutes = record.ShiftDate1Minutes ?? 0;
    const endHours = record.ShiftDate2Hours ?? 0;
    const endMinutes = record.ShiftDate2Minutes ?? 0;
    
    console.log(`[TimetableDataProcessorLeaveTypes] Record ${record.ID} numeric fields:`, {
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes,
      extracted: `${startHours}:${startMinutes} - ${endHours}:${endMinutes}`
    });
    
    // Валидация числовых значений
    const isValidTime = (
      startHours >= 0 && startHours <= 23 &&
      startMinutes >= 0 && startMinutes <= 59 &&
      endHours >= 0 && endHours <= 23 &&
      endMinutes >= 0 && endMinutes <= 59
    );
    
    // *** ОБНОВЛЕНО: Проверяем наличие рабочего времени через числовые поля (не 00:00 - 00:00) ***
    const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);
    
    if (!isValidTime) {
      console.warn(`[TimetableDataProcessorLeaveTypes] Invalid numeric time values in record ${record.ID}:`, {
        startHours, startMinutes, endHours, endMinutes
      });
    }
    
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: Time analysis for record ${record.ID} ***`, {
      isValidTime,
      hasWorkTime,
      timeDisplay: `${startHours}:${startMinutes.toString().padStart(2, '0')} - ${endHours}:${endMinutes.toString().padStart(2, '0')}`
    });
    
    return {
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      isValidTime,
      hasWorkTime
    };
  }

  /**
   * *** КЛЮЧЕВОЙ МЕТОД v4.2 - UPDATED FOR NUMERIC FIELDS ***
   * Улучшенное извлечение информации о типе отпуска из записей дня
   * CRITICAL FIX: Правильное получение полных названий типов отпусков
   * UPDATED: Migrated from ShiftDate1/ShiftDate2 to numeric time fields
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
    console.log(`[TimetableDataProcessorLeaveTypes] *** ANALYZING LEAVE INFO v4.2 WITH NUMERIC FIELDS *** from ${allDayRecords.length} records with ENHANCED TITLE EXTRACTION`);
    
    // *** UPDATED v4.2: Ищем записи без рабочего времени, но с типом отпуска используя числовые поля ***
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // *** НОВОЕ v4.2: Проверяем что нет рабочего времени через числовые поля ***
      const timeData = this.extractTimeFromRecord(record);
      const hasWorkTime = timeData.hasWorkTime;
      
      // Но есть тип отпуска
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: Record ${record.ID} analysis WITH NUMERIC FIELDS ***`, {
        hasWorkTime,
        hasLeaveType,
        leaveTypeId: record.TypeOfLeaveID,
        numericTime: `${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`,
        typeOfLeaveObject: record.TypeOfLeave,
        leaveTypeTitle: record.TypeOfLeave?.Title
      });
      
      return !hasWorkTime && hasLeaveType;
    });

    if (nonWorkLeaveRecords.length === 0) {
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: No non-work leave records found ***`);
      return { hasNonWorkLeave: false };
    }

    // Берем первую найденную запись с отпуском
    const leaveRecord = nonWorkLeaveRecords[0];
    const leaveTypeId = leaveRecord.TypeOfLeaveID;
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.2: Улучшенное получение названия типа отпуска ***
    let leaveTypeTitle: string | undefined = undefined;
    
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: EXTRACTING LEAVE TYPE TITLE WITH NUMERIC FIELDS ***`, {
      leaveTypeId,
      typeOfLeaveObject: leaveRecord.TypeOfLeave,
      hasTypeOfLeaveObject: !!leaveRecord.TypeOfLeave,
      typeOfLeaveObjectTitle: leaveRecord.TypeOfLeave?.Title
    });
    
    // Приоритет 1: Название из связанного объекта TypeOfLeave (самый надежный)
    if (leaveRecord.TypeOfLeave && leaveRecord.TypeOfLeave.Title) {
      leaveTypeTitle = leaveRecord.TypeOfLeave.Title;
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2 SUCCESS: FOUND LEAVE TITLE FROM LINKED OBJECT: ${leaveTypeTitle} ***`);
    }
    // Приоритет 2: Поиск в дополнительных полях записи
    else if ((leaveRecord as unknown as Record<string, unknown>).Title && typeof (leaveRecord as unknown as Record<string, unknown>).Title === 'string') {
      leaveTypeTitle = (leaveRecord as unknown as Record<string, unknown>).Title as string;
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2 SUCCESS: FOUND LEAVE TITLE FROM RECORD.TITLE: ${leaveTypeTitle} ***`);
    }
    // Приоритет 3: ID как название (fallback - что даст "Type X")
    else if (leaveTypeId) {
      leaveTypeTitle = leaveTypeId;
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2 FALLBACK: USING LEAVE ID AS TITLE: ${leaveTypeTitle} ***`);
    }
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v4.2: Получение цвета типа отпуска ***
    let leaveTypeColor: string | undefined = undefined;
    
    if (getLeaveTypeColor && leaveTypeId) {
      leaveTypeColor = getLeaveTypeColor(leaveTypeId);
      console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: LEAVE COLOR LOOKUP WITH NUMERIC FIELDS ***`, {
        leaveTypeId,
        leaveTypeColor,
        hasColorFunction: !!getLeaveTypeColor,
        colorFound: !!leaveTypeColor
      });
    } else {
      console.warn(`[TimetableDataProcessorLeaveTypes] *** v4.2: WARNING: No color function or leave type ID for color lookup ***`);
    }

    const result = {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: COMPLETE LEAVE TYPE INFO EXTRACTED WITH NUMERIC FIELDS ***`, {
      recordId: leaveRecord.ID,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      hasColor: !!leaveTypeColor,
      hasTitle: !!leaveTypeTitle,
      titleSource: leaveRecord.TypeOfLeave?.Title ? 'TypeOfLeave.Title' : 
                   (leaveRecord as unknown as Record<string, unknown>).Title ? 'Record.Title' : 'LeaveTypeId',
      enhancement: 'v4.2 - Full leave type information preserved for UI display with numeric time fields architecture'
    });

    return result;
  }

  /**
   * *** UPDATED v4.2 - MIGRATED TO NUMERIC FIELDS ***
   * Анализирует записи на предмет отпусков без рабочего времени
   * REFACTORED v4.2: Extracted from core for better organization with numeric fields support
   */
  public static analyzeRecordsForLeaveMarkers(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithLeaveType: number;
    nonWorkLeaveRecords: number;
    leaveTypesFound: Array<{ id: string; title?: string; count: number }>;
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: ANALYZING RECORDS FOR LEAVE MARKERS WITH NUMERIC FIELDS ***`);
    
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

        // *** UPDATED v4.2: Проверяем есть ли рабочее время через числовые поля ***
        const timeData = this.extractTimeFromRecord(record);
        const hasWorkTime = timeData.hasWorkTime;

        if (!hasWorkTime) {
          nonWorkLeaveRecords++;
          console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: Found non-work leave record ${record.ID} with numeric time ${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes} ***`);
        }
      }
    });

    const leaveTypesFound: Array<{ id: string; title?: string; count: number }> = [];
    leaveTypesMap.forEach(leaveType => {
      leaveTypesFound.push(leaveType);
    });

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: LEAVE MARKERS ANALYSIS COMPLETED WITH NUMERIC FIELDS ***`, {
      totalRecords,
      recordsWithLeaveType,
      nonWorkLeaveRecords,
      leaveTypesFound: leaveTypesFound.length
    });

    return {
      totalRecords,
      recordsWithLeaveType,
      nonWorkLeaveRecords,
      leaveTypesFound
    };
  }

  /**
   * *** UPDATED v4.2 - MIGRATED TO NUMERIC FIELDS ***
   * Извлекает полную информацию о типе отпуска из записи
   * REFACTORED v4.2: Specialized method for single record analysis with numeric fields
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

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: EXTRACTED LEAVE INFO FROM RECORD ${record.ID} ***`, {
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      hasColor: !!leaveTypeColor
    });

    return {
      hasLeaveType: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };
  }

  /**
   * *** UPDATED v4.2 - ENHANCED VALIDATION WITH NUMERIC FIELDS ***
   * Валидирует качество информации о типах отпусков
   * REFACTORED v4.2: Extracted validation logic with numeric fields support
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
      recordsWithValidNumericTime: number;
      missingColorMappings: string[];
    };
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: VALIDATING LEAVE TYPES DATA WITH NUMERIC FIELDS ***`);
    
    const issues: string[] = [];
    const warnings: string[] = [];
    
    const totalRecords = records.length;
    let recordsWithLeaveType = 0;
    let recordsWithValidTitles = 0;
    let recordsWithValidColors = 0;
    let recordsWithValidNumericTime = 0;
    const missingColorMappings = new Set<string>();

    records.forEach(record => {
      // *** NEW v4.2: Валидация числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      if (timeData.isValidTime) {
        recordsWithValidNumericTime++;
      } else {
        issues.push(`Record ${record.ID} has invalid numeric time fields: ${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`);
      }

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

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: VALIDATION COMPLETED WITH NUMERIC FIELDS ***`, {
      isValid,
      totalRecords,
      recordsWithLeaveType,
      recordsWithValidNumericTime,
      issuesCount: issues.length,
      warningsCount: warnings.length
    });

    return {
      isValid,
      issues,
      warnings,
      statistics: {
        totalRecords,
        recordsWithLeaveType,
        recordsWithValidTitles,
        recordsWithValidColors,
        recordsWithValidNumericTime,
        missingColorMappings: Array.from(missingColorMappings)
      }
    };
  }

  /**
   * *** UPDATED v4.2 - COMPREHENSIVE SUMMARY WITH NUMERIC FIELDS ***
   * Создает сводку по типам отпусков
   * REFACTORED v4.2: Comprehensive summary generation with numeric fields support
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
    numericFieldsStatistics: {
      recordsWithValidTime: number;
      recordsWithInvalidTime: number;
      zeroTimeRecords: number;
    };
    qualityScore: number;
    recommendations: string[];
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: CREATING LEAVE TYPES SUMMARY WITH NUMERIC FIELDS ***`);
    
    const leaveTypesMap = new Map<string, { id: string; title: string; color?: string; count: number }>();
    let totalLeaveRecords = 0;
    
    // *** NEW v4.2: Статистика по числовым полям ***
    let recordsWithValidTime = 0;
    let recordsWithInvalidTime = 0;
    let zeroTimeRecords = 0;

    records.forEach(record => {
      // *** NEW v4.2: Анализ числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      if (timeData.isValidTime) {
        recordsWithValidTime++;
      } else {
        recordsWithInvalidTime++;
      }
      
      if (!timeData.hasWorkTime) {
        zeroTimeRecords++;
      }

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

    // *** UPDATED v4.2: Вычисляем качественный балл с учетом числовых полей ***
    const typesWithTitles = leaveTypesBreakdown.filter(lt => lt.title !== lt.id).length;
    const typesWithColors = leaveTypesBreakdown.filter(lt => lt.color).length;
    
    let qualityScore = 100;
    if (leaveTypesBreakdown.length > 0) {
      const titlesCoverage = typesWithTitles / leaveTypesBreakdown.length;
      const colorsCoverage = typesWithColors / leaveTypesBreakdown.length;
      const numericTimeCoverage = records.length > 0 ? recordsWithValidTime / records.length : 1;
      
      qualityScore = Math.round((titlesCoverage * 40) + (colorsCoverage * 40) + (numericTimeCoverage * 20));
    }

    // *** UPDATED v4.2: Генерируем рекомендации с учетом числовых полей ***
    const recommendations: string[] = [];
    if (typesWithTitles < leaveTypesBreakdown.length) {
      recommendations.push('Some leave types are missing proper titles - check TypeOfLeave.Title field');
    }
    if (typesWithColors < leaveTypesBreakdown.length) {
      recommendations.push('Some leave types are missing color mappings - update getLeaveTypeColor function');
    }
    if (recordsWithInvalidTime > 0) {
      recommendations.push(`${recordsWithInvalidTime} records have invalid numeric time fields - verify data integrity`);
    }
    if (qualityScore < 80) {
      recommendations.push('Overall leave types data quality is below 80% - review configuration');
    }

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: SUMMARY COMPLETED WITH NUMERIC FIELDS ***`, {
      totalLeaveRecords,
      uniqueLeaveTypes: leaveTypesBreakdown.length,
      qualityScore,
      recordsWithValidTime,
      recordsWithInvalidTime,
      zeroTimeRecords
    });

    return {
      totalLeaveRecords,
      uniqueLeaveTypes: leaveTypesBreakdown.length,
      leaveTypesBreakdown,
      numericFieldsStatistics: {
        recordsWithValidTime,
        recordsWithInvalidTime,
        zeroTimeRecords
      },
      qualityScore,
      recommendations
    };
  }

  /**
   * *** UPDATED v4.2 - USAGE STATISTICS WITH NUMERIC FIELDS ***
   * Получает статистику по использованию типов отпусков
   * REFACTORED v4.2: Usage pattern analysis with numeric fields support
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
    numericFieldsAnalysis: {
      validTimeRecords: number;
      invalidTimeRecords: number;
      timeValidationRate: number;
    };
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: ANALYZING USAGE STATISTICS WITH NUMERIC FIELDS ***`);
    
    const totalRecords = records.length;
    let recordsWithLeave = 0;
    let workDaysWithLeave = 0;
    let nonWorkDaysWithLeave = 0;
    let mixedUsage = 0;
    
    // *** NEW v4.2: Анализ числовых полей ***
    let validTimeRecords = 0;
    let invalidTimeRecords = 0;

    const leaveUsageMap = new Map<string, { id: string; title?: string; count: number }>();

    records.forEach(record => {
      // *** NEW v4.2: Валидация числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      if (timeData.isValidTime) {
        validTimeRecords++;
      } else {
        invalidTimeRecords++;
      }

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

        // *** UPDATED v4.2: Анализируем паттерн использования через числовые поля ***
        const hasWorkTime = timeData.hasWorkTime;

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
    const timeValidationRate = totalRecords > 0 ? Math.round((validTimeRecords / totalRecords) * 100) : 0;

    const mostUsedLeaveTypes: Array<{ id: string; title?: string; count: number; percentage: number }> = [];
    leaveUsageMap.forEach(usage => {
      mostUsedLeaveTypes.push({
        ...usage,
        percentage: recordsWithLeave > 0 ? Math.round((usage.count / recordsWithLeave) * 100) : 0
      });
    });

    // Сортируем по использованию
    mostUsedLeaveTypes.sort((a, b) => b.count - a.count);

    console.log(`[TimetableDataProcessorLeaveTypes] *** v4.2: USAGE STATISTICS COMPLETED WITH NUMERIC FIELDS ***`, {
      totalRecords,
      recordsWithLeave,
      leaveUsagePercentage,
      timeValidationRate,
      workDaysWithLeave,
      nonWorkDaysWithLeave
    });

    return {
      totalRecords,
      recordsWithLeave,
      leaveUsagePercentage,
      mostUsedLeaveTypes: mostUsedLeaveTypes.slice(0, 10), // Топ 10
      usagePatterns: {
        workDaysWithLeave,
        nonWorkDaysWithLeave,
        mixedUsage
      },
      numericFieldsAnalysis: {
        validTimeRecords,
        invalidTimeRecords,
        timeValidationRate
      }
    };
  }
}