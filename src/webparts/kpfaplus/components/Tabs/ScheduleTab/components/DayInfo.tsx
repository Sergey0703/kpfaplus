// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/DayInfo.tsx
import * as React from 'react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IHoliday } from '../../../../services/HolidaysService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { getLeaveTypeInfo, getLeaveTypeText } from '../ScheduleTabApi';

// Интерфейсы для сервисов, чтобы избежать использования any
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
  
  // Получаем информацию о типе отпуска, если есть отпуск
  const leaveTypeInfo = leaveInfo ? 
    getLeaveTypeInfo(leaveInfo.typeOfLeave, typesOfLeave) : undefined;
  
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
          borderLeft: leaveTypeInfo?.color ? `4px solid ${leaveTypeInfo.color}` : '4px solid #0078D4'
        }}>
          <strong>Leave: </strong>
          {leaveInfo.title}
          {/* Отображаем дополнительную информацию для отпуска */}
          <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
            <div>
              <strong>Type: </strong>
              <span style={leaveTypeInfo?.color ? { color: leaveTypeInfo.color } : undefined}>
                {leaveTypeInfo?.title || getLeaveTypeText(leaveInfo.typeOfLeave)}
              </span>
            </div>
            <div>
              <strong>Period:</strong>
              {leaveInfo.startDate.toLocaleDateString()} - 
              {leaveInfo.endDate ? leaveInfo.endDate.toLocaleDateString() : <span style={{ color: '#d13438', fontStyle: 'italic' }}>open</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};