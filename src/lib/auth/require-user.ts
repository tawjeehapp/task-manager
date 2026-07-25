import "server-only";

import { ApiError } from "@/lib/api/errors";
import { getCurrentUser } from "@/lib/auth/session";
import type { AppUser } from "@/lib/auth/types";
import { PASSWORD_CHANGE_ALLOWLIST } from "@/lib/auth/password-change-allowlist";

export { PASSWORD_CHANGE_ALLOWLIST } from "@/lib/auth/password-change-allowlist";

export type RequireUserOptions = {
  /**
   * Route key matching PASSWORD_CHANGE_ALLOWLIST entries, e.g. "GET /api/auth/me".
   * When must_change_password is true and the route is not allowlisted, throws 403.
   */
  routeKey?: string;
  /** Skip forced-password-change check (use only for login itself). */
  skipPasswordChangeCheck?: boolean;
};

/**
 * Loads the current app user for API routes.
 * Enforces authentication, active status, and forced password change (unless allowlisted).
 */
export async function requireUser(
  options: RequireUserOptions = {},
): Promise<AppUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw new ApiError("غير مصرح. يرجى تسجيل الدخول.", 401, "UNAUTHORIZED");
  }

  if (!user.isActive) {
    throw new ApiError("الحساب غير نشط.", 403, "ACCOUNT_INACTIVE");
  }

  if (!options.skipPasswordChangeCheck && user.mustChangePassword) {
    const allowlisted =
      options.routeKey &&
      (PASSWORD_CHANGE_ALLOWLIST as readonly string[]).includes(
        options.routeKey,
      );

    if (!allowlisted) {
      throw new ApiError(
        "يجب تغيير كلمة المرور قبل المتابعة.",
        403,
        "PASSWORD_CHANGE_REQUIRED",
      );
    }
  }

  return user;
}
