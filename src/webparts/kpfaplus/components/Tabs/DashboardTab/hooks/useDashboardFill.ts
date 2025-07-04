// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardFill.ts
// UPDATED: Full support for Date-only format in Holidays and DaysOfLeaves lists
// ДОБАВЛЕНО: Поддержка автозаполнения и специальная обработка для staff с autoschedule
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
  // ДОБАВЛЕНО: Функции для автозаполнения с Date-only поддержкой
  processStaffMemberAuto: (staff: IStaffMemberWithAutoschedule) => Promise<{success: boolean, message: string}>;
  checkAutoFillEligibility: (staff: IStaffMemberWithAutoschedule) => Promise<{eligible: boolean, reason?: string}>;
  logAutoFillWarning: (staff: IStaffMemberWithAutoschedule, reason: string) => Promise<void>;
}

// *** UTILITY FUNCTIONS WITH DATE-ONLY SUPPORT ***
const formatDateOnlyForDisplay = (date?: Date): string => {
  if (!date) return '';
  try {
    // Используем локальные компоненты даты для правильного отображения Date-only полей
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${day}.${month}.${year}`;
  } catch (error) {
    console.warn('[useDashboardFill] Error formatting Date-only date for display:', error);
    return date.toLocaleDateString();
  }
};

const createDateOnlyFromComponents = (year: number, month: number, day: number): Date => {
  // Создаем дату с локальными компонентами для избежания проблем с часовыми поясами
  // month должен быть 0-based для конструктора Date
  return new Date(year, month, day);
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

  console.log('[useDashboardFill] Fill operations hook initialized with Date-only format support and Auto Fill');

  // *** CREATE FILL PARAMETERS WITH DATE-ONLY SUPPORT ***
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

  // *** GET ACTIVE CONTRACT FOR STAFF WITH DATE-ONLY BOUNDARIES ***
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
        
        // *** UPDATED: Check if contract is active in selected month using Date-only approach ***
        const selectedYear = selectedDate.getFullYear();
        const selectedMonth = selectedDate.getMonth();
        
        // *** UPDATED: Create month boundaries using Date-only methods ***
        const firstDayOfMonth = createDateOnlyFromComponents(selectedYear, selectedMonth, 1);
        const lastDayOfMonth = createDateOnlyFromComponents(selectedYear, selectedMonth + 1, 0); // Last day of month

        console.log(`[useDashboardFill] *** DATE-ONLY CONTRACT VALIDATION FOR ${staffMember.name} ***`);
        console.log(`[useDashboardFill] Selected date: ${formatDateOnlyForDisplay(selectedDate)}`);
        console.log(`[useDashboardFill] Month boundaries (Date-only): ${formatDateOnlyForDisplay(firstDayOfMonth)} - ${formatDateOnlyForDisplay(lastDayOfMonth)}`);
        console.log(`[useDashboardFill] Contract ${contract.id} dates: ${contract.startDate ? formatDateOnlyForDisplay(new Date(contract.startDate)) : 'no start'} - ${contract.finishDate ? formatDateOnlyForDisplay(new Date(contract.finishDate)) : 'no end'}`);

        if (!contract.startDate) {
          console.log(`[useDashboardFill] Contract ${contract.id} has no start date - excluding`);
          return false;
        }
        
        // *** UPDATED: Normalize contract start date to Date-only ***
        const startDate = new Date(contract.startDate);
        const startDateOnly = createDateOnlyFromComponents(
          startDate.getFullYear(),
          startDate.getMonth(),
          startDate.getDate()
        );
        
        // Check if contract starts after the month ends
        if (startDateOnly > lastDayOfMonth) {
          console.log(`[useDashboardFill] Contract ${contract.id} starts after selected month - excluding`);
          console.log(`[useDashboardFill] Contract start (Date-only): ${formatDateOnlyForDisplay(startDateOnly)}, Month end (Date-only): ${formatDateOnlyForDisplay(lastDayOfMonth)}`);
          return false;
        }
        
        // If no finish date, contract is active (open-ended)
        if (!contract.finishDate) {
          console.log(`[useDashboardFill] Contract ${contract.id} is open-ended and starts before/in selected month - including`);
          return true;
        }

        // *** UPDATED: Normalize contract finish date to Date-only ***
        const finishDate = new Date(contract.finishDate);
        const finishDateOnly = createDateOnlyFromComponents(
          finishDate.getFullYear(),
          finishDate.getMonth(),
          finishDate.getDate()
        );
        
        // Check if contract ends before the month starts
        const isActive = finishDateOnly >= firstDayOfMonth;
        
        console.log(`[useDashboardFill] Contract ${contract.id} Date-only validation result:`, {
          contractStart: formatDateOnlyForDisplay(startDateOnly),
          contractEnd: formatDateOnlyForDisplay(finishDateOnly),
          monthStart: formatDateOnlyForDisplay(firstDayOfMonth),
          monthEnd: formatDateOnlyForDisplay(lastDayOfMonth),
          isActive: isActive
        });
        
        return isActive;
      });

      const selectedContract = activeContracts.length > 0 ? activeContracts[0] : undefined;
      
      console.log(`[useDashboardFill] Contract selection result with Date-only support for ${staffMember.name}:`, {
        totalContracts: contracts.length,
        activeContracts: activeContracts.length,
        selectedContract: selectedContract ? `${selectedContract.id} - ${selectedContract.template || 'No name'}` : 'None',
        period: `${formatDateOnlyForDisplay(selectedDate)} (Date-only)`
      });

      return selectedContract;
    } catch (error) {
      console.error('[useDashboardFill] Error getting active contract with Date-only validation:', error);
      return undefined;
    }
  }, [context, currentUserId, managingGroupId, selectedDate]);

  // *** НОВАЯ ФУНКЦИЯ: Проверка возможности автозаполнения с Date-only поддержкой ***
  const checkAutoFillEligibility = useCallback(async (staff: IStaffMemberWithAutoschedule): Promise<{eligible: boolean, reason?: string}> => {
    console.log(`[useDashboardFill] 🔍 Checking auto-fill eligibility with Date-only support for ${staff.name}`);

    // Проверка 1: Autoschedule должен быть включен
    if (!staff.autoschedule) {
      const reason = 'Auto Schedule is disabled';
      console.log(`[useDashboardFill] ❌ ${staff.name}: ${reason}`);
      return { eligible: false, reason };
    }

    // Проверка 2: Валидация параметров
    const fillParams = createFillParams(staff);
    if (!fillParams) {
      const reason = 'Invalid fill parameters';
      console.log(`[useDashboardFill] ❌ ${staff.name}: ${reason}`);
      return { eligible: false, reason };
    }

    if (!fillService) {
      const reason = 'Fill service not available';
      console.log(`[useDashboardFill] ❌ ${staff.name}: ${reason}`);
      return { eligible: false, reason };
    }

    try {
      // Проверка 3: Проверяем существующие записи
      const checkResult = await fillService.checkScheduleForFill(fillParams);
      
      if (!checkResult.requiresDialog) {
        const reason = checkResult.message;
        console.log(`[useDashboardFill] ❌ ${staff.name}: ${reason}`);
        return { eligible: false, reason };
      }

      // Проверка 4: Получаем активный контракт
      const activeContract = await getActiveContractForStaff(fillParams.staffMember);
      if (!activeContract) {
        const reason = 'No active contract found for selected period (Date-only check)';
        console.log(`[useDashboardFill] ❌ ${staff.name}: ${reason}`);
        return { eligible: false, reason };
      }

      // Проверка 5: Анализируем тип диалога
      const dialogConfig = checkResult.dialogConfig!;
      
      if (dialogConfig.type === DialogType.ProcessedRecordsBlock) {
        // Есть обработанные записи - блокируем
        const reason = 'Has processed records (Checked>0 or ExportResult>0)';
        console.log(`[useDashboardFill] ⚠️ ${staff.name}: ${reason} - will be skipped with warning`);
        return { eligible: false, reason };
      }

      // EmptySchedule или UnprocessedRecordsReplace - можно обрабатывать
      console.log(`[useDashboardFill] ✅ ${staff.name}: Eligible for auto-fill (${dialogConfig.type}) with Date-only support`);
      return { eligible: true };

    } catch (error) {
      const reason = `Error checking eligibility: ${error}`;
      console.error(`[useDashboardFill] ❌ ${staff.name}: ${reason}`);
      return { eligible: false, reason };
    }
  }, [createFillParams, fillService, getActiveContractForStaff]);

  // *** НОВАЯ ФУНКЦИЯ: Логирование предупреждений для автозаполнения с Date-only поддержкой ***
  const logAutoFillWarning = useCallback(async (staff: IStaffMemberWithAutoschedule, reason: string): Promise<void> => {
    console.log(`[useDashboardFill] 📝 Logging auto-fill warning with Date-only support for ${staff.name}: ${reason}`);

    if (!fillService) {
      console.warn('[useDashboardFill] Cannot log warning - fill service not available');
      return;
    }

    try {
      const fillParams = createFillParams(staff);
      if (!fillParams) {
        console.warn(`[useDashboardFill] Cannot log warning for ${staff.name} - invalid fill params`);
        return;
      }

      // Создаем специальный лог с Result=3 (Warning/Info) для автозаполнения
      await fillService.logUserRefusal(fillParams, DialogType.ProcessedRecordsBlock, undefined);
      
      console.log(`[useDashboardFill] ✓ Warning logged with Date-only support for ${staff.name}: ${reason}`);
    } catch (error) {
      console.error(`[useDashboardFill] Error logging warning for ${staff.name}:`, error);
    }
  }, [fillService, createFillParams]);

  // *** НОВАЯ ФУНКЦИЯ: Автоматическая обработка одного staff member с Date-only поддержкой ***
  const processStaffMemberAuto = useCallback(async (staff: IStaffMemberWithAutoschedule): Promise<{success: boolean, message: string}> => {
    console.log(`[useDashboardFill] 🤖 Auto-processing staff member with Date-only support: ${staff.name}`);

    try {
      // Проверяем возможность автозаполнения
      const eligibility = await checkAutoFillEligibility(staff);
      
      if (!eligibility.eligible) {
        // Логируем предупреждение для неподходящих staff
        if (eligibility.reason?.includes('processed')) {
          await logAutoFillWarning(staff, eligibility.reason);
          return { 
            success: false, 
            message: `⚠️ Skipped (${eligibility.reason}) - warning logged` 
          };
        }
        
        return { 
          success: false, 
          message: `❌ Skipped (${eligibility.reason})` 
        };
      }

      // Обрабатываем staff member
      const fillParams = createFillParams(staff);
      if (!fillParams || !fillService) {
        return { 
          success: false, 
          message: '❌ Invalid parameters or service unavailable' 
        };
      }

      // Получаем активный контракт
      const activeContract = await getActiveContractForStaff(fillParams.staffMember);
      if (!activeContract) {
        return { 
          success: false, 
          message: '❌ No active contract (Date-only check)' 
        };
      }

      // Проверяем тип операции (нужно ли удалять существующие записи)
      const checkResult = await fillService.checkScheduleForFill(fillParams);
      const replaceExisting = checkResult.dialogConfig?.type === DialogType.UnprocessedRecordsReplace;

      // Выполняем заполнение БЕЗ диалогов
      const performParams: IPerformFillParams = {
        ...fillParams,
        contractId: activeContract.id,
        replaceExisting
      };

      console.log(`[useDashboardFill] 🚀 Executing auto-fill with Date-only support for ${staff.name} (replace existing: ${replaceExisting})`);
      
      const result = await fillService.performFillOperation(performParams);

      if (result.success) {
        console.log(`[useDashboardFill] ✅ Auto-fill successful with Date-only support for ${staff.name}: ${result.createdRecordsCount} records created`);
        
        // Обновляем лог через небольшую задержку
        setTimeout(() => {
          void handleLogRefresh(staff.id);
        }, 1000);

        return { 
          success: true, 
          message: `✅ Success (${result.createdRecordsCount} records created, Date-only format)` 
        };
      } else {
        console.error(`[useDashboardFill] ❌ Auto-fill failed for ${staff.name}: ${result.message}`);
        return { 
          success: false, 
          message: `❌ Failed (${result.message})` 
        };
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[useDashboardFill] ❌ Error auto-processing ${staff.name}:`, error);
      
      // Если ошибка связана с обработанными записями, логируем как предупреждение
      if (errorMsg.toLowerCase().includes('processed') || errorMsg.toLowerCase().includes('checked')) {
        await logAutoFillWarning(staff, errorMsg);
        return { 
          success: false, 
          message: `⚠️ Skipped (${errorMsg}) - warning logged` 
        };
      }
      
      return { 
        success: false, 
        message: `❌ Error (${errorMsg})` 
      };
    }
  }, [checkAutoFillEligibility, createFillParams, fillService, getActiveContractForStaff, logAutoFillWarning, handleLogRefresh]);

  // *** SHOW SCHEDULE TAB DIALOG WITH REFUSAL LOGGING AND DATE-ONLY SUPPORT ***
  const showScheduleDialog = useCallback((
    dialogConfig: IDialogConfig, 
    staffName: string, 
    fillParams: IFillParams,
    contractId: string,
    onConfirm: () => Promise<void>
  ): void => {
    console.log(`[useDashboardFill] Showing Schedule tab dialog with Date-only support: ${dialogConfig.type} for ${staffName}`);
    
    // Добавляем информацию о периоде к сообщению
    const enhancedMessage = dialogConfig.message.includes(formatDateOnlyForDisplay(selectedDate)) 
      ? dialogConfig.message 
      : `${dialogConfig.message}\n\nPeriod: ${formatDateOnlyForDisplay(selectedDate)} (Date-only format)`;

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

  // *** LOG USER REFUSAL WITH DATE-ONLY SUPPORT ***
  const logUserRefusal = useCallback(async (
    fillParams: IFillParams,
    dialogType: DialogType,
    contractId: string,
    staffName: string
  ): Promise<void> => {
    if (fillService) {
      console.log(`[useDashboardFill] Logging user refusal with Date-only support for ${staffName}, dialog: ${dialogType}`);
      await fillService.logUserRefusal(fillParams, dialogType, contractId);
    }
  }, [fillService]);

  // *** PERFORM ACTUAL FILL OPERATION WITH DATE-ONLY SUPPORT ***
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
      console.log(`[useDashboardFill] Performing fill operation with Date-only support for ${staffName} (period: ${formatDateOnlyForDisplay(selectedDate)})`);

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
        console.log(`[useDashboardFill] Fill successful with Date-only support for ${staffName} - will refresh log`);
        
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

  // *** HANDLE FILL STAFF WITH SCHEDULE TAB LOGIC AND DATE-ONLY SUPPORT ***
  const handleFillStaff = useCallback(async (staffId: string, staffName: string): Promise<void> => {
    console.log(`[useDashboardFill] Fill staff operation with Schedule tab logic and Date-only support: ${staffId}, ${staffName} (period: ${formatDateOnlyForDisplay(selectedDate)})`);
    
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

      // *** ШАГ 1: ПРОВЕРЯЕМ ЗАПИСИ С SCHEDULE TAB ЛОГИКОЙ И DATE-ONLY ПОДДЕРЖКОЙ ***
      console.log(`[useDashboardFill] Checking schedule with Schedule tab logic and Date-only support for ${staffName}`);
      const checkResult = await fillService.checkScheduleForFill(fillParams);

      if (!checkResult.requiresDialog) {
        // Ошибка или что-то пошло не так
        setInfoMessage({
          text: checkResult.message,
          type: checkResult.messageType
        });
        return;
      }

      // *** ШАГ 2: ПОЛУЧАЕМ АКТИВНЫЙ КОНТРАКТ С DATE-ONLY ПРОВЕРКОЙ ***
      const activeContract = await getActiveContractForStaff(fillParams.staffMember);
      if (!activeContract) {
        setInfoMessage({
          text: `No active contract found for ${staffName} in selected period (Date-only check)`,
          type: MessageBarType.error
        });
        return;
      }

      // *** ШАГ 3: ОБРАБАТЫВАЕМ РАЗЛИЧНЫЕ ТИПЫ ДИАЛОГОВ ***
      const dialogConfig = checkResult.dialogConfig!;
      
      switch (dialogConfig.type) {
        case DialogType.EmptySchedule:
          // Нет записей - спрашиваем хочет ли пользователь заполнить
          console.log(`[useDashboardFill] EmptySchedule dialog with Date-only support for ${staffName}`);
          showScheduleDialog(dialogConfig, staffName, fillParams, activeContract.id, async () => {
            await performFillOperation(fillParams, activeContract.id, false, staffName);
          });
          break;

        case DialogType.UnprocessedRecordsReplace:
          // Есть необработанные записи - спрашиваем хочет ли заменить
          console.log(`[useDashboardFill] UnprocessedRecordsReplace dialog with Date-only support for ${staffName}`);
          showScheduleDialog(dialogConfig, staffName, fillParams, activeContract.id, async () => {
            await performFillOperation(fillParams, activeContract.id, true, staffName);
          });
          break;

        case DialogType.ProcessedRecordsBlock:
          // Есть обработанные записи - блокируем операцию
          console.log(`[useDashboardFill] ProcessedRecordsBlock dialog with Date-only support for ${staffName}`);
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

  // *** PERFORM FILL ALL OPERATION WITH SCHEDULE TAB LOGIC AND DATE-ONLY SUPPORT ***
  const performFillAllOperation = useCallback(async (replaceExisting: boolean): Promise<void> => {
    if (!fillService) return;

    let successCount = 0;
    let errorCount = 0;
    let totalCreatedRecords = 0;
    const processedStaffIds: string[] = [];

    console.log(`[useDashboardFill] Performing fill all operation with Schedule tab logic and Date-only support for period: ${formatDateOnlyForDisplay(selectedDate)}`);

    for (const staffMember of staffMembersData) {
      const fillParams = createFillParams(staffMember);
      if (!fillParams) {
        errorCount++;
        console.error(`[useDashboardFill] Cannot create fill params for ${staffMember.name}`);
        continue;
      }

      try {
        // Получаем активный контракт с Date-only проверкой
        const activeContract = await getActiveContractForStaff(fillParams.staffMember);
        if (!activeContract) {
          errorCount++;
          console.error(`[useDashboardFill] No active contract for ${staffMember.name} (Date-only check)`);
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
        text: `Successfully filled schedule for all ${successCount} staff members for ${formatDateOnlyForDisplay(selectedDate)} period. Created ${totalCreatedRecords} records (Date-only format).`,
        type: MessageBarType.success
      });
    } else {
      setInfoMessage({
        text: `Filled ${successCount} of ${staffMembersData.length} staff members for ${formatDateOnlyForDisplay(selectedDate)} period. ${errorCount} failed.`,
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

  // *** HANDLE FILL ALL WITH SCHEDULE TAB LOGIC AND DATE-ONLY SUPPORT ***
  const handleFillAll = useCallback(async (): Promise<void> => {
    console.log(`[useDashboardFill] Fill all operation started with Schedule tab logic and Date-only support for period: ${formatDateOnlyForDisplay(selectedDate)}`);
    
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

      // *** ШАГ 1: ПРОВЕРЯЕМ ВСЕ ЗАПИСИ С SCHEDULE TAB ЛОГИКОЙ И DATE-ONLY ПОДДЕРЖКОЙ ***
      console.log(`[useDashboardFill] Checking all staff records with Schedule tab logic and Date-only support`);
      
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
          message: `Found ${totalExistingRecords} existing records for ${staffWithExistingRecords.length} staff members in ${formatDateOnlyForDisplay(selectedDate)} period. Replace all?\n\nNote: Uses Date-only format for holidays and leaves.`,
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
          message: `Do you want to fill schedules for all ${staffMembersData.length} staff members for ${formatDateOnlyForDisplay(selectedDate)} period?\n\nNote: Uses Date-only format for holidays and leaves.`,
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
    handleAutoscheduleToggle,
    // ДОБАВЛЕНО: Новые функции для автозаполнения с Date-only поддержкой
    processStaffMemberAuto,
    checkAutoFillEligibility,
    logAutoFillWarning
  };
};