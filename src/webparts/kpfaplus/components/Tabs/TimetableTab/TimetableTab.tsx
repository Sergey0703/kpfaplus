// src/webparts/kpfaplus/components/Tabs/TimetableTab/TimetableTab.tsx
import * as React from 'react';
import { useEffect, useMemo } from 'react';
import { 
  DatePicker, 
  DayOfWeek, 
  MessageBar,
  MessageBarType,
  Spinner
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';
import { StaffRecordsService } from '../../../services/StaffRecordsService';
import { 
  IWeekInfo, 
  IWeekCalculationParams,
  IDayInfo
} from './interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from './utils/TimetableWeekCalculator';
import { useTimetableTabState } from './utils/useTimetableTabState';
import { useTimetableStaffRecordsData } from './utils/useTimetableStaffRecordsData';
import { 
  TimetableWeekGroup, 
  TimetableExpandControls 
} from './components/TimetableWeekGroup';

// Константы
const calendarMinWidth = '655px';

export interface ITimetableTabProps extends ITabProps {
  // Дополнительные пропсы для таблицы времени, если понадобятся
}

// Локализация для DatePicker
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

// Форматирование даты в формате dd.mm.yyyy
const formatDate = (date?: Date): string => {
  if (!date) return '';
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
};

export const TimetableTab: React.FC<ITimetableTabProps> = (props) => {
  const { managingGroupId, currentUserId, dayOfStartWeek, context } = props;
  
  // Получаем данные из контекста
  const { staffMembers } = useDataContext();

 /* console.log('[TimetableTab] Rendering with props:', {
    managingGroupId,
    currentUserId,
    dayOfStartWeek,
    staffMembersCount: staffMembers.length
  }); */

  // *** ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ ПАРАМЕТРОВ ФИЛЬТРАЦИИ ***
 /* console.log('[TimetableTab] Filter parameters for server-side filtering:', {
    currentUserId,
    managingGroupId,
    dayOfStartWeek,
    staffMembersCount: staffMembers.length,
    hasContext: !!context,
    note: 'These parameters will be used for individual staff requests'
  }); */

  // Проверяем employeeId у сотрудников для отладки
  if (staffMembers.length > 0) {
    //console.log('[TimetableTab] Staff members analysis for server requests:');
    
  //  const staffWithEmployeeId = staffMembers.filter(s => s.employeeId && s.employeeId !== '0');
  //  const activeStaff = staffMembers.filter(s => s.deleted !== 1);
 //   const activeStaffWithEmployeeId = staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0');
    
   /* console.log('[TimetableTab] Staff statistics:', {
      total: staffMembers.length,
      withEmployeeId: staffWithEmployeeId.length,
      active: activeStaff.length,
      activeWithEmployeeId: activeStaffWithEmployeeId.length,
      willMakeRequests: activeStaffWithEmployeeId.length
    }); */

    // Показываем примеры сотрудников для которых будут делаться запросы
  //  console.log('[TimetableTab] Sample staff members for server requests:');
  /*  activeStaffWithEmployeeId.slice(0, 5).forEach((staff, index) => {
      console.log(`[TimetableTab] Request ${index + 1} - ${staff.name}:`, {
        employeeId: staff.employeeId,
        employeeIdType: typeof staff.employeeId,
        id: staff.id,
        deleted: staff.deleted,
        willRequest: true
      });
    }); */

    // Показываем сотрудников которые будут пропущены
  //  const skippedStaff = staffMembers.filter(s => 
  //    s.deleted === 1 || !s.employeeId || s.employeeId === '0'
  //  );
    
   /* if (skippedStaff.length > 0) {
    //  console.log('[TimetableTab] Staff members that will be SKIPPED:');
      skippedStaff.slice(0, 3).forEach((staff, index) => {
        console.log(`[TimetableTab] Skipped ${index + 1} - ${staff.name}:`, {
          employeeId: staff.employeeId,
          deleted: staff.deleted,
          reason: staff.deleted === 1 ? 'deleted' : 'no employeeId'
        });
      });
    } */

  }

  // Инициализируем хуки состояния
  const {
    state,
    setState,
    toggleWeekExpand,
    expandAllWeeks,
    collapseAllWeeks,
    setWeeks,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords,
    setWeeksData
  } = useTimetableTabState();

  // Инициализируем сервис StaffRecords
  const staffRecordsService = useMemo(() => {
    if (context) {
      console.log('[TimetableTab] Initializing StaffRecordsService for individual staff requests');
      return StaffRecordsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Рассчитываем недели для выбранного месяца
  const weeks: IWeekInfo[] = useMemo(() => {
    const weekCalculationParams: IWeekCalculationParams = {
      selectedDate: state.selectedDate,
      startWeekDay: dayOfStartWeek || 7 // По умолчанию суббота
    };

    const calculatedWeeks = TimetableWeekCalculator.calculateWeeksForMonth(weekCalculationParams);
    
    console.log('[TimetableTab] Calculated weeks for server requests:', {
      selectedMonth: state.selectedDate.toLocaleDateString(),
      startWeekDay: dayOfStartWeek,
      weeksCount: calculatedWeeks.length,
      dateRange: {
        start: calculatedWeeks[0]?.weekStart.toLocaleDateString(),
        end: calculatedWeeks[calculatedWeeks.length - 1]?.weekEnd.toLocaleDateString()
      },
      weekRanges: calculatedWeeks.map(w => ({
        weekNum: w.weekNum,
        start: w.weekStart.toLocaleDateString(),
        end: w.weekEnd.toLocaleDateString()
      }))
    });

    return calculatedWeeks;
  }, [state.selectedDate, dayOfStartWeek]);

  // Обновляем состояние недель при их пересчете
  useEffect(() => {
    if (weeks.length > 0 && weeks.length !== state.weeks.length) {
      console.log('[TimetableTab] Updating weeks in state for server requests:', weeks.length);
      setWeeks(weeks);
    }
  }, [weeks, state.weeks.length, setWeeks]);

  // Инициализируем хук загрузки данных - ДАННЫЕ ФИЛЬТРУЮТСЯ НА СЕРВЕРЕ
  const { refreshTimetableData } = useTimetableStaffRecordsData({
    context,
    selectedDate: state.selectedDate,
    currentUserId,          // *** ИСПОЛЬЗУЕТСЯ ДЛЯ СЕРВЕРНОЙ ФИЛЬТРАЦИИ ***
    managingGroupId,        // *** ИСПОЛЬЗУЕТСЯ ДЛЯ СЕРВЕРНОЙ ФИЛЬТРАЦИИ ***
    staffRecordsService,
    weeks: state.weeks,
    staffMembers,           // Активные сотрудники с employeeId будут обработаны
    setWeeksData,
    setStaffRecords,
    setIsLoadingStaffRecords,
    setErrorStaffRecords
  });

  // Обработчики событий
  const handleMonthChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[TimetableTab] Month changed to:', formatDate(date));
      console.log('[TimetableTab] This will trigger new server requests for all active staff');
      
      // Обновляем выбранную дату через setState
      setState(prevState => ({
        ...prevState,
        selectedDate: date
      }));
    }
  };

  // Получаем статистику
  const statistics = useMemo(() => {
    const expandedCount = state.expandedWeeks.size;
    const totalWeeks = state.weeksData.length;
    const weeksWithData = state.weeksData.filter(w => w.hasData).length;
    
    // Подсчитываем общее количество сотрудников и записей
    let staffCount = 0;
    let recordsCount = 0;
    
    if (state.weeksData.length > 0) {
      // Берем количество сотрудников из первой недели (состав одинаков)
      staffCount = state.weeksData[0].staffRows.length;
      
      // Подсчитываем общее количество записей
      state.weeksData.forEach(weekGroup => {
        weekGroup.staffRows.forEach(staffRow => {
          Object.values(staffRow.weekData.days).forEach((day: IDayInfo) => {
            recordsCount += day.shifts ? day.shifts.length : 0;
          });
        });
      });
    }
    
    const stats = {
      expandedCount,
      totalWeeks,
      weeksWithData,
      staffCount,
      recordsCount
    };
    
    console.log('[TimetableTab] Current statistics from server-filtered data:', stats);
    return stats;
  }, [state.expandedWeeks.size, state.weeksData, state.staffRecords.length]);

  // Логируем изменения состояния
  useEffect(() => {
    console.log('[TimetableTab] State updated:', {
      selectedDate: state.selectedDate.toLocaleDateString(),
      weeksCount: state.weeks.length,
      weeksDataCount: state.weeksData.length,
      staffRecordsCount: state.staffRecords.length,
      isLoading: state.isLoadingStaffRecords,
      hasError: !!state.errorStaffRecords,
      note: 'Data from individual server requests per staff member'
    });
  }, [state]);

  console.log('[TimetableTab] Final render state:', {
    hasWeeksData: state.weeksData.length > 0,
    isLoading: state.isLoadingStaffRecords,
    hasError: !!state.errorStaffRecords,
    statistics,
    filteringNote: 'Server-side filtering by StaffMember, Manager, and StaffGroup'
  });

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Заголовок */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Staff Timetable - Week Groups View
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {managingGroupId} | Current User ID: {currentUserId} | 
          Week starts on day: {dayOfStartWeek} | 
          Staff count: {statistics.staffCount} | 
          Records: {statistics.recordsCount}
        </p>
       
      </div>

      {/* Панель настроек */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '15px',
        padding: '15px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        border: '1px solid #e1e5e9',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {/* Выбор месяца */}
        <div style={{ minWidth: '220px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: '600',
            marginBottom: '5px',
            color: '#323130'
          }}>Select Month</div>
          <DatePicker
            value={state.selectedDate}
            onSelectDate={handleMonthChange}
            firstDayOfWeek={DayOfWeek.Monday}
            strings={datePickerStringsEN}
            formatDate={formatDate}
            allowTextInput={false}
            disabled={state.isLoadingStaffRecords}
            showGoToToday={true}
            showMonthPickerAsOverlay={true}
            styles={{
              root: { width: '220px' },
              textField: {
                width: '100%',
                height: '32px',
                selectors: {
                  '.ms-TextField-field': { height: '32px' },
                },
              },
              callout: {
                minWidth: calendarMinWidth
              }
            }}
          />
        </div>
        
        {/* Информация о периоде и статистика */}
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>Selected month: {state.selectedDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</div>
          <div>{statistics.totalWeeks} weeks | {statistics.weeksWithData} with data</div>
          <div>Expanded: {statistics.expandedCount} weeks</div>
        </div>
        
        {/* Кнопка обновления данных */}
        <div>
          <button
            onClick={() => {
              console.log('[TimetableTab] Manual refresh requested - will make new server requests for all staff');
              refreshTimetableData().catch(error => {
                console.error('[TimetableTab] Manual refresh failed:', error);
              });
            }}
            disabled={state.isLoadingStaffRecords}
            style={{
              padding: '6px 12px',
              backgroundColor: state.isLoadingStaffRecords ? '#f3f2f1' : '#0078d4',
              color: state.isLoadingStaffRecords ? '#a19f9d' : 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: state.isLoadingStaffRecords ? 'not-allowed' : 'pointer',
              fontSize: '12px'
            }}
          >
            {state.isLoadingStaffRecords ? 'Loading...' : 'Refresh Data'}
          </button>
        </div>
        
        {state.isLoadingStaffRecords && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size={1} />
            <span style={{ fontSize: '12px', color: '#666' }}>Loading individual staff records...</span>
          </div>
        )}
      </div>

      {/* Сообщение об ошибке */}
      {state.errorStaffRecords && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar messageBarType={MessageBarType.error}>
            {state.errorStaffRecords}
          </MessageBar>
        </div>
      )}

      {/* Управление разворачиванием */}
      {state.weeksData.length > 0 && (
        <TimetableExpandControls
          totalWeeks={statistics.totalWeeks}
          expandedCount={statistics.expandedCount}
          onExpandAll={expandAllWeeks}
          onCollapseAll={collapseAllWeeks}
        />
      )}

      {/* Основное содержимое */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {state.isLoadingStaffRecords ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spinner size={2} />
            <p style={{ marginTop: '16px' }}>Loading staff timetable...</p>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Making individual server requests for {staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0').length} active staff members
            </p>
            <p style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
              Each request filters by: StaffMember = employeeId, Manager = {currentUserId}, StaffGroup = {managingGroupId}
            </p>
          </div>
        ) : state.weeksData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No data available for the selected period.</p>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Group: {managingGroupId} | User: {currentUserId} | Weeks calculated: {weeks.length} | Staff: {statistics.staffCount}
            </p>
            
            {/* Отладочная информация для серверной фильтрации */}
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: '#f8f9fa', 
              borderRadius: '4px',
              textAlign: 'left',
              fontSize: '11px',
              color: '#666'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>Server-Side Filtering Debug Information:</div>
              <div>• Total Staff Records Loaded: {state.staffRecords.length}</div>
              <div>• Weeks Calculated: {weeks.length}</div>
              <div>• Total Staff Members: {staffMembers.length}</div>
              <div>• Active Staff Members: {staffMembers.filter(s => s.deleted !== 1).length}</div>
              <div>• Active Staff with Employee ID: {staffMembers.filter(s => s.deleted !== 1 && s.employeeId && s.employeeId !== '0').length}</div>
              <div>• Managing Group ID (StaffGroup filter): {managingGroupId || 'Not set'}</div>
              <div>• Current User ID (Manager filter): {currentUserId || 'Not set'}</div>
              <div>• Context Available: {context ? 'Yes' : 'No'}</div>
              <div>• Staff Records Service: {staffRecordsService ? 'Available' : 'Not available'}</div>
              <div style={{ marginTop: '8px', fontStyle: 'italic' }}>
                Each staff member gets individual request with: StaffMember = employeeId, Manager = currentUserId, StaffGroup = managingGroupId
              </div>
            </div>
            
            {weeks.length > 0 && statistics.staffCount >= 0 && (
              <button 
                onClick={() => {
                  console.log('[TimetableTab] Manual refresh requested from no-data state');
                  refreshTimetableData().catch(error => {
                    console.error('[TimetableTab] Manual refresh failed:', error);
                  });
                }}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: '#0078d4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Refresh Data (Make Server Requests)
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Информация о данных */}
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '20px',
              padding: '8px 12px',
              backgroundColor: '#f0f6ff',
              borderRadius: '4px',
              border: '1px solid #deecf9'
            }}>
              Showing {statistics.totalWeeks} weeks for {statistics.staffCount} staff members | 
              {statistics.weeksWithData} weeks have data | 
              Total records: {statistics.recordsCount} | 
              Week starts on: {TimetableWeekCalculator.getDayName(dayOfStartWeek || 7)} | 
              <span style={{ fontStyle: 'italic' }}>Data server-filtered by exact ID matches</span>
            </div>
            
            {/* Группы недель */}
            {state.weeksData.map(weekGroup => (
              <TimetableWeekGroup
                key={weekGroup.weekInfo.weekNum}
                weekGroup={weekGroup}
                dayOfStartWeek={dayOfStartWeek || 7}
                onToggleExpand={toggleWeekExpand}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};