import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createProjectSchema,
  listProjectsQuerySchema,
} from "@/features/projects/schemas/project.schema";
import {
  createProject,
  listEmployeeProjectsWithStats,
  listProjectsForViewer,
} from "@/features/projects/services/projects";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/projects" });
    await requirePermission(user, PERMISSIONS.PROJECT_VIEW);

    const url = new URL(request.url);
    const parsed = listProjectsQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      memberUserId: url.searchParams.get("memberUserId") ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") ?? undefined,
      includeStats: url.searchParams.get("includeStats") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (parsed.data.includeStats) {
      if (user.role !== "employee") {
        throw new ApiError(
          "إحصاءات المشاريع متاحة للموظفين فقط.",
          403,
          "FORBIDDEN",
        );
      }
      const result = await listEmployeeProjectsWithStats(user);
      return apiSuccess(result);
    }

    const result = await listProjectsForViewer(user, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/projects" });
    await requirePermission(user, PERMISSIONS.PROJECT_MANAGE);

    const body: unknown = await request.json();
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const project = await createProject(user, parsed.data);
    return apiSuccess(project, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
