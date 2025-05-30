// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypesCore.ts
import { 
  IShiftInfo, 
  TIMETABLE_COLORS, 
  ColorPriority, 
  IDayColorAnalysis
} from '../interfaces/TimetableInterfaces';

/**
 * ОСНОВНАЯ ЛОГИКА для работы с типами отпусков и праздниками
 * Содержит ключевые методы анализа цветов и приоритетов
 * Версия 3.2 - Система приоритетов Holiday > Leave Type > Default
 */
export class TimetableShiftCalculatorLeaveTypesCore {

  // *** ОСНОВНЫЕ МЕТОДЫ АНАЛИЗА ЦВЕТОВ ***

  /**
   * ГЛАВНЫЙ МЕТОД: Определяет финальный цвет ячейки с учетом приоритетов
   * НОВОЕ: Система приоритетов Holiday > Leave Type > Default
   */
  public static resolveCellColor(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IDayColorAnalysis {
    console.log('[TimetableShiftCalculatorLeaveTypesCore] Resolving cell color with priority system:', {
      shiftsCount: shifts.length,
      hasLeaveTypeColorFunction: !!getLeaveTypeColor
    });

    if (shifts.length === 0) {
      return {
        finalColor: TIMETABLE_COLORS.DEFAULT_BACKGROUND,
        appliedPriority: ColorPriority.DEFAULT,
        reasons: ['No shifts in day'],
        hasHoliday: false,
        hasLeave: false,
        holidayShiftsCount: 0,
        leaveShiftsCount: 0
      };
    }

    // Анализируем смены на наличие праздников и отпусков
    const holidayShifts = shifts.filter(shift => shift.isHoliday || false);
    const leaveShifts = shifts.filter(shift => shift.typeOfLeaveId);
    
    const holidayShiftsCount = holidayShifts.length;
    const leaveShiftsCount = leaveShifts.length;
    const hasHoliday = holidayShiftsCount > 0;
    const hasLeave = leaveShiftsCount > 0;

    const reasons: string[] = [];
    let finalColor = TIMETABLE_COLORS.DEFAULT_BACKGROUND;
    let appliedPriority = ColorPriority.DEFAULT;

    // *** ПРИОРИТЕТ 1: ПРАЗДНИКИ (КРАСНЫЙ ЦВЕТ) ***
    if (hasHoliday) {
      finalColor = TIMETABLE_COLORS.HOLIDAY;
      appliedPriority = ColorPriority.HOLIDAY;
      reasons.push(`🔴 HOLIDAY priority: ${holidayShiftsCount} holiday shift(s) found`);
      
      if (hasLeave) {
        reasons.push(`⚠️ Note: ${leaveShiftsCount} leave shift(s) ignored due to holiday priority`);
      }
      
      console.log(`[TimetableShiftCalculatorLeaveTypesCore] 🔴 HOLIDAY COLOR APPLIED: ${finalColor} (${holidayShiftsCount} shifts)`);
    }
    // *** ПРИОРИТЕТ 2: ТИПЫ ОТПУСКОВ (ЦВЕТНЫЕ) ***
    else if (hasLeave && getLeaveTypeColor) {
      const dominantLeaveColor = this.getDominantLeaveColor(shifts, getLeaveTypeColor);
      
      if (dominantLeaveColor) {
        finalColor = dominantLeaveColor;
        appliedPriority = ColorPriority.LEAVE_TYPE;
        reasons.push(`🟡 LEAVE TYPE priority: Using dominant leave color ${dominantLeaveColor}`);
        
        console.log(`[TimetableShiftCalculatorLeaveTypesCore] 🟡 LEAVE COLOR APPLIED: ${finalColor} (${leaveShiftsCount} shifts)`);
      } else {
        reasons.push(`⚠️ Leave shifts found but no valid colors available`);
        finalColor = TIMETABLE_COLORS.DEFAULT_BACKGROUND;
        appliedPriority = ColorPriority.DEFAULT;
      }
    }
    // *** ПРИОРИТЕТ 3: ПО УМОЛЧАНИЮ (БЕЛЫЙ) ***
    else {
      finalColor = TIMETABLE_COLORS.DEFAULT_BACKGROUND;
      appliedPriority = ColorPriority.DEFAULT;
      reasons.push(`⚪ DEFAULT: No holidays or leave types found`);
      
      console.log(`[TimetableShiftCalculatorLeaveTypesCore] ⚪ DEFAULT COLOR APPLIED: ${finalColor}`);
    }

    const analysis: IDayColorAnalysis = {
      finalColor,
      appliedPriority,
      reasons,
      hasHoliday,
      hasLeave,
      holidayShiftsCount,
      leaveShiftsCount
    };

    console.log('[TimetableShiftCalculatorLeaveTypesCore] Color resolution completed:', analysis);
    return analysis;
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Получает доминирующий цвет отпуска (только если нет праздников)
   */
  public static getDominantLeaveColor(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): string | undefined {
    if (shifts.length === 0) {
      return undefined;
    }

    // *** ВАЖНО: Если есть праздники, отпуска игнорируются ***
    const hasHolidays = shifts.some(shift => shift.isHoliday || false);
    if (hasHolidays) {
      console.log('[TimetableShiftCalculatorLeaveTypesCore] 🔴 Holidays detected - ignoring leave colors due to priority system');
      return undefined;
    }

    // Считаем количество смен каждого типа отпуска
    const leaveColorCounts = new Map<string, number>();
    
    shifts.forEach(shift => {
      if (shift.typeOfLeaveId && getLeaveTypeColor) {
        const leaveColor = getLeaveTypeColor(shift.typeOfLeaveId);
        if (leaveColor) {
          const existing = leaveColorCounts.get(leaveColor);
          leaveColorCounts.set(leaveColor, (existing || 0) + 1);
        }
      }
    });

    if (leaveColorCounts.size === 0) {
      return undefined;
    }

    // Возвращаем цвет с наибольшим количеством смен
    let dominantColor: string | undefined = undefined;
    let maxCount = 0;

    leaveColorCounts.forEach((count, color) => {
      if (count > maxCount) {
        maxCount = count;
        dominantColor = color;
      }
    });

    console.log(`[TimetableShiftCalculatorLeaveTypesCore] Dominant leave color: ${dominantColor} (${maxCount} shifts)`);
    return dominantColor;
  }

  // *** АНАЛИЗ ТИПОВ ОТПУСКОВ И ПРАЗДНИКОВ ***

  /**
   * НОВЫЙ МЕТОД: Получает все уникальные типы отпусков из смен (с учетом праздников)
   */
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): Array<{
    id: string;
    title: string;
    color: string;
    count: number;
    isOverriddenByHoliday: boolean;
  }> {
    const leaveTypesMap = new Map<string, {
      id: string;
      title: string;
      color: string;
      count: number;
      isOverriddenByHoliday: boolean;
    }>();

    // Проверяем наличие праздников
    const hasHolidays = shifts.some(shift => shift.isHoliday || false);

    shifts.forEach(shift => {
      if (shift.typeOfLeaveId && shift.typeOfLeaveColor) {
        const existing = leaveTypesMap.get(shift.typeOfLeaveId);
        
        const isOverriddenByHoliday = hasHolidays && (shift.isHoliday || false);
        
        if (existing) {
          existing.count++;
          existing.isOverriddenByHoliday = existing.isOverriddenByHoliday || isOverriddenByHoliday;
        } else {
          leaveTypesMap.set(shift.typeOfLeaveId, {
            id: shift.typeOfLeaveId,
            title: shift.typeOfLeaveTitle || shift.typeOfLeaveId,
            color: shift.typeOfLeaveColor,
            count: 1,
            isOverriddenByHoliday: (shift.isHoliday || false)
          });
        }
      }
    });

    const result = Array.from(leaveTypesMap.values()).sort((a, b) => b.count - a.count);
    
    console.log('[TimetableShiftCalculatorLeaveTypesCore] Unique leave types analysis:', {
      totalTypes: result.length,
      overriddenByHoliday: result.filter(lt => lt.isOverriddenByHoliday).length,
      hasHolidays
    });

    return result;
  }

  /**
   * НОВЫЙ МЕТОД: Проверяет наличие праздников в сменах
   */
  public static hasHolidays(shifts: IShiftInfo[]): boolean {
    return shifts.some(shift => shift.isHoliday || false);
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Проверяет, есть ли в сменах отпуска
   */
  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return shifts.some(shift => shift.typeOfLeaveId);
  }

  /**
   * НОВЫЙ МЕТОД: Получает статистику по праздникам и отпускам
   */
  public static getHolidayAndLeaveStatistics(shifts: IShiftInfo[]): {
    totalShifts: number;
    holidayShifts: number;
    leaveShifts: number;
    normalShifts: number;
    shiftsWithBoth: number;
    holidayPercentage: number;
    leavePercentage: number;
    priorityInfo: {
      holidayOverridesLeave: boolean;
      effectiveHolidayShifts: number;
      effectiveLeaveShifts: number;
    };
  } {
    const totalShifts = shifts.length;
    const holidayShifts = shifts.filter(s => s.isHoliday || false).length;
    const leaveShifts = shifts.filter(s => s.typeOfLeaveId).length;
    const shiftsWithBoth = shifts.filter(s => (s.isHoliday || false) && s.typeOfLeaveId).length;
    const normalShifts = shifts.filter(s => !(s.isHoliday || false) && !s.typeOfLeaveId).length;
    
    const holidayPercentage = totalShifts > 0 ? Math.round((holidayShifts / totalShifts) * 100) : 0;
    const leavePercentage = totalShifts > 0 ? Math.round((leaveShifts / totalShifts) * 100) : 0;
    
    // Приоритетная система: праздники перекрывают отпуска
    const holidayOverridesLeave = holidayShifts > 0;
    const effectiveHolidayShifts = holidayShifts;
    const effectiveLeaveShifts = holidayOverridesLeave ? 0 : leaveShifts;

    return {
      totalShifts,
      holidayShifts,
      leaveShifts,
      normalShifts,
      shiftsWithBoth,
      holidayPercentage,
      leavePercentage,
      priorityInfo: {
        holidayOverridesLeave,
        effectiveHolidayShifts,
        effectiveLeaveShifts
      }
    };
  }

  /**
   * ГЛАВНЫЙ МЕТОД: Создает CSS стили для ячейки с системой приоритетов
   */
  public static createCellStyles(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    backgroundColor?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
    textShadow?: string;
    priority: ColorPriority;
    reason: string;
  } {
    const analysis = this.resolveCellColor(shifts, getLeaveTypeColor);
    
    if (analysis.finalColor === TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
      return {
        priority: analysis.appliedPriority,
        reason: analysis.reasons.join('; ')
      };
    }
    
    const textColor = this.getTextColorForBackground(analysis.finalColor);
    const borderColor = this.darkenHexColor(analysis.finalColor, 0.2);
    
    return {
      backgroundColor: analysis.finalColor,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '3px',
      textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
      priority: analysis.appliedPriority,
      reason: analysis.reasons.join('; ')
    };
  }

  /**
   * Проверяет контрастность цвета для читаемости текста
   */
  public static getTextColorForBackground(backgroundColor: string): string {
    const rgb = this.hexToRgb(backgroundColor);
    if (!rgb) return '#000000';
    
    // Используем формулу относительной яркости
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
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
   * FIXED: Added explicit return type
   */
  private static darkenHexColor(hex: string, percent: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    
    const darken = (color: number): number => Math.max(0, Math.floor(color * (1 - percent)));
    
    const r = darken(rgb.r).toString(16).padStart(2, '0');
    const g = darken(rgb.g).toString(16).padStart(2, '0');
    const b = darken(rgb.b).toString(16).padStart(2, '0');
    
    return `#${r}${g}${b}`;
  }
}