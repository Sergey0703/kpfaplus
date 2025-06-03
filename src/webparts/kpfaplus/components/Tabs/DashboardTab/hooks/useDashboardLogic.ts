// src/webparts/kpfaplus/components/Tabs/DashboardTab/hooks/useDashboardLogic.ts
import { useState, useEffect, useMemo } from 'react';
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from "@microsoft/sp-webpart-base"; // ADD THIS IMPORT
import { useDataContext } from '../../../../context';
import { IStaffMember } from '../../../../models/types';
import { IStaffMemberWithAutoschedule } from '../components/DashboardTable';
import { CommonFillService, IFillParams } from '../../../../services/CommonFillService';

// Интерфейс для информационных сообщений
interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

// Интерфейс для диалога подтверждения
interface IConfirmDialogState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  onConfirm: () => void;
}

// Форматирование даты в формате dd.mm.yyyy
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

// Функция для получения первого дня текущего месяца
const getFirstDayOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

// Функция для получения сохраненной даты или первого дня месяца по умолчанию
const getSavedSelectedDate = (): Date => {
  try {
    const savedDate = sessionStorage.getItem('dashboardTab_selectedDate');
    if (savedDate) {
      const parsedDate = new Date(savedDate);
      if (!isNaN(parsedDate.getTime())) {
        console.log('[useDashboardLogic] Restored selected date from sessionStorage:', parsedDate.toISOString());
        return parsedDate;
      } else {
        console.warn('[useDashboardLogic] Invalid date found in sessionStorage, using first day of current month');
      }
    } else {
      console.log('[useDashboardLogic] No saved date found in sessionStorage, using first day of current month');
    }
  } catch (error) {
    console.warn('[useDashboardLogic] Error reading saved date from sessionStorage:', error);
  }
  
  const firstDay = getFirstDayOfCurrentMonth();
  console.log('[useDashboardLogic] Using first day of current month as default:', firstDay.toISOString());
  return firstDay;
};

interface IUseDashboardLogicReturn {
  staffMembersData: IStaffMemberWithAutoschedule[];
  selectedDate: Date;
  isLoading: boolean;
  infoMessage: IInfoMessage | undefined;
  confirmDialog: IConfirmDialogState;
  setInfoMessage: (message: IInfoMessage | undefined) => void;
  setConfirmDialog: (dialog: IConfirmDialogState | ((prev: IConfirmDialogState) => IConfirmDialogState)) => void; // FIX THIS TYPE
  handleDateChange: (date: Date | undefined) => void;
  handleAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  handleFillStaff: (staffId: string, staffName: string) => Promise<void>;
  handleFillAll: () => Promise<void>;
}

export const useDashboardLogic = (context?: WebPartContext): IUseDashboardLogicReturn => {
  console.log('[useDashboardLogic] Hook initialized');

  // Получаем данные из контекста
  const {
    staffMembers,
    updateStaffMember
  } = useDataContext();

  // Состояния - инициализируем selectedDate из sessionStorage или первым днем месяца
  const [selectedDate, setSelectedDate] = useState<Date>(getSavedSelectedDate());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [infoMessage, setInfoMessage] = useState<IInfoMessage | undefined>(undefined);
  const [confirmDialog, setConfirmDialog] = useState<IConfirmDialogState>({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: 'Confirm',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '#0078d4',
    onConfirm: () => {}
  });

  console.log('[useDashboardLogic] Initialized with date:', formatDate(selectedDate));

  // Инициализируем CommonFillService
  const fillService = useMemo(() => {
    if (context) {
      return CommonFillService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Подготавливаем данные для таблицы (только неудаленные сотрудники)
  const staffMembersData = useMemo((): IStaffMemberWithAutoschedule[] => {
    console.log('[useDashboardLogic] Processing staff members:', staffMembers.length);
    
    const activeStaff = staffMembers
      .filter((staff: IStaffMember) => staff.deleted !== 1) // Только неудаленные
      .map((staff: IStaffMember) => ({
        id: staff.id,
        name: staff.name,
        employeeId: staff.employeeId || 'N/A',
        autoschedule: staff.autoSchedule || false,
        deleted: staff.deleted || 0
      }));

    console.log('[useDashboardLogic] Active staff members:', activeStaff.length);
    return activeStaff;
  }, [staffMembers]);

  // Автоматическое скрытие сообщений через 5 секунд
  useEffect(() => {
    if (infoMessage) {
      const timer = setTimeout(() => {
        setInfoMessage(undefined);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  // Обработчик изменения даты с сохранением в sessionStorage
  const handleDateChange = (date: Date | undefined): void => {
    if (date) {
      console.log('[useDashboardLogic] Date selected:', formatDate(date));
      
      // Сохраняем дату в sessionStorage
      try {
        sessionStorage.setItem('dashboardTab_selectedDate', date.toISOString());
        console.log('[useDashboardLogic] Selected date saved to sessionStorage:', date.toISOString());
      } catch (error) {
        console.warn('[useDashboardLogic] Error saving selected date to sessionStorage:', error);
      }
      
      setSelectedDate(date);
    }
  };

  // Обработчик для изменения autoschedule конкретного сотрудника
  const handleAutoscheduleToggle = async (staffId: string, checked: boolean): Promise<void> => {
    console.log('[useDashboardLogic] Autoschedule toggle for staff:', staffId, 'checked:', checked);
    
    try {
      setIsLoading(true);
      
      // Обновляем через контекст
      const success = await updateStaffMember(staffId, { autoSchedule: checked });
      
      if (success) {
        setInfoMessage({
          text: `Autoschedule updated for staff member`,
          type: MessageBarType.success
        });
      } else {
        throw new Error('Failed to update autoschedule');
      }
    } catch (error) {
      console.error('[useDashboardLogic] Error updating autoschedule:', error);
      setInfoMessage({
        text: `Error updating autoschedule: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Вспомогательная функция для создания параметров заполнения
  const createFillParams = (staffMember: IStaffMemberWithAutoschedule): IFillParams | undefined => {
    if (!context) {
      console.error('[useDashboardLogic] Context not available for fill operation');
      return undefined;
    }

    // Находим полный объект сотрудника
    const fullStaffMember = staffMembers.find(staff => staff.id === staffMember.id);
    if (!fullStaffMember) {
      console.error('[useDashboardLogic] Staff member not found:', staffMember.id);
      return undefined;
    }

    return {
      selectedDate,
      staffMember: fullStaffMember,
      currentUserId: undefined, // Will be set by calling function
      managingGroupId: undefined, // Will be set by calling function  
      dayOfStartWeek: 7, // Суббота по умолчанию
      context
    };
  };

  // Вспомогательная функция для выполнения операции заполнения
  const performFillOperation = async (fillParams: IFillParams, staffName: string, replaceExisting: boolean): Promise<void> => {
    if (!fillService) return;

    try {
      setIsLoading(true);
      console.log(`[useDashboardLogic] Performing fill operation for ${staffName}, replace=${replaceExisting}`);

      const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);

      setInfoMessage({
        text: `${staffName}: ${result.message}`,
        type: result.messageType
      });

      if (result.success) {
        console.log(`[useDashboardLogic] Fill operation successful for ${staffName}:`, {
          created: result.createdRecordsCount,
          deleted: result.deletedRecordsCount
        });
      }

    } catch (error) {
      console.error(`[useDashboardLogic] Error during fill operation for ${staffName}:`, error);
      setInfoMessage({
        text: `Error filling schedule for ${staffName}: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик для кнопки Fill конкретного сотрудника
  const handleFillStaff = async (staffId: string, staffName: string): Promise<void> => {
    console.log('[useDashboardLogic] Fill clicked for staff:', staffId, 'date:', formatDate(selectedDate));
    
    if (!fillService) {
      setInfoMessage({
        text: 'Fill service not available',
        type: MessageBarType.error
      });
      return;
    }

    // Находим сотрудника в данных
    const staffMember = staffMembersData.find(staff => staff.id === staffId);
    if (!staffMember) {
      setInfoMessage({
        text: `Staff member not found: ${staffName}`,
        type: MessageBarType.error
      });
      return;
    }

    // Создаем параметры для заполнения
    const fillParams = createFillParams(staffMember);
    if (!fillParams) {
      setInfoMessage({
        text: 'Cannot create fill parameters',
        type: MessageBarType.error
      });
      return;
    }

    try {
      setIsLoading(true);

      // Проверяем существующие записи
      console.log('[useDashboardLogic] Checking existing records for staff:', staffName);
      const existingCheck = await fillService.checkExistingRecords(fillParams);

      if (existingCheck.hasExistingRecords) {
        // Есть существующие записи - показываем диалог подтверждения
        if (existingCheck.hasProcessedRecords) {
          // Есть обработанные записи - блокируем операцию
          setInfoMessage({
            text: `Cannot replace records for ${staffName}: ${existingCheck.processedCount} of ${existingCheck.recordsCount} records have been processed (checked or exported). Manual review required.`,
            type: MessageBarType.error
          });
          return;
        } else {
          // Есть необработанные записи - запрашиваем подтверждение
          setConfirmDialog({
            isOpen: true,
            title: 'Replace Existing Records',
            message: `Found ${existingCheck.recordsCount} existing unprocessed records for ${staffName} in ${formatDate(selectedDate)} period. Replace them with new records from template?`,
            confirmButtonText: 'Replace',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#d83b01', // Оранжевый цвет для предупреждения
            onConfirm: async () => {
              setConfirmDialog(prev => ({ ...prev, isOpen: false }));
              // Выполняем заполнение с заменой
              await performFillOperation(fillParams, staffName, true);
            }
          });
          return;
        }
      } else {
        // Нет существующих записей - выполняем заполнение напрямую
        await performFillOperation(fillParams, staffName, false);
      }

    } catch (error) {
      console.error('[useDashboardLogic] Error in Fill operation:', error);
      setInfoMessage({
        text: `Error in Fill operation for ${staffName}: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Вспомогательная функция для выполнения операции заполнения для всех
  const performFillAllOperation = async (replaceExisting: boolean): Promise<void> => {
    if (!fillService) return;

    try {
      setIsLoading(true);
      console.log(`[useDashboardLogic] Performing fill all operation, replace=${replaceExisting}`);

      let successCount = 0;
      let errorCount = 0;
      let totalCreatedRecords = 0;
      let totalDeletedRecords = 0;

      // Обрабатываем каждого сотрудника последовательно
      for (let i = 0; i < staffMembersData.length; i++) {
        const staffMember = staffMembersData[i];
        
        console.log(`[useDashboardLogic] Processing staff ${i + 1}/${staffMembersData.length}: ${staffMember.name}`);
        
        const fillParams = createFillParams(staffMember);
        if (fillParams) {
          try {
            const result = await fillService.fillScheduleForStaff(fillParams, replaceExisting);
            
            if (result.success) {
              successCount++;
              totalCreatedRecords += result.createdRecordsCount || 0;
              totalDeletedRecords += result.deletedRecordsCount || 0;
              console.log(`[useDashboardLogic] ✓ Successfully filled schedule for ${staffMember.name}`);
            } else {
              errorCount++;
              console.error(`[useDashboardLogic] ✗ Failed to fill schedule for ${staffMember.name}: ${result.message}`);
            }
          } catch (error) {
            errorCount++;
            console.error(`[useDashboardLogic] ✗ Error filling schedule for ${staffMember.name}:`, error);
          }
        } else {
          errorCount++;
          console.error(`[useDashboardLogic] ✗ Cannot create fill parameters for ${staffMember.name}`);
        }

        // Небольшая пауза между операциями
        if (i < staffMembersData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Показываем результат
      console.log(`[useDashboardLogic] Fill all operation completed: ${successCount} success, ${errorCount} errors`);
      
      if (errorCount === 0) {
        setInfoMessage({
          text: `Successfully filled schedule for all ${successCount} staff members. Created ${totalCreatedRecords} records${totalDeletedRecords > 0 ? `, replaced ${totalDeletedRecords} existing records` : ''}.`,
          type: MessageBarType.success
        });
      } else if (successCount > 0) {
        setInfoMessage({
          text: `Filled schedule for ${successCount} of ${staffMembersData.length} staff members. ${errorCount} failed. Created ${totalCreatedRecords} records.`,
          type: MessageBarType.warning
        });
      } else {
        setInfoMessage({
          text: `Failed to fill schedule for any staff members. Please check the logs and try again.`,
          type: MessageBarType.error
        });
      }

    } catch (error) {
      console.error('[useDashboardLogic] Error during fill all operation:', error);
      setInfoMessage({
        text: `Error during Fill in All operation: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик для кнопки Fill in All
  const handleFillAll = async (): Promise<void> => {
    console.log('[useDashboardLogic] Fill in All clicked for date:', formatDate(selectedDate));
    console.log('[useDashboardLogic] Active staff count:', staffMembersData.length);
    
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

      // Проверяем существующие записи для всех сотрудников
      console.log('[useDashboardLogic] Checking existing records for all staff members...');
      
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
        // Есть обработанные записи - блокируем операцию
        setInfoMessage({
          text: `Cannot fill all: Found ${totalProcessedRecords} processed records across staff members. Manual review required.`,
          type: MessageBarType.error
        });
        return;
      }

      if (totalExistingRecords > 0) {
        // Есть существующие записи - запрашиваем подтверждение
        setConfirmDialog({
          isOpen: true,
          title: 'Replace All Existing Records',
          message: `Found ${totalExistingRecords} existing unprocessed records for ${staffWithExistingRecords.length} staff members in ${formatDate(selectedDate)} period. Replace all with new records from templates?`,
          confirmButtonText: 'Replace All',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#d83b01', // Оранжевый цвет для предупреждения
          onConfirm: async () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            // Выполняем заполнение для всех с заменой
            await performFillAllOperation(true);
          }
        });
        return;
      } else {
        // Нет существующих записей - выполняем заполнение для всех
        await performFillAllOperation(false);
      }

    } catch (error) {
      console.error('[useDashboardLogic] Error in Fill in All:', error);
      setInfoMessage({
        text: `Error in Fill in All operation: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    staffMembersData,
    selectedDate,
    isLoading,
    infoMessage,
    confirmDialog,
    setInfoMessage,
    setConfirmDialog,
    handleDateChange,
    handleAutoscheduleToggle,
    handleFillStaff,
    handleFillAll
  };
};