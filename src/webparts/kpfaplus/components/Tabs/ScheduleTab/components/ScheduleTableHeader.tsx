// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTableHeader.tsx
import * as React from 'react';
import { Stack, IStackTokens, Toggle, DefaultButton } from '@fluentui/react';

export interface IScheduleTableHeaderProps {
  selectAllRows: boolean;
  selectedRows: Set<string>;
  showDeleted: boolean;
  onSelectAllRows: (checked: boolean) => void;
  onDeleteSelected: () => void;
  onToggleShowDeleted: (checked: boolean) => void;
  saveChangesButton?: React.ReactNode;
}

export const ScheduleTableHeader: React.FC<IScheduleTableHeaderProps> = (props) => {
  const {
    selectAllRows,
    selectedRows,
    showDeleted,
    onSelectAllRows,
    onDeleteSelected,
    onToggleShowDeleted,
    saveChangesButton
  } = props;
  
  const stackTokens: IStackTokens = { childrenGap: 10 };

  return (
    <Stack horizontal tokens={stackTokens} style={{ marginBottom: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
      <Stack horizontal tokens={stackTokens} style={{ alignItems: 'center' }}>
        <Toggle
          label="Select All rows"
          checked={selectAllRows}
          onChange={(_, checked): void => onSelectAllRows(checked!)}
        />
        {selectedRows.size > 0 && (
          <DefaultButton
            text={`Delete all selected rows (${selectedRows.size})`}
            onClick={onDeleteSelected}
            style={{ marginLeft: '16px' }}
          />
        )}
      </Stack>
      
      <Stack horizontal tokens={stackTokens} style={{ alignItems: 'center' }}>
        <Toggle
          label="Show Deleted"
          checked={showDeleted}
          onChange={(_, checked): void => onToggleShowDeleted(checked!)}
        />
        {saveChangesButton && (
          <div style={{ marginLeft: '16px' }}>
            {saveChangesButton}
          </div>
        )}
      </Stack>
    </Stack>
  );
};