// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/SRSReportsTab.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ITabProps } from '../../../models/types';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { DatePicker, Dropdown, IDropdownOption, PrimaryButton, Spinner, DayOfWeek, Stack } from '@fluentui/react';
import { useDataContext } from '../../../context';
import { SRSReportsTable } from './components/SRSReportsTable';

export const SRSReportsTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff, context } = props;

  console.log('[SRSReportsTab] Rendering with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffName: selectedStaff?.name,
    managingGroupId: props.managingGroupId,
    currentUserId: props.currentUserId
  });

  // Получаем данные сотрудников из контекста
  const { staffMembers } = useDataContext();

  console.log('[SRSReportsTab] Staff members from context:', {
    totalStaffMembers: staffMembers?.length || 0,
    staffMembers: staffMembers?.slice(0, 3).map(s => ({ id: s.id, name: s.name, deleted: s.deleted }))
  });

  // Инициализируем сервис типов отпусков
  const typeOfLeaveService = useMemo(() => {
    if (context) {
      console.log('[SRSReportsTab] Initializing TypeOfLeaveService');
      return TypeOfLeaveService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Функция для получения первого и последнего дня текущего месяца
  const getCurrentMonthDates = (): { firstDay: Date; lastDay: Date } => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { firstDay, lastDay };
  };

  // Состояния для фильтров
  const { firstDay, lastDay } = getCurrentMonthDates();
  const [selectedPeriodStart, setSelectedPeriodStart] = useState<Date>(firstDay);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState<Date>(lastDay);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(selectedStaff?.id || '');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('');
  const [typesOfLeave, setTypesOfLeave] = useState<ITypeOfLeave[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Локализация для DatePicker (копируем из LeavesFilterPanel)
  const datePickerStringsEN = {
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    shortMonths: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ],
    days: [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
    ],
    shortDays: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
    goToToday: 'Go to today',
    weekNumberFormatString: 'Week number {0}',
    prevMonthAriaLabel: 'Previous month',
    nextMonthAriaLabel: 'Next month',
    prevYearAriaLabel: 'Previous year',
    nextYearAriaLabel: 'Next year',
    closeButtonAriaLabel: 'Close date picker',
    monthPickerHeaderAriaLabel: '{0}, select to change the year',
    yearPickerHeaderAriaLabel: '{0}, select to change the month'
  };

  // Форматирование даты в формате dd.mm.yyyy (копируем из LeavesFilterPanel)
  const formatDate = (date?: Date): string => {
    if (!date) return '';
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  };

  const calendarMinWidth = '655px';

  // Загружаем типы отпусков при монтировании
  useEffect(() => {
    const loadTypesOfLeave = async (): Promise<void> => {
      if (typeOfLeaveService) {
        console.log('[SRSReportsTab] Loading types of leave');
        setIsLoading(true);
        try {
          const types = await typeOfLeaveService.getAllTypesOfLeave();
          console.log('[SRSReportsTab] Loaded types:', types.length);
          setTypesOfLeave(types);
        } catch (error) {
          console.error('[SRSReportsTab] Error loading types of leave:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    void loadTypesOfLeave();
  }, [typeOfLeaveService]);

  // Обновляем выбранного сотрудника при изменении selectedStaff
  useEffect(() => {
    if (selectedStaff) {
      console.log('[SRSReportsTab] Setting selected staff ID:', selectedStaff.id);
      setSelectedStaffId(selectedStaff.id);
    }
  }, [selectedStaff]);

  // Логируем инициализированные даты
  console.log('[SRSReportsTab] Initialized dates:', {
    periodStart: selectedPeriodStart.toLocaleDateString(),
    periodEnd: selectedPeriodEnd.toLocaleDateString()
  });

  // Подготавливаем опции для dropdown типов отпусков
  // ЗАКОММЕНТИРОВАНА опция "All Types"
  const typeOptions: IDropdownOption[] = [
    // { key: '', text: 'All Types' }, // ЗАКОММЕНТИРОВАНО: пока убираем опцию "All Types"
    ...typesOfLeave.map(type => ({
      key: type.id,
      text: type.title
    }))
  ];

  // Подготавливаем опции для dropdown сотрудников (исключаем удаленных)
  const staffOptions: IDropdownOption[] = [
    { key: '', text: 'All Staff Members' }, // Первый пункт для выбора всех сотрудников
    ...(staffMembers || [])
      .filter(staff => staff.deleted !== 1) // Исключаем помеченных на удаление
      .map(staff => ({
        key: staff.id,
        text: staff.name
      }))
  ];

  console.log('[SRSReportsTab] Staff options prepared:', {
    totalStaff: staffMembers?.length || 0,
    activeStaff: staffOptions.length,
    selectedStaffId,
    firstFewOptions: staffOptions.slice(0, 3)
  });

  // Обработчики для фильтров
  const handlePeriodStartChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[SRSReportsTab] Period start changed:', formatDate(date));
      setSelectedPeriodStart(date);
      
      // Автоматически устанавливаем конец периода как последний день того же месяца
      const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      console.log('[SRSReportsTab] Auto-setting end date to last day of month:', formatDate(lastDayOfMonth));
      setSelectedPeriodEnd(lastDayOfMonth);
    }
  };

  const handlePeriodEndChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[SRSReportsTab] Period end changed:', formatDate(date));
      setSelectedPeriodEnd(date);
    }
  };

  const handleTypeFilterChange = (typeId: string): void => {
    console.log('[SRSReportsTab] Type filter changed:', typeId);
    setSelectedTypeFilter(typeId);
  };

  const handleStaffChange = (staffId: string): void => {
    console.log('[SRSReportsTab] Staff changed:', staffId);
    setSelectedStaffId(staffId);
  };

  // Обработчик для кнопки Export to Excel
  const handleExportToExcel = (): void => {
    console.log('[SRSReportsTab] Export to Excel button clicked');
    
    // Находим выбранного сотрудника или обрабатываем случай "All Staff Members"
    let selectedStaffInfo;
    if (selectedStaffId === '') {
      selectedStaffInfo = {
        id: 'all',
        name: 'All Staff Members',
        count: staffOptions.length - 1 // -1 потому что первый элемент "All Staff Members"
      };
    } else {
      selectedStaffInfo = {
        id: selectedStaffId,
        name: (staffMembers || []).find(staff => staff.id === selectedStaffId)?.name || 'Unknown',
        count: 1
      };
    }
    
    console.log('[SRSReportsTab] Export parameters:', {
      periodStart: formatDate(selectedPeriodStart),
      periodEnd: formatDate(selectedPeriodEnd),
      selectedStaffInfo,
      selectedType: selectedTypeFilter,
      managingGroupId: props.managingGroupId
    });
    // TODO: Реализовать экспорт в Excel
  };

  // Обработчики закрытия календарей
  const calendarDismissHandlerStart = (): void => {
    console.log('[SRSReportsTab] Start date calendar dismissed');
  };

  const calendarDismissHandlerEnd = (): void => {
    console.log('[SRSReportsTab] End date calendar dismissed');
  };

  if (!selectedStaff) {
    return (
      <div style={{ padding: '20px' }}>
        <h3>Please select a staff member</h3>
        <p>Choose a staff member from the left panel to view SRS reports.</p>
      </div>
    );
  }

  // Находим выбранного сотрудника для отображения
  const currentSelectedStaff = selectedStaffId === '' 
    ? { name: 'All Staff Members', id: 'all' } 
    : ((staffMembers || []).find(staff => staff.id === selectedStaffId) || selectedStaff);

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          SRS Reports for {currentSelectedStaff.name}
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {props.managingGroupId} | Selected: {currentSelectedStaff.name} | Active Staff: {staffOptions.length - 1}
        </p>
      </div>

      {/* Панель управления фильтрами */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e1e5e9',
        marginBottom: '20px'
      }}>
        <Stack.Item style={{ minWidth: '220px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>Start Date</div>
          <DatePicker
            value={selectedPeriodStart}
            onSelectDate={handlePeriodStartChange}
            firstDayOfWeek={DayOfWeek.Monday}
            strings={datePickerStringsEN}
            formatDate={formatDate}
            allowTextInput={false}
            disabled={isLoading}
            showGoToToday={true}
            showMonthPickerAsOverlay={true}
            styles={{
              root: {
                width: '220px',
                selectors: {
                  '.ms-DatePicker-weekday': {
                    width: '35px',
                    height: '35px',
                    lineHeight: '35px',
                    padding: 0,
                    textAlign: 'center',
                    fontSize: '12px',
                  },
                  '.ms-DatePicker-day': {
                    width: '35px',
                    height: '35px',
                    lineHeight: '35px',
                    padding: 0,
                    margin: 0,
                    fontSize: '14px',
                    textAlign: 'center',
                  },
                  'td[class*="dayOutsideNavigatedMonth"] button[class*="dayButton"]': {
                    color: '#a19f9d',
                  },
                  '.ms-DatePicker-table': {
                    width: '100%',
                  },
                }
              },
              textField: {
                width: '100%',
                height: '32px',
                selectors: {
                  '.ms-TextField-field': { height: '32px' },
                },
              },
            }}
            calendarProps={{
              onDismiss: calendarDismissHandlerStart,
              firstDayOfWeek: DayOfWeek.Monday,
              showGoToToday: true,
              showSixWeeksByDefault: true,
              showWeekNumbers: false,
            }}
            calloutProps={{
              styles: {
                calloutMain: {
                  minWidth: calendarMinWidth,
                }
              }
            }}
          />
        </Stack.Item>
        
        <Stack.Item style={{ minWidth: '220px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>End Date</div>
          <DatePicker
            value={selectedPeriodEnd}
            onSelectDate={handlePeriodEndChange}
            firstDayOfWeek={DayOfWeek.Monday}
            strings={datePickerStringsEN}
            formatDate={formatDate}
            allowTextInput={false}
            disabled={isLoading}
            showGoToToday={true}
            showMonthPickerAsOverlay={true}
            styles={{
              root: {
                width: '220px',
                selectors: {
                  '.ms-DatePicker-weekday': {
                    width: '35px',
                    height: '35px',
                    lineHeight: '35px',
                    padding: 0,
                    textAlign: 'center',
                    fontSize: '12px',
                  },
                  '.ms-DatePicker-day': {
                    width: '35px',
                    height: '35px',
                    lineHeight: '35px',
                    padding: 0,
                    margin: 0,
                    fontSize: '14px',
                    textAlign: 'center',
                  },
                  'td[class*="dayOutsideNavigatedMonth"] button[class*="dayButton"]': {
                    color: '#a19f9d',
                  },
                  '.ms-DatePicker-table': {
                    width: '100%',
                  },
                }
              },
              textField: {
                width: '100%',
                height: '32px',
                selectors: {
                  '.ms-TextField-field': { height: '32px' },
                },
              },
            }}
            calendarProps={{
              onDismiss: calendarDismissHandlerEnd,
              firstDayOfWeek: DayOfWeek.Monday,
              showGoToToday: true,
              showSixWeeksByDefault: true,
              showWeekNumbers: false,
            }}
            calloutProps={{
              styles: {
                calloutMain: {
                  minWidth: calendarMinWidth,
                }
              }
            }}
          />
        </Stack.Item>
        
        <div style={{ minWidth: '200px' }}>
          <Dropdown
            label="Select Staff Member"
            options={staffOptions}
            selectedKey={selectedStaffId}
            onChange={(_, option) => option && handleStaffChange(option.key as string)}
            disabled={isLoading || staffOptions.length === 0}
            placeholder={staffOptions.length === 0 ? "No staff available" : "Choose staff member"}
          />
          {/* Отладочная информация */}
          {staffOptions.length <= 1 && (
            <div style={{ fontSize: '10px', color: 'red', marginTop: '2px' }}>
              Debug: Staff options count: {staffOptions.length}, Total staff: {staffMembers?.length || 0}
            </div>
          )}
        </div>
        
        <div style={{ minWidth: '200px' }}>
          <Dropdown
            label="Select Type of Leave"
            options={typeOptions}
            selectedKey={selectedTypeFilter}
            onChange={(_, option) => option && handleTypeFilterChange(option.key as string)}
            disabled={isLoading || typesOfLeave.length === 0}
            placeholder={typeOptions.length === 0 ? "No leave types available" : "Choose leave type"}
          />
          {/* Отладочная информация для типов отпуска */}
          {typeOptions.length === 0 && (
            <div style={{ fontSize: '10px', color: 'red', marginTop: '2px' }}>
              Debug: No leave types loaded. Service available: {!!typeOfLeaveService}
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <PrimaryButton 
            text="Export to Excel" 
            onClick={handleExportToExcel}
            disabled={isLoading || !selectedTypeFilter} // Отключаем если тип отпуска не выбран
            styles={{
              root: {
                backgroundColor: '#217346', // зеленый цвет Excel
                borderColor: '#217346'
              }
            }}
          />
        </div>
        
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Spinner size={1} />
            <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
          </div>
        )}
      </div>

      {/* Таблица SRS Reports */}
      <div style={{ flex: 1, marginTop: '15px' }}>
        {context ? (
          <SRSReportsTable
            staffMembers={staffMembers || []}
            selectedStaffId={selectedStaffId}
            selectedPeriodStart={selectedPeriodStart}
            selectedPeriodEnd={selectedPeriodEnd}
            selectedTypeFilter={selectedTypeFilter}
            typesOfLeave={typesOfLeave}
            isLoading={isLoading}
            context={context}
            currentUserId={props.currentUserId}
            managingGroupId={props.managingGroupId}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Context not available. Please reload the page.</p>
          </div>
        )}
      </div>
    </div>
  );
};