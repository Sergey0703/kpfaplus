// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableShiftCalculatorCore.ts
import { 
  IShiftCalculationParams, 
  IShiftCalculationResult, 
  IShiftInfo,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { IStaffRecord } from '../../../../services/StaffRecordsService';

/**
 * Основные функции расчета смен и времени
 * Содержит базовую логику для расчета рабочих минут и обработки смен
 * ОБНОВЛЕНО: Версия 3.3 - ИСПРАВЛЕНО сохранение информации о типах отпусков для дней без смен
 */
export class TimetableShiftCalculatorCore {

  /**
   * Рассчитывает рабочие минуты для одной смены
   * ИСПРАВЛЕНО: Новый формат смены без пробела и в формате (HH:MM)
   * ОБНОВЛЕНО: Поддержка информации о типе отпуска и ПРАЗДНИКАХ
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
      typeOfLeaveColor,
      // НОВЫЕ: Поля для праздников
      isHoliday,
      holidayColor
    } = params;

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
        typeOfLeaveColor,
        // НОВЫЕ: Возвращаем данные о празднике
        isHoliday,
        holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY
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
        } else if (lunchEndMinutes < lunchStartMinutes) {
          // Обед через полночь (редкий случай)
          lunchMinutes = lunchEndMinutes + (24 * 60) - lunchStartMinutes;
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

    return {
      workMinutes,
      formattedTime,
      formattedShift,
      typeOfLeaveId,
      typeOfLeaveTitle,
      typeOfLeaveColor,
      // НОВЫЕ: Возвращаем данные о празднике
      isHoliday,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY
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
   * ОБНОВЛЕНО: Версия 3.3 - Поддержка записей без смен (только праздники/отпуска)
   */
  public static processStaffRecordsToShifts(
    records: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    if (records.length === 0) {
      return [];
    }

    console.log('[TimetableShiftCalculatorCore] Processing records with Holiday support (v3.3 - including non-work records and preserving leave type info):', {
      totalRecords: records.length,
      supportedFeatures: ['Leave Types', 'Holiday Field (red color)', 'Priority System', 'Non-work Records', 'Leave Type Info Preservation']
    });

    // *** НОВОЕ: Анализируем записи на наличие отметок без рабочего времени ***
    const recordsAnalysis = this.analyzeRecordsForNonWorkMarkers(records);
    console.log('[TimetableShiftCalculatorCore] Records analysis:', recordsAnalysis);

    // Фильтруем записи с рабочим временем (для создания смен)
    const validRecords = records.filter(record => {
      // Исключаем записи без времен или с нулевыми временами
      if (!record.ShiftDate1 || !record.ShiftDate2) {
        return false;
      }

      const start = new Date(record.ShiftDate1);
      const end = new Date(record.ShiftDate2);
      
      // Проверяем валидность дат
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return false;
      }
      
      const startStr = this.formatTime(start);
      const endStr = this.formatTime(end);

      // Исключаем записи где оба времени 00:00 (это могут быть отметки праздников/отпусков без работы)
      if (startStr === "00:00" && endStr === "00:00") {
        return false;
      }

      return true;
    });

    console.log(`[TimetableShiftCalculatorCore] Valid work records: ${validRecords.length}/${records.length}`);

    if (validRecords.length === 0) {
      // *** НОВОЕ: Даже если нет рабочих смен, могут быть отметки праздников/отпусков ***
      console.log(`[TimetableShiftCalculatorCore] No work shifts found, but may have holiday/leave markers`);
      return [];
    }

    // Анализируем Holiday поля в записях (включая записи без рабочего времени)
    const holidayAnalysis = this.analyzeHolidayRecords(records); // Анализируем ВСЕ записи, не только с рабочим временем
    console.log('[TimetableShiftCalculatorCore] Holiday analysis (all records):', holidayAnalysis);

    // Сортируем по времени начала (аналогично "ShiftDate1", "Ascending")
    const sortedRecords = validRecords.sort((a, b) => {
      const aStart = new Date(a.ShiftDate1!).getTime();
      const bStart = new Date(b.ShiftDate1!).getTime();
      return aStart - bStart;
    });

    // Продолжение в следующей части...
    return this.createShiftsFromRecords(sortedRecords, getLeaveTypeColor);
  }
  /**
   * НОВЫЙ МЕТОД: Создает смены из отсортированных записей
   * Выделен для упрощения основного метода processStaffRecordsToShifts
   */
  private static createShiftsFromRecords(
    sortedRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
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

      // СУЩЕСТВУЮЩАЯ ОБРАБОТКА: Типы отпусков
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

      // НОВАЯ ОБРАБОТКА: Праздники (Holiday = 1)
      let isHoliday = false;
      let holidayColor: string | undefined = undefined;

      if (record.Holiday === 1) {
        isHoliday = true;
        holidayColor = TIMETABLE_COLORS.HOLIDAY;
      }

      const calculation = this.calculateShiftMinutes({
        startTime,
        endTime,
        lunchStart: lunchStart && !isNaN(lunchStart.getTime()) ? lunchStart : undefined,
        lunchEnd: lunchEnd && !isNaN(lunchEnd.getTime()) ? lunchEnd : undefined,
        timeForLunch,
        typeOfLeaveId,
        typeOfLeaveTitle,
        typeOfLeaveColor,
        // НОВЫЕ: Передаем данные о празднике
        isHoliday,
        holidayColor
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
        typeOfLeaveColor: calculation.typeOfLeaveColor,
        // НОВЫЕ: Добавляем данные о празднике
        isHoliday: calculation.isHoliday,
        holidayColor: calculation.holidayColor
      };
    });

    console.log('[TimetableShiftCalculatorCore] Processed shifts with Holiday support:', {
      totalShifts: shifts.length,
      shiftsWithHoliday: shifts.filter(s => s.isHoliday).length,
      shiftsWithLeave: shifts.filter(s => s.typeOfLeaveId).length,
      shiftsWithBoth: shifts.filter(s => s.isHoliday && s.typeOfLeaveId).length
    });
    
    // Логируем несколько примеров для отладки
    if (shifts.length > 0) {
      shifts.slice(0, 3).forEach((shift, index) => {
        const colorInfo = shift.isHoliday ? 
          `🔴 HOLIDAY: ${shift.holidayColor}` : 
          shift.typeOfLeaveColor ? 
            `🟡 LEAVE: ${shift.typeOfLeaveColor}` : 
            '⚪ DEFAULT';
        console.log(`  Shift ${index + 1}: ${shift.formattedShift} (${shift.workMinutes} min) - ${colorInfo}`);
      });
    }

    return shifts;
  }

  /**
   * НОВЫЙ МЕТОД: Анализирует записи на наличие отметок без рабочего времени
   * Версия 3.3: Помогает определить записи с только праздниками/отпусками
   */
  private static analyzeRecordsForNonWorkMarkers(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithWorkTime: number;
    recordsWithoutWorkTime: number;
    nonWorkHolidayRecords: number;
    nonWorkLeaveRecords: number;
    nonWorkRecordsWithBoth: number;
  } {
    const totalRecords = records.length;
    let recordsWithWorkTime = 0;
    let recordsWithoutWorkTime = 0;
    let nonWorkHolidayRecords = 0;
    let nonWorkLeaveRecords = 0;
    let nonWorkRecordsWithBoth = 0;

    records.forEach(record => {
      // Проверяем есть ли рабочее время
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      if (hasWorkTime) {
        recordsWithWorkTime++;
      } else {
        recordsWithoutWorkTime++;

        // Анализируем записи без рабочего времени на предмет отметок
        const isHoliday = record.Holiday === 1;
        const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';

        if (isHoliday && hasLeaveType) {
          nonWorkRecordsWithBoth++;
        } else if (isHoliday) {
          nonWorkHolidayRecords++;
        } else if (hasLeaveType) {
          nonWorkLeaveRecords++;
        }
      }
    });

    return {
      totalRecords,
      recordsWithWorkTime,
      recordsWithoutWorkTime,
      nonWorkHolidayRecords,
      nonWorkLeaveRecords,
      nonWorkRecordsWithBoth
    };
  }

  /**
   * ОБНОВЛЕННЫЙ МЕТОД: Анализирует записи на наличие праздников (включая записи без рабочего времени)
   */
  private static analyzeHolidayRecords(records: IStaffRecord[]): {
    totalRecords: number;
    recordsWithHoliday: number;
    recordsWithLeaveType: number;
    recordsWithBoth: number;
    holidayPercentage: number;
    workHolidayRecords: number;
    nonWorkHolidayRecords: number;
  } {
    const totalRecords = records.length;
    const recordsWithHoliday = records.filter(r => r.Holiday === 1).length;
    const recordsWithLeaveType = records.filter(r => r.TypeOfLeaveID).length;
    const recordsWithBoth = records.filter(r => r.Holiday === 1 && r.TypeOfLeaveID).length;
    const holidayPercentage = totalRecords > 0 ? Math.round((recordsWithHoliday / totalRecords) * 100) : 0;

    // *** НОВОЕ: Разделяем записи с праздниками на рабочие и нерабочие ***
    let workHolidayRecords = 0;
    let nonWorkHolidayRecords = 0;

    records.filter(r => r.Holiday === 1).forEach(record => {
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      if (hasWorkTime) {
        workHolidayRecords++;
      } else {
        nonWorkHolidayRecords++;
      }
    });

    return {
      totalRecords,
      recordsWithHoliday,
      recordsWithLeaveType,
      recordsWithBoth,
      holidayPercentage,
      workHolidayRecords,
      nonWorkHolidayRecords
    };
  }

  /**
   * *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ ДЛЯ ПРОБЛЕМЫ С ОТПУСКАМИ ***
   * НОВЫЙ МЕТОД: Извлекает информацию о типе отпуска из записей дня без рабочего времени
   * Версия 3.3: Решает проблему потери информации о типах отпусков
   */
  public static extractLeaveInfoFromNonWorkRecords(
    allDayRecords: IStaffRecord[],
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): {
    hasNonWorkLeave: boolean;
    leaveTypeId?: string;
    leaveTypeTitle?: string;
    leaveTypeColor?: string;
  } {
    // Ищем записи без рабочего времени, но с типом отпуска
    const nonWorkLeaveRecords = allDayRecords.filter(record => {
      // Проверяем что нет рабочего времени
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);
      
      // Но есть тип отпуска
      const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';
      
      return !hasWorkTime && hasLeaveType;
    });

    if (nonWorkLeaveRecords.length === 0) {
      return { hasNonWorkLeave: false };
    }

    // Берем первую найденную запись с отпуском
    const leaveRecord = nonWorkLeaveRecords[0];
    const leaveTypeId = leaveRecord.TypeOfLeaveID;
    
    // Получаем название и цвет
    const leaveTypeTitle = leaveRecord.TypeOfLeave?.Title || leaveTypeId;
    const leaveTypeColor = getLeaveTypeColor ? getLeaveTypeColor(leaveTypeId!) : undefined;

    console.log(`[TimetableShiftCalculatorCore] *** ИЗВЛЕЧЕНА ИНФОРМАЦИЯ О ТИПЕ ОТПУСКА ***`, {
      recordId: leaveRecord.ID,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor,
      hasColor: !!leaveTypeColor,
      solution: 'Теперь информация о типе отпуска будет сохранена в dayData'
    });

    return {
      hasNonWorkLeave: true,
      leaveTypeId,
      leaveTypeTitle,
      leaveTypeColor
    };
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
   * ОБНОВЛЕНО: Поддержка функции получения цвета типа отпуска и праздников
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
      
      return isCorrectDay && isInWeek;
    });

    return this.processStaffRecordsToShifts(dayRecords, getLeaveTypeColor);
  }

  /**
   * НОВЫЙ МЕТОД: Получает ВСЕ записи для конкретного дня недели (включая без рабочего времени)
   * Версия 3.3: Для анализа записей без смен, но с отметками праздников/отпусков
   */
  public static getAllRecordsForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date
  ): IStaffRecord[] {
    // Фильтруем ВСЕ записи для конкретного дня недели в указанной неделе
    const dayRecords = records.filter(record => {
      const recordDate = new Date(record.Date);
      
      if (isNaN(recordDate.getTime())) {
        return false;
      }

      const recordDayNumber = this.getDayNumber(recordDate);
      
      const isInWeek = recordDate >= weekStart && recordDate <= weekEnd;
      const isCorrectDay = recordDayNumber === dayNumber;
      
      return isCorrectDay && isInWeek;
    });

    return dayRecords;
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

  /**
   * НОВЫЙ МЕТОД: Анализирует записи дня на предмет праздников/отпусков без рабочего времени
   * Версия 3.3: Помогает определить дни с только отметками (без смен)
   */
  public static analyzeNonWorkMarkersForDay(
    dayRecords: IStaffRecord[]
  ): {
    hasNonWorkHoliday: boolean;
    hasNonWorkLeave: boolean;
    nonWorkLeaveTypeId?: string;
    nonWorkHolidayRecords: number;
    nonWorkLeaveRecords: number;
  } {
    let hasNonWorkHoliday = false;
    let hasNonWorkLeave = false;
    let nonWorkLeaveTypeId: string | undefined = undefined;
    let nonWorkHolidayRecords = 0;
    let nonWorkLeaveRecords = 0;

    dayRecords.forEach(record => {
      // Проверяем есть ли рабочее время в этой записи
      const hasWorkTime = record.ShiftDate1 && record.ShiftDate2 && 
        !(record.ShiftDate1.getHours() === 0 && record.ShiftDate1.getMinutes() === 0 && 
          record.ShiftDate2.getHours() === 0 && record.ShiftDate2.getMinutes() === 0);

      // Если нет рабочего времени, но есть отметки
      if (!hasWorkTime) {
        const isHoliday = record.Holiday === 1;
        const hasLeaveType = record.TypeOfLeaveID && record.TypeOfLeaveID !== '0';

        if (isHoliday) {
          hasNonWorkHoliday = true;
          nonWorkHolidayRecords++;
        }
        
        if (hasLeaveType) {
          hasNonWorkLeave = true;
          nonWorkLeaveRecords++;
          nonWorkLeaveTypeId = record.TypeOfLeaveID;
        }
      }
    });

    return {
      hasNonWorkHoliday,
      hasNonWorkLeave,
      nonWorkLeaveTypeId,
      nonWorkHolidayRecords,
      nonWorkLeaveRecords
    };
  }

  /**
   * НОВЫЙ МЕТОД: Создает "пустую" смену для отметки праздника без рабочего времени
   * Версия 3.3: Для отображения праздничных дней без смен
   */
  public static createNonWorkHolidayMarker(
    recordId: string,
    date: Date,
    holidayColor?: string
  ): IShiftInfo {
    // Создаем фиктивные времена 00:00
    const zeroTime = new Date(date);
    zeroTime.setHours(0, 0, 0, 0);

    return {
      recordId: recordId,
      startTime: zeroTime,
      endTime: zeroTime,
      lunchStart: undefined,
      lunchEnd: undefined,
      timeForLunch: 0,
      workMinutes: 0,
      formattedShift: "Holiday", // Вместо времени показываем "Holiday"
      typeOfLeaveId: undefined,
      typeOfLeaveTitle: undefined,
      typeOfLeaveColor: undefined,
      // Отмечаем как праздник
      isHoliday: true,
      holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY
    };
  }

  /**
   * НОВЫЙ МЕТОД: Создает "пустую" смену для отметки отпуска без рабочего времени
   * Версия 3.3: Для отображения дней отпуска без смен
   */
  public static createNonWorkLeaveMarker(
    recordId: string,
    date: Date,
    leaveTypeId: string,
    leaveTypeTitle?: string,
    leaveTypeColor?: string
  ): IShiftInfo {
    // Создаем фиктивные времена 00:00
    const zeroTime = new Date(date);
    zeroTime.setHours(0, 0, 0, 0);

    return {
      recordId: recordId,
      startTime: zeroTime,
      endTime: zeroTime,
      lunchStart: undefined,
      lunchEnd: undefined,
      timeForLunch: 0,
      workMinutes: 0,
      formattedShift: "Leave", // Вместо времени показываем "Leave"
      typeOfLeaveId: leaveTypeId,
      typeOfLeaveTitle: leaveTypeTitle || leaveTypeId,
      typeOfLeaveColor: leaveTypeColor,
      // НЕ праздник
      isHoliday: false,
      holidayColor: undefined
    };
  }

  /**
   * НОВЫЙ МЕТОД: Получает смены И отметки для дня (включая дни без рабочего времени)
   * Версия 3.3: Объединяет рабочие смены с отметками праздников/отпусков
   */
  public static getShiftsAndMarkersForDay(
    records: IStaffRecord[],
    dayNumber: number,
    weekStart: Date,
    weekEnd: Date,
    getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
  ): IShiftInfo[] {
    // Получаем все записи дня
    const allDayRecords = this.getAllRecordsForDay(records, dayNumber, weekStart, weekEnd);
    
    if (allDayRecords.length === 0) {
      return [];
    }

    console.log(`[TimetableShiftCalculatorCore] Processing day ${dayNumber} with ${allDayRecords.length} total records (including markers)`);

    // Получаем обычные смены (с рабочим временем)
    const workShifts = this.getShiftsForDay(records, dayNumber, weekStart, weekEnd, getLeaveTypeColor);

    // Анализируем записи без рабочего времени
    const nonWorkAnalysis = this.analyzeNonWorkMarkersForDay(allDayRecords);

    const allShiftsAndMarkers: IShiftInfo[] = [...workShifts];

    // Добавляем отметки праздников без рабочего времени
    if (nonWorkAnalysis.hasNonWorkHoliday && workShifts.length === 0) {
      // Создаем отметку праздника только если нет рабочих смен
      const holidayRecord = allDayRecords.find(r => r.Holiday === 1 && 
        !(r.ShiftDate1 && r.ShiftDate2 && 
          !(r.ShiftDate1.getHours() === 0 && r.ShiftDate1.getMinutes() === 0 && 
            r.ShiftDate2.getHours() === 0 && r.ShiftDate2.getMinutes() === 0)));
      
      if (holidayRecord) {
        const dayDate = this.getDateForDayInWeek(weekStart, dayNumber);
        const holidayMarker = this.createNonWorkHolidayMarker(
          holidayRecord.ID, 
          dayDate,
          TIMETABLE_COLORS.HOLIDAY
        );
        allShiftsAndMarkers.push(holidayMarker);
        console.log(`[TimetableShiftCalculatorCore] Added holiday marker for day ${dayNumber}`);
      }
    }

    // Добавляем отметки отпусков без рабочего времени
    if (nonWorkAnalysis.hasNonWorkLeave && workShifts.length === 0 && !nonWorkAnalysis.hasNonWorkHoliday) {
      // Создаем отметку отпуска только если нет рабочих смен и нет праздника
      const leaveRecord = allDayRecords.find(r => r.TypeOfLeaveID && r.TypeOfLeaveID !== '0' &&
        !(r.ShiftDate1 && r.ShiftDate2 && 
          !(r.ShiftDate1.getHours() === 0 && r.ShiftDate1.getMinutes() === 0 && 
            r.ShiftDate2.getHours() === 0 && r.ShiftDate2.getMinutes() === 0)));
      
      if (leaveRecord && nonWorkAnalysis.nonWorkLeaveTypeId) {
        const dayDate = this.getDateForDayInWeek(weekStart, dayNumber);
        const leaveTypeColor = getLeaveTypeColor ? getLeaveTypeColor(nonWorkAnalysis.nonWorkLeaveTypeId) : undefined;
        const leaveTypeTitle = leaveRecord.TypeOfLeave?.Title || nonWorkAnalysis.nonWorkLeaveTypeId;
        
        const leaveMarker = this.createNonWorkLeaveMarker(
          leaveRecord.ID,
          dayDate,
          nonWorkAnalysis.nonWorkLeaveTypeId,
          leaveTypeTitle,
          leaveTypeColor
        );
        allShiftsAndMarkers.push(leaveMarker);
        console.log(`[TimetableShiftCalculatorCore] Added leave marker for day ${dayNumber}, type: ${nonWorkAnalysis.nonWorkLeaveTypeId}`);
      }
    }

    console.log(`[TimetableShiftCalculatorCore] Day ${dayNumber} result: ${workShifts.length} work shifts + ${allShiftsAndMarkers.length - workShifts.length} markers = ${allShiftsAndMarkers.length} total`);

    return allShiftsAndMarkers;
  }

  /**
   * ВСПОМОГАТЕЛЬНЫЙ МЕТОД: Получает дату для дня недели в рамках недели
   */
  private static getDateForDayInWeek(weekStart: Date, dayNumber: number): Date {
    const date = new Date(weekStart);
    const startDayNumber = this.getDayNumber(weekStart);
    
    let offset = dayNumber - startDayNumber;
    if (offset < 0) {
      offset += 7;
    }
    
    date.setDate(weekStart.getDate() + offset);
    return date;
  }
}