import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { markAnnouncementsReadSchema } from "@/features/announcements/schemas/announcement.schema";
import { markAnnouncementsRead } from "@/features/announcements/services/announcements";

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/announcements/mark-read",
    });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_VIEW);

    const body = markAnnouncementsReadSchema.parse(await request.json());
    const result = await markAnnouncementsRead(user, body.ids);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
