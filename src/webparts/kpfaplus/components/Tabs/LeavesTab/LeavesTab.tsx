// src/webparts/kpfaplus/components/Tabs/LeavesTab/LeavesTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';

export const LeavesTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;
  
  // Получаем данные из контекста при необходимости
  const { departments, selectedDepartmentId } = useDataContext();
  
  // Находим текущий департамент
  const currentDepartment = departments.find(
    dept => dept.ID.toString() === selectedDepartmentId
  );

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>Leaves for {selectedStaff.name}</h2>
      <p>This tab will display leaves information</p>
      
      {currentDepartment && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Department: {currentDepartment.Title}
        </div>
      )}
    </div>
  );
};