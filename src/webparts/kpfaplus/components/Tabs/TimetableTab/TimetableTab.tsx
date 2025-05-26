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

// Временные интерфейсы (потом заменим на импорты)
interface IWeekInfo {
  weekNum: number;
  weekStart: Date;
  weekEnd: Date;
  weekLabel: string;
}

enum TimetableDisplayMode {
  ByWeeks = 'weeks',
  ByDays = 'days'
}

// Интерфейс для строки таблицы
interface ITimetableRow {
  staffId: string;
  staffName: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
  weeks: { [weekNumber: number]: IWeekData };
}

// Интерфейс для данных недели
interface IWeekData {
  weekNum: number;
  totalHours: string;
  workDays: number;
  details: string;
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
  const [displayMode, setDisplayMode] = useState<TimetableDisplayMode>(TimetableDisplayMode.ByWeeks);
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

  const handleDisplayModeChange = (mode: TimetableDisplayMode): void => {
    console.log('[TimetableTab] Display mode changed to:', mode);
    setDisplayMode(mode);
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

  // Создаем данные для таблицы
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

    return filteredStaff.map(staff => {
      // Определяем шаблон как сотрудника без employeeId или с пустым employeeId
      const isTemplate = !staff.employeeId || staff.employeeId === '0' || staff.employeeId === '';
      
      const row: ITimetableRow = {
        staffId: staff.id,
        staffName: staff.name,
        isDeleted: staff.deleted === 1,
        hasPersonInfo: !isTemplate,
        weeks: {}
      };

      // Создаем данные для каждой недели (пока моковые данные)
      weeks.forEach(week => {
        // Генерируем случайные данные для демонстрации
        const workDays = Math.floor(Math.random() * 5) + 1; // 1-5 рабочих дней
        const totalHours = (workDays * 8).toString(); // 8 часов в день
        
        row.weeks[week.weekNum] = {
          weekNum: week.weekNum,
          totalHours: `${totalHours}h 00m`,
          workDays,
          details: `${workDays} days`
        };
      });

      return row;
    });
  }, [staffMembers, weeks, showDeleted, showTemplates]);

  // Создаем колонки для таблицы
  const columns = useMemo((): IColumn[] => {
    const cols: IColumn[] = [
      // Колонка с именами сотрудников
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

    if (displayMode === TimetableDisplayMode.ByWeeks) {
      // Режим по неделям - добавляем колонки для каждой недели
      weeks.forEach(week => {
        cols.push({
          key: `week_${week.weekNum}`,
          name: `Week ${week.weekNum}`,
          minWidth: 120,
          maxWidth: 140,
          isResizable: true,
          onRenderHeader: (): JSX.Element => (
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                fontWeight: 'bold', 
                fontSize: '13px',
                marginBottom: '2px'
              }}>
                Week {week.weekNum}
              </div>
              <div style={{ 
                fontSize: '10px', 
                color: '#666',
                lineHeight: '1.2'
              }}>
                {week.weekStart.toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit' 
                })} - {week.weekEnd.toLocaleDateString('en-GB', { 
                  day: '2-digit', 
                  month: '2-digit' 
                })}
              </div>
            </div>
          ),
          onRender: (item: ITimetableRow): JSX.Element => {
            const weekData = item.weeks[week.weekNum];
            
            if (!weekData || weekData.workDays === 0) {
              return <div style={{ color: '#a19f9d', textAlign: 'center', padding: '4px' }}>-</div>;
            }
            
            return (
              <div style={{ 
                fontSize: '12px', 
                padding: '4px',
                lineHeight: '1.3',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#0078d4', 
                  marginBottom: '2px' 
                }}>
                  {weekData.totalHours}
                </div>
                <div style={{ 
                  color: '#666', 
                  fontSize: '11px' 
                }}>
                  {weekData.details}
                </div>
              </div>
            );
          }
        });
      });
    } else {
      // Режим по дням - показываем дни первой недели
      const firstWeek = weeks[0];
      if (firstWeek) {
        const orderedDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        
        orderedDays.forEach((dayName, index) => {
          cols.push({
            key: `day_${index}`,
            name: dayName,
            minWidth: 140,
            maxWidth: 180,
            isResizable: true,
            onRenderHeader: (): JSX.Element => {
              const dayDate = new Date(firstWeek.weekStart);
              dayDate.setDate(firstWeek.weekStart.getDate() + index);
              
              return (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontWeight: 'bold', 
                    fontSize: '13px',
                    marginBottom: '2px'
                  }}>
                    {dayName}
                  </div>
                  <div style={{ 
                    fontSize: '11px', 
                    color: '#666' 
                  }}>
                    {dayDate.toLocaleDateString('en-GB', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    })}
                  </div>
                </div>
              );
            },
            onRender: (item: ITimetableRow): JSX.Element => {
              // Временные данные для дней
              const hasData = Math.random() > 0.3; // 70% вероятность наличия данных
              
              if (!hasData) {
                return <div style={{ color: '#a19f9d', textAlign: 'center', padding: '4px' }}>-</div>;
              }
              
              return (
                <div style={{ 
                  fontSize: '11px', 
                  padding: '4px',
                  lineHeight: '1.2'
                }}>
                  <div style={{ color: '#323130' }}>
                    09:00 - 17:00 (8h 00m)
                  </div>
                </div>
              );
            }
          });
        });
      }
    }

    return cols;
  }, [weeks, displayMode]); // Убрали timetableData из зависимостей

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

      {/* Переключатель режима отображения */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        alignItems: 'center',
        marginBottom: '15px'
      }}>
        <span style={{ 
          fontSize: '14px', 
          fontWeight: '600',
          marginRight: '10px'
        }}>
          View mode:
        </span>
        
        <button
          onClick={() => handleDisplayModeChange(TimetableDisplayMode.ByWeeks)}
          style={{
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: displayMode === TimetableDisplayMode.ByWeeks ? '#0078d4' : '#ffffff',
            color: displayMode === TimetableDisplayMode.ByWeeks ? '#ffffff' : '#323130',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          By Weeks ({weeks.length})
        </button>
        
        <button
          onClick={() => handleDisplayModeChange(TimetableDisplayMode.ByDays)}
          style={{
            padding: '6px 12px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: displayMode === TimetableDisplayMode.ByDays ? '#0078d4' : '#ffffff',
            color: displayMode === TimetableDisplayMode.ByDays ? '#ffffff' : '#323130',
            cursor: 'pointer',
            fontSize: '13px'
          }}
        >
          By Days (Week 1)
        </button>
      </div>

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
              Mode: {displayMode} | Group: {managingGroupId} | Weeks: {weeks.length}
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
                Showing {timetableData.length} staff members | 
                Mode: {displayMode === TimetableDisplayMode.ByWeeks ? 'Weekly view' : 'Daily view'} |
                Records: {staffRecords.length}
              </span>
              <span>
                Week starts on day: {dayOfStartWeek} | Weeks: {weeks.length}
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