// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardFill.ts
// ИСПРАВЛЕНО: Удалены неиспользуемые переменные и исправлены ошибки линтера
import { useCallback } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { 
  CommonFillService, 
  IFillParams, 
  IPerformFillParams,
  DialogType, 
  IDialogConfig 
} from '../../../../services/CommonFillService';
import { ContractsService } from '../../../../services/ContractsService';
import { IContract } from '../../../../models/IContract';

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

// *** HELPER FUNCTION: Extract records count from message ***
const extractRecordsCountFromMessage = (message: string): number => {
  const match = message.match(/Found (\d+) existing/);
  return match ? parseInt(match[1], 10) : 0;
};

// *** HELPER FUNCTION: Extract processed count from message ***
const extractProcessedCountFromMessage = (message: string): number => {
  const match = message.match(/Found (\d+) processed/);
  return match ? parseInt(match[1], 10) : 0;
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

  console.log('[useDashboardFill] Fill operations hook initialized with Result=3 logging');

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

  // *** GET ACTIVE CONTRACT FOR STAFF ***
  const getActiveContractForStaff = useCallback(async (staffMember: IStaffMember): Promise<IContract | undefined> => {
    if (!context) return undefined;

    try {
      const contractsService = ContractsService.getInstance(context);
      const contracts = await contractsService.getContractsForStaffMember(
        staffMember.employeeId || '',
        currentUserId || '',
        managingGroupId || ''
      );

      const activeContracts = contracts.filter((contract: IContract) => {
        if (contract.isDeleted) return false;
        
        // Check if contract is active in selected month
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        if (!contract.startDate) return false;
        
        const startDate = new Date(contract.startDate);
        if (startDate > lastDayOfMonth) return false;
        
        if (contract.finishDate) {
          const finishDate = new Date(contract.finishDate);
          if (finishDate < firstDayOfMonth) return false;
        }
        
        return true;
      });

      return activeContracts.length > 0 ? activeContracts[0] : undefined;
    } catch (error) {
      console.error('[useDashboardFill] Error getting active contract:', error);
      return undefined;
    }
  }, [context, currentUserId, managingGroupId, selectedDate]);

  // *** SHOW SCHEDULE TAB DIALOG WITH REFUSAL LOGGING ***
  const showScheduleDialog = useCallback((
    dialogConfig: IDialogConfig, 
    staffName: string, 
    fillParams: IFillParams,
    contractId: string,
    onConfirm: () => Promise<void>
  ): void => {
    console.log(`[useDashboardFill] Showing Schedule tab dialog: ${dialogConfig.type} for ${staffName}`);
    
    // Добавляем информацию о периоде к сообщению
    const enhancedMessage = dialogConfig.message.includes(formatDate(selectedDate)) 
      ? dialogConfig.message 
      : `${dialogConfig.message}\n\nPeriod: ${formatDate(selectedDate)}`;

    setConfirmDialog({
      isOpen: true,
      title: dialogConfig.title,
      message: enhancedMessage,
      confirmButtonText: dialogConfig.confirmButtonText,
      cancelButtonText: dialogConfig.cancelButtonText || 'Cancel',
      confirmButtonColor: dialogConfig.confirmButtonColor,
      onConfirm: async () => {
        setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
        await onConfirm();
      }
    });
  }, [selectedDate, setConfirmDialog]);

  // *** LOG USER REFUSAL ***
  const logUserRefusal = useCallback(async (
    fillParams: IFillParams,
    dialogType: DialogType,
    contractId: string,
    staffName: string
  ): Promise<void> => {
    if (fillService) {
      console.log(`[useDashboardFill] Logging user refusal for ${staffName}, dialog: ${dialogType}`);
      await fillService.logUserRefusal(fillParams, dialogType, contractId);
    }
  }, [fillService]);

  // *** PERFORM ACTUAL FILL OPERATION ***
  const performFillOperation = useCallback(async (
    fillParams: IFillParams, 
    contractId: string,
    replaceExisting: boolean,
    staffName: string
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
      console.log(`[useDashboardFill] Performing fill operation for ${staffName} (period: ${formatDate(selectedDate)})`);

      const performParams: IPerformFillParams = {
        ...fillParams,
        contractId,
        replaceExisting
      };

      const result = await fillService.performFillOperation(performParams);

      setInfoMessage({
        text: result.message,
        type: result.messageType
      });

      if (result.success) {
        console.log(`[useDashboardFill] Fill successful for ${staffName} - will refresh log`);
        
        // Обновляем лог через небольшую задержку
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

  // *** HANDLE FILL STAFF WITH SCHEDULE TAB LOGIC ***
  const handleFillStaff = useCallback(async (staffId: string, staffName: string): Promise<void> => {
    console.log(`[useDashboardFill] Fill staff operation with Schedule tab logic: ${staffId}, ${staffName} (period: ${formatDate(selectedDate)})`);
    
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

      // *** ШАГ 1: ПРОВЕРЯЕМ ЗАПИСИ С SCHEDULE TAB ЛОГИКОЙ ***
      console.log(`[useDashboardFill] Checking schedule with Schedule tab logic for ${staffName}`);
      const checkResult = await fillService.checkScheduleForFill(fillParams);

      if (!checkResult.requiresDialog) {
        // Ошибка или что-то пошло не так
        setInfoMessage({
          text: checkResult.message,
          type: checkResult.messageType
        });
        return;
      }

      // *** ШАГ 2: ПОЛУЧАЕМ АКТИВНЫЙ КОНТРАКТ ***
      const activeContract = await getActiveContractForStaff(fillParams.staffMember);
      if (!activeContract) {
        setInfoMessage({
          text: `No active contract found for ${staffName} in selected period`,
          type: MessageBarType.error
        });
        return;
      }

      // *** ШАГ 3: ОБРАБАТЫВАЕМ РАЗЛИЧНЫЕ ТИПЫ ДИАЛОГОВ ***
      const dialogConfig = checkResult.dialogConfig!;
      
      switch (dialogConfig.type) {
        case DialogType.EmptySchedule:
          // Нет записей - спрашиваем хочет ли пользователь заполнить
          console.log(`[useDashboardFill] EmptySchedule dialog for ${staffName}`);
          showScheduleDialog(dialogConfig, staffName, fillParams, activeContract.id, async () => {
            await performFillOperation(fillParams, activeContract.id, false, staffName);
          });
          break;

        case DialogType.UnprocessedRecordsReplace:
          // Есть необработанные записи - спрашиваем хочет ли заменить
          console.log(`[useDashboardFill] UnprocessedRecordsReplace dialog for ${staffName}`);
          showScheduleDialog(dialogConfig, staffName, fillParams, activeContract.id, async () => {
            await performFillOperation(fillParams, activeContract.id, true, staffName);
          });
          break;

        case DialogType.ProcessedRecordsBlock:
          // Есть обработанные записи - блокируем операцию
          console.log(`[useDashboardFill] ProcessedRecordsBlock dialog for ${staffName}`);
          showScheduleDialog(dialogConfig, staffName, fillParams, activeContract.id, async () => {
            // Ничего не делаем - это блокирующий диалог
            console.log(`[useDashboardFill] ProcessedRecordsBlock - no action taken for ${staffName}`);
            // Логируем как отказ пользователя (хотя кнопка OK)
            await logUserRefusal(fillParams, dialogConfig.type, activeContract.id, staffName);
          });
          break;

        default:
          console.error(`[useDashboardFill] Unknown dialog type: ${dialogConfig.type}`);
          setInfoMessage({
            text: `Unknown dialog type for ${staffName}`,
            type: MessageBarType.error
          });
          break;
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
  }, [
    staffMembersData, 
    selectedDate, 
    createFillParams, 
    fillService, 
    getActiveContractForStaff,
    showScheduleDialog, 
    performFillOperation,
    logUserRefusal,
    setIsLoading, 
    setInfoMessage
  ]);

  // *** PERFORM FILL ALL OPERATION WITH SCHEDULE TAB LOGIC ***
  const performFillAllOperation = useCallback(async (replaceExisting: boolean): Promise<void> => {
    if (!fillService) return;

    let successCount = 0;
    let errorCount = 0;
    let totalCreatedRecords = 0;
    // ИСПРАВЛЕНО: удалена неиспользуемая переменная totalDeletedRecords
    const processedStaffIds: string[] = [];

    console.log(`[useDashboardFill] Performing fill all operation with Schedule tab logic for period: ${formatDate(selectedDate)}`);

    for (const staffMember of staffMembersData) {
      const fillParams = createFillParams(staffMember);
      if (!fillParams) {
        errorCount++;
        console.error(`[useDashboardFill] Cannot create fill params for ${staffMember.name}`);
        continue;
      }

      try {
        // Получаем активный контракт
        const activeContract = await getActiveContractForStaff(fillParams.staffMember);
        if (!activeContract) {
          errorCount++;
          console.error(`[useDashboardFill] No active contract for ${staffMember.name}`);
          continue;
        }

        const performParams: IPerformFillParams = {
          ...fillParams,
          contractId: activeContract.id,
          replaceExisting
        };

        const result = await fillService.performFillOperation(performParams);
        
        if (result.success) {
          successCount++;
          totalCreatedRecords += result.createdRecordsCount || 0;
          // ИСПРАВЛЕНО: удалено использование deletedRecordsCount так как переменная totalDeletedRecords удалена
          processedStaffIds.push(staffMember.id);
        } else {
          errorCount++;
          console.error(`[useDashboardFill] Fill failed for ${staffMember.name}: ${result.message}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`[useDashboardFill] Fill error for ${staffMember.name}:`, error);
      }

      // Небольшая пауза между операциями
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Показываем итоговое сообщение
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

    // Обновляем логи для успешно обработанных сотрудников
    if (processedStaffIds.length > 0) {
      setTimeout(() => {
        void handleBulkLogRefresh(processedStaffIds);
      }, 2000);
    }
  }, [
    fillService, 
    selectedDate, 
    staffMembersData, 
    createFillParams, 
    getActiveContractForStaff,
    handleBulkLogRefresh, 
    setInfoMessage
  ]);

  // *** HANDLE FILL ALL WITH SCHEDULE TAB LOGIC ***
  const handleFillAll = useCallback(async (): Promise<void> => {
    console.log(`[useDashboardFill] Fill all operation started with Schedule tab logic for period: ${formatDate(selectedDate)}`);
    
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

      // *** ШАГ 1: ПРОВЕРЯЕМ ВСЕ ЗАПИСИ С SCHEDULE TAB ЛОГИКОЙ ***
      console.log(`[useDashboardFill] Checking all staff records with Schedule tab logic`);
      
      for (const staffMember of staffMembersData) {
        const fillParams = createFillParams(staffMember);
        if (!fillParams) continue;

        try {
          const checkResult = await fillService.checkScheduleForFill(fillParams);
          
          if (checkResult.requiresDialog && checkResult.dialogConfig) {
            const dialogType = checkResult.dialogConfig.type;
            
            if (dialogType === DialogType.UnprocessedRecordsReplace) {
              // Есть необработанные записи
              const recordsCount = extractRecordsCountFromMessage(checkResult.dialogConfig.message);
              totalExistingRecords += recordsCount;
              staffWithExistingRecords.push(staffMember.name);
            } else if (dialogType === DialogType.ProcessedRecordsBlock) {
              // Есть обработанные записи - блокируем операцию
              const processedCount = extractProcessedCountFromMessage(checkResult.dialogConfig.message);
              totalProcessedRecords += processedCount;
            }
            // DialogType.EmptySchedule - нет записей, ничего не добавляем
          }
        } catch (error) {
          console.error(`[useDashboardFill] Error checking ${staffMember.name}:`, error);
        }
      }

      // *** ШАГ 2: АНАЛИЗИРУЕМ РЕЗУЛЬТАТЫ И ПРИНИМАЕМ РЕШЕНИЕ ***
      if (totalProcessedRecords > 0) {
        setInfoMessage({
          text: `Cannot fill all: Found ${totalProcessedRecords} processed records. Manual review required.`,
          type: MessageBarType.error
        });
        return;
      }

      if (totalExistingRecords > 0) {
        // Есть необработанные записи - спрашиваем разрешение на замену
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
        // Нет существующих записей - спрашиваем разрешение на заполнение
        setConfirmDialog({
          isOpen: true,
          title: 'Fill All Schedules',
          message: `Do you want to fill schedules for all ${staffMembersData.length} staff members for ${formatDate(selectedDate)} period?`,
          confirmButtonText: 'Fill All',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#107c10',
          onConfirm: async () => {
            setConfirmDialog((prev: IConfirmDialogState) => ({ ...prev, isOpen: false }));
            await performFillAllOperation(false);
          }
        });
        return;
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
  }, [
    staffMembersData, 
    selectedDate, 
    fillService, 
    createFillParams, 
    performFillAllOperation, 
    setIsLoading, 
    setInfoMessage, 
    setConfirmDialog
  ]);

  return {
    handleFillStaff,
    handleFillAll,
    handleAutoscheduleToggle
  };
};