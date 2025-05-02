import * as React from 'react';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { IDepartment } from '../../models/types';

export interface IDepartmentSelectorProps {
  departments: IDepartment[];
  selectedDepartment: string;
  onDepartmentChange: (departmentKey: string) => void;
}

export const DepartmentSelector: React.FC<IDepartmentSelectorProps> = (props) => {
  const { departments, selectedDepartment, onDepartmentChange } = props;

  const options: IDropdownOption[] = departments.map(dept => ({
    key: dept.key,
    text: dept.text
  }));

  const onChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      onDepartmentChange(option.key as string);
    }
  };

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ marginBottom: '5px' }}>Select Group</div>
      <Dropdown
        selectedKey={selectedDepartment}
        options={options}
        onChange={onChange}
        style={{ width: '100%' }}
      />
    </div>
  );
};