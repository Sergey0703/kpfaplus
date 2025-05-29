// src/webparts/kpfaplus/components/Tabs/TimetableTab/TimetableTab.tsx
import * as React from 'react';
import { useEffect, useMemo, useCallback } from 'react';
import { 
  DatePicker, 
  DayOfWeek, 
  MessageBar,
  MessageBarType,
  Spinner
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';
import { StaffRecordsService } from '../../../services/StaffRecordsService';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { 
  IWeekInfo, 
  IWeekCalculationParams,
  IDayInfo,
  TIMETABLE_COLORS,
  ColorPriority
} from './interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './utils/TimetableWeekCalculator';
import { TimetableShiftCalculatorLeaveTypes } from './utils/TimetableShiftCalculatorLeaveTypes';
import { useTimetableTabState } from './utils/useTimetableTabState';
import { useTimetableStaffRecordsData } from './utils/useTimetableStaffRecordsData';
import { 
  TimetableWeekGroup, 
  TimetableExpandControls 
} from './components/TimetableWeekGroup';
import * as ExcelJS from 'exceljs';

// Константы
const calendarMinWidth = '655px';

export interface ITimetableTabProps extends ITabProps {
  // Дополнительные пропсы для таблицы времени, если понадобятся
}

// Локализация для DatePicker
const datePickerStringsEN = {
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
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

export const TimetableTab: React.FC<ITimetableTabProps> = (props) => {
  const { managingGroupId, currentUserId, dayOfStartWeek, context } = props;
  
  // Получаем данные из контекста
  const { staffMembers, departments } = useDataContext();

  // Инициализируем хуки состояния
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

  // Состояние для типов отпусков
  const [typesOfLeave, setTypesOfLeave] = React.useState<ITypeOfLeave[]>([]);
  const [isLoadingTypesOfLeave, setIsLoadingTypesOfLeave] = React.useState<boolean>(false);

  // НОВОЕ: Состояние для статистики праздников
  const [holidayStatistics, setHolidayStatistics] = React.useState<{
    totalRecords: number;
    recordsWithHoliday: number;
    recordsWithLeave: number;
    recordsWithBoth: number;
    holidayPercentage: number;
    leavePercentage: number;
  }>({
    totalRecords: 0,
    recordsWithHoliday: 0,
    recordsWithLeave: 0,
    recordsWithBoth: 0,
    holidayPercentage: 0,
    leavePercentage: 0
  });

  // Инициализируем сервисы
  const staffRecordsService = useMemo(() => {
    if (context) {
      console.log('[TimetableTab] Initializing StaffRecordsService with Holiday support');
      return StaffRecordsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const typeOfLeaveService = useMemo(() => {
    if (context) {
      console.log('[TimetableTab] Initializing TypeOfLeaveService');
      return TypeOfLeaveService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Загружаем типы отпусков при инициализации
  useEffect(() => {
    const loadTypesOfLeave = async (): Promise<void> => {
      if (!typeOfLeaveService) return;
      
      try {
        setIsLoadingTypesOfLeave(true);
        console.log('[TimetableTab] Loading types of leave...');
        
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        console.log('[TimetableTab] Loaded types of leave:', types.length);
        
        // Логируем примеры типов отпусков для отладки
        types.slice(0, 3).forEach(type => {
          console.log(`[TimetableTab] Leave type: ${type.title} (ID: ${type.id}) - Color: ${type.color}`);
        });
        
        setTypesOfLeave(types);
      } catch (error) {
        console.error('[TimetableTab] Error loading types of leave:', error);
      } finally {
        setIsLoadingTypesOfLeave(false);
      }
    };

    loadTypesOfLeave().catch(error => {
      console.error('[TimetableTab] Failed to load types of leave:', error);
    });
  }, [typeOfLeaveService]);

  // НОВОЕ: Анализируем статистику праздников при изменении данных
  useEffect(() => {
    if (state.staffRecords.length > 0) {
      const totalRecords = state.staffRecords.length;
      const recordsWithHoliday = state.staffRecords.filter(r => r.Holiday === 1).length;
      const recordsWithLeave = state.staffRecords.filter(r => r.TypeOfLeaveID).length;
      const recordsWithBoth = state.staffRecords.filter(r => r.Holiday === 1 && r.TypeOfLeaveID).length;
      
      const holidayPercentage = totalRecords > 0 ? Math.round((recordsWithHoliday / totalRecords) * 100) : 0;
      const leavePercentage = totalRecords > 0 ? Math.round((recordsWithLeave / totalRecords) * 100) : 0;

      const stats = {
        totalRecords,
        recordsWithHoliday,
        recordsWithLeave,
        recordsWithBoth,
        holidayPercentage,
        leavePercentage
      };

      setHolidayStatistics(stats);

      console.log('[TimetableTab] Holiday statistics updated:', {
        ...stats,
        prioritySystem: 'Holiday > Leave Type > Default',
        holidayColor: TIMETABLE_COLORS.HOLIDAY
      });
    }
  }, [state.staffRecords]);

  // Функция для получения цвета типа отпуска
  const getLeaveTypeColor = useCallback((typeOfLeaveId: string): string | undefined => {
    if (!typeOfLeaveId || !typesOfLeave.length) return undefined;
    
    const leaveType = typesOfLeave.find(t => t.id === typeOfLeaveId);
    const color = leaveType?.color;
    
    if (color) {
      console.log(`[TimetableTab] Found color ${color} for leave type ID: ${typeOfLeaveId} (Holiday priority system active)`);
    }
    
    return color;
  }, [typesOfLeave]);

  // Рассчитываем недели для выбранного месяца
  const weeks: IWeekInfo[] = useMemo(() => {
    const weekCalculationParams: IWeekCalculationParams = {
      selectedDate: state.selectedDate,
      startWeekDay: dayOfStartWeek || 7 // По умолчанию суббота
    };

    const calculatedWeeks = TimetableWeekCalculator.calculateWeeksForMonth(weekCalculationParams);
    
    console.log('[TimetableTab] Calculated weeks for server requests with Holiday support:', {
      selectedMonth: state.selectedDate.toLocaleDateString(),
      startWeekDay: dayOfStartWeek,
      weeksCount: calculatedWeeks.length,
      dateRange: {
        start: calculatedWeeks[0]?.weekStart.toLocaleDateString(),
        end: calculatedWeeks[calculatedWeeks.length - 1]?.weekEnd.toLocaleDateString()
      },
      holidaySupport: 'Enabled with red color priority system',
      colorPriority: 'Holiday (#f44336) > Leave Type > Default'
    });

    return calculatedWeeks;
  }, [state.selectedDate, dayOfStartWeek]);

  // Обновляем состояние недель при их пересчете
  useEffect(() => {
    if (weeks.length > 0 && weeks.length !== state.weeks.length) {
      console.log('[TimetableTab] Updating weeks in state for server requests with Holiday support:', weeks.length);
      setWeeks(weeks);
    }
  }, [weeks, state.weeks.length, setWeeks]);

  // Инициализируем хук загрузки данных - ДАННЫЕ ФИЛЬТРУЮТСЯ НА СЕРВЕРЕ
  const { refreshTimetableData } = useTimetableStaffRecordsData({
    context,
    selectedDate: state.selectedDate,
    currentUserId,          // *** ИСПОЛЬЗУЕТСЯ ДЛЯ СЕРВЕРНОЙ ФИЛЬТРАЦИИ ***
    managingGroupId,        // *** ИСПОЛЬЗУЕТСЯ ДЛЯ СЕРВЕРНОЙ ФИЛЬТРАЦИИ ***
    staffRecordsService,
    weeks: state.weeks,
    staffMembers,           // Активные сотрудники с employeeId будут обработаны
    setWeeksData,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  });

  // Обработчики событий
  const handleMonthChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[TimetableTab] Month changed to:', formatDate(date));
      console.log('[TimetableTab] This will trigger new server requests for all active staff with Holiday support');
      
      // Обновляем выбранную дату через setState
      setState(prevState => ({
        ...prevState,
        selectedDate: date
      }));
    }
  };

  // ОБНОВЛЕННЫЙ обработчик экспорта в Excel с поддержкой праздников
  const handleExportToExcel = async (): Promise<void> => {
    console.log('[TimetableTab] Export to Excel requested with ExcelJS and Holiday support');
    
    try {
      // Проверяем наличие данных
      if (state.weeksData.length === 0) {
        console.warn('[TimetableTab] No data to export');
        setState(prevState => ({
          ...prevState,
          errorStaffRecords: 'No data available for export'
        }));
        return;
      }

      // Находим название группы
      const department = departments.find(d => d.ID.toString() === managingGroupId);
      const groupName = department?.Title || `Group ${managingGroupId}`;
      
      console.log('[TimetableTab] Starting ExcelJS workbook creation with Holiday support and color priority system...');
      
      // Создаем workbook с ExcelJS
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Timetable');
      
      // Получаем упорядоченные дни недели
      const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek || 7);
      const dayNames = orderedDays.map(dayNum => TimetableWeekCalculator.getDayName(dayNum));
      
      // Устанавливаем ширину столбцов
      const colWidths = [{ width: 20 }]; // Employee колонка
      for (let i = 0; i < orderedDays.length; i++) {
        colWidths.push({ width: 25 }); // Дни недели
      }
      worksheet.columns = colWidths.map((col, index) => ({
        key: index.toString(),
        width: col.width
      }));
      
      let currentRow = 1;
      
      // Заголовок документа
      const titleCell = worksheet.getCell(currentRow, 1);
      titleCell.value = `Time table for Centre: ${groupName}`;
      titleCell.style = {
        font: { bold: true, size: 14 },
        alignment: { horizontal: 'center' }
      };
      
      // Объединяем ячейки для заголовка
      worksheet.mergeCells(currentRow, 1, currentRow, orderedDays.length + 1);
      currentRow += 1;

      // НОВОЕ: Добавляем информацию о статистике праздников
      const statsCell = worksheet.getCell(currentRow, 1);
      statsCell.value = `Holiday Statistics: ${holidayStatistics.recordsWithHoliday} holidays (${holidayStatistics.holidayPercentage}%), ${holidayStatistics.recordsWithLeave} leaves (${holidayStatistics.leavePercentage}%)`;
      statsCell.style = {
        font: { size: 10, italic: true },
        alignment: { horizontal: 'center' }
      };
      worksheet.mergeCells(currentRow, 1, currentRow, orderedDays.length + 1);
      currentRow += 2; // Пропускаем строку
      
      // Обрабатываем каждую неделю
      state.weeksData.forEach((weekGroup, weekIndex) => {
        const { weekInfo, staffRows } = weekGroup;
        
        // Строка заголовка недели + дни недели (СЕРЫЙ ФОН)
        const weekTitle = `Week ${weekInfo.weekNum}: ${formatDateForExcel(weekInfo.weekStart)} - ${formatDateForExcel(weekInfo.weekEnd)}`;
        
        // Заполняем строку: Week title + дни недели
        worksheet.getCell(currentRow, 1).value = weekTitle;
        dayNames.forEach((dayName, dayIndex) => {
          worksheet.getCell(currentRow, dayIndex + 2).value = dayName;
        });
        
        // Применяем серый фон и стиль для всей строки заголовка недели
        for (let col = 1; col <= orderedDays.length + 1; col++) {
          const cell = worksheet.getCell(currentRow, col);
          cell.style = {
            font: { bold: true },
            fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFD9D9D9' } // Серый фон как в образце
            },
            alignment: { horizontal: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
        currentRow++;
        
        // Строка Employee + даты (СВЕТЛО-СЕРЫЙ ФОН)
        worksheet.getCell(currentRow, 1).value = 'Employee';
        orderedDays.forEach((dayNum, dayIndex) => {
          const dayDate = TimetableWeekCalculator.getDateForDayInWeek(weekInfo.weekStart, dayNum);
          worksheet.getCell(currentRow, dayIndex + 2).value = formatDateForExcel(dayDate);
        });
        
        // Применяем светло-серый фон для строки Employee + даты
        for (let col = 1; col <= orderedDays.length + 1; col++) {
          const cell = worksheet.getCell(currentRow, col);
          cell.style = {
            font: { bold: true },
            fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF0F0F0' } // Светло-серый фон
            },
            alignment: { horizontal: 'center' },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
        }
        currentRow++;
        
        // Данные сотрудников
        staffRows.forEach((staffRow: any) => {
          // Строка с именем сотрудника и данными по дням
          const nameCell = worksheet.getCell(currentRow, 1);
          // Объединяем имя и часы в одной ячейке с переносом строки
          nameCell.value = `${staffRow.staffName}\n${staffRow.weekData.formattedWeekTotal.trim()}`;
          nameCell.style = {
            font: { bold: true },
            alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
            border: {
              top: { style: 'thin' },
              bottom: { style: 'thin' },
              left: { style: 'thin' },
              right: { style: 'thin' }
            }
          };
          
          // Добавляем данные по дням с цветами ПРАЗДНИКОВ И ОТПУСКОВ
          orderedDays.forEach((dayNum, dayIndex) => {
            const dayData = staffRow.weekData.days[dayNum];
            const cellContent = formatDayCell(dayData);
            const dayCell = worksheet.getCell(currentRow, dayIndex + 2);
            dayCell.value = cellContent;
            
            // *** НОВОЕ: СИСТЕМА ПРИОРИТЕТОВ ЦВЕТОВ ДЛЯ EXCEL ***
            const cellStyles = TimetableShiftCalculatorLeaveTypes.createCellStyles(
              dayData?.shifts || [], 
              getLeaveTypeColor
            );

            const cellStyle: any = {
              alignment: { 
                horizontal: 'center',
                vertical: 'middle',
                wrapText: true 
              },
              border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
              }
            };
            
            // *** ПРИМЕНЯЕМ ЦВЕТ ПО СИСТЕМЕ ПРИОРИТЕТОВ ***
            if (cellStyles.backgroundColor && cellStyles.backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
              const hexColor = cellStyles.backgroundColor.replace('#', '');
              cellStyle.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: `FF${hexColor}` }
              };
              
              // Определяем цвет текста для читаемости
              if (cellStyles.priority === ColorPriority.HOLIDAY) {
                cellStyle.font = { color: { argb: 'FFFFFFFF' }, bold: true }; // Белый жирный текст для праздников
                console.log(`[TimetableTab] Applied HOLIDAY color ${cellStyles.backgroundColor} to Excel cell for ${staffRow.staffName}, day ${dayNum}`);
              } else if (cellStyles.priority === ColorPriority.LEAVE_TYPE) {
                // Определяем контрастный цвет для типов отпусков
                const textColor = TimetableShiftCalculatorLeaveTypes.getTextColorForBackground(cellStyles.backgroundColor);
                cellStyle.font = { color: { argb: textColor === '#ffffff' ? 'FFFFFFFF' : 'FF000000' } };
                console.log(`[TimetableTab] Applied LEAVE TYPE color ${cellStyles.backgroundColor} to Excel cell for ${staffRow.staffName}, day ${dayNum}`);
              }
            }
            
            dayCell.style = cellStyle;
          });
          currentRow++; // Переходим к следующему сотруднику
        });
        
        // Пустая строка между неделями (кроме последней)
        if (weekIndex < state.weeksData.length - 1) {
          currentRow++;
        }
      });
      
      // Генерируем имя файла
      const fileName = generateFileName(groupName, state.weeksData);
      
      // Создаем и сохраняем файл
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('[TimetableTab] ExcelJS export completed successfully with Holiday support and color priority system:', fileName);
      
    } catch (error) {
      console.error('[TimetableTab] ExcelJS export failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown export error';
      setState(prevState => ({
        ...prevState,
        errorStaffRecords: `Export failed: ${errorMessage}`
      }));
    }
  };

  // Получаем статистику
  const statistics = useMemo(() => {
    const expandedCount = state.expandedWeeks.size;
    const totalWeeks = state.weeksData.length;
    const weeksWithData = state.weeksData.filter(w => w.hasData).length;
    
    // Подсчитываем общее количество сотрудников и записей
    let staffCount = 0;
    let recordsCount = 0;
    let holidayRecordsCount = 0;
    let leaveRecordsCount = 0;
    
    if (state.weeksData.length > 0) {
      // Берем количество сотрудников из первой недели (состав одинаков)
      staffCount = state.weeksData[0].staffRows.length;
      
      // Подсчитываем общее количество записей с анализом праздников и отпусков
      state.weeksData.forEach(weekGroup => {
        weekGroup.staffRows.forEach(staffRow => {
          Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
            recordsCount += day.shifts ? day.shifts.length : 0;
            if (day.shifts) {
              holidayRecordsCount += day.shifts.filter(s => s.isHoliday).length;
              leaveRecordsCount += day.shifts.filter(s => s.typeOfLeaveId).length;
            }
          });
        });
      });
    }
    
    const stats = {
      expandedCount,
      totalWeeks,
      weeksWithData,
      staffCount,
      recordsCount,
      holidayRecordsCount,
      leaveRecordsCount
    };
    
    console.log('[TimetableTab] Current statistics with Holiday support:', {
      ...stats,
      holidayPercentage: recordsCount > 0 ? Math.round((holidayRecordsCount / recordsCount) * 100) : 0,
      leavePercentage: recordsCount > 0 ? Math.round((leaveRecordsCount / recordsCount) * 100) : 0,
      prioritySystem: 'Holiday > Leave Type > Default'
    });
    return stats;
  }, [state.expandedWeeks.size, state.weeksData, state.staffRecords.length]);

  // Логируем изменения состояния
  useEffect(() => {
    console.log('[TimetableTab] State updated with Holiday support:', {
      selectedDate: state.selectedDate.toLocaleDateString(),
      weeksCount: state.weeks.length,
      weeksDataCount: state.weeksData.length,
      staffRecordsCount: state.staffRecords.length,
      isLoading: state.isLoadingStaffRecords,
      hasError: !!state.errorStaffRecords,
      typesOfLeaveCount: typesOfLeave.length,
      holidayStatistics: holidayStatistics,
      colorSystem: {
        holidayColor: TIMETABLE_COLORS.HOLIDAY,
        priority: 'Holiday > Leave Type > Default'
      },
      note: 'Data processed with Holiday priority system'
    });
  }, [state, typesOfLeave.length, holidayStatistics]);

  console.log('[TimetableTab] Final render state with Holiday support:', {
    hasWeeksData: state.weeksData.length > 0,
    isLoading: state.isLoadingStaffRecords,
    hasError: !!state.errorStaffRecords,
    statistics,
    typesOfLeaveLoaded: typesOfLeave.length,
    holidayStatistics,
    holidaySupport: 'Fully integrated with red color priority',
    filteringNote: 'Server-side filtering by StaffMember, Manager, and StaffGroup'
  });

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Заголовок */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Staff Timetable - Week Groups View with Holiday Support
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {managingGroupId} | Current User ID: {currentUserId} | 
          Week starts on day: {dayOfStartWeek} | 
          Staff count: {statistics.staffCount} | 
          Records: {statistics.recordsCount} | 
          Leave types: {typesOfLeave.length} |{' '}
          <span style={{ color: TIMETABLE_COLORS.HOLIDAY, fontWeight: 'bold' }}>
            🔴 Holidays: {statistics.holidayRecordsCount} ({holidayStatistics.holidayPercentage}%)
          </span>
        </p>
      </div>

      {/* Панель настроек */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e1e5e9',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Выбор месяца */}
        <div style={{ minWidth: '220px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>Select Month</div>
          <DatePicker
            value={state.selectedDate}
            onSelectDate={handleMonthChange}
            firstDayOfWeek={DayOfWeek.Monday}
            strings={datePickerStringsEN}
            formatDate={formatDate}
            allowTextInput={false}
            disabled={state.isLoadingStaffRecords || isLoadingTypesOfLeave}
            showGoToToday={true}
            showMonthPickerAsOverlay={true}
            styles={{
              root: { width: '220px' },
              textField: {
                width: '100%',
                height: '32px',
                selectors: {
                  '.ms-TextField-field': { height: '32px' },
                },
              },
              callout: {
                minWidth: calendarMinWidth
              }
            }}
          />
        </div>
        
        {/* Информация о периоде и статистика с праздниками */}
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>Selected month: {state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          <div>{statistics.totalWeeks} weeks | {statistics.weeksWithData} with data</div>
          <div>Expanded: {statistics.expandedCount} weeks</div>
          <div style={{ color: TIMETABLE_COLORS.HOLIDAY }}>
            🔴 Holidays: {statistics.holidayRecordsCount} | 🟡 Leaves: {statistics.leaveRecordsCount}
          </div>
        </div>
        
        {/* НОВОЕ: Статистика приоритетов цветов */}
        <div style={{ fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
          <div>Color Priority System:</div>
          <div>1. <span style={{ color: TIMETABLE_COLORS.HOLIDAY }}>🔴 Holiday</span> (Highest)</div>
          <div>2. 🟡 Leave Type (Medium)</div>
          <div>3. ⚪ Default (Lowest)</div>
        </div>
        
        {/* Кнопка обновления данных */}
        <div>
          <button
            onClick={() => {
              console.log('[TimetableTab] Manual refresh requested - will make new server requests for all staff with Holiday support');
              refreshTimetableData().catch(error => {
                console.error('[TimetableTab] Manual refresh failed:', error);
              });
            }}
            disabled={state.isLoadingStaffRecords || isLoadingTypesOfLeave}
            style={{
              padding: '6px 12px',
              backgroundColor: state.isLoadingStaffRecords || isLoadingTypesOfLeave ? '#f3f2f1' : '#0078d4',
              color: state.isLoadingStaffRecords || isLoadingTypesOfLeave ? '#a19f9d' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isLoadingStaffRecords || isLoadingTypesOfLeave ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {state.isLoadingStaffRecords || isLoadingTypesOfLeave ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>

        {/* ОБНОВЛЕННАЯ кнопка экспорта в Excel с поддержкой праздников */}
        <div>
          <button
            onClick={() => {
              handleExportToExcel().catch(error => {
                console.error('[TimetableTab] Export button error:', error);
              });
            }}
            disabled={state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave}
            style={{
              padding: '6px 12px',
              backgroundColor: state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave ? '#f3f2f1' : '#107c10',
              color: state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave ? '#a19f9d' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isLoadingStaffRecords || state.weeksData.length === 0 || isLoadingTypesOfLeave ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
            title="Export with Holiday colors: Red for holidays, colored for leave types"
          >
            {state.isLoadingStaffRecords || isLoadingTypesOfLeave ? 'Loading...' : 'Export to Excel (Holiday Colors)'}
          </button>
        </div>
        
        {(state.isLoadingStaffRecords || isLoadingTypesOfLeave) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size={1} />
            <span style={{ fontSize: '12px', color: '#666' }}>
              {isLoadingTypesOfLeave ? 'Loading leave types...' : 'Loading individual staff records with Holiday support...'}
            </span>
          </div>
        )}
      </div>

      {/* Сообщение об ошибке */}
      {state.errorStaffRecords && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar messageBarType={MessageBarType.error}>
            {state.errorStaffRecords}
          </MessageBar>
        </div>
      )}

      {/* НОВОЕ: Информационная панель о статистике праздников */}
      {holidayStatistics.totalRecords > 0 && (holidayStatistics.recordsWithHoliday > 0 || holidayStatistics.recordsWithLeave > 0) && (
        <div style={{
          marginBottom: '15px',
          padding: '12px',
          backgroundColor: '#fff8e1',
          borderRadius: '4px',
          border: '1px solid #ffeb3b'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#f57c00' }}>
            📊 Color Priority Statistics
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#666' }}>
            <div>
              <span style={{ color: TIMETABLE_COLORS.HOLIDAY, fontWeight: 'bold' }}>🔴 Holidays:</span> {holidayStatistics.recordsWithHoliday} records ({holidayStatistics.holidayPercentage}%)
            </div>
            <div>
              <span style={{ color: '#ff9800', fontWeight: 'bold' }}>🟡 Leave Types:</span> {holidayStatistics.recordsWithLeave} records ({holidayStatistics.leavePercentage}%)
            </div>
            {holidayStatistics.recordsWithBoth > 0 && (
              <div>
                <span style={{ fontWeight: 'bold' }}>🔄 Both:</span> {holidayStatistics.recordsWithBoth} records (Holiday priority applied)
              </div>
            )}
          </div>
          <div style={{ fontSize: '11px', color: '#f57c00', marginTop: '4px', fontStyle: 'italic' }}>
            Color Priority: Holidays override leave types | Red color ({TIMETABLE_COLORS.HOLIDAY}) has highest priority
          </div>
        </div>
      )}

      {/* Управление разворачиванием */}
      {state.weeksData.length > 0 && (
        <TimetableExpandControls
          totalWeeks={statistics.totalWeeks}
          expandedCount={statistics.expandedCount}
          onExpandAll={expandAllWeeks}
          onCollapseAll={collapseAllWeeks}
        />
      )}

      {/* Основное содержимое */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {state.isLoadingStaffRecords || isLoadingTypesOfLeave ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spinner size={2} />
            <p style={{ marginTop: '16px' }}>
              {isLoadingTypesOfLeave ? 'Loading leave types...' : 'Loading staff timetable with Holiday support...'}
            </p>
            {state.isLoadingStaffRecords && (
              <>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  Making individual server requests for {staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0').length} active staff members
                </p>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  Processing Holiday field for red color priority system | Each request filters by: StaffMember = employeeId, Manager = {currentUserId}, StaffGroup = {managingGroupId}
                </p>
              </>
            )}
          </div>
        ) : state.weeksData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <MessageBar messageBarType={MessageBarType.warning} style={{ marginBottom: '20px' }}>
              No schedule records found for active staff members in selected period
            </MessageBar>
            
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: '#fff8e1', 
              borderRadius: '4px',
              textAlign: 'left',
              fontSize: '12px',
              color: '#666'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px', color: '#f57c00' }}>Information:</div>
              <div>• Total Staff Records Loaded: {state.staffRecords.length}</div>
              <div>• Weeks Calculated: {weeks.length}</div>
              <div>• Total Staff Members: {staffMembers.length}</div>
              <div>• Active Staff Members: {staffMembers.filter(s => s.deleted !== 1).length}</div>
              <div>• Active Staff with Employee ID: {staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0').length}</div>
              <div>• Managing Group ID: {managingGroupId || 'Not set'}</div>
              <div>• Current User ID: {currentUserId || 'Not set'}</div>
              <div style={{ marginTop: '8px', fontStyle: 'italic', color: '#f57c00' }}>
                This may be normal if no schedule data exists for the selected period.
              </div>
              <div style={{ marginTop: '8px', fontWeight: 'bold', color: TIMETABLE_COLORS.HOLIDAY }}>
                Holiday support: 🔴 Red color system ready for Holiday=1 records
              </div>
            </div>
            
            {weeks.length > 0 && statistics.staffCount >= 0 && (
              <button 
                onClick={() => {
                  console.log('[TimetableTab] Manual refresh requested from no-data state with Holiday support');
                  refreshTimetableData().catch(error => {
                    console.error('[TimetableTab] Manual refresh failed:', error);
                  });
                }}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: '#ff9800',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh Data
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* ОБНОВЛЕННАЯ информация о данных с праздниками */}
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '20px',
              padding: '8px 12px',
              backgroundColor: '#f0f6ff',
              borderRadius: '4px',
              border: '1px solid #deecf9'
            }}>
              Showing {statistics.totalWeeks} weeks for {statistics.staffCount} staff members | 
              {statistics.weeksWithData} weeks have data | 
              Total records: {statistics.recordsCount} | 
              <span style={{ color: TIMETABLE_COLORS.HOLIDAY, fontWeight: 'bold' }}>
                🔴 Holidays: {statistics.holidayRecordsCount}
              </span> | 
              🟡 Leaves: {statistics.leaveRecordsCount} | 
              Week starts on: {TimetableWeekCalculator.getDayName(dayOfStartWeek || 7)} | 
              Leave types loaded: {typesOfLeave.length} | 
              <span style={{ fontStyle: 'italic' }}>Holiday priority system active with red color ({TIMETABLE_COLORS.HOLIDAY})</span>
            </div>
            
            {/* Группы недель с поддержкой праздников */}
            {state.weeksData.map(weekGroup => (
              <TimetableWeekGroup
                key={weekGroup.weekInfo.weekNum}
                weekGroup={weekGroup}
                dayOfStartWeek={dayOfStartWeek || 7}
                onToggleExpand={toggleWeekExpand}
                getLeaveTypeColor={getLeaveTypeColor}
                holidayColor={TIMETABLE_COLORS.HOLIDAY} // НОВОЕ: Передаем цвет праздника
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Вспомогательные функции для экспорта Excel с ExcelJS и поддержкой праздников
function formatDateForExcel(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

function formatDayCell(dayData: any): string {
  if (!dayData || !dayData.hasData || dayData.shifts.length === 0) {
    return '';
  }
  
  if (dayData.shifts.length === 1) {
    // Одна смена
    const shift = dayData.shifts[0];
    const startTime = formatTimeForExcel(shift.startTime);
    const endTime = formatTimeForExcel(shift.endTime);
    const duration = formatDurationForExcel(shift.workMinutes);
    
    // НОВОЕ: Добавляем индикатор праздника в текст
    const holidayIndicator = shift.isHoliday ? ' 🔴H' : '';
    const leaveIndicator = shift.typeOfLeaveTitle && !shift.isHoliday ? ` [${shift.typeOfLeaveTitle}]` : '';
    
    return `${startTime} - ${endTime} (${duration})${holidayIndicator}${leaveIndicator}`;
  } else {
    // Несколько смен
    const shiftLines = dayData.shifts.map((shift: any) => {
      const startTime = formatTimeForExcel(shift.startTime);
      const endTime = formatTimeForExcel(shift.endTime);
      const duration = formatDurationForExcel(shift.workMinutes);
      
      // НОВОЕ: Добавляем индикаторы для каждой смены
      const holidayIndicator = shift.isHoliday ? ' 🔴H' : '';
      const leaveIndicator = shift.typeOfLeaveTitle && !shift.isHoliday ? ` [${shift.typeOfLeaveTitle}]` : '';
      
      return `${startTime} - ${endTime} (${duration})${holidayIndicator}${leaveIndicator}`;
    });
    
    return shiftLines.join('\n');
  }
}

function formatTimeForExcel(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

function formatDurationForExcel(minutes: number): string {
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

function generateFileName(groupName: string, weeksData: any[]): string {
  if (weeksData.length === 0) {
    return `Timetable_${groupName.replace(/[^a-zA-Z0-9]/g, '_')}_with_Holidays.xlsx`;
  }
  
  const firstWeek = weeksData[0];
  const lastWeek = weeksData[weeksData.length - 1];
  
  const startDate = firstWeek.weekInfo.weekStart;
  const endDate = lastWeek.weekInfo.weekEnd;
  
  const startStr = formatDateForExcel(startDate).replace('/', '-');
  const endStr = formatDateForExcel(endDate).replace('/', '-');
  
  const cleanGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `Timetable_${cleanGroupName}_${startStr}_to_${endStr}_with_Holidays.xlsx`;
}