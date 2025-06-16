// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableContent.tsx
import * as React from 'react';
import { Spinner } from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';
import { IScheduleItem, IScheduleOptions, INewShiftData } from './ScheduleTable';
// import { checkStartEndTimeSame } from './ScheduleTableUtils'; // Закомментировано - не используется
import { ScheduleTableRow } from './ScheduleTableRow';

export interface IScheduleTableContentProps {
 items: IScheduleItem[];
 options: IScheduleOptions;
 isLoading: boolean;
 selectedContract?: { id: string; name: string }; // Add selectedContract prop
 showDeleteConfirmDialog: (id: string) => void;
 showAddShiftConfirmDialog: (item: IScheduleItem) => void; // Changed to accept full item
 showRestoreConfirmDialog: (id: string) => void;
 onRestoreItem?: (id: string) => Promise<boolean>;
 getDisplayWorkTime: (item: IScheduleItem) => string;
 
 // *** ОБНОВЛЕНО: onItemChange теперь поддерживает числовые поля ***
 onItemChange: (item: IScheduleItem, field: string, value: string) => void;
 
 onContractNumberChange: (item: IScheduleItem, value: string) => void;
 onLunchTimeChange: (item: IScheduleItem, value: string) => void;
 onAddShift: (date: Date, shiftData?: INewShiftData) => void; // Updated to accept shift data
}

export const ScheduleTableContent: React.FC<IScheduleTableContentProps> = (props) => {
 const {
   items,
   options,
   isLoading,
   selectedContract,
   showDeleteConfirmDialog,
   showAddShiftConfirmDialog,
   showRestoreConfirmDialog,
   onRestoreItem,
   getDisplayWorkTime,
   onItemChange,
   onContractNumberChange,
   onLunchTimeChange
   // We still need to receive onAddShift in props, but we won't pass it to ScheduleTableRow
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

 // *** ОБНОВЛЕННАЯ ФУНКЦИЯ calculateTotalTimeForDate С ПОДДЕРЖКОЙ ЧИСЛОВЫХ ПОЛЕЙ ***
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
   
   console.log(`[ScheduleTableContent] *** CALCULATING TOTAL TIME FOR DATE WITH NUMERIC FIELDS ***`);
   console.log(`[ScheduleTableContent] Date: ${currentDate.toLocaleDateString()}, Rows: ${sameDataRows.length}`);
   
   // Рассчитываем общее время, складывая время работы только неудаленных смен
   let totalHours = 0;
   let totalMinutes = 0;
   
   sameDataRows.forEach((item, itemIndex) => {
     // Пропускаем удаленные записи
     if (item.deleted === true) {
       console.log(`[ScheduleTableContent] Skipping deleted record ${item.id}`);
       return;
     }
     
     // *** ПРИОРИТЕТ ЧИСЛОВЫХ ПОЛЕЙ ДЛЯ РАСЧЕТА ВРЕМЕНИ ***
     let startHours: number, startMinutes: number, finishHours: number, finishMinutes: number;
     
     // Используем числовые поля если доступны, иначе парсим строковые
     if (typeof item.startHours === 'number' && typeof item.startMinutes === 'number' &&
         typeof item.finishHours === 'number' && typeof item.finishMinutes === 'number') {
       
       startHours = item.startHours;
       startMinutes = item.startMinutes;
       finishHours = item.finishHours;
       finishMinutes = item.finishMinutes;
       
       console.log(`[ScheduleTableContent] Using numeric fields for item ${itemIndex}: ${startHours}:${startMinutes} - ${finishHours}:${finishMinutes}`);
     } else {
       // Fallback к строковым полям
       startHours = parseInt(item.startHour, 10) || 0;
       startMinutes = parseInt(item.startMinute, 10) || 0;
       finishHours = parseInt(item.finishHour, 10) || 0;
       finishMinutes = parseInt(item.finishMinute, 10) || 0;
       
       console.log(`[ScheduleTableContent] Using string fields for item ${itemIndex}: ${startHours}:${startMinutes} - ${finishHours}:${finishMinutes}`);
     }
     
     // Рассчитываем время работы для этой смены
     const startTotalMinutes = startHours * 60 + startMinutes;
     const finishTotalMinutes = finishHours * 60 + finishMinutes;
     const lunchMinutes = parseInt(item.lunchTime, 10) || 0;
     
     let workMinutes = 0;
     if (finishTotalMinutes > startTotalMinutes) {
       workMinutes = finishTotalMinutes - startTotalMinutes - lunchMinutes;
     }
     
     if (workMinutes > 0) {
       const workHours = Math.floor(workMinutes / 60);
       const remainingMinutes = workMinutes % 60;
       
       totalHours += workHours;
       totalMinutes += remainingMinutes;
       
       console.log(`[ScheduleTableContent] Item ${itemIndex} work time: ${workHours}h ${remainingMinutes}m (total so far: ${totalHours}h ${totalMinutes}m)`);
     }
   });
   
   // Переводим лишние минуты в часы
   if (totalMinutes >= 60) {
     totalHours += Math.floor(totalMinutes / 60);
     totalMinutes = totalMinutes % 60;
   }
   
   const result = `Total: ${totalHours}h:${totalMinutes.toString().padStart(2, '0')}m`;
   console.log(`[ScheduleTableContent] *** FINAL TOTAL TIME FOR ${currentDate.toLocaleDateString()}: ${result} ***`);
   
   return result;
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

 // Log selected contract for debugging
 if (selectedContract) {
   console.log(`[ScheduleTableContent] Selected contract: ${selectedContract.name} (ID: ${selectedContract.id})`);
 }

 return (
   <div className={styles.tableContainer} style={{ width: '100%' }}>
     <table style={{ borderSpacing: '0', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
       <colgroup>
         <col style={{ width: '100px' }} /> {/* Date */}
         <col style={{ width: '60px' }} /> {/* Hours - СУЖЕНО с 80px до 60px */}
         <col style={{ width: '150px' }} /> {/* Start Work */}
         <col style={{ width: '150px' }} /> {/* Finish Work */}
         <col style={{ width: '100px' }} /> {/* Time for Lunch */}
         <col style={{ width: '150px' }} /> {/* Type of Leave */}
         <col style={{ width: '70px' }} /> {/* +Shift */}
         <col style={{ width: '60px' }} /> {/* Contract */}
         <col style={{ width: '30px' }} /> {/* Delete */}
         <col style={{ width: '50px' }} /> {/* ID - СУЖЕНО с 80px до 50px */}
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
           items.map((item, index) => {
             // *** ФУНКЦИЯ checkTimesEqual ЗАКОММЕНТИРОВАНА - НЕ ИСПОЛЬЗУЕТСЯ ***
             // const checkTimesEqual = (): boolean => {
             //   // Используем числовые поля если доступны
             //   if (typeof item.startHours === 'number' && typeof item.startMinutes === 'number' &&
             //       typeof item.finishHours === 'number' && typeof item.finishMinutes === 'number') {
             //     
             //     const startTotal = item.startHours * 60 + item.startMinutes;
             //     const finishTotal = item.finishHours * 60 + item.finishMinutes;
             //     
             //     const isEqual = startTotal === finishTotal && startTotal !== 0;
             //     console.log(`[ScheduleTableContent] Time equality check (numeric): ${item.startHours}:${item.startMinutes} = ${item.finishHours}:${item.finishMinutes} → ${isEqual}`);
             //     return isEqual;
             //   } else {
             //     // Fallback к старой логике со строковыми полями
             //     const isEqual = checkStartEndTimeSame(item);
             //     console.log(`[ScheduleTableContent] Time equality check (string): ${item.startHour}:${item.startMinute} = ${item.finishHour}:${item.finishMinute} → ${isEqual}`);
             //     return isEqual;
             //   }
             // };

             return (
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
                   // isTimesEqual={checkTimesEqual()} // Закомментировано - не используется
                   showDeleteConfirmDialog={showDeleteConfirmDialog}
                   showAddShiftConfirmDialog={showAddShiftConfirmDialog}
                   showRestoreConfirmDialog={showRestoreConfirmDialog}
                   onRestoreItem={onRestoreItem}
                   onItemChange={onItemChange}
                   onContractNumberChange={onContractNumberChange}
                   onLunchTimeChange={onLunchTimeChange}
                 />
               </React.Fragment>
             );
           })
         )}
       </tbody>
     </table>
   </div>
 );
};