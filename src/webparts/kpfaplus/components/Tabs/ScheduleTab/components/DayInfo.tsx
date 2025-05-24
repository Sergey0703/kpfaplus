// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/DayInfo.tsx
import * as React from 'react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IHoliday } from '../../../../services/HolidaysService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { getLeaveTypeInfo, getLeaveTypeText } from '../ScheduleTabApi';

interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

export interface IDayInfoProps {
  selectedDate: Date;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  typesOfLeave: ITypeOfLeave[];
  holidaysService?: IHolidaysService;
  daysOfLeavesService?: IDaysOfLeavesService;
}

export const DayInfo: React.FC<IDayInfoProps> = ({
  selectedDate,
  holidays,
  leaves,
  typesOfLeave,
  holidaysService,
  daysOfLeavesService
}) => {
  // Получаем текущий месяц и год из выбранной даты
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();
  
  // Находим все праздники в текущем месяце
  const monthlyHolidays = holidays.filter(holiday => {
    const holidayDate = new Date(holiday.date);
    return holidayDate.getMonth() === currentMonth && 
           holidayDate.getFullYear() === currentYear;
  });

  // Сортируем праздники по дате
  const sortedHolidays = monthlyHolidays.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  // Получаем все отпуска за месяц
  const monthStart = new Date(currentYear, currentMonth, 1);
  const monthEnd = new Date(currentYear, currentMonth + 1, 0);
  
  const monthlyLeaves = leaves.filter(leave => {
    const leaveStart = new Date(leave.startDate);
    const leaveEnd = leave.endDate ? new Date(leave.endDate) : null;
    
    // Отпуск попадает в месяц если:
    // 1. Начинается в этом месяце ИЛИ
    // 2. Заканчивается в этом месяце ИЛИ  
    // 3. Охватывает весь месяц ИЛИ
    // 4. Начался в этом месяце и еще не закончился (нет даты окончания)
    const startsInMonth = leaveStart >= monthStart && leaveStart <= monthEnd;
    const endsInMonth = leaveEnd && leaveEnd >= monthStart && leaveEnd <= monthEnd;
    const spansMonth = leaveEnd && leaveStart <= monthStart && leaveEnd >= monthEnd;
    const startsAndOngoing = startsInMonth && !leaveEnd;
    
    return startsInMonth || endsInMonth || spansMonth || startsAndOngoing;
  });

  // Сортируем отпуска по дате начала (по возрастанию)
  const sortedLeaves = monthlyLeaves.sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  // Отладочное логирование
  console.log('[DayInfo] Selected date:', selectedDate.toISOString());
  console.log('[DayInfo] All holidays received:', holidays.length, holidays);
  console.log('[DayInfo] Monthly holidays found:', sortedHolidays.length, sortedHolidays);
  console.log('[DayInfo] All leaves received:', leaves.length);
  console.log('[DayInfo] Monthly leaves found:', sortedLeaves.length);

  return (
    <div style={{ marginBottom: '15px' }}>
      {/* Показываем все праздники месяца */}
      {sortedHolidays.length > 0 && (
        <div style={{
          backgroundColor: '#FFF4CE',
          padding: '12px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #FFB900'
        }}>
          <strong>Holidays in {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ({sortedHolidays.length} total):</strong>
          
          <div style={{ marginTop: '8px' }}>
            {sortedHolidays.map((holiday, index) => (
              <div key={holiday.id || index} style={{ 
                fontSize: '12px', 
                color: '#605E5C',
                marginBottom: '4px',
                paddingLeft: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    <strong style={{ color: '#323130' }}>
                      {new Date(holiday.date).toLocaleDateString()}:
                    </strong>{' '}
                    {holiday.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Показываем все отпуска месяца */}
      {sortedLeaves.length > 0 && (
        <div style={{
          backgroundColor: '#F3F2F1',
          padding: '12px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #8A8886'
        }}>
          <strong>Leave days in {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ({sortedLeaves.length} total):</strong>
          
          <div style={{ marginTop: '8px' }}>
            {sortedLeaves.map((leave, index) => {
              const typeInfo = getLeaveTypeInfo(leave.typeOfLeave, typesOfLeave);
              const typeText = typeInfo?.title || getLeaveTypeText(leave.typeOfLeave) || `Type ${leave.typeOfLeave}`;
              
              return (
                <div key={leave.id || index} style={{ 
                  fontSize: '12px', 
                  color: '#605E5C',
                  marginBottom: '4px',
                  paddingLeft: '8px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      <strong style={{ color: typeInfo?.color || '#323130' }}>{typeText}:</strong>{' '}
                      {new Date(leave.startDate).toLocaleDateString()} - {' '}
                      {leave.endDate ? 
                        new Date(leave.endDate).toLocaleDateString() : 
                        <span style={{ color: '#d13438', fontStyle: 'italic' }}>ongoing</span>
                      }
                    </span>
                    {leave.title && (
                      <span style={{ fontStyle: 'italic', marginLeft: '8px', color: '#8A8886' }}>
                        {`"${leave.title}"`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Сообщение, если нет отпусков */}
      {sortedLeaves.length === 0 && (
        <div style={{
          backgroundColor: '#F8F9FA',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #DADCE0',
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          No leave days found for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </div>
      )}

      {/* Сообщение, если нет праздников */}
      {sortedHolidays.length === 0 && (
        <div style={{
          backgroundColor: '#F8F9FA',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #DADCE0',
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          No holidays found for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
        </div>
      )}

      {/* Дополнительное сообщение, если вообще нет данных */}
      {holidays.length === 0 && leaves.length === 0 && (
        <div style={{
          backgroundColor: '#F8F9FA',
          padding: '10px',
          marginBottom: '10px',
          borderRadius: '4px',
          borderLeft: '4px solid #DADCE0',
          fontSize: '12px',
          color: '#666',
          fontStyle: 'italic'
        }}>
          No holidays or leave days data available.
        </div>
      )}
    </div>
  );
};