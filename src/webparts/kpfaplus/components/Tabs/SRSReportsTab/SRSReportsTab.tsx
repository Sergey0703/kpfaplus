// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/SRSReportsTab.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { ITabProps } from '../../../models/types';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { DatePicker, Dropdown, IDropdownOption, PrimaryButton, Spinner, DayOfWeek, Stack } from '@fluentui/react';
import { useDataContext } from '../../../context';
import { SRSReportsTable } from './components/SRSReportsTable';
import { SRSReportsExcelExporter } from './utils/SRSReportsExcelExporter';
import { ISRSReportData } from './interfaces/ISRSReportsInterfaces';

export const SRSReportsTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff, context } = props;

  console.log('[SRSReportsTab] Rendering with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffName: selectedStaff?.name,
    managingGroupId: props.managingGroupId,
    currentUserId: props.currentUserId
  });

  // Получаем данные сотрудников из контекста
  const { staffMembers, departments } = useDataContext();

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
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('1'); // По умолчанию Annual Leave (ID=1)
  const [typesOfLeave, setTypesOfLeave] = useState<ITypeOfLeave[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [processedReportData, setProcessedReportData] = useState<ISRSReportData[]>([]);
  const [isExporting, setIsExporting] = useState<boolean>(false);

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
  const handleExportToExcel = async (): Promise<void> => {
    console.log('[SRSReportsTab] Export to Excel button clicked');
    
    if (processedReportData.length === 0) {
      console.warn('[SRSReportsTab] No data to export');
      return;
    }
    
    try {
      setIsExporting(true);
      
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
        managingGroupId: props.managingGroupId,
        dataCount: processedReportData.length
      });

      // Получаем название группы/департамента
      const department = departments?.find(d => d.ID.toString() === props.managingGroupId);
      const groupName = department?.Title || `Group ${props.managingGroupId}`;
      
      // Параметры для экспорта
      const exportParams = {
        reportData: processedReportData,
        staffMembers: staffMembers || [],
        periodStart: selectedPeriodStart,
        periodEnd: selectedPeriodEnd,
        selectedTypeFilter: selectedTypeFilter,
        typesOfLeave: typesOfLeave,
        managingGroupId: props.managingGroupId || '',
        groupName: groupName
      };
      
      // Выполняем экспорт
      await SRSReportsExcelExporter.exportToExcel(exportParams);
      
      console.log('[SRSReportsTab] Excel export completed successfully');
      
    } catch (error) {
      console.error('[SRSReportsTab] Excel export failed:', error);
      // В реальной системе здесь можно показать уведомление об ошибке
    } finally {
      setIsExporting(false);
    }
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0' }}>
              SRS Reports for {currentSelectedStaff.name}
            </h2>
            <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
              Group ID: {props.managingGroupId} | Selected: {currentSelectedStaff.name} | Active Staff: {staffOptions.length - 1}
            </p>
          </div>
          
          {/* Кнопка Export to Excel вынесена наверх */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <PrimaryButton 
              text={isExporting ? "Exporting..." : "Export to Excel"}
              onClick={handleExportToExcel}
              disabled={isLoading || isExporting || processedReportData.length === 0}
              styles={{
                root: {
                  backgroundColor: isExporting ? '#f3f2f1' : '#217346', // зеленый цвет Excel
                  borderColor: isExporting ? '#f3f2f1' : '#217346'
                }
              }}
            />
            {isExporting && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px' }}>
                <Spinner size={1} />
                <span style={{ fontSize: '12px', color: '#666' }}>
                  Generating Excel file...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Панель управления фильтрами - более компактная */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '10px', // Уменьшен gap
        padding: '10px', // Уменьшен padding
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e1e5e9',
        marginBottom: '20px'
      }}>
        <Stack.Item style={{ minWidth: '160px' }}> {/* Уменьшена ширина */}
          <div style={{
            fontSize: '12px', // Уменьшен размер шрифта
            fontWeight: '600',
            marginBottom: '3px',
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
                width: '160px', // Уменьшена ширина
                selectors: {
                  '.ms-DatePicker-weekday': {
                    width: '30px', // Уменьшена ширина
                    height: '30px',
                    lineHeight: '30px',
                    padding: 0,
                    textAlign: 'center',
                    fontSize: '11px', // Уменьшен шрифт
                  },
                  '.ms-DatePicker-day': {
                    width: '30px',
                    height: '30px',
                    lineHeight: '30px',
                    padding: 0,
                    margin: 0,
                    fontSize: '12px',
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
                height: '28px', // Уменьшена высота
                selectors: {
                  '.ms-TextField-field': { height: '28px', fontSize: '12px' },
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
                  minWidth: '655px', // Возвращаем прежнюю ширину календаря
                }
              }
            }}
          />
        </Stack.Item>
        
        <Stack.Item style={{ minWidth: '160px' }}> {/* Уменьшена ширина */}
          <div style={{
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '3px',
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
                width: '160px',
                selectors: {
                  '.ms-DatePicker-weekday': {
                    width: '30px',
                    height: '30px',
                    lineHeight: '30px',
                    padding: 0,
                    textAlign: 'center',
                    fontSize: '11px',
                  },
                  '.ms-DatePicker-day': {
                    width: '30px',
                    height: '30px',
                    lineHeight: '30px',
                    padding: 0,
                    margin: 0,
                    fontSize: '12px',
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
                height: '28px',
                selectors: {
                  '.ms-TextField-field': { height: '28px', fontSize: '12px' },
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
                  minWidth: '655px', // Возвращаем прежнюю ширину календаря
                }
              }
            }}
          />
        </Stack.Item>
        
        <div style={{ minWidth: '150px' }}> {/* Уменьшена ширина */}
          <Dropdown
            label="Select Staff Member"
            options={staffOptions}
            selectedKey={selectedStaffId}
            onChange={(_, option) => option && handleStaffChange(option.key as string)}
            disabled={isLoading || staffOptions.length === 0}
            placeholder={staffOptions.length === 0 ? "No staff available" : "Choose staff member"}
            styles={{
              label: { fontSize: '12px', marginBottom: '3px' },
              dropdown: { height: '28px', fontSize: '12px' }
            }}
          />
          {/* Отладочная информация */}
          {staffOptions.length <= 1 && (
            <div style={{ fontSize: '9px', color: 'red', marginTop: '2px' }}>
              Debug: Staff options count: {staffOptions.length}, Total staff: {staffMembers?.length || 0}
            </div>
          )}
        </div>
        
        <div style={{ minWidth: '150px' }}> {/* Уменьшена ширина */}
          <Dropdown
            label="Select Type of Leave"
            options={typeOptions}
            selectedKey={selectedTypeFilter}
            onChange={(_, option) => option && handleTypeFilterChange(option.key as string)}
            disabled={isLoading || typesOfLeave.length === 0}
            styles={{
              label: { fontSize: '12px', marginBottom: '3px' },
              dropdown: { height: '28px', fontSize: '12px' }
            }}
          />
          {/* Отладочная информация для типов отпуска */}
          {typeOptions.length === 0 && (
            <div style={{ fontSize: '9px', color: 'red', marginTop: '2px' }}>
              Debug: No leave types loaded. Service available: {!!typeOfLeaveService}
            </div>
          )}
        </div>
        
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Spinner size={1} />
            <span style={{ fontSize: '10px', color: '#666' }}>Loading...</span>
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
            onDataUpdate={(data) => {
              console.log('[SRSReportsTab] Received processed data for export:', data.length);
              setProcessedReportData(data);
            }}
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