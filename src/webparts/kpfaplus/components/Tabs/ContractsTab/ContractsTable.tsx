// src/webparts/kpfaplus/components/Tabs/ContractsTab/ContractsTable.tsx
import * as React from 'react';
import { useState, useRef } from 'react';
import { 
  DetailsList, 
  DetailsListLayoutMode, 
  SelectionMode, 
  IColumn,
  IconButton,
  PrimaryButton, 
  DefaultButton,
  TextField,
  ComboBox,
  IComboBoxOption,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import { IContract, IContractFormData } from '../../../models/IContract';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import { CustomDatePicker } from '../../CustomDatePicker/CustomDatePicker'; // ДОБАВЛЕНО
import styles from './ContractsTab.module.scss';

// УДАЛЕНО: Локализация для DatePicker - теперь используется из CustomDatePicker
// УДАЛЕНО: const datePickerStringsEN = { ... };

// УДАЛЕНО: Форматирование даты - теперь используется из CustomDatePicker  
// УДАЛЕНО: const formatDate = (date?: Date): string => { ... };

// УДАЛЕНО: Константа для минимальной ширины календаря - теперь в CustomDatePicker
// УДАЛЕНО: const calendarMinWidth = '655px';

// Интерфейс пропсов для компонента ContractsTable
export interface IContractsTableProps {
  // Данные
  contracts: IContract[];
  isLoading: boolean;
  showDeleted: boolean;
  workerTypeOptions: IComboBoxOption[];
  isLoadingWorkerTypes: boolean;
  
  // Выбранный сотрудник и его связанные ID
  staffMemberId?: string;
  managerId?: string;
  staffGroupId?: string;

  // Обработчики событий
  onEditContract: (contract: IContract) => void;
  onDeleteContract: (contractId: string) => Promise<void>;
  onRestoreContract: (contractId: string) => Promise<void>;
  onShowTemplate: (contractId: string) => Promise<void>;
  onSaveContract: (contractData: IContractFormData) => Promise<void>;
  
  // Состояние панели редактирования
  isContractPanelOpen: boolean;
  currentContract: IContractFormData | undefined;
  onPanelDismiss: () => void;
  onCancelButtonClick: () => void;
  onContractFormChange: (field: string, value: unknown) => void;
}

export const ContractsTable: React.FC<IContractsTableProps> = (props) => {
  const { 
    contracts, 
    isLoading, 
    showDeleted,
    workerTypeOptions,
    isLoadingWorkerTypes,
    staffMemberId,
    managerId,
    staffGroupId,
    onEditContract,
    onDeleteContract,
    onRestoreContract,
    onShowTemplate,
    onSaveContract,
    isContractPanelOpen,
    currentContract,
    onPanelDismiss,
    onCancelButtonClick,
    onContractFormChange
  } = props;

  // Состояние для диалогов подтверждения
  const [confirmDialogProps, setConfirmDialogProps] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Отмена',
    onConfirm: () => {},
    confirmButtonColor: ''
  });

  // Используем useRef для ID контракта в ожидании действия
  const pendingActionContractIdRef = useRef<string | undefined>(undefined);
  
  // УДАЛЕНО: Обработчик для закрытия календаря - теперь в CustomDatePicker
  // УДАЛЕНО: const calendarDismissHandler = (): void => { ... };

  // Обработчик для показа диалога подтверждения удаления
  const showDeleteConfirmDialog = (contractId: string): void => {
    console.log(`Setting up delete for contract ID: ${contractId}`);
    
    (() => { pendingActionContractIdRef.current = contractId; })();
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this contract? It will be marked as deleted but can be restored later.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        const contractId = pendingActionContractIdRef.current;
        if (contractId) {
          onDeleteContract(contractId)
            .then(() => {
              console.log(`Contract ${contractId} deleted successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = undefined;
            })
            .catch(err => {
              console.error(`Error deleting contract ${contractId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#d83b01'
    });
  };
  
  // Обработчик для показа диалога подтверждения восстановления
  const showRestoreConfirmDialog = (contractId: string): void => {
    console.log(`Setting up restore for contract ID: ${contractId}`);
    
    (() => { pendingActionContractIdRef.current = contractId; })();
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Restore',
      message: 'Are you sure you want to restore this deleted contract?',
      confirmButtonText: 'Restore',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        const contractId = pendingActionContractIdRef.current;
        if (contractId) {
          onRestoreContract(contractId)
            .then(() => {
              console.log(`Contract ${contractId} restored successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = undefined;
            })
            .catch(err => {
              console.error(`Error restoring contract ${contractId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = undefined;
            });
        }
      },
      confirmButtonColor: '#107c10'
    });
  };

  // Стили для элементов UI
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
      maxWidth: 120,
      isResizable: false,
      onRender: (item: IContract) => {
        const formattedDate = item.startDate 
          ? new Date(item.startDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit', 
              year: 'numeric'
            })
          : '-';
        
        return (
          <div style={{ 
            width: '120px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            color: '#666',
            padding: '0 8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}>
            {formattedDate}
          </div>
        );
      }
    },
    {
      key: 'finishDate',
      name: 'Finish Contract', 
      fieldName: 'finishDate',
      minWidth: 120,
      maxWidth: 120,
      isResizable: false,
      onRender: (item: IContract) => {
        const formattedDate = item.finishDate 
          ? new Date(item.finishDate).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            })
          : '-';
        
        return (
          <div style={{ 
            width: '120px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            fontSize: '13px',
            color: '#666',
            padding: '0 8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            boxSizing: 'border-box'
          }}>
            {formattedDate}
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
            {item.isDeleted ? (
              <IconButton 
                iconProps={{ iconName: 'Refresh' }} 
                title="Restore" 
                onClick={(e) => {
                  e.stopPropagation();
                  showRestoreConfirmDialog(item.id);
                }}
                styles={{
                  root: {
                    color: '#107c10'
                  }
                }}
              />
            ) : (
              <IconButton 
                iconProps={{ iconName: 'Delete' }} 
                title="Delete" 
                onClick={(e) => {
                  e.stopPropagation();
                  showDeleteConfirmDialog(item.id);
                }}
                styles={deleteIconButtonStyles}
              />
            )}
            <PrimaryButton 
              text="Show Template" 
              onClick={(e) => {
                e.stopPropagation();
                onShowTemplate(item.id)
                  .then(() => {
                    console.log(`Template for contract ${item.id} shown successfully`);
                  })
                  .catch(err => {
                    console.error(`Error showing template for contract ${item.id}:`, err);
                  });
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

  // Рендерим таблицу и панель редактирования
  return (
    <>
      {/* Показываем спиннер при загрузке */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
          <Spinner size={SpinnerSize.large} label="Загрузка контрактов..." />
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
              <div onClick={() => props.item && onEditContract(props.item)}>
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

      {/* ОБНОВЛЕННАЯ панель редактирования с CustomDatePicker */}
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
            onClick={onPanelDismiss}
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
              <h2 style={{ margin: 0 }}>{currentContract.id ? "Edit Contract" : "Add new Contract"}</h2>
              <button 
                onClick={onPanelDismiss}
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
            
            {/* ОБНОВЛЕННОЕ содержимое формы с CustomDatePicker */}
            <div className={styles.formContainer}>
              <TextField 
                label="Template Name" 
                value={currentContract.template || ''}
                onChange={(_, newValue) => onContractFormChange('template', newValue || '')}
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
                onChange={(_, option) => option && onContractFormChange('typeOfWorkerId', option.key.toString())}
                disabled={isLoadingWorkerTypes}
              />
              
              <TextField
                label="Contracted Hours"
                type="number"
                value={currentContract.contractedHours?.toString() || ''}
                onChange={(_, newValue) => onContractFormChange('contractedHours', Number(newValue) || 0)}
              />
              
              {/* ИСПРАВЛЕНО: CustomDatePicker для Start Date с контейнером */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '5px',
                  color: '#323130'
                }}>Start Date</div>
                <div style={{ width: '220px' }}>
                  <CustomDatePicker
                    value={currentContract.startDate ? new Date(currentContract.startDate) : undefined}
                    onChange={(date) => onContractFormChange('startDate', date || undefined)}
                    placeholder="Select start date..."
                    data-testid="contract-start-date"
                    styles={{
                      root: { width: '220px' }
                    }}
                  />
                </div>
              </div>
              
              {/* ИСПРАВЛЕНО: CustomDatePicker для Finish Date с контейнером */}
              <div style={{ marginBottom: '15px' }}>
                <div style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  marginBottom: '5px',
                  color: '#323130'
                }}>Finish Date</div>
                <div style={{ width: '220px' }}>
                  <CustomDatePicker
                    value={currentContract.finishDate ? new Date(currentContract.finishDate) : undefined}
                    onChange={(date) => onContractFormChange('finishDate', date || undefined)}
                    placeholder="Select finish date..."
                    data-testid="contract-finish-date"
                    styles={{
                      root: { width: '220px' }
                    }}
                  />
                </div>
              </div>
              
              <div className={styles.formButtons}>
                <PrimaryButton
                  text="Save"
                  onClick={() => {
                    onSaveContract({
                      ...currentContract,
                      staffMemberId: staffMemberId,
                      managerId: managerId,
                      staffGroupId: staffGroupId
                    })
                      .then(() => console.log("Contract saved successfully"))
                      .catch(err => console.error("Error saving contract:", err));
                  }}
                  styles={{ root: { backgroundColor: '#0078d4' } }}
                  disabled={isLoading || !currentContract.template || currentContract.template.trim() === ''}
                />
                <DefaultButton
                  text="Cancel"
                  onClick={onCancelButtonClick}
                  styles={{ root: { marginLeft: 8 } }}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Диалог подтверждения */}
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
    </>
  );
};