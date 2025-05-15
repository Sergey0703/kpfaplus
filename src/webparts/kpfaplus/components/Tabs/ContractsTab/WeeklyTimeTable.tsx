// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTable.tsx
import * as React from 'react';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import {
  Toggle,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { 
  IExtendedWeeklyTimeRow, 
  getOrderedWeekDays,
  isFirstRowInTemplate,
  isLastRowInTemplate,
  canDeleteRow,
  getStartDayName,
  updateDisplayedTotalHours,
  analyzeWeeklyTableData,
  checkCanAddNewWeek
} from './WeeklyTimeTableLogic';
// В начале файла WeeklyTimeTable.tsx добавьте импорт
import { IWeeklyTimeTableUpdateItem} from '../../../services/WeeklyTimeTableService';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { WeeklyTimeTableUtils } from '../../../models/IWeeklyTimeTable';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import {
  useHoursOptions,
  useMinutesOptions,
  useLunchOptions,
  useTimeChangeHandler,
  useLunchChangeHandler,
  useContractChangeHandler
} from './WeeklyTimeTableHooks';
import {
  createSaveHandler,
  //createAddShiftHandler,
  createDeleteShiftHandler,
  createShowConfirmDialog,
  DialogType
} from './WeeklyTimeTableActions';
import {
  AddShiftButton,
  SaveButton,
  NewWeekButton,
  DeleteButton
} from './WeeklyTimeTableButtons';
import { WeeklyTimeBody } from './WeeklyTimeBody';
import { WeeklyTimeTableService } from '../../../services/WeeklyTimeTableService';

// Интерфейс пропсов для компонента WeeklyTimeTable
export interface IWeeklyTimeTableProps {
  contractId?: string;
  contractName?: string;
  weeklyTimeData?: any[]; // Данные из списка WeeklyTimeTables
  isLoading?: boolean;
  dayOfStartWeek?: number; // День начала недели
  context: WebPartContext; // Контекст веб-части для доступа к API
  onSaveComplete?: (success: boolean) => void; // Функция обратного вызова после сохранения
  currentUserId?: number; // Добавляем свойство для ID текущего пользователя
}

export const WeeklyTimeTable: React.FC<IWeeklyTimeTableProps> = (props) => {
  const {
    contractId,
    contractName,
    weeklyTimeData,
    isLoading: propsIsLoading,
    dayOfStartWeek = 7, // По умолчанию начало недели - суббота (7)
    context,
    onSaveComplete
  } = props;

  // Состояние для отображения удаленных записей
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Состояние для данных таблицы
  const [timeTableData, setTimeTableData] = useState<IExtendedWeeklyTimeRow[]>([]);
  
  // Состояние для загрузки
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

  // Состояние для отслеживания изменений
  const [changedRows, setChangedRows] = useState<Set<string>>(new Set());

  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Состояние для сообщений об ошибках или успешном сохранении
  const [statusMessage, setStatusMessage] = useState<{
    type: MessageBarType;
    message: string;
  } | null>(null);

  // Состояние для диалога подтверждения
  const [confirmDialogProps, setConfirmDialogProps] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Отмена',
    onConfirm: () => {},
    confirmButtonColor: ''
  });

  // Добавляем новое состояние для триггера перезагрузки
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Используем useRef для хранения ID строки, которую нужно удалить
  const pendingActionRowIdRef = useRef<string | null>(null);
  
  // Ref для отслеживания, были ли данные уже инициализированы
  const dataInitializedRef = useRef<boolean>(false);

  // Добавляем отладочный вывод при изменении dayOfStartWeek
  useEffect(() => {
    console.log(`[WeeklyTimeTable] Using DayOfStartWeek = ${dayOfStartWeek}, week starts with: ${getStartDayName(dayOfStartWeek)}`);
  }, [dayOfStartWeek]);

  // Получаем опции из хуков
  const hoursOptions = useHoursOptions();
  const minutesOptions = useMinutesOptions();
  const lunchOptions = useLunchOptions();

  // Создаем функцию для триггера перезагрузки
  const triggerRefresh = () => {
    console.log('Triggering data refresh');
    setRefreshTrigger(prev => prev + 1);
  };

  // 1. Сначала создаем handleDeleteShift, так как он используется в showDialog
  const handleDeleteShift = createDeleteShiftHandler(
    context,
    timeTableData,
    setTimeTableData,
    changedRows,
    setChangedRows,
    setIsSaving,
    setStatusMessage
  );

  const currentUserId = props.currentUserId || 0;
  
  // 2. Затем создаем функцию для отображения диалогов
  const showDialog = createShowConfirmDialog(
    pendingActionRowIdRef,
    setConfirmDialogProps,
    handleDeleteShift,
    timeTableData,
    context,                 // Добавляем контекст
    contractId,              // Добавляем ID контракта
    setTimeTableData,        // Добавляем функцию обновления данных
    changedRows,             // Добавляем множество измененных строк
    setChangedRows,          // Добавляем функцию обновления множества
    setIsSaving,             // Добавляем функцию обновления статуса сохранения
    setStatusMessage,        // Добавляем функцию обновления сообщений
    currentUserId,           // Передаем ID текущего пользователя
    onSaveComplete,          // Добавляем коллбэк завершения (опционально)
    triggerRefresh           // Передаем функцию для триггера перезагрузки
  );

  // Создаем обработчики для изменения данных
  const handleTimeChange = useTimeChangeHandler(
    timeTableData,
    setTimeTableData,
    changedRows,
    setChangedRows,
    setStatusMessage
  );

  const handleLunchChange = useLunchChangeHandler(
    timeTableData,
    setTimeTableData,
    changedRows,
    setChangedRows,
    setStatusMessage
  );

  const handleContractChange = useContractChangeHandler(
    timeTableData,
    setTimeTableData,
    changedRows,
    setChangedRows,
    setStatusMessage
  );


  // Модифицируем функцию handleAddShift, чтобы она принимала выбранную строку как параметр
/**
 * Функция для обработки добавления новой смены с явным указанием строки
 * @param selectedRow Выбранная строка таблицы или null
 */
const handleAddShiftWithRow = (selectedRow: IExtendedWeeklyTimeRow | null): void => {
  console.log('handleAddShiftWithRow called with row:', selectedRow ? 
    `ID=${selectedRow.id}, NumberOfWeek=${selectedRow.NumberOfWeek}` : 'null');
  
  // Создаем локальную функцию, которая будет замкнута на выбранную строку
  const addShiftForSelectedRow = async (): Promise<void> => {
    // Проверяем, есть ли несохраненные изменения
    if (changedRows.size > 0) {
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
    checkDeletedShiftsInWeek(selectedRow);
  };
  
  // Функция для извлечения номера недели из названия строки
  function extractWeekNumber(name: string): number {
    const match = name?.match(/Week\s+(\d+)/i);
    return match ? parseInt(match[1], 10) : 1;
  }
  
  // Функция для проверки удаленных смен в текущей неделе
  function checkDeletedShiftsInWeek(selectedRow: IExtendedWeeklyTimeRow | null) {
    // Добавим подробное логирование для отладки
    console.log('checkDeletedShiftsInWeek called with selectedRow:', selectedRow ? 
      `ID=${selectedRow.id}, NumberOfWeek=${selectedRow.NumberOfWeek}` : 'null');
    
    if (selectedRow) {
      console.log('Selected row details:', {
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
    
    console.log(`Found ${weekNumbersMap.size} different weeks in the data`);
    
    // Вывод всех найденных недель для отладки
    weekNumbersMap.forEach((rows, weekNum) => {
      console.log(`Week ${weekNum}: ${rows.length} rows`);
    });
    
    // Определяем номер текущей недели
    // Если есть selectedRow, берем номер недели из неё
    // В противном случае используем номер недели из первой строки (старое поведение)
    let currentWeekNumber: number;
    
    if (selectedRow && selectedRow.NumberOfWeek !== undefined) {
      currentWeekNumber = selectedRow.NumberOfWeek;
      console.log(`Using NumberOfWeek=${currentWeekNumber} from selected row (ID=${selectedRow.id})`);
    } else if (selectedRow && selectedRow.name) {
      // Если нет NumberOfWeek, но есть имя - пробуем извлечь из имени
      currentWeekNumber = extractWeekNumber(selectedRow.name);
      console.log(`Using week number ${currentWeekNumber} extracted from selected row name: "${selectedRow.name}"`);
    } else {
      // Используем первую строку данных (старое поведение)
      const firstRow = timeTableData.length > 0 ? timeTableData[0] : null;
      if (!firstRow) {
        console.error('No row data available for checking deleted shifts');
        return;
      }
      currentWeekNumber = firstRow.NumberOfWeek || extractWeekNumber(firstRow.name);
      console.log(`Using week number ${currentWeekNumber} from first row (fallback)`);
    }
    
    console.log(`Current week number determined as: ${currentWeekNumber}`);
    
    // Получаем все строки только для текущей недели
    const rowsInCurrentWeek = weekNumbersMap.get(currentWeekNumber) || [];
    console.log(`Found ${rowsInCurrentWeek.length} rows in current week ${currentWeekNumber}`);
    
    // Логируем детали каждой строки в текущей неделе
    rowsInCurrentWeek.forEach((row, index) => {
      console.log(`Week ${currentWeekNumber}, Row ${index}: ID=${row.id}, NumberOfShift=${row.NumberOfShift}, deleted=${row.deleted}`);
    });
    
    // Находим максимальный номер смены в текущей неделе
    let maxShiftNumberInCurrentWeek = 0;
    rowsInCurrentWeek.forEach(row => {
      const shiftNumber = row.NumberOfShift || 1;
      if (shiftNumber > maxShiftNumberInCurrentWeek) {
        maxShiftNumberInCurrentWeek = shiftNumber;
      }
    });
    
    console.log(`Max shift number in current week ${currentWeekNumber}: ${maxShiftNumberInCurrentWeek}`);
    
    // Проверяем наличие удаленных смен только в текущей неделе
    const deletedShiftsInCurrentWeek = rowsInCurrentWeek.filter(row => {
      return (row.deleted === 1 || row.Deleted === 1);
    });
    
    console.log(`Found ${deletedShiftsInCurrentWeek.length} deleted shifts in current week ${currentWeekNumber}`);
    
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
    
    console.log(`Existing shift numbers in current week: ${Array.from(existingShiftNumbers).sort().join(', ')}`);
    
    // Проверяем, есть ли пропущенные номера смен (дыры)
    const missingShiftNumbers: number[] = [];
    for (let i = 1; i <= maxShiftNumberInCurrentWeek; i++) {
      if (!existingShiftNumbers.has(i)) {
        missingShiftNumbers.push(i);
      }
    }
    
    console.log(`Missing shift numbers in current week: ${missingShiftNumbers.join(', ')}`);
    
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
        console.log(`Deleted shifts that need to be restored: ${deletedShiftNumbers.join(', ')}`);
        
        // Показываем информационное сообщение
        showDialog('info', DialogType.INFO, { 
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
  function proceedWithAddingNewShift(currentWeekNumber: number, maxShiftNumberInCurrentWeek: number) {
    console.log(`Proceeding with adding new shift for week ${currentWeekNumber}`);
    
    // Следующий номер смены = максимальный + 1
    const nextShiftNumber = maxShiftNumberInCurrentWeek + 1;
    
    console.log(`Next shift number will be: ${nextShiftNumber}`);
    
    // Показываем диалог подтверждения
    showDialog('add_shift', DialogType.ADD_SHIFT, { 
      weekNumber: currentWeekNumber, 
      nextShiftNumber: nextShiftNumber,
      contractId
    });
  }
  
  // Вызываем созданную функцию
  addShiftForSelectedRow().catch(error => {
    console.error("Error in handleAddShiftWithRow:", error);
    setStatusMessage({
      type: MessageBarType.error,
      message: `Error adding shift: ${error instanceof Error ? error.message : 'Unknown error'}`
    });
  });
};
//////////////////////////
// Обновляем handleAddShiftForRow для использования новой функции
// Обновленная функция handleAddShiftForRow без неиспользуемого вызова setSelectedRowForShift
const handleAddShiftForRow = (rowIndex: number): void => {
  console.log(`Adding shift for row index: ${rowIndex}`);
  
  if (rowIndex >= 0 && rowIndex < filteredTimeTableData.length) {
    const row = filteredTimeTableData[rowIndex];
    console.log(`Selected row: ID=${row.id}, NumberOfWeek=${row.NumberOfWeek}, NumberOfShift=${row.NumberOfShift}, name="${row.name}"`);
    
    // Вызываем handleAddShiftWithRow с выбранной строкой напрямую
    handleAddShiftWithRow(row);
  } else {
    console.error(`Row not found at index ${rowIndex}`);
  }
};
  // 3. Создаем обработчик для добавления смены с использованием диалогов
  // Обновляем создание handleAddShift для использования выбранной строки
  const handleAddShift = (): void => {
    console.log('handleAddShift called (no row specified)');
    handleAddShiftWithRow(null);
  };

  // 4. Создаем обработчик для сохранения
  const handleSave = createSaveHandler(
    context,
    timeTableData,
    setTimeTableData,
    contractId,
    changedRows,
    setChangedRows,
    setIsSaving,
    setStatusMessage,
    onSaveComplete
  );

  // 5. Обновленная функция для вызова диалога удаления/восстановления
  const showDeleteConfirmDialog = (rowId: string): void => {
    // Находим строку по ID
    const row = timeTableData.find(r => r.id === rowId);
    if (!row) {
      console.error(`Row with ID ${rowId} not found`);
      return;
    }
    
    // Определяем тип диалога в зависимости от статуса удаления
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    const dialogType = isDeleted ? DialogType.RESTORE : DialogType.DELETE;
    
    // Показываем диалог
    showDialog(rowId, dialogType);
  };

  // Добавляем эффект, который будет реагировать на изменение refreshTrigger
  useEffect(() => {
    // Пропускаем первый рендеринг
    if (refreshTrigger === 0) return;
    
    console.log(`Refresh triggered (${refreshTrigger}), reloading data...`);
    
    // Загружаем данные с сервера
    const loadData = async () => {
      if (!contractId) return;
      
      setIsTableLoading(true);
      
      try {
        // Получаем свежие данные с сервера
        const service = new WeeklyTimeTableService(context);
        const updatedItems = await service.getWeeklyTimeTableByContractId(contractId);
        
        console.log(`Retrieved ${updatedItems.length} items from server after refresh trigger`);
        
        // Преобразуем полученные данные в формат для отображения
        // Создаем временную функцию, которая вызывает formatWeeklyTimeTableData
        const getFormattedData = () => {
          // Временно изменяем оригинальный метод для поддержки dayOfStartWeek и сохранения поля deleted
          const origMethod = WeeklyTimeTableUtils.formatWeeklyTimeTableData;
          // @ts-ignore - Игнорируем несоответствие сигнатуры для вызова
          WeeklyTimeTableUtils.formatWeeklyTimeTableData = function(items: any[], dayStart?: number) {
            // Сохраняем dayOfStartWeek в локальной переменной
            console.log(`Custom formatWeeklyTimeTableData called with dayOfStartWeek = ${dayStart}`);
            // Вызываем оригинальный метод
            const result = origMethod.call(this, items);
            
            // После получения результата, добавляем поле deleted и idOfTemplate из исходных данных
            for (let i = 0; i < result.length; i++) {
              const formattedRow = result[i];
              const originalRow = items.find(item => {
                // Проверяем ID в различных форматах
                const itemId = 
                  item.id !== undefined ? item.id.toString() :
                  item.ID !== undefined ? item.ID.toString() :
                  item.fields && item.fields.id !== undefined ? item.fields.id.toString() :
                  item.fields && item.fields.ID !== undefined ? item.fields.ID.toString() :
                  null;
                
                return itemId === formattedRow.id;
              });
              
              if (originalRow) {
                // Ищем поле deleted в разных форматах
                const deletedValue = 
                  originalRow.Deleted !== undefined ? originalRow.Deleted :
                  originalRow.deleted !== undefined ? originalRow.deleted :
                  originalRow.fields && originalRow.fields.Deleted !== undefined ? originalRow.fields.Deleted :
                  originalRow.fields && originalRow.fields.deleted !== undefined ? originalRow.fields.deleted :
                  undefined;
                
                if (deletedValue !== undefined) {
                  console.log(`Found deleted status for row ID ${formattedRow.id}: ${deletedValue}`);
                  formattedRow.deleted = deletedValue;
                } else {
                  console.log(`No deleted status found for row ID ${formattedRow.id}`);
                }
                
                // Добавляем поле idOfTemplate из originalRow
                const idOfTemplateValue = 
                  originalRow.IdOfTemplate !== undefined ? originalRow.IdOfTemplate :
                  originalRow.idOfTemplate !== undefined ? originalRow.idOfTemplate :
                  originalRow.fields && originalRow.fields.IdOfTemplate !== undefined ? originalRow.fields.IdOfTemplate :
                  originalRow.fields && originalRow.fields.idOfTemplate !== undefined ? originalRow.fields.idOfTemplate :
                  originalRow.fields && originalRow.fields.IdOfTemplateLookupId !== undefined ? originalRow.fields.IdOfTemplateLookupId :
                  originalRow.IdOfTemplateLookupId !== undefined ? originalRow.IdOfTemplateLookupId :
                  undefined;
                
                if (idOfTemplateValue !== undefined) {
                  console.log(`Found idOfTemplate for row ID ${formattedRow.id}: ${idOfTemplateValue}`);
                  formattedRow.idOfTemplate = idOfTemplateValue;
                }

                // Добавляем NumberOfShift из originalRow
                const NumberOfShiftValue = 
                  originalRow.NumberOfShift !== undefined ? originalRow.NumberOfShift :
                  originalRow.numberOfShift !== undefined ? originalRow.numberOfShift :
                  originalRow.fields && originalRow.fields.NumberOfShift !== undefined ? originalRow.fields.NumberOfShift :
                  originalRow.fields && originalRow.fields.numberOfShift !== undefined ? originalRow.fields.numberOfShift :
                  undefined;
                
                if (NumberOfShiftValue !== undefined) {
                  console.log(`Found NumberOfShift for row ID ${formattedRow.id}: ${NumberOfShiftValue}`);
                  formattedRow.NumberOfShift = NumberOfShiftValue;
                } else {
                  console.log(`No NumberOfShift found for row ID ${formattedRow.id}`);
                }
                
                // Добавляем NumberOfWeek из originalRow
                const NumberOfWeekValue = 
                  originalRow.NumberOfWeek !== undefined ? originalRow.NumberOfWeek :
                  originalRow.numberOfWeek !== undefined ? originalRow.numberOfWeek :
                  originalRow.fields && originalRow.fields.NumberOfWeek !== undefined ? originalRow.fields.NumberOfWeek :
                  originalRow.fields && originalRow.fields.numberOfWeek !== undefined ? originalRow.fields.numberOfWeek :
                  undefined;

                if (NumberOfWeekValue !== undefined) {
                  console.log(`Found NumberOfWeek for row ID ${formattedRow.id}: ${NumberOfWeekValue}`);
                  formattedRow.NumberOfWeek = NumberOfWeekValue;
                } else {
                  console.log(`No NumberOfWeek found for row ID ${formattedRow.id}`);
                }
              } else {
                console.log(`No original row found for formatted row ID ${formattedRow.id}`);
              }
            }
            
            return result;
          };
          
          // Вызываем метод
          const result = WeeklyTimeTableUtils.formatWeeklyTimeTableData(updatedItems);
          
          // Восстанавливаем оригинальный метод
          WeeklyTimeTableUtils.formatWeeklyTimeTableData = origMethod;
          
          return result;
        };
        
        const formattedData = getFormattedData();
        console.log(`Formatted ${formattedData.length} rows for display after refresh`);
        
        // Обновляем отображаемое общее время в первой строке каждого шаблона
        const dataWithTotalHours = updateDisplayedTotalHours(formattedData as IExtendedWeeklyTimeRow[]);
        
        // Устанавливаем обновленные данные
        setTimeTableData(dataWithTotalHours);
        
        // Сбрасываем список измененных строк
        setChangedRows(new Set());
        
        // Помечаем, что данные были инициализированы
        dataInitializedRef.current = true;
        
      } catch (error) {
        console.error('Error refreshing data:', error);
        
        setStatusMessage({
          type: MessageBarType.error,
          message: `Failed to refresh data: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      } finally {
        setIsTableLoading(false);
      }
    };
    
    loadData();
  }, [refreshTrigger, contractId, dayOfStartWeek, context]);

  // Использование useLayoutEffect вместо useEffect для синхронного обновления состояния перед рендерингом
  useLayoutEffect(() => {
    // Если есть данные из props, используем их
    if (weeklyTimeData && weeklyTimeData.length > 0) {
      console.log(`Processing ${weeklyTimeData.length} weekly time table entries from props`);
      
      // Логирование исходных данных
      console.log("Original weeklyTimeData sample:", weeklyTimeData.slice(0, 1));
      console.log("Looking for row with ID 350 in original data...");
      const row350 = weeklyTimeData.find(item => 
        item.id === 350 || item.ID === 350 || item.id === "350" || item.ID === "350" ||
        (item.fields && (item.fields.id === 350 || item.fields.ID === 350 || item.fields.id === "350" || item.fields.ID === "350"))
      );
      if (row350) {
        console.log("Found row 350 in original data:", row350);
        console.log("Deleted property:", row350.Deleted || row350.deleted || 
          (row350.fields && (row350.fields.Deleted || row350.fields.deleted)));
      }
      
      // Преобразуем данные из списка в формат для отображения
      // Создаем временную функцию, которая вызывает formatWeeklyTimeTableData
      const getFormattedData = () => {
        // Временно изменяем оригинальный метод для поддержки dayOfStartWeek и сохранения поля deleted
        const origMethod = WeeklyTimeTableUtils.formatWeeklyTimeTableData;
        // @ts-ignore - Игнорируем несоответствие сигнатуры для вызова
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = function(items: any[], dayStart?: number) {
          // Сохраняем dayOfStartWeek в локальной переменной
          console.log(`Custom formatWeeklyTimeTableData called with dayOfStartWeek = ${dayStart}`);
          // Вызываем оригинальный метод
          const result = origMethod.call(this, items);
          
          // После получения результата, добавляем поле deleted и idOfTemplate из исходных данных
          for (let i = 0; i < result.length; i++) {
            const formattedRow = result[i];
            const originalRow = items.find(item => {
              // Проверяем ID в различных форматах
              const itemId = 
                item.id !== undefined ? item.id.toString() :
                item.ID !== undefined ? item.ID.toString() :
                item.fields && item.fields.id !== undefined ? item.fields.id.toString() :
                item.fields && item.fields.ID !== undefined ? item.fields.ID.toString() :
                null;
              
              return itemId === formattedRow.id;
            });
            
            if (originalRow) {
              // Ищем поле deleted в разных форматах
              const deletedValue = 
                originalRow.Deleted !== undefined ? originalRow.Deleted :
                originalRow.deleted !== undefined ? originalRow.deleted :
                originalRow.fields && originalRow.fields.Deleted !== undefined ? originalRow.fields.Deleted :
                originalRow.fields && originalRow.fields.deleted !== undefined ? originalRow.fields.deleted :
                undefined;
              
              if (deletedValue !== undefined) {
                console.log(`Found deleted status for row ID ${formattedRow.id}: ${deletedValue}`);
                formattedRow.deleted = deletedValue;
              } else {
                console.log(`No deleted status found for row ID ${formattedRow.id}`);
              }
              
              // Добавляем поле idOfTemplate из originalRow
              const idOfTemplateValue = 
                originalRow.IdOfTemplate !== undefined ? originalRow.IdOfTemplate :
                originalRow.idOfTemplate !== undefined ? originalRow.idOfTemplate :
                originalRow.fields && originalRow.fields.IdOfTemplate !== undefined ? originalRow.fields.IdOfTemplate :
                originalRow.fields && originalRow.fields.idOfTemplate !== undefined ? originalRow.fields.idOfTemplate :
                originalRow.fields && originalRow.fields.IdOfTemplateLookupId !== undefined ? originalRow.fields.IdOfTemplateLookupId :
                originalRow.IdOfTemplateLookupId !== undefined ? originalRow.IdOfTemplateLookupId :
                undefined;
              
              if (idOfTemplateValue !== undefined) {
                console.log(`Found idOfTemplate for row ID ${formattedRow.id}: ${idOfTemplateValue}`);
                formattedRow.idOfTemplate = idOfTemplateValue;
              }

              // Добавляем NumberOfShift из originalRow
              const NumberOfShiftValue = 
                originalRow.NumberOfShift !== undefined ? originalRow.NumberOfShift :
                originalRow.numberOfShift !== undefined ? originalRow.numberOfShift :
                originalRow.fields && originalRow.fields.NumberOfShift !== undefined ? originalRow.fields.NumberOfShift :
                originalRow.fields && originalRow.fields.numberOfShift !== undefined ? originalRow.fields.numberOfShift :
                undefined;
              
              if (NumberOfShiftValue !== undefined) {
                console.log(`Found NumberOfShift for row ID ${formattedRow.id}: ${NumberOfShiftValue}`);
                formattedRow.NumberOfShift = NumberOfShiftValue;
              } else {
                console.log(`No NumberOfShift found for row ID ${formattedRow.id}`);
              }
              // Добавляем NumberOfWeek из originalRow
              const NumberOfWeekValue = 
                originalRow.NumberOfWeek !== undefined ? originalRow.NumberOfWeek :
                originalRow.numberOfWeek !== undefined ? originalRow.numberOfWeek :
                originalRow.fields && originalRow.fields.NumberOfWeek !== undefined ? originalRow.fields.NumberOfWeek :
                originalRow.fields && originalRow.fields.numberOfWeek !== undefined ? originalRow.fields.numberOfWeek :
                undefined;

              if (NumberOfWeekValue !== undefined) {
                console.log(`Found NumberOfWeek for row ID ${formattedRow.id}: ${NumberOfWeekValue}`);
                formattedRow.NumberOfWeek = NumberOfWeekValue;
              } else {
                console.log(`No NumberOfWeek found for row ID ${formattedRow.id}`);
              }
            } else {
              console.log(`No original row found for formatted row ID ${formattedRow.id}`);
            }
          }
          
          return result;
        };
        
        // Вызываем метод
        const result = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeData);
        
        // Восстанавливаем оригинальный метод
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = origMethod;
        
        return result;
      };
      
      const formattedData = getFormattedData();
      console.log(`Formatted ${formattedData.length} rows for display`);
      
      // Проверяем наличие поля deleted в отформатированных данных
      formattedData.forEach((row, index) => {
        console.log(`Row ${index} (ID: ${row.id}): deleted status = ${row.deleted}, type: ${typeof row.deleted}, NumberOfShift = ${row.NumberOfShift}`);
      });
      
      console.log("Sample formatted row:", formattedData.length > 0 ? formattedData[0] : "No data");
      
      // Обновляем отображаемое общее время в первой строке каждого шаблона
      const dataWithTotalHours = updateDisplayedTotalHours(formattedData as IExtendedWeeklyTimeRow[]);
      console.log("dataWithTotalHours length:", dataWithTotalHours.length);
      if (dataWithTotalHours.length > 0) {
        console.log("AFTER TOTAL HOURS - First row sample:", JSON.stringify(dataWithTotalHours[0], null, 2));
        console.log(`AFTER TOTAL HOURS - NumberOfShift present: ${dataWithTotalHours[0].NumberOfShift !== undefined}`);
        console.log(`AFTER TOTAL HOURS - NumberOfShift value: ${dataWithTotalHours[0].NumberOfShift}`);
      }
      // Устанавливаем данные
      setTimeTableData(dataWithTotalHours);
      console.log("After setTimeTableData, state should update soon");
      
      // Помечаем, что данные были инициализированы
      dataInitializedRef.current = true;
      
      // Сбрасываем список измененных строк при получении новых данных
      setChangedRows(new Set());
    } else if (contractId) {
      console.log(`No weekly time data provided for contract ${contractId}`);
      // Устанавливаем пустой массив, если нет данных
      setTimeTableData([]);
      // Сбрасываем флаг инициализации данных
      dataInitializedRef.current = false;
    } else {
      console.log("No contract ID or data, showing empty table");
      setTimeTableData([]);
      // Сбрасываем флаг инициализации данных
      dataInitializedRef.current = false;
    }
    
    // Сбрасываем статусное сообщение при изменении данных
    setStatusMessage(null);
  }, [contractId, weeklyTimeData, dayOfStartWeek]);
  
  // Обновляем состояние загрузки, если оно изменилось в пропсах
  useEffect(() => {
    if (propsIsLoading !== undefined) {
      setIsTableLoading(propsIsLoading);
    }
  }, [propsIsLoading]);

  // Обработчик изменения переключателя "Show Deleted"
  const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setShowDeleted(checked);
    }
  };

  // Обработчик для закрытия диалога
  const handleDismissConfirmDialog = (): void => {
    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
    pendingActionRowIdRef.current = null;
  };

  // Создаем функцию для добавления новой недели
const handleAddWeek = (): void => {
  // Анализируем структуру данных для определения текущих недель
  const analysisResult = analyzeWeeklyTableData(timeTableData);
  
  // Проверяем возможность добавления новой недели
  const addWeekCheckResult = checkCanAddNewWeek(analysisResult);
  
  // Показываем диалог подтверждения с результатами проверки
  if (addWeekCheckResult.canAdd) {
    // Если можно добавить новую неделю, показываем диалог ADD_WEEK
    showDialog('add_week', DialogType.ADD_WEEK, addWeekCheckResult);
  } else {
    // Если нельзя добавить новую неделю, показываем информационный диалог
    showDialog('info', DialogType.INFO, { 
      message: addWeekCheckResult.message,
      confirmButtonText: "OK"
    });
  }
};
  // Получаем упорядоченные дни недели на основе dayOfStartWeek
  const orderedWeekDays = getOrderedWeekDays(dayOfStartWeek);

 
  // 3. Функция для отображения кнопки "+Shift" в строке
 // Обновляем определение функции renderAddShiftButton
const renderAddShiftButton = (rowIndex?: number): JSX.Element => {
  return (
    <AddShiftButton 
      onClick={() => {
        if (typeof rowIndex === 'number') {
          handleAddShiftForRow(rowIndex);
        } else {
          // Если rowIndex не передан, используем обычный handleAddShift
          handleAddShift();
        }
      }} 
      isSaving={isSaving} 
    />
  );
};
  
  // Добавляем новую функцию для обработки нажатия на кнопку "+Shift" в конкретной строке
// Обновляем handleAddShiftForRow, чтобы сохранить выбранную строку для использования в handleAddShift


// Добавляем состояние для хранения выбранной строки
//const [selectedRowForShift, setSelectedRowForShift] = useState<IExtendedWeeklyTimeRow | null>(null);
  // Функция для определения, является ли строка первой с новым NumberOfShift
  const isFirstRowWithNewTemplate = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
    const currentRow = data[rowIndex];
    
    // Проверяем поле NumberOfShift напрямую в строке
    if (currentRow.NumberOfShift !== undefined) {
      // Логируем для отладки
      console.log(`Row ${rowIndex} - ID: ${currentRow.id}, NumberOfShift: ${currentRow.NumberOfShift}`);
      
      // Возвращаем true, если NumberOfShift равен 1
      return currentRow.NumberOfShift === 1;
    }
    
    // Если поля NumberOfShift нет, возвращаем false
    console.log(`Row ${rowIndex} - ID: ${currentRow.id}, NumberOfShift not found`);
    return false;
  };

  // Логируем текущее состояние timeTableData перед рендерингом
  console.log("Before rendering, timeTableData length:", timeTableData.length);
  console.log("Data initialized:", dataInitializedRef.current);

  // Фильтруем строки в зависимости от флага showDeleted
  const filteredTimeTableData = timeTableData.filter(row => {
    // Проверяем, удалена ли строка - смотрим оба поля для надежности
    const isDeleted = (row.deleted === 1 || row.Deleted === 1);
    
    // Для отладки
    console.log(`Filtering row ID ${row.id}: deleted=${row.deleted}, Deleted=${row.Deleted}, isDeleted=${isDeleted}, showing=${!isDeleted || showDeleted}`);
    
    // Показываем строку, если она не удалена ИЛИ если включен показ удаленных
    return !isDeleted || showDeleted;
  });

  // Логируем результаты фильтрации
  console.log(`Filtered timeTableData: ${filteredTimeTableData.length} of ${timeTableData.length} rows`);
  console.log(`showDeleted: ${showDeleted}`);

  // Функция для рендеринга кнопки удаления или восстановления
  const renderDeleteButton = (rowIndex: number): JSX.Element => {
    console.log(`renderDeleteButton called for row ${rowIndex}`);
    
    const row = filteredTimeTableData[rowIndex];
    const rowId = row.id;
    
    // Логирование для диагностики
    console.log(`renderDeleteButton for row ${rowIndex} (ID: ${rowId}): deleted status = ${row.deleted}, type: ${typeof row.deleted}`);
    
    // Проверяем, удалена ли строка
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    console.log(`Row ${rowIndex} isDeleted: ${isDeleted}`);
    
    return (
      <DeleteButton
        rowIndex={rowIndex}
        rowId={rowId}
        onClick={showDeleteConfirmDialog}
        isSaving={isSaving}
        isDeleted={isDeleted}
      />
    );
  };
  
  // Если загружаются данные, показываем спиннер
  if (isTableLoading) {
    return (
      <div className={styles.spinnerContainer}>
        <Spinner size={SpinnerSize.large} label="Loading weekly time table..." />
      </div>
    );
  }
  
  // Если нет данных, показываем кнопку для добавления новой смены
  // Добавлена проверка dataInitializedRef.current, чтобы избежать отображения пустого шаблона при первом рендеринге
  if ((filteredTimeTableData.length === 0 && !isTableLoading) || (!dataInitializedRef.current && filteredTimeTableData.length === 0)) {
    return (
      <div className={styles.weeklyTimeTable}>
        <div className={styles.tableHeader}>
          <div className={styles.tableTitle}>
            <h3>{contractName || 'Weekly Schedule'}</h3>
            <div className={styles.toggleContainer}>
              <Toggle
                label="Show Deleted"
                checked={showDeleted}
                onChange={handleShowDeletedChange}
                styles={{ root: { marginBottom: 0 } }}
              />
            </div>
          </div>
          <div className={styles.actionButtons}>
            <NewWeekButton onClick={handleAddWeek} isSaving={isSaving} />
          </div>
        </div>
        
        {/* Отображение статусного сообщения, если оно есть */}
        {statusMessage && (
          <div className={styles.statusMessageContainer}>
            <MessageBar
              messageBarType={statusMessage.type}
              isMultiline={false}
              dismissButtonAriaLabel="Close"
            >
              {statusMessage.message}
            </MessageBar>
          </div>
        )}
        
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p>No schedule data found for this contract. Click "New Week" to create a schedule.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.weeklyTimeTable}>
      <div className={styles.tableHeader}>
        <div className={styles.tableTitle}>
          <h3>{contractName || 'Weekly Schedule'}</h3>
          <div className={styles.toggleContainer}>
            <Toggle
              label="Show Deleted"
              checked={showDeleted}
              onChange={handleShowDeletedChange}
              styles={{ root: { marginBottom: 0 } }}
            />
          </div>
        </div>
        <div className={styles.actionButtons}>
          <NewWeekButton onClick={handleAddWeek} isSaving={isSaving} />
          <SaveButton 
            onClick={handleSave} 
            disabled={changedRows.size === 0} 
            isSaving={isSaving} 
          />
          {/* Добавляем индикатор сохранения, если процесс сохранения активен */}
          {isSaving && (
            <Spinner
              size={SpinnerSize.small}
              styles={{ root: { marginLeft: 8, display: 'inline-block' } }}
            />
          )}
        </div>
      </div>
      
      {/* Отображение статусного сообщения, если оно есть */}
      {statusMessage && (
        <div className={styles.statusMessageContainer}>
          <MessageBar
            messageBarType={statusMessage.type}
            isMultiline={false}
            dismissButtonAriaLabel="Close"
          >
            {statusMessage.message}
          </MessageBar>
        </div>
      )}
      
      {/* Отображение информации о количестве измененных строк */}
      {changedRows.size > 0 && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          isMultiline={false}
          styles={{ root: { marginTop: 10, marginBottom: 10 } }}
        >
          {`You have ${changedRows.size} unsaved ${changedRows.size === 1 ? 'change' : 'changes'}. Don't forget to click "Save" to apply them.`}
        </MessageBar>
      )}

      {/* Вынесли рендеринг тела таблицы в отдельный компонент */}
      <WeeklyTimeBody 
        filteredTimeTableData={filteredTimeTableData}
        orderedWeekDays={orderedWeekDays}
        isFirstRowWithNewTemplate={isFirstRowWithNewTemplate}
        isFirstRowInTemplate={isFirstRowInTemplate}
        isLastRowInTemplate={isLastRowInTemplate}
        canDeleteRow={canDeleteRow}
        renderAddShiftButton={renderAddShiftButton}
        renderDeleteButton={renderDeleteButton}
        changedRows={changedRows}
        hoursOptions={hoursOptions}
        minutesOptions={minutesOptions}
        lunchOptions={lunchOptions}
        handleTimeChange={handleTimeChange}
        handleLunchChange={handleLunchChange}
        handleContractChange={handleContractChange}
      />

      {/* Диалог подтверждения */}
      <ConfirmDialog
        isOpen={confirmDialogProps.isOpen}
        title={confirmDialogProps.title}
        message={confirmDialogProps.message}
        confirmButtonText={confirmDialogProps.confirmButtonText}
        cancelButtonText={confirmDialogProps.cancelButtonText}
        onDismiss={handleDismissConfirmDialog}
        onConfirm={confirmDialogProps.onConfirm}
        confirmButtonColor={confirmDialogProps.confirmButtonColor}
      />
    </div>
  );
};

export default WeeklyTimeTable;