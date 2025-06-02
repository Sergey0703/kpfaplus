// 4. src/webparts/kpfaplus/components/ManageGroups/components/GroupsTable.tsx
// ============================================================================
import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn,
  Dropdown,
  IDropdownOption,
  TextField,
  IconButton,
  MessageBar,
  MessageBarType,
  Toggle
} from '@fluentui/react';
import { IDepartment } from '../../../services/DepartmentService';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';

interface IGroupsTableProps {
  groups: IDepartment[];
  isLoading: boolean;
  showDeleted: boolean; // НОВЫЙ PROP для отображения удаленных
  // Серверные операции
  onDeleteGroup: (groupId: string) => Promise<void>;
  onRestoreGroup: (groupId: string) => Promise<void>;
  // PROPS для управления редактированием
  editingGroupIds: Set<string>;
  onStartEdit: (groupId: string) => void;
  onCancelEdit: (groupId: string) => void;
  // PROP для получения изменённых данных
  onGetChangedData?: (getDataFunction: () => { groupId: string; changes: Partial<IDepartment> }[]) => void;
  // PROP для выделения новых записей
  newlyCreatedGroupId?: string | undefined;
}

// Интерфейс для редактируемой записи группы с локальными изменениями
interface IEditableGroup extends IDepartment {
  // Локальные изменения для режима редактирования
  localChanges?: {
    Title?: string;
    DayOfStartWeek?: number;
    EnterLunchTime?: boolean;
    TypeOfSRS?: number; // НОВОЕ ПОЛЕ
  };
  hasErrors?: boolean;
  errors?: {
    Title?: string;
    DayOfStartWeek?: string;
    TypeOfSRS?: string; // НОВОЕ ПОЛЕ
  };
}

// Опции для дней недели (только Saturday и Monday)
const dayOfWeekOptions: IDropdownOption[] = [
  { key: 7, text: 'Saturday' },
  { key: 2, text: 'Monday' }
];

// Опции для типа SRS
const typeOfSRSOptions: IDropdownOption[] = [
  { key: 3, text: 'Residential' },
  { key: 2, text: 'Day of Service' }
];

export const GroupsTable: React.FC<IGroupsTableProps> = (props) => {
  const { 
    groups, 
    isLoading,
    showDeleted, // НОВЫЙ PROP
    onDeleteGroup,
    onRestoreGroup,
    editingGroupIds,
    onStartEdit,
    onCancelEdit,
    onGetChangedData,
    newlyCreatedGroupId
  } = props;

  console.log('[GroupsTable] Rendering with groups:', groups.length, 'editing:', editingGroupIds.size);

  // Добавляем CSS стили для анимации новой записи
  React.useEffect((): void => {
    // Добавляем стили анимации в head, если их ещё нет
    const styleId = 'groups-table-highlight-styles';
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
  const [editableGroups, setEditableGroups] = useState<IEditableGroup[]>([]);

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
  const pendingActionGroupIdRef = useRef<string | undefined>(undefined);

  // Синхронизируем editableGroups с входящими данными groups
  useEffect((): void => {
    const initialEditableGroups = groups.map(group => ({
      ...group,
      localChanges: {},
      hasErrors: false,
      errors: {}
    }));
    setEditableGroups(initialEditableGroups);
  }, [groups]);

  // ЭФФЕКТ: Регистрируем функцию получения изменённых данных
  useEffect((): void => {
    if (onGetChangedData) {
      console.log('[GroupsTable] Registering getChangedData function');
      
      // Создаем функцию для получения изменённых данных
      const getChangedDataFunction = (): { groupId: string; changes: Partial<IDepartment> }[] => {
        console.log('[GroupsTable] getChangedDataFunction called');
        console.log('[GroupsTable] Current editableGroups:', editableGroups.length);
        console.log('[GroupsTable] Current editingGroupIds:', editingGroupIds);
        
        const changedData: { groupId: string; changes: Partial<IDepartment> }[] = [];
        
        editableGroups.forEach((group, index): void => {
          console.log(`[GroupsTable] Checking group ${index} (ID: ${group.ID}), isEditing: ${editingGroupIds.has(group.ID.toString())}, hasLocalChanges: ${!!(group.localChanges && Object.keys(group.localChanges).length > 0)}`);
          
          if (editingGroupIds.has(group.ID.toString()) && group.localChanges && Object.keys(group.localChanges).length > 0) {
            const changes: Partial<IDepartment> = {};
            
            console.log(`[GroupsTable] Processing changes for group ${group.ID}:`, group.localChanges);
            
            // Собираем только изменённые поля
            if (group.localChanges.Title !== undefined) {
              changes.Title = group.localChanges.Title;
            }
            if (group.localChanges.DayOfStartWeek !== undefined) {
              changes.DayOfStartWeek = group.localChanges.DayOfStartWeek;
            }
            if (group.localChanges.EnterLunchTime !== undefined) {
              changes.EnterLunchTime = group.localChanges.EnterLunchTime;
            }
            if (group.localChanges.TypeOfSRS !== undefined) {
              changes.TypeOfSRS = group.localChanges.TypeOfSRS;
            }
            
            if (Object.keys(changes).length > 0) {
              console.log(`[GroupsTable] Adding changes for group ${group.ID}:`, changes);
              changedData.push({
                groupId: group.ID.toString(),
                changes
              });
            }
          }
        });
        
        console.log('[GroupsTable] Returning changedData:', changedData);
        return changedData;
      };
      
      // Вызываем callback для регистрации функции
      onGetChangedData(getChangedDataFunction);
      console.log('[GroupsTable] getChangedData function registered successfully');
    }
  }, [editableGroups, editingGroupIds, onGetChangedData]);

  // Функция для получения актуального значения поля с учётом локальных изменений
  const getCurrentValue = (group: IEditableGroup, field: keyof IDepartment): unknown => {
    if (group.localChanges && field in group.localChanges) {
      return group.localChanges[field as keyof typeof group.localChanges];
    }
    return group[field];
  };

  // Проверка, находится ли запись в режиме редактирования
  const isEditing = (groupId: string): boolean => {
    return editingGroupIds.has(groupId);
  };

  // Функция для получения названия дня недели
  const getDayOfWeekTitle = (dayValue: number): string => {
    const option = dayOfWeekOptions.find(opt => opt.key === dayValue);
    return option ? option.text : `Day ${dayValue}`;
  };

  // Функция для получения названия типа SRS
  const getTypeOfSRSTitle = (typeValue: number): string => {
    const option = typeOfSRSOptions.find(opt => opt.key === typeValue);
    return option ? option.text : `Type ${typeValue}`;
  };

  // Обработчик начала редактирования
  const handleStartEdit = (itemId: string): void => {
    console.log('[GroupsTable] Starting edit for item:', itemId);
    
    // Очищаем локальные изменения и ошибки для этой записи
    setEditableGroups(prev => prev.map(group => 
      group.ID.toString() === itemId 
        ? { ...group, localChanges: {}, hasErrors: false, errors: {} }
        : group
    ));
    
    // Уведомляем родительский компонент
    onStartEdit(itemId);
  };

  // Обработчик отмены редактирования
  const handleCancelEdit = (itemId: string): void => {
    console.log('[GroupsTable] Cancelling edit for item:', itemId);
    
    // Очищаем локальные изменения и ошибки для этой записи
    setEditableGroups(prev => prev.map(group => 
      group.ID.toString() === itemId 
        ? { ...group, localChanges: {}, hasErrors: false, errors: {} }
        : group
    ));
    
    // Уведомляем родительский компонент
    onCancelEdit(itemId);
  };

  // Обработчик для показа диалога подтверждения удаления
  const showDeleteConfirmDialog = (itemId: string): void => {
    console.log('[GroupsTable] Setting up delete for item:', itemId);
    
    pendingActionGroupIdRef.current = itemId;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this group? It will be marked as deleted but can be restored later.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      onConfirm: (): void => {
        const groupId = pendingActionGroupIdRef.current;
        if (groupId) {
          // Вызываем серверную операцию удаления
          onDeleteGroup(groupId)
            .then((): void => {
              console.log(`[GroupsTable] Group ${groupId} deleted successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionGroupIdRef.current = undefined;
            })
            .catch((err): void => {
              console.error(`[GroupsTable] Error deleting group ${groupId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionGroupIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#d83b01' // красный цвет для удаления
    });
  };

  // Обработчик для показа диалога подтверждения восстановления
  const showRestoreConfirmDialog = (itemId: string): void => {
    console.log('[GroupsTable] Setting up restore for item:', itemId);
    
    pendingActionGroupIdRef.current = itemId;
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Restoration',
      message: 'Are you sure you want to restore this deleted group?',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      onConfirm: (): void => {
        const groupId = pendingActionGroupIdRef.current;
        if (groupId) {
          // Вызываем серверную операцию восстановления
          onRestoreGroup(groupId)
            .then((): void => {
              console.log(`[GroupsTable] Group ${groupId} restored successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionGroupIdRef.current = undefined;
            })
            .catch((err): void => {
              console.error(`[GroupsTable] Error restoring group ${groupId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionGroupIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#107c10' // зеленый цвет для восстановления
    });
  };

  // Обработчики изменения полей (сохраняют изменения локально)
  const handleTitleChange = (itemId: string, title: string): void => {
    console.log('[GroupsTable] Title changed for item:', itemId, 'to:', title);
    setEditableGroups(prev => prev.map(group => 
      group.ID.toString() === itemId 
        ? { 
            ...group, 
            localChanges: { ...group.localChanges, Title: title },
            hasErrors: false,
            errors: {}
          }
        : group
    ));
  };

  const handleDayOfStartWeekChange = (itemId: string, dayValue: string): void => {
    console.log('[GroupsTable] Day of start week changed for item:', itemId, 'to:', dayValue);
    setEditableGroups(prev => prev.map(group => 
      group.ID.toString() === itemId 
        ? { 
            ...group, 
            localChanges: { ...group.localChanges, DayOfStartWeek: parseInt(dayValue, 10) },
            hasErrors: false,
            errors: {}
          }
        : group
    ));
  };

  const handleLunchTimeChange = (itemId: string, checked: boolean): void => {
    console.log('[GroupsTable] Lunch time changed for item:', itemId, 'to:', checked);
    setEditableGroups(prev => prev.map(group => 
      group.ID.toString() === itemId 
        ? { 
            ...group, 
            localChanges: { ...group.localChanges, EnterLunchTime: checked }
          }
        : group
    ));
  };

  const handleTypeOfSRSChange = (itemId: string, typeValue: string): void => {
    console.log('[GroupsTable] Type of SRS changed for item:', itemId, 'to:', typeValue);
    setEditableGroups(prev => prev.map(group => 
      group.ID.toString() === itemId 
        ? { 
            ...group, 
            localChanges: { ...group.localChanges, TypeOfSRS: parseInt(typeValue, 10) },
            hasErrors: false,
            errors: {}
          }
        : group
    ));
  };

  // Рендер ячейки с названием группы
  const renderTitleCell = (item: IEditableGroup): JSX.Element => {
    const itemIsEditing = isEditing(item.ID.toString());
    const hasError = item.hasErrors && item.errors && item.errors.Title;
    const currentTitle = getCurrentValue(item, 'Title') as string;

    if (!itemIsEditing) {
      return <span style={{ fontWeight: item.Deleted ? 'normal' : '600' }}>{currentTitle}</span>;
    }

    return (
      <TextField
        value={currentTitle || ''}
        onChange={(_, newValue): void => handleTitleChange(item.ID.toString(), newValue || '')}
        placeholder="Group name (required)"
        styles={{
          root: { width: '200px' },
          field: { 
            height: '26px',
            fontSize: '11px',
            border: hasError ? '2px solid #d13438' : undefined
          }
        }}
      />
    );
  };

  // Рендер ячейки с днем начала недели
  const renderDayOfStartWeekCell = (item: IEditableGroup): JSX.Element => {
    const itemIsEditing = isEditing(item.ID.toString());
    const hasError = item.hasErrors && item.errors && item.errors.DayOfStartWeek;
    const currentDayOfStartWeek = getCurrentValue(item, 'DayOfStartWeek') as number;

    if (!itemIsEditing) {
      return <span>{getDayOfWeekTitle(currentDayOfStartWeek)}</span>;
    }

    return (
      <div style={{ width: '150px' }}>
        <Dropdown
          options={dayOfWeekOptions}
          selectedKey={currentDayOfStartWeek}
          onChange={(_, option): void => option && handleDayOfStartWeekChange(item.ID.toString(), option.key as string)}
          placeholder="Select day..."
          styles={{
            root: { width: '150px' },
            dropdown: { 
              height: '26px',
              border: hasError ? '2px solid #d13438' : undefined
            },
            title: { 
              height: '26px', 
              lineHeight: '24px', 
              fontSize: '11px'
            },
          }}
        />
        {hasError && (
          <div style={{ fontSize: '10px', color: '#d13438', marginTop: '2px' }}>
            {item.errors!.DayOfStartWeek}
          </div>
        )}
      </div>
    );
  };

  // Рендер ячейки с настройкой времени обеда
  const renderLunchTimeCell = (item: IEditableGroup): JSX.Element => {
    const itemIsEditing = isEditing(item.ID.toString());
    const currentLunchTime = getCurrentValue(item, 'EnterLunchTime') as boolean;

    if (!itemIsEditing) {
      return <span>{currentLunchTime ? 'Yes' : 'No'}</span>;
    }

    return (
      <Toggle
        checked={currentLunchTime}
        onChange={(_, checked): void => handleLunchTimeChange(item.ID.toString(), !!checked)}
        styles={{
          root: { margin: 0 }
        }}
      />
    );
  };

  // Рендер ячейки с типом SRS
  const renderTypeOfSRSCell = (item: IEditableGroup): JSX.Element => {
    const itemIsEditing = isEditing(item.ID.toString());
    const hasError = item.hasErrors && item.errors && item.errors.TypeOfSRS;
    const currentTypeOfSRS = getCurrentValue(item, 'TypeOfSRS') as number;

    if (!itemIsEditing) {
      return <span>{getTypeOfSRSTitle(currentTypeOfSRS)}</span>;
    }

    return (
      <div style={{ width: '150px' }}>
        <Dropdown
          options={typeOfSRSOptions}
          selectedKey={currentTypeOfSRS}
          onChange={(_, option): void => option && handleTypeOfSRSChange(item.ID.toString(), option.key as string)}
          placeholder="Select type..."
          styles={{
            root: { width: '150px' },
            dropdown: { 
              height: '26px',
              border: hasError ? '2px solid #d13438' : undefined
            },
            title: { 
              height: '26px', 
              lineHeight: '24px', 
              fontSize: '11px'
            },
          }}
        />
        {hasError && (
          <div style={{ fontSize: '10px', color: '#d13438', marginTop: '2px' }}>
            {item.errors!.TypeOfSRS}
          </div>
        )}
      </div>
    );
  };

  // Рендер ячейки с действиями
  const renderActionsCell = (item: IEditableGroup): JSX.Element => {
    const itemIsEditing = isEditing(item.ID.toString());

    if (itemIsEditing) {
      return (
        <div style={{ display: 'flex', gap: '5px' }}>
          <IconButton
            iconProps={{ iconName: 'Cancel' }}
            title="Cancel"
            onClick={(): void => handleCancelEdit(item.ID.toString())}
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
          onClick={(): void => handleStartEdit(item.ID.toString())}
          styles={{ 
            root: { 
              width: '28px', 
              height: '28px',
              backgroundColor: '#0078d4',
              color: 'white'
            } 
          }}
        />
        {item.Deleted ? (
          <IconButton
            iconProps={{ iconName: 'Refresh' }}
            title="Restore"
            onClick={(): void => showRestoreConfirmDialog(item.ID.toString())}
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
            onClick={(): void => showDeleteConfirmDialog(item.ID.toString())}
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

  // Колонки таблицы
  const columns: IColumn[] = [
    {
      key: 'id',
      name: 'ID',
      fieldName: 'ID',
      minWidth: 50,
      maxWidth: 50,
      onRender: (item: IEditableGroup): JSX.Element => {
        const itemIsEditing = isEditing(item.ID.toString());
        return (
          <span style={{ 
            fontSize: '11px',
            color: itemIsEditing ? '#0078d4' : '#666',
            fontWeight: itemIsEditing ? 'bold' : 'normal'
          }}>
            {item.ID}
          </span>
        );
      }
    },
    {
      key: 'title',
      name: 'Group\'s name *',
      fieldName: 'Title',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: IEditableGroup): JSX.Element => renderTitleCell(item)
    },
    {
      key: 'typeOfSRS',
      name: 'Type of SRS',
      fieldName: 'TypeOfSRS',
      minWidth: 160,
      maxWidth: 160,
      onRender: (item: IEditableGroup): JSX.Element => renderTypeOfSRSCell(item)
    },
    {
      key: 'dayOfStartWeek',
      name: 'Day of start week',
      fieldName: 'DayOfStartWeek',
      minWidth: 160,
      maxWidth: 160,
      onRender: (item: IEditableGroup): JSX.Element => renderDayOfStartWeekCell(item)
    },
    {
      key: 'lunchTime',
      name: 'Lunch time',
      fieldName: 'EnterLunchTime',
      minWidth: 100,
      maxWidth: 100,
      onRender: (item: IEditableGroup): JSX.Element => renderLunchTimeCell(item)
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 70,
      maxWidth: 70,
      onRender: (item: IEditableGroup): JSX.Element => renderActionsCell(item)
    }
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading groups data...</p>
      </div>
    );
  }

  if (editableGroups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No groups found.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Total groups loaded: {groups.length}
        </p>
      </div>
    );
  }

  // Фильтрация групп по статусу удаления
  const filteredGroups = editableGroups.filter(group => {
    // Фильтр по удаленным записям
    if (!showDeleted && group.Deleted) {
      return false;
    }
    return true;
  });

  if (filteredGroups.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No groups found for the selected criteria.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Total groups loaded: {groups.length} | 
          After filters: {filteredGroups.length}
        </p>
      </div>
    );
  }

  // Проверяем, есть ли записи с ошибками
  const hasValidationErrors = editableGroups.some(group => group.hasErrors);

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing {filteredGroups.length} of {editableGroups.length} group records
        {editingGroupIds.size > 0 && <span style={{ color: '#0078d4', marginLeft: '10px' }}>✏️ {editingGroupIds.size} record(s) being edited</span>}
        {hasValidationErrors && <span style={{ color: '#d13438', marginLeft: '10px' }}>⚠ Some records have validation errors</span>}
      </p>
      
      {hasValidationErrors && (
        <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: '10px' }}>
          Please fix validation errors before saving. Required fields: Group name.
        </MessageBar>
      )}
      
      <DetailsList
        items={filteredGroups}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={true}
        // PROP для кастомизации стилей строк
        onRenderRow={(props, defaultRender): JSX.Element | null => {
          if (!props || !defaultRender) return null;
          
          // Проверяем, является ли эта строка новой записью
          const isNewlyCreated = newlyCreatedGroupId && props.item.ID.toString() === newlyCreatedGroupId;
          
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