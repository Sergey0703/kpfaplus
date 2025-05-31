// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/components/SRSReportsTable.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn
} from '@fluentui/react';
import { IStaffMember } from '../../../../models/types';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { ContractsService } from '../../../../services/ContractsService';
import { IContract } from '../../../../models/IContract';
import { WebPartContext } from '@microsoft/sp-webpart-base';

// Интерфейс для строки данных в таблице SRS Reports
interface ISRSReportRow {
  staffId: string;
  staffName: string;
  contract: string;
  contractedHours: number;
  annualLeaveFromPrevious: number;
  dateColumn: string; // Новая колонка для даты (пока пустая)
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
  // Новые props для работы с контрактами
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
}

export const SRSReportsTable: React.FC<ISRSReportsTableProps> = (props) => {
  const {
    staffMembers,
    selectedStaffId,
    selectedPeriodStart,
    selectedPeriodEnd,
    selectedTypeFilter,
    typesOfLeave,
    isLoading,
    context,
    currentUserId,
    managingGroupId
  } = props;

  console.log('[SRSReportsTable] Rendering with props:', {
    staffMembersCount: staffMembers.length,
    selectedStaffId,
    periodStart: selectedPeriodStart.toLocaleDateString(),
    periodEnd: selectedPeriodEnd.toLocaleDateString(),
    selectedTypeFilter,
    isLoading
  });

  // Состояние для контрактов
  const [contractsData, setContractsData] = useState<{ [staffId: string]: IContract[] }>({});
  const [isLoadingContracts, setIsLoadingContracts] = useState<boolean>(false);

  // Инициализируем сервис контрактов
  const contractsService = useMemo(() => {
    return context ? ContractsService.getInstance(context) : undefined;
  }, [context]);

  // Вычисляем фильтрованных сотрудников внутри рендера (не в состоянии)
  const filteredStaffMembers = useMemo(() => {
    return selectedStaffId === '' 
      ? staffMembers.filter((staff: IStaffMember) => staff.deleted !== 1) // Все активные сотрудники
      : staffMembers.filter((staff: IStaffMember) => staff.id === selectedStaffId && staff.deleted !== 1); // Конкретный сотрудник
  }, [staffMembers, selectedStaffId]);

  // Загружаем контракты для отфильтрованных сотрудников
  useEffect(() => {
    const fetchContractsForStaff = async (): Promise<void> => {
      if (!contractsService || staffMembers.length === 0) {
        return;
      }

      // Вычисляем фильтрованных сотрудников внутри useEffect
      const currentFilteredStaff = selectedStaffId === '' 
        ? staffMembers.filter((staff: IStaffMember) => staff.deleted !== 1)
        : staffMembers.filter((staff: IStaffMember) => staff.id === selectedStaffId && staff.deleted !== 1);

      if (currentFilteredStaff.length === 0) {
        setContractsData({});
        return;
      }

      setIsLoadingContracts(true);
      console.log('[SRSReportsTable] Loading contracts for staff members:', currentFilteredStaff.length);

      try {
        const contractsMap: { [staffId: string]: IContract[] } = {};

        // Загружаем контракты для каждого сотрудника
        for (const staff of currentFilteredStaff) {
          if (staff.employeeId && currentUserId && managingGroupId) {
            try {
              const contracts = await contractsService.getContractsForStaffMember(
                staff.employeeId,
                currentUserId,
                managingGroupId
              );
              
              // Фильтруем только НЕ удаленные контракты (Deleted !== 1)
              // Поле isDeleted числовое: 0 = активный, 1 = удаленный
              const activeContracts = contracts.filter((contract: IContract) => {
                // Приводим к числу для безопасного сравнения
                const deletedValue = typeof contract.isDeleted === 'number' 
                  ? contract.isDeleted 
                  : (contract.isDeleted ? 1 : 0);
                
                // Исключаем удаленные контракты
                if (deletedValue === 1) {
                  return false;
                }
                
                // Исключаем контракты без даты начала
                if (!contract.startDate) {
                  return false;
                }
                
                // Проверяем пересечение с выбранным периодом
                const contractStart = new Date(contract.startDate);
                const contractEnd = contract.finishDate ? new Date(contract.finishDate) : null;
                const periodStart = selectedPeriodStart;
                const periodEnd = selectedPeriodEnd;
                
                // Случай 1: Контракт начался раньше выбранного периода и не закрыт
                if (contractStart < periodStart && !contractEnd) {
                  return true;
                }
                
                // Случай 2: Контракт начался раньше выбранного периода и закрывается после или во время периода
                if (contractStart < periodStart && contractEnd && contractEnd >= periodStart) {
                  return true;
                }
                
                // Случай 3: Дата начала контракта в выбранном периоде
                if (contractStart >= periodStart && contractStart <= periodEnd) {
                  return true;
                }
                
                // Случай 4: Весь срок контракта в выбранном периоде
                if (contractEnd && contractStart >= periodStart && contractEnd <= periodEnd) {
                  return true;
                }
                
                // Случай 5: Контракт покрывает весь выбранный период
                if (contractStart <= periodStart && contractEnd && contractEnd >= periodEnd) {
                  return true;
                }
                
                // Во всех остальных случаях не включаем контракт
                return false;
              });
              
              contractsMap[staff.id] = activeContracts;
              
              console.log(`[SRSReportsTable] Loaded ${activeContracts.length} relevant contracts for ${staff.name} (total: ${contracts.length}) for period ${selectedPeriodStart.toLocaleDateString()} - ${selectedPeriodEnd.toLocaleDateString()}`);
              
              // Логируем детали каждого контракта для отладки
              activeContracts.forEach(contract => {
                const startStr = contract.startDate ? new Date(contract.startDate).toLocaleDateString() : 'No start';
                const endStr = contract.finishDate ? new Date(contract.finishDate).toLocaleDateString() : 'Open';
                console.log(`  - Contract "${contract.template}": ${startStr} - ${endStr}`);
              });
            } catch (error) {
              console.error(`[SRSReportsTable] Error loading contracts for ${staff.name}:`, error);
              contractsMap[staff.id] = [];
            }
          } else {
            contractsMap[staff.id] = [];
          }
        }

        setContractsData(contractsMap);
      } catch (error) {
        console.error('[SRSReportsTable] Error loading contracts:', error);
      } finally {
        setIsLoadingContracts(false);
      }
    };

    fetchContractsForStaff()
      .then(() => {
        console.log('[SRSReportsTable] Contracts loading completed');
      })
      .catch((error) => {
        console.error('[SRSReportsTable] Error in contracts loading:', error);
      });
  }, [staffMembers, selectedStaffId, contractsService, currentUserId, managingGroupId, selectedPeriodStart, selectedPeriodEnd]); // Добавили периоды в зависимости

  // Генерируем данные для таблицы на основе реальных контрактов
  const generateSRSReportData = (): ISRSReportRow[] => {
    const rows: ISRSReportRow[] = [];
    
    filteredStaffMembers.forEach((staff: IStaffMember) => {
      const staffContracts = contractsData[staff.id] || [];
      
      if (staffContracts.length === 0) {
        // Если у сотрудника нет контрактов, создаем одну строку с "No Contract"
        const previousLeave = Math.floor(Math.random() * 50) + 20; // 20-70 часов
        const monthlyData = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
        const totalUsed = monthlyData.reduce((sum, val) => sum + val, 0);
        const balance = previousLeave - totalUsed;

        rows.push({
          staffId: staff.id,
          staffName: staff.name,
          contract: 'No Contract',
          contractedHours: 0,
          annualLeaveFromPrevious: previousLeave,
          dateColumn: '', // Пустая колонка для даты
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
        });
      } else {
        // Создаем отдельную строку для каждого контракта
        staffContracts.forEach((contract, contractIndex) => {
          const previousLeave = Math.floor(Math.random() * 50) + 20; // 20-70 часов
          const monthlyData = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
          const totalUsed = monthlyData.reduce((sum, val) => sum + val, 0);
          const balance = previousLeave - totalUsed;

          rows.push({
            staffId: `${staff.id}_${contract.id}`, // Уникальный ID для строки
            staffName: staff.name, // Показываем имя во всех строках
            contract: contract.template || 'Unnamed Contract',
            contractedHours: contract.contractedHours || 0,
            annualLeaveFromPrevious: previousLeave,
            dateColumn: '', // Пустая колонка для даты
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
          });
        });
      }
    });
    
    return rows;
  };

  const reportData = generateSRSReportData();

  console.log('[SRSReportsTable] Generated report data:', {
    reportRowsCount: reportData.length,
    contractsDataKeys: Object.keys(contractsData),
    isLoadingContracts,
    totalContracts: Object.values(contractsData).reduce((sum, contracts) => sum + contracts.length, 0),
    reportRows: reportData.map(row => ({ staffName: row.staffName, contract: row.contract, hours: row.contractedHours }))
  });

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

  if (isLoading || isLoadingContracts) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading SRS reports data...</p>
        {isLoadingContracts && <p style={{ fontSize: '12px', color: '#666' }}>Loading contracts...</p>}
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