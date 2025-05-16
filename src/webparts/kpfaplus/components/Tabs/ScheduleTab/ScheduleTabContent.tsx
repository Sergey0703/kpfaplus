// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { 
 DatePicker,
 Dropdown,
 IDropdownOption,
 MessageBar,
 MessageBarType,
 Spinner,
 SpinnerSize,
 DetailsList,
 DetailsListLayoutMode,
 SelectionMode,
 IColumn,
 Text
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IContract } from '../../../models/IContract';
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { getLeaveTypeText, getLeaveTypeInfo } from './ScheduleTabApi';
import styles from './ScheduleTab.module.scss';

// Интерфейс для передачи необходимых свойств в UI компоненты
export interface IScheduleTabContentProps {
 selectedStaff: ITabProps['selectedStaff'];
 selectedDate: Date;
 contracts: IContract[];
 selectedContractId?: string;
 isLoading: boolean;
 error?: string;
 holidays: IHoliday[];
 isLoadingHolidays: boolean;
 leaves: ILeaveDay[];
 isLoadingLeaves: boolean;
 typesOfLeave: ITypeOfLeave[];
 isLoadingTypesOfLeave: boolean;
 holidaysService?: any;
 daysOfLeavesService?: any;
 typeOfLeaveService?: any;
 onDateChange: (date: Date | null | undefined) => void;
 onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
 onErrorDismiss: () => void;
}

/**
* Компонент выбора даты и контракта
*/
export const FilterControls: React.FC<{
 selectedDate: Date;
 contracts: IContract[];
 selectedContractId?: string;
 isLoading: boolean;
 onDateChange: (date: Date | null | undefined) => void;
 onContractChange: (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption) => void;
}> = ({ selectedDate, contracts, selectedContractId, isLoading, onDateChange, onContractChange }) => {
 // Преобразуем контракты в опции для выпадающего списка
 const contractOptions: IDropdownOption[] = contracts.map(contract => ({
   key: contract.id,
   text: contract.template
 }));
 
 return (
   <div style={{ 
     display: 'flex', 
     marginTop: '15px',
     marginBottom: '15px'
   }}>
     <div style={{ marginRight: '40px' }}>
       <div>Select date</div>
       <DatePicker
         value={selectedDate}
         onSelectDate={onDateChange}
         firstDayOfWeek={1}
         formatDate={(date?: Date): string => date ? date.toLocaleDateString() : ''}
         isRequired={false}
         styles={{
           root: { width: '150px' }
         }}
       />
     </div>
     
     <div>
       <div>Select contract</div>
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
   </div>
 );
};

/**
* Компонент списка отпусков
*/
export const LeavesList: React.FC<{
 leaves: ILeaveDay[];
 isLoading: boolean;
 typesOfLeave: ITypeOfLeave[];
}> = ({ leaves, isLoading, typesOfLeave }) => {
 // Определяем колонки для таблицы отпусков
 const leavesColumns: IColumn[] = [
   {
     key: 'title',
     name: 'Название',
     fieldName: 'title',
     minWidth: 150,
     isResizable: true
   },
   {
     key: 'startDate',
     name: 'Дата начала',
     fieldName: 'startDate',
     minWidth: 100,
     isResizable: true,
     onRender: (item: ILeaveDay) => (
       <span>{item.startDate.toLocaleDateString()}</span>
     )
   },
   {
     key: 'endDate',
     name: 'Дата окончания',
     fieldName: 'endDate',
     minWidth: 100,
     isResizable: true,
     onRender: (item: ILeaveDay) => {
       // Проверяем наличие даты окончания
       if (item.endDate) {
         return <span>{item.endDate.toLocaleDateString()}</span>;
       } else {
         // Если дата окончания не задана, отображаем "Открыт"
         return <span style={{ color: '#d13438', fontStyle: 'italic' }}>Открыт</span>;
       }
     }
   },
   {
     key: 'duration',
     name: 'Длительность',
     minWidth: 100,
     isResizable: true,
     onRender: (item: ILeaveDay) => {
       // Если нет даты окончания, просто показываем текущую длительность с начала отпуска
       if (!item.endDate) {
         const start = new Date(item.startDate);
         const today = new Date();
         const diffTime = Math.abs(today.getTime() - start.getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
         return <span style={{ color: '#d13438' }}>{diffDays}+ дн.</span>;
       }
       
       // Стандартный расчет для законченных отпусков
       const start = new Date(item.startDate);
       const end = new Date(item.endDate);
       const diffTime = Math.abs(end.getTime() - start.getTime());
       const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
       return <span>{diffDays} дн.</span>;
     }
   },
   {
     key: 'typeOfLeave',
     name: 'Тип отпуска',
     fieldName: 'typeOfLeave',
     minWidth: 120,
     isResizable: true,
     onRender: (item: ILeaveDay) => {
       // Используем функцию getLeaveTypeInfo для получения информации о типе отпуска
       const typeInfo = getLeaveTypeInfo(item.typeOfLeave, typesOfLeave);
       
       // Отображаем название типа отпуска с учетом цвета, если он задан
       return (
         <span style={typeInfo.color ? { color: typeInfo.color } : undefined}>
           {typeInfo.title}
         </span>
       );
     }
   },
   {
     key: 'status',
     name: 'Статус',
     minWidth: 100,
     isResizable: true,
     onRender: (item: ILeaveDay) => {
       // Определяем статус отпуска
       const today = new Date();
       today.setHours(0, 0, 0, 0); // Сбрасываем время
       
       const startDate = new Date(item.startDate);
       startDate.setHours(0, 0, 0, 0);
       
       // Если нет даты окончания, считаем отпуск активным если он уже начался
       if (!item.endDate) {
         if (startDate <= today) {
           return <span style={{ color: '#107c10', fontWeight: 600 }}>Активный</span>;
         } else {
           return <span style={{ color: '#0078d4' }}>Будущий</span>;
         }
       }
       
       // Для отпусков с определенной датой окончания
       const endDate = new Date(item.endDate);
       endDate.setHours(0, 0, 0, 0);
       
       if (today < startDate) {
         return <span style={{ color: '#0078d4' }}>Будущий</span>;
       } else if (today > endDate) {
         return <span style={{ color: '#666' }}>Завершен</span>;
       } else {
         return <span style={{ color: '#107c10', fontWeight: 600 }}>Активный</span>;
       }
     }
   }
 ];
 
 // Сортируем отпуска по дате начала
 const sortedLeaves = [...leaves].sort((a, b) => 
   new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
 );
 
 return (
   <div style={{ marginTop: '20px' }}>
     <Text variant="large" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
       Список отпусков в текущем месяце
     </Text>
     <DetailsList
       items={sortedLeaves}
       columns={leavesColumns}
       layoutMode={DetailsListLayoutMode.justified}
       selectionMode={SelectionMode.none}
       isHeaderVisible={true}
       styles={{
         root: {
           '.ms-DetailsRow': {
             borderBottom: '1px solid #f3f2f1'
           },
           '.ms-DetailsRow:hover': {
             backgroundColor: '#f5f5f5'
           },
           // Выделяем каждую вторую строку
           '.ms-DetailsRow:nth-child(even)': {
             backgroundColor: '#fafafa'
           }
         }
       }}
     />
   </div>
 );
};

/**
* Компонент информации о выбранной дате
*/
export const DayInfo: React.FC<{
 selectedDate: Date;
 holidays: IHoliday[];
 leaves: ILeaveDay[];
 typesOfLeave: ITypeOfLeave[];
 holidaysService?: any;
 daysOfLeavesService?: any;
}> = ({ selectedDate, holidays, leaves, typesOfLeave, holidaysService, daysOfLeavesService }) => {
 // Проверяем является ли выбранная дата праздником
 const isHoliday = holidaysService && holidays.length > 0 && 
   holidaysService.isHoliday(selectedDate, holidays);
 
 // Получаем информацию о празднике, если есть
 const holidayInfo = isHoliday && holidaysService ? 
   holidaysService.getHolidayInfo(selectedDate, holidays) : undefined;
 
 // Проверяем является ли выбранная дата отпуском
 const isOnLeave = daysOfLeavesService && leaves.length > 0 && 
   daysOfLeavesService.isDateOnLeave(selectedDate, leaves);
 
 // Получаем информацию об отпуске, если есть
 const leaveInfo = isOnLeave && daysOfLeavesService ? 
   daysOfLeavesService.getLeaveForDate(selectedDate, leaves) : undefined;
 
 // Получаем информацию о типе отпуска, если есть отпуск
 const leaveTypeInfo = leaveInfo ? 
   getLeaveTypeInfo(leaveInfo.typeOfLeave, typesOfLeave) : undefined;
 
 return (
   <div style={{ marginBottom: '15px' }}>
     {isHoliday && holidayInfo && (
       <div style={{ 
         backgroundColor: '#FFF4CE',
         padding: '10px',
         marginBottom: '10px',
         borderRadius: '4px',
         borderLeft: '4px solid #FFB900'
       }}>
         <strong>Holiday: </strong>
         {holidayInfo.title}
       </div>
     )}
     
     {isOnLeave && leaveInfo && (
       <div style={{ 
         backgroundColor: '#E8F5FF',
         padding: '10px',
         marginBottom: '10px',
         borderRadius: '4px',
         borderLeft: leaveTypeInfo?.color ? `4px solid ${leaveTypeInfo.color}` : '4px solid #0078D4'
       }}>
         <strong>Leave: </strong>
         {leaveInfo.title}
         {/* Отображаем дополнительную информацию для отпуска */}
         <div style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>
           <div>
             <strong>Тип: </strong>
             <span style={leaveTypeInfo?.color ? { color: leaveTypeInfo.color } : undefined}>
               {leaveTypeInfo?.title || getLeaveTypeText(leaveInfo.typeOfLeave)}
             </span>
           </div>
           <div>
             <strong>Период: </strong>
             {leaveInfo.startDate.toLocaleDateString()} - 
             {leaveInfo.endDate ? leaveInfo.endDate.toLocaleDateString() : <span style={{ color: '#d13438', fontStyle: 'italic' }}>открыт</span>}
           </div>
         </div>
       </div>
     )}
   </div>
 );
};

/**
* Информационный блок с данными о месяце
*/
export const MonthSummary: React.FC<{
 selectedDate: Date;
 holidays: IHoliday[];
 leaves: ILeaveDay[];
 typesOfLeave: ITypeOfLeave[];
}> = ({ selectedDate, holidays, leaves, typesOfLeave }) => {
 // Группировка отпусков по типам для отображения статистики
 const leavesByType = leaves.reduce((acc, leave) => {
   const typeId = leave.typeOfLeave.toString();
   if (!acc[typeId]) {
     acc[typeId] = [];
   }
   acc[typeId].push(leave);
   return acc;
 }, {} as { [key: string]: ILeaveDay[] });
 
 return (
   <div style={{ padding: '10px' }}>
     <div>
       <p>Selected date: {selectedDate.toLocaleDateString()}</p>
       <p>Month: {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}</p>
       
       <div style={{ marginTop: '10px' }}>
         <div>
           <strong>Holidays: </strong>
           {holidays.length > 0 ? holidays.length : 'No'} holidays loaded for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
         </div>
         
         <div>
           <strong>Leaves: </strong>
           {leaves.length > 0 ? leaves.length : 'No'} leaves found for month {selectedDate.getMonth() + 1}/{selectedDate.getFullYear()}
           {leaves.length > 0 && leaves.some(l => !l.endDate) && 
             ` (Открытых: ${leaves.filter(l => !l.endDate).length})`}
         </div>
         
         {/* Отображаем статистику по типам отпусков, если они есть */}
         {Object.keys(leavesByType).length > 0 && (
           <div style={{ marginTop: '5px' }}>
             <strong>Типы отпусков:</strong>
             <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
               {Object.keys(leavesByType).map(typeId => {
                 const typeInfo = getLeaveTypeInfo(parseInt(typeId), typesOfLeave);
                 const count = leavesByType[typeId].length;
                 return (
                   <li key={typeId} style={{ marginBottom: '2px' }}>
                     <span style={typeInfo.color ? { color: typeInfo.color } : undefined}>
                       {typeInfo.title}: {count} {count === 1 ? 'отпуск' : count < 5 ? 'отпуска' : 'отпусков'}
                     </span>
                   </li>
                 );
               })}
             </ul>
           </div>
         )}
       </div>
     </div>
   </div>
 );
};

/**
* Блок со списком типов отпусков
*/
export const TypesOfLeaveInfo: React.FC<{
 typesOfLeave: ITypeOfLeave[];
 isLoadingTypesOfLeave: boolean;
}> = ({ typesOfLeave, isLoadingTypesOfLeave }) => {
 if (isLoadingTypesOfLeave) {
   return (
     <div style={{ textAlign: 'center', padding: '10px' }}>
       <Spinner size={SpinnerSize.small} label="Loading types of leave..." />
     </div>
   );
 }
 
 if (typesOfLeave.length === 0) {
   return null;
 }
 
 return (
   <div style={{ 
     border: '1px solid #e0e0e0',
     padding: '10px',
     marginTop: '20px',
     borderRadius: '4px',
     backgroundColor: '#f9f9f9'
   }}>
     <Text variant="medium" style={{ fontWeight: 600, marginBottom: '10px', display: 'block' }}>
       Справочник типов отпусков
     </Text>
     <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
       {typesOfLeave.map(type => (
         <div 
           key={type.id}
           style={{ 
             padding: '5px 10px',
             borderRadius: '3px',
             backgroundColor: type.color || '#f0f0f0',
             color: isColorDark(type.color) ? 'white' : 'black',
             fontSize: '13px'
           }}
         >
           {type.title}
         </div>
       ))}
     </div>
   </div>
 );
};

/**
* Вспомогательная функция для определения, является ли цвет темным
* (для выбора контрастного цвета текста)
*/
const isColorDark = (colorHex?: string): boolean => {
 if (!colorHex) return false;
 
 // Конвертируем HEX в RGB
 const r = parseInt(colorHex.slice(1, 3), 16);
 const g = parseInt(colorHex.slice(3, 5), 16);
 const b = parseInt(colorHex.slice(5, 7), 16);
 
 // Вычисляем яркость (чем больше значение, тем светлее цвет)
 const brightness = (r * 299 + g * 587 + b * 114) / 1000;
 
 // Если яркость ниже 128, считаем цвет темным
 return brightness < 128;
};

/**
* Основной компонент содержимого вкладки Schedule
*/
export const ScheduleTabContent: React.FC<IScheduleTabContentProps> = (props) => {
 const {
   selectedStaff,
   selectedDate,
   contracts,
   selectedContractId,
   isLoading,
   error,
   holidays,
   isLoadingHolidays,
   leaves,
   isLoadingLeaves,
   typesOfLeave,
   isLoadingTypesOfLeave,
   holidaysService,
   daysOfLeavesService,
   onDateChange,
   onContractChange,
   onErrorDismiss
 } = props;
 
 // Находим выбранный контракт
 const selectedContract = contracts.find(c => c.id === selectedContractId);
 
 return (
   <div className={styles.scheduleTab}>
     <div className={styles.header}>
       <h2>Schedule for {selectedStaff?.name}</h2>
     </div>
     
     {/* Отображаем сообщение об ошибке, если есть */}
     {error && (
       <MessageBar
         messageBarType={MessageBarType.error}
         isMultiline={false}
         onDismiss={onErrorDismiss}
         dismissButtonAriaLabel="Close"
       >
         {error}
       </MessageBar>
     )}
     
     {/* Фильтры выбора даты и контракта */}
     <FilterControls
       selectedDate={selectedDate}
       contracts={contracts}
       selectedContractId={selectedContractId}
       isLoading={isLoading}
       onDateChange={onDateChange}
       onContractChange={onContractChange}
     />
     
     {/* Показываем спиннер при загрузке */}
     {isLoading ? (
       <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
         <Spinner size={SpinnerSize.large} label="Loading schedule data..." />
       </div>
     ) : (
       <>
         {selectedContract ? (
           <div style={{ 
             border: '1px solid #e0e0e0', 
             padding: '15px', 
             borderRadius: '4px',
             minHeight: '300px',
             backgroundColor: 'white'
           }}>
             {/* Проверяем статусы - является ли выбранная дата праздником или отпуском */}
             <DayInfo
               selectedDate={selectedDate}
               holidays={holidays}
               leaves={leaves}
               typesOfLeave={typesOfLeave}
               holidaysService={holidaysService}
               daysOfLeavesService={daysOfLeavesService}
             />
             
             {/* Показываем индикаторы загрузки, если они загружаются */}
             {(isLoadingHolidays || isLoadingLeaves || isLoadingTypesOfLeave) ? (
               <div style={{ padding: '10px', textAlign: 'center' }}>
                 {isLoadingHolidays && <Spinner size={SpinnerSize.small} label="Loading holidays data..." style={{ marginBottom: '10px' }} />}
                 {isLoadingLeaves && <Spinner size={SpinnerSize.small} label="Loading leaves data..." style={{ marginBottom: '10px' }} />}
                 {isLoadingTypesOfLeave && <Spinner size={SpinnerSize.small} label="Loading types of leave..." />}
               </div>
             ) : (
               <div style={{ padding: '10px' }}>
                 {/* Информация о месяце */}
                 <MonthSummary
                   selectedDate={selectedDate}
                   holidays={holidays}
                   leaves={leaves}
                   typesOfLeave={typesOfLeave}
                 />
                 
                 {/* Справочник типов отпусков */}
                 <TypesOfLeaveInfo
                   typesOfLeave={typesOfLeave}
                   isLoadingTypesOfLeave={isLoadingTypesOfLeave}
                 />
                 
                 {/* Список отпусков */}
                 {leaves.length > 0 && (
                   <LeavesList
                     leaves={leaves}
                     isLoading={isLoadingLeaves}
                     typesOfLeave={typesOfLeave}
                   />
                 )}
               </div>
             )}
           </div>
         ) : (
           <div style={{ 
             display: 'flex', 
             justifyContent: 'center', 
             alignItems: 'center', 
             minHeight: '200px', 
             backgroundColor: '#f9f9f9',
             borderRadius: '4px',
             padding: '20px'
           }}>
             {contracts.length > 0 ? (
               <p>Please select a contract to view the schedule</p>
             ) : (
               <p>No active contracts available for this staff member</p>
             )}
           </div>
         )}
       </>
     )}
   </div>
 );
};