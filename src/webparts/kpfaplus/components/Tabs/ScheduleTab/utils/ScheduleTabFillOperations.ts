// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/ScheduleTabFillOperations.ts

import { MessageBarType } from '@fluentui/react';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { IStaffRecord } from '../../../../services/StaffRecordsService';
import { IContract } from '../../../../models/IContract';
import { IHoliday } from '../../../../services/HolidaysService';
import { ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IDayHours, WeeklyTimeTableUtils } from '../../../../models/IWeeklyTimeTable';
import { WeeklyTimeTableService } from '../../../../services/WeeklyTimeTableService';

/**
 * Interface for fill operation parameters
 */
export interface IFillOperationParams {
  selectedDate: Date;
  selectedStaffId?: string;
  employeeId: string;
  selectedContract: IContract | undefined;
  selectedContractId: string | undefined;
  holidays: IHoliday[];
  leaves: ILeaveDay[];
  currentUserId?: string;
  managingGroupId?: string;
  dayOfStartWeek?: number;
  context?: WebPartContext;
}

/**
 * Interface for operation handlers and callbacks
 */
export interface IFillOperationHandlers {
  createStaffRecord: (createData: Partial<IStaffRecord>, currentUserId?: string, staffGroupId?: string, staffMemberId?: string) => Promise<string | undefined>;
  setOperationMessage: (message: { text: string; type: MessageBarType } | undefined) => void;
  setIsSaving: (isSaving: boolean) => void;
  onRefreshData?: () => void;
}

/**
 * Main function for filling schedule based on templates
 * @param params Parameters for the operation
 * @param handlers Handlers and callbacks for the operation
 */
export const fillScheduleFromTemplate = async (
  params: IFillOperationParams,
  handlers: IFillOperationHandlers
): Promise<void> => {
  const { 
    selectedDate, employeeId, 
    selectedContract, selectedContractId, 
    holidays, leaves, currentUserId, managingGroupId, dayOfStartWeek = 7,
    context
  } = params;
  
  const { createStaffRecord, setOperationMessage, setIsSaving, onRefreshData } = handlers;

  // Preliminary data validation
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

  // Set loading state
  setIsSaving(true);

  try {
    // Define month start and end for selected date
    const startOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const endOfMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
    
    console.log(`[ScheduleTabFillOperations] Month period: ${startOfMonth.toISOString()} - ${endOfMonth.toISOString()}`);
    
    // Adjust dates based on contract dates
    const contractStartDate = selectedContract.startDate;
    const contractFinishDate = selectedContract.finishDate;
    
    // Determine actual start and end dates for generation
    const firstDay = contractStartDate && contractStartDate > startOfMonth 
      ? new Date(contractStartDate) 
      : new Date(startOfMonth);
    
    const lastDay = contractFinishDate && contractFinishDate < endOfMonth 
      ? new Date(contractFinishDate) 
      : new Date(endOfMonth);
    
    console.log(`[ScheduleTabFillOperations] Adjusted period: ${firstDay.toISOString()} - ${lastDay.toISOString()}`);
    
    // Prepare collection for generated records
    const generatedRecords: Partial<IStaffRecord>[] = [];
    
    // Fetch weekly schedule templates
    try {
      const weeklyTimeService = new WeeklyTimeTableService(context);
      
      // Request templates from service
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
      
      // Format raw data for use
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
      
      // Filter deleted templates
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
      
      // Determine number of distinct weekly templates
      const distinctWeeks = new Set(activeTemplates.map(template => template.NumberOfWeek || 1));
      const numberOfWeekTemplates = distinctWeeks.size || 1;
      
      console.log(`[ScheduleTabFillOperations] Number of week templates: ${numberOfWeekTemplates}`);
      
      // Process all days in selected period
      const dayCount = Math.ceil((lastDay.getTime() - firstDay.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      console.log(`[ScheduleTabFillOperations] Processing ${dayCount} days`);
      
      for (let i = 0; i < dayCount; i++) {
        // Current day
        const currentDate = new Date(firstDay);
        currentDate.setDate(firstDay.getDate() + i);
        
        // Determine day of week (0-6, where 0 is Sunday)
        const dayIndex = currentDate.getDay();
        const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayIndex];
        
        // Calculate week number for template determination
        const dayOfMonth = currentDate.getDate();
        const calculatedWeekNumber = Math.floor((dayOfMonth - 1) / 7) + 1;
        
        // Determine applied week number based on number of templates
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
        
        // Filter templates for current day and applied week
        const dayTemplates = activeTemplates.filter(template => 
          (template.NumberOfWeek === appliedWeekNumber || template.numberOfWeek === appliedWeekNumber)
        );
        
        // Check if day is a holiday
        const isHoliday = holidays.some(holiday => {
          const holidayDate = new Date(holiday.date);
          return holidayDate.getDate() === currentDate.getDate() && 
                 holidayDate.getMonth() === currentDate.getMonth() && 
                 holidayDate.getFullYear() === currentDate.getFullYear();
        });
        
        // Check if employee is on leave for this day
        const leaveForDay = leaves.find(leave => {
          const leaveStartDate = new Date(leave.startDate);
          const leaveEndDate = leave.endDate ? new Date(leave.endDate) : new Date(2099, 11, 31); // Far future date for open leaves
          
          return currentDate >= leaveStartDate && currentDate <= leaveEndDate;
        });
        
        // For each template on this day, create a record
        for (const template of dayTemplates) {
          // Get start and end times for current day of week
          let startTime: IDayHours | undefined;
          let endTime: IDayHours | undefined;
          
          // Determine start and end times based on day of week
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
          
          // If no schedule for current day of week, skip
          if (!startTime || !endTime) {
            continue;
          }
          
          // Convert times to Date objects
          const shiftDate1 = createDateWithTime(currentDate, startTime);
          const shiftDate2 = createDateWithTime(currentDate, endTime);
          
          // Create record object
          const recordData: Partial<IStaffRecord> = {
            Title: `Template=${selectedContractId} Week=${appliedWeekNumber} Shift=${template.NumberOfShift || template.shiftNumber || 1}`,
            Date: new Date(currentDate),
            ShiftDate1: shiftDate1,
            ShiftDate2: shiftDate2,
            TimeForLunch: parseInt(template.lunch || '30', 10),
            Contract: parseInt(template.total || '1', 10),
            Holiday: isHoliday ? 1 : 0,
            WeeklyTimeTableID: selectedContractId,
            WeeklyTimeTableTitle: selectedContract.template || '',
            // Add these fields
  //StaffMemberID: employeeId,          // ID for the Staff Member
  //ManagerID: currentUserId,           // ID for the Manager
 // StaffGroupID: managingGroupId       // ID for the Staff Group
          };
          
          // If employee is on leave, add leave type
          if (leaveForDay) {
            recordData.TypeOfLeaveID = leaveForDay.typeOfLeave.toString();
          }
          
          // Add record to collection
          generatedRecords.push(recordData);
        }
      }
      
      console.log(`[ScheduleTabFillOperations] Generated ${generatedRecords.length} records`);
      
      // If no records generated, show error
      if (generatedRecords.length === 0) {
        setOperationMessage({
          text: 'No records generated. Please check the contract and weekly templates.',
          type: MessageBarType.warning
        });
        setIsSaving(false);
        return;
      }
      
      // Data validation for IDs before proceeding
      if (!employeeId || employeeId === '0' || employeeId === '') {
        console.error(`[ScheduleTabFillOperations] Missing or invalid employeeId: ${employeeId}`);
      }
      
      if (!currentUserId || currentUserId === '0' || currentUserId === '') {
        console.error(`[ScheduleTabFillOperations] Missing or invalid currentUserId: ${currentUserId}`);
      }
      
      if (!managingGroupId || managingGroupId === '0' || managingGroupId === '') {
        console.error(`[ScheduleTabFillOperations] Missing or invalid managingGroupId: ${managingGroupId}`);
      }
      
      // Log the IDs being passed before creation
      console.log(`[ScheduleTabFillOperations] Will create records with these IDs:
        staffMemberId=${employeeId} (${typeof employeeId})
        currentUserId=${currentUserId || 'N/A'} (${typeof currentUserId})
        staffGroupId=${managingGroupId || 'N/A'} (${typeof managingGroupId})
      `);
      
      // Save generated records
      let successCount = 0;
      const failedRecords: string[] = [];
      
      // Save records sequentially
      for (const record of generatedRecords) {
        try {
          // Call create method with explicit ID passing
          const newRecordId = await createStaffRecord(
            record,
            currentUserId,      // Manager ID
            managingGroupId,    // Staff Group ID
            employeeId          // Employee ID
          );
          
          if (newRecordId) {
            successCount++;
            console.log(`[ScheduleTabFillOperations] Successfully created record with ID: ${newRecordId}`);
          } else {
            failedRecords.push(record.Title || 'Unknown');
            console.error(`[ScheduleTabFillOperations] Failed to create record: ${record.Title}`);
          }
        } catch (error) {
          console.error(`[ScheduleTabFillOperations] Error creating record:`, error);
          failedRecords.push(record.Title || 'Unknown');
        }
      }
      
      // Show result message
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
      
      // Refresh data in UI
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
 * Function to create confirmation dialog for schedule fill
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
    // If there are existing records, show warning
    return {
      isOpen: true,
      title: 'Confirm Fill Operation',
      message: 'There are existing records in the schedule. Filling the schedule will add new records based on templates. Do you want to continue?',
      confirmButtonText: 'Continue',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#d83b01' // Orange color for warning
    };
  } else {
    // If no records, show simple confirmation
    return {
      isOpen: true,
      title: 'Fill Schedule',
      message: 'Do you want to fill the schedule based on template data?',
      confirmButtonText: 'Fill',
      cancelButtonText: 'Cancel',
      onConfirm,
      confirmButtonColor: '#107c10' // Green color for confirmation
    };
  }
};

/**
 * Helper function to create Date object with specified time
 * @param baseDate Base date
 * @param time Object with hours and minutes
 * @returns Date object with set time
 */
function createDateWithTime(baseDate: Date, time: IDayHours): Date {
  const result = new Date(baseDate);
  
  try {
    // Get hours and minutes
    const hours = parseInt(time.hours, 10);
    const minutes = parseInt(time.minutes, 10);
    
    if (isNaN(hours) || isNaN(minutes)) {
      // If parsing failed, set 00:00
      result.setHours(0, 0, 0, 0);
    } else {
      // Set specified time
      result.setHours(hours, minutes, 0, 0);
    }
  } catch (error) {
    console.error(`[ScheduleTabFillOperations] Error parsing time:`, error);
    // In case of error, set 00:00
    result.setHours(0, 0, 0, 0);
  }
  
  return result;
}