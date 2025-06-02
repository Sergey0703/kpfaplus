// 3. src/webparts/kpfaplus/components/ManageGroups/components/GroupsControlPanel.tsx
// ============================================================================
import * as React from 'react';
import { PrimaryButton, Spinner, Toggle } from '@fluentui/react';

interface IGroupsControlPanelProps {
  isLoading: boolean;
  onAddNewGroup: () => void;
  // Новые props для управления сохранением
  hasUnsavedChanges?: boolean;
  onSaveChanges: () => void;
  // НОВЫЕ PROPS для Show Deleted
  showDeleted: boolean;
  onShowDeletedChange: (checked: boolean) => void;
}

export const GroupsControlPanel: React.FC<IGroupsControlPanelProps> = (props) => {
  const {
    isLoading,
    onAddNewGroup,
    hasUnsavedChanges = false,
    onSaveChanges,
    showDeleted,
    onShowDeletedChange
  } = props;

  console.log('[GroupsControlPanel] Rendering with hasUnsavedChanges:', hasUnsavedChanges, 'showDeleted:', showDeleted);

  // Обработчик для кнопки New
  const handleNewButtonClick = (): void => {
    console.log('[GroupsControlPanel] New button clicked');
    onAddNewGroup();
  };

  // Обработчик для кнопки Save
  const handleSaveButtonClick = (): void => {
    console.log('[GroupsControlPanel] Save button clicked');
    onSaveChanges();
  };

  // Обработчик для Show Deleted
  const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    console.log('[GroupsControlPanel] Show deleted changed:', checked);
    onShowDeletedChange(!!checked);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e1e5e9'
    }}>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <PrimaryButton 
          text="New" 
          onClick={handleNewButtonClick}
          disabled={isLoading}
          styles={{
            root: {
              backgroundColor: '#107c10', // зеленый цвет для создания
              borderColor: '#107c10'
            }
          }}
        />
        <PrimaryButton 
          text={hasUnsavedChanges ? "Save *" : "Save"}
          onClick={handleSaveButtonClick}
          disabled={!hasUnsavedChanges || isLoading}
          styles={{
            root: {
              backgroundColor: hasUnsavedChanges ? '#0078d4' : '#a19f9d', // синий если есть изменения, серый если нет
              borderColor: hasUnsavedChanges ? '#0078d4' : '#a19f9d',
              color: 'white'
            }
          }}
        />
      </div>

      {/* Toggle для Show Deleted */}
      <div>
        <Toggle
          label="Show Deleted"
          checked={showDeleted}
          onChange={handleShowDeletedChange}
        />
      </div>
      
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Spinner size={1} />
          <span style={{ fontSize: '12px', color: '#666' }}>Loading...</span>
        </div>
      )}
    </div>
  );
};