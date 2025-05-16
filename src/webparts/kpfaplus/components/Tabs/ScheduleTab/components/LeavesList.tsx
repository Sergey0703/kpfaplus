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

export const LeavesList: React.FC<ILeavesListProps> = ({ leaves, isLoading, typesOfLeave }) => {
  // Определяем колонки для таблицы отпусков
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
      onRender: (item: ILeaveDay) => (
        <span>{item.startDate.toLocaleDateString()}</span>
      )
    },
    {
      key: 'endDate',
      name: 'Дата окончания',
      fieldName: 'endDate',
      minWidth: 100,
      isResizable: true,
      onRender: (item: ILeaveDay) => {
        // Проверяем наличие даты окончания
        if (item.endDate) {
          return <span>{item.endDate.toLocaleDateString()}</span>;
        } else {
          // Если дата окончания не задана, отображаем "Открыт"
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
        // Если нет даты окончания, просто показываем текущую длительность с начала отпуска
        if (!item.endDate) {
          const start = new Date(item.startDate);
          const today = new Date();
          const diffTime = Math.abs(today.getTime() - start.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
          return <span style={{ color: '#d13438' }}>{diffDays}+ дн.</span>;
        }
        
        // Стандартный расчет для законченных отпусков
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return <span>{diffDays} дн.</span>;
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
        // Определяем статус отпуска
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Сбрасываем время
        
        const startDate = new Date(item.startDate);
        startDate.setHours(0, 0, 0, 0);
        
        // Если нет даты окончания, считаем отпуск активным если он уже начался
        if (!item.endDate) {
          if (startDate <= today) {
            return <span style={{ color: '#107c10', fontWeight: 600 }}>Активный</span>;
          } else {
            return <span style={{ color: '#0078d4' }}>Будущий</span>;
          }
        }
        
        // Для отпусков с определенной датой окончания
        const endDate = new Date(item.endDate);
        endDate.setHours(0, 0, 0, 0);
        
        if (today < startDate) {
          return <span style={{ color: '#0078d4' }}>Будущий</span>;
        } else if (today > endDate) {
          return <span style={{ color: '#666' }}>Завершен</span>;
        } else {
          return <span style={{ color: '#107c10', fontWeight: 600 }}>Активный</span>;
        }
      }
    }
  ];
  
  // Сортируем отпуска по дате начала
  const sortedLeaves = [...leaves].sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  return (
    <div style={{ marginTop: '20px' }}>
      <Text variant="large" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
        Список отпусков в текущем месяце
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
    </div>
  );
};