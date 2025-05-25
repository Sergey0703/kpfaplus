// 1. src/webparts/kpfaplus/components/Tabs/LeavesTab/LeavesTab.tsx
// ============================================================================
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { LeavesTabContent } from './LeavesTabContent';

export const LeavesTab: React.FC<ITabProps> = (props) => {
  console.log('[LeavesTab] Rendering with props:', {
    hasSelectedStaff: !!props.selectedStaff,
    selectedStaffName: props.selectedStaff?.name,
    managingGroupId: props.managingGroupId,
    currentUserId: props.currentUserId
  });

  return <LeavesTabContent {...props} />;
};