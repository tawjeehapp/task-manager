import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { changePasswordSchema } from "@/features/auth/schemas/auth.schema";
import { changePassword } from "@/features/auth/services/change-password";

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/auth/change-password",
    });

    const body: unknown = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    await changePassword(user, parsed.data);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
