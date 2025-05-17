// src/webparts/kpfaplus/components/Tabs/ScheduleTab/components/FilterControls.tsx
import * as React from 'react';
import { 
  Dropdown, 
  IDropdownOption, 
  PrimaryButton
} from '@fluentui/react';
import { IContract } from '../../../../models/IContract';

export interface IFilterControlsProps {
  selectedDate: Date;
  contracts: IContract[];
  selectedContractId?: string;
  isLoading: boolean;
  onDateChange: (date: Date | undefined) => void;
  onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
  onFillButtonClick?: () => void;
}

export const FilterControls: React.FC<IFilterControlsProps> = ({ 
  selectedDate, 
  contracts, 
  selectedContractId, 
  isLoading, 
  onDateChange, 
  onContractChange,
  onFillButtonClick 
}) => {
  // Преобразуем контракты в опции для выпадающего списка
  const contractOptions: IDropdownOption[] = contracts.map(contract => ({
    key: contract.id,
    text: contract.template
  }));

  // Состояние для локальной даты (используется для отображения в input)
  const [localDate, setLocalDate] = React.useState<string>('');
  // Состояние для отслеживания фокуса на input
  const [isFocused, setIsFocused] = React.useState<boolean>(false);
  // Референс на input
  const dateInputRef = React.useRef<HTMLInputElement>(null);
  // Состояние для отслеживания предыдущего значения даты
  const prevDateRef = React.useRef<string>('');

  // Инициализируем компонент с первым числом текущего месяца
  React.useEffect(() => {
    // Проверяем, инициализирована ли дата по умолчанию
    if (!selectedDate || selectedDate.getDate() !== 1) {
      // Создаем дату с первым числом текущего месяца
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      console.log('Setting default date to first day of current month:', firstDayOfMonth);
      
      // Вызываем onDateChange для обновления даты в родительском компоненте
      onDateChange(firstDayOfMonth);
    }
  }, []); // Пустой массив зависимостей для выполнения только при монтировании

  // Форматируем дату для значения HTML input типа date
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Устанавливаем локальную дату при монтировании и изменении selectedDate
  React.useEffect(() => {
    const formattedDate = formatDateForInput(selectedDate);
    setLocalDate(formattedDate);
    prevDateRef.current = formattedDate; // Сохраняем текущую дату как предыдущую
  }, [selectedDate]);

  // Обработчик локального изменения даты 
  const handleLocalDateChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const newValue = event.target.value;
    console.log('Local date change:', newValue);
    
    // Обновляем локальное состояние
    setLocalDate(newValue);
    
    // Если это изменение связано с выбором даты (а не изменением месяца/года),
    // определяем это по формату - полная дата должна содержать день, месяц и год
    if (newValue && newValue !== prevDateRef.current && newValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      console.log('Date selected, immediately updating:', newValue);
      try {
        const newDate = new Date(newValue);
        // Немедленно отправляем изменение, не дожидаясь blur
        onDateChange(newDate);
        prevDateRef.current = newValue;
      } catch (error) {
        console.error('Error parsing date:', error);
      }
    }
  };

  // Обработчик события потери фокуса - на всякий случай оставляем для страховки
  const handleBlur = (): void => {
    console.log('Date input blur');
    setIsFocused(false);
    
    // Если локальная дата изменилась и мы ещё не отправили обновление
    if (localDate !== prevDateRef.current) {
      console.log('Date changed on blur from', prevDateRef.current, 'to', localDate);
      try {
        const newDate = localDate ? new Date(localDate) : undefined;
        console.log('New date object on blur:', newDate);
        onDateChange(newDate);
        prevDateRef.current = localDate;
      } catch (error) {
        console.error('Error parsing date on blur:', error);
        // В случае ошибки возвращаем локальную дату к исходной
        setLocalDate(prevDateRef.current);
      }
    }
  };

  // Обработчик фокуса
  const handleFocus = (): void => {
    console.log('Date input focus');
    setIsFocused(true);
  };
  
  // Обработчик клика
  const handleClick = (): void => {
    console.log('Date input click');
  };

  // Обработчик клавиши Enter
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      console.log('Enter key pressed');
      dateInputRef.current?.blur(); // Вызываем blur для сохранения даты
    }
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      marginTop: '15px',
      marginBottom: '15px',
      alignItems: 'flex-end' // Выравниваем все элементы по нижнему краю
    }}>
      <div style={{ marginRight: '40px' }}>
        <div style={{ marginBottom: '5px' }}>Select date</div>
        {/* HTML input с обработкой локальных изменений */}
        <input
          ref={dateInputRef}
          type="date"
          value={localDate}
          onChange={handleLocalDateChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          style={{
            width: '150px',
            height: '32px',
            padding: '0 8px',
            border: '1px solid #8a8886',
            borderRadius: '2px',
            boxSizing: 'border-box',
            outline: isFocused ? '2px solid #0078d4' : 'none',
            outlineOffset: '1px'
          }}
        />
      </div>
      
      <div style={{ marginRight: '40px' }}>
        <div style={{ marginBottom: '5px' }}>Select contract</div>
        <Dropdown
          placeholder="Select a contract"
          options={contractOptions}
          selectedKey={selectedContractId}
          onChange={onContractChange}
          disabled={isLoading || contractOptions.length === 0}
          styles={{
            root: { width: '250px' }
          }}
        />
      </div>

      {/* Кнопка Fill */}
      <div>
        <PrimaryButton
          text="Fill"
          onClick={onFillButtonClick}
          disabled={isLoading}
          styles={{
            root: { 
              backgroundColor: '#0078d4',
              minWidth: '80px',
              height: '32px'
            }
          }}
        />
      </div>
    </div>
  );
};