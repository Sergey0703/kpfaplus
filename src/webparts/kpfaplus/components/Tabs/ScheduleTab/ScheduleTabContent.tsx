// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { useState, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base'; // Добавляем импорт
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
  createFillConfirmationDialog, 
  fillScheduleFromTemplate 
} from './utils/ScheduleTabFillOperations';

// Интерфейс для типизации сервисов
interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

// Интерфейс для TypeOfLeaveService, используется в пропсах
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
  context?: WebPartContext; // Добавляем context
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
    currentUserId,
    managingGroupId,
    context
  } = props;
  
  // Находим выбранный контракт
  const selectedContract = contracts.find(c => c.id === selectedContractId);
  
  // Состояния компонента
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [modifiedRecords, setModifiedRecords] = useState<Record<string, IScheduleItem>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // Изменено: используем undefined вместо null
  const [operationMessage, setOperationMessage] = useState<{
    text: string;
    type: MessageBarType;
  } | undefined>(undefined);
  const [confirmDialogProps, setConfirmDialogProps] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Cancel',
    onConfirm: () => {},
    confirmButtonColor: ''
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

  // Обработчик для закрытия диалога
  const handleDismissDialog = (): void => {
    setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
  };

  // Обработчик для кнопки Fill
  const handleFillButtonClick = async (): Promise<void> => {
    console.log('Fill button clicked');
    
    // Получаем текущие элементы расписания для проверки
    const currentItems = getScheduleItemsWithModifications();
    const hasExistingRecords = currentItems.length > 0;
    
    // Функция, которая будет вызвана при подтверждении
    const onConfirmFill = (): void => {
      // Закрываем диалог
      setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
      
      // Если нет функции создания записей, показываем ошибку
      if (!onCreateStaffRecord) {
        setOperationMessage({
          text: 'Cannot fill schedule: Create function not available',
          type: MessageBarType.error
        });
        return;
      }

      // Получаем employeeId из выбранного сотрудника
      const employeeId = selectedStaff?.employeeId;
      if (!employeeId) {
        setOperationMessage({
          text: 'Cannot fill schedule: No employee selected',
          type: MessageBarType.error
        });
        return;
      }

      // Вызываем функцию заполнения расписания
      void fillScheduleFromTemplate(
        {
          selectedDate,
          selectedStaffId: selectedStaff.id,
          employeeId,
          selectedContract,
          selectedContractId,
          holidays,
          leaves,
          currentUserId,
          managingGroupId,
          dayOfStartWeek,
          context
        },
        {
          createStaffRecord: onCreateStaffRecord,
          setOperationMessage,
          setIsSaving,
          onRefreshData
        }
      );
    };
    
    // Настраиваем и показываем диалог подтверждения
    const dialogConfig = createFillConfirmationDialog(hasExistingRecords, onConfirmFill);
    setConfirmDialogProps(dialogConfig);
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
      
      {/* Отображаем операционное сообщение, если есть - Изменено: проверка на undefined */}
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
          <Spinner size={SpinnerSize.large} label={isSaving ? "Saving changes..." : "Loading schedule data..."} />
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
      
      {/* Диалог подтверждения */}
      <ScheduleTableDialogs 
        confirmDialogProps={{
          isOpen: confirmDialogProps.isOpen,
          title: confirmDialogProps.title,
          message: confirmDialogProps.message,
          confirmButtonText: confirmDialogProps.confirmButtonText,
          cancelButtonText: confirmDialogProps.cancelButtonText,
          onConfirm: confirmDialogProps.onConfirm,
          confirmButtonColor: confirmDialogProps.confirmButtonColor
        }}
        onDismiss={handleDismissDialog}
      />
    </div>
  );
};

export default ScheduleTabContent;