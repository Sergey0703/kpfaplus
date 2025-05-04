// src/webparts/kpfaplus/components/Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { useDataContext } from '../../../context';

export const LeaveTimeByYearsTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;
  
  // Получаем данные из контекста при необходимости
  const { spContext } = useDataContext();
  
  // Получаем информацию о текущем пользователе SharePoint
  const currentUserName = spContext?.pageContext.user.displayName || 'Unknown user';

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>Leave Time by Years for {selectedStaff.name}</h2>
      <p>This tab will display leave time by years information</p>
      
      <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
        Current SharePoint user: {currentUserName}
      </div>
    </div>
  );
};