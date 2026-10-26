export interface SessionInfo {
  accountSnapshot?: import('./account').AccountSnapshot;
  identity: 'guest' | 'local-test' | 'account';
  userId?: string;
  mustChangePassword?: boolean;
  displayName?: string;
  accountAvailable: boolean;
  registrationAvailable?: boolean;
  localTestFeatures: boolean;
  csrfToken: string;
}
