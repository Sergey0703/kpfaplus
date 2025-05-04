import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DataContext } from './DataContext';
import { IDataProviderProps, ILoadingState, ILoadingStep } from './types';
import { DepartmentService, IDepartment } from '../services/DepartmentService';
import { UserService, ICurrentUser } from '../services/UserService';
import { IStaffMember } from '../models/types';

export const DataProvider: React.FC<IDataProviderProps> = (props) => {
  const { context, children } = props;
  
  // Инициализируем сервисы
  const departmentService = React.useMemo(() => new DepartmentService(context), [context]);
  const userService = React.useMemo(() => new UserService(context), [context]);
  
  // Состояние для данных пользователя
  const [currentUser, setCurrentUser] = useState<ICurrentUser | undefined>(undefined);
  
  // Состояние для данных департаментов
  const [departments, setDepartments] = useState<IDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("");
  
  // Состояние для данных сотрудников
  const [staffMembers, setStaffMembers] = useState<IStaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<IStaffMember | undefined>(undefined);
  
  // Состояние загрузки
  const [loadingState, setLoadingState] = useState<ILoadingState>({
    isLoading: true,
    hasError: false,
    errorMessage: "",
    loadingSteps: [] // Пустой массив шагов загрузки
  });
  
  // Функция для добавления нового шага загрузки
  const addLoadingStep = (id: string, description: string, status: 'pending' | 'loading' | 'success' | 'error', details?: string): void => {
    setLoadingState((prevState: ILoadingState) => {
      // Проверяем, существует ли уже шаг с таким id
      const existingStepIndex = prevState.loadingSteps.findIndex((step: ILoadingStep) => step.id === id);
      
      let newSteps;
      if (existingStepIndex !== -1) {
        // Если шаг существует, обновляем его
        newSteps = [...prevState.loadingSteps];
        newSteps[existingStepIndex] = {
          ...newSteps[existingStepIndex],
          status,
          timestamp: new Date(),
          details: details || newSteps[existingStepIndex].details
        };
      } else {
        // Если шага нет, добавляем новый
        newSteps = [
          ...prevState.loadingSteps,
          {
            id,
            description,
            status,
            timestamp: new Date(),
            details
          }
        ];
      }
      
      return {
        ...prevState,
        loadingSteps: newSteps
      };
    });
  };
  
  // Функция для загрузки данных текущего пользователя
  const fetchCurrentUser = useCallback(async () => {
    try {
      addLoadingStep('fetch-current-user', 'Loading current user data', 'loading', 'Requesting user data from SharePoint list "Staff"');
      
      const user = await userService.getCurrentUser();
      
      if (user) {
        addLoadingStep('fetch-current-user', 'Loading current user data', 'success', `Found user: ${user.Title} (ID: ${user.ID})`);
        setCurrentUser(user);
      } else {
        addLoadingStep('fetch-current-user', 'Loading current user data', 'error', 'User not found in Staff list');
      }
      
      return user;
    } catch (error) {
      console.error("Error fetching current user:", error);
      addLoadingStep('fetch-current-user', 'Loading current user data', 'error', `Error: ${error}`);
      
      setLoadingState((prevState: ILoadingState) => ({
        ...prevState,
        hasError: true,
        errorMessage: `Error fetching current user: ${error}`
      }));
      return undefined;
    }
  }, [userService]);
  
  // Функция для загрузки данных департаментов
  const fetchDepartments = useCallback(async (user: ICurrentUser | undefined) => {
    try {
      if (user && user.ID) {
        // Если у нас есть пользователь, получаем его департаменты
        addLoadingStep('fetch-departments', 'Loading departments data', 'loading', `Loading departments for manager ID: ${user.ID}`);
        
        const depts = await departmentService.fetchDepartmentsByManager(user.ID);
        
        addLoadingStep('fetch-departments', 'Loading departments data', 'success', `Loaded ${depts.length} departments`);
        setDepartments(depts);
        
        // Выбираем первый департамент, если он есть
        if (depts.length > 0) {
          setSelectedDepartmentId(depts[0].ID.toString());
          addLoadingStep('select-department', 'Selecting default department', 'success', `Selected department: ${depts[0].Title} (ID: ${depts[0].ID})`);
        } else {
          addLoadingStep('select-department', 'Selecting default department', 'error', 'No departments available to select');
        }
      } else {
        // Если пользователь не определен, получаем все департаменты
        addLoadingStep('fetch-departments', 'Loading all departments', 'loading', 'User not identified, loading all departments');
        
        const depts = await departmentService.fetchDepartments();
        
        addLoadingStep('fetch-departments', 'Loading all departments', 'success', `Loaded ${depts.length} departments`);
        setDepartments(depts);
        
        // Выбираем первый департамент, если он есть
        if (depts.length > 0) {
          setSelectedDepartmentId(depts[0].ID.toString());
          addLoadingStep('select-department', 'Selecting default department', 'success', `Selected department: ${depts[0].Title} (ID: ${depts[0].ID})`);
        } else {
          addLoadingStep('select-department', 'Selecting default department', 'error', 'No departments available to select');
        }
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
      addLoadingStep('fetch-departments', 'Loading departments data', 'error', `Error: ${error}`);
      
      setLoadingState((prevState: ILoadingState) => ({
        ...prevState,
        hasError: true,
        errorMessage: `Error fetching departments: ${error}`
      }));
    }
  }, [departmentService]);
  
  // Временная функция для загрузки сотрудников (заглушка)
  const fetchStaffMembers = useCallback(async (departmentId: string) => {
    try {
      // В будущем здесь будет реальный запрос к SharePoint
      addLoadingStep('fetch-staff', 'Loading staff members', 'loading', `Loading staff for department ID: ${departmentId}`);
      
      // Имитируем задержку сетевого запроса
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Заглушка для данных
      const mockStaff: IStaffMember[] = [
        { id: '1', name: 'Adele Kerrisk', groupMemberId: '249', employeeId: '' },
        { id: '2', name: 'Anna Mujeni', groupMemberId: '250', employeeId: '' },
        { id: '3', name: 'Anne Casey', groupMemberId: '251', employeeId: '' },
        { id: '4', name: 'Serhii Baliasnyi', groupMemberId: '252', employeeId: '' },
        { id: '5', name: 'Christina Leahy', groupMemberId: '253', employeeId: '' },
        { id: '6', name: 'Christine Tyler Nolan', groupMemberId: '254', employeeId: '' },
        { id: '7', name: 'Ciara Palmer', groupMemberId: '255', employeeId: '' },
        { id: '8', name: 'Daniel Kelly', groupMemberId: '256', employeeId: '', deleted: true }
      ];
      
      addLoadingStep('fetch-staff', 'Loading staff members', 'success', `Loaded ${mockStaff.length} staff members (${mockStaff.filter(s => !s.deleted).length} active, ${mockStaff.filter(s => s.deleted).length} deleted)`);
      setStaffMembers(mockStaff);
      
      // Выбираем первого сотрудника, если он есть
      if (mockStaff.length > 0) {
        setSelectedStaff(mockStaff[0]);
        addLoadingStep('select-staff', 'Selecting default staff member', 'success', `Selected staff: ${mockStaff[0].name} (ID: ${mockStaff[0].id})`);
      } else {
        addLoadingStep('select-staff', 'Selecting default staff member', 'error', 'No staff members available to select');
      }
    } catch (error) {
      console.error("Error fetching staff members:", error);
      addLoadingStep('fetch-staff', 'Loading staff members', 'error', `Error: ${error}`);
      
      setLoadingState((prevState: ILoadingState) => ({
        ...prevState,
        hasError: true,
        errorMessage: `Error fetching staff members: ${error}`
      }));
    }
  }, []);
  
  // Функция для полного обновления данных
  const refreshData = useCallback(async () => {
    try {
      setLoadingState({
        isLoading: true,
        hasError: false,
        errorMessage: "",
        loadingSteps: [{
          id: 'refresh-start',
          description: 'Starting data refresh',
          status: 'loading',
          timestamp: new Date()
        }]
      });
      
      // Загружаем данные пользователя
      const user = await fetchCurrentUser();
      
      // Загружаем данные департаментов
      await fetchDepartments(user);
      
      // Если выбран департамент, загружаем его сотрудников
      if (selectedDepartmentId) {
        await fetchStaffMembers(selectedDepartmentId);
      }
      
      addLoadingStep('refresh-complete', 'Data refresh complete', 'success', 'All data loaded successfully');
      
      setLoadingState((prevState: ILoadingState) => ({
        ...prevState,
        isLoading: false
      }));
    } catch (error) {
      console.error("Error refreshing data:", error);
      addLoadingStep('refresh-error', 'Data refresh failed', 'error', `Error: ${error}`);
      
      setLoadingState((prevState: ILoadingState) => ({
        ...prevState,
        isLoading: false,
        hasError: true,
        errorMessage: `Error refreshing data: ${error}`
      }));
    }
  }, [fetchCurrentUser, fetchDepartments, fetchStaffMembers, selectedDepartmentId]);
  
  // Функция для обновления только департаментов
  const refreshDepartments = useCallback(async () => {
    try {
      addLoadingStep('refresh-departments', 'Refreshing departments', 'loading');
      await fetchDepartments(currentUser);
      addLoadingStep('refresh-departments', 'Refreshing departments', 'success', 'Departments refreshed successfully');
    } catch (error) {
      console.error("Error refreshing departments:", error);
      addLoadingStep('refresh-departments', 'Refreshing departments', 'error', `Error: ${error}`);
    }
  }, [fetchDepartments, currentUser]);
  
  // Функция для обновления только сотрудников
  const refreshStaffMembers = useCallback(async (departmentId: string) => {
    try {
      addLoadingStep('refresh-staff', 'Refreshing staff members', 'loading', `Department ID: ${departmentId}`);
      await fetchStaffMembers(departmentId);
      addLoadingStep('refresh-staff', 'Refreshing staff members', 'success', 'Staff members refreshed successfully');
    } catch (error) {
      console.error("Error refreshing staff members:", error);
      addLoadingStep('refresh-staff', 'Refreshing staff members', 'error', `Error: ${error}`);
    }
  }, [fetchStaffMembers]);
  
  // Инициализация приложения
  useEffect(() => {
    const initializeApp = async (): Promise<void> => {
      addLoadingStep('init', 'Initializing application', 'loading', 'Setting up services and context');
      
      // Подтверждаем инициализацию как выполненную
      addLoadingStep('init', 'Initializing application', 'success', 'Application initialized successfully');
      
      // Загружаем начальные данные
      await refreshData();
    };
    
    // Используем .catch() вместо void operator
    initializeApp().catch(error => console.error("Initialization error:", error));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // При изменении выбранного департамента загружаем его сотрудников
  useEffect(() => {
    if (selectedDepartmentId) {
      // Используем .catch() вместо void operator
      fetchStaffMembers(selectedDepartmentId).catch(error => console.error("Error fetching staff:", error));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartmentId]);
  
  // Формируем значение контекста
  const contextValue = {
    // Сервисные данные
    spContext: context,
    
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
    
    // Методы для управления данными
    refreshData,
    refreshDepartments,
    refreshStaffMembers
  };
  
  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};