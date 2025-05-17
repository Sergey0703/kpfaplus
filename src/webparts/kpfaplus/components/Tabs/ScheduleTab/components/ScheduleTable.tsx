// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTable.tsx
import * as React from 'react';
import { useState } from 'react';
import {
  Dropdown,
  IDropdownOption,
  IconButton,
  PrimaryButton,
  DefaultButton,
  Stack,
  IStackTokens,
  Toggle
} from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';

// Интерфейс для записи о расписании
export interface IScheduleItem {
  id: string;
  date: Date;
  dayOfWeek: string;
  workingHours: string;
  startHour: string;
  startMinute: string;
  finishHour: string;
  finishMinute: string;
  lunchTime: string;
  typeOfLeave?: string;
  shift: number;
  contract: string;
  contractId: string;
  contractNumber?: string; // Добавляем поле для номера контракта
}

// Опции для выпадающих списков
export interface IScheduleOptions {
  hours: IDropdownOption[];
  minutes: IDropdownOption[];
  lunchTimes: IDropdownOption[];
  leaveTypes: IDropdownOption[];
  contractNumbers?: IDropdownOption[]; // Сделаем необязательным с помощью ?
}

// Интерфейс свойств компонента
export interface IScheduleTableProps {
  items: IScheduleItem[];
  options: IScheduleOptions;
  selectedDate: Date;
  selectedContract?: { id: string; name: string };
  isLoading: boolean;
  showDeleted: boolean;
  onToggleShowDeleted: (checked: boolean) => void;
  onItemChange: (item: IScheduleItem, field: string, value: any) => void;
  onAddShift: (date: Date) => void;
  onDeleteItem: (id: string) => void;
}

// Вспомогательная функция
const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

// Компонент таблицы расписания
export const ScheduleTable: React.FC<IScheduleTableProps> = (props) => {
  const {
    items,
    options,
    isLoading,
    showDeleted,
    onToggleShowDeleted,
    onItemChange,
    onAddShift,
    onDeleteItem
  } = props;

  // Используем предоставленные опции или дефолтные
  const contractOptions = options.contractNumbers || [
    { key: '1', text: '1' },
    { key: '2', text: '2' },
    { key: '3', text: '3' }
  ];

  // Состояние для выбора всех строк
  const [selectAllRows, setSelectAllRows] = useState<boolean>(false);
  
  // Состояние для выбранных строк
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Обработчик изменения времени
  const handleTimeChange = (item: IScheduleItem, field: string, value: string) => {
    onItemChange(item, field, value);
  };

  // Обработчик изменения контракта
  const handleContractNumberChange = (item: IScheduleItem, value: string) => {
    onItemChange(item, 'contractNumber', value);
  };

  // Обработчик выбора/отмены выбора всех строк
  const handleSelectAllRows = (checked: boolean) => {
    setSelectAllRows(checked);
    
    if (checked) {
      // Выбираем все строки
      const newSelected = new Set<string>();
      items.forEach(item => newSelected.add(item.id));
      setSelectedRows(newSelected);
    } else {
      // Снимаем выбор со всех строк
      setSelectedRows(new Set());
    }
  };

  // Обработчик для удаления всех выбранных строк
  const handleDeleteSelected = () => {
    selectedRows.forEach(id => {
      onDeleteItem(id);
    });
    
    // Сбрасываем выбор
    setSelectedRows(new Set());
    setSelectAllRows(false);
  };

  // Разделители для Stack
  const stackTokens: IStackTokens = { childrenGap: 10 };

  return (
    <div className={styles.scheduleTab}>
      {/* Верхняя панель управления */}
      <Stack horizontal tokens={stackTokens} style={{ marginBottom: '16px', justifyContent: 'space-between', alignItems: 'center' }}>
        <Stack horizontal tokens={stackTokens} style={{ alignItems: 'center' }}>
          <Toggle
            label="Select All rows"
            checked={selectAllRows}
            onChange={(_, checked) => handleSelectAllRows(checked!)}
          />
          {selectedRows.size > 0 && (
            <DefaultButton
              text={`Delete all selected rows (${selectedRows.size})`}
              onClick={handleDeleteSelected}
              style={{ marginLeft: '16px' }}
            />
          )}
        </Stack>
        <Toggle
          label="Show Deleted"
          checked={showDeleted}
          onChange={(_, checked) => onToggleShowDeleted(checked!)}
        />
      </Stack>

      {/* Таблица расписания - задаем общую ширину и убираем spacing */}
      <div className={styles.tableContainer} style={{ width: '100%' }}>
        <table style={{ borderSpacing: '0', borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '100px' }} /> {/* Date */}
            <col style={{ width: '80px' }} /> {/* Hours */}
            <col style={{ width: '150px' }} /> {/* Start Work */}
            <col style={{ width: '150px' }} /> {/* Finish Work */}
            <col style={{ width: '100px' }} /> {/* Time for Lunch */}
            <col style={{ width: '150px' }} /> {/* Type of Leave */}
            <col style={{ width: '70px' }} /> {/* +Shift */}
            <col style={{ width: '60px' }} /> {/* Contract */}
            <col style={{ width: '30px' }} /> {/* Delete */}
            <col style={{ width: '80px' }} /> {/* ID */}
          </colgroup>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Date</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}>Hours</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}>Start Work</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}>Finish Work</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}>Time for Lunch:</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}>Type of Leave</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}></th> {/* Для кнопки +Shift */}
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Contract</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }}></th> {/* Для кнопки удаления */}
              <th style={{ textAlign: 'center', padding: '8px 0' }}>ID</th> {/* Для ID */}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                  Loading schedule data...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>
                  No schedule items found for the selected date and contract.
                </td>
              </tr>
            ) : (
              items.map((item, index) => {
                // Определяем цвет фона для строки (чередование, выделение и т.д.)
                const isEvenRow = index % 2 === 0;
                const backgroundColor = isEvenRow ? '#f9f9f9' : '#ffffff';
                
                return (
                  <tr 
                    key={item.id}
                    style={{ 
                      backgroundColor,
                      border: '1px solid #edebe9',
                      marginBottom: '4px',
                      borderRadius: '2px'
                    }}
                  >
                    {/* Ячейка с датой */}
                    <td style={{ padding: '8px 0 8px 8px' }}>
                      <div>{formatDate(item.date)}</div>
                      <div style={{ fontWeight: 'normal', fontSize: '12px' }}>{item.dayOfWeek}</div>
                    </td>
                    
                    {/* Ячейка с рабочими часами */}
                    <td style={{ 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.workingHours}
                    </td>
                    
                    {/* Ячейка с началом работы */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Dropdown
                          selectedKey={item.startHour}
                          options={options.hours}
                          onChange={(_, option) => handleTimeChange(item, 'startHour', option?.key as string)}
                          styles={{ root: { width: 60, margin: '0 4px' } }}
                        />
                        <Dropdown
                          selectedKey={item.startMinute}
                          options={options.minutes}
                          onChange={(_, option) => handleTimeChange(item, 'startMinute', option?.key as string)}
                          styles={{ root: { width: 60, margin: '0 4px' } }}
                        />
                      </div>
                    </td>
                    
                    {/* Ячейка с окончанием работы */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Dropdown
                          selectedKey={item.finishHour}
                          options={options.hours}
                          onChange={(_, option) => handleTimeChange(item, 'finishHour', option?.key as string)}
                          styles={{ root: { width: 60, margin: '0 4px' } }}
                        />
                        <Dropdown
                          selectedKey={item.finishMinute}
                          options={options.minutes}
                          onChange={(_, option) => handleTimeChange(item, 'finishMinute', option?.key as string)}
                          styles={{ root: { width: 60, margin: '0 4px' } }}
                        />
                      </div>
                    </td>
                    
                    {/* Ячейка с временем обеда */}
                    <td style={{ textAlign: 'center' }}>
                      <Dropdown
                        selectedKey={item.lunchTime}
                        options={options.lunchTimes}
                        onChange={(_, option) => handleTimeChange(item, 'lunchTime', option?.key as string)}
                        styles={{ root: { width: 80 } }}
                      />
                    </td>
                    
                    {/* Ячейка с типом отпуска */}
                    <td style={{ textAlign: 'center' }}>
                      <Dropdown
                        selectedKey={item.typeOfLeave}
                        options={options.leaveTypes}
                        onChange={(_, option) => handleTimeChange(item, 'typeOfLeave', option?.key as string)}
                        styles={{ root: { width: 150 } }}
                      />
                    </td>
                    
                    {/* Кнопка +Shift */}
                    <td style={{ textAlign: 'center', padding: '0' }}>
                      <PrimaryButton
                        text="+Shift"
                        styles={{ root: { minWidth: 60, padding: '0 4px', backgroundColor: '#107c10' } }}
                        onClick={() => onAddShift(item.date)}
                      />
                    </td>
                    
                    {/* Ячейка с номером контракта - оставляем нормальный размер */}
                    <td>
                      <Dropdown
                        selectedKey={item.contractNumber || '1'} // По умолчанию '1'
                        options={contractOptions}
                        onChange={(_, option) => handleContractNumberChange(item, option?.key as string)}
                        styles={{ root: { width: 50 } }}
                      />
                    </td>
                    
                    {/* Иконка удаления - делаем красной */}
                    <td style={{ textAlign: 'center', padding: '0' }}>
                      <IconButton
                        iconProps={{ iconName: 'Delete' }}
                        title="Delete"
                        ariaLabel="Delete"
                        onClick={() => onDeleteItem(item.id)}
                        styles={{ 
                          root: { color: '#e81123' },
                          rootHovered: { color: '#a80000' }
                        }}
                      />
                    </td>
                    
                    {/* Текстовое поле для ID */}
                    <td style={{ textAlign: 'center', fontSize: '12px', color: '#666' }}>
                      {item.id}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTable;