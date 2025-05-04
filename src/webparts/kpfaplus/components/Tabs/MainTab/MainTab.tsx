// src/webparts/kpfaplus/components/Tabs/MainTab/MainTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { TextField } from '@fluentui/react/lib/TextField';
import styles from './MainTab.module.scss';

export const MainTab: React.FC<ITabProps> = (props) => {
  const { 
    selectedStaff, 
    autoSchedule, 
    onAutoScheduleChange,
    srsFilePath,
    onSrsFilePathChange,
    generalNote,
    onGeneralNoteChange
  } = props;

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

      {/* Поле для пути SRS файла */}
      <div className={styles.fieldContainer}>
        <TextField
          label="Path for SRS file:"
          value={srsFilePath}
          onChange={(_, newValue) => onSrsFilePathChange?.(newValue || '')}
          className={styles.srsPathField}
        />
      </div>

      {/* Поле для общей заметки */}
      <div className={styles.fieldContainer}>
        <TextField
          label="General note:"
          value={generalNote}
          onChange={(_, newValue) => onGeneralNoteChange?.(newValue || '')}
          multiline
          rows={5}
          className={styles.generalNoteField}
        />
      </div>
    </div>
  );
};