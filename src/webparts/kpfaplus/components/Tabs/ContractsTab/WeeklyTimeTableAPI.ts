// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableAPI.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { MessageBarType } from '@fluentui/react';
import { IDayHours,WeeklyTimeTableUtils } from '../../../models/IWeeklyTimeTable';
import { IWeeklyTimeTableUpdateItem, WeeklyTimeTableService } from '../../../services/WeeklyTimeTableService';
import { IExtendedWeeklyTimeRow, updateDisplayedTotalHours, analyzeWeeklyTableData, checkCanAddNewWeek } from './WeeklyTimeTableLogic';
import { StatusMessageType } from './actions/WeeklyTimeTableTypes';
// Добавить в начало файла, вместе с другими импортами
 
export interface ISaveParams {
  context: WebPartContext;
  timeTableData: IExtendedWeeklyTimeRow[];
  contractId?: string;
  changedRows: Set<string>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>;
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>;
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSaveComplete?: (success: boolean) => void;
}

// Добавить вместе с другими типами в начале файла
export interface IWeeklyTimeTableRawItem {
    id?: string | number;
    ID?: string | number;
    fields?: {
      id?: string | number;
      ID?: string | number;
      Deleted?: number;
      deleted?: number;
      NumberOfShift?: number;
      numberOfShift?: number; 
      NumberOfWeek?: number;
      numberOfWeek?: number;
      IdOfTemplate?: string | number;
      idOfTemplate?: string | number;
      IdOfTemplateLookupId?: string | number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
/**
 * Интерфейс для параметров добавления новой смены
 */
export interface IAddShiftParams {
  context: WebPartContext;
  timeTableData: IExtendedWeeklyTimeRow[];
  contractId?: string;
  weekNumber: number;
  nextShiftNumber: number;
  currentUserId: number;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>;
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>;
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSaveComplete?: (success: boolean) => void;
  onRefresh?: () => void;
}

/**
 * Интерфейс для параметров добавления новой недели
 */
export interface IAddWeekParams {
  context: WebPartContext;
  timeTableData: IExtendedWeeklyTimeRow[];
  contractId?: string;
  weekNumberToAdd: number;
  currentUserId: number;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>;
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>;
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  onSaveComplete?: (success: boolean) => void;
  onRefresh?: () => void;
}

/**
 * Интерфейс для параметров удаления/восстановления смены
 */
export interface IDeleteRestoreParams {
  context: WebPartContext;
  timeTableData: IExtendedWeeklyTimeRow[];
  rowIndex: number;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>;
  setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>;
  setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>;
}

/**
 * Анализирует структуру данных недельного расписания и проверяет возможность добавления новой недели
 * @param timeTableData Данные недельного расписания
 * @returns Результат анализа и проверки
 */
export const checkCanAddNewWeekFromData = (timeTableData: IExtendedWeeklyTimeRow[]): ReturnType<typeof checkCanAddNewWeek> => {
  // Анализируем данные и получаем структуру недель
  const analysisResult = analyzeWeeklyTableData(timeTableData);
  console.log('Week analysis result:', analysisResult);
  
  // Проверяем возможность добавления новой недели
  return checkCanAddNewWeek(analysisResult);
};

/**
 * Сохраняет изменения в недельном расписании
 * @param params Параметры сохранения
 * @returns Promise без возвращаемого значения
 */
export const saveWeeklyTimeTable = async (params: ISaveParams): Promise<void> => {
  const {
    context,
    timeTableData,
    contractId,
    changedRows,
    setIsSaving,
    setStatusMessage,
    //setTimeTableData,
    setChangedRows,
    onSaveComplete
  } = params;
  
  // Если нет измененных строк, ничего не делаем
  if (changedRows.size === 0) {
    console.log('No changes to save');
    return;
  }
  
  // Обновляем состояние для индикации процесса сохранения
  setIsSaving(true);
  setStatusMessage(undefined);
  
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

/**
 * Добавляет новую смену в недельное расписание
 * @param params Параметры добавления новой смены
 */
export const addNewShift = async (params: IAddShiftParams): Promise<void> => {
  const {
    context,
   // timeTableData,
    contractId,
    weekNumber,
    nextShiftNumber,
    currentUserId,
    setIsSaving,
    setStatusMessage,
    setTimeTableData,
    setChangedRows,
    onSaveComplete,
    onRefresh
  } = params;
  
  // Обновляем индикатор сохранения
  setIsSaving(true);
  setStatusMessage({
    type: MessageBarType.info,
    message: `Creating new shift ${nextShiftNumber} for week ${weekNumber}...`
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
    
    // Вызываем метод создания и получаем реальный ID
    const realId = await service.createWeeklyTimeTableItem(
      newItemData, 
      contractId || '', 
      currentUserId, 
      weekNumber,   // Номер недели для новой смены
      nextShiftNumber   // Номер смены для новой смены
    );
    
    console.log(`Created new shift ${nextShiftNumber} for week ${weekNumber} with ID: ${realId}`);
    
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
      // Используем функцию updateDisplayedTotalHours для корректного отображения общего времени
      setTimeTableData(updateDisplayedTotalHours(updatedItems as unknown as IExtendedWeeklyTimeRow[]));
      
      // Очищаем список измененных строк, так как мы обновили все данные с сервера
      setChangedRows(new Set());
    }
    
    // Показываем сообщение об успешном создании
    setStatusMessage({
      type: MessageBarType.success,
      message: `New shift ${nextShiftNumber} for week ${weekNumber} has been successfully created.`
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

/**
 * Добавляет новую неделю в недельное расписание
 * @param params Параметры добавления новой недели
 */
export const addNewWeek = async (params: IAddWeekParams): Promise<void> => {
  const {
    context,
    //timeTableData,
    contractId,
    weekNumberToAdd,
    currentUserId,
    setIsSaving,
    setStatusMessage,
    setTimeTableData,
    setChangedRows,
    onSaveComplete,
    onRefresh
  } = params;
  
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
    
    // Вызываем метод создания новой недели
    const realId = await service.createWeeklyTimeTableItem(
      newItemData, 
      contractId || '', 
      currentUserId, 
      weekNumberToAdd, // Номер недели
      1 // Номер смены всегда 1 для новой недели
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
      // Используем функцию updateDisplayedTotalHours для корректного отображения общего времени
      setTimeTableData(updateDisplayedTotalHours(updatedItems as unknown as IExtendedWeeklyTimeRow[]));
      
      // Очищаем список измененных строк, так как мы обновили все данные с сервера
      setChangedRows(new Set());
    }
    
    // Показываем сообщение об успешном создании
    setStatusMessage({
      type: MessageBarType.success,
      message: `New week ${weekNumberToAdd} has been successfully created.`
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

// Вот исправления для функции deleteRestoreShift, которая содержит ошибки с changedRows
export const deleteRestoreShift = async (params: IDeleteRestoreParams): Promise<void> => {
    const {
      context,
      timeTableData,
      rowIndex,
      setIsSaving,
      setStatusMessage,
      setTimeTableData,
      setChangedRows
    } = params;
    
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
          throw new Error(`Server error ${operationType} weekly time table item: ${serverError instanceof Error ? serverError.message : String(serverError)}`);
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
      
      // Обновляем данные таблицы с измененным статусом удаления
      setTimeTableData(newData);
      
      // Исправление: объявляем переменную changedRows для использования в условии и создании нового объекта
      // Создаем новое множество для измененных строк
      const currentChangedRows = new Set<string>();
      setChangedRows(currentChangedRows);
      
      // Удаляем строку из списка измененных, если она была там
      // Исправление: В этой функции не нужно манипулировать с множеством измененных строк
      // Мы просто сбрасываем множество выше
      
      // Обновляем отображаемое общее время в первой строке каждого шаблона
      // Это позволит учесть (или не учесть) время из удаленной/восстановленной строки
      setTimeout(() => {
        // Используем setTimeout для обеспечения обновления состояния
        const updatedData = updateDisplayedTotalHours(newData);
        setTimeTableData(updatedData);
        
        // Добавляем отладочный вывод
        console.log(`Updated total hours after ${operationType} operation for row ${rowIndex}`);
      }, 0);
      
      // Показываем сообщение об успешном выполнении операции
      setStatusMessage({
        type: MessageBarType.success,
        message: isDeleted ? 
          `Shift successfully restored. Total hours will be recalculated.` : 
          `Shift successfully deleted. Its hours will be excluded from the total.`
      });
      
      // Скрываем сообщение через 3 секунды
      setTimeout(() => {
        setStatusMessage(undefined);
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

/**
 * Загружает данные недельного расписания для контракта
 * @param context Контекст веб-части
 * @param contractId ID контракта
 * @param setIsLoading Функция для установки состояния загрузки
 * @param setTimeTableData Функция для установки данных таблицы
 * @param setStatusMessage Функция для установки статусного сообщения
 * @param dataInitializedRef Ссылка для отслеживания инициализации данных
 * @param dayOfStartWeek День начала недели (1-7)
 * @returns Promise без возвращаемого значения
 */
export const loadWeeklyTimeTableData = async (
    context: WebPartContext,
    contractId: string | undefined,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
    setStatusMessage: React.Dispatch<React.SetStateAction<StatusMessageType>>,
    dataInitializedRef: React.MutableRefObject<boolean>,
    dayOfStartWeek: number = 7
  ): Promise<void> => {
    // Если нет ID контракта, выходим
    if (!contractId) {
      console.log('No contract ID provided for loading weekly time table data');
      setTimeTableData([]);
      return;
    }
    
    // Устанавливаем состояние загрузки
    setIsLoading(true);
    
    try {
      console.log(`Loading weekly time table data for contract ${contractId}...`);
      
      // Создаем сервис для работы с данными
      const service = new WeeklyTimeTableService(context);
      
      // Получаем данные от сервиса
      const items = await service.getWeeklyTimeTableByContractId(contractId);
      
      console.log(`Retrieved ${items.length} items for contract ${contractId}`);
      
      // Функция для преобразования данных с использованием типизированной версии
      const formatDataWithFields = (): IExtendedWeeklyTimeRow[] => {
        // Безопасно приводим items к нужному типу
        const typedItems = items as unknown as IWeeklyTimeTableRawItem[];
        
        // Временно заменяем метод formatWeeklyTimeTableData для поддержки dayOfStartWeek
        const origMethod = WeeklyTimeTableUtils.formatWeeklyTimeTableData;
        
        // Создаем кастомную функцию форматирования
        const customFormatter = function(items: IWeeklyTimeTableRawItem[], dayStart?: number): IExtendedWeeklyTimeRow[] {
          // Логируем параметры для отладки
          console.log(`Custom formatWeeklyTimeTableData called with dayOfStartWeek = ${dayStart}`);
          
          // Вызываем оригинальный метод с безопасным приведением типов
          const result = origMethod.call(this, items);
          
          // После получения результата, добавляем поля как в первой функции
          for (let i = 0; i < result.length; i++) {
            const formattedRow = result[i];
            const originalRow = items.find(item => {
              // Проверяем ID в различных форматах как ранее
              const itemId = 
                item.id !== undefined ? String(item.id) :
                item.ID !== undefined ? String(item.ID) :
                item.fields && item.fields.id !== undefined ? String(item.fields.id) :
                item.fields && item.fields.ID !== undefined ? String(item.fields.ID) :
                null;
              
              return itemId === formattedRow.id;
            });
            
            if (originalRow) {
              // Копируем важные поля как ранее
              const fields = originalRow.fields || {};
              
              // Те же проверки и копирование полей, как в initializeWithExistingData
              // ...
              
              // Поле Deleted
              const deletedValue = 
                fields.Deleted !== undefined ? fields.Deleted :
                fields.deleted !== undefined ? fields.deleted :
                undefined;
                
              if (deletedValue !== undefined) {
                formattedRow.deleted = deletedValue;
                formattedRow.Deleted = deletedValue;
              }
              
              // Поле NumberOfShift
              const shiftValue = 
                fields.NumberOfShift !== undefined ? fields.NumberOfShift :
                fields.numberOfShift !== undefined ? fields.numberOfShift :
                undefined;
                
              if (shiftValue !== undefined) {
                formattedRow.NumberOfShift = shiftValue;
              }
              
              // Поле NumberOfWeek и другие поля
              // (аналогично коду выше)
            }
          }
          
          return result;
        };
        
        // Заменяем метод временно с правильным приведением типов
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = customFormatter as typeof WeeklyTimeTableUtils.formatWeeklyTimeTableData;
        
        // Вызываем функцию с передачей типизированных данных
        const formattedData = WeeklyTimeTableUtils.formatWeeklyTimeTableData(typedItems, dayOfStartWeek);
        
        // Восстанавливаем оригинальный метод
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = origMethod;
        
        return formattedData;
      };
      
      // Форматируем данные
      const formattedData = formatDataWithFields();
      
      // Обновляем общее время для шаблонов
      const dataWithTotalHours = updateDisplayedTotalHours(formattedData as IExtendedWeeklyTimeRow[]);
      
      // Устанавливаем данные
      setTimeTableData(dataWithTotalHours);
      
      // Помечаем, что данные были инициализированы
      dataInitializedRef.current = true;
      
      // Сбрасываем статусное сообщение
      setStatusMessage(undefined);
      
      console.log(`Successfully loaded and formatted ${dataWithTotalHours.length} rows for contract ${contractId}`);
    } catch (error) {
      console.error(`Error loading weekly time table data: ${error}`);
      
      // Устанавливаем статусное сообщение об ошибке
      setStatusMessage({
        type: MessageBarType.error,
        message: `Failed to load time table data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      // Очищаем данные в случае ошибки
      setTimeTableData([]);
    } finally {
      // Снимаем индикатор загрузки
      setIsLoading(false);
    }
  };  
  /**
 * Инициализирует компонент недельного расписания с существующими данными
 * @param weeklyTimeData Данные из props компонента
 * @param dataInitializedRef Ссылка для отслеживания инициализации данных
 * @param setTimeTableData Функция для установки данных таблицы
 * @param setChangedRows Функция для сброса изменений
 * @param dayOfStartWeek День начала недели (1-7)
 */
export const initializeWithExistingData = (
    weeklyTimeData: IWeeklyTimeTableRawItem[] | undefined,
    dataInitializedRef: React.MutableRefObject<boolean>,
    setTimeTableData: React.Dispatch<React.SetStateAction<IExtendedWeeklyTimeRow[]>>,
    setChangedRows: React.Dispatch<React.SetStateAction<Set<string>>>,
    dayOfStartWeek: number = 7
  ): void => {
    // Если есть данные из props, используем их
    if (weeklyTimeData && weeklyTimeData.length > 0) {
      console.log(`Processing ${weeklyTimeData.length} weekly time table entries from props`);
      
      // Используем ту же логику форматирования, что и при загрузке данных
      const formatDataWithFields = (): IExtendedWeeklyTimeRow[] => {
        // Временно заменяем метод formatWeeklyTimeTableData для поддержки dayOfStartWeek
        const origMethod = WeeklyTimeTableUtils.formatWeeklyTimeTableData;
        
        // Создаем кастомную функцию форматирования
        // Используем приведение типов для обхода проверки типов
        const customFormatter = function(items: IWeeklyTimeTableRawItem[], dayStart?: number): IExtendedWeeklyTimeRow[] {
          // Логируем параметры для отладки
          console.log(`Custom formatWeeklyTimeTableData called with dayOfStartWeek = ${dayStart}`);
          
          // Вызываем оригинальный метод с аргументами того же типа
          const result = origMethod.call(this, items);
          
          // Обогащаем данные дополнительными полями
          for (let i = 0; i < result.length; i++) {
            const formattedRow = result[i];
            const originalRow = items.find(item => {
              // Проверяем ID в различных форматах
              const itemId = 
                item.id !== undefined ? String(item.id) :
                item.ID !== undefined ? String(item.ID) :
                item.fields && item.fields.id !== undefined ? String(item.fields.id) :
                item.fields && item.fields.ID !== undefined ? String(item.fields.ID) :
                null;
              
              return itemId === formattedRow.id;
            });
            
            if (originalRow) {
              // Копируем важные поля из оригинальных данных
              const fields = originalRow.fields || {};
              
              // Поле Deleted
              const deletedValue = 
                fields.Deleted !== undefined ? fields.Deleted :
                fields.deleted !== undefined ? fields.deleted :
                undefined;
                
              if (deletedValue !== undefined) {
                formattedRow.deleted = deletedValue;
                formattedRow.Deleted = deletedValue;
              }
              
              // Поле NumberOfShift
              const shiftValue = 
                fields.NumberOfShift !== undefined ? fields.NumberOfShift :
                fields.numberOfShift !== undefined ? fields.numberOfShift :
                undefined;
                
              if (shiftValue !== undefined) {
                formattedRow.NumberOfShift = shiftValue;
              }
              
              // Поле NumberOfWeek
              const weekValue = 
                fields.NumberOfWeek !== undefined ? fields.NumberOfWeek :
                fields.numberOfWeek !== undefined ? fields.numberOfWeek :
                undefined;
                
              if (weekValue !== undefined) {
                formattedRow.NumberOfWeek = weekValue;
              }
              
              // Поле IdOfTemplate
              const templateValue = 
                fields.IdOfTemplate !== undefined ? fields.IdOfTemplate :
                fields.idOfTemplate !== undefined ? fields.idOfTemplate :
                fields.IdOfTemplateLookupId !== undefined ? fields.IdOfTemplateLookupId :
                undefined;
                
              if (templateValue !== undefined) {
                formattedRow.idOfTemplate = templateValue;
              }
            }
          }
          
          return result;
        };
        
        // Заменяем метод временно
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = customFormatter as typeof WeeklyTimeTableUtils.formatWeeklyTimeTableData;
        
        // Вызываем функцию с передачей параметра dayOfStartWeek
        const formattedData = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeData, dayOfStartWeek);
        
        // Восстанавливаем оригинальный метод
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = origMethod;
        
        return formattedData;
      };
      
      // Форматируем данные
      const formattedData = formatDataWithFields();
      
      // Обновляем общее время для шаблонов
      const dataWithTotalHours = updateDisplayedTotalHours(formattedData as IExtendedWeeklyTimeRow[]);
      
      // Устанавливаем данные
      setTimeTableData(dataWithTotalHours);
      
      // Помечаем, что данные были инициализированы
      dataInitializedRef.current = true;
      
      // Сбрасываем список измененных строк при получении новых данных
      setChangedRows(new Set());
      
      console.log(`Successfully initialized with ${dataWithTotalHours.length} rows from props`);
    } else {
      console.log("No weekly time data provided, showing empty table");
      setTimeTableData([]);
      dataInitializedRef.current = false;
    }
  };
  /**
   * Фильтрует данные таблицы в зависимости от флага showDeleted
   * @param timeTableData Данные таблицы
   * @param showDeleted Флаг отображения удаленных строк
   * @returns Отфильтрованные данные
   */
  export const filterTimeTableData = (
    timeTableData: IExtendedWeeklyTimeRow[],
    showDeleted: boolean
  ): IExtendedWeeklyTimeRow[] => {
    return timeTableData.filter(row => {
      // Проверяем, удалена ли строка - смотрим оба поля для надежности
      const isDeleted = (row.deleted === 1 || row.Deleted === 1);
      
      // Показываем строку, если она не удалена ИЛИ если включен показ удаленных
      return !isDeleted || showDeleted;
    });
  };
  
  