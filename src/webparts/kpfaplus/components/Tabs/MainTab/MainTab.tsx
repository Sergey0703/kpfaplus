import * as React from 'react';
import { ITabProps } from '../../../models/types';
import styles from './MainTab.module.scss';

export const MainTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;

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
        {/* Заглушка для переключателя Autoschedule */}
        <div className={styles.autoSchedule}>
          <label>Autoschedule</label>
          {/* Здесь будет Toggle компонент */}
        </div>
      </div>
    </div>
  );
};