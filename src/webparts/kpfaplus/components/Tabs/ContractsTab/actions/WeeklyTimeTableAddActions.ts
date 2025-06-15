// src/webparts/kpfaplus/components/Tabs/ContractsTab/actions/WeeklyTimeTableAddActions.ts
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IExtendedWeeklyTimeRow, updateDisplayedTotalHours } from '../WeeklyTimeTableLogic';
import { IDayHours, WeeklyTimeTableUtils } from '../../../../models/IWeeklyTimeTable';
import { IWeeklyTimeTableUpdateItem, WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';
import { DialogType, StatusMessageType } from './WeeklyTimeTableTypes';

/**
 * Функция для обработки добавления новой смены с явным указанием строки
 * ОБНОВЛЕНО: Работает с числовыми полями времени, убрана зависимость от DateUtils
 */
export const createAddShiftHandler = (
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>,
  showDialog: (dialogType: DialogType, rowId?: string, additionalData?: unknown) => void,
  context: WebPartContext,
  contractId: string | undefined,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  onSaveComplete?: (success: boolean) => void,
  triggerRefresh?: () => void,
  getSelectedRow?: () => IExtendedWeeklyTimeRow | undefined
): () => Promise<void> => {
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
                
                // Время начала - прямая передача объектов IDayHours
                mondayStart: row.monday?.start,
                tuesdayStart: row.tuesday?.start,
                wednesdayStart: row.wednesday?.start,
                thursdayStart: row.thursday?.start,
                fridayStart: row.friday?.start,
                saturdayStart: row.saturday?.start,
                sundayStart: row.sunday?.start,
                
                // Время окончания - прямая передача объектов IDayHours
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
              
              // Время начала - прямая передача объектов IDayHours
              mondayStart: row.monday?.start,
              tuesdayStart: row.tuesday?.start,
              wednesdayStart: row.wednesday?.start,
              thursdayStart: row.thursday?.start,
              fridayStart: row.friday?.start,
              saturdayStart: row.saturday?.start,
              sundayStart: row.sunday?.start,
              
              // Время окончания - прямая передача объектов IDayHours
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
          console.log('Automatically saving changes for items before adding new shift (using numeric time fields):', itemsToUpdate);
          
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
    
    // Получаем выбранную строку, если функция предоставлена
    const selectedRow = getSelectedRow ? getSelectedRow() : null;
    
    checkDeletedShiftsInWeek(selectedRow);
    
    // Функция для извлечения номера недели из названия строки
    function extractWeekNumber(name: string): number {
      const match = name?.match(/Week\s+(\d+)/i);
      return match ? parseInt(match[1], 10) : 1;
    }
    
    // Функция для проверки удаленных смен в текущей неделе
    function checkDeletedShiftsInWeek(selectedRow: IExtendedWeeklyTimeRow | null | undefined): void {
      // Добавим дополнительную проверку на undefined
      // Добавим подробное логирование для отладки
      console.log('[checkDeletedShiftsInWeek] Called with selectedRow:', selectedRow ? 
        `ID=${selectedRow.id}, NumberOfWeek=${selectedRow.NumberOfWeek}` : 'null/undefined');
      
      if (selectedRow) {
        console.log('[checkDeletedShiftsInWeek] Selected row details:', {
          id: selectedRow.id,
          name: selectedRow.name,
          NumberOfWeek: selectedRow.NumberOfWeek,
          NumberOfShift: selectedRow.NumberOfShift,
          deleted: selectedRow.deleted,
          Deleted: selectedRow.Deleted
        });
      }
      
      // Найдем строки, где NumberOfShift = 1, для определения структуры недель
      // и получения всех номеров недель в таблице
      const weekNumbersMap = new Map<number, IExtendedWeeklyTimeRow[]>();
      
      // Группируем все строки по номеру недели
      timeTableData.forEach(row => {
        const weekNumber = row.NumberOfWeek || extractWeekNumber(row.name);
        if (!weekNumbersMap.has(weekNumber)) {
          weekNumbersMap.set(weekNumber, []);
        }
        // Добавляем строку в соответствующую группу недели
        weekNumbersMap.get(weekNumber)?.push(row);
      });
      
      console.log(`[checkDeletedShiftsInWeek] Found ${weekNumbersMap.size} different weeks in the data`);
      
      // Вывод всех найденных недель для отладки
      weekNumbersMap.forEach((rows, weekNum) => {
        console.log(`[checkDeletedShiftsInWeek] Week ${weekNum}: ${rows.length} rows`);
      });
      
      // Определяем номер текущей недели
      // Если есть selectedRow, берем номер недели из неё
      // В противном случае используем номер недели из первой строки (старое поведение)
      let currentWeekNumber: number;
      
      if (selectedRow && selectedRow.NumberOfWeek !== undefined) {
        currentWeekNumber = selectedRow.NumberOfWeek;
        console.log(`[checkDeletedShiftsInWeek] Using NumberOfWeek=${currentWeekNumber} from selected row (ID=${selectedRow.id})`);
      } else if (selectedRow && selectedRow.name) {
        // Если нет NumberOfWeek, но есть имя - пробуем извлечь из имени
        currentWeekNumber = extractWeekNumber(selectedRow.name);
        console.log(`[checkDeletedShiftsInWeek] Using week number ${currentWeekNumber} extracted from selected row name: "${selectedRow.name}"`);
      } else {
        // Используем первую строку данных (старое поведение)
        const firstRow = timeTableData.length > 0 ? timeTableData[0] : null;
        if (!firstRow) {
          console.error('[checkDeletedShiftsInWeek] No row data available for checking deleted shifts');
          return;
        }
        currentWeekNumber = firstRow.NumberOfWeek || extractWeekNumber(firstRow.name);
        console.log(`[checkDeletedShiftsInWeek] Using week number ${currentWeekNumber} from first row (fallback)`);
      }
      
      console.log(`[checkDeletedShiftsInWeek] Current week number determined as: ${currentWeekNumber}`);
      
      // Получаем все строки только для текущей недели
      const rowsInCurrentWeek = weekNumbersMap.get(currentWeekNumber) || [];
      console.log(`[checkDeletedShiftsInWeek] Found ${rowsInCurrentWeek.length} rows in current week ${currentWeekNumber}`);
      
      // Логируем детали каждой строки в текущей неделе
      rowsInCurrentWeek.forEach((row, index) => {
        console.log(`[checkDeletedShiftsInWeek] Week ${currentWeekNumber}, Row ${index}: ID=${row.id}, NumberOfShift=${row.NumberOfShift}, deleted=${row.deleted}`);
      });
      
      // Находим максимальный номер смены в текущей неделе
      let maxShiftNumberInCurrentWeek = 0;
      rowsInCurrentWeek.forEach(row => {
        const shiftNumber = row.NumberOfShift || 1;
        if (shiftNumber > maxShiftNumberInCurrentWeek) {
          maxShiftNumberInCurrentWeek = shiftNumber;
        }
      });
      
      console.log(`[checkDeletedShiftsInWeek] Max shift number in current week ${currentWeekNumber}: ${maxShiftNumberInCurrentWeek}`);
      
      // Проверяем наличие удаленных смен только в текущей неделе
      const deletedShiftsInCurrentWeek = rowsInCurrentWeek.filter(row => {
        return (row.deleted === 1 || row.Deleted === 1);
      });
      
      console.log(`[checkDeletedShiftsInWeek] Found ${deletedShiftsInCurrentWeek.length} deleted shifts in current week ${currentWeekNumber}`);
      
      // Логируем удаленные смены, если они есть
      if (deletedShiftsInCurrentWeek.length > 0) {
        deletedShiftsInCurrentWeek.forEach((row, index) => {
          console.log(`[checkDeletedShiftsInWeek] Deleted shift ${index}: ID=${row.id}, NumberOfShift=${row.NumberOfShift}`);
        });
      }
      
      // Проверяем, есть ли "дыры" в последовательности номеров смен
      // Должны быть смены от 1 до maxShiftNumberInCurrentWeek без пропусков
      const existingShiftNumbers = new Set<number>();
      rowsInCurrentWeek.forEach(row => {
        const shiftNumber = row.NumberOfShift || 1;
        if (row.deleted !== 1 && row.Deleted !== 1) {
          // Добавляем только не удаленные смены
          existingShiftNumbers.add(shiftNumber);
        }
      });
      
      console.log(`[checkDeletedShiftsInWeek] Existing shift numbers in current week: ${Array.from(existingShiftNumbers).sort().join(', ')}`);
      
      // Проверяем, есть ли пропущенные номера смен (дыры)
      const missingShiftNumbers: number[] = [];
      for (let i = 1; i <= maxShiftNumberInCurrentWeek; i++) {
        if (!existingShiftNumbers.has(i)) {
          missingShiftNumbers.push(i);
        }
      }
      
      console.log(`[checkDeletedShiftsInWeek] Missing shift numbers in current week: ${missingShiftNumbers.join(', ')}`);
      
      // Если есть удаленные смены в текущей неделе, которые создают "дыры"
      if (missingShiftNumbers.length > 0 && deletedShiftsInCurrentWeek.length > 0) {
        // Проверяем, какие смены из пропущенных есть среди удаленных
        const deletedMissingShifts = deletedShiftsInCurrentWeek.filter(row => {
          const shiftNumber = row.NumberOfShift || 1;
          return missingShiftNumbers.includes(shiftNumber);
        });
        
        if (deletedMissingShifts.length > 0) {
          // Есть удаленные смены, которые нужно восстановить перед добавлением новой
          const deletedShiftNumbers = deletedMissingShifts.map(row => row.NumberOfShift || 1).sort();
          console.log(`[checkDeletedShiftsInWeek] Deleted shifts that need to be restored: ${deletedShiftNumbers.join(', ')}`);
          
          // Показываем информационное сообщение
          showDialog(DialogType.INFO, undefined, { 
            message: `Fully deleted shifts detected: ${deletedShiftNumbers.join(', ')}. Before adding a new shift, you need to restore the deleted shifts.`,
            confirmButtonText: "OK"
          });
          return;
        }
      }
      
      // Если нет удаленных смен, создающих "дыры", продолжаем с добавлением новой смены
      proceedWithAddingNewShift(currentWeekNumber, maxShiftNumberInCurrentWeek);
    }
    
    // Функция для продолжения процесса добавления новой смены
    function proceedWithAddingNewShift(currentWeekNumber: number, maxShiftNumberInCurrentWeek: number): void {
      console.log(`[proceedWithAddingNewShift] Proceeding with adding new shift for week ${currentWeekNumber} using numeric time fields`);
      
      // Следующий номер смены = максимальный + 1
      const nextShiftNumber = maxShiftNumberInCurrentWeek + 1;
      
      console.log(`[proceedWithAddingNewShift] Next shift number will be: ${nextShiftNumber}`);
      console.log(`[proceedWithAddingNewShift] Showing ADD_SHIFT dialog with weekNumber=${currentWeekNumber}, nextShiftNumber=${nextShiftNumber}`);
      
      // Показываем диалог подтверждения
      showDialog(DialogType.ADD_SHIFT, undefined, { 
        weekNumber: currentWeekNumber, 
        nextShiftNumber: nextShiftNumber,
        contractId
      });
    }
  };
};

/**
 * Функция для выполнения добавления новой смены через диалоговое окно
 * Вызывается после проверки возможности добавления новой смены
 * ОБНОВЛЕНО: Работает с числовыми полями времени
 */
export const executeAddNewShift = (
  context: WebPartContext,
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  contractId: string | undefined,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>,
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
    message: `Creating new shift ${shiftNumber} for week ${weekNumber} with numeric time fields...`
  });

  try {
    // ОБНОВЛЕНО: Создаем объекты для пустого времени начала и окончания (числовые значения)
    const emptyTime: IDayHours = { hours: '00', minutes: '00' };
    
    // Создаем объект нового элемента для отправки на сервер
    const newItemData: IWeeklyTimeTableUpdateItem = {
      id: 'new', // Временный ID, будет заменен сервером
      
      // Время начала для каждого дня - простые числовые значения
      mondayStart: emptyTime,
      tuesdayStart: emptyTime,
      wednesdayStart: emptyTime,
      thursdayStart: emptyTime,
      fridayStart: emptyTime,
      saturdayStart: emptyTime,
      sundayStart: emptyTime,
      
      // Время окончания для каждого дня - простые числовые значения
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
    const saveNewShift = async (): Promise<void> => {
      try {
        // Вызываем метод создания и получаем реальный ID
        const realId = await service.createWeeklyTimeTableItem(
          newItemData, 
          contractId || '', 
          currentUserId, 
          weekNumber,   // Номер недели для новой смены
          shiftNumber   // Номер смены для новой смены
        );
        
        console.log(`Created new shift ${shiftNumber} for week ${weekNumber} with ID: ${realId} using numeric time fields`);
        
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
          message: `New shift ${shiftNumber} for week ${weekNumber} has been successfully created with numeric time fields.`
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
    saveNewShift()
      .then(() => {
        console.log('Shift saved successfully');
      })
      .catch(error => {
        console.error('Error in saveNewShift:', error);
      });
    
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
 * ОБНОВЛЕНО: Работает с числовыми полями времени
 */
export const executeAddNewWeek = (
  context: WebPartContext,
  timeTableData: IExtendedWeeklyTimeRow[],
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
  contractId: string | undefined,
  changedRows: Set<string>,
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>,
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>,
  weekNumberToAdd: number,
  currentUserId: number, 
  onSaveComplete?: (success: boolean) => void,
  onRefresh?: () => void
): void => {
  // Обновляем индикатор сохранения
  setIsSaving(true);
  setStatusMessage({
    type: MessageBarType.info,
    message: `Creating new week ${weekNumberToAdd} with numeric time fields...`
  });

  try {
    // ОБНОВЛЕНО: Создаем объекты для пустого времени начала и окончания (числовые значения)
    const emptyTime: IDayHours = { hours: '00', minutes: '00' };
    
    // Создаем объект нового элемента для отправки на сервер
    const newItemData: IWeeklyTimeTableUpdateItem = {
      id: 'new', // Временный ID, будет заменен сервером
      
      // Время начала для каждого дня - простые числовые значения
      mondayStart: emptyTime,
      tuesdayStart: emptyTime,
      wednesdayStart: emptyTime,
      thursdayStart: emptyTime,
      fridayStart: emptyTime,
      saturdayStart: emptyTime,
      sundayStart: emptyTime,
      
      // Время окончания для каждого дня - простые числовые значения
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
    const saveNewWeek = async (): Promise<void> => {
      try {
        // Вызываем метод создания новой недели
        const realId = await service.createWeeklyTimeTableItem(
          newItemData, 
          contractId || '', 
          currentUserId, 
          weekNumberToAdd, // Передаем номер недели
          1 // NumberOfShift = 1 для новой недели
        );
        
        console.log(`Created new week ${weekNumberToAdd} with ID: ${realId} using numeric time fields`);
        
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
          message: `New week ${weekNumberToAdd} has been successfully created with numeric time fields.`
        });
        
        // Вызываем коллбэк завершения операции, если он задан
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
        
        // Вызываем коллбэк завершения операции с ошибкой, если он задан
        if (onSaveComplete) {
          onSaveComplete(false);
        }
      } finally {
        // В любом случае снимаем индикацию процесса сохранения
        setIsSaving(false);
      }
    };
    
    // Запускаем процесс сохранения
    saveNewWeek()
      .then(() => {
        console.log('Week saved successfully');
      })
      .catch(error => {
        console.error('Error in saveNewWeek:', error);
      });
    
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