// src/webparts/kpfaplus/components/RefreshButton/RefreshButton.tsx
import * as React from 'react';
import { IconButton, Spinner, SpinnerSize } from '@fluentui/react';
import { useDataContext } from '../../context';

export interface IRefreshButtonProps {
  title?: string;
}

export const RefreshButton: React.FC<IRefreshButtonProps> = (props) => {
  const { title = 'Refresh Data' } = props;
  const { loadingState, refreshData } = useDataContext();
  const [isRefreshing, setIsRefreshing] = React.useState<boolean>(false);
  
  // Обработчик нажатия на кнопку обновления
  const handleRefresh = React.useCallback(async () => {
    if (loadingState.isLoading || isRefreshing) {
      return; // Предотвращаем повторное нажатие, если загрузка уже идет
    }
    
    setIsRefreshing(true);
    
    try {
      await refreshData();
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadingState.isLoading, isRefreshing, refreshData]);
  
  return (
    <div style={{ display: 'inline-block', position: 'relative' }}>
      {isRefreshing ? (
        <Spinner size={SpinnerSize.small} />
      ) : (
        <IconButton
          iconProps={{ iconName: 'Refresh' }}
          title={title}
          onClick={handleRefresh}
          disabled={loadingState.isLoading}
        />
      )}
    </div>
  );
};