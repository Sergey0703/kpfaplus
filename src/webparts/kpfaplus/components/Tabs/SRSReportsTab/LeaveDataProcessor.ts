// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/LeaveDataProcessor.ts

import { IStaffRecord } from '../../../services/StaffRecordsService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import {
  ISRSGroupingParams,
  ISRSGroupingResult,
  ISRSReportData,
  ISRSLeaveRecord,
  IMonthlyLeaveData,
  MonthUtils,
  MONTH_ORDER
} from './interfaces/ISRSReportsInterfaces';

// NEW: Import the reliable DateUtils for timezone-safe date comparison
import { DateUtils } from './utils/DateUtils';

/**
 * Сервис для группировки и обработки данных StaffRecords для SRS Reports
 * Преобразует записи отпусков в структурированные данные по месяцам
 * ОБНОВЛЕНО: Использует поле LeaveTime вместо вычислений
 * ОБНОВЛЕНО: Использует DateUtils.isDateInRange для надежного сравнения дат
 */
export class LeaveDataProcessor {
  private _logSource: string = "LeaveDataProcessor";

  /**
   * Основной метод обработки записей StaffRecords
   * Группирует данные по сотрудникам, контрактам и месяцам
   * 
   * @param params Параметры группировки
   * @returns Результат группировки с данными и статистикой
   */
  public processStaffRecords(params: ISRSGroupingParams): ISRSGroupingResult {
    try {
      this.logInfo('[DEBUG] processStaffRecords НАЧИНАЕТСЯ');
      this.logInfo(`[DEBUG] Параметры: ${JSON.stringify({
        recordsCount: params.staffRecords.length,
        periodStart: params.periodStart.toISOString(),
        periodEnd: params.periodEnd.toISOString(),
        typeFilter: params.typeOfLeaveFilter || 'All',
        typesOfLeaveCount: params.typesOfLeave.length
      })}`);

      // Валидация входных данных
      const validationErrors = this.validateParams(params);
      if (validationErrors.length > 0) {
        this.logError(`[ОШИБКА] Валидация параметров: ${validationErrors.join(', ')}`);
        return {
          reportData: [],
          statistics: this.createEmptyStatistics(),
          errors: validationErrors
        };
      }

      // Фильтрация записей по периоду и типу отпуска
      const filteredRecords = this.filterRecords(params);
      this.logInfo(`[DEBUG] После фильтрации: ${filteredRecords.length} записей`);

      if (filteredRecords.length === 0) {
        this.logInfo('[DEBUG] Нет записей после фильтрации');
        return {
          reportData: [],
          statistics: this.createEmptyStatistics(),
          errors: ['No records found for the selected period and filters']
        };
      }

      // Группировка записей по сотрудникам
      const staffGroups = this.groupRecordsByStaff(filteredRecords);
      this.logInfo(`[DEBUG] Группировка по сотрудникам: ${staffGroups.size} сотрудников`);

      // Обработка каждой группы сотрудников
      const reportData: ISRSReportData[] = [];
      let totalLeaveRecords = 0;
      let totalLeaveHours = 0;
      const monthlyStats = MonthUtils.createEmptyMonthlyData();

      staffGroups.forEach((staffRecords, staffId) => {
        // Группировка записей сотрудника по контрактам
        const contractGroups = this.groupRecordsByContract(staffRecords);
        this.logInfo(`[DEBUG] Сотрудник ${staffId}: ${contractGroups.size} контрактов`);

        // Обработка каждого контракта
        contractGroups.forEach((contractRecords, contractKey) => {
          const contractData = this.createSRSReportData(
            staffId,
            contractKey,
            contractRecords,
            params.typesOfLeave
          );

          if (contractData) {
            reportData.push(contractData);
            totalLeaveRecords += contractData.recordsCount;
            totalLeaveHours += contractData.totalUsedHours;

            // Добавляем к общей статистике по месяцам
            this.addToMonthlyStats(monthlyStats, contractData.monthlyLeaveHours);
          }
        });
      });

      // Создание финальной статистики
      const statistics = {
        totalStaff: staffGroups.size,
        totalContracts: reportData.length,
        totalLeaveRecords,
        totalLeaveHours,
        monthlyStats
      };

      this.logInfo(`[DEBUG] Обработка завершена: ${reportData.length} записей отчета`);
      this.logInfo(`[DEBUG] Статистика: ${JSON.stringify(statistics)}`);

      return {
        reportData,
        statistics,
        errors: []
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[КРИТИЧЕСКАЯ ОШИБКА] processStaffRecords: ${errorMessage}`);
      console.error(`[${this._logSource}] Подробности ошибки:`, error);

      return {
        reportData: [],
        statistics: this.createEmptyStatistics(),
        errors: [`Processing failed: ${errorMessage}`]
      };
    }
  }

  /**
   * Валидация входных параметров
   */
  private validateParams(params: ISRSGroupingParams): string[] {
    const errors: string[] = [];

    if (!params.staffRecords || params.staffRecords.length === 0) {
      errors.push('Staff records array is empty or undefined');
    }

    if (!params.periodStart || !params.periodEnd) {
      errors.push('Period start and end dates are required');
    }

    if (params.periodStart && params.periodEnd && params.periodStart > params.periodEnd) {
      errors.push('Period start date cannot be after end date');
    }

    if (!params.typesOfLeave || params.typesOfLeave.length === 0) {
      errors.push('Types of leave array is required');
    }

    return errors;
  }

  /**
   * Фильтрация записей по периоду и типу отпуска
   */
  private filterRecords(params: ISRSGroupingParams): IStaffRecord[] {
    return params.staffRecords.filter(record => {
      // Проверка периода
      if (!record.Date) {
        this.logInfo(`[DEBUG] Пропуск записи без даты: ID ${record.ID}`);
        return false;
      }

      const recordDate = new Date(record.Date);
      
      // UPDATED: Use the new reliable, timezone-safe utility for date comparison.
      if (!DateUtils.isDateInRange(recordDate, params.periodStart, params.periodEnd)) {
        return false;
      }

      // Проверка типа отпуска (если указан фильтр)
      if (params.typeOfLeaveFilter && params.typeOfLeaveFilter !== '') {
        if (record.TypeOfLeaveID !== params.typeOfLeaveFilter) {
          return false;
        }
      }

      // УПРОЩЕНО: Проверка наличия часов отпуска из поля LeaveTime
      if (!record.LeaveTime || record.LeaveTime <= 0) {
        this.logInfo(`[DEBUG] Пропуск записи без часов отпуска: ID ${record.ID}, LeaveTime: ${record.LeaveTime}`);
        return false;
      }

      return true;
    });
  }

  /**
   * Группировка записей по сотрудникам
   */
  private groupRecordsByStaff(records: IStaffRecord[]): Map<string, IStaffRecord[]> {
    const groups = new Map<string, IStaffRecord[]>();

    records.forEach(record => {
      // Используем правильное поле ID для сотрудника
      const staffId = record.StaffMemberLookupId || record.ID || 'unknown';
      
      if (!groups.has(staffId)) {
        groups.set(staffId, []);
      }
      
      groups.get(staffId)!.push(record);
    });

    return groups;
  }

  /**
   * Группировка записей по контрактам
   */
  private groupRecordsByContract(records: IStaffRecord[]): Map<string, IStaffRecord[]> {
    const groups = new Map<string, IStaffRecord[]>();

    records.forEach(record => {
      // Используем информацию о контракте из записи или создаем ключ "No Contract"
      const contractKey = this.getContractKey(record);
      
      if (!groups.has(contractKey)) {
        groups.set(contractKey, []);
      }
      
      groups.get(contractKey)!.push(record);
    });

    return groups;
  }

  /**
   * Получение ключа контракта из записи
   */
  private getContractKey(record: IStaffRecord): string {
    // Пытаемся извлечь информацию о контракте
    // Возможны варианты: WeeklyTimeTable, Contract поле, или создаем по умолчанию
    
    if (record.WeeklyTimeTableID && record.WeeklyTimeTable?.Title) {
      return `${record.WeeklyTimeTableID}_${record.WeeklyTimeTable.Title}`;
    }
    
    if (record.WeeklyTimeTableID) {
      return `contract_${record.WeeklyTimeTableID}`;
    }
    
    // Если нет информации о контракте
    return 'no_contract';
  }

  /**
   * Создание данных SRS Report для одного контракта
   */
  private createSRSReportData(
    staffId: string,
    contractKey: string,
    contractRecords: IStaffRecord[],
    typesOfLeave: ITypeOfLeave[]
  ): ISRSReportData | null {
    try {
      // Получаем имя сотрудника из первой записи
      const firstRecord = contractRecords[0];
      const staffName = this.getStaffName(firstRecord, staffId);

      // Определяем информацию о контракте
      const contractInfo = this.extractContractInfo(contractKey, firstRecord);

      // Создаем записи отпусков
      const leaveRecords: ISRSLeaveRecord[] = [];
      const monthlyHours = MonthUtils.createEmptyMonthlyData();

      contractRecords.forEach(record => {
        const leaveRecord = this.createLeaveRecord(record, typesOfLeave);
        if (leaveRecord) {
          leaveRecords.push(leaveRecord);
          // Добавляем часы к соответствующему месяцу
          MonthUtils.addHoursToMonth(monthlyHours, leaveRecord.monthKey, leaveRecord.hours);
        }
      });

      if (leaveRecords.length === 0) {
        this.logInfo(`[DEBUG] Нет валидных записей отпуска для контракта ${contractKey}`);
        return null;
      }

      // Рассчитываем суммы и балансы
      const totalUsedHours = MonthUtils.getTotalHours(monthlyHours);
      const annualLeaveFromPrevious = this.calculateAnnualLeaveFromPrevious(contractInfo.contractedHours);
      const balanceRemainingInHrs = annualLeaveFromPrevious - totalUsedHours;

      const reportData: ISRSReportData = {
        id: `${staffId}_${contractInfo.contractId}`,
        staffId,
        staffName,
        contractId: contractInfo.contractId,
        contractName: contractInfo.contractName,
        contractedHours: contractInfo.contractedHours,
        annualLeaveFromPrevious,
        monthlyLeaveHours: monthlyHours,
        totalUsedHours,
        balanceRemainingInHrs,
        leaveRecords,
        recordsCount: leaveRecords.length
      };

      this.logInfo(`[DEBUG] Создан отчет для ${staffName} - ${contractInfo.contractName}: ${totalUsedHours} часов`);
      return reportData;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] createSRSReportData для ${staffId}-${contractKey}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Получение имени сотрудника из записи
   */
  private getStaffName(record: IStaffRecord, staffId: string): string {
    // Пытаемся извлечь имя из различных полей
    if (record.Title && typeof record.Title === 'string') {
      return record.Title;
    }
    
    // Если есть информация о lookup поле сотрудника, используем ее
    // В зависимости от структуры данных это может быть в разных полях
    
    // Возвращаем ID как fallback
    return `Staff ${staffId}`;
  }

  /**
   * Извлечение информации о контракте
   */
  private extractContractInfo(contractKey: string, record: IStaffRecord): {
    contractId: string;
    contractName: string;
    contractedHours: number;
  } {
    if (contractKey === 'no_contract') {
      return {
        contractId: 'no_contract',
        contractName: 'No Contract',
        contractedHours: 0
      };
    }

    // Извлекаем информацию из WeeklyTimeTable
    const contractId = record.WeeklyTimeTableID || contractKey;
    const contractName = record.WeeklyTimeTable?.Title || `Contract ${contractId}`;
    
    // Пытаемся получить количество часов контракта
    // Это может быть в разных полях в зависимости от структуры данных
    let contractedHours = 0;
    
    if (record.Contract && typeof record.Contract === 'number') {
      contractedHours = record.Contract;
    } else {
      // Устанавливаем значение по умолчанию или рассчитываем
      contractedHours = 40; // Стандартная рабочая неделя
    }

    return {
      contractId,
      contractName,
      contractedHours
    };
  }

  /**
   * Создание записи отпуска из StaffRecord
   * УПРОЩЕНО: Использует поле LeaveTime вместо вычислений
   */
  private createLeaveRecord(
    record: IStaffRecord,
    typesOfLeave: ITypeOfLeave[]
  ): ISRSLeaveRecord | null {
    try {
      if (!record.Date) {
        return null;
      }

      // УПРОЩЕНО: Используем готовое поле LeaveTime
      const hours = record.LeaveTime;
      
      if (hours <= 0) {
        this.logInfo(`[DEBUG] Пропуск записи с нулевыми часами отпуска: ID ${record.ID}, LeaveTime: ${hours}`);
        return null;
      }

      const date = new Date(record.Date);
      const monthKey = MonthUtils.getMonthKey(date);
      const monthNumber = MonthUtils.getMonthNumber(monthKey);

      // Находим тип отпуска
      const typeOfLeave = typesOfLeave.find(type => type.id === record.TypeOfLeaveID);
      const typeOfLeaveName = typeOfLeave?.title || 'Unknown Leave Type';
      const typeOfLeaveColor = typeOfLeave?.color;

      const leaveRecord: ISRSLeaveRecord = {
        id: record.ID,
        date,
        hours,
        monthKey,
        monthNumber,
        typeOfLeaveId: record.TypeOfLeaveID || '',
        typeOfLeaveName,
        typeOfLeaveColor,
        originalRecord: record
      };

      this.logInfo(`[DEBUG] Создана запись отпуска: ID ${record.ID}, LeaveTime: ${hours} часов, Месяц: ${monthKey}`);
      return leaveRecord;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logError(`[ОШИБКА] createLeaveRecord для записи ${record.ID}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * УДАЛЕН СЛОЖНЫЙ МЕТОД calculateWorkingHours()
   * Теперь используется простое поле LeaveTime из записи
   */

  /**
   * УДАЛЕН МЕТОД parseWorkTimeString()
   * Больше не нужен, так как LeaveTime уже число
   */

  /**
   * Расчет остатка отпуска с предыдущего периода
   * В реальной системе это должно браться из базы данных
   */
  private calculateAnnualLeaveFromPrevious(contractedHours: number): number {
    // Временная логика - в реальной системе это должно быть в БД
    // Примерный расчет: 4 недели отпуска в год для полной занятости
    const weeklyHours = contractedHours || 40;
    const annualLeaveHours = weeklyHours * 4; // 4 недели отпуска
    
    // Добавляем небольшую случайность для демонстрации
    const variation = Math.floor(Math.random() * 20) - 10; // ±10 часов
    return Math.max(0, annualLeaveHours + variation);
  }

  /**
   * Добавление данных к месячной статистике
   */
  private addToMonthlyStats(target: IMonthlyLeaveData, source: IMonthlyLeaveData): void {
    MONTH_ORDER.forEach(monthKey => {
      target[monthKey] += source[monthKey];
    });
  }

  /**
   * Создание пустой статистики
   */
  private createEmptyStatistics(): {
    totalStaff: number;
    totalContracts: number;
    totalLeaveRecords: number;
    totalLeaveHours: number;
    monthlyStats: IMonthlyLeaveData;
  } {
    return {
      totalStaff: 0,
      totalContracts: 0,
      totalLeaveRecords: 0,
      totalLeaveHours: 0,
      monthlyStats: MonthUtils.createEmptyMonthlyData()
    };
  }

  /**
   * Логирование информационных сообщений
   */
  private logInfo(message: string): void {
    console.log(`[${this._logSource}] ${message}`);
  }

  /**
   * Логирование сообщений об ошибках
   */
  private logError(message: string): void {
    console.error(`[${this._logSource}] ${message}`);
  }
}