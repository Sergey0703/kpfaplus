// src/webparts/kpfaplus/components/Tabs/ScheduleTab/utils/useScheduleTabServices.ts

import { WebPartContext } from '@microsoft/sp-webpart-base';
// Corrected import paths
import { HolidaysService } from '../../../../services/HolidaysService';
import { DaysOfLeavesService } from '../../../../services/DaysOfLeavesService';
import { TypeOfLeaveService } from '../../../../services/TypeOfLeaveService';
import { StaffRecordsService } from '../../../../services/StaffRecordsService';
import { useMemo } from 'react';

export interface IScheduleTabServices {
  holidaysService?: HolidaysService;
  daysOfLeavesService?: DaysOfLeavesService;
  typeOfLeaveService?: TypeOfLeaveService;
  staffRecordsService?: StaffRecordsService;
}

export const useScheduleTabServices = (context?: WebPartContext): IScheduleTabServices => {
  const services = useMemo(() => {
    console.log('[useScheduleTabServices] Instantiating services based on context');
    if (!context) {
      console.warn('[useScheduleTabServices] Context is not available, services will be undefined.');
      return {
        holidaysService: undefined,
        daysOfLeavesService: undefined,
        typeOfLeaveService: undefined,
        staffRecordsService: undefined
      };
    }
    return {
      holidaysService: HolidaysService.getInstance(context),
      daysOfLeavesService: DaysOfLeavesService.getInstance(context),
      typeOfLeaveService: TypeOfLeaveService.getInstance(context),
      staffRecordsService: StaffRecordsService.getInstance(context)
    };
  }, [context]);

  return services;
};