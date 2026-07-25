import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { getDashboardSummary } from "@/features/dashboard/services/dashboard";

export async function GET() {
  try {
    const user = await requireUser({ routeKey: "GET /api/dashboard" });
    const data = await getDashboardSummary(user);
    return apiSuccess(data);
  } catch (error) {
    return apiError(error);
  }
}
