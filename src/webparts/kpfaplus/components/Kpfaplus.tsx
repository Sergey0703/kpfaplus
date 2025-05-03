import * as React from 'react';
import { useState, useEffect } from 'react';
import { IKPFAprops } from './IKpfaplusProps';
import { DepartmentService, IDepartment } from '../services/DepartmentService';
import { StaffGallery } from './StaffGallery/StaffGallery';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';

// Импортируем компоненты вкладок
import { MainTab } from './Tabs/MainTab/MainTab';
import { ContractsTab } from './Tabs/ContractsTab/ContractsTab';
import { NotesTab } from './Tabs/NotesTab/NotesTab';
import { LeavesTab } from './Tabs/LeavesTab/LeavesTab';
import { LeaveTimeByYearsTab } from './Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab';
import { SRSTab } from './Tabs/SRSTab/SRSTab';

// Интерфейс для сотрудника
interface IStaffMember {
  id: string;
  name: string;
  groupMemberId: string;
  employeeId: string;
  deleted?: boolean;
}

const Kpfaplus: React.FC<IKPFAprops> = (props): JSX.Element => {
  // Инициализируем сервис
  const departmentService = React.useMemo(() => new DepartmentService(props.context), [props.context]);
  
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Состояние для сотрудников
  const [staffMembers, setStaffMembers] = useState<IStaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<IStaffMember | undefined>(undefined);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Состояние для вкладок
  const [selectedTabKey, setSelectedTabKey] = useState<string>('main');
  
  // Дополнительные состояния для данных в вкладках
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const [srsFilePath, setSrsFilePath] = useState<string>('');
  const [generalNote, setGeneralNote] = useState<string>('');

  // Загрузка департаментов
  const fetchDepartments = async (): Promise<void> => {
    try {
      setIsLoading(true);
      console.log("Fetching departments...");
      const depts = await departmentService.fetchDepartments();
      console.log(`Fetched ${depts.length} departments`);
      setDepartments(depts);
      
      // Если есть департаменты, выбираем первый
      if (depts.length > 0) {
        setSelectedDepartmentId(depts[0].ID.toString());
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
      setIsLoading(false);
    }
  };

  // Временная функция для загрузки сотрудников
  const loadMockStaffMembers = (departmentId: string): void => {
    console.log(`Loading staff for department ${departmentId}`);
    // Здесь в будущем будет реальный запрос к SharePoint
    const mockStaff: IStaffMember[] = [
      { id: '1', name: 'Adele Kerrisk', groupMemberId: '249', employeeId: '' },
      { id: '2', name: 'Anna Mujeni', groupMemberId: '250', employeeId: '' },
      { id: '3', name: 'Anne Casey', groupMemberId: '251', employeeId: '' },
      { id: '4', name: 'aSerhii Baliasnyi', groupMemberId: '252', employeeId: '' },
      { id: '5', name: 'Christina Leahy', groupMemberId: '253', employeeId: '' },
      { id: '6', name: 'Christine Tyler Nolan', groupMemberId: '254', employeeId: '' },
      { id: '7', name: 'Ciara Palmer', groupMemberId: '255', employeeId: '' },
      { id: '8', name: 'Daniel Kelly', groupMemberId: '256', employeeId: '', deleted: true }
    ];
    
    setStaffMembers(mockStaff);
    if (mockStaff.length > 0) {
      setSelectedStaff(mockStaff[0]);
    }
  };

  // Загрузка данных при инициализации компонента
  useEffect(() => {
    let isComponentMounted = true;
    
    const loadInitialData = async (): Promise<void> => {
      await fetchDepartments();
    };
    
    if (isComponentMounted) {
      loadInitialData().catch(error => {
        console.error("Error loading initial data:", error);
      });
    }
    
    return () => {
      isComponentMounted = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Пустой массив зависимостей - выполняется только при монтировании

  // При изменении выбранного департамента, загружаем его сотрудников
  useEffect(() => {
    if (selectedDepartmentId) {
      loadMockStaffMembers(selectedDepartmentId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartmentId]);

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedDepartmentId(e.target.value);
  };

  const handleStaffSelect = (staff: IStaffMember): void => {
    setSelectedStaff(staff);
  };

  const handleShowDeletedChange = (showDeleted: boolean): void => {
    setShowDeleted(showDeleted);
  };
  
  const handleTabChange = (item?: PivotItem): void => {
    if (item && item.props.itemKey) {
      setSelectedTabKey(item.props.itemKey);
    }
  };

  // Обработчики для дополнительных данных
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

  // Рендеринг содержимого вкладки
  const renderTabContent = (): JSX.Element => {
    if (!selectedStaff) {
      return <div>Please select a staff member</div>;
    }

    // Общие props для передачи во вкладки
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
      case 'leaveTimeByYears':
        return <LeaveTimeByYearsTab {...tabProps} />;
      case 'srs':
        return <SRSTab {...tabProps} />;
      default:
        return <div>Select a tab</div>;
    }
  };

  // Если данные загружаются, показываем загрузчик
  if (isLoading) {
    return <div>Загрузка данных...</div>;
  }

  return (
    <div style={{ width: '100%', height: '100%', margin: 0, padding: 0, position: 'relative' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* Левая панель */}
        <div style={{ 
          width: '200px', 
          minWidth: '200px',
          height: '100%',
          backgroundColor: '#f0f6ff',
          borderRight: '1px solid #ddd',
          padding: '10px'
        }}>
          <div style={{ marginBottom: '10px' }}>
            <label>Select Group</label>
            <select 
              value={selectedDepartmentId}
              onChange={handleDepartmentChange}
              style={{ 
                display: 'block', 
                width: '100%',
                padding: '5px',
                marginTop: '5px',
                border: '1px solid #ccc',
                borderRadius: '3px'
              }}
            >
              {departments.map((dept: IDepartment) => (
                <option key={dept.ID} value={dept.ID.toString()}>
                  {dept.Title}
                </option>
              ))}
            </select>
          </div>
          
          {/* Используем компонент StaffGallery */}
          <StaffGallery
            staffMembers={staffMembers}
            selectedStaff={selectedStaff}
            showDeleted={showDeleted}
            onShowDeletedChange={handleShowDeletedChange}
            onStaffSelect={handleStaffSelect}
          />
        </div>
        
        {/* Правая панель */}
        <div style={{ 
          flex: 1, 
          height: '100%', 
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          padding: '10px'
        }}>
          {/* Панель с вкладками */}
          <Pivot 
            selectedKey={selectedTabKey} 
            onLinkClick={handleTabChange}
            style={{ marginBottom: '15px' }}
          >
            <PivotItem itemKey="main" headerText="Main" />
            <PivotItem itemKey="contracts" headerText="Contracts" />
            <PivotItem itemKey="notes" headerText="Notes" />
            <PivotItem itemKey="leaves" headerText="Leaves" />
            <PivotItem itemKey="leaveTimeByYears" headerText="Leave Time by Years" />
            <PivotItem itemKey="srs" headerText="SRS" />
          </Pivot>
          
          {/* Содержимое активной вкладки */}
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Kpfaplus;