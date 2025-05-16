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
import { getLeaveTypeInfo } from './ScheduleTabApi';
import styles from './ScheduleTab.module.scss';

// Импортируем компоненты
import { FilterControls } from './components/FilterControls';
import { LeavesList } from './components/LeavesList';
import { DayInfo } from './components/DayInfo';
// Скрываем из отображения, но оставляем импорт для типов и функций
// import { MonthSummary } from './components/MonthSummary';
// import { TypesOfLeaveInfo } from './components/TypesOfLeaveInfo';

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
  
  // Логирование информации для отладки (вместо отображения в UI)
  React.useEffect(() => {
    // Создаем группу в консоли для более организованного вывода
    console.group("Schedule Tab Data");
    
    // Логирование базовой информации о выбранной дате и месяце
    console.log(`Selected date: ${selectedDate.toLocaleDateString()}`);
    console.log(`Month: ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    
    // Логирование информации о праздниках
    console.log(`\n--- Holidays ---`);
    console.log(`${holidays.length > 0 ? holidays.length : 'No'} holidays loaded for month ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    if (holidays.length > 0) {
      // Выводим детальную информацию о каждом празднике
      holidays.forEach((holiday, index) => {
        console.log(`Holiday #${index + 1}: ${holiday.title}, Date: ${holiday.date.toLocaleDateString()}`);
      });
    }
    
    // Логирование информации об отпусках
    console.log(`\n--- Leaves ---`);
    console.log(`${leaves.length > 0 ? leaves.length : 'No'} leaves found for month ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
    if (leaves.length > 0) {
      // Подсчет открытых отпусков
      const openLeaves = leaves.filter(l => !l.endDate);
      console.log(`Open leaves: ${openLeaves.length}`);
      
      // Группировка отпусков по типам для статистики
      const leavesByType: Record<string, ILeaveDay[]> = {};
      leaves.forEach(leave => {
        const typeId = leave.typeOfLeave.toString();
        if (!leavesByType[typeId]) {
          leavesByType[typeId] = [];
        }
        leavesByType[typeId].push(leave);
      });
      
      // Выводим статистику по типам отпусков
      console.log(`\n--- Leaves by Type ---`);
      Object.keys(leavesByType).forEach(typeId => {
        const typeInfo = getLeaveTypeInfo(parseInt(typeId), typesOfLeave);
        const count = leavesByType[typeId].length;
        console.log(`${typeInfo.title}: ${count} ${count === 1 ? 'leave' : 'leaves'}`);
      });
      
      // Выводим детальную информацию о каждом отпуске
      console.log(`\n--- Leave Details ---`);
      leaves.forEach((leave, index) => {
        const typeInfo = getLeaveTypeInfo(leave.typeOfLeave, typesOfLeave);
        console.log(`Leave #${index + 1}: ${leave.title}`);
        console.log(`  Type: ${typeInfo.title}`);
        console.log(`  Period: ${leave.startDate.toLocaleDateString()} - ${leave.endDate ? leave.endDate.toLocaleDateString() : 'open'}`);
        
        // Определение статуса отпуска
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(leave.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        let status = '';
        if (!leave.endDate) {
          status = startDate <= today ? 'Active' : 'Future';
        } else {
          const endDate = new Date(leave.endDate);
          endDate.setHours(0, 0, 0, 0);
          
          if (today < startDate) {
            status = 'Future';
          } else if (today > endDate) {
            status = 'Completed';
          } else {
            status = 'Active';
          }
        }
        console.log(`  Status: ${status}`);
        
        // Расчет длительности отпуска
        if (!leave.endDate) {
          const diffTime = Math.abs(today.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          console.log(`  Duration: ${diffDays}+ days (ongoing)`);
        } else {
          const endDate = new Date(leave.endDate);
          const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          console.log(`  Duration: ${diffDays} days`);
        }
      });
    }
    
    // Логирование информации о типах отпусков
    console.log(`\n--- Types of Leave ---`);
    console.log(`${typesOfLeave.length} types of leave loaded`);
    if (typesOfLeave.length > 0) {
      typesOfLeave.forEach((type, index) => {
        console.log(`Type #${index + 1}: ${type.title}${type.color ? `, Color: ${type.color}` : ''}`);
      });
    }
    
    // Логирование информации о контрактах
    console.log(`\n--- Contracts ---`);
    console.log(`${contracts.length} active contracts loaded`);
    console.log(`Selected contract: ${selectedContract ? selectedContract.template : 'None'}`);
    
    // Завершаем группу консоли
    console.groupEnd();
  }, [selectedDate, holidays, leaves, typesOfLeave, contracts, selectedContract]);
  
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
                  {/* УБРАНО: MonthSummary и TypesOfLeaveInfo */}
                  
                  {/* ЗДЕСЬ БУДЕТ НОВАЯ ТАБЛИЦА */}
                  <div style={{ 
                    minHeight: '300px', 
                    border: '1px dashed #ccc', 
                    borderRadius: '4px', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center',
                    padding: '20px',
                    marginTop: '20px'
                  }}>
                    <p>Здесь будет размещена новая таблица расписания</p>
                  </div>
                  
                  {/* Оставляем список отпусков, так как он может быть полезен для просмотра */}
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