// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillOperations.ts
import { MessageBarType } from '@fluentui/react';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';

/**
 * Интерфейс для параметров операции заполнения расписания
 */
export interface IFillOperationParams {
  selectedDate: Date;
  selectedStaffId: string;
  employeeId: string;
  selectedContract: IContract | undefined;
  selectedContractId: string | undefined;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;
}

/**
 * Интерфейс для обработчиков и функций, необходимых для операции заполнения
 */
export interface IFillOperationHandlers {
  createStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
  setOperationMessage: (message: { text: string; type: MessageBarType } | null) => void;
  setIsSaving: (isSaving: boolean) => void;
  onRefreshData?: () => void;
}

/**
 * Основная функция для заполнения расписания на основе шаблонов
 * @placeholder Здесь будет реализована логика заполнения расписания
 */
export const fillScheduleFromTemplate = async (
  params: IFillOperationParams,
  handlers: IFillOperationHandlers
): Promise<void> => {
  const { setOperationMessage, setIsSaving, onRefreshData } = handlers;
  const { selectedContract, selectedContractId, employeeId } = params;

  // Предварительная проверка данных
  if (!selectedContract || !selectedContractId) {
    setOperationMessage({
      text: 'Cannot fill schedule: No contract selected',
      type: MessageBarType.error
    });
    return;
  }

  if (!employeeId) {
    setOperationMessage({
      text: 'Cannot fill schedule: Invalid employee ID',
      type: MessageBarType.error
    });
    return;
  }

  // Устанавливаем состояние загрузки
  setIsSaving(true);

  try {
    // Здесь будет логика заполнения расписания на основе шаблонов
    // Эта реализация будет добавлена в будущем
    
    // Временное сообщение о том, что функция еще не реализована
    setOperationMessage({
      text: `Schedule filling operation from template "${selectedContract.template}" is not yet implemented.`,
      type: MessageBarType.warning
    });
    
    // Обновляем данные, если функция доступна
    if (onRefreshData) {
      onRefreshData();
    }
  } catch (error) {
    console.error('Error during schedule fill operation:', error);
    setOperationMessage({
      text: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
      type: MessageBarType.error
    });
  } finally {
    setIsSaving(false);
  }
};

/**
 * Функция для создания диалога подтверждения заполнения расписания
 */
export const createFillConfirmationDialog = (
  hasExistingRecords: boolean,
  onConfirm: () => void
): {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  onConfirm: () => void;
  confirmButtonColor: string;
} => {
  if (hasExistingRecords) {
    // Если есть существующие записи, показываем предупреждение
    return {
      isOpen: true,
      title: 'Confirm Fill Operation',
      message: 'There are existing records in the schedule. Filling the schedule will overwrite any changes. Do you want to continue?',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#d83b01' // Оранжевый цвет для предупреждения
    };
  } else {
    // Если записей нет, показываем простой диалог подтверждения
    return {
      isOpen: true,
      title: 'Fill Schedule',
      message: 'Do you want to fill the schedule based on template data?',
      confirmButtonText: 'Fill',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#107c10' // Зеленый цвет для подтверждения
    };
  }
}