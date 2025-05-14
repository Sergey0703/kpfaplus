// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableActions.ts
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { 
  IExtendedWeeklyTimeRow, 
  updateDisplayedTotalHours,
  analyzeWeeklyTableData,
  checkCanAddNewWeekFromData,
  IAddWeekCheckResult
} from './WeeklyTimeTableLogic';
import { IWeeklyTimeTableUpdateItem, WeeklyTimeTableService } from '../../../services/WeeklyTimeTableService';
import { IDayHours, WeeklyTimeTableUtils } from '../../../models/IWeeklyTimeTable';

/**
 * Типы диалогов
 */
export enum DialogType {
  DELETE = 'delete',        // Диалог удаления смены
  RESTORE = 'restore',      // Диалог восстановления смены
  ADD_WEEK = 'addWeek',     // Диалог добавления новой недели
  INFO = 'info'             // Информационный диалог
}

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
 * Функция для добавления новой смены с автоматическим сохранением несохраненных изменений
 * и проверкой удаленных смен с большим номером в текущей неделе
 * @param timeTableData Данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @param showDialog Функция для отображения диалогов
 * @param context Контекст веб-части
 * @param contractId ID контракта
 * @param setIsSaving Функция для обновления статуса сохранения
 * @param onSaveComplete Функция обратного вызова после сохранения
 * @param currentRow Текущая строка, для которой нажата кнопка +Shift
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
  } | null>>,
  showDialog: (rowId: string, dialogType: DialogType, additionalData?: any) => void,
  context: WebPartContext,
  contractId: string | undefined,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  onSaveComplete?: (success: boolean) => void,
  currentRow?: IExtendedWeeklyTimeRow // Добавлен новый параметр для текущей строки
) => {
  return async (): Promise<void> => {
    // Проверяем, есть ли несохраненные изменения
    if (changedRows.size > 0) {
      // Есть несохраненные изменения, автоматически сохраняем их
      try {
        setIsSaving(true);
        setStatusMessage({
          type: MessageBarType.info,
          message: `Saving changes before adding a new shift...`
        });
        
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
              await service.createWeeklyTimeTableItem(
                newItem, 
                contractId || '', 
                context.pageContext.user.loginName
              );
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
          console.log('Automatically saving changes for items before adding new shift:', itemsToUpdate);
          
          // Выполняем обновление данных
          await service.batchUpdateWeeklyTimeTable(itemsToUpdate);
          
          console.log('Changes saved successfully before adding new shift');
        }
        
        // Очищаем список измененных строк
        setChangedRows(new Set());
        
        // Показываем сообщение об успешном сохранении
        setStatusMessage({
          type: MessageBarType.success,
          message: `Changes saved successfully. Now checking for deleted shifts...`
        });
        
        // Вызываем коллбэк завершения сохранения, если он задан
        if (onSaveComplete) {
          onSaveComplete(true);
        }
      } catch (error) {
        console.error('Error saving changes before adding new shift:', error);
        
        // Показываем сообщение об ошибке
        setStatusMessage({
          type: MessageBarType.error,
          message: `Failed to save changes: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        
        // Прерываем процесс добавления новой смены
        setIsSaving(false);
        return;
      } finally {
        setIsSaving(false);
      }
    }
    
    // После автоматического сохранения или если нет несохраненных изменений
    // проверяем наличие удаленных смен с большим номером в текущей неделе
    checkDeletedShiftsInWeek();
    
    // Функция для проверки удаленных смен с большим номером в текущей неделе
    function checkDeletedShiftsInWeek() {
      // Если текущая строка не указана, используем первую строку данных
      const row = currentRow || (timeTableData.length > 0 ? timeTableData[0] : null);
      
      if (!row) {
        console.error('No row data available for checking deleted shifts');
        return;
      }
      
      // Получаем номер недели текущей строки
      const weekNumber = row.NumberOfWeek || extractWeekNumber(row.name);
      
      // Получаем номер смены текущей строки
      const shiftNumber = row.NumberOfShift || 1;
      
      console.log(`Checking deleted shifts in week ${weekNumber} with NumberOfShift > ${shiftNumber}`);
      
      // Ищем удаленные смены с большим номером в текущей неделе
      const deletedShiftsWithGreaterNumber = timeTableData.filter(item => {
        // Проверяем, относится ли строка к той же неделе
        const itemWeekNumber = item.NumberOfWeek || extractWeekNumber(item.name);
        const itemShiftNumber = item.NumberOfShift || 1;
        
        // Строка должна быть из той же недели, иметь больший номер смены и быть удаленной
        return itemWeekNumber === weekNumber && 
               itemShiftNumber > shiftNumber && 
               (item.deleted === 1 || item.Deleted === 1);
      });
      
      // Выводим результаты проверки в консоль
      console.log(`Found ${deletedShiftsWithGreaterNumber.length} deleted shifts with greater number in week ${weekNumber}`);
      if (deletedShiftsWithGreaterNumber.length > 0) {
        console.log('Deleted shifts:', deletedShiftsWithGreaterNumber);
      }
      
      // Если найдены удаленные смены с большим номером
      if (deletedShiftsWithGreaterNumber.length > 0) {
        // Показываем информационное сообщение
        showDialog('info', DialogType.INFO, { 
          message: `Fully deleted shifts detected: ${deletedShiftsWithGreaterNumber.map(s => s.NumberOfShift).join(', ')}. Before adding a new shift, you need to restore the deleted shifts.`,
          confirmButtonText: "OK"
        });
        return;
      }
      
      // Если не найдены удаленные смены с большим номером, продолжаем с добавлением новой смены
      proceedWithAddingNewShift();
    }
    
    // Функция для извлечения номера недели из названия строки
    function extractWeekNumber(name: string): number {
      const match = name?.match(/Week\s+(\d+)/i);
      return match ? parseInt(match[1], 10) : 1;
    }
    
    // Функция для продолжения процесса добавления новой смены
    function proceedWithAddingNewShift() {
      console.log('Proceeding with adding new shift');
      
      // Здесь должна быть логика добавления новой смены
      
      // Пример вызова диалога для подтверждения добавления новой смены
      const row = currentRow || (timeTableData.length > 0 ? timeTableData[0] : null);
      
      if (!row) {
        console.error('No row data available for adding new shift');
        return;
      }
      
      const weekNumber = row.NumberOfWeek || extractWeekNumber(row.name);
      const shiftNumber = row.NumberOfShift || 1;
      
      // Показываем диалог подтверждения
      showDialog('add_shift', DialogType.ADD_SHIFT, { 
        weekNumber, 
        nextShiftNumber: shiftNumber + 1,
        contractId,
        currentRow: row
      });
    }
  };
};



/**
 * Функция для обработки добавления новой смены через диалоговое окно
 * Вызывается после проверки возможности добавления новой смены
 */
export const executeAddNewShift = (
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
  weekNumber: number,
  shiftNumber: number,
  currentUserId: number, 
  onSaveComplete?: (success: boolean) => void,
  onRefresh?: () => void
): void => {
  // Обновляем индикатор сохранения
  setIsSaving(true);
  setStatusMessage({
    type: MessageBarType.info,
    message: `Creating new shift ${shiftNumber} for week ${weekNumber}...`
  });
  
  try {
    // Создаем объекты для пустого времени начала и окончания
    const emptyTime: IDayHours = { hours: '00', minutes: '00' };
    
    // Создаем объект нового элемента для отправки на сервер
    const newItemData: IWeeklyTimeTableUpdateItem = {
      id: 'new', // Временный ID, будет заменен сервером
      
      // Время начала для каждого дня
      mondayStart: emptyTime,
      tuesdayStart: emptyTime,
      wednesdayStart: emptyTime,
      thursdayStart: emptyTime,
      fridayStart: emptyTime,
      saturdayStart: emptyTime,
      sundayStart: emptyTime,
      
      // Время окончания для каждого дня
      mondayEnd: emptyTime,
      tuesdayEnd: emptyTime,
      wednesdayEnd: emptyTime,
      thursdayEnd: emptyTime,
      fridayEnd: emptyTime,
      saturdayEnd: emptyTime,
      sundayEnd: emptyTime,
      
      // Дополнительные данные
      lunchMinutes: '30',
      contractNumber: '1'
    };
    
    // Создаем сервис для работы с данными
    const service = new WeeklyTimeTableService(context);
    
    // Асинхронная функция для сохранения
    const saveNewShift = async () => {
      try {
        // Вызываем метод создания и получаем реальный ID
        const realId = await service.createWeeklyTimeTableItem(
          newItemData, 
          contractId || '', 
          currentUserId, 
          weekNumber,   // Номер недели для новой смены
          shiftNumber   // Номер смены для новой смены
        );
        
        console.log(`Created new shift ${shiftNumber} for week ${weekNumber} with ID: ${realId}`);
        
        // Вызываем функцию для триггера перезагрузки данных, если она передана
        if (onRefresh) {
          console.log("Triggering refresh after adding new shift");
          onRefresh();
        } else {
          // Если нет функции перезагрузки, обновляем данные вручную
          console.log("No refresh function provided, updating items manually");
          
          // Обновляем список элементов - получаем свежие данные с сервера
          const updatedItems = await service.getWeeklyTimeTableByContractId(contractId || '');
          
          // Преобразуем данные в нужный формат и обновляем состояние
          const formattedData = WeeklyTimeTableUtils.formatWeeklyTimeTableData(updatedItems);
          const dataWithTotalHours = updateDisplayedTotalHours(formattedData as IExtendedWeeklyTimeRow[]);
          setTimeTableData(dataWithTotalHours);
          
          // Очищаем список измененных строк, так как мы обновили все данные с сервера
          setChangedRows(new Set());
        }
        
        // Показываем сообщение об успешном создании
        setStatusMessage({
          type: MessageBarType.success,
          message: `New shift ${shiftNumber} for week ${weekNumber} has been successfully created.`
        });
        
        // Вызываем коллбэк завершения сохранения, если он задан
        if (onSaveComplete) {
          onSaveComplete(true);
        }
      } catch (error) {
        console.error('Error creating new shift:', error);
        
        // Показываем сообщение об ошибке
        setStatusMessage({
          type: MessageBarType.error,
          message: `Failed to create new shift: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    
    // Запускаем процесс сохранения
    saveNewShift();
    
  } catch (error) {
    // Обрабатываем любые синхронные ошибки
    console.error('Error in executeAddNewShift:', error);
    setStatusMessage({
      type: MessageBarType.error,
      message: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    setIsSaving(false);
  }
};
/**
 * Функция для выполнения добавления новой недели после подтверждения
 * @param context Контекст веб-части
 * @param timeTableData Данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param contractId ID контракта
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setIsSaving Функция для обновления статуса сохранения
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @param weekNumberToAdd Номер недели для добавления
 * @param currentUserId ID текущего пользователя
 * @param onSaveComplete Функция обратного вызова после сохранения
 * @param onRefresh Функция для триггера перезагрузки данных
 * @returns void
 */
export const executeAddNewWeek = (
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
  weekNumberToAdd: number,
  currentUserId: number, 
  onSaveComplete?: (success: boolean) => void,
  onRefresh?: () => void
): void => {
  // Обновляем индикатор сохранения
  setIsSaving(true);
  setStatusMessage({
    type: MessageBarType.info,
    message: `Creating new week ${weekNumberToAdd}...`
  });
  
  try {
    // Создаем объекты для пустого времени начала и окончания
    const emptyTime: IDayHours = { hours: '00', minutes: '00' };
    
    // Создаем объект нового элемента для отправки на сервер
    const newItemData: IWeeklyTimeTableUpdateItem = {
      id: 'new', // Временный ID, будет заменен сервером
      
      // Время начала для каждого дня
      mondayStart: emptyTime,
      tuesdayStart: emptyTime,
      wednesdayStart: emptyTime,
      thursdayStart: emptyTime,
      fridayStart: emptyTime,
      saturdayStart: emptyTime,
      sundayStart: emptyTime,
      
      // Время окончания для каждого дня
      mondayEnd: emptyTime,
      tuesdayEnd: emptyTime,
      wednesdayEnd: emptyTime,
      thursdayEnd: emptyTime,
      fridayEnd: emptyTime,
      saturdayEnd: emptyTime,
      sundayEnd: emptyTime,
      
      // Дополнительные данные
      lunchMinutes: '30',
      contractNumber: '1'
    };
    
    // Создаем сервис для работы с данными
    const service = new WeeklyTimeTableService(context);
    
    // Асинхронная функция для сохранения
    const saveNewWeek = async () => {
      try {
        // Вызываем метод создания и получаем реальный ID
        const realId = await service.createWeeklyTimeTableItem(
          newItemData, 
          contractId || '', 
          currentUserId, 
          weekNumberToAdd, // Передаем номер недели
          1 // NumberOfShift = 1 для новой недели
        );
        
        console.log(`Created new week ${weekNumberToAdd} with ID: ${realId}`);
        
        // Вызываем функцию для триггера перезагрузки данных, если она передана
        if (onRefresh) {
          console.log("Triggering refresh after adding new week");
          onRefresh();
        } else {
          // Если нет функции перезагрузки, обновляем данные вручную
          console.log("No refresh function provided, updating items manually");
          
          // Обновляем список элементов - получаем свежие данные с сервера
          const updatedItems = await service.getWeeklyTimeTableByContractId(contractId || '');
          
          // Преобразуем данные в нужный формат и обновляем состояние
          const formattedData = WeeklyTimeTableUtils.formatWeeklyTimeTableData(updatedItems);
          const dataWithTotalHours = updateDisplayedTotalHours(formattedData as IExtendedWeeklyTimeRow[]);
          setTimeTableData(dataWithTotalHours);
          
          // Очищаем список измененных строк, так как мы обновили все данные с сервера
          setChangedRows(new Set());
        }
        
        // Показываем сообщение об успешном создании
        setStatusMessage({
          type: MessageBarType.success,
          message: `New week ${weekNumberToAdd} has been successfully created.`
        });
        
        // Вызываем коллбэк завершения сохранения, если он задан
        if (onSaveComplete) {
          onSaveComplete(true);
        }
      } catch (error) {
        console.error('Error creating new week:', error);
        
        // Показываем сообщение об ошибке
        setStatusMessage({
          type: MessageBarType.error,
          message: `Failed to create new week: ${error instanceof Error ? error.message : 'Unknown error'}`
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
    
    // Запускаем процесс сохранения
    saveNewWeek();
    
  } catch (error) {
    // Обрабатываем любые синхронные ошибки
    console.error('Error in executeAddNewWeek:', error);
    setStatusMessage({
      type: MessageBarType.error,
      message: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
    setIsSaving(false);
  }
};

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
  context: WebPartContext,  // Добавляем необходимые параметры
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
  onRefresh?: () => void // Добавляем функцию для триггера перезагрузки
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
        const addWeekCheck = additionalData as IAddWeekCheckResult;
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
            // Вызываем функцию добавления с правильными параметрами
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
              onRefresh // Передаем функцию перезагрузки данных
            );
            
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
            pendingActionRowIdRef.current = null;
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
            // Вызываем функцию добавления с правильными параметрами
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
              onRefresh // Передаем функцию перезагрузки данных
            );
            
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
            pendingActionRowIdRef.current = null;
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
 * Вспомогательная функция для логирования анализа таблицы недельного расписания
 */
export const logWeeklyTableAnalysis = (timeTableData: IExtendedWeeklyTimeRow[]): void => {
  const analysisResult = analyzeWeeklyTableData(timeTableData);
  console.log('Week Analysis Result:', analysisResult);
};

/**
 * Функция для настройки диалога подтверждения удаления или восстановления
 * (для обратной совместимости с существующим кодом)
 */
export const createShowDeleteConfirmDialog = createShowConfirmDialog;