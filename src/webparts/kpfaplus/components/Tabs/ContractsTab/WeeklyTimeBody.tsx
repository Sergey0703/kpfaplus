// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeBody.tsx
import * as React from 'react';
import styles from './WeeklyTimeTable.module.scss';
import { IExtendedWeeklyTimeRow, canRestoreRow } from './WeeklyTimeTableLogic';
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
  renderAddShiftButton: (rowIndex?: number) => JSX.Element;
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
      <table className={styles.timeTable} style={{ borderSpacing: '0', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {/* Столбец для рабочих часов - уменьшаем ширину и правый отступ */}
            <th className={styles.hoursColumn} style={{ width: '60px', minWidth: '60px', maxWidth: '60px', paddingRight: '0px' }}>Hours</th>
            <th className={styles.nameColumn} style={{ paddingLeft: '4px' }}>Name / Lunch</th>
            {orderedWeekDays.map(day => (
              <th key={day.key}>{day.name}</th>
            ))}
            {/* Уменьшаем ширину колонки Contract */}
            <th className={styles.totalColumn} style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>Contract</th>
            {/* Уменьшаем ширину колонки с ID и левый отступ */}
            <th className={styles.actionsColumn} style={{ width: '45px', minWidth: '45px', maxWidth: '45px', paddingLeft: '0px' }} />
          </tr>
        </thead>
        <tbody>
          {filteredTimeTableData.map((row, rowIndex) => {
            // Определяем, удалена ли строка
            const isDeleted = row.deleted === 1 || row.Deleted === 1;
            
            // Классы для строк с учетом удаления
            const weekRowClassName = `${styles.weekRow} ${isDeleted ? styles.deletedRow : ''}`;
            const weekEndRowClassName = `${styles.weekEndRow} ${isDeleted ? styles.deletedRow : ''}`;
            
            console.log(`Row ${rowIndex} - ID: ${row.id}, NumberOfShift: ${row.NumberOfShift}, isFirst: ${isFirstRowWithNewTemplate(filteredTimeTableData, rowIndex)}, isDeleted: ${isDeleted}`);
  
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
                    }} />
                  </tr>
                )}
                
                {/* Первая строка - начало рабочего дня */}
                <tr className={weekRowClassName}>
                  {/* Ячейка для рабочих часов - отображаем общее время для первой строки шаблона */}
                  <td className={styles.hoursCell} rowSpan={2} style={{ width: '60px', minWidth: '60px', maxWidth: '60px', paddingRight: '0px' }}>
                    <TotalHoursCell
                      timeTableData={filteredTimeTableData}
                      rowIndex={rowIndex}
                      isFirstRowInTemplate={isFirstRowInTemplate(filteredTimeTableData, rowIndex)}
                      isLastRowInTemplate={isLastRowInTemplate(filteredTimeTableData, rowIndex)}
                      renderAddShiftButton={renderAddShiftButton}
                      isDeleted={isDeleted}
                    />
                  </td>
                  
                  {/* Ячейка для имени и обеда - теперь содержит и выпадающий список обеда */}
                  <td className={styles.nameCell} rowSpan={2} style={{ paddingLeft: '4px' }}>
                    <div className={`${styles.rowName} ${isDeleted ? styles.deletedText : ''}`}>
                      {row.name}
                      {isDeleted && <span style={{ color: '#d83b01', marginLeft: '5px' }}>(Deleted)</span>}
                    </div>
                    <div className={styles.lunchLabel}>Lunch:</div>
                    <div className={styles.lunchCell}>
                      <LunchCell
                        lunch={row.lunch}
                        rowIndex={rowIndex}
                        isChanged={changedRows.has(row.id)}
                        isDeleted={isDeleted}
                        lunchOptions={lunchOptions}
                        onLunchChange={handleLunchChange}
                      />
                    </div>
                  </td>
                  
                  {/* Ячейки для начала рабочего дня для каждого дня недели */}
                  {orderedWeekDays.map(day => {
                    const dayData = row[day.key] as IDayHoursComplete;
                    return (
                      <td key={`${day.key}-start`} style={{ padding: '2px' }}>
                        <TimeCell
                          hours={dayData?.start?.hours || '00'}
                          minutes={dayData?.start?.minutes || '00'}
                          rowIndex={rowIndex}
                          dayKey={`${day.key}-start`}
                          isChanged={changedRows.has(row.id)}
                          isDeleted={isDeleted}
                          hoursOptions={hoursOptions}
                          minutesOptions={minutesOptions}
                          onTimeChange={handleTimeChange}
                        />
                      </td>
                    );
                  })}
                  <td className={styles.totalColumn} rowSpan={2} style={{ width: '50px', minWidth: '50px', maxWidth: '50px' }}>
                    <ContractCell
                      contractNumber={row.total}
                      rowIndex={rowIndex}
                      isChanged={changedRows.has(row.id)}
                      isDeleted={isDeleted}
                      onContractChange={handleContractChange}
                    />
                    <div className={`${styles.contractInfo} ${isDeleted ? styles.deletedText : ''}`}>
                      {row.totalHours || '0ч:00м'}
                    </div>
                  </td>
                  
                  <td className={styles.actionsColumn} rowSpan={2} style={{ width: '45px', minWidth: '45px', maxWidth: '45px', paddingLeft: '0px' }}>
                    {(() => {
                      const isRowDeleted = row.deleted === 1 || row.Deleted === 1;
                      console.log(`Row ${rowIndex}, ID=${row.id}: isDeleted=${isRowDeleted}`);
                      
                      // Для неудаленных строк - проверяем можно ли удалить
                      if (!isRowDeleted) {
                        const canDelete = canDeleteRow(filteredTimeTableData, rowIndex);
                        console.log(`Row ${rowIndex}, ID=${row.id}: canDelete=${canDelete}`);
                        
                        if (canDelete) {
                          // Если строку можно удалить, показываем кнопку удаления
                          return (
                            <ActionsCell
                              rowId={row.id}
                              renderDeleteButton={() => renderDeleteButton(rowIndex)}
                              isDeleted={false}
                            />
                          );
                        } else {
                          // Если строку нельзя удалить, показываем только ID
                          return (
                            <div className={styles.actionsContainer}>
                              <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>ID: {row.id}</span>
                            </div>
                          );
                        }
                      } 
                      // Для удаленных строк - проверяем можно ли восстановить
                      else {
                        const canRestore = canRestoreRow(filteredTimeTableData, rowIndex);
                        console.log(`Row ${rowIndex}, ID=${row.id}: canRestore=${canRestore}`);
                        
                        if (canRestore) {
                          // Если строку можно восстановить, показываем кнопку восстановления
                          return (
                            <ActionsCell
                              rowId={row.id}
                              renderDeleteButton={() => renderDeleteButton(rowIndex)}
                              isDeleted={true}
                            />
                          );
                        } else {
                          // Если строку нельзя восстановить, показываем только ID
                          return (
                            <div className={styles.actionsContainer}>
                              <span style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>ID: {row.id}</span>
                            </div>
                          );
                        }
                      }
                    })()}
                  </td>
                </tr>
                
                {/* Вторая строка - конец рабочего дня */}
                <tr className={weekEndRowClassName}>
                  {/* Ячейки для окончания рабочего дня для каждого дня недели */}
                  {orderedWeekDays.map(day => {
                    const dayData = row[day.key] as IDayHoursComplete;
                    return (
                      <td key={`${day.key}-end`} style={{ padding: '2px' }}>
                        <TimeCell
                          hours={dayData?.end?.hours || '00'}
                          minutes={dayData?.end?.minutes || '00'}
                          rowIndex={rowIndex}
                          dayKey={`${day.key}-end`}
                          isChanged={changedRows.has(row.id)}
                          isDeleted={isDeleted}
                          hoursOptions={hoursOptions}
                          minutesOptions={minutesOptions}
                          onTimeChange={handleTimeChange}
                        />
                      </td>
                    );
                  })}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};