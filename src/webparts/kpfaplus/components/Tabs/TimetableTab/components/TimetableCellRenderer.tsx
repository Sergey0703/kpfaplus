// src/webparts/kpfaplus/components/Tabs/TimetableTab/components/TimetableCellRenderer.tsx
import * as React from 'react';
import { 
  ITimetableCellProps, 
  IWeeklyStaffData, 
  IDayInfo 
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from '../utils/TimetableWeekCalculator';

/**
 * Компонент для рендеринга ячеек таблицы расписания
 */
export const TimetableCellRenderer: React.FC<ITimetableCellProps> = (props) => {
  const { staffData, dayNumber, isWeekMode } = props;

  // Если это режим недель, показываем сводку по неделе
  if (isWeekMode) {
    return <WeekSummaryCell staffData={staffData} />;
  }

  // Если это режим дней, показываем конкретный день
  if (dayNumber && staffData.days[dayNumber]) {
    return <DaySummaryCell dayData={staffData.days[dayNumber]} />;
  }

  // Пустая ячейка
  return <EmptyCell />;
};

/**
 * Ячейка с сводкой по неделе
 */
const WeekSummaryCell: React.FC<{ staffData: IWeeklyStaffData }> = ({ staffData }) => {
  const { totalWeekMinutes, formattedWeekTotal, days } = staffData;

  // Подсчитываем количество рабочих дней
  const workingDays = Object.values(days).filter(day => day.hasData).length;
  
  // Подсчитываем общее количество смен
  const totalShifts = Object.values(days).reduce((sum, day) => sum + day.shifts.length, 0);

  if (totalWeekMinutes === 0) {
    return <EmptyCell />;
  }

  return (
    <div style={{ 
      fontSize: '12px', 
      padding: '4px',
      lineHeight: '1.3'
    }}>
      <div style={{ 
        fontWeight: 'bold', 
        color: '#0078d4', 
        marginBottom: '2px' 
      }}>
        {formattedWeekTotal}
      </div>
      <div style={{ 
        color: '#666', 
        fontSize: '11px' 
      }}>
        {workingDays} day{workingDays !== 1 ? 's' : ''}
      </div>
      {totalShifts > workingDays && (
        <div style={{ 
          color: '#999', 
          fontSize: '10px' 
        }}>
          {totalShifts} shifts
        </div>
      )}
    </div>
  );
};

/**
 * Ячейка с информацией о дне
 */
const DaySummaryCell: React.FC<{ dayData: IDayInfo }> = ({ dayData }) => {
  const { shifts, formattedContent, hasData } = dayData;

  if (!hasData) {
    return <EmptyCell />;
  }

  // Если одна смена, показываем компактно
  if (shifts.length === 1) {
    const shift = shifts[0];
    return (
      <div style={{ 
        fontSize: '11px', 
        padding: '4px',
        lineHeight: '1.2'
      }}>
        <div style={{ color: '#323130' }}>
          {shift.formattedShift}
        </div>
      </div>
    );
  }

  // Если несколько смен, показываем с деталями
  return (
    <div style={{ 
      fontSize: '10px', 
      padding: '4px',
      lineHeight: '1.3',
      whiteSpace: 'pre-line'
    }}>
      <div style={{ color: '#323130' }}>
        {formattedContent}
      </div>
    </div>
  );
};

/**
 * Пустая ячейка
 */
const EmptyCell: React.FC = () => (
  <div style={{ 
    color: '#a19f9d', 
    fontSize: '12px', 
    textAlign: 'center',
    padding: '4px'
  }}>
    -
  </div>
);

/**
 * Компонент заголовка столбца для дня недели
 */
export const DayColumnHeader: React.FC<{ 
  dayNumber: number; 
  weekStart: Date; 
}> = ({ dayNumber, weekStart }) => {
  const dayName = TimetableWeekCalculator.getDayName(dayNumber);
  
  // Находим дату для этого дня недели
  const dayDate = new Date(weekStart);
  const startDayNumber = TimetableWeekCalculator.getDayNumber(weekStart);
  
  let offset = dayNumber - startDayNumber;
  if (offset < 0) {
    offset += 7;
  }
  
  dayDate.setDate(weekStart.getDate() + offset);

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
};

/**
 * Компонент заголовка столбца для недели
 */
export const WeekColumnHeader: React.FC<{ 
  weekNum: number; 
  weekStart: Date; 
  weekEnd: Date;
}> = ({ weekNum, weekStart, weekEnd }) => {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ 
        fontWeight: 'bold', 
        fontSize: '13px',
        marginBottom: '2px'
      }}>
        Week {weekNum}
      </div>
      <div style={{ 
        fontSize: '10px', 
        color: '#666',
        lineHeight: '1.2'
      }}>
        {weekStart.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit' 
        })} - {weekEnd.toLocaleDateString('en-GB', { 
          day: '2-digit', 
          month: '2-digit' 
        })}
      </div>
    </div>
  );
};

/**
 * Компонент ячейки с именем сотрудника
 */
export const StaffNameCell: React.FC<{
  staffName: string;
  staffId: string;
  isDeleted: boolean;
  hasPersonInfo: boolean;
}> = ({ staffName, staffId, isDeleted, hasPersonInfo }) => {
  return (
    <div style={{ 
      padding: '8px',
      color: isDeleted ? '#a19f9d' : '#323130',
      fontStyle: isDeleted ? 'italic' : 'normal'
    }}>
      <div style={{ 
        fontWeight: '500',
        fontSize: '14px',
        marginBottom: '2px'
      }}>
        {staffName}
      </div>
      <div style={{ 
        fontSize: '11px', 
        color: '#666',
        lineHeight: '1.2'
      }}>
        {isDeleted && (
          <span style={{ 
            color: '#d83b01',
            marginRight: '4px'
          }}>
            (Deleted)
          </span>
        )}
        {!hasPersonInfo && (
          <span style={{ 
            color: '#8a8886',
            marginRight: '4px'
          }}>
            (Template)
          </span>
        )}
        <div>ID: {staffId}</div>
      </div>
    </div>
  );
};