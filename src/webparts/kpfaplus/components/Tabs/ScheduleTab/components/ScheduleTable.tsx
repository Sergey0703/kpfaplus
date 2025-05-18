// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/ScheduleTable.tsx
import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import {
  Dropdown,
  IDropdownOption,
  IconButton,
  PrimaryButton,
  DefaultButton,
  Stack,
  IStackTokens,
  Toggle,
  Text,
  TooltipHost
} from '@fluentui/react';
import styles from '../ScheduleTab.module.scss';
import { 
  calculateWorkTime, 
  IWorkTimeInput, 
  createTimeFromComponents,
  isStartEndTimeSame,
  isZeroTime
} from '../../../../utils/TimeCalculationUtils';

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
  contractNumber?: string;
  deleted?: boolean;
}

// Опции для выпадающих списков
export interface IScheduleOptions {
  hours: IDropdownOption[];
  minutes: IDropdownOption[];
  lunchTimes: IDropdownOption[];
  leaveTypes: IDropdownOption[];
  contractNumbers?: IDropdownOption[];
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
  onItemChange: (item: IScheduleItem, field: string, value: string | number) => void;
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
  //  selectedDate
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

  // Состояние для локальных расчетов рабочего времени (для мгновенного отображения)
  const [calculatedWorkTimes, setCalculatedWorkTimes] = useState<Record<string, string>>({});

  // Эффект для инициализации рассчитанных рабочих времен
  useEffect(() => {
    const initialWorkTimes: Record<string, string> = {};
    items.forEach(item => {
      initialWorkTimes[item.id] = item.workingHours;
    });
    setCalculatedWorkTimes(initialWorkTimes);
  }, [items]);

  // Функция для расчета рабочего времени
  const calculateItemWorkTime = useCallback((item: IScheduleItem): string => {
    // Парсим часы и минуты из строк
    const startHour = parseInt(item.startHour, 10) || 0;
    const startMinute = parseInt(item.startMinute, 10) || 0;
    const finishHour = parseInt(item.finishHour, 10) || 0;
    const finishMinute = parseInt(item.finishMinute, 10) || 0;
    const lunchMinutes = parseInt(item.lunchTime, 10) || 0;

    // Создаем даты для расчета
    const startDate = createTimeFromComponents(item.date, startHour, startMinute);
    const finishDate = createTimeFromComponents(item.date, finishHour, finishMinute);

    // Если начальное и конечное время совпадают, и они не 00:00
    if (isStartEndTimeSame(startDate, finishDate) && 
        (!isZeroTime(startDate) || !isZeroTime(finishDate))) {
      console.log(`[ScheduleTable] Start and end times are the same for item ${item.id}. Returning 0.00`);
      return "0.00";
    }

    // Подготавливаем входные данные для расчета
    const input: IWorkTimeInput = {
      startTime: startDate,
      endTime: finishDate,
      lunchDurationMinutes: lunchMinutes
    };

    // Используем утилиту для расчета рабочего времени
    const result = calculateWorkTime(input);
    return result.formattedTime;
  }, []);

  // Обработчик изменения времени
  const handleTimeChange = (item: IScheduleItem, field: string, value: string): void => {
    // Создаем копию элемента с новым значением
    const updatedItem = { ...item, [field]: value };
    
    // Рассчитываем новое рабочее время
    const workTime = calculateItemWorkTime(updatedItem);
    
    // Обновляем локальное состояние для мгновенного отображения
    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));
    
    // Уведомляем родителя об изменении
    onItemChange(updatedItem, field, value);
    
    // Также отправляем обновленное рабочее время
    onItemChange(updatedItem, 'workingHours', workTime);
  };

  // Обработчик изменения контракта
  const handleContractNumberChange = (item: IScheduleItem, value: string): void => {
    onItemChange(item, 'contractNumber', value);
  };

  // Обработчик изменения времени обеда
  const handleLunchTimeChange = (item: IScheduleItem, value: string): void => {
    // Создаем копию элемента с новым значением
    const updatedItem = { ...item, lunchTime: value };
    
    // Рассчитываем новое рабочее время
    const workTime = calculateItemWorkTime(updatedItem);
    
    // Обновляем локальное состояние для мгновенного отображения
    setCalculatedWorkTimes(prev => ({
      ...prev,
      [item.id]: workTime
    }));
    
    // Уведомляем родителя об изменении
    onItemChange(updatedItem, 'lunchTime', value);
    
    // Также отправляем обновленное рабочее время
    onItemChange(updatedItem, 'workingHours', workTime);
  };

  // Обработчик выбора/отмены выбора всех строк
  const handleSelectAllRows = (checked: boolean): void => {
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
  const handleDeleteSelected = (): void => {
    selectedRows.forEach(id => {
      onDeleteItem(id);
    });
    
    // Сбрасываем выбор
    setSelectedRows(new Set());
    setSelectAllRows(false);
  };

  // Функция для получения отображаемого рабочего времени
  const getDisplayWorkTime = (item: IScheduleItem): string => {
    // Если есть рассчитанное значение, используем его
    if (calculatedWorkTimes[item.id]) {
      return calculatedWorkTimes[item.id];
    }
    // Иначе используем значение из элемента
    return item.workingHours;
  };

  // Функция для проверки, совпадают ли время начала и окончания
  const checkStartEndTimeSame = (item: IScheduleItem): boolean => {
    // Парсим часы и минуты из строк
    const startHour = parseInt(item.startHour, 10) || 0;
    const startMinute = parseInt(item.startMinute, 10) || 0;
    const finishHour = parseInt(item.finishHour, 10) || 0;
    const finishMinute = parseInt(item.finishMinute, 10) || 0;

    // Создаем даты для сравнения
    const startDate = createTimeFromComponents(item.date, startHour, startMinute);
    const finishDate = createTimeFromComponents(item.date, finishHour, finishMinute);

    // Проверяем, совпадают ли даты и не равны ли они обе 00:00
    return isStartEndTimeSame(startDate, finishDate) && 
           !(isZeroTime(startDate) && isZeroTime(finishDate));
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
            onChange={(_, checked): void => handleSelectAllRows(checked!)}
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
          onChange={(_, checked): void => onToggleShowDeleted(checked!)}
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
              <th style={{ textAlign: 'center', padding: '8px 0' }} /> {/* Для кнопки +Shift */}
              <th style={{ textAlign: 'left', padding: '8px 0' }}>Contract</th>
              <th style={{ textAlign: 'center', padding: '8px 0' }} /> {/* Для кнопки удаления */}
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
                let backgroundColor = isEvenRow ? '#f9f9f9' : '#ffffff';
                
                // Если время начала и окончания совпадают и не равны 00:00
                const isTimesEqual = checkStartEndTimeSame(item);
                if (isTimesEqual) {
                  backgroundColor = '#ffeded'; // Светло-красный фон для некорректных записей
                }
                
                // Отображаемое рабочее время
                const displayWorkTime = getDisplayWorkTime(item);
                
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
                      whiteSpace: 'nowrap',
                      color: isTimesEqual ? '#a4262c' : (displayWorkTime === '0.00' ? '#666' : 'inherit')
                    }}>
                      {isTimesEqual ? (
                        <TooltipHost content="Start and end times are the same. Please adjust the times.">
                          <Text style={{ color: '#a4262c', fontWeight: 'bold' }}>{displayWorkTime}</Text>
                        </TooltipHost>
                      ) : (
                        displayWorkTime
                      )}
                    </td>
                    
                    {/* Ячейка с началом работы */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Dropdown
                          selectedKey={item.startHour}
                          options={options.hours}
                          onChange={(_, option): void => handleTimeChange(item, 'startHour', option?.key as string)}
                          styles={{ 
                            root: { 
                              width: 60, 
                              margin: '0 4px',
                              borderColor: isTimesEqual ? '#a4262c' : undefined 
                            } 
                          }}
                        />
                        <Dropdown
                          selectedKey={item.startMinute}
                          options={options.minutes}
                          onChange={(_, option): void => handleTimeChange(item, 'startMinute', option?.key as string)}
                          styles={{ 
                            root: { 
                              width: 60, 
                              margin: '0 4px',
                              borderColor: isTimesEqual ? '#a4262c' : undefined 
                            } 
                          }}
                        />
                      </div>
                    </td>
                    
                    {/* Ячейка с окончанием работы */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <Dropdown
                          selectedKey={item.finishHour}
                          options={options.hours}
                          onChange={(_, option): void => handleTimeChange(item, 'finishHour', option?.key as string)}
                          styles={{ 
                            root: { 
                              width: 60, 
                              margin: '0 4px',
                              borderColor: isTimesEqual ? '#a4262c' : undefined 
                            } 
                          }}
                        />
                        <Dropdown
                          selectedKey={item.finishMinute}
                          options={options.minutes}
                          onChange={(_, option): void => handleTimeChange(item, 'finishMinute', option?.key as string)}
                          styles={{ 
                            root: { 
                              width: 60, 
                              margin: '0 4px',
                              borderColor: isTimesEqual ? '#a4262c' : undefined 
                            } 
                          }}
                        />
                      </div>
                    </td>
                    
                    {/* Ячейка с временем обеда */}
                    <td style={{ textAlign: 'center' }}>
                      <Dropdown
                        selectedKey={item.lunchTime}
                        options={options.lunchTimes}
                        onChange={(_, option): void => handleLunchTimeChange(item, option?.key as string)}
                        styles={{ root: { width: 80 } }}
                      />
                    </td>
                    
                    {/* Ячейка с типом отпуска */}
                    <td style={{ textAlign: 'center' }}>
                      <Dropdown
                        selectedKey={item.typeOfLeave}
                        options={options.leaveTypes}
                        onChange={(_, option): void => handleTimeChange(item, 'typeOfLeave', option?.key as string)}
                        styles={{ root: { width: 150 } }}
                      />
                    </td>
                    
                    {/* Кнопка +Shift */}
                    <td style={{ textAlign: 'center', padding: '0' }}>
                      <PrimaryButton
                        text="+Shift"
                        styles={{ root: { minWidth: 60, padding: '0 4px', backgroundColor: '#107c10' } }}
                        onClick={(): void => onAddShift(item.date)}
                      />
                    </td>
                    
                    {/* Ячейка с номером контракта */}
                    <td>
                      <Dropdown
                        selectedKey={item.contractNumber || '1'} // По умолчанию '1'
                        options={contractOptions}
                        onChange={(_, option): void => handleContractNumberChange(item, option?.key as string)}
                        styles={{ root: { width: 50 } }}
                      />
                    </td>
                    
                    {/* Иконка удаления */}
                    <td style={{ textAlign: 'center', padding: '0' }}>
                      <IconButton
                        iconProps={{ iconName: 'Delete' }}
                        title="Delete"
                        ariaLabel="Delete"
                        onClick={(): void => onDeleteItem(item.id)}
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