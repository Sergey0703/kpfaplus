// src/webparts/kpfaplus/components/Tabs/SRSTab/SRSTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';

// Импортируем новые компоненты
import { SRSFilterControls } from './components/SRSFilterControls';
import { SRSTable } from './components/SRSTable';

// Импортируем главный хук логики
import { useSRSTabLogic } from './utils/useSRSTabLogic';

// Импортируем интерфейсы 
import { ISRSTableOptions, ISRSRecord, SRSTableOptionsHelper } from './utils/SRSTabInterfaces';
import { SRSDataMapper } from './utils/SRSDataMapper';

export const SRSTab: React.FC<ITabProps> = (props): JSX.Element => {
  const { selectedStaff } = props;
  
  console.log('[SRSTab] Rendering with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffName: selectedStaff?.name
  });
  
  // Используем главный хук логики (как в ScheduleTab) с поддержкой праздников
  const srsLogic = useSRSTabLogic(props);

  console.log('[SRSTab] SRS Logic state with types of leave and holidays support:', {
    recordsCount: srsLogic.srsRecords.length,
    totalHours: srsLogic.totalHours,
    fromDate: srsLogic.fromDate.toLocaleDateString(),
    toDate: srsLogic.toDate.toLocaleDateString(),
    isLoading: srsLogic.isLoadingSRS,
    hasError: !!srsLogic.errorSRS,
    isDataValid: srsLogic.isDataValid,
    // Информация о типах отпусков
    typesOfLeaveCount: srsLogic.typesOfLeave.length,
    isLoadingTypesOfLeave: srsLogic.isLoadingTypesOfLeave,
    // *** НОВОЕ: Информация о праздниках ***
    holidaysCount: srsLogic.holidays.length,
    isLoadingHolidays: srsLogic.isLoadingHolidays
  });

  // Создание опций для таблицы с типами отпусков
  const tableOptions: ISRSTableOptions = React.useMemo(() => {
    console.log('[SRSTab] Creating table options with types of leave and holidays context:', {
      typesOfLeaveCount: srsLogic.typesOfLeave.length,
      isLoadingTypesOfLeave: srsLogic.isLoadingTypesOfLeave,
      holidaysCount: srsLogic.holidays.length,
      isLoadingHolidays: srsLogic.isLoadingHolidays
    });

    // Создаем стандартные опции
    const standardOptions = SRSTableOptionsHelper.createStandardOptions();
    
    // Создаем опции для типов отпусков
    const typesOfLeaveForOptions = srsLogic.typesOfLeave.map(type => ({
      id: type.id,
      title: type.title,
      color: type.color
    }));
    
    const leaveTypesOptions = SRSTableOptionsHelper.createLeaveTypesOptions(typesOfLeaveForOptions);
    
    console.log('[SRSTab] Created leave types options:', {
      optionsCount: leaveTypesOptions.length,
      options: leaveTypesOptions.map(opt => ({ key: opt.key, text: opt.text }))
    });

    return {
      ...standardOptions,
      leaveTypes: leaveTypesOptions
    };
  }, [srsLogic.typesOfLeave, srsLogic.isLoadingTypesOfLeave, srsLogic.holidays.length, srsLogic.isLoadingHolidays]);

  // Преобразуем IStaffRecord[] в ISRSRecord[] для компонентов
  const srsRecordsForTable: ISRSRecord[] = React.useMemo(() => {
    console.log('[SRSTab] Converting staff records to SRS records with types of leave and holidays context:', {
      originalCount: srsLogic.srsRecords.length,
      typesOfLeaveAvailable: srsLogic.typesOfLeave.length,
      holidaysAvailable: srsLogic.holidays.length
    });

    const mappedRecords = SRSDataMapper.mapStaffRecordsToSRSRecords(srsLogic.srsRecords);
    
    console.log('[SRSTab] Mapped SRS records for table:', {
      originalCount: srsLogic.srsRecords.length,
      mappedCount: mappedRecords.length
    });

    // Логируем статистику по типам отпусков
    if (mappedRecords.length > 0) {
      const typeStats = mappedRecords.reduce((acc, record) => {
        const typeKey = record.typeOfLeave || 'No Type';
        acc[typeKey] = (acc[typeKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[SRSTab] Types of leave distribution in mapped records:', typeStats);

      // *** НОВОЕ: Логируем статистику по праздникам ***
      const holidayStats = mappedRecords.reduce((acc, record) => {
        const isHoliday = record.Holiday === 1;
        acc[isHoliday ? 'Holiday' : 'Regular'] = (acc[isHoliday ? 'Holiday' : 'Regular'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[SRSTab] Holiday distribution in mapped records:', holidayStats);
    }

    return mappedRecords;
  }, [srsLogic.srsRecords, srsLogic.typesOfLeave.length, srsLogic.holidays.length]);

  // Обработчик изменения типа отпуска
  const handleTypeOfLeaveChange = React.useCallback((item: ISRSRecord, value: string) => {
    console.log('[SRSTab] Type of leave change requested:', {
      itemId: item.id,
      oldValue: item.typeOfLeave,
      newValue: value
    });

    // Находим тип отпуска в справочнике для дополнительной информации
    const selectedType = srsLogic.typesOfLeave.find(type => type.id === value);
    if (selectedType) {
      console.log('[SRSTab] Selected type of leave details:', {
        id: selectedType.id,
        title: selectedType.title,
        color: selectedType.color
      });
    }

    // Делегируем обработку в главный хук логики
    srsLogic.onTypeOfLeaveChange(item, value);
  }, [srsLogic.typesOfLeave, srsLogic.onTypeOfLeaveChange]);

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
      {/* *** ОБНОВЛЕНО: Заголовок с информацией о праздниках *** */}
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '20px'
      }}>
        SRS for {selectedStaff.name}
        
        {/* Индикатор загрузки типов отпусков */}
        {srsLogic.isLoadingTypesOfLeave && (
          <span style={{
            fontSize: '12px',
            color: '#666',
            marginLeft: '10px'
          }}>
            (Loading types of leave...)
          </span>
        )}
        
        {/* *** НОВОЕ: Индикатор загрузки праздников *** */}
        {srsLogic.isLoadingHolidays && (
          <span style={{
            fontSize: '12px',
            color: '#666',
            marginLeft: '10px'
          }}>
            (Loading holidays...)
          </span>
        )}
        
        {/* Информация о доступных данных */}
        {srsLogic.typesOfLeave.length > 0 && !srsLogic.isLoadingTypesOfLeave && (
          <span style={{
            fontSize: '12px',
            color: '#107c10',
            marginLeft: '10px'
          }}>
            ({srsLogic.typesOfLeave.length} types of leave available)
          </span>
        )}
        
        {/* *** НОВОЕ: Информация о праздниках *** */}
        {srsLogic.holidays.length > 0 && !srsLogic.isLoadingHolidays && (
          <span style={{
            fontSize: '12px',
            color: '#ff69b4',
            marginLeft: '10px'
          }}>
            ({srsLogic.holidays.length} holidays in period)
          </span>
        )}
      </div>
      
      {/* Панель управления - передаем данные из srsLogic */}
      <SRSFilterControls
        fromDate={srsLogic.fromDate}
        toDate={srsLogic.toDate}
        totalHours={srsLogic.totalHours}
        isLoading={srsLogic.isLoadingSRS || srsLogic.isLoadingTypesOfLeave || srsLogic.isLoadingHolidays} // *** ОБНОВЛЕНО: Учитываем загрузку праздников ***
        onFromDateChange={srsLogic.onFromDateChange}
        onToDateChange={srsLogic.onToDateChange}
        onRefresh={srsLogic.onRefreshData} // *** Включает обновление типов отпусков и праздников ***
        onExportAll={srsLogic.onExportAll}
        onSave={srsLogic.onSave}
        onSaveChecked={srsLogic.onSaveChecked}
        hasChanges={srsLogic.hasUnsavedChanges}
        hasCheckedItems={srsLogic.hasCheckedItems}
      />
      
      {/* *** ОБНОВЛЕНО: Отображение ошибок загрузки (включая праздники) *** */}
      {srsLogic.errorSRS && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '10px',
          fontSize: '12px',
          color: '#dc2626'
        }}>
          Error loading data: {srsLogic.errorSRS}
        </div>
      )}
      
      {/* Таблица SRS - передаем все необходимые обработчики включая типы отпусков */}
      <SRSTable
        items={srsRecordsForTable}
        options={tableOptions}
        isLoading={srsLogic.isLoadingSRS || srsLogic.isLoadingTypesOfLeave || srsLogic.isLoadingHolidays} // *** ОБНОВЛЕНО: Учитываем загрузку праздников ***
        onItemChange={srsLogic.onItemChange}
        onLunchTimeChange={srsLogic.onLunchTimeChange}
        onContractNumberChange={srsLogic.onContractNumberChange}
        onTypeOfLeaveChange={handleTypeOfLeaveChange}
      />
      
      {/* *** ОБНОВЛЕНО: Отладочная информация с праздниками *** */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          fontSize: '11px',
          color: '#666'
        }}>
          <strong>Debug Info:</strong>
          <div>SRS Records: {srsRecordsForTable.length}</div>
          <div>Types of Leave: {srsLogic.typesOfLeave.length}</div>
          <div>Loading Types: {srsLogic.isLoadingTypesOfLeave ? 'Yes' : 'No'}</div>
          {/* *** НОВОЕ: Отладочная информация о праздниках *** */}
          <div>Holidays: {srsLogic.holidays.length}</div>
          <div>Loading Holidays: {srsLogic.isLoadingHolidays ? 'Yes' : 'No'}</div>
          <div>Has Changes: {srsLogic.hasUnsavedChanges ? 'Yes' : 'No'}</div>
          <div>Selected Items: {srsLogic.selectedItemsCount}</div>
          {srsLogic.typesOfLeave.length > 0 && (
            <div>
              Available Types: {srsLogic.typesOfLeave.map(t => t.title).join(', ')}
            </div>
          )}
          {/* *** НОВОЕ: Список праздников в отладочной информации *** */}
          {srsLogic.holidays.length > 0 && (
            <div>
              Holidays in Period: {srsLogic.holidays.map(h => `${h.title} (${new Date(h.date).toLocaleDateString()})`).join(', ')}
            </div>
          )}
          {/* *** НОВОЕ: Статистика праздничных записей *** */}
          {srsRecordsForTable.length > 0 && (
            <div>
              Holiday Records: {srsRecordsForTable.filter(r => r.Holiday === 1).length} of {srsRecordsForTable.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
};