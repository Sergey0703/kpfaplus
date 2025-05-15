// src/webparts/kpfaplus/components/Tabs/ContractsTab/actions/WeeklyTimeTableSaveActions.ts
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IExtendedWeeklyTimeRow } from '../WeeklyTimeTableLogic';
import { IWeeklyTimeTableUpdateItem, WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';

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