import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { TextField } from '@fluentui/react/lib/TextField';

export const SRSTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;

  if (!selectedStaff) {
    return <div>Please select a staff member</div>;
  }

  return (
    <div>
      <h2>SRS for {selectedStaff.name}</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <TextField 
          label="Path for SRS file:" 
          placeholder="path22223557890000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000111"
          disabled
        />
      </div>
      
      <div>
        <TextField 
          label="General note:" 
          multiline 
          rows={5}
          placeholder="Adele Kerr2222789"
        />
      </div>
    </div>
  );
};