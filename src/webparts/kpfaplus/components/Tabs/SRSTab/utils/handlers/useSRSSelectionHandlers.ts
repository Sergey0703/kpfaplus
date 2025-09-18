// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/handlers/useSRSSelectionHandlers.ts

import { useCallback } from 'react';
import { ISRSTabState, SRSTabStateHelpers } from '../useSRSTabState';

/**
 * Interface for selection handlers return type
 */
export interface UseSRSSelectionHandlersReturn {
  onItemCheck: (itemId: string, checked: boolean) => void;
  onSelectAll: (checked: boolean) => void;
}

/**
 * Interface for selection handlers parameters
 */
interface UseSRSSelectionHandlersParams {
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
}

/**
 * Custom hook for handling item selection operations in SRS Tab
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Handle individual item check/uncheck for mass operations
 * - Handle select all/deselect all operations
 * - Maintain selection state consistency
 * - Trigger unsaved changes when selections are made
 * 
 * Note: This is different from checkbox functionality in useSRSItemHandlers
 * - useSRSItemHandlers.onItemCheckboxChange: Updates actual record data (Checked field)
 * - useSRSSelectionHandlers.onItemCheck: Updates UI selection state for mass operations
 */
export const useSRSSelectionHandlers = (params: UseSRSSelectionHandlersParams): UseSRSSelectionHandlersReturn => {
  const { state, setState } = params;

  console.log('[useSRSSelectionHandlers] Hook initialized for mass operation selections:', {
    currentSelectedCount: state.selectedItems.size,
    totalRecords: state.srsRecords.length,
    hasUnsavedChanges: state.hasUnsavedChanges,
    selectionPurpose: 'Mass operations (export, bulk save, etc.)',
    differenceFromCheckbox: 'This handles UI selection state, not record data',
    checkboxHandling: 'Record data checkboxes handled in useSRSItemHandlers'
  });

  /**
   * Handle individual item selection for mass operations
   * This toggles the selection state in selectedItems Set
   */
  const handleItemCheck = useCallback((itemId: string, checked: boolean): void => {
    console.log('[useSRSSelectionHandlers] Item selection changed for mass operations:', { 
      itemId, 
      checked,
      purpose: 'Mass operation selection (not record data checkbox)'
    });
    
    // Toggle selection in selectedItems Set
    SRSTabStateHelpers.toggleItemSelection(setState, itemId);
    
    // Mark as having unsaved changes if not already marked
    if (!state.hasUnsavedChanges) {
      SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    }

    console.log('[useSRSSelectionHandlers] Selection state updated:', {
      itemId,
      newSelectionState: checked ? 'selected' : 'deselected',
      totalSelectedAfter: checked 
        ? state.selectedItems.size + (state.selectedItems.has(itemId) ? 0 : 1)
        : state.selectedItems.size - (state.selectedItems.has(itemId) ? 1 : 0),
      purpose: 'For mass operations like export or bulk save'
    });
  }, [setState, state.hasUnsavedChanges, state.selectedItems]);

  /**
   * Handle select all / deselect all operations
   * This affects all records in the current view
   */
  const handleSelectAll = useCallback((checked: boolean): void => {
    console.log('[useSRSSelectionHandlers] Select all changed for mass operations:', {
      checked,
      currentSelectedCount: state.selectedItems.size,
      totalRecords: state.srsRecords.length,
      purpose: 'Mass operation selection (not record data checkboxes)'
    });
    
    if (checked) {
      // Select all records
      SRSTabStateHelpers.selectAll(setState);
      console.log('[useSRSSelectionHandlers] All records selected for mass operations:', {
        recordsSelected: state.srsRecords.length,
        includesDeleted: state.showDeleted ? 'Yes (if showDeleted=true)' : 'No (only active records)',
        purpose: 'Mass operations like export or bulk save'
      });
    } else {
      // Deselect all records
      SRSTabStateHelpers.clearSelection(setState);
      console.log('[useSRSSelectionHandlers] All records deselected from mass operations');
    }

    // Mark as having changes when selection state changes
    if (!state.hasUnsavedChanges && state.srsRecords.length > 0) {
      SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
      console.log('[useSRSSelectionHandlers] Marked as having unsaved changes due to selection change');
    }
  }, [setState, state.selectedItems.size, state.srsRecords.length, state.showDeleted, state.hasUnsavedChanges]);

  // Log handlers creation with current selection state
  console.log('[useSRSSelectionHandlers] Selection handlers created:', {
    hasItemCheckHandler: !!handleItemCheck,
    hasSelectAllHandler: !!handleSelectAll,
    currentSelectionState: {
      selectedCount: state.selectedItems.size,
      selectedIds: Array.from(state.selectedItems).slice(0, 5), // Show first 5 IDs
      totalRecords: state.srsRecords.length,
      selectionPercentage: state.srsRecords.length > 0 
        ? Math.round((state.selectedItems.size / state.srsRecords.length) * 100)
        : 0
    },
    handlerPurpose: 'Mass operations (export, bulk save, bulk actions)',
    distinctFromCheckbox: {
      thisHandler: 'UI selection state for mass operations',
      checkboxHandler: 'Record data checkbox values (Checked field)',
      bothCanCoexist: true,
      differentStates: 'selectedItems Set vs Checked field in records'
    },
    integrationNote: 'Works with save handlers for bulk operations'
  });

  return {
    onItemCheck: handleItemCheck,
    onSelectAll: handleSelectAll
  };
};