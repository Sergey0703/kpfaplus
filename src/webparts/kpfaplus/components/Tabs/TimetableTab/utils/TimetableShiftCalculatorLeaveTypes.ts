// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypes.ts
import { 
  IShiftInfo, 
  //TIMETABLE_COLORS, 
  //ColorPriority, 
  IDayColorAnalysis,
  IDayInfo
} from '../interfaces/TimetableInterfaces';

// Импортируем разделенные модули
import { TimetableShiftCalculatorLeaveTypesCore } from './TimetableShiftCalculatorLeaveTypesCore';
import { TimetableShiftCalculatorLeaveTypesExcel } from './TimetableShiftCalculatorLeaveTypesExcel';
import { TimetableShiftCalculatorLeaveTypesUtils } from './TimetableShiftCalculatorLeaveTypesUtils';

/**
 * ГЛАВНЫЙ API для работы с типами отпусков, праздниками и цветовыми схемами
 * Делегирует функции соответствующим специализированным модулям
 * Версия 3.2 - Модульная архитектура с полной поддержкой праздников
 * 
 * Этот файл служит как главный API и сохраняет обратную совместимость:
 * - TimetableShiftCalculatorLeaveTypesCore: Основная логика цветов и приоритетов
 * - TimetableShiftCalculatorLeaveTypesExcel: Специализация для Excel экспорта
 * - TimetableShiftCalculatorLeaveTypesUtils: Утилиты, статистика и форматирование
 */
export class TimetableShiftCalculatorLeaveTypes {

  // *** ДЕЛЕГИРОВАНИЕ К CORE МОДУЛЮ (ОСНОВНАЯ ЛОГИКА) ***

  /**
   * ГЛАВНЫЙ МЕТОД: Определяет финальный цвет ячейки с учетом приоритетов
   */
  public static resolveCellColor(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IDayColorAnalysis {
    return TimetableShiftCalculatorLeaveTypesCore.resolveCellColor(shifts, getLeaveTypeColor);
  }

  /**
   * Получает доминирующий цвет отпуска для дня
   */
  public static getDominantLeaveColor(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): string | undefined {
    return TimetableShiftCalculatorLeaveTypesCore.getDominantLeaveColor(shifts, getLeaveTypeColor);
  }

  /**
   * Получает все уникальные типы отпусков из смен
   */
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesCore.getUniqueLeaveTypes> {
    return TimetableShiftCalculatorLeaveTypesCore.getUniqueLeaveTypes(shifts);
  }

  /**
   * Проверяет, есть ли в сменах отпуска
   */
  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return TimetableShiftCalculatorLeaveTypesCore.hasLeaveTypes(shifts);
  }

  /**
   * Проверяет, есть ли в сменах праздники
   */
  public static hasHolidays(shifts: IShiftInfo[]): boolean {
    return TimetableShiftCalculatorLeaveTypesCore.hasHolidays(shifts);
  }

  /**
   * Получает статистику по праздникам и отпускам
   */
  public static getHolidayAndLeaveStatistics(shifts: IShiftInfo[]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesCore.getHolidayAndLeaveStatistics> {
    return TimetableShiftCalculatorLeaveTypesCore.getHolidayAndLeaveStatistics(shifts);
  }

  /**
   * Создает CSS стили для ячейки с системой приоритетов
   */
  public static createCellStyles(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): ReturnType<typeof TimetableShiftCalculatorLeaveTypesCore.createCellStyles> {
    return TimetableShiftCalculatorLeaveTypesCore.createCellStyles(shifts, getLeaveTypeColor);
  }

  /**
   * Проверяет контрастность цвета для читаемости текста
   */
  public static getTextColorForBackground(backgroundColor: string): string {
    return TimetableShiftCalculatorLeaveTypesCore.getTextColorForBackground(backgroundColor);
  }

  // *** ДЕЛЕГИРОВАНИЕ К EXCEL МОДУЛЮ (СПЕЦИАЛИЗАЦИЯ ДЛЯ EXCEL) ***

  /**
   * Создает стили ячейки специально для Excel экспорта
   */
  public static createExcelCellStyles(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    dayData?: IDayInfo
  ): ReturnType<typeof TimetableShiftCalculatorLeaveTypesExcel.createExcelCellStyles> {
    return TimetableShiftCalculatorLeaveTypesExcel.createExcelCellStyles(shifts, getLeaveTypeColor, dayData);
  }

  /**
   * Анализирует день для Excel экспорта включая отметки без смен
   */
  public static analyzeExcelDayData(
    shifts: IShiftInfo[],
    dayData?: IDayInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): ReturnType<typeof TimetableShiftCalculatorLeaveTypesExcel.analyzeExcelDayData> {
    return TimetableShiftCalculatorLeaveTypesExcel.analyzeExcelDayData(shifts, dayData, getLeaveTypeColor);
  }

  /**
   * Получает статистику по Excel экспорту
   */
  public static getExcelExportStatistics(weeksData: Parameters<typeof TimetableShiftCalculatorLeaveTypesExcel.getExcelExportStatistics>[0]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesExcel.getExcelExportStatistics> {
    return TimetableShiftCalculatorLeaveTypesExcel.getExcelExportStatistics(weeksData);
  }

  /**
   * Создает сводку по цветам для Excel экспорта
   */
  public static createExcelColorLegend(weeksData: Parameters<typeof TimetableShiftCalculatorLeaveTypesExcel.createExcelColorLegend>[0], typesOfLeave?: Parameters<typeof TimetableShiftCalculatorLeaveTypesExcel.createExcelColorLegend>[1]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesExcel.createExcelColorLegend> {
    return TimetableShiftCalculatorLeaveTypesExcel.createExcelColorLegend(weeksData, typesOfLeave);
  }

  // *** ДЕЛЕГИРОВАНИЕ К UTILS МОДУЛЮ (УТИЛИТЫ И СТАТИСТИКА) ***

  /**
   * Форматирует информацию о типах отпусков в дне
   */
  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    return TimetableShiftCalculatorLeaveTypesUtils.formatLeaveInfo(shifts);
  }

  /**
   * Получает цвет для первого праздника (высший приоритет)
   */
  public static getFirstHolidayColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypesUtils.getFirstHolidayColor(shifts);
  }

  /**
   * Получает цвет для первого типа отпуска (только если нет праздников)
   */
  public static getFirstLeaveColor(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypesUtils.getFirstLeaveColor(shifts);
  }

  /**
   * Проверяет, содержит ли день праздник
   */
  public static hasSpecificHoliday(shifts: IShiftInfo[]): boolean {
    return TimetableShiftCalculatorLeaveTypesUtils.hasSpecificHoliday(shifts);
  }

  /**
   * Проверяет, содержит ли день определенный тип отпуска
   */
  public static hasSpecificLeaveType(shifts: IShiftInfo[], leaveTypeId: string): boolean {
    return TimetableShiftCalculatorLeaveTypesUtils.hasSpecificLeaveType(shifts, leaveTypeId);
  }

  /**
   * Получает все цвета в дне с учетом приоритетов
   */
  public static getAllColorsWithPriority(shifts: IShiftInfo[]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesUtils.getAllColorsWithPriority> {
    return TimetableShiftCalculatorLeaveTypesUtils.getAllColorsWithPriority(shifts);
  }

  /**
   * Получает все цвета отпусков в дне (для совместимости)
   */
  public static getAllLeaveColors(shifts: IShiftInfo[]): string[] {
    return TimetableShiftCalculatorLeaveTypesUtils.getAllLeaveColors(shifts);
  }

  /**
   * Создает градиент из нескольких цветов отпусков
   */
  public static createLeaveColorsGradient(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypesUtils.createLeaveColorsGradient(shifts);
  }

  /**
   * Получает статистику по типам отпусков для группы смен
   */
  public static getLeaveTypesStatistics(shifts: IShiftInfo[]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesUtils.getLeaveTypesStatistics> {
    return TimetableShiftCalculatorLeaveTypesUtils.getLeaveTypesStatistics(shifts);
  }

  /**
   * Применяет цветовую схему к списку смен
   */
  public static applyColorSchemeToShifts(shifts: IShiftInfo[]): ReturnType<typeof TimetableShiftCalculatorLeaveTypesUtils.applyColorSchemeToShifts> {
    return TimetableShiftCalculatorLeaveTypesUtils.applyColorSchemeToShifts(shifts);
  }

  /**
   * Проверяет корректность конфигурации цветов
   */
  public static validateColorConfiguration(
    shifts: IShiftInfo[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): ReturnType<typeof TimetableShiftCalculatorLeaveTypesUtils.validateColorConfiguration> {
    return TimetableShiftCalculatorLeaveTypesUtils.validateColorConfiguration(shifts, getLeaveTypeColor);
  }

  // *** УСТАРЕВШИЕ МЕТОДЫ ДЛЯ СОВМЕСТИМОСТИ ***

  /**
   * @deprecated Используйте createCellStyles вместо этого метода
   */
  public static createLeaveCellStyles(shifts: IShiftInfo[]): Omit<ReturnType<typeof TimetableShiftCalculatorLeaveTypesCore.createCellStyles>, 'priority' | 'reason'> {
    const newStyles = this.createCellStyles(shifts);
    // Убираем новые поля для совместимости
    const { priority: _priority, reason: _reason, ...compatibleStyles } = newStyles;
    return compatibleStyles;
  }

  /**
   * @deprecated Используйте getDominantLeaveColor с getLeaveTypeColor функцией
   */
  public static getDominantLeaveColorLegacy(shifts: IShiftInfo[]): string | undefined {
    return TimetableShiftCalculatorLeaveTypesCore.getDominantLeaveColor(shifts);
  }

  // *** ИНФОРМАЦИЯ О МОДУЛЬНОЙ АРХИТЕКТУРЕ ***

  /**
   * Получает информацию о модульной структуре
   */
  public static getModuleInfo(): {
    mainModule: string;
    coreModule: string;
    excelModule: string;
    utilsModule: string;
    totalMethods: number;
    architecture: string;
    version: string;
  } {
    return {
      mainModule: 'TimetableShiftCalculatorLeaveTypes (Main API)',
      coreModule: 'TimetableShiftCalculatorLeaveTypesCore (Core logic)',
      excelModule: 'TimetableShiftCalculatorLeaveTypesExcel (Excel export)',
      utilsModule: 'TimetableShiftCalculatorLeaveTypesUtils (Utils & stats)',
      totalMethods: Object.getOwnPropertyNames(TimetableShiftCalculatorLeaveTypes)
        .filter(name => typeof TimetableShiftCalculatorLeaveTypes[name as keyof typeof TimetableShiftCalculatorLeaveTypes] === 'function')
        .length,
      architecture: 'Modular delegation pattern v3.2',
      version: '3.2'
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
        name: 'TimetableShiftCalculatorLeaveTypesCore',
        available: !!TimetableShiftCalculatorLeaveTypesCore,
        methods: Object.getOwnPropertyNames(TimetableShiftCalculatorLeaveTypesCore)
          .filter(name => typeof TimetableShiftCalculatorLeaveTypesCore[name as keyof typeof TimetableShiftCalculatorLeaveTypesCore] === 'function')
          .length
      },
      {
        name: 'TimetableShiftCalculatorLeaveTypesExcel',
        available: !!TimetableShiftCalculatorLeaveTypesExcel,
        methods: Object.getOwnPropertyNames(TimetableShiftCalculatorLeaveTypesExcel)
          .filter(name => typeof TimetableShiftCalculatorLeaveTypesExcel[name as keyof typeof TimetableShiftCalculatorLeaveTypesExcel] === 'function')
          .length
      },
      {
        name: 'TimetableShiftCalculatorLeaveTypesUtils',
        available: !!TimetableShiftCalculatorLeaveTypesUtils,
        methods: Object.getOwnPropertyNames(TimetableShiftCalculatorLeaveTypesUtils)
          .filter(name => typeof TimetableShiftCalculatorLeaveTypesUtils[name as keyof typeof TimetableShiftCalculatorLeaveTypesUtils] === 'function')
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
      issues.push('All modules are properly loaded and functional with Holiday support v3.2');
    }

    return {
      isValid,
      modules,
      issues
    };
  }

  /**
   * Получает информацию о возможностях системы
   */
  public static getCapabilities(): ReturnType<typeof TimetableShiftCalculatorLeaveTypesUtils.getCapabilities> {
    return TimetableShiftCalculatorLeaveTypesUtils.getCapabilities();
  }

  // *** СТАТИЧЕСКИЕ МЕТОДЫ ДЛЯ БЫСТРОГО ДОСТУПА ***

  /**
   * Быстрый доступ к Core модулю
   */
  public static get Core() {
    return TimetableShiftCalculatorLeaveTypesCore;
  }

  /**
   * Быстрый доступ к Excel модулю
   */
  public static get Excel() {
    return TimetableShiftCalculatorLeaveTypesExcel;
  }

  /**
   * Быстрый доступ к Utils модулю
   */
  public static get Utils() {
    return TimetableShiftCalculatorLeaveTypesUtils;
  }
}