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
}

export interface IDataProviderProps {
  context: WebPartContext;
  children?: React.ReactNode;
}