// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableDataProcessorLeaveTypes.ts
// ОБНОВЛЕНО v5.0: Полная поддержка Date-only формата + числовые поля времени
// Date-only: Поле Date больше не содержит время, используются числовые поля для времени

import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Specialized module for leave types analysis and processing
 * Extracted from TimetableDataProcessorCore for better maintainability
 * ОБНОВЛЕНО v5.0: Migrated to Date-only fields + numeric time fields (ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes)
 */
export class TimetableDataProcessorLeaveTypes {

  /**
   * ОБНОВЛЕНО v5.0: Извлекает время из записи используя числовые поля
   * Date-only: Поле Date теперь содержит только дату
   */
  private static extractTimeFromRecord(record: IStaffRecord): {
    startHours: number;
    startMinutes: number;
    endHours: number;
    endMinutes: number;
    isValidTime: boolean;
    hasWorkTime: boolean;
    recordDate: Date; // Date-only field
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: Extracting time from numeric fields for record ${record.ID}`);
    
    // *** ЧИСЛОВЫЕ ПОЛЯ ВРЕМЕНИ ***
    const startHours = record.ShiftDate1Hours ?? 0;
    const startMinutes = record.ShiftDate1Minutes ?? 0;
    const endHours = record.ShiftDate2Hours ?? 0;
    const endMinutes = record.ShiftDate2Minutes ?? 0;
    
    // *** Date-only поле ***
    const recordDate = new Date(record.Date);
    
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: Record ${record.ID} extraction:`, {
      dateOnly: recordDate.toLocaleDateString(),
      dateISO: recordDate.toISOString(),
      numericTime: `${startHours}:${startMinutes.toString().padStart(2, '0')} - ${endHours}:${endMinutes.toString().padStart(2, '0')}`,
      ShiftDate1Hours: record.ShiftDate1Hours,
      ShiftDate1Minutes: record.ShiftDate1Minutes,
      ShiftDate2Hours: record.ShiftDate2Hours,
      ShiftDate2Minutes: record.ShiftDate2Minutes
    });
    
    // Валидация числовых значений времени
    const isValidTime = (
      startHours >= 0 && startHours <= 23 &&
      startMinutes >= 0 && startMinutes <= 59 &&
      endHours >= 0 && endHours <= 23 &&
      endMinutes >= 0 && endMinutes <= 59
    );
    
    // Проверяем наличие рабочего времени (не 00:00 - 00:00)
    const hasWorkTime = !(startHours === 0 && startMinutes === 0 && endHours === 0 && endMinutes === 0);
    
    if (!isValidTime) {
      console.warn(`[TimetableDataProcessorLeaveTypes] v5.0: Invalid numeric time in record ${record.ID}:`, {
        startHours, startMinutes, endHours, endMinutes
      });
    }
    
    // *** Date-only валидация ***
    if (isNaN(recordDate.getTime())) {
      console.warn(`[TimetableDataProcessorLeaveTypes] v5.0: Invalid date-only field in record ${record.ID}`);
    }
    
    return {
      startHours,
      startMinutes,
      endHours,
      endMinutes,
      isValidTime,
      hasWorkTime,
      recordDate
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Улучшенное извлечение информации о типе отпуска из записей дня
   * CRITICAL FIX: Правильное получение полных названий типов отпусков
   * Date-only: Migrated from DateTime to Date-only + numeric time fields
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
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: ANALYZING LEAVE INFO WITH DATE-ONLY + NUMERIC FIELDS from ${allDayRecords.length} records with ENHANCED TITLE EXTRACTION`);
    
    // *** ОБНОВЛЕНО v5.0: Ищем записи без рабочего времени, но с типом отпуска используя числовые поля + date-only ***
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // *** НОВОЕ v5.0: Проверяем что нет рабочего времени через числовые поля + валидная date-only дата ***
      const timeData = this.extractTimeFromRecord(record);
      const hasWorkTime = timeData.hasWorkTime;
      const hasValidDate = !isNaN(timeData.recordDate.getTime());
      
      // Но есть тип отпуска
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      console.log(`[TimetableDataProcessorLeaveTypes] v5.0: Record ${record.ID} analysis WITH NUMERIC FIELDS + DATE-ONLY:`, {
        hasWorkTime,
        hasLeaveType,
        hasValidDate,
        leaveTypeId: record.TypeOfLeaveID,
        dateOnly: timeData.recordDate.toLocaleDateString(),
        numericTime: `${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`,
        typeOfLeaveObject: record.TypeOfLeave,
        leaveTypeTitle: record.TypeOfLeave?.Title
      });
      
      return !hasWorkTime && hasLeaveType && hasValidDate;
    });

    if (nonWorkLeaveRecords.length === 0) {
      console.log(`[TimetableDataProcessorLeaveTypes] v5.0: No non-work leave records found with valid date-only fields`);
      return { hasNonWorkLeave: false };
    }

    // Берем первую найденную запись с отпуском
    const leaveRecord = nonWorkLeaveRecords[0];
    const leaveTypeId = leaveRecord.TypeOfLeaveID;
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v5.0: Улучшенное получение названия типа отпуска ***
    let leaveTypeTitle: string | undefined = undefined;
    
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: EXTRACTING LEAVE TYPE TITLE WITH DATE-ONLY + NUMERIC FIELDS:`, {
      leaveTypeId,
      typeOfLeaveObject: leaveRecord.TypeOfLeave,
      hasTypeOfLeaveObject: !!leaveRecord.TypeOfLeave,
      typeOfLeaveObjectTitle: leaveRecord.TypeOfLeave?.Title,
      recordDate: new Date(leaveRecord.Date).toLocaleDateString()
    });
    
    // Приоритет 1: Название из связанного объекта TypeOfLeave (самый надежный)
    if (leaveRecord.TypeOfLeave && leaveRecord.TypeOfLeave.Title) {
      leaveTypeTitle = leaveRecord.TypeOfLeave.Title;
      console.log(`[TimetableDataProcessorLeaveTypes] v5.0 SUCCESS: FOUND LEAVE TITLE FROM LINKED OBJECT: ${leaveTypeTitle}`);
    }
    // Приоритет 2: Поиск в дополнительных полях записи
    else if ((leaveRecord as unknown as Record<string, unknown>).Title && typeof (leaveRecord as unknown as Record<string, unknown>).Title === 'string') {
      leaveTypeTitle = (leaveRecord as unknown as Record<string, unknown>).Title as string;
      console.log(`[TimetableDataProcessorLeaveTypes] v5.0 SUCCESS: FOUND LEAVE TITLE FROM RECORD.TITLE: ${leaveTypeTitle}`);
    }
    // Приоритет 3: ID как название (fallback - что даст "Type X")
    else if (leaveTypeId) {
      leaveTypeTitle = leaveTypeId;
      console.log(`[TimetableDataProcessorLeaveTypes] v5.0 FALLBACK: USING LEAVE ID AS TITLE: ${leaveTypeTitle}`);
    }
    
    // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ v5.0: Получение цвета типа отпуска ***
    let leaveTypeColor: string | undefined = undefined;
    
    if (getLeaveTypeColor && leaveTypeId) {
      leaveTypeColor = getLeaveTypeColor(leaveTypeId);
      console.log(`[TimetableDataProcessorLeaveTypes] v5.0: LEAVE COLOR LOOKUP WITH DATE-ONLY + NUMERIC FIELDS:`, {
        leaveTypeId,
        leaveTypeColor,
        hasColorFunction: !!getLeaveTypeColor,
        colorFound: !!leaveTypeColor
      });
    } else {
      console.warn(`[TimetableDataProcessorLeaveTypes] v5.0: WARNING: No color function or leave type ID for color lookup`);
    }

    const result = {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };

    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: COMPLETE LEAVE TYPE INFO EXTRACTED WITH DATE-ONLY + NUMERIC FIELDS:`, {
      recordId: leaveRecord.ID,
      recordDate: new Date(leaveRecord.Date).toLocaleDateString(),
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      hasColor: !!leaveTypeColor,
      hasTitle: !!leaveTypeTitle,
      titleSource: leaveRecord.TypeOfLeave?.Title ? 'TypeOfLeave.Title' : 
                   (leaveRecord as unknown as Record<string, unknown>).Title ? 'Record.Title' : 'LeaveTypeId',
      enhancement: 'v5.0 - Full leave type information preserved for UI display with date-only + numeric time fields architecture'
    });

    return result;
  }

  /**
   * ОБНОВЛЕНО v5.0: Анализирует записи на предмет отпусков без рабочего времени
   * Date-only: Extracted from core for better organization with date-only + numeric fields support
   */
  public static analyzeRecordsForLeaveMarkers(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithLeaveType: number;
    nonWorkLeaveRecords: number;
    leaveTypesFound: Array<{ id: string; title?: string; count: number }>;
    dateOnlyStatistics: {
      recordsWithValidDates: number;
      recordsWithInvalidDates: number;
      dateRange: {
        earliest?: string;
        latest?: string;
        spanDays: number;
      };
    };
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: ANALYZING RECORDS FOR LEAVE MARKERS WITH DATE-ONLY + NUMERIC FIELDS`);
    
    const totalRecords = records.length;
    let recordsWithLeaveType = 0;
    let nonWorkLeaveRecords = 0;
    
    // *** НОВОЕ v5.0: Date-only статистика ***
    let recordsWithValidDates = 0;
    let recordsWithInvalidDates = 0;
    const validDates: Date[] = [];
    
    const leaveTypesMap = new Map<string, { id: string; title?: string; count: number }>();

    records.forEach(record => {
      // *** ОБНОВЛЕНО v5.0: Date-only валидация ***
      const timeData = this.extractTimeFromRecord(record);
      const recordDate = timeData.recordDate;
      
      if (isNaN(recordDate.getTime())) {
        recordsWithInvalidDates++;
        console.warn(`[TimetableDataProcessorLeaveTypes] v5.0: Invalid date-only field in record ${record.ID}`);
      } else {
        recordsWithValidDates++;
        // Нормализуем к date-only для статистики
        const normalizedDate = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate());
        validDates.push(normalizedDate);
      }

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

        // *** ОБНОВЛЕНО v5.0: Проверяем есть ли рабочее время через числовые поля ***
        const hasWorkTime = timeData.hasWorkTime;

        if (!hasWorkTime) {
          nonWorkLeaveRecords++;
          console.log(`[TimetableDataProcessorLeaveTypes] v5.0: Found non-work leave record ${record.ID} with date-only ${recordDate.toLocaleDateString()} and numeric time ${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`);
        }
      }
    });

    const leaveTypesFound: Array<{ id: string; title?: string; count: number }> = [];
    leaveTypesMap.forEach(leaveType => {
      leaveTypesFound.push(leaveType);
    });

    // *** НОВОЕ v5.0: Date-only диапазон дат ***
    let dateRange = {
      earliest: undefined as string | undefined,
      latest: undefined as string | undefined,
      spanDays: 0
    };

    if (validDates.length > 0) {
      const sortedDates = validDates.sort((a, b) => a.getTime() - b.getTime());
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];
      
      dateRange = {
        earliest: earliestDate.toLocaleDateString(),
        latest: latestDate.toLocaleDateString(),
        spanDays: Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
      };
    }

    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: LEAVE MARKERS ANALYSIS COMPLETED WITH DATE-ONLY + NUMERIC FIELDS:`, {
      totalRecords,
      recordsWithLeaveType,
      nonWorkLeaveRecords,
      leaveTypesFound: leaveTypesFound.length,
      dateOnlyStatistics: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        dateRange
      }
    });

    return {
      totalRecords,
      recordsWithLeaveType,
      nonWorkLeaveRecords,
      leaveTypesFound,
      dateOnlyStatistics: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        dateRange
      }
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Извлекает полную информацию о типе отпуска из записи
   * Date-only: Specialized method for single record analysis with date-only + numeric fields
   */
  public static extractLeaveTypeInfoFromRecord(
    record: IStaffRecord,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasLeaveType: boolean;
    leaveTypeId?: string;
    leaveTypeTitle?: string;
    leaveTypeColor?: string;
    recordDate?: string; // Date-only field as string
    isValidRecord: boolean;
  } {
    // *** ОБНОВЛЕНО v5.0: Date-only валидация ***
    const timeData = this.extractTimeFromRecord(record);
    const isValidRecord = timeData.isValidTime && !isNaN(timeData.recordDate.getTime());
    const recordDate = isValidRecord ? timeData.recordDate.toLocaleDateString() : undefined;

    if (!record.TypeOfLeaveID || record.TypeOfLeaveID === '0') {
      return { 
        hasLeaveType: false, 
        recordDate,
        isValidRecord 
      };
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

    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: EXTRACTED LEAVE INFO FROM RECORD ${record.ID} WITH DATE-ONLY:`, {
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      recordDate,
      isValidRecord,
      hasColor: !!leaveTypeColor
    });

    return {
      hasLeaveType: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      recordDate,
      isValidRecord
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Валидирует качество информации о типах отпусков
   * Date-only: Extracted validation logic with date-only + numeric fields support
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
      recordsWithValidDates: number;
      missingColorMappings: string[];
    };
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: VALIDATING LEAVE TYPES DATA WITH DATE-ONLY + NUMERIC FIELDS`);
    
    const issues: string[] = [];
    const warnings: string[] = [];
    
    const totalRecords = records.length;
    let recordsWithLeaveType = 0;
    let recordsWithValidTitles = 0;
    let recordsWithValidColors = 0;
    let recordsWithValidNumericTime = 0;
    let recordsWithValidDates = 0;
    const missingColorMappings = new Set<string>();

    records.forEach(record => {
      // *** НОВОЕ v5.0: Валидация date-only + числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      
      if (timeData.isValidTime) {
        recordsWithValidNumericTime++;
      } else {
        issues.push(`Record ${record.ID} has invalid numeric time fields: ${timeData.startHours}:${timeData.startMinutes} - ${timeData.endHours}:${timeData.endMinutes}`);
      }

      // *** Date-only валидация ***
      if (!isNaN(timeData.recordDate.getTime())) {
        recordsWithValidDates++;
      } else {
        issues.push(`Record ${record.ID} has invalid date-only field`);
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

    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: VALIDATION COMPLETED WITH DATE-ONLY + NUMERIC FIELDS:`, {
      isValid,
      totalRecords,
      recordsWithLeaveType,
      recordsWithValidDates,
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
        recordsWithValidDates,
        missingColorMappings: Array.from(missingColorMappings)
      }
    };
  }

  /**
   * ОБНОВЛЕНО v5.0: Создает сводку по типам отпусков
   * Date-only: Comprehensive summary generation with date-only + numeric fields support
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
    dateOnlyStatistics: {
      recordsWithValidDates: number;
      recordsWithInvalidDates: number;
      dateRangeSpanDays: number;
    };
    numericFieldsStatistics: {
      recordsWithValidTime: number;
      recordsWithInvalidTime: number;
      zeroTimeRecords: number;
    };
    qualityScore: number;
    recommendations: string[];
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: CREATING LEAVE TYPES SUMMARY WITH DATE-ONLY + NUMERIC FIELDS`);
    
    const leaveTypesMap = new Map<string, { id: string; title: string; color?: string; count: number }>();
    let totalLeaveRecords = 0;
    
    // *** НОВОЕ v5.0: Статистика по date-only + числовым полям ***
    let recordsWithValidDates = 0;
    let recordsWithInvalidDates = 0;
    let recordsWithValidTime = 0;
    let recordsWithInvalidTime = 0;
    let zeroTimeRecords = 0;
    const validDates: Date[] = [];

    records.forEach(record => {
      // *** НОВОЕ v5.0: Анализ date-only + числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      
      if (!isNaN(timeData.recordDate.getTime())) {
        recordsWithValidDates++;
        const normalizedDate = new Date(timeData.recordDate.getFullYear(), timeData.recordDate.getMonth(), timeData.recordDate.getDate());
        validDates.push(normalizedDate);
      } else {
        recordsWithInvalidDates++;
      }
      
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

    // *** НОВОЕ v5.0: Date-only диапазон ***
    let dateRangeSpanDays = 0;
    if (validDates.length > 0) {
      const sortedDates = validDates.sort((a, b) => a.getTime() - b.getTime());
      const earliestDate = sortedDates[0];
      const latestDate = sortedDates[sortedDates.length - 1];
      dateRangeSpanDays = Math.ceil((latestDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }

    // *** ОБНОВЛЕНО v5.0: Вычисляем качественный балл с учетом date-only + числовых полей ***
    const typesWithTitles = leaveTypesBreakdown.filter(lt => lt.title !== lt.id).length;
    const typesWithColors = leaveTypesBreakdown.filter(lt => lt.color).length;
    
    let qualityScore = 100;
    if (leaveTypesBreakdown.length > 0) {
      const titlesCoverage = typesWithTitles / leaveTypesBreakdown.length;
      const colorsCoverage = typesWithColors / leaveTypesBreakdown.length;
      const dateValidationRate = records.length > 0 ? recordsWithValidDates / records.length : 1;
      const timeValidationRate = records.length > 0 ? recordsWithValidTime / records.length : 1;
      
      qualityScore = Math.round((titlesCoverage * 30) + (colorsCoverage * 30) + (dateValidationRate * 20) + (timeValidationRate * 20));
    }

    // *** ОБНОВЛЕНО v5.0: Генерируем рекомендации с учетом date-only + числовых полей ***
    const recommendations: string[] = [];
    if (typesWithTitles < leaveTypesBreakdown.length) {
      recommendations.push('Some leave types are missing proper titles - check TypeOfLeave.Title field');
    }
    if (typesWithColors < leaveTypesBreakdown.length) {
      recommendations.push('Some leave types are missing color mappings - update getLeaveTypeColor function');
    }
    if (recordsWithInvalidDates > 0) {
      recommendations.push(`${recordsWithInvalidDates} records have invalid date-only fields - verify SharePoint configuration`);
    }
    if (recordsWithInvalidTime > 0) {
      recommendations.push(`${recordsWithInvalidTime} records have invalid numeric time fields - verify data integrity`);
    }
    if (qualityScore < 80) {
      recommendations.push('Overall leave types data quality is below 80% - review v5.0 configuration');
    }

    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: SUMMARY COMPLETED WITH DATE-ONLY + NUMERIC FIELDS:`, {
      totalLeaveRecords,
      uniqueLeaveTypes: leaveTypesBreakdown.length,
      qualityScore,
      recordsWithValidDates,
      recordsWithInvalidDates,
      recordsWithValidTime,
      recordsWithInvalidTime,
      zeroTimeRecords,
      dateRangeSpanDays
    });

    return {
      totalLeaveRecords,
      uniqueLeaveTypes: leaveTypesBreakdown.length,
      leaveTypesBreakdown,
      dateOnlyStatistics: {
        recordsWithValidDates,
        recordsWithInvalidDates,
        dateRangeSpanDays
      },
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
   * ОБНОВЛЕНО v5.0: Получает статистику по использованию типов отпусков
   * Date-only: Usage pattern analysis with date-only + numeric fields support
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
    dateOnlyAnalysis: {
      validDateRecords: number;
      invalidDateRecords: number;
      dateValidationRate: number;
    };
    numericFieldsAnalysis: {
      validTimeRecords: number;
      invalidTimeRecords: number;
      timeValidationRate: number;
    };
  } {
    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: ANALYZING USAGE STATISTICS WITH DATE-ONLY + NUMERIC FIELDS`);
    
    const totalRecords = records.length;
    let recordsWithLeave = 0;
    let workDaysWithLeave = 0;
    let nonWorkDaysWithLeave = 0;
    let mixedUsage = 0;
    
    // *** НОВОЕ v5.0: Анализ date-only + числовых полей ***
    let validDateRecords = 0;
    let invalidDateRecords = 0;
    let validTimeRecords = 0;
    let invalidTimeRecords = 0;

    const leaveUsageMap = new Map<string, { id: string; title?: string; count: number }>();

    records.forEach(record => {
      // *** НОВОЕ v5.0: Валидация date-only + числовых полей времени ***
      const timeData = this.extractTimeFromRecord(record);
      
      if (!isNaN(timeData.recordDate.getTime())) {
        validDateRecords++;
      } else {
        invalidDateRecords++;
      }
      
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

        // *** ОБНОВЛЕНО v5.0: Анализируем паттерн использования через числовые поля ***
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
    const dateValidationRate = totalRecords > 0 ? Math.round((validDateRecords / totalRecords) * 100) : 0;
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

    console.log(`[TimetableDataProcessorLeaveTypes] v5.0: USAGE STATISTICS COMPLETED WITH DATE-ONLY + NUMERIC FIELDS:`, {
      totalRecords,
      recordsWithLeave,
      leaveUsagePercentage,
      dateValidationRate,
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
      dateOnlyAnalysis: {
        validDateRecords,
        invalidDateRecords,
        dateValidationRate
      },
      numericFieldsAnalysis: {
        validTimeRecords,
        invalidTimeRecords,
        timeValidationRate
      }
    };
  }
}