import * as React from 'react';
import { useState } from 'react';
import styles from './Kpfaplus.module.scss';
import { IKpfaplusProps } from './IKpfaplusProps';
import { IStaffMember, IDepartment } from '../models/types';
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

// Импортируем компонент галереи сотрудников
import { StaffGallery } from './StaffGallery/StaffGallery';

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
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState<boolean>(false);

  // Обработчики событий
  const handleDepartmentChange = (departmentKey: string): void => {
    setSelectedDepartment(departmentKey);
    // Здесь будет загрузка сотрудников для выбранного подразделения
  };

  const handleStaffSelect = (staff: IStaffMember): void => {
    setSelectedStaff(staff);
    // Здесь будет загрузка данных выбранного сотрудника
  };

  const handleShowDeletedChange = (showDeleted: boolean): void => {
    setShowDeleted(showDeleted);
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

  const toggleLeftPanel = (): void => {
    setIsLeftPanelCollapsed(!isLeftPanelCollapsed);
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
    <div className={styles.kpfaplus} style={{ width: '100%', height: '100%', margin: 0, padding: 0, position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* Левая панель */}
        <div 
          className={styles.leftPanel} 
          style={{ 
            width: isLeftPanelCollapsed ? '40px' : '200px', 
            minWidth: isLeftPanelCollapsed ? '40px' : '200px',
            height: '100%', 
            overflowY: 'auto', 
            backgroundColor: '#f0f6ff',
            padding: isLeftPanelCollapsed ? '10px 5px' : '10px',
            borderRight: '1px solid #ddd',
            transition: 'width 0.3s ease-in-out',
            boxSizing: 'border-box'
          }}
        >
          {!isLeftPanelCollapsed && (
            <>
              <DepartmentSelector
                departments={departments}
                selectedDepartment={selectedDepartment}
                onDepartmentChange={handleDepartmentChange}
              />
              
              <StaffGallery
                staffMembers={staffMembers}
                selectedStaff={selectedStaff}
                showDeleted={showDeleted}
                onShowDeletedChange={handleShowDeletedChange}
                onStaffSelect={handleStaffSelect}
              />
            </>
          )}
          <div 
            onClick={toggleLeftPanel}
            style={{
              position: 'absolute',
              top: '50%',
              left: isLeftPanelCollapsed ? '30px' : '190px',
              width: '20px',
              height: '50px',
              backgroundColor: '#0078d4',
              color: 'white',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              borderRadius: isLeftPanelCollapsed ? '0 5px 5px 0' : '5px 0 0 5px',
              transition: 'left 0.3s ease-in-out',
              zIndex: 100
            }}
          >
            {isLeftPanelCollapsed ? '>' : '<'}
          </div>
        </div>
        
        {/* Правая панель */}
        <div 
          className={styles.rightPanel} 
          style={{ 
            flex: 1, 
            height: '100%', 
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            margin: 0,
            padding: '5px'
          }}
        >
          {/* Правая панель с вкладками и содержимым */}
          <div className={styles.tabsContainer}>
            <Pivot 
              selectedKey={selectedTabKey} 
              onLinkClick={handleTabChange}
              style={{ marginBottom: '5px' }}
            >
              <PivotItem itemKey="main" headerText="Main" />
              <PivotItem itemKey="contracts" headerText="Contracts" />
              <PivotItem itemKey="notes" headerText="Notes" />
              <PivotItem itemKey="leaves" headerText="Leaves" />
              <PivotItem itemKey="leaveTime" headerText="Leave Time by Years" />
              <PivotItem itemKey="srs" headerText="SRS" />
            </Pivot>
          </div>
          
          <div 
            className={styles.contentArea} 
            style={{ 
              verticalAlign: 'top', 
              display: 'block', 
              width: '100%', 
              maxWidth: '100%',
              overflowX: 'auto',
              boxSizing: 'border-box',
              margin: 0,
              padding: '5px'
            }}
          >
            {renderActiveTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kpfaplus;