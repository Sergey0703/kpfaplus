// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/TimetableExcelExporter.ts
import { 
  IWeekGroup, 
  IDayInfo 
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';
import { IDepartment } from '../../../../models/types';

// FIXED: Changed 'null' to 'undefined' to comply with ESLint rules
let XLSX: typeof import('xlsx') | undefined = undefined;

// FIXED: Added webpack chunk name comment and atomic update protection
async function loadXLSX(): Promise<typeof import('xlsx')> {
  if (!XLSX) {
    try {
      // FIXED: Added webpackChunkName comment as required by SPFx ESLint rules
      const xlsxModule = await import(/* webpackChunkName: 'xlsx-library' */ 'xlsx');
      
      // FIXED: Atomic update to prevent race conditions
      if (!XLSX) {
        XLSX = xlsxModule;
      }
    } catch (error) {
      console.error('Failed to load XLSX library:', error);
      throw new Error('Excel export library not available');
    }
  }
  return XLSX;
}

export interface ITimetableExportData {
  weeksData: IWeekGroup[];
  departments: IDepartment[];
  managingGroupId: string;
  dayOfStartWeek: number;
}

export class TimetableExcelExporter {
  
  /**
   * Основной метод экспорта данных в Excel
   */
  public static async exportToExcel(exportData: ITimetableExportData): Promise<void> {
    const { weeksData, departments, managingGroupId, dayOfStartWeek } = exportData;
    
    console.log('[TimetableExcelExporter] Starting Excel export:', {
      weeksCount: weeksData.length,
      managingGroupId,
      dayOfStartWeek
    });

    try {
      // Загружаем XLSX библиотеку
      const XLSXLib = await loadXLSX();
      
      // Находим название группы
      const department = departments.find(d => d.ID.toString() === managingGroupId);
      const groupName = department?.Title || `Group ${managingGroupId}`;
      
      // Создаем workbook
      const workbook = XLSXLib.utils.book_new();
      
      // Создаем worksheet
      const worksheetData = this.buildWorksheetData(weeksData, groupName, dayOfStartWeek);
      const worksheet = XLSXLib.utils.aoa_to_sheet(worksheetData);
      
      // Применяем стили и форматирование
      this.applyWorksheetFormatting(worksheet, weeksData, dayOfStartWeek, XLSXLib);
      
      // Добавляем worksheet в workbook
      XLSXLib.utils.book_append_sheet(workbook, worksheet, 'Timetable');
      
      // Генерируем имя файла
      const fileName = this.generateFileName(groupName, weeksData);
      
      // Сохраняем файл
      XLSXLib.writeFile(workbook, fileName);
      
      console.log('[TimetableExcelExporter] Excel file exported:', fileName);
    } catch (error) {
      console.error('[TimetableExcelExporter] Export failed:', error);
      throw error;
    }
  }

  /**
   * Создает данные для worksheet в формате массива массивов
   */
  private static buildWorksheetData(
    weeksData: IWeekGroup[], 
    groupName: string, 
    dayOfStartWeek: number
  ): Array<Array<string | number>> {
    const data: Array<Array<string | number>> = [];
    
    // Заголовок документа
    data.push([`Time table for Centre: ${groupName}`]);
    data.push([]); // Пустая строка
    
    // Получаем упорядоченные дни недели
    const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);
    const dayNames = orderedDays.map(dayNum => TimetableWeekCalculator.getDayName(dayNum));
    
    // Обрабатываем каждую неделю
    weeksData.forEach((weekGroup, weekIndex) => {
      const { weekInfo, staffRows } = weekGroup;
      
      // Заголовок недели
      const weekTitle = `Week ${weekInfo.weekNum}: ${this.formatDate(weekInfo.weekStart)} - ${this.formatDate(weekInfo.weekEnd)}`;
      data.push([weekTitle]);
      
      // Заголовки столбцов
      const headerRow: Array<string | number> = ['Employee', ...dayNames];
      data.push(headerRow);
      
      // Строка с датами
      const datesRow: Array<string | number> = [''];
      orderedDays.forEach(dayNum => {
        const dayDate = TimetableWeekCalculator.getDateForDayInWeek(weekInfo.weekStart, dayNum);
        datesRow.push(this.formatDate(dayDate));
      });
      data.push(datesRow);
      
      // Данные сотрудников
      staffRows.forEach(staffRow => {
        // Строка с именем сотрудника
        const staffNameRow: Array<string | number> = [staffRow.staffName];
        
        // Добавляем данные по дням
        orderedDays.forEach(dayNum => {
          const dayData = staffRow.weekData.days[dayNum];
          const cellContent = this.formatDayCell(dayData);
          staffNameRow.push(cellContent);
        });
        
        data.push(staffNameRow);
        
        // Строка с итогами недели
        const weekTotalRow: Array<string | number> = [staffRow.weekData.formattedWeekTotal.trim()];
        // Пустые ячейки для дней
        for (let i = 0; i < orderedDays.length; i++) {
          weekTotalRow.push('');
        }
        data.push(weekTotalRow);
      });
      
      // Пустая строка между неделями (кроме последней)
      if (weekIndex < weeksData.length - 1) {
        data.push([]);
      }
    });
    
    return data;
  }

  /**
   * Форматирует содержимое ячейки дня
   */
  private static formatDayCell(dayData: IDayInfo): string {
    if (!dayData || !dayData.hasData || dayData.shifts.length === 0) {
      return '';
    }
    
    if (dayData.shifts.length === 1) {
      // Одна смена
      const shift = dayData.shifts[0];
      const startTime = this.formatTime(shift.startTime);
      const endTime = this.formatTime(shift.endTime);
      const duration = this.formatDuration(shift.workMinutes);
      return `${startTime} - ${endTime} (${duration})`;
    } else {
      // Несколько смен
      const shiftLines = dayData.shifts.map(shift => {
        const startTime = this.formatTime(shift.startTime);
        const endTime = this.formatTime(shift.endTime);
        const duration = this.formatDuration(shift.workMinutes);
        return `${startTime} - ${endTime} (${duration})`;
      });
      
      return shiftLines.join('\n');
    }
  }

  /**
   * Применяет форматирование к worksheet
   */
  private static applyWorksheetFormatting(
    // FIXED: Changed 'any' to specific XLSX WorkSheet type
    worksheet: import('xlsx').WorkSheet, 
    weeksData: IWeekGroup[], 
    dayOfStartWeek: number,
    // FIXED: Changed 'any' to specific XLSX module type
    XLSXLib: typeof import('xlsx')
  ): void {
    // Устанавливаем ширину столбцов
    const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);
    const colCount = orderedDays.length + 1; // +1 для столбца Employee
    
    const colWidths = [];
    colWidths.push({ width: 20 }); // Столбец Employee
    for (let i = 0; i < orderedDays.length; i++) {
      colWidths.push({ width: 25 }); // Столбцы дней
    }
    
    worksheet['!cols'] = colWidths;
    
    // Применяем объединение ячеек для заголовков недель
    const merges: Array<import('xlsx').Range> = [];
    let currentRow = 0;
    
    // Заголовок документа
    merges.push({
      s: { r: currentRow, c: 0 },
      e: { r: currentRow, c: colCount - 1 }
    });
    currentRow += 2; // +2 за заголовок и пустую строку
    
    // Заголовки недель
    weeksData.forEach((weekGroup, weekIndex) => {
      // Объединяем ячейки для заголовка недели
      merges.push({
        s: { r: currentRow, c: 0 },
        e: { r: currentRow, c: colCount - 1 }
      });
      
      currentRow++; // Заголовок недели
      currentRow++; // Заголовки столбцов
      currentRow++; // Строка с датами
      
      // Пропускаем строки сотрудников (имя + итоги для каждого)
      currentRow += weekGroup.staffRows.length * 2;
      
      // Пустая строка между неделями (кроме последней)
      if (weekIndex < weeksData.length - 1) {
        currentRow++;
      }
    });
    
    worksheet['!merges'] = merges;
    
    // Устанавливаем стили для ячеек
    this.applyCellStyles(worksheet, weeksData, dayOfStartWeek, XLSXLib);
  }

  /**
   * Применяет стили к ячейкам
   */
  private static applyCellStyles(
    // FIXED: Changed 'any' to specific XLSX WorkSheet type
    worksheet: import('xlsx').WorkSheet, 
    weeksData: IWeekGroup[], 
    dayOfStartWeek: number,
    // FIXED: Changed 'any' to specific XLSX module type
    XLSXLib: typeof import('xlsx')
  ): void {
    const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);
    let currentRow = 0;
    
    // Стиль для заголовка документа
    const titleCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c: 0 })];
    if (titleCell) {
      titleCell.s = {
        font: { bold: true, sz: 14 },
        alignment: { horizontal: 'center' }
      };
    }
    
    currentRow += 2; // Пропускаем заголовок и пустую строку
    
    // Стили для каждой недели
    weeksData.forEach((weekGroup, weekIndex) => {
      // Стиль для заголовка недели
      const weekHeaderCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c: 0 })];
      if (weekHeaderCell) {
        weekHeaderCell.s = {
          font: { bold: true },
          fill: { fgColor: { rgb: 'E6E6E6' } },
          alignment: { horizontal: 'center' }
        };
      }
      currentRow++;
      
      // Стили для заголовков столбцов
      for (let c = 0; c <= orderedDays.length; c++) {
        const headerCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c })];
        if (headerCell) {
          headerCell.s = {
            font: { bold: true },
            fill: { fgColor: { rgb: 'F0F0F0' } },
            alignment: { horizontal: 'center' }
          };
        }
      }
      currentRow++;
      
      // Стили для строки с датами
      for (let c = 0; c <= orderedDays.length; c++) {
        const dateCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c })];
        if (dateCell) {
          dateCell.s = {
            fill: { fgColor: { rgb: 'F8F8F8' } },
            alignment: { horizontal: 'center' }
          };
        }
      }
      currentRow++;
      
      // Стили для данных сотрудников
      weekGroup.staffRows.forEach(staffRow => {
        // Стиль для имени сотрудника
        const nameCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c: 0 })];
        if (nameCell) {
          nameCell.s = {
            font: { bold: true },
            alignment: { vertical: 'center' }
          };
        }
        
        // Стили для ячеек с данными дней
        orderedDays.forEach((dayNum, dayIndex) => {
          const dayCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c: dayIndex + 1 })];
          if (dayCell) {
            dayCell.s = {
              alignment: { 
                vertical: 'center',
                wrapText: true 
              },
              border: {
                top: { style: 'thin' },
                bottom: { style: 'thin' },
                left: { style: 'thin' },
                right: { style: 'thin' }
              }
            };
          }
        });
        
        currentRow++; // Строка с именем сотрудника
        
        // Стиль для строки с итогами
        const totalCell = worksheet[XLSXLib.utils.encode_cell({ r: currentRow, c: 0 })];
        if (totalCell) {
          totalCell.s = {
            font: { italic: true },
            alignment: { horizontal: 'right' }
          };
        }
        
        currentRow++; // Строка с итогами
      });
      
      // Пустая строка между неделями
      if (weekIndex < weeksData.length - 1) {
        currentRow++;
      }
    });
  }

  /**
   * Форматирует дату в формат dd/mm
   */
  private static formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month}`;
  }

  /**
   * Форматирует время в формат HH:mm
   */
  private static formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  /**
   * Форматирует продолжительность в часы
   */
  private static formatDuration(minutes: number): string {
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
   * Генерирует имя файла
   */
  private static generateFileName(groupName: string, weeksData: IWeekGroup[]): string {
    if (weeksData.length === 0) {
      return `Timetable_${groupName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
    }
    
    const firstWeek = weeksData[0];
    const lastWeek = weeksData[weeksData.length - 1];
    
    const startDate = firstWeek.weekInfo.weekStart;
    const endDate = lastWeek.weekInfo.weekEnd;
    
    const startStr = this.formatDate(startDate).replace('/', '-');
    const endStr = this.formatDate(endDate).replace('/', '-');
    
    const cleanGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `Timetable_${cleanGroupName}_${startStr}_to_${endStr}.xlsx`;
  }

  /**
   * Получает статистику экспорта
   */
  public static getExportStatistics(weeksData: IWeekGroup[]): {
    totalWeeks: number;
    totalStaff: number;
    totalRecords: number;
    dateRange: string;
  } {
    const totalWeeks = weeksData.length;
    const totalStaff = weeksData.length > 0 ? weeksData[0].staffRows.length : 0;
    
    let totalRecords = 0;
    weeksData.forEach(weekGroup => {
      weekGroup.staffRows.forEach(staffRow => {
        Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
          totalRecords += day.shifts.length;
        });
      });
    });
    
    let dateRange = '';
    if (weeksData.length > 0) {
      const firstWeek = weeksData[0];
      const lastWeek = weeksData[weeksData.length - 1];
      dateRange = `${this.formatDate(firstWeek.weekInfo.weekStart)} - ${this.formatDate(lastWeek.weekInfo.weekEnd)}`;
    }
    
    return {
      totalWeeks,
      totalStaff,
      totalRecords,
      dateRange
    };
  }
}