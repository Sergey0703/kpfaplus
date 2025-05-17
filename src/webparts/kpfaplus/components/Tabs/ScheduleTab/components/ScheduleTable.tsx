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
}

// Опции для выпадающих списков
export interface IScheduleOptions {
  hours: IDropdownOption[];
  minutes: IDropdownOption[];
  lunchTimes: IDropdownOption[];
  leaveTypes: IDropdownOption[];
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

  // Состояние для выбора всех строк
  const [selectAllRows, setSelectAllRows] = useState<boolean>(false);
  
  // Состояние для выбранных строк
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // Обработчик изменения времени
  const handleTimeChange = (item: IScheduleItem, field: string, value: string) => {
    onItemChange(item, field, value);
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

      {/* Заголовки колонок в виде текста (для лучшего форматирования) */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid #edebe9', 
        paddingBottom: '8px',
        fontWeight: 'bold'
      }}>
        <div style={{ width: '100px' }}>Date</div>
        <div style={{ width: '80px' }}></div> {/* Увеличил ширину с 120px до 150px */}
        <div style={{ width: '150px' }}>Start Work</div>
        <div style={{ width: '150px' }}>Finish Work</div>
        <div style={{ width: '150px' }}>Time for Lunch:</div>
        <div style={{ width: '150px' }}>Type of Leave</div>
        <div style={{ width: '80px' }}></div> {/* Для кнопки +Shift */}
        <div style={{ width: '40px' }}></div> {/* Для кнопки удаления */}
        <div style={{ width: '80px' }}>ID</div> {/* Для ID */}
      </div>

      {/* Содержимое таблицы */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          Loading schedule data...
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px' }}>
          No schedule items found for the selected date and contract.
        </div>
      ) : (
        <div>
          {items.map((item, index) => {
            // Определяем цвет фона для строки (чередование, выделение и т.д.)
            const isEvenRow = index % 2 === 0;
            const backgroundColor = isEvenRow ? '#f9f9f9' : '#ffffff';
                
            return (
              <div 
                key={item.id}
                style={{ 
                  display: 'flex', 
                  padding: '8px 0',
                  backgroundColor,
                  border: '1px solid #edebe9',
                  marginBottom: '4px',
                  borderRadius: '2px'
                }}
              >
                {/* Ячейки данных */}
                <div style={{ width: '100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div>{formatDate(item.date)}</div>
                  <div style={{ fontWeight: 'normal', fontSize: '12px' }}>{item.dayOfWeek}</div>
                </div>
                
                <div style={{ 
                  width: '80px', /* Увеличил ширину с 120px до 150px */
                  minWidth: '80px', /* Добавил minWidth чтобы гарантировать ширину */
                  display: 'flex', 
                  alignItems: 'center',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap', /* Запрещаем перенос текста */
                  paddingLeft: '15px' /* Добавил отступ справа */
                }}>
                  {item.workingHours}
                </div>
                
                <div style={{ width: '150px', display: 'flex', alignItems: 'center' }}>
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
                
                <div style={{ width: '150px', display: 'flex', alignItems: 'center' }}>
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
                
                <div style={{ width: '150px', display: 'flex', alignItems: 'center' }}>
                  <Dropdown
                    selectedKey={item.lunchTime}
                    options={options.lunchTimes}
                    onChange={(_, option) => handleTimeChange(item, 'lunchTime', option?.key as string)}
                    styles={{ root: { width: 80 } }}
                  />
                </div>
                
                <div style={{ width: '150px', display: 'flex', alignItems: 'center' }}>
                  <Dropdown
                    selectedKey={item.typeOfLeave}
                    options={options.leaveTypes}
                    onChange={(_, option) => handleTimeChange(item, 'typeOfLeave', option?.key as string)}
                    styles={{ root: { width: 150 } }}
                  />
                </div>
                
                {/* Кнопка +Shift */}
                <div style={{ width: '80px', display: 'flex', alignItems: 'center' }}>
                  <PrimaryButton
                    text="+Shift"
                    styles={{ root: { minWidth: 70, padding: '0 8px', backgroundColor: '#107c10' } }}
                    onClick={() => onAddShift(item.date)}
                  />
                </div>
                
                {/* Иконка удаления */}
                <div style={{ width: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '10px' }}>
                  <IconButton
                    iconProps={{ iconName: 'Delete' }}
                    title="Delete"
                    ariaLabel="Delete"
                    onClick={() => onDeleteItem(item.id)}
                  />
                </div>
                
                {/* Текстовое поле для ID */}
                <div style={{ width: '80px', display: 'flex', alignItems: 'center', fontSize: '12px', color: '#666', marginLeft: '10px' }}>
                  {item.id}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduleTable;