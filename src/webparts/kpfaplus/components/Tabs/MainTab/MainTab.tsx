// src/webparts/kpfaplus/components/Tabs/MainTab/MainTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { Toggle } from '@fluentui/react/lib/Toggle';
import styles from './MainTab.module.scss';
import { useDataContext } from '../../../context';

export const MainTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff, autoSchedule, onAutoScheduleChange } = props;
  
  // Получаем дополнительные данные из контекста, если они понадобятся
  const { departments } = useDataContext();

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div className={styles.mainTab}>
      <div className={styles.staffInfo}>
        <div className={styles.profilePhoto}>
          {/* Placeholder for profile photo */}
          <div className={styles.photoPlaceholder} />
        </div>
        <div className={styles.staffDetails}>
          <h2>{selectedStaff.name}</h2>
          <div>
            <label>EmployeeID:</label>
            <span>{selectedStaff.employeeId || 'N/A'}</span>
          </div>
        </div>
      </div>
      
      <div className={styles.staffMetadata}>
        <div>
          <label>ID:</label>
          <span>{selectedStaff.id || 'N/A'}</span>
        </div>
        <div>
          <label>GroupMemberID:</label>
          <span>{selectedStaff.groupMemberId || 'N/A'}</span>
        </div>
        {/* Toggle для Autoschedule */}
        <div className={styles.autoSchedule}>
          <Toggle
            label="Autoschedule"
            checked={autoSchedule}
            onChange={onAutoScheduleChange}
          />
        </div>
      </div>
      
      {/* Информация о департаментах */}
      {departments.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3>Department Information</h3>
          <p>Total departments: {departments.length}</p>
        </div>
      )}
    </div>
  );
};