import * as React from 'react';
import { useState, useEffect } from 'react';
import styles from './KPFA.module.scss';
// Исправляем импорт для соответствия регистру имени файла
import { IKPFAProps } from './IKPFAprops';
import { escape } from '@microsoft/sp-lodash-subset';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Checkbox } from '@fluentui/react/lib/Checkbox';
import { IDepartment } from '../services/DepartmentService';

// This is our main component that includes the department selector
export default function KPFA(props: IKPFAProps): React.ReactElement<IKPFAProps> {
  const {
    departments,
    defaultDepartment,
    hasTeamsContext,
    userDisplayName
  } = props;

  // State for the selected department and show deleted checkbox
  const [selectedDepartment, setSelectedDepartment] = useState<IDepartment | null>(defaultDepartment);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Create dropdown options from departments
  const [departmentOptions, setDepartmentOptions] = useState<IDropdownOption[]>([]);
  
  // Effect to update dropdown options when departments change
  useEffect(() => {
    if (departments && departments.length > 0) {
      // Filter departments based on showDeleted state
      const filteredDepartments = showDeleted 
        ? departments 
        : departments.filter((dept: IDepartment) => !dept.Deleted);
      
      // Create dropdown options
      const options = filteredDepartments.map((dept: IDepartment) => ({
        key: dept.ID,
        text: dept.Title
      }));
      
      setDepartmentOptions(options);
    }
  }, [departments, showDeleted]);
  
  // Handle department selection change
  const onDepartmentChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      // Используем цикл for вместо find() для обратной совместимости с ES5
      let selectedDept: IDepartment | null = null;
      for (let i = 0; i < departments.length; i++) {
        if (departments[i].ID === option.key) {
          selectedDept = departments[i];
          break;
        }
      }
      setSelectedDepartment(selectedDept);
    }
  };
  
  // Handle show deleted checkbox change
  const onShowDeletedChange = (ev?: React.FormEvent<HTMLElement>, checked?: boolean): void => {
    setShowDeleted(!!checked);
  };

  return (
    <section className={`${styles.kpfa} ${hasTeamsContext ? styles.teams : ''}`}>
      <div className={styles.header}>
        <div className={styles.departmentSelectionContainer}>
          <div className={styles.departmentLabel}>Select Group</div>
          
          <Dropdown
            placeholder="Select a group"
            label=""
            options={departmentOptions}
            selectedKey={selectedDepartment?.ID}
            onChange={onDepartmentChange}
            className={styles.departmentDropdown}
          />
          
          <Checkbox
            label="Show Deleted"
            checked={showDeleted}
            onChange={onShowDeletedChange}
            className={styles.showDeletedCheckbox}
          />
        </div>
      </div>
      
      {/* Rest of your component UI */}
      <div className={styles.welcome}>
        <h2>Welcome, {escape(userDisplayName)}!</h2>
        <div>Selected department: {selectedDepartment?.Title || 'None'}</div>
      </div>
      
      {/* Here you would include your staff list component and SRSTab component */}
      <div className={styles.content}>
        {/* This would be where you'd put your existing SRSTab component or other components */}
        <div>The content for department {selectedDepartment?.Title} would be shown here.</div>
        <div>This is where existing components like staff list and SRSTab would go.</div>
      </div>
    </section>
  );
}