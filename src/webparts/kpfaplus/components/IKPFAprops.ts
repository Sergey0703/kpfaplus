import { IDepartment } from "../services/DepartmentService";

export interface IKPFAProps {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  // Add department data properties
  departments: IDepartment[];
  defaultDepartment: IDepartment | null;
}