import "server-only";

import { cache } from "react";

import { ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export const getManagedDepartmentId = cache(
  async (managerId: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("departments")
      .select("id")
      .eq("manager_id", managerId)
      .maybeSingle();
    return data?.id ?? null;
  },
);

export const getCurrentDepartmentIdForUser = cache(
  async (userId: string): Promise<string | null> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("department_memberships")
      .select("department_id")
      .eq("user_id", userId)
      .eq("is_current", true)
      .maybeSingle();
    return data?.department_id ?? null;
  },
);

/** Project IDs where the user is a project member (request-scoped). */
export const getProjectIdsForUser = cache(
  async (userId: string): Promise<string[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("project_members")
      .select("project_id")
      .eq("user_id", userId);

    if (error) {
      throw new ApiError(
        "تعذر جلب عضويات المشاريع.",
        500,
        "LIST_PROJECT_MEMBERS_FAILED",
      );
    }

    return (data ?? []).map((row) => row.project_id as string);
  },
);

/** True when target has a current membership in a department managed by managerId. */
export const sharesManagedDepartmentWith = cache(
  async (managerId: string, targetUserId: string): Promise<boolean> => {
    const managedId = await getManagedDepartmentId(managerId);
    if (!managedId) {
      return false;
    }

    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("department_memberships")
      .select("id")
      .eq("department_id", managedId)
      .eq("user_id", targetUserId)
      .eq("is_current", true)
      .maybeSingle();

    return Boolean(membership);
  },
);
