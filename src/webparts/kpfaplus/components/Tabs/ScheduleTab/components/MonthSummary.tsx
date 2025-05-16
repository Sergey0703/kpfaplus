// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/MonthSummary.tsx
import * as React from 'react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IHoliday } from '../../../../services/HolidaysService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { getLeaveTypeInfo } from '../ScheduleTabApi';

export interface IMonthSummaryProps {
  selectedDate: Date;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  typesOfLeave: ITypeOfLeave[];
}

export const MonthSummary: React.FC<IMonthSummaryProps> = ({ 
  selectedDate, 
  holidays, 
  leaves, 
  typesOfLeave 
}) => {
  // Группировка отпусков по типам для отображения статистики
  const leavesByType = leaves.reduce((acc, leave) => {
    const typeId = leave.typeOfLeave.toString();
    if (!acc[typeId]) {
      acc[typeId] = [];
    }
    acc[typeId].push(leave);
    return acc;
  }, {} as { [key: string]: ILeaveDay[] });
  
  return (
    <div style={{ padding: '10px' }}>
      <div>
        <p>Selected date: {selectedDate.toLocaleDateString()}</p>
        <p>Month: {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}</p>
        
        <div style={{ marginTop: '10px' }}>
          <div>
            <strong>Holidays: </strong>
            {holidays.length > 0 ? holidays.length : 'No'} holidays loaded for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
          </div>
          
          <div>
            <strong>Leaves: </strong>
            {leaves.length > 0 ? leaves.length : 'No'} leaves found for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
            {leaves.length > 0 && leaves.some(l => !l.endDate) && 
              ` (Открытых: ${leaves.filter(l => !l.endDate).length})`}
          </div>
          
          {/* Отображаем статистику по типам отпусков, если они есть */}
          {Object.keys(leavesByType).length > 0 && (
            <div style={{ marginTop: '5px' }}>
              <strong>Типы отпусков:</strong>
              <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                {Object.keys(leavesByType).map(typeId => {
                  const typeInfo = getLeaveTypeInfo(parseInt(typeId), typesOfLeave);
                  const count = leavesByType[typeId].length;
                  return (
                    <li key={typeId} style={{ marginBottom: '2px' }}>
                      <span style={typeInfo.color ? { color: typeInfo.color } : undefined}>
                        {typeInfo.title}: {count} {count === 1 ? 'отпуск' : count < 5 ? 'отпуска' : 'отпусков'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};