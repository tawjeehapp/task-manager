import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  listLeaveBalancesQuerySchema,
  upsertLeaveBalanceSchema,
} from "@/features/leave/schemas/leave.schema";
import {
  listLeaveBalances,
  upsertLeaveBalance,
} from "@/features/leave/services/leave-types-balances";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/leave-balances" });
    await requirePermission(user, PERMISSIONS.LEAVE_VIEW);
    const url = new URL(request.url);
    const query = listLeaveBalancesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const items = await listLeaveBalances(user, query);
    return apiSuccess(items);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireUser({ routeKey: "PUT /api/leave-balances" });
    await requirePermission(user, PERMISSIONS.LEAVE_MANAGE);
    const body = upsertLeaveBalanceSchema.parse(await request.json());
    const item = await upsertLeaveBalance(body);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
