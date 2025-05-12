// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTable.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  Toggle,
  PrimaryButton,
  IconButton,
  Dropdown,
  IDropdownOption,
  Spinner,
  SpinnerSize,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { 
  IFormattedWeeklyTimeRow, 
  WeeklyTimeTableUtils,
  IDayHours
} from '../../../models/IWeeklyTimeTable';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { WeeklyTimeTableService, IWeeklyTimeTableUpdateItem } from '../../../services/WeeklyTimeTableService';

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
  const [timeTableData, setTimeTableData] = useState<IFormattedWeeklyTimeRow[]>([]);
  
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

  // Добавляем отладочный вывод при изменении dayOfStartWeek
  useEffect(() => {
    console.log(`[WeeklyTimeTable] Using DayOfStartWeek = ${dayOfStartWeek}, week starts with: ${getStartDayName(dayOfStartWeek)}`);
  }, [dayOfStartWeek]);

  // Вспомогательная функция для получения названия дня недели
  const getStartDayName = (day: number): string => {
    switch (day) {
      case 1: return "Sunday";
      case 2: return "Monday";
      case 3: return "Tuesday";
      case 4: return "Wednesday";
      case 5: return "Thursday";
      case 6: return "Friday";
      case 7: return "Saturday";
      default: return "Unknown";
    }
  };

  // Эффект для загрузки данных при изменении входных параметров
  useEffect(() => {
    // Если есть данные из props, используем их
    if (weeklyTimeData && weeklyTimeData.length > 0) {
      console.log(`Processing ${weeklyTimeData.length} weekly time table entries from props`);
      // Преобразуем данные из списка в формат для отображения
      // Создаем временную функцию, которая вызывает formatWeeklyTimeTableData
      const getFormattedData = () => {
        // Временно изменяем оригинальный метод для поддержки dayOfStartWeek
        const origMethod = WeeklyTimeTableUtils.formatWeeklyTimeTableData;
        // @ts-ignore - Игнорируем несоответствие сигнатуры для вызова
        WeeklyTimeTableUtils.formatWeeklyTimeTableData = function(items: any[], dayStart?: number) {
          // Сохраняем dayOfStartWeek в локальной переменной
          console.log(`Custom formatWeeklyTimeTableData called with dayOfStartWeek = ${dayStart}`);
          // Вызываем оригинальный метод
          const result = origMethod.call(this, items);
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
      console.log("Sample formatted row:", formattedData.length > 0 ? formattedData[0] : "No data");
      setTimeTableData(formattedData);
      
      // Сбрасываем список измененных строк при получении новых данных
      setChangedRows(new Set());
    } else if (contractId) {
      console.log(`No weekly time data provided for contract ${contractId}`);
      // Устанавливаем пустой массив, если нет данных
      setTimeTableData([]);
    } else {
      console.log("No contract ID or data, showing empty table");
      setTimeTableData([]);
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

  // Обработчик изменения времени
  const handleTimeChange = (rowIndex: number, dayName: string, field: 'hours' | 'minutes', value: string): void => {
    const newData = [...timeTableData];
    const rowDay = dayName.toLowerCase() as keyof IFormattedWeeklyTimeRow;
    const rowId = newData[rowIndex].id;
    
    // Проверяем, что rowDay - это день недели (не id, name, lunch или total)
    if (rowDay === 'saturday' || rowDay === 'sunday' || rowDay === 'monday' || 
        rowDay === 'tuesday' || rowDay === 'wednesday' || rowDay === 'thursday' || rowDay === 'friday') {
      // Обновляем нужное поле в объекте IDayHours
      const dayData = newData[rowIndex][rowDay] as IDayHours;
      if (dayData) {
        // Безопасно обновляем поле в объекте
        newData[rowIndex] = {
          ...newData[rowIndex],
          [rowDay]: {
            ...dayData,
            [field]: value
          }
        };
        
        // Отмечаем строку как измененную
        const newChangedRows = new Set(changedRows);
        newChangedRows.add(rowId);
        setChangedRows(newChangedRows);
        
        // Сбрасываем статусное сообщение при внесении изменений
        setStatusMessage(null);
      }
    }
    
    setTimeTableData(newData);
  };

  // Обработчик изменения времени обеда
  const handleLunchChange = (rowIndex: number, value: string): void => {
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    newData[rowIndex].lunch = value;
    setTimeTableData(newData);
    
    // Отмечаем строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(rowId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при внесении изменений
    setStatusMessage(null);
  };
  
  // Обработчик изменения контракта
  const handleContractChange = (rowIndex: number, value: string): void => {
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    newData[rowIndex].total = value;
    setTimeTableData(newData);
    
    // Отмечаем строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(rowId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при внесении изменений
    setStatusMessage(null);
  };

  // Обработчик сохранения данных
const handleSave = async (): Promise<void> => {
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
              mondayStart: row.monday as IDayHours,
              tuesdayStart: row.tuesday as IDayHours,
              wednesdayStart: row.wednesday as IDayHours,
              thursdayStart: row.thursday as IDayHours,
              fridayStart: row.friday as IDayHours,
              saturdayStart: row.saturday as IDayHours,
              sundayStart: row.sunday as IDayHours,
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
            mondayStart: row.monday as IDayHours,
            tuesdayStart: row.tuesday as IDayHours,
            wednesdayStart: row.wednesday as IDayHours,
            thursdayStart: row.thursday as IDayHours,
            fridayStart: row.friday as IDayHours,
            saturdayStart: row.saturday as IDayHours,
            sundayStart: row.sunday as IDayHours,
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

  // Получение опций для выпадающего списка часов
  const getHoursOptions = (): IDropdownOption[] => {
    const options: IDropdownOption[] = [];
    for (let i = 0; i <= 23; i++) {
      const value = i.toString().padStart(2, '0');
      options.push({ key: value, text: value });
    }
    return options;
  };

  // Получение опций для выпадающего списка минут (с шагом 5)
  const getMinutesOptions = (): IDropdownOption[] => {
    const options: IDropdownOption[] = [];
    for (let i = 0; i <= 55; i += 5) {
      const value = i.toString().padStart(2, '0');
      options.push({ key: value, text: value });
    }
    return options;
  };

  // Получение опций для выпадающего списка времени обеда (с шагом 5)
  const getLunchOptions = (): IDropdownOption[] => {
    const options: IDropdownOption[] = [];
    for (let i = 0; i <= 60; i += 5) {
      options.push({ key: i.toString(), text: i.toString() });
    }
    return options;
  };

  // Функция для получения упорядоченных дней недели в зависимости от dayOfStartWeek
  const getOrderedWeekDays = (): { name: string; key: string; }[] => {
    // Определяем все дни недели (начиная с воскресенья, как в стандарте)
    const allDays = [
      { name: 'Sunday', key: 'sunday' },
      { name: 'Monday', key: 'monday' },
      { name: 'Tuesday', key: 'tuesday' },
      { name: 'Wednesday', key: 'wednesday' },
      { name: 'Thursday', key: 'thursday' },
      { name: 'Friday', key: 'friday' },
      { name: 'Saturday', key: 'saturday' }
    ];
    
    // Если dayOfStartWeek в пределах 1-7
    if (dayOfStartWeek >= 1 && dayOfStartWeek <= 7) {
      // Вычисляем смещение (dayOfStartWeek - 1, т.к. индексы массива начинаются с 0)
      const offset = dayOfStartWeek - 1;
      // Смещаем массив
      return [...allDays.slice(offset), ...allDays.slice(0, offset)];
    }
    
    // По умолчанию (или при некорректном значении) используем порядок с субботы (7)
    return [
      { name: 'Saturday', key: 'saturday' },
      { name: 'Sunday', key: 'sunday' },
      { name: 'Monday', key: 'monday' },
      { name: 'Tuesday', key: 'tuesday' },
      { name: 'Wednesday', key: 'wednesday' },
      { name: 'Thursday', key: 'thursday' },
      { name: 'Friday', key: 'friday' }
    ];
  };
  
  // Получаем упорядоченные дни недели на основе dayOfStartWeek
  const orderedWeekDays = getOrderedWeekDays();

  // Рендеринг ячейки с выбором времени
  const renderTimeCell = (hours: string, minutes: string, rowIndex: number, dayName: string): JSX.Element => {
    // Определяем, была ли эта строка изменена
    const rowId = timeTableData[rowIndex]?.id;
    const isChanged = rowId ? changedRows.has(rowId) : false;
    
    // Определяем стили для ячейки в зависимости от того, была ли она изменена
    const cellClassName = isChanged ? `${styles.timeCell} ${styles.changedCell}` : styles.timeCell;
    
    return (
      <div className={cellClassName}>
        <Dropdown
          options={getHoursOptions()}
          selectedKey={hours}
          onChange={(e, option) => handleTimeChange(rowIndex, dayName, 'hours', option?.key as string || '00')}
          styles={{ 
            dropdown: { 
              width: 50,
              fontSize: '12px'
            },
            title: {
              fontSize: '12px',
              padding: '0 8px'
            },
            dropdownItemHeader: {
              fontSize: '12px'
            },
            dropdownItem: {
              fontSize: '12px',
              minHeight: '24px'
            },
            dropdownItemSelected: {
              fontSize: '12px',
              minHeight: '24px'
            }
          }}
        />
        <span className={styles.timeSeparator}>:</span>
        <Dropdown
          options={getMinutesOptions()}
          selectedKey={minutes}
          onChange={(e, option) => handleTimeChange(rowIndex, dayName, 'minutes', option?.key as string || '00')}
          styles={{ 
            dropdown: { 
              width: 50,
              fontSize: '12px'
            },
            title: {
              fontSize: '12px',
              padding: '0 8px'
            },
            dropdownItemHeader: {
              fontSize: '12px'
            },
            dropdownItem: {
              fontSize: '12px',
              minHeight: '24px'
            },
            dropdownItemSelected: {
              fontSize: '12px',
              minHeight: '24px'
            }
          }}
        />
      </div>
    );
  };

  // Функция для отображения строки с временем обеда
  const renderLunchCell = (lunch: string, rowIndex: number): JSX.Element => {
    // Определяем, была ли эта строка изменена
    const rowId = timeTableData[rowIndex]?.id;
    const isChanged = rowId ? changedRows.has(rowId) : false;
    
    // Определяем стили для ячейки в зависимости от того, была ли она изменена
    const dropdownStyles = isChanged ? {
      dropdown: { 
        width: 50,
        fontSize: '12px',
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        border: '1px solid #ffcc00'
      },
      title: {
        fontSize: '12px',
        padding: '0 8px'
      },
      dropdownItemHeader: {
        fontSize: '12px'
      },
      dropdownItem: {
        fontSize: '12px',
        minHeight: '24px'
      },
      dropdownItemSelected: {
        fontSize: '12px',
        minHeight: '24px'
      }
    } : {
      dropdown: { 
        width: 50,
        fontSize: '12px'
      },
      title: {
        fontSize: '12px',
        padding: '0 8px'
      },
      dropdownItemHeader: {
        fontSize: '12px'
      },
      dropdownItem: {
        fontSize: '12px',
        minHeight: '24px'
      },
      dropdownItemSelected: {
        fontSize: '12px',
        minHeight: '24px'
      }
    };
    
    return (
      <Dropdown
        options={getLunchOptions()}
        selectedKey={lunch}
        onChange={(e, option) => handleLunchChange(rowIndex, option?.key as string || '0')}
        styles={dropdownStyles}
      />
    );
  };
  
  // Отображение поля контракта (с измененным цветом фона, если значение было изменено)
  const renderContractCell = (contractNumber: string, rowIndex: number): JSX.Element => {
    // Определяем, была ли эта строка изменена
    const rowId = timeTableData[rowIndex]?.id;
    const isChanged = rowId ? changedRows.has(rowId) : false;
    
    // Определяем стили для ячейки в зависимости от того, была ли она изменена
    const dropdownStyles = isChanged ? {
      dropdown: { 
        width: 50,
        fontSize: '12px',
        backgroundColor: 'rgba(255, 255, 0, 0.1)',
        border: '1px solid #ffcc00'
      },
      title: {
        fontSize: '12px',
        padding: '0 8px'
      }
    } : {
      dropdown: { 
        width: 50,
        fontSize: '12px'
      },
      title: {
        fontSize: '12px',
        padding: '0 8px'
      }
    };
    
    return (
      <Dropdown
        options={[
          { key: '1', text: '1' },
          { key: '2', text: '2' },
          { key: '3', text: '3' },
        ]}
        selectedKey={contractNumber}
        onChange={(e, option) => handleContractChange(rowIndex, option?.key as string || '1')}
        styles={dropdownStyles}
      />
    );
  };

  // Создаем новую смену (строку в таблице)
  const handleAddShift = (): void => {
    const newId = `new_${Date.now()}`; // Временный ID для новой строки
    const weekNumber = Math.ceil((timeTableData.length + 1) / 2);
    const isSecondShift = timeTableData.length % 2 === 1;
    
    const newRow: IFormattedWeeklyTimeRow = {
      id: newId,
      name: `Week ${weekNumber}${isSecondShift ? ' Shift 2' : ''}`,
      lunch: '30',
      saturday: { hours: '00', minutes: '00' },
      sunday: { hours: '00', minutes: '00' },
      monday: { hours: '00', minutes: '00' },
      tuesday: { hours: '00', minutes: '00' },
      wednesday: { hours: '00', minutes: '00' },
      thursday: { hours: '00', minutes: '00' },
      friday: { hours: '00', minutes: '00' },
      total: '1'
    };
    
    setTimeTableData([...timeTableData, newRow]);
    
    // Отмечаем новую строку как измененную
    const newChangedRows = new Set(changedRows);
    newChangedRows.add(newId);
    setChangedRows(newChangedRows);
    
    // Сбрасываем статусное сообщение при добавлении новой строки
    setStatusMessage(null);
  };

  // Удаляем смену (строку в таблице)
  const handleDeleteShift = (rowIndex: number): void => {
    const newData = [...timeTableData];
    const rowId = newData[rowIndex].id;
    
    // Удаляем строку из данных
    newData.splice(rowIndex, 1);
    setTimeTableData(newData);
    
    // Удаляем строку из списка измененных, если она была там
    if (changedRows.has(rowId)) {
      const newChangedRows = new Set(changedRows);
      newChangedRows.delete(rowId);
      setChangedRows(newChangedRows);
    }
    
    // Сбрасываем статусное сообщение при удалении строки
    setStatusMessage(null);
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
  // Если нет данных, показываем кнопку для добавления новой смены
  if (timeTableData.length === 0 && !isTableLoading) {
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
            <PrimaryButton
              text="New Week"
              onClick={handleAddShift}
              styles={{ root: { marginRight: 8 } }}
              disabled={isSaving}
            />
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
          <PrimaryButton
            text="New Week"
            onClick={handleAddShift}
            styles={{ root: { marginRight: 8 } }}
            disabled={isSaving}
          />
          <PrimaryButton
            text="Save"
            onClick={handleSave}
            iconProps={{ iconName: 'Save' }}
            disabled={changedRows.size === 0 || isSaving}
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
      
      {/* Отображение информации о количестве измененных строк - изменённая часть */}
      {changedRows.size > 0 && (
        <MessageBar
          messageBarType={MessageBarType.warning}
          isMultiline={false}
          styles={{ root: { marginTop: 10, marginBottom: 10 } }}
        >
          {`You have ${changedRows.size} unsaved ${changedRows.size === 1 ? 'change' : 'changes'}. Don't forget to click "Save" to apply them.`}
        </MessageBar>
      )}


<div className={styles.tableContainer}>
  <table className={styles.timeTable}>
    <thead>
      <tr>
        {/* Столбец для рабочих часов */}
        <th className={styles.hoursColumn}>Hours</th>
        <th className={styles.nameColumn}>Name / Lunch</th>
        {orderedWeekDays.map(day => (
          <th key={day.key}>{day.name}</th>
        ))}
        <th className={styles.totalColumn}>Contract</th>
        <th className={styles.actionsColumn}></th>
      </tr>
    </thead>
    <tbody>
      {timeTableData.map((row, rowIndex) => (
        <React.Fragment key={row.id}>
          {/* Первая строка - начало рабочего дня */}
          <tr className={styles.weekRow}>
            {/* Ячейка для рабочих часов */}
            <td className={styles.hoursCell} rowSpan={2}>
              {row.name.includes('Shift') ? '00h:00m' : '86h:10m'}
            </td>
            <td className={styles.nameCell} rowSpan={2}>
              <div className={styles.rowName}>{row.name}</div>
              <div className={styles.lunchLabel}>Lunch:</div>
            </td>
            {/* Ячейки для начала рабочего дня для каждого дня недели */}
            {orderedWeekDays.map(day => (
              <td key={`${day.key}-start`}>
                {renderTimeCell(
                  (row[day.key] as IDayHours)?.hours || '00', 
                  (row[day.key] as IDayHours)?.minutes || '00', 
                  rowIndex, 
                  day.key
                )}
              </td>
            ))}
            <td className={styles.totalColumn} rowSpan={2}>
              {renderContractCell(row.total, rowIndex)}
              <div className={styles.contractInfo}>
                {rowIndex % 2 === 0 ? '83h:40' : rowIndex % 3 === 0 ? '2h:30' : '0h:0'}
              </div>
            </td>
            <td className={styles.actionsColumn} rowSpan={2}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <IconButton
                  iconProps={{ iconName: 'Delete' }}
                  title="Delete"
                  ariaLabel="Delete"
                  onClick={() => handleDeleteShift(rowIndex)}
                  styles={{ root: { margin: 0, padding: 0 } }}
                  disabled={isSaving}
                />
                <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>ID: {row.id}</span>
              </div>
            </td>
          </tr>
          
          {/* Вторая строка - конец рабочего дня */}
          <tr className={styles.weekEndRow}>
            {/* Ячейки для окончания рабочего дня для каждого дня недели */}
            {orderedWeekDays.map(day => (
              <td key={`${day.key}-end`}>
                {renderTimeCell(
                  '17', // Временные данные для времени окончания
                  '00', // Временные данные для времени окончания
                  rowIndex, 
                  `${day.key}-end` // Уникальный ключ для времени окончания
                )}
              </td>
            ))}
          </tr>
          
          {/* Строка для обеда */}
          <tr className={styles.lunchRow}>
            <td colSpan={2} className={styles.lunchCell}>
              {renderLunchCell(row.lunch, rowIndex)}
            </td>
            <td colSpan={9}></td>
          </tr>
        </React.Fragment>
      ))}
    </tbody>
  </table>
</div>


   </div>
 );
};

export default WeeklyTimeTable;