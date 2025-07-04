// src/webparts/kpfaplus/services/CommonFillAnalysis.ts
// ANALYSIS AND STATISTICS: All analysis logic for fill operations
// COMPLETE IMPLEMENTATION: Detailed analysis tracking with Date-only support

import { IContract } from '../models/IContract';
import { 
  IContractsAnalysis,
  ITemplatesAnalysis, 
  IGenerationAnalysis,
  IDayGenerationInfo,
  IScheduleTemplate,
  IDetailedAnalysisResult,
  AnalysisLevel,
  WeekChainingPattern,
  FILL_CONSTANTS
} from './CommonFillTypes';
import { CommonFillDateUtils } from './CommonFillDateUtils';

export class CommonFillAnalysis {
  private dateUtils: CommonFillDateUtils;
  
  // Analysis state storage
  private contractsAnalysis?: IContractsAnalysis;
  private templatesAnalysis?: ITemplatesAnalysis;
  private generationAnalysis?: IGenerationAnalysis;

  constructor(dateUtils: CommonFillDateUtils) {
    this.dateUtils = dateUtils;
    console.log('[CommonFillAnalysis] Analysis service initialized with Date-only format support');
  }

  // *** PUBLIC API METHODS ***

  /**
   * Получает полный детальный анализ всего процесса заполнения
   */
  public getDetailedAnalysis(): IDetailedAnalysisResult {
    return {
      contracts: this.contractsAnalysis,
      templates: this.templatesAnalysis,
      generation: this.generationAnalysis
    };
  }

  /**
   * Очищает весь накопленный анализ
   */
  public clearAnalysis(): void {
    console.log('[CommonFillAnalysis] Clearing all analysis data');
    this.contractsAnalysis = undefined;
    this.templatesAnalysis = undefined;
    this.generationAnalysis = undefined;
  }

  /**
   * Проверяет наличие данных анализа
   */
  public hasAnalysisData(): boolean {
    return !!(this.contractsAnalysis || this.templatesAnalysis || this.generationAnalysis);
  }

  // *** CONTRACT ANALYSIS ***

  /**
   * Анализирует контракты для детального логирования
   */
  public analyzeContracts(
    allContracts: IContract[], 
    activeContracts: IContract[], 
    selectedContract: IContract,
    selectedDate: Date
  ): IContractsAnalysis {
    console.log('[CommonFillAnalysis] Performing detailed contracts analysis...');

    let selectionReason = '';
    if (activeContracts.length === 1) {
      selectionReason = 'Only one active contract found for the period';
    } else if (activeContracts.length > 1) {
      selectionReason = `Selected first of ${activeContracts.length} active contracts`;
    } else {
      selectionReason = 'No active contracts found (using fallback)';
    }

    this.contractsAnalysis = {
      totalFound: allContracts.length,
      activeInPeriod: activeContracts,
      selectedContract: selectedContract,
      selectionReason: selectionReason
    };

    console.log('[CommonFillAnalysis] Contracts analysis completed:', {
      total: this.contractsAnalysis.totalFound,
      active: this.contractsAnalysis.activeInPeriod.length,
      selected: this.contractsAnalysis.selectedContract.id,
      reason: this.contractsAnalysis.selectionReason,
      period: this.dateUtils.formatDateOnlyForDisplay(selectedDate)
    });

    return this.contractsAnalysis;
  }

  /**
   * Получает анализ контрактов
   */
  public getContractsAnalysis(): IContractsAnalysis | undefined {
    return this.contractsAnalysis;
  }

  // *** TEMPLATE ANALYSIS ***

  /**
   * Инициализирует пустой анализ шаблонов
   */
  public initializeEmptyTemplatesAnalysis(
    contractId: string, 
    contractName: string,
    dayOfStartWeek: number,
    filteringDetails: string[]
  ): ITemplatesAnalysis {
    this.templatesAnalysis = {
      contractId: contractId,
      contractName: contractName || 'No contract found',
      totalItemsFromServer: 0,
      afterManagerFilter: 0,
      afterDeletedFilter: 0,
      finalTemplatesCount: 0,
      weeksInSchedule: [],
      shiftsAvailable: [],
      numberOfWeekTemplates: 0,
      dayOfStartWeek: dayOfStartWeek,
      weekStartDayName: this.dateUtils.getDayName(dayOfStartWeek),
      templatesByWeekAndDay: new Map(),
      filteringDetails: filteringDetails
    };

    console.log('[CommonFillAnalysis] Initialized empty templates analysis:', {
      contractId,
      contractName,
      dayOfStartWeek,
      weekStartDayName: this.templatesAnalysis.weekStartDayName
    });

    return this.templatesAnalysis;
  }

  /**
   * Детальный анализ шаблонов
   */
  public analyzeTemplates(
    contractId: string,
    contractName: string,
    totalFromServer: number,
    afterManagerFilter: number,
    afterDeletedFilter: number,
    finalTemplatesCount: number,
    dayOfStartWeek: number,
    scheduleTemplates: IScheduleTemplate[],
    groupedTemplates: Map<string, IScheduleTemplate[]>,
    filteringDetails: string[]
  ): ITemplatesAnalysis {
    console.log('[CommonFillAnalysis] Performing detailed templates analysis...');

    // Анализ недель и смен в расписании
    const weeksSet = new Set<number>();
    const shiftsSet = new Set<number>();

    scheduleTemplates.forEach(template => {
      weeksSet.add(template.NumberOfWeek);
      shiftsSet.add(template.NumberOfShift);
    });

    const weeksInSchedule = Array.from(weeksSet).sort();
    const shiftsAvailable = Array.from(shiftsSet).sort();
    const numberOfWeekTemplates = weeksInSchedule.length;

    // Финальные детали фильтрации
    const updatedFilteringDetails = [...filteringDetails];
    updatedFilteringDetails.push(`STEP 4: Schedule Tab Formatting Completed`);
    updatedFilteringDetails.push(`Final schedule templates: ${finalTemplatesCount}`);
    updatedFilteringDetails.push(`Weeks in schedule: [${weeksInSchedule.join(', ')}]`);
    updatedFilteringDetails.push(`Shifts available: [${shiftsAvailable.join(', ')}]`);
    updatedFilteringDetails.push(`Number of week templates: ${numberOfWeekTemplates}`);
    updatedFilteringDetails.push(`Week chaining logic: ${this.dateUtils.getWeekChainingDescription(numberOfWeekTemplates)}`);
    updatedFilteringDetails.push('');

    this.templatesAnalysis = {
      contractId: contractId,
      contractName: contractName,
      totalItemsFromServer: totalFromServer,
      afterManagerFilter: afterManagerFilter,
      afterDeletedFilter: afterDeletedFilter,
      finalTemplatesCount: finalTemplatesCount,
      weeksInSchedule: weeksInSchedule,
      shiftsAvailable: shiftsAvailable,
      numberOfWeekTemplates: numberOfWeekTemplates,
      dayOfStartWeek: dayOfStartWeek,
      weekStartDayName: this.dateUtils.getDayName(dayOfStartWeek),
      templatesByWeekAndDay: groupedTemplates,
      filteringDetails: updatedFilteringDetails
    };

    console.log('[CommonFillAnalysis] Templates analysis completed:', {
      contract: this.templatesAnalysis.contractName,
      totalFromServer: this.templatesAnalysis.totalItemsFromServer,
      afterManagerFilter: this.templatesAnalysis.afterManagerFilter,
      afterDeletedFilter: this.templatesAnalysis.afterDeletedFilter,
      finalTemplates: this.templatesAnalysis.finalTemplatesCount,
      weeks: this.templatesAnalysis.weeksInSchedule,
      shifts: this.templatesAnalysis.shiftsAvailable,
      weekStart: this.templatesAnalysis.weekStartDayName,
      chainingPattern: this.dateUtils.getWeekChainingDescription(numberOfWeekTemplates)
    });

    return this.templatesAnalysis;
  }

  /**
   * Получает анализ шаблонов
   */
  public getTemplatesAnalysis(): ITemplatesAnalysis | undefined {
    return this.templatesAnalysis;
  }

  /**
   * Получает статистику по шаблонам для быстрого доступа
   */
  public getTemplatesStats(): {
    totalTemplates: number;
    weeksCount: number;
    shiftsCount: number;
    chainingPattern: WeekChainingPattern;
    weekStartDay: string;
  } {
    if (!this.templatesAnalysis) {
      return {
        totalTemplates: 0,
        weeksCount: 0,
        shiftsCount: 0,
        chainingPattern: WeekChainingPattern.SINGLE,
        weekStartDay: 'Unknown'
      };
    }

    return {
      totalTemplates: this.templatesAnalysis.finalTemplatesCount,
      weeksCount: this.templatesAnalysis.numberOfWeekTemplates,
      shiftsCount: this.templatesAnalysis.shiftsAvailable.length,
      chainingPattern: this.dateUtils.getWeekChainingPattern(this.templatesAnalysis.numberOfWeekTemplates),
      weekStartDay: this.templatesAnalysis.weekStartDayName
    };
  }

  // *** GENERATION ANALYSIS ***

  /**
   * Инициализирует анализ генерации
   */
  public initializeGenerationAnalysis(firstDay: Date, lastDay: Date): IGenerationAnalysis {
    const totalDays = Math.ceil((lastDay.getTime() - firstDay.getTime()) / FILL_CONSTANTS.TIMEZONE.MILLISECONDS_PER_DAY) + 1;
    
    this.generationAnalysis = {
      totalDaysInPeriod: totalDays,
      daysGenerated: 0,
      daysSkipped: 0,
      holidaysDetected: 0,
      leavesDetected: 0,
      dailyInfo: [],
      weeklyStats: new Map()
    };

    console.log(`[CommonFillAnalysis] Initialized generation analysis for ${totalDays} days:`, {
      period: `${this.dateUtils.formatDateOnlyForDisplay(firstDay)} - ${this.dateUtils.formatDateOnlyForDisplay(lastDay)}`,
      totalDays
    });

    return this.generationAnalysis;
  }

  /**
   * Обновляет статистику генерации
   */
  public updateGenerationStats(weekNumber: number, generated: boolean): void {
    if (!this.generationAnalysis) {
      console.warn('[CommonFillAnalysis] Cannot update generation stats - analysis not initialized');
      return;
    }

    if (!this.generationAnalysis.weeklyStats.has(weekNumber)) {
      this.generationAnalysis.weeklyStats.set(weekNumber, { total: 0, generated: 0, skipped: 0 });
    }

    const weekStats = this.generationAnalysis.weeklyStats.get(weekNumber);
    if (weekStats) {
      weekStats.total++;
      if (generated) {
        weekStats.generated++;
        this.generationAnalysis.daysGenerated++;
      } else {
        weekStats.skipped++;
        this.generationAnalysis.daysSkipped++;
      }
    }

    console.log(`[CommonFillAnalysis] Updated week ${weekNumber} stats: generated=${generated}, total stats: ${this.generationAnalysis.daysGenerated}/${this.generationAnalysis.totalDaysInPeriod}`);
  }

  /**
   * Добавляет информацию о дне в анализ
   */
  public addDayInfo(dayInfo: IDayGenerationInfo): void {
    if (!this.generationAnalysis) {
      console.warn('[CommonFillAnalysis] Cannot add day info - analysis not initialized');
      return;
    }

    this.generationAnalysis.dailyInfo.push(dayInfo);
    
    console.log(`[CommonFillAnalysis] Added day info: ${dayInfo.date} (${dayInfo.dayName}), template: ${dayInfo.templateFound}, holiday: ${dayInfo.isHoliday}, leave: ${dayInfo.isLeave}`);
  }

  /**
   * Завершает анализ генерации
   */
  public finalizeGenerationAnalysis(recordsGenerated: number, holidaysCount: number, leavesCount: number): IGenerationAnalysis {
    if (!this.generationAnalysis) {
      console.warn('[CommonFillAnalysis] Cannot finalize generation analysis - not initialized');
      return this.initializeGenerationAnalysis(new Date(), new Date());
    }

    this.generationAnalysis.holidaysDetected = holidaysCount;
    this.generationAnalysis.leavesDetected = leavesCount;
    
    console.log('[CommonFillAnalysis] Generation analysis completed:', {
      totalDays: this.generationAnalysis.totalDaysInPeriod,
      generated: this.generationAnalysis.daysGenerated,
      skipped: this.generationAnalysis.daysSkipped,
      holidays: this.generationAnalysis.holidaysDetected,
      leaves: this.generationAnalysis.leavesDetected,
      recordsCreated: recordsGenerated
    });

    return this.generationAnalysis;
  }

  /**
   * Получает анализ генерации
   */
  public getGenerationAnalysis(): IGenerationAnalysis | undefined {
    return this.generationAnalysis;
  }

  /**
   * Получает краткую статистику генерации
   */
  public getGenerationSummary(): {
    totalDays: number;
    processedDays: number;
    skippedDays: number;
    holidaysCount: number;
    leavesCount: number;
    successRate: number;
  } {
    if (!this.generationAnalysis) {
      return {
        totalDays: 0,
        processedDays: 0,
        skippedDays: 0,
        holidaysCount: 0,
        leavesCount: 0,
        successRate: 0
      };
    }

    const successRate = this.generationAnalysis.totalDaysInPeriod > 0 
      ? (this.generationAnalysis.daysGenerated / this.generationAnalysis.totalDaysInPeriod) * 100 
      : 0;

    return {
      totalDays: this.generationAnalysis.totalDaysInPeriod,
      processedDays: this.generationAnalysis.daysGenerated,
      skippedDays: this.generationAnalysis.daysSkipped,
      holidaysCount: this.generationAnalysis.holidaysDetected,
      leavesCount: this.generationAnalysis.leavesDetected,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  // *** WEEKLY STATISTICS ***

  /**
   * Получает статистику по неделям
   */
  public getWeeklyStats(): Map<number, { total: number; generated: number; skipped: number; rate: number }> {
    if (!this.generationAnalysis) {
      return new Map();
    }

    const enhancedStats = new Map();
    
    this.generationAnalysis.weeklyStats.forEach((stats, weekNumber) => {
      const rate = stats.total > 0 ? (stats.generated / stats.total) * 100 : 0;
      enhancedStats.set(weekNumber, {
        ...stats,
        rate: Math.round(rate * 100) / 100
      });
    });

    return enhancedStats;
  }

  /**
   * Получает детальную информацию по дням
   */
  public getDailyDetails(analysisLevel: AnalysisLevel = AnalysisLevel.BASIC): IDayGenerationInfo[] {
    if (!this.generationAnalysis) {
      return [];
    }

    const dailyInfo = this.generationAnalysis.dailyInfo;

    switch (analysisLevel) {
      case AnalysisLevel.BASIC:
        return dailyInfo.filter(day => day.templateFound || day.isHoliday || day.isLeave);
        
      case AnalysisLevel.DETAILED:
        return dailyInfo;
        
      case AnalysisLevel.DEBUG:
        return dailyInfo.map(day => ({
          ...day,
          debugInfo: {
            templateUsed: day.templateUsed,
            skipReason: day.skipReason,
            workingHours: day.workingHours,
            lunchMinutes: day.lunchMinutes
          }
        }));
        
      default:
        return dailyInfo;
    }
  }

  // *** ANALYSIS REPORTING ***

  /**
   * Генерирует текстовый отчет анализа
   */
  public generateAnalysisReport(level: AnalysisLevel = AnalysisLevel.DETAILED): string {
    const lines: string[] = [];
    
    lines.push('=== COMMON FILL GENERATION ANALYSIS REPORT ===');
    lines.push('');

    // Contracts Analysis
    if (this.contractsAnalysis) {
      lines.push('--- CONTRACTS ANALYSIS ---');
      lines.push(`Total contracts found: ${this.contractsAnalysis.totalFound}`);
      lines.push(`Active in period: ${this.contractsAnalysis.activeInPeriod.length}`);
      lines.push(`Selected contract: ${this.contractsAnalysis.selectedContract.id} - ${this.contractsAnalysis.selectedContract.template || 'No name'}`);
      lines.push(`Selection reason: ${this.contractsAnalysis.selectionReason}`);
      lines.push('');
    }

    // Templates Analysis
    if (this.templatesAnalysis) {
      lines.push('--- TEMPLATES ANALYSIS ---');
      lines.push(`Contract: ${this.templatesAnalysis.contractName} (${this.templatesAnalysis.contractId})`);
      lines.push(`Server response: ${this.templatesAnalysis.totalItemsFromServer} items`);
      lines.push(`After manager filter: ${this.templatesAnalysis.afterManagerFilter} items`);
      lines.push(`After deleted filter: ${this.templatesAnalysis.afterDeletedFilter} items`);
      lines.push(`Final templates: ${this.templatesAnalysis.finalTemplatesCount}`);
      lines.push(`Weeks in schedule: [${this.templatesAnalysis.weeksInSchedule.join(', ')}]`);
      lines.push(`Shifts available: [${this.templatesAnalysis.shiftsAvailable.join(', ')}]`);
      lines.push(`Week chaining: ${this.dateUtils.getWeekChainingDescription(this.templatesAnalysis.numberOfWeekTemplates)}`);
      lines.push(`Week start day: ${this.templatesAnalysis.weekStartDayName}`);
      lines.push('');

      if (level === AnalysisLevel.DEBUG && this.templatesAnalysis.filteringDetails.length > 0) {
        lines.push('--- FILTERING DETAILS ---');
        this.templatesAnalysis.filteringDetails.forEach(detail => lines.push(detail));
        lines.push('');
      }
    }

    // Generation Analysis
    if (this.generationAnalysis) {
      lines.push('--- GENERATION ANALYSIS ---');
      lines.push(`Total days in period: ${this.generationAnalysis.totalDaysInPeriod}`);
      lines.push(`Days generated: ${this.generationAnalysis.daysGenerated}`);
      lines.push(`Days skipped: ${this.generationAnalysis.daysSkipped}`);
      lines.push(`Holidays detected: ${this.generationAnalysis.holidaysDetected}`);
      lines.push(`Leaves detected: ${this.generationAnalysis.leavesDetected}`);
      
      const summary = this.getGenerationSummary();
      lines.push(`Success rate: ${summary.successRate}%`);
      lines.push('');

      // Weekly breakdown
      const weeklyStats = this.getWeeklyStats();
      if (weeklyStats.size > 0) {
        lines.push('--- WEEKLY BREAKDOWN ---');
        weeklyStats.forEach((stats, week) => {
          lines.push(`Week ${week}: ${stats.generated}/${stats.total} generated (${stats.rate}%), ${stats.skipped} skipped`);
        });
        lines.push('');
      }

      // Daily details for debug level
      if (level === AnalysisLevel.DEBUG) {
        lines.push('--- DAILY DETAILS ---');
        this.generationAnalysis.dailyInfo.forEach(day => {
          let status = day.templateFound ? 'Generated' : 'Skipped';
          if (day.isHoliday) status += ' (Holiday)';
          if (day.isLeave) status += ` (Leave: ${day.leaveType})`;
          
          lines.push(`${day.date} ${day.dayName}: ${status}`);
          if (day.skipReason) lines.push(`  Reason: ${day.skipReason}`);
          if (day.workingHours) lines.push(`  Hours: ${day.workingHours}`);
        });
      }
    }

    lines.push('=== END OF REPORT ===');
    
    return lines.join('\n');
  }

  /**
   * Экспортирует анализ в JSON формат
   */
  public exportAnalysisToJSON(): string {
    const analysisData = {
      timestamp: new Date().toISOString(),
      contracts: this.contractsAnalysis,
      templates: this.templatesAnalysis ? {
        ...this.templatesAnalysis,
        templatesByWeekAndDay: this.templatesAnalysis.templatesByWeekAndDay ? 
          this.mapToObject(this.templatesAnalysis.templatesByWeekAndDay) : {}
      } : undefined,
      generation: this.generationAnalysis ? {
        ...this.generationAnalysis,
        weeklyStats: this.generationAnalysis.weeklyStats ? 
          this.mapToObject(this.generationAnalysis.weeklyStats) : {}
      } : undefined
    };

    return JSON.stringify(analysisData, null, 2);
  }

  /**
   * Конвертирует Map в обычный объект (для совместимости с ES2017)
   */
  private mapToObject<K extends string | number | symbol, V>(map: Map<K, V>): Record<K, V> {
    const obj = {} as Record<K, V>;
    map.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  // *** VALIDATION AND DIAGNOSTICS ***

  /**
   * Валидирует целостность данных анализа
   */
  public validateAnalysisIntegrity(): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Проверка анализа контрактов
    if (this.contractsAnalysis) {
      if (this.contractsAnalysis.totalFound < this.contractsAnalysis.activeInPeriod.length) {
        issues.push('Active contracts count exceeds total contracts count');
      }
      if (!this.contractsAnalysis.selectedContract.id) {
        issues.push('Selected contract has no ID');
      }
    }

    // Проверка анализа шаблонов
    if (this.templatesAnalysis) {
      if (this.templatesAnalysis.finalTemplatesCount !== this.templatesAnalysis.afterDeletedFilter) {
        warnings.push('Final templates count differs from filtered count');
      }
      if (this.templatesAnalysis.numberOfWeekTemplates === 0 && this.templatesAnalysis.finalTemplatesCount > 0) {
        issues.push('No week templates found despite having final templates');
      }
    }

    // Проверка анализа генерации
    if (this.generationAnalysis) {
      const totalProcessed = this.generationAnalysis.daysGenerated + this.generationAnalysis.daysSkipped;
      if (totalProcessed !== this.generationAnalysis.totalDaysInPeriod) {
        issues.push(`Processed days (${totalProcessed}) doesn't match total days (${this.generationAnalysis.totalDaysInPeriod})`);
      }
      if (this.generationAnalysis.dailyInfo.length !== this.generationAnalysis.totalDaysInPeriod) {
        warnings.push('Daily info count differs from total days');
      }
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Получает диагностическую информацию
   */
  public getDiagnostics(): {
    memoryUsage: string;
    analysisSize: string;
    performanceMetrics: {
      contractsAnalyzed: boolean;
      templatesAnalyzed: boolean;
      generationAnalyzed: boolean;
    };
  } {
    const analysisJSON = this.exportAnalysisToJSON();
    const memoryUsage = `${Math.round(analysisJSON.length / 1024)} KB`;
    
    return {
      memoryUsage,
      analysisSize: `${analysisJSON.length} characters`,
      performanceMetrics: {
        contractsAnalyzed: !!this.contractsAnalysis,
        templatesAnalyzed: !!this.templatesAnalysis,
        generationAnalyzed: !!this.generationAnalysis
      }
    };
  }
}