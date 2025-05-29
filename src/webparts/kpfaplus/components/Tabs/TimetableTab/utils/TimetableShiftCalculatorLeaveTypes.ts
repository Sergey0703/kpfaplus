// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypes.ts
import { 
  IShiftInfo, 
  TIMETABLE_COLORS, 
  ColorPriority, 
  IDayColorAnalysis
} from '../interfaces/TimetableInterfaces';

/**
 * Работа с типами отпусков, праздниками и цветовыми схемами
 * Содержит функции для анализа отпусков, работы с цветами и визуализации
 * ОБНОВЛЕНО: Полная поддержка праздников с системой приоритетов цветов
 */
export class TimetableShiftCalculatorLeaveTypes {

  /**
   * ГЛАВНЫЙ МЕТОД: Определяет финальный цвет ячейки с учетом приоритетов
   * НОВОЕ: Система приоритетов Holiday > Leave Type > Default
   */
  public static resolveCellColor(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IDayColorAnalysis {
    console.log('[TimetableShiftCalculatorLeaveTypes] Resolving cell color with priority system:', {
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
      
      console.log(`[TimetableShiftCalculatorLeaveTypes] 🔴 HOLIDAY COLOR APPLIED: ${finalColor} (${holidayShiftsCount} shifts)`);
    }
    // *** ПРИОРИТЕТ 2: ТИПЫ ОТПУСКОВ (ЦВЕТНЫЕ) ***
    else if (hasLeave && getLeaveTypeColor) {
      const dominantLeaveColor = this.getDominantLeaveColor(shifts, getLeaveTypeColor);
      
      if (dominantLeaveColor) {
        finalColor = dominantLeaveColor;
        appliedPriority = ColorPriority.LEAVE_TYPE;
        reasons.push(`🟡 LEAVE TYPE priority: Using dominant leave color ${dominantLeaveColor}`);
        
        console.log(`[TimetableShiftCalculatorLeaveTypes] 🟡 LEAVE COLOR APPLIED: ${finalColor} (${leaveShiftsCount} shifts)`);
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
      
      console.log(`[TimetableShiftCalculatorLeaveTypes] ⚪ DEFAULT COLOR APPLIED: ${finalColor}`);
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

    console.log('[TimetableShiftCalculatorLeaveTypes] Color resolution completed:', analysis);
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
      console.log('[TimetableShiftCalculatorLeaveTypes] 🔴 Holidays detected - ignoring leave colors due to priority system');
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

    console.log(`[TimetableShiftCalculatorLeaveTypes] Dominant leave color: ${dominantColor} (${maxCount} shifts)`);
    return dominantColor;
  }

  /**
   * СОВМЕСТИМОСТЬ: Старый метод getDominantLeaveColor без getLeaveTypeColor
   */
  public static getDominantLeaveColorLegacy(shifts: IShiftInfo[]): string | undefined {
    if (shifts.length === 0) {
      return undefined;
    }

    // Проверяем приоритет праздников
    const hasHolidays = shifts.some(shift => shift.isHoliday || false);
    if (hasHolidays) {
      return undefined; // Праздники имеют приоритет
    }

    // Считаем количество смен каждого цвета отпуска из самих смен
    const leaveColorCounts = new Map<string, number>();
    
    shifts.forEach(shift => {
      if (shift.typeOfLeaveColor) {
        const existing = leaveColorCounts.get(shift.typeOfLeaveColor);
        leaveColorCounts.set(shift.typeOfLeaveColor, (existing || 0) + 1);
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

    return dominantColor;
  }

  /**
   * НОВЫЙ МЕТОД: Получает все уникальные типы отпусков из смен (с учетом праздников)
   */
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): Array<{
    id: string;
    title: string;
    color: string;
    count: number;
    isOverriddenByHoliday: boolean; // НОВОЕ: Указывает, перекрыт ли праздником
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
        
        const isOverriddenByHoliday = hasHolidays && (shift.isHoliday || false); // Этот тип отпуска в смене с праздником
        
        if (existing) {
          existing.count++;
          // Если хотя бы одна смена перекрыта праздником, отмечаем
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
    
    console.log('[TimetableShiftCalculatorLeaveTypes] Unique leave types analysis:', {
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
   * ОБНОВЛЕННЫЙ МЕТОД: Проверяет, есть ли в сменах отпуска (с учетом приоритета праздников)
   */
  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return shifts.some(shift => shift.typeOfLeaveId);
  }

  /**
   * НОВЫЙ МЕТОД: Получает количество праздничных смен
   */
  public static getHolidayShiftsCount(shifts: IShiftInfo[]): number {
    return shifts.filter(shift => shift.isHoliday || false).length;
  }

  /**
   * НОВЫЙ МЕТОД: Получает статистику по праздникам и отпускам
   */
  public static getHolidayAndLeaveStatistics(shifts: IShiftInfo[]): {
    totalShifts: number;
    holidayShifts: number;
    leaveShifts: number;
    normalShifts: number;
    shiftsWithBoth: number; // Смены которые одновременно праздник и отпуск
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
   * ОБНОВЛЕННЫЙ МЕТОД: Форматирует информацию о типах отпусков и праздниках в дне
   */
  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    const holidayShifts = shifts.filter(s => s.isHoliday || false).length;
    const leaveTypes = this.getUniqueLeaveTypes(shifts);
    
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
    if (this.hasHolidays(shifts)) {
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
   * ОБНОВЛЕННЫЙ МЕТОД: Получает все цвета отпусков в дне (устаревший метод для совместимости)
   */
  public static getAllLeaveColors(shifts: IShiftInfo[]): string[] {
    const colorsSet = new Set<string>();
    shifts.forEach(shift => {
      if (shift.typeOfLeaveColor) {
        colorsSet.add(shift.typeOfLeaveColor);
      }
    });
    
    // Возвращаем уникальные цвета (исправлено для совместимости с ES5)
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
    const leaveTypes = this.getUniqueLeaveTypes(shifts);
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

  /**
   * ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Конвертирует HEX цвет в RGB
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
   * ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Затемняет HEX цвет на указанный процент
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

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Проверяет контрастность цвета с приоритетом праздников
   */
  public static getTextColorForBackground(backgroundColor: string): string {
    const rgb = this.hexToRgb(backgroundColor);
    if (!rgb) return '#000000';
    
    // Используем формулу относительной яркости
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
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
   * УСТАРЕВШИЙ МЕТОД: Для совместимости (используйте createCellStyles)
   */
  public static createLeaveCellStyles(shifts: IShiftInfo[]): {
    backgroundColor?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
    textShadow?: string;
  } {
    const newStyles = this.createCellStyles(shifts);
    
    // Убираем новые поля для совместимости
    const { priority, reason, ...compatibleStyles } = newStyles;
    return compatibleStyles;
  }
}