// src/webparts/kpfaplus/components/Tabs/SRSTab/SRSTab.tsx
import * as React from 'react';
import { useState, useCallback } from 'react';
import { ITabProps } from '../../../models/types';
// Убираем неиспользуемый импорт: import { useDataContext } from '../../../context';

// Импортируем новые компоненты
import { SRSFilterControls } from './components/SRSFilterControls';
import { SRSTable } from './components/SRSTable';

// Импортируем интерфейсы
import { 
  ISRSRecord, 
  ISRSTableOptions,
  ISRSTabState 
} from './utils/SRSTabInterfaces';

export const SRSTab: React.FC<ITabProps> = (props): JSX.Element => {
  const { selectedStaff } = props;
  
  // Получаем данные из контекста
  // const { currentUser } = useDataContext(); // Убираем, так как не используется
  
  // Временное состояние с mock данными (позже заменим на хуки)
  const [state, setState] = useState<ISRSTabState>({
    fromDate: new Date(2025, 4, 3), // 03.05.2025
    toDate: new Date(2025, 4, 3),   // 03.05.2025
    srsData: [
      {
        id: '1',
        date: new Date(2024, 11, 1), // 01.12.2024
        dayOfWeek: 'Sun',
        hours: '7.50',
        relief: true,
        startWork: { hours: '08', minutes: '00' },
        finishWork: { hours: '16', minutes: '00' },
        lunch: '30',
        typeOfLeave: 'Unpaid Leave',
        timeLeave: '7.50',
        shift: 1,
        contract: '1',
        contractCheck: true,
        status: 'positive',
        srs: true,
        checked: false,
        deleted: false
      }
    ],
    totalHours: '127.00',
    isLoading: false,
    error: undefined,
    hasUnsavedChanges: false,
    selectedItems: new Set<string>()
  });

  // Опции для выпадающих списков
  const tableOptions: ISRSTableOptions = {
    hours: Array.from({ length: 24 }, (_, i) => ({
      key: i.toString().padStart(2, '0'),
      text: i.toString().padStart(2, '0')
    })),
    minutes: Array.from({ length: 12 }, (_, i) => {
      const value = (i * 5).toString().padStart(2, '0');
      return { key: value, text: value };
    }),
    lunchTimes: Array.from({ length: 13 }, (_, i) => {
      const value = (i * 5).toString();
      return { key: value, text: value };
    }),
    leaveTypes: [
      { key: '', text: 'None' },
      { key: 'Unpaid Leave', text: 'Unpaid Leave' },
      { key: 'Adoptive Leave', text: 'Adoptive Leave' },
      { key: 'Sick Leave', text: 'Sick Leave' },
      { key: 'Annual Leave', text: 'Annual Leave' }
    ],
    contractNumbers: [
      { key: '1', text: '1' },
      { key: '2', text: '2' },
      { key: '3', text: '3' }
    ]
  };

  // Обработчики для FilterControls
  const handleFromDateChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[SRSTab] From date changed to:', date.toISOString());
      setState(prev => ({ ...prev, fromDate: date }));
    }
  }, []);

  const handleToDateChange = useCallback((date: Date | undefined): void => {
    if (date) {
      console.log('[SRSTab] To date changed to:', date.toISOString());
      setState(prev => ({ ...prev, toDate: date }));
    }
  }, []);

  const handleRefresh = useCallback((): void => {
    console.log('[SRSTab] Refresh clicked');
    // Пока заглушка - в будущем здесь будет загрузка данных
    setState(prev => ({ ...prev, isLoading: true }));
    setTimeout(() => {
      setState(prev => ({ ...prev, isLoading: false }));
    }, 1000);
  }, []);

  const handleExportAll = useCallback((): void => {
    console.log('[SRSTab] Export all clicked');
    // Пока заглушка - в будущем здесь будет экспорт
  }, []);

  const handleSave = useCallback((): void => {
    console.log('[SRSTab] Save clicked');
    // Пока заглушка - в будущем здесь будет сохранение изменений
    setState(prev => ({ ...prev, hasUnsavedChanges: false }));
  }, []);

  const handleSaveChecked = useCallback((): void => {
    console.log('[SRSTab] Save checked clicked');
    // Пока заглушка - в будущем здесь будет сохранение отмеченных записей
    setState(prev => ({ 
      ...prev, 
      hasUnsavedChanges: false,
      selectedItems: new Set()
    }));
  }, []);

  // Обработчики для таблицы (пока не используются, но могут понадобиться позже)
  const handleItemChange = useCallback((item: ISRSRecord, field: string, value: string | boolean | number | { hours: string; minutes: string }): void => {
    console.log(`[SRSTab] Item ${item.id} field ${field} changed to:`, value);
    
    setState(prev => ({
      ...prev,
      srsData: prev.srsData.map(record => 
        record.id === item.id 
          ? { ...record, [field]: value }
          : record
      ),
      hasUnsavedChanges: true
    }));
  }, []);

  /*
  const handleItemCheck = useCallback((itemId: string, checked: boolean): void => {
    console.log(`[SRSTab] Item ${itemId} checked:`, checked);
    
    setState(prev => {
      const newSelectedItems = new Set(prev.selectedItems);
      if (checked) {
        newSelectedItems.add(itemId);
      } else {
        newSelectedItems.delete(itemId);
      }
      
      return {
        ...prev,
        srsData: prev.srsData.map(record => 
          record.id === itemId 
            ? { ...record, checked }
            : record
        ),
        selectedItems: newSelectedItems
      };
    });
  }, []);

  const handleSelectAll = useCallback((checked: boolean): void => {
    console.log('[SRSTab] Select all:', checked);
    
    setState(prev => ({
      ...prev,
      srsData: prev.srsData.map(record => ({ ...record, checked })),
      selectedItems: checked 
        ? new Set(prev.srsData.map(record => record.id))
        : new Set()
    }));
  }, []);
  */

  // Вычисляемые значения
  const hasCheckedItems = state.srsData.some(item => item.checked);

  if (!selectedStaff) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
        fontSize: '14px',
        color: '#666'
      }}>
        Please select a staff member to view SRS records.
      </div>
    );
  }

  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      padding: '0',
      position: 'relative'
    }}>
      {/* Заголовок - только SRS for [имя] */}
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '20px'
      }}>
        SRS for {selectedStaff.name}
      </div>
      
      {/* Панель управления */}
      <SRSFilterControls
        fromDate={state.fromDate}
        toDate={state.toDate}
        totalHours={state.totalHours}
        isLoading={state.isLoading}
        onFromDateChange={handleFromDateChange}
        onToDateChange={handleToDateChange}
        onRefresh={handleRefresh}
        onExportAll={handleExportAll}
        onSave={handleSave}
        onSaveChecked={handleSaveChecked}
        hasChanges={state.hasUnsavedChanges}
        hasCheckedItems={hasCheckedItems}
      />
      
      {/* Таблица SRS */}
      <SRSTable
        items={state.srsData}
        options={tableOptions}
        isLoading={state.isLoading}
        onItemChange={handleItemChange}
      />
    </div>
  );
};