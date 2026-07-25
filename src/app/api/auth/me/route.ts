import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { getMe } from "@/features/auth/services/get-me";

export async function GET() {
  try {
    const user = await requireUser({ routeKey: "GET /api/auth/me" });
    const data = await getMe(user);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
