// src/webparts/kpfaplus/components/Tabs/LeavesTab/LeavesTabContent.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ITabProps } from '../../../models/types';
import { TypeOfLeaveService } from '../../../services/TypeOfLeaveService';
import { DaysOfLeavesService } from '../../../services/DaysOfLeavesService';
import { LeavesFilterPanel } from './components/LeavesFilterPanel';
import { LeavesTable } from './components/LeavesTable';
import { useLeavesData } from './utils/useLeavesData';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';

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
        
        // Перезагружаем данные для отображения новой записи
        await loadData();
        
        console.log('[LeavesTabContent] Data reloaded after creating new leave');
      } else {
        throw new Error('Failed to create new leave record');
      }
    } catch (error) {
      console.error('[LeavesTabContent] Error creating new leave:', error);
      // Здесь можно добавить отображение ошибки пользователю
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
      
      // Перезагружаем данные после успешного удаления
      await loadData();
      
    } catch (error) {
      console.error('[LeavesTabContent] Error deleting leave:', error);
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
      
      // Перезагружаем данные после успешного восстановления
      await loadData();
      
    } catch (error) {
      console.error('[LeavesTabContent] Error restoring leave:', error);
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

      {/* Панель фильтров */}
      <LeavesFilterPanel
        selectedPeriodStart={selectedPeriodStart}
        selectedPeriodEnd={selectedPeriodEnd}
        selectedTypeFilter={selectedTypeFilter}
        showDeleted={showDeleted}
        typesOfLeave={typesOfLeave}
        isLoading={isLoading}
        onPeriodStartChange={handlePeriodStartChange}
        onPeriodEndChange={handlePeriodEndChange}
        onTypeFilterChange={handleTypeFilterChange}
        onShowDeletedChange={handleShowDeletedChange}
        onAddNewLeave={handleAddNewLeave}
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