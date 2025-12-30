// Atlan API Auth Service
// Supports PAT and OAuth authentication, session management, and token lifecycle

// Type definitions
export type AuthError = {
  message: string;
  code?: string;
};

export type AuthMethod = 'pat' | 'oauth';

export type AuthState = {
  isAuthenticated: boolean;
  method?: AuthMethod;
  user?: AtlanUser;
  tenant?: AtlanTenant;
  workspace?: AtlanWorkspace;
};

export type OAuthConfig = {
  clientId: string;
  redirectUri: string;
  scopes?: string[];
};

export type AtlanUser = {
  guid: string;
  name: string;
  email?: string;
};

export type AtlanTenant = {
  guid: string;
  name: string;
};

export type AtlanWorkspace = {
  guid: string;
  name: string;
};

// Minimal auth service stub
// TODO: Implement full auth service if needed
const authService = {
  isAuthenticated: false,
  getAuthState: (): AuthState => ({
    isAuthenticated: false,
  }),
  authenticate: async () => {
    throw new Error('Auth service not implemented');
  },
  logout: async () => {
    throw new Error('Auth service not implemented');
  },
};

export default authService;
