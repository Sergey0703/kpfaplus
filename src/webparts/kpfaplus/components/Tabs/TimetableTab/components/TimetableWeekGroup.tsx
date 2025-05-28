// src/webparts/kpfaplus/components/Tabs/TimetableTab/components/TimetableWeekGroup.tsx
import * as React from 'react';
import { 
  IWeekGroupContentProps,
  IShiftInfo
} from '../interfaces/TimetableInterfaces';
import { TimetableWeekCalculator } from '../utils/TimetableWeekCalculator';
import { 
  DetailsList,
  DetailsListLayoutMode,
  SelectionMode,
  IColumn
} from '@fluentui/react';

/**
 * ДИАГНОСТИЧЕСКАЯ ВЕРСИЯ: Компонент содержимого группы недели
 * С детальным логированием для поиска проблемы с рендерингом после Noel Murphy
 */
export const TimetableWeekGroupContent: React.FC<IWeekGroupContentProps> = (props) => {
  const { staffRows, weekInfo, dayOfStartWeek } = props;

  console.log('[TimetableWeekGroupContent] 🔍 DIAGNOSTIC MODE: Rendering content for week:', {
    weekNum: weekInfo.weekNum,
    staffRowsCount: staffRows.length,
    dayOfStartWeek,
    mode: 'DIAGNOSTIC - tracking render calls'
  });

  // Создаем уникальные ключи для каждой строки
  const staffRowsWithKeys = React.useMemo(() => {
    return staffRows.map((staffRow, index) => ({
      ...staffRow,
      uniqueKey: `week${weekInfo.weekNum}-staff${staffRow.staffId}-index${index}`,
      originalIndex: index,
      weekNum: weekInfo.weekNum
    }));
  }, [staffRows, weekInfo.weekNum]);

  // Принудительный ре-рендер DetailsList
  const [forceRenderKey, setForceRenderKey] = React.useState(0);
  
  React.useEffect(() => {
    setForceRenderKey(prev => prev + 1);
    console.log(`[TimetableWeekGroupContent] 🔄 Force re-render triggered for week ${weekInfo.weekNum}`);
  }, [weekInfo.weekNum, staffRows.length]);

  // Создаем колонки для таблицы с детальной диагностикой
  const columns = React.useMemo((): IColumn[] => {
    console.log(`[TimetableWeekGroupContent] 🏗️ Creating columns for week ${weekInfo.weekNum}`);

    const cols: IColumn[] = [
      // КОЛОНКА ИМЕН СОТРУДНИКОВ С ДИАГНОСТИКОЙ
      {
        key: `staffMember-week${weekInfo.weekNum}`,
        name: 'Staff Member',
        fieldName: 'staffName',
        minWidth: 180,
        maxWidth: 220,
        isResizable: true,
        onRender: (staffRowWithKey, index): JSX.Element => {
          // КРИТИЧЕСКАЯ ДИАГНОСТИКА КАЖДОГО РЕНДЕРА
          console.log(`[TimetableWeekGroupContent] 🎯 RENDERING STAFF COLUMN: Week ${weekInfo.weekNum}, Index ${index}, Name: ${staffRowWithKey?.staffName || 'NULL'}`);
          
          try {
            if (!staffRowWithKey) {
              console.error(`[TimetableWeekGroupContent] ❌ ERROR: staffRow is null at index ${index} in week ${weekInfo.weekNum}`);
              return <div style={{ color: 'red' }}>Error: Missing staff data</div>;
            }

            // Специальная диагностика для критических сотрудников
            const isNoelMurphy = staffRowWithKey.staffName?.toLowerCase().includes('noel murphy');
            const isAfterNoelMurphy = index !== undefined && index >= 19; // Noel Murphy на индексе 19
            
            if (isNoelMurphy) {
              console.log(`[TimetableWeekGroupContent] 🎯 RENDERING NOEL MURPHY: Week ${weekInfo.weekNum}, Index ${index}`);
            }
            
            if (isAfterNoelMurphy) {
              console.log(`[TimetableWeekGroupContent] 🚨 RENDERING AFTER NOEL MURPHY: Week ${weekInfo.weekNum}, Index ${index}, Name: ${staffRowWithKey.staffName}`);
            }

            const result = (
              <div 
                key={staffRowWithKey.uniqueKey}
                style={{ 
                  padding: '8px',
                  color: staffRowWithKey.isDeleted ? '#a19f9d' : '#323130',
                  fontStyle: staffRowWithKey.isDeleted ? 'italic' : 'normal'
                }}
              >
                <div style={{ 
                  fontWeight: '500',
                  fontSize: '14px',
                  marginBottom: '2px'
                }}>
                  {staffRowWithKey.staffName || 'Unknown Staff'}
                </div>
                <div style={{ 
                  fontSize: '11px', 
                  color: '#666',
                  lineHeight: '1.2'
                }}>
                  {staffRowWithKey.isDeleted && (
                    <span style={{ 
                      color: '#d83b01',
                      marginRight: '4px'
                    }}>
                      (Deleted)
                    </span>
                  )}
                  {!staffRowWithKey.hasPersonInfo && (
                    <span style={{ 
                      color: '#8a8886',
                      marginRight: '4px'
                    }}>
                      (Template)
                    </span>
                  )}
                  <div>ID: {staffRowWithKey.staffId || 'Unknown'}</div>
                </div>
              </div>
            );

            // Подтверждаем успешный рендер
            if (isNoelMurphy) {
              console.log(`[TimetableWeekGroupContent] ✅ NOEL MURPHY RENDERED SUCCESSFULLY`);
            }
            if (isAfterNoelMurphy) {  
              console.log(`[TimetableWeekGroupContent] ✅ STAFF AFTER NOEL MURPHY RENDERED: ${staffRowWithKey.staffName}`);
            }

            return result;
            
          } catch (error) {
            console.error(`[TimetableWeekGroupContent] 💥 CRITICAL RENDER ERROR at index ${index}:`, error);
            console.error(`[TimetableWeekGroupContent] Staff data:`, staffRowWithKey);
            
            if (index !== undefined && index >= 19) {
              console.error(`[TimetableWeekGroupContent] 🚨🚨🚨 ERROR AFTER NOEL MURPHY - THIS IS THE PROBLEM!`);
            }
            
            return <div style={{ color: 'red', fontSize: '12px' }}>Render Error: {staffRowWithKey?.staffName || 'Unknown'}</div>;
          }
        }
      }
    ];

    try {
      // Получаем упорядоченные дни недели
      const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);

      // КОЛОНКИ ДНЕЙ НЕДЕЛИ С ДИАГНОСТИКОЙ
      orderedDays.forEach(dayNumber => {
        const dayName = TimetableWeekCalculator.getDayName(dayNumber);
        
        cols.push({
          key: `day${dayNumber}-week${weekInfo.weekNum}`,
          name: '',
          minWidth: 120,
          maxWidth: 160,
          isResizable: true,
          onRenderHeader: (): JSX.Element => {
            // Рассчитываем дату для этого дня недели
            const dayDate = new Date(weekInfo.weekStart);
            const startDayNumber = TimetableWeekCalculator.getDayNumber(weekInfo.weekStart);
            
            let offset = dayNumber - startDayNumber;
            if (offset < 0) {
              offset += 7;
            }
            
            dayDate.setDate(weekInfo.weekStart.getDate() + offset);

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
          },
          onRender: (staffRowWithKey, index): JSX.Element => {
            // ДИАГНОСТИКА РЕНДЕРА ДЛЯ КАЖДОГО ДНЯ
            const isAfterNoelMurphy = index !== undefined && index >= 19;
            
            if (isAfterNoelMurphy) {
              console.log(`[TimetableWeekGroupContent] 🔍 RENDERING DAY ${dayName} for staff after Noel Murphy: Index ${index}, Name: ${staffRowWithKey?.staffName}`);
            }
            
            try {
              if (!staffRowWithKey || !staffRowWithKey.weekData || !staffRowWithKey.weekData.days) {
                if (isAfterNoelMurphy) {
                  console.warn(`[TimetableWeekGroupContent] ⚠️ Missing weekData for staff after Noel Murphy at index ${index}`);
                }
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

              const dayData = staffRowWithKey.weekData.days[dayNumber];
              
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
              
              const result = (
                <div 
                  key={`${staffRowWithKey.uniqueKey}-day${dayNumber}`}
                  style={{ 
                    fontSize: '11px', 
                    padding: '4px',
                    lineHeight: '1.3'
                  }}
                >
                  {dayData.shifts.map((shift: IShiftInfo, shiftIndex: number) => (
                    <div 
                      key={`${staffRowWithKey.uniqueKey}-day${dayNumber}-shift${shiftIndex}`} 
                      style={{ 
                        color: '#323130',
                        marginBottom: shiftIndex < dayData.shifts.length - 1 ? '2px' : '0'
                      }}
                    >
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

              if (isAfterNoelMurphy && dayData.hasData) {
                console.log(`[TimetableWeekGroupContent] ✅ Successfully rendered day ${dayName} for staff after Noel Murphy`);
              }

              return result;
              
            } catch (error) {
              console.error(`[TimetableWeekGroupContent] 💥 CRITICAL DAY RENDER ERROR for ${dayName} at index ${index}:`, error);
              
              if (isAfterNoelMurphy) {
                console.error(`[TimetableWeekGroupContent] 🚨🚨🚨 DAY RENDER ERROR AFTER NOEL MURPHY!`);
              }
              
              return <div style={{ color: 'red', fontSize: '10px' }}>Day Error</div>;
            }
          }
        });
      });

      // КОЛОНКА НЕДЕЛЬНОГО ИТОГА С ДИАГНОСТИКОЙ
      cols.push({
        key: `weekTotal-week${weekInfo.weekNum}`,
        name: 'Week Total',
        minWidth: 80,
        maxWidth: 100,
        isResizable: true,
        onRender: (staffRowWithKey, index): JSX.Element => {
          const isAfterNoelMurphy = index !== undefined && index >= 19;
          
          if (isAfterNoelMurphy) {
            console.log(`[TimetableWeekGroupContent] 🔍 RENDERING WEEK TOTAL for staff after Noel Murphy: Index ${index}, Name: ${staffRowWithKey?.staffName}`);
          }
          
          try {
            if (!staffRowWithKey || !staffRowWithKey.weekData) {
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

            const weekData = staffRowWithKey.weekData;
            
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
            
            const result = (
              <div 
                key={`${staffRowWithKey.uniqueKey}-total`}
                style={{ 
                  fontSize: '12px',
                  textAlign: 'center',
                  padding: '4px'
                }}
              >
                <div style={{ 
                  fontWeight: 'bold', 
                  color: '#0078d4'
                }}>
                  {weekData.formattedWeekTotal || '0h 00m'}
                </div>
              </div>
            );

            if (isAfterNoelMurphy) {
              console.log(`[TimetableWeekGroupContent] ✅ Successfully rendered week total for staff after Noel Murphy`);
            }

            return result;
            
          } catch (error) {
            console.error(`[TimetableWeekGroupContent] 💥 CRITICAL WEEK TOTAL RENDER ERROR at index ${index}:`, error);
            
            if (isAfterNoelMurphy) {
              console.error(`[TimetableWeekGroupContent] 🚨🚨🚨 WEEK TOTAL ERROR AFTER NOEL MURPHY!`);
            }
            
            return <div style={{ color: 'red', fontSize: '10px' }}>Total Error</div>;
          }
        }
      });

    } catch (error) {
      console.error(`[TimetableWeekGroupContent] Error creating columns:`, error);
    }

    console.log(`[TimetableWeekGroupContent] 🏗️ Created ${cols.length} columns for week ${weekInfo.weekNum}`);
    return cols;
  }, [weekInfo, dayOfStartWeek, forceRenderKey]);

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

  // ДИАГНОСТИКА ДАННЫХ ПЕРЕД РЕНДЕРОМ
  console.log(`[TimetableWeekGroupContent] 📊 DIAGNOSTIC DATA ANALYSIS for week ${weekInfo.weekNum}:`);
  console.log(`[TimetableWeekGroupContent] Total staff rows: ${staffRowsWithKeys.length}`);
  
  staffRowsWithKeys.forEach((staff, index) => {
    if (index >= 18 && index <= 22) { // Область вокруг Noel Murphy
      console.log(`[TimetableWeekGroupContent] Staff ${index}: ${staff.staffName} (Key: ${staff.uniqueKey})`);
    }
  });

  console.log(`[TimetableWeekGroupContent] 🚀 About to render DetailsList for week ${weekInfo.weekNum} with ${staffRowsWithKeys.length} items`);

  try {
    return (
      <div style={{ padding: '0' }}>
        <DetailsList
          key={`detailsList-week${weekInfo.weekNum}-render${forceRenderKey}`}
          items={staffRowsWithKeys}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          compact={true}
          
          // Собственный getKey для уникальности
          getKey={(item: any, index?: number) => {
            const key = item.uniqueKey || `fallback-${weekInfo.weekNum}-${index}`;
            
            // Логируем ключи для критической области
            if (index !== undefined && index >= 18 && index <= 22) {
              console.log(`[TimetableWeekGroupContent] 🔑 getKey for critical area: Index ${index}, Name: ${item.staffName}, Key: ${key}`);
            }
            
            return key;
          }}
          
          enableUpdateAnimations={false}
          
          // КРИТИЧЕСКАЯ ДИАГНОСТИКА В onRenderItemColumn
          onRenderItemColumn={(item, index, column) => {
            const isAfterNoelMurphy = index !== undefined && index >= 19;
            
            if (isAfterNoelMurphy) {
              console.log(`[TimetableWeekGroupContent] 🎯 onRenderItemColumn called for staff after Noel Murphy: Index ${index}, Column: ${column?.key}, Name: ${item?.staffName}`);
            }
            
            try {
              if (column && column.onRender) {
                const result = column.onRender(item, index, column);
                
                if (isAfterNoelMurphy) {
                  console.log(`[TimetableWeekGroupContent] ✅ Column ${column.key} rendered successfully for staff after Noel Murphy`);
                }
                
                return result;
              }
              return null;
            } catch (error) {
              console.error(`[TimetableWeekGroupContent] 💥 CRITICAL onRenderItemColumn ERROR: Index ${index}, Column: ${column?.key}`, error);
              
              if (isAfterNoelMurphy) {
                console.error(`[TimetableWeekGroupContent] 🚨🚨🚨 RENDER ERROR AFTER NOEL MURPHY - FOUND THE PROBLEM!`);
                console.error(`[TimetableWeekGroupContent] Problem column: ${column?.key}`);
                console.error(`[TimetableWeekGroupContent] Problem item:`, item);
              }
              
              return <div style={{ color: 'red', fontSize: '10px' }}>Error</div>;
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
  } catch (error) {
    console.error(`[TimetableWeekGroupContent] 💥 CRITICAL DetailsList render error:`, error);
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: 'red',
        fontSize: '14px'
      }}>
        Critical DetailsList Error - Check console
      </div>
    );
  }
};

/**
 * Компонент заголовка группы недели
 */
export const TimetableWeekGroupHeader: React.FC<{
  weekInfo: any;
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
  weekGroup: any;
  dayOfStartWeek: number;
  onToggleExpand: (weekNum: number) => void;
}> = (props) => {
  const { weekGroup, dayOfStartWeek, onToggleExpand } = props;

  const handleToggle = (): void => {
    console.log(`[TimetableWeekGroup] Toggling week ${weekGroup.weekInfo.weekNum} - this will trigger DetailsList re-render`);
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