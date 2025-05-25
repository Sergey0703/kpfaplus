// src/webparts/kpfaplus/components/Tabs/LeavesTab/components/LeavesTable.tsx
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn,
  DatePicker,
  DayOfWeek,
  Dropdown,
  IDropdownOption,
  TextField,
  IconButton,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { ConfirmDialog } from '../../../ConfirmDialog/ConfirmDialog';

interface ILeavesTableProps {
  leaves: ILeaveDay[];
  typesOfLeave: ITypeOfLeave[];
  isLoading: boolean;
  showDeleted: boolean;
  selectedTypeFilter: string;
  // Серверные операции
  onDeleteLeave: (leaveId: string) => Promise<void>;
  onRestoreLeave: (leaveId: string) => Promise<void>;
  // PROPS для управления редактированием
  editingLeaveIds: Set<string>;
  onStartEdit: (leaveId: string) => void;
  onCancelEdit: (leaveId: string) => void;
  // PROP для получения изменённых данных
  onGetChangedData?: (getDataFunction: () => { leaveId: string; changes: Partial<ILeaveDay> }[]) => void;
  // PROP для выделения новых записей
  newlyCreatedLeaveId?: string | undefined;
}

// Интерфейс для редактируемой записи отпуска с локальными изменениями
interface IEditableLeaveDay extends ILeaveDay {
  // Локальные изменения для режима редактирования
  localChanges?: {
    startDate?: Date;
    endDate?: Date;
    typeOfLeave?: number;
    title?: string;
  };
  hasErrors?: boolean;
  errors?: {
    startDate?: string;
    typeOfLeave?: string;
  };
}

// Локализация для DatePicker
const datePickerStringsEN = {
  months: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  shortMonths: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  days: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ],
  shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  goToToday: 'Go to today',
  weekNumberFormatString: 'Week number {0}',
  prevMonthAriaLabel: 'Previous month',
  nextMonthAriaLabel: 'Next month',
  prevYearAriaLabel: 'Previous year',
  nextYearAriaLabel: 'Next year',
  closeButtonAriaLabel: 'Close date picker',
  monthPickerHeaderAriaLabel: '{0}, select to change the year',
  yearPickerHeaderAriaLabel: '{0}, select to change the month'
};

// Форматирование даты в формате dd.mm.yyyy
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

const calendarMinWidth = '655px';

export const LeavesTable: React.FC<ILeavesTableProps> = (props) => {
  const { 
    leaves, 
    typesOfLeave, 
    isLoading, 
    showDeleted, 
    selectedTypeFilter,
    onDeleteLeave,
    onRestoreLeave,
    editingLeaveIds,
    onStartEdit,
    onCancelEdit,
    onGetChangedData,
    newlyCreatedLeaveId
  } = props;

  console.log('[LeavesTable] Rendering with leaves:', leaves.length, 'editing:', editingLeaveIds.size);

  // Добавляем CSS стили для анимации новой записи
  React.useEffect((): void => {
    // Добавляем стили анимации в head, если их ещё нет
    const styleId = 'leaves-table-highlight-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes highlight-fade {
          0% {
            background-color: #d4edda;
            border-color: #28a745;
            box-shadow: 0 0 10px rgba(40, 167, 69, 0.5);
          }
          50% {
            background-color: #f8f9fa;
            border-color: #107c10;
          }
          100% {
            background-color: #f3f9f1;
            border-color: #107c10;
          }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Состояние для локальных изменений редактируемых записей
  const [editableLeaves, setEditableLeaves] = useState<IEditableLeaveDay[]>([]);

  // Состояние для диалога подтверждения
  const [confirmDialogProps, setConfirmDialogProps] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Cancel',
    onConfirm: (): void => {},
    confirmButtonColor: ''
  });

  // Ref для хранения ID записи в ожидании действия
  const pendingActionLeaveIdRef = useRef<string | undefined>(undefined);

  // Синхронизируем editableLeaves с входящими данными leaves
  useEffect((): void => {
    const initialEditableLeaves = leaves.map(leave => ({
      ...leave,
      localChanges: {},
      hasErrors: false,
      errors: {}
    }));
    setEditableLeaves(initialEditableLeaves);
  }, [leaves]);

  // ЭФФЕКТ: Регистрируем функцию получения изменённых данных
  useEffect((): void => {
    if (onGetChangedData) {
      console.log('[LeavesTable] Registering getChangedData function');
      
      // Создаем функцию для получения изменённых данных
      const getChangedDataFunction = (): { leaveId: string; changes: Partial<ILeaveDay> }[] => {
        console.log('[LeavesTable] getChangedDataFunction called');
        console.log('[LeavesTable] Current editableLeaves:', editableLeaves.length);
        console.log('[LeavesTable] Current editingLeaveIds:', editingLeaveIds);
        
        const changedData: { leaveId: string; changes: Partial<ILeaveDay> }[] = [];
        
        editableLeaves.forEach((leave, index): void => {
          console.log(`[LeavesTable] Checking leave ${index} (ID: ${leave.id}), isEditing: ${editingLeaveIds.has(leave.id)}, hasLocalChanges: ${!!(leave.localChanges && Object.keys(leave.localChanges).length > 0)}`);
          
          if (editingLeaveIds.has(leave.id) && leave.localChanges && Object.keys(leave.localChanges).length > 0) {
            const changes: Partial<ILeaveDay> = {};
            
            console.log(`[LeavesTable] Processing changes for leave ${leave.id}:`, leave.localChanges);
            
            // Собираем только изменённые поля
            if (leave.localChanges.startDate !== undefined) {
              changes.startDate = leave.localChanges.startDate;
            }
            if (leave.localChanges.endDate !== undefined) {
              changes.endDate = leave.localChanges.endDate;
            }
            if (leave.localChanges.typeOfLeave !== undefined) {
              changes.typeOfLeave = leave.localChanges.typeOfLeave;
            }
            if (leave.localChanges.title !== undefined) {
              changes.title = leave.localChanges.title;
            }
            
            if (Object.keys(changes).length > 0) {
              console.log(`[LeavesTable] Adding changes for leave ${leave.id}:`, changes);
              changedData.push({
                leaveId: leave.id,
                changes
              });
            }
          }
        });
        
        console.log('[LeavesTable] Returning changedData:', changedData);
        return changedData;
      };
      
      // Вызываем callback для регистрации функции
      onGetChangedData(getChangedDataFunction);
      console.log('[LeavesTable] getChangedData function registered successfully');
    }
  }, [editableLeaves, editingLeaveIds, onGetChangedData]);

  // Функция для получения актуального значения поля с учётом локальных изменений
  const getCurrentValue = (leave: IEditableLeaveDay, field: keyof ILeaveDay): unknown => {
    if (leave.localChanges && field in leave.localChanges) {
      return leave.localChanges[field as keyof typeof leave.localChanges];
    }
    return leave[field];
  };

  // Проверка, находится ли запись в режиме редактирования
  const isEditing = (leaveId: string): boolean => {
    return editingLeaveIds.has(leaveId);
  };

  // Функция для получения названия типа отпуска
  const getTypeOfLeaveTitle = (typeId: number): string => {
    const type = typesOfLeave.find(t => t.id === typeId.toString());
    return type ? type.title : `Type ${typeId}`;
  };

  // Обработчик начала редактирования
  const handleStartEdit = (itemId: string): void => {
    console.log('[LeavesTable] Starting edit for item:', itemId);
    
    // Очищаем локальные изменения и ошибки для этой записи
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, localChanges: {}, hasErrors: false, errors: {} }
        : leave
    ));
    
    // Уведомляем родительский компонент
    onStartEdit(itemId);
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = (itemId: string): void => {
    console.log('[LeavesTable] Cancelling edit for item:', itemId);
    
    // Очищаем локальные изменения и ошибки для этой записи
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, localChanges: {}, hasErrors: false, errors: {} }
        : leave
    ));
    
    // Уведомляем родительский компонент
    onCancelEdit(itemId);
  };

  // Обработчик для показа диалога подтверждения удаления
  const showDeleteConfirmDialog = (itemId: string): void => {
    console.log('[LeavesTable] Setting up delete for item:', itemId);
    
    pendingActionLeaveIdRef.current = itemId;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this leave record? It will be marked as deleted but can be restored later.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      onConfirm: (): void => {
        const leaveId = pendingActionLeaveIdRef.current;
        if (leaveId) {
          // Вызываем серверную операцию удаления
          onDeleteLeave(leaveId)
            .then((): void => {
              console.log(`[LeavesTable] Leave ${leaveId} deleted successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            })
            .catch((err): void => {
              console.error(`[LeavesTable] Error deleting leave ${leaveId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#d83b01' // красный цвет для удаления
    });
  };

  // Обработчик для показа диалога подтверждения восстановления
  const showRestoreConfirmDialog = (itemId: string): void => {
    console.log('[LeavesTable] Setting up restore for item:', itemId);
    
    pendingActionLeaveIdRef.current = itemId;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Restoration',
      message: 'Are you sure you want to restore this deleted leave record?',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      onConfirm: (): void => {
        const leaveId = pendingActionLeaveIdRef.current;
        if (leaveId) {
          // Вызываем серверную операцию восстановления
          onRestoreLeave(leaveId)
            .then((): void => {
              console.log(`[LeavesTable] Leave ${leaveId} restored successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            })
            .catch((err): void => {
              console.error(`[LeavesTable] Error restoring leave ${leaveId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#107c10' // зеленый цвет для восстановления
    });
  };

  // Обработчики изменения полей (сохраняют изменения локально)
  const handleStartDateChange = (itemId: string, date: Date | undefined): void => {
    if (date) {
      console.log('[LeavesTable] Start date changed for item:', itemId, 'to:', formatDate(date));
      setEditableLeaves(prev => prev.map(leave => 
        leave.id === itemId 
          ? { 
              ...leave, 
              localChanges: { ...leave.localChanges, startDate: date },
              hasErrors: false,
              errors: {}
            }
          : leave
      ));
    }
  };

  const handleEndDateChange = (itemId: string, date: Date | undefined): void => {
    console.log('[LeavesTable] End date changed for item:', itemId, 'to:', date ? formatDate(date) : 'undefined');
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { 
            ...leave, 
            localChanges: { ...leave.localChanges, endDate: date || undefined }
          }
        : leave
    ));
  };

  const handleTypeChange = (itemId: string, typeId: string): void => {
    console.log('[LeavesTable] Type changed for item:', itemId, 'to:', typeId);
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { 
            ...leave, 
            localChanges: { ...leave.localChanges, typeOfLeave: parseInt(typeId, 10) },
            hasErrors: false,
            errors: {}
          }
        : leave
    ));
  };

  const handleNotesChange = (itemId: string, notes: string): void => {
    console.log('[LeavesTable] Notes changed for item:', itemId);
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { 
            ...leave, 
            localChanges: { ...leave.localChanges, title: notes }
          }
        : leave
    ));
  };

  // Обработчики закрытия календарей
  const calendarDismissHandler = (): void => {
    console.log('[LeavesTable] Calendar dismissed');
  };

  // Подготавливаем опции для dropdown типов отпусков
  const typeOptions: IDropdownOption[] = typesOfLeave.map(type => ({
    key: type.id,
    text: type.title
  }));

  // Фильтрация отпусков
  const filteredLeaves = editableLeaves.filter(leave => {
    // Фильтр по удаленным записям
    if (!showDeleted && leave.deleted) {
      return false;
    }
    
    // Фильтр по типу отпуска (используем актуальное значение)
    if (selectedTypeFilter) {
      const currentTypeOfLeave = getCurrentValue(leave, 'typeOfLeave') as number;
      if (currentTypeOfLeave.toString() !== selectedTypeFilter) {
        return false;
      }
    }
    
    return true;
  });

  // Рендер ячейки с датой
  const renderDateCell = (item: IEditableLeaveDay, field: 'startDate' | 'endDate', isRequired: boolean = false): JSX.Element => {
    const itemIsEditing = isEditing(item.id);
    const hasError = item.hasErrors && item.errors && item.errors[field as keyof typeof item.errors];
    const currentDate = getCurrentValue(item, field) as Date | undefined;

    if (!itemIsEditing) {
      return <span>{currentDate ? formatDate(currentDate) : (field === 'endDate' ? 'Open' : '-')}</span>;
    }

    return (
      <div style={{ width: '220px' }}>
        <DatePicker
          value={currentDate}
          onSelectDate={(selectedDate): void => {
            if (field === 'startDate') {
              handleStartDateChange(item.id, selectedDate || undefined);
            } else {
              handleEndDateChange(item.id, selectedDate || undefined);
            }
          }}
          firstDayOfWeek={DayOfWeek.Monday}
          strings={datePickerStringsEN}
          formatDate={formatDate}
          allowTextInput={false}
          showGoToToday={true}
          showMonthPickerAsOverlay={true}
          placeholder={isRequired ? 'Required' : 'Optional'}
          styles={{
            root: {
              width: '220px',
              selectors: {
                '.ms-DatePicker-weekday': {
                  width: '35px',
                  height: '35px',
                  lineHeight: '35px',
                  padding: 0,
                  textAlign: 'center',
                  fontSize: '12px',
                },
                '.ms-DatePicker-day': {
                  width: '35px',
                  height: '35px',
                  lineHeight: '35px',
                  padding: 0,
                  margin: 0,
                  fontSize: '14px',
                  textAlign: 'center',
                },
                'td[class*="dayOutsideNavigatedMonth"] button[class*="dayButton"]': {
                  color: '#a19f9d',
                },
                '.ms-DatePicker-table': {
                  width: '100%',
                },
              }
            },
            textField: {
              width: '100%',
              height: '32px',
              selectors: {
                '.ms-TextField-field': {
                  height: '32px',
                  border: hasError ? '2px solid #d13438' : undefined
                },
              },
            },
          }}
          calendarProps={{
            onDismiss: calendarDismissHandler,
            firstDayOfWeek: DayOfWeek.Monday,
            showGoToToday: true,
            showSixWeeksByDefault: true,
            showWeekNumbers: false,
          }}
          calloutProps={{
            styles: {
              calloutMain: {
                minWidth: calendarMinWidth,
              }
            }
          }}
        />
        {hasError && (
          <div style={{ fontSize: '10px', color: '#d13438', marginTop: '2px' }}>
            {item.errors![field as keyof typeof item.errors]}
          </div>
        )}
      </div>
    );
  };

  // Рендер ячейки с типом отпуска
  const renderTypeCell = (item: IEditableLeaveDay): JSX.Element => {
    const itemIsEditing = isEditing(item.id);
    const hasError = item.hasErrors && item.errors && item.errors.typeOfLeave;
    const currentTypeOfLeave = getCurrentValue(item, 'typeOfLeave') as number;

    if (!itemIsEditing) {
      return <span>{getTypeOfLeaveTitle(currentTypeOfLeave)}</span>;
    }

    return (
      <div style={{ width: '150px' }}> {/* Уменьшено с 180px до 150px */}
        <Dropdown
          options={typeOptions}
          selectedKey={currentTypeOfLeave.toString()}
          onChange={(_, option): void => option && handleTypeChange(item.id, option.key as string)}
          placeholder="Select type..."
          styles={{
            root: { width: '150px' }, // Уменьшено с 180px до 150px
            dropdown: { 
              height: '26px', // Уменьшено с 28px до 26px
              border: hasError ? '2px solid #d13438' : undefined
            },
            title: { 
              height: '26px', 
              lineHeight: '24px', 
              fontSize: '11px' // Уменьшено с 12px до 11px
            },
          }}
        />
        {hasError && (
          <div style={{ fontSize: '10px', color: '#d13438', marginTop: '2px' }}>
            {item.errors!.typeOfLeave}
          </div>
        )}
      </div>
    );
  };

  // Рендер ячейки с заметками
  const renderNotesCell = (item: IEditableLeaveDay): JSX.Element => {
    const itemIsEditing = isEditing(item.id);
    const currentTitle = getCurrentValue(item, 'title') as string;

    if (!itemIsEditing) {
      return <span>{currentTitle || '-'}</span>;
    }

    return (
      <TextField
        value={currentTitle || ''}
        onChange={(_, newValue): void => handleNotesChange(item.id, newValue || '')}
        multiline={false}
        styles={{
          root: { width: '180px' }, // Уменьшено с 200px до 180px
          field: { 
            height: '26px', // Уменьшено с 28px до 26px
            fontSize: '11px' // Уменьшено с 12px до 11px
          }
        }}
      />
    );
  };

  // Рендер ячейки с действиями (БЕЗ кнопки Save)
  const renderActionsCell = (item: IEditableLeaveDay): JSX.Element => {
    const itemIsEditing = isEditing(item.id);

    if (itemIsEditing) {
      return (
        <div style={{ display: 'flex', gap: '5px' }}>
          <IconButton
            iconProps={{ iconName: 'Cancel' }}
            title="Cancel"
            onClick={(): void => handleCancelEdit(item.id)}
            styles={{ 
              root: { 
                width: '28px', 
                height: '28px',
                backgroundColor: '#797775',
                color: 'white'
              } 
            }}
          />
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', gap: '5px' }}>
        <IconButton
          iconProps={{ iconName: 'Edit' }}
          title="Edit"
          onClick={(): void => handleStartEdit(item.id)}
          styles={{ 
            root: { 
              width: '28px', 
              height: '28px',
              backgroundColor: '#0078d4',
              color: 'white'
            } 
          }}
        />
        {item.deleted ? (
          <IconButton
            iconProps={{ iconName: 'Refresh' }}
            title="Restore"
            onClick={(): void => showRestoreConfirmDialog(item.id)}
            styles={{ 
              root: { 
                width: '28px', 
                height: '28px',
                backgroundColor: '#107c10',
                color: 'white'
              } 
            }}
          />
        ) : (
          <IconButton
            iconProps={{ iconName: 'Delete' }}
            title="Delete"
            onClick={(): void => showDeleteConfirmDialog(item.id)}
            styles={{ 
              root: { 
                width: '28px', 
                height: '28px',
                backgroundColor: '#d83b01',
                color: 'white'
              } 
            }}
          />
        )}
      </div>
    );
  };

  // Колонки таблицы - ОПТИМИЗИРОВАННЫЕ РАЗМЕРЫ
  const columns: IColumn[] = [
    {
      key: 'startDate',
      name: 'Start Date *',
      fieldName: 'startDate',
      minWidth: 120, // Уменьшено с 230 до 120
      maxWidth: 120,
      onRender: (item: IEditableLeaveDay): JSX.Element => renderDateCell(item, 'startDate', true)
    },
    {
      key: 'endDate',
      name: 'End Date',
      fieldName: 'endDate',
      minWidth: 120, // Уменьшено с 230 до 120
      maxWidth: 120,
      onRender: (item: IEditableLeaveDay): JSX.Element => renderDateCell(item, 'endDate', false)
    },
    {
      key: 'typeOfLeave',
      name: 'Type of Leave *',
      fieldName: 'typeOfLeave',
      minWidth: 160, // Уменьшено с 190 до 160
      maxWidth: 160,
      onRender: (item: IEditableLeaveDay): JSX.Element => renderTypeCell(item)
    },
    {
      key: 'notes',
      name: 'Notes',
      fieldName: 'title',
      minWidth: 200, // Уменьшено с 210 до 200
      isResizable: true, // Позволяет пользователю менять размер
      onRender: (item: IEditableLeaveDay): JSX.Element => renderNotesCell(item)
    },
    // УДАЛИЛИ колонку Status для экономии места
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 70,
      maxWidth: 70,
      onRender: (item: IEditableLeaveDay): JSX.Element => renderActionsCell(item)
    },
    // НОВАЯ колонка с ID записей
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 60,
      maxWidth: 60,
      onRender: (item: IEditableLeaveDay): JSX.Element => {
        const itemIsEditing = isEditing(item.id);
        return (
          <span style={{ 
            fontSize: '11px',
            color: itemIsEditing ? '#0078d4' : '#666',
            fontWeight: itemIsEditing ? 'bold' : 'normal'
          }}>
            {item.id}
          </span>
        );
      }
    }
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading leaves data...</p>
      </div>
    );
  }

  if (filteredLeaves.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No leaves found for the selected criteria.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Total leaves loaded: {leaves.length} | 
          After filters: {filteredLeaves.length} | 
          Types available: {typesOfLeave.length}
        </p>
      </div>
    );
  }

  // Проверяем, есть ли записи с ошибками
  const hasValidationErrors = editableLeaves.some(leave => leave.hasErrors);

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing {filteredLeaves.length} of {leaves.length} leave records
        {editingLeaveIds.size > 0 && <span style={{ color: '#0078d4', marginLeft: '10px' }}>✏️ {editingLeaveIds.size} record(s) being edited</span>}
        {hasValidationErrors && <span style={{ color: '#d13438', marginLeft: '10px' }}>⚠ Some records have validation errors</span>}
      </p>
      
      {hasValidationErrors && (
        <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: '10px' }}>
          Please fix validation errors before saving. Required fields: Start Date, Type of Leave.
        </MessageBar>
      )}
      
      <DetailsList
        items={filteredLeaves}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={true}
        // PROP для кастомизации стилей строк
        onRenderRow={(props, defaultRender): JSX.Element | null => {
          if (!props || !defaultRender) return null;
          
          // Проверяем, является ли эта строка новой записью
          const isNewlyCreated = newlyCreatedLeaveId && props.item.id === newlyCreatedLeaveId;
          
          // Применяем стили к строке
          const customStyles = isNewlyCreated ? {
            root: {
              border: '2px solid #107c10', // зелёная рамка
              backgroundColor: '#f3f9f1', // светло-зелёный фон
              animation: 'highlight-fade 3s ease-out' // анимация подсветки
            }
          } : undefined;
          
          const result = defaultRender({
            ...props,
            styles: customStyles
          });
          
          return result as JSX.Element;
        }}
      />

      {/* Диалог подтверждения */}
      <ConfirmDialog
        isOpen={confirmDialogProps.isOpen}
        title={confirmDialogProps.title}
        message={confirmDialogProps.message}
        confirmButtonText={confirmDialogProps.confirmButtonText}
        cancelButtonText={confirmDialogProps.cancelButtonText}
        onConfirm={confirmDialogProps.onConfirm}
        onDismiss={(): void => setConfirmDialogProps(prev => ({ ...prev, isOpen: false }))}
        confirmButtonColor={confirmDialogProps.confirmButtonColor}
      />
    </div>
  );
};