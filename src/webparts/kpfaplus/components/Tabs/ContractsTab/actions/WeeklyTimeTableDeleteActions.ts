// src/webparts/kpfaplus/components/Tabs/ContractsTab/actions/WeeklyTimeTableDeleteActions.ts
import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IExtendedWeeklyTimeRow, updateDisplayedTotalHours } from '../WeeklyTimeTableLogic';
import { WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';

/**
 * Создает обработчик для удаления/восстановления смены
 * @param context Контекст веб-части
 * @param timeTableData Данные таблицы
 * @param setTimeTableData Функция для обновления данных таблицы
 * @param changedRows Множество измененных строк
 * @param setChangedRows Функция для обновления множества измененных строк
 * @param setIsSaving Функция для обновления статуса сохранения
 * @param setStatusMessage Функция для обновления статусного сообщения
 * @returns Функция для удаления/восстановления смены
 */
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
  } | undefined>>
): (rowIndex: number) => Promise<void> => {
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
      
      // Удаляем строку из списка измененных, если она была там
      if (changedRows.has(rowId)) {
        const newChangedRows = new Set(changedRows);
        newChangedRows.delete(rowId);
        setChangedRows(newChangedRows);
      }
      
      // Важно: обновляем отображаемое общее время в первой строке каждого шаблона
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
};