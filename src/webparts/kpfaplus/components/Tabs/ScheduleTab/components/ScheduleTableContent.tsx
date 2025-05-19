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