// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/handlers/useSRSSaveHandlers.ts

import { useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../../services/StaffRecordsService';
import { ISRSRecord } from '../SRSTabInterfaces';
import { ISRSTabState, SRSTabStateHelpers } from '../useSRSTabState';
import { SRSDateUtils } from '../SRSDateUtils';
import { SRSDataMapper } from '../SRSDataMapper';

// *** NEW: Import SRS export functionality ***
import { handleSRSButtonClick } from '../SRSButtonHandler';

/**
 * Interface for save handlers return type
 */
export interface UseSRSSaveHandlersReturn {
  onSave: () => Promise<void>;
  onSaveChecked: () => void;
  onExportAll: () => Promise<void>; // *** UPDATED: Now async for real export ***
  onRefreshData: () => void;
  onErrorDismiss: () => void;
}

/**
 * Interface for save handlers parameters
 */
interface UseSRSSaveHandlersParams {
  context?: WebPartContext;
  selectedStaff?: {
    id: string;
    name: string;
    employeeId: string;
    pathForSRSFile?: string;
    typeOfSRS?: number;
  };
  currentUserId?: string;
  managingGroupId?: string;
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
 * *** UPDATED: Now includes real "Export All SRS" functionality ***
 * 
 * Responsibilities:
 * - Save all modified records to server with numeric time fields
 * - Save only checked/selected records  
 * - *** NEW: Export all checked SRS records to Excel ***
 * - Manual data refresh with dependency reload
 * - Error dismissal
 */
export const useSRSSaveHandlers = (params: UseSRSSaveHandlersParams): UseSRSSaveHandlersReturn => {
  const {
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
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

  console.log('[useSRSSaveHandlers] Hook initialized with REAL Export All SRS functionality:', {
    hasContext: !!context,
    hasSelectedStaff: !!selectedStaff,
    selectedStaffName: selectedStaff?.name,
    selectedStaffPathForSRSFile: selectedStaff?.pathForSRSFile,
    modifiedRecordsCount: modifiedRecords.size,
    hasUnsavedChanges: state.hasUnsavedChanges,
    selectedItemsCount: state.selectedItems.size,
    totalRecords: state.srsRecords.length,
    checkedRecords: state.srsRecords.filter((r: IStaffRecord) => r.Checked === 1).length,
    saveIntegration: 'StaffRecordsService.updateStaffRecord with numeric time fields',
    exportAllIntegration: 'SRSButtonHandler for bulk checked records export', // *** NEW ***
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
   * *** NEW: REAL Export All Checked SRS Records to Excel ***
   * This replaces the mock export functionality with real Excel export
   */
  const handleExportAll = useCallback(async (): Promise<void> => {
    console.log('[useSRSSaveHandlers] *** REAL EXPORT ALL CHECKED SRS RECORDS TO EXCEL ***');

    // Validate required parameters
    if (!context) {
      console.error('[useSRSSaveHandlers] Context is not available for export all operation');
      SRSTabStateHelpers.setSRSErrorMessage(setState, 'Context not available for export operation');
      return;
    }

    if (!selectedStaff) {
      console.error('[useSRSSaveHandlers] Selected staff is not available for export all operation');
      SRSTabStateHelpers.setSRSErrorMessage(setState, 'Staff member not selected for export operation');
      return;
    }

    if (!selectedStaff.pathForSRSFile) {
      console.error('[useSRSSaveHandlers] Excel file path not configured for staff member');
      SRSTabStateHelpers.setSRSErrorMessage(setState, 'Excel file path not configured for this staff member', [
        `Staff member: ${selectedStaff.name}`,
        'Please contact administrator to configure SRS Excel file path'
      ]);
      return;
    }

    if (!currentUserId || currentUserId === '0') {
      console.error('[useSRSSaveHandlers] Current user ID not available for export all operation');
      SRSTabStateHelpers.setSRSErrorMessage(setState, 'User authentication required for export operation');
      return;
    }

    if (!managingGroupId || managingGroupId === '0') {
      console.error('[useSRSSaveHandlers] Managing group ID not available for export all operation');
      SRSTabStateHelpers.setSRSErrorMessage(setState, 'Managing group access required for export operation');
      return;
    }

    // Find all checked records
    const checkedStaffRecords = state.srsRecords.filter((record: IStaffRecord) => {
      return record.Checked === 1 && record.Deleted !== 1; // Checked and not deleted
    });

    console.log('[useSRSSaveHandlers] Checked records analysis:', {
      totalRecords: state.srsRecords.length,
      checkedRecords: checkedStaffRecords.length,
      deletedRecords: state.srsRecords.filter((r: IStaffRecord) => r.Deleted === 1).length,
      checkedAndActiveRecords: checkedStaffRecords.length,
      dateRange: `${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
      staffName: selectedStaff.name,
      excelFilePath: selectedStaff.pathForSRSFile
    });

    // Check if there are any checked records
    if (checkedStaffRecords.length === 0) {
      console.warn('[useSRSSaveHandlers] No checked records found for export');
      SRSTabStateHelpers.setSRSWarningMessage(setState, 'No checked records found for export', [
        'Please check at least one record before clicking "Export all SRS"',
        'Only checked (✓) records will be exported to Excel',
        `Total records available: ${state.srsRecords.length}`,
        `Date range: ${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
        'Use the checkboxes in the "Check" column to select records for export'
      ]);
      return;
    }

    try {
      console.log('[useSRSSaveHandlers] *** STARTING BULK SRS EXPORT PROCESS ***');

      // Clear any existing messages
      SRSTabStateHelpers.clearSRSMessage(setState);

      // Convert IStaffRecord[] to ISRSRecord[] using SRSDataMapper
      const srsRecordsForExport: ISRSRecord[] = SRSDataMapper.mapStaffRecordsToSRSRecords(checkedStaffRecords);

      console.log('[useSRSSaveHandlers] Converted staff records to SRS records for export:', {
        originalCount: checkedStaffRecords.length,
        convertedCount: srsRecordsForExport.length,
        dateFormat: 'Date-only using SRSDataMapper'
      });

      // Group records by date for processing
      const recordsByDate = new Map<string, ISRSRecord[]>();

      srsRecordsForExport.forEach(record => {
        const dateKey = SRSDateUtils.formatDateForDisplay(record.date);
        if (!recordsByDate.has(dateKey)) {
          recordsByDate.set(dateKey, []);
        }
        recordsByDate.get(dateKey)!.push(record);
      });

      console.log('[useSRSSaveHandlers] Records grouped by date for export:', {
        totalDates: recordsByDate.size,
        datesWithRecords: Array.from(recordsByDate.keys()),
        recordsPerDate: Array.from(recordsByDate.entries()).map(([date, records]) => ({
          date,
          count: records.length
        }))
      });

      // Process each date group using the existing SRS export functionality
      let totalExported = 0;
      let totalFailed = 0;
      const exportResults: Array<{ date: string; success: boolean; error?: string; recordsCount: number }> = [];

      // Convert Map entries to array for ES5 compatibility
      const dateGroupsArray = Array.from(recordsByDate.entries());
      
      for (let i = 0; i < dateGroupsArray.length; i++) {
        const [dateKey, dateRecords] = dateGroupsArray[i];
        try {
          console.log(`[useSRSSaveHandlers] *** EXPORTING ${dateRecords.length} RECORDS FOR DATE ${dateKey} ***`);

          // Get the first record's date for this group
          const targetDate = dateRecords[0].date;

          // Use the existing SRS export handler for this date group
          const exportResult = await handleSRSButtonClick({
            item: dateRecords[0], // Use first record as the "trigger" item
            context,
            selectedStaff: {
              id: selectedStaff.id,
              name: selectedStaff.name,
              employeeId: selectedStaff.employeeId,
              pathForSRSFile: selectedStaff.pathForSRSFile,
              typeOfSRS: selectedStaff.typeOfSRS || 2
            },
            currentUserId,
            managingGroupId,
            state: {
              ...state,
              // Override srsRecords to only include the checked records for this date
              srsRecords: checkedStaffRecords.filter((record: IStaffRecord) => {
                const recordDate = SRSDateUtils.normalizeDateToLocalMidnight(record.Date);
                return SRSDateUtils.areDatesEqual(recordDate, targetDate) && record.Checked === 1;
              })
            },
            holidays: state.holidays,
            typesOfLeave: state.typesOfLeave,
            refreshSRSData,
            setState: setState as (updater: (prev: ISRSTabState) => ISRSTabState) => void
          });

          if (exportResult.success) {
            console.log(`[useSRSSaveHandlers] ✓ Export successful for date ${dateKey}: ${dateRecords.length} records`);
            totalExported += dateRecords.length;
            exportResults.push({
              date: dateKey,
              success: true,
              recordsCount: dateRecords.length
            });
          } else {
            console.error(`[useSRSSaveHandlers] ✗ Export failed for date ${dateKey}: ${exportResult.error}`);
            totalFailed += dateRecords.length;
            exportResults.push({
              date: dateKey,
              success: false,
              error: exportResult.error,
              recordsCount: dateRecords.length
            });
          }

        } catch (dateExportError) {
          const errorMsg = dateExportError instanceof Error ? dateExportError.message : String(dateExportError);
          console.error(`[useSRSSaveHandlers] Critical error exporting date ${dateKey}:`, dateExportError);
          totalFailed += dateRecords.length;
          exportResults.push({
            date: dateKey,
            success: false,
            error: errorMsg,
            recordsCount: dateRecords.length
          });
        }
      }

      console.log('[useSRSSaveHandlers] *** BULK SRS EXPORT PROCESS COMPLETED ***');
      console.log('[useSRSSaveHandlers] Final export results:', {
        totalRecordsAttempted: srsRecordsForExport.length,
        totalExported,
        totalFailed,
        successfulDates: exportResults.filter(r => r.success).length,
        failedDates: exportResults.filter(r => !r.success).length,
        exportResults
      });

      // Show appropriate success/error message
      if (totalFailed === 0) {
        // Complete success
        SRSTabStateHelpers.setSRSSuccessMessage(setState, `Successfully exported all ${totalExported} checked records to Excel`, [
          `Records exported: ${totalExported}`,
          `Dates processed: ${recordsByDate.size}`,
          `Staff member: ${selectedStaff.name}`,
          `Excel file: ${selectedStaff.pathForSRSFile}`,
          `Date range: ${SRSDateUtils.formatDateForDisplay(state.fromDate)} - ${SRSDateUtils.formatDateForDisplay(state.toDate)}`,
          'All records have been marked as exported in the system'
        ]);
      } else if (totalExported === 0) {
        // Complete failure
        const failedDatesInfo = exportResults
          .filter(r => !r.success)
          .map(r => `${r.date}: ${r.error}`)
          .join('; ');

        SRSTabStateHelpers.setSRSErrorMessage(setState, `Failed to export all ${totalFailed} checked records`, [
          `Records failed: ${totalFailed}`,
          `Dates failed: ${exportResults.filter(r => !r.success).length}`,
          `Errors: ${failedDatesInfo}`,
          `Staff member: ${selectedStaff.name}`,
          `Excel file: ${selectedStaff.pathForSRSFile}`,
          'Please check the errors above and try again'
        ]);
      } else {
        // Partial success
        const successfulDatesInfo = exportResults
          .filter(r => r.success)
          .map(r => `${r.date} (${r.recordsCount} records)`)
          .join(', ');

        const failedDatesInfo = exportResults
          .filter(r => !r.success)
          .map(r => `${r.date}: ${r.error}`)
          .join('; ');

        SRSTabStateHelpers.setSRSWarningMessage(setState, `Partially exported checked records: ${totalExported} successful, ${totalFailed} failed`, [
          `Successfully exported: ${totalExported} records`,
          `Failed to export: ${totalFailed} records`,
          `Successful dates: ${successfulDatesInfo}`,
          `Failed dates: ${failedDatesInfo}`,
          `Staff member: ${selectedStaff.name}`,
          'Successfully exported records have been marked in the system'
        ]);
      }

      // Refresh data to show updated export statuses
      console.log('[useSRSSaveHandlers] Auto-refreshing data after bulk export...');
      setTimeout(() => {
        void refreshSRSData();
      }, 1000); // Longer delay for bulk operations

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[useSRSSaveHandlers] Critical error during export all operation:', error);
      
      SRSTabStateHelpers.setSRSErrorMessage(setState, `Bulk export failed: ${errorMessage}`, [
        `Records attempted: ${checkedStaffRecords.length}`,
        `Staff member: ${selectedStaff.name}`,
        `Excel file: ${selectedStaff.pathForSRSFile || 'Not configured'}`,
        `Error: ${errorMessage}`,
        'Please check the error details and try again'
      ]);
    }

  }, [
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    state,
    setState,
    refreshSRSData
  ]);

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
  console.log('[useSRSSaveHandlers] Save handlers created with REAL Export All functionality:', {
    hasSaveHandler: !!handleSave,
    hasSaveCheckedHandler: !!handleSaveChecked,
    hasExportAllHandler: !!handleExportAll, // *** UPDATED: Now real export ***
    hasRefreshDataHandler: !!handleRefreshData,
    hasErrorDismissHandler: !!handleErrorDismiss,
    currentModifications: modifiedRecords.size,
    hasUnsavedChanges: state.hasUnsavedChanges,
    selectedItemsCount: state.selectedItems.size,
    checkedRecordsCount: state.srsRecords.filter((r: IStaffRecord) => r.Checked === 1).length,
    realServiceIntegration: 'StaffRecordsService.updateStaffRecord',
    realExportIntegration: 'SRSButtonHandler for bulk checked records', // *** NEW ***
    dateFormat: 'Date-only with SRSDateUtils integration',
    totalHoursHandling: 'Real-time calculation in SRSTable',
    numericTimeFields: 'ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes',
    checkboxSaving: 'Checked field saved as 0/1 to server',
    exportAllFeature: 'Processes all checked records grouped by date' // *** NEW ***
  });

  return {
    onSave: handleSave,
    onSaveChecked: handleSaveChecked,
    onExportAll: handleExportAll, // *** UPDATED: Now async and real ***
    onRefreshData: handleRefreshData,
    onErrorDismiss: handleErrorDismiss
  };
};