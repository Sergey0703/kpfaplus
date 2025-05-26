// src/webparts/kpfaplus/components/Tabs/TimetableTab/TimetableTab.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  DatePicker, 
  DayOfWeek, 
  MessageBar,
  MessageBarType,
  Spinner,
  Toggle,
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';
import { StaffRecordsService } from '../../../services/StaffRecordsService';

// Константы
const calendarMinWidth = '655px';

export interface ITimetableTabProps extends ITabProps {
  // Дополнительные пропсы для таблицы времени, если понадобятся
}

// Интерфейс для недели
interface IWeekInfo {
  weekNum: number;
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

// Интерфейс для строки таблицы (неделя + сотрудник)
interface ITimetableRow {
  id: string; // week_1_staff_123
  weekNum: number;
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
  staffId: string;
  staffName: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
  // Данные по дням недели (Monday=1, Tuesday=2, etc.)
  days: {
    monday?: IDayData;
    tuesday?: IDayData;
    wednesday?: IDayData;
    thursday?: IDayData;
    friday?: IDayData;
    saturday?: IDayData;
    sunday?: IDayData;
  };
}

// Интерфейс для данных дня
interface IDayData {
  shifts: string[]; // ["08:00 - 16:00 (8 hrs)", "18:00 - 22:00 (4 hrs)"]
  totalHours: string; // "12 hrs"
  hasData: boolean;
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

  console.log('[TimetableTab] Rendering with props:', {
    managingGroupId,
    currentUserId,
    dayOfStartWeek,
    staffMembersCount: staffMembers.length
  });

  // Состояния компонента
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [staffRecords, setStaffRecords] = useState<any[]>([]);
  const [enterLunchTime, setEnterLunchTime] = useState<boolean>(true);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [showTemplates, setShowTemplates] = useState<boolean>(true);

  // Инициализируем сервис StaffRecords
  const staffRecordsService = useMemo(() => {
    if (context) {
      console.log('[TimetableTab] Initializing StaffRecordsService');
      return StaffRecordsService.getInstance(context);
    }
    return undefined;
  }, [context]);

  // Простая функция расчета недель (временная реализация)
  const calculateSimpleWeeks = (selectedDate: Date): IWeekInfo[] => {
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    // Простой расчет - 4-5 недель в месяце
    const weeks: IWeekInfo[] = [];
    let currentWeekStart = new Date(monthStart);
    
    // Найдем начало первой недели (понедельник)
    while (currentWeekStart.getDay() !== 1) {
      currentWeekStart.setDate(currentWeekStart.getDate() - 1);
    }
    
    let weekNum = 1;
    while (currentWeekStart <= monthEnd) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);
      
      weeks.push({
        weekNum,
        weekStart: new Date(currentWeekStart),
        weekEnd: new Date(weekEnd),
        weekLabel: `Week ${weekNum}: ${formatDate(currentWeekStart)} - ${formatDate(weekEnd)}`
      });
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      weekNum++;
    }
    
    return weeks;
  };

  // Рассчитываем недели для выбранного месяца
  const weeks: IWeekInfo[] = useMemo(() => {
    return calculateSimpleWeeks(selectedMonth);
  }, [selectedMonth]);

  // Получаем диапазон дат для загрузки данных
  const dataDateRange = useMemo(() => {
    if (weeks.length === 0) {
      const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
      const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
      return { startDate: monthStart, endDate: monthEnd };
    }
    
    return {
      startDate: weeks[0].weekStart,
      endDate: weeks[weeks.length - 1].weekEnd
    };
  }, [weeks, selectedMonth]);

  // Загрузка данных StaffRecords
  const loadStaffRecords = async (): Promise<void> => {
    if (!staffRecordsService || !managingGroupId || !currentUserId) {
      console.log('[TimetableTab] Cannot load staff records: service, group ID, or user ID missing');
      return;
    }

    setIsLoading(true);
    setError(undefined);
    
    try {
      console.log('[TimetableTab] Loading staff records for date range:', {
        startDate: formatDate(dataDateRange.startDate),
        endDate: formatDate(dataDateRange.endDate),
        groupId: managingGroupId,
        userId: currentUserId
      });
      
      // Вызываем сервис для получения записей за расширенный период (все недели месяца)
      const records = await staffRecordsService.getStaffRecords(
        dataDateRange.startDate,
        dataDateRange.endDate,
        currentUserId,
        managingGroupId,
        0 // Получаем записи для всех сотрудников группы
      );
      
      setStaffRecords(records);
      console.log('[TimetableTab] Loaded', records.length, 'staff records');
      
    } catch (err) {
      console.error('[TimetableTab] Error loading staff records:', err);
      setError(`Error loading data: ${err}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Загружаем данные при изменении ключевых параметров
  useEffect(() => {
    if (managingGroupId && weeks.length > 0) {
      loadStaffRecords().catch(error => {
        console.error('[TimetableTab] Error in loadStaffRecords useEffect:', error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, managingGroupId, weeks.length]);

  // Обработчики событий
  const handleMonthChange = (date: Date | null | undefined): void => {
    if (date) {
      console.log('[TimetableTab] Month changed to:', formatDate(date));
      setSelectedMonth(date);
    }
  };

  const handleEnterLunchTimeChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      console.log('[TimetableTab] Enter lunch time changed to:', checked);
      setEnterLunchTime(checked);
    }
  };

  const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      console.log('[TimetableTab] Show deleted changed to:', checked);
      setShowDeleted(checked);
    }
  };

  const handleShowTemplatesChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      console.log('[TimetableTab] Show templates changed to:', checked);
      setShowTemplates(checked);
    }
  };

  // Создаем данные для таблицы - по неделям и сотрудникам
  const timetableData = useMemo((): ITimetableRow[] => {
    console.log('[TimetableTab] Creating timetable data');
    
    // Фильтруем сотрудников по настройкам
    const filteredStaff = staffMembers.filter(staff => {
      if (!showDeleted && staff.deleted === 1) return false;
      // Определяем шаблон как сотрудника без employeeId или с пустым employeeId
      const isTemplate = !staff.employeeId || staff.employeeId === '0' || staff.employeeId === '';
      if (!showTemplates && isTemplate) return false;
      return true;
    });

    const rows: ITimetableRow[] = [];

    // Для каждой недели создаем строки для всех сотрудников
    weeks.forEach(week => {
      filteredStaff.forEach(staff => {
        // Определяем шаблон как сотрудника без employeeId или с пустым employeeId
        const isTemplate = !staff.employeeId || staff.employeeId === '0' || staff.employeeId === '';
        
        // Генерируем моковые данные для демонстрации
        const generateMockDayData = (): IDayData => {
          const hasData = Math.random() > 0.4; // 60% вероятность наличия данных
          if (!hasData) {
            return { shifts: [], totalHours: '', hasData: false };
          }
          
          const shifts = ['08:00 - 16:00 (8 hrs)'];
          // Иногда добавляем вторую смену
          if (Math.random() > 0.8) {
            shifts.push('18:00 - 22:00 (4 hrs)');
          }
          
          return {
            shifts,
            totalHours: shifts.length === 1 ? '8 hrs' : '12 hrs',
            hasData: true
          };
        };

        const row: ITimetableRow = {
          id: `week_${week.weekNum}_staff_${staff.id}`,
          weekNum: week.weekNum,
          weekStart: week.weekStart,
          weekEnd: week.weekEnd,
          weekLabel: week.weekLabel,
          staffId: staff.id,
          staffName: staff.name,
          isDeleted: staff.deleted === 1,
          hasPersonInfo: !isTemplate,
          days: {
            monday: generateMockDayData(),
            tuesday: generateMockDayData(),
            wednesday: generateMockDayData(),
            thursday: generateMockDayData(),
            friday: generateMockDayData(),
            saturday: generateMockDayData(),
            sunday: generateMockDayData()
          }
        };

        rows.push(row);
      });
    });

    return rows;
  }, [staffMembers, weeks, showDeleted, showTemplates]);

  // Создаем колонки для таблицы
  const columns = useMemo((): IColumn[] => {
    const cols: IColumn[] = [
      // Колонка с именами сотрудников и неделей
      {
        key: 'staffMember',
        name: 'Staff Member',
        fieldName: 'staffName',
        minWidth: 200,
        maxWidth: 250,
        isResizable: true,
        onRender: (item: ITimetableRow): JSX.Element => (
          <div style={{ 
            padding: '8px',
            color: item.isDeleted ? '#a19f9d' : '#323130',
            fontStyle: item.isDeleted ? 'italic' : 'normal'
          }}>
            {/* Заголовок недели - показываем только для первого сотрудника в неделе */}
            {item.staffId === staffMembers[0]?.id && (
              <div style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#0078d4',
                marginBottom: '8px',
                borderBottom: '1px solid #e1e5e9',
                paddingBottom: '4px'
              }}>
                Week {item.weekNum}: {item.weekStart.toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit' 
                })} - {item.weekEnd.toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit' 
                })}
              </div>
            )}
            
            {/* Информация о сотруднике */}
            <div style={{ 
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '2px'
            }}>
              {item.staffName}
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: '#666',
              lineHeight: '1.2'
            }}>
              {item.isDeleted && (
                <span style={{ 
                  color: '#d83b01',
                  marginRight: '4px'
                }}>
                  (Deleted)
                </span>
              )}
              {!item.hasPersonInfo && (
                <span style={{ 
                  color: '#8a8886',
                  marginRight: '4px'
                }}>
                  (Template)
                </span>
              )}
              <div>ID: {item.staffId}</div>
            </div>
          </div>
        )
      }
    ];

    // Добавляем колонки для дней недели
    const daysOfWeek = [
      { key: 'monday', name: 'Monday' },
      { key: 'tuesday', name: 'Tuesday' },
      { key: 'wednesday', name: 'Wednesday' },
      { key: 'thursday', name: 'Thursday' },
      { key: 'friday', name: 'Friday' },
      { key: 'saturday', name: 'Saturday' },
      { key: 'sunday', name: 'Sunday' }
    ];

    daysOfWeek.forEach(day => {
      cols.push({
        key: day.key,
        name: day.name,
        minWidth: 140,
        maxWidth: 180,
        isResizable: true,
        onRenderHeader: (): JSX.Element => (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontWeight: 'bold', 
              fontSize: '13px'
            }}>
              {day.name}
            </div>
          </div>
        ),
        onRender: (item: ITimetableRow): JSX.Element => {
          const dayData = item.days[day.key as keyof typeof item.days];
          
          if (!dayData || !dayData.hasData) {
            return <div style={{ color: '#a19f9d', textAlign: 'center', padding: '4px' }}>-</div>;
          }
          
          return (
            <div style={{ 
              fontSize: '11px', 
              padding: '4px',
              lineHeight: '1.3'
            }}>
              {dayData.shifts.map((shift, index) => (
                <div key={index} style={{ 
                  color: '#323130',
                  marginBottom: index < dayData.shifts.length - 1 ? '2px' : '0'
                }}>
                  {shift}
                </div>
              ))}
              {dayData.shifts.length > 1 && (
                <div style={{ 
                  color: '#0078d4', 
                  fontWeight: 'bold',
                  fontSize: '10px',
                  marginTop: '2px'
                }}>
                  Total: {dayData.totalHours}
                </div>
              )}
            </div>
          );
        }
      });
    });

    return cols;
  }, [staffMembers]); // Добавляем staffMembers в зависимости для заголовков недель

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Заголовок */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Staff Timetable
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {managingGroupId} | Current User ID: {currentUserId} | 
          Week starts on day: {dayOfStartWeek} | 
          Staff count: {staffMembers.length} | 
          Records: {staffRecords.length}
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
            value={selectedMonth}
            onSelectDate={handleMonthChange}
            firstDayOfWeek={DayOfWeek.Monday}
            strings={datePickerStringsEN}
            formatDate={formatDate}
            allowTextInput={false}
            disabled={isLoading}
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
        
        {/* Настройки отображения */}
        <div>
          <Toggle
            label="Enter lunch time"
            checked={enterLunchTime}
            onChange={handleEnterLunchTimeChange}
          />
        </div>

        <div>
          <Toggle
            label="Show deleted"
            checked={showDeleted}
            onChange={handleShowDeletedChange}
          />
        </div>

        <div>
          <Toggle
            label="Show templates"
            checked={showTemplates}
            onChange={handleShowTemplatesChange}
          />
        </div>
        
        {/* Информация о периоде */}
        <div style={{ fontSize: '12px', color: '#666' }}>
          <div>Data period:</div>
          <div>{formatDate(dataDateRange.startDate)} - {formatDate(dataDateRange.endDate)}</div>
          <div>{weeks.length} weeks</div>
        </div>
        
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Spinner size={1} />
            <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
          </div>
        )}
      </div>

      {/* Сообщение об ошибке */}
      {error && (
        <div style={{ marginBottom: '15px' }}>
          <MessageBar messageBarType={MessageBarType.error}>
            {error}
          </MessageBar>
        </div>
      )}

      {/* Таблица расписания */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spinner size={2} />
            <p style={{ marginTop: '16px' }}>Loading staff timetable...</p>
          </div>
        ) : timetableData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>No staff members found for the current group.</p>
            <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
              Group: {managingGroupId} | Weeks: {weeks.length} | Staff: {staffMembers.length}
            </p>
          </div>
        ) : (
          <>
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginBottom: '10px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>
                Showing {timetableData.length} rows ({Math.floor(timetableData.length / weeks.length)} staff × {weeks.length} weeks) | 
                Records: {staffRecords.length}
              </span>
              <span>
                Week starts on day: {dayOfStartWeek}
              </span>
            </div>
            
            <DetailsList
              items={timetableData}
              columns={columns}
              layoutMode={DetailsListLayoutMode.justified}
              selectionMode={SelectionMode.none}
              isHeaderVisible={true}
              compact={false}
              styles={{
                root: {
                  '.ms-DetailsHeader': {
                    backgroundColor: '#f3f2f1'
                  },
                  '.ms-DetailsList-contentWrapper': {
                    overflow: 'visible'
                  }
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};