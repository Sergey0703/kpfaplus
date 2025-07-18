// src/webparts/kpfaplus/components/Tabs/LeavesTab/utils/useLeavesData.ts
import { useState, useCallback } from 'react';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { DaysOfLeavesService, ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IStaffMember } from '../../../../models/types';

interface IUseLeavesDataProps {
  typeOfLeaveService?: TypeOfLeaveService;
  daysOfLeavesService?: DaysOfLeavesService;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
}

interface IUseLeavesDataReturn {
  typesOfLeave: ITypeOfLeave[];
  leaves: ILeaveDay[];
  isLoading: boolean;
  error?: string;
  loadData: () => void;
  // CRUD операции с исправленными типами (null -> undefined)
  deleteLeave: (leaveId: string) => Promise<boolean>;
  restoreLeave: (leaveId: string) => Promise<boolean>;
  saveLeave: (leave: Partial<ILeaveDay>) => Promise<boolean>;
  createLeave: (leave: Omit<ILeaveDay, 'id'>) => Promise<string | undefined>;
}

// НОВАЯ ФУНКЦИЯ: Нормализация даты для работы с Date-only
const normalizeDateForDateOnly = (date: Date): Date => {
  // Создаем новую дату с теми же компонентами, но без времени
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const useLeavesData = (props: IUseLeavesDataProps): IUseLeavesDataReturn => {
  const {
    typeOfLeaveService,
    daysOfLeavesService,
    selectedStaff,
    currentUserId,
    managingGroupId,
    selectedPeriodStart,
    selectedPeriodEnd
  } = props;

  // Состояния
  const [typesOfLeave, setTypesOfLeave] = useState<ITypeOfLeave[]>([]);
  const [leaves, setLeaves] = useState<ILeaveDay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Функция для загрузки всех данных
  const loadData = useCallback(async (): Promise<void> => {
    console.log('[useLeavesData] Starting data load');
    console.log('[useLeavesData] Period dates:', {
      start: selectedPeriodStart.toLocaleDateString(),
      end: selectedPeriodEnd.toLocaleDateString()
    });
    
    setIsLoading(true);
    setError(undefined);

    try {
      // Загружаем типы отпусков
      if (typeOfLeaveService) {
        console.log('[useLeavesData] Loading types of leave');
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        console.log('[useLeavesData] Loaded types:', types.length);
        setTypesOfLeave(types);
      } else {
        console.log('[useLeavesData] TypeOfLeaveService not available');
        setTypesOfLeave([]);
      }

      // Загружаем отпуска, если есть выбранный сотрудник
      if (daysOfLeavesService && selectedStaff?.employeeId && currentUserId && managingGroupId) {
        console.log('[useLeavesData] Loading leaves for staff:', {
          employeeId: selectedStaff.employeeId,
          currentUserId,
          managingGroupId,
          periodStart: selectedPeriodStart.toLocaleDateString(),
          periodEnd: selectedPeriodEnd.toLocaleDateString()
        });

        // ОБНОВЛЕНО: Нормализуем даты для Date-only формата перед отправкой в сервис
        const normalizedStartDate = normalizeDateForDateOnly(selectedPeriodStart);
        
        const leavesData = await daysOfLeavesService.getLeavesForMonthAndYear(
          normalizedStartDate,
          parseInt(selectedStaff.employeeId, 10),
          parseInt(currentUserId, 10),
          parseInt(managingGroupId, 10)
        );
        
        console.log('[useLeavesData] Loaded leaves:', leavesData.length);
        
        // ОБНОВЛЕНО: Нормализуем даты в полученных данных для обеспечения Date-only формата
        const normalizedLeavesData = leavesData.map(leave => ({
          ...leave,
          startDate: normalizeDateForDateOnly(leave.startDate),
          endDate: leave.endDate ? normalizeDateForDateOnly(leave.endDate) : undefined
        }));
        
        setLeaves(normalizedLeavesData);
      } else {
        console.log('[useLeavesData] Cannot load leaves - missing required data:', {
          hasService: !!daysOfLeavesService,
          hasStaff: !!selectedStaff,
          hasEmployeeId: !!selectedStaff?.employeeId,
          hasCurrentUserId: !!currentUserId,
          hasManagingGroupId: !!managingGroupId
        });
        setLeaves([]);
      }

    } catch (err) {
      const errorMessage = `Failed to load data: ${err}`;
      console.error('[useLeavesData]', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[useLeavesData] Data load completed');
    }
  }, [
    typeOfLeaveService,
    daysOfLeavesService,
    selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    selectedPeriodStart,
    selectedPeriodEnd
  ]);

  // Функция для удаления отпуска
  const deleteLeave = useCallback(async (leaveId: string): Promise<boolean> => {
    if (!daysOfLeavesService) {
      console.error('[useLeavesData] DaysOfLeavesService not available for delete');
      return false;
    }

    console.log('[useLeavesData] Deleting leave:', leaveId);

    try {
      // Используем реальный метод markLeaveAsDeleted из DaysOfLeavesService
      const success = await daysOfLeavesService.markLeaveAsDeleted(leaveId);
      
      if (success) {
        console.log('[useLeavesData] Leave deleted successfully, updating local state');
        
        // Обновляем локальное состояние
        setLeaves(prev => prev.map(leave => 
          leave.id === leaveId 
            ? { ...leave, deleted: true }
            : leave
        ));
        
        return true;
      } else {
        throw new Error('Failed to delete leave on server');
      }
      
    } catch (error) {
      console.error('[useLeavesData] Error deleting leave:', error);
      setError(`Failed to delete leave: ${error}`);
      return false;
    }
  }, [daysOfLeavesService]);

  // Функция для восстановления отпуска
  const restoreLeave = useCallback(async (leaveId: string): Promise<boolean> => {
    if (!daysOfLeavesService) {
      console.error('[useLeavesData] DaysOfLeavesService not available for restore');
      return false;
    }

    console.log('[useLeavesData] Restoring leave:', leaveId);

    try {
      // Используем реальный метод markLeaveAsActive из DaysOfLeavesService
      const success = await daysOfLeavesService.markLeaveAsActive(leaveId);
      
      if (success) {
        console.log('[useLeavesData] Leave restored successfully, updating local state');
        
        // Обновляем локальное состояние
        setLeaves(prev => prev.map(leave => 
          leave.id === leaveId 
            ? { ...leave, deleted: false }
            : leave
        ));
        
        return true;
      } else {
        throw new Error('Failed to restore leave on server');
      }
      
    } catch (error) {
      console.error('[useLeavesData] Error restoring leave:', error);
      setError(`Failed to restore leave: ${error}`);
      return false;
    }
  }, [daysOfLeavesService]);

  // ОБНОВЛЕНО: Функция для сохранения изменений отпуска с Date-only обработкой
  const saveLeave = useCallback(async (leave: Partial<ILeaveDay>): Promise<boolean> => {
    if (!daysOfLeavesService || !leave.id) {
      console.error('[useLeavesData] DaysOfLeavesService not available or leave ID missing for save');
      return false;
    }

    console.log('[useLeavesData] Saving leave:', leave.id);

    try {
      // ОБНОВЛЕНО: Нормализуем даты в данных для сохранения
      const normalizedLeave = { ...leave };
      
      if (normalizedLeave.startDate) {
        normalizedLeave.startDate = normalizeDateForDateOnly(normalizedLeave.startDate);
      }
      
      if (normalizedLeave.endDate) {
        normalizedLeave.endDate = normalizeDateForDateOnly(normalizedLeave.endDate);
      }
      
      // Используем реальный метод updateLeave из DaysOfLeavesService
      const success = await daysOfLeavesService.updateLeave(leave.id, normalizedLeave);
      
      if (success) {
        console.log('[useLeavesData] Leave saved successfully, updating local state');
        
        // ОБНОВЛЕНО: Обновляем локальное состояние с нормализованными датами
        setLeaves(prev => prev.map(existingLeave => 
          existingLeave.id === leave.id 
            ? { 
                ...existingLeave, 
                ...normalizedLeave,
                // Убеждаемся, что даты нормализованы в локальном состоянии
                startDate: normalizedLeave.startDate ? normalizeDateForDateOnly(normalizedLeave.startDate) : existingLeave.startDate,
                endDate: normalizedLeave.endDate ? normalizeDateForDateOnly(normalizedLeave.endDate) : existingLeave.endDate
              }
            : existingLeave
        ));
        
        return true;
      } else {
        throw new Error(`Failed to save leave ${leave.id} on server`);
      }
      
    } catch (error) {
      console.error('[useLeavesData] Error saving leave:', error);
      setError(`Failed to save leave: ${error}`);
      return false;
    }
  }, [daysOfLeavesService]);

  // ОБНОВЛЕНО: Функция для создания нового отпуска с Date-only обработкой
  const createLeave = useCallback(async (leave: Omit<ILeaveDay, 'id'>): Promise<string | undefined> => {
    if (!daysOfLeavesService) {
      console.error('[useLeavesData] DaysOfLeavesService not available for create');
      return undefined;
    }

    console.log('[useLeavesData] Creating new leave');

    try {
      // ОБНОВЛЕНО: Нормализуем даты для Date-only формата
      const normalizedLeave = { ...leave };
      
      // Обязательная нормализация даты начала
      normalizedLeave.startDate = normalizeDateForDateOnly(leave.startDate);
      
      // Нормализация даты окончания, если она есть
      if (normalizedLeave.endDate) {
        normalizedLeave.endDate = normalizeDateForDateOnly(normalizedLeave.endDate);
      }
      
      console.log('[useLeavesData] Creating leave with normalized dates:', {
        startDate: normalizedLeave.startDate.toLocaleDateString(),
        endDate: normalizedLeave.endDate ? normalizedLeave.endDate.toLocaleDateString() : 'undefined'
      });
      
      // Используем реальный метод createLeave из DaysOfLeavesService
      const newLeaveId = await daysOfLeavesService.createLeave(normalizedLeave);
      
      if (newLeaveId) {
        console.log('[useLeavesData] New leave created successfully with ID:', newLeaveId);
        
        // ОБНОВЛЕНО: Создаём полный объект нового отпуска для локального состояния с нормализованными датами
        const newLeave: ILeaveDay = {
          ...normalizedLeave,
          id: newLeaveId,
          created: new Date(),
          createdBy: 'Current User', // Можно улучшить, передав реального пользователя
          // Убеждаемся, что даты нормализованы
          startDate: normalizeDateForDateOnly(normalizedLeave.startDate),
          endDate: normalizedLeave.endDate ? normalizeDateForDateOnly(normalizedLeave.endDate) : undefined
        };
        
        // Обновляем локальное состояние
        setLeaves(prev => [...prev, newLeave]);
        
        return newLeaveId;
      } else {
        throw new Error('Failed to get ID from created leave');
      }
      
    } catch (error) {
      console.error('[useLeavesData] Error creating leave:', error);
      setError(`Failed to create leave: ${error}`);
      return undefined;
    }
  }, [daysOfLeavesService]);

  return {
    typesOfLeave,
    leaves,
    isLoading,
    error,
    loadData,
    deleteLeave,
    restoreLeave,
    saveLeave,
    createLeave
  };
};