// src/webparts/kpfaplus/components/Tabs/ContractsTab/actions/WeeklyTimeTableDialogActions.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MessageBarType } from '@fluentui/react';
import { IExtendedWeeklyTimeRow } from '../WeeklyTimeTableLogic';
import { DialogType, ExecuteAddNewWeekFn, ExecuteAddNewShiftFn } from './WeeklyTimeTableTypes';

/**
 * Функция для настройки диалога подтверждения для различных действий
 */
export const createShowConfirmDialog = (
  pendingActionRowIdRef: React.MutableRefObject<string | null>,
  setConfirmDialogProps: React.Dispatch<React.SetStateAction<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmButtonText: string;
    cancelButtonText: string;
    onConfirm: () => void;
    confirmButtonColor: string;
  }>>,
  deleteHandler: (rowIndex: number) => Promise<void>,
  timeTableData: IExtendedWeeklyTimeRow[],
  context: WebPartContext,
  contractId: string | undefined,
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | null>>,
  currentUserId: number,
  onSaveComplete?: (success: boolean) => void,
  onRefresh?: () => void,
  // Добавляем параметры для функций из WeeklyTimeTableAddActions
  executeAddNewWeek?: ExecuteAddNewWeekFn,
  executeAddNewShift?: ExecuteAddNewShiftFn
) => {
  return (rowId: string, dialogType: DialogType = DialogType.DELETE, additionalData?: any): void => {
    console.log(`Setting up dialog: type=${dialogType}, rowId=${rowId}`);
    
    // Сохраняем ID строки в ref
    pendingActionRowIdRef.current = rowId;
    
    // Настраиваем диалог в зависимости от типа
    switch (dialogType) {
      case DialogType.DELETE:
        // Диалог удаления - найдем строку по ID
        const rowIndex = timeTableData.findIndex(row => row.id === rowId);
        if (rowIndex === -1) {
          console.error(`Row with ID ${rowId} not found`);
          return;
        }
        
        setConfirmDialogProps({
          isOpen: true,
          title: 'Confirm Deletion',
          message: 'Are you sure you want to delete this shift?',
          confirmButtonText: 'Delete',
          cancelButtonText: 'Cancel',
          onConfirm: () => {
            const rowId = pendingActionRowIdRef.current;
            if (rowId) {
              const rowIndex = timeTableData.findIndex(row => row.id === rowId);
              if (rowIndex !== -1) {
                deleteHandler(rowIndex)
                  .then(() => {
                    console.log(`Row ${rowId} deleted successfully`);
                    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
                    pendingActionRowIdRef.current = null;
                  })
                  .catch(err => {
                    console.error(`Error deleting row ${rowId}:`, err);
                    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
                    pendingActionRowIdRef.current = null;
                  });
              }
            }
          },
          confirmButtonColor: '#d83b01' // красный цвет для удаления
        });
        break;
      
      case DialogType.RESTORE:
        // Диалог восстановления
        setConfirmDialogProps({
          isOpen: true,
          title: 'Confirm Restoration',
          message: 'Are you sure you want to restore this shift?',
          confirmButtonText: 'Restore',
          cancelButtonText: 'Cancel',
          onConfirm: () => {
            const rowId = pendingActionRowIdRef.current;
            if (rowId) {
              const rowIndex = timeTableData.findIndex(row => row.id === rowId);
              if (rowIndex !== -1) {
                deleteHandler(rowIndex)
                  .then(() => {
                    console.log(`Row ${rowId} restored successfully`);
                    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
                    pendingActionRowIdRef.current = null;
                  })
                  .catch(err => {
                    console.error(`Error restoring row ${rowId}:`, err);
                    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
                    pendingActionRowIdRef.current = null;
                  });
              }
            }
          },
          confirmButtonColor: '#107c10' // зеленый цвет для восстановления
        });
        break;
      
      case DialogType.ADD_WEEK:
        // Диалог добавления новой недели
        const addWeekCheck = additionalData;
        if (!addWeekCheck || !addWeekCheck.canAdd) {
          console.error('Invalid add week check result');
          return;
        }
        
        setConfirmDialogProps({
          isOpen: true,
          title: 'Add New Week',
          message: `${addWeekCheck.message} Are you sure you want to add a new week?`,
          confirmButtonText: 'Add',
          cancelButtonText: 'Cancel',
          onConfirm: () => {
            // Закрываем диалог
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
            pendingActionRowIdRef.current = null;

            // Используем executeAddNewWeek, переданный как параметр, если он доступен
            if (executeAddNewWeek) {
              executeAddNewWeek(
                context,
                timeTableData,
                setTimeTableData,
                contractId,
                changedRows,
                setChangedRows,
                setIsSaving,
                setStatusMessage,
                addWeekCheck.weekNumberToAdd,
                currentUserId, 
                onSaveComplete,
                onRefresh
              );
            } else {
              // Если параметр не передан, пробуем использовать динамический импорт
              import('./WeeklyTimeTableAddActions').then(module => {
                module.executeAddNewWeek(
                  context,
                  timeTableData,
                  setTimeTableData,
                  contractId,
                  changedRows,
                  setChangedRows,
                  setIsSaving,
                  setStatusMessage,
                  addWeekCheck.weekNumberToAdd,
                  currentUserId, 
                  onSaveComplete,
                  onRefresh
                );
              }).catch(error => {
                console.error('Error importing WeeklyTimeTableAddActions:', error);
                setStatusMessage({
                  type: MessageBarType.error,
                  message: 'Failed to add new week due to a technical issue. Please try again.'
                });
              });
            }
          },
          confirmButtonColor: '#0078d4' // синий цвет для добавления
        });
        break;
      
      case DialogType.ADD_SHIFT:
        // Диалог добавления новой смены
        const addShiftData = additionalData;
        if (!addShiftData || !addShiftData.weekNumber || !addShiftData.nextShiftNumber) {
          console.error('Invalid add shift data');
          return;
        }
        
        setConfirmDialogProps({
          isOpen: true,
          title: 'Add New Shift',
          message: `Do you want to add a new shift ${addShiftData.nextShiftNumber} for week ${addShiftData.weekNumber}?`,
          confirmButtonText: 'Add Shift',
          cancelButtonText: 'Cancel',
          onConfirm: () => {
            // Закрываем диалог
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
            pendingActionRowIdRef.current = null;

            // Используем executeAddNewShift, переданный как параметр, если он доступен
            if (executeAddNewShift) {
              executeAddNewShift(
                context,
                timeTableData,
                setTimeTableData,
                contractId,
                changedRows,
                setChangedRows,
                setIsSaving,
                setStatusMessage,
                addShiftData.weekNumber,
                addShiftData.nextShiftNumber,
                currentUserId, 
                onSaveComplete,
                onRefresh
              );
            } else {
              // Если параметр не передан, пробуем использовать динамический импорт
              import('./WeeklyTimeTableAddActions').then(module => {
                module.executeAddNewShift(
                  context,
                  timeTableData,
                  setTimeTableData,
                  contractId,
                  changedRows,
                  setChangedRows,
                  setIsSaving,
                  setStatusMessage,
                  addShiftData.weekNumber,
                  addShiftData.nextShiftNumber,
                  currentUserId, 
                  onSaveComplete,
                  onRefresh
                );
              }).catch(error => {
                console.error('Error importing WeeklyTimeTableAddActions:', error);
                setStatusMessage({
                  type: MessageBarType.error,
                  message: 'Failed to add new shift due to a technical issue. Please try again.'
                });
              });
            }
          },
          confirmButtonColor: '#0078d4' // синий цвет для добавления
        });
        break;
      
      case DialogType.INFO:
        // Информационный диалог
        const infoMessage = additionalData?.message || 'Information';
        const customAction = additionalData?.customAction;
        
        setConfirmDialogProps({
          isOpen: true,
          title: 'Information',
          message: infoMessage,
          confirmButtonText: additionalData?.confirmButtonText || 'OK',
          cancelButtonText: additionalData?.cancelButtonText || 'Cancel',
          onConfirm: () => {
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
            pendingActionRowIdRef.current = null;
            
            // Если есть кастомное действие при подтверждении
            if (customAction && typeof customAction === 'function') {
              customAction(true);
            }
          },
          confirmButtonColor: '#0078d4' // синий цвет для информации
        });
        break;
      
      default:
        console.error(`Unknown dialog type: ${dialogType}`);
    }
  };
};

/**
 * Функция для настройки диалога подтверждения удаления или восстановления
 * (для обратной совместимости с существующим кодом)
 */
export const createShowDeleteConfirmDialog = createShowConfirmDialog;