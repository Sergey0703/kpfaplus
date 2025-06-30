// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTable.tsx
import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import styles from '../ScheduleTab.module.scss';
import { ScheduleTableHeader } from './ScheduleTableHeader';
import { ScheduleTableContent } from './ScheduleTableContent';
import { ScheduleTableDialogs } from './ScheduleTableDialogs';
import { calculateItemWorkTime } from './ScheduleTableUtils';

import {
 IDropdownOption,
 Dropdown,
 Text,
 DefaultButton,
} from '@fluentui/react';

// *** ОБНОВЛЕННЫЙ ИНТЕРФЕЙС IScheduleItem С ЧИСЛОВЫМИ ПОЛЯМИ ВРЕМЕНИ ***
export interface IScheduleItem {
 id: string;
 date: Date;
 dayOfWeek: string;
 workingHours: string;
 
 // *** ОБНОВЛЕНО: Строковые поля для UI (для обратной совместимости) ***
 startHour: string;
 startMinute: string;
 finishHour: string;
 finishMinute: string;
 
 // *** НОВОЕ: Числовые поля времени (приоритет при сохранении) ***
 startHours?: number;
 startMinutes?: number;
 finishHours?: number;
 finishMinutes?: number;
 
 lunchTime: string;
 typeOfLeave?: string;
 shift: number;
 contract: string;
 contractId: string;
 contractNumber?: string;
 deleted?: boolean;
 Holiday?: number;
}

export interface INewShiftData {
 date: Date;
 timeForLunch: string;
 contract: string;
 contractNumber?: string;
 typeOfLeave?: string;
 Holiday?: number;
}

export interface IScheduleOptions {
 hours: IDropdownOption[];
 minutes: IDropdownOption[];
 lunchTimes: IDropdownOption[];
 leaveTypes: IDropdownOption[];
 contractNumbers?: IDropdownOption[];
}

// --- ОБНОВЛЕННЫЙ ИНТЕРФЕЙС СВОЙСТВ КОМПОНЕНТА ScheduleTable ---
export interface IScheduleTableProps {
 items: IScheduleItem[];
 options: IScheduleOptions;
 selectedDate: Date;
 selectedContract?: { id: string; name: string };
 isLoading: boolean;
 showDeleted: boolean;
 onToggleShowDeleted: (checked: boolean) => void;
 
 // *** ОБНОВЛЕНО: onItemChange теперь работает с числовыми полями ***
 onItemChange: (item: IScheduleItem, field: string, value: string | number) => void;
 
 onAddShift: (date: Date, shiftData?: INewShiftData) => void;
 onDeleteItem: (id: string) => Promise<boolean>;
 onRestoreItem?: (id: string) => Promise<boolean>;
 saveChangesButton?: React.ReactNode;

 // --- НОВЫЕ СВОЙСТВА ДЛЯ ПАГИНАЦИИ ---
 currentPage: number;
 itemsPerPage: number;
 totalItemCount: number;
 rangeStart?: number;        // Начало диапазона отображаемых записей
 rangeEnd?: number;          // Конец диапазона отображаемых записей
 hasNextPage?: boolean;      // Есть ли следующая страница
 onPageChange: (page: number) => void;
 onItemsPerPageChange: (itemsPerPage: number) => void;
 onNextPage?: () => void;    // Обработчик для следующей страницы
 onPreviousPage?: () => void; // Обработчик для предыдущей страницы

 // *** НОВОЕ СВОЙСТВО ДЛЯ ГРУППОВОГО УДАЛЕНИЯ БЕЗ АВТОПЕРЕЗАГРУЗКИ ***
 onBulkDeleteItems?: (ids: string[]) => Promise<{ successCount: number; failedIds: string[] }>;
 onRefreshData?: () => void; // *** ДОБАВЛЯЕМ РУЧНУЮ ПЕРЕЗАГРУЗКУ ***
}

export const ScheduleTable: React.FC<IScheduleTableProps> = (props) => {
 const {
   items,
   options,
   isLoading,
   selectedContract,
   showDeleted,
   onToggleShowDeleted,
   onItemChange,
   onAddShift,
   onDeleteItem,
   onRestoreItem,
   saveChangesButton,

   // Новые свойства пагинации
   currentPage,
   itemsPerPage,
   totalItemCount,
   rangeStart,
   rangeEnd,
   hasNextPage,
   onPageChange,
   onItemsPerPageChange,
   onNextPage,
   onPreviousPage,

   // *** НОВЫЕ СВОЙСТВА ДЛЯ ОПТИМИЗИРОВАННОГО ГРУППОВОГО УДАЛЕНИЯ ***
   onBulkDeleteItems,
   onRefreshData,
 } = props;

 const [selectAllRows, setSelectAllRows] = useState<boolean>(false);
 const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
 const [calculatedWorkTimes, setCalculatedWorkTimes] = useState<Record<string, string>>({});

 const [confirmDialogProps, setConfirmDialogProps] = useState({
   isOpen: false,
   title: '',
   message: '',
   confirmButtonText: '',
   cancelButtonText: 'Cancel',
   onConfirm: () => {},
   confirmButtonColor: ''
 });

 const pendingActionItemIdRef = useRef<string | undefined>(undefined);
 const pendingShiftDataRef = useRef<INewShiftData | undefined>(undefined);

 // *** ИСПРАВЛЕНО: ПРАВИЛЬНАЯ ИНИЦИАЛИЗАЦИЯ calculatedWorkTimes ДЛЯ ВСЕХ ЭЛЕМЕНТОВ ***
 useEffect(() => {
   console.log('[ScheduleTable] *** FIXED: Initializing calculated work times for ALL items ***');
   console.log('[ScheduleTable] Items count:', items.length);
   
   const initialWorkTimes: Record<string, string> = {};
   
   items.forEach((item, index) => {
     console.log(`[ScheduleTable] *** CALCULATING WORK TIME FOR ITEM ${index + 1}/${items.length} ***`);
     console.log(`[ScheduleTable] Item ID: ${item.id}`);
     
     // *** ПРИОРИТЕТ ЧИСЛОВЫХ ПОЛЕЙ ДЛЯ РАСЧЕТА ***
     let calculatedTime: string;
     
     if (typeof item.startHours === 'number' && typeof item.startMinutes === 'number' &&
         typeof item.finishHours === 'number' && typeof item.finishMinutes === 'number') {
       
       console.log(`[ScheduleTable] Using numeric fields: ${item.startHours}:${item.startMinutes} - ${item.finishHours}:${item.finishMinutes}`);
       
       // Создаем временный объект с числовыми значениями для расчета
       const tempItem = {
         ...item,
         startHour: item.startHours.toString().padStart(2, '0'),
         startMinute: item.startMinutes.toString().padStart(2, '0'),
         finishHour: item.finishHours.toString().padStart(2, '0'),
         finishMinute: item.finishMinutes.toString().padStart(2, '0')
       };
       
       calculatedTime = calculateItemWorkTime(tempItem);
       console.log(`[ScheduleTable] Calculated from numeric fields: ${calculatedTime}`);
       
     } else {
       console.log(`[ScheduleTable] Using string fields: ${item.startHour}:${item.startMinute} - ${item.finishHour}:${item.finishMinute}`);
       calculatedTime = calculateItemWorkTime(item);
       console.log(`[ScheduleTable] Calculated from string fields: ${calculatedTime}`);
     }
     
     // *** ВАЖНО: Всегда устанавливаем рассчитанное время, даже если оно 0.00 ***
     initialWorkTimes[item.id] = calculatedTime;
     
     console.log(`[ScheduleTable] Set calculated time for item ${item.id}: ${calculatedTime}`);
     
     // Логируем детали для первых нескольких элементов
     if (index < 3) {
       console.log(`[ScheduleTable] Item ${index + 1} details:`, {
         id: item.id,
         originalWorkingHours: item.workingHours,
         calculatedWorkTime: calculatedTime,
         startTime: `${item.startHour || item.startHours}:${item.startMinute || item.startMinutes}`,
         finishTime: `${item.finishHour || item.finishHours}:${item.finishMinute || item.finishMinutes}`,
         lunchTime: item.lunchTime,
         deleted: item.deleted
       });
     }
   });
   
   console.log(`[ScheduleTable] *** INITIALIZATION COMPLETE: Set work times for ${Object.keys(initialWorkTimes).length} items ***`);
   
   // Логируем несколько примеров для проверки
   const sampleIds = Object.keys(initialWorkTimes).slice(0, 3);
   sampleIds.forEach(id => {
     console.log(`[ScheduleTable] Sample: ${id} -> ${initialWorkTimes[id]}`);
   });
   
   setCalculatedWorkTimes(initialWorkTimes);

   setSelectAllRows(false);
   setSelectedRows(new Set());
 }, [items]);

 const handleSelectAllRows = useCallback((checked: boolean): void => {
   console.log('[ScheduleTable] handleSelectAllRows called with:', checked);
   setSelectAllRows(checked);
   setSelectedRows(checked ? new Set(items.map(item => item.id)) : new Set());
 }, [items]);

 const showDeleteConfirmDialog = useCallback((itemId: string): void => {
   console.log(`[ScheduleTable] Setting up delete for item ID: ${itemId}`);
   pendingActionItemIdRef.current = itemId;

   setConfirmDialogProps({
     isOpen: true,
     title: 'Confirm Deletion',
     message: 'Are you sure you want to delete this schedule item? It will be marked as deleted but can be restored later.',
     confirmButtonText: 'Delete',
     cancelButtonText: 'Cancel',
     onConfirm: () => {
       const itemId = pendingActionItemIdRef.current;
       if (itemId && onDeleteItem) {
         onDeleteItem(itemId)
           .then(() => {
             console.log(`[ScheduleTable] Item ${itemId} deleted successfully`);
              setSelectedRows(prev => {
                  const next = new Set(prev);
                  next.delete(itemId);
                  return next;
              });
             setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
             pendingActionItemIdRef.current = undefined;
           })
           .catch(err => {
             console.error(`[ScheduleTable] Error deleting item ${itemId}:`, err);
             setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
             pendingActionItemIdRef.current = undefined;
           });
       } else {
           console.error('[ScheduleTable] onDeleteItem is not available or itemId is missing');
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
            pendingActionItemIdRef.current = undefined;
       }
     },
     confirmButtonColor: '#d83b01'
   });
 }, [onDeleteItem]);

 const showAddShiftConfirmDialog = useCallback((item: IScheduleItem): void => {
   console.log(`[ScheduleTable] Setting up add shift for date: ${item.date.toLocaleDateString()}`);
    if (!onAddShift) {
        console.error('[ScheduleTable] onAddShift handler is not available');
        return;
    }

   pendingShiftDataRef.current = {
     date: new Date(item.date),
     timeForLunch: item.lunchTime,
     contract: item.contract,
     contractNumber: item.contractNumber,
     typeOfLeave: item.typeOfLeave,
     Holiday: item.Holiday
   };

   setConfirmDialogProps({
     isOpen: true,
     title: 'Confirm Add Shift',
     message: `Are you sure you want to add a new shift on ${item.date.toLocaleDateString()}?`,
     confirmButtonText: 'Add Shift',
     cancelButtonText: 'Cancel',
     onConfirm: () => {
       const shiftData = pendingShiftDataRef.current;
       if (shiftData && onAddShift) {
         onAddShift(shiftData.date, shiftData);
         setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
         pendingShiftDataRef.current = undefined;
       } else {
          console.error('[ScheduleTable] onAddShift handler or shiftData is missing');
           setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingShiftDataRef.current = undefined;
       }
     },
     confirmButtonColor: '#107c10'
   });
 }, [onAddShift]);

 const showRestoreConfirmDialog = useCallback((itemId: string): void => {
   console.log(`[ScheduleTable] Setting up restore for item ID: ${itemId}`);
   if (!onRestoreItem) {
     console.error('[ScheduleTable] Restore handler is not available');
     return;
   }

   pendingActionItemIdRef.current = itemId;

   setConfirmDialogProps({
     isOpen: true,
     title: 'Confirm Restore',
     message: 'Are you sure you want to restore this deleted schedule item?',
     confirmButtonText: 'Restore',
     cancelButtonText: 'Cancel',
     onConfirm: () => {
       const itemId = pendingActionItemIdRef.current;
       if (itemId && onRestoreItem) {
         onRestoreItem(itemId)
           .then(() => {
             console.log(`[ScheduleTable] Item ${itemId} restored successfully`);
             setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
             pendingActionItemIdRef.current = undefined;
           })
           .catch(err => {
             console.error(`[ScheduleTable] Error restoring item ${itemId}:`, err);
             setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
             pendingActionItemIdRef.current = undefined;
           });
       } else {
          console.error('[ScheduleTable] onRestoreItem is not available or itemId is missing');
          setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingActionItemIdRef.current = undefined;
       }
     },
     confirmButtonColor: '#107c10'
   });
 }, [onRestoreItem]);

 // *** ОПТИМИЗИРОВАННАЯ ФУНКЦИЯ ГРУППОВОГО УДАЛЕНИЯ БЕЗ МЕЛЬКАНИЯ ***
 const handleDeleteSelected = useCallback((): void => {
   console.log(`[ScheduleTable] handleDeleteSelected called for ${selectedRows.size} selected items on current page.`);
   if (selectedRows.size === 0) {
     console.log('[ScheduleTable] No items selected for deletion.');
     return;
   }

   const selectedIds = Array.from(selectedRows);
   console.log(`[ScheduleTable] Setting up optimized bulk delete for ${selectedIds.length} items:`, selectedIds);

   setConfirmDialogProps({
     isOpen: true,
     title: 'Confirm Bulk Deletion',
     message: `Are you sure you want to delete ${selectedIds.length} selected schedule items? They will be marked as deleted but can be restored later.`,
     confirmButtonText: `Delete ${selectedIds.length} Items`,
     cancelButtonText: 'Cancel',
     onConfirm: async () => {
       console.log(`[ScheduleTable] *** STARTING OPTIMIZED BULK DELETION ***`);
       console.log(`[ScheduleTable] User confirmed bulk deletion of ${selectedIds.length} items`);
       
       // *** ИСПОЛЬЗУЕМ ОПТИМИЗИРОВАННУЮ ВЕРСИЮ ЕСЛИ ДОСТУПНА ***
       if (onBulkDeleteItems) {
         console.log(`[ScheduleTable] Using optimized bulk delete function`);
         
         try {
           const result = await onBulkDeleteItems(selectedIds);
           console.log(`[ScheduleTable] *** BULK DELETION COMPLETED ***`);
           console.log(`[ScheduleTable] Success: ${result.successCount}/${selectedIds.length}, Failed: ${result.failedIds.length}`);
           
           if (result.failedIds.length > 0) {
             console.error('[ScheduleTable] Failed to delete items:', result.failedIds);
           }

           // *** ОЧИЩАЕМ ВЫБРАННЫЕ СТРОКИ ***
           setSelectedRows(new Set());
           setSelectAllRows(false);

           // *** ЗАКРЫВАЕМ ДИАЛОГ ***
           setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));

           // *** ОДНА ПЕРЕЗАГРУЗКА В КОНЦЕ ***
           if (onRefreshData) {
             console.log(`[ScheduleTable] *** SINGLE REFRESH AFTER BULK DELETION ***`);
             onRefreshData();
           }

         } catch (error) {
           console.error('[ScheduleTable] Error during bulk deletion:', error);
           setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
         }
         
       } else {
         // *** FALLBACK: СТАРАЯ ЛОГИКА С МНОЖЕСТВЕННЫМИ ПЕРЕЗАГРУЗКАМИ ***
         console.log(`[ScheduleTable] onBulkDeleteItems not available, using fallback method`);
         
         if (!onDeleteItem) {
           console.error('[ScheduleTable] onDeleteItem is not available for bulk deletion');
           setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
           return;
         }

         let successCount = 0;
         const failedIds: string[] = [];

         for (const itemId of selectedIds) {
           try {
             console.log(`[ScheduleTable] Deleting item ${successCount + 1}/${selectedIds.length}: ${itemId}`);
             const success = await onDeleteItem(itemId);
             
             if (success) {
               successCount++;
               console.log(`[ScheduleTable] ✓ Successfully deleted item ${itemId} (${successCount}/${selectedIds.length})`);
             } else {
               failedIds.push(itemId);
               console.error(`[ScheduleTable] ✗ Failed to delete item ${itemId}`);
             }
           } catch (error) {
             failedIds.push(itemId);
             console.error(`[ScheduleTable] ✗ Error deleting item ${itemId}:`, error);
           }
           
           // Небольшая пауза между удалениями для предотвращения перегрузки сервера
           if (selectedIds.length > 1) {
             await new Promise(resolve => setTimeout(resolve, 100));
           }
         }

         console.log(`[ScheduleTable] Fallback bulk deletion completed: ${successCount}/${selectedIds.length} successful, ${failedIds.length} failed`);
         
         if (failedIds.length > 0) {
           console.error('[ScheduleTable] Failed to delete items:', failedIds);
         }

         // *** ОЧИЩАЕМ ВЫБРАННЫЕ СТРОКИ ***
         setSelectedRows(new Set());
         setSelectAllRows(false);

         // *** ЗАКРЫВАЕМ ДИАЛОГ ***
         setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
       }
     },
     confirmButtonColor: '#d83b01'
   });
 }, [selectedRows, onBulkDeleteItems, onDeleteItem, onRefreshData]);

 // *** ИСПРАВЛЕНО: getDisplayWorkTime теперь всегда возвращает правильное значение ***
 const getDisplayWorkTime = useCallback((item: IScheduleItem): string => {
   // Сначала проверяем, есть ли рассчитанное время для этого элемента
   if (calculatedWorkTimes[item.id] !== undefined) {
     console.log(`[ScheduleTable] getDisplayWorkTime for ${item.id}: using calculated time ${calculatedWorkTimes[item.id]}`);
     return calculatedWorkTimes[item.id];
   }
   
   // Если рассчитанного времени нет, рассчитываем его сейчас
   console.log(`[ScheduleTable] getDisplayWorkTime for ${item.id}: calculating on-demand`);
   
   let calculatedTime: string;
   
   if (typeof item.startHours === 'number' && typeof item.startMinutes === 'number' &&
       typeof item.finishHours === 'number' && typeof item.finishMinutes === 'number') {
     
     // Создаем временный объект с числовыми значениями для расчета
     const tempItem = {
       ...item,
       startHour: item.startHours.toString().padStart(2, '0'),
       startMinute: item.startMinutes.toString().padStart(2, '0'),
       finishHour: item.finishHours.toString().padStart(2, '0'),
       finishMinute: item.finishMinutes.toString().padStart(2, '0')
     };
     
     calculatedTime = calculateItemWorkTime(tempItem);
   } else {
     calculatedTime = calculateItemWorkTime(item);
   }
   
   // Сохраняем рассчитанное время для будущих вызовов
   setCalculatedWorkTimes(prev => ({
     ...prev,
     [item.id]: calculatedTime
   }));
   
   console.log(`[ScheduleTable] On-demand calculated time for ${item.id}: ${calculatedTime}`);
   return calculatedTime;
 }, [calculatedWorkTimes]);

 const handleDismissDialog = useCallback((): void => {
   setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
   pendingActionItemIdRef.current = undefined;
   pendingShiftDataRef.current = undefined;
 }, []);

 // *** ОБНОВЛЕННАЯ ФУНКЦИЯ handleTimeChange ДЛЯ РАБОТЫ С ЧИСЛОВЫМИ ПОЛЯМИ ***
 const handleTimeChange = useCallback((item: IScheduleItem, field: string, value: string): void => {
   if (item.deleted) { return; }
   
   console.log(`[ScheduleTable] *** TIME CHANGE WITH IMMEDIATE WORK TIME RECALCULATION ***`);
   console.log(`[ScheduleTable] Field: ${field}, Value: ${value}, Item ID: ${item.id}`);
   
   // *** СОЗДАЕМ ОБНОВЛЕННЫЙ ЭЛЕМЕНТ С СИНХРОНИЗАЦИЕЙ ПОЛЕЙ ***
   const updatedItem = { ...item };
   
   // Обновляем строковое поле для UI (явная типизация для каждого поля)
   switch (field) {
     case 'startHour':
       updatedItem.startHour = value;
       break;
     case 'startMinute':
       updatedItem.startMinute = value;
       break;
     case 'finishHour':
       updatedItem.finishHour = value;
       break;
     case 'finishMinute':
       updatedItem.finishMinute = value;
       break;
     default:
       console.warn(`[ScheduleTable] Unknown time field: ${field}`);
       return;
   }
   
   // *** СИНХРОНИЗИРУЕМ ЧИСЛОВЫЕ ПОЛЯ ***
   const numericValue = parseInt(value, 10);
   if (!isNaN(numericValue)) {
     switch (field) {
       case 'startHour':
         updatedItem.startHours = numericValue;
         console.log(`[ScheduleTable] Updated startHours to: ${numericValue}`);
         break;
       case 'startMinute':
         updatedItem.startMinutes = numericValue;
         console.log(`[ScheduleTable] Updated startMinutes to: ${numericValue}`);
         break;
       case 'finishHour':
         updatedItem.finishHours = numericValue;
         console.log(`[ScheduleTable] Updated finishHours to: ${numericValue}`);
         break;
       case 'finishMinute':
         updatedItem.finishMinutes = numericValue;
         console.log(`[ScheduleTable] Updated finishMinutes to: ${numericValue}`);
         break;
     }
   }
   
   // *** НЕМЕДЛЕННО ПЕРЕСЧИТЫВАЕМ РАБОЧЕЕ ВРЕМЯ ***
   const workTime = calculateItemWorkTime(updatedItem);
   updatedItem.workingHours = workTime;

   console.log(`[ScheduleTable] *** IMMEDIATE WORK TIME RECALCULATION: ${workTime} ***`);
   console.log(`[ScheduleTable] Time components: ${updatedItem.startHour}:${updatedItem.startMinute} - ${updatedItem.finishHour}:${updatedItem.finishMinute}`);
   console.log(`[ScheduleTable] Numeric fields: start(${updatedItem.startHours}:${updatedItem.startMinutes}) - finish(${updatedItem.finishHours}:${updatedItem.finishMinutes})`);

   // *** НЕМЕДЛЕННО ОБНОВЛЯЕМ calculatedWorkTimes ДЛЯ ЭТОГО ЭЛЕМЕНТА ***
   setCalculatedWorkTimes(prev => {
     const updated = {
       ...prev,
       [item.id]: workTime
     };
     console.log(`[ScheduleTable] Updated calculatedWorkTimes for ${item.id}: ${workTime}`);
     return updated;
   });
   
   // *** УВЕДОМЛЯЕМ РОДИТЕЛЬСКИЙ КОМПОНЕНТ О ВСЕХ ИЗМЕНЕНИЯХ ***
   onItemChange(updatedItem, field, value);
   onItemChange(updatedItem, 'workingHours', workTime);
   
   // *** ТАКЖЕ УВЕДОМЛЯЕМ О ЧИСЛОВЫХ ПОЛЯХ ***
   if (!isNaN(numericValue)) {
     switch (field) {
       case 'startHour':
         onItemChange(updatedItem, 'startHours', numericValue);
         break;
       case 'startMinute':
         onItemChange(updatedItem, 'startMinutes', numericValue);
         break;
       case 'finishHour':
         onItemChange(updatedItem, 'finishHours', numericValue);
         break;
       case 'finishMinute':
         onItemChange(updatedItem, 'finishMinutes', numericValue);
         break;
     }
   }
 }, [calculatedWorkTimes, onItemChange]);

 const handleContractNumberChange = useCallback((item: IScheduleItem, value: string): void => {
   if (item.deleted) { return; }
   onItemChange(item, 'contractNumber', value);
 }, [onItemChange]);

 const handleLunchTimeChange = useCallback((item: IScheduleItem, value: string): void => {
   if (item.deleted) { return; }
   const updatedItem = { ...item, lunchTime: value };
   
   // *** НЕМЕДЛЕННО ПЕРЕСЧИТЫВАЕМ РАБОЧЕЕ ВРЕМЯ ПРИ ИЗМЕНЕНИИ ОБЕДА ***
   const workTime = calculateItemWorkTime(updatedItem);

   console.log(`[ScheduleTable] *** LUNCH TIME CHANGED - RECALCULATING WORK TIME ***`);
   console.log(`[ScheduleTable] New lunch time: ${value}, New work time: ${workTime}`);

   // *** ОБНОВЛЯЕМ calculatedWorkTimes ***
   setCalculatedWorkTimes(prev => ({
     ...prev,
     [item.id]: workTime
   }));
   
   onItemChange(updatedItem, 'lunchTime', value);
   onItemChange(updatedItem, 'workingHours', workTime);
 }, [calculatedWorkTimes, onItemChange]);

 // --- НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ПАГИНАЦИИ ---
 const handleItemsPerPageChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
     if (option) {
          const newItemsPerPage = Number(option.key);
          console.log('[ScheduleTable] handleItemsPerPageChange called with:', newItemsPerPage);
          onItemsPerPageChange(newItemsPerPage);
     }
 }, [onItemsPerPageChange]);

 const handlePreviousPage = useCallback(() => {
   if (onPreviousPage) {
     onPreviousPage();
   } else if (currentPage > 1) {
     onPageChange(currentPage - 1);
   }
 }, [onPreviousPage, currentPage, onPageChange]);

 const handleNextPage = useCallback(() => {
   if (onNextPage) {
     onNextPage();
   } else {
     onPageChange(currentPage + 1);
   }
 }, [onNextPage, currentPage, onPageChange]);

 // Новые опции для выбора количества записей на страницу (только 60 и 90)
 const newItemsPerPageOptions: IDropdownOption[] = [
   { key: 60, text: '60' },
   { key: 90, text: '90' },
 ];

 // --- ИСПРАВЛЕНИЕ: Вычисляем состояние пагинации локально ---
 const calculatedHasNextPage = (currentPage * itemsPerPage) < totalItemCount;
 const calculatedHasPreviousPage = currentPage > 1;

 console.log('[ScheduleTable] Pagination state:', {
   currentPage,
   itemsPerPage, 
   totalItemCount,
   calculatedHasNextPage,
   calculatedHasPreviousPage,
   propsHasNextPage: hasNextPage,
   calculation: `(${currentPage} * ${itemsPerPage}) < ${totalItemCount} = ${currentPage * itemsPerPage} < ${totalItemCount} = ${calculatedHasNextPage}`
 });

 return (
   <div className={styles.scheduleTab}>
     <ScheduleTableHeader
       selectAllRows={selectAllRows}
       selectedRows={selectedRows}
       showDeleted={showDeleted}
       onSelectAllRows={handleSelectAllRows}
       onDeleteSelected={handleDeleteSelected}
       onToggleShowDeleted={onToggleShowDeleted}
       saveChangesButton={saveChangesButton}
     />

     <ScheduleTableContent
       items={items}
       options={options}
       isLoading={isLoading}
       selectedContract={selectedContract}
       showDeleteConfirmDialog={showDeleteConfirmDialog}
       showAddShiftConfirmDialog={showAddShiftConfirmDialog}
       showRestoreConfirmDialog={showRestoreConfirmDialog}
       onRestoreItem={onRestoreItem}
       getDisplayWorkTime={getDisplayWorkTime}
       onItemChange={handleTimeChange}
       onContractNumberChange={handleContractNumberChange}
       onLunchTimeChange={handleLunchTimeChange}
       onAddShift={onAddShift}
     />

     {/* --- ИСПРАВЛЕННАЯ ПАГИНАЦИЯ --- */}
     {totalItemCount > 0 && (
       <div className="pagination-container" style={{
         display: 'flex',
         justifyContent: 'space-between',
         alignItems: 'center',
         padding: '16px 0',
         borderTop: '1px solid #e0e0e0',
         marginTop: '16px'
       }}>
         {/* Информация о записях */}
         <div className="records-info">
           <Text variant="medium">
             {totalItemCount > 0 && rangeStart && rangeEnd
               ? `Records ${rangeStart}-${rangeEnd} of ${totalItemCount}` 
               : totalItemCount > 0 
                 ? `Total records: ${totalItemCount}`
                 : "No records"}
           </Text>
         </div>
         
         {/* Выбор количества записей на страницу */}
         <div className="items-per-page" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
           <Text variant="medium">Items per page:</Text>
           <Dropdown
             selectedKey={itemsPerPage}
             options={newItemsPerPageOptions}
             onChange={handleItemsPerPageChange}
             disabled={isLoading}
             styles={{ 
               root: { width: '80px' },
               dropdown: { minWidth: '80px' }
             }}
           />
         </div>
         
         {/* Навигация по страницам */}
         <div className="navigation-buttons" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
           <DefaultButton
             text="Previous"
             onClick={handlePreviousPage}
             disabled={!calculatedHasPreviousPage || isLoading}
             styles={{ 
               root: { 
                 minWidth: '80px',
                 backgroundColor: !calculatedHasPreviousPage ? '#f5f5f5' : '#fff'
               }
             }}
           />
           
           <Text variant="medium" style={{ minWidth: '120px', textAlign: 'center' }}>
             Page {currentPage}
           </Text>
           
           <DefaultButton
             text="Next"
             onClick={handleNextPage}
             disabled={!calculatedHasNextPage || isLoading}
             styles={{ 
               root: { 
                 minWidth: '80px',
                 backgroundColor: !calculatedHasNextPage ? '#f5f5f5' : '#fff'
               }
             }}
           />
         </div>
       </div>
     )}

     <ScheduleTableDialogs
       confirmDialogProps={confirmDialogProps}
       onDismiss={handleDismissDialog}
     />
   </div>
 );
};

export default ScheduleTable;