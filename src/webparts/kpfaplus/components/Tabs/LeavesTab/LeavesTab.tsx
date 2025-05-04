import * as React from 'react';
import { useEffect, useState } from 'react';
import { useDataContext } from '../../../context';
import { ITabProps } from '../../../models/types';
import { DetailsList, DetailsListLayoutMode, SelectionMode, IColumn, PrimaryButton, TextField, DatePicker, Panel, Toggle } from '@fluentui/react';
import { IDepartment } from '../../../services/DepartmentService';

export interface ILeaveRecord {
  id: string;
  startDate: Date;
  endDate: Date;
  type: string;
  approved: boolean;
  notes: string;
}

export const LeavesTab: React.FC<ITabProps> = (props) => {
  const { selectedStaff } = props;
  const { departments, selectedDepartmentId } = useDataContext();

  // Состояние для отпусков
  const [leaves, setLeaves] = useState<ILeaveRecord[]>([]);
  
  // Состояние для панели добавления/редактирования отпуска
  const [isLeaveFormOpen, setIsLeaveFormOpen] = useState<boolean>(false);
  const [editingLeave, setEditingLeave] = useState<ILeaveRecord | undefined>(undefined);
  
  // Состояние для фильтрации
  const [showApprovedOnly, setShowApprovedOnly] = useState<boolean>(false);
  
  // Состояние для новой записи отпуска
  const [newLeave, setNewLeave] = useState<ILeaveRecord>({
    id: '',
    startDate: new Date(),
    endDate: new Date(),
    type: 'Annual Leave',
    approved: false,
    notes: ''
  });
  
  // Загрузка отпусков (заглушка) - определяем функцию перед её использованием
  const loadLeaves = (): void => {
    // В будущем здесь будет реальный запрос к SharePoint
    const mockLeaves: ILeaveRecord[] = [
      {
        id: '1',
        startDate: new Date(2023, 5, 15),
        endDate: new Date(2023, 5, 30),
        type: 'Annual Leave',
        approved: true,
        notes: 'Summer vacation'
      },
      {
        id: '2',
        startDate: new Date(2023, 9, 10),
        endDate: new Date(2023, 9, 12),
        type: 'Sick Leave',
        approved: false,
        notes: 'Doctor appointment'
      },
      {
        id: '3',
        startDate: new Date(2023, 11, 24),
        endDate: new Date(2023, 11, 31),
        type: 'Annual Leave',
        approved: true,
        notes: 'Christmas holidays'
      }
    ];
    
    setLeaves(mockLeaves);
  };
  
  // Загрузка отпусков при изменении сотрудника
  useEffect(() => {
    if (selectedStaff) {
      loadLeaves();
    }
  }, [selectedStaff]);
  
  // Обработчик для открытия формы нового отпуска
  const openNewLeaveForm = (): void => {
    setEditingLeave(undefined);
    
    // Сбрасываем новый отпуск до значений по умолчанию
    setNewLeave({
      id: '',
      startDate: new Date(),
      endDate: new Date(),
      type: 'Annual Leave',
      approved: false,
      notes: ''
    });
    
    setIsLeaveFormOpen(true);
  };
  
  // Обработчик для открытия формы редактирования отпуска
  const openEditLeaveForm = (leave: ILeaveRecord): void => {
    setEditingLeave(leave);
    setNewLeave({ ...leave });
    setIsLeaveFormOpen(true);
  };
  
  // Обработчик для закрытия формы отпуска
  const closeLeaveForm = (): void => {
    setIsLeaveFormOpen(false);
  };
  
  // Обработчик для сохранения отпуска
  const saveLeave = (): void => {
    if (editingLeave) {
      // Обновляем существующий отпуск
      const updatedLeaves = leaves.map(leave => 
        leave.id === editingLeave.id ? { ...newLeave } : leave
      );
      setLeaves(updatedLeaves);
    } else {
      // Добавляем новый отпуск
      const newId = (leaves.length + 1).toString();
      const newLeaveRecord = { ...newLeave, id: newId };
      setLeaves([...leaves, newLeaveRecord]);
    }
    
    closeLeaveForm();
  };
  
  // Обработчик для удаления отпуска
  const deleteLeave = (leaveId: string): void => {
    const updatedLeaves = leaves.filter(leave => leave.id !== leaveId);
    setLeaves(updatedLeaves);
  };
  
  // Обработчик для изменения статуса отпуска
  const toggleLeaveApproval = (leaveId: string): void => {
    const updatedLeaves = leaves.map(leave => {
      if (leave.id === leaveId) {
        return { ...leave, approved: !leave.approved };
      }
      return leave;
    });
    setLeaves(updatedLeaves);
  };
  
  // Обработчик для изменения даты начала
  const handleStartDateChange = (date: Date | null | undefined): void => {
    if (date) {
      setNewLeave({ ...newLeave, startDate: date });
    }
  };
  
  // Обработчик для изменения даты окончания
  const handleEndDateChange = (date: Date | null | undefined): void => {
    if (date) {
      setNewLeave({ ...newLeave, endDate: date });
    }
  };
  
  // Обработчик для изменения типа отпуска
  const handleTypeChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
    if (newValue !== undefined) {
      setNewLeave({ ...newLeave, type: newValue });
    }
  };
  
  // Обработчик для изменения заметок
  const handleNotesChange = (event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string): void => {
    if (newValue !== undefined) {
      setNewLeave({ ...newLeave, notes: newValue });
    }
  };
  
  // Обработчик для изменения фильтра "только одобренные"
  const handleShowApprovedOnlyChange = (event: React.MouseEvent<HTMLElement>, checked?: boolean): void => {
    if (checked !== undefined) {
      setShowApprovedOnly(checked);
    }
  };
  
  // Колонки для таблицы отпусков
  const columns: IColumn[] = [
    {
      key: 'startDate',
      name: 'Start Date',
      fieldName: 'startDate',
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: ILeaveRecord) => item.startDate.toLocaleDateString()
    },
    {
      key: 'endDate',
      name: 'End Date',
      fieldName: 'endDate',
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: ILeaveRecord) => item.endDate.toLocaleDateString()
    },
    {
      key: 'type',
      name: 'Type',
      fieldName: 'type',
      minWidth: 120,
      maxWidth: 180
    },
    {
      key: 'approved',
      name: 'Status',
      fieldName: 'approved',
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: ILeaveRecord) => (
        <span 
          style={{ 
            color: item.approved ? 'green' : 'red',
            fontWeight: 'bold'
          }}
        >
          {item.approved ? 'Approved' : 'Pending'}
        </span>
      )
    },
    {
      key: 'notes',
      name: 'Notes',
      fieldName: 'notes',
      minWidth: 200
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 150,
      onRender: (item: ILeaveRecord) => (
        <div>
          <PrimaryButton 
            text="Edit" 
            onClick={() => openEditLeaveForm(item)}
            styles={{ root: { marginRight: 8, minWidth: 60 } }}
          />
          <PrimaryButton 
            text={item.approved ? 'Unapprove' : 'Approve'} 
            onClick={() => toggleLeaveApproval(item.id)}
            styles={{ 
              root: { 
                marginRight: 8, 
                minWidth: 80, 
                backgroundColor: item.approved ? 'orange' : 'green' 
              } 
            }}
          />
          <PrimaryButton 
            text="Delete" 
            onClick={() => deleteLeave(item.id)}
            styles={{ root: { backgroundColor: 'red', minWidth: 60 } }}
          />
        </div>
      )
    }
  ];
  
  // Фильтрация отпусков
  const filteredLeaves = showApprovedOnly 
    ? leaves.filter(leave => leave.approved) 
    : leaves;
  
  // Получение информации о департаменте
  const currentDepartment = departments.find(
    (dept: IDepartment) => dept.ID.toString() === selectedDepartmentId
  );
  
  // Вычисление общего количества дней отпуска
  const calculateTotalLeaveDays = (): number => {
    return filteredLeaves.reduce((total, leave) => {
      const diffTime = Math.abs(leave.endDate.getTime() - leave.startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 чтобы включить день начала
      return total + diffDays;
    }, 0);
  };
  
  return (
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
        <div>
          <h2 style={{ margin: '0 0 5px 0' }}>
            Leaves for {selectedStaff?.name} 
            {currentDepartment && ` (${currentDepartment.Title})`}
          </h2>
          <p style={{ margin: '0', color: '#666' }}>
            Total Leave Days: {calculateTotalLeaveDays()} days
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Toggle
            label="Show Approved Only"
            checked={showApprovedOnly}
            onChange={handleShowApprovedOnlyChange}
            styles={{
              root: { marginRight: '20px' }
            }}
          />
          <PrimaryButton 
            text="Add New Leave" 
            onClick={openNewLeaveForm}
          />
        </div>
      </div>
      
      <DetailsList
        items={filteredLeaves}
        columns={columns}
        layoutMode={DetailsListLayoutMode.justified}
        selectionMode={SelectionMode.none}
        isHeaderVisible={true}
        compact={false}
      />
      
      <Panel
        isOpen={isLeaveFormOpen}
        onDismiss={closeLeaveForm}
        headerText={editingLeave ? 'Edit Leave' : 'Add New Leave'}
        closeButtonAriaLabel="Close"
        isLightDismiss={true}
      >
        <div style={{ padding: '10px' }}>
          <DatePicker
            label="Start Date"
            value={newLeave.startDate}
            onSelectDate={handleStartDateChange}
            style={{ marginBottom: '15px' }}
          />
          <DatePicker
            label="End Date"
            value={newLeave.endDate}
            onSelectDate={handleEndDateChange}
            style={{ marginBottom: '15px' }}
          />
          <TextField
            label="Leave Type"
            value={newLeave.type}
            onChange={handleTypeChange}
            style={{ marginBottom: '15px' }}
          />
          <Toggle
            label="Approved"
            checked={newLeave.approved}
            onChange={(ev, checked) => {
              if (checked !== undefined) {
                setNewLeave({ ...newLeave, approved: checked });
              }
            }}
            style={{ marginBottom: '15px' }}
          />
          <TextField
            label="Notes"
            value={newLeave.notes}
            onChange={handleNotesChange}
            multiline
            rows={4}
            style={{ marginBottom: '20px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton 
              text="Cancel" 
              onClick={closeLeaveForm}
              styles={{ root: { marginRight: 8, backgroundColor: '#ccc' } }}
            />
            <PrimaryButton 
              text="Save" 
              onClick={saveLeave}
            />
          </div>
        </div>
      </Panel>
    </div>
  );
};