// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypesUtils.ts
import { 
  IShiftInfo, 
  TIMETABLE_COLORS, 
  ColorPriority
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorLeaveTypesCore } from './TimetableShiftCalculatorLeaveTypesCore';

/**
 * УТИЛИТЫ И СТАТИСТИКА для работы с типами отпусков
 * Содержит вспомогательные методы, форматирование и анализ данных
 * Версия 3.2 - Полная поддержка праздников
 */
export class TimetableShiftCalculatorLeaveTypesUtils {

  // *** ФОРМАТИРОВАНИЕ И ОТОБРАЖЕНИЕ ***

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Форматирует информацию о типах отпусков и праздниках в дне
   */
  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    const holidayShifts = shifts.filter(s => s.isHoliday || false).length;
    const leaveTypes = TimetableShiftCalculatorLeaveTypesCore.getUniqueLeaveTypes(shifts);
    
    const info: string[] = [];
    
    // Сначала праздники (высший приоритет)
    if (holidayShifts > 0) {
      info.push(`🔴 Holiday (${holidayShifts})`);
    }
    
    // Затем отпуска (только если нет праздников или для информации)
    if (leaveTypes.length > 0) {
      if (holidayShifts > 0) {
        info.push(`[Overridden: ${leaveTypes.map(lt => `${lt.title} (${lt.count})`).join(', ')}]`);
      } else {
        info.push(leaveTypes.map(lt => `${lt.title} (${lt.count})`).join(', '));
      }
    }
    
    return info.join(' + ');
  }

  /**
   * НОВЫЙ МЕТОД: Получает цвет для первого праздника (высший приоритет)
   */
  public static getFirstHolidayColor(shifts: IShiftInfo[]): string | undefined {
    const holidayShift = shifts.find(shift => shift.isHoliday || false);
    return holidayShift?.holidayColor;
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Получает цвет для первого типа отпуска (только если нет праздников)
   */
  public static getFirstLeaveColor(shifts: IShiftInfo[]): string | undefined {
    // Проверяем приоритет праздников
    if (TimetableShiftCalculatorLeaveTypesCore.hasHolidays(shifts)) {
      return undefined; // Праздники имеют приоритет
    }
    
    const shiftWithLeave = shifts.find(shift => shift.typeOfLeaveColor);
    return shiftWithLeave?.typeOfLeaveColor;
  }

  /**
   * НОВЫЙ МЕТОД: Проверяет, содержит ли день праздник
   */
  public static hasSpecificHoliday(shifts: IShiftInfo[]): boolean {
    return shifts.some(shift => shift.isHoliday || false);
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Проверяет, содержит ли день определенный тип отпуска
   */
  public static hasSpecificLeaveType(shifts: IShiftInfo[], leaveTypeId: string): boolean {
    return shifts.some(shift => shift.typeOfLeaveId === leaveTypeId);
  }

  // *** ЦВЕТОВЫЕ СХЕМЫ И СТИЛИ ***

  /**
   * НОВЫЙ МЕТОД: Получает все цвета в дне с учетом приоритетов
   */
  public static getAllColorsWithPriority(shifts: IShiftInfo[]): {
    holidayColors: string[];
    leaveColors: string[];
    finalColor: string;
    priorityReason: string;
  } {
    const holidayColors: string[] = [];
    const leaveColors: string[] = [];
    
    shifts.forEach(shift => {
      if ((shift.isHoliday || false) && shift.holidayColor) {
        if (!holidayColors.includes(shift.holidayColor)) {
          holidayColors.push(shift.holidayColor);
        }
      }
      if (shift.typeOfLeaveColor) {
        if (!leaveColors.includes(shift.typeOfLeaveColor)) {
          leaveColors.push(shift.typeOfLeaveColor);
        }
      }
    });
    
    let finalColor = TIMETABLE_COLORS.DEFAULT_BACKGROUND;
    let priorityReason = 'Default';
    
    if (holidayColors.length > 0) {
      finalColor = holidayColors[0]; // Первый праздничный цвет
      priorityReason = `Holiday priority (${holidayColors.length} holiday colors)`;
    } else if (leaveColors.length > 0) {
      finalColor = leaveColors[0]; // Первый цвет отпуска
      priorityReason = `Leave type priority (${leaveColors.length} leave colors)`;
    }
    
    return {
      holidayColors,
      leaveColors,
      finalColor,
      priorityReason
    };
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Получает все цвета отпусков в дне (для совместимости)
   */
  public static getAllLeaveColors(shifts: IShiftInfo[]): string[] {
    const colorsSet = new Set<string>();
    shifts.forEach(shift => {
      if (shift.typeOfLeaveColor) {
        colorsSet.add(shift.typeOfLeaveColor);
      }
    });
    
    const colors: string[] = [];
    colorsSet.forEach(color => colors.push(color));
    return colors;
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Создает градиент с учетом приоритета праздников
   */
  public static createLeaveColorsGradient(shifts: IShiftInfo[]): string | undefined {
    const analysis = this.getAllColorsWithPriority(shifts);
    
    // Если есть праздники - используем только праздничные цвета
    if (analysis.holidayColors.length > 0) {
      if (analysis.holidayColors.length === 1) {
        return analysis.holidayColors[0];
      }
      // Если несколько праздничных цветов, создаем градиент
      const gradientStops = analysis.holidayColors.map((color, index) => {
        const percentage = (index / (analysis.holidayColors.length - 1)) * 100;
        return `${color} ${percentage}%`;
      }).join(', ');
      return `linear-gradient(45deg, ${gradientStops})`;
    }
    
    // Иначе используем цвета отпусков
    const leaveColors = analysis.leaveColors;
    if (leaveColors.length === 0) {
      return undefined;
    }
    
    if (leaveColors.length === 1) {
      return leaveColors[0];
    }
    
    // Создаем CSS градиент для нескольких цветов отпусков
    const gradientStops = leaveColors.map((color, index) => {
      const percentage = (index / (leaveColors.length - 1)) * 100;
      return `${color} ${percentage}%`;
    }).join(', ');
    
    return `linear-gradient(45deg, ${gradientStops})`;
  }

  // *** СТАТИСТИКА И АНАЛИЗ ***

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Получает статистику по типам отпусков с учетом праздников
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
      isOverriddenByHoliday: boolean;
    }>;
    mostCommonLeaveType?: {
      id: string;
      title: string;
      color: string;
      count: number;
    };
    holidayStatistics: {
      totalHolidayShifts: number;
      holidayPercentage: number;
      overridesLeaveTypes: boolean;
    };
  } {
    const leaveTypes = TimetableShiftCalculatorLeaveTypesCore.getUniqueLeaveTypes(shifts);
    const totalShiftsWithLeave = shifts.filter(s => s.typeOfLeaveId).length;
    const totalHolidayShifts = shifts.filter(s => s.isHoliday || false).length;
    
    const leaveTypeBreakdown = leaveTypes.map(lt => ({
      ...lt,
      percentage: totalShiftsWithLeave > 0 ? Math.round((lt.count / totalShiftsWithLeave) * 100) : 0
    }));
    
    const mostCommonLeaveType = leaveTypes.length > 0 ? leaveTypes[0] : undefined;
    
    const holidayPercentage = shifts.length > 0 ? Math.round((totalHolidayShifts / shifts.length) * 100) : 0;
    
    return {
      totalShiftsWithLeave,
      uniqueLeaveTypes: leaveTypes.length,
      leaveTypeBreakdown,
      mostCommonLeaveType,
      holidayStatistics: {
        totalHolidayShifts,
        holidayPercentage,
        overridesLeaveTypes: totalHolidayShifts > 0
      }
    };
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Применяет цветовую схему с приоритетом праздников
   */
  public static applyColorSchemeToShifts(shifts: IShiftInfo[]): Array<IShiftInfo & { 
    colorScheme: {
      backgroundColor: string;
      textColor: string;
      borderColor: string;
      priority: ColorPriority;
      reason: string;
    } 
  }> {
    return shifts.map(shift => {
      let backgroundColor = TIMETABLE_COLORS.DEFAULT_BACKGROUND;
      let textColor = '#000000';
      let borderColor = '#cccccc';
      let priority = ColorPriority.DEFAULT;
      let reason = 'Default styling';
      
      // ПРИОРИТЕТ 1: Праздники
      if ((shift.isHoliday || false) && shift.holidayColor) {
        backgroundColor = shift.holidayColor;
        priority = ColorPriority.HOLIDAY;
        reason = 'Holiday takes highest priority';
        
        // Определяем цвет текста на основе яркости фона
        const rgb = this.hexToRgb(shift.holidayColor);
        if (rgb) {
          const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
          textColor = brightness > 128 ? '#000000' : '#ffffff';
        }
        
        borderColor = this.darkenHexColor(shift.holidayColor, 0.2);
      }
      // ПРИОРИТЕТ 2: Типы отпусков (только если нет праздника)
      else if (shift.typeOfLeaveColor) {
        backgroundColor = shift.typeOfLeaveColor;
        priority = ColorPriority.LEAVE_TYPE;
        reason = 'Leave type color';
        
        // Определяем цвет текста на основе яркости фона
        const rgb = this.hexToRgb(shift.typeOfLeaveColor);
        if (rgb) {
          const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
          textColor = brightness > 128 ? '#000000' : '#ffffff';
        }
        
        borderColor = this.darkenHexColor(shift.typeOfLeaveColor, 0.2);
      }
      
      return {
        ...shift,
        colorScheme: {
          backgroundColor,
          textColor,
          borderColor,
          priority,
          reason
        }
      };
    });
  }

  // *** ВАЛИДАЦИЯ И ПРОВЕРКА ***

  /**
   * Проверяет корректность конфигурации цветов
   */
  public static validateColorConfiguration(
    shifts: IShiftInfo[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    isValid: boolean;
    issues: string[];
    recommendations: string[];
    colorAnalysis: {
      totalShifts: number;
      shiftsWithHoliday: number;
      shiftsWithLeaveType: number;
      shiftsWithValidColors: number;
      missingColors: string[];
    };
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    const totalShifts = shifts.length;
    const shiftsWithHoliday = shifts.filter(s => s.isHoliday).length;
    const shiftsWithLeaveType = shifts.filter(s => s.typeOfLeaveId).length;
    let shiftsWithValidColors = 0;
    const missingColors = new Set<string>();

    // Проверяем праздники
    shifts.forEach(shift => {
      if (shift.isHoliday && shift.holidayColor) {
        shiftsWithValidColors++;
      } else if (shift.isHoliday && !shift.holidayColor) {
        issues.push(`Holiday shift ${shift.recordId} missing holiday color`);
      }
    });

    // Проверяем типы отпусков
    shifts.forEach(shift => {
      if (shift.typeOfLeaveId) {
        if (shift.typeOfLeaveColor) {
          shiftsWithValidColors++;
        } else if (getLeaveTypeColor) {
          const color = getLeaveTypeColor(shift.typeOfLeaveId);
          if (color) {
            shiftsWithValidColors++;
          } else {
            missingColors.add(shift.typeOfLeaveId);
          }
        } else {
          issues.push(`Leave shift ${shift.recordId} missing color function`);
        }
      }
    });

    // Рекомендации
    if (shiftsWithHoliday === 0 && shiftsWithLeaveType === 0) {
      recommendations.push('No special shifts found - colors will be default');
    }
    
    if (missingColors.size > 0) {
      recommendations.push(`Configure colors for leave types: ${Array.from(missingColors).join(', ')}`);
    }
    
    if (shiftsWithHoliday > 0 && shiftsWithLeaveType > 0) {
      recommendations.push('Holiday priority system active - leave colors will be overridden by holidays');
    }

    const isValid = issues.length === 0;

    return {
      isValid,
      issues,
      recommendations,
      colorAnalysis: {
        totalShifts,
        shiftsWithHoliday,
        shiftsWithLeaveType,
        shiftsWithValidColors,
        missingColors: Array.from(missingColors)
      }
    };
  }

  // *** ИНФОРМАЦИЯ О ВЕРСИИ И ВОЗМОЖНОСТЯХ ***

  /**
   * Получает информацию о возможностях класса
   */
  public static getCapabilities(): {
    version: string;
    supportedFeatures: string[];
    holidaySupport: boolean;
    excelExportSupport: boolean;
    prioritySystem: string[];
    compatibilityLevel: string;
  } {
    return {
      version: '3.2',
      supportedFeatures: [
        'Holiday Priority System',
        'Leave Type Colors',
        'Non-work Day Markers',
        'Excel Export Support',
        'Color Priority Resolution',
        'Advanced Statistics',
        'Gradient Generation',
        'Text Contrast Calculation'
      ],
      holidaySupport: true,
      excelExportSupport: true,
      prioritySystem: [
        '1. Holiday (Red) - Highest Priority',
        '2. Leave Types (Colored) - Medium Priority', 
        '3. Default (White) - Lowest Priority'
      ],
      compatibilityLevel: 'Full backward compatibility with v2.x and v3.0/3.1'
    };
  }

  // *** ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ***

  /**
   * Конвертирует HEX цвет в RGB
   */
  private static hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /**
   * Затемняет HEX цвет на указанный процент
   */
  private static darkenHexColor(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    
    const darken = (color: number) => Math.max(0, Math.floor(color * (1 - percent)));
    
    const r = darken(rgb.r).toString(16).padStart(2, '0');
    const g = darken(rgb.g).toString(16).padStart(2, '0');
    const b = darken(rgb.b).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }
}