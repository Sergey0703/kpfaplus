// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import styles from './ScheduleTab.module.scss';

export const ScheduleTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div className={styles.scheduleTab}>
      <div className={styles.header}>
        <h2>Schedule for {selectedStaff.name}</h2>
      </div>
      <div className={styles.content}>
        {/* Здесь будет содержимое вкладки расписания */}
        <p>Schedule content will be displayed here</p>
      </div>
    </div>
  );
};