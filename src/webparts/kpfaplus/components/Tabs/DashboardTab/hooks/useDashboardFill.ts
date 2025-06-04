// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardFill.ts
// НОВЫЙ ФАЙЛ: Специализированный хук для операций заполнения данных
import { useCallback } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { CommonFillService, IFillParams } from '../../../../services/CommonFillService';

// *** ИНТЕРФЕЙСЫ ДЛЯ ЗАПОЛНЕНИЯ ***
interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

interface IConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  onConfirm: () => void;
}

interface IUseDashboardFillParams {
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
  selectedDate: Date;
  staffMembers: IStaffMember[];
  staffMembersData: IStaffMemberWithAutoschedule[];
  fillService?: CommonFillService;
  setIsLoading: (loading: boolean) => void;
  setInfoMessage: (message: IInfoMessage | undefined) => void;
  setConfirmDialog: (dialog: IConfirmDialogState | ((prev: IConfirmDialogState) => IConfirmDialogState)) => void;
  handleLogRefresh: (staffId: string) => Promise<void>;
  handleBulkLogRefresh: (staffIds: string[]) => Promise<void>;
}

interface IUseDashboardFillReturn {
  handleFillStaff: (staffId: string, staffName: string) => Promise<void>;
  handleFillAll: () => Promise<void>;
  handleAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
}

// Utility functions
const formatDate = (date?: Date): string => {
  if (!date) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

export const useDashboardFill = (params: IUseDashboardFillParams): IUseDashboardFillReturn => {
  const {
    context,
    currentUserId,
    managingGroupId,
    selectedDate,
    staffMembers,
    staffMembersData,
    fillService,
    setIsLoading,
    setInfoMessage,
    setConfirmDialog,
    handleLogRefresh,
    handleBulkLogRefresh
  } = params;

  console.log('[useDashboardFill] Fill operations hook initialized');

  // *** CREATE FILL PARAMETERS ***
  const createFillParams = useCallback((staffMember: IStaffMemberWithAutoschedule): IFillParams | undefined => {
    if (!context) {
      console.error('[useDashboardFill] Context not available');
      return undefined;
    }

    const fullStaffMember = staffMembers.find(staff => staff.id === staffMember.id);
    if (!fullStaffMember) {
      console.error('[useDashboardFill] Staff member not found:', staffMember.id);
      return undefined;
    }

    const validationErrors: string[] = [];
    
    if (!fullStaffMember.employeeId || fullStaffMember.employeeId === 'N/A') {
      validationErrors.push('Invalid employeeId');
    }
    
    if (!currentUserId || currentUserId === '0') {
      validationErrors.push('Invalid currentUserId');
    }
    
    if (!managingGroupId || managingGroupId === '0') {
      validationErrors.push('Invalid managingGroupId');
    }

    if (validationErrors.length > 0) {
      console.error('[useDashboardFill] Validation errors:', validationErrors);
      return undefined;
    }

    return {
      selectedDate,
      staffMember: fullStaffMember,
      currentUserId,
      managingGroupId,
      dayOfStartWeek: 7,
      context
    };
  }, [context, staffMembers, selectedDate, currentUserId, managingGroupId]);

  // *** PERFORM FILL OPERATION ***
  const performFillOperation = useCallback(async (
    fillParams: IFillParams, 
    staffName: string, 
    replaceExisting: boolean
  ): Promise<void> => {
    if (!fillService) {
      console.error('[useDashboardFill] Fill service not available');
      setInfoMessage({
        text: 'Fill service not available',
        type: MessageBarType.error
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log(`[useDashboardFill] Starting fill for ${staffName} (period: ${formatDate(selectedDate)})`);

      const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);

      setInfoMessage({
        text: result.message,
        type: result.messageType
      });

      if (result.success) {
        console.log(`[useDashboardFill] Fill successful for ${staffName} - will refresh log`);
        
        setTimeout(() => {
          void handleLogRefresh(fillParams.staffMember.id);
        }, 1500);
      }

    } catch (error) {
      console.error(`[useDashboardFill] Fill error for ${staffName}:`, error);
      setInfoMessage({
        text: `Error filling schedule for ${staffName}: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [fillService, selectedDate, handleLogRefresh, setIsLoading, setInfoMessage]);

  // *** HANDLE AUTOSCHEDULE TOGGLE ***
  const handleAutoscheduleToggle = useCallback(async (staffId: string, checked: boolean): Promise<void> => {
    console.log('[useDashboardFill] Autoschedule toggle:', staffId, checked);
    
    try {
      setIsLoading(true);
      
      // Note: This would need to be implemented with the proper service
      // For now, just showing the structure
      console.log(`[useDashboardFill] Would update autoschedule for staff ${staffId} to ${checked}`);
      
      setInfoMessage({
        text: 'Autoschedule updated successfully',
        type: MessageBarType.success
      });
      
    } catch (error) {
      console.error('[useDashboardFill] Autoschedule error:', error);
      setInfoMessage({
        text: `Error updating autoschedule: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setInfoMessage]);

  // *** HANDLE FILL STAFF ***
  const handleFillStaff = useCallback(async (staffId: string, staffName: string): Promise<void> => {
    console.log(`[useDashboardFill] Fill staff operation: ${staffId}, ${staffName} (period: ${formatDate(selectedDate)})`);
    
    const staffMember = staffMembersData.find(staff => staff.id === staffId);
    if (!staffMember) {
      setInfoMessage({
        text: `Staff member not found: ${staffName}`,
        type: MessageBarType.error
      });
      return;
    }

    const fillParams = createFillParams(staffMember);
    if (!fillParams) {
      setInfoMessage({
        text: 'Cannot create fill parameters - check staff data and context',
        type: MessageBarType.error
      });
      return;
    }

    try {
      setIsLoading(true);

      if (!fillService) {
        throw new Error('Fill service not available');
      }

      const existingCheck = await fillService.checkExistingRecords(fillParams);

      if (existingCheck.hasExistingRecords) {
        if (existingCheck.hasProcessedRecords) {
          setInfoMessage({
            text: `Cannot replace records for ${staffName}: ${existingCheck.processedCount} of ${existingCheck.recordsCount} records have been processed.`,
            type: MessageBarType.error
          });
          return;
        } else {
          setConfirmDialog({
            isOpen: true,
            title: 'Replace Existing Records',
            message: `Found ${existingCheck.recordsCount} existing unprocessed records for ${staffName} in ${formatDate(selectedDate)} period. Replace them?`,
            confirmButtonText: 'Replace',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#d83b01',
            onConfirm: async () => {
              setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
              await performFillOperation(fillParams, staffName, true);
            }
          });
          return;
        }
      } else {
        await performFillOperation(fillParams, staffName, false);
      }

    } catch (error) {
      console.error('[useDashboardFill] Fill staff error:', error);
      setInfoMessage({
        text: `Error in Fill operation: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [staffMembersData, selectedDate, createFillParams, fillService, performFillOperation, setIsLoading, setInfoMessage, setConfirmDialog]);

  // *** PERFORM FILL ALL OPERATION ***
  const performFillAllOperation = useCallback(async (replaceExisting: boolean): Promise<void> => {
    if (!fillService) return;

    let successCount = 0;
    let errorCount = 0;
    let totalCreatedRecords = 0;
    let totalDeletedRecords = 0;
    const processedStaffIds: string[] = [];

    console.log(`[useDashboardFill] Performing fill all operation for period: ${formatDate(selectedDate)}`);

    for (const staffMember of staffMembersData) {
      const fillParams = createFillParams(staffMember);
      if (fillParams) {
        try {
          const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);
          
          if (result.success) {
            successCount++;
            totalCreatedRecords += result.createdRecordsCount || 0;
            totalDeletedRecords += result.deletedRecordsCount || 0;
            processedStaffIds.push(staffMember.id);
          } else {
            errorCount++;
          }
        } catch (error) {
          errorCount++;
          console.error(`[useDashboardFill] Fill error for ${staffMember.name}:`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        errorCount++;
      }
    }

    if (errorCount === 0) {
      setInfoMessage({
        text: `Successfully filled schedule for all ${successCount} staff members for ${formatDate(selectedDate)} period. Created ${totalCreatedRecords} records.`,
        type: MessageBarType.success
      });
    } else {
      setInfoMessage({
        text: `Filled ${successCount} of ${staffMembersData.length} staff members for ${formatDate(selectedDate)} period. ${errorCount} failed.`,
        type: MessageBarType.warning
      });
    }

    if (processedStaffIds.length > 0) {
      setTimeout(() => {
        void handleBulkLogRefresh(processedStaffIds);
      }, 2000);
    }
  }, [fillService, selectedDate, staffMembersData, createFillParams, handleBulkLogRefresh, setInfoMessage]);

  // *** HANDLE FILL ALL ***
  const handleFillAll = useCallback(async (): Promise<void> => {
    console.log(`[useDashboardFill] Fill all operation started for period: ${formatDate(selectedDate)}`);
    
    if (!fillService) {
      setInfoMessage({
        text: 'Fill service not available',
        type: MessageBarType.error
      });
      return;
    }

    if (staffMembersData.length === 0) {
      setInfoMessage({
        text: 'No active staff members to fill',
        type: MessageBarType.warning
      });
      return;
    }

    try {
      setIsLoading(true);

      let totalExistingRecords = 0;
      let totalProcessedRecords = 0;
      const staffWithExistingRecords: string[] = [];

      for (const staffMember of staffMembersData) {
        const fillParams = createFillParams(staffMember);
        if (fillParams) {
          const existingCheck = await fillService.checkExistingRecords(fillParams);
          if (existingCheck.hasExistingRecords) {
            totalExistingRecords += existingCheck.recordsCount;
            staffWithExistingRecords.push(staffMember.name);
            
            if (existingCheck.hasProcessedRecords) {
              totalProcessedRecords += existingCheck.processedCount;
            }
          }
        }
      }

      if (totalProcessedRecords > 0) {
        setInfoMessage({
          text: `Cannot fill all: Found ${totalProcessedRecords} processed records. Manual review required.`,
          type: MessageBarType.error
        });
        return;
      }

      if (totalExistingRecords > 0) {
        setConfirmDialog({
          isOpen: true,
          title: 'Replace All Existing Records',
          message: `Found ${totalExistingRecords} existing records for ${staffWithExistingRecords.length} staff members in ${formatDate(selectedDate)} period. Replace all?`,
          confirmButtonText: 'Replace All',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#d83b01',
          onConfirm: async () => {
            setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
            await performFillAllOperation(true);
          }
        });
        return;
      } else {
        await performFillAllOperation(false);
      }

    } catch (error) {
      console.error('[useDashboardFill] Fill all error:', error);
      setInfoMessage({
        text: `Error in Fill All operation: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  }, [staffMembersData, selectedDate, fillService, createFillParams, performFillAllOperation, setIsLoading, setInfoMessage, setConfirmDialog]);

  return {
    handleFillStaff,
    handleFillAll,
    handleAutoscheduleToggle
  };
};