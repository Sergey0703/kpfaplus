// src/webparts/kpfaplus/components/Tabs/TimetableTab/useTimetableLogic.ts
// ФИНАЛЬНАЯ АВТОНОМНАЯ ВЕРСИЯ БЕЗ ВНЕШНИХ ХУКОВ

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
} from './interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './utils/TimetableWeekCalculator';
import { TimetableShiftCalculatorLeaveTypes } from './utils/TimetableShiftCalculatorLeaveTypes';
import { TimetableDataProcessor } from './utils/TimetableDataProcessor';
import { useTimetableTabState } from './utils/useTimetableTabState';
import { 
   formatDayCellWithMarkers, // Закомментировано для диагностики
  formatDateForExcel, 
  generateFileName,
  saveTimetableDate
} from './timetableTabUtils';

export interface ITimetableLogicProps extends ITabProps {
  // Additional props if needed
}

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
  
  // ПРОСТАЯ СИСТЕМА ПРЕДОТВРАЩЕНИЯ ПЕРЕЗАГРУЗОК
  const [dataLoadKey, setDataLoadKey] = useState<string>('');
  const [isManualLoading, setIsManualLoading] = useState<boolean>(false);

  const staffRecordsService = useMemo(() => {
    if (context) {
      return StaffRecordsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const typeOfLeaveService = useMemo(() => {
    if (context) {
      return TypeOfLeaveService.getInstance(context);
    }
    return undefined;
  }, [context]);

  useEffect(() => {
    const loadTypesOfLeave = async (): Promise<void> => {
      if (!typeOfLeaveService) return;
      try {
        setIsLoadingTypesOfLeave(true);
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        setTypesOfLeave(types);
      } catch (error) {
        console.error('[useTimetableLogic] Error loading types of leave:', error);
        setTypesOfLeave([]);
      } finally {
        setIsLoadingTypesOfLeave(false);
      }
    };
    loadTypesOfLeave().catch((error: unknown) => console.error('[useTimetableLogic] Failed to load types of leave:', error));
  }, [typeOfLeaveService]);

  const getLeaveTypeColor = useCallback((typeOfLeaveId: string): string | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) {
      return undefined;
    }
    
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    return leaveType?.color;
  }, [typesOfLeave]);

  const getLeaveTypeTitle = useCallback((typeOfLeaveId: string): string | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) {
      return undefined;
    }
    
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    return leaveType?.title;
  }, [typesOfLeave]);

  const getLeaveTypeById = useCallback((typeOfLeaveId: string): ITypeOfLeave | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) {
      return undefined;
    }
    
    return typesOfLeave.find(t => t.id === typeOfLeaveId);
  }, [typesOfLeave]);

  // СТАБИЛЬНЫЙ РАСЧЕТ НЕДЕЛЬ
  const weeks: IWeekInfo[] = useMemo(() => {
    const weekCalculationParams: IWeekCalculationParams = {
      selectedDate: state.selectedDate,
      startWeekDay: dayOfStartWeek || 7
    };
    
    const calculatedWeeks = TimetableWeekCalculator.calculateWeeksForMonth(weekCalculationParams);
    
    console.log('[useTimetableLogic] *** WEEKS CALCULATED ***', {
      selectedMonth: state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      weeksCount: calculatedWeeks.length,
      firstWeek: calculatedWeeks[0]?.weekLabel
    });
    
    return calculatedWeeks;
  }, [state.selectedDate, dayOfStartWeek]);

  // ОБНОВЛЕНИЕ WEEKS В STATE
  useEffect(() => {
    if (weeks.length > 0 && weeks !== state.weeks) {
      console.log('[useTimetableLogic] *** UPDATING WEEKS IN STATE ***', {
        weeksCount: weeks.length,
        firstWeek: weeks[0]?.weekLabel
      });
      setWeeks(weeks);
    }
  }, [weeks, state.weeks, setWeeks]);

  // ЕДИНСТВЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ
  const loadDataInternal = useCallback(async (forceReload = false): Promise<void> => {
    // Создаем уникальный ключ для текущего состояния
    const currentKey = `${state.selectedDate.getTime()}-${managingGroupId}-${weeks.length}-${staffMembers.length}`;
    
    // Проверяем, нужна ли загрузка
    if (!forceReload && currentKey === dataLoadKey) {
      console.log('[useTimetableLogic] *** DATA ALREADY LOADED FOR THIS STATE ***', { currentKey });
      return;
    }

    // Проверяем обязательные условия
    if (!context || !staffRecordsService || !managingGroupId || !currentUserId || weeks.length === 0 || staffMembers.length === 0) {
      console.log('[useTimetableLogic] *** CLEARING DATA - MISSING REQUIREMENTS ***');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
      return;
    }

    if (isManualLoading) {
      console.log('[useTimetableLogic] *** SKIPPING - ALREADY LOADING ***');
      return;
    }

    try {
      setIsManualLoading(true);
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);
      
      console.log('[useTimetableLogic] *** LOADING DATA ***', {
        selectedMonth: state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        weeksCount: weeks.length,
        staffMembersCount: staffMembers.length,
        currentKey,
        forceReload
      });

      const startDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth(), 1);
      const endDate = new Date(state.selectedDate.getFullYear(), state.selectedDate.getMonth() + 1, 0);

      const activeStaffMembers = staffMembers.filter(staffMember => {
        const isDeleted = staffMember.deleted === 1;
        const hasEmployeeId = staffMember.employeeId && staffMember.employeeId !== '0';
        return !isDeleted && hasEmployeeId;
      });

      if (activeStaffMembers.length === 0) {
        console.log('[useTimetableLogic] *** NO ACTIVE STAFF MEMBERS ***');
        setStaffRecords([]);
        setWeeksData([]);
        setDataLoadKey(currentKey);
        return;
      }

      const queryParams = {
        startDate,
        endDate,
        currentUserID: currentUserId,
        staffGroupID: managingGroupId,
        employeeID: '',
        timeTableID: undefined
      };

      const result = await staffRecordsService.getAllActiveStaffRecordsForTimetable(queryParams);
      
      if (result.error) {
        throw new Error(`Failed to load data: ${result.error}`);
      }

      const allRecords = result.records;

      // Фильтруем записи по активным сотрудникам
      const activeEmployeeIds = new Set(activeStaffMembers.map(staff => staff.employeeId?.toString()).filter(id => id && id !== '0'));
      const filteredRecords = allRecords.filter(record => {
        const recordStaffMemberId = record.StaffMemberLookupId?.toString();
        return recordStaffMemberId && activeEmployeeIds.has(recordStaffMemberId);
      });

      setStaffRecords(filteredRecords);

      // Обрабатываем данные
      const weeksData = TimetableDataProcessor.processDataByWeeks({
        staffRecords: filteredRecords,
        staffMembers: activeStaffMembers,
        weeks: weeks,
        getLeaveTypeColor,
        holidayColor: TIMETABLE_COLORS.HOLIDAY
      });

      // Обогащаем данные названиями типов отпусков
      const enhancedWeeksData = weeksData.map(weekGroup => ({
        ...weekGroup,
        staffRows: weekGroup.staffRows.map(staffRow => ({
          ...staffRow,
          weekData: {
            ...staffRow.weekData,
            days: (() => {
              const enhancedDays: { [dayNumber: number]: IDayInfo } = {};
              
              Object.entries(staffRow.weekData.days).forEach(([dayNum, dayData]) => {
                const dayInfo = dayData as IDayInfo;
                
                let enhancedFormattedContent = dayInfo.formattedContent;
                
                if (dayInfo.hasLeave && !dayInfo.hasData && dayInfo.formattedContent?.startsWith('Type ')) {
                  const leaveTypeId = dayInfo.formattedContent;
                  const fullTitle = getLeaveTypeTitle(leaveTypeId);
                  if (fullTitle) {
                    enhancedFormattedContent = fullTitle;
                  }
                }
                
                const enhancedShifts = dayInfo.shifts.map(shift => {
                  if (shift.typeOfLeaveId && !shift.typeOfLeaveTitle) {
                    const fullTitle = getLeaveTypeTitle(shift.typeOfLeaveId);
                    if (fullTitle) {
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

      setWeeksData(enhancedWeeksData);
      setDataLoadKey(currentKey);

      console.log('[useTimetableLogic] *** DATA LOADED SUCCESSFULLY ***', {
        recordsCount: filteredRecords.length,
        weeksDataCount: enhancedWeeksData.length,
        currentKey
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableLogic] *** ERROR LOADING DATA ***', errorMessage);
      setErrorStaffRecords(`Failed to load timetable data: ${errorMessage}`);
      setStaffRecords([]);
      setWeeksData([]);
    } finally {
      setIsLoadingStaffRecords(false);
      setIsManualLoading(false);
    }
  }, [
    state.selectedDate,
    managingGroupId,
    weeks,
    staffMembers,
    dataLoadKey,
    context,
    staffRecordsService,
    currentUserId,
    isManualLoading,
    getLeaveTypeColor,
    getLeaveTypeTitle,
    setStaffRecords,
    setWeeksData,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  ]);

  // АВТОМАТИЧЕСКИЙ ТРИГГЕР ЗАГРУЗКИ
  useEffect(() => {
    const currentKey = `${state.selectedDate.getTime()}-${managingGroupId}-${weeks.length}-${staffMembers.length}`;
    
    if (currentKey !== dataLoadKey && weeks.length > 0 && staffMembers.length > 0 && !isManualLoading) {
      console.log('[useTimetableLogic] *** AUTO TRIGGER DATA LOAD ***', {
        currentKey,
        dataLoadKey,
        selectedMonth: state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      });
      
      const timeoutId = window.setTimeout(() => {
        loadDataInternal(false).catch((error: unknown) => {
          console.error('[useTimetableLogic] Error in auto load:', error);
        });
      }, 300);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [state.selectedDate, managingGroupId, weeks.length, staffMembers.length, dataLoadKey, isManualLoading, loadDataInternal]);

  // ПУБЛИЧНЫЕ ФУНКЦИИ
  const refreshTimetableData = useCallback(async (): Promise<void> => {
    console.log('[useTimetableLogic] *** MANUAL REFRESH ***');
    await loadDataInternal(true);
  }, [loadDataInternal]);

  const handleMonthChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[useTimetableLogic] *** MONTH CHANGE ***', {
        newDate: date.toISOString(),
        newMonth: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      });
      
      saveTimetableDate(date);
      
      setState(prevState => ({ 
        ...prevState, 
        selectedDate: date,
        expandedWeeks: new Set([1])
      }));
      
      // НЕ сбрасываем dataLoadKey здесь - пусть useEffect сработает автоматически
    }
  }, [setState]);

  // *** ДИАГНОСТИЧЕСКАЯ ВЕРСИЯ EXCEL ЭКСПОРТА ***
  const handleExportToExcel = async (): Promise<void> => {
    try {
      if (state.weeksData.length === 0) {
        setState(prevState => ({ ...prevState, errorStaffRecords: 'No data available for export' }));
        return;
      }

      const department = departments.find(d => d.ID.toString() === managingGroupId);
      const groupName = department?.Title || `Group ${managingGroupId}`;
      
      const excelWeeksData = TimetableDataProcessor.processDataForExcelExport({
        staffRecords: state.staffRecords,
        staffMembers: staffMembers.filter(sm => sm.deleted !== 1),
        weeks: weeks,
        getLeaveTypeColor,
        holidayColor: TIMETABLE_COLORS.HOLIDAY
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
            
            // *** ДИАГНОСТИЧЕСКИЙ КОД - НАЧАЛО ***
            console.log('=== ДИАГНОСТИКА EXCEL ЯЧЕЙКИ ===');
            console.log(`Сотрудник: ${staffRow.staffName}, День: ${dayNum}`);
            
            // ВАРИАНТ 1: Простая замена на "22-22"
        //    const cellContent = "22-22";
         //   console.log(`Устанавливаем в ячейку: "${cellContent}"`);
            
             /*
            // ВАРИАНТ 2: Обрезка до 5 символов (раскомментировать для тестирования)
            const originalContent = formatDayCellWithMarkers(dayData, typesOfLeave);
            const cellContent = originalContent.substring(0, 5);
            console.log(`Оригинал: "${originalContent}" (${originalContent.length} символов)`);
            console.log(`Обрезано: "${cellContent}"`);
            */
            
            
            // ВАРИАНТ 3: Показать длинное содержимое (раскомментировать для тестирования)
         // ВАРИАНТ 3: Показать длинное содержимое (раскомментировать для тестирования)
// ВАРИАНТ 6: Пошаговое тестирование содержимого
// ВАРИАНТ 7: Принудительное создание проблемных строк
const cellContent = formatDayCellWithMarkers(dayData, typesOfLeave);
            /* 
            // ВАРИАНТ 4: Постепенное тестирование (раскомментировать для тестирования)
            let cellContent = "";
            if (dayData && dayData.hasData) {
              cellContent = "HAS_DATA";
            } else if (dayData && dayData.hasHoliday) {
              cellContent = "HOLIDAY";
            } else if (dayData && dayData.hasLeave) {
              cellContent = "LEAVE";
            } else {
              cellContent = "EMPTY";
            }
            */
            
            console.log(`Финальное содержимое: "${cellContent}"`);
            console.log('================================');
            // *** ДИАГНОСТИЧЕСКИЙ КОД - КОНЕЦ ***
            
            const dayCell = worksheet.getCell(currentRow, dayIndex + 2);
            dayCell.value = cellContent;
            
            const cellStyles = TimetableShiftCalculatorLeaveTypes.createExcelCellStyles(
              dayData?.shifts || [], 
              getLeaveTypeColor,
              dayData
            );

            const cellStyle: Partial<ExcelJS.Style> = {
              alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
              border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
            };
            
            if (cellStyles.excelFillPattern) {
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
      
      console.log('=== СОЗДАНИЕ EXCEL ФАЙЛА ===');
      console.log(`Имя файла: ${fileName}`);
      console.log(`Всего строк: ${currentRow}`);
      console.log('============================');
      
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
      
      console.log('Excel файл создан и загружен');
      
    } catch (error) {
      console.error('[useTimetableLogic] Excel export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      setState(prevState => ({ ...prevState, errorStaffRecords: `Export failed: ${errorMessage}` }));
    }
  };

  const statistics = useMemo(() => {
    const expandedCount = state.expandedWeeks.size;
    const totalWeeks = state.weeksData.length;
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
    
    return { expandedCount, totalWeeks, weeksWithData, staffCount, recordsCount };
  }, [state.expandedWeeks.size, state.weeksData]);

  return {
    state,
    setState,
    typesOfLeave,
    isLoadingTypesOfLeave,
    getLeaveTypeColor,
    weeks,
    refreshTimetableData,
    handleMonthChange,
    handleExportToExcel,
    statistics,
    toggleWeekExpand,
    expandAllWeeks,
    collapseAllWeeks,
    staffMembers,
    getLeaveTypeTitle,
    getLeaveTypeById
  };
};