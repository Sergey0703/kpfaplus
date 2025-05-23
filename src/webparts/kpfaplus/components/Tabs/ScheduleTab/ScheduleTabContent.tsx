// src/webparts/kpfaplus/components/Tabs/ScheduleTab/ScheduleTabContent.tsx
import * as React from 'react';
import { useState, useCallback, useMemo } from 'react'; // Import useMemo
import { WebPartContext } from '@microsoft/sp-webpart-base';
import {
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  IDropdownOption, // Используется в типе IFilterControlsProps и IScheduleOptions
  DefaultButton // Используется в JSX
} from '@fluentui/react';
// Импорты типов (удалены неиспользуемые импорты из предыдущего анализа)
import { ITabProps } from '../../../models/types'; // Используется для типа selectedStaff
import { IContract } from '../../../models/IContract'; // Используется для типа contracts, selectedContract
import { IHoliday } from '../../../services/HolidaysService'; // Используется для типа holidays
import { ILeaveDay } from '../../../services/DaysOfLeavesService'; // Используется для типа leaves
import { ITypeOfLeave } from '../../../services/TypeOfLeaveService'; // Используется для типа typesOfLeave
// IStaffRecord, INewShiftData, IExistingRecordCheck используются в типах пропсов или локально, оставляем импорт
import { IStaffRecord } from '../../../services/StaffRecordsService'; // <-- Оставить
import { INewShiftData } from './components/ScheduleTable'; // <-- Оставить
import { IExistingRecordCheck } from './utils/ScheduleTabFillInterfaces'; // <-- Оставить
import styles from './ScheduleTab.module.scss';

// Импорт компонентов (FilterControls, DayInfo, ScheduleTable, ScheduleTableDialogs)
import { FilterControls } from './components/FilterControls'; // <-- Оставить
import { DayInfo } from './components/DayInfo'; // <-- Оставить
// Импорт ScheduleTable и его типов IScheduleItem, IScheduleOptions
import ScheduleTable, { IScheduleItem, IScheduleOptions } from './components/ScheduleTable'; // <-- Оставить
import { ScheduleTableDialogs } from './components/ScheduleTableDialogs'; // <-- Оставить

// Импорт вспомогательных функций из выделенных файлов
import { convertStaffRecordsToScheduleItems } from './utils/ScheduleTabDataUtils'; // <-- Оставить
// Импорт хендлеров действий и их параметров IActionHandlerParams
// handleAddShift, handleDeleteItem, handleRestoreItem вызываются через пропсы, поэтому их импорт здесь из utils не нужен
import {
  handleSaveAllChanges, // <-- Оставить, так как handleSaveAllChanges вызывается локально
  IActionHandlerParams // <-- Оставить
} from './utils/ScheduleTabActionHandlers';
// Импорт функции заполнения
import {
  fillScheduleFromTemplate // <-- Оставить
} from './utils/ScheduleTabFillService';

// Интерфейсы для типизации сервисов (используются в DayInfo)
// Оставляем эти интерфейсы, так как они используются локально для типизации пропсов сервисов
interface IHolidaysService {
  isHoliday: (date: Date, holidays: IHoliday[]) => boolean;
  getHolidayInfo: (date: Date, holidays: IHoliday[]) => IHoliday | undefined;
}

interface IDaysOfLeavesService {
  isDateOnLeave: (date: Date, leaves: ILeaveDay[]) => boolean;
  getLeaveForDate: (date: Date, leaves: ILeaveDay[]) => ILeaveDay | undefined;
}

interface ITypeOfLeaveService {
  getAllTypesOfLeave: (forceRefresh?: boolean) => Promise<ITypeOfLeave[]>;
  getTypeOfLeaveById: (id: string | number) => Promise<ITypeOfLeave | undefined>;
}

// Импорт IScheduleTabState из useScheduleTabState
import { IScheduleTabState } from './utils/useScheduleTabState';
// Импорт UseScheduleTabLogicReturn из useScheduleTabLogic
// ИСПРАВЛЕНИЕ ИМПОРТА: Убедитесь, что UseScheduleTabLogicReturn экспортируется И путь правильный
import { UseScheduleTabLogicReturn } from './utils/useScheduleTabLogic'; // <-- ИСПРАВЛЕННЫЙ ИМПОРТ


// --- ОБНОВЛЕННЫЙ ИНТЕРФЕЙС СВОЙСТВ КОМПОНЕНТА ScheduleTabContent ---
// Расширяем IScheduleTabState и добавляем все обработчики и другие необходимые пропсы из UseScheduleTabLogicReturn
export interface IScheduleTabContentProps extends IScheduleTabState {
  // Оригинальные пропсы из ITabProps, которые не входили в IScheduleTabState
  // selectedStaff, context, currentUserId, managingGroupId приходят от родителя ScheduleTab
  selectedStaff: ITabProps['selectedStaff'];
  context?: WebPartContext;
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number; // Это свойство было в ITabProps в вашем types.ts

  // Все обработчики из UseScheduleTabLogicReturn
  onDateChange: UseScheduleTabLogicReturn['onDateChange'];
  onContractChange: UseScheduleTabLogicReturn['onContractChange'];
  onErrorDismiss: UseScheduleTabLogicReturn['onErrorDismiss'];
  onRefreshData: UseScheduleTabLogicReturn['onRefreshData'];

  // Обработчики пагинации ИЗ UseScheduleTabLogicReturn
  onPageChange: UseScheduleTabLogicReturn['onPageChange']; // <-- Обработчик пагинации
  onItemsPerPageChange: UseScheduleTabLogicReturn['onItemsPerPageChange']; // <-- Обработчик смены количества элементов на странице

  // Обработчики/геттеры из специализированных хуков (передаваемые через оркестратор)
  getExistingRecordsWithStatus: UseScheduleTabLogicReturn['getExistingRecordsWithStatus'];
  markRecordsAsDeleted: UseScheduleTabLogicReturn['markRecordsAsDeleted'];
  onAddShift: UseScheduleTabLogicReturn['onAddShift'];
  onUpdateStaffRecord: UseScheduleTabLogicReturn['onUpdateStaffRecord'];
  onDeleteStaffRecord: UseScheduleTabLogicReturn['onDeleteStaffRecord'];
  onRestoreStaffRecord: UseScheduleTabLogicReturn['onRestoreStaffRecord'];

  // Сервисы, которые все еще используются в DayInfo (передаются из ScheduleTab)
  holidaysService?: IHolidaysService;
  daysOfLeavesService?: IDaysOfLeavesService;
  typeOfLeaveService?: ITypeOfLeaveService; // <-- Используется в DayInfo

  // Пропс showDeleted теперь приходит из оркестратора, а не управляется локально
  showDeleted: boolean; // <-- showDeleted state from оркестратор
  onToggleShowDeleted: UseScheduleTabLogicReturn['onToggleShowDeleted']; // <-- onToggleShowDeleted handler from оркестратор
}
// ------------------------------------------------------------------------

// Тип диалога подтверждения
enum DialogType {
  None = 'none',
  EmptySchedule = 'empty',
  ProcessedRecordsBlock = 'processed_block',
  UnprocessedRecordsReplace = 'unprocessed_replace'
}

// Интерфейс для конфигурации диалога
interface IDialogConfig {
  type: DialogType;
  isOpen: boolean;
  title: string;
  message: string;
  confirmButtonText: string;
  cancelButtonText: string; // <-- ИСПРАВЛЕНО: Используем consistent name
  confirmButtonColor: string;
  onConfirm: () => void;
}

/**
 * Основной компонент содержимого вкладки Schedule
 */
export const ScheduleTabContent: React.FC<IScheduleTabContentProps> = (props) => {
  // Извлекаем все пропсы, включая новые пропсы пагинации и showDeleted.
  // Удалены неиспользуемые пропсы.
  const {
    selectedStaff,
    selectedDate,
    contracts,
    selectedContractId,
    isLoading, // Общая загрузка
    error, // Общая ошибка
    holidays,
    isLoadingHolidays, // <-- Удален из использования в JSX и props
    leaves,
    isLoadingLeaves, // <-- Удален из использования в JSX и props
    typesOfLeave,
    isLoadingTypesOfLeave, // <-- Удален из использования в JSX и props
    holidaysService, // Services are passed here
    daysOfLeavesService, // Services are passed here
    typeOfLeaveService, // Services are passed here
    onDateChange,
    onContractChange, // <-- Используем имя пропса
    onErrorDismiss,
    staffRecords, // Records for the current page
    isLoadingStaffRecords, // Loading specific to staff records fetch
    errorStaffRecords, // Error specific to staff records fetch
    currentPage, // <-- Pagination state prop
    itemsPerPage, // <-- Pagination state prop
    totalItemCount, // <-- Pagination state prop
    onPageChange, // <-- Pagination handler prop
    onItemsPerPageChange, // <-- Pagination handler prop
    onUpdateStaffRecord, // <-- Handler from оркестратор
    onCreateStaffRecord, // <-- Handler from оркестратор
    onDeleteStaffRecord, // <-- Handler from оркестратор
    onRestoreStaffRecord, // <-- Handler from оркестратор
    onRefreshData, // <-- Handler from оркестратор
    onAddShift, // <-- Handler from оркестратор
    dayOfStartWeek,
    context,
    currentUserId,
    managingGroupId,
    getExistingRecordsWithStatus, // <-- Handler from оркестратор
    markRecordsAsDeleted, // <-- Handler from оркестратор
    showDeleted, // <-- showDeleted state from оркестратор
    onToggleShowDeleted, // <-- onToggleShowDeleted handler from оркестратор
  } = props;

  // Находим выбранный контракт
  const selectedContract = contracts.find(c => c.id === selectedContractId);

  // Состояния компонента (локальные UI состояния)
  // УДАЛЯЕМ локальное состояние showDeleted
  const [modifiedRecords, setModifiedRecords] = useState<Record<string, IScheduleItem>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false); // Локальное состояние сохранения для индикатора
  const [operationMessage, setOperationMessage] = useState<{
    text: string;
    type: MessageBarType;
  } | undefined>(undefined);

  // Состояние для управления диалогом подтверждения Fill
  const [fillDialogConfig, setFillDialogConfig] = useState<IDialogConfig>({
    type: DialogType.None,
    isOpen: false,
    title: '',
    message: '',
    confirmButtonText: '',
    cancelButtonText: 'Cancel', // <-- ИСПРАВЛЕНО: Используем consistent name
    confirmButtonColor: '',
    onConfirm: () => {}
  });

  // Эффект для очистки модифицированных записей при изменении выбранного контракта, даты или сотрудника
  React.useEffect(() => {
    console.log('[ScheduleTabContent] Clearing modified records due to date, contract, or staff change');
    setModifiedRecords({});
    // Сбрасываем операционное сообщение при смене фильтров/сотрудника
     setOperationMessage(undefined);
  }, [selectedDate, selectedContractId, selectedStaff?.id]);


  // Получаем список элементов для таблицы, включая локальные изменения
  // Этот useCallback теперь работает с staffRecords, который уже является данными для текущей страницы
  const getScheduleItemsWithModifications = useCallback((): IScheduleItem[] => {
    // staffRecords может быть undefined, если данные еще не загружены или произошла ошибка
    const baseItems = convertStaffRecordsToScheduleItems(staffRecords || [], selectedContract); // Добавляем проверку staffRecords

    // Применяем локальные изменения только к элементам на текущей странице
    return baseItems.map(item => {
      // Проверяем наличие модифицированной версии в локальном состоянии
      if (modifiedRecords[item.id]) {
        // Возвращаем объект, который является слиянием исходного элемента и его локальных изменений
        // Это важно, чтобы сохранить базовые свойства (deleted, Holiday, etc.) из исходного items
        return {
          ...item, // Исходный элемент с текущей страницы
          ...modifiedRecords[item.id] // Применяем локальные изменения
        };
      }
      return item; // Если нет локальных изменений, возвращаем исходный элемент
    });
  }, [staffRecords, modifiedRecords, selectedContract]); // Зависит от staffRecords (данные страницы), modifiedRecords (локал.изменения), selectedContract


  // Общие параметры для обработчиков действий
  // Используем useCallback для стабильности actionHandlerParams
  const actionHandlerParams: IActionHandlerParams = useMemo(() => ({
    setIsSaving, // Локальный сеттер сохранения
    setOperationMessage, // Локальный сеттер сообщений
    setModifiedRecords, // Локальный сеттер модифицированных записей
    onRefreshData // Хендлер обновления из оркестратора
  }), [setIsSaving, setOperationMessage, setModifiedRecords, onRefreshData]); // Зависимости для useMemo


  // ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ для выполнения заполнения
  const performFillOperation = async (): Promise<void> => {
    console.log('[ScheduleTabContent] performFillOperation called');

    // Проверяем наличие обязательных данных и функций
    // Проверка наличия onCreateStaffRecord, getExistingRecordsWithStatus, markRecordsAsDeleted
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
      selectedStaffId: selectedStaff.id, // Используем id сотрудника
      employeeId: selectedStaff.employeeId, // Используем employeeId сотрудника
      selectedContract,
      selectedContractId,
      holidays, // Праздники за месяц
      leaves, // Отпуска за месяц
      currentUserId,
      managingGroupId,
      dayOfStartWeek,
      context // Контекст
    };

    // Передаем необходимые хендлеры для логики заполнения
    const fillHandlers = {
      createStaffRecord: onCreateStaffRecord, // Функция создания записи (из mutation hook)
      setOperationMessage, // Установить сообщение (локальное UI состояние)
      setIsSaving, // Установить состояние сохранения (локальное UI состояние)
      onRefreshData, // Запросить обновление данных (триггер из оркестратора)
      getExistingRecordsWithStatus: getExistingRecordsWithStatus, // Получить статус существующих записей (из data hook)
      markRecordsAsDeleted: markRecordsAsDeleted // Пометить записи как удаленные (из data hook)
    };

    console.log('[ScheduleTabContent] Calling fillScheduleFromTemplate');

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

  // НОВАЯ ФУНКЦИЯ: Определение типа диалога на основе существующих записей
  const determineDialogType = async (): Promise<IDialogConfig> => {
    console.log('[ScheduleTabContent] determineDialogType called');

    // Объявляем existingRecords вне try для использования в catch
    let existingRecords: IExistingRecordCheck[] = []; // <-- Объявлена вне try

    // Проверяем наличие обязательных данных и функций
    // Проверка наличия getExistingRecordsWithStatus, markRecordsAsDeleted
    if (!selectedStaff?.employeeId || !selectedContract || !selectedContractId || !getExistingRecordsWithStatus || !markRecordsAsDeleted) {
      console.error('[ScheduleTabContent] Missing required data/functions for dialog determination');
      // Возвращаем конфигурацию ошибки
      return {
        type: DialogType.None, isOpen: true, title: 'Error',
        message: 'Cannot check existing records: Missing staff, contract information, or required functions.',
        confirmButtonText: 'OK', cancelButtonText: '', confirmButtonColor: '#d83b01',
        onConfirm: () => setFillDialogConfig(prev => ({ ...prev, isOpen: false })) // Просто закрыть диалог
      } as IDialogConfig;
    }

    try {
      // Определяем период для проверки (весь месяц или период контракта в месяце)
      const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
      const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

      const contractStartDate = selectedContract.startDate ? new Date(selectedContract.startDate) : null;
      const contractFinishDate = selectedContract.finishDate ? new Date(selectedContract.finishDate) : null;

      // Определяем фактический период для проверки (пересечение месяца и контракта)
      // Используем безопасный доступ ?.getTime() и проверяем на isNaN, так как даты могут быть некорректны
      const firstDay = contractStartDate && !isNaN(contractStartDate.getTime()) && contractStartDate > startOfMonth
        ? contractStartDate
        : startOfMonth;

      const lastDay = contractFinishDate && !isNaN(contractFinishDate.getTime()) && contractFinishDate < endOfMonth
        ? contractFinishDate
        : endOfMonth;

      // Проверяем, что конечная дата не раньше начальной
      // Используем безопасный доступ ?.getTime() при сравнении. Проверка на null уже сделана выше.
      // ИСПРАВЛЕНИЕ: Проверка instanceof Date не нужна, так как мы уже проверили isNaN и сравниваем через getTime()
      if (firstDay && lastDay && firstDay.getTime() > lastDay.getTime()) { // <-- Исправлено: прямое сравнение Date может быть некорректно, используем getTime()
           console.log('[ScheduleTabContent] Contract period does not overlap with the month, or dates are invalid.');
           // Показываем диалог "пустого расписания", т.к. записей не должно быть
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


      console.log('[ScheduleTabContent] Checking for existing records in period:', {
        firstDay: firstDay?.toISOString(), // Добавлена безопасная навигация
        lastDay: lastDay?.toISOString(),   // Добавлена безопасная навигация
        employeeId: selectedStaff.employeeId,
        currentUserId,
        managingGroupId
      });

      // Получаем существующие записи за период (через getExistingRecordsWithStatus из data hook)
      // existingRecords объявлена вне try
      existingRecords = await getExistingRecordsWithStatus(
        firstDay || selectedDate, // Передаем date, если firstDay null (хотя по логике не должен быть, если месяц валиден)
        lastDay || selectedDate,  // Передаем date, если lastDay null
        selectedStaff.employeeId,
        currentUserId,
        managingGroupId
      );

      console.log(`[ScheduleTabContent] Found ${existingRecords.length} existing records`);

      // СЦЕНАРИЙ 1: Нет существующих записей
      if (existingRecords.length === 0) {
        console.log('[ScheduleTabContent] No existing records - showing empty schedule dialog');
        return {
          type: DialogType.EmptySchedule,
          isOpen: true,
          title: 'Fill Schedule',
          message: 'Do you want to fill the schedule based on template data?',
          confirmButtonText: 'Fill',
          cancelButtonText: 'Cancel',
          confirmButtonColor: '#107c10', // Green
          onConfirm: () => {
            setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
            void performFillOperation(); // Вызываем асинхронную операцию
          }
        };
      }

      // Динамический импорт для уменьшения размера основного чанка
      const { checkRecordsProcessingStatus, createProcessingBlockMessage } = await import(/* webpackChunkName: 'schedule-fill-helpers' */ './utils/ScheduleTabFillHelpers');

      // Анализируем статус обработки существующих записей
      const processingStatus = checkRecordsProcessingStatus(existingRecords);

      console.log('[ScheduleTabContent] Processing status:', {
        totalRecords: processingStatus.totalCount,
        processedRecords: processingStatus.processedCount,
        hasProcessedRecords: processingStatus.hasProcessedRecords
      });

      // СЦЕНАРИЙ 2: Есть обработанные записи - БЛОКИРОВКА
      if (processingStatus.hasProcessedRecords) {
        console.log(`[ScheduleTabContent] BLOCKING: Found ${processingStatus.processedCount} processed records`);

        const blockMessage = createProcessingBlockMessage(processingStatus);
        return {
          type: DialogType.ProcessedRecordsBlock,
          isOpen: true,
          title: 'Cannot Replace Records',
          message: blockMessage.text,
          confirmButtonText: 'OK',
          cancelButtonText: '', // Нет кнопки отмены для блокировки
          confirmButtonColor: '#d83b01', // Red
          onConfirm: () => {
            setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
            // Показываем сообщение об ошибке
            setOperationMessage(blockMessage);
          }
        };
      }

      // СЦЕНАРИЙ 3: Все записи не обработаны - ЗАМЕНА
      console.log(`[ScheduleTabContent] All ${existingRecords.length} records are unprocessed - showing replacement dialog`);

      return {
        type: DialogType.UnprocessedRecordsReplace,
        isOpen: true,
        title: 'Replace Schedule Records',
        message: `Found ${existingRecords.length} existing unprocessed records for this period. Replace them with new records from template?`,
        confirmButtonText: 'Replace',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#d83b01', // Orange/Red for warning
        onConfirm: () => {
          console.log('[ScheduleTabContent] User confirmed replacement - proceeding with fill');
          setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
          void performFillOperation(); // Вызываем асинхронную операцию
        }
      };

    } catch (error) {
      console.error('[ScheduleTabContent] Error during dialog type determination:', error);
       const errorMessage = error instanceof Error ? error.message : String(error);
      // Используем existingRecords.length, даже если произошла ошибка в процессе определения статуса
       const itemCount = existingRecords ? existingRecords.length : 0; // existingRecords может быть [] при ошибке

      return {
        type: DialogType.None,
        isOpen: true,
        title: 'Error',
        message: `Error checking existing records (${itemCount} found before error): ${errorMessage}`,
        confirmButtonText: 'OK',
        cancelButtonText: '',
        confirmButtonColor: '#d83b01', // Red
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

  // НОВАЯ ФУНКЦИЯ: Обработчик кнопки Fill с правильной логикой диалогов
  const handleFillButtonClick = async (): Promise<void> => {
    console.log('[ScheduleTabContent] Fill button clicked - starting dialog determination');

    // Проверяем, что необходимые функции для Fill доступны
    // Проверка наличия onCreateStaffRecord, getExistingRecordsWithStatus, markRecordsAsDeleted
    if (!onCreateStaffRecord || !getExistingRecordsWithStatus || !markRecordsAsDeleted) {
         console.error('[ScheduleTabContent] Fill prerequisites missing.');
         setOperationMessage({
              text: 'Fill operation is not fully available (missing required functions).',
              type: MessageBarType.error
         });
         return;
    }

    try {
      setIsSaving(true); // Показываем спиннер/индикатор сохранения (для определения диалога)
      setOperationMessage(undefined); // Очищаем предыдущие сообщения
      setFillDialogConfig(prev => ({ ...prev, isOpen: false })); // Убедимся, что предыдущий диалог закрыт

      // Определяем тип диалога
      const dialogConfig = await determineDialogType();

      // Устанавливаем конфигурацию диалога и открываем диалог
      setFillDialogConfig(dialogConfig);

    } catch (error) {
      console.error('[ScheduleTabContent] Error in handleFillButtonClick:', error);
      setOperationMessage({
        text: `Error preparing fill operation: ${error instanceof Error ? error.message : String(error)}`,
        type: MessageBarType.error
      });
    } finally {
      // Скрываем спиннер/индикатор сохранения после определения диалога
      // Спиннер для самой fillOperation будет установлен внутри performFillOperation через fillHandlers.
       setIsSaving(false);
    }
  };


  // Обработчик для закрытия диалога Fill
  const handleDismissFillDialog = (): void => {
    setFillDialogConfig(prev => ({ ...prev, isOpen: false }));
  };

  // Обработчик для сохранения всех изменений
  const saveAllChanges = async (): Promise<void> => {
    console.log('[ScheduleTabContent] saveAllChanges called');
    // Проверяем наличие функции обновления
    // Проверка наличия onUpdateStaffRecord
    if (!onUpdateStaffRecord) {
      setOperationMessage({
        text: 'Unable to save changes: Update function not available',
        type: MessageBarType.error
      });
      return;
    }
     // Проверяем, есть ли вообще модифицированные записи
     if (Object.keys(modifiedRecords).length === 0) {
          console.log('[ScheduleTabContent] No modified records to save.');
          setOperationMessage({
              text: 'No changes to save.',
              type: MessageBarType.info
          });
          return;
     }

    // Вызываем хендлер сохранения из utils
    void handleSaveAllChanges(modifiedRecords, onUpdateStaffRecord, actionHandlerParams);
     // Логика внутри handleSaveAllChanges установит isSaving, operationMessage и вызовет onRefreshData
     // после завершения. modifiedRecords будут очищены после успешного сохранения и обновления данных.
  };


  // Обработчик для изменения элемента расписания в таблице
  const handleItemChange = useCallback((item: IScheduleItem, field: string, value: string | number): void => {
    console.log(`[ScheduleTabContent] handleItemChange called for item ${item.id}, field: ${field}, value: ${value}`);

    // Добавляем или обновляем запись в локальном состоянии модифицированных
    setModifiedRecords(prev => {

        // Находим оригинальный элемент в текущих данных страницы, если он есть
        // staffRecords может быть undefined
        const originalRecord = staffRecords?.find(sr => sr.ID === item.id);

        // Конвертируем оригинальный IStaffRecord в IScheduleItem если найден.
        // Если не найден (например, новый элемент, созданный локально), используем переданный item.
        // convertStaffRecordsToScheduleItems ожидает массив IStaffRecord[] и возвращает IScheduleItem[]
        const baseIScheduleItem = originalRecord ? convertStaffRecordsToScheduleItems([originalRecord], selectedContract)[0] : item;

        // Используем существующую модифицированную версию ИЛИ базовый IScheduleItem
        const currentLocalItem = prev[item.id] || baseIScheduleItem;


        // Ensure field value is correctly typed if necessary, e.g., converting number to string for dropdown keys
        let updatedValue: any = value; // Use any temporarily
        if (field === 'typeOfLeave') {
             updatedValue = String(value); // Ensure typeOfLeave is string ID
        } else if (field === 'contractNumber') {
             updatedValue = String(value); // Ensure contractNumber is string
        } else if (field === 'date') { // Handle date changes if needed (though date is usually fixed per row)
             if (value instanceof Date) updatedValue = value;
             else console.warn(`[ScheduleTabContent] Unexpected value type for date field: ${typeof value}`);
        }


       // Apply the change to the current local version
       const updatedItem = {
         ...currentLocalItem, // Start with the most recent version (original IScheduleItem or previous local change)
         [field]: updatedValue,
       };

        // For debugging: log the state update
       console.log('[ScheduleTabContent] Updating modifiedRecords state:', updatedItem);


       return {
         ...prev,
         [item.id]: updatedItem
       };
    });
  }, [staffRecords, selectedContract]); // Зависимости для useCallback


  // Обработчик для переключения отображения удаленных записей
  // Этот хендлер просто вызывает проп из оркестратора.
  // УДАЛЯЕМ локальную функцию handleToggleShowDeleted, так как она дублирует пропс
  // const handleToggleShowDeleted = useCallback((checked: boolean): void => { ... }, [props.onToggleShowDeleted]);


  // Создаем опции для выпадающих списков в таблице
  // Используем useMemo для опций, так как они зависят от typesOfLeave
  const scheduleOptions: IScheduleOptions = useMemo(() => ({
    hours: Array.from({ length: 24 }, (_, i) => ({
      key: i.toString().padStart(2, '0'),
      text: i.toString().padStart(2, '0')
    })),
    minutes: ['00', '15', '30', '45'].map(m => ({ key: m, text: m })),
    lunchTimes: ['0', '15', '30', '45', '60'].map(l => ({ key: l, text: l })),
    // leaveTypes options are derived from typesOfLeave prop
    leaveTypes: [
      { key: '', text: 'None' }, // Option for no leave type
      ...typesOfLeave.map(t => ({ key: t.id, text: t.title }))
    ],
    contractNumbers: [
      { key: '1', text: '1' },
      { key: '2', text: '2' },
      { key: '3', text: '3' }
      // If contract numbers are dynamic, they should come from a prop
    ]
  }), [typesOfLeave]); // Зависит от typesOfLeave


  // Фильтрация записей для отображения на основе showDeleted
  // staffRecords из хука уже содержит записи для текущей страницы.
  // Флаг showDeleted приходит как проп из оркестратора и влияет на фильтрацию на сервере.
  // staffRecords уже должен быть отфильтрован по showDeleted.
  // staffRecords также может быть undefined.
   const itemsForTable = getScheduleItemsWithModifications(); // Вычисляем items для таблицы


  return (
    <div className={styles.scheduleTab}> {/* Используем класс styles.scheduleTab для контейнера */}
      <div className={styles.header}>
        <h2>Schedule for {selectedStaff?.name}</h2>
      </div>

      {/* Отображаем сообщение об ошибке, если есть */}
      {(error || errorStaffRecords) && ( // Показываем общую или специфическую ошибку записей
        <MessageBar
          messageBarType={MessageBarType.error}
          isMultiline={false}
          onDismiss={onErrorDismiss} // onDismiss handles both errors
          dismissButtonAriaLabel="Close"
        >
          {error || errorStaffRecords}
        </MessageBar>
      )}

      {/* Отображаем операционное сообщение, если есть */}
      {operationMessage && (
        <MessageBar
          messageBarType={operationMessage.type}
          isMultiline={false}
          onDismiss={(): void => setOperationMessage(undefined)}
          dismissButtonAriaLabel="Close"
        >
          {operationMessage.text}
        </MessageBar>
      )}

      {/* Фильтры выбора даты и контракта с кнопкой Fill */}
      {/* В FilterControls ПЕРЕДАЕМ isLoadingStaffRecords */}
      <FilterControls
        selectedDate={selectedDate}
        contracts={contracts}
        selectedContractId={selectedContractId}
        isLoading={isLoading || isLoadingStaffRecords || isSaving} // Используем все индикаторы загрузки
        onDateChange={onDateChange}
        onContractChange={onContractChange} // <-- ИСПОЛЬЗУЕМ имя пропса onContractChange
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
                minHeight: '300px', // Minimum height to prevent jumping
                backgroundColor: 'white'
            }}>
              {/* Показываем информацию о дне (праздники, отпуска) */}
              {/* DayInfo зависит от holidaysService, daysOfLeavesService, typesOfLeave, которые приходят как пропсы */}
                 <DayInfo
                   selectedDate={selectedDate}
                   holidays={holidays}
                   leaves={leaves}
                   typesOfLeave={typesOfLeave} // typesOfLeave приходит как пропс
                   holidaysService={holidaysService} // Pass service
                   daysOfLeavesService={daysOfLeavesService} // Pass service
                 />

                <div style={{ padding: '10px' }}>
                  {/* Таблица расписания */}
                  {/* Передаем локальные хендлеры изменений полей и хендлеры диалогов */}
                  {/* onAddShift, onDeleteStaffRecord, onRestoreStaffRecord приходят как пропсы и передаются в ScheduleTable */}
                  <ScheduleTable
                    items={itemsForTable} // Передаем записи для текущей страницы с локальными изменениями
                    options={scheduleOptions} // Options derived from typesOfLeave etc.
                    selectedDate={selectedDate}
                    selectedContract={selectedContract ? { id: selectedContract.id, name: selectedContract.template } : undefined} // Проверка на null selectedContract
                    isLoading={false} // Общий индикатор загрузки уже есть выше. Локальный спиннер в таблице не нужен.
                    showDeleted={showDeleted} // Pass showDeleted state (из оркестратора)
                    onToggleShowDeleted={onToggleShowDeleted} // Pass handler (из оркестратора)
                    onItemChange={handleItemChange} // Pass local item change handler (calls parent's onItemChange)
                    // Action handlers from оркестратор (passed via props) -- ScheduleTableDialogs calls these
                    onAddShift={onAddShift} // Pass parent's onAddShift handler (used in dialog handler)
                    onDeleteItem={onDeleteStaffRecord!} // <-- ИСПОЛЬЗУЕМ имя пропса onDeleteStaffRecord!
                    onRestoreItem={onRestoreStaffRecord} // <-- ИСПОЛЬЗУЕМ имя пропса onRestoreStaffRecord
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
                    // --- ПЕРЕДАЕМ ПРОПСЫ ПАГИНАЦИИ ---
                    currentPage={currentPage} // Pass current page state
                    itemsPerPage={itemsPerPage} // Pass items per page state
                    totalItemCount={totalItemCount} // Pass total item count state
                    onPageChange={onPageChange} // Pass page change handler
                    onItemsPerPageChange={onItemsPerPageChange} // Pass items per page change handler
                    // -----------------------------
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
      {/* ScheduleTableDialogs принимает confirmDialogProps и onDismiss */}
      <ScheduleTableDialogs
        confirmDialogProps={{
          isOpen: fillDialogConfig.isOpen,
          title: fillDialogConfig.title,
          message: fillDialogConfig.message,
          confirmButtonText: fillDialogConfig.confirmButtonText,
          cancelButtonText: fillDialogConfig.cancelButtonText, // <-- ИСПОЛЬЗУЕМ правильное имя поля
          onConfirm: fillDialogConfig.onConfirm,
          confirmButtonColor: fillDialogConfig.confirmButtonColor
        }}
        onDismiss={handleDismissFillDialog} // <-- Локальный обработчик закрытия диалога
      />
    </div>
  );
};

export default ScheduleTabContent;