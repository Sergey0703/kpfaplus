// src/webparts/kpfaplus/components/Tabs/TimetableTab/useTimetableLogic.ts
// ОБНОВЛЕНО v5.0: Полная поддержка Date-only формата + числовые поля времени

import { useEffect, useMemo, useCallback, useState } from 'react';
import * as ExcelJS from 'exceljs';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';
import { StaffRecordsService } from '../../../services/StaffRecordsService';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { HolidaysService, IHoliday } from '../../../services/HolidaysService';
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
   formatDayCellWithMarkers,
  formatDateForExcel, 
  generateFileName,
  saveTimetableDate
} from './timetableTabUtils';

export interface ITimetableLogicProps extends ITabProps {
  // Additional props if needed
}

/**
 * ОБНОВЛЕНО v5.0: Создает правильные границы месяца для Date-only Holiday фильтрации
 * Date-only: Все операции с датами нормализованы к полуночи
 */
const createMonthBoundariesForHolidays = (selectedDate: Date): { 
  startOfMonth: Date; 
  endOfMonth: Date; 
} => {
  console.log('[useTimetableLogic] v5.0: Creating month boundaries for date-only holidays');
  console.log('[useTimetableLogic] v5.0: Input selectedDate:', {
    date: selectedDate.toLocaleDateString(),
    iso: selectedDate.toISOString()
  });
  
  // *** ОБНОВЛЕНО v5.0: Нормализуем selectedDate к date-only ***
  const normalizedSelectedDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
  
  // Используем локальные компоненты даты для избежания проблем с часовыми поясами
  const year = normalizedSelectedDate.getFullYear();
  const month = normalizedSelectedDate.getMonth(); // 0-11
  
  console.log('[useTimetableLogic] v5.0: Date components:', { year, month: month + 1 });
  
  // *** Date-only границы месяца ***
  const startOfMonth = new Date(year, month, 1); // Первый день месяца (полночь)
  const endOfMonth = new Date(year, month + 1, 0); // Последний день месяца (полночь)
  
  console.log('[useTimetableLogic] v5.0: Date-only month boundaries created:');
  console.log('[useTimetableLogic] v5.0: - Start of month:', {
    date: startOfMonth.toLocaleDateString(),
    iso: startOfMonth.toISOString()
  });
  console.log('[useTimetableLogic] v5.0: - End of month:', {
    date: endOfMonth.toLocaleDateString(),
    iso: endOfMonth.toISOString()
  });
  console.log('[useTimetableLogic] v5.0: - Days in month:', endOfMonth.getDate());
  
  return { startOfMonth, endOfMonth };
};

/**
 * НОВЫЙ МЕТОД v5.0: Нормализует дату к date-only формату
 */
const normalizeDateToDateOnly = (date: Date): Date => {
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  console.log('[useTimetableLogic] v5.0: Date normalization:', {
    original: date.toLocaleDateString(),
    originalISO: date.toISOString(),
    normalized: normalized.toLocaleDateString(),
    normalizedISO: normalized.toISOString()
  });
  return normalized;
};

export const useTimetableLogic = (props: ITimetableLogicProps): {
  state: ReturnType<typeof useTimetableTabState>['state'];
  setState: ReturnType<typeof useTimetableTabState>['setState'];
  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  holidays: IHoliday[];
  isLoadingHolidays: boolean;
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
  
  // Состояние для holidays
  const [holidays, setHolidays] = useState<IHoliday[]>([]);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState<boolean>(false);
  
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

  // Holidays Service
  const holidaysService = useMemo(() => {
    if (context) {
      return HolidaysService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // ЗАГРУЗКА TYPES OF LEAVE
  useEffect(() => {
    const loadTypesOfLeave = async (): Promise<void> => {
      if (!typeOfLeaveService) return;
      try {
        setIsLoadingTypesOfLeave(true);
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        setTypesOfLeave(types);
        console.log('[useTimetableLogic] v5.0: Loaded types of leave:', types.length);
      } catch (error) {
        console.error('[useTimetableLogic] v5.0: Error loading types of leave:', error);
        setTypesOfLeave([]);
      } finally {
        setIsLoadingTypesOfLeave(false);
      }
    };
    loadTypesOfLeave().catch((error: unknown) => console.error('[useTimetableLogic] v5.0: Failed to load types of leave:', error));
  }, [typeOfLeaveService]);

  // ОБНОВЛЕНО v5.0: ЗАГРУЗКА HOLIDAYS С DATE-ONLY ПОДДЕРЖКОЙ
  useEffect(() => {
    const loadHolidays = async (): Promise<void> => {
      if (!holidaysService) return;
      try {
        setIsLoadingHolidays(true);
        
        console.log('[useTimetableLogic] v5.0: Loading holidays with date-only support');
        console.log('[useTimetableLogic] v5.0: Selected date for holiday loading:', {
          date: state.selectedDate.toLocaleDateString(),
          iso: state.selectedDate.toISOString(),
          month: state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
        });
        
        // *** ОБНОВЛЕНО v5.0: Создаем правильные границы месяца для Date-only формата ***
        const { startOfMonth } = createMonthBoundariesForHolidays(state.selectedDate);
        
        // *** Date-only запрос holidays ***
        const monthHolidays = await holidaysService.getHolidaysByMonthAndYear(startOfMonth);
        setHolidays(monthHolidays);
        
        console.log('[useTimetableLogic] v5.0: Holidays loaded successfully with date-only support');
        console.log('[useTimetableLogic] v5.0: Holidays count:', monthHolidays.length);
        console.log('[useTimetableLogic] v5.0: Holidays list:', monthHolidays.map(h => ({ 
          title: h.title, 
          date: h.date.toLocaleDateString(),
          dateISO: h.date.toISOString()
        })));
        
        // *** ОБНОВЛЕНО v5.0: Проверяем, что все загруженные праздники попадают в выбранный месяц ***
        const expectedMonth = startOfMonth.getMonth();
        const expectedYear = startOfMonth.getFullYear();
        
        const holidaysInCorrectMonth = monthHolidays.filter(h => {
          const normalizedHolidayDate = normalizeDateToDateOnly(h.date);
          return normalizedHolidayDate.getMonth() === expectedMonth && normalizedHolidayDate.getFullYear() === expectedYear;
        });
        
        if (holidaysInCorrectMonth.length !== monthHolidays.length) {
          console.warn('[useTimetableLogic] v5.0: Some holidays are outside expected month range!');
          console.warn('[useTimetableLogic] v5.0: Expected month/year:', expectedMonth + 1, expectedYear);
          console.warn('[useTimetableLogic] v5.0: Holidays outside range:', 
            monthHolidays.filter(h => {
              const normalizedHolidayDate = normalizeDateToDateOnly(h.date);
              return normalizedHolidayDate.getMonth() !== expectedMonth || normalizedHolidayDate.getFullYear() !== expectedYear;
            }).map(h => ({ title: h.title, date: h.date.toLocaleDateString() }))
          );
        }
        
      } catch (error) {
        console.error('[useTimetableLogic] v5.0: Error loading holidays:', error);
        setHolidays([]);
      } finally {
        setIsLoadingHolidays(false);
      }
    };
    loadHolidays().catch((error: unknown) => console.error('[useTimetableLogic] v5.0: Failed to load holidays:', error));
  }, [holidaysService, state.selectedDate]);

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

  // СТАБИЛЬНЫЙ РАСЧЕТ НЕДЕЛЬ С DATE-ONLY ПОДДЕРЖКОЙ
  const weeks: IWeekInfo[] = useMemo(() => {
    console.log('[useTimetableLogic] v5.0: Calculating weeks with date-only support');
    
    // *** ОБНОВЛЕНО v5.0: Нормализуем selectedDate к date-only ***
    const normalizedSelectedDate = normalizeDateToDateOnly(state.selectedDate);
    
    const weekCalculationParams: IWeekCalculationParams = {
      selectedDate: normalizedSelectedDate,
      startWeekDay: dayOfStartWeek || 7
    };
    
    const calculatedWeeks = TimetableWeekCalculator.calculateWeeksForMonth(weekCalculationParams);
    
    console.log('[useTimetableLogic] v5.0: Weeks calculated with date-only support', {
      selectedMonth: normalizedSelectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      weeksCount: calculatedWeeks.length,
      firstWeek: calculatedWeeks[0]?.weekLabel
    });
    
    return calculatedWeeks;
  }, [state.selectedDate, dayOfStartWeek]);

  // ОБНОВЛЕНИЕ WEEKS В STATE
  useEffect(() => {
    if (weeks.length > 0 && weeks !== state.weeks) {
      console.log('[useTimetableLogic] v5.0: Updating weeks in state with date-only support', {
        weeksCount: weeks.length,
        firstWeek: weeks[0]?.weekLabel
      });
      setWeeks(weeks);
    }
  }, [weeks, state.weeks, setWeeks]);

  // ОБНОВЛЕННАЯ ФУНКЦИЯ ЗАГРУЗКИ ДАННЫХ С DATE-ONLY HOLIDAYS
  const loadDataInternal = useCallback(async (forceReload = false): Promise<void> => {
    console.log('[useTimetableLogic] v5.0: Loading data with date-only support');
    
    // Создаем уникальный ключ для текущего состояния (включая holidays)
    const currentKey = `${state.selectedDate.getTime()}-${managingGroupId}-${weeks.length}-${staffMembers.length}-${holidays.length}`;
    
    // Проверяем, нужна ли загрузка
    if (!forceReload && currentKey === dataLoadKey) {
      console.log('[useTimetableLogic] v5.0: Data already loaded for this state', { currentKey });
      return;
    }

    // Проверяем обязательные условия (добавлена проверка holidays загружены)
    if (!context || !staffRecordsService || !managingGroupId || !currentUserId || weeks.length === 0 || staffMembers.length === 0) {
      console.log('[useTimetableLogic] v5.0: Clearing data - missing requirements');
      setStaffRecords([]);
      setWeeksData([]);
      setIsLoadingStaffRecords(false);
      setErrorStaffRecords(undefined);
      return;
    }

    // Ждем загрузки holidays перед обработкой данных
    if (isLoadingHolidays) {
      console.log('[useTimetableLogic] v5.0: Waiting for holidays to load');
      return;
    }

    if (isManualLoading) {
      console.log('[useTimetableLogic] v5.0: Skipping - already loading');
      return;
    }

    try {
      setIsManualLoading(true);
      setIsLoadingStaffRecords(true);
      setErrorStaffRecords(undefined);
      
      console.log('[useTimetableLogic] v5.0: Loading data with date-only holidays', {
        selectedMonth: state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        weeksCount: weeks.length,
        staffMembersCount: staffMembers.length,
        holidaysCount: holidays.length,
        currentKey,
        forceReload
      });

      // *** ОБНОВЛЕНО v5.0: Получаем date-only границы месяца ***
      const monthBoundaries = createMonthBoundariesForHolidays(state.selectedDate);
      const startOfMonth = monthBoundaries.startOfMonth;
      const endOfMonth = monthBoundaries.endOfMonth;

      const activeStaffMembers = staffMembers.filter(staffMember => {
        const isDeleted = staffMember.deleted === 1;
        const hasEmployeeId = staffMember.employeeId && staffMember.employeeId !== '0';
        return !isDeleted && hasEmployeeId;
      });

      if (activeStaffMembers.length === 0) {
        console.log('[useTimetableLogic] v5.0: No active staff members');
        setStaffRecords([]);
        setWeeksData([]);
        setDataLoadKey(currentKey);
        return;
      }

      const queryParams = {
        startDate: startOfMonth,
        endDate: endOfMonth,
        currentUserID: currentUserId,
        staffGroupID: managingGroupId,
        employeeID: '',
        timeTableID: undefined
      };

      console.log('[useTimetableLogic] v5.0: Staff records query params with date-only boundaries', {
        startDate: queryParams.startDate.toLocaleDateString(),
        startDateISO: queryParams.startDate.toISOString(),
        endDate: queryParams.endDate.toLocaleDateString(),
        endDateISO: queryParams.endDate.toISOString(),
        staffGroupID: queryParams.staffGroupID,
        currentUserID: queryParams.currentUserID
      });

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

      console.log('[useTimetableLogic] v5.0: Processing data with date-only holidays', {
        totalRecords: allRecords.length,
        filteredRecords: filteredRecords.length,
        holidaysForProcessing: holidays.length
      });

      // *** ОБНОВЛЕНО v5.0: Передаем date-only holidays в обработку данных ***
      const weeksData = TimetableDataProcessor.processDataByWeeks({
        staffRecords: filteredRecords,
        staffMembers: activeStaffMembers,
        weeks: weeks,
        getLeaveTypeColor,
        holidayColor: TIMETABLE_COLORS.HOLIDAY,
        holidays: holidays, // Date-only holidays
        holidaysService: holidaysService
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

      console.log('[useTimetableLogic] v5.0: Data loaded successfully with date-only holidays', {
        recordsCount: filteredRecords.length,
        weeksDataCount: enhancedWeeksData.length,
        holidaysUsed: holidays.length,
        currentKey
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useTimetableLogic] v5.0: Error loading data', errorMessage);
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
    holidays, // Date-only holidays dependency
    dataLoadKey,
    context,
    staffRecordsService,
    currentUserId,
    isManualLoading,
    isLoadingHolidays,
    getLeaveTypeColor,
    getLeaveTypeTitle,
    holidaysService,
    setStaffRecords,
    setWeeksData,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  ]);

  // АВТОМАТИЧЕСКИЙ ТРИГГЕР ЗАГРУЗКИ
  useEffect(() => {
    const currentKey = `${state.selectedDate.getTime()}-${managingGroupId}-${weeks.length}-${staffMembers.length}-${holidays.length}`;
    
    // Добавлена проверка что holidays загружены
    if (currentKey !== dataLoadKey && weeks.length > 0 && staffMembers.length > 0 && !isManualLoading && !isLoadingHolidays) {
      console.log('[useTimetableLogic] v5.0: Auto trigger data load with date-only holidays', {
        currentKey,
        dataLoadKey,
        holidaysCount: holidays.length,
        selectedMonth: state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      });
      
      const timeoutId = window.setTimeout(() => {
        loadDataInternal(false).catch((error: unknown) => {
          console.error('[useTimetableLogic] v5.0: Error in auto load:', error);
        });
      }, 300);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [state.selectedDate, managingGroupId, weeks.length, staffMembers.length, holidays.length, dataLoadKey, isManualLoading, isLoadingHolidays, loadDataInternal]);

  // ПУБЛИЧНЫЕ ФУНКЦИИ
  const refreshTimetableData = useCallback(async (): Promise<void> => {
    console.log('[useTimetableLogic] v5.0: Manual refresh');
    await loadDataInternal(true);
  }, [loadDataInternal]);

  // ОБНОВЛЕНО v5.0: ОБРАБОТКА СМЕНЫ МЕСЯЦА С DATE-ONLY ПОДДЕРЖКОЙ
  const handleMonthChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[useTimetableLogic] v5.0: Month change with date-only holidays', {
        newDate: date.toLocaleDateString(),
        newDateISO: date.toISOString(),
        newMonth: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      });
      
      // *** ОБНОВЛЕНО v5.0: Нормализуем дату к первому дню месяца для консистентности ***
      const normalizedDate = new Date(date.getFullYear(), date.getMonth(), 1);
      console.log('[useTimetableLogic] v5.0: Normalized to first day of month:', {
        normalized: normalizedDate.toLocaleDateString(),
        normalizedISO: normalizedDate.toISOString()
      });
      
      saveTimetableDate(normalizedDate);
      
      setState(prevState => ({ 
        ...prevState, 
        selectedDate: normalizedDate,
        expandedWeeks: new Set([1])
      }));
      
      // Holidays загрузятся автоматически по изменению selectedDate
    }
  }, [setState]);

  // ОБНОВЛЕННАЯ ФУНКЦИЯ EXCEL ЭКСПОРТА С DATE-ONLY HOLIDAYS
  const handleExportToExcel = async (): Promise<void> => {
    try {
      if (state.weeksData.length === 0) {
        setState(prevState => ({ ...prevState, errorStaffRecords: 'No data available for export' }));
        return;
      }

      const department = departments.find(d => d.ID.toString() === managingGroupId);
      const groupName = department?.Title || `Group ${managingGroupId}`;
      
      console.log('[useTimetableLogic] v5.0: Excel export with date-only holidays', {
        groupName,
        weeksData: state.weeksData.length,
        holidays: holidays.length
      });
      
      // *** ОБНОВЛЕНО v5.0: Передаем Date-only holidays в Excel export ***
      const excelWeeksData = TimetableDataProcessor.processDataForExcelExport({
        staffRecords: state.staffRecords,
        staffMembers: staffMembers.filter(sm => sm.deleted !== 1),
        weeks: weeks,
        getLeaveTypeColor,
        holidayColor: TIMETABLE_COLORS.HOLIDAY,
        holidays: holidays, // Date-only holidays
        holidaysService: holidaysService
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
            
            // *** ОБНОВЛЕНО v5.0: Excel cell content с поддержкой Date-only holidays ***
            const cellContent = formatDayCellWithMarkers(dayData, typesOfLeave);
            
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
      
      console.log('[useTimetableLogic] v5.0: Creating Excel file with date-only holidays');
      console.log(`[useTimetableLogic] v5.0: File name: ${fileName}`);
      console.log(`[useTimetableLogic] v5.0: Total rows: ${currentRow}`);
      console.log(`[useTimetableLogic] v5.0: Date-only holidays used: ${holidays.length}`);
      console.log('[useTimetableLogic] v5.0: ============================');
      
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
      
      console.log('[useTimetableLogic] v5.0: Excel file created and downloaded with date-only holidays support');
      
    } catch (error) {
      console.error('[useTimetableLogic] v5.0: Excel export failed:', error);
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
    holidays, // Date-only holidays
    isLoadingHolidays,
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