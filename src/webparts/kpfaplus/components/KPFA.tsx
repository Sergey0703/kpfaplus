import * as React from 'react';
import { useEffect, useState } from 'react';
import { IKPFAProps } from './IKPFAprops';
import { IDepartment } from '../services/DepartmentService';

export const KPFA: React.FC<IKPFAProps> = (props): JSX.Element => {
  // Объявляем локальные состояния
  const [selectedDepartment, setSelectedDepartment] = useState<IDepartment | null>(null);
  
  // Используем useEffect для установки defaultDepartment при монтировании компонента
  useEffect(() => {
    // Проверяем, есть ли departments и defaultDepartment в props
    if (props.departments && props.departments.length > 0) {
      // Если есть defaultDepartment, установим его
      if (props.defaultDepartment) {
        setSelectedDepartment(props.defaultDepartment);
      } else {
        // Иначе установим первый департамент из списка
        setSelectedDepartment(props.departments[0]);
      }
    }
  }, [props.departments, props.defaultDepartment]);

  // Обработчик изменения выбранного департамента
  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const departmentId = e.target.value;
    // Безопасно ищем департамент по ID
    if (props.departments) {
      const department = props.departments.find(d => d.ID.toString() === departmentId);
      if (department) {
        setSelectedDepartment(department);
      }
    }
  };

  return (
    <div className="kpfa-container">
      <div className="kpfa-header">
        <h2>KPFA Component</h2>
        
        {/* Выпадающий список с департаментами */}
        <div className="department-selector">
          <label htmlFor="department-select">Select Department:</label>
          <select 
            id="department-select"
            value={selectedDepartment?.ID.toString() || ''}
            onChange={handleDepartmentChange}
          >
            {props.departments && props.departments.map((dept: IDepartment) => (
              <option key={dept.ID} value={dept.ID.toString()}>
                {dept.Title}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Основное содержимое */}
      <div className="kpfa-content">
        {selectedDepartment ? (
          <div>
            <h3>Selected Department: {selectedDepartment.Title}</h3>
            <p>Department ID: {selectedDepartment.ID}</p>
            {/* Добавьте здесь другие детали департамента */}
          </div>
        ) : (
          <div>Please select a department</div>
        )}
      </div>
    </div>
  );
};

export default KPFA;