import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { loginSchema } from "@/features/auth/schemas/auth.schema";
import { loginWithEmployeeNumber } from "@/features/auth/services/login";
import { toPublicUser } from "@/features/auth/types/auth.types";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const user = await loginWithEmployeeNumber(parsed.data);

    return apiSuccess({
      user: toPublicUser(user),
    });
  } catch (error) {
    return apiError(error);
  }
}
