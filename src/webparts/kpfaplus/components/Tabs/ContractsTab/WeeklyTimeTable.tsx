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
import { 
  IFormattedWeeklyTimeRow, 
  WeeklyTimeTableUtils,
  IDayHours
} from '../../../models/IWeeklyTimeTable';

// Интерфейс пропсов для компонента WeeklyTimeTable
export interface IWeeklyTimeTableProps {
  contractId?: string;
  contractName?: string;
  weeklyTimeData?: any[]; // Данные из списка WeeklyTimeTables
  isLoading?: boolean;
  dayOfStartWeek?: number; // День начала недели
}

export const WeeklyTimeTable: React.FC<IWeeklyTimeTableProps> = (props) => {
  const {
    contractId,
    contractName,
    weeklyTimeData,
    isLoading: propsIsLoading,
    dayOfStartWeek = 7 // По умолчанию начало недели - суббота (7)
  } = props;

  // Состояние для отображения удаленных записей
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Состояние для данных таблицы
  const [timeTableData, setTimeTableData] = useState<IFormattedWeeklyTimeRow[]>([]);
  
  // Состояние для загрузки
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);

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

  useEffect(() => {
    // Если есть данные из props, используем их
    if (weeklyTimeData && weeklyTimeData.length > 0) {
      console.log(`Processing ${weeklyTimeData.length} weekly time table entries from props`);
      // Преобразуем данные из списка в формат для отображения
      // Создаем временную функцию, которая вызывает formatWeeklyTimeTableData с нужным параметром
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
    } else if (contractId) {
      console.log(`No weekly time data provided for contract ${contractId}`);
      // Устанавливаем пустой массив, если нет данных
      setTimeTableData([]);
    } else {
      console.log("No contract ID or data, showing empty table");
      setTimeTableData([]);
    }
  }, [contractId, weeklyTimeData, dayOfStartWeek]); // Добавили dayOfStartWeek в зависимости
  
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

  const renderTimeCell = (hours: string, minutes: string, rowIndex: number, dayName: string): JSX.Element => {
    return (
      <div className={styles.timeCell}>
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
    return (
      <Dropdown
        options={getLunchOptions()}
        selectedKey={lunch}
        onChange={(e, option) => handleLunchChange(rowIndex, option?.key as string || '0')}
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
                <tr className={styles.weekRow}>
                  <td className={styles.nameCell}>
                    <div className={styles.rowName}>{row.name}</div>
                    <div className={styles.lunchLabel}>Lunch:</div>
                  </td>
                  {orderedWeekDays.map(day => (
                    <td key={day.key}>
                      {renderTimeCell(
                        (row[day.key] as IDayHours)?.hours || '00', 
                        (row[day.key] as IDayHours)?.minutes || '00', 
                        rowIndex, 
                        day.key
                      )}
                    </td>
                  ))}
                  <td className={styles.totalColumn}>
                    <Dropdown
                      options={[
                        { key: '1', text: '1' },
                        { key: '2', text: '2' },
                        { key: '3', text: '3' },
                      ]}
                      selectedKey={row.total}
                      styles={{ 
                        dropdown: { 
                          width: 50,
                          fontSize: '12px'
                        },
                        title: {
                          fontSize: '12px',
                          padding: '0 8px'
                        }
                      }}
                    />
                  </td>
                  <td className={styles.actionsColumn}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <IconButton
                        iconProps={{ iconName: 'Delete' }}
                        title="Delete"
                        ariaLabel="Delete"
                        onClick={() => handleDeleteShift(rowIndex)}
                        styles={{ root: { margin: 0, padding: 0 } }}
                      />
                      <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>ID: {row.id}</span>
                    </div>
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