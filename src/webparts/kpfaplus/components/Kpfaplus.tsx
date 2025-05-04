// src/webparts/kpfaplus/components/Kpfaplus.tsx
import * as React from 'react';
import { useState } from 'react';
import { IKPFAprops } from './IKpfaplusProps';
import { StaffGallery } from './StaffGallery/StaffGallery';
import { Pivot, PivotItem, Toggle } from '@fluentui/react';
import { useDataContext } from '../context';
import { LoadingProgress } from './LoadingProgress/LoadingProgress';
import { RefreshButton } from './RefreshButton/RefreshButton';

// Импортируем компоненты вкладок
import { MainTab } from './Tabs/MainTab/MainTab';
import { ContractsTab } from './Tabs/ContractsTab/ContractsTab';
import { NotesTab } from './Tabs/NotesTab/NotesTab';
import { LeavesTab } from './Tabs/LeavesTab/LeavesTab';
import { LeaveTimeByYearsTab } from './Tabs/LeaveTimeByYearsTab/LeaveTimeByYearsTab';
import { SRSTab } from './Tabs/SRSTab/SRSTab';

const Kpfaplus: React.FC<IKPFAprops> = (props): JSX.Element => {
  // Получаем данные из контекста вместо локальных состояний
  const {
    // Данные пользователя
    currentUser,
    
    // Данные департаментов
    departments,
    selectedDepartmentId,
    setSelectedDepartmentId,
    
    // Данные сотрудников
    staffMembers,
    selectedStaff,
    setSelectedStaff,
    
    // Состояние загрузки
    loadingState,
    
    // Методы обновления данных
    refreshData
  } = useDataContext();
  
  // Состояние для вкладок
  const [selectedTabKey, setSelectedTabKey] = useState<string>('main');
  
  // Состояние для отображения удаленных сотрудников
  const [showDeleted, setShowDeleted] = useState<boolean>(false);
  
  // Состояние для отображения деталей загрузки
  const [showLoadingDetails, setShowLoadingDetails] = useState<boolean>(false);
  
  // Дополнительные состояния для данных в вкладках
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true);
  const [srsFilePath, setSrsFilePath] = useState<string>('');
  const [generalNote, setGeneralNote] = useState<string>('');

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedDepartmentId(e.target.value);
  };

  const handleStaffSelect = (staff: any): void => {
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

  // Обработчик для переключения отображения деталей загрузки
  const handleToggleLoadingDetails = (event: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setShowLoadingDetails(checked);
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

  // Если данные загружаются, показываем компонент загрузки
  if (loadingState.isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <Toggle
            label="Show loading details"
            checked={showLoadingDetails}
            onChange={handleToggleLoadingDetails}
          />
        </div>
        <LoadingProgress showDetail={showLoadingDetails} />
      </div>
    );
  }

  // Если произошла ошибка, показываем компонент загрузки с ошибкой
  if (loadingState.hasError) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ marginBottom: '15px' }}>
          <Toggle
            label="Show error details"
            checked={showLoadingDetails}
            onChange={handleToggleLoadingDetails}
          />
        </div>
        <LoadingProgress showDetail={showLoadingDetails} />
        
        <div style={{ marginTop: '20px' }}>
          <button 
            onClick={() => refreshData()}
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#0078d4', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
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
              {departments.map((dept) => (
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
          {/* Информация о текущем пользователе и система логирования */}
          <div style={{ 
            backgroundColor: '#f6f6f6', 
            padding: '8px', 
            marginBottom: '10px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                {currentUser && `Текущий пользователь: ${currentUser.Title} (ID: ${currentUser.ID})`}
                {departments.length > 0 && ` | Управляет департаментами: ${departments.length}`}
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <RefreshButton title="Обновить данные" />
                <Toggle
                  label="Show loading log"
                  checked={showLoadingDetails}
                  onChange={handleToggleLoadingDetails}
                  styles={{
                    root: { margin: 0, marginLeft: '10px' },
                    label: { fontSize: '12px' }
                  }}
                />
              </div>
            </div>
            
            {/* Показываем журнал загрузки, если включен */}
            {showLoadingDetails && (
              <div style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 5px 0', fontSize: '14px' }}>Loading Log:</h4>
                <ul style={{ margin: 0, padding: '0 0 0 20px', fontSize: '11px' }}>
                  {loadingState.loadingSteps.map((step, index) => (
                    <li key={index} style={{ marginBottom: '2px' }}>
                      <span style={{ 
                        display: 'inline-block', 
                        width: '16px',
                        marginRight: '5px',
                        textAlign: 'center'
                      }}>
                        {step.status === 'pending' && '⏱️'}
                        {step.status === 'loading' && '🔄'}
                        {step.status === 'success' && '✅'}
                        {step.status === 'error' && '❌'}
                      </span>
                      <span style={{ fontWeight: 'bold' }}>{step.description}</span>
                      {step.details && <span style={{ marginLeft: '5px', color: '#666' }}>- {step.details}</span>}
                      <span style={{ color: '#888', marginLeft: '5px', fontSize: '10px' }}>
                        ({step.timestamp.toLocaleTimeString()})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

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