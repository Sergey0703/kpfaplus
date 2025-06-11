// src/webparts/kpfaplus/context/DataProvider.tsx
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { DataContext } from './DataContext';
import { IDataProviderProps, ILoadingState, ILoadingStep, IStaffMemberUpdateData } from './types';
import { DepartmentService } from '../services/DepartmentService';
import { UserService, ICurrentUser } from '../services/UserService';
import { IStaffMember, IGroupMember, IDepartment, IUserInfo, IImpersonationState } from '../models/types';
import { GroupMemberService } from '../services/GroupMemberService';

// Интерфейс для данных обновления сотрудника, передаваемых в GroupMemberService
interface IGroupMemberUpdateData {
  autoSchedule?: boolean;
  pathForSRSFile?: string;
  generalNote?: string;
  deleted?: number;
}

export const DataProvider: React.FC<IDataProviderProps> = (props) => {
 const { context, children } = props;
 
 // Инициализируем сервисы
 const departmentService = React.useMemo(() => new DepartmentService(context), [context]);
 const userService = React.useMemo(() => new UserService(context), [context]);
 const groupMemberService = React.useMemo(() => new GroupMemberService(context), [context]);
 
 // Состояние для данных пользователя
 const [currentUser, setCurrentUser] = useState<ICurrentUser | undefined>(undefined);
 
 // --- NEW IMPERSONATION STATE ---
 const [impersonationState, setImpersonationState] = useState<IImpersonationState>({
   originalUser: undefined,
   impersonatedUser: undefined,
   isImpersonating: false
 });
 // --- END NEW IMPERSONATION STATE ---
 
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

 // --- NEW IMPERSONATION METHODS ---
 
 /**
  * Converts ICurrentUser to IUserInfo format
  */
 const convertCurrentUserToUserInfo = (user: ICurrentUser): IUserInfo => {
   return {
     ID: user.ID,
     Title: user.Title,
     Email: user.Email
   };
 };

 /**
  * Starts impersonating a specific user
  */
 const startImpersonation = useCallback((user: IUserInfo): void => {
   console.log(`[DataProvider] Starting impersonation of user: ${user.Title} (ID: ${user.ID})`);
   
   // Store original user if not already stored
   if (!impersonationState.originalUser && currentUser) {
     const originalUserInfo = convertCurrentUserToUserInfo(currentUser);
     
     setImpersonationState({
       originalUser: originalUserInfo,
       impersonatedUser: { ...user },
       isImpersonating: true
     });
     
     // Also update the UserService
     userService.startImpersonation(user);
     
     console.log(`[DataProvider] Impersonation started. Acting as: ${user.Title}, Original: ${originalUserInfo.Title}`);
   } else if (impersonationState.originalUser) {
     // If we already have an original user, just switch impersonation
     setImpersonationState(prev => ({
       ...prev,
       impersonatedUser: { ...user },
       isImpersonating: true
     }));
     
     // Update the UserService
     userService.startImpersonation(user);
     
     console.log(`[DataProvider] Switched impersonation to: ${user.Title}`);
   } else {
     console.error('[DataProvider] Cannot start impersonation: currentUser not available');
   }
 }, [currentUser, impersonationState.originalUser, userService]);

 /**
  * Stops impersonation and returns to original user
  */
 const stopImpersonation = useCallback((): void => {
   console.log(`[DataProvider] Stopping impersonation`);
   
   if (!impersonationState.isImpersonating) {
     console.log('[DataProvider] No active impersonation to stop');
     return;
   }
   
   setImpersonationState(prev => ({
     ...prev,
     impersonatedUser: undefined,
     isImpersonating: false
   }));
   
   // Update the UserService
   userService.stopImpersonation();
   
   console.log(`[DataProvider] Impersonation stopped. Returned to original user: ${impersonationState.originalUser?.Title || 'Unknown'}`);
 }, [impersonationState.isImpersonating, impersonationState.originalUser, userService]);

 /**
  * Gets the currently effective user (impersonated or original)
  */
 const getEffectiveUser = useCallback((): IUserInfo | undefined => {
   if (impersonationState.isImpersonating && impersonationState.impersonatedUser) {
     return { ...impersonationState.impersonatedUser };
   }
   
   if (impersonationState.originalUser) {
     return { ...impersonationState.originalUser };
   }
   
   if (currentUser) {
     return convertCurrentUserToUserInfo(currentUser);
   }
   
   return undefined;
 }, [impersonationState, currentUser]);

 /**
  * Gets all staff members for impersonation selector
  */
 const getAllStaffForImpersonation = useCallback(async (): Promise<IUserInfo[]> => {
   try {
     console.log('[DataProvider] Fetching all staff for impersonation');
     const allStaff = await userService.getAllStaffAsUserInfo();
     console.log(`[DataProvider] Fetched ${allStaff.length} staff members for impersonation`);
     return allStaff;
   } catch (error) {
     console.error('[DataProvider] Error fetching staff for impersonation:', error);
     return [];
   }
 }, [userService]);

 // --- END NEW IMPERSONATION METHODS ---
 
 // Функция для загрузки данных текущего пользователя
 const fetchCurrentUser = useCallback(async () => {
   try {
     addLoadingStep('fetch-current-user', 'Loading current user data', 'loading', 'Requesting user data from SharePoint list "Staff"');
     
     const user = await userService.getCurrentUser();
     
     if (user) {
       addLoadingStep('fetch-current-user', 'Loading current user data', 'success', `Found user: ${user.Title} (ID: ${user.ID})`);
       setCurrentUser(user);
       
       // --- NEW: Initialize impersonation state with original user ---
       if (!impersonationState.originalUser) {
         const userInfo = convertCurrentUserToUserInfo(user);
         setImpersonationState(prev => ({
           ...prev,
           originalUser: userInfo
         }));
         console.log(`[DataProvider] Initialized original user: ${userInfo.Title} (ID: ${userInfo.ID})`);
       }
       // --- END NEW ---
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
 }, [userService, impersonationState.originalUser]);
 // --- MODIFIED: Function to fetch departments using effective user ---
 const fetchDepartments = useCallback(async (effectiveUserOverride?: IUserInfo | undefined) => {
   try {
     // Use the override if provided, otherwise get current effective user
     const effectiveUser = effectiveUserOverride || getEffectiveUser();
     
     if (effectiveUser && effectiveUser.ID) {
       // If we have an effective user, get their departments
       addLoadingStep('fetch-departments', 'Loading departments data', 'loading', `Loading departments for effective user ID: ${effectiveUser.ID} (${effectiveUser.Title})`);
       
       const depts = await departmentService.fetchDepartmentsByManager(effectiveUser.ID);
       
       // Filter only active (non-deleted) departments
       const activeDepts = depts.filter(dept => !dept.Deleted);
       
       addLoadingStep('fetch-departments', 'Loading departments data', 'success', `Loaded ${activeDepts.length} active departments for ${effectiveUser.Title} (filtered ${depts.length - activeDepts.length} deleted)`);
       setDepartments(activeDepts);
       
       // Select first department if available
       if (activeDepts.length > 0) {
         setSelectedDepartmentId(activeDepts[0].ID.toString());
         addLoadingStep('select-department', 'Selecting default department', 'success', `Selected department: ${activeDepts[0].Title} (ID: ${activeDepts[0].ID}) for user ${effectiveUser.Title}`);
       } else {
         setSelectedDepartmentId("");
         setDepartments([]);
         setStaffMembers([]);
         setSelectedStaff(undefined);
         addLoadingStep('select-department', 'Selecting default department', 'error', `No active departments available for user ${effectiveUser.Title}`);
       }
     } else {
       // If no effective user, try to get all departments (fallback)
       addLoadingStep('fetch-departments', 'Loading all departments', 'loading', 'Effective user not identified, loading all departments');
       
       const depts = await departmentService.fetchDepartments();
       
       // Filter only active (non-deleted) departments
       const activeDepts = depts.filter(dept => !dept.Deleted);
       
       addLoadingStep('fetch-departments', 'Loading all departments', 'success', `Loaded ${activeDepts.length} active departments (filtered ${depts.length - activeDepts.length} deleted)`);
       setDepartments(activeDepts);
       
       // Select first department if available
       if (activeDepts.length > 0) {
         setSelectedDepartmentId(activeDepts[0].ID.toString());
         addLoadingStep('select-department', 'Selecting default department', 'success', `Selected department: ${activeDepts[0].Title} (ID: ${activeDepts[0].ID})`);
       } else {
         setSelectedDepartmentId("");
         addLoadingStep('select-department', 'Selecting default department', 'error', 'No active departments available to select');
       }
     }
   } catch (error) {
     console.error("Error fetching departments:", error);
     addLoadingStep('fetch-departments', 'Loading departments data', 'error', `Error: ${error}`);
     
     // Clear departments on error
     setDepartments([]);
     setSelectedDepartmentId("");
     setStaffMembers([]);
     setSelectedStaff(undefined);
     
     setLoadingState((prevState: ILoadingState) => ({
       ...prevState,
       hasError: true,
       errorMessage: `Error fetching departments: ${error}`
     }));
   }
 }, [departmentService, getEffectiveUser]);
 // --- END MODIFIED ---

// Функция для загрузки членов группы с выбором первого неудаленного сотрудника
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
    
    // Сортировка - сначала активные (deleted=0), затем по Title
    const sortedStaffMembers = mappedStaffMembers.sort((a, b) => {
      // Сначала сортируем по статусу удаления
      if (a.deleted !== b.deleted) {
        return (a.deleted ? 1 : 0) - (b.deleted ? 1 : 0);
      }
      
      // Затем проверяем employeeId
      const aHasEmployee = a.employeeId ? 1 : 0;
      const bHasEmployee = b.employeeId ? 1 : 0;
      
      if (aHasEmployee !== bHasEmployee) {
        return aHasEmployee - bHasEmployee;
      }
      
      // Затем по имени (name)
      return a.name.localeCompare(b.name);
    });
    
    // Обновляем состояние
    setStaffMembers(sortedStaffMembers);
    
    // Ищем первого не удалённого сотрудника
    const firstActiveStaff = sortedStaffMembers.find(staff => staff.deleted !== 1);
    
    // Выбираем первого активного сотрудника если есть, иначе первого в списке
    if (firstActiveStaff) {
      setSelectedStaff(firstActiveStaff);
      addLoadingStep('select-staff', 'Selecting first active staff member', 'success', 
        `Selected active staff: ${firstActiveStaff.name} (ID: ${firstActiveStaff.id})`);
    } else if (sortedStaffMembers.length > 0) {
      setSelectedStaff(sortedStaffMembers[0]);
      addLoadingStep('select-staff', 'No active staff found, selecting first staff member', 'success', 
        `Selected staff: ${sortedStaffMembers[0].name} (ID: ${sortedStaffMembers[0].id}) (Note: This staff member is marked as deleted)`);
    } else {
      setSelectedStaff(undefined);
      addLoadingStep('select-staff', 'Selecting default staff member', 'error', 'No staff members available to select');
    }
    
    // Обновляем лог загрузки
    addLoadingStep('fetch-group-members', 'Loading staff members', 'success', 
      `Loaded ${groupMembers.length} staff members (${groupMembers.filter(gm => gm.Deleted !== 1).length} active, ${groupMembers.filter(gm => gm.Deleted === 1).length} deleted)`);
    
  } catch (error) {
    console.error("Error fetching group members:", error);
    addLoadingStep('fetch-group-members', 'Loading staff members', 'error', `Error: ${error}`);
    
    // Clear staff on error
    setStaffMembers([]);
    setSelectedStaff(undefined);
    
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
 
 // --- MODIFIED: Function for full data refresh using effective user ---
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
     
     // Load user data first (if not already loaded)
     let user = currentUser;
     if (!user) {
       user = await fetchCurrentUser();
     }
     
     // Get effective user for department loading
     const effectiveUser = getEffectiveUser();
     console.log(`[DataProvider] Refreshing data for effective user: ${effectiveUser?.Title || 'Unknown'} (ID: ${effectiveUser?.ID || 'Unknown'})`);
     
     // Load departments for effective user
     await fetchDepartments(effectiveUser);
     
     // Note: Staff members will be loaded automatically when selectedDepartmentId changes
     
     addLoadingStep('refresh-complete', 'Data refresh complete', 'success', `All data loaded successfully for user: ${effectiveUser?.Title || 'Unknown'}`);
     
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
 }, [fetchCurrentUser, fetchDepartments, getEffectiveUser, currentUser]);
 // --- END MODIFIED ---
 
 // --- MODIFIED: Function for refreshing departments using effective user ---
 const refreshDepartments = useCallback(async () => {
   try {
     const effectiveUser = getEffectiveUser();
     addLoadingStep('refresh-departments', 'Refreshing departments', 'loading', `For user: ${effectiveUser?.Title || 'Unknown'}`);
     await fetchDepartments(effectiveUser);
     addLoadingStep('refresh-departments', 'Refreshing departments', 'success', 'Departments refreshed successfully');
   } catch (error) {
     console.error("Error refreshing departments:", error);
     addLoadingStep('refresh-departments', 'Refreshing departments', 'error', `Error: ${error}`);
   }
 }, [fetchDepartments, getEffectiveUser]);
 // --- END MODIFIED ---
 
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
     const updateData: IGroupMemberUpdateData = {};
     
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
    
    // --- MODIFIED: Use effective user instead of currentUser ---
    const effectiveUser = getEffectiveUser();
    
    // Добавляем ID эффективного пользователя к additionalData
    const extendedData = {
      ...additionalData,
      currentUserId: effectiveUser?.ID
    };
    // --- END MODIFIED ---
    
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
}, [groupMemberService, refreshStaffMembers, addLoadingStep, getEffectiveUser]);

 // --- NEW: Effect to watch for impersonation changes and reload data ---
 useEffect(() => {
   // If impersonation state changes (start or stop), reload departments
   if (impersonationState.originalUser) { // Only after initial user is loaded
     const effectiveUser = getEffectiveUser();
     console.log(`[DataProvider] Impersonation state changed. Reloading data for effective user: ${effectiveUser?.Title || 'Unknown'} (ID: ${effectiveUser?.ID || 'Unknown'})`);
     
     // Clear current staff selection to avoid confusion
     setSelectedStaff(undefined);
     setStaffMembers([]);
     setSelectedDepartmentId("");
     
     // Reload departments for the new effective user
     fetchDepartments(effectiveUser)
       .then(() => {
         console.log(`[DataProvider] Successfully reloaded departments for user: ${effectiveUser?.Title || 'Unknown'}`);
       })
       .catch(error => {
         console.error(`[DataProvider] Error reloading departments for user ${effectiveUser?.Title || 'Unknown'}:`, error);
       });
   }
 }, [impersonationState.isImpersonating, impersonationState.impersonatedUser?.ID, fetchDepartments, getEffectiveUser]);
 // --- END NEW ---

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
   } else {
     // If no department selected, clear staff
     setStaffMembers([]);
     setSelectedStaff(undefined);
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedDepartmentId]);
 
 // Формируем значение контекста
 const contextValue = {
   // Сервисные данные
   spContext: context,
   
   // Данные пользователя
   currentUser,
   
   // --- NEW IMPERSONATION CONTEXT VALUES ---
   impersonationState,
   startImpersonation,
   stopImpersonation,
   getEffectiveUser,
   getAllStaffForImpersonation,
   // --- END NEW IMPERSONATION CONTEXT VALUES ---
   
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