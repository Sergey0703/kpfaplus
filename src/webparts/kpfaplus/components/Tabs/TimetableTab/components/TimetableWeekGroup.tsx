// src/webparts/kpfaplus/components/Tabs/TimetableTab/components/TimetableWeekGroup.tsx
import * as React from 'react';
import { 
  IWeekGroupProps,
  IWeekGroupHeaderProps,
  IWeekGroupContentProps,
  IExpandControlsProps,
  IShiftInfo
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
 * Компонент содержимого группы недели - ИСПРАВЛЕННАЯ ВЕРСИЯ
 */
export const TimetableWeekGroupContent: React.FC<IWeekGroupContentProps> = (props) => {
  const { staffRows, weekInfo, dayOfStartWeek } = props;

  console.log('[TimetableWeekGroupContent] Rendering content for week:', {
    weekNum: weekInfo.weekNum,
    staffRowsCount: staffRows.length,
    dayOfStartWeek,
    // ДОБАВЛЯЕМ ДЕТАЛЬНУЮ ДИАГНОСТИКУ
    staffRowsDetails: staffRows.map((row, index) => ({
      index,
      staffId: row.staffId,
      staffName: row.staffName,
      isDeleted: row.isDeleted,
      hasData: Object.values(row.weekData.days).some(day => day.hasData)
    }))
  });

  // Создаем колонки для таблицы с улучшенной обработкой ошибок
  const columns = React.useMemo((): IColumn[] => {
    console.log(`[TimetableWeekGroupContent] Creating columns for week ${weekInfo.weekNum}`);

    const cols: IColumn[] = [
      // Колонка с именами сотрудников - УЛУЧШЕННАЯ ВЕРСИЯ
      {
        key: 'staffMember',
        name: 'Staff Member',
        fieldName: 'staffName',
        minWidth: 180,
        maxWidth: 220,
        isResizable: true,
        onRender: (staffRow, index): JSX.Element => {
          try {
            // ДОБАВЛЯЕМ ПРОВЕРКИ НА СУЩЕСТВОВАНИЕ ДАННЫХ
            if (!staffRow) {
              console.warn(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: staffRow is null at index ${index}`);
              return <div>Error: Missing staff data</div>;
            }

            console.log(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Rendering staff ${staffRow.staffName} (index: ${index})`);

            return (
              <div style={{ 
                padding: '8px',
                color: '#323130'
              }}>
                <div style={{ 
                  fontWeight: '500',
                  fontSize: '14px',
                  marginBottom: '2px'
                }}>
                  {staffRow.staffName || 'Unknown Staff'}
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
                  <div>ID: {staffRow.staffId || 'Unknown'}</div>
                </div>
              </div>
            );
          } catch (error) {
            console.error(`[TimetableWeekGroupContent] Error rendering staff at index ${index}:`, error);
            return <div style={{ color: 'red' }}>Render Error</div>;
          }
        }
      }
    ];

    try {
      // Получаем упорядоченные дни недели
      const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);
      console.log(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Ordered days:`, orderedDays);

      // Добавляем колонки для каждого дня недели - УЛУЧШЕННАЯ ВЕРСИЯ
      orderedDays.forEach(dayNumber => {
        try {
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
            onRender: (staffRow, index): JSX.Element => {
              try {
                // ДОБАВЛЯЕМ ПРОВЕРКИ НА СУЩЕСТВОВАНИЕ ДАННЫХ
                if (!staffRow || !staffRow.weekData || !staffRow.weekData.days) {
                  console.warn(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}, Day ${dayNumber}: Missing data for staff at index ${index}`);
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
                    {dayData.shifts.map((shift: IShiftInfo, shiftIndex: number) => (
                      <div key={`${staffRow.staffId}-${dayNumber}-${shiftIndex}`} style={{ 
                        color: '#323130',
                        marginBottom: shiftIndex < dayData.shifts.length - 1 ? '2px' : '0'
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
              } catch (error) {
                console.error(`[TimetableWeekGroupContent] Error rendering day ${dayNumber} for staff at index ${index}:`, error);
                return <div style={{ color: 'red', fontSize: '10px' }}>Error</div>;
              }
            }
          });
        } catch (error) {
          console.error(`[TimetableWeekGroupContent] Error creating column for day ${dayNumber}:`, error);
        }
      });

      // Добавляем колонку с недельным итогом - УЛУЧШЕННАЯ ВЕРСИЯ
      cols.push({
        key: 'weekTotal',
        name: 'Week Total',
        minWidth: 80,
        maxWidth: 100,
        isResizable: true,
        onRender: (staffRow, index): JSX.Element => {
          try {
            if (!staffRow || !staffRow.weekData) {
              console.warn(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Missing weekData for staff at index ${index}`);
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
                  {weekData.formattedWeekTotal || '0h 00m'}
                </div>
              </div>
            );
          } catch (error) {
            console.error(`[TimetableWeekGroupContent] Error rendering week total for staff at index ${index}:`, error);
            return <div style={{ color: 'red', fontSize: '10px' }}>Error</div>;
          }
        }
      });

    } catch (error) {
      console.error(`[TimetableWeekGroupContent] Error creating columns for week ${weekInfo.weekNum}:`, error);
    }

    console.log(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Created ${cols.length} columns`);
    return cols;
  }, [weekInfo, dayOfStartWeek]);

  // ДОБАВЛЯЕМ ПРОВЕРКУ НА ПУСТЫЕ ДАННЫЕ
  if (!staffRows || staffRows.length === 0) {
    console.warn(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: No staff rows provided`);
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

  // ДОБАВЛЯЕМ ПРОВЕРКУ НА ВАЛИДНОСТЬ ДАННЫХ
  const validStaffRows = staffRows.filter((row, index) => {
    if (!row) {
      console.warn(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Null staff row at index ${index}`);
      return false;
    }
    if (!row.staffName) {
      console.warn(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Staff row without name at index ${index}`);
      return false;
    }
    return true;
  });

  if (validStaffRows.length !== staffRows.length) {
    console.error(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Found ${staffRows.length - validStaffRows.length} invalid staff rows`);
  }

  console.log(`[TimetableWeekGroupContent] Week ${weekInfo.weekNum}: Rendering DetailsList with ${validStaffRows.length} valid staff rows`);

  try {
    return (
      <div style={{ padding: '0' }}>
        <DetailsList
          items={validStaffRows} // Используем только валидные строки
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          compact={true}
          // ДОБАВЛЯЕМ ОБРАБОТЧИК ОШИБОК РЕНДЕРИНГА
          onRenderItemColumn={(item, index, column) => {
            try {
              if (column && column.onRender) {
                return column.onRender(item, index, column);
              }
              return null;
            } catch (error) {
              console.error(`[TimetableWeekGroupContent] Error rendering column ${column?.key} for item at index ${index}:`, error);
              return <div style={{ color: 'red', fontSize: '10px' }}>Render Error</div>;
            }
          }}
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
  } catch (error) {
    console.error(`[TimetableWeekGroupContent] Critical error rendering DetailsList for week ${weekInfo.weekNum}:`, error);
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: 'red',
        fontSize: '14px'
      }}>
        Error rendering week data. Check console for details.
      </div>
    );
  }
};

/**
 * Компонент заголовка группы недели
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