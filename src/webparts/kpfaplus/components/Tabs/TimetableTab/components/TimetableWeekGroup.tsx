// src/webparts/kpfaplus/components/Tabs/TimetableTab/components/TimetableWeekGroup.tsx
import * as React from 'react';
import { 
  IWeekGroupContentProps,
  IShiftInfo,
  ITimetableStaffRow,
  IWeekGroup,
  TIMETABLE_COLORS,
  ColorPriority
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from '../utils/TimetableWeekCalculator';
import { TimetableShiftCalculatorLeaveTypes } from '../utils/TimetableShiftCalculatorLeaveTypes';
import { 
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn
} from '@fluentui/react';

// Расширенный тип для строк с уникальными ключами
interface ITimetableStaffRowWithKey extends ITimetableStaffRow {
  uniqueKey: string;
  originalIndex: number;
  weekNum: number;
}

/**
 * Компонент содержимого группы недели
 * ИСПРАВЛЕНО: Отключена виртуализация для решения проблемы с рендерингом после Noel Murphy
 * ОБНОВЛЕНО: Версия 3.3 - ИСПРАВЛЕНО отображение цветов и названий отпусков - УБРАН HARDCODE
 * НОВОЕ: Расширенная цветная область ячеек для лучшего отображения + реальные данные о типах отпусков
 */
export const TimetableWeekGroupContent: React.FC<IWeekGroupContentProps> = (props) => {
  const { staffRows, weekInfo, dayOfStartWeek, getLeaveTypeColor, holidayColor } = props;

  console.log('[TimetableWeekGroupContent] Rendering content for week with REAL LEAVE TYPE DATA v3.3:', {
    weekNum: weekInfo.weekNum,
    staffRowsCount: staffRows.length,
    dayOfStartWeek,
    hasLeaveTypeColorFunction: !!getLeaveTypeColor,
    holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
    features: ['Holiday Priority System', 'Leave Type Colors', 'Non-work Day Markers', 'Expanded Color Areas', 'Clean UI', 'REAL LEAVE TYPE DATA - NO HARDCODE']
  });

  // Создаем уникальные ключи для каждой строки
  const staffRowsWithKeys = React.useMemo(() => {
    return staffRows.map((staffRow, index) => ({
      ...staffRow,
      uniqueKey: `week${weekInfo.weekNum}-staff${staffRow.staffId}-index${index}`,
      originalIndex: index,
      weekNum: weekInfo.weekNum
    }));
  }, [staffRows, weekInfo.weekNum]) as ITimetableStaffRowWithKey[];

  // Принудительный ре-рендер DetailsList
  const [forceRenderKey, setForceRenderKey] = React.useState(0);
  
  React.useEffect(() => {
    setForceRenderKey(prev => prev + 1);
    console.log(`[TimetableWeekGroupContent] Force re-render triggered for week ${weekInfo.weekNum} with REAL LEAVE TYPE DATA v3.3`);
  }, [weekInfo.weekNum, staffRows.length]);

  // Создаем колонки для таблицы
  const columns = React.useMemo((): IColumn[] => {
    console.log(`[TimetableWeekGroupContent] Creating columns for week ${weekInfo.weekNum} with REAL LEAVE TYPE DATA v3.3`);

    const cols: IColumn[] = [
      // КОЛОНКА ИМЕН СОТРУДНИКОВ С ЧАСАМИ
      {
        key: `staffMember-week${weekInfo.weekNum}`,
        name: 'Staff Member',
        fieldName: 'staffName',
        minWidth: 140,
        maxWidth: 180,
        isResizable: true,
        onRender: (staffRowWithKey: ITimetableStaffRowWithKey): JSX.Element => {
          if (!staffRowWithKey) {
            return <div style={{ color: 'red' }}>Error: Missing staff data</div>;
          }

          // Получаем недельный итог часов
          const weekTotalHours = staffRowWithKey.weekData?.formattedWeekTotal || '0h 00m';
          const hasWeekData = staffRowWithKey.weekData?.totalWeekMinutes > 0;

          return (
            <div 
              key={staffRowWithKey.uniqueKey}
              style={{ 
                padding: '4px',
                color: staffRowWithKey.isDeleted ? '#a19f9d' : '#323130',
                fontStyle: staffRowWithKey.isDeleted ? 'italic' : 'normal'
              }}
            >
              <div style={{ 
                fontWeight: '500',
                fontSize: '13px',
                marginBottom: '1px'
              }}>
                {staffRowWithKey.staffName || 'Unknown Staff'}
              </div>
              <div style={{ 
                fontSize: '10px', 
                lineHeight: '1.1',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                {/* Недельный итог часов и ID в одной строке */}
                <span style={{
                  color: hasWeekData ? '#0078d4' : '#a19f9d',
                  fontWeight: hasWeekData ? 'bold' : 'normal'
                }}>
                  {weekTotalHours}
                </span>
                <span style={{ color: '#666' }}>
                  ID: {staffRowWithKey.staffId || 'Unknown'}
                </span>
              </div>
            </div>
          );
        }
      }
    ];

    try {
      // Получаем упорядоченные дни недели
      const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);

      // КОЛОНКИ ДНЕЙ НЕДЕЛИ
      orderedDays.forEach(dayNumber => {
        const dayName = TimetableWeekCalculator.getDayName(dayNumber);
        
        // Рассчитываем дату для этого дня недели
        const dayDate = new Date(weekInfo.weekStart);
        const startDayNumber = TimetableWeekCalculator.getDayNumber(weekInfo.weekStart);
        
        let offset = dayNumber - startDayNumber;
        if (offset < 0) {
          offset += 7;
        }
        
        dayDate.setDate(weekInfo.weekStart.getDate() + offset);

        // Форматируем дату в формате DD/MM как в Power Apps
        const day = dayDate.getDate().toString().padStart(2, '0');
        const month = (dayDate.getMonth() + 1).toString().padStart(2, '0');
        const formattedDate = `${day}/${month}`;

        cols.push({
          key: `day${dayNumber}-week${weekInfo.weekNum}`,
          name: dayName, // Только день недели
          minWidth: 80,
          maxWidth: 100,
          isResizable: true,
          
          onRenderHeader: (): JSX.Element => {
            return (
              <div style={{ 
                textAlign: 'center',
                padding: '2px 0',
                height: 'auto',
                lineHeight: '1.2'
              }}>
                <div style={{ 
                  fontWeight: 'bold', 
                  fontSize: '12px',
                  marginBottom: '2px',
                  color: '#323130'
                }}>
                  {dayName}
                </div>
                <div style={{ 
                  fontSize: '10px', 
                  color: '#666',
                  fontWeight: 'normal'
                }}>
                  {formattedDate}
                </div>
              </div>
            );
          },
          
          // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: РЕАЛЬНЫЕ ДАННЫЕ О ТИПАХ ОТПУСКОВ ИЗ dayData ***
          onRender: (staffRowWithKey: ITimetableStaffRowWithKey): JSX.Element => {
            if (!staffRowWithKey || !staffRowWithKey.weekData || !staffRowWithKey.weekData.days) {
              return (
                <div style={{ 
                  color: '#a19f9d', 
                  textAlign: 'center', 
                  padding: '12px 8px',
                  fontSize: '11px',
                  minHeight: '50px',
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  -
                </div>
              );
            }

            const dayData = staffRowWithKey.weekData.days[dayNumber];
            
            if (!dayData || (!dayData.hasData && !dayData.hasHoliday && !dayData.hasLeave)) {
              return (
                <div style={{ 
                  color: '#a19f9d', 
                  textAlign: 'center', 
                  padding: '12px 8px',
                  fontSize: '11px',
                  minHeight: '50px',
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  -
                </div>
              );
            }

            // *** ИСПРАВЛЕНО: УБРАНА ФУНКЦИЯ findLeaveInfoForDay() - ИСПОЛЬЗУЕМ РЕАЛЬНЫЕ ДАННЫЕ ИЗ dayData ***
            console.log(`[TimetableWeekGroupContent] *** PROCESSING DAY ${dayNumber} WITH REAL DATA v3.3 ***`, {
              hasData: dayData.hasData,
              hasLeave: dayData.hasLeave,
              hasHoliday: dayData.hasHoliday,
              leaveTypeColor: dayData.leaveTypeColor,
              shiftsCount: dayData.shifts?.length || 0,
              solution: 'Using real leave type data from dayData instead of hardcode'
            });

            // *** СИСТЕМА ПРИОРИТЕТОВ ЦВЕТОВ С РЕАЛЬНЫМИ ДАННЫМИ ***
            const cellStyles = TimetableShiftCalculatorLeaveTypes.createCellStyles(
              dayData.shifts || [], 
              getLeaveTypeColor
            );

            // Determine final background color with priority system
            let backgroundColor: string | undefined = cellStyles.backgroundColor;
            let borderRadius: string | undefined = cellStyles.borderRadius;
            let border: string | undefined = cellStyles.border;
            let textShadow: string | undefined = cellStyles.textShadow;
            let priority = cellStyles.priority;

            // *** ИСПРАВЛЕНО: Обработка дней без смен с реальными данными о типах отпусков ***
            if ((!dayData.shifts || dayData.shifts.length === 0) && (dayData.hasHoliday || dayData.hasLeave)) {
              if (dayData.hasHoliday) {
                backgroundColor = TIMETABLE_COLORS.HOLIDAY;
                priority = ColorPriority.HOLIDAY;
                borderRadius = '6px';
                border = `3px solid ${TIMETABLE_COLORS.HOLIDAY}`;
                textShadow = '0 1px 3px rgba(0,0,0,0.4)';
                
                console.log(`[TimetableWeekGroupContent] *** APPLIED HOLIDAY COLOR FOR DAY ${dayNumber} ***`);
              } else if (dayData.hasLeave && dayData.leaveTypeColor) {
                // *** КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ: ИСПОЛЬЗУЕМ РЕАЛЬНЫЙ ЦВЕТ ИЗ dayData ***
                backgroundColor = dayData.leaveTypeColor;
                priority = ColorPriority.LEAVE_TYPE;
                borderRadius = '6px';
                border = `3px solid ${dayData.leaveTypeColor}`;
                textShadow = 'none';
                
                console.log(`[TimetableWeekGroupContent] *** APPLIED REAL LEAVE COLOR FOR DAY ${dayNumber} ***`, {
                  leaveTypeColor: dayData.leaveTypeColor,
                  source: 'dayData.leaveTypeColor (extracted from records)',
                  noMoreHardcode: true
                });
              }
            }

            // *** ИСПРАВЛЕНО: ПОЛУЧАЕМ РЕАЛЬНОЕ НАЗВАНИЕ ТИПА ОТПУСКА ***
            let leaveTypeTitle: string | undefined = undefined;
            
            if (dayData.hasLeave) {
              // Сначала ищем в сменах (если есть)
              const leaveShift = dayData.shifts?.find(shift => shift.typeOfLeaveId);
              if (leaveShift?.typeOfLeaveTitle) {
                leaveTypeTitle = leaveShift.typeOfLeaveTitle;
                console.log(`[TimetableWeekGroupContent] *** FOUND LEAVE TITLE IN SHIFTS: ${leaveTypeTitle} ***`);
              } else if (leaveShift?.typeOfLeaveId) {
                leaveTypeTitle = leaveShift.typeOfLeaveId; // Fallback к ID
                console.log(`[TimetableWeekGroupContent] *** USING LEAVE ID AS TITLE: ${leaveTypeTitle} ***`);
              } else {
                // *** ИСПРАВЛЕНО: Для дней без смен пытаемся найти информацию из других источников ***
                // В dayData должна быть сохранена информация о типе отпуска благодаря нашим исправлениям
                // Если данные все еще отсутствуют, это означает что нужно дополнительно исследовать
                console.log(`[TimetableWeekGroupContent] *** WARNING: Leave type info not found in shifts for day ${dayNumber} ***`, {
                  hasLeave: dayData.hasLeave,
                  leaveTypeColor: dayData.leaveTypeColor,
                  shiftsCount: dayData.shifts?.length || 0,
                  note: 'This should be fixed by TimetableDataProcessorCore extractLeaveInfoFromNonWorkRecords'
                });
                
                // Временное решение для отладки - показываем что у нас есть цвет
                if (dayData.leaveTypeColor) {
                  leaveTypeTitle = 'Leave'; // Общее название пока не найдем конкретное
                }
              }
            }
            
            return (
              <div 
                key={`${staffRowWithKey.uniqueKey}-day${dayNumber}`}
                style={{ 
                  fontSize: '11px',
                  padding: '12px 8px',
                  lineHeight: '1.3',
                  minHeight: '50px',
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: backgroundColor,
                  borderRadius: borderRadius || '6px',
                  border: border || '2px solid transparent',
                  textShadow: textShadow,
                  margin: '2px',
                  position: 'relative',
                  boxShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                    '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                }}
                title={`${staffRowWithKey.staffName} - ${dayName} ${formattedDate}`}
              >
                {/* Content rendering - ЕДИНЫЙ ПОДХОД С РЕАЛЬНЫМИ ДАННЫМИ */}
                {dayData.shifts && dayData.shifts.length > 0 ? (
                  // DAY WITH WORK SHIFTS
                  dayData.shifts.map((shift: IShiftInfo, shiftIndex: number) => {
                    const shiftTextStyle: React.CSSProperties = {
                      color: '#323130',
                      fontWeight: dayData.shifts!.length === 1 ? 'bold' : 'normal',
                      fontSize: '11px',
                      marginBottom: shiftIndex < dayData.shifts!.length - 1 ? '4px' : '0',
                      textAlign: 'center',
                      width: '100%'
                    };

                    // Improve text readability on colored backgrounds
                    if (backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
                      shiftTextStyle.textShadow = textShadow || '0 0 3px rgba(255,255,255,0.9)';
                      
                      if (priority === ColorPriority.HOLIDAY) {
                        shiftTextStyle.color = '#ffffff';
                        shiftTextStyle.fontWeight = 'bold';
                        shiftTextStyle.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
                      }
                    }

                    return (
                      <div 
                        key={`${staffRowWithKey.uniqueKey}-day${dayNumber}-shift${shiftIndex}`} 
                        style={shiftTextStyle}
                      >
                        {shift.formattedShift}
                      </div>
                    );
                  })
                ) : (
                  // *** ИСПРАВЛЕНО: DAY WITHOUT SHIFTS - используем реальные данные о типе отпуска ***
                  <div style={{
                    color: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '#ffffff' : '#323130',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    textAlign: 'center',
                    width: '100%',
                    textShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '0 1px 3px rgba(0,0,0,0.8)' : 'none'
                  }}>
                    {dayData.hasHoliday ? 'Holiday' : 
                     dayData.hasLeave ? (leaveTypeTitle || 'Leave') : '-'}
                  </div>
                )}

                {/* Show Total only if multiple shifts */}
                {dayData.shifts && dayData.shifts.length > 1 && (
                  <div style={{ 
                    color: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '#ffffff' : '#323130',
                    fontWeight: 'bold',
                    fontSize: '10px',
                    marginTop: '6px',
                    textAlign: 'center',
                    width: '100%',
                    borderTop: '1px solid rgba(255,255,255,0.4)',
                    paddingTop: '4px',
                    textShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                  }}>
                    Total: {dayData.totalMinutes > 0 ? 
                      TimetableWeekCalculator.formatMinutesToHours(dayData.totalMinutes) : 
                      '0h 00m'
                    }
                  </div>
                )}
              </div>
            );
          }

        });
      });

    } catch (error) {
      console.error(`[TimetableWeekGroupContent] Error creating columns:`, error);
    }

    console.log(`[TimetableWeekGroupContent] Created ${cols.length} columns for week ${weekInfo.weekNum} with REAL LEAVE TYPE DATA v3.3`);
    return cols;
  }, [weekInfo, dayOfStartWeek, forceRenderKey, getLeaveTypeColor, holidayColor]);

  // Проверяем данные
  if (!staffRowsWithKeys || staffRowsWithKeys.length === 0) {
    console.warn(`[TimetableWeekGroupContent] No staff rows for week ${weekInfo.weekNum}`);
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: '#666',
        fontSize: '14px'
      }}>
        No staff members for this week
      </div>
    );
  }

  console.log(`[TimetableWeekGroupContent] About to render DetailsList for week ${weekInfo.weekNum} with ${staffRowsWithKeys.length} items, REAL LEAVE TYPE DATA v3.3`);

  return (
    <div style={{ padding: '0' }}>
      <DetailsList
        key={`detailsList-week${weekInfo.weekNum}-render${forceRenderKey}`}
        items={staffRowsWithKeys as ITimetableStaffRowWithKey[]}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={true}
        
        // *** КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Отключаем виртуализацию ***
        onShouldVirtualize={() => false}
        
        // Собственный getKey для уникальности - ИСПРАВЛЕН ТИП
        getKey={(item: ITimetableStaffRowWithKey, index?: number) => {
          const key = item.uniqueKey || `fallback-${weekInfo.weekNum}-${index}`;
          return key;
        }}
        
        // Отключаем анимации для стабильности
        enableUpdateAnimations={false}
        
        styles={{
          root: {
            '.ms-DetailsHeader': {
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e1e5e9'
            },
            '.ms-DetailsList-contentWrapper': {
              overflow: 'visible'
            },
            '.ms-DetailsRow': {
              transition: 'none !important',
              animation: 'none !important'
            },
            // *** НОВОЕ: Улучшенные стили для цветных ячеек ***
            '.ms-DetailsRow-cell': {
              padding: '0 !important', // Убираем стандартный padding
              overflow: 'visible !important' // Разрешаем показ цветных границ
            }
          }
        }}
      />
    </div>
  );
};


/**
 * Компонент заголовка группы недели
 */
export const TimetableWeekGroupHeader: React.FC<{
  weekInfo: IWeekGroup['weekInfo'];
  isExpanded: boolean;
  hasData: boolean;
  staffCount: number;
  onToggle: () => void;
}> = (props) => {  
  const { weekInfo, isExpanded, hasData, staffCount, onToggle } = props;

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        backgroundColor: isExpanded ? '#f8f9fa' : '#ffffff',
        borderBottom: isExpanded ? '1px solid #e1e5e9' : 'none',
        cursor: 'pointer',
        borderRadius: isExpanded ? '4px 4px 0 0' : '4px'
      }}
      onClick={onToggle}
    >
      <div style={{ 
        minWidth: '24px',
        width: '24px',
        height: '24px',
        marginRight: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer'
      }}>
        {isExpanded ? '▼' : '▶'}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#323130',
          marginBottom: '2px'
        }}>
          Week {weekInfo.weekNum}
        </div>
        <div style={{
          fontSize: '13px',
          color: '#666666'
        }}>
          {weekInfo.weekStart.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit',
            year: 'numeric'
          })} - {weekInfo.weekEnd.toLocaleDateString('en-GB', { 
            day: '2-digit', 
            month: '2-digit',
            year: 'numeric'
          })}
        </div>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        fontSize: '12px',
        color: '#666666'
      }}>
        <span>{staffCount} staff</span>
        {hasData && (
          <span style={{
            color: '#107c10',
            fontWeight: '500'
          }}>
            Has data
          </span>
        )}
        {!hasData && (
          <span style={{
            color: '#a19f9d'
          }}>
            No data
          </span>
        )}
      </div>
    </div>
  );
};

/**
 * Компонент управления разворачиванием всех недель
 */
export const TimetableExpandControls: React.FC<{
  totalWeeks: number;
  expandedCount: number;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}> = (props) => {
  const { totalWeeks, expandedCount, onExpandAll, onCollapseAll } = props;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      marginBottom: '20px',
      padding: '12px 16px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e1e5e9'
    }}>
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: '#323130'
      }}>
        Week Groups:
      </div>
      
      <div style={{
        fontSize: '13px',
        color: '#666'
      }}>
        {expandedCount} of {totalWeeks} expanded
      </div>
      
      <div style={{ flex: 1 }} />
      
      <button
        onClick={onExpandAll}
        disabled={expandedCount === totalWeeks}
        style={{
          minWidth: '90px',
          height: '32px',
          padding: '6px 12px',
          backgroundColor: expandedCount === totalWeeks ? '#f3f2f1' : '#ffffff',
          color: expandedCount === totalWeeks ? '#a19f9d' : '#323130',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: expandedCount === totalWeeks ? 'not-allowed' : 'pointer'
        }}
      >
        Expand All
      </button>
      
      <button
        onClick={onCollapseAll}
        disabled={expandedCount === 0}
        style={{
          minWidth: '90px',
          height: '32px',
          padding: '6px 12px',
          backgroundColor: expandedCount === 0 ? '#f3f2f1' : '#ffffff',
          color: expandedCount === 0 ? '#a19f9d' : '#323130',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: expandedCount === 0 ? 'not-allowed' : 'pointer'
        }}
      >
        Collapse All
      </button>
    </div>
  );
};

/**
 * Компонент группы недели с заголовком и содержимым
 * ИСПРАВЛЕН ТИП: weekGroup теперь IWeekGroup вместо any
 * ОБНОВЛЕНО: Версия 3.3 - ИСПРАВЛЕНО отображение цветов и названий отпусков - УБРАН HARDCODE
 * НОВОЕ: Расширена цветная область ячеек + реальные данные о типах отпусков
 */
export const TimetableWeekGroup: React.FC<{
  weekGroup: IWeekGroup;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  holidayColor?: string;
}> = (props) => {
  const { weekGroup, dayOfStartWeek, onToggleExpand, getLeaveTypeColor, holidayColor } = props;

  console.log('[TimetableWeekGroup] Rendering week group with REAL LEAVE TYPE DATA v3.3:', {
    weekNum: weekGroup.weekInfo.weekNum,
    isExpanded: weekGroup.isExpanded,
    hasData: weekGroup.hasData,
    staffCount: weekGroup.staffRows.length,
    holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
    features: ['Holiday Priority', 'Leave Type Colors', 'Non-work Day Markers', 'Expanded Color Areas', 'Clean UI', 'REAL LEAVE TYPE DATA - NO HARDCODE']
  });

  const handleToggle = (): void => {
    console.log(`[TimetableWeekGroup] Toggling week ${weekGroup.weekInfo.weekNum} - this will trigger DetailsList re-render with REAL LEAVE TYPE DATA v3.3`);
    onToggleExpand(weekGroup.weekInfo.weekNum);
  };

  return (
    <div style={{ 
      marginBottom: '20px',
      border: '1px solid #e1e5e9',
      borderRadius: '4px',
      backgroundColor: '#ffffff'
    }}>
      <TimetableWeekGroupHeader
        weekInfo={weekGroup.weekInfo}
        isExpanded={weekGroup.isExpanded}
        hasData={weekGroup.hasData}
        staffCount={weekGroup.staffRows.length}
        onToggle={handleToggle}
      />
      
           
      {weekGroup.isExpanded && (
        <TimetableWeekGroupContent
          staffRows={weekGroup.staffRows}
          weekInfo={weekGroup.weekInfo}
          dayOfStartWeek={dayOfStartWeek}
          getLeaveTypeColor={getLeaveTypeColor}
          holidayColor={holidayColor}
        />
      )}
    </div>
  );
};