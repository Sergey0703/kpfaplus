// src/webparts/kpfaplus/components/LoadingProgress/LoadingProgress.tsx
import * as React from 'react';
import { useDataContext } from '../../context';
import { Spinner, SpinnerSize, DetailsList, IColumn, SelectionMode, MessageBar, MessageBarType } from '@fluentui/react';
import { ILoadingStep } from '../../context/types';

export interface ILoadingProgressProps {
  showDetail?: boolean;
}

export const LoadingProgress: React.FC<ILoadingProgressProps> = (props) => {
  const { showDetail = false } = props;
  const { loadingState } = useDataContext();
  
  // Колонки для DetailsList
  const columns: IColumn[] = [
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 70,
      maxWidth: 70,
      onRender: (item: ILoadingStep) => {
        switch (item.status) {
          case 'pending':
            return <span>⏱️</span>;
          case 'loading':
            return <Spinner size={SpinnerSize.small} />;
          case 'success':
            return <span style={{ color: 'green' }}>✅</span>;
          case 'error':
            return <span style={{ color: 'red' }}>❌</span>;
          default:
            return null;
        }
      }
    },
    {
      key: 'description',
      name: 'Description',
      fieldName: 'description',
      minWidth: 200,
      maxWidth: 300,
      isMultiline: true
    },
    {
      key: 'timestamp',
      name: 'Time',
      fieldName: 'timestamp',
      minWidth: 100,
      maxWidth: 150,
      onRender: (item: ILoadingStep) => {
        return item.timestamp.toLocaleTimeString();
      }
    },
    {
      key: 'details',
      name: 'Details',
      fieldName: 'details',
      minWidth: 200,
      isMultiline: true,
      onRender: (item: ILoadingStep) => {
        return item.details || '';
      }
    }
  ];
  
  if (loadingState.isLoading) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
          <Spinner size={SpinnerSize.medium} label="Loading data..." labelPosition="right" />
        </div>
        
        {showDetail && loadingState.loadingSteps.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3>Loading Progress</h3>
            <DetailsList
              items={loadingState.loadingSteps}
              columns={columns}
              selectionMode={SelectionMode.none}
              compact={true}
            />
          </div>
        )}
      </div>
    );
  }
  
  if (loadingState.hasError) {
    return (
      <div style={{ padding: '20px' }}>
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={true}
        >
          {loadingState.errorMessage}
        </MessageBar>
        
        {showDetail && loadingState.loadingSteps.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h3>Error Details</h3>
            <DetailsList
              items={loadingState.loadingSteps}
              columns={columns}
              selectionMode={SelectionMode.none}
              compact={true}
            />
          </div>
        )}
      </div>
    );
  }
  
  return null;
};