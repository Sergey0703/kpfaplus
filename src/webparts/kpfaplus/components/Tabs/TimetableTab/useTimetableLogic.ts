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

export const useTimetableLogic = (props: ITimetableLogicProps) => {
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

  useEffect(() => {
    const loadTypesOfLeave = async (): Promise<void> => {
      if (!typeOfLeaveService) return;
      try {
        setIsLoadingTypesOfLeave(true);
        console.log('[useTimetableLogic] Loading types of leave...');
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        console.log('[useTimetableLogic] Loaded types of leave:', types.length);
        types.slice(0, 3).forEach(type => {
          console.log(`[useTimetableLogic] Leave type: ${type.title} (ID: ${type.id}) - Color: ${type.color}`);
        });
        setTypesOfLeave(types);
      } catch (error) {
        console.error('[useTimetableLogic] Error loading types of leave:', error);
      } finally {
        setIsLoadingTypesOfLeave(false);
      }
    };
    loadTypesOfLeave().catch(error => console.error('[useTimetableLogic] Failed to load types of leave:', error));
  }, [typeOfLeaveService]);

  const getLeaveTypeColor = useCallback((typeOfLeaveId: string): string | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) return undefined;
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    const color = leaveType?.color;
    if (color) {
      console.log(`[useTimetableLogic] Found color ${color} for leave type ID: ${typeOfLeaveId}`);
    }
    return color;
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

  const { refreshTimetableData } = useTimetableStaffRecordsData({
    context,
    selectedDate: state.selectedDate,
    currentUserId,
    managingGroupId,
    staffRecordsService,
    weeks: state.weeks,
    staffMembers,
    setWeeksData,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  });

  const handleMonthChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[useTimetableLogic] Month changed to:', formatDate(date));
      setState(prevState => ({ ...prevState, selectedDate: date }));
    }
  };

  const handleExportToExcel = async (): Promise<void> => {
    console.log('[useTimetableLogic] Export to Excel requested v3.2');
    try {
      if (state.weeksData.length === 0) {
        console.warn('[useTimetableLogic] No data to export');
        setState(prevState => ({ ...prevState, errorStaffRecords: 'No data available for export' }));
        return;
      }

      const department = departments.find(d => d.ID.toString() === managingGroupId);
      const groupName = department?.Title || `Group ${managingGroupId}`;
      
      console.log('[useTimetableLogic] Using TimetableDataProcessor.processDataForExcelExport');
      const excelWeeksData = TimetableDataProcessor.processDataForExcelExport({
        staffRecords: state.staffRecords,
        staffMembers: staffMembers.filter(sm => sm.deleted !== 1),
        weeks: weeks, // Use the calculated weeks for the current month
        getLeaveTypeColor,
        holidayColor: TIMETABLE_COLORS.HOLIDAY
      });

      console.log('[useTimetableLogic] Excel data processed:', {
        excelWeeksDataCount: excelWeeksData.length
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
            const cellContent = formatDayCellWithMarkers(dayData, typesOfLeave); // Pass typesOfLeave
            const dayCell = worksheet.getCell(currentRow, dayIndex + 2);
            dayCell.value = cellContent;
            
            const cellStyles = TimetableShiftCalculatorLeaveTypes.createExcelCellStyles(
              dayData?.shifts || [], 
              getLeaveTypeColor,
              dayData
            );

            const cellStyle: any = {
              alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
              border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
            };
            
            if (cellStyles.excelFillPattern) {
              cellStyle.fill = cellStyles.excelFillPattern;
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
      
      console.log('[useTimetableLogic] ExcelJS export completed:', fileName);
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
    console.log('[useTimetableLogic] State updated:', {
      selectedDate: state.selectedDate.toLocaleDateString(),
      weeksCount: state.weeks.length, // Calculated weeks for month
      weeksDataCount: state.weeksData.length, // Processed weeks with data
      staffRecordsCount: state.staffRecords.length,
      isLoading: state.isLoadingStaffRecords,
      hasError: !!state.errorStaffRecords,
      typesOfLeaveCount: typesOfLeave.length,
    });
  }, [state, typesOfLeave.length]);

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
  };
};