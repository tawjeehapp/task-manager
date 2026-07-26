import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import {
  mapUserRow,
  type AppUser,
  type AuthSession,
  type UserRow,
} from "@/lib/auth/types";

export type { AppUser, AuthSession, AuthUser } from "@/lib/auth/types";

export const getSession = cache(async (): Promise<AuthSession | null> => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return null;
  }

  const user = await getAppUserByAuthId(authUser.id);
  if (!user) {
    return null;
  }

  return {
    accessToken: "",
    user,
  };
});

export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const session = await getSession();
  return session?.user ?? null;
});

export const getAppUserByAuthId = cache(
  async (authUserId: string): Promise<AppUser | null> => {
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
  },
);
