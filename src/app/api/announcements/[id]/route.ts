import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateAnnouncementSchema } from "@/features/announcements/schemas/announcement.schema";
import {
  deleteAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
} from "@/features/announcements/services/announcements";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/announcements/[id]",
    });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_VIEW);
    const { id } = await context.params;
    const item = await getAnnouncementById(user, id);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "PATCH /api/announcements/[id]",
    });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_MANAGE);
    const { id } = await context.params;
    const body = updateAnnouncementSchema.parse(await request.json());
    const item = await updateAnnouncement(user, id, body);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/announcements/[id]",
    });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_MANAGE);
    const { id } = await context.params;
    const result = await deleteAnnouncement(user, id);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
