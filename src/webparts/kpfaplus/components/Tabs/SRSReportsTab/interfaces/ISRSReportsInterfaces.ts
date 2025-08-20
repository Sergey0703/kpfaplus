// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/interfaces/ISRSReportsInterfaces.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IStaffMember } from '../../../../models/types';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';

/**
 * Enum для ключей месяцев в правильном порядке
 */
export enum MonthKeys {
  Jan = 'jan',
  Feb = 'feb',
  Mar = 'mar',
  Apr = 'apr',
  May = 'may',
  Jun = 'jun',
  Jul = 'jul',
  Aug = 'aug',
  Sep = 'sep',
  Oct = 'oct',
  Nov = 'nov',
  Dec = 'dec'
}

/**
 * Массив месяцев в правильном порядке для итерации
 */
export const MONTH_ORDER: MonthKeys[] = [
  MonthKeys.Jan,
  MonthKeys.Feb,
  MonthKeys.Mar,
  MonthKeys.Apr,
  MonthKeys.May,
  MonthKeys.Jun,
  MonthKeys.Jul,
  MonthKeys.Aug,
  MonthKeys.Sep,
  MonthKeys.Oct,
  MonthKeys.Nov,
  MonthKeys.Dec
];

/**
 * Маппинг месяцев на их номера (0-11)
 */
export const MONTH_TO_NUMBER: Record<MonthKeys, number> = {
  [MonthKeys.Jan]: 0,
  [MonthKeys.Feb]: 1,
  [MonthKeys.Mar]: 2,
  [MonthKeys.Apr]: 3,
  [MonthKeys.May]: 4,
  [MonthKeys.Jun]: 5,
  [MonthKeys.Jul]: 6,
  [MonthKeys.Aug]: 7,
  [MonthKeys.Sep]: 8,
  [MonthKeys.Oct]: 9,
  [MonthKeys.Nov]: 10,
  [MonthKeys.Dec]: 11
};

/**
 * Маппинг номеров месяцев на ключи
 */
export const NUMBER_TO_MONTH: Record<number, MonthKeys> = {
  0: MonthKeys.Jan,
  1: MonthKeys.Feb,
  2: MonthKeys.Mar,
  3: MonthKeys.Apr,
  4: MonthKeys.May,
  5: MonthKeys.Jun,
  6: MonthKeys.Jul,
  7: MonthKeys.Aug,
  8: MonthKeys.Sep,
  9: MonthKeys.Oct,
  10: MonthKeys.Nov,
  11: MonthKeys.Dec
};

/**
 * Интерфейс для отдельной записи отпуска (детализация)
 */
export interface ISRSLeaveRecord {
  /** Уникальный ID записи */
  id: string;
  /** Дата записи отпуска */
  date: Date;
  /** Количество часов отпуска в этой записи */
  hours: number;
  /** Ключ месяца (jan, feb, etc.) */
  monthKey: MonthKeys;
  /** Номер месяца (0-11) */
  monthNumber: number;
  /** ID типа отпуска */
  typeOfLeaveId: string;
  /** Название типа отпуска */
  typeOfLeaveName: string;
  /** Цвет типа отпуска для отображения */
  typeOfLeaveColor?: string;
  /** Оригинальная запись StaffRecord */
  originalRecord: IStaffRecord;
}

/**
 * Интерфейс для месячных данных по отпускам
 */
export interface IMonthlyLeaveData {
  /** Часы отпуска в январе */
  jan: number;
  /** Часы отпуска в феврале */
  feb: number;
  /** Часы отпуска в марте */
  mar: number;
  /** Часы отпуска в апреле */
  apr: number;
  /** Часы отпуска в мае */
  may: number;
  /** Часы отпуска в июне */
  jun: number;
  /** Часы отпуска в июле */
  jul: number;
  /** Часы отпуска в августе */
  aug: number;
  /** Часы отпуска в сентябре */
  sep: number;
  /** Часы отпуска в октябре */
  oct: number;
  /** Часы отпуска в ноябре */
  nov: number;
  /** Часы отпуска в декабре */
  dec: number;
}

/**
 * Интерфейс для данных SRS Reports по контракту
 */
export interface ISRSReportData {
  /** Уникальный ID для строки (staffId_contractId) */
  id: string;
  /** ID сотрудника */
  staffId: string;
  /** Имя сотрудника */
  staffName: string;
  /** ID контракта */
  contractId: string;
  /** Название контракта */
  contractName: string;
  /** Количество часов по контракту */
  contractedHours: number;
  /** Остаток отпуска с предыдущего периода */
  annualLeaveFromPrevious: number;
  /** Месячные данные по отпускам (суммы) */
  monthlyLeaveHours: IMonthlyLeaveData;
  /** Общее количество использованных часов отпуска */
  totalUsedHours: number;
  /** Остаток часов отпуска */
  balanceRemainingInHrs: number;
  /** Детализированные записи отпусков */
  leaveRecords: ISRSLeaveRecord[];
  /** Количество записей отпусков */
  recordsCount: number;
}

/**
 * Интерфейс для расширяемой строки таблицы
 */
export interface IExpandableRow {
  /** Уникальный ID строки */
  id: string;
  /** Флаг развернутости строки */
  isExpanded: boolean;
  /** Данные для summary строки (свернутый вид) */
  summaryData: ISRSReportData;
  /** Строки детализации (развернутый вид) */
  detailRows: ISRSLeaveRecord[];
  /** Тип строки для отображения */
  rowType: 'summary' | 'detail';
}

/**
 * Интерфейс для строки таблицы SRS Reports (объединяет summary и detail)
 */
export interface ISRSTableRow {
  /** Уникальный ID строки */
  id: string;
  /** ID сотрудника */
  staffId: string;
  /** Имя сотрудника */
  staffName: string;
  /** Название контракта */
  contract: string;
  /** Количество часов по контракту */
  contractedHours: number;
  /** Остаток отпуска с предыдущего периода */
  annualLeaveFromPrevious: number;
  /** Дата (пустая для summary, заполнена для detail) */
  dateColumn: string;
  /** Месячные данные */
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  /** Остаток часов отпуска */
  balanceRemainingInHrs: number;
  /** Тип строки */
  rowType: 'summary' | 'detail';
  /** Родительский ID (для detail строк) */
  parentId?: string;
  /** Флаг развернутости (только для summary строк) */
  isExpanded?: boolean;
  /** Данные для expand/collapse */
  expandData?: {
    detailRows: ISRSLeaveRecord[];
    isExpanded: boolean;
  };
}

/**
 * Интерфейс для параметров группировки данных
 */
export interface ISRSGroupingParams {
  /** Записи StaffRecord с типом отпуска */
  staffRecords: IStaffRecord[];
  /** Начало периода */
  periodStart: Date;
  /** Конец периода */
  periodEnd: Date;
  /** Фильтр по типу отпуска (опционально) */
  typeOfLeaveFilter?: string;
  /** Список типов отпусков для маппинга названий */
  typesOfLeave: ITypeOfLeave[];
}

/**
 * Интерфейс для результата группировки данных
 */
export interface ISRSGroupingResult {
  /** Сгруппированные данные по контрактам */
  reportData: ISRSReportData[];
  /** Общая статистика */
  statistics: {
    /** Количество сотрудников */
    totalStaff: number;
    /** Количество контрактов */
    totalContracts: number;
    /** Количество записей отпусков */
    totalLeaveRecords: number;
    /** Общее количество часов отпуска */
    totalLeaveHours: number;
    /** Статистика по месяцам */
    monthlyStats: IMonthlyLeaveData;
  };
  /** Ошибки группировки (если есть) */
  errors?: string[];
}

/**
 * Интерфейс для props компонента SRS Reports Table
 */
export interface ISRSReportsTableProps {
  /** Записи расписания с типом отпуска */
  staffRecords: IStaffRecord[];
  /** Список сотрудников */
  staffMembers: IStaffMember[];
  /** Начало выбранного периода */
  selectedPeriodStart: Date;
  /** Конец выбранного периода */
  selectedPeriodEnd: Date;
  /** Фильтр по типу отпуска */
  selectedTypeFilter: string;
  /** Список типов отпусков */
  typesOfLeave: ITypeOfLeave[];
  /** Флаг загрузки */
  isLoading: boolean;
  /** Callback при обновлении данных */
  onDataUpdate?: (data: ISRSReportData[]) => void;
  /** Callback при export в Excel */
  onExportToExcel?: (data: ISRSTableRow[]) => void;
}

/**
 * Интерфейс для props компонента расширяемой таблицы
 */
export interface IExpandableLeaveTableProps {
  /** Данные для отображения */
  reportData: ISRSReportData[];
  /** Флаг загрузки */
  isLoading: boolean;
  /** Callback при изменении состояния expand/collapse */
  onExpandToggle?: (rowId: string, isExpanded: boolean) => void;
  /** Callback при клике на строку */
  onRowClick?: (row: ISRSTableRow) => void;
}

/**
 * Утилитарные функции для работы с месяцами
 */
export class MonthUtils {
  /**
   * Получает ключ месяца по дате
   */
  static getMonthKey(date: Date): MonthKeys {
    return NUMBER_TO_MONTH[date.getMonth()];
  }

  /**
   * Получает номер месяца по ключу
   */
  static getMonthNumber(monthKey: MonthKeys): number {
    return MONTH_TO_NUMBER[monthKey];
  }

  /**
   * Создает пустой объект месячных данных
   */
  static createEmptyMonthlyData(): IMonthlyLeaveData {
    return {
      jan: 0,
      feb: 0,
      mar: 0,
      apr: 0,
      may: 0,
      jun: 0,
      jul: 0,
      aug: 0,
      sep: 0,
      oct: 0,
      nov: 0,
      dec: 0
    };
  }

  /**
   * Добавляет часы к месячным данным
   */
  static addHoursToMonth(
    monthlyData: IMonthlyLeaveData,
    monthKey: MonthKeys,
    hours: number
  ): void {
    monthlyData[monthKey] += hours;
  }

  /**
   * Получает общее количество часов из месячных данных
   */
  static getTotalHours(monthlyData: IMonthlyLeaveData): number {
    return MONTH_ORDER.reduce((total, monthKey) => total + monthlyData[monthKey], 0);
  }

  /**
   * Форматирует дату для отображения в таблице
   */
  static formatDateForTable(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * REMOVED: isDateInPeriod was unreliable due to timezone issues.
   * Please use the new `DateUtils.isDateInRange()` from `utils/DateUtils.ts` for all
   * date range checks to ensure timezone-safe, normalized comparisons.
   */
  // static isDateInPeriod(date: Date, periodStart: Date, periodEnd: Date): boolean {
  //   return date >= periodStart && date <= periodEnd;
  // }
}