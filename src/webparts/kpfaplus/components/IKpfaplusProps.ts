import { WebPartContext } from "@microsoft/sp-webpart-base";

export interface IKpfaplusProps {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  context: WebPartContext; // Свойство context для доступа к API
}