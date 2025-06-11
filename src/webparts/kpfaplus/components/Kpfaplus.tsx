// src/webparts/kpfaplus/components/Kpfaplus.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { IKPFAprops } from './IKpfaplusProps';
import { StaffGallery } from './StaffGallery/StaffGallery';
import { Pivot, PivotItem, Toggle, MessageBar, MessageBarType, Icon } from '@fluentui/react';
import { useDataContext } from '../context';
import { LoadingProgress } from './LoadingProgress/LoadingProgress';
import { LoadingSpinner } from './LoadingSpinner/LoadingSpinner';
import { RefreshButton } from './RefreshButton/RefreshButton';
import { IDepartment } from '../services/DepartmentService';
import { ILoadingStep } from '../context/types';
import { IStaffMemberUpdateData } from '../models/types';
import { ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
import { StaffSelector } from './StaffSelector/StaffSelector';
import { RemoteConnectionTest } from './RemoteConnectionTest/RemoteConnectionTest';
import { ResizableLayout } from './ResizableLayout/ResizableLayout';
import { ManageGroups } from './ManageGroups/ManageGroups';

// Импортируем компоненты вкладок
import { MainTab } from './Tabs/MainTab/MainTab';
import { ContractsTab } from './Tabs/ContractsTab/ContractsTab';
import { ScheduleTab } from './Tabs/ScheduleTab/ScheduleTab';
import { NotesTab } from './Tabs/NotesTab/NotesTab';
import { LeavesTab } from './Tabs/LeavesTab/LeavesTab';
import { LeaveTimeByYearsTab } from './Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab';
import { SRSTab } from './Tabs/SRSTab/SRSTab';
import { SRSReportsTab } from './Tabs/SRSReportsTab/SRSReportsTab';
import { TimetableTab } from './Tabs/TimetableTab/TimetableTab';
import { DashboardTab } from './Tabs/DashboardTab/DashboardTab';

const Kpfaplus: React.FC<IKPFAprops> = (props): JSX.Element => {
 // Настроим логирование
 const logSource = "KPFAPlus";
 const logInfo = (message: string): void => {
   console.log(`[${logSource}] ${message}`);
 };
 
 const logError = (message: string): void => {
   console.error(`[${logSource}] ${message}`);
 };

 // Получаем данные из контекста вместо локальных состояний
 const {
   // Данные пользователя
   currentUser,
   
   // --- NEW IMPERSONATION CONTEXT ---
   impersonationState,
   getEffectiveUser,
   // --- END NEW IMPERSONATION CONTEXT ---
   
   // Данные департаментов
   departments,
   selectedDepartmentId,
   setSelectedDepartmentId,
   
   // Данные сотрудников
   staffMembers,
   selectedStaff,
   setSelectedStaff,
   
   // Состояние загрузки
   loadingState,
   
   // Методы обновления данных
   refreshData,
   refreshStaffMembers,
   
   // Метод обновления сотрудника (новый)
   updateStaffMember,
   addStaffToGroup 
 } = useDataContext();
 
 // Состояние для вкладок
 const [selectedTabKey, setSelectedTabKey] = useState<string>('main');
 
 // Состояние для отображения деталей загрузки
 const [showLoadingDetails, setShowLoadingDetails] = useState<boolean>(false);
 
 // Новое состояние для показа экрана управления группами
 const [showManageGroups, setShowManageGroups] = useState<boolean>(false);
 
 // Дополнительные состояния для данных в вкладках
 const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
 const [srsFilePath, setSrsFilePath] = useState<string>('');
 const [generalNote, setGeneralNote] = useState<string>('');

 // Новые состояния для режима редактирования
 const [isEditMode, setIsEditMode] = useState<boolean>(false);
 const [editedStaff, setEditedStaff] = useState<IStaffMemberUpdateData | null>(null);
 const [statusMessage, setStatusMessage] = useState<{text: string, type: MessageBarType} | null>(null);

 // Состояния для диалога подтверждения
 const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState<boolean>(false);
 const [confirmDialogProps, setConfirmDialogProps] = useState<{
   title: string;
   message: string;
   confirmButtonText: string;
   confirmButtonColor?: string;
   onConfirm: () => void;
 }>({
   title: '',
   message: '',
   confirmButtonText: 'Confirm',
   confirmButtonColor: undefined,
   onConfirm: () => {}
 });

 // Состояние для селектора сотрудника
 const [isStaffSelectorOpen, setIsStaffSelectorOpen] = useState<boolean>(false);

 // Добавляем состояние для хранения DayOfStartWeek выбранного департамента
 const [selectedDepartmentDayOfStartWeek, setSelectedDepartmentDayOfStartWeek] = useState<number>(7); // По умолчанию - суббота (7)

 // --- NEW: Get effective user for display ---
 const effectiveUser = getEffectiveUser();
 // --- END NEW ---

 // Обработчик для отмены изменений - определен раньше, чтобы использовать в handleTabChange
 const handleCancel = (): void => {
   logInfo("Cancelling edit mode");
   
   // Восстанавливаем предыдущие значения
   if (editedStaff) {
     setAutoSchedule(editedStaff.autoSchedule || false);
     setSrsFilePath(editedStaff.pathForSRSFile || '');
     setGeneralNote(editedStaff.generalNote || '');
   }
   
   setIsEditMode(false);
   setEditedStaff(null);
 };

 // Добавьте вспомогательную функцию для получения названия дня недели по значению
 const getDayNameByValue = (value: number): string => {
   switch (value) {
     case 1: return "Sunday";
     case 2: return "Monday";
     case 3: return "Tuesday";
     case 4: return "Wednesday";
     case 5: return "Thursday";
     case 6: return "Friday";
     case 7: return "Saturday";
     default: return "Unknown";
   }
 };

 // Добавляем логи при монтировании компонента
 useEffect(() => {
   logInfo("Component mounted");
   return () => {
     logInfo("Component unmounted");
   };
 }, []);

 // Логируем обновление staffMembers
 useEffect(() => {
   logInfo(`Staff members updated: ${staffMembers.length} items`);
   staffMembers.slice(0, 3).forEach((staff, index) => {
     logInfo(`Staff [${index}]: id=${staff.id}, name=${staff.name}, deleted=${staff.deleted || false}`);
   });
 }, [staffMembers]);

 // Автоматически выбираем первого сотрудника, если никто не выбран
 useEffect(() => {
   // Если у нас есть сотрудники, но нет выбранного сотрудника - выбираем первого
   if (staffMembers.length > 0 && !selectedStaff) {
     logInfo(`Auto-selecting first staff member: ${staffMembers[0].name} (ID: ${staffMembers[0].id})`);
     setSelectedStaff(staffMembers[0]);
   }
 }, [staffMembers, selectedStaff, setSelectedStaff]);

 // Обновленный useEffect для отслеживания выбранного департамента и получения DayOfStartWeek
 useEffect(() => {
   if (selectedDepartmentId) {
     const dept = departments.find(d => d.ID.toString() === selectedDepartmentId);
     if (dept) {
       logInfo(`Selected department: ${dept.Title} (ID: ${selectedDepartmentId})`);
       
       // Добавляем установку DayOfStartWeek
       const dayOfStartWeek = dept.DayOfStartWeek || 7; // По умолчанию - суббота (7)
       setSelectedDepartmentDayOfStartWeek(dayOfStartWeek);
       logInfo(`Department DayOfStartWeek: ${dayOfStartWeek} (Day: ${getDayNameByValue(dayOfStartWeek)})`);
     }
   }
 }, [selectedDepartmentId, departments]);

 // Логируем выбранного сотрудника
 useEffect(() => {
   if (selectedStaff) {
     logInfo(`Selected staff: ${selectedStaff.name} (ID: ${selectedStaff.id})`);
     
     // Обновляем состояния для вкладок при изменении выбранного сотрудника
     setAutoSchedule(selectedStaff.autoSchedule || false);
     setSrsFilePath(selectedStaff.pathForSRSFile || '');
     setGeneralNote(selectedStaff.generalNote || '');
     
     // Сбрасываем режим редактирования при смене сотрудника
     setIsEditMode(false);
   }
 }, [selectedStaff]);

 // При изменении выбранного департамента загружаем его сотрудников
 useEffect(() => {
   if (selectedDepartmentId) {
     // Используем явный .then().catch() вместо void
     refreshStaffMembers(selectedDepartmentId)
       .then(() => {
         logInfo(`Successfully loaded staff for department ID: ${selectedDepartmentId}`);
       })
       .catch(error => {
         console.error("Error fetching staff:", error);
       });
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedDepartmentId]);
 const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
   logInfo(`Department changed to ID: ${e.target.value}`);
   setSelectedDepartmentId(e.target.value);
 };
 
 const handleTabChange = (item?: PivotItem): void => {
   if (item && item.props.itemKey) {
     logInfo(`Tab changed to: ${item.props.itemKey}`);
     setSelectedTabKey(item.props.itemKey);
     
     // Сбрасываем режим редактирования при переключении вкладок
     if (isEditMode) {
       handleCancel();
     }
   }
 };

 // Обработчик для переключения отображения деталей загрузки
 const handleToggleLoadingDetails = (event: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
   if (checked !== undefined) {
     logInfo(`Show loading details toggled: ${checked}`);
     setShowLoadingDetails(checked);
   }
 };

 // Обработчики для дополнительных данных
 const handleAutoScheduleChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
   if (checked !== undefined) {
     logInfo(`AutoSchedule changed: ${checked}`);
     setAutoSchedule(checked);
   }
 };

 const handleSrsFilePathChange = (newValue: string): void => {
   logInfo(`SRS file path changed: ${newValue}`);
   setSrsFilePath(newValue);
 };

 const handleGeneralNoteChange = (newValue: string): void => {
   logInfo(`General note changed to: ${newValue.substring(0, 20)}${newValue.length > 20 ? '...' : ''}`);
   setGeneralNote(newValue);
 };

 // Обработчик закрытия диалога подтверждения
 const handleDismissConfirmDialog = (): void => {
   setIsConfirmDialogOpen(false);
 };

 // Обработчик закрытия селектора сотрудника
 const handleStaffSelectorDismiss = (): void => {
   setIsStaffSelectorOpen(false);
 };

 // Новые обработчики для функций редактирования
 
 // Обработчик для переключения в режим редактирования
 const handleEdit = (): void => {
   logInfo(`Entering edit mode for staff: ${selectedStaff?.name} (ID: ${selectedStaff?.id})`);
   
   // Сохраняем текущие значения для возможности отмены
   setEditedStaff({
     autoSchedule: autoSchedule,
     pathForSRSFile: srsFilePath,
     generalNote: generalNote
   });
   
   setIsEditMode(true);
 };

 // Обработчик для добавления нового сотрудника - открываем селектор
 const handleAddNewStaff = (): void => {
   logInfo(`Opening staff selector for department: ${selectedDepartmentId}`);
   setIsStaffSelectorOpen(true);
 };

 const handleAddStaffMember = async (
   staffId: number, 
   staffName: string,
   additionalData: {
     autoSchedule: boolean,
     pathForSRSFile: string,
     generalNote: string
   }
 ): Promise<boolean> => {
   try {
     // Логируем начало операции
     console.log(`Adding staff member: ${staffName} (ID: ${staffId}) to department ${selectedDepartmentId}`);
     console.log("Additional data:", additionalData);
 
     // Используем метод из контекста для добавления сотрудника в группу
     const result = await addStaffToGroup(
       selectedDepartmentId, 
       staffId, 
       additionalData
     );
     
     if (result.success) {
       // Показываем разные сообщения в зависимости от того, существует ли уже сотрудник
       if (result.alreadyExists) {
         setStatusMessage({
           text: `Staff member ${staffName} is already in this department. If you can not find -check, please, in Deleted`,
           type: MessageBarType.error  // Изменили с warning на error для красного цвета
         });
       } else {
         setStatusMessage({
           text: `Staff member ${staffName} has been successfully added to department.`,
           type: MessageBarType.success
         });
       }
       
       // Скрываем сообщение через 5 секунд
       setTimeout(() => {
         setStatusMessage(null);
       }, 5000);
       
       return true;
     } else {
       throw new Error("Failed to add staff member to Group");
     }
   } catch (error) {
     // Логируем ошибку
     console.error("Error adding staff member:", error);
     
     // Показываем сообщение об ошибке
     setStatusMessage({
       text: `Error adding staff member: ${error}`,
       type: MessageBarType.error
     });
     
     return false;
   }
 };

 // Обработчик для добавления нового сотрудника с подтверждением
 const handleAddNewStaffWithConfirm = (): void => {
   const selectedDepartment = departments.find(d => d.ID.toString() === selectedDepartmentId);
   const departmentName = selectedDepartment ? selectedDepartment.Title : 'selected department';
   
   // Настраиваем параметры диалога подтверждения
   setConfirmDialogProps({
     title: 'Confirm Addition',
     message: `Are you sure you want to add a new staff member to department "${departmentName}"?`,
     confirmButtonText: 'Add',
     confirmButtonColor: '#107c10', // Зеленый цвет для добавления
     onConfirm: () => {
       // Закрываем диалог
       setIsConfirmDialogOpen(false);
       // Открываем селектор сотрудника
       handleAddNewStaff();
     }
   });
   
   // Открываем диалог
   setIsConfirmDialogOpen(true);
 };
 
 // Обработчик для сохранения изменений
 const handleSave = async (): Promise<void> => {
   if (!selectedStaff) return;
   
   logInfo(`Saving changes for staff: ${selectedStaff.name} (ID: ${selectedStaff.id})`);
   
   try {
     // Подготавливаем данные для обновления
     const updateData: IStaffMemberUpdateData = {
       autoSchedule: autoSchedule,
       pathForSRSFile: srsFilePath,
       generalNote: generalNote
     };
     
     // Вызываем метод из контекста для обновления
     const success = await updateStaffMember(selectedStaff.id, updateData);
     
     if (success) {
       logInfo("Changes saved successfully");
       setStatusMessage({
         text: "Changes saved successfully",
         type: MessageBarType.success
       });
     } else {
       throw new Error("Failed to save changes");
     }
     
     setIsEditMode(false);
     
     // Временно очищаем сообщение через 3 секунды
     setTimeout(() => {
       setStatusMessage(null);
     }, 3000);
   } catch (error) {
     logError(`Error saving staff data: ${error}`);
     setStatusMessage({
       text: `Error saving changes: ${error}`,
       type: MessageBarType.error
     });
   }
 };
 
 // Обработчик для удаления/восстановления сотрудника
 const handleDeleteToggle = async (): Promise<void> => {
   if (!selectedStaff) return;
   
   const currentDeletedState = selectedStaff.deleted === 1;
   const newDeletedState = currentDeletedState ? 0 : 1;
   const action = currentDeletedState ? "restoration" : "deletion";
   
   logInfo(`Toggling deletion status (${action}) for staff: ${selectedStaff.name} (ID: ${selectedStaff.id})`);
   logInfo(`Current deleted state: ${selectedStaff.deleted} (${typeof selectedStaff.deleted}), new state will be: ${newDeletedState}`);
   
   try {
     // Обновляем статус удаления
     const updateData: IStaffMemberUpdateData = {
       deleted: newDeletedState
     };
     
     const success = await updateStaffMember(selectedStaff.id, updateData);
     
     if (success) {
       logInfo(`Successfully ${currentDeletedState ? 'restored' : 'deleted'} staff: ${selectedStaff.name}`);
       setStatusMessage({
         text: `Staff member successfully ${currentDeletedState ? 'restored' : 'deleted'}`,
         type: MessageBarType.success
       });
     } else {
       throw new Error(`Failed to ${currentDeletedState ? 'restore' : 'delete'} staff`);
     }
   } catch (error) {
     logError(`Error toggling deletion status: ${error}`);
     setStatusMessage({
       text: `Error during staff ${action}: ${error}`,
       type: MessageBarType.error
     });
   }
   
   // Временно очищаем сообщение через 3 секунды
   setTimeout(() => {
     setStatusMessage(null);
   }, 3000);
 };

 // Обработчик для удаления/восстановления сотрудника с подтверждением
 const handleDeleteToggleWithConfirm = (): void => {
   if (!selectedStaff) return;
   
   const currentDeletedState = selectedStaff.deleted === 1;
   const action = currentDeletedState ? 'restore' : 'delete';
   
   // Настраиваем параметры диалога подтверждения
   setConfirmDialogProps({
     title: currentDeletedState ? 'Confirm Restoration' : 'Confirm Deletion',
     message: `Are you sure you want to ${action} staff member "${selectedStaff.name}"?`,
     confirmButtonText: currentDeletedState ? 'Restore' : 'Delete',
     confirmButtonColor: currentDeletedState ? '#00b7c3' : '#d83b01', // Цвета для восстановления и удаления
     onConfirm: () => {
       // Закрываем диалог
       setIsConfirmDialogOpen(false);
       // Выполняем операцию удаления/восстановления
       // Используем .then().catch() для обработки Promise
       handleDeleteToggle()
         .then(() => {
           logInfo(`Successfully completed ${action} operation`);
         })
         .catch(error => {
           logError(`Error during ${action} operation: ${error}`);
         });
     }
   });
   
   // Открываем диалог
   setIsConfirmDialogOpen(true);
 };

 // Обработчик для кнопки Manage Groups
 const handleManageGroups = (): void => {
   logInfo("Manage Groups button clicked");
   setShowManageGroups(true);
 };

 // Обработчик для возврата из экрана управления группами
 const handleGoBackFromManageGroups = (): void => {
   logInfo("Going back from Manage Groups screen");
   setShowManageGroups(false);
    refreshData()
    .then(() => {
      logInfo("Data refreshed successfully after returning from Manage Groups");
    })
    .catch(error => {
      logError(`Error refreshing data after returning from Manage Groups: ${error}`);
    });
 };
 // Рендеринг содержимого вкладки
 const renderTabContent = (): JSX.Element => {
   if (!selectedStaff && selectedTabKey !== 'remoteConnection') {
     return <div>Please select a staff member</div>;
   }
   
   // --- MODIFIED: Use effective user instead of currentUser ---
   const currentUserId = effectiveUser?.ID !== undefined ? effectiveUser.ID.toString() : undefined;
   // --- END MODIFIED ---
   
   const managingGroupId = selectedDepartmentId; 
   
   // Логируем передачу DayOfStartWeek в пропсы при каждом рендеринге вкладки
   logInfo(`Passing DayOfStartWeek: ${selectedDepartmentDayOfStartWeek} (Day: ${getDayNameByValue(selectedDepartmentDayOfStartWeek)}) to tab components`);
   
   // Общие props для передачи во вкладки
   const tabProps = {
     selectedStaff,
     autoSchedule,
     onAutoScheduleChange: handleAutoScheduleChange,
     srsFilePath,
     onSrsFilePathChange: handleSrsFilePathChange,
     generalNote,
     onGeneralNoteChange: handleGeneralNoteChange,
     // Новые props для редактирования
     isEditMode,
     onSave: handleSave,
     onCancel: handleCancel,
     onEdit: handleEdit,
     onDelete: handleDeleteToggleWithConfirm, // Используем обработчик с подтверждением
     onAddNewStaff: handleAddNewStaffWithConfirm, // Используем обработчик с подтверждением
     context: props.context, // Передаем контекст из пропсов
     currentUserId,
     managingGroupId,
     
     // Добавляем dayOfStartWeek в пропсы для вкладок
     dayOfStartWeek: selectedDepartmentDayOfStartWeek
   };

   logInfo(`Rendering tab content for: ${selectedTabKey}`);

   switch (selectedTabKey) {
     case 'main':
       return <MainTab {...tabProps} />;
     case 'contracts':
       return <ContractsTab {...tabProps} />;
     case 'schedule': // Добавляем обработку нашей новой вкладки
      return <ScheduleTab {...tabProps} />;
    case 'leaves':
      return <LeavesTab {...tabProps} />;
    case 'timetable':
      return <TimetableTab {...tabProps} />;
     case 'notes':
       return <NotesTab {...tabProps} />;
     case 'dashboard': // ADD THIS CASE
           return <DashboardTab {...tabProps} />;  
     case 'leaveTimeByYears':
       return <LeaveTimeByYearsTab {...tabProps} />;
     case 'srs':
       return <SRSTab {...tabProps} />;
     case 'srsReports':
       return <SRSReportsTab {...tabProps} />;  
     case 'remoteConnection':
       if (impersonationState.originalUser?.IsAdmin !== 1) {
    return <div>Access denied</div>;
  }
  return <RemoteConnectionTest context={props.context} />;
     default:
       return <div>Select a tab</div>;
   }
 };

 // Если данные загружаются, показываем спиннер
 if (loadingState.isLoading) {
   logInfo("Rendering loading spinner (isLoading=true)");
   return (
     <div style={{ height: '100%', width: '100%' }}>
       <LoadingSpinner showDetails={showLoadingDetails} />
     </div>
   );
 }

 // Если произошла ошибка, показываем компонент загрузки с ошибкой
 if (loadingState.hasError) {
   logError(`Rendering error view: ${loadingState.errorMessage}`);
   return (
     <div style={{ padding: '20px' }}>
       <div style={{ marginBottom: '15px' }}>
         <Toggle
           label="Show error details"
           checked={showLoadingDetails}
           onChange={handleToggleLoadingDetails}
         />
       </div>
       <LoadingProgress showDetail={showLoadingDetails} />
       
       <div style={{ marginTop: '20px' }}>
         <button 
           onClick={() => {
             logInfo("Try Again button clicked");
             // Используем явный .then().catch() вместо void
             refreshData()
               .then(() => {
                 logInfo("Data refresh completed successfully");
               })
               .catch(error => {
                 logError(`Error during data refresh: ${error}`);
               });
           }}
           style={{ 
             padding: '8px 16px', 
             backgroundColor: '#0078d4', 
             color: 'white', 
             border: 'none', 
             borderRadius: '4px',
             cursor: 'pointer'
           }}
         >
           Try Again
         </button>
       </div>
     </div>
   );
 }

 logInfo("Rendering main component view");

 // Если показан экран управления группами, рендерим только его
 if (showManageGroups) {
   // --- MODIFIED: Use effective user instead of currentUser ---
   const currentUserId = effectiveUser?.ID !== undefined ? effectiveUser.ID.toString() : undefined;
   // --- END MODIFIED ---
   
   return (
     <ManageGroups
       selectedStaff={selectedStaff}
       autoSchedule={autoSchedule}
       onAutoScheduleChange={handleAutoScheduleChange}
       srsFilePath={srsFilePath}
       onSrsFilePathChange={handleSrsFilePathChange}
       generalNote={generalNote}
       onGeneralNoteChange={handleGeneralNoteChange}
       isEditMode={isEditMode}
       onSave={handleSave}
       onCancel={handleCancel}
       onEdit={handleEdit}
       onDelete={handleDeleteToggleWithConfirm}
       onAddNewStaff={handleAddNewStaffWithConfirm}
       context={props.context}
       currentUserId={currentUserId}
       managingGroupId={selectedDepartmentId}
       dayOfStartWeek={selectedDepartmentDayOfStartWeek}
       onGoBack={handleGoBackFromManageGroups}
     />
   );
 }

 return (
   <div style={{ width: '100%', height: '100%', margin: 0, padding: 0, position: 'relative' }}>
     <ResizableLayout
       minLeftWidth={180}
       maxLeftWidth={500}
       defaultLeftWidth={250}
       collapsedWidth={36}
       showCollapseButton={true}
       leftPanel={
         <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
           {/* Select Group и Manage Groups на одной строке */}
           <div style={{ padding: '10px', flexShrink: 0 }}>
             <div style={{ 
               fontSize: '12px', 
               fontWeight: '600', 
               color: '#323130',
               marginBottom: '5px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'space-between'
             }}>
               <span>Select Group</span>
               <span style={{ margin: '0 8px', color: '#c8c6c4' }}>|</span>
               <button
                 onClick={handleManageGroups}
                 style={{
                   background: 'none',
                   border: 'none',
                   color: '#0078d4',
                   fontSize: '12px',
                   fontWeight: '600',
                   cursor: 'pointer',
                   padding: '0',
                   textDecoration: 'underline'
                 }}
                 onMouseOver={(e) => {
                   e.currentTarget.style.color = '#106ebe';
                 }}
                 onMouseOut={(e) => {
                   e.currentTarget.style.color = '#0078d4';
                 }}
               >
                 Manage Groups
               </button>
             </div>
             <select 
               value={selectedDepartmentId}
               onChange={handleDepartmentChange}
               style={{ 
                 display: 'block', 
                 width: '100%',
                 padding: '6px 8px',
                 marginTop: '5px',
                 border: '1px solid #c8c6c4',
                 borderRadius: '2px',
                 fontSize: '13px',
                 backgroundColor: '#ffffff'
               }}
             >
               {departments.map((dept: IDepartment) => (
                 <option key={dept.ID} value={dept.ID.toString()}>
                   {dept.Title}
                 </option>
               ))}
             </select>
           </div>
           
           {/* Staff Gallery - теперь занимает оставшееся место */}
           <div style={{ 
             flex: 1, 
             overflow: 'auto',
             padding: '0 10px 10px 10px'
           }}>
             <StaffGallery />
           </div>
         </div>
       }
       rightPanel={
         <div style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column' }}>
           {/* --- MODIFIED: Enhanced user information with impersonation status --- */}
           <div style={{ 
             backgroundColor: impersonationState.isImpersonating ? '#fff4ce' : '#f6f6f6', 
             padding: '8px', 
             marginBottom: '10px',
             borderRadius: '4px',
             fontSize: '12px',
             flexShrink: 0,
             border: impersonationState.isImpersonating ? '1px solid #ffb900' : '1px solid #edebe9'
           }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                 {/* Impersonation status icon */}
                 {impersonationState.isImpersonating && (
                   <Icon 
                     iconName="Contact" 
                     style={{ 
                       color: '#ffb900', 
                       fontSize: '14px' 
                     }} 
                     title="Currently impersonating another user"
                   />
                 )}
                 
                 <div>
                   {/* Show impersonation status */}
                   {impersonationState.isImpersonating ? (
                     <div>
                       <strong style={{ color: '#d83b01' }}>Acting as:</strong> {effectiveUser?.Title || 'Unknown'} (ID: {effectiveUser?.ID || 'Unknown'})
                       <br />
                       <span style={{ fontSize: '11px', color: '#605e5c' }}>
                         Original: {impersonationState.originalUser?.Title || currentUser?.Title || 'Unknown'} (ID: {impersonationState.originalUser?.ID || currentUser?.ID || 'Unknown'})
                       </span>
                     </div>
                   ) : (
                     <div>
                       <strong>Current user:</strong> {effectiveUser?.Title || currentUser?.Title || 'Unknown'} (ID: {effectiveUser?.ID || currentUser?.ID || 'Unknown'})
                     </div>
                   )}
                   
                   {/* Department count */}
                   {departments.length > 0 && (
                     <div style={{ fontSize: '11px', color: '#605e5c', marginTop: '2px' }}>
                       Managing groups: {departments.length}
                     </div>
                   )}
                 </div>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center' }}>
                 <RefreshButton 
                   title="Refresh data" 
                 />
                 <Toggle
                   label="Show loading log"
                   checked={showLoadingDetails}
                   onChange={handleToggleLoadingDetails}
                   styles={{
                     root: { margin: 0, marginLeft: '10px' },
                     label: { fontSize: '12px' }
                   }}
                 />
               </div>
             </div>
             
             {/* Показываем журнал загрузки, если включен */}
             {showLoadingDetails && (
               <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                 <h4 style={{ margin: '0 0 5px 0', fontSize: '14px' }}>Loading Log:</h4>
                 <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '11px' }}>
                   {loadingState.loadingSteps.map((step: ILoadingStep, index: number) => (
                     <li key={index} style={{ marginBottom: '2px' }}>
                       <span style={{ 
                         display: 'inline-block', 
                         width: '16px',
                         marginRight: '5px',
                         textAlign: 'center'
                       }}>
                         {step.status === 'pending' && '⏱️'}
                         {step.status === 'loading' && '🔄'}
                         {step.status === 'success' && '✅'}
                         {step.status === 'error' && '❌'}
                       </span>
                       <span style={{ fontWeight: 'bold' }}>{step.description}</span>
                       {step.details && <span style={{ marginLeft: '5px', color: '#666' }}>- {step.details}</span>}
                       <span style={{ color: '#888', marginLeft: '5px', fontSize: '10px' }}>
                         ({step.timestamp.toLocaleTimeString()})
                       </span>
                     </li>
                   ))}
                 </ul>
               </div>
             )}
           </div>
           {/* --- END MODIFIED USER INFORMATION --- */}
           {/* Сообщение о статусе операции */}
           {statusMessage && (
             <div style={{ marginBottom: '15px', flexShrink: 0 }}>
               <MessageBar messageBarType={statusMessage.type}>
                 {statusMessage.text}
               </MessageBar>
             </div>
           )}

           {/* Панель с вкладками */}
           <div style={{ flexShrink: 0, marginBottom: '15px' }}>
             <Pivot 
               selectedKey={selectedTabKey} 
               onLinkClick={handleTabChange}
             >
               <PivotItem itemKey="main" headerText="Main" />
               <PivotItem itemKey="contracts" headerText="Contracts" />
               <PivotItem itemKey="leaves" headerText="Leaves" />
               <PivotItem itemKey="schedule" headerText="Schedule" />
               <PivotItem itemKey="dashboard" headerText="Dashboard" />
               <PivotItem itemKey="timetable" headerText="Timetable" />
               <PivotItem itemKey="srs" headerText="SRS" />
               <PivotItem itemKey="srsReports" headerText="SRS Reports" />
               <PivotItem itemKey="notes" headerText="Notes" />
               <PivotItem itemKey="leaveTimeByYears" headerText="Leave by Years" />
               {/* ПОКАЗЫВАТЬ ТОЛЬКО ДЛЯ ОРИГИНАЛЬНЫХ АДМИНОВ */}
{impersonationState.originalUser?.IsAdmin === 1 && (
  <PivotItem itemKey="remoteConnection" headerText="Admin" />
)}
             </Pivot>
           </div>
           
           {/* Содержимое активной вкладки - занимает оставшееся пространство */}
           <div style={{ flex: 1, overflow: 'auto' }}>
             {renderTabContent()}
           </div>
         </div>
       }
     />

     {/* Диалог подтверждения */}
     <ConfirmDialog
       isOpen={isConfirmDialogOpen}
       title={confirmDialogProps.title}
       message={confirmDialogProps.message}
       confirmButtonText={confirmDialogProps.confirmButtonText}
       cancelButtonText="Cancel"
       onDismiss={handleDismissConfirmDialog}
       onConfirm={confirmDialogProps.onConfirm}
       confirmButtonColor={confirmDialogProps.confirmButtonColor}
     />

     {/* Селектор сотрудника */}
     <StaffSelector 
       isOpen={isStaffSelectorOpen}
       onDismiss={handleStaffSelectorDismiss}
       departmentId={selectedDepartmentId}
       onAddStaff={handleAddStaffMember}
     />
   </div>
 );
};

export default Kpfaplus;