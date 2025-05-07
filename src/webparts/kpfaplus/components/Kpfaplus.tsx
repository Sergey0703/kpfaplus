// src/webparts/kpfaplus/components/Kpfaplus.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { IKPFAprops } from './IKpfaplusProps';
import { StaffGallery } from './StaffGallery/StaffGallery';
import { Pivot, PivotItem, Toggle, MessageBar, MessageBarType } from '@fluentui/react';
import { useDataContext } from '../context';
import { LoadingProgress } from './LoadingProgress/LoadingProgress';
import { LoadingSpinner } from './LoadingSpinner/LoadingSpinner';
import { RefreshButton } from './RefreshButton/RefreshButton';
import { IDepartment } from '../services/DepartmentService';
import { ILoadingStep } from '../context/types';
import { IStaffMemberUpdateData } from '../models/types';
import { ConfirmDialog } from './ConfirmDialog/ConfirmDialog';
import { StaffSelector } from './StaffSelector/StaffSelector';

// Импортируем компоненты вкладок
import { MainTab } from './Tabs/MainTab/MainTab';
import { ContractsTab } from './Tabs/ContractsTab/ContractsTab';
import { NotesTab } from './Tabs/NotesTab/NotesTab';
import { LeavesTab } from './Tabs/LeavesTab/LeavesTab';
import { LeaveTimeByYearsTab } from './Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab';
import { SRSTab } from './Tabs/SRSTab/SRSTab';

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

  // Логируем выбранный департамент
  useEffect(() => {
    if (selectedDepartmentId) {
      const dept = departments.find(d => d.ID.toString() === selectedDepartmentId);
      logInfo(`Selected department: ${dept ? dept.Title : 'Unknown'} (ID: ${selectedDepartmentId})`);
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
      const success = await addStaffToGroup(
        selectedDepartmentId, 
        staffId, 
        additionalData
      );
      
      if (success) {
        // Показываем сообщение об успехе
        setStatusMessage({
          text: `Staff member ${staffName} has been successfully added to department`,
          type: MessageBarType.success
        });
        
        // Скрываем сообщение через 3 секунды
        setTimeout(() => {
          setStatusMessage(null);
        }, 3000);
        
        return true;
      } else {
        throw new Error("Failed to add staff member to department");
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
  
  // Обработчик для отмены изменений
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
        handleDeleteToggle();
      }
    });
    
    // Открываем диалог
    setIsConfirmDialogOpen(true);
  };

  // Рендеринг содержимого вкладки
  const renderTabContent = (): JSX.Element => {
    if (!selectedStaff) {
      return <div>Please select a staff member</div>;
    }

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
      onAddNewStaff: handleAddNewStaffWithConfirm // Используем обработчик с подтверждением
    };

    logInfo(`Rendering tab content for: ${selectedTabKey}`);

    switch (selectedTabKey) {
      case 'main':
        return <MainTab {...tabProps} />;
      case 'contracts':
        return <ContractsTab {...tabProps} />;
      case 'notes':
        return <NotesTab {...tabProps} />;
      case 'leaves':
        return <LeavesTab {...tabProps} />;
      case 'leaveTimeByYears':
        return <LeaveTimeByYearsTab {...tabProps} />;
      case 'srs':
        return <SRSTab {...tabProps} />;
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

  return (
    <div style={{ width: '100%', height: '100%', margin: 0, padding: 0, position: 'relative' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* Левая панель */}
        <div style={{ 
          width: '200px', 
          minWidth: '200px',
          height: '100%',
          backgroundColor: '#f0f6ff',
          borderRight: '1px solid #ddd',
          padding: '10px'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <label>Select Group</label>
            <select 
              value={selectedDepartmentId}
              onChange={handleDepartmentChange}
              style={{ 
                display: 'block', 
                width: '100%',
                padding: '5px',
                marginTop: '5px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              {departments.map((dept: IDepartment) => (
                <option key={dept.ID} value={dept.ID.toString()}>
                  {dept.Title}
                </option>
              ))}
            </select>
          </div>
          
          {/* Используем компонент StaffGallery без пропсов */}
          <StaffGallery />
        </div>
        
        {/* Правая панель */}
        <div style={{ 
          flex: 1, 
          height: '100%', 
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          padding: '10px'
        }}>
          {/* Информация о текущем пользователе и система логирования */}
          <div style={{ 
            backgroundColor: '#f6f6f6', 
            padding: '8px', 
            marginBottom: '10px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {currentUser && `Current user: ${currentUser.Title} (ID: ${currentUser.ID})`}
                {departments.length > 0 && ` | Managing groups: ${departments.length}`}
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

          {/* Сообщение о статусе операции */}
          {statusMessage && (
            <div style={{ marginBottom: '15px' }}>
              <MessageBar messageBarType={statusMessage.type}>
                {statusMessage.text}
              </MessageBar>
            </div>
          )}

          {/* Панель с вкладками */}
          <Pivot 
            selectedKey={selectedTabKey} 
            onLinkClick={handleTabChange}
            style={{ marginBottom: '15px' }}
          >
            <PivotItem itemKey="main" headerText="Main" />
            <PivotItem itemKey="contracts" headerText="Contracts" />
            <PivotItem itemKey="notes" headerText="Notes" />
            <PivotItem itemKey="leaves" headerText="Leaves" />
            <PivotItem itemKey="leaveTimeByYears" headerText="Leave Time by Years" />
            <PivotItem itemKey="srs" headerText="SRS" />
          </Pivot>
          
          {/* Содержимое активной вкладки */}
          {renderTabContent()}
        </div>
      </div>

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