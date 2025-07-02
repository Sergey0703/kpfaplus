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
 // *** УЛУЧШЕННАЯ ФУНКЦИЯ ДЛЯ DATE-ONLY СОВМЕСТИМОСТИ ***
 const formatDateForComparison = React.useCallback((date: Date): string => {
   const year = date.getFullYear();
   const month = (date.getMonth() + 1).toString().padStart(2, '0');
   const day = date.getDate().toString().padStart(2, '0');
   return `${year}-${month}-${day}`;
 }, []);

 // Получаем текущий месяц и год из выбранной даты
 const currentMonth = selectedDate.getMonth();
 const currentYear = selectedDate.getFullYear();
 
 // *** ИСПРАВЛЕНО: Находим все праздники в текущем месяце с Date-only совместимостью ***
 const monthlyHolidays = React.useMemo(() => {
   console.log('[DayInfo] *** FILTERING HOLIDAYS FOR MONTH WITH DATE-ONLY COMPATIBILITY ***');
   console.log('[DayInfo] Selected date:', selectedDate.toISOString());
   console.log('[DayInfo] Target month:', currentMonth + 1, 'year:', currentYear);
   console.log('[DayInfo] Total holidays received:', holidays.length);
   
   const filtered = holidays.filter(holiday => {
     // *** УЛУЧШЕНО: Используем компоненты даты напрямую для избежания проблем с часовыми поясами ***
     const holidayDate = new Date(holiday.date);
     const holidayYear = holidayDate.getFullYear();
     const holidayMonth = holidayDate.getMonth();
     
     const isMatch = holidayMonth === currentMonth && holidayYear === currentYear;
     
     if (isMatch) {
       console.log('[DayInfo] Holiday matches month filter:', {
         title: holiday.title,
         holidayDate: formatDateForComparison(holidayDate),
         holidayYear,
         holidayMonth: holidayMonth + 1,
         targetMonth: currentMonth + 1,
         targetYear: currentYear
       });
     }
     
     return isMatch;
   });
   
   console.log('[DayInfo] Monthly holidays filtered:', filtered.length);
   return filtered;
 }, [holidays, currentMonth, currentYear, formatDateForComparison]);

 // *** ИСПРАВЛЕНО: Сортируем праздники по дате с Date-only совместимостью ***
 const sortedHolidays = React.useMemo(() => {
   const sorted = [...monthlyHolidays].sort((a, b) => {
     // *** УЛУЧШЕНО: Используем Date-only строки для сортировки ***
     const dateA = formatDateForComparison(new Date(a.date));
     const dateB = formatDateForComparison(new Date(b.date));
     return dateA.localeCompare(dateB);
   });
   
   console.log('[DayInfo] Holidays sorted by date:', sorted.map(h => ({
     title: h.title,
     date: formatDateForComparison(new Date(h.date))
   })));
   
   return sorted;
 }, [monthlyHolidays, formatDateForComparison]);

 // *** FILTER OUT DELETED LEAVES FOR SCHEDULE TAB ***
 const activeLeaves = React.useMemo(() => {
   const filtered = leaves.filter(leave => {
     const isDeleted = leave.deleted === true;
     if (isDeleted) {
       console.log(`[DayInfo] Filtering out deleted leave: ${leave.title} (${new Date(leave.startDate).toLocaleDateString()} - ${leave.endDate ? new Date(leave.endDate).toLocaleDateString() : 'ongoing'})`);
     }
     return !isDeleted;
   });
   
   console.log('[DayInfo] Active leaves after filtering:', filtered.length, 'out of', leaves.length, 'total');
   return filtered;
 }, [leaves]);

 // *** ИСПРАВЛЕНО: Получаем все активные отпуска за месяц с улучшенной логикой ***
 const monthlyLeaves = React.useMemo(() => {
   // *** УЛУЧШЕНО: Используем UTC границы месяца для точного сравнения ***
   const monthStart = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
   const monthEnd = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
   
   console.log('[DayInfo] *** FILTERING LEAVES FOR MONTH ***');
   console.log('[DayInfo] Month boundaries (UTC):', {
     start: monthStart.toISOString(),
     end: monthEnd.toISOString(),
     monthNumber: currentMonth + 1,
     year: currentYear
   });
   
   const filtered = activeLeaves.filter(leave => {
     const leaveStart = new Date(leave.startDate);
     const leaveEnd = leave.endDate ? new Date(leave.endDate) : null;
     
     // *** УЛУЧШЕНО: Более точная логика определения попадания отпуска в месяц ***
     // Отпуск попадает в месяц если:
     // 1. Начинается в этом месяце ИЛИ
     // 2. Заканчивается в этом месяце ИЛИ  
     // 3. Охватывает весь месяц ИЛИ
     // 4. Начался в этом месяце и еще не закончился (нет даты окончания)
     const startsInMonth = leaveStart >= monthStart && leaveStart <= monthEnd;
     const endsInMonth = leaveEnd && leaveEnd >= monthStart && leaveEnd <= monthEnd;
     const spansMonth = leaveEnd && leaveStart <= monthStart && leaveEnd >= monthEnd;
     const startsAndOngoing = startsInMonth && !leaveEnd;
     
     const isInMonth = startsInMonth || endsInMonth || spansMonth || startsAndOngoing;
     
     if (isInMonth) {
       console.log('[DayInfo] Leave matches month filter:', {
         title: leave.title,
         startDate: leaveStart.toLocaleDateString(),
         endDate: leaveEnd ? leaveEnd.toLocaleDateString() : 'ongoing',
         typeOfLeave: leave.typeOfLeave,
         startsInMonth,
         endsInMonth,
         spansMonth,
         startsAndOngoing
       });
     }
     
     return isInMonth;
   });
   
   console.log('[DayInfo] Monthly leaves filtered:', filtered.length);
   return filtered;
 }, [activeLeaves, currentMonth, currentYear]);

 // *** ИСПРАВЛЕНО: Сортируем отпуска по дате начала ***
 const sortedLeaves = React.useMemo(() => {
   const sorted = [...monthlyLeaves].sort((a, b) => {
     return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
   });
   
   console.log('[DayInfo] Leaves sorted by start date:', sorted.map(l => ({
     title: l.title,
     startDate: new Date(l.startDate).toLocaleDateString(),
     endDate: l.endDate ? new Date(l.endDate).toLocaleDateString() : 'ongoing'
   })));
   
   return sorted;
 }, [monthlyLeaves]);

 // *** ОТЛАДОЧНОЕ ЛОГИРОВАНИЕ С DATE-ONLY ИНФОРМАЦИЕЙ ***
 React.useEffect(() => {
   console.log('[DayInfo] *** COMPONENT RENDER WITH DATE-ONLY COMPATIBILITY ***');
   console.log('[DayInfo] Selected date:', selectedDate.toISOString());
   console.log('[DayInfo] Selected date formatted:', formatDateForComparison(selectedDate));
   console.log('[DayInfo] All holidays received:', holidays.length);
   console.log('[DayInfo] Monthly holidays found:', sortedHolidays.length);
   console.log('[DayInfo] All leaves received:', leaves.length);
   console.log('[DayInfo] Active leaves after filtering:', activeLeaves.length);
   console.log('[DayInfo] Monthly active leaves found:', sortedLeaves.length);
   console.log('[DayInfo] Date-only format compatibility: ENABLED');
   
   // Специальное логирование для первых нескольких праздников
   if (sortedHolidays.length > 0) {
     console.log('[DayInfo] Sample holidays (Date-only format):');
     sortedHolidays.slice(0, 3).forEach((holiday, index) => {
       console.log(`  ${index + 1}. ${holiday.title} - ${formatDateForComparison(new Date(holiday.date))}`);
     });
   }
 }, [selectedDate, holidays, leaves, sortedHolidays, sortedLeaves, activeLeaves, formatDateForComparison]);

 return (
   <div style={{ marginBottom: '15px' }}>
     {/* *** ИСПРАВЛЕНО: Показываем все праздники месяца с Date-only совместимостью *** */}
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
           {sortedHolidays.map((holiday, index) => {
             // *** УЛУЧШЕНО: Используем Date-only совместимое форматирование ***
             const holidayDate = new Date(holiday.date);
             const displayDate = holidayDate.toLocaleDateString();
             
             return (
               <div key={holiday.id || index} style={{ 
                 fontSize: '12px', 
                 color: '#605E5C',
                 marginBottom: '4px',
                 paddingLeft: '8px'
               }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span>
                     <strong style={{ color: '#323130' }}>
                       {displayDate}:
                     </strong>{' '}
                     {holiday.title}
                     <span style={{ fontSize: '10px', color: '#999', marginLeft: '8px' }}>
                       (Date-only: {formatDateForComparison(holidayDate)})
                     </span>
                   </span>
                 </div>
               </div>
             );
           })}
         </div>
       </div>
     )}

     {/* *** ИСПРАВЛЕНО: Показываем все активные отпуска месяца *** */}
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

     {/* *** УЛУЧШЕНО: Сообщение, если нет активных отпусков *** */}
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
         No active leave days found for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.
       </div>
     )}

     {/* *** УЛУЧШЕНО: Сообщение, если нет праздников с Date-only информацией *** */}
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
         No holidays found for {selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} (Date-only format).
       </div>
     )}
     
   </div>
 );
};