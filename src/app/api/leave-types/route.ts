import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createLeaveTypeSchema,
  listLeaveTypesQuerySchema,
} from "@/features/leave/schemas/leave.schema";
import {
  createLeaveType,
  listLeaveTypes,
} from "@/features/leave/services/leave-types-balances";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/leave-types" });
    await requirePermission(user, PERMISSIONS.LEAVE_VIEW);
    const url = new URL(request.url);
    const query = listLeaveTypesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    // Only admins with manage may include inactive by default intent;
    // allow includeInactive only when leave.manage is held.
    if (query.includeInactive) {
      await requirePermission(user, PERMISSIONS.LEAVE_MANAGE);
    }
    const items = await listLeaveTypes(query);
    return apiSuccess(items);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/leave-types" });
    await requirePermission(user, PERMISSIONS.LEAVE_MANAGE);
    const body = createLeaveTypeSchema.parse(await request.json());
    const item = await createLeaveType(body);
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
