// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorLeaveTypesExcel.ts
import { 
  IShiftInfo, 
  TIMETABLE_COLORS, 
  ColorPriority, 
  IDayInfo
} from '../interfaces/TimetableInterfaces';
import { TimetableShiftCalculatorLeaveTypesCore } from './TimetableShiftCalculatorLeaveTypesCore';

/**
 * СПЕЦИАЛИЗАЦИЯ ДЛЯ EXCEL ЭКСПОРТА
 * Содержит методы для создания Excel файлов с поддержкой праздников/отпусков
 * Версия 3.2 - Максимальная поддержка отметок без рабочих смен
 */
export class TimetableShiftCalculatorLeaveTypesExcel {

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
    // FIXED: Changed 'any' to specific ExcelJS types
    excelFillPattern?: {
      type: string;
      pattern: string;
      fgColor: { argb: string };
    };
    excelFont?: {
      color: { argb: string };
      bold?: boolean;
    };
  } {
    console.log('[TimetableShiftCalculatorLeaveTypesExcel] Creating Excel cell styles with full markers support v3.2');

    // *** РАСШИРЕННЫЙ АНАЛИЗ ДЛЯ EXCEL ВКЛЮЧАЯ ДНИ БЕЗ СМЕН ***
    const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasHolidayInShifts = shifts.some(s => s.isHoliday);
    const hasLeaveInShifts = shifts.some(s => s.typeOfLeaveId);
    
    // *** НОВОЕ: Анализ отметок из dayData (дни без смен) ***
    const hasHolidayMarker = dayData?.hasHoliday && !hasWorkShifts;
    const hasLeaveMarker = dayData?.hasLeave && !hasWorkShifts && !hasHolidayMarker;
    
    const finalHasHoliday = hasHolidayInShifts || hasHolidayMarker;
    const finalHasLeave = hasLeaveInShifts || hasLeaveMarker;

    console.log('[TimetableShiftCalculatorLeaveTypesExcel] Excel cell analysis:', {
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
      
      console.log(`[TimetableShiftCalculatorLeaveTypesExcel] 🔴 Excel HOLIDAY color applied: ${backgroundColor}`);
    } else if (finalHasLeave) {
      // Определяем цвет отпуска
      let leaveColor: string | undefined;
      
      if (hasLeaveInShifts && getLeaveTypeColor) {
        // Цвет из смен с работой
        leaveColor = TimetableShiftCalculatorLeaveTypesCore.getDominantLeaveColor(shifts, getLeaveTypeColor);
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
        
        console.log(`[TimetableShiftCalculatorLeaveTypesExcel] 🟡 Excel LEAVE color applied: ${backgroundColor}`);
      }
    }

    // Определяем цвет текста
    const textColor = TimetableShiftCalculatorLeaveTypesCore.getTextColorForBackground(backgroundColor);
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
    console.log('[TimetableShiftCalculatorLeaveTypesExcel] Analyzing day data for Excel export v3.2');

    const hasWorkShifts = shifts.some(s => s.workMinutes > 0);
    const hasHolidayInShifts = shifts.some(s => s.isHoliday);
    const hasLeaveInShifts = shifts.some(s => s.typeOfLeaveId);
    
    // Анализ отметок без работы - ИСПРАВЛЕНО: Принудительное приведение к boolean
    const hasHolidayMarker = !!(dayData?.hasHoliday && !hasWorkShifts);
    const hasLeaveMarker = !!(dayData?.hasLeave && !hasWorkShifts && !hasHolidayMarker);
    
    // Все переменные теперь точно boolean
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

    console.log('[TimetableShiftCalculatorLeaveTypesExcel] Excel day analysis result:', analysis);
    return analysis;
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Получает статистику по Excel экспорту
   */
  public static getExcelExportStatistics(
    // FIXED: Changed 'any' to proper interface type
    weeksData: Array<{
      weekInfo: {
        weekNum: number;
        weekStart: Date;
        weekEnd: Date;
      };
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
    // FIXED: Changed 'any' to proper interface type
    weeksData: Array<{
      weekInfo: {
        weekNum: number;
        weekStart: Date;
        weekEnd: Date;
      };
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
}