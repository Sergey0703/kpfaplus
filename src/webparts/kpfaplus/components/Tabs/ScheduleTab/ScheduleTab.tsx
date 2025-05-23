// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTab.tsx

import * as React from 'react';
import { ITabProps } from '../../../models/types'; // Correctly imports ITabProps
import { ScheduleTabContent } from './ScheduleTabContent';
import styles from './ScheduleTab.module.scss';
// Import the main orchestrator hook now in 'utils'
import { useScheduleTabLogic } from './utils/useScheduleTabLogic';

// ITabProps already uses IStaffMember, so this file is fine
export const ScheduleTab: React.FC<ITabProps> = (props) => {
  console.log('[ScheduleTab] Rendering component with props:', {
    hasSelectedStaff: !!props.selectedStaff,
    selectedStaffId: props.selectedStaff?.id,
    hasContext: !!props.context,
    currentUserId: props.currentUserId,
    managingGroupId: props.managingGroupId
  });

  const hookProps = useScheduleTabLogic(props);

  return (
    <div className={styles.scheduleTab}>
      <ScheduleTabContent
        selectedStaff={props.selectedStaff}
        context={props.context}
        currentUserId={props.currentUserId}
        managingGroupId={props.managingGroupId}
        {...hookProps}
      />
    </div>
  );
};

export default ScheduleTab;