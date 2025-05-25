// ============================================================================
// 3. src/webparts/kpfaplus/components/Tabs/LeavesTab/components/LeavesFilterPanel.tsx
// ============================================================================
import * as React from 'react';
import { DatePicker, Dropdown, IDropdownOption, Toggle, PrimaryButton, Spinner } from '@fluentui/react';
import { ITypeOfLeave } from '../../../../services/TypeOfLeaveService';

interface ILeavesFilterPanelProps {
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
  selectedTypeFilter: string;
  showDeleted: boolean;
  typesOfLeave: ITypeOfLeave[];
  isLoading: boolean;
  onPeriodStartChange: (date: Date | null | undefined) => void;
  onPeriodEndChange: (date: Date | null | undefined) => void;
  onTypeFilterChange: (typeId: string) => void;
  onShowDeletedChange: (checked: boolean) => void;
}

export const LeavesFilterPanel: React.FC<ILeavesFilterPanelProps> = (props) => {
  const {
    selectedPeriodStart,
    selectedPeriodEnd,
    selectedTypeFilter,
    showDeleted,
    typesOfLeave,
    isLoading,
    onPeriodStartChange,
    onPeriodEndChange,
    onTypeFilterChange,
    onShowDeletedChange
  } = props;

  console.log('[LeavesFilterPanel] Rendering with types:', typesOfLeave.length);

  // Подготавливаем опции для dropdown типов отпусков
  const typeOptions: IDropdownOption[] = [
    { key: '', text: 'All Types' },
    ...typesOfLeave.map(type => ({
      key: type.id,
      text: type.title
    }))
  ];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: '15px',
      padding: '15px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      border: '1px solid #e1e5e9'
    }}>
      <div style={{ minWidth: '150px' }}>
        <DatePicker
          label="Start Date"
          value={selectedPeriodStart}
          onSelectDate={onPeriodStartChange}
        />
      </div>
      
      <div style={{ minWidth: '150px' }}>
        <DatePicker
          label="End Date"
          value={selectedPeriodEnd}
          onSelectDate={onPeriodEndChange}
        />
      </div>
      
      <div style={{ minWidth: '200px' }}>
        <Dropdown
          label="Select Type of Leave"
          options={typeOptions}
          selectedKey={selectedTypeFilter}
          onChange={(_, option) => option && onTypeFilterChange(option.key as string)}
          disabled={isLoading || typesOfLeave.length === 0}
        />
      </div>
      
      <div>
        <Toggle
          label="Show Deleted"
          checked={showDeleted}
          onChange={(_, checked) => onShowDeletedChange(!!checked)}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <PrimaryButton text="New" disabled />
        <PrimaryButton text="Save" disabled />
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