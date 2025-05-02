import * as React from 'react';
import { ITabProps } from '../../../models/types';

export const LeavesTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>Leaves for {selectedStaff.name}</h2>
      <p>This tab will display leaves information</p>
    </div>
  );
};