// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTable.tsx
import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react'; // Import useCallback
import styles from '../ScheduleTab.module.scss'; // Corrected path
import { ScheduleTableHeader } from './ScheduleTableHeader'; // Corrected path
import { ScheduleTableContent } from './ScheduleTableContent'; // Corrected path
import { ScheduleTableDialogs } from './ScheduleTableDialogs'; // Corrected path
import { calculateItemWorkTime } from './ScheduleTableUtils'; // Corrected path

// Импортируем нужные компоненты из @fluentui/react
import {
  IDropdownOption, // Used in IScheduleOptions
  Dropdown, // Used in JSX
  Stack, // Used in JSX
  IStackTokens, // Used for Stack tokens
  Text, // Used in JSX
  DefaultButton, // Used in JSX
} from '@fluentui/react';

// --- Интерфейсы (обновлены) ---
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
  Holiday?: number; // Holiday остается с большой буквы, т.к. так в IStaffRecord
}

// --- ИСПРАВЛЕНИЕ INewShiftData ---
export interface INewShiftData {
  date: Date;
  timeForLunch: string;
  contract: string;
  contractNumber?: string;
  typeOfLeave?: string;
  // Исправлено: Holiday с большой буквы для консистентности с IScheduleItem
  Holiday?: number; // <-- ИСПРАВЛЕНО: Большая буква
}
// -------------------------------------------


export interface IScheduleOptions {
  hours: IDropdownOption[];
  minutes: IDropdownOption[];
  lunchTimes: IDropdownOption[];
  leaveTypes: IDropdownOption[];
  contractNumbers?: IDropdownOption[];
}


// --- ОБНОВЛЕННЫЙ ИНТЕРФЕЙС СВОЙСТВ КОМПОНЕНТА ScheduleTable ---
export interface IScheduleTableProps {
  items: IScheduleItem[]; // Items for the current page ONLY
  options: IScheduleOptions;
  selectedDate: Date;
  selectedContract?: { id: string; name: string };
  isLoading: boolean; // Table specific loading
  showDeleted: boolean; // State of the "Show Deleted" toggle
  onToggleShowDeleted: (checked: boolean) => void; // Handler for the "Show Deleted" toggle
  onItemChange: (item: IScheduleItem, field: string, value: string | number) => void;
  onAddShift: (date: Date, shiftData?: INewShiftData) => void;
  onDeleteItem: (id: string) => Promise<void>;
  onRestoreItem?: (id: string) => Promise<void>;
  saveChangesButton?: React.ReactNode; // Button to save pending changes

  // --- ДОБАВЛЕНО ДЛЯ СЕРВЕРНОЙ ПАГИНАЦИИ ---
  currentPage: number;       // Текущая страница
  itemsPerPage: number;      // Количество элементов на странице
  totalItemCount: number;    // Общее количество элементов (соответствующих фильтру)
  onPageChange: (page: number) => void;           // Обработчик смены страницы
  onItemsPerPageChange: (itemsPerPage: number) => void; // Обработчик смены количества элементов на странице
  // ---------------------------------------
}

export const ScheduleTable: React.FC<IScheduleTableProps> = (props) => {
  const {
    items, // Items for the current page
    options,
    isLoading, // Table specific loading
    selectedContract,
    showDeleted,
    onToggleShowDeleted,
    onItemChange, // Handler to notify parent about local changes
    onAddShift, // Handler from parent (via orchestrator/mutation hook)
    onDeleteItem, // Handler from parent (via orchestrator/mutation hook)
    onRestoreItem, // Handler from parent (via orchestrator/mutation hook)
    saveChangesButton,

    // --- ПРОПСЫ ПАГИНАЦИИ ---
    currentPage,
    itemsPerPage,
    totalItemCount,
    onPageChange, // <-- Обработчик смены страницы
    onItemsPerPageChange, // <-- Обработчик смены количества элементов на странице
    // -----------------------
  } = props;

  // Состояние для выбора всех строк (работает с ID видимых строк)
  const [selectAllRows, setSelectAllRows] = useState<boolean>(false);
  // Состояние для выбранных строк (хранит ID выбранных строк с текущей страницы)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Состояние для локальных расчетов рабочего времени (для мгновенного отображения)
  const [calculatedWorkTimes, setCalculatedWorkTimes] = useState<Record<string, string>>({});

  // Состояние для диалога подтверждения
  const [confirmDialogProps, setConfirmDialogProps] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Cancel',
    onConfirm: () => {},
    confirmButtonColor: ''
  });

  // Используем useRef для ID записи в ожидании действия
  const pendingActionItemIdRef = useRef<string | undefined>(undefined);

  // Используем useRef для данных новой смены
  const pendingShiftDataRef = useRef<INewShiftData | undefined>(undefined);

  // Эффект для инициализации рассчитанных рабочих времен И сброса выбора
  // Срабатывает при изменении массива items (т.е. при смене страницы)
  useEffect(() => {
    console.log('[ScheduleTable] Effect: items array changed. Initializing calculated work times and resetting selection.');
    const initialWorkTimes: Record<string, string> = {};
    items.forEach(item => {
      initialWorkTimes[item.id] = item.workingHours;
    });
    setCalculatedWorkTimes(initialWorkTimes);

    // При смене страницы, сбрасываем локальное состояние выбора всех строк
    setSelectAllRows(false);
    // Сбрасываем выбранные строки - выбор только на текущей странице
    setSelectedRows(new Set());

  }, [items]); // Зависит от массива items (данные текущей страницы)

  // Обработчик выбора/отмены выбора всех строк (только на текущей странице)
  const handleSelectAllRows = useCallback((checked: boolean): void => {
    console.log('[ScheduleTable] handleSelectAllRows called with:', checked);
    setSelectAllRows(checked);

    // Выбираем/снимаем выбор только для элементов НА ТЕКУЩЕЙ СТРАНИЦЕ
    setSelectedRows(checked ? new Set(items.map(item => item.id)) : new Set());

    // Примечание: Если нужен выбор между страницами, selectedRows должно жить выше и включать ID со всех страниц.
    // Логика здесь будет сложнее (добавлять/удалять ID текущей страницы из общего набора).
  }, [items]); // Зависит от массива items

  // Обработчики для диалогов подтверждения удаления и восстановления
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
        // Проверяем наличие onDeleteItem и itemId перед вызовом
        if (itemId && onDeleteItem) {
          onDeleteItem(itemId)
            .then(() => {
              console.log(`[ScheduleTable] Item ${itemId} deleted successfully`);
              // Удаляем элемент из локального списка выбранных, т.к. он удален/помечен как удаленный
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
             setConfirmDialogProps(prev => ({ ...prev, isOpen: false })); // Закрыть диалог даже при ошибке
             pendingActionItemIdRef.current = undefined;
        }
      },
      confirmButtonColor: '#d83b01'
    });
  }, [onDeleteItem]); // Зависит от onDeleteItem

  const showAddShiftConfirmDialog = useCallback((item: IScheduleItem): void => {
    console.log(`[ScheduleTable] Setting up add shift for date: ${item.date.toLocaleDateString()}`);
     // Проверяем наличие onAddShift перед показом диалога
     if (!onAddShift) {
         console.error('[ScheduleTable] onAddShift handler is not available');
         return;
     }

     // --- ИСПРАВЛЕНИЕ Holiday -> Holiday ---
    pendingShiftDataRef.current = {
      date: new Date(item.date),
      timeForLunch: item.lunchTime,
      contract: item.contract, // Assuming item.contract holds the contract number like '1', '2', '3'
      contractNumber: item.contractNumber, // Assuming item.contractNumber holds the dropdown value like '1', '2', '3'
      typeOfLeave: item.typeOfLeave, // Assuming this holds the TypeOfLeaveID
      Holiday: item.Holiday // <-- ИСПРАВЛЕНО: Большая буква для консистентности с IScheduleItem и INewShiftData
    };
    // ----------------------------------------------

    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Add Shift',
      message: `Are you sure you want to add a new shift on ${item.date.toLocaleDateString()}?`,
      confirmButtonText: 'Add Shift',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        const shiftData = pendingShiftDataRef.current;
        // Проверяем наличие shiftData и onAddShift перед вызовом
        if (shiftData && onAddShift) {
          onAddShift(shiftData.date, shiftData);
          setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingShiftDataRef.current = undefined;
        } else {
           console.error('[ScheduleTable] onAddShift handler or shiftData is missing');
            setConfirmDialogProps(prev => ({ ...prev, isOpen: false })); // Закрыть диалог даже при ошибке
           pendingShiftDataRef.current = undefined;
        }
      },
      confirmButtonColor: '#107c10'
    });
  }, [onAddShift]); // Зависит от onAddShift


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
        // Проверяем наличие itemId и onRestoreItem перед вызовом
        if (itemId && onRestoreItem) {
          onRestoreItem(itemId)
            .then(() => {
              console.log(`[ScheduleTable] Item ${itemId} restored successfully`);
               // Если элемент был выбран, возможно, он должен остаться выбранным после восстановления
              // (в зависимости от желаемой логики). Пока не меняем selectedRows.
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
           setConfirmDialogProps(prev => ({ ...prev, isOpen: false })); // Закрыть диалог даже при ошибке
           pendingActionItemIdRef.current = undefined;
        }
      },
      confirmButtonColor: '#107c10'
    });
  }, [onRestoreItem]); // Зависит от onRestoreItem

  // Обработчик для удаления всех выбранных строк (на текущей странице)
  // Этот хендлер вызывает showDeleteConfirmDialog для каждого выбранного ID.
  // Это ОК для небольшого числа выбранных элементов на странице.
  const handleDeleteSelected = useCallback((): void => {
      console.log(`[ScheduleTable] handleDeleteSelected called for ${selectedRows.size} selected items on current page.`);
       // Проверяем, что есть выбранные элементы перед началом удаления
       if (selectedRows.size === 0) {
           console.log('[ScheduleTable] No items selected for deletion.');
           return;
       }
      // Вызываем showDeleteConfirmDialog для каждого выбранного ID
      selectedRows.forEach(id => {
        showDeleteConfirmDialog(id);
      });
       // Note: showDeleteConfirmDialogs handle the actual deletion and selection update.
  }, [selectedRows, showDeleteConfirmDialog]); // Зависит от selectedRows и showDeleteConfirmDialog


  // Функция для получения отображаемого рабочего времени (остается без изменений)
  const getDisplayWorkTime = useCallback((item: IScheduleItem): string => {
    if (calculatedWorkTimes[item.id]) {
      return calculatedWorkTimes[item.id];
    }
    return item.workingHours;
  }, [calculatedWorkTimes]); // Зависит от calculatedWorkTimes

  // Обработчик для закрытия диалога (остается без изменений)
  const handleDismissDialog = useCallback((): void => {
    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
    pendingActionItemIdRef.current = undefined;
    pendingShiftDataRef.current = undefined;
  }, []);


  // Обработчик изменения времени (вызывается ScheduleTableRow)
  const handleTimeChange = useCallback((item: IScheduleItem, field: string, value: string): void => {
    // Проверяем, что запись не удалена
    if (item.deleted) {
      console.log('[ScheduleTable] Attempted to change deleted item, blocking.');
      return; // Не позволяем изменять удаленные записи
    }

    // Создаем копию элемента с новым значением
    const updatedItem = { ...item, [field]: value };

    // Рассчитываем новое рабочее время
    const workTime = calculateItemWorkTime(updatedItem);

    // Обновляем локальное состояние для мгновенного отображения
    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));

    // Уведомляем родителя (ScheduleTabContent) об изменении
    onItemChange(updatedItem, field, value); // Notify parent about the field change
    onItemChange(updatedItem, 'workingHours', workTime); // Also notify parent about the updated workingHours
  }, [calculatedWorkTimes, onItemChange]); // Зависит от calculatedWorkTimes и onItemChange

  // Обработчик изменения контракта (вызывается ScheduleTableRow)
  const handleContractNumberChange = useCallback((item: IScheduleItem, value: string): void => {
    // Проверяем, что запись не удалена
    if (item.deleted) {
       console.log('[ScheduleTable] Attempted to change contract on deleted item, blocking.');
       return; // Не позволяем изменять удаленные записи
    }
    // Уведомляем родителя об изменении
    onItemChange(item, 'contractNumber', value);
  }, [onItemChange]); // Зависит от onItemChange

  // Обработчик изменения времени обеда (вызывается ScheduleTableRow)
  const handleLunchTimeChange = useCallback((item: IScheduleItem, value: string): void => {
     // Проверяем, что запись не удалена
    if (item.deleted) {
       console.log('[ScheduleTable] Attempted to change lunch time on deleted item, blocking.');
       return; // Не позволяем изменять удаленные записи
    }

    // Создаем копию элемента с новым значением
    const updatedItem = { ...item, lunchTime: value };

    // Рассчитываем новое рабочее время
    const workTime = calculateItemWorkTime(updatedItem);

    // Обновляем локальное состояние для мгновенного отображения
    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));

    // Уведомляем родителя об изменении
    onItemChange(updatedItem, 'lunchTime', value); // Notify parent about lunchTime change
    onItemChange(updatedItem, 'workingHours', workTime); // Also notify parent about the updated workingHours
  }, [calculatedWorkTimes, onItemChange]); // Зависит от calculatedWorkTimes и onItemChange


  // --- ПАРАМЕТРЫ ДЛЯ ЭЛЕМЕНТОВ УПРАВЛЕНИЯ ПАГИНАЦИЕЙ ---
  // Рассчитываем общее количество страниц
  const totalPages = Math.max(1, Math.ceil(totalItemCount / itemsPerPage)); // Ensure at least 1 page if items > 0

  // Удаляем неиспользуемую переменную paginationLabel
  // const paginationLabel = `Page ${currentPage} of ${totalPages} (${totalItemCount} items total)`; // Label for pagination control

   const itemsPerPageOptions: IDropdownOption[] = [ // Options for items per page dropdown
       { key: 10, text: '10' },
       { key: 20, text: '20' },
       { key: 50, text: '50' },
       { key: 100, text: '100' },
        // Опция "Все" - если записей <= 100, то 101 как "ключ" позволяет отличить от 100 записей
       { key: totalItemCount > 100 ? totalItemCount : 101, text: `All (${totalItemCount})` }, // Option to show all items
   ];

  const stackTokens: IStackTokens = { childrenGap: 10 }; // Tokens for Stack layout

  // Обработчик смены страницы - вызывает проп onPageChange
  // Используем useCallback для стабильности
  const handlePageChange = useCallback((page: number): void => {
      console.log('[ScheduleTable] handlePageChange called with page:', page);
      // Вызываем проп onPageChange, который пришел от родителя
      onPageChange(page);
  }, [onPageChange]); // Зависит от пропса onPageChange

  // Обработчик смены количества элементов на странице - вызывает проп onItemsPerPageChange
  // Используем useCallback для стабильности
  const handleItemsPerPageChange = useCallback((event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
      if (option) {
           // Преобразуем ключ в число
           const newItemsPerPage = Number(option.key);
           console.log('[ScheduleTable] handleItemsPerPageChange called with:', newItemsPerPage);
           // Вызываем проп onItemsPerPageChange, который пришел от родителя
           onItemsPerPageChange(newItemsPerPage);
      }
  }, [onItemsPerPageChange]); // Зависит от пропса onItemsPerPageChange

  // -------------------------------------------------


  return (
    <div className={styles.scheduleTab}> {/* Используем класс styles.scheduleTab для контейнера */}
      {/* Заголовок и управление */}
      {/* Передаем local state & handlers */}
      <ScheduleTableHeader
        selectAllRows={selectAllRows}
        selectedRows={selectedRows} // Local state
        showDeleted={showDeleted} // Prop from parent
        onSelectAllRows={handleSelectAllRows} // Use local handler (operates on visible items)
        onDeleteSelected={handleDeleteSelected} // Use local handler (calls dialogs)
        onToggleShowDeleted={onToggleShowDeleted} // Prop from parent
        saveChangesButton={saveChangesButton} // Prop from parent
      />

      {/* Контент таблицы */}
      {/* items уже содержат данные для текущей страницы */}
      {/* Передаем local dialog handlers & local item change handlers */}
      <ScheduleTableContent
        items={items} // Pass items for the current page
        options={options} // Options derived from typesOfLeave etc.
        isLoading={isLoading} // Use table's local loading state (if any), or global if passed down
        selectedContract={selectedContract}
        showDeleteConfirmDialog={showDeleteConfirmDialog} // Pass local dialog handler (uses parent's onDeleteItem)
        showAddShiftConfirmDialog={showAddShiftConfirmDialog} // Pass local dialog handler (uses parent's onAddShift)
        showRestoreConfirmDialog={showRestoreConfirmDialog} // Pass local dialog handler (uses parent's onRestoreItem)
        onRestoreItem={onRestoreItem} // Pass parent's onRestoreItem handler (used in dialog handler)
        getDisplayWorkTime={getDisplayWorkTime} // Pass local calculation display function
        onItemChange={handleTimeChange} // Pass local item change handler (calls parent's onItemChange)
        onContractNumberChange={handleContractNumberChange} // Pass local handler (calls parent's onItemChange)
        onLunchTimeChange={handleLunchTimeChange} // Pass local handler (calls parent's onItemChange)
        onAddShift={onAddShift} // Pass parent's onAddShift handler (used in dialog handler)
      />

       {/* --- ЭЛЕМЕНТЫ УПРАВЛЕНИЯ ПАГИНАЦИЕЙ --- */}
       {/* Показываем пагинацию, только если есть элементы и общее количество > 0 */}
       {totalItemCount > 0 && (
           <Stack horizontal tokens={stackTokens} verticalAlign="center" horizontalAlign="space-between" style={{ marginTop: '16px' }}>

               {/* Общее количество элементов */}
               <Stack.Item>
                   <Text variant="medium">
                       {totalItemCount} items total
                   </Text>
               </Stack.Item>

               {/* Элементы на странице */}
               {/* Показываем дропдаун, только если общее количество > 10 (или другое пороговое значение) */}
               {totalItemCount > 10 && (
                   <Stack.Item>
                       <Stack horizontal tokens={{ childrenGap: 5 }} verticalAlign="center">
                           <Text variant="medium">Items per page:</Text>
                           <Dropdown
                               selectedKey={itemsPerPage} // Текущее количество элементов на странице
                               options={itemsPerPageOptions} // Опции для выбора
                               onChange={handleItemsPerPageChange} // Локальный хендлер смены кол-ва
                               disabled={isLoading}
                               styles={{ root: { width: '80px' } }}
                           />
                       </Stack>
                   </Stack.Item>
               )}

               {/* Контролы пагинации (простые кнопки) */}
                {/* Показываем кнопки пагинации, только если страниц > 1 */}
                {totalPages > 1 && (
                    <Stack.Item>
                        <Stack horizontal tokens={{ childrenGap: 5 }} verticalAlign="center">
                            <DefaultButton
                                text="Previous"
                                onClick={() => handlePageChange(currentPage - 1)} // Вызываем локальный хендлер
                                disabled={currentPage <= 1 || isLoading}
                                styles={{ root: { minWidth: '80px' } }}
                            />
                            <Text variant="medium" style={{ minWidth: '100px', textAlign: 'center' }}>
                                Page {currentPage} of {totalPages}
                            </Text>
                            <DefaultButton
                                text="Next"
                                onClick={() => handlePageChange(currentPage + 1)} // Вызываем локальный хендлер
                                disabled={currentPage >= totalPages || isLoading}
                                 styles={{ root: { minWidth: '80px' } }}
                            />
                        </Stack>
                    </Stack.Item>
                 )}
           </Stack>
       )}
       {/* ----------------------------------- */}


      {/* Диалоги подтверждения */}
      {/* Передаем локальное состояние диалога и локальный обработчик закрытия */}
      <ScheduleTableDialogs
        confirmDialogProps={confirmDialogProps}
        onDismiss={handleDismissDialog}
      />
    </div>
  );
};

export default ScheduleTable;