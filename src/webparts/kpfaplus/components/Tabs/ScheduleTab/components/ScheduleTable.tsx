// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTable.tsx
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import styles from '../ScheduleTab.module.scss';
import { ScheduleTableHeader } from './ScheduleTableHeader';
import { ScheduleTableContent } from './ScheduleTableContent';
import { ScheduleTableDialogs } from './ScheduleTableDialogs';
import { calculateItemWorkTime } from './ScheduleTableUtils';

// Интерфейс для записи о расписании (из оригинального файла)
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
}

// Опции для выпадающих списков (из оригинального файла)
export interface IScheduleOptions {
  hours: IDropdownOption[];
  minutes: IDropdownOption[];
  lunchTimes: IDropdownOption[];
  leaveTypes: IDropdownOption[];
  contractNumbers?: IDropdownOption[];
}

// Импортируем IDropdownOption из @fluentui/react
import { IDropdownOption } from '@fluentui/react';

// Интерфейс свойств компонента (из оригинального файла)
export interface IScheduleTableProps {
  items: IScheduleItem[];
  options: IScheduleOptions;
  selectedDate: Date;
  selectedContract?: { id: string; name: string };
  isLoading: boolean;
  showDeleted: boolean;
  onToggleShowDeleted: (checked: boolean) => void;
  onItemChange: (item: IScheduleItem, field: string, value: string | number) => void;
  onAddShift: (date: Date) => void;
  onDeleteItem: (id: string) => Promise<void>;
  onRestoreItem?: (id: string) => Promise<void>;
  saveChangesButton?: React.ReactNode;
}

export const ScheduleTable: React.FC<IScheduleTableProps> = (props) => {
  const {
    items,
    options,
    isLoading,
    showDeleted,
    onToggleShowDeleted,
    onItemChange,
    onAddShift,
    onDeleteItem,
    onRestoreItem,
    saveChangesButton
  } = props;

  // Состояние для выбора всех строк
  const [selectAllRows, setSelectAllRows] = useState<boolean>(false);
  
  // Состояние для выбранных строк
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Состояние для локальных расчетов рабочего времени (для мгновенного отображения)
  const [calculatedWorkTimes, setCalculatedWorkTimes] = useState<Record<string, string>>({});

  // Добавляем состояние для диалога подтверждения
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
  
  // Используем useRef для даты в ожидании добавления смены
  const pendingShiftDateRef = useRef<Date | undefined>(undefined);

  // Эффект для инициализации рассчитанных рабочих времен
  useEffect(() => {
    const initialWorkTimes: Record<string, string> = {};
    items.forEach(item => {
      initialWorkTimes[item.id] = item.workingHours;
    });
    setCalculatedWorkTimes(initialWorkTimes);
  }, [items]);

  // Обработчик выбора/отмены выбора всех строк
  const handleSelectAllRows = (checked: boolean): void => {
    setSelectAllRows(checked);
    
    if (checked) {
      // Выбираем все строки
      const newSelected = new Set<string>();
      items.forEach(item => newSelected.add(item.id));
      setSelectedRows(newSelected);
    } else {
      // Снимаем выбор со всех строк
      setSelectedRows(new Set());
    }
  };

  // Обработчики для диалогов подтверждения удаления и восстановления
  const showDeleteConfirmDialog = (itemId: string): void => {
    console.log(`Setting up delete for item ID: ${itemId}`);
    
    // Сохраняем ID элемента в ref
    pendingActionItemIdRef.current = itemId;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this schedule item? It will be marked as deleted but can be restored later.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        // Получаем текущее значение itemId из ref
        const itemId = pendingActionItemIdRef.current;
        if (itemId) {
          // Вызываем функцию удаления из props
          onDeleteItem(itemId)
            .then(() => {
              console.log(`Item ${itemId} deleted successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionItemIdRef.current = undefined;
            })
            .catch(err => {
              console.error(`Error deleting item ${itemId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionItemIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#d83b01' // красный цвет для удаления
    });
  };
  
  // Обработчик для показа диалога подтверждения добавления смены
  const showAddShiftConfirmDialog = (date: Date): void => {
    console.log(`Setting up add shift for date: ${date.toLocaleDateString()}`);
    
    // Сохраняем дату в ref
    pendingShiftDateRef.current = date;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Add Shift',
      message: `Are you sure you want to add a new shift on ${date.toLocaleDateString()}?`,
      confirmButtonText: 'Add Shift',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        // Получаем текущее значение даты из ref
        const shiftDate = pendingShiftDateRef.current;
        if (shiftDate) {
          // Вызываем функцию добавления смены из props
          onAddShift(shiftDate);
          // Сбрасываем диалог
          setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
          pendingShiftDateRef.current = undefined;
        }
      },
      confirmButtonColor: '#107c10' // зеленый цвет для добавления
    });
  };
  
  // Обработчик для показа диалога подтверждения восстановления
  const showRestoreConfirmDialog = (itemId: string): void => {
    console.log(`Setting up restore for item ID: ${itemId}`);
    
    // Проверяем наличие обработчика восстановления
    if (!onRestoreItem) {
      console.error('Restore handler is not available');
      return;
    }
    
    // Сохраняем ID элемента в ref
    pendingActionItemIdRef.current = itemId;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Restore',
      message: 'Are you sure you want to restore this deleted schedule item?',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        // Получаем текущее значение itemId из ref
        const itemId = pendingActionItemIdRef.current;
        if (itemId && onRestoreItem) {
          // Вызываем функцию восстановления из props
          onRestoreItem(itemId)
            .then(() => {
              console.log(`Item ${itemId} restored successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionItemIdRef.current = undefined;
            })
            .catch(err => {
              console.error(`Error restoring item ${itemId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionItemIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#107c10' // зеленый цвет для восстановления
    });
  };

  // Обработчик для удаления всех выбранных строк
  const handleDeleteSelected = (): void => {
    selectedRows.forEach(id => {
      showDeleteConfirmDialog(id);
    });
  };

  // Функция для получения отображаемого рабочего времени
  const getDisplayWorkTime = (item: IScheduleItem): string => {
    // Если есть рассчитанное значение, используем его
    if (calculatedWorkTimes[item.id]) {
      return calculatedWorkTimes[item.id];
    }
    // Иначе используем значение из элемента
    return item.workingHours;
  };

  // Обработчик для закрытия диалога
  const handleDismissDialog = (): void => {
    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
    pendingActionItemIdRef.current = undefined;
    pendingShiftDateRef.current = undefined;
  };

  // Обработчик изменения времени
  const handleTimeChange = (item: IScheduleItem, field: string, value: string): void => {
    // Проверяем, что запись не удалена
    if (item.deleted) {
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
    
    // Уведомляем родителя об изменении
    onItemChange(updatedItem, field, value);
    
    // Также отправляем обновленное рабочее время
    onItemChange(updatedItem, 'workingHours', workTime);
  };

  // Обработчик изменения контракта
  const handleContractNumberChange = (item: IScheduleItem, value: string): void => {
    // Проверяем, что запись не удалена
    if (item.deleted) {
      return; // Не позволяем изменять удаленные записи
    }
    
    onItemChange(item, 'contractNumber', value);
  };

  // Обработчик изменения времени обеда
  const handleLunchTimeChange = (item: IScheduleItem, value: string): void => {
    // Проверяем, что запись не удалена
    if (item.deleted) {
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
    onItemChange(updatedItem, 'lunchTime', value);
    
    // Также отправляем обновленное рабочее время
    onItemChange(updatedItem, 'workingHours', workTime);
  };

  return (
    <div className={styles.scheduleTab}>
      {/* Заголовок и управление */}
      <ScheduleTableHeader 
        selectAllRows={selectAllRows}
        selectedRows={selectedRows}
        showDeleted={showDeleted}
        onSelectAllRows={handleSelectAllRows}
        onDeleteSelected={handleDeleteSelected}
        onToggleShowDeleted={onToggleShowDeleted}
        saveChangesButton={saveChangesButton}
      />

      {/* Контент таблицы */}
      <ScheduleTableContent 
        items={items}
        options={options}
        isLoading={isLoading}
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

      {/* Диалоги подтверждения */}
      <ScheduleTableDialogs 
        confirmDialogProps={confirmDialogProps}
        onDismiss={handleDismissDialog}
      />
    </div>
  );
};

export default ScheduleTable;