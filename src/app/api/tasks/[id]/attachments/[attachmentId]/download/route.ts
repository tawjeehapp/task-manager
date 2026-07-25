import { NextResponse } from "next/server";

import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { getAttachmentDownloadUrl } from "@/features/tasks/services/attachments";

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/tasks/[id]/attachments/[attachmentId]/download",
    });
    const { id, attachmentId } = await context.params;
    const result = await getAttachmentDownloadUrl(user, id, attachmentId);
    const url = new URL(request.url);
    if (url.searchParams.get("redirect") === "1") {
      return NextResponse.redirect(result.url);
    }
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
