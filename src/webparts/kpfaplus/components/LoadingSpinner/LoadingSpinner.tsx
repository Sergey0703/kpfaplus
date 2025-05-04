// src/webparts/kpfaplus/components/LoadingSpinner/LoadingSpinner.tsx
import * as React from 'react';
import { Spinner, SpinnerSize, ProgressIndicator } from '@fluentui/react';
import { useDataContext } from '../../context';
import styles from './LoadingSpinner.module.scss';

export interface ILoadingSpinnerProps {
  showDetails?: boolean;
}

export const LoadingSpinner: React.FC<ILoadingSpinnerProps> = (props) => {
  const { showDetails = true } = props;
  const { loadingState } = useDataContext();
  
  // Вычисляем прогресс загрузки на основе шагов
  const calculateProgress = (): number => {
    const totalSteps = loadingState.loadingSteps.length;
    if (totalSteps === 0) return 0;
    
    const completedSteps = loadingState.loadingSteps.filter(
      step => step.status === 'success'
    ).length;
    
    return completedSteps / totalSteps;
  };
  
  // Получаем текущий шаг загрузки (самый последний)
  const getCurrentStep = (): string => {
    if (loadingState.loadingSteps.length === 0) {
      return "Initializing...";
    }
    
    const lastStep = loadingState.loadingSteps[loadingState.loadingSteps.length - 1];
    return lastStep.description;
  };
  
  // Получаем детали текущего шага
  const getCurrentStepDetails = (): string => {
    if (loadingState.loadingSteps.length === 0) {
      return "";
    }
    
    const lastStep = loadingState.loadingSteps[loadingState.loadingSteps.length - 1];
    return lastStep.details || "";
  };
  
  return (
    <div className={styles.loadingSpinner}>
      <div className={styles.spinnerContainer}>
        <Spinner size={SpinnerSize.large} label="Loading application data..." />
        
        <div className={styles.progressContainer}>
          <ProgressIndicator 
            percentComplete={calculateProgress()} 
            description={getCurrentStep()}
            barHeight={4}
          />
          
          {showDetails && getCurrentStepDetails() && (
            <div className={styles.stepDetails}>
              {getCurrentStepDetails()}
            </div>
          )}
        </div>
        
        {showDetails && (
          <div className={styles.stepsContainer}>
            <h3 className={styles.stepsTitle}>Initialization Steps:</h3>
            <div className={styles.stepsList}>
              {loadingState.loadingSteps.map((step, index) => (
                <div 
                  key={index} 
                  className={`${styles.step} ${styles[step.status]}`}
                >
                  <div className={styles.stepIcon}>
                    {step.status === 'pending' && '⏱️'}
                    {step.status === 'loading' && '🔄'}
                    {step.status === 'success' && '✅'}
                    {step.status === 'error' && '❌'}
                  </div>
                  <div className={styles.stepContent}>
                    <div className={styles.stepDescription}>
                      {step.description}
                    </div>
                    {step.details && (
                      <div className={styles.stepDetails}>
                        {step.details}
                      </div>
                    )}
                    <div className={styles.stepTime}>
                      {step.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};