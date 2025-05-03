import * as React from 'react';
import { useState } from 'react';
import styles from './Kpfaplus.module.scss';
import { IKpfaplusProps } from './IKpfaplusProps';
import { IStaffMember, IDepartment } from '../models/types';
import { Toggle } from '@fluentui/react/lib/Toggle';
import { IconButton } from '@fluentui/react/lib/Button';
import { List } from '@fluentui/react/lib/List';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';

// Импортируем компоненты вкладок
import { MainTab } from './Tabs/MainTab/MainTab';
import { ContractsTab } from './Tabs/ContractsTab/ContractsTab';
import { NotesTab } from './Tabs/NotesTab/NotesTab';
import { LeavesTab } from './Tabs/LeavesTab/LeavesTab';
import { LeaveTimeByYearsTab } from './Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab';
import { SRSTab } from './Tabs/SRSTab/SRSTab';

// Импортируем компонент выбора департамента
import { DepartmentSelector } from './DepartmentSelector/DepartmentSelector';

const Kpfaplus: React.FC<IKpfaplusProps> = (props) => {
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
  const [selectedStaff, setSelectedStaff] = useState<IStaffMember | undefined>(mockStaffMembers[0]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [selectedTabKey, setSelectedTabKey] = useState<string>('main');
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const [srsFilePath, setSrsFilePath] = useState<string>('path2222355789');
  const [generalNote, setGeneralNote] = useState<string>('Adele Kerr2222789');

  // Обработчики событий
  const handleDepartmentChange = (departmentKey: string): void => {
    setSelectedDepartment(departmentKey);
    // Здесь будет загрузка сотрудников для выбранного подразделения
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

  const handleAutoScheduleChange = (ev: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setAutoSchedule(checked);
    }
  };

  const handleSrsFilePathChange = (newValue: string): void => {
    setSrsFilePath(newValue);
  };

  const handleGeneralNoteChange = (newValue: string): void => {
    setGeneralNote(newValue);
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

  // Рендеринг содержимого активной вкладки с проверкой наличия выбранного сотрудника
  const renderActiveTabContent = (): JSX.Element => {
    if (!selectedStaff) {
      return <div>Выберите сотрудника</div>;
    }

    // Общие props для передачи всем компонентам вкладок
    const tabProps = {
      selectedStaff,
      autoSchedule,
      onAutoScheduleChange: handleAutoScheduleChange,
      srsFilePath,
      onSrsFilePathChange: handleSrsFilePathChange,
      generalNote,
      onGeneralNoteChange: handleGeneralNoteChange
    };

    switch (selectedTabKey) {
      case 'main':
        return <MainTab {...tabProps} />;
      case 'contracts':
        return <ContractsTab {...tabProps} />;
      case 'notes':
        return <NotesTab {...tabProps} />;
      case 'leaves':
        return <LeavesTab {...tabProps} />;
      case 'leaveTime':
        return <LeaveTimeByYearsTab {...tabProps} />;
      case 'srs':
        return <SRSTab {...tabProps} />;
      default:
        return <MainTab {...tabProps} />;
    }
  };

  return (
    <div className={styles.kpfaplus}>
      <table className={styles.tableLayout} style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td 
              className={styles.leftCell} 
              valign="top" 
              style={{ verticalAlign: 'top' }}
            >
              {/* Левая панель с селектором группы и списком сотрудников */}
              <DepartmentSelector
                departments={departments}
                selectedDepartment={selectedDepartment}
                onDepartmentChange={handleDepartmentChange}
              />
              
              <div className={styles.toggleContainer}>
                <span className={styles.toggleLabel}>Show Deleted</span>
                <Toggle 
                  checked={showDeleted}
                  onChange={handleShowDeletedChange}
                  inlineLabel
                />
              </div>
              
              {renderStaffList()}
            </td>
            <td 
              className={styles.rightCell} 
              valign="top" 
              style={{ verticalAlign: 'top' }}
            >
              {/* Правая панель с вкладками и содержимым */}
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
              
              <div className={styles.contentArea} style={{ verticalAlign: 'top', display: 'block', marginTop: 0, paddingTop: 0 }}>
                {renderActiveTabContent()}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default Kpfaplus;