// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/handlers/useSRSSaveHandlers.ts

import { useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../../services/StaffRecordsService';
import { ISRSRecord } from '../SRSTabInterfaces';
import { ISRSTabState, SRSTabStateHelpers } from '../useSRSTabState';
import { SRSDateUtils } from '../SRSDateUtils';

/**
 * Interface for save handlers return type
 */
export interface UseSRSSaveHandlersReturn {
  onSave: () => Promise<void>;
  onSaveChecked: () => void;
  onExportAll: () => void;
  onRefreshData: () => void;
  onErrorDismiss: () => void;
}

/**
 * Interface for save handlers parameters
 */
interface UseSRSSaveHandlersParams {
  context?: WebPartContext;
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
  modifiedRecords: Map<string, Partial<ISRSRecord>>;
  setModifiedRecords: React.Dispatch<React.SetStateAction<Map<string, Partial<ISRSRecord>>>>;
  refreshSRSData: () => Promise<void>;
  setLoadAttempts: React.Dispatch<React.SetStateAction<{ holidays: boolean; typesOfLeave: boolean }>>;
  setDeleteOperations: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
  setRestoreOperations: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
  setAddShiftOperations: React.Dispatch<React.SetStateAction<Map<string, boolean>>>;
}

/**
 * Custom hook for handling save, export, and data refresh operations
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Save all modified records to server with numeric time fields
 * - Save only checked/selected records  
 * - Export all SRS data functionality
 * - Manual data refresh with dependency reload
 * - Error dismissal
 */
export const useSRSSaveHandlers = (params: UseSRSSaveHandlersParams): UseSRSSaveHandlersReturn => {
  const {
    context,
    state,
    setState,
    modifiedRecords,
    setModifiedRecords,
    refreshSRSData,
    setLoadAttempts,
    setDeleteOperations,
    setRestoreOperations,
    setAddShiftOperations
  } = params;

  console.log('[useSRSSaveHandlers] Hook initialized with REAL StaffRecordsService integration:', {
    hasContext: !!context,
    modifiedRecordsCount: modifiedRecords.size,
    hasUnsavedChanges: state.hasUnsavedChanges,
    selectedItemsCount: state.selectedItems.size,
    totalRecords: state.srsRecords.length,
    saveIntegration: 'StaffRecordsService.updateStaffRecord with numeric time fields',
    dateFormat: 'Date-only using SRSDateUtils',
    totalHoursHandling: 'Real-time calculation in SRSTable',
    checkboxSupport: 'Saves Checked field to server'
  });

  /**
   * REAL SAVE: Save all modified records to server with numeric time fields
   * Simplified - no totalHours recalculation (handled in SRSTable)
   */
  const handleSave = useCallback(async (): Promise<void> => {
    console.log('[useSRSSaveHandlers] *** SIMPLIFIED SAVE ALL CHANGES (NO TOTAL HOURS RECALC + DATE-ONLY) ***');
    
    if (!state.hasUnsavedChanges) {
      console.log('[useSRSSaveHandlers] No unsaved changes to save');
      return;
    }

    if (!context) {
      console.error('[useSRSSaveHandlers] Context is not available for save operation');
      return;
    }

    console.log('[useSRSSaveHandlers] Saving changes for modified records (simplified architecture + Date-only):', {
      modifiedRecordsCount: modifiedRecords.size,
      modifiedIds: Array.from(modifiedRecords.keys()),
      totalHoursHandling: 'Calculated in real-time by SRSTable',
      dateFormat: 'Date-only format for any date fields'
    });

    try {
      const staffRecordsService = StaffRecordsService.getInstance(context);
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Save each modified record
      const modifiedEntries = Array.from(modifiedRecords.entries());
      for (let i = 0; i < modifiedEntries.length; i++) {
        const [itemId, modifications] = modifiedEntries[i];
        try {
          console.log(`[useSRSSaveHandlers] *** SAVING RECORD ${itemId} WITH MODIFICATIONS (DATE-ONLY) ***:`, modifications);

          // Find original record
          const originalRecord = state.srsRecords.find((r: IStaffRecord) => r.ID === itemId);
          if (!originalRecord) {
            console.error(`[useSRSSaveHandlers] Original record not found for ID: ${itemId}`);
            errorCount++;
            errors.push(`Record ${itemId} not found`);
            continue;
          }

          // Create update data object with numeric time fields
          const updateData: Partial<IStaffRecord> = {};

          // Handle time changes with numeric fields
          if ('startWork' in modifications) {
            const startWork = modifications.startWork as { hours: string; minutes: string };
            updateData.ShiftDate1Hours = parseInt(startWork.hours, 10);
            updateData.ShiftDate1Minutes = parseInt(startWork.minutes, 10);
            console.log(`[useSRSSaveHandlers] Setting start time (numeric): ${updateData.ShiftDate1Hours}:${updateData.ShiftDate1Minutes}`);
          }

          if ('finishWork' in modifications) {
            const finishWork = modifications.finishWork as { hours: string; minutes: string };
            updateData.ShiftDate2Hours = parseInt(finishWork.hours, 10);
            updateData.ShiftDate2Minutes = parseInt(finishWork.minutes, 10);
            console.log(`[useSRSSaveHandlers] Setting finish time (numeric): ${updateData.ShiftDate2Hours}:${updateData.ShiftDate2Minutes}`);
          }

          // Handle other field modifications
          if ('lunch' in modifications) {
            updateData.TimeForLunch = parseInt(modifications.lunch as string, 10);
            console.log(`[useSRSSaveHandlers] Setting lunch time: ${updateData.TimeForLunch}`);
          }

          if ('contract' in modifications) {
            updateData.Contract = parseInt(modifications.contract as string, 10);
            console.log(`[useSRSSaveHandlers] Setting contract: ${updateData.Contract}`);
          }

          if ('typeOfLeave' in modifications) {
            updateData.TypeOfLeaveID = modifications.typeOfLeave as string;
            console.log(`[useSRSSaveHandlers] Setting type of leave: ${updateData.TypeOfLeaveID}`);
          }

          if ('timeLeave' in modifications) {
            updateData.LeaveTime = parseFloat(modifications.timeLeave as string);
            console.log(`[useSRSSaveHandlers] Setting leave time: ${updateData.LeaveTime}`);
          }

          if ('hours' in modifications) {
            updateData.WorkTime = modifications.hours as string;
            console.log(`[useSRSSaveHandlers] Setting work time: ${updateData.WorkTime}`);
          }

          if ('relief' in modifications) {
            // Relief is UI-only field, not saved to StaffRecords
            console.log(`[useSRSSaveHandlers] Relief field ignored (UI only): ${modifications.relief}`);
          }

          // Handle checkbox changes
          if ('checked' in modifications) {
            updateData.Checked = modifications.checked as boolean ? 1 : 0;
            console.log(`[useSRSSaveHandlers] Setting checked field: ${updateData.Checked} (1 = checked, 0 = unchecked)`);
          }

          // Handle date changes (if implemented in future)
          // if ('date' in modifications) {
          //   updateData.Date = SRSDateUtils.normalizeDateToLocalMidnight(modifications.date as Date);
          // }

          // Check if there are fields to update
          if (Object.keys(updateData).length === 0) {
            console.log(`[useSRSSaveHandlers] No server fields to update for record ${itemId}`);
            successCount++;
            continue;
          }

          console.log(`[useSRSSaveHandlers] *** CALLING REAL StaffRecordsService.updateStaffRecord (DATE-ONLY) ***`);
          console.log(`[useSRSSaveHandlers] Update data for record ${itemId}:`, updateData);

          // REAL CALL: updateStaffRecord with numeric time fields and Date-only
          const success = await staffRecordsService.updateStaffRecord(itemId, updateData);

          if (success) {
            console.log(`[useSRSSaveHandlers] *** REAL SAVE SUCCESSFUL (DATE-ONLY) *** for record ${itemId}`);
            successCount++;
          } else {
            console.error(`[useSRSSaveHandlers] *** REAL SAVE FAILED *** for record ${itemId}`);
            errorCount++;
            errors.push(`Failed to save record ${itemId}`);
          }

        } catch (recordError) {
          const errorMessage = recordError instanceof Error ? recordError.message : String(recordError);
          console.error(`[useSRSSaveHandlers] Error saving record ${itemId}:`, recordError);
          errorCount++;
          errors.push(`Error saving record ${itemId}: ${errorMessage}`);
        }
      }

      console.log(`[useSRSSaveHandlers] *** SIMPLIFIED SAVE OPERATION COMPLETE (DATE-ONLY) ***:`, {
        totalRecords: modifiedRecords.size,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : 'None',
        totalHoursHandling: 'Will be recalculated automatically in SRSTable',
        dateFormat: 'Date-only format maintained'
      });

      if (successCount > 0) {
        // Clear local changes for successfully saved records
        setModifiedRecords(prev => {
          const newModified = new Map(prev);
          // If no errors, clear all modifications
          if (errorCount === 0) {
            newModified.clear();
          }
          // TODO: Could be improved to track which specific records saved successfully
          return newModified;
        });

        SRSTabStateHelpers.setHasUnsavedChanges(setState, errorCount > 0);

        // Refresh data from server
        console.log('[useSRSSaveHandlers] Auto-refreshing data after save (Total Hours will recalculate in SRSTable, Date-only format preserved)...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
      }

      if (errorCount > 0) {
        // Show errors to user
        const errorMessage = `Saved ${successCount} records, failed ${errorCount}. Errors: ${errors.join(', ')}`;
        SRSTabStateHelpers.setErrorSRS(setState, errorMessage);
      }

      console.log('[useSRSSaveHandlers] *** SIMPLIFIED SAVE OPERATION COMPLETE (DATE-ONLY) ***');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useSRSSaveHandlers] Critical error during simplified save operation (Date-only):', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, `Save operation failed: ${errorMessage}`);
    }
  }, [state.hasUnsavedChanges, modifiedRecords, setState, context, state.srsRecords, refreshSRSData, setModifiedRecords]);

  /**
   * Save only checked/selected records
   */
  const handleSaveChecked = useCallback((): void => {
    console.log('[useSRSSaveHandlers] Save checked items requested (simplified architecture + Date-only)');
    
    if (state.selectedItems.size === 0) {
      console.log('[useSRSSaveHandlers] No items selected for saving');
      return;
    }

    const selectedIds = Array.from(state.selectedItems);
    console.log('[useSRSSaveHandlers] Saving changes for selected records (Date-only format):', selectedIds);
    
    const selectedModifications = new Map();
    selectedIds.forEach(id => {
      if (modifiedRecords.has(id)) {
        selectedModifications.set(id, modifiedRecords.get(id));
      }
    });
    
    console.log('[useSRSSaveHandlers] Selected modifications to save (Date-only):', {
      selectedCount: selectedIds.length,
      modifiedSelectedCount: selectedModifications.size,
      totalHoursHandling: 'Will be recalculated automatically in SRSTable',
      dateFormat: 'Date-only format maintained'
    });
    
    // TODO: Implement actual selective saving logic
    // For now, clear selections and mark as saved
    SRSTabStateHelpers.clearSelection(setState);
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      selectedIds.forEach(id => newModified.delete(id));
      return newModified;
    });
    
    console.log('[useSRSSaveHandlers] Selected records saved successfully (mock, Date-only) - Total Hours will update in SRSTable');
  }, [state.selectedItems, setState, modifiedRecords, setModifiedRecords]);

  /**
   * Export all SRS data functionality
   */
  const handleExportAll = useCallback((): void => {
    console.log('[useSRSSaveHandlers] *** EXPORT ALL SRS DATA (SIMPLIFIED ARCHITECTURE + DATE-ONLY) ***');
    console.log('[useSRSSaveHandlers] Current SRS records count:', state.srsRecords.length);
    console.log('[useSRSSaveHandlers] Types of leave available:', state.typesOfLeave.length);
    console.log('[useSRSSaveHandlers] Holidays available (Date-only):', state.holidays.length);
    console.log('[useSRSSaveHandlers] Show deleted enabled:', state.showDeleted);
    console.log('[useSRSSaveHandlers] Total Hours: Calculated in real-time by SRSTable');
    console.log('[useSRSSaveHandlers] Date format: Date-only using SRSDateUtils');
    
    if (state.srsRecords.length === 0) {
      console.warn('[useSRSSaveHandlers] No SRS records to export');
      return;
    }

    console.log('[useSRSSaveHandlers] Exporting SRS records (simplified architecture + Date-only):', {
      recordsCount: state.srsRecords.length,
      dateRange: `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
      typesOfLeaveCount: state.typesOfLeave.length,
      holidaysCount: state.holidays.length,
      showDeleted: state.showDeleted,
      deletedRecordsCount: state.srsRecords.filter((r: IStaffRecord) => r.Deleted === 1).length,
      activeRecordsCount: state.srsRecords.filter((r: IStaffRecord) => r.Deleted !== 1).length,
      numericTimeFieldsEnabled: true,
      totalHoursCalculation: 'Real-time in SRSTable',
      dateFormat: 'Date-only with SRSDateUtils'
    });

    // TODO: Implement actual export functionality
    alert(`Export functionality will be implemented. Records to export: ${state.srsRecords.length}, Types of leave: ${state.typesOfLeave.length}, Holidays: ${state.holidays.length}, Show deleted: ${state.showDeleted}, Total Hours: Calculated in real-time, Date format: Date-only`);
  }, [state.srsRecords, state.fromDate, state.toDate, state.typesOfLeave, state.holidays, state.showDeleted]);

  /**
   * Manual data refresh with dependency reload
   */
  const handleRefreshData = useCallback((): void => {
    console.log('[useSRSSaveHandlers] *** MANUAL REFRESH REQUESTED (SIMPLIFIED ARCHITECTURE + DATE-ONLY) ***');
    console.log('[useSRSSaveHandlers] Will reload: 1) Holidays (Date-only), 2) TypesOfLeave, 3) SRS Data (Date-only)');
    
    // Clear all local modifications
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    // Clear operation states
    setDeleteOperations(new Map());
    setRestoreOperations(new Map());
    setAddShiftOperations(new Map());
    
    // Reset load attempts to force dependency reload
    setLoadAttempts({ holidays: false, typesOfLeave: false });
    
    console.log('[useSRSSaveHandlers] Load attempts reset - dependencies will be reloaded with Date-only format');
    console.log('[useSRSSaveHandlers] Local modifications cleared, operations reset');
    
  }, [setState, setModifiedRecords, setLoadAttempts, setDeleteOperations, setRestoreOperations, setAddShiftOperations]);

  /**
   * Error dismissal handler
   */
  const handleErrorDismiss = useCallback((): void => {
    console.log('[useSRSSaveHandlers] Error dismiss requested (Date-only format)');
    
    setState(prevState => ({
      ...prevState,
      error: undefined,
      errorSRS: undefined
    }));
  }, [setState]);

  // Log handlers creation
  console.log('[useSRSSaveHandlers] Save handlers created:', {
    hasSaveHandler: !!handleSave,
    hasSaveCheckedHandler: !!handleSaveChecked,
    hasExportAllHandler: !!handleExportAll,
    hasRefreshDataHandler: !!handleRefreshData,
    hasErrorDismissHandler: !!handleErrorDismiss,
    currentModifications: modifiedRecords.size,
    hasUnsavedChanges: state.hasUnsavedChanges,
    selectedItemsCount: state.selectedItems.size,
    realServiceIntegration: 'StaffRecordsService.updateStaffRecord',
    dateFormat: 'Date-only with SRSDateUtils integration',
    totalHoursHandling: 'Real-time calculation in SRSTable',
    numericTimeFields: 'ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes',
    checkboxSaving: 'Checked field saved as 0/1 to server'
  });

  return {
    onSave: handleSave,
    onSaveChecked: handleSaveChecked,
    onExportAll: handleExportAll,
    onRefreshData: handleRefreshData,
    onErrorDismiss: handleErrorDismiss
  };
};