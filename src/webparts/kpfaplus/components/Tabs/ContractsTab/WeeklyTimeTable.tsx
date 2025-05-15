// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTable.tsx
import * as React from 'react';
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';

// Импортируем новые компоненты
import WeeklyTimeTableControls from './WeeklyTimeTableControls';
import WeeklyTimeTableBody from './WeeklyTimeTableBody';
import WeeklyTimeTableDialogs, { 
  createDialogProps, 
  IAddWeekDialogData,
  IAddShiftDialogData,
  IInfoDialogData 
} from './WeeklyTimeTableDialogs';

// Импортируем функции API и логики
import { 
  loadWeeklyTimeTableData,
  saveWeeklyTimeTable,
  addNewShift,
  addNewWeek,
  deleteRestoreShift,
  checkCanAddNewWeekFromData,
  initializeWithExistingData,
  IWeeklyTimeTableRawItem,
  filterTimeTableData
} from './WeeklyTimeTableAPI';
import { 
  getOrderedWeekDays,
  IExtendedWeeklyTimeRow,
} from './WeeklyTimeTableLogic';
import { DialogType, StatusMessageType } from './actions/WeeklyTimeTableTypes';

// Импортируем хуки для опций и обработчиков
import {
  useHoursOptions,
  useMinutesOptions,
  useLunchOptions,
  useTimeChangeHandler,
  useLunchChangeHandler,
  useContractChangeHandler
} from './WeeklyTimeTableHooks';

// Импортируем компоненты для кнопок
import { AddShiftButton, DeleteButton } from './WeeklyTimeTableButtons';

// Интерфейс пропсов для компонента WeeklyTimeTable
export interface IWeeklyTimeTableProps {
  contractId?: string;
  contractName?: string;
  weeklyTimeData?: unknown[]; // Используем unknown[] вместо any[]
  isLoading?: boolean;
  dayOfStartWeek?: number; // День начала недели
  context: WebPartContext; // Контекст веб-части для доступа к API
  onSaveComplete?: (success: boolean) => void; // Функция обратного вызова после сохранения
  currentUserId?: number; // ID текущего пользователя
}

export const WeeklyTimeTable: React.FC<IWeeklyTimeTableProps> = (props) => {
  const {
    contractId,
    contractName,
    weeklyTimeData,
    isLoading: propsIsLoading,
    dayOfStartWeek = 7, // По умолчанию начало недели - суббота (7)
    context,
    onSaveComplete,
    currentUserId = 0
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
  const [statusMessage, setStatusMessage] = useState<StatusMessageType>(undefined);

  // Состояние для диалога подтверждения
  const [dialogProps, setDialogProps] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '',
    onConfirm: () => {} // Функция, которая будет вызвана при подтверждении
  });

  // Добавляем состояние для триггера перезагрузки
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Используем useRef для хранения ID строки, которую нужно удалить
  const pendingActionRowIdRef = useRef<string | undefined>(undefined);
  
  // Ref для отслеживания, были ли данные уже инициализированы
  const dataInitializedRef = useRef<boolean>(false);

  // Получаем опции из хуков
  const hoursOptions = useHoursOptions();
  const minutesOptions = useMinutesOptions();
  const lunchOptions = useLunchOptions();

  // Создаем функцию для триггера перезагрузки
  const triggerRefresh = (): void => {
    console.log('Triggering data refresh');
    setRefreshTrigger(prev => prev + 1);
  };

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

  // Вычисляем упорядоченные дни недели на основе dayOfStartWeek
  const orderedWeekDays = getOrderedWeekDays(dayOfStartWeek);

  // Фильтруем строки в зависимости от флага showDeleted
  const filteredTimeTableData = filterTimeTableData(timeTableData, showDeleted);

  // Эффект для инициализации с данными из props
  useLayoutEffect(() => {
    initializeWithExistingData(
      weeklyTimeData as IWeeklyTimeTableRawItem[] | undefined,
      dataInitializedRef,
      setTimeTableData,
      setChangedRows,
      dayOfStartWeek
    );
  }, [contractId, weeklyTimeData, dayOfStartWeek]);
  
  // Эффект для перезагрузки данных при изменении refreshTrigger
  useEffect(() => {
    if (refreshTrigger === 0) return; // Пропускаем первый рендеринг
    
    // Вызываем функцию загрузки данных
    loadWeeklyTimeTableData(
      context,
      contractId,
      setIsTableLoading,
      setTimeTableData,
      setStatusMessage,
      dataInitializedRef,
      dayOfStartWeek
    );
  }, [refreshTrigger, contractId, context, dayOfStartWeek]);
  
  // Обновляем состояние загрузки, если оно изменилось в пропсах
  useEffect(() => {
    if (propsIsLoading !== undefined) {
      setIsTableLoading(propsIsLoading);
    }
  }, [propsIsLoading]);

  // Функция для проверки, является ли строка первой с новым шаблоном
  const isFirstRowWithNewTemplate = (data: IExtendedWeeklyTimeRow[], rowIndex: number): boolean => {
    const currentRow = data[rowIndex];
    
    // Проверяем поле NumberOfShift напрямую в строке
    if (currentRow.NumberOfShift !== undefined) {
      console.log(`Row ${rowIndex} - ID: ${currentRow.id}, NumberOfShift: ${currentRow.NumberOfShift}`);
      
      // Возвращаем true, если NumberOfShift равен 1
      return currentRow.NumberOfShift === 1;
    }
    
    // Если поля NumberOfShift нет, возвращаем false
    console.log(`Row ${rowIndex} - ID: ${currentRow.id}, NumberOfShift not found`);
    return false;
  };

  // Функция для показа диалога подтверждения
  const showDialog = (dialogType: DialogType, rowId?: string, additionalData?: unknown): void => {
    if (rowId) {
      pendingActionRowIdRef.current = rowId;
    }
    
    // Получаем параметры диалога на основе типа
    const newDialogProps = createDialogProps(dialogType, additionalData);
    
    // Устанавливаем обработчик для диалога в зависимости от типа
    let onConfirm: () => void;
    
    switch (dialogType) {
      case DialogType.DELETE:
      case DialogType.RESTORE:
        onConfirm = (): void => {
          const rowId = pendingActionRowIdRef.current;
          if (rowId) {
            const rowIndex = timeTableData.findIndex(row => row.id === rowId);
            if (rowIndex !== -1) {
              deleteRestoreShift({
                context,
                timeTableData,
                rowIndex,
                setIsSaving,
                setStatusMessage,
                setTimeTableData,
                setChangedRows
              });
            }
          }
          setDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingActionRowIdRef.current = undefined;
        };
        break;
        
      case DialogType.ADD_WEEK:
        onConfirm = (): void => {
          const addWeekCheck = additionalData as IAddWeekDialogData;
          if (addWeekCheck?.canAdd && addWeekCheck?.weekNumberToAdd) {
            addNewWeek({
              context,
              timeTableData,
              contractId,
              weekNumberToAdd: addWeekCheck.weekNumberToAdd,
              currentUserId,
              setIsSaving,
              setStatusMessage,
              setTimeTableData,
              setChangedRows,
              onSaveComplete,
              onRefresh: triggerRefresh
            });
          }
          setDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingActionRowIdRef.current = undefined;
        };
        break;
        
      case DialogType.ADD_SHIFT:
        onConfirm = (): void => {
          const addShiftData = additionalData as IAddShiftDialogData;
          if (addShiftData?.weekNumber && addShiftData?.nextShiftNumber) {
            addNewShift({
              context,
              timeTableData,
              contractId,
              weekNumber: addShiftData.weekNumber,
              nextShiftNumber: addShiftData.nextShiftNumber,
              currentUserId,
              setIsSaving,
              setStatusMessage,
              setTimeTableData,
              setChangedRows,
              onSaveComplete,
              onRefresh: triggerRefresh
            });
          }
          setDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingActionRowIdRef.current = undefined;
        };
        break;
        
      case DialogType.INFO:
        onConfirm = (): void => {
          const infoData = additionalData as IInfoDialogData;
          const customAction = infoData?.customAction;
          if (customAction && typeof customAction === 'function') {
            customAction(true);
          }
          setDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingActionRowIdRef.current = undefined;
        };
        break;
        
      default:
        onConfirm = (): void => {
          setDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingActionRowIdRef.current = undefined;
        };
    }
    
    // Устанавливаем параметры диалога с обработчиком
    setDialogProps({
      ...newDialogProps,
      isOpen: true,
      onConfirm: onConfirm // Устанавливаем функцию обработчика
    });
  };

  // Обработчик для закрытия диалога
  const handleDismissDialog = (): void => {
    setDialogProps(prev => ({ ...prev, isOpen: false }));
    pendingActionRowIdRef.current = undefined;
  };
  
  // Обработчик изменения переключателя "Show Deleted"
  const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setShowDeleted(checked);
    }
  };
  
  // Обработчик для сохранения изменений
  const handleSave = (): Promise<void> => {
    return saveWeeklyTimeTable({
      context,
      timeTableData,
      contractId,
      changedRows,
      setIsSaving,
      setStatusMessage,
      setTimeTableData,
      setChangedRows,
      onSaveComplete
    });
  };
  
  // Обработчик для добавления новой недели
  const handleAddWeek = (): void => {
    // Анализируем структуру данных для определения текущих недель
    const addWeekCheckResult = checkCanAddNewWeekFromData(timeTableData);
    
    // Показываем диалог подтверждения с результатами проверки
    if (addWeekCheckResult.canAdd) {
      // Если можно добавить новую неделю, показываем диалог ADD_WEEK
      showDialog(DialogType.ADD_WEEK, undefined, addWeekCheckResult);
    } else {
      // Если нельзя добавить новую неделю, показываем информационный диалог
      showDialog(DialogType.INFO, undefined, { 
        message: addWeekCheckResult.message,
        confirmButtonText: "OK"
      });
    }
  };
  
  // Обработчик для добавления новой смены
  const handleAddShift = (rowIndex: number): void => {
    const row = filteredTimeTableData[rowIndex];
    if (!row) return;
    
    const weekNumber = row.NumberOfWeek || 1;
    
    // Находим максимальный номер смены в текущей неделе
    let maxShiftNumber = 0;
    timeTableData.forEach(row => {
      if (row.NumberOfWeek === weekNumber && !row.deleted && !row.Deleted) {
        const shiftNumber = row.NumberOfShift || 1;
        if (shiftNumber > maxShiftNumber) {
          maxShiftNumber = shiftNumber;
        }
      }
    });
    
    // Следующий номер смены = максимальный + 1
    const nextShiftNumber = maxShiftNumber + 1;
    
    // Показываем диалог подтверждения добавления новой смены
    showDialog(DialogType.ADD_SHIFT, undefined, { 
      weekNumber, 
      nextShiftNumber,
      contractId
    });
  };
  
  // Функция для показа диалога удаления/восстановления
  const handleDeleteToggle = (rowId: string): void => {
    const row = timeTableData.find(r => r.id === rowId);
    if (!row) return;
    
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    const dialogType = isDeleted ? DialogType.RESTORE : DialogType.DELETE;
    
    // Показываем диалог
    showDialog(dialogType, rowId);
  };
  
  // Функция для рендеринга кнопки "+Shift" в строке
  const renderAddShiftButton = (rowIndex?: number): JSX.Element => {
    return (
      <AddShiftButton 
        onClick={() => {
          if (typeof rowIndex === 'number') {
            handleAddShift(rowIndex);
          }
        }} 
        isSaving={isSaving} 
      />
    );
  };
  
  // Функция для рендеринга кнопки удаления/восстановления
  const renderDeleteButton = (rowIndex: number): JSX.Element => {
    const row = filteredTimeTableData[rowIndex];
    const rowId = row.id;
    const isDeleted = row.deleted === 1 || row.Deleted === 1;
    
    return (
      <DeleteButton
        rowIndex={rowIndex}
        rowId={rowId}
        onClick={handleDeleteToggle}
        isSaving={isSaving}
        isDeleted={isDeleted}
      />
    );
  };
  
  return (
    <div className="weeklyTimeTable">
      {/* Компонент с элементами управления таблицей */}
      <WeeklyTimeTableControls
        contractName={contractName}
        showDeleted={showDeleted}
        onShowDeletedChange={handleShowDeletedChange}
        onAddWeek={handleAddWeek}
        onSave={handleSave}
        isButtonsDisabled={isSaving}
        isSaving={isSaving}
        hasUnsavedChanges={changedRows.size > 0}
        changedRowsCount={changedRows.size}
        statusMessage={statusMessage}
      />
      
      {/* Компонент с телом таблицы */}
      <WeeklyTimeTableBody
        timeTableData={timeTableData}
        filteredTimeTableData={filteredTimeTableData}
        isLoading={isTableLoading}
        dataInitialized={dataInitializedRef.current}
        contractName={contractName}
        orderedWeekDays={orderedWeekDays}
        hoursOptions={hoursOptions}
        minutesOptions={minutesOptions}
        lunchOptions={lunchOptions}
        changedRows={changedRows}
        handleTimeChange={handleTimeChange}
        handleLunchChange={handleLunchChange}
        handleContractChange={handleContractChange}
        renderAddShiftButton={renderAddShiftButton}
        renderDeleteButton={renderDeleteButton}
        isFirstRowWithNewTemplate={isFirstRowWithNewTemplate}
        onAddWeek={handleAddWeek}
      />
      
      {/* Компонент с диалогами подтверждения */}
      <WeeklyTimeTableDialogs
        isDialogOpen={dialogProps.isOpen}
        dialogTitle={dialogProps.title}
        dialogMessage={dialogProps.message}
        confirmButtonText={dialogProps.confirmButtonText}
        cancelButtonText={dialogProps.cancelButtonText}
        confirmButtonColor={dialogProps.confirmButtonColor}
        onDialogDismiss={handleDismissDialog}
        onDialogConfirm={dialogProps.onConfirm}
      />
    </div>
  );
};

export default WeeklyTimeTable;