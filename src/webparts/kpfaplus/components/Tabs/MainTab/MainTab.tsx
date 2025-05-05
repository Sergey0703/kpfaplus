// src/webparts/kpfaplus/components/Tabs/MainTab/MainTab.tsx
import * as React from 'react';
import { ITabProps } from '../../../models/types';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { TextField } from '@fluentui/react/lib/TextField';
import { IconButton } from '@fluentui/react/lib/Button';
import styles from './MainTab.module.scss';

export const MainTab: React.FC<ITabProps> = (props) => {
 const { 
   selectedStaff, 
   autoSchedule, 
   onAutoScheduleChange,
   srsFilePath,
   onSrsFilePathChange,
   generalNote,
   onGeneralNoteChange,
   isEditMode,
   onSave,
   onCancel,
   onEdit,
   onDelete
 } = props;

 if (!selectedStaff) {
   return <div>Please select a staff member</div>;
 }

 // Инлайн-стили для позиционирования кнопок
 const buttonContainerStyle = {
   float: 'right' as const,
   marginTop: '-30px',
   marginBottom: '10px',
   display: 'flex',
   gap: '5px'
 };

 // Стили для разных иконок
 const editButtonStyle = {
   color: '#0078d4' // синий цвет для редактирования
 };

 const saveButtonStyle = {
   color: '#107c10' // зеленый цвет для сохранения
 };

 const cancelButtonStyle = {
   color: '#797775' // серый цвет для отмены
 };

 const deleteButtonStyle = {
   color: '#d83b01' // красный цвет для удаления
 };

 const restoreButtonStyle = {
   color: '#107c10' // зеленый цвет для восстановления
 };

 return (
   <div className={styles.mainTab}>
     <div className={styles.header}>
       <h2 className={styles.staffName}>{selectedStaff.name}</h2>
     </div>
     
     {/* Кнопки действий в правом верхнем углу */}
     <div style={buttonContainerStyle}>
       {isEditMode ? (
         <>
           <IconButton 
             iconProps={{ iconName: 'Save' }} 
             title="Сохранить" 
             ariaLabel="Сохранить" 
             onClick={onSave}
             styles={{
               icon: saveButtonStyle
             }}
           />
           <IconButton 
             iconProps={{ iconName: 'Cancel' }} 
             title="Отмена" 
             ariaLabel="Отмена" 
             onClick={onCancel}
             styles={{
               icon: cancelButtonStyle
             }}
           />
         </>
       ) : (
         <>
           <IconButton 
             iconProps={{ iconName: 'Edit' }} 
             title="Редактировать" 
             ariaLabel="Редактировать" 
             onClick={onEdit}
             styles={{
               icon: editButtonStyle
             }}
           />
           <IconButton 
             iconProps={{ 
               iconName: selectedStaff.deleted === 1 ? 'RedoSolid' : 'Delete' 
             }} 
             title={selectedStaff.deleted === 1 ? "Восстановить" : "Удалить"} 
             ariaLabel={selectedStaff.deleted === 1 ? "Восстановить" : "Удалить"}
             onClick={onDelete}
             styles={{
               icon: selectedStaff.deleted === 1 ? restoreButtonStyle : deleteButtonStyle
             }}
           />
         </>
       )}
     </div>

     {/* Остальной код компонента без изменений */}
     <div className={styles.staffInfo}>
       <div className={styles.profilePhoto}>
         {/* Placeholder for profile photo */}
         <div className={styles.photoPlaceholder} />
       </div>
       <div className={styles.staffDetails}>
         <div>
           <label>EmployeeID:</label>
           <span>{selectedStaff.employeeId || 'N/A'}</span>
         </div>
         <div>
           <label>ID:</label>
           <span>{selectedStaff.id || 'N/A'}</span>
         </div>
         <div>
           <label>GroupMemberID:</label>
           <span>{selectedStaff.groupMemberId || 'N/A'}</span>
         </div>
       </div>
     </div>
     
     <div className={styles.staffMetadata}>
       {/* Toggle для Autoschedule */}
       <div className={styles.autoSchedule}>
         <Toggle
           label="Autoschedule"
           checked={autoSchedule}
           onChange={onAutoScheduleChange}
           disabled={!isEditMode}
         />
       </div>
     </div>

     {/* Поле для пути SRS файла */}
     <div className={styles.fieldContainer}>
       <TextField
         label="Path for SRS file:"
         value={srsFilePath || ''}
         onChange={(_, newValue) => onSrsFilePathChange?.(newValue || '')}
         className={styles.srsPathField}
         readOnly={!isEditMode}
         disabled={!isEditMode}
       />
     </div>

     {/* Поле для общей заметки */}
     <div className={styles.fieldContainer}>
       <TextField
         label="General note:"
         value={generalNote || ''}
         onChange={(_, newValue) => onGeneralNoteChange?.(newValue || '')}
         multiline
         rows={5}
         className={styles.generalNoteField}
         readOnly={!isEditMode}
         disabled={!isEditMode}
       />
     </div>
   </div>
 );
};