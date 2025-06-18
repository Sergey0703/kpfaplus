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
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
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

// Интерфейс для передачи типов отпусков и функций
interface IWeekGroupContentPropsExtended extends IWeekGroupContentProps {
  typesOfLeave: ITypeOfLeave[];
  getLeaveTypeTitle?: (typeOfLeaveId: string) => string | undefined;
}

/**
 * Компонент содержимого группы недели
 */
export const TimetableWeekGroupContent: React.FC<IWeekGroupContentPropsExtended> = (props) => {
  const { staffRows, weekInfo, dayOfStartWeek, getLeaveTypeColor, holidayColor, typesOfLeave, getLeaveTypeTitle } = props;

  const renderEmptyCell = (): JSX.Element => (
    <div style={{ 
      color: '#a19f9d', 
      textAlign: 'center', 
      padding: '12px 8px 12px 4px',
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
  }, [weekInfo.weekNum, staffRows.length]);

  /**
   * Получает правильное название типа отпуска
   */
  const getLeaveTypeName = React.useCallback((leaveTypeId: string): string => {
    if (!leaveTypeId || !typesOfLeave || typesOfLeave.length === 0) {
      return leaveTypeId || 'Leave';
    }

    // Приоритет 1: Используем getLeaveTypeTitle из хука
    if (getLeaveTypeTitle) {
      const titleFromHook = getLeaveTypeTitle(leaveTypeId);
      if (titleFromHook && titleFromHook !== leaveTypeId) {
        return titleFromHook;
      }
    }

    // Приоритет 2: Ищем в массиве typesOfLeave
    const leaveType = typesOfLeave.find(lt => lt.id === leaveTypeId);
    if (leaveType && leaveType.title) {
      return leaveType.title;
    }

    // Приоритет 3: Пробуем найти по числовому ID
    if (leaveTypeId.startsWith('Type ')) {
      const numericId = leaveTypeId.replace('Type ', '').trim();
      const numericLeaveType = typesOfLeave.find(lt => 
        lt.id === numericId || 
        lt.id === `Type ${numericId}`
      );
      if (numericLeaveType && numericLeaveType.title) {
        return numericLeaveType.title;
      }
    }

    return leaveTypeId;
  }, [typesOfLeave, getLeaveTypeTitle]);

  // Создаем колонки для таблицы
  const columns = React.useMemo((): IColumn[] => {
    const cols: IColumn[] = [
      // КОЛОНКА ИМЕН СОТРУДНИКОВ
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

        // Форматируем дату в формате DD/MM
        const day = dayDate.getDate().toString().padStart(2, '0');
        const month = (dayDate.getMonth() + 1).toString().padStart(2, '0');
        const formattedDate = `${day}/${month}`;

        cols.push({
          key: `day${dayNumber}-week${weekInfo.weekNum}`,
          name: dayName,
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

          // Рендеринг ячейки дня
          onRender: (staffRowWithKey: ITimetableStaffRowWithKey): JSX.Element => {
            if (!staffRowWithKey || !staffRowWithKey.weekData || !staffRowWithKey.weekData.days) {
              return renderEmptyCell();
            }

            const dayData = staffRowWithKey.weekData.days[dayNumber];
            
            if (!dayData || (!dayData.hasData && !dayData.hasHoliday && !dayData.hasLeave)) {
              return renderEmptyCell();
            }

            // Определяем правильный текст для отображения
            let displayText = '';
            
            if (dayData.shifts && dayData.shifts.length > 0) {
              displayText = ''; // Будет обработано в рендеринге смен
            } else {
              if (dayData.hasHoliday) {
                displayText = 'Holiday';
              } else if (dayData.hasLeave) {
                if (dayData.formattedContent && 
                    dayData.formattedContent !== 'Leave' && 
                    dayData.formattedContent !== '' &&
                    dayData.formattedContent !== '-' &&
                    !dayData.formattedContent.startsWith('Type ')) {
                  displayText = dayData.formattedContent;
                } else if (dayData.formattedContent && dayData.formattedContent.startsWith('Type ')) {
                  displayText = getLeaveTypeName(dayData.formattedContent);
                } else if (dayData.shifts && dayData.shifts.length > 0) {
                  const leaveShift = dayData.shifts.find(shift => shift.typeOfLeaveId);
                  if (leaveShift) {
                    if (leaveShift.typeOfLeaveTitle) {
                      displayText = leaveShift.typeOfLeaveTitle;
                    } else if (leaveShift.typeOfLeaveId) {
                      displayText = getLeaveTypeName(leaveShift.typeOfLeaveId);
                    }
                  }
                } else {
                  displayText = 'Leave';
                }
              } else {
                displayText = '-';
              }
            }

            // Используем finalCellColor напрямую из dayData
            let backgroundColor: string | undefined = dayData.finalCellColor;
            
            const borderRadius = '6px';
            let border = '2px solid transparent';
            let textShadow: string | undefined = undefined;
            let priority = ColorPriority.DEFAULT;

            // Определяем приоритет для стилизации текста
            if (dayData.hasHoliday) {
              priority = ColorPriority.HOLIDAY;
              if (backgroundColor) {
                border = `3px solid ${backgroundColor}`;
                textShadow = '0 1px 3px rgba(0,0,0,0.4)';
              }
            } else if (dayData.hasLeave && backgroundColor) {
              priority = ColorPriority.LEAVE_TYPE;
              border = `3px solid ${backgroundColor}`;
              textShadow = 'none';
            }

            // Если нет цвета, но есть цвет типа отпуска - используем его
            if (!backgroundColor && dayData.leaveTypeColor) {
              backgroundColor = dayData.leaveTypeColor;
              priority = ColorPriority.LEAVE_TYPE;
              border = `3px solid ${backgroundColor}`;
            }
            
            return (
              <div 
                key={`${staffRowWithKey.uniqueKey}-day${dayNumber}`}
                style={{ 
                  fontSize: '11px',
                  padding: '12px 8px 12px 4px',
                  lineHeight: '1.3',
                  minHeight: '50px',
                  width: '100%',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: backgroundColor || TIMETABLE_COLORS.DEFAULT_BACKGROUND,
                  borderRadius: borderRadius,
                  border: border,
                  textShadow: textShadow,
                  margin: '2px',
                  position: 'relative',
                  boxShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                    '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                }}
                title={`${staffRowWithKey.staffName} - ${dayName} ${formattedDate} - ${displayText || dayData.formattedContent}`}
              >
                {/* Content rendering с полными названиями и цветами */}
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
                      } else if (priority === ColorPriority.LEAVE_TYPE) {
                        const textColor = TimetableShiftCalculatorLeaveTypes.getTextColorForBackground(backgroundColor);
                        shiftTextStyle.color = textColor;
                        if (textColor === '#ffffff') {
                          shiftTextStyle.textShadow = '0 1px 2px rgba(0,0,0,0.6)';
                        }
                      }
                    }

                    // Показываем правильное содержимое смены
                    let shiftContent = shift.formattedShift;
                    
                    // Если смена показывает время 00:00-00:00, заменяем на название отпуска/праздника
                    if (shift.formattedShift === "00:00-00:00(0:00)" || 
                        (shift.formattedShift.includes("00:00-00:00") && shift.workMinutes === 0)) {
                      if (shift.isHoliday) {
                        shiftContent = 'Holiday';
                      } else if (shift.typeOfLeaveId) {
                        shiftContent = getLeaveTypeName(shift.typeOfLeaveId);
                      }
                    }
                    // Для обычных смен с рабочим временем, но с типом отпуска
                    else if (shift.typeOfLeaveId && shift.formattedShift.includes('(')) {
                      const timeAndDuration = shift.formattedShift;
                      const leaveTypeTitle = getLeaveTypeName(shift.typeOfLeaveId);
                      
                      if (shift.isHoliday) {
                        shiftContent = `${timeAndDuration} [Holiday]`;
                      } else {
                        shiftContent = `${timeAndDuration} [${leaveTypeTitle}]`;
                      }
                    }

                    return (
                      <div 
                        key={`${staffRowWithKey.uniqueKey}-day${dayNumber}-shift${shiftIndex}`} 
                        style={shiftTextStyle}
                      >
                        {shiftContent}
                      </div>
                    );
                  })
                ) : (
                  // DAY WITHOUT SHIFTS - показываем полное название типа отпуска
                  <div style={{
                    color: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      (priority === ColorPriority.HOLIDAY ? '#ffffff' : 
                       TimetableShiftCalculatorLeaveTypes.getTextColorForBackground(backgroundColor)) : 
                      '#323130',
                    fontWeight: 'bold',
                    fontSize: '12px',
                    textAlign: 'center',
                    width: '100%',
                    textShadow: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      (priority === ColorPriority.HOLIDAY ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 2px rgba(0,0,0,0.3)') : 
                      'none'
                  }}>
                    {/* Используем getLeaveTypeName для преобразования displayText */}
                    {displayText && displayText.startsWith('Type ') ? getLeaveTypeName(displayText) : displayText}
                  </div>
                )}

                {/* Show Total only if multiple shifts */}
                {dayData.shifts && dayData.shifts.length > 1 && (
                  <div style={{ 
                    color: backgroundColor && backgroundColor !== TIMETABLE_COLORS.DEFAULT_BACKGROUND ? 
                      (priority === ColorPriority.HOLIDAY ? '#ffffff' : 
                       TimetableShiftCalculatorLeaveTypes.getTextColorForBackground(backgroundColor)) : 
                      '#323130',
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

    return cols;
  }, [weekInfo, dayOfStartWeek, forceRenderKey, getLeaveTypeColor, holidayColor, typesOfLeave, getLeaveTypeName]);

  // Проверяем данные
  if (!staffRowsWithKeys || staffRowsWithKeys.length === 0) {
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
        onShouldVirtualize={() => false}
        getKey={(item: ITimetableStaffRowWithKey, index?: number) => {
          const key = item.uniqueKey || `fallback-${weekInfo.weekNum}-${index}`;
          return key;
        }}
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
            '.ms-DetailsRow-cell': {
              padding: '0 !important',
              overflow: 'visible !important'
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
 */
export const TimetableWeekGroup: React.FC<{
  weekGroup: IWeekGroup;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined;
  holidayColor?: string;
  typesOfLeave: ITypeOfLeave[];
  getLeaveTypeTitle?: (typeOfLeaveId: string) => string | undefined;
}> = (props) => {
  const { weekGroup, dayOfStartWeek, onToggleExpand, getLeaveTypeColor, holidayColor, typesOfLeave, getLeaveTypeTitle } = props;

  const handleToggle = (): void => {
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
          typesOfLeave={typesOfLeave}
          getLeaveTypeTitle={getLeaveTypeTitle}
        />
      )}
    </div>
  );
};