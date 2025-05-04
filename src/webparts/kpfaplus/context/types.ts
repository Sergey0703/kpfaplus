// src/webparts/kpfaplus/context/types.ts
import { WebPartContext } from "@microsoft/sp-webpart-base";
import { ICurrentUser } from "../services/UserService";
import { IDepartment } from "../services/DepartmentService";
import { IStaffMember } from "../models/types";

// Состояние для загрузки данных
export interface ILoadingState {
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  loadingSteps: ILoadingStep[]; // Массив шагов загрузки
}

// Интерфейс для шага загрузки
export interface ILoadingStep {
  id: string;
  description: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  timestamp: Date;
  details?: string;
}

// Интерфейс для контекста данных
export interface IDataContext {
  // Сервисные данные
  spContext: WebPartContext | null;
  
  // Данные пользователя
  currentUser: ICurrentUser | null;
  
  // Данные департаментов
  departments: IDepartment[];
  selectedDepartmentId: string;
  setSelectedDepartmentId: (id: string) => void;
  
  // Данные сотрудников
  staffMembers: IStaffMember[];
  selectedStaff: IStaffMember | null;
  setSelectedStaff: (staff: IStaffMember) => void;
  
  // Состояния загрузки
  loadingState: ILoadingState;
  
  // Методы для управления данными
  refreshData: () => Promise<void>;
  refreshDepartments: () => Promise<void>;
  refreshStaffMembers: (departmentId: string) => Promise<void>;
}

// Интерфейс для провайдера данных
export interface IDataProviderProps {
  context: WebPartContext;
  children: React.ReactNode;
}