import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createProjectRequestSchema,
  listProjectRequestsQuerySchema,
} from "@/features/project-requests/schemas/project-request.schema";
import {
  createProjectRequest,
  listProjectRequests,
} from "@/features/project-requests/services/project-requests";

export async function GET(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/project-requests",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_REQUEST_VIEW);
    const url = new URL(request.url);
    const query = listProjectRequestsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listProjectRequests(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/project-requests",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_REQUEST_CREATE);
    const body = createProjectRequestSchema.parse(await request.json());
    const item = await createProjectRequest(user, body);
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
