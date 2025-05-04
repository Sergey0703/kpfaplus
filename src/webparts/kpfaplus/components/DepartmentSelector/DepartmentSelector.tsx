import * as React from 'react';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { useDataContext } from '../../context';
import { IDepartment } from '../../models/types';

export interface IDepartmentSelectorProps {
  label?: string;
  onChange?: (departmentId: string) => void;
}

export const DepartmentSelector: React.FC<IDepartmentSelectorProps> = (props) => {
  const { label = "Выберите департамент", onChange } = props;
  const { departments, selectedDepartmentId, setSelectedDepartmentId } = useDataContext();
  
  // Преобразуем департаменты в опции для выпадающего списка
  const options: IDropdownOption[] = departments.map((dept: IDepartment) => ({
    key: dept.ID.toString(),  // Используем ID вместо key
    text: dept.Title          // Используем Title вместо text
  }));
  
  const handleChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      const departmentId = option.key.toString();
      setSelectedDepartmentId(departmentId);
      
      // Вызываем обработчик onChange, если он был передан
      if (onChange) {
        onChange(departmentId);
      }
    }
  };
  
  return (
    <Dropdown
      label={label}
      selectedKey={selectedDepartmentId}
      options={options}
      onChange={handleChange}
      styles={{ dropdown: { width: '100%' } }}
    />
  );
};