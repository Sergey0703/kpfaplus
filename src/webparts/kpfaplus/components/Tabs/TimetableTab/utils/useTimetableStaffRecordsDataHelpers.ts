// src/webparts/kpfaplus/components/Tabs/TimetableTab/utils/useTimetableStaffRecordsDataHelpers.ts

import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { 
  IWeekInfo, 
  IWeekGroup,
  IStaffMember,
  TIMETABLE_COLORS
} from '../interfaces/TimetableInterfaces';
import { TimetableDataProcessor } from './TimetableDataProcessor';
import { TimetableWeekCalculator } from './TimetableWeekCalculator';

export const processAndSetResults = async (
  allRecords: IStaffRecord[], 
  activeStaffMembers: IStaffMember[], 
  weeks: IWeekInfo[],
  strategy: string,
  selectedDate: Date,
  setStaffRecords: (records: IStaffRecord[]) => void,
  setWeeksData: (weeksData: IWeekGroup[]) => void,
  getLeaveTypeColor?: (typeOfLeaveId: string) => string | undefined
): Promise<void> => {
  const activeEmployeeIds = new Set(
    activeStaffMembers
      .map(staff => staff.employeeId?.toString())
      .filter(id => id && id !== '0')
  );

  // Basic data analysis
  const recordsByStaffId: Record<string, number> = {};
  const recordsByDate: Record<string, number> = {};
  const uniqueStaffIdsInRecords = new Set<string>();
  
  allRecords.forEach(record => {
    const staffId = record.StaffMemberLookupId?.toString() || 'Unknown';
    const dateStr = record.Date.toLocaleDateString();
    
    recordsByStaffId[staffId] = (recordsByStaffId[staffId] || 0) + 1;
    recordsByDate[dateStr] = (recordsByDate[dateStr] || 0) + 1;
    uniqueStaffIdsInRecords.add(staffId);
  });

  // Date range validation
  const startDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const endDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);

  const recordsOutsideRange = allRecords.filter(record => {
    const recordDate = new Date(record.Date);
    return recordDate < startDate || recordDate > endDate;
  });

  if (recordsOutsideRange.length > 0) {
    console.warn(`[processAndSetResults] ${recordsOutsideRange.length} records outside expected range`);
  }

  // Week distribution analysis
  const weekDistribution: Record<number, number> = {};
  
  allRecords.forEach(record => {
    const recordDate = new Date(record.Date);
    const matchingWeek = weeks.find(week => 
      TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
    );
    
    if (matchingWeek) {
      weekDistribution[matchingWeek.weekNum] = (weekDistribution[matchingWeek.weekNum] || 0) + 1;
    }
  });
  
  const singleWeekConcentration = Object.keys(weekDistribution).length === 1 && weekDistribution[1];
  if (singleWeekConcentration) {
    console.error('[processAndSetResults] All records concentrated in Week 1 - check server-side filtering');
  }

  // Filter records by active staff
  const filteredRecords = allRecords.filter(record => {
    const recordStaffMemberId = record.StaffMemberLookupId?.toString();
    return recordStaffMemberId && activeEmployeeIds.has(recordStaffMemberId);
  });

  // Final week distribution check
  const recordsByWeek: Record<number, number> = {};
  
  filteredRecords.forEach(record => {
    const recordDate = new Date(record.Date);
    const matchingWeek = weeks.find(week => 
      TimetableWeekCalculator.isDateInWeek(recordDate, week.weekStart, week.weekEnd)
    );
    
    if (matchingWeek) {
      recordsByWeek[matchingWeek.weekNum] = (recordsByWeek[matchingWeek.weekNum] || 0) + 1;
    } else {
      console.warn(`[processAndSetResults] Record ${record.ID} does not match any week`);
    }
  });

  setStaffRecords(filteredRecords);

  const weeksData = TimetableDataProcessor.processDataByWeeks({
    staffRecords: filteredRecords,
    staffMembers: activeStaffMembers,
    weeks: weeks,
    currentUserId: undefined,
    managingGroupId: undefined,
    getLeaveTypeColor,
    holidayColor: TIMETABLE_COLORS.HOLIDAY
  });

  // Performance summary
  const weeksWithData = weeksData.filter(week => week.hasData).length;
  
  console.log(`[processAndSetResults] Processed ${weeksData.length} weeks, ${weeksWithData} with data using ${strategy}`);

  setWeeksData(weeksData);

  if (filteredRecords.length === 0 && activeStaffMembers.length > 0) {
    console.warn('[processAndSetResults] No records found for any active staff members');
  } else if (weeksWithData <= 1 && filteredRecords.length > 10) {
    console.warn('[processAndSetResults] Data concentrated in single week despite new strategy');
  }
};