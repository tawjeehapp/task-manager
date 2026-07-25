import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import type { ListUsersQuery } from "@/features/users/schemas/user.schema";
import type { UsersListResult } from "@/features/users/types/user.types";
import { createAdminClient } from "@/lib/supabase/admin";

export async function listUsers(query: ListUsersQuery): Promise<UsersListResult> {
  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let builder = admin
    .from("users")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (query.isActive !== undefined) {
    builder = builder.eq("is_active", query.isActive);
  }

  if (query.search?.trim()) {
    const term = `%${query.search.trim()}%`;
    builder = builder.or(
      `full_name.ilike.${term},employee_number.ilike.${term},phone.ilike.${term}`,
    );
  }

  const { data, error, count } = await builder;

  if (error) {
    throw new ApiError("تعذر جلب المستخدمين.", 500, "LIST_USERS_FAILED");
  }

  return {
    items: (data as UserRow[]).map((row) => toPublicUser(mapUserRow(row))),
    total: count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
  };
}
