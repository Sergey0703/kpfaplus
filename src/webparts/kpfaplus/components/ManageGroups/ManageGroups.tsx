// src/webparts/kpfaplus/components/ManageGroups/ManageGroups.tsx
import * as React from 'react';
import { ITabProps } from '../../models/types';
import { ManageGroupsContent } from './ManageGroupsContent';

export interface IManageGroupsProps extends ITabProps {
  onGoBack: () => void;
}

export const ManageGroups: React.FC<IManageGroupsProps> = (props) => {
  console.log('[ManageGroups] Rendering with props:', {
    hasContext: !!props.context,
    currentUserId: props.currentUserId,
    hasOnGoBack: !!props.onGoBack
  });

  return <ManageGroupsContent {...props} />;
};