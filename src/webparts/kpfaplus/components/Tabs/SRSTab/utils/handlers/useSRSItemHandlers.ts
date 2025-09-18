// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/handlers/useSRSItemHandlers.ts

import { useCallback } from 'react';
import { ISRSRecord } from '../SRSTabInterfaces';
import { ISRSTabState, SRSTabStateHelpers } from '../useSRSTabState';
import { IStaffRecord } from '../../../../../services/StaffRecordsService';

/**
 * Interface for item handlers return type
 */
export interface UseSRSItemHandlersReturn {
  onItemChange: (item: ISRSRecord, field: string, value: string | boolean | { hours: string; minutes: string }) => void;
  onLunchTimeChange: (item: ISRSRecord, value: string) => void;
  onContractNumberChange: (item: ISRSRecord, value: string) => void;
  onTypeOfLeaveChange: (item: ISRSRecord, value: string) => void;
  onItemCheckboxChange: (item: ISRSRecord, checked: boolean) => void;
}

/**
 * Interface for item handlers parameters
 */
interface UseSRSItemHandlersParams {
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
  modifiedRecords: Map<string, Partial<ISRSRecord>>;
  setModifiedRecords: React.Dispatch<React.SetStateAction<Map<string, Partial<ISRSRecord>>>>;
}

/**
 * Custom hook for handling item changes in SRS Tab
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Handle all item field changes (time, lunch, contract, type of leave)
 * - Handle checkbox state changes with immediate UI update
 * - Track local modifications for batch saving
 * - Maintain unsaved changes state
 * - Real-time Total Hours calculation (delegated to SRSTable)
 */
export const useSRSItemHandlers = (params: UseSRSItemHandlersParams): UseSRSItemHandlersReturn => {
  const { state, setState, modifiedRecords, setModifiedRecords } = params;

  console.log('[useSRSItemHandlers] Hook initialized with simplified architecture:', {
    totalHoursCalculation: 'Real-time in SRSTable (not in state)',
    modifiedRecordsCount: modifiedRecords.size,
    hasUnsavedChanges: state.hasUnsavedChanges,
    checkboxSupport: 'Immediate UI update + local tracking',
    dateFormat: 'Date-only (item date operations use SRSDateUtils in other components)',
    simplifiedLogic: 'No totalHours recalculation in handlers'
  });

  /**
   * Generic item change handler - simplified without totalHours recalculation
   * Total Hours now calculated in real-time by SRSTable
   */
  const handleItemChange = useCallback((
    item: ISRSRecord, 
    field: string, 
    value: string | boolean | { hours: string; minutes: string }
  ): void => {
    console.log('[useSRSItemHandlers] *** SIMPLIFIED ITEM CHANGE (NO TOTAL HOURS RECALC) ***');
    console.log('[useSRSItemHandlers] Item ID:', item.id);
    console.log('[useSRSItemHandlers] Field:', field);
    console.log('[useSRSItemHandlers] Value:', value);
    console.log('[useSRSItemHandlers] Total Hours will be recalculated in SRSTable automatically');
    
    // Save changes in local state for batch saving
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      
      const newModifications: Record<string, unknown> = { ...existingModifications };
      
      // Handle different field types
      if (field === 'startWork') {
        newModifications.startWork = value;
      } else if (field === 'finishWork') {
        newModifications.finishWork = value;
      } else if (field === 'workingHours') {
        newModifications.hours = value as string;
      } else if (field === 'relief') {
        newModifications.relief = value as boolean;
        console.log('[useSRSItemHandlers] Saved relief change (no time recalculation here)');
      } else if (field === 'typeOfLeave') {
        newModifications.typeOfLeave = value as string;
        console.log('[useSRSItemHandlers] Saved typeOfLeave change:', value);
      } else if (field === 'timeLeave') {
        newModifications.timeLeave = value as string;
      } else {
        newModifications[field] = value;
      }
      
      newModified.set(item.id, newModifications);
      return newModified;
    });
    
    // Mark as having unsaved changes
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSItemHandlers] *** SIMPLIFIED ITEM CHANGE COMPLETE ***');
    console.log('[useSRSItemHandlers] Modified records count:', modifiedRecords.size + 1);
  }, [setState, modifiedRecords.size, setModifiedRecords]);

  /**
   * Type of leave change handler - delegates to generic handler
   */
  const handleTypeOfLeaveChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSItemHandlers] *** HANDLE TYPE OF LEAVE CHANGE (SIMPLIFIED) ***');
    console.log('[useSRSItemHandlers] Item ID:', item.id);
    console.log('[useSRSItemHandlers] New type of leave:', value);
    
    // Delegate to generic item change handler
    handleItemChange(item, 'typeOfLeave', value);
    
    console.log('[useSRSItemHandlers] Type of leave change delegated to simplified handleItemChange');
  }, [handleItemChange]);

  /**
   * Lunch time change handler - simplified without totalHours recalculation
   */
  const handleLunchTimeChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSItemHandlers] *** SIMPLIFIED LUNCH TIME CHANGE ***');
    console.log('[useSRSItemHandlers] handleLunchTimeChange:', { itemId: item.id, value });
    console.log('[useSRSItemHandlers] Total Hours will be recalculated in SRSTable automatically');
    
    // Save only lunch time change in local state
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      newModified.set(item.id, {
        ...existingModifications,
        lunch: value
      });
      return newModified;
    });
    
    // Mark as having unsaved changes
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSItemHandlers] Simplified lunch time change applied to local state only');
  }, [setState, setModifiedRecords]);

  /**
   * Contract number change handler
   */
  const handleContractNumberChange = useCallback((item: ISRSRecord, value: string): void => {
    console.log('[useSRSItemHandlers] handleContractNumberChange:', { itemId: item.id, value });
    
    // Save contract change in local state
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      newModified.set(item.id, {
        ...existingModifications,
        contract: value
      });
      return newModified;
    });
    
    // Mark as having unsaved changes
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSItemHandlers] Contract number change applied to local state');
  }, [setState, setModifiedRecords]);

  /**
   * Checkbox change handler with immediate UI update
   * KEY FEATURE: Updates main state immediately for UI responsiveness
   */
  const handleItemCheckboxChange = useCallback((item: ISRSRecord, checked: boolean): void => {
    console.log('[useSRSItemHandlers] *** CHECKBOX CHANGE WITH IMMEDIATE UI UPDATE ***');
    console.log('[useSRSItemHandlers] Item ID:', item.id, 'New checked value:', checked);
    
    // CRITICAL: Update main state immediately for UI responsiveness
    // This ensures the checkbox reflects the new state instantly
    setState(prevState => {
      // Create new array of srsRecords to trigger React re-render
      const newSrsRecords = prevState.srsRecords.map((record: IStaffRecord) => {
        // Find the matching record by ID
        if (record.ID === item.id) {
          // Return new object with updated Checked field
          return {
            ...record,
            Checked: checked ? 1 : 0 // Convert boolean to number for IStaffRecord
          };
        }
        // Return other records unchanged
        return record;
      });

      // Return new state with updated records array
      return {
        ...prevState,
        srsRecords: newSrsRecords
      };
    });

    // ALSO: Save change in modifiedRecords for server update
    setModifiedRecords(prev => {
      const newModified = new Map(prev);
      const existingModifications = newModified.get(item.id) || {};
      // Save as boolean for ISRSRecord compatibility
      newModified.set(item.id, {
        ...existingModifications,
        checked: checked
      });
      return newModified;
    });
    
    // Mark as having unsaved changes
    SRSTabStateHelpers.setHasUnsavedChanges(setState, true);
    
    console.log('[useSRSItemHandlers] Checkbox change applied to main state (for UI) and marked for saving');
  }, [setState, setModifiedRecords]);

  // Log handlers creation
  console.log('[useSRSItemHandlers] Item handlers created:', {
    hasItemChangeHandler: !!handleItemChange,
    hasTypeOfLeaveHandler: !!handleTypeOfLeaveChange,
    hasLunchTimeHandler: !!handleLunchTimeChange,
    hasContractNumberHandler: !!handleContractNumberChange,
    hasCheckboxHandler: !!handleItemCheckboxChange,
    currentModifications: modifiedRecords.size,
    hasUnsavedChanges: state.hasUnsavedChanges,
    totalHoursHandling: 'Real-time calculation in SRSTable',
    checkboxFeature: 'Immediate UI update + local tracking for save',
    simplifiedArchitecture: 'No complex recalculations in handlers',
    localStateTracking: 'All changes tracked for batch saving'
  });

  return {
    onItemChange: handleItemChange,
    onLunchTimeChange: handleLunchTimeChange,
    onContractNumberChange: handleContractNumberChange,
    onTypeOfLeaveChange: handleTypeOfLeaveChange,
    onItemCheckboxChange: handleItemCheckboxChange
  };
};