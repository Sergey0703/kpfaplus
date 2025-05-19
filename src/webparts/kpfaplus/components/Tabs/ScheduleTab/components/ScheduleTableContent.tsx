// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableContent.tsx
import * as React from 'react';
import { Spinner } from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';
import { IScheduleItem, IScheduleOptions } from './ScheduleTable';
import { checkStartEndTimeSame } from './ScheduleTableUtils';
import { ScheduleTableRow } from './ScheduleTableRow';

export interface IScheduleTableContentProps {
  items: IScheduleItem[];
  options: IScheduleOptions;
  isLoading: boolean;
  showDeleteConfirmDialog: (id: string) => void;
  showRestoreConfirmDialog: (id: string) => void;
  onRestoreItem?: (id: string) => Promise<void>;
  getDisplayWorkTime: (item: IScheduleItem) => string;
  onItemChange: (item: IScheduleItem, field: string, value: string) => void;
  onContractNumberChange: (item: IScheduleItem, value: string) => void;
  onLunchTimeChange: (item: IScheduleItem, value: string) => void;
  onAddShift: (date: Date) => void;
}

export const ScheduleTableContent: React.FC<IScheduleTableContentProps> = (props) => {
  const {
    items,
    options,
    isLoading,
    showDeleteConfirmDialog,
    showRestoreConfirmDialog,
    onRestoreItem,
    getDisplayWorkTime,
    onItemChange,
    onContractNumberChange,
    onLunchTimeChange,
    onAddShift
  } = props;

  // Функция для проверки, нужно ли добавлять разделительную линию перед строкой
  const isFirstRowWithNewDate = (items: IScheduleItem[], index: number): boolean => {
    if (index === 0) return true; // Первая строка всегда начинает новую дату
    
    // Сравниваем даты текущей и предыдущей строки
    const currentDate = new Date(items[index].date);
    const previousDate = new Date(items[index - 1].date);
    
    // Сравниваем только год, месяц и день
    return (
      currentDate.getFullYear() !== previousDate.getFullYear() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getDate() !== previousDate.getDate()
    );
  };

  // Функция для определения позиции строки в группе строк с одинаковой датой
  const getRowPositionInDate = (items: IScheduleItem[], index: number): number => {
    if (index === 0) return 0; // Первая строка всегда имеет позицию 0
    
    const currentDate = new Date(items[index].date);
    let position = 0;
    
    // Считаем, сколько строк с такой же датой было до текущей (включая удаленные)
    for (let i = 0; i < index; i++) {
      const itemDate = new Date(items[i].date);
      
      // Если даты совпадают, увеличиваем позицию
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

  // Функция для расчета общего времени работы за день (только для неудаленных строк)
  const calculateTotalTimeForDate = (items: IScheduleItem[], index: number): string => {
    const currentDate = new Date(items[index].date);
    
    // Находим все строки с такой же датой
    const sameDataRows = items.filter(item => {
      const itemDate = new Date(item.date);
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      );
    });
    
    // Если у нас только одна смена в день, все равно рассчитываем и возвращаем сумму
    // (но она будет отображаться только если строк больше одной)
    
    // Рассчитываем общее время, складывая время работы только неудаленных смен
    let totalHours = 0;
    let totalMinutes = 0;
    
    sameDataRows.forEach(item => {
      // Пропускаем удаленные записи
      if (item.deleted === true) {
        return;
      }
      
      // Получаем время работы из формата "H.MM"
      const workTime = getDisplayWorkTime(item);
      const [hoursStr, minutesStr] = workTime.split('.');
      
      const hours = parseInt(hoursStr, 10) || 0;
      const minutes = parseInt(minutesStr, 10) || 0;
      
      totalHours += hours;
      totalMinutes += minutes;
    });
    
    // Переводим лишние минуты в часы
    if (totalMinutes >= 60) {
      totalHours += Math.floor(totalMinutes / 60);
      totalMinutes = totalMinutes % 60;
    }
    
    return `Total: ${totalHours}h:${totalMinutes.toString().padStart(2, '0')}m`;
  };

  // Функция для подсчета всех строк (включая удаленные) в группе с одинаковой датой
  const countTotalRowsInDate = (items: IScheduleItem[], index: number): number => {
    const currentDate = new Date(items[index].date);
    
    // Считаем все строки с такой же датой
    return items.filter(item => {
      const itemDate = new Date(item.date);
      
      return (
        itemDate.getFullYear() === currentDate.getFullYear() &&
        itemDate.getMonth() === currentDate.getMonth() &&
        itemDate.getDate() === currentDate.getDate()
      );
    }).length;
  };

  return (
    <div className={styles.tableContainer} style={{ width: '100%' }}>
      <table style={{ borderSpacing: '0', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '100px' }} /> {/* Date */}
          <col style={{ width: '80px' }} /> {/* Hours */}
          <col style={{ width: '150px' }} /> {/* Start Work */}
          <col style={{ width: '150px' }} /> {/* Finish Work */}
          <col style={{ width: '100px' }} /> {/* Time for Lunch */}
          <col style={{ width: '150px' }} /> {/* Type of Leave */}
          <col style={{ width: '70px' }} /> {/* +Shift */}
          <col style={{ width: '60px' }} /> {/* Contract */}
          <col style={{ width: '30px' }} /> {/* Delete */}
          <col style={{ width: '80px' }} /> {/* ID */}
        </colgroup>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px 0' }}>Date</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }}>Hours</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }}>Start Work</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }}>Finish Work</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }}>Time for Lunch:</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }}>Type of Leave</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }} /> {/* Для кнопки +Shift */}
            <th style={{ textAlign: 'left', padding: '8px 0' }}>Contract</th>
            <th style={{ textAlign: 'center', padding: '8px 0' }} /> {/* Для кнопки удаления */}
            <th style={{ textAlign: 'center', padding: '8px 0' }}>ID</th> {/* Для ID */}
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                <Spinner label="Loading schedule data..." />
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                No schedule items found for the selected date and contract.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <React.Fragment key={item.id}>
                {/* Добавляем синюю линию перед строками с новой датой */}
                {isFirstRowWithNewDate(items, index) && (
                  <tr style={{ height: '1px', padding: 0 }}>
                    <td colSpan={10} style={{ 
                      backgroundColor: '#0078d4', 
                      height: '1px',
                      padding: 0,
                      border: 'none'
                    }} />
                  </tr>
                )}
                
                <ScheduleTableRow 
                  item={item}
                  rowIndex={index}
                  rowPositionInDate={getRowPositionInDate(items, index)}
                  totalTimeForDate={calculateTotalTimeForDate(items, index)}
                  totalRowsInDate={countTotalRowsInDate(items, index)}
                  options={options}
                  displayWorkTime={getDisplayWorkTime(item)}
                  isTimesEqual={checkStartEndTimeSame(item)}
                  showDeleteConfirmDialog={showDeleteConfirmDialog}
                  showRestoreConfirmDialog={showRestoreConfirmDialog}
                  onRestoreItem={onRestoreItem}
                  onItemChange={onItemChange}
                  onContractNumberChange={onContractNumberChange}
                  onLunchTimeChange={onLunchTimeChange}
                  onAddShift={onAddShift}
                />
              </React.Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};