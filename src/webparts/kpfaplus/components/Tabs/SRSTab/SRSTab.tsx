// src/webparts/kpfaplus/components/Tabs/SRSTab/SRSTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';

// Импортируем новые компоненты
import { SRSFilterControls } from './components/SRSFilterControls';
import { SRSTable } from './components/SRSTable';

// Импортируем главный хук логики
import { useSRSTabLogic } from './utils/useSRSTabLogic';

// Импортируем интерфейсы 
import { ISRSTableOptions, ISRSRecord } from './utils/SRSTabInterfaces';
import { SRSDataMapper } from './utils/SRSDataMapper';

export const SRSTab: React.FC<ITabProps> = (props): JSX.Element => {
  const { selectedStaff } = props;
  
  console.log('[SRSTab] Rendering with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffName: selectedStaff?.name
  });
  
  // Используем главный хук логики (как в ScheduleTab)
  const srsLogic = useSRSTabLogic(props);

  console.log('[SRSTab] SRS Logic state:', {
    recordsCount: srsLogic.srsRecords.length,
    totalHours: srsLogic.totalHours,
    fromDate: srsLogic.fromDate.toLocaleDateString(),
    toDate: srsLogic.toDate.toLocaleDateString(),
    isLoading: srsLogic.isLoadingSRS,
    hasError: !!srsLogic.errorSRS,
    isDataValid: srsLogic.isDataValid
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

  // Преобразуем IStaffRecord[] в ISRSRecord[] для компонентов
  const srsRecordsForTable: ISRSRecord[] = React.useMemo(() => {
    return SRSDataMapper.mapStaffRecordsToSRSRecords(srsLogic.srsRecords);
  }, [srsLogic.srsRecords]);

  console.log('[SRSTab] Mapped SRS records for table:', {
    originalCount: srsLogic.srsRecords.length,
    mappedCount: srsRecordsForTable.length
  });

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
      
      {/* Панель управления - передаем данные из srsLogic */}
      <SRSFilterControls
        fromDate={srsLogic.fromDate}
        toDate={srsLogic.toDate}
        totalHours={srsLogic.totalHours}
        isLoading={srsLogic.isLoadingSRS}
        onFromDateChange={srsLogic.onFromDateChange}
        onToDateChange={srsLogic.onToDateChange}
        onRefresh={srsLogic.onRefreshData}
        onExportAll={srsLogic.onExportAll}
        onSave={srsLogic.onSave}
        onSaveChecked={srsLogic.onSaveChecked}
        hasChanges={srsLogic.hasUnsavedChanges}
        hasCheckedItems={srsLogic.hasCheckedItems}
      />
      
      {/* Таблица SRS - передаем все необходимые обработчики */}
      <SRSTable
        items={srsRecordsForTable}
        options={tableOptions}
        isLoading={srsLogic.isLoadingSRS}
        onItemChange={srsLogic.onItemChange}
        onLunchTimeChange={srsLogic.onLunchTimeChange}
        onContractNumberChange={srsLogic.onContractNumberChange}
      />
    </div>
  );
};