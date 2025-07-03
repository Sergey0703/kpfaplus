// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/LeavesList.tsx
import * as React from 'react';
import { DetailsList, DetailsListLayoutMode, SelectionMode, IColumn, Text } from '@fluentui/react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { getLeaveTypeInfo } from '../ScheduleTabApi';

export interface ILeavesListProps {
  leaves: ILeaveDay[];
  isLoading: boolean;
  typesOfLeave: ITypeOfLeave[];
}

/**
 * *** НОВАЯ ФУНКЦИЯ: Date-only форматирование для отображения ***
 * Создает читаемую строку даты из Date-only полей
 */
const formatDateOnlyForDisplay = (date: Date): string => {
  // *** ОБНОВЛЕНО: Используем только компоненты даты, игнорируя время ***
  // Создаем нормализованную дату для корректного отображения
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  // Возвращаем в локальном формате для пользователя
  return normalizedDate.toLocaleDateString();
};

/**
 * *** ОБНОВЛЕННАЯ ФУНКЦИЯ: Расчет длительности с Date-only совместимостью ***
 * Корректно рассчитывает дни между Date-only полями
 */
const calculateLeaveDurationDateOnly = (startDate: Date, endDate?: Date): { days: number; isOngoing: boolean } => {
  // *** СОЗДАЕМ НОРМАЛИЗОВАННУЮ ДАТУ НАЧАЛА (локальная полночь) ***
  const normalizedStartDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0, 0, 0, 0
  );
  
  if (!endDate) {
    // *** ОТКРЫТЫЙ ОТПУСК: Рассчитываем от начала до сегодня ***
    const today = new Date();
    const normalizedToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      0, 0, 0, 0
    );
    
    // *** РАСЧЕТ ДНЕЙ ДЛЯ DATE-ONLY ПОЛЕЙ ***
    const timeDiffMs = normalizedToday.getTime() - normalizedStartDate.getTime();
    const daysDiff = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24)) + 1; // +1 включает начальный день
    
    return {
      days: Math.max(1, daysDiff), // Минимум 1 день
      isOngoing: true
    };
  }
  
  // *** ЗАКРЫТЫЙ ОТПУСК: Рассчитываем между датами начала и окончания ***
  const normalizedEndDate = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
    0, 0, 0, 0
  );
  
  // *** РАСЧЕТ ДНЕЙ ДЛЯ DATE-ONLY ПОЛЕЙ ***
  const timeDiffMs = normalizedEndDate.getTime() - normalizedStartDate.getTime();
  const daysDiff = Math.floor(timeDiffMs / (1000 * 60 * 60 * 24)) + 1; // +1 включает оба дня
  
  return {
    days: Math.max(1, daysDiff), // Минимум 1 день
    isOngoing: false
  };
};

/**
 * *** ОБНОВЛЕННАЯ ФУНКЦИЯ: Определение статуса отпуска с Date-only совместимостью ***
 */
const getLeaveStatusDateOnly = (startDate: Date, endDate?: Date): {
  status: 'future' | 'active' | 'completed';
  color: string;
  text: string;
} => {
  // *** СОЗДАЕМ НОРМАЛИЗОВАННУЮ СЕГОДНЯШНЮЮ ДАТУ ***
  const today = new Date();
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    0, 0, 0, 0
  );
  
  // *** НОРМАЛИЗУЕМ ДАТУ НАЧАЛА ОТПУСКА ***
  const normalizedStartDate = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate(),
    0, 0, 0, 0
  );
  
  // *** ПРОВЕРЯЕМ БУДУЩИЕ ОТПУСКА ***
  if (normalizedStartDate > normalizedToday) {
    return {
      status: 'future',
      color: '#0078d4',
      text: 'Будущий'
    };
  }
  
  if (!endDate) {
    // *** ОТКРЫТЫЙ ОТПУСК: Если начался, то активный ***
    return {
      status: 'active',
      color: '#107c10',
      text: 'Активный'
    };
  }
  
  // *** НОРМАЛИЗУЕМ ДАТУ ОКОНЧАНИЯ ***
  const normalizedEndDate = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
    0, 0, 0, 0
  );
  
  // *** ОПРЕДЕЛЯЕМ СТАТУС НА ОСНОВЕ DATE-ONLY СРАВНЕНИЯ ***
  if (normalizedToday >= normalizedStartDate && normalizedToday <= normalizedEndDate) {
    return {
      status: 'active',
      color: '#107c10',
      text: 'Активный'
    };
  } else if (normalizedToday > normalizedEndDate) {
    return {
      status: 'completed',
      color: '#666',
      text: 'Завершен'
    };
  } else {
    // Этот случай уже обработан выше, но для полноты
    return {
      status: 'future',
      color: '#0078d4',
      text: 'Будущий'
    };
  }
};

export const LeavesList: React.FC<ILeavesListProps> = ({ leaves, isLoading, typesOfLeave }) => {
  console.log(`[LeavesList] *** RENDERING WITH DATE-ONLY COMPATIBILITY ***`);
  console.log(`[LeavesList] Processing ${leaves.length} leave records with Date-only fields`);
  
  // *** ОБНОВЛЕНО: Определяем колонки для таблицы отпусков с Date-only поддержкой ***
  const leavesColumns: IColumn[] = [
    {
      key: 'title',
      name: 'Название',
      fieldName: 'title',
      minWidth: 150,
      isResizable: true
    },
    {
      key: 'startDate',
      name: 'Дата начала',
      fieldName: 'startDate',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        // *** ОБНОВЛЕНО: Date-only форматирование ***
        const formattedDate = formatDateOnlyForDisplay(item.startDate);
        console.log(`[LeavesList] Rendering start date: ${item.startDate.toISOString()} → ${formattedDate}`);
        return <span>{formattedDate}</span>;
      }
    },
    {
      key: 'endDate',
      name: 'Дата окончания',
      fieldName: 'endDate',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        // *** ОБНОВЛЕНО: Date-only обработка даты окончания ***
        if (item.endDate) {
          const formattedDate = formatDateOnlyForDisplay(item.endDate);
          console.log(`[LeavesList] Rendering end date: ${item.endDate.toISOString()} → ${formattedDate}`);
          return <span>{formattedDate}</span>;
        } else {
          // Если дата окончания не задана, отображаем "Открыт"
          console.log(`[LeavesList] Leave "${item.title}" has no end date - showing as ongoing`);
          return <span style={{ color: '#d13438', fontStyle: 'italic' }}>Открыт</span>;
        }
      }
    },
    {
      key: 'duration',
      name: 'Длительность',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        // *** ОБНОВЛЕНО: Расчет длительности с Date-only совместимостью ***
        const duration = calculateLeaveDurationDateOnly(item.startDate, item.endDate);
        
        console.log(`[LeavesList] *** DURATION CALCULATION (DATE-ONLY) ***`);
        console.log(`[LeavesList] Leave: "${item.title}"`);
        console.log(`[LeavesList] Start: ${item.startDate.toISOString()}`);
        console.log(`[LeavesList] End: ${item.endDate ? item.endDate.toISOString() : 'ongoing'}`);
        console.log(`[LeavesList] Calculated days: ${duration.days}, Is ongoing: ${duration.isOngoing}`);
        
        if (duration.isOngoing) {
          return (
            <span style={{ color: '#d13438' }}>
              {duration.days}+ дн.
            </span>
          );
        } else {
          return <span>{duration.days} дн.</span>;
        }
      }
    },
    {
      key: 'typeOfLeave',
      name: 'Тип отпуска',
      fieldName: 'typeOfLeave',
      minWidth: 120,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        // Используем функцию getLeaveTypeInfo для получения информации о типе отпуска
        const typeInfo = getLeaveTypeInfo(item.typeOfLeave, typesOfLeave);
        
        console.log(`[LeavesList] Leave type for "${item.title}": ${item.typeOfLeave} → "${typeInfo.title}"`);
        
        // Отображаем название типа отпуска с учетом цвета, если он задан
        return (
          <span style={typeInfo.color ? { color: typeInfo.color } : undefined}>
            {typeInfo.title}
          </span>
        );
      }
    },
    {
      key: 'status',
      name: 'Статус',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        // *** ОБНОВЛЕНО: Определение статуса с Date-only совместимостью ***
        const statusInfo = getLeaveStatusDateOnly(item.startDate, item.endDate);
        
        console.log(`[LeavesList] *** STATUS CALCULATION (DATE-ONLY) ***`);
        console.log(`[LeavesList] Leave: "${item.title}"`);
        console.log(`[LeavesList] Start: ${formatDateOnlyForDisplay(item.startDate)}`);
        console.log(`[LeavesList] End: ${item.endDate ? formatDateOnlyForDisplay(item.endDate) : 'ongoing'}`);
        console.log(`[LeavesList] Status: ${statusInfo.status} → "${statusInfo.text}"`);
        
        return (
          <span style={{ 
            color: statusInfo.color, 
            fontWeight: statusInfo.status === 'active' ? 600 : 'normal' 
          }}>
            {statusInfo.text}
          </span>
        );
      }
    }
  ];
  
  // *** ОБНОВЛЕНО: Сортируем отпуска по дате начала с Date-only совместимостью ***
  const sortedLeaves = React.useMemo(() => {
    console.log(`[LeavesList] *** SORTING LEAVES BY DATE-ONLY START DATE ***`);
    
    const sorted = [...leaves].sort((a, b) => {
      // *** СОЗДАЕМ НОРМАЛИЗОВАННЫЕ ДАТЫ ДЛЯ СРАВНЕНИЯ ***
      const dateA = new Date(
        a.startDate.getFullYear(),
        a.startDate.getMonth(),
        a.startDate.getDate(),
        0, 0, 0, 0
      );
      
      const dateB = new Date(
        b.startDate.getFullYear(),
        b.startDate.getMonth(),
        b.startDate.getDate(),
        0, 0, 0, 0
      );
      
      const result = dateA.getTime() - dateB.getTime();
      
      // Логируем только первые несколько для отладки
      if (sorted.length < 3) {
        console.log(`[LeavesList] Sort comparison: "${a.title}" (${formatDateOnlyForDisplay(a.startDate)}) vs "${b.title}" (${formatDateOnlyForDisplay(b.startDate)}) = ${result}`);
      }
      
      return result;
    });
    
    console.log(`[LeavesList] Sorted ${sorted.length} leaves by Date-only start date`);
    
    // Логируем первые несколько отсортированных записей
    if (sorted.length > 0) {
      console.log(`[LeavesList] *** SORTED LEAVES (DATE-ONLY) - FIRST 3 ***`);
      sorted.slice(0, 3).forEach((leave, index) => {
        const startDateFormatted = formatDateOnlyForDisplay(leave.startDate);
        const endDateFormatted = leave.endDate ? formatDateOnlyForDisplay(leave.endDate) : 'ongoing';
        console.log(`[LeavesList] ${index + 1}. "${leave.title}": ${startDateFormatted} - ${endDateFormatted}`);
      });
    }
    
    return sorted;
  }, [leaves]);
  
  console.log(`[LeavesList] *** COMPONENT RENDER SUMMARY ***`);
  console.log(`[LeavesList] Total leaves: ${leaves.length}`);
  console.log(`[LeavesList] Sorted leaves: ${sortedLeaves.length}`);
  console.log(`[LeavesList] Types of leave available: ${typesOfLeave.length}`);
  console.log(`[LeavesList] Date-only compatibility: ENABLED`);
  
  return (
    <div style={{ marginTop: '20px' }}>
      <Text variant="large" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
        Список отпусков в текущем месяце (Date-only format)
      </Text>
      <DetailsList
        items={sortedLeaves}
        columns={leavesColumns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        styles={{
          root: {
            '.ms-DetailsRow': {
              borderBottom: '1px solid #f3f2f1'
            },
            '.ms-DetailsRow:hover': {
              backgroundColor: '#f5f5f5'
            },
            // Выделяем каждую вторую строку
            '.ms-DetailsRow:nth-child(even)': {
              backgroundColor: '#fafafa'
            }
          }
        }}
      />
      
      {/* *** НОВОЕ: Информационное сообщение о Date-only совместимости *** */}
      {sortedLeaves.length > 0 && (
        <div style={{
          marginTop: '10px',
          padding: '8px 12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          borderLeft: '4px solid #0078d4',
          fontSize: '12px',
          color: '#666'
        }}>
          <strong>Информация:</strong> Отображение адаптировано для Date-only полей. 
          Расчет длительности и статусов производится с учетом только компонентов даты (без времени).
        </div>
      )}
    </div>
  );
};