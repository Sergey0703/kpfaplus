// src/webparts/kpfaplus/context/DataProvider.tsx
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DataContext } from './DataContext';
import { IDataProviderProps, ILoadingState, ILoadingStep, IStaffMemberUpdateData } from './types';
import { DepartmentService } from '../services/DepartmentService';
import { UserService, ICurrentUser } from '../services/UserService';
import { IStaffMember, IGroupMember, IDepartment } from '../models/types';
import { GroupMemberService } from '../services/GroupMemberService';

export const DataProvider: React.FC<IDataProviderProps> = (props) => {
 const { context, children } = props;
 
 // Инициализируем сервисы
 const departmentService = React.useMemo(() => new DepartmentService(context), [context]);
 const userService = React.useMemo(() => new UserService(context), [context]);
 const groupMemberService = React.useMemo(() => new GroupMemberService(context), [context]);
 
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
 
 // Функция для загрузки членов группы
 const fetchGroupMembers = useCallback(async (departmentId: string) => {
   try {
     // Проверяем, что departmentId не пустой и числовой
     if (!departmentId) {
       throw new Error("Department ID is empty");
     }
     
     const groupId = Number(departmentId);
     if (isNaN(groupId)) {
       throw new Error("Invalid Department ID format");
     }
     
     // Добавляем шаг в лог загрузки
     addLoadingStep('fetch-group-members', 'Loading staff members', 'loading', `Loading staff for group ID: ${groupId}`);
     
     // Получаем данные от сервиса
     const groupMembers: IGroupMember[] = await groupMemberService.fetchGroupMembersByGroupId(groupId);
     
     // Преобразуем данные в формат для отображения
const mappedStaffMembers: IStaffMember[] = groupMembers.map(gm => ({
   id: gm.ID.toString(),
   name: gm.Employee?.Title || gm.Title || '', // Используем имя сотрудника из Employee.Title
   groupMemberId: gm.ID.toString(),
   employeeId: gm.Employee ? gm.Employee.Id : '',
   autoSchedule: gm.AutoSchedule,
   pathForSRSFile: gm.PathForSRSFile,
   generalNote: gm.GeneralNote,
   deleted: gm.Deleted,
   contractedHours: gm.ContractedHours
   // фото добавим позже, когда будем получать данные по сотрудникам
 }));
     
     // Сортировка - сначала записи без Employee.Id, затем по Title
     const sortedStaffMembers = mappedStaffMembers.sort((a, b) => {
       const aHasEmployee = a.employeeId ? 1 : 0;
       const bHasEmployee = b.employeeId ? 1 : 0;
       
       // Сначала сортируем по наличию employeeId
       if (aHasEmployee !== bHasEmployee) {
         return aHasEmployee - bHasEmployee;
       }
       
       // Затем по имени (name)
       return a.name.localeCompare(b.name);
     });
     
     // Обновляем состояние
     setStaffMembers(sortedStaffMembers);
     
     // Выбираем первого сотрудника если есть
     if (sortedStaffMembers.length > 0) {
       setSelectedStaff(sortedStaffMembers[0]);
       addLoadingStep('select-staff', 'Selecting default staff member', 'success', `Selected staff: ${sortedStaffMembers[0].name} (ID: ${sortedStaffMembers[0].id})`);
     } else {
       addLoadingStep('select-staff', 'Selecting default staff member', 'error', 'No staff members available to select');
     }
     
     // Обновляем лог загрузки
     addLoadingStep('fetch-group-members', 'Loading staff members', 'success', 
       `Loaded ${groupMembers.length} staff members (${groupMembers.filter(gm => gm.Deleted !== 1).length} active, ${groupMembers.filter(gm => gm.Deleted === 1).length} deleted)`);
     
   } catch (error) {
     console.error("Error fetching group members:", error);
     addLoadingStep('fetch-group-members', 'Loading staff members', 'error', `Error: ${error}`);
     
     setLoadingState((prevState: ILoadingState) => ({
       ...prevState,
       hasError: true,
       errorMessage: `Error fetching staff members: ${error}`
     }));
   }
 }, [groupMemberService, addLoadingStep]);
 
 // Функция для загрузки сотрудников
 const fetchStaffMembers = useCallback(async (departmentId: string) => {
   try {
     // Вызываем новый метод для получения данных
     await fetchGroupMembers(departmentId);
   } catch (error) {
     console.error("Error in fetchStaffMembers:", error);
     addLoadingStep('fetch-staff', 'Loading staff members', 'error', `Error: ${error}`);
     
     setLoadingState((prevState: ILoadingState) => ({
       ...prevState,
       hasError: true,
       errorMessage: `Error fetching staff members: ${error}`
     }));
   }
 }, [fetchGroupMembers, addLoadingStep]);
 
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
 
 // Функция для обновления сотрудника
 const updateStaffMember = useCallback(async (staffId: string, data: IStaffMemberUpdateData): Promise<boolean> => {
   try {
     if (!staffId) {
       throw new Error("Staff ID is empty");
     }
     
     // Ищем сотрудника по ID
     const staffMember = staffMembers.find(staff => staff.id === staffId);
     if (!staffMember) {
       throw new Error(`Staff member with ID ${staffId} not found`);
     }
     
     // Логируем действие
     addLoadingStep('update-staff', 'Updating staff member', 'loading', `Staff ID: ${staffId}`);
     
     // Подготавливаем данные для обновления
     const updateData: any = {};
     
     if (data.autoSchedule !== undefined) {
       updateData.autoSchedule = data.autoSchedule;
     }
     
     if (data.pathForSRSFile !== undefined) {
       updateData.pathForSRSFile = data.pathForSRSFile;
     }
     
     if (data.generalNote !== undefined) {
       updateData.generalNote = data.generalNote;
     }
     
     if (data.deleted !== undefined) {
       updateData.deleted = data.deleted;
     }
     
     // Если у сотрудника есть groupMemberId, используем его для обновления
     if (staffMember.groupMemberId) {
       const groupMemberId = Number(staffMember.groupMemberId);
       
       // Вызываем метод из GroupMemberService
       const success = await groupMemberService.updateGroupMember(groupMemberId, {
         autoSchedule: data.autoSchedule,
         pathForSRSFile: data.pathForSRSFile,
         generalNote: data.generalNote,
         deleted: data.deleted
       });
       
       if (success) {
         // Обновляем локальный список сотрудников
         const updatedStaffMembers = staffMembers.map(staff => {
           if (staff.id === staffId) {
             return {
               ...staff,
               ...updateData
             };
           }
           return staff;
         });
         
         setStaffMembers(updatedStaffMembers);
         
         // Если обновляемый сотрудник выбран, обновляем и его
         if (selectedStaff && selectedStaff.id === staffId) {
           setSelectedStaff({
             ...selectedStaff,
             ...updateData
           });
         }
         
         addLoadingStep('update-staff', 'Updating staff member', 'success', `Staff ${staffMember.name} updated successfully`);
         return true;
       } else {
         addLoadingStep('update-staff', 'Updating staff member', 'error', `Failed to update staff ${staffMember.name}`);
         return false;
       }
     } else {
       throw new Error(`Staff member with ID ${staffId} does not have a groupMemberId`);
     }
   } catch (error) {
     console.error("Error updating staff member:", error);
     addLoadingStep('update-staff', 'Updating staff member', 'error', `Error: ${error}`);
     
     return false;
   }
 }, [staffMembers, selectedStaff, groupMemberService, addLoadingStep]);
 
//////////////////////////////////

// Метод для добавления сотрудника в группу
const addStaffToGroup = useCallback(async (
  departmentId: string, 
  staffId: number, 
  additionalData: {
    autoSchedule?: boolean,
    pathForSRSFile?: string,
    generalNote?: string
  }
): Promise<{ success: boolean; alreadyExists: boolean }> => {
  try {
    if (!departmentId) {
      throw new Error("Department ID is empty");
    }
    
    const groupId = Number(departmentId);
    if (isNaN(groupId)) {
      throw new Error("Invalid Department ID format");
    }
    
    if (!staffId || staffId <= 0) {
      throw new Error("Invalid Staff ID");
    }
    
    // Логируем действие
    addLoadingStep('add-staff-to-group', 'Adding staff to group', 'loading', 
      `Department ID: ${departmentId}, Staff ID: ${staffId}`);
    
    // Добавляем ID текущего пользователя к additionalData
    const extendedData = {
      ...additionalData,
      currentUserId: currentUser?.ID
    };
    
    // Вызываем метод из GroupMemberService с изменённым возвратом
    const result = await groupMemberService.createGroupMemberFromStaff(
      groupId, 
      staffId, 
      extendedData
    );
    
    if (result.success) {
      // Если сотрудник уже существует, используем другое сообщение
      if (result.alreadyExists) {
        addLoadingStep('add-staff-to-group', 'Adding staff to group', 'success', 
          `Staff ID: ${staffId} is already in group ID: ${groupId}`);
      } else {
        addLoadingStep('add-staff-to-group', 'Adding staff to group', 'success', 
          `Successfully added staff ID: ${staffId} to group ID: ${groupId}`);
      }
      
      // Обновляем список сотрудников после добавления
      await refreshStaffMembers(departmentId);
      
      return result;
    } else {
      addLoadingStep('add-staff-to-group', 'Adding staff to group', 'error', 
        `Failed to add staff ID: ${staffId} to group ID: ${groupId}`);
      return { success: false, alreadyExists: false };
    }
  } catch (error) {
    console.error(`Error adding staff to group: ${error}`);
    addLoadingStep('add-staff-to-group', 'Adding staff to group', 'error', `Error: ${error}`);
    return { success: false, alreadyExists: false };
  }
}, [groupMemberService, refreshStaffMembers, addLoadingStep, currentUser]);

///////////////////////////////////////////////////////////////////

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
   refreshStaffMembers,
   
   // Новый метод
   updateStaffMember,
   addStaffToGroup // Новый метод
 };
 
 return (
   <DataContext.Provider value={contextValue}>
     {children}
   </DataContext.Provider>
 );
};