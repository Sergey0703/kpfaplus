// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTab.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { HolidaysService, IHoliday } from '../../../services/HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from '../../../services/DaysOfLeavesService';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { StaffRecordsService, IStaffRecord } from '../../../services/StaffRecordsService';
import { IContract } from '../../../models/IContract';
import { 
  fetchHolidaysForMonthAndYear, 
  fetchLeavesForMonthAndYear, 
  fetchContracts,
  fetchTypesOfLeave,
  shouldRefreshDataOnDateChange
} from './ScheduleTabApi';
import { ScheduleTabContent } from './ScheduleTabContent';
import styles from './ScheduleTab.module.scss';

// Интерфейс для состояния компонента ScheduleTab
export interface IScheduleTabState {
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
  staffRecords: IStaffRecord[];
  isLoadingStaffRecords: boolean;
  errorStaffRecords?: string;
}

// Здесь используем именованный экспорт, как ожидается в Kpfaplus.tsx
export const ScheduleTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff, context } = props;
  
  // Дополнительное логирование при инициализации компонента
  console.log('[ScheduleTab] Initializing component with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffId: selectedStaff?.id,
    selectedStaffEmployeeId: selectedStaff?.employeeId,
    hasContext: !!context,
    currentUserId: props.currentUserId,
    managingGroupId: props.managingGroupId
  });
  
  // Инициализируем состояние компонента
  const [state, setState] = useState<IScheduleTabState>({
    selectedDate: new Date(),
    contracts: [],
    selectedContractId: undefined,
    isLoading: false,
    holidays: [],
    isLoadingHolidays: false,
    leaves: [],
    isLoadingLeaves: false,
    typesOfLeave: [],
    isLoadingTypesOfLeave: false,
    staffRecords: [],
    isLoadingStaffRecords: false
  });
  
  // Получаем сервисы
  const holidaysService = context ? HolidaysService.getInstance(context) : undefined;
  const daysOfLeavesService = context ? DaysOfLeavesService.getInstance(context) : undefined;
  const typeOfLeaveService = context ? TypeOfLeaveService.getInstance(context) : undefined;
  const staffRecordsService = context ? StaffRecordsService.getInstance(context) : undefined;
  
  // Логируем инициализацию сервисов
  console.log('[ScheduleTab] Services initialization:', {
    hasHolidaysService: !!holidaysService,
    hasDaysOfLeavesService: !!daysOfLeavesService,
    hasTypeOfLeaveService: !!typeOfLeaveService,
    hasStaffRecordsService: !!staffRecordsService
  });
  
  // Функции для обновления состояния - используем именованный объект для удобства чтения
  const updateState = {
    selectedDate: (selectedDate: Date) => {
      setState(prevState => ({ ...prevState, selectedDate }));
    },
    selectedContractId: (selectedContractId?: string) => {
      setState(prevState => ({ ...prevState, selectedContractId }));
    },
    contracts: (contracts: IContract[]) => {
      setState(prevState => ({ ...prevState, contracts }));
    },
    isLoading: (isLoading: boolean) => {
      setState(prevState => ({ ...prevState, isLoading }));
    },
    error: (error?: string) => {
      setState(prevState => ({ ...prevState, error }));
    },
    holidays: (holidays: IHoliday[]) => {
      setState(prevState => ({ ...prevState, holidays }));
    },
    isLoadingHolidays: (isLoadingHolidays: boolean) => {
      setState(prevState => ({ ...prevState, isLoadingHolidays }));
    },
    leaves: (leaves: ILeaveDay[]) => {
      setState(prevState => ({ ...prevState, leaves }));
    },
    isLoadingLeaves: (isLoadingLeaves: boolean) => {
      setState(prevState => ({ ...prevState, isLoadingLeaves }));
    },
    typesOfLeave: (typesOfLeave: ITypeOfLeave[]) => {
      setState(prevState => ({ ...prevState, typesOfLeave }));
    },
    isLoadingTypesOfLeave: (isLoadingTypesOfLeave: boolean) => {
      setState(prevState => ({ ...prevState, isLoadingTypesOfLeave }));
    },
    staffRecords: (staffRecords: IStaffRecord[]) => {
      setState(prevState => ({ ...prevState, staffRecords }));
    },
    isLoadingStaffRecords: (isLoadingStaffRecords: boolean) => {
      setState(prevState => ({ ...prevState, isLoadingStaffRecords }));
    },
    errorStaffRecords: (errorStaffRecords?: string) => {
      setState(prevState => ({ ...prevState, errorStaffRecords }));
    }
  };

  // ИСПРАВЛЕНО: Добавлен параметр overrideDate для явной передачи даты
  const loadStaffRecords = async (overrideDate?: Date): Promise<void> => {
    // Используем переданную дату или дату из состояния
    const dateToUse = overrideDate || state.selectedDate;
    
    console.log('[ScheduleTab] [DEBUG] loadStaffRecords вызван с параметрами:', {
      date: dateToUse.toISOString(),
      employeeId: selectedStaff?.employeeId,
      currentUserId: props.currentUserId,
      managingGroupId: props.managingGroupId,
      selectedContractId: state.selectedContractId
    });
    
    // Проверяем наличие необходимых данных
    if (!context || !staffRecordsService) {
      console.log('[ScheduleTab] [ОШИБКА] Не удается загрузить записи: отсутствует context или service', {
        hasContext: !!context,
        hasStaffRecordsService: !!staffRecordsService
      });
      return;
    }
    
    // Проверяем наличие сотрудника
    if (!selectedStaff || !selectedStaff.employeeId) {
      console.log('[ScheduleTab] [ОШИБКА] Не удается загрузить записи: отсутствует выбранный сотрудник или employeeId', {
        hasSelectedStaff: !!selectedStaff,
        employeeId: selectedStaff?.employeeId
      });
      return;
    }
    
    try {
      // Устанавливаем состояние загрузки
      updateState.isLoadingStaffRecords(true);
      updateState.errorStaffRecords(undefined);
      
      // ИСПРАВЛЕНО: Используем dateToUse вместо state.selectedDate
      // Получаем первый и последний день месяца
      const date = new Date(dateToUse.getTime()); // Create a new date object to avoid modifying the original
      const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      
      console.log(`[ScheduleTab] [DEBUG] Загрузка записей для периода: 
        ${firstDayOfMonth.toLocaleDateString()} (${firstDayOfMonth.toISOString()}) - 
        ${lastDayOfMonth.toLocaleDateString()} (${lastDayOfMonth.toISOString()})`);
      
      // Получаем ID сотрудника
      const employeeId = selectedStaff.employeeId;
      console.log(`[ScheduleTab] [DEBUG] ID сотрудника: ${employeeId}`);
      
      // ID временной таблицы (если выбран контракт)
      const timeTableId = state.selectedContractId;
      console.log(`[ScheduleTab] [DEBUG] ID временной таблицы: ${timeTableId || 'не выбрана'}`);
      
      // Получаем ID текущего пользователя и группы
      const currentUserID = props.currentUserId ? props.currentUserId : '0';
      const staffGroupID = props.managingGroupId ? props.managingGroupId : '0';
      
      // Проверим типы данных
      console.log('[ScheduleTab] [DEBUG] Типы данных параметров:', {
        currentUserID: `${currentUserID} (${typeof currentUserID})`,
        staffGroupID: `${staffGroupID} (${typeof staffGroupID})`,
        employeeId: `${employeeId} (${typeof employeeId})`,
        timeTableId: timeTableId ? `${timeTableId} (${typeof timeTableId})` : 'undefined'
      });
      
      // Добавим проверку текущих контрактов 
      console.log(`[ScheduleTab] [DEBUG] Текущие контракты (${state.contracts.length}):`, 
        state.contracts.map(c => ({ id: c.id, template: c.template })));
      
      // Логируем параметры запроса
      console.log('[ScheduleTab] [DEBUG] Параметры вызова API:', {
        firstDayOfMonth: firstDayOfMonth.toISOString(),
        lastDayOfMonth: lastDayOfMonth.toISOString(),
        employeeId,
        currentUserID,
        staffGroupID,
        timeTableId
      });
      
      // Проверка staffRecordsService перед вызовом
      console.log('[ScheduleTab] [DEBUG] staffRecordsService:', {
        type: typeof staffRecordsService,
        hasGetStaffRecords: typeof staffRecordsService.getStaffRecords === 'function'
      });
      
      // Вызываем сервис для получения данных
      console.log('[ScheduleTab] [DEBUG] Вызываем staffRecordsService.getStaffRecords...');
      
      try {
        const records = await staffRecordsService.getStaffRecords(
          firstDayOfMonth,
          lastDayOfMonth,
          currentUserID,
          staffGroupID,
          employeeId,
          timeTableId
        );
        
        // Обновляем состояние
        console.log(`[ScheduleTab] [DEBUG] Загружено ${records.length} записей расписания`);
        updateState.staffRecords(records);
        
        // Логируем первый элемент (если есть)
        if (records.length > 0) {
          console.log('[ScheduleTab] [DEBUG] Первая запись расписания:', records[0]);
          
          // Проверим некоторые даты в первой записи
          if (records[0].Date) {
            console.log('[ScheduleTab] [DEBUG] Date в первой записи:', {
              date: records[0].Date.toISOString(),
              isValid: !isNaN(records[0].Date.getTime())
            });
          }
          
          if (records[0].ShiftDate1) {
            console.log('[ScheduleTab] [DEBUG] ShiftDate1 в первой записи:', {
              date: records[0].ShiftDate1.toISOString(),
              isValid: !isNaN(records[0].ShiftDate1.getTime())
            });
          }
        } else {
          console.log('[ScheduleTab] [DEBUG] Записи не возвращены сервисом');
        }
      } catch (serviceError) {
        console.error('[ScheduleTab] [ОШИБКА] Ошибка при вызове staffRecordsService.getStaffRecords:', serviceError);
        throw serviceError;
      }
    } catch (error) {
      // В случае ошибки обновляем состояние
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ScheduleTab] [КРИТИЧЕСКАЯ ОШИБКА] при загрузке записей расписания:', error);
      updateState.errorStaffRecords(`Не удалось загрузить записи расписания: ${errorMessage}`);
    } finally {
      // В любом случае снимаем индикатор загрузки
      updateState.isLoadingStaffRecords(false);
    }
  };
  
  // ИСПРАВЛЕНО: Изменен метод loadDataForDate для передачи даты в loadStaffRecords
  const loadDataForDate = (date: Date): void => {
    console.log('[ScheduleTab] loadDataForDate called for:', date.toISOString());
    
    if (!context) {
      console.log('[ScheduleTab] Cannot load data for date: missing context');
      return;
    }
    
    // Загружаем праздники
    void fetchHolidaysForMonthAndYear(
      context,
      date,
      updateState.isLoadingHolidays,
      updateState.holidays,
      updateState.error
    );
    
    // Загружаем отпуска, если есть выбранный сотрудник
    if (selectedStaff?.employeeId) {
      void fetchLeavesForMonthAndYear(
        context,
        date,
        parseInt(selectedStaff.employeeId),
        props.currentUserId ? parseInt(props.currentUserId) : undefined,
        props.managingGroupId ? parseInt(props.managingGroupId) : undefined,
        updateState.isLoadingLeaves,
        updateState.leaves,
        updateState.error
      );
    }
    
    // ИСПРАВЛЕНО: Явно передаем дату в loadStaffRecords
    console.log('[ScheduleTab] Calling loadStaffRecords from loadDataForDate');
    void loadStaffRecords(date);
  };
  
  // Загружаем типы отпусков
  const loadTypesOfLeave = (): void => {
    console.log('[ScheduleTab] loadTypesOfLeave called');
    
    if (!context || !typeOfLeaveService) {
      console.log('[ScheduleTab] Cannot load types of leave: missing context or service');
      return;
    }
    
    void fetchTypesOfLeave(
      context,
      typeOfLeaveService,
      updateState.isLoadingTypesOfLeave,
      updateState.typesOfLeave,
      updateState.error
    );
  };
  
  // Загружаем контракты сотрудника с учетом даты
  const loadContracts = (date?: Date): void => {
    console.log('[ScheduleTab] loadContracts called for date:', date?.toISOString() || state.selectedDate.toISOString());
    
    if (!context || !selectedStaff?.employeeId) {
      console.log('[ScheduleTab] Cannot load contracts: missing context or employeeId');
      return;
    }
    
    // Используем переданную дату или текущую выбранную дату
    const dateToUse = date || state.selectedDate;
    
    void fetchContracts(
      context,
      selectedStaff.employeeId,
      props.currentUserId,
      props.managingGroupId,
      updateState.isLoading,
      updateState.contracts,
      updateState.selectedContractId,
      updateState.error,
      dateToUse  // Передаем дату для фильтрации контрактов
    );
  };
  
  // ИСПРАВЛЕНО: Обновлен метод handleDateChange для явной передачи даты
  const handleDateChange = (date: Date | undefined): void => {
    console.log('[ScheduleTab] handleDateChange called with date:', date?.toISOString());
    
    if (!date) {
      console.log('[ScheduleTab] No date provided to handleDateChange');
      return;
    }
    
    const currentDate = state.selectedDate;
    
    // Устанавливаем новую выбранную дату
    updateState.selectedDate(date);
    
    // Если изменился месяц или год, загружаем новые данные
    if (shouldRefreshDataOnDateChange(currentDate, date)) {
      console.log('[ScheduleTab] Month or year changed, reloading all data');
      // Загружаем праздники и отпуска для нового месяца
      // ИСПРАВЛЕНО: Явно передаем новую дату
      loadDataForDate(date);
    } else {
      console.log('[ScheduleTab] Only day changed, reloading staff records');
      // Даже если месяц не изменился, перезагружаем расписание для нового дня
      // ИСПРАВЛЕНО: Явно передаем новую дату
      void loadStaffRecords(date);
    }
    
    // Загружаем контракты с учетом новой даты в любом случае
    loadContracts(date);
  };
  
  // Обработчик изменения контракта
  const handleContractChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    console.log('[ScheduleTab] handleContractChange called with option:', option);
    
    if (option) {
      // Обновляем ID выбранного контракта
      updateState.selectedContractId(option.key.toString());
      
      // При изменении контракта перезагружаем расписание
      console.log('[ScheduleTab] Contract changed, will reload staff records');
      setTimeout(() => {
        // ИСПРАВЛЕНО: Добавлена обработка Promise через void
        void loadStaffRecords(state.selectedDate);
      }, 0);
    }
  };
  
  // Обработчик закрытия сообщения об ошибке
  const handleErrorDismiss = (): void => {
    updateState.error(undefined);
    updateState.errorStaffRecords(undefined);
  };

  // Обработчик обновления записи расписания
  const handleUpdateStaffRecord = async (recordId: string, updateData: Partial<IStaffRecord>): Promise<boolean> => {
    console.log(`[ScheduleTab] handleUpdateStaffRecord called for record ID: ${recordId}`, updateData);
    
    if (!context || !staffRecordsService) {
      console.error('[ScheduleTab] Cannot update record: missing context or service');
      return false;
    }
    
    try {
      // Call the service method to update the record
      const success = await staffRecordsService.updateStaffRecord(recordId, updateData);
      
      console.log(`[ScheduleTab] Record update result: ${success ? 'success' : 'failed'}`);
      
      // After successful update, refresh the data
      if (success) {
        setTimeout(() => {
          void loadStaffRecords(state.selectedDate);
        }, 1000);
      }
      
      return success;
    } catch (error) {
      console.error(`[ScheduleTab] Error updating record:`, error);
      return false;
    }
  };

  // Обработчик создания новой записи расписания
  const handleCreateStaffRecord = async (createData: Partial<IStaffRecord>): Promise<string | undefined> => {
    console.log(`[ScheduleTab] handleCreateStaffRecord called`, createData);
    
    if (!context || !staffRecordsService) {
      console.error('[ScheduleTab] Cannot create record: missing context or service');
      return undefined;
    }
    
    try {
      // Call the service method to create the record
      const newRecordId = await staffRecordsService.createStaffRecord(createData);
      
      console.log(`[ScheduleTab] Record creation result: ${newRecordId ? 'success' : 'failed'}`);
      
      // After successful creation, refresh the data
      if (newRecordId) {
        setTimeout(() => {
          void loadStaffRecords(state.selectedDate);
        }, 1000);
      }
      
      return newRecordId;
    } catch (error) {
      console.error(`[ScheduleTab] Error creating record:`, error);
      return undefined;
    }
  };

  // Обработчик удаления записи расписания
  const handleDeleteStaffRecord = async (recordId: string): Promise<boolean> => {
    console.log(`[ScheduleTab] handleDeleteStaffRecord called for record ID: ${recordId}`);
    
    if (!context || !staffRecordsService) {
      console.error('[ScheduleTab] Cannot delete record: missing context or service');
      return false;
    }
    
    try {
      // Call the service method to delete the record
      const success = await staffRecordsService.markRecordAsDeleted(recordId);
      
      console.log(`[ScheduleTab] Record deletion result: ${success ? 'success' : 'failed'}`);
      
      // After successful deletion, refresh the data
      if (success) {
        setTimeout(() => {
          void loadStaffRecords(state.selectedDate);
        }, 1000);
      }
      
      return success;
    } catch (error) {
      console.error(`[ScheduleTab] Error deleting record:`, error);
      return false;
    }
  };

  // Добавляем обработчик для восстановления удаленной записи
  const handleRestoreStaffRecord = async (recordId: string): Promise<boolean> => {
    console.log(`[ScheduleTab] handleRestoreStaffRecord called for record ID: ${recordId}`);
    
    if (!context || !staffRecordsService) {
      console.error('[ScheduleTab] Cannot restore record: missing context or service');
      return false;
    }
    
    try {
      // Call the service method to restore the record
      const success = await staffRecordsService.restoreDeletedRecord(recordId);
      
      console.log(`[ScheduleTab] Record restore result: ${success ? 'success' : 'failed'}`);
      
      // After successful restoration, refresh the data
      if (success) {
        setTimeout(() => {
          void loadStaffRecords(state.selectedDate);
        }, 1000);
      }
      
      return success;
    } catch (error) {
      console.error(`[ScheduleTab] Error restoring record:`, error);
      return false;
    }
  };

  // Обработчик обновления данных
  const handleRefreshData = (): void => {
    console.log(`[ScheduleTab] handleRefreshData called`);
    void loadStaffRecords(state.selectedDate);
  };
  
  // Загружаем контракты при монтировании компонента или изменении сотрудника
  useEffect(() => {
    console.log('[ScheduleTab] useEffect triggered for selectedStaff/context:', {
      hasSelectedStaff: !!selectedStaff,
      selectedStaffId: selectedStaff?.id,
      hasContext: !!context
    });
    
    if (selectedStaff?.id && context) {
      console.log('[ScheduleTab] Loading contracts and staff records for staff:', selectedStaff.name);
      void loadContracts(state.selectedDate);
      // ИСПРАВЛЕНО: Явно передаем текущую выбранную дату
      void loadStaffRecords(state.selectedDate); // Загружаем расписание при изменении сотрудника
    } else {
      console.log('[ScheduleTab] Clearing contracts and staff records');
      updateState.contracts([]);
      updateState.staffRecords([]); // Очищаем расписание, если нет сотрудника
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaff, context]);
  
  // Загружаем праздники и отпуска при монтировании компонента
  useEffect(() => {
    console.log('[ScheduleTab] useEffect triggered for context/managingGroupId/currentUserId:', {
      hasContext: !!context,
      managingGroupId: props.managingGroupId,
      currentUserId: props.currentUserId
    });
    
    if (context) {
      console.log('[ScheduleTab] Loading data for date from useEffect');
      void loadDataForDate(state.selectedDate);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, props.managingGroupId, props.currentUserId]); // Добавляем зависимости от managingGroupId и currentUserId
  
  // Загружаем типы отпусков при монтировании компонента
  useEffect(() => {
    console.log('[ScheduleTab] useEffect triggered for typeOfLeaveService');
    
    if (context && typeOfLeaveService) {
      void loadTypesOfLeave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, typeOfLeaveService]);
  
  // Рендеринг компонента с использованием ScheduleTabContent
  return (
    <div className={styles.scheduleTab}>
      <ScheduleTabContent
        selectedStaff={selectedStaff}
        selectedDate={state.selectedDate}
        contracts={state.contracts}
        selectedContractId={state.selectedContractId}
        isLoading={state.isLoading || state.isLoadingStaffRecords}
        error={state.error || state.errorStaffRecords}
        holidays={state.holidays}
        isLoadingHolidays={state.isLoadingHolidays}
        leaves={state.leaves}
        isLoadingLeaves={state.isLoadingLeaves}
        typesOfLeave={state.typesOfLeave}
        isLoadingTypesOfLeave={state.isLoadingTypesOfLeave}
        holidaysService={holidaysService}
        daysOfLeavesService={daysOfLeavesService}
        typeOfLeaveService={typeOfLeaveService}
        onDateChange={handleDateChange}
        onContractChange={handleContractChange}
        onErrorDismiss={handleErrorDismiss}
        staffRecords={state.staffRecords}
        onUpdateStaffRecord={handleUpdateStaffRecord}
        onCreateStaffRecord={handleCreateStaffRecord}
        onDeleteStaffRecord={handleDeleteStaffRecord}
        onRestoreStaffRecord={handleRestoreStaffRecord}
        onRefreshData={handleRefreshData}
      />
    </div>
  );
};

// Также добавляем экспорт по умолчанию для совместимости
export default ScheduleTab;