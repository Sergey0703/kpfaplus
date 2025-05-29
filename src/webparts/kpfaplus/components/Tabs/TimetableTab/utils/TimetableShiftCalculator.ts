// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculator.ts
import { 
  IShiftCalculationParams, 
  IShiftCalculationResult, 
  IShiftInfo 
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

// Импортируем разделенные модули
import { TimetableShiftCalculatorCore } from './TimetableShiftCalculatorCore';
import { TimetableShiftCalculatorUtils } from './TimetableShiftCalculatorUtils';
import { TimetableShiftCalculatorLeaveTypes } from './TimetableShiftCalculatorLeaveTypes';

/**
 * Главный калькулятор смен и рабочего времени
 * Реплицирует логику из Power Apps формул FormatDayShifts, CalculateDayMinutes и др.
 * ОБНОВЛЕНО: Поддержка цветов отпусков
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
   * Получает доминирующий цвет отпуска для дня
   */
  public static getDominantLeaveColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypes.getDominantLeaveColor(shifts);
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
  } {
    return {
      mainModule: 'TimetableShiftCalculator (Main API)',
      coreModule: 'TimetableShiftCalculatorCore (Core calculations)',
      utilsModule: 'TimetableShiftCalculatorUtils (Utilities & validation)',
      leaveTypesModule: 'TimetableShiftCalculatorLeaveTypes (Leave types & colors)',
      totalMethods: Object.getOwnPropertyNames(TimetableShiftCalculator)
        .filter(name => typeof TimetableShiftCalculator[name as keyof typeof TimetableShiftCalculator] === 'function')
        .length,
      architecture: 'Modular delegation pattern'
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
      issues.push('All modules are properly loaded and functional');
    }

    return {
      isValid,
      modules,
      issues
    };
  }
}