// src/webparts/kpfaplus/components/StaffGallery/StaffGallery.tsx
import * as React from 'react';
import { IStaffMember } from '../../models/types';
import { Toggle } from '@fluentui/react';
import styles from './StaffGallery.module.scss';

export interface IStaffGalleryProps {
  staffMembers: IStaffMember[];
  selectedStaff?: IStaffMember;
  showDeleted: boolean;
  onShowDeletedChange: (showDeleted: boolean) => void;
  onStaffSelect: (staff: IStaffMember) => void;
}

export const StaffGallery: React.FC<IStaffGalleryProps> = (props) => {
  const { 
    staffMembers, 
    selectedStaff, 
    showDeleted, 
    onShowDeletedChange, 
    onStaffSelect 
  } = props;
  
  // Фильтруем сотрудников, если нужно скрыть удаленных
  const filteredStaff = staffMembers.filter(staff => 
    showDeleted ? true : !staff.deleted
  );
  
  // Обработчик изменения переключателя "показывать удаленных"
  const handleToggleDeleted = (event: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      onShowDeletedChange(checked);
    }
  };
  
  return (
    <div className={styles.staffGallery}>
      <div className={styles.header}>
        <h3>Staff Members</h3>
        <Toggle 
          label="Show Deleted" 
          checked={showDeleted} 
          onChange={handleToggleDeleted}
          styles={{ root: { margin: 0 } }}
        />
      </div>
      
      <div className={styles.list}>
        {filteredStaff.length === 0 ? (
          <div className={styles.noStaff}>No staff members found</div>
        ) : (
          filteredStaff.map(staff => (
            <div 
              key={staff.id}
              className={`${styles.staffItem} ${selectedStaff?.id === staff.id ? styles.selected : ''} ${staff.deleted ? styles.deleted : ''}`}
              onClick={() => onStaffSelect(staff)}
            >
              <div className={styles.staffName}>
                {staff.name}
                {staff.deleted && <span className={styles.deletedMark}> (Deleted)</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};