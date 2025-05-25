// src/webparts/kpfaplus/components/Tabs/LeavesTab/components/LeavesTable.tsx
import * as React from 'react';
import { useState, useRef } from 'react';
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
  // Новые props для серверных операций
  onDeleteLeave: (leaveId: string) => Promise<void>;
  onRestoreLeave: (leaveId: string) => Promise<void>;
}

// Интерфейс для редактируемой записи отпуска
interface IEditableLeaveDay extends ILeaveDay {
  isEditing?: boolean;
  isNew?: boolean;
  hasErrors?: boolean;
  errors?: {
    startDate?: string;
    typeOfLeave?: string;
  };
}

// Локализация для DatePicker (та же что в LeavesFilterPanel)
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

// Константы для стилей календаря (те же что в LeavesFilterPanel)
const calendarMinWidth = '655px';

export const LeavesTable: React.FC<ILeavesTableProps> = (props) => {
  const { 
    leaves, 
    typesOfLeave, 
    isLoading, 
    showDeleted, 
    selectedTypeFilter,
    onDeleteLeave,
    onRestoreLeave 
  } = props;

  console.log('[LeavesTable] Rendering with leaves:', leaves.length, 'types:', typesOfLeave.length);

  // Состояние для редактируемых записей
  const [editableLeaves, setEditableLeaves] = useState<IEditableLeaveDay[]>([]);

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

  // Ref для хранения ID записи в ожидании действия
  const pendingActionLeaveIdRef = useRef<string | undefined>(undefined);

  // Инициализируем редактируемые записи при изменении исходных данных
  React.useEffect(() => {
    const initialEditableLeaves = leaves.map(leave => ({
      ...leave,
      isEditing: false,
      isNew: false,
      hasErrors: false,
      errors: {}
    }));
    setEditableLeaves(initialEditableLeaves);
  }, [leaves]);

  // Функция для получения названия типа отпуска
  const getTypeOfLeaveTitle = (typeId: number): string => {
    const type = typesOfLeave.find(t => t.id === typeId.toString());
    return type ? type.title : `Type ${typeId}`;
  };

  // Функция валидации записи
  const validateLeave = (leave: IEditableLeaveDay): { isValid: boolean; errors: any } => {
    const errors: any = {};

    if (!leave.startDate) {
      errors.startDate = 'Start date is required';
    }

    if (!leave.typeOfLeave || leave.typeOfLeave === 0) {
      errors.typeOfLeave = 'Type of leave is required';
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors
    };
  };

  // Обработчик начала редактирования
  const handleStartEdit = (itemId: string): void => {
    console.log('[LeavesTable] Starting edit for item:', itemId);
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, isEditing: true, hasErrors: false, errors: {} }
        : leave
    ));
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = (itemId: string): void => {
    console.log('[LeavesTable] Cancelling edit for item:', itemId);
    
    // Если это новая запись, удаляем её
    if (editableLeaves.find(l => l.id === itemId)?.isNew) {
      setEditableLeaves(prev => prev.filter(leave => leave.id !== itemId));
      return;
    }

    // Для существующих записей - восстанавливаем из оригинальных данных
    const originalLeave = leaves.find(l => l.id === itemId);
    if (originalLeave) {
      setEditableLeaves(prev => prev.map(leave => 
        leave.id === itemId 
          ? { ...originalLeave, isEditing: false, hasErrors: false, errors: {} }
          : leave
      ));
    }
  };

  // Обработчик сохранения записи
  const handleSaveEdit = (itemId: string): void => {
    console.log('[LeavesTable] Saving edit for item:', itemId);
    
    const leaveToSave = editableLeaves.find(l => l.id === itemId);
    if (!leaveToSave) return;

    const validation = validateLeave(leaveToSave);
    
    if (!validation.isValid) {
      console.log('[LeavesTable] Validation failed:', validation.errors);
      setEditableLeaves(prev => prev.map(leave => 
        leave.id === itemId 
          ? { ...leave, hasErrors: true, errors: validation.errors }
          : leave
      ));
      return;
    }

    // Здесь будет вызов API для сохранения
    console.log('[LeavesTable] Would save leave:', leaveToSave);
    
    // Пока просто выходим из режима редактирования
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, isEditing: false, hasErrors: false, errors: {} }
        : leave
    ));
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
      onConfirm: () => {
        const leaveId = pendingActionLeaveIdRef.current;
        if (leaveId) {
          // Вызываем серверную операцию удаления
          onDeleteLeave(leaveId)
            .then(() => {
              console.log(`[LeavesTable] Leave ${leaveId} deleted successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            })
            .catch(err => {
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
      onConfirm: () => {
        const leaveId = pendingActionLeaveIdRef.current;
        if (leaveId) {
          // Вызываем серверную операцию восстановления
          onRestoreLeave(leaveId)
            .then(() => {
              console.log(`[LeavesTable] Leave ${leaveId} restored successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            })
            .catch(err => {
              console.error(`[LeavesTable] Error restoring leave ${leaveId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionLeaveIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#107c10' // зеленый цвет для восстановления
    });
  };

  // Обработчик изменения даты начала
  const handleStartDateChange = (itemId: string, date: Date | null | undefined): void => {
    if (date) {
      console.log('[LeavesTable] Start date changed for item:', itemId, 'to:', formatDate(date));
      setEditableLeaves(prev => prev.map(leave => 
        leave.id === itemId 
          ? { ...leave, startDate: date }
          : leave
      ));
    }
  };

  // Обработчик изменения даты окончания
  const handleEndDateChange = (itemId: string, date: Date | null | undefined): void => {
    console.log('[LeavesTable] End date changed for item:', itemId, 'to:', date ? formatDate(date) : 'null');
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, endDate: date || undefined }
        : leave
    ));
  };

  // Обработчик изменения типа отпуска
  const handleTypeChange = (itemId: string, typeId: string): void => {
    console.log('[LeavesTable] Type changed for item:', itemId, 'to:', typeId);
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, typeOfLeave: parseInt(typeId, 10) }
        : leave
    ));
  };

  // Обработчик изменения заметок
  const handleNotesChange = (itemId: string, notes: string): void => {
    console.log('[LeavesTable] Notes changed for item:', itemId);
    setEditableLeaves(prev => prev.map(leave => 
      leave.id === itemId 
        ? { ...leave, title: notes }
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
    
    // Фильтр по типу отпуска
    if (selectedTypeFilter && leave.typeOfLeave.toString() !== selectedTypeFilter) {
      return false;
    }
    
    return true;
  });

  // Рендер ячейки с датой (с едиными стилями как в панели управления)
  const renderDateCell = (item: IEditableLeaveDay, field: 'startDate' | 'endDate', isRequired: boolean = false) => {
    const isEditing = item.isEditing;
    const hasError = item.hasErrors && item.errors && item.errors[field as keyof typeof item.errors];
    const date = field === 'startDate' ? item.startDate : item.endDate;

    if (!isEditing) {
      return <span>{date ? formatDate(date) : (field === 'endDate' ? 'Open' : '-')}</span>;
    }

    return (
      <div style={{ width: '220px' }}>
        <DatePicker
          value={date}
          onSelectDate={(selectedDate) => {
            if (field === 'startDate') {
              handleStartDateChange(item.id, selectedDate);
            } else {
              handleEndDateChange(item.id, selectedDate);
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
  const renderTypeCell = (item: IEditableLeaveDay) => {
    const isEditing = item.isEditing;
    const hasError = item.hasErrors && item.errors && item.errors.typeOfLeave;

    if (!isEditing) {
      return <span>{getTypeOfLeaveTitle(item.typeOfLeave)}</span>;
    }

    return (
      <div style={{ width: '180px' }}>
        <Dropdown
          options={typeOptions}
          selectedKey={item.typeOfLeave.toString()}
          onChange={(_, option) => option && handleTypeChange(item.id, option.key as string)}
          placeholder="Select type..."
          styles={{
            root: { width: '180px' },
            dropdown: { 
              height: '28px',
              border: hasError ? '2px solid #d13438' : undefined
            },
            title: { 
              height: '28px', 
              lineHeight: '26px', 
              fontSize: '12px' 
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
  const renderNotesCell = (item: IEditableLeaveDay) => {
    const isEditing = item.isEditing;

    if (!isEditing) {
      return <span>{item.title || '-'}</span>;
    }

    return (
      <TextField
        value={item.title || ''}
        onChange={(_, newValue) => handleNotesChange(item.id, newValue || '')}
        multiline={false}
        styles={{
          root: { width: '200px' },
          field: { height: '28px', fontSize: '12px' }
        }}
      />
    );
  };

  // Рендер ячейки с действиями
  const renderActionsCell = (item: IEditableLeaveDay) => {
    if (item.isEditing) {
      return (
        <div style={{ display: 'flex', gap: '5px' }}>
          <IconButton
            iconProps={{ iconName: 'Save' }}
            title="Save"
            onClick={() => handleSaveEdit(item.id)}
            styles={{ 
              root: { 
                width: '28px', 
                height: '28px',
                backgroundColor: '#107c10',
                color: 'white'
              } 
            }}
          />
          <IconButton
            iconProps={{ iconName: 'Cancel' }}
            title="Cancel"
            onClick={() => handleCancelEdit(item.id)}
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
          onClick={() => handleStartEdit(item.id)}
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
            onClick={() => showRestoreConfirmDialog(item.id)}
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
            onClick={() => showDeleteConfirmDialog(item.id)}
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

  // Колонки таблицы (с увеличенной шириной для дат)
  const columns: IColumn[] = [
    {
      key: 'startDate',
      name: 'Start Date *',
      fieldName: 'startDate',
      minWidth: 230,
      maxWidth: 230,
      onRender: (item: IEditableLeaveDay) => renderDateCell(item, 'startDate', true)
    },
    {
      key: 'endDate',
      name: 'End Date',
      fieldName: 'endDate',
      minWidth: 230,
      maxWidth: 230,
      onRender: (item: IEditableLeaveDay) => renderDateCell(item, 'endDate', false)
    },
    {
      key: 'typeOfLeave',
      name: 'Type of Leave *',
      fieldName: 'typeOfLeave',
      minWidth: 190,
      maxWidth: 190,
      onRender: (item: IEditableLeaveDay) => renderTypeCell(item)
    },
    {
      key: 'notes',
      name: 'Notes',
      fieldName: 'title',
      minWidth: 210,
      isResizable: true,
      onRender: (item: IEditableLeaveDay) => renderNotesCell(item)
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'deleted',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: IEditableLeaveDay) => (
        <span style={{ color: item.deleted ? 'red' : 'green' }}>
          {item.deleted ? 'Deleted' : 'Active'}
        </span>
      )
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 80,
      maxWidth: 80,
      onRender: (item: IEditableLeaveDay) => renderActionsCell(item)
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
      />

      {/* Диалог подтверждения */}
      <ConfirmDialog
        isOpen={confirmDialogProps.isOpen}
        title={confirmDialogProps.title}
        message={confirmDialogProps.message}
        confirmButtonText={confirmDialogProps.confirmButtonText}
        cancelButtonText={confirmDialogProps.cancelButtonText}
        onConfirm={confirmDialogProps.onConfirm}
        onDismiss={() => setConfirmDialogProps(prev => ({ ...prev, isOpen: false }))}
        confirmButtonColor={confirmDialogProps.confirmButtonColor}
      />
    </div>
  );
};