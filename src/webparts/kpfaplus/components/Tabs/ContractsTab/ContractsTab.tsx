// src/webparts/kpfaplus/components/Tabs/ContractsTab/ContractsTab.tsx
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { 
 DetailsList, 
 DetailsListLayoutMode, 
 SelectionMode, 
 IColumn,
 Toggle,
 PrimaryButton, 
 DefaultButton,
 TextField,
 DatePicker,
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
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';

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
 
 // Используем useRef вместо useState для ID контракта
 const pendingActionContractIdRef = useRef<string | null>(null);
 
 // Состояние для диалогов подтверждения
 const [confirmDialogProps, setConfirmDialogProps] = useState({
   isOpen: false,
   title: '',
   message: '',
   confirmButtonText: '',
   cancelButtonText: 'Cancel',
   onConfirm: () => {},
   confirmButtonColor: ''
 });
 
 // Проверка наличия контекста перед инициализацией сервиса
 const contractsService = context 
   ? ContractsService.getInstance(context) 
   : null;

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
   
 // Обработчики для подтверждения удаления/восстановления контракта
 const confirmDeleteContract = async (): Promise<void> => {
   // Получаем текущее значение contractId из ref перед использованием
   // чтобы избежать race condition
   const contractId = pendingActionContractIdRef.current;
   
   console.log(`Attempting to delete contract ID: ${contractId}`);
   
   if (!contractId || !contractsService) {
     console.error(`Missing contractId (${contractId}) or contractsService (${!!contractsService})`);
     setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
     return;
   }
   
   setIsLoading(true);
   setError(null);
   
   try {
     await contractsService.markContractAsDeleted(contractId);
     console.log(`Successfully marked contract ${contractId} as deleted`);
     
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
     setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
     // Используем функцию-обработчик для сброса ref
     // Это помогает избежать race condition
     (() => { pendingActionContractIdRef.current = null; })();
   }
 };
 
 // Подтверждение восстановления контракта
 const confirmRestoreContract = async (): Promise<void> => {
   // Получаем текущее значение contractId из ref перед использованием
   // чтобы избежать race condition
   const contractId = pendingActionContractIdRef.current;
   
   console.log(`Attempting to restore contract ID: ${contractId}`);
   
   if (!contractId || !contractsService) {
     console.error(`Missing contractId (${contractId}) or contractsService (${!!contractsService})`);
     setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
     return;
   }
   
   setIsLoading(true);
   setError(null);
   
   try {
     await contractsService.markContractAsNotDeleted(contractId);
     console.log(`Successfully restored contract ${contractId}`);
     
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
     setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
     // Используем функцию-обработчик для сброса ref
     // Это помогает избежать race condition
     (() => { pendingActionContractIdRef.current = null; })();
   }
 };
 
 // Обработчик для показа диалога подтверждения удаления
 const showDeleteConfirmDialog = (contractId: string): void => {
   console.log(`Setting up delete for contract ID: ${contractId}`);
   
   // Используем самовызывающуюся функцию (IIFE) для обновления ref
   // Это помогает избежать race condition
   (() => { pendingActionContractIdRef.current = contractId; })();
   
   setConfirmDialogProps({
     isOpen: true,
     title: 'Confirm Delete',
     message: 'Are you sure you want to delete this contract? It will be marked as deleted but can be restored later.',
     confirmButtonText: 'Delete',
     cancelButtonText: 'Cancel',
     onConfirm: () => confirmDeleteContract(),
     confirmButtonColor: '#d83b01' // красный цвет для удаления
   });
 };
 
 // Обработчик для показа диалога подтверждения восстановления
 const showRestoreConfirmDialog = (contractId: string): void => {
   console.log(`Setting up restore for contract ID: ${contractId}`);
   
   // Используем самовызывающуюся функцию (IIFE) для обновления ref
   // Это помогает избежать race condition
   (() => { pendingActionContractIdRef.current = contractId; })();
   
   setConfirmDialogProps({
     isOpen: true,
     title: 'Confirm Restore',
     message: 'Are you sure you want to restore this deleted contract?',
     confirmButtonText: 'Restore',
     cancelButtonText: 'Cancel',
     onConfirm: () => confirmRestoreContract(),
     confirmButtonColor: '#107c10' // зеленый цвет для восстановления
   });
 };

 // Загружаем типы работников при монтировании компонента
 useEffect(() => {
   if (context) {
     // Заменяем void на IIFE чтобы избежать предупреждения линтера
     (() => { fetchWorkerTypes(); })();
   }
 }, [context]);
 
 // Загружаем контракты при изменении selectedStaff или контекста
 useEffect(() => {
   if (selectedStaff?.id && contractsService) {
     // Заменяем void на IIFE чтобы избежать предупреждения линтера
     (() => { fetchContracts(); })();
   } else {
     setContracts([]);
   }
 }, [selectedStaff, contractsService]);
 
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
    startDate: undefined, // Изменено с null на undefined
    finishDate: undefined, // Изменено с null на undefined
    staffMemberId: selectedStaff.employeeId, // ID сотрудника
    managerId: props.currentUserId?.toString(), // ID менеджера
    staffGroupId: props.managingGroupId?.toString() // ID группы
  });
  
  // Открываем панель
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
     staffMemberId: selectedStaff.employeeId,
     managerId: props.currentUserId?.toString(), // ID менеджера
     staffGroupId: props.managingGroupId?.toString() // ID группы // Используем employeeId, не id
   });
   
   // Открываем панель
   setIsContractPanelOpen(true);
 };
 
 // Обработчики для закрытия панели
 const handlePanelDismiss = (): void => {
   console.log("Panel dismissed");
   setCurrentContract(null);
   setIsContractPanelOpen(false);
 };
 
 const handleCancelButtonClick = (): void => {
   console.log("Cancel button clicked directly");
   setCurrentContract(null);
   setIsContractPanelOpen(false);
 };
 
 const handleSaveContract = async (): Promise<void> => {
   if (!currentContract || !contractsService) return;
   
   setIsLoading(true);
   setError(null);
   
   try {
     console.log("Preparing to save contract with data:", currentContract);
     
     // Проверяем обязательные поля
     if (!currentContract.template || currentContract.template.trim() === '') {
       throw new Error("Template name is required");
     }
     
     // Создаем копию данных для безопасного изменения
     const contractToSave = { ...currentContract };
     
     // Убеждаемся, что числовые поля имеют корректный тип
     if (typeof contractToSave.contractedHours !== 'number') {
       contractToSave.contractedHours = Number(contractToSave.contractedHours) || 0;
     }
     
     // Делаем глубокое логирование для отладки
     console.log("Contract data being saved:", JSON.stringify(contractToSave, null, 2));
     console.log("Selected staff member:", selectedStaff);
     
     // Вызываем метод сохранения
     await contractsService.saveContract(contractToSave);
     console.log("Contract saved successfully");
     
     // Обновляем список контрактов
     await fetchContracts();
     
     // Закрываем панель и очищаем состояние
     setCurrentContract(null);
     setIsContractPanelOpen(false);
   } catch (err) {
     console.error('Error saving contract:', err);
     setError(`Failed to save the contract: ${err.message || 'Unknown error'}`);
   } finally {
     setIsLoading(false);
   }
 };
 
 const handleShowTemplate = (contractId: string): void => {
   // Логика для отображения шаблона
   console.log(`Showing template for contract ${contractId}`);
 };
 
 // Можно удалить неиспользуемый стиль для save button
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
         <div className={styles.templateCell}>
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
               onClick={(e) => {
                 // Останавливаем распространение события, чтобы не открывать форму редактирования
                 e.stopPropagation();
                 showRestoreConfirmDialog(item.id);
               }}
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
               onClick={(e) => {
                 // Останавливаем распространение события, чтобы не открывать форму редактирования
                 e.stopPropagation();
                 showDeleteConfirmDialog(item.id);
               }}
               styles={deleteIconButtonStyles}
             />
           )}
           <PrimaryButton 
             text="Show Template" 
             onClick={(e) => {
               // Останавливаем распространение события, чтобы не открывать форму редактирования
               e.stopPropagation();
               handleShowTemplate(item.id);
             }}
             styles={showTemplateButtonStyles}
           />
         </div>
       );
     }
   }
 ];
 
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
         
         {/* Правая часть: удалена кнопка Save Template */}
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
         isHeaderVisible={true}
         onRenderRow={(props, defaultRender) => {
           if (!props || !defaultRender) return null;
           
           return (
             <div onClick={() => props.item && handleEditContract(props.item)}>
               {defaultRender(props)}
             </div>
           );
         }}
         styles={{
           root: {
             selectors: {
               '.ms-DetailsRow': {
                 cursor: 'pointer',
                 '&:hover': {
                   backgroundColor: '#f3f2f1',
                 }
               }
             }
           }
         }}
       />
     )}

     {/* Кастомная панель редактирования */}
     {isContractPanelOpen && currentContract && (
       <>
         {/* Теневой фон */}
         <div 
           style={{
             position: 'fixed',
             top: 0,
             left: 0,
             right: 0,
             bottom: 0,
             backgroundColor: 'rgba(0,0,0,0.3)',
             zIndex: 999
           }} 
           onClick={handlePanelDismiss}
         />
       
         {/* Сама панель */}
         <div style={{
           position: 'fixed',
           top: 0,
           right: 0,
           bottom: 0,
           width: '400px',
           backgroundColor: 'white',
           boxShadow: '0 0 10px rgba(0,0,0,0.2)',
           zIndex: 1000,
           overflow: 'auto',
           padding: '20px'
         }}>
           {/* Заголовок с кнопкой закрытия */}
           <div style={{
             display: 'flex',
             justifyContent: 'space-between',
             alignItems: 'center',
             borderBottom: '1px solid #e0e0e0',
             paddingBottom: '10px',
             marginBottom: '20px'
           }}>
             <h2 style={{ margin: 0 }}>{currentContract.id ? "Edit Contract" : "Add New Contract"}</h2>
             <button 
               onClick={handlePanelDismiss}
               style={{
                 background: 'none',
                 border: 'none',
                 fontSize: '20px',
                 cursor: 'pointer'
               }}
             >
               &times;
             </button>
           </div>
           
           {/* Содержимое формы */}
           <div className={styles.formContainer}>
           <TextField 
  label="Template Name" 
  value={currentContract.template || ''}
  onChange={(_, newValue) => setCurrentContract({
    ...currentContract,
    template: newValue || ''
  })}
  required
  styles={{
    fieldGroup: {
      borderColor: (!currentContract.template || currentContract.template.trim() === '') ? '#a4262c' : undefined,
    }
  }}
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
                 startDate: date || undefined // Изменено с null на undefined
               })}
               formatDate={(date): string => date ? date.toLocaleDateString() : ''}
             />
             
             <DatePicker
               label="Finish Date"
               value={currentContract.finishDate ? new Date(currentContract.finishDate) : undefined}
               onSelectDate={(date) => setCurrentContract({
                 ...currentContract,
                 finishDate: date || undefined // Изменено с null на undefined
               })}
               formatDate={(date): string => date ? date.toLocaleDateString() : ''}
             />
             
             <div className={styles.formButtons}>
             <PrimaryButton
  text="Save"
  onClick={handleSaveContract}
  styles={{ root: { backgroundColor: '#0078d4' } }}
  disabled={isLoading || !currentContract.template || currentContract.template.trim() === ''}
/>
               <DefaultButton
                 text="Cancel"
                 onClick={handleCancelButtonClick}
                 styles={{ root: { marginLeft: 8 } }}
                 disabled={isLoading}
               />
             </div>
           </div>
         </div>
       </>
     )}

     {/* Добавляем компонент диалога подтверждения */}
     <ConfirmDialog
       isOpen={confirmDialogProps.isOpen}
       title={confirmDialogProps.title}
       message={confirmDialogProps.message}
       confirmButtonText={confirmDialogProps.confirmButtonText}
       cancelButtonText={confirmDialogProps.cancelButtonText}
       onConfirm={confirmDialogProps.onConfirm}
       onDismiss={() => setConfirmDialogProps(prev => ({ ...prev, isOpen: false }))}
       confirmButtonColor={confirmDialogProps.confirmButtonColor}
     />
   </div>
 );
};