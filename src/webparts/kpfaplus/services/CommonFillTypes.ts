// src/webparts/kpfaplus/services/CommonFillTypes.ts
// TYPES AND INTERFACES: All type definitions for CommonFillGeneration system
// COMPLETE IMPLEMENTATION: Enhanced Auto-Fill with timer, spinner, and execution time tracking

import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffMember } from '../models/types';
import { IContract } from '../models/IContract';

// *** CORE FILL PARAMETERS INTERFACE ***
export interface IFillParams {
  selectedDate: Date;
  staffMember: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number; // ИСПРАВЛЕНО: сделан опциональным для совместимости с IPerformFillParams
  context: WebPartContext;
}

// *** SCHEDULE TEMPLATE INTERFACE ***
export interface IScheduleTemplate {
  id: string;
  contractId: string;
  NumberOfWeek: number;
  NumberOfShift: number;
  dayOfWeek: number; // 1-7 (Monday-Sunday)
  dayName: string;
  startTime: string; // HH:mm формат
  endTime: string;   // HH:mm формат  
  lunchMinutes: number;
  deleted: number;
}

// *** ANALYSIS INTERFACES ***
export interface IContractsAnalysis {
  totalFound: number;
  activeInPeriod: IContract[];
  selectedContract: IContract;
  selectionReason: string;
}

export interface ITemplatesAnalysis {
  contractId: string;
  contractName: string;
  totalItemsFromServer: number;
  afterManagerFilter: number;
  afterDeletedFilter: number;
  finalTemplatesCount: number;
  weeksInSchedule: number[];
  shiftsAvailable: number[];
  numberOfWeekTemplates: number;
  dayOfStartWeek: number;
  weekStartDayName: string;
  templatesByWeekAndDay: Map<string, IScheduleTemplate[]>;
  filteringDetails: string[];
}

export interface IDayGenerationInfo {
  date: string;
  weekNumber: number;
  dayNumber: number;
  dayName: string;
  templateFound: boolean;
  templateUsed?: IScheduleTemplate;
  workingHours?: string;
  lunchMinutes?: number;
  isHoliday: boolean;
  isLeave: boolean;
  leaveType?: string;
  skipReason?: string;
}

export interface IGenerationAnalysis {
  totalDaysInPeriod: number;
  daysGenerated: number;
  daysSkipped: number;
  holidaysDetected: number;
  leavesDetected: number;
  dailyInfo: IDayGenerationInfo[];
  weeklyStats: Map<number, { total: number; generated: number; skipped: number }>;
}

// *** WEEKLY TIME TABLE ITEM INTERFACE ***
export interface IWeeklyTimeTableItem {
  id: string;
  fields?: {
    NumberOfWeek?: number;
    NumberOfShift?: number;
    TimeForLunch?: number;
    Deleted?: number;
    CreatorLookupId?: string;
    creatorId?: string;
    Creator?: string;
    MondeyStartWork?: string; // Опечатка в SharePoint
    MondayEndWork?: string;
    TuesdayStartWork?: string;
    TuesdayEndWork?: string;
    WednesdayStartWork?: string;
    WednesdayEndWork?: string;
    ThursdayStartWork?: string;
    ThursdayEndWork?: string;
    FridayStartWork?: string;
    FridayEndWork?: string;
    SaturdayStartWork?: string;
    SaturdayEndWork?: string;
    SundayStartWork?: string;
    SundayEndWork?: string;
    [key: string]: unknown;
  };
}

// *** NUMERIC TIME RESULT INTERFACE ***
export interface INumericTimeResult {
  hours: number;
  minutes: number;
}

// *** DETAILED ANALYSIS RESULT INTERFACE ***
export interface IDetailedAnalysisResult {
  contracts?: IContractsAnalysis;
  templates?: ITemplatesAnalysis;
  generation?: IGenerationAnalysis;
}

// *** WEEK AND DAY CALCULATION RESULT ***
export interface IWeekAndDayResult {
  calendarWeekNumber: number;
  templateWeekNumber: number;
  dayNumber: number;
}

// *** LEAVE PERIOD INTERFACE ***
export interface ILeavePeriod {
  startDate: Date;
  endDate: Date;
  typeOfLeave: string;
  title: string;
}

// *** TIME PARSING RESULT ***
export interface ITimeComponents {
  hours: string;
  minutes: string;
}

// *** GENERATION RESULT INTERFACE ***
export interface IGenerationResult {
  records: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  totalGenerated: number;
  analysis: IGenerationAnalysis;
}

// *** SAVE RESULT INTERFACE ***
export interface ISaveResult {
  successCount: number;
  totalRecords: number;
  errors: string[];
}

// *** CONSTANTS ***
export const FILL_CONSTANTS = {
  // Default lunch time in minutes
  DEFAULT_LUNCH_MINUTES: 30,
  
  // Default working hours
  DEFAULT_START_TIME: '09:00',
  DEFAULT_END_TIME: '17:00',
  
  // SharePoint day numbering (1=Monday, 7=Sunday)
  SHAREPOINT_DAYS: {
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
    SUNDAY: 7
  } as const,
  
  // JavaScript day numbering (0=Sunday, 6=Saturday)
  JS_DAYS: {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6
  } as const,
  
  // Week start day options
  WEEK_START_DAYS: {
    SUNDAY: 7,
    MONDAY: 2,
    SATURDAY: 6
  } as const,
  
  // Template week cycling patterns
  WEEK_PATTERNS: {
    SINGLE: 1,
    ALTERNATING: 2,
    THREE_WEEK: 3,
    MONTHLY: 4
  } as const,
  
  // Holiday and leave flags
  FLAGS: {
    HOLIDAY: 1,
    NO_HOLIDAY: 0,
    DELETED: 1,
    NOT_DELETED: 0
  } as const,
  
  // Batch processing sizes
  BATCH_SIZES: {
    SAVE_RECORDS: 1,
    PROCESS_TEMPLATES: 10,
    ANALYSIS_CHUNK: 50
  } as const,
  
  // Timezone adjustment
  TIMEZONE: {
    UTC_OFFSET_HOURS: 0,
    NOON_SAFE_HOUR: 12,
    MILLISECONDS_PER_DAY: 1000 * 60 * 60 * 24
  } as const
} as const;

// *** DAY NAME MAPPINGS ***
export const DAY_NAMES = {
  SHAREPOINT: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  JAVASCRIPT: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
} as const;

// *** TYPE GUARDS ***
export function isValidScheduleTemplate(obj: any): obj is IScheduleTemplate { // eslint-disable-line @typescript-eslint/no-explicit-any
  return obj && 
    typeof obj.id === 'string' &&
    typeof obj.contractId === 'string' &&
    typeof obj.NumberOfWeek === 'number' &&
    typeof obj.NumberOfShift === 'number' &&
    typeof obj.dayOfWeek === 'number' &&
    typeof obj.dayName === 'string' &&
    typeof obj.startTime === 'string' &&
    typeof obj.endTime === 'string' &&
    typeof obj.lunchMinutes === 'number';
}

export function isValidFillParams(obj: any): obj is IFillParams { // eslint-disable-line @typescript-eslint/no-explicit-any
  return obj &&
    obj.selectedDate instanceof Date &&
    obj.staffMember &&
    typeof obj.staffMember.id === 'string' &&
    typeof obj.dayOfStartWeek === 'number' &&
    obj.context;
}

export function isValidNumericTimeResult(obj: any): obj is INumericTimeResult { // eslint-disable-line @typescript-eslint/no-explicit-any
  return obj &&
    typeof obj.hours === 'number' &&
    typeof obj.minutes === 'number' &&
    obj.hours >= 0 && obj.hours <= 23 &&
    obj.minutes >= 0 && obj.minutes <= 59;
}

// *** UTILITY TYPES ***
export type SharePointDayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type JavaScriptDayNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type WeekNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type ShiftNumber = 1 | 2 | 3 | 4 | 5;
export type HourNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
export type MinuteNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59;

// *** ERROR TYPES ***
export class FillValidationError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'FillValidationError';
  }
}

export class FillProcessingError extends Error {
  constructor(message: string, public readonly step: string, public readonly originalError?: Error) {
    super(message);
    this.name = 'FillProcessingError';
  }
}

export class FillConfigurationError extends Error {
  constructor(message: string, public readonly component: string) {
    super(message);
    this.name = 'FillConfigurationError';
  }
}

// *** ENUMS ***
export enum ProcessingStep {
  LOAD_HOLIDAYS = 'load_holidays',
  LOAD_LEAVES = 'load_leaves', 
  LOAD_TEMPLATES = 'load_templates',
  ANALYZE_CONTRACTS = 'analyze_contracts',
  ANALYZE_TEMPLATES = 'analyze_templates',
  GENERATE_RECORDS = 'generate_records',
  SAVE_RECORDS = 'save_records'
}

export enum AnalysisLevel {
  BASIC = 'basic',
  DETAILED = 'detailed',
  DEBUG = 'debug'
}

export enum WeekChainingPattern {
  SINGLE = 'single',
  ALTERNATING = 'alternating', 
  THREE_WEEK = 'three_week',
  FOUR_WEEK = 'four_week',
  CUSTOM = 'custom'
}

// *** DEFAULT VALUES ***
export const DEFAULT_VALUES = {
  FILL_PARAMS: {
    dayOfStartWeek: FILL_CONSTANTS.WEEK_START_DAYS.SUNDAY,
    lunchMinutes: FILL_CONSTANTS.DEFAULT_LUNCH_MINUTES
  },
  SCHEDULE_TEMPLATE: {
    NumberOfWeek: 1,
    NumberOfShift: 1,
    startTime: FILL_CONSTANTS.DEFAULT_START_TIME,
    endTime: FILL_CONSTANTS.DEFAULT_END_TIME,
    lunchMinutes: FILL_CONSTANTS.DEFAULT_LUNCH_MINUTES,
    deleted: FILL_CONSTANTS.FLAGS.NOT_DELETED
  },
  TIME_COMPONENTS: {
    hours: '09',
    minutes: '00'
  }
} as const;