// src/webparts/kpfaplus/context/types.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { ICurrentUser } from "../services/UserService";
// Уберем этот импорт, который конфликтует с локальным объявлением
// import { IDepartment } from "../services/DepartmentService";
import { IStaffMember, IDepartment } from "../models/types";

// Интерфейс для шага загрузки
export interface ILoadingStep {
  id: string;
  description: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  timestamp: Date;
  details?: string;
}

// Состояние для загрузки данных
export interface ILoadingState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  loadingSteps: ILoadingStep[]; // Массив шагов загрузки
}

// Тип данных для обновления сотрудника
export interface IStaffMemberUpdateData {
  autoSchedule?: boolean;
  pathForSRSFile?: string;
  generalNote?: string;
  deleted?: number; // Изменено с boolean на number
}

// Интерфейс для контекста данных
export interface IDataContext {
  // Сервисные данные
  spContext: WebPartContext | undefined;
  
  // Данные пользователя
  currentUser: ICurrentUser | undefined;
  
  // Данные департаментов
  departments: IDepartment[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (id: string) => void;
  
  // Данные сотрудников
  staffMembers: IStaffMember[];
  selectedStaff: IStaffMember | undefined;
  setSelectedStaff: (staff: IStaffMember) => void;
  
  // Состояния загрузки
  loadingState: ILoadingState;
  
  // Методы для управления данными
  refreshData: () => Promise<void>;
  refreshDepartments: () => Promise<void>;
  refreshStaffMembers: (departmentId: string) => Promise<void>;
  
  // Новый метод для обновления сотрудника
  updateStaffMember: (staffId: string, data: IStaffMemberUpdateData) => Promise<boolean>;

  // В types.ts обновите сигнатуру метода addStaffToGroup
addStaffToGroup: (
  departmentId: string, 
  staffId: number, 
  additionalData: {
    autoSchedule?: boolean,
    pathForSRSFile?: string,
    generalNote?: string
  }
) => Promise<{ success: boolean; alreadyExists: boolean }>;
}

export interface IDataProviderProps {
  context: WebPartContext;
  children?: React.ReactNode;
}

