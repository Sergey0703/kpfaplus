// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/components/SRSReportsTable.tsx
import * as React from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn
} from '@fluentui/react';
import { IStaffMember } from '../../../../models/types';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';

// Интерфейс для строки данных в таблице SRS Reports
interface ISRSReportRow {
  staffId: string;
  staffName: string;
  contract: string;
  contractedHours: number;
  annualLeaveFromPrevious: number;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  balanceRemainingInHrs: number;
}

interface ISRSReportsTableProps {
  staffMembers: IStaffMember[];
  selectedStaffId: string; // '' для всех сотрудников
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
  selectedTypeFilter: string;
  typesOfLeave: ITypeOfLeave[];
  isLoading: boolean;
}

export const SRSReportsTable: React.FC<ISRSReportsTableProps> = (props) => {
  const {
    staffMembers,
    selectedStaffId,
    selectedPeriodStart,
    selectedPeriodEnd,
    selectedTypeFilter,
    typesOfLeave,
    isLoading
  } = props;

  console.log('[SRSReportsTable] Rendering with props:', {
    staffMembersCount: staffMembers.length,
    selectedStaffId,
    periodStart: selectedPeriodStart.toLocaleDateString(),
    periodEnd: selectedPeriodEnd.toLocaleDateString(),
    selectedTypeFilter,
    isLoading
  });

  // Фильтруем сотрудников в зависимости от выбора
  const filteredStaffMembers = selectedStaffId === '' 
    ? staffMembers.filter(staff => staff.deleted !== 1) // Все активные сотрудники
    : staffMembers.filter(staff => staff.id === selectedStaffId && staff.deleted !== 1); // Конкретный сотрудник

  // Генерируем тестовые данные для таблицы
  const generateSRSReportData = (): ISRSReportRow[] => {
    return filteredStaffMembers.map((staff, index) => {
      // Генерируем случайные данные для демонстрации
      const contractedHours = 40 + (index * 2); // Варьируем часы
      const previousLeave = Math.floor(Math.random() * 50) + 20; // 20-70 часов
      
      // Генерируем данные по месяцам (случайные значения для демонстрации)
      const monthlyData = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
      
      const totalUsed = monthlyData.reduce((sum, val) => sum + val, 0);
      const balance = previousLeave - totalUsed;

      return {
        staffId: staff.id,
        staffName: staff.name,
        contract: 'Staff Member', // Используем статическое значение пока нет поля с должностью
        contractedHours: contractedHours,
        annualLeaveFromPrevious: previousLeave,
        jan: monthlyData[0],
        feb: monthlyData[1],
        mar: monthlyData[2],
        apr: monthlyData[3],
        may: monthlyData[4],
        jun: monthlyData[5],
        jul: monthlyData[6],
        aug: monthlyData[7],
        sep: monthlyData[8],
        oct: monthlyData[9],
        nov: monthlyData[10],
        dec: monthlyData[11],
        balanceRemainingInHrs: balance
      };
    });
  };

  const reportData = generateSRSReportData();

  // Определяем колонки таблицы
  const columns: IColumn[] = [
    {
      key: 'staffName',
      name: 'StaffName',
      fieldName: 'staffName',
      minWidth: 150,
      maxWidth: 200,
      isResizable: true,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ fontWeight: '600' }}>{item.staffName}</span>
      )
    },
    {
      key: 'contract',
      name: 'Contract',
      fieldName: 'contract',
      minWidth: 120,
      maxWidth: 150,
      isResizable: true
    },
    {
      key: 'contractedHours',
      name: 'Contracted Hours',
      fieldName: 'contractedHours',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.contractedHours}</span>
      )
    },
    {
      key: 'annualLeaveFromPrevious',
      name: 'Annual Leave from previous',
      fieldName: 'annualLeaveFromPrevious',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block', fontWeight: '600', color: '#0078d4' }}>
          {item.annualLeaveFromPrevious}
        </span>
      )
    },
    // Месячные колонки
    {
      key: 'jan',
      name: 'Jan',
      fieldName: 'jan',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.jan}</span>
      )
    },
    {
      key: 'feb',
      name: 'Feb',
      fieldName: 'feb',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.feb}</span>
      )
    },
    {
      key: 'mar',
      name: 'Mar',
      fieldName: 'mar',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.mar}</span>
      )
    },
    {
      key: 'apr',
      name: 'Apr',
      fieldName: 'apr',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.apr}</span>
      )
    },
    {
      key: 'may',
      name: 'May',
      fieldName: 'may',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.may}</span>
      )
    },
    {
      key: 'jun',
      name: 'Jun',
      fieldName: 'jun',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.jun}</span>
      )
    },
    {
      key: 'jul',
      name: 'Jul',
      fieldName: 'jul',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.jul}</span>
      )
    },
    {
      key: 'aug',
      name: 'Aug',
      fieldName: 'aug',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.aug}</span>
      )
    },
    {
      key: 'sep',
      name: 'Sep',
      fieldName: 'sep',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.sep}</span>
      )
    },
    {
      key: 'oct',
      name: 'Oct',
      fieldName: 'oct',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.oct}</span>
      )
    },
    {
      key: 'nov',
      name: 'Nov',
      fieldName: 'nov',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.nov}</span>
      )
    },
    {
      key: 'dec',
      name: 'Dec',
      fieldName: 'dec',
      minWidth: 50,
      maxWidth: 60,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ textAlign: 'center', display: 'block' }}>{item.dec}</span>
      )
    },
    {
      key: 'balanceRemainingInHrs',
      name: 'Balance remaining in hrs',
      fieldName: 'balanceRemainingInHrs',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: ISRSReportRow): JSX.Element => (
        <span style={{ 
          textAlign: 'center', 
          display: 'block', 
          fontWeight: '600',
          color: item.balanceRemainingInHrs < 0 ? '#d83b01' : '#107c10'
        }}>
          {item.balanceRemainingInHrs}
        </span>
      )
    }
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading SRS reports data...</p>
      </div>
    );
  }

  if (reportData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No staff members found for the selected criteria.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Selected staff: {selectedStaffId === '' ? 'All Staff Members' : 'Individual'} | 
          Period: {selectedPeriodStart.toLocaleDateString()} - {selectedPeriodEnd.toLocaleDateString()}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: '12px', color: '#666', marginBottom: '10px' }}>
        Showing SRS reports for {reportData.length} staff member(s) | 
        Period: {selectedPeriodStart.toLocaleDateString()} - {selectedPeriodEnd.toLocaleDateString()}
        {selectedTypeFilter && ` | Type: ${typesOfLeave.find(t => t.id === selectedTypeFilter)?.title || selectedTypeFilter}`}
      </p>
      
      <DetailsList
        items={reportData}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={true}
        styles={{
          root: {
            selectors: {
              '.ms-DetailsHeader': {
                backgroundColor: '#f8f9fa',
                borderBottom: '2px solid #dee2e6'
              },
              '.ms-DetailsHeader-cell': {
                fontSize: '12px',
                fontWeight: '600',
                color: '#495057'
              },
              '.ms-DetailsRow': {
                selectors: {
                  ':hover': {
                    backgroundColor: '#f8f9fa'
                  }
                }
              },
              '.ms-DetailsRow-cell': {
                fontSize: '11px',
                padding: '8px 12px'
              }
            }
          }
        }}
      />
    </div>
  );
};