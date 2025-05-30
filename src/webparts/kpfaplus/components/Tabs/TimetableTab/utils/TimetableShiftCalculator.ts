// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculator.ts
import { 
  IShiftCalculationParams, 
  IShiftCalculationResult, 
  IShiftInfo,
  ColorPriority
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

// Импортируем разделенные модули
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';
import { TimetableShiftCalculatorUtils } from './TimetableShiftCalculatorUtils';
import { TimetableShiftCalculatorLeaveTypes } from './TimetableShiftCalculatorLeaveTypes';

/**
 * Главный калькулятор смен и рабочего времени
 * Реплицирует логику из Power Apps формул FormatDayShifts, CalculateDayMinutes и др.
 * ОБНОВЛЕНО: Версия 3.6 - Поддержка цветов отпусков с правильной передачей функций
 * РАЗДЕЛЕНО: На три модуля для лучшей организации кода
 * 
 * Этот файл служит как главный API и делегирует функции соответствующим модулям:
 * - TimetableShiftCalculatorCore: Основные расчеты смен
 * - TimetableShiftCalculatorUtils: Утилиты и валидация
 * - TimetableShiftCalculatorLeaveTypes: Работа с типами отпусков
 */
export class TimetableShiftCalculator {

  // *** ДЕЛЕГИРОВАНИЕ К CORE МОДУЛЮ ***

  /**
   * Рассчитывает рабочие минуты для одной смены
   */
  public static calculateShiftMinutes(params: IShiftCalculationParams): IShiftCalculationResult {
    return TimetableShiftCalculatorCore.calculateShiftMinutes(params);
  }

  /**
   * Форматирует минуты в формат HH:MM для смен
   */
  public static formatMinutesToHoursMinutes(totalMinutes: number): string {
    return TimetableShiftCalculatorCore.formatMinutesToHoursMinutes(totalMinutes);
  }

  /**
   * Обрабатывает записи StaffRecord в IShiftInfo
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    return TimetableShiftCalculatorCore.processStaffRecordsToShifts(records, getLeaveTypeColor);
  }

  /**
   * Форматирует содержимое дня
   */
  public static formatDayContent(shifts: IShiftInfo[]): string {
    return TimetableShiftCalculatorCore.formatDayContent(shifts);
  }

  /**
   * Рассчитывает недельные часы для сотрудника
   */
  public static calculateWeeklyHours(
    allShifts: IShiftInfo[]
  ): { totalMinutes: number; formattedTotal: string } {
    return TimetableShiftCalculatorCore.calculateWeeklyHours(allShifts);
  }

  /**
   * Форматирует минуты в часы и минуты (для TOTAL)
   */
  public static formatMinutesToHours(totalMinutes: number): string {
    return TimetableShiftCalculatorCore.formatMinutesToHours(totalMinutes);
  }

  /**
   * Форматирует время в формате HH:mm
   */
  public static formatTime(date: Date): string {
    return TimetableShiftCalculatorCore.formatTime(date);
  }

  /**
   * Форматирует время в формате HH:mm:ss
   */
  public static formatTimeWithSeconds(date: Date): string {
    return TimetableShiftCalculatorCore.formatTimeWithSeconds(date);
  }

  /**
   * Получает все смены для конкретного дня недели из записей
   */
  public static getShiftsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    return TimetableShiftCalculatorCore.getShiftsForDay(
      records, dayNumber, weekStart, weekEnd, getLeaveTypeColor
    );
  }

  /**
   * Получает номер дня недели для даты
   */
  public static getDayNumber(date: Date): number {
    return TimetableShiftCalculatorCore.getDayNumber(date);
  }

  /**
   * Получает название дня недели по номеру
   */
  public static getDayName(dayNumber: number): string {
    return TimetableShiftCalculatorCore.getDayName(dayNumber);
  }

  // *** ДЕЛЕГИРОВАНИЕ К UTILS МОДУЛЮ ***

  /**
   * Парсит строку времени в формате HH:mm в минуты
   */
  public static parseTimeStringToMinutes(timeString: string): number {
    return TimetableShiftCalculatorUtils.parseTimeStringToMinutes(timeString);
  }

  /**
   * Создает дату с заданным временем для конкретного дня
   */
  public static createTimeForDate(baseDate: Date, hours: number, minutes: number): Date {
    return TimetableShiftCalculatorUtils.createTimeForDate(baseDate, hours, minutes);
  }

  /**
   * Проверяет, является ли время нулевым (00:00)
   */
  public static isTimeZero(date: Date): boolean {
    return TimetableShiftCalculatorUtils.isTimeZero(date);
  }

  /**
   * Проверяет, является ли время валидным рабочим временем
   */
  public static isValidWorkTime(startTime: Date, endTime: Date): boolean {
    return TimetableShiftCalculatorUtils.isValidWorkTime(startTime, endTime);
  }

  /**
   * Вычисляет продолжительность между двумя временами в минутах
   */
  public static calculateDurationMinutes(startTime: Date, endTime: Date): number {
    return TimetableShiftCalculatorUtils.calculateDurationMinutes(startTime, endTime);
  }

  /**
   * Форматирует продолжительность в удобочитаемый формат
   */
  public static formatDuration(minutes: number): string {
    return TimetableShiftCalculatorUtils.formatDuration(minutes);
  }

  /**
   * Получает статистику по сменам
   */
  public static getShiftsStatistics(shifts: IShiftInfo[]): {
    totalShifts: number;
    totalWorkMinutes: number;
    averageShiftMinutes: number;
    shortestShiftMinutes: number;
    longestShiftMinutes: number;
    formattedStatistics: string;
    shiftsWithLeave: number;
    leaveTypes: string[];
  } {
    return TimetableShiftCalculatorUtils.getShiftsStatistics(shifts);
  }

  /**
   * Проверяет, пересекаются ли две смены по времени
   */
  public static doShiftsOverlap(shift1: IShiftInfo, shift2: IShiftInfo): boolean {
    return TimetableShiftCalculatorUtils.doShiftsOverlap(shift1, shift2);
  }

  /**
   * Находит пересекающиеся смены в списке
   */
  public static findOverlappingShifts(shifts: IShiftInfo[]): IShiftInfo[][] {
    return TimetableShiftCalculatorUtils.findOverlappingShifts(shifts);
  }

  /**
   * Конвертирует минуты в десятичные часы
   */
  public static minutesToDecimalHours(minutes: number): number {
    return TimetableShiftCalculatorUtils.minutesToDecimalHours(minutes);
  }

  /**
   * Конвертирует десятичные часы в минуты
   */
  public static decimalHoursToMinutes(hours: number): number {
    return TimetableShiftCalculatorUtils.decimalHoursToMinutes(hours);
  }

  /**
   * Форматирует время в 12-часовом формате (AM/PM)
   */
  public static formatTime12Hour(date: Date): string {
    return TimetableShiftCalculatorUtils.formatTime12Hour(date);
  }

  // *** ДЕЛЕГИРОВАНИЕ К LEAVE TYPES МОДУЛЮ ***

  /**
   * Получает все уникальные типы отпусков из смен
   */
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): Array<{
    id: string;
    title: string;
    color: string;
    count: number;
  }> {
    return TimetableShiftCalculatorLeaveTypes.getUniqueLeaveTypes(shifts);
  }

  /**
   * Проверяет, есть ли в сменах отпуска
   */
  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return TimetableShiftCalculatorLeaveTypes.hasLeaveTypes(shifts);
  }

  /**
   * Проверяет, есть ли в сменах праздники
   */
  public static hasHolidays(shifts: IShiftInfo[]): boolean {
    return TimetableShiftCalculatorLeaveTypes.hasHolidays(shifts);
  }

  /**
   * ИСПРАВЛЕННЫЙ МЕТОД v3.6: Получает доминирующий цвет отпуска для дня (устаревший - без функции)
   * @deprecated Используйте getDominantLeaveColorWithFunction для передачи функции getLeaveTypeColor
   */
  public static getDominantLeaveColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypes.getDominantLeaveColor(shifts);
  }

  /**
   * НОВЫЙ МЕТОД v3.6: Получает доминирующий цвет отпуска с функцией getLeaveTypeColor
   */
  public static getDominantLeaveColorWithFunction(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): string | undefined {
    return TimetableShiftCalculatorLeaveTypes.getDominantLeaveColor(shifts, getLeaveTypeColor);
  }

  /**
   * Форматирует информацию о типах отпусков в дне
   */
  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    return TimetableShiftCalculatorLeaveTypes.formatLeaveInfo(shifts);
  }

  /**
   * Получает цвет для первого типа отпуска в списке смен
   */
  public static getFirstLeaveColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypes.getFirstLeaveColor(shifts);
  }

  /**
   * Проверяет, содержит ли день определенный тип отпуска
   */
  public static hasSpecificLeaveType(shifts: IShiftInfo[], leaveTypeId: string): boolean {
    return TimetableShiftCalculatorLeaveTypes.hasSpecificLeaveType(shifts, leaveTypeId);
  }

  /**
   * Получает все цвета отпусков в дне
   */
  public static getAllLeaveColors(shifts: IShiftInfo[]): string[] {
    return TimetableShiftCalculatorLeaveTypes.getAllLeaveColors(shifts);
  }

  /**
   * Создает градиент из нескольких цветов отпусков
   */
  public static createLeaveColorsGradient(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypes.createLeaveColorsGradient(shifts);
  }

  /**
   * Получает статистику по типам отпусков для группы смен
   */
  public static getLeaveTypesStatistics(shifts: IShiftInfo[]): {
    totalShiftsWithLeave: number;
    uniqueLeaveTypes: number;
    leaveTypeBreakdown: Array<{
      id: string;
      title: string;
      color: string;
      count: number;
      percentage: number;
    }>;
    mostCommonLeaveType?: {
      id: string;
      title: string;
      color: string;
      count: number;
    };
  } {
    return TimetableShiftCalculatorLeaveTypes.getLeaveTypesStatistics(shifts);
  }

  /**
   * Применяет цветовую схему к списку смен
   */
  public static applyColorSchemeToShifts(shifts: IShiftInfo[]): Array<IShiftInfo & { 
    colorScheme: {
      backgroundColor: string;
      textColor: string;
      borderColor: string;
    } 
  }> {
    return TimetableShiftCalculatorLeaveTypes.applyColorSchemeToShifts(shifts);
  }

  /**
   * Проверяет контрастность цвета для читаемости текста
   */
  public static getTextColorForBackground(backgroundColor: string): string {
    return TimetableShiftCalculatorLeaveTypes.getTextColorForBackground(backgroundColor);
  }

  /**
   * Создает CSS стили для ячейки с отпуском
   */
  public static createLeaveCellStyles(shifts: IShiftInfo[]): {
    backgroundColor?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
    textShadow?: string;
  } {
    return TimetableShiftCalculatorLeaveTypes.createLeaveCellStyles(shifts);
  }

  // *** НОВЫЕ МЕТОДЫ v3.6 ДЛЯ УЛУЧШЕННОЙ ПОДДЕРЖКИ ФУНКЦИЙ ***

  /**
   * НОВЫЙ МЕТОД v3.6: Получает доминирующий цвет с улучшенной поддержкой функции
   * Этот метод автоматически определяет, какую версию использовать
   */
  public static getDominantLeaveColorSmart(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): string | undefined {
    if (getLeaveTypeColor) {
      console.log('[TimetableShiftCalculator] *** v3.6: Using getDominantLeaveColorWithFunction ***');
      return this.getDominantLeaveColorWithFunction(shifts, getLeaveTypeColor);
    } else {
      console.log('[TimetableShiftCalculator] *** v3.6: Using legacy getDominantLeaveColor ***');
      return this.getDominantLeaveColor(shifts);
    }
  }

  /**
   * НОВЫЙ МЕТОД v3.6: Создает стили ячейки с улучшенной поддержкой функции
   */
  public static createCellStylesWithFunction(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    backgroundColor?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
    textShadow?: string;
    priority?: string;
    reason?: string;
  } {
    console.log('[TimetableShiftCalculator] *** v3.6: Creating cell styles with function support ***');
    const result = TimetableShiftCalculatorLeaveTypes.createCellStyles(shifts, getLeaveTypeColor);
    
    // Конвертируем ColorPriority enum в string для совместимости
    let priorityString: string | undefined = undefined;
    if (result.priority !== undefined) {
      // Простая конвертация enum в строку
      switch (result.priority) {
        case ColorPriority.HOLIDAY:
          priorityString = 'HOLIDAY';
          break;
        case ColorPriority.LEAVE_TYPE:
          priorityString = 'LEAVE_TYPE';
          break;
        case ColorPriority.DEFAULT:
          priorityString = 'DEFAULT';
          break;
        default:
          priorityString = 'UNKNOWN';
          break;
      }
    }
    
    return {
      backgroundColor: result.backgroundColor,
      color: result.color,
      border: result.border,
      borderRadius: result.borderRadius,
      textShadow: result.textShadow,
      priority: priorityString,
      reason: result.reason
    };
  }

  /**
   * НОВЫЙ МЕТОД v3.6: Анализирует смены с полной поддержкой функций
   */
  public static analyzeShiftsWithFunction(
    shifts: IShiftInfo[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasWorkShifts: boolean;
    hasLeaveShifts: boolean;
    hasHolidayShifts: boolean;
    dominantColor?: string;
    leaveTypesCount: number;
    holidayTypesCount: number;
    totalWorkMinutes: number;
    analysis: string;
  } {
    const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasLeaveShifts = shifts.some(s => s.typeOfLeaveId);
    const hasHolidayShifts = shifts.some(s => s.isHoliday);
    const dominantColor = this.getDominantLeaveColorSmart(shifts, getLeaveTypeColor);
    const leaveTypes = this.getUniqueLeaveTypes(shifts);
    const totalWorkMinutes = shifts.reduce((sum, s) => sum + s.workMinutes, 0);

    let analysis = 'No special markers';
    if (hasHolidayShifts && hasLeaveShifts) {
      analysis = 'Mixed: Holiday priority overrides leave types';
    } else if (hasHolidayShifts) {
      analysis = 'Holiday shifts detected';
    } else if (hasLeaveShifts) {
      analysis = `Leave shifts: ${leaveTypes.length} unique type(s)`;
    }

    console.log('[TimetableShiftCalculator] *** v3.6: Shift analysis completed ***', {
      hasWorkShifts,
      hasLeaveShifts,
      hasHolidayShifts,
      dominantColor,
      analysis
    });

    return {
      hasWorkShifts,
      hasLeaveShifts,
      hasHolidayShifts,
      dominantColor,
      leaveTypesCount: leaveTypes.length,
      holidayTypesCount: hasHolidayShifts ? 1 : 0,
      totalWorkMinutes,
      analysis
    };
  }

  // *** ИНФОРМАЦИЯ О МОДУЛЬНОЙ АРХИТЕКТУРЕ ***

  /**
   * Получает информацию о модульной структуре калькулятора
   */
  public static getModuleInfo(): {
    mainModule: string;
    coreModule: string;
    utilsModule: string;
    leaveTypesModule: string;
    totalMethods: number;
    architecture: string;
    version: string;
  } {
    return {
      mainModule: 'TimetableShiftCalculator (Main API)',
      coreModule: 'TimetableShiftCalculatorCore (Core calculations)',
      utilsModule: 'TimetableShiftCalculatorUtils (Utilities & validation)',
      leaveTypesModule: 'TimetableShiftCalculatorLeaveTypes (Leave types & colors)',
      totalMethods: Object.getOwnPropertyNames(TimetableShiftCalculator)
        .filter(name => typeof TimetableShiftCalculator[name as keyof typeof TimetableShiftCalculator] === 'function')
        .length,
      architecture: 'Modular delegation pattern v3.6',
      version: '3.6'
    };
  }

  /**
   * Проверяет доступность всех модулей
   */
  public static validateModules(): {
    isValid: boolean;
    modules: Array<{
      name: string;
      available: boolean;
      methods: number;
    }>;
    issues: string[];
    version: string;
  } {
    const modules = [
      {
        name: 'TimetableShiftCalculatorCore',
        available: !!TimetableShiftCalculatorCore,
        methods: Object.getOwnPropertyNames(TimetableShiftCalculatorCore)
          .filter(name => typeof TimetableShiftCalculatorCore[name as keyof typeof TimetableShiftCalculatorCore] === 'function')
          .length
      },
      {
        name: 'TimetableShiftCalculatorUtils',
        available: !!TimetableShiftCalculatorUtils,
        methods: Object.getOwnPropertyNames(TimetableShiftCalculatorUtils)
          .filter(name => typeof TimetableShiftCalculatorUtils[name as keyof typeof TimetableShiftCalculatorUtils] === 'function')
          .length
      },
      {
        name: 'TimetableShiftCalculatorLeaveTypes',
        available: !!TimetableShiftCalculatorLeaveTypes,
        methods: Object.getOwnPropertyNames(TimetableShiftCalculatorLeaveTypes)
          .filter(name => typeof TimetableShiftCalculatorLeaveTypes[name as keyof typeof TimetableShiftCalculatorLeaveTypes] === 'function')
          .length
      }
    ];

    const issues: string[] = [];
    let isValid = true;

    modules.forEach(module => {
      if (!module.available) {
        issues.push(`Module ${module.name} is not available`);
        isValid = false;
      }
      if (module.methods === 0) {
        issues.push(`Module ${module.name} has no public methods`);
        isValid = false;
      }
    });

    if (isValid) {
      issues.push('All modules are properly loaded and functional with Holiday support v3.6');
      issues.push('New v3.6 features: Enhanced function parameter support, smart color resolution');
    }

    return {
      isValid,
      modules,
      issues,
      version: '3.6'
    };
  }

  // *** МЕТОДЫ ДЛЯ ОТЛАДКИ И ДИАГНОСТИКИ v3.6 ***

  /**
   * НОВЫЙ МЕТОД v3.6: Диагностика обработки смен
   */
  public static diagnoseShiftProcessing(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    inputRecords: number;
    validRecords: number;
    invalidRecords: number;
    recordsWithLeave: number;
    recordsWithHoliday: number;
    recordsWithBoth: number;
    processedShifts: number;
    shiftsWithColors: number;
    shiftsWithTitles: number;
    hasColorFunction: boolean;
    colorResolutionRate: number;
    issues: string[];
    recommendations: string[];
  } {
    const inputRecords = records.length;
    let validRecords = 0;
    let invalidRecords = 0;
    let recordsWithLeave = 0;
    let recordsWithHoliday = 0;
    let recordsWithBoth = 0;

    records.forEach(record => {
      const isValid = record.ShiftDate1 && record.ShiftDate2;
      if (isValid) {
        validRecords++;
      } else {
        invalidRecords++;
      }

      if (record.TypeOfLeaveID) recordsWithLeave++;
      if (record.Holiday === 1) recordsWithHoliday++;
      if (record.TypeOfLeaveID && record.Holiday === 1) recordsWithBoth++;
    });

    const processedShifts = this.processStaffRecordsToShifts(records, getLeaveTypeColor);
    const shiftsWithColors = processedShifts.filter(s => s.typeOfLeaveColor || s.holidayColor).length;
    const shiftsWithTitles = processedShifts.filter(s => s.typeOfLeaveTitle).length;
    const colorResolutionRate = recordsWithLeave > 0 ? 
      Math.round((shiftsWithColors / recordsWithLeave) * 100) : 0;

    const issues: string[] = [];
    const recommendations: string[] = [];

    if (invalidRecords > 0) {
      issues.push(`${invalidRecords} records have invalid shift dates`);
    }
    if (recordsWithLeave > 0 && !getLeaveTypeColor) {
      issues.push('Leave records found but no color function provided');
      recommendations.push('Provide getLeaveTypeColor function for proper color resolution');
    }
    if (colorResolutionRate < 50) {
      issues.push(`Low color resolution rate: ${colorResolutionRate}%`);
      recommendations.push('Check TypeOfLeave configuration and color mappings');
    }
    if (shiftsWithTitles < recordsWithLeave) {
      issues.push(`Some leave records missing titles: ${recordsWithLeave - shiftsWithTitles}`);
      recommendations.push('Ensure TypeOfLeave objects have Title field populated');
    }

    return {
      inputRecords,
      validRecords,
      invalidRecords,
      recordsWithLeave,
      recordsWithHoliday,
      recordsWithBoth,
      processedShifts: processedShifts.length,
      shiftsWithColors,
      shiftsWithTitles,
      hasColorFunction: !!getLeaveTypeColor,
      colorResolutionRate,
      issues,
      recommendations
    };
  }

  /**
   * НОВЫЙ МЕТОД v3.6: Получает сводку возможностей системы
   */
  public static getCapabilitiesSummary(): {
    version: string;
    coreFeatures: string[];
    leaveTypeFeatures: string[];
    holidayFeatures: string[];
    newInV36: string[];
    supportedFormats: string[];
    compatibilityLevel: string;
  } {
    return {
      version: '3.6',
      coreFeatures: [
        'Shift time calculations with lunch breaks',
        'Multiple shift formats (HH:MM and Hh MMm)',
        'Work minutes calculation',
        'Weekly hours summation',
        'Shift validation and error handling'
      ],
      leaveTypeFeatures: [
        'Leave type color resolution',
        'Dominant color calculation',
        'Leave type statistics',
        'Custom color schemes',
        'Color contrast optimization'
      ],
      holidayFeatures: [
        'Holiday priority system (red color)',
        'Holiday override of leave types',
        'Holiday statistics tracking',
        'Mixed holiday/leave handling'
      ],
      newInV36: [
        'Enhanced function parameter support',
        'Smart color resolution methods',
        'Improved diagnostics and validation',
        'Better error handling for missing functions',
        'Enhanced shift analysis capabilities'
      ],
      supportedFormats: [
        'Power Apps time format replication',
        'Excel export compatibility',
        'UI display optimization',
        'Multiple shift display modes'
      ],
      compatibilityLevel: 'Full backward compatibility with v2.x, v3.0-3.5'
    };
  }
}