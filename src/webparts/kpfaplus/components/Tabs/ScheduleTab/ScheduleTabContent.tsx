// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { 
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IDropdownOption,
  DefaultButton
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract } from '../../../models/IContract';
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { IStaffRecord } from '../../../services/StaffRecordsService';
// Корректный путь к файлу стилей
import styles from './ScheduleTab.module.scss';

// Корректные пути к компонентам
import { FilterControls } from './components/FilterControls';
import { DayInfo } from './components/DayInfo';
import ScheduleTable, { IScheduleItem, IScheduleOptions } from './components/ScheduleTable';

// Интерфейс для типизации сервисов
interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

// Интерфейс для TypeOfLeaveService, используется в пропсах
interface ITypeOfLeaveService {
  getAllTypesOfLeave: (forceRefresh?: boolean) => Promise<ITypeOfLeave[]>;
  getTypeOfLeaveById: (id: string | number) => Promise<ITypeOfLeave | undefined>;
}

// Интерфейс для передачи необходимых свойств в UI компоненты
export interface IScheduleTabContentProps {
  selectedStaff: ITabProps['selectedStaff'];
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  error?: string;
  holidays: IHoliday[];
  isLoadingHolidays: boolean;
  leaves: ILeaveDay[];
  isLoadingLeaves: boolean;
  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  holidaysService?: IHolidaysService;
  daysOfLeavesService?: IDaysOfLeavesService;
  typeOfLeaveService?: ITypeOfLeaveService; // Оставляем в интерфейсе, так как передается из ScheduleTab.tsx
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onErrorDismiss: () => void;
  staffRecords?: IStaffRecord[];
  // Свойства для обновления данных
  onUpdateStaffRecord?: (recordId: string, updateData: Partial<IStaffRecord>) => Promise<boolean>;
  onCreateStaffRecord?: (createData: Partial<IStaffRecord>) => Promise<string | undefined>;
  onDeleteStaffRecord?: (recordId: string) => Promise<boolean>;
  onRestoreStaffRecord?: (recordId: string) => Promise<boolean>; // Новый проп для восстановления записей
  onRefreshData?: () => void;
}

/**
 * Основной компонент содержимого вкладки Schedule
 */
export const ScheduleTabContent: React.FC<IScheduleTabContentProps> = (props) => {
  const {
    selectedStaff,
    selectedDate,
    contracts,
    selectedContractId,
    isLoading,
    error,
    holidays,
    isLoadingHolidays,
    leaves,
    isLoadingLeaves,
    typesOfLeave,
    isLoadingTypesOfLeave,
    holidaysService,
    daysOfLeavesService,
    onDateChange,
    onContractChange,
    onErrorDismiss,
    staffRecords,
    onUpdateStaffRecord,
    onCreateStaffRecord,
    onDeleteStaffRecord,
    onRestoreStaffRecord,
    onRefreshData
  } = props;
  
  // Находим выбранный контракт
  const selectedContract = contracts.find(c => c.id === selectedContractId);
  
  // Состояние для отображения удаленных записей
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Локальное состояние для отслеживания изменений в записях расписания
  const [modifiedRecords, setModifiedRecords] = useState<Record<string, IScheduleItem>>({});
  
  // Состояние для отслеживания процесса сохранения
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Сохраняем состояние для сообщений об операциях
  const [operationMessage, setOperationMessage] = useState<{
    text: string;
    type: MessageBarType;
  } | null>(null);

  // Эффект для очистки модифицированных записей при изменении выбранного контракта или даты
  useEffect(() => {
    setModifiedRecords({});
  }, [selectedDate, selectedContractId]);
  
  // Эффект для отслеживания изменений в modifiedRecords и установки соответствующего сообщения
  // Эффект для отслеживания изменений только в modifiedRecords
useEffect(() => {
  // Если есть модифицированные записи, устанавливаем сообщение о необходимости сохранения
  if (Object.keys(modifiedRecords).length > 0) {
    setOperationMessage({
      text: 'Changes detected. Click "Save Changes" when finished editing.',
      type: MessageBarType.warning
    });
  }
}, [modifiedRecords]); // Только modifiedRecords в зависимостях
  // Логирование информации для отладки
  useEffect(() => {
    // Создаем группу в консоли для более организованного вывода
    console.group("Schedule Tab Data");
    
    // Логирование базовой информации о выбранной дате и месяце
    console.log(`Selected date: ${selectedDate.toLocaleDateString()}`);
    console.log(`Month: ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    
    // Логирование информации о праздниках
    console.log(`\n--- Holidays ---`);
    console.log(`${holidays.length > 0 ? holidays.length : 'No'} holidays loaded for month ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    
    // Логирование информации об отпусках
    console.log(`\n--- Leaves ---`);
    console.log(`${leaves.length > 0 ? leaves.length : 'No'} leaves found for month ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    
    // Логирование информации о данных расписания
    console.log(`\n--- Staff Records ---`);
    console.log(`${staffRecords && staffRecords.length > 0 ? staffRecords.length : 'No'} staff records loaded for month ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    
    // Логирование информации о модифицированных записях
    console.log(`\n--- Modified Records ---`);
    const modifiedCount = Object.keys(modifiedRecords).length;
    console.log(`${modifiedCount > 0 ? modifiedCount : 'No'} modified records`);
    
    // Завершаем группу консоли
    console.groupEnd();
  }, [selectedDate, holidays, leaves, typesOfLeave, contracts, selectedContract, staffRecords, modifiedRecords]);
  
  /**
   * Функция для сохранения всех измененных записей
   */
  const saveAllChanges = async (): Promise<void> => {
    if (!onUpdateStaffRecord) {
      console.error('Update staff record function is not provided');
      setOperationMessage({
        text: 'Unable to save changes: Update function not available',
        type: MessageBarType.error
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      const modifiedIds = Object.keys(modifiedRecords);
      
      if (modifiedIds.length === 0) {
        setOperationMessage({
          text: 'No changes to save',
          type: MessageBarType.info
        });
        setIsSaving(false);
        return;
      }
      
      console.log(`Saving ${modifiedIds.length} modified records...`);
      
      let successCount = 0;
      const failedRecords: string[] = [];
      
      // Process records in batches to avoid overloading the server
      const batchSize = 5; // Process 5 records at a time
      for (let i = 0; i < modifiedIds.length; i += batchSize) {
        const currentBatch = modifiedIds.slice(i, i + batchSize);
        
        // Create an array of promises for the current batch
        const batchPromises = currentBatch.map(async (recordId) => {
          const scheduleItem = modifiedRecords[recordId];
          
          console.log(`[DEBUG] Saving record ID ${recordId}:`, scheduleItem);
          
          // Format data for update
          const updateData: Partial<IStaffRecord> = {
            // Dates need to be proper Date objects
            ShiftDate1: createTimeFromScheduleItem(scheduleItem.date, scheduleItem.startHour, scheduleItem.startMinute),
            ShiftDate2: createTimeFromScheduleItem(scheduleItem.date, scheduleItem.finishHour, scheduleItem.finishMinute),
            // Numeric values
            TimeForLunch: parseInt(scheduleItem.lunchTime, 10) || 0,
            Contract: parseInt(scheduleItem.contractNumber || '1', 10),
            // TypeOfLeave could be a string ID or empty
            TypeOfLeaveID: scheduleItem.typeOfLeave || '',
            // Work time as calculated
            WorkTime: scheduleItem.workingHours
          };
          
          console.log(`[DEBUG] Formatted update data for ID ${recordId}:`, updateData);
          
          try {
            const success = await onUpdateStaffRecord(recordId, updateData);
            
            if (success) {
              successCount++;
              return { recordId, success: true };
            } else {
              failedRecords.push(recordId);
              return { recordId, success: false, error: 'Update returned false' };
            }
          } catch (error) {
            console.error(`Error saving record ${recordId}:`, error);
            failedRecords.push(recordId);
            return { recordId, success: false, error };
          }
        });
        
        // Wait for all promises in this batch to complete before moving to the next batch
        const batchResults = await Promise.all(batchPromises);
        console.log(`[DEBUG] Batch results:`, batchResults);
        
        // Add a small delay between batches to not overwhelm the server
        if (i + batchSize < modifiedIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Show appropriate message based on results
      if (successCount === modifiedIds.length) {
        setOperationMessage({
          text: `All ${successCount} changes saved successfully`,
          type: MessageBarType.success
        });
        // Clear all modified records since they've been saved
        setModifiedRecords({});
      } else if (successCount > 0) {
        setOperationMessage({
          text: `Saved ${successCount} of ${modifiedIds.length} changes. Failed to save ${failedRecords.length} records.`,
          type: MessageBarType.warning
        });
        // Clear only the successfully saved records
        const newModifiedRecords = { ...modifiedRecords };
        modifiedIds.forEach((id) => {
          if (!failedRecords.includes(id)) {
            delete newModifiedRecords[id];
          }
        });
        setModifiedRecords(newModifiedRecords);
      } else {
        setOperationMessage({
          text: `Failed to save any changes. Please try again.`,
          type: MessageBarType.error
        });
      }
      
      // If we have a parent refresh function, call it to refresh the data
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (error) {
      console.error('Error during save operation:', error);
      setOperationMessage({
        text: `Error saving changes: ${error instanceof Error ? error.message : String(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Вспомогательная функция для создания Date из часов и минут
  const createTimeFromScheduleItem = (baseDate: Date, hourStr: string, minuteStr: string): Date => {
    const hour = parseInt(hourStr, 10) || 0;
    const minute = parseInt(minuteStr, 10) || 0;
    
    // Create a new Date object to avoid modifying the original
    const result = new Date(baseDate.getTime());
    result.setHours(hour, minute, 0, 0);
    return result;
  };
  
// Преобразование данных расписания в формат для ScheduleTable
const convertStaffRecordsToScheduleItems = useCallback((records: IStaffRecord[] | undefined): IScheduleItem[] => {
  if (!records || records.length === 0) {
    return [];
  }

  return records.map(record => {
    // Форматирование дня недели
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][record.Date.getDay()];
    
    // Получение часов и минут из дат
    const startHour = record.ShiftDate1 ? record.ShiftDate1.getHours().toString().padStart(2, '0') : '00';
    const startMinute = record.ShiftDate1 ? record.ShiftDate1.getMinutes().toString().padStart(2, '0') : '00';
    const finishHour = record.ShiftDate2 ? record.ShiftDate2.getHours().toString().padStart(2, '0') : '00';
    const finishMinute = record.ShiftDate2 ? record.ShiftDate2.getMinutes().toString().padStart(2, '0') : '00';
    
    // Извлекаем значение TypeOfLeaveID, проверяя оба возможных формата данных
    let typeOfLeaveValue = '';
    
    // Проверяем, есть ли объект TypeOfLeave с Id внутри
    if (record.TypeOfLeave && record.TypeOfLeave.Id) {
      typeOfLeaveValue = String(record.TypeOfLeave.Id);
      console.log(`[DEBUG] Record ${record.ID}: Using TypeOfLeave.Id: ${typeOfLeaveValue}`);
    } 
    // Если нет объекта TypeOfLeave, проверяем прямое поле TypeOfLeaveID
    else if (record.TypeOfLeaveID) {
      typeOfLeaveValue = String(record.TypeOfLeaveID);
      console.log(`[DEBUG] Record ${record.ID}: Using TypeOfLeaveID directly: ${typeOfLeaveValue}`);
    } else {
      console.log(`[DEBUG] Record ${record.ID}: No TypeOfLeave found, using empty string`);
    }
    
    // Формирование объекта IScheduleItem
    const scheduleItem = {
      id: record.ID,
      date: record.Date,
      dayOfWeek,
      workingHours: record.WorkTime || '0.00',
      startHour,
      startMinute,
      finishHour,
      finishMinute,
      lunchTime: record.TimeForLunch.toString(),
      typeOfLeave: typeOfLeaveValue, // Используем извлеченное значение типа отпуска
      shift: 1, // По умолчанию 1
      contract: record.WeeklyTimeTableTitle || selectedContract?.template || '',
      contractId: record.WeeklyTimeTableID || selectedContract?.id || '',
      contractNumber: record.Contract.toString(),
      deleted: record.Deleted === 1 // Добавляем флаг deleted
    };
    
    return scheduleItem;
  });
}, [selectedContract]);

  
  // Получаем список элементов для таблицы, включая локальные изменения
  const getScheduleItemsWithModifications = useCallback((): IScheduleItem[] => {
    const baseItems = convertStaffRecordsToScheduleItems(staffRecords);
    
    // Применяем локальные изменения
    return baseItems.map(item => {
      if (modifiedRecords[item.id]) {
        return {
          ...item,
          ...modifiedRecords[item.id]
        };
      }
      return item;
    });
  }, [staffRecords, modifiedRecords, convertStaffRecordsToScheduleItems]);
  
  // Обработчик для кнопки Fill
  const handleFillButtonClick = async (): Promise<void> => {
    console.log('Fill button clicked');
    // Здесь будет логика заполнения данных по расписанию
    // Например, на основе шаблонного расписания
    
    setOperationMessage({
      text: 'Auto-filling schedule based on templates is not implemented yet',
      type: MessageBarType.warning
    });
  };
  
  // Создаем опции для выпадающих списков в таблице
  const scheduleOptions: IScheduleOptions = {
    hours: Array.from({ length: 24 }, (_, i) => ({ 
      key: i.toString().padStart(2, '0'), 
      text: i.toString().padStart(2, '0') 
    })),
    minutes: ['00', '15', '30', '45'].map(m => ({ key: m, text: m })),
    lunchTimes: ['0', '15', '30', '45', '60'].map(l => ({ key: l, text: l })),
    leaveTypes: [
      { key: '', text: 'None' },
      ...typesOfLeave.map(t => ({ key: t.id, text: t.title }))
    ],
    contractNumbers: [
      { key: '1', text: '1' },
      { key: '2', text: '2' },
      { key: '3', text: '3' }
    ]
  };
  
  // Добавляем логи для диагностики проблемы с типами отпусков
  console.log('[DEBUG] Created leaveTypes options:');
  scheduleOptions.leaveTypes.forEach(option => {
    console.log(`  - Option: key=${option.key} (type: ${typeof option.key}), text=${option.text}`);
  });
  
  // Обработчики для таблицы расписания
  const handleToggleShowDeleted = (checked: boolean): void => {
    setShowDeleted(checked);
  };
  
  // Обработчик изменения элемента расписания
  const handleItemChange = (item: IScheduleItem, field: string, value: string | number): void => {
    console.log(`Changed item ${item.id}, field: ${field}, value: ${value}`);
    
    // Добавляем запись в список модифицированных
    setModifiedRecords(prev => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        ...item,
        [field]: value
      }
    }));
    
    // Не устанавливаем здесь operationMessage, это делается в useEffect
  };
  
  // Обработчик добавления новой смены
  const handleAddShift = async (date: Date): Promise<void> => {
    if (!onCreateStaffRecord || !selectedStaff || !selectedContractId) {
      console.error('Cannot add shift: Missing required properties');
      setOperationMessage({
        text: 'Unable to add new shift: Missing required information',
        type: MessageBarType.error
      });
      return;
    }
    
    console.log(`Adding shift for date: ${date.toLocaleDateString()}`);
    
    setIsSaving(true);
    
    try {
      // Create a new Date object to avoid modifying the original
      const newDate = new Date(date.getTime());
      
      // Создаем начальные данные для новой записи
      const createData: Partial<IStaffRecord> = {
        Date: newDate,
        ShiftDate1: new Date(new Date(newDate).setHours(9, 0, 0, 0)), // По умолчанию 9:00
        ShiftDate2: new Date(new Date(newDate).setHours(17, 0, 0, 0)), // По умолчанию 17:00
        TimeForLunch: 60, // По умолчанию 1 час
        WeeklyTimeTableID: selectedContractId,
        Contract: 1
      };
      
      // Вызываем метод создания новой записи
      const newRecordId = await onCreateStaffRecord(createData);
      
      if (newRecordId) {
        setOperationMessage({
          text: `New shift added successfully for ${date.toLocaleDateString()}`,
          type: MessageBarType.success
        });
        
        // Обновляем данные, чтобы отобразить новую запись
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        setOperationMessage({
          text: 'Failed to add new shift. Please try again.',
          type: MessageBarType.error
        });
      }
    } catch (error) {
      console.error('Error adding new shift:', error);
      setOperationMessage({
        text: `Error adding new shift: ${error instanceof Error ? error.message : String(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Обработчик удаления элемента
  const handleDeleteItem = async (id: string): Promise<void> => {
    if (!onDeleteStaffRecord) {
      console.error('Delete staff record function is not provided');
      setOperationMessage({
        text: 'Unable to delete record: Delete function not available',
        type: MessageBarType.error
      });
      return;
    }
    
    console.log(`Deleting item with ID: ${id}`);
    
    setIsSaving(true);
    
    try {
      const success = await onDeleteStaffRecord(id);
      
      if (success) {
        setOperationMessage({
          text: 'Record deleted successfully',
          type: MessageBarType.success
        });
        
        // Если запись была в списке модифицированных, удаляем её оттуда
        if (modifiedRecords[id]) {
          const newModifiedRecords = { ...modifiedRecords };
          delete newModifiedRecords[id];
          setModifiedRecords(newModifiedRecords);
        }
        
        // Обновляем данные
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        setOperationMessage({
          text: 'Failed to delete record. Please try again.',
          type: MessageBarType.error
        });
      }
    } catch (error) {
      console.error('Error deleting record:', error);
      setOperationMessage({
        text: `Error deleting record: ${error instanceof Error ? error.message : String(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Добавляем обработчик восстановления записи
  const handleRestoreItem = async (id: string): Promise<void> => {
    if (!onRestoreStaffRecord) {
      console.error('Restore staff record function is not provided');
      setOperationMessage({
        text: 'Unable to restore record: Restore function not available',
        type: MessageBarType.error
      });
      return;
    }
    
    console.log(`Restoring item with ID: ${id}`);
    
    setIsSaving(true);
    
    try {
      const success = await onRestoreStaffRecord(id);
      
      if (success) {
        setOperationMessage({
          text: 'Record restored successfully',
          type: MessageBarType.success
        });
        
        // Если запись была в списке модифицированных, удаляем её оттуда
        if (modifiedRecords[id]) {
          const newModifiedRecords = { ...modifiedRecords };
          delete newModifiedRecords[id];
          setModifiedRecords(newModifiedRecords);
        }
        
        // Обновляем данные
        if (onRefreshData) {
          onRefreshData();
        }
      } else {
        setOperationMessage({
          text: 'Failed to restore record. Please try again.',
          type: MessageBarType.error
        });
      }
    } catch (error) {
      console.error('Error restoring record:', error);
      setOperationMessage({
        text: `Error restoring record: ${error instanceof Error ? error.message : String(error)}`,
        type: MessageBarType.error
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className={styles.scheduleTab}>
      <div className={styles.header}>
        <h2>Schedule for {selectedStaff?.name}</h2>
      </div>
      
      {/* Отображаем сообщение об ошибке, если есть */}
      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={onErrorDismiss}
          dismissButtonAriaLabel="Close"
        >
          {error}
        </MessageBar>
      )}
      
      {/* Отображаем операционное сообщение (включая сообщение о необходимости сохранения), если есть */}
      {operationMessage && (
        <MessageBar
          messageBarType={operationMessage.type}
          isMultiline={false}
          onDismiss={() => setOperationMessage(null)}
          dismissButtonAriaLabel="Close"
        >
          {operationMessage.text}
        </MessageBar>
      )}
      
      {/* Фильтры выбора даты и контракта с кнопкой Fill */}
      <FilterControls
        selectedDate={selectedDate}
        contracts={contracts}
        selectedContractId={selectedContractId}
        isLoading={isLoading}
        onDateChange={onDateChange}
        onContractChange={onContractChange}
        onFillButtonClick={handleFillButtonClick}
      />
      
      {/* Показываем спиннер при загрузке */}
      {isLoading || isSaving ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <Spinner size={SpinnerSize.large} label={isSaving ? "Saving changes..." : "Loading schedule data..."} />
        </div>
      ) : (
        <>
          {selectedContract ? (
            <div style={{ 
                border: 'none',
                padding: '0px',    
                borderRadius: '4px',
                minHeight: '300px',
                backgroundColor: 'white'
            }}>
              {/* Проверяем статусы - является ли выбранная дата праздником или отпуском */}
              <DayInfo
                selectedDate={selectedDate}
                holidays={holidays}
                leaves={leaves}
                typesOfLeave={typesOfLeave}
                holidaysService={holidaysService}
                daysOfLeavesService={daysOfLeavesService}
              />
              
              {/* Показываем индикаторы загрузки, если они загружаются */}
              {(isLoadingHolidays || isLoadingLeaves || isLoadingTypesOfLeave) ? (
                <div style={{ padding: '10px', textAlign: 'center' }}>
                  {isLoadingHolidays && <Spinner size={SpinnerSize.small} label="Loading holidays data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingLeaves && <Spinner size={SpinnerSize.small} label="Loading leaves data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingTypesOfLeave && <Spinner size={SpinnerSize.small} label="Loading types of leave..." />}
                </div>
              ) : (
                <div style={{ padding: '10px' }}>
                  {/* Таблица расписания - используем обновленный компонент и передаем данные с учетом модификаций */}
                  <ScheduleTable
                    items={getScheduleItemsWithModifications()}
                    options={scheduleOptions}
                    selectedDate={selectedDate}
                    selectedContract={{ id: selectedContract.id, name: selectedContract.template }}
                    isLoading={false}
                    showDeleted={showDeleted}
                    onToggleShowDeleted={handleToggleShowDeleted}
                    onItemChange={handleItemChange}
                    onAddShift={handleAddShift}
                    onDeleteItem={handleDeleteItem}
                    onRestoreItem={handleRestoreItem}
                    saveChangesButton={
                      Object.keys(modifiedRecords).length > 0 ? (
                        <DefaultButton
                          text={`Save Changes (${Object.keys(modifiedRecords).length})`}
                          onClick={saveAllChanges}
                          disabled={isSaving}
                          styles={{
                            root: {
                              backgroundColor: '#0078d4',
                              color: 'white'
                            },
                            rootHovered: {
                              backgroundColor: '#106ebe',
                              color: 'white'
                            }
                          }}
                        />
                      ) : undefined
                    }
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              minHeight: '200px', 
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
              padding: '20px'
            }}>
              {contracts.length > 0 ? (
                <p>Please select a contract to view the schedule</p>
              ) : (
                <p>No active contracts available for this staff member</p>
             )}
           </div>
         )}
       </>
     )}
   </div>
 );
};

export default ScheduleTabContent;