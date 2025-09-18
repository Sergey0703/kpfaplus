// src/webparts/kpfaplus/components/Tabs/SRSTab/SRSTab.tsx
import * as React from 'react';
import { useCallback, useState } from 'react';
import { ITabProps } from '../../../models/types';

// Импортируем новые компоненты
import { SRSTable } from './components/SRSTable';

// Импортируем главный хук логики
import { useSRSTabLogic } from './utils/useSRSTabLogic';

// Импортируем интерфейсы 
import { ISRSTableOptions, ISRSRecord, SRSTableOptionsHelper } from './utils/SRSTabInterfaces';
import { SRSDataMapper } from './utils/SRSDataMapper';

// *** НОВОЕ: Импортируем компонент диалогов подтверждения ***
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';

// *** НОВОЕ: Импортируем компонент панели сообщений ***
import { SRSMessagePanel } from './components/SRSMessagePanel';

export const SRSTab: React.FC<ITabProps> = (props): JSX.Element => {
  const { selectedStaff } = props;
  
  console.log('[SRSTab] Rendering with REAL-TIME TOTAL HOURS ARCHITECTURE and HOLIDAYS FROM LIST (Date-only):', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffName: selectedStaff?.name,
    realDeleteRestoreEnabled: true,
    showDeletedSupport: true,
    realTimeTotalHours: true, // *** НОВАЯ АРХИТЕКТУРА ***
    srsTableControlsFilterControls: true, // *** SRSTable теперь контролирует SRSFilterControls ***
    holidaysFromList: true, // *** НОВОЕ: Праздники из списка holidays Date-only, а не из Holiday поля ***
    dateOnlyFormat: true, // *** НОВОЕ: Date-only формат праздников ***
    checkboxFunctionality: true, // *** НОВОЕ: Checkbox функциональность для Check колонки ***
    srsMessagePanelSupport: true // *** НОВОЕ: Поддержка панели сообщений SRS операций ***
  });
  
  // *** ИСПРАВЛЕНО: Используем главный хук логики с поддержкой real-time ***
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

  console.log('[SRSTab] *** SRS Logic state with REAL-TIME TOTAL HOURS and HOLIDAYS FROM LIST (Date-only) + SRS MESSAGE PANEL ***:', {
    recordsCount: srsLogic.srsRecords.length,
    // *** УБРАНО: totalHours больше не в state - вычисляется в SRSTable ***
    fromDate: srsLogic.fromDate.toLocaleDateString(),
    toDate: srsLogic.toDate.toLocaleDateString(),
    isLoading: srsLogic.isLoadingSRS,
    hasError: !!srsLogic.errorSRS,
    isDataValid: srsLogic.isDataValid,
    // Информация о типах отпусков
    typesOfLeaveCount: srsLogic.typesOfLeave.length,
    isLoadingTypesOfLeave: srsLogic.isLoadingTypesOfLeave,
    // *** НОВОЕ: Информация о праздниках из списка Date-only ***
    holidaysCount: srsLogic.holidays.length,
    isLoadingHolidays: srsLogic.isLoadingHolidays,
    holidaysFromList: true, // *** Праздники из списка Date-only, а не из Holiday поля ***
    holidayFormat: 'Date-only (no time component)', // *** НОВОЕ ***
    // *** ИСПРАВЛЕНО: Информация о showDeleted из srsLogic ***
    showDeleted: srsLogic.showDeleted,
    hasToggleShowDeletedHandler: !!srsLogic.onToggleShowDeleted,
    showDeletedSupport: true,
    deletedRecordsCount: srsLogic.srsRecords.filter(r => r.Deleted === 1).length,
    activeRecordsCount: srsLogic.srsRecords.filter(r => r.Deleted !== 1).length,
    // *** ИНФОРМАЦИЯ О РЕАЛЬНЫХ СЕРВИСАХ ***
    hasDeleteSupport: !!srsLogic.onDeleteRecord,
    hasRestoreSupport: !!srsLogic.onRestoreRecord,
    realDeleteRestoreIntegration: 'StaffRecordsService',
    // *** НОВОЕ: Информация о real-time архитектуре ***
    realTimeTotalHoursCalculation: true,
    srsTableManagesFilterControls: true,
    holidayDetectionMethod: 'Holidays list date matching (Date-only), not Holiday field',
    // *** НОВОЕ: Информация о checkbox функциональности ***
    hasCheckboxHandler: !!srsLogic.onItemCheckboxChange,
    checkboxIntegration: 'Saves to Checked column in StaffRecords',
    // *** НОВОЕ: Информация о панели сообщений ***
    hasSRSMessage: !!srsLogic.srsMessage,
    srsMessageType: srsLogic.srsMessage?.type,
    srsMessagePanelIntegration: 'Complete SRS export feedback system'
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
      message: `Are you sure you want to delete the SRS record for ${selectedStaff?.name} on ${recordDate}? The record will be marked as deleted but can be restored later using the StaffRecordsService.`
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
      message: `Are you sure you want to restore the deleted SRS record for ${selectedStaff?.name} on ${recordDate}? This will call StaffRecordsService.restoreDeletedRecord.`
    });
  }, [srsLogic.srsRecords, selectedStaff?.name]);

  // *** НОВОЕ: Обработчик подтверждения удаления ***
  const handleDeleteConfirm = useCallback(async (): Promise<void> => {
    const { recordId } = deleteConfirmDialog;
    console.log('[SRSTab] handleDeleteConfirm called - delegating to REAL srsLogic.onDeleteRecord');
    console.log('[SRSTab] Record ID to delete:', recordId);
    
    if (!recordId) {
      console.error('[SRSTab] No record ID for deletion');
      setDeleteConfirmDialog(prev => ({ ...prev, isOpen: false }));
      return;
    }

    try {
      console.log('[SRSTab] Calling REAL srsLogic.onDeleteRecord (StaffRecordsService.markRecordAsDeleted)');
      
      // *** КЛЮЧЕВОЙ ВЫЗОВ: Используем РЕАЛЬНЫЙ обработчик из useSRSTabLogic ***
      const success = await srsLogic.onDeleteRecord(recordId);
      
      if (success) {
        console.log('[SRSTab] REAL deletion successful via StaffRecordsService.markRecordAsDeleted');
        
        // Показываем уведомление об успехе
        console.log('[SRSTab] Record successfully marked as deleted on server');
        
        // Данные автоматически обновятся через refreshSRSData в useSRSTabLogic
        
      } else {
        console.error('[SRSTab] REAL deletion failed - StaffRecordsService returned false');
        
        // Показываем ошибку пользователю (можно добавить toast notification)
        alert('Failed to delete record. Please try again.');
      }
      
    } catch (error) {
      console.error('[SRSTab] Error during REAL deletion operation:', error);
      
      // Показываем ошибку пользователю
      alert(`Error deleting record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
    } finally {
      // Закрываем диалог
      setDeleteConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  }, [deleteConfirmDialog.recordId, srsLogic.onDeleteRecord]);

  // *** НОВОЕ: Обработчик подтверждения восстановления ***
  const handleRestoreConfirm = useCallback(async (): Promise<void> => {
    const { recordId } = restoreConfirmDialog;
    console.log('[SRSTab] handleRestoreConfirm called - delegating to REAL srsLogic.onRestoreRecord');
    console.log('[SRSTab] Record ID to restore:', recordId);
    
    if (!recordId) {
      console.error('[SRSTab] No record ID for restore');
      setRestoreConfirmDialog(prev => ({ ...prev, isOpen: false }));
      return;
    }

    try {
      console.log('[SRSTab] Calling REAL srsLogic.onRestoreRecord (StaffRecordsService.restoreDeletedRecord)');
      
      // *** КЛЮЧЕВОЙ ВЫЗОВ: Используем РЕАЛЬНЫЙ обработчик из useSRSTabLogic ***
      const success = await srsLogic.onRestoreRecord(recordId);
      
      if (success) {
        console.log('[SRSTab] REAL restoration successful via StaffRecordsService.restoreDeletedRecord');
        
        // Показываем уведомление об успехе
        console.log('[SRSTab] Record successfully restored on server');
        
        // Данные автоматически обновятся через refreshSRSData в useSRSTabLogic
        
      } else {
        console.error('[SRSTab] REAL restoration failed - StaffRecordsService returned false');
        
        // Показываем ошибку пользователю (можно добавить toast notification)
        alert('Failed to restore record. Please try again.');
      }
      
    } catch (error) {
      console.error('[SRSTab] Error during REAL restoration operation:', error);
      
      // Показываем ошибку пользователю
      alert(`Error restoring record: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
    } finally {
      // Закрываем диалог
      setRestoreConfirmDialog(prev => ({ ...prev, isOpen: false }));
    }
  }, [restoreConfirmDialog.recordId, srsLogic.onRestoreRecord]);

  // *** НОВОЕ: Обработчики закрытия диалогов ***
  const handleDeleteCancel = useCallback((): void => {
    console.log('[SRSTab] Delete dialog cancelled');
    setDeleteConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  const handleRestoreCancel = useCallback((): void => {
    console.log('[SRSTab] Restore dialog cancelled');
    setRestoreConfirmDialog(prev => ({ ...prev, isOpen: false }));
  }, []);

  // *** НОВОЕ: Обработчик закрытия панели сообщений ***
  const handleSRSMessageDismiss = useCallback((): void => {
    console.log('[SRSTab] SRS message panel dismissed');
    // Используем setState напрямую для очистки сообщения
    const setState = (srsLogic as any).setState;
    if (setState) {
      setState((prevState: any) => ({
        ...prevState,
        srsMessage: undefined
      }));
    }
  }, [srsLogic]);

  // Создание опций для таблицы с типами отпусков
  const tableOptions: ISRSTableOptions = React.useMemo(() => {
    console.log('[SRSTab] Creating table options with types of leave, holidays from list (Date-only), and delete/restore support:', {
      typesOfLeaveCount: srsLogic.typesOfLeave.length,
      isLoadingTypesOfLeave: srsLogic.isLoadingTypesOfLeave,
      holidaysCount: srsLogic.holidays.length,
      isLoadingHolidays: srsLogic.isLoadingHolidays,
      deleteRestoreSupport: true,
      showDeletedSupport: true,
      holidaysFromList: true, // *** НОВОЕ: Праздники из списка Date-only ***
      holidayFormat: 'Date-only (no time component)', // *** НОВОЕ ***
      checkboxSupport: true, // *** НОВОЕ: Checkbox функциональность ***
      srsMessagePanelSupport: true // *** НОВОЕ: Поддержка панели сообщений ***
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
    console.log('[SRSTab] Converting staff records to SRS records with types of leave, holidays from list (Date-only), delete support, checkbox support, and showDeleted filter:', {
      originalCount: srsLogic.srsRecords.length,
      typesOfLeaveAvailable: srsLogic.typesOfLeave.length,
      holidaysAvailable: srsLogic.holidays.length,
      deleteRestoreEnabled: true,
      showDeleted: srsLogic.showDeleted,
      holidaysFromList: true, // *** НОВОЕ: Праздники из списка Date-only ***
      holidayFormat: 'Date-only (no time component)', // *** НОВОЕ ***
      checkboxFunctionality: true, // *** НОВОЕ: Checkbox функциональность ***
      srsMessagePanelSupport: true // *** НОВОЕ: Поддержка панели сообщений ***
    });

    const mappedRecords = SRSDataMapper.mapStaffRecordsToSRSRecords(srsLogic.srsRecords);
    
    console.log('[SRSTab] Mapped SRS records for table:', {
      originalCount: srsLogic.srsRecords.length,
      mappedCount: mappedRecords.length,
      showDeleted: srsLogic.showDeleted
    });

    // Логируем статистику по типам отпусков
    if (mappedRecords.length > 0) {
      const typeStats = mappedRecords.reduce((acc, record) => {
        const typeKey = record.typeOfLeave || 'No Type';
        acc[typeKey] = (acc[typeKey] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[SRSTab] Types of leave distribution in mapped records:', typeStats);

      // *** НОВОЕ: Логируем статистику по праздникам из списка Date-only вместо Holiday поля ***
      const holidayStats = mappedRecords.reduce((acc, record) => {
        // *** ИЗМЕНЕНО: Используем функцию isHolidayDate для проверки праздников Date-only ***
        const isHoliday = srsLogic.holidays.some(holiday => {
          // УПРОЩЕНО: Прямое сравнение компонентов даты без нормализации времени
          const recordDate = record.date;
          const holidayDate = holiday.date;
          
          return holidayDate.getFullYear() === recordDate.getFullYear() &&
                 holidayDate.getMonth() === recordDate.getMonth() &&
                 holidayDate.getDate() === recordDate.getDate();
        });
        
        acc[isHoliday ? 'Holiday (from list Date-only)' : 'Regular'] = (acc[isHoliday ? 'Holiday (from list Date-only)' : 'Regular'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[SRSTab] Holiday distribution in mapped records (from holidays list Date-only):', holidayStats);

      // *** НОВОЕ: Статистика удаленных записей ***
      const deleteStats = SRSTableOptionsHelper.getDeletedRecordsStatistics(mappedRecords);
      console.log('[SRSTab] Delete statistics in mapped records:', deleteStats);

      // *** НОВОЕ: Статистика checkbox значений ***
      const checkedStats = mappedRecords.reduce((acc, record) => {
        acc[record.checked ? 'Checked' : 'Unchecked'] = (acc[record.checked ? 'Checked' : 'Unchecked'] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('[SRSTab] Checkbox statistics in mapped records:', checkedStats);
      
      // *** НОВОЕ: Логируем информацию о фильтрации ***
      console.log('[SRSTab] ShowDeleted filtering info:', {
        showDeleted: srsLogic.showDeleted,
        totalRecords: deleteStats.totalRecords,
        activeRecords: deleteStats.activeRecords,
        deletedRecords: deleteStats.deletedRecords,
        serverFiltering: 'Records already filtered by server based on showDeleted flag',
        holidayDetection: 'Based on holidays list date matching (Date-only), not Holiday field',
        checkboxSupport: 'Checkbox values from Checked column in StaffRecords'
      });
    }

    return mappedRecords;
  }, [srsLogic.srsRecords, srsLogic.typesOfLeave.length, srsLogic.holidays, srsLogic.showDeleted]);

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
      {/* Заголовок */}
      <div style={{
        fontSize: '16px',
        fontWeight: '600',
        marginBottom: '20px'
      }}>
        SRS for {selectedStaff.name}
      </div>
      
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
      
      {/* *** НОВОЕ: Панель сообщений SRS операций *** */}
      <SRSMessagePanel
        message={srsLogic.srsMessage?.text}
        type={srsLogic.srsMessage?.type}
        details={srsLogic.srsMessage?.details}
        onDismiss={handleSRSMessageDismiss}
      />
      
      {/* *** КЛЮЧЕВОЕ ИЗМЕНЕНИЕ: SRSTable теперь управляет SRSFilterControls и Total Hours, получает holidays Date-only *** */}
      <SRSTable
        items={srsRecordsForTable}
        options={tableOptions}
        // *** НОВОЕ: Передаем holidays список для определения праздников Date-only ***
        holidays={srsLogic.holidays}
        isLoading={srsLogic.isLoadingSRS || srsLogic.isLoadingTypesOfLeave || srsLogic.isLoadingHolidays}
        onItemChange={srsLogic.onItemChange}
        onLunchTimeChange={srsLogic.onLunchTimeChange}
        onContractNumberChange={srsLogic.onContractNumberChange}
        onTypeOfLeaveChange={handleTypeOfLeaveChange}
        showDeleteConfirmDialog={showDeleteConfirmDialog}
        showRestoreConfirmDialog={showRestoreConfirmDialog}
        // *** УДАЛЕНО: onDeleteItem и onRestoreItem больше не передаются ***
        // Используем только РЕАЛЬНЫЕ диалоги подтверждения
        
        // *** ИСПРАВЛЕНО: Передаем ОБЯЗАТЕЛЬНЫЕ пропсы для showDeleted из srsLogic ***
        showDeleted={srsLogic.showDeleted}
        onToggleShowDeleted={srsLogic.onToggleShowDeleted}
        onAddShift={srsLogic.onAddShift}
        
        // *** НОВЫЕ ПРОПСЫ: Для управления SRSFilterControls внутри SRSTable ***
        fromDate={srsLogic.fromDate}
        toDate={srsLogic.toDate}
        onFromDateChange={srsLogic.onFromDateChange}
        onToDateChange={srsLogic.onToDateChange}
        onRefresh={srsLogic.onRefreshData}
        onExportAll={srsLogic.onExportAll}
        onSave={srsLogic.onSave}
        onSaveChecked={srsLogic.onSaveChecked}
        hasChanges={srsLogic.hasUnsavedChanges}
        hasCheckedItems={srsLogic.hasCheckedItems}
        
        // *** НОВОЕ: Передаем обработчик checkbox функциональности ***
        onItemCheck={srsLogic.onItemCheckboxChange}
        onSRSButtonClick={srsLogic.onSRSButtonClick}
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
      
      {/* *** ИСПРАВЛЕНО: Отладочная информация с real-time архитектурой и праздниками из списка Date-only + SRS Message Panel *** */}
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
          <strong>Debug Info (Real-time Total Hours + Holidays from List Date-only + Checkbox + SRS Message Panel):</strong>
          <div>SRS Records: {srsRecordsForTable.length}</div>
          <div>Types of Leave: {srsLogic.typesOfLeave.length}</div>
          <div>Loading Types: {srsLogic.isLoadingTypesOfLeave ? 'Yes' : 'No'}</div>
          {/* *** ОБНОВЛЕНО: Информация о праздниках из списка Date-only *** */}
          <div>Holidays from List (Date-only): {srsLogic.holidays.length}</div>
          <div>Loading Holidays: {srsLogic.isLoadingHolidays ? 'Yes' : 'No'}</div>
          <div>Holiday Detection: Date matching with holidays list Date-only (not Holiday field)</div>
          <div>Has Changes: {srsLogic.hasUnsavedChanges ? 'Yes' : 'No'}</div>
          <div>Selected Items: {srsLogic.selectedItemsCount}</div>
          {/* *** НОВОЕ: Отладочная информация о удалении *** */}
          <div>Delete Support: Enabled</div>
          <div>Restore Support: Enabled</div>
          <div>Delete Dialog Open: {deleteConfirmDialog.isOpen ? 'Yes' : 'No'}</div>
          <div>Restore Dialog Open: {restoreConfirmDialog.isOpen ? 'Yes' : 'No'}</div>
          {/* *** ИСПРАВЛЕНО: Отладочная информация о showDeleted из srsLogic *** */}
          <div>Show Deleted (srsLogic): {srsLogic.showDeleted ? 'Yes' : 'No'}</div>
          <div>Show Deleted Support: Enabled</div>
          <div>Toggle Handler Available: {!!srsLogic.onToggleShowDeleted ? 'Yes' : 'No'}</div>
          {/* *** НОВОЕ: Информация о real-time архитектуре *** */}
          <div>Total Hours Calculation: Real-time (in SRSTable)</div>
          <div>SRSTable manages SRSFilterControls: Yes</div>
          <div>Architecture: Simplified (no totalHours in state)</div>
          <div>Holiday Format: Date-only (no time component)</div>
          {/* *** НОВОЕ: Информация о checkbox функциональности *** */}
          <div>Checkbox Handler Available: {!!srsLogic.onItemCheckboxChange ? 'Yes' : 'No'}</div>
          <div>Checkbox Integration: Saves to Checked column in StaffRecords</div>
          {/* *** НОВОЕ: Информация о панели сообщений *** */}
          <div>SRS Message Panel: {srsLogic.srsMessage ? `Active (${srsLogic.srsMessage.type})` : 'No message'}</div>
          <div>SRS Message Support: Complete export feedback system</div>
          
          {srsLogic.typesOfLeave.length > 0 && (
            <div>
              Available Types: {srsLogic.typesOfLeave.map(t => t.title).join(', ')}
            </div>
          )}
          
          {/* *** ОБНОВЛЕНО: Показываем праздники из списка Date-only *** */}
          {srsLogic.holidays.length > 0 && (
            <div>
              Holidays from List (Date-only): {srsLogic.holidays.map(h => `${h.title} (${h.date.toLocaleDateString()})`).join(', ')}
            </div>
          )}
          
          {/* *** НОВОЕ: Статистика праздничных и удаленных записей *** */}
          {srsRecordsForTable.length > 0 && (
            <>
              {/* *** ИЗМЕНЕНО: Подсчет праздничных записей на основе списка праздников Date-only *** */}
              <div>
                Holiday Records (from list Date-only): {srsRecordsForTable.filter(r => {
                  return srsLogic.holidays.some(holiday => {
                    // УПРОЩЕНО: Прямое сравнение компонентов даты без нормализации времени
                    const recordDate = r.date;
                    const holidayDate = holiday.date;
                    
                    return holidayDate.getFullYear() === recordDate.getFullYear() &&
                           holidayDate.getMonth() === recordDate.getMonth() &&
                           holidayDate.getDate() === recordDate.getDate();
                  });
                }).length} of {srsRecordsForTable.length}
              </div>
              <div>
                Deleted Records: {srsRecordsForTable.filter(r => r.deleted === true).length} of {srsRecordsForTable.length}
              </div>
              <div>
                Active Records: {srsRecordsForTable.filter(r => r.deleted !== true).length} of {srsRecordsForTable.length}
              </div>
              {/* *** НОВОЕ: Статистика checkbox значений *** */}
              <div>
                Checked Records: {srsRecordsForTable.filter(r => r.checked === true).length} of {srsRecordsForTable.length}
              </div>
              <div>
                Unchecked Records: {srsRecordsForTable.filter(r => r.checked !== true).length} of {srsRecordsForTable.length}
              </div>
              <div>
                Server Filtering: showDeleted={srsLogic.showDeleted ? 'true' : 'false'}
              </div>
              <div>
                Holiday Detection: Holidays list date matching Date-only (not Holiday field)
              </div>
              <div>
                Checkbox Functionality: Check column saves to Checked field in StaffRecords
              </div>
              <div>
                SRS Message Panel: {srsLogic.srsMessage ? `${srsLogic.srsMessage.type.toUpperCase()} - ${srsLogic.srsMessage.text.substring(0, 50)}${srsLogic.srsMessage.text.length > 50 ? '...' : ''}` : 'No active message'}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};