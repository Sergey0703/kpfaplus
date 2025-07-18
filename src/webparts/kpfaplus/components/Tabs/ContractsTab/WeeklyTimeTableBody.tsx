// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableBody.tsx
import * as React from 'react';
import { Spinner, SpinnerSize } from '@fluentui/react';
import styles from './WeeklyTimeTable.module.scss';
import { IExtendedWeeklyTimeRow, isFirstRowInTemplate, isLastRowInTemplate, canDeleteRow } from './WeeklyTimeTableLogic';
import { IDropdownOption } from '@fluentui/react';
import { WeeklyTimeBody } from './WeeklyTimeBody';

// ОБНОВЛЕННЫЙ интерфейс для пропсов компонента WeeklyTimeTableBody
export interface IWeeklyTimeTableBodyProps {
  // Состояние данных и загрузки
  timeTableData: IExtendedWeeklyTimeRow[];
  filteredTimeTableData: IExtendedWeeklyTimeRow[];
  isLoading: boolean;
  dataInitialized: boolean;
  contractName?: string;
  
  // Параметры конфигурации
  orderedWeekDays: { name: string; key: string; }[];
  hoursOptions: IDropdownOption[];
  minutesOptions: IDropdownOption[];
  lunchOptions: IDropdownOption[];
  changedRows: Set<string>;
  
  // ОБНОВЛЕНО: Обработчики действий теперь принимают rowId
  handleTimeChange: (rowId: string, dayKey: string, field: 'hours' | 'minutes', value: string) => void;
  handleLunchChange: (rowId: string, value: string) => void;
  handleContractChange: (rowId: string, value: string) => void;
  
  // Обработчики для кнопок (остаются с rowIndex для совместимости)
  renderAddShiftButton: (rowIndex?: number) => JSX.Element;
  renderDeleteButton: (rowIndex: number) => JSX.Element;
  
  // Вспомогательные функции для проверки состояния строк
  isFirstRowWithNewTemplate: (data: IExtendedWeeklyTimeRow[], rowIndex: number) => boolean;
  
  // Функция для добавления новой недели (отображается при пустой таблице)
  onAddWeek: () => void;
}

/**
 * Компонент тела таблицы недельного расписания
 */
export const WeeklyTimeTableBody: React.FC<IWeeklyTimeTableBodyProps> = ({
  timeTableData,
  filteredTimeTableData,
  isLoading,
  dataInitialized,
  contractName,
  orderedWeekDays,
  hoursOptions,
  minutesOptions,
  lunchOptions,
  changedRows,
  handleTimeChange, // Уже принимает rowId
  handleLunchChange, // Уже принимает rowId
  handleContractChange, // Уже принимает rowId
  renderAddShiftButton,
  renderDeleteButton,
  isFirstRowWithNewTemplate,
  onAddWeek
}) => {
  // Если данные загружаются, показываем спиннер
  if (isLoading) {
    return (
      <div className={styles.spinnerContainer}>
        <Spinner size={SpinnerSize.large} label="Loading weekly time table..." />
      </div>
    );
  }
  
  // Если нет данных или данные еще не инициализированы, показываем сообщение
  if ((filteredTimeTableData.length === 0 && !isLoading) || (!dataInitialized && filteredTimeTableData.length === 0)) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>No schedule data found for this contract. Click &quot;New Week&quot; to create a schedule.</p>
        <button 
          onClick={onAddWeek}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: '#0078d4', 
            color: 'white',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            marginTop: '10px'
          }}
        >
          New Week
        </button>
      </div>
    );
  }
  
  // Если есть данные - отображаем таблицу
  return (
    <WeeklyTimeBody 
      filteredTimeTableData={filteredTimeTableData}
      orderedWeekDays={orderedWeekDays}
      isFirstRowWithNewTemplate={isFirstRowWithNewTemplate}
      isFirstRowInTemplate={isFirstRowInTemplate}
      isLastRowInTemplate={isLastRowInTemplate}
      canDeleteRow={canDeleteRow}
      renderAddShiftButton={renderAddShiftButton}
      renderDeleteButton={renderDeleteButton}
      changedRows={changedRows}
      hoursOptions={hoursOptions}
      minutesOptions={minutesOptions}
      lunchOptions={lunchOptions}
      handleTimeChange={handleTimeChange} // ОБНОВЛЕНО: Передаем функцию, которая уже принимает rowId
      handleLunchChange={handleLunchChange} // ОБНОВЛЕНО: Передаем функцию, которая уже принимает rowId
      handleContractChange={handleContractChange} // ОБНОВЛЕНО: Передаем функцию, которая уже принимает rowId
    />
  );
};

export default WeeklyTimeTableBody;