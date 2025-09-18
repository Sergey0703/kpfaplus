// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/hooks/useSRSDependencies.ts

import { useCallback, useEffect, useState, useMemo } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { ISRSTabState } from '../useSRSTabState';
import { useTypesOfLeave } from '../useTypesOfLeave';
import { useHolidays } from '../useHolidays';
import { useSRSData } from '../useSRSData';
import { IStaffMember } from '../../../../../models/types';

/**
 * Interface for dependencies return type
 */
export interface UseSRSDependenciesReturn {
  // Dependency loading functions
  loadHolidays: () => void;
  loadTypesOfLeave: () => void;
  loadSRSData: () => Promise<void>;
  refreshSRSData: () => Promise<void>;
  
  // Dependency readiness state
  areDependenciesReady: boolean;
  isDataValid: boolean;
  
  // Load attempt tracking (for debugging)
  loadAttempts: { holidays: boolean; typesOfLeave: boolean };
  setLoadAttempts: React.Dispatch<React.SetStateAction<{ holidays: boolean; typesOfLeave: boolean }>>;
}

/**
 * Interface for dependencies parameters
 */
interface UseSRSDependenciesParams {
  context?: WebPartContext;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
}

/**
 * Custom hook for managing SRS Tab dependencies coordination
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Coordinate loading of holidays, types of leave, and SRS data
 * - Track load attempts to prevent premature dependency ready signals
 * - Ensure proper loading order: dependencies first, then SRS data
 * - Handle date-based holiday reloading
 * - Provide centralized dependency readiness logic
 * 
 * FIXED ARCHITECTURE:
 * - Uses load attempt tracking to prevent "ready before loaded" issues
 * - Dependencies are ready when: (attempt made AND loading complete) OR data exists
 * - SRS data only loads when dependencies are truly ready
 */
export const useSRSDependencies = (params: UseSRSDependenciesParams): UseSRSDependenciesReturn => {
  const {
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    state,
    setState
  } = params;

  // Load attempt tracking state (CRITICAL for preventing premature loading)
  const [loadAttempts, setLoadAttempts] = useState({
    holidays: false,
    typesOfLeave: false
  });

  console.log('[useSRSDependencies] Hook initialized with FIXED dependency coordination:', {
    hasContext: !!context,
    hasSelectedStaff: !!selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    dateRange: `${state.fromDate.toLocaleDateString()} - ${state.toDate.toLocaleDateString()}`,
    loadAttempts,
    fixedArchitecture: 'Load attempts tracking prevents premature ready signals',
    dateFormat: 'Date-only using SRSDateUtils',
    loadingOrder: '1) Dependencies (holidays + types), 2) SRS data'
  });

  // Initialize dependency hooks
  const { loadHolidays: baseLoadHolidays } = useHolidays({
    context,
    fromDate: state.fromDate,
    toDate: state.toDate,
    setState
  });

  const { loadTypesOfLeave: baseLoadTypesOfLeave } = useTypesOfLeave({
    context,
    setState
  });

  const { loadSRSData, refreshSRSData, isDataValid } = useSRSData({
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    fromDate: state.fromDate,
    toDate: state.toDate,
    showDeleted: state.showDeleted,
    setState
  });

  // Wrapped loadHolidays with attempt tracking
  const loadHolidaysWithTracking = useCallback(() => {
    console.log('[useSRSDependencies] *** LOADING HOLIDAYS WITH ATTEMPT TRACKING (DATE-ONLY) ***');
    setLoadAttempts(prev => ({ ...prev, holidays: true }));
    baseLoadHolidays();
  }, [baseLoadHolidays]);

  // Wrapped loadTypesOfLeave with attempt tracking
  const loadTypesOfLeaveWithTracking = useCallback(() => {
    console.log('[useSRSDependencies] *** LOADING TYPES OF LEAVE WITH ATTEMPT TRACKING ***');
    setLoadAttempts(prev => ({ ...prev, typesOfLeave: true }));
    baseLoadTypesOfLeave();
  }, [baseLoadTypesOfLeave]);

  // CRITICAL: Fixed dependency readiness logic
  const areDependenciesReady = useMemo((): boolean => {
    // Dependencies are ready when:
    // 1. Load attempt was made AND loading is complete, OR
    // 2. Data already exists (recovery from errors)
    
    const holidaysReady = (loadAttempts.holidays && !state.isLoadingHolidays) || state.holidays.length > 0;
    const typesOfLeaveReady = (loadAttempts.typesOfLeave && !state.isLoadingTypesOfLeave) || state.typesOfLeave.length > 0;
    
    const ready = holidaysReady && typesOfLeaveReady;
    
    console.log('[useSRSDependencies] *** FIXED DEPENDENCIES READINESS CHECK (DATE-ONLY) ***:', {
      // Holidays status
      holidaysLoadAttempted: loadAttempts.holidays,
      holidaysLoading: state.isLoadingHolidays,
      holidaysCount: state.holidays.length,
      holidaysReady,
      
      // Types of Leave status
      typesOfLeaveLoadAttempted: loadAttempts.typesOfLeave,
      typesOfLeaveLoading: state.isLoadingTypesOfLeave,
      typesOfLeaveCount: state.typesOfLeave.length,
      typesOfLeaveReady,
      
      // Overall readiness
      ready,
      canLoadSRSData: ready,
      
      // Fix details
      fixApplied: 'Load attempts tracking + data presence check',
      previousIssue: 'areDependenciesReady was true before loading started',
      dateFormat: 'Date-only format with SRSDateUtils integration'
    });
    
    return ready;
  }, [
    loadAttempts.holidays, 
    loadAttempts.typesOfLeave,
    state.isLoadingHolidays, 
    state.isLoadingTypesOfLeave, 
    state.holidays.length, 
    state.typesOfLeave.length
  ]);

  // EFFECT 1: Initial dependency loading
  useEffect(() => {
    console.log('[useSRSDependencies] *** FIXED INITIAL DEPENDENCY LOADING EFFECT ***');
    console.log('[useSRSDependencies] Context available:', !!context);
    console.log('[useSRSDependencies] Load attempts:', loadAttempts);
    
    if (!context) {
      console.log('[useSRSDependencies] No context - cannot load dependencies');
      return;
    }

    // Load holidays only if attempt not yet made
    if (!loadAttempts.holidays) {
      console.log('[useSRSDependencies] Loading holidays (first attempt) with Date-only format');
      loadHolidaysWithTracking();
    } else {
      console.log('[useSRSDependencies] Holidays load already attempted');
    }

    // Load typesOfLeave only if attempt not yet made
    if (!loadAttempts.typesOfLeave) {
      console.log('[useSRSDependencies] Loading types of leave (first attempt)');
      loadTypesOfLeaveWithTracking();
    } else {
      console.log('[useSRSDependencies] Types of leave load already attempted');
    }

  }, [context, loadAttempts.holidays, loadAttempts.typesOfLeave, loadHolidaysWithTracking, loadTypesOfLeaveWithTracking]);

  // EFFECT 2: Reload holidays when dates change (after initial load)
  useEffect(() => {
    console.log('[useSRSDependencies] *** DATE CHANGE - RELOAD HOLIDAYS (DATE-ONLY FORMAT) ***');
    console.log('[useSRSDependencies] Date range changed:', {
      fromDate: state.fromDate.toLocaleDateString(),
      toDate: state.toDate.toLocaleDateString(),
      dateFormat: 'Date-only using SRSDateUtils'
    });
    
    if (context && loadAttempts.holidays) {
      console.log('[useSRSDependencies] Reloading holidays for new date range (Date-only format)');
      baseLoadHolidays(); // Direct call without changing loadAttempts
    }
  }, [context, state.fromDate, state.toDate, loadAttempts.holidays, baseLoadHolidays]);

  // EFFECT 3: Load SRS data when dependencies are ready
  useEffect(() => {
    console.log('[useSRSDependencies] *** FIXED SRS DATA LOADING EFFECT ***');
    console.log('[useSRSDependencies] Dependencies check result:', {
      hasContext: !!context,
      hasSelectedStaff: !!selectedStaff?.employeeId,
      areDependenciesReady,
      isDataValid,
      fixApplied: 'Load attempts tracking prevents premature loading',
      dateFormat: 'Date-only format with SRSDateUtils'
    });
    
    if (context && selectedStaff?.employeeId && areDependenciesReady && isDataValid) {
      console.log('[useSRSDependencies] *** ALL DEPENDENCIES READY - LOADING SRS DATA (DATE-ONLY) ***');
      void loadSRSData();
    } else {
      console.log('[useSRSDependencies] SRS data load blocked:', {
        needContext: !context,
        needSelectedStaff: !selectedStaff?.employeeId,
        needDependencies: !areDependenciesReady,
        needValidData: !isDataValid,
        waitingFor: [
          !context && 'context',
          !selectedStaff?.employeeId && 'selectedStaff',
          !areDependenciesReady && 'dependencies',
          !isDataValid && 'validData'
        ].filter(Boolean).join(', ')
      });
    }
  }, [
    context, 
    selectedStaff?.employeeId, 
    areDependenciesReady, 
    isDataValid, 
    state.fromDate, 
    state.toDate, 
    state.showDeleted, 
    loadSRSData
  ]);

  // Log dependency coordination status
  console.log('[useSRSDependencies] Dependency coordination status:', {
    loadAttempts,
    areDependenciesReady,
    isDataValid,
    currentState: {
      holidaysCount: state.holidays.length,
      holidaysLoading: state.isLoadingHolidays,
      typesOfLeaveCount: state.typesOfLeave.length,
      typesOfLeaveLoading: state.isLoadingTypesOfLeave,
      srsRecordsCount: state.srsRecords.length,
      srsLoading: state.isLoadingSRS
    },
    fixedArchitecture: {
      loadAttemptsTracking: true,
      prematureReadyPrevention: true,
      properLoadingOrder: true,
      dateOnlySupport: true
    }
  });

  return {
    loadHolidays: loadHolidaysWithTracking,
    loadTypesOfLeave: loadTypesOfLeaveWithTracking,
    loadSRSData,
    refreshSRSData,
    areDependenciesReady,
    isDataValid,
    loadAttempts,
    setLoadAttempts
  };
};