// ============================================================================
// 5. src/webparts/kpfaplus/components/Tabs/LeavesTab/utils/useLeavesData.ts
// ============================================================================
import { useState, useCallback } from 'react';
import { TypeOfLeaveService, ITypeOfLeave } from '../../../../services/TypeOfLeaveService';
import { DaysOfLeavesService, ILeaveDay } from '../../../../services/DaysOfLeavesService';
import { IStaffMember } from '../../../../models/types';

interface IUseLeavesDataProps {
  typeOfLeaveService?: TypeOfLeaveService;
  daysOfLeavesService?: DaysOfLeavesService;
  selectedStaff?: IStaffMember;
  currentUserId?: string;
  managingGroupId?: string;
  selectedPeriodStart: Date;
  selectedPeriodEnd: Date;
}

interface IUseLeavesDataReturn {
  typesOfLeave: ITypeOfLeave[];
  leaves: ILeaveDay[];
  isLoading: boolean;
  error?: string;
  loadData: () => void;
}

export const useLeavesData = (props: IUseLeavesDataProps): IUseLeavesDataReturn => {
  const {
    typeOfLeaveService,
    daysOfLeavesService,
    selectedStaff,
    currentUserId,
    managingGroupId,
    selectedPeriodStart,
    selectedPeriodEnd
  } = props;

  // Состояния
  const [typesOfLeave, setTypesOfLeave] = useState<ITypeOfLeave[]>([]);
  const [leaves, setLeaves] = useState<ILeaveDay[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  // Функция для загрузки всех данных
  const loadData = useCallback(async () => {
    console.log('[useLeavesData] Starting data load');
    setIsLoading(true);
    setError(undefined);

    try {
      // Загружаем типы отпусков
      if (typeOfLeaveService) {
        console.log('[useLeavesData] Loading types of leave');
        const types = await typeOfLeaveService.getAllTypesOfLeave();
        console.log('[useLeavesData] Loaded types:', types.length);
        setTypesOfLeave(types);
      } else {
        console.log('[useLeavesData] TypeOfLeaveService not available');
        setTypesOfLeave([]);
      }

      // Загружаем отпуска, если есть выбранный сотрудник
      if (daysOfLeavesService && selectedStaff?.employeeId && currentUserId && managingGroupId) {
        console.log('[useLeavesData] Loading leaves for staff:', {
          employeeId: selectedStaff.employeeId,
          currentUserId,
          managingGroupId,
          periodStart: selectedPeriodStart.toLocaleDateString(),
          periodEnd: selectedPeriodEnd.toLocaleDateString()
        });

        const leavesData = await daysOfLeavesService.getLeavesForMonthAndYear(
          selectedPeriodStart,
          parseInt(selectedStaff.employeeId, 10),
          parseInt(currentUserId, 10),
          parseInt(managingGroupId, 10)
        );
        
        console.log('[useLeavesData] Loaded leaves:', leavesData.length);
        setLeaves(leavesData);
      } else {
        console.log('[useLeavesData] Cannot load leaves - missing required data:', {
          hasService: !!daysOfLeavesService,
          hasStaff: !!selectedStaff,
          hasEmployeeId: !!selectedStaff?.employeeId,
          hasCurrentUserId: !!currentUserId,
          hasManagingGroupId: !!managingGroupId
        });
        setLeaves([]);
      }

    } catch (err) {
      const errorMessage = `Failed to load data: ${err}`;
      console.error('[useLeavesData]', errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      console.log('[useLeavesData] Data load completed');
    }
  }, [
    typeOfLeaveService,
    daysOfLeavesService,
    selectedStaff?.employeeId,
    currentUserId,
    managingGroupId,
    selectedPeriodStart,
    selectedPeriodEnd
  ]);

  return {
    typesOfLeave,
    leaves,
    isLoading,
    error,
    loadData
  };
};