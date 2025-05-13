// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeBody.tsx
import * as React from 'react';
import styles from './WeeklyTimeTable.module.scss';
import { IExtendedWeeklyTimeRow } from './WeeklyTimeTableLogic';
import { IDayHoursComplete } from '../../../models/IWeeklyTimeTable';
import { IDropdownOption } from '@fluentui/react';
import {
  TimeCell,
  LunchCell,
  ContractCell,
  TotalHoursCell
} from './WeeklyTimeTableCells';
import { ActionsCell } from './WeeklyTimeTableButtons';

// Интерфейс для пропсов компонента WeeklyTimeBody
export interface IWeeklyTimeBodyProps {
  filteredTimeTableData: IExtendedWeeklyTimeRow[];
  orderedWeekDays: { name: string; key: string; }[];
  isFirstRowWithNewTemplate: (data: IExtendedWeeklyTimeRow[], rowIndex: number) => boolean;
  isFirstRowInTemplate: (data: IExtendedWeeklyTimeRow[], rowIndex: number) => boolean;
  isLastRowInTemplate: (data: IExtendedWeeklyTimeRow[], rowIndex: number) => boolean;
  canDeleteRow: (data: IExtendedWeeklyTimeRow[], rowIndex: number) => boolean;
  renderAddShiftButton: () => JSX.Element;
  renderDeleteButton: (rowIndex: number) => JSX.Element;
  changedRows: Set<string>;
  hoursOptions: IDropdownOption[];
  minutesOptions: IDropdownOption[];
  lunchOptions: IDropdownOption[];
  handleTimeChange: (rowIndex: number, dayKey: string, field: 'hours' | 'minutes', value: string) => void;
  handleLunchChange: (rowIndex: number, value: string) => void;
  handleContractChange: (rowIndex: number, value: string) => void;
}

export const WeeklyTimeBody: React.FC<IWeeklyTimeBodyProps> = (props) => {
  const {
    filteredTimeTableData,
    orderedWeekDays,
    isFirstRowWithNewTemplate,
    isFirstRowInTemplate,
    isLastRowInTemplate,
    canDeleteRow,
    renderAddShiftButton,
    renderDeleteButton,
    changedRows,
    hoursOptions,
    minutesOptions,
    lunchOptions,
    handleTimeChange,
    handleLunchChange,
    handleContractChange
  } = props;

  return (
    <div className={styles.tableContainer}>
      <table className={styles.timeTable}>
        <thead>
          <tr>
            {/* Столбец для рабочих часов */}
            <th className={styles.hoursColumn}>Hours</th>
            <th className={styles.nameColumn}>Name / Lunch</th>
            {orderedWeekDays.map(day => (
              <th key={day.key}>{day.name}</th>
            ))}
            <th className={styles.totalColumn}>Contract</th>
            <th className={styles.actionsColumn}></th>
          </tr>
        </thead>
        <tbody>
          {filteredTimeTableData.map((row, rowIndex) => {
            // Определяем класс для строки обеда
            const lunchRowClassName = styles.lunchRow;
            console.log(`Row ${rowIndex} - ID: ${row.id}, NumberOfShift: ${row.NumberOfShift}, isFirst: ${isFirstRowWithNewTemplate(filteredTimeTableData, rowIndex)}`);

            return (
              <React.Fragment key={row.id}>
                {/* Добавляем синюю линию перед строками с NumberOfShift = 1 */}
                {isFirstRowWithNewTemplate(filteredTimeTableData, rowIndex) && (
                  <tr style={{ height: '3px', padding: 0 }}>
                    <td colSpan={orderedWeekDays.length + 3} style={{ 
                      backgroundColor: '#0078d4', 
                      height: '3px',
                      padding: 0,
                      border: 'none'
                    }}></td>
                  </tr>
                )}
                
                {/* Первая строка - начало рабочего дня */}
                <tr className={styles.weekRow}>
                  {/* Ячейка для рабочих часов - отображаем общее время для первой строки шаблона */}
                  <td className={styles.hoursCell} rowSpan={2}>
                    <TotalHoursCell
                      timeTableData={filteredTimeTableData}
                      rowIndex={rowIndex}
                      isFirstRowInTemplate={isFirstRowInTemplate(filteredTimeTableData, rowIndex)}
                      isLastRowInTemplate={isLastRowInTemplate(filteredTimeTableData, rowIndex)}
                      renderAddShiftButton={renderAddShiftButton}
                    />
                    </td>
                  <td className={styles.nameCell} rowSpan={2}>
                    <div className={styles.rowName}>{row.name}</div>
                    <div className={styles.lunchLabel}>Lunch:</div>
                  </td>
                  {/* Ячейки для начала рабочего дня для каждого дня недели */}
                  {orderedWeekDays.map(day => {
                    const dayData = row[day.key] as IDayHoursComplete;
                    return (
                      <td key={`${day.key}-start`}>
                        <TimeCell
                          hours={dayData?.start?.hours || '00'}
                          minutes={dayData?.start?.minutes || '00'}
                          rowIndex={rowIndex}
                          dayKey={`${day.key}-start`}
                          isChanged={changedRows.has(row.id)}
                          hoursOptions={hoursOptions}
                          minutesOptions={minutesOptions}
                          onTimeChange={handleTimeChange}
                        />
                      </td>
                    );
                  })}
                  <td className={styles.totalColumn} rowSpan={2}>
                    <ContractCell
                      contractNumber={row.total}
                      rowIndex={rowIndex}
                      isChanged={changedRows.has(row.id)}
                      onContractChange={handleContractChange}
                    />
                    <div className={styles.contractInfo}>
                      {row.totalHours || '0ч:00м'}
                    </div>
                  </td>
                  <td className={styles.actionsColumn} rowSpan={2}>
  {/* Отображаем кнопки действий, если строку можно удалить */}
  {canDeleteRow(filteredTimeTableData, rowIndex) ? (
    <ActionsCell
      rowId={row.id}
      renderDeleteButton={() => renderDeleteButton(rowIndex)}
    />
  ) : (
    /* Если строку нельзя удалить, все равно показываем ID */
    <div className={styles.actionsContainer}>
      <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>ID: {row.id}</span>
    </div>
  )}
</td>
                </tr>
                
                {/* Вторая строка - конец рабочего дня */}
                <tr className={styles.weekEndRow}>
                  {/* Ячейки для окончания рабочего дня для каждого дня недели */}
                  {orderedWeekDays.map(day => {
                    const dayData = row[day.key] as IDayHoursComplete;
                    return (
                      <td key={`${day.key}-end`}>
                        <TimeCell
                          hours={dayData?.end?.hours || '00'}
                          minutes={dayData?.end?.minutes || '00'}
                          rowIndex={rowIndex}
                          dayKey={`${day.key}-end`}
                          isChanged={changedRows.has(row.id)}
                          hoursOptions={hoursOptions}
                          minutesOptions={minutesOptions}
                          onTimeChange={handleTimeChange}
                        />
                      </td>
                    );
                  })}
                </tr>
                
                {/* Строка для обеда */}
                <tr className={lunchRowClassName}>
                  <td colSpan={2} className={styles.lunchCell}>
                    <LunchCell
                      lunch={row.lunch}
                      rowIndex={rowIndex}
                      isChanged={changedRows.has(row.id)}
                      lunchOptions={lunchOptions}
                      onLunchChange={handleLunchChange}
                    />
                  </td>
                  <td colSpan={9}></td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};