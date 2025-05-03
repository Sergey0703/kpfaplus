import * as React from 'react';
import { useState } from 'react';
import styles from './Kpfaplus.module.scss';
import { IKpfaplusProps } from './IKpfaplusProps';
import { IStaffMember, IDepartment } from '../models/types';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { IconButton } from '@fluentui/react/lib/Button';
import { TextField } from '@fluentui/react/lib/TextField';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import { List } from '@fluentui/react/lib/List';

const Kpfaplus: React.FC<IKpfaplusProps> = (props) => {
  //const { hasTeamsContext } = props;

  // Временные данные - будут заменены на реальные данные из SharePoint
  const mockDepartments: IDepartment[] = [
    { key: 'lohan-lodge-s', text: 'Lohan Lodge(S)' },
    { key: 'department-2', text: 'Department 2' },
    { key: 'department-3', text: 'Department 3' },
  ];

  const mockStaffMembers: IStaffMember[] = [
    { id: '1', name: 'Adele Kerrisk', groupMemberId: '249', employeeId: '' },
    { id: '2', name: 'Anna Mujeni', groupMemberId: '250', employeeId: '' },
    { id: '3', name: 'Anne Casey', groupMemberId: '251', employeeId: '' },
    { id: '4', name: 'aSerhii Baliasnyi', groupMemberId: '252', employeeId: '' },
    { id: '5', name: 'Christina Leahy', groupMemberId: '253', employeeId: '' },
    { id: '6', name: 'Christine Tyler Nolan', groupMemberId: '254', employeeId: '' },
    { id: '7', name: 'Ciara Palmer', groupMemberId: '255', employeeId: '' },
    { id: '8', name: 'Daniel Kelly', groupMemberId: '256', employeeId: '', deleted: true },
    { id: '9', name: 'Denise Golden', groupMemberId: '257', employeeId: '' },
    { id: '10', name: 'Donald Clifford', groupMemberId: '258', employeeId: '' },
    { id: '11', name: 'Fiona Burke O Shea', groupMemberId: '259', employeeId: '' },
    { id: '12', name: 'James Broderick', groupMemberId: '260', employeeId: '' },
    { id: '13', name: 'Jane Counihan', groupMemberId: '261', employeeId: '' },
  ];

  // Состояние компонента
  const [departments] = useState<IDepartment[]>(mockDepartments);
  const [selectedDepartment, setSelectedDepartment] = useState<string>(mockDepartments[0].key);
  const [staffMembers] = useState<IStaffMember[]>(mockStaffMembers);
  //const [selectedStaff, setSelectedStaff] = useState<IStaffMember | null>(mockStaffMembers[0]);
  const [selectedStaff, setSelectedStaff] = useState<IStaffMember | undefined>(mockStaffMembers[0]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [selectedTabKey, setSelectedTabKey] = useState<string>('main');
  const [srsFilePath, setSrsFilePath] = useState<string>('path2222355789');
  const [generalNote, setGeneralNote] = useState<string>('Adele Kerr2222789');
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);

  // Обработчики событий
  const handleDepartmentChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
    if (option) {
      setSelectedDepartment(option.key as string);
      // Здесь будет загрузка сотрудников для выбранного подразделения
    }
  };

  const handleStaffSelect = (staff: IStaffMember): void => {
    setSelectedStaff(staff);
    // Здесь будет загрузка данных выбранного сотрудника
  };

  const handleShowDeletedChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setShowDeleted(checked);
    }
  };

  const handleTabChange = (item?: PivotItem): void => {
    if (item && item.props.itemKey) {
      setSelectedTabKey(item.props.itemKey);
    }
  };

  const handleSrsFilePathChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
    if (newValue !== undefined) {
      setSrsFilePath(newValue);
    }
  };

  const handleGeneralNoteChange = (ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
    if (newValue !== undefined) {
      setGeneralNote(newValue);
    }
  };

  const handleAutoScheduleChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setAutoSchedule(checked);
    }
  };

  // Рендер списка сотрудников
  const renderStaffList = (): JSX.Element => {
    const filteredStaff = showDeleted 
      ? staffMembers 
      : staffMembers.filter(staff => !staff.deleted);

    const onRenderCell = (item: IStaffMember): JSX.Element => {
      const isSelected = selectedStaff && selectedStaff.id === item.id;
      
      return (
        <div 
          className={`${styles.staffItem} ${isSelected ? styles.selected : ''}`}
          onClick={() => handleStaffSelect(item)}
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

    return (
      <div className={styles.staffList}>
        <List
          items={filteredStaff}
          onRenderCell={onRenderCell}
        />
      </div>
    );
  };

  // Содержимое вкладки Main
  const renderMainTab = (): JSX.Element => {
    if (!selectedStaff) {
      return <div>Выберите сотрудника</div>;
    }

    return (
      <div>
        <div className={styles.profileSection}>
          <div className={styles.profileImage}>
            <Persona 
              size={PersonaSize.size72}
              hidePersonaDetails={true}
              initialsColor="lightBlue"
              text={selectedStaff.name}
            />
          </div>
          <div className={styles.profileInfo}>
            <h2>{selectedStaff.name}</h2>
            <div>EmployeeID: {selectedStaff.employeeId || 'N/A'}</div>
          </div>
        </div>

        <div className={styles.infoField}>
          <div>ID: {selectedStaff.id || 'N/A'}</div>
          <div>GroupMemberID: {selectedStaff.groupMemberId || 'N/A'}</div>
        </div>

        <div className={styles.autoScheduleToggle}>
          <Toggle 
            label="Autoschedule" 
            checked={autoSchedule}
            onChange={handleAutoScheduleChange}
          />
        </div>

        <div className={styles.srsSection}>
          <div className={styles.infoField}>
            <TextField
              label="Path for SRS file:"
              value={srsFilePath}
              onChange={handleSrsFilePathChange}
            />
          </div>
          <div className={styles.infoField}>
            <TextField
              label="General note:"
              multiline
              rows={5}
              value={generalNote}
              onChange={handleGeneralNoteChange}
            />
          </div>
        </div>
      </div>
    );
  };

  // Заглушки для других вкладок
  const renderContractsTab = (): JSX.Element => {
    return <div>Содержимое вкладки Contracts для {selectedStaff?.name}</div>;
  };

  const renderNotesTab = (): JSX.Element => {
    return <div>Содержимое вкладки Notes для {selectedStaff?.name}</div>;
  };

  const renderLeavesTab = (): JSX.Element => {
    return <div>Содержимое вкладки Leaves для {selectedStaff?.name}</div>;
  };

  const renderLeaveTimeTab = (): JSX.Element => {
    return <div>Содержимое вкладки Leave Time by Years для {selectedStaff?.name}</div>;
  };

  const renderSRSTab = (): JSX.Element => {
    return <div>Содержимое вкладки SRS для {selectedStaff?.name}</div>;
  };

  // Рендеринг содержимого активной вкладки
  const renderActiveTabContent = (): JSX.Element => {
    switch (selectedTabKey) {
      case 'main':
        return renderMainTab();
      case 'contracts':
        return renderContractsTab();
      case 'notes':
        return renderNotesTab();
      case 'leaves':
        return renderLeavesTab();
      case 'leaveTime':
        return renderLeaveTimeTab();
      case 'srs':
        return renderSRSTab();
      default:
        return renderMainTab();
    }
  };

  return (
    <div className={styles.kpfaplus}>
      <div className={styles.contentContainer}>
        {/* Левая панель с селектором группы и списком сотрудников */}
        <div className={styles.leftPanel}>
          <div className={styles.departmentSection}>
            <div className={styles.departmentLabel}>Select Group</div>
            <Dropdown
              selectedKey={selectedDepartment}
              options={departments.map(dept => ({ key: dept.key, text: dept.text }))}
              onChange={handleDepartmentChange}
            />
          </div>
          
          <div className={styles.toggleContainer}>
            <span className={styles.toggleLabel}>Show Deleted</span>
            <Toggle 
              checked={showDeleted}
              onChange={handleShowDeletedChange}
              inlineLabel
            />
          </div>
          
          {renderStaffList()}
        </div>
        
        {/* Правая панель с вкладками и содержимым */}
        <div className={styles.rightPanel}>
          <div className={styles.tabsContainer}>
            <Pivot 
              selectedKey={selectedTabKey} 
              onLinkClick={handleTabChange}
            >
              <PivotItem itemKey="main" headerText="Main" />
              <PivotItem itemKey="contracts" headerText="Contracts" />
              <PivotItem itemKey="notes" headerText="Notes" />
              <PivotItem itemKey="leaves" headerText="Leaves" />
              <PivotItem itemKey="leaveTime" headerText="Leave Time by Years" />
              <PivotItem itemKey="srs" headerText="SRS" />
            </Pivot>
          </div>
          
          <div className={styles.contentArea}>
            {renderActiveTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kpfaplus;