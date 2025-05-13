// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableActions.ts
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IExtendedWeeklyTimeRow, updateDisplayedTotalHours } from './WeeklyTimeTableLogic';
import { IWeeklyTimeTableUpdateItem, WeeklyTimeTableService } from '../../../services/WeeklyTimeTableService';
import { IDayHours } from '../../../models/IWeeklyTimeTable';

/**
 * Функция для сохранения изменений в недельном расписании
 * @param context Контекст веб-части
 * @param timeTableData Данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param contractId ID контракта
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setIsSaving Функция для обновления статуса сохранения
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @param onSaveComplete Функция обратного вызова после сохранения
 * @returns Функция для сохранения изменений
 */
export const createSaveHandler = (
  context: WebPartContext,
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  contractId: string | undefined,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | null>>,
  onSaveComplete?: (success: boolean) => void
) => {
  return async (): Promise<void> => {
    // Если нет измененных строк, ничего не делаем
    if (changedRows.size === 0) {
      console.log('No changes to save');
      return;
    }
    
    // Обновляем состояние для индикации процесса сохранения
    setIsSaving(true);
    setStatusMessage(null);
    
    try {
      // Создаем сервис для работы с данными
      const service = new WeeklyTimeTableService(context);
      
      // Формируем массив данных для обновления
      const itemsToUpdate: IWeeklyTimeTableUpdateItem[] = [];
      
      // Обрабатываем каждую измененную строку
      for (const row of timeTableData.filter(row => changedRows.has(row.id))) {
        // Проверяем, является ли ID временным (новая строка)
        const isNewRow = row.id.startsWith('new_');
        
        if (isNewRow) {
          // Если новая строка, сначала создаем ее
          try {
            // Создаем объект для нового элемента
            const newItem: IWeeklyTimeTableUpdateItem = {
              id: row.id, // Временный ID
              
              // Время начала
              mondayStart: row.monday?.start,
              tuesdayStart: row.tuesday?.start,
              wednesdayStart: row.wednesday?.start,
              thursdayStart: row.thursday?.start,
              fridayStart: row.friday?.start,
              saturdayStart: row.saturday?.start,
              sundayStart: row.sunday?.start,
              
              // Время окончания
              mondayEnd: row.monday?.end,
              tuesdayEnd: row.tuesday?.end,
              wednesdayEnd: row.wednesday?.end,
              thursdayEnd: row.thursday?.end,
              fridayEnd: row.friday?.end,
              saturdayEnd: row.saturday?.end,
              sundayEnd: row.sunday?.end,
              
              lunchMinutes: row.lunch,
              contractNumber: row.total
            };
            
            // Вызываем метод создания и получаем реальный ID
            const realId = await service.createWeeklyTimeTableItem(
              newItem, 
              contractId || '', 
              context.pageContext.user.loginName
            );
            
            // Обновляем ID в локальных данных
            const rowIndex = timeTableData.findIndex(r => r.id === row.id);
            if (rowIndex >= 0) {
              const updatedRow = {...timeTableData[rowIndex], id: realId};
              const newData = [...timeTableData];
              newData[rowIndex] = updatedRow;
              setTimeTableData(newData);
            }
            
            // Удаляем этот элемент из списка измененных строк
            const newChangedRows = new Set(changedRows);
            newChangedRows.delete(row.id);
            // Добавляем новый ID в список измененных строк
            newChangedRows.add(realId);
            setChangedRows(newChangedRows);
            
            console.log(`Created new time table row with ID: ${realId}`);
          } catch (createError) {
            console.error('Error creating new time table row:', createError);
            throw new Error(`Failed to create new row: ${createError instanceof Error ? createError.message : 'Unknown error'}`);
          }
        } else {
          // Если существующая строка, добавляем в список для обновления
          itemsToUpdate.push({
            id: row.id,
            
            // Время начала
            mondayStart: row.monday?.start,
            tuesdayStart: row.tuesday?.start,
            wednesdayStart: row.wednesday?.start,
            thursdayStart: row.thursday?.start,
            fridayStart: row.friday?.start,
            saturdayStart: row.saturday?.start,
            sundayStart: row.sunday?.start,
            
            // Время окончания
            mondayEnd: row.monday?.end,
            tuesdayEnd: row.tuesday?.end,
            wednesdayEnd: row.wednesday?.end,
            thursdayEnd: row.thursday?.end,
            fridayEnd: row.friday?.end,
            saturdayEnd: row.saturday?.end,
            sundayEnd: row.sunday?.end,
            
            lunchMinutes: row.lunch,
            contractNumber: row.total
          });
        }
      }
      
      if (itemsToUpdate.length > 0) {
        console.log('Saving changes for items:', itemsToUpdate);
        
        // Выполняем обновление данных
        const results = await service.batchUpdateWeeklyTimeTable(itemsToUpdate);
        
        console.log('Save results:', results);
      } else {
        console.log('No existing items to update after handling new rows');
      }
      
      // Очищаем список измененных строк
      setChangedRows(new Set());
      
      // Устанавливаем сообщение об успешном сохранении
      setStatusMessage({
        type: MessageBarType.success,
        message: `Successfully saved changes.`
      });
      
      // Вызываем коллбэк завершения сохранения, если он задан
      if (onSaveComplete) {
        onSaveComplete(true);
      }
    } catch (error) {
      console.error('Error saving weekly time table data:', error);
      
      // Устанавливаем сообщение об ошибке
      setStatusMessage({
        type: MessageBarType.error,
        message: `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Вызываем коллбэк завершения сохранения с ошибкой, если он задан
      if (onSaveComplete) {
        onSaveComplete(false);
      }
    } finally {
      // В любом случае снимаем индикацию процесса сохранения
      setIsSaving(false);
    }
  };
};

/**
 * Функция для добавления новой смены
 * @param timeTableData Данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @returns Функция для добавления новой смены
 */
export const createAddShiftHandler = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | null>>
) => {
  return (): void => {
    const newId = `new_${Date.now()}`; // Временный ID для новой строки
    const weekNumber = Math.ceil((timeTableData.length + 1) / 2);
    const isSecondShift = timeTableData.length % 2 === 1;
    
    // Создаем объекты для пустого времени начала и окончания
    const emptyTime: IDayHours = { hours: '00', minutes: '00' };
    
    const newRow: IExtendedWeeklyTimeRow = {
      id: newId,
      name: `Week ${weekNumber}${isSecondShift ? ' Shift 2' : ''}`,
      lunch: '30',
      totalHours: '0ч:00м', // Изначально 0 часов 0 минут
      NumberOfWeek: weekNumber,
      NumberOfShift: isSecondShift ? 2 : 1,
      // Обновляем структуру с учетом нового формата
      saturday: { start: emptyTime, end: emptyTime },
      sunday: { start: emptyTime, end: emptyTime },
      monday: { start: emptyTime, end: emptyTime },
      tuesday: { start: emptyTime, end: emptyTime },
      wednesday: { start: emptyTime, end: emptyTime },
      thursday: { start: emptyTime, end: emptyTime },
      friday: { start: emptyTime, end: emptyTime },
      
      total: '1'
    };
    
    setTimeTableData([...timeTableData, newRow]);
    
    // Отмечаем новую строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(newId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при добавлении новой строки
    setStatusMessage(null);
    
    // Обновляем отображаемое общее время в первой строке каждого шаблона
    // Запускаем обновление с небольшой задержкой, чтобы дать время на обновление состояния
    setTimeout(() => {
      const updatedData = updateDisplayedTotalHours([...timeTableData, newRow]);
      setTimeTableData(updatedData);
    }, 0);
  };
};

export const createDeleteShiftHandler = (
  context: WebPartContext,
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<{
    type: MessageBarType;
    message: string;
  } | null>>
) => {
  return async (rowIndex: number): Promise<void> => {
    try {
      // Получаем ID строки для операции
      const rowId = timeTableData[rowIndex].id;
      const row = timeTableData[rowIndex];
      
      // Проверяем, удалена ли строка (для определения операции - удаление или восстановление)
      const isDeleted = row.deleted === 1 || row.Deleted === 1;
      const operationType = isDeleted ? 'restore' : 'delete';
      
      // Показываем индикатор загрузки
      setIsSaving(true);
      
      // Проверяем, является ли это новая строка (которая еще не была сохранена на сервере)
      const isNewRow = rowId.startsWith('new_');
      
      // Если это не новая строка, нужно обновить её статус на сервере
      if (!isNewRow) {
        // Создаем сервис для работы с данными
        const service = new WeeklyTimeTableService(context);
        
        try {
          let success = false;
          
          if (isDeleted) {
            // Восстановление записи (изменение Deleted с 1 на 0)
            success = await service.restoreWeeklyTimeTableItem(rowId);
            console.log(`Successfully restored item on server, ID: ${rowId}, result: ${success}`);
          } else {
            // Удаление записи (изменение Deleted с 0 на 1)
            success = await service.deleteWeeklyTimeTableItem(rowId);
            console.log(`Successfully deleted item on server, ID: ${rowId}, result: ${success}`);
          }
          
          if (!success) {
            throw new Error(`Server operation failed`);
          }
        } catch (serverError) {
          console.error(`Error ${operationType} item on server: ${serverError}`);
          throw new Error(`Failed to ${operationType} item on server: ${serverError instanceof Error ? serverError.message : 'Unknown error'}`);
        }
      }
      
      // После успешного обновления на сервере обновляем локальное состояние
      // Для удаления: установить deleted=1, для восстановления: установить deleted=0
      const newData = timeTableData.map((item, idx) => {
        if (idx === rowIndex) {
          return {
            ...item,
            deleted: isDeleted ? 0 : 1,  // Меняем статус на противоположный
            Deleted: isDeleted ? 0 : 1   // Обновляем оба поля для совместимости
          };
        }
        return item;
      });
      
      setTimeTableData(newData);
      
      // Удаляем строку из списка измененных, если она была там
      if (changedRows.has(rowId)) {
        const newChangedRows = new Set(changedRows);
        newChangedRows.delete(rowId);
        setChangedRows(newChangedRows);
      }
      
      // Обновляем отображаемое общее время в первой строке каждого шаблона
      setTimeout(() => {
        const updatedData = updateDisplayedTotalHours(newData);
        setTimeTableData(updatedData);
      }, 0);
      
      // Показываем сообщение об успешном выполнении операции
      setStatusMessage({
        type: MessageBarType.success,
        message: isDeleted ? 
          `Shift successfully restored` : 
          `Shift successfully deleted`
      });
      
      // Скрываем сообщение через 3 секунды
      setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    } catch (error) {
      console.error(`Error processing shift at row ${rowIndex}:`, error);
      
      // Показываем сообщение об ошибке
      setStatusMessage({
        type: MessageBarType.error,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw error;
    } finally {
      // В любом случае снимаем индикатор загрузки
      setIsSaving(false);
    }
  };
};
/**
 * Функция для настройки диалога подтверждения удаления или восстановления
 */
export const createShowDeleteConfirmDialog = (
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
  timeTableData: IExtendedWeeklyTimeRow[]
) => {
  return (rowId: string): void => {
    console.log(`Setting up delete/restore for row ID: ${rowId}`);
    
    // Сохраняем ID строки в ref
    pendingActionRowIdRef.current = rowId;
    
    // Находим строку по ID
    const rowIndex = timeTableData.findIndex(row => row.id === rowId);
    if (rowIndex === -1) {
      console.error(`Row with ID ${rowId} not found`);
      return;
    }
    
    const row = timeTableData[rowIndex];
    // Проверяем, удалена ли строка
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // В зависимости от статуса удаления, показываем разный диалог
    if (isDeleted) {
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
    } else {
      // Диалог удаления
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
    }
  };
};
