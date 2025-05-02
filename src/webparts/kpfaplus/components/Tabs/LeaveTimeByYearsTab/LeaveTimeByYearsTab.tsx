import * as React from 'react';
import { ITabProps } from '../../../models/types';

export const LeaveTimeByYearsTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>Leave Time by Years for {selectedStaff.name}</h2>
      <p>This tab will display leave time by years information</p>
    </div>
  );
};