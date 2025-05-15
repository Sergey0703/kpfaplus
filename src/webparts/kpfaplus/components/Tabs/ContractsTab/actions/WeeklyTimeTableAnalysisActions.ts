// src/webparts/kpfaplus/components/Tabs/ContractsTab/actions/WeeklyTimeTableAnalysisActions.ts
import { IExtendedWeeklyTimeRow, analyzeWeeklyTableData } from '../WeeklyTimeTableLogic';

/**
 * Вспомогательная функция для логирования анализа таблицы недельного расписания
 */
export const logWeeklyTableAnalysis = (timeTableData: IExtendedWeeklyTimeRow[]): void => {
  const analysisResult = analyzeWeeklyTableData(timeTableData);
  console.log('Week Analysis Result:', analysisResult);
};