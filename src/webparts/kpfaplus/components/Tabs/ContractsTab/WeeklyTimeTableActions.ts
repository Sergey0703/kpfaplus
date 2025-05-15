// src/webparts/kpfaplus/components/Tabs/ContractsTab/WeeklyTimeTableActions.ts
// Этот файл теперь будет только реэкспортировать функции из других модулей

// Реэкспорт всех типов из общего файла типов
export { DialogType } from './actions/WeeklyTimeTableTypes';

// Реэкспорт функций для диалогов
export { 
  createShowConfirmDialog,
  createShowDeleteConfirmDialog
} from './actions/WeeklyTimeTableDialogActions';

// Реэкспорт функций для сохранения
export { createSaveHandler } from './actions/WeeklyTimeTableSaveActions';

// Реэкспорт функций для добавления новых элементов
export { 
  createAddShiftHandler, 
  executeAddNewShift, 
  executeAddNewWeek 
} from './actions/WeeklyTimeTableAddActions';

// Реэкспорт функций для удаления элементов
export { createDeleteShiftHandler } from './actions/WeeklyTimeTableDeleteActions';

// Реэкспорт вспомогательных функций
export { logWeeklyTableAnalysis } from './actions/WeeklyTimeTableAnalysisActions';