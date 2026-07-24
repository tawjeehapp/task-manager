import { NextResponse } from "next/server";

import { ApiError, toErrorBody } from "@/lib/api/errors";

export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, { status: 200, ...init });
}

export function apiError(error: unknown, fallbackStatus = 500) {
  if (error instanceof ApiError) {
    return NextResponse.json(toErrorBody(error), { status: error.status });
  }

  const message =
    error instanceof Error ? error.message : "حدث خطأ غير متوقع";

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message,
      },
    },
    { status: fallbackStatus },
  );
}
