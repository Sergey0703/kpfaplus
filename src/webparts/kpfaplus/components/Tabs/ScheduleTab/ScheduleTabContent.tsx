// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { 
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IDropdownOption
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract } from '../../../models/IContract';
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import styles from './ScheduleTab.module.scss';

// Импортируем компоненты
import { FilterControls } from './components/FilterControls';
import { LeavesList } from './components/LeavesList';
import { DayInfo } from './components/DayInfo';
import { MonthSummary } from './components/MonthSummary';
import { TypesOfLeaveInfo } from './components/TypesOfLeaveInfo';

// Интерфейс для типизации сервисов
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
    onErrorDismiss
  } = props;
  
  // Находим выбранный контракт
  const selectedContract = contracts.find(c => c.id === selectedContractId);
  
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
      
      {/* Фильтры выбора даты и контракта */}
      <FilterControls
        selectedDate={selectedDate}
        contracts={contracts}
        selectedContractId={selectedContractId}
        isLoading={isLoading}
        onDateChange={onDateChange}
        onContractChange={onContractChange}
      />
      
      {/* Показываем спиннер при загрузке */}
      {isLoading ? (
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
              <DayInfo
                selectedDate={selectedDate}
                holidays={holidays}
                leaves={leaves}
                typesOfLeave={typesOfLeave}
                holidaysService={holidaysService}
                daysOfLeavesService={daysOfLeavesService}
              />
              
              {/* Показываем индикаторы загрузки, если они загружаются */}
              {(isLoadingHolidays || isLoadingLeaves || isLoadingTypesOfLeave) ? (
                <div style={{ padding: '10px', textAlign: 'center' }}>
                  {isLoadingHolidays && <Spinner size={SpinnerSize.small} label="Loading holidays data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingLeaves && <Spinner size={SpinnerSize.small} label="Loading leaves data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingTypesOfLeave && <Spinner size={SpinnerSize.small} label="Loading types of leave..." />}
                </div>
              ) : (
                <div style={{ padding: '10px' }}>
                  {/* Информация о месяце */}
                  <MonthSummary
                    selectedDate={selectedDate}
                    holidays={holidays}
                    leaves={leaves}
                    typesOfLeave={typesOfLeave}
                  />
                  
                  {/* Справочник типов отпусков */}
                  <TypesOfLeaveInfo
                    typesOfLeave={typesOfLeave}
                    isLoadingTypesOfLeave={isLoadingTypesOfLeave}
                  />
                  
                  {/* Список отпусков */}
                  {leaves.length > 0 && (
                    <LeavesList
                      leaves={leaves}
                      isLoading={isLoadingLeaves}
                      typesOfLeave={typesOfLeave}
                    />
                  )}
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
    </div>
  );
};