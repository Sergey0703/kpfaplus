// src/webparts/kpfaplus/components/Tabs/SRSTab/utils/useTypesOfLeave.ts

import { useEffect, useCallback } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { ISRSTabState } from './useSRSTabState';

interface UseTypesOfLeaveProps {
  context?: WebPartContext;
  setState: React.Dispatch<React.SetStateAction<ISRSTabState>>;
}

interface UseTypesOfLeaveReturn {
  loadTypesOfLeave: () => void;
}

/**
 * Custom hook для загрузки типов отпусков в SRS Tab
 * Адаптирован из Schedule Tab для работы с SRS состоянием
 */
export const useTypesOfLeave = (props: UseTypesOfLeaveProps): UseTypesOfLeaveReturn => {
  const { context, setState } = props;

  console.log('[SRS useTypesOfLeave] Hook initialized');

  // Helper функции для обновления состояния
  const setTypesOfLeave = useCallback((types: ITypeOfLeave[]) => {
    console.log('[SRS useTypesOfLeave] Setting types of leave:', types.length);
    setState(prevState => ({ ...prevState, typesOfLeave: types }));
  }, [setState]);

  const setIsLoadingTypesOfLeave = useCallback((isLoading: boolean) => {
    console.log('[SRS useTypesOfLeave] Setting isLoadingTypesOfLeave:', isLoading);
    setState(prevState => ({ ...prevState, isLoadingTypesOfLeave: isLoading }));
  }, [setState]);

  const setError = useCallback((error?: string) => {
    if (error) {
      console.error('[SRS useTypesOfLeave] Setting error:', error);
    }
    setState(prevState => ({ ...prevState, errorSRS: error }));
  }, [setState]);

  /**
   * Загружает типы отпусков из SharePoint
   */
  const loadTypesOfLeave = useCallback(async (): Promise<void> => {
    console.log('[SRS useTypesOfLeave] loadTypesOfLeave called');
    
    if (!context) {
      console.log('[SRS useTypesOfLeave] Cannot load types of leave: missing context');
      setTypesOfLeave([]);
      setIsLoadingTypesOfLeave(false);
      return;
    }

    try {
      setIsLoadingTypesOfLeave(true);
      setError(undefined);

      console.log('[SRS useTypesOfLeave] Fetching types of leave from service');
      
      const typeOfLeaveService = TypeOfLeaveService.getInstance(context);
      const typesOfLeave = await typeOfLeaveService.getAllTypesOfLeave();

      console.log('[SRS useTypesOfLeave] Types of leave loaded:', {
        count: typesOfLeave.length,
        types: typesOfLeave.map(t => ({ id: t.id, title: t.title }))
      });

      setTypesOfLeave(typesOfLeave);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[SRS useTypesOfLeave] Error loading types of leave:', error);
      
      setError(`Failed to load types of leave: ${errorMessage}`);
      setTypesOfLeave([]);
      
    } finally {
      setIsLoadingTypesOfLeave(false);
    }
  }, [context, setTypesOfLeave, setIsLoadingTypesOfLeave, setError]);

  // Эффект для автоматической загрузки при изменении контекста
  useEffect(() => {
    console.log('[SRS useTypesOfLeave] useEffect triggered for context change');
    console.log('[SRS useTypesOfLeave] Context available:', !!context);
    
    if (context) {
      void loadTypesOfLeave();
    } else {
      console.log('[SRS useTypesOfLeave] Context not available, clearing types of leave');
      setTypesOfLeave([]);
      setIsLoadingTypesOfLeave(false);
    }
  }, [context, loadTypesOfLeave]);

  return {
    loadTypesOfLeave
  };
};