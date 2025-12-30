// Atlan API Auth Service (imported from atlan-metadata-designer)
// Supports PAT and OAuth authentication, session management, and token lifecycle

// Types and helpers from atlan-metadata-designer
export type { AuthError, AuthMethod, AuthState, OAuthConfig, AtlanUser, AtlanTenant, AtlanWorkspace } from '../../../atlan-metadata-designer/src/types/auth';

// Auth service singleton
// (You may need to adjust import paths if you move this file)
import { authService } from '../../../atlan-metadata-designer/src/services/auth/AuthService';

export default authService;
