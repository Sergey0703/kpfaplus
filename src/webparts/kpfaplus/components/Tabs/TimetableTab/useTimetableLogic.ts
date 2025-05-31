// src/webparts/kpfaplus/components/Tabs/TimetableTab/useTimetableLogic.ts
//import * as React from 'react';
import { useEffect, useMemo, useCallback, useState } from 'react';
import * as ExcelJS from 'exceljs';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';
import { StaffRecordsService } from '../../../services/StaffRecordsService';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { 
  IWeekInfo, 
  IWeekCalculationParams,
  IDayInfo,
  TIMETABLE_COLORS
 // ColorPriority
} from './interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './utils/TimetableWeekCalculator';
import { TimetableShiftCalculatorLeaveTypes } from './utils/TimetableShiftCalculatorLeaveTypes';
import { TimetableDataProcessor } from './utils/TimetableDataProcessor';
import { useTimetableTabState } from './utils/useTimetableTabState';
import { useTimetableStaffRecordsData } from './utils/useTimetableStaffRecordsData';
import { 
  formatDate, 
  formatDayCellWithMarkers, 
  formatDateForExcel, 
  generateFileName 
} from './timetableTabUtils';

export interface ITimetableLogicProps extends ITabProps {
  // Дополнительные пропсы, если понадобятся для логики
}

// FIXED: Added explicit return type for the hook
export const useTimetableLogic = (props: ITimetableLogicProps): {
  state: ReturnType<typeof useTimetableTabState>['state'];
  setState: ReturnType<typeof useTimetableTabState>['setState'];
  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  getLeaveTypeColor: (typeOfLeaveId: string) => string | undefined;
  weeks: IWeekInfo[];
  refreshTimetableData: () => Promise<void>;
  handleMonthChange: (date: Date | undefined) => void;
  handleExportToExcel: () => Promise<void>;
  statistics: {
    expandedCount: number;
    totalWeeks: number;
    weeksWithData: number;
    staffCount: number;
    recordsCount: number;
  };
  toggleWeekExpand: (weekNum: number) => void;
  expandAllWeeks: () => void;
  collapseAllWeeks: () => void;
  staffMembers: ReturnType<typeof useDataContext>['staffMembers'];
  // *** НОВЫЕ ВОЗВРАЩАЕМЫЕ ЗНАЧЕНИЯ ДЛЯ ИСПРАВЛЕНИЯ ОТОБРАЖЕНИЯ ТИПОВ ОТПУСКОВ ***
  getLeaveTypeTitle: (typeOfLeaveId: string) => string | undefined;
  getLeaveTypeById: (typeOfLeaveId: string) => ITypeOfLeave | undefined;
} => {
  const { managingGroupId, currentUserId, dayOfStartWeek, context } = props;
  const { staffMembers, departments } = useDataContext();

  const {
    state,
    setState,
    toggleWeekExpand,
    expandAllWeeks,
    collapseAllWeeks,
    setWeeks,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords,
    setWeeksData
  } = useTimetableTabState();

  const [typesOfLeave, setTypesOfLeave] = useState<ITypeOfLeave[]>([]);
  const [isLoadingTypesOfLeave, setIsLoadingTypesOfLeave] = useState<boolean>(false);

  const staffRecordsService = useMemo(() => {
    if (context) {
      console.log('[useTimetableLogic] Initializing StaffRecordsService');
      return StaffRecordsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const typeOfLeaveService = useMemo(() => {
    if (context) {
      console.log('[useTimetableLogic] Initializing TypeOfLeaveService');
      return TypeOfLeaveService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // *** УЛУЧШЕННАЯ ЗАГРУЗКА ТИПОВ ОТПУСКОВ С ПОДРОБНЫМ ЛОГИРОВАНИЕМ ***
  useEffect(() => {
    const loadTypesOfLeave = async (): Promise<void> => {
      if (!typeOfLeaveService) return;
      try {
        setIsLoadingTypesOfLeave(true);
        console.log('[useTimetableLogic] *** LOADING TYPES OF LEAVE FOR UI DISPLAY FIX ***');
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        console.log('[useTimetableLogic] *** TYPES OF LEAVE LOADED SUCCESSFULLY ***:', {
          totalCount: types.length,
          typesWithColors: types.filter(t => t.color).length,
          typesWithTitles: types.filter(t => t.title).length,
          sampleTypes: types.slice(0, 5).map(type => ({
            id: type.id,
            title: type.title,
            color: type.color,
            hasColor: !!type.color,
            hasTitle: !!type.title
          }))
        });
        
        // *** ДОПОЛНИТЕЛЬНАЯ ВАЛИДАЦИЯ ДАННЫХ ***
        const invalidTypes = types.filter(type => !type.title || !type.color);
        if (invalidTypes.length > 0) {
          console.warn('[useTimetableLogic] *** WARNING: Some leave types missing title or color ***:', {
            invalidCount: invalidTypes.length,
            invalidTypes: invalidTypes.map(t => ({ id: t.id, title: t.title, color: t.color }))
          });
        }
        
        setTypesOfLeave(types);
        console.log('[useTimetableLogic] *** TYPES OF LEAVE SET IN STATE - UI SHOULD NOW SHOW PROPER NAMES AND COLORS ***');
      } catch (error) {
        console.error('[useTimetableLogic] *** ERROR LOADING TYPES OF LEAVE ***:', error);
        setTypesOfLeave([]); // Fallback to empty array
      } finally {
        setIsLoadingTypesOfLeave(false);
      }
    };
    loadTypesOfLeave().catch(error => console.error('[useTimetableLogic] Failed to load types of leave:', error));
  }, [typeOfLeaveService]);

  // *** УЛУЧШЕННАЯ ФУНКЦИЯ ПОЛУЧЕНИЯ ЦВЕТА ТИПА ОТПУСКА ***
  const getLeaveTypeColor = useCallback((typeOfLeaveId: string): string | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) {
      console.log(`[useTimetableLogic] getLeaveTypeColor: No typeOfLeaveId (${typeOfLeaveId}) or no types loaded (${typesOfLeave.length})`);
      return undefined;
    }
    
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    const color = leaveType?.color;
    
    if (color) {
      console.log(`[useTimetableLogic] *** COLOR RESOLVED *** ID: ${typeOfLeaveId} -> Color: ${color} (Title: ${leaveType?.title})`);
    } else {
      console.warn(`[useTimetableLogic] *** COLOR NOT FOUND *** ID: ${typeOfLeaveId} not found in types of leave`);
      console.log(`[useTimetableLogic] Available leave type IDs:`, typesOfLeave.map(t => t.id).slice(0, 10));
    }
    
    return color;
  }, [typesOfLeave]);

  // *** НОВАЯ ФУНКЦИЯ: Получение названия типа отпуска ***
  const getLeaveTypeTitle = useCallback((typeOfLeaveId: string): string | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) {
      console.log(`[useTimetableLogic] getLeaveTypeTitle: No typeOfLeaveId (${typeOfLeaveId}) or no types loaded (${typesOfLeave.length})`);
      return undefined;
    }
    
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    const title = leaveType?.title;
    
    if (title) {
      console.log(`[useTimetableLogic] *** TITLE RESOLVED *** ID: ${typeOfLeaveId} -> Title: ${title}`);
    } else {
      console.warn(`[useTimetableLogic] *** TITLE NOT FOUND *** ID: ${typeOfLeaveId} not found in types of leave`);
    }
    
    return title;
  }, [typesOfLeave]);

  // *** НОВАЯ ФУНКЦИЯ: Получение полного объекта типа отпуска ***
  const getLeaveTypeById = useCallback((typeOfLeaveId: string): ITypeOfLeave | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) {
      return undefined;
    }
    
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    
    if (leaveType) {
      console.log(`[useTimetableLogic] *** LEAVE TYPE OBJECT RESOLVED *** ID: ${typeOfLeaveId}`, {
        title: leaveType.title,
        color: leaveType.color,
        id: leaveType.id
      });
    }
    
    return leaveType;
  }, [typesOfLeave]);

  const weeks: IWeekInfo[] = useMemo(() => {
    const weekCalculationParams: IWeekCalculationParams = {
      selectedDate: state.selectedDate,
      startWeekDay: dayOfStartWeek || 7
    };
    const calculatedWeeks = TimetableWeekCalculator.calculateWeeksForMonth(weekCalculationParams);
    console.log('[useTimetableLogic] Calculated weeks:', {
      selectedMonth: state.selectedDate.toLocaleDateString(),
      weeksCount: calculatedWeeks.length,
    });
    return calculatedWeeks;
  }, [state.selectedDate, dayOfStartWeek]);

  useEffect(() => {
    if (weeks.length > 0 && weeks.length !== state.weeks.length) {
      console.log('[useTimetableLogic] Updating weeks in state:', weeks.length);
      setWeeks(weeks);
    }
  }, [weeks, state.weeks.length, setWeeks]);

  // *** ОБНОВЛЕННЫЙ useTimetableStaffRecordsData С ПЕРЕДАЧЕЙ ФУНКЦИЙ ТИПОВ ОТПУСКОВ ***
  const { refreshTimetableData } = useTimetableStaffRecordsData({
    context,
    selectedDate: state.selectedDate,
    currentUserId,
    managingGroupId,
    staffRecordsService,
    weeks: state.weeks,
    staffMembers,
    setWeeksData: (weeksData) => {
      console.log('[useTimetableLogic] *** SETTING WEEKS DATA WITH ENHANCED LEAVE TYPE SUPPORT ***', {
        weeksCount: weeksData.length,
        typesOfLeaveLoaded: typesOfLeave.length,
        hasGetLeaveTypeColor: !!getLeaveTypeColor,
        hasGetLeaveTypeTitle: !!getLeaveTypeTitle
      });
      
      // *** ПРИМЕНЯЕМ ДОПОЛНИТЕЛЬНУЮ ОБРАБОТКУ ДЛЯ ИСПРАВЛЕНИЯ ОТОБРАЖЕНИЯ ***
      const enhancedWeeksData = weeksData.map(weekGroup => ({
        ...weekGroup,
        staffRows: weekGroup.staffRows.map(staffRow => ({
          ...staffRow,
          weekData: {
            ...staffRow.weekData,
            days: (() => {
              // *** ИСПРАВЛЕНО: Заменяем Object.fromEntries на совместимый код ***
              const enhancedDays: { [dayNumber: number]: IDayInfo } = {};
              
              Object.entries(staffRow.weekData.days).forEach(([dayNum, dayData]) => {
                const dayInfo = dayData as IDayInfo;
                
                // *** ИСПРАВЛЯЕМ formattedContent ДЛЯ ДНЕЙ БЕЗ СМЕН С ТИПАМИ ОТПУСКОВ ***
                let enhancedFormattedContent = dayInfo.formattedContent;
                
                if (dayInfo.hasLeave && !dayInfo.hasData && dayInfo.formattedContent) {
                  // Если это день только с отпуском (без рабочих смен)
                  if (dayInfo.formattedContent.startsWith('Type ')) {
                    // Пытаемся заменить "Type X" на полное название
                    const leaveTypeId = dayInfo.formattedContent;
                    const fullTitle = getLeaveTypeTitle(leaveTypeId);
                    if (fullTitle) {
                      enhancedFormattedContent = fullTitle;
                      console.log(`[useTimetableLogic] *** ENHANCED CONTENT *** Day ${dayNum}: ${leaveTypeId} -> ${fullTitle}`);
                    }
                  }
                }
                
                // *** ИСПРАВЛЯЕМ СМЕНЫ С ТИПАМИ ОТПУСКОВ ***
                const enhancedShifts = dayInfo.shifts.map(shift => {
                  if (shift.typeOfLeaveId && !shift.typeOfLeaveTitle) {
                    // Если у смены есть ID типа отпуска, но нет названия
                    const fullTitle = getLeaveTypeTitle(shift.typeOfLeaveId);
                    if (fullTitle) {
                      console.log(`[useTimetableLogic] *** ENHANCED SHIFT *** Shift ${shift.recordId}: ${shift.typeOfLeaveId} -> ${fullTitle}`);
                      return {
                        ...shift,
                        typeOfLeaveTitle: fullTitle
                      };
                    }
                  }
                  return shift;
                });
                
                enhancedDays[parseInt(dayNum)] = {
                  ...dayInfo,
                  formattedContent: enhancedFormattedContent,
                  shifts: enhancedShifts
                };
              });
              
              return enhancedDays;
            })()
          }
        }))
      }));
      
      console.log('[useTimetableLogic] *** ENHANCED WEEKS DATA SET *** - UI should now show proper leave type names and colors');
      setWeeksData(enhancedWeeksData);
    },
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords,
    getLeaveTypeColor
  });

  const handleMonthChange = (date: Date | undefined): void => {
    if (date) {
      console.log('[useTimetableLogic] Month changed to:', formatDate(date));
      setState(prevState => ({ ...prevState, selectedDate: date }));
    }
  };

  // *** ОБНОВЛЕННЫЙ EXCEL ЭКСПОРТ С ПЕРЕДАЧЕЙ ТИПОВ ОТПУСКОВ ***
  const handleExportToExcel = async (): Promise<void> => {
    console.log('[useTimetableLogic] *** EXCEL EXPORT REQUESTED v3.7 WITH ENHANCED LEAVE TYPE SUPPORT ***');
    try {
      if (state.weeksData.length === 0) {
        console.warn('[useTimetableLogic] No data to export');
        setState(prevState => ({ ...prevState, errorStaffRecords: 'No data available for export' }));
        return;
      }

      const department = departments.find(d => d.ID.toString() === managingGroupId);
      const groupName = department?.Title || `Group ${managingGroupId}`;
      
      console.log('[useTimetableLogic] *** PROCESSING DATA FOR EXCEL WITH FULL LEAVE TYPE SUPPORT ***', {
        typesOfLeaveCount: typesOfLeave.length,
        hasGetLeaveTypeColor: !!getLeaveTypeColor,
        sampleLeaveTypes: typesOfLeave.slice(0, 3).map(lt => ({ id: lt.id, title: lt.title, color: lt.color }))
      });
      
      const excelWeeksData = TimetableDataProcessor.processDataForExcelExport({
        staffRecords: state.staffRecords,
        staffMembers: staffMembers.filter(sm => sm.deleted !== 1),
        weeks: weeks, // Use the calculated weeks for the current month
        getLeaveTypeColor,
        holidayColor: TIMETABLE_COLORS.HOLIDAY
      });

      console.log('[useTimetableLogic] Excel data processed with enhanced leave type support:', {
        excelWeeksDataCount: excelWeeksData.length,
        typesOfLeaveAvailable: typesOfLeave.length
      });
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Timetable');
      const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek || 7);
      const dayNames = orderedDays.map(dayNum => TimetableWeekCalculator.getDayName(dayNum));
      
      worksheet.columns = [{ width: 20 }, ...Array(orderedDays.length).fill({ width: 25 })].map((col, index) => ({
        key: index.toString(),
        width: col.width
      }));
      
      let currentRow = 1;
      const titleCell = worksheet.getCell(currentRow, 1);
      titleCell.value = `Time table for Centre: ${groupName}`;
      titleCell.style = { font: { bold: true, size: 14 }, alignment: { horizontal: 'center' } };
      worksheet.mergeCells(currentRow, 1, currentRow, orderedDays.length + 1);
      currentRow += 2;

      for (const weekGroup of excelWeeksData) {
        const { weekInfo, staffRows } = weekGroup;
        const weekTitle = `Week ${weekInfo.weekNum}: ${formatDateForExcel(weekInfo.weekStart)} - ${formatDateForExcel(weekInfo.weekEnd)}`;
        
        worksheet.getCell(currentRow, 1).value = weekTitle;
        dayNames.forEach((dayName, dayIndex) => {
          worksheet.getCell(currentRow, dayIndex + 2).value = dayName;
        });
        for (let col = 1; col <= orderedDays.length + 1; col++) {
          worksheet.getCell(currentRow, col).style = {
            font: { bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } },
            alignment: { horizontal: 'center' },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          };
        }
        currentRow++;
        
        worksheet.getCell(currentRow, 1).value = 'Employee';
        orderedDays.forEach((dayNum, dayIndex) => {
          const dayDate = TimetableWeekCalculator.getDateForDayInWeek(weekInfo.weekStart, dayNum);
          worksheet.getCell(currentRow, dayIndex + 2).value = formatDateForExcel(dayDate);
        });
        for (let col = 1; col <= orderedDays.length + 1; col++) {
          worksheet.getCell(currentRow, col).style = {
            font: { bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } },
            alignment: { horizontal: 'center' },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          };
        }
        currentRow++;
        
        for (const staffRow of staffRows) {
          const nameCell = worksheet.getCell(currentRow, 1);
          nameCell.value = `${staffRow.staffName}\n${staffRow.weekData.formattedWeekTotal.trim()}`;
          nameCell.style = {
            font: { bold: true },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
          };
          
          orderedDays.forEach((dayNum, dayIndex) => {
            const dayData = staffRow.weekData.days[dayNum];
            // *** КРИТИЧЕСКИ ВАЖНО: Передаем typesOfLeave в formatDayCellWithMarkers ***
            const cellContent = formatDayCellWithMarkers(dayData, typesOfLeave);
            const dayCell = worksheet.getCell(currentRow, dayIndex + 2);
            dayCell.value = cellContent;
            
            const cellStyles = TimetableShiftCalculatorLeaveTypes.createExcelCellStyles(
              dayData?.shifts || [], 
              getLeaveTypeColor,
              dayData
            );

            // FIXED: Changed 'any' to specific ExcelJS.CellStyle type
            const cellStyle: Partial<ExcelJS.Style> = {
              alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
              border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
            };
            
            if (cellStyles.excelFillPattern) {
              // FIXED: Use proper ExcelJS fill pattern structure
              cellStyle.fill = {
                type: 'pattern' as const,
                pattern: 'solid' as const,
                fgColor: cellStyles.excelFillPattern.fgColor
              };
              if (cellStyles.excelFont) cellStyle.font = cellStyles.excelFont;
            }
            dayCell.style = cellStyle;
          });
          currentRow++;
        }
        if (weekGroup !== excelWeeksData[excelWeeksData.length - 1]) {
          currentRow++;
        }
      }

      const fileName = generateFileName(groupName, excelWeeksData);
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('[useTimetableLogic] *** EXCEL EXPORT COMPLETED v3.7 WITH ENHANCED LEAVE TYPE SUPPORT ***:', fileName);
      const exportStats = TimetableShiftCalculatorLeaveTypes.getExcelExportStatistics(excelWeeksData);
      console.log('[useTimetableLogic] Excel export statistics:', exportStats);
      
    } catch (error) {
      console.error('[useTimetableLogic] ExcelJS export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      setState(prevState => ({ ...prevState, errorStaffRecords: `Export failed: ${errorMessage}` }));
    }
  };

  const statistics = useMemo(() => {
    const expandedCount = state.expandedWeeks.size;
    const totalWeeks = state.weeksData.length; // Based on processed weeksData
    const weeksWithData = state.weeksData.filter(w => w.hasData).length;
    
    let staffCount = 0;
    let recordsCount = 0;
    
    if (state.weeksData.length > 0) {
      staffCount = state.weeksData[0].staffRows.length;
      state.weeksData.forEach(weekGroup => {
        weekGroup.staffRows.forEach(staffRow => {
          Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
            recordsCount += day.shifts ? day.shifts.length : 0;
          });
        });
      });
    }
    
    const stats = { expandedCount, totalWeeks, weeksWithData, staffCount, recordsCount };
    console.log('[useTimetableLogic] Current statistics:', stats);
    return stats;
  }, [state.expandedWeeks.size, state.weeksData]);

  useEffect(() => {
    console.log('[useTimetableLogic] *** STATE UPDATED WITH ENHANCED LEAVE TYPE SUPPORT ***:', {
      selectedDate: state.selectedDate.toLocaleDateString(),
      weeksCount: state.weeks.length, // Calculated weeks for month
      weeksDataCount: state.weeksData.length, // Processed weeks with data
      staffRecordsCount: state.staffRecords.length,
      isLoading: state.isLoadingStaffRecords,
      hasError: !!state.errorStaffRecords,
      typesOfLeaveCount: typesOfLeave.length,
      isLoadingTypesOfLeave,
      enhancement: 'Added getLeaveTypeTitle, getLeaveTypeById functions for proper UI display'
    });
  }, [state, typesOfLeave.length, isLoadingTypesOfLeave]);

  return {
    state,
    setState, // Expose setState for error dismissal, etc.
    typesOfLeave,
    isLoadingTypesOfLeave,
    getLeaveTypeColor,
    weeks, // Calculated weeks for the month
    refreshTimetableData,
    handleMonthChange,
    handleExportToExcel,
    statistics,
    toggleWeekExpand,
    expandAllWeeks,
    collapseAllWeeks,
    staffMembers, // Pass through for UI if needed (e.g. debug info)
    
    // *** НОВЫЕ ФУНКЦИИ ДЛЯ ИСПРАВЛЕНИЯ ОТОБРАЖЕНИЯ ТИПОВ ОТПУСКОВ В UI ***
    getLeaveTypeTitle,
    getLeaveTypeById
  };
};