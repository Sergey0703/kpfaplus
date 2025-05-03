import * as React from 'react';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { List } from '@fluentui/react/lib/List';
import { IconButton } from '@fluentui/react/lib/Button';
import { IStaffMember } from '../../models/types';
import styles from './StaffGallery.module.scss';

export interface IStaffGalleryProps {
  staffMembers: IStaffMember[];
  selectedStaff: IStaffMember | undefined; // Изменил null на undefined
  showDeleted: boolean;
  onShowDeletedChange: (showDeleted: boolean) => void;
  onStaffSelect: (staff: IStaffMember) => void;
}

export const StaffGallery: React.FC<IStaffGalleryProps> = (props) => {
  const { staffMembers, selectedStaff, showDeleted, onShowDeletedChange, onStaffSelect } = props;

  const filteredStaff = showDeleted 
    ? staffMembers 
    : staffMembers.filter(staff => !staff.deleted);

  const onRenderCell = (item: IStaffMember): JSX.Element => {
    const isSelected = selectedStaff && selectedStaff.id === item.id;
    
    return (
      <div 
        className={`${styles.staffItem} ${isSelected ? styles.selected : ''}`}
        onClick={() => onStaffSelect(item)}
      >
        <span className={styles.staffName}>{item.name}</span>
        <IconButton 
          iconProps={{ iconName: 'Delete' }} 
          className={styles.deleteButton}
          aria-label="Delete" 
        />
      </div>
    );
  };

  const handleToggleChange = (_event: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      onShowDeletedChange(checked);
    }
  };

  return (
    <div className={styles.staffGallery}>
      <Toggle
        label="Show Deleted"
        checked={showDeleted}
        onChange={handleToggleChange}
      />
      <List
        items={filteredStaff}
        onRenderCell={onRenderCell}
      />
    </div>
  );
};