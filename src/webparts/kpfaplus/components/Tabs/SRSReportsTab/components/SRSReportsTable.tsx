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
import {
  ISRSReportData,
  ISRSGroupingParams,
  ISRSGroupingResult,
  ISRSTableRow,
  IMonthlyLeaveData
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
  // Новый callback для передачи данных в родительский компонент для Excel экспорта
  onDataUpdate?: (data: ISRSReportData[]) => void;
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
    managingGroupId,
    onDataUpdate // Новый проп для передачи данных для экспорта
  } = props;

  console.log('[SRSReportsTable] Rendering with props:', {
    staffMembersCount: staffMembers.length,
    selectedStaffId,
    periodStart: selectedPeriodStart.toLocaleDateString(),
    periodEnd: selectedPeriodEnd.toLocaleDateString(),
    selectedTypeFilter,
    isLoading,
    hasOnDataUpdate: !!onDataUpdate
  });

  // Состояния для контрактов
  const [contractsData, setContractsData] = useState<{ [staffId: string]: IContract[] }>({});
  const [isLoadingContracts, setIsLoadingContracts] = useState<boolean>(false);

  // Состояния для StaffRecords и обработанных данных
  const [staffRecordsData, setStaffRecordsData] = useState<IStaffRecord[]>([]);
  const [isLoadingStaffRecords, setIsLoadingStaffRecords] = useState<boolean>(false);
  const [processedData, setProcessedData] = useState<ISRSReportData[]>([]);
  const [processingError, setProcessingError] = useState<string>('');

  // Сервисы
  const contractsService = useMemo(() => {
    return context ? ContractsService.getInstance(context) : undefined;
  }, [context]);

  const staffRecordsService = useMemo(() => {
    return context ? StaffRecordsService.getInstance(context) : undefined;
  }, [context]);

  const leaveDataProcessor = useMemo(() => {
    return new LeaveDataProcessor();
  }, []);

  // Вычисляем фильтрованных сотрудников
  const filteredStaffMembers = useMemo(() => {
    return selectedStaffId === '' 
      ? staffMembers.filter((staff: IStaffMember) => staff.deleted !== 1) // Все активные сотрудники
      : staffMembers.filter((staff: IStaffMember) => staff.id === selectedStaffId && staff.deleted !== 1); // Конкретный сотрудник
  }, [staffMembers, selectedStaffId]);

  // Поиск employeeId по selectedStaffId
  const getEmployeeIdByStaffId = (staffId: string): string => {
    if (staffId === '') {
      return ''; // Для "All Staff"
    }
    
    const staff = filteredStaffMembers.find(s => s.id === staffId);
    return staff?.employeeId || '';
  };

  // Вспомогательные функции - ИСПРАВЛЕНО: добавлены типы возврата
  const calculateAnnualLeaveFromPrevious = (): number => {
    // ИСПРАВЛЕНО: Всегда возвращаем 0 вместо вычислений
    return 0;
  };

  const createEmptyMonthlyData = (): IMonthlyLeaveData => ({
    jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0,
    jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0
  });

  // Загружаем контракты для отфильтрованных сотрудников
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

        // Загружаем контракты для каждого сотрудника
        for (const staff of currentFilteredStaff) {
          if (staff.employeeId && currentUserId && managingGroupId) {
            try {
              const contracts = await contractsService.getContractsForStaffMember(
                staff.employeeId,
                currentUserId,
                managingGroupId
              );
              
              // Фильтруем только НЕ удаленные контракты и проверяем пересечение с периодом
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
                
                // Проверяем пересечение с выбранным периодом
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

  // Загружаем StaffRecords с типом отпуска
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

      // Загружаем записи отпусков только если выбран тип отпуска
      if (!selectedTypeFilter || selectedTypeFilter === '') {
        console.log('[SRSReportsTable] Тип отпуска не выбран, записи отпусков не загружаются');
        setStaffRecordsData([]);
        return;
      }

      setIsLoadingStaffRecords(true);
      setProcessingError('');
      console.log('[SRSReportsTable] Загрузка StaffRecords с типом отпуска:', selectedTypeFilter);

      try {
        // Параметры запроса для получения записей с типом отпуска
        const queryParams = {
          startDate: selectedPeriodStart,
          endDate: selectedPeriodEnd,
          currentUserID: currentUserId || '',
          staffGroupID: managingGroupId || '',
          employeeID: getEmployeeIdByStaffId(selectedStaffId) // Используем employeeId вместо selectedStaffId
        };

        console.log('[SRSReportsTable] Параметры запроса StaffRecords:', {
          ...queryParams,
          selectedStaffId_for_debug: selectedStaffId,
          resolved_employeeId: getEmployeeIdByStaffId(selectedStaffId)
        });

        // Используем новый метод для получения записей с типом отпуска
        const result = await staffRecordsService.getStaffRecordsForSRSReports(queryParams);

        if (result.error) {
          const errorMsg = `Ошибка загрузки записей отпусков: ${result.error}`;
          console.error('[SRSReportsTable]', errorMsg);
          setProcessingError(errorMsg);
          setStaffRecordsData([]);
        } else {
          // Дополнительная фильтрация по выбранному типу отпуска
          const filteredRecords = result.records.filter(record => 
            record.TypeOfLeaveID === selectedTypeFilter
          );
          
          console.log(`[SRSReportsTable] Загружено ${result.records.length} записей отпусков, отфильтровано по типу: ${filteredRecords.length}`);
          setStaffRecordsData(filteredRecords);
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
    managingGroupId,
    selectedTypeFilter
  ]);

  // Объединяем контракты с записями отпусков и обрабатываем данные
  useEffect(() => {
    const processContractsWithLeaveRecords = (): void => {
      // Показываем контракты даже если нет записей отпусков
      if (Object.keys(contractsData).length === 0) {
        console.log('[SRSReportsTable] Нет контрактов для отображения');
        setProcessedData([]);
        // Уведомляем родительский компонент о пустых данных для экспорта
        if (onDataUpdate) {
          onDataUpdate([]);
        }
        return;
      }

      console.log('[SRSReportsTable] Обработка контрактов с возможными записями отпусков...');

      try {
        const contractsWithLeaveRecords: IContractWithLeaveRecords[] = [];

        // Объединяем контракты с записями отпусков
        filteredStaffMembers.forEach(staff => {
          const staffContracts = contractsData[staff.id] || [];
          
          staffContracts.forEach(contract => {
            // Находим записи отпусков, относящиеся к этому контракту
            const contractLeaveRecords = staffRecordsData.filter(record => {
              // Проверяем, что запись принадлежит этому сотруднику
              const recordStaffLookupId = record.StaffMemberLookupId;
              const staffEmployeeId = staff.employeeId;
              
              if (!recordStaffLookupId || !staffEmployeeId) {
                return false;
              }
              
              const belongsToStaff = recordStaffLookupId === staffEmployeeId;
              
              if (!belongsToStaff) {
                return false;
              }

              // УПРОЩЕННАЯ проверка контракта
              const recordContractId = record.WeeklyTimeTableID || 0;
              const contractId = contract.id;
              
              console.log(`[DEBUG] Record ${record.ID}: contractId=${recordContractId}, targetContract=${contractId}`);
              
              if (!recordContractId || !contractId) {
                return false;
              }
              
              // Простое сравнение - приводим оба к строкам
              const belongsToContract = String(recordContractId) === String(contractId);
              
              if (!belongsToContract) {
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

            console.log(`[SRSReportsTable] Контракт ${contract.template} (ID: ${contract.id}) для ${staff.name}: ${contractLeaveRecords.length} записей отпуска`);

            // Добавляем контракт ВСЕГДА, даже если нет записей отпусков
            contractsWithLeaveRecords.push({
              contract,
              staffMember: staff,
              leaveRecords: contractLeaveRecords // Может быть пустым массивом
            });
          });

          // Создаем виртуальный контракт только если у сотрудника НЕТ контрактов, но ЕСТЬ записи отпусков БЕЗ КОНТРАКТА
          if (staffContracts.length === 0) {
            const staffLeaveRecords = staffRecordsData.filter(record => {
              // Используем правильное сопоставление для виртуального контракта
              const recordStaffLookupId = record.StaffMemberLookupId;
              const staffEmployeeId = staff.employeeId;
              
              if (!recordStaffLookupId || !staffEmployeeId) {
                return false;
              }
              
              const belongsToStaff = recordStaffLookupId === staffEmployeeId;
              
              // УПРОЩЕННАЯ проверка отсутствия контракта
              const recordContractId = record.WeeklyTimeTableID || 0;
              const hasNoContract = !recordContractId || Number(recordContractId) === 0;
              
              return belongsToStaff && hasNoContract;
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
                typeOfWorker: { id: 'unknown', value: 'Unknown' }
              };

              contractsWithLeaveRecords.push({
                contract: virtualContract,
                staffMember: staff,
                leaveRecords: staffLeaveRecords
              });
            }
          }
        });

        console.log(`[SRSReportsTable] Обработка ${contractsWithLeaveRecords.length} контрактов (с записями отпусков и без)`);

        // Теперь обрабатываем контракты - ВСЕГДА показываем контракт
        if (contractsWithLeaveRecords.length === 0) {
          console.log('[SRSReportsTable] Нет контрактов для обработки');
          setProcessedData([]);
          // Уведомляем родительский компонент о пустых данных для экспорта
          if (onDataUpdate) {
            onDataUpdate([]);
          }
          return;
        }

        // Создаем ISRSReportData для каждого контракта
        const reportDataList: ISRSReportData[] = [];

        contractsWithLeaveRecords.forEach(({ contract, staffMember, leaveRecords }) => {
          // Обрабатываем контракт даже если нет записей отпусков
          let processedReportData: ISRSReportData;

          if (leaveRecords.length === 0) {
            // Контракт без записей отпусков - создаем пустую структуру
            console.log(`[SRSReportsTable] Контракт ${contract.template} без записей отпусков`);
            
            const annualLeave = calculateAnnualLeaveFromPrevious();
            
            processedReportData = {
              id: `${staffMember.id}_${contract.id}`,
              staffId: staffMember.id,
              staffName: staffMember.name,
              contractId: contract.id,
              contractName: contract.template || 'Unnamed Contract',
              contractedHours: contract.contractedHours || 0,
              annualLeaveFromPrevious: annualLeave,
              monthlyLeaveHours: createEmptyMonthlyData(), // Все месяцы = 0
              totalUsedHours: 0,
              balanceRemainingInHrs: annualLeave, // Весь остаток
              leaveRecords: [],
              recordsCount: 0
            };
            
          } else {
            // Контракт с записями отпусков - используем LeaveDataProcessor
            const groupingParams: ISRSGroupingParams = {
              staffRecords: leaveRecords,
              periodStart: selectedPeriodStart,
              periodEnd: selectedPeriodEnd,
              typeOfLeaveFilter: selectedTypeFilter === '' ? undefined : selectedTypeFilter,
              typesOfLeave: typesOfLeave
            };

            const result: ISRSGroupingResult = leaveDataProcessor.processStaffRecords(groupingParams);

            if (result.reportData.length > 0) {
              // Берем первый элемент результата и обогащаем его данными контракта
              const processedContract = result.reportData[0];
              
              processedReportData = {
                ...processedContract,
                id: `${staffMember.id}_${contract.id}`,
                staffId: staffMember.id,
                staffName: staffMember.name,
                contractId: contract.id,
                contractName: contract.template || 'Unnamed Contract',
                contractedHours: contract.contractedHours || 0,
                // ИСПРАВЛЕНО: Устанавливаем annualLeaveFromPrevious в 0
                annualLeaveFromPrevious: 0,
                // ИСПРАВЛЕНО: Balance = 0 - totalUsedHours (отрицательное значение)
                balanceRemainingInHrs: 0 - processedContract.totalUsedHours
              };
            } else {
              // Fallback если процессор не вернул данные
              const annualLeave = calculateAnnualLeaveFromPrevious();
              
              processedReportData = {
                id: `${staffMember.id}_${contract.id}`,
                staffId: staffMember.id,
                staffName: staffMember.name,
                contractId: contract.id,
                contractName: contract.template || 'Unnamed Contract',
                contractedHours: contract.contractedHours || 0,
                annualLeaveFromPrevious: annualLeave,
                monthlyLeaveHours: createEmptyMonthlyData(),
                totalUsedHours: 0,
                balanceRemainingInHrs: 0, // ИСПРАВЛЕНО: Баланс всегда 0 если нет данных
                leaveRecords: [],
                recordsCount: 0
              };
            }
          }

          reportDataList.push(processedReportData);
        });

        console.log(`[SRSReportsTable] Создано ${reportDataList.length} записей отчета (контракты + данные отпусков)`);
        setProcessedData(reportDataList);
        setProcessingError('');

        // Передаем данные в родительский компонент для Excel экспорта
        if (onDataUpdate) {
          console.log('[SRSReportsTable] Updating parent component with processed data:', reportDataList.length);
          onDataUpdate(reportDataList);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[SRSReportsTable] Ошибка при объединении и обработке данных:', errorMessage);
        setProcessingError(`Ошибка обработки данных: ${errorMessage}`);
        setProcessedData([]);
        // Уведомляем родительский компонент об ошибке для экспорта
        if (onDataUpdate) {
          onDataUpdate([]);
        }
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
    leaveDataProcessor,
    onDataUpdate
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
        <p>No contracts found for the selected staff members and period.</p>
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
          Try selecting a different period or staff member.
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
          {processedData.length} contract(s) displayed
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