// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { useState, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { 
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IDropdownOption,
  DefaultButton
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract } from '../../../models/IContract';
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { IStaffRecord } from '../../../services/StaffRecordsService';
import { INewShiftData } from './components/ScheduleTable';
import { IExistingRecordCheck } from './utils/ScheduleTabFillInterfaces';
import styles from './ScheduleTab.module.scss';

// Импорт компонентов
import { FilterControls } from './components/FilterControls';
import { DayInfo } from './components/DayInfo';
import ScheduleTable, { IScheduleItem, IScheduleOptions } from './components/ScheduleTable';
import { ScheduleTableDialogs } from './components/ScheduleTableDialogs';

// Импорт вспомогательных функций из выделенных файлов
import { convertStaffRecordsToScheduleItems } from './utils/ScheduleTabDataUtils';
import { 
  handleSaveAllChanges, 
  handleAddShift, 
  handleDeleteItem, 
  handleRestoreItem,
  IActionHandlerParams
} from './utils/ScheduleTabActionHandlers';
import { 
  fillScheduleFromTemplate
} from './utils/ScheduleTabFillService';

// Интерфейсы для типизации сервисов
interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

interface ITypeOfLeaveService {
  getAllTypesOfLeave: (forceRefresh?: boolean) => Promise<ITypeOfLeave[]>;
  getTypeOfLeaveById: (id: string | number) => Promise<ITypeOfLeave | undefined>;
}

// Интерфейс для передачи необходимых свойств в UI компоненты
export interface IScheduleTabContentProps {
  selectedStaff: ITabProps['selectedStaff'];
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  error?: string;
  holidays: IHoliday[];
  isLoadingHolidays: boolean;
  leaves: ILeaveDay[];
  isLoadingLeaves: boolean;
  typesOfLeave: ITypeOfLeave[];
  isLoadingTypesOfLeave: boolean;
  holidaysService?: IHolidaysService;
  daysOfLeavesService?: IDaysOfLeavesService;
  typeOfLeaveService?: ITypeOfLeaveService; 
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onErrorDismiss: () => void;
  staffRecords?: IStaffRecord[];
  onUpdateStaffRecord?: (recordId: string, updateData: Partial<IStaffRecord>) => Promise<boolean>;
  onCreateStaffRecord?: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
  onDeleteStaffRecord?: (recordId: string) => Promise<boolean>;
  onRestoreStaffRecord?: (recordId: string) => Promise<boolean>;
  onRefreshData?: () => void;
  onAddShift: (date: Date, shiftData?: INewShiftData) => void;
  dayOfStartWeek?: number;
  currentUserId?: string;
  managingGroupId?: string;
  context?: WebPartContext;
  
  // Новые пропсы для поддержки новой логики Fill
  getExistingRecordsWithStatus?: (startDate: Date, endDate: Date, employeeId: string, currentUserId?: string, staffGroupId?: string) => Promise<IExistingRecordCheck[]>;
  markRecordsAsDeleted?: (recordIds: string[]) => Promise<boolean>;
}

// Тип диалога подтверждения
enum DialogType {
  None = 'none',
  EmptySchedule = 'empty',
  ProcessedRecordsBlock = 'processed_block',
  UnprocessedRecordsReplace = 'unprocessed_replace'
}

// Интерфейс для конфигурации диалога
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

/**
 * Основной компонент содержимого вкладки Schedule
 */
export const ScheduleTabContent: React.FC<IScheduleTabContentProps> = (props) => {
  const {
    selectedStaff,
    selectedDate,
    contracts,
    selectedContractId,
    isLoading,
    error,
    holidays,
    isLoadingHolidays,
    leaves,
    isLoadingLeaves,
    typesOfLeave,
    isLoadingTypesOfLeave,
    holidaysService,
    daysOfLeavesService,
    onDateChange,
    onContractChange,
    onErrorDismiss,
    staffRecords,
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
    // Новые пропсы
    getExistingRecordsWithStatus,
    markRecordsAsDeleted
  } = props;
  
  // Находим выбранный контракт
  const selectedContract = contracts.find(c => c.id === selectedContractId);
  
  // Состояния компонента
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [modifiedRecords, setModifiedRecords] = useState<Record<string, IScheduleItem>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [operationMessage, setOperationMessage] = useState<{
    text: string;
    type: MessageBarType;
  } | undefined>(undefined);
  
  // НОВОЕ: Состояние для управления диалогом подтверждения Fill
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

  // Эффект для очистки модифицированных записей при изменении выбранного контракта или даты
  React.useEffect(() => {
    setModifiedRecords({});
  }, [selectedDate, selectedContractId]);
  
  // Эффект для отслеживания изменений в modifiedRecords
  React.useEffect(() => {
    if (Object.keys(modifiedRecords).length > 0) {
      setOperationMessage({
        text: 'Changes detected. Click "Save Changes" when finished editing.',
        type: MessageBarType.warning
      });
    }
  }, [modifiedRecords]);

  // Получаем список элементов для таблицы, включая локальные изменения
  const getScheduleItemsWithModifications = useCallback((): IScheduleItem[] => {
    const baseItems = convertStaffRecordsToScheduleItems(staffRecords, selectedContract);
    
    // Применяем локальные изменения
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

  // Общие параметры для обработчиков действий
  const actionHandlerParams: IActionHandlerParams = {
    setIsSaving,
    setOperationMessage,
    setModifiedRecords,
    onRefreshData
  };

  // ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ для выполнения заполнения
  const performFillOperation = async (): Promise<void> => {
    console.log('[ScheduleTabContent] performFillOperation called');

    if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId || !onCreateStaffRecord) {
      console.error('[ScheduleTabContent] Missing required data for fill operation');
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
      getExistingRecordsWithStatus,
      markRecordsAsDeleted
    };

    console.log('[ScheduleTabContent] Calling fillScheduleFromTemplate');
    
    // Вызываем заполнение
    await fillScheduleFromTemplate(fillParams, fillHandlers);
  };

  // НОВАЯ ФУНКЦИЯ: Определение типа диалога на основе существующих записей
  const determineDialogType = async (): Promise<IDialogConfig> => {
    console.log('[ScheduleTabContent] determineDialogType called');
    
    // Проверяем наличие необходимых данных
    if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId) {
      console.error('[ScheduleTabContent] Missing required data for dialog determination');
      return {
        type: DialogType.None,
        isOpen: false,
        title: '',
        message: 'Cannot fill schedule: Missing staff or contract information',
        confirmButtonText: '',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '',
        onConfirm: () => {}
      };
    }

    // Если нет функции проверки существующих записей, показываем простой диалог
    if (!getExistingRecordsWithStatus) {
      console.log('[ScheduleTabContent] No existing records check available - showing simple fill dialog');
      return {
        type: DialogType.EmptySchedule,
        isOpen: true,
        title: 'Fill Schedule',
        message: 'Do you want to fill the schedule based on template data?',
        confirmButtonText: 'Fill',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#107c10', // Green
        onConfirm: () => {
          setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
          void performFillOperation();
        }
      };
    }

    try {
      // Определяем период для проверки
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
      
      const contractStartDate = selectedContract.startDate;
      const contractFinishDate = selectedContract.finishDate;
      
      const firstDay = contractStartDate && contractStartDate > startOfMonth 
        ? new Date(contractStartDate) 
        : new Date(startOfMonth);
      
      const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
        ? new Date(contractFinishDate) 
        : new Date(endOfMonth);

      console.log('[ScheduleTabContent] Checking for existing records in period:', {
        firstDay: firstDay.toISOString(),
        lastDay: lastDay.toISOString(),
        employeeId: selectedStaff.employeeId,
        currentUserId,
        managingGroupId
      });

      // Получаем существующие записи
      const existingRecords = await getExistingRecordsWithStatus(
        firstDay,
        lastDay,
        selectedStaff.employeeId,
        currentUserId,
        managingGroupId
      );

      console.log(`[ScheduleTabContent] Found ${existingRecords.length} existing records`);

      // СЦЕНАРИЙ 1: Нет существующих записей
      if (existingRecords.length === 0) {
        console.log('[ScheduleTabContent] No existing records - showing empty schedule dialog');
        return {
          type: DialogType.EmptySchedule,
          isOpen: true,
          title: 'Fill Schedule',
          message: 'Do you want to fill the schedule based on template data?',
          confirmButtonText: 'Fill',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#107c10', // Green
          onConfirm: () => {
            setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
            void performFillOperation();
          }
        };
      }

      // Анализируем статус обработки существующих записей
      const { checkRecordsProcessingStatus, createProcessingBlockMessage } = await import(/* webpackChunkName: 'schedule-fill-helpers' */ './utils/ScheduleTabFillHelpers');
      const processingStatus = checkRecordsProcessingStatus(existingRecords);

      console.log('[ScheduleTabContent] Processing status:', {
        totalRecords: processingStatus.totalCount,
        processedRecords: processingStatus.processedCount,
        hasProcessedRecords: processingStatus.hasProcessedRecords
      });

      // СЦЕНАРИЙ 2: Есть обработанные записи - БЛОКИРОВКА
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
          confirmButtonColor: '#d83b01', // Red
          onConfirm: () => {
            setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
            // Показываем сообщение об ошибке
            setOperationMessage(blockMessage);
          }
        };
      }

      // СЦЕНАРИЙ 3: Все записи не обработаны - ЗАМЕНА
      console.log(`[ScheduleTabContent] All ${existingRecords.length} records are unprocessed - showing replacement dialog`);
      
      return {
        type: DialogType.UnprocessedRecordsReplace,
        isOpen: true,
        title: 'Replace Schedule Records',
        message: `Found ${existingRecords.length} existing unprocessed records for this period. Replace them with new records from template?`,
        confirmButtonText: 'Replace',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d83b01', // Orange/Red for warning
        onConfirm: () => {
          console.log('[ScheduleTabContent] User confirmed replacement - proceeding with fill');
          setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
          void performFillOperation();
        }
      };

    } catch (error) {
      console.error('[ScheduleTabContent] Error during dialog type determination:', error);
      return {
        type: DialogType.None,
        isOpen: true,
        title: 'Error',
        message: `Error checking existing records: ${error instanceof Error ? error.message : String(error)}`,
        confirmButtonText: 'OK',
        cancelButtonText: '',
        confirmButtonColor: '#d83b01', // Red
        onConfirm: () => {
          setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
          setOperationMessage({
            text: `Error checking existing records: ${error instanceof Error ? error.message : String(error)}`,
            type: MessageBarType.error
          });
        }
      };
    }
  };

  // НОВАЯ ФУНКЦИЯ: Обработчик кнопки Fill с правильной логикой диалогов
  const handleFillButtonClick = async (): Promise<void> => {
    console.log('[ScheduleTabContent] Fill button clicked - starting dialog determination');
    
    try {
      setIsSaving(true);
      
      // Определяем тип диалога
      const dialogConfig = await determineDialogType();
      
      // Устанавливаем конфигурацию диалога
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

  // Обработчик для закрытия диалога Fill
  const handleDismissFillDialog = (): void => {
    setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
  };
  
  // Обработчик для сохранения всех изменений
  const saveAllChanges = async (): Promise<void> => {
    if (!onUpdateStaffRecord) {
      setOperationMessage({
        text: 'Unable to save changes: Update function not available',
        type: MessageBarType.error
      });
      return;
    }
    
    void handleSaveAllChanges(modifiedRecords, onUpdateStaffRecord, actionHandlerParams);
  };
  
  // Обработчик для изменения элемента расписания
  const handleItemChange = (item: IScheduleItem, field: string, value: string | number): void => {
    console.log(`Changed item ${item.id}, field: ${field}, value: ${value}`);
    
    // Добавляем запись в список модифицированных
    setModifiedRecords(prev => ({
      ...prev,
      [item.id]: {
        ...prev[item.id],
        ...item,
        [field]: value
      }
    }));
  };
  
  // Обработчик для переключения отображения удаленных записей
  const handleToggleShowDeleted = (checked: boolean): void => {
    setShowDeleted(checked);
  };
  
  // Создаем опции для выпадающих списков в таблице
  const scheduleOptions: IScheduleOptions = {
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
  };

  return (
    <div className={styles.scheduleTab}>
      <div className={styles.header}>
        <h2>Schedule for {selectedStaff?.name}</h2>
      </div>
      
      {/* Отображаем сообщение об ошибке, если есть */}
      {error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={onErrorDismiss}
          dismissButtonAriaLabel="Close"
        >
          {error}
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
        isLoading={isLoading}
        onDateChange={onDateChange}
        onContractChange={onContractChange}
        onFillButtonClick={handleFillButtonClick}
      />
      
      {/* Показываем спиннер при загрузке */}
      {isLoading || isSaving ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <Spinner size={SpinnerSize.large} label={isSaving ? "Processing fill operation..." : "Loading schedule data..."} />
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
              />
              
              {/* Показываем индикаторы загрузки, если данные загружаются */}
              {(isLoadingHolidays || isLoadingLeaves || isLoadingTypesOfLeave) ? (
                <div style={{ padding: '10px', textAlign: 'center' }}>
                  {isLoadingHolidays && <Spinner size={SpinnerSize.small} label="Loading holidays data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingLeaves && <Spinner size={SpinnerSize.small} label="Loading leaves data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingTypesOfLeave && <Spinner size={SpinnerSize.small} label="Loading types of leave..." />}
                </div>
              ) : (
                <div style={{ padding: '10px' }}>
                  {/* Таблица расписания */}
                  <ScheduleTable
                    items={getScheduleItemsWithModifications()}
                    options={scheduleOptions}
                    selectedDate={selectedDate}
                    selectedContract={{ id: selectedContract.id, name: selectedContract.template }}
                    isLoading={false}
                    showDeleted={showDeleted}
                    onToggleShowDeleted={handleToggleShowDeleted}
                    onItemChange={handleItemChange}
                    onAddShift={(date, shiftData): void => 
                      handleAddShift(date, shiftData, onAddShift, actionHandlerParams)
                    }
                    onDeleteItem={(id): Promise<void> => 
                      handleDeleteItem(id, modifiedRecords, onDeleteStaffRecord!, actionHandlerParams)
                    }
                    onRestoreItem={(id): Promise<void> => 
                      handleRestoreItem(id, modifiedRecords, onRestoreStaffRecord!, actionHandlerParams)
                    }
                    saveChangesButton={
                      Object.keys(modifiedRecords).length > 0 ? (
                        <DefaultButton
                          text={`Save Changes (${Object.keys(modifiedRecords).length})`}
                          onClick={saveAllChanges}
                          disabled={isSaving}
                          styles={{
                            root: {
                              backgroundColor: '#0078d4',
                              color: 'white'
                            },
                            rootHovered: {
                              backgroundColor: '#106ebe',
                              color: 'white'
                            }
                          }}
                        />
                      ) : undefined
                    }
                  />
                </div>
              )}
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
      
      {/* НОВЫЙ ДИАЛОГ ПОДТВЕРЖДЕНИЯ FILL */}
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