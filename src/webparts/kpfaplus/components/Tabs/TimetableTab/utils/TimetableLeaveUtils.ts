// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableLeaveUtils.ts
import { IShiftInfo } from '../interfaces/TimetableInterfaces';
import * as React from 'react'; // Import React for CSSProperties

/**
 * Утилиты для работы с типами отпусков, цветами и статистикой по сменам.
 */
export class TimetableLeaveUtils {

  /**
   * Получает все уникальные типы отпусков из списка смен
   */
  public static getUniqueLeaveTypes(shifts: IShiftInfo[]): Array<{
    id: string;
    title: string; // Corrected: Removed the duplicate 'string;'
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
      // Only include shifts with a leave ID AND a color
      if (shift.typeOfLeaveId && shift.typeOfLeaveColor) {
        const existing = leaveTypesMap.get(shift.typeOfLeaveId);
        if (existing) {
          existing.count++;
        } else {
          leaveTypesMap.set(shift.typeOfLeaveId, {
            id: shift.typeOfLeaveId,
            title: shift.typeOfLeaveTitle || shift.typeOfLeaveId, // Use title if available, otherwise ID
            color: shift.typeOfLeaveColor,
            count: 1
          });
        }
      }
    });

    // Sort by count descending
    return Array.from(leaveTypesMap.values()).sort((a, b) => b.count - a.count);
  }

  // ... (rest of the methods in TimetableLeaveUtils.ts remain the same) ...

  /**
   * Проверяет, есть ли в сменах хоть один тип отпуска с цветом
   */
  public static hasLeaveTypes(shifts: IShiftInfo[]): boolean {
    return shifts.some(shift => shift.typeOfLeaveId && shift.typeOfLeaveColor);
  }

  /**
   * Получает доминирующий цвет отпуска для дня (цвет типа отпуска, который встречается чаще всего)
   */
  public static getDominantLeaveColor(shifts: IShiftInfo[]): string | undefined {
    if (shifts.length === 0) {
      return undefined;
    }

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
   * Форматирует информацию о типах отпусков в дне для отображения
   */
  public static formatLeaveInfo(shifts: IShiftInfo[]): string {
    const leaveTypes = TimetableLeaveUtils.getUniqueLeaveTypes(shifts);

    if (leaveTypes.length === 0) {
      return '';
    }

    if (leaveTypes.length === 1) {
      // If only one type, just show the title
      return leaveTypes[0].title;
    }

    // If multiple types, show title and count for each
    return leaveTypes.map(lt => `${lt.title} (${lt.count})`).join(', ');
  }

  /**
   * Получает цвет для первого типа отпуска в списке смен, который имеет цвет.
   * Полезно, когда нужен один цвет, но нет необходимости определять доминирующий.
   */
  public static getFirstLeaveColor(shifts: IShiftInfo[]): string | undefined {
    const shiftWithLeave = shifts.find(shift => shift.typeOfLeaveColor);
    return shiftWithLeave?.typeOfLeaveColor;
  }

  /**
   * Проверяет, содержит ли день определенный тип отпуска по его ID
   */
  public static hasSpecificLeaveType(shifts: IShiftInfo[], leaveTypeId: string): boolean {
    return shifts.some(shift => shift.typeOfLeaveId === leaveTypeId);
  }

   /**
   * Получает все уникальные цвета отпусков в дне
   */
  public static getAllLeaveColors(shifts: IShiftInfo[]): string[] {
    const colorsSet = new Set<string>();
    shifts.forEach(shift => {
      if (shift.typeOfLeaveColor) {
        colorsSet.add(shift.typeOfLeaveColor);
      }
    });

    // Convert Set to Array for compatibility and easier use
    const colors: string[] = [];
    colorsSet.forEach(color => colors.push(color)); // ES5 compatible iteration
    return colors;
  }

  /**
   * Создает CSS градиент из нескольких цветов отпусков (для случая когда в дне несколько типов отпусков)
   */
  public static createLeaveColorsGradient(shifts: IShiftInfo[]): string | undefined {
    const colors = TimetableLeaveUtils.getAllLeaveColors(shifts);

    if (colors.length === 0) {
      return undefined;
    }

    if (colors.length === 1) {
      return colors[0]; // If only one color, return it directly
    }

    // Create a linear gradient string
    // Example: linear-gradient(45deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)
    const gradientStops = colors.map((color, index) => {
      const percentage = (index / (colors.length - 1)) * 100;
      return `${color} ${percentage}%`;
    }).join(', ');

    return `linear-gradient(45deg, ${gradientStops})`;
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
    const leaveTypes = TimetableLeaveUtils.getUniqueLeaveTypes(shifts);
    // Total shifts that have *any* type of leave ID defined
    const totalShiftsWithLeave = shifts.filter(s => s.typeOfLeaveId).length;

    const leaveTypeBreakdown = leaveTypes.map(lt => ({
      ...lt,
      percentage: totalShiftsWithLeave > 0 ? Math.round((lt.count / totalShiftsWithLeave) * 100) : 0
    }));

    // The most common type is the first one because getUniqueLeaveTypes sorts by count
    const mostCommonLeaveType = leaveTypes.length > 0 ? leaveTypes[0] : undefined;

    return {
      totalShiftsWithLeave,
      uniqueLeaveTypes: leaveTypes.length,
      leaveTypeBreakdown,
      mostCommonLeaveType
    };
  }

  /**
   * Применяет цветовую схему к списку смен (для отладки и визуализации)
   * Возвращает массив с расширенной информацией о цветовой схеме для каждой смены.
   */
  public static applyColorSchemeToShifts(shifts: IShiftInfo[]): Array<IShiftInfo & {
    colorScheme: {
      backgroundColor: string;
      textColor: string;
      borderColor: string;
    }
  }> {
    return shifts.map(shift => {
      let backgroundColor = '#ffffff'; // Default white
      let textColor = '#000000';     // Default black
      let borderColor = '#cccccc';     // Default grey

      if (shift.typeOfLeaveColor) {
        backgroundColor = shift.typeOfLeaveColor;

        // Determine text color based on background brightness using utility
        textColor = TimetableLeaveUtils.getTextColorForBackground(shift.typeOfLeaveColor);

        // Slightly darken the background color for the border using utility
        borderColor = TimetableLeaveUtils.darkenHexColor(shift.typeOfLeaveColor, 0.2); // Darken by 20%
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
    // Remove # if it exists
    const cleanedHex = hex.replace(/^#/, '');

    // Parse hex values
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(cleanedHex);

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
    const rgb = TimetableLeaveUtils.hexToRgb(hex);
    if (!rgb) return hex; // Return original if hex is invalid

    const factor = 1 - percent; // Calculate darkening factor

    const darken = (color: number) => Math.max(0, Math.floor(color * factor));

    const r = darken(rgb.r).toString(16).padStart(2, '0');
    const g = darken(rgb.g).toString(16).padStart(2, '0');
    const b = darken(rgb.b).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`;
  }

   /**
   * ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Конвертирует sRGB компонент цвета в линейное пространство.
   * Используется для расчета относительной яркости.
   */
  private static srgbToLinear(c: number): number {
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /**
   * Проверяет контрастность цвета для читаемости текста и возвращает #000000 (черный) или #ffffff (белый)
   */
  public static getTextColorForBackground(backgroundColor: string): string {
    const rgb = TimetableLeaveUtils.hexToRgb(backgroundColor);
    if (!rgb) return '#000000'; // Default to black if background color is invalid

    // Calculate relative luminance (WCAG 2.0 formula)
    const luminance = (0.2126 * TimetableLeaveUtils.srgbToLinear(rgb.r / 255)) +
                      (0.7152 * TimetableLeaveUtils.srgbToLinear(rgb.g / 255)) +
                      (0.0722 * TimetableLeaveUtils.srgbToLinear(rgb.b / 255));

    // Choose black or white based on luminance
    // A common threshold is 0.179 (derived from minimum contrast ratios)
    return luminance > 0.179 ? '#000000' : '#ffffff';
  }

  /**
   * Создает CSS стили для ячейки с отпуском
   * @returns React.CSSProperties object suitable for inline styles
   */
  public static createLeaveCellStyles(shifts: IShiftInfo[]): React.CSSProperties {
    const background = TimetableLeaveUtils.createLeaveColorsGradient(shifts);

    if (!background) {
      return {}; // Return empty object if no leave colors found
    }

    let textColor = '#000000'; // Default text color
    let borderColor = '#cccccc'; // Default border color
    let finalBackground: string | undefined = undefined; // Use this for the actual background property
    let textShadow: string | undefined = undefined;

    // If it's a single solid color (not a gradient), determine text/border color from it
    const singleColorMatch = /^#([a-f\d]{6}|[a-f\d]{3})$/i.exec(background);
    if (singleColorMatch) {
        finalBackground = background; // Use 'background' property
        textColor = TimetableLeaveUtils.getTextColorForBackground(background);
        borderColor = TimetableLeaveUtils.darkenHexColor(background, 0.2);
        if (textColor === '#ffffff') { // Add text shadow only if text is white
             textShadow = '0 1px 2px rgba(0,0,0,0.4)';
        }

    } else {
        // For gradients, apply to the 'background' property directly
        finalBackground = background;
        // For gradients, white text with shadow often works best across various colors
        textColor = '#ffffff';
        textShadow = '0 1px 2px rgba(0,0,0,0.4)';
        // For gradient border, maybe darken the first color?
        const firstColor = TimetableLeaveUtils.getAllLeaveColors(shifts)[0];
         if (firstColor) {
             borderColor = TimetableLeaveUtils.darkenHexColor(firstColor, 0.2);
         } else {
            borderColor = '#cccccc'; // Fallback default border
         }
    }

    // Return the style properties directly
    return {
      background: finalBackground, // Use 'background' for both solid and gradient
      color: textColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '3px', // Assuming you want rounded corners
      textShadow: textShadow,
      // Add other common text styles if needed, like fontWeight, fontSize etc.
      // fontWeight: 'bold', // Example
      // padding: '2px 4px', // Example
      // display: 'inline-block' // Example
    };
  }


  /**
   * Проверяет, пересекаются ли две смены по времени (с учетом перехода через полночь)
   * Возвращает true, если есть пересечение, false в противном случае.
   */
  public static doShiftsOverlap(shift1: IShiftInfo, shift2: IShiftInfo): boolean {
    // Note: This comparison is typically based on TIME OF DAY, not date.
    // Assuming shift dates are within the same day or adjacent days if crossing midnight.
    // A robust check for overlap considering midnight needs care.
    // Let's represent times as minutes from start of the day (or a conceptual 48-hour period for overnight)

    const timeToMinutes = (date: Date) => date.getHours() * 60 + date.getMinutes();

    const s1 = timeToMinutes(shift1.startTime);
    let e1 = timeToMinutes(shift1.endTime);
    const s2 = timeToMinutes(shift2.startTime);
    let e2 = timeToMinutes(shift2.endTime);
    const dayMinutes = 24 * 60;

    // Handle 00:00 end time. If start is not 00:00 and end is 00:00, the duration goes until midnight of the next day.
    // If start time is >= end time (and end time is not 00:00), it means it crosses midnight.
    // If end time is 00:00 and start time is not 00:00, the duration is until the *next* midnight.
    // If both are 00:00, it's an invalid shift (already filtered, but defensive check).

     if (s1 === 0 && e1 === 0) return false; // Invalid shift
     if (s2 === 0 && e2 === 0) return false; // Invalid shift

    // Adjust end times for overnight shifts into a 48h range
    if (e1 <= s1 && e1 !== 0) e1 += dayMinutes;
    else if (e1 === 0 && s1 !== 0) e1 = dayMinutes; // 00:00 end means end of the day cycle

    if (e2 <= s2 && e2 !== 0) e2 += dayMinutes;
    else if (e2 === 0 && s2 !== 0) e2 = dayMinutes; // 00:00 end means end of the day cycle


    // Check for overlap using normalized intervals [s1, e1) and [s2, e2)
    // They overlap if max(s1, s2) < min(e1, e2)
    // Equivalently, they don't overlap if e1 <= s2 or e2 <= s1
    return !(e1 <= s2 || e2 <= s1);
  }


  /**
   * Находит пары пересекающихся смен в списке
   */
  public static findOverlappingShifts(shifts: IShiftInfo[]): IShiftInfo[][] {
    const overlapping: IShiftInfo[][] = [];

    // Filter out shifts that are 00:00 - 00:00 as they don't represent a time period
    const comparableShifts = shifts.filter(s => !(s.startTime.getHours() === 0 && s.startTime.getMinutes() === 0 && s.endTime.getHours() === 0 && s.endTime.getMinutes() === 0));

    for (let i = 0; i < comparableShifts.length; i++) {
      // Start j from i + 1 to avoid comparing a shift with itself and to find unique pairs only once
      for (let j = i + 1; j < comparableShifts.length; j++) {
        // Check for overlap using the utility method
        if (TimetableLeaveUtils.doShiftsOverlap(comparableShifts[i], comparableShifts[j])) {
          overlapping.push([comparableShifts[i], comparableShifts[j]]);
        }
      }
    }

    return overlapping;
  }
}