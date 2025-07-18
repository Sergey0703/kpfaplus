// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
 MessageBar,
 MessageBarType,
 Spinner,
 SpinnerSize,
 DefaultButton
} from '@fluentui/react';
import { ITabProps } from '../../../models/types';
import { IHoliday } from '../../../services/HolidaysService';
import { ILeaveDay } from '../../../services/DaysOfLeavesService';
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService';
import { IExistingRecordCheck } from './utils/ScheduleTabFillInterfaces';
import styles from './ScheduleTab.module.scss';

import { FilterControls } from './components/FilterControls';
import { DayInfo } from './components/DayInfo';
import ScheduleTable, { IScheduleItem, IScheduleOptions } from './components/ScheduleTable';
import { ScheduleTableDialogs } from './components/ScheduleTableDialogs';

import { convertStaffRecordsToScheduleItems } from './utils/ScheduleTabDataUtils';
import {
 handleSaveAllChanges,
 IActionHandlerParams
} from './utils/ScheduleTabActionHandlers';
import {
 fillScheduleFromTemplate
} from './utils/ScheduleTabFillService';

// Интерфейсы для сервисов
interface IHolidaysService {
 isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
 getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
 isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
 getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

export interface ITypeOfLeaveService {
 getAllTypesOfLeave: (forceRefresh?: boolean) => Promise<ITypeOfLeave[]>;
 getTypeOfLeaveById: (id: string | number) => Promise<ITypeOfLeave | undefined>;
}

import { IScheduleTabState } from './utils/useScheduleTabState';
import { UseScheduleTabLogicReturn } from './utils/useScheduleTabLogic';

export interface IScheduleTabContentProps extends IScheduleTabState {
 selectedStaff: ITabProps['selectedStaff'];
 context?: WebPartContext;
 currentUserId?: string;
 managingGroupId?: string;
 dayOfStartWeek?: number;

 onDateChange: UseScheduleTabLogicReturn['onDateChange'];
 onContractChange: UseScheduleTabLogicReturn['onContractChange'];
 onErrorDismiss: UseScheduleTabLogicReturn['onErrorDismiss'];
 onRefreshData: UseScheduleTabLogicReturn['onRefreshData'];

 onPageChange: UseScheduleTabLogicReturn['onPageChange'];
 onItemsPerPageChange: UseScheduleTabLogicReturn['onItemsPerPageChange'];

 getExistingRecordsWithStatus: UseScheduleTabLogicReturn['getExistingRecordsWithStatus'];
 markRecordsAsDeleted: UseScheduleTabLogicReturn['markRecordsAsDeleted'];
 onAddShift: UseScheduleTabLogicReturn['onAddShift'];
 onUpdateStaffRecord: UseScheduleTabLogicReturn['onUpdateStaffRecord'];
 onCreateStaffRecord: UseScheduleTabLogicReturn['onCreateStaffRecord'];
 onDeleteStaffRecord?: (recordId: string) => Promise<boolean>;
 onRestoreStaffRecord?: (recordId: string) => Promise<boolean>;
 
 // *** ДОБАВЛЯЕМ НОВЫЕ ПРОПСЫ: ***
 onBulkDeleteStaffRecords?: (recordIds: string[]) => Promise<{ successCount: number; failedIds: string[] }>;

 holidaysService?: IHolidaysService;
 daysOfLeavesService?: IDaysOfLeavesService;
 typeOfLeaveService?: ITypeOfLeaveService;

 showDeleted: boolean;
 onToggleShowDeleted: UseScheduleTabLogicReturn['onToggleShowDeleted'];
}

enum DialogType {
 None = 'none',
 EmptySchedule = 'empty',
 ProcessedRecordsBlock = 'processed_block',
 UnprocessedRecordsReplace = 'unprocessed_replace'
}

interface IDialogConfig {
 type: DialogType;
 isOpen: boolean;
 title: string;
 message: string;
 confirmButtonText: string;
 cancelButtonText: string;
 confirmButtonColor: string;
 onConfirm: () => void;
}

export const ScheduleTabContent: React.FC<IScheduleTabContentProps> = (props) => {
 const {
   selectedStaff,
   selectedDate,
   contracts,
   selectedContractId,
   isLoading,
   error,
   holidays,
   leaves,
   typesOfLeave,
   onDateChange,
   onContractChange,
   onErrorDismiss,
   staffRecords,
   isLoadingStaffRecords,
   errorStaffRecords,
   currentPage,
   itemsPerPage,
   totalItemCount,
   onPageChange,
   onItemsPerPageChange,
   onUpdateStaffRecord,
   onCreateStaffRecord,
   onDeleteStaffRecord,
   onRestoreStaffRecord,
   onRefreshData,
   onAddShift,
   dayOfStartWeek,
   context,
   currentUserId,
   managingGroupId,
   getExistingRecordsWithStatus,
   markRecordsAsDeleted,
   showDeleted,
   onToggleShowDeleted,
   // *** НОВЫЙ ПРОПС: ***
   onBulkDeleteStaffRecords,
 } = props;

console.log('[ScheduleTabContent] *** COMPONENT RENDER WITH NUMERIC FIELDS SUPPORT ***');
 console.log('[ScheduleTabContent] currentPage:', currentPage);
 console.log('[ScheduleTabContent] staffRecords length:', staffRecords?.length || 0);
 console.log('[ScheduleTabContent] totalItemCount:', totalItemCount);
 console.log('[ScheduleTabContent] showDeleted:', showDeleted);
 console.log('[ScheduleTabContent] onBulkDeleteStaffRecords available:', !!onBulkDeleteStaffRecords);
 console.log('[ScheduleTabContent] SERVER-SIDE FILTERING: ENABLED');
 if (staffRecords && staffRecords.length > 0) {
   console.log('[ScheduleTabContent] First record ID:', staffRecords[0].ID);
   console.log('[ScheduleTabContent] Last record ID:', staffRecords[staffRecords.length - 1].ID);
   
   // *** ПРОВЕРЯЕМ НАЛИЧИЕ ЧИСЛОВЫХ ПОЛЕЙ В ЗАПИСЯХ ***
   const firstRecord = staffRecords[0];
   console.log('[ScheduleTabContent] *** NUMERIC FIELDS CHECK ***');
   console.log('[ScheduleTabContent] First record numeric fields:', {
     ShiftDate1Hours: firstRecord.ShiftDate1Hours,
     ShiftDate1Minutes: firstRecord.ShiftDate1Minutes,
     ShiftDate2Hours: firstRecord.ShiftDate2Hours,
     ShiftDate2Minutes: firstRecord.ShiftDate2Minutes,
     hasNumericFields: firstRecord.ShiftDate1Hours !== undefined
   });
   
   // Проверяем что сервер правильно отфильтровал записи
   const deletedRecords = staffRecords.filter(r => r.Deleted === 1);
   console.log('[ScheduleTabContent] Deleted records in staffRecords:', deletedRecords.length);
   if (!showDeleted && deletedRecords.length > 0) {
     console.error('[ScheduleTabContent] ERROR: Found deleted records when showDeleted=false!');
   } else if (showDeleted) {
     console.log('[ScheduleTabContent] OK: Showing all records including deleted ones');
   } else {
     console.log('[ScheduleTabContent] OK: Showing only active records');
   }
 }
 console.log('[ScheduleTabContent] isLoadingStaffRecords:', isLoadingStaffRecords);
 const selectedContract = contracts.find(c => c.id === selectedContractId);

 // ИСПРАВЛЕНО: Создание сервисов ТОЛЬКО для DayInfo (информационный блок)
 // Эти сервисы НЕ используются для данных таблицы расписания
 const holidaysServiceInstance = useMemo(() => {
   if (!context) return undefined;
   
   console.log('[ScheduleTabContent] Creating holidaysService instance ONLY for DayInfo display');
   return {
     isHoliday: (date: Date, holidays: IHoliday[]) => {
       const result = holidays.some(holiday => {
         const holidayDate = new Date(holiday.date);
         const isMatch = holidayDate.toDateString() === date.toDateString();
         if (isMatch) {
           console.log('[ScheduleTabContent] Holiday match found:', holiday.title, 'for date:', date.toDateString());
         }
         return isMatch;
       });
       console.log('[ScheduleTabContent] isHoliday check for', date.toDateString(), ':', result);
       return result;
     },
     getHolidayInfo: (date: Date, holidays: IHoliday[]) => {
       const holiday = holidays.find(holiday => {
         const holidayDate = new Date(holiday.date);
         return holidayDate.toDateString() === date.toDateString();
       });
       console.log('[ScheduleTabContent] getHolidayInfo for', date.toDateString(), ':', holiday?.title || 'none');
       return holiday;
     }
   };
 }, [context]);

 const daysOfLeavesServiceInstance = useMemo(() => {
   if (!context) return undefined;
   
   console.log('[ScheduleTabContent] Creating daysOfLeavesService instance ONLY for DayInfo display');
   return {
     isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => {
       const result = leaves.some(leave => {
         const startDate = new Date(leave.startDate);
         const endDate = leave.endDate ? new Date(leave.endDate) : new Date();
         const isInRange = date >= startDate && date <= endDate;
         if (isInRange) {
           console.log('[ScheduleTabContent] Leave match found:', leave.title, 'for date:', date.toDateString());
         }
         return isInRange;
       });
       console.log('[ScheduleTabContent] isDateOnLeave check for', date.toDateString(), ':', result, 'from', leaves.length, 'leaves');
       return result;
     },
     getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => {
       const leave = leaves.find(leave => {
         const startDate = new Date(leave.startDate);
         const endDate = leave.endDate ? new Date(leave.endDate) : new Date();
         return date >= startDate && date <= endDate;
       });
       console.log('[ScheduleTabContent] getLeaveForDate for', date.toDateString(), ':', leave?.title || 'none');
       return leave;
     }
   };
 }, [context]);

 const [modifiedRecords, setModifiedRecords] = useState<Record<string, IScheduleItem>>({});
 const [isSaving, setIsSaving] = useState<boolean>(false);
 const [operationMessage, setOperationMessage] = useState<{
   text: string;
   type: MessageBarType;
 } | undefined>(undefined);

 const [fillDialogConfig, setFillDialogConfig] = useState<IDialogConfig>({
   type: DialogType.None,
   isOpen: false,
   title: '',
   message: '',
   confirmButtonText: '',
   cancelButtonText: 'Cancel',
   confirmButtonColor: '',
   onConfirm: () => {}
 });

 React.useEffect(() => {
   console.log('[ScheduleTabContent] Clearing modified records due to date, contract, or staff change');
   setModifiedRecords({});
   setOperationMessage(undefined);
 }, [selectedDate, selectedContractId, selectedStaff?.id]);

 // *** ОБНОВЛЕННАЯ ФУНКЦИЯ getAllScheduleItems С ПОДДЕРЖКОЙ ЧИСЛОВЫХ ПОЛЕЙ ***
 const getAllScheduleItems = useCallback((): IScheduleItem[] => {
  console.log('[ScheduleTabContent] *** CONVERTING STAFF RECORDS WITH NUMERIC FIELDS SUPPORT ***');
  console.log('[ScheduleTabContent] *** CURRENT DATA STATE ***');
  console.log('[ScheduleTabContent] staffRecords length:', staffRecords?.length);
  console.log('[ScheduleTabContent] currentPage:', currentPage);
  console.log('[ScheduleTabContent] totalItemCount:', totalItemCount);
  if (staffRecords && staffRecords.length > 0) {
    console.log('[ScheduleTabContent] First record ID:', staffRecords[0].ID);
    console.log('[ScheduleTabContent] First record Date:', staffRecords[0].Date);
    console.log('[ScheduleTabContent] Last record ID:', staffRecords[staffRecords.length - 1].ID);
    
    // *** ЛОГИРУЕМ ЧИСЛОВЫЕ ПОЛЯ ПЕРВОЙ ЗАПИСИ ***
    const firstRecord = staffRecords[0];
    console.log('[ScheduleTabContent] *** FIRST RECORD NUMERIC FIELDS ***');
    console.log('[ScheduleTabContent] ShiftDate1Hours:', firstRecord.ShiftDate1Hours);
    console.log('[ScheduleTabContent] ShiftDate1Minutes:', firstRecord.ShiftDate1Minutes);
    console.log('[ScheduleTabContent] ShiftDate2Hours:', firstRecord.ShiftDate2Hours);
    console.log('[ScheduleTabContent] ShiftDate2Minutes:', firstRecord.ShiftDate2Minutes);
    console.log('[ScheduleTabContent] ShiftDate1 (DateTime):', firstRecord.ShiftDate1?.toISOString());
    console.log('[ScheduleTabContent] ShiftDate2 (DateTime):', firstRecord.ShiftDate2?.toISOString());
  }
  
   console.log('[ScheduleTabContent] Converting staff records using ENHANCED convertStaffRecordsToScheduleItems');
   console.log('[ScheduleTabContent] Staff records count:', staffRecords?.length || 0);
   console.log('[ScheduleTabContent] IMPORTANT: Now supporting BOTH numeric fields AND DateTime fields');
   
   // *** ОБНОВЛЕНО: convertStaffRecordsToScheduleItems теперь поддерживает числовые поля ***
   const baseItems = convertStaffRecordsToScheduleItems(
     staffRecords || [], 
     selectedContract
   );

   console.log('[ScheduleTabContent] Base items converted:', baseItems.length);
   
   // *** ЛОГИРУЕМ ЧИСЛОВЫЕ ПОЛЯ В ПЕРВОМ ПРЕОБРАЗОВАННОМ ЭЛЕМЕНТЕ ***
   if (baseItems.length > 0) {
     const firstItem = baseItems[0];
     console.log('[ScheduleTabContent] *** FIRST CONVERTED ITEM TIME FIELDS ***');
     console.log('[ScheduleTabContent] String fields: startHour=' + firstItem.startHour + ', startMinute=' + firstItem.startMinute + ', finishHour=' + firstItem.finishHour + ', finishMinute=' + firstItem.finishMinute);
     console.log('[ScheduleTabContent] Numeric fields: startHours=' + firstItem.startHours + ', startMinutes=' + firstItem.startMinutes + ', finishHours=' + firstItem.finishHours + ', finishMinutes=' + firstItem.finishMinutes);
     console.log('[ScheduleTabContent] Working hours:', firstItem.workingHours);
     
     // Логируем несколько примеров для проверки
     console.log('[ScheduleTabContent] Sample converted items:');
     baseItems.slice(0, 3).forEach(item => {
       console.log(`- Item ${item.id}: date=${item.date.toLocaleDateString()}, typeOfLeave="${item.typeOfLeave}", deleted=${item.deleted}`);
       console.log(`  String time: ${item.startHour}:${item.startMinute}-${item.finishHour}:${item.finishMinute}`);
       console.log(`  Numeric time: ${item.startHours}:${item.startMinutes}-${item.finishHours}:${item.finishMinutes}`);
     });
   }

   // Применяем локальные изменения, если есть
   return baseItems.map(item => {
     if (modifiedRecords[item.id]) {
       const modifiedItem = {
         ...item,
         ...modifiedRecords[item.id]
       };
       console.log(`[ScheduleTabContent] Applied modifications to item ${item.id}:`, modifiedRecords[item.id]);
       return modifiedItem;
     }
     return item;
   });
 }, [staffRecords, modifiedRecords, selectedContract, currentPage, totalItemCount]);

// *** НОВАЯ ФУНКЦИЯ БЕЗ КЛИЕНТСКОЙ ФИЛЬТРАЦИИ ***
const getScheduleItemsWithModifications = (): IScheduleItem[] => {
  const allItems = getAllScheduleItems();
  
  console.log('[ScheduleTabContent] *** NO CLIENT-SIDE FILTERING - SERVER HANDLES IT ***');
  console.log('[ScheduleTabContent] Total items from server:', allItems.length);
  console.log('[ScheduleTabContent] showDeleted setting:', showDeleted);
  console.log('[ScheduleTabContent] Server already filtered based on showDeleted - returning all items as-is');
  
  // *** ВАЖНО: НЕ ФИЛЬТРУЕМ ПО DELETED - СЕРВЕР УЖЕ ЭТО СДЕЛАЛ ***
  // Просто возвращаем все элементы с примененными локальными изменениями
  return allItems;
};

// Используем новую функцию без клиентской фильтрации
const itemsForTable = getScheduleItemsWithModifications();

 const actionHandlerParams: IActionHandlerParams = useMemo(() => ({
   setIsSaving,
   setOperationMessage,
   setModifiedRecords,
   onRefreshData
 }), [setIsSaving, setOperationMessage, setModifiedRecords, onRefreshData]);

 const performFillOperation = async (): Promise<void> => {
   console.log('[ScheduleTabContent] performFillOperation called');

   if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId || !onCreateStaffRecord || !getExistingRecordsWithStatus || !markRecordsAsDeleted || !context) {
     console.error('[ScheduleTabContent] Missing required data/functions for fill operation');
     setOperationMessage({
       text: 'Fill operation failed: Missing staff, contract, context, or required functions.',
       type: MessageBarType.error
     });
     return;
   }

   const fillParams = {
     selectedDate,
     selectedStaffId: selectedStaff.id,
     employeeId: selectedStaff.employeeId,
     selectedContract,
     selectedContractId,
     holidays,
     leaves,
     currentUserId,
     managingGroupId,
     dayOfStartWeek,
     context
   };

   const fillHandlers = {
     createStaffRecord: onCreateStaffRecord,
     setOperationMessage,
     setIsSaving,
     onRefreshData,
     getExistingRecordsWithStatus: getExistingRecordsWithStatus,
     markRecordsAsDeleted: markRecordsAsDeleted
   };

   console.log('[ScheduleTabContent] Calling fillScheduleFromTemplate with numeric fields support');

   try {
     await fillScheduleFromTemplate(fillParams, fillHandlers);
   } catch (error) {
     console.error('[ScheduleTabContent] Error during fillScheduleFromTemplate:', error);
     setOperationMessage({
       text: `Fill operation failed: ${error instanceof Error ? error.message : String(error)}`,
       type: MessageBarType.error
     });
   }
 };

 const determineDialogType = async (): Promise<IDialogConfig> => {
   console.log('[ScheduleTabContent] determineDialogType called');

   let existingRecords: IExistingRecordCheck[] = [];

   if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId || !getExistingRecordsWithStatus || !markRecordsAsDeleted) {
     console.error('[ScheduleTabContent] Missing required data/functions for dialog determination');
     return {
       type: DialogType.None, isOpen: true, title: 'Error',
       message: 'Cannot check existing records: Missing staff, contract information, or required functions.',
       confirmButtonText: 'OK', cancelButtonText: '', confirmButtonColor: '#d83b01',
       onConfirm: () => setFillDialogConfig(prev => ({ ...prev, isOpen: false }))
     } as IDialogConfig;
   }

   try {
     // *** ИСПРАВЛЕНО: Создание границ месяца в UTC ***
     const startOfMonth = new Date(Date.UTC(
       selectedDate.getUTCFullYear(), 
       selectedDate.getUTCMonth(), 
       1, 
       0, 0, 0, 0
     ));
     
     const endOfMonth = new Date(Date.UTC(
       selectedDate.getUTCFullYear(), 
       selectedDate.getUTCMonth() + 1, 
       0, 
       23, 59, 59, 999
     ));

     console.log('[ScheduleTabContent] *** UTC MONTH BOUNDARIES CREATED ***');
     console.log('[ScheduleTabContent] Start of month (UTC):', startOfMonth.toISOString());
     console.log('[ScheduleTabContent] End of month (UTC):', endOfMonth.toISOString());

     const contractStartDate = selectedContract.startDate ? new Date(selectedContract.startDate) : null;
     const contractFinishDate = selectedContract.finishDate ? new Date(selectedContract.finishDate) : null;

     console.log('[ScheduleTabContent] Contract dates:');
     console.log('[ScheduleTabContent] Contract start:', contractStartDate?.toISOString() || 'not set');
     console.log('[ScheduleTabContent] Contract finish:', contractFinishDate?.toISOString() || 'not set');

     // *** ИСПРАВЛЕНО: Правильная логика определения периода с UTC границами ***
     const firstDay = contractStartDate && !isNaN(contractStartDate.getTime()) && contractStartDate > startOfMonth
       ? contractStartDate
       : startOfMonth;

     const lastDay = contractFinishDate && !isNaN(contractFinishDate.getTime()) && contractFinishDate < endOfMonth
       ? contractFinishDate
       : endOfMonth;

     console.log('[ScheduleTabContent] *** FINAL PERIOD FOR EXISTING RECORDS CHECK ***');
     console.log('[ScheduleTabContent] First day:', firstDay.toISOString());
     console.log('[ScheduleTabContent] Last day:', lastDay.toISOString());

     if (firstDay && lastDay) {
       if (firstDay.getTime() > lastDay.getTime()) {
         console.log('[ScheduleTabContent] Contract period does not overlap with the month, or dates are invalid.');
         return {
           type: DialogType.EmptySchedule,
           isOpen: true,
           title: 'Fill Schedule',
           message: 'No existing records found for this period (contract may not cover the month or has invalid dates). Do you want to fill based on template?',
           confirmButtonText: 'Fill',
           cancelButtonText: 'Cancel',
           confirmButtonColor: '#107c10',
           onConfirm: () => {
             setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
             void performFillOperation();
           }
         };
       }
     } else {
       console.warn('[ScheduleTabContent] One of the period boundary dates is null, which might indicate an issue.');
     }

     console.log('[ScheduleTabContent] Checking for existing records in period:', {
       firstDay: firstDay?.toISOString(),
       lastDay: lastDay?.toISOString(),
       employeeId: selectedStaff.employeeId,
       currentUserId,
       managingGroupId
     });

     existingRecords = await getExistingRecordsWithStatus(
       firstDay || selectedDate,
       lastDay || selectedDate,
       selectedStaff.employeeId,
       currentUserId,
       managingGroupId,
       selectedContractId
     );

     console.log(`[ScheduleTabContent] Found ${existingRecords.length} existing records`);

     if (existingRecords.length === 0) {
       console.log('[ScheduleTabContent] No existing records - showing empty schedule dialog');
       return {
         type: DialogType.EmptySchedule,
         isOpen: true,
         title: 'Fill Schedule',
         message: 'Do you want to fill the schedule based on template data?',
         confirmButtonText: 'Fill',
         cancelButtonText: 'Cancel',
         confirmButtonColor: '#107c10',
         onConfirm: () => {
           setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
           void performFillOperation();
         }
       };
     }

     const { checkRecordsProcessingStatus, createProcessingBlockMessage } = await import(/* webpackChunkName: 'schedule-fill-helpers' */ './utils/ScheduleTabFillHelpers');

     const processingStatus = checkRecordsProcessingStatus(existingRecords);

     console.log('[ScheduleTabContent] Processing status:', {
       totalRecords: processingStatus.totalCount,
       processedRecords: processingStatus.processedCount,
       hasProcessedRecords: processingStatus.hasProcessedRecords
     });

     if (processingStatus.hasProcessedRecords) {
       console.log(`[ScheduleTabContent] BLOCKING: Found ${processingStatus.processedCount} processed records`);

       const blockMessage = createProcessingBlockMessage(processingStatus);
       return {
         type: DialogType.ProcessedRecordsBlock,
         isOpen: true,
         title: 'Cannot Replace Records',
         message: blockMessage.text,
         confirmButtonText: 'OK',
         cancelButtonText: '',
         confirmButtonColor: '#d83b01',
         onConfirm: () => {
           setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
           setOperationMessage(blockMessage);
         }
       };
     }

     console.log(`[ScheduleTabContent] All ${existingRecords.length} records are unprocessed - showing replacement dialog`);

     return {
       type: DialogType.UnprocessedRecordsReplace,
       isOpen: true,
       title: 'Replace Schedule Records',
       message: `Found ${existingRecords.length} existing unprocessed records for this period. Replace them with new records from template?`,
       confirmButtonText: 'Replace',
       cancelButtonText: 'Cancel',
       confirmButtonColor: '#d83b01',
       onConfirm: () => {
         console.log('[ScheduleTabContent] User confirmed replacement - proceeding with fill');
         setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
         void performFillOperation();
       }
     };

   } catch (error) {
     console.error('[ScheduleTabContent] Error during dialog type determination:', error);
     const errorMessage = error instanceof Error ? error.message : String(error);
     const itemCount = existingRecords ? existingRecords.length : 0;

     return {
       type: DialogType.None,
       isOpen: true,
       title: 'Error',
       message: `Error checking existing records (${itemCount} found before error): ${errorMessage}`,
       confirmButtonText: 'OK',
       cancelButtonText: '',
       confirmButtonColor: '#d83b01',
       onConfirm: () => {
         setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
         setOperationMessage({
           text: `Error checking existing records: ${errorMessage}`,
           type: MessageBarType.error
         });
       }
     };
   }
 };

 const handleFillButtonClick = async (): Promise<void> => {
   console.log('[ScheduleTabContent] Fill button clicked - starting dialog determination');

   if (!onCreateStaffRecord || !getExistingRecordsWithStatus || !markRecordsAsDeleted) {
     console.error('[ScheduleTabContent] Fill prerequisites missing.');
     setOperationMessage({
       text: 'Fill operation is not fully available (missing required functions).',
       type: MessageBarType.error
     });
     return;
   }

   try {
     setIsSaving(true);
     setOperationMessage(undefined);
     setFillDialogConfig(prev => ({ ...prev, isOpen: false }));

     const dialogConfig = await determineDialogType();

     setFillDialogConfig(dialogConfig);

   } catch (error) {
     console.error('[ScheduleTabContent] Error in handleFillButtonClick:', error);
     setOperationMessage({
       text: `Error preparing fill operation: ${error instanceof Error ? error.message : String(error)}`,
       type: MessageBarType.error
     });
   } finally {
     setIsSaving(false);
   }
 };

 const handleDismissFillDialog = (): void => {
   setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
 };

 const saveAllChanges = async (): Promise<void> => {
   console.log('[ScheduleTabContent] *** SAVE ALL CHANGES WITH NUMERIC FIELDS SUPPORT ***');
   if (!onUpdateStaffRecord) {
     setOperationMessage({
       text: 'Unable to save changes: Update function not available',
       type: MessageBarType.error
     });
     return;
   }
   if (Object.keys(modifiedRecords).length === 0) {
     console.log('[ScheduleTabContent] No modified records to save.');
     setOperationMessage({
       text: 'No changes to save.',
       type: MessageBarType.info
     });
     return;
   }

   console.log(`[ScheduleTabContent] Saving ${Object.keys(modifiedRecords).length} modified records with numeric fields support`);
   
   // *** ЛОГИРУЕМ ТИПЫ ИЗМЕНЕНИЙ ***
   Object.entries(modifiedRecords).forEach(([recordId, modifiedItem]) => {
     console.log(`[ScheduleTabContent] Modified record ${recordId}:`, {
       stringFields: `${modifiedItem.startHour}:${modifiedItem.startMinute}-${modifiedItem.finishHour}:${modifiedItem.finishMinute}`,
       numericFields: `${modifiedItem.startHours}:${modifiedItem.startMinutes}-${modifiedItem.finishHours}:${modifiedItem.finishMinutes}`,
       workingHours: modifiedItem.workingHours,
       hasNumericFields: modifiedItem.startHours !== undefined
     });
   });

   void handleSaveAllChanges(modifiedRecords, onUpdateStaffRecord, actionHandlerParams);
 };

 // *** ОБНОВЛЕННАЯ ФУНКЦИЯ handleItemChange С ПОДДЕРЖКОЙ ЧИСЛОВЫХ ПОЛЕЙ ***
 const handleItemChange = useCallback((item: IScheduleItem, field: string, value: string | number): void => {
   console.log(`[ScheduleTabContent] *** HANDLE ITEM CHANGE WITH NUMERIC FIELDS ***`);
   console.log(`[ScheduleTabContent] handleItemChange called for item ${item.id}, field: ${field}, value: ${value}`);
   console.log(`[ScheduleTabContent] IMPORTANT: Full support for BOTH string and numeric time fields`);

   setModifiedRecords(prev => {
     const originalRecord = staffRecords?.find(sr => sr.ID === item.id);
     
     // *** ОБНОВЛЕНО: convertStaffRecordsToScheduleItems теперь поддерживает числовые поля ***
     const baseIScheduleItem = originalRecord ? 
       convertStaffRecordsToScheduleItems([originalRecord], selectedContract)[0] : 
       item;
     
     const currentLocalItem = prev[item.id] || baseIScheduleItem;

     let updatedValue: string | number | Date = value;
     
     if (field === 'typeOfLeave') {
       updatedValue = String(value);
       console.log(`[ScheduleTabContent] Updating typeOfLeave for item ${item.id} to: ${updatedValue}`);
     } else if (field === 'contractNumber') {
       updatedValue = String(value);
     } else if (field === 'date') {
       if (typeof value === 'object' && value !== null && Object.prototype.toString.call(value) === '[object Date]') {
         updatedValue = value as unknown as Date;
       } else {
         console.warn(`[ScheduleTabContent] Unexpected value type for date field: ${typeof value}`);
         updatedValue = value;
       }
     }
     
     // *** НОВОЕ: Создаем обновленный элемент с синхронизацией числовых полей ***
     const updatedItem = {
       ...currentLocalItem,
       [field]: updatedValue,
     };

     // *** СИНХРОНИЗИРУЕМ ЧИСЛОВЫЕ ПОЛЯ ПРИ ИЗМЕНЕНИИ ВРЕМЕНИ ***
     if (field === 'startHour' || field === 'startMinute' || field === 'finishHour' || field === 'finishMinute') {
       const numericValue = typeof value === 'string' ? parseInt(value, 10) : Number(value);
       if (!isNaN(numericValue)) {
         switch (field) {
           case 'startHour':
             updatedItem.startHours = numericValue;
             console.log(`[ScheduleTabContent] Synced startHours to: ${numericValue}`);
             break;
           case 'startMinute':
             updatedItem.startMinutes = numericValue;
             console.log(`[ScheduleTabContent] Synced startMinutes to: ${numericValue}`);
             break;
           case 'finishHour':
             updatedItem.finishHours = numericValue;
             console.log(`[ScheduleTabContent] Synced finishHours to: ${numericValue}`);
             break;
           case 'finishMinute':
             updatedItem.finishMinutes = numericValue;
             console.log(`[ScheduleTabContent] Synced finishMinutes to: ${numericValue}`);
             break;
         }
       }
     }
     
     // *** ТАКЖЕ СИНХРОНИЗИРУЕМ ЕСЛИ ПРЯМО МЕНЯЮТСЯ ЧИСЛОВЫЕ ПОЛЯ ***
     if (field === 'startHours' || field === 'startMinutes' || field === 'finishHours' || field === 'finishMinutes') {
       const numericValue = typeof value === 'string' ? parseInt(value, 10) : Number(value);
       if (!isNaN(numericValue)) {
         const paddedValue = numericValue.toString().padStart(2, '0');
         switch (field) {
           case 'startHours':
             updatedItem.startHour = paddedValue;
             console.log(`[ScheduleTabContent] Synced startHour to: ${paddedValue}`);
             break;
           case 'startMinutes':
             updatedItem.startMinute = paddedValue;
             console.log(`[ScheduleTabContent] Synced startMinute to: ${paddedValue}`);
             break;
           case 'finishHours':
             updatedItem.finishHour = paddedValue;
             console.log(`[ScheduleTabContent] Synced finishHour to: ${paddedValue}`);
             break;
           case 'finishMinutes':
             updatedItem.finishMinute = paddedValue;
             console.log(`[ScheduleTabContent] Synced finishMinute to: ${paddedValue}`);
             break;
         }
       }
     }

     console.log('[ScheduleTabContent] *** FINAL UPDATED ITEM ***', {
       id: updatedItem.id,
       field: field,
       newValue: updatedValue,
       stringTime: `${updatedItem.startHour}:${updatedItem.startMinute}-${updatedItem.finishHour}:${updatedItem.finishMinute}`,
       numericTime: `${updatedItem.startHours}:${updatedItem.startMinutes}-${updatedItem.finishHours}:${updatedItem.finishMinutes}`,
       workingHours: updatedItem.workingHours
     });

     return {
       ...prev,
       [item.id]: updatedItem
     };
   });
 }, [staffRecords, selectedContract]);

 const scheduleOptions: IScheduleOptions = useMemo(() => ({
   hours: Array.from({ length: 24 }, (_, i) => ({
     key: i.toString().padStart(2, '0'),
     text: i.toString().padStart(2, '0')
   })),
   minutes: Array.from({ length: 12 }, (_, i) => {
     const value = (i * 5).toString().padStart(2, '0');
     return { key: value, text: value };
   }), // 00, 05, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55
   lunchTimes: Array.from({ length: 13 }, (_, i) => {
     const value = (i * 5).toString();
     return { key: value, text: value };
   }), // 0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60
   leaveTypes: [
     { key: '', text: 'None' },
     ...typesOfLeave.map(t => ({ key: t.id, text: t.title }))
   ],
   contractNumbers: [
     { key: '1', text: '1' },
     { key: '2', text: '2' },
     { key: '3', text: '3' }
   ]
 }), [typesOfLeave]);

 console.log('[ScheduleTabContent] *** RENDERING COMPONENT WITH NUMERIC FIELDS SUPPORT ***', {
   selectedStaffName: selectedStaff?.name,
   selectedDate: selectedDate.toISOString(),
   holidaysCount: holidays.length,
   leavesCount: leaves.length,
   staffRecordsCount: staffRecords?.length || 0,
   itemsForTableCount: itemsForTable.length,
   showDeleted: showDeleted,
   serverFiltering: 'ENABLED - no client-side filtering by deleted status',
   hasHolidaysService: !!holidaysServiceInstance,
   hasDaysOfLeavesService: !!daysOfLeavesServiceInstance,
   hasBulkDeleteFunction: !!onBulkDeleteStaffRecords,
   numericFieldsSupport: 'ENABLED - both string and numeric time fields supported'
 });

 return (
   <div className={styles.scheduleTab}>
     <div className={styles.header}>
       <h2>Schedule for {selectedStaff?.name}</h2>
     </div>

     {/* Отображаем сообщение об ошибке, если есть */}
     {(error || errorStaffRecords) && (
       <MessageBar
         messageBarType={MessageBarType.error}
         isMultiline={true}
         onDismiss={onErrorDismiss}
        dismissButtonAriaLabel="Close"
      >
        {error || errorStaffRecords}
      </MessageBar>
    )}

    {/* Отображаем операционное сообщение, если есть */}
    {operationMessage && (
      <MessageBar
        messageBarType={operationMessage.type}
        isMultiline={true}
        onDismiss={(): void => setOperationMessage(undefined)}
        dismissButtonAriaLabel="Close"
      >
        {operationMessage.text}
      </MessageBar>
    )}

    {/* Фильтры выбора даты и контракта с кнопкой Fill */}
    <FilterControls
      selectedDate={selectedDate}
      contracts={contracts}
      selectedContractId={selectedContractId}
      isLoading={isLoading || isLoadingStaffRecords || isSaving}
     onDateChange={onDateChange}
     onContractChange={onContractChange}
     onFillButtonClick={handleFillButtonClick}
   />

   {/* Показываем спиннер при загрузке ВСЕХ данных или записей расписания */}
   {isLoading || isLoadingStaffRecords || isSaving ? (
     <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px 0' }}>
       <Spinner size={SpinnerSize.large} label={isSaving ? "Processing operation..." : (isLoadingStaffRecords ? "Loading schedule records..." : "Loading data...")} />
     </div>
   ) : (
     <>
       {selectedContract ? (
         <div style={{
           border: 'none',
           padding: '0px',
           borderRadius: '4px',
           minHeight: '300px',
           backgroundColor: 'white'
         }}>
           {/* ИСПРАВЛЕНО: DayInfo использует ТОЛЬКО для информационного отображения */}
           {/* Эти данные НЕ влияют на таблицу расписания */}
           <DayInfo
             selectedDate={selectedDate}
             holidays={holidays}
             leaves={leaves}
             typesOfLeave={typesOfLeave}
             holidaysService={holidaysServiceInstance}
             daysOfLeavesService={daysOfLeavesServiceInstance}
           />

           <div style={{ padding: '10px' }}>
             {/* *** ОБНОВЛЕНО: Таблица расписания теперь поддерживает числовые поля времени *** */}
             {/* TypeOfLeave берется из StaffRecords.TypeOfLeaveID, а НЕ из DaysOfLeaves */}
             {/* ВАЖНО: БЕЗ КЛИЕНТСКОЙ ФИЛЬТРАЦИИ - сервер уже отфильтровал данные */}
             {/* *** ИСПРАВЛЕНО: Передаем holidays в ScheduleTable *** */}
             <ScheduleTable
               key={`${currentPage}-${itemsPerPage}-${showDeleted}`} 
               items={itemsForTable}
               options={scheduleOptions}
               selectedDate={selectedDate}
               selectedContract={selectedContract ? { id: selectedContract.id, name: selectedContract.template } : undefined}
               isLoading={false}
               showDeleted={showDeleted}
               onToggleShowDeleted={onToggleShowDeleted}
               holidays={holidays} // *** НОВЫЙ ПРОПС: Передаем holidays массив ***
               onItemChange={handleItemChange}
               onAddShift={onAddShift}
               onDeleteItem={onDeleteStaffRecord!}
               onRestoreItem={onRestoreStaffRecord!}
               // *** ДОБАВЛЯЕМ НОВЫЕ ПРОПСЫ: ***
               onBulkDeleteItems={onBulkDeleteStaffRecords} // ← НОВОЕ
               onRefreshData={onRefreshData} // ← НОВОЕ
               saveChangesButton={
                 Object.keys(modifiedRecords).length > 0 ? (
                   <DefaultButton
                     text={`Save Changes (${Object.keys(modifiedRecords).length})`}
                     onClick={saveAllChanges}
                     disabled={isSaving}
                     styles={{
                       root: { backgroundColor: '#0078d4', color: 'white' },
                       rootHovered: { backgroundColor: '#106ebe', color: 'white' }
                     }}
                   />
                 ) : undefined
               }
               currentPage={currentPage}
               itemsPerPage={itemsPerPage}
               totalItemCount={totalItemCount}
               onPageChange={onPageChange}
               onItemsPerPageChange={onItemsPerPageChange}
             />
           </div>
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

   {/* Диалог подтверждения Fill */}
   <ScheduleTableDialogs
     confirmDialogProps={{
       isOpen: fillDialogConfig.isOpen,
       title: fillDialogConfig.title,
       message: fillDialogConfig.message,
       confirmButtonText: fillDialogConfig.confirmButtonText,
       cancelButtonText: fillDialogConfig.cancelButtonText,
       onConfirm: fillDialogConfig.onConfirm,
       confirmButtonColor: fillDialogConfig.confirmButtonColor
     }}
     onDismiss={handleDismissFillDialog}
   />
 </div>
);
};

export default ScheduleTabContent;