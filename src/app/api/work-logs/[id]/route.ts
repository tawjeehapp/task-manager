import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateWorkLogSchema } from "@/features/work-logs/schemas/work-log.schema";
import {
  deleteWorkLog,
  getWorkLogById,
  updateWorkLog,
} from "@/features/work-logs/services/work-logs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "GET /api/work-logs/[id]" });
    await requirePermission(user, PERMISSIONS.WORK_LOG_VIEW);
    const { id } = await context.params;
    const record = await getWorkLogById(user, id);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/work-logs/[id]" });
    await requirePermission(user, PERMISSIONS.WORK_LOG_CREATE);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = updateWorkLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const record = await updateWorkLog(user, id, parsed.data);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "DELETE /api/work-logs/[id]" });
    await requirePermission(user, PERMISSIONS.WORK_LOG_CREATE);
    const { id } = await context.params;
    await deleteWorkLog(user, id);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
