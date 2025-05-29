// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypes.ts
import { 
  IShiftInfo, 
  TIMETABLE_COLORS, 
  ColorPriority, 
  IDayColorAnalysis,
  IDayInfo
} from '../interfaces/TimetableInterfaces';

/**
 * Работа с типами отпусков, праздниками и цветовыми схемами
 * Содержит функции для анализа отпусков, работы с цветами и визуализации
 * ОБНОВЛЕНО: Полная поддержка праздников с системой приоритетов цветов
 * НОВОЕ: Специальная поддержка Excel экспорта с отметками без смен
 * Версия 3.2 - Максимальная поддержка Excel экспорта
 */
export class TimetableShiftCalculatorLeaveTypes {

  // *** ОСНОВНЫЕ МЕТОДЫ АНАЛИЗА ЦВЕТОВ ***

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

  // *** АНАЛИЗ ТИПОВ ОТПУСКОВ И ПРАЗДНИКОВ ***

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

  // *** ФОРМАТИРОВАНИЕ И ОТОБРАЖЕНИЕ ***

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

  // *** СТИЛИ ДЛЯ КОМПОНЕНТОВ ***

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

  // *** НОВЫЕ МЕТОДЫ ДЛЯ EXCEL ЭКСПОРТА ***

  /**
   * НОВЫЙ МЕТОД: Создает стили ячейки специально для Excel экспорта
   * Версия 3.2: Поддержка отметок праздников/отпусков даже без рабочих смен
   */
  public static createExcelCellStyles(
    shifts: IShiftInfo[], 
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined,
    dayData?: IDayInfo // Дополнительная информация о дне для анализа отметок
  ): {
    backgroundColor?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
    textShadow?: string;
    priority: ColorPriority;
    reason: string;
    excelFillPattern?: any;
    excelFont?: any;
  } {
    console.log('[TimetableShiftCalculatorLeaveTypes] Creating Excel cell styles with full markers support v3.2');

    // *** РАСШИРЕННЫЙ АНАЛИЗ ДЛЯ EXCEL ВКЛЮЧАЯ ДНИ БЕЗ СМЕН ***
    const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasHolidayInShifts = shifts.some(s => s.isHoliday);
    const hasLeaveInShifts = shifts.some(s => s.typeOfLeaveId);
    
    // *** НОВОЕ: Анализ отметок из dayData (дни без смен) ***
    const hasHolidayMarker = dayData?.hasHoliday && !hasWorkShifts;
    const hasLeaveMarker = dayData?.hasLeave && !hasWorkShifts && !hasHolidayMarker;
    
    const finalHasHoliday = hasHolidayInShifts || hasHolidayMarker;
    const finalHasLeave = hasLeaveInShifts || hasLeaveMarker;

    console.log('[TimetableShiftCalculatorLeaveTypes] Excel cell analysis:', {
      hasWorkShifts,
      hasHolidayInShifts,
      hasLeaveInShifts,
      hasHolidayMarker,
      hasLeaveMarker,
      finalHasHoliday,
      finalHasLeave
    });

    let backgroundColor = TIMETABLE_COLORS.DEFAULT_BACKGROUND;
    let priority = ColorPriority.DEFAULT;
    let reason = 'Default styling';

    // *** СИСТЕМА ПРИОРИТЕТОВ ДЛЯ EXCEL ***
    if (finalHasHoliday) {
      backgroundColor = TIMETABLE_COLORS.HOLIDAY;
      priority = ColorPriority.HOLIDAY;
      reason = hasHolidayInShifts ? 
        'Holiday in work shifts (highest priority)' : 
        'Holiday marker without work shifts (highest priority)';
      
      console.log(`[TimetableShiftCalculatorLeaveTypes] 🔴 Excel HOLIDAY color applied: ${backgroundColor}`);
    } else if (finalHasLeave) {
      // Определяем цвет отпуска
      let leaveColor: string | undefined;
      
      if (hasLeaveInShifts && getLeaveTypeColor) {
        // Цвет из смен с работой
        leaveColor = this.getDominantLeaveColor(shifts, getLeaveTypeColor);
      } else if (hasLeaveMarker && dayData?.leaveTypeColor) {
        // Цвет из отметки дня без работы
        leaveColor = dayData.leaveTypeColor;
      }
      
      if (leaveColor) {
        backgroundColor = leaveColor;
        priority = ColorPriority.LEAVE_TYPE;
        reason = hasLeaveInShifts ? 
          'Leave type in work shifts' : 
          'Leave type marker without work shifts';
        
        console.log(`[TimetableShiftCalculatorLeaveTypes] 🟡 Excel LEAVE color applied: ${backgroundColor}`);
      }
    }

    // Определяем цвет текста
    const textColor = this.getTextColorForBackground(backgroundColor);
    const borderColor = this.darkenHexColor(backgroundColor, 0.2);

    // *** СПЕЦИАЛЬНЫЕ СТИЛИ ДЛЯ EXCEL ***
    const excelFillPattern = backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: `FF${backgroundColor.replace('#', '')}` }
    } : undefined;

    const excelFont = backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? {
      color: { argb: textColor === '#ffffff' ? 'FFFFFFFF' : 'FF000000' },
      bold: priority === ColorPriority.HOLIDAY // Жирный шрифт для праздников
    } : undefined;

    return {
      backgroundColor,
      color: textColor,
      border: backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? `1px solid ${borderColor}` : undefined,
      borderRadius: '3px',
      textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
      priority,
      reason,
      excelFillPattern,
      excelFont
    };
  }

  /**
   * НОВЫЙ МЕТОД: Анализирует день для Excel экспорта включая отметки без смен
   * Версия 3.2: Полный анализ для корректного отображения в Excel
   */
  public static analyzeExcelDayData(
    shifts: IShiftInfo[],
    dayData?: IDayInfo,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasAnyData: boolean;
    hasWorkData: boolean;
    hasHolidayData: boolean;
    hasLeaveData: boolean;
    displayText: string;
    colorInfo: {
      shouldApplyColor: boolean;
      backgroundColor?: string;
      textColor?: string;
      priority: ColorPriority;
    };
  } {
    console.log('[TimetableShiftCalculatorLeaveTypes] Analyzing day data for Excel export v3.2');

    const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasHolidayInShifts = shifts.some(s => s.isHoliday);
    const hasLeaveInShifts = shifts.some(s => s.typeOfLeaveId);
    
    // Анализ отметок без работы
    const hasHolidayMarker = dayData?.hasHoliday && !hasWorkShifts;
    const hasLeaveMarker = dayData?.hasLeave && !hasWorkShifts && !hasHolidayMarker;
    
    const hasAnyData = hasWorkShifts || hasHolidayMarker || hasLeaveMarker;
    const hasWorkData = hasWorkShifts;
    const hasHolidayData = hasHolidayInShifts || hasHolidayMarker;
    const hasLeaveData = hasLeaveInShifts || hasLeaveMarker;

    // Определяем текст для отображения
    let displayText = '';
    if (hasWorkShifts) {
      // Есть рабочие смены - используем стандартное форматирование
      displayText = this.formatShiftsForExcel(shifts);
    } else if (hasHolidayMarker) {
      // Только отметка праздника
      displayText = 'Holiday';
    } else if (hasLeaveMarker) {
      // Только отметка отпуска
      displayText = 'Leave';
    }

    // Определяем цветовую информацию
    const cellStyles = this.createExcelCellStyles(shifts, getLeaveTypeColor, dayData);
    
    const colorInfo = {
      shouldApplyColor: cellStyles.backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND,
      backgroundColor: cellStyles.backgroundColor,
      textColor: cellStyles.color,
      priority: cellStyles.priority
    };

    const analysis = {
      hasAnyData,
      hasWorkData,
      hasHolidayData,
      hasLeaveData,
      displayText,
      colorInfo
    };

    console.log('[TimetableShiftCalculatorLeaveTypes] Excel day analysis result:', analysis);
    return analysis;
  }

  /**
   * НОВЫЙ МЕТОД: Создает полное описание дня для Excel экспорта
   * Включает информацию о сменах, праздниках и отпусках
   */
  public static createExcelDayDescription(
    shifts: IShiftInfo[],
    dayData?: IDayInfo,
    typesOfLeave?: Array<{ id: string; title: string; color?: string }>
  ): {
    primaryText: string;
    additionalInfo: string[];
    fullDescription: string;
    hasMarkers: boolean;
  } {
    const analysis = this.analyzeExcelDayData(shifts, dayData);
    
    let primaryText = analysis.displayText;
    const additionalInfo: string[] = [];
    
    // Добавляем дополнительную информацию
    if (analysis.hasHolidayData) {
      if (shifts.some(s => s.isHoliday && s.workMinutes > 0)) {
        additionalInfo.push('Working Holiday');
      } else {
        additionalInfo.push('Holiday');
      }
    }
    
    if (analysis.hasLeaveData && typesOfLeave) {
      const leaveTypes = new Set<string>();
      
      // Собираем типы отпусков из смен
      shifts.forEach(shift => {
        if (shift.typeOfLeaveId) {
          const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
          if (leaveType) {
            leaveTypes.add(leaveType.title);
          }
        }
      });
      
      // Добавляем типы отпусков из отметок дня
      if (dayData?.hasLeave && !analysis.hasWorkData) {
        // Пытаемся определить тип отпуска по цвету
        if (dayData.leaveTypeColor && typesOfLeave) {
          const leaveType = typesOfLeave.find(lt => lt.color === dayData.leaveTypeColor);
          if (leaveType) {
            leaveTypes.add(leaveType.title);
          }
        }
      }
      
      if (leaveTypes.size > 0) {
        const leaveTypesArray: string[] = [];
        leaveTypes.forEach(type => leaveTypesArray.push(type));
        additionalInfo.push(`Leave: ${leaveTypesArray.join(', ')}`);
      }
    }
    
    // Формируем полное описание
    let fullDescription = primaryText;
    if (additionalInfo.length > 0) {
      if (fullDescription) {
        fullDescription += '\n' + additionalInfo.join('\n');
      } else {
        fullDescription = additionalInfo.join('\n');
      }
    }
    
    return {
      primaryText,
      additionalInfo,
      fullDescription,
      hasMarkers: additionalInfo.length > 0
    };
  }

  /**
   * НОВЫЙ МЕТОД: Форматирует смены для Excel экспорта
   */
  private static formatShiftsForExcel(shifts: IShiftInfo[]): string {
    if (shifts.length === 0) {
      return '';
    }

    if (shifts.length === 1) {
      return shifts[0].formattedShift;
    }

    // Несколько смен - объединяем через новую строку
    return shifts.map(shift => shift.formattedShift).join('\n');
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Получает статистику по Excel экспорту
   * Включает информацию о отметках без смен
   */
  public static getExcelExportStatistics(
    weeksData: Array<{
      weekInfo: any;
      staffRows: Array<{
        staffName: string;
        weekData: {
          days: { [dayNumber: number]: IDayInfo };
        };
      }>;
    }>
  ): {
    totalDays: number;
    daysWithWorkShifts: number;
    daysWithHolidayMarkers: number;
    daysWithLeaveMarkers: number;
    daysWithMixedData: number;
    totalHolidayDays: number;
    totalLeaveDays: number;
    coloredCellsCount: number;
    exportQuality: string;
  } {
    let totalDays = 0;
    let daysWithWorkShifts = 0;
    let daysWithHolidayMarkers = 0;
    let daysWithLeaveMarkers = 0;
    let daysWithMixedData = 0;
    let totalHolidayDays = 0;
    let totalLeaveDays = 0;
    let coloredCellsCount = 0;

    weeksData.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((dayData: IDayInfo) => {
          totalDays++;
          
          const hasWorkShifts = dayData.shifts && dayData.shifts.some(s => s.workMinutes > 0);
          const hasHolidayMarker = dayData.hasHoliday && !hasWorkShifts;
          const hasLeaveMarker = dayData.hasLeave && !hasWorkShifts && !hasHolidayMarker;
          const hasHolidayInWork = dayData.shifts && dayData.shifts.some(s => s.isHoliday && s.workMinutes > 0);
          const hasLeaveInWork = dayData.shifts && dayData.shifts.some(s => s.typeOfLeaveId && s.workMinutes > 0);
          
          if (hasWorkShifts) {
            daysWithWorkShifts++;
          }
          
          if (hasHolidayMarker) {
            daysWithHolidayMarkers++;
          }
          
          if (hasLeaveMarker) {
            daysWithLeaveMarkers++;
          }
          
          if ((hasWorkShifts && (hasHolidayInWork || hasLeaveInWork)) || 
              (hasHolidayMarker && hasLeaveMarker)) {
            daysWithMixedData++;
          }
          
          if (dayData.hasHoliday) {
            totalHolidayDays++;
          }
          
          if (dayData.hasLeave) {
            totalLeaveDays++;
          }
          
          // Подсчитываем цветные ячейки
          if (dayData.finalCellColor && dayData.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
            coloredCellsCount++;
          }
        });
      });
    });

    let exportQuality = 'UNKNOWN';
    const dataRatio = (daysWithWorkShifts + daysWithHolidayMarkers + daysWithLeaveMarkers) / totalDays;
    
    if (dataRatio > 0.8) {
      exportQuality = 'EXCELLENT - High data coverage';
    } else if (dataRatio > 0.5) {
      exportQuality = 'GOOD - Moderate data coverage';
    } else if (dataRatio > 0.2) {
      exportQuality = 'FAIR - Limited data coverage';
    } else {
      exportQuality = 'POOR - Very limited data';
    }

    return {
      totalDays,
      daysWithWorkShifts,
      daysWithHolidayMarkers,
      daysWithLeaveMarkers,
      daysWithMixedData,
      totalHolidayDays,
      totalLeaveDays,
      coloredCellsCount,
      exportQuality
    };
  }

  /**
   * НОВЫЙ МЕТОД: Создает сводку по цветам для Excel экспорта
   */
  public static createExcelColorLegend(
    weeksData: Array<{
      weekInfo: any;
      staffRows: Array<{
        staffName: string;
        weekData: {
          days: { [dayNumber: number]: IDayInfo };
        };
      }>;
    }>,
    typesOfLeave?: Array<{ id: string; title: string; color?: string }>
  ): {
    holidayColor: {
      color: string;
      name: string;
      usage: number;
    };
    leaveColors: Array<{
      color: string;
      name: string;
      usage: number;
      typeId: string;
    }>;
    totalColoredCells: number;
  } {
    const leaveColorUsage = new Map<string, { name: string; usage: number; typeId: string }>();
    let holidayUsage = 0;
    let totalColoredCells = 0;

    weeksData.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((dayData: IDayInfo) => {
          if (dayData.finalCellColor && dayData.finalCellColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
            totalColoredCells++;
            
            if (dayData.hasHoliday) {
              holidayUsage++;
            } else if (dayData.hasLeave && dayData.leaveTypeColor) {
              const color = dayData.leaveTypeColor;
              const existing = leaveColorUsage.get(color);
              
              if (existing) {
                existing.usage++;
              } else {
                // Находим название типа отпуска
                let name = 'Unknown Leave Type';
                let typeId = 'unknown';
                
                if (typesOfLeave) {
                  const leaveType = typesOfLeave.find(lt => lt.color === color);
                  if (leaveType) {
                    name = leaveType.title;
                    typeId = leaveType.id;
                  }
                }
                
                leaveColorUsage.set(color, { name, usage: 1, typeId });
              }
            }
          }
        });
      });
    });

    // Конвертируем Map в массив
    const leaveColors: Array<{
      color: string;
      name: string;
      usage: number;
      typeId: string;
    }> = [];
    
    leaveColorUsage.forEach((data, color) => {
      leaveColors.push({
        color,
        name: data.name,
        usage: data.usage,
        typeId: data.typeId
      });
    });
    
    // Сортируем по использованию
    leaveColors.sort((a, b) => b.usage - a.usage);

    return {
      holidayColor: {
        color: TIMETABLE_COLORS.HOLIDAY,
        name: 'Holiday',
        usage: holidayUsage
      },
      leaveColors,
      totalColoredCells
    };
  }

  // *** ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ***

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
}