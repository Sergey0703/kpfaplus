// src/webparts/kpfaplus/components/Tabs/ContractsTab/ContractsTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';

export const ContractsTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;
  
  // Получаем данные из контекста при необходимости
  const { currentUser } = useDataContext();

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>Contracts for {selectedStaff.name}</h2>
      <p>This tab will display contracts information</p>
      
      {currentUser && (
        <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Managed by: {currentUser.Title}
        </div>
      )}
    </div>
  );
};