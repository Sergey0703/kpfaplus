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
  SpinnerSize
} from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { IFormattedWeeklyTimeRow, WeeklyTimeTableUtils } from '../../../models/IWeeklyTimeTable';

// Интерфейс пропсов для компонента WeeklyTimeTable
export interface IWeeklyTimeTableProps {
  contractId?: string;
  contractName?: string;
  weeklyTimeData?: any[]; // Данные из списка WeeklyTimeTables
  isLoading?: boolean;
}

export const WeeklyTimeTable: React.FC<IWeeklyTimeTableProps> = (props) => {
  const {
    contractId,
    contractName,
    weeklyTimeData,
    isLoading: propsIsLoading
  } = props;

  // Состояние для отображения удаленных записей
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Состояние для данных таблицы
  const [timeTableData, setTimeTableData] = useState<IFormattedWeeklyTimeRow[]>([]);
  
  // Состояние для загрузки
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

  // При монтировании компонента или изменении данных загружаем/обрабатываем данные
  useEffect(() => {
    // Если есть данные из props, используем их
    if (weeklyTimeData && weeklyTimeData.length > 0) {
      console.log(`Processing ${weeklyTimeData.length} weekly time table entries from props`);
      // Преобразуем данные из списка в формат для отображения
      const formattedData = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeData);
      setTimeTableData(formattedData);
    } else if (contractId) {
      console.log(`No weekly time data provided for contract ${contractId}`);
      // Устанавливаем пустой массив, если нет данных
      setTimeTableData([]);
    } else {
      console.log("No contract ID or data, showing empty table");
      setTimeTableData([]);
    }
  }, [contractId, weeklyTimeData]);
  
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

  // Обработчик сохранения данных
  const handleSave = (): void => {
    console.log('Saving weekly time table data:', timeTableData);
    // Здесь в будущем будет логика сохранения данных в SharePoint
  };

  // Обработчик изменения времени
  const handleTimeChange = (rowIndex: number, dayName: string, field: 'hours' | 'minutes', value: string): void => {
    const newData = [...timeTableData];
    const rowDay = dayName.toLowerCase() as keyof IFormattedWeeklyTimeRow;
    
    // Проверяем, что rowDay - это день недели (не id, name, lunch или total)
    if (rowDay === 'saturday' || rowDay === 'sunday' || rowDay === 'monday' || 
        rowDay === 'tuesday' || rowDay === 'wednesday' || rowDay === 'thursday' || rowDay === 'friday') {
      // Обновляем нужное поле в объекте ITimeCell
      const dayData = newData[rowIndex][rowDay];
      if (dayData) {
        // Безопасно обновляем поле в объекте
        newData[rowIndex] = {
          ...newData[rowIndex],
          [rowDay]: {
            ...dayData,
            [field]: value
          }
        };
      }
    }
    
    setTimeTableData(newData);
  };

  // Обработчик изменения времени обеда
  const handleLunchChange = (rowIndex: number, value: string): void => {
    const newData = [...timeTableData];
    newData[rowIndex].lunch = value;
    setTimeTableData(newData);
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

  // Получение опций для выпадающего списка минут
  const getMinutesOptions = (): IDropdownOption[] => {
    const options: IDropdownOption[] = [];
    for (let i = 0; i <= 59; i++) {
      const value = i.toString().padStart(2, '0');
      options.push({ key: value, text: value });
    }
    return options;
  };

  // Получение опций для выпадающего списка времени обеда
  const getLunchOptions = (): IDropdownOption[] => {
    return [
      { key: '0', text: '0' },
      { key: '15', text: '15' },
      { key: '30', text: '30' },
      { key: '45', text: '45' },
      { key: '60', text: '60' },
    ];
  };

  // Функция для отображения ячейки с часами и минутами
  const renderTimeCell = (hours: string, minutes: string, rowIndex: number, dayName: string): JSX.Element => {
    return (
      <div className={styles.timeCell}>
        <Dropdown
          options={getHoursOptions()}
          selectedKey={hours}
          onChange={(e, option) => handleTimeChange(rowIndex, dayName, 'hours', option?.key as string || '00')}
          styles={{ dropdown: { width: 60 } }}
        />
        <span className={styles.timeSeparator}>:</span>
        <Dropdown
          options={getMinutesOptions()}
          selectedKey={minutes}
          onChange={(e, option) => handleTimeChange(rowIndex, dayName, 'minutes', option?.key as string || '00')}
          styles={{ dropdown: { width: 60 } }}
        />
      </div>
    );
  };

  // Функция для отображения строки с временем обеда
  const renderLunchCell = (lunch: string, rowIndex: number): JSX.Element => {
    return (
      <Dropdown
        options={getLunchOptions()}
        selectedKey={lunch}
        onChange={(e, option) => handleLunchChange(rowIndex, option?.key as string || '0')}
        styles={{ dropdown: { width: 60 } }}
      />
    );
  };

  // Создаем новую смену (строку в таблице)
  const handleAddShift = (): void => {
    const newId = (timeTableData.length + 1).toString();
    const newRow: IFormattedWeeklyTimeRow = {
      id: newId,
      name: `Week ${Math.ceil(timeTableData.length / 2) + 1}${timeTableData.length % 2 === 1 ? ' Shift 2' : ''}`,
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
  };

  // Удаляем смену (строку в таблице)
  const handleDeleteShift = (rowIndex: number): void => {
    const newData = [...timeTableData];
    newData.splice(rowIndex, 1);
    setTimeTableData(newData);
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
            />
          </div>
        </div>
        
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
          />
          <PrimaryButton
            text="Save"
            onClick={handleSave}
            iconProps={{ iconName: 'Save' }}
          />
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.timeTable}>
          <thead>
            <tr>
              <th className={styles.nameColumn}>Name / Lunch</th>
              <th>Saturday</th>
              <th>Sunday</th>
              <th>Monday</th>
              <th>Tuesday</th>
              <th>Wednesday</th>
              <th>Thursday</th>
              <th>Friday</th>
              <th className={styles.totalColumn}>Contract</th>
              <th className={styles.actionsColumn}></th>
            </tr>
          </thead>
          <tbody>
            {timeTableData.map((row, rowIndex) => (
              <React.Fragment key={row.id}>
                <tr className={styles.weekRow}>
                  <td className={styles.nameCell}>
                    <div className={styles.rowName}>{row.name}</div>
                    <div className={styles.lunchLabel}>Lunch:</div>
                  </td>
                  <td>{renderTimeCell(row.saturday.hours, row.saturday.minutes, rowIndex, 'saturday')}</td>
                  <td>{renderTimeCell(row.sunday.hours, row.sunday.minutes, rowIndex, 'sunday')}</td>
                  <td>{renderTimeCell(row.monday.hours, row.monday.minutes, rowIndex, 'monday')}</td>
                  <td>{renderTimeCell(row.tuesday.hours, row.tuesday.minutes, rowIndex, 'tuesday')}</td>
                  <td>{renderTimeCell(row.wednesday.hours, row.wednesday.minutes, rowIndex, 'wednesday')}</td>
                  <td>{renderTimeCell(row.thursday.hours, row.thursday.minutes, rowIndex, 'thursday')}</td>
                  <td>{renderTimeCell(row.friday.hours, row.friday.minutes, rowIndex, 'friday')}</td>
                  <td className={styles.totalColumn}>
                    <Dropdown
                      options={[
                        { key: '1', text: '1' },
                        { key: '2', text: '2' },
                        { key: '3', text: '3' },
                      ]}
                      selectedKey={row.total}
                      styles={{ dropdown: { width: 60 } }}
                    />
                  </td>
                  <td className={styles.actionsColumn}>
                    <IconButton
                      iconProps={{ iconName: 'Delete' }}
                      title="Delete"
                      ariaLabel="Delete"
                      onClick={() => handleDeleteShift(rowIndex)}
                    />
                  </td>
                </tr>
                <tr className={styles.lunchRow}>
                  <td className={styles.lunchCell}>
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