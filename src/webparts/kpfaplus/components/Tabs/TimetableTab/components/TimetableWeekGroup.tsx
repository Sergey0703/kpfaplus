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
 * ОБНОВЛЕНО: Версия 3.2 - Показ праздников и отпусков даже без рабочих смен
 */
export const TimetableWeekGroupContent: React.FC<IWeekGroupContentProps> = (props) => {
  const { staffRows, weekInfo, dayOfStartWeek, getLeaveTypeColor, holidayColor } = props;

  console.log('[TimetableWeekGroupContent] Rendering content for week with Holiday support v3.2:', {
    weekNum: weekInfo.weekNum,
    staffRowsCount: staffRows.length,
    dayOfStartWeek,
    hasLeaveTypeColorFunction: !!getLeaveTypeColor,
    holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
    features: ['Holiday Priority System', 'Leave Type Colors', 'Non-work Day Markers', 'Clean UI']
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
    console.log(`[TimetableWeekGroupContent] Force re-render triggered for week ${weekInfo.weekNum} with Holiday support v3.2`);
  }, [weekInfo.weekNum, staffRows.length]);

  // Создаем колонки для таблицы
  const columns = React.useMemo((): IColumn[] => {
    console.log(`[TimetableWeekGroupContent] Creating columns for week ${weekInfo.weekNum} with Holiday priority system v3.2`);

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
          
          onRender: (staffRowWithKey: ITimetableStaffRowWithKey): JSX.Element => {
            if (!staffRowWithKey || !staffRowWithKey.weekData || !staffRowWithKey.weekData.days) {
              return (
                <div style={{ 
                  color: '#a19f9d', 
                  textAlign: 'center', 
                  padding: '2px',
                  fontSize: '11px'
                }}>
                  -
                </div>
              );
            }

            const dayData = staffRowWithKey.weekData.days[dayNumber];
            
            // *** ОБНОВЛЕНО v3.2: Показываем данные даже если нет смен, но есть отметки ***
            if (!dayData || (!dayData.hasData && !dayData.hasHoliday && !dayData.hasLeave)) {
              return (
                <div style={{ 
                  color: '#a19f9d', 
                  textAlign: 'center', 
                  padding: '2px',
                  fontSize: '11px'
                }}>
                  -
                </div>
              );
            }

            // *** СИСТЕМА ПРИОРИТЕТОВ ЦВЕТОВ ДЛЯ ЯЧЕЕК (БЕЗ ТЕКСТОВЫХ ИНДИКАТОРОВ) ***
            console.log(`[TimetableWeekGroupContent] Resolving cell color for ${staffRowWithKey.staffName}, day ${dayNumber}:`, {
              shiftsCount: dayData.shifts?.length || 0,
              holidayShifts: dayData.shifts?.filter(s => s.isHoliday).length || 0,
              leaveShifts: dayData.shifts?.filter(s => s.typeOfLeaveId).length || 0,
              hasHoliday: dayData.hasHoliday,
              hasLeave: dayData.hasLeave,
              hasData: dayData.hasData
            });

            // Используем систему приоритетов для определения цвета фона
            const cellStyles = TimetableShiftCalculatorLeaveTypes.createCellStyles(
              dayData.shifts || [], 
              getLeaveTypeColor
            );

            // *** НОВОЕ v3.2: Если нет смен, но есть отметки праздника/отпуска - определяем цвет ***
            let backgroundColor: string | undefined = cellStyles.backgroundColor;
            let borderRadius: string | undefined = cellStyles.borderRadius;
            let border: string | undefined = cellStyles.border;
            let textShadow: string | undefined = cellStyles.textShadow;
            let priority = cellStyles.priority;

            // Если нет смен, но есть отметки - определяем цвет напрямую
            if ((!dayData.shifts || dayData.shifts.length === 0) && (dayData.hasHoliday || dayData.hasLeave)) {
              if (dayData.hasHoliday) {
                backgroundColor = TIMETABLE_COLORS.HOLIDAY;
                priority = ColorPriority.HOLIDAY;
                borderRadius = '3px';
                border = `1px solid ${TIMETABLE_COLORS.HOLIDAY}`;
                textShadow = '0 1px 2px rgba(0,0,0,0.3)';
                console.log(`[TimetableWeekGroupContent] 🔴 NON-WORK HOLIDAY COLOR applied to ${staffRowWithKey.staffName}, day ${dayNumber}: ${backgroundColor}`);
              } else if (dayData.hasLeave && dayData.leaveTypeColor) {
                backgroundColor = dayData.leaveTypeColor;
                priority = ColorPriority.LEAVE_TYPE;
                borderRadius = '3px';
                border = `1px solid ${dayData.leaveTypeColor}`;
                textShadow = 'none';
                console.log(`[TimetableWeekGroupContent] 🟡 NON-WORK LEAVE COLOR applied to ${staffRowWithKey.staffName}, day ${dayNumber}: ${backgroundColor}`);
              }
            } else {
              // Логирование применяемого цвета для смен
              if (cellStyles.priority === ColorPriority.HOLIDAY) {
                console.log(`[TimetableWeekGroupContent] 🔴 WORK HOLIDAY COLOR applied to ${staffRowWithKey.staffName}, day ${dayNumber}: ${backgroundColor}`);
              } else if (cellStyles.priority === ColorPriority.LEAVE_TYPE) {
                console.log(`[TimetableWeekGroupContent] 🟡 WORK LEAVE COLOR applied to ${staffRowWithKey.staffName}, day ${dayNumber}: ${backgroundColor}`);
              }
            }
            
            return (
              <div 
                key={`${staffRowWithKey.uniqueKey}-day${dayNumber}`}
                style={{ 
                  fontSize: '11px',
                  padding: '2px',
                  lineHeight: '1.3',
                  backgroundColor: backgroundColor, // Применяем цвет фона
                  borderRadius: borderRadius,
                  border: border,
                  textShadow: textShadow
                }}
                title={`${staffRowWithKey.staffName} - ${dayName} ${formattedDate}`} // Упрощенная подсказка
              >
                {/* *** НОВОЕ v3.2: Показываем содержимое в зависимости от типа дня *** */}
                {dayData.shifts && dayData.shifts.length > 0 ? (
                  // ДЕНЬ С РАБОЧИМИ СМЕНАМИ
                  dayData.shifts.map((shift: IShiftInfo, shiftIndex: number) => {
                    // Определяем стиль текста смены
                    let shiftTextStyle: React.CSSProperties = {
                      color: '#323130',
                      fontWeight: dayData.shifts!.length === 1 ? 'bold' : 'normal',
                      fontSize: '11px',
                      marginBottom: shiftIndex < dayData.shifts!.length - 1 ? '1px' : '0'
                    };

                    // Улучшаем читаемость текста на цветном фоне
                    if (backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND) {
                      shiftTextStyle.textShadow = textShadow || '0 0 2px rgba(255,255,255,0.8)';
                      
                      // Если применен holiday цвет, делаем текст белым для контраста
                      if (priority === ColorPriority.HOLIDAY) {
                        shiftTextStyle.color = '#ffffff';
                        shiftTextStyle.fontWeight = 'bold';
                      }
                    }

                    return (
                      <div 
                        key={`${staffRowWithKey.uniqueKey}-day${dayNumber}-shift${shiftIndex}`} 
                        style={shiftTextStyle}
                      >
                        {shift.formattedShift}
                        {/* УБРАНО: Индикаторы праздников и типов отпусков */}
                      </div>
                    );
                  })
                ) : (
                  // *** НОВОЕ v3.2: ДЕНЬ БЕЗ СМЕН, НО С ОТМЕТКАМИ ***
                  <div style={{
                    color: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '#ffffff' : '#323130',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    textAlign: 'center',
                    textShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '0 0 2px rgba(0,0,0,0.8)' : 'none'
                  }}>
                    {dayData.hasHoliday ? 'Holiday' : dayData.hasLeave ? 'Leave' : '-'}
                  </div>
                )}

                {/* Показываем Total только если есть несколько смен */}
                {dayData.shifts && dayData.shifts.length > 1 && (
                  <div style={{ 
                    color: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '#ffffff' : '#323130',
                    fontWeight: 'bold',
                    fontSize: '11px',
                    marginTop: '2px',
                    textShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      '0 0 2px rgba(0,0,0,0.8)' : 'none'
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

    console.log(`[TimetableWeekGroupContent] Created ${cols.length} columns for week ${weekInfo.weekNum} with Holiday support v3.2`);
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

  console.log(`[TimetableWeekGroupContent] About to render DetailsList for week ${weekInfo.weekNum} with ${staffRowsWithKeys.length} items and Holiday support v3.2`);

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
 * ОБНОВЛЕНО: Версия 3.2 - Показ праздников и отпусков даже без рабочих смен
 */
export const TimetableWeekGroup: React.FC<{
  weekGroup: IWeekGroup;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  holidayColor?: string;
}> = (props) => {
  const { weekGroup, dayOfStartWeek, onToggleExpand, getLeaveTypeColor, holidayColor } = props;

  console.log('[TimetableWeekGroup] Rendering week group with Holiday support v3.2:', {
    weekNum: weekGroup.weekInfo.weekNum,
    isExpanded: weekGroup.isExpanded,
    hasData: weekGroup.hasData,
    staffCount: weekGroup.staffRows.length,
    holidayColor: holidayColor || TIMETABLE_COLORS.HOLIDAY,
    features: ['Holiday Priority', 'Leave Type Colors', 'Non-work Day Markers', 'Clean UI']
  });

  const handleToggle = (): void => {
    console.log(`[TimetableWeekGroup] Toggling week ${weekGroup.weekInfo.weekNum} - this will trigger DetailsList re-render with Holiday support v3.2`);
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