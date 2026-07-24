export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  accessToken: string;
  user: AuthUser;
};

/**
 * Session helpers are stubs in Milestone 0.
 * Authentication is implemented in Milestone 1.
 */
export async function getSession(): Promise<AuthSession | null> {
  return null;
}

/**
 * Current user helper stub for Milestone 0.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  return null;
}
