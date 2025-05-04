// src/webparts/kpfaplus/context/DataContext.ts
import { createContext, useContext } from 'react';
import { IDataContext } from './types';

// Начальное значение контекста с пустыми значениями и заглушками для функций
const initialContextState: IDataContext = {
  // Сервисные данные
  spContext: null,
  
  // Данные пользователя
  currentUser: null,
  
  // Данные департаментов
  departments: [],
  selectedDepartmentId: "",
  setSelectedDepartmentId: () => {}, // Заглушка, будет заменена реальной функцией
  
  // Данные сотрудников
  staffMembers: [],
  selectedStaff: null,
  setSelectedStaff: () => {}, // Заглушка, будет заменена реальной функцией
  
  // Состояния загрузки
  loadingState: {
    isLoading: false,
    hasError: false,
    errorMessage: "",
    loadingSteps: [] // Добавили отсутствующее свойство
  },
  
  // Методы для управления данными
  refreshData: async () => {}, // Заглушка, будет заменена реальной функцией
  refreshDepartments: async () => {}, // Заглушка, будет заменена реальной функцией
  refreshStaffMembers: async () => {} // Заглушка, будет заменена реальной функцией
};

// Создаем контекст с начальным значением
export const DataContext = createContext<IDataContext>(initialContextState);

// Создаем хук для использования контекста в компонентах
export const useDataContext = (): IDataContext => {
  const context = useContext(DataContext);
  
  if (!context) {
    throw new Error('useDataContext must be used within a DataProvider');
  }
  
  return context;
};