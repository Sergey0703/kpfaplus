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

/**
 * *** НОВАЯ ФУНКЦИЯ: Date-only форматирование для отображения ***
 */
const formatDateOnlyForDisplay = (date: Date): string => {
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return normalizedDate.toLocaleDateString();
};

/**
 * *** НОВАЯ ФУНКЦИЯ: Проверка попадания отпуска в месяц с Date-only совместимостью ***
 */
const isLeaveInMonth = (leave: ILeaveDay, targetMonth: number, targetYear: number): boolean => {
  // *** СОЗДАЕМ ГРАНИЦЫ МЕСЯЦА ***
  const monthStart = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
  const monthEnd = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
  
  // *** НОРМАЛИЗУЕМ ДАТЫ ОТПУСКА ДЛЯ DATE-ONLY СРАВНЕНИЯ ***
  const leaveStart = new Date(
    leave.startDate.getFullYear(),
    leave.startDate.getMonth(),
    leave.startDate.getDate(),
    0, 0, 0, 0
  );
  
  let leaveEnd: Date;
  if (leave.endDate) {
    leaveEnd = new Date(
      leave.endDate.getFullYear(),
      leave.endDate.getMonth(),
      leave.endDate.getDate(),
      23, 59, 59, 999
    );
  } else {
    // Для открытых отпусков используем текущую дату
    const today = new Date();
    leaveEnd = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23, 59, 59, 999
    );
  }
  
  // *** ПРОВЕРЯЕМ ПЕРЕСЕЧЕНИЕ С МЕСЯЦЕМ ***
  // Отпуск попадает в месяц если:
  // 1. Начинается в этом месяце ИЛИ
  // 2. Заканчивается в этом месяце ИЛИ
  // 3. Охватывает весь месяц
  const startsInMonth = leaveStart >= monthStart && leaveStart <= monthEnd;
  const endsInMonth = leaveEnd >= monthStart && leaveEnd <= monthEnd;
  const spansMonth = leaveStart <= monthStart && leaveEnd >= monthEnd;
  
  const isInMonth = startsInMonth || endsInMonth || spansMonth;
  
  if (isInMonth) {
    console.log(`[MonthSummary] *** DATE-ONLY LEAVE IN MONTH ***`);
    console.log(`[MonthSummary] Leave: "${leave.title}"`);
    console.log(`[MonthSummary] Period: ${formatDateOnlyForDisplay(leaveStart)} - ${leave.endDate ? formatDateOnlyForDisplay(leaveEnd) : 'ongoing'}`);
    console.log(`[MonthSummary] Target month: ${targetMonth + 1}/${targetYear}`);
    console.log(`[MonthSummary] Starts in month: ${startsInMonth}, Ends in month: ${endsInMonth}, Spans month: ${spansMonth}`);
  }
  
  return isInMonth;
};

/**
 * *** НОВАЯ ФУНКЦИЯ: Расчет рабочих дней отпуска в месяце с Date-only совместимостью ***
 */
const calculateLeaveDaysInMonth = (leave: ILeaveDay, targetMonth: number, targetYear: number): number => {
  if (!isLeaveInMonth(leave, targetMonth, targetYear)) {
    return 0;
  }
  
  // *** СОЗДАЕМ ГРАНИЦЫ МЕСЯЦА ***
  const monthStart = new Date(targetYear, targetMonth, 1);
  const monthEnd = new Date(targetYear, targetMonth + 1, 0);
  
  // *** НОРМАЛИЗУЕМ ДАТЫ ОТПУСКА ***
  const leaveStart = new Date(
    leave.startDate.getFullYear(),
    leave.startDate.getMonth(),
    leave.startDate.getDate()
  );
  
  let leaveEnd: Date;
  if (leave.endDate) {
    leaveEnd = new Date(
      leave.endDate.getFullYear(),
      leave.endDate.getMonth(),
      leave.endDate.getDate()
    );
  } else {
    // Для открытых отпусков считаем до конца месяца
    leaveEnd = new Date(monthEnd);
  }
  
  // *** ОПРЕДЕЛЯЕМ ПЕРЕСЕКАЮЩИЙСЯ ПЕРИОД ***
  const effectiveStart = leaveStart > monthStart ? leaveStart : monthStart;
  const effectiveEnd = leaveEnd < monthEnd ? leaveEnd : monthEnd;
  
  // *** РАСЧЕТ ДНЕЙ С DATE-ONLY ЛОГИКОЙ ***
  const timeDiffMs = effectiveEnd.getTime() - effectiveStart.getTime();
  const daysInMonth = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24)) + 1; // +1 включает оба дня
  
  console.log(`[MonthSummary] *** LEAVE DAYS CALCULATION (DATE-ONLY) ***`);
  console.log(`[MonthSummary] Leave: "${leave.title}"`);
  console.log(`[MonthSummary] Effective period in month: ${formatDateOnlyForDisplay(effectiveStart)} - ${formatDateOnlyForDisplay(effectiveEnd)}`);
  console.log(`[MonthSummary] Days in month: ${daysInMonth}`);
  
  return Math.max(0, daysInMonth);
};

export const MonthSummary: React.FC<IMonthSummaryProps> = ({ 
  selectedDate, 
  holidays, 
  leaves, 
  typesOfLeave 
}) => {
  console.log(`[MonthSummary] *** RENDERING WITH DATE-ONLY COMPATIBILITY ***`);
  console.log(`[MonthSummary] Selected date: ${selectedDate.toISOString()}`);
  console.log(`[MonthSummary] Month: ${selectedDate.getMonth() + 1}/${selectedDate.getFullYear()}`);
  console.log(`[MonthSummary] Processing ${leaves.length} leaves with Date-only fields`);
  
  const targetMonth = selectedDate.getMonth();
  const targetYear = selectedDate.getFullYear();
  
  // *** ОБНОВЛЕНО: Фильтруем отпуска для месяца с Date-only совместимостью ***
  const leavesInMonth = React.useMemo(() => {
    console.log(`[MonthSummary] *** FILTERING LEAVES FOR MONTH WITH DATE-ONLY LOGIC ***`);
    
    const filtered = leaves.filter(leave => {
      // Сначала проверяем, не удален ли отпуск
      if (leave.deleted === true) {
        console.log(`[MonthSummary] Skipping deleted leave: "${leave.title}"`);
        return false;
      }
      
      // Проверяем попадание в месяц с Date-only логикой
      return isLeaveInMonth(leave, targetMonth, targetYear);
    });
    
    console.log(`[MonthSummary] *** MONTH FILTERING RESULTS ***`);
    console.log(`[MonthSummary] Total leaves: ${leaves.length}`);
    console.log(`[MonthSummary] Active leaves: ${leaves.filter(l => !l.deleted).length}`);
    console.log(`[MonthSummary] Leaves in target month: ${filtered.length}`);
    
    return filtered;
  }, [leaves, targetMonth, targetYear]);
  
  // *** ОБНОВЛЕНО: Группировка отпусков по типам с Date-only расчетом дней ***
  const leavesByType = React.useMemo(() => {
    console.log(`[MonthSummary] *** GROUPING LEAVES BY TYPE WITH DATE-ONLY DAYS CALCULATION ***`);
    
    const grouped = leavesInMonth.reduce((acc, leave) => {
      const typeId = leave.typeOfLeave.toString();
      
      if (!acc[typeId]) {
        acc[typeId] = {
          leaves: [],
          totalDays: 0,
          typeInfo: getLeaveTypeInfo(leave.typeOfLeave, typesOfLeave)
        };
      }
      
      // *** РАССЧИТЫВАЕМ ДНИ ОТПУСКА В МЕСЯЦЕ С DATE-ONLY ЛОГИКОЙ ***
      const daysInMonth = calculateLeaveDaysInMonth(leave, targetMonth, targetYear);
      
      acc[typeId].leaves.push(leave);
      acc[typeId].totalDays += daysInMonth;
      
      console.log(`[MonthSummary] Added leave "${leave.title}" to type ${typeId}: ${daysInMonth} days`);
      
      return acc;
    }, {} as { [key: string]: { 
      leaves: ILeaveDay[]; 
      totalDays: number; 
      typeInfo: { title: string; color?: string } 
    }});
    
    console.log(`[MonthSummary] *** GROUPING COMPLETED ***`);
    Object.keys(grouped).forEach(typeId => {
      const group = grouped[typeId];
      console.log(`[MonthSummary] Type ${typeId} (${group.typeInfo.title}): ${group.leaves.length} leaves, ${group.totalDays} days total`);
    });
    
    return grouped;
  }, [leavesInMonth, targetMonth, targetYear, typesOfLeave]);
  
  // *** ОБНОВЛЕНО: Подсчет открытых отпусков с Date-only логикой ***
  const openLeavesCount = React.useMemo(() => {
    const openLeaves = leavesInMonth.filter(leave => !leave.endDate);
    console.log(`[MonthSummary] *** OPEN LEAVES COUNT (DATE-ONLY) ***`);
    console.log(`[MonthSummary] Found ${openLeaves.length} open leaves in month`);
    
    openLeaves.forEach(leave => {
      console.log(`[MonthSummary] Open leave: "${leave.title}" (started: ${formatDateOnlyForDisplay(leave.startDate)})`);
    });
    
    return openLeaves.length;
  }, [leavesInMonth]);
  
  // *** ПОДСЧЕТ ОБЩЕГО КОЛИЧЕСТВА ДНЕЙ ОТПУСКОВ В МЕСЯЦЕ ***
  const totalLeaveDaysInMonth = React.useMemo(() => {
    const total = Object.values(leavesByType).reduce((sum, group) => sum + group.totalDays, 0);
    console.log(`[MonthSummary] *** TOTAL LEAVE DAYS IN MONTH (DATE-ONLY): ${total} days ***`);
    return total;
  }, [leavesByType]);
  
  console.log(`[MonthSummary] *** COMPONENT RENDER SUMMARY ***`);
  console.log(`[MonthSummary] Target month: ${targetMonth + 1}/${targetYear}`);
  console.log(`[MonthSummary] Holidays: ${holidays.length}`);
  console.log(`[MonthSummary] Leaves in month: ${leavesInMonth.length}`);
  console.log(`[MonthSummary] Open leaves: ${openLeavesCount}`);
  console.log(`[MonthSummary] Total leave days: ${totalLeaveDaysInMonth}`);
  console.log(`[MonthSummary] Leave types: ${Object.keys(leavesByType).length}`);
  
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
            <strong>Leaves (Date-only): </strong>
            {leavesInMonth.length > 0 ? leavesInMonth.length : 'No'} leaves found for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
            {openLeavesCount > 0 && 
              ` (Открытых: ${openLeavesCount})`}
          </div>
          
          {/* *** НОВОЕ: Отображение общего количества дней отпусков *** */}
          {totalLeaveDaysInMonth > 0 && (
            <div>
              <strong>Total leave days in month: </strong>
              <span style={{ color: '#d13438', fontWeight: 'bold' }}>
                {totalLeaveDaysInMonth} days
              </span>
            </div>
          )}
          
          {/* *** ОБНОВЛЕНО: Отображение статистики по типам отпусков с Date-only расчетом *** */}
          {Object.keys(leavesByType).length > 0 && (
            <div style={{ marginTop: '5px' }}>
              <strong>Leave types (Date-only calculation):</strong>
              <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                {Object.keys(leavesByType).map(typeId => {
                  const group = leavesByType[typeId];
                  const count = group.leaves.length;
                  const days = group.totalDays;
                  
                  // Склонение слова "отпуск"
                  let leaveWord: string;
                  if (count === 1) {
                    leaveWord = 'отпуск';
                  } else if (count >= 2 && count <= 4) {
                    leaveWord = 'отпуска';
                  } else {
                    leaveWord = 'отпусков';
                  }
                  
                  return (
                    <li key={typeId} style={{ marginBottom: '2px' }}>
                      <span style={group.typeInfo.color ? { color: group.typeInfo.color } : undefined}>
                        <strong>{group.typeInfo.title}:</strong> {count} {leaveWord}
                        {days > 0 && (
                          <span style={{ marginLeft: '8px', fontSize: '12px', color: '#666' }}>
                            ({days} days in month)
                          </span>
                        )}
                      </span>
                      
                      {/* *** ДЕТАЛЬНАЯ ИНФОРМАЦИЯ ПО ОТПУСКАМ ТИПА *** */}
                      {group.leaves.length <= 3 && (
                        <ul style={{ margin: '2px 0 0 15px', fontSize: '11px', color: '#888' }}>
                          {group.leaves.map((leave, index) => {
                            const daysInMonth = calculateLeaveDaysInMonth(leave, targetMonth, targetYear);
                            return (
                              <li key={index} style={{ marginBottom: '1px' }}>
                                &ldquo;{leave.title}&rdquo;: {formatDateOnlyForDisplay(leave.startDate)} - {leave.endDate ? formatDateOnlyForDisplay(leave.endDate) : 'ongoing'}
                                {daysInMonth > 0 && ` (${daysInMonth} days)`}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* *** НОВОЕ: Информационное сообщение о Date-only совместимости *** */}
      {leavesInMonth.length > 0 && (
        <div style={{
          marginTop: '15px',
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          borderLeft: '4px solid #0078d4',
          fontSize: '11px',
          color: '#666'
        }}>
          <strong>Информация:</strong> Статистика адаптирована для Date-only полей. 
          Расчет дней отпусков в месяце производится с учетом только компонентов даты.
          Открытые отпуска учитываются до конца месяца или текущей даты.
        </div>
      )}
    </div>
  );
};