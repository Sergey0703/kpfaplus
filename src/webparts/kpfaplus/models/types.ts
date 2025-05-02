export interface IStaffMember {
    id: string;
    name: string;
    groupMemberId?: string;
    employeeId?: string;
    autoSchedule?: boolean;
    deleted?: boolean;
  }
  
  export interface IDepartment {
    key: string;
    text: string;
  }
  
  export interface ITabProps {
    selectedStaff: IStaffMember | null;
    onStaffUpdate?: (staff: IStaffMember) => void;
  }