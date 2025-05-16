// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/FilterControls.tsx
import * as React from 'react';
import { DatePicker, Dropdown, IDropdownOption } from '@fluentui/react';
import { IContract } from '../../../../models/IContract';

export interface IFilterControlsProps {
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  onDateChange: (date: Date | null | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
}

export const FilterControls: React.FC<IFilterControlsProps> = ({ 
  selectedDate, 
  contracts, 
  selectedContractId, 
  isLoading, 
  onDateChange, 
  onContractChange 
}) => {
  // Преобразуем контракты в опции для выпадающего списка
  const contractOptions: IDropdownOption[] = contracts.map(contract => ({
    key: contract.id,
    text: contract.template
  }));
  
  return (
    <div style={{ 
      display: 'flex', 
      marginTop: '15px',
      marginBottom: '15px'
    }}>
      <div style={{ marginRight: '40px' }}>
        <div>Select date</div>
        <DatePicker
          value={selectedDate}
          onSelectDate={onDateChange}
          firstDayOfWeek={1}
          formatDate={(date?: Date): string => date ? date.toLocaleDateString() : ''}
          isRequired={false}
          styles={{
            root: { width: '150px' }
          }}
        />
      </div>
      
      <div>
        <div>Select contract</div>
        <Dropdown
          placeholder="Select a contract"
          options={contractOptions}
          selectedKey={selectedContractId}
          onChange={onContractChange}
          disabled={isLoading || contractOptions.length === 0}
          styles={{
            root: { width: '250px' }
          }}
        />
      </div>
    </div>
  );
};