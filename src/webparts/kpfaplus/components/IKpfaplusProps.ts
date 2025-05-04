// src/webparts/kpfaplus/components/IKpfaplusProps.ts
export interface IKPFAprops {
  description: string;
  isDarkTheme: boolean;
  environmentMessage: string;
  hasTeamsContext: boolean;
  userDisplayName: string;
  // Удалены props context, т.к. они теперь доступны через контекст
}