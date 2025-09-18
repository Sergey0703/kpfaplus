// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/hooks/useSRSComputedValues.ts

import { useMemo } from 'react';
import { ISRSTabState } from '../useSRSTabState';
import { SRSDateUtils } from '../SRSDateUtils';
import { IStaffRecord } from '../../../../../services/StaffRecordsService';

/**
 * Interface for computed values return type
 */
export interface UseSRSComputedValuesReturn {
  // Selection state computed values
  hasCheckedItems: boolean;
  selectedItemsCount: number;
  selectionPercentage: number;
  
  // Records statistics
  totalRecords: number;
  activeRecords: number;
  deletedRecords: number;
  deletedPercentage: number;
  
  // Type of leave statistics
  recordsWithLeave: number;
  recordsWithoutLeave: number;
  leavePercentage: number;
  
  // Holiday statistics (Date-only based)
  holidayRecords: number;
  regularRecords: number;
  holidayPercentage: number;
  holidaysInRange: number;
  
  // Checkbox statistics (record data checkboxes)
  checkedRecords: number;
  uncheckedRecords: number;
  checkedPercentage: number;
  
  // Date range information
  daysInRange: number;
  dateRangeDisplay: string;
  isValidDateRange: boolean;
  
  // Dependencies status
  isDependenciesLoading: boolean;
  dependenciesLoadProgress: number;
  
  // Operations status
  hasOngoingOperations: boolean;
  operationsCount: number;
}

/**
 * Interface for computed values parameters
 */
interface UseSRSComputedValuesParams {
  state: ISRSTabState;
  deleteOperations?: Map<string, boolean>;
  restoreOperations?: Map<string, boolean>;
  addShiftOperations?: Map<string, boolean>;
}

/**
 * Custom hook for computing derived values in SRS Tab
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Calculate all derived/computed values from state
 * - Provide statistics about records, selections, and operations
 * - Handle Date-only format calculations
 * - Optimize calculations with useMemo for performance
 * - Distinguish between UI selections and record data checkboxes
 */
export const useSRSComputedValues = (params: UseSRSComputedValuesParams): UseSRSComputedValuesReturn => {
  const { state, deleteOperations, restoreOperations, addShiftOperations } = params;

  console.log('[useSRSComputedValues] Computing derived values for SRS Tab:', {
    totalRecords: state.srsRecords.length,
    selectedItems: state.selectedItems.size,
    holidaysCount: state.holidays.length,
    typesOfLeaveCount: state.typesOfLeave.length,
    showDeleted: state.showDeleted,
    dateFormat: 'Date-only using SRSDateUtils',
    computationScope: 'All statistics and derived values'
  });

  // Selection state computed values
  const selectionStats = useMemo(() => {
    const selectedCount = state.selectedItems.size;
    const totalCount = state.srsRecords.length;
    
    return {
      hasCheckedItems: selectedCount > 0,
      selectedItemsCount: selectedCount,
      selectionPercentage: totalCount > 0 ? Math.round((selectedCount / totalCount) * 100) : 0
    };
  }, [state.selectedItems.size, state.srsRecords.length]);

  // Records statistics (active vs deleted)
  const recordsStats = useMemo(() => {
    const totalRecords = state.srsRecords.length;
    const deletedRecords = state.srsRecords.filter((r: IStaffRecord) => r.Deleted === 1).length;
    const activeRecords = totalRecords - deletedRecords;
    
    return {
      totalRecords,
      activeRecords,
      deletedRecords,
      deletedPercentage: totalRecords > 0 ? Math.round((deletedRecords / totalRecords) * 100) : 0
    };
  }, [state.srsRecords]);

  // Type of leave statistics
  const leaveStats = useMemo(() => {
    const recordsWithLeave = state.srsRecords.filter((r: IStaffRecord) => {
      return r.TypeOfLeaveID && r.TypeOfLeaveID !== '' && r.TypeOfLeaveID !== '0';
    }).length;
    
    const totalRecords = state.srsRecords.length;
    const recordsWithoutLeave = totalRecords - recordsWithLeave;
    
    return {
      recordsWithLeave,
      recordsWithoutLeave,
      leavePercentage: totalRecords > 0 ? Math.round((recordsWithLeave / totalRecords) * 100) : 0
    };
  }, [state.srsRecords]);

  // Holiday statistics (Date-only based - NOT using Holiday field)
  const holidayStats = useMemo(() => {
    console.log('[useSRSComputedValues] Computing holiday statistics using Date-only holidays list (not Holiday field)');
    
    // Count holidays in current date range
    const holidaysInRange = state.holidays.filter(holiday => {
      const holidayDate = holiday.date;
      return SRSDateUtils.isDateInRange(holidayDate, state.fromDate, state.toDate);
    }).length;
    
    // Count records that fall on holiday dates (using holidays list, not Holiday field)
    const holidayRecords = state.srsRecords.filter((record: IStaffRecord) => {
      if (!record.Date) return false;
      
      // Check if record date matches any holiday in the list (Date-only comparison)
      return state.holidays.some(holiday => {
        const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.Date);
        const holidayDate = SRSDateUtils.normalizeDateToLocalMidnight(holiday.date);
        return SRSDateUtils.areDatesEqual(recordDate, holidayDate);
      });
    }).length;
    
    const totalRecords = state.srsRecords.length;
    const regularRecords = totalRecords - holidayRecords;
    
    console.log('[useSRSComputedValues] Holiday statistics (Date-only):', {
      holidaysInRange,
      holidayRecords,
      regularRecords,
      totalRecords,
      holidayDetectionMethod: 'Holidays list date matching (Date-only), not Holiday field'
    });
    
    return {
      holidayRecords,
      regularRecords,
      holidayPercentage: totalRecords > 0 ? Math.round((holidayRecords / totalRecords) * 100) : 0,
      holidaysInRange
    };
  }, [state.srsRecords, state.holidays, state.fromDate, state.toDate]);

  // Checkbox statistics (record data checkboxes, not UI selections)
  const checkboxStats = useMemo(() => {
    const checkedRecords = state.srsRecords.filter((r: IStaffRecord) => r.Checked === 1).length;
    const totalRecords = state.srsRecords.length;
    const uncheckedRecords = totalRecords - checkedRecords;
    
    return {
      checkedRecords,
      uncheckedRecords,
      checkedPercentage: totalRecords > 0 ? Math.round((checkedRecords / totalRecords) * 100) : 0
    };
  }, [state.srsRecords]);

  // Date range information (Date-only)
  const dateRangeInfo = useMemo(() => {
    const daysInRange = SRSDateUtils.calculateDaysInRange(state.fromDate, state.toDate);
    const dateRangeDisplay = `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`;
    const isValidDateRange = state.fromDate <= state.toDate;
    
    return {
      daysInRange,
      dateRangeDisplay,
      isValidDateRange
    };
  }, [state.fromDate, state.toDate]);

  // Dependencies loading status
  const dependenciesStatus = useMemo(() => {
    const loadingCount = (state.isLoadingHolidays ? 1 : 0) + (state.isLoadingTypesOfLeave ? 1 : 0);
    const totalDependencies = 2; // holidays + typesOfLeave
    
    return {
      isDependenciesLoading: loadingCount > 0,
      dependenciesLoadProgress: Math.round(((totalDependencies - loadingCount) / totalDependencies) * 100)
    };
  }, [state.isLoadingHolidays, state.isLoadingTypesOfLeave]);

  // Operations status
  const operationsStatus = useMemo(() => {
    const deleteCount = deleteOperations?.size || 0;
    const restoreCount = restoreOperations?.size || 0;
    const addShiftCount = addShiftOperations?.size || 0;
    const totalOperations = deleteCount + restoreCount + addShiftCount;
    
    return {
      hasOngoingOperations: totalOperations > 0,
      operationsCount: totalOperations
    };
  }, [deleteOperations?.size, restoreOperations?.size, addShiftOperations?.size]);

  // Log computed values summary
  console.log('[useSRSComputedValues] Computed values summary:', {
    selection: {
      selectedItems: selectionStats.selectedItemsCount,
      selectionPercentage: selectionStats.selectionPercentage + '%'
    },
    records: {
      total: recordsStats.totalRecords,
      active: recordsStats.activeRecords,
      deleted: recordsStats.deletedRecords
    },
    leave: {
      withLeave: leaveStats.recordsWithLeave,
      withoutLeave: leaveStats.recordsWithoutLeave
    },
    holidays: {
      holidayRecords: holidayStats.holidayRecords,
      holidaysInRange: holidayStats.holidaysInRange,
      detectionMethod: 'Date-only holidays list'
    },
    checkboxes: {
      checked: checkboxStats.checkedRecords,
      unchecked: checkboxStats.uncheckedRecords
    },
    dateRange: {
      days: dateRangeInfo.daysInRange,
      display: dateRangeInfo.dateRangeDisplay
    },
    dependencies: {
      loading: dependenciesStatus.isDependenciesLoading,
      progress: dependenciesStatus.dependenciesLoadProgress + '%'
    },
    operations: {
      ongoing: operationsStatus.hasOngoingOperations,
      count: operationsStatus.operationsCount
    }
  });

  return {
    // Selection state
    hasCheckedItems: selectionStats.hasCheckedItems,
    selectedItemsCount: selectionStats.selectedItemsCount,
    selectionPercentage: selectionStats.selectionPercentage,
    
    // Records statistics
    totalRecords: recordsStats.totalRecords,
    activeRecords: recordsStats.activeRecords,
    deletedRecords: recordsStats.deletedRecords,
    deletedPercentage: recordsStats.deletedPercentage,
    
    // Type of leave statistics
    recordsWithLeave: leaveStats.recordsWithLeave,
    recordsWithoutLeave: leaveStats.recordsWithoutLeave,
    leavePercentage: leaveStats.leavePercentage,
    
    // Holiday statistics (Date-only based)
    holidayRecords: holidayStats.holidayRecords,
    regularRecords: holidayStats.regularRecords,
    holidayPercentage: holidayStats.holidayPercentage,
    holidaysInRange: holidayStats.holidaysInRange,
    
    // Checkbox statistics
    checkedRecords: checkboxStats.checkedRecords,
    uncheckedRecords: checkboxStats.uncheckedRecords,
    checkedPercentage: checkboxStats.checkedPercentage,
    
    // Date range information
    daysInRange: dateRangeInfo.daysInRange,
    dateRangeDisplay: dateRangeInfo.dateRangeDisplay,
    isValidDateRange: dateRangeInfo.isValidDateRange,
    
    // Dependencies status
    isDependenciesLoading: dependenciesStatus.isDependenciesLoading,
    dependenciesLoadProgress: dependenciesStatus.dependenciesLoadProgress,
    
    // Operations status
    hasOngoingOperations: operationsStatus.hasOngoingOperations,
    operationsCount: operationsStatus.operationsCount
  };
};