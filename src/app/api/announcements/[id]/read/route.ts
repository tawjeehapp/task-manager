import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { markAnnouncementRead } from "@/features/announcements/services/announcements";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/announcements/[id]/read",
    });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_VIEW);
    const { id } = await context.params;
    const item = await markAnnouncementRead(user, id);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
