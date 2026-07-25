import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { logout } from "@/features/auth/services/login";

export async function POST() {
  try {
    await requireUser({ routeKey: "POST /api/auth/logout" });
    await logout();
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
