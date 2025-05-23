// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  // IDropdownOption, // <-- УДАЛЕНО: не используется напрямую
  DefaultButton
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
// import { IContract } from '../../../models/IContract'; // <-- УДАЛЕНО: используется только в типах
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
// import { IStaffRecord } from '../../../services/StaffRecordsService'; // <-- УДАЛЕНО: используется только в типах
// import { INewShiftData } from './components/ScheduleTable'; // <-- УДАЛЕНО: используется только в типах
import { IExistingRecordCheck } from './utils/ScheduleTabFillInterfaces';
import styles from './ScheduleTab.module.scss';

import { FilterControls } from './components/FilterControls';
import { DayInfo } from './components/DayInfo';
import ScheduleTable, { IScheduleItem, IScheduleOptions } from './components/ScheduleTable';
import { ScheduleTableDialogs } from './components/ScheduleTableDialogs';

import { convertStaffRecordsToScheduleItems } from './utils/ScheduleTabDataUtils';
import {
  handleSaveAllChanges,
  IActionHandlerParams
} from './utils/ScheduleTabActionHandlers';
import {
  fillScheduleFromTemplate
} from './utils/ScheduleTabFillService';

interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

// --- ИСПРАВЛЕНИЕ: Экспортируем ITypeOfLeaveService ---
export interface ITypeOfLeaveService { // <-- ДОБАВЛЕН export
  getAllTypesOfLeave: (forceRefresh?: boolean) => Promise<ITypeOfLeave[]>;
  getTypeOfLeaveById: (id: string | number) => Promise<ITypeOfLeave | undefined>;
}
// ----------------------------------------------------

import { IScheduleTabState } from './utils/useScheduleTabState';
import { UseScheduleTabLogicReturn } from './utils/useScheduleTabLogic';


export interface IScheduleTabContentProps extends IScheduleTabState {
  selectedStaff: ITabProps['selectedStaff'];
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;

  onDateChange: UseScheduleTabLogicReturn['onDateChange'];
  onContractChange: UseScheduleTabLogicReturn['onContractChange'];
  onErrorDismiss: UseScheduleTabLogicReturn['onErrorDismiss'];
  onRefreshData: UseScheduleTabLogicReturn['onRefreshData'];

  onPageChange: UseScheduleTabLogicReturn['onPageChange'];
  onItemsPerPageChange: UseScheduleTabLogicReturn['onItemsPerPageChange'];

  getExistingRecordsWithStatus: UseScheduleTabLogicReturn['getExistingRecordsWithStatus'];
  markRecordsAsDeleted: UseScheduleTabLogicReturn['markRecordsAsDeleted'];
  onAddShift: UseScheduleTabLogicReturn['onAddShift'];
  onUpdateStaffRecord: UseScheduleTabLogicReturn['onUpdateStaffRecord'];
  onCreateStaffRecord: UseScheduleTabLogicReturn['onCreateStaffRecord'];
  onDeleteStaffRecord?: (recordId: string) => Promise<boolean>;
  onRestoreStaffRecord?: (recordId: string) => Promise<boolean>;

  holidaysService?: IHolidaysService;
  daysOfLeavesService?: IDaysOfLeavesService;
  typeOfLeaveService?: ITypeOfLeaveService; // <-- Тип теперь экспортирован

  showDeleted: boolean;
  onToggleShowDeleted: UseScheduleTabLogicReturn['onToggleShowDeleted'];
}


enum DialogType {
  None = 'none',
  EmptySchedule = 'empty',
  ProcessedRecordsBlock = 'processed_block',
  UnprocessedRecordsReplace = 'unprocessed_replace'
}

interface IDialogConfig {
  type: DialogType;
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  confirmButtonColor: string;
  onConfirm: () => void;
}

export const ScheduleTabContent: React.FC<IScheduleTabContentProps> = (props) => {
  const {
    selectedStaff,
    selectedDate,
    contracts,
    selectedContractId,
    isLoading,
    error,
    holidays,
    leaves,
    typesOfLeave,
    holidaysService,
    daysOfLeavesService,
    typeOfLeaveService, // <-- Используется для DayInfo
    onDateChange,
    onContractChange,
    onErrorDismiss,
    staffRecords,
    isLoadingStaffRecords,
    errorStaffRecords,
    currentPage,
    itemsPerPage,
    totalItemCount,
    onPageChange,
    onItemsPerPageChange,
    onUpdateStaffRecord,
    onCreateStaffRecord,
    onDeleteStaffRecord,
    onRestoreStaffRecord,
    onRefreshData,
    onAddShift,
    dayOfStartWeek,
    context,
    currentUserId,
    managingGroupId,
    getExistingRecordsWithStatus,
    markRecordsAsDeleted,
    showDeleted,
    onToggleShowDeleted,
  } = props;

  const selectedContract = contracts.find(c => c.id === selectedContractId);

  const [modifiedRecords, setModifiedRecords] = useState<Record<string, IScheduleItem>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [operationMessage, setOperationMessage] = useState<{
    text: string;
    type: MessageBarType;
  } | undefined>(undefined);

  const [fillDialogConfig, setFillDialogConfig] = useState<IDialogConfig>({
    type: DialogType.None,
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Cancel',
    confirmButtonColor: '',
    onConfirm: () => {}
  });

  React.useEffect(() => {
    console.log('[ScheduleTabContent] Clearing modified records due to date, contract, or staff change');
    setModifiedRecords({});
    setOperationMessage(undefined);
  }, [selectedDate, selectedContractId, selectedStaff?.id]);


  const getScheduleItemsWithModifications = useCallback((): IScheduleItem[] => {
    const baseItems = convertStaffRecordsToScheduleItems(staffRecords || [], selectedContract);

    return baseItems.map(item => {
      if (modifiedRecords[item.id]) {
        return {
          ...item,
          ...modifiedRecords[item.id]
        };
      }
      return item;
    });
  }, [staffRecords, modifiedRecords, selectedContract]);


  const actionHandlerParams: IActionHandlerParams = useMemo(() => ({
    setIsSaving,
    setOperationMessage,
    setModifiedRecords,
    onRefreshData
  }), [setIsSaving, setOperationMessage, setModifiedRecords, onRefreshData]);


  const performFillOperation = async (): Promise<void> => {
    console.log('[ScheduleTabContent] performFillOperation called');

    // Проверяем наличие onCreateStaffRecord, getExistingRecordsWithStatus, markRecordsAsDeleted
    if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId || !onCreateStaffRecord || !getExistingRecordsWithStatus || !markRecordsAsDeleted || !context) {
      console.error('[ScheduleTabContent] Missing required data/functions for fill operation');
       setOperationMessage({
         text: 'Fill operation failed: Missing staff, contract, context, or required functions.',
         type: MessageBarType.error
       });
      return;
    }

    const fillParams = {
      selectedDate,
      selectedStaffId: selectedStaff.id,
      employeeId: selectedStaff.employeeId,
      selectedContract,
      selectedContractId,
      holidays,
      leaves,
      currentUserId,
      managingGroupId,
      dayOfStartWeek,
      context
    };

    const fillHandlers = {
      createStaffRecord: onCreateStaffRecord,
      setOperationMessage,
      setIsSaving,
      onRefreshData,
      getExistingRecordsWithStatus: getExistingRecordsWithStatus,
      markRecordsAsDeleted: markRecordsAsDeleted
    };

    console.log('[ScheduleTabContent] Calling fillScheduleFromTemplate');

    try {
      await fillScheduleFromTemplate(fillParams, fillHandlers);
    } catch (error) {
       console.error('[ScheduleTabContent] Error during fillScheduleFromTemplate:', error);
       setOperationMessage({
         text: `Fill operation failed: ${error instanceof Error ? error.message : String(error)}`,
         type: MessageBarType.error
       });
    }
  };

  const determineDialogType = async (): Promise<IDialogConfig> => {
    console.log('[ScheduleTabContent] determineDialogType called');

    let existingRecords: IExistingRecordCheck[] = [];

    if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId || !getExistingRecordsWithStatus || !markRecordsAsDeleted) {
      console.error('[ScheduleTabContent] Missing required data/functions for dialog determination');
      return {
        type: DialogType.None, isOpen: true, title: 'Error',
        message: 'Cannot check existing records: Missing staff, contract information, or required functions.',
        confirmButtonText: 'OK', cancelButtonText: '', confirmButtonColor: '#d83b01',
        onConfirm: () => setFillDialogConfig(prev => ({ ...prev, isOpen: false }))
      } as IDialogConfig;
    }

    try {
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

      const contractStartDate = selectedContract.startDate ? new Date(selectedContract.startDate) : null;
      const contractFinishDate = selectedContract.finishDate ? new Date(selectedContract.finishDate) : null;

      const firstDay = contractStartDate && !isNaN(contractStartDate.getTime()) && contractStartDate > startOfMonth
        ? contractStartDate
        : startOfMonth;

      const lastDay = contractFinishDate && !isNaN(contractFinishDate.getTime()) && contractFinishDate < endOfMonth
        ? contractFinishDate
        : endOfMonth;

      // --- ИСПРАВЛЕНИЕ: Уточняем типы перед сравнением ---
      if (firstDay && lastDay) { // Убедимся, что обе даты не null
          if (firstDay.getTime() > lastDay.getTime()) {
               console.log('[ScheduleTabContent] Contract period does not overlap with the month, or dates are invalid.');
               return {
                   type: DialogType.EmptySchedule,
                   isOpen: true,
                   title: 'Fill Schedule',
                   message: 'No existing records found for this period (contract may not cover the month or has invalid dates). Do you want to fill based on template?',
                   confirmButtonText: 'Fill',
                   cancelButtonText: 'Cancel',
                   confirmButtonColor: '#107c10',
                   onConfirm: () => {
                       setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
                       void performFillOperation();
                   }
               };
          }
      } else {
          // Если одна из дат null, это тоже может быть проблемой (но логика выше уже должна была бы это обработать)
          console.warn('[ScheduleTabContent] One of the period boundary dates is null, which might indicate an issue.');
      }


      console.log('[ScheduleTabContent] Checking for existing records in period:', {
        firstDay: firstDay?.toISOString(),
        lastDay: lastDay?.toISOString(),
        employeeId: selectedStaff.employeeId,
        currentUserId,
        managingGroupId
      });

      existingRecords = await getExistingRecordsWithStatus(
        firstDay || selectedDate,
        lastDay || selectedDate,
        selectedStaff.employeeId,
        currentUserId,
        managingGroupId
      );

      console.log(`[ScheduleTabContent] Found ${existingRecords.length} existing records`);

      if (existingRecords.length === 0) {
        console.log('[ScheduleTabContent] No existing records - showing empty schedule dialog');
        return {
          type: DialogType.EmptySchedule,
          isOpen: true,
          title: 'Fill Schedule',
          message: 'Do you want to fill the schedule based on template data?',
          confirmButtonText: 'Fill',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#107c10',
          onConfirm: () => {
            setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
            void performFillOperation();
          }
        };
      }

      const { checkRecordsProcessingStatus, createProcessingBlockMessage } = await import(/* webpackChunkName: 'schedule-fill-helpers' */ './utils/ScheduleTabFillHelpers');

      const processingStatus = checkRecordsProcessingStatus(existingRecords);

      console.log('[ScheduleTabContent] Processing status:', {
        totalRecords: processingStatus.totalCount,
        processedRecords: processingStatus.processedCount,
        hasProcessedRecords: processingStatus.hasProcessedRecords
      });

      if (processingStatus.hasProcessedRecords) {
        console.log(`[ScheduleTabContent] BLOCKING: Found ${processingStatus.processedCount} processed records`);

        const blockMessage = createProcessingBlockMessage(processingStatus);
        return {
          type: DialogType.ProcessedRecordsBlock,
          isOpen: true,
          title: 'Cannot Replace Records',
          message: blockMessage.text,
          confirmButtonText: 'OK',
          cancelButtonText: '',
          confirmButtonColor: '#d83b01',
          onConfirm: () => {
            setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
            setOperationMessage(blockMessage);
          }
        };
      }

      console.log(`[ScheduleTabContent] All ${existingRecords.length} records are unprocessed - showing replacement dialog`);

      return {
        type: DialogType.UnprocessedRecordsReplace,
        isOpen: true,
        title: 'Replace Schedule Records',
        message: `Found ${existingRecords.length} existing unprocessed records for this period. Replace them with new records from template?`,
        confirmButtonText: 'Replace',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d83b01',
        onConfirm: () => {
          console.log('[ScheduleTabContent] User confirmed replacement - proceeding with fill');
          setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
          void performFillOperation();
        }
      };

    } catch (error) {
      console.error('[ScheduleTabContent] Error during dialog type determination:', error);
       const errorMessage = error instanceof Error ? error.message : String(error);
       const itemCount = existingRecords ? existingRecords.length : 0;

      return {
        type: DialogType.None,
        isOpen: true,
        title: 'Error',
        message: `Error checking existing records (${itemCount} found before error): ${errorMessage}`,
        confirmButtonText: 'OK',
        cancelButtonText: '',
        confirmButtonColor: '#d83b01',
        onConfirm: () => {
          setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
          setOperationMessage({
            text: `Error checking existing records: ${errorMessage}`,
            type: MessageBarType.error
          });
        }
      };
    }
  };

  const handleFillButtonClick = async (): Promise<void> => {
    console.log('[ScheduleTabContent] Fill button clicked - starting dialog determination');

    if (!onCreateStaffRecord || !getExistingRecordsWithStatus || !markRecordsAsDeleted) {
         console.error('[ScheduleTabContent] Fill prerequisites missing.');
         setOperationMessage({
              text: 'Fill operation is not fully available (missing required functions).',
              type: MessageBarType.error
         });
         return;
    }

    try {
      setIsSaving(true);
      setOperationMessage(undefined);
      setFillDialogConfig(prev => ({ ...prev, isOpen: false }));

      const dialogConfig = await determineDialogType();

      setFillDialogConfig(dialogConfig);

    } catch (error) {
      console.error('[ScheduleTabContent] Error in handleFillButtonClick:', error);
      setOperationMessage({
        text: `Error preparing fill operation: ${error instanceof Error ? error.message : String(error)}`,
        type: MessageBarType.error
      });
    } finally {
       setIsSaving(false);
    }
  };


  const handleDismissFillDialog = (): void => {
    setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
  };

  const saveAllChanges = async (): Promise<void> => {
    console.log('[ScheduleTabContent] saveAllChanges called');
    if (!onUpdateStaffRecord) {
      setOperationMessage({
        text: 'Unable to save changes: Update function not available',
        type: MessageBarType.error
      });
      return;
    }
     if (Object.keys(modifiedRecords).length === 0) {
          console.log('[ScheduleTabContent] No modified records to save.');
          setOperationMessage({
              text: 'No changes to save.',
              type: MessageBarType.info
          });
          return;
     }

    void handleSaveAllChanges(modifiedRecords, onUpdateStaffRecord, actionHandlerParams);
  };


  const handleItemChange = useCallback((item: IScheduleItem, field: string, value: string | number): void => {
    console.log(`[ScheduleTabContent] handleItemChange called for item ${item.id}, field: ${field}, value: ${value}`);

    setModifiedRecords(prev => {
        const originalRecord = staffRecords?.find(sr => sr.ID === item.id);

        const baseIScheduleItem = originalRecord ? convertStaffRecordsToScheduleItems([originalRecord], selectedContract)[0] : item;

        const currentLocalItem = prev[item.id] || baseIScheduleItem;

        let updatedValue: any = value;
        if (field === 'typeOfLeave') {
             updatedValue = String(value);
        } else if (field === 'contractNumber') {
             updatedValue = String(value);
        } else if (field === 'date') {
             if (value instanceof Date) updatedValue = value;
             else console.warn(`[ScheduleTabContent] Unexpected value type for date field: ${typeof value}`);
        }

       const updatedItem = {
         ...currentLocalItem,
         [field]: updatedValue,
       };

       console.log('[ScheduleTabContent] Updating modifiedRecords state:', updatedItem);

       return {
         ...prev,
         [item.id]: updatedItem
       };
    });
  }, [staffRecords, selectedContract]);


  const scheduleOptions: IScheduleOptions = useMemo(() => ({
    hours: Array.from({ length: 24 }, (_, i) => ({
      key: i.toString().padStart(2, '0'),
      text: i.toString().padStart(2, '0')
    })),
    minutes: ['00', '15', '30', '45'].map(m => ({ key: m, text: m })),
    lunchTimes: ['0', '15', '30', '45', '60'].map(l => ({ key: l, text: l })),
    leaveTypes: [
      { key: '', text: 'None' },
      ...typesOfLeave.map(t => ({ key: t.id, text: t.title }))
    ],
    contractNumbers: [
      { key: '1', text: '1' },
      { key: '2', text: '2' },
      { key: '3', text: '3' }
    ]
  }), [typesOfLeave]);


   const itemsForTable = getScheduleItemsWithModifications();


  return (
    <div className={styles.scheduleTab}>
      <div className={styles.header}>
        <h2>Schedule for {selectedStaff?.name}</h2>
      </div>

      {/* Отображаем сообщение об ошибке, если есть */}
      {(error || errorStaffRecords) && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={onErrorDismiss}
          dismissButtonAriaLabel="Close"
        >
          {error || errorStaffRecords}
        </MessageBar>
      )}

      {/* Отображаем операционное сообщение, если есть */}
      {operationMessage && (
        <MessageBar
          messageBarType={operationMessage.type}
          isMultiline={false}
          onDismiss={(): void => setOperationMessage(undefined)}
          dismissButtonAriaLabel="Close"
        >
          {operationMessage.text}
        </MessageBar>
      )}

      {/* Фильтры выбора даты и контракта с кнопкой Fill */}
      <FilterControls
        selectedDate={selectedDate}
        contracts={contracts}
        selectedContractId={selectedContractId}
        isLoading={isLoading || isLoadingStaffRecords || isSaving}
        onDateChange={onDateChange}
        onContractChange={onContractChange}
        onFillButtonClick={handleFillButtonClick}
      />

      {/* Показываем спиннер при загрузке ВСЕХ данных или записей расписания */}
      {isLoading || isLoadingStaffRecords || isSaving ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <Spinner size={SpinnerSize.large} label={isSaving ? "Processing operation..." : (isLoadingStaffRecords ? "Loading schedule records..." : "Loading data...")} />
        </div>
      ) : (
        <>
          {selectedContract ? (
            <div style={{
                border: 'none',
                padding: '0px',
                borderRadius: '4px',
                minHeight: '300px',
                backgroundColor: 'white'
            }}>
              {/* Показываем информацию о дне (праздники, отпуска) */}
                 <DayInfo
                   selectedDate={selectedDate}
                   holidays={holidays}
                   leaves={leaves}
                   typesOfLeave={typesOfLeave}
                   holidaysService={holidaysService}
                   daysOfLeavesService={daysOfLeavesService}
                   typeOfLeaveService={typeOfLeaveService} // <-- Передаем typeOfLeaveService сюда
                 />

                <div style={{ padding: '10px' }}>
                  {/* Таблица расписания */}
                  <ScheduleTable
                    items={itemsForTable}
                    options={scheduleOptions}
                    selectedDate={selectedDate}
                    selectedContract={selectedContract ? { id: selectedContract.id, name: selectedContract.template } : undefined}
                    isLoading={false}
                    showDeleted={showDeleted}
                    onToggleShowDeleted={onToggleShowDeleted}
                    onItemChange={handleItemChange}
                    onAddShift={onAddShift}
                    onDeleteItem={onDeleteStaffRecord!} // <-- ИСПРАВЛЕНА ОШИБКА: onDeleteStaffRecord!
                    onRestoreItem={onRestoreStaffRecord!} // <-- ИСПРАВЛЕНА ОШИБКА: onRestoreStaffRecord!
                    saveChangesButton={
                      Object.keys(modifiedRecords).length > 0 ? (
                        <DefaultButton
                          text={`Save Changes (${Object.keys(modifiedRecords).length})`}
                          onClick={saveAllChanges}
                          disabled={isSaving}
                          styles={{
                            root: { backgroundColor: '#0078d4', color: 'white' },
                            rootHovered: { backgroundColor: '#106ebe', color: 'white' }
                          }}
                        />
                      ) : undefined
                    }
                    // --- ПЕРЕДАЕМ ПРОПСЫ ПАГИНАЦИИ ---
                    currentPage={currentPage}
                    itemsPerPage={itemsPerPage}
                    totalItemCount={totalItemCount}
                    onPageChange={onPageChange}
                    onItemsPerPageChange={onItemsPerPageChange}
                    // -----------------------------
                  />
                </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px',
              backgroundColor: '#f9f9f9',
              borderRadius: '4px',
              padding: '20px'
            }}>
              {contracts.length > 0 ? (
                <p>Please select a contract to view the schedule</p>
              ) : (
                <p>No active contracts available for this staff member</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Диалог подтверждения Fill */}
      <ScheduleTableDialogs
        confirmDialogProps={{
          isOpen: fillDialogConfig.isOpen,
          title: fillDialogConfig.title,
          message: fillDialogConfig.message,
          confirmButtonText: fillDialogConfig.confirmButtonText,
          cancelButtonText: fillDialogConfig.cancelButtonText,
          onConfirm: fillDialogConfig.onConfirm,
          confirmButtonColor: fillDialogConfig.confirmButtonColor
        }}
        onDismiss={handleDismissFillDialog}
      />
    </div>
  );
};

export default ScheduleTabContent;