// src/webparts/kpfaplus/components/StaffGallery/StaffGallery.tsx
import * as React from 'react';
import { useEffect, useState } from 'react';
import { Toggle } from '@fluentui/react';
import { useDataContext } from '../../context';
import { IStaffMember } from '../../models/types';
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
      logInfo(`Staff [${index}]: id=${staff.id}, name=${staff.name}, deleted=${staff.deleted || 0}`);
    });
    
    if (staffMembers.length > 3) {
      logInfo(`... and ${staffMembers.length - 3} more items`);
    }
  }, [staffMembers]);

  // Фильтруем сотрудников (скрываем удаленных, если нужно)
  const filteredStaff = React.useMemo(() => {
    const filtered = staffMembers.filter(staff => showDeleted ? true : staff.deleted !== 1);
    logInfo(`Filtered staff: ${filtered.length} of ${staffMembers.length} items (showDeleted=${showDeleted})`);
    return filtered;
  }, [staffMembers, showDeleted]);

  // Обработчик выбора сотрудника
  const handleSelectStaff = (staffId: string): void => {
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
  ): void => {
    if (checked !== undefined) {
      logInfo(`Show deleted toggled: ${checked}`);
      setShowDeleted(checked);
    }
  };

  // Встроенные стили для элементов списка
  const getStaffItemStyle = (staff: IStaffMember, isSelected: boolean, isDeleted: boolean): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '8px 10px',
      cursor: 'pointer',
      borderBottom: '1px solid #f3f3f3',
      fontSize: '14px',
      transition: 'all 0.2s ease'
    };

    if (isSelected) {
      // Стили для выбранного элемента - комбинированный подход
      return {
        ...baseStyle,
        backgroundColor: '#f8fbff', // Очень светлый голубой фон
        color: '#1976d2', // Темно-синий текст вместо белого
        fontWeight: '600',
        borderLeft: '4px solid #0078d4', // Левая цветная полоска
        borderRadius: '6px', // Скругленные углы
        margin: '2px 0',
        boxShadow: '0 2px 8px rgba(0, 120, 212, 0.15)', // Легкая тень
        border: 'none', // Убираем основную рамку
        borderBottom: '1px solid #e8f4fd' // Очень светлая нижняя граница
      };
    } else {
      // Стили для обычного элемента
      const normalStyle: React.CSSProperties = {
        ...baseStyle,
        backgroundColor: '#ffffff',
        color: '#323130'
      };

      if (isDeleted) {
        normalStyle.opacity = 0.6;
        normalStyle.fontStyle = 'italic';
        normalStyle.color = '#605e5c';
      }

      return normalStyle;
    }
  };

  // Стили для hover эффекта (применяются через onMouseEnter/onMouseLeave)
  const getHoverStyle = (isSelected: boolean): React.CSSProperties => {
    if (isSelected) {
      return {
        backgroundColor: '#e8f4fd', // Более насыщенный светло-голубой для hover
        color: '#1565c0', // Чуть темнее синий текст
        boxShadow: '0 4px 16px rgba(0, 120, 212, 0.25)', // Более заметная тень
        transform: 'translateY(-1px)' // Легкий подъем элемента
      };
    } else {
      return {
        backgroundColor: '#f5f5f5', // Более заметный серый для hover
        borderRadius: '4px', // Легкое скругление при hover
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)', // Добавляем тень и для обычных элементов
        transform: 'translateY(-1px)' // Легкий подъем элемента
      };
    }
  };

  return (
    <div className={styles.staffGallery}>
      <div className={styles.header}>
        <h3>Staff Members</h3>
        <Toggle
          label="Show Deleted(end of the list)"
          checked={showDeleted}
          onChange={handleToggleShowDeleted}
          styles={{ root: { margin: '5px 0' } }}
        />
      </div>

      <div className={styles.staffList}>
        {filteredStaff.length === 0 ? (
          <div className={styles.noStaff}>No staff members found</div>
        ) : (
          filteredStaff.map(staff => {
            const isSelected = selectedStaff?.id === staff.id;
            const isDeleted = staff.deleted === 1;
            
            return (
              <div
                key={staff.id}
                style={getStaffItemStyle(staff, isSelected, isDeleted)}
                onClick={() => handleSelectStaff(staff.id)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    Object.assign(e.currentTarget.style, getHoverStyle(false));
                  }
                }}
                onMouseLeave={(e) => {
                  Object.assign(e.currentTarget.style, getStaffItemStyle(staff, isSelected, isDeleted));
                }}
              >
                <div>
                  {staff.name}
                  {isDeleted && <span style={{ fontStyle: 'italic', marginLeft: '5px' }}> (Deleted)</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};