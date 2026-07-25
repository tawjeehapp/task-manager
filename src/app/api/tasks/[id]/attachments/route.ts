import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import {
  listTaskAttachments,
  uploadTaskAttachment,
} from "@/features/tasks/services/attachments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/tasks/[id]/attachments",
    });
    const { id } = await context.params;
    const items = await listTaskAttachments(user, id);
    return apiSuccess(items);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/tasks/[id]/attachments",
    });
    const { id } = await context.params;
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError("الملف مطلوب", 400, "VALIDATION_ERROR");
    }
    const attachment = await uploadTaskAttachment(user, id, file);
    return apiSuccess(attachment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
