import * as React from 'react';
import { ITabProps } from '../../../models/types';

export const NotesTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>Notes for {selectedStaff.name}</h2>
      <p>This tab will display notes information</p>
    </div>
  );
};