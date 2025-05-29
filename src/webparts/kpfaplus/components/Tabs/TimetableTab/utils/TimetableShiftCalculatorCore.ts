// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorCore.ts
import { 
  IShiftCalculationParams, 
  IShiftCalculationResult, 
  IShiftInfo 
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Основные функции расчета смен и времени
 * Содержит базовую логику для расчета рабочих минут и обработки смен
 */
export class TimetableShiftCalculatorCore {

  /**
   * Рассчитывает рабочие минуты для одной смены
   * ИСПРАВЛЕНО: Новый формат смены без пробела и в формате (HH:MM)
   * ОБНОВЛЕНО: Поддержка информации о типе отпуска
   */
  public static calculateShiftMinutes(params: IShiftCalculationParams): IShiftCalculationResult {
    const { 
      startTime, 
      endTime, 
      lunchStart, 
      lunchEnd, 
      timeForLunch, 
      typeOfLeaveId, 
      typeOfLeaveTitle, 
      typeOfLeaveColor 
    } = params;

    console.log('[TimetableShiftCalculatorCore] Calculating shift:', {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      lunchStart: lunchStart?.toISOString(),
      lunchEnd: lunchEnd?.toISOString(),
      timeForLunch,
      typeOfLeaveId,
      typeOfLeaveColor
    });

    // Проверяем на нулевые времена (00:00)
    const startHour = startTime.getHours();
    const startMinute = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinute = endTime.getMinutes();

    const isStartZero = startHour === 0 && startMinute === 0;
    const isEndZero = endHour === 0 && endMinute === 0;

    // Если оба времени нулевые, нет рабочего времени
    if (isStartZero && isEndZero) {
      return {
        workMinutes: 0,
        formattedTime: "0h 00m",
        formattedShift: "00:00 - 00:00(0:00)",
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor
      };
    }

    // Конвертируем времена в минуты
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    // Рассчитываем общее время смены с учетом перехода через полночь
    let totalShiftMinutes = 0;

    if (endMinutes <= startMinutes && endMinutes > 0) {
      // Переход через полночь
      totalShiftMinutes = endMinutes + (24 * 60) - startMinutes;
    } else if (endMinutes === 0) {
      // Конец смены в 00:00 (полночь следующего дня)
      totalShiftMinutes = (24 * 60) - startMinutes;
    } else {
      // Обычная смена в пределах одних суток
      totalShiftMinutes = endMinutes - startMinutes;
    }

    // Рассчитываем время обеда
    let lunchMinutes = 0;

    // Приоритет у timeForLunch если доступно
    if (timeForLunch && timeForLunch > 0) {
      lunchMinutes = timeForLunch;
      console.log('[TimetableShiftCalculatorCore] Using timeForLunch:', timeForLunch);
    } else if (lunchStart && lunchEnd) {
      // Рассчитываем время обеда из ShiftDate3 и ShiftDate4
      const lunchStartHour = lunchStart.getHours();
      const lunchStartMinute = lunchStart.getMinutes();
      const lunchEndHour = lunchEnd.getHours();
      const lunchEndMinute = lunchEnd.getMinutes();

      // Проверяем, не являются ли времена обеда нулевыми
      const isLunchStartZero = lunchStartHour === 0 && lunchStartMinute === 0;
      const isLunchEndZero = lunchEndHour === 0 && lunchEndMinute === 0;

      if (!isLunchStartZero || !isLunchEndZero) {
        const lunchStartMinutes = lunchStartHour * 60 + lunchStartMinute;
        const lunchEndMinutes = lunchEndHour * 60 + lunchEndMinute;
        
        if (lunchEndMinutes > lunchStartMinutes) {
          lunchMinutes = lunchEndMinutes - lunchStartMinutes;
          console.log('[TimetableShiftCalculatorCore] Using calculated lunch time:', lunchMinutes);
        } else if (lunchEndMinutes < lunchStartMinutes) {
          // Обед через полночь (редкий случай)
          lunchMinutes = lunchEndMinutes + (24 * 60) - lunchStartMinutes;
          console.log('[TimetableShiftCalculatorCore] Using calculated lunch time (overnight):', lunchMinutes);
        }
      }
    }

    // Вычитаем время обеда из общего времени смены
    const workMinutes = Math.max(0, totalShiftMinutes - lunchMinutes);

    // Форматируем результат
    const formattedTime = this.formatMinutesToHours(workMinutes); // Для Total - остается как есть
    const startTimeStr = this.formatTime(startTime);
    const endTimeStr = this.formatTime(endTime);
    
    // НОВЫЙ ФОРМАТ: "10:00 - 00:00(13:45)" вместо "10:00 - 00:00 (13h 45m)"
    const formattedWorkTime = this.formatMinutesToHoursMinutes(workMinutes);
    const formattedShift = `${startTimeStr}-${endTimeStr}(${formattedWorkTime})`;

    console.log('[TimetableShiftCalculatorCore] Calculated result:', {
      totalShiftMinutes,
      lunchMinutes,
      workMinutes,
      formattedTime,
      formattedShift,
      typeOfLeaveColor
    });

    return {
      workMinutes,
      formattedTime,
      formattedShift,
      typeOfLeaveId,
      typeOfLeaveTitle,
      typeOfLeaveColor
    };
  }

  /**
   * НОВЫЙ МЕТОД: Форматирует минуты в формат HH:MM для смен
   * Используется только для отдельных смен, НЕ для Total
   */
  public static formatMinutesToHoursMinutes(totalMinutes: number): string {
    if (totalMinutes === 0) {
      return "0:00";
    }

    if (totalMinutes < 0) {
      return "0:00"; // Защита от отрицательных значений
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Обрабатывает записи StaffRecord в IShiftInfo
   * Реплицирует логику сортировки и обработки смен из Power Apps
   * ОБНОВЛЕНО: Поддержка информации о типах отпусков
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    if (records.length === 0) {
      return [];
    }

    // Фильтруем и сортируем записи (аналогично SortByColumns в Power Apps)
    const validRecords = records.filter(record => {
      // Исключаем записи без времен или с нулевыми временами
      if (!record.ShiftDate1 || !record.ShiftDate2) {
        console.log(`[TimetableShiftCalculatorCore] Skipping record ${record.ID}: missing ShiftDate1 or ShiftDate2`);
        return false;
      }

      const start = new Date(record.ShiftDate1);
      const end = new Date(record.ShiftDate2);
      
      // Проверяем валидность дат
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.log(`[TimetableShiftCalculatorCore] Skipping record ${record.ID}: invalid dates`);
        return false;
      }
      
      const startStr = this.formatTime(start);
      const endStr = this.formatTime(end);

      // Исключаем записи где оба времени 00:00
      if (startStr === "00:00" && endStr === "00:00") {
        console.log(`[TimetableShiftCalculatorCore] Skipping record ${record.ID}: both times are 00:00`);
        return false;
      }

      return true;
    });

    console.log(`[TimetableShiftCalculatorCore] Valid records: ${validRecords.length}/${records.length}`);

    if (validRecords.length === 0) {
      return [];
    }

    // Сортируем по времени начала (аналогично "ShiftDate1", "Ascending")
    const sortedRecords = validRecords.sort((a, b) => {
      const aStart = new Date(a.ShiftDate1!).getTime();
      const bStart = new Date(b.ShiftDate1!).getTime();
      return aStart - bStart;
    });

    // Преобразуем в IShiftInfo
    const shifts: IShiftInfo[] = sortedRecords.map(record => {
      const startTime = new Date(record.ShiftDate1!);
      const endTime = new Date(record.ShiftDate2!);
      const lunchStart = record.ShiftDate3 ? new Date(record.ShiftDate3) : undefined;
      const lunchEnd = record.ShiftDate4 ? new Date(record.ShiftDate4) : undefined;
      const timeForLunch = record.TimeForLunch || 0;

      // Проверяем валидность дат обеда
      if (lunchStart && isNaN(lunchStart.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] Invalid ShiftDate3 in record ${record.ID}`);
      }
      if (lunchEnd && isNaN(lunchEnd.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] Invalid ShiftDate4 in record ${record.ID}`);
      }

      // ДОБАВЛЕНО: Обработка типа отпуска
      let typeOfLeaveId: string | undefined = undefined;
      let typeOfLeaveTitle: string | undefined = undefined;
      let typeOfLeaveColor: string | undefined = undefined;

      if (record.TypeOfLeaveID) {
        typeOfLeaveId = record.TypeOfLeaveID;
        
        // Получаем цвет типа отпуска если доступна функция
        if (getLeaveTypeColor) {
          typeOfLeaveColor = getLeaveTypeColor(typeOfLeaveId);
        }
        
        // Получаем название типа отпуска если доступно
        if (record.TypeOfLeave) {
          typeOfLeaveTitle = record.TypeOfLeave.Title;
        }

        if (typeOfLeaveColor) {
          console.log(`[TimetableShiftCalculatorCore] Applied leave type ${typeOfLeaveId} with color ${typeOfLeaveColor} to shift ${record.ID}`);
        }
      }

      const calculation = this.calculateShiftMinutes({
        startTime,
        endTime,
        lunchStart: lunchStart && !isNaN(lunchStart.getTime()) ? lunchStart : undefined,
        lunchEnd: lunchEnd && !isNaN(lunchEnd.getTime()) ? lunchEnd : undefined,
        timeForLunch,
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor
      });

      return {
        recordId: record.ID,
        startTime,
        endTime,
        lunchStart,
        lunchEnd,
        timeForLunch,
        workMinutes: calculation.workMinutes,
        formattedShift: calculation.formattedShift,
        typeOfLeaveId: calculation.typeOfLeaveId,
        typeOfLeaveTitle: calculation.typeOfLeaveTitle,
        typeOfLeaveColor: calculation.typeOfLeaveColor
      };
    });

    console.log('[TimetableShiftCalculatorCore] Processed shifts:', shifts.length);
    
    // Логируем несколько примеров для отладки
    if (shifts.length > 0) {
      console.log('[TimetableShiftCalculatorCore] Sample shifts:');
      shifts.slice(0, 3).forEach((shift, index) => {
        console.log(`  Shift ${index + 1}: ${shift.formattedShift} (${shift.workMinutes} min)${shift.typeOfLeaveColor ? ` - Leave color: ${shift.typeOfLeaveColor}` : ''}`);
      });
    }

    return shifts;
  }

  /**
   * Форматирует содержимое дня (аналогично FormatDayShifts в Power Apps)
   */
  public static formatDayContent(shifts: IShiftInfo[]): string {
    if (shifts.length === 0) {
      return "";
    }

    // Формируем строки смен (аналогично Concat в Power Apps)
    const shiftLines = shifts.map(shift => shift.formattedShift);
    
    let content = shiftLines.join(";\n");

    // Если несколько смен, добавляем общий итог
    if (shifts.length > 1) {
      const totalMinutes = shifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
      const totalFormatted = this.formatMinutesToHours(totalMinutes); // Total остается в старом формате
      content += `\nTotal: ${totalFormatted}`;
    }

    return content;
  }

  /**
   * Рассчитывает недельные часы для сотрудника
   * Реплицирует CalculateWeeklyHours из Power Apps
   */
  public static calculateWeeklyHours(
    allShifts: IShiftInfo[]
  ): { totalMinutes: number; formattedTotal: string } {
    const totalMinutes = allShifts.reduce((sum, shift) => sum + shift.workMinutes, 0);
    const formattedTotal = this.formatMinutesToHours(totalMinutes); // Total остается в старом формате
    
    return {
      totalMinutes,
      formattedTotal: ` ${formattedTotal}` // Пробел в начале как в Power Apps
    };
  }

  /**
   * Форматирует минуты в часы и минуты (аналогично FormatMinutesToHours в Power Apps)
   * ИСПОЛЬЗУЕТСЯ ТОЛЬКО ДЛЯ TOTAL - остается в формате "26h 30m"
   */
  public static formatMinutesToHours(totalMinutes: number): string {
    if (totalMinutes === 0) {
      return "0h 00m";
    }

    if (totalMinutes < 0) {
      return "0h 00m"; // Защита от отрицательных значений
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
  }

  /**
   * Форматирует время в формате HH:mm
   */
  public static formatTime(date: Date): string {
    if (isNaN(date.getTime())) {
      return "00:00"; // Защита от невалидных дат
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Форматирует время в формате HH:mm:ss
   */
  public static formatTimeWithSeconds(date: Date): string {
    if (isNaN(date.getTime())) {
      return "00:00:00";
    }

    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Получает все смены для конкретного дня недели из записей
   * ОБНОВЛЕНО: Поддержка функции получения цвета типа отпуска
   */
  public static getShiftsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    // Фильтруем записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        console.warn(`[TimetableShiftCalculatorCore] Invalid date in record ${record.ID}`);
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      if (isCorrectDay && isInWeek) {
        console.log(`[TimetableShiftCalculatorCore] Found record for day ${dayNumber}: ${record.ID} on ${recordDate.toLocaleDateString()}`);
      }
      
      return isCorrectDay && isInWeek;
    });

    return this.processStaffRecordsToShifts(dayRecords, getLeaveTypeColor);
  }

  /**
   * Получает номер дня недели для даты (1=Sunday, 2=Monday, etc.)
   */
  public static getDayNumber(date: Date): number {
    if (isNaN(date.getTime())) {
      return 1; // По умолчанию воскресенье
    }
    return date.getDay() + 1; // JS: 0=Sunday -> наш формат: 1=Sunday
  }

  /**
   * Получает название дня недели по номеру
   */
  public static getDayName(dayNumber: number): string {
    const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return dayNames[dayNumber] || 'Unknown';
  }
}