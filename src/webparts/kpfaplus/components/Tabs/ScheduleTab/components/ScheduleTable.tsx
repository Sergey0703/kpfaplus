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

export interface IScheduleItem {
  id: string;
  date: Date;
  dayOfWeek: string;
  workingHours: string;
  startHour: string;
  startMinute: string;
  finishHour: string;
  finishMinute: string;
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

  useEffect(() => {
    console.log('[ScheduleTable] Effect: items array changed. Initializing calculated work times and resetting selection.');
    const initialWorkTimes: Record<string, string> = {};
    items.forEach(item => {
      initialWorkTimes[item.id] = item.workingHours;
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

  const handleDeleteSelected = useCallback((): void => {
      console.log(`[ScheduleTable] handleDeleteSelected called for ${selectedRows.size} selected items on current page.`);
       if (selectedRows.size === 0) {
           console.log('[ScheduleTable] No items selected for deletion.');
           return;
       }
      selectedRows.forEach(id => {
        showDeleteConfirmDialog(id);
      });
  }, [selectedRows, showDeleteConfirmDialog]);

  const getDisplayWorkTime = useCallback((item: IScheduleItem): string => {
    if (calculatedWorkTimes[item.id]) {
      return calculatedWorkTimes[item.id];
    }
    return item.workingHours;
  }, [calculatedWorkTimes]);

  const handleDismissDialog = useCallback((): void => {
    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
    pendingActionItemIdRef.current = undefined;
    pendingShiftDataRef.current = undefined;
  }, []);

  const handleTimeChange = useCallback((item: IScheduleItem, field: string, value: string): void => {
    if (item.deleted) { return; }
    const updatedItem = { ...item, [field]: value };
    const workTime = calculateItemWorkTime(updatedItem);

    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));
    onItemChange(updatedItem, field, value);
    onItemChange(updatedItem, 'workingHours', workTime);
  }, [calculatedWorkTimes, onItemChange]);

  const handleContractNumberChange = useCallback((item: IScheduleItem, value: string): void => {
    if (item.deleted) { return; }
    onItemChange(item, 'contractNumber', value);
  }, [onItemChange]);

  const handleLunchTimeChange = useCallback((item: IScheduleItem, value: string): void => {
    if (item.deleted) { return; }
    const updatedItem = { ...item, lunchTime: value };
    const workTime = calculateItemWorkTime(updatedItem);

    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));
    onItemChange(updatedItem, 'lunchTime', value);
    onItemChange(updatedItem, 'workingHours', workTime);
  }, [calculatedWorkTimes, onItemChange]);

  // --- ЗАКОММЕНТИРОВАННАЯ СТАРАЯ ПАГИНАЦИЯ ---
  /*
  const totalPages = Math.max(1, Math.ceil(totalItemCount / itemsPerPage));

   const itemsPerPageOptions: IDropdownOption[] = [
       { key: 10, text: '10' },
       { key: 20, text: '20' },
       { key: 50, text: '50' },
       { key: 100, text: '100' },
       { key: totalItemCount > 100 ? totalItemCount : 101, text: `All (${totalItemCount})` },
   ];
  */

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

      {/* --- НОВАЯ ПАГИНАЦИЯ (60/90 записей) --- */}
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
              disabled={currentPage <= 1 || isLoading}
              styles={{ 
                root: { 
                  minWidth: '80px',
                  backgroundColor: currentPage <= 1 ? '#f5f5f5' : '#fff'
                }
              }}
            />
            
            <Text variant="medium" style={{ minWidth: '120px', textAlign: 'center' }}>
              Page {currentPage}
            </Text>
            
            <DefaultButton
              text="Next"
              onClick={handleNextPage}
              disabled={!hasNextPage || isLoading}
              styles={{ 
                root: { 
                  minWidth: '80px',
                  backgroundColor: !hasNextPage ? '#f5f5f5' : '#fff'
                }
              }}
            />
          </div>
        </div>
      )}

      {/* --- ЗАКОММЕНТИРОВАННАЯ СТАРАЯ ПАГИНАЦИЯ ---
       {totalItemCount > 0 && (
           <Stack horizontal tokens={stackTokens} verticalAlign="center" horizontalAlign="space-between" style={{ marginTop: '16px' }}>

               <Stack.Item>
                   <Text variant="medium">
                       {totalItemCount} items total
                   </Text>
               </Stack.Item>

               {totalItemCount > 10 && (
                   <Stack.Item>
                       <Stack horizontal tokens={{ childrenGap: 5 }} verticalAlign="center">
                           <Text variant="medium">Items per page:</Text>
                           <Dropdown
                               selectedKey={itemsPerPage}
                               options={itemsPerPageOptions}
                               onChange={handleItemsPerPageChange}
                               disabled={isLoading}
                               styles={{ root: { width: '80px' } }}
                           />
                       </Stack>
                   </Stack.Item>
               )}

                {totalPages > 1 && (
                    <Stack.Item>
                        <Stack horizontal tokens={{ childrenGap: 5 }} verticalAlign="center">
                            <DefaultButton
                                text="Previous"
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage <= 1 || isLoading}
                                styles={{ root: { minWidth: '80px' } }}
                            />
                            <Text variant="medium" style={{ minWidth: '100px', textAlign: 'center' }}>
                                Page {currentPage} of {totalPages}
                            </Text>
                            <DefaultButton
                                text="Next"
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage >= totalPages || isLoading}
                                 styles={{ root: { minWidth: '80px' } }}
                            />
                        </Stack>
                    </Stack.Item>
                 )}
           </Stack>
       )}
      */}

      <ScheduleTableDialogs
        confirmDialogProps={confirmDialogProps}
        onDismiss={handleDismissDialog}
      />
    </div>
  );
};

export default ScheduleTable;