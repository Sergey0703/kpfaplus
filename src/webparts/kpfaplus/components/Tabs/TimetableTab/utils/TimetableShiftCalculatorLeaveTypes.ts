// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypes.ts
import { IShiftInfo } from '../interfaces/TimetableInterfaces';

/**
 * Работа с типами отпусков и цветовыми схемами
 * Содержит функции для анализа отпусков, работы с цветами и визуализации
 */
export class TimetableShiftCalculatorLeaveTypes {

  /**
   * НОВЫЙ МЕТОД: Получает все уникальные типы отпусков из смен
   */
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): Array<{
    id: string;
    title: string;
    color: string;
    count: number;
  }> {
    const leaveTypesMap = new Map<string, {
      id: string;
      title: string;
      color: string;
      count: number;
    }>();

    shifts.forEach(shift => {
      if (shift.typeOfLeaveId && shift.typeOfLeaveColor) {
        const existing = leaveTypesMap.get(shift.typeOfLeaveId);
        if (existing) {
          existing.count++;
        } else {
          leaveTypesMap.set(shift.typeOfLeaveId, {
            id: shift.typeOfLeaveId,
            title: shift.typeOfLeaveTitle || shift.typeOfLeaveId,
            color: shift.typeOfLeaveColor,
            count: 1
          });
        }
      }
    });

    return Array.from(leaveTypesMap.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * НОВЫЙ МЕТОД: Проверяет, есть ли в сменах отпуска
   */
  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return shifts.some(shift => shift.typeOfLeaveId);
  }

  /**
   * НОВЫЙ МЕТОД: Получает доминирующий цвет отпуска для дня (если есть несколько смен с разными типами отпусков)
   */
  public static getDominantLeaveColor(shifts: IShiftInfo[]): string | undefined {
    if (shifts.length === 0) {
      return undefined;
    }

    // Считаем количество смен каждого типа отпуска
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
   * НОВЫЙ МЕТОД: Форматирует информацию о типах отпусков в дне
   */
  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    const leaveTypes = this.getUniqueLeaveTypes(shifts);
    
    if (leaveTypes.length === 0) {
      return '';
    }

    if (leaveTypes.length === 1) {
      return leaveTypes[0].title;
    }

    return leaveTypes.map(lt => `${lt.title} (${lt.count})`).join(', ');
  }

  /**
   * НОВЫЙ МЕТОД: Получает цвет для первого типа отпуска в списке смен
   */
  public static getFirstLeaveColor(shifts: IShiftInfo[]): string | undefined {
    const shiftWithLeave = shifts.find(shift => shift.typeOfLeaveColor);
    return shiftWithLeave?.typeOfLeaveColor;
  }

  /**
   * НОВЫЙ МЕТОД: Проверяет, содержит ли день определенный тип отпуска
   */
  public static hasSpecificLeaveType(shifts: IShiftInfo[], leaveTypeId: string): boolean {
    return shifts.some(shift => shift.typeOfLeaveId === leaveTypeId);
  }

  /**
   * НОВЫЙ МЕТОД: Получает все цвета отпусков в дне
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
   * НОВЫЙ МЕТОД: Создает градиент из нескольких цветов отпусков (для случая когда в дне несколько типов отпусков)
   */
  public static createLeaveColorsGradient(shifts: IShiftInfo[]): string | undefined {
    const colors = this.getAllLeaveColors(shifts);
    
    if (colors.length === 0) {
      return undefined;
    }
    
    if (colors.length === 1) {
      return colors[0];
    }
    
    // Создаем CSS градиент для нескольких цветов
    const gradientStops = colors.map((color, index) => {
      const percentage = (index / (colors.length - 1)) * 100;
      return `${color} ${percentage}%`;
    }).join(', ');
    
    return `linear-gradient(45deg, ${gradientStops})`;
  }

  /**
   * НОВЫЙ МЕТОД: Получает статистику по типам отпусков для группы смен
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
    const leaveTypes = this.getUniqueLeaveTypes(shifts);
    const totalShiftsWithLeave = shifts.filter(s => s.typeOfLeaveId).length;
    
    const leaveTypeBreakdown = leaveTypes.map(lt => ({
      ...lt,
      percentage: totalShiftsWithLeave > 0 ? Math.round((lt.count / totalShiftsWithLeave) * 100) : 0
    }));
    
    const mostCommonLeaveType = leaveTypes.length > 0 ? leaveTypes[0] : undefined;
    
    return {
      totalShiftsWithLeave,
      uniqueLeaveTypes: leaveTypes.length,
      leaveTypeBreakdown,
      mostCommonLeaveType
    };
  }

  /**
   * НОВЫЙ МЕТОД: Применяет цветовую схему к списку смен (для отладки и визуализации)
   */
  public static applyColorSchemeToShifts(shifts: IShiftInfo[]): Array<IShiftInfo & { 
    colorScheme: {
      backgroundColor: string;
      textColor: string;
      borderColor: string;
    } 
  }> {
    return shifts.map(shift => {
      let backgroundColor = '#ffffff';
      let textColor = '#000000';
      let borderColor = '#cccccc';
      
      if (shift.typeOfLeaveColor) {
        backgroundColor = shift.typeOfLeaveColor;
        
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
          borderColor
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
   * НОВЫЙ МЕТОД: Проверяет контрастность цвета для читаемости текста
   */
  public static getTextColorForBackground(backgroundColor: string): string {
    const rgb = this.hexToRgb(backgroundColor);
    if (!rgb) return '#000000';
    
    // Используем формулу относительной яркости
    const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  /**
   * НОВЫЙ МЕТОД: Создает CSS стили для ячейки с отпуском
   */
  public static createLeaveCellStyles(shifts: IShiftInfo[]): {
    backgroundColor?: string;
    color?: string;
    border?: string;
    borderRadius?: string;
    textShadow?: string;
  } {
    const dominantColor = this.getDominantLeaveColor(shifts);
    
    if (!dominantColor) {
      return {};
    }
    
    const textColor = this.getTextColorForBackground(dominantColor);
    const borderColor = this.darkenHexColor(dominantColor, 0.2);
    
    return {
      backgroundColor: dominantColor,
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '3px',
      textShadow: textColor === '#ffffff' ? '0 1px 2px rgba(0,0,0,0.3)' : 'none'
    };
  }
}