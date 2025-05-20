// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillOperations.ts

import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';  // Добавляем импорт WebPartContext
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IDayHours, WeeklyTimeTableUtils } from '../../../../models/IWeeklyTimeTable';
import { WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';

/**
 * Интерфейс для параметров операции заполнения расписания
 */
export interface IFillOperationParams {
  selectedDate: Date;
  // Этот параметр используется только для логов, и мы можем его удалить, если он не нужен
  selectedStaffId?: string;
  employeeId: string;
  selectedContract: IContract | undefined;
  selectedContractId: string | undefined;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;
  context?: WebPartContext; // Добавим context как параметр
}

/**
 * Интерфейс для обработчиков и функций, необходимых для операции заполнения
 */
export interface IFillOperationHandlers {
  createStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
  setOperationMessage: (message: { text: string; type: MessageBarType } | undefined) => void;
  setIsSaving: (isSaving: boolean) => void;
  onRefreshData?: () => void;
}

/**
 * Основная функция для заполнения расписания на основе шаблонов
 * @param params Параметры операции заполнения
 * @param handlers Обработчики и функции для операции
 */
export const fillScheduleFromTemplate = async (
  params: IFillOperationParams,
  handlers: IFillOperationHandlers
): Promise<void> => {
  const { 
    selectedDate, employeeId, 
    selectedContract, selectedContractId, 
    holidays, leaves, currentUserId, managingGroupId, dayOfStartWeek = 7,
    context // Получаем context из параметров
  } = params;
  
  const { createStaffRecord, setOperationMessage, setIsSaving, onRefreshData } = handlers;

  // Предварительная проверка данных
  if (!selectedContract || !selectedContractId) {
    setOperationMessage({
      text: 'Cannot fill schedule: No contract selected',
      type: MessageBarType.error
    });
    return;
  }

  if (!employeeId) {
    setOperationMessage({
      text: 'Cannot fill schedule: Invalid employee ID',
      type: MessageBarType.error
    });
    return;
  }

  if (!context) {
    setOperationMessage({
      text: 'Cannot fill schedule: WebPart context is not available',
      type: MessageBarType.error
    });
    return;
  }

  // Устанавливаем состояние загрузки
  setIsSaving(true);

  try {
    // Определение начала и конца месяца для выбранной даты
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    console.log(`[ScheduleTabFillOperations] Month period: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
    
    // Корректировка дат с учетом дат контракта
    const contractStartDate = selectedContract.startDate;
    const contractFinishDate = selectedContract.finishDate;
    
    // Определяем фактические даты начала и конца периода генерации
    const firstDay = contractStartDate && contractStartDate > startOfMonth 
      ? new Date(contractStartDate) 
      : new Date(startOfMonth);
    
    const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
      ? new Date(contractFinishDate) 
      : new Date(endOfMonth);
    
    console.log(`[ScheduleTabFillOperations] Adjusted period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
    
    // Подготовка коллекции для сгенерированных записей
    const generatedRecords: Partial<IStaffRecord>[] = [];
    
    // Получаем шаблоны недельного расписания из WeeklyTimeTables
    try {
      // Используем context из параметров
      const weeklyTimeService = new WeeklyTimeTableService(context);
      
      // Запрашиваем шаблоны из сервиса
      const weeklyTimeItems = await weeklyTimeService.getWeeklyTimeTableByContractId(selectedContractId);
      
      if (!weeklyTimeItems || weeklyTimeItems.length === 0) {
        setOperationMessage({
          text: 'No weekly templates found for the selected contract',
          type: MessageBarType.warning
        });
        setIsSaving(false);
        return;
      }
      
      console.log(`[ScheduleTabFillOperations] Retrieved ${weeklyTimeItems.length} weekly time templates`);
      
      // Преобразуем сырые данные в формат для использования
      const formattedTemplates = WeeklyTimeTableUtils.formatWeeklyTimeTableData(weeklyTimeItems, dayOfStartWeek);
      
      if (!formattedTemplates || formattedTemplates.length === 0) {
        setOperationMessage({
          text: 'Error formatting weekly templates',
          type: MessageBarType.error
        });
        setIsSaving(false);
        return;
      }
      
      console.log(`[ScheduleTabFillOperations] Formatted ${formattedTemplates.length} templates`);
      
      // Отфильтровываем удаленные шаблоны
      const activeTemplates = formattedTemplates.filter(template => 
        template.deleted !== 1 && template.Deleted !== 1
      );
      
      console.log(`[ScheduleTabFillOperations] Active templates: ${activeTemplates.length}`);
      
      if (activeTemplates.length === 0) {
        setOperationMessage({
          text: 'No active weekly templates found for the selected contract',
          type: MessageBarType.warning
        });
        setIsSaving(false);
        return;
      }
      
      // Определяем количество уникальных недельных шаблонов
      const distinctWeeks = new Set(activeTemplates.map(template => template.NumberOfWeek || 1));
      const numberOfWeekTemplates = distinctWeeks.size || 1;
      
      console.log(`[ScheduleTabFillOperations] Number of week templates: ${numberOfWeekTemplates}`);
      
      // Цикл по всем дням в выбранном периоде
      const dayCount = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`[ScheduleTabFillOperations] Processing ${dayCount} days`);
      
      for (let i = 0; i < dayCount; i++) {
        // Текущий день
        const currentDate = new Date(firstDay);
        currentDate.setDate(firstDay.getDate() + i);
        
        // Определение дня недели (0-6, где 0 - воскресенье)
        const dayIndex = currentDate.getDay();
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
        
        // Расчет номера недели для определения шаблона
        const dayOfMonth = currentDate.getDate();
        const calculatedWeekNumber = Math.floor((dayOfMonth - 1) / 7) + 1;
        
        // Определение применяемого номера недели в зависимости от количества шаблонов
        let appliedWeekNumber: number;
        
        switch (numberOfWeekTemplates) {
          case 1:
            appliedWeekNumber = 1;
            break;
          case 2:
            appliedWeekNumber = ((calculatedWeekNumber - 1) % 2) + 1;
            break;
          case 3:
            appliedWeekNumber = calculatedWeekNumber <= 3 ? calculatedWeekNumber : 1;
            break;
          case 4:
            appliedWeekNumber = calculatedWeekNumber <= 4 ? calculatedWeekNumber : calculatedWeekNumber % 4 || 4;
            break;
          default:
            appliedWeekNumber = 1;
        }
        
        console.log(`[ScheduleTabFillOperations] Day ${i+1}: ${currentDate.toISOString()}, Week ${calculatedWeekNumber}, Applied week ${appliedWeekNumber}`);
        
        // Фильтрация шаблонов для текущего дня и применяемой недели
        const dayTemplates = activeTemplates.filter(template => 
          (template.NumberOfWeek === appliedWeekNumber || template.numberOfWeek === appliedWeekNumber)
        );
        
        // Проверка, является ли день праздником
        const isHoliday = holidays.some(holiday => {
          const holidayDate = new Date(holiday.date);
          return holidayDate.getDate() === currentDate.getDate() && 
                 holidayDate.getMonth() === currentDate.getMonth() && 
                 holidayDate.getFullYear() === currentDate.getFullYear();
        });
        
        // Проверка, находится ли сотрудник в отпуске в этот день
        const leaveForDay = leaves.find(leave => {
          const leaveStartDate = new Date(leave.startDate);
          const leaveEndDate = leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31); // Далекая дата для открытых отпусков
          
          return currentDate >= leaveStartDate && currentDate <= leaveEndDate;
        });
        
        // Для каждого шаблона на этот день создаем запись
        for (const template of dayTemplates) {
          // Получение времени начала и окончания работы для текущего дня недели
          let startTime: IDayHours | undefined;
          let endTime: IDayHours | undefined;
          
          // Определение времени начала и окончания в зависимости от дня недели
          switch (dayOfWeek) {
            case 'Monday':
              startTime = template.monday?.start;
              endTime = template.monday?.end;
              break;
            case 'Tuesday':
              startTime = template.tuesday?.start;
              endTime = template.tuesday?.end;
              break;
            case 'Wednesday':
              startTime = template.wednesday?.start;
              endTime = template.wednesday?.end;
              break;
            case 'Thursday':
              startTime = template.thursday?.start;
              endTime = template.thursday?.end;
              break;
            case 'Friday':
              startTime = template.friday?.start;
              endTime = template.friday?.end;
              break;
            case 'Saturday':
              startTime = template.saturday?.start;
              endTime = template.saturday?.end;
              break;
            case 'Sunday':
              startTime = template.sunday?.start;
              endTime = template.sunday?.end;
              break;
          }
          
          // Если для текущего дня недели нет расписания, пропускаем
          if (!startTime || !endTime) {
            continue;
          }
          
          // Преобразование времени в объекты Date
          const shiftDate1 = createDateWithTime(currentDate, startTime);
          const shiftDate2 = createDateWithTime(currentDate, endTime);
          
          // Создание объекта записи
          const recordData: Partial<IStaffRecord> = {
            Title: `Template=${selectedContractId} Week=${appliedWeekNumber} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
            Date: new Date(currentDate),
            ShiftDate1: shiftDate1,
            ShiftDate2: shiftDate2,
            TimeForLunch: parseInt(template.lunch || '30'),
            Contract: parseInt(template.total || '1'),
            Holiday: isHoliday ? 1 : 0,
            WeeklyTimeTableID: selectedContractId,
            WeeklyTimeTableTitle: selectedContract.template || '',
          };
          
          // Если сотрудник в отпуске, добавляем тип отпуска
          if (leaveForDay) {
            recordData.TypeOfLeaveID = leaveForDay.typeOfLeave.toString();
          }
          
          // Добавляем запись в коллекцию
          generatedRecords.push(recordData);
        }
      }
      
      console.log(`[ScheduleTabFillOperations] Generated ${generatedRecords.length} records`);
      
      // Если не сгенерировано ни одной записи, показываем ошибку
      if (generatedRecords.length === 0) {
        setOperationMessage({
          text: 'No records generated. Please check the contract and weekly templates.',
          type: MessageBarType.warning
        });
        setIsSaving(false);
        return;
      }
      
      // Сохранение сгенерированных записей
      let successCount = 0;
      const failedRecords: string[] = [];
      
      // Сохраняем записи последовательно
      for (const record of generatedRecords) {
        try {
          // Вызываем метод создания записи
          const newRecordId = await createStaffRecord(
            record,
            currentUserId,
            managingGroupId,
            employeeId
          );
          
          if (newRecordId) {
            successCount++;
          } else {
            failedRecords.push(record.Title || 'Unknown');
          }
        } catch (error) {
          console.error(`[ScheduleTabFillOperations] Error creating record:`, error);
          failedRecords.push(record.Title || 'Unknown');
        }
      }
      
      // Показываем сообщение о результатах
      if (successCount === generatedRecords.length) {
        setOperationMessage({
          text: `Successfully generated ${successCount} schedule records from template`,
          type: MessageBarType.success
        });
      } else if (successCount > 0) {
        setOperationMessage({
          text: `Generated ${successCount} of ${generatedRecords.length} records. Failed: ${failedRecords.length}`,
          type: MessageBarType.warning
        });
      } else {
        setOperationMessage({
          text: `Failed to generate any records. Please try again.`,
          type: MessageBarType.error
        });
      }
      
      // Обновляем данные в интерфейсе
      if (onRefreshData) {
        onRefreshData();
      }
    } catch (templateError) {
      console.error('[ScheduleTabFillOperations] Error retrieving or processing templates:', templateError);
      setOperationMessage({
        text: `Error retrieving templates: ${templateError instanceof Error ? templateError.message : String(templateError)}`,
        type: MessageBarType.error
      });
    }
  } catch (error) {
    console.error('[ScheduleTabFillOperations] Error during schedule fill operation:', error);
    setOperationMessage({
      text: `Error filling schedule: ${error instanceof Error ? error.message : String(error)}`,
      type: MessageBarType.error
    });
  } finally {
    setIsSaving(false);
  }
};

/**
 * Функция для создания диалога подтверждения заполнения расписания
 */
export const createFillConfirmationDialog = (
  hasExistingRecords: boolean,
  onConfirm: () => void
): {
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string;
  onConfirm: () => void;
  confirmButtonColor: string;
} => {
  if (hasExistingRecords) {
    // Если есть существующие записи, показываем предупреждение
    return {
      isOpen: true,
      title: 'Confirm Fill Operation',
      message: 'There are existing records in the schedule. Filling the schedule will add new records based on templates. Do you want to continue?',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#d83b01' // Оранжевый цвет для предупреждения
    };
  } else {
    // Если записей нет, показываем простой диалог подтверждения
    return {
      isOpen: true,
      title: 'Fill Schedule',
      message: 'Do you want to fill the schedule based on template data?',
      confirmButtonText: 'Fill',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#107c10' // Зеленый цвет для подтверждения
    };
  }
};

/**
 * Вспомогательная функция для создания объекта Date с установленным временем
 * @param baseDate Базовая дата
 * @param time Объект с часами и минутами
 * @returns Объект Date с установленным временем
 */
function createDateWithTime(baseDate: Date, time: IDayHours): Date {
  const result = new Date(baseDate);
  
  try {
    // Получаем часы и минуты
    const hours = parseInt(time.hours, 10);
    const minutes = parseInt(time.minutes, 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      // Если не удалось распарсить, устанавливаем 00:00
      result.setHours(0, 0, 0, 0);
    } else {
      // Устанавливаем указанное время
      result.setHours(hours, minutes, 0, 0);
    }
  } catch (error) {
    console.error(`[ScheduleTabFillOperations] Error parsing time:`, error);
    // В случае ошибки устанавливаем 00:00
    result.setHours(0, 0, 0, 0);
  }
  
  return result;
}