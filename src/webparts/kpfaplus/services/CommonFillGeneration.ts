// src/webparts/kpfaplus/services/CommonFillGeneration.ts
// MAIN COORDINATOR: Refactored with separated components for better maintainability
// COMPLETE IMPLEMENTATION: Enhanced Auto-Fill with timer, spinner, and execution time tracking
// FIXED: TypeScript lint error - replaced any with proper types

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffRecord, StaffRecordsService } from './StaffRecordsService';
import { HolidaysService, IHoliday } from './HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from './DaysOfLeavesService';
import { WeeklyTimeTableService } from './WeeklyTimeTableService';
import { RemoteSiteService } from './RemoteSiteService';
import { IContract } from '../models/IContract';
import { 
  IFillParams,
  IScheduleTemplate,
  IDetailedAnalysisResult,
  IGenerationResult,
  ISaveResult,
  AnalysisLevel
} from './CommonFillTypes';
import { CommonFillDateUtils } from './CommonFillDateUtils';
import { CommonFillAnalysis } from './CommonFillAnalysis';
import { CommonFillTemplates } from './CommonFillTemplates';
import { CommonFillRecords } from './CommonFillRecords';

export class CommonFillGeneration {
  // *** CORE SERVICES ***
  private staffRecordsService: StaffRecordsService;
  private holidaysService: HolidaysService;
  private daysOfLeavesService: DaysOfLeavesService;
  private weeklyTimeTableService: WeeklyTimeTableService;
  private remoteSiteService: RemoteSiteService;

  // *** COMPONENT PROCESSORS ***
  private dateUtils: CommonFillDateUtils;
  private analysis: CommonFillAnalysis;
  private templates: CommonFillTemplates;
  private records: CommonFillRecords;

  constructor(context: WebPartContext) {
    console.log('[CommonFillGeneration] Main coordinator initializing with refactored architecture...');
    
    // *** INITIALIZE CORE SERVICES ***
    this.staffRecordsService = StaffRecordsService.getInstance(context);
    this.holidaysService = HolidaysService.getInstance(context);
    this.daysOfLeavesService = DaysOfLeavesService.getInstance(context);
    this.weeklyTimeTableService = new WeeklyTimeTableService(context);
    this.remoteSiteService = RemoteSiteService.getInstance(context);
    
    // *** INITIALIZE COMPONENT PROCESSORS ***
    this.dateUtils = new CommonFillDateUtils(this.remoteSiteService);
    this.analysis = new CommonFillAnalysis(this.dateUtils);
    this.templates = new CommonFillTemplates(this.weeklyTimeTableService, this.analysis, this.dateUtils);
    this.records = new CommonFillRecords(
      this.staffRecordsService,
      this.holidaysService, 
      this.daysOfLeavesService,
      this.dateUtils,
      this.analysis,
      this.templates
    );
    
    console.log('[CommonFillGeneration] *** REFACTORED ARCHITECTURE INITIALIZED ***');
    console.log('[CommonFillGeneration] - DateUtils: ✓ Date/time calculations and timezone handling');
    console.log('[CommonFillGeneration] - Analysis: ✓ Detailed analysis and statistics tracking');
    console.log('[CommonFillGeneration] - Templates: ✓ Schedule Tab compatible template processing');
    console.log('[CommonFillGeneration] - Records: ✓ Numeric time fields with Date-only support');
    console.log('[CommonFillGeneration] Service initialized with Date-only format support for Holidays and DaysOfLeaves');
  }

  // *** PUBLIC API - MAINTAINS BACKWARD COMPATIBILITY ***

  /**
   * Получает детальный анализ всего процесса заполнения
   */
  public getDetailedAnalysis(): IDetailedAnalysisResult {
    console.log('[CommonFillGeneration] Retrieving detailed analysis from Analysis component');
    return this.analysis.getDetailedAnalysis();
  }

  /**
   * Анализирует контракты для детального логирования
   */
  public analyzeContracts(
    allContracts: IContract[], 
    activeContracts: IContract[], 
    selectedContract: IContract,
    selectedDate: Date
  ): void {
    console.log('[CommonFillGeneration] Delegating contract analysis to Analysis component');
    this.analysis.analyzeContracts(allContracts, activeContracts, selectedContract, selectedDate);
  }

  /**
   * UPDATED: Загружает праздники для месяца с поддержкой Date-only формата
   */
  public async loadHolidays(date: Date): Promise<IHoliday[]> {
    console.log('[CommonFillGeneration] Delegating holiday loading to Records component with Date-only support');
    return this.records.loadHolidays(date);
  }

  /**
   * UPDATED: Загружает отпуска сотрудника с поддержкой Date-only формата
   */
  public async loadLeaves(params: IFillParams): Promise<ILeaveDay[]> {
    console.log('[CommonFillGeneration] Delegating leave loading to Records component with Date-only support');
    return this.records.loadLeaves(params);
  }

  /**
   * UPDATED: Загружает шаблоны с Schedule Tab форматированием
   */
  public async loadWeeklyTemplates(
    contractId: string, 
    dayOfStartWeek: number,
    currentUserId: string,
    managingGroupId: string
  ): Promise<IScheduleTemplate[]> {
    console.log('[CommonFillGeneration] Delegating template loading to Templates component with Schedule Tab formatting');
    
    try {
      const templates = await this.templates.loadWeeklyTemplates(
        contractId,
        dayOfStartWeek,
        currentUserId,
        managingGroupId
      );

      console.log(`[CommonFillGeneration] Templates component returned ${templates.length} processed templates`);
      return templates;
      
    } catch (error) {
      console.error('[CommonFillGeneration] Error in template loading delegation:', error);
      this.analysis.initializeEmptyTemplatesAnalysis(contractId, '', dayOfStartWeek, [`ERROR: ${error}`]);
      return [];
    }
  }

  /**
   * UPDATED: Генерирует записи с правильной логикой чередования недель и числовыми полями времени
   * UPDATED: Теперь использует Date-only обработку для праздников и отпусков
   */
  public async generateScheduleRecords(
    params: IFillParams,
    contract: IContract,
    holidays: IHoliday[],
    leaves: ILeaveDay[],
    weeklyTemplates: IScheduleTemplate[]
  ): Promise<Partial<IStaffRecord>[]> {
    console.log('[CommonFillGeneration] Delegating record generation to Records component with Date-only support and numeric time fields');

    try {
      const generationResult: IGenerationResult = await this.records.generateScheduleRecords(
        params,
        contract,
        holidays,
        leaves,
        weeklyTemplates
      );

      console.log(`[CommonFillGeneration] Records component generated ${generationResult.totalGenerated} records`);
      console.log('[CommonFillGeneration] Generation analysis updated with detailed statistics');

      return generationResult.records;
      
    } catch (error) {
      console.error('[CommonFillGeneration] Error in record generation delegation:', error);
      throw error;
    }
  }

  /**
   * UPDATED: Сохраняет сгенерированные записи в SharePoint с числовыми полями
   */
  public async saveGeneratedRecords(records: Partial<IStaffRecord>[], params: IFillParams): Promise<number> {
    console.log('[CommonFillGeneration] Delegating record saving to Records component with numeric time fields and Date-only support');

    try {
      const saveResult: ISaveResult = await this.records.saveGeneratedRecords(records, params);

      console.log(`[CommonFillGeneration] Records component saved ${saveResult.successCount}/${saveResult.totalRecords} records`);
      
      if (saveResult.errors.length > 0) {
        console.error(`[CommonFillGeneration] Save delegation completed with ${saveResult.errors.length} errors:`, saveResult.errors);
      }

      return saveResult.successCount;
      
    } catch (error) {
      console.error('[CommonFillGeneration] Error in record saving delegation:', error);
      throw error;
    }
  }

  // *** ENHANCED API - NEW METHODS USING COMPONENTS ***

  /**
   * Группирует шаблоны для быстрого доступа
   */
  public groupTemplatesByWeekAndDay(templates: IScheduleTemplate[]): Map<string, IScheduleTemplate[]> {
    console.log('[CommonFillGeneration] Delegating template grouping to Templates component');
    return this.templates.groupTemplatesByWeekAndDay(templates);
  }

  /**
   * Находит шаблоны для конкретной недели и дня
   */
  public findTemplatesForDay(
    groupedTemplates: Map<string, IScheduleTemplate[]>, 
    templateWeekNumber: number, 
    dayNumber: number
  ): IScheduleTemplate[] {
    console.log('[CommonFillGeneration] Delegating template search to Templates component');
    return this.templates.findTemplatesForDay(groupedTemplates, templateWeekNumber, dayNumber);
  }

  /**
   * Создает кэш праздников для быстрого поиска с Date-only поддержкой
   */
  public createHolidayCacheWithDateOnly(holidays: IHoliday[]): Map<string, IHoliday> {
    console.log('[CommonFillGeneration] Delegating holiday cache creation to DateUtils component');
    return this.dateUtils.createHolidayCacheWithDateOnly(holidays);
  }

  /**
   * Создает массив периодов отпусков для быстрой проверки с Date-only поддержкой
   */
  public createLeavePeriodsWithDateOnly(leaves: ILeaveDay[]): Array<{startDate: Date, endDate: Date, typeOfLeave: string, title: string}> {
    console.log('[CommonFillGeneration] Delegating leave periods creation to DateUtils component');
    return this.dateUtils.createLeavePeriodsWithDateOnly(leaves);
  }

  /**
   * Вычисляет номер недели и день с учетом логики чередования
   */
  public calculateWeekAndDayWithChaining(
    date: Date, 
    startOfMonth: Date, 
    dayOfStartWeek: number, 
    numberOfWeekTemplates: number
  ): { calendarWeekNumber: number; templateWeekNumber: number; dayNumber: number } {
    console.log('[CommonFillGeneration] Delegating week/day calculation to DateUtils component');
    return this.dateUtils.calculateWeekAndDayWithChaining(date, startOfMonth, dayOfStartWeek, numberOfWeekTemplates);
  }

  /**
   * Форматирует Date-only дату для отображения пользователю
   */
  public formatDateOnlyForDisplay(date?: Date): string {
    return this.dateUtils.formatDateOnlyForDisplay(date);
  }

  /**
   * Получает время с timezone adjustment в числовом формате
   */
  public async getAdjustedNumericTime(time?: { hours: string; minutes: string }): Promise<{ hours: number; minutes: number }> {
    console.log('[CommonFillGeneration] Delegating time adjustment to DateUtils component');
    return this.dateUtils.getAdjustedNumericTime(time);
  }

  /**
   * Получает описание логики чередования недель
   */
  public getWeekChainingDescription(numberOfWeekTemplates: number): string {
    return this.dateUtils.getWeekChainingDescription(numberOfWeekTemplates);
  }

  // *** VALIDATION AND DIAGNOSTICS METHODS ***

  /**
   * Валидирует параметры заполнения
   */
  public validateFillParams(params: IFillParams): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    console.log('[CommonFillGeneration] Delegating fill params validation to Records component');
    return this.records.validateFillParams(params);
  }

  /**
   * Валидирует шаблон расписания
   */
  public validateScheduleTemplate(template: IScheduleTemplate): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    console.log('[CommonFillGeneration] Delegating template validation to Templates component');
    return this.templates.validateScheduleTemplate(template);
  }

  /**
   * Валидирует группу шаблонов
   * FIXED: Proper interface type instead of any
   */
  public validateTemplateGroup(templates: IScheduleTemplate[]): {
    isValid: boolean;
    issues: string[];
    statistics: {
      totalTemplates: number;
      uniqueWeeks: number;
      uniqueShifts: number;
      uniqueDays: number;
      validTemplates: number;
      invalidTemplates: number;
    };
  } {
    console.log('[CommonFillGeneration] Delegating template group validation to Templates component');
    return this.templates.validateTemplateGroup(templates);
  }

  /**
   * Валидирует сгенерированные записи
   */
  public validateGeneratedRecords(records: Partial<IStaffRecord>[]): {
    isValid: boolean;
    issues: string[];
    validRecords: number;
    invalidRecords: number;
  } {
    console.log('[CommonFillGeneration] Delegating records validation to Records component');
    return this.records.validateGeneratedRecords(records);
  }

  // *** STATISTICS AND REPORTING METHODS ***

  /**
   * Получает статистику шаблонов
   */
  public getTemplatesStats(): {
    totalTemplates: number;
    weekCount: number;
    shiftCount: number;
    daysCovered: number;
  } {
    console.log('[CommonFillGeneration] Delegating templates statistics to Templates component');
    return this.templates.getTemplatesStats();
  }

  /**
   * Получает статистику по записям
   */
  public getRecordsStatistics(records: Partial<IStaffRecord>[]): {
    totalRecords: number;
    holidayRecords: number;
    leaveRecords: number;
    workingRecords: number;
    shifts: number[];
    dateRange: { start: string; end: string };
    timeRanges: Set<string>;
  } {
    console.log('[CommonFillGeneration] Delegating records statistics to Records component');
    return this.records.getRecordsStatistics(records);
  }

  /**
   * Генерирует текстовый отчет анализа
   */
  public generateAnalysisReport(level: AnalysisLevel = AnalysisLevel.DETAILED): string {
    console.log('[CommonFillGeneration] Delegating analysis report generation to Analysis component');
    return this.analysis.generateAnalysisReport(level);
  }

  /**
   * Создает краткий отчет по записям
   */
  public generateRecordsReport(records: Partial<IStaffRecord>[]): string {
    console.log('[CommonFillGeneration] Delegating records report generation to Records component');
    return this.records.generateRecordsReport(records);
  }

  /**
   * Экспортирует анализ в JSON формат
   */
  public exportAnalysisToJSON(): string {
    console.log('[CommonFillGeneration] Delegating analysis export to Analysis component');
    return this.analysis.exportAnalysisToJSON();
  }

  // *** BACKUP AND RESTORE METHODS ***

  /**
   * Создает резервную копию записей в JSON формате
   */
  public createRecordsBackup(records: Partial<IStaffRecord>[], params: IFillParams): string {
    console.log('[CommonFillGeneration] Delegating records backup creation to Records component');
    return this.records.createRecordsBackup(records, params);
  }

  /**
   * Восстанавливает записи из резервной копии
   * FIXED: Proper interface type instead of any
   */
  public restoreRecordsFromBackup(backupJson: string): {
    success: boolean;
    records?: Partial<IStaffRecord>[];
    metadata?: {
      timestamp: string;
      staffMember: {
        id: string;
        name: string;
        employeeId: string;
      };
      period: string;
      totalRecords: number;
      statistics: {
        totalRecords: number;
        holidayRecords: number;
        leaveRecords: number;
        workingRecords: number;
        shifts: number[];
        dateRange: { start: string; end: string };
        timeRanges: Set<string>;
      };
    };
    error?: string;
  } {
    console.log('[CommonFillGeneration] Delegating records restore to Records component');
    return this.records.restoreRecordsFromBackup(backupJson);
  }

  // *** OPTIMIZATION AND UTILITY METHODS ***

  /**
   * Оптимизирует записи для сохранения
   */
  public optimizeRecordsForSaving(records: Partial<IStaffRecord>[]): Partial<IStaffRecord>[] {
    console.log('[CommonFillGeneration] Delegating records optimization to Records component');
    return this.records.optimizeRecordsForSaving(records);
  }

  /**
   * Сортирует шаблоны по приоритету
   */
  public sortTemplatesByPriority(templates: IScheduleTemplate[]): IScheduleTemplate[] {
    console.log('[CommonFillGeneration] Delegating template sorting to Templates component');
    return this.templates.sortTemplatesByPriority(templates);
  }

  /**
   * Получает сводку по шаблонам
   */
  public getTemplatesSummary(templates: IScheduleTemplate[]): {
    description: string;
    coverage: string;
    workingHours: string;
  } {
    console.log('[CommonFillGeneration] Delegating templates summary to Templates component');
    return this.templates.getTemplatesSummary(templates);
  }

  // *** DIAGNOSTIC METHODS ***

  /**
   * Валидирует целостность данных анализа
   */
  public validateAnalysisIntegrity(): {
    isValid: boolean;
    issues: string[];
    warnings: string[];
  } {
    console.log('[CommonFillGeneration] Delegating analysis validation to Analysis component');
    return this.analysis.validateAnalysisIntegrity();
  }

  /**
   * Получает диагностическую информацию анализа
   * FIXED: Proper interface type instead of any
   */
  public getAnalysisDiagnostics(): {
    memoryUsage: string;
    analysisSize: string;
    performanceMetrics: {
      contractsAnalyzed: boolean;
      templatesAnalyzed: boolean;
      generationAnalyzed: boolean;
    };
  } {
    console.log('[CommonFillGeneration] Delegating analysis diagnostics to Analysis component');
    return this.analysis.getDiagnostics();
  }

  /**
   * Получает диагностическую информацию о процессе генерации записей
   * FIXED: Proper interface type instead of any
   */
  public getRecordsDiagnostics(): {
    servicesStatus: {
      staffRecords: boolean;
      holidays: boolean;
      leaves: boolean;
      dateUtils: boolean;
    };
    memoryUsage: string;
    lastOperation: string;
    performanceMetrics: {
      averageRecordCreationTime: number;
      totalOperationTime: number;
    };
  } {
    console.log('[CommonFillGeneration] Delegating records diagnostics to Records component');
    return this.records.getDiagnostics();
  }

  /**
   * Получает общую диагностическую информацию системы
   */
  public getSystemDiagnostics(): {
    architecture: string;
    components: {
      dateUtils: boolean;
      analysis: boolean;
      templates: boolean;
      records: boolean;
    };
    services: {
      staffRecords: boolean;
      holidays: boolean;
      leaves: boolean;
      weeklyTimeTable: boolean;
      remoteSite: boolean;
    };
    capabilities: string[];
  } {
    console.log('[CommonFillGeneration] Generating system diagnostics from main coordinator');
    
    return {
      architecture: 'Refactored Component-Based Architecture',
      components: {
        dateUtils: !!this.dateUtils,
        analysis: !!this.analysis,
        templates: !!this.templates,
        records: !!this.records
      },
      services: {
        staffRecords: !!this.staffRecordsService,
        holidays: !!this.holidaysService,
        leaves: !!this.daysOfLeavesService,
        weeklyTimeTable: !!this.weeklyTimeTableService,
        remoteSite: !!this.remoteSiteService
      },
      capabilities: [
        'Date-only format support for holidays and leaves',
        'Numeric time fields with timezone adjustment',
        'Schedule Tab compatible template processing',
        'Detailed analysis and statistics tracking',
        'Week chaining logic with multiple patterns',
        'Comprehensive validation and diagnostics',
        'Backup and restore functionality',
        'Component-based modular architecture'
      ]
    };
  }

  // *** MAINTENANCE AND CLEANUP METHODS ***

  /**
   * Очищает весь накопленный анализ
   */
  public clearAnalysis(): void {
    console.log('[CommonFillGeneration] Delegating analysis clearing to Analysis component');
    this.analysis.clearAnalysis();
  }

  /**
   * Проверяет наличие данных анализа
   */
  public hasAnalysisData(): boolean {
    return this.analysis.hasAnalysisData();
  }

  /**
   * Получает версию и информацию о компонентах
   */
  public getComponentInfo(): {
    version: string;
    buildDate: string;
    architecture: string;
    componentCount: number;
    features: string[];
  } {
    return {
      version: '2.0.0-refactored',
      buildDate: new Date().toISOString(),
      architecture: 'Component-Based with Separation of Concerns',
      componentCount: 4, // dateUtils, analysis, templates, records
      features: [
        'Refactored modular architecture',
        'Date-only format support',
        'Numeric time fields',
        'Schedule Tab compatibility',
        'Enhanced analysis and reporting',
        'Comprehensive validation',
        'Backup and restore',
        'Timezone adjustment',
        'Week chaining patterns',
        'Component-based testing support'
      ]
    };
  }

  // *** LEGACY COMPATIBILITY METHODS ***

  /**
   * LEGACY: Maintains backward compatibility for older code
   * @deprecated Use specific component methods instead
   */
  public createDateOnlyFromComponents(year: number, month: number, day: number): Date {
    console.warn('[CommonFillGeneration] Using legacy method - consider using dateUtils directly');
    return this.dateUtils.createDateOnlyFromComponents(year, month, day);
  }

  /**
   * LEGACY: Maintains backward compatibility for older code  
   * @deprecated Use specific component methods instead
   */
  public parseTimeString(timeStr: string): { hours: string; minutes: string } {
    console.warn('[CommonFillGeneration] Using legacy method - consider using dateUtils directly');
    return this.dateUtils.parseTimeString(timeStr);
  }

  /**
   * LEGACY: Maintains backward compatibility for older code
   * @deprecated Use analysis.getDetailedAnalysis() instead
   */
  public getDetailedAnalysisLegacy(): IDetailedAnalysisResult {
    console.warn('[CommonFillGeneration] Using legacy method - use getDetailedAnalysis() instead');
    return this.getDetailedAnalysis();
  }

  // *** COMPONENT ACCESS METHODS (FOR ADVANCED USAGE) ***

  /**
   * Получает прямой доступ к компоненту DateUtils (для продвинутого использования)
   */
  public getDateUtilsComponent(): CommonFillDateUtils {
    console.log('[CommonFillGeneration] Providing direct access to DateUtils component');
    return this.dateUtils;
  }

  /**
   * Получает прямой доступ к компоненту Analysis (для продвинутого использования)
   */
  public getAnalysisComponent(): CommonFillAnalysis {
    console.log('[CommonFillGeneration] Providing direct access to Analysis component');
    return this.analysis;
  }

  /**
   * Получает прямой доступ к компоненту Templates (для продвинутого использования)
   */
  public getTemplatesComponent(): CommonFillTemplates {
    console.log('[CommonFillGeneration] Providing direct access to Templates component');
    return this.templates;
  }
  

  /**
   * Получает прямой доступ к компоненту Records (для продвинутого использования)
   */
  public getRecordsComponent(): CommonFillRecords {
    console.log('[CommonFillGeneration] Providing direct access to Records component');
    return this.records;
  }
}