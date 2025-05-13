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
  DatePicker,
  ComboBox,
  IComboBoxOption,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import { IContract, IContractFormData } from '../../../models/IContract';
import { ConfirmDialog } from '../../ConfirmDialog/ConfirmDialog';
import styles from './ContractsTab.module.scss';

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
  currentContract: IContractFormData | null;
  onPanelDismiss: () => void;
  onCancelButtonClick: () => void;
  onContractFormChange: (field: string, value: any) => void;
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
  const pendingActionContractIdRef = useRef<string | null>(null);
  
  // Обработчик для показа диалога подтверждения удаления
  const showDeleteConfirmDialog = (contractId: string): void => {
    console.log(`Setting up delete for contract ID: ${contractId}`);
    
    // Используем самовызывающуюся функцию (IIFE) для обновления ref
    // Это помогает избежать race condition
    (() => { pendingActionContractIdRef.current = contractId; })();
    
    setConfirmDialogProps({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this contract? It will be marked as deleted but can be restored later.',
      confirmButtonText: 'Delete',
      cancelButtonText: 'Cancel',
      onConfirm: () => {
        // Получаем текущее значение contractId из ref
        const contractId = pendingActionContractIdRef.current;
        if (contractId) {
          // Вызываем функцию удаления из props
          onDeleteContract(contractId)
            .then(() => {
              console.log(`Contract ${contractId} deleted successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = null;
            })
            .catch(err => {
              console.error(`Error deleting contract ${contractId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = null;
            });
        }
      },
      confirmButtonColor: '#d83b01' // красный цвет для удаления
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
        // Получаем текущее значение contractId из ref
        const contractId = pendingActionContractIdRef.current;
        if (contractId) {
          // Вызываем функцию восстановления из props
          onRestoreContract(contractId)
            .then(() => {
              console.log(`Contract ${contractId} restored successfully`);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = null;
            })
            .catch(err => {
              console.error(`Error restoring contract ${contractId}:`, err);
              setConfirmDialogProps(prev => ({ ...prev, isOpen: false }));
              pendingActionContractIdRef.current = null;
            });
        }
      },
      confirmButtonColor: '#107c10' // зеленый цвет для восстановления
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
              <h2 style={{ margin: 0 }}>{currentContract.id ? "Редактировать контракт" : "Добавить новый контракт"}</h2>
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
            
            {/* Содержимое формы */}
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
              
              <DatePicker
                label="Start Date"
                value={currentContract.startDate ? new Date(currentContract.startDate) : undefined}
                onSelectDate={(date) => onContractFormChange('startDate', date || undefined)}
                formatDate={(date): string => date ? date.toLocaleDateString() : ''}
              />
              
              <DatePicker
                label="Finish Date"
                value={currentContract.finishDate ? new Date(currentContract.finishDate) : undefined}
                onSelectDate={(date) => onContractFormChange('finishDate', date || undefined)}
                formatDate={(date): string => date ? date.toLocaleDateString() : ''}
              />
              
              <div className={styles.formButtons}>
                <PrimaryButton
                  text="Save"
                  onClick={() => {
                    // Используем .then().catch() для обработки Promise
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