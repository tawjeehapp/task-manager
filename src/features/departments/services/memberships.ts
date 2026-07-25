import "server-only";

import { ApiError } from "@/lib/api/errors";
import { mapUserRow, type UserRow } from "@/lib/auth/types";
import { toPublicUser } from "@/features/auth/types/auth.types";
import type {
  AddDepartmentMemberInput,
  MoveDepartmentMemberInput,
} from "@/features/departments/schemas/department.schema";
import type {
  DepartmentMembership,
  DepartmentMembershipRow,
} from "@/features/departments/types/department.types";
import { createAdminClient } from "@/lib/supabase/admin";

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function mapMembership(
  row: DepartmentMembershipRow,
  user?: ReturnType<typeof toPublicUser>,
): DepartmentMembership {
  return {
    id: row.id,
    departmentId: row.department_id,
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    isCurrent: row.is_current,
    createdAt: row.created_at,
    user,
  };
}

async function assertDepartmentActive(departmentId: string): Promise<void> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("departments")
    .select("id, status")
    .eq("id", departmentId)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (!data) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  if (data.status === "archived") {
    throw new ApiError(
      "لا يمكن تعديل عضوية قسم مؤرشف.",
      409,
      "DEPARTMENT_ARCHIVED",
    );
  }
}

export async function listDepartmentMembers(
  departmentId: string,
  options: { includeHistory?: boolean } = {},
): Promise<DepartmentMembership[]> {
  const admin = createAdminClient();

  const { data: department } = await admin
    .from("departments")
    .select("id")
    .eq("id", departmentId)
    .maybeSingle();

  if (!department) {
    throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
  }

  let builder = admin
    .from("department_memberships")
    .select("*")
    .eq("department_id", departmentId)
    .order("start_date", { ascending: false });

  if (!options.includeHistory) {
    builder = builder.eq("is_current", true);
  }

  const { data, error } = await builder;

  if (error) {
    throw new ApiError("تعذر جلب أعضاء القسم.", 500, "LIST_MEMBERS_FAILED");
  }

  const rows = (data ?? []) as DepartmentMembershipRow[];
  if (rows.length === 0) {
    return [];
  }

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: users, error: usersError } = await admin
    .from("users")
    .select("*")
    .in("id", userIds);

  if (usersError) {
    throw new ApiError("تعذر جلب بيانات الأعضاء.", 500, "LIST_MEMBERS_FAILED");
  }

  const userMap = new Map(
    ((users ?? []) as UserRow[]).map((u) => [
      u.id,
      toPublicUser(mapUserRow(u)),
    ]),
  );

  return rows.map((row) => mapMembership(row, userMap.get(row.user_id)));
}

export async function addDepartmentMember(
  departmentId: string,
  input: AddDepartmentMemberInput,
): Promise<DepartmentMembership> {
  await assertDepartmentActive(departmentId);

  const admin = createAdminClient();

  const { data: user, error: userError } = await admin
    .from("users")
    .select("*")
    .eq("id", input.userId)
    .maybeSingle();

  if (userError) {
    throw new ApiError("تعذر جلب المستخدم.", 500, "GET_USER_FAILED");
  }

  if (!user) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const { data: current } = await admin
    .from("department_memberships")
    .select("id, department_id")
    .eq("user_id", input.userId)
    .eq("is_current", true)
    .maybeSingle();

  if (current) {
    if (current.department_id === departmentId) {
      throw new ApiError(
        "الموظف عضو في هذا القسم بالفعل.",
        409,
        "ALREADY_MEMBER",
      );
    }
    throw new ApiError(
      "الموظف ينتمي إلى قسم آخر. استخدم نقل العضوية بدلاً من الإضافة.",
      409,
      "HAS_CURRENT_MEMBERSHIP",
    );
  }

  const { data: inserted, error: insertError } = await admin
    .from("department_memberships")
    .insert({
      department_id: departmentId,
      user_id: input.userId,
      start_date: utcToday(),
      end_date: null,
      is_current: true,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    if (insertError?.code === "23505") {
      throw new ApiError(
        "الموظف ينتمي إلى قسم آخر بالفعل.",
        409,
        "HAS_CURRENT_MEMBERSHIP",
      );
    }
    throw new ApiError("تعذر إضافة العضو.", 500, "ADD_MEMBER_FAILED");
  }

  return mapMembership(
    inserted as DepartmentMembershipRow,
    toPublicUser(mapUserRow(user as UserRow)),
  );
}

async function assertUserIsNotManagerOfDepartment(
  departmentId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { data: department, error } = await admin
    .from("departments")
    .select("id, manager_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب القسم.", 500, "GET_DEPARTMENT_FAILED");
  }

  if (department?.manager_id === userId) {
    throw new ApiError(
      "لا يمكن إزالة أو نقل مدير القسم قبل إزالة تعيينه كمدير.",
      409,
      "MEMBER_IS_DEPARTMENT_MANAGER",
    );
  }
}

export async function removeDepartmentMember(
  departmentId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data: membership, error } = await admin
    .from("department_memberships")
    .select("*")
    .eq("department_id", departmentId)
    .eq("user_id", userId)
    .eq("is_current", true)
    .maybeSingle();

  if (error) {
    throw new ApiError("تعذر جلب العضوية.", 500, "GET_MEMBERSHIP_FAILED");
  }

  if (!membership) {
    throw new ApiError("العضوية غير موجودة.", 404, "MEMBERSHIP_NOT_FOUND");
  }

  await assertUserIsNotManagerOfDepartment(departmentId, userId);

  const { error: updateError } = await admin
    .from("department_memberships")
    .update({
      is_current: false,
      end_date: utcToday(),
    })
    .eq("id", membership.id);

  if (updateError) {
    throw new ApiError("تعذر إزالة العضو.", 500, "REMOVE_MEMBER_FAILED");
  }
}

export async function moveDepartmentMember(
  input: MoveDepartmentMemberInput,
): Promise<DepartmentMembership> {
  await assertDepartmentActive(input.toDepartmentId);

  const admin = createAdminClient();

  const { data: user, error: userError } = await admin
    .from("users")
    .select("*")
    .eq("id", input.userId)
    .maybeSingle();

  if (userError) {
    throw new ApiError("تعذر جلب المستخدم.", 500, "GET_USER_FAILED");
  }

  if (!user) {
    throw new ApiError("المستخدم غير موجود.", 404, "USER_NOT_FOUND");
  }

  const { data: current } = await admin
    .from("department_memberships")
    .select("*")
    .eq("user_id", input.userId)
    .eq("is_current", true)
    .maybeSingle();

  if (current?.department_id === input.toDepartmentId) {
    throw new ApiError(
      "الموظف عضو في القسم المستهدف بالفعل.",
      409,
      "ALREADY_MEMBER",
    );
  }

  if (current) {
    await assertUserIsNotManagerOfDepartment(
      current.department_id,
      input.userId,
    );
  }

  const today = utcToday();

  if (current) {
    const { error: closeError } = await admin
      .from("department_memberships")
      .update({
        is_current: false,
        end_date: today,
      })
      .eq("id", current.id);

    if (closeError) {
      throw new ApiError("تعذر إنهاء العضوية السابقة.", 500, "MOVE_MEMBER_FAILED");
    }
  }

  const { data: inserted, error: insertError } = await admin
    .from("department_memberships")
    .insert({
      department_id: input.toDepartmentId,
      user_id: input.userId,
      start_date: today,
      end_date: null,
      is_current: true,
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    // Best-effort reopen previous if insert fails after close
    if (current) {
      await admin
        .from("department_memberships")
        .update({
          is_current: true,
          end_date: null,
        })
        .eq("id", current.id);
    }
    throw new ApiError("تعذر نقل العضو.", 500, "MOVE_MEMBER_FAILED");
  }

  return mapMembership(
    inserted as DepartmentMembershipRow,
    toPublicUser(mapUserRow(user as UserRow)),
  );
}
