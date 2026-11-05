export interface SessionInfo {
  accountSnapshot?: import('./account').AccountSnapshot;
  identity: 'guest' | 'local-test' | 'account';
  userId?: string;
  mustChangePassword?: boolean;
  displayName?: string;
  accountAvailable: boolean;
  registrationAvailable?: boolean;
  recoveryAvailable?:boolean;
  erasureAvailable?:boolean;
  localTestFeatures: boolean;
  healthModelAvailable?: boolean;
  healthChatAvailable?: boolean;
  healthGuidanceResearch?:boolean;
  healthModelProvider?: string;
  csrfToken: string;
}
