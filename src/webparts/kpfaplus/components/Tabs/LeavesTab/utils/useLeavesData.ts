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
  // Новые методы для CRUD операций
  deleteLeave: (leaveId: string) => Promise<boolean>;
  restoreLeave: (leaveId: string) => Promise<boolean>;
  saveLeave: (leave: Partial<ILeaveDay>) => Promise<boolean>;
  createLeave: (leave: Omit<ILeaveDay, 'id'>) => Promise<string | null>;
}

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
  const loadData = useCallback(async () => {
    console.log('[useLeavesData] Starting data load');
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

        const leavesData = await daysOfLeavesService.getLeavesForMonthAndYear(
          selectedPeriodStart,
          parseInt(selectedStaff.employeeId, 10),
          parseInt(currentUserId, 10),
          parseInt(managingGroupId, 10)
        );
        
        console.log('[useLeavesData] Loaded leaves:', leavesData.length);
        setLeaves(leavesData);
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
      // TODO: Реализовать метод markLeaveAsDeleted в DaysOfLeavesService
      // const success = await daysOfLeavesService.markLeaveAsDeleted(leaveId);
      
      // Временная имитация успешного удаления
      console.log('[useLeavesData] Simulating leave deletion for ID:', leaveId);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Обновляем локальное состояние
      setLeaves(prev => prev.map(leave => 
        leave.id === leaveId 
          ? { ...leave, deleted: true }
          : leave
      ));
      
      console.log('[useLeavesData] Leave marked as deleted locally');
      return true;
      
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
      // TODO: Реализовать метод markLeaveAsActive в DaysOfLeavesService
      // const success = await daysOfLeavesService.markLeaveAsActive(leaveId);
      
      // Временная имитация успешного восстановления
      console.log('[useLeavesData] Simulating leave restoration for ID:', leaveId);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Обновляем локальное состояние
      setLeaves(prev => prev.map(leave => 
        leave.id === leaveId 
          ? { ...leave, deleted: false }
          : leave
      ));
      
      console.log('[useLeavesData] Leave restored locally');
      return true;
      
    } catch (error) {
      console.error('[useLeavesData] Error restoring leave:', error);
      setError(`Failed to restore leave: ${error}`);
      return false;
    }
  }, [daysOfLeavesService]);

  // Функция для сохранения изменений отпуска
  const saveLeave = useCallback(async (leave: Partial<ILeaveDay>): Promise<boolean> => {
    if (!daysOfLeavesService || !leave.id) {
      console.error('[useLeavesData] DaysOfLeavesService not available or leave ID missing for save');
      return false;
    }

    console.log('[useLeavesData] Saving leave:', leave.id);

    try {
      // TODO: Реализовать метод updateLeave в DaysOfLeavesService
      // const success = await daysOfLeavesService.updateLeave(leave.id, leave);
      
      // Временная имитация успешного сохранения
      console.log('[useLeavesData] Simulating leave save for ID:', leave.id);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Обновляем локальное состояние
      setLeaves(prev => prev.map(existingLeave => 
        existingLeave.id === leave.id 
          ? { ...existingLeave, ...leave }
          : existingLeave
      ));
      
      console.log('[useLeavesData] Leave saved locally');
      return true;
      
    } catch (error) {
      console.error('[useLeavesData] Error saving leave:', error);
      setError(`Failed to save leave: ${error}`);
      return false;
    }
  }, [daysOfLeavesService]);

  // Функция для создания нового отпуска
  const createLeave = useCallback(async (leave: Omit<ILeaveDay, 'id'>): Promise<string | null> => {
    if (!daysOfLeavesService) {
      console.error('[useLeavesData] DaysOfLeavesService not available for create');
      return null;
    }

    console.log('[useLeavesData] Creating new leave');

    try {
      // TODO: Реализовать метод createLeave в DaysOfLeavesService
      // const newLeaveId = await daysOfLeavesService.createLeave(leave);
      
      // Временная имитация успешного создания
      console.log('[useLeavesData] Simulating leave creation');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const newLeaveId = `temp_${Date.now()}`;
      const newLeave: ILeaveDay = {
        ...leave,
        id: newLeaveId
      };
      
      // Обновляем локальное состояние
      setLeaves(prev => [...prev, newLeave]);
      
      console.log('[useLeavesData] New leave created locally with ID:', newLeaveId);
      return newLeaveId;
      
    } catch (error) {
      console.error('[useLeavesData] Error creating leave:', error);
      setError(`Failed to create leave: ${error}`);
      return null;
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