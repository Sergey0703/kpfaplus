// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/handlers/useSRSDateHandlers.ts

import { useCallback } from 'react';
import { ISRSTabState, SRSTabStateHelpers } from '../useSRSTabState';
import { SRSDateUtils } from '../SRSDateUtils';
import { ISRSRecord } from '../SRSTabInterfaces';

/**
 * Interface for date handlers return type
 */
export interface UseSRSDateHandlersReturn {
  onFromDateChange: (date: Date | undefined) => void;
  onToDateChange: (date: Date | undefined) => void;
}

/**
 * Interface for date handlers parameters
 */
interface UseSRSDateHandlersParams {
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
  // *** ИСПРАВЛЕНО: Заменил any на правильный тип ***
  setModifiedRecords: React.Dispatch<React.SetStateAction<Map<string, Partial<ISRSRecord>>>>;
  setAddShiftOperations: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
}

/**
 * Custom hook for handling date changes in SRS Tab
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Handle fromDate changes with automatic toDate calculation
 * - Handle toDate changes with validation
 * - Clear modified records when dates change
 * - Use Date-only format with SRSDateUtils
 */
export const useSRSDateHandlers = (params: UseSRSDateHandlersParams): UseSRSDateHandlersReturn => {
  const { state, setState, setModifiedRecords, setAddShiftOperations } = params;

  console.log('[useSRSDateHandlers] Hook initialized with Date-only format support:', {
    currentFromDate: state.fromDate.toLocaleDateString(),
    currentToDate: state.toDate.toLocaleDateString(),
    dateFormat: 'Date-only using SRSDateUtils',
    autoWeekRangeCalculation: true,
    modifiedRecordsClearOnChange: true
  });

  /**
   * Handles changes to the fromDate with automatic toDate calculation
   * Always creates a 7-day range from the selected fromDate
   */
  const handleFromDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useSRSDateHandlers] handleFromDateChange called with Date-only format:', date?.toISOString());
    
    if (!date) {
      console.log('[useSRSDateHandlers] No date provided to handleFromDateChange');
      return;
    }

    // Calculate normalized fromDate using SRSDateUtils
    const normalizedFromDate = SRSDateUtils.calculateWeekRange(date).start;
    console.log('[useSRSDateHandlers] Normalized fromDate (Date-only):', {
      original: date.toISOString(),
      normalized: normalizedFromDate.toISOString(),
      display: SRSDateUtils.formatDateForDisplay(normalizedFromDate)
    });

    // Always calculate new toDate for a 7-day range
    const newToDate = SRSDateUtils.getWeekEndAfterDate(normalizedFromDate);
    console.log('[useSRSDateHandlers] Auto-updating toDate for 7-day range (Date-only):', {
      newToDate: newToDate.toISOString(),
      display: SRSDateUtils.formatDateForDisplay(newToDate),
      daysInRange: SRSDateUtils.calculateDaysInRange(normalizedFromDate, newToDate)
    });
    
    // Update dates in state
    SRSTabStateHelpers.updateDates(setState, normalizedFromDate, newToDate);

    // Clear all local modifications when dates change
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    setAddShiftOperations(new Map());

    console.log('[useSRSDateHandlers] Date change complete - cleared local modifications:', {
      fromDate: SRSDateUtils.formatDateForDisplay(normalizedFromDate),
      toDate: SRSDateUtils.formatDateForDisplay(newToDate),
      clearedModifications: true,
      clearedUnsavedChanges: true,
      dateFormat: 'Date-only format maintained'
    });
  }, [setState, setModifiedRecords, setAddShiftOperations]);

  /**
   * Handles changes to the toDate with validation against fromDate
   * Respects user's choice without forcing week boundaries
   */
  const handleToDateChange = useCallback((date: Date | undefined): void => {
    console.log('[useSRSDateHandlers] handleToDateChange called with Date-only format:', date?.toISOString());
    
    if (!date) {
      console.log('[useSRSDateHandlers] No date provided to handleToDateChange');
      return;
    }

    // Normalize the user-selected toDate
    const normalizedToDate = SRSDateUtils.normalizeDateToLocalMidnight(date);
    console.log('[useSRSDateHandlers] Normalized toDate (respecting user choice):', {
      original: date.toISOString(),
      normalized: normalizedToDate.toISOString(),
      display: SRSDateUtils.formatDateForDisplay(normalizedToDate)
    });

    // Validate that toDate is not before fromDate
    if (normalizedToDate < state.fromDate) {
      console.warn('[useSRSDateHandlers] toDate cannot be before fromDate, ignoring change:', {
        attemptedToDate: SRSDateUtils.formatDateForDisplay(normalizedToDate),
        currentFromDate: SRSDateUtils.formatDateForDisplay(state.fromDate)
      });
      return;
    }
    
    // Update only toDate (keep fromDate unchanged)
    SRSTabStateHelpers.updateDates(setState, state.fromDate, normalizedToDate);

    // Clear all local modifications when dates change
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    setAddShiftOperations(new Map());

    console.log('[useSRSDateHandlers] toDate change complete - cleared local modifications:', {
      fromDate: SRSDateUtils.formatDateForDisplay(state.fromDate),
      toDate: SRSDateUtils.formatDateForDisplay(normalizedToDate),
      daysInRange: SRSDateUtils.calculateDaysInRange(state.fromDate, normalizedToDate),
      clearedModifications: true,
      dateFormat: 'Date-only format maintained'
    });
  }, [state.fromDate, setState, setModifiedRecords, setAddShiftOperations]);

  // Log handlers creation
  console.log('[useSRSDateHandlers] Date handlers created:', {
    hasFromDateHandler: !!handleFromDateChange,
    hasToDateHandler: !!handleToDateChange,
    currentDateRange: `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
    dateFormat: 'Date-only with SRSDateUtils integration',
    autoWeekCalculation: 'fromDate changes create 7-day range',
    userToDateRespected: 'toDate changes respect user selection',
    validationEnabled: 'toDate cannot be before fromDate'
  });

  return {
    onFromDateChange: handleFromDateChange,
    onToDateChange: handleToDateChange
  };
};