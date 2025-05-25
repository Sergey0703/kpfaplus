// ============================================================================
// 4. src/webparts/kpfaplus/components/Tabs/LeavesTab/components/LeavesTable.tsx
// ============================================================================
import * as React from 'react';
import { DetailsList, DetailsListLayoutMode, SelectionMode, IColumn } from '@fluentui/react';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';

interface ILeavesTableProps {
  leaves: ILeaveDay[];
  typesOfLeave: ITypeOfLeave[];
  isLoading: boolean;
  showDeleted: boolean;
  selectedTypeFilter: string;
}

export const LeavesTable: React.FC<ILeavesTableProps> = (props) => {
  const { leaves, typesOfLeave, isLoading, showDeleted, selectedTypeFilter } = props;

  console.log('[LeavesTable] Rendering with leaves:', leaves.length, 'types:', typesOfLeave.length);

  // Функция для получения названия типа отпуска
  const getTypeOfLeaveTitle = (typeId: number): string => {
    const type = typesOfLeave.find(t => t.id === typeId.toString());
    return type ? type.title : `Type ${typeId}`;
  };

  // Фильтрация отпусков
  const filteredLeaves = leaves.filter(leave => {
    // Фильтр по удаленным записям
    if (!showDeleted && leave.deleted) {
      return false;
    }
    
    // Фильтр по типу отпуска
    if (selectedTypeFilter && leave.typeOfLeave.toString() !== selectedTypeFilter) {
      return false;
    }
    
    return true;
  });

  // Колонки таблицы
  const columns: IColumn[] = [
    {
      key: 'startDate',
      name: 'Start Date',
      fieldName: 'startDate',
      minWidth: 120,
      maxWidth: 150,
      onRender: (item: ILeaveDay) => item.startDate.toLocaleDateString()
    },
    {
      key: 'endDate',
      name: 'End Date',
      fieldName: 'endDate',
      minWidth: 120,
      maxWidth: 150,
      onRender: (item: ILeaveDay) => item.endDate ? item.endDate.toLocaleDateString() : 'Open'
    },
    {
      key: 'typeOfLeave',
      name: 'Type of Leave',
      fieldName: 'typeOfLeave',
      minWidth: 150,
      maxWidth: 200,
      onRender: (item: ILeaveDay) => getTypeOfLeaveTitle(item.typeOfLeave)
    },
    {
      key: 'title',
      name: 'Notes',
      fieldName: 'title',
      minWidth: 200,
      isResizable: true
    },
    {
      key: 'deleted',
      name: 'Status',
      fieldName: 'deleted',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: ILeaveDay) => (
        <span style={{ color: item.deleted ? 'red' : 'green' }}>
          {item.deleted ? 'Deleted' : 'Active'}
        </span>
      )
    }
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading leaves data...</p>
      </div>
    );
  }

  if (filteredLeaves.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No leaves found for the selected criteria.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Total leaves loaded: {leaves.length} | 
          After filters: {filteredLeaves.length} | 
          Types available: {typesOfLeave.length}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing {filteredLeaves.length} of {leaves.length} leave records
      </p>
      <DetailsList
        items={filteredLeaves}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={false}
      />
    </div>
  );
};
