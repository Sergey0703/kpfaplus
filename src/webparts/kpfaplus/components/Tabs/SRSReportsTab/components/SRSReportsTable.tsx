// src/webparts/kpfaplus/components/Tabs/SRSReportsTab/components/SRSReportsTable.tsx
import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@fluentui/react';
import { IStaffMember } from '../../../../models/types';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { ContractsService } from '../../../../services/ContractsService';
import { StaffRecordsService, IStaffRecord } from '../../../../services/StaffRecordsService';
import { IContract } from '../../../../models/IContract';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { LeaveDataProcessor } from '../LeaveDataProcessor';
import { ExpandableLeaveTable } from './ExpandableLeaveTable';
// Импортируем недостающий тип
import {
  ISRSReportData,
  ISRSGroupingParams,
  ISRSGroupingResult,
  ISRSTableRow
} from '../interfaces/ISRSReportsInterfaces';

interface ISRSReportsTableProps {
  staffMembers: IStaffMember[];
  selectedStaffId: string; // '' для всех сотрудников
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
  selectedTypeFilter: string;
  typesOfLeave: ITypeOfLeave[];
  isLoading: boolean;
  // Props для работы с контрактами и данными
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
}

// Интерфейс для объединенных данных контракта с записями отпусков
interface IContractWithLeaveRecords {
  contract: IContract;
  staffMember: IStaffMember;
  leaveRecords: IStaffRecord[];
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

  // СУЩЕСТВУЮЩЕЕ СОСТОЯНИЕ для контрактов (сохраняем как есть)
  const [contractsData, setContractsData] = useState<{ [staffId: string]: IContract[] }>({});
  const [isLoadingContracts, setIsLoadingContracts] = useState<boolean>(false);

  // НОВЫЕ СОСТОЯНИЯ для StaffRecords и обработанных данных
  const [staffRecordsData, setStaffRecordsData] = useState<IStaffRecord[]>([]);
  const [isLoadingStaffRecords, setIsLoadingStaffRecords] = useState<boolean>(false);
  const [processedData, setProcessedData] = useState<ISRSReportData[]>([]);
  const [processingError, setProcessingError] = useState<string>('');

  // СУЩЕСТВУЮЩИЕ СЕРВИСЫ (сохраняем как есть)
  const contractsService = useMemo(() => {
    return context ? ContractsService.getInstance(context) : undefined;
  }, [context]);

  // НОВЫЕ СЕРВИСЫ
  const staffRecordsService = useMemo(() => {
    return context ? StaffRecordsService.getInstance(context) : undefined;
  }, [context]);

  const leaveDataProcessor = useMemo(() => {
    return new LeaveDataProcessor();
  }, []);

  // СУЩЕСТВУЮЩАЯ ЛОГИКА: Вычисляем фильтрованных сотрудников (сохраняем как есть)
  const filteredStaffMembers = useMemo(() => {
    return selectedStaffId === '' 
      ? staffMembers.filter((staff: IStaffMember) => staff.deleted !== 1) // Все активные сотрудники
      : staffMembers.filter((staff: IStaffMember) => staff.id === selectedStaffId && staff.deleted !== 1); // Конкретный сотрудник
  }, [staffMembers, selectedStaffId]);

  // СУЩЕСТВУЮЩИЙ useEffect: Загружаем контракты для отфильтрованных сотрудников (сохраняем как есть)
  useEffect(() => {
    const fetchContractsForStaff = async (): Promise<void> => {
      if (!contractsService || staffMembers.length === 0) {
        return;
      }

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

        // Загружаем контракты для каждого сотрудника (СУЩЕСТВУЮЩАЯ ЛОГИКА)
        for (const staff of currentFilteredStaff) {
          if (staff.employeeId && currentUserId && managingGroupId) {
            try {
              const contracts = await contractsService.getContractsForStaffMember(
                staff.employeeId,
                currentUserId,
                managingGroupId
              );
              
              // Фильтруем только НЕ удаленные контракты и проверяем пересечение с периодом (СУЩЕСТВУЮЩАЯ ЛОГИКА)
              const activeContracts = contracts.filter((contract: IContract) => {
                const deletedValue = typeof contract.isDeleted === 'number' 
                  ? contract.isDeleted 
                  : (contract.isDeleted ? 1 : 0);
                
                if (deletedValue === 1) {
                  return false;
                }
                
                if (!contract.startDate) {
                  return false;
                }
                
                // Проверяем пересечение с выбранным периодом (СУЩЕСТВУЮЩАЯ ЛОГИКА)
                const contractStart = new Date(contract.startDate);
                const contractEnd = contract.finishDate ? new Date(contract.finishDate) : null;
                const periodStart = selectedPeriodStart;
                const periodEnd = selectedPeriodEnd;
                
                if (contractStart < periodStart && !contractEnd) return true;
                if (contractStart < periodStart && contractEnd && contractEnd >= periodStart) return true;
                if (contractStart >= periodStart && contractStart <= periodEnd) return true;
                if (contractEnd && contractStart >= periodStart && contractEnd <= periodEnd) return true;
                if (contractStart <= periodStart && contractEnd && contractEnd >= periodEnd) return true;
                
                return false;
              });
              
              contractsMap[staff.id] = activeContracts;
              
              console.log(`[SRSReportsTable] Loaded ${activeContracts.length} relevant contracts for ${staff.name}`);
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
  }, [staffMembers, selectedStaffId, contractsService, currentUserId, managingGroupId, selectedPeriodStart, selectedPeriodEnd]);

  // НОВЫЙ useEffect: Загружаем StaffRecords с типом отпуска
  useEffect(() => {
    const fetchStaffRecordsData = async (): Promise<void> => {
      if (!staffRecordsService || !context) {
        console.log('[SRSReportsTable] StaffRecordsService или context недоступны');
        return;
      }

      if (filteredStaffMembers.length === 0) {
        console.log('[SRSReportsTable] Нет сотрудников для загрузки записей отпусков');
        setStaffRecordsData([]);
        return;
      }

      setIsLoadingStaffRecords(true);
      setProcessingError('');
      console.log('[SRSReportsTable] Загрузка StaffRecords с типом отпуска...');

      try {
        // Параметры запроса для получения записей с типом отпуска
        const queryParams = {
          startDate: selectedPeriodStart,
          endDate: selectedPeriodEnd,
          currentUserID: currentUserId || '',
          staffGroupID: managingGroupId || '',
          employeeID: selectedStaffId === '' ? '' : selectedStaffId // Пустой для всех сотрудников
        };

        console.log('[SRSReportsTable] Параметры запроса StaffRecords:', queryParams);

        // Используем новый метод для получения записей с типом отпуска
        const result = await staffRecordsService.getStaffRecordsForSRSReports(queryParams);

        if (result.error) {
          const errorMsg = `Ошибка загрузки записей отпусков: ${result.error}`;
          console.error('[SRSReportsTable]', errorMsg);
          setProcessingError(errorMsg);
          setStaffRecordsData([]);
        } else {
          console.log(`[SRSReportsTable] Загружено ${result.records.length} записей отпусков с типом отпуска`);
          setStaffRecordsData(result.records);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[SRSReportsTable] Ошибка при загрузке записей отпусков:', errorMessage);
        setProcessingError(`Не удалось загрузить записи отпусков: ${errorMessage}`);
        setStaffRecordsData([]);
      } finally {
        setIsLoadingStaffRecords(false);
      }
    };

    fetchStaffRecordsData()
      .then(() => {
        console.log('[SRSReportsTable] Загрузка записей отпусков завершена');
      })
      .catch((error) => {
        console.error('[SRSReportsTable] Ошибка в fetchStaffRecordsData:', error);
      });
  }, [
    staffRecordsService, 
    context, 
    filteredStaffMembers, 
    selectedPeriodStart, 
    selectedPeriodEnd, 
    selectedStaffId, 
    currentUserId, 
    managingGroupId
  ]);

  // НОВЫЙ useEffect: Объединяем контракты с записями отпусков и обрабатываем данные
  useEffect(() => {
    const processContractsWithLeaveRecords = (): void => {
      if (Object.keys(contractsData).length === 0 || staffRecordsData.length === 0) {
        console.log('[SRSReportsTable] Недостаточно данных для объединения - контракты или записи отпусков отсутствуют');
        setProcessedData([]);
        return;
      }

      console.log('[SRSReportsTable] Объединение контрактов с записями отпусков...');

      try {
        const contractsWithLeaveRecords: IContractWithLeaveRecords[] = [];

        // Объединяем контракты с записями отпусков
        filteredStaffMembers.forEach(staff => {
          const staffContracts = contractsData[staff.id] || [];
          
          staffContracts.forEach(contract => {
            // Находим записи отпусков, относящиеся к этому контракту
            const contractLeaveRecords = staffRecordsData.filter(record => {
              // Проверяем, что запись принадлежит этому сотруднику
              const recordStaffId = record.StaffMemberLookupId || record.ID;
              const belongsToStaff = recordStaffId === staff.id || recordStaffId === staff.employeeId;
              
              if (!belongsToStaff) {
                return false;
              }

              // Проверяем, что запись попадает в период действия контракта
              if (!record.Date || !contract.startDate) {
                return false;
              }

              const recordDate = new Date(record.Date);
              const contractStart = new Date(contract.startDate);
              const contractEnd = contract.finishDate ? new Date(contract.finishDate) : new Date('2099-12-31');

              return recordDate >= contractStart && recordDate <= contractEnd;
            });

            console.log(`[SRSReportsTable] Контракт ${contract.template} для ${staff.name}: ${contractLeaveRecords.length} записей отпуска`);

            contractsWithLeaveRecords.push({
              contract,
              staffMember: staff,
              leaveRecords: contractLeaveRecords
            });
          });

          // Если у сотрудника нет контрактов, но есть записи отпусков, создаем "виртуальный" контракт
          if (staffContracts.length === 0) {
            const staffLeaveRecords = staffRecordsData.filter(record => {
              const recordStaffId = record.StaffMemberLookupId || record.ID;
              return recordStaffId === staff.id || recordStaffId === staff.employeeId;
            });

            if (staffLeaveRecords.length > 0) {
              console.log(`[SRSReportsTable] Создание виртуального контракта для ${staff.name}: ${staffLeaveRecords.length} записей отпуска`);

              const virtualContract: IContract = {
                id: `virtual_${staff.id}`,
                template: 'No Contract',
                startDate: selectedPeriodStart,
                finishDate: selectedPeriodEnd,
                contractedHours: 0,
                isDeleted: false,
                typeOfWorker: { id: 'unknown', value: 'Unknown' } // Объект с id и value
              };

              contractsWithLeaveRecords.push({
                contract: virtualContract,
                staffMember: staff,
                leaveRecords: staffLeaveRecords
              });
            }
          }
        });

        console.log(`[SRSReportsTable] Объединено ${contractsWithLeaveRecords.length} контрактов с записями отпусков`);

        // Теперь обрабатываем объединенные данные через LeaveDataProcessor
        if (contractsWithLeaveRecords.length === 0) {
          console.log('[SRSReportsTable] Нет данных для обработки после объединения');
          setProcessedData([]);
          return;
        }

        // Создаем ISRSReportData для каждого контракта с записями отпусков
        const reportDataList: ISRSReportData[] = [];

        contractsWithLeaveRecords.forEach(({ contract, staffMember, leaveRecords }) => {
          if (leaveRecords.length === 0) {
            // Пропускаем контракты без записей отпусков
            return;
          }

          // Применяем фильтр по типу отпуска, если задан
          const filteredLeaveRecords = selectedTypeFilter === '' 
            ? leaveRecords 
            : leaveRecords.filter(record => record.TypeOfLeaveID === selectedTypeFilter);

          if (filteredLeaveRecords.length === 0) {
            return;
          }

          // Используем LeaveDataProcessor для обработки записей этого контракта
          const groupingParams: ISRSGroupingParams = {
            staffRecords: filteredLeaveRecords,
            periodStart: selectedPeriodStart,
            periodEnd: selectedPeriodEnd,
            typeOfLeaveFilter: selectedTypeFilter === '' ? undefined : selectedTypeFilter,
            typesOfLeave: typesOfLeave
          };

          const result: ISRSGroupingResult = leaveDataProcessor.processStaffRecords(groupingParams);

          // Преобразуем результат в данные с информацией о контракте
          if (result.reportData.length > 0) {
            // Берем первый элемент результата и обогащаем его данными контракта
            const processedContract = result.reportData[0];
            
            const enhancedReportData: ISRSReportData = {
              ...processedContract,
              id: `${staffMember.id}_${contract.id}`,
              staffId: staffMember.id,
              staffName: staffMember.name,
              contractId: contract.id,
              contractName: contract.template || 'Unnamed Contract',
              contractedHours: contract.contractedHours || 0
            };

            reportDataList.push(enhancedReportData);
          }
        });

        console.log(`[SRSReportsTable] Обработано ${reportDataList.length} контрактов с данными отпусков`);
        setProcessedData(reportDataList);
        setProcessingError('');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[SRSReportsTable] Ошибка при объединении и обработке данных:', errorMessage);
        setProcessingError(`Ошибка обработки данных: ${errorMessage}`);
        setProcessedData([]);
      }
    };

    processContractsWithLeaveRecords();
  }, [
    contractsData,
    staffRecordsData,
    filteredStaffMembers,
    selectedPeriodStart,
    selectedPeriodEnd,
    selectedTypeFilter,
    typesOfLeave,
    leaveDataProcessor
  ]);

  // Обработчики для ExpandableLeaveTable
  const handleExpandToggle = (rowId: string, isExpanded: boolean): void => {
    console.log('[SRSReportsTable] Expand toggle:', rowId, isExpanded);
    // Здесь можно добавить дополнительную логику при разворачивании строк
  };

  const handleRowClick = (row: ISRSTableRow): void => {
    console.log('[SRSReportsTable] Row clicked:', row);
    // Здесь можно добавить логику обработки клика по строке
  };

  // Обработка состояний загрузки
  if (isLoading || isLoadingContracts || isLoadingStaffRecords) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <Spinner size={1} />
        <p style={{ marginTop: '10px', color: '#666' }}>
          {isLoading && 'Loading SRS reports data...'}
          {isLoadingContracts && 'Loading contracts...'}
          {isLoadingStaffRecords && 'Loading leave records...'}
        </p>
      </div>
    );
  }

  // Обработка ошибок
  if (processingError) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p style={{ color: '#d83b01', marginBottom: '10px' }}>
          Error processing SRS reports data
        </p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          {processingError}
        </p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Try adjusting your filters or refresh the page.
        </p>
      </div>
    );
  }

  // Обработка отсутствия данных
  if (filteredStaffMembers.length === 0) {
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

  // Статистика для отладки
  const totalContracts = Object.values(contractsData).reduce((sum, contracts) => sum + contracts.length, 0);
  
  if (processedData.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <p>No leave records found that match contracts for the selected period.</p>
        <p style={{ fontSize: '12px', color: '#666' }}>
          Staff members: {filteredStaffMembers.length} | 
          Contracts: {totalContracts} | 
          Leave records: {staffRecordsData.length}
        </p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Period: {selectedPeriodStart.toLocaleDateString()} - {selectedPeriodEnd.toLocaleDateString()}
          {selectedTypeFilter && ` | Type: ${typesOfLeave.find(t => t.id === selectedTypeFilter)?.title || selectedTypeFilter}`}
        </p>
        <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Try selecting a different period or leave type filter.
        </p>
      </div>
    );
  }

  console.log('[SRSReportsTable] Rendering ExpandableLeaveTable with', processedData.length, 'processed contracts');

  // Отображение основной таблицы
  return (
    <div>
      <div style={{ marginBottom: '15px' }}>
        <p style={{ fontSize: '12px', color: '#666', margin: '0' }}>
          <strong>SRS Reports Summary:</strong> {filteredStaffMembers.length} staff member(s) | 
          {totalContracts} contract(s) | 
          {staffRecordsData.length} leave record(s) | 
          {processedData.length} contract(s) with leave data
        </p>
        <p style={{ fontSize: '11px', color: '#999', margin: '5px 0 0 0' }}>
          Period: {selectedPeriodStart.toLocaleDateString()} - {selectedPeriodEnd.toLocaleDateString()}
          {selectedTypeFilter && ` | Type: ${typesOfLeave.find(t => t.id === selectedTypeFilter)?.title || selectedTypeFilter}`}
        </p>
      </div>

      <ExpandableLeaveTable
        reportData={processedData}
        isLoading={false} // Мы уже обработали загрузку выше
        onExpandToggle={handleExpandToggle}
        onRowClick={handleRowClick}
      />
    </div>
  );
};