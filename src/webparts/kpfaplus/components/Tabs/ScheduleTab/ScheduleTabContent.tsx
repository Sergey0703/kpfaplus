// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTabContent.tsx
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
import { DayInfo } from './components/DayInfo';
import ScheduleTable, { IScheduleItem, IScheduleOptions } from './components/ScheduleTable';

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
  
  // Состояние для отображения удаленных записей
  const [showDeleted, setShowDeleted] = React.useState<boolean>(false);
  
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
  
  // Обработчик для кнопки Fill
  const handleFillButtonClick = (): void => {
    console.log('Fill button clicked');
    // Здесь будет логика заполнения данных по расписанию
    // Например, можно автоматически заполнить расписание на всю неделю
    
    // Пример логики:
    alert('Filling schedule data for selected week. This feature will be implemented in a future update.');
  };
  
  // Временные данные для ScheduleTable
  const generateMockScheduleItems = (): IScheduleItem[] => {
    if (!selectedContract) return [];
    
    // Создаем дни недели для текущей недели
    const items: IScheduleItem[] = [];
    const currentDay = new Date(selectedDate);
    currentDay.setDate(currentDay.getDate() - currentDay.getDay()); // Начинаем с воскресенья
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDay);
      date.setDate(date.getDate() + i);
      
      const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
      
      // Рабочие часы - для субботы делаем 5ч 30м, для остальных дней 0ч 00м
      const workingHours = date.getDay() === 6 ? '5h 30m' : '0h 00m';
      
      // Для субботы делаем время с 9 до 15, для остальных 0:00
      const startHour = date.getDay() === 6 ? '09' : '00';
      const startMinute = '00';
      const finishHour = date.getDay() === 6 ? '15' : '00';
      const finishMinute = '00';
      
      items.push({
        id: `schedule-${date.toISOString().split('T')[0]}-1`,
        date,
        dayOfWeek,
        workingHours,
        startHour,
        startMinute,
        finishHour,
        finishMinute,
        lunchTime: '30',
        typeOfLeave: '',
        shift: 1,
        contract: selectedContract.template,
        contractId: selectedContract.id,
        contractNumber: '1' // По умолчанию 1
      });
    }
    
    return items;
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
      ...typesOfLeave.map(t => ({ key: t.id, text: t.title })),
      { key: 'TOIL+', text: 'TOIL+' },
      { key: 'Parental Leave', text: 'Parental Leave' }
    ],
    contractNumbers: [
      { key: '1', text: '1' },
      { key: '2', text: '2' },
      { key: '3', text: '3' }
    ]
  };
  
  // Обработчики для таблицы расписания
  const handleToggleShowDeleted = (checked: boolean): void => {
    setShowDeleted(checked);
  };
  
  const handleItemChange = (item: IScheduleItem, field: string, value: string | number): void => {
    console.log(`Changed item ${item.id}, field: ${field}, value: ${value}`);
    // В реальном приложении здесь будет обновление данных
  };
  
  const handleAddShift = (date: Date): void => {
    console.log(`Adding shift for date: ${date.toLocaleDateString()}`);
    // В реальном приложении здесь будет добавление новой смены
  };
  
  const handleDeleteItem = (id: string): void => {
    console.log(`Deleting item with ID: ${id}`);
    // В реальном приложении здесь будет удаление записи
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
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <Spinner size={SpinnerSize.large} label="Loading schedule data..." />
        </div>
      ) : (
        <>
          {selectedContract ? (
            <div style={{ 
                border: 'none',              // Удаляем рамку
                padding: '0px',    
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
                  {/* Таблица расписания */}
                  <ScheduleTable
                    items={generateMockScheduleItems()}
                    options={scheduleOptions}
                    selectedDate={selectedDate}
                    selectedContract={{ id: selectedContract.id, name: selectedContract.template }}
                    isLoading={false}
                    showDeleted={showDeleted}
                    onToggleShowDeleted={handleToggleShowDeleted}
                    onItemChange={handleItemChange}
                    onAddShift={handleAddShift}
                    onDeleteItem={handleDeleteItem}
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
    </div>
  );
};