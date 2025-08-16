// src/webparts/kpfaplus/components/Tabs/TimetableTab/timetableTabUtils.ts
// ОБНОВЛЕНО v5.0: Полная поддержка Date-only формата + числовые поля времени

import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { IDayInfo, IShiftInfo } from './interfaces/TimetableInterfaces';

// Константы
export const calendarMinWidth = '655px';

// Локализация для DatePicker
export const datePickerStringsEN = {
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  shortMonths: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  days: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ],
  shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  goToToday: 'Go to today',
  weekNumberFormatString: 'Week number {0}',
  prevMonthAriaLabel: 'Previous month',
  nextMonthAriaLabel: 'Next month',
  prevYearAriaLabel: 'Previous year',
  nextYearAriaLabel: 'Next year',
  closeButtonAriaLabel: 'Close date picker',
  monthPickerHeaderAriaLabel: '{0}, select to change the year',
  yearPickerHeaderAriaLabel: '{0}, select to change the month'
};

// ОБНОВЛЕНО v5.0: Форматирование даты в формате dd.mm.yyyy с Date-only поддержкой
export const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  // *** Date-only нормализация ***
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const day = normalizedDate.getDate().toString().padStart(2, '0');
  const month = (normalizedDate.getMonth() + 1).toString().padStart(2, '0');
  const year = normalizedDate.getFullYear();
  
  console.log('[timetableTabUtils] v5.0: Date formatting with date-only support:', {
    original: date.toLocaleDateString(),
    originalISO: date.toISOString(),
    normalized: normalizedDate.toLocaleDateString(),
    formatted: `${day}.${month}.${year}`
  });
  
  return `${day}.${month}.${year}`;
};

// *** НОВЫЕ ФУНКЦИИ v5.0 ДЛЯ ЗАПОМИНАНИЯ ДАТЫ С DATE-ONLY ПОДДЕРЖКОЙ ***

/**
 * ОБНОВЛЕНО v5.0: Получает первый день текущего месяца с Date-only поддержкой
 */
const getFirstDayOfCurrentMonth = (): Date => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  
  console.log('[timetableTabUtils] v5.0: First day of current month (date-only):', {
    current: now.toLocaleDateString(),
    firstDay: firstDay.toLocaleDateString(),
    firstDayISO: firstDay.toISOString()
  });
  
  return firstDay;
};

/**
 * ОБНОВЛЕНО v5.0: Получает сохраненную дату для Timetable с Date-only поддержкой
 */
export const getSavedTimetableDate = (): Date => {
  try {
    const savedDate = sessionStorage.getItem('timetableTab_selectedDate');
    if (savedDate) {
      const parsedDate = new Date(savedDate);
      if (!isNaN(parsedDate.getTime())) {
        // *** Date-only нормализация сохраненной даты ***
        const normalizedDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate());
        
        console.log('[timetableTabUtils] v5.0: Restored selected date from sessionStorage with date-only support:', {
          saved: savedDate,
          parsed: parsedDate.toISOString(),
          normalized: normalizedDate.toISOString(),
          display: normalizedDate.toLocaleDateString()
        });
        
        return normalizedDate;
      } else {
        console.warn('[timetableTabUtils] v5.0: Invalid date found in sessionStorage, using first day of current month');
      }
    } else {
      console.log('[timetableTabUtils] v5.0: No saved date found in sessionStorage, using first day of current month');
    }
  } catch (error) {
    console.warn('[timetableTabUtils] v5.0: Error reading saved date from sessionStorage:', error);
  }
  
  const firstDay = getFirstDayOfCurrentMonth();
  console.log('[timetableTabUtils] v5.0: Using first day of current month as default:', {
    date: firstDay.toLocaleDateString(),
    iso: firstDay.toISOString()
  });
  return firstDay;
};

/**
 * ОБНОВЛЕНО v5.0: Сохраняет дату Timetable с Date-only поддержкой
 */
export const saveTimetableDate = (date: Date): void => {
  try {
    // *** Date-only нормализация перед сохранением ***
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    sessionStorage.setItem('timetableTab_selectedDate', normalizedDate.toISOString());
    
    console.log('[timetableTabUtils] v5.0: Date saved to sessionStorage with date-only support:', {
      original: date.toLocaleDateString(),
      originalISO: date.toISOString(),
      normalized: normalizedDate.toLocaleDateString(),
      normalizedISO: normalizedDate.toISOString(),
      saved: normalizedDate.toISOString()
    });
  } catch (error) {
    console.warn('[timetableTabUtils] v5.0: Error saving date to sessionStorage:', error);
  }
};

/**
 * ОБНОВЛЕНО v5.0: Форматирует дату для Excel в формате dd/mm с Date-only поддержкой
 */
export function formatDateForExcel(date: Date): string {
  // *** Date-only нормализация ***
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const day = normalizedDate.getDate().toString().padStart(2, '0');
  const month = (normalizedDate.getMonth() + 1).toString().padStart(2, '0');
  
  const result = `${day}/${month}`;
  
  console.log('[timetableTabUtils] v5.0: Excel date formatting with date-only support:', {
    original: date.toLocaleDateString(),
    normalized: normalizedDate.toLocaleDateString(),
    formatted: result
  });
  
  return result;
}

/**
 * Форматирует время для Excel в формате HH:mm
 */
export function formatTimeForExcel(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Форматирует продолжительность для Excel
 */
export function formatDurationForExcel(minutes: number): string {
  if (minutes === 0) {
    return '0 hrs';
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hrs`;
  } else {
    return `${hours}:${remainingMinutes.toString().padStart(2, '0')} hrs`;
  }
}

/**
 * ОБНОВЛЕНО v5.0: Генерирует имя файла для Excel экспорта с Date-only поддержкой
 */
export function generateFileName(groupName: string, weeksData: Array<{ weekInfo: { weekStart: Date; weekEnd: Date } }>): string {
  if (weeksData.length === 0) {
    return `Timetable_${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_v5.0.xlsx`;
  }
  
  const firstWeek = weeksData[0];
  const lastWeek = weeksData[weeksData.length - 1];
  
  // *** Date-only нормализация для имени файла ***
  const startDate = new Date(firstWeek.weekInfo.weekStart.getFullYear(), firstWeek.weekInfo.weekStart.getMonth(), firstWeek.weekInfo.weekStart.getDate());
  const endDate = new Date(lastWeek.weekInfo.weekEnd.getFullYear(), lastWeek.weekInfo.weekEnd.getMonth(), lastWeek.weekInfo.weekEnd.getDate());
  
  const startStr = formatDateForExcel(startDate).replace('/', '-');
  const endStr = formatDateForExcel(endDate).replace('/', '-');
  
  const cleanGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
  
  const fileName = `Timetable_${cleanGroupName}_${startStr}_to_${endStr}_v5.0.xlsx`;
  
  console.log('[timetableTabUtils] v5.0: Generated Excel filename with date-only support:', {
    groupName,
    startDate: startDate.toLocaleDateString(),
    endDate: endDate.toLocaleDateString(),
    fileName
  });
  
  return fileName;
}

/**
 * ОБНОВЛЕННАЯ ФУНКЦИЯ v5.0: Форматирует ячейку дня с поддержкой отметок праздников/отпусков
 * Date-only: Работает с нормализованными датами и числовыми полями времени
 * ИСПРАВЛЕНО: Правильное отображение названий типов отпусков вместо ID (Type 2, Type 13 и т.д.)
 */
export function formatDayCellWithMarkers(dayData: IDayInfo | undefined, typesOfLeave: ITypeOfLeave[]): string {
  if (!dayData) {
    return '';
  }
  
  console.log('[formatDayCellWithMarkers] v5.0: Processing day cell with date-only + numeric fields support:', {
    hasShifts: dayData.shifts?.length > 0,
    hasData: dayData.hasData,
    hasHoliday: dayData.hasHoliday,
    hasLeave: dayData.hasLeave,
    shiftsCount: dayData.shifts?.length || 0,
    formattedContent: dayData.formattedContent,
    leaveTypeColor: dayData.leaveTypeColor,
    dateOnly: dayData.date?.toLocaleDateString() || 'Unknown',
    enhancement: 'v5.0 - Date-only + numeric time fields architecture'
  });
  
  const hasWorkShifts = dayData.shifts && dayData.shifts.length > 0;
  const hasHolidayMarker = dayData.hasHoliday;
  const hasLeaveMarker = dayData.hasLeave;
  
  if (!hasWorkShifts && !hasHolidayMarker && !hasLeaveMarker) {
    return '';
  }
  
  if (hasWorkShifts) {
    if (dayData.shifts.length === 1) {
      const shift = dayData.shifts[0];
      const startTime = formatTimeForExcel(shift.startTime);
      const endTime = formatTimeForExcel(shift.endTime);
      
      // *** Пропускаем отображение 00:00 - 00:00 времени, показываем только отметки ***
      if (startTime === "00:00" && endTime === "00:00" && shift.workMinutes === 0) {
        console.log('[formatDayCellWithMarkers] v5.0: Skipping 00:00-00:00 time display, showing only markers');
        
        // Показываем праздник первым (высший приоритет)
        if (shift.isHoliday) {
          return 'Holiday';
        }
        
        // *** ИСПРАВЛЕНО v5.0: Показываем название типа отпуска вместо ID ***
        if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
          const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
          if (leaveType && leaveType.title) {
            console.log(`[formatDayCellWithMarkers] v5.0: FOUND LEAVE TYPE NAME: ${leaveType.title} (was: ${shift.typeOfLeaveId})`);
            return leaveType.title; // Возвращаем название без скобок
          } else if (shift.typeOfLeaveTitle) {
            console.log(`[formatDayCellWithMarkers] v5.0: USING SHIFT LEAVE TITLE: ${shift.typeOfLeaveTitle}`);
            return shift.typeOfLeaveTitle; // Возвращаем название без скобок
          } else {
            console.log(`[formatDayCellWithMarkers] v5.0: FALLBACK: No name found, keeping ID: ${shift.typeOfLeaveId}`);
            return shift.typeOfLeaveId; // Fallback к ID
          }
        }
        
        // Если нет отметок, возвращаем пустую строку (не показываем 00:00 - 00:00)
        return '';
      }
      
      // *** Обычное отображение времени для рабочих смен ***
      const duration = formatDurationForExcel(shift.workMinutes);
      
      let leaveIndicator = '';
      if (shift.isHoliday) {
        leaveIndicator = ' [Holiday]';
        console.log(`[formatDayCellWithMarkers] v5.0: Applied holiday indicator (priority over leave type)`);
      } else if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
        // *** ИСПРАВЛЕНО v5.0: Улучшенное определение названия типа отпуска ***
        const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
        let leaveName = '';
        
        if (leaveType && leaveType.title) {
          leaveName = leaveType.title;
          console.log(`[formatDayCellWithMarkers] v5.0: Found full leave name: ${leaveName} (for ID: ${shift.typeOfLeaveId})`);
        } else if (shift.typeOfLeaveTitle) {
          leaveName = shift.typeOfLeaveTitle;
          console.log(`[formatDayCellWithMarkers] v5.0: Using shift title: ${leaveName}`);
        } else {
          leaveName = shift.typeOfLeaveId;
          console.log(`[formatDayCellWithMarkers] v5.0: Fallback to ID: ${leaveName}`);
        }
        
        leaveIndicator = ` [${leaveName}]`;
        console.log(`[formatDayCellWithMarkers] v5.0: Applied leave indicator with name: ${leaveName}`);
      }
      
      return `${startTime} - ${endTime} (${duration})${leaveIndicator}`;
    } else {
      // *** МНОЖЕСТВЕННЫЕ СМЕНЫ: Фильтруем 00:00-00:00 смены ***
      const validShifts = dayData.shifts.filter((shift: IShiftInfo) => {
        const startTime = formatTimeForExcel(shift.startTime);
        const endTime = formatTimeForExcel(shift.endTime);
        
        // Оставляем смену если это не 00:00-00:00 ИЛИ если у неё есть значимые отметки
        if (startTime !== "00:00" || endTime !== "00:00" || shift.workMinutes > 0) {
          return true; // Реальная рабочая смена
        }
        
        // Для 00:00-00:00 смен, оставляем только если у них есть отметки праздника/отпуска
        return shift.isHoliday || shift.typeOfLeaveId;
      });
      
      if (validShifts.length === 0) {
        // Все смены были 00:00-00:00 без отметок
        return '';
      }
      
      const shiftLines = validShifts.map((shift: IShiftInfo) => {
        const startTime = formatTimeForExcel(shift.startTime);
        const endTime = formatTimeForExcel(shift.endTime);
        
        // Проверяем, является ли это 00:00-00:00 смена только с отметками
        if (startTime === "00:00" && endTime === "00:00" && shift.workMinutes === 0) {
          if (shift.isHoliday) {
            return 'Holiday';
          }
          if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
            // *** ИСПРАВЛЕНО v5.0: Улучшенное определение названия типа отпуска для множественных смен ***
            const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
            if (leaveType && leaveType.title) {
              console.log(`[formatDayCellWithMarkers] v5.0: Multiple shifts - found leave name: ${leaveType.title}`);
              return leaveType.title; // Без скобок для marker-only смен
            } else if (shift.typeOfLeaveTitle) {
              return shift.typeOfLeaveTitle;
            } else {
              return shift.typeOfLeaveId;
            }
          }
          return ''; // Не должно происходить из-за фильтрации выше
        }
        
        // Обычная смена с реальным временем
        const duration = formatDurationForExcel(shift.workMinutes);
        
        let leaveIndicator = '';
        if (shift.isHoliday) {
          leaveIndicator = ' [Holiday]';
        } else if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
          // *** ИСПРАВЛЕНО v5.0: Улучшенное определение названия типа отпуска ***
          const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
          let leaveName = '';
          
          if (leaveType && leaveType.title) {
            leaveName = leaveType.title;
          } else if (shift.typeOfLeaveTitle) {
            leaveName = shift.typeOfLeaveTitle;
          } else {
            leaveName = shift.typeOfLeaveId;
          }
          
          leaveIndicator = ` [${leaveName}]`;
        }
        
        return `${startTime} - ${endTime} (${duration})${leaveIndicator}`;
      }).filter(line => line !== ''); // Удаляем пустые строки
      
      return shiftLines.join('\n');
    }
  }
  
  // *** ИСПРАВЛЕНО v5.0: ОТМЕТКИ БЕЗ РАБОЧИХ СМЕН с правильными названиями типов отпусков ***
  if (hasHolidayMarker && !hasWorkShifts) {
    console.log(`[formatDayCellWithMarkers] v5.0: Showing holiday marker without work shifts`);
    return 'Holiday';
  }
  
  if (hasLeaveMarker && !hasWorkShifts && !hasHolidayMarker) {
    console.log(`[formatDayCellWithMarkers] v5.0: Showing leave marker without work shifts`);
    
    // *** ИСПРАВЛЕНО v5.0: Попытка найти название типа отпуска разными способами ***
    
    // Способ 1: Используем formattedContent если оно содержит название (не "Leave" и не ID)
    if (dayData.formattedContent && 
        dayData.formattedContent !== 'Leave' && 
        dayData.formattedContent !== '' &&
        dayData.formattedContent !== '-') {
      
      // *** ИСПРАВЛЕНО v5.0: Правильно извлекаем ID из строки "Type 13" ***
      if (dayData.formattedContent.startsWith('Type ')) {
        console.log(`[formatDayCellWithMarkers] v5.0: Found leave type ID in formattedContent: ${dayData.formattedContent} - converting to name`);
        
        // ИЗВЛЕКАЕМ ЧИСТЫЙ ID ("13" из "Type 13")
        const leaveTypeId = dayData.formattedContent.replace('Type ', '').trim();
        
        // ИЩЕМ ПО ЧИСТОМУ ID
        const leaveType = typesOfLeave.find(lt => lt.id === leaveTypeId); 
        if (leaveType && leaveType.title) {
          console.log(`[formatDayCellWithMarkers] v5.0: SUCCESS: Converted ID to name: ${leaveTypeId} → ${leaveType.title}`);
          return leaveType.title; // Возвращаем полное название
        } else {
          console.log(`[formatDayCellWithMarkers] v5.0: WARNING: Could not find name for ID: ${leaveTypeId}`);
          return dayData.formattedContent; // Возвращаем "Type 13" как fallback
        }
      } else {
        // Уже содержит правильное название
        console.log(`[formatDayCellWithMarkers] v5.0: Using formattedContent as is: ${dayData.formattedContent}`);
        return dayData.formattedContent;
      }
    }
    
    // Способ 2: Ищем по цвету отпуска
    if (dayData.leaveTypeColor && typesOfLeave.length > 0) {
      const leaveType = typesOfLeave.find(lt => lt.color === dayData.leaveTypeColor);
      if (leaveType && leaveType.title) {
        console.log(`[formatDayCellWithMarkers] v5.0: Found leave type by color: ${leaveType.title}`);
        return leaveType.title;
      }
    }
    
    // Способ 3: Ищем в сменах (может быть 00:00-00:00 смена с типом отпуска)
    if (dayData.shifts && dayData.shifts.length > 0) {
      const leaveShift = dayData.shifts.find(shift => shift.typeOfLeaveId);
      if (leaveShift) {
        if (leaveShift.typeOfLeaveTitle) {
          console.log(`[formatDayCellWithMarkers] v5.0: Found leave title in shifts: ${leaveShift.typeOfLeaveTitle}`);
          return leaveShift.typeOfLeaveTitle;
        } else if (leaveShift.typeOfLeaveId && typesOfLeave.length > 0) {
          const leaveType = typesOfLeave.find(lt => lt.id === leaveShift.typeOfLeaveId);
          if (leaveType && leaveType.title) {
            console.log(`[formatDayCellWithMarkers] v5.0: Found leave type by ID in shifts: ${leaveType.title}`);
            return leaveType.title;
          }
        }
      }
    }
    
    // Fallback: показываем общее "Leave"
    console.log(`[formatDayCellWithMarkers] v5.0: Fallback to generic 'Leave' - could not determine specific type`);
    return 'Leave';
  }
  
  return '';
}