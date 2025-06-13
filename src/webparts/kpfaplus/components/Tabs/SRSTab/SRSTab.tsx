// src/webparts/kpfaplus/components/Tabs/SRSTab/SRSTab.tsx
import * as React from 'react';
import { useCallback, useState } from 'react';
import { ITabProps } from '../../../models/types';

// Импортируем новые компоненты
import { SRSFilterControls } from './components/SRSFilterControls';
import { SRSTable } from './components/SRSTable';

// Импортируем главный хук логики
import { useSRSTabLogic } from './utils/useSRSTabLogic';

// Импортируем интерфейсы 
import { ISRSTableOptions, ISRSRecord, SRSTableOptionsHelper } from './utils/SRSTabInterfaces';
import { SRSDataMapper } from './utils/SRSDataMapper';

// *** НОВОЕ: Импортируем компонент диалогов подтверждения ***
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';

export const SRSTab: React.FC<ITabProps> = (props): JSX.Element => {
  const { selectedStaff } = props;
  
  console.log('[SRSTab] Rendering with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffName: selectedStaff?.name
  });
  
  // Используем главный хук логики (как в ScheduleTab) с поддержкой праздников
  const srsLogic = useSRSTabLogic(props);

  // *** НОВОЕ: Состояние для диалогов подтверждения ***
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState({
    isOpen: false,
    recordId: '',
    recordDate: '',
    title: '',
    message: ''
  });

  const [restoreConfirmDialog, setRestoreConfirmDialog] = useState({
    isOpen: false,
    recordId: '',
    recordDate: '',
    title: '',
    message: ''
  });

  console.log('[SRSTab] SRS Logic state with types of leave, holidays, and delete/restore support:', {
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
    // Информация о праздниках
    holidaysCount: srsLogic.holidays.length,
    isLoadingHolidays: srsLogic.isLoadingHolidays,
    // *** НОВОЕ: Информация о функциях удаления ***
    hasDeleteSupport: true,
    hasRestoreSupport: true
  });

  // *** НОВОЕ: Обработчик показа диалога удаления ***
  const showDeleteConfirmDialog = useCallback((recordId: string): void => {
    console.log('[SRSTab] showDeleteConfirmDialog called for record:', recordId);
    
    // Находим запись для получения дополнительной информации
    const record = srsLogic.srsRecords.find(r => r.ID === recordId);
    const recordDate = record ? record.Date.toLocaleDateString() : 'Unknown date';
    
    setDeleteConfirmDialog({
      isOpen: true,
      recordId,
      recordDate,
      title: 'Confirm Deletion',
      message: `Are you sure you want to delete the SRS record for ${selectedStaff?.name} on ${recordDate}? The record will be marked as deleted but can be restored later.`
    });
  }, [srsLogic.srsRecords, selectedStaff?.name]);

  // *** НОВОЕ: Обработчик показа диалога восстановления ***
  const showRestoreConfirmDialog = useCallback((recordId: string): void => {
    console.log('[SRSTab] showRestoreConfirmDialog called for record:', recordId);
    
    // Находим запись для получения дополнительной информации
    const record = srsLogic.srsRecords.find(r => r.ID === recordId);
    const recordDate = record ? record.Date.toLocaleDateString() : 'Unknown date';
    
    setRestoreConfirmDialog({
      isOpen: true,
      recordId,
      recordDate,
      title: 'Confirm Restore',
      message: `Are you sure you want to restore the deleted SRS record for ${selectedStaff?.name} on ${recordDate}?`
    });
  }, [srsLogic.srsRecords, selectedStaff?.name]);

  // *** НОВОЕ: Обработчик подтверждения удаления ***
  const handleDeleteConfirm = useCallback(async (): Promise<void> => {
    const { recordId } = deleteConfirmDialog;
    console.log('[SRSTab] handleDeleteConfirm called for record:', recordId);
    
    if (!recordId) {
      console.error('[SRSTab] No record ID for deletion');
      setDeleteConfirmDialog(prev => ({ ...prev, isOpen: false }));
      return;
    }

    try {
      // TODO: Implement actual delete logic through StaffRecordsService
      // For now, we'll simulate the deletion
      console.log('[SRSTab] Simulating deletion of record:', recordId);
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // TODO: Call actual delete service
      // const success = await deleteStaffRecord(recordId);
      const success = true; // Simulated success
      
      if (success) {
        console.log('[SRSTab] Record deleted successfully:', recordId);
        // Refresh data to show updated state
        srsLogic.onRefreshData();
      } else {
        console.error('[SRSTab] Failed to delete record:', recordId);
      }
      
    } catch (error) {
      console.error('[SRSTab] Error deleting record:', error);
    } finally {
      // Close dialog
      setDeleteConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  }, [deleteConfirmDialog.recordId, srsLogic.onRefreshData]);

  // *** НОВОЕ: Обработчик подтверждения восстановления ***
  const handleRestoreConfirm = useCallback(async (): Promise<void> => {
    const { recordId } = restoreConfirmDialog;
    console.log('[SRSTab] handleRestoreConfirm called for record:', recordId);
    
    if (!recordId) {
      console.error('[SRSTab] No record ID for restore');
      setRestoreConfirmDialog(prev => ({ ...prev, isOpen: false }));
      return;
    }

    try {
      // TODO: Implement actual restore logic through StaffRecordsService
      // For now, we'll simulate the restoration
      console.log('[SRSTab] Simulating restoration of record:', recordId);
      
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // TODO: Call actual restore service
      // const success = await restoreStaffRecord(recordId);
      const success = true; // Simulated success
      
      if (success) {
        console.log('[SRSTab] Record restored successfully:', recordId);
        // Refresh data to show updated state
        srsLogic.onRefreshData();
      } else {
        console.error('[SRSTab] Failed to restore record:', recordId);
      }
      
    } catch (error) {
      console.error('[SRSTab] Error restoring record:', error);
    } finally {
      // Close dialog
      setRestoreConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  }, [restoreConfirmDialog.recordId, srsLogic.onRefreshData]);

  // *** НОВОЕ: Обработчики закрытия диалогов ***
  const handleDeleteCancel = useCallback((): void => {
    console.log('[SRSTab] Delete dialog cancelled');
    setDeleteConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleRestoreCancel = useCallback((): void => {
    console.log('[SRSTab] Restore dialog cancelled');
    setRestoreConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  // *** НОВОЕ: Функции-заглушки для удаления/восстановления (пока API не готово) ***
  const onDeleteItem = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[SRSTab] onDeleteItem called for record:', recordId);
    
    // TODO: Replace with actual delete service call
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // TODO: Implement actual delete logic
      // const staffRecordsService = StaffRecordsService.getInstance(context);
      // const result = await staffRecordsService.deleteStaffRecord(recordId, currentUserId);
      // return result.success;
      
      console.log('[SRSTab] Record deletion simulated successfully');
      return true; // Simulated success
      
    } catch (error) {
      console.error('[SRSTab] Error in onDeleteItem:', error);
      return false;
    }
  }, []);

  const onRestoreItem = useCallback(async (recordId: string): Promise<boolean> => {
    console.log('[SRSTab] onRestoreItem called for record:', recordId);
    
    // TODO: Replace with actual restore service call
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // TODO: Implement actual restore logic
      // const staffRecordsService = StaffRecordsService.getInstance(context);
      // const result = await staffRecordsService.restoreStaffRecord(recordId, currentUserId);
      // return result.success;
      
      console.log('[SRSTab] Record restoration simulated successfully');
      return true; // Simulated success
      
    } catch (error) {
      console.error('[SRSTab] Error in onRestoreItem:', error);
      return false;
    }
  }, []);

  // Создание опций для таблицы с типами отпусков
  const tableOptions: ISRSTableOptions = React.useMemo(() => {
    console.log('[SRSTab] Creating table options with types of leave, holidays, and delete/restore support:', {
      typesOfLeaveCount: srsLogic.typesOfLeave.length,
      isLoadingTypesOfLeave: srsLogic.isLoadingTypesOfLeave,
      holidaysCount: srsLogic.holidays.length,
      isLoadingHolidays: srsLogic.isLoadingHolidays,
      deleteRestoreSupport: true
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
    console.log('[SRSTab] Converting staff records to SRS records with types of leave, holidays, and delete support:', {
      originalCount: srsLogic.srsRecords.length,
      typesOfLeaveAvailable: srsLogic.typesOfLeave.length,
      holidaysAvailable: srsLogic.holidays.length,
      deleteRestoreEnabled: true
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

      // Логируем статистику по праздникам
      const holidayStats = mappedRecords.reduce((acc, record) => {
        const isHoliday = record.Holiday === 1;
        acc[isHoliday ? 'Holiday' : 'Regular'] = (acc[isHoliday ? 'Holiday' : 'Regular'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[SRSTab] Holiday distribution in mapped records:', holidayStats);

      // *** НОВОЕ: Логируем статистику по удаленным записям ***
      const deleteStats = SRSTableOptionsHelper.getDeletedRecordsStatistics(mappedRecords);
      console.log('[SRSTab] Delete statistics in mapped records:', deleteStats);
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
      {/* Заголовок с информацией о праздниках и функциях удаления */}
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
        
        {/* Индикатор загрузки праздников */}
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
        
        {/* Информация о праздниках */}
        {srsLogic.holidays.length > 0 && !srsLogic.isLoadingHolidays && (
          <span style={{
            fontSize: '12px',
            color: '#ff69b4',
            marginLeft: '10px'
          }}>
            ({srsLogic.holidays.length} holidays in period)
          </span>
        )}

        {/* *** НОВОЕ: Информация о функциях удаления *** */}
        <span style={{
          fontSize: '12px',
          color: '#0078d4',
          marginLeft: '10px'
        }}>
          (Delete/Restore enabled)
        </span>
      </div>
      
      {/* Панель управления - передаем данные из srsLogic */}
      <SRSFilterControls
        fromDate={srsLogic.fromDate}
        toDate={srsLogic.toDate}
        totalHours={srsLogic.totalHours}
        isLoading={srsLogic.isLoadingSRS || srsLogic.isLoadingTypesOfLeave || srsLogic.isLoadingHolidays}
        onFromDateChange={srsLogic.onFromDateChange}
        onToDateChange={srsLogic.onToDateChange}
        onRefresh={srsLogic.onRefreshData}
        onExportAll={srsLogic.onExportAll}
        onSave={srsLogic.onSave}
        onSaveChecked={srsLogic.onSaveChecked}
        hasChanges={srsLogic.hasUnsavedChanges}
        hasCheckedItems={srsLogic.hasCheckedItems}
      />
      
      {/* Отображение ошибок загрузки (включая праздники) */}
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
      
      {/* Таблица SRS с поддержкой удаления/восстановления */}
      <SRSTable
        items={srsRecordsForTable}
        options={tableOptions}
        isLoading={srsLogic.isLoadingSRS || srsLogic.isLoadingTypesOfLeave || srsLogic.isLoadingHolidays}
        onItemChange={srsLogic.onItemChange}
        onLunchTimeChange={srsLogic.onLunchTimeChange}
        onContractNumberChange={srsLogic.onContractNumberChange}
        onTypeOfLeaveChange={handleTypeOfLeaveChange}
        showDeleteConfirmDialog={showDeleteConfirmDialog}
        showRestoreConfirmDialog={showRestoreConfirmDialog}
        onDeleteItem={onDeleteItem}
        onRestoreItem={onRestoreItem}
      />
      
      {/* *** НОВОЕ: Диалоги подтверждения удаления и восстановления *** */}
      
      {/* Диалог подтверждения удаления */}
      <ConfirmDialog
        isOpen={deleteConfirmDialog.isOpen}
        title={deleteConfirmDialog.title}
        message={deleteConfirmDialog.message}
        confirmButtonText="Delete"
        cancelButtonText="Cancel"
        onConfirm={handleDeleteConfirm}
        onDismiss={handleDeleteCancel}
        confirmButtonColor="#d83b01" // Red for delete
      />

      {/* Диалог подтверждения восстановления */}
      <ConfirmDialog
        isOpen={restoreConfirmDialog.isOpen}
        title={restoreConfirmDialog.title}
        message={restoreConfirmDialog.message}
        confirmButtonText="Restore"
        cancelButtonText="Cancel"
        onConfirm={handleRestoreConfirm}
        onDismiss={handleRestoreCancel}
        confirmButtonColor="#107c10" // Green for restore
      />
      
      {/* Отладочная информация с праздниками и функциями удаления */}
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
          <div>Holidays: {srsLogic.holidays.length}</div>
          <div>Loading Holidays: {srsLogic.isLoadingHolidays ? 'Yes' : 'No'}</div>
          <div>Has Changes: {srsLogic.hasUnsavedChanges ? 'Yes' : 'No'}</div>
          <div>Selected Items: {srsLogic.selectedItemsCount}</div>
          {/* *** НОВОЕ: Отладочная информация о удалении *** */}
          <div>Delete Support: Enabled</div>
          <div>Restore Support: Enabled</div>
          <div>Delete Dialog Open: {deleteConfirmDialog.isOpen ? 'Yes' : 'No'}</div>
          <div>Restore Dialog Open: {restoreConfirmDialog.isOpen ? 'Yes' : 'No'}</div>
          
          {srsLogic.typesOfLeave.length > 0 && (
            <div>
              Available Types: {srsLogic.typesOfLeave.map(t => t.title).join(', ')}
            </div>
          )}
          {srsLogic.holidays.length > 0 && (
            <div>
              Holidays in Period: {srsLogic.holidays.map(h => `${h.title} (${new Date(h.date).toLocaleDateString()})`).join(', ')}
            </div>
          )}
          {/* *** НОВОЕ: Статистика праздничных и удаленных записей *** */}
          {srsRecordsForTable.length > 0 && (
            <>
              <div>
                Holiday Records: {srsRecordsForTable.filter(r => r.Holiday === 1).length} of {srsRecordsForTable.length}
              </div>
              <div>
                Deleted Records: {srsRecordsForTable.filter(r => r.deleted === true).length} of {srsRecordsForTable.length}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};