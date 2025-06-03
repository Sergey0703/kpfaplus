// src/webparts/kpfaplus/components/Tabs/DashboardTab/components/DashboardTable.tsx
import * as React from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn,
  Toggle,
  PrimaryButton
} from '@fluentui/react';
import { useDataContext } from '../../../../context';

// Интерфейс для расширенного staff member с состоянием autoschedule
export interface IStaffMemberWithAutoschedule {
  id: string;
  name: string;
  employeeId: string;
  autoschedule: boolean;
  deleted: number;
}

interface IDashboardTableProps {
  staffMembersData: IStaffMemberWithAutoschedule[];
  isLoading: boolean;
  onAutoscheduleToggle: (staffId: string, checked: boolean) => Promise<void>;
  onFillStaff: (staffId: string, staffName: string) => Promise<void>;
}

export const DashboardTable: React.FC<IDashboardTableProps> = (props) => {
  const {
    staffMembersData,
    isLoading,
    onAutoscheduleToggle,
    onFillStaff
  } = props;

  const { selectedDepartmentId } = useDataContext();

  console.log('[DashboardTable] Rendering with staff count:', staffMembersData.length);

  // Рендер ячейки с toggle для autoschedule
  const renderAutoscheduleCell = (item: IStaffMemberWithAutoschedule): JSX.Element => {
    return (
      <Toggle
        checked={item.autoschedule}
        onChange={(_, checked): void => {
          if (checked !== undefined) {
            // Используем .then().catch() для обработки Promise
            onAutoscheduleToggle(item.id, checked)
              .then(() => {
                console.log(`[DashboardTable] Autoschedule updated for ${item.name}`);
              })
              .catch(error => {
                console.error(`[DashboardTable] Error updating autoschedule for ${item.name}:`, error);
              });
          }
        }}
        disabled={isLoading}
      />
    );
  };

  // Рендер ячейки с кнопкой Fill
  const renderFillCell = (item: IStaffMemberWithAutoschedule): JSX.Element => {
    return (
      <PrimaryButton
        text="Fill"
        onClick={(): void => {
          // Используем .then().catch() для обработки Promise
          onFillStaff(item.id, item.name)
            .then(() => {
              console.log(`[DashboardTable] Fill completed for ${item.name}`);
            })
            .catch(error => {
              console.error(`[DashboardTable] Error in Fill for ${item.name}:`, error);
            });
        }}
        disabled={isLoading}
        styles={{
          root: {
            backgroundColor: '#0078d4',
            borderColor: '#0078d4',
            minWidth: '60px'
          }
        }}
      />
    );
  };

  // Колонки таблицы
  const columns: IColumn[] = [
    {
      key: 'name',
      name: 'Staff Member',
      fieldName: 'name',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true,
      onRender: (item: IStaffMemberWithAutoschedule): JSX.Element => (
        <span style={{ fontWeight: '500' }}>{item.name}</span>
      )
    },
    {
      key: 'id',
      name: 'ID',
      fieldName: 'id',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: IStaffMemberWithAutoschedule): JSX.Element => (
        <span style={{ fontSize: '12px', color: '#666' }}>{item.id}</span>
      )
    },
    {
      key: 'employeeId',
      name: 'Employee ID',
      fieldName: 'employeeId',
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: IStaffMemberWithAutoschedule): JSX.Element => (
        <span style={{ fontSize: '12px', color: '#666' }}>{item.employeeId}</span>
      )
    },
    {
      key: 'autoschedule',
      name: 'Autoschedule',
      minWidth: 100,
      maxWidth: 120,
      onRender: renderAutoscheduleCell
    },
    {
      key: 'fill',
      name: 'Action',
      minWidth: 80,
      maxWidth: 100,
      onRender: renderFillCell
    }
  ];

  return (
    <div style={{ flex: 1 }}>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing {staffMembersData.length} active staff members (deleted staff excluded)
      </p>
      
      {staffMembersData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>No active staff members found in the selected department.</p>
          <p style={{ fontSize: '12px', color: '#666' }}>
            Department ID: {selectedDepartmentId}
          </p>
        </div>
      ) : (
        <DetailsList
          items={staffMembersData}
          columns={columns}
          layoutMode={DetailsListLayoutMode.justified}
          selectionMode={SelectionMode.none}
          isHeaderVisible={true}
          compact={true}
        />
      )}
    </div>
  );
};