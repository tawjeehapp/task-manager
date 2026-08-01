import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmployeeProfileClient } from "@/features/users/components/employee-profile-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations("employees");
  return { title: t("profileTitle") };
}

export default async function EmployeeProfilePage({ params }: PageProps) {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  const canManage = hasPermission(
    user.role,
    PERMISSIONS.USER_MANAGE,
    permissions,
  );
  const canReset = hasPermission(
    user.role,
    PERMISSIONS.USER_RESET_PASSWORD,
    permissions,
  );

  if (!canManage && !canReset) {
    redirect("/");
  }

  const canEditTasks =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.TASK_ASSIGN, permissions);
  const canApproveAttendance = hasPermission(
    user.role,
    PERMISSIONS.ATTENDANCE_APPROVE,
    permissions,
  );
  const canApproveLeave = hasPermission(
    user.role,
    PERMISSIONS.LEAVE_APPROVE,
    permissions,
  );
  const canApproveEmployeeRequest = hasPermission(
    user.role,
    PERMISSIONS.EMPLOYEE_REQUEST_APPROVE,
    permissions,
  );

  const { id } = await params;

  return (
    <EmployeeProfileClient
      userId={id}
      canManage={canManage}
      isAdmin={user.role === "admin"}
      canEditTasks={canEditTasks}
      canApproveAttendance={canApproveAttendance}
      canApproveLeave={canApproveLeave}
      canApproveEmployeeRequest={canApproveEmployeeRequest}
      currentUserId={user.id}
    />
  );
}
