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
  updateDisplayedTotalHours
} from './WeeklyTimeTableLogic';
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
  createAddShiftHandler,
  createDeleteShiftHandler,
  createShowDeleteConfirmDialog
} from './WeeklyTimeTableActions';
import {
  AddShiftButton,
  SaveButton,
  NewWeekButton,
  DeleteButton
} from './WeeklyTimeTableButtons';
import { WeeklyTimeBody } from './WeeklyTimeBody';

// Интерфейс пропсов для компонента WeeklyTimeTable
export interface IWeeklyTimeTableProps {
  contractId?: string;
  contractName?: string;
  weeklyTimeData?: any[]; // Данные из списка WeeklyTimeTables
  isLoading?: boolean;
  dayOfStartWeek?: number; // День начала недели
  context: WebPartContext; // Контекст веб-части для доступа к API
  onSaveComplete?: (success: boolean) => void; // Функция обратного вызова после сохранения
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

  // Создаем обработчики для действий
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

  const handleAddShift = createAddShiftHandler(
    timeTableData,
    setTimeTableData,
    changedRows,
    setChangedRows,
    setStatusMessage
  );

  const handleDeleteShift = createDeleteShiftHandler(
    context,
    timeTableData,
    setTimeTableData,
    changedRows,
    setChangedRows,
    setIsSaving,
    setStatusMessage
  );

  const showDeleteConfirmDialog = createShowDeleteConfirmDialog(
    pendingActionRowIdRef,
    setConfirmDialogProps,
    handleDeleteShift,
    timeTableData
  );

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

  // Получаем упорядоченные дни недели на основе dayOfStartWeek
  const orderedWeekDays = getOrderedWeekDays(dayOfStartWeek);

  // Функция для рендеринга кнопки "+ Shift"
  const renderAddShiftButton = (): JSX.Element => {
    return <AddShiftButton onClick={handleAddShift} isSaving={isSaving} />;
  };

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
    // Проверяем, удалена ли строка
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    // Показываем строку, если она не удалена ИЛИ если включен показ удаленных
    return !isDeleted || showDeleted;
  });

  // Логируем результаты фильтрации
  console.log(`Filtered timeTableData: ${filteredTimeTableData.length} of ${timeTableData.length} rows`);
  console.log(`showDeleted: ${showDeleted}`);

  // Функция для рендеринга кнопки удаления или восстановления
  const renderDeleteButton = (rowIndex: number): JSX.Element => {
    const row = filteredTimeTableData[rowIndex];
    const rowId = row.id;
    
    // Логирование для диагностики
    console.log(`Row ${rowIndex} (ID: ${rowId}): deleted status = ${row.deleted}, type: ${typeof row.deleted}`);
    
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
            <NewWeekButton onClick={handleAddShift} isSaving={isSaving} />
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
          <NewWeekButton onClick={handleAddShift} isSaving={isSaving} />
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