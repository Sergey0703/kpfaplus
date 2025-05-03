import { WebPartContext } from "@microsoft/sp-webpart-base";

export interface IKPFAprops {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  context: WebPartContext;
  // Используем undefined вместо null, как требуется линтером
}