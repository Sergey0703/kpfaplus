// src/webparts/kpfaplus/components/Tabs/SRSTab/components/SRSTable.tsx

import * as React from 'react';
import { useState, useCallback, useEffect } from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import { ISRSTableProps, ISRSRecord } from '../utils/SRSTabInterfaces';
import { SRSTableRow } from './SRSTableRow';
import { 
  calculateSRSWorkTime,
  checkSRSStartEndTimeSame
} from '../utils/SRSTimeCalculationUtils';

export const SRSTable: React.FC<ISRSTableProps> = (props) => {
  const {
    items,
    options,
    isLoading,
    onItemChange,
    onLunchTimeChange,
    onContractNumberChange
  } = props;

  // *** КЛЮЧЕВОЕ ДОБАВЛЕНИЕ: State для вычисленного времени работы ***
  const [calculatedWorkTimes, setCalculatedWorkTimes] = useState<Record<string, string>>({});

  console.log('[SRSTable] Rendering with items count:', items.length);

  // *** ДОБАВЛЕНО: Инициализация вычисленного времени при загрузке элементов ***
  useEffect(() => {
    console.log('[SRSTable] Effect: items array changed. Calculating work times for all items.');
    const initialWorkTimes: Record<string, string> = {};
    items.forEach(item => {
      // Вычисляем время сразу при загрузке, а не берем из item.hours
      const calculatedTime = calculateSRSWorkTime(item);
      initialWorkTimes[item.id] = calculatedTime;
      console.log(`[SRSTable] Calculated time for item ${item.id}: ${calculatedTime} (was: ${item.hours})`);
    });
    setCalculatedWorkTimes(initialWorkTimes);
  }, [items]);

  // *** ДОБАВЛЕНО: Функция для получения отображаемого времени работы ***
  const getDisplayWorkTime = useCallback((item: ISRSRecord): string => {
    if (calculatedWorkTimes[item.id]) {
      return calculatedWorkTimes[item.id];
    }
    return item.hours;
  }, [calculatedWorkTimes]);

  // *** ИСПРАВЛЕНО: Обработчик изменения времени с проверкой на relief ***
  const handleTimeChange = useCallback((item: ISRSRecord, field: string, value: string | { hours: string; minutes: string }): void => {
    if (item.deleted) { return; }
    
    console.log(`[SRSTable] *** TIME CHANGE EVENT ***`);
    console.log(`[SRSTable] Item ID: ${item.id}`);
    console.log(`[SRSTable] Field: ${field}`);
    console.log(`[SRSTable] New value:`, value);
    
    // *** ИСПРАВЛЕНО: НЕ пересчитываем время для relief ***
    if (field === 'relief') {
      console.log(`[SRSTable] Relief change detected - no time recalculation needed`);
      onItemChange(item, field, value);
      return; // Выходим без пересчета времени
    }
    
    // *** ИСПРАВЛЕНО: НЕ пересчитываем время для других нетемпоральных полей ***
    const temporalFields = ['startWork', 'finishWork', 'lunch'];
    if (!temporalFields.includes(field)) {
      console.log(`[SRSTable] Non-temporal field ${field} changed - no time recalculation needed`);
      onItemChange(item, field, value);
      return; // Выходим без пересчета времени для других полей
    }
    
    // Создаем обновленный элемент только для временных полей
    let updatedItem = { ...item };
    if (field === 'startWork' && typeof value === 'object') {
      updatedItem.startWork = value;
    } else if (field === 'finishWork' && typeof value === 'object') {
      updatedItem.finishWork = value;
    } else if (field === 'lunch') {
      updatedItem.lunch = value as string;
    }
    
    console.log(`[SRSTable] Updated item before calculation:`, {
      startWork: updatedItem.startWork,
      finishWork: updatedItem.finishWork,
      lunch: updatedItem.lunch,
      relief: updatedItem.relief // Relief не должен влиять на расчет
    });
    
    // Пересчитываем время работы только для временных полей
    const workTime = calculateSRSWorkTime(updatedItem);
    console.log(`[SRSTable] *** CALCULATED NEW WORK TIME: ${workTime} ***`);
    
    // Обновляем локальное состояние вычисленного времени
    setCalculatedWorkTimes(prev => {
      const newTimes = {
        ...prev,
        [item.id]: workTime
      };
      console.log(`[SRSTable] Updated calculatedWorkTimes for item ${item.id}:`, {
        oldTime: prev[item.id],
        newTime: workTime
      });
      return newTimes;
    });
    
    // Вызываем родительский обработчик
    console.log(`[SRSTable] Calling parent onItemChange for field: ${field}`);
    onItemChange(updatedItem, field, value);
    
    // Также обновляем hours в родительском состоянии
    console.log(`[SRSTable] Calling parent onItemChange for workingHours: ${workTime}`);
    onItemChange(updatedItem, 'workingHours', workTime);
    
    console.log(`[SRSTable] *** TIME CHANGE COMPLETE ***`);
  }, [calculatedWorkTimes, onItemChange]);

  // *** ИСПРАВЛЕНО: Обработчик изменения времени обеда ***
  const handleLunchTimeChange = useCallback((item: ISRSRecord, value: string): void => {
    if (item.deleted) { return; }
    
    console.log(`[SRSTable] handleLunchTimeChange called for item ${item.id}, value: ${value}`);
    
    const updatedItem = { ...item, lunch: value };
    const workTime = calculateSRSWorkTime(updatedItem);
    
    console.log(`[SRSTable] Recalculated work time after lunch change for item ${item.id}: ${workTime}`);
    
    // Обновляем локальное состояние вычисленного времени
    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));
    
    // Вызываем родительские обработчики
    onLunchTimeChange(updatedItem, value);
    onItemChange(updatedItem, 'workingHours', workTime);
  }, [calculatedWorkTimes, onItemChange, onLunchTimeChange]);

  // Helper function to check if this is the first row with a new date
  const isFirstRowWithNewDate = (items: typeof props.items, index: number): boolean => {
    if (index === 0) return true; // First row always starts a new date
    
    // Compare dates of current and previous row
    const currentDate = new Date(items[index].date);
    const previousDate = new Date(items[index - 1].date);
    
    // Compare only year, month and day
    return (
      currentDate.getFullYear() !== previousDate.getFullYear() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getDate() !== previousDate.getDate()
    );
  };

  // Helper function to determine row position within date group
  const getRowPositionInDate = (items: typeof props.items, index: number): number => {
    if (index === 0) return 0; // First row always has position 0
    
    const currentDate = new Date(items[index].date);
    let position = 0;
    
    // Count how many rows with the same date were before current one (including deleted)
    for (let i = 0; i < index; i++) {
      const itemDate = new Date(items[i].date);
      
      // If dates match, increase position
      if (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      ) {
        position++;
      }
    }
    
    return position;
  };

  // Helper function to calculate total hours for date (only for non-deleted rows)
  const calculateTotalHoursForDate = (items: typeof props.items, index: number): string => {
    const currentDate = new Date(items[index].date);
    
    // Find all rows with the same date
    const sameDateRows = items.filter(item => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      );
    });
    
    // Calculate total time, adding work time only from non-deleted shifts
    let totalHours = 0;
    let totalMinutes = 0;
    
    sameDateRows.forEach(item => {
      // Skip deleted records
      if (item.deleted === true) {
        return;
      }
      
      // *** ИСПРАВЛЕНО: Используем вычисленное время, а не item.hours из API ***
      const workTime = getDisplayWorkTime(item);
      const [hoursStr, minutesStr] = workTime.split('.');
      
      const hours = parseInt(hoursStr, 10) || 0;
      const minutes = parseInt(minutesStr, 10) || 0;
      
      totalHours += hours;
      totalMinutes += minutes;
    });
    
    // Convert excess minutes to hours
    if (totalMinutes >= 60) {
      totalHours += Math.floor(totalMinutes / 60);
      totalMinutes = totalMinutes % 60;
    }
    
    return `Total: ${totalHours}h:${totalMinutes.toString().padStart(2, '0')}m`;
  };

  // Helper function to count total rows (including deleted) in date group
  const countTotalRowsInDate = (items: typeof props.items, index: number): number => {
    const currentDate = new Date(items[index].date);
    
    // Count all rows with the same date
    return items.filter(item => {
      const itemDate = new Date(item.date);
      
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      );
    }).length;
  };

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px'
      }}>
        <Spinner size={SpinnerSize.large} label="Loading SRS data..." />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table style={{ 
        borderSpacing: '0', 
        borderCollapse: 'collapse', 
        width: '100%', 
        tableLayout: 'fixed',
        border: '1px solid #edebe9'
      }}>
        <colgroup>
          <col style={{ width: '100px' }} /> {/* Date */}
          <col style={{ width: '60px' }} />  {/* Hrs */}
          <col style={{ width: '60px' }} />  {/* Relief? */}
          <col style={{ width: '150px' }} /> {/* Start Work */}
          <col style={{ width: '150px' }} /> {/* Finish Work */}
          <col style={{ width: '100px' }} /> {/* Lunch */}
          <col style={{ width: '150px' }} /> {/* Type of Leave */}
          <col style={{ width: '100px' }} /> {/* Time Leave (h) */}
          <col style={{ width: '70px' }} />  {/* Shift */}
          <col style={{ width: '60px' }} />  {/* Contract */}
          <col style={{ width: '50px' }} />  {/* Check */}
          <col style={{ width: '50px' }} />  {/* SRS */}
        </colgroup>

        <thead>
          <tr>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'left',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Date</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Hrs</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Relief?</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Start Work</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Finish Work</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Lunch</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Type of Leave</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Time Leave (h)</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Shift</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Contract</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>Check</th>
            <th style={{ 
              backgroundColor: '#f3f3f3',
              padding: '8px',
              textAlign: 'center',
              fontWeight: '600',
              fontSize: '12px',
              border: '1px solid #edebe9'
            }}>SRS</th>
          </tr>
        </thead>

        <tbody>
          {items.length === 0 ? (
            <tr>
              <td 
                colSpan={12} 
                style={{
                  textAlign: 'center',
                  padding: '40px',
                  fontSize: '14px',
                  color: '#666',
                  fontStyle: 'italic',
                  border: '1px solid #edebe9'
                }}
              >
                No SRS records found for the selected date range.
                <br />
                Please adjust the date range and click Refresh.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <React.Fragment key={item.id}>
                {/* Add blue line before rows with new date */}
                {isFirstRowWithNewDate(items, index) && (
                  <tr style={{ height: '1px', padding: 0 }}>
                    <td colSpan={12} style={{ 
                      backgroundColor: '#0078d4', 
                      height: '1px',
                      padding: 0,
                      border: 'none'
                    }} />
                  </tr>
                )}
                
                <SRSTableRow
                  key={item.id}
                  item={item}
                  options={options}
                  isEven={index % 2 === 0}
                  rowPositionInDate={getRowPositionInDate(items, index)}
                  totalTimeForDate={calculateTotalHoursForDate(items, index)}
                  totalRowsInDate={countTotalRowsInDate(items, index)}
                  displayWorkTime={getDisplayWorkTime(item)} // *** ПЕРЕДАЕМ ВЫЧИСЛЕННОЕ ВРЕМЯ ***
                  isTimesEqual={checkSRSStartEndTimeSame(item)}
                  onItemChange={handleTimeChange} // *** ИСПОЛЬЗУЕМ НАШИ ОБРАБОТЧИКИ С ПРОВЕРКОЙ НА RELIEF ***
                  onLunchTimeChange={handleLunchTimeChange} // *** ИСПОЛЬЗУЕМ НАШИ ОБРАБОТЧИКИ ***
                  onContractNumberChange={onContractNumberChange}
                />
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};