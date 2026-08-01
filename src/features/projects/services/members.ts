import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { tryLogEntityActivity } from "@/features/activity/services/entity-activity";
import {
  assertCanAccessProject,
  assertCanManageProjectContents,
} from "@/features/projects/services/assert-can-access-project";
import type { AddProjectMemberInput } from "@/features/projects/schemas/project.schema";
import type {
  ProjectMember,
  ProjectMemberRow,
  ProjectUserSummary,
} from "@/features/projects/types/project.types";
import { createAdminClient } from "@/lib/supabase/admin";

type MemberWithUser = ProjectMemberRow & {
  user: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

const MEMBER_SELECT =
  "id, project_id, user_id, created_at, user:users!user_id(id, full_name, employee_number)";

function mapUser(
  row: MemberWithUser["user"],
  includeEmployeeNumber: boolean,
): ProjectUserSummary | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    fullName: row.full_name,
    ...(includeEmployeeNumber
      ? { employeeNumber: row.employee_number }
      : {}),
  };
}

function mapMember(
  row: MemberWithUser,
  includeEmployeeNumber: boolean,
): ProjectMember {
  return {
    id: row.id,
    projectId: row.project_id,
    userId: row.user_id,
    createdAt: row.created_at,
    user: mapUser(row.user, includeEmployeeNumber),
  };
}

export async function listProjectMembers(
  viewer: AppUser,
  projectId: string,
): Promise<ProjectMember[]> {
  await assertCanAccessProject(viewer, projectId);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("project_members")
    .select(MEMBER_SELECT)
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError(
      "تعذر جلب أعضاء المشروع.",
      500,
      "LIST_PROJECT_MEMBERS_FAILED",
    );
  }

  const includeEmployeeNumber = viewer.role !== "employee";
  return ((data ?? []) as unknown as MemberWithUser[]).map((row) =>
    mapMember(row, includeEmployeeNumber),
  );
}

export async function addProjectMember(
  viewer: AppUser,
  projectId: string,
  input: AddProjectMemberInput,
): Promise<ProjectMember> {
  const { departmentId } = await assertCanManageProjectContents(viewer, projectId);
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (existing) {
    throw new ApiError(
      "المستخدم عضو في المشروع بالفعل.",
      409,
      "ALREADY_PROJECT_MEMBER",
    );
  }

  const { data: membership } = await admin
    .from("department_memberships")
    .select("id")
    .eq("department_id", departmentId)
    .eq("user_id", input.userId)
    .eq("is_current", true)
    .maybeSingle();

  if (!membership) {
    throw new ApiError(
      "يجب أن يكون عضو المشروع من أعضاء القسم الحاليين.",
      409,
      "INVALID_PROJECT_MEMBER",
    );
  }

  const { data, error } = await admin
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: input.userId,
    })
    .select(MEMBER_SELECT)
    .single();

  if (error || !data) {
    throw new ApiError(
      "تعذر إضافة عضو المشروع.",
      500,
      "ADD_PROJECT_MEMBER_FAILED",
    );
  }

  const member = mapMember(data as unknown as MemberWithUser, true);
  await tryLogEntityActivity(
    viewer.id,
    "project",
    projectId,
    "project.member_added",
    {
      userId: input.userId,
      fullName: member.user?.fullName,
    },
  );
  return member;
}

export async function removeProjectMember(
  viewer: AppUser,
  projectId: string,
  userId: string,
): Promise<void> {
  await assertCanManageProjectContents(viewer, projectId);
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    throw new ApiError(
      "المستخدم ليس عضواً في المشروع.",
      404,
      "PROJECT_MEMBER_NOT_FOUND",
    );
  }

  const { error } = await admin
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);

  if (error) {
    throw new ApiError(
      "تعذر إزالة عضو المشروع.",
      500,
      "REMOVE_PROJECT_MEMBER_FAILED",
    );
  }

  await tryLogEntityActivity(
    viewer.id,
    "project",
    projectId,
    "project.member_removed",
    { userId },
  );
}
