// src/webparts/kpfaplus/components/Tabs/TimetableTab/timetableTabUtils.ts
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

// Форматирование даты в формате dd.mm.yyyy
export const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

/**
 * UPDATED FUNCTION: Форматирует ячейку дня с поддержкой отметок праздников/отпусков
 * FIXED: Не показывает время 00:00 - 00:00, только отметки отпусков/праздников
 */
export function formatDayCellWithMarkers(dayData: IDayInfo | undefined, typesOfLeave: ITypeOfLeave[]): string {
  if (!dayData) {
    return '';
  }
  
  console.log('[formatDayCellWithMarkers] Processing day cell with markers support v3.3 (hide 00:00-00:00):', {
    hasShifts: dayData.shifts?.length > 0,
    hasData: dayData.hasData,
    hasHoliday: dayData.hasHoliday,
    hasLeave: dayData.hasLeave,
    shiftsCount: dayData.shifts?.length || 0
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
      
      // *** NEW: Skip showing 00:00 - 00:00 times, only show markers ***
      if (startTime === "00:00" && endTime === "00:00" && shift.workMinutes === 0) {
        console.log('[formatDayCellWithMarkers] Skipping 00:00-00:00 time display, showing only markers');
        
        // Show holiday first (highest priority)
        if (shift.isHoliday) {
          return 'Holiday';
        }
        
        // Then show leave type
        if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
          const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
          const leaveName = leaveType ? leaveType.title : shift.typeOfLeaveId;
          return `[${leaveName}]`;
        }
        
        // If no markers, return empty (don't show 00:00 - 00:00)
        return '';
      }
      
      // *** EXISTING: Normal time display for actual work shifts ***
      const duration = formatDurationForExcel(shift.workMinutes);
      
      let leaveIndicator = '';
      if (shift.isHoliday) {
        leaveIndicator = ' [Holiday]';
        console.log(`[formatDayCellWithMarkers] Applied holiday indicator (priority over leave type)`);
      } else if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
        const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
        const leaveName = leaveType ? leaveType.title : shift.typeOfLeaveId;
        leaveIndicator = ` [${leaveName}]`;
        console.log(`[formatDayCellWithMarkers] Found leave type: ${shift.typeOfLeaveId} -> ${leaveName}`);
      }
      
      return `${startTime} - ${endTime} (${duration})${leaveIndicator}`;
    } else {
      // *** MULTIPLE SHIFTS: Filter out 00:00-00:00 shifts ***
      const validShifts = dayData.shifts.filter((shift: IShiftInfo) => {
        const startTime = formatTimeForExcel(shift.startTime);
        const endTime = formatTimeForExcel(shift.endTime);
        
        // Keep shift if it's not 00:00-00:00 OR if it has meaningful markers
        if (startTime !== "00:00" || endTime !== "00:00" || shift.workMinutes > 0) {
          return true; // Real work shift
        }
        
        // For 00:00-00:00 shifts, only keep if they have holiday/leave markers
        return shift.isHoliday || shift.typeOfLeaveId;
      });
      
      if (validShifts.length === 0) {
        // All shifts were 00:00-00:00 without markers
        return '';
      }
      
      const shiftLines = validShifts.map((shift: IShiftInfo) => {
        const startTime = formatTimeForExcel(shift.startTime);
        const endTime = formatTimeForExcel(shift.endTime);
        
        // Check if this is a 00:00-00:00 marker-only shift
        if (startTime === "00:00" && endTime === "00:00" && shift.workMinutes === 0) {
          if (shift.isHoliday) {
            return 'Holiday';
          }
          if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
            const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
            const leaveName = leaveType ? leaveType.title : shift.typeOfLeaveId;
            return `[${leaveName}]`;
          }
          return ''; // Should not happen due to filtering above
        }
        
        // Normal shift with actual time
        const duration = formatDurationForExcel(shift.workMinutes);
        
        let leaveIndicator = '';
        if (shift.isHoliday) {
          leaveIndicator = ' [Holiday]';
        } else if (shift.typeOfLeaveId && typesOfLeave.length > 0) {
          const leaveType = typesOfLeave.find(lt => lt.id === shift.typeOfLeaveId);
          const leaveName = leaveType ? leaveType.title : shift.typeOfLeaveId;
          leaveIndicator = ` [${leaveName}]`;
        }
        
        return `${startTime} - ${endTime} (${duration})${leaveIndicator}`;
      }).filter(line => line !== ''); // Remove empty lines
      
      return shiftLines.join('\n');
    }
  }
  
  // *** NON-WORK MARKERS: Show holiday/leave without times ***
  if (hasHolidayMarker && !hasWorkShifts) {
    console.log(`[formatDayCellWithMarkers] Showing holiday marker without work shifts`);
    return 'Holiday';
  }
  
  if (hasLeaveMarker && !hasWorkShifts && !hasHolidayMarker) {
    console.log(`[formatDayCellWithMarkers] Showing leave marker without work shifts`);
    
    if (dayData.leaveTypeColor && typesOfLeave.length > 0) {
      const leaveType = typesOfLeave.find(lt => lt.color === dayData.leaveTypeColor);
      if (leaveType) {
        return `[${leaveType.title}]`;
      }
    }
    return '[Leave]';
  }
  
  return '';
}

/**
 * Форматирует дату для Excel в формате dd/mm
 */
export function formatDateForExcel(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
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
 * Генерирует имя файла для Excel экспорта
 */
export function generateFileName(groupName: string, weeksData: Array<{ weekInfo: { weekStart: Date; weekEnd: Date } }>): string {
  if (weeksData.length === 0) {
    return `Timetable_${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_v3.3.xlsx`;
  }
  
  const firstWeek = weeksData[0];
  const lastWeek = weeksData[weeksData.length - 1];
  
  const startDate = firstWeek.weekInfo.weekStart;
  const endDate = lastWeek.weekInfo.weekEnd;
  
  const startStr = formatDateForExcel(startDate).replace('/', '-');
  const endStr = formatDateForExcel(endDate).replace('/', '-');
  
  const cleanGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `Timetable_${cleanGroupName}_${startStr}_to_${endStr}_NoZeroTimes_v3.3.xlsx`;
}