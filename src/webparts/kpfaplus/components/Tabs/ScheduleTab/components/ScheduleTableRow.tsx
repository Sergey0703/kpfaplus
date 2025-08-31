// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableRow.tsx
import * as React from 'react';
import { 
 Dropdown, 
 IconButton, 
 PrimaryButton, 
 IDropdownStyles
} from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';
import { IScheduleItem, IScheduleOptions } from './ScheduleTable';
import { formatDate } from './ScheduleTableUtils';
import { IHoliday } from '../../../../services/HolidaysService';

export interface IScheduleTableRowProps {
 item: IScheduleItem;
 rowIndex: number;
 rowPositionInDate: number; // Позиция строки внутри даты (0 - первая, 1 - вторая и т.д.)
 totalTimeForDate: string; // Общее время работы за день в формате "Total: XXh:XXm"
 totalRowsInDate: number; // Общее количество строк в дате (включая удаленные)
 options: IScheduleOptions;
 displayWorkTime: string;
 // *** НОВЫЙ ПРОПС: Массив праздников для проверки даты ***
 holidays: IHoliday[];
 showDeleteConfirmDialog: (id: string) => void;
 showAddShiftConfirmDialog: (item: IScheduleItem) => void; // Changed to pass the entire item
 showRestoreConfirmDialog: (id: string) => void;
 onRestoreItem?: (id: string) => Promise<boolean>; 
 
 // *** ОБНОВЛЕНО: onItemChange теперь поддерживает числовые поля ***
 onItemChange: (item: IScheduleItem, field: string, value: string) => void;
 
 onContractNumberChange: (item: IScheduleItem, value: string) => void;
 onLunchTimeChange: (item: IScheduleItem, value: string) => void;
 onTypeOfLeaveChange: (item: IScheduleItem, value: string) => void;
}

export const ScheduleTableRow: React.FC<IScheduleTableRowProps> = (props) => {
 const { 
   item, 
   rowIndex, 
   rowPositionInDate,
   totalTimeForDate,
   totalRowsInDate,
   options, 
   displayWorkTime,
   holidays, // *** НОВЫЙ ПРОПС: Используем holidays вместо item.Holiday ***
   showDeleteConfirmDialog,
   showAddShiftConfirmDialog,
   showRestoreConfirmDialog,
   onRestoreItem,
   onItemChange,
   onContractNumberChange,
   onLunchTimeChange,
   onTypeOfLeaveChange
 } = props;

 // Определяем, удалена ли запись
 const isDeleted = item.deleted === true;
 
 // *** ИСПРАВЛЕНО: Определяем праздник через holidays массив с Date-only format совместимостью ***
 const isHoliday = React.useMemo(() => {
   if (!holidays || holidays.length === 0) {
     return false;
   }
   
   // *** УЛУЧШЕННАЯ ЛОГИКА: Используем Date-only сравнение (совместимо с HolidaysService) ***
   const formatDateForComparison = (date: Date): string => {
     const year = date.getFullYear();
     const month = (date.getMonth() + 1).toString().padStart(2, '0');
     const day = date.getDate().toString().padStart(2, '0');
     return `${year}-${month}-${day}`;
   };
   
   const itemDateString = formatDateForComparison(item.date);
   
   // Проверяем, есть ли дата в списке праздников используя Date-only сравнение
   const foundHoliday = holidays.some(holiday => {
     const holidayDateString = formatDateForComparison(holiday.date);
     const isMatch = holidayDateString === itemDateString;
     
     if (isMatch) {
       console.log(`[ScheduleTableRow] Holiday match found via Date-only comparison: ${holiday.title} for ${itemDateString}`);
     }
     
     return isMatch;
   });
   
   return foundHoliday;
 }, [holidays, item.date]);

 // *** ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ ДЛЯ ПРОВЕРКИ ПРАЗДНИКОВ С DATE-ONLY FORMAT ***
 React.useEffect(() => {
   if (isHoliday) {
     console.log(`[ScheduleTableRow] Holiday detected for ${item.date.toLocaleDateString()} via Date-only compatible holidays list (not StaffRecords.Holiday field)`);
     
     // Найдем и выведем информацию о найденном празднике
     const formatDateForComparison = (date: Date): string => {
       const year = date.getFullYear();
       const month = (date.getMonth() + 1).toString().padStart(2, '0');
       const day = date.getDate().toString().padStart(2, '0');
       return `${year}-${month}-${day}`;
     };
     
     const itemDateString = formatDateForComparison(item.date);
     const matchedHoliday = holidays.find(holiday => {
       const holidayDateString = formatDateForComparison(holiday.date);
       return holidayDateString === itemDateString;
     });
     
     if (matchedHoliday) {
       console.log(`[ScheduleTableRow] Matched holiday details: "${matchedHoliday.title}" (Date-only format: ${formatDateForComparison(matchedHoliday.date)})`);
     }
   }
 }, [isHoliday, item.date, holidays]);
 
 // Определяем цвет фона для строки и классы
 const isEvenRow = rowIndex % 2 === 0;
 let backgroundColor = isEvenRow ? '#f9f9f9' : '#ffffff';
 let rowClassName = '';
 
 // *** ОБНОВЛЕНО: Определяем цвета для праздничных ячеек через Date-only compatible holidays список ***
 const getHolidayCellStyle = (isFirstTwoCells: boolean = false): React.CSSProperties => {
   if (isHoliday && !isDeleted && isFirstTwoCells) {
     return {
       backgroundColor: '#ffe6f0', // Светло-розовый для праздничных дней
     };
   }
   return {};
 };
 
 if (isDeleted) {
   backgroundColor = '#f5f5f5';
   rowClassName = styles.deletedRow;
 }

 // Стили для dropdown при удаленных записях
 const getDropdownStyles = (isError = false): Partial<IDropdownStyles> => ({
   root: { 
     width: 60, 
     margin: '0 4px',
     ...(isDeleted && {
       backgroundColor: '#f5f5f5',
       color: '#888',
       borderColor: '#ddd'
     })
   },
   title: {
     ...(isDeleted && {
       color: '#888',
       textDecoration: 'line-through'
     })
   },
   caretDown: {
     ...(isDeleted && {
       color: '#aaa'
     })
   }
 });

 const getLunchDropdownStyles = (): Partial<IDropdownStyles> => ({
   root: { 
     width: 80,
     ...(isDeleted && {
       backgroundColor: '#f5f5f5',
       color: '#888',
       borderColor: '#ddd'
     })
   },
   title: {
     ...(isDeleted && {
       color: '#888',
       textDecoration: 'line-through'
     })
   },
   caretDown: {
     ...(isDeleted && {
       color: '#aaa'
     })
   }
 });

 const getLeaveDropdownStyles = (): Partial<IDropdownStyles> => ({
   root: { 
     width: 150,
     ...(isDeleted && {
       backgroundColor: '#f5f5f5',
       color: '#888',
       borderColor: '#ddd'
     })
   },
   title: {
     ...(isDeleted && {
       color: '#888',
       textDecoration: 'line-through'
     })
   },
   caretDown: {
     ...(isDeleted && {
       color: '#aaa'
     })
   }
 });

 const getContractDropdownStyles = (): Partial<IDropdownStyles> => ({
   root: { 
     width: 50,
     ...(isDeleted && {
       backgroundColor: '#f5f5f5',
       color: '#888',
       borderColor: '#ddd'
     })
   },
   title: {
     ...(isDeleted && {
       color: '#888',
       textDecoration: 'line-through'
     })
   },
   caretDown: {
     ...(isDeleted && {
       color: '#aaa'
     })
   }
 });

 // Определяем значения по умолчанию для контрактов
 const defaultContractOptions = [
   { key: '1', text: '1' },
   { key: '2', text: '2' },
   { key: '3', text: '3' }
 ];

 // *** ОБНОВЛЕНО: Отображение ячейки с датой использует Date-only compatible holidays список для определения праздника ***
 const renderDateCell = (): JSX.Element => {
   // Если это первая строка даты, отображаем дату и день недели
   if (rowPositionInDate === 0) {
     return (
       <>
         <div className={isDeleted ? styles.deletedText : ''}>
           {formatDate(item.date)}
         </div>
         <div style={{ fontWeight: 'normal', fontSize: '12px' }} className={isDeleted ? styles.deletedText : ''}>
           {item.dayOfWeek}
           {/* *** ОБНОВЛЕНО: Праздник определяется через Date-only compatible holidays список *** */}
           {isHoliday && !isDeleted && (
             <div style={{ color: '#e81123', fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
               Holiday
             </div>
           )}
           {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none' }}>(Deleted)</span>}
         </div>
       </>
     );
   }
   // Если это вторая строка даты и в дате несколько строк, отображаем общую сумму часов за день
   else if (rowPositionInDate === 1 && totalRowsInDate > 1) {
     return (
       <div style={{ 
         fontWeight: 'bold', 
         fontSize: '12px', 
         color: '#0078d4', 
         textAlign: 'center',
         marginTop: '8px',
         ...(isDeleted && { color: '#88a0bd', textDecoration: 'line-through' }) // Более светлый синий для удаленных
       }}>
         {totalTimeForDate}
         {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px', textDecoration: 'none', fontSize: '10px' }}>(Deleted)</span>}
       </div>
     );
   }
   // Если это третья или последующие строки даты, оставляем ячейку пустой
   else {
     return (
       <div>
         {isDeleted && <span style={{ color: '#d83b01', fontSize: '10px', textDecoration: 'none' }}>(Deleted)</span>}
         {/* *** ОБНОВЛЕНО: Праздник определяется через Date-only compatible holidays список *** */}
         {isHoliday && !isDeleted && (
           <div style={{ color: '#e81123', fontSize: '10px', fontWeight: 'bold' }}>
             Holiday
           </div>
         )}
       </div>
     );
   }
 };

 // Обработчик клика по кнопке "+Shift" с подтверждением
 const handleAddShiftClick = (): void => {
   // *** ИСПРАВЛЕНИЕ: Создаем shiftData с временем обеда из текущей строки ***
   const shiftDataWithLunchTime = {
     date: item.date,
     timeForLunch: item.lunchTime, // ← Берем время обеда из текущей строки
     contract: item.contract,
     contractNumber: item.contractNumber,
     typeOfLeave: item.typeOfLeave
   };
   
   // Создаем модифицированный item с правильными данными для новой смены
   const itemWithShiftData = {
     ...item,
     ...shiftDataWithLunchTime
   };
   
   // Вызываем диалог подтверждения, передавая модифицированную запись
   showAddShiftConfirmDialog(itemWithShiftData);
 };

 // *** ОБНОВЛЕННЫЕ ОБРАБОТЧИКИ ИЗМЕНЕНИЯ ВРЕМЕНИ ***
 const handleTimeFieldChange = (field: string, optionKey: string): void => {
   if (isDeleted) return;
   
   // Вызываем родительский обработчик, который обновит как строковые, так и числовые поля
   onItemChange(item, field, optionKey);
 };

 return (
   <tr 
     style={{ 
       backgroundColor: backgroundColor || undefined,
       border: '1px solid #edebe9',
       marginBottom: '4px',
       borderRadius: '2px',
       ...(isDeleted && { color: '#888' })
     }}
     className={rowClassName}
   >
     {/* *** ОБНОВЛЕНО: Ячейка с датой использует getHolidayCellStyle на основе Date-only compatible holidays списка *** */}
     <td style={{ 
       padding: '8px 0 8px 8px',
       ...getHolidayCellStyle(true) // Применяем розовый фон для праздничных дней (из Date-only compatible holidays списка)
     }}>
       {renderDateCell()}
     </td>
     
     {/* *** ОБНОВЛЕНО: Ячейка с рабочими часами использует getHolidayCellStyle на основе Date-only compatible holidays списка *** */}
     <td style={{ 
       textAlign: 'center',
       fontWeight: 'bold',
       whiteSpace: 'nowrap',
       color: displayWorkTime === '0.00' ? '#666' : 'inherit',
       ...getHolidayCellStyle(true) // Применяем розовый фон для праздничных дней (из Date-only compatible holidays списка)
     }}
     className={isDeleted ? styles.deletedText : ''}>
       <span className={isDeleted ? styles.deletedText : ''}>
         {displayWorkTime}
       </span>
       {isDeleted && (
         <div style={{ 
           fontSize: '10px', 
           color: '#d83b01', 
           marginTop: '2px',
           textDecoration: 'none' 
         }}>
           (not counted)
         </div>
       )}
     </td>
     
     {/* Ячейка с началом работы */}
     <td style={{ textAlign: 'center' }}>
       <div style={{ display: 'flex', justifyContent: 'center' }}>
         <Dropdown
           selectedKey={item.startHour}
           options={options.hours}
           onChange={(_, option): void => option && handleTimeFieldChange('startHour', option.key as string)}
           styles={getDropdownStyles()}
           disabled={isDeleted}
         />
         <Dropdown
           selectedKey={item.startMinute}
           options={options.minutes}
           onChange={(_, option): void => option && handleTimeFieldChange('startMinute', option.key as string)}
           styles={getDropdownStyles()}
           disabled={isDeleted}
         />
       </div>
     </td>
     
     {/* Ячейка с окончанием работы */}
     <td style={{ textAlign: 'center' }}>
       <div style={{ display: 'flex', justifyContent: 'center' }}>
         <Dropdown
           selectedKey={item.finishHour}
           options={options.hours}
           onChange={(_, option): void => option && handleTimeFieldChange('finishHour', option.key as string)}
           styles={getDropdownStyles()}
           disabled={isDeleted}
         />
         <Dropdown
           selectedKey={item.finishMinute}
           options={options.minutes}
           onChange={(_, option): void => option && handleTimeFieldChange('finishMinute', option.key as string)}
           styles={getDropdownStyles()}
           disabled={isDeleted}
         />
       </div>
     </td>
     
     {/* Ячейка с временем обеда */}
     <td style={{ textAlign: 'center' }}>
       <Dropdown
         selectedKey={item.lunchTime}
         options={options.lunchTimes}
         onChange={(_, option): void => option && onLunchTimeChange(item, option.key as string)}
         styles={getLunchDropdownStyles()}
         disabled={isDeleted}
       />
     </td>
     
     {/* Ячейка с типом отпуска */}
     <td style={{ textAlign: 'center' }}>
       <Dropdown
         selectedKey={item.typeOfLeave ? String(item.typeOfLeave) : ''}
         options={options.leaveTypes}
         onChange={(_, option): void => option && onTypeOfLeaveChange(item, option.key as string)}
         styles={getLeaveDropdownStyles()}
         disabled={isDeleted}
       />
     </td>
     
     {/* Кнопка +Shift */}
     <td style={{ textAlign: 'center', padding: '0' }}>
       <PrimaryButton
         text="+Shift"
         styles={{ 
           root: { 
             minWidth: 60, 
             padding: '0 4px', 
             backgroundColor: '#107c10',
             ...(isDeleted && {
               backgroundColor: '#f5f5f5',
               color: '#888',
               borderColor: '#ddd'
             })
           } 
         }}
         onClick={handleAddShiftClick} // Используем новый обработчик с подтверждением
         disabled={isDeleted}
       />
     </td>
     
     {/* Ячейка с номером контракта */}
     <td>
       <Dropdown
         selectedKey={item.contractNumber || '1'}
         options={options.contractNumbers || defaultContractOptions}
         onChange={(_, option): void => option && onContractNumberChange(item, option.key as string)}
         styles={getContractDropdownStyles()}
         disabled={isDeleted}
       />
     </td>
     
     {/* Иконка удаления или восстановления в зависимости от статуса */}
     <td style={{ textAlign: 'center', padding: '0' }}>
       {isDeleted ? (
         // Кнопка восстановления для удаленных записей
         <IconButton
           iconProps={{ iconName: 'Refresh' }}
           title="Restore"
           ariaLabel="Restore"
           onClick={(): void => {
             if (onRestoreItem) {
               showRestoreConfirmDialog(item.id);
             } else {
               console.error('Restore handler is not available');
             }
           }}
           styles={{
             root: { color: '#107c10' }, // Зеленый цвет для восстановления
             rootHovered: { color: '#0b5a0b' }
           }}
           disabled={!onRestoreItem}
         />
       ) : (
         // Кнопка удаления для активных записей
         <IconButton
           iconProps={{ iconName: 'Delete' }}
           title="Delete"
           ariaLabel="Delete"
           onClick={(): void => showDeleteConfirmDialog(item.id)}
           styles={{ 
             root: { color: '#e81123' },
             rootHovered: { color: '#a80000' }
           }}
         />
       )}
     </td>
     
     {/* Текстовое поле для ID */}
     <td style={{ 
       textAlign: 'center', 
       fontSize: '12px', 
       color: isDeleted ? '#888' : '#666'
     }}>
       {item.id}
     </td>
   </tr>
 );
};