// src/webparts/kpfaplus/components/Tabs/ContractsTab/ContractsTab.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { 
 DetailsList, 
 DetailsListLayoutMode, 
 SelectionMode, 
 IColumn,
 Toggle,
 PrimaryButton, 
 TextField,
 DatePicker,
 Panel,
 IconButton,
 ComboBox,
 IComboBoxOption,
 Spinner,
 SpinnerSize,
 MessageBar,
 MessageBarType
} from '@fluentui/react';
import { spfi, SPFx } from "@pnp/sp";
import "@pnp/sp/webs";
import "@pnp/sp/lists";
import "@pnp/sp/items";
import { ITabProps } from '../../../models/types';
import { IContract, IContractFormData } from '../../../models/IContract';
import { ContractsService } from '../../../services/ContractsService';
import styles from './ContractsTab.module.scss';

export const ContractsTab: React.FC<ITabProps> = (props) => {
 const { selectedStaff, context } = props;
 
 // Логирование для отладки
 console.log("[ContractsTab] Props:", props);
 console.log("[ContractsTab] Context available:", !!context);
 
 // Состояние для контрактов и состояния загрузки
 const [contracts, setContracts] = useState<IContract[]>([]);
 const [showDeleted, setShowDeleted] = useState<boolean>(false);
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [error, setError] = useState<string | null>(null);
 
 // Состояние для панели добавления/редактирования контракта
 const [isContractPanelOpen, setIsContractPanelOpen] = useState<boolean>(false);
 const [currentContract, setCurrentContract] = useState<IContractFormData | null>(null);
 
 // Состояние для типов работников
 const [workerTypeOptions, setWorkerTypeOptions] = useState<IComboBoxOption[]>([]);
 const [isLoadingWorkerTypes, setIsLoadingWorkerTypes] = useState<boolean>(false);
 
 // Проверка наличия контекста перед инициализацией сервиса
 const contractsService = context 
   ? ContractsService.getInstance(context) 
   : null;
   
 // Загружаем типы работников при монтировании компонента
 useEffect(() => {
   if (context) {
     fetchWorkerTypes();
   }
 }, [context]);
 
 // Функция загрузки типов работников из списка TypeOfWorkers
 const fetchWorkerTypes = async (): Promise<void> => {
   if (!context) {
     return;
   }
   
   setIsLoadingWorkerTypes(true);
   
   try {
     // Используем PnP JS для получения данных из списка
     const sp = spfi().using(SPFx(context));
     
     const items = await sp.web.lists.getByTitle("TypeOfWorkers").items
       .select("ID,Title")
       .orderBy("Title", true)();
     
     // Преобразуем данные в формат IComboBoxOption
     const options: IComboBoxOption[] = items.map((item) => ({
       key: item.ID.toString(),
       text: item.Title
     }));
     
     setWorkerTypeOptions(options);
     console.log("[ContractsTab] Loaded worker types:", options);
   } catch (err) {
     console.error("Error loading worker types:", err);
   } finally {
     setIsLoadingWorkerTypes(false);
   }
 };
 
 // Загружаем контракты при изменении selectedStaff или контекста
 useEffect(() => {
   if (selectedStaff?.id && contractsService) {
     fetchContracts();
   } else {
     setContracts([]);
   }
 }, [selectedStaff, contractsService]);
 
 // Получение контрактов из сервиса
 const fetchContracts = async (): Promise<void> => {
  if (!selectedStaff?.id || !contractsService) {
    return;
  }
  
  setIsLoading(true);
  setError(null);
  
  try {
    // Изменяем на использование employeeId вместо id, и добавляем staffGroupId и managerId
    if (selectedStaff && selectedStaff.employeeId) {
      // Получаем staffGroupId и managerId из selectedStaff, если они есть
      const staffGroupId: string | undefined = props.managingGroupId;
      const managerId = props.currentUserId || undefined;
      
      // Вызываем метод с тремя параметрами
      const contractsData = await contractsService.getContractsForStaffMember(
        selectedStaff.employeeId,
        managerId,
        staffGroupId
      );
      
      setContracts(contractsData);
    } else {
      console.log("Employee ID is missing, cannot fetch contracts");
      setContracts([]);
    }
  } catch (err) {
    console.error('Error fetching contracts:', err);
    setError(`Failed to refresh the view. ${err.message || ''}`);
  } finally {
    setIsLoading(false);
  }
};
 
 // Обработчики UI
 const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
   if (checked !== undefined) {
     setShowDeleted(checked);
   }
 };
 
 const openAddContractPanel = (): void => {
   if (!selectedStaff?.id) return;
   
   // Создаем новую форму контракта
   setCurrentContract({
     template: '',
     typeOfWorkerId: '',
     contractedHours: 0,
     startDate: null,
     finishDate: null,
     staffMemberId: selectedStaff.id
   });
   setIsContractPanelOpen(true);
 };
 
 const handleEditContract = (contract: IContract): void => {
   if (!selectedStaff?.id) return;
   
   setCurrentContract({
     id: contract.id,
     template: contract.template,
     typeOfWorkerId: contract.typeOfWorker?.id || '',
     contractedHours: contract.contractedHours,
     startDate: contract.startDate,
     finishDate: contract.finishDate,
     isDeleted: contract.isDeleted,
     staffMemberId: selectedStaff.id
   });
   setIsContractPanelOpen(true);
 };
 
 const closeContractPanel = (): void => {
   setIsContractPanelOpen(false);
   setCurrentContract(null);
 };
 
 const handleSaveContract = async (): Promise<void> => {
   if (!currentContract || !contractsService) return;
   
   setIsLoading(true);
   setError(null);
   
   try {
     await contractsService.saveContract(currentContract);
     await fetchContracts(); // Обновляем список после сохранения
     closeContractPanel();
   } catch (err) {
     console.error('Error saving contract:', err);
     setError(`Failed to save the contract. ${err.message || ''}`);
   } finally {
     setIsLoading(false);
   }
 };
 
 const handleDeleteContract = async (contractId: string): Promise<void> => {
   if (!contractsService) return;
   
   setIsLoading(true);
   setError(null);
   
   try {
     await contractsService.markContractAsDeleted(contractId);
     
     // Обновляем локальное состояние без запроса к серверу
     setContracts(prevContracts => 
       prevContracts.map(c => 
         c.id === contractId 
           ? {...c, isDeleted: true} 
           : c
       )
     );
   } catch (err) {
     console.error('Error deleting contract:', err);
     setError(`Failed to delete the contract. ${err.message || ''}`);
   } finally {
     setIsLoading(false);
   }
 };
 
 const handleShowTemplate = (contractId: string): void => {
   // Логика для отображения шаблона
   console.log(`Showing template for contract ${contractId}`);
 };
 
 // Специальные стили для Fluent UI компонентов
 const saveButtonStyles = {
   root: {
     backgroundColor: '#0078d4'
   }
 };
 
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
 
 const deleteIconButtonStyles = {
   root: {
     color: '#d83b01'
   }
 };
 
 const showTemplateButtonStyles = {
   root: {
     backgroundColor: '#0078d4',
     minWidth: 'auto',
     fontSize: '12px',
     height: '28px',
     padding: '0 10px'
   }
 };
 
 const calendarIconButtonStyles = {
   root: {
     padding: 0,
     fontSize: '14px'
   }
 };
 
 // Определение колонок для таблицы
 const columns: IColumn[] = [
   {
     key: 'template',
     name: 'Template',
     fieldName: 'template',
     minWidth: 200,
     isResizable: true,
     onRender: (item: IContract) => {
       return (
         <div className={styles.templateCell} onClick={() => handleEditContract(item)}>
           {item.template}
         </div>
       );
     }
   },
   {
     key: 'typeOfWorker',
     name: 'Type of Worker',
     fieldName: 'typeOfWorker',
     minWidth: 150,
     isResizable: true,
     onRender: (item: IContract) => item.typeOfWorker?.value || ''
   },
   {
     key: 'contractedHours',
     name: 'Contracted Hours',
     fieldName: 'contractedHours',
     minWidth: 100,
     isResizable: true
   },
   {
     key: 'startDate',
     name: 'Start Contract',
     fieldName: 'startDate',
     minWidth: 120,
     isResizable: true,
     onRender: (item: IContract) => {
       return item.startDate 
         ? item.startDate.toLocaleDateString() 
         : (
           <div className={styles.datePickerContainer}>
             <span className={styles.dateText}>Select a date...</span>
             <IconButton 
               iconProps={{ iconName: 'Calendar' }} 
               title="Select a date" 
               styles={calendarIconButtonStyles}
             />
           </div>
         );
     }
   },
   {
     key: 'finishDate',
     name: 'Finish Contract',
     fieldName: 'finishDate',
     minWidth: 120,
     isResizable: true,
     onRender: (item: IContract) => {
       return item.finishDate 
         ? item.finishDate.toLocaleDateString() 
         : (
           <div className={styles.datePickerContainer}>
             <span className={styles.dateText}>Select a date...</span>
             <IconButton 
               iconProps={{ iconName: 'Calendar' }} 
               title="Select a date" 
               styles={calendarIconButtonStyles}
             />
           </div>
         );
     }
   },
   
    {
      key: 'actions',
      name: '',
      minWidth: 120,
      onRender: (item: IContract) => {
        return (
          <div className={styles.actionButtons}>
            <span>{item.id}</span>
            {item.isDeleted ? (
              // Для удаленных контрактов показываем иконку восстановления
              <IconButton 
                iconProps={{ iconName: 'Refresh' }} 
                title="Restore" 
                onClick={() => handleRestoreContract(item.id)}
                styles={{
                  root: {
                    color: '#107c10' // зеленый цвет для восстановления
                  }
                }}
              />
            ) : (
              // Для активных контрактов показываем иконку удаления
              <IconButton 
                iconProps={{ iconName: 'Delete' }} 
                title="Delete" 
                onClick={() => handleDeleteContract(item.id)}
                styles={deleteIconButtonStyles}
              />
            )}
            <PrimaryButton 
              text="Show Template" 
              onClick={() => handleShowTemplate(item.id)}
              styles={showTemplateButtonStyles}
            />
          </div>
        );
      }
    }
     /*key: 'actions',
     name: '',
     minWidth: 120,
     onRender: (item: IContract) => {
       return (
         <div className={styles.actionButtons}>
           <span>{item.id}</span>
           <IconButton 
             iconProps={{ iconName: 'Delete' }} 
             title="Delete" 
             onClick={() => handleDeleteContract(item.id)}
             styles={deleteIconButtonStyles}
           />
           <PrimaryButton 
             text="Show Template" 
             onClick={() => handleShowTemplate(item.id)}
             styles={showTemplateButtonStyles}
           />
         </div>
       );
     }
   } */
 ];
 
 // Добавляем функцию для восстановления удаленного контракта
const handleRestoreContract = async (contractId: string): Promise<void> => {
  if (!contractsService) return;
  
  setIsLoading(true);
  setError(null);
  
  try {
    await contractsService.markContractAsNotDeleted(contractId);
    
    // Обновляем локальное состояние без запроса к серверу
    setContracts(prevContracts => 
      prevContracts.map(c => 
        c.id === contractId 
          ? {...c, isDeleted: false} 
          : c
      )
    );
  } catch (err) {
    console.error('Error restoring contract:', err);
    setError(`Failed to restore the contract. ${err.message || ''}`);
  } finally {
    setIsLoading(false);
  }
};
 // Фильтруем контракты по статусу удаления
 const filteredContracts = contracts.filter(contract => 
   showDeleted ? true : !contract.isDeleted
 );
 
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
           onDismiss={() => setError(null)}
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
         
         {/* Правая часть: Save Template */}
         <div>
           <PrimaryButton 
             text="Save Template" 
             styles={saveButtonStyles}
             className={styles.actionButton}
             disabled={isLoading}
           />
         </div>
       </div>
     </div>
     
     {/* Показываем спиннер при загрузке */}
     {isLoading ? (
       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
         <Spinner size={SpinnerSize.large} label="Loading contracts..." />
       </div>
     ) : (
       <DetailsList
         items={filteredContracts}
         columns={columns}
         selectionMode={SelectionMode.none}
         layoutMode={DetailsListLayoutMode.justified}
         className={styles.contractsList}
       />
     )}
     
     <Panel
       isOpen={isContractPanelOpen}
       onDismiss={closeContractPanel}
       headerText={currentContract?.id ? "Edit Contract" : "Add New Contract"}
       closeButtonAriaLabel="Close"
     >
       {currentContract && (
         <div className={styles.formContainer}>
           <TextField 
             label="Template Name" 
             value={currentContract.template || ''}
             onChange={(_, newValue) => setCurrentContract({
               ...currentContract,
               template: newValue || ''
             })}
             required
           />
           
           <ComboBox
             label="Type of Worker"
             options={workerTypeOptions}
             selectedKey={currentContract.typeOfWorkerId}
             onChange={(_, option) => option && setCurrentContract({
               ...currentContract,
               typeOfWorkerId: option.key.toString()
             })}
             disabled={isLoadingWorkerTypes}
           />
           
           <TextField
             label="Contracted Hours"
             type="number"
             value={currentContract.contractedHours?.toString() || ''}
             onChange={(_, newValue) => setCurrentContract({
               ...currentContract,
               contractedHours: Number(newValue) || 0
             })}
           />
           
           <DatePicker
             label="Start Date"
             value={currentContract.startDate ? new Date(currentContract.startDate) : undefined}
             onSelectDate={(date) => setCurrentContract({
               ...currentContract,
               startDate: date || null
             })}
             formatDate={(date): string => date ? date.toLocaleDateString() : ''}
           />
           
           <DatePicker
             label="Finish Date"
             value={currentContract.finishDate ? new Date(currentContract.finishDate) : undefined}
             onSelectDate={(date) => setCurrentContract({
               ...currentContract,
               finishDate: date || null
             })}
             formatDate={(date): string => date ? date.toLocaleDateString() : ''}
           />
           
           <div className={styles.formButtons}>
             <PrimaryButton
               text="Save"
               onClick={handleSaveContract}
               styles={{ root: { backgroundColor: '#0078d4' } }}
               disabled={isLoading}
             />
             <PrimaryButton
               text="Cancel"
               onClick={closeContractPanel}
               styles={{ root: { backgroundColor: '#8a8886' } }}
               disabled={isLoading}
             />
           </div>
         </div>
       )}
     </Panel>
   </div>
 );
};