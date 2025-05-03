import * as React from 'react';
import { useState, useEffect } from 'react';
import { IKpfaplusProps } from './IKpfaplusProps';
import { DepartmentService, IDepartment } from '../services/DepartmentService';
import { StaffGallery } from './StaffGallery/StaffGallery';
import { Pivot, PivotItem } from '@fluentui/react/lib/Pivot';

// Интерфейс для сотрудника
interface IStaffMember {
  id: string;
  name: string;
  groupMemberId: string;
  employeeId: string;
  deleted?: boolean;
}

const Kpfaplus: React.FC<IKpfaplusProps> = (props) => {
  // Инициализируем сервис
  const departmentService = new DepartmentService(props.context);
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Состояние для сотрудников
  const [staffMembers, setStaffMembers] = useState<IStaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<IStaffMember | undefined>(undefined);
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Состояние для вкладок
  const [selectedTabKey, setSelectedTabKey] = useState<string>('main');

  // Загрузка данных при инициализации компонента
  useEffect(() => {
    fetchDepartments();
  }, []);

  // При изменении выбранного департамента, загружаем его сотрудников
  useEffect(() => {
    if (selectedDepartmentId) {
      // В будущем здесь будет реальный запрос к SharePoint
      // Пока используем временные данные
      loadMockStaffMembers(selectedDepartmentId);
    }
  }, [selectedDepartmentId]);

  // Загрузка департаментов
  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const depts = await departmentService.fetchDepartments();
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

  // Временная функция для загрузки сотрудников (будет заменена на реальный API)
  const loadMockStaffMembers = (departmentId: string) => {
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

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
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

  // Если данные загружаются, показываем загрузчик
  if (isLoading) {
    return <div>Загрузка данных...</div>;
  }

  // Рендеринг содержимого вкладки
  const renderTabContent = () => {
    if (!selectedStaff) {
      return <div>Please select a staff member</div>;
    }

    switch (selectedTabKey) {
      case 'main':
        return (
          <div>
            <h3>{selectedStaff.name}</h3>
            <p>EmployeeID: {selectedStaff.employeeId || 'N/A'}</p>
            <p>ID: 1</p>
            <p>GroupMemberID: {selectedStaff.groupMemberId}</p>
            <p>Autoschedule</p>
          </div>
        );
      case 'contracts':
        return <div>Contracts information for {selectedStaff.name}</div>;
      case 'notes':
        return <div>Notes for {selectedStaff.name}</div>;
      case 'leaves':
        return <div>Leaves information for {selectedStaff.name}</div>;
      case 'leaveTimeByYears':
        return <div>Leave Time by Years for {selectedStaff.name}</div>;
      case 'srs':
        return <div>SRS information for {selectedStaff.name}</div>;
      default:
        return <div>Select a tab</div>;
    }
  };

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