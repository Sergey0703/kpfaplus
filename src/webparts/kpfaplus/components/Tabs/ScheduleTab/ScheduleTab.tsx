// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTab.tsx
import * as React from 'react';
import { useState, useEffect } from 'react';
import { IDropdownOption } from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { HolidaysService } from '../../../services/HolidaysService';
import { DaysOfLeavesService } from '../../../services/DaysOfLeavesService';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { 
 fetchHolidaysForMonthAndYear, 
 fetchLeavesForMonthAndYear, 
 fetchContracts,
 fetchTypesOfLeave,
 shouldRefreshDataOnDateChange
} from './ScheduleTabApi';
import { ScheduleTabContent } from './ScheduleTabContent';

// Интерфейс для состояния компонента ScheduleTab
export interface IScheduleTabState {
 selectedDate: Date;
 contracts: any[]; // Используем any для совместимости со старым кодом
 selectedContractId?: string;
 isLoading: boolean;
 error?: string;
 holidays: any[];
 isLoadingHolidays: boolean;
 leaves: any[];
 isLoadingLeaves: boolean;
 typesOfLeave: ITypeOfLeave[];
 isLoadingTypesOfLeave: boolean;
}

export const ScheduleTab: React.FC<ITabProps> = (props) => {
 const { selectedStaff, context } = props;
 
 // Инициализируем состояние компонента
 const [state, setState] = useState<IScheduleTabState>({
   selectedDate: new Date(),
   contracts: [],
   selectedContractId: undefined,
   isLoading: false,
   holidays: [],
   isLoadingHolidays: false,
   leaves: [],
   isLoadingLeaves: false,
   typesOfLeave: [],
   isLoadingTypesOfLeave: false
 });
 
 // Получаем сервисы
 const holidaysService = context ? HolidaysService.getInstance(context) : undefined;
 const daysOfLeavesService = context ? DaysOfLeavesService.getInstance(context) : undefined;
 const typeOfLeaveService = context ? TypeOfLeaveService.getInstance(context) : undefined;
 
 // Функции для обновления состояния - используем именованный объект для удобства чтения
 const updateState = {
   selectedDate: (selectedDate: Date) => {
     setState(prevState => ({ ...prevState, selectedDate }));
   },
   selectedContractId: (selectedContractId?: string) => {
     setState(prevState => ({ ...prevState, selectedContractId }));
   },
   contracts: (contracts: any[]) => {
     setState(prevState => ({ ...prevState, contracts }));
   },
   isLoading: (isLoading: boolean) => {
     setState(prevState => ({ ...prevState, isLoading }));
   },
   error: (error?: string) => {
     setState(prevState => ({ ...prevState, error }));
   },
   holidays: (holidays: any[]) => {
     setState(prevState => ({ ...prevState, holidays }));
   },
   isLoadingHolidays: (isLoadingHolidays: boolean) => {
     setState(prevState => ({ ...prevState, isLoadingHolidays }));
   },
   leaves: (leaves: any[]) => {
     setState(prevState => ({ ...prevState, leaves }));
   },
   isLoadingLeaves: (isLoadingLeaves: boolean) => {
     setState(prevState => ({ ...prevState, isLoadingLeaves }));
   },
   typesOfLeave: (typesOfLeave: ITypeOfLeave[]) => {
     setState(prevState => ({ ...prevState, typesOfLeave }));
   },
   isLoadingTypesOfLeave: (isLoadingTypesOfLeave: boolean) => {
     setState(prevState => ({ ...prevState, isLoadingTypesOfLeave }));
   }
 };
 
 // Загружаем данные о праздниках и отпусках при изменении даты
 const handleDateChange = (date: Date | null | undefined): void => {
   if (!date) return;
   
   const currentDate = state.selectedDate;
   
   // Устанавливаем новую выбранную дату
   updateState.selectedDate(date);
   
   // Если изменился месяц или год, загружаем новые данные
   if (shouldRefreshDataOnDateChange(currentDate, date)) {
     // Загружаем праздники и отпуска для нового месяца
     loadDataForDate(date);
   }
 };
 
 // Загружаем данные для указанной даты
 const loadDataForDate = (date: Date): void => {
   if (!context) return;
   
   // Загружаем праздники
   fetchHolidaysForMonthAndYear(
     context,
     date,
     updateState.isLoadingHolidays,
     updateState.holidays,
     updateState.error
   );
   
   // Загружаем отпуска, если есть выбранный сотрудник
   if (selectedStaff?.employeeId) {
     fetchLeavesForMonthAndYear(
       context,
       date,
       parseInt(selectedStaff.employeeId),
       props.currentUserId ? parseInt(props.currentUserId) : undefined,
       props.managingGroupId ? parseInt(props.managingGroupId) : undefined,
       updateState.isLoadingLeaves,
       updateState.leaves,
       updateState.error
     );
   }
 };
 
 // Загружаем типы отпусков
 const loadTypesOfLeave = (): void => {
   if (!context || !typeOfLeaveService) return;
   
   fetchTypesOfLeave(
     context,
     typeOfLeaveService,
     updateState.isLoadingTypesOfLeave,
     updateState.typesOfLeave,
     updateState.error
   );
 };
 
 // Загружаем контракты сотрудника
 const loadContracts = (): void => {
   if (!context || !selectedStaff?.employeeId) return;
   
   fetchContracts(
     context,
     selectedStaff.employeeId,
     props.currentUserId,
     props.managingGroupId,
     updateState.isLoading,
     updateState.contracts,
     updateState.selectedContractId,
     updateState.error
   );
 };
 
 // Обработчик изменения контракта
 const handleContractChange = (event: React.FormEvent<HTMLDivElement>, option?: IDropdownOption): void => {
   if (option) {
     updateState.selectedContractId(option.key.toString());
   }
 };
 
 // Обработчик закрытия сообщения об ошибке
 const handleErrorDismiss = (): void => {
   updateState.error(undefined);
 };
 
 // Загружаем контракты при монтировании компонента или изменении сотрудника
 useEffect(() => {
   if (selectedStaff?.id && context) {
     loadContracts();
   } else {
     updateState.contracts([]);
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [selectedStaff, context]);
 
 // Загружаем праздники и отпуска при монтировании компонента
 useEffect(() => {
   if (context) {
     loadDataForDate(state.selectedDate);
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [context, selectedStaff]);
 
 // Загружаем типы отпусков при монтировании компонента
 useEffect(() => {
   if (context && typeOfLeaveService) {
     loadTypesOfLeave();
   }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [context, typeOfLeaveService]);
 
 // Рендеринг компонента с использованием ScheduleTabContent
 return (
   <ScheduleTabContent
     selectedStaff={selectedStaff}
     selectedDate={state.selectedDate}
     contracts={state.contracts}
     selectedContractId={state.selectedContractId}
     isLoading={state.isLoading}
     error={state.error}
     holidays={state.holidays}
     isLoadingHolidays={state.isLoadingHolidays}
     leaves={state.leaves}
     isLoadingLeaves={state.isLoadingLeaves}
     typesOfLeave={state.typesOfLeave}
     isLoadingTypesOfLeave={state.isLoadingTypesOfLeave}
     holidaysService={holidaysService}
     daysOfLeavesService={daysOfLeavesService}
     typeOfLeaveService={typeOfLeaveService}
     onDateChange={handleDateChange}
     onContractChange={handleContractChange}
     onErrorDismiss={handleErrorDismiss}
   />
 );
};