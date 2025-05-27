// src/webparts/kpfaplus/components/Tabs/TimetableTab/components/TimetableWeekGroup.tsx
import * as React from 'react';
import { 
  IWeekGroupProps,
  IWeekGroupHeaderProps,
  IWeekGroupContentProps,
  IExpandControlsProps,
  IShiftInfo // FIXED: Added missing import for shift type
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from '../utils/TimetableWeekCalculator';
import { 
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn,
  IconButton,
  DefaultButton
} from '@fluentui/react';

/**
 * Компонент заголовка группы недели
 * FIXED: Moved definition before usage
 */
export const TimetableWeekGroupHeader: React.FC<IWeekGroupHeaderProps> = (props) => {
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
      {/* Иконка разворачивания */}
      <IconButton
        iconProps={{ 
          iconName: isExpanded ? 'ChevronDown' : 'ChevronRight' 
        }}
        styles={{
          root: { 
            minWidth: '24px',
            width: '24px',
            height: '24px',
            marginRight: '8px'
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
      />

      {/* Информация о неделе */}
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

      {/* Статистика */}
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
 * Компонент содержимого группы недели
 * FIXED: Moved definition before usage
 */
export const TimetableWeekGroupContent: React.FC<IWeekGroupContentProps> = (props) => {
  const { staffRows, weekInfo, dayOfStartWeek } = props;

  console.log('[TimetableWeekGroupContent] Rendering content for week:', {
    weekNum: weekInfo.weekNum,
    staffRowsCount: staffRows.length,
    dayOfStartWeek
  });

  // Создаем колонки для таблицы
  const columns = React.useMemo((): IColumn[] => {
    const cols: IColumn[] = [
      // Колонка с именами сотрудников
      {
        key: 'staffMember',
        name: 'Staff Member',
        fieldName: 'staffName',
        minWidth: 180,
        maxWidth: 220,
        isResizable: true,
        onRender: (staffRow): JSX.Element => (
          <div style={{ 
            padding: '8px',
            color: '#323130'
          }}>
            <div style={{ 
              fontWeight: '500',
              fontSize: '14px',
              marginBottom: '2px'
            }}>
              {staffRow.staffName}
            </div>
            <div style={{ 
              fontSize: '11px', 
              color: '#666',
              lineHeight: '1.2'
            }}>
              {!staffRow.hasPersonInfo && (
                <span style={{ 
                  color: '#8a8886',
                  marginRight: '4px'
                }}>
                  (Template)
                </span>
              )}
              <div>ID: {staffRow.staffId}</div>
            </div>
          </div>
        )
      }
    ];

    // Получаем упорядоченные дни недели
    const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);

    // Добавляем колонки для каждого дня недели
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

      cols.push({
        key: `day_${dayNumber}`,
        name: '', // Пустое имя, будем использовать onRenderHeader
        minWidth: 120,
        maxWidth: 160,
        isResizable: true,
        onRenderHeader: (): JSX.Element => (
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
        ),
        onRender: (staffRow): JSX.Element => {
          const dayData = staffRow.weekData.days[dayNumber];
          
          if (!dayData || !dayData.hasData) {
            return (
              <div style={{ 
                color: '#a19f9d', 
                textAlign: 'center', 
                padding: '4px',
                fontSize: '12px'
              }}>
                -
              </div>
            );
          }
          
          return (
            <div style={{ 
              fontSize: '11px', 
              padding: '4px',
              lineHeight: '1.3'
            }}>
              {dayData.shifts.map((shift: IShiftInfo, index: number) => ( // FIXED: Added explicit type annotation
                <div key={index} style={{ 
                  color: '#323130',
                  marginBottom: index < dayData.shifts.length - 1 ? '2px' : '0'
                }}>
                  {shift.formattedShift}
                </div>
              ))}
              {dayData.shifts.length > 1 && (
                <div style={{ 
                  color: '#0078d4', 
                  fontWeight: 'bold',
                  fontSize: '10px',
                  marginTop: '2px'
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

    // Добавляем колонку с недельным итогом
    cols.push({
      key: 'weekTotal',
      name: 'Week Total',
      minWidth: 80,
      maxWidth: 100,
      isResizable: true,
      onRender: (staffRow): JSX.Element => {
        const weekData = staffRow.weekData;
        
        if (weekData.totalWeekMinutes === 0) {
          return (
            <div style={{ 
              color: '#a19f9d', 
              textAlign: 'center',
              fontSize: '12px'
            }}>
              -
            </div>
          );
        }
        
        return (
          <div style={{ 
            fontSize: '12px',
            textAlign: 'center',
            padding: '4px'
          }}>
            <div style={{ 
              fontWeight: 'bold', 
              color: '#0078d4'
            }}>
              {weekData.formattedWeekTotal}
            </div>
          </div>
        );
      }
    });

    return cols;
  }, [weekInfo, dayOfStartWeek]);

  if (staffRows.length === 0) {
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
        items={staffRows}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={true}
        styles={{
          root: {
            '.ms-DetailsHeader': {
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e1e5e9'
            },
            '.ms-DetailsList-contentWrapper': {
              overflow: 'visible'
            }
          }
        }}
      />
    </div>
  );
};

/**
 * Компонент управления разворачиванием всех недель
 */
export const TimetableExpandControls: React.FC<IExpandControlsProps> = (props) => {
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
      
      <DefaultButton
        text="Expand All"
        onClick={onExpandAll}
        disabled={expandedCount === totalWeeks}
        styles={{
          root: {
            minWidth: '90px',
            height: '32px'
          }
        }}
      />
      
      <DefaultButton
        text="Collapse All"
        onClick={onCollapseAll}
        disabled={expandedCount === 0}
        styles={{
          root: {
            minWidth: '90px',
            height: '32px'
          }
        }}
      />
    </div>
  );
};

/**
 * Компонент группы недели с заголовком и содержимым
 * FIXED: Moved to end to use components defined above
 */
export const TimetableWeekGroup: React.FC<IWeekGroupProps> = (props) => {
  const { weekGroup, dayOfStartWeek, onToggleExpand } = props;

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
        />
      )}
    </div>
  );
};