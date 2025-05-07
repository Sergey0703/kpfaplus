// src/webparts/kpfaplus/components/StaffSelector/StaffSelector.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { TextField } from '@fluentui/react/lib/TextField';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import { Stack, IStackTokens } from '@fluentui/react/lib/Stack';
import { useDataContext } from '../../context';
import { ICurrentUser } from '../../services/UserService';
import { UserService } from '../../services/UserService';

/*export interface IStaffSelectorProps {
  isOpen: boolean;
  onDismiss: () => void;
  departmentId: string;
  onAddStaff: (staffId: number, staffName: string) => Promise<boolean>;
} */
  export interface IStaffSelectorProps {
    isOpen: boolean;
    onDismiss: () => void;
    departmentId: string;
    onAddStaff: (
      staffId: number, 
      staffName: string, 
      additionalData: {
        autoSchedule: boolean, 
        pathForSRSFile: string, 
        generalNote: string
      }
    ) => Promise<boolean>;
  }

export const StaffSelector: React.FC<IStaffSelectorProps> = (props) => {
  const { isOpen, onDismiss, departmentId, onAddStaff } = props;
  
  // Используем данные из контекста
  const { departments, spContext } = useDataContext();
  
  // Состояние
  const [staffList, setStaffList] = useState<ICurrentUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoSchedule, setAutoSchedule] = useState<boolean>(false);
  const [srsFilePath, setSrsFilePath] = useState<string>('');
  const [generalNote, setGeneralNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  // Находим текущий департамент
  const currentDepartment = departments.find(dept => dept.ID.toString() === departmentId);
  
  // Преобразуем список сотрудников в опции для выпадающего списка
  const staffOptions: IDropdownOption[] = staffList.map(staff => ({
    key: staff.ID,
    text: staff.Title,
    data: staff
  }));
  
  // Сбрасываем форму при открытии
  useEffect(() => {
    if (isOpen) {
      setSelectedStaffId(null);
      setAutoSchedule(false);
      setSrsFilePath('');
      setGeneralNote('');
      setErrorMessage(null);
      
      // Загружаем список сотрудников
      loadStaffList();
    }
  }, [isOpen]);
  
  // Функция загрузки списка сотрудников
  const loadStaffList = async (): Promise<void> => {
    setLoading(true);
    setErrorMessage(null);
    
    try {
      // Создаем экземпляр UserService и получаем список всех сотрудников
      if (spContext) {
        const userService = new UserService(spContext);
        const allStaff = await userService.getAllStaff();
        setStaffList(allStaff);
        
        console.log(`Loaded ${allStaff.length} staff members`);
        if (allStaff.length > 0) {
          console.log(`First staff: ${allStaff[0].Title} (ID: ${allStaff[0].ID})`);
        }
      } else {
        throw new Error("SharePoint context is not available");
      }
    } catch (error) {
      console.error("Error loading staff list:", error);
      setErrorMessage(`Error loading staff list: ${error}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Обработчик выбора сотрудника
  const handleStaffChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      setSelectedStaffId(option.key as number);
    } else {
      setSelectedStaffId(null);
    }
  };
  
  // Обработчики изменения дополнительных полей
  const handleAutoScheduleChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    setAutoSchedule(checked || false);
  };
  
  const handleSRSPathChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
    setSrsFilePath(newValue || '');
  };
  
  const handleGeneralNoteChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
    setGeneralNote(newValue || '');
  };
  
  // Обработчик добавления сотрудника - тестовая версия
// В StaffSelector.tsx обновите метод handleAddStaff
const handleAddStaff = async (): Promise<void> => {
    if (!selectedStaffId) {
      setErrorMessage('Please select a staff member');
      return;
    }
    
    setIsSaving(true);
    setErrorMessage(null);
    
    try {
      // Находим выбранного сотрудника
      const selectedStaff = staffList.find(staff => staff.ID === selectedStaffId);
      const staffName = selectedStaff?.Title || 'Unknown';
      
      // Собираем дополнительные данные из формы
      const additionalData = {
        autoSchedule: autoSchedule,
        pathForSRSFile: srsFilePath,
        generalNote: generalNote
      };
      
      // Выводим выбранные данные в консоль для проверки
      console.log("Selected staff for adding to department:", {
        staffId: selectedStaffId,
        staffName: staffName,
        departmentId: departmentId,
        departmentName: currentDepartment?.Title,
        ...additionalData
      });
      
      // Вызываем функцию обратного вызова для добавления сотрудника, передавая дополнительные данные
      const success = await onAddStaff(selectedStaffId, staffName, additionalData);
      
      if (success) {
        // Если добавление прошло успешно, закрываем форму
        onDismiss();
      } else {
        setErrorMessage('Failed to add staff member');
      }
    } catch (error) {
      console.error("Error in handleAddStaff:", error);
      setErrorMessage(`Error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Настройки для Stack компонента
  const stackTokens: IStackTokens = { childrenGap: 15 };
  
  return (
    <Panel
      isOpen={isOpen}
      onDismiss={onDismiss}
      headerText="Add Staff Member to Department"
      type={PanelType.medium}
      closeButtonAriaLabel="Close"
      isFooterAtBottom={true}
      onRenderFooterContent={() => (
        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <DefaultButton
            text="Cancel"
            onClick={onDismiss}
            styles={{ root: { marginRight: 8 } }}
            disabled={isSaving}
          />
          <PrimaryButton
            text="Add Staff"
            onClick={handleAddStaff}
            disabled={!selectedStaffId || isSaving}
          />
        </div>
      )}
    >
      <Stack tokens={stackTokens}>
        {errorMessage && (
          <MessageBar messageBarType={MessageBarType.error}>
            {errorMessage}
          </MessageBar>
        )}
        
        <div>
          <h3 style={{ margin: '0 0 8px 0' }}>Department:</h3>
          <div>{currentDepartment ? currentDepartment.Title : 'Unknown Department'}</div>
        </div>
        
        {loading ? (
          <Spinner size={SpinnerSize.medium} label="Loading staff list..." />
        ) : (
          <Dropdown
            label="Select Staff Member"
            options={staffOptions}
            onChange={handleStaffChange}
            placeholder="Select a staff member"
            required
            errorMessage={!selectedStaffId && staffOptions.length > 0 ? 'Please select a staff member' : undefined}
          />
        )}
        
        <Toggle
          label="Auto Schedule"
          checked={autoSchedule}
          onChange={handleAutoScheduleChange}
        />
        
        <TextField
          label="Path for SRS File"
          value={srsFilePath}
          onChange={handleSRSPathChange}
        />
        
        <TextField
          label="General Note"
          multiline
          rows={4}
          value={generalNote}
          onChange={handleGeneralNoteChange}
        />
        
        {/* Блок предварительного просмотра выбранных данных */}
        {selectedStaffId && (
          <div style={{ 
            marginTop: '10px', 
            padding: '10px', 
            backgroundColor: '#f0f0f0', 
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <h3 style={{ margin: '0 0 8px 0' }}>Selected Staff Information (Preview):</h3>
            <div>
              <strong>Staff ID:</strong> {selectedStaffId}
            </div>
            <div>
              <strong>Staff Name:</strong> {staffList.find(s => s.ID === selectedStaffId)?.Title || 'Unknown'}
            </div>
            <div>
              <strong>Department ID:</strong> {departmentId}
            </div>
            <div>
              <strong>Department:</strong> {currentDepartment?.Title || 'Unknown'}
            </div>
            <div>
              <strong>Auto Schedule:</strong> {autoSchedule ? 'Yes' : 'No'}
            </div>
            {srsFilePath && (
              <div>
                <strong>SRS File Path:</strong> {srsFilePath}
              </div>
            )}
            {generalNote && (
              <div>
                <strong>General Note:</strong> {generalNote}
              </div>
            )}
          </div>
        )}
      </Stack>
    </Panel>
  );
};