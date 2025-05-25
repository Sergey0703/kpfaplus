// src/webparts/kpfaplus/components/Tabs/LeavesTab/LeavesTabContent.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ITabProps } from '../../../models/types';
import { TypeOfLeaveService } from '../../../services/TypeOfLeaveService';
import { DaysOfLeavesService } from '../../../services/DaysOfLeavesService';
import { LeavesFilterPanel } from './components/LeavesFilterPanel';
import { LeavesTable } from './components/LeavesTable';
import { useLeavesData } from './utils/useLeavesData';

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

  // Базовые состояния
  const [selectedPeriodStart, setSelectedPeriodStart] = useState<Date>(new Date());
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState<Date>(new Date());
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  const [showDeleted, setShowDeleted] = useState<boolean>(false);

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
      />

      {/* Таблица отпусков */}
      <div style={{ flex: 1, marginTop: '15px' }}>
        <LeavesTable
          leaves={leaves}
          typesOfLeave={typesOfLeave}
          isLoading={isLoading}
          showDeleted={showDeleted}
          selectedTypeFilter={selectedTypeFilter}
        />
      </div>
    </div>
  );
};