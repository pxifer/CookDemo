export interface SessionInfo {
  accountSnapshot?: import('./account').AccountSnapshot;
  identity: 'guest' | 'local-test' | 'account';
  userId?: string;
  mustChangePassword?: boolean;
  displayName?: string;
  accountAvailable: boolean;
  registrationAvailable?: boolean;
  localTestFeatures: boolean;
  healthModelAvailable?: boolean;
  healthChatAvailable?: boolean;
  healthModelProvider?: string;
  csrfToken: string;
}
