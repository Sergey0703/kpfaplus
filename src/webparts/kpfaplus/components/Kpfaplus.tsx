import * as React from 'react';
import { useState } from 'react';
import styles from './Kpfaplus.module.scss';
import { IKpfaplusProps } from './IKpfaplusProps';
import { IStaffMember, IDepartment } from '../models/types';
import { DepartmentSelector } from './DepartmentSelector/DepartmentSelector';
import { StaffGallery } from './StaffGallery/StaffGallery';
import { TabNavigation } from './Tabs/TabNavigation';
import { MainTab } from './Tabs/MainTab/MainTab';
import { ContractsTab } from './Tabs/ContractsTab/ContractsTab';
import { NotesTab } from './Tabs/NotesTab/NotesTab';
import { LeavesTab } from './Tabs/LeavesTab/LeavesTab';
import { LeaveTimeByYearsTab } from './Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab';
import { SRSTab } from './Tabs/SRSTab/SRSTab';

const Kpfaplus: React.FC<IKpfaplusProps> = (props) => {
  const { hasTeamsContext } = props;

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
  const [staffMembers, setStaffMembers] = useState<IStaffMember[]>(mockStaffMembers);
  const [selectedStaff, setSelectedStaff] = useState<IStaffMember | null>(mockStaffMembers[0]);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  const [selectedTabKey, setSelectedTabKey] = useState<string>('main');

  // Обработчики событий
  const handleDepartmentChange = (departmentKey: string): void => {
    setSelectedDepartment(departmentKey);
    // Здесь будет загрузка сотрудников для выбранного подразделения
  };

  const handleStaffSelect = (staff: IStaffMember): void => {
    setSelectedStaff(staff);
  };

  const handleShowDeletedChange = (showDeleted: boolean): void => {
    setShowDeleted(showDeleted);
  };

  const handleTabChange = (tabKey: string): void => {
    setSelectedTabKey(tabKey);
  };

  const handleStaffUpdate = (updatedStaff: IStaffMember): void => {
    // Здесь будет обновление данных сотрудника
    const updatedStaffList = staffMembers.map(staff => 
      staff.id === updatedStaff.id ? updatedStaff : staff
    );
    setStaffMembers(updatedStaffList);
    setSelectedStaff(updatedStaff);
  };

  // Рендеринг активной вкладки
  const renderActiveTab = (): JSX.Element => {
    const tabProps = { selectedStaff, onStaffUpdate: handleStaffUpdate };
    
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
    <div className={`${styles.kpfaplus} ${hasTeamsContext ? styles.teams : ''}`}>
      <div className={styles.container}>
        <div className={styles.sidePanel}>
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
        </div>
        
        <div className={styles.mainPanel}>
          <TabNavigation 
            selectedTabKey={selectedTabKey}
            onTabChange={handleTabChange}
          />
          
          <div className={styles.content}>
            {renderActiveTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kpfaplus;