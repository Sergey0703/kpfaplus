// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/utils/SRSReportsExcelExporter.ts

import * as ExcelJS from 'exceljs';
import { IStaffMember } from '../../../../models/types';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import {
  ISRSReportData,
  MONTH_ORDER
} from '../interfaces/ISRSReportsInterfaces';

/**
 * Интерфейс для параметров экспорта SRS Reports
 */
export interface ISRSExportParams {
  /** Данные отчета для экспорта */
  reportData: ISRSReportData[];
  /** Список всех сотрудников */
  staffMembers: IStaffMember[];
  /** Начало периода */
  periodStart: Date;
  /** Конец периода */
  periodEnd: Date;
  /** Выбранный тип отпуска */
  selectedTypeFilter: string;
  /** Список типов отпусков */
  typesOfLeave: ITypeOfLeave[];
  /** ID группы */
  managingGroupId: string;
  /** Название группы/департамента */
  groupName?: string;
}

/**
 * Экспортер SRS Reports в Excel
 * Создает детализированный отчет по использованию отпусков сотрудниками
 */
export class SRSReportsExcelExporter {

  /**
   * Основной метод экспорта SRS Reports в Excel
   */
  public static async exportToExcel(params: ISRSExportParams): Promise<void> {
    try {
      console.log('[SRSReportsExcelExporter] Starting Excel export with params:', {
        reportDataCount: params.reportData.length,
        periodStart: params.periodStart.toLocaleDateString(),
        periodEnd: params.periodEnd.toLocaleDateString(),
        selectedTypeFilter: params.selectedTypeFilter,
        managingGroupId: params.managingGroupId
      });

      const workbook = new ExcelJS.Workbook();
      
      // Настройка метаданных
      workbook.creator = 'KPFA Plus';
      workbook.created = new Date();
      workbook.lastModifiedBy = 'KPFA Plus SRS Reports';
      workbook.modified = new Date();

      // Создаем основной лист
      const worksheet = workbook.addWorksheet('SRS Reports');
      
      // Настройка колонок
      this.setupWorksheetColumns(worksheet);
      
      // Добавляем заголовок и информацию о периоде
      const currentRow = this.addReportHeader(worksheet, params);
      
      // Добавляем таблицу данных
      this.addDataTable(worksheet, params, currentRow);
      
      // Применяем стили
      this.applyWorksheetStyles(worksheet);
      
      // Генерируем и скачиваем файл
      const fileName = this.generateFileName(params);
      await this.downloadWorkbook(workbook, fileName);
      
      console.log('[SRSReportsExcelExporter] Excel export completed successfully:', fileName);
      
    } catch (error) {
      console.error('[SRSReportsExcelExporter] Excel export failed:', error);
      throw new Error(`Excel export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Настройка колонок worksheet
   */
  private static setupWorksheetColumns(worksheet: ExcelJS.Worksheet): void {
    worksheet.columns = [
      { key: 'staffName', width: 25, header: 'STAFF NAME' },
      { key: 'contract', width: 20, header: 'Contract' },
      { key: 'contractedHours', width: 15, header: 'Contracted Hours' },
      { key: 'annualLeave', width: 15, header: 'Previous Leave' },
      { key: 'jan', width: 12, header: 'Jan' },
      { key: 'feb', width: 12, header: 'Feb' },
      { key: 'mar', width: 12, header: 'Mar' },
      { key: 'apr', width: 12, header: 'Apr' },
      { key: 'may', width: 12, header: 'May' },
      { key: 'jun', width: 12, header: 'Jun' },
      { key: 'jul', width: 12, header: 'Jul' },
      { key: 'aug', width: 12, header: 'Aug' },
      { key: 'sep', width: 12, header: 'Sep' },
      { key: 'oct', width: 12, header: 'Oct' },
      { key: 'nov', width: 12, header: 'Nov' },
      { key: 'dec', width: 12, header: 'Dec' },
      { key: 'balance', width: 15, header: 'Balance' }
    ];
  }

  /**
   * Добавляет заголовок отчета
   */
  private static addReportHeader(
    worksheet: ExcelJS.Worksheet, 
    params: ISRSExportParams
  ): number {
    // Главный заголовок - строка 1
    const mainTitle = worksheet.getCell(1, 1);
    mainTitle.value = 'SRS Reports - Leave Usage Summary';
    mainTitle.style = {
      font: { bold: true, size: 16, color: { argb: 'FF000000' } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    };
    worksheet.mergeCells(1, 1, 1, 17); // Объединяем по всем колонкам (17 вместо 18)

    // Информация о периоде и фильтрах - строка 3
    const periodInfo = worksheet.getCell(3, 1);
    const selectedType = params.typesOfLeave.find(t => t.id === params.selectedTypeFilter);
    const typeFilterText = selectedType ? selectedType.title : `Type ID: ${params.selectedTypeFilter}`;
    
    periodInfo.value = `Period: ${this.formatDate(params.periodStart)} - ${this.formatDate(params.periodEnd)} | Leave Type: ${typeFilterText}`;
    
    periodInfo.style = {
      font: { size: 12, color: { argb: 'FF000000' }, bold: true }, // Жирный черный шрифт
      alignment: { horizontal: 'center', vertical: 'middle' }
    };
    worksheet.mergeCells(3, 1, 3, 17); // Объединяем по всем колонкам (17 вместо 18)

    return 5; // Возвращаем строку 5 для начала таблицы данных
  }

  /**
   * Добавляет таблицу данных
   */
  private static addDataTable(
    worksheet: ExcelJS.Worksheet, 
    params: ISRSExportParams, 
    startRow: number
  ): void {
    let currentRow = startRow;

    // Заголовки таблицы
    const headers = [
      'STAFF NAME', 'Contract', 'Contracted Hours', 'Previous Leave',
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
      'Balance'
    ];

    headers.forEach((header, index) => {
      const cell = worksheet.getCell(currentRow, index + 1);
      cell.value = header;
      cell.style = {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0078D4' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        }
      };
    });
    currentRow++;

    // Данные
    if (params.reportData.length === 0) {
      // Нет данных
      const noDataCell = worksheet.getCell(currentRow, 1);
      noDataCell.value = 'No data available for the selected criteria';
      noDataCell.style = {
        font: { italic: true, color: { argb: 'FF666666' } },
        alignment: { horizontal: 'center', vertical: 'middle' }
      };
      worksheet.mergeCells(currentRow, 1, currentRow, 17);
    } else {
      // Добавляем строки данных
      params.reportData.forEach((reportItem) => {
        const row = worksheet.getRow(currentRow);
        
        // Заполняем данные
        row.getCell(1).value = reportItem.staffName;
        row.getCell(2).value = reportItem.contractName;
        row.getCell(3).value = reportItem.contractedHours;
        row.getCell(4).value = 0; // ИСПРАВЛЕНО: Всегда 0 вместо изменяющихся значений
        
        // Месячные данные
        MONTH_ORDER.forEach((monthKey, index) => {
          const monthValue = reportItem.monthlyLeaveHours[monthKey];
          row.getCell(5 + index).value = monthValue > 0 ? monthValue : '';
        });
        
        row.getCell(17).value = reportItem.balanceRemainingInHrs;
        
        // Стили для строк данных
        for (let col = 1; col <= 17; col++) {
          const cell = row.getCell(col);
          cell.style = {
            alignment: { horizontal: col === 1 || col === 2 ? 'left' : 'center', vertical: 'middle' },
            border: {
              top: { style: 'thin', color: { argb: 'FFE1E5E9' } },
              bottom: { style: 'thin', color: { argb: 'FFE1E5E9' } },
              left: { style: 'thin', color: { argb: 'FFE1E5E9' } },
              right: { style: 'thin', color: { argb: 'FFE1E5E9' } }
            }
          };
          
          // Специальные стили для определенных колонок
          if (col === 17) { // Balance (теперь колонка 17 вместо 18)
            const balance = reportItem.balanceRemainingInHrs;
            if (balance < 0) {
              cell.style.font = { color: { argb: 'FFD83B01' }, bold: true }; // Красный для отрицательного баланса
            } else if (balance > 0) {
              cell.style.font = { color: { argb: 'FF107C10' }, bold: true }; // Зеленый для положительного
            }
          }
          
          // Выделяем месяцы с данными
          if (col >= 5 && col <= 16) {
            const monthIndex = col - 5;
            const monthKey = MONTH_ORDER[monthIndex];
            const monthValue = reportItem.monthlyLeaveHours[monthKey];
            if (monthValue > 0) {
              cell.style.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F8FF' } };
              cell.style.font = { bold: true };
            }
          }
        }
        
        currentRow++;
      });
    }
  }

  /**
   * Применяет общие стили к worksheet
   */
  private static applyWorksheetStyles(worksheet: ExcelJS.Worksheet): void {
    // Заморозка первой строки заголовков
    worksheet.views = [
      { state: 'frozen', ySplit: 5 } // Замораживаем первые 5 строк (заголовок + информация + заголовки таблицы)
    ];

    // Автоподбор высоты строк
    worksheet.eachRow((row) => {
      row.height = 20;
    });

    // Первая строка выше
    if (worksheet.getRow(1)) {
      worksheet.getRow(1).height = 25;
    }
  }

  /**
   * Генерирует имя файла для экспорта
   */
  private static generateFileName(params: ISRSExportParams): string {
    const startDate = this.formatDateForFileName(params.periodStart);
    const endDate = this.formatDateForFileName(params.periodEnd);
    const selectedType = params.typesOfLeave.find(t => t.id === params.selectedTypeFilter);
    const typeStr = selectedType ? selectedType.title.replace(/[^a-zA-Z0-9]/g, '_') : 'AllTypes';
    const groupStr = params.managingGroupId.replace(/[^a-zA-Z0-9]/g, '_');
    
    return `SRS_Reports_${groupStr}_${typeStr}_${startDate}_to_${endDate}.xlsx`;
  }

  /**
   * Скачивает workbook как файл
   */
  private static async downloadWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<void> {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Форматирует дату для отображения
   */
  private static formatDate(date: Date): string {
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  /**
   * Форматирует дату для имени файла
   */
  private static formatDateForFileName(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
}