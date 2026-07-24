import { NextResponse, type NextRequest } from "next/server";

/**
 * Locale is resolved in `src/i18n/request.ts` (Arabic default, no URL prefix).
 * Do not use next-intl's createMiddleware here — that expects a `[locale]`
 * segment and would 404 routes under `app/(app)/`.
 */
export default function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
