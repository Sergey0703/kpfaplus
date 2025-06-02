// src/webparts/kpfaplus/components/ManageGroups/ManageGroupsContent.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { IManageGroupsProps } from './ManageGroups';
import { DepartmentService } from '../../services/DepartmentService';
import { GroupsControlPanel } from './components/GroupsControlPanel';
import { GroupsTable } from './components/GroupsTable';
import { useGroupsData } from './utils/useGroupsData';
import { ConfirmDialog } from '../ConfirmDialog/ConfirmDialog';
import { MessageBar, MessageBarType, Dialog, DialogType, DialogFooter, PrimaryButton, DefaultButton } from '@fluentui/react';
import { IDepartment } from '../../services/DepartmentService';

// Интерфейс для информационных сообщений
interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

export const ManageGroupsContent: React.FC<IManageGroupsProps> = (props) => {
  const { context, onGoBack } = props;

  console.log('[ManageGroupsContent] Rendering');

  // Инициализируем сервис
  const departmentService = useMemo(() => {
    if (context) {
      console.log('[ManageGroupsContent] Initializing DepartmentService');
      return new DepartmentService(context);
    }
    return undefined;
  }, [context]);

  // Состояния для диалогов
  const [isNewGroupDialogOpen, setIsNewGroupDialogOpen] = useState<boolean>(false);
  const [isUnsavedChangesDialogOpen, setIsUnsavedChangesDialogOpen] = useState<boolean>(false);

  // СОСТОЯНИЕ для Show Deleted
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  // СОСТОЯНИЯ для управления сохранением
  const [editingGroupIds, setEditingGroupIds] = useState<Set<string>>(new Set());
  const [editingCount, setEditingCount] = useState<number>(0);
  const [infoMessage, setInfoMessage] = useState<IInfoMessage | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // НОВОЕ СОСТОЯНИЕ для ID новой записи (для выделения зелёной рамкой)
  const [newlyCreatedGroupId, setNewlyCreatedGroupId] = useState<string | undefined>(undefined);

  // Ref для хранения функции получения изменённых данных из таблицы
  const getChangedDataFunctionRef = React.useRef<(() => { groupId: string; changes: Partial<IDepartment> }[]) | null>(null);

  // Используем хук для работы с данными
  const {
    groups,
    isLoading,
    error,
    loadData
  } = useGroupsData({
    departmentService,
    currentUserId: props.currentUserId
  });

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    console.log('[ManageGroupsContent] Component mounted, loading initial data');
    loadData();
  }, [loadData]);

  // ЭФФЕКТ: Управление информационными сообщениями в зависимости от состояния редактирования
  useEffect(() => {
    const hasUnsavedChanges = editingCount > 0;
    
    if (hasUnsavedChanges && !isSaving) {
      // Показываем желтое сообщение о несохранённых изменениях
      const changesCount = editingCount;
      setInfoMessage({
        text: changesCount === 1 
          ? "You have unsaved changes" 
          : `You have ${changesCount} unsaved changes`,
        type: MessageBarType.warning
      });
    } else if (!hasUnsavedChanges && !isSaving) {
      // Скрываем сообщение, если нет несохранённых изменений
      setInfoMessage(null);
    }
    // Если идёт сохранение (isSaving), не меняем сообщение здесь
  }, [editingCount, isSaving]);

  // Автоматическое скрытие сообщений через 5 секунд (только для success и error)
  useEffect(() => {
    if (infoMessage && (infoMessage.type === MessageBarType.success || infoMessage.type === MessageBarType.error)) {
      const timer = setTimeout(() => {
        setInfoMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  // Callback для регистрации функции получения данных из таблицы
  const handleRegisterGetChangedData = (getDataFunction: () => { groupId: string; changes: Partial<IDepartment> }[]): void => {
    console.log('[ManageGroupsContent] Registering getChangedData function from table');
    getChangedDataFunctionRef.current = getDataFunction;
    console.log('[ManageGroupsContent] getChangedData function registered, ref is now:', !!getChangedDataFunctionRef.current);
  };

  // ОБРАБОТЧИКИ для управления режимом редактирования
  
  // Добавление ID в список редактируемых
  const handleStartEdit = (groupId: string): void => {
    console.log('[ManageGroupsContent] Starting edit for group:', groupId);
    setEditingGroupIds(prev => {
      const newSet = new Set(prev);
      newSet.add(groupId);
      setEditingCount(newSet.size);
      return newSet;
    });
  };

  // Удаление ID из списка редактируемых
  const handleCancelEdit = (groupId: string): void => {
    console.log('[ManageGroupsContent] Cancelling edit for group:', groupId);
    setEditingGroupIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(groupId);
      setEditingCount(newSet.size);
      return newSet;
    });
  };

  // ОБРАБОТЧИК для Show Deleted
  const handleShowDeletedChange = (checked: boolean): void => {
    console.log('[ManageGroupsContent] Show deleted changed:', checked);
    setShowDeleted(checked);
  };

  // ОБРАБОТЧИК: Глобальное сохранение всех изменений
  const handleSaveAllChanges = async (): Promise<void> => {
    if (editingCount === 0) {
      console.log('[ManageGroupsContent] No changes to save');
      return;
    }

    console.log('[ManageGroupsContent] Starting batch save for', editingCount, 'items');
    setIsSaving(true);

    try {
      // Получаем изменённые данные из таблицы
      console.log('[ManageGroupsContent] Checking if getChangedDataFunctionRef is available:', !!getChangedDataFunctionRef.current);
      
      const changedData = getChangedDataFunctionRef.current ? getChangedDataFunctionRef.current() : [];
      
      console.log('[ManageGroupsContent] Retrieved changed data:', changedData);
      
      if (changedData.length === 0) {
        console.log('[ManageGroupsContent] No actual changes found to save');
        setInfoMessage({
          text: "No changes found to save",
          type: MessageBarType.warning
        });
        return;
      }

      console.log('[ManageGroupsContent] Found changes to save:', changedData);

      // Сохраняем каждое изменение через сервис
      let savedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const item of changedData) {
        try {
          console.log(`[ManageGroupsContent] Saving changes for group ${item.groupId}:`, item.changes);
          
          if (departmentService) {
            const success = await departmentService.updateGroup(item.groupId, item.changes);
            if (success) {
              savedCount++;
              console.log(`[ManageGroupsContent] Successfully saved group ${item.groupId}`);
            } else {
              errorCount++;
              errors.push(`Failed to save group ${item.groupId}`);
            }
          } else {
            throw new Error('DepartmentService not available');
          }
        } catch (error) {
          errorCount++;
          errors.push(`Error saving group ${item.groupId}: ${error}`);
          console.error(`[ManageGroupsContent] Error saving group ${item.groupId}:`, error);
        }
      }

      // Показываем результат сохранения
      if (errorCount === 0) {
        // Все сохранено успешно
        setInfoMessage({
          text: savedCount === 1 
            ? "All changes saved successfully" 
            : `All ${savedCount} changes saved successfully`,
          type: MessageBarType.success
        });
      } else if (savedCount > 0) {
        // Частично сохранено
        setInfoMessage({
          text: `Saved ${savedCount} of ${changedData.length} changes. ${errorCount} failed.`,
          type: MessageBarType.warning
        });
      } else {
        // Ничего не сохранено
        setInfoMessage({
          text: `Failed to save changes: ${errors.join('; ')}`,
          type: MessageBarType.error
        });
      }

      // Если хотя бы что-то сохранено, очищаем список редактируемых записей и перезагружаем данные
      if (savedCount > 0) {
        setEditingGroupIds(new Set());
        setEditingCount(0);
        
        // Очищаем выделение новых записей при сохранении
        setNewlyCreatedGroupId(undefined);
        
        // Перезагружаем данные
        await loadData();
        
        console.log('[ManageGroupsContent] Data reloaded after batch save');
      }

      console.log('[ManageGroupsContent] Batch save completed with results:', { savedCount, errorCount });
    } catch (error) {
      console.error('[ManageGroupsContent] Error during batch save:', error);
      setInfoMessage({
        text: `Error saving changes: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Вычисляем, есть ли несохранённые изменения
  const hasUnsavedChanges = editingCount > 0;

  // ВПЕРЁД ОБЪЯВЛЯЕМ ФУНКЦИИ в правильном порядке

  // Метод для продолжения создания новой группы (без проверки изменений)
  const handleProceedWithNewGroup = (): void => {
    console.log('[ManageGroupsContent] Opening new group confirmation dialog');
    setIsNewGroupDialogOpen(true);
  };

  // Обработчик подтверждения создания новой группы
  const handleConfirmNewGroup = async (): Promise<void> => {
    if (!departmentService) {
      console.error('[ManageGroupsContent] Cannot create new group: missing service');
      return;
    }

    if (!props.currentUserId) {
      console.error('[ManageGroupsContent] Cannot create new group: missing currentUserId');
      return;
    }

    console.log('[ManageGroupsContent] Creating new group record');

    try {
      // Подготавливаем данные для новой записи
      const newGroupData = {
        Title: 'New Group', // имя по умолчанию
        DayOfStartWeek: 7, // Saturday по умолчанию
        EnterLunchTime: true, // Lunch time включен
        LeaveExportFolder: '', // пустая папка
        ManagerLookupId: parseInt(props.currentUserId, 10),
        Deleted: 0, // активная группа
        TypeOfSRS: 3 // Residential по умолчанию
      };

      console.log('[ManageGroupsContent] New group data:', newGroupData);

      // Создаем новую запись на сервере
      const newGroupId = await departmentService.createGroup(newGroupData);

      if (newGroupId) {
        console.log('[ManageGroupsContent] New group created successfully with ID:', newGroupId);
        
        // Показываем сообщение об успехе
        setInfoMessage({
          text: "New group created successfully",
          type: MessageBarType.success
        });
        
        // Сохраняем ID новой записи для выделения зелёной рамкой
        setNewlyCreatedGroupId(newGroupId);
        
        // Перезагружаем данные для отображения новой записи
        await loadData();
        
        // Автоматически переводим новую запись в режим редактирования
        setTimeout(() => {
          console.log('[ManageGroupsContent] Auto-starting edit mode for new group:', newGroupId);
          handleStartEdit(newGroupId);
        }, 100);
        
        console.log('[ManageGroupsContent] Data reloaded after creating new group, highlighting new record');
      } else {
        throw new Error('Failed to create new group record');
      }
    } catch (error) {
      console.error('[ManageGroupsContent] Error creating new group:', error);
      setInfoMessage({
        text: `Error creating new group: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      // Закрываем диалог в любом случае
      setIsNewGroupDialogOpen(false);
    }
  };

  // ОБРАБОТЧИКИ для создания новой группы с проверкой несохранённых изменений

  // Главный обработчик для кнопки New
  const handleAddNewGroup = (): void => {
    console.log('[ManageGroupsContent] Add new group button clicked');
    
    // Проверяем, есть ли несохранённые изменения
    if (hasUnsavedChanges) {
      console.log('[ManageGroupsContent] Unsaved changes detected, showing warning dialog');
      setIsUnsavedChangesDialogOpen(true);
    } else {
      console.log('[ManageGroupsContent] No unsaved changes, proceeding with new group creation');
      handleProceedWithNewGroup();
    }
  };

  // Сохранить изменения и создать новую запись
  const handleSaveAndContinue = async (): Promise<void> => {
    console.log('[ManageGroupsContent] Save and continue with new group');
    setIsUnsavedChangesDialogOpen(false);
    
    try {
      // Сначала сохраняем текущие изменения
      await handleSaveAllChanges();
      
      // После успешного сохранения сразу создаём новую запись БЕЗ дополнительного диалога
      setTimeout(async () => {
        console.log('[ManageGroupsContent] Auto-creating new group after save');
        await handleConfirmNewGroup(); // Сразу создаём, минуя диалог подтверждения
      }, 500);
    } catch (error) {
      console.error('[ManageGroupsContent] Error during save and continue:', error);
      // При ошибке сохранения не создаём новую запись
    }
  };

  // Отменить создание новой записи (остаться в режиме редактирования)
  const handleCancelNewGroup = (): void => {
    console.log('[ManageGroupsContent] New group creation cancelled - staying in edit mode');
    setIsUnsavedChangesDialogOpen(false);
  };

  // Обработчик отмены создания новой группы (для основного диалога)
  const handleCancelNewGroupDialog = (): void => {
    console.log('[ManageGroupsContent] New group creation dialog cancelled');
    setIsNewGroupDialogOpen(false);
  };

  // Обработчики для удаления/восстановления
  const handleDeleteGroup = async (groupId: string): Promise<void> => {
    if (!departmentService) {
      console.error('[ManageGroupsContent] DepartmentService not available for delete operation');
      throw new Error('Service not available');
    }

    console.log('[ManageGroupsContent] Deleting group with ID:', groupId);

    try {
      // Вызываем реальный метод сервиса для удаления
      const success = await departmentService.markGroupAsDeleted(groupId);
      
      if (!success) {
        throw new Error('Failed to delete group on server');
      }

      console.log('[ManageGroupsContent] Group deleted successfully, reloading data');
      
      // Показываем сообщение об успехе
      setInfoMessage({
        text: "Group deleted successfully",
        type: MessageBarType.success
      });
      
      // Перезагружаем данные после успешного удаления
      await loadData();
      
    } catch (error) {
      console.error('[ManageGroupsContent] Error deleting group:', error);
      setInfoMessage({
        text: `Error deleting group: ${error}`,
        type: MessageBarType.error
      });
      throw error;
    }
  };

  const handleRestoreGroup = async (groupId: string): Promise<void> => {
    if (!departmentService) {
      console.error('[ManageGroupsContent] DepartmentService not available for restore operation');
      throw new Error('Service not available');
    }

    console.log('[ManageGroupsContent] Restoring group with ID:', groupId);

    try {
      // Вызываем реальный метод сервиса для восстановления
      const success = await departmentService.markGroupAsActive(groupId);
      
      if (!success) {
        throw new Error('Failed to restore group on server');
      }

      console.log('[ManageGroupsContent] Group restored successfully, reloading data');
      
      // Показываем сообщение об успехе
      setInfoMessage({
        text: "Group restored successfully",
        type: MessageBarType.success
      });
      
      // Перезагружаем данные после успешного восстановления
      await loadData();
      
    } catch (error) {
      console.error('[ManageGroupsContent] Error restoring group:', error);
      setInfoMessage({
        text: `Error restoring group: ${error}`,
        type: MessageBarType.error
      });
      throw error;
    }
  };

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '10px'
        }}>
          <h2 style={{ margin: 0 }}>
            Manage Groups
          </h2>
          <PrimaryButton
            text="Go Back"
            iconProps={{ iconName: 'Back' }}
            onClick={onGoBack}
            styles={{
              root: {
                backgroundColor: '#0078d4',
                border: 'none'
              }
            }}
          />
        </div>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Current User ID: {props.currentUserId}
          {error && <span style={{ color: 'red', marginLeft: '10px' }}>Error: {error}</span>}
        </p>
      </div>

      {/* Информационное сообщение */}
      {infoMessage && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar 
            messageBarType={infoMessage.type}
            onDismiss={() => setInfoMessage(null)}
            dismissButtonAriaLabel="Close"
          >
            {infoMessage.text}
          </MessageBar>
        </div>
      )}

      {/* Панель управления (кнопки New и Save + Show Deleted) */}
      <GroupsControlPanel
        isLoading={isLoading || isSaving}
        onAddNewGroup={handleAddNewGroup}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveChanges={handleSaveAllChanges}
        showDeleted={showDeleted}
        onShowDeletedChange={handleShowDeletedChange}
      />

      {/* Таблица групп */}
      <div style={{ flex: 1, marginTop: '15px' }}>
        <GroupsTable
          groups={groups}
          isLoading={isLoading}
          showDeleted={showDeleted}
          onDeleteGroup={handleDeleteGroup}
          onRestoreGroup={handleRestoreGroup}
          editingGroupIds={editingGroupIds}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onGetChangedData={handleRegisterGetChangedData}
          // НОВЫЙ PROP для выделения новых записей
          newlyCreatedGroupId={newlyCreatedGroupId}
        />
      </div>

      {/* Диалог подтверждения создания новой группы */}
      <ConfirmDialog
        isOpen={isNewGroupDialogOpen}
        title="Create New Group"
        message="Are you sure you want to create a new group?"
        confirmButtonText="Create"
        cancelButtonText="Cancel"
        onConfirm={handleConfirmNewGroup}
        onDismiss={handleCancelNewGroupDialog}
        confirmButtonColor="#107c10"
      />

      {/* Диалог предупреждения о несохранённых изменениях */}
      <Dialog
        hidden={!isUnsavedChangesDialogOpen}
        onDismiss={handleCancelNewGroup}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Unsaved Changes',
          subText: `You have ${editingCount} unsaved ${editingCount === 1 ? 'change' : 'changes'}. Please save your changes before creating a new group.`
        }}
        modalProps={{
          isBlocking: true,
          styles: { main: { maxWidth: 450 } }
        }}
      >
        <DialogFooter>
          <PrimaryButton 
            onClick={handleSaveAndContinue} 
            text="Save & Continue"
            styles={{
              root: { backgroundColor: '#0078d4', borderColor: '#0078d4' }
            }}
          />
          <DefaultButton 
            onClick={handleCancelNewGroup} 
            text="Cancel"
          />
        </DialogFooter>
      </Dialog>
    </div>
  );
};