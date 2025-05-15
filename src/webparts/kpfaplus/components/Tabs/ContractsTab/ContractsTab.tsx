// src/webparts/kpfaplus/components/Tabs/ContractsTab/ContractsTab.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
  Toggle,
  PrimaryButton,
  MessageBar,
  MessageBarType
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract, IContractFormData } from '../../../models/IContract';
import { ContractsService } from '../../../services/ContractsService';
import styles from './ContractsTab.module.scss';
import { RemoteSiteService } from '../../../services/RemoteSiteService';
import { IComboBoxOption } from '@fluentui/react';
import { ContractsTable } from './ContractsTable';
import { WeeklyTimeTable } from './WeeklyTimeTable';

// Определим интерфейс для данных недельного расписания
interface IWeeklyTimeDataItem {
  id: string;
  fields?: Record<string, unknown>;
  Title?: string;
  NumberOfWeek?: number;
  NumberOfShift?: number;
  Deleted?: number;
  deleted?: number;
  // Добавляем другие необходимые поля
  [key: string]: unknown;
}

export const ContractsTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff, context } = props;
  
  // Логирование для отладки
  console.log("[ContractsTab] Props:", props);
  console.log("[ContractsTab] Context available:", !!context);
  
  // Инициализация RemoteSiteService
  const remoteSiteService = context ? RemoteSiteService.getInstance(context) : undefined;
  
  // Состояние для контрактов и состояния загрузки
  const [contracts, setContracts] = useState<IContract[]>([]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  
  // Состояние для панели добавления/редактирования контракта
  const [isContractPanelOpen, setIsContractPanelOpen] = useState<boolean>(false);
  const [currentContract, setCurrentContract] = useState<IContractFormData | undefined>(undefined);
  
  // Добавляем состояние для хранения DayOfStartWeek из выбранного департамента
  const [dayOfStartWeek, setDayOfStartWeek] = useState<number>(7); // По умолчанию - суббота (7)
  const [selectedContract, setSelectedContract] = useState<IContract | undefined>(undefined);

  // Состояние для данных недельного расписания
  const [weeklyTimeData, setWeeklyTimeData] = useState<IWeeklyTimeDataItem[]>([]);
  const [isLoadingWeeklyTime, setIsLoadingWeeklyTime] = useState<boolean>(false);
  
  // Состояние для типов работников
  const [workerTypeOptions, setWorkerTypeOptions] = useState<IComboBoxOption[]>([]);
  const [isLoadingWorkerTypes, setIsLoadingWorkerTypes] = useState<boolean>(false);
  const [workerTypesLoaded, setWorkerTypesLoaded] = useState<boolean>(false);
  
  // Проверка наличия контекста перед инициализацией сервиса
  const contractsService = context 
    ? ContractsService.getInstance(context) 
    : undefined;

  // Обработчик завершения сохранения недельного расписания
  const handleSaveComplete = (success: boolean): void => {
    if (success) {
      // Можно обновить данные или показать уведомление
      console.log('Weekly time table saved successfully');
    } else {
      // Можно показать сообщение об ошибке
      console.error('Failed to save weekly time table');
      setError('Failed to save weekly time table. Please try again.');
    }
  };

  // Функция загрузки типов работников из списка TypeOfWorkers с использованием RemoteSiteService
  const fetchWorkerTypes = async (): Promise<void> => {
    if (!context || !remoteSiteService) {
      console.error("[ContractsTab] Context or RemoteSiteService not available");
      return;
    }
    
    setIsLoadingWorkerTypes(true);
    
    try {
      console.log("[ContractsTab] Fetching worker types using RemoteSiteService");
      
      // Используем RemoteSiteService вместо прямых вызовов PnP JS
      const items = await remoteSiteService.getListItems(
        "TypeOfWorkers",
        true, // expandFields
        undefined, // без фильтра
        { field: "Title", ascending: true } // сортировка
      );
      
      console.log(`[ContractsTab] Received ${items.length} worker types from RemoteSiteService`);
      
      // Преобразуем данные в формат IComboBoxOption
      // Обратите внимание на изменение в доступе к полям - теперь они в item.fields
      const options: IComboBoxOption[] = items.map((item) => {
        const fields = item.fields || {};
        
        return {
          key: item.id.toString(),
          text: fields.Title?.toString() || 'Unknown'
        };
      });
      
      setWorkerTypeOptions(options);
      setWorkerTypesLoaded(true);
      console.log("[ContractsTab] Loaded worker types:", options);
    } catch (err) {
      console.error("Error loading worker types:", err);
    } finally {
      setIsLoadingWorkerTypes(false);
    }
  };

  // Получение контрактов из сервиса
  const fetchContracts = async (): Promise<void> => {
    if (!selectedStaff?.id || !contractsService) {
      return;
    }
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      // Изменяем на использование employeeId вместо id, и добавляем staffGroupId и managerId
      if (selectedStaff && selectedStaff.employeeId) {
        // Получаем staffGroupId и managerId из selectedStaff, если они есть
        const staffGroupId: string | undefined = props.managingGroupId;
        const managerId = props.currentUserId || undefined;
        
        console.log("[ContractsTab] Fetching contracts for employee ID:", selectedStaff.employeeId, 
                   "manager ID:", managerId, "staff group ID:", staffGroupId);
        
        // Вызываем метод с тремя параметрами
        const contractsData = await contractsService.getContractsForStaffMember(
          selectedStaff.employeeId,
          managerId,
          staffGroupId
        );
        
        console.log(`[ContractsTab] Retrieved ${contractsData.length} contracts`);
        
        // Обогащаем контракты информацией о типах работников, если они загружены
        if (workerTypesLoaded && workerTypeOptions.length > 0) {
          const enrichedContracts = contractsData.map(contract => {
            // Если у контракта есть typeOfWorkerId и он есть в нашем списке типов
            if (contract.typeOfWorker && contract.typeOfWorker.id) {
              const workerType = workerTypeOptions.find(
                option => option.key === contract.typeOfWorker.id
              );
              
              if (workerType) {
                // Обновляем значение с текстом из нашего списка типов
                return {
                  ...contract,
                  typeOfWorker: {
                    ...contract.typeOfWorker,
                    value: workerType.text // Используем текст из загруженных типов
                  }
                };
              }
            }
            
            // Если не нашли совпадений, возвращаем контракт без изменений
            return contract;
          });
          
          console.log(`[ContractsTab] Enriched contracts with worker type information`);
          setContracts(enrichedContracts);
        } else {
          console.log(`[ContractsTab] Worker types not loaded yet, using original contracts`);
          setContracts(contractsData);
        }
      } else {
        console.log("Employee ID is missing, cannot fetch contracts");
        setContracts([]);
      }
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setError(`Failed to refresh the view. ${err instanceof Error ? err.message : ''}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Обработчик для удаления контракта
  const handleDeleteContract = async (contractId: string): Promise<void> => {
    if (!contractsService) {
      console.error(`ContractsService not available`);
      return;
    }
    
    console.log(`Attempting to delete contract ID: ${contractId}`);
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      const success = await contractsService.markContractAsDeleted(contractId);
      console.log(`Result of marking contract ${contractId} as deleted: ${success}`);
      
      if (success) {
        // Обновляем локальное состояние без запроса к серверу
        setContracts(prevContracts => 
          prevContracts.map(c => 
            c.id === contractId 
              ? {...c, isDeleted: true} 
              : c
          )
        );
      } else {
        throw new Error("Failed to delete contract");
      }
    } catch (err) {
      console.error('Error deleting contract:', err);
      setError(`Failed to delete the contract. ${err instanceof Error ? err.message : ''}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Обработчик для восстановления контракта
  const handleRestoreContract = async (contractId: string): Promise<void> => {
    if (!contractsService) {
      console.error(`ContractsService not available`);
      return;
    }
    
    console.log(`Attempting to restore contract ID: ${contractId}`);
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      const success = await contractsService.markContractAsNotDeleted(contractId);
      console.log(`Result of marking contract ${contractId} as not deleted: ${success}`);
      
      if (success) {
        // Обновляем локальное состояние без запроса к серверу
        setContracts(prevContracts => 
          prevContracts.map(c => 
            c.id === contractId 
              ? {...c, isDeleted: false} 
              : c
          )
        );
      } else {
        throw new Error("Failed to restore contract");
      }
    } catch (err) {
      console.error('Error restoring contract:', err);
      setError(`Failed to restore the contract. ${err instanceof Error ? err.message : ''}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Загружаем типы работников при монтировании компонента
  useEffect(() => {
    if (context) {
      (async () => {
        try {
          await fetchWorkerTypes();
        } catch (err) {
          console.error("Error loading worker types:", err);
        }
      })()
        .then(() => console.log("Worker types loaded successfully"))
        .catch(err => console.error("Error in worker types loading IIFE:", err));
    }
  }, [context]);
  
  // При изменении выбранного департамента, обновляем DayOfStartWeek
  useEffect(() => {
    // Получаем dayOfStartWeek из пропсов, если доступно
    if (props.managingGroupId && props.dayOfStartWeek !== undefined) {
      setDayOfStartWeek(props.dayOfStartWeek);
      console.log(`Department changed, DayOfStartWeek set to: ${props.dayOfStartWeek}`);
    }
  }, [props.managingGroupId, props.dayOfStartWeek]);
  useEffect(() => {
    // Сбрасываем выбранный контракт и данные расписания при смене сотрудника
    setSelectedContract(undefined);
    setWeeklyTimeData([]);
  }, [selectedStaff?.id]);
  
  // Загружаем контракты при изменении selectedStaff, контекста или после загрузки типов работников
  useEffect(() => {
    if (selectedStaff?.id && contractsService) {
      (async () => {
        try {
          await fetchContracts();
        } catch (err) {
          console.error("Error fetching contracts:", err);
        }
      })()
        .then(() => console.log("Contracts loaded successfully"))
        .catch(err => console.error("Error in contracts loading IIFE:", err));
    } else {
      setContracts([]);
    }
  }, [selectedStaff, contractsService, workerTypesLoaded]);
  
  // Обработчики UI
  const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setShowDeleted(checked);
    }
  };
  
  const openAddContractPanel = (): void => {
    if (!selectedStaff?.id) return;
    
    console.log("Opening add contract panel with values:", {
      employeeId: selectedStaff.employeeId,
      managerId: props.currentUserId,
      staffGroupId: props.managingGroupId
    });
    
    // Создаем новую форму контракта с учетом всех необходимых ID
    setCurrentContract({
      template: '',
      typeOfWorkerId: '',
      contractedHours: 0,
      startDate: undefined,
      finishDate: undefined,
      staffMemberId: selectedStaff.employeeId, // ID сотрудника
      managerId: props.currentUserId?.toString(), // ID менеджера
      staffGroupId: props.managingGroupId?.toString() // ID группы
    });
    
    // Открываем панель
    setIsContractPanelOpen(true);
  };
  
  const handleEditContract = (contract: IContract): void => {
    if (!selectedStaff?.id) return;
    
    // НЕ устанавливаем выбранный контракт для недельного расписания при редактировании
    // setSelectedContract(contract); - Удаляем эту строку
    
    setCurrentContract({
      id: contract.id,
      template: contract.template,
      typeOfWorkerId: contract.typeOfWorker?.id || '',
      contractedHours: contract.contractedHours,
      startDate: contract.startDate,
      finishDate: contract.finishDate,
      isDeleted: contract.isDeleted,
      staffMemberId: selectedStaff.employeeId,
      managerId: props.currentUserId?.toString(), // ID менеджера
      staffGroupId: props.managingGroupId?.toString() // ID группы
    });
    
    // Открываем панель
    setIsContractPanelOpen(true);
  };
  
  // Обработчики для закрытия панели
  const handlePanelDismiss = (): void => {
    console.log("Panel dismissed");
    setCurrentContract(undefined); // Используем null вместо undefined
    setIsContractPanelOpen(false);
  };
  
  // В методе handleCancelButtonClick
  const handleCancelButtonClick = (): void => {
    console.log("Cancel button clicked directly");
    setCurrentContract(undefined); // Используем null вместо undefined
    setIsContractPanelOpen(false);
  };
  
  // Обработчик изменения полей формы
  const handleContractFormChange = (field: string, value: any): void => {
    if (!currentContract) return;
    
    setCurrentContract({
      ...currentContract,
      [field]: value
    });
  };
  
  const handleSaveContract = async (contractData: IContractFormData): Promise<void> => {
    if (!contractData || !contractsService) return;
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      console.log("Preparing to save contract with data:", contractData);
      
      // Проверяем обязательные поля
      if (!contractData.template || contractData.template.trim() === '') {
        throw new Error("Template name is required");
      }
      
      // Создаем копию данных для безопасного изменения
      const contractToSave = { ...contractData };
      
      // Убеждаемся, что числовые поля имеют корректный тип
      if (typeof contractToSave.contractedHours !== 'number') {
        contractToSave.contractedHours = Number(contractToSave.contractedHours) || 0;
      }
      
      // Делаем глубокое логирование для отладки
      console.log("Contract data being saved:", JSON.stringify(contractToSave, null, 2));
      console.log("Selected staff member:", selectedStaff);
      
      // Вызываем метод сохранения
      const contractId = await contractsService.saveContract(contractToSave);
      console.log("Contract saved successfully with ID:", contractId);
      
      // Обновляем список контрактов
      await fetchContracts();
      
      // Закрываем панель и очищаем состояние
      setCurrentContract(undefined); // Используем null вместо undefined
      setIsContractPanelOpen(false);
    } catch (err) {
      console.error('Error saving contract:', err);
      setError(`Failed to save the contract: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };
  
  // Метод для показа шаблона, адаптированный для RemoteSiteService
  const handleShowTemplate = async (contractId: string): Promise<void> => {
    try {
      if (!context || !remoteSiteService) {
        console.error("Context or RemoteSiteService is not available");
        return;
      }
      
      console.log(`Showing template for contract ${contractId}`);
      
      // Устанавливаем контракт для отображения его расписания
      const contract = contracts.find(c => c.id === contractId);
      if (contract) {
        setSelectedContract(contract);
        
        // Установим анимацию загрузки
        setIsLoadingWeeklyTime(true);
        
        try {
          // Получаем данные из списка WeeklyTimeTables с фильтрацией по Creator и IdOfTemplate
          const filter = `fields/CreatorLookupId eq ${props.currentUserId} and fields/IdOfTemplateLookupId eq ${contractId}`;
          
          console.log(`Fetching WeeklyTimeTables with filter: ${filter}`);
          
          const weeklyTimeTables = await remoteSiteService.getListItems(
            "WeeklyTimeTables",
            true,
            filter,
            { field: "Title", ascending: true }
          );
          
          console.log(`Retrieved ${weeklyTimeTables.length} weekly time tables for contract ${contractId}`);
          
          // Обновляем состояние с данными для таблицы недельного расписания
          setWeeklyTimeData(weeklyTimeTables as IWeeklyTimeDataItem[]);
          
          // Пример логирования структуры данных
          if (weeklyTimeTables.length > 0) {
            console.log("Weekly time table structure:", JSON.stringify(weeklyTimeTables[0], null, 2));
          }
        } catch (fetchError) {
          console.error(`Error fetching weekly time tables: ${fetchError}`);
          setError(`Failed to load weekly time table data: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
        } finally {
          setIsLoadingWeeklyTime(false);
        }
      }
    } catch (error) {
      console.error(`Error showing template for contract ${contractId}:`, error);
      setError(`Error showing template: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };
  
  // Стили для кнопок и переключателей
  const addTemplateButtonStyles = {
    root: {
      backgroundColor: '#0078d4'
    }
  };
  
  const toggleStyles = {
    root: {
      margin: 0
    }
  };

  // Если отсутствует контекст, показываем ошибку
  if (!context) {
    return (
      <div style={{ padding: '20px' }}>
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
        >
          WebPart context is not available. Please reload the page.
        </MessageBar>
      </div>
    );
  }
  
  // Если не выбран сотрудник, показываем сообщение
  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }
  
  return (
    <div className={styles.contractsTab}>
      <div className={styles.headerContainer}>
        <h2 className={styles.title}>Contracts for {selectedStaff.name}</h2>
        
        {/* Отображаем сообщение об ошибке, если есть */}
        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline={false}
            onDismiss={() => setError(undefined)}
            dismissButtonAriaLabel="Close"
          >
            {error}
          </MessageBar>
        )}
        
        {/* Используем флекс-контейнер для размещения элементов в одной строке */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginTop: '15px',
          marginBottom: '15px' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* Левая часть: Add Template */}
            <PrimaryButton 
              text="Add Template" 
              onClick={openAddContractPanel}
              styles={addTemplateButtonStyles}
              className={styles.actionButton}
              disabled={isLoading}
            />
            
            {/* Центральная часть: Show Deleted с переключателем */}
            <div style={{ display: 'flex', alignItems: 'center', marginLeft: '20px' }}>
              <span className={styles.toggleLabel}>Show Deleted</span>
              <Toggle 
                checked={showDeleted}
                onChange={handleShowDeletedChange}
                styles={toggleStyles}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Таблица контрактов - используем новый компонент ContractsTable */}
      <ContractsTable
        contracts={contracts}
        isLoading={isLoading}
        showDeleted={showDeleted}
        workerTypeOptions={workerTypeOptions}
        isLoadingWorkerTypes={isLoadingWorkerTypes}
        staffMemberId={selectedStaff.employeeId}
        managerId={props.currentUserId}
        staffGroupId={props.managingGroupId}
        onEditContract={handleEditContract}
        onDeleteContract={handleDeleteContract}
        onRestoreContract={handleRestoreContract}
        onShowTemplate={handleShowTemplate}
        onSaveContract={handleSaveContract}
        isContractPanelOpen={isContractPanelOpen}
        currentContract={currentContract}
        onPanelDismiss={handlePanelDismiss}
        onCancelButtonClick={handleCancelButtonClick}
        onContractFormChange={handleContractFormChange}
      />

      {/* Таблица недельного расписания - добавляем ниже таблицы контрактов */}
      {selectedContract && (
        <WeeklyTimeTable
          contractId={selectedContract.id}
          contractName={selectedContract.template}
          weeklyTimeData={weeklyTimeData}
          isLoading={isLoadingWeeklyTime}
          dayOfStartWeek={dayOfStartWeek}
          context={context}
          currentUserId={props.currentUserId ? parseInt(props.currentUserId) : undefined}// Убедитесь, что этот пропс определен в ITabProps
          onSaveComplete={handleSaveComplete}
        />
      )}
    </div>
  );
};