// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/FilterControls.tsx
import * as React from 'react';
import {
  Dropdown,
  IDropdownOption,
  PrimaryButton,
  mergeStyleSets,
  Stack,
  IStackTokens,
  IStackStyles,
} from '@fluentui/react';
import { IContract } from '../../../../models/IContract';
import { CustomDatePicker } from '../../../CustomDatePicker/CustomDatePicker';

export interface IFilterControlsProps {
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onFillButtonClick?: () => void;
}

const controlStyles = mergeStyleSets({
  controlGroup: {
    marginRight: '40px'
  },
  label: {
    marginBottom: '5px',
    fontWeight: 600
  }
});

const stackStyles: IStackStyles = {
  root: {
    display: 'flex',
    alignItems: 'flex-end',
    marginTop: '15px',
    marginBottom: '15px'
  }
};

const stackTokens: IStackTokens = {
  childrenGap: 20
};

export const FilterControls: React.FC<IFilterControlsProps> = ({
  selectedDate,
  contracts,
  selectedContractId,
  isLoading,
  onDateChange,
  onContractChange,
  onFillButtonClick
}) => {
  console.log('[FilterControls] Rendering with selectedDate:', selectedDate.toISOString());

  const contractOptions: IDropdownOption[] = contracts.map(contract => ({
    key: contract.id,
    text: contract.template
  }));

  const handleDateSelect = React.useCallback((date: Date | undefined): void => {
    console.log('[FilterControls] Date selected from CustomDatePicker:', date?.toISOString());
    onDateChange(date);
  }, [onDateChange]);

  return (
    <Stack horizontal styles={stackStyles} tokens={stackTokens}>
      <Stack.Item className={controlStyles.controlGroup}>
        <div className={controlStyles.label}>Select date</div>
        <CustomDatePicker
          value={selectedDate}
          onChange={handleDateSelect}
          disabled={isLoading}
          showGoToToday={true}
          data-testid="schedule-date-picker"
        />
      </Stack.Item>

      <Stack.Item className={controlStyles.controlGroup}>
        <div className={controlStyles.label}>Select contract</div>
        <Dropdown
          placeholder="Select contract"
          options={contractOptions}
          selectedKey={selectedContractId}
          onChange={onContractChange}
          disabled={isLoading || contractOptions.length === 0}
          styles={{
            root: { width: '250px' }
          }}
        />
      </Stack.Item>

      <Stack.Item align="end">
        <PrimaryButton
          text="Fill"
          onClick={onFillButtonClick}
          disabled={isLoading}
          styles={{
            root: {
              backgroundColor: '#0078d4',
              minWidth: '80px',
              height: '32px'
            }
          }}
        />
      </Stack.Item>
    </Stack>
  );
};