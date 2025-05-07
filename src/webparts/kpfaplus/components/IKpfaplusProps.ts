// src/webparts/kpfaplus/components/IKpfaplusProps.ts
import { WebPartContext } from '@microsoft/sp-webpart-base';
export interface IKPFAprops {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  context: WebPartContext; // Добавляем контекст
  // Удалены props context, т.к. они теперь доступны через контекст
}