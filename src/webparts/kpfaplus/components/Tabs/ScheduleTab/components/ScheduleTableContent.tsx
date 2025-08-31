// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableContent.tsx
import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { Spinner } from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';
import { IScheduleItem, IScheduleOptions, INewShiftData } from './ScheduleTable';
// import { checkStartEndTimeSame } from './ScheduleTableUtils'; // Закомментировано - не используется
import { ScheduleTableRow } from './ScheduleTableRow';
import { IHoliday } from '../../../../services/HolidaysService';

export interface IScheduleTableContentProps {
 items: IScheduleItem[];
 options: IScheduleOptions;
 isLoading: boolean;
 selectedContract?: { id: string; name: string }; // Add selectedContract prop
 // *** НОВЫЙ ПРОПС: Массив праздников для передачи в ScheduleTableRow ***
 holidays: IHoliday[];
 showDeleteConfirmDialog: (id: string) => void;
 showAddShiftConfirmDialog: (item: IScheduleItem) => void; // Changed to accept full item
 showRestoreConfirmDialog: (id: string) => void;
 onRestoreItem?: (id: string) => Promise<boolean>;
 getDisplayWorkTime: (item: IScheduleItem) => string;
 
 // *** ОБНОВЛЕНО: onItemChange теперь поддерживает числовые поля ***
 onItemChange: (item: IScheduleItem, field: string, value: string) => void;
 
 onContractNumberChange: (item: IScheduleItem, value: string) => void;
 onLunchTimeChange: (item: IScheduleItem, value: string) => void;
 onTypeOfLeaveChange: (item: IScheduleItem, value: string) => void; // *** НОВЫЙ ПРОПС: Обработчик для типа отпуска ***
 onAddShift: (date: Date, shiftData?: INewShiftData) => void; // Updated to accept shift data
}

export const ScheduleTableContent: React.FC<IScheduleTableContentProps> = (props) => {
 const {
   items,
   options,
   isLoading,
   selectedContract,
   holidays, // *** НОВЫЙ ПРОПС: Получаем holidays для передачи в ScheduleTableRow ***
   showDeleteConfirmDialog,
   showAddShiftConfirmDialog,
   showRestoreConfirmDialog,
   onRestoreItem,
   getDisplayWorkTime,
   onItemChange,
   onContractNumberChange,
   onLunchTimeChange,
   onTypeOfLeaveChange // *** НОВЫЙ ПРОПС: Получаем обработчик для типа отпуска ***
   // We still need to receive onAddShift in props, but we won't pass it to ScheduleTableRow
 } = props;

 // *** НОВОЕ: Состояние для кэширования рассчитанных общих времен по датам ***
 const [cachedDateTotals, setCachedDateTotals] = useState<Record<string, string>>({});

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

 // *** СОЗДАЕМ КЛЮЧ ДАТЫ ДЛЯ КЭШИРОВАНИЯ ***
 const createDateKey = useCallback((date: Date): string => {
   return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
 }, []);

 // *** ОБНОВЛЕННАЯ ФУНКЦИЯ calculateTotalTimeForDate С КЭШИРОВАНИЕМ ***
 const calculateTotalTimeForDate = useCallback((items: IScheduleItem[], targetDate: Date): string => {
   const dateKey = createDateKey(targetDate);
   
   // Находим все строки с такой же датой
   const sameDataRows = items.filter(item => {
     const itemDate = new Date(item.date);
     return (
       itemDate.getFullYear() === targetDate.getFullYear() &&
       itemDate.getMonth() === targetDate.getMonth() &&
       itemDate.getDate() === targetDate.getDate()
     );
   });
   
   console.log(`[ScheduleTableContent] *** CALCULATING TOTAL TIME FOR DATE ${targetDate.toLocaleDateString()} ***`);
   console.log(`[ScheduleTableContent] Date key: ${dateKey}, Rows: ${sameDataRows.length}`);
   
   // Рассчитываем общее время, складывая время работы только неудаленных смен
   let totalMinutes = 0;
   
   sameDataRows.forEach((item, itemIndex) => {
     // Пропускаем удаленные записи
     if (item.deleted === true) {
       console.log(`[ScheduleTableContent] Skipping deleted record ${item.id}`);
       return;
     }
     
     // *** ИСПОЛЬЗУЕМ getDisplayWorkTime ДЛЯ ПОЛУЧЕНИЯ АКТУАЛЬНОГО ВРЕМЕНИ ***
     const workTimeStr = getDisplayWorkTime(item);
     console.log(`[ScheduleTableContent] Item ${itemIndex} work time from getDisplayWorkTime: ${workTimeStr}`);
     
     // Парсим рабочее время в формате "X.XX" в минуты
     const workTimeFloat = parseFloat(workTimeStr) || 0;
     const workMinutes = Math.round(workTimeFloat * 60); // Конвертируем часы в минуты
     
     totalMinutes += workMinutes;
     
     console.log(`[ScheduleTableContent] Item ${itemIndex}: ${workTimeStr} -> ${workMinutes} minutes (total: ${totalMinutes})`);
   });
   
   // Переводим общие минуты в часы и минуты
   const totalHours = Math.floor(totalMinutes / 60);
   const remainingMinutes = totalMinutes % 60;
   
   const result = `Total: ${totalHours}h:${remainingMinutes.toString().padStart(2, '0')}m`;
   console.log(`[ScheduleTableContent] *** FINAL TOTAL TIME FOR ${targetDate.toLocaleDateString()}: ${result} (${totalMinutes} total minutes) ***`);
   
   return result;
 }, [getDisplayWorkTime, createDateKey]);

 // *** МЕМОИЗИРОВАННЫЙ РАСЧЕТ ВСЕХ ОБЩИХ ВРЕМЕН ***
 const allDateTotals = useMemo(() => {
   console.log(`[ScheduleTableContent] *** RECALCULATING ALL DATE TOTALS ***`);
   
   const totals: Record<string, string> = {};
   
   // Группируем элементы по датам
   const dateGroups: Record<string, Date> = {};
   items.forEach(item => {
     const dateKey = createDateKey(item.date);
     if (!dateGroups[dateKey]) {
       dateGroups[dateKey] = item.date;
     }
   });
   
   // Рассчитываем общее время для каждой даты
   Object.keys(dateGroups).forEach(dateKey => {
     const date = dateGroups[dateKey];
     const total = calculateTotalTimeForDate(items, date);
     totals[dateKey] = total;
     console.log(`[ScheduleTableContent] Calculated total for ${dateKey}: ${total}`);
   });
   
   return totals;
 }, [items, calculateTotalTimeForDate, createDateKey, getDisplayWorkTime]);

 // *** ОБНОВЛЯЕМ КЭШ КОГДА ПЕРЕСЧИТЫВАЮТСЯ ОБЩИЕ ВРЕМЕНА ***
 React.useEffect(() => {
   console.log(`[ScheduleTableContent] *** UPDATING CACHED DATE TOTALS ***`);
   setCachedDateTotals(allDateTotals);
 }, [allDateTotals]);

 // *** ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ОБЩЕГО ВРЕМЕНИ ДЛЯ ДАТЫ ***
 const getTotalTimeForDate = useCallback((targetDate: Date): string => {
   const dateKey = createDateKey(targetDate);
   const cachedTotal = cachedDateTotals[dateKey];
   
   if (cachedTotal) {
     console.log(`[ScheduleTableContent] Using cached total for ${dateKey}: ${cachedTotal}`);
     return cachedTotal;
   }
   
   // Если в кэше нет, рассчитываем на лету
   console.log(`[ScheduleTableContent] Cache miss for ${dateKey}, calculating on-demand`);
   const calculated = calculateTotalTimeForDate(items, targetDate);
   
   // Обновляем кэш
   setCachedDateTotals(prev => ({
     ...prev,
     [dateKey]: calculated
   }));
   
   return calculated;
 }, [cachedDateTotals, createDateKey, calculateTotalTimeForDate, items]);

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

 // *** ОБЕРТКА ДЛЯ onItemChange ЧТОБЫ ИНВАЛИДИРОВАТЬ КЭШ ***
 const handleItemChangeWithCacheInvalidation = useCallback((item: IScheduleItem, field: string, value: string): void => {
   console.log(`[ScheduleTableContent] *** ITEM CHANGE WITH CACHE INVALIDATION ***`);
   console.log(`[ScheduleTableContent] Item: ${item.id}, Field: ${field}, Value: ${value}`);
   
   // Если изменяется время или обед, инвалидируем кэш для этой даты
   const timeFields = ['startHour', 'startMinute', 'finishHour', 'finishMinute', 'lunchTime', 'workingHours'];
   if (timeFields.includes(field)) {
     const dateKey = createDateKey(item.date);
     console.log(`[ScheduleTableContent] Time field changed, invalidating cache for date: ${dateKey}`);
     
     setCachedDateTotals(prev => {
       const updated = { ...prev };
       delete updated[dateKey]; // Удаляем из кэша, чтобы пересчитать
       return updated;
     });
   }
   
   // Вызываем оригинальный обработчик
   onItemChange(item, field, value);
 }, [onItemChange, createDateKey]);

 // *** ОБЕРТКА ДЛЯ onLunchTimeChange ЧТОБЫ ИНВАЛИДИРОВАТЬ КЭШ ***
 const handleLunchTimeChangeWithCacheInvalidation = useCallback((item: IScheduleItem, value: string): void => {
   console.log(`[ScheduleTableContent] *** LUNCH TIME CHANGE WITH CACHE INVALIDATION ***`);
   console.log(`[ScheduleTableContent] Item: ${item.id}, New lunch time: ${value}`);
   
   const dateKey = createDateKey(item.date);
   console.log(`[ScheduleTableContent] Lunch time changed, invalidating cache for date: ${dateKey}`);
   
   setCachedDateTotals(prev => {
     const updated = { ...prev };
     delete updated[dateKey]; // Удаляем из кэша, чтобы пересчитать
     return updated;
   });
   
   // Вызываем оригинальный обработчик
   onLunchTimeChange(item, value);
 }, [onLunchTimeChange, createDateKey]);

 // Log selected contract for debugging
 if (selectedContract) {
   console.log(`[ScheduleTableContent] Selected contract: ${selectedContract.name} (ID: ${selectedContract.id})`);
 }

 // *** ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ ДЛЯ ПРАЗДНИКОВ ***
 console.log(`[ScheduleTableContent] Rendering with ${holidays.length} holidays for holiday detection`);

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
                 
                 {/* *** ОБНОВЛЕНО: Передаем holidays и новый обработчик типа отпуска в ScheduleTableRow *** */}
                 <ScheduleTableRow 
                   item={item}
                   rowIndex={index}
                   rowPositionInDate={getRowPositionInDate(items, index)}
                   totalTimeForDate={getTotalTimeForDate(item.date)}
                   totalRowsInDate={countTotalRowsInDate(items, index)}
                   options={options}
                   displayWorkTime={getDisplayWorkTime(item)}
                   holidays={holidays} // *** НОВЫЙ ПРОПС: Передаем holidays массив ***
                   showDeleteConfirmDialog={showDeleteConfirmDialog}
                   showAddShiftConfirmDialog={showAddShiftConfirmDialog}
                   showRestoreConfirmDialog={showRestoreConfirmDialog}
                   onRestoreItem={onRestoreItem}
                   onItemChange={handleItemChangeWithCacheInvalidation}
                   onContractNumberChange={onContractNumberChange}
                   onLunchTimeChange={handleLunchTimeChangeWithCacheInvalidation}
                   onTypeOfLeaveChange={onTypeOfLeaveChange} // *** НОВЫЙ ПРОПС: Передаем обработчик типа отпуска ***
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