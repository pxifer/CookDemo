export interface SessionInfo {
  identity: 'guest' | 'local-test';
  displayName?: string;
  accountAvailable: boolean;
  localTestFeatures: boolean;
  csrfToken: string;
}
