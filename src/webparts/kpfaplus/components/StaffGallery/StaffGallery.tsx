// src/webparts/kpfaplus/components/StaffGallery/StaffGallery.tsx
import * as React from 'react';
import { IStaffMember } from '../../models/types';
import { Toggle, Spinner, SpinnerSize } from '@fluentui/react';
import styles from './StaffGallery.module.scss';
import { useDataContext } from '../../context';

export interface IStaffGalleryProps {
  // Позже можем добавить пропсы, если потребуется
}

export const StaffGallery: React.FC<IStaffGalleryProps> = (props) => {
  const logSource = "StaffGallery";
  const logInfo = (message: string): void => {
    console.log(`[${logSource}] ${message}`);
  };
  
  // Получаем данные из контекста
  const { 
    staffMembers, 
    selectedStaff, 
    setSelectedStaff, 
    loadingState 
  } = useDataContext();
  
  const [showDeleted, setShowDeleted] = React.useState<boolean>(false);
  
  // Логируем изменение данных
  React.useEffect(() => {
    logInfo(`Staff members updated: ${staffMembers.length} items`);
    
    // Логируем первые несколько элементов для отладки
    staffMembers.slice(0, 3).forEach((staff, index) => {
      logInfo(`Staff [${index}]: id=${staff.id}, name=${staff.name}, deleted=${staff.deleted}`);
    });
    
    if (staffMembers.length > 3) {
      logInfo(`... and ${staffMembers.length - 3} more items`);
    }
  }, [staffMembers]);
  
  // Фильтруем сотрудников, если нужно скрыть удаленных
  const filteredStaff = React.useMemo(() => {
    const filtered = staffMembers.filter(staff => showDeleted ? true : !staff.deleted);
    logInfo(`Filtered staff: ${filtered.length} of ${staffMembers.length} items (showDeleted=${showDeleted})`);
    return filtered;
  }, [staffMembers, showDeleted]);
  
  // Обработчик выбора сотрудника
  const handleStaffSelect = (staff: IStaffMember): void => {
    logInfo(`Staff selected: id=${staff.id}, name=${staff.name}`);
    setSelectedStaff(staff);
  };
  
  // Обработчик изменения переключателя "показывать удаленных"
  const handleToggleDeleted = (event: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      logInfo(`Show deleted toggled: ${checked}`);
      setShowDeleted(checked);
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
        {loadingState.isLoading ? (
          <div className={styles.loadingContainer}>
            <Spinner size={SpinnerSize.medium} label="Loading staff..." />
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className={styles.noStaff}>No staff members found</div>
        ) : (
          filteredStaff.map(staff => (
            <div 
              key={staff.id}
              className={`${styles.staffItem} ${selectedStaff?.id === staff.id ? styles.selected : ''} ${staff.deleted ? styles.deleted : ''}`}
              onClick={() => handleStaffSelect(staff)}
            >
              <div className={styles.staffName}>
                {staff.name}
                {staff.deleted && <span className={styles.deletedMark}> (Deleted)</span>}
              </div>
            </div>
          ))
        )}
      </div>
      
      {loadingState.hasError && (
        <div className={styles.error}>
          Error: {loadingState.errorMessage}
        </div>
      )}
    </div>
  );
};