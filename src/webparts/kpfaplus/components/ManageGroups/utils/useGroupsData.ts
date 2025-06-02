// src/webparts/kpfaplus/components/ManageGroups/utils/useGroupsData.ts
import { useState, useCallback } from 'react';
import { DepartmentService, IDepartment } from '../../../services/DepartmentService';

interface IUseGroupsDataProps {
  departmentService?: DepartmentService;
  currentUserId?: string;
}

interface IUseGroupsDataReturn {
  groups: IDepartment[];
  isLoading: boolean;
  error?: string;
  loadData: () => void;
  // CRUD операции
  deleteGroup: (groupId: string) => Promise<boolean>;
  restoreGroup: (groupId: string) => Promise<boolean>;
  saveGroup: (group: Partial<IDepartment>) => Promise<boolean>;
  createGroup: (group: Omit<IDepartment, 'ID'>) => Promise<string | undefined>;
}

export const useGroupsData = (props: IUseGroupsDataProps): IUseGroupsDataReturn => {
  const {
    departmentService,
    currentUserId
  } = props;

  // Состояния
  const [groups, setGroups] = useState<IDepartment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Функция для загрузки всех данных
  const loadData = useCallback(async (): Promise<void> => {
    console.log('[useGroupsData] Starting data load');
    setIsLoading(true);
    setError(undefined);

    try {
      // Загружаем группы
      if (departmentService && currentUserId) {
        console.log('[useGroupsData] Loading groups for current user:', currentUserId);
        
        // Используем метод для получения групп по менеджеру
        const groupsData = await departmentService.fetchDepartmentsByManager(parseInt(currentUserId, 10));
        
        console.log('[useGroupsData] Loaded groups:', groupsData.length);
        setGroups(groupsData);
      } else {
        console.log('[useGroupsData] Cannot load groups - missing required data:', {
          hasService: !!departmentService,
          hasCurrentUserId: !!currentUserId
        });
        setGroups([]);
      }

    } catch (err) {
      const errorMessage = `Failed to load data: ${err}`;
      console.error('[useGroupsData]', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[useGroupsData] Data load completed');
    }
  }, [
    departmentService,
    currentUserId
  ]);

  // Функция для удаления группы
  const deleteGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!departmentService) {
      console.error('[useGroupsData] DepartmentService not available for delete');
      return false;
    }

    console.log('[useGroupsData] Deleting group:', groupId);

    try {
      // Используем реальный метод markGroupAsDeleted из DepartmentService
      const success = await departmentService.markGroupAsDeleted(groupId);
      
      if (success) {
        console.log('[useGroupsData] Group deleted successfully, updating local state');
        
        // Обновляем локальное состояние
        setGroups(prev => prev.map(group => 
          group.ID.toString() === groupId 
            ? { ...group, Deleted: true }
            : group
        ));
        
        return true;
      } else {
        throw new Error('Failed to delete group on server');
      }
      
    } catch (error) {
      console.error('[useGroupsData] Error deleting group:', error);
      setError(`Failed to delete group: ${error}`);
      return false;
    }
  }, [departmentService]);

  // Функция для восстановления группы
  const restoreGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!departmentService) {
      console.error('[useGroupsData] DepartmentService not available for restore');
      return false;
    }

    console.log('[useGroupsData] Restoring group:', groupId);

    try {
      // Используем реальный метод markGroupAsActive из DepartmentService
      const success = await departmentService.markGroupAsActive(groupId);
      
      if (success) {
        console.log('[useGroupsData] Group restored successfully, updating local state');
        
        // Обновляем локальное состояние
        setGroups(prev => prev.map(group => 
          group.ID.toString() === groupId 
            ? { ...group, Deleted: false }
            : group
        ));
        
        return true;
      } else {
        throw new Error('Failed to restore group on server');
      }
      
    } catch (error) {
      console.error('[useGroupsData] Error restoring group:', error);
      setError(`Failed to restore group: ${error}`);
      return false;
    }
  }, [departmentService]);

  // Функция для сохранения изменений группы
  const saveGroup = useCallback(async (group: Partial<IDepartment>): Promise<boolean> => {
    if (!departmentService || !group.ID) {
      console.error('[useGroupsData] DepartmentService not available or group ID missing for save');
      return false;
    }

    console.log('[useGroupsData] Saving group:', group.ID);

    try {
      // Используем реальный метод updateGroup из DepartmentService
      const success = await departmentService.updateGroup(group.ID.toString(), group);
      
      if (success) {
        console.log('[useGroupsData] Group saved successfully, updating local state');
        
        // Обновляем локальное состояние
        setGroups(prev => prev.map(existingGroup => 
          existingGroup.ID === group.ID 
            ? { ...existingGroup, ...group }
            : existingGroup
        ));
        
        return true;
      } else {
        throw new Error(`Failed to save group ${group.ID} on server`);
      }
      
    } catch (error) {
      console.error('[useGroupsData] Error saving group:', error);
      setError(`Failed to save group: ${error}`);
      return false;
    }
  }, [departmentService]);

  // Функция для создания новой группы
  const createGroup = useCallback(async (group: Omit<IDepartment, 'ID'>): Promise<string | undefined> => {
    if (!departmentService) {
      console.error('[useGroupsData] DepartmentService not available for create');
      return undefined;
    }

    console.log('[useGroupsData] Creating new group');

    try {
      // Подготавливаем данные для создания с типизацией
      const createData = {
        Title: group.Title || 'New Group',
        DayOfStartWeek: group.DayOfStartWeek || 1,
        EnterLunchTime: group.EnterLunchTime !== undefined ? group.EnterLunchTime : true,
        LeaveExportFolder: group.LeaveExportFolder || '',
        ManagerLookupId: group.Manager?.Id || 0,
        Deleted: group.Deleted ? 1 : 0
      };

      // Используем реальный метод createGroup из DepartmentService
      const newGroupId = await departmentService.createGroup(createData);
      
      if (newGroupId) {
        console.log('[useGroupsData] New group created successfully with ID:', newGroupId);
        
        // Создаём полный объект новой группы для локального состояния
        const newGroup: IDepartment = {
          ...group,
          ID: parseInt(newGroupId, 10)
        };
        
        // Обновляем локальное состояние
        setGroups(prev => [...prev, newGroup]);
        
        return newGroupId;
      } else {
        throw new Error('Failed to get ID from created group');
      }
      
    } catch (error) {
      console.error('[useGroupsData] Error creating group:', error);
      setError(`Failed to create group: ${error}`);
      return undefined;
    }
  }, [departmentService]);

  return {
    groups,
    isLoading,
    error,
    loadData,
    deleteGroup,
    restoreGroup,
    saveGroup,
    createGroup
  };
};