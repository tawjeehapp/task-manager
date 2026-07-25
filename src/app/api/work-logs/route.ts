import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createWorkLogSchema,
  listWorkLogsQuerySchema,
} from "@/features/work-logs/schemas/work-log.schema";
import {
  createWorkLog,
  listWorkLogsForViewer,
} from "@/features/work-logs/services/work-logs";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/work-logs" });
    await requirePermission(user, PERMISSIONS.WORK_LOG_VIEW);

    const url = new URL(request.url);
    const parsed = listWorkLogsQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      taskId: url.searchParams.get("taskId") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listWorkLogsForViewer(user, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/work-logs" });
    await requirePermission(user, PERMISSIONS.WORK_LOG_CREATE);

    const body = await request.json();
    const parsed = createWorkLogSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const record = await createWorkLog(user, parsed.data);
    return apiSuccess(record, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
