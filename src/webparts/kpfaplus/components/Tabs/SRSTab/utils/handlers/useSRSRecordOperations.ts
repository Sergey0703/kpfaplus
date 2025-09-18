// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/handlers/useSRSRecordOperations.ts

import { useCallback, useState } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { StaffRecordsService, IStaffRecord } from '../../../../../services/StaffRecordsService';
import { ISRSTabState, SRSTabStateHelpers } from '../useSRSTabState';
import { SRSDateUtils } from '../SRSDateUtils';

/**
 * Interface for new SRS shift data
 */
export interface INewSRSShiftData {
  date: Date;
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  Holiday?: number; // Always 0 - holidays determined from holidays list
  // Numeric time fields for StaffRecordsService
  ShiftDate1Hours?: number;
  ShiftDate1Minutes?: number;
  ShiftDate2Hours?: number;
  ShiftDate2Minutes?: number;
}

/**
 * Interface for record operations return type
 */
export interface UseSRSRecordOperationsReturn {
  onDeleteRecord: (recordId: string) => Promise<boolean>;
  onRestoreRecord: (recordId: string) => Promise<boolean>;
  onAddShift: (date: Date, shiftData?: INewSRSShiftData) => Promise<boolean>;
  onToggleShowDeleted: (checked: boolean) => void;
  // Expose operation states for UI feedback
  deleteOperations: Map<string, boolean>;
  restoreOperations: Map<string, boolean>;
  addShiftOperations: Map<string, boolean>;
}

/**
 * Interface for record operations parameters
 */
interface UseSRSRecordOperationsParams {
  context?: WebPartContext;
  selectedStaff?: {
    id: string;
    name: string;
    employeeId: string;
  };
  currentUserId?: string;
  managingGroupId?: string;
  state: ISRSTabState;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
  refreshSRSData: () => Promise<void>;
  setModifiedRecords: React.Dispatch<React.SetStateAction<Map<string, Partial<any>>>>;
}

/**
 * Custom hook for handling record operations (delete, restore, add shift, toggle deleted)
 * Extracted from useSRSTabLogic.ts for better separation of concerns
 * 
 * Responsibilities:
 * - Real delete operations via StaffRecordsService.markRecordAsDeleted
 * - Real restore operations via StaffRecordsService.restoreDeletedRecord
 * - Real add shift operations via StaffRecordsService.createStaffRecord
 * - Toggle showDeleted flag with automatic data reload
 * - Track ongoing operations to prevent duplicates
 */
export const useSRSRecordOperations = (params: UseSRSRecordOperationsParams): UseSRSRecordOperationsReturn => {
  const {
    context,
    selectedStaff,
    currentUserId,
    managingGroupId,
    state,
    setState,
    refreshSRSData,
    setModifiedRecords
  } = params;

  // Local state for tracking ongoing operations
  const [deleteOperations, setDeleteOperations] = useState<Map<string, boolean>>(new Map());
  const [restoreOperations, setRestoreOperations] = useState<Map<string, boolean>>(new Map());
  const [addShiftOperations, setAddShiftOperations] = useState<Map<string, boolean>>(new Map());

  console.log('[useSRSRecordOperations] Hook initialized with REAL StaffRecordsService integration:', {
    hasContext: !!context,
    hasSelectedStaff: !!selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    deleteSupport: 'StaffRecordsService.markRecordAsDeleted',
    restoreSupport: 'StaffRecordsService.restoreDeletedRecord',
    addShiftSupport: 'StaffRecordsService.createStaffRecord with numeric time fields',
    showDeletedSupport: true,
    dateFormat: 'Date-only using SRSDateUtils',
    operationTracking: 'Prevents duplicate operations'
  });

  /**
   * REAL DELETE: Marks record as deleted via StaffRecordsService
   */
  const handleDeleteRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[useSRSRecordOperations] *** REAL DELETE RECORD OPERATION STARTED ***');
    console.log('[useSRSRecordOperations] Record ID to delete:', recordId);
    
    if (!context) {
      console.error('[useSRSRecordOperations] Context is not available for delete operation');
      return false;
    }

    if (deleteOperations.get(recordId)) {
      console.warn('[useSRSRecordOperations] Delete operation already in progress for this record');
      return false;
    }

    try {
      setDeleteOperations(prev => new Map(prev.set(recordId, true)));
      
      console.log('[useSRSRecordOperations] Starting REAL delete operation using StaffRecordsService...');
      
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      console.log('[useSRSRecordOperations] Calling staffRecordsService.markRecordAsDeleted()...');
      
      const success = await staffRecordsService.markRecordAsDeleted(recordId);
      
      if (success) {
        console.log('[useSRSRecordOperations] *** REAL DELETE OPERATION SUCCESSFUL ***');
        console.log('[useSRSRecordOperations] Record marked as deleted on server:', recordId);
        
        // Clear any local modifications for this record
        setModifiedRecords(prev => {
          const newMap = new Map(prev);
          newMap.delete(recordId);
          return newMap;
        });
        
        console.log('[useSRSRecordOperations] Auto-refreshing data to reflect server changes...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
        
        return true;
      } else {
        console.error('[useSRSRecordOperations] REAL delete operation failed - server returned false');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSRecordOperations] Error during REAL delete operation:', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to delete record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      setDeleteOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(recordId);
        return newMap;
      });
    }
  }, [context, refreshSRSData, deleteOperations, setState, setModifiedRecords]);

  /**
   * REAL RESTORE: Restores deleted record via StaffRecordsService
   */
  const handleRestoreRecord = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[useSRSRecordOperations] *** REAL RESTORE RECORD OPERATION STARTED ***');
    console.log('[useSRSRecordOperations] Record ID to restore:', recordId);
    
    if (!context) {
      console.error('[useSRSRecordOperations] Context is not available for restore operation');
      return false;
    }

    if (restoreOperations.get(recordId)) {
      console.warn('[useSRSRecordOperations] Restore operation already in progress for this record');
      return false;
    }

    try {
      setRestoreOperations(prev => new Map(prev.set(recordId, true)));
      
      console.log('[useSRSRecordOperations] Starting REAL restore operation using StaffRecordsService...');
      
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      console.log('[useSRSRecordOperations] Calling staffRecordsService.restoreDeletedRecord()...');
      
      const success = await staffRecordsService.restoreDeletedRecord(recordId);
      
      if (success) {
        console.log('[useSRSRecordOperations] *** REAL RESTORE OPERATION SUCCESSFUL ***');
        console.log('[useSRSRecordOperations] Record restored on server:', recordId);
        
        console.log('[useSRSRecordOperations] Auto-refreshing data to reflect server changes...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
        
        return true;
      } else {
        console.error('[useSRSRecordOperations] REAL restore operation failed - server returned false');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSRecordOperations] Error during REAL restore operation:', error);
      
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to restore record: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      setRestoreOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(recordId);
        return newMap;
      });
    }
  }, [context, refreshSRSData, restoreOperations, setState]);

  /**
   * REAL ADD SHIFT: Creates new shift via StaffRecordsService with Date-only format
   */
  const handleAddShift = useCallback(async (date: Date, shiftData?: INewSRSShiftData): Promise<boolean> => {
    console.log('[useSRSRecordOperations] *** REAL ADD SHIFT OPERATION WITH DATE-ONLY FORMAT ***');
    console.log('[useSRSRecordOperations] Date for new shift:', date.toLocaleDateString());
    console.log('[useSRSRecordOperations] Holiday determination: From holidays list only, not from Holiday field');
    console.log('[useSRSRecordOperations] Date format: Date-only using SRSDateUtils');
    console.log('[useSRSRecordOperations] Shift data:', shiftData);
    
    // Validate required parameters
    if (!context) {
      console.error('[useSRSRecordOperations] Context is not available for add shift operation');
      return false;
    }

    if (!selectedStaff?.employeeId) {
      console.error('[useSRSRecordOperations] Selected staff employeeId is not available for add shift operation');
      return false;
    }

    if (!currentUserId || currentUserId === '0') {
      console.error('[useSRSRecordOperations] Current user ID is not available for add shift operation');
      return false;
    }

    if (!managingGroupId || managingGroupId === '0') {
      console.error('[useSRSRecordOperations] Managing group ID is not available for add shift operation');
      return false;
    }

    // Create operation key based on date (Date-only format)
    const dateKey = SRSDateUtils.formatDateForDisplay(date); // DD.MM.YYYY format
    
    // Check if operation is already in progress
    if (addShiftOperations.get(dateKey)) {
      console.warn('[useSRSRecordOperations] Add shift operation already in progress for this date');
      return false;
    }

    try {
      // Mark operation as in progress
      setAddShiftOperations(prev => new Map(prev.set(dateKey, true)));
      
      console.log('[useSRSRecordOperations] Starting REAL add shift operation using StaffRecordsService with NUMERIC TIME FIELDS and DATE-ONLY format...');
      
      // Get service instance
      const staffRecordsService = StaffRecordsService.getInstance(context);
      
      // Prepare date with SRSDateUtils for Date-only format
      const normalizedDate = SRSDateUtils.normalizeDateToUTCMidnight(date);
      
      console.log('[useSRSRecordOperations] *** DATE-ONLY FORMAT PROCESSING ***:', {
        originalDate: date.toISOString(),
        originalLocal: date.toLocaleDateString(),
        normalizedDate: normalizedDate.toISOString(),
        normalizedLocal: normalizedDate.toLocaleDateString(),
        dateFormatMethod: 'SRSDateUtils.normalizeDateToUTCMidnight',
        sharePointFormat: SRSDateUtils.formatDateForSharePoint(normalizedDate)
      });

      // Default time values (00:00-00:00)
      const defaultStartHours = 0;
      const defaultStartMinutes = 0;
      const defaultEndHours = 0;
      const defaultEndMinutes = 0;

      // Extract values from shiftData or use defaults
      const timeForLunch = shiftData?.timeForLunch ? parseInt(shiftData.timeForLunch, 10) : 30;
      const contract = shiftData?.contract ? parseInt(shiftData.contract, 10) : 1;
      const typeOfLeaveID = shiftData?.typeOfLeave && shiftData.typeOfLeave !== '' ? shiftData.typeOfLeave : '';

      // Holiday always 0 - determined from holidays list
      const holidayFlag = 0;

      // Create record data with numeric time fields and Date-only format
      const createData: Partial<IStaffRecord> = {
        Date: normalizedDate, // Date-only format
        // Numeric time fields (main time fields)
        ShiftDate1Hours: shiftData?.ShiftDate1Hours ?? defaultStartHours,
        ShiftDate1Minutes: shiftData?.ShiftDate1Minutes ?? defaultStartMinutes,
        ShiftDate2Hours: shiftData?.ShiftDate2Hours ?? defaultEndHours,
        ShiftDate2Minutes: shiftData?.ShiftDate2Minutes ?? defaultEndMinutes,
        // Other fields
        TimeForLunch: timeForLunch,
        Contract: contract,
        WeeklyTimeTableID: undefined, // SRS not tied to specific timetable
        TypeOfLeaveID: typeOfLeaveID,
        Title: typeOfLeaveID ? `Leave on ${SRSDateUtils.formatDateForDisplay(normalizedDate)}` : `SRS Shift on ${SRSDateUtils.formatDateForDisplay(normalizedDate)}`,
        Holiday: holidayFlag // Always 0, holidays determined from holidays list
      };

      const employeeId = selectedStaff.employeeId!;
      const currentUserID = currentUserId;
      const staffGroupID = managingGroupId;

      console.log('[useSRSRecordOperations] *** CREATING NEW SRS SHIFT WITH NUMERIC TIME FIELDS AND DATE-ONLY FORMAT ***');
      console.log('[useSRSRecordOperations] Date-only processing:', {
        originalDate: date.toISOString(),
        normalizedDate: normalizedDate.toISOString(),
        sharePointFormat: SRSDateUtils.formatDateForSharePoint(normalizedDate),
        displayFormat: SRSDateUtils.formatDateForDisplay(normalizedDate)
      });
      console.log('[useSRSRecordOperations] Numeric time fields:', {
        ShiftDate1Hours: createData.ShiftDate1Hours,
        ShiftDate1Minutes: createData.ShiftDate1Minutes,
        ShiftDate2Hours: createData.ShiftDate2Hours,
        ShiftDate2Minutes: createData.ShiftDate2Minutes,
        startTime: `${createData.ShiftDate1Hours}:${createData.ShiftDate1Minutes?.toString().padStart(2, '0')}`,
        endTime: `${createData.ShiftDate2Hours}:${createData.ShiftDate2Minutes?.toString().padStart(2, '0')}`
      });
      console.log('[useSRSRecordOperations] Other fields:', {
        currentUserID,
        staffGroupID,
        employeeId,
        timeForLunch,
        contract,
        typeOfLeaveID,
        holidayFlag: holidayFlag + ' (always 0)',
        holidayLogic: 'Holidays determined from holidays list, not from Holiday field'
      });
      
      console.log('[useSRSRecordOperations] Calling staffRecordsService.createStaffRecord() with NUMERIC TIME FIELDS and DATE-ONLY format...');
      
      // REAL CALL: createStaffRecord with numeric time fields and Date-only format
      const newRecordId = await staffRecordsService.createStaffRecord(
        createData, 
        currentUserID, 
        staffGroupID, 
        employeeId
      );
      
      if (newRecordId && typeof newRecordId === 'string') {
        console.log('[useSRSRecordOperations] *** REAL ADD SHIFT WITH DATE-ONLY FORMAT SUCCESSFUL ***');
        console.log('[useSRSRecordOperations] New SRS record created with ID:', newRecordId);
        console.log('[useSRSRecordOperations] Record contains numeric time fields and Date-only format:', {
          ShiftDate1Hours: createData.ShiftDate1Hours,
          ShiftDate1Minutes: createData.ShiftDate1Minutes,
          ShiftDate2Hours: createData.ShiftDate2Hours,
          ShiftDate2Minutes: createData.ShiftDate2Minutes,
          Holiday: createData.Holiday + ' (holidays from list only)',
          dateFormat: 'Date-only using SRSDateUtils normalization'
        });
        
        // Auto-refresh data to show new record
        console.log('[useSRSRecordOperations] Auto-refreshing data to show new shift with Date-only format...');
        setTimeout(() => {
          void refreshSRSData();
        }, 500);
        
        return true;
      } else {
        console.error('[useSRSRecordOperations] REAL add shift operation failed - server returned invalid result');
        return false;
      }
      
    } catch (error) {
      console.error('[useSRSRecordOperations] Error during REAL add shift operation with Date-only format:', error);
      
      // Show error to user through state
      SRSTabStateHelpers.setErrorSRS(setState, 
        `Failed to add new shift: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      
      return false;
      
    } finally {
      // Remove operation tracking
      setAddShiftOperations(prev => {
        const newMap = new Map(prev);
        newMap.delete(dateKey);
        return newMap;
      });
    }
  }, [context, selectedStaff?.employeeId, currentUserId, managingGroupId, refreshSRSData, addShiftOperations, setState]);

  /**
   * Toggle showDeleted flag and trigger data reload
   */
  const handleToggleShowDeleted = useCallback((checked: boolean): void => {
    console.log('[useSRSRecordOperations] *** HANDLE TOGGLE SHOW DELETED + DATE-ONLY ***');
    console.log('[useSRSRecordOperations] Previous showDeleted state:', state.showDeleted);
    console.log('[useSRSRecordOperations] New showDeleted value:', checked);
    console.log('[useSRSRecordOperations] Total Hours will be recalculated in SRSTable automatically');
    console.log('[useSRSRecordOperations] Date format: Date-only using SRSDateUtils');
    
    SRSTabStateHelpers.setShowDeleted(setState, checked);
    
    // Clear local modifications when toggling
    setModifiedRecords(new Map());
    SRSTabStateHelpers.setHasUnsavedChanges(setState, false);
    
    // SRS data will reload automatically through useSRSData effect
    console.log('[useSRSRecordOperations] showDeleted state updated, SRS data will be automatically reloaded via useSRSData effect (Date-only format)');
    console.log('[useSRSRecordOperations] *** TOGGLE SHOW DELETED COMPLETE + DATE-ONLY ***');
    
  }, [state.showDeleted, setState, setModifiedRecords]);

  // Log handlers creation
  console.log('[useSRSRecordOperations] Record operations handlers created:', {
    hasDeleteHandler: !!handleDeleteRecord,
    hasRestoreHandler: !!handleRestoreRecord,
    hasAddShiftHandler: !!handleAddShift,
    hasToggleShowDeletedHandler: !!handleToggleShowDeleted,
    ongoingOperations: {
      delete: deleteOperations.size,
      restore: restoreOperations.size,
      addShift: addShiftOperations.size
    },
    realServiceIntegration: 'StaffRecordsService methods',
    dateFormat: 'Date-only with SRSDateUtils integration',
    holidayHandling: 'Always 0 - determined from holidays list',
    numericTimeFields: 'ShiftDate1Hours/Minutes, ShiftDate2Hours/Minutes'
  });

  return {
    onDeleteRecord: handleDeleteRecord,
    onRestoreRecord: handleRestoreRecord,
    onAddShift: handleAddShift,
    onToggleShowDeleted: handleToggleShowDeleted,
    deleteOperations,
    restoreOperations,
    addShiftOperations
  };
};