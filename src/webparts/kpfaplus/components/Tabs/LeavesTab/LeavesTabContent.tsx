// src/webparts/kpfaplus/components/Tabs/LeavesTab/LeavesTabContent.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ITabProps } from '../../../models/types';
import { TypeOfLeaveService } from '../../../services/TypeOfLeaveService';
import { DaysOfLeavesService, ILeaveDay } from '../../../services/DaysOfLeavesService';
import { LeavesFilterPanel } from './components/LeavesFilterPanel';
import { LeavesTable } from './components/LeavesTable';
import { useLeavesData } from './utils/useLeavesData';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { MessageBar, MessageBarType } from '@fluentui/react';

// Интерфейс для информационных сообщений
interface IInfoMessage {
  text: string;
  type: MessageBarType;
}

export const LeavesTabContent: React.FC<ITabProps> = (props) => {
  const { selectedStaff, context } = props;

  console.log('[LeavesTabContent] Rendering with staff:', selectedStaff?.name);

  // Инициализируем сервисы
  const typeOfLeaveService = useMemo(() => {
    if (context) {
      console.log('[LeavesTabContent] Initializing TypeOfLeaveService');
      return TypeOfLeaveService.getInstance(context);
    }
    return undefined;
  }, [context]);

  const daysOfLeavesService = useMemo(() => {
    if (context) {
      console.log('[LeavesTabContent] Initializing DaysOfLeavesService');
      return DaysOfLeavesService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Функция для получения первого и последнего дня текущего месяца
  const getCurrentMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  // Базовые состояния с правильной инициализацией дат
  const { firstDay, lastDay } = getCurrentMonthDates();
  const [selectedPeriodStart, setSelectedPeriodStart] = useState<Date>(firstDay);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState<Date>(lastDay);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

  // Состояние для диалога подтверждения создания нового отпуска
  const [isNewLeaveDialogOpen, setIsNewLeaveDialogOpen] = useState<boolean>(false);

  // НОВЫЕ СОСТОЯНИЯ для управления сохранением
  const [editingLeaveIds, setEditingLeaveIds] = useState<Set<string>>(new Set());
  const [editingCount, setEditingCount] = useState<number>(0); // Добавляем отдельное состояние для счётчика
  const [infoMessage, setInfoMessage] = useState<IInfoMessage | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Ref для хранения функции получения изменённых данных из таблицы
  const getChangedDataFunctionRef = React.useRef<(() => { leaveId: string; changes: Partial<ILeaveDay> }[]) | null>(null);

  console.log('[LeavesTabContent] Initialized dates:', {
    periodStart: selectedPeriodStart.toLocaleDateString(),
    periodEnd: selectedPeriodEnd.toLocaleDateString()
  });

  // Используем хук для работы с данными
  const {
    typesOfLeave,
    leaves,
    isLoading,
    error,
    loadData
  } = useLeavesData({
    typeOfLeaveService,
    daysOfLeavesService,
    selectedStaff,
    currentUserId: props.currentUserId,
    managingGroupId: props.managingGroupId,
    selectedPeriodStart,
    selectedPeriodEnd
  });

  // Загружаем данные при монтировании компонента
  useEffect(() => {
    console.log('[LeavesTabContent] Component mounted, loading initial data');
    loadData();
  }, [loadData]);

  // НОВЫЙ ЭФФЕКТ: Управление информационными сообщениями в зависимости от состояния редактирования
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
  }, [editingCount, isSaving]); // Используем editingCount вместо editingLeaveIds

  // Автоматическое скрытие сообщений через 5 секунд (только для success и error)
  useEffect(() => {
    if (infoMessage && (infoMessage.type === MessageBarType.success || infoMessage.type === MessageBarType.error)) {
      const timer = setTimeout(() => {
        setInfoMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [infoMessage]);

  // Обработчики для фильтров
  const handlePeriodStartChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[LeavesTabContent] Period start changed:', date.toLocaleDateString());
      setSelectedPeriodStart(date);
    }
  };

  const handlePeriodEndChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[LeavesTabContent] Period end changed:', date.toLocaleDateString());
      setSelectedPeriodEnd(date);
    }
  };

  const handleTypeFilterChange = (typeId: string): void => {
    console.log('[LeavesTabContent] Type filter changed:', typeId);
    setSelectedTypeFilter(typeId);
  };

  const handleShowDeletedChange = (checked: boolean): void => {
    console.log('[LeavesTabContent] Show deleted changed:', checked);
    setShowDeleted(checked);
  };

  // Обработчик для создания нового отпуска
  const handleAddNewLeave = (): void => {
    console.log('[LeavesTabContent] Opening new leave confirmation dialog');
    setIsNewLeaveDialogOpen(true);
  };

  // Обработчик подтверждения создания нового отпуска
  const handleConfirmNewLeave = async (): Promise<void> => {
    if (!daysOfLeavesService || !selectedStaff || !selectedStaff.employeeId) {
      console.error('[LeavesTabContent] Cannot create new leave: missing service, staff, or employeeId');
      return;
    }

    if (!props.currentUserId || !props.managingGroupId) {
      console.error('[LeavesTabContent] Cannot create new leave: missing currentUserId or managingGroupId');
      return;
    }

    console.log('[LeavesTabContent] Creating new leave record');

    try {
      // Определяем тип отпуска по умолчанию (первый из списка)
      const defaultTypeOfLeave = typesOfLeave.length > 0 ? parseInt(typesOfLeave[0].id, 10) : 1;

      // Подготавливаем данные для новой записи
      const newLeaveData = {
        title: '', // пустые заметки
        startDate: selectedPeriodStart, // первый день выбранного периода
        endDate: undefined, // открытый отпуск
        staffMemberId: parseInt(selectedStaff.employeeId, 10),
        managerId: parseInt(props.currentUserId, 10),
        staffGroupId: parseInt(props.managingGroupId, 10),
        typeOfLeave: defaultTypeOfLeave,
        deleted: false // Deleted = 0
      };

      console.log('[LeavesTabContent] New leave data:', newLeaveData);

      // Создаем новую запись на сервере
      const newLeaveId = await daysOfLeavesService.createLeave(newLeaveData);

      if (newLeaveId) {
        console.log('[LeavesTabContent] New leave created successfully with ID:', newLeaveId);
        
        // Показываем сообщение об успехе
        setInfoMessage({
          text: "New leave record created successfully",
          type: MessageBarType.success
        });
        
        // Перезагружаем данные для отображения новой записи
        await loadData();
        
        console.log('[LeavesTabContent] Data reloaded after creating new leave');
      } else {
        throw new Error('Failed to create new leave record');
      }
    } catch (error) {
      console.error('[LeavesTabContent] Error creating new leave:', error);
      setInfoMessage({
        text: `Error creating new leave: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      // Закрываем диалог в любом случае
      setIsNewLeaveDialogOpen(false);
    }
  };

  // Обработчик отмены создания нового отпуска
  const handleCancelNewLeave = (): void => {
    console.log('[LeavesTabContent] New leave creation cancelled');
    setIsNewLeaveDialogOpen(false);
  };

  // Callback для регистрации функции получения данных из таблицы
  const handleRegisterGetChangedData = (getDataFunction: () => { leaveId: string; changes: Partial<ILeaveDay> }[]): void => {
    console.log('[LeavesTabContent] Registering getChangedData function from table');
    getChangedDataFunctionRef.current = getDataFunction;
    console.log('[LeavesTabContent] getChangedData function registered, ref is now:', !!getChangedDataFunctionRef.current);
  };

  // НОВЫЕ ОБРАБОТЧИКИ для управления режимом редактирования
  
  // Добавление ID в список редактируемых
  const handleStartEdit = (leaveId: string): void => {
    console.log('[LeavesTabContent] Starting edit for leave:', leaveId);
    setEditingLeaveIds(prev => {
      const newSet = new Set(prev);
      newSet.add(leaveId);
      setEditingCount(newSet.size); // Обновляем счётчик
      return newSet;
    });
  };

  // Удаление ID из списка редактируемых
  const handleCancelEdit = (leaveId: string): void => {
    console.log('[LeavesTabContent] Cancelling edit for leave:', leaveId);
    setEditingLeaveIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(leaveId);
      setEditingCount(newSet.size); // Обновляем счётчик
      return newSet;
    });
  };

  // НОВЫЙ ОБРАБОТЧИК: Глобальное сохранение всех изменений
  const handleSaveAllChanges = async (): Promise<void> => {
    if (editingCount === 0) {
      console.log('[LeavesTabContent] No changes to save');
      return;
    }

    console.log('[LeavesTabContent] Starting batch save for', editingCount, 'items');
    setIsSaving(true);

    try {
      // Получаем изменённые данные из таблицы
      console.log('[LeavesTabContent] Checking if getChangedDataFunctionRef is available:', !!getChangedDataFunctionRef.current);
      
      const changedData = getChangedDataFunctionRef.current ? getChangedDataFunctionRef.current() : [];
      
      console.log('[LeavesTabContent] Retrieved changed data:', changedData);
      
      if (changedData.length === 0) {
        console.log('[LeavesTabContent] No actual changes found to save');
        setInfoMessage({
          text: "No changes found to save",
          type: MessageBarType.warning
        });
        return;
      }

      console.log('[LeavesTabContent] Found changes to save:', changedData);

      // Сохраняем каждое изменение через сервис
      let savedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const item of changedData) {
        try {
          console.log(`[LeavesTabContent] Saving changes for leave ${item.leaveId}:`, item.changes);
          
          if (daysOfLeavesService) {
            const success = await daysOfLeavesService.updateLeave(item.leaveId, item.changes);
            if (success) {
              savedCount++;
              console.log(`[LeavesTabContent] Successfully saved leave ${item.leaveId}`);
            } else {
              errorCount++;
              errors.push(`Failed to save leave ${item.leaveId}`);
            }
          } else {
            throw new Error('DaysOfLeavesService not available');
          }
        } catch (error) {
          errorCount++;
          errors.push(`Error saving leave ${item.leaveId}: ${error}`);
          console.error(`[LeavesTabContent] Error saving leave ${item.leaveId}:`, error);
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
        setEditingLeaveIds(new Set());
        setEditingCount(0);
        
        // Перезагружаем данные
        await loadData();
        
        console.log('[LeavesTabContent] Data reloaded after batch save');
      }

      console.log('[LeavesTabContent] Batch save completed with results:', { savedCount, errorCount });
    } catch (error) {
      console.error('[LeavesTabContent] Error during batch save:', error);
      setInfoMessage({
        text: `Error saving changes: ${error}`,
        type: MessageBarType.error
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLeave = async (leaveId: string): Promise<void> => {
    if (!daysOfLeavesService) {
      console.error('[LeavesTabContent] DaysOfLeavesService not available for delete operation');
      throw new Error('Service not available');
    }

    console.log('[LeavesTabContent] Deleting leave with ID:', leaveId);

    try {
      // Вызываем реальный метод сервиса для удаления
      const success = await daysOfLeavesService.markLeaveAsDeleted(leaveId);
      
      if (!success) {
        throw new Error('Failed to delete leave on server');
      }

      console.log('[LeavesTabContent] Leave deleted successfully, reloading data');
      
      // Показываем сообщение об успехе
      setInfoMessage({
        text: "Leave record deleted successfully",
        type: MessageBarType.success
      });
      
      // Перезагружаем данные после успешного удаления
      await loadData();
      
    } catch (error) {
      console.error('[LeavesTabContent] Error deleting leave:', error);
      setInfoMessage({
        text: `Error deleting leave: ${error}`,
        type: MessageBarType.error
      });
      throw error; // Пробрасываем ошибку для обработки в таблице
    }
  };

  // Обработчик для серверного восстановления отпуска
  const handleRestoreLeave = async (leaveId: string): Promise<void> => {
    if (!daysOfLeavesService) {
      console.error('[LeavesTabContent] DaysOfLeavesService not available for restore operation');
      throw new Error('Service not available');
    }

    console.log('[LeavesTabContent] Restoring leave with ID:', leaveId);

    try {
      // Вызываем реальный метод сервиса для восстановления
      const success = await daysOfLeavesService.markLeaveAsActive(leaveId);
      
      if (!success) {
        throw new Error('Failed to restore leave on server');
      }

      console.log('[LeavesTabContent] Leave restored successfully, reloading data');
      
      // Показываем сообщение об успехе
      setInfoMessage({
        text: "Leave record restored successfully",
        type: MessageBarType.success
      });
      
      // Перезагружаем данные после успешного восстановления
      await loadData();
      
    } catch (error) {
      console.error('[LeavesTabContent] Error restoring leave:', error);
      setInfoMessage({
        text: `Error restoring leave: ${error}`,
        type: MessageBarType.error
      });
      throw error; // Пробрасываем ошибку для обработки в таблице
    }
  };

  // Если сотрудник не выбран
  if (!selectedStaff) {
    return (
      <div style={{ padding: '20px' }}>
        <h3>Please select a staff member</h3>
        <p>Choose a staff member from the left panel to view their leaves.</p>
      </div>
    );
  }

  // Вычисляем, есть ли несохранённые изменения
  const hasUnsavedChanges = editingCount > 0;

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Leaves for {selectedStaff.name}
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {props.managingGroupId} | Staff ID: {selectedStaff.id}
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

      {/* Панель фильтров */}
      <LeavesFilterPanel
        selectedPeriodStart={selectedPeriodStart}
        selectedPeriodEnd={selectedPeriodEnd}
        selectedTypeFilter={selectedTypeFilter}
        showDeleted={showDeleted}
        typesOfLeave={typesOfLeave}
        isLoading={isLoading || isSaving}
        onPeriodStartChange={handlePeriodStartChange}
        onPeriodEndChange={handlePeriodEndChange}
        onTypeFilterChange={handleTypeFilterChange}
        onShowDeletedChange={handleShowDeletedChange}
        onAddNewLeave={handleAddNewLeave}
        hasUnsavedChanges={hasUnsavedChanges}
        onSaveChanges={handleSaveAllChanges}
      />

      {/* Таблица отпусков */}
      <div style={{ flex: 1, marginTop: '15px' }}>
        <LeavesTable
          leaves={leaves}
          typesOfLeave={typesOfLeave}
          isLoading={isLoading}
          showDeleted={showDeleted}
          selectedTypeFilter={selectedTypeFilter}
          onDeleteLeave={handleDeleteLeave}
          onRestoreLeave={handleRestoreLeave}
          // НОВЫЕ PROPS для управления редактированием
          editingLeaveIds={editingLeaveIds}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          // НОВЫЙ PROP для получения изменённых данных
          onGetChangedData={handleRegisterGetChangedData}
        />
      </div>

      {/* Диалог подтверждения создания нового отпуска */}
      <ConfirmDialog
        isOpen={isNewLeaveDialogOpen}
        title="Create New Leave"
        message={`Are you sure you want to create a new leave record for ${selectedStaff.name} starting from ${selectedPeriodStart.toLocaleDateString()}?`}
        confirmButtonText="Create"
        cancelButtonText="Cancel"
        onConfirm={handleConfirmNewLeave}
        onDismiss={handleCancelNewLeave}
        confirmButtonColor="#107c10" // зеленый цвет для создания
      />
    </div>
  );
};