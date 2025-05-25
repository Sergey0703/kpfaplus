// src/webparts/kpfaplus/components/Tabs/TimetableTab/TimetableTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';

export interface ITimetableTabProps extends ITabProps {
  // Дополнительные пропсы для таблицы времени, если понадобятся
}

export const TimetableTab: React.FC<ITimetableTabProps> = (props) => {
  const { selectedStaff, managingGroupId, currentUserId, dayOfStartWeek } = props;

  console.log('[TimetableTab] Rendering with props:', {
    hasSelectedStaff: !!selectedStaff,
    selectedStaffName: selectedStaff?.name,
    managingGroupId,
    currentUserId,
    dayOfStartWeek
  });

  // Если сотрудник не выбран
  if (!selectedStaff) {
    return (
      <div style={{ padding: '20px' }}>
        <h3>Please select a staff member</h3>
        <p>Choose a staff member from the left panel to view their timetable.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 10px 0' }}>
          Timetable for {selectedStaff.name}
        </h2>
        <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
          Group ID: {managingGroupId} | Staff ID: {selectedStaff.id} | 
          Day of Start Week: {dayOfStartWeek}
        </p>
      </div>

      {/* Временная заглушка для будущего функционала */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        border: '2px dashed #dee2e6',
        borderRadius: '8px',
        color: '#6c757d',
        fontSize: '18px',
        textAlign: 'center'
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏰</div>
          <div>Timetable functionality will be implemented here</div>
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            Staff: {selectedStaff.name} | AutoSchedule: {selectedStaff.autoSchedule ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    </div>
  );
};