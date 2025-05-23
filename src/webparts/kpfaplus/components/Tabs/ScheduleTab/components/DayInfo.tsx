// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/DayInfo.tsx
import * as React from 'react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService'; // <-- Убедитесь, что путь правильный
import { IHoliday } from '../../../../services/HolidaysService'; // <-- Убедитесь, что путь правильный
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService'; // <-- Убедитесь, что путь правильный
import { getLeaveTypeInfo, getLeaveTypeText } from '../ScheduleTabApi'; // <-- Убедитесь, что путь правильный

// Интерфейсы для сервисов, чтобы избежать использования any
// Если эти интерфейсы нужны только здесь, они могут оставаться локальными.
// Если они используются в других местах, их нужно вынести в общий файл.
interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

// --- ИСПРАВЛЕНИЕ: Удален typeOfLeaveService из IDayInfoProps ---
export interface IDayInfoProps {
  selectedDate: Date;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  typesOfLeave: ITypeOfLeave[]; // Массив типов отпусков, который уже содержит нужную информацию
  holidaysService?: IHolidaysService;
  daysOfLeavesService?: IDaysOfLeavesService;
  // typeOfLeaveService?: ITypeOfLeaveService; // <-- УДАЛЕНО
}

export const DayInfo: React.FC<IDayInfoProps> = ({
  selectedDate,
  holidays,
  leaves,
  typesOfLeave, // Используем этот массив
  holidaysService,
  daysOfLeavesService
  // typeOfLeaveService // <-- Удален из деструктуризации
}) => {
  const isHoliday = holidaysService && holidays.length > 0 &&
    holidaysService.isHoliday(selectedDate, holidays);

  const holidayInfo = isHoliday && holidaysService ?
    holidaysService.getHolidayInfo(selectedDate, holidays) : undefined;

  const isOnLeave = daysOfLeavesService && leaves.length > 0 &&
    daysOfLeavesService.isDateOnLeave(selectedDate, leaves);

  const leaveInfo = isOnLeave && daysOfLeavesService ?
    daysOfLeavesService.getLeaveForDate(selectedDate, leaves) : undefined;

  // getLeaveTypeInfo использует массив typesOfLeave, а не сервис
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