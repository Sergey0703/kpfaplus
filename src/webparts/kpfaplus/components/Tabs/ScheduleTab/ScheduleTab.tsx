// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTab.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  DatePicker,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract } from '../../../models/IContract';
import { ContractsService } from '../../../services/ContractsService';
import { HolidaysService, IHoliday } from '../../../services/HolidaysService';
import { DaysOfLeavesService, ILeaveDay } from '../../../services/DaysOfLeavesService';
import styles from './ScheduleTab.module.scss';

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
}

export const ScheduleTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff, context } = props;
  
  // Инициализируем состояние компонента
  const [state, setState] = useState<IScheduleTabState>({
    selectedDate: new Date(),
    contracts: [],
    selectedContractId: undefined,
    isLoading: false,
    holidays: [],
    isLoadingHolidays: false,
    leaves: [],
    isLoadingLeaves: false
  });
  
  // Создаем сервисы
  const contractsService = context 
    ? ContractsService.getInstance(context) 
    : undefined;
    
  const holidaysService = context
    ? HolidaysService.getInstance(context)
    : undefined;
    
  const daysOfLeavesService = context
    ? DaysOfLeavesService.getInstance(context)
    : undefined;
  
  // Для удобства создаем отдельные функции-обработчики для обновления состояния
  const setSelectedDate = (date: Date) => {
    setState(prevState => ({ ...prevState, selectedDate: date }));
    // Загружаем праздники для года выбранной даты
    fetchHolidaysForYear(date.getFullYear());
    // Загружаем отпуска для месяца и года выбранной даты
    fetchLeavesForMonthAndYear(date);
  };
  
  const setSelectedContractId = (contractId?: string) => {
    setState(prevState => ({ ...prevState, selectedContractId: contractId }));
  };
  
  const setContracts = (contracts: IContract[]) => {
    setState(prevState => ({ ...prevState, contracts }));
  };
  
  const setIsLoading = (isLoading: boolean) => {
    setState(prevState => ({ ...prevState, isLoading }));
  };
  
  const setError = (error?: string) => {
    setState(prevState => ({ ...prevState, error }));
  };
  
  const setHolidays = (holidays: IHoliday[]) => {
    setState(prevState => ({ ...prevState, holidays }));
  };
  
  const setIsLoadingHolidays = (isLoadingHolidays: boolean) => {
    setState(prevState => ({ ...prevState, isLoadingHolidays }));
  };
  
  const setLeaves = (leaves: ILeaveDay[]) => {
    setState(prevState => ({ ...prevState, leaves }));
  };
  
  const setIsLoadingLeaves = (isLoadingLeaves: boolean) => {
    setState(prevState => ({ ...prevState, isLoadingLeaves }));
  };
  
  // Функция для загрузки праздников для конкретного года
  const fetchHolidaysForYear = async (year: number): Promise<void> => {
    if (!holidaysService) return;
    
    setIsLoadingHolidays(true);
    
    try {
      console.log(`[ScheduleTab] Fetching holidays for year: ${year}`);
      const holidaysData = await holidaysService.getHolidaysByYear(year);
      
      console.log(`[ScheduleTab] Retrieved ${holidaysData.length} holidays for year ${year}`);
      setHolidays(holidaysData);
      
      // Логируем первые несколько праздников для проверки
      if (holidaysData.length > 0) {
        const sampleHolidays = holidaysData.slice(0, 3);
        console.log("[ScheduleTab] Sample holidays:", sampleHolidays);
      }
    } catch (err) {
      console.error(`Error fetching holidays for year ${year}:`, err);
      setError(`Failed to load holidays. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsLoadingHolidays(false);
    }
  };
  
  // Функция для загрузки отпусков для месяца и года
  const fetchLeavesForMonthAndYear = async (date: Date): Promise<void> => {
    if (!daysOfLeavesService || !selectedStaff?.employeeId) return;
    
    setIsLoadingLeaves(true);
    
    try {
      // Получаем ID сотрудника, менеджера и группы
      const staffMemberId = parseInt(selectedStaff.employeeId);
      const managerId = props.currentUserId ? parseInt(props.currentUserId) : 0;
      const staffGroupId = props.managingGroupId ? parseInt(props.managingGroupId) : 0;
      
      console.log(`[ScheduleTab] Fetching leaves for date: ${date.toLocaleDateString()}, staffMemberId: ${staffMemberId}, managerId: ${managerId}, staffGroupId: ${staffGroupId}`);
      
      const leavesData = await daysOfLeavesService.getLeavesForMonthAndYear(
        date,
        staffMemberId,
        managerId,
        staffGroupId
      );
      
      console.log(`[ScheduleTab] Retrieved ${leavesData.length} leaves for month ${date.getMonth() + 1} and year ${date.getFullYear()}`);
      setLeaves(leavesData);
      
      // Логируем первые несколько отпусков для проверки
      if (leavesData.length > 0) {
        const sampleLeaves = leavesData.slice(0, 3);
        console.log("[ScheduleTab] Sample leaves:", sampleLeaves);
      }
    } catch (err) {
      console.error(`Error fetching leaves for month ${date.getMonth() + 1} and year ${date.getFullYear()}:`, err);
      setError(`Failed to load leaves. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsLoadingLeaves(false);
    }
  };
  
  // Функция для загрузки контрактов сотрудника
  const fetchContracts = async (): Promise<void> => {
    if (!selectedStaff?.id || !contractsService) {
      return;
    }
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      // Получаем контракты от сервиса
      if (selectedStaff && selectedStaff.employeeId) {
        const staffGroupId: string | undefined = props.managingGroupId;
        const managerId = props.currentUserId || undefined;
        
        console.log("[ScheduleTab] Fetching contracts for employee ID:", selectedStaff.employeeId, 
                  "manager ID:", managerId, "staff group ID:", staffGroupId);
        
        // Вызываем метод из сервиса
        const contractsData = await contractsService.getContractsForStaffMember(
          selectedStaff.employeeId,
          managerId,
          staffGroupId
        );
        
        console.log(`[ScheduleTab] Retrieved ${contractsData.length} contracts`);
        
        // Фильтруем только активные контракты
        const activeContracts = contractsData.filter(contract => !contract.isDeleted);
        setContracts(activeContracts);
        
        // Если есть контракты и нет выбранного, выбираем первый
        if (activeContracts.length > 0 && !state.selectedContractId) {
          setSelectedContractId(activeContracts[0].id);
        }
      } else {
        console.log("Employee ID is missing, cannot fetch contracts");
        setContracts([]);
      }
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setError(`Failed to load contracts. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Загружаем контракты при монтировании компонента или изменении сотрудника
  useEffect(() => {
    if (selectedStaff?.id && contractsService) {
      fetchContracts()
        .catch(err => console.error('Error in fetchContracts:', err));
    } else {
      setContracts([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaff, contractsService]);
  
  // Загружаем праздники для текущего года при монтировании компонента
  useEffect(() => {
    if (holidaysService) {
      const currentYear = new Date().getFullYear();
      fetchHolidaysForYear(currentYear)
        .catch(err => console.error('Error in fetchHolidaysForYear:', err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holidaysService]);
  
  // Загружаем отпуска при монтировании компонента
  useEffect(() => {
    if (daysOfLeavesService && selectedStaff?.employeeId) {
      fetchLeavesForMonthAndYear(state.selectedDate)
        .catch(err => console.error('Error in fetchLeavesForMonthAndYear:', err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysOfLeavesService, selectedStaff]);
  
  // Загружаем праздники при изменении года в выбранной дате
  useEffect(() => {
    const selectedYear = state.selectedDate.getFullYear();
    
    // Проверяем, есть ли уже праздники для этого года
    const hasHolidaysForSelectedYear = state.holidays.some(h => h.date.getFullYear() === selectedYear);
    
    // Если нет праздников для выбранного года, загружаем их
    if (!hasHolidaysForSelectedYear && holidaysService && !state.isLoadingHolidays) {
      fetchHolidaysForYear(selectedYear)
        .catch(err => console.error('Error in fetchHolidaysForYear (year change):', err));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedDate]);
  
  // Преобразуем контракты в опции для выпадающего списка
  const contractOptions: IDropdownOption[] = state.contracts.map(contract => ({
    key: contract.id,
    text: contract.template
  }));
  
  // Находим выбранный контракт
  const selectedContract = state.contracts.find(c => c.id === state.selectedContractId);
  
  // Обработчик изменения даты
  const handleDateChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log(`[ScheduleTab] Date changed to: ${date.toLocaleDateString()}`);
      
      // Проверяем, изменился ли месяц или год
      const currentMonth = state.selectedDate.getMonth();
      const currentYear = state.selectedDate.getFullYear();
      const newMonth = date.getMonth();
      const newYear = date.getFullYear();
      
      // Устанавливаем новую выбранную дату
      setSelectedDate(date);
      
      // Если изменился месяц или год, загружаем новые данные об отпусках
      if (currentMonth !== newMonth || currentYear !== newYear) {
        console.log(`[ScheduleTab] Month or year changed from ${currentMonth+1}/${currentYear} to ${newMonth+1}/${newYear}`);
        fetchLeavesForMonthAndYear(date);
      }
      
      // Проверяем, является ли выбранная дата праздником
      if (holidaysService && state.holidays.length > 0) {
        const holidayInfo = holidaysService.getHolidayInfo(date, state.holidays);
        if (holidayInfo) {
          console.log(`[ScheduleTab] Selected date is a holiday: ${holidayInfo.title}`);
        }
      }
      
      // Проверяем, является ли выбранная дата отпуском
      if (daysOfLeavesService && state.leaves.length > 0) {
        const leaveInfo = daysOfLeavesService.getLeaveForDate(date, state.leaves);
        if (leaveInfo) {
          console.log(`[ScheduleTab] Selected date is on leave: ${leaveInfo.title}`);
        }
      }
    }
  };
  
  // Обработчик изменения контракта
  const handleContractChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      setSelectedContractId(option.key.toString());
    }
  };
  
  // Если не выбран сотрудник, показываем сообщение
  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }
  
  // Если отсутствует контекст, показываем ошибку
  if (!context) {
    return (
      <div style={{ padding: '20px' }}>
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
        >
          WebPart context is not available. Please reload the page.
        </MessageBar>
      </div>
    );
  }
  
  return (
    <div className={styles.scheduleTab}>
      <div className={styles.header}>
        <h2>Schedule for {selectedStaff.name}</h2>
      </div>
      
      {/* Отображаем сообщение об ошибке, если есть */}
      {state.error && (
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={() => setError(undefined)}
          dismissButtonAriaLabel="Close"
        >
          {state.error}
        </MessageBar>
      )}
      
      {/* Контейнер для фильтров/элементов управления - разделены как на скриншоте */}
      <div style={{ 
        display: 'flex', 
        marginTop: '15px',
        marginBottom: '15px'
      }}>
        <div style={{ marginRight: '40px' }}>
          <div>Select date</div>
          <DatePicker
            value={state.selectedDate}
            onSelectDate={handleDateChange}
            firstDayOfWeek={1}
            formatDate={(date?: Date): string => date ? date.toLocaleDateString() : ''}
            isRequired={false}
            styles={{
              root: { width: '150px' }
            }}
          />
        </div>
        
        <div>
          <div>Select contract</div>
          <Dropdown
            placeholder="Select a contract"
            options={contractOptions}
            selectedKey={state.selectedContractId}
            onChange={handleContractChange}
            disabled={state.isLoading || contractOptions.length === 0}
            styles={{
              root: { width: '250px' }
            }}
          />
        </div>
      </div>
      
      {/* Показываем спиннер при загрузке */}
      {state.isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <Spinner size={SpinnerSize.large} label="Loading schedule data..." />
        </div>
      ) : (
        <>
          {selectedContract ? (
            <div style={{ 
              border: '1px solid #e0e0e0', 
              padding: '15px', 
              borderRadius: '4px',
              minHeight: '300px',
              backgroundColor: 'white'
            }}>
              {/* Проверяем статусы - является ли выбранная дата праздником или отпуском */}
              <div style={{ marginBottom: '15px' }}>
                {state.holidays.length > 0 && holidaysService && holidaysService.isHoliday(state.selectedDate, state.holidays) ? (
                  <div style={{ 
                    backgroundColor: '#FFF4CE',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    borderLeft: '4px solid #FFB900'
                  }}>
                    <strong>Holiday: </strong>
                    {holidaysService.getHolidayInfo(state.selectedDate, state.holidays)?.title || 'Holiday'}
                  </div>
                ) : null}
                
                {state.leaves.length > 0 && daysOfLeavesService && daysOfLeavesService.isDateOnLeave(state.selectedDate, state.leaves) ? (
                  <div style={{ 
                    backgroundColor: '#E8F5FF',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    borderLeft: '4px solid #0078D4'
                  }}>
                    <strong>Leave: </strong>
                    {daysOfLeavesService.getLeaveForDate(state.selectedDate, state.leaves)?.title || 'On Leave'}
                  </div>
                ) : null}
              </div>
              
              {/* Показываем индикаторы загрузки, если они загружаются */}
              {(state.isLoadingHolidays || state.isLoadingLeaves) ? (
                <div style={{ padding: '10px', textAlign: 'center' }}>
                  {state.isLoadingHolidays && <Spinner size={SpinnerSize.small} label="Loading holidays data..." style={{ marginBottom: '10px' }} />}
                  {state.isLoadingLeaves && <Spinner size={SpinnerSize.small} label="Loading leaves data..." />}
                </div>
              ) : (
                <div style={{ padding: '10px' }}>
                  <div>
                    <p>Selected date: {state.selectedDate.toLocaleDateString()}</p>
                    <p>Month: {state.selectedDate.getMonth() + 1}/{state.selectedDate.getFullYear()}</p>
                    
                    <div style={{ marginTop: '10px' }}>
                      <div>
                        <strong>Holidays: </strong>
                        {state.holidays.length > 0 ? state.holidays.length : 'No'} holidays loaded for year {state.selectedDate.getFullYear()}
                      </div>
                      
                      <div>
                        <strong>Leaves: </strong>
                        {state.leaves.length > 0 ? state.leaves.length : 'No'} leaves found for month {state.selectedDate.getMonth() + 1}/{state.selectedDate.getFullYear()}
                      </div>
                    </div>
                  </div>
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
              {contractOptions.length > 0 ? (
                <p>Please select a contract to view the schedule</p>
              ) : (
                <p>No active contracts available for this staff member</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};