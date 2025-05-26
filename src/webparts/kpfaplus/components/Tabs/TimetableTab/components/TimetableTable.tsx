// src/webparts/kpfaplus/components/Tabs/TimetableTab/components/TimetableTable.tsx
import * as React from 'react';
import { useMemo } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn,
  Spinner
} from '@fluentui/react';
import { 
  ITimetableTableProps, 
  ITimetableRow, 
  TimetableDisplayMode,
  IWeekInfo
} from '../interfaces/TimetableInterfaces';
import { 
  TimetableCellRenderer, 
  WeekColumnHeader, 
  DayColumnHeader, 
  StaffNameCell 
} from './TimetableCellRenderer';
import { TimetableWeekCalculator } from '../utils/TimetableWeekCalculator';

/**
 * Основной компонент таблицы расписания
 */
export const TimetableTable: React.FC<ITimetableTableProps> = (props) => {
  const { data, weeks, displayMode, isLoading, dayOfStartWeek } = props;

  console.log('[TimetableTable] Rendering with:', {
    dataCount: data.length,
    weeksCount: weeks.length,
    displayMode,
    isLoading
  });

  // Определяем колонки в зависимости от режима отображения
  const columns = useMemo(() => {
    if (displayMode === TimetableDisplayMode.ByWeeks) {
      return createWeekColumns(weeks);
    } else {
      return createDayColumns(weeks, dayOfStartWeek);
    }
  }, [weeks, displayMode, dayOfStartWeek]);

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spinner size={2} />
        <p style={{ marginTop: '16px' }}>Loading timetable...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No staff members found for the current group.</p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
          Weeks: {weeks.length} | Display mode: {displayMode}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        fontSize: '12px', 
        color: '#666', 
        marginBottom: '10px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          Showing {data.length} staff members | 
          Mode: {displayMode === TimetableDisplayMode.ByWeeks ? 'Weekly view' : 'Daily view'} |
          Weeks: {weeks.length}
        </span>
        <span>
          Week starts on: {TimetableWeekCalculator.getDayName(dayOfStartWeek)}
        </span>
      </div>
      
      <DetailsList
        items={data}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={false}
        styles={{
          root: {
            '.ms-DetailsHeader': {
              backgroundColor: '#f3f2f1'
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
 * Создает колонки для недельного режима
 */
function createWeekColumns(weeks: IWeekInfo[]): IColumn[] {
  const columns: IColumn[] = [
    // Колонка с именами сотрудников
    {
      key: 'staffMember',
      name: 'Staff Member',
      fieldName: 'staffName',
      minWidth: 200,
      maxWidth: 250,
      isResizable: true,
      onRender: (item: ITimetableRow): JSX.Element => (
        <StaffNameCell
          staffName={item.staffName}
          staffId={item.staffId}
          isDeleted={item.isDeleted}
          hasPersonInfo={item.hasPersonInfo}
        />
      )
    }
  ];

  // Добавляем колонки для каждой недели
  weeks.forEach(week => {
    columns.push({
      key: `week_${week.weekNum}`,
      name: '', // Пустое имя, будем использовать onRenderHeader
      minWidth: 120,
      maxWidth: 140,
      isResizable: true,
      onRenderHeader: (): JSX.Element => (
        <WeekColumnHeader
          weekNum={week.weekNum}
          weekStart={week.weekStart}
          weekEnd={week.weekEnd}
        />
      ),
      onRender: (item: ITimetableRow): JSX.Element => {
        const weekData = item.weeks[week.weekNum];
        
        if (!weekData) {
          return <div style={{ color: '#a19f9d', textAlign: 'center' }}>-</div>;
        }
        
        return (
          <TimetableCellRenderer
            staffData={weekData}
            isWeekMode={true}
          />
        );
      }
    });
  });

  return columns;
}

/**
 * Создает колонки для дневного режима
 */
function createDayColumns(weeks: IWeekInfo[], dayOfStartWeek: number): IColumn[] {
  const columns: IColumn[] = [
    // Колонка с именами сотрудников
    {
      key: 'staffMember',
      name: 'Staff Member',
      fieldName: 'staffName',
      minWidth: 180,
      maxWidth: 220,
      isResizable: true,
      onRender: (item: ITimetableRow): JSX.Element => (
        <StaffNameCell
          staffName={item.staffName}
          staffId={item.staffId}
          isDeleted={item.isDeleted}
          hasPersonInfo={item.hasPersonInfo}
        />
      )
    }
  ];

  // Получаем упорядоченные дни недели
  const orderedDays = TimetableWeekCalculator.getOrderedDaysOfWeek(dayOfStartWeek);

  // Если недель много, показываем только первую неделю в дневном режиме
  const firstWeek = weeks[0];
  if (!firstWeek) {
    return columns;
  }

  // Добавляем колонки для каждого дня недели
  orderedDays.forEach(dayNumber => {
    columns.push({
      key: `day_${dayNumber}`,
      name: '', // Пустое имя, будем использовать onRenderHeader
      minWidth: 140,
      maxWidth: 180,
      isResizable: true,
      onRenderHeader: (): JSX.Element => (
        <DayColumnHeader
          dayNumber={dayNumber}
          weekStart={firstWeek.weekStart}
        />
      ),
      onRender: (item: ITimetableRow): JSX.Element => {
        // В дневном режиме показываем данные из первой недели
        const weekData = item.weeks[firstWeek.weekNum];
        
        if (!weekData || !weekData.days[dayNumber]) {
          return <div style={{ color: '#a19f9d', textAlign: 'center' }}>-</div>;
        }
        
        return (
          <TimetableCellRenderer
            staffData={weekData}
            dayNumber={dayNumber}
            isWeekMode={false}
          />
        );
      }
    });
  });

  return columns;
}

/**
 * Компонент переключения режима отображения
 */
export const TimetableDisplayModeToggle: React.FC<{
  currentMode: TimetableDisplayMode;
  onModeChange: (mode: TimetableDisplayMode) => void;
  weeksCount: number;
}> = ({ currentMode, onModeChange, weeksCount }) => {
  
  const handleWeekModeClick = (): void => {
    onModeChange(TimetableDisplayMode.ByWeeks);
  };

  const handleDayModeClick = (): void => {
    onModeChange(TimetableDisplayMode.ByDays);
  };

  return (
    <div style={{ 
      display: 'flex', 
      gap: '8px', 
      alignItems: 'center',
      marginBottom: '15px'
    }}>
      <span style={{ 
        fontSize: '14px', 
        fontWeight: '600',
        marginRight: '10px'
      }}>
        View mode:
      </span>
      
      <button
        onClick={handleWeekModeClick}
        style={{
          padding: '6px 12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: currentMode === TimetableDisplayMode.ByWeeks ? '#0078d4' : '#ffffff',
          color: currentMode === TimetableDisplayMode.ByWeeks ? '#ffffff' : '#323130',
          cursor: 'pointer',
          fontSize: '13px'
        }}
      >
        By Weeks ({weeksCount})
      </button>
      
      <button
        onClick={handleDayModeClick}
        style={{
          padding: '6px 12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: currentMode === TimetableDisplayMode.ByDays ? '#0078d4' : '#ffffff',
          color: currentMode === TimetableDisplayMode.ByDays ? '#ffffff' : '#323130',
          cursor: 'pointer',
          fontSize: '13px'
        }}
      >
        By Days (Week 1)
      </button>
      
      <span style={{ 
        fontSize: '12px', 
        color: '#666',
        marginLeft: '10px'
      }}>
        {currentMode === TimetableDisplayMode.ByWeeks ? 
          'Shows total hours per week' : 
          'Shows detailed shifts per day for first week'
        }
      </span>
    </div>
  );
};