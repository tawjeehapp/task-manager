import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/config/env";

const PUBLIC_PATHS = new Set(["/login"]);
const PASSWORD_CHANGE_PATH = "/change-password";

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

function isAuthAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/icons") ||
    pathname.startsWith("/splash") ||
    pathname.startsWith("/brand") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAuthAssetPath(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Without Supabase config, allow app shell for local UI work.
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (isPublicPath(pathname) || pathname === PASSWORD_CHANGE_PATH) {
      if (pathname === PASSWORD_CHANGE_PATH) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/login";
        return NextResponse.redirect(loginUrl);
      }
      return response;
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated: load must_change_password for UX redirects only.
  const { data: profile } = await supabase
    .from("users")
    .select("must_change_password, is_active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  const mustChangePassword = profile?.must_change_password === true;

  if (mustChangePassword && pathname !== PASSWORD_CHANGE_PATH) {
    const changeUrl = request.nextUrl.clone();
    changeUrl.pathname = PASSWORD_CHANGE_PATH;
    return NextResponse.redirect(changeUrl);
  }

  if (!mustChangePassword && pathname === PASSWORD_CHANGE_PATH) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  if (pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
