import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
} from "@/features/announcements/schemas/announcement.schema";
import {
  createAnnouncement,
  listAnnouncements,
} from "@/features/announcements/services/announcements";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/announcements" });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_VIEW);

    const url = new URL(request.url);
    const query = listAnnouncementsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listAnnouncements(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/announcements" });
    await requirePermission(user, PERMISSIONS.ANNOUNCEMENT_MANAGE);

    const body = createAnnouncementSchema.parse(await request.json());
    const item = await createAnnouncement(user, body);
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
