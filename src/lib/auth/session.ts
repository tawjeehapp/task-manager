import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  mapUserRow,
  type AppUser,
  type AuthSession,
  type UserRow,
} from "@/lib/auth/types";

export type { AppUser, AuthSession, AuthUser } from "@/lib/auth/types";

export async function getSession(): Promise<AuthSession | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = await getAppUserByAuthId(authUser.id);
  if (!user) {
    return null;
  }

  return {
    accessToken: session?.access_token ?? "",
    user,
  };
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getAppUserByAuthId(
  authUserId: string,
): Promise<AppUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapUserRow(data as UserRow);
}
