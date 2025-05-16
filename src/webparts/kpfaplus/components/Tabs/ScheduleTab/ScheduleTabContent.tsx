// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { 
  DatePicker,
  Dropdown,
  IDropdownOption,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  Text
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract } from '../../../models/IContract';
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { getLeaveTypeText } from './ScheduleTabApi';
import styles from './ScheduleTab.module.scss';

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
  holidaysService?: any;
  daysOfLeavesService?: any;
  onDateChange: (date: Date | null | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onErrorDismiss: () => void;
}

/**
 * Компонент выбора даты и контракта
 */
export const FilterControls: React.FC<{
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  onDateChange: (date: Date | null | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
}> = ({ selectedDate, contracts, selectedContractId, isLoading, onDateChange, onContractChange }) => {
  // Преобразуем контракты в опции для выпадающего списка
  const contractOptions: IDropdownOption[] = contracts.map(contract => ({
    key: contract.id,
    text: contract.template
  }));
  
  return (
    <div style={{ 
      display: 'flex', 
      marginTop: '15px',
      marginBottom: '15px'
    }}>
      <div style={{ marginRight: '40px' }}>
        <div>Select date</div>
        <DatePicker
          value={selectedDate}
          onSelectDate={onDateChange}
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
          selectedKey={selectedContractId}
          onChange={onContractChange}
          disabled={isLoading || contractOptions.length === 0}
          styles={{
            root: { width: '250px' }
          }}
        />
      </div>
    </div>
  );
};

/**
 * Компонент списка отпусков
 */
export const LeavesList: React.FC<{
  leaves: ILeaveDay[];
  isLoading: boolean;
}> = ({ leaves, isLoading }) => {
  // Определяем колонки для таблицы отпусков
  const leavesColumns: IColumn[] = [
    {
      key: 'title',
      name: 'Название',
      fieldName: 'title',
      minWidth: 150,
      isResizable: true
    },
    {
      key: 'startDate',
      name: 'Дата начала',
      fieldName: 'startDate',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => (
        <span>{item.startDate.toLocaleDateString()}</span>
      )
    },
    {
      key: 'endDate',
      name: 'Дата окончания',
      fieldName: 'endDate',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => (
        <span>{item.endDate.toLocaleDateString()}</span>
      )
    },
    {
      key: 'duration',
      name: 'Длительность',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 чтобы включить день окончания
        return <span>{diffDays} дн.</span>;
      }
    },
    {
      key: 'typeOfLeave',
      name: 'Тип отпуска',
      fieldName: 'typeOfLeave',
      minWidth: 120,
      isResizable: true,
      onRender: (item: ILeaveDay) => (
        <span>{getLeaveTypeText(item.typeOfLeave)}</span>
      )
    }
  ];
  
  // Сортируем отпуска по дате начала
  const sortedLeaves = [...leaves].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  return (
    <div style={{ marginTop: '20px' }}>
      <Text variant="large" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
        Список отпусков в текущем месяце
      </Text>
      <DetailsList
        items={sortedLeaves}
        columns={leavesColumns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        styles={{
          root: {
            '.ms-DetailsRow': {
              borderBottom: '1px solid #f3f2f1'
            },
            '.ms-DetailsRow:hover': {
              backgroundColor: '#f5f5f5'
            },
            // Выделяем каждую вторую строку
            '.ms-DetailsRow:nth-child(even)': {
              backgroundColor: '#fafafa'
            }
          }
        }}
      />
    </div>
  );
};

/**
 * Компонент информации о выбранной дате
 */
export const DayInfo: React.FC<{
  selectedDate: Date;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  holidaysService?: any;
  daysOfLeavesService?: any;
}> = ({ selectedDate, holidays, leaves, holidaysService, daysOfLeavesService }) => {
  // Проверяем является ли выбранная дата праздником
  const isHoliday = holidaysService && holidays.length > 0 && 
    holidaysService.isHoliday(selectedDate, holidays);
  
  // Получаем информацию о празднике, если есть
  const holidayInfo = isHoliday && holidaysService ? 
    holidaysService.getHolidayInfo(selectedDate, holidays) : undefined;
  
  // Проверяем является ли выбранная дата отпуском
  const isOnLeave = daysOfLeavesService && leaves.length > 0 && 
    daysOfLeavesService.isDateOnLeave(selectedDate, leaves);
  
  // Получаем информацию об отпуске, если есть
  const leaveInfo = isOnLeave && daysOfLeavesService ? 
    daysOfLeavesService.getLeaveForDate(selectedDate, leaves) : undefined;
  
  return (
    <div style={{ marginBottom: '15px' }}>
      {isHoliday && holidayInfo && (
        <div style={{ 
          backgroundColor: '#FFF4CE',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #FFB900'
        }}>
          <strong>Holiday: </strong>
          {holidayInfo.title}
        </div>
      )}
      
      {isOnLeave && leaveInfo && (
        <div style={{ 
          backgroundColor: '#E8F5FF',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #0078D4'
        }}>
          <strong>Leave: </strong>
          {leaveInfo.title}
        </div>
      )}
    </div>
  );
};

/**
 * Информационный блок с данными о месяце
 */
export const MonthSummary: React.FC<{
  selectedDate: Date;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
}> = ({ selectedDate, holidays, leaves }) => {
  return (
    <div style={{ padding: '10px' }}>
      <div>
        <p>Selected date: {selectedDate.toLocaleDateString()}</p>
        <p>Month: {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}</p>
        
        <div style={{ marginTop: '10px' }}>
          <div>
            <strong>Holidays: </strong>
            {holidays.length > 0 ? holidays.length : 'No'} holidays loaded for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
          </div>
          
          <div>
            <strong>Leaves: </strong>
            {leaves.length > 0 ? leaves.length : 'No'} leaves found for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
};

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
                holidaysService={holidaysService}
                daysOfLeavesService={daysOfLeavesService}
              />
              
              {/* Показываем индикаторы загрузки, если они загружаются */}
              {(isLoadingHolidays || isLoadingLeaves) ? (
                <div style={{ padding: '10px', textAlign: 'center' }}>
                  {isLoadingHolidays && <Spinner size={SpinnerSize.small} label="Loading holidays data..." style={{ marginBottom: '10px' }} />}
                  {isLoadingLeaves && <Spinner size={SpinnerSize.small} label="Loading leaves data..." />}
                </div>
              ) : (
                <div style={{ padding: '10px' }}>
                  {/* Информация о месяце */}
                  <MonthSummary
                    selectedDate={selectedDate}
                    holidays={holidays}
                    leaves={leaves}
                  />
                  
                  {/* Список отпусков */}
                  {leaves.length > 0 && (
                    <LeavesList
                      leaves={leaves}
                      isLoading={isLoadingLeaves}
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