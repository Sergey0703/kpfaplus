// src/webparts/kpfaplus/components/StaffGallery/StaffGallery.tsx
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Toggle } from '@fluentui/react';
import { useDataContext } from '../../context';
import styles from './StaffGallery.module.scss';

export interface IStaffGalleryProps {
  // Пустой интерфейс, так как все данные получаем из контекста
}

export const StaffGallery: React.FC<IStaffGalleryProps> = () => {
  const {
    staffMembers,
    selectedStaff,
    setSelectedStaff
  } = useDataContext();

  // Локальное состояние для отображения удаленных сотрудников
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Логирование
  const logSource = "StaffGallery";
  const logInfo = (message: string): void => {
    console.log(`[${logSource}] ${message}`);
  };

  // Логируем обновление staffMembers при изменении
  useEffect(() => {
    logInfo(`Staff members updated: ${staffMembers.length} items`);
    staffMembers.slice(0, 3).forEach((staff, index) => {
      logInfo(`Staff [${index}]: id=${staff.id}, name=${staff.name}, deleted=${staff.deleted || false}`);
    });
    
    if (staffMembers.length > 3) {
      logInfo(`... and ${staffMembers.length - 3} more items`);
    }
  }, [staffMembers]);

  // Фильтруем сотрудников (скрываем удаленных, если нужно)
  const filteredStaff = React.useMemo(() => {
    const filtered = staffMembers.filter(staff => showDeleted ? true : !staff.deleted);
    logInfo(`Filtered staff: ${filtered.length} of ${staffMembers.length} items (showDeleted=${showDeleted})`);
    return filtered;
  }, [staffMembers, showDeleted]);

  // Обработчик выбора сотрудника
  const handleSelectStaff = (staffId: string) => {
    const staff = staffMembers.find(s => s.id === staffId);
    if (staff) {
      logInfo(`Staff selected: id=${staff.id}, name=${staff.name}`);
      setSelectedStaff(staff);
    }
  };

  // Обработчик изменения флага "показывать удаленных"
  const handleToggleShowDeleted = (
    ev?: React.MouseEvent<HTMLElement, MouseEvent>,
    checked?: boolean
  ) => {
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
          onChange={handleToggleShowDeleted}
          styles={{ root: { margin: '5px 0' } }}
        />
      </div>

      <div className={styles.staffList}>
        {filteredStaff.length === 0 ? (
          <div className={styles.noStaff}>No staff members found</div>
        ) : (
          filteredStaff.map(staff => (
            <div
              key={staff.id}
              className={`${styles.staffItem} ${selectedStaff?.id === staff.id ? styles.selected : ''} ${staff.deleted ? styles.deleted : ''}`}
              onClick={() => handleSelectStaff(staff.id)}
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