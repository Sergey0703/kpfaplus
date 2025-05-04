import { WebPartContext } from "@microsoft/sp-webpart-base";
import { IDepartment } from '../services/DepartmentService';

export interface IKPFAProps {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  context: WebPartContext;
  
  // Опциональные свойства для департаментов
  departments?: IDepartment[];
  defaultDepartment?: IDepartment;
}